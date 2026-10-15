import { eng, E, sm, BASES } from '../engine/client';
import type { Character } from './player';
import type { Mob } from './types';
import type { CurseMods } from './curse';
import { NO_CURSE, accMult, takenMult, psMult } from './curse';

export type StatusName = 'burn' | 'chill' | 'shock' | 'poison' | 'bleed' | 'mark' | 'crippled';
export interface StatusLine {
  stacks: number;
  secLeft: number;
  perSec: number;
  /** The dealer's aligned Elemental DPS at apply time, the mirror of the mob record's `alignedPerSec`:
   *  the DoT budget is priced off the dealer, never off the character taking the damage. */
  alignedSec?: number;
  /** Per-stack snapshots for DoTs applied by multiple mobs with different damage. */
  stackPerSec?: number[];
}
export type Statuses = Partial<Record<StatusName, StatusLine>>;

function addStack(s: StatusLine, cap: number, perSec?: number): void {
  if (perSec !== undefined) {
    s.stackPerSec ||= Array.from({ length: Math.max(0, s.stacks) }, () => s.perSec);
    if (s.stacks < cap) s.stackPerSec.push(perSec);
    s.perSec = s.stackPerSec.length
      ? s.stackPerSec.reduce((sum, value) => sum + value, 0) / s.stackPerSec.length
      : perSec;
  }
  s.stacks = Math.min(cap, s.stacks + 1);
}

export function decayStatusStack(s: StatusLine): void {
  if (s.stackPerSec?.length) s.stackPerSec.shift();
  s.stacks = Math.max(0, s.stacks - 1);
  if (s.stackPerSec?.length) {
    s.perSec = s.stackPerSec.reduce((sum, value) => sum + value, 0) / s.stackPerSec.length;
  }
}

export function statusDamagePerSec(s?: StatusLine): number {
  if (!s) return 0;
  return s.stackPerSec ? s.stackPerSec.reduce((sum, value) => sum + value, 0) : s.stacks * s.perSec;
}

export interface HitReport {
  landed: boolean;
  crit: boolean;
  damage: number;
  /** why a swing that missed did: the accuracy roll failed, or the mob's own dodge answered it. */
  why?: 'miss' | 'dodge';
  /** HP recovered from mark's leech on this hit (`status.mark.k_leech`). */
  leech?: number;
  /**
   * The Element that carried the bigger share of this hit, or null when it was pure physical.
   * The damage indicator colours a number by this, so a mixed weapon reads as the half that landed
   * hardest rather than as a second number the sim has to price.
   */
  element?: string | null;
}

/**
 * One player swing, in combat.md §2 outgoing order:
 * hit roll → mob dodge (opposed) → crit (physical half only)
 * → the mob's own Armour and Elemental resistance → damage_taken → subtract from mob HP.
 * No Element counters another: the Element pools answer the Species' own-Element resistance on their own
 * lines, and a Species' non-own Elements meet no resistance at all.
 */
