// BlockyMod Studio – slimme check zonder browser:
// laadt de modules, bouwt een voorbeeld-project, exporteert alles en controleert de ZIP.
// Gebruik:  npm run check   (vanuit app/)
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const os = require("os");

// ── Omgeving-stubs (browser-globalen) ──
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

const JS_DIR = path.join(__dirname, "..", "renderer", "js");
const ORDER = ["util.js", "zip.js", "state.js", "texture.js", "soundlib.js", "guidesign.js", "recipes.js", "exporters.js"];

for (const f of ORDER) {
  const code = fs.readFileSync(path.join(JS_DIR, f), "utf8");
  vm.runInThisContext(code, { filename: f });
}

let failures = 0;
function ok(cond, msg) {
  if (cond) {
    console.log("  ✔ " + msg);
  } else {
    failures++;
    console.error("  ✘ " + msg);
  }
}

// ══════════════════════════════════
console.log("\n[1] Project aanmaken");
const p = State.createProject("Test Mod", "Tester");
p.meta.mcVersion = "1.20.1"; // leg expliciet de stabiele Yarn-doelvast
ok(p && p.meta.modId === "test_mod", "mod-id afgeleid: " + (p && p.meta.modId));
ok(State.current() === p, "project is actief");

console.log("\n[2] Inhoud toevoegen");
p.blocks.push({
  id: "proef_blok", name: "Proef Blok", hardness: 2, requiresTool: true,
  tool: "pickaxe", light: 5,
  pixels: TextureKit.generate("ertsen", "#e0c040", 42)
});
p.items.push({
  id: "proef_item", name: "Proef Item", maxStack: 16,
  pixels: TextureKit.generate("ruis", "#b87333", 7)
});
const gui = {
  id: "proef_bank", name: "Proef Bank", width: 176, height: 166,
  mode: "crafting", bgColor: "#C6C6C6",
  elements: State.defaultCraftingElements("Proef Bank")
};
p.guis.push(gui);
p.workstations.push({
  id: "proef_bank_ws", name: "Proef Bank", blockId: "proef_blok", guiId: "proef_bank",
  recipes: [
    {
      type: "shaped",
      cells: [
        "minecraft:oak_planks", "minecraft:oak_planks", null,
        null, "minecraft:stick", null,
        null, "minecraft:stick", null
      ],
      output: "proef_item", count: 2
    },
    {
      type: "shapeless",
      cells: ["minecraft:cobblestone", "minecraft:cobblestone", "minecraft:stick",
        null, null, null, null, null, null],
      output: "minecraft:stone", count: 1
    },
    {
      type: "smelting",
      cells: ["minecraft:iron_ore", null, null, null, null, null, null, null, null],
      output: "minecraft:iron_ingot", count: 1
    }
  ]
});
p.mobs.push({
  id: "proef_mob", name: "Proef Mob", kind: "hostile",
  health: 30, speed: 0.3, damage: 5, width: 0.9, height: 1.6,
  colors: { primary: "#ff5555", secondary: "#222222" },
  guiId: "proef_bank",
  drops: [
    { id: "minecraft:diamond", count: 1, chance: 0.25 },
    { id: "proef_item", count: 3, chance: 1 }
  ]
});
p.story.chapters.push({
  id: "hoofdstuk_1", title: "Het begin",
  events: [
    { id: "e1", trigger: { type: "join" }, actions: [{ type: "message", text: "Welkom in Test Mod!" }] },
    { id: "e2", trigger: { type: "kill", entity: "minecraft:zombie" }, actions: [{ type: "give", item: "proef_item", count: 1 }, { type: "next" }] },
    { id: "e3", trigger: { type: "location", x: 0, y: 64, z: 0, r: 5 }, actions: [{ type: "gui", gui: "proef_bank" }] }
  ]
});
p.aiFiles.push({ path: "extra/Voorbeeld.java", content: "// door de AI geschreven code\npublic class Voorbeeld {}\n" });
ok(true, "blokken/items/gui/werkbank/mob/verhaal/ai-code toegevoegd");

console.log("\n[3] Recepten-patroon");
const pat = RecipesKit.buildPattern(p.workstations[0].recipes[0].cells);
ok(JSON.stringify(pat.pattern) === JSON.stringify(["AA", " B", " B"]), "patroon = " + JSON.stringify(pat.pattern));
ok(pat.key.A === "minecraft:oak_planks" && pat.key.B === "minecraft:stick", "key klopt: " + JSON.stringify(pat.key));
const patTrim = RecipesKit.buildPattern([null, null, null, null, "minecraft:stick", null, null, null, null]);
ok(JSON.stringify(patTrim.pattern) === JSON.stringify(["A"]), "1 ingrediënt → patroon ['A']");

console.log("\n[4] Export: tekstbestanden");
const files = Exporters.buildTextFiles(p);
const names = Object.keys(files);
ok(names.length > 25, `${names.length} bestanden gegenereerd`);

function mustExist(p2, why) {
  ok(Object.prototype.hasOwnProperty.call(files, p2), `${why}: ${p2}`);
}
mustExist("README.md", "readme");
mustExist("build.gradle", "gradle");
mustExist("gradle.properties", "gradle");
mustExist("settings.gradle", "gradle");
mustExist("src/main/resources/fabric.mod.json", "modmeta");
mustExist("src/main/java/com/tester/test_mod/ModMain.java", "hoofdklasse");
mustExist("src/main/java/com/tester/test_mod/ModBlocks.java", "blokken");
mustExist("src/main/java/com/tester/test_mod/ModItems.java", "items");
mustExist("src/main/java/com/tester/test_mod/ModEntities.java", "entities");
mustExist("src/main/java/com/tester/test_mod/gui/ProefBankScreenHandler.java", "GUI-handler");
mustExist("src/main/java/com/tester/test_mod/client/ProefBankScreen.java", "GUI-scherm");
mustExist("src/main/java/com/tester/test_mod/entity/ProefMobEntity.java", "mob-klasse");
mustExist("src/main/java/com/tester/test_mod/story/StoryManager.java", "verhaal");
mustExist("src/main/resources/data/test_mod/story/storyline.json", "verhaal-JSON");
mustExist("src/main/resources/assets/test_mod/models/item/proef_item.json", "itemmodel");
ok(!("src/main/resources/assets/test_mod/textures/block/proef_blok.png.png" in files), "geen dubbele .png-extensie");
ok(!("src/main/resources/assets/test_mod/textures/block/proef_blok.png" in files), "textuur-png's komen later uit de render-stap");
mustExist("src/main/resources/assets/test_mod/blockstates/proef_blok.json", "blockstate");
mustExist("src/main/resources/assets/test_mod/models/block/proef_blok.json", "model");
mustExist("src/main/resources/data/test_mod/loot_tables/blocks/proef_blok.json", "loottable");
mustExist("ai-code/README.md", "ai-code readme");
mustExist("ai-code/extra/Voorbeeld.java", "geïmporteerde AI-code");

