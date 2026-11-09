<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import Tabs from '../shared/Tabs.svelte';
  import SlotGrid from '../inventory/SlotGrid.svelte';
  import GearCare from '../inventory/GearCare.svelte';
  import StashBoard from '../inventory/StashBoard.svelte';
  import { FILTER_SLOTS, ruleFor, describeRule, presetSlots } from '@sim/gear/filter';
  import { slotsUsed, slotsAvailable } from '@sim/gear/slots';
  import { settlementById } from '@sim/town/town';
  import { icon } from '../../icon';
  import type { GameState } from '@sim/core/types';
  import type { SlotEntry, SortKey } from '../inventory/bag';
  import type { MenuItem } from '../shared/menu';
  import type { Character } from '@sim/core/player';

  type BagCat = 'all' | 'weapon' | 'equipment' | 'consume' | 'misc';
  const BAG_TABS: { id: Exclude<BagCat, 'all'>; label: string; art: string; kinds: string[] }[] = [
    { id: 'weapon', label: 'Weapons', art: 'crossed-swords-1', kinds: [] },
    { id: 'equipment', label: 'Equipment', art: 'adventure-bags', kinds: [] },
    { id: 'consume', label: 'Consumables', art: 'potion', kinds: [] },
    { id: 'misc', label: 'Misc', art: 'treasure-chest', kinds: [] },
  ];

  let {
    gameState, character, settings, townLive, town, tabs,
    compactInventoryTabs = $bindable(), invTab = $bindable(), bagCat = $bindable(),
    bagQuery = $bindable(), bagTier = $bindable(), bagMode = $bindable(), bagSort = $bindable(),
    carriedSort = $bindable(),
    modalGridArea, showcaseMode,
    bagFull, equipNote, heldSummary, townNote, invTabLabelId, bagShown, bagCount, stashTab, stashFolder,
    transactionWriter, fmtNum, keyFor, hubIcon,
    onPickTab, onSetSetting, onBestEquip, onRunFilter, onDepositAll, onEquip, onWornOf, onBagActions,
    onEditRule, onSavePreset, onLoadPreset, onClearPreset, onAutoDissolve, onOpenGearCare,
    onStashTab, onStashAddTab, onStashCarriedSort, onDeposit, onWithdraw, onWithdrawAll, onLock, onclose,
  }: {
    gameState: GameState;
    character: Character;
    settings: import('../../state/save').ClientSettings;
    townLive: boolean;
    town: any;
    tabs: number;
    compactInventoryTabs: boolean;
    invTab: 'inv' | 'stash';
    bagCat: BagCat;
    bagQuery: string;
    bagTier: string;
    bagMode: 'grid' | 'list';
    bagSort: SortKey;
    carriedSort: SortKey;
    modalGridArea: string;
    showcaseMode: boolean;
    bagFull: boolean;
    equipNote: string;
    heldSummary: string;
    townNote: string;
    invTabLabelId: string;
    bagShown: SlotEntry[];
    bagCount: (cat: BagCat) => number;
    stashTab: number;
    stashFolder: any;
    transactionWriter: boolean;
    fmtNum: (n: number) => string;
    keyFor: (token: string) => string;
    hubIcon: (name: string, fallback: string) => string;
    onPickTab: (id: string) => void;
    onSetSetting: (key: keyof import('../../state/save').ClientSettings, value: any) => void;
    onBestEquip: () => void;
    onRunFilter: () => void;
    onDepositAll: (tab: number) => void;
    onEquip: (index: number) => void;
    onWornOf: (slot: string) => import('@sim/core/types').Item | null;
    onBagActions: (entry: SlotEntry) => MenuItem[];
    onEditRule: (slot: string, patch: any) => void;
    onSavePreset: (i: number) => void;
    onLoadPreset: (i: number) => void;
    onClearPreset: (i: number) => void;
    onAutoDissolve: (value: number) => void;
    onOpenGearCare: () => void;
    onStashTab: (t: number) => void;
    onStashAddTab: (id: string, expected: any) => void;
    onStashCarriedSort: (k: SortKey) => void;
    onDeposit: (i: number, tab: number) => void;
    onWithdraw: (tab: number, i: number) => void;
    onWithdrawAll: (tab: number) => void;
    onLock: (item: import('@sim/core/types').Item) => void;
    onclose: () => void;
  } = $props();

  const bagMark = icon('adventure-bags');
  const stashMark = icon('treasure-chest');
  const coinMark = icon('currency-strongbox');
</script>

