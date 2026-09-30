import { slugify } from './slug';
import { imageRegistry } from './manifest';

/**
 * Your own artwork, replacing the lucide icons.
 *
 * Same deal as the audio clips: drop a file into `media/images/` and list it
 * in `media/manifest.js` (Perbarui-Media.bat does that). The id is the path
 * under that folder without the extension:
 *
 *   media/images/words/apel.png       -> replaces the Apple icon
 *   media/images/counting/apel.png    -> the object tapped in Berhitung
 *   media/images/home/huruf.png       -> the Mengenal Huruf card
 *
 * Any word without a picture keeps its lucide icon, so you can replace them
 * one at a time.
 */

export function pictureUrl(id: string): string | undefined {
  return imageRegistry().urls[id.toLowerCase()];
}

/** Artwork for a Belajar Bicara card, e.g. "Es Krim" -> words/es-krim. */
export function wordPicture(word: string): string | undefined {
  return pictureUrl(`words/${slugify(word)}`);
}

/** Artwork for the objects counted in Berhitung, e.g. "apel". */
export function countingPicture(label: string): string | undefined {
  return pictureUrl(`counting/${slugify(label)}`);
}

/** Artwork for a home screen card, keyed by its screen id. */
export function homePicture(id: string): string | undefined {
  return pictureUrl(`home/${slugify(id)}`);
}
