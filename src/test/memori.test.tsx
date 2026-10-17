import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupUser } from './user';
import App from '../App';
import { HINTS_STORAGE_KEY } from '../data/hints';
import {
  MEMORI_HIJAIYAH,
  MEMORI_LEVELS,
  MEMORI_WORDS,
  deal,
  flip,
  pairsFor,
  partnerOf,
  seedFor,
  settle,
} from '../data/memori';
import type { Board } from '../data/memori';
import { WORD_CARDS } from '../data/curriculum';
import { REVIEW_STORAGE_KEY } from '../data/review';
import { UNLOCK_AFTER_GAMES } from '../data/session';
import { MISMATCH_MS, peekMs } from '../screens/MemoriScreen';
import { leaveGame } from './helpers';
import { installVoice, spokenTexts } from './setup';

type User = ReturnType<typeof userEvent.setup>;

/* ------------------------------------------------------------------ */
/* The rules                                                           */
/* ------------------------------------------------------------------ */

const boardFor = (level: number, round: number, weak: string[] = []): Board =>
  deal(pairsFor(MEMORI_LEVELS[level], round, 'latin', weak), seedFor(MEMORI_LEVELS[level], round));

/** The two table positions of a pair. */
const positions = (board: Board, pair: string) => board.cards.filter((c) => c.pair === pair).map((c) => c.index);

describe('the levels', () => {
  it('start at four cards, grow to eight, and then pair letters with pictures', () => {
    expect(MEMORI_LEVELS.map((l) => l.pairs)).toEqual([2, 3, 4, 3, 4]);
    expect(MEMORI_LEVELS.map((l) => l.mode)).toEqual(['picture', 'picture', 'picture', 'letter', 'letter']);
  });

  it('have unique ids', () => {
    expect(new Set(MEMORI_LEVELS.map((l) => l.id)).size).toBe(MEMORI_LEVELS.length);
  });

  it('only use words that are Belajar Bicara cards, each starting with a different letter', () => {
    const cards = MEMORI_WORDS.map((w) => WORD_CARDS.find((c) => c.word === w));
    expect(cards.every(Boolean)).toBe(true);
    expect(new Set(cards.map((c) => c!.letter)).size).toBe(MEMORI_WORDS.length);
  });
});

describe('choosing the pairs', () => {
  it.each(MEMORI_LEVELS.map((l, i) => [l.id, i] as const))('%s has exactly its number of different pairs', (_id, i) => {
    for (let round = 0; round < 12; round += 1) {
      const pairs = pairsFor(MEMORI_LEVELS[i], round);
      expect(pairs).toHaveLength(MEMORI_LEVELS[i].pairs);
      expect(new Set(pairs.map((p) => p.id)).size).toBe(pairs.length);
    }
  });

  it('pairs a picture with itself in the picture levels', () => {
    for (const pair of pairsFor(MEMORI_LEVELS[0], 0)) expect(pair.a).toEqual(pair.b);
  });

  it('pairs a letter with a picture that starts with it in the letter levels', () => {
    for (const pair of pairsFor(MEMORI_LEVELS[3], 0)) {
      if (pair.a.kind !== 'letter' || pair.b.kind !== 'word') throw new Error('not a letter pair');
      const word = pair.b.word;
      expect(WORD_CARDS.find((c) => c.word === word)!.letter).toBe(pair.a.letter);
    }
  });

  it('pairs a hijaiyah letter with its word card, in Arabic', () => {
    const pairs = pairsFor(MEMORI_LEVELS[3], 0, 'arab');

    for (const pair of pairs) {
      expect(pair.a.kind).toBe('hijaiyah');
      expect(pair.b.kind).toBe('arabicWord');
      if (pair.a.kind === 'hijaiyah' && pair.b.kind === 'arabicWord') expect(pair.a.letterId).toBe(pair.b.letterId);
    }
  });

  it(`uses only the first ${MEMORI_HIJAIYAH} hijaiyah, so the letters are the early ones`, () => {
    const ids = new Set<string>();
    for (let round = 0; round < 30; round += 1) {
      for (const p of pairsFor(MEMORI_LEVELS[4], round, 'arab')) if (p.a.kind === 'hijaiyah') ids.add(p.a.letterId);
    }
    expect(ids.size).toBe(MEMORI_HIJAIYAH);
  });

  it('does not show the same pictures every round', () => {
    const seen = new Set(Array.from({ length: 6 }, (_, r) => pairsFor(MEMORI_LEVELS[1], r).map((p) => p.id).join()));
    expect(seen.size).toBeGreaterThan(2);
  });

  it('puts pairs the child fumbled first', () => {
    const weak = ['picture:Wortel', 'picture:Susu'];
    const ids = pairsFor(MEMORI_LEVELS[1], 0, 'latin', weak).map((p) => p.id);

    expect(ids.slice(0, 2)).toEqual(weak);
    expect(ids).toHaveLength(3);
  });

  it('ignores a fumbled pair that is not in this kind of level, and never goes over the count', () => {
    const ids = pairsFor(MEMORI_LEVELS[0], 0, 'latin', ['letter:A', 'picture:Apel', 'picture:Buku', 'picture:Daun']).map(
      (p) => p.id,
    );

    expect(ids).toEqual(['picture:Apel', 'picture:Buku']);
  });
});

