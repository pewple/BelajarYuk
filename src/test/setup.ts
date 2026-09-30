import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { reloadMedia } from '../media/manifest';

/**
 * jsdom ships neither the Web Speech API nor the Web Audio API. The hook is
 * written to degrade gracefully without them, but stubbing both lets the
 * tests assert that the right thing was *said* and *played*.
 */

class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

export const spokenTexts: string[] = [];

/** Full utterances, for tests that care about the language or voice chosen. */
export const spokenUtterances: { text: string; lang: string; voice: string | null }[] = [];

/**
 * Voices the fake engine reports. Empty by default, mirroring a device with
 * no Indonesian voice installed. A test can push one in before rendering to
 * exercise the opposite path.
 */
export const installedVoices: SpeechSynthesisVoice[] = [];

export function installVoice(name: string, lang: string): void {
  installedVoices.push({
    name,
    lang,
    default: installedVoices.length === 0,
    localService: true,
    voiceURI: name,
  } as SpeechSynthesisVoice);
}

const speechSynthesisStub = {
  speaking: false,
  pending: false,
  paused: false,
  getVoices: () => installedVoices,
  speak: (u: FakeUtterance) => {
    spokenTexts.push(u.text);
    spokenUtterances.push({ text: u.text, lang: u.lang, voice: u.voice?.name ?? null });
    // A real engine fires `onend` when the phrase finishes, and the app's
    // voice queue waits for it before starting the next step. Without this
    // a multi-step run would stall on its safety timeout.
    setTimeout(() => u.onend?.(), 0);
  },
  cancel: () => {},
  pause: () => {},
  resume: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
vi.stubGlobal('speechSynthesis', speechSynthesisStub);
Object.defineProperty(window, 'speechSynthesis', {
  configurable: true,
  value: speechSynthesisStub,
});

/** Minimal AudioContext: enough graph surface for the tone helper to run. */
class FakeAudioParam {
  value = 0;
  setValueAtTime() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
}

class FakeAudioNode {
  connect(target: FakeAudioNode) {
    return target;
  }
  disconnect() {}
}

class FakeOscillator extends FakeAudioNode {
  type = 'sine';
  frequency = new FakeAudioParam();
  start() {}
  stop() {}
}

class FakeGain extends FakeAudioNode {
  gain = new FakeAudioParam();
}

export const playedToneCounts = { value: 0 };

class FakeAudioContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = new FakeAudioNode();
  createOscillator() {
    playedToneCounts.value += 1;
    return new FakeOscillator();
  }
  createGain() {
    return new FakeGain();
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

vi.stubGlobal('AudioContext', FakeAudioContext);

/** Stand-in for media/manifest.js, which the real page loads before the app. */
export function setMediaManifest(manifest: { audio?: unknown; images?: unknown } | undefined): void {
  if (manifest === undefined) delete window.BELAJAR_MEDIA;
  else window.BELAJAR_MEDIA = manifest;
  reloadMedia();
}

afterEach(() => {
  cleanup();
  // Nothing customised by default, and no parent page left open, so one
  // test's manifest or #media hash never leaks into the next.
  setMediaManifest(undefined);
  window.history.replaceState(null, '', window.location.pathname);
  spokenTexts.length = 0;
  spokenUtterances.length = 0;
  installedVoices.length = 0;
  playedToneCounts.value = 0;
  // The letter-language preference is deliberately persisted, so without
  // this a test that flips it to English leaks into every test after it.
  try {
    window.localStorage.clear();
  } catch {
    /* Storage is optional; the app copes without it and so do the tests. */
  }
});
