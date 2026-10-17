import { describe, expect, it } from 'vitest';
import {
  CHANGE_PIECES,
  CHECKOUTS,
  DENOMINATIONS,
  MAX_AMOUNT,
  PIECE_LIMITS,
  PIECE_LOOK,
  SPOKEN_AMOUNTS,
  changeOwed,
  canFinish,
  changeSteps,
  formatNumber,
  formatRupiah,
  judgeChange,
  nextPieceHint,
  rupiahWords,
  usesLeft,
  usesOf,
} from '../data/money';

describe('rupiahWords', () => {
  it.each([
    [0, 'nol'],
    [500, 'lima ratus'],
    [1000, 'seribu'],
    [1500, 'seribu lima ratus'],
    [2000, 'dua ribu'],
    [2500, 'dua ribu lima ratus'],
    [5000, 'lima ribu'],
    [10000, 'sepuluh ribu'],
    [11000, 'sebelas ribu'],
    [12000, 'dua belas ribu'],
    [12500, 'dua belas ribu lima ratus'],
    [15000, 'lima belas ribu'],
    [15500, 'lima belas ribu lima ratus'],
    [20000, 'dua puluh ribu'],
    [21000, 'dua puluh satu ribu'],
    [100000, 'seratus ribu'],
    [101000, 'seratus satu ribu'],
    [250000, 'dua ratus lima puluh ribu'],
    [999999, 'sembilan ratus sembilan puluh sembilan ribu sembilan ratus sembilan puluh sembilan'],
  ])('says %i as "%s"', (amount, words) => {
    expect(rupiahWords(amount)).toBe(words);
  });

  it('says "seribu" and "seratus" for a leading 1, never "satu ribu" or "satu ratus"', () => {
    // The classic mistake of a digit-by-digit lookup. It only applies when the
    // 1 *leads*: 101.000 is correctly "seratus satu ribu" (one hundred and one
    // thousand), so that is checked exactly in the table above instead.
    for (const amount of [1000, 100, 1100, 100000, 1500]) {
      expect(rupiahWords(amount)).toMatch(/^(seribu|seratus)/);
      expect(rupiahWords(amount)).not.toMatch(/^satu (ribu|ratus)/);
    }
  });

  it('leaves out-of-range numbers readable rather than throwing', () => {
    expect(rupiahWords(1_000_000)).toBe('1000000');
    expect(rupiahWords(-5)).toBe('-5');
    expect(rupiahWords(1.5)).toBe('1.5');
  });
});

describe('formatting', () => {
  it('groups thousands with dots, the Indonesian way', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(100)).toBe('100');
    expect(formatNumber(500)).toBe('500');
    expect(formatNumber(1000)).toBe('1.000');
    expect(formatNumber(12500)).toBe('12.500');
    expect(formatNumber(1000000)).toBe('1.000.000');
  });

  it('prefixes Rp', () => {
    expect(formatRupiah(3000)).toBe('Rp 3.000');
    expect(formatRupiah(500)).toBe('Rp 500');
  });
});

describe('the change tray', () => {
  it('is exactly four pieces: Rp 500, 1.000, 2.000 and 5.000', () => {
    expect([...CHANGE_PIECES]).toEqual([500, 1000, 2000, 5000]);
  });

  it('is smallest first, so the row always reads left to right as "more"', () => {
    expect([...CHANGE_PIECES]).toEqual([...CHANGE_PIECES].sort((a, b) => a - b));
  });

  it('only holds money that exists in the game', () => {
    for (const piece of CHANGE_PIECES) expect(DENOMINATIONS).toContain(piece);
  });

  it('has a look for every piece of money', () => {
    for (const piece of DENOMINATIONS) {
      expect(PIECE_LOOK[piece], `no look for ${piece}`).toBeDefined();
    }
  });

  it('gives every piece its own colour, so no two can be confused', () => {
    const themes = DENOMINATIONS.map((piece) => PIECE_LOOK[piece].theme);
    expect(new Set(themes).size).toBe(themes.length);
  });

  it('can make any amount owed, exactly, so a child can never be unable to finish', () => {
    // Every amount that can be owed is a multiple of 500 - and the smallest
    // piece IS 500. Checked as a real subset-sum, not just by that argument.
    const reachable = new Set<number>([0]);
    for (let total = 500; total <= MAX_AMOUNT; total += 500) {
      if (CHANGE_PIECES.some((piece) => reachable.has(total - piece))) reachable.add(total);
    }

    for (const checkout of CHECKOUTS) {
      expect(reachable.has(changeOwed(checkout)), `${checkout.item} cannot be paid out in change`).toBe(true);
    }
  });
});

