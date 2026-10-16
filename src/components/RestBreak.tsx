import { useEffect } from 'react';
import { House, Moon } from 'lucide-react';
import { useAudio } from '../hooks/useAudio';
import { useSwallowGameKeys } from '../hooks/useSwallowGameKeys';
import { CLIP_IDS } from '../media/clips';
import { stepsFor } from '../media/voiceParts';

export const REST_LINE = 'Sudah dulu ya! Sampai jumpa!';

type RestBreakProps = {
  /** The child (or grown-up) tapped the big button. */
  onDone: () => void;
};

/**
 * "That is enough for now." Shown after a quarter hour of play.
 *
 * Warm and final, never a punishment: a sleepy moon, a spoken goodbye, one
 * big button. No "play again", no countdown, no reward for staying - the whole
 * point is that the way forward is away from the screen.
 */
export function RestBreak({ onDone }: RestBreakProps) {
  const { playVoice, stopSpeaking } = useAudio();
  useSwallowGameKeys();

  useEffect(() => {
    stopSpeaking();
    playVoice(stepsFor([{ clip: CLIP_IDS.rest, text: REST_LINE }]));
  }, [playVoice, stopSpeaking]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Waktunya istirahat"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-indigo-100 p-6 text-center"
    >
      <Moon aria-hidden="true" className="animate-gentle-bob size-32 text-indigo-500 sm:size-44" strokeWidth={1.8} />
      <div>
        <h2 className="text-4xl font-black text-indigo-900 sm:text-6xl">Sudah dulu ya!</h2>
        <p className="mt-2 text-lg font-bold text-indigo-800 sm:text-2xl">Waktunya istirahat. Main lagi nanti!</p>
      </div>
      <button
        type="button"
        onClick={onDone}
        aria-label="Selesai, kembali ke menu"
        autoFocus
        className="toddler-tap flex h-24 items-center justify-center gap-3 rounded-[2rem] bg-indigo-700 px-10 text-3xl font-black text-white shadow-xl outline-none hover:bg-indigo-800 focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95"
      >
        <House aria-hidden="true" className="size-10" strokeWidth={2.6} />
        Selesai
      </button>
    </div>
  );
}
