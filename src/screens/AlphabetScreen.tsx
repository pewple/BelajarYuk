import { useCallback, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { StepButton } from '../components/StepButton';
import { PulseRing } from '../components/PulseRing';
import { LangToggle } from '../components/LangToggle';
import { ALPHABET, themeFor } from '../data/curriculum';
import { useAudio } from '../hooks/useAudio';
import { useArrowKeys } from '../hooks/useArrowKeys';
import type { LetterLang } from '../hooks/useAudio';

type AlphabetScreenProps = {
  onHome: () => void;
  letterLang: LetterLang;
  onLetterLangChange: (next: LetterLang) => void;
};

/**
 * Mengenal Huruf - one letter, one action.
 *
 * The screen holds exactly three interactive elements (back, letter, forward)
 * so there is nothing to decide beyond "tap the big thing". Each tap pairs a
 * visual change (pulse ring + squash) with the letter's name spoken aloud,
 * which is the visual-auditory pairing that builds letter recognition at
 * this age.
 */
export function AlphabetScreen({ onHome, letterLang, onLetterLangChange }: AlphabetScreenProps) {
  const { speakLetter, playTap } = useAudio();
  const [index, setIndex] = useState(0);
  // Bumped on every tap so the pulse ring remounts and replays.
  const [pulseKey, setPulseKey] = useState(0);

  const letter = ALPHABET[index];

  const say = useCallback(() => {
    speakLetter(letter, letterLang);
    setPulseKey((k) => k + 1);
  }, [letter, letterLang, speakLetter]);

  const step = useCallback(
    (delta: number) => {
      playTap();
      setIndex((i) => (i + delta + ALPHABET.length) % ALPHABET.length);
      setPulseKey(0);
    },
    [playTap],
  );

  const goPrev = useCallback(() => step(-1), [step]);
  const goNext = useCallback(() => step(1), [step]);
  useArrowKeys({ onPrev: goPrev, onNext: goNext, onActivate: say });

  return (
    <ScreenFrame
      title="Mengenal Huruf"
      onHome={onHome}
      caption={`Huruf ${index + 1} dari ${ALPHABET.length} — ketuk hurufnya`}
    >
      <div className="flex w-full max-w-3xl items-center justify-between gap-4 sm:gap-8">
        <StepButton direction="prev" onClick={goPrev} label="Huruf sebelumnya" />

        <div className="relative flex items-center justify-center">
          {/* Expanding ring: the "sound made this happen" cue. */}
          {pulseKey > 0 && <PulseRing key={pulseKey} theme={themeFor(index)} />}

          <button
            type="button"
            onClick={say}
            aria-label={`Dengarkan huruf ${letter}`}
            className={`toddler-tap relative flex size-56 items-center justify-center rounded-[3rem] bg-gradient-to-br ${themeFor(index)} text-white shadow-2xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:size-72`}
          >
            <span
              key={`${letter}-${pulseKey}`}
              className="animate-pop-in text-[9rem] leading-none font-black drop-shadow-lg sm:text-[13rem]"
            >
              {letter}
            </span>
            <Volume2
              aria-hidden="true"
              className="absolute right-5 bottom-5 size-8 opacity-70 sm:size-10"
              strokeWidth={2.5}
            />
          </button>
        </div>

        <StepButton direction="next" onClick={goNext} label="Huruf berikutnya" />
      </div>

      {/* Lower-case twin: the same letter looks different in books. */}
      <p className="mt-6 text-5xl leading-tight font-black text-slate-400 sm:text-6xl" aria-hidden="true">
        {letter.toLowerCase()}
      </p>

      <div className="mt-6">
        <LangToggle value={letterLang} onChange={onLetterLangChange} />
      </div>
    </ScreenFrame>
  );
}
