import { describe, expect, it } from 'vitest';
import { E, fieldwork } from '../../src/engine/client';
import { newGame } from '@sim/core/game';
import { settlementCell, startWalk, warpCost, warpTo } from '@sim/world/road';
import { establishCamp, fieldActionProblem, startFieldAction } from '@sim/world/fieldwork';
import { enterDungeon } from '@sim/world/dungeon';
import { destinationPrimary, type MapDestination } from '../../src/ui/map/destination';

const destination = (patch: Partial<MapDestination> = {}): MapDestination => ({
  key: 'H10', kind: 'sub', label: 'Selected ground', node: null, sub: 0, wild: null,
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
    expect(startWalk(state, { q: 1, r: 0, sub: null, wild: null }).ok).toBe(true);
    expect(destinationPrimary(state, destination({ walking: true })))
      .toMatchObject({ kind: 'walk', label: 'Walking…', disabled: true });
  });

  it.each(['mine', 'grove'] as const)('uses the real %s readiness check, then offers Stop once gathering', (kind) => {
    const state = newGame();
    const wild = fieldwork.F.wild_site_index[kind];
    state.cell = { q: 1, r: 0, sub: null, wild };
    state.hunting = false;
    state.group = [];
    const dest = destination({ kind: 'wild', sub: null, wild, self: true });
    expect(destinationPrimary(state, dest)).toMatchObject({ kind, disabled: true, reason: fieldActionProblem(state, kind) });
    expect(establishCamp(state).ok).toBe(true);
    expect(destinationPrimary(state, dest)).toMatchObject({ kind, disabled: false });
    expect(startFieldAction(state, kind).ok).toBe(true);
    expect(destinationPrimary(state, dest)).toMatchObject({ kind: 'stop-gather', disabled: false });
  });

  it('shows dungeon entry and active-run retreat instead of Hunt', () => {
    const state = newGame();
    state.cell = { q: 1, r: 0, sub: null, wild: fieldwork.F.wild_site_index.dungeon };
    const dest = destination({ kind: 'wild', sub: null, wild: state.cell.wild!, self: true });
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
    state.cell = { q: cell.q + 1, r: cell.r, sub: null, wild: null };
    const r = warpTo(state, home);
    expect(r.ok).toBe(true);
    expect(state.town.waypoint).toBe(home);
  });
});
