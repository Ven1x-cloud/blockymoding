// ── BlockyMod Studio – UI-controller ──
"use strict";

(() => {
  State.load();

  const view = () => $("#view");
  const cur = () => State.current();

  // ══════════════════════════════════════════════
  //  Algemene bouwblokken
  // ══════════════════════════════════════════════

  function sectionTitle(title, sub) {
    return [
      el("h1", { class: "view-title", text: title }),
      sub ? el("p", { class: "view-sub", text: sub }) : null
    ];
  }

  function field(label, input, hint) {
    return el("div", { class: "field" },
      el("label", { text: label }),
      input,
      hint ? el("div", { class: "hint", text: hint }) : null
    );
  }

  function textInput(value, onInput, attrs) {
    return el("input", Object.assign({
      class: "mc-input", value: value ?? "",
      oninput: (e) => onInput(e.target.value)
    }, attrs || {}));
  }

  function selectInput(options, value, onChange, attrs) {
    return el("select", Object.assign({
      class: "mc-input",
      onchange: (e) => onChange(e.target.value)
    }, attrs || {}),
      ...options.map((o) => {
        const [v, label] = Array.isArray(o) ? o : [o, o];
        return el("option", { value: v, text: label, selected: String(v) === String(value) });
      })
    );
  }

  function checkInput(label, checked, onChange) {
    const cb = el("input", { type: "checkbox", checked: !!checked, onchange: (e) => onChange(e.target.checked) });
    return el("label", { class: "check" }, cb, label);
  }

  function emptyState(icon, text, btnLabel, onBtn) {
    return el("div", { class: "empty-state" },
      el("span", { class: "big", text: icon }),
      el("div", { text }),
      btnLabel ? el("button", { class: "mc-btn mc-btn-green mt", text: btnLabel, onclick: onBtn }) : null
    );
  }

  function deleteBtn(fn, label) {
    return el("button", { class: "mc-btn mc-btn-red mc-btn-xs", text: label || "Verwijder", onclick: (e) => { e.stopPropagation(); fn(); } });
  }

  function confirmDelete(what, fn) {
    openModal(`Verwijderen: ${what}`,
      el("p", { text: `Weet je zeker dat je "${what}" wilt verwijderen? Dit kan niet ongedaan worden.` }),
      [
        { label: "Annuleren", cls: "mc-btn-ghost", onClick: closeModal },
        {
          label: "Ja, verwijder", cls: "mc-btn-red", onClick: () => { closeModal(); fn(); }
        }
      ]);
  }

  // ── Modaal ──
  function openModal(title, content, buttons) {
    const box = $("#modalBox");
    box.innerHTML = "";
    box.appendChild(el("h2", { text: title }));
    box.appendChild(content);
    const row = el("div", { class: "row row-end mt" });
    (buttons || [{ label: "Sluiten", cls: "mc-btn-ghost", onClick: closeModal }]).forEach((b) => {
      row.appendChild(el("button", { class: "mc-btn " + (b.cls || "mc-btn-blue"), text: b.label, onclick: b.onClick }));
    });
    box.appendChild(row);
    $("#modalBackdrop").hidden = false;
  }

  function closeModal() {
    $("#modalBackdrop").hidden = true;
  }

  $("#modalBackdrop").addEventListener("mousedown", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });

  // ── Opslaan + hervernieuwen ──
  function changed(rerender) {
    State.save();
    updateChrome();
    if (rerender !== false) render();
  }

  function updateChrome() {
    const p = cur();
    const badge = $("#modBadge");
    badge.textContent = p
      ? `${p.meta.name}  ·  ${p.meta.modId}  ·  v${p.meta.version}  ·  MC ${p.meta.mcVersion}`
      : "Geen mod geladen";
    badge.title = badge.textContent;
    const dot = $("#githubDot");
    dot.hidden = !(p && p.checklist && !p.checklist.aiFolder);
    $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === State.ui.view));
  }

  // ══════════════════════════════════════════════
  //  Navigatie
  // ══════════════════════════════════════════════

  const VIEWS = {
    dashboard: renderDashboard,
    blocks: renderBlocks,
    items: renderItems,
    workstations: renderWorkstations,
    guis: renderGuis,
    mobs: renderMobs,
    story: renderStory,
    github: renderGithub
  };

  function goto(name) {
    State.ui.view = name;
    render();
  }

  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => goto(btn.dataset.view));
  });

  function render() {
    updateChrome();
    const fn = VIEWS[State.ui.view] || renderDashboard;
    const v = view();
    v.innerHTML = "";
    v.scrollTop = 0;
    if (State.ui.view !== "dashboard" && !cur()) {
      v.appendChild(emptyState("📦", "Maak eerst een mod aan om te kunnen ontwerpen.", "➕ Maak een mod", showProjectManager));
      return;
    }
    fn(v);
  }

  // ══════════════════════════════════════════════
  //  Mod-beheer (topbar)
  // ══════════════════════════════════════════════

  function showProjectManager() {
    const p = cur();
    const content = el("div");
    const list = el("div", { class: "mt" });
    const refresh = () => {
      list.innerHTML = "";
      const projects = State.listProjects();
      if (!projects.length) {
        list.appendChild(el("div", { class: "dim small", text: "Nog geen mods." }));
      }
      projects.forEach((pr) => {
        const active = pr.meta.modId === (p && p.meta.modId);
        list.appendChild(el("div", { class: "list-item" + (active ? " active" : ""), onclick: () => { State.switchTo(pr.meta.modId); closeModal(); goto("dashboard"); toast(`Mod "${pr.meta.name}" geopend`, "ok"); } },
          el("div", { class: "li-icon", text: "📦" }),
          el("div", {},
            el("div", { class: "li-name", text: pr.meta.name }),
            el("div", { class: "li-sub", text: `${pr.meta.modId} · MC ${pr.meta.mcVersion} · ${pr.blocks.length} blokken · ${pr.mobs.length} mobs` })
          ),
          el("div", { class: "li-actions" },
            el("button", {
              class: "mc-btn mc-btn-ghost mc-btn-xs", text: "Kopie",
              onclick: (e) => { e.stopPropagation(); State.duplicateProject(pr.meta.modId); refresh(); toast("Kopie gemaakt", "ok"); }
            }),
            deleteBtn(() => confirmDelete(pr.meta.name, () => { State.removeProject(pr.meta.modId); refresh(); updateChrome(); if (!cur()) render(); }), "×")
          )
        ));
      });
      list.appendChild(el("div", { class: "sep" }));
      list.appendChild(el("button", {
        class: "mc-btn mc-btn-green", text: "➕ Nieuwe mod",
        onclick: showCreateProject
      }));
    };
    refresh();
    content.appendChild(list);
    openModal("Mijn mods", content);
  }

  function showCreateProject() {
    const nameIn = el("input", { class: "mc-input", value: "Mijn Grote Mod", placeholder: "bijv. Mijn Grote Mod" });
    const authorIn = el("input", { class: "mc-input", value: "Modder", placeholder: "Jouw naam" });
    const verSel = selectInput(Exporters.VERSION_OPTIONS, "26.3", () => {});
    const pkgIn = el("input", { class: "mc-input", value: "com.modder.mijn_grote_mod" });
    const syncPkg = () => {
      pkgIn.value = "com." + sanitizeId(authorIn.value || "modder") + "." + sanitizeId(nameIn.value || "mod");
    };
    nameIn.addEventListener("input", syncPkg);
    authorIn.addEventListener("input", syncPkg);

    const content = el("div", {},
      field("Naam van de mod", nameIn),
      field("Jouw naam (auteur)", authorIn),
      field("Minecraft-versie", verSel, "Fabric-mod · 26.3 = laatste versie (Mojang-mappings, Java 25) · 1.20.1/1.21.1 = stabiel (Yarn, Java 17/21)"),
      field("Java-pakket", pkgIn)
    );

    openModal("Nieuwe mod", content, [
      { label: "Annuleren", cls: "mc-btn-ghost", onClick: closeModal },
      {
        label: "➕ Maken", cls: "mc-btn-green", onClick: () => {
          const name = nameIn.value.trim() || "Nieuwe Mod";
          const pr = State.createProject(name, authorIn.value.trim());
          pr.meta.mcVersion = verSel.value;
          pr.meta.package = pkgIn.value.trim() || pr.meta.package;
          State.saveNow();
          closeModal();
          goto("dashboard");
          showAiFolderReminder(true);
        }
      }
    ]);
  }

  $("#btnProjects").addEventListener("click", showProjectManager);

  // ══════════════════════════════════════════════
  //  Dashboard
  // ══════════════════════════════════════════════

  function renderDashboard(root) {
    const p = cur();
    if (!p) {
      sectionTitle("Welkom bij BlockyMod Studio", "Bouw simpel je eigen Minecraft-mods: blokken, werkbanken, GUI's, mobs en verhaallijnen.").forEach((n) => root.appendChild(n));
      root.appendChild(el("div", { class: "card" },
        el("div", { class: "empty-state" },
          el("span", { class: "big", text: "🟩" }),
          el("div", { text: "Begin met je eerste mod – in een paar stappen klaar." }),
          el("button", { class: "mc-btn mc-btn-green mt", text: "➕ Maak je eerste mod", onclick: showCreateProject })
        )
      ));
      return;
    }

    sectionTitle("Overzicht", `Alles van "${p.meta.name}" op één plek.`).forEach((n) => root.appendChild(n));

    // ── Herinnering AI-code map ──
    root.appendChild(aiFolderReminderCard(p));

    // ── Stats ──
    const recipes = p.workstations.reduce((n, w) => n + (w.recipes || []).length, 0);
    root.appendChild(el("div", { class: "grid3 mb" },
      statBox(p.blocks.length, "Blokken", "🧱", () => goto("blocks")),
      statBox(p.items.length, "Items", "🗡️", () => goto("items")),
      statBox(p.workstations.length, "Werkbanken", "🛠️", () => goto("workstations")),
      statBox(p.guis.length, "GUI's", "🖼️", () => goto("guis")),
      statBox(p.mobs.length, "Mobs", "🐷", () => goto("mobs")),
      statBox(p.story.chapters.length + " hoofdst." + (recipes ? " · " + recipes + " recept." : ""), "", "📖", () => goto("story"))
    ));

    // ── Snelkoppelingen ──
    root.appendChild(el("div", { class: "card" },
      el("h3", { class: "card-title", text: "Snel aan de slag" }),
      el("div", { class: "row" },
        quickBtn("🧱 Nieuw blok", () => { addBlock(); }),
        quickBtn("🛠️ Nieuwe werkbank", () => { goto("workstations"); addWorkstation(); }),
        quickBtn("🐷 Nieuwe mob", () => { addMob(); }),
        quickBtn("📖 Verhaal schrijven", () => goto("story")),
        quickBtn("🤖 Codes van GitHub", () => goto("github"))
      )
    ));

    // ── Mod-instellingen ──
    const meta = p.meta;
    root.appendChild(el("div", { class: "card" },
      el("h3", { class: "card-title", text: "Mod-instellingen" }),
      el("div", { class: "grid2" },
        field("Mod-naam", textInput(meta.name, (v) => { meta.name = v; changed(); })),
        field("Mod-id", textInput(meta.modId, (v) => { meta.modId = sanitizeId(v); changed(); }), "Kleine letters, cijfers en _ – uniek in Minecraft"),
        field("Versie", textInput(meta.version, (v) => { meta.version = v; changed(); })),
        field("Auteur", textInput(meta.author, (v) => { meta.author = v; changed(); })),
        field("Java-pakket", textInput(meta.package, (v) => { meta.package = v; changed(); })),
        field("Minecraft-versie", selectInput(Exporters.VERSION_OPTIONS, meta.mcVersion, (v) => { meta.mcVersion = v; changed(); }),
        "26.3 = laatste versie (Mojang-mappings). Bij compile-waarschuwingen: vraag de AI.")
      )
    ));
  }

  function statBox(num, label, icon, onClick) {
    return el("div", { class: "stat-box", style: "cursor:pointer", onclick: onClick },
      el("div", { class: "num", text: String(num) }),
      el("div", { class: "lbl", text: label || icon })
    );
  }

  function quickBtn(label, fn) {
    return el("button", { class: "mc-btn mc-btn-ghost", text: label, onclick: fn });
  }

  function aiFolderReminderCard(p) {
    const done = p.checklist.aiFolder;
    const gh = p.github || {};
    const branch = gh.branch || "main";
    const steps = `1. Open github.com/Ven1x-cloud/blockymoding
2. Kies bovenaan de branch "${branch}" (dezelfde als in de app)
3. Klik Add file → Create new file
4. Typ als naam:  mods/jouw-modnaam/README.md   (de mappen ontstaan vanzelf)
5. Klik Commit changes
Of zeg tegen de AI: "maak de map mods/jouw-modnaam aan" – dan doe ik het voor je.`;
    const card = el("div", { class: "reminder" + (done ? " done" : "") },
      el("h4", { text: done ? "✅ AI-code map aangemaakt" : "⚠️ Herinnering: maak een map voor je mod op GitHub" }),
      done
        ? el("p", { text: "De map bestaat (of je hebt dit afgevinkt). Vul in de GitHub-tab dezelfde map in bij 'Map met AI-codes' en klik 'Codes ophalen'." })
        : el("div", {},
          el("p", { text: "Elke mod krijgt een eigen map in deze GitHub-repo waar ik (de AI) code voor je in zet – één map per mod. Geen Git nodig, zo maak je 'm in de browser:" }),
          el("pre", { class: "codeblock", text: steps }),
          el("div", { class: "row" },
            el("button", { class: "mc-btn mc-btn-sm mc-btn-blue", text: "📋 Kopieer stappen", onclick: () => copyText(steps) }),
            el("button", { class: "mc-btn mc-btn-sm mc-btn-green", text: "✔ Ik heb het gedaan", onclick: () => { p.checklist.aiFolder = true; changed(); } }),
            el("button", { class: "mc-btn mc-btn-sm mc-btn-ghost", text: "Naar GitHub-tab →", onclick: () => goto("github") })
          )
        )
    );
    if (done) {
      card.appendChild(el("button", {
        class: "mc-btn mc-btn-xs mc-btn-ghost mt", text: "toch niet gedaan?",
        onclick: () => { p.checklist.aiFolder = false; changed(); }
      }));
    }
    return card;
  }

  function showAiFolderReminder() {
    // direct na creatie: spring naar dashboard waar de kaart staat
    toast("Belangrijk: maak een map voor je mod op GitHub (zie Overzicht)", "info");
  }

  // ══════════════════════════════════════════════
  //  BLOKKEN
  // ══════════════════════════════════════════════

  function addBlock() {
    const p = cur();
    if (!p) return showCreateProject();
    let n = p.blocks.length + 1;
    let id = "mijn_blok_" + n;
    const ids = new Set(p.blocks.map((b) => b.id));
    while (ids.has(id)) { n++; id = "mijn_blok_" + n; }
    const b = {
      id, name: "Mijn Blok " + n,
      hardness: 1.5, requiresTool: true, tool: "pickaxe", light: 0,
      blast: 0, friction: 0.6, noCollision: false, mapColor: "", randomTicks: false,
      shape: { w: 16, h: 16, d: 16 },
      genStyle: "ruis", genColor: "#8a8a8a",
      pixels: TextureKit.generate("ruis", "#8a8a8a", Math.floor(Math.random() * 99999))
    };
    p.blocks.push(b);
    State.ui.sel.blocks = b.id;
    goto("blocks");
    toast("Blok toegevoegd – ontwerp je textuur!", "ok");
  }

  function renderBlocks(root) {
    const p = cur();
    sectionTitle("Blokken", "Ontwerp blokken met textuur en eigenschappen – de app genereert alle bestanden.").forEach((n) => root.appendChild(n));

    const sel = p.blocks.find((b) => b.id === State.ui.sel.blocks) || p.blocks[0];
    if (sel) State.ui.sel.blocks = sel.id;

    const layout = el("div", { style: "display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap" });

    // lijst
    const list = el("div", { style: "width:250px;min-width:220px" },
      el("button", { class: "mc-btn mc-btn-green mb", style: "width:100%", text: "➕ Nieuw blok", onclick: addBlock })
    );
    if (!p.blocks.length) {
      list.appendChild(emptyState("🧱", "Nog geen blokken."));
    }
    p.blocks.forEach((b) => {
      const item = el("div", { class: "list-item" + (sel === b ? " active" : ""), onclick: () => { State.ui.sel.blocks = b.id; render(); } });
      const icon = el("div", { class: "li-icon" });
      const c = TextureKit.pixelsToCanvas(b.pixels || TextureKit.generate("ruis", "#888", 1), 16);
      icon.appendChild(c);
      item.appendChild(icon);
      item.appendChild(el("div", {},
        el("div", { class: "li-name", text: b.name }),
        el("div", { class: "li-sub", text: `${p.meta.modId}:${b.id}` })
      ));
      list.appendChild(item);
    });

    layout.appendChild(list);

    // editor
    const ed = el("div", { class: "card", style: "flex:1;min-width:420px" });
    if (sel) {
      ed.appendChild(el("h3", { class: "card-title", text: "Blok bewerken" }));
      ed.appendChild(el("div", { class: "grid2" },
        field("Naam (in de game)", textInput(sel.name, (v) => { sel.name = v; State.save(); updateChrome(); })),
        field("ID", textInput(sel.id, (v) => { sel.id = sanitizeId(v); State.ui.sel.blocks = sel.id; changed(); }), "Uniek – wordt " + p.meta.modId + ":<id>")
      ));
      ed.appendChild(el("div", { class: "grid3" },
        field("Hardheid", textInput(sel.hardness, (v) => { sel.hardness = parseFloat(v) || 0; State.save(); }, { type: "number", step: "0.1", min: "0" }), "0 = instant, 50 = obsidiaan-achtig"),
        field("Gereedschap", selectInput([["pickaxe", "Houweel"], ["axe", "Bijl"], ["shovel", "Schoffel"], ["none", "Geen specifiek"]], sel.tool, (v) => { sel.tool = v; State.save(); })),
        field("Lichtsterkte (0-15)", textInput(sel.light, (v) => { sel.light = Math.max(0, Math.min(15, parseInt(v, 10) || 0)); State.save(); }, { type: "number", min: "0", max: "15" }))
      ));
      ed.appendChild(checkInput("Heeft gereedschap nodig om te breken", sel.requiresTool, (v) => { sel.requiresTool = v; State.save(); }));

      // ── extra eigenschappen ──
      ed.appendChild(el("div", { class: "grid3" },
        field("Explosieweerstand", textInput(sel.blast ?? 0, (v) => { sel.blast = Math.max(0, parseFloat(v) || 0); State.save(); }, { type: "number", step: "0.5", min: "0" }), "0 = volgt de hardheid"),
        field("Wrijving (0,2–1,0)", textInput(sel.friction ?? 0.6, (v) => { sel.friction = Math.max(0.2, Math.min(1, parseFloat(v) || 0.6)); State.save(); }, { type: "number", step: "0.05", min: "0.2", max: "1" }), "ijs ≈ 0,98 · smeer = 0,6"),
        field("Kaartkleur", selectInput([["", "— standaard —"], ["stone", "Steen"], ["grass", "Gras"], ["wood", "Hout"], ["metal", "Metaal"], ["fire", "Vuur"], ["sand", "Zand"], ["ice", "Ijs"], ["plant", "Plant"], ["color_purple", "Paars"]], sel.mapColor || "", (v) => { sel.mapColor = v; State.save(); }))
      ));
      ed.appendChild(el("div", { class: "row", style: "flex-wrap:wrap" },
        checkInput("Geen botsing (plant/dun object)", !!sel.noCollision, (v) => { sel.noCollision = v; State.save(); }),
        checkInput("Willekeurige ticks (gewas-gedrag)", !!sel.randomTicks, (v) => { sel.randomTicks = v; State.save(); })
      ));

      // ── 3D-vorm (maatwerk-model) ──
      ed.appendChild(el("div", { class: "sep" }));
      ed.appendChild(el("h3", { class: "card-title", text: "🧊 3D-vorm (maatwerk-model)" }));
      if (!sel.shape) sel.shape = { w: 16, h: 16, d: 16 };
      const sh = sel.shape;
      const shapeWrap = el("div", { class: "shape-editor" });
      const stage = el("div", { class: "shape3d-stage" });
      const cube = el("div", { class: "shape3d-cube" });
      const faces = {};
      ["front", "back", "right", "left", "top", "bottom"].forEach((f) => {
        faces[f] = el("div", { class: "shape3d-face shape3d-" + f });
        cube.appendChild(faces[f]);
      });
      const pivot = el("div", { class: "shape3d-pivot" }, cube);
      stage.appendChild(pivot);
      let rotY = -28, rotX = -22, drag = null;
      const applyRot = () => { pivot.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`; };
      const upd = () => {
        cube.style.setProperty("--w", sh.w + "px");
        cube.style.setProperty("--h", sh.h + "px");
        cube.style.setProperty("--d", sh.d + "px");
        try {
          const url = TextureKit.pixelsToCanvas(sel.pixels || TextureKit.generate("ruis", "#888", 1), 16).toDataURL();
          Object.keys(faces).forEach((k) => { faces[k].style.backgroundImage = "url(" + url + ")"; });
        } catch (e) { /* geen canvas beschikbaar */ }
      };
      stage.addEventListener("pointerdown", (e) => {
        drag = { x: e.clientX, y: e.clientY };
        if (stage.setPointerCapture && e.pointerId != null) { try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } }
      });
      stage.addEventListener("pointermove", (e) => {
        if (!drag) return;
        rotY += (e.clientX - drag.x) * 0.5;
        rotX = Math.max(-80, Math.min(80, rotX - (e.clientY - drag.y) * 0.5));
        drag = { x: e.clientX, y: e.clientY };
        applyRot();
      });
      const endDrag = () => { drag = null; };
      stage.addEventListener("pointerup", endDrag);
      stage.addEventListener("pointercancel", endDrag);
      const shapeSlider = (key, label, min, max) => field(label, textInput(sh[key], (v) => {
        sh[key] = Math.max(min, Math.min(max, parseInt(v, 10) || max));
        State.save(); upd();
      }, { type: "number", min: String(min), max: String(max) }));
      shapeWrap.appendChild(stage);
      const shapeInfo = el("div", { style: "flex:1;min-width:220px" });
      shapeInfo.appendChild(el("div", { class: "grid3" },
        shapeSlider("w", "Breedte (1-16)", 1, 16),
        shapeSlider("h", "Hoogte (1-16)", 1, 16),
        shapeSlider("d", "Diepte (1-16)", 1, 16)
      ));
      shapeInfo.appendChild(el("div", { class: "row", style: "flex-wrap:wrap;margin-top:6px" },
        el("button", { class: "mc-btn mc-btn-ghost mc-btn-xs", text: "⬛ Vol blok", onclick: () => { Object.assign(sh, { w: 16, h: 16, d: 16 }); State.save(); render(); } }),
        el("button", { class: "mc-btn mc-btn-ghost mc-btn-xs", text: "▬ Halve steen", onclick: () => { Object.assign(sh, { w: 16, h: 8, d: 16 }); State.save(); render(); } }),
        el("button", { class: "mc-btn mc-btn-ghost mc-btn-xs", text: "🪵 Pilaar", onclick: () => { Object.assign(sh, { w: 8, h: 16, d: 8 }); State.save(); render(); } }),
        el("button", { class: "mc-btn mc-btn-ghost mc-btn-xs", text: "📄 Plaat", onclick: () => { Object.assign(sh, { w: 16, h: 2, d: 16 }); State.save(); render(); } })
      ));
      shapeInfo.appendChild(el("div", { class: "small dim mt", text: "Sleep over de preview om te draaien. Anders dan 16×16×16 → maatwerk model-JSON in de export. Botsing blijft voorlopig kubisch (vraag de AI voor vorm-botsing)." }));
      shapeWrap.appendChild(shapeInfo);
      ed.appendChild(shapeWrap);
      const bootShape = () => { upd(); applyRot(); };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(bootShape); else bootShape();

      ed.appendChild(el("div", { class: "sep" }));
      ed.appendChild(el("h3", { class: "card-title", text: "Textuur (16×16)" }));
      const texHolder = el("div");
      ed.appendChild(texHolder);
      TextureKit.mountEditor(texHolder, {
        size: 16, pixels: sel.pixels,
        onChange: (px) => { sel.pixels = px; State.save(); }
      });

      ed.appendChild(el("div", { class: "row mt" },
        el("button", {
          class: "mc-btn mc-btn-red mc-btn-sm", text: "🗑 Verwijder blok",
          onclick: () => confirmDelete(sel.name, () => {
            p.blocks = p.blocks.filter((x) => x !== sel);
            State.ui.sel.blocks = null;
            changed();
          })
        })
      ));
    } else {
      ed.appendChild(emptyState("🧱", "Klik op '+ Nieuw blok' om te beginnen."));
    }
    layout.appendChild(ed);
    root.appendChild(layout);
  }

  // ══════════════════════════════════════════════
  //  ITEMS
  // ══════════════════════════════════════════════

  function renderEnchantsCard(root, p) {
    if (!p.enchants) p.enchants = [];
    const card = el("div", { class: "card mt" });
    card.appendChild(el("h3", { class: "card-title", text: "✨ Aangepaste enchants (van je hele mod)" }));
    card.appendChild(el("p", { class: "dim small", text: "Echte Minecraft-enchants: 26.3 → enchantment-JSON, 1.20.1 → Java-code. Gebruik in-game met /enchant @p <id> <niveau>." }));
    const list = el("div");
    const renderList = () => {
      list.innerHTML = "";
      if (!p.enchants.length) list.appendChild(el("div", { class: "small dim", text: "Nog geen enchants – klik op ➕ Nieuwe enchant." }));
      p.enchants.forEach((e, i) => {
        const effectFields = (e.effect === "status")
          ? el("div", { class: "grid3" },
              field("Status-effect", textInput(e.statusId || "minecraft:poison", (v) => { e.statusId = v.trim() || "minecraft:poison"; State.save(); }, { placeholder: "minecraft:poison" })),
              field("Duur per niveau (sec)", textInput(e.statusDur ?? 3, (v) => { e.statusDur = Math.max(1, parseInt(v, 10) || 1); State.save(); }, { type: "number", min: "1" })),
              field("Sterkte (amplifier)", textInput(e.statusAmp ?? 0, (v) => { e.statusAmp = Math.max(0, parseInt(v, 10) || 0); State.save(); }, { type: "number", min: "0" }))
            )
          : el("div", { class: "grid3" },
              field("Basis-sterkte (niveau 1)", textInput(e.base ?? 1, (v) => { e.base = parseFloat(v) || 0; State.save(); }, { type: "number", step: "0.5" })),
              field("Extra per niveau", textInput(e.perLevel ?? 0.5, (v) => { e.perLevel = parseFloat(v) || 0; State.save(); }, { type: "number", step: "0.5" })),
              field("Formule", el("span", { class: "dim small", text: "basis + (nivo−1)×extra" }))
            );
        list.appendChild(el("div", { class: "card", style: "margin:8px 0;padding:10px" },
          el("div", { class: "grid3" },
            field("Naam", textInput(e.name, (v) => { e.name = v; State.save(); })),
            field("ID", textInput(e.id, (v) => { e.id = sanitizeId(v); State.save(); })),
            field("Max niveau", textInput(e.maxLevel || 3, (v) => { e.maxLevel = Math.max(1, Math.min(5, parseInt(v, 10) || 1)); State.save(); }, { type: "number", min: "1", max: "5" }))
          ),
          el("div", { class: "grid3" },
            field("Effect", selectInput([["schade", "⚔ Extra schade"], ["status", "☣ Effect bij hit"], ["knockback", "🌊 Terugslag bij hit"]], e.effect || "schade", (v) => { e.effect = v; changed(); })),
            field("Vindbaarheid", textInput(e.weight ?? 10, (v) => { e.weight = Math.max(1, Math.min(30, parseInt(v, 10) || 1)); State.save(); }, { type: "number", min: "1", max: "30" }), "hoog = vaker in tafel"),
            field("Werkt op", selectInput([["hand", "Wapen (hand)"], ["mainhand", "Alleen rechterhand"], ["armor", "Pantser"], ["any", "Alles"]], e.slots || "hand", (v) => { e.slots = v; State.save(); }))
          ),
          effectFields,
          el("div", { class: "row" },
            el("button", { class: "mc-btn mc-btn-red mc-btn-xs", text: "🗑 Verwijder enchant", onclick: () => { p.enchants.splice(i, 1); State.save(); renderList(); } })
          )
        ));
      });
    };
    renderList();
    card.appendChild(list);
    card.appendChild(el("div", { class: "row mt" },
      el("button", {
        class: "mc-btn mc-btn-green mc-btn-sm", text: "➕ Nieuwe enchant",
        onclick: () => {
          let n = p.enchants.length + 1;
          let id = "mijn_enchant_" + n;
          while (p.enchants.some((x) => x.id === id)) { n++; id = "mijn_enchant_" + n; }
          p.enchants.push({ id, name: "Mijn Enchant " + n, maxLevel: 3, weight: 10, slots: "hand", effect: "schade", base: 1, perLevel: 0.5, statusId: "minecraft:poison", statusDur: 3, statusAmp: 0 });
          State.save(); renderList();
        }
      })
    ));
    root.appendChild(card);
  }


  function addItem() {
    const p = cur();
    if (!p) return showCreateProject();
    let n = p.items.length + 1;
    const ids = new Set(p.items.map((b) => b.id));
    let id = "mijn_item_" + n;
    while (ids.has(id)) { n++; id = "mijn_item_" + n; }
    const it = {
      id, name: "Mijn Item " + n, maxStack: 64,
      rarity: "", maxDamage: 0, fireproof: false, glint: false, enchantability: 0,
      genStyle: "ruis", genColor: "#b87333",
      pixels: TextureKit.generate("ruis", "#b87333", Math.floor(Math.random() * 99999))
    };
    p.items.push(it);
    State.ui.sel.items = it.id;
    goto("items");
    toast("Item toegevoegd!", "ok");
  }

  function renderItems(root) {
    const p = cur();
    sectionTitle("Items", "Wapens, materialen, eten – alles wat je in je hand kunt houden.").forEach((n) => root.appendChild(n));

    renderEnchantsCard(root, p);

    const sel = p.items.find((b) => b.id === State.ui.sel.items) || p.items[0];
    if (sel) State.ui.sel.items = sel.id;

    const layout = el("div", { style: "display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap" });
    const list = el("div", { style: "width:250px;min-width:220px" },
      el("button", { class: "mc-btn mc-btn-green mb", style: "width:100%", text: "➕ Nieuw item", onclick: addItem })
    );
    if (!p.items.length) list.appendChild(emptyState("🗡️", "Nog geen items."));
    p.items.forEach((it) => {
      const item = el("div", { class: "list-item" + (sel === it ? " active" : ""), onclick: () => { State.ui.sel.items = it.id; render(); } });
      const icon = el("div", { class: "li-icon" });
      icon.appendChild(TextureKit.pixelsToCanvas(it.pixels || TextureKit.generate("ruis", "#b87333", 1), 16));
      item.appendChild(icon);
      item.appendChild(el("div", {},
        el("div", { class: "li-name", text: it.name }),
        el("div", { class: "li-sub", text: `${p.meta.modId}:${it.id}` })
      ));
      list.appendChild(item);
    });
    layout.appendChild(list);

    const ed = el("div", { class: "card", style: "flex:1;min-width:420px" });
    if (sel) {
      ed.appendChild(el("h3", { class: "card-title", text: "Item bewerken" }));
      ed.appendChild(el("div", { class: "grid2" },
        field("Naam", textInput(sel.name, (v) => { sel.name = v; State.save(); updateChrome(); })),
        field("ID", textInput(sel.id, (v) => { sel.id = sanitizeId(v); State.ui.sel.items = sel.id; changed(); }))
      ));
      ed.appendChild(field("Max. stapelgrootte", textInput(sel.maxStack, (v) => {
        sel.maxStack = Math.max(1, Math.min(64, parseInt(v, 10) || 64)); State.save();
      }, { type: "number", min: "1", max: "64" })));

      ed.appendChild(el("div", { class: "sep" }));
      ed.appendChild(el("h3", { class: "card-title", text: "⚡ Item-boost" }));
      ed.appendChild(el("div", { class: "grid3" },
        field("Zeldzaamheid", selectInput([["", "— gewoon (wit) —"], ["uncommon", "Ongebruikelijk (geel)"], ["rare", "Zeldzaam (cyaan)"], ["epic", "Episch (paars)"]], sel.rarity || "", (v) => { sel.rarity = v; State.save(); })),
        field("Duurzaamheid (0 = niet)", textInput(sel.maxDamage ?? 0, (v) => { sel.maxDamage = Math.max(0, parseInt(v, 10) || 0); State.save(); }, { type: "number", min: "0" }), "slijtage-punten"),
        field("Beheksbaarheid (0-15)", textInput(sel.enchantability ?? 0, (v) => { sel.enchantability = Math.max(0, Math.min(15, parseInt(v, 10) || 0)); State.save(); }, { type: "number", min: "0", max: "15" }), "hoe beter te verenkelen")
      ));
      ed.appendChild(el("div", { class: "row", style: "flex-wrap:wrap" },
        checkInput("Brandwerend (overleeft vuur & lava)", !!sel.fireproof, (v) => { sel.fireproof = v; State.save(); }),
        checkInput("Enchant-glinstering ✨", !!sel.glint, (v) => { sel.glint = v; State.save(); })
      ));
      if ((sel.maxDamage | 0) > 0) ed.appendChild(el("div", { class: "small dim", text: "⚠ Duurzaamheid actief → Minecraft zet de stapelgrootte automatisch op 1." }));

      ed.appendChild(el("div", { class: "sep" }));
      ed.appendChild(el("h3", { class: "card-title", text: "🛡️ Uitrusting (armor)" }));
      if (!sel.armor) sel.armor = null;
      ed.appendChild(el("div", { class: "grid2" },
        field("Draagpositie", selectInput([
          ["", "— geen (gewoon item) —"],
          ["helmet", "⛑ Helm (hoofd)"],
          ["chest", "🧥 Borstplaat (borst)"],
          ["legs", "👖 Broek (benen)"],
          ["boots", "🥾 Laarzen (voeten)"]
        ], (sel.armor && sel.armor.slot) || "", (v) => {
          if (!v) sel.armor = null;
          else sel.armor = { slot: v, defense: (sel.armor && sel.armor.defense) || 3 };
          changed();
        }), "3 weergaven: inventaris, in de hand, op het lijf"),
        field("Verdediging", textInput((sel.armor && sel.armor.defense) || 3, (v) => {
          if (!sel.armor) return;
          sel.armor.defense = Math.max(0, Math.min(20, parseInt(v, 10) || 0));
          State.save();
        }, { type: "number", min: "0", max: "20", disabled: sel.armor ? null : "disabled" }), "pantser-punten")
      ));
      if (sel.armor) {
        ed.appendChild(el("div", { class: "small dim", text: "🧪 Zichtbaarheid: ① inventaris-icoon = de textuur hieronder, ② in je hand (andere spelers zien het ook), ③ op je lijf – de app genereert daarvoor automatisch de wapenlagen én het uitrustings-asset. Zet Duurzaamheid op >0 (bijv. 165), anders standaard per positie." }));
        if (sel.frames && sel.frames.length) ed.appendChild(el("div", { class: "small dim", text: "🎞 Dit item is geanimeerd: het icoon speelt af in de inventaris én in de hand." }));
      }

      ed.appendChild(el("div", { class: "sep" }));
      ed.appendChild(el("h3", { class: "card-title", text: "Textuur (16×16)" }));
      const texHolder = el("div");
      const frameRow = el("div", { class: "row mb", style: "flex-wrap:wrap" });
      ed.appendChild(frameRow);
      ed.appendChild(texHolder);
      if (!sel.frames) sel.frames = [];
      let activeFrame = 0;
      const framePx = (i) => {
        if (i === 0) { if (!sel.pixels) sel.pixels = new Array(256).fill(null); return sel.pixels; }
        if (!sel.frames[i - 1]) sel.frames[i - 1] = new Array(256).fill(null);
        return sel.frames[i - 1];
      };
      const mountTex = () => {
        texHolder.innerHTML = "";
        TextureKit.mountEditor(texHolder, {
          size: 16, pixels: framePx(activeFrame),
          onChange: (px) => {
            if (activeFrame === 0) sel.pixels = px; else sel.frames[activeFrame - 1] = px;
            State.save();
          }
        });
      };
      const renderFrameRow = () => {
        frameRow.innerHTML = "";
        const total = 1 + sel.frames.length;
        for (let i = 0; i < total; i++) {
          frameRow.appendChild(el("button", {
            class: "mc-btn mc-btn-sm " + (i === activeFrame ? "mc-btn-green" : "mc-btn-ghost"),
            text: "🎞 Frame " + (i + 1),
            onclick: () => { activeFrame = i; renderFrameRow(); mountTex(); }
          }));
        }
        if (total < 4) frameRow.appendChild(el("button", {
          class: "mc-btn mc-btn-sm mc-btn-ghost", text: "➕ Animeer-frame",
          onclick: () => { sel.frames.push(new Array(256).fill(null)); activeFrame = sel.frames.length; State.save(); renderFrameRow(); mountTex(); }
        }));
        if (sel.frames.length) frameRow.appendChild(el("button", {
          class: "mc-btn mc-btn-sm mc-btn-red", text: "✖ Laatste frame weg",
          onclick: () => { sel.frames.pop(); if (activeFrame > sel.frames.length) activeFrame = 0; State.save(); renderFrameRow(); mountTex(); }
        }));
        if (sel.frames.length) frameRow.appendChild(el("span", { class: "dim small", style: "align-self:center", text: "▶ Speelt af in inventaris én in de hand." }));
      };
      renderFrameRow();
      mountTex();

      ed.appendChild(el("div", { class: "row mt" },
        el("button", {
          class: "mc-btn mc-btn-red mc-btn-sm", text: "🗑 Verwijder item",
          onclick: () => confirmDelete(sel.name, () => {
            p.items = p.items.filter((x) => x !== sel);
            State.ui.sel.items = null;
            changed();
          })
        })
      ));
    } else {
      ed.appendChild(emptyState("🗡️", "Klik op '+ Nieuw item'."));
    }
    layout.appendChild(ed);
    root.appendChild(layout);
  }

  // ══════════════════════════════════════════════
  //  GUI-ONTWERPER (gedeeld)
  // ══════════════════════════════════════════════

  function mountGuiEditor(container, gui, opts) {
    opts = opts || {};
    GuiDesign.ensureIds(gui);
    let selected = null;
    let editor = null;

    const rebuild = () => {
      container.innerHTML = "";
      const wrap = el("div", { class: "gui-editor" });
      const left = el("div", {});
      const right = el("div", { class: "gui-side" });

      // canvas
      const holder = el("div");
      left.appendChild(holder);
      editor = GuiDesign.mountEditor(holder, gui, {
        onSelect: (e2) => { selected = e2; renderSide(); },
        onChange: () => { State.save(); renderSide(); }
      });

      // opties
      const optsRow = el("div", { class: "card mt", style: "margin-bottom:8px" },
        el("div", { class: "row" },
          field("Modus", selectInput(
            [["crafting", "Werkbank (3×3, recepten werken)"], ["free", "Vrij (eigen logica)"]],
            gui.mode,
            (v) => {
              if (v === "crafting") {
                const issues = GuiDesign.validateCrafting({ ...gui, mode: "crafting" });
                if (issues.length) {
                  toast("Naar werkbank-modus: " + issues[0], "err");
                  render(); // select terugzetten
                  return;
                }
              }
              gui.mode = v; changed();
            })),
          field("Breedte", textInput(gui.width, (v) => { gui.width = Math.max(176, parseInt(v, 10) || 176); State.save(); editor && editor.redraw(); }, { type: "number", min: "176" })),
          field("Hoogte", textInput(gui.height, (v) => { gui.height = Math.max(166, parseInt(v, 10) || 166); State.save(); editor && editor.redraw(); }, { type: "number", min: "166" })),
          field("Achtergrond", el("input", { class: "mc-input", type: "color", value: gui.bgColor || "#C6C6C6", oninput: (e) => { gui.bgColor = e.target.value; State.save(); editor && editor.redraw(); } }))
        )
      );
      left.appendChild(optsRow);

      if (gui.mode === "crafting") {
        left.appendChild(el("div", { class: "inline-info small",
          text: "🧰 Werkbank-modus: de 3×3-grid, uitvoer en speler-inventaris werken meteen met vanilla recepten. Sleep ze desnoods heen – de code volgt je ontwerp." }));
        const issues = GuiDesign.validateCrafting(gui);
        issues.forEach((i) => left.appendChild(el("div", { class: "inline-warn", text: "⚠ " + i })));
      }

      // zijpaneel: elementen
      right.appendChild(el("h3", { class: "card-title", text: "Elementen" }));
      const addRow = el("div", { class: "tool-row mb" },
        addElemBtn("🔲 Invoer-slot", () => addElement({ type: "slot", role: "input", index: nextFreeIndex(gui, "input"), size: 16 })),
        addElemBtn("📦 Uitvoer", () => addElement({ type: "slot", role: "output", index: 0, size: 16 })),
        addElemBtn("🎒 Speler-slot", () => addElement({ type: "slot", role: "player", index: nextFreePlayerIndex(gui), size: 16 })),
        addElemBtn("🏷️ Label", () => addElement({ type: "label", x: 20, y: 20, text: "Nieuw label", color: "#404040" })),
        addElemBtn("🔘 Knop", () => addElement({ type: "button", x: 40, y: 120, w: 90, h: 20, text: "Knop" })),
        addElemBtn("➡️ Pijl", () => addElement({ type: "arrow", x: 90, y: 30, w: 22, h: 16 })),
        addElemBtn("⬛ Vlak", () => addElement({ type: "rect", x: 10, y: 10, w: 60, h: 30, style: "panel" }))
      );
      right.appendChild(addRow);

      const elemList = el("div", { class: "gui-elem-list" });
      right.appendChild(elemList);
      const props = el("div", { class: "mt" });
      right.appendChild(props);

      function addElemBtn(label, fn) {
        return el("button", { class: "mc-btn mc-btn-ghost mc-btn-xs", text: label, onclick: fn });
      }

      function addElement(proto) {
        const e2 = Object.assign({ _id: uid("el"), x: 20, y: 20, order: gui.elements.length }, proto);
        if (e2.type === "label" && !e2.x) e2.x = 20;
        // overlap vermijden: licht verschuiven
        let guard = 0;
        while (GuiDesign.hitTest(gui, e2.x + 4, e2.y + 4) && guard++ < 30) {
          e2.x += 8; e2.y += 8;
          if (e2.x > gui.width - 40) { e2.x = 10; e2.y += 40; }
        }
        gui.elements.push(e2);
        selected = e2;
        State.save();
        renderSide();
        editor && editor.redraw();
      }

      function renderSide() {
        elemList.innerHTML = "";
        if (!gui.elements.length) {
          elemList.appendChild(el("div", { class: "dim small", text: "Nog geen elementen – voeg er hierboven één toe." }));
        }
        gui.elements.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach((e2) => {
          const row = el("div", { class: "gui-elem" + (selected === e2 ? " active" : ""), onclick: () => { selected = e2; editor && editor.setSelected(e2._id); renderSide(); } },
            el("span", { class: "ge-ico", text: { slot: "🔲", label: "🏷️", button: "🔘", arrow: "➡️", rect: "⬛" }[e2.type] || "?" }),
            el("span", { text: GuiDesign.elemLabel(e2) + (e2.type === "label" ? ` · "${e2.text}"` : "") }),
            el("span", { class: "ge-del", title: "Verwijder", text: "✕", onclick: (ev) => {
              ev.stopPropagation();
              gui.elements = gui.elements.filter((x) => x !== e2);
              if (selected === e2) selected = null;
              State.save();
              renderSide();
              editor && editor.redraw();
            } })
          );
          elemList.appendChild(row);
        });

        props.innerHTML = "";
        if (selected && gui.elements.includes(selected)) {
          props.appendChild(GuiDesign.renderProps(gui, selected, () => {
            State.save();
            editor && editor.redraw();
          }));
        } else {
          props.appendChild(el("div", { class: "dim small", text: "Selecteer een element om het aan te passen." }));
        }
      }

      renderSide();
      wrap.append(left, right);
      container.appendChild(wrap);
    };

    rebuild();
    return { rebuild };
  }

  function nextFreeIndex(gui, role) {
    const used = new Set(gui.elements.filter((e) => e.type === "slot" && e.role === role).map((e) => e.index));
    const max = role === "input" ? 8 : 0;
    for (let i = 0; i <= max; i++) if (!used.has(i)) return i;
    return max;
  }

  function nextFreePlayerIndex(gui) {
    const used = new Set(gui.elements.filter((e) => e.type === "slot" && e.role === "player").map((e) => e.index));
    for (let i = 9; i < 36; i++) if (!used.has(i)) return i;
    for (let i = 0; i < 9; i++) if (!used.has(i)) return i;
    return 9;
  }

  // ══════════════════════════════════════════════
  //  WERKBANKEN
  // ══════════════════════════════════════════════

  function addWorkstation() {
    const p = cur();
    if (!p) return showCreateProject();
    const nameIn = el("input", { class: "mc-input", value: "Mijn Werkbank" });
    const blockSel = el("select", { class: "mc-input" },
      el("option", { value: "__new", text: "➕ Nieuw blok maken (aanbevolen)" }),
      ...p.blocks.map((b) => el("option", { value: b.id, text: `${b.name} (${b.id})` }))
    );
    const content = el("div", {},
      field("Naam van de werkbank", nameIn),
      field("Blok", blockSel, "De werkbank is een blok met een GUI erin.")
    );
    openModal("Nieuwe werkbank", content, [
      { label: "Annuleren", cls: "mc-btn-ghost", onClick: closeModal },
      {
        label: "➕ Maken", cls: "mc-btn-green", onClick: () => {
          const name = nameIn.value.trim() || "Werkbank";
          let blockId = blockSel.value;
          if (blockId === "__new") {
            const base = sanitizeId(name);
            let n = 1, id = base;
            const ids = new Set([...p.blocks.map((b) => b.id), ...p.items.map((i) => i.id)]);
            while (ids.has(id)) id = base + "_" + (++n);
            blockId = id;
            p.blocks.push({
              id: blockId, name, hardness: 2.5, requiresTool: true, tool: "axe", light: 0,
              genStyle: "hout", genColor: "#b87333",
              pixels: TextureKit.generate("hout", "#b87333", Math.floor(Math.random() * 99999))
            });
          }
          // nieuw GUI met standaard werkbank-layout
          let gid = sanitizeId(name);
          let gn = 1;
          while (p.guis.some((g) => g.id === gid)) gid = sanitizeId(name) + "_" + (++gn);
          const gui = {
            id: gid, name, width: 176, height: 166, mode: "crafting",
            bgColor: "#C6C6C6",
            elements: State.defaultCraftingElements(name)
          };
          GuiDesign.ensureIds(gui);
          p.guis.push(gui);
          const ws = { id: gid + "_ws", name, blockId, guiId: gid, recipes: [] };
          let wid = ws.id, n2 = 1;
          while (p.workstations.some((w) => w.id === wid)) wid = ws.id + "_" + (++n2);
          ws.id = wid;
          p.workstations.push(ws);
          State.ui.sel.workstations = ws.id;
          closeModal();
          goto("workstations");
          toast(`Werkbank "${name}" gemaakt – ontwerp GUI en recepten!`, "ok");
        }
      }
    ]);
  }

  function renderWorkstations(root) {
    const p = cur();
    sectionTitle("Werkbanken", "Blok + typische Minecraft-GUI + recepten. Alles zelf ontwerpbaar.").forEach((n) => root.appendChild(n));

    const sel = p.workstations.find((w) => w.id === State.ui.sel.workstations) || p.workstations[0];
    if (sel) State.ui.sel.workstations = sel.id;

    const layout = el("div", { style: "display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap" });
    const list = el("div", { style: "width:250px;min-width:220px" },
      el("button", { class: "mc-btn mc-btn-green mb", style: "width:100%", text: "➕ Nieuwe werkbank", onclick: addWorkstation })
    );
    if (!p.workstations.length) list.appendChild(emptyState("🛠️", "Nog geen werkbanken."));
    p.workstations.forEach((w) => {
      list.appendChild(el("div", { class: "list-item" + (sel === w ? " active" : ""), onclick: () => { State.ui.sel.workstations = w.id; render(); } },
        el("div", { class: "li-icon", text: "🛠️" }),
        el("div", {},
          el("div", { class: "li-name", text: w.name }),
          el("div", { class: "li-sub", text: `${(w.recipes || []).length} recepten` })
        )
      ));
    });
    layout.appendChild(list);

    const ed = el("div", { class: "card", style: "flex:1;min-width:460px" });
    if (sel) {
      const gui = State.getGui(p, sel.guiId);
      const block = p.blocks.find((b) => b.id === sel.blockId);

      ed.appendChild(el("div", { class: "row mb" },
        el("h3", { class: "card-title", style: "margin:0", text: sel.name }),
        el("span", { class: "badge badge-gold", text: "🧱 " + (block ? block.id : "geen blok") }),
        el("span", { class: "badge badge-blue", text: "🖼️ " + (gui ? gui.id : "geen GUI") }),
        el("span", { class: "spacer" }),
        el("button", {
          class: "mc-btn mc-btn-red mc-btn-xs", text: "🗑 Verwijder werkbank",
          onclick: () => confirmDelete(sel.name, () => {
            p.workstations = p.workstations.filter((x) => x !== sel);
            if (gui) p.guis = p.guis.filter((g) => g.id !== gui.id);
            State.ui.sel.workstations = null;
            changed();
          })
        })
      ));

      ed.appendChild(field("Naam", textInput(sel.name, (v) => {
        sel.name = v;
        if (gui) gui.name = v;
        const b2 = p.blocks.find((b) => b.id === sel.blockId);
        if (b2) b2.name = v;
        State.save(); updateChrome();
      })));

      // tabs
      const tabs = el("div", { class: "tabs" });
      const body = el("div");
      let active = State.ui.wsTab || "gui";
      const setTab = (t) => { active = t; State.ui.wsTab = t; draw(); };
      const mkTab = (id, label) => el("button", { class: "tab" + (active === id ? " active" : ""), text: label, onclick: () => setTab(id) });

      function draw() {
        tabs.innerHTML = "";
        tabs.append(mkTab("gui", "🖼️ GUI-ontwerp"), mkTab("recipes", "🍳 Recepten"), mkTab("block", "🧱 Blok"));
        body.innerHTML = "";
        if (active === "gui") {
          if (gui) mountGuiEditor(body, gui);
          else body.appendChild(emptyState("🖼️", "Geen GUI gekoppeld."));
        } else if (active === "recipes") {
          renderRecipes(body, p, sel);
        } else if (active === "block") {
          if (block) {
            body.appendChild(el("div", { class: "grid2" },
              field("Bloknaam", textInput(block.name, (v) => { block.name = v; State.save(); updateChrome(); })),
              field("Hardheid", textInput(block.hardness, (v) => { block.hardness = parseFloat(v) || 0; State.save(); }, { type: "number", step: "0.1" }))
            ));
            body.appendChild(field("Textuur", el("div")));
            const tex = el("div");
            body.appendChild(tex);
            TextureKit.mountEditor(tex, { size: 16, pixels: block.pixels, onChange: (px) => { block.pixels = px; State.save(); } });
            body.appendChild(el("div", { class: "inline-info small", text: "💡 Meer opties (gereedschap, licht) vind je in de tab 🧱 Blokken." }));
          } else body.appendChild(emptyState("🧱", "Geen blok gekoppeld."));
        }
        tabs.querySelectorAll(".tab").forEach((t, i) => {
          t.className = "tab" + (["gui", "recipes", "block"][i] === active ? " active" : "");
        });
      }
      ed.append(tabs, body);
      draw();
    } else {
      ed.appendChild(emptyState("🛠️", "Maak je eerste werkbank – compleet met GUI en recepten.", "➕ Nieuwe werkbank", addWorkstation));
    }
    layout.appendChild(ed);
    root.appendChild(layout);
  }

  // ── Recepten ──
  function renderRecipes(container, p, ws) {
    container.appendChild(el("div", { class: "row mb" },
      el("div", { class: "dim small", text: "Recepten worden datapack-JSON in je mod. Kies uit vormgebonden, vormloos, smelten of smoken." }),
      el("span", { class: "spacer" }),
      el("button", { class: "mc-btn mc-btn-green mc-btn-sm", text: "➕ Recept", onclick: () => showRecipeEditor(p, ws, null) })
    ));

    if (!(ws.recipes || []).length) {
      container.appendChild(emptyState("🍳", "Nog geen recepten. Voeg er één toe om items te kunnen maken in de werkbank."));
      return;
    }

    ws.recipes.forEach((r, idx) => {
      const card = el("div", { class: "recipe-card" },
        el("div", { class: "recipe-mini" },
          miniGrid(r),
          el("span", { text: "➡" }),
          el("span", { class: "recipe-cell-mini gold", text: `${r.output || "?"}${r.count > 1 ? " ×" + r.count : ""}` }),
          el("span", { class: "dim", text: RecipesKit.summary(r) }),
          el("span", { class: "spacer" }),
          el("button", { class: "mc-btn mc-btn-ghost mc-btn-xs", text: "✏️", onclick: () => showRecipeEditor(p, ws, idx) }),
          deleteBtn(() => confirmDelete("recept " + (idx + 1), () => { ws.recipes.splice(idx, 1); changed(); }), "🗑")
        )
      );
      container.appendChild(card);
    });
  }

  function miniGrid(r) {
    const wrap = el("span", { class: "row", style: "gap:3px" });
    if (r.type === "smelting" || r.type === "smoking") {
      wrap.appendChild(el("span", { class: "recipe-cell-mini", text: shortIng(r.cells[0]) }));
      return wrap;
    }
    for (let i = 0; i < 9; i++) {
      wrap.appendChild(el("span", { class: "recipe-cell-mini" + (r.cells[i] ? " gold" : ""), text: r.cells[i] ? shortIng(r.cells[i]) : "" }));
    }
    return wrap;
  }

  function shortIng(ing) {
    if (!ing) return "";
    const s = ing.replace(/^#/, "#").split(":").pop();
    return s.length > 9 ? s.slice(0, 8) + "…" : s;
  }

  function allIngredientSuggestions(p) {
    const list = new Set(RecipesKit.VANILLA_ITEMS);
    RecipesKit.VANILLA_TAGS.forEach((t) => list.add("#" + t));
    p.items.forEach((i) => { list.add(i.id); list.add(p.meta.modId + ":" + i.id); });
    p.blocks.forEach((b) => { list.add(b.id); list.add(p.meta.modId + ":" + b.id); });
    return [...list];
  }

  function showRecipeEditor(p, ws, idx) {
    const isNew = idx === null;
    const r = isNew
      ? { type: "shaped", cells: RecipesKit.emptyCells(), output: "", count: 1, xp: 0.1 }
      : clone(ws.recipes[idx]);

    const listId = "ing_" + uid("l");
    const sugg = allIngredientSuggestions(p);

    const typeSel = selectInput([
      ["shaped", "Vormgebonden (3×3 met patroon)"],
      ["shapeless", "Vormloos (alleen ingrediënten)"],
      ["smelting", "Smelen (oven)"],
      ["smoking", "Smoken (rokerij)"]
    ], r.type, (v) => { r.type = v; redrawBody(); });

    const outIn = textInput(r.output, (v) => { r.output = v.trim(); }, {
      list: "items_" + listId, placeholder: "bijv. minecraft:diamond_of mijn_item"
    });
    const countIn = textInput(r.count, (v) => { r.count = Math.max(1, Math.min(64, parseInt(v, 10) || 1)); }, { type: "number", min: "1", max: "64", style: "width:80px" });

    const body = el("div");

    function pickIngredient(cellIdx) {
      const cur2 = r.cells[cellIdx] || "";
      const inp = el("input", { class: "mc-input", value: cur2, list: listId, placeholder: "bijv. minecraft:stick of #minecraft:planks" });
      openModal(cellIdx === 0 && (r.type === "smelting" || r.type === "smoking") ? "Ingrediënt kiezen" : `Slot ${cellIdx + 1} – ingrediënt`,
        el("div", {},
          field("Ingrediënt (item-id of #tag)", inp),
          el("div", { class: "hint", text: "Typ een id, of kies uit de lijst. # = tag (bijv. #minecraft:planks)." })
        ),
        [
          { label: "Leeg", cls: "mc-btn-ghost", onClick: () => { r.cells[cellIdx] = null; closeModal(); redrawBody(); } },
          {
            label: "OK", cls: "mc-btn-green", onClick: () => {
              const v = inp.value.trim();
              r.cells[cellIdx] = v || null;
              closeModal();
              redrawBody();
            }
          }
        ]);
      setTimeout(() => inp.focus(), 50);
    }

    function redrawBody() {
      body.innerHTML = "";
      if (r.type === "smelting" || r.type === "smoking") {
        const cell = el("div", { class: "craft-cell" + (r.cells[0] ? " filled" : ""), style: "width:110px;height:110px", onclick: () => pickIngredient(0) },
          r.cells[0] ? shortIng(r.cells[0]) : "klik");
        body.appendChild(el("div", { class: "row mb" }, el("span", { class: "dim small", text: "Ingrediënt:" }), cell));
        body.appendChild(el("div", { class: "inline-info small", text: r.type === "smoking" ? "Wordt in de rokerij gebruikt (100 ticks)." : "Wordt in de oven gebruikt (200 ticks)." }));
      } else {
        const grid = el("div", { class: "craft-grid" });
        for (let i = 0; i < 9; i++) {
          grid.appendChild(el("div", {
            class: "craft-cell" + (r.cells[i] ? " filled" : ""),
            text: r.cells[i] ? shortIng(r.cells[i]) : "",
            title: r.cells[i] || "leeg – klik om te vullen",
            onclick: () => pickIngredient(i)
          }));
        }
        body.appendChild(el("div", { class: "row mb", style: "align-items:flex-start" },
          grid,
          el("div", { class: "small dim", style: "max-width:260px" },
            el("div", { text: "Klik op een vak om een ingrediënt te kiezen." }),
            r.type === "shaped"
              ? el("div", { text: "Vormgebonden: het patroon wordt automatisch uitgesneden (lege rijen/kolommen weg)." })
              : el("div", { text: "Vormloos: volgorde maakt niet uit." })
          )
        ));
      }
    }
    redrawBody();

    const datalist = el("datalist", { id: listId }, ...sugg.map((s) => el("option", { value: s })));
    const datalistItems = el("datalist", { id: "items_" + listId }, ...sugg.map((s) => el("option", { value: s })));

    const content = el("div", {},
      datalist, datalistItems,
      field("Recept-type", typeSel),
      body,
      el("div", { class: "sep" }),
      el("div", { class: "row", style: "align-items:flex-end" },
        field("Uitvoer (item-id)", outIn),
        field("Aantal", countIn)
      ),
      el("div", { id: "recipeIssues" })
    );

    openModal(isNew ? "Nieuw recept" : "Recept bewerken", content, [
      { label: "Annuleren", cls: "mc-btn-ghost", onClick: closeModal },
      {
        label: "💾 Opslaan", cls: "mc-btn-green", onClick: () => {
          r.output = (r.output || "").trim();
          const issues = RecipesKit.validate(r);
          if (issues.length) {
            const box = $("#recipeIssues");
            if (box) { box.innerHTML = ""; issues.forEach((i) => box.appendChild(el("div", { class: "inline-warn", text: "⚠ " + i }))); }
            return;
          }
          // projectnaam → namespaced id
          r.output = State.resolveItemId(p, r.output);
          r.cells = r.cells.map((c) => {
            if (!c || c.includes(":") || c.startsWith("#")) return c;
            const resolved = State.resolveItemId(p, c);
            return resolved;
          });
          if (isNew) ws.recipes.push(r);
          else ws.recipes[idx] = r;
          closeModal();
          changed();
          toast("Recept opgeslagen ✔", "ok");
        }
      }
    ]);
  }

  // ══════════════════════════════════════════════
  //  GUI's (los)
  // ══════════════════════════════════════════════

  function addGui() {
    const p = cur();
    if (!p) return showCreateProject();
    const nameIn = el("input", { class: "mc-input", value: "Nieuw GUI" });
    const modeSel = selectInput([["free", "Vrij (bijv. voor een mob)"], ["crafting", "Werkbank (3×3)"]], "free", () => {});
    openModal("Nieuw GUI", el("div", {},
      field("Naam", nameIn),
      field("Type", modeSel)
    ), [
      { label: "Annuleren", cls: "mc-btn-ghost", onClick: closeModal },
      {
        label: "➕ Maken", cls: "mc-btn-green", onClick: () => {
          const name = nameIn.value.trim() || "GUI";
          let gid = sanitizeId(name), n = 1;
          while (p.guis.some((g) => g.id === gid)) gid = sanitizeId(name) + "_" + (++n);
          const gui = modeSel.value === "crafting"
            ? State.defaultGui(name)
            : { id: gid, name, width: 176, height: 166, mode: "free", bgColor: "#C6C6C6", elements: [
              { type: "label", x: 8, y: 6, text: name, color: "#404040", _id: uid("el"), order: 0 }
            ] };
          gui.id = gid;
          GuiDesign.ensureIds(gui);
          p.guis.push(gui);
          State.ui.sel.guis = gui.id;
          closeModal();
          goto("guis");
          toast("GUI gemaakt!", "ok");
        }
      }
    ]);
  }

  function renderGuis(root) {
    const p = cur();
    sectionTitle("GUI's", "Minecraft-achtige schermen: sleep slots, knoppen en labels precies waar je ze hebben wilt.").forEach((n) => root.appendChild(n));

    const sel = p.guis.find((g) => g.id === State.ui.sel.guis) || p.guis[0];
    if (sel) State.ui.sel.guis = sel.id;

    const layout = el("div", { style: "display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap" });
    const list = el("div", { style: "width:250px;min-width:220px" },
      el("button", { class: "mc-btn mc-btn-green mb", style: "width:100%", text: "➕ Nieuw GUI", onclick: addGui })
    );
    if (!p.guis.length) list.appendChild(emptyState("🖼️", "Nog geen GUI's. Werkbanken krijgen er automatisch één."));
    p.guis.forEach((g) => {
      const ownerWs = p.workstations.find((w) => w.guiId === g.id);
      list.appendChild(el("div", { class: "list-item" + (sel === g ? " active" : ""), onclick: () => { State.ui.sel.guis = g.id; render(); } },
        el("div", { class: "li-icon", text: ownerWs ? "🛠️" : "🖼️" }),
        el("div", {},
          el("div", { class: "li-name", text: g.name }),
          el("div", { class: "li-sub", text: (g.mode === "crafting" ? "werkbank" : "vrij") + (ownerWs ? " · " + ownerWs.name : "") })
        )
      ));
    });
    layout.appendChild(list);

    const ed = el("div", { class: "card", style: "flex:1;min-width:460px" });
    if (sel) {
      const ownerWs = p.workstations.find((w) => w.guiId === sel.id);
      ed.appendChild(el("div", { class: "row mb" },
        el("h3", { class: "card-title", style: "margin:0", text: sel.name }),
        ownerWs ? el("span", { class: "badge badge-gold", text: "van werkbank: " + ownerWs.name }) : el("span", { class: "badge badge-blue", text: "los GUI" }),
        el("span", { class: "spacer" }),
        el("button", {
          class: "mc-btn mc-btn-red mc-btn-xs", text: "🗑 Verwijder GUI",
          onclick: () => confirmDelete(sel.name, () => {
            p.guis = p.guis.filter((g) => g.id !== sel.id);
            p.workstations.forEach((w) => { if (w.guiId === sel.id) w.guiId = null; });
            p.mobs.forEach((m) => { if (m.guiId === sel.id) m.guiId = null; });
            State.ui.sel.guis = null;
            changed();
          })
        })
      ));
      ed.appendChild(field("Naam", textInput(sel.name, (v) => { sel.name = v; State.save(); updateChrome(); })));
      mountGuiEditor(ed, sel);
    } else {
      ed.appendChild(emptyState("🖼️", "Klik op '+ Nieuw GUI'."));
    }
    layout.appendChild(ed);
    root.appendChild(layout);
  }

  // ══════════════════════════════════════════════
  //  MOBS
  // ══════════════════════════════════════════════

  function addMob() {
    const p = cur();
    if (!p) return showCreateProject();
    let n = p.mobs.length + 1;
    const ids = new Set(p.mobs.map((m) => m.id));
    let id = "mijn_mob_" + n;
    while (ids.has(id)) { n++; id = "mijn_mob_" + n; }
    const m = {
      id, name: "Mijn Mob " + n, kind: "passive", behavior: "", triggers: [],
      health: 20, speed: 0.25, damage: 3, width: 0.9, height: 1.4,
      colors: { primary: "#e8b866", secondary: "#d0c0a0" },
      guiId: null, drops: []
    };
    p.mobs.push(m);
    State.ui.sel.mobs = m.id;
    goto("mobs");
    toast("Mob toegevoegd!", "ok");
  }

  function renderMobs(root) {
    const p = cur();
    sectionTitle("Mobs", "Gewone mobs én mobs met een eigen interactie-GUI (rechtermuisklik).").forEach((n) => root.appendChild(n));

    const sel = p.mobs.find((m) => m.id === State.ui.sel.mobs) || p.mobs[0];
    if (sel) State.ui.sel.mobs = sel.id;

    const layout = el("div", { style: "display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap" });
    const list = el("div", { style: "width:250px;min-width:220px" },
      el("button", { class: "mc-btn mc-btn-green mb", style: "width:100%", text: "➕ Nieuwe mob", onclick: addMob })
    );
    if (!p.mobs.length) list.appendChild(emptyState("🐷", "Nog geen mobs."));
    p.mobs.forEach((m) => {
      list.appendChild(el("div", { class: "list-item" + (sel === m ? " active" : ""), onclick: () => { State.ui.sel.mobs = m.id; render(); } },
        el("div", { class: "li-icon", text: m.kind === "hostile" ? "💀" : "🐷" }),
        el("div", {},
          el("div", { class: "li-name", text: m.name }),
          el("div", { class: "li-sub", text: (m.kind === "hostile" ? "hostiel" : "vreedzaam") + (m.guiId ? " · met GUI" : "") })
        )
      ));
    });
    layout.appendChild(list);

    const ed = el("div", { class: "card", style: "flex:1;min-width:430px" });
    if (sel) {
      ed.appendChild(el("h3", { class: "card-title", text: "Mob bewerken" }));
      ed.appendChild(el("div", { class: "grid2" },
        field("Naam", textInput(sel.name, (v) => { sel.name = v; State.save(); updateChrome(); })),
        field("ID", textInput(sel.id, (v) => { sel.id = sanitizeId(v); State.ui.sel.mobs = sel.id; changed(); })),
        field("Soort", selectInput([["passive", "Vreedzaam"], ["hostile", "Hostiel"]], sel.kind, (v) => { sel.kind = v; changed(); })),
        field("Interactie-GUI (rechtsklik)", selectInput(
          [["", "— geen GUI —"], ...p.guis.map((g) => [g.id, g.name + " (" + g.mode + ")"])],
          sel.guiId || "", (v) => { sel.guiId = v || null; changed(); }),
          "Kies een ontworpen GUI die opent bij rechtsklik.")
      ));
      ed.appendChild(el("div", { class: "grid3" },
        field("❤ Leven", textInput(sel.health, (v) => { sel.health = parseFloat(v) || 1; State.save(); }, { type: "number", min: "1", step: "1" })),
        field("🏃 Snelheid", textInput(sel.speed, (v) => { sel.speed = parseFloat(v) || 0; State.save(); }, { type: "number", step: "0.05" })),
        field("⚔ Aanval", textInput(sel.damage, (v) => { sel.damage = parseFloat(v) || 0; State.save(); }, { type: "number", step: "0.5" }))
      ));
      // 🧊 3D-preview met loop-animatie (voorvertoning)
      const m3dCard = el("div", { class: "card" });
      m3dCard.appendChild(el("div", { class: "row" },
        el("strong", { text: "🧊 3D-preview met animatie" }),
        el("span", { class: "dim small", text: "voorvertoning – in-game gebruikt Minecraft het varkensmodel met je kleuren; echte ledemaat-animaties komen via ai-code/animaties/" })
      ));
      const m3dStage = el("div", { class: "m3d-stage" });
      const m3dRig = el("div", { class: "m3d-rig" });
      const m3dParts = ["m3d-head", "m3d-body", "m3d-leg m3d-leg1", "m3d-leg m3d-leg2", "m3d-leg m3d-leg3", "m3d-leg m3d-leg4"]
        .map((c) => el("div", { class: "m3d " + c }));
      m3dRig.append(...m3dParts);
      m3dRig.style.setProperty("--c1", sel.colors.primary || "#55ff55");
      m3dRig.style.setProperty("--c2", sel.colors.secondary || "#222222");
      m3dStage.appendChild(m3dRig);
      let m3dPlaying = State.ui.m3dPlay !== false;
      const m3dBtn = el("button", {
        class: "mc-btn mc-btn-sm", text: m3dPlaying ? "⏸ Pauze" : "▶ Lopen",
        onclick: (e) => {
          m3dPlaying = !m3dPlaying;
          State.ui.m3dPlay = m3dPlaying;
          m3dRig.classList.toggle("playing", m3dPlaying);
          e.target.textContent = m3dPlaying ? "⏸ Pauze" : "▶ Lopen";
        }
      });
      if (m3dPlaying) m3dRig.classList.add("playing");
      m3dCard.appendChild(el("div", { class: "row mb" }, m3dBtn, el("span", { class: "dim small", text: "draaiende kop + loop-ende poten" })));
      m3dCard.appendChild(m3dStage);
      ed.appendChild(m3dCard);

      ed.appendChild(el("div", { class: "grid2" },
        field("Breedte", textInput(sel.width, (v) => { sel.width = parseFloat(v) || 0.9; State.save(); }, { type: "number", step: "0.1" })),
        field("Hoogte", textInput(sel.height, (v) => { sel.height = parseFloat(v) || 1.4; State.save(); }, { type: "number", step: "0.1" }))
      ));

      // ── gedrag & animatie-triggers ──
      ed.appendChild(el("div", { class: "sep" }));
      ed.appendChild(el("h3", { class: "card-title", text: "🎬 Gedrag & animatie-triggers" }));
      if (!sel.triggers) sel.triggers = [];
      ed.appendChild(el("div", { class: "grid2" },
        field("Gedrag-preset", selectInput([
          ["", "— standaard (varken) —"],
          ["dwaalt", "🚶 Dwaalt rustig rond"],
          ["jager", "🗡 Jager (valt spelers aan)"],
          ["vlucht", "🏃 Vlucht bij gevaar"],
          ["springer", "🦘 Springerig & aanvallend"]
        ], sel.behavior || "", (v) => { sel.behavior = v; changed(); }),
          "Genereert extra AI-doelen in de Java-code (mojmap én yarn)."),
        field("Zelf coderen?", el("span", { class: "dim small", text: "De export bevat kant-en-klare trigger-haksels in de entity-klasse + een prompt-bestand in ai-code/animaties/ – plak het in de chat en de AI schrijft je animatie." }))
      ));
      const trigToggle = (tid) => (v) => {
        if (v && !sel.triggers.includes(tid)) sel.triggers.push(tid);
        if (!v) sel.triggers = sel.triggers.filter((x) => x !== tid);
        State.save();
      };
      ed.appendChild(el("div", { class: "mt" },
        el("strong", { text: "Wanneer moet er iets gebeuren?" }),
        el("div", { class: "row", style: "flex-wrap:wrap;margin-top:4px" },
          checkInput("🌀 Bij spawn", sel.triggers.includes("spawn"), trigToggle("spawn")),
          checkInput("⚔ Bij aanval", sel.triggers.includes("attack"), trigToggle("attack")),
          checkInput("🖱 Bij rechtsklik", sel.triggers.includes("click"), trigToggle("click")),
          checkInput("⏱ Elke 5 sec", sel.triggers.includes("timer"), trigToggle("timer")),
          checkInput("💔 Bij laag leven", sel.triggers.includes("lowhp"), trigToggle("lowhp"))
        )
      ));
      ed.appendChild(el("div", { class: "grid2 mt" },
        field("🔊 Geluid bij triggers", selectInput([
          ["", "— standaard (varken-geluid) —"],
          ["vanilla:ENTITY_PIG_AMBIENT", "Varken (standaard)"],
          ["vanilla:ENTITY_CAT_AMBIENT", "Kat"],
          ["vanilla:ENTITY_WOLF_GROWL", "Wolf"],
          ["vanilla:ENTITY_ENDER_DRAGON_GROWL", "Enderdraak"],
          ["vanilla:ENTITY_RAVAGER_ROAR", "Ravager"],
          ["vanilla:ITEM_BELL_RING", "Klok"],
          ["vanilla:PLAYER_LEVELUP", "Level-up"],
          ...((p.sounds || []).map((s) => ["mod:" + s.id, "🔊 " + (s.naam || s.id) + " (eigen)"]))
        ], sel.triggerSound || "", (v) => { sel.triggerSound = v; State.save(); }), "speelt bij spawn-triggers"),
        field("✨ Partikel bij triggers", selectInput(
          [["", "— geen —"], ...PARTICLE_OPTS.map(([full, lbl]) => [full.replace("minecraft:", ""), lbl])],
          sel.triggerParticle || "", (v) => { sel.triggerParticle = v; State.save(); }), "rook/vlam bij spawn + timer")
      ));
      if ((sel.triggerSound || "").startsWith("mod:") || sel.triggerParticle) {
        ed.appendChild(el("div", { class: "small dim", text: "🔧 Wordt direct in de entity-klasse gegenereerd (spawn + elke 5 sec). Eigen geluiden komen uit jouw ModSounds." }));
      }

      // spawn-ei kleuren
      ed.appendChild(el("div", { class: "sep" }));
      ed.appendChild(el("h3", { class: "card-title", text: "Spawn-ei & drops" }));
      ed.appendChild(el("div", { class: "row" },
        field("Ei kleur 1", el("input", { class: "mc-input", type: "color", value: sel.colors.primary, oninput: (e) => { sel.colors.primary = e.target.value; State.save(); } })),
        field("Ei kleur 2", el("input", { class: "mc-input", type: "color", value: sel.colors.secondary, oninput: (e) => { sel.colors.secondary = e.target.value; State.save(); } }))
      ));

      // drops
      const dropWrap = el("div", { class: "mt" });
      const renderDrops = () => {
        dropWrap.innerHTML = "";
        dropWrap.appendChild(el("div", { class: "row mb" },
          el("strong", { text: "Drops:" }),
          el("span", { class: "dim small", text: sel.drops.length ? "" : "geen – de mob laat niets vallen" }),
          el("span", { class: "spacer" }),
          el("button", {
            class: "mc-btn mc-btn-ghost mc-btn-xs", text: "➕ Drop",
            onclick: () => { sel.drops.push({ id: "", count: 1, chance: 1 }); State.save(); renderDrops(); }
          })
        ));
        sel.drops.forEach((d, i) => {
          const dl = el("datalist", { id: "drops_" + i + uid("d") }, ...allIngredientSuggestions(p).map((s) => el("option", { value: s })));
          dropWrap.appendChild(el("div", { class: "row", style: "margin-bottom:6px" },
            dl,
            textInput(d.id, (v) => { d.id = v.trim(); State.save(); }, { list: dl.id, placeholder: "item-id", style: "flex:2" }),
            textInput(d.count, (v) => { d.count = Math.max(1, parseInt(v, 10) || 1); State.save(); }, { type: "number", min: "1", style: "width:70px" }),
            textInput(d.chance, (v) => { d.chance = Math.max(0, Math.min(1, parseFloat(v) || 0)); State.save(); }, { type: "number", min: "0", max: "1", step: "0.05", style: "width:80px", title: "kans 0-1" }),
            el("span", { class: "dim small", text: "kans" }),
            deleteBtn(() => { sel.drops.splice(i, 1); State.save(); renderDrops(); }, "×")
          ));
        });
      };
      renderDrops();
      ed.appendChild(dropWrap);

      ed.appendChild(el("div", { class: "row mt" },
        el("button", {
          class: "mc-btn mc-btn-red mc-btn-sm", text: "🗑 Verwijder mob",
          onclick: () => confirmDelete(sel.name, () => {
            p.mobs = p.mobs.filter((x) => x !== sel);
            State.ui.sel.mobs = null;
            changed();
          })
        })
      ));
    } else {
      ed.appendChild(emptyState("🐷", "Klik op '+ Nieuwe mob'."));
    }
    layout.appendChild(ed);
    root.appendChild(layout);
  }

  // ══════════════════════════════════════════════
  //  VERHAAL (storyline)
  // ══════════════════════════════════════════════

  const TRIGGER_LABELS = {
    join: "🟢 Speler logt in",
    kill: "⚔ Iets wordt gedood",
    block: "🧱 Blok wordt rechtsgeklikt",
    item: "🗡 Item wordt rechtsgeklikt",
    location: "📍 Speler komt ergens"
  };
  const ACTION_LABELS = {
    message: "💬 Bericht tonen",
    give: "🎁 Item geven",
    gui: "🖼️ GUI openen",
    spawn: "🐷 Mob spawnen",
    weather: "🌧 Weer veranderen",
    time: "🕐 Tijd veranderen",
    command: "⌨ Commando uitvoeren",
    geluid: "🔊 Geluid afspelen",
    partikel: "✨ Partikel tonen",
    next: "➡ Volgend hoofdstuk"
  };

  function addChapter() {
    const p = cur();
    if (!p) return showCreateProject();
    const n = p.story.chapters.length + 1;
    p.story.chapters.push({
      id: "hoofdstuk_" + n,
      title: "Hoofdstuk " + n,
      events: []
    });
    changed();
  }

  function renderStory(root) {
    const p = cur();
    sectionTitle("Verhaal", "Schrijf een storyline: triggers (gebeurtenissen) → acties. Alles wordt Java-code in je mod.").forEach((n) => root.appendChild(n));

    renderSoundsCard(root, p);
    renderQuestsCard(root, p);

    root.appendChild(el("div", { class: "row mb" },
      el("button", { class: "mc-btn mc-btn-green", text: "➕ Hoofdstuk", onclick: addChapter }),
      el("span", { class: "dim small", text: "Hoofdstukken lopen op volgorde: eerst de triggers van hoofdstuk 1, daarna pas hoofdstuk 2." })
    ));

    if (!p.story.chapters.length) {
      root.appendChild(emptyState("📖", "Nog geen verhaal. Maak je eerste hoofdstuk!"));
      return;
    }

    p.story.chapters.forEach((ch, ci) => {
      const card = el("div", { class: "chapter-card" });
      card.appendChild(el("div", { class: "chapter-head" },
        el("div", { class: "chapter-num", text: String(ci + 1) }),
        textInput(ch.title, (v) => { ch.title = v; State.save(); }, { style: "flex:1;font-weight:bold" }),
        textInput(ch.id, (v) => { ch.id = sanitizeId(v); State.save(); }, { style: "width:160px", title: "interne id" }),
        deleteBtn(() => confirmDelete(ch.title, () => { p.story.chapters.splice(ci, 1); changed(); }), "🗑")
      ));

      // events
      (ch.events || []).forEach((ev, ei) => {
        card.appendChild(renderEvent(p, ch, ev, ei));
      });

      card.appendChild(el("button", {
        class: "mc-btn mc-btn-ghost mc-btn-sm mt", text: "➕ Gebeurtenis (trigger + acties)",
        onclick: () => {
          ch.events.push({ id: uid("ev"), trigger: { type: "join" }, actions: [{ type: "message", text: "Hallo wereld!" }] });
          changed();
        }
      }));
      root.appendChild(card);
    });
  }

  const PARTICLE_OPTS = [
    ["minecraft:flame", "🔥 Vlam"], ["minecraft:smoke", "💨 Rook"], ["minecraft:heart", "❤ Hartjes"],
    ["minecraft:crit", "💥 Kritiek-stukjes"], ["minecraft:enchanted_hit", "✨ Verhekst-stukjes"],
    ["minecraft:happy_villager", "😊 Blije dorpeling"], ["minecraft:end_rod", "🌟 Eindstaafje"],
    ["minecraft:snowflake", "❄ Sneeuwvlok"], ["minecraft:electric_spark", "⚡ Vonk"],
    ["minecraft:portal", "🌀 Portaal"], ["minecraft:underwater", "💧 Waterbel"],
    ["minecraft:note", "🎵 Noot"], ["minecraft:slime", "🟩 Slijm"]
  ];

  function renderSoundsCard(root, p) {
    if (!p.sounds) p.sounds = [];
    const card = el("div", { class: "card" });
    card.appendChild(el("h3", { class: "card-title", text: "🔊 Geluiden" }));
    card.appendChild(el("div", { class: "small dim", text: "Acht kant-en-klare geluiden (klik ▶ om te horen). ➕ zet ze in je mod als .ogg + geluids-event – daarna bruikbaar in verhaal-acties en mob-triggers." }));
    const row = el("div", { class: "row", style: "flex-wrap:wrap;margin-top:6px" });
    Object.keys(SoundLib || {}).forEach((k) => {
      row.appendChild(el("button", {
        class: "mc-btn mc-btn-sm mc-btn-ghost", text: "▶ " + SoundLib[k].naam,
        onclick: () => { try { new Audio("data:audio/ogg;base64," + SoundLib[k].b64).play(); } catch (e) { /* ok */ } }
      }));
      row.appendChild(el("button", {
        class: "mc-btn mc-btn-sm", text: "➕", title: "aan mod toevoegen",
        onclick: () => {
          let n = 1, id = k;
          while (p.sounds.some((x) => x.id === id)) id = k + "_" + (++n);
          p.sounds.push({ id, naam: SoundLib[k].naam, lib: k });
          changed();
        }
      }));
    });
    card.appendChild(row);
    if (p.sounds.length) {
      p.sounds.forEach((snd, i) => {
        card.appendChild(el("div", { class: "row", style: "margin-top:6px" },
          el("span", { text: "🔊" }),
          textInput(snd.id, (v) => { snd.id = sanitizeId(v); State.save(); }, { style: "width:150px;font-weight:bold", title: "id in de mod" }),
          el("span", { class: "dim small", text: `${p.meta.modId}:${snd.id} · ${snd.naam || snd.lib}` }),
          el("span", { class: "spacer" }),
          deleteBtn(() => { p.sounds.splice(i, 1); changed(); }, "🗑")
        ));
      });
    }
    root.appendChild(card);
  }

  function renderQuestsCard(root, p) {
    if (!p.quests) p.quests = [];
    const card = el("div", { class: "card" });
    card.appendChild(el("h3", { class: "card-title", text: "🏆 Quests (advancements)" }));
    card.appendChild(el("div", { class: "small dim", text: "Doelen die Minecraft toont als prestatie (toast + prestatiescherm). Met beloning: XP en/of een commando." }));
    p.quests.forEach((q, i) => {
      const box = el("div", { class: "quest-box" });
      box.appendChild(el("div", { class: "grid2" },
        field("Naam", textInput(q.title, (v) => { q.title = v; State.save(); }, { style: "font-weight:bold" })),
        field("ID", textInput(q.id, (v) => { q.id = sanitizeId(v); State.save(); }, { title: "interne id" }))
      ));
      box.appendChild(el("div", { class: "grid3" },
        field("Wanneer?", selectInput([
          ["direct", "✔ Direct (zodra laden)"],
          ["item", "🎒 Item verzamelen"],
          ["kill", "⚔ Mob verslaan"]
        ], q.type || "direct", (v) => { q.type = v; changed(); })),
        field("Icoon-item", textInput(q.icon || "", (v) => { q.icon = v.trim(); State.save(); }, { placeholder: "minecraft:diamond" })),
        field("Kader", selectInput([["task", "Taak"], ["goal", "Doel"], ["challenge", "Uitdaging"]], q.frame || "task", (v) => { q.frame = v; State.save(); }))
      ));
      if (q.type === "item") {
        box.appendChild(field("Benodigd item-id", textInput(q.itemId || "", (v) => { q.itemId = v.trim(); State.save(); }, { placeholder: "minecraft:diamond" })));
      }
      if (q.type === "kill") {
        box.appendChild(field("Te verslaan (entity-id)", textInput(q.entityId || "", (v) => { q.entityId = v.trim(); State.save(); }, { placeholder: "minecraft:zombie" })));
      }
      box.appendChild(el("div", { class: "grid3" },
        field("Omschrijving", textInput(q.desc || "", (v) => { q.desc = v; State.save(); })),
        field("XP", textInput(q.xp || 0, (v) => { q.xp = Math.max(0, parseInt(v, 10) || 0); State.save(); }, { type: "number", min: "0" })),
        field("Bonus-commando", textInput(q.cmd || "", (v) => { q.cmd = v; State.save(); }, { placeholder: "give @s minecraft:diamond" }))
      ));
      box.appendChild(el("div", { class: "row" },
        deleteBtn(() => confirmDelete(q.title || q.id, () => { p.quests.splice(i, 1); changed(); }), "🗑 Verwijder quest")
      ));
      card.appendChild(box);
    });
    card.appendChild(el("button", {
      class: "mc-btn mc-btn-sm mt", text: "➕ Quest",
      onclick: () => {
        p.quests.push({ id: uid("quest"), title: "Nieuwe quest", desc: "", type: "direct", icon: "minecraft:stone", frame: "task", xp: 10, cmd: "" });
        changed();
      }
    }));
    root.appendChild(card);
  }

  function renderEvent(p, ch, ev, ei) {
    const card = el("div", { class: "event-card" });
    card.appendChild(el("div", { class: "row mb" },
      el("span", { class: "event-trigger", text: "ALS: " + (TRIGGER_LABELS[ev.trigger.type] || ev.trigger.type) }),
      el("span", { class: "spacer" }),
      deleteBtn(() => { ch.events.splice(ei, 1); changed(); }, "×")
    ));

    // trigger kiezer
    const tSel = selectInput(Object.entries(TRIGGER_LABELS), ev.trigger.type, (v) => {
      ev.trigger = { type: v };
      changed();
    });
    card.appendChild(el("div", { class: "row mb" },
      el("span", { class: "dim small", text: "Trigger:" }), tSel,
      triggerParams(p, ev)
    ));

    // acties
    const actionWrap = el("div", {});
    ev.actions.forEach((a, ai) => {
      const chip = el("span", { class: "action-chip" },
        el("span", { text: (ACTION_LABELS[a.type] || a.type) + actionSummary(p, a) }),
        el("span", { class: "x", text: "✕", title: "verwijder", onclick: () => { ev.actions.splice(ai, 1); changed(); } })
      );
      actionWrap.appendChild(chip);
      actionWrap.appendChild(actionInputs(p, a));
    });
    card.appendChild(actionWrap);

    card.appendChild(el("div", { class: "row mt" },
      el("span", { class: "dim small", text: "DOE:" }),
      selectInput([["", "+ actie kiezen..."], ...Object.entries(ACTION_LABELS)], "", (v) => {
        if (!v) return;
        const defaults = {
          message: { type: "message", text: "Bericht hier..." },
          give: { type: "give", item: "", count: 1 },
          gui: { type: "gui", gui: (p.guis[0] || {}).id || "" },
          spawn: { type: "spawn", entity: "minecraft:zombie", count: 1 },
          weather: { type: "weather", state: "clear" },
          time: { type: "time", state: "day" },
          geluid: { type: "geluid", sound: "minecraft:block.note_block.pling", volume: 1, pitch: 1 },
          partikel: { type: "partikel", particle: "minecraft:flame", count: 20 },
          command: { type: "command", cmd: "say Hallo!" },
          next: { type: "next" }
        };
        ev.actions.push(defaults[v]);
        changed();
      })
    ));
    return card;
  }

  function triggerParams(p, ev) {
    const t = ev.trigger;
    const wrap = el("span", { class: "row" });
    const upd = () => State.save();
    if (t.type === "kill" || t.type === "block" || t.type === "item") {
      const key = t.type === "kill" ? "entity" : t.type === "block" ? "block" : "item";
      const dl = el("datalist", { id: uid("tl") });
      const sugg = t.type === "kill"
        ? ["minecraft:zombie", "minecraft:skeleton", "minecraft:cow", "minecraft:creeper", "minecraft:ender_dragon", ...p.mobs.map((m) => p.meta.modId + ":" + m.id)]
        : t.type === "block"
          ? ["minecraft:chest", "minecraft:door", "minecraft:lever", ...p.blocks.map((b) => p.meta.modId + ":" + b.id)]
          : ["minecraft:stick", "minecraft:diamond", ...p.items.map((i) => p.meta.modId + ":" + i.id)];
      sugg.forEach((s) => dl.appendChild(el("option", { value: s })));
      wrap.appendChild(dl);
      wrap.appendChild(textInput(t[key] || "", (v) => { t[key] = v.trim(); upd(); },
        { list: dl.id, placeholder: key + "-id", style: "width:230px" }));
    }
    if (t.type === "location") {
      ["x", "y", "z", "r"].forEach((k) => {
        wrap.appendChild(textInput(t[k] ?? (k === "r" ? 4 : 0), (v) => { t[k] = parseFloat(v) || 0; upd(); },
          { type: "number", style: "width:75px", title: k === "r" ? "straal" : k, placeholder: k }));
      });
    }
    if (t.type === "join") {
      wrap.appendChild(el("span", { class: "dim small", text: "geen extra voorwaarden" }));
    }
    return wrap;
  }

  function actionSummary(p, a) {
    if (a.type === "message") return ": " + (a.text || "").slice(0, 30);
    if (a.type === "give") return ": " + (a.count || 1) + "× " + (a.item || "?");
    if (a.type === "gui") return ": " + (a.gui || "?");
    if (a.type === "spawn") return ": " + (a.count || 1) + "× " + (a.entity || "?");
    if (a.type === "weather" || a.type === "time") return ": " + (a.state || "");
    if (a.type === "command") return ": " + (a.cmd || "").slice(0, 30);
    if (a.type === "geluid") return ": " + (a.sound || "").split(":").pop();
    if (a.type === "partikel") return ": " + (a.particle || "").split(":").pop() + " ×" + (a.count || 20);
    return "";
  }

  function actionInputs(p, a) {
    const wrap = el("div", { style: "margin:2px 0 6px 12px" });
    const upd = () => State.save();
    if (a.type === "message") {
      wrap.appendChild(textInput(a.text, (v) => { a.text = v; upd(); }, { placeholder: "Tekst die de speler ziet...", style: "max-width:420px" }));
    } else if (a.type === "give") {
      const dl = el("datalist", { id: uid("al") }, ...allIngredientSuggestions(p).map((s) => el("option", { value: s })));
      wrap.appendChild(el("span", { class: "row" }, dl,
        textInput(a.item, (v) => { a.item = v.trim(); upd(); }, { list: dl.id, placeholder: "item-id", style: "width:230px" }),
        textInput(a.count, (v) => { a.count = Math.max(1, parseInt(v, 10) || 1); upd(); }, { type: "number", min: "1", style: "width:70px" })));
    } else if (a.type === "gui") {
      wrap.appendChild(selectInput(p.guis.map((g) => [g.id, g.name]), a.gui, (v) => { a.gui = v; upd(); }));
    } else if (a.type === "geluid") {
      const opts = [
        ["minecraft:block.note_block.pling", "🔸 Pling (vanilla)"],
        ["minecraft:entity.player.levelup", "🌟 Level-up (vanilla)"],
        ["minecraft:ui.toast.challenge_complete", "🏆 Quest-taart (vanilla)"],
        ["minecraft:block.anvil.land", "🔨 Aambeeld (vanilla)"],
        ...((p.sounds || []).map((s) => [`${p.meta.modId}:${s.id}`, `🔊 ${s.naam || s.id} (eigen)`]))
      ];
      const cur = opts.some((o) => o[0] === a.sound) ? a.sound : opts[0][0];
      wrap.appendChild(el("span", { class: "row" },
        selectInput(opts, cur, (v) => { a.sound = v; upd(); }),
        textInput(a.volume ?? 1, (v) => { a.volume = parseFloat(v) || 1; upd(); }, { type: "number", step: "0.1", style: "width:70px", title: "volume" }),
        textInput(a.pitch ?? 1, (v) => { a.pitch = parseFloat(v) || 1; upd(); }, { type: "number", step: "0.1", style: "width:70px", title: "toonhoogte" })
      ));
    } else if (a.type === "partikel") {
      const cur = PARTICLE_OPTS.some((o) => o[0] === a.particle) ? a.particle : "minecraft:flame";
      wrap.appendChild(el("span", { class: "row" },
        selectInput(PARTICLE_OPTS, cur, (v) => { a.particle = v; upd(); }),
        textInput(a.count ?? 20, (v) => { a.count = Math.max(1, parseInt(v, 10) || 20); upd(); }, { type: "number", min: "1", style: "width:70px", title: "aantal" })
      ));
    } else if (a.type === "spawn") {
      wrap.appendChild(el("span", { class: "row" },
        textInput(a.entity, (v) => { a.entity = v.trim(); upd(); }, { placeholder: "entity-id", style: "width:230px" }),
        textInput(a.count, (v) => { a.count = Math.max(1, parseInt(v, 10) || 1); upd(); }, { type: "number", min: "1", style: "width:70px" })));
    } else if (a.type === "weather") {
      wrap.appendChild(selectInput([["clear", "Helder"], ["rain", "Regen"], ["thunder", "Onweer"]], a.state, (v) => { a.state = v; upd(); }));
    } else if (a.type === "time") {
      wrap.appendChild(selectInput([["day", "Dag"], ["night", "Nacht"]], a.state, (v) => { a.state = v; upd(); }));
    } else if (a.type === "command") {
      wrap.appendChild(textInput(a.cmd, (v) => { a.cmd = v; upd(); }, { placeholder: "say Hallo!", style: "max-width:420px" }));
    }
    return wrap;
  }

  // ══════════════════════════════════════════════
  //  AI-CODE / GITHUB
  // ══════════════════════════════════════════════

  function renderGithub(root) {
    const p = cur();
    sectionTitle("AI-code / GitHub", "Laat de AI code voor je schrijven en haal ze met één knop in je mod.").forEach((n) => root.appendChild(n));

    root.appendChild(aiFolderReminderCard(p));

    const gh = p.github;

    // ── verbinding ──
    root.appendChild(el("div", { class: "card" },
      el("h3", { class: "card-title", text: "1 · Koppel je GitHub-repo" }),
      el("div", { class: "grid3" },
        field("Eigenaar", textInput(gh.owner, (v) => { gh.owner = v.trim(); State.save(); }, { placeholder: "Ven1x-cloud" })),
        field("Repository", textInput(gh.repo, (v) => { gh.repo = v.trim(); State.save(); }, { placeholder: "blockymoding" })),
        field("Branch", textInput(gh.branch, (v) => { gh.branch = v.trim(); State.save(); }, { placeholder: "main" }))
      ),
      el("div", { class: "grid2" },
        field("Map met AI-codes", textInput(gh.folder, (v) => { gh.folder = v.trim().replace(/^\/+|\/+$/g, ""); State.save(); }, { placeholder: "ai-code of mods/jouw-mod" })),
        field("Token (pushen & privé-repos)", textInput(gh.token, (v) => { gh.token = v; State.save(); }, { type: "password", placeholder: "ghp_... (alleen lokaal bewaard)" }))
      ),
      el("div", { class: "inline-info small", text: "💡 Lezen kan zonder token (publieke repo); pushen én privé-repos hebben de token nodig – die blijft alleen op deze computer. Per mod een eigen map? Vul die in bij 'Map met AI-codes' (bv. mods/mijn-mod/ai-code)." })
    ));

    // ── codes ophalen ──
    const browseCard = el("div", { class: "card" },
      el("h3", { class: "card-title", text: "2 · Codes ophalen & alles pushen" })
    );
    const browseBody = el("div");
    browseCard.appendChild(browseBody);

    const renderBrowse = async (path) => {
      browseBody.innerHTML = "";
      const pathNow = path !== undefined ? path : (State.ui.githubPath || "");
      State.ui.githubPath = pathNow;
      const info = el("div", { class: "row mb" },
        el("span", { class: "dim small", text: `Map: ${gh.folder ? gh.folder + (pathNow ? "/" + pathNow : "") : "(repo-root)"}` }),
        el("span", { class: "spacer" }),
        el("button", {
          class: "mc-btn mc-btn-blue mc-btn-sm", text: "🔄 Codes ophalen (alles)",
          onclick: async () => await pullAll(pathNow)
        })
      );
      browseBody.appendChild(info);

      const status = el("div", { class: "dim small", text: "Laden bij GitHub..." });
      browseBody.appendChild(status);

      try {
        const cfg = { ...gh, folder: "" };
        const fullPath = [gh.folder, pathNow].filter(Boolean).join("/");
        const entries = await GitHubKit.list(cfg, fullPath);
        status.innerHTML = "";
        if (pathNow) {
          browseBody.insertBefore(el("button", {
            class: "mc-btn mc-btn-ghost mc-btn-xs mb", text: "⬆ Omhoog",
            onclick: () => renderBrowse(parentPath(pathNow))
          }), status.nextSibling);
        }
        if (!entries.length) {
          browseBody.appendChild(el("div", { class: "inline-warn", text: "Lege map. Maak 'm op GitHub (Add file → Create new file) of vraag de AI – zie de herinnering hierboven." }));
          return;
        }
        let fileCount = 0;
        for (const e of entries) {
          if (e.type === "dir") {
            browseBody.appendChild(el("div", { class: "gh-file" },
              el("span", { text: "📁" }),
              el("span", { class: "path", text: e.name + "/" }),
              el("span", { class: "acts" },
                el("button", { class: "mc-btn mc-btn-ghost mc-btn-xs", text: "Open", onclick: () => renderBrowse(e.path.replace(new RegExp("^" + escapeRe(fullPath) + "/?"), "")) }))
            ));
          } else {
            fileCount++;
            const short = pathNow && e.path.startsWith(fullPath + "/") ? e.path.slice(fullPath.length + 1) : e.name;
            browseBody.appendChild(el("div", { class: "gh-file" },
              el("span", { text: fileIcon(e.name) }),
              el("span", { class: "path", text: short }),
              el("span", { class: "dim", text: fmtBytes(e.size) }),
              el("span", { class: "acts" },
                el("button", {
                  class: "mc-btn mc-btn-blue mc-btn-xs", text: "⬇ Invoegen",
                  onclick: async () => {
                    try {
                      const content = await GitHubKit.fetchFile(cfg, e);
                      addAiFile(p, gh.folder ? `${pathNow ? pathNow + "/" : ""}${e.name}` : e.path, content);
                      toast(`${e.name} toegevoegd aan je mod ✔`, "ok");
                      renderAiFiles();
                    } catch (err) { toast(String(err.message || err), "err"); }
                  }
                }))
            ));
          }
        }
        if (!fileCount && !entries.some((e) => e.type === "dir")) {
          browseBody.appendChild(el("div", { class: "inline-warn", text: "Geen bestanden gevonden in deze map." }));
        }
      } catch (err) {
        status.innerHTML = "";
        browseBody.appendChild(el("div", { class: "inline-warn", text: "❌ " + (err.message || err) }));
        browseBody.appendChild(el("div", { class: "small dim", text: "Controleer eigenaar/repo/branch, of gebruik een token voor privé-repos." }));
      }
    };

    async function pullAll(pathNow) {
      const cfg = { ...gh };
      const fullPath = [gh.folder, pathNow].filter(Boolean).join("/");
      toast("Codes ophalen bij GitHub...", "info");
      try {
        const files = await GitHubKit.fetchTree(cfg, fullPath, { maxFiles: 150 });
        if (!files.length) { toast("Geen bestanden gevonden – bestaat de map wel?", "err"); return; }
        files.forEach((f) => addAiFile(p, pathNow ? `${pathNow}/${f.path}` : f.path, f.content));
        p.checklist.aiFolder = true;
        State.save();
        toast(`${files.length} bestand(en) toegevoegd aan je mod! 🎉`, "ok");
        renderAiFiles();
        updateChrome();
      } catch (err) {
        toast(String(err.message || err), "err");
      }
    }

    browseCard.appendChild(el("div", { class: "row mt" },
      el("button", { class: "mc-btn mc-btn-blue", text: "🔄 Map tonen bij GitHub", onclick: () => renderBrowse(State.ui.githubPath || "") }),
      el("button", { class: "mc-btn mc-btn-green", text: "📤 Alles pushen naar GitHub", onclick: () => pushToGitHub() })
    ));
    browseCard.appendChild(el("div", { class: "small dim mt", text: "📤 Push zet project.json + code + texturen in mods/" + p.meta.modId + "/ (één commit op branch " + (gh.branch || "main") + "). Heeft de token uit kaart 1 nodig." }));
    root.appendChild(browseCard);

    // ── ingevoegde bestanden ──
    const filesCard = el("div", { class: "card" },
      el("h3", { class: "card-title", text: "3 · Ingevoegde AI-bestanden (in je mod)" })
    );
    const filesBody = el("div");
    filesCard.appendChild(filesBody);

    function addAiFile(proj, path, content) {
      const clean = String(path).replace(/^\/+/, "").replace(/^ai-code\//, "");
      const existing = (proj.aiFiles || []).find((f) => f.path === clean);
      if (existing) existing.content = content;
      else proj.aiFiles.push({ path: clean, content, importedAt: Date.now() });
      State.save();
    }

    function renderAiFiles() {
      filesBody.innerHTML = "";
      if (!p.aiFiles.length) {
        filesBody.appendChild(emptyState("🤖", "Nog geen codes ingevoegd. Gebruik de knoppen hierboven, of laat de AI code in je GitHub-map zetten."));
        return;
      }
      p.aiFiles.forEach((f, i) => {
        filesBody.appendChild(el("div", { class: "gh-file" },
          el("span", { text: fileIcon(f.path) }),
          el("span", { class: "path", text: f.path }),
          el("span", { class: "dim", text: fmtBytes((f.content || "").length) }),
          el("span", { class: "acts" },
            el("button", {
              class: "mc-btn mc-btn-ghost mc-btn-xs", text: "👁 Bekijk",
              onclick: () => openModal(f.path,
                el("pre", { class: "code-view", text: f.content }),
                [{ label: "Sluiten", cls: "mc-btn-ghost", onClick: closeModal }])
            }),
            deleteBtn(() => { p.aiFiles.splice(i, 1); State.save(); renderAiFiles(); }, "🗑"))
        ));
      });
      filesBody.appendChild(el("div", { class: "inline-info mt small", text: "Deze bestanden komen in de map ai-code/ van je geëxporteerde mod. Extra code-koppeling aan registraties? Vraag het de AI." }));
    }
    renderAiFiles();
    root.appendChild(filesCard);

    // open de GitHub-map direct bij het openen van deze tab
    renderBrowse(State.ui.githubPath || "");
  }

  function parentPath(path) {
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function fileIcon(name) {
    if (name.endsWith(".java")) return "☕";
    if (name.endsWith(".json")) return "🟨";
    if (name.endsWith(".md")) return "📝";
    if (name.endsWith(".png")) return "🖼️";
    if (name.endsWith(".gradle") || name.endsWith(".properties")) return "⚙️";
    return "📄";
  }

  // ══════════════════════════════════════════════
  //  EXPORTEREN
  // ══════════════════════════════════════════════

  function validateProject(p) {
    const warnings = [];
    if (!p.meta.name) warnings.push("De mod heeft geen naam.");
    const seen = new Map();
    [...p.blocks.map((b) => ["blok", b.id]), ...p.items.map((i) => ["item", i.id]), ...p.mobs.map((m) => ["mob", m.id])]
      .forEach(([soort, id]) => {
        if (seen.has(id)) warnings.push(`Dubbele id "${id}" (${seen.get(id)} én ${soort}) – Minecraft accepteert dat niet.`);
        else seen.set(id, soort);
      });
    p.guis.forEach((g) => {
      if (g.mode === "crafting") GuiDesign.validateCrafting(g).forEach((i) => warnings.push(`GUI "${g.name}": ${i}`));
    });
    (p.workstations || []).forEach((w) => {
      if (!w.guiId) warnings.push(`Werkbank "${w.name}" heeft geen GUI meer.`);
      if (!w.blockId) warnings.push(`Werkbank "${w.name}" heeft geen blok.`);
      (w.recipes || []).forEach((r, i) => {
        RecipesKit.validate(r).forEach((is) => warnings.push(`Recept ${i + 1} van "${w.name}": ${is}`));
      });
    });
    return warnings;
  }

  async function pushToGitHub() {
    const p = cur();
    if (!p) { showCreateProject(); return; }
    const gh = p.github;
    if (!gh.owner || !gh.repo) {
      toast("Vul eerst eigenaar + repo in (kaart 1).", "err");
      return;
    }
    if (!gh.token || !gh.token.trim()) {
      openModal("GitHub-token nodig", el("div", {},
        el("p", { text: "Pushen (schrijven) kan niet zonder token. Eén keer instellen:" }),
        el("pre", { class: "codeblock", text: "1. Open github.com \u2192 je avatar \u2192 Settings\n2. Links: Developer settings \u2192 Personal access tokens \u2192 Tokens (classic)\n3. Generate new token (classic) \u2192 noem hem bv. blockymod \u2192 vink 'repo' aan \u2192 Generate\n4. Kopieer de token (ghp_...) en plak hem hierboven in het veld Token" }),
        el("p", { class: "dim small", text: "De token blijft alleen op deze computer en komt nooit in de push terecht." })
      ), [{ label: "Begrepen", cls: "mc-btn-green", onClick: closeModal }]);
      return;
    }
    const branch = gh.branch || "main";
    const target = `mods/${p.meta.modId}`;
    toast("Project wordt voorbereid...", "info");
    try {
      const { textFiles, textures } = Exporters.exportPlan(p);
      const files = [];
      const safe = Object.assign({}, p, { github: Object.assign({}, gh, { token: "" }) });
      files.push({
        path: target + "/project.json",
        data: JSON.stringify({ format: "blockymod-studio/1", pushedAt: new Date().toISOString(), project: safe }, null, 2)
      });
      for (const [path, content] of Object.entries(textFiles)) {
        files.push({ path: target + "/" + path, data: content });
      }
      let done = 0;
      for (const job of textures) {
        try {
          files.push({ path: target + "/" + job.path, data: await job.render() });
        } catch (err) {
          console.warn("Textuur overslaan:", job.path, err);
        }
        done++;
        if (done % 5 === 0) toast(`Texturen renderen... ${done}/${textures.length}`, "info");
      }
      toast(`Pushen naar ${branch}: ${files.length} bestanden...`, "info");
      const res = await GitHubKit.pushFiles(gh, files,
        `📦 ${p.meta.name} v${p.meta.version} – alles uit BlockyMod Studio (${files.length} bestanden)`);
      toast(`${res.count} bestanden gepusht naar ${res.branch} in ${target}/ 🎉`, "ok");
    } catch (err) {
      console.error(err);
      toast("Pushen mislukt: " + (err.message || err), "err");
    }
  }

  async function exportMod() {
    const p = cur();
    if (!p) { showCreateProject(); return; }

    const warnings = validateProject(p);
    const doExport = async () => {
      closeModal();
      toast("Mod wordt gebouwd...", "info");
      try {
        const { textFiles, textures } = Exporters.exportPlan(p);
        const files = [];
        const root = p.meta.modId + "/";
        const safeProj = Object.assign({}, p, { github: Object.assign({}, p.github || {}, { token: "" }) });
        files.push({
          path: root + "project.json",
          data: JSON.stringify({ format: "blockymod-studio/1", exportedAt: new Date().toISOString(), project: safeProj }, null, 2)
        });
        for (const [path, content] of Object.entries(textFiles)) {
          files.push({ path: root + path, data: content });
        }
        let done = 0;
        for (const job of textures) {
          try {
            const bytes = await job.render();
            files.push({ path: root + job.path, data: bytes });
          } catch (err) {
            console.warn("Textuur mislukt:", job.path, err);
          }
          done++;
          if (done % 5 === 0) toast(`Texturen renderen... ${done}/${textures.length}`, "info");
        }
        const zipBytes = Zip.build(files);
        const name = `${p.meta.modId}-v${p.meta.version}.zip`;

        if (window.blockymoding && window.blockymoding.isDesktop) {
          const res = await window.blockymoding.saveZip(name, bytesToBase64(zipBytes));
          if (res && res.ok) toast(`Mod opgeslagen: ${res.path} (${fmtBytes(zipBytes.length)}) 🎉`, "ok");
          else if (res && res.canceled) toast("Export geannuleerd.", "info");
          else toast("Opslaan mislukt: " + (res && res.error || "onbekend"), "err");
        } else {
          downloadBlob(new Blob([zipBytes], { type: "application/zip" }), name);
          toast(`Mod geëxporteerd: ${name} (${fmtBytes(zipBytes.length)}) 🎉`, "ok");
        }
      } catch (err) {
        console.error(err);
        toast("Export mislukt: " + (err.message || err), "err");
      }
    };

    if (warnings.length) {
      openModal(`${warnings.length} waarschuwing(en)`, el("div", {},
        el("p", { class: "dim small", text: "De mod is te exporteren, maar let op dit:" }),
        ...warnings.slice(0, 12).map((w) => el("div", { class: "inline-warn", text: "⚠ " + w })),
        warnings.length > 12 ? el("div", { class: "dim small", text: `… en ${warnings.length - 12} meer` }) : null
      ), [
        { label: "Toch exporteren", cls: "mc-btn-green", onClick: doExport },
        { label: "Eerst fixen", cls: "mc-btn-ghost", onClick: closeModal }
      ]);
    } else {
      await doExport();
    }
  }

  $("#btnExport").addEventListener("click", () => exportMod());
  const importBtn = $("#btnImport");
  if (importBtn) importBtn.addEventListener("click", () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".zip,application/zip";
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      try {
        const buf = new Uint8Array(await f.arrayBuffer());
        const entries = await Zip.read(buf);
        const pj = entries.find((e) => e.path.endsWith("project.json"));
        if (!pj) throw new Error("Geen project.json in deze ZIP. Exporteer de mod opnieuw met deze versie van BlockyMod Studio.");
        const raw = JSON.parse(new TextDecoder().decode(pj.data));
        const proj = raw.project || raw;
        const copy = State.importProject(proj);
        toast(`Geïmporteerd: ${copy.meta.name} 🎉`, "ok");
        goto("dashboard");
      } catch (err) {
        console.error(err);
        toast("Importeren mislukt: " + (err.message || err), "err");
      }
    };
    inp.click();
  });

  // ══════════════════════════════════════════════
  //  Start
  // ══════════════════════════════════════════════

  updateChrome();
  render();

  // Exports voor tests / console
  window.BMS = { State, Exporters, Zip, GuiDesign, TextureKit, RecipesKit, GitHubKit, render };
})();
