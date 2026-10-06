import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Banknote, Check, RotateCcw } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { CardArt } from '../components/CardArt';
import { MoneyPiece } from '../components/MoneyPiece';
import {
  CHANGE_PIECES,
  CHECKOUTS,
  PIECE_LOOK,
  changeOwed,
  changeSteps,
  formatNumber,
  formatRupiah,
  judgeChange,
  rupiahWords,
} from '../data/money';
import { CHEER_PROSODY, useAudio } from '../hooks/useAudio';
import {
  changeLine,
  paidLine,
  priceLine,
  promptLine,
  stepsFor,
  totalLine,
  wrongLine,
} from '../media/moneyVoice';
import { moneyPicture, shopPicture } from '../media/pictures';

type KasirScreenProps = {
  onHome: () => void;
};

/**
 * How long "Salah, hitung kembali" stays up before the count clears itself.
 * Long enough to read the mistake and hear the words; short enough that a
 * small child is not left staring at a frozen tray.
 */
export const WRONG_RESET_MS = 2600;

/**
 * Kasir - giving change.
 *
 * A customer buys something and pays with a bigger note. The child works out
 * what they are owed (what was paid, less the price) and hands it back from a
 * tray of four pieces: Rp 500, 1.000, 2.000 and 5.000.
 *
 * All four pieces are always on offer, so giving too much is possible - and
 * that is the point. A tray that only showed pieces that fit would make every
 * answer correct and the sum something the child is handed, not something they
 * work out. Instead the app tallies the change given so far, shows and says
 * only that total, and answers "Salah, hitung kembali" the moment it passes
 * what is owed, then clears the count so the child can try again.
 *
 * The amount owed is shown as "?" until the child gets it right.
 */
