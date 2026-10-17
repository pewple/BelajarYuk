import { TOKENS, boxCells } from '../data/pola';
import type { PolaKind, TokenId } from '../data/pola';
import { CLIP_IDS, MAZE_CLIP_IDS, POLA_CLIP_IDS, colorClipId } from './clips';
import type { Part } from './voiceParts';

/** "Lanjutkan polanya!" - the instruction that opens every round. */
export const continueLine = (): Part[] => [{ clip: CLIP_IDS.continuePattern, text: 'Lanjutkan polanya!' }];

/** "Coba lagi!" - after a pick that was not the next one. */
export const tryAgainLine = (): Part[] => [{ clip: CLIP_IDS.tryAgain, text: 'Coba lagi!' }];

/**
 * "Pilih baris, kotak, atau acak!" - said on the screen before a round begins.
 * "Pilih", "atau" and "acak" are the maze chooser's words, so a recording made
 * for the maze is heard here as well.
 */
export const chooseKindLine = (): Part[] => [
  { clip: MAZE_CLIP_IDS.choose, text: 'Pilih' },
  { clip: POLA_CLIP_IDS.line, text: 'baris,' },
  { clip: POLA_CLIP_IDS.box, text: 'kotak,' },
  { clip: MAZE_CLIP_IDS.or, text: 'atau' },
  { clip: MAZE_CLIP_IDS.random, text: 'acak!' },
];

/** A colour's part, with whatever should follow it. */
const colour = (id: TokenId, after = ''): Part => ({
  clip: colorClipId(TOKENS[id].name),
  text: TOKENS[id].name + after,
});

/**
 * A row read aloud: "merah, biru, merah, biru, merah!"
 *
 * For boxes each box is read by its shapes, top to bottom, with the comma after
 * the last of them: "merah biru, biru merah, merah biru!" Each colour is a part
 * of its own, so each can be a recording. The commas and the closing "!" ride on
 * the text, which is what keeps a spoken row sounding like a list rather than a
 * string of unrelated words.
 */
export function patternLine(row: string[], kind: PolaKind = 'baris'): Part[] {
  if (kind === 'baris') {
    return (row as TokenId[]).map((id, i) => colour(id, i === row.length - 1 ? '!' : ','));
  }

  return row.flatMap((box, b) => {
    const cells = boxCells(box);
    return cells.map((id, i) => colour(id, i < cells.length - 1 ? '' : b === row.length - 1 ? '!' : ','));
  });
}

/** What a pick is called to assistive tech: a colour, or a box of colours. */
export function nameOf(id: string, kind: PolaKind): string {
  return kind === 'baris' ? TOKENS[id as TokenId].name : `kotak ${boxCells(id).map((c) => TOKENS[c].name).join(' ')}`;
}