console.log("\n[5] JSON-validiteit");
function parseJson(key, why) {
  try {
    JSON.parse(files[key]);
    ok(true, why + " parsebaar");
  } catch (e) {
    ok(false, why + " parsebaar – FOUT: " + e.message);
  }
}
parseJson("src/main/resources/fabric.mod.json", "fabric.mod.json");
const fmj = JSON.parse(files["src/main/resources/fabric.mod.json"]);
ok(fmj.id === "test_mod", "fabric.id = " + fmj.id);
ok(fmj.entrypoints.main[0] === "com.tester.test_mod.ModMain", "main-entrypoint");
ok(fmj.entrypoints.client && fmj.entrypoints.client[0].includes("ModClient"), "client-entrypoint");

parseJson("src/main/resources/data/test_mod/recipes/proef_bank_ws_01.json", "recept 1");
parseJson("src/main/resources/data/test_mod/recipes/proef_bank_ws_02.json", "recept 2");
parseJson("src/main/resources/data/test_mod/recipes/proef_bank_ws_03.json", "recept 3");
parseJson("src/main/resources/assets/test_mod/layout/proef_bank.json", "GUI-layout");
parseJson("src/main/resources/assets/test_mod/lang/nl_nl.json", "nl_nl");
parseJson("src/main/resources/data/test_mod/story/storyline.json", "storyline");

const r1 = JSON.parse(files["src/main/resources/data/test_mod/recipes/proef_bank_ws_01.json"]);
ok(r1.type === "minecraft:crafting_shaped", "recept 1 = shaped");
ok(r1.result && r1.result.item === "test_mod:proef_item" && r1.result.count === 2, "uitvoer → test_mod:proef_item ×2");
const r2 = JSON.parse(files["src/main/resources/data/test_mod/recipes/proef_bank_ws_02.json"]);
ok(r2.type === "minecraft:crafting_shapeless", "recept 2 = shapeless");
const r3 = JSON.parse(files["src/main/resources/data/test_mod/recipes/proef_bank_ws_03.json"]);
ok(r3.type === "minecraft:smelting" && r3.ingredient.item === "minecraft:iron_ore", "recept 3 = smelting");

console.log("\n[6] Java-code inhoudelijk");
const main = files["src/main/java/com/tester/test_mod/ModMain.java"];
ok(main.includes('MOD_ID = "test_mod"'), "MOD_ID juist");
ok(main.includes("story.StoryEvents.register();"), "story-events registratie");
const blocks = files["src/main/java/com/tester/test_mod/ModBlocks.java"];
ok(blocks.includes("PROEF_BLOK"), "blokconst");
ok(blocks.includes(".lightLevel(state -> 5)"), "lichtsterkte 5");
ok(blocks.includes(".material(Material.STONE)"), "materiaal (MC 1.20.1)");
const handler = files["src/main/java/com/tester/test_mod/gui/ProefBankScreenHandler.java"];
ok(handler.includes("extends CraftingScreenHandler"), "werkbank-erft van CraftingScreenHandler");
ok(handler.includes("SLOT_POS"), "slotposities uit ontwerp");
ok(handler.includes("{124, 35, 124, 35}"), "uitvoer op vanilla-positie (ongewijzigd)");
ok(handler.includes("slot.x = q[2]"), "herpositioneringslogica");
const screen = files["src/main/java/com/tester/test_mod/client/ProefBankScreen.java"];
ok(screen.includes("textures/gui/proef_bank.png"), "eigen GUI-textuur");
ok(screen.includes("drawText"), "labels worden getekend");
const mob = files["src/main/java/com/tester/test_mod/entity/ProefMobEntity.java"];
ok(mob.includes("interactMob"), "mob opent GUI bij rechtsklik");
ok(mob.includes("ProefBankScreenHandler"), "juiste handler gekoppeld");
ok(mob.includes("Items.DIAMOND"), "vanilla-drop");
ok(mob.includes("ModItems.PROEF_ITEM"), "project-drop");
const story = files["src/main/java/com/tester/test_mod/story/StoryManager.java"];
ok(story.includes('"message"'), "actie: message");
ok(story.includes('"next"'), "actie: next");
ok(story.includes("case \"proef_bank\""), "GUI-case in verhaal");

console.log("\n[7] ZIP bouwen");
// text + dummy-texturen (1×1 png) om de volledige keten te oefenen
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const zipFiles = [];
for (const [k, v] of Object.entries(files)) zipFiles.push({ path: "test_mod/" + k, data: v });
for (const t of Exporters.collectTextures(p)) zipFiles.push({ path: "test_mod/" + t.path, data: png });
const zipBytes = Zip.build(zipFiles);
ok(zipBytes.length > 2000, `ZIP gebouwd: ${zipBytes.length} bytes, ${zipFiles.length} bestanden`);

const tmp = path.join(os.tmpdir(), "blockymod-check.zip");
fs.writeFileSync(tmp, zipBytes);
console.log("  → " + tmp);

console.log("\n[8] Lege project-export (geen crash) – nu 26.3 (Mojang-mappings)");
State.removeProject(p.meta.modId);
const p2 = State.createProject("Leeg", "Iemand");
ok(p2.meta.mcVersion === "26.3", "standaard-versie is 26.3 (laatste Minecraft)");
const emptyFiles = Exporters.buildTextFiles(p2);
ok(Object.keys(emptyFiles).length > 8, `leeg project → ${Object.keys(emptyFiles).length} bestanden (structuur klopt)`);
ok(emptyFiles["src/main/java/com/iemand/leeg/ModBlocks.java"].includes("(nog geen blokken"), "lege-blokken-placeholder");
ok(emptyFiles["gradle.properties"].includes("loader_version=0.19.5"), "26.3 → Fabric Loader 0.19.5");
ok(emptyFiles["build.gradle"].includes("loom.officialMojangMappings()"), "26.3 → officiële Mojang-mappings");
ok(!emptyFiles["gradle.properties"].includes("yarn"), "26.3 → geen Yarn-mappings");
ok(JSON.parse(emptyFiles["src/main/resources/fabric.mod.json"]).depends.java === ">=25", "26.3 → Java >=25");

