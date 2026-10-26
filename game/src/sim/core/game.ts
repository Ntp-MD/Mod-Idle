import { eng, E, sm, loot, TOWN, tree, spawns } from '../../engine/client';
import { buildCharacter, emptyGear, SLOT_COUNT } from './player';
import { itemName } from '../gear/item-name';
import { playerSwing, mobSwing, rollStatus, applyStatus, poisonBurst, dotDamageParts, decayStatusStack, type Statuses, type StatusName } from '../combat/combat';
import { CombatClock, EVENT_PRIORITY, planAttacks } from '../combat/combat-clock';
import {
  advanceCombatArena, aimForSkill, arenaAction, arenaInRange, arenaMobRange, arenaSkillRange, arenaSkillTargets, arenaTarget,
  arenaWeaponRange, captureCombatArena, createCombatArena, recordCombatArenaFx, syncCombatArena, updateArenaAction, arenaDistance, type CombatArena, type CombatMobFlight, type CombatArenaAction,
} from '../combat/combat-arena';
import {
  flightTargets, intentInRange, intentTargets, projectilePosition, selectCombatIntent, trackIntentAim,
  type CombatFlight, type CombatIntent, type ManualControl,
} from '../combat/combat-actions';
import { firstProjectileHit, releasedSkillCastTiming, skillCastTiming, targetsInSkillArea } from '../../../../engine/skill-actions.ts';
import { skillAreaSnapshot } from '../../../../engine/skill-area.ts';
import { spawnSlotSeed } from '../../../../engine/spawns.ts';
import type { MobSkillRow, SkillAreaSnapshot, SkillCastTiming } from '../../../../engine/types.ts';
import { rollDrop } from '../gear/drop';
import { abandonRun, payoutStacks } from '../world/dungeon';
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
import { newFieldwork, tickFieldwork, tickHunger, resolveTravelEvent, recordHuntKill, withMeal, withHunger, pushToFieldCamp, finishPushAtCamp, lifeSkillBonuses } from '../world/fieldwork';
import { buildPushReport, pushReportLines } from './push-report';
import { recordCombatEvent, recordCombatPush } from '../combat/combat-history';
import { snapshotPendingWork, restorePendingWork } from './pending-work';
import { fieldAreaKey, fieldInFight, releaseSpawnSlot, syncFieldState, type FieldSpawnSlot } from '../world/field-area';
import { road, arrive, ownerOf, zoneOf, startWalk, currentCell as currentCellForJournal } from '../world/road';
import { newMapJournal, normalizeMapJournal, recordMapDiscovery, tickTrailSites } from '../world/map-exploration';
import {
  driveAutoReturn, drivePatrol, finishAutoReturnDeposit, maybeStartAutoReturn,
  newAutoReturnState, newPatrolState, recordPatrolGroupClear,
} from '../world/exploration';
import { weaponByName, masteryLevel, payMastery, dropMultiplier } from './mastery';
import { newPresets, switchPreset, autoSelect } from './presets';
import { newCollector, newGrants, wants, col } from '../town/collector';
import { newFilter, ruleFor, coveredElements, refresh as refreshFilter } from '../gear/filter';
import { addTo, fits, slotsFree } from '../gear/slots';
import { settlementOfZone, settlementById } from '../town/town';
import { effectsActive, esAbsorbPct } from '../combat/skills';
import { applyMobAuras, markMobSkillUsed, mobSkillById, mobStrikeRange, planMobSkills, readyMobSkill, resolveMobKit } from '../combat/mobSkills';
import { mark as markSnapshot } from './snapshot';
import { newGoal, onSpawn as goalSpawn, onKill as goalKill, watch as goalWatch } from './goal';
import { newGuidance } from './guidance';
import { newCurses, modsOn, applyCurse, tickCurses, combineMods, lineValue, modsFromAuraFold, spreadOnDeath } from '../combat/curse';
import { newMobStatusStore, applyWeaponRiders, stepMobParts, holdPoison, spendControlBudget, forgetDead as forgetMobStatus,
  placeKeystoneDoT, transferStatus, carriesTransferable, copyStatus,
  modsOn as statusModsOn, targetMods, holdsCondition, keystoneTargetMods,
} from '../combat/mobStatus';
import { newKeystoneRuntimeState } from '../../../../engine/keystones.ts';
import { armourBreak, autoCleanseReady, belowLowLife, borrowedRecoup, bundleOf, capacitiveEs, crushingRhythm, disruptingStop, demolitionBlast, endlessHungerBank, escapeBurst, equilibriumResistance, ghostDanceRecovery, instrumentsMult, manaDebtFloor, manaRegenWhileNegative, mindOverMatter, painforgedBank, parasiticLeech, redlineDamageMult, shieldGateHolds, staggeringSplit, thornboundRetaliation, timeOfNeedHeal, worthyFoe } from '../../../../engine/keystones.ts';
import { KEYSTONE_HANDLERS, registerStaticKeystoneHandlers } from './keystone-runtime';
import { tickCampEncounters, campEncounterEligible } from '../world/camp-encounters';
import {
  newSkillState, tickSkills, tickSkillCooldowns, tickSkillBuffs, castOnce, prepareSkillCast, prepareFirstSkillCast, resolvePreparedCast, paySkillXp, grantSkill, buffNeedsRecast, buffCastOutcome, buffRecastCost, skillCd, usableMana, spendableMana, usableHp, reservedMana, buffRuleUp,
  triggerAuras, rotationOrder, skillEligibilityInState, newCastRollCache, type TriggerAura, type CastReport, type PreparedSkillCast,
} from '../combat/skills';
import type { GameState, Mob, Item, FxEvent } from './types';
import { mulberry32, pick, intBetween } from '../../engine/client-helpers';

const L = E.loot;
/** Packet E's seven static bundles are bound once, against the canonical Element list. */
registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys(E.elements.status_of));
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

/** The current character used by the HUD and live combat, including active skill effects. */
export function characterSheet(s: GameState, effects = effectsActive(s.skills, tree.keystoneBundles(s.player.treeRanks))) {
  return withHunger(withMeal(buildCharacter(s.player.level, s.gear, carried(s), masteryLevel(s, heldWeaponName(s)),
    effects, s.player.points, s.player.treeRanks, lifeSkillBonuses(s)), s), s);
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
  const qEarned = s.player.questTreePointsEarned ?? 0;
  const spentTree = tree.pointsSpentByCurrency(s.player.treeRanks).tree ?? 0;
  s.player.treePoints = Math.max(0, tree.pointsAt(level, E.stat.level_cap) + qEarned - spentTree);
  spendReference(s);
}

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
    skillIds: resolveMobKit(rank, species.id, variantName, fixedName),
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
    if (!canDissolve(s)) {
      onRow?.({ index: i, action: 'blocked', reason: 'The bag cannot take the next salvage bundle. Free a slot and run the filter again.' });
      for (let pending = i - 1; pending >= 0; pending--) {
        if (s.bag[pending]) onRow?.({ index: pending, action: 'not-reached', reason: 'The filter stopped before reaching this piece.' });
      }
      push(s, `Filter run stopped — the bag cannot take the next salvage bundle (${dissolved} melted so far)`);
      return { dissolved, spared, why: 'the bag cannot take the next salvage bundle' };
    }
    s.bag.splice(i, 1);
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

