import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupUser } from './user';
import App from '../App';
import { leaveGame } from './helpers';
import { MediaCheckScreen } from '../screens/MediaCheckScreen';
import { MAZE_LEVELS, areNeighbours, buildMaze, cellAt } from '../data/maze';
import type { Maze, MazeKind, Position } from '../data/maze';
import { ARABIC_WORD_CARDS } from '../data/arabicWords';
import { ARABIC_NUMBER_NAMES, HIJAIYAH } from '../data/scripts';
import { COUNTING_SETS } from '../data/curriculum';
import { LETTER_NAMES_EN } from '../audio/words';
import {
  installVoice,
  playedClips,
  setMediaManifest,
  spokenTexts,
  spokenUtterances,
} from './setup';

type User = ReturnType<typeof userEvent.setup>;

const STORAGE_KEY = 'belajar-yuk:script';
const TOGGLE = { name: 'Jenis tulisan huruf dan angka' };

const openCard = (user: User, name: RegExp) => user.click(screen.getByRole('button', { name }));
const setScript = (user: User, which: 'Latin' | 'Arab') =>
  user.click(screen.getByRole('radio', { name: `Tulisan ${which}` }));

async function openIn(user: User, name: RegExp, script: 'latin' | 'arab' = 'arab') {
  if (script === 'arab') window.localStorage.setItem(STORAGE_KEY, 'arab');
  render(<App />);
  await openCard(user, name);
}

const labelAt = (maze: Maze, p: Position) => (cellAt(maze, p) as { label: string }).label;

/** A tile in the maze, named "Huruf ا" or "Angka ٣" (with any state after it). */
const tile = (kind: MazeKind, label: string) =>
  screen.getByRole('button', { name: new RegExp(`^${kind === 'letters' ? 'Huruf' : 'Angka'} ${label}(,|$)`) });

