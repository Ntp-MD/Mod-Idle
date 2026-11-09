<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import PassiveTreeBoard from '../passive-tree/PassiveTreeBoard.svelte';
  import { tree } from '../../engine/client';
  import { treePointsFree } from '@sim/core/tree';
  import type { GameState } from '@sim/core/types';
  import type { PassiveTreeSession } from '../passive-tree/passive-tree-view';

  let {
    gameState, selectedId, verdict, goalId, treeSpent, modalGridArea, showcaseMode,
    onselect, onbuy, onpath, ontrackgoal, session = $bindable(), focusId = $bindable(), onclose,
  }: {
    gameState: GameState;
    selectedId: string;
    verdict: { ok: boolean; why?: string };
    goalId: string | null;
    treeSpent: { tree?: number; attainment?: number };
    modalGridArea: string;
    showcaseMode: boolean;
    onselect: (id: string) => void;
    onbuy: (id: string) => void;
    onpath: (id: string) => void;
    ontrackgoal: (id: string) => void;
    session: PassiveTreeSession;
    focusId: string | null;
    onclose: () => void;
  } = $props();
</script>

<Panel title="Passive tree" subtitle={`${treePointsFree(gameState)} tree · ${treePointsFree(gameState, 'attainment')} attainment banked · ${treeSpent.tree ?? 0} tree / ${treeSpent.attainment ?? 0} attainment spent`} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={onclose}>
  <PassiveTreeBoard
    nodes={tree.nodes}
    graph={tree.graph}
    layout={tree.layout}
    game={gameState}
    {selectedId}
    {verdict}
    {onselect}
    {onbuy}
    {onpath}
    {ontrackgoal}
    {goalId}
    bind:session
    bind:focusId
  />
</Panel>
