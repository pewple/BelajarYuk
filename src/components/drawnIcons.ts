import { createLucideIcon } from 'lucide-react';

/**
 * Drawings for words that lucide has no icon for.
 *
 * Made the same way as lucide's own - 24x24, line art, round ends - so they sit
 * beside the real ones without looking out of place and take the same colour
 * and stroke width. They are stand-ins: your own pictures (media/images)
 * replace any of them, exactly as they replace the lucide icons.
 */

/** A wedge of cheese with holes - جُبْن. */
export const Cheese = createLucideIcon('cheese', [
  ['path', { d: 'M2 18h20V8Z', key: 'wedge' }],
  ['circle', { cx: '17.5', cy: '14.6', r: '1.1', key: 'h1' }],
  ['circle', { cx: '12.5', cy: '16', r: '0.6', key: 'h2' }],
  ['circle', { cx: '19.2', cy: '11.4', r: '0.5', key: 'h3' }],
]);

/** A bear's face - دُبّ. */
export const Bear = createLucideIcon('bear', [
  ['circle', { cx: '12', cy: '13.5', r: '7', key: 'face' }],
  ['circle', { cx: '6', cy: '6.8', r: '2.6', key: 'earl' }],
  ['circle', { cx: '18', cy: '6.8', r: '2.6', key: 'earr' }],
  ['circle', { cx: '9.3', cy: '12', r: '0.6', key: 'eyel' }],
  ['circle', { cx: '14.7', cy: '12', r: '0.6', key: 'eyer' }],
  ['path', { d: 'M10.5 15.8h3l-1.5 1.6Z', key: 'nose' }],
]);

/** A loaf of bread - خُبْز. */
export const Bread = createLucideIcon('bread', [
  ['path', { d: 'M5.5 10.5C3.5 10 3.5 6.2 8 5.2c2.6-.6 5.4-.6 8 0 4.5 1 4.5 4.8 2.5 5.3V18a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z', key: 'loaf' }],
  ['path', { d: 'm9 8.5 1.2 3', key: 's1' }],
  ['path', { d: 'm12.5 8.5 1.2 3', key: 's2' }],
  ['path', { d: 'm16 8.5 1.2 3', key: 's3' }],
]);

/** A gold bar with a glint - ذَهَب. */
export const GoldBar = createLucideIcon('gold-bar', [
  ['path', { d: 'M7.5 9h9l3.5 5H4Z', key: 'top' }],
  ['path', { d: 'M4 14h16v5H4Z', key: 'front' }],
  ['path', { d: 'M12 3v2.5', key: 'g1' }],
  ['path', { d: 'm6.5 4.5 1.4 1.6', key: 'g2' }],
  ['path', { d: 'm17.5 4.5-1.4 1.6', key: 'g3' }],
]);
