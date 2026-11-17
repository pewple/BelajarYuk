import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { setupUser } from './user';
import App from '../App';
import { COATS, FOODS, KINDS, KUDA_STORAGE_KEY, MANES, PATTERNS, loadCloset } from '../data/kuda';
import { HOME_CHOICES } from '../data/navigation';
import { POLA_LEVELS, TOKENS, buildRound } from '../data/pola';
import type { TokenId } from '../data/pola';
import { UNLOCK_AFTER_GAMES } from '../data/session';
import { PlayProvider, usePlay } from '../state/play';
import { STARS_STORAGE_KEY, earnStars, getWallet, reloadWallet, spendStars } from '../state/stars';
import type { PonyColors, PonyEvents, PonyGait } from '../kuda/pony';
import { HOME_BUTTON } from './helpers';
import { installVoice, spokenTexts } from './setup';

/*
 * jsdom has no WebGL, so the pony itself is replaced by a stand-in that records
 * what the screen asks of it and lets a test say when it has finished eating.
 */
const fake = vi.hoisted(() => ({
  canDraw: true,
  colors: [] as unknown[],
  gaits: [] as number[],
  fed: [] as string[],
  rears: 0,
  steers: [] as number[],
  eating: false,
  events: null as null | PonyEvents,
  disposed: 0,
  ages: [] as string[],
}));

vi.mock('../kuda/pony', () => ({
  GAIT_COUNT: 4,
  canDrawPony: () => fake.canDraw,
  createPony: (_canvas: HTMLCanvasElement, colors: PonyColors, events: PonyEvents, age: string) => {
    fake.colors.push(colors);
    fake.ages.push(age);
    fake.events = events;
    queueMicrotask(() => events.onReady?.());
    return {
      setGait: (g: PonyGait) => fake.gaits.push(g),
      steer: (d: number) => fake.steers.push(d),
      rear: () => fake.rears++,
      feed: (food: 'wortel' | 'apel') => {
        fake.fed.push(food);
        fake.eating = true;
        return true;
      },
      isEating: () => fake.eating,
      setColors: (c: PonyColors) => fake.colors.push(c),
      dispose: () => fake.disposed++,
    };
  },
}));

function resetFake() {
  fake.canDraw = true;
  fake.colors = [];
  fake.gaits = [];
  fake.fed = [];
  fake.rears = 0;
  fake.steers = [];
  fake.eating = false;
  fake.events = null;
  fake.disposed = 0;
  fake.ages = [];
}

function giveStars(n: number) {
  window.localStorage.setItem(STARS_STORAGE_KEY, JSON.stringify({ stars: n, earned: n }));
  reloadWallet();
}

const badge = () => screen.getByRole('img', { name: /bintang$/ });

async function openKuda(user: ReturnType<typeof setupUser>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Kuda/ }));
  // The stand-in pony says it is ready on the next microtask.
  await act(async () => {});
}

/** The pony finished eating what it was given. */
function finishEating() {
  const food = fake.fed[fake.fed.length - 1] as 'wortel' | 'apel';
  fake.eating = false;
  act(() => fake.events?.onAte?.(food));
}

beforeEach(() => {
  resetFake();
  installVoice('Test Indonesian', 'id-ID');
});
afterEach(() => vi.useRealTimers());

