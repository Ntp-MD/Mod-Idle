import { describe, it, expect, beforeEach } from 'vitest';
import { E, eng, loot } from '../src/engine/client';
import { newGame, tick, setLevel } from '../src/sim/game';
import { rollDrop } from '../src/sim/drop';
import { newFilter, ruleFor, setRule, refresh, describeRule, FILTER_SLOTS } from '../src/sim/filter';
import { mark, reason, arm, SAVE_CFG } from '../src/sim/snapshot';
import { mulberry32 } from '../src/engine/client-helpers';
import {
  writeSave, listSnapshots, restoreSnapshot, readAccount, SCHEMA_VERSION, exportJson, importJson,
} from '../src/state/save';
import type { Item } from '../src/sim/types';

const piece = (over: Partial<Item>): Item => ({
  slot: 'helmet', base: 'coif', ilvl: 1, quality: 'low', tier: 'T3', lines: [], q: 0, ...over,
});

describe('a drop carries its Element as a stored value', () => {
  it('puts an Element on every Elemental line and on nothing else', () => {
    const rng = mulberry32(7);
    let elemental = 0;
    for (let i = 0; i < 400; i++) {
      for (const l of rollDrop(rng, 'high', 61).lines) {
        if (l.id.startsWith('elemental_')) {
          expect(E.elements.order).toContain(l.element);
          elemental++;
        } else {
          expect(l.element ?? null).toBe(null);
        }
      }
    }
    expect(elemental).toBeGreaterThan(0);
  });
});

describe('the bag filter reads per-slot thresholds', () => {
  it('starts every slot off, with the published margin ready when it is turned on', () => {
    const f = newFilter();
    for (const slot of FILTER_SLOTS) {
      const r = ruleFor(f, slot);
      expect(r.enabled).toBe(false); //: no slot filters until the player turns it on
      expect(r.margin_pct).toBe(E.loot.filter.upgrade_margin_pct);
      expect(r.keep_missing_element).toBe(true);
    }
  });

  it('a raised margin dissolves the piece the default keeps, and only on that slot', () => {
    const f = newFilter();
    setRule(f, 'helmet', { margin_pct: 900 });
    const wornScore = loot.score(piece({ lines: [{ id: 'max_hp_flat', value: 40, slice: 0 }] }));
    const better = piece({ lines: [{ id: 'max_hp_flat', value: 78, slice: 0 }] });
    const margin = E.loot.filter.upgrade_margin_pct / 100;
    expect(loot.keepsDrop(better, wornScore, new Set(), margin, ruleFor(f, 'helmet')).keep).toBe(false);
    expect(loot.keepsDrop(better, wornScore, new Set(), margin, ruleFor(f, 'chest')).keep).toBe(true);
  });

  it('keeps an Element the player cannot resist, and stops once one is worn', () => {
    const withFire = piece({ lines: [{ id: 'elemental_resistance', value: 20, slice: 1, element: 'fire' }] });
    const none = new Set<string>();
    const fire = new Set(['fire']);
    expect(loot.keepsDrop(withFire, 999, none, 0.1, ruleFor(newFilter(), 'helmet')).reason).toBe('element');
    expect(loot.keepsDrop(withFire, 999, fire, 0.1, ruleFor(newFilter(), 'helmet')).reason).toBe('dissolve');
    const off = ruleFor(setRule(newFilter(), 'helmet', { keep_missing_element: false }), 'helmet');
    expect(loot.keepsDrop(withFire, 999, none, 0.1, off).reason).toBe('dissolve');
  });

  it('stores the keep-list as what the character actually lacks', () => {
    const s = newGame(11);
    s.gear[0] = piece({ slot: 'helmet', lines: [{ id: 'elemental_resistance', value: 10, slice: 1, element: 'cold' }] });
    const missing = refresh(s);
    expect(missing.elements).not.toContain('cold');
    expect(missing.elements).toContain('fire');
    // minute one is dressed in the junk set, so there is no hole to report; the list exists for a slot
    // the player strips — which is what this makes
    expect(missing.slots).not.toContain('helmet');
    s.gear[loot.SLOTS.indexOf('chest')] = null;
    expect(refresh(s).slots).toContain('chest');
    setRule(s.filter, 'helmet', { enabled: true });
    expect(describeRule(ruleFor(s.filter, 'helmet'))).toMatch(/\+10% to keep/);
  });

  it('runs on the live state during a fight without throwing', () => {
    const s = newGame(12);
    setLevel(s, 70);
    setRule(s.filter, 'helmet', { margin_pct: 40 });
    // Tick until the state under test exists, never for a guessed window: a fixed window is a time
    // premise (AGENTS.md) and a coin flip on the roll it is waiting for. The bound is a hang guard.
    for (let i = 0; i < 40000 && s.counters.drops === 0; i++) tick(s, {});
    expect(s.counters.drops).toBeGreaterThan(0);
  });
});

