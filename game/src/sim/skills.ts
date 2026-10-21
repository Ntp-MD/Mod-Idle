import { eng, E, SKILLS, sm } from '../engine/client';
import {
  auraResonance, auraScaledValue, bloodPriceHp, bundleOf, manaDebtFloor,
  type KeystoneBundle,
} from '../../../engine/keystones.ts';
import { directFlags, emptyParts, validateDamagePacket } from '../../../engine/damage-provenance.ts';
import type { DamagePacket } from '../../../engine/damage-provenance.ts';
import { mastery } from './mastery';
import { setStacks, setErosion, stopMob, placeStatus, modsOn as mobModsOn, targetMods, applyWeaponRiders, holdsCondition, CONDITION_OF, type MobStatusName } from './mobStatus';
import { lineValue, applyCurse } from './curse';
import type { Character } from './player';
import type { Mob } from './types';
import type { Statuses } from './combat';

export interface SkillState {
  /** Owned skills: id → duplicates poured into its own ladder. */
  owned: Record<string, number>;
  /** The 14-slot active bar, cast top-down (attack · curse · heal). */
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
   * skill — `appliedStatusOf` derives which one a row carries from its own `element`.
   */
  statusMissing: string[];
  /** One OR leg: fire it when the group is at least this wide (0 = off) — the AoE row's own argument. */
  minTargets: number;
  /** Not a leg of the OR but a restraint on the press: never spend what would drop the pool under this
      share (0 = off). It can only ever hold a row back, never release one. */
  manaFloorPct: number;
}

/** Every leg off — the list an `always` or `never` row is read against, so no leg can hold it back. */
export const NO_COND: SkillConditions = { boss: false, hpBelowPct: 0, statusMissing: [], minTargets: 0, manaFloorPct: 0 };

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
    mode: {}, conditions: {}, auraPool: {},
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
}

export function clampAuraReservations(s: SkillState): void {
  let held = 0;
  for (const [id, on] of Object.entries(s.auras)) {
    const row = sm.byId[id];
    if (!on || !ownsSkill(s, id) || row?.type !== 'aura') { delete s.auras[id]; continue; }
    const next = held + sm.reservePct(row.reserve ?? '');
    if (next >= sm.RESERVATION_LIMIT) s.auras[id] = false;
    else held = next;
  }
}

export const modeOf = (s: SkillState, id: string): SkillMode => s.mode[id] || 'always';

/** The Element status a row applies, read out of `elements.status_of` and the row's own `element`. */
export function appliedStatusOf(skill: any): string | null {
  const el = skill?.element;
  const map = ((E.elements || {}) as any).status_of || {};
  return el && map[el] ? map[el] : null;
}

/** The curse a row writes, as the flag the player ticks — a curse row's own id. */
export const appliedCurseOf = (skill: any): string | null => (skill?.type === 'curse' ? skill.id : null);

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

/**
 * The `status missing` leg: this row applies an enabled status the target does not carry. Two kinds
 * of flag live in the one list, both read off the roster rather than typed per skill — an Element
 * status (from the row's own `element` through `elements.status_of`) and a curse (the row's own id).
 */
function appliesMissingStatus(cond: SkillConditions, skill: any, env: CastEnv, mob: any): boolean {
  const want = cond.statusMissing || [];
  if (!want.length) return false;
  const status = appliedStatusOf(skill);
  if (status && want.includes(status) && env.mobStatus) {
    const cond = Object.keys(CONDITION_OF).find((k) => CONDITION_OF[k] === status);
    if (cond && !holdsCondition(env.mobStatus, mob.id, cond)) return true;
  }
  const curse = appliedCurseOf(skill);
  if (curse && want.includes(curse) && env.curses) {
    const lines = Object.values((env.curses[mob.id] || {}) as Record<string, any>);
    if (!lines.some((l) => l.from === curse)) return true;
  }
  return false;
}

export const skillLevel = (s: SkillState, id: string) => sm.skillLevel(s.xp[id] || 0);
export const ladderOf = (s: SkillState, id: string) => sm.ladderPct(s.owned[id] || 0);

/** A row's mechanic word — each one is in `engine/skills.ts` `EFFECT_RULES` and has a reader here. */
export const hasRule = (skill: any, rule: string): boolean => ((skill?.rules || []) as string[]).includes(rule);

/** One named magnitude off the row, with a default when the row does not state it. */
const valueOf = (skill: any, stat: string, fallback: number): number => {
  const e = ((skill?.effects || []) as any[]).find((x) => x.stat === stat);
  return e ? e.value : fallback;
};

/** Effective cooldown, ladder before CDR (`skill-pool.md` "Cooldown calculation order"). */
export function skillCd(s: SkillState, id: string, cdrPct: number): number {
  const skill = sm.byId[id];
  return sm.effCd(skill.cd ?? 0, cdrPct, ladderOf(s, id));
}

/** Auras reserve a % of their chosen pool; the set may not reserve the whole Mana pool. Packet F:
 *  `64` discounts every aura reservation by `bR`, `34` adds its own fixed 40%, and `54` routes an
 *  aura's reservation to HP without changing Max HP. */
export function reservedPct(s: SkillState, bundles: readonly KeystoneBundle[] = []): number {
  const { bR } = auraResonanceOf(s, bundles);
  let total = 0;
  for (const [id, on] of Object.entries(s.auras)) {
    if (!on || !ownsSkill(s, id)) continue;
    if (auraPoolOf(s, id) === 'hp') continue;
    total += sm.reservePct(sm.byId[id]?.reserve ?? '') * (1 - bR);
  }
  const battery = bundleOf(bundles, 'arcane-battery');
  // fixed reserves are not aura reservations: 64 never discounts them (§7.5.3)
  if (battery) total += Number(battery.params.reserveManaPct);
  return total;
}

