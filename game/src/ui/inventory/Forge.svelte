<script lang="ts">
  import { ED, TOWN, fieldwork } from '../../engine/client';
  import { forge, canForge } from '@sim/gear/forge';
  import { fieldSkillLevel } from '@sim/world/fieldwork';
  import { materialSources, sourceLine } from '@sim/gear/material-sources';
  import type { ForgeKind } from '@engine/forge.ts';
  import type { GameState } from '@sim/core/types';
  import EmptyNote from '../shared/EmptyNote.svelte';
  import Tabs from '../shared/Tabs.svelte';

  const KIND_TABS = [{ id: 'armour', label: 'Armour' }, { id: 'weapon', label: 'Weapons' }];

  let { game, writer, note = '', onforge,
    focus = null, ontrack = () => {}, onshortage = () => {}, onpinzone = () => {}, onmap = () => {}, onbag = () => {},
  }: {
    game: GameState;
    writer: boolean;
    note?: string;
    onforge: (kind: ForgeKind, id: string, materialId: string) => boolean;
    /** A goal opened this panel; select its pattern and material without changing anything else. */
    focus?: { patternKind: ForgeKind; pattern: string; material: string; nonce: number } | null;
    ontrack?: (ref: { kind: 'forge'; patternKind: ForgeKind; pattern: string; material: string }) => void;
    onshortage?: (good: string, want: number, origin: { kind: 'forge'; patternKind: ForgeKind; pattern: string; material: string }) => void;
    onpinzone?: (zone: number) => void;
    onmap?: () => void;
    onbag?: () => void;
  } = $props();

  let kind = $state<ForgeKind>('armour');
  let patternId = $state('helmet');
  let family = $state('metal');
  let materialId = $state('');
  let lastFocus = 0;
  $effect(() => {
    const next = focus;
    if (!next || next.nonce === lastFocus) return;
    lastFocus = next.nonce;
    kind = next.patternKind;
    patternId = next.pattern;
    const selected = forge.patternOf(next.patternKind, next.pattern);
    const families = selected ? forge.familiesFor(selected.kind, selected.id) : [];
    const owner = families.find((id) => forge.materialsFor(id).some((row) => row.id === next.material));
    if (owner) family = owner;
    materialId = next.material;
  });
  const zoneTown = (zone: number) => TOWN.settlements.find((town: any) => town.zone === zone)?.name || `Zone ${zone}`;

  const smithing = $derived(fieldSkillLevel(game, 'smithing'));
  const patterns = $derived(kind === 'armour'
    ? Object.keys(ED.forge.armour).map((id) => forge.patternOf('armour', id)!).filter(Boolean)
    : Object.keys(ED.forge.weapons).map((id) => forge.patternOf('weapon', id)!).filter(Boolean));
  const pattern = $derived(patterns.find((row) => row.id === patternId) || patterns[0]);
  const families = $derived(pattern ? forge.familiesFor(pattern.kind, pattern.id) : []);
  const currentFamily = $derived(families.includes(family) ? family : families[0] || '');
  const materials = $derived(currentFamily ? forge.materialsFor(currentFamily) : []);
  const material = $derived.by(() => {
    if (!pattern) return null;
    const chosen = materials.find((row) => row.id === materialId);
    if (chosen) return chosen;
    return materials.find((row) => canForge(game, pattern.kind, pattern.id, row.id).ok)
      || materials[materials.length - 1]
      || null;
  });
  const resolved = $derived(pattern && material
    ? forge.resolve(pattern.kind, pattern.id, material.id, game.player.level, smithing)
    : null);
  const verdict = $derived(pattern && material
    ? canForge(game, pattern.kind, pattern.id, material.id)
    : { ok: false, why: 'choose a material' });
  const sources = $derived(material ? materialSources(material.id) : []);
  const goalRef = $derived(pattern && material
    ? { kind: 'forge' as const, patternKind: kind, pattern: pattern.id, material: material.id } : null);

  const materialName = (id: string) => fieldwork.materialById[id]?.name || id;
  const owned = (id: string) => game.fieldwork.materials[id] || 0;
  const bandOf = (grade: number) => ED.item_level.spans?.[grade - 1]?.band || '—';
  const missing = $derived(pattern && material ? Math.max(0, pattern.count - owned(material.id)) : 0);

  function pickKind(next: ForgeKind) {
    kind = next;
    patternId = '';
    materialId = '';
  }
