import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupUser } from './user';
import App from '../App';
import { PlayProvider, usePlay } from '../state/play';
import { MAZE_LEVELS, areNeighbours, buildMaze, cellAt, isFork } from '../data/maze';
import type { Maze, Position } from '../data/maze';
import { UNLOCK_AFTER_FAILURES, UNLOCK_AFTER_GAMES } from '../data/session';
import { MISMATCH_MS } from '../screens/MemoriScreen';
import { MEMORI_LEVELS, deal, pairsFor, seedFor } from '../data/memori';
import { HOME_BUTTON, leaveGame } from './helpers';

type User = ReturnType<typeof userEvent.setup>;

/* ------------------------------------------------------------------ */
/* The count itself                                                    */
/* ------------------------------------------------------------------ */

function Probe() {
  const play = usePlay();
  return (
    <div>
      <output aria-label="state">{`${play.homeUnlocked ? 'open' : 'locked'}|${play.struggling ? 'struggling' : 'fine'}`}</output>
      <button onClick={() => play.reportAttempt(false)}>fail</button>
      <button onClick={() => play.reportAttempt(true)}>ok</button>
      <button onClick={() => play.reportGame()}>game</button>
    </div>
  );
}

const press = (name: string, times = 1) => {
  for (let i = 0; i < times; i += 1) fireEvent.click(screen.getByRole('button', { name }));
};
const state = () => screen.getByLabelText('state').textContent;

describe('three wrong answers in a row', () => {
  it('is three', () => {
    expect(UNLOCK_AFTER_FAILURES).toBe(3);
  });

  it('let go of the home button', () => {
    render(
      <PlayProvider resetKey="a">
        <Probe />
      </PlayProvider>,
    );
    expect(state()).toBe('locked|fine');

    press('fail', 2);
    expect(state()).toBe('locked|fine');
    press('fail');
    expect(state()).toBe('open|struggling');
  });

  it('are not three if a right answer comes between them', () => {
    render(
      <PlayProvider resetKey="a">
        <Probe />
      </PlayProvider>,
    );
    press('fail', 2);
    press('ok');
    press('fail', 2);

    expect(state()).toBe('locked|fine');
  });

  it('start counting afresh after a right answer', () => {
    render(
      <PlayProvider resetKey="a">
        <Probe />
      </PlayProvider>,
    );
    press('fail', 2);
    press('ok');
    press('fail', 3);

    expect(state()).toBe('open|struggling');
  });

  it('keep the home button open for the rest of the visit, even after a right answer', () => {
    render(
      <PlayProvider resetKey="a">
        <Probe />
      </PlayProvider>,
    );
    press('fail', 3);
    press('ok', 4);

    expect(state()).toBe('open|struggling');
  });

  it('count only in the module they happened in', () => {
    const { rerender } = render(
      <PlayProvider resetKey="a">
        <Probe />
      </PlayProvider>,
    );
    press('fail', 3);
    expect(state()).toBe('open|struggling');

    rerender(
      <PlayProvider resetKey="b">
        <Probe />
      </PlayProvider>,
    );
    expect(state()).toBe('locked|fine');
    press('fail', 2);
    expect(state()).toBe('locked|fine'); // two here, not five in all
  });

  it('do not need the five finished games as well - and finished games still work as before', () => {
    render(
      <PlayProvider resetKey="a">
        <Probe />
      </PlayProvider>,
    );
    press('game', UNLOCK_AFTER_GAMES - 1);
    expect(state()).toBe('locked|fine');
    press('game');
    expect(state()).toBe('open|fine');
  });

  it('are not counted at all outside a provider: nothing is gated there', () => {
    render(<Probe />);
    expect(state()).toBe('open|fine');
  });
});

/* ------------------------------------------------------------------ */
/* In the games                                                        */
/* ------------------------------------------------------------------ */

const home = () => screen.getByRole('button', HOME_BUTTON);
const locked = () => home().getAttribute('data-locked') === 'true';

