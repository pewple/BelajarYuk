import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { registerServiceWorker } from '../pwa';
import type { PwaEnvironment } from '../pwa';
import { buildServiceWorker, mediaFilesIn, versionOf } from '../../scripts/sw-lib.mjs';

const root = join(import.meta.dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path));

/* ------------------------------------------------------------------ */
/* The manifest and the icons                                          */
/* ------------------------------------------------------------------ */

type Icon = { src: string; sizes: string; type: string; purpose?: string };
const manifest = JSON.parse(read('public/manifest.webmanifest').toString('utf8')) as Record<string, unknown> & {
  icons: Icon[];
};
const html = read('index.html').toString('utf8');

/** The width and height written in a PNG's header, or null if it is not a PNG. */
function pngSize(file: Buffer): { width: number; height: number } | null {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!file.subarray(0, 8).equals(signature)) return null;
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

describe('the web app manifest', () => {
  it('names the app and opens it full screen, as an app', () => {
    expect(manifest.name).toBe('Belajar Yuk!');
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('id');
  });

  it('uses relative addresses, so it works from any folder it is hosted in', () => {
    for (const key of ['start_url', 'scope', 'id'] as const) {
      expect(String(manifest[key]), key).toMatch(/^\.\/?$/);
    }
    for (const icon of manifest.icons) expect(icon.src).not.toMatch(/^\/|^https?:/);
  });

  it('has the cream of the app for its background and its bar', () => {
    expect(manifest.background_color).toBe('#fffbeb');
    expect(manifest.theme_color).toBe('#fffbeb');
    expect(html).toContain('<meta name="theme-color" content="#fffbeb" />');
  });

  it('declares icons that exist and are exactly the size they say', () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of manifest.icons) {
      const size = pngSize(read(`public/${icon.src}`));
      const [w, h] = icon.sizes.split('x').map(Number);

      expect(size, icon.src).not.toBeNull();
      expect(size, icon.src).toEqual({ width: w, height: h });
      expect(icon.type).toBe('image/png');
    }
  });

  it('has the sizes a browser needs to offer installing: 192 and 512, plus a maskable one', () => {
    const sizes = manifest.icons.filter((i) => i.purpose === 'any').map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512')).toBe(true);
  });

  it('keeps maskable and ordinary icons apart: one file never claims both', () => {
    for (const icon of manifest.icons) expect(icon.purpose).not.toMatch(/any.*maskable|maskable.*any/);
  });
});

describe('the page', () => {
  it('links the manifest and the icons', () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"');
    expect(html).toContain('href="/icons/icon-192.png"');
  });

  it('has an iOS touch icon of the size iOS wants, and it is a real PNG', () => {
    expect(pngSize(read('public/icons/apple-touch-icon.png'))).toEqual({ width: 180, height: 180 });
  });

  it('opens full screen from the home screen on iOS and Android', () => {
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toContain('name="mobile-web-app-capable"');
  });
});

/* ------------------------------------------------------------------ */
/* Registering                                                         */
/* ------------------------------------------------------------------ */

describe('registering the service worker', () => {
  const env = (over: Partial<PwaEnvironment> = {}) => {
    const register = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration));
    const pending: (() => void)[] = [];
    const full: PwaEnvironment = {
      production: true,
      protocol: 'https:',
      serviceWorker: { register },
      whenLoaded: (run) => pending.push(run),
      ...over,
    };
    return { full, register, load: () => pending.forEach((run) => run()) };
  };

  it('registers ./sw.js - relative, so it works from any folder - once the page has loaded', () => {
    const { full, register, load } = env();

    expect(registerServiceWorker(full)).toBe(true);
    expect(register).not.toHaveBeenCalled(); // not competing with the page while it loads
    load();
    expect(register).toHaveBeenCalledWith('./sw.js');
  });

  it('works on plain http too, which is how localhost is served', () => {
    const { full, register, load } = env({ protocol: 'http:' });
    registerServiceWorker(full);
    load();

    expect(register).toHaveBeenCalledTimes(1);
  });

  it('does nothing in development, where a stored copy would hide every edit', () => {
    const { full, register, load } = env({ production: false });

    expect(registerServiceWorker(full)).toBe(false);
    load();
    expect(register).not.toHaveBeenCalled();
  });

  it('does nothing from a folder opened off the disk (file://)', () => {
    const { full, register, load } = env({ protocol: 'file:' });

    expect(registerServiceWorker(full)).toBe(false);
    load();
    expect(register).not.toHaveBeenCalled();
  });

  it('does nothing in a browser that has no service workers', () => {
    const { full } = env({ serviceWorker: undefined });
    expect(registerServiceWorker(full)).toBe(false);
  });

  it('never lets a failed registration show - not a rejection, not a throw', async () => {
    const rejecting = env({ serviceWorker: { register: () => Promise.reject(new Error('blocked')) } });
    registerServiceWorker(rejecting.full);
    expect(() => rejecting.load()).not.toThrow();

    const throwing = env({
      serviceWorker: {
        register: () => {
          throw new Error('insecure');
        },
      },
    });
    registerServiceWorker(throwing.full);
    expect(() => throwing.load()).not.toThrow();
    await Promise.resolve();
  });
});

