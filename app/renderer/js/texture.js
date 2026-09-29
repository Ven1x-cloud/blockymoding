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
    let redoStack = [];
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
        redoStack.push(pixels.slice());
        pixels = undoStack.pop();
        redraw(); emit();
      }
    });
    const btnRedo = el("button", {
      class: "mc-btn mc-btn-sm mc-btn-ghost", text: "↪ Opnieuw",
      onclick: () => {
        if (!redoStack.length) return;
        undoStack.push(pixels.slice());
        pixels = redoStack.pop();
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
    const photoInput = el("input", { type: "file", accept: "image/*", style: "display:none", onchange: (ev) => {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      const img = new Image();
      img.onload = () => {
        pushUndo();
        const tmp = document.createElement("canvas");
        tmp.width = size; tmp.height = size;
        const tx = tmp.getContext("2d");
        tx.imageSmoothingEnabled = true;
        // centraal bijsnijden naar vierkant, dan schalen naar textuurgrootte
        const m = Math.min(img.width, img.height);
        tx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
        const d = tx.getImageData(0, 0, size, size).data;
        for (let i = 0; i < pixels.length; i++) {
          const a = d[i * 4 + 3];
          pixels[i] = a < 96 ? null
            : "#" + [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
        }
        redraw(); emit();
        toast("Foto geïmporteerd als textuur!", "ok");
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(f);
      ev.target.value = "";
    } });
    const btnPhoto = el("button", { class: "mc-btn mc-btn-sm mc-btn-ghost", text: "📷 Foto", title: "Kies een foto – automatisch vierkant bijgesneden en geschaald naar de textuurgrootte", onclick: () => photoInput.click() }, photoInput);

    tools.append(
      el("div", { class: "tool-row" }, toolRow, btnUndo, btnRedo, btnPhoto, btnClear),
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
      redoStack = [];
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
      setPixels(p) { pixels = p.slice(); undoStack = []; redoStack = []; redraw(); },
      getPixels: () => pixels.slice()
    };
  }

  /** Meest voorkomende kleur uit pixels-array → hex (voor wapenlagen). */
  function avgColor(pixels) {
    const counts = new Map();
    (pixels || []).forEach((c) => {
      if (!c || typeof c !== "string") return;
      counts.set(c, (counts.get(c) || 0) + 1);
    });
    let best = "#7d7d7d", n = -1;
    counts.forEach((k, c) => { if (k > n) { n = k; best = c; } });
    return best;
  }

  /** Vertical strip van meerdere 16×16 frames → PNG-bytes (geanimeerde icoon). */
  function stripPng(frameArrays) {
    const S = 16;
    const cv = document.createElement("canvas");
    cv.width = S; cv.height = S * frameArrays.length;
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    frameArrays.forEach((px, i) => {
      ctx.drawImage(pixelsToCanvas(px, S), 0, i * S);
    });
    return canvasToPngBytes(cv);
  }

  /** Egaal gekleurd paneel met subtiele textuur (wapenlagen), η×η px. */
  function armorPng(w, h, hex, variant) {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, w, h);
    const dark = shade(hex, -35), light = shade(hex, 30);
    ctx.fillStyle = dark;
    ctx.fillRect(0, h - Math.max(2, (h / 16) | 0), w, Math.max(2, (h / 16) | 0));
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, Math.max(1, (h / 32) | 0));
    const step = variant === 2 ? 8 : 6;
    ctx.fillStyle = dark;
    for (let x = step; x < w - 1; x += step * 2) {
      for (let y = step; y < h - step; y += step * 2) {
        ctx.fillRect(x, y, Math.max(1, (step / 3) | 0), Math.max(1, (step / 3) | 0));
      }
    }
    return canvasToPngBytes(cv);
  }

  /** Eenvoudig 16×16 flesje-icoontje in de gegeven kleur. */
  function bottlePng(size, color) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    const u = size / 16;
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, size, size);
    // kurk
    x.fillStyle = "#7a5230";
    x.fillRect(6 * u, 1 * u, 4 * u, 2 * u);
    x.fillStyle = "#5d3e24";
    x.fillRect(6 * u, 2 * u, 4 * u, 1 * u);
    // hals
    x.fillStyle = color;
    x.fillRect(6.5 * u, 3 * u, 3 * u, 3 * u);
    // body
    x.fillStyle = color;
    x.fillRect(3 * u, 6 * u, 10 * u, 9 * u);
    // rand
    x.strokeStyle = "rgba(10,14,24,.75)";
    x.lineWidth = Math.max(1, u);
    x.strokeRect(3 * u, 6 * u, 10 * u, 9 * u);
    // glans
    x.fillStyle = "rgba(255,255,255,.5)";
    x.fillRect(4.5 * u, 7 * u, 1.5 * u, 7 * u);
    x.fillStyle = "rgba(0,0,0,.25)";
    x.fillRect(11 * u, 7 * u, 1.5 * u, 7 * u);
    return c;
  }

  /** Eenvoudige pijl met gekleurde punt. */
  function arrowPng(size, color) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    const u = size / 16;
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, size, size);
    // schacht (diagonaal)
    x.strokeStyle = "#9a7b4f";
    x.lineWidth = Math.max(1, 2 * u);
    x.beginPath();
    x.moveTo(3 * u, 13 * u);
    x.lineTo(12 * u, 4 * u);
    x.stroke;
    x.stroke();
    // punt
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(14 * u, 2 * u);
    x.lineTo(15 * u, 7 * u);
    x.lineTo(9 * u, 5 * u);
    x.closePath();
    x.fill();
    // veer
    x.fillStyle = "#d8d8d8";
    x.fillRect(1.5 * u, 12 * u, 3 * u, 1.5 * u);
    x.fillRect(2 * u, 10.5 * u, 1.5 * u, 3 * u);
    return c;
  }

  /** Glitch-logo (effecticoon): RGB-split, scanlines, dode pixels, barst. Vast patroon = altijd identiek. */
  function glitchPng(size, color) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    const u = size / 16;
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, size, size);
    const hex = String(color || "#b708c4").replace(/^#/, "").padEnd(6, "0").slice(0, 6);
    const cr = parseInt(hex.slice(0, 2), 16) || 183;
    const cg = parseInt(hex.slice(2, 4), 16) || 8;
    const cb = parseInt(hex.slice(4, 6), 16) || 196;
    // 1) RGB-split ghosts (cyaan + roze verschoven)
    x.fillStyle = "rgba(0, 255, 255, 0.85)";
    x.fillRect(2 * u, 3 * u, 11 * u, 11 * u);
    x.fillStyle = "rgba(255, 0, 128, 0.85)";
    x.fillRect(4 * u, 5 * u, 11 * u, 11 * u);
    // 2) hoofdvlak in eigen kleur
    x.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.9)`;
    x.fillRect(3 * u, 4 * u, 11 * u, 11 * u);
    // 3) scanlines weghalen (transparante spleten)
    x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 6; i++) x.fillRect(0, (4.6 + i * 2.1) * u, 16 * u, 0.8 * u);
    x.globalCompositeOperation = "source-over";
    // 4) dode/verschoven blokjes (vast patroon)
    x.fillStyle = "#000000";
    [[5, 6, 3, 1], [9, 9, 2, 2], [4, 11, 4, 1], [10, 5, 1, 3], [6, 12, 2, 1]]
      .forEach(([dx, dy, dw, dh]) => x.fillRect(dx * u, dy * u, dw * u, dh * u));
    // 5) diagonale barst
    x.strokeStyle = "rgba(255, 255, 255, 0.95)";
    x.lineWidth = Math.max(1, u);
    x.beginPath();
    x.moveTo(3 * u, 14 * u);
    x.lineTo(14 * u, 3 * u);
    x.stroke();
    // 6) randje
    x.strokeStyle = "rgba(0, 0, 0, 0.65)";
    x.strokeRect(3 * u, 4 * u, 11 * u, 11 * u);
    return c;
  }

  return { PALETTE, generate, drawPixels, pixelsToCanvas, canvasToPngBytes, mountEditor, shade, avgColor, stripPng, armorPng, bottlePng, arrowPng, glitchPng };
})();
