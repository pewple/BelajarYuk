import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupUser } from './user';
import App from '../App';
import { HOME_BUTTON, answerGate, gateSum, leaveGame } from './helpers';
import { MAZE_LEVELS, areNeighbours, buildMaze, cellAt, isFork } from '../data/maze';
import type { Maze, MazeKind, Position } from '../data/maze';
import { CHECKOUTS, formatRupiah } from '../data/money';
import { HINTS_STORAGE_KEY } from '../data/hints';
import { REVIEW_STORAGE_KEY } from '../data/review';
import { IDLE_REMINDER_MS, REST_GRACE_MS, SESSION_LIMIT_MS, UNLOCK_AFTER_GAMES } from '../data/session';
import { resetTapLockMs, setTapLockMs } from '../hooks/useTapLock';
import { installVoice, spokenTexts } from './setup';

type User = ReturnType<typeof userEvent.setup>;

/* ------------------------------------------------------------------ */
/* Drivers                                                             */
/* ------------------------------------------------------------------ */

const home = () => screen.getByRole('button', HOME_BUTTON);
const gate = () => screen.queryByRole('dialog', { name: 'Khusus orang tua' });
const rest = () => screen.queryByRole('dialog', { name: 'Waktunya istirahat' });

async function open(user: User, name: RegExp) {
  render(<App />);
  await user.click(screen.getByRole('button', { name }));
}

/** Counts every object of the current Berhitung round, and so finishes it. */
async function countRound(user: User) {
  for (;;) {
    const left = screen.queryAllByRole('button', { name: /^Hitung / });
    if (left.length === 0) return;
    await user.click(left[0]);
  }
}

/** Finishes `n` Berhitung rounds, moving on after each. */
async function finishRounds(user: User, n: number) {
  for (let i = 0; i < n; i += 1) {
    await countRound(user);
    await user.click(screen.getByRole('button', { name: /^Lanjut/ }));
  }
}

const labelAt = (maze: Maze, p: Position) => (cellAt(maze, p) as { label: string }).label;
const tile = (kind: MazeKind, label: string) =>
  screen.getByRole('button', { name: new RegExp(`^${kind === 'letters' ? 'Huruf' : 'Angka'} ${label}(,|$)`) });

/** Opens Labirin on the first level and starts it, having chosen letters. */
async function startLetterMaze(user: User) {
  await open(user, /Labirin/);
  await user.click(screen.getByRole('button', { name: 'Huruf' }));
  const maze = buildMaze(MAZE_LEVELS[0], 'letters');
  await user.click(tile('letters', labelAt(maze, maze.route[0])));
  return maze;
}

function setHints(game: 'labirin' | 'kasir', level: 'guided' | 'independent', streak = 0) {
  const stored = JSON.parse(window.localStorage.getItem(HINTS_STORAGE_KEY) ?? '{}');
  window.localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify({ ...stored, [game]: { level, streak } }));
}

const hintState = (game: 'labirin' | 'kasir') =>
  JSON.parse(window.localStorage.getItem(HINTS_STORAGE_KEY) ?? '{}')[game];

const reviewBook = () => JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY) ?? '{}');

beforeEach(() => installVoice('Test Indonesian', 'id-ID'));

/* ------------------------------------------------------------------ */
/* 1. The gated home button                                            */
/* ------------------------------------------------------------------ */

