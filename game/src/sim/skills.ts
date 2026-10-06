import { eng, E, SKILLS, sm } from '../engine/client';
import { mastery } from './mastery';
import { setStacks, stopMob, placeStatus, modsOn as mobModsOn, targetMods, applyWeaponRiders, holdsCondition, CONDITION_OF, type MobStatusName } from './mobStatus';
import { lineValue } from './curse';
import type { Character } from './player';
import type { Mob } from './types';
import type { Statuses } from './combat';

export interface SkillState {
  /** Owned skills: id → duplicates poured into its own ladder. */
  owned: Record<string, number>;
  /** The 15-slot active bar, cast top-down (attack · curse · heal). */
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
   * rotation; `conditional` fires only while one of the shared `conditions` holds.
   */
  mode: Record<string, SkillMode>;
  /** The ONE condition list every conditional skill draws from — never free text per skill. */
  conditions: SkillConditions;
}

export type SkillMode = 'always' | 'conditional' | 'never';

export interface SkillConditions {
  /** Fire the conditional rows against a boss only. */
  boss: boolean;
  /** Fire them only while the character is under this share of its pool (0 = off). */
  hpBelowPct: number;
  /**
   * One flag per Element status a row can apply (the five `elements.status_of` names): a conditional
   * row fires while the target is MISSING a status it applies. Read off the roster, not typed per
   * skill — `appliedStatusOf` derives which one a row carries from its own `element`.
   */
  statusMissing: string[];
}

export const ACTIVE_SLOTS = 15;

