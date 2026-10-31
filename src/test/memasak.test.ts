import { describe, expect, it } from 'vitest';
import {
  BURN_GRACE_MS,
  CUSTOMERS,
  INGREDIENTS,
  LEVELS,
  PATIENCE_FLOOR,
  PATIENCE_MS,
  TASTES,
  addIngredient,
  addTarget,
  allDishes,
  burnerState,
  cooks,
  customerFor,
  dishBase,
  dishDone,
  isFinished,
  ingredientOf,
  moodOf,
  needsOf,
  nextPointer,
  ordersFor,
  pantryFor,
  patienceLeft,
  shelfOrder,
  shortOfStock,
  startCooking,
  startKitchen,
  stepOf,
  stirDish,
  stirs,
  takeOff,
  waitingToCook,
  waitingToStir,
  wantedIngredient,
} from '../data/memasak';
import type { Kitchen, Level } from '../data/memasak';

const orders = (level: Level) => ordersFor(level);
const kitchenFor = (level: Level, place = 0, round = 0): Kitchen => {
  const order = orders(level)[place];
  return startKitchen(order, pantryFor(order, round));
};

/** Puts in everything the dishes want, in order, up to the first step that is not an ingredient. */
function fill(kitchen: Kitchen): Kitchen {
  let k = kitchen;
  for (let guard = 0; guard < 30; guard += 1) {
    const wanted = wantedIngredient(k);
    if (!wanted) break;
    const result = addIngredient(k, wanted);
    if (result.outcome !== 'added') throw new Error(`could not add ${wanted}`);
    k = result.kitchen;
  }
  return k;
}

/** Stirs a dish until its stirring step is done. */
function stirUp(kitchen: Kitchen, dish: number): Kitchen {
  let k = kitchen;
  for (let guard = 0; guard < 20 && stepOf(k, dish)?.kind === 'stir'; guard += 1) {
    k = (stirDish(k, dish) as { kitchen: Kitchen }).kitchen;
  }
  return k;
}

/** A grown-up cooking perfectly: every step in order, waiting for what is cooking. */
function cookAll(kitchen: Kitchen, burns = true): { kitchen: Kitchen; at: number } {
  let k = kitchen;
  let at = 0;
  for (let guard = 0; guard < 200 && !isFinished(k); guard += 1) {
    k = fill(k);
    k.order.forEach((_, dish) => {
      if (stepOf(k, dish)?.kind === 'stir') k = stirUp(k, dish);
    });
    const [waiting] = waitingToCook(k);
    if (waiting !== undefined) {
      k = startCooking(k, waiting, at, burns)!;
      continue;
    }
    at += 1000;
    k.burners.forEach((_, dish) => {
      if (burnerState(k, dish, at).state === 'ready') k = takeOff(k, dish, at).kitchen;
    });
  }
  return { kitchen: k, at };
}