export function playerSwing(
  rng: () => number,
  c: Character,
  mob: Mob,
  weaponElement: string | null,
  curse: CurseMods = NO_CURSE,
): HitReport {
  const hit = eng.hitChance(c.accuracy, mob.evasion);
  if (rng() > hit) return { landed: false, crit: false, damage: 0, why: 'miss' };
  if (rng() * 100 < eng.dodgeChance(mob.dodgeRate, c.accuracy)) return { landed: false, crit: false, damage: 0, why: 'dodge' };

  // formula-offense §3: dmg_per_hit = phys + magic + elem × elem_align/100
  // physical is answered by Armour and the Elements by resistance, never by each other. A cursed
  // target still takes more of the whole hit (Expose). The pools are kept split so the Species'
  // own-Element res (X54) answers its Element on its own line and every other pool lands unresisted.
  const elemByElement: Record<string, number> = {};
  let elemDamage = 0;
  const pools = Object.entries(c.elemByElement);
  const elemTaken = 1 + (curse.elemTakenPct || 0) / 100;
  if (pools.length && mob.innate.length) {
    for (const [el, pool] of pools) {
      const dmg = pool * (c.alignment / 100) * elemTaken;
      elemByElement[el] = dmg;
      elemDamage += dmg;
    }
  } else {
    elemDamage = c.elem * (c.alignment / 100) * elemTaken;
    if (elemDamage > 0 && mob.innate.length) elemByElement[mob.innate[0]] = elemDamage;
  }
  let nonElement = c.phys + c.magic;

  let crit = false;
  let physShare = c.phys;
  if (c.phys > 0 && rng() * 100 < c.critChance + curse.critChance) {
    // crit multiplies the physical half only: magic and the 5 Elements never crit 
    physShare = c.phys * (c.critDmg / 100);
    nonElement = nonElement - c.phys + physShare;
    crit = true;
  }
  // conversion (`draft/convert-damage.md`): a percent of the finished physical share is routed into
  // its named Element here — after crit, before mitigation — so the converted half answers Elemental
  // resistance instead of Armour. The summed percent is capped at the whole hit inside
  // `convertDamageOf`, so overflow is wasted, never a multiplier, and the physical half shrinks by
  // exactly what converted.
  if (c.conversion && Object.keys(c.conversion).length) {
    const conv = eng.convertDamageOf(physShare, c.conversion) as { physical: number; byElement: Record<string, number> };
    nonElement = c.magic + conv.physical;
    // the converted share goes into the SAME per-Element map the pools use, so it meets resistance on
    // its own line. A hit whose element was carried as one number (no named pool) has to be keyed
    // first, or flipping to the map path would silently drop it — `''` reads the mob's headline `res`,
    // exactly what the number path did.
    if (!Object.keys(elemByElement).length && elemDamage > 0) { elemByElement[''] = elemDamage; elemDamage = 0; }
    for (const [el, amount] of Object.entries(conv.byElement)) {
      if (!(amount > 0)) continue;
      const dmg = amount * elemTaken;
      elemByElement[el] = (elemByElement[el] || 0) + dmg;
      elemDamage += dmg;
    }
  }
  // the damage bucket (owner ruling): a swing rides the `Attack damage %` ladder, except a magic
  // weapon's bolt, which rides `Spell damage %`. The Element pools stay outside it — the swing's
  // Element is not the attack — and the pair never crosses.
  nonElement = nonElement * eng.ladderMult(
    eng.basicAttackOf(BASES, c.weaponName) === 'bolt' ? 'magic' : 'phys',
    c.attackDamage, c.spellDamage);

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
  // The indicator's colour: which Element carried the bigger share of what actually landed. `null`
  // is the non-Element half (Physical power plus Magic power), which the HUD reads in one neutral
  // colour — it is a colour key, not a sixth Element.
  let element: string | null = null;
  let best = 0;
  for (const [el, pool] of Object.entries(elemByElement)) {
    if ((pool || 0) > best) { best = pool; element = el || null; }
  }
  if (elemDamage <= nonElement) element = null;
  return { landed: true, crit, damage, leech, element };
}