describe('a child who is struggling', () => {
  afterEach(() => vi.useRealTimers());

  describe('in Pola', () => {
    async function openPola(user: User) {
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Pola/ }));
      await user.click(screen.getByRole('button', { name: 'Baris' }));
    }
    const wrong = (user: User) => user.click(screen.getByRole('button', { name: 'Pilih biru' }));

    it('can leave after three wrong picks in a row, without the sum', async () => {
      const user = setupUser();
      await openPola(user);
      expect(locked()).toBe(true);

      await wrong(user);
      await wrong(user);
      expect(locked()).toBe(true);
      await wrong(user);
      expect(locked()).toBe(false);

      await user.click(home());
      expect(screen.queryByRole('dialog', { name: 'Khusus orang tua' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    });

    it('is still gated when a right pick came between the wrong ones', async () => {
      const user = setupUser();
      await openPola(user);
      await wrong(user);
      await wrong(user);
      await user.click(screen.getByRole('button', { name: 'Pilih merah' })); // right: the round is won
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));
      // Round 2 is the other pair of colours, where "merah" is not on offer.
      await user.click(screen.getAllByRole('button', { name: /^Pilih (kuning|hijau)$/ })[0]);

      expect(locked()).toBe(true);
    });

    it('is asked for the sum again in the next module', async () => {
      const user = setupUser();
      await openPola(user);
      await wrong(user);
      await wrong(user);
      await wrong(user);
      await user.click(home());
      await user.click(screen.getByRole('button', { name: /Kasir/ }));

      expect(locked()).toBe(true);
    });
  });

  describe('in Kasir', () => {
    it('counts each whole count, not each piece: right pieces on the way do not undo a wrong count', async () => {
      const user = setupUser();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Kasir/ }));
      await user.click(screen.getByRole('button', { name: 'Tambah Rp 500' })); // right: the first customer is paid
      await user.click(screen.getByRole('button', { name: 'Pembeli berikutnya' })); // owed Rp 1.000
      // Three wrong counts in a row, each with a right piece first.
      for (let n = 0; n < 3; n += 1) {
        await user.click(screen.getByRole('button', { name: 'Tambah Rp 500' })); // fine so far
        await user.click(screen.getByRole('button', { name: 'Tambah Rp 2.000' })); // too much
        await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));
      }

      expect(locked()).toBe(false);
    });

    it('is still gated if a count in between was right', async () => {
      const user = setupUser();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Kasir/ }));
      for (let n = 0; n < 2; n += 1) {
        await user.click(screen.getByRole('button', { name: 'Tambah Rp 2.000' }));
        await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));
      }
      await user.click(screen.getByRole('button', { name: 'Tambah Rp 500' })); // right
      await user.click(screen.getByRole('button', { name: 'Pembeli berikutnya' }));
      await user.click(screen.getByRole('button', { name: 'Tambah Rp 2.000' })); // wrong again, but only the first since

      expect(locked()).toBe(true);
    });

    it('can leave after three counts that went wrong', async () => {
      const user = setupUser();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Kasir/ }));
      expect(locked()).toBe(true);

      for (let n = 0; n < 3; n += 1) {
        await user.click(screen.getByRole('button', { name: 'Tambah Rp 2.000' })); // the first customer is owed Rp 500
        await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));
      }

      expect(locked()).toBe(false);
    });

    it('can leave after counts that went wrong because the right change had become impossible', async () => {
      const user = setupUser();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Kasir/ }));
      // Serve the first four customers, to reach one owed Rp 3.000 (Susu).
      for (const owed of [[500], [1000], [2000], [1000, 500]]) {
        for (const piece of owed) await user.click(screen.getByRole('button', { name: `Tambah Rp ${piece.toLocaleString('id-ID')}` }));
        await user.click(screen.getByRole('button', { name: 'Pembeli berikutnya' }));
      }
      // Now: three Rp 500 in a row cannot lead to Rp 3.000, and that is a wrong count too.
      for (let n = 0; n < 3; n += 1) {
        for (let k = 0; k < 3; k += 1) await user.click(screen.getByRole('button', { name: 'Tambah Rp 500' }));
        await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));
      }

      expect(locked()).toBe(false);
    }, 30_000);
  });

  describe('in Labirin', () => {
    const labelAt = (maze: Maze, p: Position) => (cellAt(maze, p) as { label: string }).label;
    const tile = (label: string) => screen.getByRole('button', { name: new RegExp(`^Huruf ${label}(,|$)`) });

    it('can leave after three wrong taps at a fork', async () => {
      const user = setupUser();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Labirin/ }));
      await user.click(screen.getByRole('button', { name: 'Huruf' }));

      const maze = buildMaze(MAZE_LEVELS[0], 'letters');
      const fork = maze.route.findIndex((_, k) => isFork(maze, k));
      let decoy: Position | undefined;
      for (let i = 0; i < maze.cells.length; i += 1) {
        const p = { row: Math.floor(i / maze.cols), col: i % maze.cols };
        if (maze.cells[i].type === 'decoy' && areNeighbours(maze.route[fork], p)) decoy = p;
      }
      await user.click(tile(labelAt(maze, maze.route[0])));
      for (let i = 1; i <= fork; i += 1) await user.click(tile(labelAt(maze, maze.route[i])));

      expect(locked()).toBe(true);
      for (let n = 0; n < 3; n += 1) await user.click(tile(labelAt(maze, decoy!)));
      expect(locked()).toBe(false);
    });
  });

  describe('in Memori', () => {
    it('can leave after three pairs that did not match', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = setupUser({ advanceTimers: vi.advanceTimersByTime });
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Memori/ }));

      const board = deal(pairsFor(MEMORI_LEVELS[0], 0), seedFor(MEMORI_LEVELS[0], 0));
      const stranger = board.cards.find((c) => c.pair !== board.cards[0].pair)!.index;
      const card = (i: number) => screen.getByRole('button', { name: new RegExp(`^Kartu ${i + 1}(,|$)`) });

      expect(locked()).toBe(true);
      for (let n = 0; n < 3; n += 1) {
        await user.click(card(0));
        await user.click(card(stranger));
        await act(() => vi.advanceTimersByTimeAsync(MISMATCH_MS + 100));
      }
      expect(locked()).toBe(false);
    });
  });

  describe('in the games that cannot be got wrong', () => {
    it('is never counted as struggling: Berhitung has no wrong answers, however often it is restarted', async () => {
      const user = setupUser();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Berhitung/ }));
      for (let n = 0; n < 6; n += 1) await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));

      expect(locked()).toBe(true);
    });

    it('the two letter games have none either', async () => {
      const user = setupUser();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));
      for (let n = 0; n < 6; n += 1) await user.click(screen.getByRole('button', { name: 'Dengarkan huruf A' }));
      expect(locked()).toBe(true);

      await leaveGame(user);
      await user.click(screen.getByRole('button', { name: /Belajar Bicara/ }));
      for (let n = 0; n < 6; n += 1) await user.click(screen.getByRole('button', { name: /^Dengarkan kata/ }));
      expect(locked()).toBe(true);
    });
  });
});
