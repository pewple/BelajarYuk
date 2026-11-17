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

  // Sin and syin: three teeth - the pen dips to the line and rises to a point, twice - and
  // from the third point down into a deep bowl that curls up on the left.
  'س': [[M(92, 30), C(92, 50, 89, 56, 82, 56), C(75, 56, 72, 50, 72, 34), C(72, 50, 69, 56, 62, 56), C(55, 56, 52, 50, 52, 34), C(52, 64, 46, 82, 30, 84), C(16, 85, 8, 74, 8, 56)]],
  'ش': [[M(92, 40), C(92, 60, 89, 66, 82, 66), C(75, 66, 72, 60, 72, 44), C(72, 60, 69, 66, 62, 66), C(55, 66, 52, 60, 52, 44), C(52, 74, 46, 92, 30, 94), C(16, 95, 8, 84, 8, 66)], dot(82, 24), dot(62, 24), dot(72, 10)],

  // Shad and dhad: a flat loop drawn round to the right and back, a small tooth, and then
  // the same deep bowl as sin's - all in one stroke.
  'ص': [[M(56, 52), C(70, 58, 95, 58, 95, 42), C(95, 26, 72, 24, 58, 36), C(52, 41, 50, 47, 50, 54), C(50, 48, 47, 42, 44, 40), C(44, 62, 38, 84, 24, 84), C(12, 84, 8, 72, 8, 58)]],
  'ض': [[M(56, 58), C(70, 64, 95, 64, 95, 48), C(95, 32, 72, 30, 58, 42), C(52, 47, 50, 53, 50, 60), C(50, 54, 47, 48, 44, 46), C(44, 68, 38, 90, 24, 90), C(12, 90, 8, 78, 8, 64)], dot(74, 14)],

  // Tha and zha: a wide oval sitting on the line - from where it meets the stem, over the top
  // to the right, round, and back along the bottom past the stem - and then the tall stem.
  'ط': [[M(44, 56), C(60, 42, 92, 46, 92, 68), C(92, 86, 74, 88, 56, 88), L(22, 88)], [M(36, 8), L(36, 86)]],
  'ظ': [[M(44, 56), C(60, 42, 92, 46, 92, 68), C(92, 86, 74, 88, 56, 88), L(22, 88)], [M(36, 10), L(36, 86)], dot(66, 28)],

  // Ain and ghain: a small open bowl at the top, back to a point on the right, then a big bowl
  // that bulges to the left and comes round along the bottom to finish on the right.
  'ع': [[M(78, 14), C(62, 4, 38, 8, 38, 24), C(38, 38, 54, 44, 70, 42), C(46, 46, 26, 58, 28, 74), C(30, 90, 56, 92, 80, 88)]],
  'غ': [[M(78, 24), C(62, 14, 38, 18, 38, 32), C(38, 46, 54, 50, 70, 48), C(46, 52, 26, 64, 28, 78), C(30, 92, 56, 94, 80, 90)], dot(58, 7)],

  // Fa and qaf: a head with a tail that droops to the left.
  // (fa's dot sits clear above its head, with a gap between them)
  'ف': [[A(74, 42, 13, 12, -90, -450)], [M(87, 49), L(87, 64), C(87, 80, 74, 86, 56, 86), L(24, 86), C(14, 86, 10, 80, 10, 70)], dot(74, 12)],
  'ق': [[A(74, 42, 14, 12, -90, -450)], [M(88, 48), L(88, 62), C(88, 92, 46, 94, 16, 78)], dot(80, 16), dot(62, 16)],

  // Kaf: a tall stroke and a base that curls up at its left end; inside it a little hamza:
  // a small bowl open to the right, then a short tail to the lower left.
  'ك': [[M(84, 8), L(84, 62), C(84, 80, 74, 86, 56, 86), L(30, 86), C(18, 86, 12, 78, 12, 64)], [M(60, 34), C(52, 28, 43, 32, 45, 39), C(47, 45, 54, 46, 59, 46), C(52, 48, 46, 52, 42, 58)]],

  // Lam: a tall stroke that curves round into a tail.
  'ل': [[M(84, 8), L(84, 62), C(84, 82, 66, 90, 40, 88), C(26, 87, 16, 82, 10, 74)]],

  // Mim: a round head, and from its left side a tail that drops almost straight down.
  'م': [[A(70, 31, 20, 18, -90, -450)], [M(51, 38), C(40, 52, 30, 70, 26, 92)]],

  // Nun: a deep bowl with a dot above.
  'ن': [[M(88, 40), A(50, 40, 38, 44, 0, 180)], dot(50, 16)],

  // Ha: a single teardrop loop, pointed at the top - down the right side, round the bottom,
  // and up the left side back to the point.
  'ه': [[M(42, 10), C(56, 22, 80, 44, 80, 64), C(80, 82, 66, 90, 50, 90), C(32, 90, 20, 80, 20, 64), C(20, 46, 30, 28, 42, 10)]],

  // Waw: a small round head drawn from its right side, up and over and round, and then from
  // that same right side a tail that curves down and away to the left.
  'و': [[M(88, 40), C(90, 20, 76, 10, 64, 11), C(50, 12, 44, 24, 46, 34), C(48, 46, 60, 52, 74, 50), C(82, 49, 87, 46, 88, 40), C(90, 66, 62, 88, 14, 88)]],

  // Ya: a curl at the top that comes back down to the right, then a long bowl running to the
  // left and curling up, with two dots below.
  'ي': [[M(84, 10), C(70, 14, 60, 22, 62, 34), C(64, 46, 80, 48, 80, 58), C(80, 68, 64, 68, 48, 66), C(30, 66, 12, 58, 12, 34)], dot(62, 82), dot(40, 82)],

  // The Arabic-Indic digits, 0 to 9. Zero is a dot: tap it.
  '٠': [dot(50, 50)],
  '١': [[M(50, 10), L(50, 90)]],
  // Two starts at the top right, dips down and comes back up in a small cup to the top
  // left, then goes straight down; six is its mirror image. Three is a long stem with a
  // wave of two teeth beside it.
  '٢': [[M(80, 10), C(76, 30, 50, 32, 40, 10), L(42, 92)]],
  '٣': [[M(27, 9), L(34, 91)], [M(34, 33), C(40, 37, 45, 35, 46, 28), L(46, 10)], [M(47, 34), C(56, 40, 70, 38, 74, 30), L(74, 10)]],
  // Four is like a reversed three: a small bowl, back to a point on the right, and a bigger
  // bowl below it - both bulging to the left - finishing at the bottom right.
  '٤': [[M(70, 12), C(52, 4, 30, 10, 32, 26), C(34, 40, 50, 44, 64, 42), C(42, 46, 24, 58, 26, 74), C(28, 90, 54, 92, 76, 86)]],
  '٥': [[A(50, 50, 28, 32, -90, -450)]],
  '٦': [[M(20, 10), C(24, 30, 50, 32, 60, 10), L(64, 92)]],
  '٧': [[M(24, 12), L(50, 90), L(76, 12)]],
  '٨': [[M(24, 90), L(50, 12), L(76, 90)]],
  '٩': [[A(46, 32, 20, 21, 0, -360), C(66, 52, 70, 74, 78, 92)]],
};
