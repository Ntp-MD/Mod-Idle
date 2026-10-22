import { E, eng } from '../engine/client';
import type { Character } from './player';
import type { CurseMods } from './curse';

/**
 * Statuses the player puts on a mob — the rule `engine.json` `status.mob_side` already decided
 *: DoT lands in full, damage-shaping debuffs land, control is bounded and never a lockout,
 * and mobs have no resist stat. Every constant is read from `engine.json` `status` · `K` ·
 * `elements`; none of them is retyped here.
 *
 * The mirror of this file is `combat.ts` `rollStatus`, which does the same thing to the player.
 */

export type MobStatusName = 'burn' | 'chill' | 'shock' | 'poison' | 'mark' | 'crippled' | 'erosion' | 'bleed';

export interface MobLine {
  stacks: number;
  secLeft: number;
  /** Absolute damage per second this line is dealing, already scaled by the dealer's Element. */
  perSec: number;
  /**
   * A line a Keystone wrote with its own stated lifetime: it pays `secLeft` seconds and never
   * stack-decays on the family's own clock, because the Keystone already decided the total.
   */
  fixedSec?: boolean;
}

export interface MobMark {
  statuses: Partial<Record<MobStatusName, MobLine>>;
  /** The dealer's aligned Elemental damage per second, which is what the DoT Cap divides by. */
  alignedPerSec: number;
  /** Seconds of clock this spawn has already had stopped, against the rolling control budget. */
  stoppedSec: number;
  elapsedSec: number;
  /** Until this second, poison on the target does not decay (`curse.venom_bind`). */
  poisonHeldUntil?: number;
}

export type MobStatusStore = Record<string, MobMark>;

export const newMobStatusStore = (): MobStatusStore => ({});

const S = E.status as any;
const K = E.K as any;
/** Stun chance is uncapped; only total stopped time is bounded by this rolling share of the fight. */
const CONTROL_BOUND = S.mob_control_budget_pct;

const line = (m: MobMark, name: MobStatusName): MobLine =>
  (m.statuses[name] ||= { stacks: 0, secLeft: 0, perSec: 0 });

/** How many stacks of a debuff the Cap on its own stat allows. */
const stacksUnderCap = (name: MobStatusName): number => {
  const cfg = S[name];
  if (name === 'chill') return Math.max(1, Math.floor(cfg.aspd_cap / cfg.aspd_pct));
  if (name === 'shock') return 1; // `stacks: false`
  if (name === 'crippled') return 1; // earth: one application holds the clock cut, a second refreshes it
  return cfg.stack_max;
};

/**
 * A landed Elemental hit tries to inflict its Element's status. Alignment gates the attempt
 * (`status_gate = roll vs elem_align`), then the shared 20% proc, then the stack rules.
 * `alignedPerSec` is the dealer's `elem × alignment/100`, which is what burn and poison pay from.
 */
export function applyElement(
  rng: () => number,
  store: MobStatusStore,
  mobId: string,
  element: string,
  c: Character,
  alignedPerHit: number,
  immune: string[] = [],
): MobStatusName | null {
  const name = (E.elements.status_of as Record<string, string>)[element] as MobStatusName | undefined;
  if (!name) return null;
  if (!alignmentPass(rng, c.alignment)) return null; // the Alignment gate
  if (rng() >= S.proc_chance) return null;
  return placeStatus(store, mobId, name, c, alignedPerHit, immune);
}

/**
 * The Alignment gate (owner ruling): ONE roll that every *whichever* status a hit may land has to pass,
 * and the same one for all of them — an Element status, the bleed an axe's line or a row grants, and the
 * stun a mace's line rolls. Dex decides all three, so a build that cannot pass the gate cannot inflict
 * anything. A row that DECLARES a status (N stacks, a `guaranteed_status` rule, a named stop) is not a
 * roll and never passes through here.
 */
export const alignmentPass = (rng: () => number, alignment: number): boolean => rng() * 100 < alignment;

