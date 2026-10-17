import { describe, expect, it } from 'vitest';
import {
  FADE_AFTER,
  HINTS_STORAGE_KEY,
  NEW_HINT_STATE,
  RETURN_AFTER,
  loadHintState,
  nextHintState,
  saveHintState,
} from '../data/hints';
import type { HintState } from '../data/hints';
import {
  BOX_WAITS,
  MAX_BOX,
  REVIEW_STORAGE_KEY,
  SECURE_BOX,
  dueForReview,
  kasirItemKey,
  loadReview,
  mazeItemKey,
  mazeItemPrefix,
  recordResult,
} from '../data/review';
import { CHECKOUTS, REVIEW_EVERY, nextCheckout } from '../data/money';
import { resolveNativeSteps } from '../audio/voice';
import type { VoiceStep } from '../audio/voice';
import { stepsFor } from '../media/voiceParts';

/** Applies a run of right (true) and wrong (false) choices. */
const run = (start: HintState, ...choices: boolean[]) =>
  choices.reduce((state, correct) => nextHintState(state, correct), start);

describe('fading hints', () => {
  it('start guided, for a child nobody has seen yet', () => {
    expect(NEW_HINT_STATE).toEqual({ level: 'guided', streak: 0 });
  });

  it(`fade after ${FADE_AFTER} right choices in a row`, () => {
    const right = Array<boolean>(FADE_AFTER).fill(true);

    expect(run(NEW_HINT_STATE, ...right.slice(0, -1))).toEqual({ level: 'guided', streak: FADE_AFTER - 1 });
    expect(run(NEW_HINT_STATE, ...right)).toEqual({ level: 'independent', streak: 0 });
  });

  it('are not faded by right choices that are interrupted by a wrong one', () => {
    expect(run(NEW_HINT_STATE, true, true, false, true, true)).toEqual({ level: 'guided', streak: 2 });
  });

  it(`come back after ${RETURN_AFTER} wrong choices in a row`, () => {
    const independent: HintState = { level: 'independent', streak: 0 };

    expect(run(independent, false)).toEqual({ level: 'independent', streak: 1 });
    expect(run(independent, false, false)).toEqual({ level: 'guided', streak: 0 });
  });

  it('are not brought back by wrong choices that a right one interrupts', () => {
    const independent: HintState = { level: 'independent', streak: 0 };

    expect(run(independent, false, true, false)).toEqual({ level: 'independent', streak: 1 });
  });

  it('settle into a cycle rather than a trap: either level can be left', () => {
    let state = NEW_HINT_STATE;
    state = run(state, true, true, true);
    expect(state.level).toBe('independent');
    state = run(state, false, false);
    expect(state.level).toBe('guided');
    state = run(state, true, true, true);
    expect(state.level).toBe('independent');
  });

  it('are remembered per game, and one game does not touch the other', () => {
    window.localStorage.removeItem(HINTS_STORAGE_KEY); // the test setup graduates everyone by default
    saveHintState('labirin', { level: 'independent', streak: 1 });

    expect(loadHintState('labirin')).toEqual({ level: 'independent', streak: 1 });
    expect(loadHintState('kasir')).toEqual(NEW_HINT_STATE);
  });

  it('start over when what was saved is not understood', () => {
    window.localStorage.setItem(HINTS_STORAGE_KEY, '{"labirin": {"level": "expert"}}');
    expect(loadHintState('labirin')).toEqual(NEW_HINT_STATE);

    window.localStorage.setItem(HINTS_STORAGE_KEY, 'not json');
    expect(loadHintState('labirin')).toEqual(NEW_HINT_STATE);
  });
});

