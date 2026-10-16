import { useCallback, useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { StepButton } from '../components/StepButton';
import { PulseRing } from '../components/PulseRing';
import { LangToggle } from '../components/LangToggle';
import { ScriptToggle } from '../components/ScriptToggle';
import { ALPHABET, themeFor } from '../data/curriculum';
import { HIJAIYAH, alphabetSize } from '../data/scripts';
import type { Script } from '../data/scripts';
import { useAudio } from '../hooks/useAudio';
import { useArrowKeys } from '../hooks/useArrowKeys';
import type { LetterLang } from '../hooks/useAudio';
import { useIdleReminder } from '../hooks/useIdleReminder';
import { useTapLock } from '../hooks/useTapLock';
import { CLIP_IDS } from '../media/clips';
import { arabicLetterPart } from '../media/scriptVoice';
import { usePlay } from '../state/play';
import { stepsFor } from '../media/voiceParts';

type AlphabetScreenProps = {
  onHome: () => void;
  letterLang: LetterLang;
  onLetterLangChange: (next: LetterLang) => void;
  script: Script;
  onScriptChange: (next: Script) => void;
};

/**
 * Mengenal Huruf - one letter, one action.
 *
 * The screen holds exactly three interactive elements (back, letter, forward)
 * so there is nothing to decide beyond "tap the big thing". Each tap pairs a
 * visual change (pulse ring + squash) with the letter's name spoken aloud,
 * which is the visual-auditory pairing that builds letter recognition at
 * this age.
 *
 * In Latin script this is A to Z, spoken in Indonesian or English as chosen.
 * In Arabic it is the 28 hijaiyah letters, spoken by the names Indonesian
 * children learn them by (alif, ba, ta...); the Indonesian/English choice does
 * not apply there, so it is hidden rather than left to do nothing.
 */
export function AlphabetScreen({
  onHome,
  letterLang,
  onLetterLangChange,
  script,
  onScriptChange,
}: AlphabetScreenProps) {
  const { speakLetter, playVoice, playTap } = useAudio();
  const { reportGame } = usePlay();
  const once = useTapLock();
  const [index, setIndex] = useState(0);
  // Bumped on every tap so the pulse ring remounts and replays.
  const [pulseKey, setPulseKey] = useState(0);

  const arabic = script === 'arab';
  const total = alphabetSize(script, ALPHABET.length);

  // The two alphabets are different lengths and different orders, so a
  // position in one means nothing in the other. Start over from the first.
  useEffect(() => {
    setIndex(0);
    setPulseKey(0);
  }, [script]);

  const hijaiyah = HIJAIYAH[index % HIJAIYAH.length];
  const latin = ALPHABET[index % ALPHABET.length];
  const glyph = arabic ? hijaiyah.glyph : latin;

  const say = useCallback(() => {
    if (arabic) playVoice(stepsFor([arabicLetterPart(hijaiyah)]));
    else speakLetter(latin, letterLang);
    setPulseKey((k) => k + 1);
    // Hearing a letter is the game here; each different one counts once.
    reportGame(`${script}:${index}`);
  }, [arabic, hijaiyah, index, latin, letterLang, playVoice, reportGame, script, speakLetter]);

  // Said once on arriving, and once more if the child goes quiet.
  const instruct = useCallback(
    () => playVoice(stepsFor([{ clip: CLIP_IDS.tapLetter, text: 'Ketuk hurufnya!' }])),
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
  useArrowKeys({ onPrev: goPrev, onNext: goNext, onActivate: say });

  return (
    <ScreenFrame
      title="Mengenal Huruf"
      onHome={onHome}
      onRepeat={instruct}
      caption={`Huruf ${index + 1} dari ${total} — ketuk hurufnya`}
    >
      <div className="flex w-full max-w-3xl items-center justify-between gap-4 sm:gap-8">
        <StepButton direction="prev" onClick={() => once('prev', goPrev)} label="Huruf sebelumnya" />

        <div className="relative flex items-center justify-center">
          {/* Expanding ring: the "sound made this happen" cue. */}
          {pulseKey > 0 && <PulseRing key={pulseKey} theme={themeFor(index)} />}

          <button
            type="button"
            onClick={say}
            aria-label={arabic ? `Dengarkan huruf ${hijaiyah.glyph} (${hijaiyah.title})` : `Dengarkan huruf ${latin}`}
            className={`toddler-tap relative flex size-56 items-center justify-center rounded-[3rem] bg-gradient-to-br ${themeFor(index)} text-white shadow-2xl outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 sm:size-72`}
          >
            <span
              key={`${glyph}-${pulseKey}`}
              lang={arabic ? 'ar' : undefined}
              className={`animate-pop-in font-black drop-shadow-lg ${
                arabic
                  ? 'font-arabic text-[8rem] sm:text-[11rem]'
                  : 'text-[9rem] leading-none sm:text-[13rem]'
              }`}
            >
              {glyph}
            </span>
            <Volume2
              aria-hidden="true"
              className="absolute right-5 bottom-5 size-8 opacity-70 sm:size-10"
              strokeWidth={2.5}
            />
          </button>
        </div>

        <StepButton direction="next" onClick={() => once('next', goNext)} label="Huruf berikutnya" />
      </div>

      {/* Latin: the lower-case twin, since the same letter looks different in
          books. Arabic: the letter's name in Latin script, for the grown-up
          beside the child who may not read Arabic. */}
      <p className="mt-6 text-5xl leading-tight font-black text-slate-500 sm:text-6xl" aria-hidden="true">
        {arabic ? hijaiyah.title : latin.toLowerCase()}
      </p>

      <div className="mt-6 flex flex-wrap items-start justify-center gap-6">
        {!arabic && <LangToggle value={letterLang} onChange={onLetterLangChange} />}
        <ScriptToggle value={script} onChange={onScriptChange} />
      </div>
    </ScreenFrame>
  );
}
