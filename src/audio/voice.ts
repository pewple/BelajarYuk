import { EN_FALLBACK_TAG, respellForEnglishVoice } from './respell';
import { LANG_TAGS } from './words';

/**
 * Spoken sounds: what a run of speech is made of, and the one queue that plays
 * it.
 *
 * A run is clips and spoken phrases, one after another, so a phrase is never
 * cut off mid-word by the next one whether it is a recording, synthesised
 * speech, or a mix of the two. There is one queue for the whole app: every
 * screen mounts its own copy of the audio hook, but they share one pair of ears.
 */

export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
  /** BCP-47 tag. Defaults to Indonesian. */
  lang?: string;
};

export type SpeakItem = SpeakOptions & { text: string };

/**
 * What a native speaker would say, for a device that has a voice in that
 * language. `text` is Arabic script, `lang` e.g. "ar-SA".
 */
export type NativeSpeech = { text: string; lang: string };

/** One step in a spoken run: a recording, or something for the engine to say. */
export type VoiceStep =
  | { kind: 'clip'; url: string }
  | {
      kind: 'tts';
      text: string;
      opts?: SpeakOptions;
      /** Used instead of `text` when the device has a voice for `native.lang`. */
      native?: NativeSpeech;
      /**
       * This step was written as one sentence with the one before it. It matters
       * only if a native voice is missing, when the two are joined back together.
       */
      joinPrev?: true;
    };

/** Slow and slightly bright: easier for a 3-year-old to segment and imitate. */
const TODDLER_PROSODY: Required<Omit<SpeakOptions, 'lang'>> = {
  rate: 0.75,
  pitch: 1.1,
  volume: 1,
};

/** Excited prosody used for praise and for announcing a finished count. */
export const CHEER_PROSODY: Required<Omit<SpeakOptions, 'lang'>> = {
  rate: 0.85,
  pitch: 1.35,
  volume: 1,
};

/* ------------------------------------------------------------------ */
/* Web Speech                                                          */
/* ------------------------------------------------------------------ */

export function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return 'speechSynthesis' in window ? window.speechSynthesis : null;
}

export function normaliseLang(tag: string): string {
  return tag.toLowerCase().replace('_', '-');
}

export function isIndonesian(voice: SpeechSynthesisVoice): boolean {
  return normaliseLang(voice.lang).startsWith('id');
}

/* ------------------------------------------------------------------ */
/* The voice queue                                                     */
/* ------------------------------------------------------------------ */

/**
 * Bumped whenever a new run starts, so an in-flight run can notice it has
 * been superseded and stop between steps. Module scope, because every screen
 * mounts its own copy of this hook and they share one pair of ears.
 */
let voiceRun = 0;
/** Ends whatever step is playing right now, so the chain never wedges. */
let finishCurrentStep: (() => void) | null = null;
let currentClip: HTMLAudioElement | null = null;

export function stopVoice(): void {
  voiceRun += 1;
  if (currentClip) {
    try {
      currentClip.pause();
    } catch {
      /* Already gone. */
    }
    currentClip = null;
  }
  getSynth()?.cancel();
  const finish = finishCurrentStep;
  finishCurrentStep = null;
  finish?.();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function playClipStep(url: string): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (finishCurrentStep === finish) finishCurrentStep = null;
      currentClip = null;
      resolve();
    };
    finishCurrentStep = finish;

    if (typeof Audio === 'undefined') {
      finish();
      return;
    }

    try {
      const audio = new Audio(url);
      currentClip = audio;
      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });
      const started = audio.play() as Promise<void> | undefined;
      started?.catch(finish);
    } catch {
      finish();
    }
  });
}

function sameProsody(a: SpeakOptions | undefined, b: SpeakOptions | undefined): boolean {
  return a?.lang === b?.lang && a?.rate === b?.rate && a?.pitch === b?.pitch && a?.volume === b?.volume;
}

