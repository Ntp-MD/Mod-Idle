import { eng, E, sm, loot, TOWN, tree } from '../engine/client';
import { buildCharacter, openingGear, SLOT_COUNT } from './player';
import { playerSwing, mobSwing, rollStatus, dotDamage, type Statuses, type StatusName } from './combat';
import { rollDrop } from './drop';
import { newTown, progressTasks, tickTown, huntN } from './town';
import { STAT_KEYS, type StatKey } from '../engine/client';
import { huntReweight } from '../../../engine/loot.ts';
import { newFarm, rollHerbs, rollPotion, maybeDrink, maybeFarm, farm } from './farm';
import {
  road, encounterZones, encounterSizes, payPurse, claimChest, openArrival, grantTripStanding, endTrip,
  advanceLeg, skipLeg, settlementZone,
} from './road';
import { weaponByName, masteryLevel, payMastery, dropMultiplier } from './mastery';
import { newPresets, switchPreset, autoSelect } from './presets';
import { newCollector, newGrants, wants, col } from './collector';
import { newFilter, ruleFor, coveredElements, refresh as refreshFilter } from './filter';
import { addTo } from './slots';
import { settlementOfZone } from './town';
import { effectsActive, esAbsorbPct } from './skills';
import { mark as markSnapshot } from './snapshot';
import { newGoal, onSpawn as goalSpawn, onKill as goalKill, watch as goalWatch } from './goal';
import { newCurses, modsOn, applyCurse, tickCurses, combineMods, lineValue, modsFromAuraFold, spreadOnDeath } from './curse';
import {
  newMobStatusStore, applyWeaponRiders, stepMob, holdPoison, forgetDead as forgetMobStatus,
  modsOn as statusModsOn, targetMods, holdsCondition,
} from './mobStatus';
import {
  newSkillState, tickSkills, castOnce, paySkillXp, grantSkill, buffNeedsRecast, skillCd, usableMana, buffRuleUp,
  skillLevel,
} from './skills';
import type { GameState, Mob, Item, RoadTrip } from './types';
import { mulberry32, pick, intBetween, pickBand } from '../engine/client-helpers';

const L = E.loot;
/** loot.md F7 publishes 4 bosses an hour; the clock is per character and online only. */
const BOSS_EVERY_SEC = Math.round(3600 / L.boss_per_hour);
const BAND_OF_QUALITY = (quality: string): string =>
  quality.startsWith('high') ? 'high' : quality.startsWith('mid') ? 'mid' : 'low';

/** combat.md §1: normal and elite mobs swing once per second, a boss 0.8 times. */
const mobClock = (kind: string) => (kind.startsWith('Boss') ? 0.8 : 1);

/** What the character carries besides gear: potions, condensed bottles and herbs all weigh. */
export function heldWeaponName(s: GameState): string | null {
  const main = s.gear.find((g) => g && g.slot === 'main hand');
  const w = main ? weaponByName(main.base) : null;
  return w ? w.name : null;
}

/** What the character carries besides gear: potions, condensed bottles and herbs all weigh. */
export function carried(s: GameState) {
  const bottles = Object.values(s.farm.potions).reduce((a: number, b: number) => a + b, 0);
  const condensed = Object.values(s.farm.condensed).reduce((a: number, b: number) => a + b, 0);
  const herbs = Object.values(s.farm.herbs).reduce((a: number, b: number) => a + b, 0);
  return { potions: bottles, condensed, herbs };
}

/** A fresh character has spent no points: the sheet starts empty and grants on level-up. */
const ZERO_POINTS = (): Record<StatKey, number> =>
  Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<StatKey, number>;

/**
 * Spend every banked stat point evenly over the 7 Core stats — the REFERENCE allocation the published
 * numbers (and `mob_HP`) are priced against. Headless runs and tests call this so the character
 * they measure is the reference build; the client player allocates by hand instead.
 */
