<script lang="ts">
  import { sm, TOWN, trade } from '../engine/client';
  import { stoneName } from '../sim/craft';
  import { deliveryTimeLeft, deliveryPauseReason, previewDelivery, contractById } from '../sim/delivery';
  import { tradeBucket } from '../sim/trade';
  import type { GameState } from '../sim/types';
  import type { DeliveryContract } from '../sim/delivery-types';
  import { deliveryBonuses } from '../sim/quest-rewards';
  import QuestBonusPicker from './QuestBonusPicker.svelte';
  import EmptyNote from './EmptyNote.svelte';
  import { questBonusText } from './quest-rewards';
  let { state: gameState, townId, writer, ondeliver, ontrack, onack }: {
    state: GameState; townId: string; writer: boolean;
    ondeliver: (id: string, count: number, choice?: string) => void; ontrack: (id: string, tracked: boolean) => void; onack: (id: string) => void;
  } = $props();
  let quantities = $state<Record<string, number>>({});
  let choices = $state<Record<string, { contract: DeliveryContract; choice: string }>>({});
  const contracts = $derived(gameState.town.contracts[townId] || []);
  const open = $derived(contracts.filter((contract) => contract.status === 'open'));
  const history = $derived(contracts.filter((contract) => contract.status !== 'open').slice().sort((a, b) => b.terminalAt! - a.terminalAt! || b.serial - a.serial));
  const tracked = $derived(gameState.town.trackedContractIds.map((id) => contractById(gameState, id)).filter((contract) => contract?.status === 'open'));
  const summary = $derived(gameState.town.deliverySummaries[townId]);
  const pause = $derived(deliveryPauseReason(gameState));
  const gold = (n: number) => n.toFixed(TOWN.trade.currency_decimals);
  const time = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const townName = (id: string) => TOWN.settlements.find((town) => town.id === id)?.name || id;
</script>

