/**
 * What the app says, as text: letter names, number words, praise.
 *
 * Plain data, with no browser in it. Written the way an id-ID voice reads them
 * aloud - sending a bare glyph or digit to a speech engine is unreliable.
 */

/** Which language the *letter names* are spoken in. Words stay Indonesian. */
export type LetterLang = 'id' | 'en';

export const LANG_TAGS: Record<LetterLang, string> = {
  id: 'id-ID',
  en: 'en-GB',
};

/**
 * Indonesian letter names, written the way an id-ID voice reads them aloud.
 * Sending the bare glyph is unreliable: an English fallback voice would say
 * "bee" for B instead of "be".
 */
export const LETTER_NAMES_ID: Record<string, string> = {
  A: 'a', B: 'be', C: 'ce', D: 'de', E: 'e', F: 'ef', G: 'ge',
  H: 'ha', I: 'i', J: 'je', K: 'ka', L: 'el', M: 'em', N: 'en',
  O: 'o', P: 'pe', Q: 'ki', R: 'er', S: 'es', T: 'te', U: 'u',
  V: 've', W: 'we', X: 'eks', Y: 'ye', Z: 'zet',
};

/**
 * English letter names, spelled out for the same reason. Sending a bare "A"
 * to an en voice often produces the unstressed article "uh" rather than the
 * letter name, so every letter gets an explicit spelling.
 */
export const LETTER_NAMES_EN: Record<string, string> = {
  A: 'a', B: 'b', C: 'see', D: 'dee', E: 'ee', F: 'f', G: 'g',
  H: 'aitch', I: 'eye', J: 'jay', K: 'kay', L: 'ell', M: 'em', N: 'en',
  O: 'oh', P: 'pee', Q: 'cue', R: 'r', S: 'ess', T: 'tee', U: 'you',
  V: 'vee', W: 'double-you', X: 'ex', Y: 'why', Z: 'zee',
};

/** Spoken form of 0-10 in Bahasa Indonesia. */
export const NUMBER_WORDS_ID = [
  'nol', 'satu', 'dua', 'tiga', 'empat', 'lima',
  'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh',
] as const;

/** Short praise phrases, rotated so the reward does not become monotonous. */
export const PRAISE_ID = ['Hebat!', 'Pintar!', 'Bagus sekali!', 'Keren!', 'Wah, pintar!'] as const;

/** Spoken before every counting round, as an auditory instruction. */
export const COUNT_PROMPT_ID = 'Ayo hitung!';

/** Spoken when the home screen appears. */
export const GREETING_ID = 'Belajar Yuk!';

export function numberWordId(n: number): string {
  return NUMBER_WORDS_ID[n] ?? String(n);
}

export function randomPraiseId(): string {
  return PRAISE_ID[Math.floor(Math.random() * PRAISE_ID.length)];
}

export function letterNameFor(letter: string, lang: LetterLang): string {
  const key = letter.trim().toUpperCase();
  const table = lang === 'en' ? LETTER_NAMES_EN : LETTER_NAMES_ID;
  return table[key] ?? key;
}
