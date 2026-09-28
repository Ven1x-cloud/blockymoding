// DOM-smoketest: opent de app in jsdom, klikt door alle schermen en vangt fouten.
// Gebruik:  node tools/dom-check.js   (vanuit app/)
"use strict";

const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const APP = path.join(__dirname, "..", "renderer");
let html = fs.readFileSync(path.join(APP, "index.html"), "utf8");
// scripts handmatig laden (volgorde bewaken), dus uit de HTML halen
html = html.replace(/<script src="[^"]+"><\/script>/g, "");

const errors = [];
const vc = new (require("jsdom").VirtualConsole)();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.stack || e.message)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

const dom = new JSDOM(html, {
  url: "http://localhost/",
  pretendToBeVisual: true,
  runScripts: "dangerously",
  virtualConsole: vc
});
const win = dom.window;

// ── Canvas-stub (jsdom zonder node-canvas) ──
const ctxStub = new Proxy({}, {
  get(t, prop) {
    if (prop === "canvas") return { width: 16, height: 16 };
    if (prop === "measureText") return () => ({ width: 10 });
    if (prop === "getImageData") return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
    if (prop === "createImageData") return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
    if (typeof prop === "string") return (...args) => undefined;
    return undefined;
  },
  set() { return true; }
});
win.HTMLCanvasElement.prototype.getContext = function () { return ctxStub; };
win.HTMLCanvasElement.prototype.toBlob = function (cb) {
  try { cb(new win.Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })); }
  catch (e) { cb(null); }
};
win.HTMLCanvasElement.prototype.toDataURL = function () { return "data:image/png;base64,iVBORw0KGgo="; };

// ── fetch-stub (GitHub) ──
const ghListing = [
  { name: "README.md", path: "ai-code/README.md", type: "file", size: 100, download_url: "https://raw.example/README.md" },
  { name: "extra", path: "ai-code/extra", type: "dir", size: 0 },
  { name: "Voorbeeld.java", path: "ai-code/extra/Voorbeeld.java", type: "file", size: 250, download_url: "https://raw.example/Voorbeeld.java" }
];
win.fetch = async (url) => {
  const u = String(url);
  if (u.includes("/contents/")) {
    let entries = ghListing;
    if (u.includes("extra")) {
      entries = [{ name: "Voorbeeld.java", path: "ai-code/extra/Voorbeeld.java", type: "file", size: 250, download_url: "https://raw.example/Voorbeeld.java" }];
    }
    return { ok: true, status: 200, json: async () => entries };
  }
  if (u.includes("raw.example")) {
    return { ok: true, status: 200, text: async () => "// code van GitHub\npublic class Voorbeeld {}\n" };
  }
  return { ok: false, status: 404, json: async () => ({}), text: async () => "not found" };
};
win.navigator.clipboard = { writeText: async () => {} };

// ── Scripts laden (als echte <script>-tags, zodat const-declaraties blijven hangen) ──
const scripts = ["util.js", "zip.js", "state.js", "texture.js", "guidesign.js", "recipes.js", "exporters.js", "github.js", "app.js"];
win.addEventListener("error", (e) => errors.push("window.error: " + (e.error && e.error.stack || e.message)));

for (const s of scripts) {
  const code = fs.readFileSync(path.join(APP, "js", s), "utf8");
  const tag = win.document.createElement("script");
  tag.textContent = `//# sourceURL=${s}\n` + code;
  win.document.body.appendChild(tag);
}

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log("  ✔ " + msg);
  else { failures++; console.error("  ✘ " + msg); }
}

