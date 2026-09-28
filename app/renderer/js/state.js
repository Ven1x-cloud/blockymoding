// ── Projectopslag (localStorage) & datamodel ──
"use strict";

const State = (() => {
  const KEY = "bms.projects.v1";

  let store = { projects: {}, currentId: null };
  let ui = {
    view: "dashboard",
    sel: { blocks: null, items: null, workstations: null, guis: null, mobs: null },
    githubOpen: null // pad van de map die in de GitHub-tab open is
  };

  // ── Opslag ──
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.projects) store = parsed;
      }
    } catch (e) {
      console.warn("Kon opslag niet lezen:", e);
    }
  }

  const save = debounce(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) {
      console.warn("Opslaan mislukt (vol geheugen?):", e);
    }
  }, 150);

  function saveNow() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }

  // ── Standaardwaarden ──
  function defaultProject(name, author) {
    const modId = sanitizeId(name);
    return {
      meta: {
        name: name || "Mijn Mod",
        modId,
        version: "1.0.0",
        author: author || "Modder",
        package: "com." + sanitizeId(author || "modder") + "." + modId,
        mcVersion: "1.20.1",
        loader: "fabric",
        created: Date.now()
      },
      checklist: { aiFolder: false },
      github: {
        owner: "Ven1x-cloud",
        repo: "blockymoding",
        branch: "main",
        folder: "ai-code",
        token: ""
      },
      blocks: [],
      items: [],
      guis: [],
      workstations: [],
      mobs: [],
      story: { chapters: [] },
      aiFiles: []
    };
  }

  /** Standaard 3×3 werkbank-GUI (zelfde maten als de vanilla werkbank) */
  function defaultCraftingElements(title) {
    const els = [];
    els.push({ type: "label", x: 8, y: 6, text: title || "Werkbank", color: "#404040" });
    // 3×3 invoer
    let i = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        els.push({ type: "slot", role: "input", index: i++, x: 30 + c * 18, y: 17 + r * 18, size: 16 });
      }
    }
    // Uitvoer
    els.push({ type: "slot", role: "output", index: 0, x: 124, y: 35, size: 16 });
    // Speler-inventaris (hoofdgedeelte: inventaris-index 9..35)
    let inv = 9;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 9; c++) {
        els.push({ type: "slot", role: "player", index: inv++, x: 8 + c * 18, y: 84 + r * 18, size: 16 });
      }
    }
    // Snelbalk (index 0..8)
    for (let c = 0; c < 9; c++) {
      els.push({ type: "slot", role: "player", index: c, x: 8 + c * 18, y: 142, size: 16 });
    }
    return els;
  }

  function defaultGui(name) {
    return {
      id: sanitizeId(name),
      name: name || "Nieuw GUI",
      width: 176,
      height: 166,
      mode: "crafting",
      bgColor: "#C6C6C6",
      elements: defaultCraftingElements(name)
    };
  }

  // ── Projectbeheer ──
  function listProjects() {
    return Object.values(store.projects).sort((a, b) => b.meta.created - a.meta.created);
  }

  function createProject(name, author) {
    const p = defaultProject(name, author);
    // unieke sleutel
    let key = p.meta.modId;
    let n = 2;
    while (store.projects[key]) key = p.meta.modId + "_" + n++;
    p.meta.modId = key;
    store.projects[key] = p;
    store.currentId = key;
    saveNow();
    return p;
  }

  function duplicateProject(id) {
    const src = store.projects[id];
    if (!src) return null;
    const copy = clone(src);
    copy.meta.name += " (kopie)";
    copy.meta.created = Date.now();
    let key = sanitizeId(copy.meta.modId + "_kopie");
    let n = 2;
    while (store.projects[key]) key = sanitizeId(copy.meta.modId + "_kopie") + "_" + n++;
    copy.meta.modId = key;
    store.projects[key] = copy;
    saveNow();
    return copy;
  }

  function removeProject(id) {
    delete store.projects[id];
    if (store.currentId === id) {
      const rest = listProjects();
      store.currentId = rest.length ? rest[0].meta.modId : null;
    }
    saveNow();
  }

  function switchTo(id) {
    if (store.projects[id]) {
      store.currentId = id;
      saveNow();
    }
  }

  function current() {
    if (!store.currentId) return null;
    return store.projects[store.currentId] || null;
  }

  function getGui(p, guiId) {
    if (!p || !guiId) return null;
    return p.guis.find((g) => g.id === guiId) || null;
  }

  function getBlock(p, blockId) {
    if (!p || !blockId) return null;
    const ns = p.meta.modId;
    if (blockId.startsWith(ns + ":")) blockId = blockId.slice(ns.length + 1);
    return p.blocks.find((b) => b.id === blockId) || null;
  }

  function getItem(p, itemId) {
    if (!p || !itemId) return null;
    const ns = p.meta.modId;
    if (itemId.startsWith(ns + ":")) itemId = itemId.slice(ns.length + 1);
    return p.items.find((i) => i.id === itemId) || null;
  }

  /** Lost een item-id op: #tags blijven tags, project-items worden namespaced */
  function resolveItemId(p, raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (s.startsWith("#")) return s; // tag blijft zoals hij is
    if (s.includes(":")) return s;
    const local = p.items.find((i) => i.id === s || i.id === sanitizeId(s));
    if (local) return p.meta.modId + ":" + local.id;
    const blk = p.blocks.find((b) => b.id === s || b.id === sanitizeId(s));
    if (blk) return p.meta.modId + ":" + blk.id;
    return "minecraft:" + sanitizeId(s);
  }

  /** Pixeltextuur-voorbeeld aanmaken (leeg = doorzichtig) */
  function emptyPixels(size) {
    return new Array((size || 16) * (size || 16)).fill(null);
  }

  return {
    load, save, saveNow,
    get ui() { return ui; },
    listProjects, createProject, duplicateProject, removeProject, switchTo, current,
    getGui, getBlock, getItem, resolveItemId,
    defaultCraftingElements, defaultGui, emptyPixels
  };
})();

if (typeof module !== "undefined") module.exports = { State };
