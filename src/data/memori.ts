import { WORD_CARDS } from './curriculum';
import { HIJAIYAH } from './scripts';
import type { Script } from './scripts';

/**
 * Memori - find the pairs.
 *
 * Cards lie face down. The child turns one over, then another. A pair stays
 * face up; two that do not match turn back after a moment, and the child tries
 * again. Remembering where a card was is working memory, and at three years old
 * four cards is already a real challenge.
 *
 * Two kinds of pair, easiest first:
 *  - the same picture twice (two apples);
 *  - a letter and a picture that starts with it (A and an apple), which is the
 *    link Belajar Bicara teaches. In Arabic it is a hijaiyah letter and the
 *    word card for it.
 *
 * This file is only the rules: what the cards are, how they are dealt, and what
 * turning one over does. The screen draws it and speaks it.
 */

/** What one side of a card shows. */
export type Face =
  | { kind: 'word'; word: string }
  | { kind: 'letter'; letter: string }
  | { kind: 'hijaiyah'; letterId: string }
  | { kind: 'arabicWord'; letterId: string };

/** Two faces that belong together. For a "same picture" pair they are equal. */
export type Pair = { id: string; a: Face; b: Face };

export type MemoriLevel = {
  id: string;
  pairs: number;
  mode: 'picture' | 'letter';
};

/** Four cards, six, eight - then letters with their pictures. */
export const MEMORI_LEVELS: MemoriLevel[] = [
  { id: 'sama-2', pairs: 2, mode: 'picture' },
  { id: 'sama-3', pairs: 3, mode: 'picture' },
  { id: 'sama-4', pairs: 4, mode: 'picture' },
  { id: 'huruf-3', pairs: 3, mode: 'letter' },
  { id: 'huruf-4', pairs: 4, mode: 'letter' },
];

/**
 * Words with clear, different pictures, each starting with a different letter.
 * Every one is a card in Belajar Bicara, so each already has a recording slot
 * and an icon.
 */
export const MEMORI_WORDS = [
  'Apel', 'Buku', 'Daun', 'Ikan', 'Kucing', 'Mobil', 'Pisang', 'Rumah', 'Susu', 'Lampu', 'Hati', 'Wortel',
] as const;

/** How many hijaiyah take part in the letter levels: the first dozen, in order. */
export const MEMORI_HIJAIYAH = 12;

export const MEMORI_PREFIX = 'memori:';

/** The review book's key for a pair. */
export function memoriKey(pairId: string): string {
  return MEMORI_PREFIX + pairId;
}

/* ------------------------------------------------------------------ */
/* Choosing the pairs for a round                                      */
/* ------------------------------------------------------------------ */

function poolFor(mode: MemoriLevel['mode'], script: Script): Pair[] {
  if (mode === 'picture') {
    return MEMORI_WORDS.map((word) => ({
      id: `picture:${word}`,
      a: { kind: 'word', word },
      b: { kind: 'word', word },
    }));
  }

  if (script === 'arab') {
    return HIJAIYAH.slice(0, MEMORI_HIJAIYAH).map((h) => ({
      id: `hijaiyah:${h.id}`,
      a: { kind: 'hijaiyah', letterId: h.id },
      b: { kind: 'arabicWord', letterId: h.id },
    }));
  }

  return MEMORI_WORDS.map((word) => {
    const card = WORD_CARDS.find((c) => c.word === word);
    if (!card) throw new Error(`"${word}" is not a Belajar Bicara card.`);
    return {
      id: `letter:${card.letter}`,
      a: { kind: 'letter', letter: card.letter },
      b: { kind: 'word', word },
    };
  });
}

/**
 * The pairs for one round.
 *
 * Pairs the child has fumbled (`weakIds`, as the review book names them) come
 * first, so they are practised again; the rest are taken from the pool in turn,
 * starting further along each round so the same pictures do not come up every
 * time.
 */
