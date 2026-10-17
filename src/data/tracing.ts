/**
 * Menulis - tracing letters and numbers with a finger.
 *
 * Each glyph is a few strokes, drawn here as centre lines on a 100 x 100 board
 * in the order and direction a child is taught to write them: down before
 * across, left before right, round shapes anticlockwise from the top. The child
 * follows each stroke from its start dot; ink appears behind the finger as it
 * stays on the line.
 *
 * Tracing is forgiving by design. A finger that wanders off the line simply
 * stops drawing - nothing is lost, and coming back to where the ink ended
 * carries on. The only way to be "wrong" is to leave the corridor far enough
 * that it was clearly not an attempt, and even that is a soft nudge, not a
 * failure. This file is the geometry and the rules; the screen draws them.
 */

export type Pt = { x: number; y: number };

/* ------------------------------------------------------------------ */
/* Describing strokes                                                  */
/* ------------------------------------------------------------------ */

/**
 * One piece of a stroke, in the board's coordinates (y grows downwards):
 *  M x y                      start here
 *  L x y                      straight line
 *  Q cx cy x y                quadratic curve
 *  C c1x c1y c2x c2y x y      cubic curve
 *  A cx cy rx ry from to      part of an ellipse, angles in degrees; 0 is
 *                             right, 90 is down, so increasing is clockwise
 */
type Seg =
  | ['M', number, number]
  | ['L', number, number]
  | ['Q', number, number, number, number]
  | ['C', number, number, number, number, number, number]
  | ['A', number, number, number, number, number, number];

const M = (x: number, y: number): Seg => ['M', x, y];
const L = (x: number, y: number): Seg => ['L', x, y];
const C = (a: number, b: number, c: number, d: number, x: number, y: number): Seg => ['C', a, b, c, d, x, y];
const A = (cx: number, cy: number, rx: number, ry: number, from: number, to: number): Seg => ['A', cx, cy, rx, ry, from, to];

const rad = (deg: number) => (deg * Math.PI) / 180;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Turns a stroke description into a dense polyline. */
function sample(segs: Seg[]): Pt[] {
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
        for (let i = 1; i <= 20; i += 1) {
          const t = i / 20;
          const u = 1 - t;
          push({ x: u * u * from.x + 2 * u * t * cx + t * t * x, y: u * u * from.y + 2 * u * t * cy + t * t * y });
        }
        break;
      }
      case 'C': {
        const [, x1, y1, x2, y2, x, y] = seg;
        for (let i = 1; i <= 28; i += 1) {
          const t = i / 28;
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
        const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 4));
        for (let i = 1; i <= steps; i += 1) push(at(a0 + ((a1 - a0) * i) / steps));
        break;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The glyphs                                                          */
/* ------------------------------------------------------------------ */

