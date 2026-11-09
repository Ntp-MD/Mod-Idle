<script lang="ts">
  import { E, eng, fieldwork } from '../../engine/client';
  import type { GameState } from '@sim/core/types';
  import { ownerOf } from '@sim/world/road';
  import { settlementById } from '@sim/town/town';
  import { mapKnowledge, trailSites, trailSiteKind } from '@sim/world/map-exploration';
  import type { CampEncounterAction, CampEncounterPolicy } from '@sim/world/camp-encounters';
  import type { CampEncounterStage } from '@sim/world/fieldwork';
  import StoryScene from '../story/StoryScene.svelte';
  import { campStoryView } from '../story/story-presenters';
  import type { StoryIntent } from '../story/story-scene';

  let { state: gameState, writable, expanded = $bindable(false), onSelect, onEncounter, onPolicy }: {
    state: GameState; writable: boolean;
    expanded?: boolean;
    onSelect: (hex: { q: number; r: number }) => void;
    onEncounter: (id: number, action: CampEncounterAction, expected?: { beat: number; stage: CampEncounterStage }) => { ok: boolean; why?: string };
    onPolicy: (policy: CampEncounterPolicy) => void;
  } = $props();
  const sites = $derived(trailSites(gameState).filter(site => mapKnowledge(gameState, site) !== 'unknown'));
  const known = $derived(new Set([...(gameState.mapJournal?.scouted || []), ...(gameState.mapJournal?.visited || [])]).size);
  const activityName = (kind?: string) => kind ? ({ mine: 'Mining', grove: 'Woodcutting', fish: 'Fishing' } as Record<string, string>)[kind] || kind : '';
  const encounter = $derived(gameState.fieldwork.campEncounters.active);
  const receipt = $derived(encounter ? null : gameState.fieldwork.campEncounters.lastReceipt);
  let campError = $state('');
  let campErrorRev = $state(0);

  const FALLBACK_SCENES: Record<string, string> = {
    sounds: 'sounds-signs', prowler: 'prowler-edge', traveler: 'traveler-offer',
    nest: 'nest-worksite', discovered: 'camp-found', 'supply-cache': 'cache-ledge',
  };

  const view = $derived.by(() => {
    if (encounter) {
      const story = encounter.story;
      const cache = (story?.cache ?? null) as { foodId: string; materialId: string; carefulSec: number; quickOutcome: string } | null;
      const preview = cache ? fieldwork.cachePreview(cache, encounter.stage === 'resolving' || encounter.stage === 'collect' ? 'careful' : 'quick') : null;
      return campStoryView({
        key: `camp:${encounter.id}:${story?.beat ?? 0}:${encounter.stage}:${campErrorRev}`,
        kind: encounter.kind, stage: encounter.stage,
        sceneId: story?.sceneId ?? FALLBACK_SCENES[encounter.kind] ?? encounter.kind,
        lineIndex: story?.lineIndex ?? 0,
        speciesName: eng.speciesById(encounter.payload.species as string)?.name,
        materialName: cache ? fieldwork.materialById[cache.materialId]?.name : '',
        foodName: cache ? fieldwork.foodById[cache.foodId]?.name : '',
        cache, cachePreview: preview ?? undefined,
        materials: encounter.payload.materials as string[] | undefined,
        foodAmount: encounter.payload.foodAmount as number | undefined,
        foodHeld: cache ? gameState.fieldwork.foods[cache.foodId] || 0
          : encounter.kind === 'traveler' ? gameState.fieldwork.foods[encounter.payload.foodId as string] || 0 : 0,
        writable, error: campError,
      });
    }
    if (receipt) {
      return campStoryView({
        key: `camp:receipt:${receipt.encounterId}:${receipt.action}`,
        kind: receipt.kind, stage: 'combat', sceneId: receipt.sceneId, lineIndex: 0,
        writable, error: campError,
        receipt: {
          action: receipt.action, sceneId: receipt.sceneId, elapsedSec: receipt.elapsedSec,
          paid: receipt.paid, earned: receipt.earned, lost: receipt.lost, info: receipt.info,
        },
      });
    }
    return null;
  });

  const TRADE_ACTIONS = new Set(['trade-ore', 'trade-timber']);
  const storyView = $derived(view ? { ...view, actions: view.actions.filter((entry) => !TRADE_ACTIONS.has(entry.id)) } : null);
  const tradeActions = $derived(view?.actions.filter((entry) => TRADE_ACTIONS.has(entry.id)) ?? []);

  let lastBeatKey = '';
  $effect(() => {
    const key = encounter ? `${encounter.id}:${encounter.story?.beat ?? 0}:${encounter.stage}` : '';
    if (key !== lastBeatKey) { lastBeatKey = key; campError = ''; }
  });

  function onTradeAction(actionId: string) {
    if (!view) return;
    onStoryAction({ key: view.key, actionId });
  }

  function onStoryAction(intent: StoryIntent) {
    if (!encounter) return;
    const story = encounter.story;
    const result = onEncounter(encounter.id, intent.actionId as CampEncounterAction, {
      beat: story?.beat ?? 0, stage: encounter.stage,
    });
    campError = result.ok ? '' : result.why || 'That choice is unavailable';
    if (!result.ok) campErrorRev++;
  }
