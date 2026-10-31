import {
  Apple, Banana, Candy, Carrot, Citrus, Cherry, Cookie, Droplet, Egg, Fish, GlassWater, Milk, Salad, Sandwich, Soup,
  UtensilsCrossed, Wheat,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bread, Cheese, Chili, Noodles, Rice } from '../components/drawnIcons';

/**
 * Memasak - cooking, as a first lesson in doing things in order, in time, and
 * with what you have.
 *
 * A customer rings the bell and orders. A recipe is a short list of steps drawn
 * as pictures: put an ingredient in, stir, or cook for a few seconds. Five
 * levels, each adding one idea:
 *
 *  1. Susun         - the steps in order. Nothing to wait for.
 *  2. Tunggu        - one step is cooking: put the pot on, wait for it to be
 *                     ready, take it off in time.
 *  3. Dua sekaligus - two dishes, each with its own pot: start one cooking, and
 *                     get on with the other while you wait.
 *  4. Aduk          - a step that repeats: stir three times.
 *  5. Kalau         - a step that depends on the customer: if they like it
 *                     spicy, chilli; if not, something else.
 *
 * The pantry is limited. Every ingredient used comes off its count, so a dish
 * that is thrown away (burnt) costs something, and an ingredient can run out.
 * And a customer does not wait for ever.
 *
 * This file is only the rules, with no clock of its own: every function that
 * cares about time is handed `now`. The screen draws it, speaks it and ticks.
 */

/* ------------------------------------------------------------------ */
/* What there is                                                       */
/* ------------------------------------------------------------------ */

export type Ingredient = {
  id: string;
  /** What it is called, and what is said. */
  name: string;
  icon: LucideIcon;
};

export const INGREDIENTS: Ingredient[] = [
  { id: 'roti', name: 'Roti', icon: Bread },
  { id: 'keju', name: 'Keju', icon: Cheese },
  { id: 'telur', name: 'Telur', icon: Egg },
  { id: 'nasi', name: 'Nasi', icon: Rice },
  { id: 'wortel', name: 'Wortel', icon: Carrot },
  { id: 'pisang', name: 'Pisang', icon: Banana },
  { id: 'tepung', name: 'Tepung', icon: Wheat },
  { id: 'mie', name: 'Mie', icon: Noodles },
  { id: 'air', name: 'Air', icon: Droplet },
  { id: 'ikan', name: 'Ikan', icon: Fish },
  { id: 'susu', name: 'Susu', icon: Milk },
  { id: 'apel', name: 'Apel', icon: Apple },
  { id: 'jeruk', name: 'Jeruk', icon: Citrus },
  { id: 'ceri', name: 'Ceri', icon: Cherry },
  { id: 'kue', name: 'Kue', icon: Cookie },
  { id: 'cabai', name: 'Cabai', icon: Chili },
];

export function ingredientOf(id: string): Ingredient {
  const found = INGREDIENTS.find((i) => i.id === id);
  if (!found) throw new Error(`No ingredient "${id}".`);
  return found;
}

/** What a customer may like: it decides what goes into a dish at level 5. */
export type Taste = 'pedas' | 'manis';

export const TASTES: Record<Taste, { name: string; icon: LucideIcon }> = {
  pedas: { name: 'Pedas', icon: Chili },
  manis: { name: 'Manis', icon: Candy },
};

/** Which of two ingredients goes in, by whether the customer likes a taste. */
export type Branch = { taste: Taste; yes: string; no: string };

export type Step =
  /** Put an ingredient in. `branch` is set when the customer's taste chose which. */
  | { kind: 'add'; ingredient: string; branch?: Branch }
  /** Stir, this many times. */
  | { kind: 'stir'; times: number }
  /** Cook for `seconds`: `verb` is what it is called ("goreng"). */
  | { kind: 'cook'; seconds: number; verb: 'panggang' | 'goreng' | 'rebus' };

export type Recipe = {
  id: string;
  /** The dish whose name and picture this is, when one dish comes in several versions. */
  base?: string;
  name: string;
  icon: LucideIcon;
  steps: Step[];
  /** What the customer who ordered it likes (level 5), or does not. */
  wish?: { taste: Taste; likes: boolean };
};