describe('the review book', () => {
  const T0 = 1_000_000_000_000;
  const MIN = 60 * 1000;
  const DAY = 24 * 60 * MIN;

  it('ignores a right answer for something never missed - nothing to review', () => {
    recordResult('maze:letters:latin:3', true, T0);

    expect(loadReview()).toEqual({});
    expect(dueForReview('maze:', T0)).toEqual([]);
  });

  it('makes a miss due at once, at the bottom of the ladder', () => {
    recordResult('maze:letters:latin:3', false, T0);

    expect(loadReview()['maze:letters:latin:3']).toEqual({ box: 0, due: T0, misses: 1 });
    expect(dueForReview('maze:', T0)).toEqual(['maze:letters:latin:3']);
  });

  it('counts every miss', () => {
    recordResult('k', false, T0);
    recordResult('k', false, T0 + 1);

    expect(loadReview().k.misses).toBe(2);
  });

  it('climbs one rung per right answer, each further away than the last', () => {
    recordResult('k', false, T0);
    const dues: number[] = [];
    for (let i = 1; i <= MAX_BOX; i += 1) {
      recordResult('k', true, T0);
      dues.push(loadReview().k.due - T0);
      expect(loadReview().k.box).toBe(i);
    }

    expect(dues).toEqual(BOX_WAITS.slice(1));
    // Ten minutes, a day, three days, a week: spaced, and growing.
    expect(dues).toEqual([10 * MIN, DAY, 3 * DAY, 7 * DAY]);
  });

  it('stops climbing at the top', () => {
    recordResult('k', false, T0);
    for (let i = 0; i < 10; i += 1) recordResult('k', true, T0);

    expect(loadReview().k.box).toBe(MAX_BOX);
  });

  it('drops back to the bottom on a new miss, however far it had climbed', () => {
    recordResult('k', false, T0);
    recordResult('k', true, T0);
    recordResult('k', true, T0);
    recordResult('k', false, T0 + DAY);

    expect(loadReview().k).toEqual({ box: 0, due: T0 + DAY, misses: 2 });
  });

  it('is not due again until its time has come', () => {
    recordResult('k', false, T0);
    recordResult('k', true, T0); // box 1: ten minutes

    expect(dueForReview('', T0 + 5 * MIN)).toEqual([]);
    expect(dueForReview('', T0 + 10 * MIN)).toEqual(['k']);
  });

  it('stops asking once it is secure', () => {
    recordResult('k', false, T0);
    for (let i = 0; i < SECURE_BOX; i += 1) recordResult('k', true, T0);

    expect(dueForReview('', T0 + 30 * DAY)).toEqual([]);
  });

  it('offers only what matches the prefix, most overdue first', () => {
    recordResult('maze:letters:latin:5', false, T0 + 2);
    recordResult('maze:letters:latin:2', false, T0 + 1);
    recordResult('maze:numbers:latin:7', false, T0);
    recordResult('kasir:Roti', false, T0);

    expect(dueForReview(mazeItemPrefix('letters', 'latin'), T0 + 10)).toEqual([
      'maze:letters:latin:2',
      'maze:letters:latin:5',
    ]);
  });

  it('keeps letters and numbers, and the two scripts, apart', () => {
    const keys = [
      mazeItemKey('letters', 'latin', 3),
      mazeItemKey('letters', 'arab', 3),
      mazeItemKey('numbers', 'latin', 3),
      mazeItemKey('numbers', 'arab', 3),
      kasirItemKey('Roti'),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('copes with a book that is garbled', () => {
    window.localStorage.setItem(REVIEW_STORAGE_KEY, '[1, 2');
    expect(loadReview()).toEqual({});

    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify({ good: { box: 0, due: 0, misses: 1 }, bad: 7 }));
    expect(Object.keys(loadReview())).toEqual(['good']);
  });

  it('keeps nothing but the child\'s own marks, on this device', () => {
    recordResult('maze:letters:latin:3', false, T0);

    const stored = window.localStorage.getItem(REVIEW_STORAGE_KEY)!;
    expect(Object.keys(JSON.parse(stored))).toEqual(['maze:letters:latin:3']);
  });
});

describe('who is at the till next', () => {
  it('follows the fixed order when nothing is being reviewed', () => {
    let cursor = { index: 0, sequential: 0 };
    const seen: number[] = [cursor.index];
    for (let round = 1; round < CHECKOUTS.length * 2; round += 1) {
      cursor = nextCheckout(cursor.sequential, round, []);
      seen.push(cursor.index);
    }

    expect(seen.slice(0, CHECKOUTS.length)).toEqual(CHECKOUTS.map((_, i) => i));
    expect(seen[CHECKOUTS.length]).toBe(0); // and round again
  });

  it(`brings a missed customer back every ${REVIEW_EVERY}rd one`, () => {
    const roti = CHECKOUTS.findIndex((c) => c.item === 'Roti');
    const at = nextCheckout(1, REVIEW_EVERY - 1, ['Roti']);

    expect(at.index).toBe(roti);
  });

  it('does not lose its place in the order on a review customer', () => {
    const review = nextCheckout(1, REVIEW_EVERY - 1, ['Roti']);
    const after = nextCheckout(review.sequential, REVIEW_EVERY, ['Roti']);

    expect(review.sequential).toBe(1);
    expect(after.index).toBe(2);
  });

  it('does not review off the beat, nor when nothing is missed', () => {
    expect(nextCheckout(0, 1, ['Roti']).index).toBe(1);
    expect(nextCheckout(0, REVIEW_EVERY - 1, []).index).toBe(1);
  });

  it('ignores a missed name that is not a customer', () => {
    expect(nextCheckout(0, REVIEW_EVERY - 1, ['Unicorn']).index).toBe(1);
  });
});

describe('native voices, settled for the device', () => {
  const arabic = { text: 'ألف', lang: 'ar-SA' };
  const hasArabic = (lang: string) => lang === 'ar-SA';
  const none = () => false;

  const alif = (): VoiceStep[] =>
    stepsFor([
      { clip: 'x/dari', text: 'Ikuti huruf dari' },
      { clip: 'letters/ar/alif', text: 'alif', native: arabic },
      { clip: 'x/sampai', text: 'sampai' },
      { clip: 'letters/ar/ba', text: 'ba!', native: { text: 'باء', lang: 'ar-SA' } },
    ]);

  it('keeps the Arabic apart, as its own utterance, when the device has an Arabic voice', () => {
    const steps = resolveNativeSteps(alif(), hasArabic);

    expect(steps.map((s) => (s.kind === 'tts' ? s.text : s.url))).toEqual([
      'Ikuti huruf dari',
      'alif',
      'sampai',
      'ba!',
    ]);
    expect(steps.filter((s) => s.kind === 'tts' && s.native)).toHaveLength(2);
  });

  it('joins it back into one sentence with the transliteration when there is none', () => {
    const steps = resolveNativeSteps(alif(), none);

    expect(steps).toEqual([{ kind: 'tts', text: 'Ikuti huruf dari alif sampai ba!', opts: undefined }]);
  });

  it('does not join parts that were never one sentence', () => {
    const total: VoiceStep = { kind: 'tts', text: 'wahid!', opts: { rate: 0.85 }, native: arabic };
    const praise: VoiceStep = { kind: 'tts', text: 'Pintar!', opts: { rate: 0.85 } };

    expect(resolveNativeSteps([total, praise], none)).toHaveLength(2);
  });

  it('leaves recordings and ordinary speech alone', () => {
    const steps: VoiceStep[] = [
      { kind: 'clip', url: 'a.mp3' },
      { kind: 'tts', text: 'Hebat!' },
    ];

    expect(resolveNativeSteps(steps, hasArabic)).toEqual(steps);
  });
});
