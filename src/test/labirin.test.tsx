import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { MAZE_LEVELS, areNeighbours, buildMaze, cellAt, routeEnds, stepResult } from '../data/maze';
import type { Maze, MazeKind, Position } from '../data/maze';
import { ALPHABET } from '../data/curriculum';
import {
  LETTER_NAMES_EN,
  LETTER_NAMES_ID,
  NUMBER_WORDS_ID,
  PRAISE_ID,
} from '../hooks/useAudio';
import {
  installVoice,
  playedClips,
  playedToneCounts,
  setMediaManifest,
  spokenTexts,
  spokenUtterances,
} from './setup';

type User = ReturnType<typeof userEvent.setup>;
type Choice = 'Huruf' | 'Angka' | 'Acak';

const nounOf = (kind: MazeKind) => (kind === 'letters' ? 'Huruf' : 'Angka');

/** How a tile is named for assistive tech: "Angka 3", "Huruf B, ada kelinci". */
const tile = (kind: MazeKind, label: string) =>
  screen.getByRole('button', { name: new RegExp(`^${nounOf(kind)} ${label}(,|$)`) });

const labelAt = (maze: Maze, p: Position) => (cellAt(maze, p) as { label: string }).label;

/** The word an Indonesian voice says for a label. */
const spokenLabel = (kind: MazeKind, label: string) =>
  kind === 'numbers' ? NUMBER_WORDS_ID[Number(label)] : LETTER_NAMES_ID[label];

async function openLabirin(user: User) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Labirin/ }));
}

const choose = (user: User, choice: Choice) => user.click(screen.getByRole('button', { name: choice }));

/** Picks Huruf or Angka and returns the first maze, not yet started. */
async function enter(user: User, choice: 'Huruf' | 'Angka') {
  await openLabirin(user);
  await choose(user, choice);

  const kind: MazeKind = choice === 'Huruf' ? 'letters' : 'numbers';
  const level = MAZE_LEVELS[0];
  return { kind, level, maze: buildMaze(level, kind) };
}

/** Taps the first tile - the one that begins the maze. */
const start = (user: User, kind: MazeKind, maze: Maze) => user.click(tile(kind, labelAt(maze, maze.route[0])));

/** Taps the route from tile `from` (exclusive) to tile `to` (inclusive). */
async function walk(user: User, kind: MazeKind, maze: Maze, from: number, to: number) {
  for (let i = from + 1; i <= to; i += 1) await user.click(tile(kind, labelAt(maze, maze.route[i])));
}

/** Plays level `n` (0-based) from its first tile to the end, then moves on - leaving the next one unstarted. */
async function finishLevel(user: User, kind: MazeKind, n: number) {
  const maze = buildMaze(MAZE_LEVELS[n], kind);
  await start(user, kind, maze);
  await walk(user, kind, maze, 0, maze.route.length - 1);
  await user.click(screen.getByRole('button', { name: 'Labirin berikutnya' }));
}

/** A dead end right beside route tile `k`. */
function deadEndBeside(maze: Maze) {
  for (let k = 0; k < maze.route.length - 1; k += 1) {
    for (let i = 0; i < maze.cells.length; i += 1) {
      const p = { row: Math.floor(i / maze.cols), col: i % maze.cols };
      if (maze.cells[i].type === 'decoy' && areNeighbours(maze.route[k], p)) return { k, p };
    }
  }
  throw new Error('no dead end beside the route');
}

const keyFor = (from: Position, to: Position) =>
  to.row < from.row ? '{ArrowUp}' : to.row > from.row ? '{ArrowDown}' : to.col < from.col ? '{ArrowLeft}' : '{ArrowRight}';

