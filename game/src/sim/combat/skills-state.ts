import { E, SKILLS, sm } from '../../engine/client';
import type { SkillRow } from '../../../../engine/types.ts';

/**
 * Skill state, conditions and reservations (Phase 6 combat-skills split).
 * Cohesive ownership: row identity, state construction, mode/condition reads,
 * aura reservation math. No import of the combat cast pipeline or core/game
 * facade — leaf module with narrow inputs.
 */

/**
 * F23 — what a row is for, read from its own shape. This is a naming contract for the bar, the
 * wiki and a balance review; it never changes a cast. A row may be sustain and pack-clear at once
 * (a healing field); the more specific survival answer wins the label.
 */
export type SkillIdentity = 'single-target' | 'pack-clear' | 'sustain' | 'control' | 'utility';

export function skillIdentity(skill: SkillRow): SkillIdentity {
  const effects = skill.effects || [];
  const sustain = skill.type === 'heal'
    || effects.some((effect) => /heal|leech|regen|restore/i.test(effect.stat))
    || (skill.kind || '').toLowerCase() === 'sustain';
  if (sustain) return 'sustain';
  const control = skill.type === 'curse'
    || effects.some((effect) => !!effect.status || /stun|shock|chill|slow|fear|root/i.test(effect.stat));
  if (control) return 'control';
  const area = skill.area;
  const areaTargets = !!area && ((area.radius_m || 0) > 0 || area.shape === 'cone' || area.shape === 'line'
    || area.shape === 'circle');
  const many = areaTargets || /all|multi|pack|area/i.test(skill.offline_targets || '');
  if (many) return 'pack-clear';
  if (skill.type === 'attack') return 'single-target';
  return 'utility';
}

export interface SkillState {
  /** Owned skills: id → duplicates poured into its own ladder. */
  owned: Record<string, number>;
  /** The ACTIVE_SLOTS active bar, cast top-down (attack · curse · heal). */
  list: (string | null)[];
  /** Buffs and auras are a toggle track and take no slot. */
  buffs: Record<string, boolean>;
  auras: Record<string, boolean>;
  /** Per-skill XP, earned per kill while slotted or open. */
  xp: Record<string, number>;
  /** Seconds left on each skill's own cooldown. */
  cd: Record<string, number>;
  /** Buff uptime, seconds left. */
  buffUp: Record<string, number>;
  /**
   * §14: what each slotted skill does with its slot. `always` (the default) is what "cast when
   * ready" has always meant; `never` is the player silencing a row they do not want in the
   * rotation; `conditional` fires only while one of that row's own `conditions` holds.
   */
  mode: Record<string, SkillMode>;
  /** Per-row player override for the automatic rotation; absent reads the authored row flag. */
  autoMode?: Record<string, 'auto' | 'manual' | 'both'>;
  /**
   * One condition list per conditional row, keyed by the row's skill id — so a rotation can say
   * "this row on a boss" and "that row only under half my pool" at once. An `always` or `never` row
   * is never read here, which keeps `mode` the one switch. Never free text: the legs are the five
   * named ones in `SkillConditions`.
   */
  conditions: Record<string, SkillConditions>;
  /** 54 Blood Covenant: the pool each aura pays its reservation from. Absent means Mana. */
  auraPool?: Record<string, 'hp' | 'mana'>;
}

export type SkillMode = 'always' | 'conditional' | 'never';

export interface SkillConditions {
  /** Fire this row against a boss only. */
  boss: boolean;
  /** Fire it only while the character is under this share of its pool (0 = off). */
  hpBelowPct: number;
  /**
   * One flag per Element status a row can apply (the `elements.status_of` names): the row fires
   * while the target is MISSING a status it applies. Read off the roster, not typed per
   * skill — `appliedStatusOf` derives which one a row actually writes from its own effects.
   */
  statusMissing: string[];
  /** One OR leg: fire it when the group is at least this wide (0 = off) — the AoE row's own argument. */
  minTargets: number;
  /** Not a leg of the OR but a restraint on the press: never spend what would drop the pool under this
      share (0 = off). It can only ever hold a row back, never release one. */
  manaFloorPct: number;
  /** A payoff row waits until the status it exploits is present on the target. The status comes from
      the row's own `bonus_vs_status` / `consume_status` effect, never a second list on the slot. */
  statusPresent: boolean;
  /** The minimum stack count the payoff row waits for; 0 means "any live stack". */
  statusStacksAtLeast: number;
  /** A cleanse-style row waits until the character itself carries a status. */
  selfDebuffed: boolean;
}

/** Every leg off — the list an `always` or `never` row is read against, so no leg can hold it back. */
export const NO_COND: SkillConditions = {
  boss: false, hpBelowPct: 0, statusMissing: [], minTargets: 0, manaFloorPct: 0,
  statusPresent: false, statusStacksAtLeast: 0, selfDebuffed: false,
};