/** The id that a dish's recorded name and picture are filed under. */
export const dishBase = (recipe: Recipe): string => recipe.base ?? recipe.id;

const add = (ingredient: string): Step => ({ kind: 'add', ingredient });
const stir = (times: number): Step => ({ kind: 'stir', times });
const cook = (verb: 'panggang' | 'goreng' | 'rebus', seconds: number): Step => ({ kind: 'cook', seconds, verb });
/** Chilli if the customer likes spicy, something else if not: decided by who is asking. */
const ifLikes = (taste: Taste, likes: boolean, yes: string, no: string): Step => ({
  kind: 'add',
  ingredient: likes ? yes : no,
  branch: { taste, yes, no },
});

/** Level 1: put things in, in order. Two or three ingredients. */
const SUSUN: Recipe[] = [
  { id: 'roti-keju', name: 'Roti keju', icon: Sandwich, steps: [add('roti'), add('keju'), add('roti')] },
  { id: 'nasi-telur', name: 'Nasi telur', icon: UtensilsCrossed, steps: [add('nasi'), add('telur')] },
  { id: 'salad-buah', name: 'Salad buah', icon: Salad, steps: [add('apel'), add('pisang'), add('jeruk')] },
  { id: 'susu-pisang', name: 'Susu pisang', icon: GlassWater, steps: [add('pisang'), add('susu')] },
  { id: 'nasi-ikan', name: 'Nasi ikan', icon: Fish, steps: [add('nasi'), add('ikan')] },
];

/** Level 2: the same, and then wait for it to cook. */
const TUNGGU: Recipe[] = [
  { id: 'roti-panggang', name: 'Roti panggang', icon: Sandwich, steps: [add('roti'), add('keju'), cook('panggang', 3)] },
  { id: 'nasi-goreng', name: 'Nasi goreng', icon: UtensilsCrossed, steps: [add('nasi'), add('telur'), cook('goreng', 4)] },
  { id: 'pisang-goreng', name: 'Pisang goreng', icon: Banana, steps: [add('pisang'), add('tepung'), cook('goreng', 4)] },
  { id: 'sup-wortel', name: 'Sup wortel', icon: Soup, steps: [add('wortel'), add('air'), cook('rebus', 5)] },
  { id: 'telur-rebus', name: 'Telur rebus', icon: Egg, steps: [add('telur'), add('air'), cook('rebus', 4)] },
  { id: 'mie-rebus', name: 'Mie rebus', icon: Soup, steps: [add('mie'), add('air'), add('telur'), cook('rebus', 5)] },
];

const tunggu = (id: string): Recipe => {
  const found = TUNGGU.find((r) => r.id === id);
  if (!found) throw new Error(`No recipe "${id}".`);
  return found;
};

/** Level 3: an order of two dishes, each with a pot of its own. */
const DUA: Recipe[][] = [
  [tunggu('nasi-goreng'), tunggu('telur-rebus')],
  [tunggu('sup-wortel'), tunggu('roti-panggang')],
  [tunggu('mie-rebus'), tunggu('pisang-goreng')],
];

/** Level 4: a step that repeats - stir, so many times - before the cooking. */
const ADUK: Recipe[] = [
  { id: 'bubur-nasi', name: 'Bubur nasi', icon: Soup, steps: [add('nasi'), add('air'), stir(4), cook('rebus', 5)] },
  { id: 'bakwan-wortel', name: 'Bakwan wortel', icon: Carrot, steps: [add('wortel'), add('tepung'), stir(3), cook('goreng', 4)] },
  { id: 'mie-kuah', name: 'Mie kuah', icon: Soup, steps: [add('mie'), add('air'), stir(2), cook('rebus', 5)] },
  { id: 'orak-arik', name: 'Orak-arik telur', icon: Egg, steps: [add('telur'), add('susu'), stir(4), cook('goreng', 3)] },
  { id: 'susu-hangat', name: 'Susu hangat', icon: Milk, steps: [add('susu'), add('pisang'), stir(3), cook('rebus', 3)] },
];

/**
 * Level 5: what goes in depends on the customer. Each is cooked for a customer
 * who likes the taste and one who does not, so the same dish comes twice and the
 * answer is different.
 */