export function pairsFor(
  level: MemoriLevel,
  round: number,
  script: Script = 'latin',
  weakIds: readonly string[] = [],
): Pair[] {
  const pool = poolFor(level.mode, script);
  const chosen: Pair[] = [];

  for (const id of weakIds) {
    const pair = pool.find((p) => p.id === id);
    if (pair && !chosen.includes(pair) && chosen.length < level.pairs) chosen.push(pair);
  }

  const start = (round * level.pairs) % pool.length;
  for (let k = 0; chosen.length < level.pairs && k < pool.length; k += 1) {
    const pair = pool[(start + k) % pool.length];
    if (!chosen.includes(pair)) chosen.push(pair);
  }
  return chosen;
}

/* ------------------------------------------------------------------ */
/* Dealing                                                             */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type CardState = 'down' | 'up' | 'matched';

export type MemoriCard = {
  /** Where it lies on the table. Fixed for the whole round: cards never move. */
  index: number;
  pair: string;
  face: Face;
  state: CardState;
};

export type Board = {
  cards: MemoriCard[];
  /** The card turned over first, while the child looks for its partner. */
  first: number | null;
  /** Two cards that did not match, face up until `settle`. While set, nothing else turns. */
  mismatch: [number, number] | null;
};

/**
 * Lays the pairs out face down, shuffled. The same `seed` always gives the same
 * layout, so a round can be replayed - and tested.
 */
export function deal(pairs: Pair[], seed: number): Board {
  const faces = pairs.flatMap((p) => [
    { pair: p.id, face: p.a },
    { pair: p.id, face: p.b },
  ]);

  const rng = mulberry32(seed);
  for (let i = faces.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [faces[i], faces[j]] = [faces[j], faces[i]];
  }

  return {
    cards: faces.map((f, index) => ({ index, pair: f.pair, face: f.face, state: 'down' })),
    first: null,
    mismatch: null,
  };
}

/** A number for `deal`, from the level and the round. */
export function seedFor(level: MemoriLevel, round: number): number {
  let hash = 7;
  for (const ch of `${level.id}:${round}`) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) | 0;
  return hash;
}

/* ------------------------------------------------------------------ */
/* Turning cards over                                                  */
/* ------------------------------------------------------------------ */

export type FlipResult = {
  board: Board;
  /**
   *  - ignored:  nothing happened (already face up, or two are waiting to turn back)
   *  - first:    the first card of an attempt is up
   *  - match:    the second matched the first
   *  - won:      ...and that was the last pair
   *  - mismatch: the second did not match; both stay up until `settle`
   */
  outcome: 'ignored' | 'first' | 'match' | 'won' | 'mismatch';
  /** For match, won and mismatch: the pair the child was looking for (the first card's). */
  pair?: string;
};

export function flip(board: Board, index: number): FlipResult {
  const card = board.cards[index];
  if (!card || board.mismatch !== null || card.state !== 'down') return { board, outcome: 'ignored' };

  const cards = board.cards.map((c) => ({ ...c }));
  cards[index].state = 'up';

  if (board.first === null) {
    return { board: { cards, first: index, mismatch: null }, outcome: 'first' };
  }

  const wanted = cards[board.first];
  if (wanted.pair === card.pair) {
    cards[board.first].state = 'matched';
    cards[index].state = 'matched';
    const won = cards.every((c) => c.state === 'matched');
    return { board: { cards, first: null, mismatch: null }, outcome: won ? 'won' : 'match', pair: wanted.pair };
  }

  return {
    board: { cards, first: null, mismatch: [board.first, index] },
    outcome: 'mismatch',
    pair: wanted.pair,
  };
}

/** Turns a mismatched pair back face down, so the child can go on. */
export function settle(board: Board): Board {
  if (board.mismatch === null) return board;
  const cards = board.cards.map((c) => ({ ...c }));
  for (const i of board.mismatch) cards[i].state = 'down';
  return { cards, first: null, mismatch: null };
}

/** The face-down card that goes with `index` - what a hint points at. */
export function partnerOf(board: Board, index: number): number | null {
  const card = board.cards[index];
  if (!card) return null;
  const other = board.cards.find((c) => c.index !== index && c.pair === card.pair && c.state !== 'matched');
  return other ? other.index : null;
}
