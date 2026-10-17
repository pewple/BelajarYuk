import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Eye, Hash, RotateCcw, Type } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { ModeChooser } from '../components/ModeChooser';
import type { ModeChoice } from '../components/ModeChooser';
import { IconButton, NextButton } from '../components/RoundButtons';
import { dueForReview, recordResult, reviewOrder } from '../data/review';
import { begin, drag, glyphOf, glyphsFor, inkUpTo, lift, newTrace, pathD, pointAt } from '../data/tracing';
import type { Pt, Trace, TraceEvent, TraceKind } from '../data/tracing';
import { CHEER_PROSODY } from '../audio/voice';
import { useAudio } from '../hooks/useAudio';
import type { LetterLang } from '../audio/words';
import { useHints } from '../hooks/useHints';
import { useFlash } from '../hooks/useFlash';
import { useInstruction, useKnowsTheDrill } from '../hooks/useInstruction';
import { useTapLock } from '../hooks/useTapLock';
import { chooseKindLine, followLine, glyphName } from '../media/menulisVoice';
import { stepsFor } from '../media/voiceParts';
import { useGameFinished } from '../state/play';

/** How long the "follow me" dot shows after a wander, or after "Tunjukkan caranya". */
const HELP_MS = 4000;

const CHOICES: ModeChoice<TraceKind>[] = [
  { id: 'letters', title: 'Huruf', glyph: 'A B C', icon: Type, theme: 'from-rose-500 to-red-600' },
  { id: 'numbers', title: 'Angka', glyph: '1 2 3', icon: Hash, theme: 'from-sky-600 to-blue-700' },
];

const INK: Record<TraceKind, string> = { letters: '#e11d48', numbers: '#0369a1' };

const keyFor = (kind: TraceKind, glyph: string) => `menulis:${kind}:${glyph}`;

/** Is the child's device set to reduce motion? Then nothing on the board moves by itself. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * Menulis - trace a letter or a number with a finger.
 *
 * First a letter or a number is chosen. Then one glyph at a time: a grey guide,
 * a dot where to start, and ink that follows the finger as long as it stays on
 * the line. See data/tracing.ts for the rules; they are very forgiving, and a
 * finger that wanders off simply stops drawing.
 *
 * A child who is new to it - or finding it hard - also gets a small dot that
 * travels the stroke ahead of them, "follow me". It goes once they have traced
 * a few strokes cleanly, comes back if they start to wander (see data/hints.ts),
 * and can always be asked for with "Tunjukkan caranya".
 *
 * It is drawn for a finger or a mouse. There is no keyboard way to trace, so
 * "Lanjut" is always there to move on.
 */
