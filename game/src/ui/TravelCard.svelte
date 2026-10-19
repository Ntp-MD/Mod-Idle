<script lang="ts">
  import { E, eng, fieldwork } from '../engine/client';
  import { sideSpawnWords } from './hud';
  import { destinationSite, type MapDestination, type DestinationAction } from './destination';

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
    dest, primary, writable = true, campHere = false, campHunting = false, warpReason = '', notice = '',
    settlement, busy = false, fare = 0, afford = true, dungeon = null,
    patrol = { stops: [], active: false, repeat: true, index: 0, groupsCleared: 0 }, autoReturnEnabled = false,
    minPatrolStops = 2, maxPatrolStops = 3, groupsPerStop = 3, autoReturnPct = 90,
    onprimary, onwarp, onclear, onreturncamp = () => {}, oncampui = () => {},
    onTogglePatrolStop = () => {}, onStartPatrol = () => {}, onStopPatrol = () => {}, onClearPatrol = () => {},
    onPatrolRepeat = (_repeat: boolean) => {}, onAutoReturn = (_enabled: boolean) => {},
  }: {
    /** the picked cell and everything the field knows about it */
    dest: MapDestination;
    primary: DestinationAction;
    writable?: boolean;
    campHere?: boolean;
    campHunting?: boolean;
    warpReason?: string;
    notice?: string;
    /** the settlement that owns the cell — itself at rank 0, its nearest one on bare ground */
    settlement: any;
    busy?: boolean;
    /** what the Waypoint charges to reach this settlement, read off `town.json` by the caller */
    fare?: number;
    afford?: boolean;
    /** the run the card speaks for: inside with a count, or outside with the cooldown left */
    dungeon?: { active: boolean; left: number; total: number; cooldown: number } | null;
    patrol?: { stops: { zone: number; subzone: number; cell: { q: number; r: number } }[]; active: boolean; repeat: boolean; index: number; groupsCleared: number };
    autoReturnEnabled?: boolean;
    minPatrolStops?: number;
    maxPatrolStops?: number;
    groupsPerStop?: number;
    autoReturnPct?: number;
    onprimary: () => void;
    onwarp: (id: string) => void;
    onclear: () => void;
    onreturncamp?: () => void;
    oncampui?: () => void;
    onTogglePatrolStop?: () => void;
    onStartPatrol?: () => void;
    onStopPatrol?: () => void;
    onClearPatrol?: () => void;
    onPatrolRepeat?: (repeat: boolean) => void;
    onAutoReturn?: (enabled: boolean) => void;
  } = $props();
  const site = $derived(destinationSite(dest));
  const typeName = $derived(dest.kind === 'town' ? 'Settlement' : site === 'mine' ? 'Mine' : site === 'grove' ? 'Rare Grove' : site === 'dungeon' ? 'Dungeon entrance' : 'Hunting ground');
  const warpBlocked = $derived(!writable ? 'Read-only: another tab controls progress.' : busy ? 'Finish traveling or recovering first.' : warpReason || (!afford ? `Needs ${fare} gold.` : ''));
  const isDungeon = $derived(site === 'dungeon');
  const zone = $derived(eng.zoneById(settlement.zone));
  const ambushChance = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(E.road.encounter_chance_pct);
  const subzone = $derived(dest.kind === 'sub' && dest.sub != null ? zone.subzones?.[dest.sub] ?? null : null);
  const encounterNames = $derived.by(() => {
    // The zone's fixed levels belong to Species; its selected Variant supplies the name and Core.
    const speciesIds = subzone ? (subzone.species || []) : eng.speciesInZone(settlement.zone);
    const rows = speciesIds.flatMap((id: string) => {
      const species = eng.speciesById(id);
      const level = species?.zone_levels?.[settlement.zone];
      const names = eng.variantsInZone(id, settlement.zone).map((variant: any) => variant.name);
      return (names.length ? names : [species?.name ?? id]).map((name: string) => `${name} · Lv ${level ?? zone.levels[0]}`);
    });
    return [...new Set(rows)];
  });
  const uniqueNames = $derived.by(() => {
    // A Species may have no Unique or several; Elite remains a rank over the rolled Variant.
    const speciesIds = subzone ? (subzone.species || []) : eng.speciesInZone(settlement.zone);
    return [...new Set(speciesIds.flatMap((id: string) => eng.uniquesOf(id).map((unique: any) => unique.name)))];
  });
  const zoneBoss = $derived(E.mob.bosses.find((boss: any) => boss.zone === settlement.zone) ?? null);
  /** The side's own pack, Elite rate and body mix — what standing here rolls (`mob.spawn_packs`). */
  const sideWords = $derived(sideSpawnWords(subzone?.spawn));
  const patrolNames = $derived(patrol.stops.map((stop) => eng.zoneById(stop.zone)?.subzones?.[stop.subzone]?.name || `Sub-zone ${stop.subzone + 1}`));
  const selectedPatrolStop = $derived(dest.kind === 'sub' && dest.sub != null
    && patrol.stops.some((stop) => stop.zone === settlement.zone && stop.subzone === dest.sub));
  const patrolHere = $derived(patrol.stops[patrol.index]
    ? eng.zoneById(patrol.stops[patrol.index].zone)?.subzones?.[patrol.stops[patrol.index].subzone]?.name || '' : '');
  /** The one line that says what standing here is good for. */
  const ground = $derived(({
    town: 'the settlement itself — safe ground, and a Waypoint',
    sub: `a sub-zone of ${settlement.name} — standing here hunts this side's cast`,
    wild: site === 'dungeon' ? `special dungeon entrance near ${settlement.name}`
      : site === 'mine' ? `mine near ${settlement.name} — ore and ${fieldwork.materialById[fieldwork.F.regional_sources[settlement.zone]?.mine]?.name || 'local minerals'}`
        : site === 'grove' ? `grove near ${settlement.name} — timber and ${fieldwork.materialById[fieldwork.F.regional_sources[settlement.zone]?.grove]?.name || 'local wood'}`
          : `wild field near ${settlement.name}`,
    bare: `open hunting ground in ${settlement.name}'s zone ${settlement.zone} — the full zone cast can appear`,
  })[dest.kind]);
