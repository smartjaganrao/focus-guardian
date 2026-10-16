// Generates a 1024×1024 colored app-icon master PNG: a rounded "squircle" with
// an indigo gradient and a white target (concentric rings + center dot) — the
// Focus Guardian motif. No native deps; hand-rolled PNG encoder + an SDF mask.
// Run via scripts/make-icns.sh, which slices this into an .iconset and runs iconutil.
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '..', 'build-assets', 'icon-1024.png');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Coverage of a 1px-AA edge: positive inside.
const cov = (d) => clamp01(0.5 - d);
// Ring band coverage centered on radius r, total thickness w.
const ringBand = (dist, r, w) => clamp01((w / 2 + 0.75 - Math.abs(dist - r)) / 1.5);

function render(size) {
  const s = size;
  const cx = (s - 1) / 2;
  const margin = s * 0.085;
  const half = (s - 2 * margin) / 2;
  const corner = s * 0.225;       // squircle-ish corner radius
  const ringW = s * 0.052;

  // Gradient endpoints (indigo accent → deeper blue).
  const top = [124, 150, 255];
  const bot = [59, 76, 219];
  const WHITE = [255, 255, 255];

  const raw = Buffer.alloc(s * (s * 4 + 1));
  let p = 0;
  for (let y = 0; y < s; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < s; x++) {
      // Rounded-box signed distance (negative inside).
      const qx = Math.abs(x - cx) - (half - corner);
      const qy = Math.abs(y - cx) - (half - corner);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      const d = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - corner;
      const boxCov = cov(d);

      if (boxCov <= 0) { raw[p++] = 0; raw[p++] = 0; raw[p++] = 0; raw[p++] = 0; continue; }

      // Base gradient color.
      const tg = clamp01((y - margin) / (s - 2 * margin));
      let r = lerp(top[0], bot[0], tg);
      let g = lerp(top[1], bot[1], tg);
      let b = lerp(top[2], bot[2], tg);

      // White target overlay.
      const dist = Math.hypot(x - cx, y - cx);
      const ring1 = ringBand(dist, half * 0.62, ringW);
      const ring2 = ringBand(dist, half * 0.40, ringW);
      const dot = cov((dist - half * 0.16) ); // filled center dot
      const tA = clamp01(Math.max(ring1, ring2, dot)) * 0.96;
      r = lerp(r, WHITE[0], tA);
      g = lerp(g, WHITE[1], tA);
      b = lerp(b, WHITE[2], tA);

      raw[p++] = Math.round(r);
      raw[p++] = Math.round(g);
      raw[p++] = Math.round(b);
      raw[p++] = Math.round(boxCov * 255);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(s, 0); ihdr.writeUInt32BE(s, 4); ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig, chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, render(1024));
console.log('Wrote', path.relative(process.cwd(), outPath));
