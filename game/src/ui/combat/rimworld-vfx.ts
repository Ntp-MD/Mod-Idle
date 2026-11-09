/**
 * Seeded shape helpers for the `rimworld` renderer. Pure and deterministic so every cast
 * replays identically; the Svelte layer owns colour, blending and timing.
 */
export type Pt = { x: number; y: number };

export const RIMWORLD_FORMS = [
  'bolt', 'lob', 'strike', 'cleave', 'line', 'nova', 'cone', 'chain',
  'skybolt', 'sigil', 'field', 'channel', 'volley',
] as const;

export type RimworldForm = typeof RIMWORLD_FORMS[number];

function hash(index: number, seed: number): number {
  let h = (Math.imul(index, 374761393) + Math.imul(seed, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const TAU = Math.PI * 2;

/** Deterministic points scattered inside a circle, low-discrepancy so every quadrant fills. */
export function burstOffsets(seed: number, count: number, radiusM: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = index * 2.3999632297 + hash(index, seed) * TAU;
    const reach = Math.sqrt((index + .5) / Math.max(1, count)) * .92 + hash(index + 71, seed) * .08;
    return {
      x: Math.cos(angle) * radiusM * reach,
      y: Math.sin(angle) * radiusM * reach,
      sizeM: .04 + hash(index + 17, seed) * .07,
      delay: hash(index + 31, seed) * .06,
    };
  });
}

/** Falling streaks for field forms: start high, land inside the footprint. */
export function streakDrops(seed: number, count: number, radiusM: number) {
  return Array.from({ length: count }, (_, index) => {
    const point = burstOffsets(seed + 503, count, radiusM)[index];
    return { x: point.x, y: point.y, sizeM: .035 + hash(index + 11, seed) * .05,
      delay: hash(index + 401, seed), fallM: .9 + hash(index + 97, seed) * 1.4 };
  });
}

/** Upright motes that rise around a body for heal/ward/curse cues. */
export function supportMotes(seed: number, count: number, bodyHeightM: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = index * 2.3999632297 + hash(index, seed);
    const radius = .18 + hash(index + 53, seed) * .22;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * .4,
      riseM: bodyHeightM * (.6 + hash(index + 29, seed) * .7),
      delay: hash(index + 83, seed) * .18, sizeM: .03 + hash(index + 7, seed) * .04 };
  });
}

/** Pie slice in metre space, centred at origin and pointing along +x. */
export function arcPath(radiusM: number, halfAngleRad: number): string {
  const steps = 14;
  let d = 'M0 0';
  for (let step = 0; step <= steps; step++) {
    const angle = -halfAngleRad + (step / steps) * halfAngleRad * 2;
    d += ` L${(Math.cos(angle) * radiusM).toFixed(3)} ${(Math.sin(angle) * radiusM).toFixed(3)}`;
  }
  return `${d} Z`;
}

/** Lens rectangle for line forms, from the caster toward +x. */
export function linePath(lengthM: number, widthM: number): string {
  const half = Math.max(.05, widthM) / 2;
  return `M0 ${-half} L${lengthM} ${-half} L${lengthM} ${half} L0 ${half} Z`;
}

/** Lob flight: straight interpolation plus a sine arc of `apexM` at the midpoint. */
export function parabolaPoint(from: Pt, to: Pt, apexM: number, t: number): Pt {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped === 0) return { x: from.x, y: from.y };
  if (clamped === 1) return { x: to.x, y: to.y };
  return {
    x: from.x + (to.x - from.x) * clamped,
    y: from.y + (to.y - from.y) * clamped - Math.sin(Math.PI * clamped) * apexM,
  };
}

/** Short blade ribbons rotating around a caster for channel forms. */
export function channelBlades(seed: number, count: number, radiusM: number, spin: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = spin + index * TAU / Math.max(1, count);
    const reach = radiusM * (.7 + hash(index, seed) * .3);
    return {
      from: { x: Math.cos(angle) * reach * .55, y: Math.sin(angle) * reach * .55 },
      to: { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach },
    };
  });
}

/** Curved spiral arms for whirling channels: they read as rotation, not as straight spokes. */
export function channelSpiral(seed: number, count: number, radiusM: number, spin: number) {
  return Array.from({ length: count }, (_, index) => {
    const start = spin + index * TAU / Math.max(1, count);
    const lift = .12 + hash(index + 5, seed) * .12;
    return Array.from({ length: 7 }, (_, step) => {
      const t = step / 6;
      const angle = start + t * (1.1 + hash(index, seed) * .5);
      const reach = radiusM * (.32 + .62 * t);
      return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach * .62 - lift * Math.sin(Math.PI * t) };
    });
  });
}

/** Short arc blades that cut around the vortex; tapered ribbons make them slash, not orbit dots. */
export function channelSlashes(seed: number, count: number, radiusM: number, spin: number) {
  return Array.from({ length: count }, (_, index) => {
    const start = spin + index * TAU / Math.max(1, count);
    const reach = radiusM * (.74 + hash(index + 9, seed) * .14);
    const span = .62 + hash(index + 3, seed) * .34;
    return Array.from({ length: 6 }, (_, step) => {
      const t = step / 5;
      const angle = start - span / 2 + span * t;
      return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach * .62 - (.16 + t * .14) };
    });
  });
}

/** Dust and debris caught by the vortex, spiralling outward and lifting as the channel holds. */
export function channelDust(seed: number, count: number, radiusM: number, timeSec: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = timeSec * (1.7 + (index % 4) * .34) + index * 2.3999632297 + hash(index, seed) * TAU;
    const band = (index * .37 + timeSec * .55) % 1;
    const reach = radiusM * (.24 + band * .72);
    return {
      x: Math.cos(angle) * reach,
      y: Math.sin(angle) * reach * .62 - .06 - band * .3,
      sizeM: .035 + (index % 3) * .015,
      alpha: .2 + .5 * Math.abs(Math.sin(timeSec * 2.4 + index * 1.7)),
    };
  });
}
