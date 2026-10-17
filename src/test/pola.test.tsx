import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupUser } from './user';
import App from '../App';
import { leaveGame } from './helpers';
import {
  BOX_LEVELS,
  LEVELS,
  POLA_LEVELS,
  TOKENS,
  boxCells,
  buildRound,
  fullPattern,
  kindFor,
  layoutOf,
} from '../data/pola';
import type { PolaKind, TokenId } from '../data/pola';
import { HINTS_STORAGE_KEY } from '../data/hints';
import { REVIEW_EVERY, REVIEW_STORAGE_KEY, reviewOrder } from '../data/review';
import { UNLOCK_AFTER_GAMES } from '../data/session';
import { chooseKindLine, nameOf, patternLine } from '../media/polaVoice';
import { stepsFor } from '../media/voiceParts';
import { installVoice, playedClips, playedToneCounts, setMediaManifest, spokenTexts } from './setup';

type User = ReturnType<typeof userEvent.setup>;

/* ------------------------------------------------------------------ */
/* The patterns themselves                                             */
/* ------------------------------------------------------------------ */

/** The smallest period of a row: the shortest repeat that reproduces it. */
function period(row: string[]): number {
  for (let p = 1; p <= row.length; p += 1) {
    if (row.every((id, i) => i < p || id === row[i - p])) return p;
  }
  return row.length;
}

const ALL_LEVELS = [...POLA_LEVELS, ...BOX_LEVELS];

