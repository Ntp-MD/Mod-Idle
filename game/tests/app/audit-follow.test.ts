import { describe, expect, it } from 'vitest';
import { BASES, E, ED, eng, fieldwork, loot, sm, tree, TOWN } from '../../src/engine/client';
import { createCraft } from '@engine/craft';
import { heldWeaponName, newGame, salvageBag, tick } from '@sim/core/game';
import { buildCharacter, openingGear } from '@sim/core/player';
import { atSettlement, doCraft } from '@sim/gear/craft';
import { autoEquip, equipFromBag } from '@sim/gear/gear';
import { slotsAvailable, slotsUsed } from '@sim/gear/slots';
import { condense, craftPotion, farm } from '@sim/world/farm';
import { canCook, cookMeal, establishCamp } from '@sim/world/fieldwork';
import { castOnce, effectsActive, newSkillState, paySkillXp } from '@sim/combat/skills';
import { mobSwing } from '@sim/combat/combat';
import { emptyGear, type Character } from '@sim/core/player';
import { NO_CURSE } from '@sim/combat/curse';
import { exportJson, importJson } from '../../src/state/save';
import { buy, canBuy, claimTask, deposit, depositMany, sellJunk, settlementById, stockOf, withdraw, withdrawMany } from '@sim/town/town';
import { col, turnIn } from '@sim/town/collector';
import { switchPreset } from '@sim/core/presets';
import type { Item, Mob } from '@sim/core/types';
import { mobFixture } from '../fixtures/mobFixture';

const craft = createCraft(ED, loot, BASES);
const armour = (): Item => {
  const frame = BASES.bases.find((b) => b.school === 'armour_flat')!;
  return { slot: frame.slot, base: frame.name, ilvl: E.opening.level, quality: 'low', tier: 'T1', q: 0, lines: [], weight: frame.weight };
};
const fillBag = (s: ReturnType<typeof newGame>) => {
  for (let i = 0; slotsUsed(s) < slotsAvailable(s); i++) s.junk[`filler-${i}`] = 1;
};