describe('the star wallet', () => {
  it('starts empty, earns one star at a time and remembers them', () => {
    expect(getWallet()).toEqual({ stars: 0, earned: 0 });
    earnStars();
    earnStars();
    expect(getWallet()).toEqual({ stars: 2, earned: 2 });
    expect(JSON.parse(window.localStorage.getItem(STARS_STORAGE_KEY)!)).toEqual({ stars: 2, earned: 2 });

    reloadWallet();
    expect(getWallet().stars).toBe(2);
  });

  it('spends only what it has, and never touches the stars earned in all', () => {
    giveStars(5);
    expect(spendStars(3)).toBe(true);
    expect(getWallet()).toEqual({ stars: 2, earned: 5 });
    expect(spendStars(3)).toBe(false);
    expect(getWallet()).toEqual({ stars: 2, earned: 5 });
  });

  it('shrugs off a broken or edited entry', () => {
    window.localStorage.setItem(STARS_STORAGE_KEY, '{nope');
    reloadWallet();
    expect(getWallet()).toEqual({ stars: 0, earned: 0 });

    window.localStorage.setItem(STARS_STORAGE_KEY, JSON.stringify({ stars: -4, earned: 'lots' }));
    reloadWallet();
    expect(getWallet()).toEqual({ stars: 0, earned: 0 });

    window.localStorage.setItem(STARS_STORAGE_KEY, JSON.stringify({ stars: 7.9, earned: 3 }));
    reloadWallet();
    expect(getWallet()).toEqual({ stars: 7, earned: 7 });
  });

  it('gets a star for every right answer reported in any game, and none for a wrong one', () => {
    let play: ReturnType<typeof usePlay> | null = null;
    function Probe() {
      play = usePlay();
      return null;
    }
    render(
      <PlayProvider resetKey="pola">
        <Probe />
      </PlayProvider>,
    );
    act(() => play!.reportAttempt(true));
    act(() => play!.reportAttempt(false));
    act(() => play!.reportAttempt(true));
    expect(getWallet().stars).toBe(2);
  });

  it('shows on the home screen and in a game, and goes up with a right answer', async () => {
    const user = setupUser();
    render(<App />);
    expect(badge()).toHaveAccessibleName('0 bintang');

    await user.click(screen.getByRole('button', { name: /Pola/ }));
    await user.click(screen.getByRole('button', { name: 'Baris' }));
    expect(badge()).toHaveAccessibleName('0 bintang');

    const right = TOKENS[buildRound(POLA_LEVELS[0], 0).answer as TokenId].name;
    await user.click(screen.getByRole('button', { name: `Pilih ${right}` }));
    expect(badge()).toHaveAccessibleName('1 bintang');
  });
});

describe('the home screen', () => {
  it('marks with a small star exactly the games that give stars', () => {
    render(<App />);
    for (const choice of HOME_CHOICES) {
      const card = screen.getByRole('button', { name: new RegExp(choice.title) });
      expect(!!card.querySelector('[data-gives-stars]'), choice.title).toBe(!!choice.givesStars);
    }
    expect(HOME_CHOICES.filter((c) => c.givesStars).map((c) => c.id)).toEqual(['menulis', 'pola', 'memori', 'labirin', 'kasir', 'masak']);
  });
});

