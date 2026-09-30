import {
  Apple, Banana, Book, BookOpen, Bug, Cake, Camera, Car, Carrot, Cat, CircleDot,
  Clock, CupSoda, Egg, Fish, Flower2, Heart, House, IceCreamCone, Leaf, Lightbulb,
  Milk, Mountain, PawPrint, Pill, Scan, Star, Waves, Worm,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Colour themes for the big interactive cards.
 *
 * Every gradient stays at shade 600+ so white glyphs keep a strong contrast
 * ratio against it - important when the "text" is the whole lesson.
 */
export const CARD_THEMES = [
  'from-rose-500 to-red-600',
  'from-orange-600 to-amber-700',
  'from-green-600 to-emerald-700',
  'from-teal-600 to-cyan-700',
  'from-sky-600 to-blue-700',
  'from-violet-600 to-purple-700',
  'from-fuchsia-600 to-pink-700',
  'from-indigo-600 to-blue-800',
] as const;

export function themeFor(index: number): string {
  return CARD_THEMES[index % CARD_THEMES.length];
}

/** The full Indonesian alphabet, in order. */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export type WordCard = {
  letter: string;
  /** The word as it is written. */
  word: string;
  icon: LucideIcon;
  /** A one-line prompt the grown-up can read out, kept short on purpose. */
  hint: string;
};

/**
 * Letters with no native Indonesian word a toddler would know. Their cards
 * lean on conventional loanwords and the icons are approximations - worth
 * knowing if you want to swap them for your own artwork.
 */
export const LOANWORD_LETTERS = ['Q', 'X', 'Y', 'Z'] as const;

/**
 * Word cards for "Belajar Bicara" - one per letter, A to Z.
 *
 * Every word is a concrete noun a toddler can picture, and every icon is
 * chosen to be readable without the label. Indonesian has no native words
 * for Q, X, Y and Z, so those four fall back to the loanwords that
 * Indonesian alphabet books conventionally use; they are the weakest cards
 * in the set and the easiest ones to swap.
 */
export const WORD_CARDS: WordCard[] = [
  { letter: 'A', word: 'Apel', icon: Apple, hint: 'Buah merah yang manis' },
  { letter: 'B', word: 'Buku', icon: Book, hint: 'Untuk dibaca bersama' },
  { letter: 'C', word: 'Cangkir', icon: CupSoda, hint: 'Tempat minum' },
  { letter: 'D', word: 'Daun', icon: Leaf, hint: 'Warnanya hijau' },
  { letter: 'E', word: 'Es Krim', icon: IceCreamCone, hint: 'Dingin dan manis' },
  { letter: 'F', word: 'Foto', icon: Camera, hint: 'Gambar kita' },
  { letter: 'G', word: 'Gunung', icon: Mountain, hint: 'Tinggi sekali' },
  { letter: 'H', word: 'Hati', icon: Heart, hint: 'Tanda sayang' },
  { letter: 'I', word: 'Ikan', icon: Fish, hint: 'Berenang di air' },
  { letter: 'J', word: 'Jam', icon: Clock, hint: 'Penunjuk waktu' },
  { letter: 'K', word: 'Kucing', icon: Cat, hint: 'Bunyinya meong' },
  { letter: 'L', word: 'Lampu', icon: Lightbulb, hint: 'Membuat terang' },
  { letter: 'M', word: 'Mobil', icon: Car, hint: 'Bunyinya brum brum' },
  { letter: 'N', word: 'Nyamuk', icon: Bug, hint: 'Terbangnya nging-nging' },
  { letter: 'O', word: 'Ombak', icon: Waves, hint: 'Ada di pantai' },
  { letter: 'P', word: 'Pisang', icon: Banana, hint: 'Buah kuning' },
  { letter: 'Q', word: 'Quran', icon: BookOpen, hint: 'Kitab suci' },
  { letter: 'R', word: 'Rumah', icon: House, hint: 'Tempat kita tinggal' },
  { letter: 'S', word: 'Susu', icon: Milk, hint: 'Diminum setiap hari' },
  { letter: 'T', word: 'Telur', icon: Egg, hint: 'Dari ayam' },
  { letter: 'U', word: 'Ulat', icon: Worm, hint: 'Nanti jadi kupu-kupu' },
  { letter: 'V', word: 'Vitamin', icon: Pill, hint: 'Biar badan sehat' },
  { letter: 'W', word: 'Wortel', icon: Carrot, hint: 'Warnanya oranye' },
  { letter: 'X', word: 'X-Ray', icon: Scan, hint: 'Foto tulang di rumah sakit' },
  { letter: 'Y', word: 'Yoyo', icon: CircleDot, hint: 'Mainan naik turun' },
  { letter: 'Z', word: 'Zebra', icon: PawPrint, hint: 'Kuda belang hitam putih' },
];

/**
 * Objects counted in "Berhitung". One per round so every number gets its own
 * look - the novelty keeps attention, and the shape change makes it clear a
 * new round has started.
 */
export const COUNTING_SETS: { icon: LucideIcon; label: string; color: string }[] = [
  { icon: Apple, label: 'apel', color: 'text-red-500' },
  { icon: Star, label: 'bintang', color: 'text-amber-500' },
  { icon: Fish, label: 'ikan', color: 'text-sky-500' },
  { icon: Heart, label: 'hati', color: 'text-rose-500' },
  { icon: Flower2, label: 'bunga', color: 'text-fuchsia-500' },
  { icon: Banana, label: 'pisang', color: 'text-yellow-500' },
  { icon: Egg, label: 'telur', color: 'text-orange-400' },
  { icon: Carrot, label: 'wortel', color: 'text-orange-500' },
  { icon: Cake, label: 'kue', color: 'text-pink-500' },
  { icon: Cat, label: 'kucing', color: 'text-violet-500' },
];

export const MAX_COUNT = 10;