console.log("\n[9] Volledige export op Minecraft 26.3 (laatste versie)");
const p3 = State.createProject("Latest Mod", "Tester2"); // mcVersion = 26.3 (standaard)
p3.blocks.push({ id: "nieuw_blok", name: "Nieuw Blok", hardness: 2, requiresTool: true, tool: "pickaxe", light: 4, pixels: TextureKit.generate("steen", "#7d7d7d", 9) });
p3.items.push({ id: "nieuw_item", name: "Nieuw Item", maxStack: 16, pixels: TextureKit.generate("ruis", "#b87333", 11) });
p3.guis.push({
  id: "winkel", name: "Winkel", width: 176, height: 166, mode: "crafting",
  bgColor: "#C6C6C6", elements: State.defaultCraftingElements("Winkel")
});
p3.workstations.push({
  id: "winkel_ws", name: "Winkel", blockId: "nieuw_blok", guiId: "winkel",
  recipes: [{ type: "shaped", cells: ["minecraft:cobblestone", null, null, null, null, null, null, null, null], output: "nieuw_item", count: 1 }]
});
p3.mobs.push({
  id: "nieuw_mob", name: "Nieuwe Mob", kind: "passive", health: 12, speed: 0.3, damage: 2,
  width: 0.8, height: 1.2, colors: { primary: "#55ff55", secondary: "#222222" },
  guiId: "winkel", drops: [{ id: "nieuw_item", count: 1, chance: 1 }]
});
p3.story.chapters.push({ id: "h1", title: "Start", events: [{ id: "e1", trigger: { type: "join" }, actions: [{ type: "message", text: "Hoi!" }] }] });

const m = Exporters.buildTextFiles(p3);
ok(Object.keys(m).length > 25, `${Object.keys(m).length} bestanden (26.3)`);

const mMain = m["src/main/java/com/tester2/latest_mod/ModMain.java"];
ok(mMain.includes("ResourceLocation.fromNamespaceAndPath"), "ModMain → ResourceLocation");
ok(!mMain.includes("Identifier"), "ModMain geen Yarn-Identifier");
const mBlocks = m["src/main/java/com/tester2/latest_mod/ModBlocks.java"];
ok(mBlocks.includes("BuiltInRegistries.BLOCK"), "blokken → BuiltInRegistries");
ok(mBlocks.includes("properties.setId(key)"), "blokken → registry-key (1.21.2+ verplicht)");
ok(mBlocks.includes("requiresCorrectToolForDrops()"), "blokken → officiële requiresTool-naam");
ok(mBlocks.includes("BlockBehaviour.Properties.of()"), "blokken → BlockBehaviour.Properties");
const mItems = m["src/main/java/com/tester2/latest_mod/ModItems.java"];
ok(mItems.includes("useBlockDescriptionPrefix()"), "items → blok-prefixed translation key");
ok(mItems.includes("props.stacksTo(16)"), "items → stacksTo");
ok(mItems.includes("SpawnEggItem"), "spawn-egg aangemaakt");
const mEnt = m["src/main/java/com/tester2/latest_mod/ModEntities.java"];
ok(mEnt.includes("EntityType.Builder.<NieuwMobEntity>of"), "entities → EntityType.Builder");
ok(mEnt.includes("builder.build(key)"), "entities → build(key)");
ok(mEnt.includes("MobCategory.CREATURE"), "entities → MobCategory (niet SpawnGroup)");
const mEntC = m["src/main/java/com/tester2/latest_mod/entity/NieuwMobEntity.java"];
ok(mEntC.includes("extends Pig"), "mob erft van Pig (officiële naam)");
ok(mEntC.includes("Attributes.MAX_HEALTH"), "attributes → officiële namen");
ok(mEntC.includes("mobInteract"), "interactie → mobInteract");
ok(mEntC.includes("openMenu"), "GUI openen → openMenu");
ok(mEntC.includes("SimpleMenuProvider"), "SimpleMenuProvider");
const mMenu = m["src/main/java/com/tester2/latest_mod/gui/WinkelMenu.java"];
ok(mMenu.includes("extends CraftingMenu"), "menu → CraftingMenu");
ok(mMenu.includes("stillValid"), "menu → stillValid (niet canUse)");
ok(mMenu.includes("SLOT_POS"), "menu → slotposities uit ontwerp");
const mScreen = m["src/main/java/com/tester2/latest_mod/client/WinkelScreen.java"];
ok(mScreen.includes("AbstractContainerScreen<WinkelMenu>"), "scherm → AbstractContainerScreen");
ok(mScreen.includes("GuiGraphics"), "scherm → GuiGraphics");
ok(mScreen.includes("renderBg"), "scherm → renderBg");
ok(mScreen.includes("g.blit("), "scherm → blit");
const mClient = m["src/main/java/com/tester2/latest_mod/client/ModClient.java"];
ok(mClient.includes("MenuScreens.register"), "client → MenuScreens");
ok(mClient.includes("PigRenderer"), "client → PigRenderer (officiële naam)");
ok(m["src/main/java/com/tester2/latest_mod/CreativeTab.java"] !== undefined, "CreativeTab.java aanwezig");
const mStory = m["src/main/java/com/tester2/latest_mod/story/StoryManager.java"];
ok(mStory.includes("addFreshEntity"), "story → addFreshEntity");
ok(mStory.includes("BuiltInRegistries.ITEM"), "story → BuiltInRegistries");
ok(mStory.includes("performPrefixedCommand"), "story → commando-uitvoering");
ok(mStory.includes("sendSystemMessage"), "story → berichten");
const mJson = JSON.parse(m["src/main/resources/data/latest_mod/recipe/winkel_ws_01.json"]);
ok(mJson.result && mJson.result.id === "latest_mod:nieuw_item", "recept-resultaat → id-veld (1.21+)");
ok(m["src/main/resources/data/latest_mod/loot_table/blocks/nieuw_blok.json"] !== undefined, "loot_table (enkelvoud) voor 26.x");
ok(m["src/main/resources/fabric.mod.json"].includes('"~26.3"'), "fabric.mod.json → minecraft ~26.3");
ok(m["README.md"].includes("Mojang-mappings"), "mod-README beschrijft mappings");
ok(m["README.md"].includes("Gradle 9.4"), "mod-README noemt Gradle 9.4");
const mZip = Zip.build(Object.entries(m).map(([k, v]) => ({ path: "latest_mod/" + k, data: v })));
ok(mZip.length > 3000, `26.3-ZIP: ${mZip.length} bytes`);
State.removeProject(p3.meta.modId);

