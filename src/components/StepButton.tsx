import { ChevronLeft, ChevronRight } from 'lucide-react';

type StepButtonProps = {
  direction: 'prev' | 'next';
  onClick: () => void;
  label: string;
};

/**
 * Previous / next control. Oversized and colour-coded so a child can drive
 * the lesson without a grown-up pointing at the right spot.
 */
export function StepButton({ direction, onClick, label }: StepButtonProps) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="toddler-tap flex size-20 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-xl ring-2 ring-slate-200 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 sm:size-24"
    >
      <Icon className="size-12 sm:size-14" strokeWidth={3} />
    </button>
  );
}