<Panel title="Inventory" width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={onclose}>
  <div class="inventory-layout">
    <Tabs
      label="Inventory sections"
      orientation={compactInventoryTabs ? 'horizontal' : 'vertical'}
      prefix="inventory-tab"
      controls="inventory-content"
      tabClass="inventory-tab"
      tabs={[{ id: 'bag', label: 'Bag' },
             { id: 'stash', label: 'Stash', disabled: !townLive,
               title: townLive ? `The warehouse the same record opens in every settlement · ${keyFor('screen.stash')}` : 'A settlement service — walk or warp into one first' },
             ...BAG_TABS.map((t) => ({ id: t.id, label: t.label }))]}
      active={invTab === 'stash' ? 'stash' : bagCat}
      onpick={onPickTab}
    >
      {#snippet item(t)}
        {#if t.id === 'bag'}
          <span class="inventory-tab-label">
            <img class="icon-label inventory-tab-art" src={hubIcon('bags', bagMark)} alt="" aria-hidden="true" />
            Bag
          </span>
          <small class="text-note">{gameState.bag.length} piece{gameState.bag.length === 1 ? '' : 's'} · {slotsUsed(gameState)} / {slotsAvailable(gameState)} slots</small>
        {:else if t.id === 'stash'}
          <span class="inventory-tab-label">
            <img class="icon-label inventory-tab-art" src={stashMark} alt="" aria-hidden="true" />
            Stash
          </span>
          <small class="text-note">{tabs} tab{tabs === 1 ? '' : 's'}{townLive ? '' : ' · not here'}</small>
        {:else}
          <span class="inventory-tab-label">
            <img class="icon-label inventory-tab-art" src={icon(BAG_TABS.find((b) => b.id === t.id)!.art)} alt="" aria-hidden="true" />
            {BAG_TABS.find((b) => b.id === t.id)!.label}
          </span>
          <small class="text-note">{bagCount(t.id as BagCat)}</small>
        {/if}
      {/snippet}
    </Tabs>
    <div class="invbody scroll-pane" id="inventory-content" role="tabpanel" aria-labelledby={invTabLabelId} tabindex="0">
    {#if invTab === 'inv'}
    <section class="bagblock">
      {#if bagFull}
        <p class="warn"><b>Bag full — the zone has stopped paying.</b> {gameState.counters.overflow || 0} pieces have been left on the ground. Walk back to {settlementById(gameState.town.waypoint)?.name || 'a settlement'} and stash what you do not wear.</p>
      {/if}
      {#if equipNote}<p class="equipnote">{equipNote}</p>{/if}
      <div class="bagtools">
        <label class="margin">only if better by
          <input type="number" min="0" step="1" value={settings.equipMargin || 0}
                 onchange={(e) => onSetSetting('equipMargin', Math.max(0, Number((e.target as HTMLInputElement).value) || 0))} />
          %
        </label>
        <button class="best" onclick={onBestEquip}
                title={'Wears whatever is strongest in the bag, piece by piece · ' + keyFor('equip.best')}
                aria-keyshortcuts={keyFor('equip.best')}>
          Put on the best I carry
        </button>
        <button onclick={onRunFilter}
                title="Runs the bag filter over what is carried: every unlocked piece that fails the rule dissolves for its salvage bundle — the same one a fresh drop gets. Locked and Collector-held pieces are spared.">
          Run the filter over the bag
        </button>
        <span class="grow"></span>
        <span class="weight" title="Everything carried weighs, worn gear and kept pieces included">Weight <b>{character.weightUsed.toFixed(0)}</b> / {Math.round(character.weightCap)} <small>{character.encumbrance > 0 ? `· aspd ${(character.encumbrance * -100).toFixed(0)}%` : '· no tax'}</small></span>
        <span class="purse inventory-gold" title="Gold in the purse">
          <img src={coinMark} alt="" aria-hidden="true" />
          <b>{fmtNum(gameState.counters.gold)}</b><i>gold</i>
        </span>
        {#if townLive && tabs}
          <button class="mini" disabled={!gameState.bag.length} onclick={() => onDepositAll(stashTab)}>
            Stash every unlocked piece → Tab {stashTab + 1}
          </button>
        {/if}
      </div>
      {#if (gameState.counters.overflow || 0) > 0 || (gameState.counters.stopped || 0) > 0}
        <p class="bagmeta"><small class="text-dim">{gameState.counters.overflow || 0} overflow · {gameState.counters.stopped || 0} refused</small></p>
      {/if}
      {#if heldSummary}
        <p class="bagmeta"><small class="text-dim">Held: {heldSummary}</small></p>
      {/if}
      <div class="bagshell">
        {#snippet bagFilters()}
          <div class="bagview">
            <input class="bagsearch" type="search" placeholder="Search the bag…"
                   bind:value={bagQuery} aria-label="Search the bag" />
            <label class="bagtier">quality
              <select bind:value={bagTier} aria-label="Quality">
                <option value="all">All</option>
                <option value="low">low</option>
                <option value="mid">mid</option>
                <option value="high">high</option>
              </select>
            </label>
            <span class="grow"></span>
            <small class="text-dim">{bagShown.length} shown</small>
          </div>
        {/snippet}
        <div class="bagmain">
          <SlotGrid game={gameState}
            entries={bagShown}
            capacity={slotsAvailable(gameState)}
            compactGrid
            mode={bagMode}
            onmode={(m) => (bagMode = m)}
            sort={bagSort}
            onsort={(k) => (bagSort = k)}
            lead={bagFilters}
            wornOf={onWornOf}
            onequip={onEquip}
            actions={onBagActions}
            empty="Nothing carried yet — stones, herbs, draughts and junk land in these slots, and so does every piece a kill keeps."
          />
        </div>
        <div class="bagcare-rail">
          <details class="filter">
            <summary>Bag filter — what this run keeps</summary>
            <p><small>The filter is <b>off by default</b> — an off slot keeps every drop and dissolves nothing. An enabled slot converts a rejected piece into the complete Iron Ore + Scrap bundle. If either output cannot fit, the piece stays unpicked.</small></p>
            <table>
              <thead><tr><th>Slot</th><th>Filter</th><th>Keep when it beats the worn piece by</th><th>Also keep an Element you cannot resist</th><th>The rule in words</th></tr></thead>
              <tbody>
                {#each FILTER_SLOTS as slot}
                  {@const r = ruleFor(gameState.filter, slot)}
                  <tr>
                    <td>{slot}</td>
                    <td><input type="checkbox" aria-label={`Enable bag filter for ${slot}`} checked={r.enabled} disabled={!transactionWriter} onchange={(e) => onEditRule(slot, { enabled: (e.target as HTMLInputElement).checked })} /></td>
                    <td><input type="number" aria-label={`Minimum improvement over worn ${slot}, percent`} min="0" step="1" value={r.margin_pct} disabled={!r.enabled || !transactionWriter} onchange={(e) => onEditRule(slot, { margin_pct: Number((e.target as HTMLInputElement).value) })} /> %</td>
                    <td><input type="checkbox" aria-label={`Keep ${slot} with Element resistance missing`} checked={r.keep_missing_element} disabled={!r.enabled || !transactionWriter} onchange={(e) => onEditRule(slot, { keep_missing_element: (e.target as HTMLInputElement).checked })} /></td>
                    <td>{describeRule(r)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
            <p><small>Still not found — Elements you have no resistance for: <b>{gameState.filter.missing.elements.length ? gameState.filter.missing.elements.join(', ') : 'none'}</b> · empty slots: <b>{gameState.filter.missing.slots.length ? gameState.filter.missing.slots.join(', ') : 'none'}</b></small></p>
            <div class="filterpresets">
              <p class="filterpresets-head"><b>Filter presets</b>
                <small class="text-dim">· {presetSlots(gameState)}</small></p>
              <ul class="presetrow">
                {#each { length: presetSlots(gameState) } as _, i (i)}
                  <li>
                    <span>Preset {i + 1}</span>
                    {#if gameState.filterPresets[i]}
                      <small class="text-dim">stored</small>
                      <button onclick={() => onLoadPreset(i)} disabled={!transactionWriter}>Load</button>
                      <button onclick={() => onClearPreset(i)} disabled={!transactionWriter}>Clear</button>
                    {:else}
                      <small class="text-dim">empty</small>
                      <button onclick={() => onSavePreset(i)} disabled={!transactionWriter}>Save</button>
                    {/if}
                  </li>
                {/each}
              </ul>
              <p class="autodissolve"><small>Auto-dissolve below item level
                  <input type="number" min="0" step="1" value={gameState.autoDissolveLevel ?? 0} disabled={!transactionWriter}
                    onchange={(e) => onAutoDissolve(Number((e.target as HTMLInputElement).value))} /></small></p>
            </div>
            <button class="btn btn-quiet" type="button" onclick={onOpenGearCare}>Open gear care</button>
          </details>
          <div class="gear-care-slot">
            <GearCare state={gameState} writer={transactionWriter} autoEquipEnabled={settings.autoEquip !== false} marginPct={settings.equipMargin || 0}
              onAutoEquip={(enabled) => onSetSetting('autoEquip', enabled)} onEquipNow={onBestEquip}
              onMargin={(value) => onSetSetting('equipMargin', value)}
              onRule={onEditRule} onRunFilter={onRunFilter} onOpenBag={() => onclose()} />
          </div>
        </div>
      </div>
    </section>
    {:else}
    <section class="bagblock">
      <h3>Stash · one warehouse, every settlement</h3>
      <StashBoard game={gameState} {tabs} tab={stashTab} carriedSort={carriedSort} addtab={stashFolder}
                  ontab={onStashTab}
                  onaddtab={onStashAddTab}
                  oncarriedsort={onStashCarriedSort}
                  ondeposit={(i) => onDeposit(i, stashTab)}
                  onwithdraw={(i) => onWithdraw(stashTab, i)}
                  ondepositAll={() => onDepositAll(stashTab)}
                  onwithdrawAll={() => onWithdrawAll(stashTab)}
                  onlock={onLock} onequip={onEquip} wornOf={onWornOf} />
      {#if townNote}<p class="townnote">{townNote}</p>{/if}
    </section>
    {/if}
    </div>
  </div>
</Panel>

<style>
  .purse { display: inline-flex; align-items: center; gap: var(--spacing-xs); flex: none; font-variant-numeric: tabular-nums; }
  .purse img { width: var(--icon-label); height: var(--icon-label); padding: var(--spacing-xs); border: 1px solid var(--hud-edge); border-radius: var(--radius-round); background: var(--hud-face); box-sizing: border-box; object-fit: contain; }
  .purse b { font-size: var(--font-sm); font-weight: 700; color: var(--gold-lit); line-height: 1; }
  .purse i { font-size: var(--font-xs); font-style: normal; color: var(--dim); line-height: 1; text-transform: uppercase; letter-spacing: 1px; }
  .invbody { display: grid; align-content: start; gap: var(--spacing-sm); min-height: 0; height: 100%; }
  .invbody > section { min-height: 0; overflow: visible; }
  .inventory-layout { display: grid; grid-template-columns: minmax(max-content, 1fr) minmax(0, 4fr); grid-template-rows: minmax(0, 1fr); align-items: start; gap: var(--spacing-md); min-width: 0; min-height: 0; height: 100%; }
  .inventory-tab-label { display: inline-flex; align-items: center; gap: var(--spacing-xs); min-width: 0; }
  :global(.inventory-tab) small { text-align: right; }
    .inventory-layout { grid-template-columns: minmax(0, 1fr); }
  .bagtools .margin { display: inline-flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-xs); color: var(--dim); }
  .bagtools .margin input { width: var(--input-narrow); }
  .bagtools .best { border-color: color-mix(in srgb, var(--good) 55%, transparent); color: var(--good-lit); background: color-mix(in srgb, var(--good) 10%, transparent); }
  .bagmain { display: flex; flex-direction: column; gap: var(--spacing-xs); min-width: 0; }
  .bagtools, .bagview { display: flex; flex: 1 1 auto; align-items: center; gap: var(--spacing-xs); flex-wrap: wrap; min-width: 0; }
  .bagtools .grow, .bagview .grow { flex: 1; }
  .bagsearch { min-width: clamp(69px, 5.32vw, 149px); }
  .bagtier { display: inline-flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-xs); color: var(--dim); }
  .bagtools .best:hover { border-color: var(--good); }
  .equipnote { position: relative; top: var(--x-pull-note); font-size: var(--font-xs); color: var(--good); }
  .bagblock { display: grid; align-content: start; gap: var(--spacing-xs); border: 0; }
  .gear-care-slot { border-top: 1px solid var(--line); padding-top: var(--spacing-sm); }
  .bagmeta { margin: 0; }
  .filterpresets { display: grid; gap: var(--spacing-xs); border-top: 1px solid var(--line); padding-top: var(--spacing-sm); }
  .filterpresets-head { margin: 0; display: flex; align-items: baseline; gap: var(--spacing-xs); flex-wrap: wrap; }
  .presetrow { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--spacing-xs); grid-template-columns: repeat(auto-fill, minmax(min(100%, clamp(210px, 16.22vw, 437px)), 1fr)); }
  .presetrow li { display: flex; align-items: center; gap: var(--spacing-xs); }
  .presetrow li span { min-width: 6ch; }
  .presetrow button, .presetrow small { font-size: var(--font-xs); }
  .autodissolve input { width: var(--input-narrow); }
  .filter { display: grid; align-content: start; gap: var(--spacing-xs); }
  .filter summary { cursor: pointer; color: var(--dim); font-size: var(--font-xs); }
  .filter table { margin: 0; }
  .weight { margin: 0; font-size: var(--font-xs); color: var(--dim); white-space: nowrap; }
  .weight small { color: var(--dim); }
  .warn { color: var(--alarm); }
  .townnote { font-size: var(--font-xs); color: var(--good); }
</style>
