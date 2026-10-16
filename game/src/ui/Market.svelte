<script lang="ts">
  import { TOWN, fieldwork } from '../engine/client';
  import { npcOf, priceGold, stockOf, canBuy, settlementById } from '../sim/town';
  import { atSettlement } from '../sim/craft';
  import { trade, tradeInventory, quoteSale, marketDestinations, canProcess } from '../sim/trade';
  import type { GameState } from '../sim/types';

  let { state: gameState, town, here, onbuy, onsell, ontrade, onprocess, onroute }: {
    state: GameState; town: any; here: boolean;
    onbuy: (rowId: string, settlementId?: string) => void; onsell: () => void;
    ontrade: (id: string, count: number) => void; onprocess: (id: string) => void; onroute: (id: string) => void;
  } = $props();
  let view = $state<'trade' | 'workshop' | 'stall'>('trade');
  let marketId = $state('');
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
</script>

<div class="market">
  <header class="market-head">
    <p class="purse"><b>{gold(gameState.counters.gold)}</b> gold</p>
    <label>Market <select aria-label="Browse settlement market" value={market.id} onchange={(event) => marketId = event.currentTarget.value}>
      {#each TOWN.settlements as entry (entry.id)}<option value={entry.id}>{entry.name}{entry.id === town.id ? ' · current area' : ''}</option>{/each}
    </select></label>
    <span class="location">{local ? 'Trading here' : 'Prices only · travel here to trade'}</span>
  </header>
  <nav class="market-tabs" aria-label="Market sections">
    <button class:selected={view === 'trade'} onclick={() => view = 'trade'}>Sell goods & routes</button>
    <button class:selected={view === 'workshop'} onclick={() => view = 'workshop'}>Workshop</button>
    <button class:selected={view === 'stall'} onclick={() => view = 'stall'}>Town stall</button>
  </nav>
  {#if view === 'trade'}
    <p class="market-note">{profile.needs} Supplying a category lowers its price; demand recovers over {TOWN.trade.recovery_sec / 3600} game hours.</p>
    <div class="trade-layout">
      <section class="cargo" aria-label="Carried trade goods">
        <header><h3>Your cargo</h3><select aria-label="Filter cargo" bind:value={filter}>
          <option value="all">All goods</option><option value="junk">Junk</option><option value="material">Materials</option><option value="food">Provisions</option><option value="herb">Herbs</option>
        </select></header>
        <div class="cargo-list">
          {#each visibleCargo as { good, count } (good.id)}
            <button class="cargo-row" class:selected={selected.id === good.id} onclick={() => { selectedId = good.id; quantity = count; }} aria-pressed={selected.id === good.id}>
              <span><b>{good.name}</b><small>{good.group.replace('junk:', '')} · ×{count}</small></span>
              <strong>{gold(quoteSale(gameState, market.id, good.id, count)!.gold)}<small>gold / stack</small></strong>
            </button>
          {:else}
            <p class="empty">No carried goods in this category. Mines, Groves, hunts and the Farm supply goods for town markets.</p>
          {/each}
        </div>
        <button disabled={!local || !cargo.some((row) => row.good.bucket === 'junk')} onclick={onsell}>Sell all junk here</button>
        <small>Food, herbs and materials are sold only when you select them. Keep supplies for Camp and recipes.</small>
      </section>
      <section class="offer" aria-label="Sale quote and trade routes">
        <div class="item-heading"><h3>{selected.name}</h3><span>{carried} carried</span></div>
        <label class="catalogue">Compare an item <select aria-label="Compare trade item" value={selected.id} onchange={(event) => selectedId = event.currentTarget.value}>
          {#each trade.goods as good (good.id)}<option value={good.id}>{good.name}</option>{/each}
        </select></label>
        <p class="provenance"><b>Sources</b> {sourceNames || (selected.bucket === 'herb' ? 'Farm plots and herb drops' : selected.bucket === 'material' ? 'Field gathering or the Workshop' : 'Hunts and cooking')}</p>
        <p class="provenance"><b>Uses</b> {selected.uses.length ? selected.uses.join(', ') : selected.bucket === 'food' ? 'Provisions for travel and combat; town trade' : 'Town trade'}{selected.uses.length ? ' · or sell to a buyer' : ''}</p>
        <div class="sale-line">
          <label>Quantity <input type="number" aria-label="Sale quantity" min="1" step="1" bind:value={quantity} /></label>
          <button disabled={carried === 0} onclick={() => quantity = carried}>All carried</button>
          <strong>{gold(quote.gold)} gold</strong>
          <button class="sell" disabled={!local || amount > carried} onclick={() => ontrade(selected.id, amount)}>Sell {amount} here</button>
        </div>
        <p class="demand">{market.name} · {Math.round(quote.demand * 100)}% demand for {selected.group.replace('junk:', '')} · {local ? 'quote includes the price drop across this sale' : 'walk here to sell'}</p>
        <h4>Buyers for this quantity</h4>
        <div class="buyer-list">
          {#each buyers as buyer (buyer.town.id)}
            <div class="buyer" class:chosen={buyer.town.id === market.id}>
              <button class="buyer-name" onclick={() => marketId = buyer.town.id}>{buyer.town.name}</button>
              <span>{gold(buyer.quote.gold)} gold</span>
              <small>{buyer.blocks} blocks · {buyer.fare == null ? 'Waypoint unopened' : `warp ${gold(buyer.fare)} gold · net ${gold(buyer.quote.gold - buyer.fare)}`}</small>
              <button disabled={buyer.blocks === 0} onclick={() => onroute(buyer.town.id)}>Map route</button>
            </div>
          {/each}
        </div>
        <small class="footnote">Quotes use current demand. A walk costs time and provisions; a warp spends gold. Demand can recover during the journey. Gold fractions carry into your next sale.</small>
      </section>
    </div>
  {:else if view === 'workshop'}
    <p class="market-note">Turn regional materials into finished trade goods. Compare buyers before using stock you may need for cooking or Camp.</p>
    <div class="workshop">
      {#each fieldwork.F.workshop_recipes as recipe (recipe.id)}
        {@const verdict = canProcess(gameState, recipe.id)}
        <article class="workshop-row">
          <div><h3>{recipe.name} ×{recipe.yield}</h3><p>{costText(recipe.materials)}</p><small>{recipe.skill} Lv {recipe.level} · +{recipe.xp} skill XP</small></div>
          <span>Base value {gold(trade.byId[`material:${recipe.id}`].value)} gold</span>
          <button disabled={!local || !verdict.ok} title={local ? verdict.why || 'Process gathered materials' : 'Travel to this market first'} onclick={() => onprocess(recipe.id)}>Make</button>
        </article>
      {/each}
    </div>
  {:else}
    <p class="market-note">Gold buys town services, organisation and appearance. Prices follow this settlement's band.</p>
    <div class="wares">
      {#each stock as row (row.id)}
        {@const price = priceGold(row, market.id, gameState)}
        {@const verdict = canBuy(gameState, market.id, row.id)}
        <article class="ware"><h3>{row.item}</h3><p>{row.kind} · {npcOf(row.npc)?.name || row.npc}</p><strong>{gold(price)} gold</strong>
          <button disabled={!local || !verdict.ok} title={verdict.why || 'Buy this town service'} onclick={() => onbuy(row.id, market.id)}>Buy</button>
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
  .market h3 { font-size: var(--font-sm); color: var(--gold); }
  .market h4 { font-size: var(--font-sm); }
  .market small, .market-note, .provenance, .location, .demand { color: var(--dim); font-size: var(--font-xs); }
  .purse b { font-family: var(--num); color: var(--gold); font-size: var(--font-xl); font-variant-numeric: tabular-nums; }
  .market label { display: inline-flex; gap: var(--spacing-sm); align-items: center; font-size: var(--font-xs); }
  .market-tabs { gap: var(--spacing-sm); }
  .market-tabs .selected, .cargo-row.selected { border-color: var(--gold); background: var(--surface-selected); }
  .trade-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: var(--spacing-lg); min-height: 0; }
  .cargo, .offer { display: grid; align-content: start; gap: var(--spacing-md); min-width: 0; min-height: 0; }
  .cargo > header, .item-heading { justify-content: space-between; }
  .cargo-list { overflow: auto; max-height: clamp(150px, 16.46vw, 340px); display: grid; gap: var(--spacing-xs); }
  .cargo-row { display: flex; justify-content: space-between; gap: var(--spacing-md); text-align: left; padding: var(--spacing-sm); }
  .cargo-row span, .cargo-row strong { display: grid; gap: var(--spacing-xs); }
  .cargo-row strong { color: var(--gold); font-variant-numeric: tabular-nums; text-align: right; }
  .cargo-row b { font-size: var(--font-sm); font-weight: 500; }
  .cargo > button { justify-self: start; }
  .empty { color: var(--dim); }
  .catalogue select { min-width: 0; max-width: clamp(150px, 16.94vw, 350px); }
  .provenance { line-height: 1.5; }
  .provenance b { color: var(--text); }
  .sale-line { padding: var(--spacing-md); background: var(--inset); border-radius: var(--radius-sm); gap: var(--spacing-sm); }
  .sale-line input { width: clamp(55px, 4.36vw, 90px); }
  .sale-line strong { color: var(--gold); font-variant-numeric: tabular-nums; margin-left: auto; }
  .sale-line .sell { border-color: var(--gold); }
  .buyer-list { display: grid; max-height: clamp(150px, 13.55vw, 280px); overflow: auto; }
  .buyer { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.6fr) auto; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-sm); border-bottom: 1px solid var(--line); }
  .buyer.chosen { background: var(--surface-selected); }
  .buyer > span { font-variant-numeric: tabular-nums; color: var(--gold); font-size: var(--font-sm); }
  .buyer-name { text-align: left; padding: 0; border: 0; background: transparent; }
  .footnote { line-height: 1.5; }
  .workshop { display: grid; gap: var(--spacing-sm); }
  .workshop-row { display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-md); padding: var(--spacing-md); border-bottom: 1px solid var(--line); }
  .workshop-row div { display: grid; gap: var(--spacing-xs); }
  .workshop-row p { font-size: var(--font-sm); }
  .wares { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-md); }
  .ware { display: grid; gap: var(--spacing-sm); align-content: start; padding: var(--spacing-md); background: var(--inset); border: 1px solid var(--line); border-radius: var(--radius-sm); }
  .ware p { color: var(--dim); font-size: var(--font-xs); }
  .ware strong { color: var(--gold); }
  .ware button { justify-self: start; }
  @media (max-width: 1023px) { .trade-layout { grid-template-columns: minmax(0, 1fr); } .wares { grid-template-columns: minmax(0, 1fr); } }
</style>
