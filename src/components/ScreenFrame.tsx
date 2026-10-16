import { useState } from 'react';
import type { ReactNode } from 'react';
import { House, Lock, Volume2 } from 'lucide-react';
import { ParentGate } from './ParentGate';
import { usePlay } from '../state/play';

type ScreenFrameProps = {
  title: string;
  onHome: () => void;
  /** Says the instruction again. Shows a speaker button in the header when given. */
  onRepeat?: () => void;
  /** Small line for the grown-up, e.g. progress or a tip. */
  caption?: ReactNode;
  children: ReactNode;
};

/**
 * Shared chrome for every lesson screen: one large, always-in-the-same-place
 * "home" button and a title. Consistent placement matters more than density
 * for this age group - the escape hatch must never move.
 *
 * The home button starts greyed out, with a small lock: until a few games have
 * been played in this module, tapping it asks a grown-up's sum first, and a
 * wrong answer just returns to the game. After that it is an ordinary button.
 * It stays visible and in place the whole time - a locked exit that moved or
 * vanished would be worse than a gated one.
 */
export function ScreenFrame({ title, onHome, onRepeat, caption, children }: ScreenFrameProps) {
  const { homeUnlocked } = usePlay();
  const [asking, setAsking] = useState(false);

  const locked = !homeUnlocked;

  return (
    <div className="flex min-h-dvh flex-col bg-amber-50">
      <header className="flex items-center gap-4 px-4 pt-4 sm:px-6">
        <button
          type="button"
          onClick={locked ? () => setAsking(true) : onHome}
          aria-label="Kembali ke menu utama"
          aria-haspopup={locked ? 'dialog' : undefined}
          data-locked={locked ? 'true' : undefined}
          className={`toddler-tap relative flex size-16 shrink-0 items-center justify-center rounded-3xl shadow-lg ring-2 outline-none focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 sm:size-20 ${
            locked
              ? 'bg-slate-200 text-slate-600 ring-slate-300 hover:bg-slate-200'
              : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          <House className="size-8 sm:size-10" strokeWidth={2.4} />
          {locked && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-slate-600 text-white shadow"
            >
              <Lock className="size-3.5" strokeWidth={3} />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black text-slate-800 sm:text-3xl">{title}</h1>
          {caption && <p className="truncate text-sm font-semibold text-slate-600">{caption}</p>}
        </div>

        {onRepeat && (
          <button
            type="button"
            onClick={onRepeat}
            aria-label="Ulangi perintah"
            className="toddler-tap flex size-16 shrink-0 items-center justify-center rounded-3xl bg-white text-sky-700 shadow-lg ring-2 ring-sky-200 outline-none hover:bg-sky-50 focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 sm:size-20"
          >
            <Volume2 className="size-8 sm:size-10" strokeWidth={2.4} />
          </button>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-6 sm:px-6">
        {children}
      </main>

      {asking && (
        <ParentGate
          onPass={() => {
            setAsking(false);
            onHome();
          }}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  );
}
