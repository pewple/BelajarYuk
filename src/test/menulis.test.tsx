import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupUser } from './user';
import App from '../App';
import { HINTS_STORAGE_KEY } from '../data/hints';
import { REVIEW_STORAGE_KEY } from '../data/review';
import { HIJAIYAH } from '../data/scripts';
import { UNLOCK_AFTER_GAMES } from '../data/session';
import { OFF_COURSE, glyphOf, pointAt } from '../data/tracing';
import type { Pt } from '../data/tracing';
import { leaveGame } from './helpers';
import { installVoice, playedToneCounts, spokenTexts, spokenUtterances } from './setup';

type User = ReturnType<typeof userEvent.setup>;

/* ------------------------------------------------------------------ */
/* Drivers                                                             */
/* ------------------------------------------------------------------ */

let rect: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  installVoice('Test Indonesian', 'id-ID');
  // jsdom has no layout, so the board is declared to be exactly 100 x 100: a
  // pointer at (x, y) on the page is then at (x, y) on the board.
  rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  rect.mockRestore();
  vi.useRealTimers();
});

const board = () => screen.getByRole('group', { name: /^Papan menulis/ });
const progress = () => Number(board().getAttribute('data-progress'));
const strokeNumber = () => Number(board().getAttribute('data-stroke'));
const isDone = () => board().getAttribute('data-done') === 'true';

const touch = (type: 'pointerdown' | 'pointermove' | 'pointerup', p?: Pt) =>
  fireEvent(board(), new MouseEvent(type, { clientX: p?.x ?? 0, clientY: p?.y ?? 0, bubbles: true }));

/** Where `s` along stroke `n` of glyph `id` is. */
const spot = (id: string, n: number, s: number) => pointAt(glyphOf(id).strokes[n], s);

/** A finger down at the start of stroke `n`, along it `gap` apart (and `off` to one side), and up. */
function traceStroke(id: string, n: number, { gap = 8, off = 0, upTo = Infinity } = {}) {
  const stroke = glyphOf(id).strokes[n];
  touch('pointerdown', { x: stroke.points[0].x, y: stroke.points[0].y });
  for (let s = 0; s <= Math.min(stroke.length, upTo); s += gap) {
    const p = pointAt(stroke, s);
    touch('pointermove', { x: p.x + off, y: p.y + off });
  }
  if (upTo >= stroke.length) touch('pointermove', stroke.points.at(-1));
  touch('pointerup');
}

function traceGlyph(id: string) {
  for (let n = 0; n < glyphOf(id).strokes.length; n += 1) traceStroke(id, n);
}

async function open(user: User) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Menulis/ }));
}

type Choice = 'Huruf' | 'Huruf kecil' | 'Angka' | 'Hijaiyah' | 'Angka Arab';

async function enter(user: User, choice: Choice) {
  await open(user);
  await user.click(screen.getByRole('button', { name: choice }));
}

const nextButton = () =>
  screen.getByRole('button', {
    name: /^(Lewati, berikutnya|Huruf berikutnya|Huruf kecil berikutnya|Angka berikutnya|Huruf hijaiyah berikutnya|Angka Arab berikutnya)$/,
  });
const followDot = () => screen.queryByTestId('follow-dot');

const setHints = (level: 'guided' | 'independent', streak = 0) =>
  window.localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify({ menulis: { level, streak } }));

/* ------------------------------------------------------------------ */

