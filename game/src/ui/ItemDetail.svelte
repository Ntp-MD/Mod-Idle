<script lang="ts">
  import { lineName, lineTier, craft } from '../sim/craft';
  import { gearModOf } from '../sim/gear';
  import { vsWorn } from './bag';
  import { STAT_KEYS } from '../engine/client';
  import type { StatKey } from '../engine/client';
  import type { Item } from '../sim/types';

  /**
   * The detail card a slot shows on hover, in the shape Path of Exile teaches: the piece's own name at
   * the top, then every line with its value and Tier, then what it weighs and how it compares to the
   * piece already worn — and the decision itself is the button, never an automatic swap
   * (`harness/decisions.md` D-089). A gear piece is never priced in gold: gold comes from junk sold by
   * hand, and a rejected piece turns into a stone instead (`economy.md` · `loot.md` §4).
   */
  let { item, worn = null, onequip = null, onstat = null, wornHere = false }: {
    item: Item;
    worn?: Item | null;
    onequip?: (() => void) | null;
    onstat?: ((stat: StatKey) => void) | null;
    wornHere?: boolean;
  } = $props();

  const gear = $derived(gearModOf(item));
  const delta = $derived(vsWorn(item, worn));
  const hasStatMod = $derived(item.lines.some((l) => l.id === 'stat_mod_flat' || l.id === 'stat_mod'));
  const chosen = $derived((item as any).chosenStat as StatKey | undefined);

  function compareText() {
    if (wornHere) return 'the piece being worn now';
    if (!worn) return 'nothing of this slot is worn — this would be the first';
    if (delta == null) return '';
    if (delta > 0) return `${delta.toFixed(0)}% stronger than the worn ${worn.base}`;
    if (delta < 0) return `${Math.abs(delta).toFixed(0)}% weaker than the worn ${worn.base}`;
    return `level with the worn ${worn.base}`;
  }
</script>

<div class="detail" class:rare={item.rarity !== 'Common'}>
  <h4>{item.base}</h4>
  <p class="tag">{item.slot} · {item.rarity} · {item.quality} quality · {item.tier}</p>
  {#if (item.upgrade_lv || 0) > 0}
    <p class="tag up">+{item.upgrade_lv} of {craft.C.upgrade_cap} Quality Stone</p>
  {/if}

  <ul class="lines">
    {#each item.lines as line}
      <li>
        <span class="name">{lineName(line.id)}</span>
        <span class="value">+{line.value}</span>
        <span class="tier">{line.slice == null ? item.tier : lineTier(line)}</span>
      </li>
      {#if line.element}<li class="elem">· {line.element}</li>{/if}
    {:else}
      <li class="dim">no rolled lines</li>
    {/each}
  </ul>

  {#if gear.stat}
    <p class="gear">
      Gear Mod · {lineName(gear.stat)}{item.gearMod ? ` +${item.gearMod}` : ''}
      <small>+{craft.C.gear_mod_per_level} a step — this Base’s own line</small>
    </p>
  {/if}

  {#if hasStatMod && onstat}
    <p class="feed">
      A Stat Mod feeds one Core stat — pick which:
      {#each STAT_KEYS as k}
        <button class={chosen === k ? 'active' : ''} onclick={() => onstat(k)}>{k.toUpperCase()}</button>
      {/each}
    </p>
  {:else if hasStatMod}
    <p class="feed">Stat Mod feeds {(chosen || 'str').toUpperCase()}</p>
  {/if}

  <p class="foot">weighs {Math.round(item.weight || 0)} · {compareText()}</p>

  {#if onequip && !wornHere}
    <button class="go" onclick={onequip}>Equip {item.base}</button>
  {/if}
</div>

<style>
  .detail {
    min-width: 15rem;
    max-width: 20rem;
    background: #10131a;
    border: 1px solid var(--line);
    border-left: 3px solid var(--dim);
    padding: .5rem .6rem;
    font-size: .78rem;
  }
  .detail.rare { border-left-color: var(--xp); }
  h4 { margin: 0; font-size: .9rem; }
  .tag { margin: .1rem 0 .4rem; color: var(--dim); font-size: .72rem; }
  .up { color: var(--xp); }
  .lines { list-style: none; margin: 0 0 .3rem; padding: 0; }
  .lines li { display: flex; gap: .35rem; align-items: baseline; }
  .lines li.elem { display: block; color: var(--mana); font-size: .7rem; margin-top: -.2rem; }
  .name { flex: 1; }
  .value { color: var(--good); font-variant-numeric: tabular-nums; }
  .tier { color: var(--dim); font-size: .7rem; }
  .gear { margin: .3rem 0; }
  .gear small { display: block; color: var(--dim); }
  .feed { margin: .35rem 0; color: var(--dim); font-size: .72rem; }
  .feed button { padding: .05rem .25rem; font-size: .68rem; }
  .foot { margin: .35rem 0 .25rem; color: var(--dim); font-size: .72rem; }
  .go { width: 100%; border-color: var(--good); }
  .dim { color: var(--dim); }
</style>
