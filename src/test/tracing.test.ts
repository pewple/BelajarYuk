import { describe, expect, it } from 'vitest';
import {
  DOT_LENGTH,
  END_RADIUS,
  LOOKAHEAD,
  OFF_COURSE,
  START_RADIUS,
  TOLERANCE,
  TRACE_ARABIC_DIGITS,
  TRACE_DIGITS,
  TRACE_HIJAIYAH,
  TRACE_LETTERS,
  TRACE_LOWERCASE,
  begin,
  drag,
  glyphOf,
  glyphsFor,
  inkUpTo,
  isArabicKind,
  lift,
  newTrace,
  pathD,
  pointAt,
} from '../data/tracing';
import type { Glyph, Pt, Trace, TraceEvent, TraceKind } from '../data/tracing';
import { HIJAIYAH } from '../data/scripts';

const KINDS: TraceKind[] = ['letters', 'lowercase', 'numbers', 'hijaiyah', 'arabicNumbers'];
const ALL = KINDS.flatMap((kind) => glyphsFor(kind));

/** Points along stroke `n` of a glyph, `gap` apart, each moved sideways by `offset`. */
function along(glyph: Glyph, n: number, gap = 3, offset = 0): Pt[] {
  const stroke = glyph.strokes[n];
  const out: Pt[] = [];
  for (let s = 0; s <= stroke.length; s += gap) {
    const here = pointAt(stroke, s);
    const ahead = pointAt(stroke, Math.min(s + 1, stroke.length));
    const behind = pointAt(stroke, Math.max(s - 1, 0));
    const dx = ahead.x - behind.x;
    const dy = ahead.y - behind.y;
    const len = Math.hypot(dx, dy) || 1;
    out.push({ x: here.x - (dy / len) * offset, y: here.y + (dx / len) * offset });
  }
  out.push(pointAt(stroke, stroke.length));
  return out;
}

/** Plays a perfect finger over the whole glyph and returns every event that was not "none". */
function traceAll(glyph: Glyph, offset = 0): { trace: Trace; events: TraceEvent[] } {
  let trace = newTrace();
  const events: TraceEvent[] = [];
  const take = (step: { trace: Trace; event: TraceEvent }) => {
    trace = step.trace;
    if (step.event.type !== 'none') events.push(step.event);
  };

  for (let n = 0; n < glyph.strokes.length; n += 1) {
    take(begin(glyph, trace, glyph.strokes[n].points[0]));
    for (const p of along(glyph, n, 3, offset)) take(drag(glyph, trace, p));
    trace = lift(trace);
  }
  return { trace, events };
}

