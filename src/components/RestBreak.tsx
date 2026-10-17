import { useEffect } from 'react';
import { House, Moon } from 'lucide-react';
import { useAudio } from '../hooks/useAudio';
import { useSwallowGameKeys } from '../hooks/useSwallowGameKeys';
import { CLIP_IDS } from '../media/clips';
import { stepsFor } from '../media/voiceParts';

export const REST_LINE = 'Sudah dulu ya! Sampai jumpa!';

/** Keys that only move focus or modify other keys: pressing one is not "doing something". */
const QUIET_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

type RestBreakProps = {
  /** The home button was used: the game is over for now. */
  onHome: () => void;
  /** Anything else was pressed: the rest is acknowledged and play goes on. */
  onContinue: () => void;
};

/**
 * "That is enough for now." Shown after a quarter hour of play.
 *
 * Warm and final in its words, but a nudge in what it does: only the big home
 * button ends the game. Tapping anywhere else, or pressing any key, puts the
 * screen away and play carries on from exactly where it was - a child who is
 * mid-game and will not stop is not locked out, and a grown-up who decides to
 * let them finish does not have to fight the app. The clock starts again, so the
 * nudge returns after another quarter hour.
 *
 * No "play again", no countdown, no reward for staying.
 */
export function RestBreak({ onHome, onContinue }: RestBreakProps) {
  const { playVoice, stopSpeaking } = useAudio();
  // The first arrow key or space must dismiss this screen, not also move the game under it.
  useSwallowGameKeys();

  useEffect(() => {
    stopSpeaking();
    playVoice(stepsFor([{ clip: CLIP_IDS.rest, text: REST_LINE }]));
  }, [playVoice, stopSpeaking]);

  // Any key but the quiet ones carries on - except Enter or space on the home
  // button itself, which is that button being pressed. Listens before anything
  // else does, so it sees the key whatever has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (QUIET_KEYS.has(event.key)) return;
      const onHomeButton = event.target instanceof Element && event.target.closest('[data-rest-home]');
      if (onHomeButton && (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')) return;
      onContinue();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onContinue]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Waktunya istirahat"
      onClick={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-rest-home]')) onContinue();
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-indigo-100 p-6 text-center"
    >
      <Moon aria-hidden="true" className="animate-gentle-bob size-32 text-indigo-500 sm:size-44" strokeWidth={1.8} />
      <div>
        <h2 className="text-4xl font-black text-indigo-900 sm:text-6xl">Sudah dulu ya!</h2>
        <p className="mt-2 text-lg font-bold text-indigo-800 sm:text-2xl">Waktunya istirahat. Main lagi nanti!</p>
      </div>
      <button
        type="button"
        onClick={onHome}
        data-rest-home="true"
        aria-label="Selesai, kembali ke menu"
        autoFocus
        className="toddler-tap flex h-24 items-center justify-center gap-3 rounded-[2rem] bg-indigo-700 px-10 text-3xl font-black text-white shadow-xl outline-none hover:bg-indigo-800 focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95"
      >
        <House aria-hidden="true" className="size-10" strokeWidth={2.6} />
        Selesai
      </button>
      <p className="text-sm font-semibold text-indigo-900">Ketuk di mana saja untuk terus bermain.</p>
    </div>
  );
}
