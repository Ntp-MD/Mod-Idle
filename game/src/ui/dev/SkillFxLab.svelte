<script lang="ts">
  import { sm } from '../../engine/client';
  import { skillIcon } from '../../icon';
  import { effectLine } from '../../sim/combat/skills';
  import { describeSkill, skillWindowEntries } from '../../sim/combat/skill-copy';
  import SkillFxPreview from '../combat/SkillFxPreview.svelte';

  const TYPES = ['all', 'attack', 'curse', 'heal', 'buff', 'aura'] as const;
  const skills = sm.all().filter((skill: any) => !skill.retired)
    .slice().sort((a: any, b: any) => (a.type || '').localeCompare(b.type || '') || a.name.localeCompare(b.name));
  let query = $state('');
  let type = $state<(typeof TYPES)[number]>('all');
  const requestedSkill = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('skill');
  let selectedId = $state(requestedSkill && sm.byId[requestedSkill] ? requestedSkill : 'attack.firestorm');

  const filtered = $derived(skills.filter((skill: any) => {
    if (type !== 'all' && skill.type !== type) return false;
    const q = query.trim().toLowerCase();
    return !q || `${skill.id} ${skill.name} ${skill.type} ${skill.element || ''} ${skill.effect || ''}`.toLowerCase().includes(q);
  }));
  const selected = $derived(sm.byId[selectedId] ?? skills[0]);
  const skillWindow = $derived(selected ? describeSkill(selected) : null);
  const colour = $derived(selected?.element || 'physical');
</script>

<div class="skill-fx-lab">
  <header class="lab-head">
    <div>
      <p class="eyebrow">Skill FX</p>
      <h2>Effect lab</h2>
      <p class="lead">Every active skill, with its authored cast, projectile and impact. Select a skill to replay its assembled effect.</p>
    </div>
    <span class="count">{filtered.length} / {skills.length}</span>
  </header>

  <div class="lab-body">
    <section class="skills-pane" aria-label="Skill catalogue">
      <label class="search"><span class="sr-only">Filter skills</span><input type="search" bind:value={query} placeholder="Filter by name, type, Element or effect…" /></label>
      <div class="chips" role="group" aria-label="Filter by skill type">
        {#each TYPES as kind}
          <button type="button" class:on={type === kind} aria-pressed={type === kind} onclick={() => type = kind}>
            {kind === 'all' ? 'All' : kind[0].toUpperCase() + kind.slice(1)}
          </button>
        {/each}
      </div>
      <div class="rows">
        {#each filtered as skill (skill.id)}
          <button type="button" class="skill-row" class:on={selected?.id === skill.id} aria-pressed={selected?.id === skill.id} onclick={() => selectedId = skill.id}>
            <span class="skill-art icon-mask" style:--glyph={`url("${skillIcon(skill.id, skill.type)}")`} aria-hidden="true"></span>
            <span class="skill-copy"><b>{skill.name}</b><small>{skill.type}{skill.element ? ` · ${skill.element}` : ''}</small></span>
          </button>
        {:else}
          <p class="empty">No skill matches this filter.</p>
        {/each}
      </div>
    </section>

    <section class="stage" aria-live="polite" aria-label="Selected skill effect">
      {#if selected}
        <header class="stage-head">
          <div><p class="eyebrow">{selected.type} · {colour}</p><h3>{selected.name}</h3></div>
          <span class="id">{selected.id}</span>
        </header>
        {#key selected.id}<SkillFxPreview id={selected.id} height={380} inspect={true} />{/key}
        <dl class="facts">
          {#each (skillWindow ? skillWindowEntries(skillWindow) : []) as entry}
            <div><dt>{entry.label}</dt><dd>{entry.value}</dd></div>
          {/each}
        </dl>
        <p class="effect"><span class="effect-label">Description</span> {selected.effect || effectLine(selected) || 'No effect line.'}</p>
      {/if}
    </section>
  </div>
</div>

<style>
  .skill-fx-lab { display: grid; gap: var(--spacing-lg); width: 100%; padding: var(--spacing-lg); color: var(--text); }
  .lab-head { display: flex; align-items: end; justify-content: space-between; gap: var(--spacing-lg); padding-bottom: var(--spacing-sm); border-bottom: 1px solid var(--line); }
  .eyebrow { color: var(--gold); font-size: var(--font-3xs); letter-spacing: .18em; text-transform: uppercase; }
  h2 { font-family: var(--wiki-display); font-size: clamp(1.6rem, 2.4vw, 2.4rem); font-weight: 500; }
  h3 { font-size: var(--font-sm); font-weight: 600; }
  .lead { max-width: 60rem; color: var(--dim); font-size: var(--font-2xs); line-height: 1.6; }
  .count { flex: none; color: var(--dim); font-family: var(--num); font-size: var(--font-xs); }
  .lab-body { display: grid; grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr); gap: var(--spacing-lg); align-items: start; }
  .skills-pane { display: grid; gap: var(--spacing-sm); min-width: 0; }
  .search input { width: 100%; padding: var(--spacing-xs) var(--spacing-sm); border: 1px solid var(--line); border-radius: var(--radius-pill); background: var(--inset); color: var(--text); font: inherit; font-size: var(--font-xs); }
  .search input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .chips { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
  .chips button { padding: 2px var(--spacing-sm); border: 1px solid var(--line); border-radius: var(--radius-pill); background: transparent; color: var(--dim); font: inherit; font-size: var(--font-3xs); cursor: pointer; }
  .chips button:hover, .chips button.on { border-color: var(--gold); color: var(--gold-lit); background: color-mix(in srgb, var(--gold) 9%, transparent); }
  .chips button:focus-visible, .skill-row:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .rows { display: grid; gap: 2px; max-height: 72vh; overflow-y: auto; padding-right: var(--spacing-xs); }
  .skill-row { display: flex; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-xs) var(--spacing-sm); border: 1px solid transparent; border-radius: var(--radius-card); background: transparent; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
  .skill-row:hover { background: color-mix(in srgb, var(--text) 4%, transparent); }
  .skill-row.on { border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); background: color-mix(in srgb, var(--gold) 8%, transparent); }
  .skill-art { flex: none; width: var(--icon-label); height: var(--icon-label); opacity: .9; }
  .skill-copy { display: grid; gap: 1px; min-width: 0; }
  .skill-copy b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-xs); font-weight: 500; }
  .skill-copy small { color: var(--dim); font-size: var(--font-3xs); }
  .empty { color: var(--dim); font-size: var(--font-xs); }
  .stage { display: grid; gap: var(--spacing-sm); min-width: 0; padding: var(--card-pad); border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--panel); }
  .stage-head { display: flex; align-items: end; justify-content: space-between; gap: var(--spacing-sm); }
  .stage-head .eyebrow { color: var(--dim); }
  .id { color: var(--dim); font-family: var(--num); font-size: var(--font-3xs); }
  .effect { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); color: var(--dim); font-size: var(--font-xs); line-height: 1.6; }
  .effect-label { color: var(--gold); font-size: var(--font-3xs); letter-spacing: .08em; text-transform: uppercase; }
  .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--spacing-sm); padding-top: var(--spacing-sm); border-top: 1px solid var(--line); }
  .facts div { display: grid; gap: 1px; }
  .facts dt { color: var(--dim); font-size: var(--font-3xs); letter-spacing: .08em; text-transform: uppercase; }
  .facts dd { color: var(--text); font-family: var(--num); font-size: var(--font-xs); }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
  @media (max-width: 62rem) {
    .lab-body { grid-template-columns: 1fr; }
    .rows { max-height: 18rem; }
    .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
