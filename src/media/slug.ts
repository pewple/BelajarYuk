/**
 * Turns a display string into the filename it maps to.
 *
 * "Es Krim" -> "es-krim", "X-Ray" -> "x-ray". This is the whole contract
 * between the words in `curriculum.ts` and the files on disk, so keep it
 * boring and predictable.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    // Strip combining accents so "é" and "e" resolve to the same filename.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
