// Scans media/audio and media/images and writes media/manifest.js.
//
//   node scripts/media-manifest.mjs [mediaDir]     (default: public/media)
//
// The packaged folder has no Node, so packaging/Perbarui-Media.ps1 does the
// same job in PowerShell. Keep the two in step: same extensions, same output.

import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'webm', 'aac'];
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'avif'];

/** Files that live in these folders but are not media, so are never reported. */
const NOT_MEDIA = /\.(txt|md|js|json|html|url)$|^[._]/i;

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function scan(root, extensions) {
  const found = [];
  const ignored = [];

  for (const file of walk(root)) {
    const rel = relative(root, file).split(sep).join('/');
    const name = rel.split('/').pop();
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';

    if (extensions.includes(ext)) found.push(rel);
    else if (!NOT_MEDIA.test(name)) ignored.push(rel);
  }

  return { found: found.sort((a, b) => a.localeCompare(b)), ignored };
}

const quote = (s) => JSON.stringify(s);

export function renderManifest(audio, images) {
  const list = (items) => items.map((item) => `    ${quote(item)}`).join(',\n');
  return (
    // Identical to the PowerShell twin's header, and mentions no developer
    // tooling: this file ends up in front of people who have none.
    '// Dibuat otomatis oleh Perbarui-Media.bat. Boleh diedit tangan:\n' +
    '// cukup tulis jalur berkas relatif terhadap media/audio/ dan media/images/.\n' +
    'window.BELAJAR_MEDIA = {\n' +
    `  audio: [\n${list(audio)}${audio.length ? '\n' : ''}  ],\n` +
    `  images: [\n${list(images)}${images.length ? '\n' : ''}  ]\n` +
    '};\n'
  );
}

/** Scans `mediaDir`, writes its manifest.js, and returns what it found. */
export function writeManifest(mediaDir) {
  const audio = scan(join(mediaDir, 'audio'), AUDIO_EXTENSIONS);
  const images = scan(join(mediaDir, 'images'), IMAGE_EXTENSIONS);

  writeFileSync(join(mediaDir, 'manifest.js'), renderManifest(audio.found, images.found), 'utf8');

  return {
    audio: audio.found,
    images: images.found,
    ignored: [...audio.ignored, ...images.ignored],
  };
}

// Run directly: `node scripts/media-manifest.mjs`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mediaDir = process.argv[2] ?? 'public/media';
  const { audio, images, ignored } = writeManifest(mediaDir);

  console.log(`manifest.js ditulis di ${mediaDir}`);
  console.log(`  suara : ${audio.length}`);
  console.log(`  gambar: ${images.length}`);
  for (const file of ignored) console.log(`  diabaikan (format tidak didukung): ${file}`);
}