describe('audit follow-up', () => {
  it('casts only known owned skills, including an owned copy with zero duplicates', () => {
    const s = newSkillState();
    const gear = newGame().gear;
    gear[loot.SLOTS.indexOf('main hand')] = {
      slot: 'main hand', base: 'one-handed axe', ilvl: E.opening.level, quality: 'low', tier: 'T1', q: 0, lines: [], weight: 0,
    } as Item;
    const c = buildCharacter(100, gear);
    const target = { id: 'target', kind: 'Small', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 } as Mob;
    s.list[0] = 'attack.cleave';
    expect(castOnce(s, c, c.maxMana, [target], {}, () => 0.5)).toBeNull();
    expect(s.cd['attack.cleave']).toBeUndefined();
    s.list[1] = 'attack.nope';
    expect(() => castOnce(s, c, c.maxMana, [target], {}, () => 0.5)).not.toThrow();
    s.owned['attack.cleave'] = 0;
    expect(castOnce(s, c, c.maxMana, [target], {}, () => 0.5)?.id).toBe('attack.cleave');
  });

  it('pays each owned skill once per kill even if the rotation repeats it', () => {
    const s = newSkillState();
    s.owned['attack.cleave'] = 0;
    s.list[0] = s.list[1] = 'attack.cleave';
    paySkillXp(s);
    expect(s.xp['attack.cleave']).toBe(E.skill_xp.xp_per_kill);
  });

  it('does not count a refused aura toward later reservations during import', () => {
    const s = newGame();
    const mids = sm.all().filter((k) => k.type === 'aura' && k.reserve === 'mid').slice(0, 8);
    const ids = [...mids.map((k) => k.id), 'aura.haste', 'aura.clarity'];
    for (const id of ids) { s.skills.owned[id] = 0; s.skills.auras[id] = true; }
    const back = importJson(exportJson(s));
    expect(back.skills.auras['aura.haste']).toBe(false);
    expect(back.skills.auras['aura.clarity']).toBe(true);
  });

  it('cannot bypass aura reservations by switching to an imported preset', () => {
    const s = newGame();
    for (const row of sm.all().filter((k) => k.type === 'aura')) {
      s.skills.owned[row.id] = 0;
      s.presets[1].auras[row.id] = true;
    }
    expect(switchPreset(s, 1)).toBe(true);
    const held = Object.entries(s.skills.auras).reduce((sum, [id, on]) => sum + (on ? sm.reservePct(sm.byId[id].reserve!) : 0), 0);
    expect(held).toBeLessThan(sm.RESERVATION_LIMIT);
  });

  it('cannot import a buff as a permanent aura', () => {
    const s = newGame();
    s.skills.owned['buff.iron_will'] = 0;
    s.skills.auras['buff.iron_will'] = true;
    const back = importJson(exportJson(s));
    expect(back.skills.auras['buff.iron_will']).toBeUndefined();
  });

  it.each(['dropped', 'protected', 'broken'])('an Upgrade %s removes the lost level from real defence', (outcome) => {
    const from = outcome === 'dropped' ? 4 : E.craft.upgrade_breaks_from - 1;
    const item = { ...armour(), upgrade_lv: from, gearMod: craft.stepOf(null, from), protection_left: outcome === 'protected' ? 1 : 0 };
    const failed = craft.upgrade(item, () => 0.999);
    expect(failed.changed.outcome).toBe(outcome);
    const usable = failed.item.broken ? craft.repair(failed.item).item : failed.item;
    expect(usable.gearMod).toBe(craft.stepOf(usable, from - 1));
    const retried = craft.upgrade(usable, () => 0).item;
    expect(retried.upgrade_lv).toBe(from);
    expect(retried.gearMod).toBe(item.gearMod);
    expect(buildCharacter(1, [retried]).armour).toBe(buildCharacter(1, [item]).armour);
  });

  it('refuses crafting and stash transfers in the field without spending or moving items', () => {
    const s = newGame();
    s.cell = { q: 1, r: 0, sub: null, wild: null };
    s.bag = [armour()];
    s.stash = [[armour()]];
    s.grants.stash_tabs = 1;
    s.counters.stones.quality = E.craft.upgrade_costs[0];
    expect(atSettlement(s)).toBe(false);
    const before = exportJson(s);
    expect(doCraft(s, 'bag', 0, 'upgrade', 0, () => 0).ok).toBe(false);
    expect(deposit(s, 0, 0).ok).toBe(false);
    expect(withdraw(s, 0, 0).ok).toBe(false);
    expect(depositMany(s, [0], 0)).toBe(0);
    expect(withdrawMany(s, 0, [0])).toBe(0);
    expect(exportJson(s)).toBe(before);
  });

  it('keeps purchases, sales, task claims and Collector turn-ins in their settlement', () => {
    const s = newGame();
    const town = s.town.waypoint;
    const row = stockOf(town).find((r) => !r.display_only)!;
    const zone = settlementById(town)!.zone;
    s.counters.zoneKills[zone] = row.required_standing_tier
      ? Math.ceil(TOWN.standing.tiers[row.required_standing_tier - 1].share * eng.SETTLEMENT_BUDGET_KILLS[zone])
      : 0;
    s.counters.gold = 1e9;
    expect(canBuy(s, town, row.id).ok).toBe(true);
    s.junk.test = 1;
    s.town.tasks[0] = { kind: 'boss', zone: s.zone, n: 1, progress: 1, stone: 'remove', count: 1, claimed: false, offeredAt: 0 };
    s.cell = { q: 1, r: 0, sub: null, wild: null };
    const before = exportJson(s);
    expect(buy(s, town, row.id).ok).toBe(false);
    expect(sellJunk(s)).toEqual({ pieces: 0, gold: 0 });
    expect(claimTask(s, 0)).toBe(false);
    expect(exportJson(s)).toBe(before);
  });

  it('cannot hand a Collector set in remotely', () => {
    const s = newGame();
    const set = col.sets[0];
    s.counters.zoneKills[settlementById(set.settlement)!.zone] = 1e9;
    s.bag = set.parsed.map((p: any) => ({ ...armour(), base: p.name, slot: p.slot, heldFor: set.id }));
    const before = exportJson(s);
    expect(turnIn(s, set.settlement).ok).toBe(false);
    expect(exportJson(s)).toBe(before);
  });

  it('a Broken piece cannot be manually equipped', () => {
    const s = newGame();
    s.bag = [{ ...armour(), broken: true }];
    const before = exportJson(s);
    expect(equipFromBag(s, 0).ok).toBe(false);
    expect(exportJson(s)).toBe(before);
  });

  it('a weapon broken while worn loses its weapon identity, Element and clock', () => {
    const s = newGame();
    s.gear = openingGear();
    const weapon = s.gear.find((g) => g?.slot === 'main hand')!;
    weapon.lines = [{ id: 'elemental_power_flat', value: 100, element: 'fire' }];
    weapon.broken = true;
    const withBroken = buildCharacter(s.player.level, s.gear);
    const bare = buildCharacter(s.player.level, s.gear.map((g) => g === weapon ? null : g));
    expect(withBroken.weaponName).toBe(bare.weaponName);
    expect(withBroken.weaponElement).toBeNull();
    expect(withBroken.hitsPerSec).toBe(bare.hitsPerSec);
    expect(heldWeaponName(s)).toBeNull();
  });

  it('Auto Equip does not replace locked worn equipment', () => {
    const s = newGame();
    s.gear = openingGear();
    const item = armour();
    const at = loot.SLOTS.findIndex((slot: string) => slot === item.slot);
    s.gear[at]!.locked = true;
    item.lines = [{ id: 'physical_power_flat', value: 10000 }];
    s.bag = [item];
    expect(autoEquip(s).swaps).toEqual([]);
    expect(s.gear[at]!.locked).toBe(true);
    expect(s.bag[0]).toBe(item);
  });

  it('save/import preserves a legitimate active shield pool', () => {
    const s = newGame();
    const id = 'aura.energy_guard';
    s.skills.owned[id] = 0;
    s.skills.auras[id] = true;
    s.player.es = buildCharacter(s.player.level, s.gear, {}, 0, effectsActive(s.skills), s.player.points, s.player.treeRanks).es;
    expect(importJson(exportJson(s)).player.es).toBe(s.player.es);
  });

  it('repairs saved Gear Mod drift in worn gear, the bag and stash without losing the item', () => {
    const s = newGame();
    const item = { ...armour(), upgrade_lv: 9, gearMod: craft.stepOf(null, 10) };
    s.gear[0] = structuredClone(item);
    s.bag = [structuredClone(item)];
    s.stash = [[structuredClone(item)]];
    const back = importJson(exportJson(s));
    for (const part of [back.gear[0]!, back.bag[0], back.stash[0][0]]) {
      expect(part.upgrade_lv).toBe(9);
      expect(part.gearMod).toBe(craft.stepOf(part, 9));
      expect(part.lines).toEqual(item.lines);
    }
    expect(importJson(exportJson(back))).toEqual(back);
  });

  it('normalizes imported allocations and banked points within the level budget', () => {
    const s = newGame();
    s.player.level = 2;
    s.player.autoSpend = false;
    s.player.points.str = 3;
    s.player.points.vit = -10;
    s.player.statPoints = eng.pointsAt(2);
    s.player.treeRanks = { [tree.nodes[0].id]: 1 };
    s.player.treePoints = tree.pointsAt(2, E.stat.level_cap);
    const back = importJson(exportJson(s));
    expect(back.player.points.str).toBe(3);
    expect(back.player.points.vit).toBe(0);
    expect(Object.values(back.player.points).reduce((sum, n) => sum + n, 0) + back.player.statPoints).toBeLessThanOrEqual(eng.pointsAt(2));
    expect(tree.pointsSpent(back.player.treeRanks) + back.player.treePoints).toBeLessThanOrEqual(tree.pointsAt(2, E.stat.level_cap));
    expect(importJson(exportJson(back))).toEqual(back);
  });

  it('crafts a bottle in a full bag when spending the ingredients frees space', () => {
    const s = newGame();
    s.gear = openingGear();
    s.farm.potions['Red Draught'] = 0;
    s.farm.potions['Sky Draught'] = 0;
    const potion = farm.P.list[0];
    const cost = farm.craftCost(potion.tier);
    s.farm.herbs[potion.tier] = cost.herbs;
    s.counters.stones.reroll_value = cost.reroll_value_stones;
    fillBag(s);
    expect(craftPotion(s, potion.name)).toEqual({ ok: true });
    expect(s.farm.potions[potion.name]).toBe(1);
    expect(slotsUsed(s)).toBeLessThanOrEqual(slotsAvailable(s));
  });

  it('condenses bottles in a full bag when spending them frees the output slot', () => {
    const s = newGame();
    const name = farm.P.list[0].name;
    const cost = farm.condensedCost();
    s.farm.potions[name] = cost.bottles;
    s.counters.stones.reroll_value = cost.reroll_value;
    fillBag(s);
    expect(condense(s, name)).toEqual({ ok: true });
    expect(s.farm.potions[name]).toBe(0);
    expect(s.farm.condensed[name]).toBe(1);
    expect(slotsUsed(s)).toBeLessThanOrEqual(slotsAvailable(s));
  });
  it('cooks in a full bag when its ingredients free the output slot', () => {
    const s = newGame();
    s.cell = { q: 1, r: 0, sub: null, wild: fieldwork.F.wild_site_index.mine };
    expect(establishCamp(s).ok).toBe(true);
    const recipe = fieldwork.F.recipes.find((r: any) => r.level === 1)!;
    Object.assign(s.fieldwork.materials, recipe.materials);
    Object.assign(s.fieldwork.foods, recipe.foods);
    Object.assign(s.farm.herbs, recipe.herbs);
    fillBag(s);
    expect(canCook(s, recipe.id)).toEqual({ ok: true });
    expect(cookMeal(s, recipe.id)).toEqual({ ok: true });
    expect(s.fieldwork.foods[recipe.id]).toBe(1);
    expect(slotsUsed(s)).toBeLessThanOrEqual(slotsAvailable(s));
  });

  it('keeps a completed task claimable while its reward cannot fit', () => {
    const s = newGame();
    s.counters.stones.remove = 0;
    s.town.tasks[0] = { kind: 'boss', zone: s.zone, n: 1, progress: 1, stone: 'remove', count: 1, claimed: false, offeredAt: 0 };
    fillBag(s);
    const task = structuredClone(s.town.tasks[0]);
    expect(claimTask(s, 0)).toBe(false);
    expect(s.town.tasks[0]).toEqual(task);
    expect(slotsUsed(s)).toBe(slotsAvailable(s));
    delete s.junk['filler-0'];
    expect(claimTask(s, 0)).toBe(true);
    expect(s.counters.stones.remove).toBe(1);
  });

  it.each([false, true])('manual salvage preflights both resource outputs (existing iron stack: %s)', (existing) => {
    const s = newGame();
    s.bag = [armour()];
    if (existing) s.fieldwork.materials['iron-ore'] = 1;
    fillBag(s);
    const before = exportJson(s);
    expect(salvageBag(s, 0).ok).toBe(false);
    expect(exportJson(s)).toBe(before);
    delete s.junk['filler-0'];
    if (!existing) delete s.junk['filler-1'];
    expect(salvageBag(s, 0).ok).toBe(true);
    expect(s.bag).toHaveLength(0);
    expect(s.fieldwork.materials.scrap).toBe(1);
    expect(s.fieldwork.materials['iron-ore']).toBe(existing ? 2 : 1);
  });

  it.each([false, true])('a lethal hit causes Push before recovery (active heal: %s)', (activeHeal) => {
    const s = newGame(1);
    s.hunting = true;
    s.gear.fill(null);
    s.player.hp = 1;
    s.player.es = 0;
    s.group = [{ id: 'lethal', species: 'Goblin', kind: 'Small', zone: s.zone, level: 1,
      hp: 1e9, hpMax: 1e9, xp: 1, ps: activeHeal ? 100 : 2, hitsPerSec: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
      damage: 'magic', innate: [], align: 0, crit: 0, armour: 0, res: 0, atkTimer: 0,
      engageSec: 0, line: 'front' } as Mob];
    s.player.esIdleSec = 0;
    if (activeHeal) s.healUp = { pctPerSec: 1, secLeft: 2 };
    tick(s, { autoSkills: false });
    expect(s.phase).toBe('camp');
    expect(s.player.hp).toBe(0);
  });
});

