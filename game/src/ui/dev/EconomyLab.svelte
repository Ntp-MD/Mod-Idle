<script lang="ts">
  import { E, TOWN, eng, road, trade } from '../../engine/client';
  import { warpRow } from '../../sim/world/road';
  import { createEconomy } from '../../../../engine/economy';
  import type { EconomySnapshot, Units } from '../../../../engine/economy';
  import { economyFixture, economyPlayer, LAB_CITIES, LAB_PLAYER_GOODS } from '../../lab/economy';

  const CONFIG = economyFixture();
  const PLAYER_START = economyPlayer();
  const newEconomy = () => createEconomy(CONFIG, trade, PLAYER_START);

  // The engine is mutable and intentionally outside Svelte's proxy; every action replaces the snapshot.
  let economy = newEconomy();
  let snapshot = $state<EconomySnapshot>(economy.snapshot());
  let cityId = $state('highspire');
  let originId = $state('millbrook');
  let goodId = $state('material:timber');
  let quantity = $state(5);
  let note = $state('Fixture start: three towns, one supply chain, two timed events.');

  const sum = (units: Units) => Object.values(units).reduce((total, value) => total + value, 0);
  const gold = (value: number) => value.toFixed(TOWN.trade.currency_decimals);
  const nameOf = (id: string) => trade.byId[id]?.name || id;
  const cityName = (id: string) => TOWN.settlements.find((town) => town.id === id)?.name || id;
  const configCity = (id: string) => CONFIG.cities.find((city) => city.id === id)!;
  const snapshotCity = (id: string) => snapshot.cities[id];
  const goodsAt = (id: string) => LAB_CITIES.find((city) => city.id === id)?.goods || [];
  const clock = (seconds: number) => `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
  const eventLive = (index: number) => snapshot.events[index]?.filled || 0;
  const eventRemaining = (index: number) => Math.max(0, CONFIG.events[index].extra_demand - eventLive(index));
  const eventActive = (index: number) => {
    const event = CONFIG.events[index];
    return snapshot.nowSec >= event.startsAtSec && snapshot.nowSec < event.endsAtSec && eventRemaining(index) > 0;
  };
  const eventLabel = (index: number) => eventActive(index) ? 'active'
    : eventRemaining(index) === 0 ? 'filled'
      : snapshot.nowSec < CONFIG.events[index].startsAtSec ? 'scheduled' : 'ended';
  const stockPct = (id: string, good: string) => {
    const cap = configCity(id).capacity[good] || 1;
    return Math.min(100, Math.round((snapshotCity(id).stock[good] || 0) / cap * 100));
  };
  const amount = $derived(Math.max(1, Math.floor(quantity) || 1));
  const carried = $derived(snapshot.player.stock[goodId] || 0);
  const preview = $derived.by(() => {
    const current = snapshot;
    return economy.quote(cityId, goodId, amount, current.nowSec);
  });
  const routeInfo = (id: string) => {
    const blocks = road.blocksBetween(originId, id);
    const row = warpRow();
    const fare = row ? Math.round((row.m_per_block || 0) * blocks * eng.goldPerMinute(row.charge_band || 'mid') * 100) / 100 : 0;
    return { blocks, sec: blocks * E.road.block_sec, fare };
  };
  const buyers = $derived.by(() => {
    const current = snapshot;
    return LAB_CITIES.map((city) => ({ ...city, quote: economy.quote(city.id, goodId, amount, current.nowSec), route: routeInfo(city.id) }));
  });
  const audit = $derived.by(() => {
    const current = snapshot;
    const endGoods = Object.values(current.cities).reduce((total, city) => total + sum(city.stock), 0) + sum(current.player.stock);
    const startGoods = CONFIG.cities.reduce((total, city) => total + sum(city.stock), 0) + sum(PLAYER_START.stock);
    const goodsOk = endGoods + sum(current.ledger.consumed) + sum(current.ledger.soldBasic)
      === startGoods + sum(current.ledger.produced);
    const endGold = Object.values(current.cities).reduce((total, city) => total + city.budget, 0) + current.player.gold + current.player.credit;
    const startGold = CONFIG.cities.reduce((total, city) => total + city.budget, 0) + PLAYER_START.gold + PLAYER_START.credit;
    const minted = current.ledger.mintedBasic + current.ledger.mintedBudget + current.ledger.mintedEvent;
    return { goodsOk, goldOk: Math.abs(endGold - (startGold + minted)) < 1e-6 };
  });

  function refresh() {
    snapshot = economy.snapshot();
  }
  function advance(hours: number) {
    economy.advance(hours * 3600);
    refresh();
    note = `Advanced ${hours}h in one step; the ledger stayed on the same clock.`;
  }
  function sell() {
    const result = economy.sell(cityId, goodId, amount);
    refresh();
    note = result.ok
      ? `Sold ${result.count} ${nameOf(goodId)} at ${cityName(cityId)}: city ${result.cityUnits} (${gold(result.cityGold)}g) + basic ${result.basicUnits} (${gold(result.basicGold)}g).`
      : `Refused: ${result.why}`;
  }
  function reset() {
    economy = newEconomy();
    refresh();
    cityId = 'highspire';
    goodId = 'material:timber';
    quantity = 5;
    note = 'Reset to the fixture start.';
  }
</script>

<section class="economy-lab" aria-labelledby="economy-lab-title">
  <header class="lab-head">
    <div>
      <p class="eyebrow">Showcase only · Phase B fixture · no save</p>
      <h2 id="economy-lab-title">Economy lab</h2>
      <p class="text-note">Three towns trade real stock and a real budget. Advance world time, then sell into the same demand an NPC delivery uses.</p>
    </div>
    <div class="lab-clock" aria-label="Simulation clock">
      <strong class="text-value">{clock(snapshot.nowSec)}</strong>
      <small>world time</small>
    </div>
  </header>

  <div class="lab-controls card-read" role="group" aria-label="Advance simulation">
    <button onclick={() => advance(1)}>+1 hour</button>
    <button onclick={() => advance(6)}>+6 hours</button>
    <button onclick={() => advance(24)}>+24 hours</button>
    <button class="btn btn-flat" onclick={reset}>Reset</button>
    <p class="text-note" role="status" aria-live="polite">{note}</p>
  </div>
  <p class="text-note">Travel cost and Waypoint fare use the real Road graph. The lab does not move the character or enforce the sale: it shows the trade-off beside the city ledger. Delivery, home, NPC stories and projects remain outside this fixture.</p>

  <div class="lab-cities">
    {#each LAB_CITIES as city (city.id)}
      {@const live = snapshotCity(city.id)}
      <article class="city-card card-read" aria-labelledby={`city-${city.id}`}>
        <header>
          <div><h3 id={`city-${city.id}`}>{cityName(city.id)}</h3><p class="text-note">{TOWN.trade.towns[city.id]?.needs}</p></div>
          <span class="chip chip-tag">{city.role}</span>
        </header>
        <dl class="city-figures">
          <div><dt>Budget</dt><dd>{gold(live.budget)}g</dd></div>
          <div><dt>Cap</dt><dd>{gold(configCity(city.id).budget_cap)}g</dd></div>
        </dl>
        <div class="stock-table" aria-label={`${cityName(city.id)} stock`}>
          {#each goodsAt(city.id) as good (good)}
            {@const stock = live.stock[good] || 0}
            {@const target = configCity(city.id).target[good] || 0}
            {@const cap = configCity(city.id).capacity[good] || 1}
            <div class="stock-row">
              <span title={`${nameOf(good)} · target ${target} · capacity ${cap}`}>{nameOf(good)}</span>
              <span class="stock-figure">{stock}<small>/{target} target · {cap} cap</small></span>
              <span class="stock-bar" aria-hidden="true"><i style:width={`${stockPct(city.id, good)}%`}></i></span>
            </div>
          {/each}
        </div>
      </article>
    {/each}
  </div>

  <div class="lab-lower">
    <section class="lab-card sale-card card-read" aria-labelledby="lab-sale-title">
      <header><h3 id="lab-sale-title">Sell into one transaction</h3><span class="chip chip-tag">quote → confirm</span></header>
      <div class="sale-form">
        <label>Stand at
          <select aria-label="Route origin" value={originId} onchange={(event) => originId = event.currentTarget.value}>
            {#each LAB_CITIES as city (city.id)}<option value={city.id}>{cityName(city.id)}</option>{/each}
          </select>
        </label>
        <label>City
          <select aria-label="Sale city" value={cityId} onchange={(event) => cityId = event.currentTarget.value}>
            {#each LAB_CITIES as city (city.id)}<option value={city.id}>{cityName(city.id)}</option>{/each}
          </select>
        </label>
        <label>Good
          <select aria-label="Sale good" value={goodId} onchange={(event) => goodId = event.currentTarget.value}>
            {#each LAB_PLAYER_GOODS as good (good)}<option value={good}>{nameOf(good)} · {snapshot.player.stock[good] || 0} carried</option>{/each}
          </select>
        </label>
        <label>Qty
          <input type="number" min="1" step="1" aria-label="Sale quantity" value={quantity} oninput={(event) => quantity = event.currentTarget.valueAsNumber} />
        </label>
        <button class="btn btn-flat" disabled={carried === 0} onclick={() => quantity = carried}>All carried</button>
      </div>
      <div class="quote-grid" aria-label="Sale quote">
        <div><span>Normal demand</span><b>{preview.normalDemand}</b></div>
        <div><span>Event demand</span><b>{preview.eventDemand}</b></div>
        <div><span>City takes</span><b>{preview.cityUnits} · {gold(preview.cityGold)}g</b></div>
        <div><span>Floor channel</span><b>{preview.basicUnits} · {gold(preview.basicGold)}g</b></div>
        <div><span>Total paid</span><b>{gold(preview.gold)}g</b></div>
        <div><span>Carried credit</span><b>{preview.credit.toFixed(4)}g</b></div>
      </div>
      <div class="sale-foot">
        <p class="text-note">{preview.ok ? `${carried} carried · ${preview.capacityFree} free storage · city budget ${gold(snapshotCity(cityId).budget)}g` : preview.why}</p>
        <button class="btn-gold" disabled={!preview.ok} onclick={sell}>Sell {amount}</button>
      </div>
      <h4>City buyers for {nameOf(goodId)}</h4>
      <div class="buyer-grid">
        {#each buyers as buyer (buyer.id)}
          <article class="buyer-row card-read selectable" class:selected={buyer.id === cityId}>
            <header>
              <button class="buyer-name btn btn-flat" onclick={() => cityId = buyer.id}>{cityName(buyer.id)}</button>
              <span class="chip chip-tag">{buyer.role}</span>
            </header>
            {#if buyer.quote.ok}
              <dl>
                <div><dt>City takes</dt><dd>{buyer.quote.cityUnits} · {gold(buyer.quote.cityGold)}g</dd></div>
                <div><dt>Floor</dt><dd>{buyer.quote.basicUnits} · {gold(buyer.quote.basicGold)}g</dd></div>
                <div><dt>Demand</dt><dd>{buyer.quote.normalDemand}{buyer.quote.eventDemand ? ` + ${buyer.quote.eventDemand} event` : ''}</dd></div>
                <div><dt>Free storage</dt><dd>{buyer.quote.capacityFree}</dd></div>
                <div><dt>Walk</dt><dd>{buyer.route.blocks} blocks · {buyer.route.sec}s</dd></div>
                <div><dt>Warp</dt><dd>{gold(buyer.route.fare)}g · net {gold(buyer.quote.gold - buyer.route.fare)}g</dd></div>
              </dl>
            {:else}
              <p class="text-note">{buyer.quote.why}</p>
            {/if}
          </article>
        {/each}
      </div>
      <div class="cargo-strip">
        {#each LAB_PLAYER_GOODS as good (good)}
          <button class="selectable" class:selected={goodId === good} onclick={() => { goodId = good; quantity = Math.max(1, snapshot.player.stock[good] || 1); }} aria-pressed={goodId === good}>
            <span>{nameOf(good)}</span><b>{snapshot.player.stock[good] || 0}</b>
          </button>
        {/each}
      </div>
    </section>

    <section class="lab-card event-card card-read" aria-labelledby="lab-event-title">
      <header><h3 id="lab-event-title">Timed events</h3><span class="chip chip-tag">{CONFIG.events.length} fixed</span></header>
      {#each CONFIG.events as event, index (event.id)}
        <article class="event-row card-tile" class:live={eventActive(index)}>
          <header><b>{event.id.replaceAll('-', ' ')}</b><span class="chip chip-tag">{eventLabel(index)}</span></header>
          <p>{cityName(event.city)} wants {eventRemaining(index)} more {nameOf(event.good)}</p>
          <small>
            {#if eventActive(index)}
              {clock(Math.max(0, event.endsAtSec - snapshot.nowSec))} left
            {:else if snapshot.nowSec < event.startsAtSec}
              opens in {clock(event.startsAtSec - snapshot.nowSec)}
            {:else}
              window {clock(event.startsAtSec)}–{clock(event.endsAtSec)}
            {/if}
            · budget up to {gold(event.budget)}g
          </small>
        </article>
      {/each}
      <p class="text-note">Events run on world time, including offline steps. Ending an event deletes no goods or gold.</p>
    </section>

    <section class="lab-card ledger-card card-read" aria-labelledby="lab-ledger-title">
      <header><h3 id="lab-ledger-title">Ledger</h3><span class="chip chip-tag">closed books</span></header>
      <dl class="ledger-grid">
        <div><dt>Produced</dt><dd>{sum(snapshot.ledger.produced)}</dd></div>
        <div><dt>Consumed</dt><dd>{sum(snapshot.ledger.consumed)}</dd></div>
        <div><dt>Transferred</dt><dd>{sum(snapshot.ledger.transferred)}</dd></div>
        <div><dt>Sold to city</dt><dd>{sum(snapshot.ledger.soldToCity)}</dd></div>
        <div><dt>Floor sales</dt><dd>{sum(snapshot.ledger.soldBasic)}</dd></div>
        <div><dt>Minted</dt><dd>{gold(snapshot.ledger.mintedBasic + snapshot.ledger.mintedBudget + snapshot.ledger.mintedEvent)}g</dd></div>
      </dl>
      <div class="audit-row">
        <span class="chip chip-tag" class:here={audit.goodsOk} class:alarm={!audit.goodsOk}>Goods {audit.goodsOk ? 'balance' : 'mismatch'}</span>
        <span class="chip chip-tag" class:here={audit.goldOk} class:alarm={!audit.goldOk}>Gold {audit.goldOk ? 'balance' : 'mismatch'}</span>
      </div>
      <p class="player-purse">Player <b>{gold(snapshot.player.gold)}g</b> + {snapshot.player.credit.toFixed(4)}g credit</p>
      <p class="text-note">Minted = floor-channel gold + budget refills + event grants. City purchases move existing city gold; they do not mint.</p>
    </section>
  </div>
</section>

<style>
  .economy-lab { display: grid; gap: var(--spacing-lg); padding: var(--spacing-lg); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-card); }
  .lab-head, .lab-controls, .lab-card > header, .city-card > header, .event-row > header, .sale-foot { display: flex; align-items: center; gap: var(--spacing-md); flex-wrap: wrap; }
  .lab-head, .lab-card > header, .city-card > header, .event-row > header, .sale-foot { justify-content: space-between; }
  .lab-head > div { display: grid; gap: var(--spacing-xs); }
  .eyebrow { margin: 0; color: var(--gold); font-size: var(--font-xs); letter-spacing: .12em; text-transform: uppercase; }
  .lab-head h2 { margin: 0; font-size: var(--font-lg); }
  .lab-head p, .lab-card p, .city-card p, .economy-lab > p { margin: 0; }
  .lab-clock { display: grid; justify-items: end; gap: var(--spacing-xs); }
  .lab-clock strong { font-family: var(--num); font-size: var(--font-lg); color: var(--gold); }
  .lab-clock small { color: var(--dim); }
  .lab-controls { padding: var(--spacing-sm); }
  .lab-controls p { flex: 1 1 280px; }
  .lab-cities { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-md); }
  .city-card, .lab-card { display: grid; gap: var(--spacing-md); align-content: start; padding: var(--spacing-md); }
  .city-card h3, .lab-card h3 { margin: 0; color: var(--gold); font-size: var(--font-md); }
  .city-card header p { max-width: 42ch; font-size: var(--font-xs); color: var(--dim); }
  .city-figures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-sm); margin: 0; }
  .city-figures div, .ledger-grid div { display: grid; gap: 2px; }
  dt { color: var(--dim); font-size: var(--font-xs); }
  dd { margin: 0; font-family: var(--num); font-size: var(--font-sm); }
  .stock-table { display: grid; gap: var(--spacing-sm); }
  .stock-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: var(--spacing-sm); row-gap: 3px; font-size: var(--font-xs); }
  .stock-figure { font-family: var(--num); text-align: right; color: var(--text); }
  .stock-figure small { color: var(--dim); }
  .stock-bar { grid-column: 1 / -1; height: 4px; overflow: hidden; background: var(--bar-2); border-radius: var(--radius-pill); }
  .stock-bar i { display: block; height: 100%; background: var(--gold); opacity: .7; }
  .lab-lower { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr); gap: var(--spacing-md); }
  .sale-form { display: flex; align-items: end; gap: var(--spacing-sm); flex-wrap: wrap; }
  .sale-form label { display: grid; gap: var(--spacing-xs); color: var(--dim); font-size: var(--font-xs); }
  .sale-form select, .sale-form input { min-width: 0; }
  .sale-form input { width: 72px; }
  .quote-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-sm); padding: var(--spacing-sm); background: var(--surface-selected); border-radius: var(--radius-card); }
  .quote-grid div { display: grid; gap: 2px; }
  .quote-grid span { color: var(--dim); font-size: var(--font-xs); }
  .quote-grid b { font-family: var(--num); font-size: var(--font-sm); }
  .sale-foot p { flex: 1 1 240px; }
  .lab-card h4 { margin: 0; color: var(--dim); font-size: var(--font-sm); }
  .buyer-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-sm); }
  .buyer-row { display: grid; gap: var(--spacing-xs); padding: var(--spacing-sm); }
  .buyer-row header { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-xs); }
  .buyer-name { padding: 0; color: var(--text); text-align: left; }
  .buyer-row dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-xs); margin: 0; }
  .cargo-strip { display: flex; gap: var(--spacing-xs); flex-wrap: wrap; }
  .cargo-strip button { display: inline-flex; align-items: center; gap: var(--spacing-xs); padding: var(--spacing-xs) var(--spacing-sm); }
  .cargo-strip b { font-family: var(--num); }
  .event-card { align-content: start; }
  .event-row { display: grid; gap: var(--spacing-xs); padding: var(--spacing-sm); }
  .event-row.live { border-color: var(--gold); background: var(--surface-selected); }
  .event-row p { font-size: var(--font-sm); }
  .event-row small { color: var(--dim); }
  .ledger-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-sm) var(--spacing-md); margin: 0; }
  .ledger-grid dd { color: var(--gold-lit); }
  .audit-row { display: flex; gap: var(--spacing-xs); flex-wrap: wrap; }
  .player-purse { font-family: var(--num); font-size: var(--font-sm); }
  .player-purse b { color: var(--gold); }
  @media (max-width: 1200px) { .lab-cities, .lab-lower { grid-template-columns: minmax(0, 1fr); } .quote-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
