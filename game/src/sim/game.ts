import { eng, E, sm, loot, TOWN, tree, dungeon as DG } from '../engine/client';
import { buildCharacter, emptyGear, SLOT_COUNT } from './player';
import { itemName } from './item-name';
import { playerSwing, mobSwing, rollStatus, poisonBurst, dotDamageParts, decayStatusStack, type Statuses, type StatusName } from './combat';
import { rollDrop } from './drop';
import { abandonRun, payoutStacks } from './dungeon';
import { selectDungeonRescue, type DungeonRescueEntry } from '../../../engine/dungeon-rescue.ts';
import { newAlchemyLedger } from '../../../engine/alchemy.ts';
import { canDissolve, dissolve } from './salvage';
import { depositMany, newTown, progressTasks, stashTabCount, tickTown, taskReward } from './town';
import { deliveryPauseReason, tickDeliveries } from './delivery';
import { tickBlackMarket } from './black-market';
import { STAT_KEYS, type StatKey } from '../engine/client';
import { chooseJunkItem, leanReweightMany } from '../../../engine/loot.ts';
import { newFarm, rollHerbs, rollPotion, maybeDrink, maybeFarm, farm, QUICKBAR_SLOTS } from './farm';
import { newFieldwork, tickFieldwork, tickHunger, resolveTravelEvent, recordHuntKill, withMeal, withHunger, pushToFieldCamp, finishPushAtCamp, lifeSkillBonuses } from './fieldwork';
import { road, walkZonesHex, arrive, ownerOf, zoneOf, startWalk } from './road';
import {
  driveAutoReturn, drivePatrol, finishAutoReturnDeposit, maybeStartAutoReturn,
  newAutoReturnState, newPatrolState, recordPatrolGroupClear,
} from './exploration';
import { weaponByName, masteryLevel, payMastery, dropMultiplier } from './mastery';
import { newPresets, switchPreset, autoSelect } from './presets';
import { newCollector, newGrants, wants, col } from './collector';
import { newFilter, ruleFor, coveredElements, refresh as refreshFilter } from './filter';
import { addTo, slotsFree } from './slots';
import { settlementOfZone, settlementById } from './town';
import { effectsActive, esAbsorbPct } from './skills';
import { mark as markSnapshot } from './snapshot';
import { newGoal, onSpawn as goalSpawn, onKill as goalKill, watch as goalWatch } from './goal';
import { newCurses, modsOn, applyCurse, tickCurses, combineMods, lineValue, modsFromAuraFold, spreadOnDeath } from './curse';
import {
  newMobStatusStore, applyWeaponRiders, stepMobParts, holdPoison, forgetDead as forgetMobStatus,
  modsOn as statusModsOn, targetMods, holdsCondition,
} from './mobStatus';
import {
  newSkillState, tickSkills, castOnce, paySkillXp, grantSkill, buffNeedsRecast, skillCd, usableMana, spendableMana, buffRuleUp,
  skillLevel, triggerAuras, type TriggerAura,
} from './skills';
import type { GameState, Mob, Item, FxEvent } from './types';
import { mulberry32, pick, intBetween } from '../engine/client-helpers';

const L = E.loot;
/** loot.md F7 publishes 4 bosses an hour; the clock is per character and online only. */
const BOSS_EVERY_SEC = Math.round(3600 / L.boss_per_hour);
const BAND_OF_QUALITY = (quality: string): string =>
  quality.startsWith('high') ? 'high' : quality.startsWith('mid') ? 'mid' : 'low';

/** combat.md §1 · engine.json mob.attack_clock_per_sec, capped by the one clock rule (caps.attack_interval_sec).
 *  A fast-clock lineage (`mob.trait_mechanics.fast_clock`) multiplies its own clock; the swing divides
 *  by the same number in `mobSwing`, so the faster body deals exactly its published damage per second. */
const MOB_CLOCK_FLOOR = E.mob.attack_clock_per_sec;
const MOB_CLOCK_CAP = 1 / E.caps.attack_interval_sec;
const mobClock = (kind: string, mult = 1) =>
  Math.min(((kind.startsWith('Boss') || kind.startsWith('Unique')) ? MOB_CLOCK_FLOOR.boss : MOB_CLOCK_FLOOR.normal) * mult, MOB_CLOCK_CAP);

/** the held weapon's base name, for the read that names what is in hand */
export function heldWeaponName(s: GameState): string | null {
  const main = s.gear.find((g) => g && !g.broken && g.slot === 'main hand');
  const w = main ? weaponByName(main.base) : null;
  return w ? w.name : null;
}

/** What the character carries besides gear: potions, condensed bottles and herbs all weigh. */
export function carried(s: GameState) {
  const bottles = Object.values(s.farm.potions).reduce((a: number, b: number) => a + b, 0);
  const condensed = Object.values(s.farm.condensed).reduce((a: number, b: number) => a + b, 0);
  const herbs = Object.values(s.farm.herbs).reduce((a: number, b: number) => a + b, 0);
  const materials = Object.values(s.fieldwork.materials).reduce((a: number, b: number) => a + b, 0);
  const food = Object.values(s.fieldwork.foods).reduce((a: number, b: number) => a + b, 0);
  // the kept pieces ride on the back: each weighs what its Base says, against the same capacity
  const bagWeight = s.bag.reduce((t, g) => t + (g?.weight || 0), 0);
  return { potions: bottles, condensed, herbs, materials, food, bagWeight };
}

/** A fresh character has spent no points: the sheet starts empty and grants on level-up. */
const ZERO_POINTS = (): Record<StatKey, number> =>
  Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<StatKey, number>;

/**
 * Spend banked points on the least-invested Core attributes — the REFERENCE allocation the published
 * numbers (and `mob_HP`) are priced against. Choosing by current totals carries the remainder across
 * 5-point level grants, instead of restarting at Strength and starving the last stats every level.
 */
export function spendReference(s: GameState): void {
  const p = s.player;
  while (p.statPoints > 0) {
    const next = STAT_KEYS.reduce((least, k) => p.points[k] < p.points[least] ? k : least, STAT_KEYS[0]);
    p.points[next]++;
    p.statPoints--;
  }
}

/**
 * Jump a headless character to `level` with exactly the stat points that level grants, spent evenly.
 * a level grants points rather than stats, so a test that assigns `.level` alone leaves
 * the character at its level-1 line; this is the test-facing form of the level-up path in `tick`.
 */
export function setLevel(s: GameState, level: number): void {
  s.player.level = level;
  const spent = STAT_KEYS.reduce((a, k) => a + s.player.points[k], 0);
  s.player.statPoints = Math.max(0, eng.pointsAt(level) - spent);
  // the same shortcut has to bank the tree points the level is worth, or a character placed at a level
  // holds none and the tree cannot be touched at all
  s.player.treePoints = Math.max(0, eng.treePointsAt(level) - tree.pointsSpent(s.player.treeRanks));
  spendReference(s);
}

export function newGame(seed = 20260101): GameState {
  const gear = emptyGear();
  const level = E.opening.level as number;
  const c = buildCharacter(level, gear, {}, 0, undefined, ZERO_POINTS());
  const start = road.nodeById(E.road.nodes[0].id) || E.road.nodes[0];
  const s: GameState = {
    seed,
    rngState: seed,
    player: {
      level,
      xp: 0,
      points: ZERO_POINTS(),
      statPoints: 0,
      autoSpend: true,
      // the level curve pays tree points from level one (`stat.tree_points_base`): a fresh
      // character starts with them in hand, the same number setLevel banks on the same level
      treePoints: eng.treePointsAt(level),
      treeRanks: {},
      hp: c.maxHp,
      mana: c.maxMana,
      es: c.es,
      esIdleSec: 0,
      atkTimer: 0,
    },
    gear,
    bag: [],
    stash: [],
    walk: null,
    // minute one stands on the starting settlement's own hex — rank 0, so it is safe ground
    cell: { q: start.q, r: start.r, sub: null, wild: null },
    patrol: newPatrolState(),
    autoReturn: newAutoReturnState(),
    skills: newSkillState(),
    quickbar: Array.from({ length: QUICKBAR_SLOTS }, () => null),
    healUp: null,
    junk: {},
    mastery: {},
    presets: newPresets(),
    activePreset: 0,
    collector: newCollector(),
    grants: newGrants(),
    pedlar: { day: 0, minutes: [], bought: 0 },
    filter: newFilter(),
    filterPresets: [],
    travel: 'stay',
    // minute one stands in town: safe ground fields no mobs until the character heads out
    hunting: false,
    autoDissolveLevel: 0,
    goal: newGoal(),
    curses: newCurses(),
    mobStatus: newMobStatusStore(),
    pendingSnapshot: null,
    nextSnapshotAt: 0,
    town: newTown(),
    farm: newFarm(),
    fieldwork: newFieldwork(),
    alchemy: newAlchemyLedger(E.salvage.alchemy.outputs_per_tier_stone),
    zone: E.opening.settlement_zone as number,
    group: [],
    phase: 'fighting',
    campSec: 0,
    spawnIn: 0,
    dungeon: null,
    counters: {
      kills: 0,
      zoneKills: {},
      pushes: 0,
      drops: 0,
      junk: 0,
      gold: E.opening.gold as number,
      stones: {},
      playSec: 0,
    },
    log: [],
    /** The transient event ring the HUD animates; a save writes an empty one. */
    fx: [],
    fxSeq: 0,
    clockSec: 0,
    lastSavedAt: Date.now(),
  };
  // minute one's instruction is the data's own first task (`engine.json` opening.first_rule`): an
  // Elite hunt in the opening zone, sized and paid by the board's own rule so nothing is typed twice
  const first = E.opening.first_rule;
  const zone = first ? (E.opening.settlement_zone as number) : 1;
  const openingPay = taskReward('elite', 'low');
  s.town.tasks[0] = {
    kind: 'elite',
    zone,
    n: TOWN.task_sizing.elite_n,
    progress: 0,
    stone: openingPay.stone as any,
    count: openingPay.count,
    claimed: false,
    offeredAt: 0,
  };
  refreshFilter(s);
  // the opening kit comes from the data: no worn gear, one draught per pool in the pocket
  for (const [name, count] of Object.entries(E.opening.potions as Record<string, number>)) s.farm.potions[name] = count;
  return s;
}

/** A mob at the player's level, clamped into the zone (engine.json mob.level_rule). */
// The species cast and the boss row per zone are fixed data, so index them once instead of filtering
// on every spawn (a spawn happens many times per tick through the offline catch-up).
const _speciesByZone = new Map<number, any[]>();
const speciesInZone = (zoneId: number): any[] => {
  let pool = _speciesByZone.get(zoneId);
  if (!pool) {
    pool = E.mob.species.filter((sp: any) => sp.zones.includes(zoneId)) as any[];
    _speciesByZone.set(zoneId, pool);
  }
  return pool;
};
const _bossByZone = new Map<number, any>();
const bossInZone = (zoneId: number): any => {
  if (!_bossByZone.has(zoneId)) _bossByZone.set(zoneId, E.mob.bosses.find((b: any) => b.zone === zoneId) || null);
  return _bossByZone.get(zoneId);
};

