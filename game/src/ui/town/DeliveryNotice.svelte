<script lang="ts">
  import { trade, TOWN } from '../../engine/client';
  import { stoneName } from '../../sim/craft';
  import { deliveryTimeLeft, deliveryPauseReason } from '../../sim/delivery';
  import type { DeliveryContract } from '../../sim/delivery-types';
  import type { GameState } from '../../sim/types';
  import { deliveryBonuses } from '../../sim/quest-rewards';
  import { questBonusText } from './quest-rewards';
  let { state: gameState, contract, writer, ontrack, ondetails, ondismiss }: {
    state: GameState; contract: DeliveryContract; writer: boolean;
    ontrack: () => void; ondetails: () => void; ondismiss: () => void;
  } = $props();
  const town = $derived(TOWN.settlements.find((entry) => entry.id === contract.town)!);
  const pause = $derived(deliveryPauseReason(gameState));
</script>
<section class="notice" aria-label="New delivery opportunity">
  <h3>{town.name} wants {contract.target} {trade.byId[contract.good].name}</h3>
  <p>Each hand-in pays the live market value. {contract.reward.alternative ? 'Complete the full count, then choose one reward:' : 'Fixed completion reward:'}</p>
  {#each deliveryBonuses(contract.reward) as bonus}<p>{questBonusText(bonus)}{bonus.skill && bonus.fallback ? ` (or ${bonus.fallback.count} ${stoneName(bonus.fallback.key)} if no useful copy remains)` : ''}</p>{/each}
  {#if contract.reward.treePoints || contract.reward.attainment}<p>Guaranteed on completion{contract.reward.alternative ? ' with either choice' : ''}: {contract.reward.treePoints ? `${contract.reward.treePoints} Tree Point` : ''}{contract.reward.treePoints && contract.reward.attainment ? ' + ' : ''}{contract.reward.attainment ? `${contract.reward.attainment} Attainment Point` : ''}.</p>{/if}
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
