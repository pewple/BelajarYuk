import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupUser } from './user';
import App from '../App';
import { HINTS_STORAGE_KEY } from '../data/hints';
import { BURN_GRACE_MS, PATIENCE_FLOOR, PATIENCE_MS, ordersFor } from '../data/memasak';
import type { Level } from '../data/memasak';
import { UNLOCK_AFTER_GAMES } from '../data/session';
import { SHOP_AGAIN_MS, UPSET_MS } from '../screens/MasakScreen';
import { leaveGame } from './helpers';
import { installVoice, playedToneCounts, spokenTexts } from './setup';

type User = ReturnType<typeof userEvent.setup>;
type Choice = 'Susun' | 'Tunggu' | 'Dua sekaligus' | 'Aduk' | 'Kalau';

/* ------------------------------------------------------------------ */
/* Drivers                                                             */
/* ------------------------------------------------------------------ */

async function open(user: User) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Memasak/ }));
}

const bell = () => screen.getByRole('button', { name: 'Bel layanan' });
const ring = (user: User) => user.click(bell());

/** Opens Memasak, picks a level and rings the bell: the customer is at the counter. */
async function enter(user: User, choice: Choice) {
  await open(user);
  await user.click(screen.getByRole('button', { name: choice }));
  await ring(user);
}