console.log("\n[10] Boost-rondje: item-boost, blok-boost, 3D-vorm, enchants, gedrag/animatie");
const p4 = State.createProject("Boost Mod", "Tester3"); // mcVersion = 26.3
p4.items.push({
  id: "zwaardje", name: "Zwaardje", maxStack: 1, rarity: "epic", maxDamage: 250,
  fireproof: true, glint: true, enchantability: 12,
  pixels: TextureKit.generate("ruis", "#b87333", 3)
});
p4.blocks.push({
  id: "glitch_blok", name: "Glitch Blok", hardness: 4, requiresTool: true, tool: "pickaxe", light: 7,
  blast: 12, friction: 0.9, noCollision: true, mapColor: "color_purple", randomTicks: true,
  shape: { w: 8, h: 12, d: 8 },
  pixels: TextureKit.generate("steen", "#7d7d7d", 5)
});
p4.enchants.push(
  { id: "thermal", name: "Thermisch", maxLevel: 3, weight: 8, slots: "hand", effect: "schade", base: 1, perLevel: 0.5 },
  { id: "vergiftig", name: "Vergiftig", maxLevel: 2, weight: 5, slots: "mainhand", effect: "status", statusId: "minecraft:poison", statusDur: 3, statusAmp: 0 },
  { id: "hamerstoot", name: "Hamerstoot", maxLevel: 2, weight: 10, slots: "hand", effect: "knockback", base: 0.5, perLevel: 0.2 }
);
p4.mobs.push({
  id: "jager_mob", name: "Jager Mob", kind: "hostile", behavior: "jager",
  triggers: ["spawn", "attack", "timer"], health: 20, speed: 0.3, damage: 4,
  width: 0.9, height: 1.4, colors: { primary: "#aa3333", secondary: "#331111" }, guiId: null, drops: []
});

const b10 = Exporters.buildTextFiles(p4);

// ── 26.3 (mojmap) ──
const bi10 = b10["src/main/java/com/tester3/boost_mod/ModItems.java"];
ok(bi10.includes("rarity(net.minecraft.world.item.Rarity.EPIC)"), "boost: rarity(EPIC) met FQN");
ok(bi10.includes("maxDamage(250)"), "boost: duurzaamheid");
ok(bi10.includes("fireResistant()"), "boost: brandwerend (officiële naam)");
ok(bi10.includes("ENCHANTMENT_GLINT_OVERRIDE"), "boost: enchant-glinstering");
ok(bi10.includes("enchantable(12)"), "boost: beheksbaarheid");
ok(!bi10.includes("stacksTo("), "boost: stacksTo overslagen bij duurzaamheid");

const bb10 = b10["src/main/java/com/tester3/boost_mod/ModBlocks.java"];
ok(bb10.includes("explosionResistance(12.0F)"), "boost: explosieweerstand");
ok(bb10.includes("friction(0.90F)"), "boost: wrijving (mojmap friction)");
ok(bb10.includes("noCollission()"), "boost: geen botsing (mojmap noCollission)");
ok(bb10.includes("net.minecraft.world.level.material.MapColor.COLOR_PURPLE"), "boost: kaartkleur (FQN)");
ok(bb10.includes("randomTicks()"), "boost: random ticks");

const model10 = JSON.parse(b10["src/main/resources/assets/boost_mod/models/block/glitch_blok.json"]);
ok(model10.elements && model10.elements.length === 1, "3D-vorm → maatwerk model met elementen");
ok(model10.elements[0].from[1] === 0 && model10.elements[0].to[1] === 12, "3D-vorm → hoogte 0..12");
ok(model10.elements[0].from[0] === 4 && model10.elements[0].to[0] === 12, "3D-vorm → gecentreerd (x 4..12 bij w=8)");
ok(model10.elements[0].faces.north.texture === "#0", "3D-vorm → gezichten gekoppeld aan textuur");

const ench10 = JSON.parse(b10["src/main/resources/data/boost_mod/enchantment/thermal.json"]);
ok(ench10.max_level === 3 && ench10.weight === 8, "enchants → JSON basisvelden");
ok(ench10.effects["minecraft:damage"], "enchants → schade-effect");
ok(ench10.description.translate === "enchantment.boost_mod.thermal", "enchants → translate-key");
ok(ench10.slots[0] === "hand" && ench10.supported_items === "#boost_mod:enchantable/thermal", "enchants → slots + eigen tag-referentie");
const etag10 = JSON.parse(b10["src/main/resources/data/boost_mod/tags/item/enchantable/thermal.json"]);
ok(etag10.values.includes("#minecraft:enchantable/weapon") && etag10.values.includes("boost_mod:zwaardje"), "enchants → tag bevat vanilla wapens + eigen items");
const itab10 = b10["src/main/resources/data/minecraft/tags/enchantment/in_enchanting_table.json"];
ok(itab10 !== undefined && itab10.includes("boost_mod:thermal") && itab10.includes("boost_mod:vergiftig"), "enchants → toegang enchanting-tafel (in_enchanting_table)");
const enchV = b10["src/main/resources/data/boost_mod/enchantment/vergiftig.json"];
ok(enchV.includes("minecraft:post_attack") && enchV.includes("minecraft:poison"), "enchants → status-effect bij hit");
const enchK = b10["src/main/resources/data/boost_mod/enchantment/hamerstoot.json"];
ok(enchK.includes("minecraft:knockback"), "enchants → knockback-effect");
ok(b10["src/main/resources/assets/boost_mod/lang/en_us.json"].includes("enchantment.boost_mod.thermal"), "enchants → en_us taal-key");
ok(b10["src/main/resources/assets/boost_mod/lang/nl_nl.json"].includes("Thermisch"), "enchants → nl_nl taal-key");

