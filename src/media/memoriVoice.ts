import { ARABIC_WORD_CARDS } from '../data/arabicWords';
import type { Face } from '../data/memori';
import { HIJAIYAH } from '../data/scripts';
import { LANG_TAGS, letterNameFor } from '../audio/words';
import type { LetterLang } from '../audio/words';
import { CLIP_IDS, MAZE_CLIP_IDS, MEMORI_CLIP_IDS, letterClipId, wordClipId } from './clips';
import { arabicLetterPart, arabicWordPart } from './scriptVoice';
import type { Part } from './voiceParts';

/** "Cari yang sama!" - the instruction that opens every round. */
export const findSameLine = (): Part[] => [{ clip: CLIP_IDS.findSame, text: 'Cari yang sama!' }];

/**
 * "Pilih gambar, huruf, atau acak!" - made of the maze chooser's own words, so
 * the recordings made for the maze are heard here too.
 */
export const chooseModeLine = (): Part[] => [
  { clip: MAZE_CLIP_IDS.choose, text: 'Pilih' },
  { clip: MEMORI_CLIP_IDS.picture, text: 'gambar,' },
  { clip: MAZE_CLIP_IDS.letters, text: 'huruf,' },
  { clip: MAZE_CLIP_IDS.or, text: 'atau' },
  { clip: MAZE_CLIP_IDS.random, text: 'acak!' },
];

/** "Lihat dulu!" - said as the cards are shown, before they are turned down. */
export const lookFirstLine = (): Part[] => [{ clip: CLIP_IDS.lookFirst, text: 'Lihat dulu!' }];

/** "Mulai!" - the cards are down, go. Said just before the instruction. */
export const startLine = (): Part[] => [{ clip: CLIP_IDS.start, text: 'Mulai!' }];

/**
 * What a face says when its card is turned over: a picture says its word, a
 * letter says its name. Each is the same part the rest of the app uses, so a
 * recording made for Belajar Bicara is also heard here.
 */
export function facePart(face: Face, letterLang: LetterLang): Part {
  switch (face.kind) {
    case 'word':
      return { clip: wordClipId(face.word), text: face.word };
    case 'letter':
      return {
        clip: letterClipId(face.letter, letterLang),
        text: letterNameFor(face.letter, letterLang),
        lang: LANG_TAGS[letterLang],
      };
    case 'hijaiyah':
      return arabicLetterPart(HIJAIYAH.find((h) => h.id === face.letterId) ?? HIJAIYAH[0]);
    case 'arabicWord':
      return arabicWordPart(ARABIC_WORD_CARDS.find((c) => c.letterId === face.letterId) ?? ARABIC_WORD_CARDS[0]);
  }
}

/** How a face is named to assistive tech. */
export function faceLabel(face: Face): string {
  switch (face.kind) {
    case 'word':
      return face.word;
    case 'letter':
      return `huruf ${face.letter}`;
    case 'hijaiyah': {
      const h = HIJAIYAH.find((x) => x.id === face.letterId);
      return h ? `huruf ${h.glyph} (${h.title})` : 'huruf';
    }
    case 'arabicWord': {
      const c = ARABIC_WORD_CARDS.find((x) => x.letterId === face.letterId);
      return c ? `${c.word} (${c.meaning})` : 'kata';
    }
  }
}
