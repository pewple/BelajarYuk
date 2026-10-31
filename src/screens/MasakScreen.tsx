import { useCallback, useEffect, useRef, useState } from 'react';
import { Columns2, ListOrdered, RotateCcw, Timer } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { ModeChooser } from '../components/ModeChooser';
import type { ModeChoice } from '../components/ModeChooser';
import { BurnerButton, IngredientButton, OrderCard } from '../components/KitchenParts';
import { IconButton, NextButton } from '../components/RoundButtons';
import {
  addIngredient,
  burnerState,
  burnersFor,
  isFinished,
  nextPointer,
  ordersFor,
  pantryFor,
  shelfOrder,
  shortOfStock,
  startCooking,
  startKitchen,
  stepOf,
  takeOff,
  waitingToCook,
  wantedIngredient,
} from '../data/memasak';
import type { Kitchen, Level } from '../data/memasak';
import { CHEER_PROSODY } from '../audio/voice';
import { useAudio } from '../hooks/useAudio';
import { useFlash } from '../hooks/useFlash';
import { useHints } from '../hooks/useHints';
import { useInstruction, useKnowsTheDrill } from '../hooks/useInstruction';
import { useTapLock } from '../hooks/useTapLock';
import {
  burntLine,
  chooseLine,
  cookNowLine,
  doneLine,
  findLine,
  ingredientPart,
  orderLine,
  outLine,
  readyLine,
  shopAgainLine,
  waitLine,
} from '../media/memasakVoice';
import { stepsFor } from '../media/voiceParts';
import { useGameFinished } from '../state/play';

/** How long the right ingredient (or the stove) glows after a wrong tap. */
const HINT_MS = 2600;
/** How long "Habis! Ayo belanja lagi!" stays up before the pantry is filled again. */
export const SHOP_AGAIN_MS = 2400;
/** How often the clock on the stove looks at the time. */
const TICK_MS = 100;

const CHOICES: ModeChoice<Level>[] = [
  { id: 'susun', title: 'Susun', glyph: '1 → 2', icon: ListOrdered, theme: 'from-emerald-600 to-teal-700' },
  { id: 'tunggu', title: 'Tunggu', glyph: '3 2 1', icon: Timer, theme: 'from-amber-600 to-orange-700' },
  { id: 'dua', title: 'Dua sekaligus', glyph: '▣ ▣', icon: Columns2, theme: 'from-rose-500 to-red-600' },
];

/** A kitchen laid out for one order of a level. `round` varies which unwanted things sit on the shelf. */
function setUp(level: Level, place: number, round: number): Kitchen {
  const orders = ordersFor(level);
  const order = orders[place % orders.length];
  return startKitchen(order, pantryFor(order, round), burnersFor(level));
}

/**
 * Memasak - cooking, one step after another.
 *
 * First the child picks how: Susun (put the ingredients in, in the order of the
 * recipe card), Tunggu (and one step is cooking - wait for it, and take it off
 * in time) or Dua sekaligus (two dishes, two burners: start one, and get on
 * with the other while it cooks). See data/memasak.ts for the rules.
 *
 * Nothing is ever a failure. A wrong ingredient is a soft sound, "Cari telur!"
 * and a glow; tapping a pot that is not ready says "Tunggu ya!"; a dish left too
 * long burns, and starts again. A child who is guided is pointed at what to do
 * next and their food cannot burn; that goes once they have got a few right in
 * a row, and returns if they struggle (see data/hints.ts).
 *
 * The pantry is limited: every ingredient used comes off its dots. If a burnt
 * dish used up what was left, the shelves are simply filled again.
 */