/** A boss-class kill: the clock Boss or a wild Species Unique. Both pay the boss lines. */
export const isBossKind = (k: string) => k.startsWith('Boss') || k.startsWith('Unique');
const _uniquesBySpecies = new Map<string, any[]>();
const uniquesInSpecies = (speciesId: string): any[] => {
  if (!_uniquesBySpecies.has(speciesId)) _uniquesBySpecies.set(speciesId, eng.uniquesOf(speciesId));
  return _uniquesBySpecies.get(speciesId)!;
};
/** One spawn's variant name pays its `mob.variant_drops` row: base junk item, rarity, lean. */
function variantDrop(mob: any): { item: string; rarity: string; lean: 'gear' | 'herb' | 'junk' | 'none' } | null {
  if (!mob || !mob.variant) return null;
  return (((E.mob as any).variant_drops || {})[mob.variant]) || null;
}

/**
 * The body a normal spawn takes: the side's pack odds (`mob.spawn_packs`) run over the bodies this
 * species can field. A species with one body takes it whatever the pack says, and a side with no pack
 * rolls the plain even mix — which is every body at equal odds, exactly what bare ground rolls.
 */
function pickBody(rng: () => number, bodies: string[], pack: Record<string, number> | null): string {
  const total = bodies.reduce((t, b) => t + ((pack || {})[b] || 0), 0);
  if (!pack || !(total > 0)) return pick(rng, bodies);
  let roll = rng() * total;
  for (const b of bodies) {
    roll -= (pack[b] || 0);
    if (roll < 0) return b;
  }
  return bodies[bodies.length - 1];
}

function spawnMob(rng: () => number, zoneId: number, kind: 'normal' | 'elite' | 'boss', bodyHint?: string, standSub?: number | null): Mob {
  const z = eng.zoneById(zoneId);
  const zonePool = speciesInZone(zoneId);
  // a sub-zone is what a spawn table rolls against: it names its own species pool and one Element from the
  // zone's set, and the cast a normal or Elite spawn draws from that pool (the boss is zone-level).
  // Standing on a cell that has a sub-zone written into it hunts that sub-zone; anywhere else the zone's
  // own cast rolls, evenly (`road.standing_rule`).
  const subs = z.subzones || [];
  const stood = standSub != null && subs[standSub] ? subs[standSub] : null;
  const sub = kind !== 'boss' && subs.length ? (stood || subs[Math.floor(rng() * subs.length)]) : null;
  const speciesPool = sub ? zonePool.filter((sp: any) => sub.species.includes(sp.id)) : zonePool;
  // Every normal/Elite reads its Species' authored level in this zone, including past the form cap.
  let rank: string = kind;
  let bossProfile: any = null;
  let body = 'medium';
  let species = pick(rng, speciesPool);
  let variant: { name: string; levels: [number, number]; core: Record<string, number>; damage?: 'physical' | 'magic' | 'mixed' } | null = null;
  let fixedName: string | null = null;
  const rollVariant = (sp: any) => pick(rng, eng.variantsInZone(sp.id, zoneId)) || null;
  if (bodyHint) {
    const able = speciesPool.filter((sp: any) => sp.sizes.includes(bodyHint));
    species = pick(rng, able.length ? able : speciesPool);
    body = bodyHint;
    variant = rollVariant(species);
  } else if (kind === 'boss') {
    const boss = bossInZone(zoneId)!;
    bossProfile = boss;
    species = E.mob.species.find((sp: any) => sp.id === boss.species)!;
    body = 'boss';
    fixedName = boss.name;
  } else if (kind === 'elite') {
    // an Elite is always forced to the Large body (engine.json mob.elite.note), and it keeps the
    // rolled variant's NAME — Elite is a rank over that variant, never a separate rung
    const large = speciesPool.filter((sp: any) => sp.sizes.includes('large'));
    species = pick(rng, large.length ? large : speciesPool);
    body = 'large';
    variant = rollVariant(species);
  } else {
    const groupable = speciesPool.filter((sp: any) => sp.sizes.includes('small') || sp.sizes.includes('medium'));
    species = pick(rng, groupable.length ? groupable : speciesPool);
    // the side's own body mix (`mob.spawn_packs`): a swarm side rolls Small twice as often as it rolls
    // Medium, a brute side the other way, and bare ground rolls the plain even mix it always rolled
    const pack = sub ? ((E.mob as any).spawn_packs?.[(sub.spawn || {}).pack || ''] || null) : null;
    body = pickBody(rng, species.sizes.filter((s: string) => s !== 'boss' && s !== 'large'), pack);
    variant = rollVariant(species);
    // A species may have no wild unique or several; choose only after its rare proc lands.
    const uniques = uniquesInSpecies(species.id);
    if (uniques.length && rng() < (E.loot.unique_chance || 0)) {
      rank = 'unique';
      bossProfile = uniques.length === 1 ? uniques[0] : pick(rng, uniques);
      body = 'boss';
      fixedName = bossProfile.name;
      variant = null;
    }
  }
  const top: [number, number] = [(z.levels as number[])[1], (z.levels as number[])[1]];
  const base = eng.spawnAt(zoneId, body, species.id, bossProfile,
    rank === 'unique' ? null : (variant ? variant.core : null),
    rank === 'unique' ? top[1] : null,
    rank === 'unique' ? null : variant?.damage);
  // The Species' authored zone level prices every normal/Elite spawn. Variant selects its Core,
  // damage type and drop identity; neither it nor the attacker changes that fixed level.
  const lv = base.level;
  const size = eng.sizeById(body)!;
  // body classes no longer scale HP: every mob of a species reads the same curve at its own level,
  // so the boss takes the same spawn shape any mob of its species takes
  const flat = eng.LG.hp_per_level * (lv - 1) + base.vit * eng.K.K_VIT_HP;
  const hp = rank === 'elite'
    ? (eng.mobHpAt(lv) + flat) * E.mob.elite.hp // the Elite multiplier rides the same curve the engine adds its flat terms to
    : base.hp;
  // the Elite swaps the Large body's own ps factor for its multiplier; the boss keeps the spawn
  // shape whole (the zone-mean divide included), exactly like any other body of its species
  const ps = rank === 'elite' ? base.ps / size.ps * E.mob.elite.ps : base.ps;
  // Normal and Elite spawns inherit the species Element; a Boss reads its own declared profile.
  const innate = base.innate;
  // the variant name is the drop table's key (`mob.variant_drops`): the rolled fixed-level variant
  // for normal and Elite alike — an Elite pays the junk of the variant it shows — and the fixed
  // boss/unique name for those ranks. Drawn last on purpose — every field above keeps the random
  // stream it had, so a variant is purely additive.
  const variantName = fixedName || (variant ? variant.name : species.name);
  return {
    id: `${zoneId}_${species.id}_${body}_${Math.floor(rng() * 1e9)}`,
    species: species.name,
    speciesId: species.id,
    formName: base.formName,
    variant: variantName,
    trait: base.trait,
    environment: sub?.environment,
    kind: rank === 'boss' ? `Boss · ${(bossInZone(zoneId) || { name: 'Boss' }).name}` : rank === 'unique' ? `Unique · ${fixedName}` : rank === 'elite' ? 'Elite' : size.name,
    zone: zoneId,
    level: lv,
    hp,
    hpMax: hp,
    ps,
    core: base.core,
    subzone: sub ? sub.name : undefined,
    readsAs: base.readsAs,
    acc: base.acc,
    evasion: kind === 'elite' ? eng.mobEvasion(base.core.dex, 'elite') : base.evasion,
    dodgeRate: base.dodgeRate,
    armour: base.armour,
    res: base.res,
    resByElement: base.resByElement,
    damage: base.damage,
    innate,
    xp: rank === 'elite' ? base.xp * E.xp.elite_mult : rank === 'boss' ? base.xp * E.xp.boss_mult : rank === 'unique' ? base.xp * E.xp.unique_mult : base.xp,
    line: species.line,
    immune: base.immune, weak: base.weak, burst: base.burst, mechanics: base.mechanics,
    hitsPerSec: mobClock(rank, base.clock_mult),
    atkTimer: 0,
    engageSec: 0,
  };
}

/**
 * A full bag is not a reason to lose a better piece: find the kept piece of the same slot with the
 * lowest score, and if the new one beats it, that one goes into the bag and the loser dissolves.
 * Returns false when the bag holds no piece for the slot, which is the real "go and equip" case.
 */
function swapWeakestKept(s: GameState, item: Item, score: number): boolean {
  let worst = -1;
  let worstScore = Infinity;
  s.bag.forEach((held, i) => {
    if (held.slot !== item.slot || held.heldFor || held.locked) return;
    const v = loot.score({ ...held, q: held.q ?? 0 });
    if (v < worstScore) { worstScore = v; worst = i; }
  });
  if (worst < 0 || !(score > worstScore)) return false;
  if (!canDissolve(s)) { s.counters.stopped = (s.counters.stopped || 0) + 1; return false; }
  s.bag[worst] = item;
  dissolve(s);
  push(s, `Bag swap · ${itemName(item)} (${item.slot}) in, ${worstScore.toFixed(2)}-score piece dissolved`);
  return true;
}

/** Stones route into the dungeon escrow while a run is open, and pay direct on open ground. */
function payStone(s: GameState, kind: string, n: number): void {
  if (s.dungeon) {
    const e = s.dungeon.escrow.stones;
    e[kind] = (e[kind] || 0) + n;
  } else addTo(s, s.counters.stones, kind, 'stone', n);
}

/** One imprint stone's purse key, uniform over the Mod roster. */
function imprintDrop(rng: () => number): string {
  const ids = Object.keys(loot.BANDS_OF);
  return 'imprint_' + ids[Math.floor(rng() * ids.length)];
}

/** Move this kill's herb and potion pickups into the run's escrow, leaving the bags as they were. */
function escrowProvisions(s: GameState, herbHad: Record<string, number>, potionHad: Record<string, number>): void {
  const run = s.dungeon!;
  for (const [k, v] of Object.entries(s.farm.herbs)) {
    const d = v - (herbHad[k] || 0);
    if (d > 0) {
      run.escrow.herbs[k] = (run.escrow.herbs[k] || 0) + d;
      if (herbHad[k]) s.farm.herbs[k] = herbHad[k];
      else delete s.farm.herbs[k];
    }
  }
  for (const [k, v] of Object.entries(s.farm.potions)) {
    const d = v - (potionHad[k] || 0);
    if (d > 0) {
      run.escrow.potions[k] = (run.escrow.potions[k] || 0) + d;
      if (potionHad[k]) s.farm.potions[k] = potionHad[k];
      else delete s.farm.potions[k];
    }
  }
}

