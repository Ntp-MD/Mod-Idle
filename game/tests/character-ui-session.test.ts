import { describe, expect, it } from 'vitest';
import type { EnemySnapshot } from '../src/sim/combat/combat-history';
import type { Item } from '../src/sim/core/types';
import { newCraftWorkbenchView } from '../src/ui/inventory/craft-workbench';
import {
  captureCharacterUiSnapshot, emptyCharacterUiSnapshot, restoreCharacterUiSnapshot,
} from '../src/ui/character/character-ui-session';

const item: Item = {
  slot: 'ring', base: 'Band', ilvl: 20, quality: 'mid', tier: 'T1', q: 1,
  lines: [{ id: 'max_hp_flat', value: 20 }],
};
const enemy = { id: 'mob-1', species: 'Goblin', kind: 'Boss', line: 'front', level: 1, zone: 1, hpMax: 100, armour: 0, res: 0, damage: 'physical' } as EnemySnapshot;

describe('character UI session snapshot', () => {
  it('captures the four owned fields and copies the craft view', () => {
    const craftView = { ...newCraftWorkbenchView(), advanced: true, bagQuery: 'Band' };
    const snapshot = { benchSelection: { where: 'bag' as const, item }, benchNote: 'working', craftView, inspectedEnemy: enemy };
    const captured = captureCharacterUiSnapshot(snapshot);
    expect(captured).toEqual(snapshot);
    expect(captured.craftView).not.toBe(craftView);
    captured.craftView.advanced = false;
    expect(craftView.advanced).toBe(true);
  });

  it('restores every field without sharing the saved view', () => {
    const source = { ...emptyCharacterUiSnapshot(), benchNote: 'restored', craftView: { ...newCraftWorkbenchView(), sourceTab: 'equipped' as const } };
    const restored = restoreCharacterUiSnapshot(source);
    expect(restored).toEqual(source);
    expect(restored.craftView).not.toBe(source.craftView);
  });

  it('resets the bench, note, view and inspection while leaving nothing armed', () => {
    const empty = emptyCharacterUiSnapshot();
    expect(empty.benchSelection).toBeNull();
    expect(empty.benchNote).toBe('');
    expect(empty.craftView.reveal).toBeNull();
    expect(empty.craftView.selectedKey).toBe('');
    expect(empty.inspectedEnemy).toBeNull();
  });
});
