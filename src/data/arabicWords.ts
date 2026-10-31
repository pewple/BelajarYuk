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
 * marks (harakat) the way a child's primer shows them. Every one ends in the
 * "-un" of an indefinite noun (tanwin dhammah: أَرْنَبٌ is "arnabun"), which
 * is how a primer says a bare word. A word ending in the round tā' says "-atun"
 * (زَهْرَةٌ, "zahratun"). Where the list gave two
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
  { letterId: 'alif', word: 'أَرْنَبٌ', say: 'arnabun', translit: 'Arnabun', meaning: 'Kelinci', icon: Rabbit },
  { letterId: 'ba', word: 'بَابٌ', say: 'babun', translit: 'Bābun', meaning: 'Pintu', icon: DoorClosed },
  { letterId: 'ta', word: 'تُفَّاحٌ', say: 'tuffahun', translit: 'Tuffāḥun', meaning: 'Apel', icon: Apple },
  { letterId: 'tsa', word: 'ثَلْجٌ', say: 'tsaljun', translit: 'Tsaljun', meaning: 'Salju', icon: Snowflake },
  { letterId: 'jim', word: 'جُبْنٌ', say: 'jubnun', translit: 'Jubnun', meaning: 'Keju', icon: Cheese },
  { letterId: 'ha', word: 'حَلِيبٌ', say: 'halibun', translit: 'Ḥalībun', meaning: 'Susu', icon: Milk },
  { letterId: 'kho', word: 'خُبْزٌ', say: 'khubzun', translit: 'Khubzun', meaning: 'Roti', icon: Bread },
  { letterId: 'dal', word: 'دُبٌّ', say: 'dubbun', translit: 'Dubbun', meaning: 'Beruang', icon: Bear },
  { letterId: 'dzal', word: 'ذَهَبٌ', say: 'dzahabun', translit: 'Dzahabun', meaning: 'Emas', icon: GoldBar },
  { letterId: 'ro', word: 'رَأْسٌ', say: "ra'sun", translit: 'Raʾsun', meaning: 'Kepala', icon: User },
  { letterId: 'zai', word: 'زَهْرَةٌ', say: 'zahratun', translit: 'Zahratun', meaning: 'Bunga', icon: Flower },
  { letterId: 'sin', word: 'سَمَكٌ', say: 'samakun', translit: 'Samakun', meaning: 'Ikan', icon: Fish },
  { letterId: 'syin', word: 'شَمْسٌ', say: 'syamsun', translit: 'Syamsun', meaning: 'Matahari', icon: Sun },
  { letterId: 'shod', word: 'صُنْدُوقٌ', say: 'shunduqun', translit: 'Ṣundūqun', meaning: 'Kotak', icon: Package },
  { letterId: 'dhod', word: 'ضَوْءٌ', say: "dhau'un", translit: 'Ḍawʾun', meaning: 'Cahaya', icon: Lightbulb },
  { letterId: 'tho', word: 'طَائِرٌ', say: "tha'irun", translit: 'Ṭāʾirun', meaning: 'Burung', icon: Bird },
  { letterId: 'zho', word: 'ظَرْفٌ', say: 'zharfun', translit: 'Ẓarfun', meaning: 'Amplop', icon: Mail },
  { letterId: 'ain', word: 'عَيْنٌ', say: 'ainun', translit: 'ʿAynun', meaning: 'Mata', icon: Eye },
  { letterId: 'ghoin', word: 'غَابَةٌ', say: 'ghabatun', translit: 'Ghābatun', meaning: 'Hutan', icon: Trees },
  { letterId: 'fa', word: 'فَمٌ', say: 'famun', translit: 'Famun', meaning: 'Mulut', icon: Mouth },
  { letterId: 'qof', word: 'قَمَرٌ', say: 'qamarun', translit: 'Qamarun', meaning: 'Bulan', icon: Moon },
  { letterId: 'kaf', word: 'كِتَابٌ', say: 'kitabun', translit: 'Kitābun', meaning: 'Buku', icon: BookOpen },
  { letterId: 'lam', word: 'لَيْمُونٌ', say: 'laymunun', translit: 'Laymūnun', meaning: 'Lemon', icon: Citrus },
  { letterId: 'mim', word: 'مَاءٌ', say: "ma'un", translit: 'Māʾun', meaning: 'Air', icon: Droplet },
  { letterId: 'nun', word: 'نَجْمٌ', say: 'najmun', translit: 'Najmun', meaning: 'Bintang', icon: Star },
  { letterId: 'ha-2', word: 'هَدِيَّةٌ', say: 'hadiyyatun', translit: 'Hadiyyatun', meaning: 'Hadiah', icon: Gift },
  { letterId: 'wau', word: 'وَرْدٌ', say: 'wardun', translit: 'Wardun', meaning: 'Mawar', icon: Flower2 },
  { letterId: 'ya', word: 'يَدٌ', say: 'yadun', translit: 'Yadun', meaning: 'Tangan', icon: Hand },
];

/** The picture id for a card, e.g. "words/ar/alif". */
export function arabicWordPictureId(letterId: string): string {
  return `words/ar/${letterId}`;
}
