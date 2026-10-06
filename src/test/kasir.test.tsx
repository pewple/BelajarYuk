import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { CHANGE_PIECES, CHECKOUTS, changeOwed, formatRupiah } from '../data/money';
import { PRAISE_ID, respellForEnglishVoice } from '../hooks/useAudio';
import { changeLine, paidLine, priceLine, promptLine, stepsFor, totalLine, wrongLine } from '../media/moneyVoice';
import {
  installVoice,
  playedNoiseCounts,
  playedToneCounts,
  setMediaManifest,
  spokenTexts,
  spokenUtterances,
} from './setup';

type User = ReturnType<typeof userEvent.setup>;

async function openKasir(user: User) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /Kasir/ }));
}

const piece = (amount: number) => screen.getByRole('button', { name: `Tambah ${formatRupiah(amount)}` });
const trayNames = () => screen.queryAllByRole('button', { name: /^Tambah Rp / }).map((b) => b.getAttribute('aria-label'));
const next = (user: User) => user.click(screen.getByRole('button', { name: 'Pembeli berikutnya' }));

/** Pieces that make `owed`, largest first. Always exact, since every amount is a multiple of 500. */
function piecesFor(owed: number): number[] {
  const out: number[] = [];
  let left = owed;
  for (const p of [...CHANGE_PIECES].reverse()) {
    while (left >= p) {
      out.push(p);
      left -= p;
    }
  }
  return out;
}

async function give(user: User, ...amounts: number[]) {
  for (const amount of amounts) await user.click(piece(amount));
}

/** Gives exactly the change owed to customer `n` (0-based) and moves on to the next. */
async function serve(user: User, n: number) {
  await give(user, ...piecesFor(changeOwed(CHECKOUTS[n])));
  await next(user);
}

/** Opens the app on customer `n`, having correctly served everyone before them. */
async function openAt(user: User, n: number) {
  await openKasir(user);
  for (let i = 0; i < n; i += 1) await serve(user, i);
}

const display = () => screen.getByText('Kembalian diberikan').parentElement!;
const sum = () => screen.getByRole('region', { name: 'Cara menghitung kembalian' });

// Customer indexes, by what they are owed. Named so the tests read as intent.
const OWES_500 = 0; // Permen    1.500 -> 2.000
const OWES_1500 = 3; // Es Krim  3.500 -> 5.000
const OWES_3000 = 4; // Susu     7.000 -> 10.000
const OWES_8000 = 7; // Roti     12.000 -> 20.000