describe('the home button in a game', () => {
  it('starts greyed out, with a lock, and is still in its usual place', async () => {
    const user = setupUser();
    await open(user, /Berhitung/);

    expect(home()).toHaveAttribute('data-locked', 'true');
    expect(home()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByRole('heading', { name: 'Berhitung' })).toBeInTheDocument();
  });

  it('asks a grown-up sum when tapped, instead of leaving', async () => {
    const user = setupUser();
    await open(user, /Berhitung/);
    await user.click(home());

    expect(gate()).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Berhitung' })).toBeInTheDocument();
    const { a, b } = gateSum();
    expect(a + b).toBeGreaterThanOrEqual(10); // two digits: a single guessed key cannot pass
  });

  it('goes home on the right answer', async () => {
    const user = setupUser();
    await open(user, /Berhitung/);
    await user.click(home());
    const { a, b } = gateSum();
    await answerGate(user, String(a + b));

    expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    expect(gate()).not.toBeInTheDocument();
  });

  it('returns to the game on a wrong answer, with no second try on that sum', async () => {
    const user = setupUser();
    await open(user, /Berhitung/);
    await user.click(home());
    const { a, b } = gateSum();
    await answerGate(user, String(a + b + 1));

    expect(gate()).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Berhitung' })).toBeInTheDocument();
  });

  it('returns to the game on an empty answer', async () => {
    const user = setupUser();
    await open(user, /Berhitung/);
    await user.click(home());
    await user.click(within(gate()!).getByRole('button', { name: 'Periksa jawaban' }));

    expect(gate()).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Berhitung' })).toBeInTheDocument();
  });

  it('returns to the game from "Kembali bermain" and from Escape', async () => {
    const user = setupUser();
    await open(user, /Berhitung/);

    await user.click(home());
    await user.click(screen.getByRole('button', { name: 'Kembali bermain' }));
    expect(gate()).not.toBeInTheDocument();

    await user.click(home());
    await user.keyboard('{Escape}');
    expect(gate()).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Berhitung' })).toBeInTheDocument();
  });

  it('takes two digits at most, and can delete', async () => {
    const user = setupUser();
    await open(user, /Berhitung/);
    await user.click(home());

    const dialog = gate()!;
    for (const digit of '123') await user.click(within(dialog).getByRole('button', { name: digit }));
    expect(dialog).toHaveTextContent('Jawaban Anda: 12.');
    await user.click(within(dialog).getByRole('button', { name: 'Hapus' }));
    expect(dialog).toHaveTextContent('Jawaban Anda: 1.');
  });

  it('is not steered by the arrow keys behind the dialog', async () => {
    const user = setupUser();
    await open(user, /Mengenal Huruf/);
    await user.click(home());

    await user.keyboard('{ArrowRight}');
    expect(screen.getByText(/Huruf 1 dari 26/)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText(/Huruf 2 dari 26/)).toBeInTheDocument();
  });

  it(`opens up after ${UNLOCK_AFTER_GAMES} finished games, and not before`, async () => {
    const user = setupUser();
    await open(user, /Berhitung/);

    await finishRounds(user, UNLOCK_AFTER_GAMES - 1);
    expect(home()).toHaveAttribute('data-locked', 'true');

    await countRound(user); // the fifth
    expect(home()).not.toHaveAttribute('data-locked');
    expect(home()).not.toHaveAttribute('aria-haspopup');

    await user.click(home());
    expect(gate()).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
  });

  it('counts each module afresh', async () => {
    const user = setupUser();
    await open(user, /Berhitung/);
    await finishRounds(user, UNLOCK_AFTER_GAMES);
    expect(home()).not.toHaveAttribute('data-locked');

    await user.click(home());
    await user.click(screen.getByRole('button', { name: /Kasir/ }));
    expect(home()).toHaveAttribute('data-locked', 'true');
  });

  it('counts a card only once however often it is tapped, in the letter modules', async () => {
    const user = setupUser();
    await open(user, /Mengenal Huruf/);

    for (let i = 0; i < 8; i += 1) await user.click(screen.getByRole('button', { name: 'Dengarkan huruf A' }));
    expect(home()).toHaveAttribute('data-locked', 'true');
  });

  it('opens up once enough different letters have been heard', async () => {
    const user = setupUser();
    await open(user, /Mengenal Huruf/);

    for (let i = 0; i < UNLOCK_AFTER_GAMES; i += 1) {
      await user.click(screen.getByRole('button', { name: /^Dengarkan huruf/ }));
      await user.click(screen.getByRole('button', { name: 'Huruf berikutnya' }));
    }
    expect(home()).not.toHaveAttribute('data-locked');
  });

  it('opens up in Belajar Bicara by hearing different words', async () => {
    const user = setupUser();
    await open(user, /Belajar Bicara/);

    for (let i = 0; i < UNLOCK_AFTER_GAMES; i += 1) {
      await user.click(screen.getByRole('button', { name: /^Dengarkan kata/ }));
      await user.click(screen.getByRole('button', { name: 'Kata berikutnya' }));
    }
    expect(home()).not.toHaveAttribute('data-locked');
  });

  it('opens up in Labirin by finishing mazes', async () => {
    const user = setupUser();
    await open(user, /Labirin/);
    await user.click(screen.getByRole('button', { name: 'Huruf' }));
    expect(home()).toHaveAttribute('data-locked', 'true');

    for (let n = 0; n < UNLOCK_AFTER_GAMES; n += 1) {
      const maze = buildMaze(MAZE_LEVELS[n], 'letters');
      await user.click(tile('letters', labelAt(maze, maze.route[0])));
      for (let i = 1; i < maze.route.length; i += 1) await user.click(tile('letters', labelAt(maze, maze.route[i])));
      if (n < UNLOCK_AFTER_GAMES - 1) await user.click(screen.getByRole('button', { name: 'Labirin berikutnya' }));
    }
    expect(home()).not.toHaveAttribute('data-locked');
  });

  it('opens up in Kasir by serving customers', async () => {
    const user = setupUser();
    await open(user, /Kasir/);
    expect(home()).toHaveAttribute('data-locked', 'true');

    for (let n = 0; n < UNLOCK_AFTER_GAMES; n += 1) {
      const { price, paid } = CHECKOUTS[n];
      let left = paid - price;
      for (const piece of [5000, 2000, 1000, 500]) {
        while (left >= piece) {
          await user.click(screen.getByRole('button', { name: `Tambah ${formatRupiah(piece)}` }));
          left -= piece;
        }
      }
      await user.click(screen.getByRole('button', { name: 'Pembeli berikutnya' }));
    }
    expect(home()).not.toHaveAttribute('data-locked');
  });

  it('is not gated on the parent media page', async () => {
    window.location.hash = '#media';
    const user = setupUser();
    render(<App />);
    await user.click(screen.getByRole('button', HOME_BUTTON));

    expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* 2. The rest after a quarter hour                                    */
/* ------------------------------------------------------------------ */

describe('the rest after fifteen minutes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });
  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error - drop the override and fall back to jsdom's own
    delete document.visibilityState;
  });

  const pass = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
  const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

  it('does not appear before the limit', async () => {
    render(<App />);
    await pass(SESSION_LIMIT_MS - 2000);

    expect(rest()).not.toBeInTheDocument();
  });

  it('appears on the menu at the limit, says goodbye out loud, and is not a punishment', async () => {
    render(<App />);
    await pass(SESSION_LIMIT_MS + 2000);

    const dialog = rest()!;
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Sudah dulu ya!');
    expect(spokenTexts).toContain('Sudah dulu ya! Sampai jumpa!');
    // One way out only: no "play more".
    expect(within(dialog).getAllByRole('button')).toHaveLength(1);
  });

  it('waits in the middle of a game for a natural pause: a finished round', async () => {
    render(<App />);
    click(/Berhitung/);
    await pass(SESSION_LIMIT_MS + 2000);
    expect(rest()).not.toBeInTheDocument();

    click(/^Hitung /); // round 1 has one object: this finishes it
    expect(rest()).toBeInTheDocument();
  });

  it('does not wait for ever: it comes after a short grace', async () => {
    render(<App />);
    click(/Berhitung/);
    await pass(SESSION_LIMIT_MS + 2000);
    expect(rest()).not.toBeInTheDocument();

    await pass(REST_GRACE_MS);
    expect(rest()).toBeInTheDocument();
  });

  it('sends the child to the menu and starts a fresh quarter hour', async () => {
    render(<App />);
    click(/Berhitung/);
    await pass(SESSION_LIMIT_MS + REST_GRACE_MS + 2000);
    click('Selesai, kembali ke menu');

    expect(rest()).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();

    await pass(SESSION_LIMIT_MS - 5000);
    expect(rest()).not.toBeInTheDocument();
    await pass(10000);
    expect(rest()).toBeInTheDocument();
  });

  it('counts only the time the page is actually in view', async () => {
    render(<App />);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await pass(SESSION_LIMIT_MS * 2);
    expect(rest()).not.toBeInTheDocument();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await pass(SESSION_LIMIT_MS - 2000);
    expect(rest()).not.toBeInTheDocument();
  });

  describe('carrying on', () => {
    async function resting(screenCard: RegExp = /Mengenal Huruf/) {
      render(<App />);
      click(screenCard);
      await pass(SESSION_LIMIT_MS + REST_GRACE_MS + 2000);
      expect(rest()).toBeInTheDocument();
    }

    it('lets a tap anywhere but the home button put it away and play on', async () => {
      await resting(/Berhitung/);
      fireEvent.click(rest()!); // the backdrop itself

      expect(rest()).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Berhitung' })).toBeInTheDocument(); // still in the game
    });

    it('lets a tap on the moon or the words do the same', async () => {
      await resting(/Berhitung/);
      fireEvent.click(screen.getByRole('heading', { name: 'Sudah dulu ya!' }));

      expect(rest()).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Berhitung' })).toBeInTheDocument();
    });

    it('keeps the game exactly where it was', async () => {
      render(<App />);
      click(/Berhitung/);
      click(/^Hitung /); // round 1 done: one game, and a pause
      click(/^Lanjut/); // round 2: two objects
      await pass(SESSION_LIMIT_MS + REST_GRACE_MS + 2000);
      fireEvent.click(rest()!);

      expect(screen.getByText(/Ketuk satu per satu — ada 2 /)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^Hitung / })).toHaveLength(2);
    });

    it('lets any key do the same, without that key also steering the game', async () => {
      await resting();
      fireEvent.keyDown(document.body, { key: 'ArrowRight' });

      expect(rest()).not.toBeInTheDocument();
      expect(screen.getByText(/Huruf 1 dari 26/)).toBeInTheDocument(); // the arrow only put the screen away
    });

    it.each(['a', 'Enter', ' ', 'Escape'])('and so does the "%s" key', async (key) => {
      await resting();
      fireEvent.keyDown(document.body, { key });

      expect(rest()).not.toBeInTheDocument();
    });

    it('is not put away by keys that only move focus or hold another key', async () => {
      await resting();
      for (const key of ['Tab', 'Shift', 'Control', 'Alt', 'Meta']) fireEvent.keyDown(document.body, { key });

      expect(rest()).toBeInTheDocument();
    });

    it('is not put away by Enter or space on the home button - that is the home button', async () => {
      await resting();
      const home = screen.getByRole('button', { name: 'Selesai, kembali ke menu' });
      fireEvent.keyDown(home, { key: 'Enter' });
      fireEvent.keyDown(home, { key: ' ' });

      expect(rest()).toBeInTheDocument();
    });

    it('sends the child home from the home button, and only from it', async () => {
      await resting(/Berhitung/);
      fireEvent.click(screen.getByRole('button', { name: 'Selesai, kembali ke menu' }));

      expect(rest()).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    });

    it('stops the spoken goodbye when play goes on', async () => {
      await resting();
      const stop = vi.spyOn(window.speechSynthesis, 'cancel');
      fireEvent.click(rest()!);

      expect(stop).toHaveBeenCalled();
    });

    it('starts a fresh quarter hour, so it comes back after another', async () => {
      await resting();
      fireEvent.click(rest()!);
      expect(rest()).not.toBeInTheDocument();

      await pass(SESSION_LIMIT_MS - 5000);
      expect(rest()).not.toBeInTheDocument();
      await pass(REST_GRACE_MS + 10000);
      expect(rest()).toBeInTheDocument();
    });

    it('can be carried on from again and again', async () => {
      await resting();
      for (let n = 0; n < 3; n += 1) {
        fireEvent.click(rest()!);
        await pass(SESSION_LIMIT_MS + REST_GRACE_MS + 2000);
        expect(rest(), `time ${n + 2}`).toBeInTheDocument();
      }
    });

    it('says plainly that a tap anywhere carries on', async () => {
      await resting();

      expect(rest()).toHaveTextContent('Ketuk di mana saja untuk terus bermain.');
    });

    it('has the home button as its only button', async () => {
      await resting();

      expect(within(rest()!).getAllByRole('button')).toHaveLength(1);
    });
  });
});

