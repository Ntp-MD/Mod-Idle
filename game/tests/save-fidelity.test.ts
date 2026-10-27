import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { E, eng, sm, tree } from '../src/engine/client';
import { newGame, tick, catchUp, setLevel, huntZone } from '../src/sim/core/game';
import { emptyGear, openingGear } from '../src/sim/core/player';
import { craft } from '../src/sim/gear/craft';
import { rollDrop } from '../src/sim/gear/drop';
import { setRule } from '../src/sim/gear/filter';
import { exportJson, importJson, listSnapshots, migrate, newAccount, mergeMastery, applyAccount, readSave, restoreSnapshot, SCHEMA_VERSION, writeSave, writeSaveSync } from '../src/state/save';
import { requestAccountWriterLock } from '../src/state/accountWriterLock';
import { mulberry32 } from '../src/engine/client-helpers';
import { spendTreePoint, treeLines, treePointsSpent } from '../src/sim/core/tree';
import { startWalk, road, settlementCell } from '../src/sim/world/road';

describe('storage recovery boundaries', () => {
  const mirror = new Map<string, string>();
  beforeEach(() => {
    mirror.clear();
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mirror.get(key) ?? null,
      setItem: (key: string, value: string) => { mirror.set(key, value); },
      removeItem: (key: string) => { mirror.delete(key); },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips each slot through the mirror when IndexedDB is unavailable', async () => {
    for (const [index, slot] of (['slot1', 'slot2', 'slot3'] as const).entries()) {
      const state = newGame(index + 1);
      state.counters.kills = index + 10;
      await writeSave(slot, state);
      expect((await readSave(slot))?.counters.kills).toBe(index + 10);
    }
  });

  it('never persists the transient fx ring in a snapshot or its restore', async () => {
    const state = newGame(55);
    state.fx.push({ kind: 'buff', side: 'self', text: 'stale' } as any);
    state.pendingSnapshot = 'level';
    await writeSave('slot1', state);
    const [shot] = await listSnapshots('slot1');
    expect(shot.state.fx).toEqual([]);
    const restored = await restoreSnapshot('slot1', 0);
    expect(restored?.fx).toEqual([]);
    expect((await readSave('slot1'))?.fx).toEqual([]);
  });

  it('restores a prior snapshot without keeping its later rewards', async () => {
    const state = newGame(55);
    state.counters.gold = 4;
    writeSaveSync('slot1', state);
    state.clockSec++;
    state.counters.gold = 9;
    state.pendingSnapshot = 'level';
    await writeSave('slot1', state);
    expect(await listSnapshots('slot1')).toHaveLength(2);
    expect((await restoreSnapshot('slot1', 1))?.counters.gold).toBe(4);
    expect((await readSave('slot1'))?.counters.gold).toBe(4);
  });

  it.each(['null', '{}', '"corrupt"', '[null]'])('treats malformed backup storage %s as no usable snapshots', async (raw) => {
    mirror.set('modworld:snap:slot1', raw);
    expect(await listSnapshots('slot1')).toEqual([]);
    expect(await restoreSnapshot('slot1', 0)).toBeNull();
    const state = newGame(55);
    writeSaveSync('slot1', state);
    expect(await listSnapshots('slot1')).toHaveLength(1);
  });

  it('keeps valid backups beside malformed entries without rewriting inspection reads', async () => {
    writeSaveSync('slot1', newGame(55));
    const [good] = await listSnapshots('slot1');
    const raw = JSON.stringify([null, {}, good]);
    mirror.set('modworld:snap:slot1', raw);
    expect(await listSnapshots('slot1')).toEqual([good]);
    expect(mirror.get('modworld:snap:slot1')).toBe(raw);
  });

  it('disables saving when Web Locks are absent', async () => {
    vi.stubGlobal('navigator', {});
    expect(await requestAccountWriterLock()).toEqual({ status: 'unsupported' });
  });

  it('rejects a failed save, preserves older copies and leaves the pending snapshot due', async () => {
    const state = newGame(56);
    state.counters.kills = 42;
    await writeSave('slot1', state);
    const oldSlot = mirror.get('modworld:slot1');
    const oldBackups = mirror.get('modworld:snap:slot1');
    const stamp = state.lastSavedAt;
    state.counters.kills++;
    state.pendingSnapshot = 'level';
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mirror.get(key) ?? null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: (key: string) => { mirror.delete(key); },
    });
    await expect(writeSave('slot1', state)).rejects.toThrow(/storage could not save/);
    expect(mirror.get('modworld:slot1')).toBe(oldSlot);
    expect(mirror.get('modworld:snap:slot1')).toBe(oldBackups);
    expect(state.lastSavedAt).toBe(stamp);
    expect(state.pendingSnapshot).toBe('level');
    expect(() => writeSaveSync('slot1', state)).toThrow(/emergency browser save failed/);
    expect(mirror.get('modworld:slot1')).toBe(oldSlot);
    expect(state.pendingSnapshot).toBe('level');
  });

  it('rejects a save when neither storage API is available', async () => {
    vi.stubGlobal('localStorage', undefined);
    await expect(writeSave('slot1', newGame(57))).rejects.toThrow(/Export JSON/);
  });
});