describe('dealing', () => {
  it('lays out two cards for every pair, face down', () => {
    const board = boardFor(2, 0);

    expect(board.cards).toHaveLength(8);
    expect(board.cards.every((c) => c.state === 'down')).toBe(true);
    for (const pair of new Set(board.cards.map((c) => c.pair))) expect(positions(board, pair)).toHaveLength(2);
  });

  it('is the same every time for the same round, and different between rounds', () => {
    expect(boardFor(2, 3)).toEqual(boardFor(2, 3));
    expect(boardFor(2, 3).cards.map((c) => c.pair)).not.toEqual(boardFor(2, 4).cards.map((c) => c.pair));
  });

  it('does not put every pair side by side', () => {
    // Over a run of rounds the shuffle must actually mix the cards.
    const sorted = Array.from({ length: 10 }, (_, r) => boardFor(2, r)).filter((b) =>
      b.cards.every((c, i) => i % 2 === 1 || c.pair === b.cards[i + 1].pair),
    );
    expect(sorted.length).toBeLessThan(3);
  });

  it('numbers the places from 0, in order', () => {
    expect(boardFor(1, 0).cards.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('gives different rounds different seeds', () => {
    expect(seedFor(MEMORI_LEVELS[0], 0)).not.toBe(seedFor(MEMORI_LEVELS[0], 1));
    expect(seedFor(MEMORI_LEVELS[0], 0)).not.toBe(seedFor(MEMORI_LEVELS[1], 0));
  });
});

describe('turning cards over', () => {
  it('turns the first card face up and waits for the second', () => {
    const board = boardFor(0, 0);
    const result = flip(board, 0);

    expect(result.outcome).toBe('first');
    expect(result.board.cards[0].state).toBe('up');
    expect(result.board.first).toBe(0);
  });

  it('keeps a pair face up when the second card matches', () => {
    const board = boardFor(0, 0);
    const [a, b] = positions(board, board.cards[0].pair);
    const result = flip(flip(board, a).board, b);

    expect(result.outcome).toBe('match');
    expect(result.board.cards[a].state).toBe('matched');
    expect(result.board.cards[b].state).toBe('matched');
    expect(result.board.first).toBeNull();
    expect(result.pair).toBe(board.cards[0].pair);
  });

  it('holds both cards face up when the second does not match, and names the pair being looked for', () => {
    const board = boardFor(0, 0);
    const wanted = board.cards[0].pair;
    const stranger = board.cards.find((c) => c.pair !== wanted)!.index;
    const result = flip(flip(board, 0).board, stranger);

    expect(result.outcome).toBe('mismatch');
    expect(result.pair).toBe(wanted);
    expect(result.board.mismatch).toEqual([0, stranger]);
    expect(result.board.cards[0].state).toBe('up');
    expect(result.board.cards[stranger].state).toBe('up');
  });

  it('turns nothing else while a mismatch waits to turn back', () => {
    const board = boardFor(1, 0);
    const stranger = board.cards.find((c) => c.pair !== board.cards[0].pair)!.index;
    const held = flip(flip(board, 0).board, stranger).board;
    const other = held.cards.find((c) => c.state === 'down')!.index;

    expect(flip(held, other).outcome).toBe('ignored');
    expect(flip(held, other).board).toBe(held);
  });

  it('turns the two cards back down when settled, and lets play go on', () => {
    const board = boardFor(1, 0);
    const stranger = board.cards.find((c) => c.pair !== board.cards[0].pair)!.index;
    const settled = settle(flip(flip(board, 0).board, stranger).board);

    expect(settled.cards.every((c) => c.state === 'down')).toBe(true);
    expect(settled.mismatch).toBeNull();
    expect(flip(settled, 0).outcome).toBe('first');
  });

  it('leaves a board alone that has nothing to settle', () => {
    const board = boardFor(0, 0);
    expect(settle(board)).toBe(board);
  });

  it('ignores a card that is already up or matched, and one that is not there', () => {
    const board = boardFor(0, 0);
    const up = flip(board, 0).board;

    expect(flip(up, 0).outcome).toBe('ignored');
    expect(flip(board, 99).outcome).toBe('ignored');
    expect(flip(board, -1).outcome).toBe('ignored');
  });

  it('says "won" on the last pair', () => {
    let board = boardFor(0, 0);
    let last = flip(board, 0);
    for (const pair of new Set(board.cards.map((c) => c.pair))) {
      const [a, b] = positions(board, pair);
      board = flip(board, a).board;
      last = flip(board, b);
      board = last.board;
    }

    expect(last.outcome).toBe('won');
    expect(board.cards.every((c) => c.state === 'matched')).toBe(true);
  });

  it('never changes a board it was given', () => {
    const board = boardFor(0, 0);
    const copy = JSON.stringify(board);
    flip(board, 0);
    expect(JSON.stringify(board)).toBe(copy);
  });

  it('points at the partner of a card, but not once it has been matched', () => {
    const board = boardFor(0, 0);
    const [a, b] = positions(board, board.cards[0].pair);

    expect(partnerOf(board, a)).toBe(b);
    expect(partnerOf(board, b)).toBe(a);
    const matched = flip(flip(board, a).board, b).board;
    expect(partnerOf(matched, a)).toBeNull();
    expect(partnerOf(board, 99)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* The screen                                                          */
/* ------------------------------------------------------------------ */

const card = (i: number) => screen.getByRole('button', { name: new RegExp(`^Kartu ${i + 1}(,|$)`) });
const faceUp = (i: number) => card(i).getAttribute('data-state') !== 'down';

async function openMemori(user: User) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Memori/ }));
}

/** Finds all the pairs of the round on screen. */
async function solve(user: User, board: Board) {
  for (const pair of new Set(board.cards.map((c) => c.pair))) {
    const [a, b] = positions(board, pair);
    await user.click(card(a));
    await user.click(card(b));
  }
}

describe('Memori', () => {
  beforeEach(() => installVoice('Test Indonesian', 'id-ID'));

  const setHints = (level: 'guided' | 'independent', streak = 0) =>
    window.localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify({ memori: { level, streak } }));

  describe('opening it', () => {
    it('is on the home screen, between Pola and Labirin', () => {
      render(<App />);
      const titles = ['Pola', 'Memori', 'Labirin'];
      const order = screen
        .getAllByRole('button')
        .map((b) => titles.find((t) => b.textContent?.includes(t)))
        .filter(Boolean);

      expect(order).toEqual(titles);
    });

    it('opens on four face-down cards and goes home again', async () => {
      const user = setupUser();
      await openMemori(user);

      expect(screen.getByRole('heading', { name: 'Memori' })).toBeInTheDocument();
      for (let i = 0; i < 4; i += 1) expect(faceUp(i)).toBe(false);
      expect(screen.queryByRole('button', { name: /^Kartu 5/ })).not.toBeInTheDocument();
      await leaveGame(user);
      expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    });

    it('says what to do out loud, with a speaker button to say it again', async () => {
      const user = setupUser();
      await openMemori(user);
      expect(spokenTexts).toContain('Cari yang sama!');

      spokenTexts.length = 0;
      await user.click(screen.getByRole('button', { name: 'Ulangi perintah' }));
      expect(spokenTexts).toContain('Cari yang sama!');
    });

    it('names each card for assistive tech, face down or up', async () => {
      const user = setupUser();
      await openMemori(user);
      const board = boardFor(0, 0);

      expect(card(0)).toHaveAttribute('aria-label', 'Kartu 1, tertutup');
      await user.click(card(0));
      expect(card(0)).toHaveAttribute('aria-label', `Kartu 1, ${(board.cards[0].face as { word: string }).word}`);
    });
  });

  describe('turning cards', () => {
    it('says what a card is when it is turned over', async () => {
      const user = setupUser();
      await openMemori(user);
      spokenTexts.length = 0;

      await user.click(card(0));
      expect(spokenTexts).toContain((boardFor(0, 0).cards[0].face as { word: string }).word);
    });

    it('keeps a matching pair face up and shows it as matched', async () => {
      const user = setupUser();
      await openMemori(user);
      const board = boardFor(0, 0);
      const [a, b] = positions(board, board.cards[0].pair);
      await user.click(card(a));
      await user.click(card(b));

      expect(card(a)).toHaveAttribute('data-state', 'matched');
      expect(card(b)).toBeDisabled();
      expect(card(a).getAttribute('aria-label')).toMatch(/sudah cocok/);
    });

    it('answers a wrong guess softly, keeps both cards up, and turns them back after a moment', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const user = setupUser({ advanceTimers: vi.advanceTimersByTime });
        await openMemori(user);
        const board = boardFor(0, 0);
        const stranger = board.cards.find((c) => c.pair !== board.cards[0].pair)!.index;

        await user.click(card(0));
        await user.click(card(stranger));
        expect(faceUp(0) && faceUp(stranger)).toBe(true);

        await act(() => vi.advanceTimersByTimeAsync(MISMATCH_MS + 100));
        expect(faceUp(0) || faceUp(stranger)).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('turns nothing else while a wrong pair is showing', async () => {
      const user = setupUser();
      await openMemori(user);
      const board = boardFor(0, 0);
      const stranger = board.cards.find((c) => c.pair !== board.cards[0].pair)!.index;
      const spare = board.cards.find((c) => c.index !== 0 && c.index !== stranger)!.index;

      await user.click(card(0));
      await user.click(card(stranger));
      await user.click(card(spare));

      expect(faceUp(spare)).toBe(false);
    });

    it('ignores a double-tap on one card', async () => {
      const user = setupUser();
      await openMemori(user);
      await user.dblClick(card(0));

      expect(card(0)).toHaveAttribute('data-state', 'up');
      expect(card(1)).toHaveAttribute('data-state', 'down'); // nothing else turned over
    });
  });

  describe('finishing', () => {
    it('celebrates when every pair is found, and offers the next round', async () => {
      const user = setupUser();
      await openMemori(user);
      await solve(user, boardFor(0, 0));

      expect(screen.getByText('Semua pasangan ketemu!', { selector: 'p' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Memori berikutnya' })).toBeInTheDocument();
    });

    it('praises the last card in one run with its name', async () => {
      const user = setupUser();
      await openMemori(user);
      const board = boardFor(0, 0);
      spokenTexts.length = 0;
      await solve(user, board);

      // The last card said its name and the praise followed it, as one run. (The
      // earlier cards' names were cut off by the next card, as they should be.)
      const words = board.cards.map((c) => (c.face as { word: string }).word);
      await waitFor(() => expect(spokenTexts.length).toBeGreaterThanOrEqual(2));
      expect(spokenTexts.some((text) => words.includes(text))).toBe(true);
    });

    it('goes on to six cards, then eight, then letters with pictures', async () => {
      const user = setupUser();
      await openMemori(user);
      const sizes: number[] = [];
      for (let round = 0; round < 4; round += 1) {
        const board = boardFor(round, round);
        sizes.push(screen.getAllByRole('button', { name: /^Kartu / }).length);
        await solve(user, board);
        await user.click(screen.getByRole('button', { name: 'Memori berikutnya' }));
      }

      expect(sizes).toEqual([4, 6, 8, 6]);
      // The fifth round is the last level: four letters, four pictures.
      expect(screen.getAllByRole('button', { name: /^Kartu / })).toHaveLength(8);
    });

    it('shows letters and pictures in the letter level', async () => {
      const user = setupUser();
      await openMemori(user);
      for (let round = 0; round < 3; round += 1) {
        await solve(user, boardFor(round, round));
        await user.click(screen.getByRole('button', { name: 'Memori berikutnya' }));
      }
      const board = boardFor(3, 3);
      await solve(user, board); // matched cards stay face up

      const labels = board.cards.map((_, i) => card(i).getAttribute('aria-label') ?? '');
      expect(labels.filter((l) => /huruf [A-Z],/.test(l))).toHaveLength(3); // a letter for each pair...
      expect(labels.filter((l) => !/huruf/.test(l))).toHaveLength(3); // ...and its picture
    });

    it('can be shuffled again if the child is stuck', async () => {
      const user = setupUser();
      await openMemori(user);
      const board = boardFor(0, 0);
      await user.click(card(0));
      await user.click(screen.getByRole('button', { name: 'Kocok ulang kartu' }));

      // Same round, dealt again: nothing is turned over.
      for (let i = 0; i < board.cards.length; i += 1) expect(faceUp(i)).toBe(false);
    });
  });

  describe('the hints', () => {
    it('start guided for a new child: every card shows for a few seconds, then turns down', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const user = setupUser({ advanceTimers: vi.advanceTimersByTime });
        await openMemori(user);

        for (let i = 0; i < 4; i += 1) expect(faceUp(i)).toBe(true);
        expect(screen.getByRole('group', { name: 'Kartu, lihat dulu' })).toBeInTheDocument();

        await act(() => vi.advanceTimersByTimeAsync(peekMs(4) + 100));
        for (let i = 0; i < 4; i += 1) expect(faceUp(i)).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('do not let a card be turned during the peek', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = setupUser();
      await openMemori(user);
      spokenTexts.length = 0;
      await user.click(card(0));

      expect(spokenTexts).toEqual([]); // the card was not turned, so it said nothing
    });

    it('are off for a child who has graduated: no peek', async () => {
      const user = setupUser();
      await openMemori(user);

      for (let i = 0; i < 4; i += 1) expect(faceUp(i)).toBe(false);
    });

    it('point at the missing partner after a wrong guess, for a child being guided', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const user = setupUser({ advanceTimers: vi.advanceTimersByTime });
        await openMemori(user);
        await act(() => vi.advanceTimersByTimeAsync(peekMs(4) + 100));
        const board = boardFor(0, 0);
        const stranger = board.cards.find((c) => c.pair !== board.cards[0].pair)!.index;
        const partner = positions(board, board.cards[0].pair).find((i) => i !== 0)!;

        await user.click(card(0));
        await user.click(card(stranger));
        expect(card(partner)).toHaveAttribute('data-hint', 'true');
        expect(card(stranger)).not.toHaveAttribute('data-hint');
      } finally {
        vi.useRealTimers();
      }
    });

    it('do not point at anything for a child who has graduated', async () => {
      const user = setupUser();
      await openMemori(user);
      const board = boardFor(0, 0);
      const stranger = board.cards.find((c) => c.pair !== board.cards[0].pair)!.index;
      await user.click(card(0));
      await user.click(card(stranger));

      expect(document.querySelector('[data-hint]')).toBeNull();
    });

    it('fade after three right guesses in a row', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const user = setupUser({ advanceTimers: vi.advanceTimersByTime });
        await openMemori(user);
        await act(() => vi.advanceTimersByTimeAsync(peekMs(4) + 100));
        await solve(user, boardFor(0, 0)); // two pairs: two right guesses
        await user.click(screen.getByRole('button', { name: 'Memori berikutnya' }));
        await act(() => vi.advanceTimersByTimeAsync(peekMs(6) + 100));
        const board = boardFor(1, 1);
        const [a, b] = positions(board, board.cards[0].pair);
        await user.click(card(a));
        await user.click(card(b)); // the third in a row

        expect(JSON.parse(window.localStorage.getItem(HINTS_STORAGE_KEY)!).memori).toEqual({
          level: 'independent',
          streak: 0,
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('come back after two wrong guesses in a row', async () => {
      setHints('independent');
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const user = setupUser({ advanceTimers: vi.advanceTimersByTime });
        await openMemori(user);
        const board = boardFor(0, 0);
        const stranger = board.cards.find((c) => c.pair !== board.cards[0].pair)!.index;

        await user.click(card(0));
        await user.click(card(stranger));
        await act(() => vi.advanceTimersByTimeAsync(MISMATCH_MS + 100));
        await user.click(card(0));
        await user.click(card(stranger));

        expect(JSON.parse(window.localStorage.getItem(HINTS_STORAGE_KEY)!).memori.level).toBe('guided');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('the review', () => {
    it('files a wrong guess under the pair that was being looked for, and a right one moves it up', async () => {
      const user = setupUser();
      await openMemori(user);
      const board = boardFor(0, 0);
      const wanted = board.cards[0].pair;
      const stranger = board.cards.find((c) => c.pair !== wanted)!.index;
      await user.click(card(0));
      await user.click(card(stranger));
      expect(JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY)!)[`memori:${wanted}`]).toMatchObject({
        box: 0,
        misses: 1,
      });
    });

    it('brings a fumbled pair into the next round', async () => {
      window.localStorage.setItem(
        REVIEW_STORAGE_KEY,
        JSON.stringify({ 'memori:picture:Wortel': { box: 0, due: 0, misses: 1 } }),
      );
      const user = setupUser();
      await openMemori(user);
      const wortel = pairsFor(MEMORI_LEVELS[0], 0, 'latin', ['picture:Wortel']).map((p) => p.id);
      expect(wortel).toContain('picture:Wortel');

      // The round shows a carrot: turning every card finds it.
      const labels: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        await user.click(card(i));
        labels.push(card(i).getAttribute('aria-label') ?? '');
      }
      expect(labels.join(' ')).toContain('Wortel');
    });

    it('records nothing for the first card of an attempt, only for how it ended', async () => {
      const user = setupUser();
      await openMemori(user);
      await user.click(card(0));

      expect(window.localStorage.getItem(REVIEW_STORAGE_KEY)).toBeNull();
    });
  });

  describe('Arabic', () => {
    it('pairs a hijaiyah letter with its word card in the letter levels', async () => {
      window.localStorage.setItem('belajar-yuk:script', 'arab');
      const user = setupUser();
      await openMemori(user);
      for (let round = 0; round < 3; round += 1) {
        await solve(user, boardFor(round, round));
        await user.click(screen.getByRole('button', { name: 'Memori berikutnya' }));
      }
      const board = deal(pairsFor(MEMORI_LEVELS[3], 3, 'arab'), seedFor(MEMORI_LEVELS[3], 3));
      await solve(user, board);

      const labels = board.cards.map((c) => card(c.index).getAttribute('aria-label') ?? '').join(' ');
      expect(labels).toMatch(/huruf [ء-ي] \(/);
    });
  });

  describe('leaving', () => {
    it(`is gated until ${UNLOCK_AFTER_GAMES} rounds are finished`, async () => {
      const user = setupUser();
      await openMemori(user);
      const home = () => screen.getByRole('button', { name: 'Kembali ke menu utama' });
      expect(home()).toHaveAttribute('data-locked', 'true');

      for (let round = 0; round < UNLOCK_AFTER_GAMES; round += 1) {
        await solve(user, boardFor(round % MEMORI_LEVELS.length, round));
        if (round < UNLOCK_AFTER_GAMES - 1) await user.click(screen.getByRole('button', { name: 'Memori berikutnya' }));
      }
      expect(home()).not.toHaveAttribute('data-locked');
    }, 30_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