describe('judgeChange', () => {
  it('says "short" until enough has been given', () => {
    expect(judgeChange(0, 3000)).toBe('short');
    expect(judgeChange(2500, 3000)).toBe('short');
  });

  it('says "exact" on the amount owed, and no other', () => {
    expect(judgeChange(3000, 3000)).toBe('exact');
    expect(judgeChange(500, 500)).toBe('exact');
  });

  it('says "over" as soon as it is passed - even by the smallest piece', () => {
    expect(judgeChange(3500, 3000)).toBe('over');
    expect(judgeChange(1000, 500)).toBe('over');
  });

  it('reaches "over" from "short" in a single piece, never skipping a verdict', () => {
    // Whichever of the four pieces is tapped next, the result is one of the
    // three verdicts - there is no state the child can get into that has none.
    for (const checkout of CHECKOUTS) {
      const owed = changeOwed(checkout);
      for (let given = 0; given < owed; given += 500) {
        for (const piece of CHANGE_PIECES) {
          expect(['short', 'exact', 'over']).toContain(judgeChange(given + piece, owed));
        }
      }
    }
  });
});

describe('changeSteps', () => {
  it('totals the change from nothing, never from the price', () => {
    expect(changeSteps([1000, 2000])).toEqual([
      { add: 1000, from: 0, total: 1000 },
      { add: 2000, from: 1000, total: 3000 },
    ]);
  });

  it('is empty before anything is given, and chains each step onto the last', () => {
    expect(changeSteps([])).toEqual([]);

    const steps = changeSteps([5000, 2000, 500]);
    expect(steps.map((s) => s.from)).toEqual([0, 5000, 7000]);
    expect(steps.map((s) => s.total)).toEqual([5000, 7000, 7500]);
  });
});

describe('the customers', () => {
  it('only ever deal in whole halves of a thousand, so every total is speakable', () => {
    for (const { price, paid } of CHECKOUTS) {
      expect(price % 500).toBe(0);
      expect(paid % 500).toBe(0);
    }
  });

  it('pay with a real note, and always owe change', () => {
    for (const checkout of CHECKOUTS) {
      expect(DENOMINATIONS, `${checkout.item} pays with a note that does not exist`).toContain(checkout.paid);
      expect(checkout.paid).toBeGreaterThanOrEqual(2000);
      expect(checkout.paid).toBeGreaterThan(checkout.price);
      expect(changeOwed(checkout)).toBeGreaterThanOrEqual(500);
    }
  });

  it('start with the easiest change - a single Rp 500', () => {
    expect(changeOwed(CHECKOUTS[0])).toBe(500);
  });

  it('use the Rp 500 piece: some change needs it, and some prices end in 500', () => {
    expect(CHECKOUTS.some((c) => c.price % 1000 === 500)).toBe(true);
    expect(CHECKOUTS.some((c) => changeOwed(c) % 1000 === 500)).toBe(true);
  });

  it('owe a spread of amounts, not one amount many times', () => {
    const owed = CHECKOUTS.map(changeOwed);
    expect(new Set(owed).size).toBeGreaterThanOrEqual(8);
  });

  it('never ask for an amount the register cannot say', () => {
    // Every price, payment, amount owed - and every running total of change,
    // including the one that tips over and triggers "Salah" - must have a
    // spoken form (and a recording slot), or the app would say nothing then.
    const biggestPiece = Math.max(...CHANGE_PIECES);

    for (const checkout of CHECKOUTS) {
      const owed = changeOwed(checkout);
      expect(SPOKEN_AMOUNTS).toContain(checkout.price);
      expect(SPOKEN_AMOUNTS).toContain(checkout.paid);
      expect(SPOKEN_AMOUNTS).toContain(owed);

      // The highest total ever shown is just under `owed`, plus one more piece.
      for (let total = 500; total < owed + biggestPiece; total += 500) {
        expect(SPOKEN_AMOUNTS, `${total} for ${checkout.item}`).toContain(total);
      }
      expect(owed + biggestPiece).toBeLessThanOrEqual(MAX_AMOUNT);
    }
  });

  it('are different people buying different things', () => {
    expect(new Set(CHECKOUTS.map((c) => c.item)).size).toBe(CHECKOUTS.length);
  });
});

