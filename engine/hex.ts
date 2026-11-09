/**
 * Hex geometry — the one home for axial coordinates (`engine/road.ts` re-exports these).
 *
 * Pointy-top axial lattice: a cell is `{ q, r }`, its sheet key is `"q,r"`, the six
 * neighbours are `HEX_DIRECTIONS` in fixed order, and `hexPath` is the plotted
 * chain of adjacent cells between two cells. Pure functions only — no data, no DOM.
 */

/** One cell of the field, addressed by its axial coordinates. */
export interface Hex {
  q: number;
  r: number;
}

/** One cell to sheet-key form, so a walk, a route and a click all speak the same address. */
export const hexKey = (h: Hex): string => `${h.q},${h.r}`;

/** The sheet keys of a chain of cells, in order. */
export const hexKeys = (cells: Hex[]): string[] => cells.map(hexKey);

/** True when two cells share an edge — the adjacency a single block of walking is allowed to cross. */
export const hexAdjacent = (a: Hex, b: Hex): boolean => {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2 === 1;
};

/** Axial hex distance: the number of blocks walked between two cells. */
export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/**
 * The six offsets a single step may cross. They are the pairs `hexAdjacent` accepts at distance 1, so
 * the ring and the adjacency rule cannot drift apart into two different ideas of a neighbour.
 */
export const HEX_DIRECTIONS: ReadonlyArray<readonly [number, number]> =
  [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** The six cells one step from `h` — the ring a single block is allowed to enter. */
export const hexNeighbours = (h: Hex): Hex[] =>
  HEX_DIRECTIONS.map(([dq, dr]) => ({ q: h.q + dq, r: h.r + dr }));

/** Cube rounding, the one way back from a fractional lerp onto the lattice. */
function cubeRound(qf: number, rf: number): Hex {
  const sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

/**
 * The plotted route: the ordered cells walked between two cells, one per block, each adjacent to the
 * one before it. A far destination is never jumped to — it is a chain of blocks the sheet can light up
 * one at a time, and its length is the hex distance, so the route and the walk's cost are the same
 * number derived twice rather than a path traded against a distance.
 */
export function hexPath(a: Hex, b: Hex): Hex[] {
  const n = hexDistance(a, b);
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    out.push(cubeRound(a.q + (b.q - a.q) * t, a.r + (b.r - a.r) * t));
  }
  return out;
}