function kalau(recipe: Recipe, taste: Taste, likes: boolean, yes: string, no: string, at: number): Recipe {
  const steps = [...recipe.steps];
  steps.splice(at, 0, ifLikes(taste, likes, yes, no));
  return { ...recipe, id: `${recipe.id}-${taste}-${likes ? 'ya' : 'tidak'}`, base: recipe.id, steps, wish: { taste, likes } };
}

const KALAU: Recipe[] = [
  kalau({ ...tunggu('mie-rebus'), steps: [add('mie'), add('air'), cook('rebus', 5)] }, 'pedas', true, 'cabai', 'telur', 2),
  kalau({ ...tunggu('nasi-goreng'), steps: [add('nasi'), cook('goreng', 4)] }, 'pedas', false, 'cabai', 'telur', 1),
  kalau({ ...tunggu('roti-panggang'), steps: [add('roti'), cook('panggang', 3)] }, 'manis', true, 'pisang', 'keju', 1),
  kalau({ ...tunggu('mie-rebus'), steps: [add('mie'), add('air'), cook('rebus', 5)] }, 'pedas', false, 'cabai', 'telur', 2),
  kalau({ ...tunggu('nasi-goreng'), steps: [add('nasi'), cook('goreng', 4)] }, 'pedas', true, 'cabai', 'telur', 1),
  kalau({ ...tunggu('roti-panggang'), steps: [add('roti'), cook('panggang', 3)] }, 'manis', false, 'pisang', 'keju', 1),
];

export type Level = 'susun' | 'tunggu' | 'dua' | 'aduk' | 'kalau';

export const LEVELS: Level[] = ['susun', 'tunggu', 'dua', 'aduk', 'kalau'];

/** The orders of a level, in the order they come: always the same, one after another. */
export function ordersFor(level: Level): Recipe[][] {
  switch (level) {
    case 'susun':
      return SUSUN.map((recipe) => [recipe]);
    case 'tunggu':
      return TUNGGU.map((recipe) => [recipe]);
    case 'dua':
      return DUA;
    case 'aduk':
      return ADUK.map((recipe) => [recipe]);
    case 'kalau':
      return KALAU.map((recipe) => [recipe]);
  }
}

/** Every different dish the levels make, once each (a dish that comes in several versions counts once). */
export function allDishes(): Recipe[] {
  const dishes = new Map<string, Recipe>();
  for (const level of LEVELS) for (const recipe of ordersFor(level).flat()) if (!dishes.has(dishBase(recipe))) dishes.set(dishBase(recipe), recipe);
  return [...dishes.values()];
}

/* ------------------------------------------------------------------ */
/* The customers                                                       */
/* ------------------------------------------------------------------ */

export type Customer = { id: string; name: string; tint: string };

/** Who comes to the counter: one after another, in the same order. `tint` is a Tailwind colour pair. */
export const CUSTOMERS: Customer[] = [
  { id: 'ibu', name: 'Ibu', tint: 'bg-rose-200 text-rose-700' },
  { id: 'bapak', name: 'Bapak', tint: 'bg-sky-200 text-sky-700' },
  { id: 'kakak', name: 'Kakak', tint: 'bg-violet-200 text-violet-700' },
  { id: 'nenek', name: 'Nenek', tint: 'bg-amber-200 text-amber-700' },
  { id: 'adik', name: 'Adik', tint: 'bg-emerald-200 text-emerald-700' },
  { id: 'kakek', name: 'Kakek', tint: 'bg-teal-200 text-teal-700' },
];

export const customerFor = (round: number): Customer => CUSTOMERS[round % CUSTOMERS.length];

/**
 * How long a customer waits at the counter before they give up, per level.
 * Generous: a three-year-old is doing this with one finger and a great deal of
 * looking.
 */
export const PATIENCE_MS: Record<Level, number> = {
  susun: 60_000,
  tunggu: 75_000,
  dua: 100_000,
  aduk: 100_000,
  kalau: 90_000,
};

/** A customer of a child who is being guided never leaves: the bar goes down this far and stops. */
export const PATIENCE_FLOOR = 0.35;

