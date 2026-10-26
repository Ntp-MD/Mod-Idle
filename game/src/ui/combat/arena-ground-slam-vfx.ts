import type { VfxFootprint } from './arena-vfx-space';

export const GROUND_SLAM_VFX_DURATION = .78;

type Point = { x: number; y: number };
export type GroundSlamSpace = { center: Point; basisX: Point; basisY: Point };
export type GroundSlamTimeline = {
  charge: number; started: boolean; u: number; flash: number;
  wave: number; wave2: number; cracks: number; dust: number; fade: number;
};
export type GroundSlamPuff = { angle: number; distance: number; drift: number; size: number };
export type GroundSlamMote = { angle: number; start: number; size: number; spin: number };
export type GroundSlamShard = {
  angle: number; start: number; travel: number; rise: number; size: number;
  spin: number; delay: number; life: number; polygon: string; facet: string;
};
export type GroundSlamChip = { angle: number; start: number; travel: number; lift: number; size: number; delay: number; life: number };
export type GroundSlamShardState = { x: number; y: number; rotation: number; scale: number; opacity: number };
export type GroundSlamChipState = { x: number; y: number; size: number; opacity: number };
export type GroundSlamMoteState = { x: number; y: number; size: number; opacity: number };

const TAU = Math.PI * 2;
const round = (value: number) => Math.round(value * 1000) / 1000;
const pair = (x: number, y: number) => `${round(x)} ${round(y)}`;

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const easeOut = (value: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, value)), 3);

export function groundSlamSpace(origin: Point, area?: VfxFootprint, compact = false): GroundSlamSpace {
  if (compact) {
    if (area) {
      const scale = .22;
      return {
        center: origin,
        basisX: { x: area.basisX.x * scale, y: area.basisX.y * scale },
        basisY: { x: area.basisY.x * scale, y: area.basisY.y * scale },
      };
    }
    return { center: origin, basisX: { x: 38, y: -7.5 }, basisY: { x: 9.5, y: 27 } };
  }
  if (area) return { center: area.center, basisX: area.basisX, basisY: area.basisY };
  return { center: origin, basisX: { x: 147, y: -28 }, basisY: { x: 35, y: 105 } };
}

export function groundSlamPoint(space: GroundSlamSpace, angle: number, radius: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: space.center.x + (space.basisX.x * cos + space.basisY.x * sin) * radius,
    y: space.center.y + (space.basisX.y * cos + space.basisY.y * sin) * radius,
  };
}

export function groundSlamMatrix(space: GroundSlamSpace) {
  return `matrix(${round(space.basisX.x)} ${round(space.basisX.y)} ${round(space.basisY.x)} ${round(space.basisY.y)} ${round(space.center.x)} ${round(space.center.y)})`;
}

function ringPath(rng: () => number, count: number, base: number, jitter: number) {
  const points: string[] = [];
  for (let i = 0; i < count; i++) {
    const angle = i / count * TAU;
    const radius = base + (i % 2 ? jitter * .35 : 0) + (rng() - .5) * jitter;
    points.push(`${i ? 'L' : 'M'}${pair(Math.cos(angle) * radius, Math.sin(angle) * radius)}`);
  }
  return `${points.join('')}Z`;
}

function crackPath(rng: () => number, angle: number, length: number) {
  let currentAngle = angle;
  let radius = .06;
  let x = Math.cos(currentAngle) * radius;
  let y = Math.sin(currentAngle) * radius;
  const parts = [`M${pair(x, y)}`];
  for (let segment = 0; segment < 3; segment++) {
    currentAngle += (rng() - .5) * .34;
    radius = Math.min(1, radius + length * (.3 + rng() * .22));
    x = Math.cos(currentAngle) * radius;
    y = Math.sin(currentAngle) * radius;
    parts.push(`L${pair(x, y)}`);
  }
  if (rng() > .38) {
    const branchAngle = currentAngle + (rng() > .5 ? 1 : -1) * (.42 + rng() * .35);
    const branchStart = { x, y };
    parts.push(`M${pair(branchStart.x, branchStart.y)}`);
    for (let segment = 0; segment < 2; segment++) {
      const step = .09 + rng() * .13;
      x += Math.cos(branchAngle + (rng() - .5) * .3) * step;
      y += Math.sin(branchAngle + (rng() - .5) * .3) * step;
      const distance = Math.hypot(x, y);
      if (distance > 1.02) {
        x *= 1.02 / distance;
        y *= 1.02 / distance;
      }
      parts.push(`L${pair(x, y)}`);
    }
  }
  return parts.join('');
}

