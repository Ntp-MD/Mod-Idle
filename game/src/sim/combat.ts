import { eng, E } from '../engine/client';
import type { Character } from './player';
import type { Mob } from './types';
import type { CurseMods } from './curse';
import { NO_CURSE, accMult, takenMult, psMult } from './curse';

export type StatusName = 'burn' | 'chill' | 'shock' | 'poison' | 'mark';
export type Statuses = Partial<Record<StatusName, { stacks: number; secLeft: number; perSec: number }>>;

export interface HitReport {
  landed: boolean;
  crit: boolean;
  damage: number;
  /** HP recovered from mark's leech on this hit (`status.mark.k_leech`). */
  leech?: number;
}

/**
 * One player swing, in combat.md §2 outgoing order:
 * hit roll → mob dodge (opposed) → crit (physical half only, D-017) → weak/Element counter
 * → the mob's own Armour and Elemental resistance (D-099) → damage_taken → subtract from mob HP.
 * A weapon Element line is what enables steps 3-4; until a Base carries one the counter multiplier
 * is 1, and nothing is invented in its place.
 */
export function playerSwing(
  rng: () => number,
  c: Character,
  mob: Mob,
  weaponElement: string | null,
  curse: CurseMods = NO_CURSE,
): HitReport {
  const hit = eng.hitChance(c.accuracy, mob.evasion);
  if (rng() > hit) return { landed: false, crit: false, damage: 0 };
  if (rng() * 100 < eng.dodgeChance(mob.dodgeRate, c.accuracy)) return { landed: false, crit: false, damage: 0 };

  // formula-offense §3: dmg_per_hit = phys + magic + elem × elem_align/100
  // combat.md §2 steps 3-4 are Element-on-Element, so weak and the counter table scale the Elemental
  // share only — physical is answered by Armour and the Elements by resistance (D-030), never by
  // each other. A cursed target still takes more of the whole hit (Expose).
  // each Element pool is countered on its own (PoE reading, D-089): a fire-and-cold weapon hitting a
  // fire monster gets the ×1.5 weak line on the fire part and the 0.60 pair on the cold part, and a
  // pool that no line names is left exactly as strong as it always was
  let elemDamage = 0;
  const pools = Object.entries(c.elemByElement);
  if (pools.length && mob.innate.length) {
    for (const [el, pool] of pools) {
      const mult = (el === mob.innate[0] && el !== NO_COUNTER_ELEMENT ? E.elements.weak_mult : 1)
        * counterMult(el, mob.innate[0]);
      elemDamage += pool * (c.alignment / 100) * mult;
    }
  } else {
    elemDamage = c.elem * (c.alignment / 100);
  }
  // Elemental Break makes the target take more of the Element half specifically (D-102)
  elemDamage *= 1 + (curse.elemTakenPct || 0) / 100;
  let nonElement = c.phys + c.magic;

  let crit = false;
  if (c.phys > 0 && rng() * 100 < c.critChance + curse.critChance) {
    // crit multiplies the physical half only: magic and the 5 Elements never crit (D-017)
    nonElement = nonElement - c.phys + c.phys * (c.critDmg / 100);
    crit = true;
  }
  // step 5-6 (D-099 · B8): the mob answers each half with the line written against it — its own
  // Armour on everything that is not Element, its own Elemental resistance on the Element half.
  // Crit sizes the hit before the armour ratio, the same way the incoming order does.
  let damage = eng.mitigateMobHit(mob, nonElement, elemDamage, curse.armourCut, curse.resistCut) * takenMult(curse);
  damage *= E.global.damage_mult;
  mob.hp -= damage;
  // Leech is a share of just-dealt damage, never a flat drip: the mark on the target pays it
  // (`elements.md`) and Berserker pays it from our own sheet, so the two add.
  const leechPct = c.leechPct + curse.leechPct;
  const leech = leechPct > 0 ? (damage * leechPct) / 100 : 0;
  return { landed: true, crit, damage, leech };
}

/**
 * Chaos is "the only Element with no counter" and gets 1.15 against everything *including itself*
 * (elements.md), so it never also collects the ×1.5 weak line. Which Element that is is read out of
 * the table rather than named in code: it is the one whose row is the same number in every column.
 */
const NO_COUNTER_ELEMENT = (() => {
  const order = E.elements.order as string[];
  const table = E.elements.counter as Record<string, Record<string, number>>;
  return order.find((our) => order.every((theirs) => table[our][theirs] === table[our][order[0]])) ?? null;
})();

/** elements.md counter table, including the ×1.5 weak line. */
export function counterMult(ourElement: string, mobElement: string): number {
  const table = E.elements.counter as Record<string, Record<string, number>>;
  return table[ourElement]?.[mobElement] ?? 1;
}

/**
 * One mob swing, in combat.md §2 incoming order: perfect dodge → evasion → dodge → damage split
 * → armour on the physical half → resistance on the Element half → damage_taken multiplier →
 * Energy Shield before HP (chaos bypasses) → HP. Returns the damage that actually landed.
 */
