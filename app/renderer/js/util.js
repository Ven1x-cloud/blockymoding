// ── Hulpfuncties ──
"use strict";

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

/** Maak een DOM-element: el('div', {class:'x', onclick:fn}, kind1, kind2, ...) */
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2), v);
      } else if (k === "class") {
        node.className = v;
      } else if (k === "text") {
        node.textContent = v;
      } else if (k === "html") {
        node.innerHTML = v;
      } else if (k === "checked" || k === "disabled" || k === "selected" || k === "hidden") {
        node[k] = !!v;
      } else if (k === "value") {
        node.value = v;
      } else {
        node.setAttribute(k, v);
      }
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

let _uidCounter = 0;
function uid(prefix) {
  _uidCounter += 1;
  return (prefix || "id") + "_" + Date.now().toString(36) + "_" + _uidCounter.toString(36);
}

/** "Mijn Coole Blok!" -> "mijn_cool_blok" (geldige Minecraft-id) */
function sanitizeId(s) {
  const out = String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return out || "nieuw";
}

/** "mijn_cool_blok" -> "MijnCoolBlok" */
function toClassName(s) {
  return String(s || "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("") || "Nieuw";
}

/** "mijn_cool_blok" -> "MIJN_COOL_BLOK" */
function toConst(s) {
  return sanitizeId(s).toUpperCase();
}

function debounce(fn, ms) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function toast(msg, type) {
  const wrap = $("#toasts");
  if (!wrap) return;
  const t = el("div", { class: "toast " + (type || "info") }, msg);
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity .3s, transform .3s";
    t.style.opacity = "0";
    t.style.transform = "translateX(30px)";
    setTimeout(() => t.remove(), 320);
  }, 3400);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Gekopieerd naar klembord ✔", "ok");
  } catch (e) {
    // Fallback voor oudere omgevingen / file://
    const ta = el("textarea", { style: "position:fixed;opacity:0" });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast("Gekopieerd ✔", "ok"); }
    catch (_) { toast("Kopiëren mislukt", "err"); }
    ta.remove();
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function bytesToBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Formatteer bytes leesbaar */
function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}
