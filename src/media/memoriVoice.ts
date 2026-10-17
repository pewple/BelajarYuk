import { ARABIC_WORD_CARDS } from '../data/arabicWords';
import type { Face } from '../data/memori';
import { HIJAIYAH } from '../data/scripts';
import { LANG_TAGS, letterNameFor } from '../audio/words';
import type { LetterLang } from '../audio/words';
import { CLIP_IDS, letterClipId, wordClipId } from './clips';
import { arabicLetterPart, arabicWordPart } from './scriptVoice';
import type { Part } from './voiceParts';

/** "Cari yang sama!" - the instruction that opens every round. */
export const findSameLine = (): Part[] => [{ clip: CLIP_IDS.findSame, text: 'Cari yang sama!' }];

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
