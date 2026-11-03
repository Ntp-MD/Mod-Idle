<script lang="ts">
  import { eng } from '../../engine/client';
  import { skillIcon } from '../../icon';
  import { mobSkillById } from '@sim/combat/mobSkills';
  import { statusLabel } from '@sim/combat/mobStatus';
  import { describeMobSkill } from '@sim/combat/skill-copy';
  import type { EnemySnapshot } from '@sim/combat/combat-history';
  import { fieldLabel } from '../hud/hud';
  import Icon from '../shared/Icon.svelte';

  let { enemy }: { enemy: EnemySnapshot } = $props();
  const skills = $derived(enemy.skillIds.flatMap(id => { const skill = mobSkillById(id); return skill ? [skill] : []; }));
</script>

<section class="enemy-inspector scroll-pane" aria-label={`${fieldLabel(enemy)} recorded details`}>
  <header><h3>{fieldLabel(enemy)}</h3><p>Lv {enemy.level} · Zone {enemy.zone} · {enemy.kind} · {enemy.line === 'stand-off' ? 'Stand-off line' : 'Front line'}</p></header>
  <p class="snapshot-note">Recorded enemy snapshot. These details stay available after the enemy leaves the field.</p>
  <dl class="enemy-facts">
    <div><dt>Attack damage</dt><dd>{enemy.damage}</dd></div>
    <div><dt>Innate elements</dt><dd>{enemy.innate.join(' · ') || 'None'}</dd></div>
    <div><dt>Recorded Max HP</dt><dd>{eng.fmt(enemy.hpMax)}</dd></div>
    <div><dt>Recorded Armour</dt><dd>{eng.fmt(enemy.armour)}</dd></div>
    <div><dt>Recorded resistance</dt><dd>{eng.fmt(enemy.res)}%</dd></div>
    {#if enemy.immune.length}<div><dt>Status immunity</dt><dd>{enemy.immune.map(statusLabel).join(' · ')}</dd></div>{/if}
    {#if enemy.weak}<div><dt>Weakness</dt><dd>{enemy.weak.element}</dd></div>{/if}
  </dl>
  <section class="enemy-kit" aria-label="Resolved enemy skill kit">
    <h4>Resolved skill kit</h4>
    <p class="snapshot-note">Strikes use this enemy's normal attack damage and innate element. A skill's visual element describes its effect art.</p>
    {#if !skills.length}<p>This enemy has no named skills in its resolved kit.</p>{/if}
    {#each skills as skill (skill.id)}
      {@const copy = describeMobSkill(skill)}
      <article class="enemy-skill">
        <div class="skill-heading"><Icon src={skillIcon(skill.id, skill.mode === 'aura' ? 'aura' : 'attack')} /><h5>{skill.name}</h5><span>{skill.mode === 'aura' ? 'Aura' : 'Strike'}</span></div>
        <dl>
          <div><dt>Type</dt><dd>{copy.type}</dd></div>
          <div><dt>Target</dt><dd>{copy.target}</dd></div>
          <div><dt>Element</dt><dd>{copy.element}</dd></div>
          {#if copy.delay}<div><dt>Delay</dt><dd>{copy.delay}</dd></div>{/if}
          {#if copy.status}<div><dt>Status</dt><dd>{copy.status}</dd></div>{/if}
          <div><dt>Description</dt><dd>{copy.description}</dd></div>
        </dl>
      </article>
    {/each}
  </section>
</section>

<style>
  .enemy-inspector { display: flex; flex-direction: column; gap: var(--spacing-md); min-height: 0; height: 100%; overflow-y: auto; padding: var(--spacing-xs); color: var(--text); }
  header { display: grid; gap: var(--spacing-xs); }
  h3, h4, h5, p, dl, dd { margin: 0; }
  h3 { color: var(--gold-lit); font-size: var(--font-md); }
  header p, .snapshot-note { color: var(--sheet-ink); font-size: var(--font-2xs); line-height: 1.5; }
  .enemy-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-sm) var(--spacing-lg); padding-block: var(--spacing-sm); border-block: 1px solid var(--edge); }
  dt { color: var(--sheet-ink); font-size: var(--font-2xs); }
  dd { font-size: var(--font-xs); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .enemy-kit { display: grid; gap: var(--spacing-sm); }
  h4 { color: var(--gold-lit); font-size: var(--font-sm); }
  .enemy-skill { display: grid; gap: var(--spacing-sm); padding-block: var(--spacing-sm); border-top: 1px solid var(--edge); }
  .skill-heading { display: flex; align-items: center; gap: var(--spacing-sm); }
  h5 { font-size: var(--font-sm); }
  .skill-heading > span { color: var(--sheet-ink); font-size: var(--font-2xs); }
  .enemy-skill dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-sm) var(--spacing-lg); }
</style>
