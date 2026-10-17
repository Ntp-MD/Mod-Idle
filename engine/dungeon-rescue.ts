/** Escrow bucket order is explicit so saved object insertion order never changes the selection. */
export const DUNGEON_RESCUE_BUCKETS = ['items', 'junk', 'stones', 'herbs', 'potions', 'materials'] as const;
export type DungeonRescueBucket = typeof DUNGEON_RESCUE_BUCKETS[number];

export interface DungeonRescueEntry<T = unknown> {
  bucket: DungeonRescueBucket;
  key: string;
  count: number;
  stackSize: number;
  /** Gear is one entry with count/stackSize 1; the item reference is returned unchanged. */
  item?: T;
}

/**
 * Select a uniform subset of virtual, legal-sized escrow stacks without expanding quantity rows.
 * Entries are normalized by bucket order and key. Duplicate identities and invalid input throw
 * before RNG. Empty escrow takes no draws; otherwise draw keep-count once, then one draw per
 * selected stack using Floyd's algorithm. Returned entries follow normalized virtual-stack order.
 */
export function selectDungeonRescue<T>(
  entries: readonly DungeonRescueEntry<T>[],
  range: { min: number; max: number },
  rng: () => number,
): DungeonRescueEntry<T>[] {
  const invalid = (): never => { throw new Error('invalid dungeon rescue input'); };
  const whole = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (!whole(range.min) || !whole(range.max) || range.min > range.max) invalid();
  const identities = new Map<DungeonRescueBucket, Set<string>>();
  for (const entry of entries) {
    if (!DUNGEON_RESCUE_BUCKETS.includes(entry.bucket) || typeof entry.key !== 'string' || !entry.key
      || !whole(entry.count) || !whole(entry.stackSize) || entry.stackSize < 1) invalid();
    if (entry.bucket === 'items'
      ? entry.count !== 1 || entry.stackSize !== 1 || entry.item == null
      : entry.item !== undefined) invalid();
    let keys = identities.get(entry.bucket);
    if (!keys) { keys = new Set(); identities.set(entry.bucket, keys); }
    if (keys.has(entry.key)) invalid();
    keys.add(entry.key);
  }
  const sorted = [...entries].sort((a, b) => DUNGEON_RESCUE_BUCKETS.indexOf(a.bucket) - DUNGEON_RESCUE_BUCKETS.indexOf(b.bucket)
    || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  let total = 0;
  const spans = sorted.filter((entry) => entry.count > 0).map((entry) => {
    const start = total;
    const stacks = Math.floor(entry.count / entry.stackSize) + (entry.count % entry.stackSize > 0 ? 1 : 0);
    total += stacks;
    if (!Number.isSafeInteger(total)) invalid();
    return { entry, start, end: total };
  });
  if (!total) return [];
  const draw = () => {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('invalid dungeon rescue RNG draw');
    return value;
  };
  const minimum = Math.min(range.min, total), maximum = Math.min(range.max, total);
  const kept = minimum + Math.floor(draw() * (maximum - minimum + 1));
  const selected = new Set<number>();
  for (let upper = total - kept; upper < total; upper++) {
    const candidate = Math.floor(draw() * (upper + 1));
    selected.add(selected.has(candidate) ? upper : candidate);
  }
  return [...selected].sort((a, b) => a - b).map((index) => {
    let low = 0, high = spans.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (spans[middle].end <= index) low = middle + 1;
      else high = middle;
    }
    const { entry, start } = spans[low];
    return { ...entry, count: Math.min(entry.stackSize, entry.count - (index - start) * entry.stackSize) };
  });
}