describe('Kuda', () => {
  describe('opening it', () => {
    it('is the last card on the home screen, after Memasak', () => {
      render(<App />);
      const cards = screen.getAllByRole('button');
      expect(cards[cards.length - 1]).toHaveTextContent('Kuda');
      expect(cards[cards.length - 2]).toHaveTextContent('Memasak');
    });

    it('says hello, credits the horse it is made from, and gives the pony back on the way out', async () => {
      const user = setupUser();
      await openKuda(user);

      expect(screen.getByRole('heading', { name: 'Kuda' })).toBeInTheDocument();
      expect(spokenTexts).toContain('Ayo main dengan kuda!');
      expect(screen.getByText(/“Horse” oleh typescript\.dev/)).toBeInTheDocument();

      // Nothing is played here yet, so the way out still asks a grown-up.
      await user.click(screen.getByRole('button', HOME_BUTTON));
      expect(screen.getByRole('dialog', { name: 'Khusus orang tua' })).toBeInTheDocument();
    });

    it('dresses the pony in what it was last wearing', async () => {
      const user = setupUser();
      window.localStorage.setItem(KUDA_STORAGE_KEY, JSON.stringify({ owned: ['coat:ungu'], coat: 'ungu', mane: 'hitam' }));
      await openKuda(user);
      expect(fake.colors[0]).toMatchObject({ body: COATS.find((c) => c.id === 'ungu')!.body });
    });

    it('explains itself, and still sells colours, on a device that cannot draw the pony', async () => {
      fake.canDraw = false;
      giveStars(20);
      const user = setupUser();
      await openKuda(user);

      expect(screen.getByText(/belum bisa menampilkan kudanya/)).toBeInTheDocument();
      for (const food of FOODS) expect(screen.getByRole('button', { name: new RegExp(`^${food.name}`) })).toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'Warna' }));
      await user.click(screen.getByRole('button', { name: /^Kulit putih/ }));
      expect(getWallet().stars).toBe(12);
    });
  });

  describe('moving', () => {
    it('walks, runs, gallops and stops, with the chosen gait lit up', async () => {
      const user = setupUser();
      await openKuda(user);
      const moves = screen.getByRole('group', { name: 'Gerakan' });

      for (const [label, gait] of [['Jalan', 1], ['Lari', 2], ['Kencang', 3], ['Berhenti', 0]] as const) {
        await user.click(within(moves).getByRole('button', { name: label }));
        expect(fake.gaits[fake.gaits.length - 1]).toBe(gait);
        expect(within(moves).getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
      }
    });

    it('rears, and turns only while a turn button is held', async () => {
      const user = setupUser();
      await openKuda(user);

      await user.click(screen.getByRole('button', { name: 'Berdiri' }));
      expect(fake.rears).toBe(1);

      const left = screen.getByRole('button', { name: 'Belok kiri' });
      act(() => left.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
      act(() => left.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
      const right = screen.getByRole('button', { name: 'Belok kanan' });
      act(() => right.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
      act(() => right.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
      expect(fake.steers).toEqual([1, 0, -1, 0]);
    });

    it('follows the arrow keys and space', async () => {
      const user = setupUser();
      await openKuda(user);

      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(fake.gaits).toEqual([1, 2]);
      await user.keyboard('{ArrowDown}');
      expect(fake.gaits).toEqual([1, 2, 1]);
      await user.keyboard('{ArrowLeft>}');
      expect(fake.steers[fake.steers.length - 1]).toBe(1);
      await user.keyboard('{/ArrowLeft}');
      expect(fake.steers[fake.steers.length - 1]).toBe(0);
      (document.activeElement as HTMLElement | null)?.blur();
      await user.keyboard(' ');
      expect(fake.rears).toBe(1);
    });
  });

  describe('food', () => {
    it('costs stars, stops the pony to eat, and is praised when it is gone', async () => {
      giveStars(5);
      const user = setupUser();
      await openKuda(user);
      const carrot = FOODS.find((f) => f.id === 'wortel')!;

      await user.click(screen.getByRole('button', { name: `Wortel, ${carrot.price} bintang` }));
      expect(fake.fed).toEqual(['wortel']);
      expect(getWallet().stars).toBe(5 - carrot.price);
      expect(badge()).toHaveAccessibleName(`${5 - carrot.price} bintang`);
      // While it eats there is nothing else to buy or do.
      expect(screen.getByRole('button', { name: /^Apel/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Jalan' })).toBeDisabled();

      finishEating();
      expect(spokenTexts.join(' ')).toContain('Nyam nyam! Kuda suka wortel!');
      expect(screen.getByRole('button', { name: /^Apel/ })).toBeEnabled();
    });

    it('is not handed over without enough stars - just a gentle "not yet"', async () => {
      giveStars(1);
      const user = setupUser();
      await openKuda(user);

      await user.click(screen.getByRole('button', { name: /^Apel/ }));
      expect(fake.fed).toEqual([]);
      expect(getWallet().stars).toBe(1);
      expect(spokenTexts).toContain('Bintangnya belum cukup. Ayo main dulu!');
    });

    it('counts towards letting go of the home button, like a finished game', async () => {
      giveStars(100);
      const user = setupUser();
      await openKuda(user);

      for (let i = 0; i < UNLOCK_AFTER_GAMES; i++) {
        await user.click(screen.getByRole('button', { name: /^Wortel/ }));
        finishEating();
      }
      await user.click(screen.getByRole('button', HOME_BUTTON));
      expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    });
  });

  describe('which horse', () => {
    it('starts as a foal - a belo - for nothing', async () => {
      const user = setupUser();
      await openKuda(user);
      expect(fake.ages).toEqual(['anak']);

      await user.click(screen.getByRole('button', { name: 'Kuda' }));
      const dialog = screen.getByRole('dialog', { name: 'Pilih kuda' });
      expect(within(dialog).getByRole('button', { name: 'Belo, dipakai' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('buys a pony foal or a grown horse, builds it anew, and switches back and forth for free after', async () => {
      const pony = KINDS.find((k) => k.id === 'poni')!;
      const adult = KINDS.find((k) => k.id === 'dewasa')!;
      giveStars(pony.price + adult.price);
      const user = setupUser();
      await openKuda(user);
      await user.click(screen.getByRole('button', { name: 'Kuda' }));
      const dialog = screen.getByRole('dialog', { name: 'Pilih kuda' });

      await user.click(within(dialog).getByRole('button', { name: `Anak poni, ${pony.price} bintang` }));
      await act(async () => {});
      expect(fake.ages).toEqual(['anak', 'poni']);
      expect(fake.disposed).toBe(1);
      expect(getWallet().stars).toBe(adult.price);
      expect(spokenTexts).toContain('Hore, kuda baru!');

      await user.click(within(dialog).getByRole('button', { name: `Kuda dewasa, ${adult.price} bintang` }));
      await act(async () => {});
      expect(fake.ages[fake.ages.length - 1]).toBe('dewasa');
      expect(getWallet().stars).toBe(0);

      await user.click(within(dialog).getByRole('button', { name: 'Belo, sudah punya' }));
      await user.click(within(dialog).getByRole('button', { name: 'Anak poni, sudah punya' }));
      await act(async () => {});
      expect(fake.ages).toEqual(['anak', 'poni', 'dewasa', 'anak', 'poni']);
      expect(getWallet().stars).toBe(0);
      expect(loadCloset()).toMatchObject({ kind: 'poni', owned: ['kind:poni', 'kind:dewasa'] });
    });

    it('keeps the colours on when the horse changes', async () => {
      window.localStorage.setItem(KUDA_STORAGE_KEY, JSON.stringify({ owned: ['coat:ungu', 'kind:poni'], kind: 'anak', coat: 'ungu', mane: 'hitam' }));
      const user = setupUser();
      await openKuda(user);
      await user.click(screen.getByRole('button', { name: 'Kuda' }));
      await user.click(screen.getByRole('button', { name: 'Anak poni, sudah punya' }));
      await act(async () => {});
      expect(fake.ages).toEqual(['anak', 'poni']);
      expect(fake.colors[fake.colors.length - 1]).toMatchObject({ body: COATS.find((c) => c.id === 'ungu')!.body });
    });

    it('sells a unicorn too: the grown horse with a horn', async () => {
      const unicorn = KINDS.find((k) => k.id === 'unikorn')!;
      giveStars(unicorn.price);
      const user = setupUser();
      await openKuda(user);
      await user.click(screen.getByRole('button', { name: 'Kuda' }));
      const dialog = screen.getByRole('dialog', { name: 'Pilih kuda' });
      expect(within(dialog).getAllByRole('button', { name: /bintang|dipakai|sudah punya/ }).map((b) => b.getAttribute('aria-label')?.split(',')[0]))
        .toEqual(['Belo', 'Anak poni', 'Kuda dewasa', 'Unikorn']);

      await user.click(within(dialog).getByRole('button', { name: `Unikorn, ${unicorn.price} bintang` }));
      await act(async () => {});
      expect(fake.ages).toEqual(['anak', 'unikorn']);
      expect(getWallet().stars).toBe(0);
      expect(loadCloset()).toMatchObject({ kind: 'unikorn', owned: ['kind:unikorn'] });
    });

    it('refuses gently without enough stars', async () => {
      giveStars(3);
      const user = setupUser();
      await openKuda(user);
      await user.click(screen.getByRole('button', { name: 'Kuda' }));
      const button = screen.getByRole('button', { name: /^Kuda dewasa/ });
      await user.click(button);
      expect(button).toHaveAttribute('data-wiggle', 'true');
      expect(fake.ages).toEqual(['anak']);
      expect(getWallet().stars).toBe(3);
    });
  });

  describe('colours', () => {
    it('bought once, worn at once, and kept for nothing after that', async () => {
      giveStars(40);
      const user = setupUser();
      await openKuda(user);
      await user.click(screen.getByRole('button', { name: 'Warna' }));
      const dialog = screen.getByRole('dialog', { name: 'Warna kuda' });
      const pink = COATS.find((c) => c.id === 'merah-muda')!;
      const rainbow = MANES.find((m) => m.id === 'pelangi')!;

      await user.click(within(dialog).getByRole('button', { name: `Kulit merah muda, ${pink.price} bintang` }));
      expect(getWallet().stars).toBe(40 - pink.price);
      expect(fake.colors[fake.colors.length - 1]).toMatchObject({ body: pink.body });
      expect(within(dialog).getByRole('button', { name: 'Kulit merah muda, dipakai' })).toHaveAttribute('aria-pressed', 'true');
      expect(spokenTexts).toContain('Wah, cantik!');

      // Back to the pony's own coat, and back to pink again: free both ways.
      await user.click(within(dialog).getByRole('button', { name: /^Kulit cokelat/ }));
      await user.click(within(dialog).getByRole('button', { name: 'Kulit merah muda, sudah punya' }));
      expect(getWallet().stars).toBe(40 - pink.price);

      await user.click(within(dialog).getByRole('button', { name: `Rambut pelangi, ${rainbow.price} bintang` }));
      expect(fake.colors[fake.colors.length - 1]).toMatchObject({ rainbow: true });
      expect(getWallet().stars).toBe(40 - pink.price - rainbow.price);
      expect(loadCloset()).toEqual({ owned: ['coat:merah-muda', 'mane:pelangi'], kind: 'anak', coat: 'merah-muda', pattern: 'polos', mane: 'pelangi' });
    });

    it('sells coat patterns the same way: bought once, worn at once, kept', async () => {
      const spots = PATTERNS.find((p) => p.id === 'totol')!;
      const dapple = PATTERNS.find((p) => p.id === 'bintik')!;
      giveStars(spots.price + dapple.price);
      const user = setupUser();
      await openKuda(user);
      await user.click(screen.getByRole('button', { name: 'Warna' }));
      const dialog = screen.getByRole('dialog', { name: 'Warna kuda' });
      expect(within(dialog).getByRole('button', { name: 'Corak polos, dipakai' })).toHaveAttribute('aria-pressed', 'true');

      await user.click(within(dialog).getByRole('button', { name: `Corak totol, ${spots.price} bintang` }));
      expect(fake.colors[fake.colors.length - 1]).toMatchObject({ pattern: 'totol' });
      await user.click(within(dialog).getByRole('button', { name: `Corak bintik, ${dapple.price} bintang` }));
      expect(fake.colors[fake.colors.length - 1]).toMatchObject({ pattern: 'bintik' });
      expect(getWallet().stars).toBe(0);

      await user.click(within(dialog).getByRole('button', { name: 'Corak totol, sudah punya' }));
      await user.click(within(dialog).getByRole('button', { name: /^Corak polos/ }));
      expect(getWallet().stars).toBe(0);
      expect(loadCloset()).toMatchObject({ pattern: 'polos', owned: ['pattern:totol', 'pattern:bintik'] });
      // The pattern is a repaint, not a new horse.
      expect(fake.ages).toEqual(['anak']);
    });

    it('will not hand over a pattern without enough stars', async () => {
      giveStars(1);
      const user = setupUser();
      await openKuda(user);
      await user.click(screen.getByRole('button', { name: 'Warna' }));
      const button = screen.getByRole('button', { name: /^Corak belang/ });
      await user.click(button);
      expect(button).toHaveAttribute('data-wiggle', 'true');
      expect(loadCloset().pattern).toBe('polos');
    });

    it('wiggles and says "not yet" when there are not enough stars', async () => {
      giveStars(2);
      const user = setupUser();
      await openKuda(user);
      await user.click(screen.getByRole('button', { name: 'Warna' }));
      const button = screen.getByRole('button', { name: /^Rambut pelangi/ });

      await user.click(button);
      expect(button).toHaveAttribute('data-wiggle', 'true');
      expect(getWallet().stars).toBe(2);
      expect(loadCloset().mane).toBe('hitam');
      expect(spokenTexts).toContain('Bintangnya belum cukup. Ayo main dulu!');
    });

    it('closes with its button or Escape', async () => {
      const user = setupUser();
      await openKuda(user);
      await user.click(screen.getByRole('button', { name: 'Warna' }));
      await user.click(screen.getByRole('button', { name: 'Tutup' }));
      expect(screen.queryByRole('dialog', { name: 'Warna kuda' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Warna' }));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Warna kuda' })).not.toBeInTheDocument();
    });

    it('only wears what was really bought, whatever storage says', () => {
      window.localStorage.setItem(KUDA_STORAGE_KEY, JSON.stringify({ owned: [], kind: 'dewasa', coat: 'biru', pattern: 'totol', mane: 'pelangi' }));
      expect(loadCloset()).toEqual({ owned: [], kind: 'anak', coat: 'cokelat', pattern: 'polos', mane: 'hitam' });
      window.localStorage.setItem(KUDA_STORAGE_KEY, 'garbage');
      expect(loadCloset()).toEqual({ owned: [], kind: 'anak', coat: 'cokelat', pattern: 'polos', mane: 'hitam' });
    });
  });
});
