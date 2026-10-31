import { useCallback, useEffect, useRef, useState } from 'react';
import { Columns2, ListOrdered, Repeat, RotateCcw, Split, Timer } from 'lucide-react';
import { ScreenFrame } from '../components/ScreenFrame';
import { Celebration } from '../components/Celebration';
import { ModeChooser } from '../components/ModeChooser';
import type { ModeChoice } from '../components/ModeChooser';
import { BurnerButton, CustomerBar, IngredientButton, OrderCard, ServiceBell, SpoonButton } from '../components/KitchenParts';
import { IconButton, NextButton } from '../components/RoundButtons';
import {
  addIngredient,
  burnerState,
  cooks,
  customerFor,
  isFinished,
  moodOf,
  nextPointer,
  ordersFor,
  pantryFor,
  patienceLeft,
  shelfOrder,
  shortOfStock,
  startCooking,
  startKitchen,
  stepOf,
  stirDish,
  stirs,
  takeOff,
  waitingToCook,
  waitingToStir,
  wantedIngredient,
} from '../data/memasak';
import type { Kitchen, Level, Pointer } from '../data/memasak';
import { CHEER_PROSODY } from '../audio/voice';
import { useAudio } from '../hooks/useAudio';
import { useFlash } from '../hooks/useFlash';
import { useHints } from '../hooks/useHints';
import { useInstruction, useKnowsTheDrill } from '../hooks/useInstruction';
import { useTapLock } from '../hooks/useTapLock';
import {
  bellLine,
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
  stirLine,
  upsetLine,
  waitLine,
  welcomeLine,
} from '../media/memasakVoice';
import { numberPart } from '../media/scriptVoice';
import { stepsFor } from '../media/voiceParts';
import { useGameFinished } from '../state/play';

/** How long the right ingredient (or pot, or spoon) glows after a wrong tap. */
const HINT_MS = 2600;
/** How long "Habis! Ayo belanja lagi!" stays up before the pantry is filled again. */
export const SHOP_AGAIN_MS = 2400;
/** How long a customer who gave up is shown, before the bell is there to ring again. */
export const UPSET_MS = 2600;
/** How often the clock looks at the time while a customer is waiting. */
const TICK_MS = 100;

const CHOICES: ModeChoice<Level>[] = [
  { id: 'susun', title: 'Susun', glyph: '1 → 2', icon: ListOrdered, theme: 'from-emerald-600 to-teal-700' },
  { id: 'tunggu', title: 'Tunggu', glyph: '3 2 1', icon: Timer, theme: 'from-amber-600 to-orange-700' },
  { id: 'dua', title: 'Dua sekaligus', glyph: '▣ ▣', icon: Columns2, theme: 'from-rose-500 to-red-600' },
  { id: 'aduk', title: 'Aduk', glyph: '↻ ↻ ↻', icon: Repeat, theme: 'from-sky-600 to-blue-700' },
  { id: 'kalau', title: 'Kalau', glyph: '? → ✓', icon: Split, theme: 'from-violet-600 to-purple-700' },
];

/** A kitchen laid out for one order of a level. `round` varies which unwanted things sit on the shelf. */
function setUp(level: Level, place: number, round: number): Kitchen {
  const orders = ordersFor(level);
  const order = orders[place % orders.length];
  return startKitchen(order, pantryFor(order, round));
}

type Arrival = { at: number; /** A child being guided has customers who wait for ever. */ patient: boolean };

const same = (a: Pointer | null, b: Pointer | null) => a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b);

/**
 * Memasak - cooking for a customer, one step after another.
 *
 * The counter starts with only a bell. Ringing it brings the customer, their
 * order, and the kitchen. First the child picks how (the screen before that):
 * Susun, Tunggu, Dua sekaligus, Aduk or Kalau. See data/memasak.ts for the rules.
 *
 * Each dish has its own pot (and a spoon, where there is stirring) at the end of
 * its recipe, so what to tap sits beside what it is for.
 *
 * A customer does not wait for ever: a bar under them empties, and their face
 * goes from a smile to a frown. If it empties they leave, soft-spoken, and the
 * bell is there to ring again. Nothing is ever a failure beyond that. A wrong
 * ingredient is a soft sound, "Cari telur!" and a glow; tapping a pot that is
 * not ready says "Tunggu ya!"; a dish left too long burns, and starts again.
 * A child who is guided is pointed at what to do next, their food cannot burn
 * and their customer is patient; that goes once they have got a few right in a
 * row, and returns if they struggle (see data/hints.ts).
 */
