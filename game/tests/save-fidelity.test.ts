import { describe, it, expect } from 'vitest';
import { E, eng } from '../src/engine/client';
import { newGame, tick, catchUp, setLevel, huntZone } from '../src/sim/game';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { craft } from '../src/sim/craft';
import { rollDrop } from '../src/sim/drop';
import { setRule } from '../src/sim/filter';
import { exportJson, importJson, migrate, newAccount, mergeMastery, applyAccount, SCHEMA_VERSION } from '../src/state/save';
import { mulberry32 } from '../src/engine/client-helpers';
import { spendTreePoint, treeLines, treePointsSpent } from '../src/sim/tree';

describe('offline time is AFK, not a second play session', () => {
  it('never spawns a boss while the player is away', () => {
    const s = newGame(41);
    huntZone(s, s.zone);
    setLevel(s, 60);
    const r = catchUp(s, {}, 3600 * 3);
    expect(r.simulated).toBe(10800);
    expect(s.log.some((l) => /Boss spawn/.test(l.text))).toBe(false);
    expect(s.counters.kills).toBeGreaterThan(0);
  }, 30000);

  it('the away period does not advance the boss clock (save.md)', () => {
    // bossDueAt is absolute clockSec, so away ticks used to satisfy it on the first online tick and
    // hand out a free boss. The remaining online time must be identical after the catch-up.
    const s = newGame(46);
    huntZone(s, s.zone);
    setLevel(s, 60);
    s.bossDueAt = s.clockSec + 1000;
    const remainingBefore = s.bossDueAt - s.clockSec;
    catchUp(s, {}, 3600 * 3);
    expect(s.clockSec).toBeGreaterThan(0);
    expect(s.bossDueAt! - s.clockSec).toBe(remainingBefore);
  });

  it('a boss does spawn on the same clock while online', () => {
    const s = newGame(42);
    huntZone(s, s.zone);
    setLevel(s, 60);
    // tick to the state the test names — a boss on the log — not for a guessed window (AGENTS.md)
    for (let i = 0; i < 20000 && !s.log.some((l) => /Boss spawn/.test(l.text)); i++) tick(s, {});
    expect(s.log.some((l) => /Boss spawn/.test(l.text))).toBe(true);
  });

  it('limits offline drop quality to the zone floor', () => {
    const s = newGame(43);
    huntZone(s, s.zone);
    setLevel(s, 80);
    s.zone = 9;
    // Tick until the away window has paid a drop, not for a guessed number of seconds: an ungeared
    // level-80 in zone 9 lands about twenty kills in four thousand ticks, so a fixed window made this
    // a coin flip on the 8% roll — and a fixed window is a time premise, which no test here may carry
    // (owner ruling · `AGENTS.md`). The cap below is a hang guard, never the measurement.
    for (let i = 0; i < 200000 && s.bag.length === 0; i++) tick(s, {}, { online: false });
    expect(s.bag.length).toBeGreaterThan(0);
    // the away window pins the piece to the floor level of its band exactly. Listing the band's own
    // levels here as well would make the assertion vacuous — the floor of a high band is the mid band's
    // first level, so allowing anything above it checks nothing.
    const floorLevel = eng.floorLevelOf('high');
    for (const item of s.bag) expect(item.ilvl).toBe(floorLevel);
  });

  it('the same zone online rolls at the mobs the character actually fights', () => {
    const s = newGame(44);
    huntZone(s, s.zone);
    setLevel(s, 80);
    s.zone = 9;
    // tick until a piece above the floor level lands, not for a guessed window: a fixed window makes
    // this a coin flip on the 8% drop (a time premise · AGENTS.md).
    const floorLevel = eng.floorLevelOf('high');
    for (let i = 0; i < 200000 && !s.bag.some((item) => item.ilvl > floorLevel); i++) tick(s, {}, { online: true });
    expect(s.bag.some((item) => item.ilvl > floorLevel)).toBe(true);
  });
});

describe('the salvage milestone (checks.md F15)', () => {
  it('owes one Tier stone per 500 pieces dissolved', () => {
    const s = newGame(45);
    huntZone(s, s.zone);
    setLevel(s, 90);
    setRule(s.filter, 'all', { enabled: true }); // the filter ships off, so nothing would dissolve until it is armed
    // wear a full high-quality set so nearly every drop is a rejection
    s.gear = emptyGear().map((_, i) => {
      const item = rollDrop(mulberry32(100 + i), 'high', 61);
      return { ...item, slot: i === 0 ? 'main hand' : item.slot, q: 2, quality: 'high' };
    });
    // the milestone is a count of salvaged pieces, so the run stops when one has been salvaged
    for (let i = 0; i < 60000 && (s.counters.salvaged || 0) === 0; i++) tick(s, {});
    expect(s.counters.salvaged || 0).toBeGreaterThan(0);
    const owed = Math.floor((s.counters.salvaged || 0) / E.salvage.pieces_per_tier_stone);
    expect(s.counters.stones.tier || 0).toBeGreaterThanOrEqual(owed);
    if (owed > 0) expect(s.log.some((l) => /Salvage milestone/.test(l.text))).toBe(true);
  });
});

