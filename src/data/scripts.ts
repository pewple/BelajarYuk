/**
 * Writing systems.
 *
 * The app writes letters and numbers in Latin script, and - when a grown-up
 * switches it on - in Arabic: the 28 hijaiyah letters, and the Arabic-Indic
 * numerals. The choice is one setting for the whole app (kept in App), and
 * every module that shows a letter or a number reads from it.
 */

export type Script = 'latin' | 'arab';

export const SCRIPTS: Script[] = ['latin', 'arab'];

/* ------------------------------------------------------------------ */
/* Hijaiyah                                                            */
/* ------------------------------------------------------------------ */

export type ArabicLetter = {
  /** Stable, unique, filename-safe. Recordings are looked up by this: letters/ar/<id>. */
  id: string;
  /** The letter itself, in its isolated form. */
  glyph: string;
  /**
   * The stand-in when the device has no Arabic voice: the letter's name as
   * Indonesian children learn it in Iqra' ("alif, ba, ta, tsa..."), written so
   * an Indonesian voice reads it right. With an Arabic voice, `arabic` is used.
   */
  name: string;
  /**
   * The same name written in Arabic, for a native Arabic voice to read. Spoken
   * in preference to `name` whenever the device has an Arabic voice.
   */
  arabic: string;
  /** How the name is shown to the grown-up beside the letter. */
  title: string;
};

/**
 * The 28 hijaiyah letters, in the traditional order.
 *
 * Two of the names repeat: ح and ه are both "ha" in Indonesian teaching (the
 * first is the throaty one). They get distinct ids and titles so a recording
 * can be made for each; the spoken name is the same until one is recorded.
 */
export const HIJAIYAH: ArabicLetter[] = [
  { id: 'alif', glyph: 'ا', name: 'alif', arabic: 'ألف', title: 'Alif' },
  { id: 'ba', glyph: 'ب', name: 'ba', arabic: 'باء', title: 'Ba' },
  { id: 'ta', glyph: 'ت', name: 'ta', arabic: 'تاء', title: 'Ta' },
  { id: 'tsa', glyph: 'ث', name: 'tsa', arabic: 'ثاء', title: 'Tsa' },
  { id: 'jim', glyph: 'ج', name: 'jim', arabic: 'جيم', title: 'Jim' },
  { id: 'ha', glyph: 'ح', name: 'ha', arabic: 'حاء', title: 'Ha' },
  { id: 'kho', glyph: 'خ', name: 'kho', arabic: 'خاء', title: 'Kho' },
  { id: 'dal', glyph: 'د', name: 'dal', arabic: 'دال', title: 'Dal' },
  { id: 'dzal', glyph: 'ذ', name: 'dzal', arabic: 'ذال', title: 'Dzal' },
  { id: 'ro', glyph: 'ر', name: 'ro', arabic: 'راء', title: 'Ro' },
  { id: 'zai', glyph: 'ز', name: 'zai', arabic: 'زاي', title: 'Zai' },
  { id: 'sin', glyph: 'س', name: 'sin', arabic: 'سين', title: 'Sin' },
  { id: 'syin', glyph: 'ش', name: 'syin', arabic: 'شين', title: 'Syin' },
  { id: 'shod', glyph: 'ص', name: 'shod', arabic: 'صاد', title: 'Shod' },
  { id: 'dhod', glyph: 'ض', name: 'dhod', arabic: 'ضاد', title: 'Dhod' },
  { id: 'tho', glyph: 'ط', name: 'tho', arabic: 'طاء', title: 'Tho' },
  { id: 'zho', glyph: 'ظ', name: 'zho', arabic: 'ظاء', title: 'Zho' },
  { id: 'ain', glyph: 'ع', name: 'ain', arabic: 'عين', title: "'Ain" },
  { id: 'ghoin', glyph: 'غ', name: 'ghoin', arabic: 'غين', title: 'Ghoin' },
  { id: 'fa', glyph: 'ف', name: 'fa', arabic: 'فاء', title: 'Fa' },
  { id: 'qof', glyph: 'ق', name: 'qof', arabic: 'قاف', title: 'Qof' },
  { id: 'kaf', glyph: 'ك', name: 'kaf', arabic: 'كاف', title: 'Kaf' },
  { id: 'lam', glyph: 'ل', name: 'lam', arabic: 'لام', title: 'Lam' },
  { id: 'mim', glyph: 'م', name: 'mim', arabic: 'ميم', title: 'Mim' },
  { id: 'nun', glyph: 'ن', name: 'nun', arabic: 'نون', title: 'Nun' },
  { id: 'ha-2', glyph: 'ه', name: 'ha', arabic: 'هاء', title: 'Ha (kedua)' },
  { id: 'wau', glyph: 'و', name: 'wau', arabic: 'واو', title: 'Wau' },
  { id: 'ya', glyph: 'ي', name: 'ya', arabic: 'ياء', title: 'Ya' },
];

/* ------------------------------------------------------------------ */
/* Numerals                                                            */
/* ------------------------------------------------------------------ */

/** The Arabic-Indic digits, zero to nine. */
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** 1305 -> "١٣٠٥". Digits only; anything else passes through untouched. */
export function toArabicNumerals(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

/** A number as it is written in the chosen script. */
export function formatNumeral(value: number, script: Script): string {
  return script === 'arab' ? toArabicNumerals(value) : String(value);
}

/**
 * The names of 1 to 10 in Arabic, as Indonesian children say them.
 * Index 0 is unused: counting starts at one.
 */
export const ARABIC_NUMBER_NAMES: readonly string[] = [
  '',
  'wahid',
  'itsnan',
  'tsalatsah',
  "arba'ah",
  'khamsah',
  'sittah',
  "sab'ah",
  'tsamaniyah',
  "tis'ah",
  'asyarah',
];

/** The names of 1 to 10 written in Arabic, for a native Arabic voice. */
export const ARABIC_NUMBER_WORDS: readonly string[] = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
];

/* ------------------------------------------------------------------ */
/* Per-script facts                                                    */
/* ------------------------------------------------------------------ */

/** How many letters the alphabet has: 26 in Latin, 28 in Arabic. */
export function alphabetSize(script: Script, latinSize = 26): number {
  return script === 'arab' ? HIJAIYAH.length : latinSize;
}
