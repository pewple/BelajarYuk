import type { LucideIcon } from 'lucide-react';

export type ModeChoice<T extends string> = {
  id: T;
  /** The word under the picture, and the button's name for assistive tech. */
  title: string;
  /** Big non-verbal cue a pre-reader can recognise at a glance. */
  glyph: string;
  icon: LucideIcon;
  /** Tailwind gradient classes. */
  theme: string;
};

type ModeChooserProps<T extends string> = {
  /** What the group of buttons is for, for assistive tech. */
  label: string;
  choices: ModeChoice<T>[];
  onChoose: (id: T) => void;
};

/**
 * The screen before a game begins, when there is a choice to make: Huruf or
 * Angka, Baris or Kotak. A few huge buttons, each with a picture, a glyph and a
 * word - the picture and glyph are for the child, the word is for the grown-up
 * and for a screen reader.
 */
export function ModeChooser<T extends string>({ label, choices, onChoose }: ModeChooserProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex w-full max-w-2xl flex-col gap-4 sm:flex-row">
      {choices.map((choice) => {
        const Icon = choice.icon;
        return (
          <button
            key={choice.id}
            type="button"
            onClick={() => onChoose(choice.id)}
            className={`toddler-tap flex h-36 w-full flex-col items-center justify-center gap-2 rounded-[2.5rem] bg-gradient-to-br ${choice.theme} px-3 text-white shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:h-56 sm:flex-1`}
          >
            <Icon aria-hidden="true" className="size-9 sm:size-14" strokeWidth={2.2} />
            <span aria-hidden="true" className="text-3xl font-black tracking-wide drop-shadow-sm sm:text-4xl">
              {choice.glyph}
            </span>
            <span className="text-lg font-bold sm:text-xl">{choice.title}</span>
          </button>
        );
      })}
    </div>
  );
}
