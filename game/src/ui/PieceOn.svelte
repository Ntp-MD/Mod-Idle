<script lang="ts">
  /**
   * The piece a settlement service is working on, and the way onto another one.
   *
   * The Forge and the Craft house are two different jobs on the same object, so they read the object the
   * same way: this is the one place a piece is described, and the one place a player chooses which piece is
   * on the bench. Both lists are the engine's own — `loot.score` decides what is strong here, exactly as the
   * bag filter and the cages do, so a suggestion on the bench cannot disagree with a drop decision.
   *
   * The state prop is `game`, not `state`: a binding named `state` in the same component makes the compiler
   * read `$state(...)` as a store subscription (the trap `App.svelte` documents for its own top level).
   */
  import { gearIcon } from '../icon';
  import { itemName } from '../sim/item-name';
  import { gearEntry, vsWorn } from './bag';
  import type { Where } from '../sim/craft';
  import type { GameState, Item } from '../sim/types';

  let { game, item, where = null, index = -1, onpick, wornOf, wornOnly = false, pickPageSize = 24 }: {
    game: GameState;
    item: Item | null;
    where?: Where | null;
    index?: number;
    onpick: (where: Where, index: number) => void;
    wornOf: (slot: string) => Item | null;
    /** the craft bench reads its bag pieces off the bag column beside it, so its picker lists worn only */
    wornOnly?: boolean;
    /** the picker folds past this many chips: a forge bench can list every piece in the bag, and a hundred
        chips would push the ladder off the modal */
    pickPageSize?: number;
  } = $props();

  const entry = $derived(item ? gearEntry(item, index) : null);
  /** the piece this one would replace, so the head can say what a craft is actually worth — a worn piece
      is the comparison, so it is never also the thing being compared */
  const delta = $derived(item && where !== 'gear' ? vsWorn(item, wornOf(item.slot)) : null);
  const plus = $derived(item?.upgrade_lv || 0);
  const broken = $derived(Boolean(item?.broken));
  const corrupted = $derived(Boolean(item?.corrupted));
  const at = $derived(where === 'gear' ? 'worn · ' + (item?.slot || '') : where === 'bag' ? 'from the bag' : '');

  /** worn first, then the bag, each strongest first inside its own group */
  const picks = $derived.by(() => {
    const worn = game.gear.map((g, i) => (g ? { where: 'gear' as Where, i, e: gearEntry(g, i) } : null)).filter(Boolean) as any[];
    if (wornOnly) return worn.sort((a, b) => b.e.score - a.e.score);
    const carried = game.bag.map((g, i) => ({ where: 'bag' as Where, i, e: gearEntry(g, i) }));
    const byScore = (a: any, b: any) => b.e.score - a.e.score;
    return [...worn.sort(byScore), ...carried.sort(byScore)];
  });
  /** the picker's own page: the worn list never fills one, the bag's pieces fill several */
  let pickPage = $state(0);
  const pickPages = $derived(Math.max(1, Math.ceil(picks.length / pickPageSize)));
  const pickAt = $derived(Math.min(pickPage, pickPages - 1));
  const pickView = $derived(picks.slice(pickAt * pickPageSize, pickAt * pickPageSize + pickPageSize));
</script>