/** The share of Full Max HP held back by reservations: 35 plus every 54 aura assigned to HP. */
export function hpReservedPct(s: SkillState, bundles: readonly KeystoneBundle[] = []): number {
  let total = 0;
  for (const [id, on] of Object.entries(s.auras)) {
    if (!on || !ownsSkill(s, id)) continue;
    if (auraPoolOf(s, id) === 'hp') total += sm.reservePct(sm.byId[id]?.reserve ?? '');
  }
  const faith = bundleOf(bundles, 'radiant-faith');
  if (faith) total += Number(faith.params.reserveHpPct);
  return total;
}

/** The pool one aura pays from, defaulting to Mana (`54`). */
export const auraPoolOf = (s: SkillState, id: string): 'hp' | 'mana' =>
  s.auraPool?.[id] === 'hp' ? 'hp' : 'mana';

/** 54: choose an aura's pool. Refused without the keystone; a pool change is a candidate transaction
 *  at the caller, which validates the new set before committing it. */
export function setAuraPool(s: SkillState, id: string, pool: 'hp' | 'mana', bundles: readonly KeystoneBundle[] = []): { ok: boolean; why?: string } {
  if (!bundleOf(bundles, 'blood-covenant')) return { ok: false, why: 'only Blood Covenant lets an aura pay from HP' };
  if (!ownsSkill(s, id) || sm.byId[id]?.type !== 'aura') return { ok: false, why: 'that row is not an aura you own' };
  s.auraPool ||= {};
  s.auraPool[id] = pool;
  return { ok: true };
}

/** The 64 shares: the aura count and each side's capped stretch. */
export function auraResonanceOf(s: SkillState, bundles: readonly KeystoneBundle[]): { count: number; bR: number; bE: number } {
  let count = 0;
  for (const [id, on] of Object.entries(s.auras)) if (on && ownsSkill(s, id) && sm.byId[id]?.type === 'aura') count++;
  const bundle = bundleOf(bundles, 'aura-resonance');
  if (!bundle) return { count, bR: 0, bE: 0 };
  const params = bundle.params as Record<string, number>;
  const share = auraResonance(count, params);
  return { count, bR: share.b, bE: share.effectMult - 1 };
}

/** The words a stat key reads as on a row the player can act on. */
export const EFFECT_LABEL: Record<string, string> = {
  attack_speed: 'attack speed', mana_regen: 'mana regen', hp_regen: 'hp regen', evasion: 'evasion',
  armour: 'armour', energy_shield: 'Energy Shield', physical_power: 'physical power',
  elemental_alignment: 'elemental alignment', elemental_resistance: 'elemental resistance',
  damage_taken: 'damage taken', heal_per_sec: 'heal per second', heal_instant: 'instant heal',
  es_absorb_pct: 'damage absorbed to Energy Shield', es_absorb_cap: 'damage absorbed to Energy Shield (Cap)',
  // the target-side lines a curse writes
  damage_dealt: 'damage dealt', accuracy: 'accuracy', crit_chance: 'crit chance',
};

/** Say a folded effect set the same way a row's label is said, in words rather than stat keys. */
export function describeFold(e: { add: Record<string, number>; mult: Record<string, number> }): string {
  const parts = Object.entries(e.add).map(([k, v]) => `${EFFECT_LABEL[k] || k} +${v}`);
  for (const [k, v] of Object.entries(e.mult)) {
    if (Math.abs(v - 1) > 1e-9) parts.push(`${EFFECT_LABEL[k] || k} ×${v.toFixed(2)}`);
  }
  return parts.join(' · ');
}

/** One row's numeric effects, said the way the row's own sentence says them. */
export function effectLine(skill: any): string {
  const list = (skill?.effects || []) as any[];
  return list
    .map((e) => `${EFFECT_LABEL[e.stat] || e.stat}${e.op === 'mult' ? ` ×${e.value}` : e.op === 'add_flat' ? ` +${e.value} flat` : ` +${e.value}%`}`)
    .join(' · ');
}

/** A buff whose row carries this mechanic word is currently on its clock. */
export function buffRuleUp(sk: SkillState, rule: string): boolean {
  return Object.entries(sk.buffUp).some(([id, left]) => ownsSkill(sk, id) && left > 0 && hasRule(sm.byId[id], rule));
}

/**
 * Energy Absorb: the share of an incoming hit the buff turns into Energy Shield right now,
 * ramped linearly from its level-1 base to its Cap across the skill levels. Zero when it is off.
 */
export function esAbsorbPct(sk: SkillState): number {
  const cap = E.skill_xp.level_cap;
  for (const [id, left] of Object.entries(sk.buffUp)) {
    if (left <= 0 || !ownsSkill(sk, id)) continue;
    const row = sm.byId[id];
    const base = (row?.effects || []).find((e: any) => e.stat === 'es_absorb_pct');
    if (!base) continue;
    const top = (row.effects || []).find((e: any) => e.stat === 'es_absorb_cap');
    const t = cap > 1 ? (skillLevel(sk, id) - 1) / (cap - 1) : 0;
    return base.value + ((top ? top.value : base.value) - base.value) * Math.min(1, Math.max(0, t));
  }
  return 0;
}

/**
 * Flip one toggle-track skill. An aura can only go on while the pool has the room for its
 * reservation (`skill-pool.md` · the block the S9 gate prints), and taking one off is always free.
 */