describe('Kasir', () => {
  // These tests are about what the register says and does, so they run with an
  // Indonesian voice present and the words spoken as written. The fallback for
  // a device without one is covered further down.
  beforeEach(() => installVoice('Test Indonesian', 'id-ID'));

  describe('opening it', () => {
    it('is the last card on the home screen', () => {
      render(<App />);

      const cards = screen.getAllByRole('button');
      expect(cards).toHaveLength(5);
      expect(cards[cards.length - 1]).toHaveTextContent('Kasir');
    });

    it('opens on the first customer and returns home', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      expect(screen.getByRole('heading', { name: 'Kasir' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Kembali ke menu utama' }));
      expect(screen.getByRole('heading', { name: 'Belajar Yuk!' })).toBeInTheDocument();
    });
  });

  describe('a customer arrives', () => {
    it('shows what is bought, what it costs and what was paid', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      const { item, price, paid } = CHECKOUTS[0];
      const customer = screen.getByRole('region', { name: 'Pembeli' });
      expect(customer).toHaveTextContent(item);
      expect(customer).toHaveTextContent(formatRupiah(price));
      expect(customer).toHaveTextContent(formatRupiah(paid));
    });

    it('says the price, the payment and the instruction out loud, as one sentence', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      expect(spokenTexts).toContain(
        'Harganya seribu lima ratus rupiah. Dibayar dua ribu rupiah. Ayo hitung kembaliannya!',
      );
    });

    it('starts with no change given, and the amount owed still a question', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      expect(display()).toHaveTextContent('Rp 0');
      expect(screen.getByText('Soal: dibayar 2.000 dikurangi harga 1.500, berapa kembaliannya?')).toBeInTheDocument();
      // Shown as the sum with its answer hidden - working it out is the point.
      expect(sum()).toHaveTextContent('Soal: 2.000 − 1.500 = ?');
      expect(sum()).not.toHaveTextContent('= 500');
      expect(screen.queryByText(/^Langkah /)).not.toBeInTheDocument();
      expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
    });
  });

  describe('the tray', () => {
    const FOUR = ['Tambah Rp 500', 'Tambah Rp 1.000', 'Tambah Rp 2.000', 'Tambah Rp 5.000'];

    it('always holds the same four pieces: 500, 1.000, 2.000 and 5.000', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      expect(trayNames()).toEqual(FOUR);
    });

    it('never hides a piece for being too big, even when only Rp 500 is owed', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      // This customer is owed Rp 500, yet the Rp 5.000 piece is right there:
      // taking it is the mistake the game exists to let a child make and fix.
      expect(changeOwed(CHECKOUTS[OWES_500])).toBe(500);
      expect(trayNames()).toContain('Tambah Rp 5.000');
    });

    it('is unchanged from the first customer to the last, and part-way through a count', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_8000);

      expect(trayNames()).toEqual(FOUR);
      await give(user, 5000);
      expect(trayNames()).toEqual(FOUR);
      await give(user, 2000);
      expect(trayNames()).toEqual(FOUR);
    });

    it('has every piece enabled to start with', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      for (const name of FOUR) expect(screen.getByRole('button', { name })).toBeEnabled();
    });
  });

  describe('giving the right change', () => {
    it('finishes a one-piece round: shows the sum, announces the change and celebrates', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      await give(user, 500);

      expect(screen.getByText('Langkah 1: 0 ditambah 500 sama dengan 500')).toBeInTheDocument();
      expect(screen.getByText('Kembalian: 2.000 dikurangi 1.500 sama dengan 500')).toBeInTheDocument();
      expect(sum()).toHaveTextContent('2.000 − 1.500 = 500');
      expect(screen.getByTestId('celebration')).toBeInTheDocument();
      expect(spokenTexts).toContain('Kembaliannya lima ratus rupiah!');
      // Once it is right there is nothing left to hand back.
      expect(trayNames()).toEqual([]);
    });

    it('praises after the change, without cutting it off', async () => {
      const user = userEvent.setup();
      await openKasir(user);
      await give(user, 500);

      await waitFor(() =>
        expect(spokenTexts.some((t) => (PRAISE_ID as readonly string[]).includes(t))).toBe(true),
      );
      const changeAt = spokenTexts.indexOf('Kembaliannya lima ratus rupiah!');
      const praiseAt = spokenTexts.findIndex((t) => (PRAISE_ID as readonly string[]).includes(t));
      expect(changeAt).toBeGreaterThanOrEqual(0);
      expect(praiseAt).toBeGreaterThan(changeAt);
    });

    it('accepts any combination that adds up - the order and the pieces are the child\'s choice', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_3000);

      // 3.000 as 500 + 1.000 + 500 + 1.000, not the tidy 2.000 + 1.000.
      await give(user, 500, 1000, 500, 1000);

      expect(screen.getByText('Kembalian: 10.000 dikurangi 7.000 sama dengan 3.000')).toBeInTheDocument();
      expect(screen.getByTestId('celebration')).toBeInTheDocument();
    });

    it('works out for every customer, whichever way the pieces are taken', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      for (let n = 0; n < CHECKOUTS.length; n += 1) {
        // Smallest pieces only - the longest way of paying - for odd customers,
        // largest first for even ones.
        const owed = changeOwed(CHECKOUTS[n]);
        const pieces = n % 2 === 0 ? piecesFor(owed) : Array<number>(owed / 500).fill(500);
        await give(user, ...pieces);

        expect(screen.getByRole('button', { name: 'Pembeli berikutnya' }), CHECKOUTS[n].item).toBeInTheDocument();
        await next(user);
      }
    });
  });

  describe('the feedback on each piece', () => {
    it('reports only the change given so far - never the price plus the change', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_3000); // price 7.000, owed 3.000

      spokenTexts.length = 0;
      await give(user, 1000);
      // 7.000 + 1.000 would be "delapan ribu". The change given is "seribu".
      expect(spokenTexts).toContain('seribu');
      expect(spokenTexts).not.toContain('delapan ribu');

      await give(user, 500);
      expect(spokenTexts).toContain('seribu lima ratus');

      await give(user, 1000);
      expect(spokenTexts).toContain('dua ribu lima ratus');
      expect(spokenTexts).not.toContain('sembilan ribu lima ratus');
    });

    it('shows that same total on the display, and nothing else', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_3000);

      await give(user, 1000);
      expect(display()).toHaveTextContent('Rp 1.000');

      await give(user, 500);
      expect(display()).toHaveTextContent('Rp 1.500');
      expect(display()).not.toHaveTextContent('Rp 8.500'); // 7.000 + 1.500
    });

    it('writes each step as change adding up from nothing', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_3000);
      await give(user, 1000, 500);

      expect(screen.getByText('Langkah 1: 0 ditambah 1.000 sama dengan 1.000')).toBeInTheDocument();
      expect(screen.getByText('Langkah 2: 1.000 ditambah 500 sama dengan 1.500')).toBeInTheDocument();
      // The old way - counting up from the price - is gone.
      expect(sum()).not.toHaveTextContent('Mulai dari harga');
      expect(screen.queryByText(/ditambah .* sama dengan 8\.500/)).not.toBeInTheDocument();
    });

    it('does not finish early, and keeps the answer hidden until it is right', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_3000);
      await give(user, 2000);

      expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
      expect(screen.queryByText(/^Kembalian:/)).not.toBeInTheDocument();
      expect(sum()).toHaveTextContent('10.000 − 7.000 = ?');
    });

    it('announces the total of a finished count in the same words as before', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_1500);
      await give(user, 500, 1000);

      expect(spokenTexts).toContain('Kembaliannya seribu lima ratus rupiah!');
    });
  });

  describe('giving too much', () => {
    it('answers "Salah, hitung kembali" - in words on screen and out loud', async () => {
      const user = userEvent.setup();
      await openKasir(user); // owed 500

      spokenTexts.length = 0;
      await give(user, 1000);

      expect(screen.getByRole('alert')).toHaveTextContent('Salah, hitung kembali');
      expect(spokenTexts).toContain('Salah, hitung kembali');
    });

    it('reports nothing else: not the total, and not a celebration', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      spokenTexts.length = 0;
      await give(user, 1000);

      expect(spokenTexts).toEqual(['Salah, hitung kembali']);
      expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
    });

    it('shows the step that went over, so the mistake can be seen', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_1500);
      await give(user, 1000, 2000); // 3.000 > 1.500

      expect(screen.getByText('Langkah 2: 1.000 ditambah 2.000 sama dengan 3.000')).toBeInTheDocument();
      expect(display()).toHaveTextContent('Rp 3.000');
    });

    it('is caught when the amount owed is passed by as little as Rp 500', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_1500);
      await give(user, 1000, 1000); // 2.000: only 500 over 1.500

      expect(screen.getByRole('alert')).toHaveTextContent('Salah, hitung kembali');
    });

    it('is not "wrong" on exactly the amount owed, however it is reached', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_1500);
      await give(user, 1000, 500); // exactly 1.500

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByTestId('celebration')).toBeInTheDocument();
    });

    it('is also caught by a piece that overshoots from part-way', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_3000);
      await give(user, 2000, 2000); // 4.000 > 3.000

      expect(screen.getByRole('alert')).toHaveTextContent('Salah, hitung kembali');
    });

    it('holds the tray while the mistake is cleared, so a flurry of taps cannot pile on', async () => {
      const user = userEvent.setup();
      await openKasir(user);
      await give(user, 1000);

      for (const name of trayNames()) expect(screen.getByRole('button', { name: name! })).toBeDisabled();
    });

    it('then clears the count by itself, and the same customer can be tried again', async () => {
      const user = userEvent.setup();
      await openKasir(user);
      await give(user, 1000);

      await waitFor(() => expect(display()).toHaveTextContent('Rp 0'), { timeout: 4000 });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText(/^Langkah /)).not.toBeInTheDocument();
      for (const name of trayNames()) expect(screen.getByRole('button', { name: name! })).toBeEnabled();

      // Still the same customer, and the right answer now works.
      expect(screen.getByRole('region', { name: 'Pembeli' })).toHaveTextContent(CHECKOUTS[0].item);
      await give(user, 500);
      expect(screen.getByTestId('celebration')).toBeInTheDocument();
    }, 10000);

    it('can be cleared at once with the redo button, without waiting', async () => {
      const user = userEvent.setup();
      await openKasir(user);
      await give(user, 1000);

      await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));

      expect(display()).toHaveTextContent('Rp 0');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      for (const name of trayNames()) expect(screen.getByRole('button', { name: name! })).toBeEnabled();
    });

    it('can go wrong again and again - there is no penalty to accumulate', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      for (let i = 0; i < 3; i += 1) {
        await give(user, 5000);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));
      }
      await give(user, 500);

      expect(screen.getByTestId('celebration')).toBeInTheDocument();
    });
  });

  describe('moving between customers', () => {
    it('goes on to the next customer, with the count and the tray back to the start', async () => {
      const user = userEvent.setup();
      await openKasir(user);
      await serve(user, 0);

      expect(screen.getByRole('region', { name: 'Pembeli' })).toHaveTextContent(CHECKOUTS[1].item);
      expect(display()).toHaveTextContent('Rp 0');
      expect(trayNames()).toHaveLength(4);
    });

    it('goes round again after the last customer', async () => {
      const user = userEvent.setup();
      await openKasir(user);
      for (let n = 0; n < CHECKOUTS.length; n += 1) await serve(user, n);

      expect(screen.getByRole('region', { name: 'Pembeli' })).toHaveTextContent(CHECKOUTS[0].item);
    });

    it('repeats the customer\'s words when the count is redone', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_1500);
      await give(user, 500);

      spokenTexts.length = 0;
      await user.click(screen.getByRole('button', { name: 'Ulangi hitungan' }));

      expect(spokenTexts).toContain('Harganya tiga ribu lima ratus rupiah. Dibayar lima ribu rupiah. Ayo hitung kembaliannya!');
      expect(display()).toHaveTextContent('Rp 0');
    });

    it('offers the redo button only once something has been given', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      expect(screen.queryByRole('button', { name: 'Ulangi hitungan' })).not.toBeInTheDocument();
      await give(user, 500);
      expect(screen.getByRole('button', { name: 'Ulangi hitungan' })).toBeInTheDocument();
    });
  });

  describe('the sounds', () => {
    it('clinks a coin for each piece that is still short, and opens the register only when right', async () => {
      const user = userEvent.setup();
      await openAt(user, OWES_1500);

      playedToneCounts.value = 0;
      playedNoiseCounts.value = 0;
      await give(user, 500);

      // One coin clink (two partials), no register yet: still counting.
      expect(playedToneCounts.value).toBe(2);
      expect(playedNoiseCounts.value).toBe(0);

      await give(user, 1000);

      // A second clink (2) plus the register: a noise "ka" and a three-partial "ching" (3).
      expect(playedToneCounts.value).toBe(2 + 2 + 3);
      expect(playedNoiseCounts.value).toBe(1);
    });

    it('answers too much with the soft nudge - two quiet notes - and no register', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      playedToneCounts.value = 0;
      playedNoiseCounts.value = 0;
      await give(user, 5000);

      // The nudge is two soft notes. No coin clink, no "ka-ching": it was not right.
      expect(playedToneCounts.value).toBe(2);
      expect(playedNoiseCounts.value).toBe(0);
    });
  });

  describe('your own pictures', () => {
    it('show for the item, the payment and each piece in the tray when supplied', async () => {
      setMediaManifest({
        audio: [],
        images: ['shop/permen.png', 'money/2000.png', 'money/500.png', 'money/5000.png'],
      });
      const user = userEvent.setup();
      await openKasir(user);

      const customer = screen.getByRole('region', { name: 'Pembeli' });
      const sources = [...customer.querySelectorAll('img')].map((img) => img.getAttribute('src'));
      expect(sources).toEqual(['media/images/shop/permen.png', 'media/images/money/2000.png']);

      expect(piece(500).querySelector('img')).toHaveAttribute('src', 'media/images/money/500.png');
      expect(piece(5000).querySelector('img')).toHaveAttribute('src', 'media/images/money/5000.png');
      expect(piece(1000).querySelector('img')).toBeNull();
    });

    it('keep the built-in icons for anything without a picture', async () => {
      const user = userEvent.setup();
      await openKasir(user);

      const customer = screen.getByRole('region', { name: 'Pembeli' });
      expect(customer.querySelectorAll('img')).toHaveLength(0);
      expect(customer.querySelectorAll('svg').length).toBeGreaterThan(0);
    });
  });
});

