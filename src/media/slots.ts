import { ALPHABET, COUNTING_SETS, MAX_COUNT, WORD_CARDS } from '../data/curriculum';
import { HOME_CHOICES } from '../data/navigation';
import {
  COUNT_PROMPT_ID,
  GREETING_ID,
  LETTER_NAMES_EN,
  LETTER_NAMES_ID,
  numberWordId,
} from '../hooks/useAudio';
import { CLIP_IDS, letterClipId, numberClipId, wordClipId } from './clips';
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
        title: 'Efek suara',
        slots: [
          { id: CLIP_IDS.pop, label: 'Objek diketuk (pop)' },
          { id: CLIP_IDS.tap, label: 'Tombol navigasi (tik)' },
          { id: CLIP_IDS.chime, label: 'Ronde selesai (lonceng)' },
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
