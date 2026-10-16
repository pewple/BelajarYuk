import { describe, expect, it } from 'vitest';
import {
  ARABIC_NUMBER_NAMES,
  HIJAIYAH,
  SCRIPTS,
  alphabetSize,
  formatNumeral,
  toArabicNumerals,
} from '../data/scripts';
import { EN_VOICE_RESPELL, respellForEnglishVoice } from '../hooks/useAudio';
import { arabicLetterClipId, arabicNumberClipId } from '../media/clips';
import { arabicLetterPart, numberPart } from '../media/scriptVoice';
import { setMediaManifest } from './setup';
import { stepsFor } from '../media/voiceParts';

describe('the hijaiyah', () => {
  it('are 28 letters', () => {
    expect(HIJAIYAH).toHaveLength(28);
  });

  it('are each a single Arabic letter, none repeated', () => {
    for (const letter of HIJAIYAH) {
      // One code point, inside the Arabic letter block (U+0621 to U+064A).
      expect([...letter.glyph]).toHaveLength(1);
      const code = letter.glyph.codePointAt(0)!;
      expect(code, `${letter.id} is outside the Arabic letters`).toBeGreaterThanOrEqual(0x0621);
      expect(code).toBeLessThanOrEqual(0x064a);
    }
    expect(new Set(HIJAIYAH.map((l) => l.glyph)).size).toBe(28);
  });

  it('begin with alif and end with ya, in the traditional order', () => {
    expect(HIJAIYAH[0]).toMatchObject({ id: 'alif', glyph: 'ا' });
    expect(HIJAIYAH[1]).toMatchObject({ id: 'ba', glyph: 'ب' });
    expect(HIJAIYAH[2]).toMatchObject({ id: 'ta', glyph: 'ت' });
    expect(HIJAIYAH[27]).toMatchObject({ id: 'ya', glyph: 'ي' });
  });

  it('have unique, filename-safe ids, so each can be recorded separately', () => {
    const ids = HIJAIYAH.map((l) => l.id);
    expect(new Set(ids).size).toBe(28);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('keep the two "ha" letters apart even though they are spoken alike', () => {
    const ha = HIJAIYAH.filter((l) => l.name === 'ha');
    expect(ha.map((l) => l.glyph).sort()).toEqual(['ح', 'ه'].sort());
    expect(new Set(ha.map((l) => l.id)).size).toBe(2);
  });

  it('all have a name to speak and a title to show', () => {
    for (const letter of HIJAIYAH) {
      expect(letter.name.trim()).not.toBe('');
      expect(letter.title.trim()).not.toBe('');
    }
  });
});

describe('Arabic-Indic numerals', () => {
  it.each([
    [0, '٠'],
    [1, '١'],
    [5, '٥'],
    [9, '٩'],
    [10, '١٠'],
    [13, '١٣'],
    [1305, '١٣٠٥'],
  ])('writes %i as %s', (n, written) => {
    expect(toArabicNumerals(n)).toBe(written);
  });

  it('leaves anything that is not a digit alone', () => {
    expect(toArabicNumerals('Rp 3.000')).toBe('Rp ٣.٠٠٠');
  });

  it('formats by script, and Latin is plain digits', () => {
    expect(formatNumeral(7, 'latin')).toBe('7');
    expect(formatNumeral(7, 'arab')).toBe('٧');
    expect(formatNumeral(12, 'arab')).toBe('١٢');
  });

  it('are the Arabic-Indic digits (U+0660-0669), not the Persian ones', () => {
    // ٤ ٥ ٦ look different from the Persian ۴ ۵ ۶; Arabic is what was asked for.
    for (let n = 0; n <= 9; n += 1) {
      expect(toArabicNumerals(n).codePointAt(0)).toBe(0x0660 + n);
    }
  });

  it('have a name for each of 1 to 10, and none is repeated', () => {
    const names = ARABIC_NUMBER_NAMES.slice(1, 11);
    expect(names).toHaveLength(10);
    for (const name of names) expect(name.trim()).not.toBe('');
    expect(new Set(names).size).toBe(10);
  });
});

describe('the alphabets', () => {
  it('are 26 letters in Latin and 28 in Arabic', () => {
    expect(alphabetSize('latin')).toBe(26);
    expect(alphabetSize('arab')).toBe(28);
  });

  it('are the only two scripts', () => {
    expect(SCRIPTS).toEqual(['latin', 'arab']);
  });
});

describe('saying them', () => {
  it('says a Latin number as before, and an Arabic one in Arabic', () => {
    expect(numberPart(3, 'latin')).toEqual({ clip: 'numbers/3', text: 'tiga' });
    expect(numberPart(3, 'arab')).toEqual({
      clip: 'numbers/ar/3',
      text: 'tsalatsah',
      native: { text: 'ثلاثة', lang: 'ar-SA' },
    });
  });

  it('says an Arabic letter by its name', () => {
    expect(arabicLetterPart(HIJAIYAH[1])).toEqual({
      clip: 'letters/ar/ba',
      text: 'ba',
      native: { text: 'باء', lang: 'ar-SA' },
    });
  });

  it('looks recordings up under their own folders, apart from the Latin ones', () => {
    expect(arabicLetterClipId('alif')).toBe('letters/ar/alif');
    expect(arabicNumberClipId(7)).toBe('numbers/ar/7');
  });

  it('uses a recording for an Arabic name when one exists, and speech when not', () => {
    expect(stepsFor([arabicLetterPart(HIJAIYAH[0])])).toEqual([
      { kind: 'tts', text: 'alif', opts: undefined, native: { text: 'ألف', lang: 'ar-SA' } },
    ]);

    setMediaManifest({ audio: ['letters/ar/alif.mp3', 'numbers/ar/2.mp3'], images: [] });
    expect(stepsFor([arabicLetterPart(HIJAIYAH[0])])).toEqual([
      { kind: 'clip', url: 'media/audio/letters/ar/alif.mp3' },
    ]);
    expect(stepsFor([numberPart(2, 'arab')])).toEqual([
      { kind: 'clip', url: 'media/audio/numbers/ar/2.mp3' },
    ]);
  });
});

describe('without an Indonesian voice', () => {
  it('respells every Arabic letter and number name for an English voice', () => {
    const names = [...HIJAIYAH.map((l) => l.name), ...ARABIC_NUMBER_NAMES.slice(1)];
    const missing = names.filter((name) => respellForEnglishVoice(name) === null);

    expect(missing, `no English-voice spelling for: ${missing.join(', ')}`).toEqual([]);
  });

  it('respells a name to something an English voice can read', () => {
    expect(EN_VOICE_RESPELL.alif).toBe('ah-leef');
    expect(respellForEnglishVoice('tsalatsah!')).toBe('tsah-lah-tsah!');
  });
});
