<script lang="ts">
  import { E } from '../engine/client';

  /**
   * The destination card: what a picked cell is, what it costs to get there, and the verbs that take
   * you. It rises off the field's own map — the ground the HUD stands on — so a place is travelled to
   * where it is seen, with no modal in between (X33 · M7 — the labels come off the sheet's own
   * `data-node`, never off a coordinate).
   */
  let {
    settlement, cell, walk, busy = false, fare = 0, afford = true,
    onwalk, onwarp, onhunt, ondesk, onclear,
  }: {
    settlement: any;
    cell: { cell: string; kind: 'town' | 'sub' | 'wild'; label: string } | null;
    walk: { self: boolean; blocks: number; sec: number; here: boolean; walking: boolean } | null;
    busy?: boolean;
    /** what the Waypoint charges to reach this settlement, read off `town.json` by the caller */
    fare?: number;
    afford?: boolean;
    onwalk: (id: string) => void;
    onwarp: (id: string) => void;
    onhunt: (zone: number) => void;
    ondesk: () => void;
    onclear: () => void;
  } = $props();
</script>

<div class="dest">
  <b>{cell?.label ?? settlement.name}</b>
  <span>cell {cell?.cell} · {cell?.kind === 'town' ? 'the settlement itself'
    : cell?.kind === 'sub' ? 'a sub-zone of ' + settlement.name
    : cell?.kind === 'wild' ? 'a wild side of ' + settlement.name + ', no content written into it yet'
    : settlement.name}</span>
  <span>zone {settlement.zone} · {settlement.band} band{settlement.capital ? ' · ' + settlement.capital + ' capital' : ''}</span>
  {#if walk?.self}
    <span>you are standing in this settlement — nothing to walk</span>
  {:else}
    <span>{walk?.blocks} blocks, plotted cell by cell · {walk?.sec}s at {E.road.block_sec}s a block · {E.road.encounter_chance_pct}% an ambush per block</span>
    <span>{walk?.here ? `walked to before — the Waypoint is open, ${fare} gold to warp${afford ? '' : ' (purse too light)'}` : 'never reached — the first walk is on foot'}</span>
  {/if}
  <span class="verbs">
    {#if !walk?.self}
      <button onclick={() => onwalk(settlement.id)} disabled={busy}>{walk?.walking ? 'walking' : 'walk'}</button>
      {#if walk?.here}<button onclick={() => onwarp(settlement.id)} disabled={!afford} title={afford ? `warp for ${fare} gold` : `needs ${fare} gold`}>waypoint · {fare} gold</button>{/if}
    {/if}
    <button onclick={() => onhunt(settlement.zone)}>hunt this zone</button>
    <button onclick={ondesk}>the desk</button>
    <button onclick={onclear}>clear</button>
  </span>
</div>

<style>
  /* the card floats over the map it was picked from, so it keeps the glass the HUD's own overlays use */
  .dest {
    display: flex; flex-wrap: wrap; gap: .3rem .8rem; align-items: baseline;
    border: 1px solid var(--edge); border-radius: 12px; padding: .45rem .6rem; font-size: .82rem;
    background: var(--glass); backdrop-filter: blur(8px); box-shadow: 0 14px 40px rgba(0, 0, 0, .55);
    animation: pop .14s ease-out;
  }
  .dest span { color: var(--dim); }
  .verbs { display: flex; gap: .3rem; align-items: baseline; }
  @keyframes pop { from { transform: translateY(-.4rem); opacity: .3; } to { transform: none; opacity: 1; } }
</style>
