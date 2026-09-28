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

console.log("\n[8] Lege project-export (geen crash)");
State.removeProject(p.meta.modId);
const p2 = State.createProject("Leeg", "Iemand");
const emptyFiles = Exporters.buildTextFiles(p2);
ok(Object.keys(emptyFiles).length > 8, `leeg project → ${Object.keys(emptyFiles).length} bestanden (structuur klopt)`);
ok(emptyFiles["src/main/java/com/iemand/leeg/ModBlocks.java"].includes("(nog geen blokken"), "lege-blokken-placeholder");

console.log("\n──────────────────────────────");
if (failures) {
  console.error(` ${failures} controle(s) mislukt.`);
  process.exit(1);
}
console.log(" Alle controles geslaagd ✅");
console.log("ZIP-controleregel: python3 -m zipfile -t " + tmp);
