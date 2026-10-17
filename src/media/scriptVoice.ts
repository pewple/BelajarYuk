import { ARABIC_NUMBER_NAMES, ARABIC_NUMBER_WORDS } from '../data/scripts';
import type { ArabicWordCard } from '../data/arabicWords';
import type { ArabicLetter, Script } from '../data/scripts';
import { numberWordId } from '../audio/words';
import { arabicLetterClipId, arabicNumberClipId, arabicWordClipId, numberClipId } from './clips';
import type { Part } from './voiceParts';

/**
 * How a letter or number is said, in either script.
 *
 * Each is a `Part` - a recording if one exists, speech otherwise - so the
 * Arabic names can be recorded one by one, exactly like the Latin ones.
 */

/**
 * The tag asked for when a native Arabic voice is wanted. Any Arabic voice is
 * accepted (ar-SA, ar-EG, ...): `pickVoice` matches on the language part.
 */
export const ARABIC_LANG = 'ar-SA';

/** A number said aloud: "tiga" in Latin script, "tsalatsah" in Arabic. */
export function numberPart(n: number, script: Script): Part {
  if (script !== 'arab') return { clip: numberClipId(n), text: numberWordId(n) };

  const word = ARABIC_NUMBER_WORDS[n];
  return {
    clip: arabicNumberClipId(n),
    text: ARABIC_NUMBER_NAMES[n] ?? String(n),
    ...(word && { native: { text: word, lang: ARABIC_LANG } }),
  };
}

/** The word on an Arabic card: the Arabic voice reads the Arabic, an Indonesian one the spelling. */
export function arabicWordPart(card: ArabicWordCard): Part {
  return {
    clip: arabicWordClipId(card.letterId),
    text: card.say,
    native: { text: card.word, lang: ARABIC_LANG },
  };
}

/** An Arabic letter's name: "alif", "ba"... */
export function arabicLetterPart(letter: ArabicLetter): Part {
  return {
    clip: arabicLetterClipId(letter.id),
    text: letter.name,
    native: { text: letter.arabic, lang: ARABIC_LANG },
  };
}
