import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AUDIO_DIR,
  AUDIO_EXTENSIONS,
  IMAGE_DIR,
  IMAGE_EXTENSIONS,
  buildRegistry,
  manifestLoaded,
  mediaId,
} from '../media/manifest';
import { clipPool, clipUrl, hasRecordedVoice } from '../media/clips';
import { wordPicture } from '../media/pictures';
import {
  AUDIO_EXTENSIONS as NODE_AUDIO,
  IMAGE_EXTENSIONS as NODE_IMAGE,
  renderManifest,
  writeManifest,
} from '../../scripts/media-manifest.mjs';
import { setMediaManifest } from './setup';

/**
 * A static page cannot list a folder, so everything customised flows through
 * media/manifest.js. Get parsing wrong and a recording silently stops being
 * used - with no error anywhere - so this is worth pinning down carefully.
 */
describe('media manifest', () => {
  describe('buildRegistry', () => {
    it('keys each file by its lowercased path without the extension', () => {
      const { urls } = buildRegistry(['Words/Apel.MP3', 'letters/id/b.wav'], AUDIO_DIR, AUDIO_EXTENSIONS);

      expect(Object.keys(urls)).toEqual(['words/apel', 'letters/id/b']);
    });

    it('resolves URLs relative to the page, keeping the original filename case', () => {
      const { urls } = buildRegistry(['words/Apel.mp3'], AUDIO_DIR, AUDIO_EXTENSIONS);

      // Relative - never a leading slash - so it works from file:// and from a
      // subfolder on a web host.
      expect(urls['words/apel']).toBe('media/audio/words/Apel.mp3');
    });

    it('percent-encodes names with spaces or hashes', () => {
      const { urls } = buildRegistry(['praise/bagus sekali.wav', 'words/c#.mp3'], AUDIO_DIR, AUDIO_EXTENSIONS);

      expect(urls['praise/bagus sekali']).toBe('media/audio/praise/bagus%20sekali.wav');
      expect(urls['words/c#']).toBe('media/audio/words/c%23.mp3');
    });

    it('accepts Windows-style separators and stray leading slashes', () => {
      const { urls } = buildRegistry(['letters\\id\\a.mp3', '/words/apel.mp3'], AUDIO_DIR, AUDIO_EXTENSIONS);

      expect(Object.keys(urls).sort()).toEqual(['letters/id/a', 'words/apel']);
    });

    it('rejects unsupported formats and says why', () => {
      const { urls, rejected } = buildRegistry(['words/apel.flac', 'words/buku.mp3'], AUDIO_DIR, AUDIO_EXTENSIONS);

      expect(Object.keys(urls)).toEqual(['words/buku']);
      expect(rejected).toEqual([{ entry: 'words/apel.flac', reason: 'format tidak didukung' }]);
    });

    it('never lets a hand-edited entry climb out of media/', () => {
      const { urls, rejected } = buildRegistry(
        ['../secret.mp3', 'words/../../x.mp3', 'a//b.mp3'],
        AUDIO_DIR,
        AUDIO_EXTENSIONS,
      );

      expect(urls).toEqual({});
      expect(rejected).toHaveLength(3);
    });

    it('skips blanks and non-strings instead of throwing', () => {
      const { urls, rejected } = buildRegistry(['', '   ', 42, null, 'words/apel.mp3'], AUDIO_DIR, AUDIO_EXTENSIONS);

      expect(Object.keys(urls)).toEqual(['words/apel']);
      expect(rejected).toHaveLength(4);
    });

    it('treats anything that is not a list as empty', () => {
      expect(buildRegistry(undefined, AUDIO_DIR, AUDIO_EXTENSIONS).urls).toEqual({});
      expect(buildRegistry('words/apel.mp3', AUDIO_DIR, AUDIO_EXTENSIONS).urls).toEqual({});
      expect(buildRegistry({ 0: 'x.mp3' }, AUDIO_DIR, AUDIO_EXTENSIONS).urls).toEqual({});
    });

    it('collapses two files that share an id into one', () => {
      // apel.mp3 and apel.wav both map to words/apel; the app can only play one.
      const { urls } = buildRegistry(['words/apel.mp3', 'words/apel.wav'], AUDIO_DIR, AUDIO_EXTENSIONS);

      expect(Object.keys(urls)).toEqual(['words/apel']);
    });
  });

  describe('mediaId', () => {
    it('strips only the final extension', () => {
      expect(mediaId('words/es-krim.mp3')).toBe('words/es-krim');
      expect(mediaId('words/v1.2.final.wav')).toBe('words/v1.2.final');
    });
  });

  describe('reading window.BELAJAR_MEDIA', () => {
    it('reports no manifest, and no customisation, when the script never loaded', () => {
      setMediaManifest(undefined);

      expect(manifestLoaded()).toBe(false);
      expect(clipUrl('words/apel')).toBeUndefined();
      expect(hasRecordedVoice()).toBe(false);
    });

    it('serves clips and pictures from the manifest', () => {
      setMediaManifest({ audio: ['words/apel.wav', 'praise/a.wav', 'praise/b.wav'], images: ['words/apel.svg'] });

      expect(manifestLoaded()).toBe(true);
      expect(clipUrl('words/apel')).toBe(`${AUDIO_DIR}words/apel.wav`);
      expect(wordPicture('Apel')).toBe(`${IMAGE_DIR}words/apel.svg`);
      expect(clipPool('praise')).toHaveLength(2);
      expect(hasRecordedVoice()).toBe(true);
    });

    it('does not count sound effects alone as a recorded voice', () => {
      setMediaManifest({ audio: ['ui/pop.wav'], images: [] });

      expect(hasRecordedVoice()).toBe(false);
    });

    it('looks words up by slug, so "Es Krim" finds es-krim', () => {
      setMediaManifest({ audio: [], images: ['words/es-krim.png'] });

      expect(wordPicture('Es Krim')).toBe(`${IMAGE_DIR}words/es-krim.png`);
    });
  });

  /**
   * The list of supported extensions lives in three places: the app, the Node
   * generator, and the PowerShell script that ships to people with no Node.
   * If they drift, a file the generator lists is one the app then refuses.
   */
  describe('the three copies of the extension lists', () => {
    it('agree between the app and the Node generator', () => {
      expect([...AUDIO_EXTENSIONS]).toEqual(NODE_AUDIO);
      expect([...IMAGE_EXTENSIONS]).toEqual(NODE_IMAGE);
    });

    it('agree with the PowerShell script that ships to customers', () => {
      const ps = readFileSync(join(process.cwd(), 'packaging', 'Perbarui-Media.ps1'), 'utf8');
      const listed = (name: string) =>
        [...ps.match(new RegExp(`\\$${name}\\s*=\\s*@\\(([^)]*)\\)`))![1].matchAll(/'\.([a-z0-9]+)'/g)].map((m) => m[1]);

      expect(listed('audioExt')).toEqual([...AUDIO_EXTENSIONS]);
      expect(listed('imageExt')).toEqual([...IMAGE_EXTENSIONS]);
    });

    it('keeps the PowerShell script ASCII, which Windows PowerShell 5.1 needs', () => {
      const ps = readFileSync(join(process.cwd(), 'packaging', 'Perbarui-Media.ps1'), 'utf8');

      expect(ps).not.toMatch(/[^\x00-\x7f]/);
    });
  });

  describe('the manifest generator', () => {
    const made: string[] = [];
    afterEach(() => made.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

    function makeMediaDir(files: Record<string, string>): string {
      const dir = mkdtempSync(join(tmpdir(), 'belajar-yuk-media-'));
      made.push(dir);
      for (const [path, content] of Object.entries(files)) {
        const full = join(dir, path);
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, content);
      }
      return dir;
    }

    it('lists supported files with forward slashes and reports the rest as ignored', () => {
      const dir = makeMediaDir({
        'audio/words/apel.mp3': 'x',
        'audio/letters/id/a.WAV': 'x',
        'audio/words/notes.txt': 'not media - never reported',
        'audio/words/take1.flac': 'x',
        'images/words/apel.png': 'x',
        'images/.DS_Store': 'x',
      });

      const result = writeManifest(dir);

      expect(result.audio).toEqual(['letters/id/a.WAV', 'words/apel.mp3']);
      expect(result.images).toEqual(['words/apel.png']);
      expect(result.ignored).toEqual(['words/take1.flac']);
    });

    it('writes a script that the app parses back to the same files', () => {
      const dir = makeMediaDir({
        'audio/praise/bagus sekali.wav': 'x',
        'audio/words/apel.mp3': 'x',
        'images/home/hitung.svg': 'x',
      });
      writeManifest(dir);

      // Execute it exactly as a <script> tag would.
      const fakeWindow: Window = {} as Window;
      new Function('window', readFileSync(join(dir, 'manifest.js'), 'utf8'))(fakeWindow);
      const manifest = fakeWindow.BELAJAR_MEDIA!;

      expect(manifest.audio).toEqual(['praise/bagus sekali.wav', 'words/apel.mp3']);
      expect(manifest.images).toEqual(['home/hitung.svg']);
    });

    it('writes valid, empty lists when nothing has been added yet', () => {
      const dir = makeMediaDir({});
      writeManifest(dir);

      const fakeWindow: Window = {} as Window;
      new Function('window', readFileSync(join(dir, 'manifest.js'), 'utf8'))(fakeWindow);

      expect(fakeWindow.BELAJAR_MEDIA).toEqual({ audio: [], images: [] });
    });

    it('starts with a comment, not a byte-order mark', () => {
      expect(renderManifest([], []).startsWith('//')).toBe(true);
    });
  });
});