export function spendReference(s: GameState): void {
  const p = s.player;
  if (p.statPoints <= 0) return;
  const per = Math.floor(p.statPoints / STAT_KEYS.length);
  let left = p.statPoints;
  for (const k of STAT_KEYS) { p.points[k] += per; left -= per; }
  for (const k of STAT_KEYS) { if (left <= 0) break; p.points[k] += 1; left--; }
  p.statPoints = 0;
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
  const gear = openingGear();
  const level = E.opening.level as number;
  const c = buildCharacter(level, gear, {}, 0, undefined, ZERO_POINTS());
  const s: GameState = {
    seed,
    rngState: seed,
    player: {
      level,
      xp: 0,
      points: ZERO_POINTS(),
      statPoints: 0,
      autoSpend: true,
      treePoints: 0,
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
    road: null,
    purseDay: {},
    chestDay: {},
    skills: newSkillState(),
    healUp: null,
    junk: {},
    mastery: {},
    presets: newPresets(),
    activePreset: 0,
    collector: newCollector(),
    grants: newGrants(),
    pedlar: { day: 0, minutes: [], bought: 0 },
    filter: newFilter(),
    travel: 'stay',
    autoDissolveRarity: 'off',
    huntOrder: {},
    zoneFocus: {},
    goal: newGoal(),
    curses: newCurses(),
    mobStatus: newMobStatusStore(),
    pendingSnapshot: null,
    nextSnapshotAt: 0,
    town: newTown(),
    farm: newFarm(),
    zone: E.opening.settlement_zone as number,
    group: [],
    phase: 'fighting',
    campSec: 0,
    spawnIn: 0,
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
    clockSec: 0,
    lastSavedAt: Date.now(),
  };
  // minute one's instruction is the data's own first task (`engine.json` opening.first_rule)
  const first = E.opening.first_rule;
  const zone = first ? (E.opening.settlement_zone as number) : 1;
  s.town.tasks[0] = {
    kind: 'hunt',
    zone,
    n: huntN(zone),
    progress: 0,
    stone: 'reroll_value',
    count: eng.taskPayout('low', TOWN.task_sizing.reward_minutes_of_band_income).reroll_value,
    claimed: false,
    offeredAt: 0,
  };
  refreshFilter(s);
  return s;
}

/** A mob at the player's level, clamped into the zone (engine.json mob.level_rule). */
// The species cast and the boss row per zone are fixed data, so index them once instead of filtering
// on every spawn (a spawn happens many times per tick through the offline catch-up).
const _speciesByZone = new Map<number, any[]>();
const speciesInZone = (zoneId: number): any[] => {
  let pool = _speciesByZone.get(zoneId);
  if (!pool) { pool = E.mob.species.filter((sp: any) => sp.zones.includes(zoneId)); _speciesByZone.set(zoneId, pool); }
  return pool;
};
const _bossByZone = new Map<number, any>();
const bossInZone = (zoneId: number): any => {
  if (!_bossByZone.has(zoneId)) _bossByZone.set(zoneId, E.mob.bosses.find((b: any) => b.zone === zoneId) || null);
  return _bossByZone.get(zoneId);
};

/**
 * What one spawn's ladder name pays: its row in `mob.variant_drops`, which owns both the junk item
 * (with its rarity) and the stream the mob leans. A spawn whose name carries no row — or a variant
 * table read before the name was rolled — drops no junk, which is why the caller guards on `null`.
 */
function variantDrop(mob: any): { item: string; rarity: string; lean: 'gear' | 'herb' | 'junk' | 'none' } | null {
  if (!mob || !mob.variant) return null;
  return (((E.mob as any).variant_drops || {})[mob.variant]) || null;
}

function spawnMob(rng: () => number, zoneId: number, playerLevel: number, kind: 'normal' | 'elite' | 'boss', bodyHint?: string, focus?: string): Mob {
  const z = eng.zoneById(zoneId);
  const zonePool = speciesInZone(zoneId);
  // a sub-zone is what a spawn table rolls against: it names its own race pair and one Element from the
  // zone's set, and the cast a normal or Elite spawn draws from is that pair (the boss is zone-level).
  // `focus` is the player's chosen hunting ground (`zoneFocus`); with none set the zone's own cast rolls.
  const subs = z.subzones || [];
  const sub = kind !== 'boss' && subs.length
    ? (subs.find((x: any) => x.name === focus) || subs[Math.floor(rng() * subs.length)])
    : null;
  const speciesPool = sub ? zonePool.filter((sp: any) => sub.races.includes(sp.id)) : zonePool;
  let body = 'medium';
  let species = pick(rng, speciesPool);
  if (bodyHint) {
    const able = speciesPool.filter((sp: any) => sp.sizes.includes(bodyHint));
    species = pick(rng, able.length ? able : speciesPool);
    body = bodyHint;
  } else if (kind === 'boss') {
    const boss = bossInZone(zoneId)!;
    species = E.mob.species.find((sp: any) => sp.id === boss.species)!;
    body = 'boss';
  } else if (kind === 'elite') {
    // an Elite is always forced to the Large body (engine.json mob.elite.note), and its NAME is the
    // sub-zone's declared elite — the cast the bestiary promises is the cast that spawns, so an elite
    // pays the junk of the variant it shows rather than of whatever large body the roll landed on
    const declared = sub ? sub.elite : null;
    const owner = declared
      ? (E.mob.species as any[]).find((sp: any) => ((((E.mob as any).variants || {})[sp.id] || []) as string[])[3] === declared)
      : null;
    species = owner || pick(rng, speciesPool.filter((sp: any) => sp.sizes.includes('large')));
    body = 'large';
  } else {
    const groupable = speciesPool.filter((sp: any) => sp.sizes.includes('small') || sp.sizes.includes('medium'));
    species = pick(rng, groupable.length ? groupable : speciesPool);
    body = pick(rng, species.sizes.filter((s: string) => s !== 'boss' && s !== 'large'));
  }
  const base = eng.spawnAt(zoneId, playerLevel, body, species.id);
  const lv = Math.min(Math.max(playerLevel, z.levels[0]), z.levels[1]);
  const size = eng.sizeById(body);
  const bf = eng.zoneBodyFactor(zoneId);
  const hp = kind === 'boss' ? eng.mobHpAt(lv) * size.hp : kind === 'elite' ? eng.mobHpAt(lv) * E.mob.elite.hp : base.hp;
  const ps = kind === 'boss' ? eng.mobPsAt(lv) * size.ps : kind === 'elite' ? eng.mobPsAt(lv) * E.mob.elite.ps : base.ps;
  // innate Element rolls inside the sub-zone's own Element, or the zone's Elements when a spawn has
  // no sub-zone; the species bias still weighs 3 (mob.element_roll)
  const bias = species.element_bias.filter((e: string) => z.elements.includes(e));
  const rollElems: string[] = sub ? [sub.element] : z.elements;
  const entries: [string, number][] = rollElems.map((e: string) => [e, bias.includes(e) ? E.mob.element_roll.bias_weight : E.mob.element_roll.other_weight]);
  const innate = [pickBand(rng, entries)];
  // the ladder name is its own roll over the species' three normal rungs (Elite and Boss take the fourth
  // and fifth), and it is what the drop table reads: `mob.variant_drops` keys on this name. Drawn last
  // on purpose — every field above keeps the random stream it had, so a variant is purely additive.
  const ladder = (((E.mob as any).variants || {})[species.id] || []) as string[];
  const variant = kind === 'boss' ? ladder[4]
    : kind === 'elite' ? (sub?.elite || ladder[3])
      : pick(rng, ladder.slice(0, 3));
  return {
    id: `${zoneId}_${species.id}_${body}_${Math.floor(rng() * 1e9)}`,
    species: species.name,
    speciesId: species.id,
    variant,
    kind: kind === 'boss' ? `Boss · ${(bossInZone(zoneId) || { name: 'Boss' }).name}` : kind === 'elite' ? 'Elite' : size.name,
    zone: zoneId,
    level: lv,
    hp,
    hpMax: hp,
    ps,
    subzone: sub ? sub.name : undefined,
    readsAs: base.readsAs,
    acc: base.acc,
    evasion: kind === 'elite' ? eng.mobEvasion(lv, species.stats.dex, 'elite') : base.evasion,
    dodgeRate: base.dodgeRate,
    armour: base.armour,
    res: base.res,
    resByElement: base.resByElement,
    damage: species.damage,
    innate,
    xp: kind === 'elite' ? base.xp * E.xp.elite_mult : kind === 'boss' ? base.xp * E.xp.boss_mult : base.xp,
    line: species.line,
    hitsPerSec: mobClock(kind),
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
  s.bag[worst] = item;
  dissolve(s);
  push(s, `Bag swap · ${item.base} (${item.slot}) in, ${worstScore.toFixed(2)}-score piece dissolved`);
  return true;
}

/** One piece becomes one Reroll value stone, and every 500 owes a tier stone (checks.md F15). */
function dissolve(s: GameState): void {
  addTo(s, s.counters.stones, 'reroll_value', 'stone', 1);
  s.counters.salvaged = (s.counters.salvaged || 0) + 1;
  if (s.counters.salvaged % E.salvage.pieces_per_tier_stone === 0) {
    addTo(s, s.counters.stones, 'tier', 'stone', 1);
    push(s, `Salvage milestone · ${s.counters.salvaged} pieces dissolved → 1 Reroll tier stone`);
  }
}

/**
 * One gear roll through the bag filter. A mob kill, a Road chest and any future item source use this
 * same path, so "what the filter keeps" can never mean two different things.
 */
function awardDrop(s: GameState, rng: () => number, band: string, q: number | undefined, weaponAspd: number): void {
  const item = rollDrop(rng, band, weaponAspd, q);
  s.counters.drops++;
  // the bag filter keeps a drop only when it outscores the piece worn in that slot by more than
  // noise; anything else dissolves for 1 Reroll value stone, never for gold (loot.md §4)
  // the bar is the best piece the character holds for that slot, worn or waiting in the bag: a
  // keep that nobody has worn yet still has to beat what is already on offer, or the bag fills
  // with near-duplicates of a decision already made (`loot.md` §4, read with no auto-pick)
  const bestForSlot = (pool: (Item | null)[]) => pool
    .filter((g): g is Item => g !== null && g.slot === item.slot)
    .map((g) => loot.score({ ...g, q: g.q ?? 0 }))
    .reduce((m, v) => Math.max(m, v), -1);
  const wornScore = Math.max(
    bestForSlot(s.gear as (Item | null)[]),
    bestForSlot(s.bag),
  );
  // the filter is OFF by default: a slot the player has not turned on keeps every drop
  // and dissolves nothing, so the player opts in per slot before a piece is ever thrown away.
  // Only an enabled slot runs the published rule — a piece that fails it dissolves for 1 Reroll
  // value stone (always kept), never for gold (`loot.md` §4).
  const rule = ruleFor(s.filter, item.slot);
  const verdict = rule.enabled
    ? loot.keepsDrop(
      { ...item, q: item.q ?? 0 }, wornScore < 0 ? undefined : wornScore, coveredElements(s),
      L.filter.upgrade_margin_pct / 100, rule,
    )
    : { keep: true, reason: 'filter off', score: loot.score({ ...item, q: item.q ?? 0 }) };
  const set = wants(s, item);
  // a client auto-dissolve floor: stones only, never gold (the two mints are untouched by AGENT §5).
  // A set-wanted or player-locked piece is spared; the collector sink below runs first.
  const belowFloor = !!s.autoDissolveRarity && s.autoDissolveRarity !== 'off'
    && !item.locked
    && ['Common', 'Rare'].indexOf(item.rarity) <= ['Common', 'Rare'].indexOf(s.autoDissolveRarity);
  if (set) {
    // the Collector sink runs before the filter dissolves a piece the set wants
    if (s.bag.length < E.inventory.adventure_slots) {
      item.heldFor = set.id;
      s.bag.unshift(item);
      push(s, `Held for the ${set.name} set · ${item.base} (${item.slot})`);
    }
  } else if (belowFloor) {
    dissolve(s);
  } else if (verdict.keep) {
    // nothing equips itself (owner ruling): a keep is a decision waiting in the bag, which
    // is what makes "every piece needs a decision" true. The filter's comparison is still against
    // the piece actually worn, so an idle character that never chooses keeps seeing keeps.
    if (s.bag.length < E.inventory.adventure_slots) {
      s.bag.unshift(item);
      push(s, `Drop kept (${verdict.reason}): ${item.rarity} ${item.quality} ${item.tier} ${item.base} (${item.slot})`);
    } else if (verdict.reason === 'upgrade' && swapWeakestKept(s, item, verdict.score)) {
      // the bag keeps the best decision per slot instead of the first fifty arrivals: a piece that
      // beat the bar replaces the piece it beat, and the loser dissolves for its one stone. The
      // character still wears nothing it was not told to wear (owner ruling).
    } else {
      // overflow is stop_pickup: a full bag picks up nothing and deletes nothing
      s.counters.overflow = (s.counters.overflow || 0) + 1;
    }
  } else {
    dissolve(s);
  }
}

function onKill(s: GameState, rng: () => number, mob: Mob, c: ReturnType<typeof buildCharacter>) {
  const online = s.online !== false;
  // Pandemonium: the lines this mob was carrying jump to the neighbours its row names 
  const caught = spreadOnDeath(s.curses, mob.id, s.group.map((m) => m.id));
  if (caught) push(s, `${sm.byId['curse.pandemonium'].name} spreads to ${caught} nearby`);
  s.counters.kills++;
  s.counters.zoneKills[mob.zone] = (s.counters.zoneKills[mob.zone] || 0) + 1;
  s.player.xp += mob.xp;
  while (s.player.level < E.stat.level_cap && s.player.xp >= eng.xpToNext(s.player.level)) {
    s.player.xp -= eng.xpToNext(s.player.level);
    s.player.level++;
    const per = s.player.level >= E.stat.paragon_from ? E.stat.paragon_points_per_level : E.stat.points_per_level;
    s.player.statPoints += per;
    s.player.treePoints += E.stat.tree_points_per_level;
    push(s, `Level ${s.player.level} — +${per} stat points, +${E.stat.tree_points_per_level} tree point${E.stat.tree_points_per_level === 1 ? '' : 's'}`);
    markSnapshot(s, 'level');
  }
  const band = BAND_OF_QUALITY(eng.zoneById(mob.zone).quality);
  paySkillXp(s.skills);
  payMastery(s, heldWeaponName(s)); // 4 XP per kill to the weapon actually held
  // a skill piece is its own drop stream (engine.json skill_drop)
  const skillRate = mob.kind.startsWith('Boss') ? E.skill_drop.boss
    : mob.kind === 'Elite' ? E.skill_drop.elite : E.skill_drop.normal;
  if (rng() < skillRate) {
    const g = grantSkill(s.skills, rng);
    if (g) push(s, g.duplicate
      ? `Duplicate ${sm.byId[g.id].name} → that skill's own ladder`
      : `Skill drop: ${sm.byId[g.id].name} (${sm.byId[g.id].type})`);
  }
  // Mastery adds quantity the same way Lck does, and only a twelfth as strongly (equipment-weapon.md)
  // offline results are AFK: same drops, quality limited to the zone floor, no boss income
  const q = online ? undefined : eng.qualityIndexOf(eng.floorOf(band));
  // Hunt Order: lean the three collectible streams toward a category by shifting probability mass
  // between them, never raising the total, so drops/hr and the timeline are unmoved. The mob's own
  // variant supplies the lean (`mob.variant_drops`) and the player's per-zone order overrides it;
  // 'none' is the identity, so a variant marked 'none' behaves exactly as the balanced case.
  const vdrop = variantDrop(mob);
  const order = (s.huntOrder?.[mob.zone] || (vdrop ? vdrop.lean : 'none')) as 'none' | 'gear' | 'herb' | 'junk';
  const junkRows = Object.entries(E.junk.rarities as Record<string, any>);
  const pJunkBase = junkRows.reduce((a, [, r]: any) => a + r.drop_chance_per_kill, 0);
  const hw = huntReweight({
    gear: Math.min(1, eng.dropChance(band) * dropMultiplier(s)),
    herb: farm.herbChance(band),
    junk: pJunkBase,
  }, order, E.loot.hunt_order.shift_pct);
  if (rng() < hw.gear) {
    awardDrop(s, rng, band, q, c.weaponAspd);
  }
  const junkScale = pJunkBase > 0 ? hw.junk / pJunkBase : 1;
  // junk is kept and sold by hand at the Counterhand — it is a gold mint, not a gold drip. The item is
  // the variant's own, and only that variant's rarity rolls, so the kill pays one item at its price.
  // one draw per rarity, exactly as this stream always rolled, so every other roll in the tick keeps
  // the sequence it had — but only the variant's OWN rarity can pay. The item is therefore the
  // variant's, while the expected gold is still the line: chance × sell is flat by rarity (X39).
  if (vdrop) {
    for (const [rarity, r] of junkRows) {
      const pays = rarity === vdrop.rarity;
      // junk occupies a slot like any other carried stack; a bag full of it stops the pickup
      if (rng() < (pays ? r.drop_chance_per_kill * junkScale : 0)) {
        if (addTo(s, s.junk, vdrop.item, 'stone', 1)) s.counters.junk++;
      }
    }
  }
  progressTasks(s, mob.kind, mob.zone);
  rollHerbs(s, rng, band, band, hw.herb);
  // the humanoid tribes drop a potion on their own roll (items 2 + 4); an ordinary lineage does not
  const dropsPotion = !!E.mob.species.find((sp: any) => sp.id === (mob as any).speciesId)?.humanoid;
  if (dropsPotion && rollPotion(s, rng, band, true)) push(s, `A humanoid drops a potion`);
  if (mob.kind === 'Elite') {
    // the elite stone lines in engine.json are expected values per kill, so the roll keeps them whole
    if (rng() < L.elite_tier_stones) addTo(s, s.counters.stones, 'tier', 'stone', 1);
    if (rng() < L.elite_add_stone_chance) addTo(s, s.counters.stones, 'add', 'stone', 1);
    if (rng() < L.quality_stone_sources.elite_quality_chance) addTo(s, s.counters.stones, 'quality', 'stone', 1);
    if (rng() < L.repair_stone_sources.elite_repair_chance) addTo(s, s.counters.stones, 'repair', 'stone', 1);
  }
  // Quality Stone comes from every kill, but the ladder's cheap steps are the only part a mob pays
  if (rng() < L.quality_stone_sources.monster_quality_chance) addTo(s, s.counters.stones, 'quality', 'stone', 1);
  if (mob.kind.startsWith('Boss')) {
    addTo(s, s.counters.stones, 'tier', 'stone', L.boss_tier_stones);
    addTo(s, s.counters.stones, 'add', 'stone', L.boss_add_stones);
    addTo(s, s.counters.stones, 'quality', 'stone', L.quality_stone_sources.boss_quality_stones);
    addTo(s, s.counters.stones, 'repair', 'stone', L.repair_stone_sources.boss_repair_stones);
    if (rng() < L.corrupt_stone_sources.boss_corrupt_chance) addTo(s, s.counters.stones, 'corrupt', 'stone', 1);
    if (goalKill(s, mob)) {
      push(s, `Gate met — ${mob.kind.replace('Boss · ', '')} killed in one spawn, no Push, at ${Math.round(s.clockSec / 60)} min of play · level ${s.player.level}`);
    }
  }
}

/**
 * A Road encounter: the link's two zone casts supply the mobs, per `engine.json` `road`.
 * Online the roll uses the link's own terrain row; offline it uses the untilted base table, so an
 * away period can never be routed into the heaviest-ambush terrain and paid out at the tilted rate.
 */
function spawnEncounter(s: GameState, trip: RoadTrip, rng: () => number, online: boolean, weaponAspd: number) {
  const l = road.links[trip.linkIndex];
  const kind = road.rollEncounter(rng, online ? l.terrain : null);
  trip.nextEncounterSec = s.clockSec + road.encounterGapSec;
  trip.kind = kind.id;
  if (!kind.hasMobs) { resolveEncounter(s, trip, rng, weaponAspd); return; }
  const zones = encounterZones(trip.linkIndex);
  const sizes = encounterSizes(kind.id, rng);
  const mobs: any[] = [];
  for (let i = 0; i < sizes.small; i++) mobs.push(spawnMob(rng, zones.lower, s.player.level, 'normal', 'small'));
  for (let i = 0; i < sizes.large; i++) mobs.push(spawnMob(rng, zones.higher, s.player.level, 'normal', 'large'));
  s.group = mobs;
  s.spawnIn = road.encounterGapSec;
  push(s, `Road · ${kind.id} on ${l.text} (${l.terrain})`);
}

function resolveEncounter(s: GameState, trip: RoadTrip, rng: () => number, weaponAspd: number) {
  const kind = trip.kind;
  trip.kind = null;
  trip.encountersLeft = Math.max(0, trip.encountersLeft - 1);
  const link = road.links[trip.linkIndex];
  if (kind === 'ambush') {
    const gold = payPurse(s);
    push(s, gold ? `Ambush cleared · purse +${gold} gold` : 'Ambush cleared · this link already paid its purse today');
  } else if (kind === 'caravan') {
    push(s, 'Caravan beaten · Standing only, no gold');
  } else if (kind === 'chest') {
    if (!claimChest(s)) {
      push(s, 'A chest already opened on this link today');
    } else {
      // the chest pays Item quality up to the DESTINATION zone's ceiling, and pays no crafting stones
      const dest = settlementZone(trip.settlementTo) ?? s.zone;
      const band = BAND_OF_QUALITY(eng.zoneById(dest).quality);
      awardDrop(s, rng, band, eng.qualityIndexOf(eng.ceilingOf(band)), weaponAspd);
      push(s, `Chest opened on ${link.text} · one Item at the ${band} ceiling, no stones`);
    }
  } else {
    push(s, 'A pedlar offers information for gold · nothing bought');
  }
}

export function push(s: GameState, text: string) {
  s.log.unshift({ sec: s.clockSec, text });
  if (s.log.length > 60) s.log.length = 60;
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
export function tick(s: GameState, statuses: Statuses = {}, opts: { online?: boolean } = {}): GameState {
  const online = opts.online !== false;
  s.online = online;
  const rng = mulberry32(s.rngState++);
  s.clockSec++;
  s.counters.playSec++;
  // the active-skill effect fold changes only on cast/toggle, so compute it once per tick and reuse
  // it for the character sheet and the per-mob aura lines (previously folded again on every swing)
  // the idle default spends this tick's level points before the pool is clamped, so the sheet the
  // pool is read against already includes them; manual players bank and spend by hand.
  if (s.player.autoSpend && s.player.statPoints > 0) spendReference(s);
  const effects = effectsActive(s.skills);
  const c = buildCharacter(s.player.level, s.gear, carried(s), masteryLevel(s, heldWeaponName(s)), effects, s.player.points, s.player.treeRanks);
  // a pool is bounded by what it is: never below nothing, never above what the sheet says it holds.
  // The bars read these straight, so an unbounded value here is what shows as a negative number there.
  s.player.mana = Math.min(Math.max(0, s.player.mana), c.maxMana);
  s.player.es = Math.min(Math.max(0, s.player.es), c.es);
  const day = Math.floor(s.clockSec / 86400);
  if (s.pedlar.day !== day || !s.pedlar.minutes.length) {
    s.pedlar = {
      day,
      bought: 0,
      minutes: Array.from({ length: col.PEDLAR.per_day_cap }, () => col.pedlarPrice(rng())),
    };
  }
  // the owner's travel switch: 'forward' climbs through settlements already opened, using the
  // zone's own level band as the only condition (`mob.zones.levels`) — no new number, and it is not
  // Road travel, so it does not touch the Road being opt-in and online only.
  // Forward Mode is a chapter ladder (owner ask): win the zone (its band is behind you) and the walk
  // moves on; a Push sends the character back to the last zone it held (below) and this same rule
  // refuses to re-enter the zone it was chased out of until a level has been gained against it.
  if (s.travel === 'forward') {
    const here = eng.zoneById(s.zone);
    if (s.player.level > here.levels[1]) {
      const next = eng.ZONES.find((z: any) => z.id > here.id
        && s.town.visited.includes(settlementOfZone(z.id)?.id || ''));
      const blocked = next && next.id === s.forwardBlockedZone
        && s.player.level <= (s.forwardBlockedLevel ?? 0);
      if (next && !blocked) {
        s.forwardSafe = here.id; // the zone just left is the floor a Push falls back to
        s.zone = next.id;
        s.group = [];
        s.spawnIn = 0;
        s.lastAutoZone = -1; // the preset bound to the new zone is picked on this same tick
        push(s, `Moving on to ${next.name} (levels ${next.levels.join('-')})`);
      }
    }
  }
  if (s.lastAutoZone !== s.zone) {
    // the game picks the set bound to the zone on its own (`skill-pool.md` Preset)
    s.lastAutoZone = s.zone;
    autoSelect(s, s.zone);
  }
  tickTown(s, rng);

  if (s.phase === 'camp') {
    s.campSec--;
    s.player.hp = Math.min(c.maxHp, s.player.hp + c.hpRegen * 8);
    if (s.campSec <= 0) {
      s.phase = 'fighting';
      push(s, `Back in ${eng.zoneById(s.zone).name} — the walk-back costs no items and no XP`);
    }
    return s;
  }

  // While a leg runs, no ambient zone group appears: the Road replaces zone farming for its minutes.
  if (s.road) {
    const trip = s.road;
    trip.secLeft--;
    if (!s.group.length) {
      if (trip.kind) resolveEncounter(s, trip, rng, c.weaponAspd);
      if (trip.encountersLeft <= 0) {
        openArrival(s, trip);
        grantTripStanding(s, trip);
        const link = road.links[trip.linkIndex];
        if (trip.circuit.length) {
          const wraps = (trip.legIndex + 1) % trip.circuit.length === 0;
          if (!online && wraps) {
            // a closed client plays out the rest of the lap, then parks the character and lets
            // ordinary offline idling resume (`save.md` · section 5)
            push(s, `Circuit lap done in the away period · parked at ${s.town.waypoint}`);
            endTrip(s, 'complete');
          } else {
            const cleanBefore = s.counters.cleanLaps || 0;
            advanceLeg(s, trip);
            push(s, `Circuit leg done (${link.text}) · on to ${road.links[s.road!.linkIndex].text}`);
            // the Circuit objective: a lap closed with no Push is a completion, logged and never
            // paid — the Road's gold is capped by G6-G9 and a stone would be a new source
            if ((s.counters.cleanLaps || 0) > cleanBefore) push(s, `Circuit lap complete with no Push — clean lap ${s.counters.cleanLaps}`);
          }
        } else {
          push(s, `Road trip over · ${road.encountersFor(trip.linkIndex)} encounters in ${link.trip_min} min of walking`);
          endTrip(s, 'complete');
        }
      } else if (s.clockSec >= trip.nextEncounterSec) {
        spawnEncounter(s, trip, rng, online, c.weaponAspd);
      }
    }
  }

  const band = BAND_OF_QUALITY(eng.zoneById(s.zone).quality);
  const [loGroup, hiGroup] = (eng.zoneById(s.zone).group as string).split('-').map(Number);
  const groupSize = intBetween(rng, loGroup || 1, hiGroup || loGroup || 1);
  if (!s.group.length && !s.road) s.spawnIn--;
  if (!s.group.length && !s.road && s.spawnIn <= 0) {
    const wantElite = rng() < L.elite_spawn_chance;
    // the boss clock is a stored due time, per character, and it does not accrue while away
    // (save.md · combat.md §7). A modulo would let a busy tick skip a spawn and hand the next
    // one out early.
    if (online && !s.bossDueAt) s.bossDueAt = s.clockSec + BOSS_EVERY_SEC;
    const wantBoss = online && s.bossDueAt !== undefined && s.clockSec >= s.bossDueAt;
    // the player's hunting ground for this zone rides every spawn, so a chosen sub-zone is the cast
    // (race pair + Element) that actually spawns; Elite and Boss ignore it, being zone-level
    const focus = s.zoneFocus?.[s.zone];
    s.group = wantBoss
      ? [spawnMob(rng, s.zone, s.player.level, 'boss')]
      : wantElite
        ? [spawnMob(rng, s.zone, s.player.level, 'elite', undefined, focus)]
        : Array.from({ length: groupSize }, () => spawnMob(rng, s.zone, s.player.level, 'normal', undefined, focus));
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

  // player clock. A shocked player is STOPPED for the second — the symmetric half of what we do to a
  // mob, where `modsOn` reads the same status into `stopped` and the mob's swing is blocked. The
  // attack clock does not advance, so the second is lost rather than banked ($14 · item 5).
  const stunned = (statuses.shock?.secLeft || 0) > 0;
  if (!stunned) s.player.atkTimer += c.hitsPerSec;
  while (s.player.atkTimer >= 1 && front && !stunned) {
    s.player.atkTimer -= 1;
    const target = s.group[0];
    if (!target) break;
    const tm = mobMods(target.id);
    const r = playerSwing(rng, c, target, c.weaponElement, tm);
    if (r.landed) {
      // the weapon's own riders — Element status, bleed and stun — on the swing's own hit, and on a
      // landing press too (§14), through one function so the two cannot drift
      applyWeaponRiders(rng, c, s.mobStatus, target.id, lineValue(s.curses, target.id, 'bleed_chance') > 0);
      if (r.leech) s.player.hp = Math.min(c.maxHp, s.player.hp + r.leech);
      credit(s, 'swing', r.damage);
      if (r.crit) push(s, `Crit for ${eng.fmt(r.damage)} (${target.species})`);
      if (target.hp <= 0) {
        onKill(s, rng, target, c);
        s.group.shift();
        s.player.atkTimer = 0;
      }
    }
  }

  // the rotation casts the first ready, affordable slot top-down — no manual presses.
  // Haste is a post-cap multiplier on this clock, which is why it reaches tickSkills at all 
  tickSkills(s.skills, c.globalSpeed);
  for (const id of Object.keys(s.skills.buffs)) {
    if (!buffNeedsRecast(s.skills, id)) continue;
    const skill = sm.byId[id];
    const cost = sm.manaCostOf(skill, {
      skillLevel: skillLevel(s.skills, id), maxMana: c.maxMana, usableMana: usableMana(c, s.skills), aoe: false,
    });
    if (cost > s.player.mana) continue;
    s.player.mana -= cost;
    s.skills.cd[id] = skillCd(s.skills, id, c.cdr);
    s.skills.buffUp[id] = Number(String(skill.duration).match(/\d+/)?.[0] || 10);
  }
  const cast = stunned ? null : castOnce(s.skills, c, s.player.mana, s.group, statuses, rng, {
    mobStatus: s.mobStatus, curses: s.curses,
    missingHpPct: c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0,
    isBoss: !!s.group[0] && String(s.group[0].kind).startsWith('Boss'),
  });
  if (cast) {
    s.player.mana = Math.max(0, s.player.mana - cast.manaCost);
    if (cast.heal) s.healUp = cast.heal;
    if (cast.charges != null) {
      s.player.charges = cast.charges;
      push(s, `${cast.name} grants ${cast.charges} perfect-dodge charges`);
    }
    if (cast.cleansesSelf) {
      const cleared = Object.keys(statuses).length;
      for (const k of Object.keys(statuses) as StatusName[]) delete statuses[k];
      if (cleared) push(s, `${cast.name} clears ${cleared} status${cleared > 1 ? '' : 'es'} off you`);
    }
    if (cast.instantHealPct) {
      const healed = (c.maxHp * cast.instantHealPct) / 100;
      s.player.hp = Math.min(c.maxHp, s.player.hp + healed);
      push(s, `${cast.name} restores ${eng.fmt(healed)} HP at once (${cast.instantHealPct}% of the pool)`);
    }
    if (cast.damage && cast.targets) push(s, `${cast.name} hits ${cast.targets} for ${eng.fmt(cast.damage)}${cast.crit ? ' (crit)' : ''}`);
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
      onKill(s, rng, dead, c);
    }
  }

  // statuses age once a second, and the DoT they deal lands before the mob swings back
  for (const mob of s.group) {
    const dot = stepMob(s.mobStatus, mob.id);
    if (dot > 0) mob.hp -= dot;
    credit(s, 'dot', dot);
  }
  while (s.group.some((m) => m.hp <= 0)) {
    const dead = s.group.splice(s.group.findIndex((m) => m.hp <= 0), 1)[0];
    onKill(s, rng, dead, c);
  }

  // mob clocks
  const immune = buffRuleUp(s.skills, 'status_immunity');
  // Energy Absorb turns a share of every landed hit into Energy Shield and negates it outright 
  const absorbPct = esAbsorbPct(s.skills);
  for (const mob of engaging) {
    const tm = mobMods(mob.id);
    mob.atkTimer += mob.hitsPerSec * Math.max(0, 1 + tm.attackSpeed / 100);
    while (mob.atkTimer >= 1) {
      mob.atkTimer -= 1;
      // a Ghost Dance charge deletes the hit outright and is not opposed: it goes before the
      // rolls, which is the whole difference between it and Dodge
      if ((s.player.charges || 0) > 0) {
        s.player.charges!--;
        continue;
      }
      const r = mobSwing(rng, c, mob, statuses, tm, s.player.es, absorbPct);
      if (r.absorbed > 0) s.player.es = Math.min(c.es, s.player.es + r.absorbed);
      if (r.toEs > 0) { s.player.es -= r.toEs; if (!buffRuleUp(s.skills, 'es_recharge_immediate')) s.player.esIdleSec = 0; }
      if (r.toHp > 0) {
        s.player.hp -= r.toHp;
        if (!buffRuleUp(s.skills, 'es_recharge_immediate')) s.player.esIdleSec = 0;
        // a blocked hit lands thinned but carries NO status: the shield deflected the effect, so no
        // proc rolls on it (owner ruling). Holy Veil still blocks every Element debuff/bleed.
        if (r.blocked !== 'block') {
          const elemHalf = (mob.ps / mob.hitsPerSec) * eng.damageSplit(mob.damage)[1];
          const st = immune ? null : rollStatus(rng, mob, elemHalf, statuses, c.statusResist, c.stunRecovery);
          if (st) push(s, `${mob.species} inflicts ${st}`);
        }
      }
    }
  }

  // damage over time on us, then regen (field rule 2: regen works during combat)
  if (s.healUp) {
    s.player.hp = Math.min(c.maxHp, s.player.hp + c.maxHp * s.healUp.pctPerSec);
    s.healUp.secLeft--;
    if (s.healUp.secLeft <= 0) s.healUp = null;
  }
  const dot = dotDamage(c, statuses);
  // a charge also stops a DoT tick — the row says it deletes "unconditional effects", which is what
  // a burn tick is: nothing rolls for it (`buff.ghost_dance`)
  if (dot > 0 && (s.player.charges || 0) > 0) s.player.charges!--;
  else if (dot > 0) s.player.hp -= dot;
  const burnCut = statuses.burn ? Math.min(E.status.burn.regen_cut_max, statuses.burn.stacks * E.status.burn.regen_cut_per_stack) : 0;
  // `combat.md` §5 reads shock as "attacks stop + regen stops", so the stop covers the pools too.
  // The Energy Shield recharge is left alone on purpose: it is a shield, not regen, and its own
  // `delay_sec` rule already governs it.
  s.player.hp = Math.min(c.maxHp, s.player.hp + (stunned ? 0 : c.hpRegen * (1 - burnCut)));
  s.player.mana = Math.min(c.maxMana, s.player.mana + (stunned ? 0 : c.manaRegen));
  s.player.esIdleSec++;
  // Magia Drive forces the recharge: the delay is ignored and a hit does not interrupt it
  const rechargeNow = buffRuleUp(s.skills, 'es_recharge_immediate');
  if (rechargeNow || s.player.esIdleSec >= E.energy_shield.delay_sec) s.player.es = Math.min(c.es, s.player.es + c.esRegen);

  const groupIds = new Set(s.group.map((m) => m.id));
  tickCurses(s.curses, groupIds);
  forgetMobStatus(s.mobStatus, groupIds);
  for (const key of Object.keys(statuses) as (keyof Statuses)[]) {
    const st = statuses[key]!;
    st.secLeft--;
    if (key === 'poison' && st.secLeft % E.status.poison.decay_sec === 0 && st.stacks > 0) st.stacks--;
    if (st.secLeft <= 0) delete statuses[key];
  }

  const drank = maybeDrink(s, c, s.group.some((m) => m.kind.startsWith('Boss')));
  if (drank) push(s, `${drank.name} restores ${eng.fmt(drank.amount)} ${drank.pool} (shared ${E.potions.shared_cooldown_sec}s cooldown)`);

  // the farm's own automation, the twin of the potion path (parking: "Auto plant, harvest and brew")
  for (const line of maybeFarm(s)) push(s, line);

  if (s.player.hp <= 0) {
    // HP reaches 0 → Push, never death (combat.md §4)
    s.player.hp = 0;
    s.phase = 'camp';
    s.campSec = Math.max(1, Math.ceil(c.maxHp / (c.hpRegen * 8)));
    s.counters.pushes++;
    s.group = [];
    // a Push on a Road trip is the Road's own business (forfeit or skip the leg), so the Forward
    // Mode zone ladder below stands down while one is running — the two travel systems stay apart
    const onRoad = !!s.road;
    // a Push returns the main preset, but cooldowns already counting keep counting (§rule 12)
    if (switchPreset(s, sm.mainPreset)) push(s, `Back on the ${s.presets[sm.mainPreset].name} preset · running cooldowns kept`);
    if (s.road) {
      const trip = s.road;
      if (trip.circuit.length) {
        // a Push inside a Circuit skips the rest of the leg and the Circuit carries on (section 5);
        // ending it here is what would let a repeated Push loop forever
        skipLeg(s, trip);
        push(s, 'Push on the Road · the rest of this leg is skipped, the Circuit carries on');
      } else {
        push(s, `Trip forfeit · the purse is lost and ${E.road.forfeit_kills} kills of Standing are given up`);
        endTrip(s, 'forfeit');
      }
    }
    push(s, `Pushed — ${s.campSec} sec at camp (${eng.fmt(c.maxHp)} HP ÷ ${eng.fmt(c.hpRegen * 8)}/sec)`);
    // Forward Mode's fallback: a Push in a zone above the floor means this chapter is not survivable
    // yet, so the walk drops back to the last zone held and refuses to climb back until one level is
    // gained (owner ask). No new number: the gate is a level, the zone is `forwardSafe`.
    if (!onRoad && s.travel === 'forward' && s.forwardSafe != null && s.forwardSafe < s.zone) {
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
  const c = buildCharacter(s.player.level, s.gear, carried(s), masteryLevel(s, heldWeaponName(s)), effectsActive(s.skills), s.player.points, s.player.treeRanks);
  s.player.mana = Math.min(Math.max(0, s.player.mana), c.maxMana);
  s.player.es = Math.min(Math.max(0, s.player.es), c.es);
  s.player.hp = Math.min(s.player.hp, c.maxHp);
}

/** Offline catch-up: run the same tick over the elapsed seconds, capped by the save rule. */
function catchUpPlan(elapsedSec: number) {
  // the Road now runs while away: a Circuit plays out the rest of its lap on the untilted base
  // table and parks the character, which is why an away period no longer ends a trip 
  const cap = E.inventory.offline_cap_hr * 3600;
  const secs = Math.max(0, Math.min(Math.floor(elapsedSec), cap));
  return { secs, capped: elapsedSec > cap };
}

/** The tick loop both catch-up paths share — one order of ticks, so the numbers cannot diverge. */
function runTicks(s: GameState, statuses: Statuses, from: number, to: number) {
  for (let i = from; i < to; i++) tick(s, statuses, { online: false });
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

/** Synchronous catch-up — tests and any non-UI caller. */
export function catchUp(s: GameState, statuses: Statuses, elapsedSec: number) {
  const { secs, capped } = catchUpPlan(elapsedSec);
  runTicks(s, statuses, 0, secs);
  pauseBossClock(s, secs);
  return { simulated: secs, capped };
}

/**
 * The UI's catch-up: the same ticks in the same order, yielded in slices so a save left for a day
 * (up to 43,200 ticks) cannot freeze first paint. The numbers are identical to `catchUp`.
 */
export async function catchUpAsync(s: GameState, statuses: Statuses, elapsedSec: number) {
  const { secs, capped } = catchUpPlan(elapsedSec);
  const SLICE = 2000;
  for (let i = 0; i < secs; i += SLICE) {
    const end = Math.min(i + SLICE, secs);
    runTicks(s, statuses, i, end);
    if (end < secs) await new Promise((r) => setTimeout(r, 0));
  }
  pauseBossClock(s, secs);
  return { simulated: secs, capped };
}

export const equippedCount = (s: GameState) => s.gear.filter(Boolean).length;
export const slots = SLOT_COUNT;
export type { Item };
