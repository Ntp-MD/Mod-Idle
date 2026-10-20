<script lang="ts">
  /**
   * The town screen — what the game looks like when the character is standing in a settlement.
   *
   * The field and the town are the two ways to use the client, so the town gets its own front door rather
   * than a rail tab buried among the screens it leads to. It is a list of services, not a gallery of cards:
   * a row names the service, says what it costs the character to use it, and prints the live state that
   * makes pressing it worth while — how many stall lines the purse covers, how many pieces the bag is
   * holding, how many tasks are ready to claim.
   *
   * Every number is read from the sim modules the cages already test; nothing here restates a rule.
   */
  import { E, eng } from '../engine/client';
  import { canBuy, stockOf, settlementById, standingProgress } from '../sim/town';
  import { slotsAvailable, slotsUsed } from '../sim/slots';
  import { craft } from '../sim/craft';
  import type { GameState } from '../sim/types';
  import { icon } from '../icon';
  const marketMark = icon('currency-strongbox');
  const forgeMark = icon('anvil-1');
  const craftMark = icon('add-plus');
  const stashMark = icon('treasure-chest');
  const deskMark = icon('quest-journal');
  const farmMark = icon('sprout');

  let { state, town, here, tabs, onopen, onwarp, onsellall, onstashall, onbest, onblackmarket }: {
    state: GameState;
    town: any;
    here: boolean;
    tabs: number;
    onopen: (id: string) => void;
    onwarp: (id: string) => void;
    onsellall: () => void;
    onstashall: () => void;
    onbest: () => void;
    onblackmarket: () => void;
  } = $props();

  const capacity = $derived(slotsAvailable(state));
  const used = $derived(slotsUsed(state));
  const pieces = $derived(state.bag.length);
  const stored = $derived(state.stash.reduce((n, t) => n + t.length, 0));
  const junk = $derived(Object.values(state.junk).reduce((a, b) => a + (b as number), 0));
  const stock = $derived(stockOf(town.id));
  const buys = $derived(here ? stock.filter((r: any) => canBuy(state, town.id, r.id).ok).length : 0);
  const ready = $derived(state.town.tasks.filter((t) => t && t.progress >= t.n).length);
  const standing = $derived(standingProgress(state, town.id));
  const stones = $derived(Object.values(state.counters.stones).reduce((a, b) => a + (b as number), 0));
  /** the piece the forge would take on next, if there is one worth naming */
  const worn = $derived(state.gear.filter(Boolean) as any[]);
  const wornCount = $derived(worn.length);
  const lowest = $derived(worn.length ? worn.reduce((a, b) => ((b.upgrade_lv || 0) < (a.upgrade_lv || 0) ? b : a)) : null);
  const opened = $derived(state.town.visited.filter((v) => v !== town.id).map(settlementById).filter((s): s is NonNullable<ReturnType<typeof settlementById>> => Boolean(s)));
  const services = $derived([
    { id: 'market', name: 'Market', icon: marketMark, by: 'the Counterhand and the workshop', say: 'Sell gathered goods, compare town demand, process materials and plan trade routes', live: buys ? `${buys} stall line${buys === 1 ? '' : 's'} your purse covers` : junk ? `${junk} junk to sell` : 'Compare buyers and regional supplies' },
    { id: 'black-market', name: 'Black Market', icon: marketMark, by: 'the back-alley broker', say: 'Buy rare materials, craft stones and named skill XP Levels; max level offers are in the stock pool', live: state.town.blackMarket[town.id] ? `${state.town.blackMarket[town.id].offers.filter((offer) => offer.remaining > 0).length} offers in stock` : 'Stock arrives on the next online settlement tick' },
    { id: 'forge', name: 'Forge', icon: forgeMark, by: 'the Armourer', say: 'Enhance a piece up the + ladder, repair a Broken one, or take the one Corrupt gamble', live: lowest ? `${lowest.slot} is the least forged · +${lowest.upgrade_lv || 0} of +${craft.C.upgrade_cap}` : 'nothing worn yet' },
    { id: 'craft', name: 'Craft house', icon: craftMark, by: 'the Armourer and the Herbalist', say: 'Move a mod line inside its Tier, push it a Tier up, add or remove a mod, ascend the piece', live: stones ? `${stones} stones in the purse` : 'no stones — Salvage supplies Scrap for Alchemy' },
    { id: 'stash', name: 'Stash', icon: stashMark, by: 'the Porter', say: 'The warehouse the same record opens in every settlement', live: tabs ? `${stored} stored · ${tabs} tab${tabs === 1 ? '' : 's'}` : 'no tab bought yet' },
    { id: 'desk', name: 'Desk', icon: deskMark, by: 'the Guild clerk and the Collector', say: 'Standing, the board, a set turn-in, the hunt and walk tables', live: ready ? `${ready} task${ready === 1 ? '' : 's'} ready to claim` : `${state.town.tasks.filter(Boolean).length} of ${state.town.tasks.length} board slots filled` },
    { id: 'farm', name: 'Farm', icon: farmMark, by: 'the Herbalist', say: 'Herb plots, brewing and condensing', live: `${state.farm.plots.filter((p: any) => p?.tier).length} plot(s) sown` },
  ]);