export function toggleTrack(s: SkillState, id: string, bundles: readonly KeystoneBundle[] = []): { ok: boolean; why?: string } {
  const skill = sm.byId[id];
  if (!skill) return { ok: false, why: 'not in the collection' };
  if (!ownsSkill(s, id)) return { ok: false, why: 'skill not owned' };
  if (skill.type === 'aura') {
    const turning = !s.auras[id];
    if (turning) {
      // only a Mana-paid reservation can crowd the usable Mana pool; a 54 HP aura pays from HP
      const next = reservedPct(s, bundles) + (auraPoolOf(s, id) === 'hp' ? 0
        : sm.reservePct(skill.reserve ?? '') * (1 - auraResonanceOf(s, bundles).bR));
      // reserving the whole pool would leave no mana to cast with, so the block is exclusive
      // (`skill-pool.md`: an aura set that may not reserve all of it)
      if (next >= sm.RESERVATION_LIMIT) {
        return { ok: false, why: `that would reserve ${next}% of the pool, and the set must leave some usable` };
      }
    }
    s.auras[id] = turning;
    return { ok: true };
  }
  if (skill.type === 'buff') {
    s.buffs[id] = !s.buffs[id];
    if (!s.buffs[id]) s.buffUp[id] = 0;
    return { ok: true };
  }
  return { ok: false, why: `a ${skill.type} skill takes a bar slot, not a toggle` };
}

/** One trigger aura's price: its own clock and the mana / damage it puts on the press it fires. */
export interface TriggerAura { id: string; cdSec: number; manaMult: number; damageMult: number; }

/**
 * The active trigger auras, keyed by the event that fires them: `crit` (`aura.cast_on_crit`) and
 * `taken` (`aura.cast_on_damage_taken`). A null slot means the event has no aura up. The numbers are
 * read off the row the same way every other effect is, so a re-tune moves the aura and the sim together.
 */
export function triggerAuras(s: SkillState): { crit: TriggerAura | null; taken: TriggerAura | null } {
  const out: { crit: TriggerAura | null; taken: TriggerAura | null } = { crit: null, taken: null };
  for (const k of sm.all() as any[]) {
    if (k.type !== 'aura' || !s.auras[k.id] || !ownsSkill(s, k.id)) continue;
    const rules: string[] = k.rules || [];
    const event = rules.includes('cast_on_crit') ? 'crit' : rules.includes('cast_on_damage_taken') ? 'taken' : null;
    if (!event || out[event]) continue;
    const effects = sm.effectsAt(k, skillLevel(s, k.id)) as any[];
    const at = (stat: string) => effects.find((e: any) => e.stat === stat);
    out[event] = {
      id: k.id,
      cdSec: at('trigger_cd_sec')?.value ?? 1,
      manaMult: at('cast_mana_mult')?.value ?? 1,
      damageMult: at('cast_damage_mult')?.value ?? 1,
    };
  }
  return out;
}

export function usableMana(c: Character, s: SkillState): number {
  return Math.max(0, c.maxMana * (1 - reservedPct(s, c.keystones) / 100));
}

/** The units the auras hold back: a share of Max Mana that stays in the bar but never leaves it. */
export function reservedMana(c: Character, s: SkillState): number {
  return c.maxMana * (reservedPct(s, c.keystones) / 100);
}

/** The HP that reservations hold back (`35`, and any `54` aura assigned to HP). */
export function hpReserved(c: Character, s: SkillState): number {
  return c.maxHp * (hpReservedPct(s, c.keystones) / 100);
}

/** The HP a heal may reach: Full Max HP less the reserved share, never below 1 (§7.5). */
export function usableHp(c: Character, s: SkillState): number {
  return Math.max(1, c.maxHp - hpReserved(c, s));
}

/** What the rotation may spend right now: the pool minus the slice the auras hold back. With 52 the
 *  answer may stand negative, down to the debt floor. */
export function spendableMana(c: Character, s: SkillState, currentMana: number): number {
  const debt = bundleOf(c.keystones, 'mana-debt');
  const floor = debt ? manaDebtFloor(usableMana(c, s), debt.params as Record<string, number>) : 0;
  return Math.max(-floor, currentMana - reservedMana(c, s));
}

/**
 * What a row costs this character right now: its typed flat Mana or current-HP units, grown only by
 * the row's own skill level. Pool size decides whether the press is affordable, never its price.
 */
export function costNow(s: SkillState, id: string, aoe = false): string {
  const skill = sm.byId[id];
  if (skill.type === 'aura') return `reserve ${sm.reservePct(skill.reserve || '')}% Max Mana`;
  const cost = sm.costOf(skill, { skillLevel: skillLevel(s, id), aoe });
  const resource = cost.resource === 'hp' ? 'HP' : 'Mana';
  const spec = cost.resource === 'hp' ? skill.hp_cost : skill.mana;
  return `${spec} · ${Math.round(cost.amount)} ${resource} now`;
}

/** Whether a named reward adds ownership or useful progress on the Duplicate Ladder. */
export function usefulSkillDuplicate(s: SkillState, id: string): boolean {
  if (!Object.hasOwn(sm.byId, id)) return false;
  return !ownsSkill(s, id) || ((sm.byId[id].cd ?? 0) > 0 && s.owned[id] < sm.LADDER_MAX_DUPLICATES);
}