/**
 * Move one row of the cast order to another place. The list is the whole rotation, so a move is a splice
 * and not a swap: the rows between slide one place, which is what dragging a slot across the bar means.
 * The bar is a fixed length, so a move never adds or removes a slot.
 */
export function moveSlot(s: SkillState, from: number, to: number): void {
  if (from === to || from < 0 || to < 0 || from >= s.list.length || to >= s.list.length) return;
  const [row] = s.list.splice(from, 1);
  s.list.splice(to, 0, row);
}

/** The condition list a row carries, filled out to every leg so a caller never tests for a key. */
export const condOf = (s: SkillState, id: string): SkillConditions => ({ ...NO_COND, ...(s.conditions?.[id] || {}) });

export const ACTIVE_SLOTS = SKILLS.meta.active_slots;

export function newSkillState(): SkillState {
  return {
    owned: {}, list: new Array(ACTIVE_SLOTS).fill(null), buffs: {}, auras: {}, xp: {}, cd: {}, buffUp: {},
    mode: {}, autoMode: {}, conditions: {}, auraPool: {},
  };
}

/** A first copy has count 0; property presence, not truthiness, means the skill is owned. */
export const ownsSkill = (s: SkillState, id: string): boolean => Object.hasOwn(s.owned, id);

/** Old or malformed saves must not keep effects whose skill is absent from the collection. */
export function clearUnownedTracks(s: SkillState): void {
  for (const track of [s.buffs, s.auras, s.buffUp, s.cd]) {
    for (const id of Object.keys(track)) if (!ownsSkill(s, id) || !sm.byId[id]) delete track[id];
  }
  for (const id of Object.keys(s.buffs)) if (sm.byId[id]?.type !== 'buff') delete s.buffs[id];
  for (const id of Object.keys(s.auras)) if (sm.byId[id]?.type !== 'aura') delete s.auras[id];
  for (const id of Object.keys(s.xp || {})) if (!ownsSkill(s, id)) delete s.xp[id];
  for (const id of Object.keys(s.autoMode || {})) if (!ownsSkill(s, id) || !sm.byId[id]) delete s.autoMode![id];
}

export const modeOf = (s: SkillState, id: string): SkillMode => s.mode[id] || 'always';

/**
 * The status a row actually applies. An Element name alone is not an application: a payoff row can
 * carry `fire` while it reads a burn, and a row whose sentence names no status never writes one.
 * The declaration-first order matches the cast pipeline: a typed stack/count, then a direct stop or
 * bleed, then the row's own guaranteed Element status.
 */
export function appliedStatusOf(skill: any): string | null {
  if (!skill) return null;
  // a payoff row's status is the one it reads, not a rider it happens to carry; its slot gets the
  // `statusPresent` leg instead of a maintenance leg
  if (sm.exploitedStatusOf(skill)) return null;
  const targetHas = (stat: string) => (skill.effects || []).some((e: any) => e.subject === 'target' && e.stat === stat);
  if (targetHas('burn_stacks')) return 'burn';
  if (targetHas('poison_stacks')) return 'poison';
  if (targetHas('mark_stacks')) return 'mark';
  if (targetHas('bleed_chance')) return 'bleed';
  if (targetHas('stop_sec') || targetHas('stun_chance')) return 'shock';
  if (!((skill.rules || []) as string[]).includes('guaranteed_status')) return null;
  const map = ((E.elements || {}) as any).status_of || {};
  return skill.element && map[skill.element] ? map[skill.element] : null;
}

/** The curse a row writes, as the flag the player ticks — a curse row's own id. */
export const appliedCurseOf = (skill: any): string | null => (skill?.type === 'curse' ? skill.id : null);

export const skillLevel = (s: SkillState, id: string) => sm.skillLevel(s.xp[id] || 0);
export const ladderOf = (s: SkillState, id: string) => sm.ladderPct(s.owned[id] || 0);

/** A row's mechanic word — each one is in `engine/skills.ts` `EFFECT_RULES` and has a reader here. */
export const hasRule = (skill: any, rule: string): boolean => ((skill?.rules || []) as string[]).includes(rule);

/**
 * Does this row's own condition list hold right now? OR across the enabled legs. The caller
 * resolves the facts (`isBoss` off the front target, `missingHpPct` off the pool and the group's width)
 * so this stays a pure read of the list. The `statusMissing` leg needs the row and the target, so it is
 * its own step.
 */
export function conditionsHold(cond: SkillConditions, isBoss: boolean, missingHpPct: number, groupSize: number): boolean {
  if (cond.boss && isBoss) return true;
  if (cond.hpBelowPct > 0 && missingHpPct >= cond.hpBelowPct) return true;
  if (cond.minTargets > 0 && groupSize >= cond.minTargets) return true;
  return false;
}
