<script lang="ts">
  import { sm, trade, TOWN } from '../engine/client';
  import { stoneName } from '../sim/craft';
  import { deliveryTimeLeft, deliveryPauseReason } from '../sim/delivery';
  import type { DeliveryContract } from '../sim/delivery-types';
  import type { GameState } from '../sim/types';
  let { state: gameState, contract, writer, ontrack, ondetails, ondismiss }: {
    state: GameState; contract: DeliveryContract; writer: boolean;
    ontrack: () => void; ondetails: () => void; ondismiss: () => void;
  } = $props();
  const town = $derived(TOWN.settlements.find((entry) => entry.id === contract.town)!);
  const pause = $derived(deliveryPauseReason(gameState));
</script>
<section class="notice" aria-label="New delivery opportunity">
  <h3>{town.name} wants {contract.target} {trade.byId[contract.good].name}</h3>
  <p>Each hand-in pays the live market value. Complete the full count for {contract.reward.gold.toFixed(TOWN.trade.currency_decimals)} gold + {contract.reward.stone.count} {stoneName(contract.reward.stone.key)}.</p>
  {#if contract.reward.skill}<p>Skill: {sm.byId[contract.reward.skill]?.name}, or {contract.reward.fallback.count} {stoneName(contract.reward.fallback.key)} if the duplicate is no longer useful.</p>{/if}
  <p>{Math.ceil(deliveryTimeLeft(gameState, contract) / 60)} minutes left{pause ? ` · paused: ${pause}` : ''}. Tracking adds a reminder; delivery stays available without it.</p>
  <div><button disabled={!writer} onclick={ontrack}>Track want</button><button onclick={ondetails}>View delivery</button><button disabled={!writer} onclick={ondismiss}>Dismiss</button></div>
  {#if !writer}<small class="text-alarm">This preview is read-only.</small>{/if}
</section>
<style>
  .notice { display: grid; gap: var(--spacing-md); align-content: start; }
  h3, p { margin: 0; }
  h3 { font-size: var(--font-md); }
  p { line-height: 1.5; }
  div { display: flex; flex-wrap: wrap; gap: var(--spacing-md); }
</style>
