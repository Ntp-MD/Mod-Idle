import { eng, E, SKILLS, sm } from '../../engine/client';
import {
  auraResonance, auraScaledValue, bloodPriceHp, bundleOf, headsmanExecutes, manaDebtFloor,
  type KeystoneBundle,
} from '../../../../engine/keystones.ts';
import { directFlags, emptyParts, validateDamagePacket } from '../../../../engine/damage-provenance.ts';
import type { DamagePacket } from '../../../../engine/damage-provenance.ts';
import type { SkillAction, SkillAreaSnapshot, SkillRow } from '../../../../engine/types.ts';
import { mastery } from '../core/mastery';
import { setStacks, setErosion, stopMob, stopMobDeliberate, placeStatus, holdStatus, modsOn as mobModsOn, targetMods, applyWeaponRiders, holdsCondition, CONDITION_OF, consumeStatus, copyStatus, keystoneBlocksStatus, keystoneTargetMods, type MobStatusName } from './mobStatus';
import { lineValue, applyCurse, combineMods, modsOn as curseModsOn, NO_CURSE, takenMult } from './curse';
import type { Character } from '../core/player';
import type { GameState, Mob } from '../core/types';
import type { Statuses } from './combat';

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
  const many = areaTargets || /all|multi|pack|area/i.test(skill.targets || '');
  if (many) return 'pack-clear';
  if (skill.type === 'attack') return 'single-target';
  return 'utility';
}

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

export function clampAuraReservations(s: SkillState, bundles: readonly KeystoneBundle[] = []): void {
  if (!bundleOf(bundles, 'blood-covenant')) s.auraPool = {};
  for (const [id, on] of Object.entries(s.auras)) {
    const row = sm.byId[id];
    if (!on || !ownsSkill(s, id) || row?.type !== 'aura') { delete s.auras[id]; continue; }
  }
  // Keep a valid complete set intact: Resonance prices the resulting aura count, not a prefix.
  if (reservedPct(s, bundles) < sm.RESERVATION_LIMIT) return;
  const kept = { ...s, auras: {} as Record<string, boolean> };
  for (const id of Object.keys(s.auras)) {
    kept.auras[id] = true;
    if (reservedPct(kept, bundles) >= sm.RESERVATION_LIMIT) {
      delete kept.auras[id];
      s.auras[id] = false;
    }
  }
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

/** The live line of one status on a mob, in the same shape the status store uses. */
function statusLineOf(env: CastEnv, mob: any, status: string): any {
  const l = env.mobStatus?.[mob?.id]?.statuses?.[status];
  if (!l) return null;
  return (status === 'poison' || status === 'mark' ? l.stacks > 0 : l.secLeft > 0) ? l : null;
}

/**
 * The payoff leg: this row waits until the status it exploits is on the target. The status is read
 * from the row's own effect (`sm.exploitedStatusOf`), so the player sees one flag per row rather than
 * a list of every status in the game. A stack threshold is the same leg with a number on it.
 */
function appliesPresentStatus(cond: SkillConditions, skill: any, env: CastEnv, mob: any): boolean {
  if (!cond.statusPresent) return false;
  const status = sm.exploitedStatusOf(skill);
  if (!status) return false;
  const l = statusLineOf(env, mob, status);
  if (!l) return false;
  return cond.statusStacksAtLeast <= 0 || l.stacks >= cond.statusStacksAtLeast;
}

/** A cleanse row waits for any status on the character, not for a particular Element. */
function selfDebuffedHolds(cond: SkillConditions, statuses: Statuses): boolean {
  if (!cond.selfDebuffed) return false;
  return Object.values(statuses || {}).some((l) => !!l && (l.secLeft > 0 || l.stacks > 0));
}

export const skillLevel = (s: SkillState, id: string) => sm.skillLevel(s.xp[id] || 0);
export const ladderOf = (s: SkillState, id: string) => sm.ladderPct(s.owned[id] || 0);

/** A row's mechanic word — each one is in `engine/skills.ts` `EFFECT_RULES` and has a reader here. */
export const hasRule = (skill: any, rule: string): boolean => ((skill?.rules || []) as string[]).includes(rule);

/** A storm-hold row: a ground circle whose guaranteed control status (chill/cripple) outlives
 *  the press, held for the row's own duration when no DOT seconds name the window. */
const isStormHold = (skill: any, status: string | null): boolean =>
  (status === 'chill' || status === 'crippled')
  && skill?.cast?.delivery === 'ground'
  && (skill?.area?.radius_m ?? 0) > 0;

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
  // Empty Vessel: an aura reserves no Mana at all; fixed reserves such as Arcane Battery still bind.
  const empty = bundleOf(bundles, 'empty-vessel');
  let total = 0;
  for (const [id, on] of Object.entries(s.auras)) {
    if (!on || !ownsSkill(s, id)) continue;
    if (auraPoolOf(s, id) === 'hp') continue;
    if (empty) continue;
    total += sm.reservePct(sm.byId[id]?.reserve ?? '') * (1 - bR);
  }
  const battery = bundleOf(bundles, 'arcane-battery');
  // fixed reserves are not aura reservations: 64 never discounts them (§7.5.3)
  if (battery) total += Number(battery.params.reserveManaPct);
  return total;
}

/** The share of Full Max HP held back by reservations: 35 plus every 54 aura assigned to HP. */
export function hpReservedPct(s: SkillState, bundles: readonly KeystoneBundle[] = []): number {
  const empty = bundleOf(bundles, 'empty-vessel');
  let total = 0;
  for (const [id, on] of Object.entries(s.auras)) {
    if (!on || !ownsSkill(s, id)) continue;
    if (auraPoolOf(s, id) === 'hp') total += empty ? 0 : sm.reservePct(sm.byId[id]?.reserve ?? '');
  }
  const faith = bundleOf(bundles, 'radiant-faith');
  if (faith) total += Number(faith.params.reserveHpPct);
  return total;
}

/** The pool one aura pays from, defaulting to Mana (`54`). */
export const auraPoolOf = (s: SkillState, id: string): 'hp' | 'mana' =>
  s.auraPool?.[id] === 'hp' ? 'hp' : 'mana';

