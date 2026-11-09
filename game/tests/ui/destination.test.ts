import { describe, expect, it } from 'vitest';
import { E } from '../../src/engine/client';
import { newGame } from '@sim/core/game';
import { settlementCell, startWalk, warpCost, warpTo } from '@sim/world/road';
import { fieldActionProblem, startFieldAction } from '@sim/world/fieldwork';
import { enterDungeon } from '@sim/world/dungeon';
import { destinationPrimary, destinationWarp, type MapDestination } from '../../src/ui/map/destination';

const destination = (patch: Partial<MapDestination> = {}): MapDestination => ({
  key: 'H10', kind: 'sub', label: 'Selected ground', node: null, sub: 0, site: null,
  self: false, walking: false, here: false, blocks: 1, sec: 1, ...patch,
});

describe('map destination primary action', () => {
  it('keeps a visited remote Waypoint on Walk, without spending gold', () => {
    const state = newGame();
    const remote = E.road.nodes.find((node: { id: string }) => node.id !== state.town.waypoint)!;
    state.town.visited.push(remote.id);
    state.counters.gold = warpCost(state, remote.id);
    const before = structuredClone(state);
    const result = destinationPrimary(state, destination({ kind: 'town', here: true, node: remote.id }));
    expect(result).toMatchObject({ kind: 'walk', label: 'Walk here', disabled: false });
    expect(state).toEqual(before);
  });

  it('offers Town only on the selected settlement itself, including read-only viewing', () => {
    const state = newGame();
    expect(destinationPrimary(state, destination({ kind: 'town', self: true }), false))
      .toMatchObject({ kind: 'town', label: 'Open town', disabled: false });
    expect(destinationPrimary(state, destination({ kind: 'town' })).kind).toBe('walk');
  });

  it('explains why another walk cannot start while traveling', () => {
    const state = newGame();
    expect(startWalk(state, { q: 1, r: 0, sub: null, site: null }).ok).toBe(true);
    expect(destinationPrimary(state, destination({ walking: true })))
      .toMatchObject({ kind: 'walk', label: 'Walking…', disabled: true });
  });

  it.each(['mine', 'grove', 'fishing'] as const)('uses the real %s readiness check, then offers Stop once gathering', (site) => {
    const kind = site === 'fishing' ? 'fish' : site;
    const state = newGame();
    state.cell = { q: 1, r: 0, sub: null, site };
    if (site === 'fishing') {
      state.zone = Number(Object.entries(E.fieldwork.regional_sources)
        .find(([, row]: [string, any]) => E.fieldwork.fishing.foods.includes(row.food))![0]);
    }
    state.hunting = false;
    state.group = [];
    const dest = destination({ kind: 'bare', sub: null, site, self: true });
    expect(fieldActionProblem(state, kind)).toBeNull();
    expect(destinationPrimary(state, dest)).toMatchObject({ kind, disabled: false });
    expect(startFieldAction(state, kind).ok).toBe(true);
    expect(destinationPrimary(state, dest)).toMatchObject({ kind: 'stop-gather', disabled: false });
  });

  it('shows dungeon entry and active-run retreat instead of Hunt', () => {
    const state = newGame();
    state.cell = { q: 1, r: 0, sub: null, site: 'dungeon' };
    const dest = destination({ kind: 'bare', sub: null, site: state.cell.site!, self: true });
    expect(destinationPrimary(state, dest)).toMatchObject({ kind: 'dungeon', disabled: false });
    expect(enterDungeon(state).ok).toBe(true);
    expect(destinationPrimary(state, dest)).toMatchObject({ kind: 'retreat', disabled: false });
    state.dungeon = null;
    state.dungeonClearedAt = state.clockSec;
    expect(destinationPrimary(state, dest)).toMatchObject({ kind: 'dungeon', disabled: true });
    expect(destinationPrimary(state, dest).reason).toContain('Cooldown');
  });

  it('prevents re-starting an active hunt and blocks writes in read-only mode', () => {
    const state = newGame();
    const dest = destination({ self: true });
    expect(destinationPrimary(state, dest)).toMatchObject({ kind: 'hunt', disabled: false });
    state.hunting = true;
    expect(destinationPrimary(state, dest)).toMatchObject({ kind: 'hunt', disabled: true });
    expect(destinationPrimary(state, destination(), false)).toMatchObject({ kind: 'walk', disabled: true });
  });
});

describe('warp home', () => {
  it('refuses a warp to the settlement the feet stand on', () => {
    const state = newGame();
    expect(warpTo(state, state.town.waypoint)).toMatchObject({ ok: false, why: 'you already stand there' });
  });

  it('warps back to the last town from a block out', () => {
    const state = newGame();
    const home = state.town.waypoint;
    if (!state.town.visited.includes(home)) state.town.visited.push(home);
    state.counters.gold = 1e9;
    const cell = settlementCell(home)!;
    state.cell = { q: cell.q + 1, r: cell.r, sub: null, site: null };
    const r = warpTo(state, home);
    expect(r.ok).toBe(true);
    expect(state.town.waypoint).toBe(home);
  });
});

