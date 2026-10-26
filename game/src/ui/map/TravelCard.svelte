<script lang="ts">
  import { E, eng, fieldwork } from '../../engine/client';
  import { sideSpawnWords } from '../hud/hud';
  import { destinationSite, type MapDestination, type DestinationAction } from './destination';
  import type { MapIntel } from './map-intel';
  import cancelClose from '../../icon/ui/cancel-close.png';
  import chevronDown from '../../icon/ui/chevron-down.png';

  /** Inline details for the selected hex, or the current hex when nothing is selected.
   * Journey owns the surrounding surface and scroll area; this component owns its actions. */
  let {
    dest, primary, selected = true, writable = true, campHere = false, campHunting = false, fightActive = false, warpReason = '', notice = '',
    settlement, busy = false, fare = 0, afford = true, dungeon = null, intel = null,
    patrol = { stops: [], active: false, repeat: true, index: 0, groupsCleared: 0 }, maxPatrolStops = 3,
    onprimary, onwarp, onclear, onreturncamp = () => {}, oncampui = () => {}, onSetCamp = () => {},
    onTogglePatrolStop = () => {}, ontrack = () => {}, goalPinned = false,
  }: {
    /** the picked cell and everything the field knows about it */
    dest: MapDestination;
    primary: DestinationAction;
    selected?: boolean;
    intel?: MapIntel | null;
    writable?: boolean;
    campHere?: boolean;
    campHunting?: boolean;
    fightActive?: boolean;
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
    maxPatrolStops?: number;
    onprimary: () => void;
    onwarp: (id: string) => void;
    onclear: () => void;
    onreturncamp?: () => void;
    oncampui?: () => void;
    onSetCamp?: () => void;
    onTogglePatrolStop?: () => void;
    /** Pin this destination as the Journey's next goal; navigation only, never travel. */
    ontrack?: () => void;
    goalPinned?: boolean;
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
  const selectedPatrolStop = $derived(dest.kind === 'sub' && dest.sub != null
    && patrol.stops.some((stop) => stop.zone === settlement.zone && stop.subzone === dest.sub));
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

<section class="dest" aria-label={`${selected ? 'Selected destination' : 'Current hex'}: ${intel?.site?.name || (intel && !intel.known && dest.kind !== 'town' ? `Unexplored block ${dest.key}` : dest.label)}`}>
  <header class="dest-head">
    <div class="dest-identity">
      <h2 class="text-accent">{intel && !intel.known && dest.kind !== 'town' ? `Unexplored block ${dest.key}` : intel?.site?.name || dest.label}</h2>
      <p class="text-note">{intel && !intel.known && dest.kind !== 'town' ? 'Unscouted block' : `${typeName} · Lv ${zone.levels[0]}–${zone.levels[1]}`}</p>
    </div>
    {#if selected}<button class="btn btn-flat btn-icon dest-close" type="button" onclick={onclear} aria-label="Close selection" title="Close selection · Esc">
      <span class="icon-mask" style={`--glyph:url(${cancelClose})`} aria-hidden="true"></span>
    </button>{/if}
  </header>
  <p class="dest-knowledge">{intel ? intel.knowledge === 'explored' ? 'Explored' : intel.known ? 'Scouted' : 'Details hidden until scouted' : selected ? 'Selected destination' : 'Current hex'} · {dest.key}</p>
  {#if intel}
    <p class="dest-purpose">{intel.purpose}</p>
  {/if}
  {#if selected && !dest.self}
    <dl class="dest-trip" aria-label="Travel time and route risk">
      <div><dt>Travel</dt><dd>{dest.blocks} {dest.blocks === 1 ? 'block' : 'blocks'} · {dest.sec}s</dd></div>
      <div><dt>Ambush on route</dt><dd>{intel ? `${intel.ambushRisk}%` : `${ambushChance}% / block`}</dd></div>
    </dl>
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
    {#if dest.kind === 'sub' && !patrol.active}
      <button class="btn btn-quiet" type="button" onclick={onTogglePatrolStop}
              disabled={!writable || busy || !dest.here || (patrol.stops.length >= maxPatrolStops && !selectedPatrolStop)}
              title={!dest.here ? 'Visit the settlement first.' : ''}>{selectedPatrolStop ? 'Remove Patrol stop' : 'Add Patrol stop'}</button>
    {/if}
    {#if selected && !dest.self}
      <button class="btn btn-quiet" type="button" onclick={ontrack} disabled={!writable}
              aria-pressed={goalPinned}
              title={goalPinned ? 'This destination is pinned as the next goal.' : 'Keep this destination in the Journey as the next goal.'}>{goalPinned ? 'Goal pinned' : 'Pin as next goal'}</button>
    {/if}
    {#if dest.self && dest.kind !== 'town'}
      {#if !campHere}<button class="btn btn-quiet" type="button" onclick={onSetCamp} disabled={!writable || busy || fightActive}
        title={fightActive ? 'Finish the current fight before setting Camp.' : 'Set Field Camp on this hex.'}>Set Field Camp here</button>{/if}
      {#if campHunting}
        <button class="btn btn-quiet" type="button" onclick={onreturncamp} disabled={!writable || busy}>Return to Camp</button>
      {/if}
      <button class="btn btn-quiet" type="button" onclick={oncampui}>{(site === 'mine' || site === 'grove') && !campHere ? 'Set up Camp' : 'Camp & skills'}</button>
    {/if}
  </div>
  {#if primary.reason}<p class="text-note" role="status">{primary.reason}</p>{/if}
  {#if !primary.disabled && primary.warn}<p class="text-note">{primary.warn}</p>{/if}
  {#if notice && notice !== intel?.recentEvent}<p class="text-note">{notice}</p>{/if}
  {#if intel}
    <div class="dest-intel" aria-label="Destination intelligence">
      <p class="text-accent">{intel.levelNote}</p>
      <dl class="intel-facts">
        {#if intel.resources.length}<div><dt>Find here</dt><dd>{intel.resources.join(' · ')}</dd></div>{/if}
        {#if intel.encounters.length}<div><dt>Encounters</dt><dd>{intel.encounters.slice(0, 3).join(' · ')}{intel.encounters.length > 3 ? ` · +${intel.encounters.length - 3} more in Details` : ''}</dd></div>{/if}
      </dl>
      {#each intel.objectives as objective}<p class="text-good">{objective}</p>{/each}
      {#if intel.campDistance != null}<p class="text-note">Field Camp · {intel.campDistance} {intel.campDistance === 1 ? 'block' : 'blocks'} from this destination</p>{/if}
      {#if intel.standing}
        <p class="text-accent">{intel.standing.label} · {intel.standing.next}</p>
        {#each intel.standing.unlocked as unlock}<p class="text-note">Unlocked · {unlock}</p>{/each}
      {/if}
      {#if intel.site?.claimed}<p class="text-note">Site explored</p>{/if}
      {#if intel.recentEvent}<p class="text-good">{intel.recentEvent}</p>{/if}
    </div>
  {/if}
  {#if dest.kind === 'town' && !dest.self}
    {#if !dest.here}<p class="text-note">First trip on foot · Waypoint opens after arrival.</p>
    {:else if warpBlocked}<p class="text-note">{warpBlocked}</p>{/if}
  {/if}
  {#if isDungeon && dest.self && dungeon?.active}
    <p class="text-note">{dungeon.left}/{dungeon.total} mobs left · Retreat rescues {E.dungeon.retreat_keep_min}–{E.dungeon.retreat_keep_max} random stacks.</p>
  {/if}

  <details class="dest-section" name="map-destination-sections">
    <summary><span>Details</span><span class="icon-mask dest-chevron" style={`--glyph:url(${chevronDown})`} aria-hidden="true"></span></summary>
    <div class="dest-section-body">
      <p class="text-note">{intel && !intel.known && dest.kind !== 'town' ? `Cell ${dest.key} · details hidden until scouted` : `${settlement.name} · Zone ${settlement.zone} · ${settlement.band} band · Cell ${dest.key}`}</p>
      {#if selected && !dest.self}<p class="text-note">Ambush chance per block · {ambushChance}%</p>{/if}
      <p class="text-note">{intel && !intel.known ? intel.purpose : ground}</p>
      {#if settlement.capital && (!intel || intel.known || dest.kind === 'town')}<p class="text-note">{settlement.capital} capital</p>{/if}
      {#if (!intel || intel.known) && (site === 'hunt' || isDungeon)}
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


</section>

<style>
  .dest { display: grid; gap: var(--spacing-sm); min-width: 0; font-size: var(--font-xs); }
  .dest p { margin: 0; line-height: 1.35; }
  .dest-intel { display: flex; flex-direction: column; gap: var(--spacing-sm); padding-block: var(--spacing-xs); }
  .dest-purpose { color: var(--text); line-height: 1.5; }
  .dest-knowledge { color: var(--sheet-ink); font-size: var(--font-2xs); }
  dl, dd { margin: 0; }
  .dest-trip { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding-block: 10px; border-block: 1px solid var(--edge); }
  .dest-trip dt, .intel-facts dt { color: var(--sheet-ink); font-size: var(--font-2xs); }
  .dest-trip > div, .intel-facts > div { display: grid; align-content: start; gap: 3px; }
  .dest-trip dd { color: var(--gold-lit); font-variant-numeric: tabular-nums; }
  .intel-facts { display: grid; gap: 9px; }
  .intel-facts dd { color: var(--text); line-height: 1.5; }
  .dest-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--spacing-sm); min-width: 0; }
  .dest-identity { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .dest-head h2 { margin: 0; font-size: var(--font-sm); overflow-wrap: anywhere; }
  .dest-close { display: grid; place-items: center; flex: none; padding: var(--spacing-xs); }
  .dest-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs) var(--spacing-sm); padding-block: 3px 9px; }
  .dest-actions button { display: inline-flex; align-items: center; justify-content: center; gap: var(--spacing-sm); font-size: var(--font-xs); }
  .dest-section { min-width: 0; }
  .dest-section summary { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); cursor: pointer; padding-block: var(--spacing-xs); }
  .dest-section[open] > summary .dest-chevron { transform: rotate(180deg); }
  .dest-section-body, .dest-guide { display: grid; gap: var(--spacing-sm); min-width: 0; }
  .dest-section-body { padding-block: var(--spacing-xs); }
  .dest-mob-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-xs) var(--spacing-sm); margin: 0; padding: 0; list-style: none; }
  .dest-mob-list li { min-width: 0; overflow-wrap: anywhere; }
  .dest-roster summary { display: list-item; padding-block: var(--spacing-xs); }
</style>