/* ------------------------------------------------------------------ */
/* 3. Fading hints                                                     */
/* ------------------------------------------------------------------ */

/** Level 0's route and its one dead end - the one real choice in that maze. */
function levelZero() {
  const maze = buildMaze(MAZE_LEVELS[0], 'letters');
  const fork = maze.route.findIndex((_, k) => isFork(maze, k));
  expect(fork).toBeGreaterThanOrEqual(0);
  return { maze, fork };
}

/** The dead end beside the animal when it stands at route position `k`. */
function deadEndAt(maze: Maze, k: number): Position {
  for (let i = 0; i < maze.cells.length; i += 1) {
    const p = { row: Math.floor(i / maze.cols), col: i % maze.cols };
    if (maze.cells[i].type === 'decoy' && areNeighbours(maze.route[k], p)) return p;
  }
  throw new Error('no dead end there');
}

async function walkRoute(user: User, maze: Maze, from: number, to: number) {
  for (let i = from + 1; i <= to; i += 1) await user.click(tile('letters', labelAt(maze, maze.route[i])));
}

describe('fading hints in Labirin', () => {
  it('start guided for a new child: the way on glows without a wrong tap', async () => {
    window.localStorage.removeItem(HINTS_STORAGE_KEY); // a child nobody has seen before
    const user = setupUser();
    const maze = await startLetterMaze(user);

    expect(tile('letters', labelAt(maze, maze.route[1]))).toHaveAttribute('data-hint', 'true');
  });

  it('are off for a child who has graduated, until they go wrong', async () => {
    const user = setupUser();
    const maze = await startLetterMaze(user);

    expect(tile('letters', labelAt(maze, maze.route[1]))).not.toHaveAttribute('data-hint');
  });

  it('count only real choices - a dead end beside the animal - towards fading', async () => {
    setHints('labirin', 'guided', 0);
    const user = setupUser();
    const { maze } = levelZero();
    await startLetterMaze(user);
    await walkRoute(user, maze, 0, maze.route.length - 1);

    // Three steps were taken but only one of them was a choice.
    expect(hintState('labirin')).toEqual({ level: 'guided', streak: 1 });
  });

  it('fade away after three right choices in a row', async () => {
    setHints('labirin', 'guided', 2);
    const user = setupUser();
    const { maze, fork } = levelZero();
    await startLetterMaze(user);
    await walkRoute(user, maze, 0, fork + 1);

    expect(hintState('labirin')).toEqual({ level: 'independent', streak: 0 });
    // And the way on no longer glows, if there is a way on.
    if (fork + 2 < maze.route.length) {
      expect(tile('letters', labelAt(maze, maze.route[fork + 2]))).not.toHaveAttribute('data-hint');
    }
  });

  it('are remembered for the next visit', async () => {
    setHints('labirin', 'guided', 2);
    const user = setupUser();
    const { maze, fork } = levelZero();
    await startLetterMaze(user);
    await walkRoute(user, maze, 0, fork + 1);

    cleanup(); // close the app and open it again
    await startLetterMaze(user);
    expect(tile('letters', labelAt(maze, maze.route[1]))).not.toHaveAttribute('data-hint');
  });

  it('come back after two wrong choices in a row', async () => {
    setHints('labirin', 'independent', 1);
    const user = setupUser();
    const { maze, fork } = levelZero();
    await startLetterMaze(user);
    await walkRoute(user, maze, 0, fork);

    const decoy = deadEndAt(maze, fork);
    await user.click(
      screen.getByRole('button', { name: new RegExp(`^Huruf ${labelAt(maze, decoy)}(,|$)`) }),
    );

    expect(hintState('labirin')).toEqual({ level: 'guided', streak: 0 });
  });

  it('then stay lit: the way on glows as soon as the animal moves', async () => {
    setHints('labirin', 'independent', 1);
    const user = setupUser();
    const { maze, fork } = levelZero();
    await startLetterMaze(user);
    await walkRoute(user, maze, 0, fork);

    const decoy = deadEndAt(maze, fork);
    await user.click(screen.getByRole('button', { name: new RegExp(`^Huruf ${labelAt(maze, decoy)}(,|$)`) }));
    await user.click(tile('letters', labelAt(maze, maze.route[fork + 1])));

    if (fork + 2 < maze.route.length) {
      expect(tile('letters', labelAt(maze, maze.route[fork + 2]))).toHaveAttribute('data-hint', 'true');
    }
  });

  it('a right choice clears a wrong streak without changing level', async () => {
    setHints('labirin', 'independent', 1);
    const user = setupUser();
    const { maze, fork } = levelZero();
    await startLetterMaze(user);
    await walkRoute(user, maze, 0, fork + 1);

    expect(hintState('labirin')).toEqual({ level: 'independent', streak: 0 });
  });
});