describe('skill toggles on a restored character', () => {
  it('removes effects with no owned skill while preserving a player-owned aura', () => {
    const s = newGame(90);
    s.skills.auras['aura.clarity'] = true;
    s.skills.buffs['buff.energy_absorb'] = true;
    s.skills.buffUp['buff.energy_absorb'] = 30;
    const orphaned = importJson(exportJson(s));
    expect(orphaned.skills.auras).toEqual({});
    expect(orphaned.skills.buffs).toEqual({});
    expect(orphaned.skills.buffUp).toEqual({});

    s.skills.owned['aura.clarity'] = 0;
    const owned = importJson(exportJson(s));
    expect(owned.skills.auras['aura.clarity']).toBe(true);
    expect(owned.skills.buffs['buff.energy_absorb']).toBeUndefined();
  });
});

describe('saved exploration controls', () => {
  it('backfills a v15 save with an empty Patrol and disabled Auto-Return without changing progress', () => {
    const source = newGame(86);
    source.gear = openingGear();
    source.counters.kills = 12;
    source.town.tasks[0]!.progress = 1;
    source.bag = [structuredClone(source.gear.find(Boolean)!)];
    const legacy = JSON.parse(exportJson(source));
    legacy.version = 15;
    delete legacy.state.patrol;
    delete legacy.state.autoReturn;

    const restored = importJson(JSON.stringify(legacy));
    expect(restored.patrol).toEqual({ stops: [], active: false, repeat: true, index: 0, groupsCleared: 0 });
    expect(restored.autoReturn).toEqual({ enabled: false, phase: 'idle', resumeCell: null });
    expect(restored.counters.kills).toBe(12);
    expect(restored.town.tasks[0]!.progress).toBe(1);
    expect(restored.bag).toHaveLength(source.bag.length);
    expect(restored.bag[0]).toMatchObject(source.bag[0]);
  });
});

describe('the cell under the feet survives a save', () => {
  it('a walk in flight and the standing hex round-trip unchanged', () => {
    const s = newGame(91);
    setLevel(s, 60);
    const dest = settlementCell(road.nodes[1].id)!;
    expect(startWalk(s, { ...dest, sub: null, wild: null }).ok).toBe(true);
    for (let i = 0; i < E.road.block_sec + 1; i++) tick(s, {});
    const back = importJson(exportJson(s));
    expect(back.walk).toEqual(s.walk);
    expect(back.cell).toEqual(s.cell);
    expect(typeof back.walk!.from).toBe('object');    // hexes, never a settlement name
    expect(back.walk!.blocksWalked).toBe(s.walk!.blocksWalked);
  });

  it('a v11 walk that named two settlements is re-read onto the lattice', () => {
    const s = newGame(92) as any;
    const [a, b] = road.nodes;
    const blocks = road.blocksBetweenHex(a, b);
    s.walk = { from: a.id, to: b.id, blocksTotal: blocks, blocksLeft: blocks - 1, secLeft: 5, blocksWalked: 1 };
    const m = migrate(JSON.parse(JSON.stringify(s)), 11);
    expect(m.walk!.from).toEqual({ q: a.q, r: a.r });
    expect(m.walk!.to).toEqual({ q: b.q, r: b.r });
    expect(m.walk!.kind).toBe('town');
    expect(m.walk!.node).toBe(b.id);
    expect(m.walk!.blocksLeft).toBe(blocks - 1);          // the route keeps the blocks it had left
    expect(m.cell!).toEqual({ q: a.q, r: a.r, sub: null, wild: null });
    // and the re-laid route crosses real cells, so no block is priced by a NaN distance
    expect(road.blocksBetweenHex(m.walk!.from, m.walk!.to)).toBe(m.walk!.blocksTotal);
  });

  it('a v11 walk naming a settlement that no longer exists is dropped, not left to compute NaN', () => {
    const s = newGame(93) as any;
    s.walk = { from: 'eastgate', to: 'a-town-that-is-gone', blocksTotal: 9, blocksLeft: 9, secLeft: 9, blocksWalked: 0 };
    const m = migrate(JSON.parse(JSON.stringify(s)), 11);
    expect(m.walk).toBeNull();
    expect(Number.isInteger(m.cell!.q)).toBe(true);
    expect(road.cellRank(m.cell!)).toBe(0);             // an old save could only ever stand in a town
  });
});

