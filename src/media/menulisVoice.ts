import { LANG_TAGS, letterNameFor } from '../audio/words';
import type { LetterLang } from '../audio/words';
import { HIJAIYAH } from '../data/scripts';
import { CLIP_IDS, MAZE_CLIP_IDS, arabicNumberClipId, letterClipId } from './clips';
import { ARABIC_LANG, arabicLetterPart, numberPart } from './scriptVoice';
import type { Part } from './voiceParts';
import type { TraceKind } from '../data/tracing';
import { TRACE_ARABIC_DIGITS } from '../data/tracing';

/** "Ikuti garisnya!" - the instruction that opens every glyph. */
export const followLine = (): Part[] => [{ clip: CLIP_IDS.followLine, text: 'Ikuti garisnya!' }];

/**
 * "Pilih huruf atau angka!" - made of the maze chooser's own words, so the
 * recordings made for the maze are heard here too.
 */
export const chooseKindLine = (): Part[] => [
  { clip: MAZE_CLIP_IDS.choose, text: 'Pilih' },
  { clip: MAZE_CLIP_IDS.letters, text: 'huruf' },
  { clip: MAZE_CLIP_IDS.or, text: 'atau' },
  { clip: MAZE_CLIP_IDS.numbers, text: 'angka!' },
];

/**
 * A glyph's name: a letter by the chosen letter language (a small letter is
 * called what its capital is), a digit as its number word, a hijaiyah letter
 * by its name in Arabic.
 */
export function glyphName(kind: TraceKind, glyph: string, letterLang: LetterLang): Part {
  switch (kind) {
    case 'numbers':
      return numberPart(Number(glyph), 'latin');

    case 'arabicNumbers': {
      const n = TRACE_ARABIC_DIGITS.indexOf(glyph);
      // The counting words start at one; zero is the one number the app has no word for yet.
      if (n === 0) return { clip: arabicNumberClipId(0), text: 'sifr', native: { text: 'صفر', lang: ARABIC_LANG } };
      return numberPart(n, 'arab');
    }

    case 'hijaiyah':
      return arabicLetterPart(HIJAIYAH.find((letter) => letter.glyph === glyph) ?? HIJAIYAH[0]);

    default: {
      const letter = glyph.toUpperCase();
      return {
        clip: letterClipId(letter, letterLang),
        text: letterNameFor(letter, letterLang),
        lang: LANG_TAGS[letterLang],
      };
    }
  }
}
