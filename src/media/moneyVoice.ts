import { rupiahWords } from '../data/money';
import { CLIP_IDS, MONEY_CLIP_IDS, moneyClipId } from './clips';
import type { Part } from './voiceParts';

// Kept exported from here so the cash register's callers need not know that
// the sentence-building moved to a module the maze shares.
export { stepsFor } from './voiceParts';
export type { Part } from './voiceParts';

/**
 * What the cashier says, built from small parts.
 *
 * "Harganya tiga ribu rupiah" is three parts: a fixed word, an amount and a
 * fixed word. There are too many sentences to record whole (every price, every
 * running total, every change), but the parts are few: four words and twenty
 * amounts - see `voiceParts` for how a part becomes a recording or speech.
 */

const amount = (n: number): Part => ({ clip: moneyClipId(n), text: rupiahWords(n) });

/** "Harganya tiga ribu rupiah." */
export const priceLine = (price: number): Part[] => [
  { clip: MONEY_CLIP_IDS.price, text: 'Harganya' },
  amount(price),
  { clip: MONEY_CLIP_IDS.rupiah, text: 'rupiah.' },
];

/** "Dibayar lima ribu rupiah." */
export const paidLine = (paid: number): Part[] => [
  { clip: MONEY_CLIP_IDS.paid, text: 'Dibayar' },
  amount(paid),
  { clip: MONEY_CLIP_IDS.rupiah, text: 'rupiah.' },
];

/** "Ayo hitung kembaliannya!" - the instruction that opens every customer. */
export const promptLine = (): Part[] => [
  { clip: CLIP_IDS.changePrompt, text: 'Ayo hitung kembaliannya!' },
];

/**
 * The change handed over so far, spoken as each piece is added: "seribu lima
 * ratus". Only the change - never the price plus the change - because that is
 * the number the child is building towards.
 */
export const totalLine = (total: number): Part[] => [amount(total)];

/** "Salah, hitung kembali" - too much change was given; start the count again. */
export const wrongLine = (): Part[] => [{ clip: MONEY_CLIP_IDS.wrong, text: 'Salah, hitung kembali' }];

/** "Kembaliannya dua ribu rupiah!" */
export const changeLine = (change: number): Part[] => [
  { clip: MONEY_CLIP_IDS.change, text: 'Kembaliannya' },
  amount(change),
  { clip: MONEY_CLIP_IDS.rupiah, text: 'rupiah!' },
];