const DEFINITIONS: Record<string, Seg[][]> = {
  A: [[M(50, 10), L(15, 90)], [M(50, 10), L(85, 90)], [M(28, 62), L(72, 62)]],
  B: [
    [M(25, 10), L(25, 90)],
    [M(25, 10), L(50, 10), A(50, 30, 20, 20, -90, 90), L(25, 50)],
    [M(25, 50), L(52, 50), A(52, 70, 20, 20, -90, 90), L(25, 90)],
  ],
  C: [[A(55, 50, 38, 40, -45, -315)]],
  D: [[M(25, 10), L(25, 90)], [M(25, 10), L(45, 10), A(45, 50, 40, 40, -90, 90), L(25, 90)]],
  E: [[M(25, 10), L(25, 90)], [M(25, 10), L(75, 10)], [M(25, 50), L(65, 50)], [M(25, 90), L(75, 90)]],
  F: [[M(25, 10), L(25, 90)], [M(25, 10), L(75, 10)], [M(25, 50), L(65, 50)]],
  G: [[A(55, 50, 38, 40, -45, -360), L(58, 50)]],
  H: [[M(25, 10), L(25, 90)], [M(75, 10), L(75, 90)], [M(25, 50), L(75, 50)]],
  I: [[M(50, 10), L(50, 90)]],
  J: [[M(65, 10), L(65, 65), A(45, 65, 20, 25, 0, 160)]],
  K: [[M(25, 10), L(25, 90)], [M(75, 10), L(25, 55)], [M(40, 42), L(75, 90)]],
  L: [[M(25, 10), L(25, 90), L(75, 90)]],
  M: [[M(20, 90), L(20, 10), L(50, 60), L(80, 10), L(80, 90)]],
  N: [[M(25, 90), L(25, 10), L(75, 90), L(75, 10)]],
  O: [[A(50, 50, 36, 40, -90, -450)]],
  P: [[M(25, 10), L(25, 90)], [M(25, 10), L(48, 10), A(48, 32, 27, 22, -90, 90), L(25, 54)]],
  Q: [[A(50, 48, 36, 38, -90, -450)], [M(58, 62), L(85, 92)]],
  R: [
    [M(25, 10), L(25, 90)],
    [M(25, 10), L(48, 10), A(48, 32, 27, 22, -90, 90), L(25, 54)],
    [M(45, 54), L(78, 90)],
  ],
  S: [[M(72, 22), C(65, 8, 28, 8, 28, 30), C(28, 50, 72, 48, 72, 70), C(72, 92, 35, 92, 26, 76)]],
  T: [[M(20, 10), L(80, 10)], [M(50, 10), L(50, 90)]],
  U: [[M(25, 10), L(25, 60), A(50, 60, 25, 30, 180, 0), L(75, 10)]],
  V: [[M(20, 10), L(50, 90), L(80, 10)]],
  W: [[M(10, 10), L(30, 90), L(50, 30), L(70, 90), L(90, 10)]],
  X: [[M(22, 10), L(78, 90)], [M(78, 10), L(22, 90)]],
  Y: [[M(20, 10), L(50, 50)], [M(80, 10), L(50, 50), L(50, 90)]],
  Z: [[M(22, 10), L(78, 10), L(22, 90), L(78, 90)]],

  '0': [[A(50, 50, 28, 40, -90, -450)]],
  '1': [[M(35, 28), L(50, 10), L(50, 90)]],
  '2': [[A(50, 32, 25, 22, 180, 390), L(25, 90), L(78, 90)]],
  '3': [[A(48, 30, 24, 20, -150, 90), A(48, 70, 26, 20, -90, 150)]],
  '4': [[M(60, 10), L(20, 62), L(82, 62)], [M(60, 10), L(60, 90)]],
  '5': [[M(72, 10), L(33, 10), L(33, 50), A(48, 68, 27, 22, -125, 145)]],
  '6': [[M(68, 12), C(45, 8, 24, 34, 24, 68), A(48, 68, 24, 22, 180, 540)]],
  '7': [[M(25, 10), L(75, 10), L(40, 90)]],
  '8': [[A(50, 30, 20, 19, -30, -270), A(50, 70, 22, 20, -90, 270)]],
  '9': [[A(52, 32, 24, 22, 0, -360), C(76, 56, 70, 88, 36, 88)]],
};

export const TRACE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** 1 to 9 and then 0: the order a child counts them in. */
export const TRACE_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export type TraceKind = 'letters' | 'numbers';

export function glyphsFor(kind: TraceKind): string[] {
  return kind === 'letters' ? TRACE_LETTERS : TRACE_DIGITS;
}

export type Stroke = {
  points: Pt[];
  /** Distance along the stroke at each point. */
  cum: number[];
  length: number;
};

export type Glyph = { id: string; strokes: Stroke[] };

const cache = new Map<string, Glyph>();

export function glyphOf(id: string): Glyph {
  const hit = cache.get(id);
  if (hit) return hit;

  const defs = DEFINITIONS[id];
  if (!defs) throw new Error(`No strokes for "${id}".`);

  const strokes = defs.map((segs): Stroke => {
    const points = sample(segs);
    const cum = [0];
    for (let i = 1; i < points.length; i += 1) cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
    return { points, cum, length: cum[cum.length - 1] };
  });
  const glyph = { id, strokes };
  cache.set(id, glyph);
  return glyph;
}

