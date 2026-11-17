/**
 * Kuda - the horse, and what the child's stars can buy for it.
 *
 * Food is eaten on the spot: buy a carrot and the horse stops, puts its head
 * down and eats it. A colour, or a different horse, is bought once and kept:
 * after that it can be switched to and from as often as the child likes, for
 * nothing.
 *
 * The child starts with a foal (belo), a plain brown coat and a black mane,
 * all free.
 */

/**
 * Which horse: a foal (belo, the child's own), a pony foal, a grown horse, or a
 * unicorn - the grown horse with a horn. The pony foal keeps the id the pony had,
 * so a pony bought before is a pony foal now.
 */
export type KindId = 'anak' | 'poni' | 'dewasa' | 'unikorn';

export type Kind = {
  id: KindId;
  name: string;
  price: number;
  /** How big its picture is drawn on the button, against the grown horse's. */
  scale: number;
};

export const KINDS: Kind[] = [
  { id: 'anak', name: 'Belo', price: 0, scale: 0.62 },
  { id: 'poni', name: 'Anak poni', price: 15, scale: 0.55 },
  { id: 'dewasa', name: 'Kuda dewasa', price: 20, scale: 1 },
  { id: 'unikorn', name: 'Unikorn', price: 30, scale: 1 },
];

export type FoodId = 'wortel' | 'apel';

export type Food = {
  id: FoodId;
  name: string;
  price: number;
  /** For the button: a hex colour the picture is drawn in. */
  color: string;
};

export const FOODS: Food[] = [
  { id: 'wortel', name: 'Wortel', price: 2, color: '#f97316' },
  { id: 'apel', name: 'Apel', price: 3, color: '#dc2626' },
];

export type Coat = {
  id: string;
  name: string;
  price: number;
  /** The coat itself. */
  body: string;
  /** Lower legs, ear tips and the dock of the tail. */
  points: string;
  /** Around the mouth and nose. */
  muzzle: string;
};

export const COATS: Coat[] = [
  { id: 'cokelat', name: 'Cokelat', price: 0, body: '#7a441d', points: '#1a1210', muzzle: '#2a1d17' },
  { id: 'putih', name: 'Putih', price: 8, body: '#eeeae2', points: '#d9d2c6', muzzle: '#c9b3ad' },
  { id: 'hitam', name: 'Hitam', price: 8, body: '#26201d', points: '#110d0c', muzzle: '#1b1513' },
  { id: 'abu', name: 'Abu-abu', price: 8, body: '#9a9894', points: '#4b4845', muzzle: '#4f4a48' },
  { id: 'krem', name: 'Krem', price: 10, body: '#d9ac68', points: '#b98a4e', muzzle: '#9a7258' },
  { id: 'merah-muda', name: 'Merah muda', price: 12, body: '#ee7fae', points: '#d9578f', muzzle: '#b85a80' },
  { id: 'ungu', name: 'Ungu', price: 12, body: '#9d78dc', points: '#7451b8', muzzle: '#6a5294' },
  { id: 'biru', name: 'Biru', price: 12, body: '#62aae6', points: '#3d7fc0', muzzle: '#4d7396' },
];

/** A pattern over the coat, in the coat's own colours. */
export type PatternId = 'polos' | 'totol' | 'belang' | 'bintik';

export type Pattern = {
  id: PatternId;
  name: string;
  price: number;
};

export const PATTERNS: Pattern[] = [
  { id: 'polos', name: 'Polos', price: 0 },
  // An appaloosa: a white blanket over the rump, and dark spots all over.
  { id: 'totol', name: 'Totol', price: 12 },
  // A pinto: big white patches.
  { id: 'belang', name: 'Belang', price: 12 },
  // Dapples: pale rings over a deeper coat.
  { id: 'bintik', name: 'Bintik', price: 10 },
];

export type Mane = {
  id: string;
  name: string;
  price: number;
  /** Two shades the strands are mixed from. */
  dark: string;
  light: string;
  /** Every strand its own colour of the rainbow. */
  rainbow?: boolean;
};

