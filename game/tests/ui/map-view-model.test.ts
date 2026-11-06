import { describe, expect, it } from 'vitest';
import { newGame, setLevel } from '@sim/core/game';
import { currentCell } from '@sim/world/road';
import { buildMapPaintModel, ramp, type MapStaticCell, type Picked } from '../../src/ui/map/map-view-model';
import { E } from '../../src/engine/client';

const picked = (over: Partial<Picked>): Picked => ({
  key: 'A1', q: 0, r: 0, kind: 'bare', label: 'Hunting Ground · A1', sub: null, site: null, terrain: 'grass', ...over,
});

function cell(over: Partial<MapStaticCell>): MapStaticCell {
  return {
    ax: '0,0', picked: picked({}), nodeId: null, zone: 1, originalTitle: 'Hunting Ground · A1',
    tone: '#335544', edgeOpacity: 1, band: 0, center: { x: 0, y: 0 }, radius: 20,
    points: [{ x: 0, y: 0 }], anchor: false, ...over,
  };
}

describe('map view model', () => {
  it('reads player, selection and route without touching GameState', () => {
    const state = newGame(7);
    setLevel(state, 20);
    const feet = currentCell(state);
    const before = JSON.stringify(state);
    const cells = [
      cell({ ax: `${feet.q},${feet.r}`, picked: picked({ key: 'A1', q: feet.q, r: feet.r, nodeId: null }) }),
      cell({ ax: '1,0', picked: picked({ key: 'A2', q: 1, r: 0, kind: 'sub', sub: 0, nodeId: 'eastgate', label: 'Windmill Meadow' }), nodeId: 'eastgate' }),
      cell({ ax: '0,-1', picked: picked({ key: 'A3', q: 0, r: -1 }) }),
    ];
    const options = { view: 'terrain' as const, gateLevel: 1, showIds: false, showWalk: true, townId: state.town.waypoint, showNames: true, cleanMap: false, showHexCalibration: false };
    const model = buildMapPaintModel({ state, cells, selected: cells[1].picked, options });
    expect(model.surface.playerAx).toBe(`${feet.q},${feet.r}`);
    expect(model.surface.selectedAx).toBe('1,0');
    expect(model.surface.selectedTown).toBe('eastgate');
    expect(model.adventure.marks).toHaveLength(3);
    expect(model.labels).toHaveLength(3);
    expect(model.labels[1].levelText).toMatch(/^Lv \d+/);
    expect(JSON.stringify(state)).toBe(before);
    options.gateLevel = 99;
    expect(model.surface.options.gateLevel).toBe(1);
  });

  it('locks against the authored pool minimum and keeps the ramp sized to the zones', () => {
    const state = newGame(8);
    const cells = [cell({ ax: '0,0', picked: picked({}), zone: 2, band: 1 })];
    const gate = buildMapPaintModel({
      state, cells, selected: null,
      options: { view: 'gate', gateLevel: 1, showIds: false, showWalk: false, townId: '', showNames: true, cleanMap: false, showHexCalibration: false },
    });
    expect(gate.surface.cells[0].locked).toBe(true);
    const terrain = buildMapPaintModel({
      state, cells, selected: null,
      options: { view: 'terrain', gateLevel: 1, showIds: false, showWalk: false, townId: '', showNames: true, cleanMap: false, showHexCalibration: false },
    });
    expect(terrain.surface.cells[0].locked).toBe(false);
    expect(terrain.surface.cells[0].fill).toBe('#335544');
    expect(ramp(0)).not.toBe(ramp(E.mob.zones.length - 1));
  });

  it('ignores unrelated character pools when building the map sections', () => {
    const state = newGame(10);
    const feet = currentCell(state);
    const cells = [cell({ ax: `${feet.q},${feet.r}`, picked: picked({ key: 'A1', q: feet.q, r: feet.r }) })];
    const options = { view: 'terrain' as const, gateLevel: 1, showIds: false, showWalk: false, townId: '', showNames: true, cleanMap: false, showHexCalibration: false };
    const before = JSON.stringify(buildMapPaintModel({ state, cells, selected: null, options }));
    state.player.hp = Math.max(1, state.player.hp - 25);
    state.player.mana = Math.max(1, state.player.mana - 10);
    const after = JSON.stringify(buildMapPaintModel({ state, cells, selected: null, options }));
    expect(after).toBe(before);
  });

  it('marks unknown labels without a level and keeps named knowledge', () => {
    const state = newGame(9);
    const cells = [cell({ ax: '99,99', picked: picked({ key: 'ZZ', q: 99, r: 99 }) })];
    const model = buildMapPaintModel({
      state, cells, selected: null,
      options: { view: 'terrain', gateLevel: 1, showIds: false, showWalk: false, townId: '', showNames: true, cleanMap: false, showHexCalibration: false },
    });
    expect(model.labels[0].discovery).toBe('unknown');
    expect(model.labels[0].levelText).toBe('');
    expect(model.labels[0].name).toBe('Unexplored ground');
  });
});
