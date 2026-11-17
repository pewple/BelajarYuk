import { Calculator, ChefHat, Footprints, HandCoins, LayoutGrid, MessageCircleHeart, PencilLine, Shapes, Type } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Pony } from '../components/drawnIcons';
import type { ScreenId } from '../types';

export type HomeChoice = {
  id: Exclude<ScreenId, 'home'>;
  /** Title shown on the card and used as the screen heading. */
  title: string;
  /** Big non-verbal cue a pre-reader can recognise at a glance. */
  glyph: string;
  icon: LucideIcon;
  theme: string;
  /** Right answers here earn stars (the games that can be got wrong). */
  givesStars?: boolean;
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
    id: 'menulis',
    title: 'Menulis',
    glyph: 'A 7',
    icon: PencilLine,
    theme: 'from-emerald-600 to-green-700',
    givesStars: true,
  },
  {
    id: 'pola',
    title: 'Pola',
    glyph: '● ■ ▲',
    icon: Shapes,
    theme: 'from-fuchsia-600 to-pink-700',
    givesStars: true,
  },
  {
    id: 'memori',
    title: 'Memori',
    glyph: '? ?',
    icon: LayoutGrid,
    theme: 'from-indigo-600 to-violet-700',
    givesStars: true,
  },
  {
    id: 'labirin',
    title: 'Labirin',
    glyph: 'A → B',
    icon: Footprints,
    theme: 'from-sky-600 to-indigo-700',
    givesStars: true,
  },
  {
    id: 'kasir',
    title: 'Kasir',
    glyph: 'Rp',
    icon: HandCoins,
    theme: 'from-amber-600 to-orange-700',
    givesStars: true,
  },
  {
    id: 'masak',
    title: 'Memasak',
    glyph: 'Nasi',
    icon: ChefHat,
    theme: 'from-orange-500 to-rose-600',
    givesStars: true,
  },
  {
    id: 'kuda',
    title: 'Kuda',
    glyph: '★',
    icon: Pony,
    theme: 'from-lime-600 to-emerald-700',
  },
];
