// Generates a macOS *template* tray icon (black + alpha; macOS recolors it for
// light/dark menu bars). Draws a simple "target" mark — a ring with a center
// dot — at 16px and 32px (@2x). No native deps: hand-rolled PNG encoder.
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public');

// ── CRC32 (PNG chunk checksums) ─────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Smoothstep coverage for cheap anti-aliasing around a 1px edge.
function edge(d, r) {
  const a = (r + 0.6 - d) / 1.2; // ~1.2px transition band
  return Math.max(0, Math.min(1, a));
}

function renderTarget(size) {
  const c = (size - 1) / 2;
  const ringR = size * 0.40;
  const ringInner = size * 0.26;
  const dotR = size * 0.13;
  const raw = Buffer.alloc(size * (size * 4 + 1)); // +1 filter byte per row
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      // Ring band: inside outer edge AND outside inner edge.
      const ring = Math.min(edge(d, ringR), 1 - edge(d, ringInner));
      const dot = edge(d, dotR);
      const alpha = Math.round(Math.max(ring, dot) * 255);
      raw[p++] = 0;      // R (template → color ignored)
      raw[p++] = 0;      // G
      raw[p++] = 0;      // B
      raw[p++] = alpha;  // A
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'tray-iconTemplate.png'), renderTarget(16));
fs.writeFileSync(path.join(outDir, 'tray-iconTemplate@2x.png'), renderTarget(32));
console.log('Wrote public/tray-iconTemplate.png (16) and @2x (32)');
