import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/engine/client-helpers';
import { eng, E, ED, loot, sm, MODS, BASES, TOWN, tree } from '../src/engine/client';
import { createCraft } from '../../engine/craft.ts';
import { newGame, tick, huntZone, carried, setLevel, catchUp } from '../src/sim/game';
import { buildCharacter } from '../src/sim/player';
import { rollDrop } from '../src/sim/drop';
import { poolOf } from '../src/sim/craft';
import { cooldownLeft, enterDungeon } from '../src/sim/dungeon';
import { col, turnIn } from '../src/sim/collector';
import { settlementById } from '../src/sim/town';
import { settlementCell, walkNote } from '../src/sim/road';
import { mobSwing, dotDamageParts, type Statuses } from '../src/sim/combat';
import { newMobStatusStore, placeStatus, applyBleed, stepMob, modsOn, targetMods } from '../src/sim/mobStatus';
import { spendableMana, reservedMana, usableMana, tickSkills, newSkillState } from '../src/sim/skills';
import { switchPreset } from '../src/sim/presets';
import { PAGES } from '../src/wiki/pages';
import type { Character } from '../src/sim/player';
import type { Mob } from '../src/sim/types';
import { mobFixture } from './mobFixture';

/**
 * Regressions for the end-to-end audit: each test pins a rule the live code had drifted from —
 * the mirror's own basis for DoT budgets, the layer order, the reservation the UI promises, and
 * the clocks the module contract says move together.
 */

  const mob = (over: Partial<Mob> = {}): Mob => mobFixture({
    species: 'Goblin', level: 1, hp: 1000, hpMax: 1000, xp: 10, ps: 100, acc: 50, evasion: 10,
    damage: 'phys', align: 100, crit: 0, ...over,
  });

const sheet = (over: Partial<Character> = {}): Character =>
  buildCharacter(1, new Array(13).fill(null), {}, 0, undefined, undefined, undefined);
// buildCharacter with no points reads the reference line; the over rides land on top
const char = (over: Partial<Character>): Character => ({ ...sheet({}), ...over } as Character);

/** The section a `<h2>` opens. A heading that moved, or a slice that finds nothing, fails here
 *  instead of asserting against an empty string. */
const sectionOf = (html: string, heading: string): string => {
  const at = html.indexOf(`<h2>${heading}</h2>`);
  expect(at, heading).toBeGreaterThan(-1);
  const end = html.indexOf('</section>', at);
  expect(end, heading).toBeGreaterThan(at);
  const body = html.slice(at, end);
  expect(body.length, heading).toBeGreaterThan(`<h2>${heading}</h2>`.length);
  return body;
};

describe('mob-side DoT pays its full duration', () => {
  it('a 5-sec bleed pays 5 ticks — 0.70 of the hit, not 0.56', () => {
    const store = newMobStatusStore();
    applyBleed(mulberry32(1), store, 'm1', 100, 1);
    let total = 0;
    for (let i = 0; i < 7; i++) total += stepMob(store, 'm1');
    // bleed budget: 0.70 of the inflicting hit over 5 sec
    expect(total).toBeCloseTo(70, 6);
  });

  it('a 5-sec burn pays 5 ticks before its clock runs out', () => {
    const store = newMobStatusStore();
    const c = char({});
    placeStatus(store, 'm1', 'burn', c, 20); // alignedPerSec 20 → burn 20×k_dps
    let ticks = 0;
    for (let i = 0; i < 9 && stepMob(store, 'm1') > 0; i++) ticks++;
    expect(ticks).toBe(E.status.burn.time_sec);
  });
});

