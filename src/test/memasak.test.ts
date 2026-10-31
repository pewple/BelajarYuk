import { describe, expect, it } from 'vitest';
import {
  BURN_GRACE_MS,
  INGREDIENTS,
  LEVELS,
  addIngredient,
  addTarget,
  burnerState,
  burnersFor,
  dishDone,
  isFinished,
  ingredientOf,
  needsOf,
  nextPointer,
  ordersFor,
  pantryFor,
  shelfOrder,
  shortOfStock,
  startCooking,
  startKitchen,
  stepOf,
  takeOff,
  waitingToCook,
  wantedIngredient,
} from '../data/memasak';
import type { Kitchen, Level, Recipe } from '../data/memasak';

const orders = (level: Level) => ordersFor(level);
const kitchenFor = (level: Level, place = 0, round = 0): Kitchen => {
  const order = orders(level)[place];
  return startKitchen(order, pantryFor(order, round), burnersFor(level));
};

/** A grown-up cooking perfectly: every step in order, waiting for what is cooking. */
function cookAll(kitchen: Kitchen, burns = true): { kitchen: Kitchen; at: number } {
  let k = kitchen;
  let at = 0;
  for (let guard = 0; guard < 100 && !isFinished(k); guard += 1) {
    const wanted = wantedIngredient(k);
    if (wanted) {
      const result = addIngredient(k, wanted);
      if (result.outcome !== 'added') throw new Error(`could not add ${wanted}`);
      k = result.kitchen;
      continue;
    }
    const free = k.burners.findIndex((b) => b === null);
    const started = free >= 0 ? startCooking(k, free, at, burns) : null;
    if (started) {
      k = started.kitchen;
      continue;
    }
    at += 1000;
    k.burners.forEach((_, i) => {
      if (burnerState(k, i, at).state === 'ready') k = (takeOff(k, i, at) as { kitchen: Kitchen }).kitchen;
    });
  }
  return { kitchen: k, at };
}

describe('the recipes', () => {
  const all = LEVELS.flatMap((level) => orders(level).flat());

  it('use only ingredients that exist', () => {
    for (const recipe of all) {
      for (const step of recipe.steps) if (step.kind === 'add') expect(() => ingredientOf(step.ingredient), recipe.id).not.toThrow();
    }
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
  });

  it.each(all.map((r) => [r.id, r] as const))('%s has two to five ingredients', (_id, recipe) => {
    const adds = recipe.steps.filter((s) => s.kind === 'add').length;
    expect(adds).toBeGreaterThanOrEqual(2);
    expect(adds).toBeLessThanOrEqual(5);
  });

  it('have a name and a picture each, and no two with the same id', () => {
    for (const recipe of all) {
      expect(recipe.name.trim(), recipe.id).not.toBe('');
      expect(recipe.icon, recipe.id).toBeTruthy();
    }
    // Level 3 reuses level 2's dishes, so each id is the same recipe wherever it appears.
    const unique = new Map<string, Recipe>();
    for (const recipe of all) {
      const known = unique.get(recipe.id);
      if (known) expect(known).toBe(recipe);
      unique.set(recipe.id, recipe);
    }
    expect(unique.size).toBe(5 + 6); // five to put together, six to cook
  });

  it('level 1 has nothing to cook: it is only putting things in, in order', () => {
    for (const order of orders('susun')) {
      expect(order).toHaveLength(1);
      expect(order[0].steps.every((s) => s.kind === 'add')).toBe(true);
      expect(order[0].steps.length).toBeLessThanOrEqual(3); // two or three, for the youngest
    }
  });

  it('level 2 ends every dish with one short cooking step', () => {
    for (const order of orders('tunggu')) {
      expect(order).toHaveLength(1);
      const cooks = order[0].steps.filter((s) => s.kind === 'cook');
      expect(cooks).toHaveLength(1);
      expect(order[0].steps.at(-1)?.kind).toBe('cook');
      const cook = cooks[0];
      if (cook.kind === 'cook') {
        expect(cook.seconds).toBeGreaterThanOrEqual(3);
        expect(cook.seconds).toBeLessThanOrEqual(5);
      }
    }
  });

  it('level 3 orders two dishes that each need the stove, with at most five different ingredients between them', () => {
    for (const order of orders('dua')) {
      expect(order).toHaveLength(2);
      for (const recipe of order) expect(recipe.steps.some((s) => s.kind === 'cook')).toBe(true);
      expect(Object.keys(needsOf(order)).length).toBeLessThanOrEqual(5);
    }
  });

  it('give each level a stove to match: none, one, two burners', () => {
    expect(LEVELS.map(burnersFor)).toEqual([0, 1, 2]);
  });
});

