import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Apple } from 'lucide-react';
import { CardArt } from '../components/CardArt';
import { slugify } from '../media/slug';
import { letterClipId, numberClipId, wordClipId } from '../media/clips';
import { WORD_CARDS, COUNTING_SETS } from '../data/curriculum';

/**
 * These pin down the contract between a filename on disk and the thing it
 * customises. Break one of these and someone's recording silently stops
 * being picked up, with no error anywhere.
 */
describe('customisation', () => {
  describe('filename slugs', () => {
    it('lowercases and hyphenates', () => {
      expect(slugify('Es Krim')).toBe('es-krim');
      expect(slugify('X-Ray')).toBe('x-ray');
      expect(slugify('Apel')).toBe('apel');
    });

    it('produces a usable, unique filename for every word card', () => {
      const slugs = WORD_CARDS.map((card) => slugify(card.word));

      for (const slug of slugs) {
        expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      }
      expect(new Set(slugs).size).toBe(WORD_CARDS.length);
    });

    it('produces a usable, unique filename for every counting set', () => {
      const slugs = COUNTING_SETS.map((set) => slugify(set.label));

      for (const slug of slugs) {
        expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      }
      expect(new Set(slugs).size).toBe(COUNTING_SETS.length);
    });
  });

  describe('clip ids', () => {
    it('maps to the documented folder layout', () => {
      expect(letterClipId('B', 'id')).toBe('letters/id/b');
      expect(letterClipId('B', 'en')).toBe('letters/en/b');
      expect(wordClipId('Es Krim')).toBe('words/es-krim');
      expect(numberClipId(3)).toBe('numbers/3');
    });
  });

  describe('CardArt', () => {
    it('falls back to the lucide icon when no picture is supplied', () => {
      const { container } = render(<CardArt icon={Apple} className="size-10" />);

      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(container.querySelector('img')).not.toBeInTheDocument();
    });

    it('uses the picture instead of the icon when one is supplied', () => {
      const { container } = render(
        <CardArt icon={Apple} picture="/images/words/apel.png" className="size-10" />,
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', '/images/words/apel.png');
      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });

    it('keeps the artwork out of the accessibility tree either way', () => {
      // The word beside it already carries the meaning; a redundant alt would
      // make screen readers announce the same thing twice.
      const { rerender } = render(<CardArt icon={Apple} />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();

      rerender(<CardArt icon={Apple} picture="/images/words/apel.png" />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('passes the sizing classes through to the picture', () => {
      const { container } = render(
        <CardArt icon={Apple} picture="/x.png" className="size-32 animate-pop-in" />,
      );

      const img = container.querySelector('img');
      expect(img).toHaveClass('size-32', 'animate-pop-in', 'object-contain');
    });
  });
});
