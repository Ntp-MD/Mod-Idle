<script lang="ts">
  import Panel from '../hud/Panel.svelte';
  import Tabs from '../shared/Tabs.svelte';
  import { ACTIVITY_GUIDE } from '@sim/core/guidance';
  import { farm, farmMasteryLevel } from '@sim/world/farm';
  import { previewScrapAlchemy, alchemyTierProgress } from '@sim/gear/alchemy';
  import { E } from '../../engine/client';
  import type { GameState } from '@sim/core/types';

  let {
    gameState, farmSub, farmTab = $bindable(), transactionWriter, farmNote, plots, fl,
    modalGridArea, showcaseMode,
    onPlant, onHarvest, onScrapAlchemy, onBrew, onDrink, onCondense,
    onAutoPotion, onPotionThreshold, onFarmAutomation, onclose,
  }: {
    gameState: GameState;
    farmSub: string;
    farmTab: 'plots' | 'alchemy' | 'automation';
    transactionWriter: boolean;
    farmNote: string;
    plots: number;
    fl: number;
    modalGridArea: string;
    showcaseMode: boolean;
    onPlant: (index: number, tier: string) => void;
    onHarvest: (index: number) => void;
    onScrapAlchemy: (count?: number) => void;
    onBrew: (name: string) => void;
    onDrink: (name: string) => void;
    onCondense: (name: string) => void;
    onAutoPotion: (kind: 'hp' | 'mana', enabled: boolean) => void;
    onPotionThreshold: (kind: 'hp' | 'mana', value: number) => void;
    onFarmAutomation: (kind: 'harvest' | 'plant' | 'brew', enabled: boolean) => void;
    onclose: () => void;
  } = $props();
</script>

