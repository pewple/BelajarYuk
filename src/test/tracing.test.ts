import { describe, expect, it } from 'vitest';
import {
  END_RADIUS,
  LOOKAHEAD,
  OFF_COURSE,
  START_RADIUS,
  TOLERANCE,
  TRACE_DIGITS,
  TRACE_LETTERS,
  begin,
  drag,
  glyphOf,
  glyphsFor,
  inkUpTo,
  lift,
  newTrace,
  pathD,
  pointAt,
} from '../data/tracing';
import type { Glyph, Pt, Trace, TraceEvent } from '../data/tracing';

const ALL = [...TRACE_LETTERS, ...TRACE_DIGITS];

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
  it('are the 26 letters and the ten digits, in the order a child learns them', () => {
    expect(TRACE_LETTERS).toHaveLength(26);
    expect(TRACE_DIGITS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    expect(glyphsFor('letters')).toBe(TRACE_LETTERS);
    expect(glyphsFor('numbers')).toBe(TRACE_DIGITS);
  });

  it.each(ALL)('%s has strokes, all of them on the board and long enough to draw', (id) => {
    const glyph = glyphOf(id);

    expect(glyph.strokes.length).toBeGreaterThan(0);
    for (const stroke of glyph.strokes) {
      expect(stroke.length).toBeGreaterThan(25);
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
