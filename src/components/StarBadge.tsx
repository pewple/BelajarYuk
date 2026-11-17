import { Star } from 'lucide-react';
import { useWallet } from '../state/stars';

/**
 * How many stars there are to spend, as a gold star and a number.
 *
 * Not a button, and never in the way of one: it only shows. The number pops
 * each time a right answer adds a star, so the child sees the reward land
 * where it is kept.
 */
export function StarBadge({ className = '' }: { className?: string }) {
  const { stars } = useWallet();

  return (
    <div
      role="img"
      aria-label={`${stars} bintang`}
      data-stars={stars}
      className={`flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-amber-700 shadow-md ring-2 ring-amber-200 select-none ${className}`}
    >
      <Star className="size-6 fill-amber-400 text-amber-500 sm:size-7" strokeWidth={2.2} aria-hidden="true" />
      <span key={stars} className="animate-pop-in text-xl font-black tabular-nums sm:text-2xl">
        {stars}
      </span>
    </div>
  );
}
