<script lang="ts">
  import { E, blackMarket, sm, trade, TOWN } from '../engine/client';
  import { blackMarketOfferReason, blackMarketState } from '../sim/black-market';
  import { stoneName } from '../sim/craft';
  import { skillIcon, stackIcon } from '../icon';
  import type { GameState } from '../sim/types';
  let { state, townId, here, writer, onbuy }: { state: GameState; townId: string; here: boolean; writer: boolean; onbuy: (town: string, offerId: string) => void } = $props();
  const stock = $derived(blackMarketState(state, townId));
  const gold = (value: number) => value.toFixed(TOWN.trade.currency_decimals);
  const countdown = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const description = (offer: any) => offer.kind === 'material'
    ? `${trade.byId[offer.good]?.name || offer.good} ×${offer.count}`
    : offer.kind === 'stone'
      ? `${stoneName(offer.stone)} ×${offer.count}`
      : `${sm.byId[offer.skill]?.name || offer.skill} · XP Level ${offer.level}`;
  /** The offer's own mark off the shared registry: the bag's stack glyph for goods and stones,
   *  the skill's own icon for an entitlement, each with the registry's category fallback. */
  const offerIcon = (offer: any): string => {
    if (offer.kind === 'material') {
      const good = trade.byId[offer.good];
      return stackIcon('material', good?.name || String(offer.good), `material:${good?.key || offer.good}`);
    }
    if (offer.kind === 'stone') return stackIcon('stone', stoneName(offer.stone), `stone:${offer.stone}`);
    return skillIcon(String(offer.skill), sm.byId[offer.skill]?.type);
  };
</script>

<section class="black-market" aria-label="Black Market stock">
  <p class="market-note">Rare materials, craft stones and skill XP Levels at fixed prices and stock.</p>
  {#if !here}
    <p class="state text-note">Stand in {TOWN.settlements.find((town: any) => town.id === townId)?.name || 'the issuing settlement'} to browse its live stock and buy.</p>
  {:else if !stock}
    <p class="state text-note">The Black Market stock will be prepared on its next online settlement tick.</p>
  {:else}
    <p class="refresh text-note">Refresh in {countdown(stock.refreshRemainingSec)} · remaining stock is saved for this settlement.</p>
    <div class="offers">
      {#each stock.offers as offer (offer.id)}
        {@const refusal = blackMarketOfferReason(state, townId, offer.id, writer)}
        <article class="offer card-read" class:sold={offer.remaining === 0}>
          <div><img class="offer-icon" src={offerIcon(offer)} alt="" aria-hidden="true" />
            <span class="offer-text"><h3>{description(offer)}</h3><small>{offer.kind === 'skill' ? 'XP Level entitlement · no Duplicate Ladder increase' : offer.kind === 'material' ? 'Rare material' : 'Craft stone'} · stock {offer.remaining}</small></span>
          </div>
          <strong class="text-value">{gold(offer.price)} gold</strong>
          <button disabled={!!refusal} title={refusal || 'Buy this exact offer'} onclick={() => onbuy(townId, offer.id)}>
            {offer.remaining > 0 ? 'Buy' : 'Sold out'}
          </button>
          {#if refusal}<small>{refusal}</small>{/if}
        </article>
      {:else}
        <p class="state text-note">No stock is available until the next refresh.</p>
      {/each}
    </div>
    {#if !writer}<p class="state text-note">This tab is read-only. Prices and remaining stock are visible; purchases wait for account-writer access.</p>{/if}
  {/if}
</section>

<style>
  .black-market { display: grid; gap: var(--spacing-md); align-content: start; }
  .black-market p { margin: 0; }
  .offers { display: grid; grid-template-columns: repeat(auto-fit, minmax(clamp(260px, 20vw, 360px), 1fr)); gap: var(--spacing-sm); }
  .offer { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--spacing-sm); align-items: center; padding: var(--spacing-sm); }
  .offer > div { display: flex; align-items: center; gap: var(--spacing-sm); min-width: 0; }
  .offer-icon { width: calc(var(--icon-label) * 1.5); height: calc(var(--icon-label) * 1.5); flex: none; object-fit: contain; }
  .offer-text { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .offer h3 { margin: 0; }
  .offer strong { white-space: nowrap; }
  .offer button { grid-column: 2; }
  .offer.sold { opacity: .72; }
</style>
