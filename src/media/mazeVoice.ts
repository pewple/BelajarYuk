import { ALPHABET } from '../data/curriculum';
import type { MazeKind, MazeLevel } from '../data/maze';
import { HIJAIYAH } from '../data/scripts';
import type { Script } from '../data/scripts';
import { LANG_TAGS, letterNameFor } from '../audio/words';
import type { LetterLang } from '../audio/words';
import { MAZE_CLIP_IDS, letterClipId } from './clips';
import { arabicLetterPart, numberPart } from './scriptVoice';
import type { Part } from './voiceParts';

/**
 * What the maze says, built from parts so each can be a recording of its own.
 * Letters and numbers reuse the clips Mengenal Huruf and Berhitung already
 * use - in either script - so recording those once covers the maze too.
 */

/**
 * One label as speech: a letter's name or a number's word.
 *
 * `value` is a position (the 3rd letter, the number 3), so it works for any
 * script. In Arabic the letter and number names are Arabic; the Indonesian/
 * English choice for Latin letter names does not apply and is ignored.
 */
export function labelPart(kind: MazeKind, value: number, lang: LetterLang, script: Script = 'latin'): Part {
  if (kind === 'numbers') return numberPart(value, script);
  if (script === 'arab') return arabicLetterPart(HIJAIYAH[value - 1]);

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
export function instructionLine(
  level: MazeLevel,
  kind: MazeKind,
  lang: LetterLang,
  script: Script = 'latin',
): Part[] {
  const letters = kind === 'letters';
  const last = level.from + level.length - 1;

  return [
    {
      clip: letters ? MAZE_CLIP_IDS.followLetters : MAZE_CLIP_IDS.followNumbers,
      text: letters ? 'Ikuti huruf dari' : 'Ikuti angka dari',
    },
    labelPart(kind, level.from, lang, script),
    { clip: MAZE_CLIP_IDS.until, text: 'sampai' },
    punctuated(labelPart(kind, last, lang, script), '!'),
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
export function hintLine(kind: MazeKind, nextValue: number, lang: LetterLang, script: Script = 'latin'): Part[] {
  const letters = kind === 'letters';
  return [
    {
      clip: letters ? MAZE_CLIP_IDS.findLetter : MAZE_CLIP_IDS.findNumber,
      text: letters ? 'Cari huruf' : 'Cari angka',
    },
    punctuated(labelPart(kind, nextValue, lang, script), '!'),
  ];
}

/** The label of the tile just stepped on: "tiga", or "be". */
export const stepLine = (kind: MazeKind, value: number, lang: LetterLang, script: Script = 'latin'): Part[] => [
  labelPart(kind, value, lang, script),
];

/** "Hore, sampai!" - the maze is finished. */
export const finishLine = (): Part[] => [{ clip: MAZE_CLIP_IDS.hooray, text: 'Hore, sampai!' }];

/**
 * The last tile: its label, then the cheer. The label gets an exclamation mark
 * so the engine lifts it instead of running it into "Hore" without a breath.
 */
export const arriveLine = (kind: MazeKind, value: number, lang: LetterLang, script: Script = 'latin'): Part[] => [
  punctuated(labelPart(kind, value, lang, script), '!'),
  ...finishLine(),
];