const hitMob = (over: Partial<Mob> = {}): Mob => mobFixture({
  id: 'm', ps: 100, acc: 1, damage: 'physical', innate: [], align: 0, crit: 0, ...over,
});
const flat = (v: number) => () => v;

describe('audit follow-up: character, combat order and recovery', () => {
  it('only worn gear moves the stat — the bag, the stash and the Collector pile never do', () => {
    const piece: Item = { ...armour(), slot: 'chest', lines: [{ id: 'armour_flat', value: 100 }] };
    const worn = emptyGear();
    const at = loot.SLOTS.indexOf('chest');
    worn[at] = piece;
    const bare = buildCharacter(1, emptyGear());
    const equipped = buildCharacter(1, worn);
    expect(equipped.armour).toBeGreaterThan(bare.armour);
    // the same piece parked in the bag/stash leaves the build untouched (buildCharacter reads gear only)
    expect(buildCharacter(1, emptyGear()).armour).toBe(bare.armour);
    // removal returns the sheet to the baseline the tick would rebuild to
    worn[at] = null;
    expect(buildCharacter(1, worn).armour).toBe(bare.armour);
  });

  it('runs perfect dodge before Evasion and Block, and Evasion before Block', () => {
    const base = buildCharacter(60, emptyGear());
    const dodged = mobSwing(flat(0.5), { ...base, perfectDodge: 100, block: 100 } as Character, hitMob(), {}, NO_CURSE);
    expect(dodged.blocked).toBe('perfect dodge');
    expect(dodged.toEs + dodged.toHp).toBe(0);
    // with no perfect dodge but a standing Evasion, the swing dies at Evasion and never reaches Block
    const evaded = mobSwing(flat(0.5), { ...base, perfectDodge: 0, evasion: 1e9, block: 100 } as Character, hitMob(), {}, NO_CURSE);
    expect(evaded.blocked).toBe('evasion');
  });

  it('lets a shield block only a physical swing, never a pure Element one', () => {
    const base = buildCharacter(60, emptyGear());
    const char = { ...base, perfectDodge: 0, evasion: 0, armour: 0, resistance: 0, resCap: 100, block: 100 } as Character;
    expect(mobSwing(flat(0.5), char, hitMob({ damage: 'physical' }), {}, NO_CURSE).blocked).toBe('block');
    expect(mobSwing(flat(0.5), char, hitMob({ damage: 'magic' }), {}, NO_CURSE).blocked).toBeNull();
  });

  it('spends Energy Shield before Health, and overflow lands on Health once', () => {
    const base = buildCharacter(60, emptyGear());
    const char = { ...base, perfectDodge: 0, evasion: 0, block: 0, armour: 0, resistance: 0, resCap: 100, es: 1000 } as Character;
    const raw = mobSwing(flat(0.5), char, hitMob(), {}, NO_CURSE);
    expect(raw.toHp + raw.toEs).toBeGreaterThan(0);
    const partial = mobSwing(flat(0.5), char, hitMob(), {}, NO_CURSE, 10);
    expect(partial.toEs).toBeLessThan(partial.raw);
    expect(partial.toHp).toBeGreaterThan(0);
    expect(partial.toEs + partial.toHp).toBeCloseTo(raw.toHp + raw.toEs, 6);
    const full = mobSwing(flat(0.5), char, hitMob(), {}, NO_CURSE, 1000);
    expect(full.toHp).toBe(0);
  });

  it('prints Evasion as the reference anchor, not the live roll against a heavy attacker', () => {
    const s = newGame(100);
    s.player.level = 100;
    const c = buildCharacter(100, s.gear, {}, 0, { add: {}, mult: {} }, s.player.points, s.player.treeRanks);
    expect(c.evasion).toBeGreaterThan(0);
    expect(c.evasionChance).toBeCloseTo(eng.evasionChance(c.evasion, eng.refAttackerAcc(100)), 9);
    // against a mob with far thinner accuracy, the live roll climbs above the published anchor
    expect(eng.evasionChance(c.evasion, eng.refAttackerAcc(100) / 10)).toBeGreaterThan(c.evasionChance);
  });
});