export const MANES: Mane[] = [
  { id: 'hitam', name: 'Hitam', price: 0, dark: '#0b0908', light: '#35251a' },
  { id: 'cokelat', name: 'Cokelat', price: 6, dark: '#3b2414', light: '#7a4a26' },
  { id: 'pirang', name: 'Pirang', price: 8, dark: '#c9a052', light: '#f3dc96' },
  { id: 'putih', name: 'Putih', price: 8, dark: '#cfcac1', light: '#ffffff' },
  { id: 'merah-muda', name: 'Merah muda', price: 10, dark: '#e0559a', light: '#ffa8d2' },
  { id: 'ungu', name: 'Ungu', price: 10, dark: '#6a3fbf', light: '#b48cff' },
  { id: 'biru', name: 'Biru', price: 10, dark: '#2563eb', light: '#7cc0ff' },
  { id: 'pelangi', name: 'Pelangi', price: 20, dark: '#ff0000', light: '#0000ff', rainbow: true },
];

export const DEFAULT_KIND = KINDS[0];
export const DEFAULT_COAT = COATS[0];
export const DEFAULT_MANE = MANES[0];
export const DEFAULT_PATTERN = PATTERNS[0];

export const coatById = (id: string): Coat => COATS.find((c) => c.id === id) ?? DEFAULT_COAT;
export const maneById = (id: string): Mane => MANES.find((m) => m.id === id) ?? DEFAULT_MANE;
export const kindById = (id: string): Kind => KINDS.find((k) => k.id === id) ?? DEFAULT_KIND;
export const patternById = (id: string): Pattern => PATTERNS.find((p) => p.id === id) ?? DEFAULT_PATTERN;

/** What the child has bought, and which horse and colours are out now. */
export type Closet = {
  /** Bought, as `kind:<id>`, `coat:<id>`, `pattern:<id>` and `mane:<id>`. The free ones are always had. */
  owned: string[];
  kind: KindId;
  coat: string;
  pattern: PatternId;
  mane: string;
};

export const KUDA_STORAGE_KEY = 'belajar-yuk:kuda';

export const kindKey = (id: string) => `kind:${id}`;
export const coatKey = (id: string) => `coat:${id}`;
export const patternKey = (id: string) => `pattern:${id}`;
export const maneKey = (id: string) => `mane:${id}`;

export const FRESH_CLOSET: Closet = { owned: [], kind: DEFAULT_KIND.id, coat: DEFAULT_COAT.id, pattern: DEFAULT_PATTERN.id, mane: DEFAULT_MANE.id };

export function hasPattern(closet: Closet, pattern: Pattern): boolean {
  return pattern.price === 0 || closet.owned.includes(patternKey(pattern.id));
}

export function hasKind(closet: Closet, kind: Kind): boolean {
  return kind.price === 0 || closet.owned.includes(kindKey(kind.id));
}

export function hasCoat(closet: Closet, coat: Coat): boolean {
  return coat.price === 0 || closet.owned.includes(coatKey(coat.id));
}

export function hasMane(closet: Closet, mane: Mane): boolean {
  return mane.price === 0 || closet.owned.includes(maneKey(mane.id));
}

export function loadCloset(): Closet {
  try {
    const raw = window.localStorage.getItem(KUDA_STORAGE_KEY);
    if (!raw) return FRESH_CLOSET;
    const parsed = JSON.parse(raw) as Partial<Closet>;
    const owned = Array.isArray(parsed.owned) ? parsed.owned.filter((o): o is string => typeof o === 'string') : [];
    const closet: Closet = { ...FRESH_CLOSET, owned };
    // Only something actually had can be out - an edited or stale entry falls back to the free one.
    const kind = kindById(String(parsed.kind));
    const coat = coatById(String(parsed.coat));
    const pattern = patternById(String(parsed.pattern));
    const mane = maneById(String(parsed.mane));
    if (hasKind(closet, kind)) closet.kind = kind.id;
    if (hasPattern(closet, pattern)) closet.pattern = pattern.id;
    if (hasCoat(closet, coat)) closet.coat = coat.id;
    if (hasMane(closet, mane)) closet.mane = mane.id;
    return closet;
  } catch {
    return FRESH_CLOSET;
  }
}

export function saveCloset(closet: Closet): void {
  try {
    window.localStorage.setItem(KUDA_STORAGE_KEY, JSON.stringify(closet));
  } catch {
    /* A lost colour is not worth breaking the game over. */
  }
}
