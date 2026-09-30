import type { ReactNode } from 'react';
import { House } from 'lucide-react';

type ScreenFrameProps = {
  title: string;
  onHome: () => void;
  /** Small line for the grown-up, e.g. progress or a tip. */
  caption?: ReactNode;
  children: ReactNode;
};

/**
 * Shared chrome for every lesson screen: one large, always-in-the-same-place
 * "home" button and a title. Consistent placement matters more than density
 * for this age group - the escape hatch must never move.
 */
export function ScreenFrame({ title, onHome, caption, children }: ScreenFrameProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-amber-50">
      <header className="flex items-center gap-4 px-4 pt-4 sm:px-6">
        <button
          type="button"
          onClick={onHome}
          aria-label="Kembali ke menu utama"
          className="toddler-tap flex size-16 shrink-0 items-center justify-center rounded-3xl bg-white text-slate-700 shadow-lg ring-2 ring-slate-200 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 sm:size-20"
        >
          <House className="size-8 sm:size-10" strokeWidth={2.4} />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black text-slate-800 sm:text-3xl">{title}</h1>
          {caption && <p className="truncate text-sm font-semibold text-slate-500">{caption}</p>}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