describe('the player-side DoT budget is priced off the dealer', () => {
  it('caps at dot_cap × the dealer’s aligned DPS, never the victim’s own Elemental power', () => {
    const statuses: Statuses = {
      burn: { stacks: 1, secLeft: 5, perSec: 1000, alignedSec: 50 },
      poison: { stacks: 1, secLeft: 5, perSec: 1000, alignedSec: 50 },
    };
    // a victim with NO Elemental power of its own: the old cap read 0 and let everything through
    const parts = dotDamageParts(char({ elem: 0, alignment: 0 }), statuses);
    const cap = E.status.dot_cap * 50;
    expect(parts.total).toBeCloseTo(cap, 6);
    // and a respec of the victim cannot move what the mob's fire does
    const other = dotDamageParts(char({ elem: 5000, alignment: 100 }), statuses);
    expect(other.total).toBeCloseTo(cap, 6);
  });

  it('the dealer’s own Alignment multiplier rides the basis, the mirror of our statuses on a mob', () => {
    const statuses: Statuses = { burn: { stacks: 1, secLeft: 5, perSec: 10, alignedSec: 40 } };
    const parts = dotDamageParts(char({ elem: 0 }), statuses);
    expect(parts.burn).toBeCloseTo(10, 6); // under the cap, the roll passes whole
  });
});

describe('the incoming layer order', () => {
  it('block’s flat cut lands before the damage-taken multiplier', () => {
    const m = mob({ ps: 200, hitsPerSec: 1, damage: 'physical', innate: [] });
    const c = char({ block: 100, armour: 100, damageTaken: 1.3, resistance: 0, resCap: 75, evasion: 0, perfectDodge: 0 });
    const r = mobSwing(mulberry32(1), c, m, {});
    const raw = m.ps / m.hitsPerSec;
    const cut = eng.armourReduce(c.armour, raw);
    const expected = Math.max(0, raw * (1 - cut) - c.armour / (E.caps as any).block_divisor) * (E.global as any).defend_mult * 1.3;
    expect(r.blocked).toBe('block');
    expect(r.toHp + r.toEs).toBeCloseTo(expected, 6);
  });

  it('the shock merge takes the stronger attack-speed cut', () => {
    const store = newMobStatusStore();
    const c = char({});
    placeStatus(store, 'm1', 'chill', c, 10);
    placeStatus(store, 'm1', 'shock', c, 10);
    const mods = targetMods(modsOn(store, 'm1'));
    expect(mods.attackSpeed).toBeLessThanOrEqual(-(E.status as any).shock.aspd_cap);
  });
});

describe('the reservation the UI promises is the one the rotation obeys', () => {
  it('spendableMana holds the auras’ share back from whatever the pool holds', () => {
    const s = newSkillState();
    const auraId = (sm.all() as any[]).find((k) => k.type === 'aura' && k.reserve)!;
    s.owned[auraId.id] = 0; // a first owned copy: duplicate count zero
    s.auras[auraId.id] = true;
    const c = char({ maxMana: 100 });
    const pct = sm.reservePct(auraId.reserve);
    expect(reservedMana(c, s)).toBeCloseTo(pct, 6);
    expect(spendableMana(c, s, 100)).toBeCloseTo(usableMana(c, s), 6);
    expect(spendableMana(c, s, 40)).toBeCloseTo(Math.max(0, 40 - pct), 6);
  });

  it('the live tick never spends into the reserved slice', () => {
    const s = newGame(31);
    huntZone(s, s.zone);
    const auraId = (sm.all() as any[]).find((k) => k.type === 'aura' && k.reserve)!;
    s.skills.owned[auraId.id] = 0;
    s.skills.auras[auraId.id] = true;
    const c = buildCharacter(s.player.level, s.gear, carried(s), 0, undefined, s.player.points, s.player.treeRanks);
    const floor = reservedMana(c, s.skills);
    s.player.mana = c.maxMana;
    for (let i = 0; i < 200 && s.group.length === 0; i++) tick(s, { online: true });
    for (let i = 0; i < 40; i++) {
      tick(s, { online: true });
      expect(s.player.mana).toBeGreaterThanOrEqual(floor - 1e-6);
    }
  });
});