export function mobSwing(
  rng: () => number,
  c: Character,
  mob: Mob,
  statuses: Statuses,
  curse: CurseMods = NO_CURSE,
  /** the shield actually standing right now; defaults to the sheet's pool for a caller that has one */
  liveEs: number = c.es,
): { blocked: string | null; toHp: number; toEs: number; raw: number } {
  if (curse.stopped) return { blocked: 'shocked', toHp: 0, toEs: 0, raw: 0 };
  if (rng() * 100 < c.perfectDodge) return { blocked: 'perfect dodge', toHp: 0, toEs: 0, raw: 0 };
  const acc = mob.acc * accMult(curse);
  // Evasion is one layer (D-112): the Dex rating rolls against this mob's accuracy, Agi adds
  // its points on top, and the pair is capped together. A blocked hit is gone entirely.
  if (rng() * 100 < eng.evasionChance(c.evasion, c.evasionFromAgi, acc)) {
    return { blocked: 'evasion', toHp: 0, toEs: 0, raw: 0 };
  }

  // a mob's swing is sized by its priced damage per second, at its own clock rate
  const rawHit = (mob.ps * psMult(curse)) / mob.hitsPerSec;
  const [physShare, elemShare] = eng.damageSplit(mob.damage);
  const armourCut = eng.armourReduce(statuses.chill ? c.armour * (1 - E.status.chill.armour_cut) : c.armour, rawHit * physShare);
  const physical = rawHit * physShare * (1 - armourCut);
  // an aura may harden against one named Element (Trinity Form), and the Cap still binds the total
  const hitting = mob.innate[0];
  const res = Math.min((E.caps as any).elem_res, c.resistance + ((hitting && c.resByElement) ? (c.resByElement[hitting] || 0) : 0));
  const elemental = rawHit * elemShare * (1 - res / 100);
  // step 7 is the damage_taken bucket: the global one from `engine.json`, times whatever the
  // skills up right now add to it (Berserker takes more, Iron Will takes less)
  let damage = (physical + elemental) * E.global.defend_mult * (c.damageTaken ?? 1);

  let toEs = 0;
  if (mob.innate.includes('chaos')) {
    // chaos bypasses Energy Shield and hits HP directly (D-026)
  } else {
    // the pool that is *left* absorbs, not the pool the sheet says the build has: reading the maximum
    // lets one swing spend a shield that is half recharged twice over, and the number goes negative
    const pool = Math.max(0, Math.min(liveEs, c.es));
    toEs = Math.min(damage, pool);
    damage -= toEs;
  }
  return { blocked: null, toHp: damage, toEs, raw: rawHit };
}

/**
 * 20% status proc per landed hit (combat.md §5), then the effect table from engine.json.
 * `statusResist` is the owner's Status Alignment resistance Mod, a % cut on that proc — the one
 * gear answer to statuses, and the stat that used to be ruled out of the game entirely.
 */
export function rollStatus(
  rng: () => number,
  mob: Mob,
  elemHalf: number,
  statuses: Statuses,
  statusResist = 0,
): StatusName | null {
  const el = mob.innate[0];
  if (!el) return null;
  const proc = E.status.proc_chance * (1 - Math.max(0, Math.min(100, statusResist)) / 100);
  if (rng() >= proc) return null;
  const name = E.elements.status_of[el] as StatusName;
  if (!name) return null;
  const s = statuses[name] || (statuses[name] = { stacks: 0, secLeft: 0, perSec: 0 });
  const cfg = (E.status as any)[name];
  if (name === 'burn') {
    s.stacks = Math.min(cfg.stack_max, s.stacks + 1);
    s.perSec = elemHalf * cfg.k_dps;
    s.secLeft = cfg.time_sec;
  } else if (name === 'poison') {
    s.stacks = Math.min(cfg.stack_max, s.stacks + 1);
    s.perSec = elemHalf * cfg.k_dps;
    s.secLeft = 999;
  } else if (name === 'mark') {
    s.stacks = Math.min(cfg.stack_max, s.stacks + 1);
    s.perSec = 0;
    s.secLeft = cfg.decay_sec;
  } else {
    s.stacks = 1;
    s.secLeft = name === 'chill' ? cfg.time_sec : 1;
    s.perSec = 0;
  }
  return name;
}

/** Per-second damage over time, capped by the burn + poison dot_cap (elements.md §6). */
export function dotDamage(c: Character, statuses: Statuses): number {
  const burn = statuses.burn, poison = statuses.poison;
  let total = 0;
  if (burn && burn.secLeft > 0) total += burn.stacks * burn.perSec;
  if (poison && poison.secLeft > 0) total += poison.stacks * poison.perSec;
  const cap = E.status.dot_cap * (c.elem * (c.alignment / 100) || 0);
  return E.status.dot_cap && c.elem > 0 ? Math.min(total, cap) : total;
}
