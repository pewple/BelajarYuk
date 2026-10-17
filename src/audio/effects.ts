import { CLIP_IDS, clipUrl } from '../media/clips';

/**
 * Sound effects: the pops, chimes and coins that play over the speech.
 *
 * Every effect has two possible sources, checked in this order: a recording
 * dropped into `media/audio/ui/`, or a short sound built here with the Web
 * Audio API. So the app needs no audio files, but any file you add quietly
 * takes over. Effects are a separate channel from speech and deliberately
 * overlap with it.
 */

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

type NoiseSpec = {
  /** Centre of the band of noise that is let through, in Hz. */
  freq: number;
  /** Narrowness of that band: higher is more "pitched". */
  q?: number;
  delay?: number;
  duration: number;
  peak?: number;
};

/**
 * A short burst of filtered noise - the "ka" in a cash register's "ka-ching",
 * which is the mechanical thunk of the drawer, not a musical note.
 */
function playNoise(ctx: AudioContext, spec: NoiseSpec): void {
  const { freq, q = 1, delay = 0, duration, peak = 0.2 } = spec;
  const t0 = ctx.currentTime + delay;

  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) samples[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(t0);
  source.stop(t0 + duration);
}

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
/* The effects                                                         */
/* ------------------------------------------------------------------ */

export type EffectName = 'pop' | 'tap' | 'chime' | 'coin' | 'register' | 'nudge';

type Effect = {
  /** The recording that replaces it, if one was supplied. */
  clip: string;
  /** What to build when there is none. */
  make: (ctx: AudioContext) => void;
};

const EFFECTS: Record<EffectName, Effect> = {
  // Bright blip that falls quickly: reads as a bubble popping.
  pop: {
    clip: CLIP_IDS.pop,
    make: (ctx) => playTone(ctx, { freq: 880, toFreq: 320, type: 'triangle', duration: 0.13, peak: 0.22 }),
  },

  // A soft click: navigation.
  tap: {
    clip: CLIP_IDS.tap,
    make: (ctx) => playTone(ctx, { freq: 520, toFreq: 440, type: 'sine', duration: 0.07, peak: 0.12 }),
  },

  // C5 - E5 - G5 - C6: a major arpeggio, unmistakably "you did it". It rings
  // *underneath* the spoken total rather than replacing it.
  chime: {
    clip: CLIP_IDS.chime,
    make: (ctx) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        playTone(ctx, { freq, type: 'sine', delay: i * 0.1, duration: 0.32, peak: 0.16 });
      });
    },
  },

  // Two inharmonic high partials, the second a hair behind and ringing
  // longer: that offset is what reads as metal rather than a beep.
  coin: {
    clip: CLIP_IDS.coin,
    make: (ctx) => {
      playTone(ctx, { freq: 2637, type: 'triangle', duration: 0.09, peak: 0.16 });
      playTone(ctx, { freq: 3520, type: 'sine', delay: 0.045, duration: 0.22, peak: 0.12 });
    },
  },

  // "Ka": the drawer's thunk. "Ching": a bell, three partials that decay at
  // different rates so it shimmers instead of buzzing.
  register: {
    clip: CLIP_IDS.register,
    make: (ctx) => {
      playNoise(ctx, { freq: 1600, q: 0.8, duration: 0.07, peak: 0.22 });
      playTone(ctx, { freq: 2093, type: 'sine', delay: 0.08, duration: 0.9, peak: 0.13 });
      playTone(ctx, { freq: 3136, type: 'sine', delay: 0.08, duration: 0.65, peak: 0.08 });
      playTone(ctx, { freq: 4186, type: 'sine', delay: 0.08, duration: 0.4, peak: 0.05 });
    },
  },

  // Two soft sine notes sliding down a third: a questioning "hmm?", not a
  // rejection. Quiet on purpose - being wrong here should feel like a small
  // shrug, never like a penalty.
  nudge: {
    clip: CLIP_IDS.nudge,
    make: (ctx) => {
      playTone(ctx, { freq: 392, type: 'sine', duration: 0.12, peak: 0.09 });
      playTone(ctx, { freq: 311, type: 'sine', delay: 0.1, duration: 0.2, peak: 0.08 });
    },
  },
};

/** Plays an effect: the recording if there is one, else the built sound. */
export function playEffect(name: EffectName): void {
  const { clip, make } = EFFECTS[name];
  const url = clipUrl(clip);
  if (url && playClipNow(url)) return;

  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  make(ctx);
}

/** Unlocks the AudioContext. Call from a real user gesture. */
export function primeAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}