export function MasakScreen({ onHome }: { onHome: () => void }) {
  const { playVoice, praiseStep, playPop, playChime, playNudge, playRegister, playTap, playBell } = useAudio();
  const { guided, record } = useHints('memasak');
  const knowsTheDrill = useKnowsTheDrill();
  const once = useTapLock();

  /** What the child chose; null while they are still choosing. */
  const [level, setLevel] = useState<Level | null>(null);
  /** Which order of the level is being cooked: they come one after another, round again at the end. */
  const [place, setPlace] = useState(0);
  const [round, setRound] = useState(0);
  /** Bumped on a restart, a shopping trip or a customer leaving, so the order is announced again. */
  const [attempt, setAttempt] = useState(0);
  const [kitchen, setKitchenState] = useState<Kitchen>(() => setUp('susun', 0, 0));
  // The latest kitchen, for taps that arrive faster than React renders.
  const kitchenRef = useRef(kitchen);
  const setKitchen = useCallback((next: Kitchen) => {
    kitchenRef.current = next;
    setKitchenState(next);
  }, []);

  /** Has the bell been rung? Until it has, there is no customer and no kitchen. */
  const [arrival, setArrivalState] = useState<Arrival | null>(null);
  const arrivalRef = useRef<Arrival | null>(null);
  const setArrival = useCallback((next: Arrival | null) => {
    arrivalRef.current = next;
    setArrivalState(next);
  }, []);

  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useFlash<Pointer | null>(null, HINT_MS);

  const done = level !== null && arrival !== null && isFinished(kitchen);
  const shopping = level !== null && arrival !== null && !done && shortOfStock(kitchen);
  const patient = arrival?.patient ?? true;
  const left = level !== null && arrival ? patienceLeft(level, arrival.at, now, patient) : 1;
  const gone = level !== null && arrival !== null && !done && !patient && left <= 0;

  useGameFinished(done);

  // The clock: while a customer is waiting.
  const waiting = arrival !== null && !done;
  useEffect(() => {
    if (!waiting) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [waiting]);

  /** Is the customer already gone? Taps look at the clock itself, not at what was last drawn. */
  const isGone = useCallback(() => {
    const current = arrivalRef.current;
    return current !== null && level !== null && !current.patient && patienceLeft(level, current.at, Date.now(), false) <= 0;
  }, [level]);

  const fresh = useCallback(
    (nextLevel: Level, nextPlace: number, nextRound: number) => {
      setKitchen(setUp(nextLevel, nextPlace, nextRound));
      setFlash(null);
    },
    [setFlash, setKitchen],
  );

  /* ---------------------------------------------------------------- */
  /* Saying what to do                                                 */
  /* ---------------------------------------------------------------- */

  const sayChoose = useCallback(() => playVoice(stepsFor(chooseLine())), [playVoice]);
  const sayBell = useCallback(() => playVoice(stepsFor(bellLine())), [playVoice]);
  const sayOrder = useCallback(
    (full: boolean) => playVoice(stepsFor(orderLine(kitchenRef.current.order, full))),
    [playVoice],
  );

  // First the choice, then the bell, then the order - each said aloud as it
  // comes (with its ingredients, in order, until the child knows the drill),
  // and again, once, if they go quiet.
  const repeat = level === null ? sayChoose : arrival === null ? sayBell : () => sayOrder(true);
  useInstruction(
    () => (level === null ? sayChoose() : arrival === null ? sayBell() : sayOrder(!knowsTheDrill.current)),
    `${level}-${round}-${attempt}`,
    { remind: repeat, active: !done },
  );

  const choose = useCallback(
    (picked: Level) => {
      playTap();
      setLevel(picked);
      setPlace(0);
      setRound(0);
      setAttempt(0);
      setArrival(null);
      fresh(picked, 0, 0);
    },
    [fresh, playTap, setArrival],
  );

  /** The bell: the customer comes in, says hello and gives their order. */
  const ring = useCallback(() => {
    const at = Date.now();
    playBell();
    setArrival({ at, patient: guided });
    setNow(at);
    playVoice(stepsFor([...welcomeLine(), ...orderLine(kitchenRef.current.order, !knowsTheDrill.current)]));
  }, [guided, knowsTheDrill, playBell, playVoice, setArrival]);

  /* ---------------------------------------------------------------- */
  /* What the stove tells                                              */
  /* ---------------------------------------------------------------- */

  // A pot that has just become ready rings; one that has just burnt says so.
  // Each is told once, however many times the clock looks at it.
  const told = useRef(new Set<string>());
  useEffect(() => {
    kitchen.burners.forEach((burner, dish) => {
      if (!burner) return;
      const { state } = burnerState(kitchen, dish, now);
      const key = `${dish}-${burner.at}-${state}`;
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

  // The customer's patience ran out: they go, softly, and the bell is there again.
  useEffect(() => {
    if (!gone || level === null) return;
    playNudge();
    playVoice(stepsFor(upsetLine()));
    record(false);
    const id = window.setTimeout(() => {
      fresh(level, place, round);
      setArrival(null);
      setAttempt((a) => a + 1);
    }, UPSET_MS);
    return () => window.clearTimeout(id);
  }, [gone, level, place, round, fresh, playNudge, playVoice, record, setArrival]);

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
      if (isFinished(before) || shortOfStock(before) || isGone()) return;
      const result = addIngredient(before, id);

      if (result.outcome === 'wrong') {
        // Not what the recipe asks for now: a soft nudge, what is wanted by name, and a glow.
        playNudge();
        record(false);
        const wanted = wantedIngredient(before);
        const toStir = waitingToStir(before);
        const toCook = waitingToCook(before);
        if (wanted) {
          setFlash({ kind: 'ingredient', id: wanted });
          playVoice(stepsFor(findLine(wanted)));
        } else if (toStir !== null) {
          setFlash({ kind: 'spoon', dish: toStir });
          playVoice(stepsFor(stirLine()));
        } else if (toCook.length > 0) {
          setFlash({ kind: 'burner', dish: toCook[0] });
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
      // Its name, and - when the next thing to do is stir or cook - where to go next.
      const next = stepOf(result.kitchen, result.dish);
      const then = next?.kind === 'cook' ? cookNowLine() : next?.kind === 'stir' ? stirLine() : [];
      playVoice(stepsFor([ingredientPart(id), ...then]));
    },
    [finishedLine, isGone, playNudge, playPop, playVoice, record, setFlash, setKitchen],
  );

  const tapBurner = useCallback(
    (dish: number) => {
      const before = kitchenRef.current;
      if (isGone()) return;
      const at = Date.now();
      const { state } = burnerState(before, dish, at);

      if (state === 'empty') {
        // A dish that is waiting to cook goes on; with nothing waiting it is just a pot.
        // Food of a child who is being guided cannot burn.
        const started = startCooking(before, dish, at, !guided);
        if (!started) {
          playTap();
          return;
        }
        setKitchen(started);
        setNow(at);
        playPop();
        playVoice(stepsFor(waitLine()));
        return;
      }

      const result = takeOff(before, dish, at);
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
      // A burnt dish was already counted (and told) when it burnt; taking it off just clears the pot.
    },
    [finishedLine, guided, isGone, playNudge, playPop, playTap, playVoice, record, setKitchen],
  );

  const tapSpoon = useCallback(
    (dish: number) => {
      const before = kitchenRef.current;
      if (isGone()) return;
      const result = stirDish(before, dish);
      if (result.outcome === 'wrong') {
        // Nothing to stir yet: just the spoon's sound.
        playTap();
        return;
      }

      setKitchen(result.kitchen);
      playPop();
      if (result.stepDone) record(true);
      if (result.finished) {
        finishedLine(result.kitchen, result.dish);
        return;
      }
      // Each stir is counted aloud - "satu, dua, tiga" - so the child hears the repeat.
      const next = stepOf(result.kitchen, dish);
      const then = result.stepDone && next?.kind === 'cook' ? cookNowLine() : [];
      playVoice(stepsFor([numberPart(result.count, 'latin'), ...then]));
    },
    [finishedLine, isGone, playPop, playTap, playVoice, record, setKitchen],
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
    setArrival(null);
    fresh(level, nextPlace, round + 1);
  }, [fresh, level, place, playTap, round, setArrival]);

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
  /* The bell                                                          */
  /* ---------------------------------------------------------------- */

  if (arrival === null) {
    return (
      <ScreenFrame title="Memasak" onHome={onHome} onRepeat={repeat} caption="Ketuk bel untuk memanggil pelanggan">
        <ServiceBell hinted={guided} onClick={() => once('bell', ring)} />
      </ScreenFrame>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Cooking                                                           */
  /* ---------------------------------------------------------------- */

  const live = !done && !shopping && !gone;
  const pointer = live ? (flash ?? (guided ? nextPointer(kitchen, now) : null)) : null;
  const dishNames = kitchen.order.map((r) => r.name).join(' dan ');
  const customer = customerFor(round);
  const wish = kitchen.order[0].wish;

  return (
    <ScreenFrame
      title="Memasak"
      onHome={onHome}
      onRepeat={repeat}
      caption={done ? 'Masakannya sudah jadi!' : gone ? 'Pelanggannya pergi' : 'Ikuti resepnya'}
    >
      {done && <Celebration key={`${round}-${attempt}`} headline="Hebat!" subline={`${dishNames} jadi!`} />}

      <div className="flex w-full max-w-xl flex-col gap-4">
        <CustomerBar
          key={`${round}-${attempt}`}
          customer={customer}
          left={gone ? 0 : left}
          mood={gone ? 'upset' : moodOf(left)}
          served={done}
          wish={wish}
        />

        {shopping && (
          <p
            role="alert"
            className="animate-pop-in rounded-2xl bg-amber-100 px-4 py-3 text-center text-xl font-black text-amber-800 ring-2 ring-amber-300"
          >
            Habis! Ayo belanja lagi!
          </p>
        )}

        {gone && (
          <p
            role="alert"
            className="animate-pop-in rounded-2xl bg-rose-100 px-4 py-3 text-center text-xl font-black text-rose-700 ring-2 ring-rose-300"
          >
            Yah, pelanggannya kecewa. Coba lagi!
          </p>
        )}

        {/* What to cook. Each dish has its pot (and spoon) in line with its recipe. */}
        <ul aria-label="Pesanan" className="flex flex-col gap-3">
          {kitchen.order.map((recipe, dish) => {
            const { state, progress } = burnerState(kitchen, dish, now);
            const step = stepOf(kitchen, dish);
            const seconds = state !== 'empty' && step?.kind === 'cook' ? step.seconds : 0;
            const stirStep = recipe.steps.find((s) => s.kind === 'stir');
            const stirring = step?.kind === 'stir';

            return (
              <OrderCard
                key={recipe.id}
                recipe={recipe}
                progress={kitchen.progress[dish]}
                stirred={kitchen.stirred[dish]}
                showNext={guided && live}
                actions={
                  <>
                    {cooks(recipe) && (
                      <BurnerButton
                        number={dish + 1}
                        state={state}
                        progress={progress}
                        secondsLeft={Math.max(0, Math.ceil(seconds * (1 - progress)))}
                        dish={recipe}
                        hinted={same(pointer, { kind: 'burner', dish })}
                        onClick={() => once(`burner-${dish}`, () => tapBurner(dish))}
                      />
                    )}
                    {stirs(recipe) && stirStep?.kind === 'stir' && (
                      <SpoonButton
                        number={dish + 1}
                        stirred={kitchen.stirred[dish]}
                        times={stirStep.times}
                        waiting={stirring}
                        hinted={same(pointer, { kind: 'spoon', dish })}
                        onClick={() => once(`spoon-${dish}`, () => tapSpoon(dish))}
                      />
                    )}
                  </>
                }
              />
            );
          })}
        </ul>

        {/* The pantry. */}
        {!done && !gone && (
          <section aria-label="Bahan" className="flex flex-col items-center gap-3">
            <p className="text-sm font-bold text-slate-600">Ketuk bahan, sesuai resep</p>
            <div className="grid w-full grid-cols-3 gap-3">
              {shelfOrder(kitchen.stock).map((id) => (
                <IngredientButton
                  key={id}
                  id={id}
                  left={kitchen.stock[id]}
                  hinted={same(pointer, { kind: 'ingredient', id })}
                  onClick={() => once(`ingredient-${id}`, () => tapIngredient(id))}
                />
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center justify-center gap-4">
          {(kitchen.progress.some((p) => p > 0) || kitchen.burners.some((b) => b !== null)) && live && (
            <IconButton label="Mulai lagi" icon={RotateCcw} onClick={() => once('reset', handleReset)} />
          )}
          {done && <NextButton label="Resep berikutnya" onClick={() => once('next', handleNext)} />}
        </div>
      </div>
    </ScreenFrame>
  );
}