/**
 * How much of a customer's patience is left, 1 to 0. `patient` customers - those
 * of a child being guided - stop at the floor instead of reaching nothing.
 */
export function patienceLeft(level: Level, arrivedAt: number, now: number, patient: boolean): number {
  const left = Math.max(0, 1 - (now - arrivedAt) / PATIENCE_MS[level]);
  return patient ? Math.max(PATIENCE_FLOOR, left) : left;
}

export type Mood = 'happy' | 'waiting' | 'upset';

/** How a customer looks: smiling while they have patience, then frowning as it goes. */
export function moodOf(left: number): Mood {
  return left > 0.5 ? 'happy' : left > 0.2 ? 'waiting' : 'upset';
}

/* ------------------------------------------------------------------ */
/* The pantry                                                          */
/* ------------------------------------------------------------------ */

export type Stock = Record<string, number>;

/** How much of each ingredient an order uses up, all its dishes together. */
export function needsOf(order: Recipe[]): Stock {
  const needs: Stock = {};
  for (const recipe of order) {
    for (const step of recipe.steps) {
      if (step.kind === 'add') needs[step.ingredient] = (needs[step.ingredient] ?? 0) + 1;
    }
  }
  return needs;
}

/** Whether a dish has anything to cook (and so a pot of its own). */
export const cooks = (recipe: Recipe): boolean => recipe.steps.some((s) => s.kind === 'cook');

/** Whether a dish has anything to stir (and so a spoon). */
export const stirs = (recipe: Recipe): boolean => recipe.steps.some((s) => s.kind === 'stir');

/**
 * What the pantry holds for an order: exactly what it needs, and one more of
 * each when something can be cooked too long and thrown away, so that one
 * mistake does not end the dish. Beside them sit things that are not wanted -
 * the other choice of a branch, and a few more - because a pantry with only the
 * right things in it asks nothing of the child.
 */
export function pantryFor(order: Recipe[], round: number): Stock {
  const needs = needsOf(order);
  const spare = order.some(cooks) ? 1 : 0;
  const stock: Stock = {};
  for (const [id, n] of Object.entries(needs)) stock[id] = n + spare;

  // The road not taken: the other ingredient of a branch is always on the shelf.
  for (const recipe of order) {
    for (const step of recipe.steps) {
      if (step.kind === 'add' && step.branch) {
        for (const id of [step.branch.yes, step.branch.no]) if (!(id in stock)) stock[id] = 1;
      }
    }
  }

  // A few more, chosen in turn so they are not always the same: at least one that is
  // not wanted at all, and enough for the tray to have four.
  const others = INGREDIENTS.filter((i) => !(i.id in stock));
  const unwanted = () => Object.keys(stock).filter((id) => !(id in needs)).length;
  for (let k = 0; (Object.keys(stock).length < 4 || unwanted() === 0) && k < others.length; k += 1) {
    stock[others[(round + k * 3) % others.length].id] = 1;
  }
  return stock;
}

/** The pantry's shelves in a steady order, whatever is on them. */
export function shelfOrder(stock: Stock): string[] {
  return INGREDIENTS.map((i) => i.id).filter((id) => id in stock);
}

/* ------------------------------------------------------------------ */
/* The kitchen                                                         */
/* ------------------------------------------------------------------ */

/** What is on a dish's pot. `at` is when it was put on (the `now` it was given). */
export type Burner = { at: number; burns: boolean } | null;

export type Kitchen = {
  order: Recipe[];
  /** For each dish, the step it is on: the number of steps means it is done. */
  progress: number[];
  /** For each dish, how many times it has been stirred in the stirring step it is on. */
  stirred: number[];
  stock: Stock;
  /** For each dish, its pot. */
  burners: Burner[];
};

/** How long a finished dish may sit on the burner before it burns, once it is ready. */
export const BURN_GRACE_MS = 6000;

export function startKitchen(order: Recipe[], stock: Stock): Kitchen {
  return {
    order,
    progress: order.map(() => 0),
    stirred: order.map(() => 0),
    stock: { ...stock },
    burners: order.map(() => null),
  };
}

export const dishDone = (kitchen: Kitchen, dish: number) => kitchen.progress[dish] >= kitchen.order[dish].steps.length;