/** "M x y L x y ..." for drawing a run of points as an SVG path. */
export function pathD(points: Pt[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/** The point `s` along a stroke. */
export function pointAt(stroke: Stroke, s: number): Pt {
  if (s <= 0) return stroke.points[0];
  if (s >= stroke.length) return stroke.points[stroke.points.length - 1];
  let i = 1;
  while (stroke.cum[i] < s) i += 1;
  const t = (s - stroke.cum[i - 1]) / (stroke.cum[i] - stroke.cum[i - 1] || 1);
  const a = stroke.points[i - 1];
  const b = stroke.points[i];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** The part of a stroke from its start to `s`: the ink laid down so far. */
export function inkUpTo(stroke: Stroke, s: number): Pt[] {
  if (s <= 0) return [];
  const out: Pt[] = [];
  for (let i = 0; i < stroke.points.length && stroke.cum[i] < s; i += 1) out.push(stroke.points[i]);
  out.push(pointAt(stroke, s));
  return out;
}

/* ------------------------------------------------------------------ */
/* Following a stroke                                                  */
/* ------------------------------------------------------------------ */

/** How close a touch must be to the line to draw. Generous: small fingers are not precise. */
export const TOLERANCE = 13;
/** Farther than this is clearly not tracing: a soft nudge, once per wander. */
export const OFF_COURSE = 26;
/** A stroke is begun by touching within this of where the ink ends (the start dot at first). */
export const START_RADIUS = 16;
/** How far ahead of the ink a touch may reach, so a loop cannot be skipped across. */
export const LOOKAHEAD = 30;
/** Within this of the end, the stroke is finished and snaps shut. */
export const END_RADIUS = 9;

export type Trace = {
  /** Which stroke of the glyph is being drawn. */
  stroke: number;
  /** How far along it the ink reaches. */
  progress: number;
  /** A finger is down and following. */
  down: boolean;
  /** The finger is out beyond OFF_COURSE right now. */
  off: boolean;
  /** Times it wandered off course on this stroke. */
  misses: number;
  done: boolean;
};

export const newTrace = (): Trace => ({ stroke: 0, progress: 0, down: false, off: false, misses: 0, done: false });

export type TraceEvent =
  | { type: 'none' }
  | { type: 'started' }
  | { type: 'off' }
  /** A stroke is complete. `clean` means it never wandered off course. */
  | { type: 'stroke'; clean: boolean }
  | { type: 'glyph'; clean: boolean };

type Step = { trace: Trace; event: TraceEvent };

/** A finger touches down. It only starts drawing if it is where the ink ends. */
export function begin(glyph: Glyph, trace: Trace, p: Pt): Step {
  if (trace.done) return { trace, event: { type: 'none' } };
  const stroke = glyph.strokes[trace.stroke];
  if (dist(p, pointAt(stroke, trace.progress)) > START_RADIUS) return { trace, event: { type: 'none' } };
  return { trace: { ...trace, down: true, off: false }, event: { type: 'started' } };
}

/** The finger moves. */
export function drag(glyph: Glyph, trace: Trace, p: Pt): Step {
  if (!trace.down || trace.done) return { trace, event: { type: 'none' } };

  const stroke = glyph.strokes[trace.stroke];
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < stroke.points.length; i += 1) {
    const along = stroke.cum[i];
    if (along < trace.progress - 4) continue;
    if (along > trace.progress + LOOKAHEAD) break;
    const d = dist(p, stroke.points[i]);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }

  if (best < 0 || bestDistance > TOLERANCE) {
    if (bestDistance > OFF_COURSE) {
      // Clearly away from the line: one soft nudge per wander, not one per movement.
      return trace.off
        ? { trace, event: { type: 'none' } }
        : { trace: { ...trace, off: true, misses: trace.misses + 1 }, event: { type: 'off' } };
    }
    // Close, but not close enough to draw. Nothing happens, and a wander is over.
    return { trace: trace.off ? { ...trace, off: false } : trace, event: { type: 'none' } };
  }

  const progress = Math.max(trace.progress, stroke.cum[best]);
  if (progress < stroke.length - END_RADIUS) {
    return { trace: { ...trace, progress, off: false }, event: { type: 'none' } };
  }

  // The stroke is finished. The next one has to be started afresh.
  const clean = trace.misses === 0;
  const last = trace.stroke === glyph.strokes.length - 1;
  return {
    trace: last
      ? { ...trace, progress: stroke.length, down: false, off: false, done: true }
      : { stroke: trace.stroke + 1, progress: 0, down: false, off: false, misses: 0, done: false },
    event: last ? { type: 'glyph', clean } : { type: 'stroke', clean },
  };
}

/** The finger lifts. The ink stays where it got to. */
export function lift(trace: Trace): Trace {
  return trace.down ? { ...trace, down: false, off: false } : trace;
}
