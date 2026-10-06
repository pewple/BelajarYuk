import { ALPHABET, COUNTING_SETS, MAX_COUNT, WORD_CARDS } from '../data/curriculum';
import { MAZE_LEVELS } from '../data/maze';
import { CHECKOUTS, DENOMINATIONS, SPOKEN_AMOUNTS, formatRupiah, rupiahWords } from '../data/money';
import { HOME_CHOICES } from '../data/navigation';
import {
  COUNT_PROMPT_ID,
  GREETING_ID,
  LETTER_NAMES_EN,
  LETTER_NAMES_ID,
  numberWordId,
} from '../hooks/useAudio';
import {
  CLIP_IDS,
  MAZE_CLIP_IDS,
  MONEY_CLIP_IDS,
  letterClipId,
  moneyClipId,
  numberClipId,
  wordClipId,
} from './clips';
import { slugify } from './slug';

/**
 * Every sound and picture the app can swap for a customer's own file.
 *
 * This is the one place that lists them all. The media check page reads it to
 * show what is covered and what is still using a generated fallback, and
 * `id` is exactly the path (minus extension) the file must be given.
 */

export type Slot = {
  /** Path under media/audio or media/images, without extension. */
  id: string;
  /** Short name for people, e.g. "Huruf B". */
  label: string;
  /** What the app says by default - what to say when recording it. */
  say?: string;
};

export type SlotGroup = {
  title: string;
  slots: Slot[];
};

export type SlotCatalogue = {
  audio: SlotGroup[];
  images: SlotGroup[];
  /**
   * Folders that take any number of files with any names, e.g. praise takes.
   * They are never "missing" and their files are never "unrecognised".
   */
  openAudioFolders: { prefix: string; title: string; note: string }[];
};

