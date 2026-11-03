<script lang="ts">
  import { sm } from '../../engine/client';
  import { icon, skillIcon } from '../../icon';
  let { id, oninspect, ondismiss }: { id: string; oninspect: () => void; ondismiss: () => void } = $props();
  const skill = $derived(sm.byId[id]);
  const closeIcon = icon('cancel-close');
</script>
{#if skill}
  <section class="skill-discovery" aria-label="New skill learned" role="status">
    <img src={skillIcon(id, skill.type)} alt="" />
    <div><h3>{skill.name}</h3><p>New skill in your collection · {skill.type}</p><button class="btn btn-flat" type="button" onclick={oninspect}>Inspect skill</button></div>
    <button class="btn btn-flat btn-icon dismiss" type="button" aria-label="Dismiss skill discovery" onclick={ondismiss}><span class="icon-mask" style={`--glyph:url(${closeIcon})`} aria-hidden="true"></span></button>
  </section>
{/if}
<style>
  .skill-discovery { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-block: 1px solid var(--hud-edge); background: color-mix(in srgb, var(--ground-3) 80%, var(--inset)); }
  img { width: 34px; height: 34px; object-fit: contain; flex: none; }
  h3, p { margin: 0; } h3 { font-size: var(--font-xs); color: var(--gold-lit); } p { color: var(--sheet-ink); font-size: var(--font-2xs); line-height: 1.5; }
  button { font-size: var(--font-2xs); } .dismiss { margin-inline-start: auto; } .icon-mask { width: 12px; height: 12px; }
</style>
