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
  import { craft, lineName, lineTier, stoneName, replaceChoices, imprintStonesOf, opScope, pressName, craftedMark } from '../sim/craft';
  import type { CraftOp } from '../sim/craft';
  import PieceOn from './PieceOn.svelte';
  import type { GameState, Item } from '../sim/types';

  let { game, item, where = null, index = -1, onpick, onrun, wornOf, note = '' }: {
    game: GameState;
    item: Item | null;
    where?: 'gear' | 'bag' | null;
    index?: number;
    onpick: (where: 'gear' | 'bag', index: number) => void;
    onrun: (op: CraftOp, line?: number, pick?: string) => void;
    wornOf: (slot: string) => Item | null;
    note?: string;
  } = $props();

  const UNT = craft.UNTOUCHABLE as number;
  const FRAME = craft.PIECE_FLOOR as number;
  /** The head one verb stops at: identity verbs reach the Bound pair, value and count verbs do not. */
  const floorOf = (op: CraftOp) => (opScope(op) === 'piece' ? FRAME : UNT);
  const held = $derived(game.counters.stones || {});
  /** The bench only offers a chosen line when the purse can actually pay for one. */
  let pickRow = $state(-1);
  let pick = $state('');
  /** A chosen Mod going into a line the stone picks, and a chosen Mod filling the next empty line. */
  let randomPick = $state('');
  let addPick = $state('');
  /** What the stone may bring in on this piece — its own Base pool, minus what it already wears. */
  /** What the stone may bring in on this piece — its own pool, minus what it already wears. */
  const choices = $derived(item && where != null && index >= 0 ? replaceChoices(game, where, index) : []);
  /** Imprint stones held, each carrying one Mod's own identity. */
  let imprintRow = $state(-1);
  let imprintPick = $state('');
  const imprints = $derived(imprintStonesOf(held));
  const canImprint = (i: number, mod: string) => !!item
    && craft.guard(item, 'imprint').ok && i >= UNT && (held['imprint_' + mod] || 0) >= 1;
  /** How many lines a press would edit — a press that edits nothing is not a free press, it is a refusal. */
  const presses = (op: CraftOp) => !item ? 0
    : op === 'polish' ? item.lines.length
      : op === 'rebirth' ? craft.editableCount(item, UNT)
        : op === 'reroll_mod_all' || op === 'replace_all' ? craft.editableCount(item, FRAME)
          : 1;
  const can = (op: CraftOp, i?: number) => item
    ? presses(op) > 0 && craft.guard(item, op).ok && craft.payable(held, op, item) && (i == null || i >= floorOf(op))
    : false;
  const why = (op: CraftOp, i?: number) => {
    if (!item) return 'pick a piece first';
    if (presses(op) === 0) return 'this piece has no line that press can edit';
    const g = craft.guard(item, op);
    if (!g.ok) return g.why;
    if (i != null && i < floorOf(op)) return i < FRAME
      ? 'the Frame Mod is the frame itself — no stone redraws it'
      : opScope(op) === 'piece' ? 'that verb does not reach this line'
        : 'the Bound pair is part of the piece: value and count stones stop below it';
    if (!craft.payable(held, op, item)) return cost(op, item).map(([k, n]) => `needs ${n} ${stoneName(k)}`).join(' · ');
    return '';
  };
  const cost = (op: string, it: any) => Object.entries(craft.costOf(op, it) || {}) as [string, number][];
  const line = (op: CraftOp) => cost(op, item).map(([k, n]) => `${n} ${stoneName(k)}`).join(' + ');
  /** A press with nothing to edit has no price to print — it has a reason. */
  const price = (op: CraftOp) => (presses(op) === 0 ? 'no line to edit' : line(op));
  /**
   * What this row's presses cost, by stone: a row says `1 Value · 1 Tier · 2 Replace · 1 Remove`
   * rather than repeating a stone name per press, and the Bound pair says only what it actually
   * accepts — the identity presses — so the reach rule and the price are one line.
   */
  const rowPrices = (valueLocked: boolean) => {
    const ops: CraftOp[] = valueLocked ? ['reroll_mod', 'replace']
      : ['reroll', 'refine', 'reroll_mod', 'replace', 'remove_at'];
    const byStone = new Map<string, string>();
    for (const op of ops) for (const [k, n] of cost(op, item)) {
      // the short form is the shared name minus the word it repeats down the column
      const key = stoneName(k).replace(/ stone$/, '');
      if (!byStone.has(key) || Number(byStone.get(key)) > n) byStone.set(key, String(n));
    }
    return [...byStone].map(([k, n]) => `${n} ${k}`).join(' \u00b7 ');
  };

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
              {@const fixed = i < FRAME}
              {@const bound = i >= FRAME && i < UNT}
              {@const valueLocked = i < UNT}
              <tr class:fixed={fixed || valueLocked}>
                <td class="no">{i + 1}</td>
                <td>
                  {lineName(l.id)}{craftedMark(l)}
                  {#if fixed}<span class="tag">Frame Mod</span>{/if}
                  {#if bound}<span class="tag">Bound</span>{/if}
                  {#if l.element}<span class="tag el">{l.element}</span>{/if}
                </td>
                <td class="val">
                  {l.value}
                  {#if !valueLocked && r}<small>{r.floor}…{r.hi}</small>{/if}
                </td>
                <td>
                  <span class="band" aria-label={`tier ${lineTier(l)}`}>
                    {#each bandOf(l) as on}<i class:on={on}></i>{/each}
                  </span>
                  <span class="t">{lineTier(l)}</span>
                </td>
                <td class="verbs">
                  {#if fixed}
                    <span class="dim">no stone redraws the Frame Mod</span>
                  {:else}
                    {#if !valueLocked}
                      <button disabled={!can('reroll', i)} onclick={() => onrun('reroll', i)} title={why('reroll', i)}>{pressName('reroll')}</button>
                      <button disabled={!can('refine', i)} onclick={() => onrun('refine', i)} title={why('refine', i)}>{pressName('refine')}</button>
                      <button disabled={!can('randomize', i)} onclick={() => onrun('randomize', i)} title={why('randomize', i)}>{pressName('randomize')}</button>
                    {/if}
                    <button disabled={!can('reroll_mod', i)} onclick={() => onrun('reroll_mod', i)} title={why('reroll_mod', i)}>{pressName('reroll_mod')}</button>
                    <button class:armed={pickRow === i} disabled={!can('replace', i)}
                            onclick={() => { pickRow = pickRow === i ? -1 : i; pick = ''; }}
                            title={why('replace', i)}>{pressName('replace')}…</button>
                    {#if pickRow === i}
                      <span class="pick">
                        <select bind:value={pick} aria-label={`the Mod that takes slot ${i + 1}`}>
                          <option value="">choose a Mod</option>
                          {#each choices as id (id)}<option value={id}>{lineName(id)}</option>{/each}
                        </select>
                        <button disabled={!pick} onclick={() => { onrun('replace', i, pick); pickRow = -1; }}>press</button>
                      </span>
                    {/if}
                    {#if !valueLocked}
                      <button class:armed={imprintRow === i} disabled={imprintRow !== i && !imprints.length}
                              onclick={() => { imprintRow = imprintRow === i ? -1 : i; imprintPick = ''; }}
                              title={imprints.length ? 'rewrite this line as a held imprint stone' : 'no imprint stone held'}>{pressName('imprint')}…</button>
                      {#if imprintRow === i}
                        <span class="pick">
                          <select bind:value={imprintPick} aria-label={`the imprint stone that takes slot ${i + 1}`}>
                            <option value="">choose a stone</option>
                            {#each imprints as s (s.key)}<option value={s.mod}>{lineName(s.mod)} ({held[s.key]})</option>{/each}
                          </select>
                          <button disabled={!imprintPick || !canImprint(i, imprintPick)} onclick={() => { onrun('imprint', i, imprintPick); imprintRow = -1; }}>press</button>
                        </span>
                      {/if}
                      <button disabled={!can('remove_at', i)} onclick={() => onrun('remove_at', i)} title={why('remove_at', i)}>{pressName('remove_at')}</button>
                    {/if}
                  {/if}
                </td>
                <td class="prices">{#if !fixed}{rowPrices(valueLocked)}{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="foot"><small>
          Reroll value moves the number inside the line's own Tier and never below the floor printed next to
          it — that floor is the highest value this slot has ever held, so a Refine cannot make a Reroll
          cheap to undo. Refine pushes the line one Tier up. Roll tier redraws the Tier and leaves the Mod
          where it is.
          <br><br>
          Two verbs change what a line <em>is</em>. <b>Roll new Mod</b> pays the roll price and lets the
          piece's own pool decide what arrives. <b>Replace</b> costs the chosen swap: you name the Mod that
          comes in, from the list this Base already draws from, and the Tier it lands on is still the
          stone's roll — so a chosen Mod still has to be climbed. An imprint stone carries one Mod's own
          identity: you choose which Unbound line it rewrites, and the Tier and value roll fresh, one stone
          a use.
          <br><br>
          The head of the piece is where the verbs part. The <b>Frame Mod</b> (line one) is the frame
          itself: no stone redraws it, and only a whole-piece stone moves its value. The <b>Bound pair</b>
          takes an identity — a rolled Mod or a chosen Replace — but no value stone and no Add or Remove,
          which is why the piece remembers how many Unbound lines it dropped with.
        </small></p>
      </section>

      <section class="whole">
        <h4>The piece itself</h4>
        <div class="wbtns">
          <button disabled={!can('add')} onclick={() => onrun('add')} title={why('add')}>
            <b>{pressName('add')}</b><span>{line('add')} · {added} of {modCap} added · the pool draws</span>
          </button>
          <span class="pick">
            <select bind:value={addPick} aria-label="the Mod the Add stone fills with">
              <option value="">choose what is added</option>
              {#each choices as id (id)}<option value={id}>{lineName(id)}</option>{/each}
            </select>
            <button disabled={!can('add_specific') || !addPick}
                    onclick={() => { onrun('add_specific', 0, addPick); addPick = ''; }}
                    title={why('add_specific') || 'the line is filled next, from this Base pool'}>
              {pressName('add_specific')}
            </button>
          </span>
          <button disabled={!can('remove')} onclick={() => onrun('remove')} title={why('remove')}>
            <b>{pressName('remove')}</b><span>{line('remove')} · an Unbound line, chosen by the stone</span>
          </button>
          <button disabled={!can('reroll_random')} onclick={() => onrun('reroll_random')} title={why('reroll_random')}>
            <b>{pressName('reroll_random')}</b><span>{line('reroll_random')} · an Unbound line</span>
          </button>
          <button disabled={!can('reroll_mod_all')} onclick={() => onrun('reroll_mod_all')} title={why('reroll_mod_all')}>
            <b>{pressName('reroll_mod_all')}</b><span>{price('reroll_mod_all')} · every line but the Frame Mod</span>
          </button>
          <button disabled={!can('replace_all')} onclick={() => onrun('replace_all')} title={why('replace_all')}>
            <b>{pressName('replace_all')}</b><span>{price('replace_all')} · every line but the Frame Mod</span>
          </button>
          <span class="pick">
            <select bind:value={randomPick} aria-label="the Mod that lands on a random Unbound line">
              <option value="">choose what replaces</option>
              {#each choices as id (id)}<option value={id}>{lineName(id)}</option>{/each}
            </select>
            <button disabled={!can('replace_random') || !randomPick}
                    onclick={() => { onrun('replace_random', 0, randomPick); randomPick = ''; }}
                    title={why('replace_random') || 'the stone picks the Unbound line'}>
              {pressName('replace_random')}
            </button>
          </span>
          <button disabled={!can('polish')} onclick={() => onrun('polish')} title={why('polish')}>
            <b>{pressName('polish')}</b><span>{line('polish')} · every value rerolled inside its own Tier, Tiers held</span>
          </button>
          <button disabled={!can('rebirth')} onclick={() => onrun('rebirth')} title={why('rebirth')}>
            <b>{pressName('rebirth')}</b><span>{line('rebirth')} · every Unbound line drawn again from the Base pool, the Frame Mod and Bound pair kept</span>
          </button>
          <button disabled={!can('ascend')} onclick={() => onrun('ascend')} title={why('ascend')}>
            <b>{pressName('ascend')}</b><span>{line('ascend')} · one item-quality step up</span>
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
        <p><small>A stone is spent even when a press changes nothing. Value presses keep the Mod and the
          Tier they were given; Roll new Mod, Replace and an imprint stone change what a line <em>is</em>,
          and an Element moves only when an elemental Mod arrives or Corrupt redraws the piece on the
          Forge.</small></p>
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
