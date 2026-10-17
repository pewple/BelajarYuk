import { LANG_TAGS, letterNameFor } from '../audio/words';
import type { LetterLang } from '../audio/words';
import { CLIP_IDS, MAZE_CLIP_IDS, letterClipId } from './clips';
import { numberPart } from './scriptVoice';
import type { Part } from './voiceParts';
import type { TraceKind } from '../data/tracing';

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

/** A glyph's name: a letter by the chosen letter language, a digit as its number word. */
export function glyphName(kind: TraceKind, glyph: string, letterLang: LetterLang): Part {
  if (kind === 'numbers') return numberPart(Number(glyph), 'latin');
  return {
    clip: letterClipId(glyph, letterLang),
    text: letterNameFor(glyph, letterLang),
    lang: LANG_TAGS[letterLang],
  };
}
