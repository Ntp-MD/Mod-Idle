import { describe, it, expect, beforeEach } from 'vitest';
import { E, eng, loot } from '../src/engine/client';
import { newGame, tick, setLevel, huntZone, adjudicateDrop, runFilterNow } from '../src/sim/game';
import { openingGear } from '../src/sim/player';
import { autoEquip } from '../src/sim/gear';
import { wants } from '../src/sim/collector';
import { rollDrop } from '../src/sim/drop';
import { newFilter, ruleFor, setRule, refresh, describeRule, FILTER_SLOTS, presetSlots, savePreset, loadPreset, clearPreset } from '../src/sim/filter';
import { slotsAvailable, slotsUsed } from '../src/sim/slots';
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
      for (const l of rollDrop(rng, 'high', eng.floorLevelOf('high')).lines) {
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
  it('compares a new drop with worn gear, never a stronger piece waiting in the bag', () => {
    const s = newGame(10);
    s.gear = openingGear();
    setRule(s.filter, 'ring', { enabled: true, margin_pct: 0 });
    const ring = (value: number) => piece({ slot: 'ring', base: 'Iron Band', lines: [{ id: 'all_stat_flat', value, slice: 1 }] });
    const waiting = ring(30);
    const incoming = ring(10);
    const worn = s.gear.find((g) => g?.slot === 'ring')!;
    expect(loot.score(incoming)).toBeGreaterThan(loot.score({ ...worn, q: worn.q ?? 0 }));
    expect(loot.score(waiting)).toBeGreaterThan(loot.score(incoming));
    s.bag = [waiting];
    adjudicateDrop(s, incoming);
    expect(s.bag).toContain(incoming);
  });

  it('keeps the weakest kept piece and leaves the drop unpicked when the swap cannot dissolve it', () => {
    const s = newGame(10);
    s.gear = openingGear();
    setRule(s.filter, 'ring', { enabled: true, margin_pct: 0 });
    const ring = (value: number) => piece({ slot: 'ring', base: 'Iron Band', lines: [{ id: 'all_stat_flat', value, slice: 1 }] });
    const kept = ring(10);
    const incoming = ring(30);
    const worn = s.gear.find((g) => g?.slot === 'ring')!;
    expect(loot.score(incoming)).toBeGreaterThan(loot.score({ ...worn, q: worn.q ?? 0 }));
    // a full bag forces the swap path, and the ore key already at its cap makes the dissolve bundle
    // not fit: the swap must refuse rather than silently delete the loser
    s.fieldwork.materials['iron-ore'] = E.inventory.stack_size.material;
    s.bag = [kept];
    while (slotsUsed(s) < slotsAvailable(s)) s.bag.push(ring(40));
    const overflow = s.counters.overflow || 0;
    const stopped = s.counters.stopped || 0;
    const salvaged = s.counters.salvaged || 0;
    adjudicateDrop(s, incoming);
    expect(s.bag).toContain(kept);
    expect(s.bag).not.toContain(incoming);
    expect(s.counters.overflow).toBe(overflow + 1);
    expect(s.counters.stopped).toBe(stopped + 1);
    expect(s.counters.salvaged || 0).toBe(salvaged);
    expect(s.fieldwork.materials.scrap || 0).toBe(0);
    // once the ore and scrap keys already hold room under their cap, the dissolve bundle costs no new
    // slot, so the same drop swaps even on a full bag: the loser dissolves and the incoming piece lands
    s.bag.pop();
    s.fieldwork.materials['iron-ore'] = 5;
    s.fieldwork.materials.scrap = 5;
    adjudicateDrop(s, incoming);
    expect(s.bag).toContain(incoming);
    expect(s.bag).not.toContain(kept);
    expect(s.fieldwork.materials['iron-ore']).toBe(6);
    expect(s.fieldwork.materials.scrap).toBe(6);
  });

  it('keeps a Collector-wanted upgrade available for Auto Equip', () => {
    const s = newGame(10);
    s.gear = openingGear();
    const drop = Array.from({ length: 100 }, (_, i) => rollDrop(mulberry32(i + 1), 'low', E.item_level.spans[0].from))
      .find((item) => wants(s, item) && s.gear.some((g) => g?.slot === item.slot
        && loot.score(item) > loot.score({ ...g, q: g.q ?? 0 })));
    expect(drop).toBeDefined();
    adjudicateDrop(s, drop!);
    expect(s.bag).toContain(drop);
    expect(drop!.heldFor).toBeUndefined();
    expect(autoEquip(s).swaps).toHaveLength(1);
  });

  it('starts every slot off, with the published margin ready when it is turned on', () => {
    const f = newFilter();
    for (const slot of FILTER_SLOTS) {
      const r = ruleFor(f, slot);
      expect(r.enabled).toBe(false); // no slot filters until the player turns it on
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
    huntZone(s, s.zone);
    setLevel(s, 70);
    setRule(s.filter, 'helmet', { margin_pct: 40 });
    // Tick until the state under test exists, never for a guessed window: a fixed window is a time
    // premise (AGENTS.md) and a coin flip on the roll it is waiting for. The bound is a hang guard.
    for (let i = 0; i < 40000 && s.counters.drops === 0; i++) tick(s, {});
    expect(s.counters.drops).toBeGreaterThan(0);
  });
});

