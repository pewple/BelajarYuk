import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CLIP_IDS,
  clipPool,
  clipUrl,
  hasRecordedVoice,
  letterClipId,
  numberClipId,
  wordClipId,
} from '../media/clips';

/**
 * Central audio hook for the whole app.
 *
 * Every sound has two possible sources, checked in this order:
 *
 *  1. A recorded clip you dropped into `media/audio/` (see media/clips.ts)
 *  2. A generated fallback - Web Speech for words, a Web Audio oscillator
 *     for effects
 *
 * So the app needs no audio files to work, but any file you add quietly
 * takes over. Recording your own voice is the only way to get Indonesian
 * pronunciation exactly right on a device with no `id-ID` voice installed.
 *
 * Spoken sounds run through one queue (`playVoice`) so a phrase is never cut
 * off mid-word by the next one, whether it is a clip, synthesised speech, or
 * a mix of the two. Effects are a separate channel and deliberately overlap
 * with speech.
 */

/** Which language the *letter names* are spoken in. Words stay Indonesian. */
export type LetterLang = 'id' | 'en';

export const LANG_TAGS: Record<LetterLang, string> = {
  id: 'id-ID',
  en: 'en-GB',
};

export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
  /** BCP-47 tag. Defaults to Indonesian. */
  lang?: string;
};

export type SpeakItem = SpeakOptions & { text: string };

/** One step in a spoken run: a recording, or something for the engine to say. */
export type VoiceStep =
  | { kind: 'clip'; url: string }
  | { kind: 'tts'; text: string; opts?: SpeakOptions };

/** Slow and slightly bright: easier for a 3-year-old to segment and imitate. */
const TODDLER_PROSODY: Required<Omit<SpeakOptions, 'lang'>> = {
  rate: 0.75,
  pitch: 1.1,
  volume: 1,
};