describe('fading hints in Kasir', () => {
  const piece = (rupiah: string) => screen.getByRole('button', { name: `Tambah Rp ${rupiah}` });

  it('start guided: the biggest piece that still fits glows', async () => {
    setHints('kasir', 'guided', 0);
    const user = setupUser();
    await open(user, /Kasir/);

    // The first customer is owed Rp 500, so Rp 500 is the one.
    expect(piece('500')).toHaveAttribute('data-hint', 'true');
    for (const other of ['1.000', '2.000', '5.000']) expect(piece(other)).not.toHaveAttribute('data-hint');
  });

  it('moves along with the sum, and fades after three right pieces in a row', async () => {
    setHints('kasir', 'guided', 0);
    const user = setupUser();
    await open(user, /Kasir/);

    await user.click(piece('500')); // right: 1 of 3. Customer done.
    await user.click(screen.getByRole('button', { name: 'Pembeli berikutnya' }));

    // Customer two is owed Rp 1.000.
    expect(piece('1.000')).toHaveAttribute('data-hint', 'true');
    await user.click(piece('500')); // right: 2 of 3 - Rp 500 is still owed
    expect(piece('500')).toHaveAttribute('data-hint', 'true');
    expect(piece('1.000')).not.toHaveAttribute('data-hint');

    await user.click(piece('500')); // right: 3 of 3
    expect(hintState('kasir')).toEqual({ level: 'independent', streak: 0 });
  });

  it('is off for a child who has graduated', async () => {
    const user = setupUser();
    await open(user, /Kasir/);

    for (const amount of ['500', '1.000', '2.000', '5.000']) expect(piece(amount)).not.toHaveAttribute('data-hint');
  });

  it('comes back after two overshoots in a row, once the count is cleared', async () => {
    setHints('kasir', 'independent', 0);
    const user = setupUser();
    await open(user, /Kasir/);

    await user.click(piece('2.000')); // too much
    expect(piece('500')).not.toHaveAttribute('data-hint'); // never while the tray is held
    await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));
    await user.click(piece('2.000')); // too much again
    await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));

    expect(hintState('kasir')).toEqual({ level: 'guided', streak: 0 });
    expect(piece('500')).toHaveAttribute('data-hint', 'true');
  });
});

