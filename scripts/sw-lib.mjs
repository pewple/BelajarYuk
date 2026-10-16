// The parts of building sw.js that are worth testing on their own.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const template = () => readFileSync(join(import.meta.dirname, 'sw-template.js'), 'utf8');

/**
 * Every file under `dir`, as forward-slash paths relative to it, sorted so the
 * same folder always gives the same list.
 */
export function listFiles(dir) {
  const found = [];
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(relative(dir, full).split(sep).join('/'));
    }
  };
  walk(dir);
  return found.sort();
}

/**
 * The audio and image files named in media/manifest.js, as paths from the site
 * root ("media/audio/words/apel.mp3"). The file is a plain script that sets
 * `window.BELAJAR_MEDIA`; it is run here with a stand-in window to read it.
 */
export function mediaFilesIn(manifestText) {
  const fake = {};
  try {
    new Function('window', manifestText)(fake);
  } catch {
    return [];
  }
  const { audio, images } = fake.BELAJAR_MEDIA ?? {};
  const named = (list, folder) =>
    (Array.isArray(list) ? list : []).filter((p) => typeof p === 'string').map((p) => `media/${folder}/${p}`);
  return [...named(audio, 'audio'), ...named(images, 'images')];
}

/**
 * A short name for this version of the app: a hash of the files the page is
 * made of. Change any of them and the name changes, which is what makes the old
 * stored copy get thrown away.
 */
export function versionOf(files) {
  const hash = createHash('sha256');
  for (const [path, contents] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
    hash.update(path).update('\0').update(contents).update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

/** The finished service worker source. */
export function buildServiceWorker({ shell, media, version }) {
  return template()
    .replace("'__VERSION__'", JSON.stringify(version))
    .replace('__SHELL__', JSON.stringify(shell, null, 2))
    .replace('__MEDIA__', JSON.stringify(media, null, 2));
}
