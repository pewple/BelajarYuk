import { useEffect, useMemo, useState } from 'react';
import { PartyPopper } from 'lucide-react';

const CONFETTI_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#a855f7', '#ec4899',
];

const PIECE_COUNT = 28;

/**
 * How long the headline card stays up. Long enough to read and hear, short
 * enough that the child gets the objects they just counted back on screen.
 */
const HEADLINE_MS = 1900;

type CelebrationProps = {
  /** Big word shown in the middle, e.g. the number that was just counted. */
  headline?: string;
  /** Smaller line under the headline. */
  subline?: string;
};

/**
 * Positive reinforcement overlay: falling confetti plus a bouncing badge.
 *
 * Purely decorative and pointer-transparent, so a child who taps "through"
 * it still hits the button underneath. Mount it with a changing `key` to
 * replay the animation.
 */
export function Celebration({ headline, subline }: CelebrationProps) {
  const [showHeadline, setShowHeadline] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setShowHeadline(false), HEADLINE_MS);
    return () => window.clearTimeout(id);
  }, []);

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        drift: Math.round((Math.random() - 0.5) * 160),
        spin: Math.round(360 + Math.random() * 720),
        delay: Math.random() * 0.45,
        duration: 1.5 + Math.random() * 1.1,
        size: 8 + Math.random() * 12,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.5,
      })),
    [],
  );

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
      data-testid="celebration"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="animate-confetti absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.4}px`,
            backgroundColor: p.color,
            borderRadius: p.round ? '9999px' : '3px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        />
      ))}

      {showHeadline && (headline || subline) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pop-in flex flex-col items-center gap-3 rounded-[2.5rem] bg-white/92 px-10 py-8 shadow-2xl ring-4 ring-amber-300">
            <PartyPopper className="animate-wiggle size-16 text-amber-500" strokeWidth={2.2} />
            {headline && (
              <span className="text-6xl font-black tracking-tight text-emerald-700 sm:text-7xl">
                {headline}
              </span>
            )}
            {subline && <span className="text-xl font-bold text-slate-600">{subline}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
