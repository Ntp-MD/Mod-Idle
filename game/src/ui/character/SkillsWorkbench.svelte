<script module lang="ts">
  export interface SkillsWorkbenchView {
    tab: string;
    query: string;
    type: string;
    weapon: string;
    equippedOnly: boolean;
    selectedId: string | null;
  }
  export const newSkillsWorkbenchView = (): SkillsWorkbenchView => ({
    tab: 'loadout', query: '', type: 'all', weapon: 'all', equippedOnly: false, selectedId: null,
  });
</script>

<script lang="ts">
  import { E, eng, sm } from '../../engine/client';
  import { skillIcon } from '../../icon';
  import type { GameState } from '@sim/core/types';
  import type { Character } from '@sim/core/player';
  import type { SkillConditions, SkillMode } from '@sim/combat/skills';
  import {
    NO_COND, appliedCurseOf, appliedStatusOf, auraPoolOf, auraResonanceOf, buffRecastCost, condOf,
    describeFold, effectLine, effectsActive, hpReservedPct, ladderOf, modeOf,
    reservedPct, rotationOrder, skillCd, skillEligibilityInState, skillLevel, usableHp, usableMana,
  } from '@sim/combat/skills';
  import { curableRows } from '@sim/combat/curse';
  import { describeSkill, skillWindowEntries } from '@sim/combat/skill-copy';
  import { skillSlotState } from './skill-slot-copy';
  import { WEAPONS, mastery, masteryLabel, masteryLevel, weaponSkillBonusPct } from '@sim/core/mastery';
  import Tabs from '../shared/Tabs.svelte';
  import SkillFxPreview from '../combat/SkillFxPreview.svelte';

  let {
    state: game, character, writable = true, autoSkills = true, note = '',
    onslot, onmove, onmode, oncondition, ontoggle, onaurapool,
    ondisableauras, onswitchpreset, onstorepreset, onbindzone, view = $bindable(newSkillsWorkbenchView()),
  }: {
    state: GameState;
    view?: SkillsWorkbenchView;
    character: Character;
    writable?: boolean;
    autoSkills?: boolean;
    note?: string;
    onslot: (index: number, id: string) => void;
    onmove: (from: number, to: number) => void;
    onmode: (id: string, mode: SkillMode) => void;
    oncondition: (id: string, patch: Partial<SkillConditions>) => void;
    ontoggle: (id: string) => void;
    onaurapool: (id: string, pool: 'hp' | 'mana') => void;
    ondisableauras: () => void;
    onswitchpreset: (index: number) => void;
    onstorepreset: () => void;
    onbindzone: (index: number) => void;
  } = $props();

  let dragFrom = $state<number | null>(null);
  let announcement = $state('');

  const sk = $derived(game.skills);
  const owned = $derived(sm.all().filter((row) => Object.hasOwn(sk.owned, row.id)));
  const selected = $derived(owned.find((row) => row.id === view.selectedId) || owned.find((row) => sk.list.includes(row.id)) || owned[0]);
  const selectedSlot = $derived(selected ? sk.list.indexOf(selected.id) : -1);
  const freeSlot = $derived(sk.list.indexOf(null));
  const selectedIsTrack = $derived(!!selected && ['aura', 'buff'].includes(selected.type || ''));
  const eligibility = $derived(selected && !selectedIsTrack ? skillEligibilityInState(game, character, selected.id, autoSkills) : null);
  const recastCost = $derived(selected?.type === 'buff' ? buffRecastCost(sk, character, selected.id) : null);
  const firstEligible = $derived(rotationOrder(sk).find((id) => skillEligibilityInState(game, character, id, autoSkills).ready));
  const filtered = $derived(owned.filter((row) => {
    const query = view.query.trim().toLowerCase();
    const loaded = sk.list.includes(row.id) || sk.buffs[row.id] || sk.auras[row.id];
    return (!query || `${row.name} ${row.type} ${row.element || ''} ${row.weapon || ''} ${row.effect || ''}`.toLowerCase().includes(query))
      && (view.type === 'all' || row.type === view.type)
      && (view.weapon === 'all' || (view.weapon === 'held' ? sm.weaponFits(row, character.weaponName) : row.weapon === view.weapon))
      && (!view.equippedOnly || loaded);
  }));
  const weaponFilters = $derived([...new Set(owned.map((row) => row.weapon).filter(Boolean))]);
  const manaShare = $derived(reservedPct(sk, character.keystones));
  const hpShare = $derived(hpReservedPct(sk, character.keystones));
  const resonance = $derived(auraResonanceOf(sk, character.keystones));
  const hasBloodCovenant = $derived(character.keystones.some((bundle) => bundle.key === 'blood-covenant'));
  const activePreset = $derived(game.presets[game.activePreset]);
  const currentZone = $derived(eng.zoneById(game.zone)?.name || `Zone ${game.zone}`);
  const selectedCondition = $derived(selected ? condOf(sk, selected.id) : NO_COND);
  const selectedStatus = $derived(appliedStatusOf(selected));
  const selectedCurse = $derived(appliedCurseOf(selected));
  const exploitedStatus = $derived(sm.exploitedStatusOf(selected));
  const selectedReservation = $derived.by(() => {
    if (!selected || selected.type !== 'aura') return null;
    const preview = { ...sk, auras: { ...sk.auras, [selected.id]: !sk.auras[selected.id] } };
    return { mana: reservedPct(preview, character.keystones), hp: hpReservedPct(preview, character.keystones) };
  });
  const skillWindow = $derived(selected ? describeSkill(selected, { level: skillLevel(sk, selected.id) }) : null);
  const defaults = sm.SKILLS.meta.cast_conditions;
  const format = (value: number) => Math.round(value).toLocaleString();
  const zoneNames = (zones: number[]) => zones.map((id) => eng.zoneById(id)?.name || `Zone ${id}`).join(', ');
  const valueFrom = (event: Event, max = Infinity) => Math.min(max, Math.max(0, Math.floor(Number((event.currentTarget as HTMLInputElement).value) || 0)));

  function relationship(row: any): string {
    const applied = appliedStatusOf(row);
    const exploit = sm.exploitedStatusOf(row);
    const consumed = (row.effects || []).find((effect: any) => effect.stat === 'consume_status');
    return [applied ? `Applies ${applied}` : '', exploit ? `${consumed ? 'Consumes' : 'Benefits from'} ${exploit}` : ''].filter(Boolean).join(' · ');
  }

  function conditionsText(id: string): string {
    const cond = condOf(sk, id);
    const row = sm.byId[id];
    const applied = appliedStatusOf(row) || appliedCurseOf(row);
    const exploit = sm.exploitedStatusOf(row);
    const triggers = [
      cond.boss ? 'a Boss or Unique target' : '',
      cond.hpBelowPct > 0 ? `at least ${cond.hpBelowPct}% HP missing` : '',
      cond.minTargets > 0 ? `${cond.minTargets}+ targets` : '',
      applied && cond.statusMissing.includes(applied) ? `${appliedStatusOf(row) || row.name} missing from target` : '',
      cond.statusPresent && exploit ? `${exploit} present${cond.statusStacksAtLeast > 0 ? ` with ${cond.statusStacksAtLeast}+ stacks` : ''}` : '',
      cond.selfDebuffed ? 'a status on you' : '',
    ].filter(Boolean);
    return triggers.length ? triggers.join(' OR ') : 'No trigger enabled; this conditional skill will wait.';
  }

  function move(from: number, to: number) {
    if (!writable || from === to || to < 0 || to >= sk.list.length) return;
    const name = sm.byId[sk.list[from] || '']?.name || 'Empty slot';
    onmove(from, to);
    announcement = `${name} moved to slot ${to + 1}.`;
  }

  function drop(event: DragEvent, to: number) {
    event.preventDefault();
    if (dragFrom !== null) move(dragFrom, to);
    dragFrom = null;
  }

  function addSelected() {
    if (!selected || freeSlot < 0 || !writable) return;
    onslot(freeSlot, selected.id);
    announcement = `${selected.name} added to slot ${freeSlot + 1}.`;
  }

  function copyConditions() {
    if (!selected || !writable) return;
    for (const id of sk.list) if (id && modeOf(sk, id) === 'conditional') oncondition(id, { ...selectedCondition, statusMissing: [...selectedCondition.statusMissing] });
    announcement = 'Conditions copied to every conditional skill. Unsupported status triggers are omitted.';
  }