const ringRng = seeded(0x2f13a7);
export const SLAM_RING_OUTER = ringPath(ringRng, 30, .96, .055);
export const SLAM_RING_SECOND = ringPath(ringRng, 24, .8, .065);
export const SLAM_RING_INNER = ringPath(ringRng, 18, .5, .045);
export const SLAM_CORE = ringPath(ringRng, 12, .17, .055);
export const SLAM_RIM = 'M-.34 .07Q0 .32 .34 .07';

const crackRng = seeded(0x6c1b93);
export const SLAM_CRACKS = Array.from({ length: 11 }, (_, index) =>
  crackPath(crackRng, index / 11 * TAU + (crackRng() - .5) * .22, .48 + crackRng() * .28));

export const SLAM_SPLINTERS = Array.from({ length: 7 }, (_, index) => {
  const angle = index / 7 * TAU + .18;
  const inner = .1 + (index % 3) * .02;
  const outer = .34 + (index % 4) * .035;
  return `M${pair(Math.cos(angle) * inner, Math.sin(angle) * inner)}L${pair(Math.cos(angle) * outer, Math.sin(angle) * outer)}`;
}).join('');

const puffRng = seeded(0x93f2d1);
export const SLAM_PUFFS: GroundSlamPuff[] = Array.from({ length: 16 }, (_, index) => ({
  angle: index / 16 * TAU + (puffRng() - .5) * .3,
  distance: .54 + puffRng() * .28,
  drift: .12 + puffRng() * .22,
  size: .09 + puffRng() * .08,
}));

const moteRng = seeded(0x17a6c4);
export const SLAM_MOTES: GroundSlamMote[] = Array.from({ length: 10 }, (_, index) => ({
  angle: index / 10 * TAU + (moteRng() - .5) * .35,
  start: .62 + moteRng() * .34,
  size: .026 + moteRng() * .025,
  spin: moteRng() > .5 ? 1 : -1,
}));

function shardArt(rng: () => number, tall: boolean) {
  const width = (tall ? .34 : .5) + rng() * .24;
  const height = (tall ? .66 : .4) + rng() * .28;
  const polygon = `M${pair(-width * .5, -height * .32)}L${pair(width * .45, -height * .62)}L${pair(width * .58, height * .2)}L${pair(width * .05, height * .55)}L${pair(-width * .44, height * .24)}Z`;
  const facet = `M${pair(-width * .08, -height * .16)}L${pair(width * .44, -height * .22)}L${pair(width * .18, height * .32)}Z`;
  return { polygon, facet };
}

const shardRng = seeded(0x4bd2e9);
export const SLAM_SHARDS: GroundSlamShard[] = Array.from({ length: 12 }, (_, index) => {
  const tall = index % 3 === 0;
  return {
    angle: index / 12 * TAU + (shardRng() - .5) * .34,
    start: .08 + shardRng() * .16,
    travel: .18 + shardRng() * .24,
    rise: tall ? .36 + shardRng() * .24 : .2 + shardRng() * .24,
    size: (tall ? .045 : .035) + shardRng() * .03,
    spin: (shardRng() - .5) * 220,
    delay: shardRng() * .035,
    life: .42 + shardRng() * .2,
    ...shardArt(shardRng, tall),
  };
});

const chipRng = seeded(0xa71d52);
export const SLAM_CHIPS: GroundSlamChip[] = Array.from({ length: 14 }, (_, index) => ({
  angle: index / 14 * TAU + (chipRng() - .5) * .38,
  start: .06 + chipRng() * .14,
  travel: .22 + chipRng() * .3,
  lift: .18 + chipRng() * .24,
  size: .009 + chipRng() * .009,
  delay: chipRng() * .055,
  life: .34 + chipRng() * .2,
}));

