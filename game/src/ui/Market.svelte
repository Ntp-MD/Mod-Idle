<script lang="ts">
  /**
   * The market — the screen a settlement sells from.
   *
   * One rule shapes the whole layout: a line is only worth pressing when the purse covers it, so the purse
   * sits above the list rather than at the bottom of a scroll, and an unaffordable line prints the shortfall
   * in the same gold the affordable ones light up in. The price is read from `sim/town` every time — the
   * stall's numbers are the engine's, and the Counterhand is the only thing in the game that mints gold, so
   * the sell side prints what is actually unsold rather than a count of kills.
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
  <div class="counter">
    <div class="purse">
      <b>{purse.toFixed(1)}</b>
      <span>gold in the purse</span>
    </div>
    <div class="sell">
      <h4>Counterhand · sell the junk this run picked up</h4>
      {#if junk.length}
        <ul class="junk">
          {#each junk as [name, n]}<li><span>{name}</span><b>×{n}</b></li>{/each}
        </ul>
      {:else}
        <p class="dim">Nothing unsold. Junk is what a rejected drop leaves behind, and selling it is the only thing in this game that mints gold.</p>
      {/if}
      <button class="act" onclick={onsell} disabled={!here || junkTotal === 0}>
        Sell {junkTotal || 'all'} piece{junkTotal === 1 ? '' : 's'} here
      </button>
    </div>
  </div>

  <h4>{town.name} · the stall{here ? '' : ' — read only, you are standing elsewhere'}</h4>
  <p class="hint"><small>Standing buys stock lines, stash tabs, bag room and cosmetics. It never buys a stat, a Mod or a stone, so a rich character and a poor one face the same mob.</small></p>

  <table class="lines">
    <thead>
      <tr><th>Line</th><th>Sold by</th><th>What it is</th><th>Cost in minutes of this band's income</th><th>Gold</th><th></th></tr>
    </thead>
    <tbody>
      {#each stock as row (row.id)}
        {@const ok = here && canAfford(row)}
        {@const need = gold(row) - purse}
        <tr class:ok class:poor={here && !ok}>
          <td class="name">{row.item}</td>
          <td>{npcOf(row.npc).name}</td>
          <td class="kind">{kindWord(row.kind)}</td>
          <td>{priceMinutes(row, town.id, state)} m{row.charge_band ? ` @ ${row.charge_band}` : ''}</td>
          <td class="price">{gold(row)}</td>
          <td>
            {#if !here}
              <span class="dim">walk there</span>
            {:else if ok}
              <button class="buy" onclick={() => onbuy(row.id)} title="Buy {row.item} for {gold(row)} gold">Buy</button>
            {:else}
              <span class="short">{need > 0 ? `${need.toFixed(0)} gold short` : 'not on offer yet'}</span>
            {/if}
          </td>
        </tr>
      {:else}
        <tr><td colspan="6" class="dim">The stall has nothing this settlement sells.</td></tr>
      {/each}
    </tbody>
  </table>

  {#if here && rolled.length}
    <p class="hint"><small>The Curio pedlar's prices roll today at {rolled.join(' / ')} minutes of income, {state.pedlar.bought} of {rolled.length} taken; they restock at the next game day. A one-off line that adds bag room or a stash tab is worth taking the day it appears.</small></p>
  {/if}
</div>

<style>
  .market { display: grid; gap: .8rem; }
  /* the purse is the thing a market read needs, so it is set on the plate above the stock rather than
     asked for by opening a second screen */
  .counter { display: grid; grid-template-columns: minmax(12rem, 18rem) 1fr; gap: 1rem; }
  .purse {
    display: grid; align-content: center; gap: .1rem; padding: .7rem .9rem;
    border: 1px solid var(--edge); border-radius: 12px; background: var(--glass);
  }
  .purse b { font-family: var(--num); font-size: 1.9rem; line-height: 1; color: var(--gold); font-variant-numeric: tabular-nums; }
  .purse span { color: var(--dim); font-size: .7rem; letter-spacing: .04em; text-transform: uppercase; }
  .sell { display: grid; align-content: start; gap: .35rem; }
  .sell h4 { margin: 0; }
  .junk { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: .2rem .7rem; font-size: .76rem; }
  .junk li { display: inline-flex; gap: .3rem; color: var(--dim); }
  .junk li b { font-family: var(--num); color: var(--text); }
  .act { justify-self: start; }
  .hint { margin: 0; color: var(--dim); }

  /* an affordable line is lit; an unaffordable one says by how much, in gold, in the same place the
     lit one puts its button — a refusal that only removes a button teaches nothing */
  .lines td.name { color: var(--text); font-family: var(--ui); }
  .lines .kind { color: var(--dim); font-family: var(--ui); font-size: .74rem; }
  .lines .price { color: var(--gold); }
  .lines tr.ok { background: rgba(232, 193, 105, .06); }
  .lines tr.ok .price { font-weight: 600; }
  .lines tr.poor td { opacity: .62; }
  .lines .short { font-size: .7rem; color: #e8a093; }
  .buy { border-color: rgba(232, 193, 105, .45); color: var(--gold); }
</style>