/**
 * One mob swing, in combat.md §2 incoming order: perfect dodge → evasion → dodge → damage split
 * → armour on the physical half → resistance on the Element half → damage_taken multiplier →
 * Energy Shield before HP (unless the data explicitly allows an Element to bypass it) → HP.
 * Poison and bleed DoT are routed separately. Returns the damage that actually landed.
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
  /** Earth Wall: a block charge is standing, so this swing is answered by the block layer either way */
  blockCharge = false,
): { blocked: string | null; toHp: number; toEs: number; absorbed: number; raw: number; leech?: number; blockChargeSpent: boolean } {
  if (curse.stopped) return { blocked: 'shocked', toHp: 0, toEs: 0, absorbed: 0, raw: 0, blockChargeSpent: false };
  if (rng() * 100 < c.perfectDodge) return { blocked: 'perfect dodge', toHp: 0, toEs: 0, absorbed: 0, raw: 0, blockChargeSpent: false };
  const acc = mob.acc * accMult(curse);
  // Evasion is one layer: the Agi rating rolls against this mob's accuracy, the gear Evasion
  // lines ride on it, and the Cap 80 binds the result. A blocked hit is gone entirely.
  if (rng() * 100 < eng.evasionChance(c.evasion, acc)) {
    return { blocked: 'evasion', toHp: 0, toEs: 0, absorbed: 0, raw: 0, blockChargeSpent: false };
  }
  // Block is its own layer, rolled after perfect dodge and evasion (formula-defense.md): the
  // shield's Frame Mod line (open-ended, no Cap). It answers a PHYSICAL hit only (owner ruling): a
  // shield argues with a blade, not with a spell, so a pure-Element swing cannot be blocked at all.
  // A blocked hit is NOT deleted — it is cut by a FLAT `armour / 10`, and the cut comes off the
  // physical half alone, capped by it (applied below).

  // a mob's swing is sized by its priced damage per second, at its own clock rate
  const rawHit = (mob.ps * psMult(curse)) / mob.hitsPerSec;
  const [physShare, elemShare] = eng.damageSplit(mob.damage);
  const rolled = physShare > 0 && c.block > 0 && rng() * 100 < c.block ? 'block' : null;
  // An Earth Wall charge forces the same cut when the shield's own roll misses — one charge a hit. A
  // hit already removed above (a dodge, Evasion) never reaches here, so a charge is never spent on
  // nothing, and the answer names itself on screen so the charge reads apart from the shield.
  const blockedBy = rolled || (physShare > 0 && blockCharge ? 'block charge' : null);
  const armourCut = eng.armourReduce(statuses.chill ? c.armour * (1 - E.status.chill.armour_cut) : c.armour, rawHit * physShare);
  const physical = rawHit * physShare * (1 - armourCut);
  // an aura may harden against one named Element (Trinity Form), and the Cap in force still binds the
  // total — the Cap the character carries, which the passive tree's unlock node raises
  const hitting = mob.innate[0];
  const res = Math.min(c.resCap, c.resistance + ((hitting && c.resByElement) ? (c.resByElement[hitting] || 0) : 0));
  const elemental = rawHit * elemShare * (1 - res / 100);
  // step 7 is the damage_taken bucket: the global one from `engine.json`, times whatever the
  // skills up right now add to it (Berserker takes more, Iron Will takes less). Block is a
  // mitigation layer, so its flat cut lands BEFORE this multiplier — "damage taken" runs after
  // every mitigation layer, the glossary's own order.
  const hardened = E.global.defend_mult * (c.damageTaken ?? 1);
  let physFinal = physical;
  // a blocked PHYSICAL hit is cut by a flat `armour / 10` (owner ruling, provisional); the cut can
  // never take more than the physical half, so an Element-heavy swing is not thinned by a shield
  if (blockedBy) physFinal = Math.max(0, physFinal - Math.min(c.armour / E.caps.block_divisor, physFinal));
  physFinal = physFinal * hardened;
  const elementalFinal = elemental * hardened;
  const marked = statuses.mark && statuses.mark.secLeft > 0 ? statuses.mark : null;
  const markMult = marked ? 1 + marked.stacks * E.status.mark.k_dmg : 1;
  let damage = (physFinal + elementalFinal) * markMult;

  // Energy Absorb converts a share of the hit into Energy Shield and negates that share outright,
  // whether or not the shield has room — a press on a full shield is still a real defence 
  const absorbRatio = Math.min(100, Math.max(0, absorbPct)) / 100;
  const absorbed = damage * absorbRatio;
  const remaining = damage - absorbed;
  // The data owns whether Chaos is an exception. Today all direct hits, including Chaos, meet ES.
  const chaosBypass = E.energy_shield.chaos_bypasses && mob.innate.includes('chaos')
    ? elementalFinal * markMult * (1 - absorbRatio) : 0;
  const esEligible = Math.max(0, remaining - chaosBypass);
  // Energy Absorb fills the live shield before the rest of this hit reaches it. Using the old pool
  // would send damage to HP, then leave the absorbed ES standing after the same hit.
  const pool = Math.max(0, Math.min(liveEs + absorbed, c.es));
  const toEs = Math.min(esEligible, pool);
  const toHp = remaining - toEs;
  const leechPct = marked ? marked.stacks * E.status.mark.k_leech * 100 : 0;
  return {
    blocked: blockedBy, toHp, toEs, absorbed, raw: rawHit,
    leech: (toHp + toEs) * leechPct / 100,
    blockChargeSpent: rawHit > 0 && physShare > 0 && blockCharge,
  };
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
  /** The dealer's aligned Elemental DPS: the DoT budget's basis, the mirror of the mob-side record. */
  alignedSec = 0,
): StatusName | null {
  const el = mob.innate[0];
  if (!el) return null;
  const proc = E.status.proc_chance * (1 - Math.max(0, Math.min(100, statusResist)) / 100);
  if (rng() >= proc) return null;
  const name = (E.elements.status_of as Record<string, string | undefined>)[el] as StatusName;
  if (!name) return null;
  const s = statuses[name] || (statuses[name] = { stacks: 0, secLeft: 0, perSec: 0 });
  const cfg = (E.status as any)[name];
  if (name === 'burn') {
    addStack(s, cfg.stack_max, elemHalf * cfg.k_dps);
    s.secLeft = cfg.time_sec;
    s.alignedSec = Math.max(s.alignedSec || 0, alignedSec);
  } else if (name === 'poison') {
    const wasClear = s.stacks <= 0;
    addStack(s, cfg.stack_max, elemHalf * cfg.k_dps);
    // Poison loses one stack on its own clock. A new proc adds a stack, but never restarts that clock.
    if (wasClear) s.secLeft = cfg.decay_sec;
    s.alignedSec = Math.max(s.alignedSec || 0, alignedSec);
  } else if (name === 'mark') {
    const wasClear = s.stacks <= 0;
    s.stacks = Math.min(cfg.stack_max, s.stacks + 1);
    s.perSec = 0;
    if (wasClear) s.secLeft = cfg.decay_sec;
  } else {
    s.stacks = 1;
    // chill counts down the status's own clock; shock is a STOP, and its length is the config's own
    // `stop_sec` (the mob side pays its stop out of the same field) — one home, no typed second
    if (name === 'chill' || name === 'crippled') s.secLeft = cfg.time_sec;
    else if (name === 'shock') {
      s.secLeft = cfg.stop_sec * (1 - Math.min(100, Math.max(0, stunRecovery)) / 100);
      if (s.secLeft <= 0) { delete statuses.shock; return null; }
    } else s.secLeft = 1;
    s.perSec = 0;
  }
  return name;
}

