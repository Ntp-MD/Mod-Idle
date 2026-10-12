<script lang="ts">
  /**
   * The town screen — what the game looks like when the character is standing in a settlement.
   *
   * The field and the town are the two ways to use the client, so the town gets its own front door rather
   * than a rail tab buried among the screens it leads to. It is a list of services, not a gallery of cards:
   * a row names the service, says what it costs the character to use it, and prints the live state that
   * makes pressing it worth while — how many stall lines the purse covers, how many pieces the pile is
   * holding, how many tasks are ready to claim.
   *
   * Every number is read from the sim modules the cages already test; nothing here restates a rule.
   */
  import { E, eng } from '../engine/client';
  import { canBuy, stockOf, settlementById, standingTier, standingShare } from '../sim/town';
  import { craft } from '../sim/craft';
  import type { GameState } from '../sim/types';

  let { state, town, here, tabs, onopen, onwarp, onsellall, onstashall, onbest }: {
    state: GameState;
    town: any;
    here: boolean;
    tabs: number;
    onopen: (id: string) => void;
    onwarp: (id: string) => void;
    onsellall: () => void;
    onstashall: () => void;
    onbest: () => void;
  } = $props();

  const cap = $derived(E.inventory.adventure_slots as number);
  const pile = $derived(state.bag.length);
  const stored = $derived(state.stash.reduce((n, t) => n + t.length, 0));
  const junk = $derived(Object.values(state.junk).reduce((a, b) => a + (b as number), 0));
  const stock = $derived(stockOf(town.id));
  const buys = $derived(here ? stock.filter((r: any) => canBuy(state, town.id, r.id).ok).length : 0);
  const ready = $derived(state.town.tasks.filter((t) => t && t.progress >= t.n).length);
  const tier = $derived(here ? standingTier(state, town.id) : 0);
  const share = $derived(here ? (standingShare(state, town.id) * 100).toFixed(1) : '0');
  const stones = $derived(Object.values(state.counters.stones).reduce((a, b) => a + (b as number), 0));
  /** the piece the forge would take on next, if there is one worth naming */
  const worn = $derived(state.gear.filter(Boolean) as any[]);
  const wornCount = $derived(worn.length);
  const lowest = $derived(worn.length ? worn.reduce((a, b) => ((b.upgrade_lv || 0) < (a.upgrade_lv || 0) ? b : a)) : null);
  const opened = $derived(state.town.visited.filter((v) => v !== town.id).map(settlementById).filter((s): s is NonNullable<ReturnType<typeof settlementById>> => Boolean(s)));
  const services = $derived([
    { id: 'market', name: 'Market', by: 'the Counterhand and the stall', say: 'Buy stock lines, tabs and bag room · sell the junk this run picked up', live: buys ? `${buys} line${buys === 1 ? '' : 's'} your purse covers` : junk ? `${junk} junk to sell` : 'nothing on offer you can take' },
    { id: 'forge', name: 'Forge', by: 'the Armourer', say: 'Enhance a piece up the + ladder, repair a Broken one, or take the one Corrupt gamble', live: lowest ? `${lowest.slot} is the least forged · +${lowest.upgrade_lv || 0} of +${craft.C.upgrade_cap}` : 'nothing worn yet' },
    { id: 'craft', name: 'Craft house', by: 'the Armourer and the Herbalist', say: 'Move a mod line inside its Tier, push it a Tier up, add or remove a mod, ascend the piece', live: stones ? `${stones} stones in the purse` : 'no stones — a rejected drop dissolves into them' },
    { id: 'stash', name: 'Stash', by: 'the Porter', say: 'The warehouse the same record opens in every settlement', live: tabs ? `${stored} stored · ${tabs} tab${tabs === 1 ? '' : 's'}` : 'no tab bought yet' },
    { id: 'desk', name: 'Desk', by: 'the Guild clerk and the Collector', say: 'Standing, the board, a set turn-in, the hunt and walk tables', live: ready ? `${ready} task${ready === 1 ? '' : 's'} ready to claim` : `${state.town.tasks.filter(Boolean).length} of ${state.town.tasks.length} board slots filled` },
    { id: 'farm', name: 'Farm', by: 'the Herbalist', say: 'Herb plots, brewing and condensing — the life skill, and it grants no power', live: `${state.farm.plots.filter((p: any) => p?.tier).length} plot(s) sown` },
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
        standing Tier {tier} ({share}% of the zone's kill budget)
      </p>
    </div>
    <div class="purse">
      <span><b>{state.counters.gold.toFixed(0)}</b> gold</span>
      <span><b>{stones}</b> stones</span>
      <span><b>{pile}</b> / {cap} in the pile</span>
    </div>
  </div>

  <div class="cols">
    <ul class="services" role="list">
      {#each services as s (s.id)}
        <li role="listitem">
          <button class="row" disabled={!here} onclick={() => onopen(s.id)}>
            <span class="nm">{s.name}</span>
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
          <span>Hunt pile</span><b>{pile} / {cap}</b>
          <button class="mini" disabled={!pile || !tabs} onclick={onstashall}>Stash it all</button>
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
        <p><small>The stash is one record on the character, not a chest in this house: the tabs you fill here
          are the tabs you open in every settlement on the map. Filling the pile is the only thing that stops
          a zone paying, and this is where it empties.</small></p>
      </section>

      <section class="ways">
        <h4>Waypoint</h4>
        <div class="chips">
          <span class="now">{town.name} · you are here</span>
          {#each opened as s (s.id)}
            <button class="chip" onclick={() => onwarp(s.id)} title="Warp to {s.name}, free and instant">{s.name}</button>
          {:else}
            <span class="dim">No other Waypoint opened yet — a Waypoint is earned by walking to a settlement once.</span>
          {/each}
        </div>
      </section>
    </div>
  </div>
</div>

<style>
  .town { display: grid; gap: var(--spacing-md); }
  .out {
    margin: 0; padding: var(--spacing-xs) var(--spacing-sm); border-radius: 10px; font-size: var(--font-xs);
    background: color-mix(in srgb, var(--hp) 14%, transparent); border: 1px solid color-mix(in srgb, var(--hp) 45%, transparent); color: var(--alarm);
  }
  .lead { display: flex; flex-wrap: wrap; gap: var(--spacing-md); align-items: baseline; justify-content: space-between; }
  .lead h3 { margin: 0; font-size: var(--font-md); letter-spacing: clamp(0.13px, 0.008vw + 0.03px, 0.27px); }
  .sub { margin: 3px 0 0; color: var(--dim); font-size: var(--font-xs); }
  .purse { display: flex; gap: var(--spacing-md); font-size: var(--font-xs); color: var(--dim); }
  .purse b { font-family: var(--num); color: var(--gold); font-size: var(--font-sm); }

  .cols { display: grid; grid-template-columns: 1fr minmax(clamp(212.5px, 13.855vw + 53.55px, 459px), clamp(287.5px, 18.745vw + 72.45px, 621px)); gap: var(--spacing-md); align-items: start; }
  /* a service is a row, not a card: the name leads, the live state is the reason to press it */
  .services { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .services .row {
    display: grid; grid-template-columns: clamp(93.75px, 6.112vw + 23.63px, 202.5px) clamp(112.5px, 7.335vw + 28.35px, 243px) 1fr auto; gap: var(--spacing-sm); align-items: baseline;
    width: 100%; text-align: left; padding: var(--spacing-sm) var(--spacing-sm); border-radius: 12px;
    background: var(--glass); border: 1px solid var(--edge);
  }
  .services .nm { font-size: var(--font-sm); color: var(--gold); }
  .services .by { font-size: var(--font-xs); color: var(--mob); }
  .services .say { font-size: var(--font-xs); color: var(--text); }
  .services .live { font-size: var(--font-xs); color: var(--dim); font-family: var(--num); }
  .services .row:disabled { opacity: .5; cursor: not-allowed; }

  .aside { display: grid; gap: var(--spacing-sm); }
  .qol, .ways { display: grid; gap: var(--spacing-xs); padding: var(--spacing-sm) var(--spacing-sm); border: 1px solid var(--edge); border-radius: 12px; }
  .qol h4, .ways h4 { margin: 0; }
  /* one row, three columns: the thing, how much of it there is, and the press that empties it */
  .qrow { display: grid; grid-template-columns: 1fr auto auto; gap: 3px var(--spacing-sm); align-items: center; }
  .qrow span { font-size: var(--font-xs); color: var(--dim); }
  .qrow b { font-family: var(--num); font-size: var(--font-xs); text-align: right; }
  .qol { display: grid; gap: 4px; }
  .qol p { margin: 3px 0 0; color: var(--dim); }
  .mini { padding: 1px var(--spacing-xs); font-size: var(--font-xs); }
  .chips { display: flex; flex-wrap: wrap; gap: 3px; }
  .now { font-size: var(--font-xs); color: var(--good); border: 1px solid rgba(39, 174, 96, .45); border-radius: 999px; padding: 1px var(--spacing-xs); }
  .chip { padding: 1px var(--spacing-xs); font-size: var(--font-xs); border-radius: 999px; }

  @media (max-width: 1280px) {
    .cols { grid-template-columns: 1fr; }
    .services .row { grid-template-columns: 1fr auto; }
    .services .by, .services .say { grid-column: 1 / -1; }
  }
</style>
