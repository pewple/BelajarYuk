import { clipUrl } from './clips';
import type { SpeakOptions, VoiceStep } from '../hooks/useAudio';

/**
 * Spoken sentences built from small, separately recordable parts.
 *
 * "Harganya tiga ribu rupiah" and "Ikuti angka dari satu sampai delapan" are
 * too many combinations to record whole, but their parts are few: a handful of
 * fixed words and the numbers and letters that already have clips. So each part
 * can be a recording of its own, and a missing one falls back to speech.
 */
export type Part = {
  /** Clip id to look for in media/audio. */
  clip: string;
  /** What to say instead when there is no recording. */
  text: string;
  /**
   * BCP-47 tag when this part is not Indonesian - an English letter name
   * dropped into an Indonesian sentence, say. Left out, the default applies.
   */
  lang?: string;
};

/**
 * Turns parts into playable steps: a recording wherever one exists, otherwise
 * speech. Neighbouring spoken parts are merged into a single utterance -
 * spoken separately, "Harganya" / "tiga ribu" / "rupiah" would come out as
 * three clipped words instead of one sentence.
 *
 * Parts in different languages are never merged: one utterance has one voice,
 * so "Ikuti huruf dari" and "aitch" must be spoken separately to each get
 * their own.
 */
export function stepsFor(parts: Part[], opts?: SpeakOptions): VoiceStep[] {
  const steps: VoiceStep[] = [];

  for (const part of parts) {
    const url = clipUrl(part.clip);
    if (url) {
      steps.push({ kind: 'clip', url });
      continue;
    }

    const partOpts = part.lang ? { ...opts, lang: part.lang } : opts;
    const last = steps[steps.length - 1];

    if (last && last.kind === 'tts' && last.opts?.lang === partOpts?.lang) {
      last.text = `${last.text} ${part.text}`;
    } else {
      steps.push({ kind: 'tts', text: part.text, opts: partOpts });
    }
  }

  return steps;
}
