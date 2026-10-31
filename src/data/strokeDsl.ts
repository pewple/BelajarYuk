/**
 * A small language for drawing glyphs as centre lines.
 *
 * A glyph is a list of strokes; a stroke is a list of pieces, drawn on a
 * 100 x 100 board (y grows downwards). `sample` turns a stroke into a dense
 * polyline for the tracing rules in tracing.ts.
 */

export type Pt = { x: number; y: number };

/**
 * One piece of a stroke:
 *  M x y                      start here
 *  L x y                      straight line
 *  Q cx cy x y                quadratic curve
 *  C c1x c1y c2x c2y x y      cubic curve
 *  A cx cy rx ry from to      part of an ellipse, angles in degrees; 0 is
 *                             right, 90 is down, so increasing is clockwise
 */
export type Seg =
  | ['M', number, number]
  | ['L', number, number]
  | ['Q', number, number, number, number]
  | ['C', number, number, number, number, number, number]
  | ['A', number, number, number, number, number, number];

export type StrokeDef = Seg[];

export const M = (x: number, y: number): Seg => ['M', x, y];
export const L = (x: number, y: number): Seg => ['L', x, y];
export const Q = (cx: number, cy: number, x: number, y: number): Seg => ['Q', cx, cy, x, y];
export const C = (a: number, b: number, c: number, d: number, x: number, y: number): Seg => ['C', a, b, c, d, x, y];
export const A = (cx: number, cy: number, rx: number, ry: number, from: number, to: number): Seg => [
  'A', cx, cy, rx, ry, from, to,
];

/**
 * A dot: the dot over an i, or one of the dots of an Arabic letter. It is a
 * stroke so short that the round pen makes a blob of it, and touching it is
 * all that is needed to draw it.
 */
export const dot = (x: number, y: number): StrokeDef => [M(x - 1.4, y - 1), L(x + 1.4, y + 1)];

const rad = (deg: number) => (deg * Math.PI) / 180;
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Turns a stroke description into a dense polyline. */
export function sample(segs: StrokeDef): Pt[] {
  const out: Pt[] = [];
  const push = (p: Pt) => {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > 1e-6) out.push(p);
  };
  const lineTo = (to: Pt) => {
    const from = out[out.length - 1];
    if (!from) return push(to);
    const steps = Math.max(1, Math.ceil(dist(from, to) / 2));
    for (let i = 1; i <= steps; i += 1) {
      push({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
    }
  };

  for (const seg of segs) {
    const from = out[out.length - 1];
    switch (seg[0]) {
      case 'M':
        push({ x: seg[1], y: seg[2] });
        break;
      case 'L':
        lineTo({ x: seg[1], y: seg[2] });
        break;
      case 'Q': {
        const [, cx, cy, x, y] = seg;
        for (let i = 1; i <= 24; i += 1) {
          const t = i / 24;
          const u = 1 - t;
          push({ x: u * u * from.x + 2 * u * t * cx + t * t * x, y: u * u * from.y + 2 * u * t * cy + t * t * y });
        }
        break;
      }
      case 'C': {
        const [, x1, y1, x2, y2, x, y] = seg;
        for (let i = 1; i <= 36; i += 1) {
          const t = i / 36;
          const u = 1 - t;
          push({
            x: u * u * u * from.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
            y: u * u * u * from.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
          });
        }
        break;
      }
      case 'A': {
        const [, cx, cy, rx, ry, a0, a1] = seg;
        const at = (deg: number): Pt => ({ x: cx + rx * Math.cos(rad(deg)), y: cy + ry * Math.sin(rad(deg)) });
        lineTo(at(a0)); // a no-op when the arc starts where the stroke already is
        const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 3));
        for (let i = 1; i <= steps; i += 1) push(at(a0 + ((a1 - a0) * i) / steps));
        break;
      }
    }
  }
  return out;
}
