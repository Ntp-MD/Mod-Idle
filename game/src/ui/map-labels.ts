/** Lower-left slanted edge of a pointy-top hex (edge 4 clockwise from the top), from real
 *  polygon points: midpoint, screen-projected reading angle and the inward normal. Pure for tests.
 *
 *  Real sheet order (`hexPts` in tools/map.ts) is upper-right → lower-right → bottom →
 *  lower-left → upper-left → top, so the lower-left slant joins vertices 2→3. */
export function lowerLeftEdge(points: { x: number; y: number }[], project: (x: number, y: number) => { x: number; y: number }) {
  const vs = points.map(p => project(p.x, p.y));
  const a = vs[2], b = vs[3];
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  // Text reads left-to-right: fold the raw edge angle into (−90°, 90°].
  let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angleDeg > 90) angleDeg -= 180;
  if (angleDeg <= -90) angleDeg += 180;
  // Inward means toward the hex centroid — robust whatever winding the points arrive in.
  // The lower-left slant's midpoint sits down-left of centre, so (centre − mid) already points
  // back up-right into the hex: no sign flip needed.
  const cx = vs.reduce((n, p) => n + p.x, 0) / vs.length;
  const cy = vs.reduce((n, p) => n + p.y, 0) / vs.length;
  const nx0 = cx - mx, ny0 = cy - my;
  const len = Math.hypot(nx0, ny0) || 1;
  return { mx, my, angleDeg, nx: nx0 / len, ny: ny0 / len };
}

/** The screen tilt of the lower hex edge the town names sit along, read off the map camera. */
export function mapSlantDeg(): number {
  // The board's lower-left edge runs (−0.866, −0.5) in world units (bottom → lower-left);
  // the camera maps it to screen, folded to a left-to-right reading angle.
  const dx = -0.8660254 * 0.9612617 + -0.5 * 0.2756374;
  const dy = -0.8660254 * -0.1698546 + -0.5 * 0.5913646;
  let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angleDeg > 90) angleDeg -= 180;
  if (angleDeg <= -90) angleDeg += 180;
  return angleDeg; // ≈ +8.7°: a gentle lean, never near-vertical.
}

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

export type MapNameBox = { key: string; left: number; top: number; width: number; height: number; priority: number; forced: boolean; slanted?: boolean; angleDeg?: number };
const overlaps = (a: MapNameBox, b: MapNameBox) => {
  // A slanted town plate reads wider than its text: pad it so neighbouring plates never touch type.
  const pad = (a.slanted ? 28 : 5) + (b.slanted ? 28 : 5);
  return a.left < b.left + b.width + pad && a.left + a.width + pad > b.left
    && a.top < b.top + b.height + 5 && a.top + a.height + 5 > b.top;
};

/** Important names win space; hovered and selected names move down instead of disappearing. */
export function placeMapNames(candidates: MapNameBox[]): MapNameBox[] {
  const placed: MapNameBox[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key))) {
    const box = { ...candidate };
    let collisions = placed.filter(other => overlaps(box, other));
    if (collisions.length && !box.forced) continue;
    while (collisions.length) {
      box.top = Math.max(...collisions.map(other => other.top + other.height)) + 6;
      collisions = placed.filter(other => overlaps(box, other));
    }
    placed.push(box);
  }
  return placed;
}
