export type WhirlwindPoint = { x: number; y: number };
export type WhirlwindRibbon = { fill: string; core: string };
export type WhirlwindBlade = { x: number; y: number; rotation: number; radius: number; opacity: number };
export type WhirlwindRound = { index: number; start: number; local: number; progress: number };
export type WhirlwindSpeck = { x: number; y: number; size: number; opacity: number };

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const fixed = (value: number) => Number.isFinite(value) ? value.toFixed(2) : '0';

export function whirlwindSize(areaDiameter?: number) {
  return Math.max(150, Math.min(230, (areaDiameter ?? 160) * 1.25));
}

export function whirlwindSpin(age: number, duration: number, rounds: number, reducedMotion = false) {
  if (reducedMotion) return 0;
  return clamp01(age / Math.max(.2, duration)) * TAU * Math.max(1, Math.round(rounds));
}

export function whirlwindFade(age: number, duration: number) {
  return clamp01(age / .13) * clamp01((duration - age) / .2);
}

export function whirlwindRibbon(width: number, height: number, spin: number, strand: number, strands = 4): WhirlwindRibbon {
  const steps = 18;
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const angle = spin * 1.15 + strand * TAU / strands + t * TAU * 1.25;
    const radius = width * (.14 + .32 * t);
    return {
      x: Math.cos(angle) * radius,
      y: -height * t + Math.sin(angle) * radius * .24,
      width: Math.max(.6, width * (.023 + .03 * Math.sin(t * Math.PI)) * (1 - t * .3)),
    };
  });
  const normals = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: -dy / length, y: dx / length };
  });
  const forward = points.map((point, index) =>
    `${fixed(point.x + normals[index].x * point.width / 2)} ${fixed(point.y + normals[index].y * point.width / 2)}`);
  const back = points.map((point, index) =>
    `${fixed(point.x - normals[index].x * point.width / 2)} ${fixed(point.y - normals[index].y * point.width / 2)}`).reverse();
  return {
    fill: `M${forward[0]} L${forward.slice(1).join(' L')} L${back.join(' L')} Z`,
    core: `M${points.map((point) => `${fixed(point.x)} ${fixed(point.y)}`).join(' L')}`,
  };
}

export function whirlwindBlades(width: number, height: number, spin: number, rounds: number): WhirlwindBlade[] {
  const count = Math.max(3, Math.min(6, Math.round(rounds)));
  return Array.from({ length: count }, (_, index) => {
    const phase = spin * 1.05 + index * TAU / count;
    const band = index % 3;
    return {
      x: Math.cos(phase) * width * .08,
      y: -height * (.3 + band * .23) + Math.sin(phase) * width * .04,
      rotation: phase * 180 / Math.PI + 90,
      radius: width * (.34 - band * .04),
      opacity: .32 + .5 * ((Math.sin(phase) + 1) / 2),
    };
  });
}

export function whirlwindRounds(age: number, duration: number, rounds: number): WhirlwindRound[] {
  const total = Math.max(.2, duration);
  const count = Math.max(1, Math.round(rounds));
  return Array.from({ length: count }, (_, index) => {
    const start = index * total / count;
    const local = age - start;
    return { index, start, local, progress: clamp01(local / .34) };
  });
}

export function whirlwindDust(width: number, age: number, reducedMotion = false): WhirlwindSpeck[] {
  return Array.from({ length: 14 }, (_, index) => {
    const angle = index / 14 * TAU - (reducedMotion ? 0 : age * 4.2);
    const depth = (Math.sin(angle) + 1) / 2;
    const radius = width * (.24 + .18 * ((index % 4) / 3));
    const lift = reducedMotion ? 0 : (age * 46 + index * 17) % (width * .32);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * .3 - lift,
      size: 1.2 + depth * 1.8,
      opacity: .18 + depth * .42,
    };
  });
}
