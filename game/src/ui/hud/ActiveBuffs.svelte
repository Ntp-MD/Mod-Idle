<script lang="ts">
  import { sm } from '../../engine/client';
  import { skillIcon } from '../../icon';
  import type { SkillState } from '../../sim/combat/skills';

  let { skills }: { skills: SkillState } = $props();
  const active = $derived([
    ...Object.entries(skills.buffUp).filter(([id, left]) => left > 0 && sm.byId[id]).map(([id, left]) => ({id, left})),
    ...Object.entries(skills.auras).filter(([id, enabled]) => enabled && sm.byId[id]).map(([id]) => ({id, left: null})),
  ]);
</script>

{#if active.length}
  <div class="active-buffs" role="list" aria-label="Active buffs">
    {#each active as buff (buff.id)}
      {@const skill = sm.byId[buff.id]}
      {@const time = buff.left === null ? 'Aura active' : `${Math.ceil(buff.left)}s remaining`}
      <span class="buff" role="listitem" aria-label={`${skill.name}: ${time}`}>
        <button type="button" class="buff-icon" aria-label={`${skill.name}: ${time}`} title={`${skill.name} · ${time}\n${skill.effect || ''}`}>
          <span class="icon-mask" style:--glyph={`url("${skillIcon(buff.id, skill.type)}")`} aria-hidden="true"></span>
          {#if buff.left !== null}<small>{Math.ceil(buff.left)}s</small>{/if}
        </button>
      </span>
    {/each}
  </div>
{/if}

<style>
  .active-buffs { display: flex; justify-content: center; gap: var(--spacing-xs); flex-wrap: wrap; }
  .buff-icon { position: relative; display: grid; place-items: center; width: 34px; height: 34px; padding: 4px; border: 1px solid var(--hud-edge); border-radius: 3px; background: var(--bg); color: var(--gold-lit); }
  .buff-icon .icon-mask { width: 23px; height: 23px; }
  .buff-icon small { position: absolute; bottom: -1px; right: 1px; padding: 0 2px; background: var(--bg); color: var(--text); font-size: var(--font-3xs); font-variant-numeric: tabular-nums; }
  .buff-icon:focus-visible { outline: 2px solid var(--es); outline-offset: 2px; }
</style>
