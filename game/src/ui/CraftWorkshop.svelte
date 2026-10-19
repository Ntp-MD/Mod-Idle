<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { E, loot } from '../engine/client';
  import { gearIcon, modIcon } from '../icon';
  import { itemName } from '../sim/item-name';
  import { craft, craftedMark, lineName, lineTier, stoneName, replaceChoices, pressName, type CraftOp, type Where } from '../sim/craft';
  import { slotsFree } from '../sim/slots';
  import { gearEntry, pieceRank, type SlotEntry } from './bag';
  import { shelfStones, stoneIcon, stoneQuality, STONE_MIME } from './stones';
  import { modesForStone, stoneUseReason } from './craft-use';
  import SlotGrid from './SlotGrid.svelte';
  import type { GameState, Item } from '../sim/types';

  let { game, item, where = null, index = -1, onpick, onclear, onrun, wornOf, note = '',
    stashTabs = 0, stashTab = 0, writer = true, onStashTab = () => {}, onTakeStash = () => false, onStore = () => false,
  }: {
    game: GameState; item: Item | null; where?: Where | null; index?: number;
    onpick: (where: Where, index: number) => void; onclear: () => void;
    onrun: (op: CraftOp, line?: number, pick?: string) => boolean;
    wornOf: (slot: string) => Item | null; note?: string; stashTabs?: number; stashTab?: number; writer?: boolean;
    onStashTab?: (tab: number) => void; onTakeStash?: (tab: number, index: number) => boolean; onStore?: (index: number, tab: number) => boolean;
  } = $props();

  const MIME = 'application/x-modworld-gear';
  const FRAME = craft.PIECE_FLOOR as number;
  const UNT = craft.UNTOUCHABLE as number;
  const held = $derived(game.counters.stones || {});
  const stones = $derived(shelfStones(held, true));
  let stoneQuery = $state('');
  let stonePage = $state(0);
  let stoneCapacity = $state(1);
  let sourceCapacity = $state(1);
  const filteredStones = $derived(stones.filter(s => `${s.name} ${s.detail}`.toLowerCase().includes(stoneQuery.toLowerCase().trim())));
  const stonePages = $derived(Math.max(1, Math.ceil(filteredStones.length / stoneCapacity)));
  const stoneAt = $derived(Math.min(stonePage, stonePages - 1));
  const shownStones = $derived(filteredStones.slice(stoneAt * stoneCapacity, (stoneAt + 1) * stoneCapacity));
  let selectedKey = $state('');
  let armed = $state(false);
  let modeOp = $state<CraftOp>('reroll_random');
  let chosenMod = $state('');
  let busy = $state(false);
  let message = $state('');
  let pointer = $state<{ x: number; y: number } | null>(null);
  let before = $state<Item | null>(null);
  let resultOp = $state('');
  let resultKind = $state<CraftOp | null>(null);
  let targetLine = $state<number | null>(null);
  const selectedStone = $derived(stones.find(s => s.key === selectedKey));
  const modes = $derived(modesForStone(selectedKey));
  const mode = $derived(modes.find(m => m.op === modeOp) || modes[0]);
  const pickValue = $derived(selectedKey.startsWith('imprint_') ? selectedKey.slice('imprint_'.length) : chosenMod);
  const choices = $derived(item && where != null && index >= 0 ? replaceChoices(game, where, index) : []);
  const costs = $derived(item && mode ? Object.entries(craft.costOf(mode.op, item, pickValue || undefined)).map(([key, amount]) => ({ key, amount: Number(amount), owned: Number(held[key] || 0) })) : []);
  const rank = $derived(pieceRank(item));
  const upgradeStep = $derived(item ? Math.min((item.upgrade_lv || 0) + 1, craft.C.upgrade_cap) : 0);
  const upgradeChance = $derived(craft.successPct(upgradeStep));
  $effect(() => {
    const at = filteredStones.findIndex(s => s.key === selectedKey);
    if (at >= 0) stonePage = Math.floor(at / stoneCapacity);
  });

  let sourceTab = $state<'inventory' | 'equipped' | 'stash'>('inventory');
  let stashPicked = $state(-1);
  let stashQuery = $state('');
  let bagQuery = $state('');
  let dropReady = $state(false);
  const wornEntries = $derived(game.gear.map((piece, position) => piece ? ({ ...gearEntry(piece, position), kind: 'worn' } as SlotEntry) : null).filter((e): e is SlotEntry => e !== null));
  const bagEntries = $derived(game.bag.map((piece, position) => gearEntry(piece, position)));
  const shownBag = $derived(bagEntries.filter(e => `${e.title} ${e.slot} ${e.sub}`.toLowerCase().includes(bagQuery.trim().toLowerCase())));
  const stashItems = $derived(game.stash[stashTab] || []);
  const stashEntries = $derived(stashItems.map((piece, position) => gearEntry(piece, position)));
  const shownStash = $derived(stashEntries.filter(e => `${e.title} ${e.slot} ${e.sub}`.toLowerCase().includes(stashQuery.trim().toLowerCase())));
  const stashTotal = $derived(game.stash.reduce((total, tab) => total + tab.length, 0));
  const bagFull = $derived(slotsFree(game) < 1);

  function fitSource(node: HTMLElement) {
    const observer = new ResizeObserver(() => {
      const css = getComputedStyle(node);
      const slot = parseFloat(css.getPropertyValue('--slot-item'));
      const gap = parseFloat(css.getPropertyValue('--spacing-xs'));
      const pager = parseFloat(css.fontSize) * 2 + parseFloat(css.getPropertyValue('--spacing-sm')) * 2;
      sourceCapacity = Math.max(1, Math.floor((node.clientWidth + gap) / (slot + gap)) * Math.floor((node.clientHeight - pager + gap) / (slot + gap)));
    });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }
  function fitCurrency(node: HTMLElement) {
    const observer = new ResizeObserver(() => {
      const css = getComputedStyle(node);
      const columns = css.gridTemplateColumns.split(' ').length;
      const row = parseFloat(css.gridAutoRows);
      const gap = parseFloat(css.rowGap);
      stoneCapacity = Math.max(1, columns * Math.floor((node.clientHeight + gap) / (row + gap)));
    });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }
  function cancelStone() { armed = false; pointer = null; }
  onMount(() => {
    const cancelKey = (event: KeyboardEvent) => {
      if (armed && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancelStone(); }
    };
    const cancelRight = (event: MouseEvent) => {
      if (!armed || (event.target as Element)?.closest('[data-stone]')) return;
      event.preventDefault(); event.stopImmediatePropagation(); cancelStone();
    };
    window.addEventListener('keydown', cancelKey, true);
    window.addEventListener('contextmenu', cancelRight, true);
    return () => { window.removeEventListener('keydown', cancelKey, true); window.removeEventListener('contextmenu', cancelRight, true); };
  });
  function armStone(key: string, event?: MouseEvent) {
    if (busy) return;
    message = '';
    targetLine = null;
    if (selectedKey !== key) { modeOp = modesForStone(key)[0]?.op || 'reroll_random'; chosenMod = ''; }
    selectedKey = key;
    if (!writer) { message = 'Read-only. Take account control before using a stone.'; cancelStone(); return; }
    if (!(held[key] > 0)) { message = `No ${stoneName(key)} left.`; cancelStone(); return; }
    armed = true;
    if (event && (event.clientX || event.clientY)) pointer = { x: event.clientX, y: event.clientY };
  }
  function reason(line: number | null) {
    return mode ? stoneUseReason(game, item, where, index, mode, line, pickValue, writer) : 'Choose a stone first.';
  }
  function modLabel(line: { id: string; stat?: string | null; element?: string | null }) {
    return [lineName(line.id), line.stat?.toUpperCase(), line.element].filter(Boolean).join(' · ');
  }
  function targetHint() {
    if (mode?.target !== 'line' || targetLine == null || !item?.lines[targetLine]) return mode?.target === 'line' ? 'Click a highlighted Mod line.' : 'Click the item to use once.';
    const refusal = reason(targetLine);
    if (refusal) return refusal;
    const line = item.lines[targetLine];
    if (mode.op === 'reroll') {
      const [lo, hi] = loot.rangeOf(line.id, item.ilvl, item.q ?? 0, line.slice ?? 2);
      return `${modLabel(line)} · ${Math.max(lo, item.baselines?.[targetLine] ?? lo, line.value)}–${hi} possible · ${lineTier(line)} kept`;
    }
    return `${pressName(mode.op)} · ${modLabel(line)}`;
  }
  function lineChanged(i: number) {
    if (!before || !item) return false;
    return JSON.stringify(before.lines[i]) !== JSON.stringify(item.lines[i]);
  }
  async function applyStone(line: number | null, repeat: boolean) {
    if (!armed || !mode || busy) return;
    const refusal = reason(line);
    if (refusal) { message = refusal; return; }
    busy = true;
    const snapshot = structuredClone($state.snapshot(item!));
    const success = onrun(mode.op, line ?? 0, pickValue || undefined);
    if (success) { before = snapshot; resultOp = pressName(mode.op); resultKind = mode.op; message = ''; }
    await tick();
    busy = false;
    if (!success) message = note || 'This stone could not be applied.';
    if (success && (!repeat || !(held[selectedKey] > 0))) cancelStone();
    if (success && repeat && armed && !craft.guard(item, mode.op).ok) { message = craft.guard(item, mode.op).why; cancelStone(); }
  }
  function sourceReadiness(entry: SlotEntry, source: Where): 'ready' | 'unavailable' | null {
    if (!armed || !mode || !entry.item) return null;
    const usable = mode.target === 'piece'
      ? !stoneUseReason(game, entry.item, source, entry.index, mode, null, pickValue, writer)
      : entry.item.lines.some((_, line) => !stoneUseReason(game, entry.item!, source, entry.index, mode, line, pickValue, writer));
    return usable ? 'ready' : 'unavailable';
  }
  function selectPiece(source: Where, position: number) { before = null; resultOp = ''; message = ''; onpick(source, position); }
  async function pickSource(source: Where, position: number, repeat = false) {
    if (busy) return;
    selectPiece(source, position);
    await tick();
    // A line-targeting stone opens the piece for an explicit line click; it never guesses a line.
    if (armed && mode?.target === 'piece') await applyStone(null, repeat);
  }
  function clearBench() { if (busy) return; cancelStone(); before = null; resultOp = ''; message = ''; onclear(); }
  function takeStashItem() {
    if (stashPicked < 0 || bagFull || !writer || busy) return;
    if (!onTakeStash(stashTab, stashPicked)) return;
    sourceTab = 'inventory'; stashPicked = -1; selectPiece('bag', 0);
  }
  function storeBenchItem() {
    if (where !== 'bag' || index < 0 || !writer || !stashTabs || busy) return;
    if (!onStore(index, stashTab)) return;
    sourceTab = 'stash'; stashPicked = -1; clearBench();
  }
  function startDrag(source: Where, position: number, event: DragEvent) {
    event.dataTransfer?.setData(MIME, JSON.stringify({ where: source, index: position }));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }
  function startStashDrag(position: number, event: DragEvent) {
    event.dataTransfer?.setData(MIME, JSON.stringify({ where: 'stash', index: position, tab: stashTab }));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }
  function dragStone(key: string, event: DragEvent) {
    armStone(key); event.dataTransfer?.setData(STONE_MIME, key);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }
  function dragOver(event: DragEvent) {
    if (!Array.from(event.dataTransfer?.types || []).some(t => t === MIME || t === STONE_MIME)) return;
    event.preventDefault(); dropReady = true;
  }
  function leaveDrop(event: DragEvent) {
    if (!(event.relatedTarget instanceof Node && (event.currentTarget as Element).contains(event.relatedTarget))) dropReady = false;
  }
  async function drop(event: DragEvent) {
    event.preventDefault(); dropReady = false;
    const key = event.dataTransfer?.getData(STONE_MIME);
    if (key) { armStone(key); if (mode?.target === 'piece') await applyStone(null, event.shiftKey); return; }
    try {
      const picked = JSON.parse(event.dataTransfer?.getData(MIME) || '{}');
      if (!Number.isInteger(picked.index)) return;
      if (picked.where === 'stash' && Number.isInteger(picked.tab)) {
        if (onTakeStash(picked.tab, picked.index)) { sourceTab = 'inventory'; selectPiece('bag', 0); }
      } else if ((picked.where === 'bag' || picked.where === 'gear') && (picked.where === 'bag' ? game.bag : game.gear)[picked.index]) selectPiece(picked.where, picked.index);
    } catch { /* Ignore unrelated drags. */ }
  }