/* ------------------------------------------------------------------ */
/* Building it                                                         */
/* ------------------------------------------------------------------ */

describe('building the service worker', () => {
  it('reads the recordings and pictures out of media/manifest.js', () => {
    const text = 'window.BELAJAR_MEDIA = {"audio":["words/apel.mp3","letters/ar/alif.wav"],"images":["words/apel.png"]};';

    expect(mediaFilesIn(text)).toEqual([
      'media/audio/words/apel.mp3',
      'media/audio/letters/ar/alif.wav',
      'media/images/words/apel.png',
    ]);
  });

  it('copes with an empty, missing or broken list', () => {
    expect(mediaFilesIn('window.BELAJAR_MEDIA = {"audio":[],"images":[]};')).toEqual([]);
    expect(mediaFilesIn('')).toEqual([]);
    expect(mediaFilesIn('this is not javascript {')).toEqual([]);
    expect(mediaFilesIn('window.BELAJAR_MEDIA = {"audio":"nope","images":[7,null]};')).toEqual([]);
  });

  it('names a version after the contents, whatever the order they are listed in', () => {
    const a = versionOf([['a.js', Buffer.from('1')], ['b.css', Buffer.from('2')]]);
    const reordered = versionOf([['b.css', Buffer.from('2')], ['a.js', Buffer.from('1')]]);
    const changed = versionOf([['a.js', Buffer.from('1')], ['b.css', Buffer.from('3')]]);
    const renamed = versionOf([['c.js', Buffer.from('1')], ['b.css', Buffer.from('2')]]);

    expect(reordered).toBe(a);
    expect(changed).not.toBe(a);
    expect(renamed).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it('fills in every placeholder and is valid JavaScript', () => {
    const source = buildServiceWorker({ shell: ['index.html'], media: ['media/audio/a.mp3'], version: 'v1' });

    expect(source).not.toMatch(/__VERSION__|__SHELL__|__MEDIA__/);
    expect(source).toContain('"index.html"');
    expect(source).toContain('"media/audio/a.mp3"');
    expect(() => new vm.Script(source)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* Running it                                                          */
/* ------------------------------------------------------------------ */

const SCOPE = 'https://example.com/app/';

type Reply = { body: string | Uint8Array; type?: string; status?: number };

/** A tiny stand-in for the browser's cache storage, enough to exercise the worker. */
class FakeCache {
  entries = new Map<string, Response>();
  private key = (req: { url: string } | string, ignoreSearch = false) => {
    const url = typeof req === 'string' ? req : req.url;
    return ignoreSearch ? url.split('?')[0] : url;
  };

  async put(req: { url: string } | string, res: Response) {
    this.entries.set(this.key(req), res.clone());
  }

  async match(req: { url: string } | string, opts?: { ignoreSearch?: boolean }) {
    const wanted = this.key(req, opts?.ignoreSearch);
    for (const [url, res] of this.entries) {
      if (this.key(url, opts?.ignoreSearch) === wanted) return res.clone();
    }
    return undefined;
  }

  async addAll(reqs: Request[]) {
    const results = await Promise.all(reqs.map((r) => fakeFetchFor(this.owner)(r)));
    results.forEach((res) => {
      if (!res.ok) throw new TypeError('addAll: bad response');
    });
    results.forEach((res, i) => this.entries.set(reqs[i].url, res));
  }

  constructor(private owner: Server) {}
}

type Server = { replies: Map<string, Reply>; offline: boolean; asked: string[]; modes: string[] };
const fakeFetchFor = (server: Server) => async (input: Request | string) => {
  const url = typeof input === 'string' ? input : input.url;
  server.asked.push(url);
  server.modes.push(typeof input === 'string' ? 'default' : input.cache);
  if (server.offline) throw new TypeError('offline');
  const reply = server.replies.get(url);
  if (!reply) return new Response('not found', { status: 404 });
  return new Response(reply.body as BodyInit, {
    status: reply.status ?? 200,
    headers: { 'content-type': reply.type ?? 'text/plain' },
  });
};

type WorkerOptions = { shell?: string[]; media?: string[]; replies?: Record<string, Reply> };

function startWorker({ shell = [], media = [], replies = {} }: WorkerOptions = {}) {
  const server: Server = {
    replies: new Map(Object.entries(replies).map(([path, r]) => [new URL(path, SCOPE).href, r])),
    offline: false,
    asked: [],
    modes: [],
  };
  const stores = new Map<string, FakeCache>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new FakeCache(server));
    return stores.get(name)!;
  };
  const caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (req: { url: string }, opts?: { ignoreSearch?: boolean }) => {
      for (const cache of stores.values()) {
        const hit = await cache.match(req, opts);
        if (hit) return hit;
      }
      return undefined;
    },
  };

  const listeners: Record<string, (event: unknown) => void> = {};
  const calls = { skipWaiting: 0, claim: 0 };
  const self = {
    registration: { scope: SCOPE },
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners[type] = fn;
    },
    skipWaiting: async () => {
      calls.skipWaiting += 1;
    },
    clients: {
      claim: async () => {
        calls.claim += 1;
      },
    },
  };

  const source = buildServiceWorker({ shell, media, version: 'test' });
  vm.runInNewContext(source, { self, caches, fetch: fakeFetchFor(server), Request, Response, URL, Promise });

  /** Fires an install or activate event and waits for everything it kicked off. */
  async function lifecycle(type: 'install' | 'activate') {
    const pending: Promise<unknown>[] = [];
    listeners[type]({ waitUntil: (p: Promise<unknown>) => pending.push(p) });
    await Promise.all(pending);
  }

  /** A request, as the worker sees one. (A navigation cannot be built with `new Request`.) */
  const request = (path: string, init: { mode?: string; method?: string; range?: string } = {}) => ({
    url: new URL(path, SCOPE).href,
    method: init.method ?? 'GET',
    mode: init.mode ?? 'cors',
    headers: new Headers(init.range ? { range: init.range } : {}),
  });

  /** Sends a request through the worker. `answer` is undefined when it let the request pass. */
  async function ask(req: ReturnType<typeof request>) {
    const pending: Promise<unknown>[] = [];
    let answered: Promise<Response> | undefined;
    listeners.fetch({
      request: req,
      respondWith: (p: Promise<Response>) => {
        answered = p;
      },
      waitUntil: (p: Promise<unknown>) => pending.push(p),
    });
    const answer = answered ? await answered : undefined;
    await Promise.all(pending);
    return answer;
  }

  return { server, stores, calls, lifecycle, request, ask };
}

const APP = {
  'index.html': { body: '<html>v1</html>', type: 'text/html' },
  'assets/app.js': { body: 'console.log(1)', type: 'text/javascript' },
  'manifest.webmanifest': { body: '{}', type: 'application/manifest+json' },
};

describe('the service worker', () => {
  describe('installing', () => {
    it('stores the whole app and takes over at once', async () => {
      const w = startWorker({ shell: Object.keys(APP), replies: APP });
      await w.lifecycle('install');

      const shell = [...w.stores.get('belajar-yuk-shell-test')!.entries.keys()];
      expect(shell.sort()).toEqual(Object.keys(APP).map((p) => SCOPE + p).sort());
      expect(w.calls.skipWaiting).toBe(1);
    });

    it('asks the server, not the browser\'s own cache, so it stores what is really there now', async () => {
      const w = startWorker({ shell: ['index.html'], media: ['media/audio/a.mp3'], replies: APP });
      await w.lifecycle('install');

      expect(w.server.modes.length).toBeGreaterThan(0);
      expect(w.server.modes.every((mode) => mode === 'reload')).toBe(true);
    });

    it('fails, and so does not take over, if the app itself cannot be fetched', async () => {
      const w = startWorker({ shell: ['index.html', 'assets/missing.js'], replies: APP });

      await expect(w.lifecycle('install')).rejects.toThrow();
      expect(w.calls.skipWaiting).toBe(0);
    });

    it('stores the recordings, and carries on without any that cannot be fetched', async () => {
      const w = startWorker({
        shell: ['index.html'],
        media: ['media/audio/words/apel.mp3', 'media/audio/gone.mp3'],
        replies: { ...APP, 'media/audio/words/apel.mp3': { body: 'AUDIO', type: 'audio/mpeg' } },
      });
      await w.lifecycle('install');

      expect([...w.stores.get('belajar-yuk-media')!.entries.keys()]).toEqual([SCOPE + 'media/audio/words/apel.mp3']);
      expect(w.calls.skipWaiting).toBe(1);
    });
  });

  describe('activating', () => {
    it('throws away older versions of the app, but never the recordings', async () => {
      const w = startWorker({ shell: [], replies: {} });
      w.stores.set('belajar-yuk-shell-old', new FakeCache(w.server));
      w.stores.set('belajar-yuk-media', new FakeCache(w.server));
      w.stores.set('someone-elses-cache', new FakeCache(w.server));
      await w.lifecycle('activate');

      expect([...w.stores.keys()].sort()).toEqual(['belajar-yuk-media', 'someone-elses-cache']);
      expect(w.calls.claim).toBe(1);
    });

    it('keeps the current version', async () => {
      const w = startWorker({ shell: ['index.html'], replies: APP });
      await w.lifecycle('install');
      await w.lifecycle('activate');

      expect(w.stores.has('belajar-yuk-shell-test')).toBe(true);
    });
  });

  describe('opening the app', () => {
    async function installed() {
      const w = startWorker({ shell: Object.keys(APP), replies: APP });
      await w.lifecycle('install');
      await w.lifecycle('activate');
      return w;
    }

    it('works with no network at all', async () => {
      const w = await installed();
      w.server.offline = true;

      const page = await w.ask(w.request('', { mode: 'navigate' }));
      expect(await page!.text()).toBe('<html>v1</html>');
    });

    it('serves the stored page at once and refreshes it behind the scenes', async () => {
      const w = await installed();
      w.server.replies.set(SCOPE + 'index.html', { body: '<html>v2</html>', type: 'text/html' });

      const first = await w.ask(w.request('', { mode: 'navigate' }));
      expect(await first!.text()).toBe('<html>v1</html>'); // not held up by the network
      const second = await w.ask(w.request('', { mode: 'navigate' }));
      expect(await second!.text()).toBe('<html>v2</html>'); // the update arrived for next time
    });

    it('treats any address in the app as the one page', async () => {
      const w = await installed();
      w.server.offline = true;

      for (const path of ['', 'index.html', '?utm=x', 'whatever']) {
        const page = await w.ask(w.request(path, { mode: 'navigate' }));
        expect(await page!.text(), path).toBe('<html>v1</html>');
      }
    });

    it('goes to the network the very first time, if nothing is stored yet', async () => {
      const w = startWorker({ shell: [], replies: APP });
      const page = await w.ask(w.request('', { mode: 'navigate' }));

      expect(await page!.text()).toBe('<html>v1</html>');
    });

    it('serves the app\'s files from the store without asking the network', async () => {
      const w = await installed();
      w.server.asked.length = 0;

      const script = await w.ask(w.request('assets/app.js'));
      expect(await script!.text()).toBe('console.log(1)');
      expect(w.server.asked).toEqual([]);
    });

    it('fails cleanly rather than hanging for a file it has never had, offline', async () => {
      const w = await installed();
      w.server.offline = true;

      const missing = await w.ask(w.request('assets/other.js'));
      expect(missing!.status).toBe(0); // a network error, as a browser would show
    });
  });

  describe('the list of recordings (media/manifest.js)', () => {
    const LIST = 'window.BELAJAR_MEDIA = {"audio":[],"images":[]};';

    it('asks the network first, so a new recording shows up straight away', async () => {
      const w = startWorker({ replies: { 'media/manifest.js': { body: LIST } } });
      await w.ask(w.request('media/manifest.js'));
      w.server.replies.set(SCOPE + 'media/manifest.js', { body: LIST + '//new' });

      const fresh = await w.ask(w.request('media/manifest.js'));
      expect(await fresh!.text()).toBe(LIST + '//new');
    });

    it('falls back to the last one it saw when there is no network', async () => {
      const w = startWorker({ replies: { 'media/manifest.js': { body: LIST } } });
      await w.ask(w.request('media/manifest.js'));
      w.server.offline = true;

      const stored = await w.ask(w.request('media/manifest.js'));
      expect(await stored!.text()).toBe(LIST);
    });
  });

  describe('recordings and pictures', () => {
    const AUDIO = 'media/audio/words/apel.mp3';
    const bytes = new TextEncoder().encode('0123456789');

    async function withAudio() {
      const w = startWorker({ replies: { [AUDIO]: { body: bytes, type: 'audio/mpeg' } } });
      await w.ask(w.request(AUDIO)); // the first play fetches and stores it
      return w;
    }

    it('plays offline once it has been fetched', async () => {
      const w = await withAudio();
      w.server.offline = true;

      const played = await w.ask(w.request(AUDIO));
      expect(await played!.text()).toBe('0123456789');
    });

    it('serves a part of it when the browser asks for a range, as Safari insists on', async () => {
      const w = await withAudio();
      w.server.offline = true;

      const part = await w.ask(w.request(AUDIO, { range: 'bytes=2-5' }));
      expect(part!.status).toBe(206);
      expect(part!.headers.get('content-range')).toBe('bytes 2-5/10');
      expect(part!.headers.get('content-length')).toBe('4');
      expect(part!.headers.get('content-type')).toBe('audio/mpeg');
      expect(part!.headers.get('accept-ranges')).toBe('bytes');
      expect(await part!.text()).toBe('2345');
    });

    it('serves an open-ended range, which is how playback usually begins', async () => {
      const w = await withAudio();
      const part = await w.ask(w.request(AUDIO, { range: 'bytes=0-' }));

      expect(part!.status).toBe(206);
      expect(part!.headers.get('content-range')).toBe('bytes 0-9/10');
      expect(await part!.text()).toBe('0123456789');
    });

    it('serves the tail for a suffix range, and clamps one that runs past the end', async () => {
      const w = await withAudio();

      const tail = await w.ask(w.request(AUDIO, { range: 'bytes=-3' }));
      expect(await tail!.text()).toBe('789');
      const long = await w.ask(w.request(AUDIO, { range: 'bytes=7-99' }));
      expect(long!.headers.get('content-range')).toBe('bytes 7-9/10');
    });

    it('refuses a range that starts after the end', async () => {
      const w = await withAudio();
      const nothing = await w.ask(w.request(AUDIO, { range: 'bytes=50-60' }));

      expect(nothing!.status).toBe(416);
    });

    it('can serve a range on the very first play, from the whole file it fetched', async () => {
      const w = startWorker({ replies: { [AUDIO]: { body: bytes, type: 'audio/mpeg' } } });
      const part = await w.ask(w.request(AUDIO, { range: 'bytes=0-3' }));

      expect(await part!.text()).toBe('0123');
      // And it asked for the whole file, never a slice: only that can be stored.
      expect(w.server.asked).toEqual([SCOPE + AUDIO]);
    });

    it('shows a newer recording on the next play, once the stored one has been refreshed', async () => {
      const w = await withAudio();
      w.server.replies.set(SCOPE + AUDIO, { body: 'NEWER', type: 'audio/mpeg' });

      expect(await (await w.ask(w.request(AUDIO)))!.text()).toBe('0123456789'); // now
      expect(await (await w.ask(w.request(AUDIO)))!.text()).toBe('NEWER'); // next time
    });

    it('stores pictures the same way', async () => {
      const w = startWorker({ replies: { 'media/images/words/apel.png': { body: 'PNG', type: 'image/png' } } });
      await w.ask(w.request('media/images/words/apel.png'));
      w.server.offline = true;

      const picture = await w.ask(w.request('media/images/words/apel.png'));
      expect(await picture!.text()).toBe('PNG');
    });

    it('does not invent a recording that is not there', async () => {
      const w = startWorker({ replies: {} });
      const missing = await w.ask(w.request('media/audio/none.mp3'));

      expect(missing!.status).toBe(404);
    });
  });

  describe('everything else', () => {
    it('leaves other sites alone', async () => {
      const w = startWorker({ replies: APP });
      const other = { ...w.request('x'), url: 'https://elsewhere.example/x.js' };

      expect(await w.ask(other)).toBeUndefined();
    });

    it('leaves anything outside its own folder alone', async () => {
      const w = startWorker({ replies: APP });
      const outside = { ...w.request('x'), url: 'https://example.com/other-app/x.js' };

      expect(await w.ask(outside)).toBeUndefined();
    });

    it('leaves requests that are not GETs alone', async () => {
      const w = startWorker({ replies: APP });

      expect(await w.ask(w.request('assets/app.js', { method: 'POST' }))).toBeUndefined();
    });
  });
});
