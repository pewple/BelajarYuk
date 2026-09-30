import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { installVoice, spokenTexts, playedToneCounts } from './setup';
import {
  ALPHABET,
  COUNTING_SETS,
  WORD_CARDS,
} from '../data/curriculum';
import {
  COUNT_PROMPT_ID,
  GREETING_ID,
  LETTER_NAMES_EN,
  LETTER_NAMES_ID,
  PRAISE_ID,
  numberWordId,
} from '../hooks/useAudio';

/** Exact accessible name of a countable object in the given round (1-based). */
function objectName(round: number): RegExp {
  const { label } = COUNTING_SETS[(round - 1) % COUNTING_SETS.length];
  return new RegExp(`^Hitung ${label}$`);
}

async function openCounting(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Berhitung/ }));
}

describe('Belajar Yuk!', () => {
  // These tests are about *what* the app says, so they run on a device that
  // has an Indonesian voice and speaks the words as written. The separate
  // phonetic fallback for devices without one lives in pronunciation.test.tsx.
  beforeEach(() => installVoice('Test Indonesian', 'id-ID'));

  it('mounts and shows the three lesson choices', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mengenal Huruf/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Belajar Bicara/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Berhitung/ })).toBeInTheDocument();
  });

  it('greets with "Belajar Yuk!" once the page has had its first gesture', async () => {
    const user = userEvent.setup();
    render(<App />);

    // A cold load cannot play audio until the browser has seen a gesture, so
    // the greeting is armed rather than fired on mount.
    expect(spokenTexts).not.toContain(GREETING_ID);

    await user.click(screen.getByRole('heading', { name: 'Belajar Yuk!' }));

    await waitFor(() => expect(spokenTexts).toContain(GREETING_ID));
  });

  it('returns to the menu from a lesson screen', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));
    await user.click(screen.getByRole('button', { name: 'Kembali ke menu utama' }));

    expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
  });

  describe('Mengenal Huruf', () => {
    it('speaks the Indonesian letter name when the big letter is tapped', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));
      await user.click(screen.getByRole('button', { name: 'Dengarkan huruf A' }));

      expect(spokenTexts).toContain(LETTER_NAMES_ID.A);
    });

    it('switches to English letter names when the toggle is set to EN', async () => {
      // Picked from the tables rather than hardcoded: the letter spellings
      // get hand-tuned, and some letters are deliberately identical in both
      // languages. Any letter that still differs proves the toggle works.
      const index = ALPHABET.findIndex((l) => LETTER_NAMES_ID[l] !== LETTER_NAMES_EN[l]);
      expect(index, 'no letter differs between the two tables').toBeGreaterThanOrEqual(0);
      const letter = ALPHABET[index];

      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));
      for (let i = 0; i < index; i += 1) {
        await user.keyboard('{ArrowRight}');
      }

      await user.click(screen.getByRole('button', { name: `Dengarkan huruf ${letter}` }));
      expect(spokenTexts).toContain(LETTER_NAMES_ID[letter]);

      await user.click(screen.getByRole('radio', { name: /English/ }));
      await user.click(screen.getByRole('button', { name: `Dengarkan huruf ${letter}` }));

      expect(spokenTexts).toContain(LETTER_NAMES_EN[letter]);
    });

    it('navigates with the keyboard arrow keys', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));
      expect(screen.getByRole('button', { name: 'Dengarkan huruf A' })).toBeInTheDocument();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', { name: 'Dengarkan huruf B' })).toBeInTheDocument();

      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('button', { name: 'Dengarkan huruf A' })).toBeInTheDocument();

      // Wraps backwards to the end of the alphabet.
      await user.keyboard('{ArrowLeft}');
      const last = ALPHABET[ALPHABET.length - 1];
      expect(screen.getByRole('button', { name: `Dengarkan huruf ${last}` })).toBeInTheDocument();
    });
  });

  describe('Belajar Bicara', () => {
    it('covers every letter of the alphabet exactly once', () => {
      expect(WORD_CARDS.map((c) => c.letter)).toEqual(ALPHABET);
    });

    it('pairs a letter with a familiar word and speaks each separately', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /Belajar Bicara/ }));

      const first = WORD_CARDS[0];
      await user.click(screen.getByRole('button', { name: `Dengarkan kata ${first.word}` }));
      expect(spokenTexts).toContain(first.word);

      await user.click(screen.getByRole('button', { name: `Dengarkan huruf ${first.letter}` }));
      expect(spokenTexts).toContain(LETTER_NAMES_ID[first.letter]);
    });

    it('keeps the arrows clickable after the card has been tapped', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /Belajar Bicara/ }));

      // Tapping the card leaves a pulse ring behind. It must not intercept
      // the taps aimed at the arrows beside it.
      await user.click(screen.getByRole('button', { name: `Dengarkan kata ${WORD_CARDS[0].word}` }));
      await user.click(screen.getByRole('button', { name: 'Kata berikutnya' }));

      expect(
        screen.getByRole('button', { name: `Dengarkan kata ${WORD_CARDS[1].word}` }),
      ).toBeInTheDocument();
    });

    it('navigates with the keyboard arrow keys', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: /Belajar Bicara/ }));

      await user.keyboard('{ArrowRight}');
      expect(
        screen.getByRole('button', { name: `Dengarkan kata ${WORD_CARDS[1].word}` }),
      ).toBeInTheDocument();

      await user.keyboard('{ArrowLeft}');
      expect(
        screen.getByRole('button', { name: `Dengarkan kata ${WORD_CARDS[0].word}` }),
      ).toBeInTheDocument();
    });
  });

  describe('Berhitung', () => {
    it('gives the spoken instruction when a round starts', async () => {
      const user = userEvent.setup();
      await openCounting(user);

      expect(spokenTexts).toContain(COUNT_PROMPT_ID);
    });

    it('counts one object, announces the total and celebrates', async () => {
      const user = userEvent.setup();
      await openCounting(user);

      // Round 1 has a single object; tapping it completes the round.
      const objects = screen.getAllByRole('button', { name: objectName(1) });
      expect(objects).toHaveLength(1);

      await user.click(objects[0]);

      expect(spokenTexts).toContain(`${numberWordId(1)}!`);
      expect(screen.getByTestId('celebration')).toBeInTheDocument();
      expect(playedToneCounts.value).toBeGreaterThan(0);
      expect(screen.getByLabelText('Jumlahnya 1')).toHaveTextContent('1');
    });

    it('queues praise after the total so neither is cut off', async () => {
      const user = userEvent.setup();
      await openCounting(user);

      await user.click(screen.getAllByRole('button', { name: objectName(1) })[0]);

      const total = `${numberWordId(1)}!`;
      // The praise only starts once the total has finished, so wait for it.
      await waitFor(() =>
        expect(spokenTexts.some((t) => (PRAISE_ID as readonly string[]).includes(t))).toBe(true),
      );

      const totalAt = spokenTexts.indexOf(total);
      const praiseAt = spokenTexts.findIndex((t) => (PRAISE_ID as readonly string[]).includes(t));

      expect(totalAt).toBeGreaterThanOrEqual(0);
      expect(praiseAt).toBeGreaterThan(totalAt);
    });

    it('speaks the running count on every tap before the last', async () => {
      const user = userEvent.setup();
      await openCounting(user);

      await user.click(screen.getAllByRole('button', { name: objectName(1) })[0]);
      await user.click(screen.getByRole('button', { name: 'Lanjut ke angka 2' }));

      const objects = screen.getAllByRole('button', { name: objectName(2) });
      await user.click(objects[0]);
      expect(spokenTexts).toContain(numberWordId(1));

      await user.click(objects[1]);
      expect(spokenTexts).toContain(`${numberWordId(2)}!`);
    });

    it('advances to the next number and grows the set', async () => {
      const user = userEvent.setup();
      await openCounting(user);

      await user.click(screen.getAllByRole('button', { name: objectName(1) })[0]);
      await user.click(screen.getByRole('button', { name: 'Lanjut ke angka 2' }));

      expect(screen.getAllByRole('button', { name: objectName(2) })).toHaveLength(2);
      expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
    });

    it('repeats the instruction when the round is reset', async () => {
      const user = userEvent.setup();
      await openCounting(user);

      await user.click(screen.getAllByRole('button', { name: objectName(1) })[0]);
      spokenTexts.length = 0;

      await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));

      expect(spokenTexts).toContain(COUNT_PROMPT_ID);
      expect(screen.getByLabelText('Ada berapa?')).toHaveTextContent('?');
    });
  });
});
