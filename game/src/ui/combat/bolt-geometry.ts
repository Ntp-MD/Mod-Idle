/**
 * Procedural bolt geometry for the `rimworld` variant: seeded noise replaces the old fixed
 * sine squiggle, vertices follow world metres, and every layer fades on one envelope.
 * Pure functions only — the Svelte renderer owns colour and blending.
 */
export type PxPoint = { x: number; y: number };

const ATTACK_SEC = .018;
const HOLD_SEC = .05;
const DECAY_SEC = .16;
/** Total visible life of one strike. */
export const BOLT_LIFE_SEC = ATTACK_SEC + HOLD_SEC + DECAY_SEC;
/** Vertex spacing in world metres; RimWorld's bolt mesh uses 0.2. */
const SPACING_M = .2;
const MIN_SEGMENTS = 4;
const BASE_AMPLITUDE_M = .3;

/** Stable numeric seed for a mark key; identical across casts and reloads. */
export function seedOf(key: string): number {
  let seed = 7;
  for (const char of key) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0;
  return seed;
}

function hash(index: number, seed: number): number {
  let h = (Math.imul(index, 374761393) + Math.imul(seed, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Seeded 1D value noise in -1..1. */
function noise(x: number, seed: number): number {
  const i = Math.floor(x), f = x - i;
  const a = hash(i, seed), b = hash(i + 1, seed);
  const u = f * f * (3 - 2 * f);
  return (a + (b - a) * u) * 2 - 1;
}

/** Four-octave fractal noise: irregular enough to read as lightning, still deterministic. */
function fbm(x: number, seed: number, octaves = 4): number {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += amp * noise(x * freq, seed + octave * 1013);
    norm += amp;
    amp *= .5;
    freq *= 2;
  }
  return sum / norm;
}

/** Centreline with vertices every `spacingM`, jitter tapered to zero at both anchors. */
export function boltCenterline(
  from: PxPoint,
  to: PxPoint,
  opts: { seed: number; cssPerM: number; spacingM?: number; amplitudeM?: number },
): PxPoint[] {
  const spacingM = opts.spacingM ?? SPACING_M;
  const dx = to.x - from.x, dy = to.y - from.y;
  const lengthPx = Math.max(1, Math.hypot(dx, dy));
  const lengthM = lengthPx / Math.max(1, opts.cssPerM);
  const segments = Math.max(MIN_SEGMENTS, Math.ceil(lengthM / Math.max(.001, spacingM)));
  const amplitudePx = Math.min(opts.amplitudeM ?? BASE_AMPLITUDE_M, lengthM * .1) * opts.cssPerM;
  const nx = -dy / lengthPx, ny = dx / lengthPx;
  return Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments;
    if (index === 0) return { x: from.x, y: from.y };
    if (index === segments) return { x: to.x, y: to.y };
    const offset = fbm(index * .55, opts.seed) * amplitudePx * Math.sin(Math.PI * t);
    return { x: from.x + dx * t + nx * offset, y: from.y + dy * t + ny * offset };
  });
}

function lineD(points: readonly PxPoint[]): string {
  return points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

/** Closed outline around the centreline, tapered at both ends. */
export function ribbonPath(points: readonly PxPoint[], halfWidthPx: number): string {
  if (points.length < 2) return '';
  const last = points.length - 1;
  const left: PxPoint[] = [], right: PxPoint[] = [];
  for (let index = 0; index <= last; index++) {
    const point = points[index];
    const next = points[Math.min(index + 1, last)];
    const previous = points[Math.max(index - 1, 0)];
    let tx = next.x - previous.x, ty = next.y - previous.y;
    const length = Math.hypot(tx, ty) || 1;
    tx /= length; ty /= length;
    const half = halfWidthPx * (.5 + .5 * Math.sin(Math.PI * index / last));
    left.push({ x: point.x - ty * half, y: point.y + tx * half });
    right.push({ x: point.x + ty * half, y: point.y - tx * half });
  }
  return `${lineD(left)} ${lineD(right.reverse())} Z`;
}

/** 0-2 short branches leaving interior points of the main bolt. */
export function boltForks(points: readonly PxPoint[], seed: number, cssPerM: number): PxPoint[][] {
  if (points.length < 6) return [];
  const last = points.length - 1;
  const forks: PxPoint[][] = [];
  for (const [slot, share] of [0.42, 0.72].entries()) {
    if (hash(slot + 3, seed) > .72) continue;
    const index = Math.max(2, Math.min(last - 2, Math.round(last * share)));
    const origin = points[index];
    const next = points[index + 1];
    const angle = Math.atan2(next.y - origin.y, next.x - origin.x)
      + (hash(slot + 9, seed) < .5 ? -1 : 1) * (.45 + hash(slot + 5, seed) * .5);
    const remaining = Math.hypot(points[last].x - origin.x, points[last].y - origin.y);
    const length = remaining * (.22 + hash(slot + 7, seed) * .2);
    const steps = 6;
    const branch: PxPoint[] = [{ x: origin.x, y: origin.y }];
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const bend = fbm(step * .8, seed + slot * 331, 3) * Math.min(.16, length / cssPerM * .09) * cssPerM
        * Math.sin(Math.PI * t);
      branch.push({
        x: origin.x + Math.cos(angle) * length * t - Math.sin(angle) * bend,
        y: origin.y + Math.sin(angle) * length * t + Math.cos(angle) * bend,
      });
    }
    forks.push(branch);
  }
  return forks;
}

/** Brightness envelope: fast attack, short hold, linear decay to zero at the life end. */
export function boltEnvelope(ageSec: number, lifeSec = BOLT_LIFE_SEC): number {
  if (!(lifeSec > 0) || !(ageSec >= 0) || ageSec >= lifeSec) return 0;
  const attack = Math.min(ATTACK_SEC, lifeSec * .5);
  if (ageSec < attack) return ageSec / attack;
  const holdEnd = Math.min(attack + Math.min(HOLD_SEC, lifeSec * .3), lifeSec - .001);
  if (ageSec < holdEnd) return 1;
  return Math.max(0, 1 - (ageSec - holdEnd) / (lifeSec - holdEnd));
}