export const isFinished = (kitchen: Kitchen) => kitchen.order.every((_, dish) => dishDone(kitchen, dish));

/** The step a dish is waiting to do, or null when it is done. */
export function stepOf(kitchen: Kitchen, dish: number): Step | null {
  return kitchen.order[dish].steps[kitchen.progress[dish]] ?? null;
}

const isCooking = (kitchen: Kitchen, dish: number) => kitchen.burners[dish] !== null;

/** The dish an ingredient would go into: the first one whose next step is exactly that. */
export function addTarget(kitchen: Kitchen, ingredient: string): number | null {
  for (let dish = 0; dish < kitchen.order.length; dish += 1) {
    const step = stepOf(kitchen, dish);
    if (step?.kind === 'add' && step.ingredient === ingredient && !isCooking(kitchen, dish)) return dish;
  }
  return null;
}

export type AddResult =
  | { outcome: 'added'; kitchen: Kitchen; dish: number; finished: boolean }
  /** Not what any dish is waiting for. Nothing is used up. */
  | { outcome: 'wrong'; kitchen: Kitchen }
  /** What a dish is waiting for, but there is none left. */
  | { outcome: 'empty'; kitchen: Kitchen; dish: number };

export function addIngredient(kitchen: Kitchen, ingredient: string): AddResult {
  const dish = addTarget(kitchen, ingredient);
  if (dish === null) return { outcome: 'wrong', kitchen };
  if ((kitchen.stock[ingredient] ?? 0) <= 0) return { outcome: 'empty', kitchen, dish };

  const progress = [...kitchen.progress];
  progress[dish] += 1;
  const next = { ...kitchen, progress, stock: { ...kitchen.stock, [ingredient]: kitchen.stock[ingredient] - 1 } };
  return { outcome: 'added', kitchen: next, dish, finished: dishDone(next, dish) };
}

export type StirResult =
  /** One more stir. `count` is how many so far; `stepDone` when that was the last of them. */
  | { outcome: 'stirred'; kitchen: Kitchen; dish: number; count: number; stepDone: boolean; finished: boolean }
  /** The dish is not waiting to be stirred. */
  | { outcome: 'wrong'; kitchen: Kitchen };

/** Stirs one dish once, if it is waiting to be stirred. */
export function stirDish(kitchen: Kitchen, dish: number): StirResult {
  const step = stepOf(kitchen, dish);
  if (step?.kind !== 'stir' || isCooking(kitchen, dish)) return { outcome: 'wrong', kitchen };

  const count = kitchen.stirred[dish] + 1;
  const stepDone = count >= step.times;
  const progress = [...kitchen.progress];
  const stirred = [...kitchen.stirred];
  if (stepDone) {
    progress[dish] += 1;
    stirred[dish] = 0;
  } else {
    stirred[dish] = count;
  }
  const next = { ...kitchen, progress, stirred };
  return { outcome: 'stirred', kitchen: next, dish, count, stepDone, finished: dishDone(next, dish) };
}

/** The first dish that is waiting to be stirred. */
export function waitingToStir(kitchen: Kitchen): number | null {
  const dish = kitchen.order.findIndex((_, i) => stepOf(kitchen, i)?.kind === 'stir' && !isCooking(kitchen, i));
  return dish < 0 ? null : dish;
}

/** The dishes whose next step is cooking and that are not on a burner yet. */
export function waitingToCook(kitchen: Kitchen): number[] {
  return kitchen.order.map((_, dish) => dish).filter((dish) => stepOf(kitchen, dish)?.kind === 'cook' && !isCooking(kitchen, dish));
}

/** Puts a dish on its pot, if it is waiting to cook. */
export function startCooking(kitchen: Kitchen, dish: number, now: number, burns: boolean): Kitchen | null {
  if (!waitingToCook(kitchen).includes(dish)) return null;

  const burners = [...kitchen.burners];
  burners[dish] = { at: now, burns };
  return { ...kitchen, burners };
}

export type BurnerState = 'empty' | 'cooking' | 'ready' | 'burnt';

