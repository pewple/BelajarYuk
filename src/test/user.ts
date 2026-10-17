import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

type Options = Parameters<typeof userEvent.setup>[0];

/**
 * The same `user` the tests always used, with a quicker `click`.
 *
 * user-event plays a click the way a mouse would - move, over, enter, down, up,
 * click, with focus changes in between - and that is two to three times the work
 * of the one `click` event this app listens for. A game test makes dozens of clicks.
 * Everything that is not a click (typing, keys, double-clicks) is still user-event.
 *
 * A disabled button ignores a click either way: React drops mouse events on one.
 */
export function setupUser(options?: Options) {
  const user = userEvent.setup({ delay: null, pointerEventsCheck: 0, ...options });
  return Object.assign(user, {
    click: async (element: Element) => {
      fireEvent.click(element);
    },
  });
}