</script>

<div class="skill-workbench">
  <Tabs label="Skill sections" active={view.tab} onpick={(id) => view.tab = id}
    tabs={[{ id: 'loadout', label: 'Loadout & collection' }, { id: 'effects', label: 'Buffs & auras' }, { id: 'mastery', label: 'Mastery & curses' }]} />
  {#if note}<p class="notice" role="status">{note}</p>{/if}
  {#if !writable}<p class="notice">Read-only session. Take over saving to change this loadout.</p>{/if}
  <p class="sr-only" role="status" aria-live="polite">{announcement}</p>

  {#if view.tab !== 'mastery'}
    <div class="preset-bar">
      <span class="preset-heading">Loadout</span>
      {#each game.presets as preset, index}
        <button class:active={game.activePreset === index} aria-pressed={game.activePreset === index}
          title={preset.zones.length ? `Automatically selected in ${zoneNames(preset.zones)}` : 'No zone binding'}
          disabled={!writable} onclick={() => onswitchpreset(index)}>{preset.name}</button>
      {/each}
      <button class="preset-save" disabled={!writable} onclick={onstorepreset}>Store current</button>
      <button disabled={!writable} onclick={() => onbindzone(game.activePreset)}>
        {activePreset.zones.includes(game.zone) ? 'Unbind' : 'Bind'} {currentZone}
      </button>
    </div>
    <p class="preset-context"><strong>{activePreset.name}</strong> · {activePreset.zones.length ? `Auto-select in ${zoneNames(activePreset.zones)}` : 'No zones bound; the current loadout stays active.'} <span>Switching stores the outgoing loadout. Skill XP and cooldowns are shared.</span></p>

    <div class="workspace" class:effects={view.tab === 'effects'}>
      <section class="collection" aria-label="Owned skill collection">
        <header class="column-head"><h3>Your collection</h3><span>{filtered.length} / {owned.length}</span></header>
        <label class="search"><span class="sr-only">Search owned skills</span><input type="search" bind:value={view.query} placeholder="Search skills, status, weapon…" /></label>
        <div class="filters">
          <label><span class="sr-only">Filter skill type</span><select bind:value={view.type} aria-label="Filter skill type"><option value="all">All types</option>{#each ['attack', 'curse', 'heal', 'buff', 'aura'] as kind}<option value={kind}>{kind[0].toUpperCase() + kind.slice(1)}</option>{/each}</select></label>
          <label><span class="sr-only">Filter weapon</span><select bind:value={view.weapon} aria-label="Filter weapon"><option value="all">All weapons</option><option value="held">Fits held weapon</option>{#each weaponFilters as group}<option value={group}>{group}</option>{/each}</select></label>
        </div>
        <label class="loaded-filter"><input type="checkbox" bind:checked={view.equippedOnly} /> In this loadout</label>
        <div class="collection-list">
          {#each filtered as row (row.id)}
            {@const loaded = sk.list.includes(row.id) || sk.buffs[row.id] || sk.auras[row.id]}
            <button class="collection-item" class:selected={selected?.id === row.id} aria-pressed={selected?.id === row.id} onclick={() => view.selectedId = row.id}>
              <span class="skill-art icon-mask" style:--glyph={`url("${skillIcon(row.id, row.type)}")`} aria-hidden="true"></span>
              <span><strong>{row.name}</strong><small>{row.type} · Lv {skillLevel(sk, row.id)}{loaded ? ' · In loadout' : ''}</small><small class="compact">{describeSkill(row).compact}</small>{#if relationship(row)}<small class="relationship">{relationship(row)}</small>{/if}</span>
            </button>
          {:else}<p class="empty">{owned.length ? 'No skills match these filters. Clear the search or choose another filter.' : 'Your first skill drops from a Boss. New timed skills join an empty slot automatically.'}</p>{/each}
        </div>
      </section>

      {#if view.tab === 'loadout'}
        <section class="rotation" aria-label="Ordered cast list">
          <header class="column-head"><h3>Cast order</h3><span>{sk.list.filter(Boolean).length} / {sk.list.length} slots</span></header>
          <p class="column-note">Timed skills go top-down. Zero-cooldown fillers are checked last.</p>
          {#if !autoSkills}<p class="notice">Auto Skills is off. This order is retained until you turn it on.</p>{/if}
          <ol class="rotation-list">
            {#each sk.list as id, index}
              {@const row = sm.byId[id || '']}
              {@const ready = id ? skillEligibilityInState(game, character, id, autoSkills) : null}
              <li class:selected={!!id && selected?.id === id} class:next={!!id && firstEligible === id}>
                <span class="slot-index">{index + 1}</span>
                <button class="slot-select" draggable={!!id && writable} ondragstart={() => dragFrom = index} ondragend={() => dragFrom = null}
                  ondragover={(event) => { if (dragFrom !== null) event.preventDefault(); }} ondrop={(event) => drop(event, index)}
                  title={row ? describeSkill(row).compact : undefined}
                  onclick={() => { if (id) view.selectedId = id; }} aria-label={row ? `Inspect slot ${index + 1}: ${row.name}` : `Empty slot ${index + 1}. Add a skill from its inspector.`}>
                  {#if row && id && ready}
                    <span class="skill-art icon-mask" style:--glyph={`url("${skillIcon(id, row.type)}")`} aria-hidden="true"></span>
                    <span class="slot-copy"><strong>{row.name}{#if row.cd === 0}<em>Filler</em>{/if}</strong><small class:ready={ready.ready} title={ready.detail}>{firstEligible === id ? 'First eligible' : skillSlotState(ready.label, game.skills.cd[id] ?? 0, ready.ready)} · {ready.hpCost > 0 ? `${format(ready.hpCost)} HP` : `${format(ready.manaCost)} Mana`}{ready.hpCost > 0 && ready.manaCost > 0 ? ` + ${format(ready.manaCost)} Mana` : ''} · {skillCd(sk, id, character.cdr).toFixed(1)}s CD</small></span>
                  {:else}<span class="empty-slot">Empty slot</span>{/if}
                </button>
                <div class="move-buttons"><button aria-label={`Move slot ${index + 1} up`} title="Move up" disabled={!writable || index === 0} onclick={() => move(index, index - 1)}>Up</button><button aria-label={`Move slot ${index + 1} down`} title="Move down" disabled={!writable || index === sk.list.length - 1} onclick={() => move(index, index + 1)}>Down</button></div>
              </li>
            {/each}
          </ol>
        </section>
      {:else}
        <section class="effects-track" aria-label="Buff and aura toggles">
          <header class="column-head"><h3>Reservation & tracks</h3><span>No active slots</span></header>
          <div class="pool-summary">
            <div class="pool-label"><strong>Mana</strong><span>{format(usableMana(character, sk))} usable / {format(character.maxMana)} max</span></div>
            <div class="reservation-bar mana" role="img" aria-label={`${manaShare.toFixed(1)}% Mana reserved`}><span class="usable" style:width={`${Math.max(0, 100 - manaShare)}%`}></span><span class="reserved" style:width={`${Math.min(100, manaShare)}%`}></span></div>
            <small>{manaShare.toFixed(1)}% reserved · {format(character.maxMana - usableMana(character, sk))} Mana held</small>
            {#if hpShare > 0 || hasBloodCovenant}
              <div class="pool-label"><strong>HP</strong><span>{format(usableHp(character, sk))} usable / {format(character.maxHp)} max</span></div>
              <div class="reservation-bar hp" role="img" aria-label={`${hpShare.toFixed(1)}% HP reserved`}><span class="usable" style:width={`${Math.max(0, 100 - hpShare)}%`}></span><span class="reserved" style:width={`${Math.min(100, hpShare)}%`}></span></div>
              <small>{hpShare.toFixed(1)}% reserved</small>
            {/if}
          </div>
          <p class="column-note">Reserved Mana stays in the pool and cannot be spent. Auras must leave some Mana usable.</p>
          {#if character.keystones.some((bundle) => bundle.key === 'aura-resonance')}<p class="column-note">Aura Resonance · {resonance.count} active · −{(resonance.bR * 100).toFixed(1)}% reservation · +{(resonance.bE * 100).toFixed(1)}% effect</p>{/if}
          <h4>Buffs · repeat when their window ends</h4>
          {#each owned.filter((row) => row.type === 'buff') as row}
            <div class="track-row"><button class:selected={selected?.id === row.id} onclick={() => view.selectedId = row.id}><span class="skill-art icon-mask" style:--glyph={`url("${skillIcon(row.id, row.type)}")`} aria-hidden="true"></span><span><strong>{row.name}</strong><small>{sk.buffUp[row.id] > 0 ? `${sk.buffUp[row.id].toFixed(1)}s active` : sk.cd[row.id] > 0 ? `${sk.cd[row.id].toFixed(1)}s cooldown` : 'Window down'}</small></span></button><label><input type="checkbox" checked={!!sk.buffs[row.id]} disabled={!writable} onchange={() => ontoggle(row.id)} /> On</label></div>
          {:else}<p class="empty">No buffs owned.</p>{/each}
          <h4>Auras · stay on and reserve a pool</h4>
          {#each owned.filter((row) => row.type === 'aura') as row}
            <div class="track-row"><button class:selected={selected?.id === row.id} onclick={() => view.selectedId = row.id}><span class="skill-art icon-mask" style:--glyph={`url("${skillIcon(row.id, row.type)}")`} aria-hidden="true"></span><span><strong>{row.name}</strong><small>{row.reserve} · {auraPoolOf(sk, row.id) === 'hp' ? 'HP' : 'Mana'}</small></span></button><label><input type="checkbox" checked={!!sk.auras[row.id]} disabled={!writable} onchange={() => ontoggle(row.id)} /> On</label></div>
          {:else}<p class="empty">No auras owned.</p>{/each}
          <button class="all-off" disabled={!writable || !owned.some((row) => sk.auras[row.id])} onclick={ondisableauras}>Turn all auras off</button>
          <details><summary>Combined active effects</summary><p>{describeFold(effectsActive(sk, character.keystones)) || 'No active effects.'}</p></details>
        </section>
      {/if}

      <aside class="inspector" aria-label="Selected skill inspector">
        {#if selected}
          <header class="selected-heading"><span class="skill-art icon-mask" style:--glyph={`url("${skillIcon(selected.id, selected.type)}")`} aria-hidden="true"></span><div><h3>{selected.name}</h3><p>{skillWindow?.type ?? selected.type} · Level: {skillLevel(sk, selected.id)} / {E.skill_xp.level_cap}</p></div></header>
          {#key selected.id}<SkillFxPreview id={selected.id} />{/key}
          {#if selectedIsTrack}
            <p class="live-state">{selected.type === 'aura' ? (sk.auras[selected.id] ? 'Aura enabled' : 'Aura off') : sk.buffs[selected.id] ? 'Buff track enabled' : 'Buff track off'}</p>
          {:else if eligibility}
            <p class="live-state" class:ready={eligibility.ready}>{skillSlotState(eligibility.label, game.skills.cd[selected.id] ?? 0, eligibility.ready)}</p><p class="reason">{eligibility.detail}</p>
            {#if selectedSlot < 0}<p class="reason">Not in the cast order.</p>{/if}
          {/if}
          <dl class="skill-facts skill-window">
            {#each (skillWindow ? skillWindowEntries(skillWindow) : []) as entry}
              <div><dt>{entry.label}</dt><dd>{entry.value}</dd></div>
            {/each}
            <div class="description"><dt>Description</dt><dd>{selected.effect || effectLine(selected)}</dd></div>
          </dl>
          {#if relationship(selected)}<p class="relationship">{relationship(selected)}</p>{/if}
          <dl class="skill-facts skill-progress"><div><dt>Effective cooldown</dt><dd>{skillCd(sk, selected.id, character.cdr).toFixed(2)}s</dd></div><div><dt>Copies</dt><dd>{sk.owned[selected.id] + 1} · {sk.owned[selected.id]} duplicates</dd></div><div><dt>Duplicate ladder</dt><dd>−{ladderOf(sk, selected.id)}% cooldown</dd></div><div><dt>Skill XP</dt><dd>{format(sk.xp[selected.id] || 0)}</dd></div></dl>
          {#if selectedIsTrack}
            <button class="primary-action" disabled={!writable} onclick={() => ontoggle(selected.id)}>{(selected.type === 'aura' ? sk.auras : sk.buffs)[selected.id] ? 'Turn off' : 'Enable'} {selected.name}</button>
            {#if selected.type === 'aura'}
              {#if hasBloodCovenant}<label class="field-label">Reservation pool<select aria-label={`${selected.name} reservation pool`} value={auraPoolOf(sk, selected.id)} disabled={!writable} onchange={(event) => onaurapool(selected.id, event.currentTarget.value === 'hp' ? 'hp' : 'mana')}><option value="mana">Mana</option><option value="hp">HP</option></select></label>{/if}
              {#if selectedReservation}<p class="reservation-preview">With this aura {sk.auras[selected.id] ? 'off' : 'on'}: <strong>{selectedReservation.mana.toFixed(1)}% Mana</strong>{selectedReservation.hp > 0 ? ` · ${selectedReservation.hp.toFixed(1)}% HP` : ''} reserved.{selectedReservation.mana >= sm.RESERVATION_LIMIT ? ' This set would reserve the whole Mana pool and cannot be enabled.' : ''}</p>{/if}
            {:else if recastCost}<p class="reason">{selected.duration}s duration · {format(recastCost.amount)} {recastCost.resource === 'hp' ? 'HP' : 'Mana'} per recast. Buffs use their own track and repeat when ready.</p>{/if}
            <button class="secondary-action" onclick={() => view.tab = 'effects'}>View reservation & tracks</button>
          {:else}
            {#if selectedSlot >= 0}<button class="secondary-action" disabled={!writable} onclick={() => onslot(selectedSlot, '')}>Remove from slot {selectedSlot + 1}</button>{:else}<button class="primary-action" disabled={!writable || freeSlot < 0} title={freeSlot < 0 ? 'Remove a skill to open a slot.' : 'Add to the first empty slot.'} onclick={addSelected}>{freeSlot < 0 ? 'Loadout full' : `Add to slot ${freeSlot + 1}`}</button>{/if}
            <label class="field-label">Cast mode<select value={modeOf(sk, selected.id)} disabled={!writable} onchange={(event) => onmode(selected.id, event.currentTarget.value as SkillMode)}><option value="always">Always · cast when eligible</option><option value="conditional">Conditional · use triggers below</option><option value="never">Never · silence this skill</option></select></label>
            {#if modeOf(sk, selected.id) === 'conditional'}
              <fieldset disabled={!writable} class="conditions"><legend>Cast when any trigger holds</legend><p class="condition-sentence">{conditionsText(selected.id)}</p>
                <label><input type="checkbox" checked={selectedCondition.boss} onchange={(event) => oncondition(selected.id, { boss: event.currentTarget.checked })} /> Target is Boss or Unique</label>
                <div class="condition-number"><label><input type="checkbox" checked={selectedCondition.hpBelowPct > 0} onchange={(event) => oncondition(selected.id, { hpBelowPct: event.currentTarget.checked ? defaults.hp_below_pct_default : 0 })} /> HP missing ≥</label><input aria-label="HP missing percent trigger" type="number" min="0" max="100" value={selectedCondition.hpBelowPct} onchange={(event) => oncondition(selected.id, { hpBelowPct: valueFrom(event, 100) })} /><span>%</span></div>
                <div class="condition-number"><label><input type="checkbox" checked={selectedCondition.minTargets > 0} onchange={(event) => oncondition(selected.id, { minTargets: event.currentTarget.checked ? defaults.min_targets_default : 0 })} /> Group size ≥</label><input aria-label="Minimum targets trigger" type="number" min="0" value={selectedCondition.minTargets} onchange={(event) => oncondition(selected.id, { minTargets: valueFrom(event) })} /><span>targets</span></div>
                {#if selectedStatus || selectedCurse}{@const flag = selectedStatus || selectedCurse!}<label><input type="checkbox" checked={selectedCondition.statusMissing.includes(flag)} onchange={(event) => oncondition(selected.id, { statusMissing: event.currentTarget.checked ? [flag] : [] })} /> Target lacks {selectedStatus || selected.name}</label>{/if}
                {#if exploitedStatus}<label><input type="checkbox" checked={selectedCondition.statusPresent} onchange={(event) => oncondition(selected.id, { statusPresent: event.currentTarget.checked })} /> Target has {exploitedStatus}</label><div class="condition-number"><label for="payoff-stack-count">Minimum stacks</label><input id="payoff-stack-count" type="number" min="0" value={selectedCondition.statusStacksAtLeast} disabled={!selectedCondition.statusPresent || !writable} onchange={(event) => oncondition(selected.id, { statusStacksAtLeast: valueFrom(event) })} /><span>0 = any</span></div>{/if}
                <label><input type="checkbox" checked={selectedCondition.selfDebuffed} onchange={(event) => oncondition(selected.id, { selfDebuffed: event.currentTarget.checked })} /> You carry a status</label>
              </fieldset>
              <fieldset disabled={!writable} class="conditions floor"><legend>Always respect this restraint</legend><div class="condition-number"><label><input type="checkbox" checked={selectedCondition.manaFloorPct > 0} onchange={(event) => oncondition(selected.id, { manaFloorPct: event.currentTarget.checked ? defaults.mana_floor_pct_default : 0 })} /> Keep usable Mana ≥</label><input aria-label="Usable Mana floor percent" type="number" min="0" max="100" value={selectedCondition.manaFloorPct} onchange={(event) => oncondition(selected.id, { manaFloorPct: valueFrom(event, 100) })} /><span>%</span></div><p>The floor can hold a cast back. It never activates one of the triggers.</p></fieldset>
              <div class="condition-actions"><button disabled={!writable} onclick={copyConditions}>Copy to conditional skills</button><button disabled={!writable} onclick={() => oncondition(selected.id, { ...NO_COND, statusMissing: [] })}>Clear triggers & floor</button></div>
            {/if}
          {/if}
        {:else}<h3>Skill details</h3><p class="empty">Select an owned skill to inspect its effects, resources and conditions.</p>{/if}
      </aside>
    </div>
  {:else}
    <div class="mastery-view">
      <h3>Weapon mastery</h3><p>Only the held weapon earns XP · {mastery.M.xp_per_kill} per kill. Matching skills receive the full bonus; other skills receive half.</p>
      <table><thead><tr><th>Weapon</th><th>Mastery</th><th>Matching-skill bonus</th></tr></thead><tbody>{#each WEAPONS as row}{@const level = masteryLevel(game, row.name)}<tr class:held={character.weaponName === row.name}><td>{row.name}{character.weaponName === row.name ? ' · Held' : ''}</td><td>{masteryLabel(level)}</td><td>{weaponSkillBonusPct(level) > 0 ? `+${weaponSkillBonusPct(level).toFixed(1)}%` : '—'}</td></tr>{/each}</tbody></table>
      <h3>Curable curses</h3><p>Target-side effects a curse skill can place on a mob.</p><ul>{#each curableRows() as row}<li><strong>{row.name}</strong> · {effectLine(row) || row.effect}</li>{:else}<li>No curable curses.</li>{/each}</ul>
    </div>
  {/if}
</div>

<style>
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; border: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .skill-workbench { height: 100%; max-height: calc(100dvh - 4 * var(--spacing-xl)); min-height: 0; display: flex; flex-direction: column; gap: var(--spacing-sm); overflow: hidden; color: var(--text); }
  .skill-workbench :global(button:focus-visible), .skill-workbench :global(input:focus-visible), .skill-workbench :global(select:focus-visible), .skill-workbench :global(summary:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }
  .skill-workbench :global(button) { font-size: var(--font-2xs); }
  .skill-workbench :global(input), .skill-workbench :global(select) { font-size: var(--font-2xs); min-width: 0; }
  .skill-workbench :global(h3) { margin: 0; font-size: var(--font-sm); color: var(--sheet-place); }
  .skill-workbench :global(small) { color: var(--dim); font-size: var(--font-2xs); }
  .skill-workbench :global(button:disabled) { cursor: default; }
  .skill-workbench :global(p) { margin: 0; }
  .preset-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs); }
  .preset-heading { color: var(--gold); font-size: var(--font-2xs); padding-right: var(--spacing-xs); }
  .preset-bar .active { color: var(--gold-lit); border-color: var(--gold); background: var(--surface-selected); }
  .preset-save { margin-left: auto; }
  .preset-context { color: var(--dim); font-size: var(--font-2xs); line-height: 1.6; padding-bottom: var(--spacing-xs); }
  .preset-context strong { color: var(--text); }
  .preset-context span { display: block; }
  .workspace { min-height: 0; flex: 1; display: grid; grid-template-columns: minmax(210px, .78fr) minmax(310px, 1.12fr) minmax(320px, 1fr); grid-template-rows: minmax(0, 1fr); border-top: 1px solid var(--hud-edge); overflow: hidden; }
  .collection, .rotation, .effects-track, .inspector { min-width: 0; min-height: 0; padding: var(--card-pad); display: flex; flex-direction: column; gap: var(--card-gap); overflow-y: auto; scrollbar-color: var(--line) var(--inset); }
  .collection > *, .rotation > *, .effects-track > *, .inspector > * { flex-shrink: 0; }
  .collection { padding-left: 0; }
  .inspector { background: color-mix(in srgb, var(--ground-3) 48%, var(--inset)); border-left: 1px solid var(--line); }
  .rotation, .effects-track { border-left: 1px solid var(--line); }
  .column-head { display: flex; justify-content: space-between; gap: var(--spacing-sm); align-items: baseline; }
  .column-head > span { color: var(--dim); font-size: var(--font-2xs); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .search, .search input { width: 100%; display: block; box-sizing: border-box; }
  .filters { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-xs); }
  .filters select { width: 100%; }
  .loaded-filter { display: flex; align-items: center; gap: var(--spacing-xs); color: var(--dim); font-size: var(--font-2xs); }
  .collection-list { display: flex; flex-direction: column; gap: 1px; }
  .collection-item { display: flex; gap: var(--spacing-sm); align-items: center; width: 100%; text-align: left; border: 1px solid transparent; background: transparent; padding: var(--spacing-sm) var(--spacing-xs); border-radius: 2px; }
  .collection-item > span:last-child { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .collection-item strong, .slot-copy strong, .track-row strong { font-size: var(--font-xs); font-weight: 600; overflow-wrap: anywhere; }
  .collection-item:hover, .slot-select:hover, .track-row button:hover { background: color-mix(in srgb, var(--gold) 6%, var(--ground)); }
  .collection-item.selected { border-color: var(--hud-edge); background: var(--surface-selected); }
  .skill-art { width: 30px; height: 30px; color: var(--gold-lit); flex: none; }
  .column-note { font-size: var(--font-2xs); color: var(--dim); line-height: 1.6; }
  .rotation-list { list-style: none; margin: 0; padding: 0; }
  .rotation-list li { display: grid; grid-template-columns: 20px minmax(0, 1fr) 42px; align-items: center; border-top: 1px solid var(--line); min-height: 56px; gap: var(--spacing-xs); padding: 3px 0; }
  .rotation-list li.selected { background: var(--surface-selected); }
  .rotation-list li.next .slot-index { color: var(--gold-lit); }
  .slot-index { color: var(--dim); font-family: var(--num); font-size: var(--font-2xs); text-align: center; }
  .slot-select { display: flex; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-xs); background: transparent; border: 0; border-radius: 2px; text-align: left; min-width: 0; }
  .slot-select[draggable='true'] { cursor: grab; }
  .slot-select[draggable='true']:active { cursor: grabbing; }
  .slot-copy { display: flex; flex-direction: column; min-width: 0; gap: 4px; }
  .slot-copy strong { display: flex; gap: var(--spacing-xs); align-items: center; }
  .slot-copy em { font-style: normal; color: var(--gold); font-size: var(--font-3xs); border: 1px solid var(--hud-edge); padding: 1px 3px; }
  .slot-copy small { line-height: 1.4; }
  .slot-copy small.ready { color: var(--good-lit); }
  .move-buttons { display: flex; flex-direction: column; gap: 2px; }
  .move-buttons button { font-size: var(--font-3xs); padding: 2px; background: transparent; border-color: transparent; }
  .empty-slot { color: var(--dim); font-size: var(--font-2xs); }
  .selected-heading { display: flex; gap: var(--spacing-sm); align-items: center; }
  .selected-heading > div { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .selected-heading .skill-art { width: 46px; height: 46px; }
  .selected-heading p { font-size: var(--font-2xs); color: var(--dim); }
  .live-state { color: var(--gold-lit); font-weight: 600; font-size: var(--font-xs); }
  .live-state.ready { color: var(--good-lit); }
  .reason { color: var(--sheet-ink); font-size: var(--font-2xs); line-height: 1.6; overflow-wrap: anywhere; }
  .collection-item .compact { color: var(--dim); }
  .skill-window .description dd { color: var(--sheet-ink); line-height: 1.6; }
  .relationship { color: var(--mana-lit) !important; font-size: var(--font-2xs); line-height: 1.5; }
  .skill-facts { margin: 0; font-size: var(--font-2xs); }
  .skill-facts > div { display: flex; flex-wrap: wrap; gap: var(--spacing-xs) var(--spacing-sm); justify-content: space-between; border-bottom: 1px solid var(--line); padding: var(--spacing-xs) 0; }
  .skill-facts dt { color: var(--dim); }
  .skill-facts dd { margin: 0; font-variant-numeric: tabular-nums; }
  .primary-action, .secondary-action { width: 100%; }
  .primary-action { border-color: var(--gold); color: var(--gold-lit); background: var(--surface-selected); }
  .field-label { display: flex; flex-direction: column; gap: var(--spacing-xs); font-size: var(--font-2xs); color: var(--sheet-ink); }
  .conditions { margin: 0; padding: var(--spacing-sm) 0; border: 0; border-top: 1px solid var(--hud-edge); display: flex; flex-direction: column; gap: var(--spacing-sm); }
  .conditions legend { color: var(--gold); font-size: var(--font-2xs); padding-right: var(--spacing-xs); }
  .conditions label { display: flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-2xs); color: var(--sheet-ink); }
  .condition-number { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs); }
  .condition-number input[type='number'] { width: 58px; padding: 4px; }
  .condition-number > span { font-size: var(--font-2xs); color: var(--dim); }
  .condition-sentence, .floor p, .reservation-preview { font-size: var(--font-2xs); line-height: 1.6; color: var(--sheet-ink); }
  .condition-sentence { background: var(--ground); padding: var(--spacing-sm); }
  .condition-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
  .condition-actions button { flex: 1; }
  .notice { font-size: var(--font-2xs); line-height: 1.5; color: var(--gold-lit); padding: var(--spacing-xs) 0; }
  .empty { color: var(--dim); font-size: var(--font-2xs); line-height: 1.7; padding: var(--spacing-sm) 0; }
  .pool-summary { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .pool-label { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: var(--spacing-xs); font-size: var(--font-2xs); }
  .pool-label > span { color: var(--sheet-ink); font-variant-numeric: tabular-nums; }
  .reservation-bar { height: 12px; display: flex; background: var(--ground); overflow: hidden; border: 1px solid var(--line); }
  .reservation-bar .usable { background: var(--mana); }
  .reservation-bar.hp .usable { background: var(--hp); }
  .reservation-bar .reserved { background: var(--bar-2); }
  .effects-track h4 { color: var(--sheet-place); font-size: var(--font-xs); margin: 0; }
  .track-row { display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-sm); border-top: 1px solid var(--line); }
  .track-row button { display: flex; min-width: 0; flex: 1; align-items: center; gap: var(--spacing-sm); background: transparent; border: 1px solid transparent; text-align: left; padding: var(--spacing-sm) var(--spacing-xs); }
  .track-row button.selected { border-color: var(--hud-edge); background: var(--surface-selected); }
  .track-row button > span:last-child { display: flex; flex-direction: column; gap: 3px; }
  .track-row > label { display: flex; align-items: center; font-size: var(--font-2xs); gap: 4px; white-space: nowrap; }
  .effects-track details { font-size: var(--font-2xs); line-height: 1.6; color: var(--dim); }
  .effects-track summary { cursor: pointer; color: var(--text); }
  .mastery-view { min-height: 0; overflow: auto; line-height: 1.7; display: flex; flex-direction: column; gap: var(--spacing-md); }
  .mastery-view p, .mastery-view li { font-size: var(--font-2xs); color: var(--sheet-ink); }
  .mastery-view table { width: 100%; font-size: var(--font-2xs); }
  .mastery-view ul { margin: 0; padding-left: var(--spacing-lg); }
  .mastery-view .held { color: var(--gold-lit); background: var(--surface-selected); }
</style>
