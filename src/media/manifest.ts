/**
 * Runtime list of the customer's own sound and picture files.
 *
 * A static web page cannot list a folder, so `media/manifest.js` - a plain
 * script loaded before the app - tells it what is there:
 *
 *   window.BELAJAR_MEDIA = {
 *     audio:  ['words/apel.mp3', 'letters/id/b.wav'],   // under media/audio/
 *     images: ['words/apel.png', 'home/hitung.svg'],     // under media/images/
 *   };
 *
 * It is written by Perbarui-Media.bat / `npm run media`, and is short enough
 * to edit by hand. Because it is read at runtime rather than baked in at
 * build time, adding a recording never needs a rebuild - which is what makes
 * the packaged folder customisable by someone with no developer tools.
 */

declare global {
  interface Window {
    BELAJAR_MEDIA?: { audio?: unknown; images?: unknown };
  }
}

export const AUDIO_DIR = 'media/audio/';
export const IMAGE_DIR = 'media/images/';

export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'webm', 'aac'] as const;
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'avif'] as const;

/** Lookup key for a file: its path without the extension, lowercased. */
export function mediaId(path: string): string {
  return path.replace(/\.[^./]+$/, '').toLowerCase();
}

function extensionOf(path: string): string {
  const match = /\.([^./]+)$/.exec(path);
  return match ? match[1].toLowerCase() : '';
}

/** Turns one manifest entry into a safe relative path, or null to skip it. */
function cleanEntry(entry: unknown): string | null {
  if (typeof entry !== 'string') return null;

  const path = entry.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (path === '') return null;
  // Never let a hand-edited manifest reach outside media/.
  if (path.split('/').some((part) => part === '..' || part === '')) return null;
  return path;
}

/** Encode each segment so names with spaces or # still resolve as URLs. */
function toUrl(dir: string, path: string): string {
  return dir + path.split('/').map(encodeURIComponent).join('/');
}

export type MediaRegistry = {
  /** id -> URL, in manifest order. */
  urls: Record<string, string>;
  /** Entries that were skipped, with the reason - shown by the media check page. */
  rejected: { entry: string; reason: string }[];
};

export function buildRegistry(
  entries: unknown,
  dir: string,
  extensions: readonly string[],
): MediaRegistry {
  const urls: Record<string, string> = {};
  const rejected: MediaRegistry['rejected'] = [];

  if (!Array.isArray(entries)) return { urls, rejected };

  for (const raw of entries) {
    const path = cleanEntry(raw);
    if (path === null) {
      rejected.push({ entry: String(raw), reason: 'nama berkas tidak valid' });
      continue;
    }
    if (!extensions.includes(extensionOf(path))) {
      rejected.push({ entry: path, reason: 'format tidak didukung' });
      continue;
    }
    urls[mediaId(path)] = toUrl(dir, path);
  }

  return { urls, rejected };
}

type Loaded = { audio: MediaRegistry; images: MediaRegistry; found: boolean };

let cache: Loaded | null = null;

function load(): Loaded {
  if (cache) return cache;
  const source = typeof window === 'undefined' ? undefined : window.BELAJAR_MEDIA;
  cache = {
    audio: buildRegistry(source?.audio, AUDIO_DIR, AUDIO_EXTENSIONS),
    images: buildRegistry(source?.images, IMAGE_DIR, IMAGE_EXTENSIONS),
    found: source !== undefined,
  };
  return cache;
}

export function audioRegistry(): MediaRegistry {
  return load().audio;
}

export function imageRegistry(): MediaRegistry {
  return load().images;
}

/** False when media/manifest.js was missing or failed to load. */
export function manifestLoaded(): boolean {
  return load().found;
}

/** Forget the parsed manifest. Tests use this after changing `window.BELAJAR_MEDIA`. */
export function reloadMedia(): void {
  cache = null;
}
