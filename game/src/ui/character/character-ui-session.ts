import type { EnemySnapshot } from '@sim/combat/combat-history';
import { newCraftWorkbenchView, type CraftWorkbenchView } from '../inventory/craft-workbench';
import type { ItemSelection } from '../inventory/item-selection';

/** UI state that belongs to one displayed character, never to account settings or gameplay progress. */
export interface CharacterUiSnapshot {
  benchSelection: ItemSelection | null;
  benchNote: string;
  craftView: CraftWorkbenchView;
  inspectedEnemy: EnemySnapshot | null;
}

export const emptyCharacterUiSnapshot = (): CharacterUiSnapshot => ({
  benchSelection: null, benchNote: '', craftView: newCraftWorkbenchView(), inspectedEnemy: null,
});

export function captureCharacterUiSnapshot(state: CharacterUiSnapshot): CharacterUiSnapshot {
  return { ...state, craftView: { ...state.craftView } };
}

export function restoreCharacterUiSnapshot(snapshot: CharacterUiSnapshot): CharacterUiSnapshot {
  return { ...snapshot, craftView: { ...snapshot.craftView } };
}
