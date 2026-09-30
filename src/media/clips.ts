import { slugify } from './slug';
import { audioRegistry } from './manifest';

/**
 * Your own recordings, replacing the speech engine and the generated beeps.
 *
 * Drop a file into `media/audio/` and list it in `media/manifest.js` (the
 * Perbarui-Media.bat script does that in one double-click). The clip's id is
 * its path under that folder with the extension removed, so the directory
 * layout *is* the API:
 *
 *   media/audio/letters/id/a.mp3   -> "letters/id/a"
 *   media/audio/words/apel.mp3     -> "words/apel"
 *   media/audio/numbers/3.mp3      -> "numbers/3"
 *   media/audio/praise/hebat.mp3   -> "praise/hebat"
 *   media/audio/phrases/greeting.mp3
 *   media/audio/ui/pop.mp3         -> "ui/pop"
 *
 * Anywhere a clip exists it replaces the generated sound; anywhere one is
 * missing the app falls back to the speech engine or an oscillator. Record
 * ten files or four hundred - it works either way, in any order.
 */

/** URL of the clip with this id, or undefined when none was supplied. */
export function clipUrl(id: string): string | undefined {
  return audioRegistry().urls[id.toLowerCase()];
}

/**
 * Every clip sitting under `prefix`, sorted for a stable order.
 * Used for pools such as `praise/`, where any number of takes can be
 * dropped in and one is chosen at random.
 */
export function clipPool(prefix: string): string[] {
  const needle = prefix.toLowerCase().replace(/\/?$/, '/');
  const { urls } = audioRegistry();
  return Object.keys(urls)
    .filter((id) => id.startsWith(needle))
    .sort()
    .map((id) => urls[id]);
}

/** How many clips live under `prefix`. */
export function clipCount(prefix: string): number {
  return clipPool(prefix).length;
}

/* ------------------------------------------------------------------ */
/* Ids used by the app                                                 */
/* ------------------------------------------------------------------ */

export const CLIP_IDS = {
  greeting: 'phrases/greeting',
  countPrompt: 'phrases/ayo-hitung',
  pop: 'ui/pop',
  tap: 'ui/tap',
  chime: 'ui/chime',
} as const;

export function letterClipId(letter: string, lang: string): string {
  return `letters/${lang}/${slugify(letter)}`;
}

export function wordClipId(word: string): string {
  return `words/${slugify(word)}`;
}

export function numberClipId(n: number): string {
  return `numbers/${n}`;
}

/**
 * True once any spoken clip has been supplied. The home screen uses this to
 * drop its "no Indonesian voice installed" note - once you have recorded
 * your own voice, the device's voices stop mattering.
 */
export function hasRecordedVoice(): boolean {
  return (
    clipCount('letters') + clipCount('words') + clipCount('numbers') + clipCount('phrases') > 0
  );
}
