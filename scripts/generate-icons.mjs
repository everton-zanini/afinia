// Gera os ícones PWA a partir da marca (dois anéis entrelaçados sobre verde-petróleo).
// Sem dependências: rasteriza com supersampling e codifica PNG com zlib.
// Uso: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const TEAL = [14, 107, 105];
const WHITE = [255, 255, 255];
const MINT = [159, 224, 214];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const S = 4; // supersampling
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const n = S * S;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / n) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Marca em coordenadas 0..1. `scale` < 1 encolhe o desenho (área segura do maskable). */
function mark({ rounded, scale }) {
  return (u, v) => {
    if (rounded) {
      const r = 0.22, dx = Math.max(r - u, u - (1 - r), 0), dy = Math.max(r - v, v - (1 - r), 0);
      if (dx * dx + dy * dy > r * r) return [0, 0, 0, 0];
    }
    const cx = (u - 0.5) / scale + 0.5, cy = (v - 0.5) / scale + 0.5;
    const ring = (x0, radius, width) => Math.abs(Math.hypot(cx - x0, cy - 0.5) - radius) <= width / 2;
    // Anel da direita (menta) desenhado sobre o da esquerda (branco), como na marca.
    if (ring(0.604, 0.19, 0.072)) return [...MINT, 1];
    if (ring(0.396, 0.19, 0.072)) return [...WHITE, 1];
    return [...TEAL, 1];
  };
}

mkdirSync("public/icons", { recursive: true });
const out = [
  ["icon-192.png", 192, { rounded: true, scale: 1 }],
  ["icon-512.png", 512, { rounded: true, scale: 1 }],
  ["maskable-512.png", 512, { rounded: false, scale: 0.8 }],
  ["apple-touch-icon.png", 180, { rounded: false, scale: 0.9 }],
  ["favicon-32.png", 32, { rounded: true, scale: 1 }],
];
for (const [name, size, opts] of out) {
  writeFileSync(`public/icons/${name}`, png(size, mark(opts)));
  console.log(`public/icons/${name}`);
}
