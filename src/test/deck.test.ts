import { describe, expect, it } from 'vitest';
import { ARABIC_WORD_CARDS, arabicWordPictureId } from '../data/arabicWords';
import { HIJAIYAH } from '../data/scripts';
import { respellForEnglishVoice } from '../audio/respell';
import { arabicWordClipId } from '../media/clips';
import { arabicWordPart } from '../media/scriptVoice';
import { buildSlots, slotIds } from '../media/slots';
import { stepsFor } from '../media/voiceParts';

/** Vowel marks and other combining signs, which sit on top of or under the letters. */
const MARKS = /[ً-ٰٟ]/g;

/** Hamza forms of alif are written أ إ آ; for finding a word's first letter they are alif. */
const base = (ch: string) => (/[أإآ]/.test(ch) ? 'ا' : ch);

describe('the Arabic word deck', () => {
  it('has one card for each hijaiyah letter, in the same order', () => {
    expect(ARABIC_WORD_CARDS.map((c) => c.letterId)).toEqual(HIJAIYAH.map((h) => h.id));
    expect(ARABIC_WORD_CARDS).toHaveLength(28);
  });

  it('begins every word with its own letter', () => {
    for (const [i, card] of ARABIC_WORD_CARDS.entries()) {
      const first = base([...card.word.replace(MARKS, '')][0]);
      expect(first, `${card.letterId}: ${card.word}`).toBe(HIJAIYAH[i].glyph);
    }
  });

  it('writes every word in Arabic letters, with its vowel marks', () => {
    for (const card of ARABIC_WORD_CARDS) {
      expect(card.word, card.letterId).toMatch(/^[ء-يً-ّٰٟ]+$/);
      expect(card.word, card.letterId).toMatch(MARKS);
    }
  });

  it('gives the grown-up a reading and a meaning for each, and uses no word twice', () => {
    for (const card of ARABIC_WORD_CARDS) {
      expect(card.translit.trim(), card.letterId).not.toBe('');
      expect(card.meaning.trim(), card.letterId).not.toBe('');
      expect(card.say.trim(), card.letterId).not.toBe('');
    }
    expect(new Set(ARABIC_WORD_CARDS.map((c) => c.word)).size).toBe(28);
    expect(new Set(ARABIC_WORD_CARDS.map((c) => c.meaning)).size).toBe(28);
  });

  it('draws every card, including the ones lucide has no icon for', () => {
    for (const card of ARABIC_WORD_CARDS) expect(card.icon, card.letterId).toBeTruthy();
  });

  it('can be said by an English voice too, when there is no Indonesian one', () => {
    const missing = ARABIC_WORD_CARDS.filter((c) => respellForEnglishVoice(c.say) === null).map((c) => c.say);
    expect(missing).toEqual([]);
  });

  it('is spoken in Arabic by an Arabic voice, with the spelling as the stand-in', () => {
    const card = ARABIC_WORD_CARDS[0];
    expect(arabicWordPart(card)).toEqual({
      clip: 'words/ar/alif',
      text: 'arnab',
      native: { text: 'أَرْنَب', lang: 'ar-SA' },
    });
    expect(stepsFor([arabicWordPart(card)])[0]).toMatchObject({ kind: 'tts', text: 'arnab' });
  });

  it('can be recorded and illustrated, each card under its own letter\'s name', () => {
    const catalogue = buildSlots();
    const audio = slotIds(catalogue.audio);
    const images = slotIds(catalogue.images);

    for (const card of ARABIC_WORD_CARDS) {
      expect(audio.has(arabicWordClipId(card.letterId)), card.letterId).toBe(true);
      expect(images.has(arabicWordPictureId(card.letterId)), card.letterId).toBe(true);
    }
  });
});