describe('the recipes', () => {
  const all = LEVELS.flatMap((level) => orders(level).flat());

  it('use only ingredients that exist', () => {
    for (const recipe of all) {
      for (const step of recipe.steps) {
        if (step.kind !== 'add') continue;
        expect(() => ingredientOf(step.ingredient), recipe.id).not.toThrow();
        if (step.branch) {
          expect(() => ingredientOf(step.branch!.yes)).not.toThrow();
          expect(() => ingredientOf(step.branch!.no)).not.toThrow();
        }
      }
    }
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
  });

  it.each(all.map((r, i) => [`${r.id} #${i}`, r] as const))('%s has two to five ingredients', (_id, recipe) => {
    const adds = recipe.steps.filter((s) => s.kind === 'add').length;
    expect(adds).toBeGreaterThanOrEqual(2);
    expect(adds).toBeLessThanOrEqual(5);
  });

  it('have a name and a picture each, and a dish that comes in several versions keeps one name', () => {
    for (const recipe of all) {
      expect(recipe.name.trim(), recipe.id).not.toBe('');
      expect(recipe.icon, recipe.id).toBeTruthy();
    }
    const names = new Map<string, string>();
    for (const recipe of all) {
      const known = names.get(dishBase(recipe));
      if (known) expect(recipe.name, recipe.id).toBe(known);
      names.set(dishBase(recipe), recipe.name);
    }
    expect(allDishes()).toHaveLength(names.size);
    expect(new Set(allDishes().map(dishBase)).size).toBe(allDishes().length);
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
      const cooking = order[0].steps.filter((s) => s.kind === 'cook');
      expect(cooking).toHaveLength(1);
      expect(order[0].steps.at(-1)?.kind).toBe('cook');
      const step = cooking[0];
      if (step.kind === 'cook') {
        expect(step.seconds).toBeGreaterThanOrEqual(3);
        expect(step.seconds).toBeLessThanOrEqual(5);
      }
    }
  });

  it('level 3 orders two dishes that each need a pot, with at most five different ingredients between them', () => {
    for (const order of orders('dua')) {
      expect(order).toHaveLength(2);
      for (const recipe of order) expect(cooks(recipe)).toBe(true);
      expect(Object.keys(needsOf(order)).length).toBeLessThanOrEqual(5);
    }
  });

  it('level 4 puts a stirring step, two to four times, before the cooking, in every dish', () => {
    for (const order of orders('aduk')) {
      expect(order).toHaveLength(1);
      const kinds = order[0].steps.map((s) => s.kind);
      expect(kinds.filter((k) => k === 'stir')).toHaveLength(1);
      expect(kinds.indexOf('stir')).toBeLessThan(kinds.indexOf('cook'));
      expect(stirs(order[0])).toBe(true);
      const step = order[0].steps.find((s) => s.kind === 'stir');
      if (step?.kind === 'stir') {
        expect(step.times).toBeGreaterThanOrEqual(2);
        expect(step.times).toBeLessThanOrEqual(4);
      }
    }
  });

  it('level 5 asks each dish what the customer likes, and puts in the answer', () => {
    for (const [recipe] of orders('kalau')) {
      expect(recipe.wish, recipe.id).toBeDefined();
      const branch = recipe.steps.find((s) => s.kind === 'add' && s.branch);
      if (branch?.kind !== 'add' || !branch.branch) throw new Error(`${recipe.id} has no branch`);
      expect(branch.branch.taste).toBe(recipe.wish!.taste);
      expect(branch.ingredient).toBe(recipe.wish!.likes ? branch.branch.yes : branch.branch.no);
      expect(Object.keys(TASTES)).toContain(recipe.wish!.taste);
    }
  });

  it('level 5 serves every dish to a customer who likes the taste and one who does not, so the answer changes', () => {
    const byDish = new Map<string, boolean[]>();
    for (const [recipe] of orders('kalau')) byDish.set(dishBase(recipe), [...(byDish.get(dishBase(recipe)) ?? []), recipe.wish!.likes]);
    expect(byDish.size).toBe(3);
    for (const [dish, likes] of byDish) expect([...likes].sort(), dish).toEqual([false, true]);
  });

  it('level 5 never has two customers in a row asking for the same dish', () => {
    const dishes = orders('kalau').map(([r]) => dishBase(r));
    dishes.forEach((dish, i) => expect(dish).not.toBe(dishes[(i + 1) % dishes.length]));
  });

  it('give each level its own idea, in order: five levels', () => {
    expect(LEVELS).toEqual(['susun', 'tunggu', 'dua', 'aduk', 'kalau']);
  });
});

