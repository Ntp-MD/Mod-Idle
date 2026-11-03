<script lang="ts">
  import { skillIcon } from '../../icon';
  import type { CastProgress } from './combat-feedback';
  let { cast, name }: { cast: CastProgress; name: string } = $props();
</script>

<div class="combat-cast-bar" class:incoming={cast.incoming} role="progressbar"
  aria-label={`${cast.incoming ? 'Enemy casting' : 'Casting'} ${name}`} aria-valuemin="0" aria-valuemax="100"
  aria-valuenow={Math.round(cast.progress * 100)} aria-valuetext={`${cast.remainingSec.toFixed(1)} seconds remaining`}
  data-cast-skill={cast.skillId}>
  <div class="cast-caption"><span class="icon-mask" style={`--glyph:url(${skillIcon(cast.skillId, 'attack')})`}></span>
    <strong>{name}</strong><span class="cast-time">{cast.remainingSec.toFixed(1)}s</span></div>
  <div class="cast-track" aria-hidden="true"><span class="cast-fill" style:width={`${cast.progress * 100}%`}></span></div>
</div>

<style>
  .combat-cast-bar { display: grid; gap: 4px; width: 156px; padding: 5px 7px; box-sizing: border-box; border: 1px solid var(--gold); border-radius: 3px; background: var(--ground); color: var(--gold-lit); box-shadow: var(--shadow-soft); }
  .combat-cast-bar.incoming { border-color: var(--hp-lit); color: var(--alarm); }
  .cast-caption { display: flex; align-items: center; gap: 5px; font: 600 11px/1.3 var(--ui); }
  .cast-caption .icon-mask { width: 15px; height: 15px; flex: none; }
  .cast-caption strong { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: inherit; }
  .cast-time { flex: none; font-variant-numeric: tabular-nums; }
  .cast-track { height: 6px; background: var(--line); overflow: hidden; border-radius: 1px; }
  .cast-fill { display: block; height: 100%; background: currentColor; }
</style>