</script>

<div class="town">
  {#if !here}
    <p class="out">
      <b>You are not standing in {town.name}.</b> These are settlement services, so they open where the
      character is — walk or warp in from the map and this screen turns live. The field never sells a far
      purchase.
    </p>
  {/if}

  <div class="lead">
    <div>
      <h3>{town.name}</h3>
      <p class="sub">
        zone {town.zone} · {eng.zoneById(town.zone).name} · Innate Element {town.innate.join(' / ')} ·
        standing Tier {standing.tier} ({(standing.share * 100).toFixed(1)}% of zone budget) ·
        {standing.kills.toLocaleString()} zone kills + {standing.helpCredit.toLocaleString()} Camp aid = {standing.progress.toLocaleString()} Standing progress ·
        {standing.budget > 0
          ? standing.next
            ? `${standing.next.remaining.toLocaleString()} more to Tier ${standing.next.name} (${standing.next.requiredProgress.toLocaleString()} progress)`
            : 'all Standing tiers reached'
          : 'Standing unavailable'}
      </p>
    </div>
    <div class="purse">
      <span><b>{state.counters.gold.toFixed(0)}</b> gold</span>
      <span><b>{stones}</b> stones</span>
      <span><b>{used}</b> / {capacity} bag slots</span>
    </div>
  </div>

  <div class="cols">
    <ul class="services" role="list">
      {#each services as s (s.id)}
        <li role="listitem">
          <button class="row" disabled={!here} onclick={() => s.id === 'black-market' ? onblackmarket() : onopen(s.id)}>
            <span class="service-name"><img src={s.icon} alt="" aria-hidden="true" /><span class="nm">{s.name}</span></span>
            <span class="by">{s.by}</span>
            <span class="say">{s.say}</span>
            <span class="live">{here ? s.live : 'walk or warp here first'}</span>
          </button>
        </li>
      {/each}
    </ul>

    <div class="aside">
      <section class="qol">
        <h4>Before you leave town</h4>
        <div class="qrow">
          <span>Bag · pieces to stash</span><b>{pieces} · {used} / {capacity} slots</b>
          <button class="mini" disabled={!pieces || !tabs} onclick={onstashall}>Stash it all</button>
        </div>
        <div class="qrow">
          <span>Junk to sell</span><b>{junk}</b>
          <button class="mini" disabled={!junk} onclick={onsellall}>Sell</button>
        </div>
        <div class="qrow">
          <span>Warehouse</span><b>{stored} pieces · {tabs} tabs</b>
          <button class="mini" onclick={() => onopen('stash')}>Open</button>
        </div>
        <div class="qrow">
          <span>Gear worn</span><b>{wornCount} of {E.stat.item_slots}</b>
          <button class="mini" onclick={onbest}>Put on the best I carry</button>
        </div>
      </section>

      <section class="ways">
        <h4>Waypoint</h4>
        <div class="chips">
          <span class="chip chip-tag here">{town.name} · you are here</span>
          {#each opened as s (s.id)}
            <button class="chip chip-tag btn btn-quiet" onclick={() => onwarp(s.id)} title="Warp to {s.name}, free and instant">{s.name}</button>
          {:else}
            <span class="dim">No other Waypoint opened yet.</span>
          {/each}
        </div>
      </section>
    </div>
  </div>
</div>

<style>
  .town { display: grid; gap: var(--spacing-md); height: 100%; min-height: 0; align-content: start; }
  .out {
    margin: 0; padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-card); font-size: var(--font-xs);
    background: color-mix(in srgb, var(--hp) 14%, transparent); border: 1px solid color-mix(in srgb, var(--hp) 45%, transparent); color: var(--alarm);
  }
  .lead { display: flex; flex-wrap: wrap; gap: var(--spacing-md); align-items: baseline; justify-content: space-between; }
  .lead h3 { margin: 0; font-size: var(--font-md); }
  .sub { color: var(--dim); font-size: var(--font-xs); }
  .purse { display: flex; gap: var(--spacing-md); font-size: var(--font-xs); color: var(--dim); }
  .purse b { font-family: var(--num); color: var(--gold); font-size: var(--font-sm); }

  .cols { display: grid; grid-template-columns: 1fr minmax(clamp(212px, 16.51vw, 459px), clamp(288px, 22.27vw, 621px)); gap: var(--spacing-md); align-items: start; }
  /* a service is a row, not a card: the name leads, the live state is the reason to press it */
  .services { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--spacing-xs); }
  .services .row {
    display: grid; grid-template-columns: clamp(94px, 7.31vw, 202px) clamp(113px, 8.71vw, 243px) 1fr minmax(0, clamp(113px, 12.58vw, 351px)); gap: var(--spacing-sm); align-items: baseline;
    width: 100%; text-align: left; border-radius: var(--radius-card);
    background: var(--glass); border: 1px solid var(--edge);
  }
  .services .nm { font-size: var(--font-sm); color: var(--gold); }
  .service-name { display: flex; align-items: center; gap: var(--spacing-xs); }
  .service-name img { width: calc(var(--icon-label) * 1.5); height: calc(var(--icon-label) * 1.5); flex: none; object-fit: contain; opacity: .9; }
  .services .by { font-size: var(--font-xs); color: var(--mob); }
  .services .say { font-size: var(--font-xs); color: var(--text); }
  .services .live { font-size: var(--font-xs); color: var(--dim); font-family: var(--num); min-width: 0; text-align: right; overflow-wrap: anywhere; }
  .services .row:disabled { opacity: .5; cursor: not-allowed; }

  .aside { display: grid; gap: var(--spacing-sm); }
  .qol, .ways { display: grid; gap: var(--spacing-xs); padding: var(--spacing-sm) var(--spacing-sm); border: 1px solid var(--edge); border-radius: var(--radius-card); }
  .qol h4, .ways h4 { margin: 0; }
  /* one row, two columns: the thing and how much of it there is. The press takes the line below and
     stands on the right edge, so a long label never runs the row out of the aside */
  .qrow { display: grid; grid-template-columns: 1fr auto; gap: var(--spacing-xs) var(--spacing-sm); align-items: center; }
  .qrow button { grid-column: 1 / -1; justify-self: end; }
  .qrow span { font-size: var(--font-xs); color: var(--dim); }
  .qrow b { font-family: var(--num); font-size: var(--font-xs); text-align: right; }
  .qol { display: grid; gap: var(--spacing-xs); }
  .chips { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
  .chips span.chip { padding: var(--spacing-xs) var(--spacing-xs); }

  @media (max-width: 1023px) {
    .cols { grid-template-columns: 1fr; }
    .services .row { grid-template-columns: 1fr auto; }
    .services .by, .services .say { grid-column: 1 / -1; }
  }
</style>
