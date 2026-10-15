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
  import { itemName } from '../sim/item-name';
  import { craft, lineName, lineTier, stoneName, replaceChoices, imprintStonesOf, opScope, pressName, craftedMark } from '../sim/craft';
  import type { CraftOp } from '../sim/craft';
  import PieceOn from './PieceOn.svelte';
  import SlotGrid from './SlotGrid.svelte';
  import { gearEntry } from './bag';
  import { modIcon } from '../icon';
  import type { GameState, Item } from '../sim/types';
  import stoneRerollValue from '../icon/misc/stones/stone-reroll-value.svg?url';
  import stoneRerollTier from '../icon/misc/stones/stone-reroll-tier.svg?url';
  import stoneAdd from '../icon/misc/stones/stone-add-mod.svg?url';
  import stoneRemove from '../icon/misc/stones/stone-remove-mod.svg?url';
  import stoneQuality from '../icon/misc/stones/stone-quality.svg?url';
  import stoneRepair from '../icon/misc/stones/stone-repair.svg?url';
  import stoneCorrupt from '../icon/misc/stones/stone-corrupt.svg?url';
  import runeStone from '../icon/misc/stones/rune-stone.svg?url';
  import crystalOne from '../icon/misc/stones/crystal-cluster-1.svg?url';
  import crystalTwo from '../icon/misc/stones/crystal-cluster-2.svg?url';
  import crystalGrowth from '../icon/misc/stones/crystal-growth.svg?url';

  let { game, item, where = null, index = -1, onpick, onrun, wornOf, note = '', embedded = false, stoneRequest = null, onstoneclear = () => {} }: {
    game: GameState;
    item: Item | null;
    where?: 'gear' | 'bag' | null;
    index?: number;
    onpick: (where: 'gear' | 'bag', index: number) => void;
    onrun: (op: CraftOp, line?: number, pick?: string) => void;
    wornOf: (slot: string) => Item | null;
    note?: string;
    embedded?: boolean;
    stoneRequest?: { key: string; id: number; applied?: boolean } | null;
    onstoneclear?: () => void;
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
    : op === 'polish' || op === 'reforge' ? item.lines.length
      : op === 'rebirth' ? craft.editableCount(item, UNT)
        : op === 'reroll_mod_all' || op === 'replace_all' ? craft.editableCount(item, FRAME)
          : 1;
  const can = (op: CraftOp, i?: number) => item
    ? presses(op) > 0 && craft.guard(item, op).ok && craft.payable(held, op, item)
      && (i == null || i >= floorOf(op))
      && !(op === 'refine' && i != null && lineTier(item.lines[i]) === 'T1')
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
    if (op === 'refine' && i != null && item.lines[i] && lineTier(item.lines[i]) === 'T1') return 'that slot is already T1';
    if (!craft.payable(held, op, item)) return cost(op, item).map(([k, n]) => `needs ${n} ${stoneName(k)}`).join(' · ');
    return '';
  };
  const cost = (op: string, it: any, pick?: string) => Object.entries(craft.costOf(op, it, pick) || {}) as [string, number][];
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

  /** The purse as a currency tab: one cell per stone held, the catalogue in its own order, the
      imprint stones after — each cell carries the stone's own icon and the count it holds. */
  const STONE_ICON: Record<string, string> = {
    reroll_value: stoneRerollValue, tier: stoneRerollTier, add: stoneAdd, remove: stoneRemove,
    replace: runeStone, quality: stoneQuality, polish: crystalOne, reforge: crystalTwo,
    rebirth: crystalGrowth, corrupt: stoneCorrupt, repair: stoneRepair, imprint: runeStone,
  };
  const CATALOGUE = ['reroll_value', 'tier', 'add', 'remove', 'replace', 'quality', 'polish', 'reforge', 'rebirth', 'corrupt', 'repair'];
  const stoneCells = $derived.by(() => {
    const out: { key: string; name: string; n: number; icon: string }[] = [];
    for (const k of CATALOGUE) {
      const n = held[k] || 0;
      if (n > 0) out.push({ key: k, name: stoneName(k), n, icon: STONE_ICON[k] });
    }
    for (const [k, n] of Object.entries(held)) {
      if (!k.startsWith('imprint_') || !(n as number)) continue;
      out.push({ key: k, name: stoneName(k), n: n as number, icon: STONE_ICON.imprint });
    }
    return out;
  });

  /** The bag on the right: the hunt pile as slots — a press on a piece puts it on the bench. */
  const bagEntries = $derived(game.bag.map((it, i) => gearEntry(it, i)));

  /** The integrated bench keeps all verbs in one compact action picker instead of extending a scroll. */
  const WHOLE_ACTIONS: CraftOp[] = ['add', 'add_specific', 'remove', 'reroll_random', 'reroll_mod_all', 'replace_all', 'replace_random', 'polish', 'reforge', 'rebirth', 'ascend'];
  let compactTarget = $state('piece');
  let compactAction = $state('');
  let compactPick = $state('');
  const compactTargets = $derived.by(() => [
    { id: 'piece', label: `Whole piece · ${item ? itemName(item) : 'choose one'}` },
    ...(item?.lines || []).map((line, i) => ({ id: `line:${i}`, label: `Line ${i + 1} · ${lineName(line.id)}` })),
  ]);
  const compactOptions = $derived.by(() => {
    if (!item) return [];
    if (compactTarget === 'piece') return WHOLE_ACTIONS.map((op) => ({ id: `piece:${op}`, op, line: undefined, label: pressName(op) }));
    const i = Number(compactTarget.slice(5));
    if (!Number.isInteger(i) || !item.lines[i]) return [];
    const valueLocked = i < UNT;
    const ops: CraftOp[] = [...(!valueLocked ? ['reroll', 'refine', 'randomize'] as CraftOp[] : []), 'reroll_mod', 'replace', ...(!valueLocked ? ['imprint', 'remove_at'] as CraftOp[] : [])];
    return ops.map((op) => ({ id: `${compactTarget}:${op}`, op, line: i, label: pressName(op) }));
  });
  const compactSelected = $derived(compactOptions.find((choice) => choice.id === compactAction) ?? null);
  const compactNeedsPick = $derived(!!compactSelected && ['add_specific', 'replace', 'replace_random', 'imprint'].includes(compactSelected.op));
  const compactPickRows = $derived(compactSelected?.op === 'imprint' ? imprints : choices.map((mod) => ({ key: mod, mod, count: 0 })));
  const compactCanRun = $derived.by(() => {
    if (!item || !compactSelected) return false;
    const { op, line: at } = compactSelected;
    if (compactNeedsPick && !compactPick) return false;
    if (!craft.guard(item, op).ok || !craft.payable(held, op, item, compactPick || undefined)) return false;
    if (at != null && at < floorOf(op)) return false;
    if (op === 'refine' && at != null && lineTier(item.lines[at]) === 'T1') return false;
    if (op === 'imprint' && at != null && !canImprint(at, compactPick)) return false;
    return presses(op) > 0;
  });
  const compactCost = $derived.by(() => !compactSelected || !item ? ''
    : cost(compactSelected.op, item, compactPick || undefined).map(([key, n]) => `${n} ${stoneName(key)}`).join(' + '));
  const compactHint = $derived.by(() => {
    if (!item) return 'Choose a piece first.';
    if (!compactSelected) return 'Choose an action.';
    if (compactNeedsPick && !compactPick) return 'Choose the Mod or imprint stone for this action.';
    if (!compactCanRun) return why(compactSelected.op, compactSelected.line) || 'This action cannot run on this piece.';
    return compactCost || 'Ready';
  });
  let handledStoneRequest = $state(0);
  $effect(() => {
    const request = stoneRequest;
    if (!embedded || !item || !request || request.id === handledStoneRequest) return;
    if (request.applied) {
      compactTarget = 'piece';
      compactAction = '';
      compactPick = '';
      handledStoneRequest = request.id;
      onstoneclear();
      return;
    }
    const line = item.lines.findIndex((_, i) => i >= UNT);
    if (request.key === 'tier' && line >= 0) {
      compactTarget = `line:${line}`;
      const tierPress = lineTier(item.lines[line]) === 'T1' ? 'randomize' : 'refine';
      compactAction = `line:${line}:${tierPress}`;
      compactPick = '';
    } else if (request.key === 'replace') {
      compactTarget = 'piece';
      compactAction = 'piece:replace_random';
      compactPick = '';
    } else if (request.key.startsWith('imprint_') && line >= 0) {
      compactTarget = `line:${line}`;
      compactAction = `line:${line}:imprint`;
      compactPick = request.key.slice('imprint_'.length);
    }
    handledStoneRequest = request.id;
  });

  function commitCompact() {
    if (!compactSelected || !compactCanRun) return;
    onrun(compactSelected.op, compactSelected.line ?? 0, compactPick || undefined);
    if (stoneRequest && !stoneRequest.applied) {
      onstoneclear();
      compactAction = '';
      compactPick = '';
    }
  }

  function cancelStoneRequest() {
    onstoneclear();
    compactAction = '';
    compactPick = '';
  }

  /** the range a Reroll can move inside, so the row can show the room a press has */
  const room = (i: number) => {
    if (!item) return null;
    const l = item.lines[i];
    if (!l) return null;
    const [lo, hi] = loot.rangeOf(l.id, item.ilvl, item.q ?? 0, l.slice == null ? 2 : l.slice);
    const floor = Math.max(lo, item.baselines?.[i] ?? lo, l.value);
    return { lo, hi, floor, now: l.value };
  };