/** Grant one known skill without drawing RNG or enabling its toggle track. */
export function grantNamedSkill(
  s: SkillState, id: string, options: { duplicate?: boolean; level?: number } = {},
): { id: string; duplicate: boolean } | null {
  if (!Object.hasOwn(sm.byId, id)) return null;
  if (options.level !== undefined && (!Number.isSafeInteger(options.level) || options.level < 1 || options.level > E.skill_xp.level_cap)) return null;
  const chosen = sm.byId[id];
  const duplicate = ownsSkill(s, id);
  if (!duplicate) s.owned[id] = 0;
  else if (options.duplicate !== false) s.owned[id] += 1;
  s.xp[id] ??= 0;
  if (options.level !== undefined) s.xp[id] = Math.max(s.xp[id], sm.skillXpForLevel(options.level));
  if (!duplicate) {
    const free = s.list.findIndex((x) => x === null);
    // A zero-CD filler remains the player's rotation choice, as with ordinary drops.
    if (free >= 0 && (chosen.cd ?? 0) > 0 && ['attack', 'curse', 'heal'].includes(chosen.type as string)) s.list[free] = id;
  }
  return { id, duplicate };
}

/** Grant a skill drop: a new skill, or a duplicate that feeds that skill's own ladder. */
export function grantSkill(s: SkillState, rng: () => number): { id: string; duplicate: boolean } | null {
  const pool = sm.all();
  const fresh = pool.filter((k: any) => !ownsSkill(s, k.id));
  const pickFrom = fresh.length && rng() < 0.7 ? fresh : pool;
  const chosen = pickFrom[Math.floor(rng() * pickFrom.length)];
  if (!chosen) return null;
  const granted = grantNamedSkill(s, chosen.id);
  // Ordinary first drops historically reset stray XP for an unowned skill.
  if (granted && !granted.duplicate) s.xp[chosen.id] = 0;
  return granted;
}

/** Every kill pays 1 XP to each slotted or open skill (`engine.json` skill_xp). */
export function paySkillXp(s: SkillState) {
  const earning = [...s.list.filter((id): id is string => id !== null && ownsSkill(s, id)), ...Object.keys(s.auras).filter((k) => s.auras[k] && ownsSkill(s, k)),
    ...Object.keys(s.buffs).filter((k) => s.buffs[k] && ownsSkill(s, k))];
  for (const id of new Set(earning)) s.xp[id] = (s.xp[id] || 0) + E.skill_xp.xp_per_kill;
}

/** The stores a cast may write to, passed in so the rotation stays a function of state. */
export interface CastEnv {
  mobStatus?: any;
  curses?: any;
  /** The current HP pool is the affordability check for a skill with a flat HP cost. */
  currentHp?: number;
  /** How much of the pool is currently missing, for a row that scales with lost HP. */
  missingHpPct?: number;
  /** The front target is a boss — the `boss` leg of the shared condition list (§14). */
  isBoss?: boolean;
  /**
   * A press a trigger aura fired (`aura.cast_on_crit` · `aura.cast_on_damage_taken`). It is the same
   * press with a price on it: its resource cost is multiplied, the damage is scaled, and the skill's own
   * cooldown is NOT spent — the trigger runs its own clock (`trigger_cd_sec`), so an unmodified press
   * and a triggered one cannot stack the same row twice through the cooldown.
   */
  trigger?: { manaMult?: number; damageMult?: number };
  /** Absolute µs the damage packets stamp (§7.2); null until the combat clock (D2) provides it. */
  timeUs?: number | null;
}

export interface CastReport {
  id: string;
  name: string;
  damage: number;
  manaCost: number;
  /** HP paid from the caster's current pool; cost cannot take the final HP point. */
  hpCost: number;
  targets: number;
  heal?: { secLeft: number; pctPerSec: number };
  /** A heal that lands at once, as a % of the pool — Greater Heal, not the per-second drip. */
  instantHealPct?: number;
  /** The mob a landed curse wrote its lines on, or null when it missed or writes nothing. */
  curseOn?: string | null;
  /** A phys-basis press rolled crit (pin 1); a magic-basis press never sets this. */
  crit?: boolean;
  /** HP actually removed by this cast, across every target it landed on. */
  dealt?: number;
  /** One entry per mob this press hurt: its id and the HP it lost after mitigation. `dealt` is the sum of
   *  these, and a press that hurt nobody carries an empty list — so the client can put each number on the
   *  plate it belongs to instead of splitting a total it was never asked to share. Named for what it is
   *  keyed by, because `hits` already means this row's repeat count. */
  byMob: { id: string; amount: number; packet?: DamagePacket }[];
  /** Ghost Dance: perfect-dodge charges this press grants, from its own level ramp. */
  charges?: number;
  /** Earth Wall: block charges this press grants, from its own level ramp. */
  blockCharges?: number;
  /** A row whose effect is to clear what is on the character (Cleanse, and Holy Veil's cast). */
  cleansesSelf?: boolean;
}

/**
 * The magnitude of a heal now comes from the row's own `effects` field. It used to be read out of
 * the `effect` sentence, which quietly made Greater Heal a per-second drip of 45% for eight seconds
 * instead of one instant 45%.
 */
function healOf(skill: any): { heal?: { secLeft: number; pctPerSec: number }; instantHealPct?: number } | null {
  if (skill.type !== 'heal') return null;
  const eff = skill.effects || [];
  const drip = eff.find((e: any) => e.stat === 'heal_per_sec');
  if (drip) {
    return { heal: { secLeft: Number(String(skill.duration).match(/\d+/)?.[0] || 0), pctPerSec: drip.value / 100 } };
  }
  const instant = eff.find((e: any) => e.stat === 'heal_instant');
  return instant ? { instantHealPct: instant.value } : null;
}

