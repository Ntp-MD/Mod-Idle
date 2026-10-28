import { describe, expect, it, vi, afterEach } from 'vitest';
import { createFieldwork } from '@engine/fieldwork';
import { fieldwork } from '../../src/engine/client';
import { newGame, tick } from '@sim/core/game';
import { currentCell, rankOf } from '@sim/world/road';
import { hexDistance, hexKey, MAP_EXPLORATION, normalizeMapJournal, tickTrailSites, trailSites } from '@sim/world/map-exploration';
import { exportJson, importJson, migrate } from '../../src/state/save';
import { adventureView } from '../../src/ui/map/map-adventure';

const cfg = MAP_EXPLORATION.spawn;
const prepared = (seed = 734) => {
  const s = newGame(seed), feet = currentCell(s);
  for (let q = -cfg.radius; q <= cfg.radius; q++) for (let r = -cfg.radius; r <= cfg.radius; r++) {
    const cell = { q: feet.q + q, r: feet.r + r };
    if (hexDistance(feet, cell) <= cfg.radius && rankOf(cell) > 1) s.mapJournal!.visited.push(hexKey(cell));
  }
  return s;
};
const advance = (s: ReturnType<typeof newGame>, seconds: number, online = true) => {
  for (let n = 0; n < seconds; n++) tickTrailSites(s, online);
};

afterEach(() => vi.restoreAllMocks());

describe('realtime trail events', () => {
  it('rolls both configured event kinds and the candidate cell using independent draws', () => {
    const factory = createFieldwork(fieldwork.F);
    const cells = [{ q: 2, r: -2 }, { q: -2, r: 0 }];
    expect(factory.rollTrailSite(cells, () => 1)).toBeNull();
    expect(factory.rollTrailSite(cells, () => 0)).toMatchObject({ ...cells[0], kind: 'abandoned-camp' });
    const draws = [0, 0.99, 0.99];
    expect(factory.rollTrailSite(cells, () => draws.shift()!)).toMatchObject({ ...cells[1], kind: 'provision-caravan' });
    expect(factory.rollTrailSite([], () => { throw new Error('No empty-pool RNG draw'); })).toBeNull();
  });

  it('starts with no authored sites and pauses timers, sites and RNG offline or in a read-only tab', () => {
    const s = prepared();
    expect(trailSites(s)).toEqual([]);
    s.mapJournal!.trail!.serial = 1;
    s.mapJournal!.trail!.sites.push({ id: 'trail-1', q: 2, r: -2, kind: 'abandoned-camp', remainingSec: cfg.lifetime_sec });
    const before = structuredClone(s.mapJournal);
    advance(s, cfg.check_interval_sec * 2, false);
    expect(s.mapJournal).toEqual(before);
    tick(s, { writer: false });
    expect(s.mapJournal).toEqual(before);
    tick(s, { online: false });
    expect(s.mapJournal).toEqual(before);
  });

  it('checks on the saved schedule, limits occupancy and expires sites before permitting replacement', () => {
    const s = prepared();
    vi.spyOn(fieldwork, 'rollTrailSite').mockImplementation((cells: unknown) => ({ ...(cells as { q: number; r: number }[])[0], kind: 'provision-caravan' }));
    advance(s, cfg.check_interval_sec - 1);
    expect(trailSites(s)).toEqual([]);
    tick(s, { online: true });
    expect(trailSites(s)).toHaveLength(1);
    const first = trailSites(s)[0];
    expect(s.mapJournal!.visited).toContain(hexKey(first));
    expect(rankOf(first)).toBeGreaterThan(1);
    expect(hexDistance(first, currentCell(s))).toBeLessThanOrEqual(cfg.radius);
    expect(hexDistance(first, currentCell(s))).toBeGreaterThan(0);
    advance(s, cfg.check_interval_sec * cfg.max_active);
    expect(trailSites(s)).toHaveLength(cfg.max_active);
    expect(new Set(trailSites(s).map(hexKey)).size).toBe(trailSites(s).length);
    first.remainingSec = 1;
    s.mapJournal!.trail!.checkInSec = cfg.check_interval_sec;
    advance(s, 1);
    expect(trailSites(s).some(site => site.id === first.id)).toBe(false);
    const cell = { ax: hexKey(first), q: first.q, r: first.r, town: null, sub: false };
    expect(adventureView(s, [cell]).placements.some(p => p.ax === cell.ax && p.cls.startsWith('map-trail-site'))).toBe(false);
  });

  it('never places events on the player Camp or on unvisited ground', () => {
    const s = prepared(), key = s.mapJournal!.visited.find(key => key !== hexKey(currentCell(s)))!;
    const [q, r] = key.split(',').map(Number);
    s.mapJournal!.visited = [key];
    s.fieldwork.camp = { cell: { q, r, sub: null, wild: null }, zone: s.zone } as typeof s.fieldwork.camp;
    const roll = vi.spyOn(fieldwork, 'rollTrailSite');
    advance(s, cfg.check_interval_sec);
    expect(roll).not.toHaveBeenCalled();
    expect(trailSites(s)).toEqual([]);
    s.fieldwork.camp = null; s.mapJournal!.visited = [hexKey(currentCell(s))];
    advance(s, cfg.check_interval_sec);
    expect(roll).not.toHaveBeenCalled();
  });

  it('resumes exactly after export/import and never consumes combat RNG', () => {
    const a = prepared(), rng = a.rngState;
    advance(a, cfg.check_interval_sec * 8 + 7);
    expect(trailSites(a).length).toBeGreaterThan(0);
    const other = prepared(874);
    advance(other, cfg.check_interval_sec * 8 + 7);
    expect(trailSites(other)).not.toEqual(trailSites(a));
    const b = importJson(exportJson(a));
    expect(b.mapJournal!.trail).toEqual(a.mapJournal!.trail);
    advance(a, cfg.lifetime_sec); advance(b, cfg.lifetime_sec);
    expect(b.mapJournal!.trail).toEqual(a.mapJournal!.trail);
    expect(a.rngState).toBe(rng);
    const first = newGame(734, 1), second = newGame(734, 2);
    expect(first.mapJournal!.trail!.streamState).not.toBe(second.mapJournal!.trail!.streamState);
    expect(first.rngState).toBe(second.rngState);
  });

  it('backfills old saves without repeating authored rewards and rejects invalid future versions and sites', () => {
    const s = prepared(), legacyId = MAP_EXPLORATION.retired_site_ids[0];
    delete s.mapJournal!.trail;
    s.mapJournal!.claimedSites = [legacyId];
    const foods = structuredClone(s.fieldwork.foods), gold = s.counters.gold;
    migrate(s, 17);
    expect(trailSites(s)).toEqual([]);
    expect(s.mapJournal!.claimedSites).toContain(legacyId);
    expect(s.fieldwork.foods).toEqual(foods);
    expect(s.counters.gold).toBe(gold);
    expect(() => migrate(structuredClone(s), 999)).toThrow('not supported');
    s.mapJournal!.trail!.sites.push({ id: 'trail-1', q: 2, r: -2, kind: 'hunting-tracks' as never, remainingSec: 10 });
    s.mapJournal!.trail!.serial = 1;
    expect(() => normalizeMapJournal(s)).toThrow('Invalid trail site');
  });
});