/**
 * Write one status on the mob. Split out so a row that says the status lands ("Shocks all hit")
 * can skip the Alignment roll and the 20% proc without skipping anything else: the control budget
 * still applies, because that is a rule about the mob, not about how the status arrived.
 */
export function placeStatus(
  store: MobStatusStore,
  mobId: string,
  name: MobStatusName,
  c: Character,
  alignedPerHit: number,
  /** the statuses this body cannot answer (`Mob.immune`, from `mob.trait_mechanics`) */
  immune: string[] = [],
): MobStatusName | null {
  if (immune.includes(name)) return null;
  const m = mark(store, mobId);
  m.alignedPerSec = Math.max(m.alignedPerSec, alignedPerHit);
  const l = line(m, name);
  const cfg = S[name];
  if (name === 'burn' || name === 'poison') {
    l.stacks = Math.min(stacksUnderCap(name), l.stacks + 1);
    l.perSec = alignedPerHit * cfg.k_dps;
    if (name === 'burn') l.secLeft = cfg.time_sec;
  } else if (name === 'mark') {
    l.stacks = Math.min(cfg.stack_max, l.stacks + 1);
    l.perSec = 0;
    l.secLeft = cfg.decay_sec;
  } else if (name === 'chill') {
    l.stacks = Math.min(stacksUnderCap(name), l.stacks + 1);
    l.perSec = 0;
    l.secLeft = cfg.time_sec;
  } else if (name === 'crippled') {
    // earth: no stacks and no per-second damage — the whole status is the clock cut it holds
    l.stacks = 1;
    l.perSec = 0;
    l.secLeft = cfg.time_sec;
  } else {
    // shock: no stacks, and the stopped second is paid out of the control budget
    if (m.stoppedSec + cfg.stop_sec > CONTROL_BOUND * m.elapsedSec && m.stoppedSec > 0) return name;
    l.stacks = 1;
    l.perSec = 0;
    l.secLeft = 1;
    m.stoppedSec += cfg.stop_sec;
  }
  return name;
}

/**
 * A direct stop names its own length and no chance. It pays the shared rolling stop-time budget
 * unless its row explicitly sets `bypassBudget` (combat.md §5b).
 */
export function stopMob(store: MobStatusStore, mobId: string, sec: number, bypassBudget = false): void {
  const m = mark(store, mobId);
  const l = line(m, 'shock');
  l.stacks = 1;
  l.perSec = 0;
  l.secLeft = Math.max(l.secLeft, sec);
  if (!bypassBudget) m.stoppedSec += sec;
}

/**
 * A proc-based stun — the mace's `Chance to stun %` line. A landed hit rolls the chance and
 * a landed stun stops the mob for `shock.stop_sec`, paid out of the separate rolling stop-time budget
 * shock obeys, so an uncapped chance can never lock a fight (combat.md §5b).
 */
export function stunMob(rng: () => number, store: MobStatusStore, mobId: string, chancePct: number): boolean {
  if (chancePct <= 0 || rng() * 100 >= chancePct) return false;
  const m = mark(store, mobId);
  const cfg = S.shock;
  if (m.stoppedSec + cfg.stop_sec > CONTROL_BOUND * m.elapsedSec && m.stoppedSec > 0) return false;
  const l = line(m, 'shock');
  l.stacks = 1;
  l.perSec = 0;
  l.secLeft = Math.max(l.secLeft, cfg.stop_sec);
  m.stoppedSec += cfg.stop_sec;
  return true;
}

/**
 * A row that names a stack count ("Applies 3 poison stacks", "full 3 burn stacks in one press")
 * writes that many stacks directly: no Alignment roll and no proc, because the row *is* the
 * application. The per-stack damage is still the caster's aligned Elemental damage per second.
 */