function onKill(s: GameState, rng: () => number, mob: Mob, c: ReturnType<typeof buildCharacter>, statuses: Statuses = {}, bloomChain = true) {
  // The slot owns the respawn timer; a death never rerolls or copies another body.
  releaseSpawnSlot(s, mob);
  if (isBossKind(String(mob.kind)) && s.field) s.field.bossDefeatedAtSec = s.clockSec;
  const online = s.online !== false;
  // `27` Profane Bloom: a body that dies carrying your curse pays its own Max HP as Chaos to the rest
  // of the group. The blast is secondary damage — no crit, no status, no leech, no hit counter — and it
  // never sets a second body off, because that would turn one kill into a chain reaction (§7.2).
  const bloom = bundleOf(c.keystones, 'profane-bloom');
  if (bloom && bloomChain && Object.keys(s.curses[mob.id] || {}).length) {
    const element = String(bloom.params.element);
    const promised = mob.hpMax * Number(bloom.params.victimMaxHpPct) / 100;
    let burst = 0;
    for (const other of s.group) {
      if (other === mob || other.hp <= 0) continue;
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
      onKill(s, rng, dead, c, statuses, false);
    }
  }
  // the lines this mob was carrying jump to the neighbours its row names 
  const caught = spreadOnDeath(s.curses, mob.id, s.group.map((m) => m.id));
  if (caught) push(s, `the curse spreads to ${caught} nearby`);
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
  s.spawnIn = 0;
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
  s.spawnIn = 0;
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
const tickFxClock = new WeakMap<GameState, { clock: CombatClock; arena?: CombatArena }>();

/**
 * One event handed to the screen. A log line is for reading later; this is for animating now, and it
 * carries the number and the colour, which a total (`counters.damageBy`) and a sentence both lose.
 */
export function fx(s: GameState, ev: Omit<FxEvent, 'id' | 'sec'>, source?: Mob) {
  s.fx = s.fx || [];
  s.fxSeq = (s.fxSeq || 0) + 1;
  const context = tickFxClock.get(s);
  s.fx.unshift({ id: s.fxSeq, sec: s.clockSec, ...(context ? { atUs: context.clock.nowUs } : {}), ...ev });
  if (context?.arena) recordCombatArenaFx(context.arena, s, s.fx[0], source);
  recordCombatEvent(s, s.fx[0], source);
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

/** One second of the world. Fixed tick, every unit on its own timer (combat.md §1). The statuses on
 *  the character live in `s.playerStatuses` — canonical saved state (§7.7), never a caller's argument. */
/** The loaded encounter identity. A released action from another one may not land here. */
export const encounterKeyOf = (s: GameState): string => fieldAreaKey(s);

export function tick(s: GameState, opts: { online?: boolean; autoSkills?: boolean; writer?: boolean; arena?: CombatArena; settleArena?: CombatArena; manual?: ManualControl } = {}): GameState {
  if (opts.writer === false) return s;
  try {
    const pausedAtStart = !!deliveryPauseReason(s);
    const rng = mulberry32(s.rngState++);
    /* The Camp gate is read before the world moves, so a walk that ends, a Push that recovers or a
       fight that clears this second cannot open a Camp event on the same tick. */
    const campEligibleAtStart = campEncounterEligible(s);
    const result = tickWorld(s, opts, rng);
    if (opts.online !== false) recordMapDiscovery(result);
    tickTrailSites(result, opts.online !== false);
    tickDeliveries(result, rng, opts.online !== false, pausedAtStart, { writer: true });
    tickBlackMarket(result, rng, { writer: true }, opts.online !== false);
    tickCampEncounters(result, opts.online !== false, (zone, subzone, campRng) => {
      // A Camp threat is a population pull at the Camp's authored density, not the old 1-5 wave.
      const size = Math.max(1, spawns.profileFor(zone, subzone).cap);
      const group = Array.from({ length: size }, () => spawnMob(campRng, zone, 'normal', undefined, subzone,
        { allowWildUnique: false }));
      return group.sort((a, b) => (a.line === 'front' ? -1 : 1) - (b.line === 'front' ? -1 : 1));
    }, { eligibleAtStart: campEligibleAtStart });
    return result;
  } finally {
    const context = tickFxClock.get(s);
    if (context?.arena) {
      context.arena.nowUs = context.clock.halted ? context.clock.nowUs : Math.round(s.clockSec * context.arena.unitsPerSec);
      captureCombatArena(context.arena, s, context.arena.nowUs);
    }
    tickFxClock.delete(s);
  }
}

function tickWorld(s: GameState, opts: { online?: boolean; autoSkills?: boolean; arena?: CombatArena; settleArena?: CombatArena; manual?: ManualControl }, rng: () => number): GameState {
  const online = opts.online !== false;
  const autoSkills = opts.autoSkills !== false;
  const manual = opts.manual;
  // the character's statuses (§7.7): this is the one reference into the saved state, not a copy
  const statuses = s.playerStatuses;
  // §7.1: the window is (t0, t1]; t0 is the clock before this tick increments, and every event is
  // stamped in absolute integer µs off it. A spec without the mechanics line falls back to whole
  // seconds, which is the pre-keystone world rate.
  const unitsPerSec = tree.mechanics?.combat_time_units_per_sec;
  const units = unitsPerSec ?? 1;
  const tickStartUs = Math.round(s.clockSec * units);
  const tickEndUs = tickStartUs + units;
  // the Push latch (§7.7): a fatal hit stops every later event of the tick, so no heal revives it
  const clock = new CombatClock(tickStartUs, tickEndUs, () => s.player.hp <= 0);
  // An arena is ignored during ordinary offline catch-up; `settleArena` is the one exception, used
  // to resolve work that was already released before the session ended.
  const arena = online ? opts.arena : opts.settleArena;
  tickFxClock.set(s, { clock, arena });
  const timeUs: number | null = unitsPerSec === undefined ? null : tickStartUs;
  s.online = online;
  s.clockSec++;
  advanceEconomy(s);
  s.counters.playSec++;
  const foodNote = tickHunger(s, online);
  if (foodNote) push(s, foodNote);
  // the active-skill effect fold changes only on cast/toggle, so compute it once per tick and reuse
  // it for the character sheet and the per-mob aura lines (previously folded again on every swing)
  // the idle default spends this tick's level points before the pool is clamped, so the sheet the
  // pool is read against already includes them; manual players bank and spend by hand.
  if (s.player.autoSpend && s.player.statPoints > 0) spendReference(s);
  const effects = effectsActive(s.skills, tree.keystoneBundles(s.player.treeRanks));
  const c = characterSheet(s, effects);
  const debt52 = bundleOf(c.keystones, 'mana-debt');
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
    for (const other of s.group) {
      if (left <= 0) break;
      if (other.id === target.id) continue;
      if (copyStatus(s.mobStatus, target.id, other.id, 'shock', other.immune || [])) left--;
    }
  };
  // Packet H upkeep: 04 Rage's idle reset and per-second HP drain, 11 Fortify's idle reset, 16 Bark's
  // charge accumulation. All three read the absolute µs clock, never a mutable tick count.
  const rkH = s.keystoneRuntime;
  const redlineH = bundleOf(c.keystones, 'redline');
  if (redlineH) {
    const idleUs = Number(redlineH.params.idleResetSec) * units;
    if (rkH.lastHitAtUs !== null && tickStartUs - rkH.lastHitAtUs >= idleUs) {
      rkH.stacks.redline = 0;
      rkH.lastHitAtUs = null;
    }
    const stacks = rkH.stacks.redline || 0;
    if (stacks > 0) {
      const drain = c.maxHp * (Number(redlineH.params.hpCostPctPerStackPerSec) / 100) * stacks;
      if (s.player.hp - drain >= 1) s.player.hp -= drain;
      else { s.player.hp = 1; rkH.stacks.redline = 0; }
    }
  }
  const fortH = bundleOf(c.keystones, 'fortress-under-siege');
  if (fortH && rkH.lastLossAtUs !== null
    && tickStartUs - rkH.lastLossAtUs >= Number(fortH.params.resetSec) * units) rkH.stacks.fortress = 0;
  // 43 Armourbreaker restores the initial Armour after 4s without a Physical Hit
  const breakerH = bundleOf(c.keystones, 'armourbreaker');
  if (breakerH) for (const m of s.group) {
    const init = rkH.targetCounters[`ab:init:${m.id}`];
    const last = rkH.icdsUs[`ab:last:${m.id}`];
    if (init !== undefined && last !== undefined
      && tickStartUs - last >= Number(breakerH.params.resetSec) * units) {
      m.armour = init;
      rkH.targetCounters[`ab:stacks:${m.id}`] = 0;
      delete rkH.targetCounters[`ab:init:${m.id}`];
      delete rkH.icdsUs[`ab:last:${m.id}`];
    }
  }
  // `22` Demolition Sequence counts one body: whatever left the field takes its count and its summed
  // HP loss with it, so a fifth Hit can never be paid against a target that is no longer there (§7.2).
  for (const key of Object.keys(rkH.counters)) {
    if (!key.startsWith('ds:hits:')) continue;
    const gone = key.slice('ds:hits:'.length);
    if (s.group.some((m) => m.id === gone)) continue;
    delete rkH.counters[key];
    delete rkH.targetCounters[`ds:loss:${gone}`];
  }
  // 57 Shield Gate rearms only after ES is full and its 8s cooldown has passed
  const gateH = bundleOf(c.keystones, 'shield-gate');
  if (gateH && !(rkH.flags.shieldGateArmed ?? true)
    && s.player.es >= c.es && tickStartUs >= (rkH.icdsUs.shieldGateArmAt ?? 0)) rkH.flags.shieldGateArmed = true;
  const barkH = bundleOf(c.keystones, 'barkskin');
  if (barkH) {
    const everyUs = Number(barkH.params.regenEverySec) * units;
    const maxBark = Number(barkH.params.maxCharges);
    let next = rkH.icdsUs.bark ?? tickStartUs + everyUs;
    while (tickStartUs >= next && (rkH.stacks.bark || 0) < maxBark) {
      rkH.stacks.bark = (rkH.stacks.bark || 0) + 1;
      next += everyUs;
    }
    rkH.icdsUs.bark = next;
  }
  // a pool is bounded by what it is: never below nothing, never above what the sheet says it holds.
  // The bars read these straight, so an unbounded value here is what shows as a negative number there.
  // 52 lets the pool stand negative; without it the bar never reads below zero
  s.player.mana = Math.min(debt52 ? s.player.mana : Math.max(0, s.player.mana), c.maxMana);
  s.player.es = Math.min(Math.max(0, s.player.es), c.es);
  // reservations hold the usable ceiling below Full Max HP, never below 1 (§7.5)
  s.player.hp = Math.min(s.player.hp, usableHp(c, s.skills));
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
  if (online && s.travel === 'forward' && !s.dungeon && !s.walk && !s.patrol.active && s.autoReturn.phase === 'idle') {
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
  if (online && s.walk) {
    const walk = s.walk;
    walk.secLeft--;
    if (walk.secLeft <= 0 && !s.group.length) {
      // the block is crossed: one encounter chance, then the next block starts
      walk.blocksLeft--;
      walk.blocksWalked++;
      walk.secLeft = road.blockSec;
      recordMapDiscovery(s);
      // A crossed block says nothing: no number floats off the character and no line is logged for it —
      // the walk reads as the one word on the field plus the route lighting itself off `blocksWalked`,
      // one cell per block (`walkedCells`). Only arriving, and being ambushed, are events.
      const trailEvent = resolveTravelEvent(s, rng);
      if (trailEvent) {
        const feet = currentCellForJournal(s);
        s.mapJournal!.lastEvent = { ...feet, text: trailEvent, atSec: s.clockSec };
        push(s, `Trail event · ${trailEvent}`);
      }
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
      }
    }
  }

  // leaving the run's zone ends the run: a dungeon is entered ground, not a destination
  if (s.dungeon && s.dungeon.zone !== s.zone) push(s, abandonRun(s, 'Pulled out'));
  function fieldProfile() {
    return spawns.profileFor(s.zone, s.cell?.sub ?? null);
  }

  function spawnFieldMob(slot: FieldSpawnSlot): Mob | undefined {
    const field = s.field;
    if (!field) return;
    if (s.group.filter((mob) => mob.hp > 0).length >= field.slots.length) return;
    const [lo, hi] = eng.groupRangeOf(s.zone, s.cell?.sub);
    const expected = Math.max(1, (lo + hi) / 2);
    const profile = fieldProfile();
    const waveSec = Number(L.group_spawn_sec) + expected * Number(L.ttk_per_mob_sec);
    const slotRate = Math.max(1e-9, field.slots.length / profile.respawn_sec);
    let kind: 'normal' | 'elite' | 'boss' = 'normal';
    let bossSpawn = false;
    if (online && s.bossDueAt != null && s.clockSec >= s.bossDueAt
      && !s.group.some((mob) => isBossKind(String(mob.kind)))) {
      kind = 'boss';
      bossSpawn = true;
    } else {
      // Preserve the old wave's Elite and Unique rates: one per the same expected seconds, not one
      // per arbitrary slot roll. A faster refill therefore gets a proportionally smaller chance.
      const eliteChance = eng.eliteChanceOf(s.zone, s.cell?.sub) / Math.max(1e-9, waveSec * slotRate);
      const roll = mulberry32(spawnSlotSeed(s.seed, field.areaKey, slot.id, slot.respawnCount));
      if (roll() < Math.min(1, eliteChance)) kind = 'elite';
    }
    const uniqueChance = Number(E.loot.unique_chance || 0) * expected / Math.max(1e-9, waveSec * slotRate);
    if (bossSpawn) {
      cancelArenaWork('boss-arena');
      field.arenaEpoch++;
    }
    const rng = mulberry32(spawnSlotSeed(s.seed, field.areaKey, slot.id, slot.respawnCount));
    const mob = spawnMob(rng, s.zone, kind, undefined, s.cell?.sub ?? null, { uniqueChance });
    mob.spawnSlotId = slot.id;
    slot.mobId = mob.id;
    slot.respawnAtSec = 0;
    slot.respawnCount++;
    s.group.push(mob);
    field.actors = field.actors.filter((actor) => actor.id !== mob.id);
    field.actors.push({ id: mob.id, x: slot.home.x, y: slot.home.y });
    if (bossSpawn) {
      s.bossDueAt = s.clockSec + BOSS_EVERY_SEC;
      push(s, `Boss spawn in ${eng.zoneById(s.zone).name}`);
    }
    return mob;
  }

  function ensureFieldPopulation(): void {
    const field = s.field;
    if (!field || s.walk || !s.hunting || s.dungeon || s.phase === 'camp' || s.player.hp <= 0) return;
    if (!field.slots.length) syncFieldState(s, arena, 2, false);
    if (online && !s.bossDueAt) s.bossDueAt = s.clockSec + BOSS_EVERY_SEC;
    const living = new Set(s.group.filter((mob) => mob.hp > 0).map((mob) => mob.id));
    // Without ground positions the away resolver keeps one active pull; the arena fills its authored
    // cap. This is the A-lite seam that the dedicated offline throughput gate will tune.
    const populationCap = arena ? field.slots.length : Math.min(1, field.slots.length);
    for (const slot of field.slots) {
      if (slot.mobId && living.has(slot.mobId)) continue;
      if (slot.mobId) {
        slot.mobId = undefined;
        if (!(slot.respawnAtSec > s.clockSec)) slot.respawnAtSec = s.clockSec;
      }
      if (s.clockSec < slot.respawnAtSec) continue;
      if (living.size >= populationCap) break;
      const mob = spawnFieldMob(slot);
      if (mob) living.add(mob.id);
    }
    s.group.sort((a, b) => (a.line === 'front' ? -1 : 1) - (b.line === 'front' ? -1 : 1));
  }

  // Dungeon runs keep their authored budget until that path is migrated to spawn slots.
  if (!s.group.length && !s.walk && s.hunting && s.dungeon) {
    const run = s.dungeon;
    // A run fields the same authored population density as the field; `left` is the run budget.
    const size = Math.min(spawns.profileFor(run.zone, s.cell?.sub ?? null).cap, Math.max(0, run.left));
    if (size > 0) {
      s.group = Array.from({ length: size }, () => spawnMob(rng, run.zone, 'normal'));
      s.group.sort((m) => (m.line === 'front' ? -1 : 1));
    }
  }

  if (!s.field || s.field.areaKey !== fieldAreaKey(s)) syncFieldState(s, arena, 2, false);
  syncFieldState(s, arena, 2, false);
  ensureFieldPopulation();
  if (arena) syncCombatArena(arena, s, tickStartUs, units, c.maxHp);

  // Engagement is spatial: only bodies inside aggro, an existing leash, an assist neighbour, or the
  // player's committed target may attack. The rest keep their home ground.
  if (s.field) {
    if (!arena) {
      if (!online) {
        // A-lite offline duty: accumulate the authored engagement share and fight a solo pull only
        // on whole engaged seconds. The population and slot timers still advance on wall time.
        const profile = fieldProfile();
        const credit = (s.field.offlineCredit ?? 0) + profile.offline_share;
        const active = credit >= 1;
        s.field.offlineCredit = active ? credit - 1 : credit;
        s.field.engagementIds = active
          ? s.group.filter((mob) => mob.hp > 0).slice(0, 1).map((mob) => mob.id) : [];
      } else {
        // An online host without the arena renderer (tests, headless settle) keeps every living
        // body in the engagement set; the ground resolver is the only difference.
        s.field.engagementIds = s.group.filter((mob) => mob.hp > 0).map((mob) => mob.id);
      }
    } else {
      const profile = fieldProfile();
      const was = new Set(s.field.engagementIds);
      const next = new Set<string>();
      const live = s.group.filter((mob) => mob.hp > 0 && arena.mobs[mob.id]);
      const campFight = s.fieldwork.campEncounters?.active?.stage === 'combat';
      if ((s.hunting || campFight) && s.player.hp > 0) {
        for (const mob of live) {
          if (campFight || arenaDistance(arena.mobs[mob.id], arena.player) <= profile.aggro_m + 1e-7) next.add(mob.id);
        }
        for (const mob of live) {
          if (!was.has(mob.id)) continue;
          const slot = s.field.slots.find((entry) => entry.id === mob.spawnSlotId);
          if (!slot || arenaDistance(arena.mobs[mob.id], slot.home) <= profile.leash_m + 1e-7) next.add(mob.id);
        }
        for (const mob of live) {
          if (next.has(mob.id)) continue;
          if (live.some((other) => next.has(other.id)
            && arenaDistance(arena.mobs[mob.id], arena.mobs[other.id]) <= profile.assist_m + 1e-7)) next.add(mob.id);
        }
        if (arena.intent?.targetId) next.add(arena.intent.targetId);
      }
      // A body that leaves its leash drops its damage and returns with its home pool, like a map
      // reset; this is the same receipt whether it was pulled too far or the player left it behind.
      for (const id of was) {
        if (next.has(id)) continue;
        const mob = s.group.find((entry) => entry.id === id);
        if (!mob || mob.hp <= 0) continue;
        mob.hp = mob.hpMax;
        delete s.mobStatus[id];
        delete s.curses[id];
      }
      s.field.engagementIds = [...next].slice(0, Math.max(1, s.field.slots.length));
    }
  }
  // The per-fight potion budget belongs to a combat session, not to each spawn.
  if (syncFieldState(s, arena, 2, false)) s.farm.usesThisFight = 0;

  /** A committed player target enters its aggro window even when it stood outside the radius. */
  function engageTarget(targetId?: string): void {
    if (!arena || !s.field || !targetId) return;
    if (!s.group.some((mob) => mob.id === targetId && mob.hp > 0 && arena.mobs[targetId])) return;
    if (s.field.engagementIds.includes(targetId)) return;
    s.field.engagementIds = [...s.field.engagementIds, targetId]
      .slice(0, Math.max(1, s.field.slots.length));
  }

  // the completion gate is armed before the first swing of a spawn, so a fast kill still counts
  goalWatch(s);
  for (const m of s.group) goalSpawn(s, m);

  const engagedIds = new Set(s.field?.engagementIds ?? []);
  const engaging = s.group.filter((mob) => mob.hp > 0 && (!arena || engagedIds.has(mob.id)));
  // Auras are read from the living engaged bodies before either side's events are scheduled, so the
  // player's damage and the mob clock in this tick answer the same effective modifiers.
  const auraRadius = Number(E.mob.aura_radius_m) || 4;
  applyMobAuras(s.group, engaging, arena
    ? (sourceId, targetId) => {
        const source = arena.mobs[sourceId], target = arena.mobs[targetId];
        return !source || !target || arenaDistance(source, target) <= auraRadius + 1e-7;
      }
    : undefined);
  const front = s.group[0];

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

  // Shock spends only its remaining part of this one-second step. Vit's Stun Recovery shortens that
  // stopped slice, and the attack / cooldown / regen clocks advance through the rest of the second.
  const shockSecLeft = Math.max(0, statuses.shock?.secLeft || 0);
  // 02 Unstoppable: Stun no longer stops the action, and Slow no longer cuts the attack rate; while
  // either effect would have done so, outgoing damage is multiplied by its penalty instead (§5.02).
  const unstoppable = bundleOf(c.keystones, 'unstoppable');
  const slowed = (statuses.shock?.secLeft || 0) > 0 || (statuses.chill?.secLeft || 0) > 0;
  const unstoppablePenalty = unstoppable && slowed ? Number(unstoppable.params.penaltyDamageMult) : 1;
  const playerActiveFraction = unstoppable ? 1 : Math.max(0, 1 - Math.min(1, shockSecLeft));
  const playerRange = arena ? arenaWeaponRange(c.weaponName) : 0;
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
    if (!autoSkills) return playerRange;
    const held = arena?.intent?.skillId;
    if (held) return skillRange(held);
    const ready = rotationOrder(s.skills).find((id) => {
      const skill = sm.byId[id];
      return (skill.type === 'attack' || skill.type === 'curse')
        && skillEligibilityInState(s, c, id).ready;
    });
    return ready ? skillRange(ready) : playerRange;
  };
  let cooldownAtUs = tickStartUs;
  const advanceArenaAt = (atUs: number) => {
    if (!arena) return;
    const intent = arena.intent;
    // Whirlwind is the one mobile channel: its recovered primary action still permits movement.
    const channeling = intent?.phase === 'recovery' && !!intent.mobile;
    if (manual?.moveTo && intent?.phase === 'windup') cancelIntent('manual move');
    // A placed ground order outside cast range walks to its own point; other manual casts close
    // through the ordinary target approach. An explicit local move always wins.
    const reachable = intent && intentInRange(arena, intent, s.group);
    const placedApproach = intent?.manual && intent.aimPoint && intent.phase === 'approach' && !reachable
      && sm.byId[intent.skillId]?.area?.origin === 'target' ? intent.targetPoint : undefined;
    advanceLiveClocks(atUs);
    for (const actor of Object.values(arena.mobs)) {
      const action = actor.action;
      if (action?.kind === 'cast' && action.timing && !action.impactCount && action.cancelledAtUs == null
        && action.timing.releaseAtUs >= atUs && statusModsOn(s.mobStatus, actor.id).stopped)
        cancelMobPreparation(action, atUs, 'control');
    }
    advanceCombatArena(arena, s, atUs, {
      playerRange: approachRange(),
      playerSpeedMult: playerActiveFraction * (channeling ? (intent!.speedMult ?? 0.6) : 1),
      playerTargetId: intent?.targetId,
      playerLocked: !channeling && (intent?.phase === 'windup' || intent?.phase === 'recovery'),
      playerMoveTo: manual?.moveTo ?? placedApproach,
      engagedIds: new Set(s.field?.engagementIds ?? []),
      mobSpeedMult: (mob) => {
        return statusModsOn(s.mobStatus, mob.id).stopped ? 0 : 1;
      },
    });
    if (manual?.moveTo && arenaDistance(arena.player, manual.moveTo) <= 0.3) {
      manual.anchor = { x: manual.moveTo.x, y: manual.moveTo.y };
      arena.anchor = { ...manual.anchor };
      manual.moveTo = undefined;
    }
    sweepFlights(atUs);
    sweepMobShots(atUs);
  };
  const resolveTargetsForSkill = arena ? (id: string, group: Mob[]) => {
    advanceArenaAt(clock.nowUs);
    return arenaSkillTargets(arena, id, group);
  } : undefined;
  const statusesAppliedThisTick = new Set<StatusName>();
  const chill = statuses.chill && statuses.chill.secLeft > 0 ? statuses.chill : null;
  const chillAspdCut = chill && !unstoppable
    ? Math.min(E.status.chill.aspd_cap, chill.stacks * E.status.chill.aspd_pct) / 100 : 0;
  const shockAccuracyCut = statuses.shock
    ? Math.min(E.status.shock.acc_cap, E.status.shock.acc_pct) / 100 : 0;
  const crippled = statuses.crippled && statuses.crippled.secLeft > 0 ? statuses.crippled : null;
  const crippledOutgoingMult = crippled
    ? 1 + E.status.crippled.outgoing_damage_pct / 100 : 1;
  const attackCharacter = shockAccuracyCut > 0
    ? { ...c, accuracy: c.accuracy * (1 - shockAccuracyCut) } : c;
  // 03 Berserk: Low Life against the FULL Max HP grants damage and speed, while the take-more line
  // is always on (the taken multiplier is applied per incoming Hit below).
  const berserk = bundleOf(c.keystones, 'berserk');
  const lowLife = belowLowLife(s.player.hp, c.maxHp, tree.mechanics?.low_life_pct ?? 50);
  const berserkOn = !!berserk && lowLife;
  const berserkDealt = berserkOn ? Number(berserk!.params.damageMult) : 1;
  const playerHitsPerSec = c.hitsPerSec * (berserkOn ? Number(berserk!.params.aspdMult) : 1)
    * Math.max(0, 1 - chillAspdCut);
  // the events the trigger auras listen for, collected where they happen: a crit in this tick's swings,
  // and any hit that took HP or Energy Shield off the player
  const trig = triggerAuras(s.skills);
  let triggerFired = false;
  const mobPlans: { mob: Mob; rate: number; actionsLeft: number }[] = [];

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
      if (triggerFired || clock.halted) return;
      triggerFired = true;
      fireTrigger(aura);
    });
  }

  // The cast pipeline is one path: a rotation press and a triggered one differ only by the `trigger`
  // env handed to `prepareSkillCast`, which prices the press, so their outcome handling cannot drift.
  type CastOutcomeOptions = {
    pay?: boolean;
    emitCast?: boolean;
    castCounter?: boolean;
    mirror?: boolean;
    actionId?: number;
    castTiming?: SkillCastTiming;
  };

  function payCast(cast: Pick<PreparedSkillCast, 'manaCost' | 'hpCost'>) {
    const debt = bundleOf(c.keystones, 'mana-debt');
    const capac = bundleOf(c.keystones, 'capacitive-casting');
    const manaBefore = s.player.mana;
    s.player.mana = debt ? s.player.mana - cast.manaCost : Math.max(0, s.player.mana - cast.manaCost);
    // 58 Capacitive Casting: 20% of FUNDED Mana spend returns as ES (borrowed Mana gives nothing)
    if (capac && cast.manaCost > 0) {
      s.player.es = Math.min(c.es, s.player.es + capacitiveEs(cast.manaCost,
        Math.max(0, manaBefore - reservedMana(c, s.skills)), capac.params as Record<string, number>));
    }
    if (debt) {
      // snapshot the borrow limit the moment the pool first crosses zero; a later MaxMana change
      // never moves it, and reaching zero again clears it (§7.4.10)
      if (s.player.mana < 0 && s.keystoneRuntime.manaDebtLimit === null) {
        s.keystoneRuntime.manaDebtLimit = manaDebtFloor(usableMana(c, s.skills), debt.params as Record<string, number>);
      } else if (s.player.mana >= 0) s.keystoneRuntime.manaDebtLimit = null;
    }
    if (cast.hpCost > 0) s.player.hp = Math.max(1, s.player.hp - cast.hpCost);
  }

  function castFx(id: string, area: SkillAreaSnapshot | undefined, targets: string[], actionId?: number,
    timing?: SkillCastTiming, extra: { charges?: number; cleansed?: number } = {}) {
    const skill = sm.byId[id];
    fx(s, {
      kind: 'cast', side: 'self', skillId: id, actionId, castTiming: timing,
      text: String(skill?.name || id), colour: hitColour((skill as any)?.element || null),
      skillOutcome: { targets, area, ...extra },
    });
  }

  function applyCastOutcome(cast: CastReport | null, opts: CastOutcomeOptions = {}) {
    if (!cast) return;
    if (opts.pay !== false) payCast(cast);
    if (cast.heal) s.healUp = cast.heal;
    if (cast.charges != null) {
      s.player.charges = cast.charges;
      push(s, `${cast.name} grants ${cast.charges} perfect-dodge charges`);
    }
    if (cast.blockCharges != null) {
      s.player.blockCharges = cast.blockCharges;
      push(s, `${cast.name} grants ${cast.blockCharges} blocks`);
    }
    let cleansed = 0;
    if (cast.cleansesSelf) {
      const cleared = Object.keys(statuses).length;
      cleansed = cleared;
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
      fx(s, { kind: 'heal', side: 'self', skillId: cast.id, actionId: opts.actionId, text: `+${eng.fmt(s.player.hp - before)}`, colour: hitColour((sm.byId[cast.id] as any)?.element || null) });
    }
    if (cast.damage && cast.targets) push(s, `${cast.name} hits ${cast.targets} for ${eng.fmt(cast.damage)}${cast.crit ? ' (crit)' : ''}`);
    // the press's colour comes from the row's own Element (`skills.json` `element`), the same field
    // the status rider reads — a press with no Element name is the neutral half
    const castElement = (sm.byId[cast.id] as any)?.element || null;
    // one number per mob the press actually hurt, each on its own plate: the sim already decided how the
    // share split and the mitigation landed on every target, so the screen shows that and not the total
    for (const h of cast.byMob) {
      fx(s, {
        kind: 'hit', side: 'field', mobId: h.id, crit: cast.crit, via: 'cast', skillId: cast.id, actionId: opts.actionId,
        text: eng.fmt(h.amount), value: h.amount, colour: hitColour(castElement, cast.crit),
      });
    }
    if (cast.crit && cast.byMob[0]) queueTrigger(trig.crit, cast.byMob[0].id);
    if (cast.name && opts.emitCast !== false) castFx(cast.id, cast.area,
      cast.curseTargets ?? (cast.curseOn ? [cast.curseOn] : cast.byMob.map(hit => hit.id)),
      opts.actionId, opts.castTiming, { charges: cast.charges ?? cast.blockCharges, cleansed });
    if (cast.consumed?.length) push(s, `${cast.name} consumes ${cast.consumed.map((c) => `${c.stacks} ${c.status}`).join(', ')}`);
    if (cast.spread?.length) push(s, `${cast.name} spreads ${cast.spread.map((c) => c.status).join(', ')}`);
    if (cast.damage && !cast.targets) push(s, `${cast.name} was dodged`);
    credit(s, 'cast', cast.dealt || 0);
    // Bloodthirst: the press's direct damage leeches as the swing's does. The intrinsic leech
    // line keeps its historical swing-only route; this is the bundle's own 3%.
    const bloodthirst = bundleOf(c.keystones, 'bloodthirst');
    const castDealt = cast.dealt ?? 0;
    if (bloodthirst && castDealt > 0)
      recoverLeech(castDealt * Number(bloodthirst.params.leechPct) / 100, clock.nowUs);
    for (const targetId of cast.curseTargets ?? (cast.curseOn ? [cast.curseOn] : [])) {
      const sec = applyCurse(s.curses, targetId, sm.byId[cast.id], c.keystones);
      // a curse line that names a status clock (Venom Bind) is spent on the status store, not the
      // curse store, because it changes how another line decays rather than adding a multiplier — and
      // it is read back off the line the curse actually wrote, so `28` Malediction stretches it once
      for (const e of (sm.byId[cast.id].effects || [])) {
        if (e.subject === 'target' && e.stat === 'poison_hold_sec')
          holdPoison(s.mobStatus, targetId, lineValue(s.curses, targetId, 'poison_hold_sec') || e.value);
      }
      push(s, `${cast.name} lands for ${sec} sec`);
    }
    // Trance counts every cast; Lucky Streak only moves on a damage press; Mirror Strike's
    // banked crit is spent by the first press that actually lands on a target.
    const trance = bundleOf(c.keystones, 'trance');
    if (trance && opts.castCounter !== false) rkH.counters.tranceCasts = (rkH.counters.tranceCasts || 0) + 1;
    const lucky = bundleOf(c.keystones, 'lucky-streak');
    if (lucky && cast.damage > 0) rkH.stacks.luckyStreak = cast.crit
      ? Math.min(Number(lucky.params.maxStacks), (rkH.stacks.luckyStreak || 0) + 1) : 0;
    if (opts.mirror !== false && cast.targets > 0) rkH.flags.mirrorCrit = false;
    while (s.group.some((mob) => mob.hp <= 0)) {
      const dead = s.group.splice(s.group.findIndex((mob) => mob.hp <= 0), 1)[0];
      onKill(s, rng, dead, c, statuses);
    }
  }

  function applyCast(cast: CastReport | null) {
    if (!cast) return;
    applyCastOutcome(cast);
  }

  /**
   * A trigger aura's press: the same `castOnce` the rotation uses, asking for the first ready slot in
   * the cast order, with the aura's price on it. It spends the aura's own clock (`trigger_cd_sec`),
   * never the skill's cooldown, so the trigger is an extra press rather than a re-ordered rotation.
   */
  function fireTrigger(aura: TriggerAura | null) {
    if (!aura || playerActiveFraction <= 0 || (s.skills.cd[aura.id] || 0) > 0) return;
    const free = tranceFree();
    const force = mirrorReady();
    const lucky = luckyBonus();
    const trigger = { manaMult: aura.manaMult, damageMult: aura.damageMult };
    const env = {
      resolveTargetsForSkill,
      mobStatus: s.mobStatus, curses: s.curses,
      currentHp: s.player.hp,
      missingHpPct: c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0,
      isBoss: s.group.some((mob) => isBossKind(String(mob.kind))),
      trigger,
      timeUs: arena ? clock.nowUs : timeUs,
      freeCast: free,
      forceCrit: force,
      critDamageBonusPct: lucky,
      spatialTargets: !!arena,
    };
    if (!arena) {
      const t = castOnce(s.skills, attackCharacter, spendableMana(attackCharacter, s.skills, s.player.mana), s.group, statuses, rng, env);
      if (!t) return;
      s.skills.cd[aura.id] = aura.cdSec;
      push(s, `${sm.byId[aura.id].name} triggers ${t.name}`);
      applyCast(t);
      return;
    }
    const prepared = prepareFirstSkillCast(s.skills, attackCharacter,
      spendableMana(attackCharacter, s.skills, s.player.mana), s.group, statuses, env);
    if (!prepared) return;
    s.skills.cd[aura.id] = aura.cdSec;
    push(s, `${sm.byId[aura.id].name} triggers ${sm.byId[prepared.id].name}`);
    launchTrigger(prepared, trigger, free, force, lucky, clock.nowUs);
  }

  /** Trigger auras are immediate, non-blocking casts: they own an action and flight but never the intent. */
  function launchTrigger(
    prepared: PreparedSkillCast, trigger: { manaMult: number; damageMult: number },
    free: boolean, force: boolean, lucky: number, atUs: number,
  ) {
    if (!arena) return;
    const skill = sm.byId[prepared.id];
    if (!skill) return;
    const profile = sm.castProfileOf(skill);
    const timing = skillCastTiming({ ...profile, windup_sec: 0, recovery_sec: 0 }, atUs, units,
      { x: arena.player.x, y: arena.player.y }, prepared.area?.center ?? { x: arena.player.x, y: arena.player.y },
      Math.max(1e-7, c.globalSpeed || 1));
    const targetId = prepared.targets[0]?.id ?? prepared.area?.targetId ?? arena.intent?.targetId ?? front?.id;
    const previousAction = arena.player.action;
    const wasMoving = arena.player.moving;
    const action = arenaAction(arena, 'player', 'cast', atUs, targetId, prepared.id, prepared.area, timing);
    if (previousAction) arena.player.action = previousAction;
    arena.player.moving = wasMoving;
    if (!action) return;
    // The trigger owns its effect and flight; the primary pose stays with the action underneath.
    updateArenaAction(arena, action.id, { nonblocking: true });
    payCast(prepared);
    const trance = bundleOf(c.keystones, 'trance');
    if (trance) rkH.counters.tranceCasts = (rkH.counters.tranceCasts || 0) + 1;
    if (force && skill.type === 'attack') rkH.flags.mirrorCrit = false;
    const struck = prepared.area
      ? targetsInSkillArea(prepared.area, arenaActors(s.group), profile.hit_radius_m).map((actor) => actor.mob.id)
      : skill.type === 'attack' || skill.type === 'curse' ? prepared.targets.map((mob) => mob.id) : [];
    castFx(prepared.id, prepared.area, struck, action.id, timing);
    const missingHpPct = c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0;
    const flight: CombatFlight = {
      actionId: action.id, cast: prepared, character: attackCharacter,
      modifiers: { trigger, forceCrit: force, critDamageBonusPct: lucky, freeCast: free, missingHpPct,
        outgoingDamageMult: crippledOutgoingMult },
      profile, timing,
      source: { x: arena.player.x, y: arena.player.y },
      destination: prepared.area?.center ?? { x: arena.player.x, y: arena.player.y },
      area: prepared.area, position: { x: arena.player.x, y: arena.player.y }, lastCheckedAtUs: atUs,
      areaKey: encounterKeyOf(s),
    };
    if (skill.type === 'heal' || skill.type === 'buff') {
      const report = resolvePreparedCast(s.skills, attackCharacter, prepared, statuses, rng, {
        mobStatus: s.mobStatus, curses: s.curses, timeUs: atUs, trigger, missingHpPct,
      });
      applyCastOutcome(report, { pay: false, emitCast: false, castCounter: false, mirror: false,
        actionId: action.id, castTiming: timing });
      return;
    }
    if (profile.delivery === 'projectile' || timing.impactAtUs > atUs) {
      arena.flights.push(flight);
      scheduleFlight(flight);
      return;
    }
    resolveFlight(flight, atUs);
  }

  function advanceLiveClocks(atUs: number) {
    if (!arena) return;
    const elapsed = Math.max(0, atUs - cooldownAtUs) / units;
    if (elapsed <= 0) return;
    tickSkillCooldowns(s.skills, elapsed * c.globalSpeed * playerActiveFraction);
    cooldownAtUs = atUs;
  }

  function cancelIntent(reason: string) {
    const intent = arena?.intent;
    if (!arena || !intent) return;
    arena.intent = undefined;
    const action = intent.actionId != null
      ? arena.actions.find((entry) => entry.id === intent.actionId) : undefined;
    // A normal recovery keeps its pose; a channel is owned by its primary action and stops at
    // the control receipt instead of playing a tail the simulation already refused.
    const cutsPose = intent.phase !== 'recovery' || !!intent.mobile || !!action?.channel;
    if (!cutsPose || intent.actionId == null) return;
    if (action && action.cancelledAtUs == null)
      updateArenaAction(arena, action.id, { cancelledAtUs: clock.nowUs, cancelReason: reason, endsAtUs: clock.nowUs });
    if (arena.player.action?.id === intent.actionId) arena.player.action = undefined;
  }

  function cancelArenaWork(reason: string) {
    if (!arena) return;
    cancelIntent(reason);
    for (const flight of arena.flights) {
      const action = arena.actions.find((entry) => entry.id === flight.actionId);
      if (action && action.cancelledAtUs == null)
        updateArenaAction(arena, action.id, { cancelledAtUs: clock.nowUs, cancelReason: reason, endsAtUs: clock.nowUs });
    }
    arena.flights = [];
    for (const shot of arena.mobFlights) {
      const action = arena.actions.find((entry) => entry.id === shot.actionId);
      if (action && action.cancelledAtUs == null)
        updateArenaAction(arena, action.id, { cancelledAtUs: clock.nowUs, cancelReason: reason, endsAtUs: clock.nowUs });
    }
    arena.mobFlights = [];
    if (arena.player.action && arena.player.action.cancelledAtUs == null)
      updateArenaAction(arena, arena.player.action.id, { cancelledAtUs: clock.nowUs, cancelReason: reason, endsAtUs: clock.nowUs });
    arena.player.action = undefined;
  }

  /** Drop one released flight with its receipt; used when its encounter is no longer current. */
  function cancelFlight(flight: CombatFlight, atUs: number, reason: string) {
    if (!arena) return;
    const at = arena.flights.indexOf(flight);
    if (at >= 0) arena.flights.splice(at, 1);
    const action = arena.actions.find((entry) => entry.id === flight.actionId);
    if (action && action.cancelledAtUs == null)
      updateArenaAction(arena, action.id, { cancelledAtUs: atUs, cancelReason: reason, endsAtUs: atUs });
  }

  const areaChanged = (flight: CombatFlight) => !!flight.areaKey && flight.areaKey !== encounterKeyOf(s);

  const arenaActors = (group: Mob[]) => group.flatMap((mob) =>
    mob.hp > 0 && arena?.mobs[mob.id] ? [{ ...arena.mobs[mob.id], mob }] : []);

  function startWindup(intent: CombatIntent, atUs: number) {
    if (!arena) return;
    const skill = sm.byId[intent.skillId];
    if (!skill) { cancelIntent('missing skill'); return; }
    const profile = sm.castProfileOf(skill);
    const resolved = intentTargets(arena, s.group, intent);
    const source = { x: arena.player.x, y: arena.player.y };
    const destination = resolved.area?.center ?? source;
    const timing = skillCastTiming(profile, atUs, units, source, destination,
      Math.max(1e-7, c.globalSpeed || 1));
    const action = arenaAction(arena, 'player', 'cast', atUs, intent.targetId, intent.skillId, resolved.area, timing);
    if (!action) { arena.intent = undefined; return; }
    intent.phase = 'windup';
    intent.actionId = action.id;
    intent.releaseAtUs = timing.releaseAtUs;
    intent.recoveryUntilUs = timing.recoveryUntilUs;
    intent.releaseQueued = false;
    arena.intent = intent;
    scheduleRelease(intent);
  }

  function scheduleRelease(intent: CombatIntent) {
    if (!arena || intent.releaseQueued || intent.releaseAtUs == null) return;
    if (intent.releaseAtUs > tickEndUs) return;
    intent.releaseQueued = true;
    clock.schedule(intent.releaseAtUs, EVENT_PRIORITY.playerAction, 'player', intent.targetId, () => {
      if (arena?.intent !== intent || intent.phase !== 'windup') return;
      releaseIntent(clock.nowUs);
    });
  }

  function releaseIntent(atUs: number) {
    const intent = arena?.intent;
    if (!arena || !intent || intent.phase !== 'windup' || intent.actionId == null) return;
    advanceLiveClocks(atUs);
    const action = arena.actions.find((entry) => entry.id === intent.actionId);
    if (!action || action.cancelledAtUs != null) { cancelIntent('action cancelled'); return; }
    const skill = sm.byId[intent.skillId];
    if (!skill) { cancelIntent('missing skill'); return; }
    const profile = sm.castProfileOf(skill);
    const free = tranceFree();
    const force = mirrorReady();
    const lucky = luckyBonus();
    const env = {
      mobStatus: s.mobStatus, curses: s.curses, currentHp: s.player.hp,
      missingHpPct: c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0,
      isBoss: s.group.some((mob) => isBossKind(String(mob.kind))),
      timeUs: atUs, freeCast: free, forceCrit: force, critDamageBonusPct: lucky,
      spatialTargets: true,
      ...(intent.manual ? { ignoreConditions: true } : {}),
      ...(intent.manual && intent.aimPoint ? { allowEmptyTarget: true } : {}),
    };
    // Re-aim at release: the bodies may have moved since windup began, so the
    // committed footprint is recomputed from live positions instead of reusing the
    // windup snapshot. Buffs and heals keep the windup aim; impact still re-tests
    // living positions at impact for everything.
    let releaseArea = action.area;
    let releaseTargets = intentTargets(arena, s.group, intent, true).targets;
    if (intent.manual && intent.aimPoint) {
      // A manual ground request stays where it was placed, including empty permitted ground;
      // range is still re-tested at release, and the impact reads living bodies at that point.
      if (skill.area?.origin !== 'caster'
        && arenaDistance(arena.player, intent.targetPoint) > arenaSkillRange(skill.id) + 1e-7) {
        cancelIntent('out of range');
        return;
      }
      const definition = skill.area ?? { origin: 'target' as const, radius_m: 0 };
      releaseArea = skillAreaSnapshot(definition, arena.player, intent.targetPoint, intent.targetId, arena.player.facing);
      releaseTargets = targetsInSkillArea(releaseArea, arenaActors(s.group)).map((actor) => actor.mob);
    } else if (skill.type === 'attack' || skill.type === 'curse') {
      const tracked = trackIntentAim(arena, s.group, intent);
      if (!tracked) { cancelIntent('target lost'); return; }
      intent.targetPoint = tracked.targetPoint;
      const live = intentTargets(arena, s.group, intent, false);
      if (!live.targets.length) { cancelIntent('target lost'); return; }
      releaseArea = live.area;
      releaseTargets = live.targets;
      arena.intent = intent;
    }
    // The release is the committed receipt: travel and recovery are measured from the actual
    // release source/aim, replacing the windup snapshot rather than keeping its old distance.
    let chainHopRange = 0;
    if (skill.action?.kind === 'chain-strike') {
      const primary = s.group.find((mob) => mob.id === intent.targetId && mob.hp > 0);
      if (!primary) { cancelIntent('target lost'); return; }
      const pose = arena.mobs[primary.id];
      releaseArea = { origin: 'target', radiusM: 0, targetId: primary.id,
        center: pose ? { x: pose.x, y: pose.y } : { x: intent.targetPoint.x, y: intent.targetPoint.y } };
      releaseTargets = [primary];
      chainHopRange = Number(skill.area?.radius_m ?? 0) || 3;
    }
    const releaseSource = { x: arena.player.x, y: arena.player.y };
    const releaseDestination = releaseArea?.center ?? releaseSource;
    const releaseTiming = releasedSkillCastTiming(profile, action.timing?.startedAtUs ?? action.atUs,
      atUs, units, releaseSource, releaseDestination, Math.max(1e-7, c.globalSpeed || 1));
    intent.recoveryUntilUs = releaseTiming.recoveryUntilUs;
    updateArenaAction(arena, action.id, { timing: releaseTiming, primaryTiming: releaseTiming, area: releaseArea,
      targetId: releaseArea?.targetId ?? intent.targetId,
      targetX: releaseArea?.center.x ?? releaseDestination.x, targetY: releaseArea?.center.y ?? releaseDestination.y });
    const prepared = prepareSkillCast(s.skills, attackCharacter, intent.skillId,
      spendableMana(attackCharacter, s.skills, s.player.mana), releaseTargets, statuses, env, releaseArea);
    if (!prepared) { cancelIntent('not ready'); return; }
    payCast(prepared);
    const trance = bundleOf(c.keystones, 'trance');
    if (trance) rkH.counters.tranceCasts = (rkH.counters.tranceCasts || 0) + 1;
    if (force && skill.type === 'attack') rkH.flags.mirrorCrit = false;
    const struck = releaseArea
      ? targetsInSkillArea(releaseArea, arenaActors(s.group), profile.hit_radius_m).map((actor) => actor.mob.id)
      : [intent.targetId];
    castFx(intent.skillId, releaseArea, struck, action.id, releaseTiming);
    intent.phase = 'recovery';
    const flight: CombatFlight = {
      actionId: action.id, cast: prepared, character: attackCharacter,
      modifiers: { forceCrit: force, critDamageBonusPct: lucky,
        freeCast: free, missingHpPct: env.missingHpPct, outgoingDamageMult: crippledOutgoingMult },
      profile, timing: releaseTiming,
      source: releaseSource,
      destination: releaseDestination,
      area: releaseArea, position: { x: releaseSource.x, y: releaseSource.y }, lastCheckedAtUs: atUs,
      areaKey: encounterKeyOf(s),
    };
    if (skill.type === 'heal' || skill.type === 'buff') {
      const report = resolvePreparedCast(s.skills, attackCharacter, prepared, statuses, rng, env);
      applyCastOutcome(report, { pay: false, emitCast: false, castCounter: false, mirror: false,
        actionId: action.id, castTiming: releaseTiming });
      return;
    }
    if (skill.action?.kind === 'sand-field') {
      const scaled = sm.effectsAt(skill, prepared.level) as { stat: string; value: number }[];      const dotSec = Math.max(0, Math.floor(Number(scaled.find((effect) => effect.stat === 'dot_sec')?.value ?? 0)));
      const dotDps = Math.max(0, Number(scaled.find((effect) => effect.stat === 'dot_dps')?.value ?? 0));
      for (const old of [...arena.flights]) {
        if (old.cast.id !== skill.id) continue;
        const at = arena.flights.indexOf(old);
        if (at >= 0) arena.flights.splice(at, 1);
        const oldAction = arena.actions.find((entry) => entry.id === old.actionId);
        if (oldAction && oldAction.cancelledAtUs == null)
          updateArenaAction(arena, oldAction.id, { cancelledAtUs: atUs, cancelReason: 'replaced', endsAtUs: atUs });
      }
      const flights: CombatFlight[] = [{ ...flight, fieldInitial: true, impactIndex: 0, impactSharePct: 100 }];
      for (let index = 1; index <= dotSec; index++) {
        flights.push({ ...flight, fieldPulseDamage: dotDps,
          timing: { ...releaseTiming, impactAtUs: releaseTiming.releaseAtUs + index * units },
          impactIndex: index, impactSharePct: 100 });
      }
      const lastImpact = releaseTiming.releaseAtUs + dotSec * units;
      updateArenaAction(arena, action.id, {
        endsAtUs: Math.max(action.endsAtUs, lastImpact + E.combat_arena.action_sec * units),
      });
      for (const entry of flights) {
        arena.flights.push(entry);
        scheduleFlight(entry);
      }
      return;
    }
    if (skill.action?.kind === 'chain-strike') {
      const cache = newCastRollCache();
      const count = Math.max(1, Number(String(skill.targets ?? '1').split('/')[0]) || 1);
      const chained: CombatFlight = {
        ...flight, rolls: cache, impactIndex: 0, impactSharePct: 100,
        chain: {
          visited: [releaseArea?.targetId ?? intent.targetId],
          remaining: Math.max(0, count - 1),
          hopRange: chainHopRange,
          sharePct: 60,
          intervalSec: 0.08,
        },
      };
      arena.flights.push(chained);
      scheduleFlight(chained);
      return;
    }
    const actionDef = skill.action;
    if (actionDef) {
      const scaled = sm.effectsAt(skill, prepared.level) as { stat: string; value: number }[];
      const count = Math.max(1, Number(scaled.find((effect) => effect.stat === 'hits')?.value ?? 1));
      if (count > 1) {
        const sharePct = Number(scaled.find((effect) => effect.stat === 'hit_pct')?.value ?? 100);
        const cache = newCastRollCache();
        const recoveryUs = Math.ceil(profile.recovery_sec / Math.max(1e-7, c.globalSpeed || 1) * units);
        // One deployed field per caster-skill-arena: a deliberate recast replaces it at release and
        // cancels only its unspent pulses. Resolved pulses and their rewards stay spent.
        if (actionDef.kind === 'blizzard-field') {
          for (const old of [...arena.flights]) {
            if (old.cast.id !== skill.id) continue;
            const at = arena.flights.indexOf(old);
            if (at >= 0) arena.flights.splice(at, 1);
            const oldAction = arena.actions.find((entry) => entry.id === old.actionId);
            if (oldAction && oldAction.cancelledAtUs == null)
              updateArenaAction(arena, oldAction.id, { cancelledAtUs: atUs, cancelReason: 'replaced', endsAtUs: atUs });
          }
        }
        const flights: CombatFlight[] = [];
        for (let index = 0; index < count; index++) {
          let timing = releaseTiming;
          let follow = false;
          if (actionDef.kind === 'projectile-burst') {
            const releaseAt = releaseTiming.releaseAtUs
              + Math.round(index * Number(actionDef.interval_sec ?? 0.15) * units);
            timing = { ...releaseTiming, releaseAtUs: releaseAt,
              impactAtUs: releaseAt + Math.max(0, releaseTiming.impactAtUs - releaseTiming.releaseAtUs),
              recoveryUntilUs: releaseAt + recoveryUs };
          } else if (actionDef.kind === 'ground-pulse-burst') {
            timing = { ...releaseTiming,
              impactAtUs: releaseTiming.impactAtUs
                + Math.round(index * Number(actionDef.interval_sec ?? 0.3) * units) };
          } else if (actionDef.kind === 'blizzard-field') {
            const durationSec = Number.parseFloat(String(skill.duration ?? '')) || 8;
            timing = { ...releaseTiming,
              impactAtUs: releaseTiming.releaseAtUs
                + Math.round(durationSec * units * (index + 1) / count) };
          } else {
            // Whirlwind: a caster-following pulse at the authored share of its active window.
            const activeUs = Number(actionDef.active_sec ?? 1.2) * units;
            const impactAt = releaseTiming.releaseAtUs + Math.round(activeUs * (index + 1) / count);
            timing = { ...releaseTiming, impactAtUs: impactAt, recoveryUntilUs: impactAt + recoveryUs };
            follow = true;
          }
          flights.push({ ...flight, timing, ...(follow ? { follow: true } : {}),
            impactIndex: index, impactSharePct: sharePct, rolls: cache });
        }
        if (actionDef.kind === 'whirlwind-channel') {
          intent.mobile = true;
          intent.speedMult = Number(actionDef.movement_speed_mult ?? 0.6);
          intent.recoveryUntilUs = Math.max(...flights.map((entry) => entry.timing.impactAtUs)) + recoveryUs;
          updateArenaAction(arena, action.id, {
            channel: true,
            timing: { ...releaseTiming, recoveryUntilUs: intent.recoveryUntilUs },
            primaryTiming: { ...releaseTiming, recoveryUntilUs: intent.recoveryUntilUs },
          });
        } else if (actionDef.kind === 'projectile-burst') {
          intent.recoveryUntilUs = Math.max(...flights.map((entry) => entry.timing.releaseAtUs)) + recoveryUs;
          updateArenaAction(arena, action.id, {
            channel: true,
            timing: { ...releaseTiming, recoveryUntilUs: intent.recoveryUntilUs },
          });
        }
        const lastImpact = Math.max(...flights.map((entry) => entry.timing.impactAtUs));
        updateArenaAction(arena, action.id, {
          endsAtUs: Math.max(action.endsAtUs, lastImpact + E.combat_arena.action_sec * units),
        });
        for (const entry of flights) {
          arena.flights.push(entry);
          scheduleFlight(entry);
        }
        return;
      }
    }
    if (profile.delivery === 'projectile') {
      arena.flights.push(flight);
      scheduleFlight(flight);
      return;
    }
    if (action.timing && action.timing.impactAtUs > atUs) {
      arena.flights.push(flight);
      scheduleFlight(flight);
      return;
    }
    resolveFlight(flight, atUs);
  }

  function scheduleFlight(flight: CombatFlight) {
    if (!arena || flight.queued) return;
    if (flight.profile.delivery === 'projectile') {
      const action = arena.actions.find(entry => entry.id === flight.actionId);
      const index = flight.impactIndex ?? 0;
      if (action && !action.payloads?.some(payload => payload.index === index)) {
        updateArenaAction(arena, action.id, { payloads: [...(action.payloads ?? []), {
          index, source: { ...flight.source }, destination: { ...flight.destination },
          releaseAtUs: flight.timing.releaseAtUs, plannedImpactAtUs: flight.timing.impactAtUs,
          targetId: flight.area?.targetId,
        }] });
      }
    }
    const atUs = Math.max(tickStartUs, flight.timing.impactAtUs);
    if (atUs > tickEndUs) return;
    flight.queued = true;
    clock.schedule(atUs, EVENT_PRIORITY.secondary, 'player', flight.area?.targetId ?? 'group', () => {
      flight.queued = false;
      if (arena?.flights.includes(flight)) resolveFlight(flight, clock.nowUs);
    });
  }

  function resolveFlight(flight: CombatFlight, atUs: number, forced?: Mob[], contact?: { x: number; y: number }) {
    if (!arena) return;
    if (areaChanged(flight)) { cancelFlight(flight, atUs, 'area-exit'); return; }
    // A caster-following pulse reads the current caster centre; a deployed field never does.
    if (flight.follow && flight.area) {
      const center = { x: arena.player.x, y: arena.player.y };
      flight.source = { ...center };
      flight.destination = { ...center };
      flight.area = { ...flight.area, center };
      flight.position = { ...center };
    }
    const at = arena.flights.indexOf(flight);
    if (at >= 0) arena.flights.splice(at, 1);
    advanceLiveClocks(atUs);
    if (contact) flight.destination = contact;
    // The resolved impact time replaces the planned arrival once; every later reader (event,
    // action, history) sees the same corrected fact.
    flight.timing = { ...flight.timing, impactAtUs: atUs };
    const targets = forced ?? (flight.hitTargetId
      ? s.group.filter((mob) => mob.id === flight.hitTargetId && mob.hp > 0)
      : flightTargets(arena, s.group, flight));
    const report = resolvePreparedCast(s.skills, flight.character,
      { ...flight.cast, targets, area: flight.area }, statuses, rng, {
        ...flight.modifiers, mobStatus: s.mobStatus, curses: s.curses, timeUs: atUs,
        availableGroup: s.group,
        positionOf: (id) => arena.mobs[id] ? { x: arena.mobs[id].x, y: arena.mobs[id].y } : undefined,
        ...(flight.rolls ? {
          impact: { index: flight.impactIndex ?? 0, sharePct: flight.impactSharePct ?? 100, cache: flight.rolls },
        } : {}),
        ...(flight.fieldInitial ? { suppressErosion: true } : {}),
        ...(flight.fieldPulseDamage != null ? { fieldPulse: flight.fieldPulseDamage } : {}),
      });
    applyCastOutcome(report, { pay: false, emitCast: false, castCounter: false, mirror: false,
      actionId: flight.actionId, castTiming: flight.timing });
    const action = arena.actions.find((entry) => entry.id === flight.actionId);
    if (action) updateArenaAction(arena, action.id, {
      ...(action.payloads ? { payloads: action.payloads.map(payload => payload.index === (flight.impactIndex ?? 0)
        ? { ...payload, impactAtUs: atUs, contact: { ...flight.destination }, targetId: flight.hitTargetId ?? payload.targetId }
        : payload) } : {}),
      hitIds: [...new Set([...(action.hitIds ?? []), ...report.byMob.map((hit) => hit.id)])],
      impactCount: (action.impactCount ?? 0) + 1,
      ...(flight.hitTargetId ? { targetId: flight.hitTargetId } : {}),
      ...(contact && flight.area?.radiusM === 0 ? { area: { ...flight.area, center: contact } } : {}),
      ...(contact ? { targetX: contact.x, targetY: contact.y } : {}),
      timing: flight.timing,
      endsAtUs: Math.max(action.endsAtUs, atUs + E.combat_arena.action_sec * units),
    });
    if (arena.intent && arena.intent.actionId === flight.actionId
      && arena.intent.phase === 'windup') cancelIntent('impact');
    if (flight.chain && flight.chain.remaining > 0) {
      const lastId = flight.area?.targetId ?? flight.cast.targets[0]?.id;
      const lastPose = lastId ? arena.mobs[lastId] : undefined;
      const origin = lastPose ?? flight.area?.center ?? flight.destination;
      const next = s.group
        .filter((mob) => mob.hp > 0 && !flight.chain!.visited.includes(mob.id) && arena.mobs[mob.id])
        .map((mob) => ({ mob, pose: arena.mobs[mob.id] }))
        .filter((entry) => arenaDistance(origin, entry.pose) <= flight.chain!.hopRange + 1e-7)
        .sort((a, b) => arenaDistance(origin, a.pose) - arenaDistance(origin, b.pose)
          || (a.mob.id < b.mob.id ? -1 : 1))[0];
      if (next) {
        const nextTiming: SkillCastTiming = {
          delivery: 'instant', startedAtUs: atUs, releaseAtUs: atUs,
          impactAtUs: atUs + Math.ceil((flight.chain.intervalSec ?? 0.08) * units),
          recoveryUntilUs: atUs,
        };
        const nextFlight: CombatFlight = {
          ...flight,
          cast: { ...flight.cast, targets: [next.mob] },
          area: { origin: 'target', radiusM: 0,
            center: { x: next.pose.x, y: next.pose.y }, targetId: next.mob.id },
          timing: nextTiming,
          source: { x: origin.x, y: origin.y },
          destination: { x: next.pose.x, y: next.pose.y },
          position: { x: origin.x, y: origin.y },
          lastCheckedAtUs: atUs,
          impactIndex: (flight.impactIndex ?? 0) + 1,
          impactSharePct: flight.chain.sharePct,
          chain: { ...flight.chain, visited: [...flight.chain.visited, next.mob.id],
            remaining: flight.chain.remaining - 1 },
          hitTargetId: undefined,
        };
        arena.flights.push(nextFlight);
        scheduleFlight(nextFlight);
      }
    }
  }

  function sweepFlights(atUs: number) {
    if (!arena) return;
    for (const flight of [...arena.flights]) {
      if (areaChanged(flight)) { cancelFlight(flight, atUs, 'area-exit'); continue; }
      if (flight.profile.delivery !== 'projectile') continue;
      if (atUs < flight.timing.releaseAtUs) continue;
      const from = flight.position;
      const to = projectilePosition(flight, atUs);
      const previous = arena.frames.at(-2) ?? arena.frames.at(-1);
      const actors = arenaActors(s.group).map((actor) => {
        const before = previous?.mobs[actor.mob.id];
        return { ...actor, ...(before ? { previous: { x: before.x, y: before.y } } : {}) };
      });
      const hit = firstProjectileHit(from, to, actors, flight.profile.hit_radius_m);
      flight.position = to;
      flight.lastCheckedAtUs = atUs;
      if (hit) {
          const contact = { x: from.x + (to.x - from.x) * hit.fraction,
            y: from.y + (to.y - from.y) * hit.fraction };
        if (flight.area?.shape === 'line') {
          // A piercing shot commits a line, not a body: every eligible body on it is struck once.
          resolveFlight(flight, atUs, undefined, contact);
        } else {
          flight.hitTargetId = hit.target.mob.id;
          resolveFlight(flight, atUs, [hit.target.mob], contact);
        }
      }
    }
  }

  function ensureIntent(atUs: number) {
    if (!arena) return;
    let intent = arena.intent;
    if (intent?.phase === 'recovery' && atUs >= (intent.recoveryUntilUs ?? 0)) {
      arena.intent = undefined;
      intent = undefined;
    }
    // A deliberate cast request bypasses automatic slot enable/conditions; canonical ownership,
    // range, resource and cooldown checks still run at release.
    if (manual?.cast) {
      if (intent?.phase === 'windup') { cancelIntent('manual cast'); intent = arena.intent; }
      if (intent?.phase === 'recovery') {
        if (intent.mobile) {
          for (const flight of [...arena.flights]) {
            if (flight.actionId !== intent!.actionId || flight.timing.impactAtUs <= atUs) continue;
            const at = arena.flights.indexOf(flight);
            if (at >= 0) arena.flights.splice(at, 1);
          }
          return;
        }
        if (atUs < (intent.recoveryUntilUs ?? 0)) return;
        arena.intent = undefined;
        intent = undefined;
      }
      const request = manual.cast;
      const focus = arena.focusId
        ? s.group.find((mob) => mob.id === arena!.focusId && mob.hp > 0 && arena!.mobs[mob.id]) : undefined;
      const primary = focus ?? arenaTarget(arena, s.group);
      const pose = primary ? arena.mobs[primary.id] : undefined;
      if (!sm.byId[request.skillId]) { manual.cast = undefined; return; }
      const next: CombatIntent = {
        skillId: request.skillId,
        targetId: primary?.id ?? '',
        targetPoint: request.point ?? (pose ? { x: pose.x, y: pose.y } : { x: arena.player.x, y: arena.player.y }),
        phase: 'approach',
        manual: true,
        ...(request.point ? { aimPoint: true } : {}),
      };
      manual.cast = undefined;
      manual.moveTo = undefined;
      arena.intent = next;
      engageTarget(next.targetId);
      if (intentInRange(arena, next, s.group)) startWindup(next, atUs);
      return;
    }
    if (intent?.manual && intent.phase === 'approach') {
      if (intent.targetId && !s.group.some((mob) => mob.id === intent!.targetId && mob.hp > 0)) {
        arena.intent = undefined;
        return;
      }
      if (intentInRange(arena, intent, s.group)) startWindup(intent, atUs);
      return;
    }
    if (manual?.moveTo) {
      if (arena.intent?.phase === 'windup') cancelIntent('manual move');
      else if (arena.intent?.phase === 'approach') arena.intent = undefined;
      return;
    }
    // A manual request keeps its action alive when automatic skills are off; hard control still
    // cancels an unpaid manual windup at the control timestamp.
    if (playerActiveFraction <= 0) { cancelIntent('inactive'); return; }
    if (!autoSkills && !intent?.manual) { cancelIntent('inactive'); return; }
    if (intent?.phase === 'windup') {
      if (!s.group.some((mob) => mob.id === intent!.targetId && mob.hp > 0)) cancelIntent('target lost');
      return;
    }
    if (intent?.phase === 'recovery') return;
    const next = selectCombatIntent(arena, s, attackCharacter, autoSkills);
    if (!next) { arena.intent = undefined; return; }
    arena.intent = next;
    engageTarget(next.targetId);
    if (intentInRange(arena, next, s.group)) startWindup(next, atUs);
  }

  // §7.1: the basic swing is expanded from accumulated progress into absolute-µs events, so a stop,
  // a rate change or a kill inside the window moves the queue instead of replaying the second.
  const playerRate = playerHitsPerSec * playerActiveFraction;
  // 42 Crushing Rhythm: the basic clock is capped and the real excess rate becomes one damage
  // multiplier on the swing (an already-slow weapon is never hurried and Slow still binds).
  const crush = bundleOf(c.keystones, 'crushing-rhythm');
  const crushNow = crush ? crushingRhythm(playerRate, crush.params as Record<string, number>) : null;
  const playerPlan = planAttacks(tickStartUs, s.player.atkTimer, crushNow ? crushNow.actualRate : playerRate, units);
  s.player.atkTimer = playerPlan.progressAtEnd;
  let swingsStopped = false;
  for (const atUs of playerPlan.times) {
    clock.schedule(atUs, EVENT_PRIORITY.playerAction, 'player', front?.id ?? '', () => {
      if (swingsStopped) return;
      if (!arena && !online && !fieldInFight(s)) return;
      // A local move order pauses new automatic primary attacks until it arrives.
      if (manual?.moveTo) return;
      if (arena?.intent && (arena.intent.phase === 'windup' || arena.intent.phase === 'recovery')) return;
      advanceArenaAt(clock.nowUs);
      const intended = arena?.intent?.targetId
        ? s.group.find((mob) => mob.id === arena.intent!.targetId && mob.hp > 0) : undefined;
      const target = arena ? intended ?? arenaTarget(arena, s.group) : s.group[0];
      if (!target) { swingsStopped = true; return; }
      if (arena && !arenaInRange(arena, target.id, playerRange)) return;
      engageTarget(target.id);
      if (arena) arenaAction(arena, 'player', 'swing', clock.nowUs, target.id);
      const tm = mobMods(target.id);
      // Packet H action history: 04 Rage, 12 Worthy Foe and 32 Instruments all ride the one Hit
      // multiplier, composed here so each condition is read at the event's own time.
      const rk = s.keystoneRuntime;
      const redline = bundleOf(c.keystones, 'redline');
      const instruments = bundleOf(c.keystones, 'instruments-of-virtue');
      const worthy = bundleOf(c.keystones, 'worthy-foe');
      const worthyNow = worthy ? worthyFoe(rk.counters[target.id] || 0, worthy.params as Record<string, number>) : { dealtMult: 1, takenMult: 1 };
      const hitMult = (crushNow ? crushNow.damageMult : 1) * berserkDealt * unstoppablePenalty * crippledOutgoingMult
        * (redline ? redlineDamageMult(redline.params as Record<string, number>, rk.stacks.redline || 0) : 1)
        * worthyNow.dealtMult
        * (instruments ? instrumentsMult(rk.lastAction, 'attack', instruments.params as Record<string, number>) : 1);
      // `10` Painforged spends its bank on this Hit as flat Physical, before the crit roll (§7.2.2)
      const forged = bundleOf(c.keystones, 'painforged');
      const lucky = bundleOf(c.keystones, 'lucky-streak');
      const forceMirror = mirrorReady();
      const hpBefore = target.hp;
      const r = playerSwing(rng, attackCharacter, target, c.weaponElement, tm, atUs, hitMult,
        forged ? rk.stacks.painforged || 0 : 0, forceMirror, luckyBonus());
      if (r.landed) {
        if (forceMirror) rk.flags.mirrorCrit = false;
        if (lucky) rk.stacks.luckyStreak = r.crit
          ? Math.min(Number(lucky.params.maxStacks), (rk.stacks.luckyStreak || 0) + 1) : 0;
        if (forged) rk.stacks.painforged = 0;
        if (worthy) {
          for (const id of Object.keys(rk.counters)) if (id !== target.id) delete rk.counters[id];
          rk.counters[target.id] = (rk.counters[target.id] || 0) + 1;
        }
        if (redline) {
          rk.stacks.redline = Math.min(Number(redline.params.maxStacks), (rk.stacks.redline || 0) + Number(redline.params.hitStacks));
          rk.lastHitAtUs = atUs;
        }
        if (instruments) rk.lastAction = 'attack';
        // `66` Elemental Conduit: the as-extra lane this Hit carried gets its own separate status
        // attempt per Element — the same gate, proc and immunity every other status answer.
        const conduit = bundleOf(c.keystones, 'elemental-conduit');
        const extraLane = conduit ? r.packet?.parts.extraElement || {} : {};
        // the weapon's own riders — Element status, bleed and stun — on the swing's own hit, and on a
        // landing press too (§14), through one function so the two cannot drift
        applyWeaponRiders(rng, c, s.mobStatus, target.id, lineValue(s.curses, target.id, 'bleed_chance') > 0, 0, 0, target.immune || [], extraLane);
        spreadShock(target);
        // `09` Crimson Pact and `20` Toxic Execution: the physical this Hit withheld is not lost, it is
        // written on the target's own status clock — no Alignment gate and no proc roll, because the
        // bundle already decided the application. Immunity is the only thing that answers it.
        if (r.bleed) placeKeystoneDoT(s.mobStatus, target.id, 'bleed', r.bleed.perSec, r.bleed.sec, 0, target.immune || []);
        if (r.poison) placeKeystoneDoT(s.mobStatus, target.id, 'poison', r.poison.perSec, r.poison.sec, r.poison.budgetDps, target.immune || []);
        // `30` Elemental Equilibrium: the Element that carried this Hit decides which line the target
        // resists harder from here, and which it stops resisting (its own seconds, then it lapses).
        const eq = bundleOf(c.keystones, 'elemental-equilibrium');
        if (eq && r.packet) {
          const dominant = dominantElement(r.packet.parts);
          if (dominant) applyEquilibrium(target, dominant, eq.params as Record<string, number>, s.clockSec);
        }
        // `60` Plague Courier: a crit sends one Burn, Poison or Bleed off a neighbour and onto the body
        // the crit landed on, with the damage and the life it had left. A transfer that immunity
        // refuses costs nothing, so the ICD waits for the next crit (§7.6).
        const plague = bundleOf(c.keystones, 'plague-courier');
        if (plague && r.crit && clock.nowUs >= (rk.icdsUs.plagueCourier ?? 0)) {
          const carrier = s.group.find((m) => m !== target && carriesTransferable(s.mobStatus, m.id));
          if (carrier && transferStatus(s.mobStatus, carrier.id, target.id, target.immune || []))
            rk.icdsUs.plagueCourier = clock.nowUs + Number(plague.params.icdSec) * units;
        }
        // a swing that gives back HP is two events, not one: the blow the mob sees and the return the
        // character feels, each on its own half of the field
        recoverLeech(r.leech || 0, atUs);
        credit(s, 'swing', r.damage);
        // 21 Delayed Demolition: the deferred share is queued against this target and lost if it dies
        if (r.deferred && r.deferred > 0) {
          const dd = bundleOf(c.keystones, 'delayed-demolition')!;
          s.keystoneRuntime.queues.deferred.push({
            dueAtUs: atUs + Number(dd.params.delaySec) * units, amount: r.deferred,
            sourceId: 'player', targetId: target.id,
          });
        }
        // `22` Demolition Sequence: five landed Hits that actually took Health off this one body sum
        // their loss, and the fifth spends it — a blast worth a share of that sum on the body itself
        // and the weakest neighbour still standing. DoT, deferred damage and this blast count for
        // nothing, and changing the target before the fifth Hit clears the sum (§7.2).
        const seq = bundleOf(c.keystones, 'demolition-sequence');
        const realLoss = Math.max(0, hpBefore - target.hp);
        if (seq && realLoss > 0) {
          const hitsKey = `ds:hits:${target.id}`;
          const lossKey = `ds:loss:${target.id}`;
          const hits = (rk.counters[hitsKey] || 0) + 1;
          const summed = (rk.targetCounters[lossKey] || 0) + realLoss;
          if (hits >= Number(seq.params.hits)) {
            rk.counters[hitsKey] = 0;
            rk.targetCounters[lossKey] = 0;
            const promised = demolitionBlast(summed, seq.params as Record<string, number>);
            const element = String(seq.params.element);
            const neighbours = s.group.filter((m) => m !== target && m.hp > 0)
              .sort((a, b) => a.hp - b.hp || (a.id < b.id ? -1 : 1))
              .slice(0, Number(seq.params.extraTargets));
            for (const hit of [target, ...neighbours]) {
              const dealt = eng.mitigateMobHit(hit, 0, { [element]: promised });
              if (!(dealt > 0)) continue;
              hit.hp -= dealt;
              credit(s, 'swing', dealt);
              fx(s, { kind: 'hit', side: 'field', mobId: hit.id, via: 'swing', text: eng.fmt(dealt), value: dealt, colour: hitColour(element) });
            }
            push(s, `Demolition Sequence detonates for ${eng.fmt(promised)}`);
            while (s.group.some((m) => m.hp <= 0)) {
              const dead = s.group.splice(s.group.findIndex((m) => m.hp <= 0), 1)[0];
              delete rk.counters[`ds:hits:${dead.id}`];
              delete rk.targetCounters[`ds:loss:${dead.id}`];
              onKill(s, rng, dead, c, statuses);
            }
          } else {
            rk.counters[hitsKey] = hits;
            rk.targetCounters[lossKey] = summed;
          }
        }
        // 43 Armourbreaker: each landed Physical Hit breaks 5% of the target's initial Armour
        const breaker = bundleOf(c.keystones, 'armourbreaker');
        const physical = (r.packet?.parts.physicalCritEligible || 0) + (r.packet?.parts.physicalNonCrit || 0);
        if (breaker && physical > 0) {
          const initKey = `ab:init:${target.id}`;
          const stackKey = `ab:stacks:${target.id}`;
          if (s.keystoneRuntime.targetCounters[initKey] === undefined) s.keystoneRuntime.targetCounters[initKey] = target.armour;
          const init = s.keystoneRuntime.targetCounters[initKey];
          const broken = armourBreak(init, s.keystoneRuntime.targetCounters[stackKey] || 0, breaker.params as Record<string, number>);
          s.keystoneRuntime.targetCounters[stackKey] = broken.stacks;
          target.armour = broken.armour;
          s.keystoneRuntime.icdsUs[`ab:last:${target.id}`] = clock.nowUs;
        }
        // 46 delays the action clock, including pending telegraphs, without applying Shock's debuff.
        const disrupt = bundleOf(c.keystones, 'disrupting-blows');
        if (disrupt && disruptingStop(r.damage, target.hpMax, disrupt.params as Record<string, number>)) {
          const delaySec = Number(disrupt.params.stopSec);
          const plan = mobPlans.find((entry) => entry.mob === target);
          if (plan && spendControlBudget(s.mobStatus, target.id, delaySec)) {
            clock.delayActor(target.id, delaySec * units);
            target.atkTimer -= plan.rate * delaySec;
          }
        }
        fx(s, {
          kind: 'hit', side: 'field', mobId: target.id, crit: r.crit, via: 'swing',
          text: eng.fmt(r.damage), value: r.damage, colour: hitColour(r.element || null, r.crit),
        });
        if (r.crit) {
          push(s, `Crit for ${eng.fmt(r.damage)} (${target.species})`);
          queueTrigger(trig.crit, target.id);
        }
        if (target.hp <= 0) {
          // a Detonation above may already have taken this body off the field, and a kill credits once
          if (s.group.includes(target)) {
            s.group.splice(s.group.indexOf(target), 1);
            onKill(s, rng, target, c, statuses);
          }
          if (arena?.intent?.targetId === target.id) cancelIntent('target lost');
          s.player.atkTimer = 0;
          swingsStopped = true;
        }
      } else if (r.why) {
        // a swing the mob answered without taking pops its word on that mob's own corner, the way a
        // landed blow pops its number — a dodge reads where the dodger stands, never in a shared column.
        fx(s, { kind: 'block', side: 'field', mobId: target.id, text: r.why, colour: hitColour(null) });
      }
    });
  }

  // The rotation presses at t0 (§7.1 priority 30), before the window's own swing events.
  clock.schedule(tickStartUs, EVENT_PRIORITY.playerAction, 'player', front?.id ?? '', () => {
    // the rotation casts the first ready, affordable slot top-down — no manual presses.
    // Haste is a post-cap multiplier on this clock; Chill slows the same clock.
    if (!arena) tickSkills(s.skills, c.globalSpeed * playerActiveFraction);
    else tickSkillBuffs(s.skills, c.globalSpeed * playerActiveFraction);
    // Cooldowns still count down while Auto Skills is off; only automatic casts stop. A shocked clock
    // (playerActiveFraction 0) stops the presses the same way it stops the rotation: nothing re-presses
    // while the character cannot act, and regen is stopped beside it.
    if (!arena && !online && !fieldInFight(s)) return;
    if (autoSkills && playerActiveFraction > 0) {
      for (const id of Object.keys(s.skills.buffs)) {
        if (!buffNeedsRecast(s.skills, id)) continue;
        const skill = sm.byId[id];
        const cost = buffRecastCost(s.skills, c, id);
        if (cost.resource === 'mana') {
          if (cost.amount > spendableMana(c, s.skills, s.player.mana)) continue;
          s.player.mana -= cost.amount;
        } else {
          if (cost.amount >= s.player.hp) continue;
          s.player.hp = Math.max(1, s.player.hp - cost.amount);
        }
        s.skills.cd[id] = skillCd(s.skills, id, c.cdr);
        // the toggle recast pays the same outcome the rotation's press would: charges, blocks and a
        // cleanse are part of what the buff grants, not a one-off on its first cast
        const outcome = buffCastOutcome(s.skills, id);
        s.skills.buffUp[id] = outcome?.durationSec ?? 10;
        if (outcome?.charges != null) {
          s.player.charges = outcome.charges;
          push(s, `${skill.name || id} grants ${outcome.charges} perfect-dodge charges`);
        }
        if (outcome?.blockCharges != null) {
          s.player.blockCharges = outcome.blockCharges;
          push(s, `${skill.name || id} grants ${outcome.blockCharges} blocks`);
        }
        if (outcome?.cleansesSelf) {
          const cleared = Object.keys(statuses).length;
          for (const k of Object.keys(statuses) as StatusName[]) delete statuses[k];
          if (cleared) push(s, `${skill.name || id} clears ${cleared} status${cleared > 1 ? '' : 'es'} off you`);
        }
        // a buff coming up is a gain the character receives, so it is raised where the character is read, in
        // the colour of the Element the row carries — the same pair of rules a press already follows
        fx(s, {
          kind: 'buff', side: 'self', skillId: id, text: String(skill.name || id),
          colour: hitColour((skill as any).element || null),
        });
      }
      if (arena) {
        cooldownAtUs = tickStartUs;
        ensureIntent(tickStartUs);
      } else {
        const cast = castOnce(s.skills, attackCharacter, spendableMana(attackCharacter, s.skills, s.player.mana), s.group, statuses, rng, {
          resolveTargetsForSkill,
          mobStatus: s.mobStatus, curses: s.curses,
          currentHp: s.player.hp,
          missingHpPct: c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0,
          isBoss: s.group.some((mob) => isBossKind(String(mob.kind))),
          timeUs: tickStartUs,
          freeCast: tranceFree(),
          forceCrit: mirrorReady(),
          critDamageBonusPct: luckyBonus(),
        });
        applyCast(cast);
      }
    } else if (arena) cancelIntent('auto-off');
  });

  const hadGroupBeforeDamage = s.group.length > 0;
  const hadEngagement = (s.field?.engagementIds.length ?? 0) > 0;
  // statuses age once a second, and the DoT they deal lands before the window's actions (§7.1 priority 10)
  clock.schedule(tickStartUs, EVENT_PRIORITY.pendingDamage, 'player', 'group', () => {
    const parasite = bundleOf(c.keystones, 'parasitic-affliction');
    for (const mob of s.group) {
      // `30` Elemental Equilibrium is the target's own seconds: the shift lapses on this beat, before
      // the body's next status tick, so a resistance line never stays bent past its duration
      revertEquilibrium(mob, s.clockSec);
      const leechPct = parasite ? c.leechPct + mobMods(mob.id).leechPct : 0;
      const dot = stepMobParts(s.mobStatus, mob.id);
      if (dot.total > 0) {
        const actual = Math.min(Math.max(0, mob.hp), dot.total);
        mob.hp -= dot.total;
        if (parasite) recoverLeech(parasiticLeech(actual, parasite.params as Record<string, number>, leechPct), clock.nowUs);
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
        onKill(s, rng, target, c, statuses);
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
  function resolveIncomingHit(mob: Mob, plannedSkill: MobSkillRow | undefined, rng: () => number, live: Mob = mob) {
    const tm = mobMods(mob.id);
    let hurt = false;
    // Blur: every third direct Hit is a Perfect Dodge. It is its own rule, not a roll.
    const blur = bundleOf(c.keystones, 'blur');
    if (blur) {
      rkH.counters.blurHits = (rkH.counters.blurHits || 0) + 1;
      if (rkH.counters.blurHits >= Number(blur.params.hitsPerDodge)) {
        rkH.counters.blurHits = 0;
        fx(s, { kind: 'proc', side: 'self', byId: mob.id, skillId: plannedSkill?.id, text: 'perfect dodge', colour: hitColour(null) });
        return;
      }
    }
    // a Ghost Dance charge deletes the hit outright and is not opposed: it goes before the
    // rolls, which is the whole difference between it and Dodge
    if ((s.player.charges || 0) > 0) {
      s.player.charges!--;
      return;
    }
    // 03's always-on take-more line and 12's duel defence are per incoming Hit and per target
    const worthyT = bundleOf(c.keystones, 'worthy-foe');
    const duel = worthyT ? worthyFoe(rkH.counters[mob.id] || 0, worthyT.params as Record<string, number>) : { dealtMult: 1, takenMult: 1 };
    const takenChar = {
      ...c,
      damageTaken: (c.damageTaken ?? 1)
        * (berserk ? Number(berserk.params.takenMult) : 1) * duel.takenMult,
    };
    const mobSkill = plannedSkill;
    const r = mobSwing(rng, takenChar, mob, statuses, tm, s.player.es, absorbPct, (s.player.blockCharges || 0) > 0, s.player.hp);
    // Mirror Strike: the Evasion success banks the next player Hit's crit.
    const mirror = bundleOf(c.keystones, 'mirror-strike');
    if (mirror && r.blocked === 'evasion') {
      rkH.flags.mirrorCrit = true;
      rkH.icdsUs.mirrorUntil = clock.nowUs + Number(mirror.params.windowSec) * units;
      push(s, 'Mirror Strike banks a guaranteed crit');
    }
    if (mobSkill) {
      markMobSkillUsed(live, mobSkill, clock.nowUs, units);
      if (online) push(s, `${mob.species} uses ${mobSkill.name}`);
    }
    // an Earth Wall charge answered the swing: it is spent whether the shield rolled or not
    if (r.blockChargeSpent) s.player.blockCharges!--;
    // `10` Painforged: what a Block actually took off this Hit is banked, up to its share of Max HP,
    // and the next swing spends the whole of it as flat Physical. Turtle Doctrine's expected cut is
    // not a Block event, so it feeds the bank nothing (§7.3.3).
    const forgedIn = bundleOf(c.keystones, 'painforged');
    if (forgedIn && r.blockCut) {
      rkH.stacks.painforged = painforgedBank(rkH.stacks.painforged || 0, r.blockCut, c.maxHp,
        forgedIn.params as Record<string, number>);
    }
    // Riposte: a real Block sends its prevented damage back, on its own ICD.
    const riposte = bundleOf(c.keystones, 'riposte');
    const blockedCut = r.blockCut ?? 0;
    if (riposte && blockedCut > 0 && clock.nowUs >= (rkH.icdsUs.riposte ?? 0)) {
      const promised = blockedCut * Number(riposte.params.reflectMult);
      const dealt = eng.mitigateMobHit(live, promised, 0);
      if (dealt > 0) {
        live.hp -= dealt;
        rkH.icdsUs.riposte = clock.nowUs + Number(riposte.params.icdSec) * units;
        credit(s, 'swing', dealt);
        fx(s, { kind: 'hit', side: 'field', mobId: mob.id, via: 'swing', text: eng.fmt(dealt), value: dealt, colour: hitColour(null) });
        push(s, `Riposte answers ${mob.species} for ${eng.fmt(dealt)}`);
        if (live.hp <= 0 && s.group.includes(live)) {
          s.group.splice(s.group.indexOf(live), 1);
          onKill(s, rng, live, c, statuses);
        }
      }
    }
    if (r.leech && r.leech > 0) live.hp = Math.min(live.hpMax, live.hp + r.leech);
    // 11 Fortify cuts every later Hit by its stacks; 16 Bark spends one charge on a Hit that lands
    const fortNow = bundleOf(c.keystones, 'fortress-under-siege');
    const barkNow = bundleOf(c.keystones, 'barkskin');
    let toEs = r.toEs;
    let toHp = r.toHp;
    if (fortNow) {
      const reduction = Math.max(0, 1 - Math.min(Number(fortNow.params.maxStacks), rkH.stacks.fortress || 0)
        * Number(fortNow.params.reductionPctPerStack) / 100);
      toEs *= reduction;
      toHp *= reduction;
    }
    if (barkNow && toEs + toHp > 0 && (rkH.stacks.bark || 0) > 0) {
      const taken = Number(barkNow.params.hitTakenMult);
      toEs *= taken;
      toHp *= taken;
      rkH.stacks.bark!--;
    }
    // a defence is an event too: the screen has to say *which* answer stopped the hit, because
    // Block, Evasion and a perfect dodge animate differently and the player reads them apart. Either way
    // the striker is named, so the body that swung can lean into its own blow.
    if (r.blocked) fx(s, { kind: 'block', side: 'self', byId: mob.id, skillId: plannedSkill?.id, text: r.blocked, colour: hitColour(null) });
    // 23 Ghost Dance: an Evasion success (not Perfect Dodge) recovers ES on its own ICD
    const ghost = bundleOf(c.keystones, 'ghost-dance');
    if (ghost && r.blocked === 'evasion' && clock.nowUs >= (rkH.icdsUs.ghostDance ?? 0)) {
      const gained = ghostDanceRecovery(c.evasion, c.es, ghost.params as Record<string, number>);
      s.player.es = Math.min(c.es, s.player.es + gained);
      rkH.icdsUs.ghostDance = clock.nowUs + Number(ghost.params.icdSec) * units;
    }
    // `cast_on_damage_taken` listens for any hit that actually took off the player (HP or shield)
    if (toHp > 0 || toEs > 0) {
      hurt = true;
      // the incoming number wears the attacker's own Element, the same line the resistance roll
      // answered — a chaos hit reads purple whether or not the shield ate it
      fx(s, {
        kind: 'taken', side: 'self', byId: mob.id, skillId: plannedSkill?.id,
        text: eng.fmt(toHp + toEs), value: toHp + toEs,
        hpDamage: toHp, esDamage: toEs,
        colour: hitColour(mob.innate?.[0] || null),
      });
    }
    if (r.absorbed > 0) s.player.es = Math.min(c.es, s.player.es + r.absorbed);
    const gate = bundleOf(c.keystones, 'shield-gate');
    const esBefore = s.player.es;
    if (toEs > 0) { s.player.es -= toEs; if (!buffRuleUp(s.skills, 'es_recharge_immediate')) s.player.esIdleSec = 0; }
    if (gate && shieldGateHolds(esBefore, s.player.es, rkH.flags.shieldGateArmed ?? true)) {
      // the overflow of the Hit that broke the shield does not reach HP; the gate disarms
      toHp = 0;
      rkH.flags.shieldGateArmed = false;
      rkH.icdsUs.shieldGateArmAt = clock.nowUs + Number(gate.params.rearmCdSec) * units;
    }
    if (toHp > 0) {
      // 33 Mind over Matter pays its share from positive unreserved Mana, 1:1 — after ES (§7.3.8)
      let hpLoss = toHp;
      const mom = bundleOf(c.keystones, 'mind-over-matter');
      if (mom) {
        const pay = mindOverMatter(hpLoss, Math.max(0, s.player.mana - reservedMana(c, s.skills)), mom.params as Record<string, number>);
        s.player.mana -= pay.mana;
        hpLoss = pay.hp;
      }
      // 56 Staggering Resolve splits the HP-bound share after 33/51; debt is committed loss
      const stagger = bundleOf(c.keystones, 'staggering-resolve');
      if (stagger) {
        const split = staggeringSplit(hpLoss, stagger.params as Record<string, number>);
        hpLoss = split.immediate;
        for (let i = 1; i <= Number(stagger.params.durationSec); i++)
          s.keystoneRuntime.queues.hpDebt.push({ dueAtUs: clock.nowUs + i * units, amount: split.perDebt, sourceId: mob.id, targetId: 'player' });
      }
      s.player.hp -= hpLoss;
      // 40 Borrowed Time recoups 40% of the HP actually paid, over six seconds
      const recoup = bundleOf(c.keystones, 'borrowed-time');
      if (recoup && hpLoss > 0) {
        const r40 = borrowedRecoup(hpLoss, recoup.params as Record<string, number>);
        for (let i = 1; i <= Number(recoup.params.durationSec); i++)
          s.keystoneRuntime.queues.recoup.push({ dueAtUs: clock.nowUs + i * units, amount: r40.perPay, sourceId: mob.id, targetId: 'player' });
      }
      if (!buffRuleUp(s.skills, 'es_recharge_immediate')) s.player.esIdleSec = 0;
    }
    // real loss feeds 11, 16 and 40's clocks; a fully absorbed or cut Hit feeds nothing
    if (toHp + toEs > 0) {
      rkH.lastLossAtUs = clock.nowUs;
      if (fortNow) rkH.stacks.fortress = Math.min(Number(fortNow.params.maxStacks), (rkH.stacks.fortress || 0) + 1);
      if (barkNow) rkH.icdsUs.bark = clock.nowUs + Number(barkNow.params.regenEverySec) * units;
      // `53` Thornbound: the body that took something off us is answered by a share of our Armour,
      // once on its own clock. It is secondary damage — no crit, no status, no leech, no hit counter,
      // and it never answers a different body because this one died first (§7.2).
      const thornH = bundleOf(c.keystones, 'thornbound');
      if (thornH && clock.nowUs >= (rkH.icdsUs.thornbound ?? 0)) {
        const promised = thornboundRetaliation(c.armour, thornH.params as Record<string, number>) * berserkDealt;
        const dealt = eng.mitigateMobHit(live, promised, 0);
        if (dealt > 0) {
          live.hp -= dealt;
          rkH.icdsUs.thornbound = clock.nowUs + Number(thornH.params.icdSec) * units;
          credit(s, 'swing', dealt);
          fx(s, { kind: 'hit', side: 'field', mobId: mob.id, via: 'swing', text: eng.fmt(dealt), value: dealt, colour: hitColour(null) });
          push(s, `Thornbound answers ${mob.species} for ${eng.fmt(dealt)}`);
          if (live.hp <= 0 && s.group.includes(live)) {
            s.group.splice(s.group.indexOf(live), 1);
            onKill(s, rng, live, c, statuses);
          }
        }
      }
    }
    // A shield block deflects the status, including an Earth Wall charge. Evasion and perfect dodge
    // return raw=0; a hit absorbed by ES still landed and can apply its status.
    if (r.raw > 0 && r.blocked !== 'block' && r.blocked !== 'block charge') {
      // the mirror of `applyWeaponRiders`: the mob's aligned Elemental DPS — its full per-second
      // Element output under its own Alignment multiplier — is both the per-second DoT basis and
      // the budget's basis, exactly what our statuses on a mob are priced from
      const alignedElemDps = mob.ps * eng.damageSplit(mob.damage)[1] * (((mob as any).align ?? 100) / 100);
      // A forced mob status still passes `statusResist`: the gear answer cuts the application,
      // while `statusImmunity` blocks it outright. The roll is drawn here so `applyStatus`
      // keeps its single writer role and the tick draw order stays frozen otherwise.
      const resistCut = Math.max(0, Math.min(100, c.statusResist || 0)) / 100;
      const resisted = resistCut > 0 && rng() < resistCut;
      const forced = mobSkill?.status && !immune && !resisted ? applyStatus(statuses, mobSkill.status, alignedElemDps) : null;
      let st = forced ?? (immune ? null : rollStatus(rng, mob, alignedElemDps, statuses, c.statusResist, c.stunRecovery, alignedElemDps));
      // Purist: damaging statuses are refused after the writer names them, before the tick
      // can pay them; control statuses and Mark still land.
      if (st && bundleOf(c.keystones, 'purist') && ['burn', 'poison', 'bleed'].includes(st)) {
        delete statuses[st];
        st = null;
      }
      if (st) {
        statusesAppliedThisTick.add(st);
        push(s, `${mob.species} inflicts ${st}`);
        // 59 Auto Cleanse: a family that actually landed is removed at once, on its 6s ICD
        const cleanse = bundleOf(c.keystones, 'auto-cleanse');
        if (cleanse && autoCleanseReady(clock.nowUs, rkH.icdsUs.autoCleanse ?? 0)) {
          delete statuses[st];
          rkH.icdsUs.autoCleanse = clock.nowUs + Number(cleanse.params.icdSec) * units;
          push(s, 'Auto Cleanse removes it');
        }
        // A hard stop cancels the unpaid windup at the control timestamp, not at the next
        // movement sample; the queued release then finds no intent and pays nothing.
        if (st === 'shock' && (statuses.shock?.secLeft ?? 0) > 0) {
          if (arena?.intent?.phase === 'windup') cancelIntent('shock');
          else if (arena?.intent?.phase === 'recovery' && arena.intent.mobile) {
            // Completed channel pulses stay spent; unresolved future pulses are dropped.
            const channelAction = arena.intent.actionId;
            for (const flight of [...arena.flights]) {
              if (flight.actionId !== channelAction || flight.timing.impactAtUs <= clock.nowUs) continue;
              const at = arena.flights.indexOf(flight);
              if (at >= 0) arena.flights.splice(at, 1);
            }
            cancelIntent('shock');
          } else if (arena?.intent?.phase === 'recovery' && arena.intent.actionId != null
            && sm.byId[arena.intent.skillId]?.action?.kind === 'projectile-burst') {
            // A committed burst drops only the shots that have not left the bow yet.
            for (const flight of [...arena.flights]) {
              if (flight.actionId !== arena.intent.actionId || flight.timing.releaseAtUs <= clock.nowUs) continue;
              const at = arena.flights.indexOf(flight);
              if (at >= 0) arena.flights.splice(at, 1);
            }
          }
        }
      }
      if (st) fx(s, { kind: 'proc', side: 'self', byId: mob.id, skillId: plannedSkill?.id, text: st, colour: statusColour(st) });
    }
    // the damage-taken trigger fires at the hit that raised it, in the secondary queue
    if (hurt && s.player.hp > 0) queueTrigger(trig.taken, mob.id);
  }

  function mobShotPosition(shot: CombatMobFlight, atUs: number) {
    const span = shot.impactAtUs - shot.releaseAtUs;
    const progress = span > 0 ? Math.max(0, Math.min(1, (atUs - shot.releaseAtUs) / span)) : 1;
    return { x: shot.source.x + (shot.destination.x - shot.source.x) * progress,
      y: shot.source.y + (shot.destination.y - shot.source.y) * progress };
  }

  /**
   * Release one ordinary stand-off basic: commit the aim at the attack beat, then let the swept
   * body query decide contact. A ready strike never reaches this path; it replaces the opportunity.
   */
  function launchMobShot(mob: Mob, atUs: number) {
    if (!arena) return;
    const actor = arena.mobs[mob.id];
    if (!actor) return;
    const profile = E.combat_arena.normal_attack.profiles.ranged;
    const speed = Number(profile.projectile_speed_mps);
    const radius = Number(profile.hit_radius_m);
    if (!(speed > 0) || !(radius >= 0)) return;
    const action = arenaAction(arena, mob.id, 'swing', atUs, 'player');
    if (!action) return;
    const source = { x: actor.x, y: actor.y };
    const destination = { x: arena.player.x, y: arena.player.y };
    const impactAtUs = atUs + Math.ceil(Math.hypot(destination.x - source.x, destination.y - source.y)
      / speed * units);
    const timing: SkillCastTiming = { delivery: 'projectile', startedAtUs: atUs, releaseAtUs: atUs,
      impactAtUs, recoveryUntilUs: atUs };
    updateArenaAction(arena, action.id, { timing, ranged: true,
      targetX: destination.x, targetY: destination.y });
    actor.holdAtRange = true;
    arena.mobFlights.push({
      actionId: action.id, mobId: mob.id, mob: { ...mob }, source, destination,
      position: { x: source.x, y: source.y }, releaseAtUs: atUs, impactAtUs, speedMps: speed,
      radiusM: radius, areaKey: encounterKeyOf(s),
    });
  }

  function cancelMobShot(shot: CombatMobFlight, atUs: number, reason: string) {
    if (!arena) return;
    const at = arena.mobFlights.indexOf(shot);
    if (at >= 0) arena.mobFlights.splice(at, 1);
    const action = arena.actions.find((entry) => entry.id === shot.actionId);
    if (action && action.cancelledAtUs == null)
      updateArenaAction(arena, action.id, { cancelledAtUs: atUs, cancelReason: reason, endsAtUs: atUs });
  }

  /** Contact ends the shot; a terminal arrival with no contact is a miss, never a ghost hit. */
  function resolveMobShot(shot: CombatMobFlight, atUs: number, contact: boolean) {
    if (!arena) return;
    shot.queued = false;
    const at = arena.mobFlights.indexOf(shot);
    if (at >= 0) arena.mobFlights.splice(at, 1);
    const point = mobShotPosition(shot, atUs);
    const action = arena.actions.find((entry) => entry.id === shot.actionId);
    if (action && action.cancelledAtUs == null) {
      const timing = action.timing ? { ...action.timing, impactAtUs: atUs } : action.timing;
      updateArenaAction(arena, action.id, {
        ...(timing ? { timing } : {}),
        targetX: point.x, targetY: point.y,
        endsAtUs: Math.max(action.endsAtUs, atUs + E.combat_arena.action_sec * units),
      });
    }
    if (!contact || s.player.hp <= 0) return;
    const live = s.group.find((entry) => entry.id === shot.mobId && entry.hp > 0);
    resolveIncomingHit(shot.mob, undefined, rng, live ?? shot.mob);
  }

  function scheduleMobShot(shot: CombatMobFlight) {
    if (!arena || shot.queued) return;
    const atUs = Math.max(tickStartUs, shot.impactAtUs);
    if (atUs > tickEndUs) return;
    shot.queued = true;
    clock.schedule(atUs, EVENT_PRIORITY.mobAction, shot.mobId, 'player', () => {
      shot.queued = false;
      if (!arena?.mobFlights.includes(shot)) return;
      // One last sweep covers contact exactly at the committed endpoint; otherwise the shot is spent.
      sweepMobShots(atUs);
      if (arena?.mobFlights.includes(shot)) resolveMobShot(shot, clock.nowUs, false);
    });
  }

  function sweepMobShots(atUs: number) {
    if (!arena || s.player.hp <= 0) return;
    for (const shot of [...arena.mobFlights]) {
      if (shot.areaKey && shot.areaKey !== encounterKeyOf(s)) { cancelMobShot(shot, atUs, 'area-exit'); continue; }
      const from = shot.position;
      const to = mobShotPosition(shot, atUs);
      const previous = arena.frames.at(-2)?.player ?? arena.frames.at(-1)?.player;
      const target = { ...arena.player, ...(previous ? { previous: { x: previous.x, y: previous.y } } : {}) };
      const hit = firstProjectileHit(from, to, [target], shot.radiusM);
      shot.position = to;
      if (hit) resolveMobShot(shot, atUs, true);
    }
  }

  function cancelMobPreparation(action: CombatArenaAction, atUs: number, reason: string) {
    if (arena && action.cancelledAtUs == null)
      updateArenaAction(arena, action.id, { cancelledAtUs: atUs, cancelReason: reason, endsAtUs: atUs });
  }

  function scheduleMobStrike(action: CombatArenaAction, mob: Mob) {
    if (!arena || !action.timing || action.timing.releaseAtUs > tickEndUs) return;
    clock.schedule(Math.max(tickStartUs, action.timing.releaseAtUs), EVENT_PRIORITY.mobAction, mob.id, 'player', () => {
      if (!arena) return;
      advanceArenaAt(clock.nowUs);
      const current = arena.actions.find(entry => entry.id === action.id);
      if (!current || current.cancelledAtUs != null || current.impactCount) return;
      const row = current.skillId ? mobSkillById(current.skillId) : undefined;
      if (!row || mob.hp <= 0 || !s.group.includes(mob) || s.player.hp <= 0
        || statusModsOn(s.mobStatus, mob.id).stopped
        || !arenaInRange(arena, mob.id, mobStrikeRange(row, mob))
        || (mob.skillReadyAtUs?.[row.id] ?? 0) > clock.nowUs) {
        cancelMobPreparation(current, clock.nowUs, 'release-invalid');
        return;
      }
      updateArenaAction(arena, current.id, { impactCount: 1 });
      resolveIncomingHit(mob, row, rng);
    });
  }

  // Unpaid preparations retain their selected skill and release time across tick boundaries.
  if (arena) for (const actor of Object.values(arena.mobs)) {
    const action = actor.action;
    if (action?.kind !== 'cast' || !action.timing || action.impactCount || action.cancelledAtUs != null) continue;
    const mob = engaging.find(entry => entry.id === actor.id && entry.hp > 0);
    if (!mob) cancelMobPreparation(action, tickStartUs, 'source-unavailable');
    else scheduleMobStrike(action, mob);
  }

  for (const mob of engaging) {
    if (mob.hp <= 0 || !s.group.includes(mob)) continue;
    const tm = mobMods(mob.id);
    const rate = mob.hitsPerSec * (mob.auraSpeedMult ?? 1) * Math.max(0, 1 + tm.attackSpeed / 100);
    const plan = planAttacks(tickStartUs, mob.atkTimer, rate, units);
    mob.atkTimer = plan.progressAtEnd;
    const pending = { mob, rate, actionsLeft: plan.times.length };
    mobPlans.push(pending);
    const skillPlan = arena ? undefined : planMobSkills(mob, plan.times, units);
    for (const atUs of plan.times) {
      const plannedSkill = skillPlan?.get(atUs);
      if (plannedSkill) {
        // The cast beat is placed before the action, clamped to this window; the swing itself still
        // lands on the planned action time, so the telegraph never changes the DPS clock.
        const castAt = Math.max(tickStartUs, atUs - Math.max(0, plannedSkill.cast_sec || 0) * units);
        clock.schedule(castAt, EVENT_PRIORITY.mobAction, mob.id, 'player', () => {
          if (mob.hp <= 0 || !s.group.includes(mob)) return;
          advanceArenaAt(clock.nowUs);
          if (statusModsOn(s.mobStatus, mob.id).stopped) return;
          if (arena && !arenaInRange(arena, mob.id, mobStrikeRange(plannedSkill, mob))) return;
          fx(s, { kind: 'cast', side: 'field', mobId: mob.id, skillId: plannedSkill.id, text: plannedSkill.name, colour: hitColour(plannedSkill.element) });
          // The telegraph owns the body from its cast beat to the strike beat, so preparation
          // reads at the authored length instead of the default 0.3s action tail.
          const castAction = arena && [...arena.actions].reverse().find((entry) => entry.actorId === mob.id
            && entry.kind === 'cast' && entry.skillId === plannedSkill.id
            && entry.atUs === clock.nowUs && !entry.timing);
          if (arena && castAction) updateArenaAction(arena, castAction.id, {
            timing: { delivery: 'melee', startedAtUs: clock.nowUs, releaseAtUs: atUs, impactAtUs: atUs, recoveryUntilUs: atUs },
            endsAtUs: Math.max(castAction.endsAtUs, atUs),
          });
          if (online) push(s, `${mob.species} begins ${plannedSkill.name}`);
        });
      }
      clock.schedule(atUs, EVENT_PRIORITY.mobAction, mob.id, 'player', () => {
        pending.actionsLeft--;
        if (mob.hp <= 0 || !s.group.includes(mob)) return;
        advanceArenaAt(clock.nowUs);
        // Hard control before the beat cancels the attack and leaves the strike's cooldown unspent.
        if (statusModsOn(s.mobStatus, mob.id).stopped) return;
        if (arena) {
          const owned = arena.mobs[mob.id]?.action;
          if (owned?.kind === 'cast' && owned.timing && owned.cancelledAtUs == null
            && !owned.impactCount && owned.timing.releaseAtUs >= atUs) return;
        }
        // A ready strike replaces the opportunity only while its role reach holds. An out-of-reach
        // strike does not block the ordinary attack, and the mob never walks in just to enable it.
        const strike = readyMobSkill(mob, atUs, row => !arena || arenaInRange(arena, mob.id, mobStrikeRange(row, mob)));
        if (!strike && arena && !arenaInRange(arena, mob.id, arenaMobRange(mob))) return;
        if (arena && strike) {
          const releaseAtUs = atUs + Math.ceil(Math.max(0, strike.cast_sec || 0) * units);
          const timing: SkillCastTiming = { delivery: 'melee', startedAtUs: atUs,
            releaseAtUs, impactAtUs: releaseAtUs, recoveryUntilUs: releaseAtUs };
          const action = arenaAction(arena, mob.id, 'cast', atUs, 'player', strike.id, undefined, timing);
          if (action) {
            fx(s, { kind: 'cast', side: 'field', mobId: mob.id, skillId: strike.id,
              actionId: action.id, castTiming: timing, text: strike.name, colour: hitColour(strike.element) });
            scheduleMobStrike(action, mob);
            if (online) push(s, `${mob.species} begins ${strike.name}`);
          }
          return;
        }
        if (arena && !strike && mob.line === 'stand-off') {
          launchMobShot(mob, clock.nowUs);
          return;
        }
        if (arena) arenaAction(arena, mob.id, strike ? 'cast' : 'swing', clock.nowUs, 'player', strike?.id);
        resolveIncomingHit(mob, strike, rng);
      });
    }
  }

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
    const stepUs = Math.max(1, Math.round(E.combat_arena.movement_step_sec * units));
    for (let atUs = tickStartUs + stepUs; atUs <= tickEndUs; atUs += stepUs) {
      clock.schedule(atUs, EVENT_PRIORITY.expire, 'arena', '', () => {
        advanceArenaAt(clock.nowUs);
        ensureIntent(clock.nowUs);
      });
    }
  }
  clock.runUntil(tickEndUs);
  // A delayed event beyond this window was not spent; its progress is saved for the next tick.
  for (const plan of mobPlans) plan.mob.atkTimer += plan.actionsLeft;
  // A Boss owns a local arena epoch. Its own death receipt settles the remaining released work even
  // while other field bodies are still alive under the population model.
  if (s.field?.bossDefeatedAtSec === s.clockSec) {
    cancelArenaWork('boss-exit');
    s.field.arenaEpoch++;
    s.field.bossDefeatedAtSec = undefined;
  }
  if (hadEngagement && s.field && s.field.engagementIds.length === 0) {
    const wasPatrolling = s.patrol.active;
    const patrolNote = recordPatrolGroupClear(s, online);
    if (patrolNote) push(s, patrolNote);
    runExplorationAutomation(s, online, wasPatrolling);
  }
  if (hadGroupBeforeDamage && s.group.length === 0) {
    const wasPatrolling = s.patrol.active;
    const patrolNote = recordPatrolGroupClear(s, online);
    if (patrolNote) push(s, patrolNote);
    runExplorationAutomation(s, online, wasPatrolling);
  }

  // damage over time on us, then regen (field rule 2: regen works during combat)
  if (!clock.halted) {
  const rkL = s.keystoneRuntime;
  const qL = rkL.queues;
  // 40 Borrowed Time recoup pays the HP actually lost back over its stream
  if (s.player.hp > 0) for (const p of [...qL.recoup]) {
    if (p.dueAtUs > tickEndUs) continue;
    qL.recoup.splice(qL.recoup.indexOf(p), 1);
    s.player.hp = Math.min(usableHp(c, s.skills), s.player.hp + p.amount);
  }
  // `17` Master Surgeon: the draught's Health arrives a second at a time. A payment that finds the
  // pool full is lost, but the stream keeps running to its last second (§7.4).
  if (s.player.hp > 0) for (const p of [...qL.potion]) {
    if (p.dueAtUs > tickEndUs) continue;
    qL.potion.splice(qL.potion.indexOf(p), 1);
    s.player.hp = Math.min(usableHp(c, s.skills), s.player.hp + p.amount);
  }
  // 24 Escape Artist replaces natural recharge with a 50% Max ES burst every 3s
  const escape = bundleOf(c.keystones, 'escape-artist');
  if (escape && s.player.esIdleSec >= Number(escape.params.idleSec)
    && tickStartUs >= (rkL.icdsUs.escapeArtist ?? 0)) {
    const capCast = bundleOf(c.keystones, 'capacitive-casting');
    const burst = escapeBurst(c.es, escape.params as Record<string, number>)
      * (capCast ? Number(capCast.params.naturalEsRegenMult) : 1);
    s.player.es = Math.min(c.es, s.player.es + burst);
    rkL.icdsUs.escapeArtist = tickStartUs + Number(escape.params.burstEverySec) * units;
  }
  // 36 Time of Need: every 5s clear Burn/Poison/Bleed and heal 15% of Full Max HP
  const need = bundleOf(c.keystones, 'time-of-need');
  if (need) {
    const periodUs = Number(need.params.periodSec) * units;
    rkL.icdsUs.timeOfNeed ??= tickStartUs + periodUs;
    if (tickStartUs >= rkL.icdsUs.timeOfNeed) {
      delete statuses.burn; delete statuses.poison; delete statuses.bleed;
      s.player.hp = Math.min(usableHp(c, s.skills), s.player.hp + timeOfNeedHeal(c.maxHp, need.params as Record<string, number>));
      rkL.icdsUs.timeOfNeed += periodUs;
    }
  }
  // 07 Endless Hunger bank fills the gap FIFO; each entry expires on its own clock
  for (const entry of [...rkL.bank]) {
    if (entry.expiresAtUs <= tickStartUs || entry.amount <= 0) { rkL.bank.splice(rkL.bank.indexOf(entry), 1); continue; }
    const gap = entry.pool === 'hp'
      ? Math.max(0, usableHp(c, s.skills) - s.player.hp) : Math.max(0, c.es - s.player.es);
    const take = Math.min(entry.amount, gap);
    if (entry.pool === 'hp') s.player.hp += take; else s.player.es += take;
    entry.amount -= take;
    if (entry.amount <= 0) rkL.bank.splice(rkL.bank.indexOf(entry), 1);
  }
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
    // 55 Chaos Inoculation routes every non-immune DoT (Poison and Bleed included) through ES first.
    const ciDot = bundleOf(c.keystones, 'chaos-inoculation') !== undefined;
    const toEs = Math.min(ciDot ? dot.total : dot.burn, s.player.es);
    s.player.es -= toEs;
    const toHpDot = (ciDot ? dot.total : dot.poison + dot.bleed + dot.burn) - toEs;
    // 33 also answers DoT: its share comes from positive unreserved Mana, never from a reservation
    let hpDot = toHpDot;
    const momDot = bundleOf(c.keystones, 'mind-over-matter');
    if (momDot && hpDot > 0) {
      const pay = mindOverMatter(hpDot, Math.max(0, s.player.mana - reservedMana(c, s.skills)), momDot.params as Record<string, number>);
      s.player.mana -= pay.mana;
      hpDot = pay.hp;
    }
    s.player.hp -= hpDot;
    // the delay answers to damage taken, not to the pool it landed on: a poison tick that reached
    // HP interrupts the recharge the same way an equal direct hit does
    if ((toEs > 0 || toHpDot > 0) && !buffRuleUp(s.skills, 'es_recharge_immediate')) s.player.esIdleSec = 0;
    const lead = dotLead(dot);
    fx(s, { kind: 'taken', side: 'self', via: 'dot', text: eng.fmt(dot.total), value: dot.total, hpDamage: toHpDot, esDamage: toEs, colour: statusColour(lead) });
  }
  const burnCut = statuses.burn ? Math.min(E.status.burn.regen_cut_max, statuses.burn.stacks * E.status.burn.regen_cut_per_stack) : 0;
  // `combat.md` §5 reads shock as "attacks stop + regen stops", so the stop covers the pools too.
  // The Energy Shield recharge is left alone on purpose: it is a shield, not regen, and its own
  // `delay_sec` rule already governs it.
  if (s.player.hp > 0) s.player.hp = Math.min(c.maxHp, s.player.hp + c.hpRegen * (1 - burnCut) * playerActiveFraction);
  const manaRegenNow = debt52
    ? manaRegenWhileNegative(c.manaRegen * playerActiveFraction, s.player.mana < 0, debt52.params as Record<string, number>)
    : c.manaRegen * playerActiveFraction;
  // 45 Dark Siphon: Mana Regen fills ES instead; 52's ×2 (when negative) applies before the redirect.
  if (bundleOf(c.keystones, 'dark-siphon')) s.player.es = Math.min(c.es, s.player.es + manaRegenNow);
  else s.player.mana = Math.min(c.maxMana, s.player.mana + manaRegenNow);
  s.player.esIdleSec++;
  // Magia Drive forces the recharge: the delay is ignored and a hit does not interrupt it
  const rechargeNow = buffRuleUp(s.skills, 'es_recharge_immediate');
  const capacitive = bundleOf(c.keystones, 'capacitive-casting');
  const esRegenNow = c.esRegen * (capacitive ? Number(capacitive.params.naturalEsRegenMult) : 1);
  if (!escape && (rechargeNow || s.player.esIdleSec >= E.energy_shield.delay_sec)) s.player.es = Math.min(c.es, s.player.es + esRegenNow);
  }

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
    const pushReport = buildPushReport(s, c, s.group);
    s.player.hp = 0;
    cancelArenaWork('push');
    s.phase = 'camp';
    s.campSec = Math.max(1, Math.ceil(c.maxHp / (c.hpRegen * 8)));
    recordCombatPush(s, s.campSec);
    s.counters.pushes++;
    // the rest is a clean one: whatever the fight had on the character ends at the Push — the
    // statuses are the fight's, and the camp neither ticks nor banks them
    for (const key of Object.keys(statuses) as (keyof Statuses)[]) delete statuses[key];
    // The fight's own Keystone state ends with the fight: committed debt, deferred damage, a potion
    // stream, the leech bank and every per-target counter never follow the character back to camp
    // (§7.2's Death/Push cleanup, §7.3.10's "stops at a Push").
    s.keystoneRuntime.queues = { deferred: [], dot: [], hpDebt: [], recoup: [], potion: [] };
    s.keystoneRuntime.bank = [];
    s.keystoneRuntime.stacks = {};
    s.keystoneRuntime.counters = {};
    s.keystoneRuntime.targetCounters = {};
    s.keystoneRuntime.dotInstances = [];
    s.keystoneRuntime.targetRefs = {};
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
    for (const line of pushReportLines(pushReport)) push(s, line);
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
  clampPools(s);
  // The field registry mirrors the authoritative group by id and records the cohort/session facts.
  syncFieldState(s, arena);
  // The active arena's released work is canonical saved state: refresh the pure-data ledger after
  // the tick so a save cannot hold the reward with an unapplied (or already-applied) impact.
  if (arena) {
    const pending = snapshotPendingWork(arena, s.group);
    if (pending || s.pendingWork) s.pendingWork = pending;
  }
  return s;
}

/**
 * Re-read the pools against the sheet the tick ended on. A tick can move a pool's ceiling after the
 * opening clamp — equipping a piece drops the `Max Mana %` line it replaced, a spent point raises
 * Int — so the bar is bounded again here, otherwise it reads above what the character now holds.
 */
function clampPools(s: GameState): void {
  const c = characterSheet(s);
  const debt52 = bundleOf(c.keystones, 'mana-debt');
  s.player.mana = Math.min(debt52 ? s.player.mana : Math.max(0, s.player.mana), c.maxMana);
  s.player.es = Math.min(Math.max(0, s.player.es), c.es);
  s.player.hp = Math.min(s.player.hp, usableHp(c, s.skills));
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
 * fires at most once a second) still earns, and a stalled wake keeps its backlog as debt instead of
 * losing it. The batch is what runs: at most `MAX_BATCH` ticks a wake, so a queued backlog drains over
 * later wakes rather than bursting in the foreground and costing the frame its stutter-free draw.
 * Offline catch-up stays uncapped; the live loop matches it by never dropping whole seconds either.
 */
export function schedulerBatch(acc: number, speed: number, elapsedSec: number = WAKE_SEC): { ticks: number; acc: number } {
  const total = acc + elapsedSec * speed;
  const ticks = Math.floor(total);
  if (ticks <= 0) return { ticks: 0, acc: total };
  if (ticks > MAX_BATCH) return { ticks: MAX_BATCH, acc: total - MAX_BATCH };
  return { ticks, acc: total - ticks };
}

/** A null configured limit pays every valid whole elapsed second. */
export function catchUpPlan(elapsedSec: number) {
  // an away period never walks: a walk is online only, so the catch-up never crosses a block
  const configured: number | null = E.inventory.offline_cap_hr;
  const cap = configured == null ? Infinity : configured * 3600;
  const whole = Math.floor(elapsedSec);
  const elapsed = Number.isSafeInteger(whole) ? Math.max(0, whole) : 0;
  return { secs: Math.min(elapsed, cap), capped: elapsed > cap };
}

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

/** One arena tick that settles released work saved with the character; counts against away time. */
function settleSavedPendingWork(s: GameState, autoSkills: boolean): number {
  if (!s.pendingWork) return 0;
  const units = tree.mechanics?.combat_time_units_per_sec ?? 1;
  const arena = createCombatArena();
  syncCombatArena(arena, s, s.clockSec * units, units, characterSheet(s).maxHp);
  if (restorePendingWork(arena, s) <= 0) {
    s.pendingWork = null;
    return 0;
  }
  tick(s, { online: false, autoSkills, settleArena: arena });
  return 1;
}

/** Synchronous catch-up — tests and any non-UI caller. */
export function catchUp(s: GameState, elapsedSec: number, opts: { autoSkills?: boolean } = {}) {
  const { secs, capped } = catchUpPlan(elapsedSec);
  const startClock = s.clockSec;
  const settled = settleSavedPendingWork(s, opts.autoSkills !== false);
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
  let done = settleSavedPendingWork(s, opts.autoSkills !== false);
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
