import type { LetterLang } from '../hooks/useAudio';

type LangToggleProps = {
  value: LetterLang;
  onChange: (next: LetterLang) => void;
};

const OPTIONS: { id: LetterLang; label: string; sub: string }[] = [
  { id: 'id', label: 'ID', sub: 'Indonesia' },
  { id: 'en', label: 'EN', sub: 'English' },
];

/**
 * Picks which language the *letter names* are spoken in.
 *
 * Indonesian and English disagree on most letter names - B is "be" vs "bee",
 * G is "ge" vs "jee", H is "ha" vs "aitch" - and a device with no id-ID
 * voice installed will read the Indonesian spellings with an English accent
 * anyway. Rather than guess, this hands the choice to the grown-up.
 *
 * Only letter names follow this setting; Indonesian words are always spoken
 * in Indonesian.
 */
export function LangToggle({ value, onChange }: LangToggleProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-bold tracking-wide text-slate-400 uppercase">Suara huruf</span>
      <div
        role="radiogroup"
        aria-label="Bahasa pengucapan huruf"
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
              aria-label={`Ucapkan huruf dalam bahasa ${option.sub}`}
              onClick={() => onChange(option.id)}
              className={`toddler-tap flex h-12 min-w-20 items-center justify-center rounded-xl px-4 text-lg font-black outline-none focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 ${
                active
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
