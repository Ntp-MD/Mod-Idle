<script lang="ts">
  import { E, eng, fieldwork } from '../engine/client';

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
    onwalk, onwarp, onhunt, ondesk, onclear, ondungeon, oncamp = () => {}, oncampui = () => {},
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
    oncamp?: () => void;
    oncampui?: () => void;
  } = $props();
  const site = $derived(dest.kind === 'wild' ? fieldwork.siteAt(dest.wild) : dest.kind === 'bare' || dest.kind === 'sub' ? 'hunt' : null);
  const isDungeon = $derived(site === 'dungeon');
  const zone = $derived(eng.zoneById(settlement.zone));
  const subzone = $derived(dest.kind === 'sub' && dest.sub != null ? zone.subzones?.[dest.sub] ?? null : null);
  const encounterNames = $derived.by(() => {
    const configured = subzone
      ? subzone.normal
      : (zone.subzones || []).flatMap((part: any) => part.normal || []);
    const names = [...new Set(configured)];
    return names.length ? names : eng.racesInZone(settlement.zone).map((id: string) => eng.speciesById(id)?.name ?? id);
  });
  const eliteNames = $derived.by(() => {
    const candidates = subzone ? [subzone.elite] : (zone.subzones || []).map((part: any) => part.elite);
    return [...new Set(candidates.filter((name: unknown): name is string => typeof name === 'string'))];
  });
  const zoneBoss = $derived(E.mob.bosses.find((boss: any) => boss.zone === settlement.zone) ?? null);
  /** The one line that says what standing here is good for. */
  const ground = $derived(({
    town: 'the settlement itself — safe ground, and a Waypoint',
    sub: `a sub-zone of ${settlement.name} — standing here hunts this side's cast`,
    wild: site === 'dungeon' ? `special dungeon entrance near ${settlement.name}`
      : site === 'mine' ? `mine site near ${settlement.name} — set Camp here to mine ore`
        : site === 'grove' ? `rare grove near ${settlement.name} — set Camp here to gather timber and rarewood`
          : `wild field near ${settlement.name}`,
    bare: `open hunting ground in ${settlement.name}'s zone ${settlement.zone} — the full zone cast can appear`,
  })[dest.kind]);
</script>