const ingredient = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}, sisa`) });
const left = (name: string) => Number(ingredient(name).getAttribute('data-left'));
const burner = (n: number) => screen.getByRole('button', { name: new RegExp(`^Kompor ${n},`) });
const spoon = (n: number) => screen.getByRole('button', { name: new RegExp(`^Sendok ${n},`) });
const state = (n: number) => burner(n).getAttribute('data-state');
const cards = () => screen.getAllByTestId('order-card');
const stepStates = (card: HTMLElement) =>
  within(card).getAllByRole('listitem').map((li) => li.getAttribute('data-state'));
const patience = () => Number(screen.getByRole('progressbar', { name: 'Kesabaran pelanggan' }).getAttribute('aria-valuenow'));
const customer = () => screen.getByTestId('customer');

const cap = (id: string) => id[0].toUpperCase() + id.slice(1);

async function put(user: User, ...names: string[]) {
  for (const name of names) await user.click(ingredient(name));
}

/** Puts in every ingredient of a level-1 order, in order. */
async function make(user: User, level: Level, place: number) {
  for (const step of ordersFor(level)[place][0].steps) if (step.kind === 'add') await put(user, cap(step.ingredient));
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

const setHints = (level: 'guided' | 'independent', streak = 0) =>
  window.localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify({ memasak: { level, streak } }));

const hintState = () => JSON.parse(window.localStorage.getItem(HINTS_STORAGE_KEY) ?? '{}').memasak;

/** Fake time that still lets the UI's own awaits through. */
function useClock() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return setupUser({ advanceTimers: vi.advanceTimersByTime });
}

beforeEach(() => installVoice('Test Indonesian', 'id-ID'));
afterEach(() => vi.useRealTimers());

/* ------------------------------------------------------------------ */

describe('Memasak', () => {
  describe('opening it', () => {
    it('is the last card on the home screen, after Kasir', () => {
      render(<App />);
      const titles = ['Kasir', 'Memasak'];
      const order = screen
        .getAllByRole('button')
        .map((b) => titles.find((t) => b.textContent?.includes(t)))
        .filter(Boolean);

      expect(order).toEqual(titles);
      const all = screen.getAllByRole('button');
      expect(all[all.length - 1]).toHaveTextContent('Memasak');
    });

    it('asks first how to cook, out loud and in writing: five ways, and no kitchen yet', async () => {
      const user = setupUser();
      await open(user);

      expect(screen.getByRole('heading', { name: 'Memasak' })).toBeInTheDocument();
      for (const name of ['Susun', 'Tunggu', 'Dua sekaligus', 'Aduk', 'Kalau']) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      }
      expect(screen.queryByRole('region', { name: 'Bahan' })).not.toBeInTheDocument();
      expect(spokenTexts).toContain('Pilih cara memasak!');
    });

    it('has a speaker button that says it again, and goes home', async () => {
      const user = setupUser();
      await open(user);
      spokenTexts.length = 0;
      await user.click(screen.getByRole('button', { name: 'Ulangi perintah' }));
      expect(spokenTexts).toContain('Pilih cara memasak!');

      await leaveGame(user);
      expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    });
  });

  describe('the service bell', () => {
    it('is all there is at the start of a level: no customer, no recipe, no pantry', async () => {
      const user = setupUser();
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Susun' }));

      expect(bell()).toBeInTheDocument();
      expect(screen.queryByTestId('customer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('order-card')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Bahan' })).not.toBeInTheDocument();
      expect(screen.getByText('Ketuk bel untuk memanggil pelanggan')).toBeInTheDocument();
    });

    it('is asked for out loud, and again from the speaker button', async () => {
      const user = setupUser();
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Tunggu' }));
      expect(spokenTexts).toContain('Ketuk bel!');

      spokenTexts.length = 0;
      await user.click(screen.getByRole('button', { name: 'Ulangi perintah' }));
      expect(spokenTexts).toContain('Ketuk bel!');
    });

    it('rings when it is tapped, and the customer comes in with the order and the kitchen', async () => {
      const user = setupUser();
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Susun' }));
      const tones = playedToneCounts.value;
      spokenTexts.length = 0;
      await ring(user);

      expect(playedToneCounts.value).toBeGreaterThan(tones); // the bell's notes
      expect(screen.queryByRole('button', { name: 'Bel layanan' })).not.toBeInTheDocument();
      expect(customer()).toBeInTheDocument();
      expect(cards()[0]).toHaveTextContent('Roti keju');
      expect(screen.getByRole('region', { name: 'Bahan' })).toBeInTheDocument();
      expect(spokenTexts).toContain('Selamat datang! Ayo masak Roti keju! Roti, Keju, Roti!');
    });

    it('comes back for the next customer: every dish starts with the bell', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      await make(user, 'susun', 0);
      await user.click(screen.getByRole('button', { name: 'Resep berikutnya' }));

      expect(bell()).toBeInTheDocument();
      expect(screen.queryByTestId('order-card')).not.toBeInTheDocument();
      await ring(user);
      expect(cards()[0]).toHaveTextContent('Nasi telur');
    });

    it.each(['Susun', 'Tunggu', 'Dua sekaligus', 'Aduk', 'Kalau'] as const)('starts the %s level with it', async (choice) => {
      const user = setupUser();
      await open(user);
      await user.click(screen.getByRole('button', { name: choice }));
      expect(bell()).toBeInTheDocument();
      expect(screen.queryByTestId('order-card')).not.toBeInTheDocument();
      await ring(user);
      expect(cards().length).toBeGreaterThan(0);
    });

    it('glows for a child who is being guided', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = setupUser();
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Susun' }));
      expect(bell()).toHaveAttribute('data-hint', 'true');
    });

    it('is only a bell for a child who has graduated', async () => {
      const user = setupUser();
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Susun' }));
      expect(bell()).not.toHaveAttribute('data-hint');
    });

    it('does not let the customer wait before it is rung: nothing counts down', async () => {
      const user = useClock();
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Susun' }));
      await advance(PATIENCE_MS.susun * 2);

      expect(bell()).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('the customer', () => {
    it('is at the top, with a bar that is full when they arrive', async () => {
      const user = setupUser();
      await enter(user, 'Susun');

      expect(customer()).toHaveAttribute('data-mood', 'happy');
      expect(patience()).toBe(100);
      expect(customer()).toHaveTextContent('Ibu');
      // Above the order.
      expect(customer().compareDocumentPosition(screen.getByRole('list', { name: 'Pesanan' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('is a different person for each dish, one after another', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      expect(customer()).toHaveTextContent('Ibu');
      await make(user, 'susun', 0);
      await user.click(screen.getByRole('button', { name: 'Resep berikutnya' }));
      await ring(user);
      expect(customer()).toHaveTextContent('Bapak');
    });

    it('loses patience as the seconds go by, and frowns as it goes', async () => {
      setHints('independent');
      const user = useClock();
      await enter(user, 'Susun');
      await advance(PATIENCE_MS.susun * 0.3);
      expect(patience()).toBeLessThan(75);
      expect(patience()).toBeGreaterThan(60);
      expect(customer()).toHaveAttribute('data-mood', 'happy');

      await advance(PATIENCE_MS.susun * 0.3);
      expect(customer()).toHaveAttribute('data-mood', 'waiting');
      await advance(PATIENCE_MS.susun * 0.3);
      expect(customer()).toHaveAttribute('data-mood', 'upset');
    });

    it('gives up when the bar is empty: they say so, and nothing more can be cooked', async () => {
      setHints('independent');
      const user = useClock();
      await enter(user, 'Susun');
      spokenTexts.length = 0;
      await advance(PATIENCE_MS.susun + 500);

      expect(screen.getByRole('alert')).toHaveTextContent('Yah, pelanggannya kecewa. Coba lagi!');
      expect(customer()).toHaveAttribute('data-mood', 'upset');
      expect(spokenTexts).toContain('Yah, pelanggannya kecewa. Coba lagi!');
      expect(screen.queryByRole('region', { name: 'Bahan' })).not.toBeInTheDocument();
    });

    it('counts a customer who left as a miss, once', async () => {
      setHints('independent');
      const user = useClock();
      await enter(user, 'Susun');
      await advance(PATIENCE_MS.susun + 500);
      await advance(1000);

      expect(hintState()).toEqual({ level: 'independent', streak: 1 });
    });

    it('lets the bell be rung again, for the same dish and a fresh start, after a moment', async () => {
      setHints('independent');
      const user = useClock();
      await enter(user, 'Susun');
      await put(user, 'Roti');
      await advance(PATIENCE_MS.susun + 500);
      await advance(UPSET_MS + 300);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(bell()).toBeInTheDocument();
      await ring(user);
      expect(cards()[0]).toHaveTextContent('Roti keju');
      expect(stepStates(cards()[0])).toEqual(['todo', 'todo', 'todo']);
      expect(left('Roti')).toBe(2);
      expect(patience()).toBe(100);
    });

    it('does not leave a customer who has been served: they smile', async () => {
      setHints('independent');
      const user = useClock();
      await enter(user, 'Susun');
      await make(user, 'susun', 0);
      await advance(PATIENCE_MS.susun * 3);

      expect(customer()).toHaveAttribute('data-mood', 'happy');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Resep berikutnya' })).toBeInTheDocument();
    });

    it('is patient for a child who is being guided: the bar stops at the floor and they never leave', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = useClock();
      await enter(user, 'Susun');
      await advance(PATIENCE_MS.susun * 3);

      expect(patience()).toBe(Math.round(PATIENCE_FLOOR * 100));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(customer()).toHaveAttribute('data-mood', 'waiting');
    });

    it('waits longer where there is more to do', async () => {
      setHints('independent');
      const user = useClock();
      await enter(user, 'Dua sekaligus');
      await advance(PATIENCE_MS.susun + 500);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await advance(PATIENCE_MS.dua - PATIENCE_MS.susun);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('cannot be served once they have gone: the pantry is put away', async () => {
      setHints('independent');
      const user = useClock();
      await enter(user, 'Susun');
      await advance(PATIENCE_MS.susun + 200);
      expect(screen.queryByRole('button', { name: /^Roti, sisa/ })).not.toBeInTheDocument();
    });
  });

  describe('level 1: in order', () => {
    it('opens on roti keju, with its recipe in pictures, a pantry and no pot', async () => {
      const user = setupUser();
      await enter(user, 'Susun');

      expect(cards()).toHaveLength(1);
      expect(cards()[0]).toHaveTextContent('Roti keju');
      expect(within(cards()[0]).getAllByRole('listitem')).toHaveLength(3);
      expect(screen.queryByRole('button', { name: /^Kompor / })).not.toBeInTheDocument();
      expect(left('Roti')).toBe(2);
      expect(left('Keju')).toBe(1);
    });

    it('puts an ingredient in and uses one up, saying its name', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      spokenTexts.length = 0;
      await put(user, 'Roti');

      expect(left('Roti')).toBe(1);
      expect(stepStates(cards()[0])).toEqual(['done', 'todo', 'todo']);
      expect(spokenTexts).toContain('Roti');
    });

    it('answers the wrong ingredient softly: nothing used up, the right one named and glowing', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      spokenTexts.length = 0;
      await put(user, 'Keju'); // the recipe starts with roti

      expect(left('Keju')).toBe(1);
      expect(stepStates(cards()[0])).toEqual(['todo', 'todo', 'todo']);
      expect(spokenTexts.join(' ')).toContain('Cari Roti!');
      expect(ingredient('Roti')).toHaveAttribute('data-hint', 'true');
      expect(ingredient('Keju')).not.toHaveAttribute('data-hint');
    });

    it('lets the glow go again after a moment', async () => {
      const user = useClock();
      await enter(user, 'Susun');
      await put(user, 'Keju');
      expect(ingredient('Roti')).toHaveAttribute('data-hint', 'true');

      await advance(3000);
      expect(ingredient('Roti')).not.toHaveAttribute('data-hint');
    });

    it('asks for an ingredient twice where the recipe does, and finishes in order', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      await put(user, 'Roti', 'Keju', 'Roti');

      expect(cards()[0]).toHaveAttribute('data-done', 'true');
      expect(screen.getByText('Roti keju jadi!')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Resep berikutnya' })).toBeInTheDocument();
      expect(customer()).toHaveAttribute('data-mood', 'happy');
    });

    it('says "jadi!" and praises, in one run, when the dish is done', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      spokenTexts.length = 0;
      await put(user, 'Roti', 'Keju', 'Roti');

      await vi.waitFor(() => expect(spokenTexts).toContain('Roti keju jadi!'));
      await vi.waitFor(() => expect(spokenTexts.length).toBeGreaterThanOrEqual(2));
    });

    it('goes through the recipes in order, one after another, and round again', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      const recipes = ordersFor('susun');
      for (let n = 0; n <= recipes.length; n += 1) {
        expect(cards()[0]).toHaveTextContent(recipes[n % recipes.length][0].name);
        await make(user, 'susun', n % recipes.length);
        await user.click(screen.getByRole('button', { name: 'Resep berikutnya' }));
        await ring(user);
      }
    });

    it('can start the recipe again, and the customer is still waiting', async () => {
      setHints('independent');
      const user = useClock();
      await enter(user, 'Susun');
      await put(user, 'Roti');
      await advance(10_000);
      await user.click(screen.getByRole('button', { name: 'Mulai lagi' }));

      expect(left('Roti')).toBe(2);
      expect(stepStates(cards()[0])).toEqual(['todo', 'todo', 'todo']);
      expect(patience()).toBeLessThan(90); // starting again is not starting the wait again
    });

    it('offers "start again" only once something has been done', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      expect(screen.queryByRole('button', { name: 'Mulai lagi' })).not.toBeInTheDocument();
    });
  });

  describe('level 2: waiting', () => {
    const cookRotiPanggang = async (user: User) => {
      await put(user, 'Roti', 'Keju');
      await user.click(burner(1));
    };

    it('has a pot in line with the recipe, in its own row, empty until the dish is ready to cook', async () => {
      const user = setupUser();
      await enter(user, 'Tunggu');

      expect(screen.getAllByRole('button', { name: /^Kompor / })).toHaveLength(1);
      expect(within(cards()[0]).getByRole('button', { name: /^Kompor 1,/ })).toBe(burner(1));
      expect(state(1)).toBe('empty');
      expect(within(cards()[0]).getAllByRole('listitem')).toHaveLength(3); // roti, keju, then three seconds of cooking
      expect(cards()[0]).toHaveTextContent('Roti panggang');
      expect(screen.queryByRole('region', { name: 'Kompor' })).not.toBeInTheDocument(); // no separate stove
    });

    it('takes the dish on its pot, says to wait, and counts the seconds down', async () => {
      const user = useClock();
      await enter(user, 'Tunggu');
      await put(user, 'Roti', 'Keju');
      expect(spokenTexts.join(' ')).toContain('Masak dulu!');
      spokenTexts.length = 0;
      await user.click(burner(1));

      expect(state(1)).toBe('cooking');
      expect(spokenTexts).toContain('Tunggu ya!');
      expect(screen.getByTestId('seconds-left')).toHaveTextContent('3');
      await advance(1100);
      expect(screen.getByTestId('seconds-left')).toHaveTextContent('2');
    });

    it('rings and says so when it is ready, and a tap takes it off: the dish is done', async () => {
      const user = useClock();
      await enter(user, 'Tunggu');
      await cookRotiPanggang(user);
      spokenTexts.length = 0;
      await advance(3200);

      expect(state(1)).toBe('ready');
      expect(spokenTexts).toContain('Sudah matang! Ketuk!');

      await user.click(burner(1));
      expect(state(1)).toBe('empty');
      expect(cards()[0]).toHaveAttribute('data-done', 'true');
      expect(screen.getByRole('button', { name: 'Resep berikutnya' })).toBeInTheDocument();
    });

    it('says "Tunggu ya!" to a tap that comes too early, and carries on cooking', async () => {
      const user = useClock();
      await enter(user, 'Tunggu');
      await cookRotiPanggang(user);
      await advance(1000);
      spokenTexts.length = 0;
      await user.click(burner(1));

      expect(state(1)).toBe('cooking');
      expect(spokenTexts).toContain('Tunggu ya!');
      expect(cards()[0]).not.toHaveAttribute('data-done');
    });

    it('does not count a tap that comes too early against the child', async () => {
      setHints('independent', 0);
      const user = useClock();
      await enter(user, 'Tunggu');
      await cookRotiPanggang(user);
      await user.click(burner(1));
      await user.click(burner(1));

      expect(hintState()).toEqual({ level: 'independent', streak: 0 });
    });

    it('does nothing to an empty pot while the dish is not ready to cook', async () => {
      const user = setupUser();
      await enter(user, 'Tunggu');
      await user.click(burner(1));

      expect(state(1)).toBe('empty');
    });

    it('does not take more ingredients into a dish that is cooking', async () => {
      const user = useClock();
      await enter(user, 'Tunggu');
      await cookRotiPanggang(user);
      await put(user, 'Roti');

      expect(left('Roti')).toBe(1); // 2 on the shelf, one used - the second tap went nowhere
    });

    it('burns what is left too long: it says so, and a tap throws it away and starts the dish again', async () => {
      const user = useClock();
      await enter(user, 'Tunggu');
      await cookRotiPanggang(user);
      spokenTexts.length = 0;
      await advance(3000 + BURN_GRACE_MS + 300);

      expect(state(1)).toBe('burnt');
      expect(spokenTexts).toContain('Gosong! Coba lagi.');

      await user.click(burner(1));
      expect(state(1)).toBe('empty');
      expect(stepStates(cards()[0]).every((s) => s === 'todo')).toBe(true);
      expect(left('Roti')).toBe(1); // the spare
    });

    it('counts a burnt dish as a miss for the hints, once', async () => {
      setHints('independent', 0);
      const user = useClock();
      await enter(user, 'Tunggu');
      await cookRotiPanggang(user); // two right ingredients first
      await advance(3000 + BURN_GRACE_MS + 1000);

      expect(hintState()).toEqual({ level: 'independent', streak: 1 });
    });

    it('goes shopping when the dish has burnt twice and the shelves are bare, and fills them again', async () => {
      const user = useClock();
      await enter(user, 'Tunggu');
      for (let n = 0; n < 2; n += 1) {
        await cookRotiPanggang(user);
        await advance(3000 + BURN_GRACE_MS + 300);
        await user.click(burner(1)); // throw it away
        if (n === 0) expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      }

      expect(screen.getByRole('alert')).toHaveTextContent('Habis! Ayo belanja lagi!');
      expect(spokenTexts).toContain('Habis! Ayo belanja lagi!');

      await advance(SHOP_AGAIN_MS + 200);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(left('Roti')).toBe(2);
      expect(left('Keju')).toBe(2);
      expect(stepStates(cards()[0]).every((s) => s === 'todo')).toBe(true);
    });

    it('cannot burn for a child who is being guided: it waits, ready', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = useClock();
      await enter(user, 'Tunggu');
      await cookRotiPanggang(user);
      await advance(3000 + BURN_GRACE_MS * 3);

      expect(state(1)).toBe('ready');
    });

    it('is not touched by the clock when nothing is cooking', async () => {
      setHints('independent');
      const user = useClock();
      await enter(user, 'Tunggu');
      await advance(10_000);

      expect(state(1)).toBe('empty');
    });
  });

  describe('level 3: two at once', () => {
    it('shows two dishes, each with its own pot in its own row', async () => {
      const user = setupUser();
      await enter(user, 'Dua sekaligus');

      expect(cards()).toHaveLength(2);
      expect(cards()[0]).toHaveTextContent('Nasi goreng');
      expect(cards()[1]).toHaveTextContent('Telur rebus');
      expect(within(cards()[0]).getByRole('button', { name: /^Kompor 1,/ })).toBeInTheDocument();
      expect(within(cards()[1]).getByRole('button', { name: /^Kompor 2,/ })).toBeInTheDocument();
      expect(within(cards()[0]).queryByRole('button', { name: /^Kompor 2,/ })).not.toBeInTheDocument();
      expect(spokenTexts).toContain('Selamat datang! Ayo masak Nasi goreng dan Telur rebus!');
    });

    it('lets the dishes be worked on in either order, each ingredient going where it belongs', async () => {
      const user = setupUser();
      await enter(user, 'Dua sekaligus');
      await put(user, 'Telur'); // telur rebus starts with an egg
      expect(stepStates(cards()[0])).toEqual(['todo', 'todo', 'todo']);
      expect(stepStates(cards()[1])).toEqual(['done', 'todo', 'todo']);

      await put(user, 'Nasi', 'Telur'); // nasi goreng's nasi, then its egg
      expect(stepStates(cards()[0])).toEqual(['done', 'done', 'todo']);
    });

    it('shares the pantry between the dishes: two eggs, both used', async () => {
      const user = setupUser();
      await enter(user, 'Dua sekaligus');
      expect(left('Telur')).toBe(3); // two needed, one spare for a burnt dish
      await put(user, 'Telur', 'Nasi', 'Telur');
      expect(left('Telur')).toBe(1);
    });

    it('cooks one dish while the other is made, then the second on its own pot', async () => {
      const user = useClock();
      await enter(user, 'Dua sekaligus');
      await put(user, 'Nasi', 'Telur'); // nasi goreng is ready for its pot
      await user.click(burner(1));
      expect(state(1)).toBe('cooking');
      expect(state(2)).toBe('empty');

      await put(user, 'Telur', 'Air'); // telur rebus, while the first one cooks
      await user.click(burner(2));
      expect(state(2)).toBe('cooking');
      expect(state(1)).toBe('cooking');
    });

    it('finishes both, taking each off as it is ready, and celebrates only then', async () => {
      const user = useClock();
      await enter(user, 'Dua sekaligus');
      await put(user, 'Nasi', 'Telur');
      await user.click(burner(1)); // 4 seconds
      await put(user, 'Telur', 'Air');
      await user.click(burner(2)); // 4 seconds
      await advance(4300);
      expect(state(1)).toBe('ready');
      expect(state(2)).toBe('ready');

      await user.click(burner(1));
      expect(cards()[0]).toHaveAttribute('data-done', 'true');
      expect(screen.queryByRole('button', { name: 'Resep berikutnya' })).not.toBeInTheDocument();

      await user.click(burner(2));
      expect(cards()[1]).toHaveAttribute('data-done', 'true');
      expect(screen.getByRole('button', { name: 'Resep berikutnya' })).toBeInTheDocument();
      expect(screen.getByText('Nasi goreng dan Telur rebus jadi!')).toBeInTheDocument();
    });

    it('starts only the dish whose pot is tapped, and not one that is not waiting yet', async () => {
      const user = useClock();
      await enter(user, 'Dua sekaligus');
      await put(user, 'Nasi', 'Telur'); // nasi goreng is waiting; telur rebus has its first step to go
      await user.click(burner(2));
      expect(state(2)).toBe('empty');
      expect(state(1)).toBe('empty');

      await user.click(burner(1));
      expect(state(1)).toBe('cooking');
    });
  });

  describe('level 4: stirring', () => {
    const readyToStir = async (user: User) => {
      await put(user, 'Nasi', 'Air'); // bubur nasi
    };

    it('has a spoon in line with the recipe, next to the pot, and the stirring on the card', async () => {
      const user = setupUser();
      await enter(user, 'Aduk');

      expect(cards()[0]).toHaveTextContent('Bubur nasi');
      expect(within(cards()[0]).getAllByRole('listitem')).toHaveLength(4); // nasi, air, stir x4, cook
      expect(within(cards()[0]).getByRole('button', { name: /^Sendok 1, aduk 0 dari 4/ })).toBe(spoon(1));
      expect(within(cards()[0]).getByRole('button', { name: /^Kompor 1,/ })).toBeInTheDocument();
      expect(cards()[0]).toHaveTextContent('×4');
    });

    it('is not for stirring until the ingredients are in: the spoon only makes its sound', async () => {
      const user = setupUser();
      await enter(user, 'Aduk');
      const tones = playedToneCounts.value;
      await user.click(spoon(1));

      expect(spoon(1)).toHaveAttribute('data-stirred', '0');
      expect(spoon(1)).not.toHaveAttribute('data-waiting');
      expect(playedToneCounts.value).toBeGreaterThan(tones);
      expect(stepStates(cards()[0])).toEqual(['todo', 'todo', 'todo', 'todo']);
    });

    it('stirs once for each tap, counting aloud, and goes on when it has had as many as it wants', async () => {
      const user = setupUser();
      await enter(user, 'Aduk');
      await readyToStir(user);
      expect(spoon(1)).toHaveAttribute('data-waiting', 'true');
      spokenTexts.length = 0;

      for (const [n, word] of [[1, 'satu'], [2, 'dua'], [3, 'tiga']] as const) {
        await user.click(spoon(1));
        expect(spoon(1)).toHaveAttribute('data-stirred', String(n));
        expect(spokenTexts).toContain(word);
      }
      expect(cards()[0]).toHaveTextContent('3/4');
      expect(stepStates(cards()[0])).toEqual(['done', 'done', 'todo', 'todo']);

      await user.click(spoon(1));
      expect(stepStates(cards()[0])).toEqual(['done', 'done', 'done', 'todo']);
      expect(spoon(1)).toHaveAttribute('data-stirred', '0');
      expect(spoon(1)).not.toHaveAttribute('data-waiting');
    });

    it('says to cook once the stirring is done, and then the pot takes it', async () => {
      const user = useClock();
      await enter(user, 'Aduk');
      await readyToStir(user);
      for (let n = 0; n < 3; n += 1) await user.click(spoon(1));
      spokenTexts.length = 0;
      await user.click(spoon(1));
      expect(spokenTexts.join(' ')).toContain('Masak dulu!');

      await user.click(burner(1));
      expect(state(1)).toBe('cooking');
      await advance(5200);
      await user.click(burner(1));
      expect(cards()[0]).toHaveAttribute('data-done', 'true');
    });

    it('does not take another stir after the stirring is done', async () => {
      const user = setupUser();
      await enter(user, 'Aduk');
      await readyToStir(user);
      for (let n = 0; n < 6; n += 1) await user.click(spoon(1));

      expect(spoon(1)).toHaveAttribute('data-stirred', '0');
      expect(stepStates(cards()[0])).toEqual(['done', 'done', 'done', 'todo']);
    });

    it('is asked for after a wrong ingredient when the dish is waiting to be stirred: "Aduk!" and a glowing spoon', async () => {
      const user = setupUser();
      await enter(user, 'Aduk');
      await readyToStir(user);
      spokenTexts.length = 0;
      // Anything on the shelf that is not nasi or air: not what the dish is waiting for.
      const other = screen.getAllByRole('button', { name: /, sisa/ }).find((b) => !/^(Nasi|Air),/.test(b.getAttribute('aria-label') ?? ''))!;
      await user.click(other);

      expect(spokenTexts).toContain('Aduk!');
      expect(spoon(1)).toHaveAttribute('data-hint', 'true');
    });

    it('is lost with the dish when it burns: the stirring has to be done again', async () => {
      setHints('independent');
      const user = useClock();
      await enter(user, 'Aduk');
      await readyToStir(user);
      for (let n = 0; n < 4; n += 1) await user.click(spoon(1));
      await user.click(burner(1));
      await advance(5000 + BURN_GRACE_MS + 300);
      await user.click(burner(1)); // throw it away

      expect(stepStates(cards()[0]).every((s) => s === 'todo')).toBe(true);
      expect(spoon(1)).toHaveAttribute('data-stirred', '0');
    });

    it('counts a finished stirring as one right choice for the hints', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = setupUser();
      await enter(user, 'Aduk');
      await readyToStir(user); // two right
      expect(hintState()).toEqual({ level: 'guided', streak: 2 });
      for (let n = 0; n < 3; n += 1) await user.click(spoon(1));
      expect(hintState()).toEqual({ level: 'guided', streak: 2 }); // three stirs of four: not yet
      await user.click(spoon(1));
      expect(hintState()).toEqual({ level: 'independent', streak: 0 });
    });
  });

  describe('level 5: if the customer likes it', () => {
    it('shows what the customer likes beside them, with a tick, and what to put in for each answer on the card', async () => {
      const user = setupUser();
      await enter(user, 'Kalau');

      expect(cards()[0]).toHaveTextContent('Mie rebus');
      expect(screen.getByRole('img', { name: 'Suka pedas' })).toBeInTheDocument();
      const branch = within(cards()[0]).getByRole('listitem', { name: /^Langkah 3: kalau suka pedas, Cabai; kalau tidak, Telur/ });
      expect(branch).toBeInTheDocument();
    });

    it('puts in what the customer asked for: chilli for one who likes it spicy', async () => {
      const user = setupUser();
      await enter(user, 'Kalau'); // mie rebus for someone who likes pedas
      await put(user, 'Mie', 'Air');
      spokenTexts.length = 0;
      await put(user, 'Telur'); // not for this customer

      expect(spokenTexts.join(' ')).toContain('Cari Cabai!');
      expect(ingredient('Cabai')).toHaveAttribute('data-hint', 'true');
      await put(user, 'Cabai');
      expect(stepStates(cards()[0])).toEqual(['done', 'done', 'done', 'todo']);
    });

    it('has both choices on the shelf, so there is something to choose', async () => {
      const user = setupUser();
      await enter(user, 'Kalau');

      expect(ingredient('Cabai')).toBeInTheDocument();
      expect(ingredient('Telur')).toBeInTheDocument();
      expect(left('Cabai')).toBeGreaterThanOrEqual(1);
      expect(left('Telur')).toBeGreaterThanOrEqual(1);
    });

    it('puts in the other one for the next customer, who does not like it spicy', async () => {
      const user = useClock();
      await enter(user, 'Kalau');
      await put(user, 'Mie', 'Air', 'Cabai');
      await user.click(burner(1));
      await advance(5200);
      await user.click(burner(1));
      await user.click(screen.getByRole('button', { name: 'Resep berikutnya' }));
      await ring(user);

      // Nasi goreng, for a customer who does not like pedas: telur, not cabai.
      expect(cards()[0]).toHaveTextContent('Nasi goreng');
      expect(screen.getByRole('img', { name: 'Tidak suka pedas' })).toBeInTheDocument();
      await put(user, 'Nasi');
      spokenTexts.length = 0;
      await put(user, 'Cabai');
      expect(spokenTexts.join(' ')).toContain('Cari Telur!');
      await put(user, 'Telur');
      expect(stepStates(cards()[0])).toEqual(['done', 'done', 'todo']);
    });

    it('asks for the sweet one from a customer who likes sweet things', async () => {
      const user = useClock();
      await enter(user, 'Kalau');
      for (let n = 0; n < 2; n += 1) {
        const steps = ordersFor('kalau')[n][0].steps.filter((s) => s.kind === 'add');
        for (const step of steps) if (step.kind === 'add') await put(user, cap(step.ingredient));
        await user.click(burner(1));
        await advance(6000);
        await user.click(burner(1));
        await user.click(screen.getByRole('button', { name: 'Resep berikutnya' }));
        await ring(user);
      }

      // Roti panggang, for a customer who likes manis: pisang.
      expect(cards()[0]).toHaveTextContent('Roti panggang');
      expect(screen.getByRole('img', { name: 'Suka manis' })).toBeInTheDocument();
      await put(user, 'Roti');
      expect(ingredient('Pisang')).toBeInTheDocument();
      await put(user, 'Keju');
      expect(stepStates(cards()[0])).toEqual(['done', 'todo', 'todo']);
      await put(user, 'Pisang');
      expect(stepStates(cards()[0])).toEqual(['done', 'done', 'todo']);
    });

    it('is a choice that counts: a wrong one is a miss for the hints', async () => {
      setHints('independent');
      const user = setupUser();
      await enter(user, 'Kalau');
      await put(user, 'Mie', 'Air');
      await put(user, 'Telur');
      expect(hintState()).toEqual({ level: 'independent', streak: 1 });
    });
  });

  describe('the hints', () => {
    it('start guided for a new child: the next step in the recipe and the ingredient to tap are marked', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = setupUser();
      await enter(user, 'Susun');

      expect(stepStates(cards()[0])).toEqual(['next', 'todo', 'todo']);
      expect(ingredient('Roti')).toHaveAttribute('data-hint', 'true');

      await put(user, 'Roti');
      expect(stepStates(cards()[0])).toEqual(['done', 'next', 'todo']);
      expect(ingredient('Keju')).toHaveAttribute('data-hint', 'true');
      expect(ingredient('Roti')).not.toHaveAttribute('data-hint');
    });

    it('point at the pot when a dish is ready for it, and again when it is done', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = useClock();
      await enter(user, 'Tunggu');
      await put(user, 'Roti', 'Keju');
      expect(burner(1)).toHaveAttribute('data-hint', 'true');

      await user.click(burner(1));
      expect(burner(1)).not.toHaveAttribute('data-hint');
      await advance(3200);
      expect(burner(1)).toHaveAttribute('data-hint', 'true');
    });

    it('point at the spoon when a dish wants stirring', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = setupUser();
      await enter(user, 'Aduk');
      await put(user, 'Nasi', 'Air');

      expect(spoon(1)).toHaveAttribute('data-hint', 'true');
    });

    it('are off for a child who has graduated: nothing marked', async () => {
      const user = setupUser();
      await enter(user, 'Susun');

      expect(stepStates(cards()[0])).toEqual(['todo', 'todo', 'todo']);
      expect(document.querySelector('[data-hint]')).toBeNull();
    });

    it('fade after three right choices in a row', async () => {
      window.localStorage.removeItem(HINTS_STORAGE_KEY);
      const user = setupUser();
      await enter(user, 'Susun');
      await put(user, 'Roti', 'Keju', 'Roti');

      expect(hintState()).toEqual({ level: 'independent', streak: 0 });
    });

    it('come back after two wrong choices in a row', async () => {
      setHints('independent', 0);
      const user = setupUser();
      await enter(user, 'Susun');
      await put(user, 'Keju', 'Keju');

      expect(hintState().level).toBe('guided');
    });
  });

  describe('leaving', () => {
    it(`is gated until ${UNLOCK_AFTER_GAMES} dishes are cooked`, async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      const home = () => screen.getByRole('button', { name: 'Kembali ke menu utama' });
      expect(home()).toHaveAttribute('data-locked', 'true');

      for (let n = 0; n < UNLOCK_AFTER_GAMES; n += 1) {
        await make(user, 'susun', n);
        if (n < UNLOCK_AFTER_GAMES - 1) {
          await user.click(screen.getByRole('button', { name: 'Resep berikutnya' }));
          await ring(user);
        }
      }
      expect(home()).not.toHaveAttribute('data-locked');
    });

    it('stops reading out the ingredients once the child knows the drill', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      for (let n = 0; n < 3; n += 1) {
        await make(user, 'susun', n);
        await user.click(screen.getByRole('button', { name: 'Resep berikutnya' }));
        await ring(user);
      }

      expect(spokenTexts).toContain('Selamat datang! Ayo masak Susu pisang!');
    });
  });
});
