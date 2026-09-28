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
const ORDER = ["util.js", "zip.js", "state.js", "texture.js", "guidesign.js", "recipes.js", "exporters.js"];

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

console.log("\n──────────────────────────────");
if (failures) {
  console.error(` ${failures} controle(s) mislukt.`);
  process.exit(1);
}
console.log(" Alle controles geslaagd ✅");
console.log("ZIP-controleregel: python3 -m zipfile -t " + tmp);
