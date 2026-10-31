import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Binary, CaseLower, Eye, Hash, Languages, RotateCcw, Type } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { ModeChooser } from '../components/ModeChooser';
import type { ModeChoice } from '../components/ModeChooser';
import { IconButton, NextButton } from '../components/RoundButtons';
import { LOWERCASE_LINES } from '../data/glyphsLatin';
import { DOT_LENGTH, begin, drag, glyphOf, glyphsFor, inkUpTo, isArabicKind, lift, newTrace, pathD, pointAt } from '../data/tracing';
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
  { id: 'lowercase', title: 'Huruf kecil', glyph: 'a b c', icon: CaseLower, theme: 'from-orange-500 to-amber-600' },
  { id: 'numbers', title: 'Angka', glyph: '1 2 3', icon: Hash, theme: 'from-sky-600 to-blue-700' },
  { id: 'hijaiyah', title: 'Hijaiyah', glyph: 'ا ب ت', icon: Languages, theme: 'from-emerald-600 to-teal-700' },
  { id: 'arabicNumbers', title: 'Angka Arab', glyph: '١ ٢ ٣', icon: Binary, theme: 'from-violet-600 to-purple-700' },
];

const INK: Record<TraceKind, string> = {
  letters: '#e11d48',
  lowercase: '#c2410c',
  numbers: '#0369a1',
  hijaiyah: '#047857',
  arabicNumbers: '#7c3aed',
};

/** What a glyph of each kind is called in the caption and for assistive tech. */
const NOUN: Record<TraceKind, string> = {
  letters: 'huruf',
  lowercase: 'huruf kecil',
  numbers: 'angka',
  hijaiyah: 'huruf hijaiyah',
  arabicNumbers: 'angka Arab',
};

const capitalise = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}`;

/** Is the child's device set to reduce motion? Then nothing on the board moves by itself. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * Menulis - trace a letter or a number with a finger.
 *
 * First the kind is chosen: capitals, small letters, numbers, hijaiyah or Arabic
 * numerals. Then one glyph at a time, always in order - A to Z, a to z, 0 to 9,
 * alif to ya, ٠ to ٩ - and round again at the end: a grey guide, a dot where to
 * start, and ink that follows the finger as long as it stays on the line. See
 * data/tracing.ts for the rules; they are very forgiving, and a finger that
 * wanders off simply stops drawing.
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
  /** Where in the list of glyphs of this kind: it only ever goes one on. */
  const [index, setIndex] = useState(0);
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
  // Where the board is on the screen, measured when a finger goes down: it does
  // not move while it is being drawn on, and measuring it on every movement is
  // what makes a pen stutter.
  const boardRect = useRef<DOMRect | null>(null);
  const named = useRef(false);

  const glyphId = kind === null ? null : glyphsFor(kind)[index];
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
      setIndex(0);
      clear();
    },
    [clear, playTap],
  );

  // Always the next one in the list, and back to the first after the last: a
  // child learning their letters is taught them in order, so nothing is skipped
  // over or brought back early.
  const handleNext = useCallback(() => {
    if (kind === null) return;
    playTap();
    setIndex((i) => (i + 1) % glyphsFor(kind).length);
    setRound((r) => r + 1);
    clear();
  }, [clear, kind, playTap]);

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

  /** A screen position in board coordinates (0-100), by the board as it was when the finger went down. */
  const toBoard = (clientX: number, clientY: number): Pt | null => {
    const rect = boardRect.current ?? svgRef.current?.getBoundingClientRect() ?? null;
    if (!rect || !rect.width || !rect.height) return null;
    return { x: ((clientX - rect.left) / rect.width) * 100, y: ((clientY - rect.top) / rect.height) * 100 };
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
          setHelp(false);
          break;
        case 'glyph':
          playPop();
          playChime();
          record(event.clean);
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
    boardRect.current = event.currentTarget.getBoundingClientRect();
    const p = toBoard(event.clientX, event.clientY);
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

    // A screen delivers a finger's path in fewer, bigger steps than it was
    // really drawn in; the browser keeps the ones in between. Following all of
    // them is what keeps a quick stroke from falling behind the ink.
    const path = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const moves = path.length > 0 ? path : [event.nativeEvent];

    let latest = traceRef.current;
    for (const move of moves) {
      const p = toBoard(move.clientX, move.clientY);
      if (!p) continue;
      const step = drag(glyph, latest, p);
      react(step.event, latest);
      latest = step.trace;
    }
    if (latest !== traceRef.current) setTrace(latest);
  };

  const onUp = () => {
    boardRect.current = null;
    setTrace(lift(traceRef.current));
  };

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

  const noun = NOUN[kind];
  const arabic = isArabicKind(kind);
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
      {done && (
        <Celebration
          key={`${round}-${attempt}`}
          headline={glyphId}
          headlineLang={arabic ? 'ar' : undefined}
          subline={`${capitalise(noun)} ${glyphId}!`}
        />
      )}

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
          {/* The lines of a copybook, for small letters: where they stand and how tall they are. */}
          {kind === 'lowercase' && (
            <g data-testid="copybook-lines" aria-hidden="true" strokeWidth={0.7}>
              <line x1={0} x2={100} y1={LOWERCASE_LINES.top} y2={LOWERCASE_LINES.top} stroke="#e2e8f0" />
              <line x1={0} x2={100} y1={LOWERCASE_LINES.middle} y2={LOWERCASE_LINES.middle} stroke="#fda4af" strokeDasharray="2 2" />
              <line x1={0} x2={100} y1={LOWERCASE_LINES.base} y2={LOWERCASE_LINES.base} stroke="#94a3b8" />
            </g>
          )}

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
              {/* Where to put the finger: the start dot, or where the ink ended. It holds
                  still while a finger is on it: a pulsing dot under the pen looks like a flicker. */}
              <circle
                cx={start.x}
                cy={start.y}
                r={6.5}
                fill="#fbbf24"
                stroke="#1e293b"
                strokeWidth={1.8}
                className={trace.down ? undefined : 'animate-pulse'}
                data-testid="start-dot"
              />
              {glyph.strokes.length > 1 && (
                <text x={start.x} y={start.y + 2.6} textAnchor="middle" fontSize={7} fontWeight={900} fill="#1e293b" aria-hidden="true">
                  {trace.stroke + 1}
                </text>
              )}

              {/* "Follow me": a dot that travels the stroke ahead of the child. */}
              {showFollow && current.length > DOT_LENGTH && (
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

        {arabic && !done && (
          <p className="text-sm font-bold text-slate-600">Bahasa Arab ditulis dari kanan ke kiri.</p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <IconButton label="Tunjukkan caranya" icon={Eye} tone="help" onClick={() => once('demo', handleDemo)} />

          {inked && <IconButton label="Ulangi menulis" icon={RotateCcw} onClick={() => once('reset', handleReset)} />}

          <NextButton
            label={done ? `${capitalise(noun)} berikutnya` : 'Lewati, berikutnya'}
            ready={done}
            onClick={() => once('next', handleNext)}
          />
        </div>
      </div>
    </ScreenFrame>
  );
}
