/**
 * Pola - patterns to continue.
 *
 * A row of coloured shapes repeats ("red, blue, red, blue ...") and the last
 * place is a question mark. The child picks the shape that comes next. Spotting
 * and extending a repeating pattern is the first step of algebraic thinking,
 * and a three-year-old can do it with two colours.
 *
 * Every shape has its own colour *and* its own form: a red circle, a blue
 * square, a yellow triangle, a green star. A child who cannot tell two colours
 * apart can still tell a circle from a square, and the pattern is the same
 * either way.
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

export type PolaLevel = {
  /** Stable. The review book files a fumble under it. */
  id: string;
  /** The part that repeats, e.g. red, blue (AB) or red, red, blue (AAB). */
  unit: TokenId[];
  /**
   * What is on offer to pick from, in a fixed order. The tray is the same for
   * every round of a level, so a child learns where each shape lives.
   */
  palette: TokenId[];
};

/**
 * Easiest first. Two colours repeating (AB), then a doubled one (AAB), then
 * three colours (ABC). Each kind comes in more than one colour scheme so the
 * game keeps looking new.
 */
export const POLA_LEVELS: PolaLevel[] = [
  { id: 'ab-merah-biru', unit: ['merah', 'biru'], palette: ['merah', 'biru'] },
  { id: 'ab-kuning-hijau', unit: ['kuning', 'hijau'], palette: ['kuning', 'hijau'] },
  { id: 'aab-merah-biru', unit: ['merah', 'merah', 'biru'], palette: ['merah', 'biru'] },
  { id: 'aab-kuning-hijau', unit: ['kuning', 'kuning', 'hijau'], palette: ['kuning', 'hijau'] },
  { id: 'abc-merah-kuning-biru', unit: ['merah', 'kuning', 'biru'], palette: ['merah', 'kuning', 'biru'] },
  { id: 'abb-biru-hijau', unit: ['biru', 'hijau', 'hijau'], palette: ['biru', 'hijau'] },
  { id: 'abc-hijau-merah-biru', unit: ['hijau', 'merah', 'biru'], palette: ['merah', 'biru', 'hijau'] },
];

export type PolaRound = {
  level: PolaLevel;
  /** What is showing: two full repeats of the unit. */
  shown: TokenId[];
  /** What comes next. */
  answer: TokenId;
};

/**
 * One round of a level.
 *
 * The row always shows two whole repeats, so there is exactly one way to carry
 * it on. Which part of the unit it starts from changes with `round`, so the
 * answer is not always the first colour - without that, "pick the first one in
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

/** The whole row said aloud once it is right: the shown tokens, then the answer. */
export function fullPattern(round: PolaRound): TokenId[] {
  return [...round.shown, round.answer];
}
