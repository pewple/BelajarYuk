/*
 * Belajar Yuk! - service worker.
 *
 * Generated at build time from scripts/sw-template.js by scripts/make-sw.mjs,
 * which fills in the list of files below. Do not edit dist/sw.js by hand.
 *
 * What it does:
 *
 *  - The app itself (index.html, the bundle, the icons) is stored the first
 *    time the page is opened, so after that it starts with no network at all.
 *  - The page is served from that store at once and refreshed in the background:
 *    an update arrives on the visit after it is published, never mid-lesson.
 *  - media/manifest.js - the list of the parents' own recordings and pictures -
 *    is the exception: the network is asked first, so a new recording shows up
 *    straight away, and the stored copy is used only when offline.
 *  - The recordings and pictures themselves are stored too, kept apart from the
 *    app so an app update never throws them away. Audio is served in slices when
 *    the browser asks for a range, which Safari insists on.
 *
 * Nothing else is touched: other sites, non-GET requests and anything outside
 * this folder go straight to the network.
 */

const VERSION = '__VERSION__';
const SHELL_CACHE = 'belajar-yuk-shell-' + VERSION;
const MEDIA_CACHE = 'belajar-yuk-media';

/** The app, relative to the folder this file is in. Hashed names, so each is final. */
const SHELL = __SHELL__;

/** The parents' recordings and pictures listed in media/manifest.js when this was built. */
const MEDIA = __MEDIA__;

const ROOT = self.registration.scope;
const url = (path) => new URL(path, ROOT).href;
const INDEX = url('index.html');
const MEDIA_LIST = url('media/manifest.js');

/* ------------------------------------------------------------------ */
/* Install: store everything, then take over without waiting           */
/* ------------------------------------------------------------------ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // `reload` skips the browser's own HTTP cache, so what is stored is what
      // the server has now - not a stale copy of it.
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL.map((path) => new Request(url(path), { cache: 'reload' })));

      // The recordings are a bonus: one that cannot be fetched must not stop the
      // app from installing, so these are allowed to fail one by one.
      const media = await caches.open(MEDIA_CACHE);
      await Promise.allSettled(
        MEDIA.map(async (path) => {
          const response = await fetch(new Request(url(path), { cache: 'reload' }));
          if (response.ok) await media.put(url(path), response);
        }),
      );

      await self.skipWaiting();
    })(),
  );
});

/* ------------------------------------------------------------------ */
/* Activate: clear out older versions of the app                       */
/* ------------------------------------------------------------------ */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('belajar-yuk-shell-') && name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const requested = new URL(request.url);
  if (!request.url.startsWith(ROOT)) return; // another site, or outside this folder

  // Opening the app. Whatever the address (/, /index.html, ?x=1), it is the one page.
  if (request.mode === 'navigate') {
    event.respondWith(page(event));
    return;
  }

  if (request.url === MEDIA_LIST) {
    event.respondWith(networkFirst(request, MEDIA_CACHE));
    return;
  }

  if (requested.pathname.includes('/media/')) {
    event.respondWith(media(event));
    return;
  }

  event.respondWith(shellFirst(request));
});

/** The page: from the store at once, refreshed behind it. Network only if never stored. */
async function page(event) {
  const cache = await caches.open(SHELL_CACHE);
  const stored = await cache.match(INDEX);

  const refresh = fetch(new Request(INDEX, { cache: 'reload' }))
    .then(async (response) => {
      if (response.ok) await cache.put(INDEX, response.clone());
      return response;
    })
    .catch(() => null);

  if (stored) {
    event.waitUntil(refresh);
    return stored;
  }
  return (await refresh) || Response.error();
}

/** The app's own files: stored copy first, since each name is tied to its contents. */
async function shellFirst(request) {
  const stored = await caches.match(request, { ignoreSearch: true });
  if (stored) return stored;
  try {
    return await fetch(request);
  } catch {
    return Response.error();
  }
}

/** Ask the network; keep what it says; fall back to the last thing it said. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(new Request(request.url, { cache: 'no-cache' }));
    if (response.ok) await cache.put(request.url, response.clone());
    return response;
  } catch {
    return (await cache.match(request.url)) || Response.error();
  }
}

/** A recording or picture: the stored copy now, a fresh one stored behind it. */
async function media(event) {
  const { request } = event;
  const cache = await caches.open(MEDIA_CACHE);
  const stored = await cache.match(request.url);

  // The whole file, never a slice: a slice cannot be stored, and every later
  // request - whole or partial - is cut from the whole one.
  const refresh = fetch(new Request(request.url, { cache: 'no-cache' }))
    .then(async (response) => {
      if (response.ok) await cache.put(request.url, response.clone());
      return response;
    })
    .catch(() => null);

  if (stored) {
    event.waitUntil(refresh);
    return slice(request, stored);
  }

  const response = await refresh;
  return response && response.ok ? slice(request, response) : response || Response.error();
}

/**
 * Answers a Range request ("bytes=0-") with just that part, as a 206. Safari
 * will not play audio from a service worker that answers one with the whole file.
 */
async function slice(request, response) {
  const range = request.headers.get('range');
  const match = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match || (match[1] === '' && match[2] === '')) return response;

  const bytes = await response.arrayBuffer();
  const total = bytes.byteLength;

  let start;
  let end;
  if (match[1] === '') {
    // "bytes=-500": the last 500 bytes.
    start = Math.max(total - Number(match[2]), 0);
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? total - 1 : Math.min(Number(match[2]), total - 1);
  }

  if (start >= total || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + total } });
  }

  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