describe('Labirin', () => {
  // These tests are about what the maze says and does, so they run with an
  // Indonesian voice present and the words spoken as written.
  beforeEach(() => installVoice('Test Indonesian', 'id-ID'));

  describe('on the home screen', () => {
    it('sits after Berhitung and before Kasir', () => {
      render(<App />);

      const titles = ['Mengenal Huruf', 'Belajar Bicara', 'Berhitung', 'Labirin', 'Kasir'];
      const order = screen
        .getAllByRole('button')
        .map((button) => titles.find((title) => button.textContent?.includes(title)));

      expect(order).toEqual(titles);
    });

    it('opens, and goes home again', async () => {
      const user = userEvent.setup();
      await openLabirin(user);

      expect(screen.getByRole('heading', { name: 'Labirin' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Kembali ke menu utama' }));
      expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    });
  });

  describe('choosing what the maze is lined with', () => {
    it('comes first: three choices, and no maze yet', async () => {
      const user = userEvent.setup();
      await openLabirin(user);

      expect(screen.getByText('Pilih dulu, lalu mulai')).toBeInTheDocument();
      for (const name of ['Huruf', 'Angka', 'Acak']) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      }
      expect(screen.queryByRole('group', { name: 'Papan labirin' })).not.toBeInTheDocument();
    });

    it('is spoken, not just shown', async () => {
      const user = userEvent.setup();
      await openLabirin(user);

      expect(spokenTexts).toContain('Pilih huruf, angka, atau acak!');
    });

    it('Huruf lines the maze with letters', async () => {
      const user = userEvent.setup();
      const { kind, level } = await enter(user, 'Huruf');

      const [first, last] = routeEnds(level, kind);
      expect(first).toBe('A');
      expect(screen.getByText(`Ketuk ${first} untuk mulai`)).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Urutan' })).toHaveTextContent(`${first}BC${last}`);
      expect(spokenTexts).toContain(
        `Ikuti huruf dari ${LETTER_NAMES_ID[first]} sampai ${LETTER_NAMES_ID[last]}!`,
      );
    });

    it('Angka lines the maze with numbers', async () => {
      const user = userEvent.setup();
      const { kind, level } = await enter(user, 'Angka');

      const [first, last] = routeEnds(level, kind);
      expect(screen.getByText(`Ketuk ${first} untuk mulai`)).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Urutan' })).toHaveTextContent('1234');
      expect(spokenTexts).toContain('Ikuti angka dari satu sampai empat!');
      expect(last).toBe('4');
    });

    it('puts only that kind on every tile, dead ends included', async () => {
      const user = userEvent.setup();
      await enter(user, 'Huruf');

      const tiles = screen.getAllByRole('button', { name: /^(Huruf|Angka) / });
      expect(tiles.length).toBeGreaterThan(0);
      for (const t of tiles) expect(t.getAttribute('aria-label')).toMatch(/^Huruf /);
    });

    it('keeps a fixed choice for every maze that follows', async () => {
      const user = userEvent.setup();
      await enter(user, 'Huruf');
      await finishLevel(user, 'letters', 0);

      // Level 2, still letters.
      expect(screen.getByText(/^Ketuk [A-Z] untuk mulai$/)).toBeInTheDocument();
      for (const t of screen.getAllByRole('button', { name: /^(Huruf|Angka) / })) {
        expect(t.getAttribute('aria-label')).toMatch(/^Huruf /);
      }
    });

    it('is not remembered: going home and back asks again', async () => {
      const user = userEvent.setup();
      await enter(user, 'Angka');
      await user.click(screen.getByRole('button', { name: 'Kembali ke menu utama' }));
      await user.click(screen.getByRole('button', { name: /Labirin/ }));

      expect(screen.getByText('Pilih dulu, lalu mulai')).toBeInTheDocument();
    });

    describe('Acak', () => {
      afterEach(() => vi.restoreAllMocks());

      it('flips a coin for each maze: letters on a low roll, numbers on a high one', async () => {
        const user = userEvent.setup();
        await openLabirin(user);

        vi.spyOn(Math, 'random').mockReturnValueOnce(0.1);
        await choose(user, 'Acak');
        // Maze one came up letters...
        expect(screen.getByText(/^Ketuk A untuk mulai$/)).toBeInTheDocument();

        await start(user, 'letters', buildMaze(MAZE_LEVELS[0], 'letters'));
        await walk(user, 'letters', buildMaze(MAZE_LEVELS[0], 'letters'), 0, MAZE_LEVELS[0].length - 1);

        // ...and for maze two the coin lands the other way.
        vi.spyOn(Math, 'random').mockReturnValueOnce(0.9);
        await user.click(screen.getByRole('button', { name: 'Labirin berikutnya' }));

        expect(screen.getByText(/^Ketuk 1 untuk mulai$/)).toBeInTheDocument();
        expect(spokenTexts).toContain('Ikuti angka dari satu sampai lima!');
      });

      it('can come up the same twice running - it is a coin, not a rota', async () => {
        const user = userEvent.setup();
        await openLabirin(user);

        vi.spyOn(Math, 'random').mockReturnValueOnce(0.9);
        await choose(user, 'Acak');
        const maze = buildMaze(MAZE_LEVELS[0], 'numbers');
        await start(user, 'numbers', maze);
        await walk(user, 'numbers', maze, 0, maze.route.length - 1);

        vi.spyOn(Math, 'random').mockReturnValueOnce(0.9);
        await user.click(screen.getByRole('button', { name: 'Labirin berikutnya' }));

        // Level 2 as numbers again.
        for (const t of screen.getAllByRole('button', { name: /^(Huruf|Angka) / })) {
          expect(t.getAttribute('aria-label')).toMatch(/^Angka /);
        }
      });

      it('keeps the same kind while the same maze is replayed', async () => {
        const user = userEvent.setup();
        await openLabirin(user);
        vi.spyOn(Math, 'random').mockReturnValueOnce(0.1); // letters
        await choose(user, 'Acak');

        const maze = buildMaze(MAZE_LEVELS[0], 'letters');
        await start(user, 'letters', maze);
        await user.click(tile('letters', labelAt(maze, maze.route[1])));
        await user.click(screen.getByRole('button', { name: 'Ulangi labirin' }));

        // Redoing a maze must not re-roll what it is lined with.
        expect(screen.getByText('Ketuk A untuk mulai')).toBeInTheDocument();
      });
    });
  });

  describe('before the first tap', () => {
    it('invites a tap on the first label', async () => {
      const user = userEvent.setup();
      const { kind, level } = await enter(user, 'Angka');

      const [first] = routeEnds(level, kind);
      expect(screen.getByText(`Ketuk ${first} untuk mulai`)).toBeInTheDocument();
      expect(tile(kind, first)).toHaveAccessibleName('Angka 1, ketuk untuk mulai');
      expect(tile(kind, first)).toHaveAttribute('data-start', 'true');
    });

    it('shows the first label itself, big, with the animal small in the corner', async () => {
      const user = userEvent.setup();
      const { kind } = await enter(user, 'Angka');

      const first = tile(kind, '1');
      // The label is the content of the tile...
      expect(first).toHaveTextContent('1');
      // ...and the animal is a small badge, not the big centred picture.
      const animal = first.querySelector('svg')!;
      expect(animal).toHaveClass('size-1/4', 'absolute');
      expect(animal).not.toHaveClass('size-3/5');
    });

    it('does not centre or enlarge the animal anywhere on the board', async () => {
      const user = userEvent.setup();
      await enter(user, 'Angka');

      // Level 1's animal is the rabbit. (The carrot at the finish is a treat, not
      // the animal, and stays big - this is about the one waiting to be started.)
      const rabbits = document.querySelectorAll('.lucide-rabbit');
      expect(rabbits).toHaveLength(1);
      expect(rabbits[0]).toHaveClass('size-1/4');
      expect(rabbits[0]).not.toHaveClass('size-3/5');
    });

    it('does not mark the first step in the sequence strip as current yet', async () => {
      const user = userEvent.setup();
      await enter(user, 'Angka');

      const items = screen.getByRole('list', { name: 'Urutan' }).querySelectorAll('li');
      for (const item of items) expect(item.className).toContain('bg-slate-200');
    });

    it('does nothing for any other tile - the first one has to be tapped first', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');

      spokenTexts.length = 0;
      playedToneCounts.value = 0;
      await user.click(tile(kind, labelAt(maze, maze.route[1])));
      await user.click(tile(kind, labelAt(maze, maze.route[2])));

      expect(playedToneCounts.value).toBe(0);
      expect(spokenTexts).toEqual([]);
      expect(tile(kind, '1')).toHaveAccessibleName('Angka 1, ketuk untuk mulai');
    });

    it('does not even nudge on a dead end - nothing has started to be wrong about', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');

      // The dead end beside the very first tile, if the level has one.
      const beside = deadEndBeside(maze);
      if (beside.k !== 0) return;

      playedToneCounts.value = 0;
      await user.click(tile(kind, labelAt(maze, beside.p)));
      expect(playedToneCounts.value).toBe(0);
    });

    it('points at nothing', async () => {
      const user = userEvent.setup();
      await enter(user, 'Angka');

      expect(document.querySelector('[data-hint]')).toBeNull();
    });
  });

  describe('the first tap', () => {
    it('starts the maze: the animal steps out, big and centred, and says what the tile is', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');

      spokenTexts.length = 0;
      playedToneCounts.value = 0;
      await start(user, kind, maze);

      const first = tile(kind, '1');
      expect(first).toHaveAccessibleName('Angka 1, ada kelinci');
      expect(first.querySelector('svg')).toHaveClass('size-3/5');
      expect(first).not.toHaveAttribute('data-start');
      expect(spokenTexts).toContain('satu');
      expect(playedToneCounts.value).toBe(1); // one pop
    });

    it('changes the caption from "tap to start" to the instruction', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);

      expect(screen.getByText('Ikuti angka 1 sampai 4')).toBeInTheDocument();
      expect(screen.queryByText(/untuk mulai$/)).not.toBeInTheDocument();
    });

    it('lights the current step in the sequence strip', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);

      const items = screen.getByRole('list', { name: 'Urutan' }).querySelectorAll('li');
      expect(items[0].className).toContain('bg-amber-300');
    });

    it('does nothing on a second tap of the same tile', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);

      spokenTexts.length = 0;
      playedToneCounts.value = 0;
      await user.click(tile(kind, '1'));

      expect(playedToneCounts.value).toBe(0);
      expect(spokenTexts).toEqual([]);
    });

    it('is also what the first arrow key does - it starts the maze without moving', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');

      await user.keyboard('{ArrowDown}');

      expect(tile(kind, '1')).toHaveAccessibleName('Angka 1, ada kelinci');
      // Still on the first tile: the key started the maze, it did not also step.
      expect(tile(kind, labelAt(maze, maze.route[1]))).not.toHaveAccessibleName(/ada kelinci/);
    });

    it('is needed again after a reset', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);
      await user.click(tile(kind, labelAt(maze, maze.route[1])));

      await user.click(screen.getByRole('button', { name: 'Ulangi labirin' }));

      expect(tile(kind, '1')).toHaveAccessibleName('Angka 1, ketuk untuk mulai');
      expect(screen.getByText('Ketuk 1 untuk mulai')).toBeInTheDocument();
    });

    it('is needed again for every new maze', async () => {
      const user = userEvent.setup();
      await enter(user, 'Angka');
      await finishLevel(user, 'numbers', 0);

      expect(screen.getByText('Ketuk 1 untuk mulai')).toBeInTheDocument();
      expect(document.querySelector('[data-start]')).not.toBeNull();
    });
  });

  describe('moving along the route', () => {
    it('hops to the next tile, leaving a trail, and says its label', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);

      spokenTexts.length = 0;
      await user.click(tile(kind, '2'));

      expect(tile(kind, '2')).toHaveAccessibleName('Angka 2, ada kelinci');
      expect(tile(kind, '1')).toHaveAccessibleName('Angka 1, sudah dilewati');
      expect(spokenTexts).toContain('dua');
      expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
    });

    it('pops once per hop', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);

      playedToneCounts.value = 0;
      await user.click(tile(kind, '2'));

      expect(playedToneCounts.value).toBe(1);
    });

    it('ignores a tile that is not next, in silence', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);

      // Tile 3 is two hops away: not beside the animal, so not a mistake either.
      spokenTexts.length = 0;
      playedToneCounts.value = 0;
      await user.click(tile(kind, '3'));

      expect(tile(kind, '1')).toHaveAccessibleName('Angka 1, ada kelinci');
      expect(playedToneCounts.value).toBe(0);
      expect(spokenTexts).toEqual([]);
    });

    it('highlights the finished stretch in the sequence strip', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);
      await user.click(tile(kind, '2'));

      const items = screen.getByRole('list', { name: 'Urutan' }).querySelectorAll('li');
      expect(items[0].className).toContain('bg-emerald-200');
      expect(items[1].className).toContain('bg-amber-300');
      expect(items[2].className).toContain('bg-slate-200');
    });

    it('speaks letters by name, when the maze is lined with letters', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Huruf');
      await start(user, kind, maze);

      spokenTexts.length = 0;
      await user.click(tile(kind, 'B'));

      expect(spokenTexts).toContain(spokenLabel('letters', 'B'));
    });
  });

  describe('a tap on a dead end', () => {
    // Level 2 has a dead end beside its very first tile.
    async function openLevelTwo(user: User, choice: 'Huruf' | 'Angka') {
      const { kind } = await enter(user, choice);
      await finishLevel(user, kind, 0);
      const level = MAZE_LEVELS[1];
      return { kind, level, maze: buildMaze(level, kind) };
    }

    it('nudges softly, says what to look for, and lights up the right tile', async () => {
      const user = userEvent.setup();
      const { kind, level, maze } = await openLevelTwo(user, 'Huruf');
      const { k, p } = deadEndBeside(maze);

      await start(user, kind, maze);
      await walk(user, kind, maze, 0, k);

      spokenTexts.length = 0;
      playedToneCounts.value = 0;
      await user.click(tile(kind, labelAt(maze, p)));

      // Two soft notes - the nudge - and no move.
      expect(playedToneCounts.value).toBe(2);
      expect(tile(kind, labelAt(maze, maze.route[k]))).toHaveAccessibleName(/ada kucing/);

      // "Cari huruf <what comes next>!" - the answer, not a scolding.
      const nextLetter = ALPHABET[level.from + k];
      expect(spokenTexts).toContain(`Cari huruf ${LETTER_NAMES_ID[nextLetter]}!`);

      // And the right tile glows.
      expect(document.querySelector('[data-hint]')).toBe(tile(kind, labelAt(maze, maze.route[k + 1])));
    });

    it('asks for a number, not a letter, in a number maze', async () => {
      const user = userEvent.setup();
      const { kind, level, maze } = await openLevelTwo(user, 'Angka');
      const { k, p } = deadEndBeside(maze);

      await start(user, kind, maze);
      await walk(user, kind, maze, 0, k);

      spokenTexts.length = 0;
      await user.click(tile(kind, labelAt(maze, p)));

      expect(spokenTexts).toContain(`Cari angka ${NUMBER_WORDS_ID[level.from + k + 1]}!`);
    });

    it('stops pointing once the child takes the right tile', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await openLevelTwo(user, 'Huruf');
      const { k, p } = deadEndBeside(maze);

      await start(user, kind, maze);
      await walk(user, kind, maze, 0, k);
      await user.click(tile(kind, labelAt(maze, p)));
      expect(document.querySelector('[data-hint]')).not.toBeNull();

      await user.click(tile(kind, labelAt(maze, maze.route[k + 1])));
      expect(document.querySelector('[data-hint]')).toBeNull();
    });

    it('can be tried again and again - there is no penalty to accumulate', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await openLevelTwo(user, 'Huruf');
      const { k, p } = deadEndBeside(maze);

      await start(user, kind, maze);
      await walk(user, kind, maze, 0, k);
      for (let i = 0; i < 5; i += 1) await user.click(tile(kind, labelAt(maze, p)));
      await walk(user, kind, maze, k, maze.route.length - 1);

      expect(screen.getByTestId('celebration')).toBeInTheDocument();
    });
  });

  describe('reaching the treat', () => {
    it('celebrates: chime, cheer, praise and a way on', async () => {
      const user = userEvent.setup();
      const { kind, level, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);
      await walk(user, kind, maze, 0, level.length - 2);

      playedToneCounts.value = 0;
      await user.click(tile(kind, labelAt(maze, maze.route[level.length - 1])));

      // One hop (1) and the chime (4).
      expect(playedToneCounts.value).toBe(1 + 4);
      expect(screen.getByTestId('celebration')).toBeInTheDocument();
      expect(screen.getByText('Kelinci dapat wortel!', { selector: 'span' })).toBeInTheDocument();
      expect(spokenTexts).toContain('empat! Hore, sampai!');
      expect(screen.getByRole('button', { name: 'Labirin berikutnya' })).toBeInTheDocument();

      await waitFor(() =>
        expect(spokenTexts.some((t) => (PRAISE_ID as readonly string[]).includes(t))).toBe(true),
      );
    });

    it('lets the animal stand on the treat', async () => {
      const user = userEvent.setup();
      const { kind, level, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);
      await walk(user, kind, maze, 0, level.length - 1);

      expect(tile(kind, '4')).toHaveAccessibleName('Angka 4, ada kelinci');
    });

    it('stops accepting taps once it is over', async () => {
      const user = userEvent.setup();
      const { kind, level, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);
      await walk(user, kind, maze, 0, level.length - 1);

      playedToneCounts.value = 0;
      await user.click(tile(kind, '3'));
      expect(playedToneCounts.value).toBe(0);
      expect(tile(kind, '4')).toHaveAccessibleName('Angka 4, ada kelinci');
    });
  });

  describe('the levels', () => {
    it('move on with a new friend and their own instruction', async () => {
      const user = userEvent.setup();
      await enter(user, 'Huruf');
      await finishLevel(user, 'letters', 0);

      const level = MAZE_LEVELS[1];
      const [first, last] = routeEnds(level, 'letters');
      expect(screen.getByText(`Ketuk ${first} untuk mulai`)).toBeInTheDocument();
      expect(spokenTexts).toContain(
        `Ikuti huruf dari ${LETTER_NAMES_ID[first]} sampai ${LETTER_NAMES_ID[last]}!`,
      );
      expect(tile('letters', first)).toHaveAccessibleName(/ketuk untuk mulai/);
      expect(tile('letters', last)).toHaveAccessibleName(/ada ikan/);
    });

    it('go round again after the last one', async () => {
      const user = userEvent.setup();
      await enter(user, 'Angka');
      for (let n = 0; n < MAZE_LEVELS.length; n += 1) await finishLevel(user, 'numbers', n);

      expect(screen.getByText('Ketuk 1 untuk mulai')).toBeInTheDocument();
      expect(spokenTexts.at(-1)).not.toBeUndefined();
    });

    it.each(['Huruf', 'Angka'] as const)('can be played end to end, every one of them, as %s', async (choice) => {
      const user = userEvent.setup();
      const { kind } = await enter(user, choice);

      for (let n = 0; n < MAZE_LEVELS.length; n += 1) {
        const maze = buildMaze(MAZE_LEVELS[n], kind);
        await start(user, kind, maze);
        await walk(user, kind, maze, 0, maze.route.length - 1);
        expect(screen.getByTestId('celebration'), `level ${n + 1} did not finish`).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Labirin berikutnya' }));
      }
    }, 30000);
  });

  describe('starting over', () => {
    it('returns the animal to the start and says the instruction again', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);
      await user.click(tile(kind, '2'));
      spokenTexts.length = 0;
      await user.click(screen.getByRole('button', { name: 'Ulangi labirin' }));

      expect(tile(kind, '1')).toHaveAccessibleName('Angka 1, ketuk untuk mulai');
      expect(tile(kind, '2')).not.toHaveAccessibleName(/ada kelinci|sudah dilewati/);
      expect(spokenTexts).toContain('Ikuti angka dari satu sampai empat!');
    });

    it('is only offered once the animal has moved', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');

      expect(screen.queryByRole('button', { name: 'Ulangi labirin' })).not.toBeInTheDocument();
      await start(user, kind, maze);
      expect(screen.queryByRole('button', { name: 'Ulangi labirin' })).not.toBeInTheDocument();
      await user.click(tile(kind, '2'));
      expect(screen.getByRole('button', { name: 'Ulangi labirin' })).toBeInTheDocument();
    });
  });

  describe('the arrow keys', () => {
    it('walk the animal along the route, once the maze has started', async () => {
      const user = userEvent.setup();
      const { kind, level, maze } = await enter(user, 'Angka');

      await user.keyboard('{ArrowUp}'); // the first press starts it
      for (let i = 1; i < maze.route.length; i += 1) {
        await user.keyboard(keyFor(maze.route[i - 1], maze.route[i]));
      }

      expect(screen.getByTestId('celebration')).toBeInTheDocument();
      expect(tile(kind, String(level.from + level.length - 1))).toHaveAccessibleName(/ada kelinci/);
    });

    it('do nothing at all against a wall or the edge of the board', async () => {
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');
      await start(user, kind, maze);

      const origin = maze.route[0];
      const blocked = (['{ArrowUp}', '{ArrowDown}', '{ArrowLeft}', '{ArrowRight}'] as const).find((k) => {
        const d = { '{ArrowUp}': [-1, 0], '{ArrowDown}': [1, 0], '{ArrowLeft}': [0, -1], '{ArrowRight}': [0, 1] }[k];
        return stepResult(maze, 0, { row: origin.row + d[0], col: origin.col + d[1] }) === 'ignore';
      })!;

      spokenTexts.length = 0;
      playedToneCounts.value = 0;
      await user.keyboard(blocked);

      expect(playedToneCounts.value).toBe(0);
      expect(spokenTexts).toEqual([]);
      expect(tile(kind, '1')).toHaveAccessibleName('Angka 1, ada kelinci');
    });

    it('do nothing on the choosing screen', async () => {
      const user = userEvent.setup();
      await openLabirin(user);

      playedToneCounts.value = 0;
      await user.keyboard('{ArrowUp}{ArrowDown}{ArrowLeft}{ArrowRight}');

      expect(playedToneCounts.value).toBe(0);
      expect(screen.getByText('Pilih dulu, lalu mulai')).toBeInTheDocument();
    });
  });

  describe('letter names in English', () => {
    it('are spoken in English while the sentence around them stays Indonesian', async () => {
      window.localStorage.setItem('belajar-yuk:letter-lang', 'en');
      const user = userEvent.setup();
      const { kind, level } = await enter(user, 'Huruf');

      const [first, last] = routeEnds(level, kind);
      const spoken = () => spokenUtterances.map((u) => `${u.lang}:${u.text}`);

      // A sentence is one voice, so the Indonesian words and the English
      // letter names are spoken as separate utterances in their own language.
      // The queue plays them one after another, so wait for the last.
      await waitFor(() => expect(spoken()).toContain(`en-GB:${LETTER_NAMES_EN[last]}!`));
      expect(spoken()).toContain('id-ID:Ikuti huruf dari');
      expect(spoken()).toContain(`en-GB:${LETTER_NAMES_EN[first]}`);
      expect(spoken()).toContain('id-ID:sampai');
    });
  });

  describe('your own pictures', () => {
    it('replace the animal - small before the start, big after - and the treat', async () => {
      setMediaManifest({ audio: [], images: ['maze/kelinci.png', 'maze/wortel.png'] });
      const user = userEvent.setup();
      const { kind, maze } = await enter(user, 'Angka');

      const first = tile(kind, '1');
      expect(first.querySelector('img')).toHaveAttribute('src', 'media/images/maze/kelinci.png');
      expect(first.querySelector('img')).toHaveClass('size-1/4');
      expect(tile(kind, '4').querySelector('img')).toHaveAttribute('src', 'media/images/maze/wortel.png');

      await start(user, kind, maze);
      expect(tile(kind, '1').querySelector('img')).toHaveClass('size-3/5');
    });

    it('keep the built-in icons for anything without one', async () => {
      const user = userEvent.setup();
      const { kind } = await enter(user, 'Angka');

      expect(tile(kind, '1').querySelector('img')).toBeNull();
      expect(tile(kind, '1').querySelector('svg')).not.toBeNull();
    });
  });

  describe('your own recordings', () => {
    it('stand in for the fixed words of the choosing sentence, in order', async () => {
      setMediaManifest({
        audio: ['maze/pilih.mp3', 'maze/huruf.mp3', 'maze/angka.mp3', 'maze/atau.mp3', 'maze/acak.mp3'],
        images: [],
      });
      const user = userEvent.setup();
      await openLabirin(user);

      await waitFor(() => expect(playedClips).toHaveLength(5));
      expect(playedClips).toEqual([
        'media/audio/maze/pilih.mp3',
        'media/audio/maze/huruf.mp3',
        'media/audio/maze/angka.mp3',
        'media/audio/maze/atau.mp3',
        'media/audio/maze/acak.mp3',
      ]);
      expect(spokenTexts).not.toContain('Pilih huruf, angka, atau acak!');
    });

    it('stand in for the fixed words of a sentence and leave the rest spoken', async () => {
      setMediaManifest({ audio: ['maze/ikuti-angka.mp3', 'maze/sampai.mp3'], images: [] });
      const user = userEvent.setup();
      await enter(user, 'Angka');

      // Both fixed words are recorded, so only the two numbers are left to the
      // speech engine - and the clips play in sentence order between them.
      await waitFor(() => expect(spokenTexts).toContain('empat!'));
      expect(spokenTexts).toContain('satu');
      expect(spokenTexts).not.toContain('Ikuti angka dari satu sampai empat!');
      expect(playedClips).toEqual(['media/audio/maze/ikuti-angka.mp3', 'media/audio/maze/sampai.mp3']);
    });
  });
});