</script>

<div class="shop" class:compact-shop={embedded}>
  {#if embedded}
    {#if item}
      <div class="compact-craft">
        <div class="compact-summary">
          {#if compactSelected?.line != null}
            {@const line = item.lines[compactSelected.line]}
            <span><img class="mod-icon" src={modIcon(line.id, line.stat, line.element)} alt="" aria-hidden="true" />Line {compactSelected.line + 1} · {lineName(line.id)} · {line.value} · {lineTier(line)}</span>
          {:else}
            <span>{item.quality} quality · {item.lines.length} Mod lines · +{item.upgrade_lv || 0}</span>
          {/if}
          <span>{compactCost || 'Select an action to see its stone cost.'}</span>
          {#if stoneRequest && !stoneRequest.applied}
            <span class="stone-request">{stoneName(stoneRequest.key)} ready</span>
            <button class="stone-cancel" onclick={cancelStoneRequest} aria-label="Cancel stone use">Cancel</button>
          {/if}
        </div>
        <div class="compact-selects">
          <label>Target
            <select value={compactTarget} onchange={(e) => { compactTarget = (e.target as HTMLSelectElement).value; compactAction = ''; compactPick = ''; }}>
              {#each compactTargets as target (target.id)}<option value={target.id}>{target.label}</option>{/each}
            </select>
          </label>
          <label>Action
            <select value={compactAction} disabled={Boolean(stoneRequest && !stoneRequest.applied)} title={stoneRequest && !stoneRequest.applied ? `${stoneName(stoneRequest.key)} selected from the stone stack` : undefined}
                    onchange={(e) => { compactAction = (e.target as HTMLSelectElement).value; compactPick = ''; }}>
              <option value="">Choose action</option>
              {#each compactOptions as option (option.id)}<option value={option.id}>{option.label}</option>{/each}
            </select>
          </label>
          {#if compactNeedsPick}
            <label>Mod
              <select bind:value={compactPick}>
                <option value="">Choose a Mod</option>
                {#each compactPickRows as row (row.key)}
                  <option value={row.mod}>{compactSelected?.op === 'imprint' ? `${lineName(row.mod)} · ${held['imprint_' + row.mod]}` : lineName(row.mod)}</option>
                {/each}
              </select>
            </label>
          {/if}
          <button class="compact-press" disabled={!compactCanRun}
                  title={compactHint}
                  onclick={commitCompact}>
            {compactSelected ? pressName(compactSelected.op) : 'Choose an action'}
          </button>
        </div>
        <small class="compact-hint">{compactHint}</small>
      </div>
    {:else}
      <p class="dim compact-empty">Select a piece to see its Mod actions.</p>
    {/if}
  {:else}
  <PieceOn {game} {item} {where} {index} {onpick} {wornOf} wornOnly />

  {#if item}
    <div class={embedded ? 'bench-work' : 'bench'}>
      <!-- left: the stones, read the way a stash's currency tab reads — one cell per stone, its icon
           and the count it holds, the name on the hover -->
      {#if !embedded}<section class="stash">
        <h4>Stones held</h4>
        <div class="tab">
          {#each stoneCells as s (s.key)}
            <span class="stone" title={s.name}>
              <img src={s.icon} alt="" aria-hidden="true" />
              <b>{s.n}</b>
            </span>
          {:else}
            <p class="dim">No stones yet — the hunt pays them.</p>
          {/each}
        </div>
        <p class="dim tip"><small>A stone is spent even when a press changes nothing.</small></p>
      </section>{/if}

      <!-- centre: the piece on the bench and every press it takes -->
      <section class="work">
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
                    <span class="mod-label"><img src={modIcon(l.id, l.stat, l.element)} alt="" aria-hidden="true" />{lineName(l.id)}{craftedMark(l)}</span>
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
          <details class="more">
            <summary>How the stones read</summary>
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
          </details>
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
            <button disabled={!can('reforge')} onclick={() => onrun('reforge')} title={why('reforge')}>
              <b>{pressName('reforge')}</b><span>{line('reforge')} · one Tier drawn for the piece, then every value rolled inside it</span>
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
          <details class="more">
            <summary>Value presses keep the Mod</summary>
            <p><small>Value presses keep the Mod and the
            Tier they were given; Roll new Mod, Replace and an imprint stone change what a line <em>is</em>,
            and an Element moves only when an elemental Mod arrives or Corrupt redraws the piece on the
            Forge.</small></p>
          </details>
          {#if note}<p class="result">{note}</p>{/if}
        </section>
      </section>

      <!-- right: the bag as slots — a press on a piece puts it on the bench -->
      {#if !embedded}<section class="bagcol">
        <h4>Bag</h4>
        <SlotGrid entries={bagEntries} capacity={E.inventory.adventure_slots} mode="grid" pageSize={30}
                  {wornOf} onpick={(i) => onpick('bag', i)} />
      </section>{/if}
    </div>
  {:else}
    <p class="dim">Pick a piece above to see what each stone would do to it.</p>
  {/if}
  {/if}
</div>

<style>
  .shop { display: grid; gap: var(--spacing-md); }
  .compact-shop { display: block; }
  .compact-craft { display: grid; gap: var(--spacing-xs); }
  .compact-summary { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--spacing-xs) var(--spacing-sm); color: var(--dim); font-size: var(--font-xs); }
  .stone-request { color: var(--gold-lit); }
  .stone-cancel { padding: var(--spacing-xs) var(--spacing-xs); font-size: var(--font-xs); }
  .compact-selects { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr) auto; align-items: end; gap: var(--spacing-xs); }
  .compact-selects label { display: grid; gap: var(--spacing-xs); min-width: 0; color: var(--dim); font-size: var(--font-xs); }
  .compact-selects select { width: 100%; min-width: 0; padding: var(--spacing-xs) var(--spacing-xs); font-size: var(--font-xs); }
  .compact-press { align-self: end; padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-xs); }
  .compact-hint { color: var(--dim); font-size: var(--font-xs); }
  .compact-empty { margin: 0; color: var(--dim); font-size: var(--font-xs); }
  .bench-work { min-width: 0; }
  .bench-work .work { min-width: 0; }
  .bench-work .lines { overflow: hidden; }
  /* the stash shape: the stones on the left, the bench in the middle, the bag on the right — the
     centre column is the work and stays the widest */
  .bench { display: grid; grid-template-columns: minmax(clamp(138px, 10.70vw, 297px), clamp(169px, 13.12vw, 364px)) minmax(0, 1fr) minmax(clamp(156px, 12.10vw, 338px), clamp(188px, 14.52vw, 405px)); gap: var(--spacing-md); align-items: start; }
  .stash, .bagcol { position: sticky; top: 0; }
  h4 { margin: 0 0 var(--spacing-xs); }
  /* the currency tab: one cell per stone, icon and count, the name on the hover — the purse is read
     at a glance the way a stash tab is, not scanned as a list */
  .tab { display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(38px, 2.90vw, 81px), 1fr)); gap: var(--spacing-xs); }
  .stone {
    position: relative; aspect-ratio: 1; display: grid; place-items: center;
    background: var(--inset); border: 1px solid var(--line); border-radius: var(--radius-sm);
  }
  .stone img { width: var(--icon-md); height: var(--icon-md); object-fit: contain; }
  .stone b {
    position: absolute; right: clamp(2px, 0.19vw, 5px); bottom: clamp(2px, 0.10vw, 3px);
    font-family: var(--num); font-size: var(--font-xs); color: var(--text); text-shadow: 0 1px 0 rgba(0, 0, 0, .9);
  }
  .tip { margin: var(--spacing-xs) 0 0; }
  .mod-label { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .mod-label img, .mod-icon { width: var(--icon-xs); height: var(--icon-xs); flex: none; object-fit: contain; opacity: .9; vertical-align: middle; }
  .val { color: var(--text); }
  .val small { color: var(--mob); font-size: var(--font-xs); margin-left: var(--spacing-xs); }
  .no { color: var(--mob); width: var(--icon-lg); }
  .tag { margin-left: var(--spacing-xs); font-size: var(--font-xs); color: var(--dim); border: 1px solid var(--line); border-radius: var(--radius-round); padding: 0 var(--spacing-xs); }
  .tag.el { color: var(--es-lit); border-color: color-mix(in srgb, var(--es) 40%, transparent); }
  tr.fixed td { opacity: .72; }

  /* the tier a line sits in is a band of three, because Tier is a set of steps and not a number */
  .band { display: inline-flex; gap: var(--spacing-xs); margin-right: var(--spacing-xs); vertical-align: middle; }
  .band i { width: var(--icon-xs); height: 4px; border-radius: var(--radius-round); background: var(--bar); border: 1px solid var(--line); }
  .band i.on { background: var(--gold); border-color: var(--gold); }
  .t { font-size: var(--font-xs); color: var(--dim); }

  .verbs { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); align-items: center; }
  .verbs button { padding: var(--spacing-xs) var(--spacing-xs); font-size: var(--font-xs); }
  .verbs button:disabled { opacity: .42; cursor: not-allowed; }
  .verbs button.armed { border-color: var(--gold); color: var(--gold); }
  /* the Replace stone's own choice: the line it names, from the pool this Base already draws */
  .pick { display: inline-flex; gap: var(--spacing-xs); align-items: center; width: 100%; margin-top: var(--spacing-xs); }
  .pick select { font-size: var(--font-xs); padding: var(--spacing-xs) var(--spacing-xs); background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: var(--radius-sm); }
  .pick button { padding: var(--spacing-xs) var(--spacing-xs); font-size: var(--font-xs); border-color: var(--gold); }
  .prices { font-size: var(--font-xs); color: var(--mob); }
  .foot { margin: var(--spacing-xs) 0 0; color: var(--dim); }
  /* the explainers fold: the table and the presses lead, the prose waits one press away */
  .more { margin: var(--spacing-xs) 0 0; }
  .more summary { cursor: pointer; color: var(--dim); font-size: var(--font-xs); }
  .more p { margin: var(--spacing-xs) 0 0; }
  .work { display: grid; gap: var(--spacing-md); }

  .wbtns { display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(162px, 12.58vw, 351px), 1fr)); gap: var(--spacing-xs); }
  .bench-work .wbtns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bench-work .wbtns .pick { display: flex; flex-wrap: wrap; align-content: start; }
  .bench-work .wbtns .pick select, .bench-work .wbtns .pick button { flex: 1 1 clamp(69px, 5.32vw, 149px); min-width: 0; }
  .wbtns > button { display: grid; gap: var(--spacing-xs); justify-items: start; text-align: left; padding: var(--spacing-xs) var(--spacing-sm); }
  .wbtns b { font-size: var(--font-xs); }
  .wbtns span { font-size: var(--font-xs); color: var(--dim); }
  .wbtns button:disabled { opacity: .45; cursor: not-allowed; }
  .now { margin: var(--spacing-xs) 0 0; font-family: var(--num); font-size: var(--font-xs); color: var(--dim); }
  .result { margin: var(--spacing-xs) 0 0; padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-sm); font-size: var(--font-xs); background: var(--panel); border: 1px solid var(--edge); }

  @media (max-width: 1280px) {
    .bench { grid-template-columns: 1fr; }
    .stash, .bagcol { position: static; }
    .prices, .foot { display: none; }
  }
</style>
