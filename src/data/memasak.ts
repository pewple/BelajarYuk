import {
  Apple, Banana, Carrot, Citrus, Cherry, Cookie, Droplet, Egg, Fish, GlassWater, Milk, Salad, Sandwich, Soup,
  UtensilsCrossed, Wheat,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bread, Cheese, Noodles, Rice } from '../components/drawnIcons';

/**
 * Memasak - cooking, as a first lesson in doing things in order, in time, and
 * with what you have.
 *
 * A recipe is a short list of steps drawn as pictures: put an ingredient in, or
 * cook for a few seconds. Three levels, each adding one idea:
 *
 *  1. Susun    - the steps in order. Nothing to wait for.
 *  2. Tunggu   - one step is cooking: put it on the stove, wait for it to be
 *                ready, take it off in time.
 *  3. Dua sekaligus - two dishes, two burners: start one cooking, and get on
 *                with the other while you wait.
 *
 * The pantry is limited. Every ingredient used comes off its count, so a dish
 * that is thrown away (burnt) costs something, and an ingredient can run out.
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
];

export function ingredientOf(id: string): Ingredient {
  const found = INGREDIENTS.find((i) => i.id === id);
  if (!found) throw new Error(`No ingredient "${id}".`);
  return found;
}

export type Step =
  | { kind: 'add'; ingredient: string }
  /** Cook for `seconds`: `verb` is what it is called ("goreng"). */
  | { kind: 'cook'; seconds: number; verb: 'panggang' | 'goreng' | 'rebus' };

export type Recipe = {
  id: string;
  name: string;
  icon: LucideIcon;
  steps: Step[];
};

const add = (ingredient: string): Step => ({ kind: 'add', ingredient });
const cook = (verb: 'panggang' | 'goreng' | 'rebus', seconds: number): Step => ({ kind: 'cook', seconds, verb });

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

const byId = (id: string): Recipe => {
  const found = TUNGGU.find((r) => r.id === id);
  if (!found) throw new Error(`No recipe "${id}".`);
  return found;
};

/** Level 3: an order of two dishes, and two burners to cook them on. */
const DUA: Recipe[][] = [
  [byId('nasi-goreng'), byId('telur-rebus')],
  [byId('sup-wortel'), byId('roti-panggang')],
  [byId('mie-rebus'), byId('pisang-goreng')],
];

export type Level = 'susun' | 'tunggu' | 'dua';

export const LEVELS: Level[] = ['susun', 'tunggu', 'dua'];

/** The orders of a level, in the order they come: always the same, one after another. */
export function ordersFor(level: Level): Recipe[][] {
  switch (level) {
    case 'susun':
      return SUSUN.map((recipe) => [recipe]);
    case 'tunggu':
      return TUNGGU.map((recipe) => [recipe]);
    case 'dua':
      return DUA;
  }
}

