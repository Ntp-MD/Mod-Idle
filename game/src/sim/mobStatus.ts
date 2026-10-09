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

export type MobStatusName = 'burn' | 'chill' | 'shock' | 'poison' | 'mark' | 'bleed';

export interface MobLine {
  stacks: number;
  secLeft: number;
  /** Absolute damage per second this line is dealing, already scaled by the dealer's Element. */
  perSec: number;
}

export interface MobMark {
  statuses: Partial<Record<MobStatusName, MobLine>>;
  /** The dealer's aligned Elemental damage per second, which is what the DoT Cap divides by. */
  alignedPerSec: number;
  /** Seconds of clock this spawn has already had stopped, against the 15% control bound. */
  stoppedSec: number;
  elapsedSec: number;
  /** Until this second, poison on the target does not decay (`curse.venom_bind`). */
  poisonHeldUntil?: number;
}

export type MobStatusStore = Record<string, MobMark>;

export const newMobStatusStore = (): MobStatusStore => ({});

const S = E.status as any;
const K = E.K as any;
/** Control is bounded, never a lockout: at most this share of a fight may be spent stopped. */
const CONTROL_BOUND = 0.15;
const MAX_STOP_SEC = 15; // stun is capped at 15% chance in the same rule (`combat.md` §5b)

const line = (m: MobMark, name: MobStatusName): MobLine =>
  (m.statuses[name] ||= { stacks: 0, secLeft: 0, perSec: 0 });

/** How many stacks of a debuff the Cap on its own stat allows. */
const stacksUnderCap = (name: MobStatusName): number => {
  const cfg = S[name];
  if (name === 'chill') return Math.max(1, Math.floor(cfg.aspd_cap / cfg.aspd_pct));
  if (name === 'shock') return 1; // `stacks: false`
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
): MobStatusName | null {
  const name = (E.elements.status_of as Record<string, string>)[element] as MobStatusName | undefined;
  if (!name) return null;
  if (rng() * 100 >= c.alignment) return null; // the Alignment gate
  if (rng() >= S.proc_chance) return null;
  return placeStatus(store, mobId, name, c, alignedPerHit);
}

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
): MobStatusName | null {
  const m = mark(store, mobId);
  m.alignedPerSec = Math.max(m.alignedPerSec, alignedPerHit);
  const l = line(m, name);
  const cfg = S[name];
  if (name === 'burn' || name === 'poison') {
    l.stacks = Math.min(stacksUnderCap(name), l.stacks + 1);
    l.perSec = alignedPerHit * cfg.k_dps;
    l.secLeft = name === 'burn' ? cfg.time_sec : MAX_STOP_SEC * 40; // poison only decays on its own clock
  } else if (name === 'mark') {
    l.stacks = Math.min(cfg.stack_max, l.stacks + 1);
    l.perSec = 0;
    l.secLeft = cfg.decay_sec;
  } else if (name === 'chill') {
    l.stacks = Math.min(stacksUnderCap(name), l.stacks + 1);
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
 * A stop that names its own length and no chance (Shield Bash's row says so), so it is not charged
 * against the 15% control budget — that bound is what proc-based stuns obey (combat.md §5b).
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
 * a landed stun stops the mob for `shock.stop_sec`, paid out of the same 15% control budget shock
 * obeys, so a gear stun can never lock a fight (combat.md §5b).
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
 * roll (0..1) — the axe's `Chance to bleed %` line plus Lacerate's proc (``), not a constant
 * read here, so the gear line actually moves the proc.
 */
export function applyBleed(
  rng: () => number,
  store: MobStatusStore,
  mobId: string,
  physicalPerHit: number,
  chance: number,
): boolean {
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

/** What all of a mob's lines do to the character's hits against it and to the mob's own clock. */
export interface MobStatusMods {
  aspdPct: number;
  accPct: number;
  armourCut: number;
  damageTakenPct: number;
  leechPct: number;
  stopped: boolean;
}

export function modsOn(store: MobStatusStore, mobId: string): MobStatusMods {
  const m = store[mobId];
  const out: MobStatusMods = { aspdPct: 0, accPct: 0, armourCut: 0, damageTakenPct: 0, leechPct: 0, stopped: false };
  if (!m) return out;
  const chill = m.statuses.chill;
  if (chill && chill.secLeft > 0) {
    out.aspdPct = -Math.min(S.chill.aspd_cap, chill.stacks * S.chill.aspd_pct);
    out.accPct = -Math.min(S.chill.acc_cap, chill.stacks * S.chill.acc_pct);
    out.armourCut = S.chill.armour_cut;
  }
  const shock = m.statuses.shock;
  if (shock && shock.secLeft > 0) {
    out.aspdPct = Math.max(out.aspdPct, -S.shock.aspd_cap) + (chill ? 0 : 0);
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
export interface DotTick { total: number; burn: number; poison: number; bleed: number }

export function stepMobParts(store: MobStatusStore, mobId: string): DotTick {
  const none = { total: 0, burn: 0, poison: 0, bleed: 0 };
  const m = store[mobId];
  if (!m) return none;
  m.elapsedSec++;
  // the control budget is a rolling share of the fight (≤15%), so a second of being alive pays back
  // 0.15 of a stopped second — otherwise one long fight could never be shocked again
  m.stoppedSec = Math.max(0, m.stoppedSec - CONTROL_BOUND);
  let burnDot = 0;
  let poisonDot = 0;
  let bleedDot = 0;
  for (const [name, l] of Object.entries(m.statuses) as [MobStatusName, MobLine][]) {
    if (name === 'poison') {
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
    l.secLeft--;
    if (l.secLeft <= 0) { delete m.statuses[name]; continue; }
    if (name === 'burn') burnDot += l.stacks * l.perSec;
    if (name === 'bleed') bleedDot += l.perSec;
  }
  // `elements.md` §6: the budget is burn + poison only, and bleed sits outside it on purpose — it is
  // physical, it does not stack, and its own budget is 0.70 of the hit that inflicted it over 5 sec.
  const budget = S.dot_cap * m.alignedPerSec;
  const elementDot = burnDot + poisonDot;
  const capped = S.dot_cap > 0 ? Math.min(elementDot, budget) : elementDot;
  const share = elementDot > 0 ? capped / elementDot : 0;
  // the record itself stays until the mob leaves the field, because the control budget lives on it
  if (!Object.keys(m.statuses).length) m.alignedPerSec = 0;
  return { total: capped + bleedDot, burn: burnDot * share, poison: poisonDot * share, bleed: bleedDot };
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
  };
}

export const statusLabel = (name: string): string =>
  ({ burn: 'burning', chill: 'chilled', shock: 'shocked', poison: 'poisoned', mark: 'marked', bleed: 'bleeding' }[name] || name);

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
  lacerateUp: boolean,
  bonusBleedPct = 0,
): void {
  const alignedPerSec = c.elem * (c.alignment / 100) * c.hitsPerSec;
  for (const el of Object.keys(c.elemByElement)) {
    if (el && (c.elemByElement as any)[el] > 0) applyElement(rng, store, mobId, el, c, alignedPerSec);
  }
  // a row of its own may add a bleed chance on the target it lands on (Puncture guarantees it), so the
  // press's own sentence reaches the same roll the gear and Lacerate feed
  const bleedPct = eng.bleedChanceFrom(lacerateUp, c.bleedChance + (bonusBleedPct || 0));
  if (c.phys > 0 && bleedPct > 0) applyBleed(rng, store, mobId, c.phys, bleedPct / 100);
  if (c.stunChance > 0) stunMob(rng, store, mobId, c.stunChance);
}
