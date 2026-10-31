import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Images, Shuffle, Sparkles, Type } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { CardArt } from '../components/CardArt';
import { ModeChooser } from '../components/ModeChooser';
import type { ModeChoice } from '../components/ModeChooser';
import { NextButton } from '../components/RoundButtons';
import { ScriptToggle } from '../components/ScriptToggle';
import { ARABIC_WORD_CARDS } from '../data/arabicWords';
import { WORD_CARDS } from '../data/curriculum';
import { MEMORI_PREFIX, deal, flip, kindFor, levelsOf, memoriKey, pairsFor, partnerOf, seedFor, settle } from '../data/memori';
import type { Board, Face, MemoriKind, MemoriMode } from '../data/memori';
import { dueForReview, recordResult } from '../data/review';
import { HIJAIYAH, formatNumeral } from '../data/scripts';
import type { Script } from '../data/scripts';
import { useAudio } from '../hooks/useAudio';
import type { LetterLang } from '../audio/words';
import { useFlash } from '../hooks/useFlash';
import { useHints } from '../hooks/useHints';
import { useInstruction, useKnowsTheDrill } from '../hooks/useInstruction';
import { useTapLock } from '../hooks/useTapLock';
import { chooseModeLine, faceLabel, facePart, findSameLine, lookFirstLine, startLine } from '../media/memoriVoice';
import { arabicWordPicture, wordPicture } from '../media/pictures';
import { numberPart } from '../media/scriptVoice';
import { stepsFor } from '../media/voiceParts';
import { useGameFinished } from '../state/play';

/** How long two cards that do not match stay face up, so the child can see what they were. */
export const MISMATCH_MS = 1800;

/** Whole seconds the cards are shown at the start, for a child who is still being guided. */
export function peekSeconds(cards: number): number {
  return Math.ceil((2500 + 300 * cards) / 1000);
}

/** The same in milliseconds: a look before the hunt, counted down one second at a time. */
export function peekMs(cards: number): number {
  return peekSeconds(cards) * 1000;
}

/** From this many seconds left the countdown is spoken aloud ("tiga, dua, satu") instead of ticked. */
const SPOKEN_FROM = 3;

/** How long "Mulai!" stays up once the cards have turned. */
const START_MS = 1400;

const CHOICES: ModeChoice<MemoriMode>[] = [
  { id: 'gambar', title: 'Gambar', glyph: '▣ ▣', icon: Images, theme: 'from-rose-500 to-red-600' },
  { id: 'huruf', title: 'Huruf', glyph: 'A ▣', icon: Type, theme: 'from-sky-600 to-blue-700' },
  { id: 'acak', title: 'Acak', glyph: '? ?', icon: Shuffle, theme: 'from-violet-600 to-purple-700' },
];

type MemoriScreenProps = {
  onHome: () => void;
  letterLang: LetterLang;
  script: Script;
  onScriptChange: (next: Script) => void;
};

/**
 * Memori - turn two cards over and find the pairs. See data/memori.ts for the
 * rules; this is the table, the voice, and what the child is helped with.
 *
 * First comes the choice of what the pairs are made of: Gambar (the same
 * picture twice), Huruf (a letter and a picture that starts with it) or Acak
 * (a coin is flipped for every round).
 *
 * A child who is new to the game, or has been struggling, gets two helps: all
 * the cards face up for a few seconds before the hunt, and after a wrong guess
 * the missing partner glows. Both go once they have found a few pairs without
 * trouble, and return if they start to struggle (see data/hints.ts).
 *
 * The first help is counted down so nobody is caught out by the cards turning:
 * "Lihat dulu!", a big number and a bar that empties, a tick each second and
 * the last three spoken, then "Mulai!" as the cards go down.
 */
