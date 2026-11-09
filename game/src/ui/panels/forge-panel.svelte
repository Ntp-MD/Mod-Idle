<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import Forge from '../inventory/Forge.svelte';
  import type { GameState } from '@sim/core/types';
  import type { ForgeKind } from '@engine/forge.ts';
  import type { GoalRef, ShortageOrigin } from '@sim/core/guidance';

  let {
    gameState, transactionWriter, forgeNote, forgeResultItem, forgeFocus,
    modalGridArea, onForge, onSalvage, onTrack, onShortage, onPinZone, onMap, onBag, onclose,
  }: {
    gameState: GameState;
    transactionWriter: boolean;
    forgeNote: string;
    forgeResultItem: string | null;
    forgeFocus: { patternKind: ForgeKind; pattern: string; material: string; nonce: number } | null;
    modalGridArea: string;
    onForge: (kind: ForgeKind, id: string, materialId: string, expected?: { held: number; freeSlots: number }) => boolean;
    onSalvage: (index: number) => boolean;
    onTrack: (ref: GoalRef | null) => void;
    onShortage: (good: string, want: number, origin: ShortageOrigin) => void;
    onPinZone: (zone: number) => void;
    onMap: () => void;
    onBag: () => void;
    onclose: () => void;
  } = $props();
</script>

<Panel title="Forge" subtitle="Materials in · a new piece out" width="wide" fixed topmost gridArea={modalGridArea} onclose={onclose}>
  <Forge game={gameState} writer={transactionWriter} note={forgeNote} resultItem={forgeResultItem} onforge={onForge} onsalvage={onSalvage} focus={forgeFocus}
    ontrack={onTrack} onshortage={onShortage} onpinzone={onPinZone}
    onmap={onMap} onbag={onBag} />
</Panel>