/** Excited prosody used for praise and for announcing a finished count. */
const CHEER_PROSODY: Required<Omit<SpeakOptions, 'lang'>> = {
  rate: 0.85,
  pitch: 1.35,
  volume: 1,
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

/* ------------------------------------------------------------------ */
/* Speaking Indonesian on a device with no Indonesian voice            */
/* ------------------------------------------------------------------ */

/** The tag used when an English voice has to stand in for a missing id-ID one. */
const EN_FALLBACK_TAG = 'en-US';

/**
 * Phonetic respellings, used *only* when the device has no `id-ID` voice.
 *
 * Asking for `id-ID` on a machine that has none does not fail loudly - the
 * engine quietly substitutes its default voice and reads the Indonesian
 * spelling with English letter rules, so "Belajar Yuk" comes out
 * "buh-LAY-jar YUCK". These respellings hand that English voice something
 * that lands closer to the Indonesian vowels instead.
 *
 * The moment a real Indonesian voice is installed this table is ignored
 * entirely and the proper spellings above are used, so it can never make a
 * correctly-configured device worse.
 *
 * Tune by ear - these are approximations, not a pronunciation standard.
 * Keys are lowercase with trailing punctuation stripped.
 */
export const EN_VOICE_RESPELL: Record<string, string> = {
  // Phrases
  'belajar yuk': 'buh-lah-jar yook',
  'ayo hitung': 'ah-yoh hee-toong',

  // Numbers
  nol: 'nohl',
  satu: 'sah-too',
  dua: 'doo-ah',
  tiga: 'tee-gah',
  empat: 'uhm-paht',
  lima: 'lee-mah',
  enam: 'uh-nahm',
  tujuh: 'too-jooh',
  delapan: 'duh-lah-pahn',
  sembilan: 'sum-bee-lahn',
  sepuluh: 'suh-poo-looh',

  // Praise
  hebat: 'heh-baht',
  pintar: 'peen-tar',
  'bagus sekali': 'bah-goos suh-kah-lee',
  keren: 'kuh-ren',
  'wah, pintar': 'wah, peen-tar',

  // Letter names (the Indonesian ones, not the English toggle)
  a: 'ah',
  be: 'bay',
  ce: 'chay',
  de: 'day',
  e: 'ay',
  ef: 'eff',
  ge: 'gheh',
  ha: 'hah',
  i: 'ee',
  je: 'jay',
  ka: 'kah',
  el: 'ell',
  em: 'em',
  en: 'en',
  o: 'oh',
  pe: 'pay',
  ki: 'kee',
  er: 'air',
  es: 'ess',
  te: 'tay',
  u: 'oo',
  ve: 'vay',
  we: 'way',
  eks: 'ex',
  ye: 'yeh',
  zet: 'zett',

  // Word cards
  apel: 'ah-pell',
  buku: 'boo-koo',
  cangkir: 'chahng-keer',
  daun: 'dah-oon',
  'es krim': 'ess kreem',
  foto: 'foh-toh',
  gunung: 'goo-noong',
  hati: 'hah-tee',
  ikan: 'ee-kahn',
  jam: 'jahm',
  kucing: 'koo-ching',
  lampu: 'lahm-poo',
  mobil: 'moh-beel',
  nyamuk: 'nyah-mook',
  ombak: 'ohm-bahk',
  pisang: 'pee-sahng',
  quran: 'koor-ahn',
  rumah: 'roo-mah',
  susu: 'soo-soo',
  telur: 'tuh-loor',
  ulat: 'oo-laht',
  vitamin: 'vee-tah-meen',
  wortel: 'wor-tell',
  'x-ray': 'ex ray',
  yoyo: 'yoh-yoh',
  zebra: 'zeh-brah',
};

/**
 * The English-voice spelling of `text`, or null when there is none.
 * Trailing punctuation is preserved so an exclamation keeps its lift.
 */
export function respellForEnglishVoice(text: string): string | null {
  const trimmed = text.trim();
  const bare = trimmed.replace(/[!.,?]+$/, '');
  const suffix = trimmed.slice(bare.length);
  const hit = EN_VOICE_RESPELL[bare.toLowerCase()];
  return hit === undefined ? null : hit + suffix;
}

function pickRandom<T>(items: T[]): T | undefined {
  return items.length === 0 ? undefined : items[Math.floor(Math.random() * items.length)];
}

/* ------------------------------------------------------------------ */
/* Web Speech                                                          */
/* ------------------------------------------------------------------ */

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return 'speechSynthesis' in window ? window.speechSynthesis : null;
}

function normaliseLang(tag: string): string {
  return tag.toLowerCase().replace('_', '-');
}

function isIndonesian(voice: SpeechSynthesisVoice): boolean {
  return normaliseLang(voice.lang).startsWith('id');
}

/* ------------------------------------------------------------------ */
/* Web Audio                                                           */
/* ------------------------------------------------------------------ */

type AudioContextCtor = typeof AudioContext;

/**
 * One AudioContext for the whole app. Browsers cap how many a page may
 * create, and every screen mounts its own copy of this hook.
 */
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedCtx) return sharedCtx;

  const withPrefix = window as Window & { webkitAudioContext?: AudioContextCtor };
  const Ctor = window.AudioContext ?? withPrefix.webkitAudioContext;
  if (!Ctor) return null;

  try {
    sharedCtx = new Ctor();
  } catch {
    return null;
  }
  return sharedCtx;
}

type ToneSpec = {
  /** Starting frequency in Hz. */
  freq: number;
  /** Optional glide target, reached at the end of the tone. */
  toFreq?: number;
  type?: OscillatorType;
  /** Seconds from "now" before the tone starts. */
  delay?: number;
  duration: number;
  /** Peak gain, 0-1. Kept low; toddlers are often close to the speaker. */
  peak?: number;
};

function playTone(ctx: AudioContext, spec: ToneSpec): void {
  const { freq, toFreq, type = 'sine', delay = 0, duration, peak = 0.18 } = spec;
  const t0 = ctx.currentTime + delay;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (toFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(toFreq, 1), t0 + duration);
  }

  // Exponential ramps cannot touch zero, hence the tiny floor value.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.015, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

/* ------------------------------------------------------------------ */
/* Clip playback                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fire-and-forget clip, used for effects. Each call gets its own element so
 * rapid taps overlap rather than cutting each other off.
 */
