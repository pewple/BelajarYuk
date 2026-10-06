import { ALPHABET } from '../data/curriculum';
import type { MazeKind, MazeLevel } from '../data/maze';
import { LANG_TAGS, letterNameFor, numberWordId } from '../hooks/useAudio';
import type { LetterLang } from '../hooks/useAudio';
import { MAZE_CLIP_IDS, letterClipId, numberClipId } from './clips';
import type { Part } from './voiceParts';

/**
 * What the maze says, built from parts so each can be a recording of its own.
 * Letters and numbers reuse the clips Mengenal Huruf and Berhitung already
 * use, so recording those once covers the maze too.
 */

/** One label as speech: a letter's name or a number's word. */
export function labelPart(kind: MazeKind, value: number, lang: LetterLang): Part {
  if (kind === 'numbers') return { clip: numberClipId(value), text: numberWordId(value) };

  const letter = ALPHABET[value - 1];
  return {
    clip: letterClipId(letter, lang),
    text: letterNameFor(letter, lang),
    // Indonesian is the default voice; only an English name needs to say so.
    lang: lang === 'en' ? LANG_TAGS.en : undefined,
  };
}

/** The same part with punctuation after it, for the speech engine's intonation. */
const punctuated = (part: Part, mark: string): Part => ({ ...part, text: `${part.text}${mark}` });

/** "Ikuti angka dari satu sampai delapan!" - spoken as each maze begins. */
export function instructionLine(level: MazeLevel, kind: MazeKind, lang: LetterLang): Part[] {
  const letters = kind === 'letters';
  const last = level.from + level.length - 1;

  return [
    {
      clip: letters ? MAZE_CLIP_IDS.followLetters : MAZE_CLIP_IDS.followNumbers,
      text: letters ? 'Ikuti huruf dari' : 'Ikuti angka dari',
    },
    labelPart(kind, level.from, lang),
    { clip: MAZE_CLIP_IDS.until, text: 'sampai' },
    punctuated(labelPart(kind, last, lang), '!'),
  ];
}

/** "Pilih huruf, angka, atau acak!" - said on the screen before a maze begins. */
export const chooseLine = (): Part[] => [
  { clip: MAZE_CLIP_IDS.choose, text: 'Pilih' },
  { clip: MAZE_CLIP_IDS.letters, text: 'huruf,' },
  { clip: MAZE_CLIP_IDS.numbers, text: 'angka,' },
  { clip: MAZE_CLIP_IDS.or, text: 'atau' },
  { clip: MAZE_CLIP_IDS.random, text: 'acak!' },
];

/** "Cari huruf be!" - after a tap on a dead end, naming what to look for instead. */
export function hintLine(kind: MazeKind, nextValue: number, lang: LetterLang): Part[] {
  const letters = kind === 'letters';
  return [
    {
      clip: letters ? MAZE_CLIP_IDS.findLetter : MAZE_CLIP_IDS.findNumber,
      text: letters ? 'Cari huruf' : 'Cari angka',
    },
    punctuated(labelPart(kind, nextValue, lang), '!'),
  ];
}

/** The label of the tile just stepped on: "tiga", or "be". */
export const stepLine = (kind: MazeKind, value: number, lang: LetterLang): Part[] => [
  labelPart(kind, value, lang),
];

/** "Hore, sampai!" - the maze is finished. */
export const finishLine = (): Part[] => [{ clip: MAZE_CLIP_IDS.hooray, text: 'Hore, sampai!' }];

/**
 * The last tile: its label, then the cheer. The label gets an exclamation mark
 * so the engine lifts it instead of running it into "Hore" without a breath.
 */
export const arriveLine = (kind: MazeKind, value: number, lang: LetterLang): Part[] => [
  punctuated(labelPart(kind, value, lang), '!'),
  ...finishLine(),
];
