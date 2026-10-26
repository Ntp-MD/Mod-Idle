<script lang="ts">
  import type { GameState } from '../../sim/core/types';
  import { itemName } from '../../sim/gear/item-name';
  import { ruleFor, FILTER_SLOTS, describeRule } from '../../sim/gear/filter';
  import { gearCarePreview } from '../../sim/gear/gear-care';
  import { autoReturnThreshold } from '../../sim/world/exploration';
  import { slotsAvailable } from '../../sim/gear/slots';

  let { state: gameState, writer, autoEquipEnabled, marginPct,
    onAutoEquip, onEquipNow, onMargin, onAutoReturn, onRule, onRunFilter, onOpenBag,
  }: {
    state: GameState;
    writer: boolean;
    autoEquipEnabled: boolean;
    marginPct: number;
    onAutoEquip: (enabled: boolean) => void;
    onEquipNow: () => void;
    onMargin: (value: number) => void;
    onAutoReturn: (enabled: boolean) => void;
    onRule: (slot: string, patch: Record<string, unknown>) => void;
    onRunFilter: () => void;
    onOpenBag: () => void;
  } = $props();
  let showPreview = $state(false);
  const preview = $derived(gearCarePreview($state.snapshot(gameState), marginPct || 0));
  const enabledSlots = $derived(FILTER_SLOTS.filter((slot) => ruleFor(gameState.filter, slot).enabled).length);
  const threshold = $derived(autoReturnThreshold(gameState));
  const available = $derived(slotsAvailable(gameState));
  const gain = (value: number) => value === Infinity ? 'empty cell' : `+${value.toFixed(1)}%`;
  const actionLabel = { keep: 'Keep', dissolve: 'Dissolve', protected: 'Protected', blocked: 'Blocked', 'not-reached': 'Not reached' } as const;
</script>