<section class="deliveries" aria-label="Delivery contracts">
  <p class="explanation text-dim">Hand-ins pay market value now · complete the count before the deadline for the bonus.</p>
  {#if !writer}<p class="text-alarm" role="status">This tab is read-only. Deliveries, tracking and recap acknowledgement are disabled.</p>{/if}
  <div class="wants">
    {#each open as contract (contract.id)}
      {@const good = trade.byId[contract.good]}
      {@const carried = tradeBucket(gameState, good)[good.key] || 0}
      {@const remaining = contract.target - contract.delivered}
      {@const count = quantities[contract.id] ?? Math.max(1, Math.min(carried || remaining, remaining))}
      {@const choice = choices[contract.id]?.contract === contract ? choices[contract.id].choice : undefined}
      {@const preview = previewDelivery(gameState, contract.id, count, { writer }, choice)}
      <article class="want">
        <header><div><h3>{good.name}</h3><small>{townName(contract.town)}</small></div><strong class="text-value">{contract.delivered} / {contract.target}</strong></header>
        <p class="text-accent">{time(deliveryTimeLeft(gameState, contract))} left{pause ? ` · paused: ${pause}` : ''}</p>
        <QuestBonusPicker state={gameState} options={deliveryBonuses(contract.reward)} name={`reward-${contract.id}`} {choice} {writer} onchoose={(choice) => { choices[contract.id] = { contract, choice }; }} />
        <p class="text-dim">Every completion earns Haggling XP{contract.reward.attainment ? ` + ${contract.reward.attainment} Attainment Point` : ''}{contract.reward.treePoints ? ` + ${contract.reward.treePoints} Tree Point` : ''}.</p>
        {#if contract.reward.milestone}<p class="text-good">First Delivery milestone in {townName(contract.town)} · the Tree Point is guaranteed with either reward.</p>{/if}
        <p class="carried text-dim">{carried} carried · {remaining} still wanted · {gold(contract.baseGold)} market gold already paid</p>
        <div class="actions">
          <label>Quantity <input type="number" min="1" max={remaining} step="1" aria-label={`Delivery quantity for ${good.name} at ${townName(contract.town)}`} value={count} oninput={(event) => quantities[contract.id] = event.currentTarget.valueAsNumber} /></label>
          <button disabled={!preview.ok} title={preview.ok ? `Receive ${gold(preview.quote.gold)} market gold${preview.complete ? ' and the completion bonus' : ''}` : preview.why} onclick={() => ondeliver(contract.id, count, choice)}>Deliver {count || 'goods'}</button>
          <button disabled={!writer} aria-pressed={gameState.town.trackedContractIds.includes(contract.id)} onclick={() => ontrack(contract.id, !gameState.town.trackedContractIds.includes(contract.id))}>{gameState.town.trackedContractIds.includes(contract.id) ? 'Untrack' : 'Track'}</button>
        </div>
        {#if !preview.ok}<small class="text-alarm">{preview.why}</small>{:else}<small>Hand-in pays {gold(preview.quote.gold)} market gold now{preview.complete ? ` plus the stored completion bonus${preview.treePoints ? ` (${preview.treePoints} tree point${preview.treePoints === 1 ? '' : 's'})` : ''}` : '; the bonus waits for the full count'}.</small>{/if}
        {#if !contract.recapAcknowledged && contract.lastQuantity}<p class="recap text-good" role="status">Last delivery: {contract.lastQuantity} · {gold(contract.lastGold)} market gold paid. Total {contract.delivered} delivered.</p><button class="ack" disabled={!writer} onclick={() => onack(contract.id)}>Acknowledge delivery</button>{/if}
      </article>
    {:else}<EmptyNote text="No open want here. Visited towns get independent online opportunities; opening this page does not roll an offer." />{/each}
  </div>
  <section class="tracked" aria-label="Tracked delivery objectives">
    <h3>Tracked deliveries</h3>
    {#each tracked as contract (contract!.id)}
      <p>{townName(contract!.town)} · {trade.byId[contract!.good].name} · {contract!.delivered}/{contract!.target} · {time(deliveryTimeLeft(gameState, contract!))}</p>
    {:else}<EmptyNote text="Track an open want to keep its town, count and deadline in view." />{/each}
  </section>
  {#if summary?.unread}
    <section class="summary" aria-label="Earlier unread delivery recaps"><h3>{summary.unread} earlier recaps</h3>
      <p>{summary.completed} completed · {summary.expired} expired. Actual completion gold paid: {gold(summary.paidGold)}. Fixed gold forfeited: {gold(summary.forfeitedGold)}.{summary.paidTreePoints ? ` Tree points paid: ${summary.paidTreePoints}.` : ''}{summary.paidAttainment ? ` Attainment paid: ${summary.paidAttainment}.` : ''}{summary.forfeitedTreePoints ? ` Tree-point promises expired: ${summary.forfeitedTreePoints}.` : ''}{summary.forfeitedAttainment ? ` Attainment promises expired: ${summary.forfeitedAttainment}.` : ''}</p>
      {#if summary.forfeitedChoices}
        <p>{summary.forfeitedChoices.count} choice offers expired. These were alternatives, never a combined payout: {gold(summary.forfeitedChoices.gold)} gold, {#each Object.entries(summary.forfeitedChoices.stones) as [id, count]}{count} {stoneName(id)}; {/each}{#each Object.entries(summary.forfeitedChoices.skills) as [id, count]}{sm.byId[id]?.name} ×{count}; {/each}{#each Object.entries(summary.forfeitedChoices.fallback) as [id, count]}conditional fallback {count} {stoneName(id)}; {/each}</p>
      {/if}
      {#each Object.entries(summary.goods) as [id, row]}<p>{trade.byId[id].name}: {row.quantity} delivered · {gold(row.gold)} market gold paid</p>{/each}
      {#each Object.entries(summary.paidStones) as [id, count]}<p>Paid: {count} {stoneName(id)}</p>{/each}
      {#each Object.entries(summary.paidSkills) as [id, count]}<p>Paid: {sm.byId[id]?.name} ×{count}</p>{/each}
      {#each Object.entries(summary.forfeitedStones) as [id, count]}<p>Forfeited: {count} {stoneName(id)}</p>{/each}
      {#each Object.entries(summary.forfeitedSkills) as [id, count]}<p>Forfeited conditional skill promise: {sm.byId[id]?.name} ×{count}</p>{/each}
      {#each Object.entries(summary.forfeitedFallback) as [id, count]}<p>Unpaid conditional fallback promise: {count} {stoneName(id)}</p>{/each}
      <button disabled={!writer} onclick={() => onack(`summary:${townId}`)}>Acknowledge earlier recaps</button>
    </section>
  {/if}
  {#if history.length}<section class="history" aria-label="Delivery history"><h3>Completed and expired</h3>
    {#each history as contract (contract.id)}
      <details open={!contract.recapAcknowledged}><summary>{trade.byId[contract.good].name} · {contract.status} · {contract.delivered}/{contract.target}</summary>
        <p>{gold(contract.baseGold)} market gold was paid and kept.</p>
        {#if contract.paidBonus}<p class="paid text-good">{contract.reward.alternative ? 'Chosen reward' : 'Bonus'} earned: {questBonusText(contract.paidBonus)}{contract.paidBonus.treePoints ? ` + ${contract.paidBonus.treePoints} Tree Point` : ''}{contract.paidBonus.attainment ? ` + ${contract.paidBonus.attainment} Attainment Point` : ''}{contract.paidBonus.fallback ? ' (stored skill fallback)' : ''}</p>
        {:else}
          <p class="text-alarm">{contract.reward.alternative ? 'Choice offer expired · one of these could have been earned:' : 'Bonus forfeited:'}</p>
          {#each deliveryBonuses(contract.reward) as bonus}<p>{questBonusText(bonus)}{bonus.skill ? ' (or the stored skill fallback)' : ''}</p>{/each}
          {#if contract.reward.treePoints || contract.reward.attainment}<p class="text-alarm">Unpaid: {contract.reward.treePoints} Tree Point · {contract.reward.attainment} Attainment Point.</p>{/if}
        {/if}
        {#if !contract.recapAcknowledged}<button disabled={!writer} onclick={() => onack(contract.id)}>Acknowledge recap</button>{/if}
      </details>
    {/each}
  </section>{/if}
</section>

<style>
  .deliveries, .wants, .want, .tracked, .summary, .history { display: grid; gap: var(--spacing-md); min-width: 0; }
  .deliveries { font-size: var(--font-sm); }
  .deliveries p, .deliveries h3 { margin: 0; }
  .explanation { line-height: 1.5; }
  .want { padding: var(--spacing-md); border: 1px solid var(--edge); border-radius: var(--radius-card); background: var(--inset); }
  .want header, .actions { display: flex; align-items: center; gap: var(--spacing-md); flex-wrap: wrap; }
  .want header { justify-content: space-between; }
  .want header div { display: grid; gap: var(--spacing-xs); }
  .want header strong { font-family: var(--num); font-variant-numeric: tabular-nums; }
  .deliveries small { font-size: var(--font-xs); }
  .actions label { display: flex; align-items: center; gap: var(--spacing-sm); }
  .actions input { width: clamp(55px, 4.36vw, 90px); }
  .ack { justify-self: start; }
  .tracked, .summary, .history { border-top: 1px solid var(--line); padding-top: var(--spacing-md); }
  details { display: grid; gap: var(--spacing-sm); padding: var(--spacing-sm); border-bottom: 1px solid var(--line); }
  summary { cursor: pointer; color: var(--text); }
  details p { padding-top: var(--spacing-sm); }
</style>
