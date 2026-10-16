import type { Token } from '../data/pola';

type PolaTokenProps = {
  token: Token;
  className?: string;
};

/**
 * One coloured shape: a red circle, a blue square, a yellow triangle, a green
 * star. Drawn with a dark outline so every shape reads against a white tile -
 * yellow on white has almost no contrast on its own - and so each is told apart
 * by form as well as by colour.
 */
export function PolaToken({ token, className }: PolaTokenProps) {
  const paint = { fill: token.fill, stroke: '#1e293b', strokeWidth: 2.5, strokeLinejoin: 'round' as const };

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      {token.shape === 'circle' && <circle cx="24" cy="24" r="19" {...paint} />}
      {token.shape === 'square' && <rect x="6" y="6" width="36" height="36" rx="5" {...paint} />}
      {token.shape === 'triangle' && <path d="M24 5 44 41H4Z" {...paint} />}
      {token.shape === 'star' && (
        <path d="m24 4 5.6 13.2 14.2 1.2-10.8 9.4 3.3 13.9L24 34.3 11.7 41.7 15 27.8 4.2 18.4l14.2-1.2Z" {...paint} />
      )}
    </svg>
  );
}