/**
 * Settles, for this device, which steps are spoken natively and which are not.
 *
 * A step with a `native` voice stays its own utterance when the device has
 * that voice. Without one it falls back to its plain text - and that text is
 * joined back onto the words around it, so "Ikuti huruf dari alif sampai tsa"
 * is one smooth sentence again rather than four clipped fragments.
 */
export function resolveNativeSteps(
  steps: VoiceStep[],
  hasVoice: (lang: string) => boolean,
): VoiceStep[] {
  const out: VoiceStep[] = [];

  for (const step of steps) {
    if (step.kind !== 'tts' || (step.native && hasVoice(step.native.lang))) {
      out.push(step);
      continue;
    }

    const last = out[out.length - 1];
    if (step.joinPrev && last?.kind === 'tts' && !last.native && sameProsody(last.opts, step.opts)) {
      out[out.length - 1] = { ...last, text: `${last.text} ${step.text}` };
    } else {
      out.push({ kind: 'tts', text: step.text, opts: step.opts });
    }
  }
  return out;
}

function speakStep(
  synth: SpeechSynthesis,
  item: SpeakItem,
  voice: SpeechSynthesisVoice | null,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let guard = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(guard);
      if (finishCurrentStep === finish) finishCurrentStep = null;
      resolve();
    };
    finishCurrentStep = finish;

    try {
      const u = new SpeechSynthesisUtterance(item.text);
      u.lang = item.lang ?? LANG_TAGS.id;
      if (voice) u.voice = voice;
      else if (normaliseLang(u.lang).startsWith('id')) {
        // Indonesian was asked for and this device has no Indonesian voice.
        // Rather than let an English voice read Indonesian spelling as
        // English, give it a respelling and be honest about the language.
        const respelled = respellForEnglishVoice(item.text);
        if (respelled !== null) {
          u.text = respelled;
          u.lang = EN_FALLBACK_TAG;
        }
      }
      u.rate = item.rate ?? TODDLER_PROSODY.rate;
      u.pitch = item.pitch ?? TODDLER_PROSODY.pitch;
      u.volume = item.volume ?? TODDLER_PROSODY.volume;
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);

      // Some engines never fire `onend` (notably right after a cancel), which
      // would wedge the queue forever. Generous ceiling, then move on.
      guard = window.setTimeout(finish, 1500 + item.text.length * 110);
    } catch {
      finish();
    }
  });
}

/**
 * Plays a run of steps, replacing whatever is being said.
 *
 * `pickVoice` finds an installed voice for a language tag, or null. A run that
 * is replaced by a newer one stops between steps.
 */
export function runVoice(
  steps: VoiceStep[],
  pickVoice: (langTag: string) => SpeechSynthesisVoice | null,
): void {
  const usable = steps.filter((s) => (s.kind === 'clip' ? s.url : s.text.trim().length > 0));
  if (usable.length === 0) return;

  const synth = getSynth();
  // Chrome drops an utterance queued in the same tick as cancel(), so if
  // something is mid-sentence the new run waits a beat before starting.
  const needsSettle = Boolean(synth && (synth.speaking || synth.pending));

  stopVoice();
  const run = voiceRun;

  void (async () => {
    if (needsSettle) await delay(70);

    const resolved = resolveNativeSteps(usable, (lang) => pickVoice(lang) !== null);
    for (const step of resolved) {
      if (run !== voiceRun) return; // superseded by a newer run
      if (step.kind === 'clip') {
        await playClipStep(step.url);
      } else if (synth) {
        // A real voice for the native language beats the transliteration.
        const nativeVoice = step.native ? pickVoice(step.native.lang) : null;
        if (step.native && nativeVoice) {
          await speakStep(synth, { ...step.opts, text: step.native.text, lang: step.native.lang }, nativeVoice);
        } else {
          await speakStep(synth, { text: step.text, ...step.opts }, pickVoice(step.opts?.lang ?? LANG_TAGS.id));
        }
      }
    }
  })();
}