export function slamTimeline(elapsedSec: number, windupSec: number, reducedMotion = false): GroundSlamTimeline {
  const total = Math.max(0, Math.min(GROUND_SLAM_VFX_DURATION, elapsedSec));
  const windup = Math.max(0, windupSec);
  const charge = windup > 0 ? Math.min(1, total / windup) : 0;
  const started = total >= windup;
  const u = Math.max(0, total - windup);
  const fade = Math.max(0, Math.min(1, (GROUND_SLAM_VFX_DURATION - total) / .18));
  if (reducedMotion) {
    return {
      charge: started ? 0 : charge, started, u,
      flash: started ? .55 : 0, wave: started ? .84 : 0, wave2: started ? .55 : 0,
      cracks: started ? 1 : 0, dust: started ? .7 : 0, fade: started ? fade : 1,
    };
  }
  return {
    charge: started ? 0 : charge,
    started,
    u,
    flash: started ? Math.max(0, 1 - u / .11) : 0,
    wave: started ? easeOut(u / .32) : 0,
    wave2: started ? easeOut((u - .13) / .34) : 0,
    cracks: started ? easeOut(u / .17) : 0,
    dust: started ? easeOut(u / .4) : 0,
    fade: started ? fade : 1,
  };
}

export function slamMoteState(mote: GroundSlamMote, charge: number): GroundSlamMoteState {
  const progress = Math.max(0, Math.min(1, charge));
  const angle = mote.angle + (1 - progress) * mote.spin * 2.2;
  const radius = .14 + mote.start * (1 - progress);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    size: mote.size * (.6 + .4 * progress),
    opacity: Math.sin(Math.PI * progress) * .8,
  };
}

export function slamPuffState(puff: GroundSlamPuff, u: number, reducedMotion = false) {
  const progress = reducedMotion ? .5 : Math.min(1, Math.max(0, u) / .46);
  const radius = puff.distance + puff.drift * progress;
  return {
    x: Math.cos(puff.angle) * radius,
    y: Math.sin(puff.angle) * radius,
    size: puff.size * (.7 + .9 * progress),
    opacity: Math.max(0, (1 - progress) * .4),
  };
}

export function slamShardState(shard: GroundSlamShard, u: number, space: GroundSlamSpace, reducedMotion = false): GroundSlamShardState | undefined {
  if (u <= shard.delay) return undefined;
  const radius = Math.hypot(space.basisX.x, space.basisX.y) || 1;
  const t = reducedMotion ? .42 : Math.min(1, (u - shard.delay) / shard.life);
  const eased = 1 - Math.pow(1 - t, 2.3);
  const base = groundSlamPoint(space, shard.angle, shard.start);
  const outer = groundSlamPoint(space, shard.angle, 1);
  const dx = outer.x - base.x;
  const dy = outer.y - base.y;
  const length = Math.hypot(dx, dy) || 1;
  const rise = radius * shard.rise * (reducedMotion ? .35 : 4 * t * (1 - t));
  return {
    x: base.x + dx / length * radius * shard.travel * eased,
    y: base.y + dy / length * radius * shard.travel * eased - rise,
    rotation: shard.spin * (reducedMotion ? .25 : eased),
    scale: Math.max(2.2, shard.size * radius * (reducedMotion ? 1 : 1 - .2 * t)),
    opacity: (reducedMotion ? Math.max(0, .9 - u / GROUND_SLAM_VFX_DURATION) : Math.max(0, Math.min(1, (1 - t) / .28))) * .95,
  };
}

export function slamChipState(chip: GroundSlamChip, u: number, space: GroundSlamSpace, reducedMotion = false): GroundSlamChipState | undefined {
  if (u <= chip.delay) return undefined;
  const radius = Math.hypot(space.basisX.x, space.basisX.y) || 1;
  const t = reducedMotion ? .45 : Math.min(1, (u - chip.delay) / chip.life);
  const eased = 1 - Math.pow(1 - t, 2);
  const base = groundSlamPoint(space, chip.angle, chip.start);
  const outer = groundSlamPoint(space, chip.angle, 1);
  const dx = outer.x - base.x;
  const dy = outer.y - base.y;
  const length = Math.hypot(dx, dy) || 1;
  const rise = radius * chip.lift * (reducedMotion ? .4 : 4 * t * (1 - t));
  return {
    x: base.x + dx / length * radius * chip.travel * eased,
    y: base.y + dy / length * radius * chip.travel * eased - rise,
    size: Math.max(1.1, chip.size * radius),
    opacity: Math.max(0, Math.min(1, (1 - t) / .25)) * .9,
  };
}
