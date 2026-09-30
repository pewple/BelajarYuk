import { useMemo } from 'react';
import { ArrowLeft, Check, Minus, Play } from 'lucide-react';
import { audioRegistry, imageRegistry, manifestLoaded } from '../media/manifest';
import { buildSlots, slotIds } from '../media/slots';
import type { SlotGroup } from '../media/slots';

type MediaCheckScreenProps = {
  onBack: () => void;
};

function play(url: string) {
  try {
    void new Audio(url).play()?.catch(() => {});
  } catch {
    /* Nothing to do - the row already shows whether the file is listed. */
  }
}

function coverage(group: SlotGroup, present: Record<string, string>) {
  const have = group.slots.filter((slot) => present[slot.id] !== undefined).length;
  return { have, total: group.slots.length };
}

type GroupProps = {
  group: SlotGroup;
  present: Record<string, string>;
  kind: 'audio' | 'image';
};

function Group({ group, present, kind }: GroupProps) {
  const { have, total } = coverage(group, present);
  const complete = have === total;

  return (
    <details className="group rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none">
        <span className="font-bold text-slate-800">{group.title}</span>
        <span
          className={`rounded-full px-3 py-1 text-sm font-black ${
            complete
              ? 'bg-emerald-100 text-emerald-700'
              : have > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500'
          }`}
        >
          {have} / {total}
        </span>
      </summary>

      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {group.slots.map((slot) => {
          const url = present[slot.id];
          return (
            <li key={slot.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              {url ? (
                <Check className="size-5 shrink-0 text-emerald-600" strokeWidth={3} aria-label="Ada" />
              ) : (
                <Minus className="size-5 shrink-0 text-slate-300" strokeWidth={3} aria-label="Belum ada" />
              )}

              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800">{slot.label}</div>
                <div className="truncate font-mono text-xs text-slate-500">{slot.id}</div>
                {slot.say && !url && (
                  <div className="text-xs text-slate-400">
                    Ucapkan: <span className="font-semibold">{slot.say}</span>
                  </div>
                )}
              </div>

              {url && kind === 'audio' && (
                <button
                  type="button"
                  onClick={() => play(url)}
                  aria-label={`Putar ${slot.label}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white active:scale-95"
                >
                  <Play className="size-4" fill="currentColor" />
                </button>
              )}
              {url && kind === 'image' && (
                <img src={url} alt="" className="size-10 shrink-0 rounded-lg object-contain ring-1 ring-slate-200" />
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/**
 * Parent page at `index.html#media`: which recordings and pictures the app
 * found, which slots still use the built-in fallback, and - most usefully -
 * which listed files match no slot. A misspelt filename otherwise fails
 * silently: the file sits there and the app never plays it.
 */
export function MediaCheckScreen({ onBack }: MediaCheckScreenProps) {
  const catalogue = useMemo(() => buildSlots(), []);
  const audio = audioRegistry();
  const images = imageRegistry();
  const loaded = manifestLoaded();

  const audioSlotIds = useMemo(() => slotIds(catalogue.audio), [catalogue]);
  const imageSlotIds = useMemo(() => slotIds(catalogue.images), [catalogue]);

  const isOpenFolder = (id: string) => catalogue.openAudioFolders.some((f) => id.startsWith(f.prefix));

  const unknownAudio = Object.keys(audio.urls).filter((id) => !audioSlotIds.has(id) && !isOpenFolder(id));
  const unknownImages = Object.keys(images.urls).filter((id) => !imageSlotIds.has(id));
  const rejected = [...audio.rejected, ...images.rejected];

  const audioCount = Object.keys(audio.urls).length;
  const imageCount = Object.keys(images.urls).length;

  return (
    <div className="min-h-dvh bg-amber-50 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali ke menu utama"
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow ring-2 ring-slate-200 active:scale-95"
          >
            <ArrowLeft className="size-6" strokeWidth={2.6} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Cek media</h1>
            <p className="text-sm font-semibold text-slate-500">
              {audioCount} suara &middot; {imageCount} gambar terdaftar
            </p>
          </div>
        </header>

        {!loaded && (
          <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
            Berkas <code className="font-mono">media/manifest.js</code> tidak ditemukan atau gagal
            dimuat, jadi semua suara dan gambar memakai bawaan.
          </p>
        )}

        {loaded && audioCount + imageCount === 0 && (
          <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
            Belum ada berkas terdaftar. Taruh suara di <code className="font-mono">media/audio</code>{' '}
            dan gambar di <code className="font-mono">media/images</code>, lalu jalankan{' '}
            <strong>Perbarui-Media.bat</strong> dan muat ulang halaman ini.
          </p>
        )}

        {(unknownAudio.length > 0 || unknownImages.length > 0 || rejected.length > 0) && (
          <section
            aria-label="Berkas bermasalah"
            className="rounded-2xl bg-amber-100 p-4 text-sm text-amber-900 ring-1 ring-amber-300"
          >
            <h2 className="font-black">Terdaftar, tapi tidak dipakai</h2>
            <p className="mt-1">
              Nama berkas ini tidak cocok dengan slot mana pun, jadi aplikasi tidak akan memutarnya.
              Biasanya salah eja.
            </p>
            <ul className="mt-2 list-disc pl-5 font-mono text-xs">
              {unknownAudio.map((id) => (
                <li key={`a-${id}`}>suara: {id}</li>
              ))}
              {unknownImages.map((id) => (
                <li key={`i-${id}`}>gambar: {id}</li>
              ))}
              {rejected.map((r) => (
                <li key={`r-${r.entry}`}>
                  {r.entry} ({r.reason})
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="mt-2 text-lg font-black text-slate-700">Suara</h2>
        {catalogue.audio.map((group) => (
          <Group key={group.title} group={group} present={audio.urls} kind="audio" />
        ))}
        {catalogue.openAudioFolders.map((folder) => {
          const count = Object.keys(audio.urls).filter((id) => id.startsWith(folder.prefix)).length;
          return (
            <div key={folder.prefix} className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-800">{folder.title}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-500">
                  {count} berkas
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                <code className="font-mono">{folder.prefix}</code> &mdash; {folder.note}
              </p>
            </div>
          );
        })}

        <h2 className="mt-2 text-lg font-black text-slate-700">Gambar</h2>
        {catalogue.images.map((group) => (
          <Group key={group.title} group={group} present={images.urls} kind="image" />
        ))}
      </div>
    </div>
  );
}
