import { ARABIC_GLYPH_STROKES } from './glyphsArabic';
import { CAPITALS, DIGITS, SMALL } from './glyphsLatin';
import { HIJAIYAH, toArabicNumerals } from './scripts';
import { dist, sample } from './strokeDsl';
import type { Pt, StrokeDef } from './strokeDsl';

/**
 * Menulis - tracing letters and numbers with a finger.
 *
 * Each glyph is a few strokes, drawn as centre lines on a 100 x 100 board (see
 * strokeDsl.ts for how, glyphsLatin.ts and glyphsArabic.ts for the glyphs
 * themselves). The child follows each stroke from its start dot; ink appears
 * behind the finger as it stays on the line.
 *
 * Tracing is forgiving by design. A finger that wanders off the line simply
 * stops drawing - nothing is lost, and coming back to where the ink ended
 * carries on. The only way to be "wrong" is to leave the corridor far enough
 * that it was clearly not an attempt, and even that is a soft nudge, not a
 * failure. This file is the rules; the screen draws them.
 */

export type { Pt } from './strokeDsl';

/* ------------------------------------------------------------------ */
/* What there is to trace                                              */
/* ------------------------------------------------------------------ */

const DEFINITIONS: Record<string, StrokeDef[]> = { ...CAPITALS, ...SMALL, ...DIGITS, ...ARABIC_GLYPH_STROKES };

export const TRACE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const TRACE_LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** 0 to 9, counting up. */
export const TRACE_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** The 28 hijaiyah in their traditional order. A glyph is named by the letter itself. */
export const TRACE_HIJAIYAH = HIJAIYAH.map((letter) => letter.glyph);

/** ٠ to ٩, counting up. */
export const TRACE_ARABIC_DIGITS = TRACE_DIGITS.map((digit) => toArabicNumerals(digit));

export type TraceKind = 'letters' | 'lowercase' | 'numbers' | 'hijaiyah' | 'arabicNumbers';

const GLYPHS: Record<TraceKind, string[]> = {
  letters: TRACE_LETTERS,
  lowercase: TRACE_LOWERCASE,
  numbers: TRACE_DIGITS,
  hijaiyah: TRACE_HIJAIYAH,
  arabicNumbers: TRACE_ARABIC_DIGITS,
};

/** Everything of one kind, in the order it is learned: A to Z, a to z, 0 to 9, alif to ya. */
export function glyphsFor(kind: TraceKind): string[] {
  return GLYPHS[kind];
}

/** Written right to left. */
export const isArabicKind = (kind: TraceKind) => kind === 'hijaiyah' || kind === 'arabicNumbers';

/* ------------------------------------------------------------------ */
/* Glyphs, ready to follow                                             */
/* ------------------------------------------------------------------ */

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
/** A stroke this short is a dot: touching its start dot draws it. */
export const DOT_LENGTH = 6;
/** How far back along the line a touch is still matched, so a finger that jitters does not lose its place. */
const LOOKBACK = 4;

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

/** The stroke is finished: on to the next, which has to be started afresh, or the glyph is done. */
function finish(glyph: Glyph, trace: Trace, stroke: Stroke): Step {
  const clean = trace.misses === 0;
  const last = trace.stroke === glyph.strokes.length - 1;
  return {
    trace: last
      ? { ...trace, progress: stroke.length, down: false, off: false, done: true }
      : { stroke: trace.stroke + 1, progress: 0, down: false, off: false, misses: 0, done: false },
    event: last ? { type: 'glyph', clean } : { type: 'stroke', clean },
  };
}

/** A finger touches down. It only starts drawing if it is where the ink ends. */
export function begin(glyph: Glyph, trace: Trace, p: Pt): Step {
  if (trace.done) return { trace, event: { type: 'none' } };
  const stroke = glyph.strokes[trace.stroke];
  if (dist(p, pointAt(stroke, trace.progress)) > START_RADIUS) return { trace, event: { type: 'none' } };

  // A dot is drawn by touching it: there is nothing to follow.
  if (stroke.length <= DOT_LENGTH) return finish(glyph, trace, stroke);

  return { trace: { ...trace, down: true, off: false }, event: { type: 'started' } };
}

/**
 * Where on the stretch of `stroke` between `from` and `to` (distances along
 * it) a point is nearest the line - to a fraction of a unit, not to the
 * nearest corner of the polyline. That is what lets the ink follow a slow
 * finger smoothly instead of stepping from sample to sample.
 */
function project(stroke: Stroke, p: Pt, from: number, to: number): { along: number; distance: number } {
  let best = { along: from, distance: Infinity };

  for (let i = 1; i < stroke.points.length; i += 1) {
    const s0 = stroke.cum[i - 1];
    const s1 = stroke.cum[i];
    if (s1 < from) continue;
    if (s0 > to) break;

    const a = stroke.points[i - 1];
    const b = stroke.points[i];
    const length = s1 - s0 || 1;
    const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (length * length);
    // Keep to the allowed stretch, which may begin or end part-way along a piece.
    const along = Math.min(to, Math.max(from, s0 + Math.min(1, Math.max(0, t)) * length));
    const u = (along - s0) / length;
    const distance = dist(p, { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
    if (distance < best.distance) best = { along, distance };
  }
  return best;
}

/** The finger moves. */
export function drag(glyph: Glyph, trace: Trace, p: Pt): Step {
  if (!trace.down || trace.done) return { trace, event: { type: 'none' } };

  const stroke = glyph.strokes[trace.stroke];
  const near = project(stroke, p, Math.max(0, trace.progress - LOOKBACK), Math.min(stroke.length, trace.progress + LOOKAHEAD));

  if (near.distance > TOLERANCE) {
    if (near.distance > OFF_COURSE) {
      // Clearly away from the line: one soft nudge per wander, not one per movement.
      return trace.off
        ? { trace, event: { type: 'none' } }
        : { trace: { ...trace, off: true, misses: trace.misses + 1 }, event: { type: 'off' } };
    }
    // Close, but not close enough to draw. Nothing happens, and a wander is over.
    return { trace: trace.off ? { ...trace, off: false } : trace, event: { type: 'none' } };
  }

  const progress = Math.max(trace.progress, near.along);
  if (progress < stroke.length - END_RADIUS) {
    return { trace: { ...trace, progress, off: false }, event: { type: 'none' } };
  }

  return finish(glyph, trace, stroke);
}

/** The finger lifts. The ink stays where it got to. */
export function lift(trace: Trace): Trace {
  return trace.down ? { ...trace, down: false, off: false } : trace;
}
