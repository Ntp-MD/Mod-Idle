import { sm } from '../engine/client';

/**
 * The target side of a curse.
 *
 * A curse writes its row's own numbers onto the mob it landed on, with that row's own duration
 * (`skill-pool.md`). Nothing here states a magnitude: the values come from `skills.json`, where
 * cage gate S11 fails if one stops matching the row's own `effect` sentence.
 *
 * A re-cast of the same line refreshes it rather than stacking it — the rule the roster already
 * states for bleed ("a new application refreshes it") — while two different curses on the same mob
 * add, because they are separate lines.
 */

export type CurseLine = { stat: string; value: number; secLeft: number; condition?: string;
  /** The row that wrote it — the `status missing` condition reads this to know if THAT curse is up. */
  from?: string };

export type CurseLines = Record<string, CurseLine>;

/** mob id → the curse lines currently on it. */
export type CurseStore = Record<string, CurseLines>;

export const newCurses = (): CurseStore => ({});

/** What a mob carries, summed. */
export interface CurseMods {
  damageDealt: number;
  attackSpeed: number;
  accuracy: number;
  damageTaken: number;
  critChance: number;
  /** Mark leeches HP from the damage we deal: a % of just-dealt damage, per stack. */
  leechPct: number;
  /** Shock has this target's clock stopped for the second. */
  stopped: boolean;
  /** Chill's armour cut, as a fraction of the mob's own Armour line. */
  armourCut: number;
  /** A resistance strip in percentage points, negative as the row states it (Sunder). */
  resistCut: number;
  /** Elemental Break: this target takes more of the Element half, in percentage points. */
  elemTakenPct: number;
}

export const NO_CURSE: CurseMods = {
  damageDealt: 0, attackSpeed: 0, accuracy: 0, damageTaken: 0, critChance: 0, leechPct: 0,
  stopped: false, armourCut: 0, resistCut: 0, elemTakenPct: 0,
};

/**
 * Merge everything one target carries — the curse lines and the statuses we inflicted — into the
 * single set of multipliers the combat functions read. Each percentage is already bounded by its own
 * Cap where the design caps it, so this only adds the separate sources.
 */
export function combineMods(a: CurseMods, b: Partial<CurseMods>): CurseMods {
  return {
    damageDealt: a.damageDealt + (b.damageDealt || 0),
    attackSpeed: a.attackSpeed + (b.attackSpeed || 0),
    accuracy: a.accuracy + (b.accuracy || 0),
    damageTaken: a.damageTaken + (b.damageTaken || 0),
    critChance: a.critChance + (b.critChance || 0),
    leechPct: (a.leechPct || 0) + (b.leechPct || 0),
    armourCut: (a.armourCut || 0) + (b.armourCut || 0),
    resistCut: (a.resistCut || 0) + (b.resistCut || 0),
    elemTakenPct: (a.elemTakenPct || 0) + (b.elemTakenPct || 0),
    stopped: Boolean(a.stopped || b.stopped),
  };
}

/** A conditional line keeps its own key, so Shatter and Expose can both sit on `damage_taken`. */
export const lineKey = (e: { stat: string; condition?: string }) =>
  (e.condition ? `${e.stat}#${e.condition}` : e.stat);

/** Lay a curse's target-side lines on a mob. Returns how many seconds they will last. */
export function applyCurse(store: CurseStore, mobId: string, skill: any): number {
  const lines = ((skill?.effects || []) as any[]).filter((e) => e.subject === 'target');
  if (!lines.length) return 0;
  const sec = Number(String(skill.duration).match(/\d+/)?.[0] || 0);
  const mine = store[mobId] || (store[mobId] = {});
  for (const e of lines) mine[lineKey(e)] = { stat: e.stat, value: e.value, secLeft: sec, condition: e.condition, from: skill.id };
  return sec;
}

/**
 * Everything one mob carries from curses, summed. A line with a condition only counts while
 * `present` says that condition holds — an un-chilled target takes nothing from Shatter.
 */
export function linesOn(store: CurseStore, mobId: string, present: (condition: string) => boolean = () => false): CurseLine[] {
  return Object.values(store[mobId] || {}).filter((l) => !l.condition || present(l.condition));
}

