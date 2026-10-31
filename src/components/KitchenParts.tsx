import type { ReactNode } from 'react';
import { ArrowRight, Bell, Check, CookingPot, Flame, Frown, Meh, Smile, Timer, UserRound, X } from 'lucide-react';
import { TASTES, dishBase, ingredientOf } from '../data/memasak';
import type { BurnerState, Customer as CustomerData, Mood, Recipe, Step } from '../data/memasak';
import { memasakPicture } from '../media/pictures';
import { CardArt } from './CardArt';
import { CounterBell, Spoon } from './drawnIcons';

/* ------------------------------------------------------------------ */
/* The customer                                                        */
/* ------------------------------------------------------------------ */

type ServiceBellProps = {
  hinted: boolean;
  onClick: () => void;
};

/** The bell on the counter. Nothing else is there until it has been rung. */
export function ServiceBell({ hinted, onClick }: ServiceBellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Bel layanan"
      data-hint={hinted ? 'true' : undefined}
      className={`toddler-tap animate-gentle-bob flex size-48 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-2xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 ${
        hinted ? 'ring-8 ring-amber-300' : 'ring-4 ring-amber-200'
      }`}
    >
      <CounterBell aria-hidden="true" className="size-28" strokeWidth={1.8} />
    </button>
  );
}

type CustomerBarProps = {
  customer: CustomerData;
  /** How much of their patience is left, 0 to 1. */
  left: number;
  mood: Mood;
  /** Served: they are happy whatever the bar says. */
  served: boolean;
  /** What they like, at the levels where it matters. */
  wish?: Recipe['wish'];
};

const MOODS = { happy: Smile, waiting: Meh, upset: Frown } as const;

/**
 * The customer at the counter, with the bar of how long they will wait: it
 * empties, and their face goes from a smile to a frown as it does. A customer
 * who has been served smiles.
 */
