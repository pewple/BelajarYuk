// Builds the drag-and-drop release:
//
//   npm run package
//
//   release/Belajar-Yuk/       double-click index.html, or drag the folder onto
//                              a static host (e.g. app.netlify.com/drop)
//   release/Belajar-Yuk.zip    the same folder, zipped for sharing
//
// Expects `vite build` to have run (the npm script does that first).

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import { writeManifest } from './media-manifest.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const releaseRoot = join(root, 'release');
const NAME = 'Belajar-Yuk';
const out = join(releaseRoot, NAME);
const zip = join(releaseRoot, `${NAME}.zip`);

function fail(message) {
  console.error(`\nGAGAL: ${message}`);
  process.exit(1);
}

if (!existsSync(join(dist, 'index.html'))) fail('dist/index.html tidak ada. Jalankan `npm run build` dulu.');

/* ---------- 1. copy the build ---------- */

rmSync(out, { recursive: true, force: true });
rmSync(zip, { force: true });
mkdirSync(releaseRoot, { recursive: true });
cpSync(dist, out, { recursive: true });

/* ---------- 2. empty customisation folders, ready to fill ---------- */

// Kept as plain lists rather than derived from src/media/slots.ts: the packager
// is dependency-free Node, and these folders almost never change. The media
// check page (#media) is what actually verifies coverage.
const AUDIO_FOLDERS = ['letters/id', 'letters/en', 'words', 'numbers', 'praise', 'phrases', 'ui'];
const IMAGE_FOLDERS = ['words', 'counting', 'home'];

for (const folder of AUDIO_FOLDERS) mkdirSync(join(out, 'media', 'audio', folder), { recursive: true });
for (const folder of IMAGE_FOLDERS) mkdirSync(join(out, 'media', 'images', folder), { recursive: true });

// Regenerate from whatever is actually in the folder, so anything already
// dropped into public/media is listed rather than silently ignored.
const media = writeManifest(join(out, 'media'));

/* ---------- 3. the end-user helpers ---------- */

// Windows batch files and Notepad expect CRLF; files written here are LF.
const crlf = (text) => text.replace(/\r?\n/g, '\r\n');

for (const file of ['Perbarui-Media.bat', 'Perbarui-Media.ps1', 'BACA-SAYA.txt']) {
  const text = readFileSync(join(root, 'packaging', file), 'utf8');
  writeFileSync(join(out, file), crlf(text), 'utf8');
}

/* ---------- 4. verify it will actually open from disk ---------- */

const html = readFileSync(join(out, 'index.html'), 'utf8');

if (/type="module"/.test(html)) fail('index.html masih memuat <script type="module"> - tidak akan jalan lewat file://.');
if (/\scrossorigin/.test(html)) fail('index.html masih memakai crossorigin - akan diblokir lewat file://.');

const references = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((url) => !/^(?:data:|https?:|#)/.test(url));

for (const url of references) {
  if (/^\/(?!\/)/.test(url)) fail(`index.html memakai alamat absolut "${url}" - rusak bila dibuka dari folder.`);
  if (!existsSync(join(out, url))) fail(`index.html merujuk ke "${url}" tetapi berkasnya tidak ada.`);
}

if (!references.some((url) => url.endsWith('media/manifest.js'))) fail('index.html tidak memuat media/manifest.js.');

const nonAscii = /[^\x00-\x7f]/;
if (nonAscii.test(readFileSync(join(out, 'Perbarui-Media.ps1'), 'utf8'))) {
  fail('Perbarui-Media.ps1 memuat karakter non-ASCII; Windows PowerShell 5.1 akan salah membacanya.');
}

/* ---------- 5. zip ---------- */

let zipped = false;
{
  // bsdtar ships with Windows 10+ and macOS; Info-ZIP `zip` covers the rest.
  const tar = spawnSync('tar', ['-a', '-c', '-f', zip, '-C', releaseRoot, NAME], { stdio: 'ignore' });
  zipped = tar.status === 0;
  if (!zipped) {
    const z = spawnSync('zip', ['-r', '-q', zip, NAME], { cwd: releaseRoot, stdio: 'ignore' });
    zipped = z.status === 0;
  }
}

/* ---------- report ---------- */

function sizeOf(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const full = join(dir, entry.name);
    return sum + (entry.isDirectory() ? sizeOf(full) : statSync(full).size);
  }, 0);
}
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

console.log('\nSelesai.\n');
console.log(`  Folder : ${out}  (${kb(sizeOf(out))})`);
console.log(zipped ? `  Zip    : ${zip}  (${kb(statSync(zip).size)})` : '  Zip    : dilewati (tidak ada tar/zip di sistem)');
console.log(`  Media  : ${media.audio.length} suara, ${media.images.length} gambar sudah terdaftar`);
console.log(`\n  Buka   : ${join(out, 'index.html')}`);
console.log(`  Cek    : ${basename(out)}/index.html#media\n`);
