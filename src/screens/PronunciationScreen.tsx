import { useCallback, useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { StepButton } from '../components/StepButton';
import { PulseRing } from '../components/PulseRing';
import { CardArt } from '../components/CardArt';
import { ScriptToggle } from '../components/ScriptToggle';
import { WORD_CARDS, themeFor } from '../data/curriculum';
import { ARABIC_WORD_CARDS } from '../data/arabicWords';
import { HIJAIYAH } from '../data/scripts';
import type { Script } from '../data/scripts';
import { arabicWordPicture, wordPicture } from '../media/pictures';
import { useAudio } from '../hooks/useAudio';
import { useArrowKeys } from '../hooks/useArrowKeys';
import { useIdleReminder } from '../hooks/useIdleReminder';
import { useTapLock } from '../hooks/useTapLock';
import type { LetterLang } from '../hooks/useAudio';
import { CLIP_IDS } from '../media/clips';
import { arabicLetterPart, arabicWordPart } from '../media/scriptVoice';
import { stepsFor } from '../media/voiceParts';
import { usePlay } from '../state/play';

type PronunciationScreenProps = {
  onHome: () => void;
  letterLang: LetterLang;
  script: Script;
  onScriptChange: (next: Script) => void;
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
 *
 * In Arabic the deck is the 28 hijaiyah, each with one everyday word (أَرْنَب,
 * بَاب ...). The word is written in Arabic with its vowel marks and spoken in
 * Arabic - by an Arabic voice if the device has one, else by its Indonesian
 * spelling. Beside it, for the grown-up, goes the reading in Latin letters and
 * the meaning in Indonesian.
 */
export function PronunciationScreen({ onHome, letterLang, script, onScriptChange }: PronunciationScreenProps) {
  const { speakWord, speakLetter, playTap, playVoice } = useAudio();
  const { reportGame } = usePlay();
  const once = useTapLock();
  const [index, setIndex] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

  const arabic = script === 'arab';
  const total = arabic ? ARABIC_WORD_CARDS.length : WORD_CARDS.length;

  // The two decks are different lengths and orders, so a place in one means
  // nothing in the other: start over from the first card.
  useEffect(() => {
    setIndex(0);
    setPulseKey(0);
  }, [script]);

  const card = WORD_CARDS[index % WORD_CARDS.length];
  const arabicCard = ARABIC_WORD_CARDS[index % ARABIC_WORD_CARDS.length];
  const hijaiyah = HIJAIYAH.find((h) => h.id === arabicCard.letterId) ?? HIJAIYAH[0];

  // What identifies "this card" for the game count, whichever deck it is from.
  const cardId = arabic ? `ar:${arabicCard.letterId}` : card.word;

  const sayWord = useCallback(() => {
    if (arabic) playVoice(stepsFor([arabicWordPart(arabicCard)]));
    else speakWord(card.word);
    setPulseKey((k) => k + 1);
    // Hearing a word is the game here; each different one counts once.
    reportGame(cardId);
  }, [arabic, arabicCard, card.word, cardId, playVoice, reportGame, speakWord]);

  const sayLetter = useCallback(() => {
    if (arabic) playVoice(stepsFor([arabicLetterPart(hijaiyah)]));
    else speakLetter(card.letter, letterLang);
    reportGame(cardId);
  }, [arabic, card.letter, cardId, hijaiyah, letterLang, playVoice, reportGame, speakLetter]);

  // Said once on arriving, and once more if the child goes quiet.
  const instruct = useCallback(
    () => playVoice(stepsFor([{ clip: CLIP_IDS.tapPicture, text: 'Ketuk gambarnya!' }])),
    [playVoice],
  );
  useEffect(() => {
    instruct();
  }, [instruct]);
  useIdleReminder(true, `${script}:${index}`, instruct);

  const step = useCallback(
    (delta: number) => {
      playTap();
      setIndex((i) => (i + delta + total) % total);
      setPulseKey(0);
    },
    [playTap, total],
  );

  const goPrev = useCallback(() => step(-1), [step]);
  const goNext = useCallback(() => step(1), [step]);
  useArrowKeys({ onPrev: goPrev, onNext: goNext, onActivate: sayWord });

  const caption = arabic
    ? `${index + 1} dari ${total} — ${arabicCard.meaning}`
    : `${index + 1} dari ${total} — ${card.hint}`;

  return (
    <ScreenFrame title="Belajar Bicara" onHome={onHome} onRepeat={instruct} caption={caption}>
      <div className="flex w-full max-w-4xl items-center justify-between gap-3 sm:gap-8">
        <StepButton direction="prev" onClick={() => once('prev', goPrev)} label="Kata sebelumnya" />

        <div className="relative flex min-w-0 flex-1 items-center justify-center">
          {pulseKey > 0 && <PulseRing key={pulseKey} theme={themeFor(index)} />}

          <button
            type="button"
            onClick={sayWord}
            aria-label={
              arabic ? `Dengarkan kata ${arabicCard.word} (${arabicCard.meaning})` : `Dengarkan kata ${card.word}`
            }
            className={`toddler-tap relative flex w-full flex-col items-center justify-center gap-4 rounded-[3rem] bg-gradient-to-br ${themeFor(index)} px-6 py-10 text-white shadow-2xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:py-12 ${arabic ? 'pb-16 sm:pb-14' : ''}`}
          >
            <CardArt
              key={`${cardId}-${pulseKey}`}
              icon={arabic ? arabicCard.icon : card.icon}
              picture={arabic ? arabicWordPicture(arabicCard.letterId) : wordPicture(card.word)}
              plate
              className="animate-pop-in size-32 drop-shadow-lg sm:size-44"
              strokeWidth={1.8}
            />
            {arabic ? (
              <>
                <span lang="ar" className="font-arabic text-6xl font-black drop-shadow-md sm:text-8xl">
                  {arabicCard.word}
                </span>
                {/* For the grown-up who may not read Arabic: how it is read, and what it means. */}
                <span className="text-xl font-bold sm:text-2xl">
                  {arabicCard.translit} · {arabicCard.meaning}
                </span>
              </>
            ) : (
              <span className="text-5xl font-black tracking-tight drop-shadow-md sm:text-7xl">
                {card.word}
              </span>
            )}
            <Volume2
              aria-hidden="true"
              className="absolute right-5 bottom-5 size-8 opacity-70 sm:size-10"
              strokeWidth={2.5}
            />
          </button>
        </div>

        <StepButton direction="next" onClick={() => once('next', goNext)} label="Kata berikutnya" />
      </div>

      {/* The letter itself, as its own tappable target. */}
      <button
        type="button"
        onClick={sayLetter}
        aria-label={
          arabic ? `Dengarkan huruf ${hijaiyah.glyph} (${hijaiyah.title})` : `Dengarkan huruf ${card.letter}`
        }
        className="toddler-tap mt-8 flex size-32 items-center justify-center rounded-[2rem] bg-white text-slate-800 shadow-xl ring-4 ring-slate-200 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95"
      >
        {arabic ? (
          <span lang="ar" className="font-arabic text-8xl leading-none font-black">
            {hijaiyah.glyph}
          </span>
        ) : (
          <span className="text-7xl leading-none font-black">
            {card.letter}
            <span className="text-slate-500">{card.letter.toLowerCase()}</span>
          </span>
        )}
      </button>

      <div className="mt-6">
        <ScriptToggle value={script} onChange={onScriptChange} />
      </div>
    </ScreenFrame>
  );
}