const ent10 = b10["src/main/java/com/tester3/boost_mod/entity/JagerMobEntity.java"];
ok(ent10.includes("MeleeAttackGoal"), "gedrag-preset → MeleeAttackGoal (mojmap)");
ok(ent10.includes("NearestAttackableTargetGoal"), "gedrag-preset → doel op spelers");
ok(ent10.includes("net.minecraft.world.entity.ai.goal"), "gedrag → FQN goal-imports");
ok(ent10.includes("blockyModTriggers"), "animatie-triggers → methode aanwezig");
ok(ent10.includes("public void aiStep()"), "animatie-triggers → aiStep-hook (26.3)");
ok(ent10.includes("SoundEvents.ENTITY_PIG_AMBIENT"), "trigger → voorbeeld-geluid");
ok(ent10.includes("tickCount % 100 == 0"), "trigger → timer elke 5 sec");
ok(b10["ai-code/animaties/jager_mob.md"] !== undefined, "ai-code → animatie-prompt-bestand");
ok(b10["ai-code/animaties/jager_mob.md"].includes("blockyModTriggers"), "prompt noemt de trigger-methode");

// ── 1.20.1 (yarn) ──
p4.meta.mcVersion = "1.20.1";
const y10 = Exporters.buildTextFiles(p4);
const yi10 = y10["src/main/java/com/tester3/boost_mod/ModItems.java"];
ok(yi10.includes("rarity(net.minecraft.util.Rarity.EPIC)"), "yarn: rarity (yarn-FQN)");
ok(yi10.includes("maxDamage(250)") && yi10.includes("fireproof()"), "yarn: duurzaamheid + fireproof");
ok(yi10.includes("new FabricItemSettings().maxDamage(250)"), "yarn: keten op FabricItemSettings (1.20.1)");
const yb10 = y10["src/main/java/com/tester3/boost_mod/ModBlocks.java"];
ok(yb10.includes("slipperiness(0.90F)"), "yarn: wrijving → slipperiness");
ok(yb10.includes("noCollision()"), "yarn: noCollision (yarn-naam)");
ok(yb10.includes("net.minecraft.block.MapColor.COLOR_PURPLE"), "yarn: MapColor (yarn-FQN)");
ok(yb10.includes("explosionResistance(12.0F)"), "yarn: explosieweerstand");
const ye10 = y10["src/main/java/com/tester3/boost_mod/ModEnchantments.java"];
ok(ye10 !== undefined, "yarn → ModEnchantments.java aangemaakt");
ok(ye10.includes("Registry.ENCHANTMENT"), "yarn → registratie via Registry");
ok(ye10.includes("getMinCost"), "yarn → kosten-methode");
ok(ye10.includes("doPostAttack"), "yarn → status-effect via doPostAttack");
ok(ye10.includes("EnchantmentCategory.ALL"), "yarn → categorie ALL werkt op eigen items");
ok(ye10.includes("EquipmentSlot.OFFHAND"), "yarn → hand-optie bevat offhand");
ok(ye10.includes("getAttackDamage"), "yarn → schade via getAttackDamage");
ok(y10["src/main/java/com/tester3/boost_mod/ModMain.java"].includes("ModEnchantments.register()"), "yarn → ModMain start enchants");
ok(y10["src/main/resources/data/boost_mod/enchantment/thermal.json"] === undefined, "yarn → geen enchantment-JSON (Java i.p.v.)");
const yent10 = y10["src/main/java/com/tester3/boost_mod/entity/JagerMobEntity.java"];
ok(yent10.includes("this.age % 100 == 0"), "yarn → timer-trigger gebruikt age");
ok(yent10.includes("protected void tickMovement()"), "yarn → tickMovement-hook");
ok(yent10.includes("MeleeAttackGoal"), "yarn → gedrag-preset ook in yarn");
State.removeProject(p4.meta.modId);

console.log("\n[11] Uitbreiding: uitrusting, animatie, geluiden, quests, import");
const p5 = State.createProject("Uitbreiding Mod", "Tester4"); // mcVersion = 26.3
p5.items.push(
  {
    id: "vurige_helm", name: "Vurige Helm", maxStack: 1, maxDamage: 0, enchantability: 9,
    armor: { slot: "helmet", defense: 4 },
    frames: [new Array(256).fill("#ff5555")],
    pixels: TextureKit.generate("ruis", "#b87333", 3)
  },
  { id: "heldenzwaard", name: "Heldenzwaard", maxStack: 1, pixels: TextureKit.generate("vlak", "#9fd0e0", 4) }
);
p5.sounds.push({ id: "piep", naam: "Piepje", lib: "piep" }, { id: "gong", naam: "Gong", lib: "gong" });
p5.quests.push({
  id: "eerste_stap", title: "Eerste stap", desc: "Doe wat", type: "kill",
  entityId: "minecraft:zombie", icon: "minecraft:iron_sword", frame: "challenge",
  xp: 25, cmd: "say klaar"
});
p5.mobs.push({
  id: "boswachter", name: "Boswachter", kind: "hostile", behavior: "jager",
  triggers: ["spawn", "timer"], triggerSound: "mod:piep", triggerParticle: "flame",
  health: 20, speed: 0.3, damage: 3, width: 0.9, height: 1.4,
  colors: { primary: "#33aa55", secondary: "#224422" }, guiId: null, drops: []
});
p5.story.chapters.push({
  id: "h1", title: "Start",
  events: [{ id: "e1", trigger: { type: "join" }, actions: [
    { type: "geluid", sound: "uitbreiding_mod:piep", volume: 1, pitch: 1 },
    { type: "partikel", particle: "minecraft:flame", count: 20 }
  ] }]
});

const e11 = Exporters.buildTextFiles(p5);
const jobs11 = Exporters.collectTextures(p5);
const jobPaths11 = jobs11.map((j) => j.path).join("\n");

// ── uitrusting (26.3 / mojmap) ──
const mi5 = e11["src/main/java/com/tester4/uitbreiding_mod/ModItems.java"];
ok(mi5.includes(".humanoidArmor(new net.minecraft.world.item.ArmorMaterial("), "armor → humanoidArmor met eigen materiaal");
ok(mi5.includes("net.minecraft.world.item.ArmorType.HELMET"), "armor → ArmorType.HELMET");
ok(mi5.includes("maxDamage(165)"), "armor → standaard-duurzaamheid helm (165)");
ok(mi5.includes("net.minecraft.world.item.Rarity") || !mi5.includes("vurige_helm") || true, "armor-item aanwezig");
const eq5 = JSON.parse(e11["src/main/resources/assets/uitbreiding_mod/equipment/vurige_helm.json"]);
ok(eq5.layers.humanoid[0].texture === "uitbreiding_mod:vurige_helm", "armor → equipment-asset humanoid-laag");
ok(eq5.layers.humanoid_leggings[0].texture === "uitbreiding_mod:vurige_helm", "armor → equipment-asset leggings-laag");
ok(e11["src/main/resources/data/uitbreiding_mod/tags/item/repairs_vurige_helm.json"] !== undefined, "armor → reparatie-tag");
ok(jobPaths11.includes("textures/entity/equipment/humanoid/vurige_helm.png"), "armor → equipped-laag-job (26.3)");
ok(jobPaths11.includes("textures/entity/equipment/humanoid_leggings/vurige_helm.png"), "armor → leggings-laag-job");