export function MenulisScreen({ onHome, letterLang }: { onHome: () => void; letterLang: LetterLang }) {
  const { playVoice, praiseStep, playPop, playChime, playNudge, playTap } = useAudio();
  const { guided, record } = useHints('menulis');
  const knowsTheDrill = useKnowsTheDrill();
  const once = useTapLock();

  /** What the child chose; null while they are still choosing. */
  const [kind, setKind] = useState<TraceKind | null>(null);
  const [round, setRound] = useState(0);
  const [place, setPlace] = useState({ index: 0, sequential: 0 });
  /** Bumped on a reset, so the same glyph starts clean. */
  const [attempt, setAttempt] = useState(0);

  const [trace, setTraceState] = useState<Trace>(newTrace);
  // The latest trace, for pointer events that arrive faster than React renders.
  const traceRef = useRef(trace);
  const setTrace = useCallback((next: Trace) => {
    traceRef.current = next;
    setTraceState(next);
  }, []);

  // The "follow me" dot, after a wander or when asked for; it goes back to rest by itself.
  const [help, setHelp] = useFlash(false, HELP_MS);
  const svgRef = useRef<SVGSVGElement>(null);
  const named = useRef(false);

  const glyphId = kind === null ? null : glyphsFor(kind)[place.index];
  const glyph = useMemo(() => (glyphId === null ? null : glyphOf(glyphId)), [glyphId]);
  // The guide never changes while a glyph is on screen, and the finger moves
  // many times a second: build each stroke's path once, not on every movement.
  const guidePaths = useMemo(() => (glyph === null ? [] : glyph.strokes.map((s) => pathD(s.points))), [glyph]);
  const done = trace.done;

  useGameFinished(done);

  /** A fresh glyph: no ink, nothing said yet. */
  const clear = useCallback(() => {
    setTrace(newTrace());
    setHelp(false);
    named.current = false;
  }, [setTrace]);

  const sayChoose = useCallback(() => playVoice(stepsFor(chooseKindLine())), [playVoice]);
  const sayFollow = useCallback(() => playVoice(stepsFor(followLine())), [playVoice]);

  // The choice is spoken first; once a few glyphs are done the child knows the
  // drill, so "Ikuti garisnya!" goes. A child who goes quiet hears it once more.
  const repeat = kind === null ? sayChoose : sayFollow;
  useInstruction(repeat, `${kind}-${round}-${attempt}`, {
    quiet: () => kind !== null && knowsTheDrill.current,
    active: !done,
  });

  const choose = useCallback(
    (picked: TraceKind) => {
      playTap();
      setKind(picked);
      setRound(0);
      setPlace({ index: 0, sequential: 0 });
      clear();
    },
    [clear, playTap],
  );

  const handleNext = useCallback(() => {
    if (kind === null) return;
    playTap();
    const list = glyphsFor(kind);
    const weak = dueForReview(`menulis:${kind}:`).map((k) => k.split(':').pop());
    setPlace((p) => reviewOrder(list.length, p.sequential, round + 1, (i) => weak.includes(list[i])));
    setRound((r) => r + 1);
    clear();
  }, [clear, kind, playTap, round]);

  const handleReset = useCallback(() => {
    playTap();
    setAttempt((a) => a + 1);
    clear();
  }, [clear, playTap]);

  const handleDemo = useCallback(() => {
    playTap();
    setHelp(true);
  }, [playTap]);

  /* ---------------------------------------------------------------- */
  /* The finger                                                        */
  /* ---------------------------------------------------------------- */

  /** A pointer position in board coordinates (0-100). */
  const toBoard = (event: PointerEvent): Pt | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
  };

  const react = useCallback(
    (event: TraceEvent, before: Trace) => {
      if (kind === null || glyphId === null) return;
      const name = glyphName(kind, glyphId, letterLang);

      switch (event.type) {
        case 'started':
          // The first touch of a glyph says what it is.
          if (!named.current && before.stroke === 0 && before.progress === 0) {
            named.current = true;
            playVoice(stepsFor([name]));
          }
          break;
        case 'off':
          playNudge();
          setHelp(true);
          break;
        case 'stroke':
          playPop();
          record(event.clean);
          recordResult(keyFor(kind, glyphId), event.clean);
          setHelp(false);
          break;
        case 'glyph':
          playPop();
          playChime();
          record(event.clean);
          recordResult(keyFor(kind, glyphId), event.clean);
          playVoice([...stepsFor([{ ...name, text: `${name.text}!` }], CHEER_PROSODY), praiseStep()]);
          break;
        case 'none':
          break;
      }
    },
    [glyphId, kind, letterLang, playChime, playNudge, playPop, playVoice, praiseStep, record],
  );

  const onDown = (event: PointerEvent<SVGSVGElement>) => {
    if (glyph === null) return;
    const p = toBoard(event);
    if (!p) return;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* Not every pointer can be captured; the board still works without. */
    }
    const before = traceRef.current;
    const step = begin(glyph, before, p);
    setTrace(step.trace);
    react(step.event, before);
  };

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    if (glyph === null || !traceRef.current.down) return;
    const p = toBoard(event);
    if (!p) return;
    const before = traceRef.current;
    const step = drag(glyph, before, p);
    setTrace(step.trace);
    react(step.event, before);
  };

  const onUp = () => setTrace(lift(traceRef.current));

  /* ---------------------------------------------------------------- */
  /* Choosing                                                          */
  /* ---------------------------------------------------------------- */

  if (kind === null || glyph === null || glyphId === null) {
    return (
      <ScreenFrame title="Menulis" onHome={onHome} onRepeat={repeat} caption="Pilih dulu, lalu menulis">
        <ModeChooser label="Pilih yang ditulis" choices={CHOICES} onChoose={choose} />
      </ScreenFrame>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Tracing                                                           */
  /* ---------------------------------------------------------------- */

  const noun = kind === 'letters' ? 'huruf' : 'angka';
  const ink = INK[kind];
  const current = glyph.strokes[Math.min(trace.stroke, glyph.strokes.length - 1)];
  const start = pointAt(current, trace.progress);
  const showFollow = !done && !prefersReducedMotion() && (guided || help);
  const inked = trace.stroke > 0 || trace.progress > 0 || done;

  return (
    <ScreenFrame
      title="Menulis"
      onHome={onHome}
      onRepeat={repeat}
      caption={done ? 'Bagus sekali!' : `Telusuri ${noun} ${glyphId}`}
    >
      {done && <Celebration key={`${round}-${attempt}`} headline={glyphId} subline={`${noun[0].toUpperCase()}${noun.slice(1)} ${glyphId}!`} />}

      <div className="flex w-full max-w-md flex-col items-center gap-5">
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          role="group"
          aria-label={`Papan menulis ${noun} ${glyphId}. Telusuri dengan jari mengikuti garis.`}
          data-progress={Math.round(trace.progress)}
          data-stroke={trace.stroke}
          data-done={done ? 'true' : undefined}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="aspect-square w-full touch-none rounded-[2.5rem] bg-white shadow-xl ring-4 ring-slate-200 select-none"
        >
          {/* The guide: every stroke, in grey. */}
          {guidePaths.map((d, i) => (
            <path key={`guide-${i}`} d={d} fill="none" stroke="#cbd5e1" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {/* The ink: strokes already finished, then the one being drawn. */}
          {glyph.strokes.map((stroke, i) => {
            const finished = done || i < trace.stroke;
            const points = finished ? stroke.points : i === trace.stroke ? inkUpTo(stroke, trace.progress) : [];
            return points.length > 1 ? (
              <path key={`ink-${i}`} d={finished ? guidePaths[i] : pathD(points)} fill="none" stroke={ink} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
            ) : null;
          })}

          {!done && (
            <>
              {/* Where to put the finger: the start dot, or where the ink ended. */}
              <circle cx={start.x} cy={start.y} r={6.5} fill="#fbbf24" stroke="#1e293b" strokeWidth={1.8} className="animate-pulse" data-testid="start-dot" />
              {glyph.strokes.length > 1 && (
                <text x={start.x} y={start.y + 2.6} textAnchor="middle" fontSize={7} fontWeight={900} fill="#1e293b" aria-hidden="true">
                  {trace.stroke + 1}
                </text>
              )}

              {/* "Follow me": a dot that travels the stroke ahead of the child. */}
              {showFollow && (
                <circle r={4} fill="#0ea5e9" stroke="#ffffff" strokeWidth={1.5} data-testid="follow-dot">
                  <animateMotion
                    key={`${trace.stroke}-${Math.round(trace.progress / 10)}`}
                    dur={`${Math.max(1.6, current.length / 35)}s`}
                    repeatCount="indefinite"
                    path={guidePaths[Math.min(trace.stroke, guidePaths.length - 1)]}
                  />
                </circle>
              )}
            </>
          )}
        </svg>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <IconButton label="Tunjukkan caranya" icon={Eye} tone="help" onClick={() => once('demo', handleDemo)} />

          {inked && <IconButton label="Ulangi menulis" icon={RotateCcw} onClick={() => once('reset', handleReset)} />}

          <NextButton
            label={done ? `${noun[0].toUpperCase()}${noun.slice(1)} berikutnya` : 'Lewati, berikutnya'}
            ready={done}
            onClick={() => once('next', handleNext)}
          />
        </div>
      </div>
    </ScreenFrame>
  );
}
