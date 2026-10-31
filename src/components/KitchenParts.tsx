import { Bell, Check, CookingPot, Flame, Timer } from 'lucide-react';
import { ingredientOf } from '../data/memasak';
import type { BurnerState, Recipe } from '../data/memasak';
import { CardArt } from './CardArt';
import { memasakPicture } from '../media/pictures';

/* ------------------------------------------------------------------ */
/* The recipe card                                                     */
/* ------------------------------------------------------------------ */

type OrderCardProps = {
  recipe: Recipe;
  /** The step the dish is on; the number of steps means it is done. */
  progress: number;
  /** Mark the step to do next. A child being guided sees it; one who is not has to remember. */
  showNext: boolean;
};

/**
 * One dish and its recipe, in pictures: what goes in, in order, and where it
 * has to cook. Steps that are done are ticked.
 */
export function OrderCard({ recipe, progress, showNext }: OrderCardProps) {
  const finished = progress >= recipe.steps.length;

  return (
    <li
      data-testid="order-card"
      data-done={finished ? 'true' : undefined}
      className={`flex items-center gap-3 rounded-3xl p-3 shadow ring-2 ${
        finished ? 'bg-emerald-50 ring-emerald-400' : 'bg-white ring-slate-200'
      }`}
    >
      <div className="flex w-20 shrink-0 flex-col items-center gap-1 text-center sm:w-24">
        <CardArt
          icon={recipe.icon}
          picture={memasakPicture(`menu/${recipe.id}`)}
          className={`size-11 sm:size-14 ${finished ? 'text-emerald-600' : 'text-orange-600'}`}
          strokeWidth={1.9}
        />
        <span className="text-sm leading-tight font-black text-slate-700">{recipe.name}</span>
      </div>

      <ol aria-label={`Resep ${recipe.name}`} className="flex flex-1 flex-wrap items-center gap-1.5 sm:gap-2">
        {recipe.steps.map((step, i) => {
          const done = i < progress;
          const next = showNext && i === progress;
          const name = step.kind === 'add' ? ingredientOf(step.ingredient).name : `masak ${step.seconds} detik`;

          return (
            <li
              key={i}
              aria-label={`Langkah ${i + 1}: ${name}${done ? ', sudah' : ''}`}
              data-step={i}
              data-state={done ? 'done' : next ? 'next' : 'todo'}
              className={`relative flex size-12 items-center justify-center rounded-2xl ring-2 sm:size-14 ${
                done
                  ? 'bg-emerald-100 ring-emerald-400'
                  : next
                    ? 'animate-gentle-bob bg-amber-100 ring-4 ring-amber-400'
                    : 'bg-slate-50 ring-slate-200'
              }`}
            >
              {step.kind === 'add' ? (
                <CardArt
                  icon={ingredientOf(step.ingredient).icon}
                  picture={memasakPicture(`bahan/${step.ingredient}`)}
                  className={`size-7 sm:size-8 ${done ? 'text-emerald-700 opacity-60' : 'text-slate-700'}`}
                  strokeWidth={1.9}
                />
              ) : (
                <span aria-hidden="true" className={`flex flex-col items-center ${done ? 'text-emerald-700 opacity-60' : 'text-orange-600'}`}>
                  <Flame className="size-6 sm:size-7" strokeWidth={2.2} />
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
/* The stove                                                           */
/* ------------------------------------------------------------------ */

type BurnerButtonProps = {
  /** From 1. */
  number: number;
  state: BurnerState;
  /** How far the cooking has got, 0 to 1. */
  progress: number;
  /** Seconds left while cooking. */
  secondsLeft: number;
  /** What is cooking, for the label. */
  dish: Recipe | null;
  hinted: boolean;
  onClick: () => void;
};

const RING = 2 * Math.PI * 44;

/**
 * A burner. Empty, it waits for a pot; cooking, a ring fills up and counts the
 * seconds; ready, it rings and pulses; and if it is left too long it burns.
 */
export function BurnerButton({ number, state, progress, secondsLeft, dish, hinted, onClick }: BurnerButtonProps) {
  const label =
    state === 'empty'
      ? `Kompor ${number}, kosong`
      : state === 'cooking'
        ? `Kompor ${number}, memasak ${dish?.name}, ${secondsLeft} detik lagi`
        : state === 'ready'
          ? `Kompor ${number}, ${dish?.name} sudah matang, ketuk untuk mengangkat`
          : `Kompor ${number}, ${dish?.name} gosong, ketuk untuk membuang`;

  const Icon = dish?.icon ?? CookingPot;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-state={state}
      data-hint={hinted ? 'true' : undefined}
      className={`toddler-tap relative flex size-28 items-center justify-center rounded-full shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:size-32 ${
        state === 'ready'
          ? 'animate-gentle-bob bg-emerald-100 ring-4 ring-emerald-500'
          : state === 'burnt'
            ? 'bg-slate-700 ring-4 ring-rose-500'
            : state === 'cooking'
              ? 'bg-orange-100 ring-4 ring-orange-400'
              : 'bg-slate-200 ring-2 ring-slate-300'
      } ${hinted ? 'ring-4 ring-amber-400! animate-gentle-bob' : ''}`}
    >
      <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" className="text-black/10" />
        {state === 'cooking' && (
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#ea580c"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - progress)}
          />
        )}
      </svg>

      {state === 'empty' && <CookingPot aria-hidden="true" className="size-12 text-slate-500" strokeWidth={1.8} />}
      {state === 'cooking' && (
        <span aria-hidden="true" className="flex flex-col items-center text-orange-700">
          <Icon className="size-9" strokeWidth={1.9} />
          <span data-testid="seconds-left" className="text-xl leading-none font-black tabular-nums">
            {secondsLeft}
          </span>
        </span>
      )}
      {state === 'ready' && (
        <span aria-hidden="true" className="flex flex-col items-center text-emerald-700">
          <Icon className="size-9" strokeWidth={1.9} />
          <Bell className="size-6" strokeWidth={2.6} />
        </span>
      )}
      {state === 'burnt' && <Flame aria-hidden="true" className="size-12 text-rose-400" strokeWidth={2} />}
    </button>
  );
}
