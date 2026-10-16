// Draws the app icons - no image tools needed, just Node.
//
//   node scripts/make-icons.mjs
//
// Writes public/icons/*.png. The picture is the four Pola shapes (a red circle,
// a blue square, a yellow triangle, a green star) in a 2x2 grid on the app's
// cream background, each with the same dark outline the app draws them with.
// The PNGs are committed, so this only needs running to change the design.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

/* ---------- shapes, as signed distances (negative = inside) ---------- */

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const CREAM = hex('#fffbeb');
const OUTLINE = hex('#1e293b');

/** Distance from p to a polygon's edge, negative when p is inside. */
function polygon(points) {
  return (px, py) => {
    let d = Infinity;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [ax, ay] = points[j];
      const [bx, by] = points[i];
      const ex = bx - ax;
      const ey = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
      d = Math.min(d, Math.hypot(px - (ax + ex * t), py - (ay + ey * t)));
      if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
    }
    return inside ? -d : d;
  };
}

const circle = (cx, cy, r) => (px, py) => Math.hypot(px - cx, py - cy) - r;

function roundedSquare(cx, cy, half, radius) {
  return (px, py) => {
    const qx = Math.abs(px - cx) - (half - radius);
    const qy = Math.abs(py - cy) - (half - radius);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
  };
}

function star(cx, cy, outer) {
  const inner = outer * 0.45;
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
  return polygon(points);
}

/** The four shapes in a 2x2 grid inside the box [lo, hi] (unit coordinates). */
function shapes(lo, hi) {
  const cell = (hi - lo) / 2;
  const centre = (col, row) => [lo + cell * (col + 0.5), lo + cell * (row + 0.5)];
  const r = cell * 0.36;

  const [ax, ay] = centre(0, 0);
  const [bx, by] = centre(1, 0);
  const [cx, cy] = centre(0, 1);
  const [dx, dy] = centre(1, 1);

  return [
    { sdf: circle(ax, ay, r), fill: hex('#dc2626') },
    { sdf: roundedSquare(bx, by, r * 0.92, r * 0.18), fill: hex('#2563eb') },
    {
      sdf: polygon([
        [cx, cy - r * 1.05],
        [cx + r * 1.1, cy + r * 0.85],
        [cx - r * 1.1, cy + r * 0.85],
      ]),
      fill: hex('#facc15'),
    },
    { sdf: star(dx, dy, r * 1.12), fill: hex('#16a34a') },
  ];
}

/* ---------- rasterising ---------- */

const SAMPLES = 4; // 4x4 per pixel: smooth edges without any library

/**
 * @param size      pixels per side
 * @param safe      the shapes fill [safe, 1 - safe] of the icon
 * @param rounded   corner radius as a fraction of the size; 0 = full bleed
 */
function render(size, { safe, rounded }) {
  const art = shapes(safe, 1 - safe);
  const stroke = 0.022;
  const corner = roundedSquare(0.5, 0.5, 0.5, rounded);
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const u = (x + (sx + 0.5) / SAMPLES) / size;
          const v = (y + (sy + 0.5) / SAMPLES) / size;

          if (rounded > 0 && corner(u, v) > 0) continue; // outside the rounded corner: transparent

          let colour = CREAM;
          for (const shape of art) {
            const d = shape.sdf(u, v);
            if (d < -stroke) colour = shape.fill;
            else if (d < 0) colour = OUTLINE;
          }
          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 255;
        }
      }

      const n = SAMPLES * SAMPLES;
      const covered = a / 255;
      const at = (y * size + x) * 4;
      rgba[at] = covered ? Math.round(r / covered) : 0;
      rgba[at + 1] = covered ? Math.round(g / covered) : 0;
      rgba[at + 2] = covered ? Math.round(b / covered) : 0;
      rgba[at + 3] = Math.round(a / n);
    }
  }
  return rgba;
}

/* ---------- PNG ---------- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA

  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); // filter byte stays 0
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- the set ---------- */

const ICONS = [
  // Ordinary icons: rounded corners, transparent outside them.
  { file: 'icon-192.png', size: 192, safe: 0.12, rounded: 0.22 },
  { file: 'icon-512.png', size: 512, safe: 0.12, rounded: 0.22 },
  // Maskable: full bleed, art kept inside the central 80% the OS promises not to crop.
  { file: 'icon-maskable-512.png', size: 512, safe: 0.2, rounded: 0 },
  // iOS draws its own corners and does not allow transparency.
  { file: 'apple-touch-icon.png', size: 180, safe: 0.16, rounded: 0 },
];

for (const { file, size, safe, rounded } of ICONS) {
  writeFileSync(join(outDir, file), png(size, render(size, { safe, rounded })));
  console.log(`public/icons/${file}  ${size}x${size}`);
}
