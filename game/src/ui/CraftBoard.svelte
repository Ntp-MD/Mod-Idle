<script lang="ts">
  /**
   * The craft house — the screen that changes what a piece <em>is</em>, not how high it sits.
   *
   * Three verbs per line and three for the whole piece, each printing its own stone price from the shared
   * module before it is pressed. A line the skeleton refuses to edit says which line it is and why, because
   * "disabled" with no reason is a wall. Reroll moves a value inside its own Tier and never down: the floor
   * is the highest value that slot has ever held, so the screen shows that floor rather than only the number
   * the line carries now.
   *
   * The state prop is `game`, not `state`: a binding named `state` in the same component makes the compiler
   * read `$state(...)` as a store subscription (the trap `App.svelte` documents for its own top level).
   */
  import { E, loot } from '../engine/client';
  import { craft, lineName, lineTier, stoneName, replaceChoices } from '../sim/craft';
  import PieceOn from './PieceOn.svelte';
  import type { GameState, Item } from '../sim/types';

  let { game, item, where = null, index = -1, onpick, onrun, wornOf, note = '' }: {
    game: GameState;
    item: Item | null;
    where?: 'gear' | 'bag' | null;
    index?: number;
    onpick: (where: 'gear' | 'bag', index: number) => void;
    onrun: (op: 'reroll' | 'refine' | 'randomize' | 'ascend' | 'add' | 'remove' | 'replace', line?: number, pick?: string) => void;
    wornOf: (slot: string) => Item | null;
    note?: string;
  } = $props();

  const UNT = craft.UNTOUCHABLE as number;
  const held = $derived(game.counters.stones || {});
  /** The bench only offers a chosen line when the purse can actually pay for one. */
  let pickRow = $state(-1);
  let pick = $state('');
  /** What the stone may bring in on this piece — its own Base pool, minus what it already wears. */
  const choices = $derived(item && where != null && index >= 0 ? replaceChoices(game, where, index) : []);
  const can = (op: string, i?: number) => item
    ? craft.guard(item, op).ok && craft.payable(held, op, item) && (i == null || i >= UNT)
    : false;
  const why = (op: string, i?: number) => {
    if (!item) return 'pick a piece first';
    const g = craft.guard(item, op);
    if (!g.ok) return g.why;
    if (i != null && i < UNT) return op === 'remove'
      ? 'the Base Mod and the Sub pair are part of the piece, not a stone'
      : 'the Base Mod and Sub lines cannot be changed';
    if (!craft.payable(held, op, item)) return cost(op, item).map(([k, n]) => `needs ${n} ${stoneName(k)}`).join(' · ');
    return '';
  };
  const cost = (op: string, it: any) => Object.entries(craft.costOf(op, it) || {}) as [string, number][];
  const line = (op: string) => cost(op, item).map(([k, n]) => `${n} ${stoneName(k)}`).join(' + ');

  /** the band a line sits in, drawn as the three steps the engine actually names */
  const bandOf = (l: any) => {
    const t = l.slice == null ? -1 : l.slice;
    return craft.QUALITY_STEPS.map((_: string, i: number) => i <= t);
  };
  const added = $derived(item?.mods_added || 0);
  const modCap = $derived(E.item_level.mods_added_cap as number);

  /** the range a Reroll can move inside, so the row can show the room a press has */
  const room = (i: number) => {
    if (!item) return null;
    const l = item.lines[i];
    if (!l) return null;
    const [lo, hi] = loot.rangeOf(l.id, item.ilvl, item.q, l.slice == null ? 2 : l.slice);
    const floor = Math.max(lo, item.baselines?.[i] ?? lo, l.value);
    return { lo, hi, floor, now: l.value };
  };
</script>

