import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

export const HOME_BUTTON = { name: 'Kembali ke menu utama' } as const;

/** The two numbers on the parent gate that is currently up. */
export function gateSum(): { a: number; b: number } {
  const dialog = screen.getByRole('dialog', { name: 'Khusus orang tua' });
  const match = /Soal: (\d+) ditambah (\d+)/.exec(dialog.textContent ?? '');
  if (!match) throw new Error('The parent gate shows no sum.');
  return { a: Number(match[1]), b: Number(match[2]) };
}

/** Types `answer` on the gate's keypad and presses the check button. */
export async function answerGate(user: UserEvent, answer: string): Promise<void> {
  const dialog = screen.getByRole('dialog', { name: 'Khusus orang tua' });
  for (const digit of answer) {
    await user.click(within(dialog).getByRole('button', { name: digit }));
  }
  await user.click(within(dialog).getByRole('button', { name: 'Periksa jawaban' }));
}

/**
 * Presses the home button and, if a grown-up's sum stands in the way, solves it.
 * For tests that are about something other than the gate.
 */
export async function leaveGame(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole('button', HOME_BUTTON));
  if (!screen.queryByRole('dialog', { name: 'Khusus orang tua' })) return;
  const { a, b } = gateSum();
  await answerGate(user, String(a + b));
}