/**
 * A bursting body (`mob.trait_mechanics.poison_burst`) pays one poison line when it dies, worth a share
 * of its own damage per second. It is not a proc — the pop is the whole body — so it answers no
 * `status.proc_chance` roll; the fighter's own status immunity is the only answer to it.
 */
export function poisonBurst(mob: Mob, statuses: Statuses, psPct: number): boolean {
  const perSec = mob.ps * psPct / 100;
  if (!(perSec > 0)) return false;
  const cfg = (E.status as any).poison;
  const s = statuses.poison || (statuses.poison = { stacks: 0, secLeft: 0, perSec: 0 });
  const wasClear = s.stacks <= 0;
  addStack(s, cfg.stack_max, perSec);
  // the same clock a proc'd poison runs on: one stack decays on its own beat, never restarted by the pop
  if (wasClear) s.secLeft = cfg.decay_sec;
  s.alignedSec = Math.max(s.alignedSec || 0, mob.ps);
  return true;
}

/** Burn and poison share the Element DoT budget; bleed is physical and sits outside it.
 *  The budget's basis is the dealer's aligned Elemental DPS (the mob-side mirror keeps the same
 *  number on the victim's record as `alignedPerSec`), never the character taking the damage — a
 *  respec must not move how hard the mobs' fire burns. */
export function dotDamageParts(c: Character, statuses: Statuses): { burn: number; poison: number; bleed: number; total: number } {
  const rawBurn = statuses.burn && statuses.burn.secLeft > 0 ? statusDamagePerSec(statuses.burn) : 0;
  const rawPoison = statuses.poison && statuses.poison.secLeft > 0 ? statusDamagePerSec(statuses.poison) : 0;
  const bleed = statuses.bleed && statuses.bleed.secLeft > 0 ? statusDamagePerSec(statuses.bleed) : 0;
  const elemental = rawBurn + rawPoison;
  const aligned = Math.max(statuses.burn?.alignedSec || 0, statuses.poison?.alignedSec || 0);
  const cap = E.status.dot_cap * aligned;
  const scale = E.status.dot_cap > 0 && aligned > 0 && elemental > cap ? cap / elemental : 1;
  const burn = rawBurn * scale;
  const poison = rawPoison * scale;
  return { burn, poison, bleed, total: burn + poison + bleed };
}

export function dotDamage(c: Character, statuses: Statuses): number {
  return dotDamageParts(c, statuses).total;
}
