// ── GUI-ontwerper: tekenen, raken-test, slepen, export ──
"use strict";

const GuiDesign = (() => {
  const SLOT_BG = "#8B8B8B";
  const SLOT_HI = "#373737";
  const SLOT_LO = "#FFFFFF";

  function ensureIds(gui) {
    gui.elements.forEach((e, i) => {
      if (!e._id) e._id = uid("el");
      if (e.order === undefined) e.order = i;
    });
    return gui;
  }

  function byZ(gui) {
    // latere elementen liggen "bovenop"
    return [...gui.elements].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  // ── Tekensubprimitieven ──
  function drawBevel(ctx, x, y, w, h, light, dark) {
    ctx.fillStyle = light;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = dark;
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  function drawSlot(ctx, x, y) {
    // x,y = contentpositie (zoals vanilla Slot.x) → achtergrond op x-1,y-1 (18×18)
    ctx.fillStyle = SLOT_BG;
    ctx.fillRect(x - 1, y - 1, 18, 18);
    ctx.fillStyle = SLOT_HI;
    ctx.fillRect(x - 1, y - 1, 18, 1);
    ctx.fillRect(x - 1, y - 1, 1, 18);
    ctx.fillStyle = SLOT_LO;
    ctx.fillRect(x - 1, y + 16, 18, 1);
    ctx.fillRect(x + 16, y - 1, 1, 18);
  }

  function drawArrow(ctx, x, y, w, h) {
    w = w || 22; h = h || 16;
    const cy = Math.floor(y + h / 2);
    ctx.fillStyle = "#555555";
    ctx.fillRect(x, cy - 3, w - 8, 6);
    // punt
    ctx.beginPath();
    ctx.moveTo(x + w - 8, cy - 7);
    ctx.lineTo(x + w, cy);
    ctx.lineTo(x + w - 8, cy + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SLOT_BG;
    ctx.fillRect(x, cy - 2, w - 9, 4);
    ctx.beginPath();
    ctx.moveTo(x + w - 8, cy - 5);
    ctx.lineTo(x + w - 2, cy);
    ctx.lineTo(x + w - 8, cy + 5);
    ctx.closePath();
    ctx.fill();
  }

  function drawRect(ctx, e) {
    switch (e.style) {
      case "dark": ctx.fillStyle = "#373737"; break;
      case "light": ctx.fillStyle = "#DBDBDB"; break;
      case "black": ctx.fillStyle = "#000000"; break;
      case "custom": ctx.fillStyle = e.color || "#c6c6c6"; break;
      case "panel":
      default:
        ctx.fillStyle = e.color || "#C6C6C6";
        ctx.fillRect(e.x, e.y, e.w, e.h);
        drawBevel(ctx, e.x, e.y, e.w, e.h, "#FFFFFF", "#555555");
        return;
    }
    ctx.fillRect(e.x, e.y, e.w, e.h);
  }

  function drawButtonShape(ctx, x, y, w, h, hover) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = hover ? "#8a8a8a" : "#6f6f6f";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  function labelWidth(e) {
    const scale = e.scale || 1;
    return String(e.text || "").length * 6 * scale;
  }

  function drawLabel(ctx, e) {
    const scale = e.scale || 1;
    ctx.font = `${8 * scale}px Consolas, monospace`;
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillText(e.text || "", e.x + scale, e.y + scale);
    ctx.fillStyle = e.color || "#404040";
    ctx.fillText(e.text || "", e.x, e.y);
  }

  /**
   * Teken een hele GUI.
   * opts: { forTexture:boolean, selectedId:string|null, hoverId:string|null }
   * - forTexture: geen labels/knoppen/selectiekaders (wordt door de game-code getekend)
   */
  function drawGui(ctx, gui, opts) {
    opts = opts || {};
    const w = gui.width, h = gui.height;

    // Achtergrond
    ctx.fillStyle = gui.bgColor || "#C6C6C6";
    ctx.fillRect(0, 0, w, h);
    // Rand-highlight zoals een Minecraft-venster
    drawBevel(ctx, 0, 0, w, h, "#FFFFFF", "#555555");

    for (const e of gui.elements) {
      switch (e.type) {
        case "slot": drawSlot(ctx, e.x, e.y); break;
        case "rect": drawRect(ctx, e); break;
        case "arrow": drawArrow(ctx, e.x, e.y, e.w, e.h); break;
        case "button":
          if (opts.forTexture) break; // ButtonWidget tekent zichzelf in de game
          drawButtonShape(ctx, e.x, e.y, e.w || 100, e.h || 20, opts.hoverId === e._id);
          ctx.font = "13px Consolas, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "rgba(0,0,0,.5)";
          ctx.fillText(e.text || "", e.x + (e.w || 100) / 2 + 1, e.y + (e.h || 20) / 2 + 1);
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(e.text || "", e.x + (e.w || 100) / 2, e.y + (e.h || 20) / 2);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          break;
        case "label":
          if (opts.forTexture) break; // tekst wordt door de game getekend
          drawLabel(ctx, e);
          break;
      }
    }

    // Selectiekader
    if (!opts.forTexture && opts.selectedId) {
      const e = gui.elements.find((x) => x._id === opts.selectedId);
      if (e) {
        const box = boundsOf(e);
        ctx.strokeStyle = "#55aaff";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(box.x - 2.5, box.y - 2.5, box.w + 5, box.h + 5);
        ctx.setLineDash([]);
      }
    }
  }

  function boundsOf(e) {
    switch (e.type) {
      case "slot": return { x: e.x - 1, y: e.y - 1, w: 18, h: 18 };
      case "label": return { x: e.x, y: e.y, w: Math.max(labelWidth(e), 8), h: 10 * (e.scale || 1) };
      case "button": return { x: e.x, y: e.y, w: e.w || 100, h: e.h || 20 };
      case "rect": return { x: e.x, y: e.y, w: e.w, h: e.h };
      case "arrow": return { x: e.x, y: e.y, w: e.w || 22, h: e.h || 16 };
      default: return { x: e.x || 0, y: e.y || 0, w: 10, h: 10 };
    }
  }

  function hitTest(gui, px, py) {
    const els = byZ(gui).reverse();
    for (const e of els) {
      const b = boundsOf(e);
      if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) return e;
    }
    return null;
  }

  /** Render een GUI naar een off-screen canvas op schaal 1 (voor PNG-export) */
  function renderToCanvas(gui) {
    const c = document.createElement("canvas");
    c.width = gui.width;
    c.height = gui.height;
    const ctx = c.getContext("2d");
    drawGui(ctx, gui, { forTexture: true });
    return c;
  }

  /**
   * Monteer de interactieve ontwerper.
   * cb: { onSelect(el|null), onChange() }
   */
  function mountEditor(holder, gui, cb) {
    ensureIds(gui);
    let selectedId = null;
    let drag = null;

    const scale = Math.max(1, Math.min(3, Math.floor(560 / gui.width), Math.floor(460 / gui.height)));
    const canvas = el("canvas", { width: gui.width * scale, height: gui.height * scale });
    const ctx = canvas.getContext("2d");
    const canvasHolder = el("div", { class: "gui-canvas-holder" }, canvas);

    function redraw() {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(scale, scale);
      drawGui(ctx, gui, { selectedId });
      ctx.restore();
      // schaalmarkering
      scaleLabel.textContent = `Schaal ${scale}×  ·  ${gui.width}×${gui.height} px`;
    }

    const scaleLabel = el("div", { class: "gui-legend", style: "margin-top:6px" });

    function toGuiCoords(evt) {
      const rect = canvas.getBoundingClientRect();
      const cx = (evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
      const cy = (evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top;
      return { x: (cx / rect.width) * gui.width, y: (cy / rect.height) * gui.height };
    }

    function select(e2) {
      selectedId = e2 ? e2._id : null;
      cb.onSelect && cb.onSelect(e2 || null);
      redraw();
    }

    canvas.addEventListener("mousedown", (e) => {
      const p = toGuiCoords(e);
      const hit = hitTest(gui, p.x, p.y);
      select(hit);
      if (hit) {
        const b = boundsOf(hit);
        drag = { el: hit, dx: p.x - b.x, dy: p.y - b.y, moved: false };
      }
    });
    canvas.addEventListener("mousemove", (e) => {
      if (!drag) return;
      const p = toGuiCoords(e);
      const b = boundsOf(drag.el);
      let nx = Math.round(p.x - drag.dx - (b.x - (drag.el.x ?? b.x)));
      let ny = Math.round(p.y - drag.dy - (b.y - (drag.el.y ?? b.y)));
      // slots: herreken naar content-coördinaat
      if (drag.el.type === "slot") { nx += 1; ny += 1; }
      const snap = e.shiftKey ? 8 : 1;
      nx = Math.round(nx / snap) * snap;
      ny = Math.round(ny / snap) * snap;
      nx = Math.max(0, Math.min(gui.width - 4, nx));
      ny = Math.max(0, Math.min(gui.height - 4, ny));
      if (nx !== drag.el.x || ny !== drag.el.y) {
        drag.el.x = nx;
        drag.el.y = ny;
        drag.moved = true;
        redraw();
      }
    });
    window.addEventListener("mouseup", () => {
      if (drag && drag.moved) cb.onChange && cb.onChange();
      drag = null;
    });

    holder.innerHTML = "";
    const wrap = el("div", {},
      canvasHolder,
      scaleLabel,
      el("div", { class: "gui-legend", style: "margin-top:4px" },
        "Klik om te selecteren · slepen = verplaatsen · Shift+slepen = 8px grid")
    );
    holder.appendChild(wrap);

    redraw();
    return {
      redraw,
      getSelectedId: () => selectedId,
      setSelected(id) { selectedId = id; redraw(); }
    };
  }

  /** Verwijder-element-lijst + eigenschappenpaneel voor een geselecteerd element */
  function renderProps(gui, e2, onChange) {
    const wrap = el("div");
    if (!e2) {
      wrap.appendChild(el("div", { class: "dim small", text: "Selecteer een element in de GUI of lijst." }));
      return wrap;
    }

    function numField(label, key, min, max) {
      return el("div", { class: "field" },
        el("label", { text: label }),
        el("input", {
          class: "mc-input", type: "number", value: e2[key] ?? 0, min, max,
          oninput: (ev) => { e2[key] = parseInt(ev.target.value, 10) || 0; onChange(); }
        })
      );
    }

    wrap.appendChild(el("div", { class: "row mb" },
      el("span", { class: "badge badge-blue", text: elemLabel(e2) }),
      el("span", { class: "dim small", text: "x:" + e2.x + " y:" + e2.y })
    ));

    const pos = el("div", { class: "row", style: "gap:8px" },
      numField("X", "x", 0, 9999),
      numField("Y", "y", 0, 9999)
    );
    wrap.appendChild(pos);

    if (e2.type === "label") {
      wrap.appendChild(el("div", { class: "field" },
        el("label", { text: "Tekst" }),
        el("input", {
          class: "mc-input", value: e2.text || "",
          oninput: (ev) => { e2.text = ev.target.value; onChange(); }
        })
      ));
      wrap.appendChild(el("div", { class: "field" },
        el("label", { text: "Kleur" }),
        el("input", {
          class: "mc-input", type: "color", value: e2.color || "#404040",
          oninput: (ev) => { e2.color = ev.target.value; onChange(); }
        })
      ));
    }
    if (e2.type === "button") {
      wrap.appendChild(el("div", { class: "field" },
        el("label", { text: "Knop-tekst" }),
        el("input", {
          class: "mc-input", value: e2.text || "",
          oninput: (ev) => { e2.text = ev.target.value; onChange(); }
        })
      ));
      wrap.appendChild(el("div", { class: "row" },
        numField("Breedte", "w", 20, 600),
        numField("Hoogte", "h", 10, 200)
      ));
    }
    if (e2.type === "rect") {
      const styleSel = el("select", { class: "mc-input",
        onchange: (ev) => { e2.style = ev.target.value; onChange(); } },
        ...["panel", "dark", "light", "black", "custom"].map((s) =>
          el("option", { value: s, text: s, selected: e2.style === s }))
      );
      wrap.appendChild(el("div", { class: "field" }, el("label", { text: "Stijl" }), styleSel));
      if (e2.style === "custom" || e2.style === "panel") {
        wrap.appendChild(el("div", { class: "field" },
          el("label", { text: "Kleur" }),
          el("input", {
            class: "mc-input", type: "color", value: e2.color || "#c6c6c6",
            oninput: (ev) => { e2.color = ev.target.value; onChange(); }
          })
        ));
      }
      wrap.appendChild(el("div", { class: "row" },
        numField("Breedte", "w", 1, 999),
        numField("Hoogte", "h", 1, 999)
      ));
    }
    if (e2.type === "arrow") {
      wrap.appendChild(el("div", { class: "row" },
        numField("Breedte", "w", 8, 200),
        numField("Hoogte", "h", 8, 200)
      ));
    }
    if (e2.type === "slot") {
      wrap.appendChild(el("div", { class: "inline-info small",
        text: e2.role === "input"
          ? "Invoerslot " + (e2.index ?? "?") + " — hoort in de 3×3-grid van de werkbank."
          : e2.role === "output"
            ? "Uitvoerslot — hier komt het resultaat."
            : "Speler-slot (inventaris-index " + (e2.index ?? "?") + ")." }));
    }
    return wrap;
  }

  function elemLabel(e) {
    const m = {
      slot: "🔲 Slot",
      label: "🏷️ Label",
      button: "🔘 Knop",
      arrow: "➡️ Pijl",
      rect: "⬛ Vlak"
    };
    let base = m[e.type] || e.type;
    if (e.type === "slot") base += " · " + (e.role === "input" ? "invoer" : e.role === "output" ? "uitvoer" : "speler");
    return base;
  }

  /** Validatie voor werkbank-modus (3×3 + uitvoer moeten bestaan) */
  function validateCrafting(gui) {
    const issues = [];
    const inputs = gui.elements.filter((e) => e.type === "slot" && e.role === "input");
    const outputs = gui.elements.filter((e) => e.type === "slot" && e.role === "output");
    const players = gui.elements.filter((e) => e.type === "slot" && e.role === "player");
    if (inputs.length !== 9)
      issues.push(`Werkbank-modus heeft exact 9 invoerslots nodig (nu: ${inputs.length}).`);
    const idxs = inputs.map((e) => e.index);
    if (new Set(idxs).size !== idxs.length)
      issues.push("Invoerslots hebben dubbele indexen (0-8).");
    if (outputs.length !== 1)
      issues.push(`Werkbank-modus heeft exact 1 uitvoerslot nodig (nu: ${outputs.length}).`);
    if (players.length < 36)
      issues.push(`Aanbevolen: alle 36 speler-slots (nu ${players.length}/36) — de gameCodes rekenen met 36.`);
    return issues;
  }

  return {
    ensureIds, drawGui, hitTest, boundsOf, renderToCanvas, mountEditor,
    renderProps, elemLabel, validateCrafting, drawSlot, drawButtonShape, drawLabel
  };
})();