export function KasirScreen({ onHome }: KasirScreenProps) {
  const { playVoice, praiseStep, playCoin, playRegister, playNudge, playTap } = useAudio();

  const [round, setRound] = useState(0);
  /** Bumped on a reset, so the same customer is announced again. */
  const [attempt, setAttempt] = useState(0);
  /** The pieces handed back so far, in order. */
  const [pieces, setPieces] = useState<number[]>([]);

  const checkout = CHECKOUTS[round % CHECKOUTS.length];
  const { price, paid } = checkout;
  const owed = changeOwed(checkout);

  const steps = useMemo(() => changeSteps(pieces), [pieces]);
  const given = steps.length > 0 ? steps[steps.length - 1].total : 0;
  const verdict = judgeChange(given, owed);
  const done = verdict === 'exact';
  const over = verdict === 'over';

  // The instruction is spoken, not just written: a pre-reader cannot read
  // "Harga Rp 3.000", so the customer announces themselves out loud.
  useEffect(() => {
    playVoice(stepsFor([...priceLine(price), ...paidLine(paid), ...promptLine()]));
  }, [round, attempt, price, paid, playVoice]);

  // After a wrong count the sum stays on screen long enough to see, then clears.
  // Derived from `over` rather than separate state, so a manual reset (which
  // empties the pieces) cancels the timer for free.
  useEffect(() => {
    if (!over) return;
    const id = window.setTimeout(() => setPieces([]), WRONG_RESET_MS);
    return () => window.clearTimeout(id);
  }, [over]);

  const handlePiece = useCallback(
    (piece: number) => {
      if (done || over) return;

      const total = given + piece;
      const result = judgeChange(total, owed);
      setPieces((prev) => [...prev, piece]);

      if (result === 'over') {
        // Too much. A soft nudge and the words, never a buzzer - being wrong
        // here should feel like "let's try again", not like a penalty.
        playNudge();
        playVoice(stepsFor(wrongLine()));
      } else if (result === 'exact') {
        // The change is right. The register opens - a separate audio channel,
        // so it rings under the announcement - and the total is announced and
        // praised as one uninterrupted run.
        playCoin();
        playRegister();
        playVoice([...stepsFor(changeLine(owed), CHEER_PROSODY), praiseStep()]);
      } else {
        // Still short: say only the change handed over so far.
        playCoin();
        playVoice(stepsFor(totalLine(total)));
      }
    },
    [done, given, over, owed, playCoin, playNudge, playRegister, playVoice, praiseStep],
  );

  const handleReset = useCallback(() => {
    playTap();
    setPieces([]);
    setAttempt((a) => a + 1);
  }, [playTap]);

  const handleNext = useCallback(() => {
    playTap();
    setPieces([]);
    setRound((r) => r + 1);
  }, [playTap]);

  return (
    <ScreenFrame
      title="Kasir"
      onHome={onHome}
      caption={done ? 'Kembaliannya sudah benar!' : 'Berikan kembaliannya'}
    >
      {done && (
        <Celebration
          key={`${round}-${attempt}`}
          headline={formatRupiah(owed)}
          subline={`Kembaliannya ${rupiahWords(owed)} rupiah!`}
        />
      )}

      <div className="flex w-full max-w-xl flex-col gap-4">
        {/* Who is at the till, and what they are paying with. */}
        <section aria-label="Pembeli" className="grid grid-cols-2 gap-3">
          {/* `whitespace-nowrap` and the smaller phone sizes are what keep "Rp 10.000"
              on one line in a half-width card - split across two, it reads as two numbers. */}
          <div className="flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow ring-1 ring-slate-200 sm:gap-3 sm:p-3">
            <CardArt
              icon={checkout.icon}
              picture={shopPicture(checkout.item)}
              className="size-9 shrink-0 text-rose-500 sm:size-16"
              strokeWidth={1.8}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-500">{checkout.item}</div>
              <div className="text-xs font-bold tracking-wide text-slate-400 uppercase">Harga</div>
              <div className="text-lg font-black whitespace-nowrap text-slate-800 tabular-nums sm:text-2xl">
                {formatRupiah(price)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow ring-1 ring-slate-200 sm:gap-3 sm:p-3">
            <CardArt
              icon={Banknote}
              picture={moneyPicture(paid)}
              className="size-9 shrink-0 text-emerald-600 sm:size-16"
              strokeWidth={1.8}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-500">Pembeli</div>
              <div className="text-xs font-bold tracking-wide text-slate-400 uppercase">Dibayar</div>
              <div className="text-lg font-black whitespace-nowrap text-slate-800 tabular-nums sm:text-2xl">
                {formatRupiah(paid)}
              </div>
            </div>
          </div>
        </section>

        {/* The register's display: the change handed over so far. Nothing else. */}
        <div aria-live="polite" className="rounded-2xl bg-slate-900 px-5 py-3 shadow-inner">
          <div className="text-xs font-bold tracking-wide text-slate-400 uppercase">Kembalian diberikan</div>
          <div
            key={given}
            className={`animate-pop-in text-right font-mono text-5xl font-black tabular-nums sm:text-6xl ${
              over ? 'text-rose-400' : done ? 'text-amber-300' : 'text-emerald-400'
            }`}
          >
            {formatRupiah(given)}
          </div>
        </div>

        {over && (
          <p
            role="alert"
            className="animate-pop-in rounded-2xl bg-rose-100 px-4 py-3 text-center text-xl font-black text-rose-700 ring-2 ring-rose-300"
          >
            Salah, hitung kembali
          </p>
        )}

        {/* The sum, written out one line at a time. */}
        <section
          aria-label="Cara menghitung kembalian"
          className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 shadow-sm"
        >
          <h2 className="mb-2 text-xs font-black tracking-wide text-slate-500 uppercase">Cara menghitung</h2>

          <ol className="flex flex-col gap-2 font-mono text-base font-bold text-slate-700 sm:text-lg">
            <li>
              <span className="sr-only">
                {`Soal: dibayar ${formatNumber(paid)} dikurangi harga ${formatNumber(price)}, berapa kembaliannya?`}
              </span>
              <span aria-hidden="true" className="text-slate-500">
                Soal:{' '}
                <span className="text-slate-800">
                  {formatNumber(paid)} &minus; {formatNumber(price)} = {done ? formatNumber(owed) : '?'}
                </span>
              </span>
            </li>

            {steps.map((step, i) => {
              // Only the last step can be the one that went over.
              const tooMuch = over && i === steps.length - 1;
              return (
                <li key={i} className="animate-pop-in">
                  {/* One sentence for assistive tech; the pieces below are only for the eye. */}
                  <span className="sr-only">
                    {`Langkah ${i + 1}: ${formatNumber(step.from)} ditambah ${formatNumber(step.add)} sama dengan ${formatNumber(step.total)}`}
                  </span>
                  <span aria-hidden="true" className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm text-white ${
                        tooMuch ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span>{formatNumber(step.from)}</span>
                    <span className="text-slate-400">+</span>
                    <span
                      className={`rounded-lg bg-gradient-to-br px-2 py-0.5 text-white ${PIECE_LOOK[step.add].theme}`}
                    >
                      {formatNumber(step.add)}
                    </span>
                    <span className="text-slate-400">=</span>
                    <span className={tooMuch ? 'text-rose-600' : 'text-emerald-700'}>{formatNumber(step.total)}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          {done && (
            <div className="animate-pop-in mt-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
              <span className="sr-only">
                {`Kembalian: ${formatNumber(paid)} dikurangi ${formatNumber(price)} sama dengan ${formatNumber(owed)}`}
              </span>
              <div aria-hidden="true">
                <div className="text-xs font-black tracking-wide text-emerald-700 uppercase">Kembalian</div>
                <div className="font-mono text-lg font-black text-emerald-800 sm:text-xl">
                  {formatNumber(paid)} &minus; {formatNumber(price)} = {formatNumber(owed)}
                </div>
                {pieces.length > 1 && (
                  <div className="font-mono text-sm font-bold text-emerald-700">
                    {pieces.map(formatNumber).join(' + ')} = {formatNumber(owed)}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* What to hand back - or, once it is right, what to do next. The same
            four pieces in the same places for every customer. */}
        {!done && (
          <section aria-label="Uang kembalian" className="flex flex-col items-center gap-3">
            <p className="text-sm font-bold text-slate-500">Ketuk uang untuk menambah</p>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
              {CHANGE_PIECES.map((piece) => (
                <MoneyPiece key={piece} amount={piece} disabled={over} onClick={() => handlePiece(piece)} />
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center justify-center gap-4">
          {pieces.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              aria-label="Ulangi hitungan"
              className="toddler-tap flex size-20 items-center justify-center rounded-3xl bg-white text-slate-600 shadow-lg ring-2 ring-slate-200 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95"
            >
              <RotateCcw className="size-9" strokeWidth={2.6} />
            </button>
          )}

          {done && (
            <button
              type="button"
              onClick={handleNext}
              aria-label="Pembeli berikutnya"
              className="toddler-tap flex h-20 items-center justify-center gap-3 rounded-3xl bg-emerald-500 px-8 text-2xl font-black text-white shadow-xl outline-none hover:bg-emerald-600 focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95"
            >
              <Check className="size-8" strokeWidth={3} />
              Lanjut
              <ArrowRight className="size-8" strokeWidth={3} />
            </button>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}