/* ------------------------------------------------------------------ */
/* 4. The tap lock                                                     */
/* ------------------------------------------------------------------ */

describe('the tap lock', () => {
  beforeEach(() => setTapLockMs(350));
  afterEach(() => resetTapLockMs());

  const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it('stops a double-tap on "Lanjut" skipping a round', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Berhitung/ }));
    await countRoundFast();

    const nextButton = () => screen.getByRole('button', { name: /^Lanjut/ });
    fireEvent.click(nextButton());
    fireEvent.click(nextButton()); // the stutter

    expect(screen.getByText(/Ketuk satu per satu — ada 2 /)).toBeInTheDocument();
  });

  it('lets the same control work again once the moment has passed', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Berhitung/ }));
    await countRoundFast();

    fireEvent.click(screen.getByRole('button', { name: /^Lanjut/ }));
    await later(400);
    await countRoundFast();
    fireEvent.click(screen.getByRole('button', { name: /^Lanjut/ }));

    expect(screen.getByText(/Ketuk satu per satu — ada 3 /)).toBeInTheDocument();
  });

  it('does not stop two different controls in quick succession', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Huruf berikutnya' }));
    fireEvent.click(screen.getByRole('button', { name: 'Huruf sebelumnya' }));

    expect(screen.getByText(/Huruf 1 dari 26/)).toBeInTheDocument();
  });

  it('stops a double-tap on the arrow button skipping a letter', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Huruf berikutnya' }));
    fireEvent.click(screen.getByRole('button', { name: 'Huruf berikutnya' }));

    expect(screen.getByText(/Huruf 2 dari 26/)).toBeInTheDocument();
  });

  it('hands over a coin once for a double-tap, and a different coin straight after', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Kasir/ }));
    // The second customer is owed Rp 1.000: serve the first, then double-tap.
    fireEvent.click(screen.getByRole('button', { name: 'Tambah Rp 500' }));
    await later(400);
    fireEvent.click(screen.getByRole('button', { name: 'Pembeli berikutnya' }));
    await later(400);

    fireEvent.click(screen.getByRole('button', { name: 'Tambah Rp 500' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tambah Rp 500' })); // the stutter
    expect(screen.getByText('Kembalian diberikan').parentElement).toHaveTextContent('Rp 500');
    expect(screen.getByText('Kembalian diberikan').parentElement).not.toHaveTextContent('Rp 1.000');
  });

  async function countRoundFast() {
    for (;;) {
      const left = screen.queryAllByRole('button', { name: /^Hitung / });
      if (left.length === 0) return;
      fireEvent.click(left[0]);
      await later(0);
    }
  }
});

