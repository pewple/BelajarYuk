import type { Script } from '../data/scripts';

type ScriptToggleProps = {
  value: Script;
  onChange: (next: Script) => void;
};

const OPTIONS: { id: Script; label: string; name: string; arabic?: boolean }[] = [
  { id: 'latin', label: 'ABC', name: 'Tulisan Latin' },
  { id: 'arab', label: 'ابت', name: 'Tulisan Arab', arabic: true },
];

/**
 * Chooses how letters and numbers are written: Latin (A B C, 1 2 3) or Arabic
 * (ا ب ت, ١ ٢ ٣).
 *
 * One setting for the whole app, so switching it in any module switches them
 * all, and it is remembered between visits. It sits on the screens where it
 * has an effect - Mengenal Huruf, Berhitung and the maze's choosing screen -
 * and deliberately not on Belajar Bicara (whose word cards are tied to the
 * Latin alphabet) or Kasir (Rupiah is written with Western digits).
 */
export function ScriptToggle({ value, onChange }: ScriptToggleProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-bold tracking-wide text-slate-600 uppercase">Tulisan</span>
      <div
        role="radiogroup"
        aria-label="Jenis tulisan huruf dan angka"
        className="flex gap-1 rounded-2xl bg-white p-1 shadow-md ring-2 ring-slate-200"
      >
        {OPTIONS.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.name}
              onClick={() => onChange(option.id)}
              className={`toddler-tap flex h-16 min-w-20 items-center justify-center rounded-xl px-4 text-lg font-black outline-none focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 ${
                active ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              } ${option.arabic ? 'font-arabic' : ''}`}
            >
              <span lang={option.arabic ? 'ar' : undefined} aria-hidden="true">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
