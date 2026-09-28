// ── 16×16 pixel-textuur editor + generatoren + PNG-render ──
"use strict";

const TextureKit = (() => {
  const PALETTE = [
    "#000000", "#3d3d3d", "#7d7d7d", "#bdbdbd", "#ffffff",
    "#7b3f1d", "#b87333", "#e8b866", "#f5deb3",
    "#3f7d24", "#5dbb4a", "#8fd85a",
    "#8a1f1f", "#c43b3b", "#ff5555",
    "#1f3f8a", "#3b6bc4", "#55aaff",
    "#e0c040", "#fff080", "#8a5fd8", "#4a2f6f"
  ];

  /** Kleur met willekeurige variatie (± amt) */
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt;
    let g = ((n >> 8) & 0xff) + amt;
    let b = (n & 0xff) + amt;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  }

  // Deterministische pseudo-random (zelfde seed → zelfde textuur)
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /**
   * Genereer pixels voor een stijl.
   * style: vlak | ruis | baksteen | ertsen | gras | hout | glas | donker | steen
   */
  function generate(style, base, seed) {
    const S = 16;
    const px = new Array(S * S).fill(base);
    const rand = rng(seed || 1);
    const put = (x, y, c) => { if (x >= 0 && x < S && y >= 0 && y < S) px[y * S + x] = c; };
    const get = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? null : px[y * S + x]);

    switch (style) {
      case "vlak":
        break;
      case "donker":
        for (let i = 0; i < px.length; i++) px[i] = shade(base, -30);
        break;
      case "ruis":
        for (let i = 0; i < px.length; i++) px[i] = shade(base, Math.floor(rand() * 40) - 20);
        break;
      case "steen":
        for (let i = 0; i < px.length; i++) px[i] = shade(base, Math.floor(rand() * 26) - 13);
        // donkere krasjes
        for (let k = 0; k < 6; k++) {
          const x = Math.floor(rand() * S), y = Math.floor(rand() * S);
          put(x, y, shade(base, -45));
          put(x + 1, y, shade(base, -45));
        }
        break;
      case "baksteen":
        for (let y = 0; y < S; y++) {
          const row = Math.floor(y / 4);
          const off = row % 2 === 0 ? 0 : 4;
          for (let x = 0; x < S; x++) {
            const mortarY = y % 4 === 3;
            const mortarX = (x + off) % 8 === 7;
            px[y * S + x] = mortarY || mortarX ? "#b7a99a" : shade(base, Math.floor(rand() * 18) - 9);
          }
        }
        break;
      case "ertsen": {
        // steen-achtige basis
        for (let i = 0; i < px.length; i++) px[i] = shade("#7d7d7d", Math.floor(rand() * 24) - 12);
        // ertsklonters in basiskleur
        const spots = 3 + Math.floor(rand() * 3);
        for (let k = 0; k < spots; k++) {
          const cx = 2 + Math.floor(rand() * 12);
          const cy = 2 + Math.floor(rand() * 12);
          put(cx, cy, base); put(cx + 1, cy, shade(base, -25));
          put(cx, cy + 1, shade(base, -25)); put(cx + 1, cy + 1, base);
          if (rand() > 0.5) put(cx + 2, cy, base);
        }
        break;
      }
      case "gras":
        for (let i = 0; i < px.length; i++) px[i] = shade(base, Math.floor(rand() * 46) - 23);
        for (let k = 0; k < 14; k++) {
          const x = Math.floor(rand() * S), y = Math.floor(rand() * S);
          put(x, y, shade(base, 35));
          if (rand() > 0.5) put(x, y + 1, shade(base, -35));
        }
        break;
      case "hout":
        for (let x = 0; x < S; x++) {
          const grain = Math.floor(rand() * 20) - 10;
          for (let y = 0; y < S; y++) {
            const streak = (x === 3 || x === 11) ? -35 : 0;
            px[y * S + x] = shade(base, grain + streak + (rand() > 0.85 ? -20 : 0));
          }
        }
        break;
      case "glas":
        for (let i = 0; i < px.length; i++) px[i] = null;
        // rand
        for (let i = 0; i < S; i++) {
          put(i, 0, shade(base, 20)); put(i, S - 1, shade(base, 20));
          put(0, i, shade(base, 20)); put(S - 1, i, shade(base, 20));
        }
        // reflectiestreep
        for (let i = 2; i < 9; i++) put(i, i, "#ffffff");
        break;
      default:
        break;
    }
    return px;
  }

  /** Teken pixels op een canvas (scaled) */
  function drawPixels(ctx, pixels, size, scale) {
    scale = scale || 1;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = pixels[y * size + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  /** Maak een canvas met de textuur op ware grootte (size×size px) */
  function pixelsToCanvas(pixels, size) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    drawPixels(ctx, pixels, size, 1);
    return c;
  }

  /** Canvas → PNG-bytes (Uint8Array) */
  function canvasToPngBytes(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error("toBlob mislukt"));
        const buf = await blob.arrayBuffer();
        resolve(new Uint8Array(buf));
      }, "image/png");
    });
  }

  /**
   * Monteer een pixel-editor in `holder`.
   * opts: { pixels, size, onChange(pixels) }
   * Geeft { refresh() } terug.
   */
  function mountEditor(holder, opts) {
    const size = opts.size || 16;
    let pixels = opts.pixels && opts.pixels.length === size * size
      ? opts.pixels.slice()
      : new Array(size * size).fill(null);
    let tool = "pen";
    let color = "#5dbb4a";
    let drawing = false;
    let undoStack = [];
    const scale = Math.max(8, Math.floor(256 / size));

    const canvas = el("canvas", { width: size * scale, height: size * scale });
    const ctx = canvas.getContext("2d");

    holder.innerHTML = "";
    const wrap = el("div", { class: "pix-wrap" });
    const canvasHolder = el("div", { class: "pix-canvas-holder" }, canvas);
    const tools = el("div", { class: "pix-tools" });

    // ── tools ──
    const toolBtns = {};
    const toolRow = el("div", { class: "tool-row" });
    for (const [t, label] of [["pen", "✏️ Pen"], ["gum", "🧽 Gum"], ["emmer", "🪣 Vul"]]) {
      const b = el("button", {
        class: "mc-btn mc-btn-sm" + (t === tool ? " mc-btn-blue" : " mc-btn-ghost"),
        text: label,
        onclick: () => {
          tool = t;
          for (const [k, btn] of Object.entries(toolBtns))
            btn.className = "mc-btn mc-btn-sm" + (k === t ? " mc-btn-blue" : " mc-btn-ghost");
        }
      });
      toolBtns[t] = b;
      toolRow.appendChild(b);
    }

    // ── palet ──
    const palette = el("div", { class: "palette" });
    const swatches = [];
    function setColor(c) {
      color = c;
      swatches.forEach((s) => s.classList.toggle("active", s.dataset.c === c));
      colorInput.value = c;
    }
    PALETTE.forEach((c) => {
      const s = el("div", {
        class: "swatch", title: c,
        onclick: () => setColor(c)
      });
      s.dataset.c = c;
      s.style.background = c;
      swatches.push(s);
      palette.appendChild(s);
    });
    const colorInput = el("input", {
      type: "color", class: "mc-input", value: color,
      style: "height:32px;padding:2px",
      oninput: (e) => setColor(e.target.value)
    });

    // ── genereren ──
    const styleSel = el("select", { class: "mc-input" },
      el("option", { value: "ruis", text: "Ruis (grint-achtig)" }),
      el("option", { value: "steen", text: "Steen" }),
      el("option", { value: "baksteen", text: "Bakstenen" }),
      el("option", { value: "ertsen", text: "Erts (basis = ertskleur)" }),
      el("option", { value: "gras", text: "Gras / bladeren" }),
      el("option", { value: "hout", text: "Hout (nerven)" }),
      el("option", { value: "glas", text: "Glas (alleen rand)" }),
      el("option", { value: "vlak", text: "Egaal" }),
      el("option", { value: "donker", text: "Donker egaal" })
    );
    const genSeed = Math.floor(Math.random() * 99999);
    const btnGen = el("button", {
      class: "mc-btn mc-btn-sm mc-btn-green", text: "🎲 Genereer textuur",
      onclick: () => {
        pushUndo();
        pixels = generate(styleSel.value, color, genSeed + Math.floor(Math.random() * 1000));
        redraw(); emit();
        toast("Textuur gegenereerd!", "ok");
      }
    });

    const btnUndo = el("button", {
      class: "mc-btn mc-btn-sm mc-btn-ghost", text: "↩ Ongedaan",
      onclick: () => {
        if (!undoStack.length) return;
        pixels = undoStack.pop();
        redraw(); emit();
      }
    });
    const btnClear = el("button", {
      class: "mc-btn mc-btn-sm mc-btn-red", text: "🗑 Wis alles",
      onclick: () => {
        pushUndo();
        pixels = new Array(size * size).fill(null);
        redraw(); emit();
      }
    });

    tools.append(
      el("div", { class: "tool-row" }, toolRow, btnUndo, btnClear),
      el("div", { class: "field" }, el("label", { text: "Kleur" }), palette, colorInput),
      el("div", { class: "field" },
        el("label", { text: "Snel-genereren" }),
        el("div", { class: "row" }, styleSel, btnGen),
        el("div", { class: "hint", text: "Kies een kleur + stijl, klik op Genereer — klaar." })
      ),
      el("div", { class: "gui-legend", text: "Tip: rechtermuisknop = gummen." })
    );

    wrap.append(canvasHolder, tools);
    holder.appendChild(wrap);

    // ── tekenlogica ──
    function redraw() {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // dambord voor doorzichtigheid
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if ((x + y) % 2 === 0) { ctx.fillStyle = "#222"; ctx.fillRect(x * scale, y * scale, scale, scale); }
      drawPixels(ctx, pixels, size, scale);
      // rasterlijnen
      ctx.strokeStyle = "rgba(255,255,255,.07)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= size; i++) {
        ctx.beginPath(); ctx.moveTo(i * scale + .5, 0); ctx.lineTo(i * scale + .5, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * scale + .5); ctx.lineTo(canvas.width, i * scale + .5); ctx.stroke();
      }
    }

    function pushUndo() {
      undoStack.push(pixels.slice());
      if (undoStack.length > 30) undoStack.shift();
    }

    function emit() { if (opts.onChange) opts.onChange(pixels.slice()); }

    function posFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = Math.floor(((clientX - rect.left) / rect.width) * size);
      const y = Math.floor(((clientY - rect.top) / rect.height) * size);
      if (x < 0 || y < 0 || x >= size || y >= size) return null;
      return { x, y };
    }

    let lastCell = null;
    function applyAt(p, erase) {
      const i = p.y * size + p.x;
      const val = erase || tool === "gum" ? null : color;
      if (pixels[i] === val) return;
      if (tool === "emmer" && !erase) {
        floodFill(p.x, p.y, pixels[i], val);
      } else {
        pixels[i] = val;
      }
      redraw();
    }

    function floodFill(x, y, from, to) {
      if (from === to) return;
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cy < 0 || cx >= size || cy >= size) continue;
        const i = cy * size + cx;
        if (pixels[i] !== from) continue;
        pixels[i] = to;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    }

    canvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const p = posFromEvent(e);
      if (!p) return;
      pushUndo();
      drawing = true;
      lastCell = p;
      applyAt(p, e.button === 2);
    });
    canvas.addEventListener("mousemove", (e) => {
      if (!drawing) return;
      const p = posFromEvent(e);
      if (!p || (lastCell && p.x === lastCell.x && p.y === lastCell.y)) return;
      lastCell = p;
      applyAt(p, e.buttons === 2);
    });
    window.addEventListener("mouseup", () => {
      if (drawing) { drawing = false; lastCell = null; emit(); }
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    redraw();
    setColor(color);

    return {
      redraw,
      setPixels(p) { pixels = p.slice(); undoStack = []; redraw(); },
      getPixels: () => pixels.slice()
    };
  }

  return { PALETTE, generate, drawPixels, pixelsToCanvas, canvasToPngBytes, mountEditor, shade };
})();