<Panel title="Farm" subtitle={farmSub} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={onclose}>
  <div class="farm-panel">
    <p class="text-note"><b>Optional activity</b> {ACTIVITY_GUIDE.farm.when} {ACTIVITY_GUIDE.farm.helps}</p>
    <p><small>{gameState.farm.xp} Farm XP · {farm.xpPerHarvest} per harvest · {farm.F.growth_hours} h base cycle · tier Mastery XP low {gameState.farm.mastery.low} (Lv {farmMasteryLevel(gameState, 'low')}), mid {gameState.farm.mastery.mid} (Lv {farmMasteryLevel(gameState, 'mid')}), high {gameState.farm.mastery.high} (Lv {farmMasteryLevel(gameState, 'high')}) · at most 10% future growth-time reduction; ready times already set are unchanged · {farm.plotsMax} plots at most ({plots} yours).</small></p>
    <Tabs label="Farm sections" active={farmTab} onpick={(id) => (farmTab = id as 'plots' | 'alchemy' | 'automation')}
      tabs={[{ id: 'plots', label: 'Plots & herbs' }, { id: 'alchemy', label: 'Alchemy' }, { id: 'automation', label: 'Auto use' }]} />

    {#if farmTab === 'plots'}
    <h3>Plots</h3>
    <table>
      <thead><tr><th>Plot</th><th>Grow</th><th>Ready</th><th></th></tr></thead>
      <tbody>
        {#each Array(plots) as _, i}
          {@const p = gameState.farm.plots[i]}
          <tr>
            <td>{i + 1}</td>
            <td>
              <select aria-label={`Grow tier for plot ${i + 1}`} value={p?.tier || 'low'} onchange={(e) => onPlant(i, (e.target as HTMLSelectElement).value)}>
                {#each farm.TIERS as tier}
                  <option value={tier} selected={p?.tier === tier}>{tier}{!farm.canGrow(fl, tier) ? ` (needs level ${farm.F.tier_unlock_level[tier]})` : ''}</option>
                {/each}
              </select>
            </td>
            <td>{p?.tier ? (gameState.clockSec >= p.readyAt ? 'ready' : Math.ceil((p.readyAt - gameState.clockSec) / 360) / 10 + ' h') : 'empty'}</td>
            <td><button onclick={() => onHarvest(i)} disabled={!p?.tier || gameState.clockSec < p.readyAt}>harvest</button></td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Herb store · bundles drop on their own roll</h3>
    <p>{farm.TIERS.map((t: string) => `${t} ${gameState.farm.herbs[t] || 0}`).join(' · ')} ({(farm.H.mid_chance * 100).toFixed(0)}% per kill in mid zones · {(farm.H.high_chance * 100).toFixed(0)}% in high, {farm.H.bundle_min}-{farm.H.bundle_max} at a time)</p>
    {/if}

    {#if farmTab === 'alchemy'}
    <h3>Alchemy</h3>
    {@const scrapPreview = previewScrapAlchemy(gameState, { writer: transactionWriter })}
    {@const tierProgress = alchemyTierProgress(gameState.alchemy)}
    {@const scrapBatch = Math.floor((gameState.fieldwork.materials.scrap || 0) / E.salvage.alchemy.scrap_cost)}
    <p>{gameState.fieldwork.materials.scrap || 0} Scrap carried · {E.salvage.alchemy.scrap_cost} Scrap → {E.salvage.alchemy.value_yield} Value stone · {tierProgress.outputsToNext} more to the next Tier stone ({tierProgress.paid} earned).</p>
    <button disabled={!scrapPreview.ok} title={scrapPreview.ok ? 'Immediate settlement recipe' : scrapPreview.why} onclick={() => onScrapAlchemy()}>Transmute Scrap</button>
    <button disabled={!scrapPreview.ok || scrapBatch < 1} title={scrapBatch < 1 ? `Needs ${E.salvage.alchemy.scrap_cost} Scrap per transmutation` : `Batch ${scrapBatch} single transmutes, stopping at the first refusal`} onclick={() => onScrapAlchemy(scrapBatch)}>Transmute all {scrapBatch} Scrap</button>
    {#if !scrapPreview.ok}<p>{scrapPreview.why}</p>{/if}
    <table>
      <thead><tr><th>Draught</th><th>Effect</th><th>Cost</th><th>Held</th><th></th></tr></thead>
      <tbody>
        {#each farm.P.list as p}
          {@const cost = farm.craftCost(p.tier)}
          <tr>
            <td>{p.name}</td>
            <td>{p.pool === 'both' ? `Instant ${farm.potionPct(p, 'hp')}% Max HP + ${farm.potionPct(p, 'mana')}% Max Mana` : `Instant ${farm.potionEffect(p)}% Max ${p.pool === 'hp' ? 'HP' : 'Mana'}`}</td>
            <td>{cost.herbs} {p.tier} herbs + {cost.reroll_value_stones} Value stone(s)</td>
            <td>{gameState.farm.potions[p.name] || 0}{gameState.farm.condensed[p.name] ? ` (+${gameState.farm.condensed[p.name]} condensed)` : ''}</td>
            <td>
              <button onclick={() => onBrew(p.name)}>brew</button>
              <button onclick={() => onDrink(p.name)} disabled={!((gameState.farm.potions[p.name] || 0) + (gameState.farm.condensed[p.name] || 0))}>drink</button>
              <button onclick={() => onCondense(p.name)} disabled={(gameState.farm.potions[p.name] || 0) < farm.P.condensed.cost_bottles}>condense</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {/if}

    {#if farmTab === 'automation'}
    <h3>Auto-use</h3>
    <label><input type="checkbox" checked={gameState.farm.autoUse.hp} disabled={!transactionWriter} onchange={(e) => onAutoPotion('hp', e.currentTarget.checked)} /> HP line below
      <input type="number" value={gameState.farm.threshold.hp} min="1" max="99" disabled={!transactionWriter} onchange={(e) => onPotionThreshold('hp', e.currentTarget.valueAsNumber)} />%
    </label>
    <label><input type="checkbox" checked={gameState.farm.autoUse.mana} disabled={!transactionWriter} onchange={(e) => onAutoPotion('mana', e.currentTarget.checked)} /> Mana line below
      <input type="number" value={gameState.farm.threshold.mana} min="1" max="99" disabled={!transactionWriter} onchange={(e) => onPotionThreshold('mana', e.currentTarget.valueAsNumber)} />%
    </label>
    <h3>Auto-farm</h3>
    <label><input type="checkbox" checked={gameState.farm.autoFarm.harvest} disabled={!transactionWriter} onchange={(e) => onFarmAutomation('harvest', e.currentTarget.checked)} /> Auto-harvest ready plots</label>
    <label><input type="checkbox" checked={gameState.farm.autoFarm.plant} disabled={!transactionWriter} onchange={(e) => onFarmAutomation('plant', e.currentTarget.checked)} /> Auto-plant empty plots (uses one herb as the seed)</label>
    <label><input type="checkbox" checked={gameState.farm.autoFarm.brew} disabled={!transactionWriter} onchange={(e) => onFarmAutomation('brew', e.currentTarget.checked)} /> Auto-brew affordable draughts</label>
    <p><small>Shared cooldown {farm.P.shared_cooldown_sec} sec · {farm.P.max_uses_per_fight} uses a fight · {farm.P.boss_suppressed ? 'suppressed entirely on bosses' : ''} · a condensed bottle is {farm.P.condensed.effect_mult}× and weighs {farm.P.condensed.weight} against {farm.P.weight} loose.</small></p>
    {/if}
    {#if farmNote}<p class="farm-note" role="status">{farmNote}</p>{/if}
  </div>
</Panel>

<style>
  .farm-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .farm-panel > p { margin: 0; font-size: var(--font-xs); }
  .farm-note { color: var(--good); }
</style>