describe('the glyphs', () => {
  it('are every kind a child can write, each in the order it is learned', () => {
    expect(TRACE_LETTERS.join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(TRACE_LOWERCASE.join('')).toBe('abcdefghijklmnopqrstuvwxyz');
    expect(TRACE_DIGITS.join('')).toBe('0123456789');
    expect(TRACE_HIJAIYAH).toEqual(HIJAIYAH.map((letter) => letter.glyph));
    expect(TRACE_HIJAIYAH).toHaveLength(28);
    expect(TRACE_ARABIC_DIGITS.join('')).toBe('٠١٢٣٤٥٦٧٨٩');
    expect(glyphsFor('letters')).toBe(TRACE_LETTERS);
    expect(glyphsFor('lowercase')).toBe(TRACE_LOWERCASE);
    expect(glyphsFor('numbers')).toBe(TRACE_DIGITS);
    expect(glyphsFor('hijaiyah')).toBe(TRACE_HIJAIYAH);
    expect(glyphsFor('arabicNumbers')).toBe(TRACE_ARABIC_DIGITS);
  });

  it('are in order: letters alphabetical, digits numerical - nothing out of sequence', () => {
    expect([...TRACE_LETTERS].sort()).toEqual(TRACE_LETTERS);
    expect([...TRACE_LOWERCASE].sort()).toEqual(TRACE_LOWERCASE);
    expect(TRACE_DIGITS.map(Number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(TRACE_ARABIC_DIGITS.map((d) => d.charCodeAt(0))).toEqual(
      Array.from({ length: 10 }, (_, n) => 0x0660 + n),
    );
  });

  it('know which kinds are written from right to left', () => {
    expect(KINDS.filter(isArabicKind)).toEqual(['hijaiyah', 'arabicNumbers']);
  });

  it.each(KINDS)('have no two %s the same: every one is its own shape', (kind) => {
    // (Across kinds a straight stroke is a straight stroke: the capital I is also ١.)
    const shapes = glyphsFor(kind).map((id) =>
      JSON.stringify(glyphOf(id).strokes.map((s) => s.points.map((p) => [Math.round(p.x), Math.round(p.y)]))),
    );
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it.each(ALL)('%s has strokes, all of them on the board and long enough to draw (or a dot)', (id) => {
    const glyph = glyphOf(id);

    expect(glyph.strokes.length).toBeGreaterThan(0);
    for (const stroke of glyph.strokes) {
      // A dot is a stroke too short to follow: touching it draws it.
      if (stroke.length > DOT_LENGTH) expect(stroke.length).toBeGreaterThan(25);
      expect(stroke.length).toBeGreaterThan(1);
      for (const p of stroke.points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it.each(ALL)('%s is drawn with no gaps: points are never far apart', (id) => {
    for (const stroke of glyphOf(id).strokes) {
      for (let i = 1; i < stroke.points.length; i += 1) {
        const gap = Math.hypot(stroke.points[i].x - stroke.points[i - 1].x, stroke.points[i].y - stroke.points[i - 1].y);
        expect(gap, `${id} point ${i}`).toBeLessThan(5);
      }
    }
  });

  it('are cached, so each is built once', () => {
    expect(glyphOf('A')).toBe(glyphOf('A'));
  });

  it('refuses a glyph it has no strokes for', () => {
    expect(() => glyphOf('é')).toThrow();
  });

  it('start the way children are taught: letters mostly at the top', () => {
    const topStart = TRACE_LETTERS.filter((id) => glyphOf(id).strokes[0].points[0].y <= 15);
    // Everything but the letters that begin with a curve at the side or a stroke at the foot.
    expect(topStart.length).toBeGreaterThanOrEqual(20);
  });

  it('start Arabic letters on the right of the letter, because Arabic is written from right to left', () => {
    for (const id of TRACE_HIJAIYAH) {
      const xs = glyphOf(id).strokes.flatMap((stroke) => stroke.points.map((p) => p.x));
      const [low, high] = [Math.min(...xs), Math.max(...xs)];
      // The right of the letter: not always the right half: the neck of dal and dzal starts a little in from the edge.
      expect(glyphOf(id).strokes[0].points[0].x, id).toBeGreaterThanOrEqual(low + 0.25 * (high - low));
    }
  });

  it('write the body of an Arabic letter first and its dots last', () => {
    for (const id of TRACE_HIJAIYAH) {
      const strokes = glyphOf(id).strokes;
      const dotsFrom = strokes.findIndex((s) => s.length <= DOT_LENGTH);
      if (dotsFrom < 0) continue;
      expect(dotsFrom, id).toBeGreaterThan(0);
      for (const stroke of strokes.slice(dotsFrom)) expect(stroke.length, id).toBeLessThanOrEqual(DOT_LENGTH);
    }
  });

  it('give each dotted Arabic letter the dots it has', () => {
    const dots = (id: string) => glyphOf(id).strokes.filter((s) => s.length <= DOT_LENGTH).length;
    // Alif to ya: none, one, two, three, one, none, one ...
    const expected = [0, 1, 2, 3, 1, 0, 1, 0, 1, 0, 1, 0, 3, 0, 1, 0, 1, 0, 1, 1, 2, 0, 0, 0, 1, 0, 0, 2];
    expect(TRACE_HIJAIYAH.map(dots)).toEqual(expected);
  });

  it('draw the eight as one closed figure and the six as a loop that comes back to its stem', () => {
    const eight = glyphOf('8').strokes[0];
    const six = glyphOf('6').strokes[0];
    const gap = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

    // It ends where it began - the top of the eight is closed - and passes through the waist twice.
    expect(gap(eight.points[0], eight.points.at(-1)!)).toBeLessThan(2);
    const waist = eight.points.filter((p) => gap(p, { x: 50, y: 50 }) < 2);
    expect(waist.length).toBeGreaterThanOrEqual(2);

    // The six runs down its stem and round the whole bowl, back to where the stem came down.
    const stemFoot = six.points.reduce((best, p) => (p.x < best.x ? p : best), six.points[0]);
    expect(gap(six.points.at(-1)!, stemFoot)).toBeLessThan(4);
    expect(Math.max(...six.points.map((p) => p.y))).toBeGreaterThan(85); // right round the bottom
    expect(Math.max(...six.points.map((p) => p.x))).toBeGreaterThan(65); // and up the right side
  });

  it('put the small letters on the copybook lines, tall letters up to the top and deep ones below', () => {
    const top = (id: string) => Math.min(...glyphOf(id).strokes.flatMap((s) => s.points.map((p) => p.y)));
    const bottom = (id: string) => Math.max(...glyphOf(id).strokes.flatMap((s) => s.points.map((p) => p.y)));

    for (const id of 'acemnorsuvwxz'.split('')) {
      expect(top(id), id).toBeGreaterThanOrEqual(30); // they stay below the middle line
      expect(bottom(id), id).toBeLessThanOrEqual(78); // and on the baseline
    }
    for (const id of 'bdfhklt'.split('')) expect(top(id), id).toBeLessThanOrEqual(16); // ascenders
    for (const id of 'gjpqy'.split('')) expect(bottom(id), id).toBeGreaterThanOrEqual(86); // descenders
  });
});

describe('tracing a glyph', () => {
  it.each(ALL)('%s can be traced from start to finish with a steady finger', (id) => {
    const glyph = glyphOf(id);
    const { trace, events } = traceAll(glyph);

    expect(trace.done, id).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'glyph', clean: true });
    expect(events.filter((e) => e.type === 'stroke')).toHaveLength(glyph.strokes.length - 1);
  });

  it.each(ALL)('%s can be traced by a wobbly finger, off the line by up to a bit under the tolerance', (id) => {
    const { trace } = traceAll(glyphOf(id), TOLERANCE * 0.6);

    expect(trace.done, id).toBe(true);
  });

  it('reports each stroke as it finishes, and the glyph at the end', () => {
    const { events } = traceAll(glyphOf('E')); // four strokes

    expect(events.map((e) => e.type)).toEqual([
      'started', 'stroke', 'started', 'stroke', 'started', 'stroke', 'started', 'glyph',
    ]);
  });

  it('wants each stroke started afresh: a finger that finishes one is lifted', () => {
    const glyph = glyphOf('H');
    let trace = begin(glyph, newTrace(), glyph.strokes[0].points[0]).trace;
    let last: TraceEvent = { type: 'none' };
    for (const p of along(glyph, 0)) {
      const step = drag(glyph, trace, p);
      trace = step.trace;
      if (step.event.type !== 'none') last = step.event;
    }

    expect(last.type).toBe('stroke');
    expect(trace).toMatchObject({ stroke: 1, progress: 0, down: false });
  });

  it('does nothing once the glyph is done', () => {
    const glyph = glyphOf('L');
    const { trace } = traceAll(glyph);

    expect(begin(glyph, trace, glyph.strokes[0].points[0]).event.type).toBe('none');
    expect(drag(glyph, trace, { x: 25, y: 50 }).event.type).toBe('none');
  });
});

describe('dots', () => {
  it('are drawn by touching them: there is nothing to follow', () => {
    const glyph = glyphOf('i');
    const body = glyph.strokes[0];
    let trace = begin(glyph, newTrace(), body.points[0]).trace;
    for (const p of along(glyph, 0)) trace = drag(glyph, trace, p).trace;
    trace = lift(trace);
    expect(trace).toMatchObject({ stroke: 1, progress: 0 });

    const touched = begin(glyph, trace, glyph.strokes[1].points[0]);
    expect(touched.event).toEqual({ type: 'glyph', clean: true });
    expect(touched.trace.done).toBe(true);
  });

  it('are not drawn by a touch somewhere else', () => {
    const glyph = glyphOf('i');
    let trace = begin(glyph, newTrace(), glyph.strokes[0].points[0]).trace;
    for (const p of along(glyph, 0)) trace = drag(glyph, trace, p).trace;
    trace = lift(trace);

    expect(begin(glyph, trace, { x: 5, y: 95 }).event.type).toBe('none');
  });

  it('can be a whole glyph: Arabic zero is a dot, and is done at once', () => {
    const glyph = glyphOf('٠');
    const step = begin(glyph, newTrace(), glyph.strokes[0].points[0]);

    expect(step.event).toEqual({ type: 'glyph', clean: true });
    expect(step.trace.done).toBe(true);
  });
});

describe('following smoothly', () => {
  it('puts the ink exactly under the finger, not on the nearest corner of the line', () => {
    const glyph = glyphOf('I'); // a straight line down: progress is just how far down the finger is
    const stroke = glyph.strokes[0];
    let trace = begin(glyph, newTrace(), stroke.points[0]).trace;

    for (const y of [13.3, 17.1, 22.7, 31.9, 40.03]) {
      trace = drag(glyph, trace, { x: 50, y }).trace;
      expect(trace.progress, `finger at ${y}`).toBeCloseTo(y - stroke.points[0].y, 1);
    }
  });

  it('follows a finger that is beside the line as far along as it has got', () => {
    const glyph = glyphOf('I');
    let trace = begin(glyph, newTrace(), glyph.strokes[0].points[0]).trace;
    trace = drag(glyph, trace, { x: 58, y: 40 }).trace;

    expect(trace.progress).toBeCloseTo(30, 1);
  });

  it('never takes ink back when the finger wobbles backwards', () => {
    const glyph = glyphOf('I');
    let trace = begin(glyph, newTrace(), glyph.strokes[0].points[0]).trace;
    trace = drag(glyph, trace, { x: 50, y: 40 }).trace;
    const reached = trace.progress;
    trace = drag(glyph, trace, { x: 50, y: 36 }).trace;

    expect(trace.progress).toBe(reached);
  });

  it('keeps its place where the path crosses itself: round the eight and through its waist twice', () => {
    const glyph = glyphOf('8');
    const stroke = glyph.strokes[0];
    let trace = begin(glyph, newTrace(), stroke.points[0]).trace;
    for (let s = 0; s <= stroke.length; s += 2) trace = drag(glyph, trace, pointAt(stroke, s)).trace;

    expect(trace.done).toBe(true);
    expect(trace.misses).toBe(0);
  });
});

describe('starting', () => {
  const glyph = glyphOf('A');

  it('works from the start dot, and a little way around it', () => {
    const start = glyph.strokes[0].points[0];

    expect(begin(glyph, newTrace(), start).event.type).toBe('started');
    expect(begin(glyph, newTrace(), { x: start.x + START_RADIUS - 2, y: start.y }).event.type).toBe('started');
  });

  it('is ignored anywhere else, so a stray tap draws nothing', () => {
    const away = begin(glyph, newTrace(), { x: 90, y: 50 });

    expect(away.event.type).toBe('none');
    expect(away.trace.down).toBe(false);
  });

  it('is ignored just outside the start radius', () => {
    const start = glyph.strokes[0].points[0];
    expect(begin(glyph, newTrace(), { x: start.x + START_RADIUS + 3, y: start.y }).event.type).toBe('none');
  });

  it('does not draw while no finger is down', () => {
    const step = drag(glyph, newTrace(), glyph.strokes[0].points[5]);

    expect(step.event.type).toBe('none');
    expect(step.trace.progress).toBe(0);
  });
});

describe('wandering', () => {
  const glyph = glyphOf('L');
  const stroke = glyph.strokes[0];

  function startedAt(distance: number) {
    let trace = begin(glyph, newTrace(), stroke.points[0]).trace;
    for (const p of along(glyph, 0).slice(0, 8)) trace = drag(glyph, trace, p).trace;
    expect(trace.progress).toBeGreaterThan(distance);
    return trace;
  }

  it('stops the ink without losing it', () => {
    const trace = startedAt(10);
    const far = drag(glyph, trace, { x: 90, y: 20 });

    expect(far.trace.progress).toBe(trace.progress);
  });

  it('is a soft nudge once per wander, not once per movement', () => {
    let trace = startedAt(10);
    const nudges: string[] = [];
    for (const p of [{ x: 95, y: 15 }, { x: 96, y: 14 }, { x: 97, y: 13 }]) {
      const step = drag(glyph, trace, p);
      trace = step.trace;
      nudges.push(step.event.type);
    }

    expect(nudges).toEqual(['off', 'none', 'none']);
    expect(trace.misses).toBe(1);
  });

  it('counts a second wander after the finger has come back', () => {
    let trace = startedAt(10);
    const wander = (p: Pt) => (trace = drag(glyph, trace, p).trace);
    wander({ x: 95, y: 15 });
    wander(pointAt(stroke, trace.progress + 3)); // back on the line
    wander({ x: 95, y: 15 });

    expect(trace.misses).toBe(2);
  });

  it('is only counted beyond the off-course distance - near the line is just slow', () => {
    const trace = startedAt(10);
    const here = pointAt(stroke, trace.progress);
    const step = drag(glyph, trace, { x: here.x + (TOLERANCE + OFF_COURSE) / 2, y: here.y });

    expect(step.event.type).toBe('none');
    expect(step.trace.misses).toBe(0);
  });

  it('carries on from where the ink ended when the finger comes back', () => {
    let trace = startedAt(10);
    const reached = trace.progress;
    trace = drag(glyph, trace, { x: 95, y: 15 }).trace;
    trace = drag(glyph, trace, pointAt(stroke, reached + 6)).trace;

    expect(trace.progress).toBeGreaterThan(reached);
  });

  it('can lift and put the finger down again at the end of the ink, and carry on', () => {
    let trace = startedAt(10);
    const reached = trace.progress;
    trace = lift(trace);
    expect(trace.down).toBe(false);

    const again = begin(glyph, trace, pointAt(stroke, reached));
    expect(again.event.type).toBe('started');
    expect(drag(glyph, again.trace, pointAt(stroke, reached + 4)).trace.progress).toBeGreaterThan(reached);
  });

  it('cannot put the finger down far from the ink to carry on', () => {
    const trace = lift(startedAt(10));
    expect(begin(glyph, trace, pointAt(stroke, trace.progress + 40)).event.type).toBe('none');
  });

  it('reports a stroke that wandered as not clean', () => {
    let trace = startedAt(10);
    trace = drag(glyph, trace, { x: 95, y: 15 }).trace;
    let last: TraceEvent = { type: 'none' };
    for (const p of along(glyph, 0, 3).slice(8)) {
      const step = drag(glyph, trace, p);
      trace = step.trace;
      if (step.event.type !== 'none') last = step.event;
    }

    expect(last).toEqual({ type: 'glyph', clean: false });
  });
});

describe('shortcuts', () => {
  it('cannot be taken: jumping ahead along the line is limited to the look-ahead', () => {
    const glyph = glyphOf('O');
    const stroke = glyph.strokes[0];
    let trace = begin(glyph, newTrace(), stroke.points[0]).trace;
    // The finger leaps to the point of the circle farthest along from the start.
    trace = drag(glyph, trace, pointAt(stroke, stroke.length - 2)).trace;

    expect(trace.done).toBe(false);
    expect(trace.progress).toBeLessThanOrEqual(LOOKAHEAD);
  });

  it('cannot cut across a closed shape to finish it early', () => {
    const glyph = glyphOf('0');
    const stroke = glyph.strokes[0];
    let trace = begin(glyph, newTrace(), stroke.points[0]).trace;
    // Straight across the middle to the bottom of the zero.
    trace = drag(glyph, trace, { x: 50, y: 90 }).trace;

    expect(trace.progress).toBeLessThan(LOOKAHEAD + 1);
    expect(trace.done).toBe(false);
  });

  it('snaps shut within the end radius', () => {
    const glyph = glyphOf('I');
    const stroke = glyph.strokes[0];
    let trace = begin(glyph, newTrace(), stroke.points[0]).trace;
    for (const p of along(glyph, 0).slice(0, -1)) trace = drag(glyph, trace, p).trace;
    // Stopping just short of the end still finishes it.
    const step = drag(glyph, trace, pointAt(stroke, stroke.length - END_RADIUS + 1));

    expect(trace.done || step.trace.done).toBe(true);
  });
});

describe('drawing the ink', () => {
  const stroke = glyphOf('L').strokes[0];

  it('is nothing before the finger has moved', () => {
    expect(inkUpTo(stroke, 0)).toEqual([]);
  });

  it('runs from the start to exactly where the ink has reached', () => {
    const ink = inkUpTo(stroke, 30);

    expect(ink[0]).toEqual(stroke.points[0]);
    expect(ink.at(-1)).toEqual(pointAt(stroke, 30));
  });

  it('is the whole stroke once it is finished', () => {
    const ink = inkUpTo(stroke, stroke.length);

    expect(ink.at(-1)).toEqual(stroke.points.at(-1));
  });

  it('makes an SVG path of points, and none of an empty run', () => {
    expect(pathD([{ x: 1, y: 2 }, { x: 3.14159, y: 4 }])).toBe('M1.0 2.0 L3.1 4.0');
    expect(pathD([])).toBe('');
  });
});