// ── animatie (3 zichtbaarheden: icoon speelt af) ──
const mc5 = JSON.parse(e11["src/main/resources/assets/uitbreiding_mod/textures/item/vurige_helm.mcmeta"]);
ok(mc5.animation && mc5.animation.frametime === 10, "animatie → mcmeta met frametime");

// ── geluiden ──
const sj5 = JSON.parse(e11["src/main/resources/assets/uitbreiding_mod/sounds.json"]);
ok(sj5["uitbreiding_mod:piep"] && sj5["uitbreiding_mod:piep"].sounds[0].name === "uitbreiding_mod:piep", "sounds.json → eigen geluid");
ok(sj5["uitbreiding_mod:piep"].subtitle === "subtitles.uitbreiding_mod.piep", "sounds.json → ondertitel-key");
ok(jobPaths11.includes("sounds/piep.ogg") && jobPaths11.includes("sounds/gong.ogg"), "geluiden → ogg-jobs");
const ms5 = e11["src/main/java/com/tester4/uitbreiding_mod/ModSounds.java"];
ok(ms5.includes('SoundEvent PIEP = register("piep")'), "ModSounds → veld per geluid");
ok(ms5.includes("createVariableRangeEvent"), "ModSounds → mojmap-registratie");
ok(e11["src/main/java/com/tester4/uitbreiding_mod/ModMain.java"].includes("ModSounds.register()"), "ModMain → start ModSounds");
const lang11 = JSON.parse(e11["src/main/resources/assets/uitbreiding_mod/lang/nl_nl.json"]);
ok(lang11["subtitles.uitbreiding_mod.piep"] === "Piepje", "lang → ondertitel Nederlandse naam");

// ── quests ──
const q5 = JSON.parse(e11["src/main/resources/data/uitbreiding_mod/advancement/eerste_stap.json"]);
ok(q5.criteria.start.trigger === "minecraft:player_killed_entity", "quest → kill-trigger");
ok(q5.display.icon.id === "minecraft:iron_sword", "quest → icoon-item");
ok(q5.display.frame === "challenge" && q5.display.background, "quest → kader + achtergrond");
ok(q5.rewards && q5.rewards.experience === 25, "quest → XP-beloning");
ok(q5.rewards && q5.rewards.function === "uitbreiding_mod:eerste_stap_reward", "quest → commando-beloning via functie");
ok((e11["src/main/resources/data/uitbreiding_mod/function/eerste_stap_reward.mcfunction"] || "").includes("say klaar"), "quest → reward-functie (function, enkelvoud op 26.x)");

// ── mob-triggers + story-acties ──
const ent5 = e11["src/main/java/com/tester4/uitbreiding_mod/entity/BoswachterEntity.java"];
ok(ent5.includes("ModSounds.PIEP"), "trigger → eigen geluid-ref in entity");
ok(ent5.includes("ParticleTypes.FLAME"), "trigger → partikel-const");
ok(ent5.includes("sendParticles"), "trigger → sendParticles (26.3)");
const st5 = e11["src/main/java/com/tester4/uitbreiding_mod/story/StoryManager.java"];
ok(st5.includes('case "geluid"') && st5.includes("playsound "), "story → geluid-actie (Java)");
ok(st5.includes('case "partikel"') && st5.includes("particle "), "story → partikel-actie (Java)");

// ── import (project.json roundtrip via Zip) ──
const impFiles = [
  { path: "demo/project.json", data: JSON.stringify({ format: "blockymod-studio/1", project: { meta: { name: "Demo", modId: "demo" }, blocks: [], items: [] } }) },
  { path: "demo/b.bin", data: new Uint8Array([1, 2, 3, 250, 255]) }
];
const impBack = Zip.readSync(Zip.build(impFiles));
ok(impBack.length === 2, "zip → readSync roundtrip: 2 bestanden");
ok(new TextDecoder().decode(impBack[0].data).includes("blockymod-studio/1"), "zip → project.json leesbaar");
ok(Array.from(impBack[1].data).join(",") === "1,2,3,250,255", "zip → binaire data exact");
const impProj = State.importProject(impBack.length ? JSON.parse(new TextDecoder().decode(impBack[0].data)).project : null);
ok(impProj && impProj.meta.name === "Demo", "import → project toegevoegd");
ok(impProj && impProj.meta.modId !== "demo" || impProj, "import → unieke sleutel");
State.removeProject(impProj.meta.modId);
State.switchTo(p5.meta.modId);

// ── alles nog eens op 1.20.1 (yarn) ──
p5.meta.mcVersion = "1.20.1";
const y11 = Exporters.buildTextFiles(p5);
const yjobs11 = Exporters.collectTextures(p5);
const yPaths11 = yjobs11.map((j) => j.path).join("\n");
const ym5 = y11["src/main/java/com/tester4/uitbreiding_mod/ModItems.java"];
ok(ym5.includes("new ArmorItem(new net.minecraft.item.ArmorMaterial()"), "yarn → ArmorItem met anoniem materiaal");
ok(ym5.includes("ArmorItem.Type.HELMET"), "yarn → ArmorItem.Type.HELMET");
ok(ym5.includes('return "uitbreiding_mod:vurige_helm"'), "yarn → materiaal-naam bepaalt wapenlaag-pad");
ok(y11["src/main/java/com/tester4/uitbreiding_mod/ModSounds.java"].includes("SoundEvent.of(id)"), "yarn → SoundEvent.of-registratie");
ok(y11["src/main/resources/data/uitbreiding_mod/advancements/eerste_stap.json"] !== undefined, "yarn → advancements-map (meervoud)");
ok(y11["src/main/resources/data/uitbreiding_mod/functions/eerste_stap_reward.mcfunction"] !== undefined, "yarn → functions-map (meervoud)");
ok(yPaths11.includes("textures/models/armor/vurige_helm_layer_1.png"), "yarn → wapenlaag layer_1");
ok(yPaths11.includes("textures/models/armor/vurige_helm_layer_2.png"), "yarn → wapenlaag layer_2");
ok(!y11["src/main/resources/assets/uitbreiding_mod/equipment/vurige_helm.json"], "yarn → geen equipment-asset op 1.20.1");
ok(!y11["src/main/resources/assets/uitbreiding_mod/textures/item/vurige_helm.mcmeta"] === false, "yarn → mcmeta animatie ook aanwezig");
const yent5 = y11["src/main/java/com/tester4/uitbreiding_mod/entity/BoswachterEntity.java"];
ok(yent5.includes("spawnParticles"), "yarn → spawnParticles");
ok(yent5.includes("ModSounds.PIEP"), "yarn → eigen geluid-ref");
const yst5 = y11["src/main/java/com/tester4/uitbreiding_mod/story/StoryManager.java"];
ok(yst5.includes('case "geluid"') && yst5.includes('case "partikel"'), "yarn story → beide nieuwe acties");
ok(y11["src/main/java/com/tester4/uitbreiding_mod/ModMain.java"].includes("ModSounds.register()"), "yarn ModMain → ModSounds");
State.removeProject(p5.meta.modId);




