import {
  Apple, Banana, Banknote, Book, Cake, Candy, Coins, Cookie, Croissant, IceCreamCone, Milk, ToyBrick,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Everything the cash register ("Kasir") module knows about money.
 *
 * All amounts are whole Rupiah in multiples of 500. That is a deliberate
 * simplification: it keeps every total a clean "X ribu" or "X ribu lima
 * ratus", and means the smallest piece (Rp 500) can always make any amount
 * exactly - so a child can overshoot, but can never be unable to finish.
 */

/** Every piece of money that appears in the game, smallest first. */
export const DENOMINATIONS = [500, 1000, 2000, 5000, 10000, 20000] as const;

/**
 * The four pieces in the change tray. All four are always there, in this
 * order, and none is ever hidden for being "too big": being able to give too
 * much is the whole point, because that is what makes the right amount
 * something the child has to work out rather than something they are handed.
 *
 * Larger notes exist (customers pay with them) but are never given as change
 * here, which keeps the tray to a size a small child can take in at once.
 */
export const CHANGE_PIECES = [500, 1000, 2000, 5000] as const;

/** The largest amount that is ever shown or spoken. */
export const MAX_AMOUNT = 20000;

export type Checkout = {
  /** What the customer is buying. */
  item: string;
  icon: LucideIcon;
  price: number;
  /** What the customer hands over. Always more than the price. */
  paid: number;
};

/**
 * The customers, easiest first. The change grows from Rp 500 to Rp 8.000 and
 * mixes in halves (Rp 1.500, Rp 2.500...), so every piece in the tray gets
 * used: the early rounds need one piece, the later ones several.
 */
export const CHECKOUTS: Checkout[] = [
  { item: 'Permen', icon: Candy, price: 1500, paid: 2000 },
  { item: 'Kue', icon: Cookie, price: 4000, paid: 5000 },
  { item: 'Apel', icon: Apple, price: 3000, paid: 5000 },
  { item: 'Es Krim', icon: IceCreamCone, price: 3500, paid: 5000 },
  { item: 'Susu', icon: Milk, price: 7000, paid: 10000 },
  { item: 'Pisang', icon: Banana, price: 7500, paid: 10000 },
  { item: 'Buku', icon: Book, price: 6500, paid: 10000 },
  { item: 'Roti', icon: Croissant, price: 12000, paid: 20000 },
  { item: 'Mainan', icon: ToyBrick, price: 15500, paid: 20000 },
  { item: 'Kue Tart', icon: Cake, price: 14000, paid: 20000 },
];

/**
 * How each piece looks. Gradients follow the colours of the real Indonesian
 * notes where there is one to follow, and every stop is shade 600 or darker so
 * white text keeps a strong contrast.
 */
export const PIECE_LOOK: Record<number, { icon: LucideIcon; theme: string; label: string }> = {
  500: { icon: Coins, theme: 'from-cyan-600 to-sky-700', label: 'koin' },
  1000: { icon: Coins, theme: 'from-slate-500 to-slate-700', label: 'koin' },
  2000: { icon: Banknote, theme: 'from-zinc-500 to-zinc-700', label: 'uang kertas' },
  5000: { icon: Banknote, theme: 'from-amber-700 to-yellow-800', label: 'uang kertas' },
  10000: { icon: Banknote, theme: 'from-purple-600 to-violet-700', label: 'uang kertas' },
  20000: { icon: Banknote, theme: 'from-green-600 to-emerald-700', label: 'uang kertas' },
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** 12000 -> "12.000". Indonesian grouping, written out so it never depends on ICU data. */
export function formatNumber(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 12000 -> "Rp 12.000" */
export function formatRupiah(amount: number): string {
  return `Rp ${formatNumber(amount)}`;
}

const ONES = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];

/** 1-999 in Bahasa Indonesia, as separate words. */
function belowThousand(n: number): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (hundreds === 1) words.push('seratus');
  else if (hundreds > 1) words.push(ONES[hundreds], 'ratus');

  if (rest === 0) return words;
  if (rest < 10) words.push(ONES[rest]);
  else if (rest === 10) words.push('sepuluh');
  else if (rest === 11) words.push('sebelas');
  else if (rest < 20) words.push(ONES[rest - 10], 'belas');
  else {
    words.push(ONES[Math.floor(rest / 10)], 'puluh');
    if (rest % 10 !== 0) words.push(ONES[rest % 10]);
  }
  return words;
}

/**
 * A whole number as spoken Indonesian: 1000 -> "seribu", 1500 -> "seribu lima
 * ratus", 11000 -> "sebelas ribu", 20000 -> "dua puluh ribu", 101000 ->
 * "seratus satu ribu".
 *
 * Indonesian says "seribu" and "seratus", never "satu ribu" or "satu ratus",
 * so this is not a simple digit-by-digit lookup. Covers 0 to 999.999.
 */
export function rupiahWords(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0 || amount >= 1_000_000) return String(amount);
  if (amount === 0) return 'nol';

  const thousands = Math.floor(amount / 1000);
  const rest = amount % 1000;
  const words: string[] = [];

  if (thousands === 1) words.push('seribu');
  else if (thousands > 1) words.push(...belowThousand(thousands), 'ribu');
  if (rest > 0) words.push(...belowThousand(rest));

  return words.join(' ');
}

/* ------------------------------------------------------------------ */
/* Giving change                                                       */
/* ------------------------------------------------------------------ */

/**
 * One piece handed back, and the total of change given before and after it.
 *
 * The total is of the *change only*, starting from nothing - never the price
 * plus the change. That is the number the child is building towards, so it is
 * the one shown and the one spoken.
 */
export type ChangeStep = {
  /** The piece handed over at this step. */
  add: number;
  /** The change given before this piece. */
  from: number;
  /** The change given after it. */
  total: number;
};

export function changeSteps(pieces: number[]): ChangeStep[] {
  let given = 0;
  return pieces.map((add) => {
    const from = given;
    given += add;
    return { add, from, total: given };
  });
}

/** What the customer is owed: what they paid, less what it cost. */
export function changeOwed(checkout: Checkout): number {
  return checkout.paid - checkout.price;
}

/**
 * How the change given so far compares with what is owed.
 *
 *  - short: not enough yet. Keep going.
 *  - exact: right. The register opens.
 *  - over:  too much. "Salah, hitung kembali" - count again from nothing.
 */
export type ChangeVerdict = 'short' | 'exact' | 'over';

export function judgeChange(given: number, owed: number): ChangeVerdict {
  if (given === owed) return 'exact';
  return given > owed ? 'over' : 'short';
}

/**
 * Every amount that can be spoken: Rp 500 to MAX_AMOUNT in steps of 500.
 *
 * That covers each price, each payment, each running total of change given -
 * including the over-the-line total that triggers "Salah" - and each amount
 * owed. A test checks that nothing the game can produce falls outside it.
 */
export const SPOKEN_AMOUNTS: number[] = Array.from({ length: MAX_AMOUNT / 500 }, (_, i) => (i + 1) * 500);