export function MasakScreen({ onHome }: { onHome: () => void }) {
  const { playVoice, praiseStep, playPop, playChime, playNudge, playRegister, playTap } = useAudio();
  const { guided, record } = useHints('memasak');
  const knowsTheDrill = useKnowsTheDrill();
  const once = useTapLock();

  /** What the child chose; null while they are still choosing. */
  const [level, setLevel] = useState<Level | null>(null);
  /** Which order of the level is being cooked: they come one after another, round again at the end. */
  const [place, setPlace] = useState(0);
  const [round, setRound] = useState(0);
  /** Bumped on a restart or a shopping trip, so the same order is announced again. */
  const [attempt, setAttempt] = useState(0);
  const [kitchen, setKitchenState] = useState<Kitchen>(() => setUp('susun', 0, 0));
  // The latest kitchen, for taps that arrive faster than React renders.
  const kitchenRef = useRef(kitchen);
  const setKitchen = useCallback((next: Kitchen) => {
    kitchenRef.current = next;
    setKitchenState(next);
  }, []);

  const [now, setNow] = useState(() => Date.now());
  const [hintIngredient, setHintIngredient] = useFlash<string | null>(null, HINT_MS);
  const [hintStove, setHintStove] = useFlash(false, HINT_MS);

  const done = level !== null && isFinished(kitchen);
  const shopping = level !== null && !done && shortOfStock(kitchen);
  const cooking = kitchen.burners.some((b) => b !== null);

  useGameFinished(done);

  // The stove's clock: only while something is on it.
  useEffect(() => {
    if (!cooking) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [cooking]);

  const fresh = useCallback(
    (nextLevel: Level, nextPlace: number, nextRound: number) => {
      setKitchen(setUp(nextLevel, nextPlace, nextRound));
      setHintIngredient(null);
      setHintStove(false);
    },
    [setHintIngredient, setHintStove, setKitchen],
  );

  /* ---------------------------------------------------------------- */
  /* Saying what to do                                                 */
  /* ---------------------------------------------------------------- */

  const sayChoose = useCallback(() => playVoice(stepsFor(chooseLine())), [playVoice]);
  const sayOrder = useCallback(
    (full: boolean) => playVoice(stepsFor(orderLine(kitchenRef.current.order, full))),
    [playVoice],
  );

  // The order is said aloud when it comes - with its ingredients, in order, until
  // the child knows the drill - and again, once, if they go quiet.
  const repeat = level === null ? sayChoose : () => sayOrder(true);
  useInstruction(() => (level === null ? sayChoose() : sayOrder(!knowsTheDrill.current)), `${level}-${round}-${attempt}`, {
    remind: repeat,
    active: !done,
  });

  const choose = useCallback(
    (picked: Level) => {
      playTap();
      setLevel(picked);
      setPlace(0);
      setRound(0);
      setAttempt(0);
      fresh(picked, 0, 0);
    },
    [fresh, playTap],
  );

  /* ---------------------------------------------------------------- */
  /* What the stove tells                                              */
  /* ---------------------------------------------------------------- */

  // A burner that has just become ready rings; one that has just burnt says so.
  // Each is told once, however many times the clock looks at it.
  const told = useRef(new Set<string>());
  useEffect(() => {
    kitchen.burners.forEach((burner, i) => {
      if (!burner) return;
      const { state } = burnerState(kitchen, i, now);
      const key = `${i}-${burner.at}-${state}`;
      if ((state !== 'ready' && state !== 'burnt') || told.current.has(key)) return;
      told.current.add(key);

      if (state === 'ready') {
        playRegister();
        playVoice(stepsFor(readyLine()));
      } else {
        // Burnt: a soft sound and the words, and it counts as a miss.
        playNudge();
        playVoice(stepsFor(burntLine()));
        record(false);
      }
    });
  }, [kitchen, now, playNudge, playRegister, playVoice, record]);

  // Out of something because of a burnt dish: go shopping, rather than leave the child stuck.
  useEffect(() => {
    if (!shopping || level === null) return;
    playNudge();
    playVoice(stepsFor(shopAgainLine()));
    const id = window.setTimeout(() => {
      fresh(level, place, round);
      setAttempt((a) => a + 1);
    }, SHOP_AGAIN_MS);
    return () => window.clearTimeout(id);
  }, [shopping, level, place, round, fresh, playNudge, playVoice]);

  /* ---------------------------------------------------------------- */
  /* Taps                                                              */
  /* ---------------------------------------------------------------- */

  const finishedLine = useCallback(
    (kitchenNow: Kitchen, dish: number) => {
      const wholeOrder = isFinished(kitchenNow);
      // The last dish says its name and is praised in one unbroken run.
      const said = stepsFor(doneLine(kitchenNow.order[dish]), wholeOrder ? CHEER_PROSODY : undefined);
      playVoice(wholeOrder ? [...said, praiseStep()] : said);
      if (wholeOrder) playChime();
    },
    [playChime, playVoice, praiseStep],
  );

  const tapIngredient = useCallback(
    (id: string) => {
      const before = kitchenRef.current;
      if (isFinished(before) || shortOfStock(before)) return;
      const result = addIngredient(before, id);

      if (result.outcome === 'wrong') {
        // Not what the recipe asks for now: a soft nudge, the right one by name, and a glow.
        playNudge();
        record(false);
        const wanted = wantedIngredient(before);
        if (wanted) {
          setHintIngredient(wanted);
          playVoice(stepsFor(findLine(wanted)));
        } else if (waitingToCook(before).length > 0) {
          setHintStove(true);
          playVoice(stepsFor(cookNowLine()));
        }
        return;
      }

      if (result.outcome === 'empty') {
        playNudge();
        playVoice(stepsFor(outLine()));
        return;
      }

      setKitchen(result.kitchen);
      playPop();
      record(true);
      if (result.finished) {
        finishedLine(result.kitchen, result.dish);
        return;
      }
      // Its name, and - when the next thing to do is cook - where to go next.
      const next = stepOf(result.kitchen, result.dish);
      playVoice(stepsFor([ingredientPart(id), ...(next?.kind === 'cook' ? cookNowLine() : [])]));
    },
    [finishedLine, playNudge, playPop, playVoice, record, setHintIngredient, setHintStove, setKitchen],
  );

  const tapBurner = useCallback(
    (index: number) => {
      const before = kitchenRef.current;
      const at = Date.now();
      const { state } = burnerState(before, index, at);

      if (state === 'empty') {
        // Something that is waiting to cook goes on; with nothing waiting it is just a stove.
        // Food of a child who is being guided cannot burn.
        const started = startCooking(before, index, at, !guided);
        if (!started) {
          playTap();
          return;
        }
        setKitchen(started.kitchen);
        setNow(at);
        playPop();
        playVoice(stepsFor(waitLine()));
        return;
      }

      const result = takeOff(before, index, at);
      if (result.outcome === 'early') {
        // Not ready: nothing is lost, and nothing counts against the child.
        playNudge();
        playVoice(stepsFor(waitLine()));
        return;
      }

      setKitchen(result.kitchen);
      if (result.outcome === 'cooked') {
        playPop();
        record(true);
        if (result.finished) finishedLine(result.kitchen, result.dish);
      }
      // A burnt dish was already counted (and told) when it burnt; taking it off just clears the stove.
    },
    [finishedLine, guided, playNudge, playPop, playTap, playVoice, record, setKitchen],
  );

  const handleReset = useCallback(() => {
    if (level === null) return;
    playTap();
    fresh(level, place, round);
    setAttempt((a) => a + 1);
  }, [fresh, level, place, playTap, round]);

  const handleNext = useCallback(() => {
    if (level === null) return;
    playTap();
    const nextPlace = place + 1;
    setPlace(nextPlace);
    setRound((r) => r + 1);
    fresh(level, nextPlace, round + 1);
  }, [fresh, level, place, playTap, round]);

  /* ---------------------------------------------------------------- */
  /* Choosing                                                          */
  /* ---------------------------------------------------------------- */

  if (level === null) {
    return (
      <ScreenFrame title="Memasak" onHome={onHome} onRepeat={repeat} caption="Pilih dulu, lalu masak">
        <ModeChooser label="Pilih cara memasak" choices={CHOICES} onChoose={choose} />
      </ScreenFrame>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Cooking                                                           */
  /* ---------------------------------------------------------------- */

  const pointer = guided && !done && !shopping ? nextPointer(kitchen, now) : null;
  const hintStoveNow = hintStove || pointer?.kind === 'burner';
  const dishNames = kitchen.order.map((r) => r.name).join(' dan ');

  return (
    <ScreenFrame
      title="Memasak"
      onHome={onHome}
      onRepeat={repeat}
      caption={done ? 'Masakannya sudah jadi!' : 'Ikuti resepnya'}
    >
      {done && <Celebration key={`${round}-${attempt}`} headline="Hebat!" subline={`${dishNames} jadi!`} />}

      <div className="flex w-full max-w-xl flex-col gap-5">
        {/* What to cook. */}
        <ul aria-label="Pesanan" className="flex flex-col gap-3">
          {kitchen.order.map((recipe, dish) => (
            <OrderCard key={recipe.id} recipe={recipe} progress={kitchen.progress[dish]} showNext={guided && !done} />
          ))}
        </ul>

        {shopping && (
          <p
            role="alert"
            className="animate-pop-in rounded-2xl bg-amber-100 px-4 py-3 text-center text-xl font-black text-amber-800 ring-2 ring-amber-300"
          >
            Habis! Ayo belanja lagi!
          </p>
        )}

        {/* The stove: nothing to cook on in level 1. */}
        {kitchen.burners.length > 0 && (
          <section aria-label="Kompor" className="flex items-center justify-center gap-5">
            {kitchen.burners.map((burner, i) => {
              const { state, progress } = burnerState(kitchen, i, now);
              const dish = burner ? kitchen.order[burner.dish] : null;
              const step = burner ? stepOf(kitchen, burner.dish) : null;
              const seconds = step?.kind === 'cook' ? step.seconds : 0;
              return (
                <BurnerButton
                  key={i}
                  number={i + 1}
                  state={state}
                  progress={progress}
                  secondsLeft={Math.max(0, Math.ceil(seconds * (1 - progress)))}
                  dish={dish}
                  hinted={hintStoveNow && (pointer?.kind === 'burner' ? pointer.index === i : state === 'empty')}
                  onClick={() => once(`burner-${i}`, () => tapBurner(i))}
                />
              );
            })}
          </section>
        )}

        {/* The pantry. */}
        {!done && (
          <section aria-label="Bahan" className="flex flex-col items-center gap-3">
            <p className="text-sm font-bold text-slate-600">Ketuk bahan, sesuai resep</p>
            <div className="grid w-full grid-cols-3 gap-3">
              {shelfOrder(kitchen.stock).map((id) => (
                <IngredientButton
                  key={id}
                  id={id}
                  left={kitchen.stock[id]}
                  hinted={id === hintIngredient || (pointer?.kind === 'ingredient' && pointer.id === id)}
                  onClick={() => once(`ingredient-${id}`, () => tapIngredient(id))}
                />
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center justify-center gap-4">
          {(kitchen.progress.some((p) => p > 0) || cooking) && !done && (
            <IconButton label="Mulai lagi" icon={RotateCcw} onClick={() => once('reset', handleReset)} />
          )}
          {done && <NextButton label="Resep berikutnya" onClick={() => once('next', handleNext)} />}
        </div>
      </div>
    </ScreenFrame>
  );
}
