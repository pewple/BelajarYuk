import type { Food } from '../data/kuda';
import { KUDA_CLIP_IDS, kudaFoodClipId } from './clips';
import type { Part } from './voiceParts';

/** "Ayo main dengan kuda!" - when Kuda opens. */
export const helloLine = (): Part[] => [{ clip: KUDA_CLIP_IDS.hello, text: 'Ayo main dengan kuda!' }];

/** "Nyam nyam! Kuda suka wortel!" - the food is eaten. */
export const ateLine = (food: Food): Part[] => [
  { clip: KUDA_CLIP_IDS.yum, text: 'Nyam nyam!' },
  { clip: KUDA_CLIP_IDS.likes, text: 'Kuda suka' },
  { clip: kudaFoodClipId(food.id), text: `${food.name.toLowerCase()}!` },
];

/** Tapped something that costs more stars than there are. */
export const notEnoughLine = (): Part[] => [
  { clip: KUDA_CLIP_IDS.notEnough, text: 'Bintangnya belum cukup. Ayo main dulu!' },
];

/** A colour was bought and put on. */
export const prettyLine = (): Part[] => [{ clip: KUDA_CLIP_IDS.pretty, text: 'Wah, cantik!' }];

/** A different horse was bought and brought out. */
export const newHorseLine = (): Part[] => [{ clip: KUDA_CLIP_IDS.newHorse, text: 'Hore, kuda baru!' }];