/** 54: choose an aura's pool. Require the keystone and validate the resulting set before committing. */
export function setAuraPool(s: SkillState, id: string, pool: 'hp' | 'mana', bundles: readonly KeystoneBundle[] = []): { ok: boolean; why?: string } {
  if (!bundleOf(bundles, 'blood-covenant')) return { ok: false, why: 'only Blood Covenant lets an aura pay from HP' };
  if (!ownsSkill(s, id) || sm.byId[id]?.type !== 'aura') return { ok: false, why: 'that row is not an aura you own' };
  const auraPool = { ...s.auraPool, [id]: pool };
  if (reservedPct({ ...s, auraPool }, bundles) >= sm.RESERVATION_LIMIT)
    return { ok: false, why: 'that would reserve the whole Mana pool; leave some usable' };
  s.auraPool = auraPool;
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
  // setup → payoff
  bonus_vs_status: 'damage vs', consume_status: 'damage per consumed', spread_status: 'spread',
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
    .map((e) => `${EFFECT_LABEL[e.stat] || e.stat}${e.status ? ` ${e.status}` : ''}${e.op === 'mult' ? ` ×${e.value}` : e.op === 'add_flat' ? ` +${e.value} flat` : ` +${e.value}%`}`)
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
      const next = reservedPct({ ...s, auras: { ...s.auras, [id]: true } }, bundles);
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
export function costNow(s: SkillState, id: string): string {
  const skill = sm.byId[id];
  if (skill.type === 'aura') return `reserve ${sm.reservePct(skill.reserve || '')}% Max Mana`;
  const cost = sm.costOf(skill, { skillLevel: skillLevel(s, id) });
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
export interface CastTargetRoll {
  hit?: boolean;
  dodged?: boolean;
  /** Payoff share read at the first successful impact and reused by later impacts. */
  bonusPct?: number;
  consumeStacks?: number;
}

/** One press can land several impacts; these facts are rolled/read once and shared by all of them. */
export interface CastRollCache {
  crit?: boolean;
  targets: Record<string, CastTargetRoll>;
  /** Cast-target effect receipts: guaranteed status, riders, consume/spread and curse write once. */
  effects: Record<string, true>;
}

export const newCastRollCache = (): CastRollCache => ({ targets: {}, effects: {} });

export interface CastEnv {
  /** Legacy target-filter callback; canonical arena casts use resolveTargetsForSkill. */
  targetsForSkill?: (skillId: string, group: Mob[]) => Mob[];
  /** Canonical spatial selection and its footprint, captured together before damage. */
  resolveTargetsForSkill?: (skillId: string, group: Mob[]) => { targets: Mob[]; area?: SkillAreaSnapshot };
  spatialTargets?: boolean;
  /** A manual ground order may be paid at an empty permitted point; the rotation still needs a target. */
  allowEmptyTarget?: boolean;
  /** A deliberate manual press ignores automatic slot modes and conditional gates. */
  ignoreConditions?: boolean;
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
  /** Mirror Strike: the next press is a guaranteed crit. */
  forceCrit?: boolean;
  /** Lucky Streak: crit damage bought by the current streak. */
  critDamageBonusPct?: number;
  /** Trance: this press is the free one in its cycle. */
  freeCast?: boolean;
  /** One real impact of a multi-impact press; every impact shares the same cast cache. */
  impact?: { index: number; sharePct: number; cache: CastRollCache };
  /** The deployed field's periodic damage: flat, mitigated, never a crit or a fresh effect. */
  fieldPulse?: number;
  /** The field's initial press must not attach the legacy lingering erosion line. */
  suppressErosion?: boolean;
  /** Offline fields compress their pulse cadence; the presence line still lasts the field window. */
  fieldPresenceSec?: number;
  /** A direct press this character makes while Crippled: multiplier on the finished hit, never on DoT. */
  outgoingDamageMult?: number;
  /** Living bodies available to a spread effect, beyond the press's resolved targets. */
  availableGroup?: Mob[];
  /** Live ground position by actor id; absent offline, where spread falls back to queue order. */
  positionOf?: (id: string) => { x: number; y: number } | undefined;
}

export interface CastReport {
  id: string;
  /** The release-committed level for effects applied after the impact report is produced. */
  level?: number;
  name: string;
  damage: number;
  manaCost: number;
  /** HP paid from the caster's current pool; cost cannot take the final HP point. */
  hpCost: number;
  targets: number;
  area?: SkillAreaSnapshot;
  heal?: { secLeft: number; pctPerSec: number };
  /** A heal that lands at once, as a % of the pool — Greater Heal, not the per-second drip. */
  instantHealPct?: number;
  /** The mob a landed curse wrote its lines on, or null when it missed or writes nothing. */
  curseOn?: string | null;
  curseTargets?: string[];
  /** A phys-basis press rolled crit (pin 1); a magic-basis press never sets this. */
  crit?: boolean;
  /** HP actually removed by this cast, across every target it landed on. */
  dealt?: number;
  /** One entry per mob this press hurt: its id and the HP it lost after mitigation. `dealt` is the sum of
   *  these, and a press that hurt nobody carries an empty list — so the client can put each number on the
   *  plate it belongs to instead of splitting a total it was never asked to share. Named for what it is
   *  keyed by, because `hits` already means this row's repeat count. */
  byMob: { id: string; amount: number; packet?: DamagePacket; crit?: boolean }[];
  /** Setup → payoff: the stacks this press spent, per status, for the log and the plates. */
  consumed?: { status: string; stacks: number }[];
  /** Bodies whose deliberate stop the control lane refused — the receipt names them (F24). */
  resisted?: { id: string; species: string }[];
  /** Every body the committed press reached, whether it landed, was dodged or was blocked. */
  attempted?: string[];
  /** The bodies a payoff row copied its status onto after the hit. */
  spread?: { status: string; to: string[] }[];
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
function healOf(skill: SkillRow, level: number): { heal?: { secLeft: number; pctPerSec: number }; instantHealPct?: number } | null {
  if (skill.type !== 'heal') return null;
  const eff = sm.effectsAt(skill, level);
  const drip = eff.find((e: any) => e.stat === 'heal_per_sec');
  if (drip) {
    return { heal: { secLeft: sm.skillDurationSec(skill.duration, 0), pctPerSec: drip.value / 100 } };
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
  // Empty Vessel: the auras are free, but what they grant is halved (a mult keeps its distance
  // from 1 scaled, an add is rounded).
  const empty = bundleOf(bundles, 'empty-vessel');
  const auraScale = empty ? 1 - Number(empty.params.auraEffectPct) / 100 : 1;
  const rows: any[] = [];
  for (const [id, on] of Object.entries(sk.auras)) {
    if (!on || !ownsSkill(sk, id) || sm.byId[id]?.type !== 'aura') continue;
    const row = sm.byId[id];
    // 64 Aura Resonance stretches the aura's effects once (never 1.05^N), skipping its identity
    // fields — trigger clocks, cast cost and cast damage (§7.5.6).
    const effects = (row.effects || []).map((e: any) => {
      const scaled = bE > 0 ? auraScaledValue(e.op, e.value, bE, e.stat) : e.value;
      return { ...e, value: auraScale === 1 ? scaled
        : e.op === 'mult' ? 1 + (scaled - 1) * auraScale
          : Math.round(scaled * auraScale) };
    });
    rows.push({ ...row, effects });
  }
  for (const [id, left] of Object.entries(sk.buffUp)) if (left > 0 && ownsSkill(sk, id) && sm.byId[id]) rows.push(sm.byId[id]);
  return sm.aggregateEffects(rows, (r: any) => skillLevel(sk, r.id));
}

/** The stat a skill scales on is the finished hit it multiplies, so no `scale` lookup remains. */

/** the row's per-target share, read off the AoE rule the engine prices (`aoe.per_target_pct`) */
const AOE_PCT_PER_EXTRA_TARGET = (E.aoe as any).per_target_pct / 100;

function targetCount(skill: any, group: Mob[], spatial = false): number {
  // Live area selection already resolved the footprint. `targets` is the offline QUEUE cap only —
  // never a live membership cap; live circles stay centre-in-centre in `targetsInSkillArea`.
  const shape = skill.area?.shape;
  if (spatial && (shape === 'line' || shape === 'cone' || (skill.area?.radius_m ?? 0) > 0))
    return group.length;
  return Math.max(1, Math.min(sm.skillTargetCap(skill), group.length));
}

/**
 * What a buff grants when it comes up. The rotation cast and the live toggle recast both read this
 * one function, so a charge pool or a cleanse cannot arrive on one path and be lost on the other.
 */
export function buffCastOutcome(s: SkillState, id: string): {
  durationSec: number; charges?: number; blockCharges?: number; cleansesSelf: boolean;
} | null {
  const skill = sm.byId[id];
  if (!skill || skill.type !== 'buff') return null;
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
    durationSec: sm.skillDurationSec(skill.duration, 10),
    charges, blockCharges, cleansesSelf: hasRule(skill, 'cleanses_on_cast'),
  };
}

/** The upkeep track and its inspector share the same base resource payment. */
export function buffRecastCost(s: SkillState, c: Character, id: string) {
  const cost = sm.costOf(sm.byId[id], { skillLevel: skillLevel(s, id) });
  const blood = bundleOf(c.keystones, 'blood-price');
  return cost.resource === 'mana' && blood
    ? { resource: 'hp', amount: bloodPriceHp(cost.amount, blood.params as Record<string, number>) }
    : cost;
}

export type SkillEligibilityReason = 'ready' | 'unowned' | 'weapon' | 'no-target' | 'cooldown' | 'shock'
  | 'silenced' | 'conditions' | 'mana' | 'mana-debt' | 'hp' | 'mana-floor' | 'auto-off' | 'manual-only'
  | 'mana-reserve';

export interface SkillEligibility {
  ready: boolean;
  reason: SkillEligibilityReason;
  label: string;
  detail: string;
  /** The actual pools this press would pay after its keystone and trigger rules. */
  manaCost: number;
  hpCost: number;
  aoe: boolean;
}

/**
 * The Mana a zero-cooldown filler must not spend: a higher-priority timed row already on its clock
 * becomes ready within its remaining cooldown, and the pool plus regeneration can pay it only if the
 * filler waits. Read-only — nothing is reserved on the character. The filler is held only when the
 * wait actually closes the gap: no regeneration, or a pool that could never reach the price, never
 * holds it forever.
 */
function manaReserveFor(
  s: SkillState, c: Character, fillerId: string, fillerCost: number, mana: number, env: CastEnv,
): { id: string; cost: number; seconds: number } | null {
  if (!(fillerCost > 0) || (sm.byId[fillerId]?.cd ?? 0) !== 0) return null;
  // A manual press and a trigger aura's press are not the automatic filler this rule protects.
  if (env.ignoreConditions || env.trigger) return null;
  const regen = Math.max(0, c.manaRegen || 0);
  if (!(regen > 0)) return null;
  const order = rotationOrder(s);
  const at = order.indexOf(fillerId);
  if (at < 1) return null;
  // Regeneration stops at the usable pool: a price the pool can never hold is not a reason to wait.
  const pool = usableMana(c, s);
  const trance = bundleOf(c.keystones, 'trance');
  const tranceMult = trance ? 1 + Number(trance.params.costPct) / 100 : 1;
  for (const id of order.slice(0, at)) {
    const row = sm.byId[id];
    if (!row || (row.cd ?? 0) <= 0 || row.auto === 'manual') continue;
    if (!ownsSkill(s, id) || modeOf(s, id) === 'never' || !sm.weaponFits(row, c.weaponName)) continue;
    const seconds = s.cd[id] || 0;
    if (!(seconds > 0)) continue;
    const cost = sm.costOf(row, { skillLevel: skillLevel(s, id) });
    // Blood Price pays from HP; an HP-cost row never competes for the Mana pool.
    if (cost.resource !== 'mana' || bundleOf(c.keystones, 'blood-price')) continue;
    const price = cost.amount * tranceMult;
    if (!(price > 0)) continue;
    // Keep the filler only when waiting reaches the price and spending now would not.
    const reachable = Math.min(pool, mana + regen * seconds);
    const afterFiller = Math.min(pool, mana - fillerCost + regen * seconds);
    if (reachable >= price && afterFiller < price) return { id, cost: price, seconds };
  }
  return null;
}

/** The same read prices and gates a rotation press and explains it in the interface. No RNG or writes. */
export function skillEligibility(
  s: SkillState, c: Character, id: string, mana: number, group: Mob[], statuses: Statuses,
  env: CastEnv & { autoSkills?: boolean } = {},
): SkillEligibility {
  const skill = sm.byId[id];
  const spatial = !!(env.spatialTargets || env.resolveTargetsForSkill);
  const aoe = !!skill && !bundleOf(c.keystones, 'single-combat') && targetCount(skill, group, spatial) > 1;
  const cost = skill ? sm.costOf(skill, { skillLevel: skillLevel(s, id) }) : { resource: 'mana', amount: 0 };
  let manaCost = (cost.resource === 'mana' ? cost.amount : 0) * (env.trigger?.manaMult ?? 1);
  let hpCost = cost.resource === 'hp' ? cost.amount : 0;
  const trance = bundleOf(c.keystones, 'trance');
  if (trance) {
    const mult = 1 + Number(trance.params.costPct) / 100;
    manaCost *= mult;
    hpCost *= mult;
  }
  if (env.freeCast) { manaCost = 0; hpCost = 0; }
  // The player's floor reads the pre-conversion Mana price, matching the rotation restraint.
  const floorPrice = manaCost;
  const blood = bundleOf(c.keystones, 'blood-price');
  if (blood && manaCost > 0) {
    hpCost += bloodPriceHp(manaCost, blood.params as Record<string, number>);
    manaCost = 0;
  }
  const result = (reason: SkillEligibilityReason, label: string, detail: string): SkillEligibility =>
    ({ ready: reason === 'ready', reason, label, detail, manaCost, hpCost, aoe });
  const autoOn = env.autoSkills !== false;
  if (!skill || !ownsSkill(s, id)) return result('unowned', 'Not owned', 'This skill is not in your collection.');
  if (!sm.weaponFits(skill, c.weaponName)) return result('weapon', 'Wrong weapon', `Requires ${skill.weapon === 'bow' ? 'a bow or crossbow' : skill.weapon}; held: ${c.weaponName || 'bare hands'}.`);
  if (!autoOn) return result('auto-off', 'Auto Skills off', 'Enable Auto Skills to let the rotation cast.');
  // The authored flag gates the automatic rotation only; a deliberate manual press still bypasses it.
  if (!env.ignoreConditions && skill.auto === 'manual')
    return result('manual-only', 'Manual only', 'This row is set to Manual and never fires from the rotation.');
  if (!group.length && !env.allowEmptyTarget)
    return result('no-target', 'No target', 'The rotation waits for a combat target.');
  if ((s.cd[id] || 0) > 0) return result('cooldown', 'Cooling down', `${s.cd[id].toFixed(1)}s left on this skill’s clock.`);
  const mode = env.ignoreConditions ? 'always' : modeOf(s, id);
  if (mode === 'never') return result('silenced', 'Silenced', 'Cast mode is Never. Change it to Always or Conditional.');
  const cond = mode === 'conditional' ? condOf(s, id) : NO_COND;
  if (mode === 'conditional') {
    const boss = env.isBoss ?? (String(group[0].kind).startsWith('Boss') || String(group[0].kind).startsWith('Unique'));
    const holds = conditionsHold(cond, boss, env.missingHpPct || 0, group.length)
      || appliesMissingStatus(cond, skill, env, group[0])
      || appliesPresentStatus(cond, skill, env, group[0])
      || selfDebuffedHolds(cond, statuses);
    if (!holds) return result('conditions', 'Condition unmet', 'None of this skill’s enabled OR triggers holds right now.');
  }
  const pool = usableMana(c, s);
  const debt = bundleOf(c.keystones, 'mana-debt');
  const debtFloor = debt ? -manaDebtFloor(pool, debt.params as Record<string, number>) : 0;
  if (manaCost > 0 && mana < 0) return result('mana-debt', 'Repaying Mana debt', 'Positive-cost skills wait until spendable Mana returns to zero.');
  if (manaCost > 0 && mana - manaCost < debtFloor) return result('mana', 'Not enough Mana', `Costs ${manaCost.toFixed(1)} Mana; ${mana.toFixed(1)} spendable${debt ? `, borrowing allowed to ${debtFloor.toFixed(1)}` : ''}.`);
  if (hpCost > 0 && hpCost >= (env.currentHp ?? c.maxHp)) return result('hp', 'Not enough HP', `Costs ${hpCost.toFixed(1)} HP and must leave at least 1 HP.`);
  if (cond.manaFloorPct > 0 && mana - floorPrice < pool * cond.manaFloorPct / 100)
    return result('mana-floor', 'Mana floor protected', `This press would cross your ${cond.manaFloorPct}% usable-Mana floor.`);
  if (autoOn && !env.ignoreConditions) {
    const reserve = manaReserveFor(s, c, id, manaCost, mana, env);
    if (reserve) {
      const row = sm.byId[reserve.id];
      return result('mana-reserve', 'Saving Mana',
        `${row.name || reserve.id} is ready in ${reserve.seconds.toFixed(1)}s and costs ${reserve.cost.toFixed(0)} Mana; this filler waits so the pool and regen can pay it.`);
    }
  }
  return result('ready', 'Eligible now', `${skill.cd === 0 ? 'Filler: checked after every timed skill.' : 'Checked in cast order.'} Conditions and resources currently allow this press.`);
}

/**
 * Timed slots keep their order; all zero-cooldown fillers are checked afterward. The order is the
 * authored bar, not the auto gate: a row marked `manual` still resolves here (the manual bar reads
 * the same order) and `skillEligibility` refuses it on the automatic path only.
 */
export function rotationOrder(s: SkillState): string[] {
  const ids = s.list.filter((id): id is string => Boolean(id) && ownsSkill(s, id!) && Boolean(sm.byId[id!]));
  return ids.filter((id) => sm.byId[id].cd !== 0).concat(ids.filter((id) => sm.byId[id].cd === 0));
}

/**
 * The one manual cast contract (F34): the action bar, the shortcut, the aim preview and the
 * command read the same skill. An explicit UI pick wins; otherwise the first slotted
 * attack/curse in rotation order; a missing Fireball is no longer invented — no skill, no button.
 */
export function defaultManualSkill(s: SkillState): string | undefined {
  for (const id of rotationOrder(s)) {
    const type = sm.byId[id]?.type;
    if (type === 'attack' || type === 'curse') return id;
  }
  return undefined;
}

/** Snapshot facts used by both the loadout inspector and field skill bar. */
export function skillEligibilityInState(state: GameState, c: Character, id: string, autoSkills = true, targets: Mob[] = state.group, spatialTargets = false): SkillEligibility {
  const trance = bundleOf(c.keystones, 'trance');
  const eligibility = skillEligibility(state.skills, c, id, spendableMana(c, state.skills, state.player.mana), targets, state.playerStatuses, {
    autoSkills, spatialTargets, currentHp: state.player.hp,
    missingHpPct: c.maxHp > 0 ? (1 - state.player.hp / c.maxHp) * 100 : 0,
    mobStatus: state.mobStatus, curses: state.curses,
    freeCast: !!trance && ((state.keystoneRuntime.counters.tranceCasts || 0) + 1) % Number(trance.params.everyCasts) === 0,
  });
  // Any live shock stops new presses: the stop is 0.5s, so a full-second test would never
  // fire. Unstoppable still walks through.
  if (eligibility.ready && (state.playerStatuses.shock?.secLeft || 0) > 0 && !bundleOf(c.keystones, 'unstoppable')) {
    return { ...eligibility, ready: false, reason: 'shock', label: 'Stopped by Shock', detail: 'Shock pauses actions for the next combat step.' };
  }
  return eligibility;
}

/**
 * The rotation: cycle the active slots top-down and cast the first skill whose cooldown is ready and
 * whose mana fits the usable pool. No manual presses — the player only arranges order.
 */
export interface PreparedSkillCast {
  id: string;
  manaCost: number;
  hpCost: number;
  level: number;
  cooldownSec: number;
  spatial: boolean;
  targets: Mob[];
  area?: SkillAreaSnapshot;
}

/** Commit exactly one selected row at release. Damage and RNG wait for impact. */
export function prepareSkillCast(
  s: SkillState, c: Character, id: string, mana: number, targets: Mob[], statuses: Statuses,
  env: CastEnv = {}, area?: SkillAreaSnapshot,
): PreparedSkillCast | null {
  const eligibility = skillEligibility(s, c, id, mana, targets, statuses, env);
  if (!eligibility.ready) return null;
  const cooldownSec = skillCd(s, id, c.cdr);
  if (!env.trigger) s.cd[id] = cooldownSec;
  return { id, manaCost: eligibility.manaCost, hpCost: eligibility.hpCost,
    level: skillLevel(s, id), cooldownSec,
    spatial: !!(env.spatialTargets || env.resolveTargetsForSkill), targets, area };
}

/** One offline impact pass: the authored share, its own roll cache and its queue/spatial targets. */
interface OfflineShot {
  index: number;
  sharePct: number;
  cache: CastRollCache;
  targets: Mob[];
  /** The field's initial press keeps the live contract: no legacy erosion rider. */
  suppressErosion?: boolean;
  /** A deployed field's pulse carries flat damage, never a fresh hit or proc attempt. */
  fieldPulse?: number;
  /** The presence line lasts the authored field window even when the pulses are compressed. */
  fieldPresenceSec?: number;
}

/**
 * The offline impact plan for a committed action. Live schedules flights and re-tests membership at
 * each impact; the queue path has no flight clock, so it expands the same authored payloads in order
 * against the prepared queue (documented queue-vs-spatial difference):
 *
 * - `independent` payloads get a fresh cache each (targeted-burst and cluster-burst always do,
 *   matching live; every other independent row also does), so hit/dodge/crit are rolled per impact.
 * - `shared` rows keep the aggregate path: one cache for the whole press, exactly like live.
 * - chain hops to the nearest unused body inside the hop reach when ground positions are available,
 *   and to the next unused queue body otherwise; `targets` caps the contacts (queue-only).
 * - a deployed sand field resolves its initial pressed body and then its authored pulse count at
 *   cast time (live spaces them one per second); the initial press suppresses erosion on both paths.
 * - a targeted burst stays on its first bound body; a dead body fizzles the rest, never re-acquires.
 *   Range and homing pursuit cannot be represented offline, so the queue assumes the body stays in
 *   reach (the documented limit).
 */
function offlineActionShots(
  skill: SkillRow, action: SkillAction, prepared: PreparedSkillCast, effects: any[], env: CastEnv,
): OfflineShot[] | null {
  const group = prepared.targets;
  const cap = Math.max(1, sm.skillTargetCap(skill));
  const queue = (): Mob[] => {
    const alive = group.filter((mob) => mob.hp > 0);
    // Spatial selection already committed a footprint; the queue cap is only for the offline path.
    return prepared.spatial ? alive : alive.slice(0, cap);
  };
  const hits = Math.max(1, Number((skill.effects || []).find((e) => e.stat === 'hits')?.value ?? 1));
  const hitPct = Number((skill.effects || []).find((e) => e.stat === 'hit_pct')?.value ?? 100);
  const independent = action.roll_policy === 'independent';
  const shots: OfflineShot[] = [];

  if (action.kind === 'sand-field') {
    const dotSec = Math.max(0, Math.floor(Number(effects.find((e) => e.stat === 'dot_sec')?.value ?? 0)));
    const dotDps = Math.max(0, Number(effects.find((e) => e.stat === 'dot_dps')?.value ?? 0));
    shots.push({ index: 0, sharePct: 100, cache: newCastRollCache(), targets: queue(), suppressErosion: true });
    for (let pulse = 1; pulse <= dotSec && dotDps > 0; pulse++) {
      const targets = queue();
      if (!targets.length) break;
      shots.push({ index: pulse, sharePct: 100, cache: newCastRollCache(), targets,
        fieldPulse: dotDps, fieldPresenceSec: dotSec + 2 });
    }
    return shots;
  }

  if (action.kind === 'cluster-burst') {
    const parent = Number(action.parent_share_pct);
    const children = Math.floor(Number(action.child_count));
    const child = Number(action.child_share_pct);
    const shares = [Number.isFinite(parent) ? parent : 100,
      ...Array.from({ length: Number.isSafeInteger(children) && children > 0 ? children : 0 },
        () => (Number.isFinite(child) ? child : 0))];
    for (const [index, sharePct] of shares.entries()) {
      const targets = queue();
      if (!targets.length) break;
      shots.push({ index, sharePct, cache: newCastRollCache(), targets });
    }
    return shots;
  }

  if (action.kind === 'targeted-burst') {
    // Live always gives each payload its own cache, whatever the policy column says. The first
    // body is the lock-on bound body: a dead body fizzles the rest, never re-acquires.
    const bound = group.find((mob) => mob.hp > 0);
    for (let index = 0; index < hits && bound && bound.hp > 0; index++)
      shots.push({ index, sharePct: hitPct, cache: newCastRollCache(), targets: [bound] });
    return shots;
  }

  if (action.kind === 'chain-strike') {
    const first = group.find((mob) => mob.hp > 0);
    if (!first) return [];
    const hopRange = Number(skill.area?.radius_m ?? 0) || 3;
    const hopShare = Number.isFinite(Number(action.hop_share_pct)) ? Number(action.hop_share_pct) : 60;
    // `targets` is also the authored chain contact budget in live dispatch, so both paths stop
    // at the same count; the queue/spatial difference is which body each hop picks, not how many.
    const contacts = cap;
    // One cache for a shared chain, like live; an independent row rolls each hop afresh.
    const sharedCache = independent ? undefined : newCastRollCache();
    const visited = new Set<string>([first.id]);
    shots.push({ index: 0, sharePct: 100, cache: sharedCache ?? newCastRollCache(), targets: [first] });
    let origin = env.positionOf?.(first.id);
    for (let hop = 1; hop < contacts; hop++) {
      const alive = group.filter((mob) => mob.hp > 0 && !visited.has(mob.id));
      const next = origin
        ? alive
          .map((mob) => ({ mob, pose: env.positionOf?.(mob.id) }))
          .filter((entry): entry is { mob: Mob; pose: { x: number; y: number } } => !!entry.pose)
          .filter((entry) => Math.hypot(entry.pose.x - origin!.x, entry.pose.y - origin!.y) <= hopRange + 1e-7)
          .sort((a, b) => Math.hypot(a.pose.x - origin!.x, a.pose.y - origin!.y)
            - Math.hypot(b.pose.x - origin!.x, b.pose.y - origin!.y)
            || (a.mob.id < b.mob.id ? -1 : 1))[0]?.mob
        : alive[0];
      if (!next) break;
      visited.add(next.id);
      shots.push({ index: hop, sharePct: hopShare, cache: sharedCache ?? newCastRollCache(), targets: [next] });
      origin = env.positionOf?.(next.id);
    }
    return shots;
  }

  // Every other committed shape keeps its aggregate press when shared. An explicit independent
  // policy expands the authored payload count with a fresh cache per impact.
  if (!independent) return null;
  for (let index = 0; index < hits; index++) {
    const targets = queue();
    if (!targets.length) break;
    shots.push({ index, sharePct: hitPct, cache: newCastRollCache(), targets });
  }
  return shots;
}

/** Merge the per-impact reports of an offline action into one cast receipt. */
function mergeOfflineShots(
  reports: CastReport[], id: string, name: string, manaCost: number, hpCost: number,
  level: number, area: SkillAreaSnapshot | undefined,
): CastReport {
  if (!reports.length)
    return { id, name, damage: 0, manaCost, hpCost, targets: 0, byMob: [], ...(area ? { area } : {}) };
  const first = reports[0];
  const consumed = reports.flatMap((report) => report.consumed ?? []);
  const spread = reports.flatMap((report) => report.spread ?? []);
  const resisted = reports.flatMap((report) => report.resisted ?? []);
  const attempted = [...new Set(reports.flatMap((report) => report.attempted ?? []))];
  const curseTargets = [...new Set(reports.flatMap((report) => report.curseTargets ?? []))];
  return {
    ...first,
    id, name, manaCost, hpCost, level,
    damage: reports.reduce((sum, report) => sum + report.damage, 0),
    targets: reports.reduce((sum, report) => sum + report.targets, 0),
    dealt: reports.reduce((sum, report) => sum + (report.dealt ?? 0), 0),
    crit: reports.some((report) => report.crit),
    // Each entry keeps the crit fact of its own impact, so a mixed independent press never paints
    // a non-crit payload with the cast's `crit` flag.
    byMob: reports.flatMap((report) => report.byMob.map((hit) => ({ ...hit, crit: report.crit === true }))),
    ...(attempted.length ? { attempted } : {}),
    ...(consumed.length ? { consumed } : {}),
    ...(spread.length ? { spread } : {}),
    ...(resisted.length ? { resisted } : {}),
    ...(first.curseOn ? { curseOn: first.curseOn } : {}),
    ...(curseTargets.length ? { curseTargets } : {}),
    ...(area ? { area } : {}),
  };
}

/** Resolve a paid cast against its impact-time targets. Never charges or starts cooldown again. */
export function resolvePreparedCast(
  s: SkillState, c: Character, prepared: PreparedSkillCast, statuses: Statuses,
  rng: () => number, env: CastEnv = {},
): CastReport {
  const { id, targets: group, manaCost: spent, hpCost, spatial } = prepared;
  const skill = sm.byId[id];
  const single = bundleOf(c.keystones, 'single-combat');
  const resolved = { area: prepared.area };
  if (!group.length && (skill.type === 'attack' || skill.type === 'curse'))
    return { id, name: skill.name ?? '', damage: 0, manaCost: spent, hpCost, targets: 0,
      byMob: [], ...(prepared.area ? { area: prepared.area } : {}) };
  if (skill.type === 'heal') {
    const h = healOf(skill, prepared.level);
    return {
      id, name: skill.name ?? '', damage: 0, manaCost: spent, hpCost, targets: 0, byMob: [],
      heal: h?.heal, instantHealPct: h?.instantHealPct,
      cleansesSelf: hasRule(skill, 'cleanses_status'),
    };
  }
  if (skill.type === 'buff') {
    const outcome = buffCastOutcome(s, id)!;
    s.buffUp[id] = outcome.durationSec;
    return {
      id, name: skill.name ?? '', damage: 0, manaCost: spent, hpCost, targets: 0, byMob: [],
      charges: outcome.charges, blockCharges: outcome.blockCharges, cleansesSelf: outcome.cleansesSelf,
    };
  }
  if (skill.type === 'curse') {
    // a curse attaches with the same hit chance an attack uses (skill-pool.md)
    const count = single ? 1 : targetCount(skill, group, spatial);
    const hitTargets = group.slice(0, count).filter((mob) => rng() <= eng.hitChance(c.accuracy, mob.evasion));
    const writes = (skill.effects || []).some((e: any) => e.subject === 'target');
    const curseTargets = writes ? hitTargets.map((mob) => mob.id) : [];
    return {
      id, level: prepared.level, name: skill.name ?? '', damage: 0, manaCost: spent, hpCost, targets: hitTargets.length, byMob: [],
      curseOn: curseTargets[0] ?? null,
      attempted: group.slice(0, count).map((mob) => mob.id),
      ...(curseTargets.length > 1 ? { curseTargets } : {}),
      ...(resolved?.area ? { area: resolved.area } : {}),
    };
  }
  // attack: the row's own fraction of the character's finished hit, then the group bonus and AoE split
  const level = prepared.level;
  // the row's effects at the level actually held: the stored value is its level-1 number
  const effects = sm.effectsAt(skill, level) as any[];
  const fieldPulse = env.fieldPulse;
  // A live flight already carries one committed impact (`env.impact`) or the field's initial press
  // marker (`suppressErosion`); the queue path has neither, so expand the authored action plan here
  // before the aggregate press runs. This guard is what keeps a live sand initial from running the
  // offline pulse expansion a second time beside its scheduled flights.
  if (!fieldPulse && !env.impact && !env.suppressErosion) {
    const action = sm.actionOf(skill);
    const shots = action ? offlineActionShots(skill, action, prepared, effects, env) : null;
    if (shots) {
      const reports: CastReport[] = [];
      for (const shot of shots) {
        // A body felled by an earlier payload leaves the committed target set: a dead bound body
        // fizzles the rest (never re-acquires), and a queue payload stops hitting a corpse.
        const live = shot.targets.filter((mob) => mob.hp > 0);
        if (!live.length) continue;
        reports.push(resolvePreparedCast(s, c, { ...prepared, targets: live }, statuses, rng, {
          ...env,
          impact: { index: shot.index, sharePct: shot.sharePct, cache: shot.cache },
          ...(shot.suppressErosion ? { suppressErosion: true } : {}),
          ...(shot.fieldPulse != null ? { fieldPulse: shot.fieldPulse } : {}),
          ...(shot.fieldPresenceSec != null ? { fieldPresenceSec: shot.fieldPresenceSec } : {}),
        }));
      }
      return mergeOfflineShots(reports, id, skill.name ?? '', spent, hpCost, level, prepared.area);
    }
  }
  let dmg = fieldPulse ?? (sm.perPress(skill, { phys: c.phys, magic: c.magic, elem: c.elem, align: c.alignment, maxHp: c.maxHp, level, attackPct: c.attackDamage, spellPct: c.spellDamage }) || 0);
  // pin 1: a phys-basis press can crit on top of the pre-crit hit, a magic-basis one cannot.
  // A row that names extra crit chance on itself (Headshot) spends it on this press only.
  const ownCrit = effects.find((e: any) => e.stat === 'crit_chance' && e.subject !== 'target');
  let crit = false;
  const rollCache = env.impact?.cache;
  if (!fieldPulse && dmg > 0 && sm.critsOnBasis(skill)) {
    const forceCrit = Boolean(env.forceCrit);
    const rolled = rollCache?.crit !== undefined
      ? rollCache.crit
      : forceCrit || rng() * 100 < c.critChance + (ownCrit ? ownCrit.value : 0);
    if (rollCache) rollCache.crit = rolled;
    if (rolled) {
      dmg = (dmg * (c.critDmg + Number(env.critDamageBonusPct || 0))) / 100;
      crit = true;
    }
  }
  // a row may press more than once: Whirlwind "3 rounds", Arrow Shower "3 arrows, 40% each"
  const hits = env.impact ? 1 : valueOf(skill, 'hits', 1);
  if (hits > 1) dmg *= hits * (valueOf(skill, 'hit_pct', 100) / 100);
  // A scheduled impact carries only its authored share; the cast-level rolls are already cached.
  if (env.impact) dmg *= env.impact.sharePct / 100;
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
  const n = single ? 1 : targetCount(skill, group, spatial);
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
  // Crippled is an outgoing-direct-damage cut; it never touches a DoT or a field pulse.
  if (!fieldPulse && env.outgoingDamageMult != null) dmg *= env.outgoingDamageMult;
  // Packet N — the press-side rules. Single Combat buys its one target; the element rules read the
  // row's named Element; Hemorrhage's direct cut applies to a physical-basis press.
  if (single) dmg *= 1 + Number(single.params.damagePct) / 100;
  const fortuna = bundleOf(c.keystones, 'fortuna');
  if (fortuna && dmg > 0) {
    if (crit) {
      if (rng() * 100 < Number(fortuna.params.doubleCritPct)) dmg *= 2;
    } else dmg *= 1 - Number(fortuna.params.nonCritPct) / 100;
  }
  const ashen = bundleOf(c.keystones, 'ashen-crown');
  if (ashen && skill.element === 'fire') dmg *= 1 - Number(ashen.params.directFirePct) / 100;
  const mono = bundleOf(c.keystones, 'monochrome');
  if (mono && (skill.element || skill.basis === 'magic')) dmg *= 1 + Number(mono.params.elementalPct) / 100;
  const hemorrhage = bundleOf(c.keystones, 'hemorrhage');
  if (hemorrhage && skill.basis === 'phys') dmg *= Number(hemorrhage.params.directPhysicalPct) / 100;
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
      if (e.stat === 'poison_stacks' && !keystoneBlocksStatus(c, 'poison')) setStacks(env.mobStatus, t.id, 'poison', e.value, alignedPerSec);
      if (e.stat === 'burn_stacks' && !keystoneBlocksStatus(c, 'burn')) setStacks(env.mobStatus, t.id, 'burn', e.value, alignedPerSec);
      if (e.stat === 'mark_stacks') setStacks(env.mobStatus, t.id, 'mark', e.value, alignedPerSec);
      // Sand Storm's own lingering line: the row types the damage a second and the seconds, and the
      // tick counts inside the shared DoT budget the cap already runs on
      if (e.stat === 'dot_dps' && !env.suppressErosion) setErosion(env.mobStatus, t.id, e.value, dotSec, alignedPerSec);
      // A deliberate stop spends the deliberate lane, never the proc budget — per-hit procs
      // cannot eat a cooldown-gated interrupt before it fires. A refusal names the body (F24).
      if (e.stat === 'stop_sec') {
        if (stopMobDeliberate(env.mobStatus, t.id, e.value, hasRule(skill, 'bypasses_control_cap'))) continue;
        if (!resisted.some((entry) => entry.id === t.id))
          resisted.push({ id: t.id, species: t.species });
      }
    }
    if (statusName) {
      const placed = placeStatus(env.mobStatus, t.id, statusName, c, alignedPerSec, t.immune || []);
      // a storm holds its own control status for the storm window: the dot seconds when the
      // storm deals damage over time, otherwise the row's own duration (a ground circle whose
      // chill outlives the press). The chill a blizzard lays lasts the blizzard rather than
      // lapsing on the status default mid-storm.
      const stormWindow = effects.some((e) => e.stat === 'dot_dps')
        ? dotSec
        : isStormHold(skill, statusName)
          ? sm.skillDurationSec(skill.duration, 0)
          : 0;
      if (placed && stormWindow > 0)
        holdStatus(env.mobStatus, t.id, statusName, stormWindow);
    }
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
  const nominalRate = 1 / Math.max(1, Math.ceil(prepared.cooldownSec / Math.max(1e-9, c.cooldownRate || 1)));
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
  // setup → payoff: the row names the status it reads (bonus), spends (consume), or copies (spread)
  const statusBonus = effects.find((e) => e.stat === 'bonus_vs_status');
  const fieldAccuracy = effects.find((e) => e.stat === 'accuracy' && e.subject === 'target');
  const statusConsume = effects.find((e) => e.stat === 'consume_status');
  const statusSpread = effects.find((e) => e.stat === 'spread_status');
  const consumed: { status: string; stacks: number }[] = [];
  const spread: { status: string; to: string[] }[] = [];
  const resisted: { id: string; species: string }[] = [];
  for (let i = 0; i < n; i++) {
    const t = group[i];
    const targetRoll = rollCache && !fieldPulse ? (rollCache.targets[t.id] ??= {}) : undefined;
    if (!fieldPulse) {
      if (targetRoll) {
        // One cached result per cast-target; a later impact reuses it instead of rolling again.
        if (targetRoll.hit === undefined) targetRoll.hit = rng() <= eng.hitChance(c.accuracy, t.evasion);
        if (!targetRoll.hit) continue;
        if (dodges) {
          if (targetRoll.dodged === undefined) targetRoll.dodged = rng() * 100 < eng.dodgeChance(t.dodgeRate, c.accuracy);
          if (targetRoll.dodged) continue;
        }
      } else {
        if (rng() > eng.hitChance(c.accuracy, t.evasion)) continue;
        if (dodges && rng() * 100 < eng.dodgeChance(t.dodgeRate, c.accuracy)) continue;
      }
    }
    const firstEffects = !fieldPulse && (!rollCache || !rollCache.effects[t.id]);
    // A deployed field's accuracy line is a presence fact, refreshed only while the body is inside;
    // it expires within one tick of leaving or of the field's last pulse.
    if (fieldPulse && env.curses && fieldAccuracy) {
      const lines = env.curses[t.id] || (env.curses[t.id] = {});
      lines.field_presence = { stat: 'accuracy', value: fieldAccuracy.value, secLeft: env.fieldPresenceSec ?? 2, from: id };
    }
    // the pool term is the mob's own maximum, so it is added after the press: a hit on a body with
    // more HP hits harder, and a boss takes its own reduced share of it
    const poolTerm = pctPool > 0
      ? t.hpMax * (pctPool / 100) * ((t.kind.startsWith('Boss') || t.kind.startsWith('Unique')) ? (E.max_hp_press.boss_pct / 100) : 1)
      : 0;
    // The payoff is read at the first successful impact for this cast-target and cached: consuming
    // the prerequisite there must not remove the bonus from the rest of the same prepared press.
    let bonusPct = fieldPulse ? 0 : targetRoll?.bonusPct;
    if (bonusPct === undefined) {
      const bonusLine = statusBonus ? statusLineOf(env, t, statusBonus.status) : null;
      bonusPct = bonusLine ? statusBonus.value : 0;
      if (targetRoll) targetRoll.bonusPct = bonusPct;
    }
    let consumeStacks = fieldPulse ? 0 : targetRoll?.consumeStacks;
    if (consumeStacks === undefined) {
      const consumeLine = statusConsume ? statusLineOf(env, t, statusConsume.status) : null;
      const consumeAvailable = consumeLine
        ? (statusConsume!.status === 'poison' || statusConsume!.status === 'mark' ? consumeLine.stacks : (consumeLine.stacks || 1))
        : 0;
      const consumeCap = statusConsume && Number.isFinite(statusConsume.cap) ? statusConsume.cap : consumeAvailable;
      consumeStacks = Math.max(0, Math.min(consumeAvailable, consumeCap));
      if (targetRoll) targetRoll.consumeStacks = consumeStacks;
    }
    let share = fieldPulse ? dmg + poolTerm : (i === 0 ? dmg : dmg * AOE_PCT_PER_EXTRA_TARGET) + poolTerm;
    if (bonusPct) share *= 1 + bonusPct / 100;
    if (consumeStacks > 0) share *= 1 + (consumeStacks * statusConsume!.value) / 100;
    const elemPart = magicBasis > 0 ? share * ((c.elem * (c.alignment / 100)) / magicBasis) : 0;
    const cut = env.mobStatus ? (targetMods(mobModsOn(env.mobStatus, t.id)).armourCut || 0) : 0;
    // The target's damage-taken bucket, assembled the way the tick assembles it for a swing: curse
    // lines (conditional ones only while their status holds), the statuses we inflicted (mark's
    // stacks included) and the target-side keystone rules. Both paths read the one `takenMult`.
    const taken = takenMult(combineMods(
      combineMods(
        env.curses
          ? curseModsOn(env.curses, t.id, (cond) => (env.mobStatus ? holdsCondition(env.mobStatus, t.id, cond) : false))
          : NO_CURSE,
        env.mobStatus ? targetMods(mobModsOn(env.mobStatus, t.id)) : {},
      ),
      env.mobStatus ? keystoneTargetMods(env.mobStatus, t.id, c) : {},
    ));
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
    // Monochrome: the press's Element answers Fire's resistance line, not the pools it was built
    // from. A physical-basis conversion is already in `elemArg` by this point, so it converts too.
    if (mono) {
      const totalElem = typeof elemArg === 'object'
        ? Object.values(elemArg).reduce((sum, value) => sum + value, 0)
        : elemArg;
      if (totalElem > 0) elemArg = { fire: totalElem };
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
    const mitigated = (skill.basis === 'phys'
      ? eng.applySizeMult(mitigated0, 1, eng.sizeMultOf(E.weapon_size_mult?.ladder, c.weaponName, (t as any).readsAs || 'medium'))
      : mitigated0) * taken;
    t.hp -= mitigated;
    // 08 Headsman: the swing's own threshold, mirrored on the press path — a surviving target left
    // at or below the line is executed and the residual is kill-only.
    const headsman = bundleOf(c.keystones, 'headsman');
    if (headsman && t.hp > 0) {
      const bossUnique = String(t.kind).startsWith('Boss') || String(t.kind).startsWith('Unique');
      if (headsmanExecutes(t.hp, t.hpMax, bossUnique, headsman.params as Record<string, number>)) t.hp = 0;
    }
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
    // Cast-target effects run once per successful cast-target, on its first real impact: riders,
    // guaranteed status/stacks, consume/spread and the curse write. Later impacts carry damage only.
    if (firstEffects) {
    // §14: a landing attack press carries the swing's own riders — the weapon Element status
    // proc, its bleed chance and the mace's stun — so a rotation does not silently stop applying
    // status the moment the bar fills
    if (env.mobStatus) {
      applyWeaponRiders(rng, c, env.mobStatus, t.id, env.curses ? lineValue(env.curses, t.id, 'bleed_chance') > 0 : false, rowBleedPct, rowStunPct, t.immune || []);
      // Conductive: the shock the press just wrote jumps to the nearest living bodies first —
      // "nearby" is ground distance from the struck body, the same spatial owner targeting uses
      // (F39). Without positions (offline) the group order stands in, documented, not silent.
      const cond = bundleOf(c.keystones, 'conductive');
      if (cond) {
        const shock = env.mobStatus[t.id]?.statuses.shock;
        let left = shock && shock.secLeft > 0 ? Number(cond.params.spreadTargets) : 0;
        const origin = env.positionOf?.(t.id);
        const ordered = origin
          ? [...group].map((other, index) => {
            const pose = other.id === t.id ? undefined : env.positionOf!(other.id);
            return { other, index, dist: !pose ? Infinity : Math.hypot(pose.x - origin.x, pose.y - origin.y) };
          }).sort((a, b) => a.dist - b.dist || a.index - b.index).map((entry) => entry.other)
          : group;
        for (const other of ordered) {
          if (left <= 0) break;
          if (other.id === t.id) continue;
          if (copyStatus(env.mobStatus, t.id, other.id, 'shock', other.immune || [])) left--;
        }
      }
      // copy the live line to the other bodies first, then spend it on the source: Catalyst reads
      // the poison it is about to consume, not the empty line left behind
      // Single Combat forbids the press from reaching another body, so its status copy cannot
      // travel either; the spread row waits until the keystone is refunded.
      if (statusSpread && !single && (everyTarget || i === 0)) {
        let left = Math.max(0, Math.floor(statusSpread.value));
        const to: string[] = [];
        const origin = env.positionOf?.(t.id);
        const radius = Number(statusSpread.radius_m ?? Infinity);
        const candidates = (env.availableGroup ?? group)
          .filter((other) => other.id !== t.id && other.hp > 0)
          .map((other, index) => {
            const pose = env.positionOf?.(other.id);
            const dist = origin && pose ? Math.hypot(pose.x - origin.x, pose.y - origin.y) : 0;
            return { other, dist, index };
          })
          .filter((entry) => !env.positionOf || !origin || entry.dist <= radius + 1e-7)
          .sort((a, b) => a.dist - b.dist || a.index - b.index);
        for (const { other } of candidates) {
          if (left <= 0) break;
          if (copyStatus(env.mobStatus, t.id, other.id, statusSpread.status as MobStatusName, (other as any).immune || [])) {
            to.push(other.id);
            left--;
          }
        }
        if (to.length) spread.push({ status: statusSpread.status, to });
      }
      if (consumeStacks > 0) {
        const took = consumeStatus(env.mobStatus, t.id, statusConsume!.status as MobStatusName, consumeStacks);
        if (took > 0) consumed.push({ status: statusConsume!.status, stacks: took });
      }
    }
    if (everyTarget || i === 0) spendOn(t);
    // a row's TARGET lines are a curse it writes on the hit: the same store a curse skill fills, so
    // `accuracy`, `damage_dealt` and a resistance strip read off a press exactly as they do off a curse
    if (env.curses) applyCurse(env.curses, t.id, skill, c.keystones, level);
    if (rollCache) rollCache.effects[t.id] = true;
    }
  }
  // a press that opens a self window (Reap) folds the row onto the character sheet for its own
  // duration, on the same `buffUp` clock a toggled buff runs on — the window is the row's own
  // `duration`, and the rule word is what keeps an ordinary press from opening one
  if (hasRule(skill, 'self_window') && (!env.impact || env.impact.index === 0)) {
    s.buffUp[id] = sm.skillDurationSec(skill.duration, 0);
  }
  return {
    id, name: skill.name ?? '', damage: dmg, manaCost: spent, hpCost, targets: landed, crit, dealt, byMob: struck,
    attempted: group.map((mob) => mob.id),
    ...(resolved?.area ? { area: resolved.area } : {}),
    ...(consumed.length ? { consumed } : {}),
    ...(spread.length ? { spread } : {}),
    ...(resisted.length ? { resisted } : {}),
  };
}

/** First ready slot in cast order, prepared but not resolved. */
export function prepareFirstSkillCast(
  s: SkillState, c: Character, mana: number, availableGroup: Mob[], statuses: Statuses,
  env: CastEnv = {},
): PreparedSkillCast | null {
  if (!availableGroup.length) return null;
  for (const id of rotationOrder(s)) {
    const resolved = env.resolveTargetsForSkill?.(id, availableGroup);
    const targets = resolved?.targets ?? env.targetsForSkill?.(id, availableGroup) ?? availableGroup;
    const prepared = prepareSkillCast(s, c, id, mana, targets, statuses, env, resolved?.area);
    if (prepared) return prepared;
  }
  return null;
}

/** Immediate queue casts retain their existing path; live arena actions resolve this preparation later. */
export function castOnce(
  s: SkillState, c: Character, mana: number, availableGroup: Mob[], statuses: Statuses,
  rng: () => number, env: CastEnv = {},
): CastReport | null {
  const prepared = prepareFirstSkillCast(s, c, mana, availableGroup, statuses, env);
  return prepared ? resolvePreparedCast(s, c, prepared, statuses, rng, env) : null;
}

/** Cooldowns and buff clocks tick down once per second, post-cap speed aside — the same multiplier
 *  moves both, so Haste shortens a buff's window and its recast cooldown together. */
export function tickSkillCooldowns(s: SkillState, elapsed = 1) {
  for (const id of Object.keys(s.cd)) if (s.cd[id] > 0) s.cd[id] = Math.max(0, s.cd[id] - elapsed);
}

export function tickSkillBuffs(s: SkillState, elapsed = 1) {
  for (const id of Object.keys(s.buffUp)) if (s.buffUp[id] > 0) s.buffUp[id] = Math.max(0, s.buffUp[id] - elapsed);
}

/** Cooldowns and buff clocks tick down with the cooldown lever (F44); callers pass the rate. */
export function tickSkills(s: SkillState, cooldownRate = 1, buffElapsed = 1) {
  tickSkillCooldowns(s, cooldownRate);
  tickSkillBuffs(s, buffElapsed);
}

/** A toggled buff re-presses itself the moment it lapses (`skill-pool.md` "Buff — toggle track"). */
export function buffNeedsRecast(s: SkillState, id: string): boolean {
  return ownsSkill(s, id) && Boolean(s.buffs[id]) && !(s.buffUp[id] > 0) && (s.cd[id] || 0) <= 0;
}
