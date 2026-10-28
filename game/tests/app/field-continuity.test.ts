import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { fieldAreaKey, releaseSpawnSlot, syncFieldState } from '@sim/world/field-area';
import { arrive, startWalk } from '@sim/world/road';
import { newGame, setLevel, spawnMob } from '@sim/core/game';

const HOME = { q: 0, r: 0, sub: null, wild: null };
const AWAY = { q: 1, r: 0, sub: null, wild: null };

function fieldHome(hp = 123) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  state.cell = { ...HOME };
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, { hp, hpMax: 500 });
  state.group = [mob];
  syncFieldState(state);
  return { state, mob };
}

function walkAway(state: ReturnType<typeof fieldHome>['state']) {
  expect(startWalk(state, { ...AWAY }).ok).toBe(true);
  arrive(state, state.walk!);
  syncFieldState(state);
}

function walkBack(state: ReturnType<typeof fieldHome>['state']) {
  state.cell = { ...HOME };
  state.walk = null;
  syncFieldState(state);
}

describe('field lives across a real transition', () => {
  it('parks a standing body in its slot instead of losing it on the road', () => {
    const { state, mob } = fieldHome();
    const slotId = mob.spawnSlotId;
    expect(slotId).toBeDefined();
    expect(startWalk(state, { ...AWAY }).ok).toBe(true);
    syncFieldState(state);
    expect(state.group).toEqual([]);
    const parked = state.field!.slots.find((slot) => slot.id === slotId)!;
    expect(parked.mobId).toBe(mob.id);
    expect(parked.life?.hp).toBe(123);
  });

  it('restores the same body and HP when the field becomes current again', () => {
    const { state, mob } = fieldHome();
    const originalKey = fieldAreaKey(state);
    const slotId = mob.spawnSlotId;
    walkAway(state);
    expect(state.field!.areaKey).not.toBe(originalKey);
    expect(state.group).toEqual([]);
    walkBack(state);
    const restored = state.group.find((entry) => entry.id === mob.id);
    expect(restored).toBeDefined();
    expect(restored!.hp).toBe(123);
    expect(restored!.spawnSlotId).toBe(slotId);
  });

  it('does not resurrect a released slot on return', () => {
    const { state, mob } = fieldHome();
    const slotId = mob.spawnSlotId!;
    state.group = state.group.filter((entry) => entry.id !== mob.id);
    expect(releaseSpawnSlot(state, mob)).toBe(true);
    const slot = state.field!.slots.find((entry) => entry.id === slotId)!;
    const respawnAt = slot.respawnAtSec;
    walkAway(state);
    walkBack(state);
    const after = state.field!.slots.find((entry) => entry.id === slotId)!;
    expect(after.life).toBeUndefined();
    expect(after.mobId).toBeUndefined();
    expect(after.respawnAtSec).toBe(respawnAt);
    expect(state.group.some((entry) => entry.id === mob.id)).toBe(false);
  });
});
