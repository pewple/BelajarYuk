import { Bone, Carrot, Cat, Dog, Fish, Leaf, Nut, Rabbit, Squirrel, Turtle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ALPHABET, MAX_COUNT } from './curriculum';

/**
 * Labirin - a maze whose way through is a sequence.
 *
 * The route from start to finish is lined with consecutive letters (A B C ...)
 * or numbers (1 2 3 ...). Side branches lead nowhere and carry labels that are
 * *not* in the sequence, so at every fork the child has to know what comes
 * next - that, not the wall-following, is the point of the game.
 *
 * Mazes are built route-first rather than carved and then solved: the winding
 * route is laid down, a few dead ends are hung off it, and everything else is
 * solid. That makes the route length exact, keeps the maze a tree (so there is
 * exactly one way through, never a loop), and keeps the board sparse enough
 * that every tile can be a big tap target on a phone.
 */

/** What a route is lined with. */
export type MazeKind = 'letters' | 'numbers';

/**
 * What the child chose on the way in. "random" is not a third kind of maze:
 * it means each maze is, by chance, one of the other two.
 */
export type MazeMode = MazeKind | 'random';

/**
 * The kind of one maze, given the child's choice. A fixed choice is that kind
 * every time; "random" flips a coin per maze.
 *
 * `random` is injectable so a test can say which way the coin falls.
 */
export function kindFor(mode: MazeMode, random: () => number = Math.random): MazeKind {
  if (mode !== 'random') return mode;
  return random() < 0.5 ? 'letters' : 'numbers';
}

export type Position = { row: number; col: number };

export type Character = {
  /** Spoken and shown, e.g. "Kelinci". */
  name: string;
  icon: LucideIcon;
  /** Text colour for the icon on its tile. */
  color: string;
};

/**
 * The shape of one maze. It deliberately says nothing about letters or
 * numbers - that is chosen by the child and applied in `buildMaze` - so every
 * level works for either. Which means every level must be valid for both: see
 * `from` and `length`.
 */
export type MazeLevel = {
  cols: number;
  rows: number;
  /** How many tiles the route has, start and finish included. */
  length: number;
  /**
   * The first label on the route. For numbers, the number itself. For
   * letters, the 1-based place in the alphabet, so 1 is A and 3 is C.
   *
   * The same value serves both, so `from + length - 1` must stay within the
   * numbers the app can say (MAX_COUNT) - the tighter of the two limits.
   */
  from: number;
  /** Dead-end tiles hung off the route. */
  decoys: number;
  /** The route must change direction at least this often, or it is just a line. */
  minTurns: number;
  /** Same seed, same maze. Every level is fixed so a child can replay it. */
  seed: number;
  hero: Character;
  treat: Character;
};

export type MazeCell =
  | { type: 'wall' }
  | { type: 'path'; /** 0 at the start. */ index: number; label: string }
  | { type: 'decoy'; label: string };

export type Maze = {
  cols: number;
  rows: number;
  /** Row-major. Use `cellAt`. */
  cells: MazeCell[];
  /** The route, start first. */
  route: Position[];
};

/** Decoy labels for numbers are drawn from 1 to this, minus the route's own. */
const MAX_DECOY_NUMBER = 20;

/* ------------------------------------------------------------------ */
/* The levels                                                          */
/* ------------------------------------------------------------------ */

const FRIENDS: { hero: Character; treat: Character }[] = [
  {
    hero: { name: 'Kelinci', icon: Rabbit, color: 'text-orange-600' },
    treat: { name: 'Wortel', icon: Carrot, color: 'text-orange-500' },
  },
  {
    hero: { name: 'Kucing', icon: Cat, color: 'text-violet-600' },
    treat: { name: 'Ikan', icon: Fish, color: 'text-sky-500' },
  },
  {
    hero: { name: 'Anjing', icon: Dog, color: 'text-amber-700' },
    treat: { name: 'Tulang', icon: Bone, color: 'text-stone-500' },
  },
  {
    hero: { name: 'Tupai', icon: Squirrel, color: 'text-rose-600' },
    treat: { name: 'Kacang', icon: Nut, color: 'text-amber-600' },
  },
  {
    hero: { name: 'Kura-kura', icon: Turtle, color: 'text-emerald-600' },
    treat: { name: 'Daun', icon: Leaf, color: 'text-green-600' },
  },
];

/**
 * Easiest first. Routes grow from four tiles to ten, the boards from 3x3 to
 * 5x5, and later levels start partway through the sequence ("3 to 10",
 * "C to J") so it is not always 1 or A.
 *
 * Every level serves letters and numbers alike, so each must be valid for
 * both. Numbers are the tighter limit - they never go past MAX_COUNT, the
 * numbers the app can already say and the child has met in Berhitung - so a
 * level that fits as numbers always fits as letters too.
 */