/* ------------------------------------------------------------------ */
/* 5. Spoken instructions                                              */
/* ------------------------------------------------------------------ */

describe('spoken instructions', () => {
  it('Mengenal Huruf and Belajar Bicara say what to do on arriving', async () => {
    const user = setupUser();
    await open(user, /Mengenal Huruf/);
    expect(spokenTexts).toContain('Ketuk hurufnya!');

    spokenTexts.length = 0;
    await leaveGame(user);
    await user.click(screen.getByRole('button', { name: /Belajar Bicara/ }));
    expect(spokenTexts).toContain('Ketuk gambarnya!');
  });

  it('says it once on arriving, not again for every card', async () => {
    const user = setupUser();
    await open(user, /Mengenal Huruf/);
    spokenTexts.length = 0;

    await user.click(screen.getByRole('button', { name: 'Huruf berikutnya' }));
    await user.click(screen.getByRole('button', { name: 'Huruf berikutnya' }));

    expect(spokenTexts).not.toContain('Ketuk hurufnya!');
  });

  it.each([
    [/Mengenal Huruf/, 'Ketuk hurufnya!'],
    [/Belajar Bicara/, 'Ketuk gambarnya!'],
    [/Berhitung/, 'Ayo hitung!'],
    [/Labirin/, 'Pilih huruf, angka, atau acak!'],
    [/Kasir/, 'Harganya seribu lima ratus rupiah. Dibayar dua ribu rupiah. Ayo hitung kembaliannya!'],
  ])('%s has a speaker button that says its instruction again', async (card, line) => {
    const user = setupUser();
    await open(user, card);
    spokenTexts.length = 0;

    await user.click(screen.getByRole('button', { name: 'Ulangi perintah' }));

    expect(spokenTexts).toContain(line);
  });

  it('the speaker button is in every game and not on the menu', async () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Ulangi perintah' })).not.toBeInTheDocument();
  });

  it('Berhitung leaves "Ayo hitung!" out once the child knows the drill', async () => {
    const user = setupUser();
    await open(user, /Berhitung/);
    expect(spokenTexts).toContain('Ayo hitung!');

    await finishRounds(user, 3); // lands on round 4
    spokenTexts.length = 0;
    await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' })); // a redo of round 4

    expect(spokenTexts).not.toContain('Ayo hitung!');
  });

  it('Kasir keeps the price and payment but drops "Ayo hitung" after a few customers', async () => {
    const user = setupUser();
    await open(user, /Kasir/);

    for (let n = 0; n < 3; n += 1) {
      const { price, paid } = CHECKOUTS[n];
      let left = paid - price;
      for (const [rupiah, value] of [['5.000', 5000], ['2.000', 2000], ['1.000', 1000], ['500', 500]] as const) {
        while (left >= value) {
          await user.click(screen.getByRole('button', { name: `Tambah Rp ${rupiah}` }));
          left -= value;
        }
      }
      spokenTexts.length = 0;
      await user.click(screen.getByRole('button', { name: 'Pembeli berikutnya' }));
    }

    // The fourth customer: Es Krim, 3.500 paid with 5.000.
    expect(spokenTexts).toContain('Harganya tiga ribu lima ratus rupiah. Dibayar lima ribu rupiah.');
    expect(spokenTexts.join(' ')).not.toContain('Ayo hitung');
  });
});