describe('the clocks the module contract moves together', () => {
  it('Haste scales a buff’s window and its cooldown with the same multiplier', () => {
    const s = newSkillState();
    s.cd['a'] = 10;
    s.buffUp['a'] = 10;
    for (let i = 0; i < 5; i++) tickSkills(s, 2);
    expect(s.cd['a']).toBe(0);
    expect(s.buffUp['a']).toBe(0);
  });

  it('a preset switch kills the buff windows the new set has toggled off', () => {
    const s = newGame(32);
    const buffId = (sm.all() as any[]).find((k) => k.type === 'buff')!.id;
    s.skills.owned[buffId] = 0;
    s.skills.buffs[buffId] = true;
    s.skills.buffUp[buffId] = 30;
    switchPreset(s, 1); // the fresh set has no toggles on
    expect(s.skills.buffUp[buffId] ?? 0).toBe(0);
  });

  it('a preset switch refuses rows the collection does not own', () => {
    const s = newGame(33);
    s.presets[1].list[0] = 'attack.nope';
    switchPreset(s, 1);
    expect(s.skills.list[0]).toBe(null);
  });
});

describe('damage taken interrupts the shield’s recharge, whatever pool it landed on', () => {
  it('a poison tick that reaches HP resets the recharge delay like a direct hit does', () => {
    const s = newGame(34);
    huntZone(s, s.zone);
    for (let i = 0; i < 400 && s.group.length === 0; i++) tick(s, { online: true });
    s.player.esIdleSec = E.energy_shield.delay_sec - 1;
    // the saved state holds the character's own statuses (§7.7)
    s.playerStatuses.poison = { stacks: 1, secLeft: 5, perSec: 5, alignedSec: 100 };
    tick(s, { online: true });
    // the tick's own counter runs after the reset, so a damaging tick ends the second at 1 —
    // the pre-fix code let it climb to delay_sec and recharged through the poison
    expect(s.player.esIdleSec).toBe(1);
  });
});

describe('a Push is a clean rest', () => {
  it('clears the statuses the fight had on the character', () => {
    const s = newGame(35);
    huntZone(s, s.zone);
    for (let i = 0; i < 400 && s.group.length === 0; i++) tick(s, { online: true });
    s.playerStatuses.burn = { stacks: 3, secLeft: 5, perSec: 50, alignedSec: 100 };
    s.player.hp = 0; // the next tick reads it as a Push
    tick(s, { online: true });
    expect(s.phase).toBe('camp');
    expect(Object.keys(s.playerStatuses)).toHaveLength(0);
  });

  it('camps for a finite time, heals, and the rest ends', () => {
    const s = newGame(38);
    huntZone(s, s.zone);
    for (let i = 0; i < 400 && s.group.length === 0; i++) tick(s, { online: true });
    s.player.hp = 0; // the next tick reads it as a Push
    tick(s, { online: true });
    expect(s.phase).toBe('camp');
    // the camp is a finite rest: its length is a number, not an endless one
    expect(Number.isFinite(s.campSec)).toBe(true);
    expect(s.campSec).toBeGreaterThan(0);
    // it heals, and it ends: the character is back in play with life in hand
    let rested = false;
    for (let i = 0; i < 400 && !rested; i++) {
      tick(s, { online: true });
      rested = s.phase !== 'camp';
    }
    expect(rested).toBe(true);
    expect(s.player.hp).toBeGreaterThan(0);
  });
});

describe('progression holds the curve it is priced on', () => {
  it('a fresh character holds the tree points its level curve pays', () => {
    const s = newGame(36);
    expect(s.player.treePoints).toBe(tree.pointsAt(E.opening.level, E.stat.level_cap));
  });

  it('a run that cleared mid-away does not over-charge its cooldown', () => {
    const s = newGame(37);
    setLevel(s, 60);
    expect(enterDungeon(s).ok).toBe(true);
    s.dungeon!.left = 1; // the last mob falls early in the away window
    catchUp(s, 600);
    expect(s.dungeon).toBe(null);
    // the cooldown begins at the return second: away time never accrues toward it
    expect(cooldownLeft(s)).toBe(E.dungeon.cooldown_sec);
  });
});