/**
 * The player's own dissolve, on the one piece they picked: the same resource bundle (ore + Scrap) the
 * bag filter pays for a rejected drop, so a hand-salvage and an auto-dissolve can never disagree about
 * what a piece is worth. The two pieces the bulk verbs already spare — a locked one and one promised
 * to a Collector set — are refused here too, with the reason said out loud.
 */
export function salvageBag(s: GameState, bagIndex: number): { ok: boolean; why?: string } {
  const item = s.bag[bagIndex];
  if (!item) return { ok: false, why: 'nothing in that bag slot' };
  if (item.locked) return { ok: false, why: 'that piece is locked' };
  if (item.heldFor) return { ok: false, why: 'that piece is promised to a Collector set' };
  if (!canDissolve(s)) return { ok: false, why: 'make room in the bag for the whole salvage resource bundle' };
  s.bag.splice(bagIndex, 1);
  dissolve(s);
  push(s, `Salvaged ${itemName(item)} → ${Object.entries(E.salvage.outputs).map(([key, count]) => `${count} ${key}`).join(' + ')}`);
  return { ok: true };
}

/**
 * One press runs the bag filter over what is already carried: every unlocked, unheld piece that fails
 * the same verdict a fresh drop gets dissolves for its salvage bundle, and the players the bulk verbs
 * spare — a locked one and one promised to a Collector set — are counted, not moved. Half a job is
 * refused rather than begun when the next bundle would not fit: a partial salvage would hide a rule.
 */
export function runFilterNow(s: GameState): { dissolved: number; spared: number; why?: string } {
  let dissolved = 0;
  let spared = 0;
  for (let i = s.bag.length - 1; i >= 0; i--) {
    const item = s.bag[i];
    if (!item) continue;
    if (item.locked || item.heldFor) { spared++; continue; }
    if (filterVerdict(s, item).verdict.keep) continue;
    if (!canDissolve(s)) {
      push(s, `Filter run stopped — the bag cannot take the next salvage bundle (${dissolved} melted so far)`);
      return { dissolved, spared, why: 'the bag cannot take the next salvage bundle' };
    }
    s.bag.splice(i, 1);
    dissolve(s);
    dissolved++;
  }
  if (dissolved) push(s, `Filter run melted ${dissolved} carried piece${dissolved === 1 ? '' : 's'} into ore and Scrap${spared ? ` · ${spared} left alone` : ''}`);
  return { dissolved, spared };
}

/**
 * One gear roll through the bag filter. A mob kill — on foot or in an ambush — and any future item
 * source use this same path, so "what the filter keeps" can never mean two different things.
 */
function awardDrop(s: GameState, rng: () => number, band: string, ilvl: number, weaponAspd: number): void {
  const item = rollDrop(rng, band, ilvl, weaponAspd);
  s.counters.drops++;
  adjudicateDrop(s, item);
}

/**
 * The one filter verdict, shared by the drop path and the bag's own run-the-filter verb, so "what the
 * filter would do" has one reader and a bulk press can never disagree with a fresh drop.
 */
export function filterVerdict(s: GameState, item: Item) {
  const worn = s.gear.filter((g): g is Item => g !== null && g.slot === item.slot);
  const slotCount = loot.SLOTS.filter((slot: string) => slot === item.slot).length;
  const wornScore = worn.length < slotCount ? undefined
    : Math.min(...worn.map((g) => loot.score({ ...g, q: g.q ?? 0 })));
  const score = loot.score({ ...item, q: item.q ?? 0 });
  // the filter is OFF by default: a slot the player has not turned on keeps every drop
  // and dissolves nothing, so the player opts in per slot before a piece is ever thrown away.
  // Only an enabled slot runs the published rule — a piece that fails it dissolves for the salvage
  // resource bundle when the whole bundle fits (always kept), never for gold (`loot.md` §4).
  const rule = ruleFor(s.filter, item.slot);
  const verdict = rule.enabled
    ? loot.keepsDrop(
      { ...item, q: item.q ?? 0 }, wornScore, coveredElements(s),
      L.filter.upgrade_margin_pct / 100, rule,
    )
    : { keep: true, reason: 'filter off', score };
  return { wornScore, score, verdict };
}

/**
 * One rolled piece through the bag filter. A mob kill — on foot, in an ambush or paid out of a
 * dungeon escrow — and any future item source use this same path, so "what the filter keeps" can
 * never mean two different things.
 */
export function adjudicateDrop(s: GameState, item: Item): void {
  // the bag filter keeps a drop only when it outscores the piece worn in that slot by more than
  // noise; anything else dissolves for the salvage resource bundle, never for gold (loot.md §4)
  // A waiting piece contributes no power. For rings, an empty cell is free and a full pair compares
  // against its weaker member — the same cell Auto Equip would replace.
  const { wornScore, score, verdict } = filterVerdict(s, item);
  // An upgrade is for the character first. Collector reservations catch pieces that fail to improve
  // the worn cell, before a filter can dissolve them for a stone.
  const set = wornScore !== undefined && score <= wornScore ? wants(s, item) : null;
  // a client auto-dissolve floor, read on the item's own level: salvage resources only, never gold
  // (the two mints are untouched by AGENT §5). A set-wanted or player-locked piece is spared; the
  // collector runs first.
  const belowFloor = (s.autoDissolveLevel || 0) > 0 && !item.locked && item.ilvl < (s.autoDissolveLevel || 0);
  if (set) {
    // the Collector sink runs before the filter dissolves a piece the set wants
    if (slotsFree(s) >= 1) {
      item.heldFor = set.id;
      s.bag.unshift(item);
      push(s, `Held for the ${set.name} set · ${itemName(item)} (${item.slot})`);
    } else {
      // a full bag picks up nothing and deletes nothing — the hold waits like any other pickup
      s.counters.overflow = (s.counters.overflow || 0) + 1;
    }
  } else if (belowFloor && !item.heldFor) {
    dissolve(s);
  } else if (verdict.keep || item.locked || item.heldFor) {
    // The sim keeps the piece; the client's Auto Equip setting decides whether it is worn now.
    if (slotsFree(s) >= 1) {
      s.bag.unshift(item);
      push(s, `Drop kept (${verdict.reason}): level ${item.ilvl} ${item.quality} ${item.tier} ${itemName(item)} (${item.slot})`);
    } else if (verdict.reason === 'upgrade' && swapWeakestKept(s, item, verdict.score)) {
      // the bag keeps the best decision per slot instead of the first arrivals: a piece that beat the
      // bar replaces the piece it beat, and the loser dissolves for its salvage resources when they
      // fit. The character still wears nothing it was not told to wear (owner ruling).
    } else {
      // overflow is stop_pickup: a full bag picks up nothing and deletes nothing
      s.counters.overflow = (s.counters.overflow || 0) + 1;
    }
  } else {
    dissolve(s);
  }
}

