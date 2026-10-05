import { describe, it, expect } from 'vitest';
import { E, eng } from '../src/engine/client';
import { newGame, tick, catchUp } from '../src/sim/game';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { craft } from '../src/sim/craft';
import { rollDrop } from '../src/sim/drop';
import { setRule } from '../src/sim/filter';
import { exportJson, importJson, migrate, newAccount, mergeMastery, SCHEMA_VERSION } from '../src/state/save';
import { mulberry32 } from '../src/engine/client-helpers';

describe('offline time is AFK, not a second play session', () => {
  it('never spawns a boss while the player is away', () => {
    const s = newGame(41);
    s.player.level = 60;
    const r = catchUp(s, {}, 3600 * 3);
    expect(r.simulated).toBe(10800);
    expect(s.log.some((l) => /Boss spawn/.test(l.text))).toBe(false);
    expect(s.counters.kills).toBeGreaterThan(0);
  });

  it('a boss does spawn on the same clock while online', () => {
    const s = newGame(42);
    s.player.level = 60;
    for (let i = 0; i < 1000; i++) tick(s, {});
    expect(s.log.some((l) => /Boss spawn/.test(l.text))).toBe(true);
  });

  it('limits offline drop quality to the zone floor', () => {
    const s = newGame(43);
    s.player.level = 80;
    s.zone = 9;
    for (let i = 0; i < 4000; i++) tick(s, {}, { online: false });
    expect(s.bag.length).toBeGreaterThan(0);
    const floor = E.rarity.floor_ceiling.high.floor;
    const allowed = new Set([floor, 'high']);
    for (const item of s.bag) expect(allowed.has(item.quality)).toBe(true);
  });

  it('the same zone online can still roll above the floor', () => {
    const s = newGame(44);
    s.player.level = 80;
    s.zone = 9;
    for (let i = 0; i < 4000; i++) tick(s, {}, { online: true });
    expect(s.bag.some((item) => item.quality === 'high')).toBe(true);
  });
});

describe('the salvage milestone (checks.md F15)', () => {
  it('owes one Reroll tier stone per 500 pieces dissolved', () => {
    const s = newGame(45);
    s.player.level = 90;
    setRule(s.filter, 'all', { enabled: true }); // the filter ships off (D-122), so nothing would dissolve until it is armed
    // wear a full high-quality set so nearly every drop is a rejection
    s.gear = emptyGear().map((_, i) => {
      const item = rollDrop(mulberry32(100 + i), 'high', 1.2);
      return { ...item, slot: i === 0 ? 'main hand' : item.slot, q: 2, quality: 'high' };
    });
    for (let i = 0; i < 9000; i++) tick(s, {});
    expect(s.counters.salvaged || 0).toBeGreaterThan(0);
    const owed = Math.floor((s.counters.salvaged || 0) / E.salvage.pieces_per_tier_stone);
    expect(s.counters.stones.tier || 0).toBeGreaterThanOrEqual(owed);
    if (owed > 0) expect(s.log.some((l) => /Salvage milestone/.test(l.text))).toBe(true);
  });
});

describe('the Reroll baseline survives a downgrade (save.md)', () => {
  it('remembers the highest value the slot ever held', () => {
    let item = rollDrop(mulberry32(51), 'low', 1.2);
    item = { ...item, rarity: 'Rare', q: 0, quality: 'low', lines: item.lines.map((l) => ({ ...l, slice: 1 })) };
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
});
