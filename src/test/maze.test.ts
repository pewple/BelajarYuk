import { describe, expect, it } from 'vitest';
import { ALPHABET, MAX_COUNT } from '../data/curriculum';
import {
  MAZE_LEVELS,
  areNeighbours,
  buildMaze,
  cellAt,
  kindFor,
  labelFor,
  routeEnds,
  stepResult,
} from '../data/maze';
import type { Maze, MazeKind, MazeLevel, Position } from '../data/maze';

const KINDS: MazeKind[] = ['letters', 'numbers'];

const everyPosition = (maze: Maze): Position[] =>
  maze.cells.map((_, i) => ({ row: Math.floor(i / maze.cols), col: i % maze.cols }));

const occupied = (maze: Maze, p: Position) => cellAt(maze, p).type !== 'wall';

/** The orthogonal neighbours of `p` that are on the board. */
const around = (maze: Maze, p: Position): Position[] =>
  everyPosition(maze).filter((q) => areNeighbours(p, q));

describe('labels', () => {
  it('spells letters from the alphabet and numbers as digits', () => {
    expect(labelFor('letters', 1)).toBe('A');
    expect(labelFor('letters', 3)).toBe('C');
    expect(labelFor('letters', 26)).toBe('Z');
    expect(labelFor('numbers', 7)).toBe('7');
  });

  it('reports where a route starts and ends, in either kind', () => {
    const level = { from: 3, length: 8 } as MazeLevel;
    expect(routeEnds(level, 'numbers')).toEqual(['3', '10']);
    expect(routeEnds(level, 'letters')).toEqual(['C', 'J']);
  });
});

describe('the choice of what a maze is lined with', () => {
  it('is simply what was picked, for Huruf and Angka - every time', () => {
    for (const roll of [0, 0.25, 0.49, 0.5, 0.99]) {
      expect(kindFor('letters', () => roll)).toBe('letters');
      expect(kindFor('numbers', () => roll)).toBe('numbers');
    }
  });

  it('leaves it to chance for Acak, one way for a low roll and the other for a high one', () => {
    expect(kindFor('random', () => 0)).toBe('letters');
    expect(kindFor('random', () => 0.49)).toBe('letters');
    expect(kindFor('random', () => 0.5)).toBe('numbers');
    expect(kindFor('random', () => 0.99)).toBe('numbers');
  });

  it('really does vary for Acak, and never returns anything but the two kinds', () => {
    const seen = new Set(Array.from({ length: 200 }, () => kindFor('random')));
    expect(seen).toEqual(new Set(['letters', 'numbers']));
  });
});