describe('the reminder when a child goes quiet', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const pass = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

  it('says the instruction once after fifteen quiet seconds, and only once', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));
    await pass(500);
    spokenTexts.length = 0;

    await pass(IDLE_REMINDER_MS - 1000);
    expect(spokenTexts).not.toContain('Ketuk hurufnya!');

    await pass(2000);
    expect(spokenTexts.filter((t) => t === 'Ketuk hurufnya!')).toHaveLength(1);

    await pass(IDLE_REMINDER_MS * 3);
    expect(spokenTexts.filter((t) => t === 'Ketuk hurufnya!')).toHaveLength(1);
  });

  it('never speaks to a child who keeps playing', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));
    await pass(500);
    spokenTexts.length = 0;

    for (let i = 0; i < 6; i += 1) {
      await pass(IDLE_REMINDER_MS - 3000);
      fireEvent.pointerDown(document.body);
    }

    expect(spokenTexts).not.toContain('Ketuk hurufnya!');
  });

  it('is armed again by the next touch', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));
    await pass(IDLE_REMINDER_MS + 2000);
    spokenTexts.length = 0;

    fireEvent.pointerDown(document.body);
    await pass(IDLE_REMINDER_MS + 2000);

    expect(spokenTexts.filter((t) => t === 'Ketuk hurufnya!')).toHaveLength(1);
  });

  it('is silent on the menu', async () => {
    render(<App />);
    await pass(500);
    spokenTexts.length = 0;
    await pass(IDLE_REMINDER_MS * 3);

    expect(spokenTexts.filter((t) => t.startsWith('Ketuk'))).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 6. Spaced review                                                    */
/* ------------------------------------------------------------------ */

describe('spaced review in Labirin', () => {
  it('files a wrong tap under the letter that was being looked for', async () => {
    const user = setupUser();
    const { maze, fork } = levelZero();
    await startLetterMaze(user);
    await walkRoute(user, maze, 0, fork);

    await user.click(screen.getByRole('button', { name: new RegExp(`^Huruf ${labelAt(maze, deadEndAt(maze, fork))}(,|$)`) }));

    // Looking for the letter at place fork + 2 (A is 1, and the animal is at index `fork`).
    const book = reviewBook();
    expect(book[`maze:letters:latin:${fork + 2}`]).toMatchObject({ box: 0, misses: 1 });
  });

  it('moves it up a rung when it is later got right', async () => {
    const user = setupUser();
    const { maze, fork } = levelZero();
    window.localStorage.setItem(
      REVIEW_STORAGE_KEY,
      JSON.stringify({ [`maze:letters:latin:${fork + 2}`]: { box: 0, due: 0, misses: 1 } }),
    );
    await startLetterMaze(user);
    await walkRoute(user, maze, 0, fork + 1);

    expect(reviewBook()[`maze:letters:latin:${fork + 2}`].box).toBe(1);
  });

  it('does not record anything for a child who has never got it wrong', async () => {
    const user = setupUser();
    const { maze } = levelZero();
    await startLetterMaze(user);
    await walkRoute(user, maze, 0, maze.route.length - 1);

    expect(reviewBook()).toEqual({});
  });

  it('brings a due letter back as a dead end', async () => {
    window.localStorage.setItem(
      REVIEW_STORAGE_KEY,
      JSON.stringify({ 'maze:letters:latin:9': { box: 0, due: 0, misses: 1 } }),
    );
    const user = setupUser();
    await startLetterMaze(user);

    // Level 0 has a single dead end, so it must be the letter that was missed: I.
    expect(screen.getByRole('button', { name: 'Huruf I' })).toBeInTheDocument();
  });

  it('leaves a letter alone that is not yet due', async () => {
    window.localStorage.setItem(
      REVIEW_STORAGE_KEY,
      JSON.stringify({ 'maze:letters:latin:9': { box: 1, due: Date.now() + 60_000, misses: 1 } }),
    );
    const user = setupUser();
    await startLetterMaze(user);

    expect(screen.queryByRole('button', { name: 'Huruf I' })).not.toBeInTheDocument();
  });

  it('keeps the shape of the maze whatever is being reviewed', async () => {
    const plain = buildMaze(MAZE_LEVELS[0], 'letters');
    const reviewed = buildMaze(MAZE_LEVELS[0], 'letters', 'latin', [9]);

    expect(reviewed.route).toEqual(plain.route);
    expect(reviewed.cells.map((c) => c.type)).toEqual(plain.cells.map((c) => c.type));
  });

  it('does not reshuffle the board under the child while the book changes', async () => {
    const user = setupUser();
    const { maze, fork } = levelZero();
    await startLetterMaze(user);
    const labels = () =>
      [...screen.getByRole('group', { name: 'Papan labirin' }).querySelectorAll('button')].map(
        (b) => b.getAttribute('aria-label')!.split(',')[0],
      );
    const before = labels();

    await walkRoute(user, maze, 0, fork);
    await user.click(screen.getByRole('button', { name: new RegExp(`^Huruf ${labelAt(maze, deadEndAt(maze, fork))}(,|$)`) }));

    expect(Object.keys(reviewBook())).toHaveLength(1); // the book did change...
    expect(labels()).toEqual(before); // ...and the board did not.
  });
});

describe('spaced review in Kasir', () => {
  const give = (user: User, rupiah: string) => user.click(screen.getByRole('button', { name: `Tambah Rp ${rupiah}` }));

  it('files an overshoot under the customer, and the right answer moves it up', async () => {
    const user = setupUser();
    await open(user, /Kasir/);

    await give(user, '2.000'); // too much for Permen
    expect(reviewBook()['kasir:Permen']).toMatchObject({ box: 0, misses: 1 });

    await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));
    await give(user, '500');
    expect(reviewBook()['kasir:Permen'].box).toBe(1);
  });

  it('brings a missed customer round again, every third customer', async () => {
    window.localStorage.setItem(
      REVIEW_STORAGE_KEY,
      JSON.stringify({ 'kasir:Roti': { box: 0, due: 0, misses: 1 } }),
    );
    const user = setupUser();
    await open(user, /Kasir/);

    const serve = async (n: number) => {
      const { price, paid } = CHECKOUTS[n];
      let left = paid - price;
      for (const [rupiah, value] of [['5.000', 5000], ['2.000', 2000], ['1.000', 1000], ['500', 500]] as const) {
        while (left >= value) {
          await give(user, rupiah);
          left -= value;
        }
      }
      await user.click(screen.getByRole('button', { name: 'Pembeli berikutnya' }));
    };
    const customer = () => screen.getByRole('region', { name: 'Pembeli' });

    await serve(0);
    expect(customer()).toHaveTextContent(CHECKOUTS[1].item);
    await serve(1);
    expect(customer()).toHaveTextContent('Roti'); // the review slot
    await serve(7);
    // The fixed order carries on from where it was, not from the review customer.
    expect(customer()).toHaveTextContent(CHECKOUTS[2].item);
  });

  it('follows the fixed order when nothing is due', async () => {
    const user = setupUser();
    await open(user, /Kasir/);

    for (let n = 0; n < 4; n += 1) {
      const { price, paid } = CHECKOUTS[n];
      let left = paid - price;
      for (const [rupiah, value] of [['5.000', 5000], ['2.000', 2000], ['1.000', 1000], ['500', 500]] as const) {
        while (left >= value) {
          await give(user, rupiah);
          left -= value;
        }
      }
      await user.click(screen.getByRole('button', { name: 'Pembeli berikutnya' }));
      expect(screen.getByRole('region', { name: 'Pembeli' })).toHaveTextContent(CHECKOUTS[n + 1].item);
    }
  });
});

describe('storage that cannot be used', () => {
  it('plays on without remembering, when storage throws', async () => {
    const original = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
    try {
      const user = setupUser();
      const { maze, fork } = levelZero();
      await startLetterMaze(user);
      await walkRoute(user, maze, 0, fork);
      await user.click(screen.getByRole('button', { name: new RegExp(`^Huruf ${labelAt(maze, deadEndAt(maze, fork))}(,|$)`) }));
      await user.click(tile('letters', labelAt(maze, maze.route[fork + 1])));

      expect(screen.getByRole('group', { name: 'Papan labirin' })).toBeInTheDocument();
    } finally {
      Storage.prototype.getItem = original;
      Storage.prototype.setItem = originalSet;
    }
  });
});