export const MAZE_LEVELS: MazeLevel[] = [
  { cols: 3, rows: 3, length: 4, from: 1, decoys: 1, minTurns: 1, seed: 11, ...FRIENDS[0] },
  { cols: 3, rows: 3, length: 5, from: 1, decoys: 1, minTurns: 2, seed: 12, ...FRIENDS[1] },
  { cols: 4, rows: 4, length: 6, from: 1, decoys: 2, minTurns: 2, seed: 13, ...FRIENDS[2] },
  { cols: 4, rows: 4, length: 6, from: 1, decoys: 2, minTurns: 3, seed: 14, ...FRIENDS[3] },
  { cols: 4, rows: 4, length: 8, from: 3, decoys: 3, minTurns: 3, seed: 15, ...FRIENDS[4] },
  { cols: 4, rows: 4, length: 8, from: 3, decoys: 3, minTurns: 4, seed: 16, ...FRIENDS[0] },
  { cols: 5, rows: 5, length: 9, from: 2, decoys: 4, minTurns: 4, seed: 17, ...FRIENDS[1] },
  { cols: 5, rows: 5, length: 10, from: 1, decoys: 4, minTurns: 5, seed: 18, ...FRIENDS[2] },
];

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

/** "A" for letters 1, "7" for numbers 7. */
export function labelFor(kind: MazeKind, value: number): string {
  return kind === 'letters' ? ALPHABET[value - 1] : String(value);
}

