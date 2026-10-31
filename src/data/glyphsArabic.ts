import { A, C, L, M, dot } from './strokeDsl';
import type { StrokeDef } from './strokeDsl';

/**
 * The strokes of the Arabic glyphs: the 28 hijaiyah in their isolated form, and
 * the Arabic-Indic digits.
 *
 * Arabic is written from right to left, so every stroke begins at its right-hand
 * end. The body of a letter is written first and its dots last, which is how a
 * child is taught them. The shapes are plain, upright copybook forms - the
 * letters as an Iqra' primer draws them - rather than calligraphy. They were
 * drawn by hand against a system Arabic typeface and have not been checked by a
 * writer of Arabic: see the README before relying on them.
 *
 * Each glyph is drawn to fill the board, as the tracing glyphs of the other
 * scripts do, rather than at its natural size next to its neighbours. A glyph
 * is named by the character itself, which is also its key here.
 */

export const ARABIC_GLYPH_STROKES: Record<string, StrokeDef[]> = {
  // Hijaiyah, in the traditional order.
  'ا': [[M(50, 8), L(50, 92)]],

  // The bowls: ba, ta, tsa - one shape, with one, two and three dots.
  'ب': [[M(90, 26), C(90, 48, 76, 56, 52, 56), C(28, 56, 14, 50, 10, 36)], dot(50, 74)],
  'ت': [[M(90, 44), C(90, 66, 76, 74, 52, 74), C(28, 74, 14, 68, 10, 54)], dot(60, 24), dot(40, 24)],
  'ث': [[M(90, 54), C(90, 76, 76, 84, 52, 84), C(28, 84, 14, 78, 10, 64)], dot(62, 36), dot(38, 36), dot(50, 18)],

  // The hooks: jim, ha, kho - one shape, with a dot inside, none, a dot above.
  'ج': [[M(68, 24), C(58, 14, 40, 12, 25, 17)], [M(68, 24), C(46, 32, 28, 48, 27, 64), C(26, 80, 44, 86, 62, 86), C(70, 86, 76, 84, 80, 80)], dot(54, 56)],
  'ح': [[M(68, 24), C(58, 14, 40, 12, 25, 17)], [M(68, 24), C(46, 32, 28, 48, 27, 64), C(26, 80, 44, 86, 62, 86), C(70, 86, 76, 84, 80, 80)]],
  'خ': [[M(68, 36), C(59, 28, 42, 26, 27, 30)], [M(68, 36), C(48, 43, 30, 56, 29, 69), C(28, 82, 44, 88, 62, 88), C(70, 88, 76, 86, 80, 83)], dot(48, 12)],

  // Dal and dzal: a neck coming down to a long base.
  'د': [[M(41, 10), C(60, 24, 76, 44, 75, 64), C(74, 80, 56, 84, 36, 83), C(28, 83, 22, 80, 20, 76)]],
  'ذ': [[M(42, 32), C(58, 44, 72, 60, 70, 74), C(68, 88, 46, 90, 32, 85)], dot(46, 13)],

  // Ra and zay: a hook that sweeps down to the left.
  'ر': [[M(66, 10), C(76, 40, 64, 72, 28, 90)]],
  'ز': [[M(66, 30), C(74, 54, 62, 78, 28, 92)], dot(46, 14)],

  // Sin and syin: teeth, then a bowl.
  'س': [[M(90, 44), C(86, 28, 74, 28, 70, 44), C(66, 28, 54, 28, 50, 44), C(46, 28, 34, 28, 30, 44), C(26, 76, 10, 76, 8, 52)]],
  'ش': [[M(90, 52), C(86, 36, 74, 36, 70, 52), C(66, 36, 54, 36, 50, 52), C(46, 36, 34, 36, 30, 52), C(26, 84, 10, 84, 8, 60)], dot(68, 22), dot(48, 22), dot(58, 8)],

  // Shad and dhad: a loop and a tail.
  'ص': [[A(70, 40, 18, 14, -90, -450)], [M(60, 52), C(44, 62, 26, 68, 10, 60)]],
  'ض': [[A(70, 48, 18, 14, -90, -450)], [M(60, 60), C(44, 70, 26, 76, 10, 68)], dot(68, 18)],

  // Tha and zha: a loop, a tail along the bottom, and a tall stem standing on the tail.
  'ط': [[A(72, 66, 20, 17, -90, -450)], [M(72, 83), L(10, 83)], [M(28, 8), L(28, 78)]],
  'ظ': [[A(72, 66, 20, 17, -90, -450)], [M(72, 83), L(10, 83)], [M(28, 12), L(28, 78)], dot(54, 28)],

  // Ain and ghain: a small hook, then a bowl that sweeps away to the left.
  'ع': [[M(80, 14), C(64, 6, 46, 12, 48, 26), C(50, 36, 64, 34, 68, 42), C(76, 56, 70, 78, 50, 84), C(32, 88, 16, 80, 10, 66)]],
  'غ': [[M(80, 26), C(64, 20, 46, 24, 48, 36), C(50, 45, 64, 43, 68, 51), C(76, 64, 70, 82, 50, 86), C(32, 90, 16, 82, 10, 70)], dot(60, 10)],

  // Fa and qaf: a head with a tail that droops to the left.
  'ف': [[A(74, 38, 14, 13, -90, -450)], [M(88, 46), L(88, 64), C(88, 80, 74, 86, 56, 86), L(24, 86), C(14, 86, 10, 80, 10, 70)], dot(74, 16)],
  'ق': [[A(74, 42, 14, 12, -90, -450)], [M(88, 48), L(88, 62), C(88, 92, 46, 94, 16, 78)], dot(80, 16), dot(62, 16)],

  // Kaf: a tall stroke, a base and a little mark.
  'ك': [[M(84, 8), L(84, 62), C(84, 78, 74, 84, 58, 84), L(14, 84)], [M(50, 36), L(32, 52), L(52, 62)]],

  // Lam: a tall stroke that curves round into a tail.
  'ل': [[M(84, 8), L(84, 62), C(84, 82, 66, 90, 40, 88), C(26, 87, 16, 82, 10, 74)]],

  // Mim: a head, and a tail that sweeps down to the left.
  'م': [[A(66, 30, 18, 16, -90, -450)], [M(66, 46), C(68, 68, 54, 86, 26, 90)]],

  // Nun: a deep bowl with a dot above.
  'ن': [[M(88, 40), A(50, 40, 38, 44, 0, 180)], dot(50, 16)],

  // Ha: two lobes.
  'ه': [[M(58, 56), C(80, 40, 74, 14, 54, 14), C(34, 14, 36, 36, 50, 46), C(30, 48, 22, 68, 38, 82), C(58, 92, 78, 74, 58, 56)]],

  // Waw: a head, and a tail that curves down to the left.
  'و': [[A(68, 30, 18, 16, -90, -450)], [M(68, 46), C(70, 70, 56, 88, 26, 92)]],

  // Ya: a bowl whose tail runs to the left and curls up, with two dots below.
  'ي': [[M(88, 22), C(88, 46, 78, 58, 56, 58), C(36, 58, 22, 56, 12, 40)], dot(62, 76), dot(40, 76)],

  // The Arabic-Indic digits, 0 to 9. Zero is a dot: tap it.
  '٠': [dot(50, 50)],
  '١': [[M(50, 10), L(50, 90)]],
  // Two is a hook like a capital gamma; six is a seven with a curved stem. Three
  // is a long stem with a wave of two teeth beside it.
  '٢': [[M(70, 11), L(36, 11), L(40, 91)]],
  '٣': [[M(27, 9), L(34, 91)], [M(34, 33), C(40, 37, 45, 35, 46, 28), L(46, 10)], [M(47, 34), C(56, 40, 70, 38, 74, 30), L(74, 10)]],
  '٤': [[M(58, 10), C(34, 24, 32, 40, 46, 46), C(64, 52, 72, 66, 62, 78), C(54, 88, 40, 90, 28, 86)]],
  '٥': [[A(50, 50, 28, 32, -90, -450)]],
  '٦': [[M(24, 13), L(62, 13), C(64, 40, 70, 70, 76, 92)]],
  '٧': [[M(24, 12), L(50, 90), L(76, 12)]],
  '٨': [[M(24, 90), L(50, 12), L(76, 90)]],
  '٩': [[A(46, 32, 20, 21, 0, -360), C(66, 52, 70, 74, 78, 92)]],
};