function onKill(s: GameState, rng: () => number, mob: Mob, c: ReturnType<typeof buildCharacter>, statuses: Statuses = {}) {
  const online = s.online !== false;
  // the lines this mob was carrying jump to the neighbours its row names 
  const caught = spreadOnDeath(s.curses, mob.id, s.group.map((m) => m.id));
  if (caught) push(s, `the curse spreads to ${caught} nearby`);
  // a bursting body pays its poison as it goes (`mob.trait_mechanics.poison_burst`) — a guaranteed
  // line, not a proc, and the one answer to it is the fighter's own status immunity
  if (mob.burst?.ps_pct && !buffRuleUp(s.skills, 'status_immunity')) {
    if (poisonBurst(mob, statuses, mob.burst.ps_pct)) {
      if (online) push(s, `${mob.species} bursts — poison`);
      fx(s, { kind: 'proc', side: 'self', text: 'poison', colour: statusColour('poison') });
    }
  }
  s.counters.kills++;
  // the feed names pay, not kills: every kill online banks its XP as its own line, so the chronicle ticks
  // with the fight itself. Offline the away summary owns the read.
  if (online) push(s, `+${mob.xp} XP`);
  // the kill flash wears the mob's own innate Element, the same one its resistance answered with. It names
  // the body too: the word still reads in the shared column, and the id is what lets the card it died on
  // show the blow that ended it before it goes.
  fx(s, { kind: 'kill', side: 'field', mobId: mob.id, text: mob.species, colour: hitColour(mob.innate?.[0] || null), value: online ? mob.xp : 0 });
  s.counters.zoneKills[mob.zone] = (s.counters.zoneKills[mob.zone] || 0) + 1;
  s.player.xp += mob.xp;
  while (s.player.level < E.stat.level_cap && s.player.xp >= eng.xpToNext(s.player.level)) {
    s.player.xp -= eng.xpToNext(s.player.level);
    s.player.level++;
    const per = s.player.level >= E.stat.paragon_from ? E.stat.paragon_points_per_level : E.stat.points_per_level;
    s.player.statPoints += per;
    s.player.treePoints += E.stat.tree_points_per_level;
    push(s, `Level ${s.player.level} — +${per} stat points, +${E.stat.tree_points_per_level} tree point${E.stat.tree_points_per_level === 1 ? '' : 's'}`);
    // the one beat the whole frame is allowed to take: the level is the reason the character is here, so it
    // wears the HUD's own accent rather than an Element, and it is raised on the character's half
    fx(s, { kind: 'level', side: 'self', text: `Level ${s.player.level}`, colour: hitColour(null, true) });
    markSnapshot(s, 'level');
  }
  const band = BAND_OF_QUALITY(eng.zoneById(mob.zone).quality);
  paySkillXp(s.skills);
  payMastery(s, heldWeaponName(s)); // 4 XP per kill to the weapon actually held
  // a skill piece is its own drop stream (engine.json skill_drop)
  const skillRate = mob.kind.startsWith('Boss') ? E.skill_drop.boss
    : mob.kind.startsWith('Unique') ? E.skill_drop.unique
    : mob.kind === 'Elite' ? E.skill_drop.elite : E.skill_drop.normal;
  if (rng() < skillRate) {
    const g = grantSkill(s.skills, rng);
    if (g) push(s, g.duplicate
      ? `Duplicate ${sm.byId[g.id].name} → that skill's own ladder`
      : `Skill drop: ${sm.byId[g.id].name} (${sm.byId[g.id].type})`);
  }
  // Mastery adds quantity the same way Lck does, and only a twelfth as strongly (equipment-weapon.md)
  // offline results are AFK: same drops, but the piece is rolled at the floor level of its band
  const ilvl = online ? Math.max(1, Math.round(mob.level)) : eng.floorLevelOf(band);
  // The variant lean runs first, then the subzone environment lean. Each shift renormalizes the same
  // gear/herb/junk total, so a local tilt changes the mix without changing expected drops per kill.
  const vdrop = variantDrop(mob);
  const order = (vdrop ? vdrop.lean : 'none') as 'none' | 'gear' | 'herb' | 'junk';
  const environmentLean = ((E.mob as any).environment_lean || {})[mob.environment || ''] || 'none';
  const junkRows = Object.entries(E.junk.rarities as Record<string, any>);
  const pJunkBase = junkRows.reduce((a, [, r]: any) => a + r.drop_chance_per_kill, 0);
  const hw = leanReweightMany({
    gear: Math.min(1, eng.dropChance(band) * dropMultiplier(s)),
    herb: farm.herbChance(band),
    junk: pJunkBase,
  }, [order, environmentLean], E.loot.variant_lean.shift_pct);
  if (rng() < hw.gear) {
    const carriesWeapon = E.mob.species.find((species: any) => species.id === mob.speciesId)?.carries_weapon ?? true;
    const item = rollDrop(rng, band, ilvl, c.weaponAspd, carriesWeapon);
    s.counters.drops++;
    // a run escrows the roll itself: the one filter path judges it when the run pays out
    if (s.dungeon) s.dungeon.escrow.items.push(item);
    else {
      adjudicateDrop(s, item);
      fx(s, { kind: 'drop', side: 'field', text: `${item.quality} ${itemName(item)}`, colour: hitColour(null) });
    }
  }
  const junkScale = pJunkBase > 0 ? hw.junk / pJunkBase : 1;
  // Junk is a gold mint, not a gold drip. Only the Variant's rarity rolls, and its Species alternative
  // has the same sale value. Reuse the successful rarity roll to choose the item, so this stream still
  // consumes exactly one draw per rarity and every later roll in the tick keeps its prior sequence.
  if (vdrop) {
    const speciesItems = E.mob.species.find((species: any) => species.id === mob.speciesId)?.junk_items || {};
    for (const [rarity, r] of junkRows) {
      const pays = rarity === vdrop.rarity;
      const chance = pays ? r.drop_chance_per_kill * junkScale : 0;
      const roll = rng();
      // junk occupies a slot like any other carried stack; a bag full of it stops the pickup
      if (roll < chance) {
        const item = chooseJunkItem(() => roll / chance, vdrop.item, rarity, speciesItems);
        if (s.dungeon) {
          const e = s.dungeon.escrow.junk;
          e[item] = (e[item] || 0) + 1;
        } else if (addTo(s, s.junk, item, 'stone', 1)) s.counters.junk++;
      }
    }
  }
  progressTasks(s, mob.kind, mob.zone, mob.speciesId, s.walk ? null : s.cell?.sub ?? null);
  // a run escrows provisioning: herbs and potions write only here, so the delta is exact
  const herbHad = s.dungeon ? { ...s.farm.herbs } : null;
  const potionHad = s.dungeon ? { ...s.farm.potions } : null;
  rollHerbs(s, rng, band, band, hw.herb);
  // Potion eligibility is an explicit species permission, independent of its Family.
  const potionSource = !!E.mob.species.find((sp: any) => sp.id === (mob as any).speciesId)?.potion_source;
  if (potionSource && rollPotion(s, rng, band, true)) push(s, `A potion drops`);
  if (s.dungeon && herbHad && potionHad) escrowProvisions(s, herbHad, potionHad);
  if (mob.kind === 'Elite' || mob.kind.startsWith('Unique')) {
    // the elite stone lines in engine.json are expected values per kill, so the roll keeps them whole;
    // a wild unique pays these same lines (its jackpot is XP and its crown, never boss stones)
    if (rng() < L.elite_tier_stones) payStone(s, 'tier', 1);
    if (rng() < L.elite_add_stone_chance) payStone(s, 'add', 1);
    // an imprint stone carries one Mod line's own identity, uniform over the roster
    if (rng() < L.imprint_stone_sources.elite_imprint_chance) payStone(s, imprintDrop(rng), 1);
    if (rng() < L.quality_stone_sources.elite_quality_chance) payStone(s, 'quality', 1);
    if (rng() < L.repair_stone_sources.elite_repair_chance) payStone(s, 'repair', 1);
    // one draw pays both swap stones: Polish sits inside Replace's chance (the data gates it one step
    // tighter), so reading the same number twice keeps the two lines from drifting and the tick at one draw
    const eliteSwap = rng();
    if (eliteSwap < L.replace_stone_sources.elite_replace_chance) {
      payStone(s, 'replace', 1);
      fx(s, { kind: 'drop', side: 'field', text: 'Replace stone', colour: hitColour(null) });
    }
    if (eliteSwap < L.polish_stone_sources.elite_polish_chance) payStone(s, 'polish', 1);
  }
  // Quality stone comes from every kill, but the ladder's cheap steps are the only part a mob pays
  if (rng() < L.quality_stone_sources.monster_quality_chance) payStone(s, 'quality', 1);
  if (mob.kind.startsWith('Boss')) {
    payStone(s, 'tier', L.boss_tier_stones);
    payStone(s, 'add', L.boss_add_stones);
    for (let i = 0; i < L.imprint_stone_sources.boss_imprint_stones; i++) payStone(s, imprintDrop(rng), 1);
    payStone(s, 'quality', L.quality_stone_sources.boss_quality_stones);
    payStone(s, 'repair', L.repair_stone_sources.boss_repair_stones);
    const bossGamble = rng();
    if (bossGamble < L.corrupt_stone_sources.boss_corrupt_chance) payStone(s, 'corrupt', 1);
    // Reforge is Corrupt's safer cousin on half the same chance, so it reads that one draw
    if (bossGamble < L.reforge_stone_sources.boss_reforge_chance) payStone(s, 'reforge', 1);
    // Rebirth sits inside the same draw again: Corrupt 0.25 ⊃ Reforge 0.125 ⊃ Rebirth 0.0625
    if (bossGamble < L.rebirth_stone_sources.boss_rebirth_chance) {
      payStone(s, 'rebirth', L.rebirth_stone_sources.boss_rebirth_stones);
    }
    const bossSwap = rng();
    if (bossSwap < L.replace_stone_sources.boss_replace_chance) {
      payStone(s, 'replace', 1);
      fx(s, { kind: 'drop', side: 'field', text: 'Replace stone', colour: hitColour(null) });
    }
    // Polish keeps Replace's Boss half, so the same draw pays it and only the count is the data's
    if (bossSwap < L.polish_stone_sources.boss_polish_chance) {
      payStone(s, 'polish', L.polish_stone_sources.boss_polish_stones);
    }
    if (goalKill(s, mob)) {
      push(s, `Gate met — ${mob.kind.replace('Boss · ', '')} killed in one spawn, no Push, at ${Math.round(s.clockSec / 60)} min of play · level ${s.player.level}`);
    }
  }
  const fieldDrop = recordHuntKill(s, mob.speciesId || '', rng);
  if (fieldDrop) push(s, `Hunting · ${fieldDrop}`);
  // the run ends on its last mob: the escrow pays out and the dungeon cools down
  if (s.dungeon) {
    s.dungeon.left--;
    if (s.dungeon.left <= 0) completeDungeonRun(s);
  }
}

/**
 * The run's last mob: stacks merge through the ordinary pickup rule, gear rolls go through the
 * one filter path, and the dungeon cools down from this clock second.
 */
function completeDungeonRun(s: GameState): void {
  const run = s.dungeon!;
  s.dungeon = null;
  const paid = payoutStacks(s, run);
  s.group = [];
  s.curses = newCurses();
  s.mobStatus = newMobStatusStore();
  s.spawnIn = 0;
  let gear = 0;
  for (const item of run.escrow.items) {
    adjudicateDrop(s, item);
    fx(s, { kind: 'drop', side: 'field', text: `${item.quality} ${itemName(item)}`, colour: hitColour(null) });
    gear++;
  }
  s.dungeonClearedAt = s.clockSec;
  push(s, `Dungeon cleared — ${run.total} mobs · escrow paid: ${gear} gear, ${paid.junk} junk, ${paid.stones} stones, ${paid.herbs} herbs, ${paid.potions} potions · cooling down ${E.dungeon.cooldown_sec}s`);
}

/** Retreat selects saved loot once, then uses the same pickup/filter rules as a clear. */
export function retreatDungeon(s: GameState, access: { writer: boolean } = { writer: true }): {
  ok: boolean; why?: string; selected?: number; received?: number; rejected?: number;
} {
  if (!access.writer) return { ok: false, why: 'this tab is read-only' };
  const run = s.dungeon;
  if (!run) return { ok: false, why: 'no active dungeon run' };
  const entries: DungeonRescueEntry<Item>[] = run.escrow.items.map((item, index) => ({ bucket: 'items', key: String(index).padStart(16, '0'), count: 1, stackSize: 1, item }));
  for (const bucket of ['junk', 'stones', 'herbs', 'potions', 'materials'] as const) {
    const cap = E.inventory.stack_size[bucket === 'junk' || bucket === 'stones' ? 'stone' : bucket === 'herbs' ? 'herb' : bucket === 'materials' ? 'material' : 'potion'];
    for (const [key, count] of Object.entries(run.escrow[bucket] || {})) entries.push({ bucket, key, count, stackSize: cap });
  }
  const rng = mulberry32(s.rngState);
  let draws = 0;
  let selected: DungeonRescueEntry<Item>[];
  try {
    selected = selectDungeonRescue(entries, { min: E.dungeon.retreat_keep_min, max: E.dungeon.retreat_keep_max }, () => { draws++; return rng(); });
  } catch { return { ok: false, why: 'invalid dungeon escrow or rescue configuration' }; }
  if (draws) s.rngState++;
  s.dungeon = null;
  s.group = [];
  s.curses = newCurses();
  s.mobStatus = newMobStatusStore();
  s.spawnIn = 0;
  s.hunting = false;
  s.dungeonClearedAt = s.clockSec;
  let received = 0, total = 0;
  for (const entry of selected) {
    total += entry.count;
    if (entry.bucket === 'items') {
      const bagBefore = s.bag.length, salvageBefore = s.counters.salvaged || 0;
      adjudicateDrop(s, entry.item!);
      if (s.bag.includes(entry.item!) || s.bag.length > bagBefore || (s.counters.salvaged || 0) > salvageBefore) received++;
    } else {
      const bucket = entry.bucket === 'junk' ? s.junk : entry.bucket === 'stones' ? s.counters.stones : entry.bucket === 'herbs' ? s.farm.herbs : entry.bucket === 'materials' ? s.fieldwork.materials : s.farm.potions;
      const got = addTo(s, bucket, entry.key, entry.bucket === 'junk' || entry.bucket === 'stones' ? 'stone' : entry.bucket === 'herbs' ? 'herb' : entry.bucket === 'materials' ? 'material' : 'potion', entry.count);
      if (entry.bucket === 'junk') s.counters.junk += got;
      received += got;
    }
  }
  const rejected = total - received;
  push(s, `Dungeon Retreat — selected ${selected.length} stacks (${total} units), received ${received}, capacity-rejected ${rejected}; the rest forfeited · cooling down ${E.dungeon.cooldown_sec}s`);
  return { ok: true, selected: total, received, rejected };
}

/**
 * An encounter on a block: a real mob group from the lower of the two zones the walk joins, at that
 * zone's own group size and the ordinary drop roll. It pays exactly what a kill pays and nothing
 * else — no purse, no chest, no Standing (`engine.json` road `encounter_rule`). A walk that ends on a
 * sub-zone side is ambushed by that side's own pack, the same pack the feet would hunt.
 */