</script>

<div class="dest surface-popover" role="dialog" aria-modal="false" aria-label={`Destination: ${dest.label}`} tabindex="-1"
         onkeydown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onclear(); } }}>
  <header class="dest-head">
    <div class="dest-identity">
      <h2 class="text-accent">{dest.label}</h2>
      <p class="text-note">{typeName} · Lv {zone.levels[0]}–{zone.levels[1]}</p>
    </div>
    <button class="btn btn-flat btn-icon dest-close" type="button" onclick={onclear} aria-label="Close selection" title="Close selection · Esc">
      <svg class="icon-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg>
    </button>
  </header>
  <p class="text-note">{settlement.name} · Zone {settlement.zone} · {settlement.band} band · Cell {dest.key}</p>
  {#if !dest.self}
    <div class="dest-trip">
      <strong>{dest.blocks} {dest.blocks === 1 ? 'block' : 'blocks'} · {dest.sec}s</strong>
      <span class="text-note">Ambush {ambushChance}% / block</span>
    </div>
  {:else}
    <p class="text-good">You are here{campHere ? ' · Field Camp' : ''}</p>
  {/if}
  <div class="dest-actions">
    <button class="btn btn-gold" type="button" onclick={onprimary} disabled={primary.disabled}
            onkeydown={(event) => { if (event.key === 'Enter' && event.repeat) event.preventDefault(); }}
            aria-label={primary.label} aria-keyshortcuts="Enter" title={primary.reason || `${primary.label} · Enter`}>
      {primary.label}<small class="text-note">Enter</small>
    </button>
    {#if dest.kind === 'town' && !dest.self && dest.here && dest.node}
      <button class="btn btn-quiet" type="button" onclick={() => onwarp(dest.node!)} disabled={!!warpBlocked}
              title={warpBlocked || `Warp for ${fare} gold`}>Waypoint · {fare} gold</button>
    {/if}
    {#if dest.self && dest.kind !== 'town'}
      {#if campHunting}
        <button class="btn btn-quiet" type="button" onclick={onreturncamp} disabled={!writable || busy}>Return to Camp</button>
      {/if}
      <button class="btn btn-quiet" type="button" onclick={oncampui}>{(site === 'mine' || site === 'grove') && !campHere ? 'Set up Camp' : 'Camp & skills'}</button>
    {/if}
  </div>
  {#if primary.reason}<p class="text-note" role="status">{primary.reason}</p>{/if}
  {#if notice}<p class="text-note">{notice}</p>{/if}
  {#if dest.kind === 'town' && !dest.self}
    {#if !dest.here}<p class="text-note">First trip on foot · Waypoint opens after arrival.</p>
    {:else if warpBlocked}<p class="text-note">{warpBlocked}</p>{/if}
  {/if}
  {#if isDungeon && dest.self && dungeon?.active}
    <p class="text-note">{dungeon.left}/{dungeon.total} mobs left · Retreat rescues {E.dungeon.retreat_keep_min}–{E.dungeon.retreat_keep_max} random stacks.</p>
  {/if}

  <details class="dest-section" name="map-destination-sections">
    <summary><span>Details</span><svg class="icon-chevron dest-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></summary>
    <div class="dest-section-body">
      <p class="text-note">{ground}</p>
      {#if settlement.capital}<p class="text-note">{settlement.capital} capital</p>{/if}
      {#if site === 'hunt' || isDungeon}
        <section class="dest-guide" aria-label="Possible encounters">
          <strong class="text-accent">{subzone ? subzone.name : 'Zone pool'}</strong>
          <details class="dest-roster" name="map-encounter-roster" open>
            <summary>Monsters · {encounterNames.length}</summary>
            <ul class="dest-mob-list">
              {#each encounterNames as name (name)}<li>{name}</li>{/each}
            </ul>
          </details>
          {#if sideWords.length}<p class="text-note"><b>This side</b> {sideWords.join(' · ')}</p>{/if}
          {#if uniqueNames.length}
            <details class="dest-roster" name="map-encounter-roster">
              <summary>Unique · {uniqueNames.length}</summary>
              <ul class="dest-mob-list">{#each uniqueNames as name (name)}<li>{name}</li>{/each}</ul>
            </details>
          {/if}
          {#if zoneBoss}<p class="text-note"><b>Boss</b> {zoneBoss.name}</p>{/if}
        </section>
      {/if}
      {#if isDungeon}
        <p class="text-note">Up to {E.dungeon.mob_cap} mobs in groups of {E.dungeon.group_cap}. Loot stays in escrow until the last falls.</p>
        {#if (dungeon?.cooldown ?? 0) > 0}<p class="text-note">Cooldown · {dungeon?.cooldown}s remaining.</p>{/if}
      {/if}
    </div>
  </details>

  <details class="dest-section" name="map-destination-sections">
    <summary><span>Route{patrol.stops.length ? ` · ${patrol.stops.length}/${maxPatrolStops} stops` : ''}</span><svg class="icon-chevron dest-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></summary>
    <div class="dest-section-body">
      {#if patrolNames.length}<p>{patrolNames.join(' → ')}</p>{/if}
      {#if patrol.active}<p class="text-note">{patrolHere} · {patrol.groupsCleared}/{groupsPerStop} groups</p>{/if}
      <div class="dest-actions">
        {#if dest.kind === 'sub' && !patrol.active}
          <button class="btn btn-quiet" type="button" onclick={onTogglePatrolStop}
                  disabled={!writable || busy || !dest.here || (patrol.stops.length >= maxPatrolStops && !selectedPatrolStop)}
                  title={!dest.here ? 'Visit the settlement first.' : ''}>{selectedPatrolStop ? 'Remove Patrol stop' : 'Add Patrol stop'}</button>
        {/if}
        {#if patrol.active}
          <button class="btn btn-quiet" type="button" onclick={onStopPatrol} disabled={!writable}>Stop Patrol</button>
        {:else if patrol.stops.length >= minPatrolStops}
          <button class="btn btn-gold" type="button" onclick={onStartPatrol} disabled={!writable || busy}>Start Patrol</button>
        {/if}
        {#if patrol.stops.length && !patrol.active}
          <button class="btn btn-quiet" type="button" onclick={onClearPatrol} disabled={!writable || busy}>Clear route</button>
        {/if}
      </div>
      <label class="dest-setting"><input type="checkbox" checked={patrol.repeat} onchange={(event) => onPatrolRepeat(event.currentTarget.checked)} disabled={!writable || patrol.active} /> Repeat Patrol</label>
      <label class="dest-setting"><input type="checkbox" checked={autoReturnEnabled} onchange={(event) => onAutoReturn(event.currentTarget.checked)} disabled={!writable} /> Auto-Return at {autoReturnPct}% bag</label>
      <p class="text-note">Auto-Return stashes unlocked gear, then resumes Patrol.</p>
      {#if patrol.stops.length < minPatrolStops}
        <p class="text-note">Choose at least {minPatrolStops} subzones in one visited zone. Patrol hunts each stop’s roster.</p>
      {/if}
    </div>
  </details>
</div>

<style>
  .dest { display: grid; gap: var(--spacing-sm); min-width: 0; padding: var(--spacing-sm) var(--spacing-md); font-size: var(--font-xs); }
  .dest p { margin: 0; line-height: 1.35; }
  .dest-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--spacing-sm); min-width: 0; }
  .dest-identity { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .dest-head h2 { margin: 0; font-size: var(--font-sm); overflow-wrap: anywhere; }
  .dest-close { display: grid; place-items: center; flex: none; padding: var(--spacing-xs); }
  .dest-close svg, .dest-chevron { width: var(--icon-label); height: var(--icon-label); flex: none; }
  .dest-trip, .dest-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs) var(--spacing-sm); }
  .dest-actions button { display: inline-flex; align-items: center; justify-content: center; gap: var(--spacing-sm); font-size: var(--font-xs); }
  .dest-section { min-width: 0; }
  .dest-section summary { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); cursor: pointer; padding-block: var(--spacing-xs); }
  .dest-section[open] > summary .dest-chevron { transform: rotate(180deg); }
  .dest-section-body, .dest-guide { display: grid; gap: var(--spacing-sm); min-width: 0; }
  .dest-section-body { padding-block: var(--spacing-xs); }
  .dest-mob-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-xs) var(--spacing-sm); margin: 0; padding: 0; list-style: none; }
  .dest-mob-list li { min-width: 0; overflow-wrap: anywhere; }
  .dest-setting { display: flex; align-items: flex-start; gap: var(--spacing-xs); }
  .dest-roster summary { display: list-item; padding-block: var(--spacing-xs); }
</style>