export function MemoriScreen({ onHome, letterLang, script, onScriptChange }: MemoriScreenProps) {
  const { playVoice, playChime, playTap } = useAudio();
  const { guided, record } = useHints('memori');
  const knowsTheDrill = useKnowsTheDrill();
  const once = useTapLock();

  /** What the child chose; null while they are still choosing. */
  const [mode, setMode] = useState<MemoriMode | null>(null);
  /** What *this* round is made of. Fixed by the choice, except for "Acak". */
  const [kind, setKind] = useState<MemoriKind>('picture');
  const [round, setRound] = useState(0);
  /** Rounds finished in each kind: how far along its own run of levels it has got. */
  const [played, setPlayed] = useState<Record<MemoriKind, number>>({ picture: 0, letter: 0 });
  /** Bumped on a restart, so the same round deals again. */
  const [attempt, setAttempt] = useState(0);
  const [won, setWon] = useState(false);

  const levels = levelsOf(kind);
  const level = levels[played[kind] % levels.length];

  useGameFinished(won);

  // Once a few rounds are done the child knows the drill, so the opening
  // instruction goes; a child who goes quiet hears it once more. A child who is
  // being guided hears it as the countdown ends instead ("Mulai! Cari yang
  // sama!"), so it is not said over "Lihat dulu!".
  const instruct = useCallback(() => playVoice(stepsFor(findSameLine())), [playVoice]);
  const sayChoose = useCallback(() => playVoice(stepsFor(chooseModeLine())), [playVoice]);
  const repeat = mode === null ? sayChoose : instruct;
  useInstruction(repeat, `${mode}-${round}-${attempt}`, {
    quiet: () => mode !== null && (knowsTheDrill.current || guided),
    active: !won,
  });

  // Fumbled pairs come back first. Worked out once per round - not on every
  // flip, which would reshuffle the table under the child's fingers.
  const board = useMemo(() => {
    const weak = dueForReview(MEMORI_PREFIX).map((key) => key.slice(MEMORI_PREFIX.length));
    return deal(pairsFor(level, round, script, weak), seedFor(level, round));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new round, a new script, or a restart
  }, [level, round, script, attempt]);

  const choose = useCallback(
    (picked: MemoriMode) => {
      playTap();
      setMode(picked);
      setKind(kindFor(picked));
      setRound(0);
      setPlayed({ picture: 0, letter: 0 });
      setAttempt(0);
      setWon(false);
    },
    [playTap],
  );

  const handleNext = useCallback(() => {
    if (mode === null) return;
    playTap();
    setWon(false);
    setPlayed((p) => ({ ...p, [kind]: p[kind] + 1 }));
    // "Acak" flips its coin again for every round; a fixed choice stays put.
    setKind(kindFor(mode));
    setRound((r) => r + 1);
  }, [kind, mode, playTap]);

  const handleRestart = useCallback(() => {
    playTap();
    setWon(false);
    setAttempt((a) => a + 1);
  }, [playTap]);

  if (mode === null) {
    return (
      <ScreenFrame title="Memori" onHome={onHome} onRepeat={repeat} caption="Pilih dulu, lalu mulai">
        <ModeChooser label="Pilih jenis pasangan" choices={CHOICES} onChoose={choose} />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      title="Memori"
      onHome={onHome}
      onRepeat={repeat}
      caption={won ? 'Semua pasangan ketemu!' : 'Cari yang sama'}
    >
      {won && <Celebration key={`${round}-${attempt}`} headline="Hebat!" subline="Semua pasangan ketemu!" />}

      <div className="flex w-full max-w-xl flex-col items-center gap-6">
        <Table
          key={`${level.id}-${round}-${attempt}-${script}`}
          start={board}
          guided={guided}
          letterLang={letterLang}
          script={script}
          onResult={(right, pairId) => {
            record(right);
            recordResult(memoriKey(pairId), right);
          }}
          onWon={() => {
            setWon(true);
            playChime();
          }}
        />

        <div className="flex items-center justify-center gap-4">
          {won && <NextButton label="Memori berikutnya" onClick={() => once('next', handleNext)} />}
          {!won && (
            <button
              type="button"
              onClick={() => once('restart', handleRestart)}
              aria-label="Kocok ulang kartu"
              className="toddler-tap flex h-16 items-center justify-center rounded-3xl bg-white px-6 text-lg font-black text-slate-700 shadow-lg ring-2 ring-slate-200 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95"
            >
              Kocok ulang
            </button>
          )}
        </div>

        <ScriptToggle value={script} onChange={onScriptChange} />
      </div>
    </ScreenFrame>
  );
}

/* ------------------------------------------------------------------ */
/* The table                                                           */
/* ------------------------------------------------------------------ */

type TableProps = {
  /** The cards as dealt. The table keeps its own state from here. */
  start: Board;
  guided: boolean;
  letterLang: LetterLang;
  /** The countdown is shown and said in this script's numerals. */
  script: Script;
  /** One attempt ended: the pair the child was looking for, and whether they found it. */
  onResult: (right: boolean, pairId: string) => void;
  onWon: () => void;
};

function Table({ start, guided, letterLang, script, onResult, onWon }: TableProps) {
  const { playVoice, praiseStep, playPop, playNudge, playTick, playGo } = useAudio();
  const once = useTapLock();

  const [board, setBoard] = useState<Board>(start);
  // Whether this table starts with a peek is fixed by how the child was doing
  // when it was dealt; a hint level that changes mid-round must not replay it.
  const [opened] = useState(guided);
  const total = peekSeconds(start.cards.length);
  // Guided children see every card for a few seconds before they are turned
  // down: how many seconds are left, and 0 once the hunt can begin.
  const [left, setLeft] = useState(opened ? total : 0);
  const peeking = left > 0;
  // "Mulai!" for a moment after the cards turn; it goes back to rest by itself.
  const [starting, setStarting] = useFlash(false, START_MS);
  // Where the last wrong guess's first card was, so its partner can be pointed at.
  const [lookedFor, setLookedFor] = useState<number | null>(null);

  // The countdown: "Lihat dulu!", a tick each second, the last few spoken, and
  // "Mulai!" with the instruction as the cards go down. One timer ticking once
  // a second rather than one long wait, so the number on screen and the sound
  // are the same thing.
  useEffect(() => {
    if (!opened) return;
    playVoice(stepsFor(lookFirstLine()));

    let remaining = total;
    const id = window.setInterval(() => {
      remaining -= 1;
      setLeft(remaining);
      if (remaining > SPOKEN_FROM) {
        playTick();
      } else if (remaining > 0) {
        playVoice(stepsFor([numberPart(remaining, script)]));
      } else {
        window.clearInterval(id);
        playGo();
        playVoice(stepsFor([...startLine(), ...findSameLine()]));
        setStarting(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
    // Once per table: the audio functions are stable, and a new round is a new table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Two cards that did not match turn back after a moment.
  useEffect(() => {
    if (board.mismatch === null) return;
    const id = window.setTimeout(() => setBoard((b) => settle(b)), MISMATCH_MS);
    return () => window.clearTimeout(id);
  }, [board.mismatch]);

  const turn = useCallback(
    (index: number) => {
      if (peeking) return;
      const result = flip(board, index);
      if (result.outcome === 'ignored') return;

      setBoard(result.board);
      const said = stepsFor([facePart(board.cards[index].face, letterLang)]);
      // The last card says its name and is praised in one unbroken run.
      playVoice(result.outcome === 'won' ? [...said, praiseStep()] : said);

      if (result.outcome === 'first') {
        setLookedFor(null);
        return;
      }

      if (result.outcome === 'mismatch') {
        playNudge();
        setLookedFor(board.first);
        onResult(false, result.pair!);
      } else {
        playPop();
        setLookedFor(null);
        onResult(true, result.pair!);
        if (result.outcome === 'won') onWon();
      }
    },
    [board, letterLang, onResult, onWon, peeking, playNudge, playPop, playVoice, praiseStep],
  );

  const cols = board.cards.length <= 4 ? 2 : board.cards.length <= 6 ? 3 : 4;
  const hinted = guided && lookedFor !== null ? partnerOf(board, lookedFor) : null;
  const maxWidth = `${cols * 8}rem`;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* The countdown. Its space is kept once the cards are down, so they do not jump. */}
      {opened && (
        <div
          role="status"
          data-testid="peek-banner"
          className="flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-3xl bg-amber-100 px-4 py-2 ring-2 ring-amber-300"
          style={{ maxWidth: `max(${maxWidth}, 20rem)` }}
        >
          {peeking ? (
            <>
              <div className="flex items-center gap-3 text-amber-900">
                <Eye aria-hidden="true" className="size-8" strokeWidth={2.4} />
                <span className="text-2xl font-black whitespace-nowrap">Lihat dulu!</span>
                <span
                  key={left}
                  aria-hidden="true"
                  data-testid="peek-count"
                  className={`animate-pop-in flex size-12 items-center justify-center rounded-full text-3xl font-black text-white ${
                    left <= SPOKEN_FROM ? 'bg-rose-600' : 'bg-amber-700'
                  }`}
                >
                  {formatNumeral(left, script)}
                </span>
              </div>
              <div aria-hidden="true" className="h-3 w-full overflow-hidden rounded-full bg-amber-200">
                <div
                  className="animate-peek-shrink h-full w-full rounded-full bg-amber-600"
                  style={{ animationDuration: `${total}s` }}
                />
              </div>
            </>
          ) : starting ? (
            <span className="animate-pop-in text-3xl font-black text-emerald-800">Mulai!</span>
          ) : null}
        </div>
      )}

      <div
        role="group"
        aria-label={peeking ? 'Kartu, lihat dulu' : 'Kartu'}
        className="grid w-full gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth }}
      >
        {board.cards.map((card) => {
          const faceUp = peeking || card.state !== 'down';
          const name = faceLabel(card.face);
          const state = card.state === 'matched' ? `, ${name}, sudah cocok` : faceUp ? `, ${name}` : ', tertutup';

          return (
            <button
              key={card.index}
              type="button"
              onClick={() => once(`card-${card.index}`, () => turn(card.index))}
              disabled={card.state === 'matched'}
              aria-label={`Kartu ${card.index + 1}${state}`}
              data-state={peeking ? 'up' : card.state}
              data-hint={hinted === card.index ? 'true' : undefined}
              className={`toddler-tap relative flex aspect-square items-center justify-center rounded-3xl shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-slate-800 active:scale-95 ${
                faceUp
                  ? card.state === 'matched'
                    ? 'bg-emerald-50 ring-4 ring-emerald-500'
                    : peeking
                      ? 'bg-white ring-4 ring-amber-300'
                      : 'bg-white ring-2 ring-slate-200'
                  : 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white'
              } ${hinted === card.index ? 'animate-gentle-bob ring-4 ring-amber-400!' : ''}`}
            >
              {faceUp ? (
                <FaceView face={card.face} />
              ) : (
                <Sparkles aria-hidden="true" className="size-1/3 opacity-90" strokeWidth={2.2} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Draws a face: a picture, a Latin letter, or an Arabic one. */
function FaceView({ face }: { face: Face }) {
  if (face.kind === 'word') {
    const card = WORD_CARDS.find((c) => c.word === face.word);
    if (!card) return null;
    return (
      <CardArt
        icon={card.icon}
        picture={wordPicture(card.word)}
        className="animate-pop-in size-3/5 text-slate-700"
        strokeWidth={1.8}
      />
    );
  }

  if (face.kind === 'letter') {
    return (
      <span className="animate-pop-in text-5xl font-black text-rose-600 sm:text-6xl">
        {face.letter}
        <span className="text-slate-500">{face.letter.toLowerCase()}</span>
      </span>
    );
  }

  if (face.kind === 'hijaiyah') {
    const letter = HIJAIYAH.find((h) => h.id === face.letterId);
    return (
      <span lang="ar" className="animate-pop-in font-arabic text-6xl font-black text-rose-600 sm:text-7xl">
        {letter?.glyph}
      </span>
    );
  }

  const card = ARABIC_WORD_CARDS.find((c) => c.letterId === face.letterId);
  if (!card) return null;
  return (
    <CardArt
      icon={card.icon}
      picture={arabicWordPicture(card.letterId)}
      className="animate-pop-in size-3/5 text-slate-700"
      strokeWidth={1.8}
    />
  );
}