function spawnWalkEncounter(s: GameState, rng: () => number) {
  const walk = s.walk!;
  const { lower } = walkZonesHex(walk.from, walk.to);
  const z = eng.zoneById(lower);
  const [lo, hi] = eng.groupRangeOf(lower, walk.sub);
  const size = Math.max(1, Math.round(lo + rng() * ((hi || lo || 1) - (lo || 1))));
  const mobs: any[] = [];
  for (let i = 0; i < size; i++) mobs.push(spawnMob(rng, lower, 'normal', undefined, walk.sub));
  s.group = mobs;
  push(s, `Ambushed on block ${walk.blocksWalked + 1} of ${walk.blocksTotal} · ${size} in ${z.name}`);
}

export function push(s: GameState, text: string) {
  s.log.unshift({ sec: s.clockSec, text });
  if (s.log.length > 60) s.log.length = 60;
}

function runExplorationAutomation(s: GameState, online: boolean, wasPatrolling = s.patrol.active) {
  const triggered = maybeStartAutoReturn(s, online, wasPatrolling);
  if (triggered) push(s, triggered);
  const automatic = driveAutoReturn(s, online);
  if (automatic.message) push(s, automatic.message);
  if (automatic.deposit) {
    s.hunting = false;
    const moved = stashTabCount(s) > 0 ? depositMany(s, s.bag.map((_, i) => i), 0) : 0;
    push(s, finishAutoReturnDeposit(s, moved));
    const resume = driveAutoReturn(s, online);
    if (resume.message) push(s, resume.message);
  }
  if (s.autoReturn.phase === 'idle') {
    const patrol = drivePatrol(s, online);
    if (patrol) push(s, patrol);
  }
}

/**
 * Head out to hunt a zone on foot from the map: safe ground ends where the hunt begins. Only a
 * settlement already opened may be hunted in — anything else is still a walk away.
 */
export function huntZone(s: GameState, id: number): { ok: boolean; why?: string } {
  const town = settlementOfZone(id);
  if (!town || !s.town.visited.includes(town.id)) return { ok: false, why: 'not opened yet' };
  const node = road.nodeById(town.id);
  if (node) s.cell = { q: node.q, r: node.r, sub: null, wild: null };
  s.zone = id;
  s.group = [];
  s.fieldwork.action = null;
  s.player.atkTimer = 0;
  s.hunting = true;
  return { ok: true };
}

/**
 * Head out onto the cell the feet are already on and hunt there: a sub-zone side hunts that side's
 * cast, and ground with no side named rolls the zone whole (`road.standing_rule`). Safe ground ends
 * where the hunt begins.
 */
export function huntHere(s: GameState): { ok: boolean; why?: string } {
  if (s.walk) return { ok: false, why: 'mid-walk' };
  if (!s.cell) return { ok: false, why: 'nowhere to stand' };
  if (road.cellRank(s.cell) === 0) {
    const town = settlementById(ownerOf(s.cell).id);
    if (!town || !s.town.visited.includes(town.id)) return { ok: false, why: 'not opened yet' };
  }
  s.zone = zoneOf(s.cell) ?? s.zone;
  s.group = [];
  s.fieldwork.action = null;
  s.player.atkTimer = 0;
  s.hunting = true;
  return { ok: true };
}

/** How many events the HUD ring keeps — enough to read a fight by, small enough to never grow. */
const FX_RING = 24;

/**
 * One event handed to the screen. A log line is for reading later; this is for animating now, and it
 * carries the number and the colour, which a total (`counters.damageBy`) and a sentence both lose.
 */
export function fx(s: GameState, ev: { kind: FxEvent['kind']; text: string; colour: string; crit?: boolean; side?: FxEvent['side']; mobId?: FxEvent['mobId']; byId?: FxEvent['byId']; via?: FxEvent['via']; skillId?: FxEvent['skillId']; value?: FxEvent['value'] }) {
  s.fx = s.fx || [];
  s.fxSeq = (s.fxSeq || 0) + 1;
  s.fx.unshift({ id: s.fxSeq, sec: s.clockSec, ...ev });
  if (s.fx.length > FX_RING) s.fx.length = FX_RING;
}

/**
 * The indicator's colour for one hit: a crit first, then the Element that carried it, then neutral.
 * A missing data colour falls to `var(--text)`, so the client's own token stays the only neutral.
 */
export function hitColour(element: string | null | undefined, crit = false): string {
  const C = E.elements as any;
  if (crit) return C.crit_colour || 'var(--text)';
  if (element && C.colour?.[element]) return C.colour[element];
  return C.physical_colour || 'var(--text)';
}

/**
 * The colour a status takes — the colour of the Element that inflicts it, read through
 * `elements.status_of`, so a proc never owns a second copy of a colour. The cold proc is `chill`, and
 * `chill` is the game's freeze: the ice colour is the same one either word reads.
 */
export function statusColour(status: string): string {
  const C = E.elements as any;
  const el = Object.keys(C.status_of || {}).find((k) => C.status_of[k] === status);
  return (el && C.colour?.[el]) || C.physical_colour || 'var(--text)';
}

/**
 * The status that carried a DoT tick, so the number has one colour to wear. A tie goes to the
 * Element line over the physical one, which is the same order the budget is written in.
 */
function dotLead(parts: { burn: number; poison: number; bleed: number }): string {
  return parts.burn >= parts.poison && parts.burn >= parts.bleed ? 'burn'
    : parts.poison >= parts.bleed ? 'poison' : 'bleed';
}

/**
 * One credit of damage dealt, sorted by what dealt it. The total is what the tests divide by time;
 * the split is what answers whether a build's damage comes from its hits or from the statuses those
 * hits leave behind (`concept.md` P0-2).
 */
export function credit(s: GameState, kind: 'swing' | 'cast' | 'dot', amount: number) {
  if (!(amount > 0)) return;
  s.counters.damage = (s.counters.damage || 0) + amount;
  const by = s.counters.damageBy || (s.counters.damageBy = { swing: 0, cast: 0, dot: 0 });
  by[kind] += amount;
}

/** One second of the world. Fixed tick, every unit on its own timer (combat.md §1). */
export function tick(s: GameState, statuses: Statuses = {}, opts: { online?: boolean; autoSkills?: boolean; writer?: boolean } = {}): GameState {
  if (opts.writer === false) return s;
  const pausedAtStart = !!deliveryPauseReason(s);
  const rng = mulberry32(s.rngState++);
  const result = tickWorld(s, statuses, opts, rng);
  tickDeliveries(result, rng, opts.online !== false, pausedAtStart, { writer: true });
  tickBlackMarket(result, rng, { writer: true }, opts.online !== false);
  return result;
}