</script>

<section class="forge">
  <header class="head">
    <div>
      <h3>Forge</h3>
      <p>Shape gathered materials into a new weapon or armour piece. The material grade sets the item band; the piece rolls like a drop.</p>
    </div>
    <div class="levels">
      <span>Smithing Lv <b>{smithing}</b></span>
      <span>Character Lv <b>{game.player.level}</b></span>
    </div>
  </header>

  {#if note}<p class="note" role="status">{note}</p>{/if}

  <Tabs tabs={KIND_TABS} active={kind} onpick={(id) => pickKind(id as ForgeKind)} label="Forge pattern kind" tabClass="forge-tab" />

  <div class="layout">
    <section class="patterns scroll-pane" aria-label="Forge patterns">
      {#each patterns as row (row.id)}
        <button class="selectable" class:selected={pattern?.id === row.id} onclick={() => { patternId = row.id; materialId = ''; }}>
          <b>{row.name}</b>
          <small>{row.count} material{row.count === 1 ? '' : 's'}</small>
        </button>
      {/each}
    </section>

    <section class="detail" aria-label="Selected pattern">
      {#if pattern}
        <header class="detail-head">
          <h4>{pattern.name}</h4>
          <span>{pattern.count} unit{pattern.count === 1 ? '' : 's'} of one material</span>
        </header>

        {#if families.length > 1}
          <div class="families" role="group" aria-label="Material family">
            {#each families as id (id)}
              <button class="selectable" class:selected={currentFamily === id} onclick={() => { family = id; materialId = ''; }}>
                {ED.forge.families[id]?.name || id}
              </button>
            {/each}
          </div>
        {/if}

        <div class="materials scroll-pane">
          {#each materials as row (row.id)}
            <button class="selectable" class:selected={material?.id === row.id} class:short={owned(row.id) < pattern.count}
              title={sourceLine(row.id) || undefined}
              onclick={() => materialId = row.id}>
              <span><b>{materialName(row.id)}</b><small>{bandOf(row.grade)} grade</small></span>
              <span class="count">{owned(row.id)} / {pattern.count}</span>
            </button>
          {:else}
            <EmptyNote text="No materials of this family yet." tone="dense" />
          {/each}
        </div>

        {#if pattern && material && resolved}
          <div class="plan" role="status">
            <p class:ready={missing === 0}>{missing === 0
              ? 'Materials ready'
              : `Missing ${missing} ${materialName(material.id)}`}</p>
            {#if goalRef}
              <div class="plan-actions">
                <button class="btn btn-quiet" type="button" onclick={() => goalRef && ontrack(goalRef)}>Pin recipe to Journey</button>
                {#if missing > 0}<button class="btn btn-quiet" type="button" onclick={() => goalRef && onshortage(material.id ? `material:${material.id}` : '', pattern.count, goalRef)}>Track the missing</button>{/if}
              </div>
            {/if}
            {#if sources.length}
              <details class="sources" open={missing > 0}>
                <summary>Where to farm</summary>
                <ul>
                  {#each sources as source (`${source.kind}:${source.label}:${source.detail}`)}
                    <li><b>{source.label}</b> <span>{source.detail}</span>
                      {#each source.zones as zone (zone)}
                        <button class="btn btn-flat pin" type="button" onclick={() => onpinzone(zone)} aria-label={`Pin ${zoneTown(zone)} on the map`}>Pin {zoneTown(zone)}</button>
                      {/each}
                    </li>
                  {/each}
                </ul>
              </details>
            {:else if missing > 0}
              <p class="why">No field source is listed. Check the Market workshop or Salvage for this material.</p>
            {/if}
          </div>
        {/if}

        {#if material && resolved && resolved.ok}
          <div class="preview">
            <p class="output"><b>{resolved.frame.name}</b> <span>{resolved.slot}</span></p>
            <dl>
              <div><dt>Band</dt><dd>{resolved.band}</dd></div>
              <div><dt>Item level</dt><dd>{resolved.ilvl}</dd></div>
              <div><dt>Cost</dt><dd>{materialName(material.id)} ×{resolved.count}</dd></div>
              <div><dt>Smithing XP</dt><dd>+{resolved.xp}</dd></div>
            </dl>
            <p class="lines">Line 1 + Bound pair + 2–5 Unbound lines, rolled at this level.</p>
          </div>
        {/if}

        {#if !writer}
          <p class="why" id="forge-refusal" role="status">Read-only: another tab controls progress. Take account control in Save before forging.</p>
        {:else if !verdict.ok && material}
          <p class="why" id="forge-refusal" role="status">{verdict.why}{#if /settlement/.test(verdict.why || '')} <button class="btn btn-flat pin" type="button" onclick={onmap}>Open map</button>{:else if /room in the bag/.test(verdict.why || '')} <button class="btn btn-flat pin" type="button" onclick={onbag}>Open bag</button>{:else if /field activity/.test(verdict.why || '')} Finish travel, Camp recovery or the field action first.{/if}</p>
        {/if}
        <button class="btn btn-gold forge-btn" disabled={!writer || !verdict.ok}
          aria-describedby={!writer || !verdict.ok ? 'forge-refusal' : undefined}
          onclick={() => material && onforge(pattern.kind, pattern.id, material.id)}>
          {writer ? 'Forge' : 'Read-only'}
        </button>
      {/if}
    </section>
  </div>
</section>

<style>
  .forge { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
  .head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  .head > div { display: flex; flex-direction: column; gap: 3px; }
  .head h3 { margin: 0; font-size: var(--font-sm); }
  .head p { margin: 0; color: var(--dim); font-size: var(--font-2xs); max-width: 62ch; }
  .levels { display: flex; gap: 10px; color: var(--dim); font-size: var(--font-2xs); white-space: nowrap; }
  .levels b { color: var(--text); }
  .note { margin: 0; padding: 6px 8px; border: 1px solid var(--line); background: var(--surface-selected); font-size: var(--font-2xs); }
  :global(.forge-tab) { padding: 5px 12px; font-size: var(--font-2xs); }
  .families button, .patterns button, .materials button { text-align: left; }
  .layout { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: 12px; min-height: 0; }
  .patterns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; align-content: start; max-height: 340px; }
  .patterns button { padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; }
  .patterns b { font-size: var(--font-xs); }
  .patterns small { color: var(--dim); font-size: var(--font-3xs); }
  .detail { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .detail-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
  .detail-head h4 { margin: 0; font-size: var(--font-xs); }
  .detail-head span { color: var(--dim); font-size: var(--font-3xs); }
  .families { display: flex; flex-wrap: wrap; gap: 4px; }
  .families button { padding: 4px 8px; font-size: var(--font-3xs); }
  .materials { display: flex; flex-direction: column; gap: 3px; max-height: 300px; }
  .materials button { padding: 5px 8px; display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  .materials b { font-size: var(--font-2xs); }
  .materials small { display: block; color: var(--dim); font-size: var(--font-3xs); }
  .materials .count { color: var(--dim); font-variant-numeric: tabular-nums; font-size: var(--font-2xs); }
  .materials button.short .count { color: var(--hp); }
  .plan { display: flex; flex-direction: column; gap: 2px; }
  .plan > p { margin: 0; color: var(--hp); font-size: var(--font-2xs); }
  .plan > p.ready { color: var(--good); }
  .plan-actions { display: flex; flex-wrap: wrap; gap: 4px; }
  .plan-actions button, .pin { font-size: var(--font-3xs); padding: 0 6px; }
  .sources { color: var(--dim); font-size: var(--font-3xs); }
  .sources summary { color: var(--gold); cursor: pointer; }
  .sources ul { display: grid; gap: 2px; padding: 3px 0 0 14px; margin: 0; }
  .sources li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; line-height: 1.35; }
  .sources b { color: var(--text); }
  .preview { border-top: 1px solid var(--line); padding-top: 7px; display: flex; flex-direction: column; gap: 5px; }
  .output { margin: 0; font-size: var(--font-xs); }
  .output span { color: var(--dim); font-size: var(--font-3xs); text-transform: capitalize; }
  dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 10px; margin: 0; }
  dl div { display: flex; justify-content: space-between; gap: 8px; font-size: var(--font-2xs); }
  dt { color: var(--dim); }
  dd { margin: 0; font-variant-numeric: tabular-nums; }
  .lines { margin: 0; color: var(--dim); font-size: var(--font-3xs); }
  .why { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin: 0; color: var(--hp); font-size: var(--font-2xs); }
  .forge-btn { align-self: flex-start; padding: 6px 16px; }
  @media (max-width: 720px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .patterns { grid-template-columns: repeat(3, minmax(0, 1fr)); max-height: 180px; }
  }
</style>