describe('Arabic letters and numerals', () => {
  beforeEach(() => installVoice('Test Indonesian', 'id-ID'));

  describe('the toggle', () => {
    it('is on Mengenal Huruf, Belajar Bicara, Berhitung and the maze\'s choosing screen', async () => {
      for (const card of [/Mengenal Huruf/, /Belajar Bicara/, /Berhitung/, /Labirin/]) {
        const user = setupUser();
        const { unmount } = render(<App />);
        await openCard(user, card);

        expect(screen.getByRole('radiogroup', TOGGLE), String(card)).toBeInTheDocument();
        unmount();
      }
    });

    it('is not on Kasir or the home screen', async () => {
      // Rupiah is written with Western digits, so a switch there would do
      // nothing sensible.
      for (const card of [/Kasir/]) {
        const user = setupUser();
        const { unmount } = render(<App />);
        expect(screen.queryByRole('radiogroup', TOGGLE)).not.toBeInTheDocument();
        await openCard(user, card);

        expect(screen.queryByRole('radiogroup', TOGGLE), String(card)).not.toBeInTheDocument();
        unmount();
      }
    });

    it('starts on Latin', async () => {
      const user = setupUser();
      render(<App />);
      await openCard(user, /Mengenal Huruf/);

      expect(screen.getByRole('radio', { name: 'Tulisan Latin' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Tulisan Arab' })).not.toBeChecked();
    });

    it('is remembered, so a parent sets it once', async () => {
      const user = setupUser();
      const first = render(<App />);
      await openCard(user, /Mengenal Huruf/);
      await setScript(user, 'Arab');
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('arab');
      first.unmount();

      // A fresh visit.
      render(<App />);
      await openCard(user, /Mengenal Huruf/);
      expect(screen.getByRole('radio', { name: 'Tulisan Arab' })).toBeChecked();
    });

    it('can be switched back, and that is remembered too', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);
      await setScript(user, 'Latin');

      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('latin');
    });

    it('is one setting for the whole app: switch it in one module and the others follow', async () => {
      const user = setupUser();
      render(<App />);
      await openCard(user, /Mengenal Huruf/);
      await setScript(user, 'Arab');
      await leaveGame(user);

      await openCard(user, /Berhitung/);
      expect(screen.getByRole('radio', { name: 'Tulisan Arab' })).toBeChecked();
    });

    it('survives storage being unavailable', async () => {
      // Private browsing can make storage throw. The switch should still work.
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('blocked');
      };
      try {
        const user = setupUser();
        render(<App />);
        await openCard(user, /Mengenal Huruf/);
        await setScript(user, 'Arab');

        expect(screen.getByRole('button', { name: /Dengarkan huruf ا/ })).toBeInTheDocument();
      } finally {
        Storage.prototype.setItem = original;
      }
    });
  });

  describe('Mengenal Huruf', () => {
    it('shows the 28 hijaiyah, starting with alif', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);

      expect(screen.getByText('Huruf 1 dari 28 — ketuk hurufnya')).toBeInTheDocument();
      const letter = screen.getByRole('button', { name: 'Dengarkan huruf ا (Alif)' });
      expect(letter).toHaveTextContent('ا');
      // Marked as Arabic so the browser picks an Arabic face for it.
      expect(letter.querySelector('[lang="ar"]')).not.toBeNull();
    });

    it('names the letter in Latin script underneath, for the grown-up', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);

      expect(screen.getByText('Alif')).toBeInTheDocument();
    });

    it('says the letter\'s name when it is tapped', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);

      await user.click(screen.getByRole('button', { name: /Dengarkan huruf ا/ }));
      expect(spokenTexts).toContain('alif');
    });

    it('steps through all 28 with the arrow keys and wraps at both ends', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', { name: /Dengarkan huruf ب/ })).toBeInTheDocument();
      expect(screen.getByText('Huruf 2 dari 28 — ketuk hurufnya')).toBeInTheDocument();

      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      // Before alif comes the 28th: ya.
      expect(screen.getByRole('button', { name: /Dengarkan huruf ي/ })).toBeInTheDocument();
      expect(screen.getByText('Huruf 28 dari 28 — ketuk hurufnya')).toBeInTheDocument();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', { name: /Dengarkan huruf ا/ })).toBeInTheDocument();
    });

    it('can say every one of the 28', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);

      for (const letter of HIJAIYAH) {
        spokenTexts.length = 0;
        await user.click(screen.getByRole('button', { name: new RegExp(`Dengarkan huruf ${letter.glyph}`) }));
        expect(spokenTexts, letter.id).toContain(letter.name);
        await user.keyboard('{ArrowRight}');
      }
    });

    it('hides the Indonesian/English choice, which does not apply to Arabic names', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);

      expect(screen.queryByRole('radiogroup', { name: 'Bahasa pengucapan huruf' })).not.toBeInTheDocument();
    });

    it('brings the Indonesian/English choice back in Latin', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);
      await setScript(user, 'Latin');

      expect(screen.getByRole('radiogroup', { name: 'Bahasa pengucapan huruf' })).toBeInTheDocument();
    });

    it('starts again from the first letter when the script changes', async () => {
      const user = setupUser();
      render(<App />);
      await openCard(user, /Mengenal Huruf/);
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}'); // D

      await setScript(user, 'Arab');
      // Position 4 in one alphabet means nothing in the other.
      expect(screen.getByRole('button', { name: /Dengarkan huruf ا/ })).toBeInTheDocument();
      expect(screen.getByText('Huruf 1 dari 28 — ketuk hurufnya')).toBeInTheDocument();

      await user.keyboard('{ArrowRight}');
      await setScript(user, 'Latin');
      expect(screen.getByRole('button', { name: 'Dengarkan huruf A' })).toBeInTheDocument();
      expect(screen.getByText('Huruf 1 dari 26 — ketuk hurufnya')).toBeInTheDocument();
    });

    it('speaks the Arabic name the same whatever the Latin-letter language is set to', async () => {
      window.localStorage.setItem('belajar-yuk:letter-lang', 'en');
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);

      spokenUtterances.length = 0;
      await user.click(screen.getByRole('button', { name: /Dengarkan huruf ا/ }));

      expect(spokenUtterances.map((u) => `${u.lang}:${u.text}`)).toEqual(['id-ID:alif']);
      expect(Object.values(LETTER_NAMES_EN)).not.toContain('alif');
    });

    it('plays a recording of the name when one has been supplied', async () => {
      setMediaManifest({ audio: ['letters/ar/alif.mp3'], images: [] });
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);

      await user.click(screen.getByRole('button', { name: /Dengarkan huruf ا/ }));

      await waitFor(() => expect(playedClips).toContain('media/audio/letters/ar/alif.mp3'));
      expect(spokenTexts).not.toContain('alif');
    });

    it('leaves the Latin alphabet exactly as it was', async () => {
      const user = setupUser();
      render(<App />);
      await openCard(user, /Mengenal Huruf/);

      expect(screen.getByText('Huruf 1 dari 26 — ketuk hurufnya')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dengarkan huruf A' })).toBeInTheDocument();
    });
  });

  describe('Berhitung', () => {
    const objectName = (round: number) =>
      new RegExp(`^Hitung ${COUNTING_SETS[(round - 1) % COUNTING_SETS.length].label}$`);

    it('writes the answer and the tally in Arabic numerals', async () => {
      const user = setupUser();
      await openIn(user, /Berhitung/);

      await user.click(screen.getByRole('button', { name: objectName(1) }));

      expect(screen.getByLabelText('Jumlahnya 1')).toHaveTextContent('١');
      expect(screen.getByText(/ada ١ apel/)).toBeInTheDocument();
    });

    it('says the number in Arabic, and keeps the instruction in Indonesian', async () => {
      const user = setupUser();
      await openIn(user, /Berhitung/);

      expect(spokenTexts).toContain('Ayo hitung!');
      await user.click(screen.getByRole('button', { name: objectName(1) }));

      expect(spokenTexts).toContain('wahid!');
    });

    it('stamps each counted object with its Arabic numeral and says each in turn', async () => {
      const user = setupUser();
      await openIn(user, /Berhitung/);
      await user.click(screen.getByRole('button', { name: objectName(1) }));
      await user.click(screen.getByRole('button', { name: 'Lanjut ke angka 2' }));

      const objects = screen.getAllByRole('button', { name: objectName(2) });
      spokenTexts.length = 0;
      await user.click(objects[0]);
      expect(spokenTexts).toContain('wahid');
      await user.click(objects[1]);
      expect(spokenTexts).toContain('itsnan!');

      const counted = screen.getAllByRole('button', { name: /sudah dihitung/ });
      expect(counted.map((b) => b.textContent)).toEqual(['١', '٢']);
    });

    it('says all ten in Arabic', async () => {
      const user = setupUser();
      await openIn(user, /Berhitung/);

      for (let n = 1; n <= 10; n += 1) {
        const objects = screen.getAllByRole('button', { name: objectName(n) });
        spokenTexts.length = 0;
        for (const object of objects) await user.click(object);

        expect(spokenTexts, `round ${n}`).toContain(`${ARABIC_NUMBER_NAMES[n]}!`);
        if (n < 10) await user.click(screen.getByRole('button', { name: `Lanjut ke angka ${n + 1}` }));
      }
    }, 30000);

    it('puts the Arabic numeral on the celebration', async () => {
      const user = setupUser();
      await openIn(user, /Berhitung/);
      await user.click(screen.getByRole('button', { name: objectName(1) }));

      expect(screen.getByTestId('celebration')).toHaveTextContent('١');
    });

    it('is unchanged in Latin', async () => {
      const user = setupUser();
      render(<App />);
      await openCard(user, /Berhitung/);
      await user.click(screen.getByRole('button', { name: objectName(1) }));

      expect(screen.getByLabelText('Jumlahnya 1')).toHaveTextContent('1');
      expect(spokenTexts).toContain('satu!');
    });
  });

  describe('Labirin', () => {
    const choose = (user: User, name: 'Huruf' | 'Angka') => user.click(screen.getByRole('button', { name }));

    async function enter(user: User, choice: 'Huruf' | 'Angka') {
      await openIn(user, /Labirin/);
      await choose(user, choice);
      const kind: MazeKind = choice === 'Huruf' ? 'letters' : 'numbers';
      const level = MAZE_LEVELS[0];
      return { kind, level, maze: buildMaze(level, kind, 'arab') };
    }

    it('lines a letter maze with hijaiyah', async () => {
      const user = setupUser();
      const { kind, maze } = await enter(user, 'Huruf');

      expect(screen.getByText('Ketuk ا untuk mulai')).toBeInTheDocument();
      expect(tile(kind, 'ا')).toHaveAccessibleName('Huruf ا, ketuk untuk mulai');
      expect(screen.getByRole('list', { name: 'Urutan' })).toHaveTextContent('ابتث');
      expect(tile(kind, 'ا')).toHaveAttribute('lang', 'ar');
      expect(maze.route).toHaveLength(MAZE_LEVELS[0].length);
    });

    it('lines a number maze with Arabic numerals', async () => {
      const user = setupUser();
      const { kind } = await enter(user, 'Angka');

      expect(tile(kind, '١')).toHaveAccessibleName('Angka ١, ketuk untuk mulai');
      expect(screen.getByRole('list', { name: 'Urutan' })).toHaveTextContent('١٢٣٤');
    });

    it('puts only Arabic on every tile, dead ends included - never a mixture', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');

      for (const t of screen.getAllByRole('button', { name: /^Huruf / })) {
        const label = t.getAttribute('aria-label')!.replace(/^Huruf /, '').split(',')[0];
        expect(label, 'a Latin letter on an Arabic maze').toMatch(/^[ء-ي]$/);
      }
    });

    it('says the instruction with Arabic letter names', async () => {
      const user = setupUser();
      await enter(user, 'Huruf');

      // alif, ba, ta, tsa: the first four hijaiyah.
      expect(spokenTexts).toContain('Ikuti huruf dari alif sampai tsa!');
    });

    it('says the instruction with Arabic number names', async () => {
      const user = setupUser();
      await enter(user, 'Angka');

      expect(spokenTexts).toContain("Ikuti angka dari wahid sampai arba'ah!");
    });

    it('speaks each tile by its Arabic name as the animal steps on it', async () => {
      const user = setupUser();
      const { kind, maze } = await enter(user, 'Huruf');
      await user.click(tile(kind, labelAt(maze, maze.route[0])));

      spokenTexts.length = 0;
      await user.click(tile(kind, labelAt(maze, maze.route[1])));
      expect(spokenTexts).toContain('ba');
    });

    it('can be played from the first tile to the treat, with the cheer', async () => {
      const user = setupUser();
      const { kind, maze } = await enter(user, 'Angka');

      for (let i = 0; i < maze.route.length; i += 1) {
        await user.click(tile(kind, labelAt(maze, maze.route[i])));
      }

      expect(screen.getByTestId('celebration')).toBeInTheDocument();
      expect(spokenTexts).toContain("arba'ah! Hore, sampai!");
    });

    it('names what to look for in Arabic after a wrong tap', async () => {
      const user = setupUser();
      // Level 2 (letters) has a dead end beside its very first tile.
      await openIn(user, /Labirin/);
      await choose(user, 'Huruf');
      const first = buildMaze(MAZE_LEVELS[0], 'letters', 'arab');
      for (const p of first.route) await user.click(tile('letters', labelAt(first, p)));
      await user.click(screen.getByRole('button', { name: 'Labirin berikutnya' }));

      const maze = buildMaze(MAZE_LEVELS[1], 'letters', 'arab');
      await user.click(tile('letters', labelAt(maze, maze.route[0])));

      let decoy: Position | undefined;
      for (let i = 0; i < maze.cells.length; i += 1) {
        const p = { row: Math.floor(i / maze.cols), col: i % maze.cols };
        if (maze.cells[i].type === 'decoy' && areNeighbours(maze.route[0], p)) decoy = p;
      }
      expect(decoy, 'level 2 should have a dead end beside the start').toBeDefined();

      spokenTexts.length = 0;
      await user.click(tile('letters', labelAt(maze, decoy!)));

      // Next after alif is ba.
      expect(spokenTexts).toContain('Cari huruf ba!');
    });

    it('can change the script on the choosing screen, before a maze begins', async () => {
      const user = setupUser();
      render(<App />);
      await openCard(user, /Labirin/);
      await setScript(user, 'Arab');
      await choose(user, 'Huruf');

      expect(screen.getByText('Ketuk ا untuk mulai')).toBeInTheDocument();
    });

    it('is unchanged in Latin', async () => {
      const user = setupUser();
      render(<App />);
      await openCard(user, /Labirin/);
      await choose(user, 'Huruf');

      expect(screen.getByText('Ketuk A untuk mulai')).toBeInTheDocument();
      expect(spokenTexts).toContain('Ikuti huruf dari a sampai de!');
    });
  });

  describe('Belajar Bicara', () => {
    const card = (n: number) => ARABIC_WORD_CARDS[n];
    const next = (user: User) => user.click(screen.getByRole('button', { name: 'Kata berikutnya' }));

    it('opens on the first Arabic card: the letter, a picture and the word', async () => {
      const user = setupUser();
      await openIn(user, /Belajar Bicara/);

      expect(screen.getByRole('button', { name: /^Dengarkan kata أَرْنَب \(Kelinci\)/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dengarkan huruf ا (Alif)' })).toBeInTheDocument();
      expect(screen.getByText('1 dari 28 — Kelinci')).toBeInTheDocument();
      // For the grown-up who does not read Arabic.
      expect(screen.getByText('Arnab · Kelinci')).toBeInTheDocument();
    });

    it('goes through all 28 cards, each word with its own letter, and round again', async () => {
      const user = setupUser();
      await openIn(user, /Belajar Bicara/);

      for (let n = 0; n < ARABIC_WORD_CARDS.length; n += 1) {
        const letter = HIJAIYAH[n];
        expect(
          screen.getByRole('button', { name: `Dengarkan kata ${card(n).word} (${card(n).meaning})` }),
          card(n).letterId,
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: `Dengarkan huruf ${letter.glyph} (${letter.title})` }),
        ).toBeInTheDocument();
        await next(user);
      }
      expect(screen.getByText('1 dari 28 — Kelinci')).toBeInTheDocument();
    });

    it('says the word in Arabic when the device has an Arabic voice, and the letter in Arabic too', async () => {
      installVoice('Test Arabic', 'ar-SA');
      const user = setupUser();
      await openIn(user, /Belajar Bicara/);
      spokenUtterances.length = 0;

      await user.click(screen.getByRole('button', { name: /^Dengarkan kata/ }));
      await user.click(screen.getByRole('button', { name: /^Dengarkan huruf/ }));

      expect(spokenUtterances.map((u) => `${u.lang}|${u.text}`)).toEqual(['ar-SA|أَرْنَب', 'ar-SA|ألف']);
    });

    it('says the Indonesian spelling when it has none', async () => {
      const user = setupUser();
      await openIn(user, /Belajar Bicara/);
      spokenUtterances.length = 0;

      await user.click(screen.getByRole('button', { name: /^Dengarkan kata/ }));

      expect(spokenUtterances).toEqual([{ text: 'arnab', lang: 'id-ID', voice: 'Test Indonesian' }]);
    });

    it('uses a recording of the word when there is one', async () => {
      setMediaManifest({ audio: ['words/ar/alif.mp3'], images: [] });
      const user = setupUser();
      await openIn(user, /Belajar Bicara/);
      spokenUtterances.length = 0;

      await user.click(screen.getByRole('button', { name: /^Dengarkan kata/ }));

      expect(playedClips).toContain('media/audio/words/ar/alif.mp3');
      expect(spokenUtterances).toEqual([]);
    });

    it('uses your own picture when there is one, instead of the drawing', async () => {
      setMediaManifest({ audio: [], images: ['words/ar/alif.png'] });
      const user = setupUser();
      await openIn(user, /Belajar Bicara/);

      expect(document.querySelector('img[src="media/images/words/ar/alif.png"]')).not.toBeNull();
    });

    it('shows a drawing for every card, including the four with no lucide icon', async () => {
      const user = setupUser();
      await openIn(user, /Belajar Bicara/);

      for (let n = 0; n < ARABIC_WORD_CARDS.length; n += 1) {
        const button = screen.getByRole('button', { name: /^Dengarkan kata/ });
        expect(button.querySelector('svg'), card(n).letterId).not.toBeNull();
        await next(user);
      }
    });

    it('starts over when the script is switched, and Latin keeps its own cards', async () => {
      const user = setupUser();
      await openIn(user, /Belajar Bicara/);
      await next(user);
      await next(user);
      expect(screen.getByText(/^3 dari 28/)).toBeInTheDocument();

      await setScript(user, 'Latin');
      expect(screen.getByText(/^1 dari 26/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dengarkan huruf A' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dengarkan kata Apel/ })).toBeInTheDocument();
    });

    it('counts different Arabic cards towards leaving, like the Latin ones', async () => {
      const user = setupUser();
      await openIn(user, /Belajar Bicara/);

      for (let i = 0; i < 5; i += 1) {
        await user.click(screen.getByRole('button', { name: /^Dengarkan kata/ }));
        await next(user);
      }
      expect(screen.getByRole('button', { name: 'Kembali ke menu utama' })).not.toHaveAttribute('data-locked');
    });
  });

  describe('what is deliberately left alone', () => {
    it('Kasir keeps writing Rupiah with Western digits', async () => {
      const user = setupUser();
      await openIn(user, /Kasir/);

      const customer = screen.getByRole('region', { name: 'Pembeli' });
      expect(customer).toHaveTextContent('Rp 1.500');
      expect(customer.textContent).not.toMatch(/[٠-٩]/);
    });
  });

  describe('the media check page', () => {
    it('lists the Arabic letters and numbers as slots to record', () => {
      setMediaManifest({ audio: [], images: [] });
      render(<MediaCheckScreen onBack={() => {}} />);

      expect(screen.getByText('Nama huruf - Arab (hijaiyah)').closest('summary')).toHaveTextContent('0 / 28');
      expect(screen.getByText('Angka - Arab').closest('summary')).toHaveTextContent('0 / 10');
    });

    it('counts a recording of an Arabic name, and does not call it a mistake', () => {
      setMediaManifest({ audio: ['letters/ar/alif.mp3', 'letters/ar/ha-2.mp3', 'numbers/ar/3.mp3'], images: [] });
      render(<MediaCheckScreen onBack={() => {}} />);

      expect(screen.getByText('Nama huruf - Arab (hijaiyah)').closest('summary')).toHaveTextContent('2 / 28');
      expect(screen.getByText('Angka - Arab').closest('summary')).toHaveTextContent('1 / 10');
      expect(screen.queryByRole('region', { name: 'Berkas bermasalah' })).not.toBeInTheDocument();
    });

    it('tells the recorder which of the two "ha" letters a slot is for', () => {
      setMediaManifest({ audio: [], images: [] });
      render(<MediaCheckScreen onBack={() => {}} />);

      expect(screen.getByText('Huruf ح (Ha)')).toBeInTheDocument();
      expect(screen.getByText('Huruf ه (Ha (kedua))')).toBeInTheDocument();
    });
  });
});

describe('a native Arabic voice', () => {
  const utterances = () => spokenUtterances.map((u) => `${u.lang}|${u.text}`);

  describe('on a device that has one', () => {
    beforeEach(() => {
      installVoice('Test Indonesian', 'id-ID');
      installVoice('Test Arabic', 'ar-SA');
    });

    it('says a letter\'s name in Arabic, not in Indonesian spelling', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);
      spokenTexts.length = 0;
      spokenUtterances.length = 0;

      await user.click(screen.getByRole('button', { name: /^Dengarkan huruf ا/ }));

      expect(spokenUtterances).toEqual([{ text: 'ألف', lang: 'ar-SA', voice: 'Test Arabic' }]);
    });

    it('says every hijaiyah letter in Arabic script, by the Arabic voice', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);

      for (let i = 0; i < HIJAIYAH.length; i += 1) {
        spokenUtterances.length = 0;
        await user.click(screen.getByRole('button', { name: /^Dengarkan huruf/ }));

        expect(spokenUtterances, HIJAIYAH[i].id).toEqual([
          { text: HIJAIYAH[i].arabic, lang: 'ar-SA', voice: 'Test Arabic' },
        ]);
        await user.click(screen.getByRole('button', { name: 'Huruf berikutnya' }));
      }
    });

    it('says the counting numbers in Arabic, and the instruction in Indonesian', async () => {
      const user = setupUser();
      await openIn(user, /Berhitung/);
      spokenUtterances.length = 0;

      await user.click(screen.getAllByRole('button', { name: /^Hitung / })[0]);

      expect(utterances()).toContain('ar-SA|واحد');
      expect(utterances().some((u) => u.startsWith('ar-SA|') && u !== 'ar-SA|واحد')).toBe(false);
    });

    it('speaks the maze instruction with the Arabic names in an Arabic voice and the rest in Indonesian', async () => {
      const user = setupUser();
      await openIn(user, /Labirin/);
      spokenUtterances.length = 0;
      await user.click(screen.getByRole('button', { name: 'Huruf' }));

      const said = await waitForUtterances(4);
      expect(said.slice(0, 4)).toEqual([
        'id-ID|Ikuti huruf dari',
        'ar-SA|ألف',
        'id-ID|sampai',
        'ar-SA|ثاء',
      ]);
    });

    it('still uses a recording where there is one', async () => {
      setMediaManifest({ audio: ['letters/ar/alif.mp3'], images: [] });
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);
      spokenUtterances.length = 0;

      await user.click(screen.getByRole('button', { name: /^Dengarkan huruf ا/ }));

      expect(playedClips).toContain('media/audio/letters/ar/alif.mp3');
      expect(spokenUtterances).toEqual([]);
    });

    it('leaves Latin letters, and Indonesian words, to the Indonesian voice', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/, 'latin');
      spokenUtterances.length = 0;

      await user.click(screen.getByRole('button', { name: 'Dengarkan huruf A' }));

      expect(utterances()).toEqual(['id-ID|a']);
    });
  });

  describe('on a device that has none', () => {
    beforeEach(() => installVoice('Test Indonesian', 'id-ID'));

    it('falls back to the Indonesian spelling, which that voice reads properly', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);
      spokenUtterances.length = 0;

      await user.click(screen.getByRole('button', { name: /^Dengarkan huruf ا/ }));

      expect(spokenUtterances).toEqual([{ text: 'alif', lang: 'id-ID', voice: 'Test Indonesian' }]);
    });

    it('never sends Arabic script to an Indonesian voice', async () => {
      const user = setupUser();
      await openIn(user, /Mengenal Huruf/);
      for (let i = 0; i < 5; i += 1) {
        await user.click(screen.getByRole('button', { name: /^Dengarkan huruf/ }));
        await user.click(screen.getByRole('button', { name: 'Huruf berikutnya' }));
      }

      expect(spokenTexts.filter((t) => /[\u0600-\u06FF]/.test(t))).toEqual([]);
    });
  });
});

/** Waits until the voice queue has spoken at least `n` utterances. */
async function waitForUtterances(n: number): Promise<string[]> {
  await waitFor(() => expect(spokenUtterances.length).toBeGreaterThanOrEqual(n));
  return spokenUtterances.map((u) => `${u.lang}|${u.text}`);
}