function tickWorld(s: GameState, statuses: Statuses, opts: { online?: boolean; autoSkills?: boolean }, rng: () => number): GameState {
  const online = opts.online !== false;
  const autoSkills = opts.autoSkills !== false;
  s.online = online;
  s.clockSec++;
  s.counters.playSec++;
  const foodNote = tickHunger(s, online);
  if (foodNote) push(s, foodNote);
  // the active-skill effect fold changes only on cast/toggle, so compute it once per tick and reuse
  // it for the character sheet and the per-mob aura lines (previously folded again on every swing)
  // the idle default spends this tick's level points before the pool is clamped, so the sheet the
  // pool is read against already includes them; manual players bank and spend by hand.
  if (s.player.autoSpend && s.player.statPoints > 0) spendReference(s);
  const effects = effectsActive(s.skills);
  const c = withHunger(withMeal(buildCharacter(s.player.level, s.gear, carried(s), masteryLevel(s, heldWeaponName(s)), effects, s.player.points, s.player.treeRanks, lifeSkillBonuses(s)), s), s);
  // a pool is bounded by what it is: never below nothing, never above what the sheet says it holds.
  // The bars read these straight, so an unbounded value here is what shows as a negative number there.
  s.player.mana = Math.min(Math.max(0, s.player.mana), c.maxMana);
  s.player.es = Math.min(Math.max(0, s.player.es), c.es);
  const day = dayOf(s.clockSec);
  if (s.pedlar.day !== day || !s.pedlar.minutes.length) {
    s.pedlar = {
      day,
      bought: 0,
      minutes: Array.from({ length: col.PEDLAR.per_day_cap }, () => col.pedlarPrice(rng())),
    };
  }
  // Forward Mode follows the opened chapter ladder on foot. A newly discovered settlement still
  // needs the player's first walk; known chapters become an online walk when the current band is behind.
  // A Push returns to the last zone held and blocks re-entry until a level is gained against it.
  if (s.travel === 'forward' && !s.dungeon && !s.walk && !s.patrol.active && s.autoReturn.phase === 'idle') {
    const here = eng.zoneById(s.zone);
    if (s.player.level > here.levels[1]) {
      const next = eng.ZONES.find((z: any) => z.id > here.id
        && s.town.visited.includes(settlementOfZone(z.id)?.id || ''));
      const blocked = next && next.id === s.forwardBlockedZone
        && s.player.level <= (s.forwardBlockedLevel ?? 0);
      if (next && !blocked) {
        const there = road.nodeById(settlementOfZone(next.id)?.id || '');
        if (there) {
          const walk = startWalk(s, { q: there.q, r: there.r, sub: null, wild: null });
          if (walk.ok) {
            s.forwardSafe = here.id; // the zone just left is the floor a Push falls back to
            push(s, `Walking to ${next.name} (levels ${next.levels.join('-')})`);
          }
        }
      }
    }
  }
  if (s.lastAutoZone !== s.zone) {
    // the game picks the set bound to the zone on its own (`skill-pool.md` Preset)
    s.lastAutoZone = s.zone;
    autoSelect(s, s.zone);
  }
  tickTown(s, rng);
  runExplorationAutomation(s, online);

  if (s.phase === 'camp') {
    s.campSec--;
    s.player.hp = Math.min(c.maxHp, s.player.hp + c.hpRegen * 8);
    if (s.campSec <= 0) {
      if (finishPushAtCamp(s)) push(s, `Recovered at your field Camp in ${eng.zoneById(s.zone).name}`);
      else {
        s.phase = 'fighting';
        push(s, `Back in ${eng.zoneById(s.zone).name} — the walk-back costs no items and no XP`);
      }
    }
    return s;
  }

  // While walking, the character crosses one block per `block_sec`. No ambient zone group appears:
  // a walk is its own minute-to-minute activity — and it is ONLINE only, so an away period never
  // crosses a block and never opens a Waypoint it did not earn online.
  if (s.walk) {
    const walk = s.walk;
    walk.secLeft--;
    if (online && walk.secLeft <= 0 && !s.group.length) {
      // the block is crossed: one encounter chance, then the next block starts
      walk.blocksLeft--;
      walk.blocksWalked++;
      walk.secLeft = road.blockSec;
      // A crossed block says nothing: no number floats off the character and no line is logged for it —
      // the walk reads as the one word on the field plus the route lighting itself off `blocksWalked`,
      // one cell per block (`walkedCells`). Only arriving, and being ambushed, are events.
      const trailEvent = resolveTravelEvent(s, rng);
      if (trailEvent) push(s, `Trail event · ${trailEvent}`);
      if (walk.blocksLeft <= 0) {
        const arrived = arrive(s, walk);
        if (arrived) {
          if (s.lastAutoZone !== s.zone) {
            s.lastAutoZone = s.zone;
            autoSelect(s, s.zone);
          }
          push(s, arrived.first
            ? `Arrived on foot at ${arrived.name} — its Waypoint is open`
            : `Arrived at ${arrived.name}`);
          fx(s, { kind: 'travel', side: 'self', text: `arrived · ${arrived.name}`, colour: hitColour(null) });
          runExplorationAutomation(s, online);
        }
      } else if (road.rollEncounter(rng)) {
        spawnWalkEncounter(s, rng);
      }
    }
  }

  // leaving the run's zone ends the run: a dungeon is entered ground, not a destination
  if (s.dungeon && s.dungeon.zone !== s.zone) push(s, abandonRun(s, 'Pulled out'));
  const band = BAND_OF_QUALITY(eng.zoneById(s.zone).quality);
  // the side the feet stand on fields its own pack (`subzones[].spawn.group`); bare ground, a town and
  // a wild side roll the zone's published range, which is the average of its three sides (X75)
  const [loGroup, hiGroup] = eng.groupRangeOf(s.zone, s.cell?.sub);
  const groupSize = intBetween(rng, loGroup || 1, hiGroup || loGroup || 1);
  // a run fields the zone's own normals, clamped to the run's cap and to what is left
  if (!s.group.length && !s.walk && s.hunting && s.dungeon) {
    const run = s.dungeon;
    const [rlo, rhi] = (eng.zoneById(run.zone).group as string).split('-').map(Number);
    const size = DG.clampGroup(intBetween(rng, rlo || 1, rhi || rlo || 1), run.left);
    if (size > 0) {
      s.group = Array.from({ length: size }, () => spawnMob(rng, run.zone, 'normal'));
      s.group.sort((m) => (m.line === 'front' ? -1 : 1));
      s.spawnIn = L.group_spawn_sec;
      s.farm.usesThisFight = 0;
    }
  }
  if (!s.group.length && !s.walk) s.spawnIn--;
  if (!s.group.length && !s.walk && s.hunting && s.spawnIn <= 0) {
    // the side fields its own Elite rate; everywhere else the published global chance rolls
    const wantElite = rng() < eng.eliteChanceOf(s.zone, s.cell?.sub);
    // the boss clock is a stored due time, per character, and it does not accrue while away
    // (save.md · combat.md §7). A modulo would let a busy tick skip a spawn and hand the next
    // one out early.
    if (online && !s.bossDueAt) s.bossDueAt = s.clockSec + BOSS_EVERY_SEC;
    const wantBoss = online && s.bossDueAt !== undefined && s.clockSec >= s.bossDueAt;
    s.group = wantBoss
      ? [spawnMob(rng, s.zone, 'boss')]
      : wantElite
        ? [spawnMob(rng, s.zone, 'elite', undefined, s.cell?.sub)]
        : Array.from({ length: groupSize }, () => spawnMob(rng, s.zone, 'normal', undefined, s.cell?.sub));
    // the queue is front line first, so a reach-1 attack always has the front slot (combat.md §2b)
    s.group.sort((m) => (m.line === 'front' ? -1 : 1));
    s.spawnIn = L.group_spawn_sec;
    s.farm.usesThisFight = 0; // a fresh group is a fresh fight for the per-fight potion cap
    if (wantBoss) {
      s.bossDueAt = s.clockSec + BOSS_EVERY_SEC;
      push(s, `Boss spawn in ${eng.zoneById(s.zone).name}`);
    }
  }

  // the completion gate is armed before the first swing of a spawn, so a fast kill still counts
  goalWatch(s);
  for (const m of s.group) goalSpawn(s, m);

  // field rule 1: at most 3 mobs engage at once; the queue behind them waits
  const engaging = s.group.slice(0, 3);
  const front = s.group[0];

  /** Everything one mob carries: curse lines (conditional ones only while their status holds),
   *  the statuses we inflicted, and the target-side lines an aura writes on everything in range. */
  const auraTarget = modsFromAuraFold(effects.target || {});
  const mobMods = (mobId: string) => combineMods(
    combineMods(modsOn(s.curses, mobId, (cond) => holdsCondition(s.mobStatus, mobId, cond)),
      targetMods(statusModsOn(s.mobStatus, mobId))),
    auraTarget,
  );

  // Shock spends only its remaining part of this one-second step. Vit's Stun Recovery shortens that
  // stopped slice, and the attack / cooldown / regen clocks advance through the rest of the second.
  const shockSecLeft = Math.max(0, statuses.shock?.secLeft || 0);
  const playerActiveFraction = Math.max(0, 1 - Math.min(1, shockSecLeft));
  const statusesAppliedThisTick = new Set<StatusName>();
  const chill = statuses.chill && statuses.chill.secLeft > 0 ? statuses.chill : null;
  const chillAspdCut = chill
    ? Math.min(E.status.chill.aspd_cap, chill.stacks * E.status.chill.aspd_pct) / 100 : 0;
  const chillAccuracyCut = chill
    ? Math.min(E.status.chill.acc_cap, chill.stacks * E.status.chill.acc_pct) / 100 : 0;
  const crippled = statuses.crippled && statuses.crippled.secLeft > 0 ? statuses.crippled : null;
  const crippledClockCut = crippled
    ? Math.min(E.status.crippled.clock_cap, crippled.stacks * E.status.crippled.clock_pct) / 100 : 0;
  const attackCharacter = chillAccuracyCut > 0
    ? { ...c, accuracy: c.accuracy * (1 - chillAccuracyCut) } : c;
  const playerHitsPerSec = c.hitsPerSec * Math.max(0, 1 - chillAspdCut) * Math.max(0, 1 - crippledClockCut);
  // the events the trigger auras listen for, collected where they happen: a crit in this tick's swings,
  // and any hit that took HP or Energy Shield off the player
  const trig = triggerAuras(s.skills);
  let critLanded = false;
  let tookDamage = false;

  // The cast pipeline is one path: a rotation press and a triggered one differ only by the `trigger`
  // env handed to `castOnce`, which prices the press, so their outcome handling cannot drift.
  function applyCast(cast: ReturnType<typeof castOnce>) {
    if (!cast) return;
    s.player.mana = Math.max(0, s.player.mana - cast.manaCost);
    if (cast.hpCost > 0) s.player.hp = Math.max(1, s.player.hp - cast.hpCost);
    if (cast.heal) s.healUp = cast.heal;
    if (cast.charges != null) {
      s.player.charges = cast.charges;
      push(s, `${cast.name} grants ${cast.charges} perfect-dodge charges`);
    }
    if (cast.blockCharges != null) {
      s.player.blockCharges = cast.blockCharges;
      push(s, `${cast.name} grants ${cast.blockCharges} blocks`);
    }
    if (cast.cleansesSelf) {
      const cleared = Object.keys(statuses).length;
      for (const k of Object.keys(statuses) as StatusName[]) delete statuses[k];
      if (cleared) push(s, `${cast.name} clears ${cleared} status${cleared > 1 ? '' : 'es'} off you`);
    }
    if (cast.instantHealPct) {
      const healed = (c.maxHp * cast.instantHealPct) / 100;
      const before = s.player.hp;
      s.player.hp = Math.min(c.maxHp, s.player.hp + healed);
      push(s, `${cast.name} restores ${eng.fmt(healed)} HP at once (${cast.instantHealPct}% of the pool)`);
      // the pool's own answer, in the colour of the Element the press carried — the number the heal
      // actually moved, not the number the row prices, so a top-off at full HP says what it did
      fx(s, { kind: 'heal', side: 'self', skillId: cast.id, text: `+${eng.fmt(s.player.hp - before)}`, colour: hitColour((sm.byId[cast.id] as any)?.element || null) });
    }
    if (cast.damage && cast.targets) push(s, `${cast.name} hits ${cast.targets} for ${eng.fmt(cast.damage)}${cast.crit ? ' (crit)' : ''}`);
    // the press's colour comes from the row's own Element (`skills.json` `element`), the same field
    // the status rider reads — a press with no Element name is the neutral half
    const castElement = (sm.byId[cast.id] as any)?.element || null;
    // one number per mob the press actually hurt, each on its own plate: the sim already decided how the
    // share split and the mitigation landed on every target, so the screen shows that and not the total
    for (const h of cast.byMob) {
      fx(s, {
        kind: 'hit', side: 'field', mobId: h.id, crit: cast.crit, via: 'cast',
        text: eng.fmt(h.amount), value: h.amount, colour: hitColour(castElement, cast.crit),
      });
    }
    if (cast.name) fx(s, { kind: 'cast', side: 'self', skillId: cast.id, text: cast.name, colour: hitColour(castElement) });
    if (cast.damage && !cast.targets) push(s, `${cast.name} was dodged`);
    credit(s, 'cast', cast.dealt || 0);
    if (cast.curseOn) {
      const sec = applyCurse(s.curses, cast.curseOn, sm.byId[cast.id]);
      // a curse line that names a status clock (Venom Bind) is spent on the status store, not the
      // curse store, because it changes how another line decays rather than adding a multiplier
      for (const e of (sm.byId[cast.id].effects || [])) {
        if (e.subject === 'target' && e.stat === 'poison_hold_sec') holdPoison(s.mobStatus, cast.curseOn, e.value);
      }
      push(s, `${cast.name} lands for ${sec} sec`);
    }
    while (s.group.length && s.group[0].hp <= 0) {
      const dead = s.group.shift()!;
      onKill(s, rng, dead, c, statuses);
    }
  }

  /**
   * A trigger aura's press: the same `castOnce` the rotation uses, asking for the first ready slot in
   * the cast order, with the aura's price on it. It spends the aura's own clock (`trigger_cd_sec`),
   * never the skill's cooldown, so the trigger is an extra press rather than a re-ordered rotation.
   */
  function fireTrigger(aura: TriggerAura | null) {
    if (!aura || playerActiveFraction <= 0 || (s.skills.cd[aura.id] || 0) > 0) return;
    const t = castOnce(s.skills, attackCharacter, spendableMana(attackCharacter, s.skills, s.player.mana), s.group, statuses, rng, {
      mobStatus: s.mobStatus, curses: s.curses,
      currentHp: s.player.hp,
      missingHpPct: c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0,
      isBoss: !!s.group[0] && isBossKind(String(s.group[0].kind)),
      trigger: { manaMult: aura.manaMult, damageMult: aura.damageMult },
    });
    if (!t) return;
    s.skills.cd[aura.id] = aura.cdSec;
    push(s, `${sm.byId[aura.id].name} triggers ${t.name}`);
    applyCast(t);
  }

  s.player.atkTimer += playerHitsPerSec * playerActiveFraction;
  while (s.player.atkTimer >= 1 && front && playerActiveFraction > 0) {
    s.player.atkTimer -= 1;
    const target = s.group[0];
    if (!target) break;
    const tm = mobMods(target.id);
    const r = playerSwing(rng, attackCharacter, target, c.weaponElement, tm);
    if (r.landed) {
      // the weapon's own riders — Element status, bleed and stun — on the swing's own hit, and on a
      // landing press too (§14), through one function so the two cannot drift
      applyWeaponRiders(rng, c, s.mobStatus, target.id, lineValue(s.curses, target.id, 'bleed_chance') > 0, 0, 0, target.immune || []);
      // a swing that gives back HP is two events, not one: the blow the mob sees and the return the
      // character feels, each on its own half of the field
      if (r.leech) {
        const before = s.player.hp;
        s.player.hp = Math.min(c.maxHp, s.player.hp + r.leech);
        fx(s, { kind: 'heal', side: 'self', text: `+${eng.fmt(s.player.hp - before)}`, colour: hitColour(null) });
      }
      credit(s, 'swing', r.damage);
      fx(s, {
        kind: 'hit', side: 'field', mobId: target.id, crit: r.crit, via: 'swing',
        text: eng.fmt(r.damage), value: r.damage, colour: hitColour(r.element || null, r.crit),
      });
      if (r.crit) { critLanded = true; push(s, `Crit for ${eng.fmt(r.damage)} (${target.species})`); }
      if (target.hp <= 0) {
        onKill(s, rng, target, c, statuses);
        s.group.shift();
        s.player.atkTimer = 0;
      }
    } else if (r.why) {
      // a swing the mob answered without taking pops its word on that mob's own corner, the way a
      // landed blow pops its number — a dodge reads where the dodger stands, never in a shared column.
      fx(s, { kind: 'block', side: 'field', mobId: target.id, text: r.why, colour: hitColour(null) });
    }
  }

  // the rotation casts the first ready, affordable slot top-down — no manual presses.
  // Haste is a post-cap multiplier on this clock, which is why it reaches tickSkills at all; Crippled is
  // the other direction on the same clock, so a slowed rotation is one multiplier, never a second rule.
  const cdCut = crippled ? (E.status.crippled.cd_pct || 0) / 100 : 0;
  tickSkills(s.skills, c.globalSpeed * Math.max(0, 1 - cdCut) * playerActiveFraction);
  // Cooldowns still count down while Auto Skills is off; only automatic casts stop. A shocked clock
  // (playerActiveFraction 0) stops the presses the same way it stops the rotation: nothing re-presses
  // while the character cannot act, and regen is stopped beside it.
  if (autoSkills && playerActiveFraction > 0) {
    for (const id of Object.keys(s.skills.buffs)) {
      if (!buffNeedsRecast(s.skills, id)) continue;
      const skill = sm.byId[id];
      const cost = sm.costOf(skill, {
        skillLevel: skillLevel(s.skills, id), aoe: false,
      });
      if (cost.resource === 'mana') {
        if (cost.amount > spendableMana(c, s.skills, s.player.mana)) continue;
        s.player.mana -= cost.amount;
      } else {
        if (cost.amount >= s.player.hp) continue;
        s.player.hp = Math.max(1, s.player.hp - cost.amount);
      }
      s.skills.cd[id] = skillCd(s.skills, id, c.cdr);
      s.skills.buffUp[id] = Number(String(skill.duration).match(/\d+/)?.[0] || 10);
      // a buff coming up is a gain the character receives, so it is raised where the character is read, in
      // the colour of the Element the row carries — the same pair of rules a press already follows
      fx(s, {
        kind: 'buff', side: 'self', skillId: id, text: String(skill.name || id),
        colour: hitColour((skill as any).element || null),
      });
    }
    const cast = castOnce(s.skills, attackCharacter, spendableMana(attackCharacter, s.skills, s.player.mana), s.group, statuses, rng, {
      mobStatus: s.mobStatus, curses: s.curses,
      currentHp: s.player.hp,
      missingHpPct: c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0,
      isBoss: !!s.group[0] && isBossKind(String(s.group[0].kind)),
    });
    applyCast(cast);
  }
  // the crit trigger fires after the rotation's own press, so it picks the next ready slot rather than
  // casting the same skill twice in the same tick
  if (autoSkills && critLanded) fireTrigger(trig.crit);

  const hadGroupBeforeDamage = s.group.length > 0;
  // statuses age once a second, and the DoT they deal lands before the mob swings back
  for (const mob of s.group) {
    const dot = stepMobParts(s.mobStatus, mob.id);
    if (dot.total > 0) {
      mob.hp -= dot.total;
      // one number per mob per second, wearing the colour of the status carrying it: burn is the fire
      // it came from, poison the poison, and bleed the physical neutral it has always been
      fx(s, { kind: 'hit', side: 'field', mobId: mob.id, via: 'dot', text: eng.fmt(dot.total), value: dot.total, colour: statusColour(dotLead(dot)) });
    }
    credit(s, 'dot', dot.total);
  }
  while (s.group.some((m) => m.hp <= 0)) {
    const dead = s.group.splice(s.group.findIndex((m) => m.hp <= 0), 1)[0];
    onKill(s, rng, dead, c, statuses);
  }
  if (hadGroupBeforeDamage && s.group.length === 0) {
    const wasPatrolling = s.patrol.active;
    const patrolNote = recordPatrolGroupClear(s, online);
    if (patrolNote) push(s, patrolNote);
    runExplorationAutomation(s, online, wasPatrolling);
  }

  // mob clocks
  const immune = buffRuleUp(s.skills, 'status_immunity');
  // Energy Absorb turns a share of every landed hit into Energy Shield and negates it outright 
  const absorbPct = esAbsorbPct(s.skills);
  for (const mob of engaging) {
    if (mob.hp <= 0 || !s.group.includes(mob)) continue;
    const tm = mobMods(mob.id);
    mob.atkTimer += mob.hitsPerSec * Math.max(0, 1 + tm.attackSpeed / 100) * Math.max(0, 1 - (tm.clockPct || 0) / 100);
    while (mob.atkTimer >= 1) {
      mob.atkTimer -= 1;
      // a Ghost Dance charge deletes the hit outright and is not opposed: it goes before the
      // rolls, which is the whole difference between it and Dodge
      if ((s.player.charges || 0) > 0) {
        s.player.charges!--;
        continue;
      }
      const r = mobSwing(rng, c, mob, statuses, tm, s.player.es, absorbPct, (s.player.blockCharges || 0) > 0);
      // an Earth Wall charge answered the swing: it is spent whether the shield rolled or not
      if (r.blockChargeSpent) s.player.blockCharges!--;
      if (r.leech && r.leech > 0) mob.hp = Math.min(mob.hpMax, mob.hp + r.leech);
      // a defence is an event too: the screen has to say *which* answer stopped the hit, because
      // Block, Evasion and a perfect dodge animate differently and the player reads them apart. Either way
      // the striker is named, so the body that swung can lean into its own blow.
      if (r.blocked) fx(s, { kind: 'block', side: 'self', byId: mob.id, text: r.blocked, colour: hitColour(null) });
      // `cast_on_damage_taken` listens for any hit that actually took off the player (HP or shield)
      if (r.toHp > 0 || r.toEs > 0) {
        tookDamage = true;
        // the incoming number wears the attacker's own Element, the same line the resistance roll
        // answered — a chaos hit reads purple whether or not the shield ate it
        fx(s, {
          kind: 'taken', side: 'self', byId: mob.id,
          text: eng.fmt(r.toHp + r.toEs), value: r.toHp + r.toEs,
          colour: hitColour(mob.innate?.[0] || null),
        });
      }
      if (r.absorbed > 0) s.player.es = Math.min(c.es, s.player.es + r.absorbed);
      if (r.toEs > 0) { s.player.es -= r.toEs; if (!buffRuleUp(s.skills, 'es_recharge_immediate')) s.player.esIdleSec = 0; }
      if (r.toHp > 0) {
        s.player.hp -= r.toHp;
        if (!buffRuleUp(s.skills, 'es_recharge_immediate')) s.player.esIdleSec = 0;
      }
      // A shield block deflects the status, including an Earth Wall charge. Evasion and perfect dodge
      // return raw=0; a hit absorbed by ES still landed and can apply its status.
      if (r.raw > 0 && r.blocked !== 'block' && r.blocked !== 'block charge') {
        // the mirror of `applyWeaponRiders`: the mob's aligned Elemental DPS — its full per-second
        // Element output under its own Alignment multiplier — is both the per-second DoT basis and
        // the budget's basis, exactly what our statuses on a mob are priced from
        const alignedElemDps = mob.ps * eng.damageSplit(mob.damage)[1] * (((mob as any).align ?? 100) / 100);
        const st = immune ? null : rollStatus(rng, mob, alignedElemDps, statuses, c.statusResist, c.stunRecovery, alignedElemDps);
        if (st) { statusesAppliedThisTick.add(st); push(s, `${mob.species} inflicts ${st}`); }
        if (st) fx(s, { kind: 'proc', side: 'self', text: st, colour: statusColour(st) });
      }
    }
  }
  // the damage-taken trigger fires once the incoming clock has run, on the same tick it was hurt
  if (autoSkills && tookDamage && s.player.hp > 0) fireTrigger(trig.taken);

  // damage over time on us, then regen (field rule 2: regen works during combat)
  if (s.healUp && s.player.hp > 0) {
    const before = s.player.hp;
    s.player.hp = Math.min(c.maxHp, s.player.hp + c.maxHp * s.healUp.pctPerSec);
    // the stream says what it returned each second, on the same beat it spends — a heal that only lives in
    // the gauge is a number the eye never sees move
    fx(s, { kind: 'heal', side: 'self', text: `+${eng.fmt(s.player.hp - before)}`, colour: hitColour(null) });
    s.healUp.secLeft--;
    if (s.healUp.secLeft <= 0) s.healUp = null;
  }
  const dot = dotDamageParts(c, statuses);
  // a charge also stops a DoT tick — the row says it deletes "unconditional effects", which is what
  // a burn tick is: nothing rolls for it (`buff.ghost_dance`)
  if (dot.total > 0 && (s.player.charges || 0) > 0) s.player.charges!--;
  else if (dot.total > 0) {
    // Burn meets the live shield; poison and bleed reach HP directly. Only the burn part can
    // overflow to HP when the shield runs out, so a mixed DoT tick never spends ES on poison.
    const toEs = Math.min(dot.burn, s.player.es);
    s.player.es -= toEs;
    const toHpDot = dot.poison + dot.bleed + dot.burn - toEs;
    s.player.hp -= toHpDot;
    // the delay answers to damage taken, not to the pool it landed on: a poison tick that reached
    // HP interrupts the recharge the same way an equal direct hit does
    if ((toEs > 0 || toHpDot > 0) && !buffRuleUp(s.skills, 'es_recharge_immediate')) s.player.esIdleSec = 0;
    const lead = dotLead(dot);
    fx(s, { kind: 'taken', side: 'self', via: 'dot', text: eng.fmt(dot.total), value: dot.total, colour: statusColour(lead) });
  }
  const burnCut = statuses.burn ? Math.min(E.status.burn.regen_cut_max, statuses.burn.stacks * E.status.burn.regen_cut_per_stack) : 0;
  // `combat.md` §5 reads shock as "attacks stop + regen stops", so the stop covers the pools too.
  // The Energy Shield recharge is left alone on purpose: it is a shield, not regen, and its own
  // `delay_sec` rule already governs it.
  if (s.player.hp > 0) s.player.hp = Math.min(c.maxHp, s.player.hp + c.hpRegen * (1 - burnCut) * playerActiveFraction);
  s.player.mana = Math.min(c.maxMana, s.player.mana + c.manaRegen * playerActiveFraction);
  s.player.esIdleSec++;
  // Magia Drive forces the recharge: the delay is ignored and a hit does not interrupt it
  const rechargeNow = buffRuleUp(s.skills, 'es_recharge_immediate');
  if (rechargeNow || s.player.esIdleSec >= E.energy_shield.delay_sec) s.player.es = Math.min(c.es, s.player.es + c.esRegen);

  const groupIds = new Set(s.group.map((m) => m.id));
  tickCurses(s.curses, groupIds);
  forgetMobStatus(s.mobStatus, groupIds);
  for (const key of Object.keys(statuses) as (keyof Statuses)[]) {
    const st = statuses[key]!;
    // A Shock inflicted in the mob phase starts at the end of this step, so its duration begins next step.
    if (key === 'shock' && statusesAppliedThisTick.has('shock')) continue;
    if (key === 'poison' || key === 'mark') {
      st.secLeft--;
      if (st.secLeft <= 0) {
        decayStatusStack(st);
        if (st.stacks > 0) st.secLeft = key === 'poison'
          ? E.status.poison.decay_sec : E.status.mark.decay_sec;
        else delete statuses[key];
      }
    } else {
      st.secLeft--;
      if (st.secLeft <= 0) delete statuses[key];
    }
  }

  const drank = s.player.hp > 0 ? maybeDrink(s, c, s.group.some((m) => isBossKind(m.kind))) : null;
  if (drank) push(s, `${drank.name} restores ${eng.fmt(drank.amount)} ${drank.pool} (shared ${E.potions.shared_cooldown_sec}s cooldown)`);

  // the farm's own automation, the twin of the potion path (parking: "Auto plant, harvest and brew")
  for (const line of maybeFarm(s)) push(s, line);
  tickFieldwork(s, rng);

  if (s.player.hp <= 0) {
    // HP reaches 0 → Push, never death (combat.md §4)
    const pushedZone = s.group[0]?.zone ?? s.zone;
    s.player.hp = 0;
    s.phase = 'camp';
    s.campSec = Math.max(1, Math.ceil(c.maxHp / (c.hpRegen * 8)));
    s.counters.pushes++;
    // the rest is a clean one: whatever the fight had on the character ends at the Push — the
    // statuses are the fight's, and the camp neither ticks nor banks them
    for (const key of Object.keys(statuses) as (keyof Statuses)[]) delete statuses[key];
    // a Push in a dungeon ends the run at once and the escrow is forfeited, never paid
    if (s.dungeon) push(s, abandonRun(s, 'Pushed'));
    s.group = [];
    // A same-zone Field Camp ends an interrupted walk after preserving its block count; without one,
    // the ordinary walk resumes at the ambush block. Forward Mode stands down during either Push.
    const walking = !!s.walk;
    // a Push returns the main preset, but cooldowns already counting keep counting (§rule 12)
    if (switchPreset(s, sm.mainPreset)) push(s, `Back on the ${s.presets[sm.mainPreset].name} preset · running cooldowns kept`);
    const returnedToFieldCamp = pushToFieldCamp(s, pushedZone);
    if (walking && returnedToFieldCamp) {
      push(s, 'The interrupted walk ends at your field Camp');
    } else if (s.walk) {
      push(s, `Pushed on the walk · the walk keeps its ${s.walk.blocksLeft} block${s.walk.blocksLeft === 1 ? '' : 's'} and resumes from this one`);
    }
    push(s, `Pushed — ${s.campSec} sec at camp (${eng.fmt(c.maxHp)} HP ÷ ${eng.fmt(c.hpRegen * 8)}/sec)`);
    // Forward Mode's fallback: a Push in a zone above the floor means this chapter is not survivable
    // yet, so the walk drops back to the last zone held and refuses to climb back until one level is
    // gained (owner ask). No new number: the gate is a level, the zone is `forwardSafe`.
    if (!walking && s.travel === 'forward' && s.forwardSafe != null && s.forwardSafe < s.zone) {
      const from = eng.zoneById(s.zone);
      const back = eng.zoneById(s.forwardSafe);
      s.forwardBlockedZone = s.zone;
      s.forwardBlockedLevel = s.player.level;
      s.zone = s.forwardSafe;
      s.spawnIn = 0;
      s.lastAutoZone = -1;
      push(s, `Pushed in ${from.name} — falling back to ${back.name}, the last zone held; the climb resumes at level ${s.player.level + 1}`);
    }
  }
  void band;
  clampPools(s);
  return s;
}

