<script lang="ts">
  /**
   * The piece a settlement service is working on, and the way onto another one.
   *
   * The Forge and the Craft house are two different jobs on the same object, so they read the object the
   * same way: this is the one place a piece is described, and the one place a player chooses which piece is
   * on the bench. Both lists are the engine's own — `loot.score` decides what is strong here, exactly as the
   * bag filter and the cages do, so a suggestion on the bench cannot disagree with a drop decision.
   */
  import { gearIcon } from '../icon';
  import { gearEntry, vsWorn } from './bag';
  import type { Where } from '../sim/craft';
  import type { GameState, Item } from '../sim/types';

  let { state, item, where = null, index = -1, onpick, wornOf }: {
    state: GameState;
    item: Item | null;
    where?: Where | null;
    index?: number;
    onpick: (where: Where, index: number) => void;
    wornOf: (slot: string) => Item | null;
  } = $props();

  const entry = $derived(item ? gearEntry(item, index) : null);
  /** the piece this one would replace, so the head can say what a craft is actually worth — a worn piece
      is the comparison, so it is never also the thing being compared */
  const delta = $derived(item && where !== 'gear' ? vsWorn(item, wornOf(item.slot)) : null);
  const plus = $derived(item?.upgrade_lv || 0);
  const broken = $derived(Boolean(item?.broken));
  const corrupted = $derived(Boolean(item?.corrupted));
  const at = $derived(where === 'gear' ? 'worn · ' + (item?.slot || '') : where === 'bag' ? 'from the hunt pile' : '');

  /** worn first, then the pile, each strongest first inside its own group */
  const picks = $derived.by(() => {
    const worn = state.gear.map((g, i) => (g ? { where: 'gear' as Where, i, e: gearEntry(g, i) } : null)).filter(Boolean) as any[];
    const pile = state.bag.map((g, i) => ({ where: 'bag' as Where, i, e: gearEntry(g, i) }));
    const byScore = (a: any, b: any) => b.e.score - a.e.score;
    return [...worn.sort(byScore), ...pile.sort(byScore)];
  });
</script>

{#if item && entry}
  <div class="head" class:broken class:corrupted>
    <span class="tile">
      <img src={entry.icon} alt="" aria-hidden="true" />
      {#if plus}<b class="plus">+{plus}</b>{/if}
    </span>
    <div class="who">
      <h3>{item.base}{#if plus} <span class="lv">+{plus}</span>{/if}</h3>
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
    <p><b>Nothing is on the bench.</b> Pick a piece below — everything you wear, and everything this trip
      kept. A stashed piece has to come out of the warehouse first; a service works on what the character
      is carrying.</p>
  </div>
{/if}

<div class="picker">
  <span class="lab">On the bench</span>
  <div class="row">
    {#each picks as p (p.where + ':' + p.i)}
      <button
        class="chip"
        class:now={p.where === where && p.i === index}
        onclick={() => onpick(p.where, p.i)}
        title={`${p.e.title} · ${p.e.sub}`}
        aria-label={`${p.e.title}, ${p.where === 'gear' ? 'worn in ' + p.e.slot : 'in the hunt pile'}`}>
        <img src={p.e.icon} alt="" aria-hidden="true" />
        <span>{p.e.title}</span>
        {#if p.e.item.upgrade_lv}<b class="pl">+{p.e.item.upgrade_lv}</b>{/if}
      </button>
    {:else}
      <span class="dim">Nothing carried yet.</span>
    {/each}
  </div>
</div>

<style>
  .head {
    display: grid; grid-template-columns: auto 1fr auto; gap: .9rem; align-items: center;
    padding: .7rem .8rem; border: 1px solid var(--edge); border-radius: 12px; background: var(--glass);
  }
  .head.none { grid-template-columns: 1fr; color: var(--dim); }
  .head.broken { border-color: rgba(192, 57, 43, .6); }
  .head.corrupted { border-color: rgba(200, 165, 255, .5); }
  .tile {
    position: relative; width: 3.4rem; height: 3.4rem; display: grid; place-items: center;
    border: 1px solid var(--line); border-radius: 10px; background: #171b22;
  }
  .tile img { width: 68%; height: 68%; object-fit: contain; }
  .tile .plus {
    position: absolute; right: -.2rem; bottom: -.2rem; font-family: var(--num); font-size: .74rem;
    color: var(--xp); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 0 .25rem;
  }
  .who h3 { margin: 0; font-size: .95rem; }
  .who .lv { color: var(--xp); font-family: var(--num); }
  .sub { margin: .15rem 0 0; color: var(--dim); font-size: .74rem; }
  .src { color: var(--mob); font-size: .7rem; }
  .src::before { content: '· '; }
  .vs { margin: .2rem 0 0; font-size: .74rem; font-family: var(--num); color: #e8a093; }
  .vs.better { color: var(--good); }
  .flags { display: grid; gap: .2rem; justify-items: end; }
  .flag { font-size: .68rem; color: var(--dim); border: 1px solid var(--line); border-radius: 999px; padding: .1rem .5rem; }
  .flag.bad { color: #ff9a8c; border-color: var(--hp); }
  .flag.warn { color: #c8a5ff; border-color: #6c5199; }
  .flag.ok { color: var(--good); border-color: rgba(39, 174, 96, .5); }

  .picker { display: grid; gap: .3rem; }
  .lab { color: var(--dim); font-size: .68rem; letter-spacing: .1em; text-transform: uppercase; }
  .row { display: flex; flex-wrap: wrap; gap: .25rem; }
  .chip {
    display: inline-flex; align-items: center; gap: .35rem; padding: .2rem .5rem .2rem .3rem;
    font-size: .72rem; border-radius: 999px; background: #171b22;
  }
  .chip img { width: 1.15rem; height: 1.15rem; object-fit: contain; }
  .chip .pl { color: var(--xp); font-family: var(--num); }
  .chip.now { border-color: var(--gold); background: rgba(232, 193, 105, .12); color: var(--gold); }
</style>
