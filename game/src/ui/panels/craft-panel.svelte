<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import CraftWorkshop from '../inventory/CraftWorkshop.svelte';
  import { ACTIVITY_GUIDE } from '@sim/core/guidance';
  import type { GameState, Item } from '@sim/core/types';
  import type { CraftOp, Where } from '@sim/gear/craft';
  import type { CraftWorkbenchView } from '../inventory/craft-workbench';
  import { newCraftWorkbenchView } from '../inventory/craft-workbench';

  let {
    gameState, benchItem, bench, craftView = $bindable(newCraftWorkbenchView()), wornOf, benchNote,
    tabs, stashTab, transactionWriter, repairPrice, repairQuote,
    modalGridArea, showcaseMode,
    onpick, onclear, onrun, onStashTab, onTakeStash, onStore, onrepair, onclose,
  }: {
    gameState: GameState;
    benchItem: Item | null;
    bench: { where: Where; index: number } | null;
    craftView: CraftWorkbenchView;
    wornOf: (slot: string) => Item | null;
    benchNote: string;
    tabs: number;
    stashTab: number;
    transactionWriter: boolean;
    repairPrice: number;
    repairQuote: { normalGold: number; gold: number; promotion: { expiresAtSec: number } | null; token: string } | null;
    modalGridArea: string;
    showcaseMode: boolean;
    onpick: (where: Where, index: number) => void;
    onclear: () => void;
    onrun: (op: CraftOp, line?: number, pick?: string) => boolean;
    onStashTab: (tab: number) => void;
    onTakeStash: (tab: number, index: number) => boolean;
    onStore: (index: number, tab: number) => boolean;
    onrepair: (where: Where, index: number, expected?: { token: string; target?: { where: Where; index: number } }) => boolean;
    onclose: () => void;
  } = $props();
</script>

<Panel title="Craft" subtitle={`Optional · ${ACTIVITY_GUIDE.craft.when} ${ACTIVITY_GUIDE.craft.helps} Right-click a stone · click to apply · Shift-click to repeat`} width="wide" fixed topmost showcase={showcaseMode} gridArea={modalGridArea} onclose={onclose}>
  <CraftWorkshop game={gameState} item={benchItem} where={bench?.where ?? null} index={bench?.index ?? -1}
    bind:view={craftView}
    {onpick}
    {onclear}
    {onrun} {wornOf} note={benchNote}
    stashTabs={tabs} {stashTab} writer={transactionWriter}
    {repairPrice} {repairQuote} {onrepair}
    repairExpected={repairQuote && bench ? { token: repairQuote.token, target: { where: bench.where, index: bench.index } } : undefined}
    {onStashTab} {onTakeStash} {onStore} />
</Panel>
