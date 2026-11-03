<script lang="ts">
  import type { AwayReport } from './hud';
  import { sm } from '../../engine/client';
  import { icon, skillIcon } from '../../icon';
  let { report, treePoints, bagUsed, bagCapacity, fmtNum, ondismiss, ontree, onskills, onbag }: {
    report: AwayReport; treePoints: number; bagUsed: number; bagCapacity: number;
    fmtNum: (value: number) => string; ondismiss: () => void;
    ontree: () => void; onskills: () => void; onbag: () => void;
  } = $props();
  const closeIcon = icon('cancel-close');
  let expanded = $state(false);
  const rows = $derived([
    { label: 'Enemies defeated', value: fmtNum(report.kills) },
    { label: 'Items dropped', value: fmtNum(report.drops) },
    { label: 'Stones earned', value: fmtNum(report.stones) },
    { label: 'Junk collected', value: fmtNum(report.junk) },
    { label: 'Gold change', value: fmtNum(report.gold) },
    { label: 'Skill copies', value: fmtNum(report.skillCopies) },
  ]);
</script>

<aside class="progress-recap surface-hud" aria-label="Offline progress summary">
  <div class="recap-summary">
    <div><h2>Welcome back</h2><p>{report.mins.toLocaleString()} minutes away · {report.levels ? `+${report.levels} levels · ` : ''}{fmtNum(report.kills)} defeats · {fmtNum(report.stones)} stones</p></div>
    <button class="btn btn-quiet" type="button" aria-expanded={expanded} aria-controls="offline-recap-details" onclick={() => expanded = !expanded}>{expanded ? 'Hide report' : 'View report'}</button>
    <button class="btn btn-flat btn-icon" type="button" aria-label="Dismiss offline report" onclick={ondismiss}><span class="icon-mask" style={`--glyph:url(${closeIcon})`} aria-hidden="true"></span></button>
  </div>
  <div id="offline-recap-details" hidden={!expanded} class="recap-details">
    <dl>{#each rows as row}<div><dt>{row.label}</dt><dd>{row.value}</dd></div>{/each}</dl>
    {#if report.newSkills.length}
      <section class="learned"><h3>New in your collection</h3><ul>{#each report.newSkills as id}<li><img src={skillIcon(id, sm.byId[id]?.type)} alt="" /><span>{sm.byId[id]?.name || id}</span></li>{/each}</ul></section>
    {/if}
    <p class="report-note">{report.secs.toLocaleString()} seconds simulated · quality floor {report.quality}{report.capped ? ' · Catch-up was limited' : ''}. Drops are earned totals; your bag may contain fewer after automatic gear care.</p>
    <div class="recap-actions" aria-label="Continue your progress">
      {#if treePoints > 0}<button class="btn btn-gold" type="button" onclick={ontree}>Spend {treePoints} Tree points</button>{/if}
      {#if report.skillCopies > 0}<button class="btn btn-quiet" type="button" onclick={onskills}>Review skills</button>{/if}
      <button class="btn btn-quiet" type="button" onclick={onbag}>Review bag · {bagUsed}/{bagCapacity}</button>
    </div>
  </div>
</aside>

<style>
  .progress-recap { position: absolute; inset-inline: 22%; top: var(--band-toast, 80px); z-index: var(--z-toast); border: 1px solid var(--hud-edge); border-radius: var(--radius-card); background: var(--ground-3); box-shadow: var(--shadow-raised); padding: 12px 16px; color: var(--text); display: grid; gap: 12px; }
  .recap-summary { display: flex; align-items: center; gap: 12px; }
  .recap-summary > div { min-width: 0; flex: 1; }
  h2, h3, p, dl, dd, ul { margin: 0; }
  h2 { color: var(--gold-lit); font-size: var(--font-sm); }
  .recap-summary p, .report-note { color: var(--sheet-ink); font-size: var(--font-2xs); line-height: 1.5; }
  .recap-summary button { flex: none; font-size: var(--font-2xs); }
  .recap-summary .icon-mask { width: 14px; height: 14px; }
  .recap-details { padding-top: 14px; border-top: 1px solid var(--edge); display: grid; gap: 14px; max-height: 55vh; overflow-y: auto; }
  .recap-details[hidden] { display: none; }
  dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 20px; font-variant-numeric: tabular-nums; }
  dt { color: var(--sheet-ink); font-size: var(--font-2xs); } dd { font-size: var(--font-sm); color: var(--text); }
  .learned { display: grid; gap: 8px; } h3 { color: var(--gold-lit); font-size: var(--font-xs); }
  ul { padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 8px 18px; }
  li { display: flex; align-items: center; gap: 7px; font-size: var(--font-2xs); } li img { width: 24px; height: 24px; object-fit: contain; }
  .recap-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .recap-actions button { font-size: var(--font-2xs); }
</style>
