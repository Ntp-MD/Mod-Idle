<script lang="ts">
  import { TOWN, fieldwork } from '../engine/client';
  import { npcOf, priceGold, stockOf, canBuy, settlementById } from '../sim/town';
  import { atSettlement } from '../sim/craft';
  import { trade, tradeInventory, quoteSale, marketDestinations, canProcess } from '../sim/trade';
  import { fieldMasteryLevel } from '../sim/fieldwork';
  import type { GameState } from '../sim/types';
  import DeliveryBoard from './DeliveryBoard.svelte';
  import BlackMarketBoard from './BlackMarketBoard.svelte';

  let { state: gameState, town, here, onbuy, onsell, ontrade, onprocess, onroute, writer, ondeliver, ontrack, onack, onblackmarketbuy, view = $bindable('trade'), marketId = $bindable('') }: {
    state: GameState; town: any; here: boolean;
    onbuy: (rowId: string, settlementId?: string) => void; onsell: () => void;
    ontrade: (id: string, count: number) => void; onprocess: (id: string) => void; onroute: (id: string) => void;
    writer: boolean; ondeliver: (id: string, count: number) => void; ontrack: (id: string, tracked: boolean) => void; onack: (id: string) => void;
    onblackmarketbuy: (townId: string, offerId: string) => void;
    view?: 'trade' | 'workshop' | 'stall' | 'deliveries' | 'black-market'; marketId?: string;
  } = $props();
  let selectedId = $state('');
  let quantity = $state(1);
  let filter = $state('all');
  const market = $derived(settlementById(marketId) || town);
  const local = $derived(atSettlement(gameState, market.id));
  const cargo = $derived(tradeInventory(gameState));
  const selected = $derived(trade.byId[selectedId] || cargo[0]?.good || trade.byId['material:copper-ore']);
  const carried = $derived(cargo.find((row) => row.good.id === selected.id)?.count || 0);
  const amount = $derived(Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1);
  const quote = $derived(quoteSale(gameState, market.id, selected.id, amount)!);
  const buyers = $derived(marketDestinations(gameState, selected.id, amount));
  const visibleCargo = $derived(cargo.filter((row) => filter === 'all' || row.good.bucket === filter));
  const profile = $derived(TOWN.trade.towns[market.id as keyof typeof TOWN.trade.towns]);
  const stock = $derived(stockOf(market.id));
  const sourceNames = $derived(selected.sourceZones.map((zone) => TOWN.settlements.find((entry) => entry.zone === zone)?.name).filter(Boolean).join(', '));
  const gold = (value: number) => value.toFixed(TOWN.trade.currency_decimals);
  const costText = (costs: Record<string, number>) => Object.entries(costs).map(([id, n]) => `${n} ${fieldwork.materialById[id]?.name || id}`).join(' · ');
  /** tab badges: what waits in this settlement, so the tabs say whether a look is worth it */
  const openWants = $derived((gameState.town.contracts[market.id] || []).filter((contract) => contract.status === 'open').length);
  const unreadRecaps = $derived((gameState.town.contracts[market.id] || []).filter((contract) => contract.status !== 'open' && !contract.recapAcknowledged).length
    + (gameState.town.deliverySummaries[market.id]?.unread ? 1 : 0));
  const blackMarketStock = $derived(gameState.town.blackMarket[market.id]?.offers.filter((offer) => offer.remaining > 0).length || 0);
  const haggling = $derived(trade.haggling(gameState.town.hagglingXp));
</script>