export function setStacks(
  store: MobStatusStore,
  mobId: string,
  name: 'burn' | 'poison' | 'mark',
  stacks: number,
  alignedPerSec: number,
): number {
  const m = mark(store, mobId);
  m.alignedPerSec = Math.max(m.alignedPerSec, alignedPerSec);
  const cfg = S[name];
  const l = line(m, name);
  l.stacks = Math.min(cfg.stack_max, l.stacks + stacks);
  // a status whose own row carries no DoT coefficient (a mark) adds no per-sec damage of its own
  l.perSec = alignedPerSec * ((cfg as any).k_dps ?? 0);
  if (name === 'burn') l.secLeft = cfg.time_sec;
  return l.stacks;
}

/** Venom Bind: the poison on this target stops decaying for the seconds the row states. */
export function holdPoison(store: MobStatusStore, mobId: string, sec: number): void {
  const m = mark(store, mobId);
  m.poisonHeldUntil = Math.max(m.poisonHeldUntil || 0, m.elapsedSec + sec);
}

/**
 * Bleed is a physical DoT that does not stack: a new application refreshes the five seconds and, if
 * the hit was stronger, keeps the higher value (formula-offense.md §4). `chance` is the caller's
 * roll (0..1) — the axe's `Chance to bleed %` line plus the proc a granting curse carries, not a
 * constant read here, so the gear line actually moves the proc.
 */
export function applyBleed(
  rng: () => number,
  store: MobStatusStore,
  mobId: string,
  physicalPerHit: number,
  chance: number,
  immune: string[] = [],
): boolean {
  if (immune.includes('bleed')) return false;
  if (rng() >= chance) return false;
  const m = mark(store, mobId);
  const l = line(m, 'bleed');
  l.stacks = 1;
  l.perSec = Math.max(l.perSec, (physicalPerHit * K.K_BLEED) / K.bleed_time_sec);
  l.secLeft = K.bleed_time_sec;
  return true;
}

function mark(store: MobStatusStore, mobId: string): MobMark {
  return store[mobId] || (store[mobId] = { statuses: {}, alignedPerSec: 0, stoppedSec: 0, elapsedSec: 0 });
}

/**
 * A DoT line a Keystone owns. The bundle states the damage per second and the seconds it runs, so
 * nothing is rolled here: no Alignment gate and no proc chance, because the row is the application —
 * `20` Toxic Execution's crit bonus and `09` Crimson Pact's withheld physical. Status immunity is the
 * only answer, and the DoT budget the family already obeys still binds the payment.
 */
export function placeKeystoneDoT(
  store: MobStatusStore,
  mobId: string,
  name: 'poison' | 'bleed',
  perSec: number,
  sec: number,
  alignedPerSec: number,
  immune: string[] = [],
): boolean {
  if (!(perSec > 0) || !(sec > 0) || immune.includes(name)) return false;
  const m = mark(store, mobId);
  m.alignedPerSec = Math.max(m.alignedPerSec, alignedPerSec);
  const l = line(m, name);
  // a Poison the build already proc'd runs on its own stack clock; the Keystone's damage rides that
  // clock at the stronger rate instead of converting a stacking line into a timed one
  if (name === 'poison' && l.stacks > 0 && !l.fixedSec) {
    l.perSec = Math.max(l.perSec, perSec);
    return true;
  }
  l.stacks = Math.max(1, l.stacks);
  l.perSec = Math.max(l.perSec, perSec);
  l.secLeft = Math.max(l.secLeft, sec);
  l.fixedSec = true;
  return true;
}

/** Does this body carry a Burn, Poison or Bleed a `60` Plague Courier could move off it? */
export function carriesTransferable(store: MobStatusStore, mobId: string): boolean {
  const l = store[mobId]?.statuses;
  if (!l) return false;
  return (['burn', 'poison', 'bleed'] as MobStatusName[])
    .some((f) => { const line = l[f]; return !!line && (line.stacks > 0 || line.secLeft > 0); });
}

/**
 * `60` Plague Courier: one Burn, Poison or Bleed walks off a body and onto another, whole — the
 * remaining damage per second and the remaining life come with it and no clock restarts. The first
 * family the source carries is the one that moves, in that order; a body that cannot answer the
 * family simply does not catch it, and the source keeps what it had.
 */
