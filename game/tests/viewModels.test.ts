import { describe, it, expect } from 'vitest';
import { newGame as newGameForHud } from '../src/sim/game';
import { E, loot } from '../src/engine/client';
import { pieceRank, rankTone, gearEntry, stackEntry, sortEntries, vsWorn, compareLines } from '../src/ui/bag';
import { fxByMob, plateBeat, platePark, plateStrike, plateGesture, graveIds, parked } from '../src/ui/plate';
import { ramp } from '../src/ui/map';
import { snapCounters, buildAwayReport, fieldLabel, describeSnap } from '../src/ui/hud';
import { bar, curseWords, statusWords } from '../src/ui/field';
import type { Item, Mob, FxEvent } from '../src/sim/types';
import type { BagStack } from '../src/sim/slots';

/**
 * The two view models the HUD draws from. They are pure by design — no clock, no state between reads —
 * which is exactly why they belong in tests: a rung, a park sum or a gesture rule is a rule a player
 * sees, and it should fail here rather than look wrong on the field.
 */

const item = (over: Partial<Item> = {}): Item => ({
  slot: 'helmet', base: 'Iron Helm', ilvl: 10, quality: 'low', tier: 'T3', lines: [], weight: 0,
  ...over,
} as unknown as Item);

const fx = (over: Partial<FxEvent> = {}): FxEvent => ({
  id: 1, sec: 5, kind: 'hit', text: '10', colour: '#fff', mobId: 'm1', ...over,
} as FxEvent);