<div class="market">
  <header class="market-head">
    <p class="purse"><b class="text-value">{gold(gameState.counters.gold)}</b> gold</p>
    <label>Market <select aria-label="Browse settlement market" value={market.id} onchange={(event) => marketId = event.currentTarget.value}>
      {#each TOWN.settlements as entry (entry.id)}<option value={entry.id}>{entry.name}{entry.id === town.id ? ' · current area' : ''}</option>{/each}
    </select></label>
    <span class="location text-note">{!writer ? 'Read-only prices' : local ? 'Trading here' : 'Prices only · travel here to trade'}</span>
  </header>
  <p class="text-note">Haggling Lv {haggling.level}/{TOWN.trade.haggling.level_cap} · {gameState.town.hagglingXp.toFixed(1)} XP{haggling.nextXp !== null ? ` / ${haggling.nextXp} for next level` : ' · max level'} · sales +{((haggling.saleMult - 1) * 100).toFixed(1)}% · new delivery bonuses +{((haggling.deliveryMult - 1) * 100).toFixed(1)}% · town services −{((1 - haggling.serviceMult) * 100).toFixed(1)}%. Complete deliveries to earn XP.</p>
  <nav class="market-tabs" aria-label="Market sections">
    <button class="selectable" class:selected={view === 'trade'} onclick={() => view = 'trade'}>Sell goods & routes</button>
    <button class="selectable" class:selected={view === 'deliveries'} onclick={() => view = 'deliveries'}>Delivery wants{#if openWants + unreadRecaps}<b class="badge badge-count tab-count" title={`${openWants} open · ${unreadRecaps} unread recap${unreadRecaps === 1 ? '' : 's'}`}>{openWants + unreadRecaps}</b>{/if}</button>
    <button class="selectable" class:selected={view === 'workshop'} onclick={() => view = 'workshop'}>Workshop</button>
    <button class="selectable" class:selected={view === 'stall'} onclick={() => view = 'stall'}>Town stall</button>
    <button class="selectable" class:selected={view === 'black-market'} onclick={() => view = 'black-market'}>Black Market{#if blackMarketStock}<b class="badge badge-count tab-count" title={`${blackMarketStock} offer${blackMarketStock === 1 ? '' : 's'} in stock`}>{blackMarketStock}</b>{/if}</button>
  </nav>
  {#if view === 'trade'}
    <p class="market-note text-note">{profile.needs} Supplying a category lowers its price.</p>
    <div class="trade-layout">
      <section class="cargo" aria-label="Carried trade goods">
        <header><h3>Your cargo</h3><select aria-label="Filter cargo" bind:value={filter}>
          <option value="all">All goods</option><option value="junk">Junk</option><option value="material">Materials</option><option value="food">Provisions</option><option value="herb">Herbs</option>
        </select></header>
        <div class="cargo-list">
          {#each visibleCargo as { good, count } (good.id)}
            <button class="cargo-row selectable" class:selected={selected.id === good.id} onclick={() => { selectedId = good.id; quantity = count; }} aria-pressed={selected.id === good.id}>
              <span><b>{good.name}</b><small>{good.group.replace('junk:', '')} · ×{count}</small></span>
              <strong class="text-value">{gold(quoteSale(gameState, market.id, good.id, count)!.gold)}<small>gold / stack</small></strong>
            </button>
          {:else}
            <p class="empty text-note">No carried goods in this category. Mines, Groves, hunts and the Farm supply goods for town markets.</p>
          {/each}
        </div>
        <button disabled={!writer || !local || !cargo.some((row) => row.good.bucket === 'junk')} onclick={onsell}>Sell all junk here</button>
        <small>Food, herbs and materials sell only when you select them.</small>
      </section>
      <section class="offer" aria-label="Sale quote and trade routes">
        <div class="item-heading"><h3>{selected.name}</h3><span>{carried} carried</span></div>
        <label class="catalogue">Compare an item <select aria-label="Compare trade item" value={selected.id} onchange={(event) => selectedId = event.currentTarget.value}>
          {#each trade.goods as good (good.id)}<option value={good.id}>{good.name}</option>{/each}
        </select></label>
        <p class="provenance text-note"><b>Sources</b> {sourceNames || (selected.bucket === 'herb' ? 'Farm plots and herb drops' : selected.bucket === 'material' ? 'Field gathering or the Workshop' : 'Hunts and cooking')}</p>
        <p class="provenance"><b>Uses</b> {selected.uses.length ? selected.uses.join(', ') : selected.bucket === 'food' ? 'Provisions for travel and combat; town trade' : 'Town trade'}{selected.uses.length ? ' · or sell to a buyer' : ''}</p>
        <div class="sale-line">
          <label>Quantity <input type="number" aria-label="Sale quantity" min="1" step="1" bind:value={quantity} /></label>
          <button disabled={carried === 0} onclick={() => quantity = carried}>All carried</button>
          <div class="sale-actions">
            <strong class="text-value">{gold(quote.gold)} gold</strong>
            <button class="sell btn-gold" disabled={!writer || !local || amount > carried} onclick={() => ontrade(selected.id, amount)}>Sell {amount} here</button>
          </div>
        </div>
        <p class="demand text-note">{market.name} · {Math.round(quote.demand * 100)}% demand for {selected.group.replace('junk:', '')} · {local ? 'quote includes the price drop across this sale' : 'walk here to sell'}</p>
        <h4>Buyers for this quantity</h4>
        <div class="buyer-list">
          {#each buyers as buyer (buyer.town.id)}
            <div class="buyer" class:chosen={buyer.town.id === market.id}>
              <button class="buyer-name" onclick={() => marketId = buyer.town.id}>{buyer.town.name}</button>
              <span class="text-value">{gold(buyer.quote.gold)} gold</span>
              <small>{buyer.blocks} blocks · {buyer.fare == null ? 'Waypoint unopened' : `warp ${gold(buyer.fare)} gold · net ${gold(buyer.quote.gold - buyer.fare)}`}</small>
              <button disabled={buyer.blocks === 0} onclick={() => onroute(buyer.town.id)}>Map route</button>
            </div>
          {/each}
        </div>
        <small class="footnote">Quotes use current demand.</small>
      </section>
    </div>
  {:else if view === 'deliveries'}
    <DeliveryBoard state={gameState} townId={market.id} {writer} {ondeliver} {ontrack} {onack} />
  {:else if view === 'black-market'}
    <BlackMarketBoard state={gameState} townId={market.id} here={local} {writer} onbuy={onblackmarketbuy} />
  {:else if view === 'workshop'}
    <p class="market-note">Regional materials become finished trade goods.</p>
    <div class="workshop">
      {#each fieldwork.workshopRecipes as recipe (recipe.id)}
        {@const verdict = canProcess(gameState, recipe.id)}
        {@const batch = recipe.skill === 'smithing' ? 1 + Math.floor(fieldMasteryLevel(gameState, 'smithing', recipe.id) / 20) : 1}
        <article class="workshop-row">
          <div><h3>{recipe.name} ×{recipe.yield}</h3><p>{costText(recipe.materials)}</p><small>{recipe.skill} Lv {recipe.level} · +{recipe.xp} skill XP</small></div>
          <span>Base value {gold(trade.byId[`material:${recipe.id}`].value)} gold</span>
          <button disabled={!writer || !local || !verdict.ok} title={local ? verdict.why || 'Process gathered materials' : 'Travel to this market first'} onclick={() => onprocess(recipe.id)}>Make ×{batch}</button>
        </article>
      {/each}
    </div>
  {:else}
    <p class="market-note">Gold buys town services, organisation and appearance.</p>
    <div class="wares">
      {#each stock as row (row.id)}
        {@const price = priceGold(row, market.id, gameState)}
        {@const verdict = canBuy(gameState, market.id, row.id)}
        <article class="ware"><h3>{row.item}</h3><p class="text-note">{row.kind} · {npcOf(row.npc)?.name || row.npc}</p><strong class="text-value">{gold(price)} gold</strong>
          {#if !verdict.ok}<small class="text-note">{verdict.why}</small>{/if}
          <button disabled={!writer || !local || !verdict.ok} title={verdict.why || 'Buy this town service'} onclick={() => onbuy(row.id, market.id)}>Buy</button>
        </article>
      {:else}<p>No stall lines at this settlement.</p>{/each}
    </div>
  {/if}
</div>

<style>
  .market { display: grid; gap: var(--spacing-md); min-height: 0; height: 100%; align-content: start; }
  .market-head, .market-tabs, .sale-line, .item-heading, .cargo > header { display: flex; align-items: center; gap: var(--spacing-md); flex-wrap: wrap; }
  .market-head { justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: var(--spacing-sm); }
  .market h3, .market h4, .market p { margin: 0; }
  .market h4 { font-size: var(--font-sm); }
  .market small { font-size: var(--font-xs); }
  .purse b { font-family: var(--num); font-size: var(--font-xl); }
  .market label { display: inline-flex; gap: var(--spacing-sm); align-items: center; font-size: var(--font-xs); }
  .market-tabs { gap: var(--spacing-sm); }
  .market-tabs button { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
    .tab-count { padding-inline: var(--spacing-xs); }
  .trade-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: var(--spacing-lg); min-height: 0; }
  .cargo, .offer { display: grid; align-content: start; gap: var(--spacing-md); min-width: 0; min-height: 0; }
  .cargo > header, .item-heading { justify-content: space-between; }
  .cargo-list { overflow: auto; max-height: clamp(180px, 20vw, 420px); display: grid; gap: var(--spacing-xs); }
  .cargo-row { display: flex; justify-content: space-between; gap: var(--spacing-md); text-align: left; }
  .cargo-row span, .cargo-row strong { display: grid; gap: var(--spacing-xs); }
  .cargo-row strong { font-variant-numeric: tabular-nums; text-align: right; }
  .cargo-row b { font-size: var(--font-sm); font-weight: 500; }
  .cargo > button { justify-self: start; }
  .catalogue select { min-width: 0; max-width: clamp(150px, 16.94vw, 350px); }
  .provenance { line-height: 1.5; }
  .sale-line { justify-content: space-between; padding: var(--spacing-md); background: var(--inset); border-radius: var(--radius-card); gap: var(--spacing-sm); }
  .sale-actions { display: flex; align-items: center; gap: var(--spacing-sm); }
  .sale-line input { width: clamp(55px, 4.36vw, 90px); }
  .buyer-list { display: grid; max-height: clamp(220px, 26vw, 520px); overflow: auto; }
  .buyer { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.6fr) auto; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-sm); border-bottom: 1px solid var(--line); }
  .buyer.chosen { background: var(--surface-selected); }
  .buyer > span { font-variant-numeric: tabular-nums; font-size: var(--font-sm); }
  .buyer-name { text-align: left; border: 0; background: transparent; }
  .footnote { line-height: 1.5; }
  .workshop { display: grid; gap: var(--spacing-sm); }
  .workshop-row { display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-md); border-bottom: 1px solid var(--line); }
  .workshop-row div { display: grid; gap: var(--spacing-xs); }
  .workshop-row p { font-size: var(--font-sm); }
  .wares { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-md); }
  .ware { display: grid; gap: var(--spacing-sm); align-content: start; padding: var(--spacing-md); background: var(--inset); border: 1px solid var(--line); border-radius: var(--radius-card); }
  .ware button { justify-self: start; }
  @media (max-width: 1023px) { .trade-layout { grid-template-columns: minmax(0, 1fr); } .wares { grid-template-columns: minmax(0, 1fr); } }
</style>
