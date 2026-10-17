import { PolaToken } from './PolaToken';
import { TOKENS, boxCells, layoutOf } from '../data/pola';

type PolaBoxProps = {
  /** The box's name: its shapes in reading order, e.g. "merah+biru". */
  id: string;
  className?: string;
};

/**
 * A box of two to four shapes: two or three stacked in a column, four in a
 * two-by-two square.
 *
 * The box is a square frame in every case, so a box of two and a box of four
 * take the same room in the row and in the tray - what tells them apart is what
 * is inside, which is the point.
 */
export function PolaBox({ id, className = '' }: PolaBoxProps) {
  const cells = boxCells(id);
  const { cols, rows } = layoutOf(cells.length);

  return (
    <span
      aria-hidden="true"
      className={`grid aspect-square place-items-center gap-0.5 rounded-xl bg-sky-50 p-1 ring-2 ring-slate-500 sm:gap-1 sm:p-1.5 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {cells.map((cell, i) => (
        <PolaToken key={i} token={TOKENS[cell]} className="size-full max-h-full max-w-full" />
      ))}
    </span>
  );
}
