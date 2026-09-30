import type { LucideIcon } from 'lucide-react';

type CardArtProps = {
  /** Fallback drawing, used whenever no picture has been supplied. */
  icon: LucideIcon;
  /** Your own artwork. Resolved from media/images - see media/pictures.ts. */
  picture?: string;
  className?: string;
  strokeWidth?: number;
  /**
   * Set on cards with a coloured background.
   *
   * The lucide icons are white line art drawn straight onto the gradient,
   * but your own artwork is full colour and can disappear against it - a red
   * apple on a red card is invisible. When a picture is used here it gets a
   * white backdrop so it stays legible whatever colour it is. Icons are left
   * alone, since they are designed for the gradient.
   */
  plate?: boolean;
};

/**
 * Draws a card's artwork: your own picture if you have added one, otherwise
 * the lucide icon.
 *
 * Always decorative - the word beside it already carries the meaning, and
 * every surrounding button has its own label - so the image is hidden from
 * screen readers rather than given a redundant alt text.
 */
export function CardArt({ icon: Icon, picture, className, strokeWidth, plate }: CardArtProps) {
  if (!picture) {
    return <Icon aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
  }

  const image = (
    <img
      src={picture}
      alt=""
      aria-hidden="true"
      draggable={false}
      // `object-contain` keeps your artwork undistorted whatever its aspect
      // ratio, inside the same box the icon would have filled.
      className={plate ? 'size-full object-contain' : `${className ?? ''} object-contain select-none`}
    />
  );

  if (!plate) return image;

  return (
    <span
      aria-hidden="true"
      className={`${className ?? ''} flex items-center justify-center rounded-[1.75rem] bg-white/95 p-3 shadow-md select-none`}
    >
      {image}
    </span>
  );
}
