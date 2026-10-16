// Writes dist/sw.js: the service worker that lets the app open with no network.
// Runs by itself after `npm run build` (the `postbuild` script).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildServiceWorker, listFiles, mediaFilesIn, versionOf } from './sw-lib.mjs';

const dist = resolve(import.meta.dirname, '..', 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html tidak ada - jalankan `npm run build` dulu.');
  process.exit(1);
}

const all = listFiles(dist).filter((path) => path !== 'sw.js');

// media/ is handled on its own (see below); the rest is the app.
const shell = all.filter((path) => !path.startsWith('media/') && !path.endsWith('.map'));

const manifestPath = join(dist, 'media', 'manifest.js');
const media = existsSync(manifestPath) ? mediaFilesIn(readFileSync(manifestPath, 'utf8')) : [];

const version = versionOf(shell.map((path) => [path, readFileSync(join(dist, path))]));

writeFileSync(join(dist, 'sw.js'), buildServiceWorker({ shell, media, version }));
console.log(`dist/sw.js  versi ${version}  ${shell.length} berkas aplikasi, ${media.length} suara/gambar`);
