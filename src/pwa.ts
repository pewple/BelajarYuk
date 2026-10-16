/**
 * Lets the app be installed and opened with no network.
 *
 * A service worker (public build: sw.js, written by scripts/make-sw.mjs) keeps a
 * copy of the app on the device. Together with the web manifest and icons it is
 * what makes "Add to Home Screen" give a real app icon that opens full screen.
 *
 * It is registered only where it can work:
 *  - in the production build - in development a service worker would serve a
 *    stale copy of the code and make every edit look like it had not happened;
 *  - over http(s) - a folder opened straight from disk (file://) cannot have
 *    one, and that version needs none, since it is already local.
 *
 * Failing to register is never an error the child or parent should see: the app
 * simply works online, as it always did.
 */
export type PwaEnvironment = {
  production: boolean;
  protocol: string;
  serviceWorker?: Pick<ServiceWorkerContainer, 'register'>;
  /** Waits for the page to finish loading, so registering never competes with it. */
  whenLoaded: (run: () => void) => void;
};

export function registerServiceWorker(env: PwaEnvironment = browserEnvironment()): boolean {
  if (!env.production) return false;
  if (!/^https?:$/.test(env.protocol)) return false;
  if (!env.serviceWorker) return false;

  const worker = env.serviceWorker;
  env.whenLoaded(() => {
    // Relative, so it works from any folder the app is hosted in.
    try {
      worker.register('./sw.js').catch(() => {
        /* Offline use is a bonus; the app does not depend on it. */
      });
    } catch {
      /* Same: some browsers throw at once instead of rejecting. */
    }
  });
  return true;
}

function browserEnvironment(): PwaEnvironment {
  return {
    production: import.meta.env.PROD,
    protocol: window.location.protocol,
    serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
    whenLoaded: (run) => {
      if (document.readyState === 'complete') run();
      else window.addEventListener('load', run, { once: true });
    },
  };
}