export function transferStatus(
  store: MobStatusStore,
  fromId: string,
  toId: string,
  immune: string[] = [],
): MobStatusName | null {
  const src = store[fromId];
  if (!src || fromId === toId) return null;
  const name = (['burn', 'poison', 'bleed'] as MobStatusName[])
    .find((f) => { const l = src.statuses[f]; return !!l && (l.stacks > 0 || l.secLeft > 0); });
  if (!name) return null;
  if (immune.includes(name)) return null;
  const moving = src.statuses[name]!;
  delete src.statuses[name];
  // the transfer keeps what it carried — the damage the line is dealing and the life it has left —
  // and starts no new clock of its own
  const dst = line(mark(store, toId), name);
  dst.stacks = Math.max(dst.stacks, moving.stacks);
  dst.perSec = Math.max(dst.perSec, moving.perSec);
  dst.secLeft = Math.max(dst.secLeft, moving.secLeft);
  if (moving.fixedSec) dst.fixedSec = true;
  return name;
}

/**
 * The earth line a row leaves behind (Sand Storm): its own damage a second, and its own seconds — both
 * typed by the row, not by the element — so a lingering cloud counts INSIDE the shared DoT budget the
 * cap already runs on. `alignedPerHit` only raises the budget the cap is measured against, exactly as an
 * Element status does, so a sandstorm on a build with no Elemental damage is still a real tick.
 */
export function setErosion(store: MobStatusStore, mobId: string, perSec: number, sec: number, alignedPerHit = 0): void {
  const m = mark(store, mobId);
  m.alignedPerSec = Math.max(m.alignedPerSec, alignedPerHit);
  const l = line(m, 'erosion');
  l.stacks = 1;
  l.perSec = Math.max(l.perSec, perSec);
  l.secLeft = Math.max(l.secLeft, sec);
}

/** What all of a mob's lines do to the character's hits against it and to the mob's own clock. */
export interface MobStatusMods {
  aspdPct: number;
  accPct: number;
  armourCut: number;
  damageTakenPct: number;
  leechPct: number;
  stopped: boolean;
  /** Crippled: the share of the mob's own attack clock the cut removes, in percent. */
  clockPct: number;
}

export function modsOn(store: MobStatusStore, mobId: string): MobStatusMods {
  const m = store[mobId];
  const out: MobStatusMods = { aspdPct: 0, accPct: 0, armourCut: 0, damageTakenPct: 0, leechPct: 0, stopped: false, clockPct: 0 };
  if (!m) return out;
  const chill = m.statuses.chill;
  if (chill && chill.secLeft > 0) {
    out.aspdPct = -Math.min(S.chill.aspd_cap, chill.stacks * S.chill.aspd_pct);
    out.accPct = -Math.min(S.chill.acc_cap, chill.stacks * S.chill.acc_pct);
    out.armourCut = S.chill.armour_cut;
  }
  const cr = m.statuses.crippled;
  if (cr && cr.secLeft > 0) out.clockPct = Math.min(S.crippled.clock_cap, S.crippled.clock_pct);
  const shock = m.statuses.shock;
  if (shock && shock.secLeft > 0) {
    // the stronger cut wins: shock's own aspd_cap is the floor the merge takes, chill or not
    out.aspdPct = Math.min(out.aspdPct, -S.shock.aspd_cap);
    out.stopped = true;
  }
  const mk = m.statuses.mark;
  if (mk && mk.secLeft > 0) {
    out.damageTakenPct = mk.stacks * S.mark.k_dmg * 100;
    out.leechPct = mk.stacks * S.mark.k_leech * 100;
  }
  return out;
}

/**
 * One second of the mob's status clocks, split by the status that dealt it.
 *
 * `stepMob` keeps publishing the single total every caller already reads; the parts are for the screen,
 * which colours a tick by what is burning, poisoning or bleeding the target. The `dot_cap` cut is shared
 * across the Element line, so each contributor is scaled by the same factor — a capped tick is a smaller
 * version of the same split, never a different one. Bleed sits outside the budget and passes whole.
 */