export function buildSlots(): SlotCatalogue {
  const numbers = Array.from({ length: MAX_COUNT }, (_, i) => i + 1);

  return {
    audio: [
      {
        title: 'Nama huruf - Bahasa Indonesia',
        slots: ALPHABET.map((letter) => ({
          id: letterClipId(letter, 'id'),
          label: `Huruf ${letter}`,
          say: LETTER_NAMES_ID[letter],
        })),
      },
      {
        title: 'Nama huruf - English',
        slots: ALPHABET.map((letter) => ({
          id: letterClipId(letter, 'en'),
          label: `Letter ${letter}`,
          say: LETTER_NAMES_EN[letter],
        })),
      },
      {
        title: 'Kata di Belajar Bicara',
        slots: WORD_CARDS.map((card) => ({
          id: wordClipId(card.word),
          label: card.word,
          say: card.word,
        })),
      },
      {
        title: 'Angka di Berhitung',
        slots: numbers.map((n) => ({
          id: numberClipId(n),
          label: `Angka ${n}`,
          say: numberWordId(n),
        })),
      },
      {
        title: 'Kalimat',
        slots: [
          { id: CLIP_IDS.greeting, label: 'Sapaan layar utama', say: GREETING_ID },
          { id: CLIP_IDS.countPrompt, label: 'Perintah mulai menghitung', say: COUNT_PROMPT_ID },
        ],
      },
      {
        // The maze's letters and numbers are spoken with the clips above
        // (Nama huruf, Angka di Berhitung), so only its fixed words are here.
        title: 'Labirin - kata tetap',
        slots: [
          { id: MAZE_CLIP_IDS.followLetters, label: 'Perintah: ikuti huruf', say: 'Ikuti huruf dari' },
          { id: MAZE_CLIP_IDS.followNumbers, label: 'Perintah: ikuti angka', say: 'Ikuti angka dari' },
          { id: MAZE_CLIP_IDS.until, label: 'Sampai', say: 'sampai' },
          { id: MAZE_CLIP_IDS.findLetter, label: 'Petunjuk: cari huruf', say: 'Cari huruf' },
          { id: MAZE_CLIP_IDS.findNumber, label: 'Petunjuk: cari angka', say: 'Cari angka' },
          { id: MAZE_CLIP_IDS.hooray, label: 'Sampai di tujuan', say: 'Hore, sampai!' },
          // "Pilih huruf, angka, atau acak!" - said on the screen before a maze begins.
          { id: MAZE_CLIP_IDS.choose, label: 'Pilihan: pilih', say: 'Pilih' },
          { id: MAZE_CLIP_IDS.letters, label: 'Pilihan: huruf', say: 'huruf' },
          { id: MAZE_CLIP_IDS.numbers, label: 'Pilihan: angka', say: 'angka' },
          { id: MAZE_CLIP_IDS.or, label: 'Pilihan: atau', say: 'atau' },
          { id: MAZE_CLIP_IDS.random, label: 'Pilihan: acak', say: 'acak' },
        ],
      },
      {
        title: 'Kasir - kata tetap',
        slots: [
          { id: MONEY_CLIP_IDS.price, label: 'Harganya', say: 'Harganya' },
          { id: MONEY_CLIP_IDS.paid, label: 'Dibayar', say: 'Dibayar' },
          { id: MONEY_CLIP_IDS.change, label: 'Kembaliannya', say: 'Kembaliannya' },
          { id: MONEY_CLIP_IDS.rupiah, label: 'Rupiah', say: 'rupiah' },
          { id: MONEY_CLIP_IDS.wrong, label: 'Kembalian kelebihan', say: 'Salah, hitung kembali' },
          { id: CLIP_IDS.changePrompt, label: 'Perintah menghitung kembalian', say: 'Ayo hitung kembaliannya!' },
        ],
      },
      {
        // Every harga, uang yang dibayar, total hitungan and kembalian the
        // register can ever say is one of these twenty.
        title: 'Kasir - jumlah uang',
        slots: SPOKEN_AMOUNTS.map((amount) => ({
          id: moneyClipId(amount),
          label: formatRupiah(amount),
          say: rupiahWords(amount),
        })),
      },
      {
        title: 'Efek suara',
        slots: [
          { id: CLIP_IDS.pop, label: 'Objek diketuk (pop)' },
          { id: CLIP_IDS.tap, label: 'Tombol navigasi (tik)' },
          { id: CLIP_IDS.chime, label: 'Ronde selesai (lonceng)' },
          { id: CLIP_IDS.coin, label: 'Uang diberikan (koin)' },
          { id: CLIP_IDS.register, label: 'Kembalian benar (ka-ching)' },
          { id: CLIP_IDS.nudge, label: 'Bukan yang itu (hmm lembut)' },
        ],
      },
    ],

    images: [
      {
        title: 'Kartu kata di Belajar Bicara',
        slots: WORD_CARDS.map((card) => ({ id: `words/${slugify(card.word)}`, label: card.word })),
      },
      {
        title: 'Objek di Berhitung',
        slots: COUNTING_SETS.map((set) => ({
          id: `counting/${slugify(set.label)}`,
          label: set.label,
        })),
      },
      {
        title: 'Labirin - hewan dan hadiah',
        slots: [
          ...new Map(
            MAZE_LEVELS.flatMap((level) => [level.hero, level.treat]).map((who) => [who.name, who] as const),
          ).values(),
        ].map((who) => ({ id: `maze/${slugify(who.name)}`, label: who.name })),
      },
      {
        title: 'Barang di Kasir',
        slots: CHECKOUTS.map((checkout) => ({
          id: `shop/${slugify(checkout.item)}`,
          label: checkout.item,
        })),
      },
      {
        title: 'Uang di Kasir',
        slots: DENOMINATIONS.map((amount) => ({ id: `money/${amount}`, label: formatRupiah(amount) })),
      },
      {
        title: 'Kartu di layar utama',
        slots: HOME_CHOICES.map((choice) => ({
          id: `home/${slugify(choice.id)}`,
          label: choice.title,
        })),
      },
    ],

    openAudioFolders: [
      {
        prefix: 'praise/',
        title: 'Pujian',
        note: 'Berapa pun jumlahnya, nama bebas. Satu dipilih acak setiap kali.',
      },
    ],
  };
}

export function slotIds(groups: SlotGroup[]): Set<string> {
  return new Set(groups.flatMap((group) => group.slots.map((slot) => slot.id)));
}