describe('the pattern levels', () => {
  it('have unique ids across both kinds, so a fumble can be filed under one', () => {
    const ids = ALL_LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('are grouped by kind, and every level says which it is', () => {
    expect(LEVELS.baris).toBe(POLA_LEVELS);
    expect(LEVELS.kotak).toBe(BOX_LEVELS);
    expect(POLA_LEVELS.every((l) => l.kind === 'baris')).toBe(true);
    expect(BOX_LEVELS.every((l) => l.kind === 'kotak')).toBe(true);
  });

  it('only use things that are on offer, and offer each once', () => {
    for (const level of ALL_LEVELS) {
      expect(new Set(level.palette).size, level.id).toBe(level.palette.length);
      for (const id of level.unit) expect(level.palette, level.id).toContain(id);
      // Nothing is offered that the pattern never uses: that would be a distractor with no point.
      for (const id of level.palette) expect(level.unit, level.id).toContain(id);
    }
  });

  it('start rows with two colours and get harder: doubled, then three', () => {
    const kinds = POLA_LEVELS.map((l) => `${l.unit.length}:${new Set(l.unit).size}`);
    expect(kinds[0]).toBe('2:2');
    expect(kinds).toContain('3:2');
    expect(kinds).toContain('3:3');
  });

  it('give every shape its own colour and its own form, so colour is never the only cue', () => {
    const tokens = Object.values(TOKENS);
    expect(new Set(tokens.map((t) => t.shape)).size).toBe(tokens.length);
    expect(new Set(tokens.map((t) => t.fill)).size).toBe(tokens.length);
  });
});

describe('the box levels', () => {
  const cellCounts = BOX_LEVELS.map((l) => boxCells(l.unit[0]).length);

  it('go from two shapes stacked, through three, to four', () => {
    expect(cellCounts).toEqual([...cellCounts].sort());
    expect(new Set(cellCounts)).toEqual(new Set([2, 3, 4]));
  });

  it('hold only real shapes, and two to four of them', () => {
    for (const level of BOX_LEVELS) {
      for (const box of level.unit) {
        const cells = boxCells(box);
        expect(cells.length, box).toBeGreaterThanOrEqual(2);
        expect(cells.length, box).toBeLessThanOrEqual(4);
        for (const cell of cells) expect(TOKENS[cell], `${box}: ${cell}`).toBeDefined();
      }
    }
  });

  it('are all AB, over two boxes of the same size', () => {
    for (const level of BOX_LEVELS) {
      expect(level.unit, level.id).toHaveLength(2);
      expect(boxCells(level.unit[0]).length).toBe(boxCells(level.unit[1]).length);
    }
  });

  it('use two boxes that hold the same shapes the other way round, so colours alone do not give the answer', () => {
    for (const level of BOX_LEVELS) {
      const [a, b] = level.unit.map((box) => boxCells(box));
      expect([...a].sort(), level.id).toEqual([...b].sort());
      expect(a, level.id).not.toEqual(b);
    }
  });

  it('stack two and three shapes in one column and put four in a square', () => {
    expect(layoutOf(2)).toEqual({ cols: 1, rows: 2 });
    expect(layoutOf(3)).toEqual({ cols: 1, rows: 3 });
    expect(layoutOf(4)).toEqual({ cols: 2, rows: 2 });
  });
});

describe('a round', () => {
  const rounds = ALL_LEVELS.flatMap((level) => Array.from({ length: 12 }, (_, n) => buildRound(level, n)));

  it('shows two whole repeats of the unit', () => {
    for (const r of rounds) expect(r.shown).toHaveLength(r.level.unit.length * 2);
  });

  it('is carried on by its answer, and only by it - rows and boxes alike', () => {
    for (const r of rounds) {
      const row = fullPattern(r);
      expect(period(row), r.level.id).toBe(r.level.unit.length);
      // Anything else on offer would break the pattern.
      for (const other of r.level.palette.filter((id) => id !== r.answer)) {
        expect(period([...r.shown, other]), `${r.level.id} with ${other}`).not.toBe(r.level.unit.length);
      }
    }
  });

  it('has its answer on offer', () => {
    for (const r of rounds) expect(r.level.palette).toContain(r.answer);
  });

  it('does not always have the same answer: it depends on where the row starts', () => {
    for (const level of ALL_LEVELS) {
      const answers = new Set(Array.from({ length: level.unit.length }, (_, n) => buildRound(level, n).answer));
      expect(answers.size, level.id).toBeGreaterThan(1);
    }
  });

  it('is the same every time for the same round', () => {
    expect(buildRound(POLA_LEVELS[2], 5)).toEqual(buildRound(POLA_LEVELS[2], 5));
    expect(buildRound(BOX_LEVELS[2], 5)).toEqual(buildRound(BOX_LEVELS[2], 5));
  });
});

describe('the kind of a round', () => {
  it('is what was chosen, when it was baris or kotak', () => {
    expect(kindFor('baris', () => 0.99)).toBe('baris');
    expect(kindFor('kotak', () => 0.01)).toBe('kotak');
  });

  it('is decided by a coin when it was acak', () => {
    expect(kindFor('acak', () => 0.1)).toBe('baris');
    expect(kindFor('acak', () => 0.9)).toBe('kotak');
  });
});

describe('saying a row aloud', () => {
  it('is one sentence, with commas and a closing bang', () => {
    const [step] = stepsFor(patternLine(['merah', 'biru', 'merah']));
    expect(step).toMatchObject({ kind: 'tts', text: 'merah, biru, merah!' });
  });

  it('reads a row of boxes box by box, each by its shapes from top to bottom', () => {
    const [step] = stepsFor(patternLine(['merah+biru', 'biru+merah', 'merah+biru'], 'kotak'));
    expect(step).toMatchObject({ kind: 'tts', text: 'merah biru, biru merah, merah biru!' });
  });

  it('reads a box of four shapes left to right, top row first', () => {
    const [step] = stepsFor(patternLine(['merah+kuning+biru+hijau'], 'kotak'));
    expect(step).toMatchObject({ text: 'merah kuning biru hijau!' });
  });

  it('takes a recording for each colour that has one', () => {
    setMediaManifest({ audio: ['colors/biru.mp3'], images: [] });
    const steps = stepsFor(patternLine(['merah', 'biru', 'merah']));

    expect(steps.map((s) => (s.kind === 'clip' ? 'clip' : s.text))).toEqual(['merah,', 'clip', 'merah!']);
  });

  it('asks for a kind in one sentence, naming the three', () => {
    const [step] = stepsFor(chooseKindLine());
    expect(step).toMatchObject({ kind: 'tts', text: 'Pilih baris, kotak, atau acak!' });
  });

  it('names a pick for assistive tech: a colour, or "kotak" and its colours', () => {
    expect(nameOf('merah', 'baris')).toBe('merah');
    expect(nameOf('merah+biru', 'kotak')).toBe('kotak merah biru');
  });
});

describe('what comes next in the fixed order', () => {
  it('follows the levels in turn and goes round again', () => {
    let place = { index: 0, sequential: 0 };
    const seen = [place.index];
    for (let round = 1; round <= POLA_LEVELS.length; round += 1) {
      place = reviewOrder(POLA_LEVELS.length, place.sequential, round, () => false);
      seen.push(place.index);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 0]);
  });

  it(`brings a missed level back every ${REVIEW_EVERY}rd round without losing the place`, () => {
    const weak = (i: number) => i === 0;
    const a = reviewOrder(POLA_LEVELS.length, 1, REVIEW_EVERY - 1, weak);
    const b = reviewOrder(POLA_LEVELS.length, a.sequential, REVIEW_EVERY, weak);

    expect(a).toEqual({ index: 0, sequential: 1 });
    expect(b.index).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/* The screen                                                          */
/* ------------------------------------------------------------------ */

type Mode = 'Baris' | 'Kotak' | 'Acak';

const tokenName = (id: string) => TOKENS[id as TokenId].name;
const lineRight = (round: number) => tokenName(buildRound(POLA_LEVELS[round % POLA_LEVELS.length], round).answer);
const boxRight = (round: number) =>
  nameOf(buildRound(BOX_LEVELS[round % BOX_LEVELS.length], round).answer, 'kotak');

const option = (name: string) => screen.getByRole('button', { name: `Pilih ${name}` });
const tray = () => screen.queryAllByRole('button', { name: /^Pilih / }).map((b) => b.getAttribute('aria-label'));
const row = () => within(screen.getByRole('list', { name: 'Pola' })).getAllByRole('listitem');
const rowNames = () => row().map((li) => li.getAttribute('aria-label'));

async function openChooser(user: User) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Pola/ }));
}

async function openPola(user: User, mode: Mode = 'Baris') {
  await openChooser(user);
  await user.click(screen.getByRole('button', { name: mode }));
}

/** Plays round `n` (0-based, in the fixed order, rows only) correctly and moves on. */
async function solveLine(user: User, n: number) {
  await user.click(option(lineRight(n)));
  await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));
}