<div class="shop">
  <PieceOn state={game} {item} {where} {index} {onpick} {wornOf} />

  {#if item}
    <div class="cols">
      <section class="lines">
        <h4>Mod lines · a stone moves one line at a time</h4>
        <table>
          <thead>
            <tr><th>Slot</th><th>Mod</th><th>Value</th><th>Tier</th><th>What a press can do</th><th>Stones</th></tr>
          </thead>
          <tbody>
            {#each item.lines as l, i (i)}
              {@const r = room(i)}
              {@const fixed = i < UNT}
              <tr class:fixed>
                <td class="no">{i + 1}</td>
                <td>
                  {lineName(l.id)}
                  {#if fixed}<span class="tag">{i === 0 ? 'Base Mod' : 'Sub'}</span>{/if}
                  {#if l.element}<span class="tag el">{l.element}</span>{/if}
                </td>
                <td class="val">
                  {l.value}
                  {#if !fixed && r}<small>{r.floor}…{r.hi}</small>{/if}
                </td>
                <td>
                  <span class="band" aria-label={`tier ${lineTier(l)}`}>
                    {#each bandOf(l) as on}<i class:on={on}></i>{/each}
                  </span>
                  <span class="t">{lineTier(l)}</span>
                </td>
                <td class="verbs">
                  {#if fixed}
                    <span class="dim">no stone edits this line</span>
                  {:else}
                    <button disabled={!can('reroll', i)} onclick={() => onrun('reroll', i)} title={why('reroll', i)}>reroll value</button>
                    <button disabled={!can('refine', i)} onclick={() => onrun('refine', i)} title={why('refine', i)}>refine tier</button>
                    <button disabled={!can('randomize', i)} onclick={() => onrun('randomize', i)} title={why('randomize', i)}>roll tier</button>
                    <button class:armed={pickRow === i} disabled={!can('replace', i)}
                            onclick={() => { pickRow = pickRow === i ? -1 : i; pick = ''; }}
                            title={why('replace', i)}>replace with…</button>
                    {#if pickRow === i}
                      <span class="pick">
                        <select bind:value={pick} aria-label={`the Mod that takes slot ${i + 1}`}>
                          <option value="">choose a Mod</option>
                          {#each choices as id (id)}<option value={id}>{lineName(id)}</option>{/each}
                        </select>
                        <button disabled={!pick} onclick={() => { onrun('replace', i, pick); pickRow = -1; }}>press</button>
                      </span>
                    {/if}
                  {/if}
                </td>
                <td class="prices">{#if !fixed}{line('reroll')} · {line('refine')} · {line('replace')}{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="foot"><small>
          Reroll moves the value inside the line's own Tier and never below the floor printed next to it —
          that floor is the highest value this slot has ever held, so a Refine cannot make a Reroll cheap to
          undo. Refine pushes the line one Tier up and moves the whole set of a piece's lines with it.
          Replace is the one stone that names its own line: you choose which Mod leaves and which comes in,
          from the list this Base already draws from — and the Tier the new line lands on is still the
          stone's roll, so a chosen Mod still has to be climbed. It spends no Add charge and never touches
          the Base Mod or the Sub pair.
        </small></p>
      </section>

      <section class="whole">
        <h4>The piece itself</h4>
        <div class="wbtns">
          <button disabled={!can('add')} onclick={() => onrun('add')} title={why('add')}>
            <b>Add a Mod</b><span>{line('add')} · {added} of {modCap} added</span>
          </button>
          <button disabled={!can('ascend')} onclick={() => onrun('ascend')} title={why('ascend')}>
            <b>Ascend the piece</b><span>{line('ascend')} · one item-quality step up</span>
          </button>
          <button disabled={!can('remove')} onclick={() => onrun('remove')} title={why('remove')}>
            <b>Remove a Mod</b><span>{line('remove')} · never the Base or the Sub pair</span>
          </button>
        </div>
        <p class="now">
          {item.quality} quality · {item.lines.length} lines · +{item.upgrade_lv || 0} enhanced
        </p>
        <h4>Stones held</h4>
        <ul class="purse">
          {#each Object.entries(held).filter(([, v]) => (v as number) > 0) as [k, v] (k)}
            <li><b>{v}</b> {stoneName(k)}</li>
          {:else}
            <li class="dim">None yet.</li>
          {/each}
        </ul>
        <p><small>A stone is spent even when a press changes nothing. A piece keeps its Element and its mod
          identity through every stone here — only Corrupt, on the Forge, may move an Element.</small></p>
        {#if note}<p class="result">{note}</p>{/if}
      </section>
    </div>
  {:else}
    <p class="dim">Pick a piece above to see what each stone would do to it.</p>
  {/if}
</div>

<style>
  .shop { display: grid; gap: .9rem; }
  .cols { display: grid; grid-template-columns: 1fr minmax(15rem, 20rem); gap: 1rem; align-items: start; }
  h4 { margin: 0 0 .35rem; }
  .val { color: var(--text); }
  .val small { color: var(--mob); font-size: .66rem; margin-left: .35rem; }
  .no { color: var(--mob); width: 2.4rem; }
  .tag { margin-left: .35rem; font-size: .62rem; color: var(--dim); border: 1px solid var(--line); border-radius: 999px; padding: 0 .35rem; }
  .tag.el { color: #a8e6ff; border-color: rgba(79, 195, 247, .4); }
  tr.fixed td { opacity: .72; }

  /* the tier a line sits in is a band of three, because Tier is a set of steps and not a number */
  .band { display: inline-flex; gap: .12rem; margin-right: .3rem; vertical-align: middle; }
  .band i { width: .75rem; height: .35rem; border-radius: 2px; background: #232a34; border: 1px solid var(--line); }
  .band i.on { background: var(--gold); border-color: var(--gold); }
  .t { font-size: .68rem; color: var(--dim); }

  .verbs { display: flex; flex-wrap: wrap; gap: .2rem; align-items: center; }
  .verbs button { padding: .12rem .4rem; font-size: .68rem; }
  .verbs button:disabled { opacity: .42; cursor: not-allowed; }
  .verbs button.armed { border-color: var(--gold); color: var(--gold); }
  /* the Replace stone's own choice: the line it names, from the pool this Base already draws */
  .pick { display: inline-flex; gap: .2rem; align-items: center; width: 100%; margin-top: .15rem; }
  .pick select { font-size: .68rem; padding: .1rem .25rem; background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 2px; }
  .pick button { padding: .12rem .45rem; font-size: .68rem; border-color: var(--gold); }
  .prices { font-size: .66rem; color: var(--mob); }
  .foot { margin: .35rem 0 0; color: var(--dim); }

  .wbtns { display: grid; gap: .35rem; }
  .wbtns button { display: grid; gap: .1rem; justify-items: start; text-align: left; padding: .5rem .7rem; }
  .wbtns b { font-size: .82rem; }
  .wbtns span { font-size: .68rem; color: var(--dim); }
  .wbtns button:disabled { opacity: .45; cursor: not-allowed; }
  .now { margin: .4rem 0 0; font-family: var(--num); font-size: .76rem; color: var(--dim); }
  .purse { list-style: none; margin: 0; padding: 0; display: grid; gap: .15rem; font-size: .76rem; color: var(--dim); }
  .purse b { font-family: var(--num); color: var(--gold); }
  .result { margin: .4rem 0 0; padding: .4rem .6rem; border-radius: 8px; font-size: .78rem; background: var(--panel); border: 1px solid var(--edge); }

  @media (max-width: 1280px) {
    .cols { grid-template-columns: 1fr; }
    .prices, .foot { display: none; }
  }
</style>
