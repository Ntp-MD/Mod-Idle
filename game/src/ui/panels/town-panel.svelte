<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import TownHub from '../town/TownHub.svelte';
  import type { GameState } from '@sim/core/types';

  let {
    gameState, town, townLive, tabs, modalGridArea, showcaseMode,
    onopen, onwarp, onsellall, onblackmarket, onbest, onstashall, onclose,
  }: {
    gameState: GameState;
    town: any;
    townLive: boolean;
    tabs: number;
    modalGridArea: string;
    showcaseMode: boolean;
    onopen: (id: string) => void;
    onwarp: (id: string) => void;
    onsellall: () => void;
    onblackmarket: () => void;
    onbest: () => void;
    onstashall: () => void;
    onclose: () => void;
  } = $props();
</script>

<Panel title="Town" subtitle={`${town?.name ?? 'the field'} · ${townLive ? 'standing here' : 'not standing here'}`} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={onclose}>
  <TownHub state={gameState} {town} here={townLive} {tabs}
    {onopen} {onwarp} {onsellall}
    {onblackmarket}
    {onbest}
    {onstashall} />
</Panel>
