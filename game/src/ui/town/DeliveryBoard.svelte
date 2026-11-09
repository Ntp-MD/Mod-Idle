<script lang="ts">
  import { sm, TOWN, trade } from '../../engine/client';
  import { stoneName } from '@sim/gear/craft';
  import { deliveryTimeLeft, deliveryPauseReason, previewDelivery, contractById } from '@sim/town/delivery';
  import { npcOf } from '@sim/town/pricing';
  import { tradeBucket } from '@sim/town/trade';
  import type { GameState } from '@sim/core/types';
  import type { DeliveryContract } from '@sim/town/delivery-types';
  import { deliveryBonuses } from '@sim/town/quest-rewards';
  import { acquisitionSources, ACTIVITY_GUIDE } from '@sim/core/guidance';
  import QuestBonusPicker from './QuestBonusPicker.svelte';
  import EmptyNote from '../shared/EmptyNote.svelte';
  import { questBonusText } from './quest-rewards';
  import StoryScene from '../story/StoryScene.svelte';
  import { deliveryStoryView } from '../story/story-presenters';
  import type { StoryIntent } from '../story/story-scene';

  let { state: gameState, townId, writer, ondeliver, ontrack, onack, onaccept = () => {}, ondecline = () => {}, onroute = () => {}, onpinzone = () => {}, ontrackgoal = () => {},
    ontrackshortage = () => {}, goalId = null }: {
    state: GameState; townId: string; writer: boolean;
    ondeliver: (id: string, count: number, choice?: string, expected?: { delivered: number; status: 'open'; gold: number; acceptedAtDeliverySec: number | null }) => void;
    ontrack: (id: string, tracked: boolean) => void; onack: (id: string) => void;
    onaccept?: (id: string) => void; ondecline?: (id: string) => void;
    onroute?: (townId: string) => void;
    onpinzone?: (zone: number) => void;
    ontrackgoal?: (id: string) => void;
    ontrackshortage?: (good: string, want: number, origin: { kind: 'delivery'; id: string }) => void;
    goalId?: string | null;
  } = $props();
  let quantities = $state<Record<string, number>>({});
  let choices = $state<Record<string, { contract: DeliveryContract; choice: string }>>({});
  let actionRev = $state(0);
  const contracts = $derived.by(() => {
    const seen = new Set<string>();
    const rows: DeliveryContract[] = [];
    for (const rows_ of Object.values(gameState.town.contracts)) {
      for (const contract of rows_ as DeliveryContract[]) {
        if (contract.town !== townId && contract.destinationTown !== townId) continue;
        if (seen.has(contract.id)) continue;
        seen.add(contract.id);
        rows.push(contract);
      }
    }
    return rows;
  });
  const open = $derived(contracts.filter((contract) => contract.status === 'open'));
  const history = $derived(contracts.filter((contract) => contract.status !== 'open').slice().sort((a, b) =>
    b.terminalAt! - a.terminalAt! || a.kind.localeCompare(b.kind) || b.serial - a.serial));
  const tracked = $derived(gameState.town.trackedContractIds.map((id) => contractById(gameState, id)).filter((contract) => contract?.status === 'open'));
  const summary = $derived(gameState.town.deliverySummaries[townId]);
  const pause = $derived(deliveryPauseReason(gameState));
  const gold = (n: number) => n.toFixed(TOWN.trade.currency_decimals);
  const time = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const townName = (id: string) => TOWN.settlements.find((town) => town.id === id)?.name || id;
  const snapshot = (contract: DeliveryContract, gold: number) => ({
    delivered: contract.delivered, status: 'open' as const, gold,
    acceptedAtDeliverySec: contract.acceptedAtDeliverySec,
  });

  function viewFor(contract: DeliveryContract, count: number, choice?: string) {
    const good = trade.byId[contract.good];
    const preview = previewDelivery(gameState, contract.id, count, { writer }, choice);
    const source = townName(contract.town);
    const destination = townName(contract.destinationTown || contract.town);
    const base = deliveryStoryView({
      key: `delivery:${contract.id}:${contract.delivered}:${contract.status}:${contract.acceptedAtDeliverySec ?? 'open'}:${contract.baseGold}:${count}:${choice ?? ''}:${actionRev}`,
      status: contract.status, endReason: contract.endReason, kind: contract.kind ?? 'request',
      accepted: contract.acceptedAtDeliverySec != null,
      goodName: good.name, townName: source,
      destinationName: destination,
      speaker: npcOf(contract.issuerNpcId)?.name || contract.issuerNpcId,
      target: contract.target, delivered: contract.delivered,
      timeText: `${time(deliveryTimeLeft(gameState, contract))} left${pause ? ` · paused: ${pause}` : ''}`,
      paidText: `${gold(contract.baseGold)} market gold`,
      lastQuantity: contract.lastQuantity || undefined,
      bonusText: contract.paidBonus ? (contract.reward.alternative ? 'Chosen reward' : 'Bonus') : undefined,
      writable: writer,
    });
    const atSource = contract.town === townId;
    const atDestination = (contract.destinationTown || contract.town) === townId;
    let actions = base.actions.map((entry) => ({ ...entry }));
    let deliver: typeof actions = [];
    if (contract.status === 'open' && contract.kind === 'courier' && contract.acceptedAtDeliverySec == null && !atSource) {
      actions = actions.map((entry) => ({ ...entry, disabled: true, reason: `Accept or decline at ${source}` }));
      actions.push({ id: 'show-route', label: 'View route', kind: 'navigate', disabled: false, reason: '' });
    } else if (contract.status === 'open' && contract.kind === 'courier' && contract.acceptedAtDeliverySec != null) {
      actions = actions.filter((entry) => entry.id !== 'show-route');
      if (!atDestination) actions.push({ id: 'show-route', label: 'View route', kind: 'navigate', disabled: false, reason: '' });
      if (atDestination) deliver = [{ id: 'deliver', label: `Deliver ${count || 'goods'}`, kind: 'commit', disabled: !preview.ok, reason: preview.ok ? '' : preview.why || '' }];
    } else if (contract.status === 'open' && contract.kind !== 'courier') {
      deliver = [{ id: 'deliver', label: `Deliver ${count || 'goods'}`, kind: 'commit', disabled: !preview.ok, reason: preview.ok ? '' : preview.why || '' }];
    }
    return { view: base, preview, deliver, full: [...actions, ...deliver] };
  }