{#if item && entry}
  <div class="head" class:broken class:corrupted>
    <span class="tile">
      <img src={entry.icon} alt="" aria-hidden="true" />
      {#if plus}<b class="plus">+{plus}</b>{/if}
    </span>
    <div class="who">
      <h3>{itemName(item)}{#if plus} <span class="lv">+{plus}</span>{/if}</h3>
      <p class="sub">
        {item.slot} · item level {item.ilvl} · {item.quality} quality · {item.tier} tier · {item.lines.length} mod lines
        <span class="src">{at}</span>
      </p>
      {#if delta != null}
        <p class="vs" class:better={delta > 0}>
          {delta > 0 ? `+${delta}%` : `${delta}%`} against the piece worn in {item.slot}
        </p>
      {/if}
    </div>
    <div class="flags">
      {#if broken}<span class="flag bad">Broken · contributes nothing until repaired</span>{/if}
      {#if corrupted}<span class="flag warn">Corrupted · no stone touches it again</span>{/if}
      {#if item.locked}<span class="flag">Locked</span>{/if}
      {#if !broken && !corrupted}<span class="flag ok">Open to stones</span>{/if}
    </div>
  </div>
{:else}
  <div class="head none">
    <p><b>Nothing is on the bench.</b> Pick a piece below — everything you wear{wornOnly
      ? ''
      : ', and everything this trip kept'}. A stashed piece has to come out of the warehouse first;
      a service works on what the character is carrying.</p>
  </div>
{/if}

<div class="picker">
  <span class="lab">On the bench</span>
  <div class="row">
    {#each pickView as p (p.where + ':' + p.i)}
      <button
        class="chip chip-tag"
        class:picked={p.where === where && p.i === index}
        onclick={() => onpick(p.where, p.i)}
        title={`${p.e.title} · ${p.e.sub}`}
        aria-label={`${p.e.title}, ${p.where === 'gear' ? 'worn in ' + p.e.slot : 'in the bag'}`}>
        <img src={p.e.icon} alt="" aria-hidden="true" />
        <span>{p.e.title}</span>
        {#if p.e.item.upgrade_lv}<b class="plus">+{p.e.item.upgrade_lv}</b>{/if}
      </button>
      {:else}
        <span class="dim">Nothing carried yet.</span>
    {/each}
  </div>
  {#if pickPages > 1}
    <div class="pager" role="group" aria-label="Bench piece pages">
      <button disabled={pickAt === 0} onclick={() => (pickPage = pickAt - 1)} aria-label="Previous page">‹</button>
      <span>{pickAt + 1} / {pickPages}</span>
      <button disabled={pickAt === pickPages - 1} onclick={() => (pickPage = pickAt + 1)} aria-label="Next page">›</button>
    </div>
  {/if}
</div>

<style>
  .head {
    display: grid; grid-template-columns: auto 1fr auto; gap: var(--spacing-md); align-items: center;
    padding: var(--spacing-sm) var(--spacing-sm); border: 1px solid var(--edge); border-radius: var(--radius-card); background: var(--glass);
  }
  .head.none { grid-template-columns: 1fr; color: var(--dim); }
  .head.broken { border-color: color-mix(in srgb, var(--hp) 60%, transparent); }
  .head.corrupted { border-color: color-mix(in srgb, var(--curse) 50%, transparent); }
  .tile {
    position: relative; width: calc(var(--icon-card) * 1.4); height: calc(var(--icon-card) * 1.4); display: grid; place-items: center;
    border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--inset);
  }
  .tile img { width: var(--icon-card); height: var(--icon-card); object-fit: contain; }
  .tile .plus {
    position: absolute; right: clamp(-5px, -0.19vw, -2px); bottom: clamp(-5px, -0.19vw, -2px); font-family: var(--num); font-size: var(--font-xs);
    color: var(--xp); background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-card); padding: 0 var(--spacing-xs);
  }
  .who { display: flex; flex-direction: column; gap: var(--spacing-xs); min-width: 0; }
  .who h3 { margin: 0; font-size: var(--font-sm); }
  .who .lv { color: var(--xp); font-family: var(--num); }
  .sub { color: var(--dim); font-size: var(--font-xs); }
  .src { color: var(--mob); font-size: var(--font-xs); }
  .src::before { content: '· '; }
  .vs { font-size: var(--font-xs); font-family: var(--num); color: var(--alarm); }
  .vs.better { color: var(--good); }
  .flags { display: grid; gap: var(--spacing-xs); justify-items: end; }
  .flag { font-size: var(--font-xs); color: var(--dim); border: 1px solid var(--line); border-radius: var(--radius-card); padding: var(--spacing-xs) var(--spacing-xs); }
  .flag.bad { color: var(--alarm); border-color: var(--hp); }
  .flag.warn { color: var(--curse); border-color: var(--elite); }
  .flag.ok { color: var(--good); border-color: color-mix(in srgb, var(--good) 50%, transparent); }

  .picker { display: grid; gap: var(--spacing-xs); }
  .lab { color: var(--dim); font-size: var(--font-xs); letter-spacing: var(--spacing-xs); text-transform: uppercase; }
  .row { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
  .chip { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .chip img { width: var(--icon-label); height: var(--icon-label); object-fit: contain; }
  .pager { display: flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-xs); color: var(--dim); font-variant-numeric: tabular-nums; }
  .pager button { font-size: var(--font-xs); }
  .pager button:disabled { opacity: .4; }
</style>
