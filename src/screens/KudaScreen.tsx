import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Apple, ArrowBigUp, Carrot, Check, ChevronsRight, CornerUpLeft, CornerUpRight, Footprints, Palette, Pause, Star, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Pony, UnicornHead } from '../components/drawnIcons';
import { COATS, FOODS, KINDS, MANES, PATTERNS, coatById, coatKey, hasCoat, hasKind, hasMane, hasPattern, kindKey, loadCloset, maneById, maneKey, patternKey, saveCloset } from '../data/kuda';
import type { Closet, Coat, Food, FoodId, Kind, Mane, Pattern, PatternId } from '../data/kuda';
import { useAudio } from '../hooks/useAudio';
import { useFlash } from '../hooks/useFlash';
import { useInstruction } from '../hooks/useInstruction';
import { useSwallowGameKeys } from '../hooks/useSwallowGameKeys';
import { useTapLock } from '../hooks/useTapLock';
import { canDrawPony, createPony } from '../kuda/pony';
import type { PonyApi, PonyColors, PonyGait } from '../kuda/pony';
import { ateLine, helloLine, newHorseLine, notEnoughLine, prettyLine } from '../media/kudaVoice';
import { stepsFor } from '../media/voiceParts';
import { usePlay } from '../state/play';
import { spendStars, useWallet } from '../state/stars';

/** The credit the horse carries wherever it goes. */
export const PONY_CREDIT = 'Kuda ini dibuat dari “Horse” oleh typescript.dev';

const GAIT_BUTTONS: { gait: PonyGait; label: string; icon: LucideIcon }[] = [
  { gait: 0, label: 'Berhenti', icon: Pause },
  { gait: 1, label: 'Jalan', icon: Footprints },
  { gait: 2, label: 'Lari', icon: ChevronsRight },
  { gait: 3, label: 'Kencang', icon: Zap },
];

const FOOD_ICONS: Record<FoodId, LucideIcon> = { wortel: Carrot, apel: Apple };

const WIGGLE_MS = 500;

function colorsFor(closet: Closet): PonyColors {
  const coat = coatById(closet.coat), mane = maneById(closet.mane);
  return { body: coat.body, points: coat.points, muzzle: coat.muzzle, maneDark: mane.dark, maneLight: mane.light, rainbow: mane.rainbow, pattern: closet.pattern };
}

/** A little picture of a pattern on the coat that is on now, for its button. */
function patternFill(pattern: PatternId, body: string, points: string): string {
  const white = '#f3efe6';
  switch (pattern) {
    case 'totol':
      return [
        `radial-gradient(circle at 30% 62%, ${points} 0 9%, transparent 10%)`,
        `radial-gradient(circle at 62% 38%, ${points} 0 8%, transparent 9%)`,
        `radial-gradient(circle at 72% 70%, ${points} 0 7%, transparent 8%)`,
        `radial-gradient(circle at 46% 22%, ${points} 0 6%, transparent 7%)`,
        `linear-gradient(90deg, ${body} 45%, ${white} 45%)`,
      ].join(', ');
    case 'belang':
      return `radial-gradient(circle at 28% 32%, ${white} 0 24%, transparent 25%), radial-gradient(circle at 72% 72%, ${white} 0 28%, transparent 29%), ${body}`;
    case 'bintik':
      return `radial-gradient(circle, rgba(255,255,255,0.55) 0 28%, transparent 42%) 0 0 / 14px 14px, ${body}`;
    default:
      return body;
  }
}

type Status = 'loading' | 'ready' | 'unsupported' | 'failed';

/**
 * Kuda - the horse, and where the stars go.
 *
 * Every right answer in the other games earns a star. Here they buy a carrot
 * or an apple, which the horse stops to eat, a new colour for its coat or its
 * mane, or a different horse: the child starts with a foal, and can buy a pony
 * and a grown horse. Bought things are kept. Nothing here can be got wrong;
 * it is the reward, so it stays simple: make the horse walk, run, gallop,
 * turn and rear, and spend.
 *
 * The horse is three.js (see kuda/pony.ts). A device that cannot draw it still
 * gets the shop for colours and horses; food needs a horse to eat it.
 */
