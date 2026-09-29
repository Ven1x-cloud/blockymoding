// ── Minieme ZIP-schrijver (zonder compressie, "store") ──
// Werkt offline in de browser én in Electron. Geen externe libraries.
"use strict";

const Zip = (() => {
  // CRC32-tabel
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function encodeUtf8(str) {
    return new TextEncoder().encode(str);
  }

  /** DOS-datum/tijd voor de ZIP-header (lokaal) */
  function dosDateTime(date) {
    const d = date || new Date();
    const time =
      ((d.getHours() & 0x1f) << 11) |
      ((d.getMinutes() & 0x3f) << 5) |
      ((d.getSeconds() / 2) & 0x1f);
    const dt =
      (((d.getFullYear() - 1980) & 0x7f) << 9) |
      (((d.getMonth() + 1) & 0x0f) << 5) |
      (d.getDate() & 0x1f);
    return { time, date: dt };
  }

  /**
   * Maak een ZIP uit een lijst bestanden.
   * files: [{ path: "map/bestand.txt", data: string|Uint8Array }]
   * Geeft Uint8Array terug.
   */
  function build(files) {
    const { time, date } = dosDateTime(new Date());
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const f of files) {
      const nameBytes = encodeUtf8(f.path.replace(/\\/g, "/"));
      const data = typeof f.data === "string" ? encodeUtf8(f.data) : f.data;
      const crc = crc32(data);
      const size = data.length;

      // Lokale kop
      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);       // lokale header-signatuur
      lv.setUint16(4, 20, true);               // versie
      lv.setUint16(6, 0x0800, true);           // flags: UTF-8 namen
      lv.setUint16(8, 0, true);                // methode: store
      lv.setUint16(10, time, true);
      lv.setUint16(12, date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);               // extra lengte
      local.set(nameBytes, 30);

      // Centrale directory-entry
      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);       // centrale signatuur
      cv.setUint16(4, 20, true);               // versie gemaakt door
      cv.setUint16(6, 20, true);               // versie nodig
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, time, true);
      cv.setUint16(14, date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);               // extra
      cv.setUint16(32, 0, true);               // commentaar
      cv.setUint16(34, 0, true);               // disknummer
      cv.setUint16(36, 0, true);               // interne attributen
      cv.setUint32(38, 0, true);               // externe attributen
      cv.setUint32(42, offset, true);          // offset lokale header
      central.set(nameBytes, 46);

      localParts.push(local, data);
      centralParts.push(central);
      offset += local.length + size;
    }

    const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
    const centralOffset = offset;

    // Afsluitende record (EOCD)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, centralOffset, true);
    ev.setUint16(20, 0, true);

    // Alles samenvoegen
    const total =
      localParts.reduce((n, p) => n + p.length, 0) + centralSize + eocd.length;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const p of [...localParts, ...centralParts, eocd]) {
      out.set(p, pos);
      pos += p.length;
    }
    return out;
  }


  /** Snel: lees een ZIP met alleen STORE-vulling (onze eigen exports). */
  function readSync(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("Geen geldig ZIP-bestand.");
    const count = dv.getUint16(eocd + 10, true);
    let pos = dv.getUint32(eocd + 16, true);
    const out = [];
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(pos, true) !== 0x02014b50) break;
      const method = dv.getUint16(pos + 10, true);
      const csize = dv.getUint32(pos + 20, true);
      const nameLen = dv.getUint16(pos + 28, true);
      const extraLen = dv.getUint16(pos + 30, true);
      const cmtLen = dv.getUint16(pos + 32, true);
      const lho = dv.getUint32(pos + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
      pos += 46 + nameLen + extraLen + cmtLen;
      const lNameLen = dv.getUint16(lho + 26, true);
      const lExtraLen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lNameLen + lExtraLen;
      if (method !== 0) throw new Error("ZIP-methode " + method + " alleen met read(): " + name);
      out.push({ path: name, data: bytes.subarray(start, start + csize).slice() });
    }
    if (!out.length) throw new Error("ZIP bevat geen bestanden.");
    return out;
  }

  /** Lees een ZIP (STORE + DEFLATE) → [{path, data:Uint8Array}]. */
  async function read(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("Geen geldig ZIP-bestand.");
    const count = dv.getUint16(eocd + 10, true);
    let pos = dv.getUint32(eocd + 16, true);
    const out = [];
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(pos, true) !== 0x02014b50) break;
      const method = dv.getUint16(pos + 10, true);
      const csize = dv.getUint32(pos + 20, true);
      const nameLen = dv.getUint16(pos + 28, true);
      const extraLen = dv.getUint16(pos + 30, true);
      const cmtLen = dv.getUint16(pos + 32, true);
      const lho = dv.getUint32(pos + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
      pos += 46 + nameLen + extraLen + cmtLen;
      const lNameLen = dv.getUint16(lho + 26, true);
      const lExtraLen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(start, start + csize);
      let data;
      if (method === 0) {
        data = raw.slice();
      } else if (method === 8) {
        const ds = new DecompressionStream("deflate-raw");
        const stream = new Blob([raw]).stream().pipeThrough(ds);
        data = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        throw new Error("ZIP-methode " + method + " wordt niet ondersteund: " + name);
      }
      out.push({ path: name, data });
    }
    if (!out.length) throw new Error("ZIP bevat geen bestanden.");
    return out;
  }

  return { build, read, readSync, crc32, encodeUtf8 };
})();

// Node-testcompatibiliteit (wordt in de browser genegeerd)
if (typeof module !== "undefined") module.exports = { Zip };