describe('the spoken amounts', () => {
  it('run from Rp 500 to the maximum in steps of 500, with no gaps', () => {
    expect(SPOKEN_AMOUNTS[0]).toBe(500);
    expect(SPOKEN_AMOUNTS[SPOKEN_AMOUNTS.length - 1]).toBe(MAX_AMOUNT);
    SPOKEN_AMOUNTS.forEach((amount, i) => expect(amount).toBe((i + 1) * 500));
  });
});

describe('the limits on each piece', () => {
  it('give every piece a limit, and keep Rp 500 to one to three uses', () => {
    for (const piece of CHANGE_PIECES) {
      expect(PIECE_LIMITS[piece], String(piece)).toBeGreaterThanOrEqual(1);
      expect(PIECE_LIMITS[piece], String(piece)).toBeLessThanOrEqual(4);
    }
    expect(PIECE_LIMITS[500]).toBeGreaterThanOrEqual(1);
    expect(PIECE_LIMITS[500]).toBeLessThanOrEqual(3);
  });

  it('are on exactly the pieces in the tray', () => {
    expect(Object.keys(PIECE_LIMITS).map(Number).sort((a, b) => a - b)).toEqual([...CHANGE_PIECES]);
  });

  it('count what has been used, and what is left', () => {
    expect(usesOf([500, 1000, 500])).toEqual({ 500: 2, 1000: 1 });
    expect(usesLeft([], 500)).toBe(PIECE_LIMITS[500]);
    expect(usesLeft([500, 500], 500)).toBe(PIECE_LIMITS[500] - 2);
    expect(usesLeft([500, 500, 500, 500, 500], 500)).toBe(0); // never below nothing
    expect(usesLeft([], 7)).toBe(0); // not a piece at all
  });

  it('leave every customer a way to exactly the right change', () => {
    for (const checkout of CHECKOUTS) expect(canFinish(changeOwed(checkout), []), checkout.item).toBe(true);
  });

  it('say whether the right change can still be made after some pieces', () => {
    expect(canFinish(1500, [500])).toBe(true); // 1.000 to go
    expect(canFinish(1500, [1000])).toBe(true); // 500 to go
    expect(canFinish(3000, [500, 500, 500])).toBe(false); // 1.500 to go, and no Rp 500 left
    expect(canFinish(1000, [2000])).toBe(false); // already too much
    expect(canFinish(1000, [500, 500])).toBe(true); // already exact
  });

  it('count exact as finishable, and too much as not', () => {
    expect(canFinish(500, [500])).toBe(true);
    expect(canFinish(500, [1000])).toBe(false);
  });

  it('use the limits of every piece, not only Rp 500', () => {
    expect(canFinish(8000, [5000, 5000])).toBe(false);
    expect(canFinish(8000, [5000])).toBe(true);
  });

  it('point the hint at the largest piece that still leads somewhere', () => {
    expect(nextPieceHint(3500, [])).toBe(2000);
    expect(nextPieceHint(3500, [2000])).toBe(1000);
    expect(nextPieceHint(3500, [2000, 1000])).toBe(500);
    expect(nextPieceHint(8000, [])).toBe(5000);
  });

  it('never point at a piece that has been used up, or at nothing when the count is lost', () => {
    expect(nextPieceHint(1500, [500, 500, 500])).toBeUndefined();
    expect(nextPieceHint(3000, [500, 500, 500])).toBeUndefined();
  });
});
