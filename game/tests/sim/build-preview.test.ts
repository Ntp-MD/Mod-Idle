import { describe, expect, it } from 'vitest';
import { E, loot, sm, TREE_SPEC, tree } from '../../src/engine/client';
import { previewEquip, previewTreeRoute } from '@sim/core/build-preview';
import { characterSheet, newGame, setLevel } from '@sim/core/game';
import { equipFromBag } from '@sim/gear/gear';
import { allocateTreePath } from '@sim/core/tree';
import type { Item } from '@sim/core/types';

const ring = (value: number, weight = 4): Item => ({
  slot: 'ring', base: 'Band', ilvl: 20, quality: 'mid', tier: 'T1', q: 1, weight,
  lines: [{ id: 'all_stat_flat', value, slice: 1 }],
});
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const entry of Object.values(value)) freeze(entry);
    Object.freeze(value);
  }
  return value;
}

describe('build decision previews', () => {
  it('fills the empty second ring and does not mutate even a frozen live state', () => {
    const state = newGame(91);
    const ringSlots = loot.SLOTS.map((slot: string, index: number) => slot === 'ring' ? index : -1).filter((index: number) => index >= 0);
    state.gear[ringSlots[0]] = ring(30);
    const candidate = ring(8);
    state.bag.push(candidate);
    const saved = JSON.stringify(state);
    freeze(state);
    const preview = previewEquip(state, candidate);
    expect(preview.ok).toBe(true);
    expect(preview.replaced).toBeNull();
    expect(preview.changes.find((change) => change.key === 'core.str')?.after).toBe(characterSheet(state).core.str + 8);
    expect(JSON.stringify(state)).toBe(saved);
  });

  it('compares against the exact weaker ring and matches the completed swap including carry weight', () => {
    const state = newGame(92);
    const ringSlots = loot.SLOTS.map((slot: string, index: number) => slot === 'ring' ? index : -1).filter((index: number) => index >= 0);
    state.gear[ringSlots[0]] = ring(30, 12);
    state.gear[ringSlots[1]] = ring(2, 2);
    const candidate = ring(9, 7);
    state.bag.push(candidate);
    const preview = previewEquip(state, candidate, 0);
    expect(preview.replaced).toBe(state.gear[ringSlots[1]]);
    const actual = structuredClone(state);
    expect(equipFromBag(actual, 0, true).ok).toBe(true);
    const finished = characterSheet(actual);
    expect(preview.changes.find((change) => change.key === 'core.str')?.after).toBe(finished.core.str);
    // Both pieces are still carried after the swap, one worn and one in the bag.
    expect(preview.changes.some((change) => change.key === 'weightUsed')).toBe(false);
    expect(actual.bag[0]).toEqual(state.gear[ringSlots[1]]);
  });

  it('refuses broken gear and stale indices without touching either item', () => {
    const state = newGame(93), candidate = ring(5);
    state.bag.push(candidate, { ...ring(8), broken: true });
    const before = JSON.stringify(state);
    expect(previewEquip(state, candidate, 1)).toMatchObject({ ok: false, changes: [] });
    expect(previewEquip(state, state.bag[1])).toMatchObject({ ok: false, why: 'Broken — Repair it before equipping' });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('reports when a weapon swap disables a loaded skill and uses the new held Mastery', () => {
    const state = newGame(94);
    const skill = sm.all().find((row: any) => row.weapon && row.type === 'attack')!;
    const oldWeapon = E.weapons.find((weapon: any) => sm.weaponFits(skill, weapon.name))!;
    const newWeapon = E.weapons.find((weapon: any) => !sm.weaponFits(skill, weapon.name))!;
    const weaponItem = (base: string): Item => ({ ...ring(0, 40), slot: 'main hand', base, lines: [] });
    const main = loot.SLOTS.indexOf('main hand');
    state.gear[main] = weaponItem(oldWeapon.name);
    state.mastery[oldWeapon.name] = 1e9;
    state.skills.owned[skill.id] = 0;
    state.skills.list[0] = skill.id;
    state.bag.push(weaponItem(newWeapon.name));
    const preview = previewEquip(state, state.bag[0]);
    const actual = structuredClone(state);
    expect(equipFromBag(actual, 0, true).ok).toBe(true);
    expect(preview.notes.some((note) => note.key === `skill.${skill.id}` && note.text.includes('cannot cast'))).toBe(true);
    const actualSheet = characterSheet(actual);
    expect(preview.changes.find((change) => change.key === 'weaponMastery')?.after).toBe(actualSheet.weaponMastery);
    expect(preview.changes.find((change) => change.key === 'weightUsed')?.after).toBe(actualSheet.weightUsed);
    for (const change of preview.changes) {
      if (['weightUsed', 'weightCap', 'hitsPerSec', 'weaponMastery'].includes(change.key)) {
        expect(change.after).toBe(actualSheet[change.key as keyof typeof actualSheet]);
      }
    }
  });

  it.each(['ironwall', 'arcane-battery', 'chaos-inoculation', 'one-flame'])('previews the complete %s route through the canonical sheet and keeps its drawback text', (key) => {
    const state = newGame(95);
    setLevel(state, E.stat.level_cap);
    state.player.points.agi = 50;
    state.gear[0] = { ...ring(0), slot: 'helmet', lines: [{ id: 'evasion_flat', value: 80, slice: 1 }] };
    // A future route is still inspectable before the player has banked the required points.
    state.player.treePoints = 0;
    state.player.attainmentPoints = 0;
    const before = JSON.stringify(state);
    const preview = previewTreeRoute(freeze(state), `keystone.${key}`);
    expect(preview.ok).toBe(true);
    expect(preview.notes.find((note) => note.key === `keystone.${key}`)?.text).toContain(tree.byId[`keystone.${key}`].description);
    const actual = structuredClone(state);
    actual.player.treePoints = 10000;
    actual.player.attainmentPoints = 10000;
    expect(allocateTreePath(actual, `keystone.${key}`).ok).toBe(true);
    const finished = characterSheet(actual);
    for (const change of preview.changes) {
      if (['maxHp', 'maxMana', 'armour', 'evasion', 'es', 'resCap'].includes(change.key)) {
        expect(change.after).toBe(finished[change.key as keyof typeof finished]);
      }
    }
    if (key === 'ironwall') expect(preview.changes.find((change) => change.key === 'evasion')?.after).toBe(0);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('respects incompatible Keystone choices instead of inventing an allocatable preview', () => {
    const state = newGame(96);
    const pair = TREE_SPEC.incompatibilities[0];
    state.player.treeRanks = { ...state.player.treeRanks, [pair.a]: 1 };
    expect(previewTreeRoute(state, pair.b)).toMatchObject({ ok: false, changes: [] });
  });

  it('includes reservation clamping from the canonical full-route action without changing live auras', () => {
    const state = newGame(97);
    setLevel(state, E.stat.level_cap);
    for (const skill of sm.of('aura').slice(0, 8)) {
      state.skills.owned[skill.id] = 0;
      state.skills.auras[skill.id] = true;
    }
    const before = JSON.stringify(state.skills);
    const preview = previewTreeRoute(state, 'keystone.arcane-battery');
    expect(preview.ok).toBe(true);
    const actual = structuredClone(state);
    actual.player.treePoints = 10000;
    actual.player.attainmentPoints = 10000;
    expect(allocateTreePath(actual, 'keystone.arcane-battery').ok).toBe(true);
    const switchedOff = Object.keys(state.skills.auras).filter((id) => !actual.skills.auras[id]);
    expect(switchedOff.length).toBeGreaterThan(0);
    expect(preview.notes.filter((note) => note.key.startsWith('aura.')).map((note) => note.key.slice(5))).toEqual(switchedOff);
    expect(JSON.stringify(state.skills)).toBe(before);
  });
});
