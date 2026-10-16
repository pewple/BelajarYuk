import {
  Apple, Bird, BookOpen, Citrus, DoorClosed, Droplet, Eye, Flower, Flower2, Gift, Hand, Lightbulb, Mail,
  Milk, Moon, Mouth, Package, Rabbit, Snowflake, Star, Sun, Trees, User, Fish,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bear, Bread, Cheese, GoldBar } from '../components/drawnIcons';

/**
 * The Arabic deck for Belajar Bicara: one word per hijaiyah letter, in the same
 * order as `HIJAIYAH`, so card n goes with letter n.
 *
 * Words are the starter list supplied for the app, written with their vowel
 * marks (harakat) the way a child's primer shows them. Where the list gave two
 * words for a letter, the one with a recognisable picture was chosen:
 *
 *   alif  أَرْنَب (rabbit), not أَسَد (lion)        - lucide has a rabbit, no lion
 *   lam   لَيْمُون (lemon), not لَعِب (play)        - a lemon can be drawn; "play" cannot
 *
 * Four words have no icon in lucide and use a drawing of their own (see
 * components/drawnIcons.ts): jubn, dubb, khubz and dzahab. They are stand-ins -
 * add a picture at media/images/words/ar/<id> to replace any of them.
 */
export type ArabicWordCard = {
  /** The id of the letter in `HIJAIYAH`. Recordings and pictures are named by it. */
  letterId: string;
  /** The word, with vowel marks. */
  word: string;
  /**
   * How it is said by an Indonesian voice when the device has no Arabic one.
   * Written the way Indonesian reads it, like the letter names are.
   */
  say: string;
  /** How it is shown to the grown-up in Latin letters. */
  translit: string;
  /** What it means, in Indonesian. */
  meaning: string;
  icon: LucideIcon;
};

export const ARABIC_WORD_CARDS: ArabicWordCard[] = [
  { letterId: 'alif', word: 'أَرْنَب', say: 'arnab', translit: 'Arnab', meaning: 'Kelinci', icon: Rabbit },
  { letterId: 'ba', word: 'بَاب', say: 'bab', translit: 'Bāb', meaning: 'Pintu', icon: DoorClosed },
  { letterId: 'ta', word: 'تُفَّاح', say: 'tuffah', translit: 'Tuffāḥ', meaning: 'Apel', icon: Apple },
  { letterId: 'tsa', word: 'ثَلْج', say: 'tsalj', translit: 'Tsalj', meaning: 'Salju', icon: Snowflake },
  { letterId: 'jim', word: 'جُبْن', say: 'jubn', translit: 'Jubn', meaning: 'Keju', icon: Cheese },
  { letterId: 'ha', word: 'حَلِيب', say: 'halib', translit: 'Ḥalīb', meaning: 'Susu', icon: Milk },
  { letterId: 'kho', word: 'خُبْز', say: 'khubz', translit: 'Khubz', meaning: 'Roti', icon: Bread },
  { letterId: 'dal', word: 'دُبّ', say: 'dubb', translit: 'Dubb', meaning: 'Beruang', icon: Bear },
  { letterId: 'dzal', word: 'ذَهَب', say: 'dzahab', translit: 'Dzahab', meaning: 'Emas', icon: GoldBar },
  { letterId: 'ro', word: 'رَأْس', say: "ra's", translit: 'Raʾs', meaning: 'Kepala', icon: User },
  { letterId: 'zai', word: 'زَهْرَة', say: 'zahrah', translit: 'Zahrah', meaning: 'Bunga', icon: Flower },
  { letterId: 'sin', word: 'سَمَك', say: 'samak', translit: 'Samak', meaning: 'Ikan', icon: Fish },
  { letterId: 'syin', word: 'شَمْس', say: 'syams', translit: 'Syams', meaning: 'Matahari', icon: Sun },
  { letterId: 'shod', word: 'صُنْدُوق', say: 'shunduq', translit: 'Ṣundūq', meaning: 'Kotak', icon: Package },
  { letterId: 'dhod', word: 'ضَوْء', say: "dhau'", translit: 'Ḍawʾ', meaning: 'Cahaya', icon: Lightbulb },
  { letterId: 'tho', word: 'طَائِر', say: "tha'ir", translit: 'Ṭāʾir', meaning: 'Burung', icon: Bird },
  { letterId: 'zho', word: 'ظَرْف', say: 'zharf', translit: 'Ẓarf', meaning: 'Amplop', icon: Mail },
  { letterId: 'ain', word: 'عَيْن', say: 'ain', translit: 'ʿAyn', meaning: 'Mata', icon: Eye },
  { letterId: 'ghoin', word: 'غَابَة', say: 'ghabah', translit: 'Ghābah', meaning: 'Hutan', icon: Trees },
  { letterId: 'fa', word: 'فَم', say: 'fam', translit: 'Fam', meaning: 'Mulut', icon: Mouth },
  { letterId: 'qof', word: 'قَمَر', say: 'qamar', translit: 'Qamar', meaning: 'Bulan', icon: Moon },
  { letterId: 'kaf', word: 'كِتَاب', say: 'kitab', translit: 'Kitāb', meaning: 'Buku', icon: BookOpen },
  { letterId: 'lam', word: 'لَيْمُون', say: 'laymun', translit: 'Laymūn', meaning: 'Lemon', icon: Citrus },
  { letterId: 'mim', word: 'مَاء', say: "ma'", translit: 'Māʾ', meaning: 'Air', icon: Droplet },
  { letterId: 'nun', word: 'نَجْم', say: 'najm', translit: 'Najm', meaning: 'Bintang', icon: Star },
  { letterId: 'ha-2', word: 'هَدِيَّة', say: 'hadiyyah', translit: 'Hadiyyah', meaning: 'Hadiah', icon: Gift },
  { letterId: 'wau', word: 'وَرْد', say: 'ward', translit: 'Ward', meaning: 'Mawar', icon: Flower2 },
  { letterId: 'ya', word: 'يَد', say: 'yad', translit: 'Yad', meaning: 'Tangan', icon: Hand },
];

/** The picture id for a card, e.g. "words/ar/alif". */
export function arabicWordPictureId(letterId: string): string {
  return `words/ar/${letterId}`;
}
