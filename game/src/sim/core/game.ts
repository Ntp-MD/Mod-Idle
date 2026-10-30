import { eng, E, sm, loot, TOWN, tree, spawns } from '../../engine/client';
import { buildCharacter, emptyGear, SLOT_COUNT } from './player';
import { itemName } from '../gear/item-name';
import { playerSwing, mobSwing, rollStatus, applyStatus, poisonBurst, decayStatusStack, type Statuses, type StatusName } from '../combat/combat';
import { basicPhaseBudget } from '../../../../engine/attack-range.ts';
import { CombatClock, EVENT_PRIORITY } from '../combat/combat-clock';
import {
  arenaSkillRange, arenaSkillTargets, arenaWeaponRange, arenaWeaponStopRange, captureCombatArena,
  createCombatArena, playerAttackProfile, recordCombatArenaFx, syncCombatArena, updateArenaAction,
  arenaDistance,
  type CombatArena, type CombatMobFlight, type CombatArenaAction,
} from '../combat/combat-arena';
import type { CombatFlight, ManualControl } from '../combat/combat-actions';
import { planAutoAvoid } from '../combat/auto-avoid';
import { releasedSkillCastTiming, skillCastTiming, targetsInSkillArea } from '../../../../engine/skill-actions.ts';
import { skillAreaSnapshot } from '../../../../engine/skill-area.ts';
import { spawnSlotSeed } from '../../../../engine/spawns.ts';
import { rollDrop } from '../gear/drop';
import { payoutStacks } from '../world/dungeon';
import { selectDungeonRescue, type DungeonRescueEntry } from '../../../../engine/dungeon-rescue.ts';
import { newAlchemyLedger } from '../../../../engine/alchemy.ts';
import { canDissolve, dissolve } from '../gear/salvage';
import { depositMany, newTown, progressTasks, stashTabCount, tickTown, taskReward } from '../town/town';
import { advanceEconomy, newEconomyState } from './economy';
import { deliveryPauseReason, tickDeliveries } from '../town/delivery';
import { tickBlackMarket } from '../town/black-market';
import { STAT_KEYS, type StatKey } from '../../engine/client';
import { chooseJunkItem, leanReweightMany } from '../../../../engine/loot.ts';
import { newFarm, rollHerbs, rollPotion, maybeDrink, maybeFarm, farm, QUICKBAR_SLOTS } from '../world/farm';
import { newFieldwork, tickFieldwork, tickHunger, resolveTravelEvent, recordHuntKill, withMeal, withHunger, finishPushAtCamp, lifeSkillBonuses } from '../world/fieldwork';
import { recordCombatEvent } from '../combat/combat-history';
import { snapshotPendingWork, restorePendingWork } from './pending-work';
import { settleTick } from './tick/settlement-stage';
import { advancePreTick } from './tick/pre-tick';
import { applyKeystonePrep } from './tick/keystone-prep';
import { advanceForward } from './tick/forward';
import { advancePostTick } from './tick/post-tick';
import { advanceCampStage } from './tick/camp-stage';
import { advanceWalkStage } from './tick/walk-stage';
import { advanceFieldPopulation } from './tick/field-population';
import { advanceEngagement, createEngagementState } from './tick/engagement';
import { createMobShots } from './tick/mob-shots';
import { createMobActions } from './tick/mob-actions';
import { createPlayerBasicActions } from './tick/player-basic';
import { createIncomingHit } from './tick/incoming-hit';
import { createCastTrigger } from './tick/cast-trigger';
import { advanceRecovery } from './tick/recovery-stage';
import { applyPush } from './tick/push-stage';
import { scheduleMobDot } from './tick/mob-dot-stage';
import { createIntentSelect } from './tick/intent-select';
import { reactiveRearm, schedulePlayerAction } from './tick/player-action';
import { createLiveClocks } from './tick/live-clocks';
import { createFlights } from './tick/flights';
import { createArenaStep } from './tick/arena-step';
import { createIntents } from './tick/intents';
import { createArenaWork } from './tick/arena-work';
import { fieldAreaKey, releaseSpawnSlot, syncFieldState, type FieldSpawnSlot } from '../world/field-area';
import { road, arrive, ownerOf, zoneOf, startWalk, currentCell as currentCellForJournal } from '../world/road';
import { newMapJournal, normalizeMapJournal, recordMapDiscovery, tickTrailSites } from '../world/map-exploration';
import {
  driveAutoReturn, drivePatrol, finishAutoReturnDeposit, maybeStartAutoReturn,
  newAutoReturnState, newPatrolState, recordPatrolGroupClear,
} from '../world/exploration';
import { weaponByName, masteryLevel, payMastery, dropMultiplier } from './mastery';
import { newPresets, autoSelect } from './presets';
import { newCollector, newGrants, wants, col } from '../town/collector';
import { newFilter, ruleFor, coveredElements, refresh as refreshFilter } from '../gear/filter';
import { addTo, fits, slotsFree } from '../gear/slots';
import { settlementOfZone, settlementById } from '../town/town';
import { effectsActive, esAbsorbPct } from '../combat/skills';
import { applyMobAuras, resolveMobKit } from '../combat/mobSkills';
import { mark as markSnapshot } from './snapshot';
import { newGoal, onSpawn as goalSpawn, onKill as goalKill, watch as goalWatch } from './goal';
import { newGuidance } from './guidance';
import { byFrontLine } from './roster-order';
import { newCurses, modsOn, applyCurse, tickCurses, combineMods, lineValue, modsFromAuraFold } from '../combat/curse';
import { newMobStatusStore, applyWeaponRiders, holdPoison, spendControlBudget, forgetDead as forgetMobStatus,
  placeKeystoneDoT, transferStatus, carriesTransferable, copyStatus,
  modsOn as statusModsOn, targetMods, holdsCondition, keystoneTargetMods,
} from '../combat/mobStatus';
import { newKeystoneRuntimeState } from '../../../../engine/keystones.ts';
import { armourBreak, autoCleanseReady, belowLowLife, borrowedRecoup, bundleOf, capacitiveEs, crushingRhythm, disruptingStop, demolitionBlast, endlessHungerBank, equilibriumResistance, ghostDanceRecovery, instrumentsMult, manaDebtFloor, painforgedBank, redlineDamageMult, shieldGateHolds, staggeringSplit, thornboundRetaliation, worthyFoe } from '../../../../engine/keystones.ts';
import { KEYSTONE_HANDLERS, registerStaticKeystoneHandlers } from './keystone-runtime';
import { tickCampEncounters, campEncounterEligible } from '../world/camp-encounters';
import {
  newSkillState, prepareSkillCast, prepareFirstSkillCast, paySkillXp, grantSkill, usableMana, usableHp, buffRuleUp,
  spendableMana, triggerAuras, rotationOrder, skillEligibilityInState, newCastRollCache, type TriggerAura, type CastReport, type PreparedSkillCast,
} from '../combat/skills';
import type { GameState, Mob, Item, FxEvent } from './types';
import { mulberry32, pick, intBetween } from '../../engine/client-helpers';

const L = E.loot;
/** Packet E's seven static bundles are bound once, against the canonical Element list. */
registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys(E.elements.status_of));
/** loot.md F7 publishes 4 bosses an hour; the clock is per character and online only. */
/** The boss cadence lives with the other clock constants; re-exported for its callers. */
export { BOSS_EVERY_SEC } from './clock';
import { BOSS_EVERY_SEC } from './clock';
const BAND_OF_QUALITY = (quality: string): string =>
  quality.startsWith('high') ? 'high' : quality.startsWith('mid') ? 'mid' : 'low';

/** combat.md §1 · engine.json mob.attack_clock_per_sec, capped by the one clock rule (caps.attack_interval_sec).
 *  A fast-clock lineage (`mob.trait_mechanics.fast_clock`) multiplies its own clock; the swing divides
 *  by the same number in `mobSwing`, so the faster body deals exactly its published damage per second. */
const MOB_CLOCK_FLOOR = E.mob.attack_clock_per_sec;
const MOB_CLOCK_CAP = 1 / E.caps.attack_interval_sec;
const mobClock = (kind: string, mult = 1) => {
  const rank = kind.toLowerCase();
  return Math.min(((rank.startsWith('boss') || rank.startsWith('unique')) ? MOB_CLOCK_FLOOR.boss : MOB_CLOCK_FLOOR.normal) * mult, MOB_CLOCK_CAP);
};

/** The character line lives in `state.ts`; re-exported so every existing importer keeps its path. */
export { heldWeaponName, carried, characterSheet, spendReference, setLevel, clampPools, ZERO_POINTS } from './state';
import { carried, characterSheet, heldWeaponName, spendReference, ZERO_POINTS } from './state';