describe('offline time is AFK, not a second play session', () => {
  it('never spawns a boss while the player is away', () => {
    const s = newGame(41);
    huntZone(s, s.zone);
    setLevel(s, 60);
    const r = catchUp(s, 3600 * 3);
    expect(r.simulated).toBe(10800);
    expect(s.log.some((l) => /Boss spawn/.test(l.text))).toBe(false);
    expect(s.counters.kills).toBeGreaterThan(0);
  }, 30000);

  it('the away period does not advance the boss clock', () => {
    // bossDueAt is absolute clockSec, so away ticks used to satisfy it on the first online tick and
    // hand out a free boss. The remaining online time must be identical after the catch-up.
    const s = newGame(46);
    huntZone(s, s.zone);
    setLevel(s, 60);
    s.bossDueAt = s.clockSec + 1000;
    const remainingBefore = s.bossDueAt - s.clockSec;
    catchUp(s, 3600 * 3);
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
    // This test isolates offline loot quality, so its expedition carries the cooked provisions it needs
    // rather than measuring how quickly an unprepared run starves at this difficult zone.
    for (const food of E.fieldwork.foods.filter((row) => row.kind === 'cooked')) {
      s.fieldwork.foods[food.id] = E.inventory.stack_size.food;
    }
    // Tick until the away window has paid a drop, not for a guessed number of seconds: an ungeared
    // level-80 in zone 9 lands about twenty kills in four thousand ticks, so a fixed window made this
    // a coin flip on the 8% roll — and a fixed window is a time premise, which no test here may carry
    // (owner ruling · `AGENTS.md`). The cap below is a hang guard, never the measurement.
    for (let i = 0; i < 200000 && s.bag.length === 0; i++) tick(s, { online: false });
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
    for (const food of E.fieldwork.foods.filter((row) => row.kind === 'cooked')) {
      s.fieldwork.foods[food.id] = E.inventory.stack_size.food;
    }
    // tick until a piece above the floor level lands, not for a guessed window: a fixed window makes
    // this a coin flip on the drop roll (a time premise · AGENTS.md).
    const floorLevel = eng.floorLevelOf('high');
    for (let i = 0; i < 200000 && !s.bag.some((item) => item.ilvl > floorLevel); i++) tick(s, { online: true });
    expect(s.bag.some((item) => item.ilvl > floorLevel)).toBe(true);
  });
});

describe('salvage resource history', () => {
  it('records successful conversions without producing Alchemy milestones', () => {
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
    expect(s.fieldwork.materials.scrap).toBe((s.counters.salvaged || 0) * E.salvage.outputs.scrap);
    expect(s.alchemy.eligibleOutputs).toBe(0);
    expect(s.alchemy.paidMilestones).toBe(0);
  });
});

