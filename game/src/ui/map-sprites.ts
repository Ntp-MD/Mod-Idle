import bounds from './map-sprite-bounds.json' with { type: 'json' };

/** Use painted bounds rather than transparent PNG margins when placing a piece's feet. */
export function mapSprite(href: string, x: number, y: number, width: number, height: number, cls = ''): string {
  const box = (bounds as Record<string, number[]>)[href];
  if (!box) return `<image class="${cls}" href="${href}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMax meet"/>`;
  const [iw, ih, left, top, bw, bh] = box;
  return `<svg class="${cls}" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${left} ${top} ${bw} ${bh}" preserveAspectRatio="xMidYMax meet"><image href="${href}" width="${iw}" height="${ih}"/></svg>`;
}

/** Place a piece by painted width and bottom edge: the ground footprint keeps its aspect, so the
 *  painted bottom lands exactly on `y` and the ground stays centred on the cell. */
export function mapSpriteWidth(href: string, x: number, y: number, width: number, cls = ''): string {
  const box = (bounds as Record<string, number[]>)[href];
  const paintedWidth = width * mapSpriteWidthScale(href);
  const height = box ? paintedWidth * box[5] / box[4] : paintedWidth;
  return mapSprite(href, x - paintedWidth / 2, y - height, paintedWidth, height, cls);
}

/** Small per-art overhangs let a landmark cross its hex edge while keeping its measured base centred. */
export function mapSpriteWidthScale(href: string): number {
  return (bounds as Record<string, number[]>)[href]?.[6] ?? 1;
}
