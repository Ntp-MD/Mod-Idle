<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import Tabs from '../shared/Tabs.svelte';
  import QuestBonusPicker from '../town/QuestBonusPicker.svelte';
  import { E, TOWN, eng } from '../../engine/client';
  import { canBuy, quoteTownPurchase, npcOf, priceMinutes, settlementOfZone, stashTabCount, canTravel } from '@sim/town/town';
  import { taskBonuses } from '@sim/town/quest-rewards';
  import { skipVerdict } from '@sim/town/town';
  import { heldCount, setUnlocked } from '@sim/town/collector';
  import { cellBlocks, walkBlocks, cellSec, road, settlementCell } from '@sim/world/road';
  import { warpCost } from '@sim/world/road';
  import type { GameState, Cell } from '@sim/core/types';
  import type { Picked } from '../map/map-types';
  import type { StatKey } from '../../engine/client';

  const STATS: StatKey[] = ['str', 'int', 'vit', 'agi', 'dex', 'wis', 'lck'];

  let {
    gameState, town, townId, townLive, viewTown, viewHere, viewStock, viewColSet, viewColHinted,
    deskSub, deskTab = $bindable(), junkTotal, junkLines, treeSpent, freeSkipsLeft, skipTokens, taskChoices,
    picked, transactionWriter, modalGridArea, showcaseMode, fmtNum,
    onSell, onRespec, onRespecTree, onBuy, onSkipTask, onClaim, onTurnIn, onSelect, onGoToZone, onWalk, onTravelTo, buyExpectation, warpPrice, stonesLine, onclose,
  }: {
    gameState: GameState;
    town: any;
    townId: string;
    townLive: boolean;
    viewTown: any;
    viewHere: boolean;
    viewStock: any[];
    viewColSet: any;
    viewColHinted: boolean;
    deskSub: string;
    deskTab: 'services' | 'stall' | 'guild' | 'hunt' | 'walk';
    junkTotal: number;
    junkLines: string[];
    treeSpent: { tree?: number; attainment?: number };
    freeSkipsLeft: number;
    skipTokens: number;
    taskChoices: Record<number, { task: any; choice: string | undefined }>;
    picked: string | null;
    transactionWriter: boolean;
    modalGridArea: string;
    showcaseMode: boolean;
    fmtNum: (n: number) => string;
    onSell: () => void;
    onRespec: () => void;
    onRespecTree: () => void;
    onBuy: (rowId: string, settlementId: string, expected?: import('@sim/town/pricing').TownPurchaseExpectation) => void;
    onSkipTask: (i: number) => void;
    onClaim: (i: number, choice?: string) => void;
    onTurnIn: () => void;
    onSelect: (id: string) => void;
    onGoToZone: (id: number) => void;
    onWalk: (dest: Picked | (Cell & { key?: string })) => void;
    onTravelTo: (id: string) => void;
    buyExpectation: (settlementId: string, row: any) => import('@sim/town/pricing').TownPurchaseExpectation;
    warpPrice: (id: string) => number;
    stonesLine: () => string;
    onclose: () => void;
  } = $props();
</script>

