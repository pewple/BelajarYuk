import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { leaveGame } from './helpers';
import { POLA_LEVELS, TOKENS, buildRound, fullPattern } from '../data/pola';
import type { TokenId } from '../data/pola';
import { HINTS_STORAGE_KEY } from '../data/hints';
import { REVIEW_EVERY, REVIEW_STORAGE_KEY, reviewOrder } from '../data/review';
import { UNLOCK_AFTER_GAMES } from '../data/session';
import { patternLine } from '../media/polaVoice';
import { stepsFor } from '../media/voiceParts';
import { installVoice, playedClips, playedToneCounts, setMediaManifest, spokenTexts } from './setup';

type User = ReturnType<typeof userEvent.setup>;

/* ------------------------------------------------------------------ */
/* The patterns themselves                                             */
/* ------------------------------------------------------------------ */

/** The smallest period of a row: the shortest repeat that reproduces it. */
function period(row: TokenId[]): number {
  for (let p = 1; p <= row.length; p += 1) {
    if (row.every((id, i) => i < p || id === row[i - p])) return p;
  }
  return row.length;
}

describe('the pattern levels', () => {
  it('have unique ids, so a fumble can be filed under one', () => {
    const ids = POLA_LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only use shapes that are on offer, and offer each once', () => {
    for (const level of POLA_LEVELS) {
      expect(new Set(level.palette).size, level.id).toBe(level.palette.length);
      for (const id of level.unit) expect(level.palette, level.id).toContain(id);
      // Nothing is offered that the pattern never uses: that would be a distractor with no point.
      for (const id of level.palette) expect(level.unit, level.id).toContain(id);
    }
  });

  it('start with two colours and get harder: doubled, then three', () => {
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

describe('a round', () => {
  const rounds = POLA_LEVELS.flatMap((level) => Array.from({ length: 12 }, (_, n) => buildRound(level, n)));

  it('shows two whole repeats of the unit', () => {
    for (const r of rounds) expect(r.shown).toHaveLength(r.level.unit.length * 2);
  });

  it('is carried on by its answer, and only by it', () => {
    for (const r of rounds) {
      const row = fullPattern(r);
      expect(period(row), r.level.id).toBe(r.level.unit.length);
      // Any other shape on offer would break the pattern.
      for (const other of r.level.palette.filter((id) => id !== r.answer)) {
        expect(period([...r.shown, other]), `${r.level.id} with ${other}`).not.toBe(r.level.unit.length);
      }
    }
  });

  it('has its answer on offer', () => {
    for (const r of rounds) expect(r.level.palette).toContain(r.answer);
  });

  it('does not always have the same answer: it depends on where the row starts', () => {
    for (const level of POLA_LEVELS) {
      const answers = new Set(Array.from({ length: level.unit.length }, (_, n) => buildRound(level, n).answer));
      expect(answers.size, level.id).toBeGreaterThan(1);
    }
  });

  it('is the same every time for the same round', () => {
    expect(buildRound(POLA_LEVELS[2], 5)).toEqual(buildRound(POLA_LEVELS[2], 5));
  });
});

describe('saying a row aloud', () => {
  it('is one sentence, with commas and a closing bang', () => {
    const [step] = stepsFor(patternLine(['merah', 'biru', 'merah']));
    expect(step).toMatchObject({ kind: 'tts', text: 'merah, biru, merah!' });
  });

  it('takes a recording for each colour that has one', () => {
    setMediaManifest({ audio: ['colors/biru.mp3'], images: [] });
    const steps = stepsFor(patternLine(['merah', 'biru', 'merah']));

    expect(steps.map((s) => (s.kind === 'clip' ? 'clip' : s.text))).toEqual(['merah,', 'clip', 'merah!']);
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

const rightFor = (round: number) => TOKENS[buildRound(POLA_LEVELS[round % POLA_LEVELS.length], round).answer].name;
const option = (name: string) => screen.getByRole('button', { name: `Pilih ${name}` });
const tray = () => screen.queryAllByRole('button', { name: /^Pilih / }).map((b) => b.getAttribute('aria-label'));
const row = () => within(screen.getByRole('list', { name: 'Pola' })).getAllByRole('listitem');

async function openPola(user: User) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Pola/ }));
}

/** Plays round `n` (0-based, in the fixed order) correctly and moves on. */
async function solve(user: User, n: number) {
  await user.click(option(rightFor(n)));
  await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));
}

describe('Pola', () => {
  const setHints = (level: 'guided' | 'independent', streak = 0) =>
    window.localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify({ pola: { level, streak } }));

  describe('opening it', () => {
    it('is on the home screen, after Berhitung', () => {
      render(<App />);
      const titles = ['Mengenal Huruf', 'Belajar Bicara', 'Berhitung', 'Pola'];
      const order = screen
        .getAllByRole('button')
        .map((b) => titles.find((t) => b.textContent?.includes(t)))
        .filter(Boolean);

      expect(order).toEqual(titles);
    });

    it('opens on the first pattern and goes home again', async () => {
      const user = userEvent.setup();
      await openPola(user);

      expect(screen.getByRole('heading', { name: 'Pola' })).toBeInTheDocument();
      await leaveGame(user);
      expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    });

    it('shows two repeats of red and blue, then a question mark, and the two to pick from', async () => {
      const user = userEvent.setup();
      await openPola(user);

      expect(row().map((li) => li.getAttribute('aria-label'))).toEqual([
        'merah', 'biru', 'merah', 'biru', 'Yang mana berikutnya?',
      ]);
      expect(tray()).toEqual(['Pilih merah', 'Pilih biru']);
    });

    it('says what to do, out loud', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = userEvent.setup();
      await openPola(user);

      expect(spokenTexts).toContain('Lanjutkan polanya!');
    });

    it('has a speaker button that says it again', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = userEvent.setup();
      await openPola(user);
      spokenTexts.length = 0;

      await user.click(screen.getByRole('button', { name: 'Ulangi perintah' }));
      expect(spokenTexts).toContain('Lanjutkan polanya!');
    });
  });

  describe('a right pick', () => {
    it('fills the place, takes the tray away, and says the whole row', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = userEvent.setup();
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
      const user = userEvent.setup();
      await openPola(user);
      const before = playedToneCounts.value;

      await user.click(option('merah'));

      expect(playedToneCounts.value).toBeGreaterThan(before + 3);
    });

    it('is followed by praise', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = userEvent.setup();
      await openPola(user);
      spokenTexts.length = 0;
      await user.click(option('merah'));

      await waitFor(() => expect(spokenTexts.length).toBeGreaterThanOrEqual(2));
    });

    it('uses a recording for a colour where there is one', async () => {
      setMediaManifest({ audio: ['colors/merah.mp3', 'colors/biru.mp3'], images: [] });
      installVoice('Test Indonesian', 'id-ID');
      const user = userEvent.setup();
      await openPola(user);
      await user.click(option('merah'));

      await screen.findByText('Polanya sudah benar!');
      expect(playedClips.some((c) => c.endsWith('colors/merah.mp3'))).toBe(true);
    });
  });

  describe('a wrong pick', () => {
    it('is answered softly: a sound, "Coba lagi!", and nothing lost', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = userEvent.setup();
      await openPola(user);
      spokenTexts.length = 0;
      const before = playedToneCounts.value;

      await user.click(option('biru'));

      expect(playedToneCounts.value).toBeGreaterThan(before);
      expect(spokenTexts).toContain('Coba lagi!');
      expect(tray()).toEqual(['Pilih merah', 'Pilih biru']); // still all there
      expect(screen.queryByText('Polanya sudah benar!')).not.toBeInTheDocument();
    });

    it('lets the child try again, and the right one then works', async () => {
      const user = userEvent.setup();
      await openPola(user);
      await user.click(option('biru'));
      await user.click(option('biru'));
      await user.click(option('merah'));

      expect(screen.getByText('Polanya sudah benar!')).toBeInTheDocument();
    });

    it('makes the right shape glow, for a child who is not being guided', async () => {
      setHints('independent');
      const user = userEvent.setup();
      await openPola(user);
      expect(option('merah')).not.toHaveAttribute('data-hint');

      await user.click(option('biru'));
      expect(option('merah')).toHaveAttribute('data-hint', 'true');
      expect(option('biru')).not.toHaveAttribute('data-hint');
    });
  });

  describe('the tray', () => {
    it('is the same shapes in the same places for every round of a level', async () => {
      const user = userEvent.setup();
      await openPola(user);
      const first = tray();
      await solve(user, 0);
      await solve(user, 1);
      // Rounds 0 and 1 are different levels, so the tray may change; a level's own tray never does.
      expect(first).toEqual(['Pilih merah', 'Pilih biru']);
      expect(tray()).toEqual(['Pilih merah', 'Pilih biru']); // level 2 (AAB) has the same palette
    });

    it('changes to the next level\'s shapes', async () => {
      const user = userEvent.setup();
      await openPola(user);
      await solve(user, 0);

      expect(tray()).toEqual(['Pilih kuning', 'Pilih hijau']);
      expect(row().map((li) => li.getAttribute('aria-label')).slice(0, 4)).toEqual([
        'hijau', 'kuning', 'hijau', 'kuning', // round 1 starts from the second colour
      ]);
    });

    it('goes round to the first level again, starting the row from a different place', async () => {
      const user = userEvent.setup();
      await openPola(user);
      for (let n = 0; n < POLA_LEVELS.length; n += 1) await solve(user, n);

      // Round 7 is level 1 again, now starting from the second colour.
      expect(row().map((li) => li.getAttribute('aria-label')).slice(0, 4)).toEqual([
        'biru', 'merah', 'biru', 'merah',
      ]);
    });
  });

  describe('the hints', () => {
    it('start guided for a new child: the right shape glows from the start', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = userEvent.setup();
      await openPola(user);

      expect(option('merah')).toHaveAttribute('data-hint', 'true');
      expect(option('biru')).not.toHaveAttribute('data-hint');
    });

    it('fade after three right picks in a row', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = userEvent.setup();
      await openPola(user);
      await solve(user, 0);
      await solve(user, 1);
      expect(option(rightFor(2))).toHaveAttribute('data-hint', 'true');
      await user.click(option(rightFor(2)));

      expect(JSON.parse(window.localStorage.getItem(HINTS_STORAGE_KEY)!).pola).toEqual({
        level: 'independent',
        streak: 0,
      });
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));
      expect(option(rightFor(3))).not.toHaveAttribute('data-hint');
    });

    it('come back after two wrong picks in a row', async () => {
      setHints('independent');
      const user = userEvent.setup();
      await openPola(user);
      await user.click(option('biru'));
      await user.click(option('biru'));

      expect(JSON.parse(window.localStorage.getItem(HINTS_STORAGE_KEY)!).pola.level).toBe('guided');
    });
  });

  describe('the review', () => {
    it('files a wrong pick under the level, and a right one moves it up', async () => {
      const user = userEvent.setup();
      await openPola(user);
      await user.click(option('biru'));
      expect(JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY)!)['pola:ab-merah-biru']).toMatchObject({
        box: 0,
        misses: 1,
      });

      await user.click(option('merah'));
      expect(JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY)!)['pola:ab-merah-biru'].box).toBe(1);
    });

    it('brings a missed level round again, every third round', async () => {
      window.localStorage.setItem(
        REVIEW_STORAGE_KEY,
        JSON.stringify({ 'pola:ab-merah-biru': { box: 0, due: 0, misses: 1 } }),
      );
      const user = userEvent.setup();
      await openPola(user);
      const shown = () => row().map((li) => li.getAttribute('aria-label')).slice(0, 2).join(' ');

      await solve(user, 0);
      expect(shown()).toBe('hijau kuning'); // round 1: next in order
      await user.click(option(TOKENS[buildRound(POLA_LEVELS[1], 1).answer].name));
      await user.click(screen.getByRole('button', { name: 'Pola berikutnya' }));
      expect(shown()).toMatch(/^(merah biru|biru merah)$/); // round 2: the missed one again
    });
  });

  describe('leaving', () => {
    it(`is gated until ${UNLOCK_AFTER_GAMES} rounds are done`, async () => {
      const user = userEvent.setup();
      await openPola(user);
      const home = () => screen.getByRole('button', { name: 'Kembali ke menu utama' });
      expect(home()).toHaveAttribute('data-locked', 'true');

      for (let n = 0; n < UNLOCK_AFTER_GAMES; n += 1) await solve(user, n);
      expect(home()).not.toHaveAttribute('data-locked');
    });

    it('stops saying the instruction once the child knows the drill', async () => {
      installVoice('Test Indonesian', 'id-ID');
      const user = userEvent.setup();
      await openPola(user);
      for (let n = 0; n < 3; n += 1) await solve(user, n);

      spokenTexts.length = 0;
      await solve(user, 3);
      expect(spokenTexts).not.toContain('Lanjutkan polanya!');
    });
  });
});
