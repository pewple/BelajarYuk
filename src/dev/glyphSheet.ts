/**
 * A proofing sheet for the tracing glyphs - for the developer, not the child.
 * Run `npm run dev` and open /src/dev/glyph-sheet.html. It is not part of the app
 * or its build.
 *
 * It draws exactly what Menulis draws, and for Arabic glyphs also the character
 * itself in the device's Arabic typeface, so a hand-drawn stroke can be checked
 * against a real letter.
 */
import { LOWERCASE_LINES } from '../data/glyphsLatin';
import { glyphOf, glyphsFor, isArabicKind, pathD } from '../data/tracing';
import type { TraceKind } from '../data/tracing';

const KINDS: [TraceKind, string][] = [
  ['letters', 'Huruf besar'],
  ['lowercase', 'Huruf kecil'],
  ['numbers', 'Angka'],
  ['hijaiyah', 'Hijaiyah'],
  ['arabicNumbers', 'Angka Arab'],
];

const params = new URLSearchParams(window.location.search);
const only = params.get('kind');
const size = Number(params.get('size')) || 150;
const withFont = params.get('font') !== '0';
/** ?font=only draws just the typeface, to study the shapes. */
const fontOnly = params.get('font') === 'only';
/** Only these glyphs, e.g. ?ids=بتث */
const ids = params.get('ids');
/** The letters are drawn to fit a square this big, centred on the board. */
const FIT = 84;
const STACK = "'Amiri', 'Noto Naskh Arabic', 'Traditional Arabic', 'Geeza Pro', 'Segoe UI', Tahoma, Arial, sans-serif";
const measuring = document.createElement('canvas').getContext('2d')!;

/** Where to put a character so that its ink fills the board the way a tracing glyph should. */
function fitted(character: string): { x: number; y: number; size: number } {
  measuring.font = `100px ${STACK}`;
  const m = measuring.measureText(character);
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const k = FIT / Math.max(w, h, 1) ;
  const cx = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
  const cy = (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
  return { x: 50 - cx * k, y: 50 - cy * k, size: 100 * k };
}
document.documentElement.style.setProperty('--cell', `${size}px`);

/** ?skel=1 also draws the thinned outline of the typeface's letter, as small red dots: a centre line to follow. */
const withSkeleton = params.get('skel') === '1';
const RES = 4;

/** The centre line of a character, by thinning its picture (Zhang-Suen), in board coordinates. */
function skeletonOf(character: string): { x: number; y: number }[] {
  const at = fitted(character);
  const px = 100 * RES;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.font = `${at.size * RES}px ${STACK}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(character, at.x * RES, at.y * RES);
  const data = ctx.getImageData(0, 0, px, px).data;

  const img = new Uint8Array(px * px);
  for (let i = 0; i < img.length; i += 1) img[i] = data[i * 4 + 3] > 127 ? 1 : 0;

  const neighbours = (x: number, y: number) => [
    img[(y - 1) * px + x], img[(y - 1) * px + x + 1], img[y * px + x + 1], img[(y + 1) * px + x + 1],
    img[(y + 1) * px + x], img[(y + 1) * px + x - 1], img[y * px + x - 1], img[(y - 1) * px + x - 1],
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass += 1) {
      const remove: number[] = [];
      for (let y = 1; y < px - 1; y += 1) {
        for (let x = 1; x < px - 1; x += 1) {
          if (!img[y * px + x]) continue;
          const n = neighbours(x, y);
          const count = n.reduce((a, b) => a + b, 0);
          if (count < 2 || count > 6) continue;
          let transitions = 0;
          for (let k = 0; k < 8; k += 1) if (n[k] === 0 && n[(k + 1) % 8] === 1) transitions += 1;
          if (transitions !== 1) continue;
          const [p2, , p4, , p6, , p8] = n;
          if (pass === 0 ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0 : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) remove.push(y * px + x);
        }
      }
      if (remove.length) changed = true;
      for (const i of remove) img[i] = 0;
    }
  }

  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < px; y += 1) for (let x = 0; x < px; x += 1) if (img[y * px + x]) out.push({ x: x / RES, y: y / RES });
  return out;
}

const NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

function cell(kind: TraceKind, id: string): HTMLElement {
  const glyph = glyphOf(id);
  const svg = el('svg', { viewBox: '0 0 100 100' });

  if (kind === 'lowercase') {
    for (const [name, y] of Object.entries(LOWERCASE_LINES)) {
      svg.append(el('line', { x1: 0, x2: 100, y1: y, y2: y, stroke: name === 'middle' ? '#fda4af' : '#e2e8f0', 'stroke-width': 0.6, 'stroke-dasharray': name === 'middle' ? '2 2' : '0' }));
    }
  }

  if (withFont && isArabicKind(kind)) {
    const at = fitted(id);
    const text = el('text', { x: at.x, y: at.y, 'font-size': at.size, fill: fontOnly ? '#0f172a' : '#7dd3fc', opacity: fontOnly ? 1 : 0.75, class: 'arabic' });
    text.textContent = id;
    svg.append(text);
  }

  if (fontOnly) {
    const figure = document.createElement('figure');
    figure.append(svg);
    return figure;
  }

  if (withSkeleton && isArabicKind(kind)) {
    for (const p of skeletonOf(id)) svg.append(el('rect', { x: p.x, y: p.y, width: 0.5, height: 0.5, fill: '#dc2626' }));
  }

  for (const stroke of glyph.strokes) {
    svg.append(el('path', { d: pathD(stroke.points), fill: 'none', stroke: '#94a3b8', 'stroke-opacity': 0.55, 'stroke-width': 13, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  }
  for (const stroke of glyph.strokes) {
    svg.append(el('path', { d: pathD(stroke.points), fill: 'none', stroke: '#0f172a', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }));
  }
  glyph.strokes.forEach((stroke, i) => {
    const start = stroke.points[0];
    svg.append(el('circle', { cx: start.x, cy: start.y, r: 3.4, fill: '#fbbf24', stroke: '#1e293b', 'stroke-width': 0.8 }));
    const label = el('text', { x: start.x, y: start.y + 1.6, 'text-anchor': 'middle', 'font-size': 4.6, 'font-weight': 900, fill: '#1e293b' });
    label.textContent = String(i + 1);
    svg.append(label);
    // The end of the stroke, so the direction can be read.
    const end = stroke.points[stroke.points.length - 1];
    svg.append(el('circle', { cx: end.x, cy: end.y, r: 1.6, fill: '#e11d48' }));
  });

  const figure = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = `${id}  (${glyph.strokes.length} goresan)`;
  figure.append(svg, caption);
  return figure;
}

const root = document.getElementById('root')!;
for (const [kind, title] of KINDS) {
  if (only && only !== kind) continue;
  const heading = document.createElement('h2');
  heading.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const id of glyphsFor(kind)) if (!ids || ids.includes(id)) grid.append(cell(kind, id));
  root.append(heading, grid);
}