export function KudaScreen({ onHome }: { onHome: () => void }) {
  const { playVoice, playTap, playPop, playChime, playNudge } = useAudio();
  const { reportGame } = usePlay();
  const { stars } = useWallet();
  const once = useTapLock();

  const stageRef = useRef<HTMLDivElement>(null);
  const ponyRef = useRef<PonyApi | null>(null);
  const [drawable] = useState(canDrawPony);
  const [status, setStatus] = useState<Status>(drawable ? 'loading' : 'unsupported');
  const [gait, setGait] = useState<PonyGait>(0);
  const [eating, setEating] = useState<FoodId | null>(null);
  const [closet, setCloset] = useState<Closet>(loadCloset);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [kindsOpen, setKindsOpen] = useState(false);
  const [wiggling, setWiggling] = useFlash<string | null>(null, WIGGLE_MS);

  const closetRef = useRef(closet);
  closetRef.current = closet;

  const sayHello = useCallback(() => playVoice(stepsFor(helloLine())), [playVoice]);
  useInstruction(sayHello, 'kuda', { active: false });

  // The latest handlers, so the pony (made once) always calls the current ones.
  const onAteRef = useRef<(food: FoodId) => void>(() => {});
  onAteRef.current = (id: FoodId) => {
    setEating(null);
    const food = FOODS.find((f) => f.id === id);
    if (food) playVoice(stepsFor(ateLine(food)));
    playChime();
    reportGame();
  };

  // A different horse is a different body, so it is built anew: the old one is
  // given back and the new one made, which takes a moment.
  const kind = closet.kind;
  useEffect(() => {
    if (!drawable) return;
    const stage = stageRef.current;
    if (!stage) return;
    setStatus('loading');
    setGait(0);
    setEating(null);
    // A canvas of its own for every horse: one whose WebGL context was handed
    // back cannot be drawn on again, and React may mount this effect twice.
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'Kuda. Ketuk kudanya supaya berdiri.');
    canvas.className = 'absolute inset-0 size-full touch-none';
    stage.appendChild(canvas);
    let api: PonyApi | null = null;
    try {
      api = createPony(canvas, colorsFor(closetRef.current), {
        onReady: () => setStatus('ready'),
        onGait: (g) => setGait(g),
        onAte: (food) => onAteRef.current(food),
        onError: () => setStatus('failed'),
      }, kind);
    } catch {
      canvas.remove();
      setStatus('failed');
      return;
    }
    ponyRef.current = api;
    return () => {
      api?.dispose();
      canvas.remove();
      ponyRef.current = null;
    };
    // Made once per horse; colours and moves go through the api.
  }, [drawable, kind]);

  const ready = status === 'ready';

  const chooseGait = (g: PonyGait) =>
    once(`gait-${g}`, () => {
      if (!ready || eating) return;
      playTap();
      setGait(g);
      ponyRef.current?.setGait(g);
    });

  const rear = () =>
    once('rear', () => {
      if (!ready || eating) return;
      playTap();
      ponyRef.current?.rear();
    });

  const steer = (dir: -1 | 0 | 1) => ponyRef.current?.steer(dir);

  const refuse = (key: string) => {
    playNudge();
    setWiggling(key);
    playVoice(stepsFor(notEnoughLine()));
  };

  const buyFood = (food: Food) =>
    once(`food-${food.id}`, () => {
      const pony = ponyRef.current;
      if (!ready || !pony || eating || pony.isEating()) return;
      if (!spendStars(food.price)) {
        refuse(`food-${food.id}`);
        return;
      }
      playPop();
      pony.feed(food.id);
      setEating(food.id);
      setGait(0);
    });

  const wear = (next: Closet, bought: boolean) => {
    setCloset(next);
    saveCloset(next);
    // A new kind of horse is built with the colours already on; anything else is repainted.
    if (next.kind === closet.kind) ponyRef.current?.setColors(colorsFor(next));
    if (bought) {
      playChime();
      playVoice(stepsFor(next.kind !== closet.kind ? newHorseLine() : prettyLine()));
      reportGame();
    } else playTap();
  };

  const pickKind = (k: Kind) =>
    once(`kind-${k.id}`, () => {
      if (hasKind(closet, k)) {
        if (closet.kind !== k.id) wear({ ...closet, kind: k.id }, false);
        return;
      }
      if (!spendStars(k.price)) {
        refuse(`kind-${k.id}`);
        return;
      }
      wear({ ...closet, owned: [...closet.owned, kindKey(k.id)], kind: k.id }, true);
    });

  const pickCoat = (coat: Coat) =>
    once(`coat-${coat.id}`, () => {
      if (hasCoat(closet, coat)) {
        if (closet.coat !== coat.id) wear({ ...closet, coat: coat.id }, false);
        return;
      }
      if (!spendStars(coat.price)) {
        refuse(`coat-${coat.id}`);
        return;
      }
      wear({ ...closet, owned: [...closet.owned, coatKey(coat.id)], coat: coat.id }, true);
    });

  const pickPattern = (pattern: Pattern) =>
    once(`pattern-${pattern.id}`, () => {
      if (hasPattern(closet, pattern)) {
        if (closet.pattern !== pattern.id) wear({ ...closet, pattern: pattern.id }, false);
        return;
      }
      if (!spendStars(pattern.price)) {
        refuse(`pattern-${pattern.id}`);
        return;
      }
      wear({ ...closet, owned: [...closet.owned, patternKey(pattern.id)], pattern: pattern.id }, true);
    });

  const pickMane = (mane: Mane) =>
    once(`mane-${mane.id}`, () => {
      if (hasMane(closet, mane)) {
        if (closet.mane !== mane.id) wear({ ...closet, mane: mane.id }, false);
        return;
      }
      if (!spendStars(mane.price)) {
        refuse(`mane-${mane.id}`);
        return;
      }
      wear({ ...closet, owned: [...closet.owned, maneKey(mane.id)], mane: mane.id }, true);
    });

  // Arrow keys and space, for a child at a computer: left/right turn while held,
  // up/down change gait, space rears. Not while the colours are open.
  const gaitRef = useRef(gait);
  gaitRef.current = gait;
  useEffect(() => {
    if (colorsOpen || kindsOpen || !ready) return;
    const held = new Set<string>();
    const sync = () => steer(held.has('ArrowLeft') ? (held.has('ArrowRight') ? 0 : 1) : held.has('ArrowRight') ? -1 : 0);
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        held.add(e.key);
        sync();
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.repeat) {
        e.preventDefault();
        const next = Math.max(0, Math.min(3, gaitRef.current + (e.key === 'ArrowUp' ? 1 : -1))) as PonyGait;
        if (ponyRef.current?.isEating()) return;
        setGait(next);
        ponyRef.current?.setGait(next);
      } else if ((e.key === ' ' || e.key === 'Spacebar') && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        if (!e.repeat) ponyRef.current?.rear();
      }
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.key);
      sync();
    };
    const blur = () => {
      held.clear();
      sync();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      steer(0);
    };
  }, [colorsOpen, kindsOpen, ready]);

  const hasPony = drawable && status !== 'failed';

  return (
    <ScreenFrame title="Kuda" onHome={onHome} onRepeat={sayHello}>
      <div className="flex w-full max-w-5xl flex-1 flex-col gap-3">
        <div className="relative min-h-64 flex-1 overflow-hidden rounded-[2rem] bg-sky-200 shadow-inner ring-2 ring-sky-300">
          {hasPony && <div ref={stageRef} className="absolute inset-0" />}
          {status === 'loading' && (
            <p className="absolute inset-0 flex items-center justify-center text-xl font-black text-sky-900">Menyiapkan kudanya…</p>
          )}
          {!hasPony && (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-lg font-bold text-sky-900">
              Perangkat ini belum bisa menampilkan kudanya. Warna dan kudanya tetap bisa dipilih.
            </p>
          )}
          {/* The credit stays on the horse itself, readable on any screen size. */}
          <p className="pointer-events-none absolute right-3 bottom-2 left-3 z-10 text-right text-[11px] leading-tight font-semibold text-slate-800/80 select-none">
            {PONY_CREDIT}
          </p>
        </div>

        {/* Moves: the four gaits in one row; turning and rearing in another, so left and right stay side by side. */}
        <div role="group" aria-label="Gerakan" className="flex flex-wrap items-stretch justify-center gap-x-4 gap-y-2">
          <div className="flex gap-2">
            {GAIT_BUTTONS.map(({ gait: g, label, icon: Icon }) => (
              <MoveButton key={label} label={label} pressed={gait === g} disabled={!ready || !!eating} onClick={() => chooseGait(g)}>
                <Icon className="size-7 sm:size-8" strokeWidth={2.4} aria-hidden="true" />
              </MoveButton>
            ))}
          </div>
          <div className="flex gap-2">
            <SteerButton label="Belok kiri" icon={CornerUpLeft} disabled={!ready} onHold={(on) => steer(on ? 1 : 0)} />
            <MoveButton label="Berdiri" disabled={!ready || !!eating} onClick={rear}>
              <ArrowBigUp className="size-7 sm:size-8" strokeWidth={2.4} aria-hidden="true" />
            </MoveButton>
            <SteerButton label="Belok kanan" icon={CornerUpRight} disabled={!ready} onHold={(on) => steer(on ? -1 : 0)} />
          </div>
        </div>

        {/* The shop: food on the spot; colours and horses to keep. */}
        <div role="group" aria-label="Toko" className="mx-auto grid w-full max-w-2xl grid-cols-4 gap-2">
          {FOODS.map((food) => {
            const Icon = FOOD_ICONS[food.id];
            return (
              <button
                key={food.id}
                type="button"
                onClick={() => buyFood(food)}
                disabled={!ready || !!eating}
                aria-label={`${food.name}, ${food.price} bintang`}
                data-wiggle={wiggling === `food-${food.id}` ? 'true' : undefined}
                className={`toddler-tap flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-3xl bg-white px-2 py-1.5 text-slate-800 sm:flex-row sm:gap-2 shadow-lg ring-2 ring-orange-200 outline-none focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 disabled:opacity-50 ${
                  wiggling === `food-${food.id}` ? 'animate-wiggle' : ''
                } ${eating === food.id ? 'ring-4 ring-orange-400' : ''}`}
              >
                <Icon className="size-8" style={{ color: food.color }} strokeWidth={2.4} aria-hidden="true" />
                <span className="text-base font-black sm:text-lg">{food.name}</span>
                <Price n={food.price} short={stars < food.price} />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              playTap();
              setColorsOpen(true);
            }}
            aria-haspopup="dialog"
            className="toddler-tap flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-3xl bg-white px-2 py-1.5 text-slate-800 sm:flex-row sm:gap-2 shadow-lg ring-2 ring-violet-200 outline-none focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95"
          >
            <Palette className="size-8 text-violet-600" strokeWidth={2.4} aria-hidden="true" />
            <span className="text-base font-black sm:text-lg">Warna</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playTap();
              setKindsOpen(true);
            }}
            aria-haspopup="dialog"
            className="toddler-tap flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-3xl bg-white px-2 py-1.5 text-slate-800 shadow-lg ring-2 ring-lime-200 outline-none focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 sm:flex-row sm:gap-2"
          >
            <Pony className="size-8 text-lime-700" strokeWidth={2.2} aria-hidden="true" />
            <span className="text-base font-black sm:text-lg">Kuda</span>
          </button>
        </div>
      </div>

      {colorsOpen && (
        <ColorPicker
          closet={closet}
          stars={stars}
          wiggling={wiggling}
          onCoat={pickCoat}
          onPattern={pickPattern}
          onMane={pickMane}
          onClose={() => {
            playTap();
            setColorsOpen(false);
          }}
        />
      )}

      {kindsOpen && (
        <Sheet
          label="Pilih kuda"
          title="Kuda"
          icon={<Pony className="size-8 shrink-0 text-lime-700" strokeWidth={2.2} aria-hidden="true" />}
          onClose={() => {
            playTap();
            setKindsOpen(false);
          }}
        >
          <Swatches
            title="Kuda"
            heading={false}
            columns={4}
            items={KINDS.map((k) => ({
              id: k.id,
              name: k.name,
              price: k.price,
              owned: hasKind(closet, k),
              worn: closet.kind === k.id,
              picture: k.id === 'unikorn'
                ? <UnicornHead className="text-violet-700" strokeWidth={2} style={{ width: `${3.5 * k.scale}rem`, height: `${3.5 * k.scale}rem` }} />
                : <Pony className="text-lime-800" strokeWidth={2} style={{ width: `${3.5 * k.scale}rem`, height: `${3.5 * k.scale}rem` }} />,
            }))}
            kind="kind"
            stars={stars}
            wiggling={wiggling}
            onPick={(id) => pickKind(KINDS.find((k) => k.id === id)!)}
          />
        </Sheet>
      )}
    </ScreenFrame>
  );
}