</script>

<details class="map-tools-section" bind:open={expanded}>
  <summary>Journey tools · {known} known blocks</summary>
  <div class="map-journey">
    <p class="text-note">{gameState.mapJournal?.visited.length || 0} explored · {known} known. Approach landmarks to scout their roster and supplies.</p>
    <p class="text-note">The loop: hunt for drops and materials → deliver or sell at a settlement → improve gear and tree → continue from the pinned goal.</p>
    {#if gameState.fieldwork.camp}
      <button class="btn btn-quiet" type="button" onclick={() => onSelect(gameState.fieldwork.camp!.cell)}>Locate Field Camp{gameState.fieldwork.action ? ` · ${activityName(gameState.fieldwork.action.kind)}` : ''}</button>
      <label class="camp-policy">When Camp is threatened
        <select aria-label="Camp threat policy" value={gameState.fieldwork.campEncounters.policy} disabled={!writable}
          onchange={(event) => onPolicy(event.currentTarget.value as CampEncounterPolicy)}>
          <option value="avoid">Avoid fights</option><option value="defend">Defend Camp</option><option value="engage">Engage early</option>
        </select>
      </label>
    {/if}
    {#if storyView}
      <StoryScene view={storyView} onaction={onStoryAction}>
        {#snippet controls()}
          {#if tradeActions.length}
            <details class="camp-trades">
              <summary>Trade provisions</summary>
              <div class="trade-actions">
                {#each tradeActions as entry (entry.id)}
                  <button class="btn btn-quiet" type="button" disabled={entry.disabled} title={entry.reason}
                    onclick={() => onTradeAction(entry.id)}>{entry.label}</button>
                  {#if entry.disabled && entry.reason}<small class="text-note">{entry.reason}</small>{/if}
                {/each}
              </div>
            </details>
          {/if}
        {/snippet}
      </StoryScene>
    {/if}
    <p class="text-note">Walking runs online.</p>
    {#if sites.length}
      <details>
        <summary>Discovered trail sites · {sites.length}</summary>
        <div class="journey-sites">
          {#each sites as site}<button class="btn btn-flat" type="button" onclick={() => onSelect(site)}>{trailSiteKind(site).name} · {settlementById(ownerOf(site).id)?.name} · {Math.ceil(site.remainingSec / 60)}m left{gameState.mapJournal?.claimedSites.includes(site.id) ? ' · explored' : ''}</button>{/each}
        </div>
      </details>
    {/if}
  </div>
</details>

<style>
  .map-tools-section { min-width: 0; border-top: 1px solid var(--edge); }
  .map-tools-section > summary { padding-block: var(--spacing-sm); cursor: pointer; font-size: var(--font-xs); font-weight: 600; }
  .map-journey, .journey-sites { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .map-journey { padding-block: var(--spacing-sm); }
  .camp-policy { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); }
  .camp-trades summary { cursor: pointer; font-size: var(--font-xs); color: var(--sheet-ink); }
  .trade-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); padding-block: var(--spacing-xs); }
  .map-journey p { margin: 0; line-height: 1.4; }
  .journey-sites button { text-align: left; }
</style>
