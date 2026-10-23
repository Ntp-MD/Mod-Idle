<script lang="ts">
  import { farm } from '../engine/client';
  import { stackIcon } from '../icon';
  import { setPotionDrag, readPotionDrag } from './drag';
  import EmptyNote from './EmptyNote.svelte';

  /**
   * The item shortcuts above the cast bar: a pouch of carried draughts and seven squares, each holding
   * one draught's name. Drag from the pouch or press to place; a square's own press drinks through the
   * caller's rules (cooldown, per-fight cap, boss suppression all live in the sim).
   */
  let { quickbar, potions, condensed, bagIcon, keyFor, onuse, oncyc, onassign, writable }: {
    writable: boolean;
    quickbar: (string | null)[];
    potions: Record<string, number>;
    condensed: Record<string, number>;
    /** the pouch button's art, owned by the hub's icon shelf */
    bagIcon: string;
    /** the display form of the square's bound key, e.g. "F1" */
    keyFor: (slot: number) => string;
    onuse: (slot: number) => void;
    oncyc: (slot: number) => void;
    onassign: (slot: number, name: string | null) => void;
  } = $props();

  let pouchOpen = $state(false);
  const held = (name: string) => (potions[name] || 0) + (condensed[name] || 0);
  const owned = $derived(farm.P.list.filter((p: any) => held(p.name) > 0).map((p: any) => p.name));

  function place(name: string) {
    if (!writable) return;
    const keep = quickbar.indexOf(name);
    const at = keep >= 0 ? keep : quickbar.findIndex((q) => !q);
    if (at >= 0) onassign(at, name);
  }
</script>

<div class="quickbar" role="list" aria-label="Item shortcuts">
  <button class="hud-slot quick-pouch-btn" type="button" aria-expanded={pouchOpen}
          title="Pouch — drag a draught onto a square, or press one to place it"
          onclick={() => (pouchOpen = !pouchOpen)}>
    <img src={bagIcon} alt="" aria-hidden="true" />
  </button>
  {#if pouchOpen}
    <div class="quick-pouch surface-popover" aria-label="Carried draughts">
      {#each owned as pname (pname)}
        <button type="button" class="pouch-item btn btn-flat" draggable={writable} disabled={!writable}
                title={`${pname} · ${held(pname)} held — drag to a square`}
                ondragstart={(e) => setPotionDrag(e, pname)}
                onclick={() => place(pname)}>
          <img class="icon-label" src={stackIcon('draughts', pname)} alt="" aria-hidden="true" />
          <small>{pname} · {held(pname)}</small>
        </button>
      {:else}
        <EmptyNote text="Nothing carried — brew or loot a draught first." tone="xs" />
      {/each}
    </div>
  {/if}
  {#each quickbar as name, i (i)}
    <span class="quick" class:empty={!name} role="listitem">
      <button type="button" class="hud-slot"
              disabled={!writable}
              title={`Item ${i + 1} · ${keyFor(i + 1)} · ${name ? `${name} · ${held(name)} held` : 'empty — drag from the pouch or right-click to cycle'}`}
              ondragover={(e) => e.preventDefault()}
              ondrop={(e) => { if (!writable) return; const dn = readPotionDrag(e); if (dn) { pouchOpen = false; onassign(i, dn); } }}
              onclick={() => onuse(i)}
              oncontextmenu={(e) => { e.preventDefault(); if (writable) oncyc(i); }}>
        {#if name}<img src={stackIcon('draughts', name)} alt="" aria-hidden="true" />{/if}
        {#if name}<small class="quick-held">{held(name)}</small>{/if}
        <b>{i + 1}</b>
      </button>
    </span>
  {/each}
</div>

<style>
  .quickbar {
    display: grid; grid-template-columns: auto repeat(7, var(--slot-skill-size)); justify-content: center;
    gap: var(--spacing-xs); position: relative;
  }
  .quick-pouch-btn, .quick .hud-slot { width: var(--slot-skill-size); height: var(--slot-skill-size); cursor: pointer; }
  .quick-pouch-btn img, .quick img { width: var(--icon-hub-img); height: var(--icon-hub-img); object-fit: contain; pointer-events: none; }
  .quick b { position: absolute; top: 0; left: 3px; font-size: var(--font-xs); font-weight: 400; color: var(--dim); }
  .quick .quick-held { position: absolute; right: 2px; bottom: 0; font-size: var(--font-xs); color: var(--gold-lit); }
  .quick-pouch {
    position: absolute; bottom: calc(100% + var(--spacing-xs)); left: 0; z-index: var(--z-hud-control);
    display: flex; flex-direction: column; gap: 2px; min-width: 170px;
    padding: var(--spacing-xs) var(--spacing-sm);
  }
  .pouch-item { display: flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-xs); cursor: grab; padding: 2px; text-align: left; }
</style>