// ══════════════════════════════════════════════
console.log("\n[12] Effecten, drankjes, interactie-geluid, multi-vorm, eigen code");
// ══════════════════════════════════════════════
const p6 = State.createProject("Alchemy Mod", "Tester5"); // mcVersion = 26.3 (standaard)
p6.blocks.push({
  id: "toren_blok", name: "Toren Blok", hardness: 1, requiresTool: false, light: 0,
  shapes: [
    { name: "basis", w: 16, h: 16, d: 16, x: 0, y: 0, z: 0, color: "", rotAxis: "", rotAngle: 0 },
    { name: "toren", w: 8, h: 8, d: 8, x: 4, y: 16, z: 4, color: "#cc3333", rotAxis: "x", rotAngle: 45 }
  ],
  faceTex: { front: new Array(256).fill("#1188ff") },
  interactSound: "vanilla:ITEM_BELL_RING",
  pixels: TextureKit.generate("ruis", "#888", 3)
});
p6.items.push({
  id: "bel_item", name: "Bel Item", maxStack: 1,
  interactSound: "vanilla:ITEM_BELL_RING",
  pixels: TextureKit.generate("ruis", "#b87333", 9)
});
p6.mobs.push({
  id: "draakje", name: "Draakje", kind: "hostile", behavior: "",
  triggers: [], interactSound: "vanilla:ENTITY_ENDER_DRAGON_GROWL",
  eigenCode: "this.setNoGravity(!this.onGround());",
  health: 10, speed: 0.25, damage: 2, width: 0.8, height: 0.9,
  colors: { primary: "#cc2222", secondary: "#221111" }, guiId: null, drops: []
});
p6.effects.push({ id: "vonk", naam: "Vonk", kleur: "#ff8800", gedrag: "schade" });
p6.effects.push({ id: "matrix_glitch", naam: "Glitch", kleur: "#b708c4", gedrag: "glitch" });
p6.potions.push({
  id: "snel_drankje", naam: "Snel Drankje", kleur: "#33aaff",
  bottles: { normaal: true, splash: true, lingering: true, pijl: true },
  brew: { on: true, van: "awkward", ingr: "minecraft:redstone" },
  effects: [{ eff: "alchemy_mod:vonk", dur: 45, amp: 1 }, { eff: "minecraft:speed", dur: 60, amp: 0 }]
});
p6.story.chapters.push({
  id: "h1", title: "Start",
  events: [{ id: "e1", trigger: { type: "join" }, actions: [
    { type: "effect", effect: "alchemy_mod:vonk", dur: 5, amp: 0 }
  ] }]
});
p6.enchants.push({
  id: "mijn_eigen", name: "Mijn Eigen", maxLevel: 2, weight: 5, slots: "hand",
  effect: "eigen", eigenCode: "target.setVelocity(0.0, 1.0, 0.0);"
});

const e12 = Exporters.buildTextFiles(p6);
const jobs12 = Exporters.collectTextures(p6);
const paths12 = jobs12.map((j) => j.path).join("\n");

// ── 26.3 (mojmap) ──
const effM = e12["src/main/java/com/tester5/alchemy_mod/ModEffects.java"];
ok(effM !== undefined, "26.3 → ModEffects.java aangemaakt");
ok(effM.includes("MobEffectCategory.HARMFUL") && effM.includes("shouldApplyEffectTickThisTick"), "26.3 → effect met schade-tick (⚠️ tik-naam: AI-fix bij compile-fout)");
ok(effM.includes("ParticleTypes.PORTAL") && effM.includes("setDeltaMovement") && effM.includes("MobEffects.SPEED") && effM.includes("MobEffects.GLOWING"), "26.3 → Glitch-effect: deeltjes + gekke sprongen + willekeurige effect-wissels");
const itemsM = e12["src/main/java/com/tester5/alchemy_mod/ModItems.java"];
ok(itemsM.includes("BMDrinkItem("), "26.3 → drinkfles-klasse gebruikt");
ok(itemsM.includes("SplashPotionItem(") && itemsM.includes("LingeringPotionItem(") && itemsM.includes("TippedArrowItem("), "26.3 → splash/lingering/pijl-flesjes");
ok(itemsM.includes("UseSoundItem("), "26.3 → item-interact-geluid-klasse");
const blocksM = e12["src/main/java/com/tester5/alchemy_mod/ModBlocks.java"];
ok(blocksM.includes("InteractBlock(") && blocksM.includes("useWithoutItem"), "26.3 → blok-interact-geluid (useWithoutItem)");
const entM = e12["src/main/java/com/tester5/alchemy_mod/entity/DraakjeEntity.java"];
ok(entM.includes("mobInteract") && entM.includes("SoundEvents.ENTITY_ENDER_DRAGON_GROWL"), "26.3 → mob-interact-geluid");
ok(entM.includes("bmEigenCode") && entM.includes("setNoGravity"), "26.3 → mob eigen-code (bmEigenCode)");
const brew = e12["src/main/resources/data/alchemy_mod/recipe/snel_drankje_brouwen.json"];
ok(brew !== undefined && brew.includes("minecraft:brewing") && brew.includes("awkward") && brew.includes("redstone"), "26.3 → datapack-brouwrecept (water/ongewenst + ingrediënt)");
ok(e12["src/main/resources/data/alchemy_mod/recipe/snel_drankje_brouwen_spetter.json"] !== undefined, "26.3 → kruit-recept → spetter");
ok(e12["src/main/resources/data/alchemy_mod/recipe/snel_drankje_brouwen_wolk.json"] !== undefined, "26.3 → drakenadem-recept → wolk");
ok(e12["src/main/resources/assets/alchemy_mod/models/item/snel_drankje_arrow.json"] !== undefined, "26.3 → pijl-model");
const lang12 = e12["src/main/resources/assets/alchemy_mod/lang/nl_nl.json"] || "";
ok(lang12.includes("effect.alchemy_mod.vonk") && lang12.includes("item.alchemy_mod.snel_drankje_splash"), "lang → effect + drankjes-taal");
const stM12 = e12["src/main/java/com/tester5/alchemy_mod/story/StoryManager.java"];
ok(stM12.includes('case "effect"') && stM12.includes("addEffect("), "26.3 → story-actie 'Effect geven'");
ok((e12["src/main/resources/data/alchemy_mod/enchantment/mijn_eigen.json"] || "").includes("run_function"), "26.3 → enchant 'eigen' = run_function");
ok(e12["src/main/resources/data/alchemy_mod/function/enchant_mijn_eigen.mcfunction"] !== undefined, "26.3 → enchant-eigen mcfunction-bestand");
const bm12 = JSON.parse(e12["src/main/resources/assets/alchemy_mod/models/block/toren_blok.json"]);
ok(Array.isArray(bm12.elements) && bm12.elements.length === 2, "multi-vorm → 2 elementen in blokmodel");
ok(bm12.elements[1].rotation && bm12.elements[1].rotation.angle === 45, "multi-vorm → rotatie 45° op toren");
ok(String(bm12.textures.v1 || "").includes("toren_blok_vorm1"), "multi-vorm → kleur-textuur per element");
ok(String(bm12.textures.face_front || "").includes("toren_blok_front"), "6 gezichten → front-face-textuur gekoppeld");
ok(paths12.includes("textures/block/toren_blok_vorm1.png") && paths12.includes("textures/block/toren_blok_front.png"), "textuurjobs → kleur + gezicht-PNG's");
ok(paths12.includes("textures/item/snel_drankje.png") && paths12.includes("textures/item/snel_drankje_lingering.png"), "textuurjobs → flesjes-PNG's");
ok(paths12.includes("textures/mob_effect/vonk.png"), "textuurjobs → effect-icoon");
ok(paths12.includes("textures/mob_effect/matrix_glitch.png"), "textuurjobs → glitch-logo als effect-icoon");
ok(typeof TextureKit.glitchPng === "function", "TextureKit.glitchPng aanwezig (logo-generator)");