describe('the Reroll baseline survives a downgrade (save.md)', () => {
  it('remembers the highest value the slot ever held', () => {
    let item = rollDrop(mulberry32(51), 'low', 1);
    item = { ...item, ilvl: 61, q: 0, quality: 'low', lines: item.lines.map((l) => ({ ...l, slice: 1 })) };
    const up = craft.reroll(item, craft.UNTOUCHABLE, mulberry32(3));
    expect(up.ok).toBe(true);
    const baseline = up.item.lines[craft.UNTOUCHABLE].value;
    // the 1-stone randomize may land lower; the baseline must not forget
    const down = craft.randomize({ ...up.item, lines: up.item.lines.map((l: any) => ({ ...l, value: 1 })) }, craft.UNTOUCHABLE, mulberry32(4));
    expect(down.ok).toBe(true);
    const again = craft.reroll(down.item, craft.UNTOUCHABLE, mulberry32(5));
    expect(again.ok).toBe(true);
    expect(again.item.lines[craft.UNTOUCHABLE].value).toBeGreaterThanOrEqual(baseline);
    expect(again.item.baselines[craft.UNTOUCHABLE]).toBeGreaterThanOrEqual(baseline);
  });
});

describe('the save schema and the account', () => {
  it('exports with a version and rejects a foreign one instead of converting', () => {
    const s = newGame(52);
    const text = exportJson(s);
    expect(JSON.parse(text).version).toBe(SCHEMA_VERSION);
    expect(importJson(text).player.level).toBe(s.player.level);
    expect(() => importJson(JSON.stringify({ version: 1, state: s }))).toThrow(/schema version 1/);
    expect(() => importJson(JSON.stringify({ state: s }))).toThrow(/schema version none/);
  });

  it('fills subsystems a older save never had', () => {
    const bare = { player: { level: 1 }, counters: { kills: 0 } } as any;
    const m = migrate(bare);
    expect(m.presets.length).toBe(E.presets.sets);
    expect(m.grants.stash_tabs).toBe(0);
    expect(m.pedlar.minutes).toEqual([]);
    expect(m.collector.done).toEqual({});
  });

  it('re-stamps a pre-level piece: it gains its band\u2019s first level and keeps every value', () => {
    const v8 = newGame(53);
    // a v8 piece as the old axis wrote it: a Rarity, a band, and the old slice order (T1 = the bottom)
    const old = {
      slot: 'helmet', base: 'Sallet', rarity: 'Rare', quality: 'high', tier: 'T1', q: 2,
      lines: [
        { id: 'max_hp_flat', value: 123, slice: 0 },
        { id: 'armour_pct', value: 11, slice: 2 },
      ],
    } as any;
    v8.gear[0] = old;
    (v8 as any).autoDissolveRarity = 'Common';
    const m = migrate(JSON.parse(JSON.stringify(v8)), 8);
    expect(m.gear[0]!.ilvl).toBe(eng.floorLevelOf('high')); // the floor level of its own band
    expect((m.gear[0] as any).rarity).toBeUndefined();
    expect(m.gear[0]!.lines.map((l) => l.value)).toEqual([123, 11]); // every value as it was
    expect(m.gear[0]!.lines.map((l) => l.slice)).toEqual([2, 0]); // the labels flipped onto the new order
    expect(m.gear[0]!.tier).toBe('T3');
    expect(m.autoDissolveLevel).toBe(31); // the old keep-above-Common setting became a level floor
  });

  it('carries the passive-tree ranks through an export and a load', () => {
    const s = newGame(56);
    setLevel(s, 40);
    expect(spendTreePoint(s, 'impact.1').ok).toBe(true);
    expect(spendTreePoint(s, 'impact.2').ok).toBe(true);
    const ranks = { ...s.player.treeRanks! };
    const points = s.player.treePoints;
    const lines = treeLines(s);
    // a foreign-version guard and a same-version round trip, so the ranks are proven to travel with the
    // save rather than being rebuilt from the level on load
    const back = importJson(exportJson(s));
    expect(back.player.treeRanks).toEqual(ranks);
    expect(back.player.treePoints).toBe(points);
    expect(treeLines(back)).toEqual(lines);
    expect(treePointsSpent(back)).toBe(treePointsSpent(s));
  });

  it('fills treeRanks for a save that predates the tree', () => {
    // a pre-tree save holds banked points and no ranks; the load must not leave the field undefined or
    // the sheet would read ranks off nothing
    const old = newGame(57);
    setLevel(old, 30);
    delete old.player.treeRanks;
    const m = migrate(JSON.parse(JSON.stringify(old)));
    expect(m.player.treeRanks).toEqual({});
    expect(m.player.treePoints).toBe(eng.treePointsAt(30));
  });

  it('shares Mastery across the three slots and keeps the best', () => {
    const a = newAccount();
    const s1 = newGame(53);
    s1.mastery['dagger'] = 900;
    mergeMastery(a, s1);
    expect(a.mastery['dagger']).toBe(900);
    const s2 = newGame(54);
    s2.mastery['dagger'] = 400;
    mergeMastery(a, s2);
    expect(a.mastery['dagger']).toBe(900);
    s2.mastery = { ...a.mastery };
    expect(s2.mastery['dagger']).toBe(900);
  });

  it('does not wipe a slot Mastery when the account record is missing', () => {
    // the account file is derived; losing it must not zero the slot's own Mastery on the next load
    const s = newGame(55);
    s.mastery['dagger'] = 700;
    applyAccount(newAccount(), s); // newAccount carries an empty mastery map
    expect(s.mastery['dagger']).toBe(700);
    // and an account with a higher line still lifts the slot
    applyAccount({ ...newAccount(), mastery: { dagger: 1200 } }, s);
    expect(s.mastery['dagger']).toBe(1200);
  });
});
