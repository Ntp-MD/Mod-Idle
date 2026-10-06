import { eng, E, sm, BASES } from '../engine/client';
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
 * hit roll → mob dodge (opposed) → crit (physical half only) → weak/Element counter
 * → the mob's own Armour and Elemental resistance → damage_taken → subtract from mob HP.
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
  // share only — physical is answered by Armour and the Elements by resistance, never by
  // each other. A cursed target still takes more of the whole hit (Expose).
  // each Element pool is countered on its own (PoE reading): a fire-and-cold weapon hitting a
  // fire monster gets the ×1.5 weak line on the fire part and the 0.60 pair on the cold part, and a
  // pool that no line names is left exactly as strong as it always was. The pools are kept split so
  // the race's per-Element res (X54) answers each one on its own line.
  const elemByElement: Record<string, number> = {};
  let elemDamage = 0;
  const pools = Object.entries(c.elemByElement);
  const elemTaken = 1 + (curse.elemTakenPct || 0) / 100;
  if (pools.length && mob.innate.length) {
    for (const [el, pool] of pools) {
      const mult = (el === mob.innate[0] && el !== NO_COUNTER_ELEMENT ? E.elements.weak_mult : 1)
        * counterMult(el, mob.innate[0]);
      const dmg = pool * (c.alignment / 100) * mult * elemTaken;
      elemByElement[el] = dmg;
      elemDamage += dmg;
    }
  } else {
    elemDamage = c.elem * (c.alignment / 100) * elemTaken;
    if (elemDamage > 0 && mob.innate.length) elemByElement[mob.innate[0]] = elemDamage;
  }
  let nonElement = c.phys + c.magic;

  let crit = false;
  if (c.phys > 0 && rng() * 100 < c.critChance + curse.critChance) {
    // crit multiplies the physical half only: magic and the 5 Elements never crit 
    nonElement = nonElement - c.phys + c.phys * (c.critDmg / 100);
    crit = true;
  }
  // step 5-6 (B8): the mob answers each half with the line written against it — its own
  // Armour on everything that is not Element, its own Elemental resistance on the Element half.
  // A crossbow's `Armour penetration %` line joins the same cut a curse writes, so the two
  // add and the ratio cannot fall below zero. Crit sizes the hit before the armour ratio.
  let damage = eng.mitigateMobHit(mob, nonElement, Object.keys(elemByElement).length ? elemByElement : elemDamage, curse.armourCut + eng.armourPenCut(c.armourPen), curse.resistCut) * takenMult(curse);
  // §12 weapon × body class: a SWING is the weapon's own argument with a body, so all 12 weapons
  // carry their `size_mult` row here — including a staff's, whose swing is magic damage. It lands
  // after mitigation so the ladder never scales the armour cut, and a magic-damage SKILL is exempt
  // (`skillHit` applies it only on a physical basis).
  damage = eng.applySizeMult(damage, 1, eng.sizeMultOf(E.weapon_size_mult?.ladder, c.weaponName, (mob as any).readsAs || 'medium'));
  // §14c: a magic weapon has no swing — it flicks a bolt, worth the attack ladder's floor
  if (eng.basicAttackOf(BASES, c.weaponName) === 'bolt') damage *= sm.ladderFloorPct() / 100;
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
  /** Energy Absorb: the share of the hit converted to Energy Shield while the buff is up */
  absorbPct = 0,
): { blocked: string | null; toHp: number; toEs: number; absorbed: number; raw: number } {
  if (curse.stopped) return { blocked: 'shocked', toHp: 0, toEs: 0, absorbed: 0, raw: 0 };
  if (rng() * 100 < c.perfectDodge) return { blocked: 'perfect dodge', toHp: 0, toEs: 0, absorbed: 0, raw: 0 };
  const acc = mob.acc * accMult(curse);
  // Evasion is one layer: the Dex rating rolls against this mob's accuracy, Agi adds
  // its points on top, and the pair is capped together. A blocked hit is gone entirely.
  if (rng() * 100 < eng.evasionChance(c.evasion, c.evasionFromAgi, acc)) {
    return { blocked: 'evasion', toHp: 0, toEs: 0, absorbed: 0, raw: 0 };
  }
  // Block is its own layer, rolled after perfect dodge and evasion (formula-defense.md): the
  // shield's Base Mod line (open-ended, no Cap). It answers a PHYSICAL hit only (owner ruling): a
  // shield argues with a blade, not with a spell, so a pure-Element swing cannot be blocked at all.
  // A blocked hit is NOT deleted — it is cut by a FLAT `armour / 10`, and the cut comes off the
  // physical half alone, capped by it (applied below).

  // a mob's swing is sized by its priced damage per second, at its own clock rate
  const rawHit = (mob.ps * psMult(curse)) / mob.hitsPerSec;
  const [physShare, elemShare] = eng.damageSplit(mob.damage);
  const blockedBy = physShare > 0 && c.block > 0 && rng() * 100 < c.block ? 'block' : null;
  const armourCut = eng.armourReduce(statuses.chill ? c.armour * (1 - E.status.chill.armour_cut) : c.armour, rawHit * physShare);
  const physical = rawHit * physShare * (1 - armourCut);
  // an aura may harden against one named Element (Trinity Form), and the Cap still binds the total
  const hitting = mob.innate[0];
  const res = Math.min((E.caps as any).elem_res, c.resistance + ((hitting && c.resByElement) ? (c.resByElement[hitting] || 0) : 0));
  const elemental = rawHit * elemShare * (1 - res / 100);
  // step 7 is the damage_taken bucket: the global one from `engine.json`, times whatever the
  // skills up right now add to it (Berserker takes more, Iron Will takes less)
  const hardened = E.global.defend_mult * (c.damageTaken ?? 1);
  const physFinal = physical * hardened;
  let damage = physFinal + elemental * hardened;
  // a blocked PHYSICAL hit is cut by a flat `armour / 10` (owner ruling, provisional); the cut can
  // never take more than the physical half, so an Element-heavy swing is not thinned by a shield
  if (blockedBy) damage = Math.max(0, damage - Math.min(c.armour / 10, physFinal));

  // Energy Absorb converts a share of the hit into Energy Shield and negates that share outright,
  // whether or not the shield has room — a press on a full shield is still a real defence 
  const absorbed = absorbPct > 0 ? damage * (Math.min(100, Math.max(0, absorbPct)) / 100) : 0;
  damage -= absorbed;

  let toEs = 0;
  if (mob.innate.includes('chaos')) {
    // chaos bypasses Energy Shield and hits HP directly 
  } else {
    // the pool that is *left* absorbs, not the pool the sheet says the build has: reading the maximum
    // lets one swing spend a shield that is half recharged twice over, and the number goes negative
    const pool = Math.max(0, Math.min(liveEs, c.es));
    toEs = Math.min(damage, pool);
    damage -= toEs;
  }
  return { blocked: blockedBy, toHp: damage, toEs, absorbed, raw: rawHit };
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
  /** Vit's Stun Recovery (item 5): it buys part of a shock's stop back before the clock is set. */
  stunRecovery = 0,
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
    // chill counts down the status's own clock; shock is a STOP, and its length is the config's own
    // `stop_sec` (the mob side pays its stop out of the same field) — one home, no typed second
    s.secLeft = name === 'chill' ? cfg.time_sec
      : name === 'shock' ? cfg.stop_sec * (1 - Math.min(100, Math.max(0, stunRecovery)) / 100)
        : 1;
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
