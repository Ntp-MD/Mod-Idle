<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import CombatHistory from '../combat/CombatHistory.svelte';
  import EnemyInspector from '../combat/EnemyInspector.svelte';
  import type { GameState } from '@sim/core/types';
  import type { EnemySnapshot } from '@sim/combat/combat-history';

  let {
    gameState, inspectedEnemy, modalGridArea, showcaseMode, oninspect, onclose, oncloseEnemy,
  }: {
    gameState: GameState;
    inspectedEnemy: EnemySnapshot | null;
    modalGridArea: string;
    showcaseMode: boolean;
    oninspect: (enemy: EnemySnapshot) => void;
    onclose: () => void;
    oncloseEnemy: () => void;
  } = $props();
</script>

<Panel title="Combat history" subtitle="Recent recorded events · damage, skills, defensive outcomes and Push" width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={onclose}>
  <CombatHistory entries={gameState.combatHistory || []} oninspect={oninspect} />
</Panel>

{#if inspectedEnemy}
  <Panel title="Enemy details" subtitle="Recorded identity and resolved skill kit" width="normal" gridArea={modalGridArea} onclose={oncloseEnemy}>
    <EnemyInspector enemy={inspectedEnemy} />
  </Panel>
{/if}