describe('Menulis', () => {
  describe('opening it', () => {
    it('is on the home screen, after Berhitung', () => {
      render(<App />);
      const titles = ['Berhitung', 'Menulis', 'Pola'];
      const order = screen
        .getAllByRole('button')
        .map((b) => titles.find((t) => b.textContent?.includes(t)))
        .filter(Boolean);

      expect(order).toEqual(titles);
    });

    it('asks first what to write, out loud and in writing, and shows no board yet', async () => {
      const user = setupUser();
      await open(user);

      expect(screen.getByRole('heading', { name: 'Menulis' })).toBeInTheDocument();
      for (const name of ['Huruf', 'Huruf kecil', 'Angka', 'Hijaiyah', 'Angka Arab']) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      }
      expect(screen.queryByRole('group', { name: /^Papan menulis/ })).not.toBeInTheDocument();
      expect(spokenTexts).toContain('Pilih huruf atau angka!');
    });

    it('has a speaker button that says the question again', async () => {
      const user = setupUser();
      await open(user);
      spokenTexts.length = 0;
      await user.click(screen.getByRole('button', { name: 'Ulangi perintah' }));

      expect(spokenTexts.join(' ')).toContain('Pilih huruf atau angka');
    });

    it('goes home again', async () => {
      const user = setupUser();
      await open(user);
      await leaveGame(user);

      expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    });

    it('has no script switch: Arabic is a choice of its own, whatever the rest of the app is set to', async () => {
      window.localStorage.setItem('belajar-yuk:script', 'arab');
      const user = setupUser();
      await enter(user, 'Huruf');

      expect(screen.queryByRole('radiogroup', { name: 'Jenis tulisan huruf dan angka' })).not.toBeInTheDocument();
      expect(screen.getByText('Telusuri huruf A')).toBeInTheDocument();
    });
  });

  describe('a letter', () => {
    it('starts at A, with the instruction spoken and a dot to start from', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');

      expect(screen.getByText('Telusuri huruf A')).toBeInTheDocument();
      expect(spokenTexts).toContain('Ikuti garisnya!');
      expect(screen.getByTestId('start-dot')).toBeInTheDocument();
      expect(progress()).toBe(0);
    });

    it('puts the start dot at the start of the first stroke, numbered when there are several', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      const dot = screen.getByTestId('start-dot');
      const start = glyphOf('A').strokes[0].points[0];

      expect(Number(dot.getAttribute('cx'))).toBeCloseTo(start.x, 0);
      expect(Number(dot.getAttribute('cy'))).toBeCloseTo(start.y, 0);
      expect(board().textContent).toContain('1');
    });

    it('draws ink behind the finger while it stays on the line', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      traceStroke('A', 0, { upTo: 30 });

      expect(progress()).toBeGreaterThan(20);
      expect(strokeNumber()).toBe(0);
      expect(board().querySelectorAll('path').length).toBeGreaterThan(glyphOf('A').strokes.length); // guide + ink
    });

    it('says what the letter is when the child first touches it', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      spokenTexts.length = 0;
      traceStroke('A', 0, { upTo: 10 });

      expect(spokenTexts).toContain('a');
    });

    it('moves to the next stroke when one is finished, with its own start dot', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      traceStroke('A', 0);

      expect(strokeNumber()).toBe(1);
      expect(progress()).toBe(0);
      const dot = screen.getByTestId('start-dot');
      const start = glyphOf('A').strokes[1].points[0];
      expect(Number(dot.getAttribute('cx'))).toBeCloseTo(start.x, 0);
      expect(board().textContent).toContain('2');
    });

    it('pops for each stroke, and celebrates the whole letter', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      const before = playedToneCounts.value;
      traceGlyph('A');

      expect(isDone()).toBe(true);
      expect(screen.getByText('Bagus sekali!')).toBeInTheDocument();
      expect(screen.getByText('Huruf A!')).toBeInTheDocument();
      expect(playedToneCounts.value).toBeGreaterThan(before + 6); // pops for three strokes, then the chime
    });

    it('says the name with a cheer, and praises, when the letter is done', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      traceGlyph('A');

      await vi.waitFor(() => expect(spokenTexts).toContain('a!'));
      await vi.waitFor(() => expect(spokenTexts.length).toBeGreaterThanOrEqual(3));
    });

    it('takes the letter language into account: English names when that is chosen', async () => {
      window.localStorage.setItem('belajar-yuk:letter-lang', 'en');
      const user = setupUser();
      await enter(user, 'Huruf');
      await user.click(nextButton()); // B
      spokenTexts.length = 0;
      traceStroke('B', 0, { upTo: 10 });

      expect(spokenTexts).toContain('b'); // "be" in Indonesian
    });

    it('goes on to B with "Lanjut", and on through the alphabet', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      traceGlyph('A');
      await user.click(screen.getByRole('button', { name: 'Huruf berikutnya' }));

      expect(screen.getByText('Telusuri huruf B')).toBeInTheDocument();
      expect(isDone()).toBe(false);
      expect(progress()).toBe(0);
    });

    it('can be skipped without finishing, for a child who has had enough of it', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      await user.click(screen.getByRole('button', { name: 'Lewati, berikutnya' }));

      expect(screen.getByText('Telusuri huruf B')).toBeInTheDocument();
    });

    it('goes round to A again after Z', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      for (let n = 0; n < 26; n += 1) await user.click(nextButton());

      expect(screen.getByText('Telusuri huruf A')).toBeInTheDocument();
    }, 30_000);
  });

  describe('a number', () => {
    it('starts at 0 and says it as a number word', async () => {
      const user = setupUser();
      await enter(user, 'Angka');
      spokenTexts.length = 0;

      expect(screen.getByText('Telusuri angka 0')).toBeInTheDocument();
      traceStroke('0', 0, { upTo: 10 });
      expect(spokenTexts).toContain('nol');
    });

    it('can be traced and celebrated like a letter', async () => {
      const user = setupUser();
      await enter(user, 'Angka');
      await user.click(nextButton()); // 1
      traceGlyph('1');

      expect(isDone()).toBe(true);
      expect(screen.getByText('Angka 1!')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Angka berikutnya' })).toBeInTheDocument();
    });

    it('goes 0 to 9 in counting order, and round again', async () => {
      const user = setupUser();
      await enter(user, 'Angka');
      const seen: string[] = [];
      for (let n = 0; n < 11; n += 1) {
        seen.push(screen.getByText(/^Telusuri angka /).textContent!.slice(-1));
        await user.click(nextButton());
      }

      expect(seen).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    });
  });

  describe('the finger', () => {
    it('draws nothing from a touch that does not start at the dot', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      touch('pointerdown', { x: 90, y: 50 });
      touch('pointermove', { x: 80, y: 60 });
      touch('pointerup');

      expect(progress()).toBe(0);
    });

    it('does not draw while the finger is up', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      touch('pointermove', spot('A', 0, 20));

      expect(progress()).toBe(0);
    });

    it('stops drawing when the finger wanders off, without losing the ink', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      traceStroke('A', 0, { upTo: 20 });
      const reached = progress();
      touch('pointerdown', spot('A', 0, reached));
      touch('pointermove', { x: 95, y: 5 });

      expect(progress()).toBe(reached);
    });

    it('carries on from where the ink ended after a lift', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      traceStroke('A', 0, { upTo: 20 });
      const reached = progress();

      touch('pointerdown', spot('A', 0, reached));
      touch('pointermove', spot('A', 0, reached + 8));
      expect(progress()).toBeGreaterThan(reached);
    });

    it('cannot start the next stroke before the first is finished', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      traceStroke('A', 0, { upTo: 20 });
      const second = glyphOf('A').strokes[1].points[0];
      touch('pointerdown', second);
      touch('pointermove', spot('A', 1, 10));

      expect(strokeNumber()).toBe(0);
    });

    it('is a soft nudge, not a failure, when the finger leaves the line far behind', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      const before = playedToneCounts.value;
      touch('pointerdown', glyphOf('A').strokes[0].points[0]);
      touch('pointermove', spot('A', 0, 10));
      touch('pointermove', { x: 98, y: 4 });

      expect(playedToneCounts.value).toBeGreaterThan(before);
      expect(isDone()).toBe(false);
      expect(screen.getByTestId('start-dot')).toBeInTheDocument(); // still there to carry on from
    });

    it('is nudged once per wander, however long the finger stays away', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      touch('pointerdown', glyphOf('A').strokes[0].points[0]);
      touch('pointermove', spot('A', 0, 10));
      const before = playedToneCounts.value;
      for (const x of [95, 96, 97, 98]) touch('pointermove', { x, y: 4 });

      expect(playedToneCounts.value - before).toBe(2); // one nudge: two soft notes
    });

    it('can be traced by a wobbly finger', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      for (let n = 0; n < glyphOf('A').strokes.length; n += 1) traceStroke('A', n, { off: 5 });

      expect(isDone()).toBe(true);
    });

    it('is not far off at the tolerance: off-course is a clear distance away', () => {
      expect(OFF_COURSE).toBeGreaterThan(20);
    });
  });

  describe('starting over', () => {
    it('clears the ink, and the finished letter, for a fresh go', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      traceStroke('A', 0, { upTo: 20 });
      await user.click(screen.getByRole('button', { name: 'Ulangi menulis' }));

      expect(progress()).toBe(0);
      expect(strokeNumber()).toBe(0);
    });

    it('is offered only once there is something to clear', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      expect(screen.queryByRole('button', { name: 'Ulangi menulis' })).not.toBeInTheDocument();

      traceStroke('A', 0, { upTo: 12 });
      expect(screen.getByRole('button', { name: 'Ulangi menulis' })).toBeInTheDocument();
    });

    it('lets a finished letter be written again', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      traceGlyph('A');
      await user.click(screen.getByRole('button', { name: 'Ulangi menulis' }));

      expect(isDone()).toBe(false);
      traceGlyph('A');
      expect(isDone()).toBe(true);
    });
  });

  describe('the hints', () => {
    it('start guided for a new child: a dot travels the stroke ahead of them', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = setupUser();
      await enter(user, 'Huruf');

      expect(followDot()).not.toBeNull();
      expect(followDot()!.querySelector('animateMotion')).not.toBeNull();
    });

    it('are off for a child who has graduated: only the start dot', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');

      expect(followDot()).toBeNull();
      expect(screen.getByTestId('start-dot')).toBeInTheDocument();
    });

    it('can be asked for: "Tunjukkan caranya" shows the dot for a few seconds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = setupUser({ advanceTimers: vi.advanceTimersByTime });
      await enter(user, 'Huruf');
      await user.click(screen.getByRole('button', { name: 'Tunjukkan caranya' }));
      expect(followDot()).not.toBeNull();

      await act(() => vi.advanceTimersByTimeAsync(4500));
      expect(followDot()).toBeNull();
    });

    it('come on when the finger wanders far off the line', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      touch('pointerdown', glyphOf('A').strokes[0].points[0]);
      touch('pointermove', spot('A', 0, 10));
      touch('pointermove', { x: 98, y: 4 });

      expect(followDot()).not.toBeNull();
    });

    it('do not move on their own for a child whose device reduces motion', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const original = window.matchMedia;
      window.matchMedia = ((query: string) => ({ matches: /reduce/.test(query), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
      try {
        const user = setupUser();
        await enter(user, 'Huruf');
        expect(followDot()).toBeNull();
      } finally {
        window.matchMedia = original;
      }
    });

    it('fade after three clean strokes in a row', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = setupUser();
      await enter(user, 'Huruf');
      traceGlyph('A'); // three clean strokes

      expect(JSON.parse(window.localStorage.getItem(HINTS_STORAGE_KEY)!).menulis).toEqual({
        level: 'independent',
        streak: 0,
      });
      await user.click(screen.getByRole('button', { name: 'Huruf berikutnya' }));
      expect(followDot()).toBeNull();
    });

    it('come back after two strokes that wandered', async () => {
      setHints('independent');
      const user = setupUser();
      await enter(user, 'Huruf');
      for (let n = 0; n < 2; n += 1) {
        touch('pointerdown', glyphOf('A').strokes[n].points[0]);
        touch('pointermove', spot('A', n, 10));
        touch('pointermove', { x: 98, y: 4 }); // wanders
        touch('pointermove', spot('A', n, 12));
        touch('pointerup');
        traceStroke('A', n); // and finishes it, not cleanly
      }

      expect(JSON.parse(window.localStorage.getItem(HINTS_STORAGE_KEY)!).menulis.level).toBe('guided');
    });
  });

  describe('the order', () => {
    const wander = (id: string) => {
      touch('pointerdown', glyphOf(id).strokes[0].points[0]);
      touch('pointermove', spot(id, 0, 10));
      touch('pointermove', { x: 98, y: 4 });
      touch('pointermove', spot(id, 0, 12));
      touch('pointerup');
    };
    const current = () => screen.getByText(/^Telusuri /).textContent!.split(' ').at(-1);

    it('goes straight on, A to Z, however a letter went: nothing is brought back early', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      wander('A');
      traceStroke('A', 0);

      const seen: string[] = [];
      for (let n = 0; n < 26; n += 1) {
        seen.push(current()!);
        await user.click(nextButton());
      }
      expect(seen.join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    }, 30_000);

    it('ignores letters in the review book: the order is the order', async () => {
      window.localStorage.setItem(
        REVIEW_STORAGE_KEY,
        JSON.stringify({ 'menulis:letters:A': { box: 0, due: 0, misses: 1 } }),
      );
      const user = setupUser();
      await enter(user, 'Huruf');
      const seen: string[] = [];
      for (let n = 0; n < 6; n += 1) {
        seen.push(current()!);
        await user.click(nextButton());
      }

      expect(seen.join('')).toBe('ABCDEF');
    });

    it('keeps no review book for Menulis at all', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      wander('A');
      traceStroke('A', 0);
      traceGlyph('A');

      expect(window.localStorage.getItem(REVIEW_STORAGE_KEY)).toBeNull();
    });
  });

  describe('small letters', () => {
    it('start at a, with the copybook lines behind the board', async () => {
      const user = setupUser();
      await enter(user, 'Huruf kecil');

      expect(screen.getByText('Telusuri huruf kecil a')).toBeInTheDocument();
      expect(screen.getByTestId('copybook-lines')).toBeInTheDocument();
    });

    it('have no copybook lines for capitals or numbers', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      expect(screen.queryByTestId('copybook-lines')).not.toBeInTheDocument();
    });

    it('are said by the same names as the capitals, and celebrated as small letters', async () => {
      const user = setupUser();
      await enter(user, 'Huruf kecil');
      await user.click(nextButton()); // b
      spokenTexts.length = 0;
      traceGlyph('b');

      expect(isDone()).toBe(true);
      expect(screen.getByText('Huruf kecil b!')).toBeInTheDocument();
      await vi.waitFor(() => expect(spokenTexts).toContain('be!'));
      expect(screen.getByRole('button', { name: 'Huruf kecil berikutnya' })).toBeInTheDocument();
    });

    it('draw the dot of an i and a j by touching it', async () => {
      const user = setupUser();
      await enter(user, 'Huruf kecil');
      for (let n = 0; n < 8; n += 1) await user.click(nextButton()); // i
      expect(screen.getByText('Telusuri huruf kecil i')).toBeInTheDocument();

      traceStroke('i', 0);
      expect(strokeNumber()).toBe(1); // now the dot
      touch('pointerdown', glyphOf('i').strokes[1].points[0]);
      expect(isDone()).toBe(true);
    });

    it('go a to z in order and round to a again', async () => {
      const user = setupUser();
      await enter(user, 'Huruf kecil');
      const seen: string[] = [];
      for (let n = 0; n < 27; n += 1) {
        seen.push(screen.getByText(/^Telusuri huruf kecil /).textContent!.slice(-1));
        await user.click(nextButton());
      }

      expect(seen.join('')).toBe('abcdefghijklmnopqrstuvwxyza');
    }, 30_000);
  });

  describe('hijaiyah', () => {
    it('start at alif, and say so', async () => {
      const user = setupUser();
      await enter(user, 'Hijaiyah');
      spokenTexts.length = 0;

      expect(screen.getByText('Telusuri huruf hijaiyah ا')).toBeInTheDocument();
      traceStroke('ا', 0, { upTo: 10 });
      expect(spokenTexts).toContain('alif');
    });

    it('are said in Arabic when the device has an Arabic voice', async () => {
      installVoice('Test Arabic', 'ar-SA');
      const user = setupUser();
      await enter(user, 'Hijaiyah');
      spokenUtterances.length = 0;
      traceStroke('ا', 0, { upTo: 10 });

      expect(spokenUtterances.map((u) => `${u.lang}|${u.text}`)).toContain('ar-SA|ألف');
    });

    it('tell the grown-up that Arabic is written from right to left, and start at the right', async () => {
      const user = setupUser();
      await enter(user, 'Hijaiyah');
      await user.click(nextButton()); // ba

      expect(screen.getByText('Bahasa Arab ditulis dari kanan ke kiri.')).toBeInTheDocument();
      const dot = screen.getByTestId('start-dot');
      expect(Number(dot.getAttribute('cx'))).toBeGreaterThan(50);
    });

    it('are written body first, then each dot by a touch, and celebrated when the last dot is down', async () => {
      const user = setupUser();
      await enter(user, 'Hijaiyah');
      await user.click(nextButton()); // ba
      await user.click(nextButton()); // ta
      expect(screen.getByText('Telusuri huruf hijaiyah ت')).toBeInTheDocument();

      traceStroke('ت', 0);
      expect(strokeNumber()).toBe(1);
      touch('pointerdown', glyphOf('ت').strokes[1].points[0]);
      expect(strokeNumber()).toBe(2);
      expect(isDone()).toBe(false);
      touch('pointerdown', glyphOf('ت').strokes[2].points[0]);

      expect(isDone()).toBe(true);
      expect(screen.getByText('Huruf hijaiyah ت!')).toBeInTheDocument();
    });

    it('go alif to ya in the traditional order, and round again', async () => {
      const user = setupUser();
      await enter(user, 'Hijaiyah');
      const seen: string[] = [];
      for (let n = 0; n < 29; n += 1) {
        seen.push(screen.getByText(/^Telusuri huruf hijaiyah /).textContent!.split(' ').at(-1)!);
        await user.click(nextButton());
      }

      expect(seen.join('')).toBe(HIJAIYAH.map((h) => h.glyph).join('') + 'ا');
    }, 30_000);

    it('show the glyph in an Arabic typeface when celebrated', async () => {
      const user = setupUser();
      await enter(user, 'Hijaiyah');
      traceGlyph('ا');

      const headline = screen.getByTestId('celebration').querySelector('[lang="ar"]');
      expect(headline).toHaveTextContent('ا');
      expect(headline).toHaveClass('font-arabic');
    });
  });

  describe('Arabic numbers', () => {
    it('start at the Arabic zero, a dot, which is done as soon as it is touched', async () => {
      const user = setupUser();
      await enter(user, 'Angka Arab');
      spokenTexts.length = 0;

      expect(screen.getByText('Telusuri angka Arab ٠')).toBeInTheDocument();
      touch('pointerdown', glyphOf('٠').strokes[0].points[0]);

      expect(isDone()).toBe(true);
      expect(screen.getByText('Angka Arab ٠!')).toBeInTheDocument();
      await vi.waitFor(() => expect(spokenTexts).toContain('sifr!'));
    });

    it('say the Arabic number names', async () => {
      const user = setupUser();
      await enter(user, 'Angka Arab');
      for (let n = 0; n < 3; n += 1) await user.click(nextButton()); // ٣
      spokenTexts.length = 0;
      traceStroke('٣', 0, { upTo: 10 });

      expect(spokenTexts).toContain('tsalatsah');
    });

    it('go zero to nine, and round again', async () => {
      const user = setupUser();
      await enter(user, 'Angka Arab');
      const seen: string[] = [];
      for (let n = 0; n < 11; n += 1) {
        seen.push(screen.getByText(/^Telusuri angka Arab /).textContent!.split(' ').at(-1)!);
        await user.click(nextButton());
      }

      expect(seen.join('')).toBe('٠١٢٣٤٥٦٧٨٩٠');
    });
  });

  describe('a smooth pen', () => {
    it('follows every point a fast stroke was drawn through, when the browser hands them over together', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      const stroke = glyphOf('A').strokes[0];
      const path = Array.from({ length: Math.ceil(stroke.length / 6) + 1 }, (_, i) => pointAt(stroke, Math.min(i * 6, stroke.length)));

      touch('pointerdown', stroke.points[0]);
      // One move event for the whole stroke, with the path in between kept in it.
      const move = new MouseEvent('pointermove', { clientX: path.at(-1)!.x, clientY: path.at(-1)!.y, bubbles: true });
      Object.defineProperty(move, 'getCoalescedEvents', {
        value: () => path.map((p) => ({ clientX: p.x, clientY: p.y })),
      });
      fireEvent(board(), move);

      expect(strokeNumber()).toBe(1);
    });

    it('cannot be jumped ahead with a single far-off point, as before', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      const stroke = glyphOf('A').strokes[0];
      touch('pointerdown', stroke.points[0]);
      touch('pointermove', stroke.points.at(-1));

      expect(strokeNumber()).toBe(0);
    });

    it('measures the board once when a finger goes down, not at every movement', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      const stroke = glyphOf('A').strokes[0];
      touch('pointerdown', stroke.points[0]);
      const measured = rect.mock.calls.length;
      for (let s = 2; s < 40; s += 2) touch('pointermove', pointAt(stroke, s));

      expect(progress()).toBeGreaterThan(30);
      expect(rect.mock.calls.length).toBe(measured);
    });

    it('keeps the start dot still while a finger is on it, and pulses it otherwise', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      expect(screen.getByTestId('start-dot')).toHaveClass('animate-pulse');

      touch('pointerdown', glyphOf('A').strokes[0].points[0]);
      expect(screen.getByTestId('start-dot')).not.toHaveClass('animate-pulse');
      touch('pointerup');
      expect(screen.getByTestId('start-dot')).toHaveClass('animate-pulse');
    });
  });

  describe('leaving', () => {
    it(`is gated until ${UNLOCK_AFTER_GAMES} glyphs are written`, async () => {
      const user = setupUser();
      await enter(user, 'Angka');
      const home = () => screen.getByRole('button', { name: 'Kembali ke menu utama' });
      expect(home()).toHaveAttribute('data-locked', 'true');

      for (let n = 0; n < UNLOCK_AFTER_GAMES; n += 1) {
        const id = screen.getByText(/^Telusuri angka /).textContent!.slice(-1);
        traceGlyph(id);
        if (n < UNLOCK_AFTER_GAMES - 1) await user.click(screen.getByRole('button', { name: 'Angka berikutnya' }));
      }
      expect(home()).not.toHaveAttribute('data-locked');
    });

    it('stops saying the instruction once the child knows the drill', async () => {
      const user = setupUser();
      await enter(user, 'Angka');
      for (let n = 0; n < 3; n += 1) {
        traceGlyph(screen.getByText(/^Telusuri angka /).textContent!.slice(-1));
        await user.click(screen.getByRole('button', { name: 'Angka berikutnya' }));
      }
      spokenTexts.length = 0;
      traceGlyph(screen.getByText(/^Telusuri angka /).textContent!.slice(-1));
      await user.click(screen.getByRole('button', { name: 'Angka berikutnya' }));

      expect(spokenTexts).not.toContain('Ikuti garisnya!');
    }, 20_000);
  });
});
