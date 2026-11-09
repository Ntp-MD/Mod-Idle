<script lang="ts">
  import { TOWN, trade } from '../../engine/client';
  import { npcOf } from '@sim/town/pricing';
  import { deliveryTimeLeft, deliveryPauseReason } from '@sim/town/delivery';
  import type { DeliveryContract } from '@sim/town/delivery-types';
  import type { GameState } from '@sim/core/types';
  import StoryScene from '../story/StoryScene.svelte';
  import { deliveryStoryView } from '../story/story-presenters';
  import type { StoryIntent } from '../story/story-scene';

  let { state: gameState, contract, writer, ontrack, ondetails, ondismiss, onaccept = () => {}, ondecline = () => {} }: {
    state: GameState; contract: DeliveryContract; writer: boolean;
    ontrack: () => void; ondetails: () => void; ondismiss: () => void;
    onaccept?: () => void; ondecline?: () => void;
  } = $props();
  const town = $derived(TOWN.settlements.find((entry) => entry.id === contract.town)!);
  const destination = $derived(TOWN.settlements.find((entry) => entry.id === contract.destinationTown)!);
  const pause = $derived(deliveryPauseReason(gameState));
  const speaker = $derived(npcOf(contract.issuerNpcId)?.name || contract.issuerNpcId);

  const view = $derived.by(() => {
    const base = deliveryStoryView({
      key: `delivery:${contract.id}:${contract.delivered}:${contract.status}:${contract.acceptedAtDeliverySec ?? 'open'}:${contract.baseGold}`,
      status: contract.status, endReason: contract.endReason, kind: contract.kind ?? 'request',
      accepted: contract.acceptedAtDeliverySec != null,
      goodName: trade.byId[contract.good].name, townName: town.name,
      destinationName: destination?.name ?? town.name, speaker,
      target: contract.target, delivered: contract.delivered,
      timeText: `${Math.ceil(deliveryTimeLeft(gameState, contract) / 60)} minutes left${pause ? ` · paused: ${pause}` : ''}`,
      writable: writer,
    });
    const extra = [
      { id: 'track', label: 'Track want', kind: 'navigate' as const, disabled: false, reason: '' },
      { id: 'show-deliveries', label: 'View delivery', kind: 'navigate' as const, disabled: false, reason: '' },
      { id: 'dismiss', label: 'Dismiss', kind: 'dismiss' as const, disabled: false, reason: '' },
    ];
    return { ...base, actions: [...base.actions, ...extra] };
  });

  function onStoryAction(intent: StoryIntent) {
    if (intent.actionId === 'track') ontrack();
    else if (intent.actionId === 'show-deliveries' || intent.actionId === 'show-route') ondetails();
    else if (intent.actionId === 'dismiss') ondismiss();
    else if (intent.actionId === 'courier-accept') onaccept();
    else if (intent.actionId === 'courier-decline') ondecline();
  }
</script>

<StoryScene {view} onaction={onStoryAction}>
  {#snippet controls()}
    <p class="text-note">Each hand-in pays the live market value at the destination.</p>
  {/snippet}
</StoryScene>

<style>
  p { margin: 0; }
</style>