/** The value of one named line on this mob, or 0 when nothing of that kind is on it. */
export const lineValue = (store: CurseStore, mobId: string, stat: string): number =>
  store[mobId]?.[stat]?.value ?? 0;

export function modsOn(store: CurseStore, mobId: string, present: (condition: string) => boolean = () => false): CurseMods {
  const mine = linesOn(store, mobId, present);
  const v = (k: string) => mine.filter((l) => l.stat === k).reduce((sum, l) => sum + l.value, 0);
  // the status side owns leech, the stop and chill's armour cut — a curse writes none of them, so
  // NO_CURSE supplies those three and this function only ever adds the lines a curse carries
  return {
    ...NO_CURSE,
    damageDealt: v('damage_dealt'),
    attackSpeed: v('attack_speed'),
    accuracy: v('accuracy'),
    damageTaken: v('damage_taken'),
    critChance: v('crit_chance'),
    // a strip of the mob's own Elemental resistance, in percentage points (Sunder)
    resistCut: v('mob_elemental_resistance_pct'),
    // and a line that makes it take more of the Element half (Elemental Break)
    elemTakenPct: v('mob_elemental_damage_taken_pct'),
  };
}

/**
 * The target-side lines an aura carries, in the shape the mob mods read. An aura writes on everything
 * in range rather than on one mob it landed on, so Rimbo Form's slow and Elemental Fury's resistance
 * strip reach the fight through here.
 */
export function modsFromAuraFold(target: { add?: Record<string, number> }): Partial<CurseMods> {
  const a = target.add || {};
  return {
    damageDealt: a.damage_dealt || 0,
    attackSpeed: a.attack_speed || 0,
    accuracy: a.accuracy || 0,
    damageTaken: a.damage_taken || 0,
    critChance: a.crit_chance || 0,
    resistCut: a.mob_elemental_resistance_pct || 0,
    elemTakenPct: a.mob_elemental_damage_taken_pct || 0,
  };
}

/** One second off every line, then forget the mobs that are no longer on the field. */
export function tickCurses(store: CurseStore, liveIds: Set<string>): void {
  for (const [mobId, lines] of Object.entries(store)) {
    for (const [stat, line] of Object.entries(lines)) {
      line.secLeft--;
      if (line.secLeft <= 0) delete lines[stat];
    }
    if (!Object.keys(lines).length) delete store[mobId];
  }
  for (const mobId of Object.keys(store)) if (!liveIds.has(mobId)) delete store[mobId];
}

/** A mob's threat is priced as damage per second, so a weaker hit and a slower clock scale the same number. */
export const psMult = (m: CurseMods) => (1 + m.damageDealt / 100) * (1 + m.attackSpeed / 100);

/** Accuracy is a straight percent on the mob's own line, so it moves both hit rolls it feeds. */
export const accMult = (m: CurseMods) => 1 + m.accuracy / 100;

/** What a cursed target takes, as a multiplier on our hit. */
export const takenMult = (m: CurseMods) => 1 + m.damageTaken / 100;

/** Which of the character's skills can write a line on a mob, for the panel. */
export const curableRows = () => sm.of('curse').filter((s: any) => (s.effects || []).some((e: any) => e.subject === 'target'));

/**
 * Pandemonium: when a cursed target dies, the lines it was carrying go to the neighbours its row
 * names, each with the duration it still had left. The count is read off the mob's own curse
 * line at the moment of death, so no cast state has to remember it. Returns how many caught it.
 */
export function spreadOnDeath(store: CurseStore, mobId: string, neighbours: string[]): number {
  const cap = lineValue(store, mobId, 'spread_targets');
  const lines = store[mobId];
  if (!cap || !lines) return 0;
  const carrying = Object.values(lines).filter((l) => l.stat !== 'spread_targets');
  let caught = 0;
  for (const id of neighbours.slice(0, cap)) {
    const mine = store[id] || (store[id] = {});
    for (const l of carrying) mine[lineKey(l)] = { ...l };
    caught++;
  }
  return caught;
}