describe('the filter keeps presets like settings, not like drops', () => {
  it('stores a whole rule table and loads it back with the keep-list re-read', () => {
    const s = newGame(30);
    expect(s.filterPresets).toEqual([]);
    setRule(s.filter, 'helmet', { enabled: true, margin_pct: 25, keep_missing_element: false });
    expect(savePreset(s, 0)).toBe(true);
    expect(s.filterPresets[0]?.bySlot.helmet).toEqual({ enabled: true, margin_pct: 25, keep_missing_element: false });
    // the live table moves on, then a load puts the stored one back and nothing else about the bag moves
    setRule(s.filter, 'chest', { enabled: true });
    const bagBefore = [...s.bag];
    expect(loadPreset(s, 0)).toBe(true);
    expect(ruleFor(s.filter, 'helmet')).toEqual({ enabled: true, margin_pct: 25, keep_missing_element: false });
    expect(ruleFor(s.filter, 'chest')).toEqual(ruleFor(newFilter(), 'chest'));
    expect(s.bag).toEqual(bagBefore);
  });

  it('one slot is the character’s own; a Collector set pays exactly one more, never two', () => {
    const s = newGame(31);
    expect(s.filterPresets).toEqual([]);
    expect(savePreset(s, 1)).toBe(false);
    s.grants.filter_presets = 2;
    expect(savePreset(s, 1)).toBe(true);
    expect(savePreset(s, 2)).toBe(true);
    expect(savePreset(s, 3)).toBe(false);
    expect(presetSlots(s)).toBe(3);
    clearPreset(s, 1);
    expect(s.filterPresets[1]).toBe(null);
  });

  it('rides a save round trip, and an older save gains an empty list instead of an undefined one', () => {
    const s = newGame(32);
    savePreset(s, 0);
    const round = importJson(exportJson(s));
    expect(round.filterPresets[0]?.bySlot.helmet).toEqual(ruleFor(s.filter, 'helmet'));
    const raw = JSON.parse(exportJson(s));
    delete (raw.state as any).filterPresets;
    expect(importJson(JSON.stringify(raw)).filterPresets).toEqual([]);
    // a hand-edited row is read as a rule table or dropped, and its numbers come back in bounds
    const mess = JSON.parse(exportJson(s));
    (mess.state as any).filterPresets = [{ bySlot: { helmet: { enabled: 1, margin_pct: -5, keep_missing_element: 'yes' } } }, 'junk', null];
    const safe = importJson(JSON.stringify(mess));
    expect(safe.filterPresets[0]?.bySlot.helmet).toEqual({ enabled: true, margin_pct: 0, keep_missing_element: true });
    expect(safe.filterPresets[1]).toBe(null);
    expect(safe.filterPresets[2]).toBe(null);
  });
});

describe('running the filter over the bag is the one verdict, at scale', () => {
  const helm = (value: number, over: Partial<Item> = {}): Item =>
    piece({ slot: 'helmet', base: 'coif', lines: [{ id: 'max_hp_flat', value, slice: 0 }], ...over });

  it('melts the pieces a fresh drop would have dissolved and spares the locked and held ones', () => {
    const s = newGame(10);
    setRule(s.filter, 'helmet', { enabled: true, margin_pct: 0 });
    s.gear[loot.SLOTS.indexOf('helmet')] = helm(40);
    const strong = helm(78);
    const lockedWeak = helm(10, { locked: true });
    const heldWeak = helm(10, { heldFor: 'ram_school' });
    s.bag = [helm(10), helm(11), strong, lockedWeak, heldWeak];
    const r = runFilterNow(s);
    expect(r.dissolved).toBe(2);
    expect(r.spared).toBe(2);
    expect(s.bag).toEqual([strong, lockedWeak, heldWeak]);
    expect(s.counters.salvaged).toBe(2);
    expect(s.fieldwork.materials['iron-ore']).toBe(2);
    expect(s.fieldwork.materials.scrap).toBe(2);
  });

  it('dissolves nothing when the filter is off, and refuses a half job when the bundle will not fit', () => {
    const s = newGame(10);
    s.gear[loot.SLOTS.indexOf('helmet')] = helm(40);
    s.bag = [helm(10), helm(41)];
    // the filter is off, so no slot has a rule to fail and no piece melts
    expect(runFilterNow(s).dissolved).toBe(0);
    expect(s.bag).toHaveLength(2);
    // a full bag cannot take the next salvage bundle, so the press refuses rather than melting part
    setRule(s.filter, 'helmet', { enabled: true, margin_pct: 0 });
    s.bag = [helm(10), helm(10)];
    while (slotsUsed(s) < slotsAvailable(s)) s.bag.push(helm(41));
    const r = runFilterNow(s);
    expect(r.dissolved).toBe(0);
    expect(r.why).toBeTruthy();
    expect(s.bag.filter((it) => it.lines[0]?.value === 10)).toHaveLength(2);
    expect(s.counters.salvaged || 0).toBe(0);
  });
});

describe('walking snapshots', () => {
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
    // the list is data: the trigger this test arms is on it, the one it does not is not
    expect(SAVE_CFG.snapshot_triggers).toContain('level');
    expect(SAVE_CFG.snapshot_triggers).not.toContain('push');
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

  it('stores a snapshot outside the file it protects, newest first, capped at the data slot count', async () => {
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
    expect(SCHEMA_VERSION).toBe(17);
    const round = importJson(exportJson(s));
    expect(round.filter).toBeTruthy();
    expect(round.pendingSnapshot).toBe(null);
  });
});
