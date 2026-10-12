<script lang="ts">
  /**
   * The market — the screen a settlement sells from.
   *
   * One rule shapes the whole layout: a line is only worth pressing when the purse covers it, so the purse
   * heads the plate above the two panes rather than sitting at the bottom of a scroll, and an unaffordable
   * line prints the shortfall in the same gold the affordable ones light up in. The price is read from
   * `sim/town` every time — the stall's numbers are the engine's, and the Counterhand is the only thing in
   * the game that mints gold, so the sell side prints what is actually unsold rather than a count of kills.
   *
   * Two panes, the way a vendor window is split: what you carry on the left, the stall's own wares on the
   * right, so the junk that pays for a purchase and the purchase itself are read on one face.
   */
  import { E } from '../engine/client';
  import { npcOf, priceGold, priceMinutes, stockOf, canBuy } from '../sim/town';
  import type { GameState } from '../sim/types';

  let { state, town, here, onbuy, onsell }: {
    state: GameState;
    town: any;
    here: boolean;
    onbuy: (rowId: string) => void;
    onsell: () => void;
  } = $props();

  const stock = $derived(stockOf(town.id));
  const purse = $derived(state.counters.gold);
  const junk = $derived(Object.entries(state.junk).filter(([, n]) => n as number > 0).sort((a, b) => (b[1] as number) - (a[1] as number)));
  const junkTotal = $derived(junk.reduce((n, [, v]) => n + (v as number), 0));
  /** Today's pedlar roll, when this settlement has one — its prices are minutes of income, not gold. */
  const rolled = $derived(state.pedlar?.minutes || []);
  const canAfford = (row: any) => canBuy(state, town.id, row.id).ok;
  const gold = (row: any) => priceGold(row, town.id, state);

  const KIND_WORDS: Record<string, string> = {
    stash_tab: 'a stash tab', filter_preset: 'a bag filter preset', pouch: 'bag room',
    house: 'a house', deed: 'a plot deed', title: 'a title', banner: 'a banner',
    refill: 'a task refill', consumable: 'a consumable',
  };
  const kindWord = (k: string) => KIND_WORDS[k] || k.replace(/_/g, ' ');
</script>