</script>

<section class="deliveries" aria-label="Delivery contracts">
  <p class="explanation text-dim">Hand-ins pay market value now · complete the count before the deadline for the bonus. Optional · {ACTIVITY_GUIDE.delivery.when} {ACTIVITY_GUIDE.delivery.helps}</p>
  {#if !writer}<p class="text-alarm" role="status">This tab is read-only. Deliveries, tracking and recap acknowledgement are disabled.</p>{/if}
  <div class="wants">
    {#each open as contract (contract.id)}
      {@const good = trade.byId[contract.good]}
      {@const carried = tradeBucket(gameState, good)[good.key] || 0}
      {@const remaining = contract.target - contract.delivered}
      {@const count = quantities[contract.id] ?? Math.max(1, Math.min(carried || remaining, remaining))}
      {@const choice = choices[contract.id]?.contract === contract ? choices[contract.id].choice : undefined}
      {@const story = viewFor(contract, count, choice)}
      {@const sources = acquisitionSources(contract.acquisition)}
      <StoryScene view={{ ...story.view, actions: story.full }} onaction={(intent: StoryIntent) => {
        if (intent.actionId === 'deliver') {
          ondeliver(contract.id, count, choice, snapshot(contract, story.preview.ok ? story.preview.quote.gold : 0));
          actionRev++;
        } else if (intent.actionId === 'courier-accept') { onaccept(contract.id); actionRev++; }
        else if (intent.actionId === 'courier-decline') { ondecline(contract.id); actionRev++; }
        else if (intent.actionId === 'show-route') onroute(contract.town === townId ? (contract.destinationTown || contract.town) : contract.town);
      }}>
        {#snippet controls()}
          <QuestBonusPicker state={gameState} options={deliveryBonuses(contract.reward)} name={`reward-${contract.id}`} {choice} {writer} onchoose={(choice) => { choices[contract.id] = { contract, choice }; }} />
          <p class="text-dim">Every completion earns Haggling XP{contract.reward.attainment ? ` + ${contract.reward.attainment} Attainment Point` : ''}{contract.reward.treePoints ? ` + ${contract.reward.treePoints} Tree Point` : ''}.</p>
          {#if contract.reward.milestone}<p class="text-good">First Delivery milestone in {townName(contract.town)} · the Tree Point is guaranteed with either reward.</p>{/if}
          <p class="carried text-dim">{carried} carried · {remaining} still wanted · {gold(contract.baseGold)} market gold already paid</p>
          {#if carried < remaining}
            <div class="where card-tile" role="group" aria-label={`Where to find ${good.name}`}>
              <strong>Short {remaining - carried} {good.name}</strong>
              <ul>
                {#each sources as source (`${source.label}:${source.detail}`)}
                  <li><span>{source.label} · {source.detail}</span>
                    {#each source.pins as pin (pin.zone)}
                      <button type="button" class="pin" onclick={() => onpinzone(pin.zone)} aria-label={`Pin ${pin.label} on the map`}>Pin {pin.label}</button>
                    {/each}
                  </li>
                {/each}
              </ul>
              <button type="button" disabled={!writer} onclick={() => ontrackshortage(contract.good, remaining, { kind: 'delivery', id: contract.id })}>Track the missing as a goal</button>
            </div>
          {/if}
          <div class="actions">
            <label>Quantity <input type="number" min="1" max={remaining} step="1" aria-label={`Delivery quantity for ${good.name} at ${townName(contract.town)}`} value={count} oninput={(event) => quantities[contract.id] = event.currentTarget.valueAsNumber} /></label>
            <button disabled={!writer} aria-pressed={gameState.town.trackedContractIds.includes(contract.id)} onclick={() => ontrack(contract.id, !gameState.town.trackedContractIds.includes(contract.id))}>{gameState.town.trackedContractIds.includes(contract.id) ? 'Untrack' : 'Track'}</button>
            <button disabled={!writer} aria-pressed={goalId === contract.id} onclick={() => ontrackgoal(contract.id)}>{goalId === contract.id ? 'Goal pinned' : 'Pin as next goal'}</button>
          </div>
          <small>{story.preview.ok ? `Hand-in pays ${gold(story.preview.quote.gold)} market gold now${story.preview.complete ? ` plus the stored completion bonus${story.preview.treePoints ? ` (${story.preview.treePoints} tree point${story.preview.treePoints === 1 ? '' : 's'})` : ''}` : '; the bonus waits for the full count'}.` : story.preview.why}</small>
          {#if !contract.recapAcknowledged && contract.lastQuantity}<p class="recap text-good" role="status">Last delivery: {contract.lastQuantity} · {gold(contract.lastGold)} market gold paid. Total {contract.delivered} delivered.</p><button class="ack" disabled={!writer} onclick={() => onack(contract.id)}>Acknowledge delivery</button>{/if}
        {/snippet}
      </StoryScene>
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
      <p>{summary.completed} completed · {summary.expired} expired{summary.declined ? ` · ${summary.declined} declined` : ''}. Actual completion gold paid: {gold(summary.paidGold)}. Fixed gold forfeited: {gold(summary.forfeitedGold)}.{summary.paidTreePoints ? ` Tree points paid: ${summary.paidTreePoints}.` : ''}{summary.paidAttainment ? ` Attainment paid: ${summary.paidAttainment}.` : ''}{summary.forfeitedTreePoints ? ` Tree-point promises expired: ${summary.forfeitedTreePoints}.` : ''}{summary.forfeitedAttainment ? ` Attainment promises expired: ${summary.forfeitedAttainment}.` : ''}</p>
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
  {#if history.length}<section class="history" aria-label="Delivery history"><h3>Completed, expired and declined</h3>
    {#each history as contract (contract.id)}
      {@const historyStory = viewFor(contract, 0, undefined)}
      <StoryScene view={historyStory.view} onaction={() => {}}>
        {#snippet controls()}
          {#if contract.endReason !== 'declined'}<p>{gold(contract.baseGold)} market gold was paid and kept.</p>{/if}
          {#if contract.paidBonus}<p class="paid text-good">{contract.reward.alternative ? 'Chosen reward' : 'Bonus'} earned: {questBonusText(contract.paidBonus)}{contract.paidBonus.treePoints ? ` + ${contract.paidBonus.treePoints} Tree Point` : ''}{contract.paidBonus.attainment ? ` + ${contract.paidBonus.attainment} Attainment Point` : ''}{contract.paidBonus.fallback ? ' (stored skill fallback)' : ''}</p>
          {:else if contract.endReason === 'declined'}
            <p class="text-note">Declined · no goods, gold or completion reward changed.</p>
          {:else}
            <p class="text-alarm">{contract.reward.alternative ? 'Choice offer expired · one of these could have been earned:' : 'Bonus forfeited:'}</p>
            {#each deliveryBonuses(contract.reward) as bonus}<p>{questBonusText(bonus)}{bonus.skill ? ' (or the stored skill fallback)' : ''}</p>{/each}
            {#if contract.reward.treePoints || contract.reward.attainment}<p class="text-alarm">Unpaid: {contract.reward.treePoints} Tree Point · {contract.reward.attainment} Attainment Point.</p>{/if}
          {/if}
          {#if !contract.recapAcknowledged}<button disabled={!writer} onclick={() => onack(contract.id)}>Acknowledge recap</button>{/if}
        {/snippet}
      </StoryScene>
    {/each}
  </section>{/if}
</section>

<style>
  .deliveries, .wants, .tracked, .summary, .history { display: grid; gap: var(--spacing-md); min-width: 0; }
  .deliveries { font-size: var(--font-sm); }
  .deliveries p, .deliveries h3 { margin: 0; }
  .carried { color: var(--dim); }
  .where { display: grid; gap: var(--spacing-xs); padding: var(--spacing-sm); }
  .where strong { font-size: var(--font-xs); }
  .where ul { margin: 0; padding-left: 18px; font-size: var(--font-xs); }
  .where li { display: grid; gap: 4px; }
  .pin { font-size: var(--font-xs); padding: 0 var(--spacing-xs); }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm); }
  .actions label { display: inline-flex; gap: var(--spacing-sm); align-items: center; font-size: var(--font-xs); }
  .actions input { width: clamp(55px, 4.36vw, 90px); }
  .ack { justify-self: start; }
</style>
