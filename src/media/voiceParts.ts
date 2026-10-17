import { clipUrl } from './clips';
import type { SpeakOptions, VoiceStep } from '../audio/voice';

/**
 * Spoken sentences built from small, separately recordable parts.
 *
 * "Harganya tiga ribu rupiah" and "Ikuti angka dari satu sampai delapan" are
 * too many combinations to record whole, but their parts are few: a handful of
 * fixed words and the numbers and letters that already have clips. So each part
 * can be a recording of its own, and a missing one falls back to speech.
 */
import type { NativeSpeech } from '../audio/voice';

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
  /**
   * What a native speaker would say, for when the device has a voice in that
   * language. `text` stays as the stand-in for when it has not - speaking
   * Arabic script at an Indonesian voice would just be silence or nonsense.
   */
  native?: NativeSpeech;
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

    const sameVoice = last?.kind === 'tts' && last.opts?.lang === partOpts?.lang;

    if (last && last.kind === 'tts' && sameVoice && !part.native && !last.native) {
      last.text = `${last.text} ${part.text}`;
    } else {
      // A part with a native voice is its own utterance: it may be spoken by a
      // different voice from the words around it. `joinPrev` records that it
      // was written as one sentence with the step before, so that if the device
      // has no such voice, the two are joined back up (see resolveNativeSteps).
      steps.push({
        kind: 'tts',
        text: part.text,
        opts: partOpts,
        ...(part.native && { native: part.native }),
        ...(sameVoice && { joinPrev: true as const }),
      });
    }
  }

  return steps;
}
