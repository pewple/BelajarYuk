/**
 * Pola - patterns to continue.
 *
 * A row of things repeats ("red, blue, red, blue ...") and the last place is a
 * question mark. The child picks what comes next. Spotting and extending a
 * repeating pattern is the first step of algebraic thinking, and a three-year-old
 * can do it with two colours.
 *
 * It comes in two kinds, which the child (or the grown-up beside them) chooses
 * between - or lets the app mix:
 *
 *  - Baris: the things in the row are single shapes - a red circle, a blue
 *    square, a yellow triangle, a green star.
 *  - Kotak: the things are boxes, each holding two to four shapes. Two or three
 *    are stacked one above the other; four sit in a two-by-two square. What
 *    repeats is the whole box, so the child has to see how the shapes inside it
 *    are arranged, not just which colours there are.
 *
 * Every shape has its own colour *and* its own form, so a child who cannot tell
 * two colours apart can still tell a circle from a square, and the pattern is
 * the same either way.
 */

export type TokenId = 'merah' | 'biru' | 'kuning' | 'hijau';

export type Token = {
  id: TokenId;
  /** Spoken and shown to assistive tech: the colour's name. */
  name: string;
  shape: 'circle' | 'square' | 'triangle' | 'star';
  /** Fill colour. Shade 500-600 so the shape reads against a white tile. */
  fill: string;
};

export const TOKENS: Record<TokenId, Token> = {
  merah: { id: 'merah', name: 'merah', shape: 'circle', fill: '#dc2626' },
  biru: { id: 'biru', name: 'biru', shape: 'square', fill: '#2563eb' },
  kuning: { id: 'kuning', name: 'kuning', shape: 'triangle', fill: '#facc15' },
  hijau: { id: 'hijau', name: 'hijau', shape: 'star', fill: '#16a34a' },
};

/* ------------------------------------------------------------------ */
/* Kinds                                                               */
/* ------------------------------------------------------------------ */

/** What a pattern is made of. */
export type PolaKind = 'baris' | 'kotak';

/**
 * What was chosen on the way in. "acak" is not a third kind of pattern: it means
 * each round is, by chance, one of the other two.
 */
export type PolaMode = PolaKind | 'acak';

/**
 * The kind of one round, given the choice. A fixed choice is that kind every
 * time; "acak" flips a coin per round. `random` is injectable so a test can say
 * which way the coin falls.
 */
export function kindFor(mode: PolaMode, random: () => number = Math.random): PolaKind {
  if (mode !== 'acak') return mode;
  return random() < 0.5 ? 'baris' : 'kotak';
}

/* ------------------------------------------------------------------ */
/* Boxes                                                               */
/* ------------------------------------------------------------------ */

/**
 * A box is named by its shapes, in reading order (top to bottom, then left to
 * right): "merah+biru" is a red circle over a blue square.
 */
export function boxCells(id: string): TokenId[] {
  return id.split('+') as TokenId[];
}

export type BoxLayout = { cols: number; rows: number };

/** Two or three shapes are stacked in one column; four make a two-by-two square. */
export function layoutOf(cells: number): BoxLayout {
  return cells === 4 ? { cols: 2, rows: 2 } : { cols: 1, rows: cells };
}

/* ------------------------------------------------------------------ */
/* Levels                                                              */
/* ------------------------------------------------------------------ */

export type PolaLevel = {
  /** Stable, and unique across both kinds. The review book files a fumble under it. */
  id: string;
  kind: PolaKind;
  /**
   * The part that repeats, e.g. red, blue (AB) or red, red, blue (AAB). Each
   * entry is a shape's id for a row, or a box's name for a box pattern.
   */
  unit: string[];
  /**
   * What is on offer to pick from, in a fixed order. The tray is the same for
   * every round of a level, so a child learns where each thing lives.
   */
  palette: string[];
};

const line = (id: string, unit: TokenId[], palette: TokenId[]): PolaLevel => ({ id, kind: 'baris', unit, palette });
const boxes = (id: string, unit: string[]): PolaLevel => ({ id, kind: 'kotak', unit, palette: [...unit] });

/**
 * Rows, easiest first. Two colours repeating (AB), then a doubled one (AAB),
 * then three colours (ABC). Each kind comes in more than one colour scheme so
 * the game keeps looking new.
 */
export const POLA_LEVELS: PolaLevel[] = [
  line('ab-merah-biru', ['merah', 'biru'], ['merah', 'biru']),
  line('ab-kuning-hijau', ['kuning', 'hijau'], ['kuning', 'hijau']),
  line('aab-merah-biru', ['merah', 'merah', 'biru'], ['merah', 'biru']),
  line('aab-kuning-hijau', ['kuning', 'kuning', 'hijau'], ['kuning', 'hijau']),
  line('abc-merah-kuning-biru', ['merah', 'kuning', 'biru'], ['merah', 'kuning', 'biru']),
  line('abb-biru-hijau', ['biru', 'hijau', 'hijau'], ['biru', 'hijau']),
  line('abc-hijau-merah-biru', ['hijau', 'merah', 'biru'], ['merah', 'biru', 'hijau']),
];

/**
 * Boxes, two shapes stacked to four in a square. Every pattern is AB over two
 * boxes that hold the same shapes arranged the other way round - so "which
 * colours?" is not enough, and the child has to look at where each one sits.
 * They stay AB: with more boxes in the row they would stop being big enough to
 * see on a phone.
 */
export const BOX_LEVELS: PolaLevel[] = [
  boxes('kotak-2-merah-biru', ['merah+biru', 'biru+merah']),
  boxes('kotak-2-kuning-hijau', ['kuning+hijau', 'hijau+kuning']),
  boxes('kotak-3-merah-kuning-biru', ['merah+kuning+biru', 'biru+kuning+merah']),
  boxes('kotak-3-hijau-biru-merah', ['hijau+biru+merah', 'merah+biru+hijau']),
  boxes('kotak-4-merah-biru', ['merah+biru+biru+merah', 'biru+merah+merah+biru']),
  boxes('kotak-4-empat-warna', ['merah+kuning+biru+hijau', 'hijau+biru+kuning+merah']),
];

export const LEVELS: Record<PolaKind, PolaLevel[]> = { baris: POLA_LEVELS, kotak: BOX_LEVELS };

/* ------------------------------------------------------------------ */
/* Rounds                                                              */
/* ------------------------------------------------------------------ */

export type PolaRound = {
  level: PolaLevel;
  /** What is showing: two full repeats of the unit. */
  shown: string[];
  /** What comes next. */
  answer: string;
};

/**
 * One round of a level.
 *
 * The row always shows two whole repeats, so there is exactly one way to carry
 * it on. Which part of the unit it starts from changes with `round`, so the
 * answer is not always the first thing - without that, "pick the first one in
 * the pattern" would solve every round.
 */
export function buildRound(level: PolaLevel, round: number): PolaRound {
  const { unit } = level;
  const start = round % unit.length;
  const at = (i: number) => unit[(i + start) % unit.length];

  return {
    level,
    shown: Array.from({ length: unit.length * 2 }, (_, i) => at(i)),
    answer: at(unit.length * 2),
  };
}

/** The whole row said aloud once it is right: what was shown, then the answer. */
export function fullPattern(round: PolaRound): string[] {
  return [...round.shown, round.answer];
}
