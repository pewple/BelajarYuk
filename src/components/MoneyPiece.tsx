import { CardArt } from './CardArt';
import { PIECE_LOOK, formatNumber, formatRupiah } from '../data/money';
import { moneyPicture } from '../media/pictures';

type MoneyPieceProps = {
  amount: number;
  onClick: () => void;
  /** Held while a wrong count is being cleared, so a frantic tap cannot land in the wrong round. */
  disabled?: boolean;
};

/**
 * One piece of money in the tray: a big, colour-coded button.
 *
 * It fills whatever grid cell it is given, so the tray's four pieces stay put
 * from the first customer to the last - a toddler learns where the coin is
 * by where it always is.
 */
export function MoneyPiece({ amount, onClick, disabled = false }: MoneyPieceProps) {
  const look = PIECE_LOOK[amount];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Tambah ${formatRupiah(amount)}`}
      className={`toddler-tap flex h-28 w-full flex-col items-center justify-center gap-1 rounded-[2rem] bg-gradient-to-br ${look.theme} px-3 text-white shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 disabled:opacity-40 disabled:active:scale-100 sm:h-36`}
    >
      <CardArt
        icon={look.icon}
        picture={moneyPicture(amount)}
        plate
        className="size-9 drop-shadow sm:size-12"
        strokeWidth={2}
      />
      <span className="text-2xl font-black tabular-nums sm:text-3xl">
        <span className="text-base font-bold opacity-80 sm:text-lg">Rp </span>
        {formatNumber(amount)}
      </span>
    </button>
  );
}