/**
 * Re-read the pools against the sheet the tick ended on. A tick can move a pool's ceiling after the
 * opening clamp — equipping a piece drops the `Max Mana %` line it replaced, a spent point raises
 * Int — so the bar is bounded again here, otherwise it reads above what the character now holds.
 */
function clampPools(s: GameState): void {
  const c = withHunger(withMeal(buildCharacter(s.player.level, s.gear, carried(s), masteryLevel(s, heldWeaponName(s)), effectsActive(s.skills), s.player.points, s.player.treeRanks, lifeSkillBonuses(s)), s), s);
  s.player.mana = Math.min(Math.max(0, s.player.mana), c.maxMana);
  s.player.es = Math.min(Math.max(0, s.player.es), c.es);
  s.player.hp = Math.min(s.player.hp, c.maxHp);
}

/**
 * The live wake, as one pure step: real time in, whole sim seconds out. The tab wakes every
 * `WAKE_SEC`, the player's speed multiplies what that wake is worth, and never more than `MAX_BATCH`
 * seconds are spent in one wake — a throttled tab's backlog is dropped rather than queued, because a
 * queued burst would play catch-up in the foreground and cost the frame its stutter-free draw.
 */
/** Which day the run's clock stands on — the one home, so two callers cannot disagree. */
export const dayOf = (clockSec: number): number => Math.floor(clockSec / 86400);