export function newGame(seed = 20260101, trailSeed = seed): GameState {
  const gear = emptyGear();
  const level = E.opening.level as number;
  const c = buildCharacter(level, gear, {}, 0, undefined, ZERO_POINTS());
  const start = road.nodeById(E.road.nodes[0].id) || E.road.nodes[0];
  const s: GameState = {
    seed,
    rngState: seed,
    mapJournal: newMapJournal(trailSeed),
    player: {
      level,
      xp: 0,
      points: ZERO_POINTS(),
      statPoints: 0,
      autoSpend: true,
      // the level curve pays tree points from level one (the tree's own base): a fresh
      // character starts with them in hand, the same number setLevel banks on the same level
      treePoints: tree.pointsAt(level, E.stat.level_cap),
      questTreePointsEarned: 0,
      passiveTreeVersion: tree.version,
      attainmentPoints: 0,
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
    guidance: newGuidance(),
    curses: newCurses(),
    mobStatus: newMobStatusStore(),
    // the character's own statuses and the keystone runtime are canonical saved state (§7.7)
    playerStatuses: {},
    keystoneRuntime: newKeystoneRuntimeState(),
    pendingSnapshot: null,
    pendingWork: null,
    field: null,
    fieldArchive: {},
    nextSnapshotAt: 0,
    town: newTown(),
    farm: newFarm(),
    fieldwork: newFieldwork(seed),
    alchemy: newAlchemyLedger(E.salvage.alchemy.outputs_per_tier_stone),
    zone: E.opening.settlement_zone as number,
    group: [],
    phase: 'fighting',
    campSec: 0,
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
    combatHistory: [],
    fxSeq: 0,
    clockSec: 0,
    economy: newEconomyState(0),
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
  normalizeMapJournal(s);
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
export { isBossKind } from './kinds';
import { isBossKind } from './kinds';
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

/** The Species' one thematic material, rolled on its own seeded stream so the shared loot RNG
 *  keeps the exact sequence it had before this drop existed. */
export function rollBonusMaterial(s: GameState, mob: Mob): { resource: string; amount: number } | null {
  const species = (E.mob.species as any[]).find((sp) => sp.id === mob.speciesId);
  const bonus = species?.bonus_material;
  if (!bonus) return null;
  const stream = mulberry32((s.seed ^ Math.imul(s.counters.kills, 0x9e3779b9)) >>> 0);
  if (!(stream() < bonus.chance)) return null;
  return { resource: String(bonus.resource), amount: intBetween(stream, bonus.min, bonus.max) };
}

/** Pays the rolled material through the ordinary pickup rule: field kills fill the carried stack,
 *  dungeon kills ride the escrow. A full bag refuses the grant rather than announcing it. */
export function grantBonusMaterial(s: GameState, mob: Mob, online = true): { resource: string; amount: number; granted: number } | null {
  const drop = rollBonusMaterial(s, mob);
  if (!drop) return null;
  const label = (E.fieldwork.materials as any[]).find((m) => m.id === drop.resource)?.name || drop.resource;
  if (s.dungeon) {
    if (!fits(s, s.fieldwork.materials, drop.resource, 'material', drop.amount)) return { ...drop, granted: 0 };
    const escrow = s.dungeon.escrow.materials;
    escrow[drop.resource] = (escrow[drop.resource] || 0) + drop.amount;
    if (online) push(s, `Material · ${label} ×${drop.amount}`);
    return { ...drop, granted: drop.amount };
  }
  const granted = addTo(s, s.fieldwork.materials, drop.resource, 'material', drop.amount);
  if (granted > 0 && online) push(s, `Material · ${label} ×${granted}`);
  return { ...drop, granted };
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

export function spawnMob(rng: () => number, zoneId: number, kind: 'normal' | 'elite' | 'boss', bodyHint?: string, standSub?: number | null, options: { allowWildUnique?: boolean; uniqueChance?: number } = {}): Mob {
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
    if (options.allowWildUnique !== false && uniques.length && rng() < (options.uniqueChance ?? E.loot.unique_chance ?? 0)) {
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
  const hp = rank === 'elite'
    ? eng.mobHpOf(lv, base.vit) * E.mob.elite.hp // the Elite multiplier rides the same curve the engine adds its flat terms to
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
  const skillIds = resolveMobKit(rank, species.id, variantName, fixedName);
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
    skillIds,
    skillReadyAtUs: {},
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

/** One imprint stone's purse key, uniform over eligible Mods. */
function imprintDrop(rng: () => number): string {
  const ids = loot.IMPRINT_IDS;
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
  // the piece leaves first, so the preflight counts the slot it frees: a full bag whose
  // salvage bundle still fits after the swap is a swap, not a refusal.
  s.bag.splice(bagIndex, 1);
  if (!canDissolve(s)) {
    s.bag.splice(bagIndex, 0, item);
    return { ok: false, why: 'make room in the bag for the whole salvage resource bundle' };
  }
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
export type FilterRunAction = 'keep' | 'dissolve' | 'protected' | 'blocked' | 'not-reached';
export interface FilterRunRow { index: number; action: FilterRunAction; reason: string }

function filterRunPass(s: GameState, onRow?: (row: FilterRunRow) => void): { dissolved: number; spared: number; why?: string } {
  let dissolved = 0;
  let spared = 0;
  for (let i = s.bag.length - 1; i >= 0; i--) {
    const item = s.bag[i];
    if (!item) continue;
    if (item.locked || item.heldFor) {
      spared++;
      onRow?.({ index: i, action: 'protected', reason: item.locked ? 'Locked gear stays in the bag.' : 'Reserved for a Collector set.' });
      continue;
    }
    const verdict = filterVerdict(s, item).verdict;
    if (verdict.keep) {
      onRow?.({ index: i, action: 'keep', reason: verdict.reason });
      continue;
    }
    // the piece leaves first, so the preflight counts the slot it frees — same rule as the hand salvage
    s.bag.splice(i, 1);
    if (!canDissolve(s)) {
      s.bag.splice(i, 0, item);
      onRow?.({ index: i, action: 'blocked', reason: 'The bag cannot take the next salvage bundle. Free a slot and run the filter again.' });
      for (let pending = i - 1; pending >= 0; pending--) {
        if (s.bag[pending]) onRow?.({ index: pending, action: 'not-reached', reason: 'The filter stopped before reaching this piece.' });
      }
      push(s, `Filter run stopped — the bag cannot take the next salvage bundle (${dissolved} melted so far)`);
      return { dissolved, spared, why: 'the bag cannot take the next salvage bundle' };
    }
    dissolve(s);
    dissolved++;
    onRow?.({ index: i, action: 'dissolve', reason: 'Fails this slot rule; the full salvage bundle fits.' });
  }
  if (dissolved) push(s, `Filter run melted ${dissolved} carried piece${dissolved === 1 ? '' : 's'} into ore and Scrap${spared ? ` · ${spared} left alone` : ''}`);
  return { dissolved, spared };
}

export function runFilterNow(s: GameState): { dissolved: number; spared: number; why?: string } {
  return filterRunPass(s);
}

/** Forecast the same bottom-up filter pass on a copy; the live character is untouched. */
export function previewFilterRun(s: GameState): FilterRunRow[] {
  const copy = structuredClone(s);
  const rows = new Map<number, FilterRunRow>();
  filterRunPass(copy, (row) => rows.set(row.index, row));
  return Array.from({ length: s.bag.length }, (_, index) => rows.get(index)
    || { index, action: 'not-reached', reason: 'No bag piece was found in this slot.' });
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
 * One rolled piece through the bag filter. A mob kill — on foot, on arrival or paid out of a
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

/** The Element that carried the most of a finished Hit, ties broken by the canonical order (§7.6). */
export function dominantElement(parts: { nativeElement: Record<string, number>; convertedElement: Record<string, number>; extraElement: Record<string, number> }): string | null {
  const sum: Record<string, number> = {};
  for (const lane of [parts.nativeElement, parts.convertedElement, parts.extraElement])
    for (const [el, v] of Object.entries(lane)) if (el && v > 0) sum[el] = (sum[el] || 0) + v;
  let best: string | null = null;
  for (const el of Object.keys(E.elements.status_of) as string[])
    if ((sum[el] || 0) > (best ? sum[best] || 0 : 0)) best = el;
  return best;
}

/**
 * `30` Elemental Equilibrium: the target resists the Element that just hit it harder by the bundle's
 * points and everything else softer by its own, for its own seconds. A fresh application is written
 * over the shift it replaces, so the debuff never walks a resistance off the sheet it started on.
 */
export function applyEquilibrium(mob: Mob, element: string, params: Record<string, number>, nowSec: number): void {
  const standing = mob.resShift || { res: mob.res, resByElement: { ...(mob.resByElement || {}) } };
  const next: Record<string, number> = {};
  for (const el of Object.keys(E.elements.status_of) as string[]) {
    const base = standing.resByElement[el] !== undefined ? standing.resByElement[el] : standing.res;
    const moved = equilibriumResistance(base, base, params);
    next[el] = el === element ? moved.own : moved.other;
  }
  mob.resByElement = next;
  mob.resShift = { expiresAtSec: nowSec + Number(params.durationSec), res: standing.res, resByElement: standing.resByElement };
}

/** The shift is spawn state: when its own seconds run out the body reads its authored lines again. */
export function revertEquilibrium(mob: Mob, nowSec: number): void {
  const shift = mob.resShift;
  if (!shift || nowSec < shift.expiresAtSec) return;
  mob.res = shift.res;
  mob.resByElement = shift.resByElement;
  delete mob.resShift;
}

/** A secondary kill leaves the field with no economy: slot freed, death shown, nothing paid. */
function burySecondaryKill(s: GameState, mob: Mob) {
  releaseSpawnSlot(s, mob);
  if (isBossKind(String(mob.kind)) && s.field) s.field.bossDefeatedAtSec = s.clockSec;
  fx(s, { kind: 'kill', side: 'field', mobId: mob.id, text: mob.species, colour: hitColour(mob.innate?.[0] || null), value: 0 }, mob);
}

function onKill(s: GameState, rng: () => number, mob: Mob, c: ReturnType<typeof buildCharacter>, statuses: Statuses = {}, bloomChain = true,
  positions?: (id: string) => { x: number; y: number } | undefined) {
  // The slot owns the respawn timer; a death never rerolls or copies another body.
  releaseSpawnSlot(s, mob);
  if (isBossKind(String(mob.kind)) && s.field) s.field.bossDefeatedAtSec = s.clockSec;
  const online = s.online !== false;
  // `27` Profane Bloom: a cursed body that dies detonates its own Max HP as Chaos, but only
  // across ground — bodies outside `radiusM` of the blast are untouched (F40). The blast is
  // secondary damage — no crit, no status, no leech, no hit counter — and it never chains, and
  // the bodies it fells pay no kill rewards: no XP, no drops, no stones, no tasks, no dungeon
  // progress. A secondary kill leaves the field, never the economy.
  const bloom = bundleOf(c.keystones, 'profane-bloom');
  if (bloom && bloomChain && Object.keys(s.curses[mob.id] || {}).length) {
    const element = String(bloom.params.element);
    const promised = mob.hpMax * Number(bloom.params.victimMaxHpPct) / 100;
    const radiusM = Number(bloom.params.radiusM ?? 4);
    const burstFrom = positions?.(mob.id);
    let burst = 0;
    for (const other of s.group) {
      if (other === mob || other.hp <= 0) continue;
      if (burstFrom) {
        const pose = positions!(other.id);
        if (!pose || Math.hypot(pose.x - burstFrom.x, pose.y - burstFrom.y) > radiusM + 1e-7) continue;
      }
      const dealt = eng.mitigateMobHit(other, 0, { [element]: promised });
      if (!(dealt > 0)) continue;
      other.hp -= dealt;
      burst += dealt;
      credit(s, 'swing', dealt);
      fx(s, { kind: 'hit', side: 'field', mobId: other.id, via: 'swing', text: eng.fmt(dealt), value: dealt, colour: hitColour(element) });
    }
    if (burst > 0) push(s, `Profane Bloom — ${mob.species} bursts for ${eng.fmt(burst)}`);
    while (s.group.some((m) => m.hp <= 0)) {
      const dead = s.group.splice(s.group.findIndex((m) => m.hp <= 0), 1)[0];
      burySecondaryKill(s, dead);
    }
  }
  // a bursting body pays its poison as it goes (`mob.trait_mechanics.poison_burst`) — a guaranteed
  // line, not a proc, and the one answer to it is the fighter's own status immunity
  if (mob.burst?.ps_pct && !buffRuleUp(s.skills, 'status_immunity') && !bundleOf(c.keystones, 'purist')) {
    if (poisonBurst(mob, statuses, mob.burst.ps_pct)) {
      if (online) push(s, `${mob.species} bursts — poison`);
      fx(s, { kind: 'proc', side: 'self', text: 'poison', colour: statusColour('poison') });
    }
  }
  s.counters.kills++;
  // Packet M — the kill trade-offs. A body pays its healing after it dies, capped by the usable pools
  // so a reservation or the Mana Debt floor still binds what the character can hold.
  const reaper = bundleOf(c.keystones, 'reaper');
  if (reaper) s.player.hp = Math.min(usableHp(c, s.skills), s.player.hp + c.maxHp * Number(reaper.params.healMaxHpPct) / 100);
  const harvest = bundleOf(c.keystones, 'soul-harvest');
  if (harvest) s.player.mana = Math.min(usableMana(c, s.skills), s.player.mana + c.maxMana * Number(harvest.params.restoreMaxManaPct) / 100);
  const trophy = bundleOf(c.keystones, 'trophy-hunter');
  if (trophy) {
    const bossUnique = String(mob.kind).startsWith('Boss') || String(mob.kind).startsWith('Unique');
    const hpPct = Number(bossUnique ? trophy.params.bossHealMaxHpPct : trophy.params.normalHealMaxHpPct);
    const manaPct = Number(bossUnique ? trophy.params.bossRestoreMaxManaPct : trophy.params.normalRestoreMaxManaPct);
    s.player.hp = Math.min(usableHp(c, s.skills), s.player.hp + c.maxHp * hpPct / 100);
    s.player.mana = Math.min(usableMana(c, s.skills), s.player.mana + c.maxMana * manaPct / 100);
  }
  const bloodfeast = bundleOf(c.keystones, 'bloodfeast');
  if (bloodfeast) {
    const bleeding = (statuses.bleed?.secLeft ?? 0) > 0;
    const pct = Number(bleeding ? bloodfeast.params.bleedingHealMaxHpPct : bloodfeast.params.otherHealMaxHpPct);
    s.player.hp = Math.min(usableHp(c, s.skills), s.player.hp + c.maxHp * pct / 100);
  }
  // the feed names pay, not kills: every kill online banks its XP as its own line, so the chronicle ticks
  // with the fight itself. Offline the away summary owns the read.
  if (online) push(s, `+${mob.xp} XP`);
  // the kill flash wears the mob's own innate Element, the same one its resistance answered with. It names
  // the body too: the word still reads in the shared column, and the id is what lets the card it died on
  // show the blow that ended it before it goes.
  fx(s, { kind: 'kill', side: 'field', mobId: mob.id, text: mob.species, colour: hitColour(mob.innate?.[0] || null), value: online ? mob.xp : 0 }, mob);
  s.counters.zoneKills[mob.zone] = (s.counters.zoneKills[mob.zone] || 0) + 1;
  s.player.xp += mob.xp;
  while (s.player.level < E.stat.level_cap && s.player.xp >= eng.xpToNext(s.player.level)) {
    s.player.xp -= eng.xpToNext(s.player.level);
    s.player.level++;
    const per = s.player.level >= E.stat.paragon_from ? E.stat.paragon_points_per_level : E.stat.points_per_level;
    s.player.statPoints += per;
    const oldTreeAt = tree.pointsAt(s.player.level - 1, E.stat.level_cap);
    const newTreeAt = tree.pointsAt(s.player.level, E.stat.level_cap);
    const treePer = newTreeAt - oldTreeAt;
    const qEarned = s.player.questTreePointsEarned ?? 0;
    const spentTree = tree.pointsSpentByCurrency(s.player.treeRanks).tree ?? 0;
    s.player.treePoints = Math.max(0, newTreeAt + qEarned - spentTree);
    push(s, `Level ${s.player.level} — +${per} stat points, +${treePer} tree point${treePer === 1 ? '' : 's'}`);
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
    if (g && !g.duplicate) fx(s, { kind: 'drop', skillId: g.id,
      text: `Learned ${sm.byId[g.id].name}`, colour: hitColour(null, true) });
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
  grantBonusMaterial(s, mob, online);
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
  let gear = 0;
  for (const item of run.escrow.items) {
    adjudicateDrop(s, item);
    fx(s, { kind: 'drop', side: 'field', text: `${item.quality} ${itemName(item)}`, colour: hitColour(null) });
    gear++;
  }
  s.dungeonClearedAt = s.clockSec;
  push(s, `Dungeon cleared — ${run.total} mobs · escrow paid: ${gear} gear, ${paid.junk} junk, ${paid.stones} stones, ${paid.herbs} herbs, ${paid.potions} potions, ${paid.materials} materials · cooling down ${E.dungeon.cooldown_sec}s`);
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
  s.hunting = false;
  s.dungeonClearedAt = s.clockSec;
  let received = 0, receivedMaterials = 0, total = 0;
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
      if (entry.bucket === 'materials') receivedMaterials += got;
      received += got;
    }
  }
  const rejected = total - received;
  push(s, `Dungeon Retreat — selected ${selected.length} stacks (${total} units), received ${received}, ${receivedMaterials} materials, capacity-rejected ${rejected}; the rest forfeited · cooling down ${E.dungeon.cooldown_sec}s`);
  return { ok: true, selected: total, received, rejected };
}

export { push } from './log';
import { push } from './log';

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

/** The tick's feedback line lives in `feedback.ts`; re-exported so every importer keeps its path. */
export { fx, hitColour, statusColour, credit, tickFxClock, FX_RING } from './feedback';
import { fx, hitColour, statusColour, credit, tickFxClock } from './feedback';

/** Patrol and Auto-Return live in `tick/automation.ts`; re-exported for its existing callers. */
export { runExplorationAutomation } from './tick/automation';
import { runExplorationAutomation } from './tick/automation';

/** One second of the world. Fixed tick, every unit on its own timer (combat.md §1). The statuses on
 *  the character live in `s.playerStatuses` — canonical saved state (§7.7), never a caller's argument. */
/** The loaded encounter identity. A released action from another one may not land here. */
export const encounterKeyOf = (s: GameState): string => fieldAreaKey(s);

export interface TickOptions {
  online?: boolean;
  autoSkills?: boolean;
  writer?: boolean;
  arena?: CombatArena;
  settleArena?: CombatArena;
  manual?: ManualControl;
  /** Settlement only: released-work targets stay pinned through the pay-out ticks. */
  settlePinned?: ReadonlySet<string>;
}

/**
 * The values one world second fixes before its combat windows run. A window is 50 ms of the same
 * second: the world stages, the character sheet, the auras and the rotation's own press are read
 * once here, while movement, releases, impacts and command receipts run in every window. Keeping
 * these out of the window is what makes twenty steps and one second produce one timeline.
 */
interface TickSecond {
  startUs: number;
  endUs: number;
  units: number;
  nextUs: number;
  rng: () => number;
  arena?: CombatArena;
  manual?: ManualControl;
  statusesApplied: Set<StatusName>;
  triggerFired: boolean;
  mobAttackPlans: Map<string, import('./tick/mob-actions').MobAttackPlan>;
  playerBasicPlan?: import('./tick/player-basic').PlayerBasicPlan;
  cooldown: { atUs: number };
  engagement: import('./tick/engagement').EngagementState;
  hadGroupBeforeDamage: boolean;
  hadEngagement: boolean;
  pausedAtStart: boolean;
  campEligibleAtStart: boolean;
  camped: boolean;
  halted: boolean;
  haltedAtUs: number;
  cancelArenaWork?: (reason: string) => void;
  derived?: SecondDerived;
}

interface SecondDerived {
  effects: ReturnType<typeof effectsActive>;
  c: ReturnType<typeof characterSheet>;
  attackCharacter: ReturnType<typeof characterSheet>;
  playerActiveFraction: number;
  playerHitsPerSec: number;
  berserkDealt: number;
  crippledOutgoingMult: number;
  unstoppablePenalty: number;
  front: Mob | undefined;
}

const TICK_SECONDS = new WeakMap<GameState, TickSecond>();

const combatStepUs = (units: number) =>
  Math.max(1, Math.round(Number(E.combat_arena.movement_step_sec) * units));

/** The fixed combat step in integer microseconds; the live loop wakes on this beat. */
export const COMBAT_STEP_US = (): number =>
  combatStepUs(tree.mechanics?.combat_time_units_per_sec ?? 1);

function openSecond(s: GameState, opts: TickOptions, units: number, arena: CombatArena | undefined): TickSecond {
  const startUs = s.clockSec * units;
  return {
    startUs,
    endUs: startUs + units,
    units,
    nextUs: startUs,
    // one seeded stream per world second, not per window: a batch of steps must consume the same rolls
    rng: mulberry32(s.rngState++),
    arena,
    manual: opts.manual,
    statusesApplied: new Set(),
    triggerFired: false,
    mobAttackPlans: new Map(),
    cooldown: { atUs: startUs },
    engagement: createEngagementState(),
    hadGroupBeforeDamage: s.group.length > 0,
    hadEngagement: (s.field?.engagementIds.length ?? 0) > 0,
    pausedAtStart: !!deliveryPauseReason(s),
    // The Camp gate is read before the world moves, so a walk that ends, a Push that recovers or a
    // fight that clears this second cannot open a Camp event on the same tick.
    campEligibleAtStart: campEncounterEligible(s),
    camped: false,
    halted: false,
    haltedAtUs: startUs,
  };
}

/** The outer stages of one whole second, run once when its last window closes. */
function closeSecond(s: GameState, opts: TickOptions, second: TickSecond): void {
  const online = opts.online !== false;
  try {
    if (online) recordMapDiscovery(s);
    tickTrailSites(s, online);
    tickDeliveries(s, second.rng, online, second.pausedAtStart, { writer: true });
    tickBlackMarket(s, second.rng, { writer: true }, online);
    tickCampEncounters(s, online, (zone, subzone, campRng) => {
      // A Camp threat is a population pull at the Camp's authored density, not the old 1-5 wave.
      const size = Math.max(1, spawns.profileFor(zone, subzone, 'legacy').cap);
      const group = Array.from({ length: size }, () => spawnMob(campRng, zone, 'normal', undefined, subzone,
        { allowWildUnique: false }));
      return group.sort(byFrontLine);
    }, { eligibleAtStart: second.campEligibleAtStart });
  } finally {
    if (second.arena) {
      second.arena.nowUs = second.halted ? second.haltedAtUs : second.endUs;
      captureCombatArena(second.arena, s, second.arena.nowUs);
    }
    // A Camp second ends at the stage that rested the character: no recovery, fields or arena
    // settlement, exactly as the early return always ordered it. The end stages still read the
    // second's own clock, so a heal or DoT number is stamped at the closing beat, never at wall time.
    if (second.derived && !second.camped) {
      tickFxClock.set(s, { clock: new CombatClock(second.endUs, second.endUs), arena: second.arena });
      try {
        tickSecondEnd(s, second);
      } finally {
        tickFxClock.delete(s);
      }
    }
  }
}

/**
 * Advance the world by one combat step (50 ms at the default mechanics). Commands are judged inside
 * this window, so input latency is the step, never a whole second. A second is opened on its first
 * step and closed on its last; the same function backs both the live loop and the whole-second
 * `tick`, so a different batch size cannot reorder an event or reroll a number.
 */
export function stepCombat(s: GameState, opts: TickOptions = {}): GameState {
  if (opts.writer === false) return s;
  const units = tree.mechanics?.combat_time_units_per_sec ?? 1;
  const arena = opts.online === false ? opts.settleArena : opts.arena;
  let second = TICK_SECONDS.get(s);
  // A shallow presentation copy (a Svelte `$state.raw` refresh) shares this arena's ground,
  // actions and frames; it is the same encounter and must not restart the second. A genuinely
  // different arena does, and its unspent work belongs to the truth it left.
  const sameArenaView = (a?: CombatArena, b?: CombatArena) => !!a && !!b
    && a.frames === b.frames && a.actions === b.actions && a.player === b.player
    && a.mobs === b.mobs && a.flights === b.flights;
  if (second && (second.units !== units
    || (second.arena !== arena && (!!second.arena || !!arena) && !sameArenaView(second.arena, arena)))) {
    if (second.derived) tickSecondEnd(s, second);
    TICK_SECONDS.delete(s);
    second = undefined;
  }
  if (second && second.arena !== arena) second.arena = arena;
  if (!second) {
    second = openSecond(s, opts, units, arena);
    TICK_SECONDS.set(s, second);
  } else {
    if (opts.manual !== undefined) second.manual = opts.manual;
    second.arena = arena;
  }
  if (!second.camped && !second.halted) {
    const fromUs = second.nextUs;
    const toUs = Math.min(fromUs + combatStepUs(units), second.endUs);
    tickWorld(s, { ...opts, manual: second.manual }, second, fromUs, toUs);
    if (second.camped || second.halted) second.nextUs = second.endUs;
    else second.nextUs = toUs;
  }
  if (second.nextUs >= second.endUs) {
    closeSecond(s, opts, second);
    TICK_SECONDS.delete(s);
  }
  return s;
}

export function tick(s: GameState, opts: TickOptions = {}): GameState {
  if (opts.writer === false) return s;
  let guard = 0;
  do {
    stepCombat(s, opts);
  } while (TICK_SECONDS.get(s) && guard++ < 64);
  return s;
}

function tickSecondEnd(s: GameState, second: TickSecond): void {
  const d = second.derived!;
  // An attack the second did not spend (the fatal latch or a skipped window) stays on its own
  // clock for the next second instead of being rerolled or lost.
  for (const plan of second.mobAttackPlans.values()) {
    const unfired = plan.times.length - plan.fired;
    if (unfired > 0) plan.mob.atkTimer += unfired;
  }
  // A Boss owns a local arena epoch. Its death settles the epoch, never the work of other bodies:
  // a committed shot from its own release still lands, and the field keeps fighting.
  if (s.field?.bossDefeatedAtSec === s.clockSec) {
    s.field.arenaEpoch++;
    s.field.bossDefeatedAtSec = undefined;
  }
  if (second.hadEngagement && s.field && s.field.engagementIds.length === 0) {
    const wasPatrolling = s.patrol.active;
    const patrolNote = recordPatrolGroupClear(s, s.online !== false);
    if (patrolNote) push(s, patrolNote);
    runExplorationAutomation(s, s.online !== false, wasPatrolling);
  }
  if (second.hadGroupBeforeDamage && s.group.length === 0) {
    const wasPatrolling = s.patrol.active;
    const patrolNote = recordPatrolGroupClear(s, s.online !== false);
    if (patrolNote) push(s, patrolNote);
    runExplorationAutomation(s, s.online !== false, wasPatrolling);
  }
  if (!second.halted) {
    advanceRecovery({
      s, c: d.c, statuses: s.playerStatuses, debt52: bundleOf(d.c.keystones, 'mana-debt'),
      units: second.units, tickStartUs: second.startUs, tickEndUs: second.endUs,
      playerActiveFraction: d.playerActiveFraction,
    });
  }
  advancePostTick(s, d.c, second.rng, s.playerStatuses, second.statusesApplied);
  if (s.player.hp <= 0) {
    applyPush({ s, c: d.c, statuses: s.playerStatuses,
      cancelArenaWork: second.cancelArenaWork ?? (() => {}) });
  }
  settleTick(s, second.arena);
}

function tickWorld(s: GameState, opts: TickOptions, second: TickSecond, tickStartUs: number, tickEndUs: number): GameState {
  const online = opts.online !== false;
  const autoSkills = opts.autoSkills !== false;
  const manual = second.manual;
  const rng = second.rng;
  const secondStart = tickStartUs === second.startUs;
  // the character's statuses (§7.7): this is the one reference into the saved state, not a copy
  const statuses = s.playerStatuses;
  // §7.1: every event is stamped in absolute integer µs off the second's own start. A spec without
  // the mechanics line falls back to whole seconds, which is the pre-keystone world rate.
  const unitsPerSec = tree.mechanics?.combat_time_units_per_sec;
  const units = second.units;
  // the Push latch (§7.7): a fatal hit stops every later event of the second, so no heal revives it
  const clock = new CombatClock(tickStartUs, tickEndUs, () => s.player.hp <= 0);
  // An arena is ignored during ordinary offline catch-up; `settleArena` is the one exception, used
  // to resolve work that was already released before the session ended.
  const arena = online ? opts.arena : opts.settleArena;
  const { cancelPlayerBasic, cancelIntent, cancelArenaWork, cancelFlight } = createArenaWork({ arena, clock, s });
  second.cancelArenaWork = cancelArenaWork;

  // Asked per movement sample: a threat that is still pending must be re-answered instead of letting
  // the automatic approach walk the body back under it between world ticks.
  const autoAvoid = () => (arena && !manual?.moveTo && !manual?.cast && !arena.intent?.manual
    ? planAutoAvoid(arena, s, clock.nowUs, units) : null);
  const timeUs: number | null = unitsPerSec === undefined ? null : tickStartUs;
  s.online = online;
  let derived = second.derived;
  if (!derived) {
    s.clockSec++;
    advancePreTick(s, online);
    const effects = effectsActive(s.skills, tree.keystoneBundles(s.player.treeRanks));
    const c = characterSheet(s, effects);
    derived = {
      effects, c, attackCharacter: c, playerActiveFraction: 1, playerHitsPerSec: c.hitsPerSec,
      berserkDealt: 1, crippledOutgoingMult: 1, unstoppablePenalty: 1, front: undefined,
    };
    second.derived = derived;
    applyKeystonePrep(s, c, bundleOf(c.keystones, 'mana-debt'), units, tickStartUs);
    const day = dayOf(s.clockSec);
    if (s.pedlar.day !== day || !s.pedlar.minutes.length) {
      s.pedlar = {
        day,
        bought: 0,
        minutes: Array.from({ length: col.PEDLAR.per_day_cap }, () => col.pedlarPrice(rng())),
      };
    }
    advanceForward(s, online);
    tickTown(s, rng);
    runExplorationAutomation(s, online);
    if (advanceCampStage(s, c)) {
      second.camped = true;
      return s;
    }
    // While walking, the character crosses one block per `block_sec`. No ambient zone group appears:
    // a walk is its own minute-to-minute activity — and it is ONLINE only, so an away period never
    // crosses a block and never opens a Waypoint it did not earn online.
    advanceWalkStage(s, online, rng);
  }
  const { effects, c } = derived;
  const rkH = s.keystoneRuntime;
  // Packet N helpers: one read each for the rules that cross the swing and cast paths.
  const mirrorReady = () => Boolean(bundleOf(c.keystones, 'mirror-strike'))
    && Boolean(rkH.flags.mirrorCrit) && clock.nowUs <= (rkH.icdsUs.mirrorUntil ?? 0);
  const luckyBonus = () => {
    const lucky = bundleOf(c.keystones, 'lucky-streak');
    if (!lucky) return 0;
    return Math.min(Number(lucky.params.maxStacks), rkH.stacks.luckyStreak || 0)
      * Number(lucky.params.critDamagePctPerStack);
  };
  const tranceFree = () => {
    const trance = bundleOf(c.keystones, 'trance');
    if (!trance) return false;
    return ((rkH.counters.tranceCasts || 0) + 1) % Number(trance.params.everyCasts) === 0;
  };
  const spreadShock = (target: { id: string; immune?: string[] }) => {
    const cond = bundleOf(c.keystones, 'conductive');
    if (!cond) return;
    const shock = s.mobStatus[target.id]?.statuses.shock;
    if (!shock || shock.secLeft <= 0) return;
    let left = Number(cond.params.spreadTargets);
    // Nearest living bodies first when the arena knows the ground (F39); otherwise group order.
    const origin = arena?.mobs[target.id];
    const ordered = origin
      ? [...s.group].map((other, index) => {
        const pose = other.id === target.id ? undefined : arena!.mobs[other.id];
        return { other, index, dist: !pose ? Infinity : arenaDistance(origin, pose) };
      }).sort((a, b) => a.dist - b.dist || a.index - b.index).map((entry) => entry.other)
      : s.group;
    for (const other of ordered) {
      if (left <= 0) break;
      if (other.id === target.id) continue;
      if (copyStatus(s.mobStatus, target.id, other.id, 'shock', other.immune || [])) left--;
    }
  };
  // Deaths inside a tick carry the arena ground with them, so Profane Bloom (F40) and any
  // future burst can read the blast origin. Away from the arena the lookup is absent and the
  // legacy whole-group behaviour stands in, documented, not silent.
  const mobPositions = arena ? (id: string) => {
    const pose = arena.mobs[id];
    return pose ? { x: pose.x, y: pose.y } : undefined;
  } : undefined;
  function killMob(s: GameState, rng: () => number, mob: Mob, c: ReturnType<typeof buildCharacter>, statuses: Statuses = {}, bloomChain = true) {
    onKill(s, rng, mob, c, statuses, bloomChain, mobPositions);
  }
  // leaving the run's zone ends the run: a dungeon is entered ground, not a destination

  function fieldProfile() {
    return spawns.profileFor(s.zone, s.cell?.sub ?? null, opts.online === false ? 'legacy' : 'live');
  }

  if (secondStart) {
    advanceFieldPopulation(s, {
      arena, c, online, rng, tickStartUs, units, fieldProfile, spawnMob,
    });
    // The per-fight potion budget belongs to a combat session, not to each spawn.
    if (syncFieldState(s, arena, 2, false)) s.farm.usesThisFight = 0;
    // the completion gate is armed before the first swing of a spawn, so a fast kill still counts
    goalWatch(s);
    for (const m of s.group) goalSpawn(s, m);
  }

  // Engagement is spatial: only bodies inside aggro, an assist neighbour, or the player's committed
  // target may attack. The same resolver runs again after every authoritative movement sample, so
  // joining or leaving is not delayed a second.
  const { syncEngagement, alertContact } = advanceEngagement(s, {
    arena, online, fieldProfile, cancelMobPreparation, tickStartUs,
    state: second.engagement, prime: secondStart, pinnedIds: opts.settlePinned,
  });

  /** A resolved hostile contact alerts its body once; selection or a pre-release press does not. */
  function alertHostileContact(mobId: string): void {
    if (!arena || !s.field || !mobId) return;
    const delta = alertContact(mobId, clock.nowUs);
    for (const id of delta.added) {
      const mob = s.group.find((entry) => entry.id === id && entry.hp > 0);
      if (mob) scheduleMobAttacksFor(mob, clock.nowUs);
    }
  }

  const engagedIds = new Set(s.field?.engagementIds ?? []);
  const engaging = s.group.filter((mob) => mob.hp > 0 && (!arena || engagedIds.has(mob.id)));
  // Auras are read from the living engaged bodies before either side's events are scheduled, so the
  // player's damage and the mob clock in this tick answer the same effective modifiers.
  if (secondStart) {
    const auraRadius = Number(E.mob.aura_radius_m) || 4;
    applyMobAuras(s.group, engaging, arena
      ? (sourceId, targetId) => {
          const source = arena.mobs[sourceId], target = arena.mobs[targetId];
          return !source || !target || arenaDistance(source, target) <= auraRadius + 1e-7;
        }
      : undefined);
    derived.front = s.group[0];
  }
  const front = derived.front;

  /** Everything one mob carries: curse lines (conditional ones only while their status holds),
   *  the statuses we inflicted, and the target-side lines an aura writes on everything in range. */
  const auraTarget = modsFromAuraFold(effects.target || {});
  const mobMods = (mobId: string) => combineMods(
    combineMods(
      combineMods(modsOn(s.curses, mobId, (cond) => holdsCondition(s.mobStatus, mobId, cond)),
        targetMods(statusModsOn(s.mobStatus, mobId))),
      auraTarget,
    ),
    keystoneTargetMods(s.mobStatus, mobId, c),
  );

  const unabated = bundleOf(c.keystones, 'unstoppable');
  if (secondStart) {
    // Shock spends only its remaining part of this one-second step. Vit's Stun Recovery shortens that
    // stopped slice, and the attack / cooldown / regen clocks advance through the rest of the second.
    const shockSecLeft = Math.max(0, statuses.shock?.secLeft || 0);
    // 02 Unstoppable: Stun no longer stops the action, and Slow no longer cuts the attack rate; while
    // either effect would have done so, outgoing damage is multiplied by its penalty instead (§5.02).
    const slowed = (statuses.shock?.secLeft || 0) > 0 || (statuses.chill?.secLeft || 0) > 0;
    derived.unstoppablePenalty = unabated && slowed ? Number(unabated.params.penaltyDamageMult) : 1;
    derived.playerActiveFraction = unabated ? 1 : Math.max(0, 1 - Math.min(1, shockSecLeft));
    const chill = statuses.chill && statuses.chill.secLeft > 0 ? statuses.chill : null;
    const chillAspdCut = chill && !unabated
      ? Math.min(E.status.chill.aspd_cap, chill.stacks * E.status.chill.aspd_pct) / 100 : 0;
    const shockAccuracyCut = statuses.shock
      ? Math.min(E.status.shock.acc_cap, E.status.shock.acc_pct) / 100 : 0;
    const crippled = statuses.crippled && statuses.crippled.secLeft > 0 ? statuses.crippled : null;
    derived.crippledOutgoingMult = crippled
      ? 1 + E.status.crippled.outgoing_damage_pct / 100 : 1;
    derived.attackCharacter = shockAccuracyCut > 0
      ? { ...c, accuracy: c.accuracy * (1 - shockAccuracyCut) } : c;
    // 03 Berserk: Low Life against the FULL Max HP grants damage and speed, while the take-more line
    // is always on (the taken multiplier is applied per incoming Hit below).
    const lowLife = belowLowLife(s.player.hp, c.maxHp, tree.mechanics?.low_life_pct ?? 50);
    const berserkOn = !!bundleOf(c.keystones, 'berserk') && lowLife;
    const berserkHeld = bundleOf(c.keystones, 'berserk');
    derived.berserkDealt = berserkOn ? Number(berserkHeld!.params.damageMult) : 1;
    derived.playerHitsPerSec = c.hitsPerSec * (berserkOn ? Number(berserkHeld!.params.aspdMult) : 1)
      * Math.max(0, 1 - chillAspdCut);
  }
  const {
    playerActiveFraction, playerHitsPerSec, berserkDealt, crippledOutgoingMult, unstoppablePenalty,
  } = derived;
  const playerRange = arena ? arenaWeaponRange(c.weaponName) : 0;
  const playerStopRange = arena ? arenaWeaponStopRange(c.weaponName) : 0;
  // A skill walks on its own range: the row's cast range, or its own radius for
  // caster-centred circles. Weapon range never shortens it — a mage with a 4.6 row
  // approaches to 4.6, not to weapon distance.
  const skillRange = (id: string) => {
    const skill = sm.byId[id];
    if (!skill || skill.type === 'buff' || skill.type === 'heal') return playerRange;
    const area = skill.area;
    if (area?.origin === 'caster' && (area.radius_m || 0) > 0) return area.radius_m;
    return arenaSkillRange(id);
  };
  const approachRange = () => {
    // Basic attacks have their own profile stop; skills still stop just inside their cast range.
    if (!autoSkills) return playerStopRange;
    const held = arena?.intent?.skillId;
    if (held) return Math.max(0, skillRange(held) - 0.05);
    const ready = rotationOrder(s.skills).find((id) => {
      const skill = sm.byId[id];
      return (skill.type === 'attack' || skill.type === 'curse')
        && skillEligibilityInState(s, c, id).ready;
    });
    return ready ? Math.max(0, skillRange(ready) - 0.05) : playerStopRange;
  };
  const cooldown = second.cooldown;
  const { advanceLiveClocks } = createLiveClocks({ arena, s, c, units, cooldown, playerActiveFraction });
  const { advanceArenaAt } = createArenaStep({
    arena, s, clock, units, manual, autoAvoid, cancelPlayerBasic, cancelIntent, cancelMobPreparation,
    advanceLiveClocks, approachRange, playerActiveFraction, statusModsOn, syncEngagement,
    scheduleMobAttacksFor: (mob, atUs) => scheduleMobAttacksFor(mob, atUs),
    sweepFlights: (atUs) => sweepFlights(atUs),
    sweepMobShots: (atUs) => sweepMobShots(atUs),
    sweepPlayerShots: (atUs) => sweepPlayerShots(atUs),
    fieldProfile,
  });
  const resolveTargetsForSkill = arena ? (id: string, group: Mob[]) => {
    advanceArenaAt(clock.nowUs);
    return arenaSkillTargets(arena, id, group);
  } : undefined;
  const statusesAppliedThisTick = second.statusesApplied;
  const attackCharacter = derived.attackCharacter;
  const berserk = bundleOf(c.keystones, 'berserk');
  // the events the trigger auras listen for, collected where they happen: a crit in this tick's swings,
  // and any hit that took HP or Energy Shield off the player
  const trig = triggerAuras(s.skills);

  /** Hits and DoT share the leech destination, usable ceiling and excess bank. */
  function recoverLeech(amount: number, atUs: number): void {
    if (!(amount > 0)) return;
    const pool = bundleOf(c.keystones, 'dark-siphon') ? 'es' : 'hp';
    const max = pool === 'es' ? c.es : usableHp(c, s.skills);
    const before = s.player[pool];
    s.player[pool] = Math.min(max, before + amount);
    const bank = bundleOf(c.keystones, 'endless-hunger');
    const excess = amount - (s.player[pool] - before);
    if (bank && excess > 0) {
      const held = s.keystoneRuntime.bank.filter((entry) => entry.pool === pool).reduce((sum, entry) => sum + entry.amount, 0);
      const fullMax = pool === 'es' ? c.es : c.maxHp;
      const banked = endlessHungerBank(held, excess, fullMax, bank.params as Record<string, number>) - held;
      if (banked > 0) s.keystoneRuntime.bank.push({
        pool, amount: banked, expiresAtUs: atUs + Number(bank.params.expirySec) * units,
      });
    }
    fx(s, { kind: 'heal', side: 'self', text: `+${eng.fmt(s.player[pool] - before)}`, colour: hitColour(null) });
  }

  /** Queue the trigger aura at the event that raised it (§7.1 priority 50), never inline-mid-swing. */
  function queueTrigger(aura: TriggerAura | null, targetId: string) {
    if (!autoSkills || !aura) return;
    clock.schedule(clock.nowUs, EVENT_PRIORITY.secondary, 'player', targetId, () => {
      if (second.triggerFired || clock.halted) return;
      second.triggerFired = true;
      fireTrigger(aura);
    });
  }

  const arenaActors = (group: Mob[]) => group.flatMap((mob) =>
    mob.hp > 0 && arena?.mobs[mob.id] ? [{ ...arena.mobs[mob.id], mob }] : []);

  // The cast and intent factories schedule flights before the flight factory can be built (it needs
  // their outcome), so the one released-flight boundary is a late-bound holder.
  const flightWork = {
    schedule: (_flight: CombatFlight) => {},
    resolve: (_flight: CombatFlight, _atUs: number, _forced?: Mob[], _contact?: { x: number; y: number }) => {},
  };

  const { payCast, castFx, applyCastOutcome, applyCast, fireTrigger, launchTrigger } = createCastTrigger({
    arena, clock, rng, s, c, attackCharacter, units, timeUs, statuses, rkH, front,
    crippledOutgoingMult, playerActiveFraction, trig, queueTrigger, recoverLeech,
    mirrorReady, luckyBonus, tranceFree, arenaActors, resolveTargetsForSkill,
    resolveFlight: (flight, atUs, forced) => flightWork.resolve(flight, atUs, forced),
    scheduleFlight: (flight) => flightWork.schedule(flight), onKill: killMob,
    alertContact: alertHostileContact,
  });

  const { scheduleFlight, resolveFlight, sweepFlights } = createFlights({
    arena, clock, rng, s, statuses, units, tickStartUs, tickEndUs,
    advanceLiveClocks, applyCastOutcome, cancelIntent, cancelFlight,
  });
  flightWork.schedule = scheduleFlight;
  flightWork.resolve = resolveFlight;

  const { startWindup, scheduleRelease, releaseIntent } = createIntents({
    arena, clock, rng, s, c, attackCharacter, units, tickEndUs, timeUs, statuses, rkH, front,
    crippledOutgoingMult, playerActiveFraction, trig, advanceLiveClocks, queueTrigger, recoverLeech,
    mirrorReady, luckyBonus, tranceFree, resolveTargetsForSkill,
    resolveFlight: (flight, atUs, forced) => flightWork.resolve(flight, atUs, forced),
    scheduleFlight: (flight) => flightWork.schedule(flight),
    applyCastOutcome, applyCast, payCast, castFx, cancelIntent, cancelPlayerBasic, cancelFlight,
    fireTrigger,
  });

  // F27 — the hold is a property of the sample, not of the world tick's one press. The automatic
  // rotation may not spend on a filler the mana a reactive re-arm is waiting for, even when a row
  // carries no cooldown. A deliberate order always passes.
  const holdFiller = () => {
    if (!autoSkills || manual?.cast || manual?.moveTo) return false;
    const hold = reactiveRearm(s, c, statuses);
    return hold > 0 && hold <= usableMana(c, s.skills) && (c.manaRegen || 0) > 0
      && spendableMana(attackCharacter, s.skills, s.player.mana) < hold;
  };
  const { ensureIntent } = createIntentSelect({
    arena, s, attackCharacter, autoSkills, playerActiveFraction, manual,
    cancelIntent, startWindup, holdFiller,
  });

  /** Control delays a body's whole committed plan, not only this window's already-queued events. */
  const delayMobPlan = (mobId: string, delaySec: number): boolean => {
    const plan = second.mobAttackPlans.get(mobId);
    if (!plan) return false;
    const shift = Math.round(delaySec * units);
    for (let index = plan.nextAttack; index < plan.times.length; index++) plan.times[index] += shift;
    plan.mob.atkTimer -= plan.rate * delaySec;
    return true;
  };

  // §7.1: the basic swing is expanded from accumulated progress into absolute-µs events, so a stop,
  // a rate change or a kill inside the window moves the queue instead of replaying the second.
  const { schedulePlayerBasic, schedulePlayerShot, sweepPlayerShots } = createPlayerBasicActions({
    arena, clock, rng, s, c, attackCharacter, units, tickStartUs, tickEndUs,
    plan: second.playerBasicPlan, savePlan: (plan) => { second.playerBasicPlan = plan; }, online, manual,
    crippledOutgoingMult, unstoppablePenalty, berserkDealt, playerHitsPerSec, playerActiveFraction,
    statuses, trig, queueTrigger, recoverLeech, mobMods, delayMobPlan, spreadShock, mirrorReady,
    luckyBonus, advanceArenaAt, alertContact: alertHostileContact, cancelIntent, onKill: killMob, dominantElement,
    applyEquilibrium, revertEquilibrium,
  });

  // The rotation presses at t0 (§7.1 priority 30), before the first window's own events. The buff
  // clocks age once per second, so this press is the second's own, never one per combat step.
  if (secondStart) schedulePlayerAction({
    arena, clock, rng, s, c, attackCharacter, autoSkills, playerActiveFraction, online, tickStartUs,
    frontId: front?.id ?? '', statuses, cooldown, ensureIntent, cancelIntent, manual,
    resolveTargetsForSkill, tranceFree, mirrorReady, luckyBonus, applyCast,
  });

  // statuses age once a second, and the DoT they deal lands before the second's actions (§7.1 priority 10)
  if (secondStart) scheduleMobDot({
    clock, tickStartUs, s, c, rng, statuses, mobMods, recoverLeech, revertEquilibrium, onKill: killMob,
  });

  // Committed payments use their own timestamps and the same fatal-damage latch as direct hits.
  const debtQueue = s.keystoneRuntime.queues.hpDebt;
  for (const payment of debtQueue) {
    if (payment.dueAtUs > tickEndUs) continue;
    clock.schedule(payment.dueAtUs, EVENT_PRIORITY.pendingDamage, payment.sourceId ?? '', 'player', () => {
      debtQueue.splice(debtQueue.indexOf(payment), 1);
      s.player.hp -= payment.amount;
    });
  }
  const deferredQueue = s.keystoneRuntime.queues.deferred;
  for (const payment of deferredQueue) {
    if (payment.dueAtUs > tickEndUs) continue;
    clock.schedule(payment.dueAtUs, EVENT_PRIORITY.pendingDamage, 'player', payment.targetId ?? '', () => {
      deferredQueue.splice(deferredQueue.indexOf(payment), 1);
      const target = s.group.find((mob) => mob.id === payment.targetId);
      if (!target) return;
      target.hp -= payment.amount;
      credit(s, 'swing', payment.amount);
      fx(s, { kind: 'hit', side: 'field', mobId: target.id, via: 'swing', text: eng.fmt(payment.amount), value: payment.amount, colour: hitColour(null) });
      if (target.hp <= 0) {
        s.group.splice(s.group.indexOf(target), 1);
        killMob(s, rng, target, c, statuses);
      }
    });
  }

  // mob clocks: the same accumulated-progress expansion, each swing stamped at its own µs (§7.1 priority 40)
  const immune = buffRuleUp(s.skills, 'status_immunity');
  // Energy Absorb turns a share of every landed hit into Energy Shield and negates it outright 
  const absorbPct = esAbsorbPct(s.skills);
  /**
   * One incoming direct hit, resolved wherever it actually lands. The caller owns release-range,
   * target and opportunity checks; defence, statuses and keystone reactions read live state here.
   */
  const { resolveIncomingHit } = createIncomingHit({
    arena, clock, rng, s, c, units, online, rkH, statuses, statusesAppliedThisTick,
    trig, immune, absorbPct, berserk, berserkDealt, mobMods, queueTrigger, cancelIntent, cancelPlayerBasic, onKill: killMob,
  });

  const { launchMobShot, cancelMobShot, resolveMobShot, scheduleMobShot, sweepMobShots } = createMobShots({
    arena, clock, rng, s, tickStartUs, tickEndUs, units, resolveIncomingHit,
  });

  function cancelMobPreparation(action: CombatArenaAction, atUs: number, reason: string) {
    if (arena && action.cancelledAtUs == null)
      updateArenaAction(arena, action.id, { cancelledAtUs: atUs, cancelReason: reason, endsAtUs: atUs });
  }

  /** Start an ordinary basic with an executable windup; release is the only contact receipt. */
  const { startMobBasic, scheduleMobBasic, launchMobSkillShot, scheduleMobStrike, scheduleMobAttacksFor } = createMobActions({
    arena, clock, rng, s, units, tickStartUs, tickEndUs, secondEndUs: second.endUs,
    plans: second.mobAttackPlans, advanceArenaAt, launchMobShot, cancelMobPreparation, resolveIncomingHit,
    mobMods, shiftPlan: delayMobPlan,
    onPhaseAdds: (boss, phase) => {
      // F25 adds: a phase gate is a kit fact, not a timer. Adds pay ordinary rewards and carry the
      // caller's id, so a reward read can classify them without a second settlement path.
      const count = Math.max(1, Math.floor(Number(E.mob.phase_adds?.count ?? 2)));
      let added = 0;
      for (let index = 0; index < count; index++) {
        const add = spawnMob(rng, s.zone, 'normal', undefined, s.cell?.sub ?? null, { allowWildUnique: false });
        add.addedBy = boss.id;
        s.group.push(add);
        added++;
      }
      if (arena && added) syncCombatArena(arena, s, clock.nowUs, units, c.maxHp);
      if (added) push(s, `${boss.species} calls ${added} add${added === 1 ? '' : 's'} (phase ${phase})`);
    },
    online,
  });

  // The player's prepared basic keeps its release beat across a tick boundary.
  if (arena) {
    const action = arena.player.action;
    if (action?.kind === 'swing' && action.timing && action.cancelledAtUs == null
      && !action.impactCount && action.releasedAtUs == null) {
      const target = action.targetId
        ? s.group.find((mob) => mob.id === action.targetId && mob.hp > 0) : undefined;
      if (!target || (action.areaKey && action.areaKey !== encounterKeyOf(s)))
        cancelPlayerBasic(!target ? 'target lost' : 'area-exit');
      else schedulePlayerBasic(action, target);
    }
  }
  // A body removed by resync can no longer own a pending preparation; drop its receipt by name.
  if (arena) for (const action of [...arena.actions]) {
    if (action.actorId === 'player' || action.kind === 'death' || action.cancelledAtUs != null
      || action.impactCount || action.releasedAtUs != null) continue;
    if (!arena.mobs[action.actorId]) cancelMobPreparation(action, tickStartUs, 'source-unavailable');
  }
  // Unpaid preparations and basic windups retain their release time across tick boundaries.
  if (arena) for (const actor of Object.values(arena.mobs)) {
    const action = actor.action;
    if (!action?.timing || action.impactCount || action.releasedAtUs != null || action.cancelledAtUs != null) continue;
    const mob = engaging.find(entry => entry.id === actor.id && entry.hp > 0);
    if (action.kind === 'cast') {
      if (!mob) cancelMobPreparation(action, tickStartUs, 'source-unavailable');
      else scheduleMobStrike(action, mob);
    } else if (action.kind === 'swing' && action.releasedAtUs == null) {
      if (!mob) cancelMobPreparation(action, tickStartUs, 'source-unavailable');
      else scheduleMobBasic(action, mob);
    }
  }

  for (const mob of engaging) scheduleMobAttacksFor(mob, tickStartUs);

  // §7.1: run the window's events in time order. A fatal hit latches Push and stops the rest, so no
  // recovery event behind it can revive the character.
  if (arena) {
    if (arena.intent?.phase === 'windup') {
      arena.intent.releaseQueued = false;
      scheduleRelease(arena.intent);
    }
    for (const flight of arena.flights) flight.queued = false;
    for (const flight of [...arena.flights]) scheduleFlight(flight);
    for (const shot of arena.mobFlights) shot.queued = false;
    for (const shot of [...arena.mobFlights]) scheduleMobShot(shot);
    for (const shot of arena.playerShots) shot.queued = false;
    for (const shot of [...arena.playerShots]) schedulePlayerShot(shot);
    const stepUs = combatStepUs(units);
    // Every window ends on its own movement sample, so a command received during it is judged on
    // this beat instead of waiting for the next whole second.
    for (let atUs = tickStartUs + stepUs; atUs <= tickEndUs; atUs += stepUs) {
      clock.schedule(atUs, EVENT_PRIORITY.expire, 'arena', '', () => {
        advanceArenaAt(clock.nowUs);
        ensureIntent(clock.nowUs);
      });
    }
    if (tickEndUs > tickStartUs && tickEndUs - tickStartUs < stepUs) {
      clock.schedule(tickEndUs, EVENT_PRIORITY.expire, 'arena', '', () => {
        advanceArenaAt(clock.nowUs);
        ensureIntent(clock.nowUs);
      });
    }
  }
  tickFxClock.set(s, { clock, arena });
  try {
    clock.runUntil(tickEndUs);
  } finally {
    tickFxClock.delete(s);
  }
  if (clock.halted) {
    second.halted = true;
    second.haltedAtUs = clock.nowUs;
  }
  return s;
}

/**
 * The live wake, as one pure step: real time in, whole sim seconds out. The tab wakes every
 * `WAKE_SEC`, the player's speed multiplies what that wake is worth, and never more than `MAX_BATCH`
 * seconds are spent in one wake — a throttled tab's backlog is dropped rather than queued, because a
 * queued burst would play catch-up in the foreground and cost the frame its stutter-free draw.
 *
 * The wake math lives in `clock.ts`; it is re-exported here so every existing importer keeps its path.
 */
export { dayOf, WAKE_SEC, MAX_BATCH, schedulerBatch, schedulerSteps, catchUpPlan } from './clock';
import { catchUpPlan, dayOf } from './clock';

/** The tick loop both catch-up paths share — one order of ticks, so the numbers cannot diverge. */
function runTicks(s: GameState, from: number, to: number, autoSkills = true) {
  for (let i = from; i < to; i++) tick(s, { online: false, autoSkills });
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

/**
 * The dungeon cooldown is an online gate like the boss clock: away time must not accrue toward it.
 * A run that cleared mid-window stamped its cooldown at a virtual mid-away second, so shifting the
 * whole window would over-charge it; that stamp is re-set to the return second instead, and the
 * full `cooldown_sec` stands when the player is back.
 */
function settleDungeonClock(s: GameState, startClock: number, secs: number): void {
  if (s.dungeonClearedAt === undefined) return;
  if (s.dungeon === null && s.dungeonClearedAt > startClock && s.dungeonClearedAt <= startClock + secs) {
    s.dungeonClearedAt = startClock + secs;
  } else {
    s.dungeonClearedAt += secs;
  }
}

/** The longest stretch of released work one reload settles before ordinary away ticks take over.
 *  It is a ruleset value (`engine.json → save.settle_seconds_cap`), never a code constant. */
const SETTLE_SECONDS_CAP = Number(E.save.settle_seconds_cap);

/**
 * Arena ticks that settle released work saved with the character. A projectile owed ten seconds
 * from now must be paid ten seconds from now, not clamped to the first second after reload, so the
 * settlement keeps stepping until nothing is owed; every second it spends counts against away time.
 */
function settleSavedPendingWork(s: GameState, autoSkills: boolean, budgetSec = 1): number {
  const budget = Math.min(Math.max(0, Math.floor(budgetSec)), SETTLE_SECONDS_CAP);
  let done = 0;
  // Every target named by the released ledger is pinned while its impact is owed: the body stays
  // in the engagement and keeps its wounds until the shot settles.
  const pinned = new Set<string>();
  for (const flight of s.pendingWork?.flights ?? []) {
    for (const id of flight.targetIds) pinned.add(id);
    if (flight.area?.targetId) pinned.add(flight.area.targetId);
  }
  while (s.pendingWork && done < budget) {
    const units = tree.mechanics?.combat_time_units_per_sec ?? 1;
    const arena = createCombatArena();
    syncCombatArena(arena, s, s.clockSec * units, units, characterSheet(s).maxHp);
    if (restorePendingWork(arena, s) <= 0) {
      s.pendingWork = null;
      break;
    }
    tick(s, { online: false, autoSkills, settleArena: arena, settlePinned: pinned });
    done++;
    if (!s.pendingWork) break;
  }
  return done;
}

/** Synchronous catch-up — tests and any non-UI caller. */
export function catchUp(s: GameState, elapsedSec: number, opts: { autoSkills?: boolean } = {}) {
  const { secs, capped } = catchUpPlan(elapsedSec);
  const startClock = s.clockSec;
  // No away second, no settlement: released work stays owed until the budget can pay for it.
  const settled = secs > 0 ? settleSavedPendingWork(s, opts.autoSkills !== false, secs) : 0;
  const ticks = Math.max(0, secs - settled);
  runTicks(s, 0, ticks, opts.autoSkills !== false);
  const simulated = settled + ticks;
  pauseBossClock(s, simulated);
  settleDungeonClock(s, startClock, simulated);
  return { simulated, capped };
}

/**
 * The UI's catch-up uses the same ticks, yielding by time and tick count without dropping elapsed time.
 * Cancelling returns a valid partial state; abandoning a load leaves its original slot untouched.
 */
export async function catchUpAsync(s: GameState, elapsedSec: number, opts: {
  autoSkills?: boolean; signal?: AbortSignal; onProgress?: (done: number, total: number) => void;
} = {}) {
  const { secs, capped } = catchUpPlan(elapsedSec);
  const startClock = s.clockSec;
  const SLICE = 2000;
  // Work released before the save resolves before any away time is simulated, through the same
  // arena/tick path that pays kills and rewards exactly once. This tick counts against the away
  // budget so the catch-up does not grant a free extra second.
  let done = secs > 0 && !opts.signal?.aborted
    ? settleSavedPendingWork(s, opts.autoSkills !== false, secs) : 0;
  opts.onProgress?.(done, secs);
  while (done < secs && !opts.signal?.aborted) {
    const end = Math.min(done + SLICE, secs);
    const started = performance.now();
    do {
      tick(s, { online: false, autoSkills: opts.autoSkills !== false });
      done++;
    } while (done < end && !opts.signal?.aborted && performance.now() - started < 16);
    opts.onProgress?.(done, secs);
    if (done < secs && !opts.signal?.aborted) await new Promise((r) => setTimeout(r, 0));
  }
  pauseBossClock(s, done);
  settleDungeonClock(s, startClock, done);
  return { simulated: done, capped, ...(opts.signal?.aborted ? { cancelled: true } : {}) };
}

export const equippedCount = (s: GameState) => s.gear.filter(Boolean).length;
export const slots = SLOT_COUNT;
export type { Item };
