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

  return { build, crc32, encodeUtf8 };
})();

// Node-testcompatibiliteit (wordt in de browser genegeerd)
if (typeof module !== "undefined") module.exports = { Zip };
