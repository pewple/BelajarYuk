/**
 * The app's version, small and quiet in the top-right corner of every page.
 *
 * For the grown-up who needs to say which version they have ("is this the new
 * one?"). It sits in the strip above the header buttons, never over them, and
 * ignores touches so a small finger can never hit it. Still dark enough to be
 * read - "subtle" does not mean below the contrast a person can see.
 */
export function VersionBadge() {
  return (
    <span
      aria-label={`Versi ${__APP_VERSION__}`}
      className="pointer-events-none fixed right-2 z-10 text-[10px] leading-none font-semibold text-slate-500 select-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 2px)' }}
    >
      v{__APP_VERSION__}
    </span>
  );
}
