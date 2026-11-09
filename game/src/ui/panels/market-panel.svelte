<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import Market from '../town/Market.svelte';
  import type { GameState } from '@sim/core/types';

  let {
    gameState, town, townLive, transactionWriter, marketSale, modalGridArea, showcaseMode,
    onbuy, onsell, ontrade, onprocess, onroute, ondeliver, ontrack, onack, onaccept, ondecline, onblackmarketbuy,
    onpinzone, ontrackgoal, ontrackshortage, goalId, view = $bindable('trade'), marketId = $bindable(''), onclose,
  }: {
    gameState: GameState;
    town: any;
    townLive: boolean;
    transactionWriter: boolean;
    marketSale: { text: string; goldText: string; townId?: string; goodId?: string } | null;
    modalGridArea: string;
    showcaseMode: boolean;
    onbuy: (rowId: string, settlementId?: string, expected?: { token: string; target?: { where: 'gear' | 'bag'; index: number } }) => void;
    onsell: () => void;
    ontrade: (id: string, count: number, expected?: { carried: number; gold: number }) => void;
    onprocess: (id: string) => void;
    onroute: (id: string) => void;
    ondeliver: (id: string, count: number, choice?: string) => void;
    ontrack: (id: string, tracked: boolean) => void;
    onack: (id: string) => void;
    onaccept: (id: string) => void;
    ondecline: (id: string) => void;
    onblackmarketbuy: (townId: string, offerId: string) => void;
    onpinzone: (zone: number) => void;
    ontrackgoal: (id: string) => void;
    ontrackshortage: (good: string, want: number, origin: { kind: 'delivery'; id: string } | { kind: 'workshop'; recipe: string }) => void;
    goalId: string | null;
    view: 'trade' | 'deliveries' | 'workshop' | 'stall' | 'black-market';
    marketId: string;
    onclose: () => void;
  } = $props();
</script>

<Panel title="Market" subtitle={`${town?.name ?? ''} · demand, cargo and town services`} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={onclose}>
  <Market state={gameState} {town} here={townLive} writer={transactionWriter} {onbuy} {onsell} {ontrade} {onprocess} {onroute} saleResult={marketSale}
    {ondeliver} {ontrack} {onack}
    {onaccept} {ondecline} {onblackmarketbuy}
    {onpinzone} {ontrackgoal} {ontrackshortage}
    {goalId}
    bind:view
    bind:marketId />
</Panel>