</script>

<div class="workshop" class:armed role="group" aria-label="Crafting workspace"
     onpointermove={(event) => { if (armed) pointer = { x: event.clientX, y: event.clientY }; }}
     onpointerleave={() => (pointer = null)} ondragend={() => (dropReady = false)}>
  <aside class="pane currency-pane" aria-label="Crafting stones">
    <header class="pane-head"><h3>Stones</h3><span>{stones.filter(s => s.count > 0).length} kinds held</span></header>
    <input type="search" placeholder="Find a stone…" aria-label="Find crafting stones" bind:value={stoneQuery} oninput={() => (stonePage = 0)} />
    <div class="currency-grid" use:fitCurrency>
      {#each shownStones as stone (stone.key)}
        <button type="button" data-stone={stone.key} class="currency-tile" class:selected={selectedKey === stone.key}
                class:unowned={stone.count === 0} aria-pressed={armed && selectedKey === stone.key}
                aria-label={`${stone.name}, ${stone.count} held`} title={`${stone.name} · ${stone.detail} · right-click to use`}
                draggable={stone.count > 0} ondragstart={(event) => dragStone(stone.key, event)}
                oncontextmenu={(event) => { event.preventDefault(); event.stopPropagation(); if (armed && selectedKey === stone.key) cancelStone(); else armStone(stone.key, event); }}
                onclick={(event) => armStone(stone.key, event)}>
          <span class="currency-art"><img src={stone.icon} alt="" /><b class="badge badge-count">{stone.count}</b></span>
          <span>{stone.name.replace(/^Imprint — /, '').replace(/ Stone$/, '')}</span>
        </button>
      {/each}
      {#if !shownStones.length}<p class="text-note">No matching stone.</p>{/if}
    </div>
    {#if stonePages > 1}
      <nav class="currency-pages" aria-label="Stone pages">
        <button class="btn-quiet" disabled={stoneAt === 0} onclick={() => stonePage = stoneAt - 1} aria-label="Previous stones">Previous</button>
        <small>{stoneAt + 1} / {stonePages}</small>
        <button class="btn-quiet" disabled={stoneAt + 1 === stonePages} onclick={() => stonePage = stoneAt + 1} aria-label="Next stones">Next</button>
      </nav>
    {/if}
    {#if selectedStone && mode}
      <section class="stone-inspector surface-hud" aria-label="Selected stone">
        <header><strong>{selectedStone.name}</strong><span class="chip chip-tag" class:toggled={armed}>{armed ? 'Ready to use' : 'Selected'}</span></header>
        {#if modes.length > 1}
          <label>Use <select aria-label="Stone operation" value={mode.op} onchange={(event) => { modeOp = event.currentTarget.value as CraftOp; chosenMod = ''; message = ''; }}>
            {#each modes as option (option.op)}<option value={option.op}>{pressName(option.op)}</option>{/each}
          </select></label>
        {:else}<p class="text-note">{pressName(mode.op)}</p>{/if}
        {#if mode.pick}
          <label>New Mod <select aria-label="Choose replacement Mod" bind:value={chosenMod} disabled={!item}>
            <option value="">Choose a Mod…</option>
            {#each choices as id (id)}<option value={id}>{lineName(id)}</option>{/each}
          </select></label>
        {/if}
        <div class="stone-costs" aria-label="Cost per use">
          {#each costs as cost (cost.key)}<span class="cost" class:text-alarm={cost.owned < cost.amount}><img src={stoneIcon(cost.key)} alt="" />{cost.amount} <small>/ {cost.owned} held</small></span>{/each}
        </div>
        <p class="text-note">{selectedStone.detail}</p>
        <p class="text-note">{targetHint()}</p>
        {#if selectedKey === 'quality' && item}
          <div class="enhancement-info surface-hud"><strong>+{item.upgrade_lv || 0} → +{upgradeStep}</strong><span>{Math.round(upgradeChance)}% success</span><span>Protection {item.protection_left ?? craft.C.protection_start}/{craft.C.protection_start}</span>
            <small>{upgradeStep < craft.C.upgrade_breaks_from ? `A miss drops to +${Math.max(0, upgradeStep - 1)}.` : (item.protection_left ?? craft.C.protection_start) > 0 ? 'A miss spends a protection charge and drops one step.' : 'A miss leaves this item Broken.'}</small></div>
        {/if}
        {#if selectedKey === 'corrupt' && item}<p class="warning text-alarm">One irreversible use. May change an Element, lower quality or break this item.</p>{/if}
        <button class="btn-quiet" type="button" onclick={() => armed ? cancelStone() : armStone(selectedKey)}>{armed ? 'Cancel · Esc' : 'Use this stone'}</button>
      </section>
    {:else}<p class="stone-guide text-note">Right-click a stone, then click your item. Hold Shift to keep using it.</p>{/if}
  </aside>

  <section class="pane bench-pane surface-hud" aria-label="Crafting bench item" style:--rar={rank?.tone ?? null}
           ondragover={dragOver} ondragleave={leaveDrop} ondrop={drop}>
    <header class="pane-head"><h3>Workbench</h3><span>{item ? where === 'gear' ? 'Equipped' : 'Bag' : 'Choose an item'}</span></header>
    <div class="bench-body">
      {#if item}
      <button type="button" class="item-target craft-target" class:ready={armed && mode?.target === 'piece' && !reason(null)}
              class:selected={dropReady} disabled={!item || !armed || busy || mode?.target !== 'piece'}
              aria-label={item ? `Apply selected stone to ${itemName(item)}` : 'Empty crafting bench'}
              title={armed ? reason(null) || 'Click to use · Shift-click to repeat' : 'Right-click a stone to begin'}
              onclick={(event) => applyStone(null, event.shiftKey)}>
        <span class="item-art"><img src={item ? gearIcon(item) : stoneQuality} alt="" /></span>
        <span class="item-heading"><strong>{item ? itemName(item) : 'Place an item here'}</strong>
          <span>{item ? `${item.quality} · ${item.tier} · level ${item.ilvl} · +${item.upgrade_lv || 0}` : 'Choose from Equipment, Bag or Stash →'}</span>
          {#if item?.broken}<b class="text-alarm">Broken · use a Repair Stone</b>{:else if item?.corrupted}<b class="text-alarm">Corrupted</b>{/if}
        </span>
      </button>
      {/if}
      {#if item}
        <div class="mod-heading"><span>Mod</span><span>Value · Tier</span></div>
        <ul class="item-lines" aria-label="Item Mod lines">
          {#each item.lines as line, i (i)}
            {@const kind = i < FRAME ? 'Frame' : i < UNT ? 'Bound' : 'Unbound'}
            {@const valid = armed && mode?.target === 'line' && !reason(i)}
            <li>
              <button type="button" class="line-row craft-target" onpointerenter={() => (targetLine = i)} onfocus={() => (targetLine = i)} class:ready={valid} class:changed={lineChanged(i)}
                      aria-label={`Line ${i + 1}: ${lineName(line.id)}, ${line.value}, ${lineTier(line)}`}
                      aria-disabled={armed && mode?.target === 'line' && !!reason(i)} disabled={busy}
                      title={armed && mode?.target === 'line' ? reason(i) || 'Click to use · Shift-click to repeat' : `${kind} Mod · ${lineName(line.id)}`}
                      onclick={(event) => { if (armed && mode?.target === 'line') applyStone(i, event.shiftKey); }}>
                <small class="line-kind">{kind}</small>
                <span class="line-name"><img src={modIcon(line.id, line.stat, line.element)} alt="" /><span>{modLabel(line)}{craftedMark(line)}{#each line.extra || [] as extra}<small class="line-extra">+ {modLabel(extra)} {extra.value}</small>{/each}</span></span>
                <span class="line-value">{#if lineChanged(i) && before?.lines[i]?.id === line.id}<small class="previous-value">{before.lines[i].value} → </small>{/if}<b>{line.value}</b> <small>{lineTier(line)}</small></span>
              </button>
            </li>
          {/each}
        </ul>
        <div class="bench-tools">
          <span class="text-note">{item.lines.length} Mod lines · {item.mods_added || 0}/{E.item_level.mods_added_cap} added</span>
          <div>{#if where === 'bag'}<button class="btn-quiet" disabled={!writer || !stashTabs || busy} onclick={storeBenchItem}>Store · Tab {stashTab + 1}</button>{/if}<button class="btn-quiet" onclick={clearBench} disabled={busy} aria-label="Remove item from crafting bench">Clear</button></div>
        </div>
      {:else}
        <div class="bench-empty"><img src={stoneQuality} alt="" /><strong>Choose an item to craft</strong><p class="text-note">Choose Bag, Equipped or Stash on the right, or drag an item here.</p></div>
      {/if}
    </div>
    <footer class="bench-footer">
      {#if message}<p class="text-alarm" role="status">{message}</p>
      {:else if resultOp && note}<div class="craft-result" role="status"><strong>{resultOp}</strong><p title={note}>{['rebirth', 'reroll_mod_all', 'replace_all'].includes(resultKind || '') ? note.replace(/^[a-z_]+:\s*/, '').split(' · ')[0] : note.replace(/^[a-z_]+:\s*/, '')}</p></div>
      {:else if armed}<p class="text-value" role="status">{reason(null) || 'Ready · click the item to apply.'}</p>
      {:else}<p class="text-note">Right-click to select · click to apply · Shift-click to repeat · Esc to cancel</p>{/if}
    </footer>
  </section>
  <aside class="pane sources-pane " aria-label="Gear sources">
    <header class="pane-head">
      <h3>Equipment</h3>
      <span>{sourceTab === 'inventory' ? `Bag · ${game.bag.length} piece${game.bag.length === 1 ? '' : 's'}` : sourceTab === 'equipped' ? `${wornEntries.length} worn` : `Stash · ${stashTotal} stored`}</span>
    </header>
    <div class="source-tabs" role="tablist" aria-label="Gear sources for the bench">
      <button role="tab" class="btn btn-quiet" class:toggled={sourceTab === 'equipped'} aria-selected={sourceTab === 'equipped'} onclick={() => (sourceTab = 'equipped')}>
        Equipped · {wornEntries.length}
      </button>
      <button role="tab" class="btn btn-quiet" class:toggled={sourceTab === 'inventory'} aria-selected={sourceTab === 'inventory'} onclick={() => { sourceTab = 'inventory'; stashPicked = -1; }}>
        Bag · {game.bag.length}
      </button>
      <button role="tab" class="btn btn-quiet" class:toggled={sourceTab === 'stash'} aria-selected={sourceTab === 'stash'} onclick={() => { if (sourceTab !== 'stash') stashQuery = ''; sourceTab = 'stash'; stashPicked = -1; }}>
        Stash · {stashTabs} tab{stashTabs === 1 ? '' : 's'}
      </button>
    </div>
    {#if sourceTab === 'equipped'}
      <div class="source-grid" use:fitSource>
        <SlotGrid entries={wornEntries} capacity={E.stat.item_slots} fixed layout="grid" {wornOf}
                  selectedIndex={where === 'gear' ? index : null} targetState={(entry) => sourceReadiness(entry, 'gear')}
                  onpick={(position, event) => pickSource('gear', position, Boolean(event?.shiftKey))}
                  ondragitem={(entry, event) => startDrag('gear', entry.index, event)} />
      </div>
    {:else if sourceTab === 'inventory'}
      <div class="source-body">
        <input type="search" class="source-search" placeholder="Find gear…" aria-label="Find gear to craft" bind:value={bagQuery} />
        {#if !shownBag.length}<p class="text-note">{game.bag.length ? 'No equipment matches this search.' : 'Your bag has no equipment.'}</p>{/if}
        <div class="source-grid" use:fitSource>
        <SlotGrid entries={shownBag} capacity={shownBag.length} mode="grid" pageSize={sourceCapacity} padPage={false} {wornOf}
                  selectedIndex={where === 'bag' ? index : null} targetState={(entry) => sourceReadiness(entry, 'bag')}
                  onpick={(position, event) => pickSource('bag', position, Boolean(event?.shiftKey))}
                  ondragitem={(entry, event) => startDrag('bag', entry.index, event)} />
        </div>
      </div>
    {:else}
      {#if stashTabs > 0}
        <div class="stash-head">
          <div class="stash-tabs" role="tablist" aria-label="Stash tabs for crafting">
            {#each Array(stashTabs) as _, tabIndex (tabIndex)}
              <button role="tab" class="btn btn-quiet" class:toggled={tabIndex === stashTab} aria-selected={tabIndex === stashTab}
                      onclick={() => { onStashTab(tabIndex); stashPicked = -1; stashQuery = ''; }}>
                Tab {tabIndex + 1}<b>{` ${(game.stash[tabIndex] || []).length}`}</b>
              </button>
            {/each}
          </div>
        </div>
        {#if stashItems.length}
          <div class="source-body">
            <input type="search" class="source-search" placeholder="Find stashed gear…" aria-label="Find gear in Stash" bind:value={stashQuery} oninput={() => (stashPicked = -1)} />
            <div class="source-grid" use:fitSource>
            <SlotGrid entries={shownStash} capacity={shownStash.length} mode="grid" pageSize={sourceCapacity} padPage={false} {wornOf}
                      selectedIndex={stashPicked}
                      onpick={(position) => (stashPicked = position)}
                      ondragitem={(entry, event) => startStashDrag(entry.index, event)} />
            </div>
            <div class="source-actions">
              <button class="btn btn-gold" disabled={!writer || stashPicked < 0 || bagFull}
                      title={bagFull ? 'Free a bag slot before taking this piece' : 'Withdraw this piece into the bag and place it on the bench'}
                      onclick={takeStashItem}>Take to bench</button>
            </div>
            <small class="text-note">Crafting uses the bag.</small>
          </div>
        {:else}
          <p class="source-empty text-note">This Stash tab is empty. Store a piece here or choose another tab.</p>
        {/if}
      {:else}
        <p class="source-empty text-note">No Stash tab yet. Buy one at a settlement stall to keep workpieces here.</p>
      {/if}
    {/if}
  </aside>
</div>

{#if armed && selectedStone && pointer}
  <div class="stone-cursor" style:left={`clamp(0px, ${pointer.x}px, calc(100vw - var(--slot-item) - var(--spacing-xl)))`} style:top={`clamp(0px, ${pointer.y}px, calc(100vh - var(--slot-item) - var(--spacing-xl)))`} aria-hidden="true"><img src={selectedStone.icon} alt="" /><span class="badge badge-count">{held[selectedKey] || 0}</span></div>
{/if}

<style>
  .workshop { display: grid; grid-template-columns: minmax(240px, .9fr) minmax(0, 1.75fr) minmax(280px, 1.15fr); gap: var(--spacing-lg); width: 100%; height: 100%; min-height: 0; }
  :global(.box.showcase) .workshop { height: clamp(560px, 37vw, 760px); }
  .pane { display: flex; flex-direction: column; gap: var(--spacing-sm); min-width: 0; min-height: 0; }
  .pane-head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--spacing-sm); }
  .pane-head span { font-size: var(--font-xs); }
  .pane input { width: 100%; min-width: 0; }
  .currency-grid { --currency-row: calc(var(--slot-item) + var(--font-xs) * 2.4 + var(--spacing-xs) * 3); display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--slot-item) * 2), 1fr)); grid-auto-rows: var(--currency-row); align-content: start; gap: var(--spacing-xs); min-height: 0; flex: 1; }
  .currency-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--spacing-xs); min-width: 0; padding: var(--spacing-xs); font-size: var(--font-xs); line-height: 1.2; }
  .currency-art { position: relative; display: block; width: var(--slot-item); height: var(--slot-item); flex: none; }
  .currency-art img { width: 100%; height: 100%; object-fit: contain; }
  .currency-art b { position: absolute; right: calc(var(--spacing-xs) * -1); bottom: 0; }
  .currency-pages { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-xs); }
  .stone-inspector { display: grid; gap: var(--spacing-sm); padding: var(--spacing-sm); }
  .stone-inspector header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs); }
  .stone-inspector strong { font-size: var(--font-sm); }
  .stone-inspector label { display: grid; gap: var(--spacing-xs); font-size: var(--font-xs); }
  .stone-inspector select { width: 100%; min-width: 0; font-size: var(--font-xs); }
  .stone-inspector p, .stone-guide { margin: 0; font-size: var(--font-xs); }
  .stone-costs { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
  .cost { display: inline-flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-sm); }
  .cost img { width: var(--icon-label); height: var(--icon-label); object-fit: contain; }
  .bench-pane { padding: var(--spacing-md); }
  .bench-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--spacing-sm); }
  .item-target { display: flex; align-items: center; gap: var(--spacing-md); width: 100%; padding: var(--spacing-md); text-align: left; }
  .item-art { display: grid; place-items: center; width: calc(var(--icon-card) * 1.4); height: calc(var(--icon-card) * 1.4); flex: none; }
  .item-art img { width: 100%; height: 100%; object-fit: contain; }
  .item-heading { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .item-heading strong { font-size: var(--font-md); overflow-wrap: anywhere; }
  .item-heading > span, .item-heading b { font-size: var(--font-xs); }
  .mod-heading { display: flex; justify-content: space-between; gap: var(--spacing-sm); font-size: var(--font-xs); }
  .item-lines { display: grid; gap: var(--spacing-xs); padding: 0; margin: 0; list-style: none; }
  .line-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--spacing-sm); width: 100%; padding: var(--spacing-xs) var(--spacing-sm); text-align: left; min-width: 0; }
  .line-kind { font-size: var(--font-xs); }
  .line-name { display: flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-xs); min-width: 0; overflow-wrap: anywhere; }
  .line-extra { display: block; font-size: var(--font-xs); }
  .line-name img { width: var(--icon-label); height: var(--icon-label); flex: none; object-fit: contain; }
  .line-value { text-align: right; font-size: var(--font-sm); font-variant-numeric: tabular-nums; }
  .line-value small { font-size: var(--font-xs); }
  .bench-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--spacing-xs); }
  .bench-tools > div { display: flex; gap: var(--spacing-xs); }
  .bench-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--spacing-sm); text-align: center; }
  .bench-empty img { width: var(--icon-card); height: var(--icon-card); object-fit: contain; }
  .bench-empty p { margin: 0; max-width: 34ch; }
  .bench-footer { display: grid; gap: var(--spacing-xs); padding-top: var(--spacing-sm); }
  .bench-footer p { margin: 0; font-size: var(--font-xs); line-height: 1.4; overflow-wrap: anywhere; }
  .craft-result { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--spacing-xs) var(--spacing-sm); }
  .craft-result strong { font-size: var(--font-xs); }
  .enhancement-info { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--spacing-xs) var(--spacing-sm); padding: var(--spacing-sm); font-size: var(--font-xs); }
  .enhancement-info small { flex-basis: 100%; }
  .warning { font-size: var(--font-xs); margin: 0; }
  .source-tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
  .source-body { display: flex; flex: 1; flex-direction: column; gap: var(--spacing-sm); min-height: 0; }
  .source-grid { flex: 1; min-height: 0; min-width: 0; }
  .source-grid :global(.slot-grid-stack) { display: flex; flex-direction: column; height: 100%; gap: var(--spacing-sm); }
  .source-grid :global(.grid) { flex: 1; min-height: 0; align-content: start; }
  .source-grid :global(.bar) { display: none; }
  .source-grid :global(.slot .delta) { display: none; }
  .stash-head { display: grid; gap: var(--spacing-xs); }
  .stash-tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
  .source-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
  .source-empty { font-size: var(--font-xs); }
  .stone-cursor { position: fixed; z-index: var(--z-toast); pointer-events: none; display: flex; align-items: flex-end; gap: var(--spacing-xs); transform: translate(var(--spacing-md), var(--spacing-md)); }
  .stone-cursor img { width: var(--slot-item); height: var(--slot-item); object-fit: contain; }
  .workshop.armed :global(button) { cursor: crosshair; }
</style>