/** What a dish's pot is doing, and how far along the cooking is (0 to 1, and 1 once ready). */
export function burnerState(kitchen: Kitchen, dish: number, now: number): { state: BurnerState; progress: number } {
  const on = kitchen.burners[dish];
  if (!on) return { state: 'empty', progress: 0 };

  const step = stepOf(kitchen, dish);
  const ms = (step?.kind === 'cook' ? step.seconds : 0) * 1000;
  const elapsed = now - on.at;
  if (elapsed < ms) return { state: 'cooking', progress: ms === 0 ? 1 : elapsed / ms };
  if (on.burns && elapsed >= ms + BURN_GRACE_MS) return { state: 'burnt', progress: 1 };
  return { state: 'ready', progress: 1 };
}

export type TakeOffResult =
  /** Not ready yet: nothing changes. */
  | { outcome: 'early'; kitchen: Kitchen }
  | { outcome: 'cooked'; kitchen: Kitchen; dish: number; finished: boolean }
  /** Burnt: thrown away, and the dish starts again from its first step. */
  | { outcome: 'burnt'; kitchen: Kitchen; dish: number }
  | { outcome: 'none'; kitchen: Kitchen };

export function takeOff(kitchen: Kitchen, dish: number, now: number): TakeOffResult {
  if (!kitchen.burners[dish]) return { outcome: 'none', kitchen };

  const { state } = burnerState(kitchen, dish, now);
  if (state === 'cooking') return { outcome: 'early', kitchen };

  const burners = [...kitchen.burners];
  burners[dish] = null;
  const progress = [...kitchen.progress];
  const stirred = [...kitchen.stirred];

  if (state === 'burnt') {
    progress[dish] = 0;
    stirred[dish] = 0;
    return { outcome: 'burnt', kitchen: { ...kitchen, burners, progress, stirred }, dish };
  }
  progress[dish] += 1;
  const next = { ...kitchen, burners, progress };
  return { outcome: 'cooked', kitchen: next, dish, finished: dishDone(next, dish) };
}

/**
 * True when what is left in the pantry can no longer make what is left to make:
 * a burnt dish used up the spare. The screen then goes shopping - the order
 * starts again with a full pantry - rather than leave the child stuck.
 */
export function shortOfStock(kitchen: Kitchen): boolean {
  const left: Stock = {};
  kitchen.order.forEach((recipe, dish) => {
    recipe.steps.slice(kitchen.progress[dish]).forEach((step) => {
      if (step.kind === 'add') left[step.ingredient] = (left[step.ingredient] ?? 0) + 1;
    });
  });
  return Object.entries(left).some(([id, n]) => (kitchen.stock[id] ?? 0) < n);
}

/* ------------------------------------------------------------------ */
/* Pointing the way                                                    */
/* ------------------------------------------------------------------ */

export type Pointer =
  | { kind: 'ingredient'; id: string }
  /** A dish's pot, to put it on or to take it off. */
  | { kind: 'burner'; dish: number }
  | { kind: 'spoon'; dish: number };

/**
 * What a child who is being guided is pointed at: a ready dish to take off
 * first (it is the one that can spoil), then a pot to put a waiting dish on,
 * then a spoon, then the ingredient the next step asks for.
 */
export function nextPointer(kitchen: Kitchen, now: number): Pointer | null {
  for (let dish = 0; dish < kitchen.order.length; dish += 1) {
    if (burnerState(kitchen, dish, now).state === 'ready') return { kind: 'burner', dish };
  }
  const waiting = waitingToCook(kitchen);
  if (waiting.length > 0) return { kind: 'burner', dish: waiting[0] };

  const toStir = waitingToStir(kitchen);
  if (toStir !== null) return { kind: 'spoon', dish: toStir };

  const wanted = wantedIngredient(kitchen);
  return wanted ? { kind: 'ingredient', id: wanted } : null;
}

/** The ingredient the first dish that wants one is waiting for - what to say after a wrong pick. */
export function wantedIngredient(kitchen: Kitchen): string | null {
  for (let dish = 0; dish < kitchen.order.length; dish += 1) {
    const step = stepOf(kitchen, dish);
    if (step?.kind === 'add' && !isCooking(kitchen, dish)) return step.ingredient;
  }
  return null;
}