export interface DotTick { total: number; burn: number; poison: number; erosion: number; bleed: number }

export function stepMobParts(store: MobStatusStore, mobId: string): DotTick {
  const none = { total: 0, burn: 0, poison: 0, erosion: 0, bleed: 0 };
  const m = store[mobId];
  if (!m) return none;
  m.elapsedSec++;
  // the control budget is a rolling share of the fight, so each second alive pays that share back
  // from the stopped-time allowance and a long fight can still be shocked again
  m.stoppedSec = Math.max(0, m.stoppedSec - CONTROL_BOUND);
  let burnDot = 0;
  let poisonDot = 0;
  let bleedDot = 0;
  let erosionDot = 0;
  for (const [name, l] of Object.entries(m.statuses) as [MobStatusName, MobLine][]) {
    if (name === 'poison') {
      if (l.fixedSec) {
        // a Keystone's own poison pays the seconds its row states and then goes: its total is fixed, so
        // the stack clock that eats a proc'd poison never touches it
        poisonDot += l.stacks * l.perSec;
        l.secLeft--;
        if (l.secLeft <= 0) delete m.statuses.poison;
        continue;
      }
      // the hold covers the next `sec` of this mob's own clock, so the last held second is inclusive
      const held = (m.poisonHeldUntil || 0) >= m.elapsedSec;
      if (!held && m.elapsedSec % S.poison.decay_sec === 0 && l.stacks > 0) l.stacks--;
      poisonDot += l.stacks * l.perSec;
      if (l.stacks <= 0) delete m.statuses.poison;
      continue;
    }
    if (name === 'mark') {
      if (m.elapsedSec % S.mark.decay_sec === 0 && l.stacks > 0) l.stacks--;
      if (l.stacks <= 0) delete m.statuses.mark;
      continue;
    }
    // the tick is paid before its clock runs: a status applied for `time_sec` pays `time_sec`
    // ticks, the "once a second" rule and the player-side mirror, which reads the DoT before aging
    if (name === 'burn') burnDot += l.stacks * l.perSec;
    if (name === 'erosion') erosionDot += l.stacks * l.perSec;
    if (name === 'bleed') bleedDot += l.perSec;
    l.secLeft--;
    if (l.secLeft <= 0) { delete m.statuses[name]; continue; }
  }
  // `elements.md` §6: the budget is burn + poison + the earth line a row leaves (owner ticket), and
  // bleed sits outside it on purpose — it is physical, it does not stack, and its own budget is 0.70 of
  // the hit that inflicted it over 5 sec.
  const budget = S.dot_cap * m.alignedPerSec;
  const elementDot = burnDot + poisonDot + erosionDot;
  const capped = S.dot_cap > 0 ? Math.min(elementDot, budget) : elementDot;
  const share = elementDot > 0 ? capped / elementDot : 0;
  // the record itself stays until the mob leaves the field, because the control budget lives on it
  if (!Object.keys(m.statuses).length) m.alignedPerSec = 0;
  return { total: capped + bleedDot, burn: burnDot * share, poison: poisonDot * share, erosion: erosionDot * share, bleed: bleedDot };
}

/**
 * One second of the mob's status clocks: decay, expiry, and the DoT it is taking, capped by the
 * global burn + poison budget (`status.dot_cap` × the dealer's aligned damage per second).
 */
export function stepMob(store: MobStatusStore, mobId: string): number {
  return stepMobParts(store, mobId).total;
}

/** Drop every record for mobs that are no longer on the field. */
export function forgetDead(store: MobStatusStore, liveIds: Set<string>): void {
  for (const id of Object.keys(store)) if (!liveIds.has(id)) delete store[id];
}

/**
 * The same target in the shape combat reads: chill and shock show up as a slower swing and worse
 * accuracy, mark as more damage taken plus the leech, shock also as a stopped clock. Each Cap is
 * applied where its own stat defines it, so this never needs a second bound.
 */