describe('three walking snapshots', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
    };
  });

  it('marks the triggers the data lists, and ignores the ones it does not', () => {
    const s = newGame(21);
    mark(s, 'level');
    expect(s.pendingSnapshot).toBe('level');
    arm(s);
    expect(s.pendingSnapshot).toBe(null);
    expect(s.nextSnapshotAt).toBe(SAVE_CFG.snapshot_interval_min * 60);
    mark(s, 'push');
    expect(s.pendingSnapshot).toBe(null);
    expect(SAVE_CFG.snapshot_triggers).toEqual(['level', 'ascend', 'refine']);
  });

  it('owes a timer snapshot every configured minutes', () => {
    const s = newGame(22);
    expect(reason(s)).toBe('timer'); // nothing taken yet, so the first save is owed
    arm(s);
    s.clockSec = SAVE_CFG.snapshot_interval_min * 60 - 1;
    expect(reason(s)).toBe(null);
    s.clockSec++;
    expect(reason(s)).toBe('timer');
    mark(s, 'refine');
    expect(reason(s)).toBe('refine'); // an event beats the timer
  });

  it('stores a snapshot outside the file it protects, newest first, capped at three', async () => {
    const s = newGame(23);
    for (let i = 0; i < 5; i++) {
      mark(s, 'level');
      s.clockSec += 60;
      await writeSave('slot1', s);
    }
    const snaps = await listSnapshots('slot1');
    expect(snaps.length).toBe(SAVE_CFG.snapshot_slots);
    expect(snaps[0].clockSec).toBeGreaterThan(snaps[snaps.length - 1].clockSec);
    expect(snaps[0].reason).toBe('level');
    // the timer is armed from the moment the snapshot was taken, not from zero
    expect(s.nextSnapshotAt).toBe(s.clockSec + SAVE_CFG.snapshot_interval_min * 60);
  });

  it('rewinds the whole character and rebuilds the shared record', async () => {
    const s = newGame(24);
    s.mastery = { sword: 400 };
    mark(s, 'level');
    await writeSave('slot1', s);
    const before = (await listSnapshots('slot1'))[0];

    setLevel(s, 90);
    s.counters.gold += 5000;
    s.counters.stones.reroll_value = 800;
    s.mastery = { sword: 900 };
    mark(s, 'ascend');
    await writeSave('slot1', s);
    const account = await readAccount();
    expect(account.mastery.sword).toBe(900);

    // newest first, so the pre-craft backup sits one place down after the second save
    const newest = (await listSnapshots('slot1'))[0];
    expect(newest.state.player.level).toBe(90);
    const back = await restoreSnapshot('slot1', 1);
    expect(back).not.toBe(null);
    expect(back!.player.level).toBe(before.state.player.level);
    expect(back!.counters.gold).toBe(before.state.counters.gold);
    expect(back!.counters.stones.reroll_value ?? 0).toBe(0);
    // the account is derived from the slot files again, so the shared half rewinds with the slot
    const after = await readAccount();
    expect(after.mastery.sword).toBe(400);
  });

  it('takes a level-up snapshot while the sim runs, and keeps the save on the current version', async () => {
    const s = newGame(25);
    s.player.xp = eng.xpToNext(1) * 3;
    let ticks = 0;
    while (s.player.level === 1 && ticks < 4000) { tick(s, {}); ticks++; }
    if (s.player.level > 1) expect(s.pendingSnapshot).toBe('level');
    await writeSave('slot2', s);
    expect(JSON.parse((globalThis as any).localStorage.getItem('modworld:slot2')!).version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(11);
    const round = importJson(exportJson(s));
    expect(round.filter).toBeTruthy();
    expect(round.pendingSnapshot).toBe(null);
  });
});