/** How many burners the stove has: none to watch in level 1, one in level 2, two in level 3. */
export function burnersFor(level: Level): number {
  return level === 'susun' ? 0 : level === 'tunggu' ? 1 : 2;
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

/**
 * What the pantry holds for an order: exactly what it needs, and one more of
 * each when something can be cooked too long and thrown away, so that one
 * mistake does not end the dish. One of something that is not wanted at all
 * sits beside them, because a pantry with only the right things in it asks
 * nothing of the child.
 */
export function pantryFor(order: Recipe[], round: number): Stock {
  const needs = needsOf(order);
  const cooks = order.some((r) => r.steps.some((s) => s.kind === 'cook'));
  const stock: Stock = {};
  for (const [id, n] of Object.entries(needs)) stock[id] = n + (cooks ? 1 : 0);

  // A few more in the tray: unwanted ones, chosen in turn so they are not always the same.
  const spare = INGREDIENTS.filter((i) => !(i.id in needs));
  const extras = Math.max(1, 4 - Object.keys(needs).length);
  for (let k = 0; k < extras; k += 1) stock[spare[(round + k * 3) % spare.length].id] = 1;
  return stock;
}

/** The pantry's shelves in a steady order, whatever is on them. */
export function shelfOrder(stock: Stock): string[] {
  return INGREDIENTS.map((i) => i.id).filter((id) => id in stock);
}

/* ------------------------------------------------------------------ */
/* The kitchen                                                         */
/* ------------------------------------------------------------------ */

/** What is on a burner. `at` is when it was put on (the `now` it was given). */
export type Burner = { dish: number; at: number; burns: boolean } | null;

export type Kitchen = {
  order: Recipe[];
  /** For each dish, the step it is on: the number of steps means it is done. */
  progress: number[];
  stock: Stock;
  burners: Burner[];
};

/** How long a finished dish may sit on the burner before it burns, once it is ready. */
export const BURN_GRACE_MS = 6000;

export function startKitchen(order: Recipe[], stock: Stock, burners: number): Kitchen {
  return { order, progress: order.map(() => 0), stock: { ...stock }, burners: Array.from({ length: burners }, () => null) };
}

export const dishDone = (kitchen: Kitchen, dish: number) => kitchen.progress[dish] >= kitchen.order[dish].steps.length;

export const isFinished = (kitchen: Kitchen) => kitchen.order.every((_, dish) => dishDone(kitchen, dish));

/** The step a dish is waiting to do, or null when it is done. */
export function stepOf(kitchen: Kitchen, dish: number): Step | null {
  return kitchen.order[dish].steps[kitchen.progress[dish]] ?? null;
}

const isCooking = (kitchen: Kitchen, dish: number) => kitchen.burners.some((b) => b?.dish === dish);

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

/** The dishes whose next step is cooking and that are not on a burner yet. */
export function waitingToCook(kitchen: Kitchen): number[] {
  return kitchen.order.map((_, dish) => dish).filter((dish) => stepOf(kitchen, dish)?.kind === 'cook' && !isCooking(kitchen, dish));
}

/** Puts the first waiting dish on this burner, if it is empty. */
export function startCooking(kitchen: Kitchen, burner: number, now: number, burns: boolean): { kitchen: Kitchen; dish: number } | null {
  if (kitchen.burners[burner] !== null) return null;
  const [dish] = waitingToCook(kitchen);
  if (dish === undefined) return null;

  const burners = [...kitchen.burners];
  burners[burner] = { dish, at: now, burns };
  return { kitchen: { ...kitchen, burners }, dish };
}

export type BurnerState = 'empty' | 'cooking' | 'ready' | 'burnt';

/** What a burner is doing, and how far along the cooking is (0 to 1, and 1 once ready). */
export function burnerState(kitchen: Kitchen, burner: number, now: number): { state: BurnerState; progress: number } {
  const on = kitchen.burners[burner];
  if (!on) return { state: 'empty', progress: 0 };

  const step = stepOf(kitchen, on.dish);
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

export function takeOff(kitchen: Kitchen, burner: number, now: number): TakeOffResult {
  const on = kitchen.burners[burner];
  if (!on) return { outcome: 'none', kitchen };

  const { state } = burnerState(kitchen, burner, now);
  if (state === 'cooking') return { outcome: 'early', kitchen };

  const burners = [...kitchen.burners];
  burners[burner] = null;
  const progress = [...kitchen.progress];

  if (state === 'burnt') {
    progress[on.dish] = 0;
    return { outcome: 'burnt', kitchen: { ...kitchen, burners, progress }, dish: on.dish };
  }
  progress[on.dish] += 1;
  const next = { ...kitchen, burners, progress };
  return { outcome: 'cooked', kitchen: next, dish: on.dish, finished: dishDone(next, on.dish) };
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
  | { kind: 'burner'; index: number };

/**
 * What a child who is being guided is pointed at: a ready dish to take off
 * first (it is the one that can spoil), then a burner to put a waiting dish on,
 * then the ingredient the next step asks for.
 */
export function nextPointer(kitchen: Kitchen, now: number): Pointer | null {
  for (let i = 0; i < kitchen.burners.length; i += 1) {
    if (burnerState(kitchen, i, now).state === 'ready') return { kind: 'burner', index: i };
  }
  const free = kitchen.burners.findIndex((b) => b === null);
  if (free >= 0 && waitingToCook(kitchen).length > 0) return { kind: 'burner', index: free };

  for (let dish = 0; dish < kitchen.order.length; dish += 1) {
    const step = stepOf(kitchen, dish);
    if (step?.kind === 'add' && !isCooking(kitchen, dish)) return { kind: 'ingredient', id: step.ingredient };
  }
  return null;
}

/** The ingredient the first dish that wants one is waiting for - what to say after a wrong pick. */
export function wantedIngredient(kitchen: Kitchen): string | null {
  for (let dish = 0; dish < kitchen.order.length; dish += 1) {
    const step = stepOf(kitchen, dish);
    if (step?.kind === 'add' && !isCooking(kitchen, dish)) return step.ingredient;
  }
  return null;
}