/** The same for boxes. */
async function solveBox(user: User, n: number) {
  await user.click(option(boxRight(n)));
  await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));
}

const setHints = (level: 'guided' | 'independent', streak = 0) =>
  window.localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify({ pola: { level, streak } }));

afterEach(() => vi.restoreAllMocks());

describe('Pola', () => {
  describe('choosing the kind', () => {
    it('is on the home screen, after Berhitung and Menulis', () => {
      render(<App />);
      const titles = ['Berhitung', 'Menulis', 'Pola'];
      const order = screen
        .getAllByRole('button')
        .map((b) => titles.find((t) => b.textContent?.includes(t)))
        .filter(Boolean);

      expect(order).toEqual(titles);
    });

    it('comes first: three choices, and no pattern yet', async () => {
      const user = setupUser();
      await openChooser(user);

      expect(screen.getByRole('heading', { name: 'Pola' })).toBeInTheDocument();
      expect(screen.getByText('Pilih dulu, lalu mulai')).toBeInTheDocument();
      for (const name of ['Baris', 'Kotak', 'Acak']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Pola' })).not.toBeInTheDocument();
    });

    it('is spoken, not just shown, with a speaker button to say it again', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = setupUser();
      await openChooser(user);
      expect(spokenTexts).toContain('Pilih baris, kotak, atau acak!');

      spokenTexts.length = 0;
      await user.click(screen.getByRole('button', { name: 'Ulangi perintah' }));
      expect(spokenTexts).toContain('Pilih baris, kotak, atau acak!');
    });

    it('does not remember the choice: going home and back asks again', async () => {
      const user = setupUser();
      await openPola(user, 'Kotak');
      await leaveGame(user);
      await user.click(screen.getByRole('button', { name: /Pola/ }));

      expect(screen.getByText('Pilih dulu, lalu mulai')).toBeInTheDocument();
    });

    it('goes home from the choosing screen', async () => {
      const user = setupUser();
      await openChooser(user);
      await leaveGame(user);

      expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    });

    it('is not offered the home gate\'s count from another module', async () => {
      const user = setupUser();
      await openChooser(user);

      expect(screen.getByRole('button', { name: 'Kembali ke menu utama' })).toHaveAttribute('data-locked', 'true');
    });
  });

  describe('Baris: a row of shapes', () => {
    it('opens on the first pattern and goes home again', async () => {
      const user = setupUser();
      await openPola(user);

      expect(screen.getByRole('heading', { name: 'Pola' })).toBeInTheDocument();
      await leaveGame(user);
      expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    });

    it('shows two repeats of red and blue, then a question mark, and the two to pick from', async () => {
      const user = setupUser();
      await openPola(user);

      expect(rowNames()).toEqual(['merah', 'biru', 'merah', 'biru', 'Yang mana berikutnya?']);
      expect(tray()).toEqual(['Pilih merah', 'Pilih biru']);
    });

    it('says what to do, out loud, and has a speaker button that says it again', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = setupUser();
      await openPola(user);
      expect(spokenTexts).toContain('Lanjutkan polanya!');

      spokenTexts.length = 0;
      await user.click(screen.getByRole('button', { name: 'Ulangi perintah' }));
      expect(spokenTexts).toContain('Lanjutkan polanya!');
    });

    it('draws single shapes, not boxes', async () => {
      const user = setupUser();
      await openPola(user);

      expect(row()[0].querySelectorAll('svg')).toHaveLength(1);
    });

    describe('a right pick', () => {
      it('fills the place, takes the tray away, and says the whole row', async () => {
        installVoice('Test Indonesian', 'id-ID');
        const user = setupUser();
        await openPola(user);
        spokenTexts.length = 0;

        await user.click(option('merah'));

        expect(row().at(-1)).toHaveAttribute('aria-label', 'merah');
        expect(tray()).toEqual([]);
        expect(spokenTexts).toContain('merah, biru, merah, biru, merah!');
        expect(screen.getByText('Polanya sudah benar!')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pola berikutnya' })).toBeInTheDocument();
      });

      it('rings the chime and pops', async () => {
        const user = setupUser();
        await openPola(user);
        const before = playedToneCounts.value;

        await user.click(option('merah'));

        expect(playedToneCounts.value).toBeGreaterThan(before + 3);
      });

      it('is followed by praise', async () => {
        installVoice('Test Indonesian', 'id-ID');
        const user = setupUser();
        await openPola(user);
        spokenTexts.length = 0;
        await user.click(option('merah'));

        await waitFor(() => expect(spokenTexts.length).toBeGreaterThanOrEqual(2));
      });

      it('uses a recording for a colour where there is one', async () => {
        setMediaManifest({ audio: ['colors/merah.mp3', 'colors/biru.mp3'], images: [] });
        installVoice('Test Indonesian', 'id-ID');
        const user = setupUser();
        await openPola(user);
        await user.click(option('merah'));

        await screen.findByText('Polanya sudah benar!');
        expect(playedClips.some((c) => c.endsWith('colors/merah.mp3'))).toBe(true);
      });
    });

    describe('a wrong pick', () => {
      it('is answered softly: a sound, "Coba lagi!", and nothing lost', async () => {
        installVoice('Test Indonesian', 'id-ID');
        const user = setupUser();
        await openPola(user);
        spokenTexts.length = 0;
        const before = playedToneCounts.value;

        await user.click(option('biru'));

        expect(playedToneCounts.value).toBeGreaterThan(before);
        expect(spokenTexts).toContain('Coba lagi!');
        expect(tray()).toEqual(['Pilih merah', 'Pilih biru']);
        expect(screen.queryByText('Polanya sudah benar!')).not.toBeInTheDocument();
      });

      it('lets the child try again, and the right one then works', async () => {
        const user = setupUser();
        await openPola(user);
        await user.click(option('biru'));
        await user.click(option('biru'));
        await user.click(option('merah'));

        expect(screen.getByText('Polanya sudah benar!')).toBeInTheDocument();
      });

      it('makes the right shape glow, for a child who is not being guided', async () => {
        setHints('independent');
        const user = setupUser();
        await openPola(user);
        expect(option('merah')).not.toHaveAttribute('data-hint');

        await user.click(option('biru'));
        expect(option('merah')).toHaveAttribute('data-hint', 'true');
        expect(option('biru')).not.toHaveAttribute('data-hint');
      });
    });

    describe('the tray', () => {
      it('is the same shapes in the same places for every round of a level', async () => {
        const user = setupUser();
        await openPola(user);
        const first = tray();
        await solveLine(user, 0);
        await solveLine(user, 1);

        expect(first).toEqual(['Pilih merah', 'Pilih biru']);
        expect(tray()).toEqual(['Pilih merah', 'Pilih biru']); // level 3 (AAB) has the same palette
      });

      it('changes to the next level\'s shapes', async () => {
        const user = setupUser();
        await openPola(user);
        await solveLine(user, 0);

        expect(tray()).toEqual(['Pilih kuning', 'Pilih hijau']);
        expect(rowNames().slice(0, 4)).toEqual(['hijau', 'kuning', 'hijau', 'kuning']); // round 1 starts from the second colour
      });

      it('goes round to the first level again, starting the row from a different place', async () => {
        const user = setupUser();
        await openPola(user);
        for (let n = 0; n < POLA_LEVELS.length; n += 1) await solveLine(user, n);

        expect(rowNames().slice(0, 4)).toEqual(['biru', 'merah', 'biru', 'merah']);
      });
    });
  });

  describe('Kotak: a row of boxes', () => {
    it('opens on boxes of two shapes stacked, two to pick from', async () => {
      const user = setupUser();
      await openPola(user, 'Kotak');

      expect(rowNames()).toEqual([
        'kotak merah biru',
        'kotak biru merah',
        'kotak merah biru',
        'kotak biru merah',
        'Yang mana berikutnya?',
      ]);
      expect(tray()).toEqual(['Pilih kotak merah biru', 'Pilih kotak biru merah']);
    });

    it('draws each box as a frame with its shapes stacked in one column', async () => {
      const user = setupUser();
      await openPola(user, 'Kotak');
      const box = row()[0].firstElementChild as HTMLElement;

      expect(box.querySelectorAll('svg')).toHaveLength(2);
      expect(box.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
      expect(box.style.gridTemplateRows).toBe('repeat(2, minmax(0, 1fr))');
    });

    it('says what to do, as for rows', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = setupUser();
      await openPola(user, 'Kotak');

      expect(spokenTexts).toContain('Lanjutkan polanya!');
    });

    it('says the whole row of boxes aloud when it is right', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = setupUser();
      await openPola(user, 'Kotak');
      spokenTexts.length = 0;

      await user.click(option('kotak merah biru'));

      expect(spokenTexts).toContain('merah biru, biru merah, merah biru, biru merah, merah biru!');
      expect(row().at(-1)).toHaveAttribute('aria-label', 'kotak merah biru');
      expect(screen.getByText('Polanya sudah benar!')).toBeInTheDocument();
    });

    it('is answered softly when the box is the wrong way round', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = setupUser();
      await openPola(user, 'Kotak');
      spokenTexts.length = 0;
      const before = playedToneCounts.value;

      await user.click(option('kotak biru merah'));

      expect(playedToneCounts.value).toBeGreaterThan(before);
      expect(spokenTexts).toContain('Coba lagi!');
      expect(tray()).toHaveLength(2);
    });

    it('glows on the right box for a child being guided, and not otherwise', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = setupUser();
      await openPola(user, 'Kotak');

      expect(option('kotak merah biru')).toHaveAttribute('data-hint', 'true');
      expect(option('kotak biru merah')).not.toHaveAttribute('data-hint');
    });

    it('is the same boxes in the same places for every round of a level', async () => {
      const user = setupUser();
      await openPola(user, 'Kotak');
      const first = tray();
      await solveBox(user, 0);

      // The next level has other shapes, but its own two boxes keep their places.
      const second = tray();
      expect(first).toEqual(['Pilih kotak merah biru', 'Pilih kotak biru merah']);
      expect(second).toEqual(['Pilih kotak kuning hijau', 'Pilih kotak hijau kuning']);
    });

    it('goes from two shapes, through three stacked, to four in a square', async () => {
      const user = setupUser();
      await openPola(user, 'Kotak');
      const shapesPerBox: number[] = [];
      const layouts: string[] = [];
      for (let n = 0; n < BOX_LEVELS.length; n += 1) {
        const box = row()[0].firstElementChild as HTMLElement;
        shapesPerBox.push(box.querySelectorAll('svg').length);
        layouts.push(box.style.gridTemplateColumns);
        await solveBox(user, n);
      }

      expect(shapesPerBox).toEqual([2, 2, 3, 3, 4, 4]);
      expect(layouts[0]).toBe('repeat(1, minmax(0, 1fr))');
      expect(layouts[4]).toBe('repeat(2, minmax(0, 1fr))');
    }, 30_000);

    it('goes round to the first level again, starting from the other box', async () => {
      const user = setupUser();
      await openPola(user, 'Kotak');
      for (let n = 0; n < BOX_LEVELS.length; n += 1) await solveBox(user, n);

      // Round 6: the first level again, now starting from the second box.
      expect(rowNames().slice(0, 4)).toEqual([
        'kotak merah biru',
        'kotak biru merah',
        'kotak merah biru',
        'kotak biru merah',
      ].map((_, i) => (i % 2 === 0 ? 'kotak merah biru' : 'kotak biru merah')));
    }, 30_000);
  });

  describe('Acak: a coin for every round', () => {
    const coin = (value: number) => vi.spyOn(Math, 'random').mockReturnValue(value);

    it('can give a row, and then a box', async () => {
      const spy = coin(0.1); // heads: a row
      const user = setupUser();
      await openPola(user, 'Acak');
      expect(rowNames()[0]).toBe('merah');

      await user.click(option(lineRight(0)));
      spy.mockReturnValue(0.9); // tails: a box
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));

      expect(rowNames()[0]).toMatch(/^kotak /);
    });

    it('can give a box first, and then a row', async () => {
      const spy = coin(0.9);
      const user = setupUser();
      await openPola(user, 'Acak');
      expect(rowNames()[0]).toMatch(/^kotak /);

      await user.click(option(boxRight(0)));
      spy.mockReturnValue(0.1);
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));

      // The first row of the game: level one, round one - which starts from the second colour.
      expect(rowNames().slice(0, 2)).toEqual(['biru', 'merah']);
    });

    it('keeps each kind at its own place in its own order', async () => {
      const spy = coin(0.1);
      const user = setupUser();
      await openPola(user, 'Acak');
      await user.click(option(lineRight(0))); // row level 1
      spy.mockReturnValue(0.9);
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' })); // box level 1
      await user.click(option(nameOf(buildRound(BOX_LEVELS[0], 1).answer, 'kotak')));
      spy.mockReturnValue(0.1);
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' })); // row level 2, not 3

      expect(tray()).toEqual(['Pilih kuning', 'Pilih hijau']);
      spy.mockReturnValue(0.9);
      await user.click(option(tokenName(buildRound(POLA_LEVELS[1], 2).answer)));
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' })); // box level 2, not 3

      expect(tray()).toEqual(['Pilih kotak kuning hijau', 'Pilih kotak hijau kuning']);
    });

    it('is a fixed kind after all when the child chose Baris or Kotak: no coin', async () => {
      const spy = coin(0.9);
      const user = setupUser();
      await openPola(user, 'Baris');
      await user.click(option(lineRight(0)));
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));

      expect(rowNames()[0]).not.toMatch(/^kotak /);
      expect(spy).toBeDefined();
    });
  });

  describe('the hints', () => {
    it('start guided for a new child: the right shape glows from the start', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = setupUser();
      await openPola(user);

      expect(option('merah')).toHaveAttribute('data-hint', 'true');
      expect(option('biru')).not.toHaveAttribute('data-hint');
    });

    it('fade after three right picks in a row, across rows and boxes', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = setupUser();
      await openPola(user);
      await solveLine(user, 0);
      await solveLine(user, 1);
      expect(option(lineRight(2))).toHaveAttribute('data-hint', 'true');
      await user.click(option(lineRight(2)));

      expect(JSON.parse(window.localStorage.getItem(HINTS_STORAGE_KEY)!).pola).toEqual({
        level: 'independent',
        streak: 0,
      });
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));
      expect(option(lineRight(3))).not.toHaveAttribute('data-hint');
    });

    it('come back after two wrong picks in a row', async () => {
      setHints('independent');
      const user = setupUser();
      await openPola(user);
      await user.click(option('biru'));
      await user.click(option('biru'));

      expect(JSON.parse(window.localStorage.getItem(HINTS_STORAGE_KEY)!).pola.level).toBe('guided');
    });
  });

  describe('the review', () => {
    it('files a wrong pick under the level, and a right one moves it up', async () => {
      const user = setupUser();
      await openPola(user);
      await user.click(option('biru'));
      expect(JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY)!)['pola:ab-merah-biru']).toMatchObject({
        box: 0,
        misses: 1,
      });

      await user.click(option('merah'));
      expect(JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY)!)['pola:ab-merah-biru'].box).toBe(1);
    });

    it('files a wrong box under the box level', async () => {
      const user = setupUser();
      await openPola(user, 'Kotak');
      await user.click(option('kotak biru merah'));

      expect(JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY)!)['pola:kotak-2-merah-biru']).toMatchObject({
        misses: 1,
      });
    });

    it('brings a missed level round again, every third round', async () => {
      // A level that rounds 1 and 2 would not reach in order, so seeing it is the review.
      window.localStorage.setItem(
        REVIEW_STORAGE_KEY,
        JSON.stringify({ 'pola:abc-merah-kuning-biru': { box: 0, due: 0, misses: 1 } }),
      );
      const user = setupUser();
      await openPola(user);

      await solveLine(user, 0);
      expect(tray()).toEqual(['Pilih kuning', 'Pilih hijau']); // round 2: next in order
      await user.click(option(tokenName(buildRound(POLA_LEVELS[1], 1).answer)));
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));
      expect(tray()).toEqual(['Pilih merah', 'Pilih kuning', 'Pilih biru']); // round 3: the missed one again
    });

    it('brings a missed box level back too, but only among boxes', async () => {
      window.localStorage.setItem(
        REVIEW_STORAGE_KEY,
        JSON.stringify({ 'pola:kotak-4-merah-biru': { box: 0, due: 0, misses: 1 } }),
      );
      const user = setupUser();
      await openPola(user, 'Kotak');

      await solveBox(user, 0);
      await user.click(option(boxRight(1)));
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));

      expect(tray()).toEqual(['Pilih kotak merah biru biru merah', 'Pilih kotak biru merah merah biru']);
    });

    it('does not bring a missed row level into a game of boxes', async () => {
      window.localStorage.setItem(
        REVIEW_STORAGE_KEY,
        JSON.stringify({ 'pola:ab-merah-biru': { box: 0, due: 0, misses: 1 } }),
      );
      const user = setupUser();
      await openPola(user, 'Kotak');
      await solveBox(user, 0);
      await solveBox(user, 1);

      expect(rowNames()[0]).toMatch(/^kotak /);
      expect(tray()).toEqual(['Pilih kotak merah kuning biru', 'Pilih kotak biru kuning merah']);
    });
  });

  describe('leaving', () => {
    it(`is gated until ${UNLOCK_AFTER_GAMES} rounds are done`, async () => {
      const user = setupUser();
      await openPola(user);
      const home = () => screen.getByRole('button', { name: 'Kembali ke menu utama' });
      expect(home()).toHaveAttribute('data-locked', 'true');

      for (let n = 0; n < UNLOCK_AFTER_GAMES; n += 1) await solveLine(user, n);
      expect(home()).not.toHaveAttribute('data-locked');
    });

    it('stops saying the instruction once the child knows the drill', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = setupUser();
      await openPola(user);
      for (let n = 0; n < 3; n += 1) await solveLine(user, n);

      spokenTexts.length = 0;
      await solveLine(user, 3);
      expect(spokenTexts).not.toContain('Lanjutkan polanya!');
    });
  });
});

/** Compile-time check that the helpers above cover both kinds. */
const _kinds: PolaKind[] = ['baris', 'kotak'];
void _kinds;