describe('the customers', () => {
  it('come one after another in the same order, and round again', () => {
    expect(customerFor(0)).toBe(CUSTOMERS[0]);
    expect(customerFor(CUSTOMERS.length)).toBe(CUSTOMERS[0]);
    expect(new Set(CUSTOMERS.map((c) => c.id)).size).toBe(CUSTOMERS.length);
  });

  it('wait a good while, longer where there is more to do', () => {
    for (const level of LEVELS) expect(PATIENCE_MS[level], level).toBeGreaterThanOrEqual(60_000);
    expect(PATIENCE_MS.dua).toBeGreaterThan(PATIENCE_MS.tunggu);
    expect(PATIENCE_MS.tunggu).toBeGreaterThan(PATIENCE_MS.susun);
  });

  it('lose patience steadily from the moment they arrive', () => {
    expect(patienceLeft('susun', 1000, 1000, false)).toBe(1);
    expect(patienceLeft('susun', 1000, 1000 + PATIENCE_MS.susun / 2, false)).toBeCloseTo(0.5);
    expect(patienceLeft('susun', 1000, 1000 + PATIENCE_MS.susun, false)).toBe(0);
    expect(patienceLeft('susun', 1000, 1000 + PATIENCE_MS.susun * 5, false)).toBe(0);
  });

  it('never leave a child who is being guided: the bar stops at the floor', () => {
    expect(patienceLeft('susun', 0, PATIENCE_MS.susun * 5, true)).toBe(PATIENCE_FLOOR);
    expect(patienceLeft('susun', 0, 0, true)).toBe(1);
    expect(PATIENCE_FLOOR).toBeGreaterThan(0.2); // and they still look patient, not upset
  });

  it('go from a smile to a frown as the bar empties', () => {
    expect(moodOf(1)).toBe('happy');
    expect(moodOf(0.51)).toBe('happy');
    expect(moodOf(0.4)).toBe('waiting');
    expect(moodOf(0.2)).toBe('upset');
    expect(moodOf(0)).toBe('upset');
    expect(moodOf(PATIENCE_FLOOR)).toBe('waiting');
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
    for (const level of ['tunggu', 'dua', 'aduk', 'kalau'] as const) {
      for (const order of orders(level)) {
        const needs = needsOf(order);
        const stock = pantryFor(order, 0);
        for (const [id, n] of Object.entries(needs)) expect(stock[id], `${level} ${id}`).toBeGreaterThanOrEqual(n + 1);
      }
    }
  });

  it('counts a shared ingredient for every dish that uses it', () => {
    const [order] = orders('dua'); // nasi goreng and telur rebus both want an egg
    expect(needsOf(order).telur).toBe(2);
  });

  it('keeps the other choice of a branch on the shelf, so the child has to choose', () => {
    for (const [recipe] of orders('kalau')) {
      const step = recipe.steps.find((s) => s.kind === 'add' && s.branch);
      if (step?.kind !== 'add' || !step.branch) throw new Error('no branch');
      const stock = pantryFor([recipe], 0);
      expect(stock[step.branch.yes], recipe.id).toBeGreaterThanOrEqual(1);
      expect(stock[step.branch.no], recipe.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('puts unwanted things on the shelf too, and keeps the shelf to a tray a hand can reach', () => {
    for (const level of LEVELS) {
      orders(level).forEach((order, place) => {
        const needs = needsOf(order);
        const stock = pantryFor(order, place);
        expect(Object.keys(stock).filter((id) => !(id in needs)).length, `${level} ${place}`).toBeGreaterThanOrEqual(1);
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
    let kitchen = kitchenFor('dua'); // nasi goreng (nasi, telur) and telur rebus (telur, air)
    expect(addTarget(kitchen, 'nasi')).toBe(0);
    expect(addTarget(kitchen, 'telur')).toBe(1);
    kitchen = (addIngredient(kitchen, 'telur') as { kitchen: Kitchen }).kitchen;
    expect(kitchen.progress).toEqual([0, 1]);
    kitchen = (addIngredient(kitchen, 'nasi') as { kitchen: Kitchen }).kitchen;
    // Now both dishes want a telur or an air: the egg goes to nasi goreng, the first that asks.
    expect(addTarget(kitchen, 'telur')).toBe(0);
    expect(addTarget(kitchen, 'air')).toBe(1);
  });

  it('refuses to add to a dish that is on the pot', () => {
    let kitchen = fill(kitchenFor('tunggu')); // roti panggang
    kitchen = startCooking(kitchen, 0, 0, true)!;

    expect(addIngredient(kitchen, 'roti').outcome).toBe('wrong');
  });

  it('puts in the one the customer asked for, and calls the other one wrong', () => {
    const likesChili = kitchenFor('kalau', 0); // mie rebus for a customer who likes it spicy
    const dislikes = kitchenFor('kalau', 3); // ... and for one who does not
    for (const k of [likesChili, dislikes]) {
      const stepped = addIngredient(addIngredient(k, 'mie').kitchen, 'air').kitchen;
      expect(wantedIngredient(stepped)).toBe(k === likesChili ? 'cabai' : 'telur');
      expect(addIngredient(stepped, k === likesChili ? 'telur' : 'cabai').outcome).toBe('wrong');
      expect(addIngredient(stepped, k === likesChili ? 'cabai' : 'telur').outcome).toBe('added');
    }
  });
});

describe('stirring', () => {
  const stirKitchen = () => fill(kitchenFor('aduk')); // bubur nasi: nasi, air, stir 4, cook

  it('is not possible until the dish is waiting to be stirred', () => {
    const kitchen = kitchenFor('aduk');
    expect(waitingToStir(kitchen)).toBeNull();
    expect(stirDish(kitchen, 0)).toMatchObject({ outcome: 'wrong' });
    expect(stirDish(kitchen, 0).kitchen).toBe(kitchen);
  });

  it('is waiting once the ingredients are in', () => {
    expect(waitingToStir(stirKitchen())).toBe(0);
    expect(stepOf(stirKitchen(), 0)).toEqual({ kind: 'stir', times: 4 });
  });

  it('counts each stir, and goes on to the next step on the last', () => {
    let kitchen = stirKitchen();
    for (let n = 1; n <= 3; n += 1) {
      const result = stirDish(kitchen, 0);
      expect(result).toMatchObject({ outcome: 'stirred', count: n, stepDone: false, finished: false });
      kitchen = result.kitchen;
      expect(kitchen.stirred).toEqual([n]);
    }
    const last = stirDish(kitchen, 0);
    expect(last).toMatchObject({ outcome: 'stirred', count: 4, stepDone: true, finished: false });
    expect(last.kitchen.stirred).toEqual([0]);
    expect(stepOf(last.kitchen, 0)).toMatchObject({ kind: 'cook' });
  });

  it('cannot be done any more once the stirring is finished, and nothing is used up', () => {
    const kitchen = stirUp(stirKitchen(), 0);
    expect(stirDish(kitchen, 0).outcome).toBe('wrong');
    expect(kitchen.stock).toEqual(stirKitchen().stock);
  });

  it('is lost with the dish when it burns', () => {
    let kitchen = stirUp(stirKitchen(), 0);
    kitchen = startCooking(kitchen, 0, 0, true)!;
    const burnt = takeOff(kitchen, 0, 60_000).kitchen;

    expect(burnt.progress).toEqual([0]);
    expect(burnt.stirred).toEqual([0]);
  });

  it('is a stir count of its own for each dish', () => {
    expect(stirKitchen().stirred).toEqual([0]);
    expect(kitchenFor('dua').stirred).toEqual([0, 0]);
  });
});

describe('the pots', () => {
  const readyToCook = (level: Level = 'tunggu') => fill(kitchenFor(level));

  it('has one for each dish, empty to begin with', () => {
    expect(kitchenFor('tunggu').burners).toEqual([null]);
    expect(kitchenFor('dua').burners).toEqual([null, null]);
  });

  it('is waiting for a dish only once its ingredients are in', () => {
    const empty = kitchenFor('tunggu');
    expect(waitingToCook(empty)).toEqual([]);
    expect(startCooking(empty, 0, 0, true)).toBeNull();

    expect(waitingToCook(readyToCook())).toEqual([0]);
  });

  it('takes a dish on its own pot and not on one that is busy', () => {
    const kitchen = readyToCook();
    const started = startCooking(kitchen, 0, 1000, true)!;

    expect(started.burners[0]).toEqual({ at: 1000, burns: true });
    expect(waitingToCook(started)).toEqual([]);
    expect(startCooking(started, 0, 1100, true)).toBeNull();
  });

  it("cooks for the recipe's seconds, then is ready, then burns - when it can burn", () => {
    const kitchen = startCooking(readyToCook(), 0, 0, true)!; // roti panggang: 3 seconds
    expect(burnerState(kitchen, 0, 0)).toEqual({ state: 'cooking', progress: 0 });
    expect(burnerState(kitchen, 0, 1500).progress).toBeCloseTo(0.5);
    expect(burnerState(kitchen, 0, 2999).state).toBe('cooking');
    expect(burnerState(kitchen, 0, 3000)).toEqual({ state: 'ready', progress: 1 });
    expect(burnerState(kitchen, 0, 3000 + BURN_GRACE_MS - 1).state).toBe('ready');
    expect(burnerState(kitchen, 0, 3000 + BURN_GRACE_MS).state).toBe('burnt');
  });

  it('never burns for a child who is being guided', () => {
    const kitchen = startCooking(readyToCook(), 0, 0, false)!;
    expect(burnerState(kitchen, 0, 3000 + BURN_GRACE_MS * 10).state).toBe('ready');
  });

  it('reports an empty pot as empty', () => {
    expect(burnerState(kitchenFor('tunggu'), 0, 0)).toEqual({ state: 'empty', progress: 0 });
  });

  it('changes nothing when taken off too early', () => {
    const kitchen = startCooking(readyToCook(), 0, 0, true)!;
    const result = takeOff(kitchen, 0, 1000);

    expect(result.outcome).toBe('early');
    expect(result.kitchen).toBe(kitchen);
  });

  it('finishes the dish when taken off ready, and frees the pot', () => {
    const kitchen = startCooking(readyToCook(), 0, 0, true)!;
    const result = takeOff(kitchen, 0, 3500);

    expect(result).toMatchObject({ outcome: 'cooked', dish: 0, finished: true });
    expect(result.kitchen.burners[0]).toBeNull();
    expect(isFinished(result.kitchen)).toBe(true);
  });

  it('throws a burnt dish away: the pot is clear, the dish starts again, and what went in is gone', () => {
    const kitchen = startCooking(readyToCook(), 0, 0, true)!;
    const stockBefore = { ...kitchen.stock };
    const result = takeOff(kitchen, 0, 3000 + BURN_GRACE_MS);

    expect(result).toMatchObject({ outcome: 'burnt', dish: 0 });
    expect(result.kitchen.burners[0]).toBeNull();
    expect(result.kitchen.progress).toEqual([0]);
    expect(result.kitchen.stock).toEqual(stockBefore); // nothing comes back
    expect(dishDone(result.kitchen, 0)).toBe(false);
  });

  it('does nothing for a pot with nothing on it', () => {
    expect(takeOff(kitchenFor('tunggu'), 0, 0).outcome).toBe('none');
  });

  it('cooks two dishes at once, each in its own pot, and only the one that is waiting can be started', () => {
    let kitchen = readyToCook('dua');
    expect(waitingToCook(kitchen)).toEqual([0, 1]);
    kitchen = startCooking(kitchen, 1, 500, true)!;

    expect(kitchen.burners.map((b) => b !== null)).toEqual([false, true]);
    expect(waitingToCook(kitchen)).toEqual([0]);
    kitchen = startCooking(kitchen, 0, 0, true)!;
    expect(kitchen.burners.map((b) => b?.at)).toEqual([0, 500]);
  });

  it('is not started for a dish that is not waiting, even with a pot free', () => {
    const kitchen = addIngredient(kitchenFor('dua'), 'nasi').kitchen; // nasi goreng still wants its egg
    expect(startCooking(kitchen, 0, 0, true)).toBeNull();
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
    let k = fill(kitchen);
    k = startCooking(k, 0, 0, true)!;
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
    for (const id of ['roti', 'keju']) kitchen = addIngredient(kitchen, id).kitchen;
    expect(shortOfStock(kitchen)).toBe(false);
  });
});

describe('pointing the way', () => {
  it('starts with the first ingredient of the recipe', () => {
    expect(nextPointer(kitchenFor('susun'), 0)).toEqual({ kind: 'ingredient', id: 'roti' });
  });

  it('points at the pot once a dish is ready to cook', () => {
    expect(nextPointer(fill(kitchenFor('tunggu')), 0)).toEqual({ kind: 'burner', dish: 0 });
  });

  it('points at the spoon when a dish is waiting to be stirred', () => {
    expect(nextPointer(fill(kitchenFor('aduk')), 0)).toEqual({ kind: 'spoon', dish: 0 });
  });

  it('points at the pot after the stirring, then at nothing while it cooks', () => {
    let kitchen = stirUp(fill(kitchenFor('aduk')), 0);
    expect(nextPointer(kitchen, 0)).toEqual({ kind: 'burner', dish: 0 });
    kitchen = startCooking(kitchen, 0, 0, true)!;
    expect(nextPointer(kitchen, 1000)).toBeNull();
  });

  it('points at a ready dish before anything else: it is the one that can spoil', () => {
    let kitchen = kitchenFor('dua');
    for (const id of ['nasi', 'telur']) kitchen = addIngredient(kitchen, id).kitchen; // telur goes to telur rebus first
    kitchen = addIngredient(kitchen, 'telur').kitchen;
    kitchen = startCooking(kitchen, 0, 0, true)!;
    expect(nextPointer(kitchen, 4500)).toEqual({ kind: 'burner', dish: 0 });
  });

  it('keeps working on the second dish while the first cooks', () => {
    let kitchen = kitchenFor('dua');
    for (const id of ['nasi', 'telur']) kitchen = addIngredient(kitchen, id).kitchen;
    kitchen = addIngredient(kitchen, 'telur').kitchen;
    kitchen = startCooking(kitchen, 0, 0, true)!;
    expect(nextPointer(kitchen, 1000)).toEqual({ kind: 'ingredient', id: 'air' });
  });

  it('names what to look for after a wrong pick, and nothing when only stirring or cooking is left', () => {
    let kitchen = kitchenFor('tunggu');
    expect(wantedIngredient(kitchen)).toBe('roti');
    kitchen = fill(kitchen);
    expect(wantedIngredient(kitchen)).toBeNull();
  });
});