describe('the pantry', () => {
  it('holds exactly what a level with nothing to burn needs, so every dot is a decision', () => {
    for (const order of orders('susun')) {
      const needs = needsOf(order);
      const stock = pantryFor(order, 0);
      for (const [id, n] of Object.entries(needs)) expect(stock[id], id).toBe(n);
    }
  });

  it('holds one more of each where a dish can be thrown away', () => {
    for (const level of ['tunggu', 'dua'] as const) {
      for (const order of orders(level)) {
        const needs = needsOf(order);
        const stock = pantryFor(order, 0);
        for (const [id, n] of Object.entries(needs)) expect(stock[id], id).toBe(n + 1);
      }
    }
  });

  it('counts a shared ingredient for every dish that uses it', () => {
    const [order] = orders('dua'); // nasi goreng and telur rebus both want an egg
    expect(needsOf(order).telur).toBe(2);
  });

  it('puts unwanted things on the shelf too, and keeps the shelf to a tray a hand can reach', () => {
    for (const level of LEVELS) {
      orders(level).forEach((order, place) => {
        const needs = needsOf(order);
        const stock = pantryFor(order, place);
        const unwanted = Object.keys(stock).filter((id) => !(id in needs));
        expect(unwanted.length, `${level} ${place}`).toBeGreaterThanOrEqual(1);
        for (const id of unwanted) expect(stock[id]).toBe(1);
        expect(Object.keys(stock).length).toBeGreaterThanOrEqual(4);
        expect(Object.keys(stock).length).toBeLessThanOrEqual(6);
      });
    }
  });

  it('is the same every time for the same round, and not always the same unwanted things', () => {
    const [order] = orders('susun');
    expect(pantryFor(order, 4)).toEqual(pantryFor(order, 4));
    const seen = new Set(Array.from({ length: 6 }, (_, r) => Object.keys(pantryFor(order, r)).sort().join()));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('keeps its shelves in one steady order', () => {
    const stock = pantryFor(orders('tunggu')[0], 2);
    const order = shelfOrder(stock);
    expect([...order].sort()).toEqual(Object.keys(stock).sort());
    expect(order).toEqual(INGREDIENTS.map((i) => i.id).filter((id) => order.includes(id)));
  });
});

describe('putting things in', () => {
  it('takes the ingredient the recipe asks for next, and uses one up', () => {
    const kitchen = kitchenFor('susun'); // roti keju: roti, keju, roti
    const result = addIngredient(kitchen, 'roti');

    expect(result).toMatchObject({ outcome: 'added', dish: 0, finished: false });
    expect(result.kitchen.progress).toEqual([1]);
    expect(result.kitchen.stock.roti).toBe(1);
    expect(kitchen.stock.roti).toBe(2); // the old kitchen is left alone
  });

  it('says "wrong" for anything else - the wrong order, or something that is not in the recipe - and uses nothing up', () => {
    const kitchen = kitchenFor('susun');
    for (const id of ['keju', 'telur', 'susu']) {
      if (!(id in kitchen.stock)) continue;
      const result = addIngredient(kitchen, id);
      expect(result.outcome, id).toBe('wrong');
      expect(result.kitchen).toBe(kitchen);
    }
  });

  it('asks for the same ingredient twice where the recipe does: roti, keju, roti', () => {
    let kitchen = kitchenFor('susun');
    for (const id of ['roti', 'keju', 'roti']) {
      const result = addIngredient(kitchen, id);
      expect(result.outcome, id).toBe('added');
      kitchen = result.kitchen;
    }
    expect(isFinished(kitchen)).toBe(true);
    expect(kitchen.stock.roti).toBe(0);
  });

  it('says "empty" when the right thing has run out, and does not move on', () => {
    let kitchen = kitchenFor('susun');
    kitchen = { ...kitchen, stock: { ...kitchen.stock, roti: 0 } };
    const result = addIngredient(kitchen, 'roti');

    expect(result).toMatchObject({ outcome: 'empty', dish: 0 });
    expect(result.kitchen.progress).toEqual([0]);
  });

  it('lets either dish of a pair go ahead, in its own order, and gives a shared ingredient to the first that asks', () => {
    let kitchen = kitchenFor('dua');
    expect(addTarget(kitchen, 'nasi')).toBe(0);
    expect(addTarget(kitchen, 'telur')).toBe(1);
    kitchen = (addIngredient(kitchen, 'telur') as { kitchen: Kitchen }).kitchen;
    expect(kitchen.progress).toEqual([0, 1]);
    kitchen = (addIngredient(kitchen, 'nasi') as { kitchen: Kitchen }).kitchen;
    // Now both dishes want a telur or an air: the egg goes to nasi goreng, the first that asks.
    expect(addTarget(kitchen, 'telur')).toBe(0);
    expect(addTarget(kitchen, 'air')).toBe(1);
  });

  it('refuses to add to a dish that is on the stove', () => {
    let kitchen = kitchenFor('tunggu'); // roti panggang
    for (const id of ['roti', 'keju']) kitchen = (addIngredient(kitchen, id) as { kitchen: Kitchen }).kitchen;
    kitchen = startCooking(kitchen, 0, 0, true)!.kitchen;

    expect(addIngredient(kitchen, 'roti').outcome).toBe('wrong');
  });
});

describe('the stove', () => {
  const readyToCook = (level: Level = 'tunggu') => {
    let kitchen = kitchenFor(level);
    for (let guard = 0; guard < 10; guard += 1) {
      const wanted = wantedIngredient(kitchen);
      if (!wanted) break;
      kitchen = (addIngredient(kitchen, wanted) as { kitchen: Kitchen }).kitchen;
    }
    return kitchen;
  };

  it('is waiting for a dish only once its ingredients are in', () => {
    const empty = kitchenFor('tunggu');
    expect(waitingToCook(empty)).toEqual([]);
    expect(startCooking(empty, 0, 0, true)).toBeNull();

    const full = readyToCook();
    expect(waitingToCook(full)).toEqual([0]);
  });

  it('takes a dish on an empty burner and not on one that is busy', () => {
    const kitchen = readyToCook();
    const started = startCooking(kitchen, 0, 1000, true)!;

    expect(started.dish).toBe(0);
    expect(started.kitchen.burners[0]).toEqual({ dish: 0, at: 1000, burns: true });
    expect(waitingToCook(started.kitchen)).toEqual([]);
    expect(startCooking(started.kitchen, 0, 1100, true)).toBeNull();
  });

  it('cooks for the recipe\'s seconds, then is ready, then burns - when it can burn', () => {
    const kitchen = startCooking(readyToCook(), 0, 0, true)!.kitchen; // roti panggang: 3 seconds
    expect(burnerState(kitchen, 0, 0)).toEqual({ state: 'cooking', progress: 0 });
    expect(burnerState(kitchen, 0, 1500).progress).toBeCloseTo(0.5);
    expect(burnerState(kitchen, 0, 2999).state).toBe('cooking');
    expect(burnerState(kitchen, 0, 3000)).toEqual({ state: 'ready', progress: 1 });
    expect(burnerState(kitchen, 0, 3000 + BURN_GRACE_MS - 1).state).toBe('ready');
    expect(burnerState(kitchen, 0, 3000 + BURN_GRACE_MS).state).toBe('burnt');
  });

  it('never burns for a child who is being guided', () => {
    const kitchen = startCooking(readyToCook(), 0, 0, false)!.kitchen;
    expect(burnerState(kitchen, 0, 3000 + BURN_GRACE_MS * 10).state).toBe('ready');
  });

  it('reports an empty burner as empty', () => {
    expect(burnerState(kitchenFor('tunggu'), 0, 0)).toEqual({ state: 'empty', progress: 0 });
  });

  it('changes nothing when taken off too early', () => {
    const kitchen = startCooking(readyToCook(), 0, 0, true)!.kitchen;
    const result = takeOff(kitchen, 0, 1000);

    expect(result.outcome).toBe('early');
    expect(result.kitchen).toBe(kitchen);
  });

  it('finishes the dish when taken off ready, and frees the burner', () => {
    const kitchen = startCooking(readyToCook(), 0, 0, true)!.kitchen;
    const result = takeOff(kitchen, 0, 3500);

    expect(result).toMatchObject({ outcome: 'cooked', dish: 0, finished: true });
    expect(result.kitchen.burners[0]).toBeNull();
    expect(isFinished(result.kitchen)).toBe(true);
  });

  it('throws a burnt dish away: the burner is clear, the dish starts again, and what went in is gone', () => {
    const kitchen = startCooking(readyToCook(), 0, 0, true)!.kitchen;
    const stockBefore = { ...kitchen.stock };
    const result = takeOff(kitchen, 0, 3000 + BURN_GRACE_MS);

    expect(result).toMatchObject({ outcome: 'burnt', dish: 0 });
    expect(result.kitchen.burners[0]).toBeNull();
    expect(result.kitchen.progress).toEqual([0]);
    expect(result.kitchen.stock).toEqual(stockBefore); // nothing comes back
    expect(dishDone(result.kitchen, 0)).toBe(false);
  });

  it('does nothing for a burner with nothing on it', () => {
    expect(takeOff(kitchenFor('tunggu'), 0, 0).outcome).toBe('none');
  });

  it('cooks two dishes on two burners at once', () => {
    let kitchen = kitchenFor('dua');
    for (let guard = 0; guard < 20; guard += 1) {
      const wanted = wantedIngredient(kitchen);
      if (!wanted) break;
      kitchen = (addIngredient(kitchen, wanted) as { kitchen: Kitchen }).kitchen;
    }
    expect(waitingToCook(kitchen)).toEqual([0, 1]);
    kitchen = startCooking(kitchen, 0, 0, true)!.kitchen;
    kitchen = startCooking(kitchen, 1, 500, true)!.kitchen;

    expect(kitchen.burners.map((b) => b?.dish)).toEqual([0, 1]);
    expect(waitingToCook(kitchen)).toEqual([]);
  });

  it('waits for a free burner when two dishes are ready and only one fits', () => {
    // A one-burner stove with a level 3 order: the second dish has to wait its turn.
    let kitchen = startKitchen(orders('dua')[0], pantryFor(orders('dua')[0], 0), 1);
    for (let guard = 0; guard < 20; guard += 1) {
      const wanted = wantedIngredient(kitchen);
      if (!wanted) break;
      kitchen = (addIngredient(kitchen, wanted) as { kitchen: Kitchen }).kitchen;
    }
    kitchen = startCooking(kitchen, 0, 0, true)!.kitchen;
    expect(startCooking(kitchen, 0, 10, true)).toBeNull();
    expect(waitingToCook(kitchen)).toEqual([1]);
  });
});

describe('finishing', () => {
  it.each(LEVELS.flatMap((level) => orders(level).map((order, place) => [`${level} ${order.map((r) => r.id).join(' + ')}`, level, place] as const)))(
    '%s can be cooked from start to finish',
    (_name, level, place) => {
      const { kitchen } = cookAll(kitchenFor(level, place));

      expect(isFinished(kitchen)).toBe(true);
      expect(shortOfStock(kitchen)).toBe(false);
      expect(kitchen.burners.every((b) => b === null)).toBe(true);
    },
  );

  it('uses up exactly what each recipe needs and leaves the spare', () => {
    const { kitchen } = cookAll(kitchenFor('tunggu', 1)); // nasi goreng
    expect(kitchen.stock.nasi).toBe(1);
    expect(kitchen.stock.telur).toBe(1);
  });

  it('reports a recipe as not finished while any step is left', () => {
    const kitchen = addIngredient(kitchenFor('susun'), 'roti').kitchen;
    expect(isFinished(kitchen)).toBe(false);
    expect(stepOf(kitchen, 0)).toEqual({ kind: 'add', ingredient: 'keju' });
  });
});

describe('running out', () => {
  const burnOnce = (kitchen: Kitchen): Kitchen => {
    let k = kitchen;
    for (let guard = 0; guard < 10; guard += 1) {
      const wanted = wantedIngredient(k);
      if (!wanted) break;
      k = (addIngredient(k, wanted) as { kitchen: Kitchen }).kitchen;
    }
    k = startCooking(k, 0, 0, true)!.kitchen;
    return takeOff(k, 0, 60_000).kitchen;
  };

  it('is not short after one burnt dish: that is what the spare is for', () => {
    expect(shortOfStock(burnOnce(kitchenFor('tunggu')))).toBe(false);
  });

  it('is short after a second one: the shelves are empty of what the dish needs', () => {
    expect(shortOfStock(burnOnce(burnOnce(kitchenFor('tunggu'))))).toBe(true);
  });

  it('is never short in a level with nothing to burn', () => {
    let kitchen = kitchenFor('susun');
    expect(shortOfStock(kitchen)).toBe(false);
    for (const id of ['roti', 'keju']) kitchen = (addIngredient(kitchen, id) as { kitchen: Kitchen }).kitchen;
    expect(shortOfStock(kitchen)).toBe(false);
  });
});

describe('pointing the way', () => {
  it('starts with the first ingredient of the recipe', () => {
    expect(nextPointer(kitchenFor('susun'), 0)).toEqual({ kind: 'ingredient', id: 'roti' });
  });

  it('points at an empty burner once a dish is ready to cook', () => {
    let kitchen = kitchenFor('tunggu');
    for (const id of ['roti', 'keju']) kitchen = (addIngredient(kitchen, id) as { kitchen: Kitchen }).kitchen;
    expect(nextPointer(kitchen, 0)).toEqual({ kind: 'burner', index: 0 });
  });

  it('points at nothing while a dish is cooking and nothing else can be done', () => {
    let kitchen = kitchenFor('tunggu');
    for (const id of ['roti', 'keju']) kitchen = (addIngredient(kitchen, id) as { kitchen: Kitchen }).kitchen;
    kitchen = startCooking(kitchen, 0, 0, true)!.kitchen;
    expect(nextPointer(kitchen, 1000)).toBeNull();
  });

  it('points at a ready dish before anything else: it is the one that can spoil', () => {
    let kitchen = kitchenFor('dua');
    for (const id of ['nasi', 'telur']) kitchen = (addIngredient(kitchen, id) as { kitchen: Kitchen }).kitchen; // nasi goreng's two ingredients
    kitchen = (addIngredient(kitchen, 'telur') as { kitchen: Kitchen }).kitchen;
    kitchen = startCooking(kitchen, 0, 0, true)!.kitchen;
    expect(nextPointer(kitchen, 4500)).toEqual({ kind: 'burner', index: 0 });
  });

  it('keeps working on the second dish while the first cooks', () => {
    let kitchen = kitchenFor('dua');
    for (const id of ['nasi', 'telur']) kitchen = (addIngredient(kitchen, id) as { kitchen: Kitchen }).kitchen;
    kitchen = startCooking(kitchen, 0, 0, true)!.kitchen;
    expect(nextPointer(kitchen, 1000)).toEqual({ kind: 'ingredient', id: 'telur' });
  });

  it('names what to look for after a wrong pick, and nothing when only cooking is left', () => {
    let kitchen = kitchenFor('tunggu');
    expect(wantedIngredient(kitchen)).toBe('roti');
    for (const id of ['roti', 'keju']) kitchen = (addIngredient(kitchen, id) as { kitchen: Kitchen }).kitchen;
    expect(wantedIngredient(kitchen)).toBeNull();
  });
});
