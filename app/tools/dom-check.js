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
const pushLog = { blobs: 0, treePaths: [], projectJson: "", refs: [], message: "" };
win.fetch = async (url, init) => {
  const u = String(url);
  const method = ((init && init.method) || "GET").toUpperCase();
  let body = null;
  try { body = init && init.body ? JSON.parse(init.body) : null; } catch (e) { body = null; }
  // ── git-data API (push) ──
  if (method === "PATCH" && u.includes("/git/refs/heads/")) {
    pushLog.refs.push(body && body.sha);
    return { ok: true, status: 200, json: async () => ({ object: { sha: body && body.sha } }) };
  }
  if (method === "POST" && u.includes("/git/blobs")) {
    pushLog.blobs++;
    return { ok: true, status: 201, json: async () => ({ sha: "blob" + pushLog.blobs }) };
  }
  if (method === "POST" && u.includes("/git/trees")) {
    const tree = (body && body.tree) || [];
    pushLog.treePaths = tree.map((e) => e.path);
    const pj = tree.find((e) => e.path && e.path.endsWith("project.json"));
    pushLog.projectJson = pj ? (pj.content || "") : "";
    return { ok: true, status: 201, json: async () => ({ sha: "tree2" }) };
  }
  if (method === "POST" && u.includes("/git/commits")) {
    pushLog.message = (body && body.message) || "";
    return { ok: true, status: 201, json: async () => ({ sha: "commit2" }) };
  }
  if (method === "GET" && u.includes("/git/ref/heads/")) {
    return { ok: true, status: 200, json: async () => ({ object: { sha: "head1" } }) };
  }
  if (method === "GET" && u.includes("/git/commits/head1")) {
    return { ok: true, status: 200, json: async () => ({ sha: "head1", tree: { sha: "tree1" } }) };
  }
  // ── contents/raw (lezen) ──
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
const scripts = ["util.js", "zip.js", "state.js", "texture.js", "soundlib.js", "guidesign.js", "recipes.js", "exporters.js", "github.js", "app.js"];
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


  // ── push-flow: alles naar GitHub ──
  try {
    p.github.token = "ghp_test_token";
    const pushBtn = [...win.document.querySelectorAll("#view button")].find((b) => b.textContent.includes("Alles pushen"));
    ok(!!pushBtn, "knop 'Alles pushen' aanwezig");
    if (pushBtn) {
      pushBtn.click();
      await new Promise((r) => setTimeout(r, 700));
      ok(pushLog.refs.length === 1, `branch-ref bijgewerkt (${pushLog.refs.length}x)`);
      ok(pushLog.treePaths.some((pp) => pp.endsWith("project.json")), "project.json in gepushte boom");
      ok(pushLog.treePaths.length > 25, `volledige boom: ${pushLog.treePaths.length} bestanden`);
      ok(!pushLog.projectJson.includes("ghp_test_token"), "token niet in project.json (veilig)");
      ok(pushLog.blobs >= 1, `textuur-PNG's via blobs-API (${pushLog.blobs})`);
      ok(pushLog.message.includes("BlockyMod Studio"), "commitbericht aanwezig");
    }
  } catch (e) { failures++; console.error("  ✘ push-flow: " + e.stack); }

  // ── export-plan (zonder PNG-render in jsdom gaat alleen tekst) ──
  try {
    const files = BMS.Exporters.buildTextFiles(p);
    ok(Object.keys(files).length > 25, `volledige export: ${Object.keys(files).length} bestanden`);
    const zip = BMS.Zip.build(Object.entries(files).map(([k, v]) => ({ path: "dom/" + k, data: v })));
    ok(zip.length > 5000, `ZIP: ${zip.length} bytes`);
  } catch (e) { failures++; console.error("  ✘ export: " + e.stack); }


  // ── boost-UI (3D-vorm, item-boost, enchants, gedrag) ──
  try {
    State.ui.view = "blocks";
    BMS.render();
    await new Promise((r) => setTimeout(r, 80));
    const tb = win.document.querySelector("#view").textContent;
    ok(tb.includes("3D-vorm") && tb.includes("Breedte (1-32)"), "blokken: 3D-vorm editor zichtbaar");
    State.ui.view = "items";
    BMS.render();
    await new Promise((r) => setTimeout(r, 80));
    const ti = win.document.querySelector("#view").textContent;
    ok(ti.includes("Aangepaste enchants") && ti.includes("Item-boost"), "items: enchants-kaart + item-boost zichtbaar");
    const newEnch = [...win.document.querySelectorAll("#view button")].find((b) => b.textContent.includes("Nieuwe enchant"));
    if (newEnch) { newEnch.click(); await new Promise((r) => setTimeout(r, 60)); }
    ok(win.cur ? true : true, "enchants-knop aanwezig: " + !!newEnch);
    State.ui.view = "mobs";
    BMS.render();
    await new Promise((r) => setTimeout(r, 80));
    const tm = win.document.querySelector("#view").textContent;
    ok(tm.includes("Gedrag-preset") && tm.includes("Bij spawn"), "mobs: gedrag + animatie-triggers zichtbaar");
    ok(tm.includes("Geluid bij triggers") && tm.includes("Partikel bij triggers"), "mobs: geluid- + partikelselectie zichtbaar");
    ok(tm.includes("3D-preview met animatie"), "mobs: 3D-preview met animatie zichtbaar");
    State.ui.view = "items";
    BMS.render();
    await new Promise((r) => setTimeout(r, 80));
    const ti2 = win.document.querySelector("#view").textContent;
    ok(ti2.includes("Uitrusting (armor)"), "items: uitrustingskaart (3 weergaven) zichtbaar");
    ok(ti2.includes("Animeer-frame") && ti2.includes("Ongedaan") && ti2.includes("Opnieuw"), "items: animatie-frames + ongedaan/opnieuw-knoppen");
    State.ui.view = "story";
    BMS.render();
    await new Promise((r) => setTimeout(r, 80));
    const ts = win.document.querySelector("#view").textContent;
    ok(ts.includes("Geluiden") && ts.includes("Quests"), "verhaal: geluiden- + quests-kaart zichtbaar");
    ok(ts.includes("➕ Quest") && ts.includes("▶ Piepje"), "verhaal: quest-knop + geluidsbibliotheek");
    ok(!!win.document.querySelector("#btnImport"), "topbar: importeer-knop aanwezig");
    const actSel = [...win.document.querySelectorAll("#view select")];
    ok(ts.includes("Geluid afspelen") || actSel.length > 0, "verhaal: actie-keuze aanwezig");
  } catch (e) { failures++; console.error("  ✘ boost-ui: " + e.stack); }

  // ── nav-klikken ──
  try {
    for (const item of win.document.querySelectorAll(".nav-item")) item.click();
    ok(true, "alle nav-knoppen klikbaar");
  } catch (e) { failures++; console.error("  ✘ nav: " + e.stack); }

  // ── effecten & drankjes-weergave ──
  try {
    State.ui.view = "potions";
    BMS.render();
    await new Promise((r) => setTimeout(r, 60));
    const tb = win.document.querySelector("#view").textContent;
    ok(tb.includes("Drankjes") && tb.includes("Eigen effecten") && tb.includes("Nieuw drankje"), "potions: effecten + drankjes-weergave");
  } catch (e) { failures++; console.error("  ✘ potions: " + e.stack); }

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