describe.each(
  MAZE_LEVELS.flatMap((level, i) => KINDS.map((kind) => [i + 1, kind, level] as const)),
)('level %i as %s', (_n, kind, level) => {
  const maze = buildMaze(level, kind);
  const { route } = maze;
  const decoys = maze.cells.filter((c) => c.type === 'decoy');

  describe('the route', () => {
    it('is exactly as long as the level says, and stays on the board', () => {
      expect(route).toHaveLength(level.length);
      for (const p of route) {
        expect(p.row).toBeGreaterThanOrEqual(0);
        expect(p.row).toBeLessThan(level.rows);
        expect(p.col).toBeGreaterThanOrEqual(0);
        expect(p.col).toBeLessThan(level.cols);
      }
    });

    it('is one unbroken walk, never visiting a tile twice', () => {
      for (let i = 1; i < route.length; i += 1) expect(areNeighbours(route[i - 1], route[i])).toBe(true);
      expect(new Set(route.map((p) => `${p.row},${p.col}`)).size).toBe(route.length);
    });

    it('never runs alongside itself, so a later label never sits next to an earlier tile', () => {
      for (let i = 0; i < route.length; i += 1) {
        for (let j = i + 2; j < route.length; j += 1) {
          expect(areNeighbours(route[i], route[j]), `tiles ${i} and ${j} touch`).toBe(false);
        }
      }
    });

    it('is lined with consecutive labels, in order', () => {
      route.forEach((p, i) => {
        const cell = cellAt(maze, p);
        expect(cell).toEqual({ type: 'path', index: i, label: labelFor(kind, level.from + i) });
      });
    });

    it('winds: it turns at least as often as the level asks', () => {
      let turns = 0;
      for (let i = 2; i < route.length; i += 1) {
        const before = [route[i - 1].row - route[i - 2].row, route[i - 1].col - route[i - 2].col];
        const after = [route[i].row - route[i - 1].row, route[i].col - route[i - 1].col];
        if (before[0] !== after[0] || before[1] !== after[1]) turns += 1;
      }
      expect(turns).toBeGreaterThanOrEqual(level.minTurns);
    });

    it('keeps its labels within what the app can already say', () => {
      const last = level.from + level.length - 1;
      expect(level.from).toBeGreaterThanOrEqual(1);
      if (kind === 'numbers') expect(last).toBeLessThanOrEqual(MAX_COUNT);
      else expect(last).toBeLessThanOrEqual(ALPHABET.length);
    });
  });

  describe('the dead ends', () => {
    it('number exactly what the level asks for', () => {
      expect(decoys).toHaveLength(level.decoys);
    });

    it('carry labels of the right kind that are not on the route, each used once', () => {
      const onRoute = new Set(route.map((p) => (cellAt(maze, p) as { label: string }).label));
      const labels = decoys.map((d) => (d as { label: string }).label);

      expect(labels.every((label) => label !== '' && !onRoute.has(label))).toBe(true);
      expect(new Set(labels).size).toBe(labels.length);
      // A letter maze has only letters on it; a number maze, only numbers.
      for (const label of labels) {
        if (kind === 'letters') expect(ALPHABET).toContain(label);
        else expect(label).toMatch(/^\d+$/);
      }
    });

    it('never hang off the finish - the journey ends there', () => {
      const finish = route[route.length - 1];
      for (const p of around(maze, finish)) expect(cellAt(maze, p).type).not.toBe('decoy');
    });
  });

  describe('the board', () => {
    it('is a tree: one way through, no loops, no dead end that is a second entrance', () => {
      const tiles = everyPosition(maze).filter((p) => occupied(maze, p));
      let edges = 0;
      for (const a of tiles) for (const b of tiles) if (areNeighbours(a, b)) edges += 1;
      edges /= 2; // each pair was counted from both ends

      expect(tiles).toHaveLength(level.length + level.decoys);
      expect(edges).toBe(tiles.length - 1);
    });

    it('uses every label at most once, so no two tiles look the same', () => {
      const labels = maze.cells.flatMap((c) => (c.type === 'wall' ? [] : [c.label]));
      expect(new Set(labels).size).toBe(labels.length);
    });

    it('is the same maze every time it is built', () => {
      expect(buildMaze(level, kind)).toEqual(maze);
    });
  });

  describe('playing it', () => {
    it('has exactly one way forward from every tile on the route', () => {
      for (let at = 0; at < route.length - 1; at += 1) {
        const advances = everyPosition(maze).filter((p) => stepResult(maze, at, p) === 'advance');
        expect(advances, `at tile ${at}`).toEqual([route[at + 1]]);
      }
    });

    it('can be solved by always following the sequence', () => {
      let at = 0;
      while (at < route.length - 1) {
        const next = everyPosition(maze).find((p) => stepResult(maze, at, p) === 'advance');
        expect(next).toBeDefined();
        at += 1;
        expect(next).toEqual(route[at]);
      }
      expect(at).toBe(route.length - 1);
    });

    it('lets nothing but the next tile move the child', () => {
      // Whatever is tapped, only the one correct tile advances.
      for (let at = 0; at < route.length - 1; at += 1) {
        const outcomes = everyPosition(maze).map((p) => stepResult(maze, at, p));
        expect(outcomes.filter((o) => o === 'advance')).toHaveLength(1);
      }
    });
  });
});

describe('a level is the same shape whatever it is lined with', () => {
  it.each(MAZE_LEVELS.map((level, i) => [i + 1, level] as const))(
    'level %i: letters and numbers share one route and one set of dead ends',
    (_n, level) => {
      const asLetters = buildMaze(level, 'letters');
      const asNumbers = buildMaze(level, 'numbers');

      expect(asLetters.route).toEqual(asNumbers.route);

      // Same tiles are walls, route and dead ends - only the labels differ.
      const shape = (maze: Maze) => maze.cells.map((c) => c.type);
      expect(shape(asLetters)).toEqual(shape(asNumbers));
    },
  );

  it('so choosing Huruf or Angka changes what is written, not where the way goes', () => {
    // The point of building the layout from the level alone: switching the
    // choice must never change how hard the maze is.
    for (const level of MAZE_LEVELS) {
      const letters = buildMaze(level, 'letters');
      const numbers = buildMaze(level, 'numbers');
      const labels = (maze: Maze) => maze.cells.flatMap((c) => (c.type === 'wall' ? [] : [c.label]));

      expect(labels(letters)).not.toEqual(labels(numbers));
    }
  });
});