function Price({ n, short }: { n: number; short: boolean }) {
  return (
    <span
      className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-base font-black tabular-nums ${
        short ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-800'
      }`}
      aria-hidden="true"
    >
      <Star className="size-4 fill-amber-400 text-amber-500" strokeWidth={2.4} />
      {n}
    </span>
  );
}

function MoveButton({ label, pressed, disabled, onClick, children }: { label: string; pressed?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`toddler-tap flex min-h-16 min-w-16 flex-col items-center justify-center rounded-3xl px-3 py-1 shadow-lg ring-2 outline-none focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 disabled:opacity-50 sm:min-w-20 ${
        pressed ? 'bg-emerald-600 text-white ring-emerald-700' : 'bg-white text-emerald-800 ring-emerald-200'
      }`}
    >
      {children}
      <span className="text-sm font-black">{label}</span>
    </button>
  );
}

/** Turns while held down: let go and the pony goes straight on. */
function SteerButton({ label, icon: Icon, disabled, onHold }: { label: string; icon: LucideIcon; disabled?: boolean; onHold: (on: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onLostPointerCapture={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
      className="toddler-tap flex min-h-16 min-w-16 touch-none items-center justify-center rounded-3xl bg-white text-sky-800 shadow-lg ring-2 ring-sky-200 outline-none select-none focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 active:bg-sky-100 disabled:opacity-50 sm:min-w-20"
    >
      <Icon className="size-8 sm:size-9" strokeWidth={2.6} aria-hidden="true" />
    </button>
  );
}

type ColorPickerProps = {
  closet: Closet;
  stars: number;
  wiggling: string | null;
  onCoat: (coat: Coat) => void;
  onPattern: (pattern: Pattern) => void;
  onMane: (mane: Mane) => void;
  onClose: () => void;
};

/** A panel over the game with a title and a big close button; Escape closes it too. */
function Sheet({ label, title, icon, onClose, children }: { label: string; title: string; icon: ReactNode; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useSwallowGameKeys();
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-[2rem] bg-white p-4 shadow-2xl outline-none sm:p-6"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="flex-1 text-2xl font-black text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="toddler-tap flex size-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-700 shadow ring-2 ring-slate-200 outline-none focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95"
          >
            <X className="size-8" strokeWidth={2.6} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Colours for the coat and the mane. One tap buys (if need be) and puts on. */
function ColorPicker({ closet, stars, wiggling, onCoat, onPattern, onMane, onClose }: ColorPickerProps) {
  const coat = coatById(closet.coat);
  return (
    <Sheet
      label="Warna kuda"
      title="Warna"
      icon={<Palette className="size-8 shrink-0 text-violet-600" strokeWidth={2.4} aria-hidden="true" />}
      onClose={onClose}
    >
        <Swatches
          title="Kulit"
          items={COATS.map((c) => ({ id: c.id, name: c.name, price: c.price, owned: hasCoat(closet, c), worn: closet.coat === c.id, fill: c.body }))}
          kind="coat"
          stars={stars}
          wiggling={wiggling}
          onPick={(id) => onCoat(COATS.find((c) => c.id === id)!)}
        />
        <Swatches
          title="Corak"
          items={PATTERNS.map((p) => ({ id: p.id, name: p.name, price: p.price, owned: hasPattern(closet, p), worn: closet.pattern === p.id, fill: patternFill(p.id, coat.body, coat.points) }))}
          kind="pattern"
          stars={stars}
          wiggling={wiggling}
          onPick={(id) => onPattern(PATTERNS.find((p) => p.id === id)!)}
        />
        <Swatches
          title="Rambut"
          items={MANES.map((m) => ({
            id: m.id,
            name: m.name,
            price: m.price,
            owned: hasMane(closet, m),
            worn: closet.mane === m.id,
            fill: m.rainbow ? 'linear-gradient(135deg,#ef4444,#f59e0b,#eab308,#22c55e,#3b82f6,#8b5cf6)' : `linear-gradient(135deg, ${m.light}, ${m.dark})`,
          }))}
          kind="mane"
          stars={stars}
          wiggling={wiggling}
          onPick={(id) => onMane(MANES.find((m) => m.id === id)!)}
        />
    </Sheet>
  );
}

type SwatchItem = { id: string; name: string; price: number; owned: boolean; worn: boolean; fill?: string; picture?: ReactNode };

type SwatchesProps = {
  title: string;
  items: SwatchItem[];
  kind: 'coat' | 'pattern' | 'mane' | 'kind';
  columns?: 3 | 4;
  /** Show the title above the swatches; off when the panel's own title already says it. */
  heading?: boolean;
  stars: number;
  wiggling: string | null;
  onPick: (id: string) => void;
};

function Swatches({ title, items, kind, columns = 4, heading = true, stars, wiggling, onPick }: SwatchesProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      {heading && <h3 className="text-lg font-black text-slate-700">{title}</h3>}
      <div className={`grid gap-2 sm:gap-3 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
        {items.map((item) => {
          const key = `${kind}-${item.id}`;
          const state = item.worn ? 'dipakai' : item.owned ? 'sudah punya' : `${item.price} bintang`;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(item.id)}
              aria-label={`${kind === 'kind' ? item.name : `${title} ${item.name.toLowerCase()}`}, ${state}`}
              aria-pressed={item.worn}
              data-wiggle={wiggling === key ? 'true' : undefined}
              className={`toddler-tap flex min-h-24 flex-col items-center justify-center gap-1 rounded-3xl bg-slate-50 p-2 shadow ring-2 outline-none focus-visible:ring-4 focus-visible:ring-sky-400 active:scale-95 ${
                item.worn ? 'ring-4 ring-emerald-500' : 'ring-slate-200'
              } ${wiggling === key ? 'animate-wiggle' : ''}`}
            >
              <span
                className={`relative flex items-end justify-center ${item.picture ? 'h-14 w-16' : 'size-12 rounded-full shadow-inner ring-2 ring-black/10'}`}
                style={item.fill ? { background: item.fill } : undefined}
                aria-hidden="true"
              >
                {item.picture}
                {item.worn && (
                  <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="text-sm leading-tight font-bold text-slate-700">{item.name}</span>
              {!item.owned && <Price n={item.price} short={stars < item.price} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