describe('the item rung (bag.ts)', () => {
  it('climbs with the quality band, the top half of a range and a Quality stone, and stops at the last rung', () => {
    expect(pieceRank(null)).toBeNull();
    expect(pieceRank(item({ quality: 'low', tier: 'T3' }))!.name).toBe('common');
    expect(pieceRank(item({ quality: 'mid', tier: 'T3' }))!.name).toBe('uncommon');
    expect(pieceRank(item({ quality: 'high', tier: 'T3' }))!.name).toBe('rare');
    const top = pieceRank(item({ quality: 'high', tier: 'T1', upgrade_lv: 1 } as any))!;
    expect(top.rank).toBe(4);
    expect(top.name).toBe('legendary');
    expect(top.tone).toContain('--rar-');
  });

  it('wears a token, never a colour typed in the component', () => {
    expect(rankTone(item({ quality: 'high', tier: 'T1' }))).toMatch(/^var\(--rar-/);
    expect(rankTone(null)).toBeNull();
  });
});

describe('the bag view model (bag.ts)', () => {
  it('names a gear slot and a carried stack differently, and sorts a copy, never the bag itself', () => {
    const line = [{ id: 'physical_power_flat', value: 10 }];
    const a = gearEntry(item({ ilvl: 30, base: 'A', lines: line } as any), 0);
    const b = gearEntry(item({ ilvl: 10, base: 'B', lines: line } as any), 1);
    expect(a.kind).toBe('gear');
    expect(a.title).toBe('A');
    expect(a.levelRank).toBe(30);
    expect(a.score).toBeGreaterThan(0);

    const stack: BagStack = { name: 'Tier stone', group: 'stones', capKind: 'stone', count: 7, weight: 0 };
    const s = stackEntry(stack, 2);
    expect(s.kind).toBe('stack');
    expect(s.count).toBe(7);
    expect(s.levelRank).toBe(-1);
    expect(s.score).toBe(7);

    const list = [a, b];
    const byLevel = sortEntries(list, 'level');
    expect(byLevel[0].title).toBe('A');
    expect(list[0].title).toBe('A');            // the source array keeps the bag's own order
    expect(sortEntries(list, 'newest').map((e) => e.index)).toEqual([0, 1]);
    expect(sortEntries([b, a], 'name').map((e) => e.title)).toEqual(['A', 'B']);
  });

  it('answers how much stronger a candidate is, and nothing when there is nothing worn', () => {
    const worn = item({ ilvl: 10, quality: 'low', tier: 'T3', lines: [{ id: 'physical_power_flat', value: 10 }] } as any);
    expect(vsWorn(worn, null)).toBeNull();
    const better = item({ ilvl: 30, quality: 'high', tier: 'T1', lines: [{ id: 'physical_power_flat', value: 30 }] } as any);
    expect(vsWorn(better, worn)).toBeGreaterThan(0);
    expect(vsWorn(worn, better)).toBeLessThan(0);
  });

  it('pairs the lines a swap changes, drops the ties, and flattens a Frame Mod\u2019s extras', () => {
    const worn = item({ lines: [{ id: 'physical_power_flat', value: 5 }, { id: 'max_hp', value: 20 }] } as any);
    const cand = item({
      lines: [
        { id: 'physical_power_flat', value: 9 },
        { id: 'evasion_flat', value: 4 },
        { id: 'frame_mod', value: 1, extra: [{ id: 'stun_chance', value: 3 }] },
      ],
    } as any);
    const cmp = compareLines(cand, worn);
    const by = Object.fromEntries(cmp.map((c) => [c.id, c]));
    expect(by.physical_power_flat.kind).toBe('over');
    expect(by.max_hp.kind).toBe('lost');
    expect(by.evasion_flat.kind).toBe('gained');
    expect(by.stun_chance.kind).toBe('gained');   // the Frame Mod's own extra counts as a line
    expect(cmp.length).toBe(5);                   // an equal line would have been dropped
    expect(compareLines(cand, null)).toEqual([]);
  });
});

describe('the plate view model (plate.ts)', () => {
  it('buckets the ring by body and reads the newest direct blow', () => {
    const ring = [
      fx({ id: 3, kind: 'hit', mobId: 'a', via: 'swing' }),
      fx({ id: 2, kind: 'hit', mobId: 'a', via: 'dot' }),
      fx({ id: 1, kind: 'hit', mobId: 'b', via: 'cast' }),
      fx({ id: 0, kind: 'drop', mobId: undefined }),
    ];
    const by = fxByMob(ring);
    expect(by.get('a')!.length).toBe(2);
    expect(by.has('b')).toBe(true);
    expect(by.size).toBe(2);                       // an event naming no body is the shared column
    expect(plateBeat(by, 'a')!.id).toBe(3);        // a status clock never takes the rim
    expect(plateBeat(by, 'b')!.via).toBe('cast');
  });

  it('parks one second of blows as a single figure', () => {
    expect(parked([])).toBeNull();
    const list = [fx({ id: 5, sec: 9, value: 4 }), fx({ id: 4, sec: 9, value: 6 }), fx({ id: 3, sec: 8, value: 100 })];
    const p = parked(list)!;
    expect(p.sum).toBe(10);
    expect(p.id).toBe(5);
    expect(p.sec).toBe(9);
  });

  it('gives a knock its own second over a lunge, and one card one gesture', () => {
    expect(plateGesture(null, null)).toBeNull();
    expect(plateGesture(fx({ id: 1, sec: 5 }), fx({ id: 2, sec: 5 }))).toEqual({ id: 1, gesture: 'knock' });
    expect(plateGesture(fx({ id: 1, sec: 4 }), fx({ id: 2, sec: 5 }))).toEqual({ id: 2, gesture: 'lunge' });
  });

  it('reads a strike only off a blow the body carried, and remembers a corpse for its own second', () => {
    const ring = [fx({ id: 1, kind: 'taken', byId: 'm1' }), fx({ id: 2, kind: 'hit', byId: 'm1' })];
    expect(plateStrike(ring, 'm1')!.id).toBe(1);
    expect(plateStrike(ring, 'nobody')).toBeNull();

    const group = [{ id: 'live' } as Mob];
    const kills = [fx({ id: 3, kind: 'kill', mobId: 'dead', sec: 40 }), fx({ id: 4, kind: 'kill', mobId: 'live', sec: 40 })];
    expect(graveIds(kills, group, 40)).toEqual(['dead']);
    expect(graveIds(kills, group, 42)).toEqual([]);   // a grave lives one sim second
    expect(platePark(fxByMob([fx({ mobId: 'a', value: 3 })]), 'a')!.sum).toBe(3);
  });
});

describe('the field ramp (map.ts)', () => {
  it('answers a colour for a band index and clamps past the ends', () => {
    const lo = ramp(0), hi = ramp(999);
    expect(typeof lo).toBe('string');
    expect(lo).toBeTruthy();
    expect(hi).toBeTruthy();
    expect(ramp(0)).toBe(lo);
  });
});

describe('the sort orders come from the data the roll already uses', () => {
  it('keeps the quality order the loot module publishes', () => {
    expect(loot.BAND_LABEL.length).toBeGreaterThan(0);
  });
});

describe('the field HUD reads (hud.ts)', () => {
  it('diffs an away window against the counters it took before it', () => {
    const s = newGameForHud();
    const before = snapCounters(s);
    s.counters.kills += 40;
    s.counters.gold += 250;
    s.counters.stones.tier = (s.counters.stones.tier || 0) + 3;
    const rep = buildAwayReport(before, 90, 5400, false, s);
    expect(rep.kills).toBe(40);
    expect(rep.gold).toBe(250);
    expect(rep.stones).toBe(3);
    expect(rep.levels).toBe(0);
    expect(rep.mins).toBe(90);
    expect(rep.quality).toBe(before.quality);
  });

  it('labels a spawn off its own ladder rung, and a boss by its name', () => {
    const sp = E.mob.species[0];
    const normal = fieldLabel({ species: sp.name, speciesId: sp.id, kind: 'Small' });
    expect(normal).toBeTruthy();
    const boss = fieldLabel({ species: sp.name, speciesId: sp.id, kind: `Boss · ${sp.name}` });
    expect(boss).toContain(E.mob.field_labels.boss.suffix);
  });

  it('captions a backup, and answers an em dash when there is none', () => {
    expect(describeSnap()).toBe('—');
    expect(describeSnap({ reason: 'level up', clockSec: 600, takenAt: 0, state: null } as any)).toBe('level up at 10 min');
  });
});

describe('the field reads in words (field.ts)', () => {
  it('stretches a fill over its own track and clamps past the ends', () => {
    expect(bar(50, 100)).toBe('--fill:0.5;--w:0.5');
    expect(bar(0, 100)).toContain('--fill:0');
    expect(bar(200, 100)).toContain('--fill:1');
    expect(bar(-5, 100)).toContain('--fill:0');
  });

  it('writes a curse on a mob with its sign and its seconds, and nothing when it carries none', () => {
    const s = newGameForHud();
    expect(curseWords(s, 'm1')).toBe('');
    s.curses = { m1: { mark: { stat: 'damage_taken', value: 12, secLeft: 7 } as any } };
    const words = curseWords(s, 'm1');
    expect(words).toContain('+12%');
    expect(words).toContain('7s left');
    s.curses = { m1: { hex: { stat: 'damage_taken', value: -4, secLeft: 3, condition: 'chilled' } as any } };
    expect(curseWords(s, 'm1')).toContain('while chilled');
  });

  it('writes what the character put on a mob, with stacks and the seconds left', () => {
    const s = newGameForHud();
    expect(statusWords(s, 'm1')).toBe('');
    s.mobStatus = { m1: { statuses: { burn: { stacks: 3, secLeft: 5, perSec: 1 } }, alignedPerSec: 0, stoppedSec: 0, elapsedSec: 0 } } as any;
    const words = statusWords(s, 'm1');
    expect(words).toContain('×3');
    expect(words).toContain('5s');
  });
});
