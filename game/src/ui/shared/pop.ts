/**
 * Where a floating card goes beside the thing it describes.
 *
 * The card is placed by the box it *measures*, never by a box someone expected: a five-line piece and a
 * stack chip are different heights, and an assumed size is what ran a tall card off the bottom of a short
 * screen. So the caller hands over the anchor's rect, the card's own size, and the frame it has to stay in.
 *
 * The order is the rule: stand beside the anchor, turn to the other side when that side has no room, stand
 * on the anchor's own line, lift above it when the room below is shorter than the card, and only then clamp —
 * a card that fits is never moved.
 */
export type Anchor = { top: number; left: number; right: number; bottom: number };

export function popPlace(
  b: Anchor,
  size: { w: number; h: number },
  vw: number,
  vh: number,
  inset = 8,
  gap = 6,
): { top: number; left: number } {
  const fitsRight = b.right + gap + size.w <= vw - inset;
  const fitsLeft = b.left - gap - size.w >= inset;
  const left = fitsRight ? b.right + gap
    : fitsLeft ? b.left - gap - size.w
    : Math.max(inset, Math.min(vw - inset - size.w, b.right + gap));
  const below = b.top - 10;
  // the card would run past the foot of the frame, but the space above the anchor holds it: stand on that
  const above = vh - inset - below < size.h && b.bottom - inset >= size.h;
  const top = above ? b.bottom - size.h + 10 : below;
  return { top: Math.min(Math.max(inset, top), Math.max(inset, vh - inset - size.h)), left };
}