function playClipNow(url: string, volume = 1): boolean {
  if (typeof Audio === 'undefined') return false;
  try {
    const audio = new Audio(url);
    audio.volume = volume;
    const started = audio.play() as Promise<void> | undefined;
    // A blocked autoplay rejects; nothing to do but let the caller carry on.
    started?.catch(() => {});
    return true;
  } catch {
    return false;
  }
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

function stopVoice(): void {
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

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export type AudioApi = {
  /** Play a run of clips and/or spoken phrases, one after another. */
  playVoice: (steps: VoiceStep[]) => void;
  /** Speak one phrase, interrupting anything already speaking. */
  speak: (text: string, opts?: SpeakOptions) => void;
  /** Play a letter's name - recorded clip if there is one, else the engine. */
  speakLetter: (letter: string, lang?: LetterLang) => void;
  /** Play the word on a Belajar Bicara card. */
  speakWord: (word: string) => void;
  /** Play a number 0-10, e.g. 3 -> "tiga". */
  speakNumber: (n: number, opts?: SpeakOptions) => void;
  /** "Ayo hitung!" - the instruction that opens a counting round. */
  speakCountPrompt: () => void;
  /** "Belajar Yuk!" - the greeting on the home screen. */
  playGreeting: () => void;
  /** Announce a finished count and follow it with praise, without cutting off. */
  celebrateCount: (n: number) => void;
  /** Play a random short praise phrase. */
  praise: () => void;
  /** Stop any speech or clip in progress. */
  stopSpeaking: () => void;
  /** Short bubble "pop" - object tapped. */
  playPop: () => void;
  /** Soft click - navigation. */
  playTap: () => void;
  /** Rising arpeggio - task completed. */
  playChime: () => void;
  /** Unlock/resume the AudioContext. Call from a real user gesture. */
  primeAudio: () => void;
  /** False when the browser has no speech synthesis at all. */
  isSpeechSupported: boolean;
  /**
   * True once an Indonesian voice has been found. When false the browser
   * still speaks, but with a foreign accent - worth telling the grown-up,
   * unless they have recorded their own clips.
   */
  hasIndonesianVoice: boolean;
  /** True when at least one spoken clip has been supplied. */
  hasRecordedVoice: boolean;
};

export function useAudio(): AudioApi {
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const [hasIndonesianVoice, setHasIndonesianVoice] = useState(false);

  const isSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Voice lists load asynchronously in most browsers, so listen for updates.
  useEffect(() => {
    const synth = getSynth();
    if (!synth) return;

    const refresh = () => {
      const voices = synth.getVoices();
      if (voices.length === 0) return;
      voicesRef.current = voices;
      setHasIndonesianVoice(voices.some(isIndonesian));
    };

    refresh();
    synth.addEventListener?.('voiceschanged', refresh);
    return () => synth.removeEventListener?.('voiceschanged', refresh);
  }, []);

  // Deliberately no "stop on unmount" here. Every screen mounts its own copy
  // of this hook, so unmounting one would cut off audio another had started -
  // in StrictMode that silently swallowed the home screen greeting. Stopping
  // on navigation is App's job, via `stopSpeaking` in `goTo`.

  const pickVoice = useCallback((langTag: string): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current;
    const want = normaliseLang(langTag);
    const base = want.split('-')[0];
    return (
      voices.find((v) => normaliseLang(v.lang) === want) ??
      voices.find((v) => normaliseLang(v.lang).startsWith(base)) ??
      null
    );
  }, []);

  const stopSpeaking = useCallback(() => stopVoice(), []);

  const playVoice = useCallback(
    (steps: VoiceStep[]) => {
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

        for (const step of usable) {
          if (run !== voiceRun) return; // superseded by a newer run
          if (step.kind === 'clip') {
            await playClipStep(step.url);
          } else if (synth) {
            await speakStep(synth, { text: step.text, ...step.opts }, pickVoice(step.opts?.lang ?? LANG_TAGS.id));
          }
        }
      })();
    },
    [pickVoice],
  );

  /** Prefer a recorded clip; fall back to the speech engine. */
  const voiceFor = useCallback(
    (clipId: string, text: string, opts?: SpeakOptions): VoiceStep => {
      const url = clipUrl(clipId);
      return url ? { kind: 'clip', url } : { kind: 'tts', text, opts };
    },
    [],
  );

  const speak = useCallback(
    (text: string, opts?: SpeakOptions) => playVoice([{ kind: 'tts', text, opts }]),
    [playVoice],
  );

  const speakLetter = useCallback(
    (letter: string, lang: LetterLang = 'id') =>
      playVoice([
        voiceFor(letterClipId(letter, lang), letterNameFor(letter, lang), { lang: LANG_TAGS[lang] }),
      ]),
    [playVoice, voiceFor],
  );

  const speakWord = useCallback(
    (word: string) => playVoice([voiceFor(wordClipId(word), word)]),
    [playVoice, voiceFor],
  );

  const speakNumber = useCallback(
    (n: number, opts?: SpeakOptions) =>
      playVoice([voiceFor(numberClipId(n), numberWordId(n), opts)]),
    [playVoice, voiceFor],
  );

  const speakCountPrompt = useCallback(
    () => playVoice([voiceFor(CLIP_IDS.countPrompt, COUNT_PROMPT_ID)]),
    [playVoice, voiceFor],
  );

  const playGreeting = useCallback(
    () => playVoice([voiceFor(CLIP_IDS.greeting, GREETING_ID, CHEER_PROSODY)]),
    [playVoice, voiceFor],
  );

  /** A praise clip if any were recorded, otherwise a spoken phrase. */
  const praiseStep = useCallback((): VoiceStep => {
    const url = pickRandom(clipPool('praise'));
    return url ? { kind: 'clip', url } : { kind: 'tts', text: randomPraiseId(), opts: CHEER_PROSODY };
  }, []);

  const celebrateCount = useCallback(
    (n: number) =>
      playVoice([
        voiceFor(numberClipId(n), `${numberWordId(n)}!`, CHEER_PROSODY),
        praiseStep(),
      ]),
    [playVoice, praiseStep, voiceFor],
  );

  const praise = useCallback(() => playVoice([praiseStep()]), [playVoice, praiseStep]);

  const primeAudio = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }, []);

  /** An effect: recorded clip if supplied, else the synthesised fallback. */
  const playEffect = useCallback((clipId: string, fallback: (ctx: AudioContext) => void) => {
    const url = clipUrl(clipId);
    if (url && playClipNow(url)) return;

    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    fallback(ctx);
  }, []);

  const playPop = useCallback(
    () =>
      playEffect(CLIP_IDS.pop, (ctx) =>
        // Bright blip that falls quickly: reads as a bubble popping.
        playTone(ctx, { freq: 880, toFreq: 320, type: 'triangle', duration: 0.13, peak: 0.22 }),
      ),
    [playEffect],
  );

  const playTap = useCallback(
    () =>
      playEffect(CLIP_IDS.tap, (ctx) =>
        playTone(ctx, { freq: 520, toFreq: 440, type: 'sine', duration: 0.07, peak: 0.12 }),
      ),
    [playEffect],
  );

  const playChime = useCallback(
    () =>
      playEffect(CLIP_IDS.chime, (ctx) => {
        // C5 - E5 - G5 - C6: a major arpeggio, unmistakably "you did it".
        // Effects are a separate channel from speech, so this deliberately
        // rings *underneath* the spoken total rather than replacing it.
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
          playTone(ctx, { freq, type: 'sine', delay: i * 0.1, duration: 0.32, peak: 0.16 });
        });
      }),
    [playEffect],
  );

  return {
    playVoice,
    speak,
    speakLetter,
    speakWord,
    speakNumber,
    speakCountPrompt,
    playGreeting,
    celebrateCount,
    praise,
    stopSpeaking,
    playPop,
    playTap,
    playChime,
    primeAudio,
    isSpeechSupported,
    hasIndonesianVoice,
    hasRecordedVoice: hasRecordedVoice(),
  };
}
