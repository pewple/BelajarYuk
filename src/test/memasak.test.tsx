import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupUser } from './user';
import App from '../App';
import { HINTS_STORAGE_KEY } from '../data/hints';
import { BURN_GRACE_MS, ordersFor } from '../data/memasak';
import { UNLOCK_AFTER_GAMES } from '../data/session';
import { SHOP_AGAIN_MS } from '../screens/MasakScreen';
import { leaveGame } from './helpers';
import { installVoice, spokenTexts } from './setup';

type User = ReturnType<typeof userEvent.setup>;
type Choice = 'Susun' | 'Tunggu' | 'Dua sekaligus';

/* ------------------------------------------------------------------ */
/* Drivers                                                             */
/* ------------------------------------------------------------------ */

async function open(user: User) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Memasak/ }));
}

async function enter(user: User, choice: Choice) {
  await open(user);
  await user.click(screen.getByRole('button', { name: choice }));
}

const ingredient = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}, sisa`) });
const left = (name: string) => Number(ingredient(name).getAttribute('data-left'));
const burner = (n: number) => screen.getByRole('button', { name: new RegExp(`^Kompor ${n},`) });
const state = (n: number) => burner(n).getAttribute('data-state');
const cards = () => screen.getAllByTestId('order-card');
const stepStates = (card: HTMLElement) =>
  within(card).getAllByRole('listitem').map((li) => li.getAttribute('data-state'));

async function put(user: User, ...names: string[]) {
  for (const name of names) await user.click(ingredient(name));
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

    it('asks first how to cook, out loud and in writing, with no kitchen yet', async () => {
      const user = setupUser();
      await open(user);

      expect(screen.getByRole('heading', { name: 'Memasak' })).toBeInTheDocument();
      for (const name of ['Susun', 'Tunggu', 'Dua sekaligus']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
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

  describe('level 1: in order', () => {
    it('opens on roti keju, with its recipe in pictures, a pantry and no stove', async () => {
      const user = setupUser();
      await enter(user, 'Susun');

      expect(cards()).toHaveLength(1);
      expect(cards()[0]).toHaveTextContent('Roti keju');
      expect(within(cards()[0]).getAllByRole('listitem')).toHaveLength(3);
      expect(screen.queryByRole('region', { name: 'Kompor' })).not.toBeInTheDocument();
      expect(left('Roti')).toBe(2);
      expect(left('Keju')).toBe(1);
    });

    it('says the order and its ingredients out loud', async () => {
      const user = setupUser();
      await enter(user, 'Susun');

      expect(spokenTexts).toContain('Ayo masak Roti keju! Roti, Keju, Roti!');
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
    });

    it('says "jadi!" and praises, in one run, when the dish is done', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      spokenTexts.length = 0;
      await put(user, 'Roti', 'Keju', 'Roti');

      await vi.waitFor(() => expect(spokenTexts).toContain('Roti keju jadi!'));
      await vi.waitFor(() => expect(spokenTexts.length).toBeGreaterThanOrEqual(2));
    });

    it('moves on to the next recipe with a fresh pantry', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      await put(user, 'Roti', 'Keju', 'Roti');
      await user.click(screen.getByRole('button', { name: 'Resep berikutnya' })); // nasi telur
      expect(cards()[0]).toHaveTextContent('Nasi telur');
      expect(left('Nasi')).toBe(1);
    });

    it('goes through the recipes in order, one after another, and round again', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      const seen: string[] = [];
      const recipes = ordersFor('susun');
      for (let n = 0; n <= recipes.length; n += 1) {
        seen.push(cards()[0].textContent!);
        const { steps } = recipes[n % recipes.length][0];
        for (const step of steps) if (step.kind === 'add') {
          const name = step.ingredient[0].toUpperCase() + step.ingredient.slice(1);
          await put(user, name);
        }
        await user.click(screen.getByRole('button', { name: 'Resep berikutnya' }));
      }

      expect(seen.map((text, i) => text.includes(recipes[i % recipes.length][0].name))).toEqual(seen.map(() => true));
      expect(seen).toHaveLength(recipes.length + 1);
    });

    it('can start the recipe again', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      await put(user, 'Roti');
      await user.click(screen.getByRole('button', { name: 'Mulai lagi' }));

      expect(left('Roti')).toBe(2);
      expect(stepStates(cards()[0])).toEqual(['todo', 'todo', 'todo']);
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

    it('has one burner, empty until a dish is ready to cook', async () => {
      const user = setupUser();
      await enter(user, 'Tunggu');

      expect(screen.getAllByRole('button', { name: /^Kompor / })).toHaveLength(1);
      expect(state(1)).toBe('empty');
      expect(within(cards()[0]).getAllByRole('listitem')).toHaveLength(3); // roti, keju, then three seconds of cooking
      expect(cards()[0]).toHaveTextContent('Roti panggang');
    });

    it('takes the pot on the stove, says to wait, and counts the seconds down', async () => {
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

    it('does nothing to an empty burner while nothing is ready to cook', async () => {
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
      const user = useClock();
      await enter(user, 'Tunggu');
      await advance(60_000);

      expect(state(1)).toBe('empty');
    });
  });

  describe('level 3: two at once', () => {
    it('shows two dishes and two burners', async () => {
      const user = setupUser();
      await enter(user, 'Dua sekaligus');

      expect(cards()).toHaveLength(2);
      expect(cards()[0]).toHaveTextContent('Nasi goreng');
      expect(cards()[1]).toHaveTextContent('Telur rebus');
      expect(screen.getAllByRole('button', { name: /^Kompor / })).toHaveLength(2);
      expect(spokenTexts).toContain('Ayo masak Nasi goreng dan Telur rebus!');
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

    it('cooks one dish while the other is made, then the second on the other burner', async () => {
      const user = useClock();
      await enter(user, 'Dua sekaligus');
      await put(user, 'Nasi', 'Telur'); // nasi goreng is ready for the stove
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

    it('puts the first dish that is waiting on whichever burner is tapped', async () => {
      const user = useClock();
      await enter(user, 'Dua sekaligus');
      await put(user, 'Nasi', 'Telur');
      await user.click(burner(2));

      expect(state(2)).toBe('cooking');
      expect(state(1)).toBe('empty');
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

    it('point at the burner when a dish is ready for it, and again when it is done', async () => {
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

      const recipes = ordersFor('susun');
      for (let n = 0; n < UNLOCK_AFTER_GAMES; n += 1) {
        for (const step of recipes[n][0].steps) {
          if (step.kind === 'add') await put(user, step.ingredient[0].toUpperCase() + step.ingredient.slice(1));
        }
        if (n < UNLOCK_AFTER_GAMES - 1) await user.click(screen.getByRole('button', { name: 'Resep berikutnya' }));
      }
      expect(home()).not.toHaveAttribute('data-locked');
    });

    it('stops reading out the ingredients once the child knows the drill', async () => {
      const user = setupUser();
      await enter(user, 'Susun');
      const recipes = ordersFor('susun');
      for (let n = 0; n < 3; n += 1) {
        for (const step of recipes[n][0].steps) {
          if (step.kind === 'add') await put(user, step.ingredient[0].toUpperCase() + step.ingredient.slice(1));
        }
        await user.click(screen.getByRole('button', { name: 'Resep berikutnya' }));
      }

      expect(spokenTexts).toContain('Ayo masak Susu pisang!');
    });
  });
});
