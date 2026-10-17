import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { setupUser } from './user';
import App from '../App';
import { AppNotice } from '../components/AppNotice';
import { installIsPossible } from '../pwa';

const version = (JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8')) as { version: string })
  .version;

describe('the version in the corner', () => {
  const badge = () => screen.getByLabelText(`Versi ${version}`);

  it('shows package.json\'s version, as "v" and the number', () => {
    render(<App />);

    expect(badge()).toHaveTextContent(`v${version}`);
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is small, quiet, in the top-right, and cannot be touched', () => {
    render(<App />);
    const el = badge();

    expect(el).toHaveClass('fixed', 'right-2', 'pointer-events-none', 'select-none');
    expect(el.className).toMatch(/text-\[10px\]/);
    // Dark enough to read: slate-500 or darker, never a pale grey.
    expect(el.className).toMatch(/text-slate-(500|600|700)/);
  });

  it('stays put on every screen - the menu, a game, and the media page', async () => {
    const user = setupUser();
    render(<App />);
    expect(badge()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Berhitung/ }));
    expect(screen.getAllByLabelText(`Versi ${version}`)).toHaveLength(1);
    expect(badge()).toBeInTheDocument();
  });

  it('is on the parents\' media page too', () => {
    window.location.hash = '#media';
    render(<App />);

    expect(badge()).toBeInTheDocument();
  });

  it('is the version the build was given', () => {
    // Vite replaces __APP_VERSION__ with package.json's version; a stale constant would show here.
    expect(__APP_VERSION__).toBe(version);
  });
});

describe('what can be installed here', () => {
  it('is possible over https and http (localhost), when not already installed', () => {
    expect(installIsPossible({ protocol: 'https:', standalone: false })).toBe(true);
    expect(installIsPossible({ protocol: 'http:', standalone: false })).toBe(true);
  });

  it('is not possible from a folder opened off the disk', () => {
    expect(installIsPossible({ protocol: 'file:', standalone: false })).toBe(false);
  });

  it('is not worth mentioning once the app is installed', () => {
    expect(installIsPossible({ protocol: 'https:', standalone: true })).toBe(false);
  });
});

describe('the home screen footnote', () => {
  it('says the app runs here only, with no cookies, accounts, trackers or sending', () => {
    render(<AppNotice context={{ protocol: 'https:', standalone: false }} />);
    const note = screen.getByRole('contentinfo');

    expect(note).toHaveTextContent('tanpa cookie');
    expect(note).toHaveTextContent('tanpa akun');
    expect(note).toHaveTextContent('tanpa pelacak');
    expect(note).toHaveTextContent('tidak ada data yang dikirim ke mana pun');
  });

  it('is honest that settings and learning records are kept in local storage', () => {
    render(<AppNotice context={{ protocol: 'https:', standalone: false }} />);

    expect(screen.getByRole('contentinfo')).toHaveTextContent('penyimpanan lokal perangkat ini');
  });

  it('says the app can be installed and works without internet, with how to do it', () => {
    render(<AppNotice context={{ protocol: 'https:', standalone: false }} />);
    const note = screen.getByRole('contentinfo');

    expect(note).toHaveTextContent('dipasang');
    expect(note).toHaveTextContent('tanpa internet');
    expect(note).toHaveTextContent('Cara memasang');
    expect(note).toHaveTextContent('Chrome');
    expect(note).toHaveTextContent('Safari');
  });

  it('leaves the install part out where it cannot apply, but keeps the privacy part', () => {
    for (const context of [
      { protocol: 'file:', standalone: false },
      { protocol: 'https:', standalone: true },
    ]) {
      const { unmount } = render(<AppNotice context={context} />);
      const note = screen.getByRole('contentinfo');

      expect(note).not.toHaveTextContent('dipasang');
      expect(note).not.toHaveTextContent('Cara memasang');
      expect(note).toHaveTextContent('tanpa cookie');
      unmount();
    }
  });

  it('is on the home screen, below the games', () => {
    render(<App />);
    const home = screen.getByRole('navigation');
    const note = screen.getByRole('contentinfo');

    expect(home.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is small and quiet', () => {
    render(<AppNotice context={{ protocol: 'https:', standalone: false }} />);

    expect(screen.getByRole('contentinfo')).toHaveClass('text-xs');
  });

  it('is not on the game screens', async () => {
    const user = setupUser();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Berhitung/ }));

    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});

describe('the claims in the footnote', () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, '..', '..', path), 'utf8');

  it('hold: nothing in the app sets a cookie, loads from another site, or sends data out', () => {
    const files = ['src/App.tsx', 'src/pwa.ts', 'src/main.tsx', 'index.html'].map(read).join('\n');

    expect(files).not.toMatch(/document\.cookie/);
    expect(files).not.toMatch(/https?:\/\/(?!www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}\//i);
    expect(files).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  });
});