describe('Kasir without an Indonesian voice', () => {
  it('respells every sentence it speaks, so an English voice lands closer to Indonesian', async () => {
    const user = userEvent.setup();
    await openKasir(user);

    const intro = 'Harganya seribu lima ratus rupiah. Dibayar dua ribu rupiah. Ayo hitung kembaliannya!';
    await waitFor(() => expect(spokenUtterances).not.toHaveLength(0));

    const spoken = spokenUtterances.find((u) => u.text !== 'buh-lah-jar yook!')!;
    expect(spoken.text).toBe(respellForEnglishVoice(intro));
    expect(spoken.text).not.toBe(intro);
    expect(spoken.lang).toBe('en-US');
  });

  it('respells "Salah, hitung kembali" too', async () => {
    const user = userEvent.setup();
    await openKasir(user);
    await user.click(piece(5000));

    await waitFor(() =>
      expect(spokenUtterances.some((u) => u.text === respellForEnglishVoice('Salah, hitung kembali'))).toBe(true),
    );
  });
});

describe('what the cashier says', () => {
  const textOf = (parts: ReturnType<typeof priceLine>) => {
    const steps = stepsFor(parts);
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe('tts');
    return steps[0].kind === 'tts' ? steps[0].text : '';
  };

  it('builds each line from its parts', () => {
    expect(textOf(priceLine(3000))).toBe('Harganya tiga ribu rupiah.');
    expect(textOf(paidLine(5000))).toBe('Dibayar lima ribu rupiah.');
    expect(textOf(totalLine(4000))).toBe('empat ribu');
    expect(textOf(changeLine(2000))).toBe('Kembaliannya dua ribu rupiah!');
    expect(textOf(promptLine())).toBe('Ayo hitung kembaliannya!');
    expect(textOf(wrongLine())).toBe('Salah, hitung kembali');
  });

  it('says halves of a thousand: "lima ratus" and "seribu lima ratus"', () => {
    expect(textOf(totalLine(500))).toBe('lima ratus');
    expect(textOf(totalLine(1500))).toBe('seribu lima ratus');
    expect(textOf(priceLine(15500))).toBe('Harganya lima belas ribu lima ratus rupiah.');
  });

  it('says "seribu", not "satu ribu"', () => {
    expect(textOf(priceLine(1000))).toBe('Harganya seribu rupiah.');
  });

  it('merges neighbouring spoken parts, so a sentence is not chopped into words', () => {
    expect(stepsFor([...priceLine(3000), ...paidLine(5000)])).toHaveLength(1);
  });

  describe('with recordings', () => {
    it('uses a clip for every part that has one', () => {
      setMediaManifest({
        audio: ['money/harganya.mp3', 'money/3000.mp3', 'money/rupiah.mp3'],
        images: [],
      });

      expect(stepsFor(priceLine(3000))).toEqual([
        { kind: 'clip', url: 'media/audio/money/harganya.mp3' },
        { kind: 'clip', url: 'media/audio/money/3000.mp3' },
        { kind: 'clip', url: 'media/audio/money/rupiah.mp3' },
      ]);
    });

    it('speaks only the missing parts, keeping the recorded ones', () => {
      // Only the amount was recorded: the words around it fall back to speech.
      setMediaManifest({ audio: ['money/3000.mp3'], images: [] });

      expect(stepsFor(priceLine(3000))).toEqual([
        { kind: 'tts', text: 'Harganya', opts: undefined },
        { kind: 'clip', url: 'media/audio/money/3000.mp3' },
        { kind: 'tts', text: 'rupiah.', opts: undefined },
      ]);
    });

    it('records an amount ending in 500 under its own name', () => {
      setMediaManifest({ audio: ['money/1500.mp3'], images: [] });

      expect(stepsFor(totalLine(1500))).toEqual([{ kind: 'clip', url: 'media/audio/money/1500.mp3' }]);
    });

    it('records the wrong-count phrase as one clip', () => {
      setMediaManifest({ audio: ['money/salah-hitung-kembali.mp3'], images: [] });

      expect(stepsFor(wrongLine())).toEqual([
        { kind: 'clip', url: 'media/audio/money/salah-hitung-kembali.mp3' },
      ]);
    });

    it('records the instruction as one clip', () => {
      setMediaManifest({ audio: ['phrases/ayo-hitung-kembalian.mp3'], images: [] });

      expect(stepsFor(promptLine())).toEqual([
        { kind: 'clip', url: 'media/audio/phrases/ayo-hitung-kembalian.mp3' },
      ]);
    });
  });
});
