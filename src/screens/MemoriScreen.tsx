import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { CardArt } from '../components/CardArt';
import { NextButton } from '../components/RoundButtons';
import { ScriptToggle } from '../components/ScriptToggle';
import { ARABIC_WORD_CARDS } from '../data/arabicWords';
import { WORD_CARDS } from '../data/curriculum';
import { MEMORI_LEVELS, MEMORI_PREFIX, deal, flip, memoriKey, pairsFor, partnerOf, seedFor, settle } from '../data/memori';
import type { Board, Face } from '../data/memori';
import { dueForReview, recordResult } from '../data/review';
import { HIJAIYAH } from '../data/scripts';
import type { Script } from '../data/scripts';
import { useAudio } from '../hooks/useAudio';
import type { LetterLang } from '../audio/words';
import { useHints } from '../hooks/useHints';
import { useInstruction, useKnowsTheDrill } from '../hooks/useInstruction';
import { useTapLock } from '../hooks/useTapLock';
import { faceLabel, facePart, findSameLine } from '../media/memoriVoice';
import { arabicWordPicture, wordPicture } from '../media/pictures';
import { stepsFor } from '../media/voiceParts';
import { useGameFinished } from '../state/play';

/** How long two cards that do not match stay face up, so the child can see what they were. */
export const MISMATCH_MS = 1800;

/** Face-up time at the start for a child who is still being guided: a look before the hunt. */
export function peekMs(cards: number): number {
  return 2500 + 300 * cards;
}

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
 * A child who is new to the game, or has been struggling, gets two helps: all
 * the cards face up for a few seconds before the hunt, and after a wrong guess
 * the missing partner glows. Both go once they have found a few pairs without
 * trouble, and return if they start to struggle (see data/hints.ts).
 */
export function MemoriScreen({ onHome, letterLang, script, onScriptChange }: MemoriScreenProps) {
  const { playVoice, playChime, playTap } = useAudio();
  const { guided, record } = useHints('memori');
  const knowsTheDrill = useKnowsTheDrill();
  const once = useTapLock();

  const [round, setRound] = useState(0);
  const [levelIndex, setLevelIndex] = useState(0);
  /** Bumped on a restart, so the same round deals again. */
  const [attempt, setAttempt] = useState(0);
  const [won, setWon] = useState(false);

  const level = MEMORI_LEVELS[levelIndex];

  useGameFinished(won);

  // Once a few rounds are done the child knows the drill, so the opening
  // instruction goes; a child who goes quiet hears it once more.
  const instruct = useCallback(() => playVoice(stepsFor(findSameLine())), [playVoice]);
  useInstruction(instruct, `${round}-${attempt}`, { quiet: () => knowsTheDrill.current, active: !won });

  // Fumbled pairs come back first. Worked out once per round - not on every
  // flip, which would reshuffle the table under the child's fingers.
  const board = useMemo(() => {
    const weak = dueForReview(MEMORI_PREFIX).map((key) => key.slice(MEMORI_PREFIX.length));
    return deal(pairsFor(level, round, script, weak), seedFor(level, round));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new round, a new script, or a restart
  }, [level, round, script, attempt]);

  const handleNext = useCallback(() => {
    playTap();
    setWon(false);
    setRound((r) => r + 1);
    setLevelIndex((i) => (i + 1) % MEMORI_LEVELS.length);
  }, [playTap]);

  const handleRestart = useCallback(() => {
    playTap();
    setWon(false);
    setAttempt((a) => a + 1);
  }, [playTap]);

  return (
    <ScreenFrame
      title="Memori"
      onHome={onHome}
      onRepeat={instruct}
      caption={won ? 'Semua pasangan ketemu!' : 'Cari yang sama'}
    >
      {won && <Celebration key={`${round}-${attempt}`} headline="Hebat!" subline="Semua pasangan ketemu!" />}

      <div className="flex w-full max-w-xl flex-col items-center gap-6">
        <Table
          key={`${level.id}-${round}-${attempt}-${script}`}
          start={board}
          guided={guided}
          letterLang={letterLang}
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
  /** One attempt ended: the pair the child was looking for, and whether they found it. */
  onResult: (right: boolean, pairId: string) => void;
  onWon: () => void;
};

function Table({ start, guided, letterLang, onResult, onWon }: TableProps) {
  const { playVoice, praiseStep, playPop, playNudge } = useAudio();
  const once = useTapLock();

  const [board, setBoard] = useState<Board>(start);
  // Guided children see every card for a moment before they are turned down.
  const [peeking, setPeeking] = useState(guided);
  // Where the last wrong guess's first card was, so its partner can be pointed at.
  const [lookedFor, setLookedFor] = useState<number | null>(null);

  // Whether this table started with a peek is fixed by how the child was doing
  // when it was dealt; a hint level that changes mid-round must not replay it.
  useEffect(() => {
    if (!peeking) return;
    const id = window.setTimeout(() => setPeeking(false), peekMs(start.cards.length));
    return () => window.clearTimeout(id);
  }, [peeking, start.cards.length]);

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

  return (
    <div
      role="group"
      aria-label={peeking ? 'Kartu, lihat dulu' : 'Kartu'}
      className="grid w-full gap-3"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${cols * 8}rem` }}
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