<Panel title="Settlement" subtitle={deskSub} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={onclose}>
  <div class="desk-panel">
    <Tabs label="Settlement sections" active={deskTab} onpick={(id) => (deskTab = id as typeof deskTab)}
      tabs={[{ id: 'services', label: 'Services' }, { id: 'stall', label: 'Stall' }, { id: 'guild', label: 'Guild & Collector' }, { id: 'hunt', label: 'Hunt' }, { id: 'walk', label: 'Walk' }]} />
    <div class="desk-content scroll-pane">

    {#if viewTown}
      <h3>{viewTown.name} · settlement{viewHere ? '' : ' — read only, you are standing in ' + (town ? town.name : 'the field')}</h3>
      <p><small>Innate Element {viewTown.innate.join(' / ')} · Base bias flavour {viewTown.base_bias_flavor} · NPCs here: {viewTown.npcs.map((n: string) => npcOf(n)?.name ?? n).join(' · ')}</small></p>
      {#if !viewHere}
        <p><small>Live only where the character stands.</small></p>
      {/if}

      <div class="fold">
      {#if deskTab === 'services'}
      <h4>Counterhand · the gold mint</h4>
      <p>Gold {gameState.counters.gold.toFixed(1)} · junk unsold {junkTotal} ({junkLines.join(' · ') || 'none'}) · stones {stonesLine()}</p>
      <button onclick={onSell} disabled={!viewHere || junkTotal === 0}>Sell all junk here</button>
      <p><small>The Counterhand pays junk and gathered goods at this town's demand.</small></p>

      <h4>Respec · free</h4>
      <p><small>Free · only in a settlement.</small></p>
      <button onclick={onRespec} disabled={!townLive || !viewHere || !STATS.some((k) => gameState.player.points[k])}>Respec — refund all stat points</button>
      <button onclick={onRespecTree} disabled={!townLive || !viewHere || (!treeSpent.tree && !treeSpent.attainment)}>Respec the tree — refund {treeSpent.tree ?? 0} tree and {treeSpent.attainment ?? 0} attainment point{treeSpent.attainment === 1 ? '' : 's'}</button>

      {/if}

      {#if deskTab === 'stall'}
      <h4>Stall stock</h4>
      <table>
        <thead><tr><th>Line</th><th>NPC</th><th>Kind</th><th>Minutes of income</th><th>Gold</th><th></th></tr></thead>
        <tbody>
          {#each viewStock as row}
            {@const check = canBuy(gameState, viewTown.id, row.id)}
            {@const purchaseQuote = quoteTownPurchase(gameState, viewTown.id, row.id)}
            {@const repair = row.id === 'repair' || row.id === 'repair_ironrow'}
            {@const noBroken = repair && !gameState.gear.some((it) => it?.broken) && !gameState.bag.some((it) => it?.broken)}
            <tr>
              <td>{row.item}</td>
              <td>{npcOf(row.npc)?.name ?? row.npc}</td>
              <td>{row.kind}</td>
              <td>{priceMinutes(row, viewTown.id, gameState)} m{row.charge_band ? ` @ ${row.charge_band}` : ''}</td>
              <td>{purchaseQuote.gold}{#if purchaseQuote.promotion}<small class="text-good"> normal {purchaseQuote.normalGold} · save {purchaseQuote.normalGold - purchaseQuote.gold} · {Math.max(0, Math.floor((purchaseQuote.promotion.expiresAtSec - gameState.clockSec) / 60))}m left</small>{/if}</td>
              <td>{#if !check.ok}<small>{check.why}</small>{:else if noBroken}<small>no Broken piece to repair</small>{/if}{#if viewHere}<button onclick={() => onBuy(row.id, viewTown.id, buyExpectation(viewTown.id, row))} disabled={!check.ok || noBroken}>buy</button>{:else}<span class="text-dim">elsewhere</span>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if viewHere}
        <p><small>Curio pedlar — today's rolled prices {gameState.pedlar.minutes.join(' / ')} minutes, {gameState.pedlar.bought} of {gameState.pedlar.minutes.length} bought; restocks at the next game day.</small></p>
      {/if}
      {/if}

      {#if deskTab === 'guild'}
      {#if viewHere}
        <h4>Guild board · {gameState.town.tasks.length} slots · {freeSkipsLeft} free skip{freeSkipsLeft === 1 ? '' : 's'} · {skipTokens} token{skipTokens === 1 ? '' : 's'}</h4>
        <table>
          <thead><tr><th>#</th><th>Task</th><th>Zone</th><th>Progress</th><th>Reward</th><th></th></tr></thead>
          <tbody>
            {#each gameState.town.tasks as t, i}
              {@const skip = skipVerdict(gameState, i)}
              {@const options = t ? taskBonuses(t) : []}
              {@const choice = t && taskChoices[i]?.task === t ? taskChoices[i].choice : undefined}
              <tr>
                <td>{i + 1}</td>
                <td>{t ? `${t.kind} ×${t.n}`
                  : 'refills in ' + (() => { const s = Math.max(0, gameState.town.refillAt[i] - gameState.clockSec); return s >= 3600 ? (s / 3600).toFixed(1) + 'h' : s >= 60 ? Math.round(s / 60) + 'm' : Math.round(s) + 's'; })()}</td>
                <td>{t ? eng.zoneById(t.zone).name : ''}</td>
                <td>{t ? `${t.progress} / ${t.n}` : ''}</td>
                <td>{#if t}
                  <QuestBonusPicker state={gameState} {options} name={`hunt-reward-${i}`} {choice} writer={transactionWriter} onchoose={(choice) => { taskChoices[i] = { task: t, choice }; }} />
                {/if}</td>
                <td>{#if t}
                  <button class="btn btn-quiet" disabled={!transactionWriter || !skip.ok}
                          title={skip.why || (skip.free ? 'Use the free task skip' : 'Spend one Task skip token')}
                          onclick={() => onSkipTask(i)}>{skip.free ? 'skip · free' : skip.token ? 'skip · token' : 'skip'}</button>
                  <button disabled={!transactionWriter || t.progress < t.n || options.length > 1 && !choice}
                    title={options.length > 1 && !choice ? 'Choose one reward before claiming' : 'Receive the displayed reward'}
                    onclick={() => onClaim(i, choice)}>Claim reward</button>
                {/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p><small>Elite hunts pay fixed stones. Boss hunts offer Remove or Tier stones.</small></p>
      {/if}

      {#if viewColSet}
        <h4>Collector · {viewColSet.name} ({viewColHinted || gameState.collector.done[viewColSet.id] ? `${viewColSet.school} school` : 'school hidden'})</h4>
        <p><small>{gameState.collector.done[viewColSet.id]
          ? 'Turned in · the pieces are gone and the reward is yours.'
          : 'The set slots are open here.'}</small></p>
        <table>
          <thead><tr><th>Piece</th><th>Slot</th><th>Held</th><th>Quality asked</th></tr></thead>
          <tbody>
            {#each viewColSet.parsed as p}
              <tr>
                <td>{p.name}</td><td>{p.slot}</td>
                <td>{heldCount(gameState, viewColSet.id, p.name)} / 1</td>
                <td>{viewColSet.quality}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if !gameState.collector.done[viewColSet.id]}
          <p><small>Still hunting: {viewColSet.parsed.filter((p: any) => heldCount(gameState, viewColSet.id, p.name) === 0).map((p: any) => `${p.name} (${p.slot})`).join(' · ') || 'every piece is in hand — turn it in.'} Frames roll even-weighted across the whole world, so the target is the {viewColSet.quality} quality{viewColHinted ? ` and the ${viewColSet.school} school` : ' — buy the Collector hint to reveal its school'}, not one zone.</small></p>
        {/if}
        {#if viewHere}
          <button onclick={onTurnIn} disabled={!setUnlocked(gameState, viewColSet) || gameState.collector.done[viewColSet.id]}>turn in the set</button>
        {/if}
        <p><small>Reward: {viewColSet.reward} · {viewColSet.rule} · no gold, no Mod (T14).</small></p>
      {/if}

      {#if viewHere && (gameState.grants.filter_presets || gameState.grants.titles.length || gameState.grants.banners.length)}
        <h4>Collector grants</h4>
        <p><small>{gameState.grants.filter_presets} extra filter preset{gameState.grants.filter_presets === 1 ? '' : 's'} · {stashTabCount} stash tabs{gameState.grants.titles.length ? ` · titles: ${gameState.grants.titles.join(', ')}` : ''}{gameState.grants.banners.length ? ` · banners: ${gameState.grants.banners.join(', ')}` : ''}.</small></p>
      {/if}
      {/if}
      </div>
    {/if}

    {#if deskTab === 'hunt'}
    <h3>Hunt · {E.mob.zones.length} zones, one per settlement</h3>
    <p><small>Zones open at their settlement · mobs scale to your level.</small></p>
    <table class="picklist">
      <thead><tr><th>Zone</th><th>Levels</th><th>mob_HP</th><th>Quality</th><th>Elements</th><th>Group</th><th>Sub-zones</th><th></th></tr></thead>
      <tbody>
        {#each E.mob.zones as z}
          {@const home = settlementOfZone(z.id)?.id}
          {@const opened = !!home && gameState.town.visited.includes(home)}
          <tr class:picked={!!home && picked === home} tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); home && onSelect(home); } }}
              onclick={() => home && onSelect(home)}>
            <td>{z.id} · {z.name}</td>
            <td>{z.levels.join('-')}</td>
            <td class="mob-hp">{z.hp.map((hp: number) => fmtNum(hp)).join(' → ')}</td>
            <td>{z.quality}</td>
            <td>{eng.zoneElements(z.id).join(', ')}</td>
            <td>{z.group}</td>
            <td>{(z.subzones || []).map((s: any) => s.name).join(' · ')}</td>
            <td><button onclick={(e) => { e.stopPropagation(); onGoToZone(z.id); }} disabled={z.id === gameState.zone || !opened}>
              {z.id === gameState.zone ? 'here' : opened ? 'hunt' : 'walk first'}
            </button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    {/if}

    {#if deskTab === 'walk'}
    <h3>Walk · {E.road.block_sec}s a block · {gameState.town.visited.length} of {TOWN.settlements.length} Waypoints opened</h3>

    <table class="picklist">
      <thead><tr><th>Settlement</th><th>Zone</th><th>Blocks</th><th>Time</th><th>Warp</th><th></th></tr></thead>
      <tbody>
        {#each TOWN.settlements.filter((x: any) => x.id !== townId) as s}
          {@const dest = settlementCell(s.id)}
          {@const blocks = dest ? cellBlocks(gameState, dest) : walkBlocks(townId, s.id)}
          {@const fare = warpPrice(s.id)}
          <tr class:picked={picked === s.id} tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); } }}
              onclick={() => onSelect(s.id)}>
            <td>{s.name}</td><td>{s.zone}</td>
            <td>{blocks}</td>
            <td>{dest ? cellSec(gameState, dest) : road.secBetween(townId, s.id)}s</td>
            <td>{canTravel(gameState, s.id) ? `${fare} gold` : '—'}</td>
            <td>
              <button onclick={(e) => { e.stopPropagation(); dest && onWalk(dest); }} disabled={!!gameState.walk}>{gameState.walk && dest && gameState.walk.to.q === dest.q && gameState.walk.to.r === dest.r ? 'walking' : 'walk'}</button>
              {#if canTravel(gameState, s.id)}<button onclick={(e) => { e.stopPropagation(); onTravelTo(s.id); }} disabled={gameState.counters.gold < fare} title={gameState.counters.gold < fare ? `needs ${fare} gold` : `warp for ${fare} gold`}>waypoint</button>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {/if}
    </div>
  </div>
</Panel>

<style>
  .desk-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .desk-content { display: flex; flex-direction: column; gap: var(--spacing-xs); flex: 1; min-height: 0; }
  .desk-content p { font-size: var(--font-xs); }
  .desk-content .picklist th, .desk-content .picklist td { padding: var(--spacing-xs) var(--spacing-xs); line-height: 1.1; font-size: var(--font-xs); }
  .desk-content .picklist button { font-size: var(--font-xs); }
  .picklist tr { cursor: pointer; }
  .picklist tr:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
  .picklist tr.picked { background: var(--panel); }
  .desk-content .picklist .mob-hp { white-space: nowrap; }
</style>
