/** Balance a full name over at most two lines; never abbreviate or truncate it. */
export function mapNameLines(name: string): string[] {
  const words = name.trim().split(/\s+/);
  if (name.length <= 20 || words.length < 2) return [name];
  let split = 1, difference = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (d < difference) { split = i; difference = d; }
  }
  return [words.slice(0, split).join(' '), words.slice(split).join(' ')];
}

export function mapLevelBand(knowledge: string | null, low: string | null, high: string | null): string {
  return knowledge === 'unknown' || low == null || high == null ? '' : `Lv ${low}–${high}`;
}

export type MapNameFrame = { left: number; top: number; right: number; bottom: number };
export type MapNameBox = { key: string; left: number; top: number; width: number; height: number;
  priority: number; forced: boolean; anchor?: { x: number; y: number } };
const overlaps = (a: MapNameBox, b: MapNameBox) =>
  a.left < b.left + b.width + 10 && a.left + a.width + 10 > b.left
    && a.top < b.top + b.height + 6 && a.top + a.height + 6 > b.top;

/** Keep the name above its pin, flipping below when the top of the viewport has no room. */
export function mapNamePosition(anchor: { x: number; y: number }, width: number, height: number, frame: MapNameFrame) {
  const top = anchor.y - height - 28;
  return {
    left: Math.max(frame.left + 8, Math.min(frame.right - width - 8, anchor.x - width / 2)),
    top: Math.max(frame.top + 8, Math.min(frame.bottom - height - 8, top >= frame.top + 8 ? top : anchor.y + 28)),
  };
}

/** The pointer stays attached to the real ground anchor even when collision handling moves its plate. */
export function mapNamePointer(box: Pick<MapNameBox, 'left' | 'top' | 'width' | 'height'>, anchor: { x: number; y: number }) {
  const x = anchor.x - box.left, y = anchor.y - box.top;
  const attach = Math.max(8, Math.min(box.width - 8, x));
  const below = y >= box.height / 2, edge = below ? box.height : 0, tip = edge + (below ? 6 : -6);
  return { x, y, triangle: 'M' + (attach - 5) + ' ' + edge + 'L' + attach + ' ' + tip + 'L' + (attach + 5) + ' ' + edge + 'Z',
    stem: 'M' + attach + ' ' + tip + 'L' + x + ' ' + y };
}

/** Important names get a nearby free row; ordinary names yield when space is crowded. */
export function placeMapNames(candidates: MapNameBox[], frame?: Pick<MapNameFrame, 'top' | 'bottom'>): MapNameBox[] {
  const placed: MapNameBox[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key))) {
    const box = { ...candidate };
    if (placed.some(other => overlaps(box, other))) {
      if (!box.forced) continue;
      const tops = placed.flatMap(other => [other.top - box.height - 7, other.top + other.height + 7]);
      if (box.anchor) tops.push(box.anchor.y - box.height - 28, box.anchor.y + 28);
      const free = tops.sort((a, b) => Math.abs(a - candidate.top) - Math.abs(b - candidate.top)).find(top => {
        if (top < (frame?.top || 0) + 8 || frame && top + box.height > frame.bottom - 8) return false;
        if (box.anchor && box.anchor.y > top - 8 && box.anchor.y < top + box.height + 8) return false;
        return !placed.some(other => overlaps({ ...box, top }, other));
      });
      if (free !== undefined) box.top = free;
    }
    placed.push(box);
  }
  return placed;
}
