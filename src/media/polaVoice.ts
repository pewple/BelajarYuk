import { TOKENS } from '../data/pola';
import type { TokenId } from '../data/pola';
import { CLIP_IDS, colorClipId } from './clips';
import type { Part } from './voiceParts';

/** "Lanjutkan polanya!" - the instruction that opens every round. */
export const continueLine = (): Part[] => [{ clip: CLIP_IDS.continuePattern, text: 'Lanjutkan polanya!' }];

/** "Coba lagi!" - after a pick that was not the next one. */
export const tryAgainLine = (): Part[] => [{ clip: CLIP_IDS.tryAgain, text: 'Coba lagi!' }];

/**
 * A row read aloud: "merah, biru, merah, biru, merah!"
 *
 * Each colour is a part of its own, so each can be a recording. The commas and
 * the closing "!" ride on the text, which is what keeps a spoken row sounding
 * like a list rather than a string of unrelated words.
 */
export function patternLine(row: TokenId[]): Part[] {
  return row.map((id, i) => ({
    clip: colorClipId(TOKENS[id].name),
    text: TOKENS[id].name + (i === row.length - 1 ? '!' : ','),
  }));
}
