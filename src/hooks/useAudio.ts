import { useCallback, useEffect, useRef, useState } from 'react';
import { playEffect, primeAudioContext } from '../audio/effects';
import { runVoice, getSynth, isIndonesian, normaliseLang, stopVoice, CHEER_PROSODY } from '../audio/voice';
import type { SpeakOptions, VoiceStep } from '../audio/voice';
import {
  COUNT_PROMPT_ID,
  GREETING_ID,
  LANG_TAGS,
  letterNameFor,
  numberWordId,
  randomPraiseId,
} from '../audio/words';
import type { LetterLang } from '../audio/words';
import { CLIP_IDS, clipPool, clipUrl, hasRecordedVoice, letterClipId, numberClipId, wordClipId } from '../media/clips';

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
 * The work is in `src/audio/`: the words as data (`words.ts`), the respellings
 * for a device without an Indonesian voice (`respell.ts`), the speech queue
 * (`voice.ts`) and the sound effects (`effects.ts`). This hook only wires them
 * to React and to the installed voices.
 *
 * Spoken sounds run through one queue (`playVoice`) so a phrase is never cut
 * off mid-word by the next one. Effects are a separate channel and
 * deliberately overlap with speech.
 */

function pickRandom<T>(items: T[]): T | undefined {
  return items.length === 0 ? undefined : items[Math.floor(Math.random() * items.length)];
}

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
  /** Bright metallic clink - a piece of money handed over. */
  playCoin: () => void;
  /** "Ka-ching" - the register drawer opening. */
  playRegister: () => void;
  /** A soft, low "hmm" - not that one. Deliberately gentle, never a buzzer. */
  playNudge: () => void;
  /** One praise step (a recorded take if any, else a spoken phrase), for building runs. */
  praiseStep: () => VoiceStep;
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

  const playVoice = useCallback((steps: VoiceStep[]) => runVoice(steps, pickVoice), [pickVoice]);

  /** Prefer a recorded clip; fall back to the speech engine. */
  const voiceFor = useCallback((clipId: string, text: string, opts?: SpeakOptions): VoiceStep => {
    const url = clipUrl(clipId);
    return url ? { kind: 'clip', url } : { kind: 'tts', text, opts };
  }, []);

  const speak = useCallback(
    (text: string, opts?: SpeakOptions) => playVoice([{ kind: 'tts', text, opts }]),
    [playVoice],
  );

  const speakLetter = useCallback(
    (letter: string, lang: LetterLang = 'id') =>
      playVoice([voiceFor(letterClipId(letter, lang), letterNameFor(letter, lang), { lang: LANG_TAGS[lang] })]),
    [playVoice, voiceFor],
  );

  const speakWord = useCallback(
    (word: string) => playVoice([voiceFor(wordClipId(word), word)]),
    [playVoice, voiceFor],
  );

  const speakNumber = useCallback(
    (n: number, opts?: SpeakOptions) => playVoice([voiceFor(numberClipId(n), numberWordId(n), opts)]),
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
      playVoice([voiceFor(numberClipId(n), `${numberWordId(n)}!`, CHEER_PROSODY), praiseStep()]),
    [playVoice, praiseStep, voiceFor],
  );

  const praise = useCallback(() => playVoice([praiseStep()]), [playVoice, praiseStep]);

  const primeAudio = useCallback(() => primeAudioContext(), []);

  const playPop = useCallback(() => playEffect('pop'), []);
  const playTap = useCallback(() => playEffect('tap'), []);
  const playChime = useCallback(() => playEffect('chime'), []);
  const playCoin = useCallback(() => playEffect('coin'), []);
  const playRegister = useCallback(() => playEffect('register'), []);
  const playNudge = useCallback(() => playEffect('nudge'), []);

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
    playCoin,
    playRegister,
    playNudge,
    praiseStep,
    primeAudio,
    isSpeechSupported,
    hasIndonesianVoice,
    hasRecordedVoice: hasRecordedVoice(),
  };
}
