import { eng, E, SKILLS, sm } from '../engine/client';
import { mastery } from './mastery';
import { setStacks, stopMob, placeStatus, modsOn as mobModsOn, targetMods, type MobStatusName } from './mobStatus';
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
}

export const ACTIVE_SLOTS = 15;

export function newSkillState(): SkillState {
  return { owned: {}, list: new Array(ACTIVE_SLOTS).fill(null), buffs: {}, auras: {}, xp: {}, cd: {}, buffUp: {} };
}

export const skillLevel = (s: SkillState, id: string) => sm.skillLevel(s.xp[id] || 0);
export const ladderOf = (s: SkillState, id: string) => sm.ladderPct(s.owned[id] || 0);

/** A row's mechanic word — each one is in `engine/skills.js` `EFFECT_RULES` and has a reader here. */
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

/** A buff whose row carries this mechanic word is currently on its clock (D-102). */
export function buffRuleUp(sk: SkillState, rule: string): boolean {
  return Object.entries(sk.buffUp).some(([id, left]) => left > 0 && hasRule(sm.byId[id], rule));
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
    if (free >= 0 && ['attack', 'curse', 'heal'].includes(chosen.type)) s.list[free] = chosen.id;
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
  /** How much of the pool is currently missing, for a row that scales with lost HP (D-102). */
  missingHpPct?: number;
}

export interface CastReport {
  id: string;
  name: string;
  damage: number;
  manaPct: number;
  manaCost: number;
  targets: number;
  heal?: { secLeft: number; pctPerSec: number };
  /** A heal that lands at once, as a % of the pool — Greater Heal, not the per-second drip. */
  instantHealPct?: number;
  /** The mob a landed curse wrote its lines on, or null when it missed or writes nothing. */
  curseOn?: string | null;
  /** A phys-basis press rolled crit (D-070 pin 1); a magic-basis press never sets this. */
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

/** The stat a skill scales on is the finished hit it multiplies (D-070), so no `scale` lookup remains. */

/** "3/1" → 3 targets when the group is big enough, else 1 (`skill-pool-attack.md` targets column).
 *  The AoE rule is 60% per target, Cap 3, mana ×1.5 (skill-pool.md). */
const AOE_PCT_PER_EXTRA_TARGET = 0.6;
const AOE_MANA_MULT = 1.5;

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
  for (const id of s.list) {
    if (!id || (s.cd[id] || 0) > 0) continue;
    const skill = sm.byId[id];
    const mp = sm.manaPct(skill) || 0;
    const aoe = targetCount(skill, group) > 1;
    const cost = pool * (mp / 100) * (aoe ? AOE_MANA_MULT : 1);
    if (cost > mana) continue;

    s.cd[id] = skillCd(s, id, c.cdr);
    const spent = Math.min(mana, cost);

    if (skill.type === 'heal') {
      const h = healOf(skill);
      return {
        id, name: skill.name, damage: 0, manaPct: mp, manaCost: spent, targets: 0,
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
        id, name: skill.name, damage: 0, manaPct: mp, manaCost: spent, targets: 0, charges,
        cleansesSelf: hasRule(skill, 'cleanses_on_cast'),
      };
    }
    if (skill.type === 'curse') {
      // a curse attaches with the same hit chance an attack uses (skill-pool.md)
      const mob = group[0];
      const hit = rng() <= eng.hitChance(c.accuracy, mob.evasion);
      const writes = (skill.effects || []).some((e: any) => e.subject === 'target');
      return {
        id, name: skill.name, damage: 0, manaPct: mp, manaCost: spent, targets: hit ? 1 : 0,
        curseOn: hit && writes ? mob.id : null,
      };
    }
    // attack: the row's own fraction of the character's finished hit, then the group bonus and AoE split
    const level = skillLevel(s, id);
    let dmg = sm.perPress(skill, { phys: c.phys, magic: c.magic, elem: c.elem, align: c.alignment, level }) || 0;
    // D-070 pin 1: a phys-basis press can crit on top of the pre-crit hit, a magic-basis one cannot.
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
    const perDodge = effects.find((e) => e.stat === 'damage_per_dodge_pct');
    // Riposte scaled off dodge chance, which is gone: it now reads the Evasion chance the sheet
    // carries, so the row keeps its boss path on the merged line (D-112)
    if (perDodge) dmg *= 1 + Math.min(perDodge.cap ?? Infinity, c.evasionChance * perDodge.value) / 100;
    // Retribution: nothing extra at full HP, the row's own multiplier at the share of lost HP it
    // names, growing in between (D-102) — the tank tool that gives Vit a damage line at last
    const atMissing = effects.find((e: any) => e.stat === 'missing_hp_pct_for_max');
    const atMax = effects.find((e: any) => e.stat === 'damage_at_missing_hp');
    if (atMissing && atMax) {
      const missing = Math.min(atMissing.value, Math.max(0, env.missingHpPct || 0));
      dmg *= 1 + (missing / atMissing.value) * (atMax.value - 1);
    }
    const n = targetCount(skill, group);
    const front = group[0];
    // Riposte and Execute read the same row numbers the panel prints; see above for the Cap
    // Execute: the row's threshold, or the one a curse moved on this target
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
    // that decide *whether* a status lands, never the control budget that decides how often (D-102)
    const everyTarget = hasRule(skill, 'every_target');
    const statusName = hasRule(skill, 'guaranteed_status')
      ? (E.elements.status_of as Record<string, MobStatusName | undefined>)[skill.element] : null;
    const spendOn = (t: Mob) => {
      if (!env.mobStatus) return;
      for (const e of effects) {
        if (e.subject !== 'target') continue;
        if (e.stat === 'poison_stacks') setStacks(env.mobStatus, t.id, 'poison', e.value, alignedPerSec);
        if (e.stat === 'burn_stacks') setStacks(env.mobStatus, t.id, 'burn', e.value, alignedPerSec);
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
    // the Element share of a magic-basis press is the part the mob's resistance answers (D-099), and a
    // row that names a pierce removes that share of the mob's own line for this press only (Void Lance)
    const magicBasis = skill.basis === 'magic' ? c.magic + c.elem * (c.alignment / 100) : 0;
    const pierce = effects.find((e) => e.stat === 'resistance_pierce_pct');
    for (let i = 0; i < n; i++) {
      const t = group[i];
      if (rng() > eng.hitChance(c.accuracy, t.evasion)) continue;
      if (dodges && rng() * 100 < eng.dodgeChance(t.dodgeRate, c.accuracy)) continue;
      const share = i === 0 ? dmg : dmg * AOE_PCT_PER_EXTRA_TARGET;
      const elemPart = magicBasis > 0 ? share * ((c.elem * (c.alignment / 100)) / magicBasis) : 0;
      const cut = env.mobStatus ? (targetMods(mobModsOn(env.mobStatus, t.id)).armourCut || 0) : 0;
      const stripped = env.curses ? lineValue(env.curses, t.id, 'mob_elemental_resistance_pct') : 0;
      const pierced = pierce ? -((t.res || 0) * (pierce.value / 100)) : 0;
      const mitigated = eng.mitigateMobHit(t, share - elemPart, elemPart, cut, stripped + pierced);
      t.hp -= mitigated;
      dealt += mitigated;
      landed++;
      if (everyTarget || i === 0) spendOn(t);
    }
    void statuses;
    return {
      id, name: skill.name, damage: dmg, manaPct: mp, manaCost: spent, targets: landed, crit, dealt,
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
