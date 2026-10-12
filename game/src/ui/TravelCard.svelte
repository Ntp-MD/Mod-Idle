<script lang="ts">
  import { E } from '../engine/client';

  /**
   * The destination card: what a picked cell is, what it costs to get there, and the verbs that take
   * you. It rises off the field's own map — the ground the HUD stands on — so a place is travelled to
   * where it is seen, with no modal in between (X33 · M7 — the labels come off the sheet's own marks,
   * never off a coordinate).
   *
   * Every cell is a place to stand (`road.standing_rule`), so the card speaks for one cell of any kind:
   * a settlement, a named side of one, a wild side, or bare ground. A bare cell names the settlement
   * whose field it is, because that is where its zone comes from.
   */
  let {
    dest, settlement, busy = false, fare = 0, afford = true, dungeon = null,
    onwalk, onwarp, onhunt, ondesk, onclear, ondungeon,
  }: {
    /** the picked cell and everything the field knows about it */
    dest: {
      key: string;
      kind: 'town' | 'sub' | 'wild' | 'bare';
      label: string;
      node: string | null;
      sub: number | null;
      wild: number | null;
      self: boolean;
      walking: boolean;
      here: boolean;
      blocks: number;
      sec: number;
    };
    /** the settlement that owns the cell — itself at rank 0, its nearest one on bare ground */
    settlement: any;
    busy?: boolean;
    /** what the Waypoint charges to reach this settlement, read off `town.json` by the caller */
    fare?: number;
    afford?: boolean;
    /** the run the card speaks for: inside with a count, or outside with the cooldown left */
    dungeon?: { active: boolean; left: number; total: number; cooldown: number } | null;
    onwalk: () => void;
    onwarp: (id: string) => void;
    onhunt: () => void;
    ondesk: () => void;
    onclear: () => void;
    ondungeon: () => void;
  } = $props();
  const isDungeon = $derived(dest.kind === 'wild' && dest.wild === 0);
  /** The one line that says what standing here is good for. */
  const ground = $derived(({
    town: 'the settlement itself — safe ground, and a Waypoint',
    sub: `a sub-zone of ${settlement.name} — standing here hunts this side's cast`,
    wild: dest.wild === 0
      ? `a wild side of ${settlement.name} — the dungeon door`
      : `a wild side of ${settlement.name}, no content written into it yet`,
    bare: `bare ground in the field of ${settlement.name} — zone ${settlement.zone}, the whole cast rolls`,
  })[dest.kind]);
</script>

<div class="dest">
  <b>{dest.label}</b>
  <span>cell {dest.key} · {ground}</span>
  <span>zone {settlement.zone} · {settlement.band} band{settlement.capital ? ' · ' + settlement.capital + ' capital' : ''}</span>
  {#if isDungeon}
    <span>the dungeon of {settlement.name} — one run fields {E.dungeon.mob_cap} mobs in encounters of {E.dungeon.group_cap}, loot waits in escrow until the last one falls, a Push forfeits it</span>
    {#if dungeon?.active}
      <span>inside — {dungeon.left} of {dungeon.total} left</span>
    {:else if (dungeon?.cooldown ?? 0) > 0}
      <span>cooling down — {dungeon!.cooldown}s left</span>
    {:else if dest.self}
      <span><button onclick={ondungeon}>enter the dungeon</button></span>
    {:else}
      <span>stand on this cell to enter</span>
    {/if}
  {/if}
  {#if dest.self}
    <span>you are standing on this cell — nothing to walk</span>
  {:else}
    <span>{dest.blocks} blocks, plotted cell by cell · {dest.sec}s at {E.road.block_sec}s a block · {E.road.encounter_chance_pct}% an ambush per block</span>
    {#if dest.kind === 'town'}
      <span>{dest.here ? `walked to before — the Waypoint is open, ${fare} gold to warp${afford ? '' : ' (purse too light)'}` : 'never reached — the first walk is on foot'}</span>
    {/if}
  {/if}
  <span class="verbs">
    {#if !dest.self}
      <button onclick={onwalk} disabled={busy}>{dest.walking ? 'walking' : 'walk'}</button>
      {#if dest.kind === 'town' && dest.here && dest.node}<button onclick={() => onwarp(dest.node!)} disabled={!afford} title={afford ? `warp for ${fare} gold` : `needs ${fare} gold`}>waypoint · {fare} gold</button>{/if}
    {:else}
      <button onclick={onhunt}>{dest.kind === 'sub' ? 'hunt this sub-zone' : 'hunt here'}</button>
    {/if}
    {#if dest.kind === 'town'}
      <button onclick={ondesk}>the desk</button>
    {/if}
    <button onclick={onclear}>clear</button>
  </span>
</div>

<style>
  /* the card floats over the map it was picked from, so it keeps the glass the HUD's own overlays use */
  .dest {
    display: flex; flex-wrap: wrap; gap: 4px var(--spacing-sm); align-items: baseline;
    border: 1px solid var(--edge); border-radius: 12px; padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-xs);
    background: var(--glass); backdrop-filter: blur(8px); box-shadow: 0 14px 40px rgba(0, 0, 0, .55);
    animation: pop .14s ease-out;
  }
  .dest span { color: var(--dim); }
  .verbs { display: flex; gap: 4px; align-items: baseline; }
  @keyframes pop { from { transform: translateY(clamp(-11px, -0.326vw - 1px, -5px)); opacity: .3; } to { transform: none; opacity: 1; } }
</style>