describe('the Corrupt gamble pays what its table promises', () => {
  const craft = createCraft(ED, loot, BASES);
  const piece = (seed: number) => rollDrop(mulberry32(seed), 'low', E.item_level.spans[0].from) as any;

  it('the add_mod outcome can actually add its line', () => {
    let landed = false;
    for (let seed = 1; seed <= 400 && !landed; seed++) {
      const item = piece(seed);
      const r = craft.corrupt(item, poolOf(item), mulberry32(seed * 7 + 1));
      if (r.ok && r.changed?.outcome === 'add_mod') {
        landed = r.item.lines.length > item.lines.length;
      }
    }
    expect(landed).toBe(true);
  });

  it('the gear_mod_up outcome never grants Gear Mod past the ladder cap', () => {
    const cap = (ED.craft as any).upgrade_cap as number;
    let atCap = false;
    for (let seed = 1; seed <= 400 && !atCap; seed++) {
      const item = { ...piece(seed), upgrade_lv: cap };
      const r = craft.corrupt(item, poolOf(item), mulberry32(seed * 11 + 3));
      if (r.ok && r.changed?.outcome === 'gear_mod_up') {
        atCap = true;
        expect(r.item.gearMod).toBe(item.gearMod); // no level behind the +N, no +N
        expect(r.item.upgrade_lv).toBe(cap);
      }
    }
    expect(atCap).toBe(true);
  });
});

describe('the Collector never consumes a pinned piece', () => {
  it('opens and pays once at the exact configured Standing threshold', () => {
    const s = newGame(39);
    const set = col.sets[0];
    const settlement = settlementById(set.settlement)!;
    const threshold = TOWN.standing.collector_required_tier;
    const kills = Math.ceil(TOWN.standing.tiers[threshold - 1].share * eng.SETTLEMENT_BUDGET_KILLS[settlement.zone]);
    s.cell = { ...settlementCell(set.settlement)!, sub: null, wild: null };
    s.zone = settlement.zone;
    s.counters.zoneKills[settlement.zone] = kills - 1;
    s.bag = set.parsed.map((p: any) => ({ slot: p.slot, base: p.name, ilvl: 1, quality: 'low', tier: 'T1', q: 0, lines: [], heldFor: set.id }));
    const locked = turnIn(s, set.settlement);
    expect(locked.ok).toBe(false);
    expect(locked.why).toContain(`Tier ${TOWN.standing.tiers[threshold - 1].name} Standing`);
    s.counters.zoneKills[settlement.zone] = kills;

    expect(turnIn(s, set.settlement)).toMatchObject({ ok: true, reward: set.reward });
    expect(s.collector.done[set.id]).toBe(true);
    expect(turnIn(s, set.settlement).why).toBe('this set is already turned in');
  });

  it('a turn-in leaves the locked held piece in the bag and names it', () => {
    const s = newGame(38);
    const set = col.sets[0];
    const settlement = settlementById(set.settlement)!;
    s.cell = { ...settlementCell(set.settlement)!, sub: null, wild: null };
    s.zone = settlement.zone;
    // Tier II standing opens the set slots: Standing reads kills over the settlement's own budget
    s.counters.zoneKills[settlement.zone] = eng.SETTLEMENT_BUDGET_KILLS[settlement.zone] * 10;
    for (const [i, p] of set.parsed.entries()) {
      s.bag.push({ slot: 'chest', base: p.name, ilvl: 1, quality: 'low', tier: 'T1', q: 0, lines: [], heldFor: set.id, locked: i === 0 } as any);
    }
    const before = s.bag.length;
    const r = turnIn(s, set.settlement);
    expect(r.ok).toBe(false);
    expect(r.why).toContain('locked');
    expect(s.bag.length).toBe(before);
    expect(s.collector.done[set.id]).toBeFalsy();
  });
});

/**
 * What a spawn in a zone actually wears: a Normal or Elite takes its species' Element and a Boss its
 * own declared one (`spawnAt` · `mob.bosses[].element`). Read off the data here rather than off the
 * engine's own helper, so the two cannot agree by sharing a bug.
 */
