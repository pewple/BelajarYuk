import { ArrowRight, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NextButtonProps = {
  /** What a screen reader hears, e.g. "Labirin berikutnya". */
  label: string;
  onClick: () => void;
  /**
   * True once the round is done: green, with a tick. False is a plain grey
   * "skip" - still there, because a child who has had enough must be able to
   * move on - but nothing to be proud of.
   */
  ready?: boolean;
};

/**
 * "Lanjut": on to the next round. The same big button in every game, in the
 * same place, so it never has to be found again.
 */
export function NextButton({ label, onClick, ready = true }: NextButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`toddler-tap flex h-16 items-center justify-center gap-2 rounded-3xl px-5 text-xl font-black text-white shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:h-20 sm:gap-3 sm:px-8 sm:text-2xl ${
        ready ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-500 hover:bg-slate-600'
      }`}
    >
      {ready && <Check className="size-8" strokeWidth={3} />}
      Lanjut
      <ArrowRight className="size-8" strokeWidth={3} />
    </button>
  );
}

type IconButtonProps = {
  label: string;
  onClick: () => void;
  icon: LucideIcon;
  /** Blue for "show me how", grey for the rest. */
  tone?: 'neutral' | 'help';
};

/** A square button with just a picture: start over, show me how. */
export function IconButton({ label, onClick, icon: Icon, tone = 'neutral' }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`toddler-tap flex size-16 items-center justify-center rounded-3xl bg-white shadow-lg ring-2 outline-none focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 sm:size-20 ${
        tone === 'help'
          ? 'text-sky-700 ring-sky-200 hover:bg-sky-50'
          : 'text-slate-600 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      <Icon className="size-9" strokeWidth={2.6} />
    </button>
  );
}