export function targetMods(m: MobStatusMods): Partial<CurseMods> {
  return {
    attackSpeed: m.aspdPct,
    accuracy: m.accPct,
    damageTaken: m.damageTakenPct,
    leechPct: m.leechPct,
    armourCut: m.armourCut,
    stopped: m.stopped,
    clockPct: m.clockPct,
  };
}

export const statusLabel = (name: string): string =>
  ({ burn: 'burning', chill: 'chilled', shock: 'shocked', poison: 'poisoned', mark: 'marked', crippled: 'crippled', bleed: 'bleeding' }[name] || name);

/**
 * The condition words a skill row may name (`engine/skills.ts` `EFFECT_CONDITIONS`) → the status that
 * writes them. Every word of the closed set is here, so a conditional line can never key on a state
 * nothing inflicts; the effects test walks the set and fails if a word has no reader.
 */
export const CONDITION_OF: Record<string, MobStatusName> = {
  chilled: 'chill', burning: 'burn', shocked: 'shock', poisoned: 'poison', marked: 'mark', bleeding: 'bleed',
};

/** Does this mob currently hold the state a conditional line keys on? */
export function holdsCondition(store: MobStatusStore, mobId: string, condition: string): boolean {
  const name = CONDITION_OF[condition];
  if (!name) return false;
  const l = store[mobId]?.statuses[name];
  if (!l) return false;
  // burn/poison/mark run on their own clocks — stack lines decay by count, timed lines by seconds
  return name === 'poison' || name === 'mark' ? l.stacks > 0 : l.secLeft > 0;
}

/**
 * The three riders a swing carries — the weapon Elemental status proc, its bleed chance and the
 * mace's stun (). §14: a press takes the swing's tick inside a rotation, so it
 * has to carry them too, or a caster silently stops applying status the moment the bar fills. The
 * swing and every landing attack press call this one function, so the two cannot drift.
 */
export function applyWeaponRiders(
  rng: () => number,
  c: Character,
  store: MobStatusStore,
  mobId: string,
  bleedCurseUp: boolean,
  bonusBleedPct = 0,
  /** the row's own stun feed: a target-side `stun_chance` it adds to the mace's line */
  bonusStunPct = 0,
  /** the statuses this body cannot answer (`Mob.immune`) — neither an Element proc nor a bleed lands */
  immune: string[] = [],
  /** `66` Elemental Conduit: the as-extra pools this Hit carried, one separate attempt each */
  extraByElement: Record<string, number> = {},
): void {
  const alignedPerSec = c.elem * (c.alignment / 100) * c.hitsPerSec;
  for (const el of Object.keys(c.elemByElement)) {
    if (el && (c.elemByElement as any)[el] > 0) applyElement(rng, store, mobId, el, c, alignedPerSec, immune);
  }
  // §7.2.11 · 66: a hit that carried as-extra Elemental damage gets its own separate attempt for that
  // Element — the same Alignment gate, the same proc chance, the same immunity and stack rules, and the
  // same control budget, because the lane is a second roll, not a second mechanic.
  for (const [el, amount] of Object.entries(extraByElement)) {
    if (el && amount > 0) applyElement(rng, store, mobId, el, c, alignedPerSec, immune);
  }
  // a row of its own may add a bleed chance on the target it lands on (Puncture guarantees it), so the
  // press's own sentence reaches the same roll the gear and a granting curse feed
  // the same Alignment gate every rolled status passes (owner ruling): the bleed off an axe's line and
  // the stun off a mace's are rolls like an Element proc, so one gate roll answers both riders on this
  // hit — a build that cannot pass it inflicts neither, whatever its gear lines say
  const passed = alignmentPass(rng, c.alignment);
  const bleedPct = eng.bleedChanceFrom(bleedCurseUp, c.bleedChance + (bonusBleedPct || 0));
  if (passed && c.phys > 0 && bleedPct > 0) applyBleed(rng, store, mobId, c.phys, bleedPct / 100, immune);
  const stunPct = c.stunChance + (bonusStunPct || 0);
  if (passed && stunPct > 0) stunMob(rng, store, mobId, stunPct);
}