<div class="market">
  <div class="purse">
    <b>{purse.toFixed(1)}</b>
    <span>gold in the purse</span>
  </div>

  <div class="panes">
    <section class="pane">
      <header>
        <h4>What you carry</h4>
        <span class="count">{junkTotal} piece{junkTotal === 1 ? '' : 's'} of junk</span>
      </header>
      {#if junk.length}
        <ul class="junk">
          {#each junk as [name, n] (name)}<li><span>{name}</span><b>×{n}</b></li>{/each}
        </ul>
      {:else}
        <p class="dim">Nothing unsold. Junk is what a rejected drop leaves behind, and selling it is the only thing in this game that mints gold.</p>
      {/if}
      <button class="act" onclick={onsell} disabled={!here || junkTotal === 0}>
        Sell {junkTotal || 'all'} piece{junkTotal === 1 ? '' : 's'} here
      </button>
      <p class="hint"><small>Selling is what mints gold, and it only happens standing here. Nothing on the stall side sells a stat, a Mod or a stone, so a rich character and a poor one face the same mob.</small></p>
    </section>

    <section class="pane">
      <header>
        <h4>{town.name} · the stall</h4>
        <span class="count">{stock.length} line{stock.length === 1 ? '' : 's'}{here ? '' : ' · read only, you stand elsewhere'}</span>
      </header>
      <div class="wares">
        {#each stock as row (row.id)}
          {@const ok = here && canAfford(row)}
          {@const need = gold(row) - purse}
          <article class="ware" class:ok class:poor={here && !ok}>
            <h5>{row.item}</h5>
            <p class="kind">{kindWord(row.kind)} · sold by {npcOf(row.npc)?.name ?? row.npc}</p>
            <p class="mins">{priceMinutes(row, town.id, state)} min{row.charge_band ? ` @ ${row.charge_band}` : ''} of this band's income</p>
            <p class="price">{gold(row)} <i>gold</i></p>
            {#if !here}
              <span class="dim">walk there to buy</span>
            {:else if ok}
              <button class="buy" onclick={() => onbuy(row.id)} title="Buy {row.item} for {gold(row)} gold">Buy</button>
            {:else}
              <span class="short">{need > 0 ? `${need.toFixed(0)} gold short` : 'not on offer yet'}</span>
            {/if}
          </article>
        {:else}
          <p class="dim">The stall has nothing this settlement sells.</p>
        {/each}
      </div>
    </section>
  </div>

  {#if here && rolled.length}
    <p class="hint"><small>The Curio pedlar's prices roll today at {rolled.join(' / ')} minutes of income, {state.pedlar.bought} of {rolled.length} taken; they restock at the next game day. A one-off line that adds bag room or a stash tab is worth taking the day it appears.</small></p>
  {/if}
</div>

<style>
  .market { display: grid; gap: var(--spacing-sm); }
  /* the purse is the thing a market read needs, so it heads the plate rather than being asked for by
     opening a second screen */
  .purse {
    display: flex; align-items: baseline; gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-md);
    border: 1px solid var(--edge); border-radius: 12px; background: var(--glass);
  }
  .purse b { font-family: var(--num); font-size: var(--font-xl); line-height: 1; color: var(--gold); font-variant-numeric: tabular-nums; }
  .purse span { color: var(--dim); font-size: var(--font-xs); letter-spacing: clamp(0px, 0.033vw + 0px, 1px); text-transform: uppercase; }

  /* the vendor split: what you carry on the left, the stall's wares on the right */
  .panes { display: grid; grid-template-columns: minmax(var(--box-300), 1fr) 1.6fr; gap: var(--spacing-md); align-items: start; }
  @media (max-width: 1280px) { .panes { grid-template-columns: 1fr; } }
  .pane { display: grid; gap: var(--spacing-xs); align-content: start; min-width: 0; }
  .pane > header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-sm); border-bottom: 1px solid var(--line); padding-bottom: 3px; }
  .pane h4 { margin: 0; }
  .count { font-size: var(--font-xs); color: var(--dim); font-variant-numeric: tabular-nums; }

  .junk { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; font-size: var(--font-xs); }
  .junk li { display: flex; justify-content: space-between; gap: var(--spacing-sm); padding: 1px var(--spacing-xs); background: color-mix(in srgb, var(--panel) 55%, transparent); border-radius: 3px; }
  .junk li span { color: var(--dim); }
  .junk li b { font-family: var(--num); color: var(--text); }
  .act { justify-self: start; }
  .hint { margin: 0; color: var(--dim); }

  /* a ware is a card: what it is, what it costs in minutes and in gold, and the one press it takes */
  .wares { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--box-200), 1fr)); gap: var(--spacing-xs); }
  .ware {
    display: grid; gap: 2px; align-content: start;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--inset); border: 1px solid var(--line); border-radius: 6px;
  }
  /* an affordable ware is lit; an unaffordable one says by how much, in gold, in the same place the lit
     one puts its button — a refusal that only removes a button teaches nothing */
  .ware.ok { border-color: color-mix(in srgb, var(--gold) 40%, var(--line)); background: color-mix(in srgb, var(--gold) 6%, var(--inset)); }
  .ware.poor { opacity: .68; }
  .ware h5 { margin: 0; font-size: var(--font-sm); color: var(--text); }
  .ware .kind { margin: 0; font-size: var(--font-xs); color: var(--dim); }
  .ware .mins { margin: 0; font-size: var(--font-xs); color: var(--mob); }
  .ware .price { margin: 1px 0 0; font-family: var(--num); font-size: var(--font-sm); color: var(--gold); }
  .ware .price i { font-family: var(--ui); font-size: var(--font-xs); font-style: normal; color: var(--dim); }
  .ware .short { font-size: var(--font-xs); color: var(--alarm); }
  .buy { justify-self: start; border-color: color-mix(in srgb, var(--gold) 45%, transparent); color: var(--gold); }
</style>