<div class="dest">
  <header class="dest-head">
    <h2>{dest.label}</h2>
    <span class="dest-cell">Cell {dest.key}</span>
  </header>

  <p class="dest-summary">{ground}</p>

  <div class="dest-meta">
    <div class="dest-stat">
      <span>Zone</span>
      <strong>{settlement.zone} · {settlement.band} band{settlement.capital ? ` · ${settlement.capital} capital` : ''}</strong>
    </div>
    {#if !dest.self}
      <div class="dest-stat">
        <span>Route</span>
        <strong>{dest.blocks} blocks · {dest.sec}s total</strong>
      </div>
      <div class="dest-stat">
        <span>Ambush</span>
        <strong>{E.road.encounter_chance_pct}% per block</strong>
      </div>
    {/if}
  </div>

  <section class="dest-guide" aria-label="Possible encounters">
    <header class="dest-guide-head">
      <strong>Encounter guide</strong>
      <span>{subzone ? subzone.name : 'Zone pool'} · Lv {zone.levels[0]}–{zone.levels[1]}</span>
    </header>
    <ul class="dest-mob-list" title="Mobs spawn at your level, clamped to this range">
      {#each encounterNames as name (name)}<li>{name}</li>{/each}
    </ul>
    {#if eliteNames.length || zoneBoss}
      <div class="dest-specials">
        {#if eliteNames.length}<span><b>Elite</b> {eliteNames.join(' · ')}</span>{/if}
        {#if zoneBoss}<span><b>Boss</b> {zoneBoss.name}</span>{/if}
      </div>
    {/if}
  </section>

  {#if dest.kind === 'town' && !dest.self}
    <p class="dest-note">{dest.here ? `Reached before · Waypoint ${fare} gold to warp${afford ? '' : ' · purse too light'}` : 'First trip on foot — the Waypoint opens after arrival'}</p>
  {/if}

  {#if isDungeon}
    <div class="dest-dungeon">
      <p>Dungeon · up to {E.dungeon.mob_cap} mobs in groups of {E.dungeon.group_cap}. Loot stays in escrow until the last one falls; a Push forfeits it.</p>
      {#if dungeon?.active}
        <span class="dest-state">In progress · {dungeon.left}/{dungeon.total} left</span>
      {:else if (dungeon?.cooldown ?? 0) > 0}
        <span class="dest-state">Cooling down · {dungeon?.cooldown}s left</span>
      {:else if dest.self}
        <span class="dest-state ready">Ready to enter</span>
      {:else}
        <span class="dest-state">Stand on this cell to enter</span>
      {/if}
    </div>
  {/if}

  {#if dest.self}
    <p class="dest-note current">You are standing here</p>
  {/if}

  <footer class="dest-actions">
    {#if !dest.self}
      <button class="dest-primary" onclick={onwalk} disabled={busy}>{dest.walking ? 'Walking…' : 'Walk here'}</button>
      {#if dest.kind === 'town' && dest.here && dest.node}
        <button class="dest-secondary" onclick={() => onwarp(dest.node!)} disabled={!afford}
                title={afford ? `Warp for ${fare} gold` : `Needs ${fare} gold`}>
          Waypoint · {fare} gold
        </button>
      {/if}
    {:else}
      {#if isDungeon && !dungeon?.active && (dungeon?.cooldown ?? 0) <= 0}
        <button class="dest-primary" onclick={ondungeon}>Enter dungeon</button>
      {/if}
      <button class="dest-primary" onclick={onhunt}>{dest.kind === 'sub' ? 'Hunt this sub-zone' : 'Hunt here'}</button>
      {#if dest.kind !== 'town'}
        <button class="dest-secondary" onclick={oncampui}>Camp & skills</button>
        <button class="dest-secondary" onclick={oncamp} title="Set up a safe field Camp here">Set Camp</button>
      {/if}
    {/if}
    {#if dest.kind === 'town'}
      <button class="dest-secondary" onclick={ondesk}>The desk</button>
    {/if}
    <button class="dest-clear" onclick={onclear}>Clear</button>
  </footer>
</div>

<style>
  /* the card floats over its selected cell: title, place, travel read and choices have separate stops */
  .dest {
    display: grid; gap: var(--spacing-xs); min-width: 0;
    border: 1px solid var(--edge); border-radius: var(--spacing-md); padding: var(--spacing-sm) var(--spacing-md); font-size: var(--font-xs);
    background: var(--glass); backdrop-filter: blur(8px); box-shadow: 0 14px 40px rgba(0, 0, 0, .55);
    animation: pop .14s ease-out;
  }
  .dest-head { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); min-width: 0; }
  .dest-head h2 { min-width: 0; margin: 0; overflow: hidden; color: var(--text); font-size: var(--font-sm); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
  .dest-cell { flex: none; padding: var(--spacing-3xs) var(--spacing-xs); border: 1px solid var(--hud-edge); border-radius: var(--spacing-sm); color: var(--gold-lit); font-variant-numeric: tabular-nums; }
  .dest-summary { margin: 0; color: var(--text); line-height: 1.35; }
  .dest-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--box-110), 1fr)); gap: var(--spacing-sm); padding: var(--spacing-xs) 0; border-block: 1px solid var(--edge); }
  .dest-stat { display: grid; gap: var(--spacing-3xs); min-width: 0; }
  .dest-stat span { color: var(--dim); letter-spacing: 1px; text-transform: uppercase; }
  .dest-stat strong { color: var(--text); font-weight: 600; }
  .dest-guide { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .dest-guide-head { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); padding-bottom: var(--spacing-2xs); border-bottom: 1px solid var(--edge); }
  .dest-guide-head strong { color: var(--text); font-size: var(--font-sm); font-weight: 600; }
  .dest-guide-head span { flex: none; color: var(--gold-lit); font-variant-numeric: tabular-nums; }
  .dest-mob-list {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-2xs) var(--spacing-sm);
    max-height: var(--box-170); margin: 0; padding: 0; overflow-y: auto; list-style: none;
  }
  .dest-mob-list li { min-width: 0; padding-bottom: var(--spacing-3xs); border-bottom: 1px solid var(--edge); color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dest-specials { display: flex; flex-direction: column; gap: var(--spacing-3xs); color: var(--dim); }
  .dest-specials b { color: var(--gold-lit); font-weight: 600; }
  .dest-note { margin: 0; color: var(--dim); }
  .dest-dungeon { display: grid; gap: var(--spacing-2xs); }
  .dest-dungeon p { margin: 0; color: var(--dim); line-height: 1.35; }
  .dest-state { justify-self: start; color: var(--gold-lit); }
  .dest-state.ready { color: var(--good-lit); }
  .dest-actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--spacing-xs); }
  .dest-actions button {
    padding: var(--spacing-2xs) var(--spacing-sm); border: 1px solid var(--edge); border-radius: var(--spacing-sm);
    background: var(--panel); color: var(--text); font-size: var(--font-xs); transition: border-color .15s ease, background .15s ease, color .15s ease;
  }
  .dest-actions button:hover { border-color: var(--gold); }
  .dest-actions .dest-primary { border-color: color-mix(in srgb, var(--gold) 54%, var(--edge)); background: color-mix(in srgb, var(--gold) 12%, var(--panel)); color: var(--gold-lit); }
  .dest-actions .dest-primary:hover { background: color-mix(in srgb, var(--gold) 20%, var(--panel)); }
  .dest-actions .dest-clear { margin-left: auto; background: transparent; color: var(--dim); }
  .dest-actions button:disabled { opacity: .45; cursor: not-allowed; }
  .dest-actions button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  @keyframes pop { from { transform: translateY(var(--x-pull-note)); opacity: .3; } to { transform: none; opacity: 1; } }
</style>
