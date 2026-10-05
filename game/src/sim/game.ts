import { eng, E, sm, loot, TOWN } from '../engine/client';
import { buildCharacter, openingGear, SLOT_COUNT } from './player';
import { playerSwing, mobSwing, rollStatus, dotDamage, type Statuses, type StatusName } from './combat';
import { rollDrop } from './drop';
import { newTown, progressTasks, tickTown, huntN } from './town';
import { newFarm, rollHerbs, maybeDrink } from './farm';
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
  newMobStatusStore, applyElement, applyBleed, stunMob, stepMob, holdPoison, forgetDead as forgetMobStatus,
  modsOn as statusModsOn, targetMods, holdsCondition,
} from './mobStatus';
import {
  newSkillState, tickSkills, castOnce, paySkillXp, grantSkill, buffNeedsRecast, skillCd, usableMana, buffRuleUp,
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

export function newGame(seed = 20260101): GameState {
  const gear = openingGear();
  const level = E.opening.level as number;
  const c = buildCharacter(level, gear);
  const s: GameState = {
    seed,
    rngState: seed,
    player: {
      level,
      xp: 0,
      stats: c.core,
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
    junkByRarity: Object.fromEntries(Object.keys(E.junk.rarities).map((r) => [r, 0])),
    mastery: {},
    presets: newPresets(),
    activePreset: 0,
    collector: newCollector(),
    grants: newGrants(),
    pedlar: { day: 0, minutes: [], bought: 0 },
    filter: newFilter(),
    travel: 'stay',
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
function spawnMob(rng: () => number, zoneId: number, playerLevel: number, kind: 'normal' | 'elite' | 'boss', bodyHint?: string): Mob {
  const z = eng.zoneById(zoneId);
  const speciesPool = E.mob.species.filter((sp: any) => sp.zones.includes(zoneId));
  let body = 'medium';
  let species = pick(rng, speciesPool);
  if (bodyHint) {
    const able = speciesPool.filter((sp: any) => sp.sizes.includes(bodyHint));
    species = pick(rng, able.length ? able : speciesPool);
    body = bodyHint;
  } else if (kind === 'boss') {
    const boss = E.mob.bosses.find((b: any) => b.zone === zoneId)!;
    species = E.mob.species.find((sp: any) => sp.id === boss.species)!;
    body = 'boss';
  } else if (kind === 'elite') {
    // an Elite is always forced to the Large body (engine.json mob.elite.note)
    species = pick(rng, speciesPool.filter((sp: any) => sp.sizes.includes('large')));
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
  // innate Element rolls inside the zone's own Elements, species bias weighing 3 (mob.element_roll)
  const bias = species.element_bias.filter((e: string) => z.elements.includes(e));
  const entries: [string, number][] = z.elements.map((e: string) => [e, bias.includes(e) ? E.mob.element_roll.bias_weight : E.mob.element_roll.other_weight]);
  const innate = [pickBand(rng, entries)];
  return {
    id: `${zoneId}_${species.id}_${body}_${Math.floor(rng() * 1e9)}`,
    species: species.name,
    kind: kind === 'boss' ? `Boss · ${(E.mob.bosses.find((b: any) => b.zone === zoneId) || { name: 'Boss' }).name}` : kind === 'elite' ? 'Elite' : size.name,
    zone: zoneId,
    level: lv,
    hp,
    hpMax: hp,
    ps,
    acc: base.acc,
    evasion: kind === 'elite' ? eng.mobEvasion(lv, species.stats.dex, 'elite') : base.evasion,
    dodgeRate: base.dodgeRate,
    armour: base.armour,
    res: base.res,
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
    if (held.slot !== item.slot || held.heldFor) return;
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
  // the filter is OFF by default (D-122): a slot the player has not turned on keeps every drop
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
  if (set) {
    // the Collector sink runs before the filter dissolves a piece the set wants
    if (s.bag.length < E.inventory.adventure_slots) {
      item.heldFor = set.id;
      s.bag.unshift(item);
      push(s, `Held for the ${set.name} set · ${item.base} (${item.slot})`);
    }
  } else if (verdict.keep) {
    // nothing equips itself (owner ruling, D-089): a keep is a decision waiting in the bag, which
    // is what makes "every piece needs a decision" true. The filter's comparison is still against
    // the piece actually worn, so an idle character that never chooses keeps seeing keeps.
    if (s.bag.length < E.inventory.adventure_slots) {
      s.bag.unshift(item);
      push(s, `Drop kept (${verdict.reason}): ${item.rarity} ${item.quality} ${item.tier} ${item.base} (${item.slot})`);
    } else if (verdict.reason === 'upgrade' && swapWeakestKept(s, item, verdict.score)) {
      // the bag keeps the best decision per slot instead of the first fifty arrivals: a piece that
      // beat the bar replaces the piece it beat, and the loser dissolves for its one stone. The
      // character still wears nothing it was not told to wear (owner ruling, D-089).
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
  // Pandemonium: the lines this mob was carrying jump to the neighbours its row names (D-102)
  const caught = spreadOnDeath(s.curses, mob.id, s.group.map((m) => m.id));
  if (caught) push(s, `${sm.byId['curse.pandemonium'].name} spreads to ${caught} nearby`);
  s.counters.kills++;
  s.counters.zoneKills[mob.zone] = (s.counters.zoneKills[mob.zone] || 0) + 1;
  s.player.xp += mob.xp;
  while (s.player.level < E.stat.level_cap && s.player.xp >= eng.xpToNext(s.player.level)) {
    s.player.xp -= eng.xpToNext(s.player.level);
    s.player.level++;
    push(s, `Level ${s.player.level} — every Core stat is now ${eng.statAt(s.player.level).toFixed(0)}`);
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
  if (rng() < Math.min(1, eng.dropChance(band) * dropMultiplier(s))) {
    awardDrop(s, rng, band, q, c.weaponAspd);
  }
  for (const [rarity, r] of Object.entries(E.junk.rarities as Record<string, any>)) {
    // junk is kept and sold by hand at the Counterhand — it is a gold mint, not a gold drip
    if (rng() < r.drop_chance_per_kill) {
      // junk occupies a slot like any other carried stack; a bag full of it stops the pickup
      if (addTo(s, s.junkByRarity, rarity, 'stone', 1)) s.counters.junk++;
    }
  }
  progressTasks(s, mob.kind, mob.zone);
  rollHerbs(s, rng, band, band);
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
  const c = buildCharacter(s.player.level, s.gear, carried(s), masteryLevel(s, heldWeaponName(s)), effectsActive(s.skills));
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
  // the owner's travel switch: 'forward' walks on through settlements already opened, using the
  // zone's own level band as the only condition (`mob.zones.levels`) — no new number, and it is not
  // Road travel, so it does not touch the Road being opt-in and online only
  if (s.travel === 'forward') {
    const here = eng.zoneById(s.zone);
    if (s.player.level > here.levels[1]) {
      const next = eng.ZONES.find((z: any) => z.id > here.id
        && s.town.visited.includes(settlementOfZone(z.id)?.id || ''));
      if (next) {
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
            advanceLeg(s, trip);
            push(s, `Circuit leg done (${link.text}) · on to ${road.links[s.road!.linkIndex].text}`);
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
    s.group = wantBoss
      ? [spawnMob(rng, s.zone, s.player.level, 'boss')]
      : wantElite
        ? [spawnMob(rng, s.zone, s.player.level, 'elite')]
        : Array.from({ length: groupSize }, () => spawnMob(rng, s.zone, s.player.level, 'normal'));
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
  const mobMods = (mobId: string) => combineMods(
    combineMods(modsOn(s.curses, mobId, (cond) => holdsCondition(s.mobStatus, mobId, cond)),
      targetMods(statusModsOn(s.mobStatus, mobId))),
    modsFromAuraFold(effectsActive(s.skills).target || {}),
  );

  // player clock
  s.player.atkTimer += c.hitsPerSec;
  while (s.player.atkTimer >= 1 && front) {
    s.player.atkTimer -= 1;
    const target = s.group[0];
    if (!target) break;
    const tm = mobMods(target.id);
    const r = playerSwing(rng, c, target, c.weaponElement, tm);
    if (r.landed) {
      // every Elemental line the weapon carries tries its own Element's status (D-067 · D-090)
      const alignedPerSec = c.elem * (c.alignment / 100) * c.hitsPerSec;
      for (const el of Object.keys(c.elemByElement)) {
        if (el && (c.elemByElement as any)[el] > 0) applyElement(rng, s.mobStatus, target.id, el, c, alignedPerSec);
      }
      // the axe's own `Chance to bleed %` line plus Lacerate's published proc (D-123); bleed comes
      // off the physical half only
      const bleedPct = eng.bleedChanceFrom(lineValue(s.curses, target.id, 'bleed_chance') > 0, c.bleedChance);
      if (c.phys > 0 && bleedPct > 0) applyBleed(rng, s.mobStatus, target.id, c.phys, bleedPct / 100);
      // the mace's `Chance to stun %` line, charged to the same control budget shock obeys (D-123)
      if (c.stunChance > 0) stunMob(rng, s.mobStatus, target.id, c.stunChance);
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
  // Haste is a post-cap multiplier on this clock, which is why it reaches tickSkills at all (D-102)
  tickSkills(s.skills, c.globalSpeed);
  for (const id of Object.keys(s.skills.buffs)) {
    if (!buffNeedsRecast(s.skills, id)) continue;
    const skill = sm.byId[id];
    const cost = usableMana(c, s.skills) * ((sm.manaPct(skill) || 0) / 100);
    if (cost > s.player.mana) continue;
    s.player.mana -= cost;
    s.skills.cd[id] = skillCd(s.skills, id, c.cdr);
    s.skills.buffUp[id] = Number(String(skill.duration).match(/\d+/)?.[0] || 10);
  }
  const cast = castOnce(s.skills, c, s.player.mana, s.group, statuses, rng, {
    mobStatus: s.mobStatus, curses: s.curses,
    missingHpPct: c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0,
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
  // Energy Absorb turns a share of every landed hit into Energy Shield and negates it outright (D-121)
  const absorbPct = esAbsorbPct(s.skills);
  for (const mob of engaging) {
    const tm = mobMods(mob.id);
    mob.atkTimer += mob.hitsPerSec * Math.max(0, 1 + tm.attackSpeed / 100);
    while (mob.atkTimer >= 1) {
      mob.atkTimer -= 1;
      // a Ghost Dance charge deletes the hit outright and is not opposed (D-102): it goes before the
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
        const elemHalf = (mob.ps / mob.hitsPerSec) * eng.damageSplit(mob.damage)[1];
        // Holy Veil: no Element debuff or bleed can be applied while it is up (`buff.holy_veil`)
        const st = immune ? null : rollStatus(rng, mob, elemHalf, statuses, c.statusResist);
        if (st) push(s, `${mob.species} inflicts ${st}`);
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
  // a burn tick is: nothing rolls for it (`buff.ghost_dance` · D-102)
  if (dot > 0 && (s.player.charges || 0) > 0) s.player.charges!--;
  else if (dot > 0) s.player.hp -= dot;
  const burnCut = statuses.burn ? Math.min(E.status.burn.regen_cut_max, statuses.burn.stacks * E.status.burn.regen_cut_per_stack) : 0;
  s.player.hp = Math.min(c.maxHp, s.player.hp + c.hpRegen * (1 - burnCut));
  s.player.mana = Math.min(c.maxMana, s.player.mana + c.manaRegen);
  s.player.esIdleSec++;
  // Magia Drive forces the recharge: the delay is ignored and a hit does not interrupt it
  const rechargeNow = buffRuleUp(s.skills, 'es_recharge_immediate');
  if (rechargeNow || s.player.esIdleSec >= E.energy_shield.delay_sec) s.player.es = Math.min(c.es, s.player.es + c.esRegen);

  tickCurses(s.curses, new Set(s.group.map((m) => m.id)));
  forgetMobStatus(s.mobStatus, new Set(s.group.map((m) => m.id)));
  for (const key of Object.keys(statuses) as (keyof Statuses)[]) {
    const st = statuses[key]!;
    st.secLeft--;
    if (key === 'poison' && st.secLeft % E.status.poison.decay_sec === 0 && st.stacks > 0) st.stacks--;
    if (st.secLeft <= 0) delete statuses[key];
  }

  const drank = maybeDrink(s, c, s.group.some((m) => m.kind.startsWith('Boss')));
  if (drank) push(s, `${drank.name} restores ${eng.fmt(drank.amount)} ${drank.pool} (shared ${E.potions.shared_cooldown_sec}s cooldown)`);

  if (s.player.hp <= 0) {
    // HP reaches 0 → Push, never death (combat.md §4)
    s.player.hp = 0;
    s.phase = 'camp';
    s.campSec = Math.max(1, Math.ceil(c.maxHp / (c.hpRegen * 8)));
    s.counters.pushes++;
    s.group = [];
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
  }
  void band;
  return s;
}

/** Offline catch-up: run the same tick over the elapsed seconds, capped by the save rule. */
export function catchUp(s: GameState, statuses: Statuses, elapsedSec: number) {
  // the Road now runs while away: a Circuit plays out the rest of its lap on the untilted base
  // table and parks the character, which is why an away period no longer ends a trip (D-133)
  const cap = E.inventory.offline_cap_hr * 3600;
  const secs = Math.max(0, Math.min(Math.floor(elapsedSec), cap));
  for (let i = 0; i < secs; i++) tick(s, statuses, { online: false });
  return { simulated: secs, capped: elapsedSec > cap };
}

export const equippedCount = (s: GameState) => s.gear.filter(Boolean).length;
export const slots = SLOT_COUNT;
export type { Item };
