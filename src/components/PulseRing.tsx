type PulseRingProps = {
  /** Gradient classes, matched to the card it expands out of. */
  theme: string;
};

/**
 * The expanding ring that fires when a card is tapped - the "your tap made
 * that sound" cue.
 *
 * Mount it with a changing `key` to replay the animation.
 *
 * `pointer-events-none` is load-bearing. The animation ends with
 * `forwards`, so this span parks permanently at scale(1.6) with opacity 0:
 * invisible, but still hit-testable. Without it the ring silently swallows
 * every tap aimed at the arrows beside the card, and the only way out is a
 * page reload. (The class carries the same rule in CSS as a second guard.)
 */
export function PulseRing({ theme }: PulseRingProps) {
  return (
    <span
      aria-hidden="true"
      className={`animate-pulse-ring pointer-events-none absolute inset-0 rounded-[3rem] bg-gradient-to-br ${theme}`}
    />
  );
}