export function CustomerBar({ customer, left, mood, served, wish }: CustomerBarProps) {
  const Face = served ? Smile : MOODS[mood];
  const face = served ? 'happy' : mood;

  return (
    <section
      aria-label="Pelanggan"
      data-testid="customer"
      data-mood={face}
      className="animate-pop-in flex items-center gap-3 rounded-3xl bg-white p-3 shadow ring-2 ring-slate-200"
    >
      <div className="relative shrink-0">
        <span className={`flex size-16 items-center justify-center rounded-full ${customer.tint}`}>
          <UserRound aria-hidden="true" className="size-10" strokeWidth={2} />
        </span>
        <span
          aria-hidden="true"
          className={`absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full text-white shadow ${
            face === 'happy' ? 'bg-emerald-600' : face === 'waiting' ? 'bg-amber-600' : 'bg-rose-600'
          }`}
        >
          <Face className="size-5" strokeWidth={2.6} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-black text-slate-700">{customer.name}</div>
        {!served && (
          <div
            role="progressbar"
            aria-label="Kesabaran pelanggan"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(left * 100)}
            className="mt-1 h-4 w-full overflow-hidden rounded-full bg-slate-200"
          >
            <div
              data-testid="patience"
              className={`h-full rounded-full ${face === 'happy' ? 'bg-emerald-500' : face === 'waiting' ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.round(left * 100)}%` }}
            />
          </div>
        )}
      </div>

      {wish && (
        <div
          data-testid="wish"
          role="img"
          aria-label={`${wish.likes ? 'Suka' : 'Tidak suka'} ${TASTES[wish.taste].name.toLowerCase()}`}
          className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl bg-orange-50 ring-2 ring-orange-200"
        >
          <WishIcon taste={wish.taste} className="size-9 text-orange-600" />
          <span
            aria-hidden="true"
            className={`absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full text-white ${
              wish.likes ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {wish.likes ? <Check className="size-4" strokeWidth={4} /> : <X className="size-4" strokeWidth={4} />}
          </span>
        </div>
      )}
    </section>
  );
}

function WishIcon({ taste, className }: { taste: keyof typeof TASTES; className: string }) {
  const Icon = TASTES[taste].icon;
  return <Icon aria-hidden="true" className={className} strokeWidth={2} />;
}

/* ------------------------------------------------------------------ */
/* The recipe card                                                     */
/* ------------------------------------------------------------------ */

type OrderCardProps = {
  recipe: Recipe;
  /** The step the dish is on; the number of steps means it is done. */
  progress: number;
  /** How many times the dish has been stirred in its stirring step. */
  stirred: number;
  /** Mark the step to do next. A child being guided sees it; one who is not has to remember. */
  showNext: boolean;
  /** The pot, and the spoon: this dish's own buttons, in line with its recipe. */
  actions?: ReactNode;
};

function stepName(step: Step): string {
  switch (step.kind) {
    case 'add':
      return step.branch
        ? `kalau suka ${TASTES[step.branch.taste].name.toLowerCase()}, ${ingredientOf(step.branch.yes).name}; kalau tidak, ${ingredientOf(step.branch.no).name}`
        : ingredientOf(step.ingredient).name;
    case 'stir':
      return `aduk ${step.times} kali`;
    case 'cook':
      return `masak ${step.seconds} detik`;
  }
}

/**
 * One dish and its recipe, in pictures: what goes in, in order, where it has to
 * be stirred and cooked - and its own pot and spoon at the end of the row.
 * Steps that are done are ticked.
 */
export function OrderCard({ recipe, progress, stirred, showNext, actions }: OrderCardProps) {
  const finished = progress >= recipe.steps.length;

  return (
    <li
      data-testid="order-card"
      data-done={finished ? 'true' : undefined}
      className={`flex items-center gap-2 rounded-3xl p-2.5 shadow ring-2 sm:gap-3 sm:p-3 ${
        finished ? 'bg-emerald-50 ring-emerald-400' : 'bg-white ring-slate-200'
      }`}
    >
      <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-center sm:w-24">
        <CardArt
          icon={recipe.icon}
          picture={memasakPicture(`menu/${dishBase(recipe)}`)}
          className={`size-10 sm:size-14 ${finished ? 'text-emerald-600' : 'text-orange-600'}`}
          strokeWidth={1.9}
        />
        <span className="text-xs leading-tight font-black text-slate-700 sm:text-sm">{recipe.name}</span>
      </div>

      <ol aria-label={`Resep ${recipe.name}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-2">
        {recipe.steps.map((step, i) => {
          const done = i < progress;
          const next = showNext && i === progress;
          const wide = step.kind === 'add' && step.branch !== undefined;
          const tone = done ? 'text-emerald-700 opacity-60' : 'text-slate-700';

          return (
            <li
              key={i}
              aria-label={`Langkah ${i + 1}: ${stepName(step)}${done ? ', sudah' : ''}`}
              data-step={i}
              data-state={done ? 'done' : next ? 'next' : 'todo'}
              className={`relative flex h-11 items-center justify-center rounded-2xl ring-2 sm:h-14 ${wide ? 'w-24 sm:w-28' : 'w-11 sm:w-14'} ${
                done
                  ? 'bg-emerald-100 ring-emerald-400'
                  : next
                    ? 'animate-gentle-bob bg-amber-100 ring-4 ring-amber-400'
                    : 'bg-slate-50 ring-slate-200'
              }`}
            >
              {step.kind === 'add' && !step.branch && (
                <CardArt
                  icon={ingredientOf(step.ingredient).icon}
                  picture={memasakPicture(`bahan/${step.ingredient}`)}
                  className={`size-6 sm:size-8 ${tone}`}
                  strokeWidth={1.9}
                />
              )}

              {step.kind === 'add' && step.branch && (
                <span aria-hidden="true" className={`flex flex-col gap-0.5 ${tone}`}>
                  {([true, false] as const).map((likes) => {
                    const Taste = TASTES[step.branch!.taste].icon;
                    const Out = ingredientOf(likes ? step.branch!.yes : step.branch!.no).icon;
                    return (
                      <span key={String(likes)} className="flex items-center gap-0.5">
                        <Taste className="size-4" strokeWidth={2.4} />
                        {likes ? <Check className="size-3 text-emerald-600" strokeWidth={4} /> : <X className="size-3 text-rose-600" strokeWidth={4} />}
                        <ArrowRight className="size-3" strokeWidth={3} />
                        <Out className="size-4" strokeWidth={2.2} />
                      </span>
                    );
                  })}
                </span>
              )}

              {step.kind === 'stir' && (
                <span aria-hidden="true" className={`flex flex-col items-center ${done ? 'text-emerald-700 opacity-60' : 'text-sky-700'}`}>
                  <Spoon className="size-5 sm:size-6" strokeWidth={2.2} />
                  <span className="-mt-0.5 text-[0.7rem] leading-none font-black">
                    {i === progress && stirred > 0 ? `${stirred}/${step.times}` : `×${step.times}`}
                  </span>
                </span>
              )}

              {step.kind === 'cook' && (
                <span aria-hidden="true" className={`flex flex-col items-center ${done ? 'text-emerald-700 opacity-60' : 'text-orange-600'}`}>
                  <Flame className="size-5 sm:size-7" strokeWidth={2.2} />
                  <span className="-mt-0.5 flex items-center gap-0.5 text-[0.7rem] leading-none font-black">
                    <Timer className="size-3" strokeWidth={3} />
                    {step.seconds}
                  </span>
                </span>
              )}

              {done && (
                <Check
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-emerald-600 p-0.5 text-white"
                  strokeWidth={4}
                />
              )}
            </li>
          );
        })}
      </ol>

      {actions && <div className="flex shrink-0 flex-col items-center gap-1.5">{actions}</div>}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* The pantry                                                          */
/* ------------------------------------------------------------------ */

type IngredientButtonProps = {
  id: string;
  /** How many are left. */
  left: number;
  hinted: boolean;
  onClick: () => void;
};

/** One ingredient on the shelf, with a dot for each one left. */
export function IngredientButton({ id, left, hinted, onClick }: IngredientButtonProps) {
  const ingredient = ingredientOf(id);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${ingredient.name}, sisa ${left}`}
      data-left={left}
      data-hint={hinted ? 'true' : undefined}
      className={`toddler-tap flex min-h-24 flex-col items-center justify-center gap-1 rounded-3xl bg-white p-2 shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 ${
        hinted ? 'animate-gentle-bob ring-4 ring-amber-400' : 'ring-2 ring-slate-200'
      } ${left === 0 ? 'opacity-40' : ''}`}
    >
      <CardArt
        icon={ingredient.icon}
        picture={memasakPicture(`bahan/${id}`)}
        className="size-10 text-slate-700 sm:size-12"
        strokeWidth={1.9}
      />
      <span className="text-sm font-black text-slate-700">{ingredient.name}</span>
      <span aria-hidden="true" className="flex h-2.5 items-center gap-1">
        {Array.from({ length: left }, (_, i) => (
          <span key={i} className="size-2.5 rounded-full bg-orange-500" />
        ))}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* A dish's pot and spoon                                              */
/* ------------------------------------------------------------------ */

type BurnerButtonProps = {
  /** From 1: which dish's pot. */
  number: number;
  state: BurnerState;
  /** How far the cooking has got, 0 to 1. */
  progress: number;
  /** Seconds left while cooking. */
  secondsLeft: number;
  /** The dish, for the label and the picture. */
  dish: Recipe;
  hinted: boolean;
  onClick: () => void;
};

const RING = 2 * Math.PI * 44;

/**
 * A dish's pot. Empty, it waits for the dish; cooking, a ring fills up and
 * counts the seconds; ready, it rings and pulses; and if it is left too long it
 * burns.
 */
export function BurnerButton({ number, state, progress, secondsLeft, dish, hinted, onClick }: BurnerButtonProps) {
  const label =
    state === 'empty'
      ? `Kompor ${number}, kosong`
      : state === 'cooking'
        ? `Kompor ${number}, memasak ${dish.name}, ${secondsLeft} detik lagi`
        : state === 'ready'
          ? `Kompor ${number}, ${dish.name} sudah matang, ketuk untuk mengangkat`
          : `Kompor ${number}, ${dish.name} gosong, ketuk untuk membuang`;

  const Icon = dish.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-state={state}
      data-hint={hinted ? 'true' : undefined}
      className={`toddler-tap relative flex size-16 items-center justify-center rounded-full shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:size-20 ${
        state === 'ready'
          ? 'animate-gentle-bob bg-emerald-100 ring-4 ring-emerald-500'
          : state === 'burnt'
            ? 'bg-slate-700 ring-4 ring-rose-500'
            : state === 'cooking'
              ? 'bg-orange-100 ring-4 ring-orange-400'
              : 'bg-slate-200 ring-2 ring-slate-300'
      } ${hinted ? 'animate-gentle-bob ring-4 ring-amber-400!' : ''}`}
    >
      <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="7" className="text-black/10" />
        {state === 'cooking' && (
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#ea580c"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - progress)}
          />
        )}
      </svg>

      {state === 'empty' && <CookingPot aria-hidden="true" className="size-8 text-slate-500 sm:size-10" strokeWidth={1.8} />}
      {state === 'cooking' && (
        <span aria-hidden="true" className="flex flex-col items-center text-orange-700">
          <Icon className="size-6 sm:size-7" strokeWidth={1.9} />
          <span data-testid="seconds-left" className="text-base leading-none font-black tabular-nums sm:text-lg">
            {secondsLeft}
          </span>
        </span>
      )}
      {state === 'ready' && (
        <span aria-hidden="true" className="flex flex-col items-center text-emerald-700">
          <Icon className="size-6 sm:size-7" strokeWidth={1.9} />
          <Bell className="size-4 sm:size-5" strokeWidth={2.6} />
        </span>
      )}
      {state === 'burnt' && <Flame aria-hidden="true" className="size-9 text-rose-400 sm:size-10" strokeWidth={2} />}
    </button>
  );
}

type SpoonButtonProps = {
  /** From 1: which dish's spoon. */
  number: number;
  /** Stirred so far in the stirring step, and how many that step wants. */
  stirred: number;
  times: number;
  /** The dish is waiting to be stirred. */
  waiting: boolean;
  hinted: boolean;
  onClick: () => void;
};

/** A dish's spoon: one tap, one stir. Dots show how many it has had of how many it wants. */
export function SpoonButton({ number, stirred, times, waiting, hinted, onClick }: SpoonButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sendok ${number}, aduk ${stirred} dari ${times}`}
      data-waiting={waiting ? 'true' : undefined}
      data-stirred={stirred}
      data-hint={hinted ? 'true' : undefined}
      className={`toddler-tap flex size-16 flex-col items-center justify-center gap-0.5 rounded-full bg-white shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:size-20 ${
        hinted ? 'animate-gentle-bob ring-4 ring-amber-400' : waiting ? 'ring-4 ring-sky-300' : 'ring-2 ring-slate-300'
      } ${waiting ? '' : 'opacity-60'}`}
    >
      <Spoon aria-hidden="true" className="size-8 text-sky-700 sm:size-9" strokeWidth={2} />
      <span aria-hidden="true" className="flex h-2 items-center gap-0.5">
        {Array.from({ length: times }, (_, i) => (
          <span key={i} className={`size-1.5 rounded-full ${i < stirred ? 'bg-sky-600' : 'bg-slate-300'}`} />
        ))}
      </span>
    </button>
  );
}