export const WAKE_SEC = 0.25;
export const MAX_BATCH = 8;
/**
 * Real time into sim seconds, for one wake. `elapsedSec` is what actually passed since the last wake — a
 * timer that ran late banks what it missed instead of a fixed slice, so a throttled tab (a hidden one
 * fires at most once a second) still earns, and only a stalled wake loses its backlog. The batch is what
 * runs; the time that could not fit is dropped, not queued, because a queued burst would play catch-up in
 * the foreground and cost the frame its stutter-free draw.
 */
export function schedulerBatch(acc: number, speed: number, elapsedSec: number = WAKE_SEC): { ticks: number; acc: number } {
  const total = acc + elapsedSec * speed;
  const ticks = Math.floor(total);
  if (ticks <= 0) return { ticks: 0, acc: total };
  if (ticks > MAX_BATCH) return { ticks: MAX_BATCH, acc: 0 };
  return { ticks, acc: total - ticks };
}

/** Offline catch-up: run the same tick over the elapsed seconds, capped by the save rule. */
export function catchUpPlan(elapsedSec: number) {
  // an away period never walks: a walk is online only, so the catch-up never crosses a block
  const cap = E.inventory.offline_cap_hr * 3600;
  const secs = Math.max(0, Math.min(Math.floor(elapsedSec), cap));
  return { secs, capped: elapsedSec > cap };
}

/** The tick loop both catch-up paths share — one order of ticks, so the numbers cannot diverge. */
function runTicks(s: GameState, statuses: Statuses, from: number, to: number, autoSkills = true) {
  for (let i = from; i < to; i++) tick(s, statuses, { online: false, autoSkills });
}

/**
 * The boss clock is an online gate (`save.md`): away time must not accrue toward it. The stored
 * `bossDueAt` is absolute `clockSec`, so the away ticks that advanced `clockSec` would otherwise
 * satisfy it the instant the player returns and hand out a free boss. Shift the due time by exactly
 * the seconds simulated, which keeps the remaining online time unchanged.
 */
function pauseBossClock(s: GameState, secs: number): void {
  if (s.bossDueAt !== undefined) s.bossDueAt += secs;
}

/** The dungeon cooldown is an online gate like the boss clock: away time must not accrue toward it.
 *  A run that cleared mid-window stamped its cooldown at a virtual mid-away second, so shifting the
 *  whole window would over-charge it; that stamp is re-set to the return second instead, and the
 *  full `cooldown_sec` stands when the player is back. */
function settleDungeonClock(s: GameState, startClock: number, secs: number): void {
  if (s.dungeonClearedAt === undefined) return;
  if (s.dungeon === null && s.dungeonClearedAt > startClock && s.dungeonClearedAt <= startClock + secs) {
    s.dungeonClearedAt = startClock + secs;
  } else {
    s.dungeonClearedAt += secs;
  }
}

/** Synchronous catch-up — tests and any non-UI caller. */
export function catchUp(s: GameState, statuses: Statuses, elapsedSec: number, opts: { autoSkills?: boolean } = {}) {
  const { secs, capped } = catchUpPlan(elapsedSec);
  const startClock = s.clockSec;
  runTicks(s, statuses, 0, secs, opts.autoSkills !== false);
  pauseBossClock(s, secs);
  settleDungeonClock(s, startClock, secs);
  return { simulated: secs, capped };
}

/**
 * The UI's catch-up: the same ticks in the same order, yielded in slices so a save left for a day
 * (up to 43,200 ticks) cannot freeze first paint. The numbers are identical to `catchUp`.
 */
export async function catchUpAsync(s: GameState, statuses: Statuses, elapsedSec: number, opts: { autoSkills?: boolean } = {}) {
  const { secs, capped } = catchUpPlan(elapsedSec);
  const startClock = s.clockSec;
  const SLICE = 2000;
  for (let i = 0; i < secs; i += SLICE) {
    const end = Math.min(i + SLICE, secs);
    runTicks(s, statuses, i, end, opts.autoSkills !== false);
    if (end < secs) await new Promise((r) => setTimeout(r, 0));
  }
  pauseBossClock(s, secs);
  settleDungeonClock(s, startClock, secs);
  return { simulated: secs, capped };
}

export const equippedCount = (s: GameState) => s.gear.filter(Boolean).length;
export const slots = SLOT_COUNT;
export type { Item };
