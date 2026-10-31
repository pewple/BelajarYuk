import { INGREDIENTS, dishBase } from '../data/memasak';
import type { Recipe } from '../data/memasak';
import { COOK_CLIP_IDS, dishClipId, ingredientClipId } from './clips';
import type { Part } from './voiceParts';

/** One ingredient's name. */
export function ingredientPart(id: string): Part {
  const ingredient = INGREDIENTS.find((i) => i.id === id);
  return { clip: ingredientClipId(id), text: ingredient?.name ?? id };
}

/** One dish's name. */
export function dishPart(recipe: Recipe): Part {
  return { clip: dishClipId(dishBase(recipe)), text: recipe.name };
}

/** "Pilih cara memasak!" - the screen before the cooking starts. */
export const chooseLine = (): Part[] => [{ clip: COOK_CLIP_IDS.choose, text: 'Pilih cara memasak!' }];

/**
 * "Ayo masak roti keju!" - or "Ayo masak nasi goreng dan telur rebus!". With one
 * dish it goes on to name what goes in, in order, so the child hears the recipe
 * as well as seeing it.
 */
export function orderLine(order: Recipe[], withIngredients: boolean): Part[] {
  const parts: Part[] = [{ clip: COOK_CLIP_IDS.letsCook, text: 'Ayo masak' }];
  order.forEach((recipe, i) => {
    if (i > 0) parts.push({ clip: COOK_CLIP_IDS.and, text: 'dan' });
    parts.push(dishPart(recipe));
  });
  // The sentence ends here, or goes on to the ingredients.
  const last = parts.length - 1;
  parts[last] = { ...parts[last], text: `${parts[last].text}!` };

  if (withIngredients && order.length === 1) {
    const names = order[0].steps.flatMap((step) => (step.kind === 'add' ? [ingredientPart(step.ingredient)] : []));
    // A comma between the names keeps them separate words ("roti, keju, roti").
    names.forEach((part, i) => parts.push({ ...part, text: i < names.length - 1 ? `${part.text},` : `${part.text}!` }));
  }
  return parts;
}

/** "Cari telur!" - after a wrong pick. */
export const findLine = (id: string): Part[] => {
  const name = ingredientPart(id);
  return [{ clip: COOK_CLIP_IDS.find, text: 'Cari' }, { ...name, text: `${name.text}!` }];
};

/** "Nasi goreng jadi!" */
export const doneLine = (recipe: Recipe): Part[] => [dishPart(recipe), { clip: COOK_CLIP_IDS.done, text: 'jadi!' }];

/** "Ketuk bel!" - a customer is waiting to come in. */
export const bellLine = (): Part[] => [{ clip: COOK_CLIP_IDS.bell, text: 'Ketuk bel!' }];
/** "Selamat datang!" - the customer is at the counter. */
export const welcomeLine = (): Part[] => [{ clip: COOK_CLIP_IDS.welcome, text: 'Selamat datang!' }];
/** The customer gave up waiting. */
export const upsetLine = (): Part[] => [{ clip: COOK_CLIP_IDS.upset, text: 'Yah, pelanggannya kecewa. Coba lagi!' }];
/** "Aduk!" - what to do when a dish is waiting to be stirred. */
export const stirLine = (): Part[] => [{ clip: COOK_CLIP_IDS.stir, text: 'Aduk!' }];
export const cookNowLine = (): Part[] => [{ clip: COOK_CLIP_IDS.cookNow, text: 'Masak dulu!' }];
export const waitLine = (): Part[] => [{ clip: COOK_CLIP_IDS.wait, text: 'Tunggu ya!' }];
export const readyLine = (): Part[] => [{ clip: COOK_CLIP_IDS.ready, text: 'Sudah matang! Ketuk!' }];
export const burntLine = (): Part[] => [{ clip: COOK_CLIP_IDS.burnt, text: 'Gosong! Coba lagi.' }];
export const outLine = (): Part[] => [{ clip: COOK_CLIP_IDS.out, text: 'Habis!' }];
export const shopAgainLine = (): Part[] => [{ clip: COOK_CLIP_IDS.shopAgain, text: 'Habis! Ayo belanja lagi!' }];
