import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { installVoice, spokenUtterances } from './setup';
import {
  EN_VOICE_RESPELL,
  GREETING_ID,
  LETTER_NAMES_ID,
  NUMBER_WORDS_ID,
  PRAISE_ID,
  respellForEnglishVoice,
} from '../hooks/useAudio';
import { WORD_CARDS } from '../data/curriculum';
import { MAZE_LEVELS } from '../data/maze';
import { SPOKEN_AMOUNTS } from '../data/money';
import { arriveLine, chooseLine, hintLine, instructionLine, stepLine } from '../media/mazeVoice';
import { changeLine, paidLine, priceLine, promptLine, stepsFor, totalLine, wrongLine } from '../media/moneyVoice';

/**
 * A device with no `id-ID` voice does not fail loudly - the engine quietly
 * reads Indonesian with an English voice. These tests pin down the
 * workaround and, just as importantly, that it switches itself off the
 * moment a real Indonesian voice exists.
 */
describe('speaking Indonesian without an Indonesian voice', () => {
  describe('the respelling table', () => {
    it('covers every phrase the app speaks unprompted', () => {
      const spoken = [
        GREETING_ID,
        'Ayo hitung!',
        ...PRAISE_ID,
        ...NUMBER_WORDS_ID.slice(1, 11),
        ...WORD_CARDS.map((c) => c.word),
        ...Object.values(LETTER_NAMES_ID),
      ];

      const missing = spoken.filter((text) => respellForEnglishVoice(text) === null);
      expect(missing, `no English-voice spelling for: ${missing.join(', ')}`).toEqual([]);
    });

    it('covers every sentence the cash register can say, for every amount', () => {
      // Sentences are respelled word by word, so one missing word anywhere
      // would leave that whole sentence in plain Indonesian for an English voice.
      const sentence = (parts: Parameters<typeof stepsFor>[0]) =>
        stepsFor(parts)
          .map((step) => (step.kind === 'tts' ? step.text : ''))
          .join(' ');

      const lines = [sentence(promptLine()), sentence(wrongLine())];
      for (const amount of SPOKEN_AMOUNTS) {
        lines.push(
          sentence(priceLine(amount)),
          sentence(paidLine(amount)),
          sentence(totalLine(amount)),
          sentence(changeLine(amount)),
        );
      }

      const missing = lines.filter((line) => respellForEnglishVoice(line) === null);
      expect(missing, `no English-voice spelling for: ${missing.join(' | ')}`).toEqual([]);
    });

    it('covers every sentence the maze can say, on every level', () => {
      const textOf = (parts: Parameters<typeof stepsFor>[0]) =>
        stepsFor(parts)
          .map((step) => (step.kind === 'tts' ? step.text : ''))
          .join(' ');

      // Every level can be lined with either kind, so every level x kind.
      const sentences: string[] = [];
      for (const level of MAZE_LEVELS) {
        for (const kind of ['letters', 'numbers'] as const) {
          const last = level.from + level.length - 1;
          sentences.push(textOf(instructionLine(level, kind, 'id')), textOf(arriveLine(kind, last, 'id')));
          for (let value = level.from + 1; value <= last; value += 1) {
            sentences.push(textOf(hintLine(kind, value, 'id')), textOf(stepLine(kind, value, 'id')));
          }
        }
      }
      sentences.push(textOf(chooseLine()));

      const missing = [...new Set(sentences)].filter((line) => respellForEnglishVoice(line) === null);
      expect(missing, `no English-voice spelling for: ${missing.join(' | ')}`).toEqual([]);
    });

    it('respells a sentence only when it knows every word in it', () => {
      expect(respellForEnglishVoice('Harganya tiga ribu rupiah.')).toBe(
        `${EN_VOICE_RESPELL.harganya} ${EN_VOICE_RESPELL.tiga} ${EN_VOICE_RESPELL.ribu} ${EN_VOICE_RESPELL.rupiah}.`,
      );
      // One stranger spoils it: better an honest accent than half a respelling.
      expect(respellForEnglishVoice('Harganya tiga ribu dollar.')).toBeNull();
    });

    it('keeps trailing punctuation so an exclamation keeps its lift', () => {
      expect(respellForEnglishVoice('tiga!')).toBe(`${EN_VOICE_RESPELL.tiga}!`);
      expect(respellForEnglishVoice('tiga')).toBe(EN_VOICE_RESPELL.tiga);
    });

    it('leaves anything it does not know alone', () => {
      expect(respellForEnglishVoice('sesuatu yang lain')).toBeNull();
    });
  });

  describe('with no Indonesian voice installed', () => {
    it('respells the greeting and marks it as English', async () => {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('heading', { name: 'Belajar Yuk!' }));

      await waitFor(() => expect(spokenUtterances).not.toHaveLength(0));

      const greeting = spokenUtterances[0];
      expect(greeting.text).toBe(EN_VOICE_RESPELL['belajar yuk'] + '!');
      // Honest about what is actually speaking, rather than claiming id-ID
      // and letting the engine substitute a voice behind our back.
      expect(greeting.lang).toBe('en-US');
    });

    it('respells the counting instruction', async () => {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Berhitung/ }));

      await waitFor(() =>
        expect(spokenUtterances.some((u) => u.text.startsWith(EN_VOICE_RESPELL['ayo hitung']))).toBe(
          true,
        ),
      );
    });
  });

  describe('once an Indonesian voice is installed', () => {
    it('uses the real Indonesian spelling and that voice', async () => {
      installVoice('Microsoft Andika', 'id-ID');

      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('heading', { name: 'Belajar Yuk!' }));

      await waitFor(() => expect(spokenUtterances).not.toHaveLength(0));

      const greeting = spokenUtterances[0];
      expect(greeting.text).toBe(GREETING_ID);
      expect(greeting.lang).toBe('id-ID');
      expect(greeting.voice).toBe('Microsoft Andika');
    });

    it('speaks letter names with the proper Indonesian spelling', async () => {
      installVoice('Microsoft Andika', 'id-ID');

      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));
      await user.keyboard('{ArrowRight}'); // A -> B
      await user.click(screen.getByRole('button', { name: 'Dengarkan huruf B' }));

      await waitFor(() =>
        expect(spokenUtterances.some((u) => u.text === LETTER_NAMES_ID.B)).toBe(true),
      );
      expect(LETTER_NAMES_ID.B).toBe('be');
    });
  });

  describe('the English toggle', () => {
    it('is never touched by the Indonesian workaround', async () => {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('button', { name: /Mengenal Huruf/ }));
      await user.click(screen.getByRole('radio', { name: /English/ }));
      spokenUtterances.length = 0;
      await user.click(screen.getByRole('button', { name: 'Dengarkan huruf A' }));

      await waitFor(() => expect(spokenUtterances).not.toHaveLength(0));
      expect(spokenUtterances[0].lang).toBe('en-GB');
    });
  });
});
