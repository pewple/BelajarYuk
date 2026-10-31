import { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, Keyboard, ShieldQuestion } from 'lucide-react';
import { useSwallowGameKeys } from '../hooks/useSwallowGameKeys';

type ParentGateProps = {
  /** The right answer was given. */
  onPass: () => void;
  /** Wrong answer, or the grown-up changed their mind: back to the game. */
  onCancel: () => void;
};

/** Two numbers from 3 to 9 that make a two-digit sum: no single-key guess works. */
function newSum(random: () => number = Math.random): { a: number; b: number } {
  for (;;) {
    const a = 3 + Math.floor(random() * 7);
    const b = 3 + Math.floor(random() * 7);
    if (a + b >= 10) return { a, b };
  }
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** Is a mouse or trackpad the main pointer, as on a computer? A phone or tablet is "coarse". */
function hasFinePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: fine)').matches
    : false;
}

/**
 * A small sum that stands between a toddler and a way out of the game.
 *
 * It is not security - it only has to be something a three-year-old cannot do
 * and a parent can do without thinking. The answer takes two digits, so
 * mashing keys at random almost never passes.
 *
 * There is no "check" button: the moment the last digit goes in the answer is
 * judged. Right, and the grown-up is out; wrong, and it drops straight back to
 * the game - no second try on the same sum, no scolding.
 *
 * The digits can be tapped on the pad or, on a computer, typed. It listens to
 * the keyboard itself rather than owning a text field, so a phone never pulls
 * up its on-screen keyboard over the pad.
 *
 * It is silent. A spoken sum would draw the child's attention to the very
 * thing meant to be out of their way.
 */
export function ParentGate({ onPass, onCancel }: ParentGateProps) {
  const [{ a, b }] = useState(() => newSum());
  const answer = String(a + b);
  const [typed, setTyped] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  // The latest answer typed, for keys that arrive faster than React renders.
  const typedRef = useRef('');
  // Once judged the gate is over: a stray key in the same tick must not judge it twice.
  const judged = useRef(false);

  useSwallowGameKeys();

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const press = useCallback(
    (digit: string) => {
      if (judged.current || typedRef.current.length >= answer.length) return;
      const next = typedRef.current + digit;
      typedRef.current = next;
      setTyped(next);

      if (next.length === answer.length) {
        judged.current = true;
        if (next === answer) onPass();
        else onCancel();
      }
    },
    [answer, onCancel, onPass],
  );

  const erase = useCallback(() => {
    if (judged.current) return;
    typedRef.current = typedRef.current.slice(0, -1);
    setTyped(typedRef.current);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        erase();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [erase, onCancel, press]);

  const keyClass =
    'flex h-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl font-black text-slate-800 shadow ring-1 ring-slate-300 outline-none hover:bg-slate-200 focus-visible:ring-4 focus-visible:ring-sky-500 active:scale-95';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Khusus orang tua"
        tabIndex={-1}
        className="flex w-full max-w-sm flex-col gap-4 rounded-[2rem] bg-white p-5 shadow-2xl outline-none"
      >
        <div className="flex items-center gap-3">
          <ShieldQuestion aria-hidden="true" className="size-9 shrink-0 text-slate-600" strokeWidth={2.2} />
          <div>
            <h2 className="text-xl font-black text-slate-800">Khusus orang tua</h2>
            <p className="text-sm font-semibold text-slate-600">Jawab soal ini untuk keluar dari permainan.</p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 px-4 py-3 text-right font-mono text-4xl font-black text-white tabular-nums">
          <span className="sr-only">{`Soal: ${a} ditambah ${b}. Jawaban Anda: ${typed || 'kosong'}. `}</span>
          <span aria-hidden="true">
            {a} + {b} = <span className="text-emerald-300">{typed || '?'}</span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((digit) => (
            <button key={digit} type="button" onClick={() => press(digit)} className={keyClass}>
              {digit}
            </button>
          ))}
          <button type="button" onClick={erase} aria-label="Hapus" className={keyClass}>
            <Delete aria-hidden="true" className="size-7" strokeWidth={2.4} />
          </button>
          <button type="button" onClick={() => press('0')} className={`${keyClass} col-span-2`}>
            0
          </button>
        </div>

        {hasFinePointer() && (
          <p className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
            <Keyboard aria-hidden="true" className="size-5" strokeWidth={2.2} />
            Bisa juga diketik dengan papan ketik.
          </p>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="flex h-16 items-center justify-center rounded-2xl bg-amber-100 px-4 text-lg font-black text-amber-900 ring-2 ring-amber-300 outline-none hover:bg-amber-200 focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95"
        >
          Kembali bermain
        </button>
      </div>
    </div>
  );
}