export function newSkillState(): SkillState {
  return {
    owned: {}, list: new Array(ACTIVE_SLOTS).fill(null), buffs: {}, auras: {}, xp: {}, cd: {}, buffUp: {},
    mode: {}, conditions: { boss: false, hpBelowPct: 0, statusMissing: [] },
  };
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
 * Does the shared condition list hold right now? OR across the enabled conditions. The caller
 * resolves the facts (`isBoss` off the front target, `missingHpPct` off the pool, and the
 * `statusMissing` leg per row) so this stays a pure read of the list.
 */
export function conditionsHold(s: SkillState, isBoss: boolean, missingHpPct: number): boolean {
  const c = s.conditions || { boss: false, hpBelowPct: 0, statusMissing: [] };
  if (c.boss && isBoss) return true;
  if (c.hpBelowPct > 0 && missingHpPct >= c.hpBelowPct) return true;
  return false;
}

/**
 * The `status missing` leg: this row applies an enabled status the target does not carry. Two kinds
 * of flag live in the one list, both read off the roster rather than typed per skill — an Element
 * status (from the row's own `element` through `elements.status_of`) and a curse (the row's own id).
 */
function appliesMissingStatus(s: SkillState, skill: any, env: CastEnv, mob: any): boolean {
  const want = (s.conditions?.statusMissing || []) as string[];
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
  return sm.effCd(skill.cd, cdrPct, ladderOf(s, id));
}

/** Auras reserve a % of Max Mana; the set may not reserve the whole pool. */
export function reservedPct(s: SkillState): number {
  let total = 0;
  for (const [id, on] of Object.entries(s.auras)) {
    if (!on) continue;
    total += sm.reservePct(sm.byId[id]?.reserve);
  }
  return total;
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
  return Object.entries(sk.buffUp).some(([id, left]) => left > 0 && hasRule(sm.byId[id], rule));
}

/**
 * Energy Absorb: the share of an incoming hit the buff turns into Energy Shield right now,
 * ramped linearly from its level-1 base to its Cap across the skill levels. Zero when it is off.
 */
export function esAbsorbPct(sk: SkillState): number {
  const cap = E.skill_xp.level_cap;
  for (const [id, left] of Object.entries(sk.buffUp)) {
    if (left <= 0) continue;
    const row = sm.byId[id];
    const base = (row?.effects || []).find((e: any) => e.stat === 'es_absorb_pct');
    if (!base) continue;
    const top = (row.effects || []).find((e: any) => e.stat === 'es_absorb_cap');
    const t = cap > 1 ? (skillLevel(sk, id) - 1) / (cap - 1) : 0;
    return base.value + ((top ? top.value : base.value) - base.value) * Math.min(1, Math.max(0, t));
  }
  return 0;
}

/** The rows in the toggle track that this character owns, in roster order. */
export function trackRows(s: SkillState): any[] {
  return sm.all().filter((k: any) => (k.type === 'aura' || k.type === 'buff') && s.owned[k.id]);
}

/**
 * Flip one toggle-track skill. An aura can only go on while the pool has the room for its
 * reservation (`skill-pool.md` · the block the S9 gate prints), and taking one off is always free.
 */
export function toggleTrack(s: SkillState, id: string): { ok: boolean; why?: string } {
  const skill = sm.byId[id];
  if (!skill) return { ok: false, why: 'not in the collection' };
  if (skill.type === 'aura') {
    const turning = !s.auras[id];
    if (turning) {
      const next = reservedPct(s) + sm.reservePct(skill.reserve);
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

export function usableMana(c: Character, s: SkillState): number {
  return c.maxMana * (1 - reservedPct(s) / 100);
}

/**
 * What a row costs for this character right now, so a flat row shows the units it actually charges
 * rather than the base it was quoted at. A percentage row is left as the row states it.
 */
export function manaNow(c: Character, s: SkillState, id: string, aoe = false): string {
  const skill = sm.byId[id];
  const spec = sm.manaSpec(skill);
  if (!spec || spec.kind === 'pct') return skill.mana || '';
  const cost = sm.manaCostOf(skill, { skillLevel: skillLevel(s, id), maxMana: c.maxMana, usableMana: usableMana(c, s), aoe });
  return `${skill.mana} · ${Math.round(cost)} now`;
}

/** Grant a skill drop: a new skill, or a duplicate that feeds that skill's own ladder. */
export function grantSkill(s: SkillState, rng: () => number): { id: string; duplicate: boolean } | null {
  const pool = sm.all().filter((k: any) => k.type !== 'aura' || true);
  const fresh = pool.filter((k: any) => !s.owned[k.id]);
  const pickFrom = fresh.length && rng() < 0.7 ? fresh : pool;
  const chosen = pickFrom[Math.floor(rng() * pickFrom.length)];
  if (!chosen) return null;
  const duplicate = Boolean(s.owned[chosen.id]);
  s.owned[chosen.id] = (s.owned[chosen.id] || 0) + (duplicate ? 1 : 0);
  if (!duplicate) {
    s.xp[chosen.id] = 0;
    const free = s.list.findIndex((x) => x === null);
    // a row with no timer of its own (`cd 0`) is the FILLER: it is a rotation choice, so a drop never
    // slots it for the player — the bar it fills is the one whose timed slots it should sit under
    const filler = (chosen as any).cd === 0;
    if (free >= 0 && !filler && ['attack', 'curse', 'heal'].includes(chosen.type)) s.list[free] = chosen.id;
    if (chosen.type === 'aura') s.auras[chosen.id] = true;
    if (chosen.type === 'buff') s.buffs[chosen.id] = true;
  }
  return { id: chosen.id, duplicate };
}

/** Every kill pays 1 XP to each slotted or open skill (`engine.json` skill_xp). */
export function paySkillXp(s: SkillState) {
  const earning = [...s.list.filter((id): id is string => id !== null), ...Object.keys(s.auras).filter((k) => s.auras[k]),
    ...Object.keys(s.buffs).filter((k) => s.buffs[k])];
  for (const id of earning) s.xp[id] = (s.xp[id] || 0) + E.skill_xp.xp_per_kill;
}

/** The stores a cast may write to, passed in so the rotation stays a function of state. */
export interface CastEnv {
  mobStatus?: any;
  curses?: any;
  /** How much of the pool is currently missing, for a row that scales with lost HP. */
  missingHpPct?: number;
  /** The front target is a boss — the `boss` leg of the shared condition list (§14). */
  isBoss?: boolean;
}

export interface CastReport {
  id: string;
  name: string;
  damage: number;
  manaKind: 'pct' | 'flat' | null;
  manaValue: number | null;
  manaCost: number;
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
  /** Ghost Dance: perfect-dodge charges this press grants, from its own level ramp. */
  charges?: number;
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
export function effectsActive(sk: SkillState) {
  const rows: any[] = [];
  for (const [id, on] of Object.entries(sk.auras)) if (on && sm.byId[id]) rows.push(sm.byId[id]);
  for (const [id, left] of Object.entries(sk.buffUp)) if (left > 0 && sm.byId[id]) rows.push(sm.byId[id]);
  return sm.aggregateEffects(rows);
}

/** The stat a skill scales on is the finished hit it multiplies, so no `scale` lookup remains. */

/** "3/1" → 3 targets when the group is big enough, else 1 (`skill-pool-attack.md` targets column).
 *  The AoE rule is 60% per target, Cap 3, mana ×1.5 (`skill-pool.md`) — the cost multiplier is
 * read from `engine.json` `aoe.mana_mult` inside `manaCostOf`, not repeated here. */
const AOE_PCT_PER_EXTRA_TARGET = 0.6;

function targetCount(skill: any, group: Mob[]): number {
  const cap = Number(String(skill.targets || '1').split('/')[0]) || 1;
  return Math.max(1, Math.min(cap, group.length));
}

/**
 * The rotation: cycle the 15 slots top-down and cast the first skill whose cooldown is ready and
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
  // §14: the shared condition list is read once per cast, off the front target and the pool
  const condBoss = env.isBoss ?? String(group[0].kind).startsWith('Boss');
  const condMissingHp = env.missingHpPct || 0;
  // §13: a row with no timer of its own is the FILLER — it presses only after every timed slot has had
  // its chance, so a caster's core press can never take the mana the rotation's real slots are waiting on
  const order = s.list.filter((id) => id && (sm.byId[id] as any).cd !== 0)
    .concat(s.list.filter((id) => id && (sm.byId[id] as any).cd === 0));
  for (const id of order) {
    if (!id || (s.cd[id] || 0) > 0) continue;
    // §14: the player's own switch on the slot — `never` silences a row, `conditional` gates it on
    // the one shared condition list. `always` (the default) is the old "cast when ready".
    if (modeOf(s, id) === 'never') continue;
    const skill = sm.byId[id];
    if (modeOf(s, id) === 'conditional') {
      const holds = conditionsHold(s, condBoss, condMissingHp) || appliesMissingStatus(s, skill, env, group[0]);
      if (!holds) continue;
    }
    const aoe = targetCount(skill, group) > 1;
    const ms = sm.manaSpec(skill);
    const cost = sm.manaCostOf(skill, {
      skillLevel: skillLevel(s, id), maxMana: c.maxMana, usableMana: pool, aoe,
    });
    if (cost > mana) continue;

    s.cd[id] = skillCd(s, id, c.cdr);
    const spent = Math.min(mana, cost);

    if (skill.type === 'heal') {
      const h = healOf(skill);
      return {
        id, name: skill.name, damage: 0, manaKind: ms ? ms.kind : null, manaValue: ms ? ms.value : null, manaCost: spent, targets: 0,
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
      return {
        id, name: skill.name, damage: 0, manaKind: ms ? ms.kind : null, manaValue: ms ? ms.value : null, manaCost: spent, targets: 0, charges,
        cleansesSelf: hasRule(skill, 'cleanses_on_cast'),
      };
    }
    if (skill.type === 'curse') {
      // a curse attaches with the same hit chance an attack uses (skill-pool.md)
      const mob = group[0];
      const hit = rng() <= eng.hitChance(c.accuracy, mob.evasion);
      const writes = (skill.effects || []).some((e: any) => e.subject === 'target');
      return {
        id, name: skill.name, damage: 0, manaKind: ms ? ms.kind : null, manaValue: ms ? ms.value : null, manaCost: spent, targets: hit ? 1 : 0,
        curseOn: hit && writes ? mob.id : null,
      };
    }
    // attack: the row's own fraction of the character's finished hit, then the group bonus and AoE split
    const level = skillLevel(s, id);
    let dmg = sm.perPress(skill, { phys: c.phys, magic: c.magic, elem: c.elem, align: c.alignment, level }) || 0;
    // pin 1: a phys-basis press can crit on top of the pre-crit hit, a magic-basis one cannot.
    // A row that names extra crit chance on itself (Headshot) spends it on this press only.
    const ownCrit = (skill.effects || []).find((e: any) => e.stat === 'crit_chance' && e.subject !== 'target');
    let crit = false;
    if (dmg > 0 && sm.critsOnBasis(skill) && rng() * 100 < c.critChance + (ownCrit ? ownCrit.value : 0)) {
      dmg = (dmg * c.critDmg) / 100;
      crit = true;
    }
    // a row may press more than once: Whirlwind "3 rounds", Arrow Shower "3 arrows, 40% each"
    const hits = valueOf(skill, 'hits', 1);
    if (hits > 1) dmg *= hits * (valueOf(skill, 'hit_pct', 100) / 100);
    dmg *= sm.groupBonus(skill, c.weaponName) * mastery.skillBonus(c.weaponMastery || 0);
    const effects = (skill.effects || []) as any[];
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
    const alignedPerSec = c.elem * (c.alignment / 100) * c.hitsPerSec;
    // the row's own lines are spent on each mob the skill actually reaches: a row that says "all in
    // range" reaches every target the AoE resolved, and a guaranteed status skips only the two rolls
    // that decide *whether* a status lands, never the control budget that decides how often 
    const everyTarget = hasRule(skill, 'every_target');
    const statusName = hasRule(skill, 'guaranteed_status')
      ? (E.elements.status_of as Record<string, MobStatusName | undefined>)[skill.element] : null;
    const spendOn = (t: Mob) => {
      if (!env.mobStatus) return;
      for (const e of effects) {
        if (e.subject !== 'target') continue;
        if (e.stat === 'poison_stacks') setStacks(env.mobStatus, t.id, 'poison', e.value, alignedPerSec);
        if (e.stat === 'burn_stacks') setStacks(env.mobStatus, t.id, 'burn', e.value, alignedPerSec);
        if (e.stat === 'mark_stacks') setStacks(env.mobStatus, t.id, 'mark', e.value, alignedPerSec);
        if (e.stat === 'stop_sec') stopMob(env.mobStatus, t.id, e.value, hasRule(skill, 'bypasses_control_cap'));
      }
      if (statusName) placeStatus(env.mobStatus, t.id, statusName, c, alignedPerSec);
    };
    // a cast goes through the same defence chain as a swing: hit, then the mob's own dodge
    // (skill-pool.md — a curse attaches "with the same hit chance an attack uses"). A row whose hit is
    // undodgeable (Piercing Shot) drops that second step only.
    const dodges = !hasRule(skill, 'ignores_dodge');
    let landed = 0;
    let dealt = 0;
    // the Element share of a magic-basis press is the part the mob's resistance answers, and a
    // row that names a pierce removes that share of the mob's own line for this press only (Nether Orb)
    const magicBasis = skill.basis === 'magic' ? c.magic + c.elem * (c.alignment / 100) : 0;
    const pierce = effects.find((e) => e.stat === 'resistance_pierce_pct');
    // the row's own bleed feed: a target-side `bleed_chance` it guarantees on the mob it lands on
    const rowBleedPct = effects
      .filter((e) => e.stat === 'bleed_chance' && (e.subject || 'self') === 'target')
      .reduce((s, e) => s + e.value, 0);
    for (let i = 0; i < n; i++) {
      const t = group[i];
      if (rng() > eng.hitChance(c.accuracy, t.evasion)) continue;
      if (dodges && rng() * 100 < eng.dodgeChance(t.dodgeRate, c.accuracy)) continue;
      const share = i === 0 ? dmg : dmg * AOE_PCT_PER_EXTRA_TARGET;
      const elemPart = magicBasis > 0 ? share * ((c.elem * (c.alignment / 100)) / magicBasis) : 0;
      const cut = env.mobStatus ? (targetMods(mobModsOn(env.mobStatus, t.id)).armourCut || 0) : 0;
      const stripped = env.curses ? lineValue(env.curses, t.id, 'mob_elemental_resistance_pct') : 0;
      const pierced = pierce ? -((t.res || 0) * (pierce.value / 100)) : 0;
      const mitigated0 = eng.mitigateMobHit(t, share - elemPart, elemPart, cut, stripped + pierced);
      // §12: a PHYSICAL press is the weapon arguing with a body too, so it carries the size ladder;
      // a magic-damage press is exempt (the caster's spell is not the weapon's own swing).
      const mitigated = skill.basis === 'phys'
        ? eng.applySizeMult(mitigated0, 1, eng.sizeMultOf(E.weapon_size_mult?.ladder, c.weaponName, (t as any).readsAs || 'medium'))
        : mitigated0;
      t.hp -= mitigated;
      dealt += mitigated;
      landed++;
      // §14: a landing attack press carries the swing's own riders — the weapon Element status
      // proc, its bleed chance and the mace's stun — so a rotation does not silently stop applying
      // status the moment the bar fills
      if (env.mobStatus) {
        applyWeaponRiders(rng, c, env.mobStatus, t.id, env.curses ? lineValue(env.curses, t.id, 'bleed_chance') > 0 : false, rowBleedPct);
      }
      if (everyTarget || i === 0) spendOn(t);
    }
    void statuses;
    // a press that opens a self window (Reap) folds the row onto the character sheet for its own
    // duration, on the same `buffUp` clock a toggled buff runs on — the window is the row's own
    // `duration`, and the rule word is what keeps an ordinary press from opening one
    if (hasRule(skill, 'self_window')) {
      s.buffUp[id] = Number(String(skill.duration).match(/\d+/)?.[0] || 0);
    }
    return {
      id, name: skill.name, damage: dmg, manaKind: ms ? ms.kind : null, manaValue: ms ? ms.value : null, manaCost: spent, targets: landed, crit, dealt,
    };
  }
  return null;
}

/** Cooldowns and buff clocks tick down once per second, post-cap speed aside. */
export function tickSkills(s: SkillState, globalSpeed = 1) {
  for (const id of Object.keys(s.cd)) if (s.cd[id] > 0) s.cd[id] = Math.max(0, s.cd[id] - globalSpeed);
  for (const id of Object.keys(s.buffUp)) if (s.buffUp[id] > 0) s.buffUp[id] = Math.max(0, s.buffUp[id] - 1);
}

/** A toggled buff re-presses itself the moment it lapses (`skill-pool.md` "Buff — toggle track"). */
export function buffNeedsRecast(s: SkillState, id: string): boolean {
  return Boolean(s.buffs[id]) && !(s.buffUp[id] > 0) && (s.cd[id] || 0) <= 0;
}