<details class="gear-care">
  <summary>Gear care · Auto Equip {autoEquipEnabled ? 'on' : 'off'} · Filter {enabledSlots ? `${enabledSlots} on` : 'off'} · Auto-Return {gameState.autoReturn.enabled ? 'on' : 'off'}</summary>
  <div class="gear-care-body">
    <p class="text-note">Changing a setting saves it immediately. The preview is read-only: it moves no piece, spends nothing and rolls no RNG. Use the buttons to act.</p>
    {#if !writer}<p class="text-alarm" role="status">Read-only: another tab controls progress. Settings can be inspected, but actions are disabled.</p>{/if}

    <div class="gear-care-toggles">
      <label><input type="checkbox" checked={autoEquipEnabled} disabled={!writer} onchange={(event) => onAutoEquip(event.currentTarget.checked)} /> Auto Equip</label>
      <label>Swap margin <input type="number" min="0" step="1" disabled={!writer} value={marginPct} onchange={(event) => onMargin(Math.max(0, Number(event.currentTarget.value) || 0))} />%</label>
      <label><input type="checkbox" checked={gameState.autoReturn.enabled} disabled={!writer} onchange={(event) => onAutoReturn(event.currentTarget.checked)} /> Auto-Return at {threshold} of {available} slots</label>
      <button class="btn btn-quiet" type="button" aria-expanded={showPreview} onclick={() => (showPreview = !showPreview)}>{showPreview ? 'Hide preview' : 'Preview the result'}</button>
    </div>

    {#if showPreview}
      <section class="preview card-read" aria-label="Auto Equip preview">
        <h3>Auto Equip forecast {autoEquipEnabled ? '' : '(setting is off)'}</h3>
        {#if preview.equip.swaps.length}
          <ul>
            {#each preview.equip.swaps as swap, index (index)}
              <li><b>{swap.base}</b> → {swap.slot} {swap.instead ? `replaces ${swap.instead}` : 'fills an empty cell'} <span class="text-note">· {gain(swap.gains)}</span></li>
            {/each}
          </ul>
        {:else}<p class="text-note">Nothing carried beats what is worn at this margin.</p>{/if}
        <p class="text-note">
          Leaves alone: {preview.equip.spared.locked} locked · {preview.equip.spared.set} held for a set · {preview.equip.spared.broken} Broken.
          {#if preview.equip.inStash}<b>{preview.equip.inStash} stashed piece(s) would beat something worn</b> — take one out to wear it.{/if}
        </p>
        <div class="gear-care-actions">
          <button class="btn btn-quiet" type="button" disabled={!writer || !preview.equip.swaps.length}
            title={preview.equip.swaps.length ? 'Equip only the pieces listed in this preview.' : 'Nothing carried beats the gear you wear.'}
            onclick={onEquipNow}>Equip previewed pieces now</button>
        </div>
      </section>

      <section class="preview card-read" aria-label="Bag filter forecast">
        <h3>What the bag filter will do</h3>
        <p class="text-note">It runs from the last bag slot upward. Auto Equip above is a separate preview and action.</p>
        <div class="preview-scroll scroll-pane">
          <table>
            <thead><tr><th>Piece</th><th>Action</th><th>Reason</th></tr></thead>
            <tbody>
              {#each preview.bag as row, index (index)}
                <tr class:protected={row.action === 'protected'} class:dissolve={row.action === 'dissolve'} class:blocked={row.action === 'blocked'} class:not-reached={row.action === 'not-reached'}>
                  <td>{itemName(row.item)} <small class="text-note">{row.item.slot}</small></td>
                  <td>{actionLabel[row.action]}</td>
                  <td><small>{row.reason}</small></td>
                </tr>
              {:else}<tr><td colspan="3" class="text-note">The bag holds no gear.</td></tr>{/each}
            </tbody>
          </table>
        </div>
        {#if preview.filterBlocked}<p class="text-alarm" role="status">{preview.filterBlocked}</p>{/if}
        <div class="gear-care-actions">
          {#if !enabledSlots}<p class="text-note" role="status">Turn on at least one slot rule to run the filter.</p>{/if}
          <button class="btn btn-quiet" type="button" disabled={!writer || !enabledSlots || !!preview.filterBlocked} onclick={onRunFilter}>Run the filter over the bag</button>
          <button class="btn btn-flat" type="button" onclick={onOpenBag}>Open bag</button>
        </div>
      </section>

      <section class="preview card-read" aria-label="Auto-Return forecast">
        <h3>Auto-Return</h3>
        <p class="text-note">{preview.autoReturn.used} of {preview.autoReturn.available} slots used · trips at {preview.autoReturn.threshold}.
          {preview.autoReturn.readyToStart ? ` ${preview.autoReturn.enabled ? `Ready: a trip to ${preview.autoReturn.settlement} starts on the next tick.` : preview.autoReturn.blocked}`
            : preview.autoReturn.blocked ? ` ${preview.autoReturn.blocked}`
              : ` Will head to ${preview.autoReturn.settlement} when the field is safe, then resume Patrol.`}</p>
      </section>

      <details class="rules">
        <summary>Bag filter rules · {enabledSlots} of {FILTER_SLOTS.length} slots on</summary>
        <table>
          <thead><tr><th>Slot</th><th>On</th><th>Margin %</th><th>Unknown Element</th></tr></thead>
          <tbody>
            {#each FILTER_SLOTS as slot (slot)}
              {@const rule = ruleFor(gameState.filter, slot)}
              <tr>
                <td>{slot}</td>
                <td><input type="checkbox" aria-label={`Filter ${slot} on`} checked={rule.enabled} disabled={!writer} onchange={(event) => onRule(slot, { enabled: event.currentTarget.checked })} /></td>
                <td><input type="number" min="0" step="1" aria-label={`${slot} filter margin percent`} value={rule.margin_pct} disabled={!writer} onchange={(event) => onRule(slot, { margin_pct: Math.max(0, Number(event.currentTarget.value) || 0) })} /></td>
                <td><input type="checkbox" aria-label={`Keep an unknown Element for ${slot}`} checked={rule.keep_missing_element} disabled={!writer} onchange={(event) => onRule(slot, { keep_missing_element: event.currentTarget.checked })} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="text-note">Rules are stored once and read by the same filter a drop uses. {describeRule(ruleFor(gameState.filter, FILTER_SLOTS[0]))} is the shape of a rule.</p>
      </details>
    {/if}
  </div>
</details>

<style>
  .gear-care { border-top: 1px solid var(--edge); font-size: var(--font-xs); }
  .gear-care > summary { cursor: pointer; padding-block: var(--spacing-sm); font-weight: 600; }
  .gear-care-body { display: grid; gap: var(--spacing-sm); padding-bottom: var(--spacing-sm); }
  .gear-care-body p { margin: 0; line-height: 1.4; }
  .gear-care-toggles { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs) var(--spacing-md); }
  .gear-care-toggles label { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .gear-care-toggles input[type='number'] { width: 5ch; }
  .preview { display: grid; gap: var(--tile-gap); padding: var(--tile-pad); }
  .preview h3 { margin: 0; font-size: var(--font-xs); }
  .preview ul { display: grid; gap: var(--spacing-xs); margin: 0; padding-inline-start: var(--spacing-md); }
  .preview-scroll { max-height: 16rem; }
  .preview table { width: 100%; border-collapse: collapse; font-size: var(--font-xs); }
  .preview th, .preview td { padding: var(--spacing-2xs) var(--spacing-xs); text-align: left; vertical-align: top; }
  .preview th { color: var(--dim); font-weight: 500; }
  .preview tr.protected td { color: var(--gold-lit); }
  .preview tr.dissolve td { color: var(--alarm); }
  .preview tr.blocked td { color: var(--alarm); font-weight: 600; }
  .preview tr.not-reached td { color: var(--dim); }
  .gear-care-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
  .rules { display: grid; gap: var(--spacing-xs); }
  .rules summary { cursor: pointer; color: var(--dim); }
  .rules table { width: 100%; border-collapse: collapse; font-size: var(--font-xs); }
  .rules th, .rules td { padding: var(--spacing-2xs, 2px) var(--spacing-xs); text-align: left; }
  .rules input[type='number'] { width: 6ch; }
</style>