describe('the Reroll baseline survives a downgrade', () => {
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
  it('imports the previous v20 format without changing ledger, exploration or inventory', () => {
    const s = newGame(522);
    s.counters.gold = 123; s.fieldwork.materials.scrap = 7;
    const loaded = importJson(JSON.stringify({ version: 20, state: s }));
    expect(loaded.counters).toEqual(s.counters);
    expect(loaded.fieldwork).toEqual(s.fieldwork);
    expect(loaded.economy).toEqual(s.economy);
    expect(loaded.mapJournal).toEqual(s.mapJournal);
  });
  it('exports with a version and rejects a foreign one instead of converting', () => {
    const s = newGame(52);
    const text = exportJson(s);
    expect(JSON.parse(text).version).toBe(SCHEMA_VERSION);
    expect(importJson(text).player.level).toBe(s.player.level);
    expect(() => importJson(JSON.stringify({ version: 1, state: s }))).toThrow(/schema version 1/);
    expect(() => importJson(JSON.stringify({ state: s }))).toThrow(/schema version none/);
  });

  it('imports a v19 export, the format the milestone-ledger release wrote', () => {
    // v19 is a supported older save, so an
    // export at that version must migrate instead of being refused as foreign.
    const s = newGame(521);
    const loaded = importJson(JSON.stringify({ version: 19, state: s }));
    expect(loaded.player.level).toBe(s.player.level);
    expect(loaded.economy).toBeDefined();
  });

  it('rejects a future local schema before migration touches its state', () => {
    const future = structuredClone(newGame(520));
    const before = structuredClone(future);
    expect(() => migrate(future, SCHEMA_VERSION + 1)).toThrow(new RegExp(`schema version ${SCHEMA_VERSION + 1}`));
    expect(future).toEqual(before);
  });

  it('fills subsystems a older save never had', () => {
    const bare = { player: { level: 1 }, counters: { kills: 0 } } as any;
    const m = migrate(bare, 17);
    expect(m.presets.length).toBe(E.presets.sets);
    expect(m.grants.stash_tabs).toBe(0);
    expect(m.pedlar.minutes).toEqual([]);
    expect(m.collector.done).toEqual({});
  });

  it('backfills Camp encounter and help Standing state', () => {
    const old = newGame(541);
    delete (old.fieldwork as any).campEncounters;
    delete (old.town as any).helpCredit;
    const restored = migrate(old, 16);
    expect(restored.fieldwork.campEncounters).toMatchObject({
      policy: 'avoid', streamState: (541 ^ 0x43414d50) >>> 0, serial: 0, active: null,
    });
    expect(restored.town.helpCredit).toEqual({});
  });

  it('round-trips active Camp encounter state and aid credit', () => {
    const state = newGame(542);
    state.fieldwork.campEncounters = {
      ...state.fieldwork.campEncounters, policy: 'defend', serial: 3, exposureSec: 300,
      active: {
        id: 3, kind: 'traveler', stage: 'choice', origin: { q: 0, r: 0, sub: null, wild: null },
        warningSec: 0, choiceSec: 21, payload: { foodId: 'forest_nuts', amount: 2 },
        preparedGroup: [], participantIds: [],
      },
    };
    state.town.helpCredit['eastgate'] = 25;
    const restored = importJson(exportJson(state));
    expect(restored.fieldwork.campEncounters).toEqual(state.fieldwork.campEncounters);
    expect(restored.town.helpCredit).toEqual(state.town.helpCredit);
  });

  it('drops a corrupt Camp encounter without paying, spawning or clearing unrelated progress', () => {
    const state = newGame(543);
    state.fieldwork.campEncounters.serial = 4;
    state.fieldwork.campEncounters.active = {
      id: 4, kind: 'prowler', stage: 'warning', origin: { q: 0, r: 0, sub: null, wild: null },
      warningSec: 10, choiceSec: 45, payload: {}, preparedGroup: [] as any, participantIds: [],
    };
    state.town.helpCredit['eastgate'] = 8;
    const migrated = migrate(JSON.parse(JSON.stringify(state)));
    expect(migrated.fieldwork.campEncounters.active).toBeNull();
    expect(migrated.fieldwork.campEncounters.cooldownSec).toBeGreaterThan(0);
    expect(migrated.group).toEqual(state.group);
    expect(migrated.town.helpCredit['eastgate']).toBe(8);
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
    expect(m.autoDissolveLevel).toBe(eng.floorLevelOf('mid')); // the old keep-above-Common setting became the mid band's floor level
  });

  it('moves the keep-above setting onto the band floor the named Rarity sat on', () => {
    const rare = migrate(Object.assign(newGame(54) as any, { autoDissolveRarity: 'Rare' }), 8);
    expect(rare.autoDissolveLevel).toBe(eng.floorLevelOf('high'));
    expect((rare as any).autoDissolveRarity).toBeUndefined();
    // `off` was never a keep-above setting: the level stays where the save left it
    const off = migrate(Object.assign(newGame(55) as any, { autoDissolveRarity: 'off', autoDissolveLevel: 45 }), 8);
    expect(off.autoDissolveLevel).toBe(45);
  });

  it('carries the passive-tree ranks through an export and a load', () => {
    const s = newGame(56);
    setLevel(s, 40);
    expect(spendTreePoint(s, 'normal.str.s01').ok).toBe(true);
    expect(spendTreePoint(s, 'normal.str.s02').ok).toBe(true);
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
    expect(m.player.treePoints).toBe(tree.pointsAt(30, E.stat.level_cap));
  });

  it('pays the tree its own level ranges, so a level-cap character holds 390', () => {
    // v3's curve is the spec's rows, not a single rate: 3 base, 3 a level to 100, 1 a level to the cap
    expect(tree.currency('tree').per_level).toBeUndefined();
    expect(tree.currency('tree').level_ranges).toEqual([{ from: 2, to: 100, per: 3 }, { from: 101, to: 190, per: 1 }]);
    expect(tree.pointsAt(1, E.stat.level_cap)).toBe(3);
    expect(tree.pointsAt(100, E.stat.level_cap)).toBe(300);
    expect(tree.pointsAt(101, E.stat.level_cap)).toBe(301);
    expect(tree.pointsAt(E.stat.level_cap, E.stat.level_cap)).toBe(390);
  });

  it('raises an old save\'s tree points to the new rate, less what it spent', () => {
    // a save written under the old one-a-level rate: the bank is whatever it was, and the load
    // recomputes it from the level the character actually holds
    const old = newGame(59);
    setLevel(old, 40);
    expect(spendTreePoint(old, 'normal.str.s01').ok).toBe(true);
    old.player.treePoints = 3;
    const m = migrate(JSON.parse(JSON.stringify(old)));
    expect(m.player.treePoints).toBe(tree.pointsAt(40, E.stat.level_cap) - treePointsSpent(m));
  });

  it('refunds a rank on a retired tree node', () => {
    const s = newGame(62);
    setLevel(s, 40);
    // The current layout may have restored every legacy node. Supply an isolated retired key so
    // this still exercises the refund branch without requiring live content to remain retired.
    const retired = 'normal.legacy.refund-fixture';
    tree.retired.add(retired);
    try {
      s.player.treeRanks = { [retired]: 1 };
      const m = migrate(JSON.parse(JSON.stringify(s)));
      expect(m.player.treeRanks).toEqual({});
      expect(m.player.treePoints).toBe(tree.pointsAt(40, E.stat.level_cap));
    } finally { tree.retired.delete(retired); }
  });

  it('still wipes a build whose ranks outrun the level it is loaded at', () => {
    // the overflow rule is unchanged: a rank count the level cannot pay for is not a build
    const old = newGame(60);
    setLevel(old, 1);
    old.player.treeRanks = {
      'normal.str.s01': 1, 'normal.str.s02': 1, 'normal.str.s03': 1, 'normal.str.s04': 1,
    };
    const m = migrate(JSON.parse(JSON.stringify(old)));
    expect(m.player.treeRanks).toEqual({});
    expect(m.player.treePoints).toBe(tree.pointsAt(1, E.stat.level_cap));
  });

  it('moves a shared condition list onto the rows that were reading it', () => {
    // an old save kept one shared condition list for every conditional row and the shape is per row
    // now, so an existing rotation keeps firing: the rows that were gated inherit the list, the rows
    // that were not get none
    const s = JSON.parse(JSON.stringify(newGame(58)));
    s.skills.list[0] = 'attack.cleave';
    s.skills.list[1] = 'attack.fireball';
    s.skills.mode = { 'attack.cleave': 'conditional' };
    s.skills.conditions = { boss: true, hpBelowPct: 40, statusMissing: ['burn'] };
    const m = migrate(s);
    expect(m.skills.conditions['attack.cleave'])
      .toEqual({ boss: true, hpBelowPct: 40, statusMissing: ['burn'], minTargets: 0, manaFloorPct: 0,
        statusPresent: false, statusStacksAtLeast: 0, selfDebuffed: false });
    expect(m.skills.conditions['attack.fireball']).toBeUndefined();
    // and a save already on the per-row shape is left exactly as it was
    const kept = migrate(JSON.parse(JSON.stringify(m)));
    expect(kept.skills.conditions).toEqual(m.skills.conditions);
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

describe('an imported file cannot be an impossible state', () => {
  it('clamps the numbers a hand-edited file breaks and drops ids the collection does not know', () => {
    const s: any = JSON.parse(JSON.stringify(newGame(61)));
    s.zone = 999; // the live tick reads eng.zoneById(s.zone) — this used to throw every tick
    if (s.dungeon) s.dungeon.zone = 999;
    s.player.hp = 'abc';
    s.player.statPoints = 99999;
    s.player.treePoints = 99999;
    s.player.treeRanks['normal.str.s01'] = 1;
    s.fieldwork.hunger = 'abc';
    s.skills.list[0] = 'attack.nope';
    s.skills.owned['attack.nope'] = 0;
    s.skills.xp['attack.nope'] = 5;
    s.presets[1].list[0] = 'attack.nope';
    const m = migrate(s);
    expect(m.zone).toBe(eng.ZONES[0].id);
    expect(Number.isFinite(m.player.hp)).toBe(true);
    expect(m.player.statPoints).toBeLessThanOrEqual(eng.pointsAt(m.player.level));
    expect(m.player.treePoints).toBeLessThanOrEqual(tree.pointsAt(m.player.level, E.stat.level_cap));
    expect(m.player.treeRanks!['normal.str.s01']).toBe(1);
    expect(Number.isFinite(m.fieldwork.hunger)).toBe(true);
    expect(m.skills.list).not.toContain('attack.nope');
    expect(m.skills.owned['attack.nope']).toBeUndefined();
    expect(m.skills.xp['attack.nope']).toBeUndefined();
    expect(m.presets[1].list).not.toContain('attack.nope');
    // and the restored state still runs a live hunting tick
    huntZone(m, m.zone);
    expect(() => tick(m, { online: true })).not.toThrow();
  });

  it('refuses a tree rank the version does not know, by name', () => {
    const s: any = JSON.parse(JSON.stringify(newGame(63)));
    s.player.treeRanks['wing.nope'] = 1;
    expect(() => importJson(JSON.stringify({ version: SCHEMA_VERSION, state: s }))).toThrow(/wing\.nope/);
  });

  it('refuses an allocation holding both keystones of a listed pair', () => {
    const s: any = JSON.parse(JSON.stringify(newGame(64)));
    const pair = (tree as any).incompatibilities[0] as { a: string; b: string };
    s.player.treeRanks = { [pair.a]: 1, [pair.b]: 1 };
    expect(() => importJson(JSON.stringify({ version: SCHEMA_VERSION, state: s }))).toThrow(/incompatible/);
  });

  it('refuses a character built on another passive-tree version before migrating it', () => {
    const s: any = JSON.parse(JSON.stringify(newGame(65)));
    s.player.passiveTreeVersion = 2;
    const before = JSON.stringify(s);
    expect(() => importJson(JSON.stringify({ version: SCHEMA_VERSION, state: s }))).toThrow(/รุ่นเก่า/);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('turns auras off until the set obeys the reservation limit again', () => {
    const s: any = JSON.parse(JSON.stringify(newGame(62)));
    const ids = (sm.all() as any[]).filter((k) => k.type === 'aura' && k.reserve).map((k) => k.id);
    for (const id of ids) { s.skills.owned[id] = 0; s.skills.auras[id] = true; }
    const m = migrate(s);
    const held = Object.entries(m.skills.auras).filter(([, on]) => on)
      .reduce((t, [id]) => t + sm.reservePct((sm.byId as any)[id]?.reserve ?? ''), 0);
    expect(held).toBeLessThan(sm.RESERVATION_LIMIT);
  });
});
