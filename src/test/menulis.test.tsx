import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupUser } from './user';
import App from '../App';
import { HINTS_STORAGE_KEY } from '../data/hints';
import { REVIEW_STORAGE_KEY } from '../data/review';
import { UNLOCK_AFTER_GAMES } from '../data/session';
import { OFF_COURSE, glyphOf, pointAt } from '../data/tracing';
import type { Pt } from '../data/tracing';
import { leaveGame } from './helpers';
import { installVoice, playedToneCounts, spokenTexts } from './setup';

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

async function enter(user: User, choice: 'Huruf' | 'Angka') {
  await open(user);
  await user.click(screen.getByRole('button', { name: choice }));
}

const nextButton = () => screen.getByRole('button', { name: /^(Lewati, berikutnya|Huruf berikutnya|Angka berikutnya)$/ });
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

    it('asks first: letters or numbers, out loud and in writing, and shows no board yet', async () => {
      const user = setupUser();
      await open(user);

      expect(screen.getByRole('heading', { name: 'Menulis' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Huruf' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Angka' })).toBeInTheDocument();
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

    it('has no Arabic switch: the shapes drawn are Latin letters and digits', async () => {
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
    it('starts at 1 and says it as a number word', async () => {
      const user = setupUser();
      await enter(user, 'Angka');
      spokenTexts.length = 0;

      expect(screen.getByText('Telusuri angka 1')).toBeInTheDocument();
      traceStroke('1', 0, { upTo: 10 });
      expect(spokenTexts).toContain('satu');
    });

    it('can be traced and celebrated like a letter', async () => {
      const user = setupUser();
      await enter(user, 'Angka');
      traceGlyph('1');

      expect(isDone()).toBe(true);
      expect(screen.getByText('Angka 1!')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Angka berikutnya' })).toBeInTheDocument();
    });

    it('goes 1 to 9 and then 0', async () => {
      const user = setupUser();
      await enter(user, 'Angka');
      const seen: string[] = [];
      for (let n = 0; n < 10; n += 1) {
        seen.push(screen.getByText(/^Telusuri angka /).textContent!.slice(-1));
        await user.click(nextButton());
      }

      expect(seen).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
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

  describe('the review', () => {
    it('files a stroke that wandered as a miss, under the letter', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      touch('pointerdown', glyphOf('A').strokes[0].points[0]);
      touch('pointermove', spot('A', 0, 10));
      touch('pointermove', { x: 98, y: 4 });
      touch('pointermove', spot('A', 0, 12));
      touch('pointerup');
      traceStroke('A', 0);

      expect(JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY)!)['menulis:letters:A']).toMatchObject({
        box: 0,
        misses: 1,
      });
    });

    it('records nothing for a letter written cleanly the first time', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');
      traceGlyph('A');

      expect(window.localStorage.getItem(REVIEW_STORAGE_KEY)).toBeNull();
    });

    it('brings a fumbled letter round again, every third letter', async () => {
      window.localStorage.setItem(
        REVIEW_STORAGE_KEY,
        JSON.stringify({ 'menulis:letters:A': { box: 0, due: 0, misses: 1 } }),
      );
      const user = setupUser();
      await enter(user, 'Huruf');
      await user.click(nextButton()); // B
      expect(screen.getByText('Telusuri huruf B')).toBeInTheDocument();
      await user.click(nextButton()); // the review slot: A again
      expect(screen.getByText('Telusuri huruf A')).toBeInTheDocument();
      await user.click(nextButton()); // and the order carries on: C
      expect(screen.getByText('Telusuri huruf C')).toBeInTheDocument();
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