/**
 * What the skills that are up right now do to the character: every reserved aura plus each toggled
 * buff still on its clock, folded by the shared `aggregateEffects`.
 */
export function effectsActive(sk: SkillState, bundles: readonly KeystoneBundle[] = []) {
  const { bE } = auraResonanceOf(sk, bundles);
  const rows: any[] = [];
  for (const [id, on] of Object.entries(sk.auras)) {
    if (!on || !ownsSkill(sk, id) || sm.byId[id]?.type !== 'aura') continue;
    const row = sm.byId[id];
    // 64 Aura Resonance stretches the aura's effects once (never 1.05^N), skipping its identity
    // fields — trigger clocks, cast cost and cast damage (§7.5.6).
    rows.push(bE > 0
      ? { ...row, effects: (row.effects || []).map((e: any) => ({ ...e, value: auraScaledValue(e.op, e.value, bE, e.stat) })) }
      : row);
  }
  for (const [id, left] of Object.entries(sk.buffUp)) if (left > 0 && ownsSkill(sk, id) && sm.byId[id]) rows.push(sm.byId[id]);
  return sm.aggregateEffects(rows, (r: any) => skillLevel(sk, r.id));
}

/** The stat a skill scales on is the finished hit it multiplies, so no `scale` lookup remains. */

/** "3/1" → 3 targets when the group is big enough, else 1 (`skill-pool-attack.md` targets column).
 *  The AoE rule is 60% per target, Cap 3, mana ×1.5 (`skill-pool.md`) — the cost multiplier is
 * read from `engine.json` `aoe.mana_mult` inside `manaCostOf`, not repeated here. */
/** the row's per-target share, read off the AoE rule the engine prices (`aoe.per_target_pct`) */
const AOE_PCT_PER_EXTRA_TARGET = (E.aoe as any).per_target_pct / 100;

function targetCount(skill: any, group: Mob[]): number {
  const cap = Number(String(skill.targets || '1').split('/')[0]) || 1;
  return Math.max(1, Math.min(cap, group.length));
}

/**
 * The rotation: cycle the active slots top-down and cast the first skill whose cooldown is ready and
 * whose mana fits the usable pool. No manual presses — the player only arranges order.
 */
