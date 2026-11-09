import { describe, expect, it } from 'vitest';
import { tick, newGame } from '@sim/core/game';
import { advanceWalkStage } from '@sim/core/tick/walk-stage';
import { arrive, currentCell, settlementCell, startWalk, zoneOf } from '@sim/world/road';
import { commitStep, resolveCell } from '@sim/world/travel';
import { exportJson, importJson } from '../../src/state/save';

const pathTo = (q: number, r: number) => ({ q, r, sub: null, site: null });

function atEastgate(seed = 7) {
  const state = newGame(seed);
  state.cell = { ...settlementCell('eastgate')! };
  state.zone = 1;
  state.town.visited = ['eastgate'];
  state.town.waypoint = 'eastgate';
  return state;
}

/** One online second, enough for one block (`block_sec` is 1). */
function step(state: ReturnType<typeof newGame>, rng: () => number = () => 0.99) {
  advanceWalkStage(state, true, rng);
}

describe('travel F1/F2/F4: committed position and entered-cell events', () => {
  it('commits the entered cell each step while Eastgate -> Highspire crosses the zone boundary', () => {
    const state = atEastgate();
    expect(startWalk(state, settlementCell('highspire')!).ok).toBe(true);
    expect(state.walk!.journeyId).toBe(1);
    expect(state.walk!.legs.length).toBe(7);
    expect(state.town.visited).toEqual(['eastgate']); // passing a town opens nothing mid-walk

    const seen: string[] = [];
    for (let i = 0; i < 7; i++) {
      step(state);
      seen.push(`${state.cell!.q},${state.cell!.r}:z${state.zone}`);
      // F1: every step commits `state.cell` plus the World projection, mid-walk.
      expect(currentCell(state)).toEqual({ q: state.cell!.q, r: state.cell!.r });
      expect(state.zone).toBe(zoneOf(state.cell!));
      // No transit field/archive churn: still no walk activation, no preset change needed to pass.
      if (i < 6) {
        expect(state.walk).not.toBeNull();
        expect(Object.keys(state.fieldArchive ?? {})).not.toContain('1|1,-1||field');
      }
    }
    expect(seen).toEqual(['1,-1:z1', '2,-2:z1', '3,-3:z1', '4,-4:z2', '5,-5:z2', '6,-6:z2', '7,-7:z2']);
    expect(state.walk).toBeNull();
    expect(state.cell).toMatchObject({ q: 7, r: -7, sub: null, site: null });
    expect(state.town.visited).toEqual(['eastgate', 'highspire']);
    expect(state.town.waypoint).toBe('highspire');
  });

  it('resolves the road event against the entered cell (F2) and discovers it once', () => {
    // Queue rng: chance passes (0 < 0.12), the weight roll lands on the first event, and the
    // amount stays 1 — so the resource must be the entered cell's regional food, not the origin's.
    const sleuthState = atEastgate(11);
    const queue: number[] = [];
    const freshRng = () => () => (queue.length ? queue.shift()! : 0.01);
    const alwaysEvent = (): (() => number) => {
      queue.push(0, 0.01, 0.01);
      return freshRng();
    };
    const state = sleuthState;
    expect(startWalk(state, settlementCell('highspire')!).ok).toBe(true);
    // Empty both budgets so a wrong-zone roll would be visible.
    state.fieldwork.foods['wild-grain'] = 0;
    state.fieldwork.foods['forest_nuts'] = 0;
    step(state, alwaysEvent());
    expect(state.cell).toMatchObject({ q: 1, r: -1 });
    expect(state.zone).toBe(1);
    expect(state.mapJournal).toBeDefined();
    expect(state.fieldwork.foods['wild-grain']).toBeGreaterThan(0);
    expect(state.fieldwork.foods['forest_nuts']).toBe(0);

    // Boundary cell 4,-4 is zone 2: its event must pay zone-2 food and name zone 2.
    step(state, () => 0.99);
    step(state, () => 0.99);
    step(state, alwaysEvent());
    expect(state.cell).toMatchObject({ q: 4, r: -4 });
    expect(state.zone).toBe(2);
    expect(state.fieldwork.foods['forest_nuts']).toBeGreaterThan(0);
    expect(state.mapJournal!.lastEvent).toMatchObject({ q: 4, r: -4, source: 'road' });
    expect(state.mapJournal!.lastEvent!.text).toContain('Highspire');
    expect(state.mapJournal!.visited).toContain('4,-4');

    // Finishing the walk arrives only at the final stop, after the event.
    step(state, () => 0.99);
    step(state, () => 0.99);
    step(state, () => 0.99);
    expect(state.walk).toBeNull();
    expect(state.cell).toMatchObject({ q: 7, r: -7 });
  });

  it('keeps time chunking: online steps advance one block, offline advances none (F1)', () => {
    const state = atEastgate(13);
    expect(startWalk(state, settlementCell('highspire')!).ok).toBe(true);
    expect(state.walk!.secLeft).toBe(1);
    advanceWalkStage(state, false, () => 0.99);
    expect(state.walk).not.toBeNull();
    expect(currentCell(state)).toEqual({ q: 0, r: 0 });
    expect(state.walk!.stepIndex).toBe(0);
    step(state);
    expect(state.walk!.stepIndex).toBe(1);
    expect(state.walk!.secLeft).toBe(1);
    step(state);
    expect(state.walk!.stepIndex).toBe(2);
    expect(currentCell(state)).toEqual({ q: 2, r: -2 });
  });

  it('final-step order: commit the destination cell before arrival unlock', () => {
    const state = atEastgate(17);
    expect(startWalk(state, settlementCell('highspire')!).ok).toBe(true);
    for (let i = 0; i < 6; i++) step(state);
    expect(state.cell).toMatchObject({ q: 6, r: -6 });
    expect(state.town.visited).toEqual(['eastgate']); // not yet unlocked before the final cell
    const visitedBefore = [...state.town.visited];
    step(state);
    expect(state.cell).toMatchObject({ q: 7, r: -7 });
    expect(state.town.visited).not.toEqual(visitedBefore);
    expect(state.town.visited).toEqual(['eastgate', 'highspire']);
  });

  it('no replay: re-committing the same leg discovers and events once', () => {
    const state = atEastgate(19);
    expect(startWalk(state, settlementCell('highspire')!).ok).toBe(true);
    const walk = state.walk!;
    const first = commitStep(state);
    expect(first.duplicate).toBe(false);
    expect(state.walk!.stepIndex).toBe(1);
    // A caller that lost the pointer replays from the same object: the receipt stops a second
    // commit for that leg, and `currentCell` still reads the committed position.
    expect(currentCell(state)).toEqual({ q: 1, r: -1 });
    const again = commitStep(state);
    expect(again.duplicate).toBe(false); // next leg, a real new cell
    expect(state.walk!.stepIndex).toBe(2);
    // Idempotent arrival after walking the rest: completing twice unlocks once.
    for (let i = 0; i < 5; i++) step(state);
    expect(state.walk).toBeNull();
    const back = importJson(exportJson(state));
    expect(back.walk).toBeNull();
    expect(back.cell).toEqual(state.cell);
    expect(back.town.visited).toEqual(['eastgate', 'highspire']);
    expect(walk.stepIndex).toBe(7);
  });

  it('resolves destination content from coordinates, never caller metadata (F4)', () => {
    // Bare cell 2,-2 with a supplied mine site must still arrive as hunting bare ground.
    const bare = atEastgate(23);
    const wrong = startWalk(bare, { q: 2, r: -2, sub: null, site: 'mine', terrain: 'rock' });
    expect(wrong.ok).toBe(true);
    expect(resolveCell(bare.walk!.to)?.cell.site).toBeNull();
    expect(resolveCell(bare.walk!.to)?.kind).toBe('bare');
    arrive(bare, bare.walk!);
    expect(bare.cell).toMatchObject({ q: 2, r: -2, site: null });
    expect(bare.hunting).toBe(true);

    // The mine hex -1,1 with no supplied site must arrive as a safe mine.
    const mine = atEastgate(29);
    const stripped = startWalk(mine, pathTo(-1, 1));
    expect(stripped.ok).toBe(true);
    expect(resolveCell(mine.walk!.to)?.cell.site).toBe('mine');
    arrive(mine, mine.walk!);
    expect(mine.cell).toMatchObject({ q: -1, r: 1, site: 'mine' });
    expect(mine.hunting).toBe(false);

    // The sub-hex 1,-1 with a supplied bare kind must arrive on the named side.
    const side = atEastgate(31);
    expect(startWalk(side, pathTo(1, -1)).ok).toBe(true);
    expect(resolveCell(side.walk!.to)?.kind).toBe('sub');
    expect(resolveCell(side.walk!.to)?.cell.sub).toBe(1);
    arrive(side, side.walk!);
    expect(side.cell).toMatchObject({ q: 1, r: -1, sub: 1 });
  });

  it('ticks a full trip offline-free: a walk never advances while away', () => {
    const state = atEastgate(37);
    expect(startWalk(state, settlementCell('highspire')!).ok).toBe(true);
    tick(state, { online: false, autoSkills: false });
    expect(state.walk!.stepIndex).toBe(0);
    expect(currentCell(state)).toEqual({ q: 0, r: 0 });
  });
});