describe('stepResult', () => {
  // Level 2 as letters: A..E on a 3x3, with a dead end hanging off the start.
  const level = MAZE_LEVELS[1];
  const maze = buildMaze(level, 'letters');
  const { route } = maze;

  /** A dead end beside route tile `k`, if any. */
  const decoyBeside = () => {
    for (let k = 0; k < route.length; k += 1) {
      const decoy = around(maze, route[k]).find((p) => cellAt(maze, p).type === 'decoy');
      if (decoy) return { k, decoy };
    }
    throw new Error('this level has no dead end beside the route');
  };

  it('advances to the next tile in the sequence', () => {
    expect(stepResult(maze, 0, route[1])).toBe('advance');
    expect(stepResult(maze, 2, route[3])).toBe('advance');
  });

  it('nudges, rather than moves, on a dead end beside the child', () => {
    const { k, decoy } = decoyBeside();
    expect(stepResult(maze, k, decoy)).toBe('wrong');
  });

  it('ignores a dead end that is not beside the child', () => {
    const { k, decoy } = decoyBeside();
    const farAway = route.findIndex((_, i) => !areNeighbours(route[i], decoy) && i !== k);
    expect(stepResult(maze, farAway, decoy)).toBe('ignore');
  });

  it('ignores the tile the child is already on, and the one behind them', () => {
    expect(stepResult(maze, 2, route[2])).toBe('ignore');
    expect(stepResult(maze, 2, route[1])).toBe('ignore');
  });

  it('ignores a route tile that is not next, even a later one', () => {
    expect(stepResult(maze, 0, route[2])).toBe('ignore');
    expect(stepResult(maze, 0, route[route.length - 1])).toBe('ignore');
  });

  it('ignores walls beside the child', () => {
    const wall = everyPosition(maze).find((p) => cellAt(maze, p).type === 'wall' && areNeighbours(p, route[0]));
    // Not every start has a wall beside it; when it does, tapping it does nothing.
    if (wall) expect(stepResult(maze, 0, wall)).toBe('ignore');
  });

  it('ignores anything off the board', () => {
    expect(stepResult(maze, 0, { row: -1, col: 0 })).toBe('ignore');
    expect(stepResult(maze, 0, { row: 0, col: -1 })).toBe('ignore');
    expect(stepResult(maze, 0, { row: 99, col: 99 })).toBe('ignore');
  });

  it('ignores the child standing on the finish asking to go on', () => {
    const last = route.length - 1;
    for (const p of everyPosition(maze)) expect(stepResult(maze, last, p)).not.toBe('advance');
  });
});

describe('the levels together', () => {
  it('start gently and never get shorter', () => {
    expect(MAZE_LEVELS[0].length).toBeLessThanOrEqual(5);
    expect(MAZE_LEVELS[0].cols).toBe(3);

    const lengths = MAZE_LEVELS.map((l) => l.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
  });

  it('do not always begin at 1 or A', () => {
    expect(MAZE_LEVELS.some((l) => l.from > 1)).toBe(true);
  });

  it('are all valid as numbers, the tighter limit - so they are valid as letters too', () => {
    for (const level of MAZE_LEVELS) {
      expect(level.from + level.length - 1).toBeLessThanOrEqual(MAX_COUNT);
    }
  });

  it('refuse a route that would run past what the app can say', () => {
    const base = MAZE_LEVELS[0];
    expect(() => buildMaze({ ...base, from: 8, length: 5 }, 'numbers')).toThrow(/stop at/);
    expect(() => buildMaze({ ...base, from: 24, length: 5 }, 'letters')).toThrow(/alphabet/);
  });

  it('say plainly when a board cannot hold the route asked for', () => {
    const base = MAZE_LEVELS[0];
    expect(() => buildMaze({ ...base, cols: 2, rows: 2, length: 9 }, 'letters')).toThrow(/fits a 2x2 board/);
  });
});
