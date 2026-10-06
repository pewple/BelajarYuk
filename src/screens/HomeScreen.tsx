import { useEffect, useRef } from 'react';
import type { ScreenId } from '../types';
import { HOME_CHOICES } from '../data/navigation';
import { CardArt } from '../components/CardArt';
import { homePicture } from '../media/pictures';
import { useAudio } from '../hooks/useAudio';

type HomeScreenProps = {
  onChoose: (id: Exclude<ScreenId, 'home'>) => void;
  showVoiceNotice: boolean;
};

/**
 * Only three choices, each one a huge card. Non-readers navigate by the
 * glyph and colour; the words underneath are there for the grown-up and for
 * incidental print exposure.
 */
export function HomeScreen({ onChoose, showVoiceNotice }: HomeScreenProps) {
  const { playGreeting } = useAudio();
  const greetedRef = useRef(false);

  /**
   * "Belajar Yuk!" on arrival.
   *
   * On a cold load no audio may play until the page has seen a real gesture,
   * so the greeting is tried immediately and, if the browser was not ready
   * for it, armed to fire on the very first touch or key press instead. Both
   * paths are guarded so it only ever greets once per visit to this screen.
   */
  useEffect(() => {
    const greet = () => {
      if (greetedRef.current) return;
      greetedRef.current = true;
      playGreeting();
    };

    // Returning home from a lesson: the page is already unlocked, greet now.
    if (navigator.userActivation?.hasBeenActive ?? false) {
      greet();
      return;
    }

    // First load: wait for the gesture that unlocks audio.
    //
    // Deliberately NOT `pointerdown`. On a touchscreen the browser only treats
    // a tap as permission to play sound when the finger lifts (`touchend` /
    // `click`); iOS Safari and Chrome for Android both refuse audio started
    // from the initial press. Firing on `pointerdown` would try too early, be
    // refused, and - since the greeting is one-shot - never try again.
    const opts = { once: true, passive: true } as const;
    const events = ['click', 'touchend', 'keydown'] as const;
    events.forEach((name) => window.addEventListener(name, greet, opts));
    return () => events.forEach((name) => window.removeEventListener(name, greet));
  }, [playGreeting]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-amber-50 px-4 py-8">
      <header className="mb-6 text-center sm:mb-8">
        <h1 className="text-4xl font-black tracking-tight text-slate-800 sm:text-6xl">
          Belajar Yuk!
        </h1>
        <p className="mt-1 text-base font-bold text-slate-500 sm:mt-2 sm:text-lg">
          Pilih permainan
        </p>
      </header>

      {/*
        A centred, wrapping row rather than a grid. Five cards never divide
        evenly into two, three or four columns, and a grid would strand the
        odd one at the left edge; this centres a short last row instead. Each
        card is sized from the gap (1rem) so the rows fill exactly:
        2 across on a phone, 3 on a tablet, all 5 on a wide screen.
      */}
      <nav className="flex w-full max-w-5xl flex-wrap justify-center gap-4">
        {HOME_CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => onChoose(choice.id)}
            /* min-h tuned so every card fits a phone screen without scrolling -
               a choice a pre-reader cannot see is no choice. */
            className={`toddler-tap flex min-h-36 w-[calc(50%_-_0.5rem)] flex-col items-center justify-center gap-2 rounded-[2.5rem] bg-gradient-to-br ${choice.theme} px-3 py-6 text-white shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:min-h-72 sm:w-[calc((100%_-_2rem)/3)] sm:gap-3 sm:py-8 lg:w-[calc((100%_-_4rem)/5)]`}
          >
            <CardArt
              icon={choice.icon}
              picture={homePicture(choice.id)}
              plate
              className="size-12 sm:size-20"
              strokeWidth={2.2}
            />
            <span className="text-3xl font-black tracking-wide drop-shadow-sm sm:text-4xl">
              {choice.glyph}
            </span>
            <span className="text-base font-bold opacity-95 sm:text-xl">{choice.title}</span>
          </button>
        ))}
      </nav>

      {showVoiceNotice && (
        <p className="mt-8 max-w-xl rounded-2xl bg-white px-5 py-3 text-center text-sm font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
          Catatan untuk orang tua: perangkat ini belum punya suara Bahasa Indonesia, jadi
          pengucapan saat ini hanya <em>pendekatan</em> memakai suara Inggris. Untuk hasil yang
          benar: pasang paket suara Indonesia lewat <strong>Settings › Time &amp; language ›
          Language &amp; region › Bahasa Indonesia › Language options › Speech</strong>, lalu muat
          ulang halaman. Cara lain, rekam suara sendiri ke folder{' '}
          <code className="rounded bg-slate-100 px-1 font-mono">media/audio</code> (lihat
          BACA-SAYA.txt).
        </p>
      )}
    </div>
  );
}