(async () => {
  ok(errors.length === 0, "scripts laden zonder fouten" + (errors.length ? "\n" + errors.join("\n") : ""));
  if (errors.length) { finish(); return; }

  const BMS = win.BMS;
  ok(!!BMS && !!BMS.State, "app geïnitialiseerd (window.BMS)");

  // ── zonder project: dashboard ──
  ok(win.document.querySelector("#view").textContent.includes("Welkom"), "welkomstscherm zonder project");

  // ── project + inhoud ──
  const State = BMS.State;
  const p = State.createProject("DOM Test Mod", "Tester");
  p.blocks.push({ id: "blokje", name: "Blokje", hardness: 1, requiresTool: true, tool: "pickaxe", light: 3, pixels: BMS.TextureKit.generate("steen", "#888888", 3) });
  p.items.push({ id: "dingetje", name: "Dingetje", maxStack: 32, pixels: BMS.TextureKit.generate("ruis", "#b87333", 5) });
  const gui = { id: "kassa", name: "Kassa", width: 176, height: 166, mode: "crafting", bgColor: "#C6C6C6", elements: State.defaultCraftingElements("Kassa") };
  p.guis.push(gui);
  p.guis.push({ id: "los_gui", name: "Los GUI", width: 200, height: 150, mode: "free", bgColor: "#C6C6C6", elements: [{ type: "label", x: 10, y: 10, text: "Hoi", color: "#000", _id: "e1", order: 0 }, { type: "button", x: 30, y: 90, w: 100, h: 20, text: "Koop", _id: "e2", order: 1 }] });
  p.workstations.push({ id: "kassa_ws", name: "Kassa", blockId: "blokje", guiId: "kassa", recipes: [{ type: "shaped", cells: ["minecraft:stick", null, null, null, null, null, null, null, null], output: "dingetje", count: 1 }] });
  p.mobs.push({ id: "wachter", name: "Wachter", kind: "hostile", health: 40, speed: 0.3, damage: 6, width: 1, height: 2, colors: { primary: "#f00", secondary: "#0f0" }, guiId: "kassa", drops: [{ id: "dingetje", count: 1, chance: 1 }] });
  p.story.chapters.push({ id: "h1", title: "Intro", events: [{ id: "e1", trigger: { type: "join" }, actions: [{ type: "message", text: "Hoi!" }, { type: "gui", gui: "kassa" }] }] });
  p.aiFiles.push({ path: "x/Y.java", content: "// AI\n" });

  // ── alle schermen renderen ──
  const views = ["dashboard", "blocks", "items", "workstations", "guis", "mobs", "story", "github"];
  for (const v of views) {
    try {
      State.ui.view = v;
      BMS.render();
      const len = win.document.querySelector("#view").innerHTML.length;
      ok(len > 500, `scherm "${v}" rendert (${len} tekens)`);
    } catch (e) {
      failures++;
      console.error(`  ✘ scherm "${v}" CRASHT: ${e.stack}`);
    }
  }

  // ── selecties + tabs ──
  try {
    State.ui.view = "workstations";
    State.ui.sel.workstations = "kassa_ws";
    for (const tab of ["gui", "recipes", "block"]) {
      State.ui.wsTab = tab;
      BMS.render();
      ok(true, `werkbank-tab "${tab}" rendert`);
    }
  } catch (e) { failures++; console.error("  ✘ werkbank-tabs: " + e.stack); }

  try {
    State.ui.view = "blocks";
    State.ui.sel.blocks = "blokje";
    BMS.render();
    ok(true, "blok-editor met selectie rendert");
    State.ui.view = "mobs";
    State.ui.sel.mobs = "wachter";
    BMS.render();
    ok(true, "mob-editor met selectie rendert");
    State.ui.view = "guis";
    State.ui.sel.guis = "kassa";
    BMS.render();
    ok(true, "GUI-ontwerper rendert");
  } catch (e) { failures++; console.error("  ✘ editors: " + e.stack); }

  // ── GitHub-tab met fetch-stub ──
  try {
    State.ui.view = "github";
    BMS.render();
    await new Promise((r) => setTimeout(r, 150));
    const txt = win.document.querySelector("#view").textContent;
    ok(txt.includes("Koppel je GitHub-repo"), "GitHub-tab toont verbinding");
    const browseBtn = [...win.document.querySelectorAll("#view button")].find((b) => b.textContent.includes("Map tonen"));
    ok(!!browseBtn, "knop 'Map tonen' aanwezig");
    if (browseBtn) {
      browseBtn.click();
      await new Promise((r) => setTimeout(r, 150));
      const txt2 = win.document.querySelector("#view").textContent;
      ok(txt2.includes("README.md"), "GitHub-map geladen (README.md zichtbaar)");
      const pullBtn = [...win.document.querySelectorAll("#view button")].find((b) => b.textContent.includes("Codes ophalen"));
      ok(!!pullBtn, "knop 'Codes ophalen' aanwezig");
      if (pullBtn) {
        pullBtn.click();
        await new Promise((r) => setTimeout(r, 400));
        const txt3 = win.document.querySelector("#view").textContent;
        ok(txt3.includes("Voorbeeld.java") || txt3.includes("bestand"), "codes ingevoegd na ophalen");
        ok(p.aiFiles.length >= 2, `aiFiles bevat ${p.aiFiles.length} bestanden`);
      }
    }
  } catch (e) { failures++; console.error("  ✘ github-flow: " + e.stack); }

  // ── export-plan (zonder PNG-render in jsdom gaat alleen tekst) ──
  try {
    const files = BMS.Exporters.buildTextFiles(p);
    ok(Object.keys(files).length > 25, `volledige export: ${Object.keys(files).length} bestanden`);
    const zip = BMS.Zip.build(Object.entries(files).map(([k, v]) => ({ path: "dom/" + k, data: v })));
    ok(zip.length > 5000, `ZIP: ${zip.length} bytes`);
  } catch (e) { failures++; console.error("  ✘ export: " + e.stack); }

  // ── nav-klikken ──
  try {
    for (const item of win.document.querySelectorAll(".nav-item")) item.click();
    ok(true, "alle nav-knoppen klikbaar");
  } catch (e) { failures++; console.error("  ✘ nav: " + e.stack); }

  ok(errors.length === 0, "geen ongevange window-fouten" + (errors.length ? "\n" + errors.join("\n") : ""));
  finish();

  function finish() {
    console.log("\n──────────────────────────────");
    if (failures) {
      console.error(` ${failures} DOM-controle(s) mislukt.`);
      process.exit(1);
    }
    console.log(" Alle DOM-controles geslaagd ✅");
    process.exit(0);
  }
})();