describe('destinationWarp shared readiness', () => {
  const homeState = () => {
    const state = newGame();
    const home = state.town.waypoint;
    if (!state.town.visited.includes(home)) state.town.visited.push(home);
    return { state, home };
  };
  const oneOut = (state: ReturnType<typeof newGame>, home: string) => {
    const cell = settlementCell(home)!;
    state.cell = { q: cell.q + 1, r: cell.r, sub: null, site: null };
  };

  it('offers an enabled warp home the moment the feet leave the settlement (F3)', () => {
    const { state, home } = homeState();
    oneOut(state, home);
    state.counters.gold = 1e9;
    const dest = destination({ kind: 'town', node: home });
    expect(destinationWarp(state, dest)).toMatchObject({
      available: true, fare: warpCost(state, home), afford: true, disabled: false, reason: '',
    });
    expect(warpTo(state, home)).toMatchObject({ ok: true, gold: warpCost(state, home) });
  });

  it('quotes the fare from the actual committed position, not the saved Waypoint', () => {
    const { state, home } = homeState();
    const cell = settlementCell(home)!;
    state.cell = { q: cell.q + 1, r: cell.r, sub: null, site: null };
    const near = destinationWarp(state, destination({ kind: 'town', node: home }));
    const nearFare = warpCost(state, home);
    state.cell = { q: cell.q + 4, r: cell.r, sub: null, site: null };
    const far = destinationWarp(state, destination({ kind: 'town', node: home }));
    expect(near.fare).toBe(nearFare);
    expect(far.fare).toBe(warpCost(state, home));
    expect(far.fare).toBeGreaterThan(near.fare);
  });

  it('refuses an invalid destination without mutating', () => {
    const { state } = homeState();
    state.counters.gold = 1e9;
    const before = structuredClone(state);
    expect(destinationWarp(state, destination({ kind: 'town', node: 'no-such-settlement' })))
      .toMatchObject({ disabled: true, reason: 'no such settlement' });
    expect(destinationWarp(state, destination({ kind: 'sub', node: null })))
      .toMatchObject({ available: false, disabled: true });
    expect(warpTo(state, 'no-such-settlement')).toMatchObject({ ok: false });
    expect(state).toEqual(before);
  });

  it('reports a locked Waypoint and spends nothing', () => {
    const state = newGame();
    const remote = E.road.nodes.find((node: { id: string }) => node.id !== state.town.waypoint)!;
    expect(state.town.visited).not.toContain(remote.id);
    state.counters.gold = 1e9;
    const before = structuredClone(state);
    expect(destinationWarp(state, destination({ kind: 'town', node: remote.id })))
      .toMatchObject({ disabled: true, reason: 'no Waypoint — reach it on foot first' });
    expect(warpTo(state, remote.id)).toMatchObject({ ok: false });
    expect(state).toEqual(before);
  });

  it('reports an unaffordable warp and spends nothing', () => {
    const { state, home } = homeState();
    oneOut(state, home);
    state.counters.gold = Math.max(0, warpCost(state, home) - 1);
    expect(warpCost(state, home)).toBeGreaterThan(0);
    const before = structuredClone(state);
    expect(destinationWarp(state, destination({ kind: 'town', node: home })))
      .toMatchObject({ disabled: true, reason: `needs ${warpCost(state, home)} gold`, afford: false });
    expect(warpTo(state, home)).toMatchObject({ ok: false });
    expect(state).toEqual(before);
  });

  it('disables the button in read-only mode while the quote stays put', () => {
    const { state, home } = homeState();
    oneOut(state, home);
    state.counters.gold = 1e9;
    expect(destinationWarp(state, destination({ kind: 'town', node: home }), false))
      .toMatchObject({ disabled: true, reason: 'Read-only: another tab controls progress.', fare: warpCost(state, home) });
  });

  it('a duplicate press debits the fare once', () => {
    const { state, home } = homeState();
    oneOut(state, home);
    state.counters.gold = 1e9;
    const fare = warpCost(state, home);
    expect(warpTo(state, home)).toMatchObject({ ok: true, gold: fare });
    const afterFirst = structuredClone(state);
    expect(warpTo(state, home)).toMatchObject({ ok: false, why: 'you already stand there' });
    expect(state.counters.gold).toBe(afterFirst.counters.gold);
    expect(destinationWarp(state, destination({ kind: 'town', node: home, self: true })))
      .toMatchObject({ disabled: true, reason: 'you already stand there' });
  });
});