/** The route's first and last labels, e.g. ["A", "H"] or ["1", "8"]. */
export function routeEnds(level: MazeLevel, kind: MazeKind): [string, string] {
  return [labelFor(kind, level.from), labelFor(kind, level.from + level.length - 1)];
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const DIRECTIONS: Position[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

const samePosition = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

const key = (p: Position) => `${p.row},${p.col}`;

function inBounds(cols: number, rows: number, p: Position): boolean {
  return p.row >= 0 && p.row < rows && p.col >= 0 && p.col < cols;
}

function neighbours(cols: number, rows: number, p: Position): Position[] {
  return DIRECTIONS.map((d) => ({ row: p.row + d.row, col: p.col + d.col })).filter((n) =>
    inBounds(cols, rows, n),
  );
}

export function areNeighbours(a: Position, b: Position): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function cellAt(maze: Maze, p: Position): MazeCell {
  return maze.cells[p.row * maze.cols + p.col];
}

/* ------------------------------------------------------------------ */
/* Seeded randomness                                                   */
/* ------------------------------------------------------------------ */

/** Small, fast, good enough for shuffling a handful of tiles. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ------------------------------------------------------------------ */
/* Building a maze                                                     */
/* ------------------------------------------------------------------ */

function turnsIn(route: Position[]): number {
  let turns = 0;
  for (let i = 2; i < route.length; i += 1) {
    const before = { row: route[i - 1].row - route[i - 2].row, col: route[i - 1].col - route[i - 2].col };
    const after = { row: route[i].row - route[i - 1].row, col: route[i].col - route[i - 1].col };
    if (before.row !== after.row || before.col !== after.col) turns += 1;
  }
  return turns;
}

/**
 * A winding route of exactly `length` tiles, found by depth-first search.
 *
 * Every tile may touch only its own predecessor and successor - never an
 * earlier tile of the route. Without that rule two stretches of the route
 * could run side by side, and the child would see a later label next to the
 * tile they are standing on and could not tell it was not the way.
 */
function findRoute(level: MazeLevel, rng: () => number): Position[] {
  const { cols, rows, length, minTurns } = level;
  const taken = new Set<string>();
  const route: Position[] = [];

  const extend = (): boolean => {
    if (route.length === length) return turnsIn(route) >= minTurns;

    const head = route[route.length - 1];
    for (const next of shuffled(neighbours(cols, rows, head), rng)) {
      if (taken.has(key(next))) continue;
      const touchesEarlier = neighbours(cols, rows, next).some(
        (n) => taken.has(key(n)) && !samePosition(n, head),
      );
      if (touchesEarlier) continue;

      route.push(next);
      taken.add(key(next));
      if (extend()) return true;
      route.pop();
      taken.delete(key(next));
    }
    return false;
  };

  const all: Position[] = [];
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) all.push({ row, col });

  for (const start of shuffled(all, rng)) {
    route.push(start);
    taken.add(key(start));
    if (extend()) return route;
    route.pop();
    taken.delete(key(start));
  }

  throw new Error(
    `No ${length}-tile route with ${minTurns} turns fits a ${cols}x${rows} board (seed ${level.seed}).`,
  );
}

/** Which labels a maze may use for dead ends: anything that is not on the route. */
function decoyLabels(level: MazeLevel, kind: MazeKind): string[] {
  const onRoute = new Set(
    Array.from({ length: level.length }, (_, i) => labelFor(kind, level.from + i)),
  );
  const pool =
    kind === 'letters'
      ? ALPHABET
      : Array.from({ length: MAX_DECOY_NUMBER }, (_, i) => String(i + 1));
  return pool.filter((label) => !onRoute.has(label));
}

/**
 * The maze for a level, lined with letters or numbers.
 *
 * The layout - where the route runs and where the dead ends hang - depends
 * only on the level, never on `kind`: the same level is the same shape as
 * letters or as numbers. Only the labels differ.
 */
export function buildMaze(level: MazeLevel, kind: MazeKind): Maze {
  const { cols, rows, length, from } = level;

  const last = from + length - 1;
  if (kind === 'numbers' && last > MAX_COUNT) {
    throw new Error(`Number routes stop at ${MAX_COUNT}, but this one reaches ${last}.`);
  }
  if (kind === 'letters' && (from < 1 || last > ALPHABET.length)) {
    throw new Error(`Letter route ${from}-${last} falls outside the alphabet.`);
  }

  // One stream of randomness runs through every attempt, so the layout is
  // still fixed by the seed: attempt two simply continues where one stopped.
  // It decides layout only. Labels are drawn from a stream of their own below,
  // because how many labels a kind has to choose from would otherwise change
  // how much of this stream a failed attempt used up - and with it, the layout.
  const rng = mulberry32(level.seed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const route = findRoute(level, rng);
    const cells = layRoute(level, kind, route);

    // A route that leaves too little room for the dead ends the level asks
    // for is thrown away and another is laid. Quietly placing fewer would make
    // the level easier than designed, and nobody would ever notice.
    const decoys = addDecoys(level, cells, route, rng);
    if (decoys.length !== level.decoys) continue;

    const labels = shuffled(decoyLabels(level, kind), mulberry32(level.seed + LABEL_STREAM));
    decoys.forEach((p, i) => {
      cells[p.row * cols + p.col] = { type: 'decoy', label: labels[i] };
    });
    return { cols, rows, cells, route };
  }

  throw new Error(
    `Could not fit ${level.decoys} dead ends beside a ${length}-tile route on a ${cols}x${rows} board (seed ${level.seed}).`,
  );
}

/** Enough to find a roomy route for any sensible level; never reached by the real ones. */
const MAX_ATTEMPTS = 200;

/** Offsets a level's seed to give the labels their own stream of randomness. */
const LABEL_STREAM = 7919;

/** A board of solid tiles with the route cut through it. */
function layRoute(level: MazeLevel, kind: MazeKind, route: Position[]): MazeCell[] {
  const { cols, rows, from } = level;
  const cells: MazeCell[] = Array.from({ length: cols * rows }, () => ({ type: 'wall' }));

  route.forEach((p, i) => {
    cells[p.row * cols + p.col] = { type: 'path', index: i, label: labelFor(kind, from + i) };
  });
  return cells;
}

/**
 * Hangs dead ends off the route and returns where they went - possibly fewer
 * than the level asks for, if the route left no room. They are placeholders
 * until the caller labels them.
 *
 * A tile qualifies only if exactly one occupied tile touches it. That keeps
 * the whole board a tree: one way through, no loops, and no dead end that
 * doubles as a second entrance to the route.
 */
function addDecoys(level: MazeLevel, cells: MazeCell[], route: Position[], rng: () => number): Position[] {
  const { cols, rows } = level;
  const index = (p: Position) => p.row * cols + p.col;
  const occupied = (p: Position) => cells[index(p)].type !== 'wall';
  const finish = route[route.length - 1];

  const placed: Position[] = [];

  for (let n = 0; n < level.decoys; n += 1) {
    const candidates: Position[] = [];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const p = { row, col };
        if (occupied(p)) continue;

        const parents = neighbours(cols, rows, p).filter(occupied);
        if (parents.length !== 1) continue;
        // Nothing hangs off the finish: the journey ends there.
        if (samePosition(parents[0], finish)) continue;
        candidates.push(p);
      }
    }

    if (candidates.length === 0) break;
    const chosen = candidates[Math.floor(rng() * candidates.length)];
    placed.push(chosen);
    cells[index(chosen)] = { type: 'decoy', label: '' };
  }

  return placed;
}

/* ------------------------------------------------------------------ */
/* Moving                                                              */
/* ------------------------------------------------------------------ */

/**
 * What a tap on `target` means when the child is standing at `at` (an index
 * into the route).
 *
 *  - advance: the next tile in the sequence. Move there.
 *  - wrong:   a dead end right beside them. A gentle "not that one" and a hint.
 *  - ignore:  anything else - a wall, a far tile, the tile behind them, the
 *             tile they are on. Nothing happens; there is nothing to correct.
 */
export type StepResult = 'advance' | 'wrong' | 'ignore';

export function stepResult(maze: Maze, at: number, target: Position): StepResult {
  if (!inBounds(maze.cols, maze.rows, target)) return 'ignore';
  if (!areNeighbours(maze.route[at], target)) return 'ignore';

  const cell = cellAt(maze, target);
  if (cell.type === 'wall') return 'ignore';
  if (cell.type === 'decoy') return 'wrong';
  return cell.index === at + 1 ? 'advance' : 'ignore';
}