const wornInZone = (zoneId: number): string[] => {
  const worn = new Set<string>();
  for (const sp of E.mob.species as any[]) if ((sp.zones || []).includes(zoneId)) worn.add(sp.element);
  for (const b of E.mob.bosses as any[]) if (b.zone === zoneId) worn.add(b.element);
  return (E.elements.order as string[]).filter((el) => worn.has(el));
};

describe('the zone Elements column is what spawns there, not a declared copy', () => {
  it('derives every zone from the cast it fields', () => {
    for (const z of E.mob.zones as any[]) expect(eng.zoneElements(z.id), z.name).toEqual(wornInZone(z.id));
  });

  it('prints that set on the wiki world page, where a player reads it as what to resist', () => {
    const html = PAGES.find((p) => p.file === 'world.html')!.body.join('\n');
    const at = html.indexOf('<h2>Zones</h2>');
    expect(at).toBeGreaterThan(-1);
    const zones = html.slice(at, html.indexOf('</section>', at));
    for (const z of E.mob.zones as any[]) {
      const row = zones.slice(zones.indexOf(`<td>${z.name}</td>`));
      // Elements is the last column of the Zones table
      expect(row.slice(0, row.indexOf('</tr>')).endsWith(`<td>${wornInZone(z.id).join(' · ')}</td>`), z.name).toBe(true);
    }
  });

  it('leaves no declared column behind to drift out of agreement again', () => {
    for (const z of E.mob.zones as any[]) expect(z.elements, z.name).toBeUndefined();
  });
});

describe('the wiki overview reads the live slot and mob-health contracts', () => {
  it('counts worn cells and describes zone Elements as the cast, not a zone theme', () => {
    const html = PAGES.find((p) => p.file === 'index.html')!.body.join('\n');
    expect(html).toContain(`<td>Worn slots</td><td><span class="num">${E.stat.item_slots}</span></td>`);
    expect(html).toContain('spawn Elements');
    expect(html).not.toContain('each with its own level band, Element and group size');
  });

  it('does not print a missing body-class health multiplier as ×—', () => {
    const world = PAGES.find((p) => p.file === 'world.html')!.body.join('\n');
    const combat = PAGES.find((p) => p.file === 'combat.html')!.body.join('\n');
    const body = sectionOf(world, 'Body classes');
    const ranks = sectionOf(combat, 'Elite, Unique and Boss');
    expect(body).not.toContain('<th>Health</th>');
    expect(body).not.toContain('×—');
    expect(ranks).not.toContain('×—');
    // A body class carries no Health of its own: Boss and Unique take theirs from their own Core
    // profile with no rank multiplier, and Elite multiplies the complete Health of its variant.
    expect(ranks).toContain('BaseHP(L, Boss Core)');
    expect(ranks).toContain('BaseHP(zoneTop, Unique Core)');
    expect(ranks).toContain('BaseHP(L, Variant Core) ×');
  });
});

describe('the road names a wild side by the site the data puts there', () => {
  it('reads all three sites from fieldwork.wild_site_index instead of typing the dungeon door', () => {
    const s = newGame(11);
    for (const [site, index] of Object.entries(E.fieldwork.wild_site_index as Record<string, number>)) {
      s.walk = { kind: 'wild', wild: index, node: null } as any;
      expect(walkNote(s), site).toBe(`the ${site} side of the field`);
    }
    s.walk = { kind: 'wild', wild: 99, node: null } as any;
    expect(walkNote(s)).toBe('wild side the field');
  });
});

describe('a Stat Mod bakes the Core stat it feeds at drop', () => {
  it('gives every line whose Mod declares `rolls` one of them, and no other line one', () => {
    const rolls = new Map((MODS.mods as any[]).map((m) => [m.id, m.rolls]));
    let baked = 0;
    for (let seed = 1; seed <= 300; seed++) {
      for (const l of rollDrop(mulberry32(seed), 'mid', 60).lines as any[]) {
        const pool = rolls.get(l.id);
        if (pool) { expect(pool, l.id).toContain(l.stat); baked++; } else expect(l.stat, l.id).toBeUndefined();
      }
    }
    expect(baked).toBeGreaterThan(0);
  });
});
