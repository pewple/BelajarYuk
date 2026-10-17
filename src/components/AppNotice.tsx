import { installIsPossible } from '../pwa';
import type { InstallContext } from '../pwa';

type AppNoticeProps = {
  /** Where the app is running. Left out, it is read from the browser. */
  context?: InstallContext;
};

/**
 * A quiet footnote for the grown-up on the home screen: the app can be
 * installed and works offline, and it keeps everything on this device.
 *
 * Small and low in the page on purpose - a child never needs it, and it should
 * not compete with the cards. Every claim in it is checkable in the code: the
 * app sets no cookies, has no accounts or analytics, and never sends anything
 * anywhere. Its settings and learning record live in this browser's local
 * storage, which is why that is mentioned rather than "stores nothing".
 */
export function AppNotice({ context }: AppNoticeProps) {
  const installable = installIsPossible(context);

  return (
    <footer className="mt-8 max-w-xl text-center text-xs leading-relaxed font-medium text-slate-500">
      <p>
        {installable && (
          <>
            Aplikasi ini bisa <strong className="font-bold">dipasang</strong> di perangkat (PWA) dan dibuka
            tanpa internet.{' '}
          </>
        )}
        Semuanya berjalan di perangkat ini saja: <strong className="font-bold">tanpa cookie</strong>, tanpa
        akun, tanpa pelacak, dan tidak ada data yang dikirim ke mana pun. Pengaturan dan catatan belajar
        hanya disimpan di penyimpanan lokal perangkat ini.
      </p>

      {installable && (
        <details className="mt-1">
          <summary className="inline-block cursor-pointer rounded px-1 font-bold underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-4 focus-visible:ring-sky-400">
            Cara memasang
          </summary>
          <ul className="mt-1 space-y-0.5">
            <li>Android (Chrome): menu ⋮ › Instal aplikasi</li>
            <li>iPhone / iPad (Safari): tombol Bagikan › Tambah ke Layar Utama</li>
            <li>Komputer (Chrome/Edge): ikon pasang di ujung kanan bilah alamat</li>
          </ul>
        </details>
      )}
    </footer>
  );
}