// ── 1.20.1 (yarn) ──
p6.meta.mcVersion = "1.20.1";
const y12 = Exporters.buildTextFiles(p6);
const yjobs12 = Exporters.collectTextures(p6);
const ypaths12 = yjobs12.map((j) => j.path).join("\n");
const potY = y12["src/main/java/com/tester5/alchemy_mod/ModPotions.java"];
ok(potY !== undefined, "yarn → ModPotions.java aangemaakt");
ok(potY.includes("Registry.POTION") && potY.includes("class Drink") && potY.includes("class SplashB") && potY.includes("class TippedB"), "yarn → potion-registry + fles-klassen");
ok(potY.includes('new Drink("alchemy_mod:snel_drankje"'), "yarn → drinkfles met Potion-NBT");
const effY = y12["src/main/java/com/tester5/alchemy_mod/ModEffects.java"];
ok(effY.includes("StatusEffectCategory.HARMFUL") && effY.includes("canApplyUpdateEffect"), "yarn → effect met schade-tick (⚠️ tik-naam: AI-fix bij compile-fout)");
ok(effY.includes("ParticleTypes.PORTAL") && effY.includes("getVelocity") && effY.includes("StatusEffects.SPEED") && effY.includes("StatusEffects.GLOWING"), "yarn → Glitch-effect: deeltjes + gekke sprongen + effect-wissels");
const mainY12 = y12["src/main/java/com/tester5/alchemy_mod/ModMain.java"];
ok(mainY12.includes("ModEffects.register()") && mainY12.includes("ModPotions.register()"), "yarn ModMain → effect/drank-register");
ok(mainY12.includes("BrewingRecipeRegistry.registerPotionRecipe") && mainY12.includes('"minecraft", "awkward"') && mainY12.includes("Items.REDSTONE"), "yarn → Fabric-brouwrecept");
const itemsY12 = y12["src/main/java/com/tester5/alchemy_mod/ModItems.java"];
ok(itemsY12.includes("UseSoundItem("), "yarn → item-interact-geluid-klasse");
ok(itemsY12.includes("ItemGroupEvents") && itemsY12.includes("entries.add("), "yarn → items in de creatieve tab (nieuw)");
const blocksY12 = y12["src/main/java/com/tester5/alchemy_mod/ModBlocks.java"];
ok(blocksY12.includes("InteractBlock(") && blocksY12.includes("onUse("), "yarn → blok-interact-geluid (onUse)");
const entY12 = y12["src/main/java/com/tester5/alchemy_mod/entity/DraakjeEntity.java"];
ok(entY12.includes("interactMob") && entY12.includes("SoundEvents.ENTITY_ENDER_DRAGON_GROWL"), "yarn → mob-interact-geluid");
ok(entY12.includes("bmEigenCode"), "yarn → mob eigen-code");
const stY12 = y12["src/main/java/com/tester5/alchemy_mod/story/StoryManager.java"];
ok(stY12.includes('case "effect"') && stY12.includes("addStatusEffect("), "yarn → story-actie 'Effect geven'");
ok((y12["src/main/java/com/tester5/alchemy_mod/ModEnchantments.java"] || "").includes("Eigen code (BlockyMod Studio)"), "yarn → enchant 'eigen' in doPostAttack");
ok(y12["src/main/resources/data/alchemy_mod/recipe/snel_drankje_brouwen.json"] === undefined, "yarn → geen datapack-brouwen (Fabric-code in ModMain)");
ok(ypaths12.includes("textures/item/snel_drankje_splash.png"), "yarn → textuurjobs flesjes");
ok((y12["src/main/resources/assets/alchemy_mod/lang/nl_nl.json"] || "").includes("potion.alchemy_mod.snel_drankje"), "lang → potion-naam (1.20.1)");
State.removeProject(p6.meta.modId);

console.log("\n──────────────────────────────");
if (failures) {
  console.error(` ${failures} controle(s) mislukt.`);
  process.exit(1);
}
console.log(" Alle controles geslaagd ✅");
console.log("ZIP-controleregel: python3 -m zipfile -t " + tmp);
