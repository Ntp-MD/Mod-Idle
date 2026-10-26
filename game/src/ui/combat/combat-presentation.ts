import type { FxEvent } from '../../sim/types';

export type CombatEffectLevel = 'auto' | 'full' | 'reduced' | 'minimal';

/** Automatic preserves the existing playback adaptation; explicit choices ignore playback density. */
export const combatEffectLevel = (level: CombatEffectLevel = 'auto', speed = 1): Exclude<CombatEffectLevel, 'auto'> =>
  level === 'auto' ? speed <= 1 ? 'full' : 'reduced' : level;

const densitySpeed = (level: CombatEffectLevel, speed: number): number =>
  level === 'auto' ? speed : level === 'full' ? 1 : 4;

/** Named actions, criticals and defensive outcomes retain their own visual beat at every speed. */
export const importantCombatEvent = (event: FxEvent): boolean =>
  !!event.crit || !!event.skillId || !['hit', 'taken'].includes(event.kind);

/** A busy field keeps the newest ordinary contact per actor; skill and defence events take priority. */
export function sceneCombatEvents(ring: FxEvent[], speed = 1, effectLevel: CombatEffectLevel = 'auto'): FxEvent[] {
  if (effectLevel === 'minimal') return [];
  const density = densitySpeed(effectLevel, speed);
  const events = ring.filter((event) =>
    (event.kind === 'hit' && (event.via === 'swing' || event.via === 'cast')) ||
    (event.side === 'self' && ['taken', 'heal', 'buff', 'block'].includes(event.kind) && event.via !== 'dot') ||
    (event.kind === 'block' && !!event.mobId));
  if (density <= 1) return events.slice(0, 12);
  const important = events.filter(importantCombatEvent).slice(0, 12);
  const bodies = new Set<string>();
  const ordinary = events.filter((event) => {
    if (importantCombatEvent(event)) return false;
    const key = `${event.side}:${event.mobId || event.byId || 'player'}`;
    if (bodies.has(key)) return false;
    bodies.add(key);
    return true;
  }).slice(0, Math.min(density >= 4 ? 1 : 2, 12 - important.length));
  const visible = new Set([...important, ...ordinary]);
  return events.filter((event) => visible.has(event));
}

export type DamagePop = FxEvent & { count: number };

/** Only ordinary blows on the same body, in the same sim second and lane, share a total. */
export function combatDamagePops(events: FxEvent[], speed = 1, limit = 4, effectLevel: CombatEffectLevel = 'auto'): DamagePop[] {
  const density = densitySpeed(effectLevel, speed);
  const visibleLimit = effectLevel === 'minimal' ? Math.min(limit, 2) : limit;
  const hits = events.filter((event) => !!event.value);
  if (density <= 1) return hits.slice(0, visibleLimit).map((event) => ({ ...event, count: 1 }));
  const groups = new Map<string, DamagePop>();
  const pops: DamagePop[] = [];
  for (const event of hits) {
    if (importantCombatEvent(event)) { pops.push({ ...event, count: 1 }); continue; }
    const key = `${event.sec}:${event.side}:${event.mobId || event.byId || 'player'}:${event.via}:${event.colour}`;
    const previous = groups.get(key);
    if (previous) { previous.value! += event.value!; previous.count++; }
    else {
      const pop = { ...event, count: 1 };
      groups.set(key, pop);
      pops.push(pop);
    }
  }
  const selected = [...pops.filter(importantCombatEvent), ...pops.filter((event) => !importantCombatEvent(event))].slice(0, visibleLimit);
  return pops.filter((event) => selected.includes(event));
}

/** Repeated uses of one skill share a cue in fast playback; casts remain separate from damage. */
export function combatCastCues(events: FxEvent[], speed = 1, effectLevel: CombatEffectLevel = 'auto'): (FxEvent & { count: number })[] {
  if (densitySpeed(effectLevel, speed) <= 1) return events.slice(0, 3).map((event) => ({ ...event, count: 1 }));
  const groups = new Map<string, FxEvent & { count: number }>();
  for (const event of events) {
    const key = `${event.sec}:${event.skillId}`;
    const previous = groups.get(key);
    if (previous) previous.count++;
    else groups.set(key, { ...event, count: 1 });
  }
  return [...groups.values()].slice(0, 3);
}

/** Less travel for repetitive contacts, without hiding a critical, skill or defensive response. */
export function combatMotionWeight(event: FxEvent, speed = 1, effectLevel: CombatEffectLevel = 'auto'): number {
  if (effectLevel === 'minimal') return 0;
  if (effectLevel === 'full') return 1;
  if (effectLevel === 'reduced') return importantCombatEvent(event) ? .45 : .2;
  return speed <= 1 || importantCombatEvent(event) ? 1 : speed >= 4 ? .2 : .45;
}

export const combatTempo = (speed = 1): number => Math.sqrt(Math.max(1, speed));