export function castOnce(
  s: SkillState,
  c: Character,
  mana: number,
  group: Mob[],
  statuses: Statuses,
  rng: () => number,
  env: CastEnv = {},
): CastReport | null {
  if (!group.length) return null;
  const pool = usableMana(c, s);
  // §14: the two facts every row's own condition list is read against — the front target's kind and
  // our own pool. They are resolved once per tick, not once per row, so a wide group costs nothing extra
  const condBoss = env.isBoss ?? (String(group[0].kind).startsWith('Boss') || String(group[0].kind).startsWith('Unique'));
  const condMissingHp = env.missingHpPct || 0;
  // §13: a row with no timer of its own is the FILLER — it presses only after every timed slot has had
  // its chance, so a cd-0 row can never take the mana the rotation's real slots are waiting on
  const eligible = s.list.filter((id): id is string => Boolean(id) && ownsSkill(s, id!) && Boolean(sm.byId[id!]) && sm.weaponFits(sm.byId[id!], c.weaponName));
  const order = eligible.filter((id) => sm.byId[id].cd !== 0)
    .concat(eligible.filter((id) => sm.byId[id].cd === 0));
  for (const id of order) {
    if (!id || (s.cd[id] || 0) > 0) continue;
    // §14: the player's own switch on the slot — `never` silences a row, `conditional` gates it on
    // that row's own list, which is how two rows can wait on different things. `always` (the default)
    // is the old "cast when ready", and it reads no list at all.
    const slotMode = modeOf(s, id);
    if (slotMode === 'never') continue;
    const skill = sm.byId[id];
    const cond = slotMode === 'conditional' ? condOf(s, id) : NO_COND;
    if (slotMode === 'conditional') {
      const holds = conditionsHold(cond, condBoss, condMissingHp, group.length) || appliesMissingStatus(cond, skill, env, group[0]);
      if (!holds) continue;
    }
    const aoe = targetCount(skill, group) > 1;
    const cost = sm.costOf(skill, {
      skillLevel: skillLevel(s, id), aoe,
    });
    const manaCost = (cost.resource === 'mana' ? cost.amount : 0) * (env.trigger?.manaMult ?? 1);
    let hpCost = cost.resource === 'hp' ? cost.amount : 0;
    const currentHp = env.currentHp ?? c.maxHp;
    // 37 Blood Price: the Mana part of a skill cost is paid in HP 1:1. Auras and reservations are
    // not part of this conversion (§7.4.11).
    let paidMana = manaCost;
    const blood = bundleOf(c.keystones, 'blood-price');
    if (blood && paidMana > 0) {
      hpCost += bloodPriceHp(paidMana, blood.params as Record<string, number>);
      paidMana = 0;
    }
    // 52 Mana Debt: a positive-cost press may start only from a non-negative pool, and may end at the
    // borrow floor; once in debt, positive costs are refused until the pool returns to zero.
    const debt = bundleOf(c.keystones, 'mana-debt');
    const debtFloor = debt ? -manaDebtFloor(usableMana(c, s), debt.params as Record<string, number>) : 0;
    if (paidMana > 0 && (mana < 0 || mana - paidMana < debtFloor)) continue;
    // HP payment is atomic and must leave at least 1 HP
    if (hpCost > 0 && hpCost >= currentHp) continue;
    // the mana floor is the rotation's one act of restraint: a row that would drop the usable pool under
    // the share the player named stands down, and the tick goes to whatever else is ready
    if (cond.manaFloorPct > 0 && mana - manaCost < pool * (cond.manaFloorPct / 100)) continue;

    // a triggered press runs on the trigger's own clock (`trigger_cd_sec`), so the skill's cooldown is
    // spent by an ordinary cast only — a trigger can fire the same row again without eating its cd
    if (!env.trigger) s.cd[id] = skillCd(s, id, c.cdr);
    const spent = paidMana;

    if (skill.type === 'heal') {
      const h = healOf(skill);
      return {
        id, name: skill.name ?? '', damage: 0, manaCost: spent, hpCost, targets: 0, byMob: [],
        heal: h?.heal, instantHealPct: h?.instantHealPct,
        cleansesSelf: hasRule(skill, 'cleanses_status'),
      };
    }
    if (skill.type === 'buff') {
      s.buffUp[id] = Number(String(skill.duration).match(/\d+/)?.[0] || 10);
      // Ghost Dance counts its charges off its own ramp: base + 1 per N levels, to the Cap it names
      const base = (skill.effects || []).find((e: any) => e.stat === 'dodge_charges');
      const charges = base
        ? Math.min(valueOf(skill, 'dodge_charges_cap', 0) || Infinity,
          base.value + Math.floor(skillLevel(s, id) / valueOf(skill, 'dodge_charges_per_levels', 1)))
        : undefined;
      // Earth Wall is the same ramp on the block layer: a pool of cuts rather than of deletions
      const bBase = (skill.effects || []).find((e: any) => e.stat === 'block_charges');
      const blockCharges = bBase
        ? Math.min(valueOf(skill, 'block_charges_cap', 0) || Infinity,
          bBase.value + Math.floor(skillLevel(s, id) / valueOf(skill, 'block_charges_per_levels', 1)))
        : undefined;
      return {
        id, name: skill.name ?? '', damage: 0, manaCost: spent, hpCost, targets: 0, byMob: [], charges, blockCharges,
        cleansesSelf: hasRule(skill, 'cleanses_on_cast'),
      };
    }
    if (skill.type === 'curse') {
      // a curse attaches with the same hit chance an attack uses (skill-pool.md)
      const mob = group[0];
      const hit = rng() <= eng.hitChance(c.accuracy, mob.evasion);
      const writes = (skill.effects || []).some((e: any) => e.subject === 'target');
      return {
        id, name: skill.name ?? '', damage: 0, manaCost: spent, hpCost, targets: hit ? 1 : 0, byMob: [],
        curseOn: hit && writes ? mob.id : null,
      };
    }
    // attack: the row's own fraction of the character's finished hit, then the group bonus and AoE split
    const level = skillLevel(s, id);
    // the row's effects at the level actually held: the stored value is its level-1 number
    const effects = sm.effectsAt(skill, level) as any[];
    let dmg = sm.perPress(skill, { phys: c.phys, magic: c.magic, elem: c.elem, align: c.alignment, maxHp: c.maxHp, level, attackPct: c.attackDamage, spellPct: c.spellDamage }) || 0;
    // pin 1: a phys-basis press can crit on top of the pre-crit hit, a magic-basis one cannot.
    // A row that names extra crit chance on itself (Headshot) spends it on this press only.
    const ownCrit = effects.find((e: any) => e.stat === 'crit_chance' && e.subject !== 'target');
    let crit = false;
    if (dmg > 0 && sm.critsOnBasis(skill) && rng() * 100 < c.critChance + (ownCrit ? ownCrit.value : 0)) {
      dmg = (dmg * c.critDmg) / 100;
      crit = true;
    }
    // a row may press more than once: Whirlwind "3 rounds", Arrow Shower "3 arrows, 40% each"
    const hits = valueOf(skill, 'hits', 1);
    if (hits > 1) dmg *= hits * (valueOf(skill, 'hit_pct', 100) / 100);
    dmg *= sm.groupBonus(skill, c.weaponName) * mastery.skillBonus(c.weaponMastery || 0, sm.weaponMatches(skill, c.weaponName));
    const perEvasion = effects.find((e) => e.stat === 'damage_per_evasion_pct');
    // the Evasion-scaling row (parked with the physical add-ons) scales on the Evasion chance the sheet carries, which is the line
    // Dodge was merged into, so the key names what it actually reads.
    if (perEvasion) dmg *= 1 + Math.min(perEvasion.cap ?? Infinity, c.evasionChance * perEvasion.value) / 100;
    // a missing-HP row: nothing extra at full HP, its own multiplier at the share of lost HP it
    // names, growing in between — the tank tool that gives Vit a damage line at last
    const atMissing = effects.find((e: any) => e.stat === 'missing_hp_pct_for_max');
    const atMax = effects.find((e: any) => e.stat === 'damage_at_missing_hp');
    if (atMissing && atMax) {
      const missing = Math.min(atMissing.value, Math.max(0, env.missingHpPct || 0));
      dmg *= 1 + (missing / atMissing.value) * (atMax.value - 1);
    }
    const n = targetCount(skill, group);
    const front = group[0];
    // the Evasion and execute rows read the same row numbers the panel prints; see above for the Cap
    // the execute row's threshold, or the one a curse moved on this target
    const threshold = effects.find((e) => e.stat === 'execute_threshold_pct');
    if (threshold && front && front.hp > 0) {
      const onTarget = env.curses ? lineValue(env.curses, front.id, 'execute_threshold_pct') : 0;
      const limit = onTarget || threshold.value;
      const times = effects.find((e) => e.stat === 'execute_damage');
      if ((front.hp / front.hpMax) * 100 < limit && times) dmg *= times.value;
    }
    // the trigger's price on the press it fired: damage scaled down before it is split over targets
    if (env.trigger?.damageMult) dmg *= env.trigger.damageMult;
    // `E.global.damage_mult` reads the whole clock: a press rides the same bucket a swing does
    dmg *= E.global.damage_mult;
    const alignedPerSec = c.elem * (c.alignment / 100) * c.hitsPerSec;
    // the row's own lines are spent on each mob the skill actually reaches: a row that says "all in
    // range" reaches every target the AoE resolved, and a guaranteed status skips only the two rolls
    // that decide *whether* a status lands, never the control budget that decides how often 
    const everyTarget = hasRule(skill, 'every_target');
    const statusName = hasRule(skill, 'guaranteed_status')
      ? (E.elements.status_of as Record<string, MobStatusName | undefined>)[skill.element ?? ''] : null;
    const spendOn = (t: Mob) => {
      if (!env.mobStatus) return;
      for (const e of effects) {
        if (e.subject !== 'target') continue;
        if (e.stat === 'poison_stacks') setStacks(env.mobStatus, t.id, 'poison', e.value, alignedPerSec);
        if (e.stat === 'burn_stacks') setStacks(env.mobStatus, t.id, 'burn', e.value, alignedPerSec);
        if (e.stat === 'mark_stacks') setStacks(env.mobStatus, t.id, 'mark', e.value, alignedPerSec);
        // Sand Storm's own lingering line: the row types the damage a second and the seconds, and the
        // tick counts inside the shared DoT budget the cap already runs on
        if (e.stat === 'dot_dps') setErosion(env.mobStatus, t.id, e.value, dotSec, alignedPerSec);
        if (e.stat === 'stop_sec') stopMob(env.mobStatus, t.id, e.value, hasRule(skill, 'bypasses_control_cap'));
      }
      if (statusName) placeStatus(env.mobStatus, t.id, statusName, c, alignedPerSec, t.immune || []);
    };
    // a cast goes through the same defence chain as a swing: hit, then the mob's own dodge
    // (skill-pool.md — a curse attaches "with the same hit chance an attack uses"). A row whose hit is
    // undodgeable (Piercing Shot) drops that second step only.
    const dodges = !hasRule(skill, 'ignores_dodge');
    let landed = 0;
    let dealt = 0;
    const struck: { id: string; amount: number; packet?: DamagePacket }[] = [];
    // §7.2: a press's nominal rate is one over its effective cooldown in world seconds — the DoT
    // budget basis, never the number of targets the press split across
    const nominalRate = 1 / Math.max(1, Math.ceil(skillCd(s, id, c.cdr) / Math.max(1e-9, c.globalSpeed || 1)));
    // the Element share of a magic-basis press is the part the mob's resistance answers, and a
    // row that names a pierce removes that share of the mob's own line for this press only
    const magicBasis = skill.basis === 'magic' ? c.magic + c.elem * (c.alignment / 100) : 0;
    // the character's own Element mix, so a press's Element share can be split the way a swing's pools are
    const elemPools = Object.entries(c.elemByElement);
    const elemPoolTotal = elemPools.reduce((a, [, v]) => a + v, 0);
    const pierce = effects.find((e) => e.stat === 'resistance_pierce_pct');
    // Sand Storm's own seconds, unscaled by the ramp (it opts out in `special_level_effects`)
    const dotSec = effects.find((e) => e.stat === 'dot_sec')?.value ?? 10;
    // Earth Splitter: the share of the TARGET's own maximum pool the row adds, and the cut a boss takes
    // (owner ticket) — a %HP slam lands on a body, so it is read per target, never from the caster
    const pctPool = effects
      .filter((e) => e.stat === 'max_hp_pct_damage' && (e.subject || 'self') === 'target')
      .reduce((s, e) => s + e.value, 0);
    // the row's own bleed feed: a target-side `bleed_chance` it guarantees on the mob it lands on
    const rowBleedPct = effects
      .filter((e) => e.stat === 'bleed_chance' && (e.subject || 'self') === 'target')
      .reduce((s, e) => s + e.value, 0);
    // and its stun feed, the same shape: a row that adds a stun chance the mace's own line did not
    const rowStunPct = effects
      .filter((e) => e.stat === 'stun_chance' && (e.subject || 'self') === 'target')
      .reduce((s, e) => s + e.value, 0);
    for (let i = 0; i < n; i++) {
      const t = group[i];
      if (rng() > eng.hitChance(c.accuracy, t.evasion)) continue;
      if (dodges && rng() * 100 < eng.dodgeChance(t.dodgeRate, c.accuracy)) continue;
      // the pool term is the mob's own maximum, so it is added after the press: a hit on a body with
      // more HP hits harder, and a boss takes its own reduced share of it
      const poolTerm = pctPool > 0
        ? t.hpMax * (pctPool / 100) * ((t.kind.startsWith('Boss') || t.kind.startsWith('Unique')) ? (E.max_hp_press.boss_pct / 100) : 1)
        : 0;
      const share = (i === 0 ? dmg : dmg * AOE_PCT_PER_EXTRA_TARGET) + poolTerm;
      const elemPart = magicBasis > 0 ? share * ((c.elem * (c.alignment / 100)) / magicBasis) : 0;
      const cut = env.mobStatus ? (targetMods(mobModsOn(env.mobStatus, t.id)).armourCut || 0) : 0;
      const stripped = env.curses ? lineValue(env.curses, t.id, 'mob_elemental_resistance_pct') : 0;
      const pierced = pierce ? -((t.res || 0) * (pierce.value / 100)) : 0;
      // the press's Element share meets the Species' per-Element resistance (X54) exactly as a swing's does:
      // the share is split by the character's own Element mix, or by the mob's innate when the build
      // carries no named pool, so a Species that shrugs fire and fears cold answers each pool on its own.
      let elemArg: number | Record<string, number> = elemPart;
      if (elemPart > 0) {
        const byEl: Record<string, number> = {};
        if (elemPoolTotal > 0) for (const [el, pool] of elemPools) byEl[el] = elemPart * (pool / elemPoolTotal);
        else if (t.innate && t.innate.length) byEl[t.innate[0]] = elemPart;
        if (Object.keys(byEl).length) elemArg = byEl;
      }
      // conversion (`draft/convert-damage.md`): a physical-basis press routes a percent of its own
      // physical share into the named Element before mitigation, through the same `convertDamageOf`
      // the swing uses; a magic-basis press never converts.
      let nonElementPart = share - elemPart;
      let convertedParts: Record<string, number> = {};
      if (skill.basis === 'phys' && c.conversion && Object.keys(c.conversion).length) {
        const conv = eng.convertDamageOf(nonElementPart, c.conversion) as { physical: number; byElement: Record<string, number> };
        nonElementPart = conv.physical;
        if (Object.keys(conv.byElement).length) { elemArg = conv.byElement; convertedParts = { ...conv.byElement }; }
      }
      const mitigated0 = eng.mitigateMobHit(t, nonElementPart, elemArg, cut, stripped + pierced);
      // §12: a PHYSICAL press is the weapon arguing with a body too, so it carries the size ladder;
      // a magic-damage press is exempt (the caster's spell is not the weapon's own swing).
      const mitigated = skill.basis === 'phys'
        ? eng.applySizeMult(mitigated0, 1, eng.sizeMultOf(E.weapon_size_mult?.ladder, c.weaponName, (t as any).readsAs || 'medium'))
        : mitigated0;
      t.hp -= mitigated;
      dealt += mitigated;
      landed++;
      // §7.2 provenance per target: the same press's parts, labelled. The pool term (Earth Splitter)
      // was added after the crit roll, so it claims the non-crit physical share first and the rest of
      // the non-elemental part rides its basis' pool — the split never goes negative and sums back
      // to exactly what mitigation answered.
      const parts = emptyParts();
      const poolShare = Math.min(poolTerm, nonElementPart);
      parts.physicalNonCrit = poolShare;
      const restOfNonElement = nonElementPart - poolShare;
      if (skill.basis === 'phys') parts.physicalCritEligible = restOfNonElement;
      else parts.magic = restOfNonElement;
      if (Object.keys(convertedParts).length) {
        for (const [el, v] of Object.entries(convertedParts)) parts.convertedElement[el] = v;
      } else if (typeof elemArg === 'object') {
        for (const [el, v] of Object.entries(elemArg)) parts.nativeElement[el] = v;
      } else if (elemPart > 0) {
        parts.nativeElement[''] = elemPart;
      }
      struck.push({
        id: t.id, amount: mitigated,
        packet: validateDamagePacket({
          sourceActionId: id, actorId: 'player', targetId: t.id,
          timeUs: env.timeUs ?? null, nominalRate,
          flags: directFlags(sm.critsOnBasis(skill), true, true),
          parts,
        }),
      });
      // §14: a landing attack press carries the swing's own riders — the weapon Element status
      // proc, its bleed chance and the mace's stun — so a rotation does not silently stop applying
      // status the moment the bar fills
      if (env.mobStatus) {
        applyWeaponRiders(rng, c, env.mobStatus, t.id, env.curses ? lineValue(env.curses, t.id, 'bleed_chance') > 0 : false, rowBleedPct, rowStunPct, t.immune || []);
      }
      if (everyTarget || i === 0) spendOn(t);
      // a row's TARGET lines are a curse it writes on the hit: the same store a curse skill fills, so
      // `accuracy`, `damage_dealt` and a resistance strip read off a press exactly as they do off a curse
      if (env.curses) applyCurse(env.curses, t.id, skill);
    }
    void statuses;
    // a press that opens a self window (Reap) folds the row onto the character sheet for its own
    // duration, on the same `buffUp` clock a toggled buff runs on — the window is the row's own
    // `duration`, and the rule word is what keeps an ordinary press from opening one
    if (hasRule(skill, 'self_window')) {
      s.buffUp[id] = Number(String(skill.duration).match(/\d+/)?.[0] || 0);
    }
    return {
      id, name: skill.name ?? '', damage: dmg, manaCost: spent, hpCost, targets: landed, crit, dealt, byMob: struck,
    };
  }
  return null;
}

/** Cooldowns and buff clocks tick down once per second, post-cap speed aside — the same multiplier
 *  moves both, so Haste shortens a buff's window and its recast cooldown together. */
export function tickSkills(s: SkillState, globalSpeed = 1) {
  for (const id of Object.keys(s.cd)) if (s.cd[id] > 0) s.cd[id] = Math.max(0, s.cd[id] - globalSpeed);
  for (const id of Object.keys(s.buffUp)) if (s.buffUp[id] > 0) s.buffUp[id] = Math.max(0, s.buffUp[id] - globalSpeed);
}

/** A toggled buff re-presses itself the moment it lapses (`skill-pool.md` "Buff — toggle track"). */
export function buffNeedsRecast(s: SkillState, id: string): boolean {
  return ownsSkill(s, id) && Boolean(s.buffs[id]) && !(s.buffUp[id] > 0) && (s.cd[id] || 0) <= 0;
}
