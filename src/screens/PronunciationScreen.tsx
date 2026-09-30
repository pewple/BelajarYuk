import { useCallback, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { StepButton } from '../components/StepButton';
import { PulseRing } from '../components/PulseRing';
import { CardArt } from '../components/CardArt';
import { WORD_CARDS, themeFor } from '../data/curriculum';
import { wordPicture } from '../media/pictures';
import { useAudio } from '../hooks/useAudio';
import { useArrowKeys } from '../hooks/useArrowKeys';
import type { LetterLang } from '../hooks/useAudio';

type PronunciationScreenProps = {
  onHome: () => void;
  letterLang: LetterLang;
};

/**
 * Belajar Bicara - letter, picture and word held together on one card.
 *
 * Two distinct taps, each with its own unambiguous result:
 *  - the letter badge  -> the letter's name  ("be")
 *  - the picture card  -> the whole word     ("Buku")
 *
 * Keeping the two apart is what makes the letter-sound link learnable
 * rather than a single blurred phrase. The word is always spoken in
 * Indonesian; only the letter name follows the language toggle.
 */
export function PronunciationScreen({ onHome, letterLang }: PronunciationScreenProps) {
  const { speakWord, speakLetter, playTap } = useAudio();
  const [index, setIndex] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

  const card = WORD_CARDS[index];

  const sayWord = useCallback(() => {
    speakWord(card.word);
    setPulseKey((k) => k + 1);
  }, [card.word, speakWord]);

  const sayLetter = useCallback(() => {
    speakLetter(card.letter, letterLang);
  }, [card.letter, letterLang, speakLetter]);

  const step = useCallback(
    (delta: number) => {
      playTap();
      setIndex((i) => (i + delta + WORD_CARDS.length) % WORD_CARDS.length);
      setPulseKey(0);
    },
    [playTap],
  );

  const goPrev = useCallback(() => step(-1), [step]);
  const goNext = useCallback(() => step(1), [step]);
  useArrowKeys({ onPrev: goPrev, onNext: goNext, onActivate: sayWord });

  return (
    <ScreenFrame
      title="Belajar Bicara"
      onHome={onHome}
      caption={`${index + 1} dari ${WORD_CARDS.length} — ${card.hint}`}
    >
      <div className="flex w-full max-w-4xl items-center justify-between gap-3 sm:gap-8">
        <StepButton direction="prev" onClick={goPrev} label="Kata sebelumnya" />

        <div className="relative flex min-w-0 flex-1 items-center justify-center">
          {pulseKey > 0 && <PulseRing key={pulseKey} theme={themeFor(index)} />}

          <button
            type="button"
            onClick={sayWord}
            aria-label={`Dengarkan kata ${card.word}`}
            className={`toddler-tap relative flex w-full flex-col items-center justify-center gap-4 rounded-[3rem] bg-gradient-to-br ${themeFor(index)} px-6 py-10 text-white shadow-2xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:py-12`}
          >
            <CardArt
              key={`${card.word}-${pulseKey}`}
              icon={card.icon}
              picture={wordPicture(card.word)}
              plate
              className="animate-pop-in size-32 drop-shadow-lg sm:size-44"
              strokeWidth={1.8}
            />
            <span className="text-5xl font-black tracking-tight drop-shadow-md sm:text-7xl">
              {card.word}
            </span>
            <Volume2
              aria-hidden="true"
              className="absolute right-5 bottom-5 size-8 opacity-70 sm:size-10"
              strokeWidth={2.5}
            />
          </button>
        </div>

        <StepButton direction="next" onClick={goNext} label="Kata berikutnya" />
      </div>

      {/* The letter itself, as its own tappable target. */}
      <button
        type="button"
        onClick={sayLetter}
        aria-label={`Dengarkan huruf ${card.letter}`}
        className="toddler-tap mt-8 flex size-32 items-center justify-center rounded-[2rem] bg-white text-slate-800 shadow-xl ring-4 ring-slate-200 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95"
      >
        <span className="text-7xl leading-none font-black">
          {card.letter}
          <span className="text-slate-400">{card.letter.toLowerCase()}</span>
        </span>
      </button>
    </ScreenFrame>
  );
}
