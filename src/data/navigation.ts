import { Calculator, Footprints, HandCoins, MessageCircleHeart, Type } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ScreenId } from '../types';

export type HomeChoice = {
  id: Exclude<ScreenId, 'home'>;
  /** Title shown on the card and used as the screen heading. */
  title: string;
  /** Big non-verbal cue a pre-reader can recognise at a glance. */
  glyph: string;
  icon: LucideIcon;
  theme: string;
};

export const HOME_CHOICES: HomeChoice[] = [
  {
    id: 'huruf',
    title: 'Mengenal Huruf',
    glyph: 'A B C',
    icon: Type,
    theme: 'from-rose-500 to-red-600',
  },
  {
    id: 'bicara',
    title: 'Belajar Bicara',
    glyph: 'Apel',
    icon: MessageCircleHeart,
    theme: 'from-violet-600 to-purple-700',
  },
  {
    id: 'hitung',
    title: 'Berhitung',
    glyph: '1 2 3',
    icon: Calculator,
    theme: 'from-teal-600 to-cyan-700',
  },
  {
    id: 'labirin',
    title: 'Labirin',
    glyph: 'A → B',
    icon: Footprints,
    theme: 'from-sky-600 to-indigo-700',
  },
  {
    id: 'kasir',
    title: 'Kasir',
    glyph: 'Rp',
    icon: HandCoins,
    theme: 'from-amber-600 to-orange-700',
  },
];
