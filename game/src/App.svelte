<script lang="ts">
  import { onMount } from 'svelte';
  import { eng, E, sm, TOWN, BASES, tree } from './engine/client';
  import { buildCharacter } from './sim/player';
  import { newGame, tick, push, catchUpAsync, carried, heldWeaponName } from './sim/game';
  import { reservedPct, skillCd, skillLevel, ladderOf, effectsActive, toggleTrack, effectLine, describeFold, EFFECT_LABEL, ACTIVE_SLOTS, manaNow, modeOf } from './sim/skills';
  import { modsOn, psMult, curableRows } from './sim/curse';
  import { statusLabel } from './sim/mobStatus';
  import { slotsUsed, slotsAvailable, bagStacks } from './sim/slots';
  import SlotGrid from './ui/SlotGrid.svelte';
  import { gearEntry, stackEntry, sortEntries, type SlotEntry, type SortKey } from './ui/bag';
  import {
    settlementById, settlementOfZone, stockOf, priceGold, priceKills, canBuy, buy, sellJunk,
    standingShare, standingTier, canTravel, claimTask, npcOf, ROAD_LINKS,
  } from './sim/town';
  import { craft, doCraft, stoneNames, stoneName, lineName, lineTier, type CraftOp, type Where } from './sim/craft';
  import { farm, farmLevel, plotCount, plant, harvest, craftPotion, condense } from './sim/farm';
  import { stashTabCount, deposit, withdraw, depositMany, withdrawMany } from './sim/town';
import { canSpendTree, respecTree, spendTreePoint, treePointsFree, treePointsSpent } from './sim/tree';
  import { road, startTrip, linkReachable, purseReady, linkLabel, startCircuit, stopCircuit, circuitValid, plotRoute, normaliseTrip } from './sim/road';
  import { masteryLabel, dropBonusPct, masteryLevel, WEAPONS } from './sim/mastery';
  import { storePreset, switchPreset, bindZone } from './sim/presets';
  import { col, setUnlocked, heldCount, turnIn } from './sim/collector';
  import { mulberry32 } from './engine/client-helpers';
  import { writeSave, readSave, exportJson, importJson, saveSlots, listSnapshots, restoreSnapshot, readSettings, writeSettings, DEFAULT_SETTINGS, type SlotName, type Snapshot, type ClientSettings } from './state/save';
  import { FILTER_SLOTS, RARITY_CHOICES, ruleFor, setRule, describeRule } from './sim/filter';
  import { equipFromBag, gearModOf } from './sim/gear';
  import { SAVE_CFG } from './sim/snapshot';
  import { target as goalTarget, describe as describeGoal } from './sim/goal';
  import { elementIcon, mobIcon, skillIcon } from './icon';
  import { bossMark } from './icon';
  import { hubArt, npcArt, stockArt } from './icon/art';
  // the settlement map: hand-drawn terrain under the generated overlay (both presentation-only).
  // Both are inlined as markup, not loaded as <img>: an SVG in an <img> is rasterised at its
  // intrinsic size and then scaled, so the sheet would pixelate the moment the player zooms in.
  import mapTerrainRaw from '../../art/svg/map/map-terrain.svg?raw';
  // the overlay is inlined verbatim — the sheet is names and hexes, so there is no mark to toggle and
  // the client reads no coordinate, only the ids already on each hex (X33 · M7 · M9)
  import mapOverlayRaw from '../../art/svg/map/map-overlay.svg?raw';
  import type { GameState, Item } from './sim/types';
  import type { StatKey } from './engine/client';
  import type { Statuses } from './sim/combat';

  const STATS: StatKey[] = ['str', 'int', 'vit', 'agi', 'dex', 'wis', 'lck'];
  // The screens, in the order the top bar draws them. QOL is the hub: it owns the client-wide
  // convenience settings and is the front door to the automation that lives on its own screen.
  type TabId = 'main' | 'skills' | 'map' | 'farm' | 'qol' | 'save';
  const TABS: TabId[] = ['main', 'skills', 'map', 'farm', 'qol', 'save'];
  const TAB_LABEL: Record<TabId, string> = { main: 'Fight', skills: 'Skills', map: 'World', farm: 'Farm', qol: 'QOL', save: 'Save' };
  // `gameState`, not `state`: a top-level `state` binding makes svelte2tsx read `$state` as a store
  // subscription and type the whole panel `any` (sveltejs/svelte#13715).
  let gameState = $state<GameState>(newGame());
  let statuses: Statuses = {};
  let running = $state(true);
  let tab: TabId = $state('main');
  /** The town-services drawer, opened for the settlement the character occupies. */
  let overlayOpen = $state(false);
  let mapDetailMode = $state<'town' | 'zone'>('town');
  let saveNote = $state('');

  // The map is a zoomable, pannable sheet: `zoom`/`panX`/`panY` are the viewport transform, and the
  // stage is the overlay's own pixel canvas (presentation only — no coordinate reaches the sim, X33).
  let viewportEl = $state<HTMLDivElement | null>(null);
  let stageEl = $state<HTMLDivElement | null>(null);
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  const MIN_ZOOM = 0.2, MAX_ZOOM = 12;
  let dragging = $state(false);
  let dragged = false;
  let dragFrom = { x: 0, y: 0, px: 0, py: 0 };

  /** The away-window report (parking: "Offline report on return"), filled on mount catch-up + Load. */
  let awayReport = $state<{ mins: number; secs: number; capped: boolean; kills: number; drops: number; junk: number; gold: number; stones: number; levels: number; laps: number; quality: string } | null>(null);

  /** A small counter snapshot so the report diffs the away window instead of showing lifetime totals. */
  function snapCounters(s: GameState) {
    return {
      kills: s.counters.kills, drops: s.counters.drops, junk: s.counters.junk, gold: s.counters.gold,
      stones: Object.values(s.counters.stones).reduce((a, b) => a + b, 0),
      level: s.player.level, laps: s.road?.laps ?? 0, quality: eng.zoneById(s.zone).quality,
    };
  }
  type Snap = ReturnType<typeof snapCounters>;
  function buildAwayReport(before: Snap, mins: number, secs: number, capped: boolean) {
    const a = snapCounters(gameState);
    return {
      mins, secs, capped,
      kills: a.kills - before.kills, drops: a.drops - before.drops, junk: a.junk - before.junk,
      gold: a.gold - before.gold, stones: a.stones - before.stones, levels: a.level - before.level,
      laps: a.laps - before.laps, quality: a.quality,
    };
  }

  let c = $derived(buildCharacter(gameState.player.level, gameState.gear, carried(gameState), masteryLevel(gameState, heldWeaponName(gameState) || ''), effectsActive(gameState.skills), gameState.player.points));
  let zone = $derived(eng.zoneById(gameState.zone));

  // The four regions of the main screen, in the shape the slot grid draws. Order and mode are the
  // player's choice; every value inside a slot is read from the engine, never recomputed here.
  let invMode = $state<'grid' | 'list'>('grid');
  let tempMode = $state<'grid' | 'list'>('grid');
  /** The character sheet splits its two dense halves so each one fits the panel height. */
  let sheetView = $state<'stats' | 'worn'>('stats');
  let invSort = $state<SortKey>('slot');
  let tempSort = $state<SortKey>('rarity');

  const wornOf = (slot: string) => gameState.gear.find((g) => g && g.slot === slot) || null;
  /** the pile the hunt dropped — 50 slots, one piece each, waiting for a decision */
  const tempEntries = $derived(sortEntries(gameState.bag.map((item, i) => gearEntry(item, i)), tempSort));
  /** what the character carries — stones, herbs, draughts and junk, one slot per stack */
  const invEntries = $derived(sortEntries(bagStacks(gameState).map((s, i) => stackEntry(s, i)), invSort));
  /** the twelve worn slots keep their positions, the way an equipment panel does */
  const wornEntries = $derived(
    gameState.gear
      .map((g, i) => (g ? ({ ...gearEntry(g, i), kind: 'worn' } as SlotEntry) : null))
      .filter(Boolean) as SlotEntry[],
  );

  let settings = $state<ClientSettings>({ ...DEFAULT_SETTINGS });
  function setSetting<K extends keyof ClientSettings>(k: K, v: ClientSettings[K]) {
    settings[k] = v;
    void writeSettings(settings);
  }
  /** Number display respects the Settings choice; `short` uses compact notation (12.3k). */
  function fmtNum(n: number): string {
    return settings.numberFormat === 'short'
      ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
      : Math.round(n).toLocaleString('en-US');
  }

  /**
   * The current zone's Hunt Order; clearing it hands the lean back to the mob: every variant carries
   * its own lean (`mob.variant_drops`), and the three normal rungs cycle gear · herb · junk. Either
   * way the lean only shifts weight between the streams, never the total.
   */
  function setHuntOrder(v: 'gear' | 'herb' | 'junk' | 'none') {
    if (!gameState.huntOrder) gameState.huntOrder = {};
    if (v === 'none') delete gameState.huntOrder[gameState.zone];
    else gameState.huntOrder[gameState.zone] = v;
    gameState = { ...gameState };
  }

  /**
   * Pick the hunting ground a spawn rolls inside, for a zone — the one the character stands in unless
   * another zone is named. Empty = the whole cast. Clearing a foreign zone's ground is what lets a click
   * on a hexagon there choose the ground before the walk arrives.
   */
  function setZoneFocus(name: string, zoneId: number = gameState.zone) {
    if (!gameState.zoneFocus) gameState.zoneFocus = {};
    if (!name) delete gameState.zoneFocus[zoneId];
    else gameState.zoneFocus[zoneId] = name;
    gameState = { ...gameState };
  }

  /** Spend or refund stat points. Takes effect on the next tick, so the sheet works mid-combat. */
  function allocate(k: StatKey, delta: number) {
    const p = gameState.player;
    if (delta > 0) {
      const n = Math.min(delta, p.statPoints);
      if (n <= 0) return;
      p.points[k] += n; p.statPoints -= n;
    } else {
      const n = Math.min(-delta, p.points[k]);
      if (n <= 0) return;
      p.points[k] -= n; p.statPoints += n;
    }
    gameState = { ...gameState };
  }
  /** Buy one rank of a passive-tree node; the verdict explains a refusal in the button's title. */
  function doSpendTree(nodeId: string) {
    const r = spendTreePoint(gameState, nodeId);
    if (r.ok) gameState = { ...gameState };
    return r;
  }
  /** The tree respec is free too, and it lives with the stat respec on the town panel. */
  function doRespecTree() {
    respecTree(gameState);
    gameState = { ...gameState };
  }
  /** Free Respec — town only (the button is on the town panel). Hands every allocated point back. */
  function respec() {
    const p = gameState.player;
    let total = 0;
    for (const k of STATS) { total += p.points[k]; p.points[k] = 0; }
    p.statPoints += total;
    gameState = { ...gameState };
  }

  /**
   * §11 field label: the ladder rung this spawn rolled (`mob.variants`), which is what its drop table
   * keys on — a body tier no longer implies the name, since the three normal rungs are their own roll
   * and a two-body species would otherwise never field one of them. A named boss reads its own name.
   */
  function fieldLabel(m: { species: string; speciesId?: string; kind: string; variant?: string }): string {
    const fl = E.mob.field_labels;
    if (m.kind.startsWith('Boss')) return `${m.kind.replace(/^Boss · /, '')}${fl.boss.suffix}`;
    if (m.variant) return m.variant;
    const ladder = m.speciesId ? (E.mob.variants as Record<string, string[]>)[m.speciesId] : null;
    return ladder ? ladder[0] : `${m.species.toLowerCase()}${m.kind === 'Elite' ? fl.elite.suffix : fl.normal.suffix}`;
  }

  function step() {
    // `tick` mutates the state in place. `gameState` is a deep `$state` proxy, so its fine-grained
    // signals fire on their own — no need to clone the whole root and reassign, which used to
    // invalidate every `$derived` (bag sorts, character rebuild) once a second on an idle tick.
    tick(gameState, statuses);
  }

  /** How often the game writes itself back to the last-used slot while it is running. */
  const AUTOSAVE_SEC = 30;

  onMount(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let autosaveTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    // best-effort flush: the away stamp is refreshed so closing the tab loses at most the last slice,
    // and a reload right after cannot count the same absence twice. IndexedDB may not finish inside
    // `beforeunload`, so the interval save is the one that actually bounds the loss.
    const flush = () => { if (lastSlot) void doSave(lastSlot, true); };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    (async () => {
      settings = await readSettings();
      // monotonic clock: catch up on the time between sessions, capped by the save rule. The catch-up
      // yields between slices so a long absence cannot block first paint.
      const away = (Date.now() - (gameState.lastSavedAt || Date.now())) / 1000;
      if (away > 5 && away < 7 * 24 * 3600) {
        const before = snapCounters(gameState);
        const r = await catchUpAsync(gameState, statuses, away);
        awayReport = settings.offlineReport ? buildAwayReport(before, Math.round(away / 60), r.simulated, r.capped) : null;
        push(gameState, `Away ${Math.round(away / 60)} min — ${r.simulated} sec simulated${r.capped ? ' (capped at the offline limit)' : ''}`);
        gameState = { ...gameState };
      }
      // the away window is spent: stamp the clock now, so the next save (timer or manual) does not
      // credit the same absence a second time
      gameState.lastSavedAt = Date.now();
      loadSnaps();
      // the clock is armed only after the catch-up, so a slice boundary cannot add an extra tick
      if (!disposed) {
        timer = setInterval(() => { if (running) step(); }, 1000);
        autosaveTimer = setInterval(flush, AUTOSAVE_SEC * 1000);
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('beforeunload', flush);
      }
    })();
    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      if (autosaveTimer) clearInterval(autosaveTimer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', flush);
    };
  });

  // QOL · keyboard. A key is read only when the focus is not in a field, so typing always wins, and
  // Space is left to a focused button so the button keeps activating the normal way.
  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
    if (e.key === 'Escape') { if (overlayOpen) { overlayOpen = false; e.preventDefault(); } return; }
    if (e.key === ' ') { if (tag === 'BUTTON') return; running = !running; e.preventDefault(); return; }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= TABS.length) tab = TABS[n - 1];
  }
  onMount(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function equip(index: number) {
    // the rule lives in `sim/gear.ts`, where the tests can reach it too; this copy only makes the
    // panel re-read the gameState the verb mutated in place
    equipFromBag(gameState, index);
    gameState = { ...gameState };
  }

  /** A zone is only ever entered on foot, so the Road's encounters fire on the way (never warped). */
  function visitZone(zoneId: number) {
    const s = settlementOfZone(zoneId);
    if (!s) return;
    tab = 'map';
    if (s.id === townId) { openServices('zone'); return; }
    walkTo(s.id);
  }

  /** The slot the player last saved or loaded. Null until they choose, so a fresh in-memory game
   *  never silently autosaves over an existing file. */
  let lastSlot = $state<SlotName | null>(null);

  async function doSave(slot: SlotName, quiet = false) {
    // stamp the wall clock before the write, so the next session's away window starts here (and a
    // reload before the next save cannot count the same absence twice)
    gameState.lastSavedAt = Date.now();
    await writeSave(slot, gameState); // one write may also take a snapshot and arm the next timer
    lastSlot = slot;
    if (!quiet) {
      gameState = { ...gameState };
      saveNote = `Saved to ${slot}`;
      if (slot === snapSlot) await loadSnaps();
    }
  }

  let snaps: Snapshot[] = $state([]);
  let snapSlot = $state<SlotName>('slot1');
  let snapNote = $state('');

  async function loadSnaps() {
    snaps = await listSnapshots(snapSlot);
    snapNote = snaps.length ? '' : 'No backup yet — one is owed on the next level up, craft or timer.';
  }

  async function restore(index: number) {
    const s = await restoreSnapshot(snapSlot, index);
    if (!s) { snapNote = 'That backup is gone'; return; }
    statuses = {};
    normaliseTrip(s);
    gameState = s;
    overlayOpen = false;
    mapDetailMode = 'town';
    const what = describeSnap(snaps[index]);
    await loadSnaps();
    snapNote = `Rewound ${snapSlot} to the backup taken ${what} — the character went back whole, stones and craft counts with it`;
  }

  const describeSnap = (shot?: Snapshot) => (shot ? `${shot.reason} at ${Math.round(shot.clockSec / 60)} min` : '—');

  function editRule(slot: string, patch: Record<string, unknown>) {
    setRule(gameState.filter, slot, patch as any);
    gameState = { ...gameState };
  }

  async function doLoad(slot: SlotName) {
    const s = await readSave(slot);
    if (!s) { saveNote = `${slot} is empty`; return; }
    statuses = {};
    // a save written before the walk arrives with a leg and no blocks; filling the keys here keeps
    // the walk one shape whether it was restored or started fresh
    normaliseTrip(s);
    gameState = { ...s };
    overlayOpen = false;
    mapDetailMode = 'town';
    const away = (Date.now() - (s.lastSavedAt || Date.now())) / 1000;
    const before = snapCounters(gameState);
    const r = await catchUpAsync(gameState, statuses, away);
    awayReport = settings.offlineReport ? buildAwayReport(before, Math.round(away / 60), r.simulated, r.capped) : null;
    // this slot becomes the autosave home, and the away window is spent (a reload must not recount it)
    lastSlot = slot;
    gameState.lastSavedAt = Date.now();
    saveNote = `Loaded ${slot} — ${r.simulated} sec caught up`;
    gameState = { ...gameState };
  }

  function download() {
    const blob = new Blob([exportJson(gameState)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `modworld-${gameState.player.level}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function upload(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      gameState = importJson(await file.text());
      statuses = {};
      overlayOpen = false;
      mapDetailMode = 'town';
      saveNote = 'Imported';
      gameState = { ...gameState };
    } catch (e) {
      saveNote = `Import failed: ${(e as Error).message}`;
    }
  }

  function reset() {
    gameState = newGame();
    statuses = {};
    saveNote = '';
    overlayOpen = false;
    mapDetailMode = 'town';
  }

  // the drawer follows the zone the character is actually hunting, so an auto-travel step cannot
  // leave it showing the town the character walked away from
  const townId = $derived(settlementOfZone(gameState.zone)?.id || 'eastgate');
  const town = $derived(settlementById(townId));
  const selectedZone = $derived(eng.zoneById(gameState.zone));

  /** Open the town-services drawer for the occupied settlement. Unavailable on the Road. */
  function openServices(view: 'town' | 'zone' = 'town') {
    if (gameState.road) { saveNote = 'Reach a settlement before opening its services'; return; }
    mapDetailMode = view;
    overlayOpen = true;
    saveNote = '';
  }

  // ------------------------------------------------------------------ the map: zoom & pan
  /** Frame the whole sheet inside the viewport, centred — the opening view and the `fit` button. */
  function fitMap() {
    const vp = viewportEl, st = stageEl;
    if (!vp || !st || !st.offsetWidth) return;
    // compute into a local, never re-read the `zoom` state: this runs from an $effect, and reading
    // `zoom` here would make the effect track it and re-fit on every zoom, pinning the sheet to fit
    const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(vp.clientWidth / st.offsetWidth, vp.clientHeight / st.offsetHeight)));
    zoom = k;
    panX = (vp.clientWidth - st.offsetWidth * k) / 2;
    panY = (vp.clientHeight - st.offsetHeight * k) / 2;
  }
  /** Zoom by `factor` about a viewport point, so the ground under it stays put. */
  function zoomAt(factor: number, cx: number, cy: number) {
    const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    if (k === zoom) return;
    panX = cx - (cx - panX) * (k / zoom);
    panY = cy - (cy - panY) * (k / zoom);
    zoom = k;
    clampPan();
  }
  function zoomBy(factor: number) {
    if (viewportEl) zoomAt(factor, viewportEl.clientWidth / 2, viewportEl.clientHeight / 2);
  }
  /**
   * Keep the sheet inside its own area: past its edges the pan stops, and a sheet smaller than the
   * viewport is centred — so a drag can never push the map out into the screen around it. Called from
   * the event handlers only, never from the `fit` effect, which must not read the pan (see fitMap).
   */
  function clampPan() {
    const vp = viewportEl, st = stageEl;
    if (!vp || !st) return;
    const w = st.offsetWidth * zoom, h = st.offsetHeight * zoom;
    panX = w <= vp.clientWidth ? (vp.clientWidth - w) / 2 : Math.min(0, Math.max(vp.clientWidth - w, panX));
    panY = h <= vp.clientHeight ? (vp.clientHeight - h) / 2 : Math.min(0, Math.max(vp.clientHeight - h, panY));
  }
  function onWheel(e: WheelEvent) {
    if (!viewportEl) return;
    e.preventDefault();
    const rect = viewportEl.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
  }
  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = true;
    dragged = false;
    dragFrom = { x: e.clientX, y: e.clientY, px: panX, py: panY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragFrom.x, dy = e.clientY - dragFrom.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
    if (dragged) { panX = dragFrom.px + dx; panY = dragFrom.py + dy; clampPan(); }
  }
  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    // a drag that ends off-target never fires a click, so clear the guard on the next task either way
    if (dragged) setTimeout(() => { dragged = false; }, 0);
  }
  // the sheet is framed every time its tab opens, and again if the window is resized while it is up
  $effect(() => {
    if (tab !== 'map' || !viewportEl || !stageEl) return;
    fitMap();
    const onResize = () => fitMap();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  /**
   * The whole lattice is the travel map: every hex registers the place it belongs to, so a click reads
   * an id and never a coordinate (M7 · M10 · X33). A sub-zone hex of the zone the character stands in
   * picks the hunting ground; a sub-zone hex anywhere else is walked to with its settlement, because the
   * Road's encounters are the whole point of crossing. A settlement's own block opens its services where
   * the character stands, and is a journey (warp when a checkpoint link is open, else a walk) anywhere else.
   */
  function pickOnMap(ev: MouseEvent) {
    if (dragged) { dragged = false; return; }
    const el = (ev.target as Element)?.closest?.('[data-node]') as SVGElement | null;
    const id = el?.getAttribute('data-node');
    if (!id) return;
    const sub = el?.getAttribute('data-sub');
    if (sub) {
      if (id === townId) { setZoneFocus(sub); saveNote = `Hunting ground: ${sub}`; }
      else {
        // the ground is chosen for its own zone, so the walk arrives on it rather than the whole cast
        const zone = settlementById(id)?.zone;
        if (zone != null) setZoneFocus(sub, zone);
        walkTo(id);
      }
      return;
    }
    if (id === townId) {
      if (el?.getAttribute('data-pod')) openServices();
      else saveNote = `You are already in ${town.name}`;
      return;
    }
    if (canTravel(gameState, id)) travelTo(id);
    else walkTo(id);
  }

  /** Lay a route to a settlement and walk it, block by block — the only way into a zone. */
  function walkTo(id: string) {
    if (gameState.road) { saveNote = 'Already on the Road'; return; }
    const r = plotRoute(gameState, id);
    saveNote = r.ok
      ? `Walking to ${settlementById(id)?.name} · ${r.route?.length} links`
      : `Cannot walk: ${r.why}`;
    gameState = { ...gameState };
  }

  // The map is inlined verbatim: the sheet draws names and hexes and nothing else, so the client has no
  // mark to toggle and reads no coordinate — only the ids already on each hex (M7 · M9). The strip drops
  // the XML prolog, which is not valid inside HTML.
  const stripProlog = (s: string) => s.replace(/^<\?xml[^>]*\?>\s*/, '');
  const prologued = stripProlog(mapOverlayRaw);
  /** The sheet's own pixel canvas, read off the overlay rather than typed again here (M7). */
  const CANVAS = (() => {
    const m = prologued.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    return { w: m ? Number(m[1]) : 2000, h: m ? Number(m[2]) : 1200 };
  })();
  /**
   * An SVG clips at its own viewBox, and an outer cluster's far hex can overhang the canvas by up to one
   * hex pitch — so a rim sub-zone would be cut in half. Widening both viewBoxes by `MAP_BLEED` and growing
   * the stage to match draws every hex whole. Presentation only: no coordinate reaches the sim (X33 · M7).
   */
  const MAP_BLEED = 72;
  const bleed = (s: string) => s.replace(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/,
    (_, w, h) => `viewBox="${-MAP_BLEED} ${-MAP_BLEED} ${Number(w) + 2 * MAP_BLEED} ${Number(h) + 2 * MAP_BLEED}"`);
  const mapW = CANVAS.w + 2 * MAP_BLEED;
  const mapH = CANVAS.h + 2 * MAP_BLEED;
  const mapTerrain = $derived(bleed(stripProlog(mapTerrainRaw)));
  const mapMarkup = $derived(bleed(prologued));
  const townStock = $derived(stockOf(town?.id));
  const junkTotal = $derived(Object.values(gameState.junk).reduce((a: number, b: number) => a + b, 0));
  /** Unsold junk as "item ×count", biggest stack first — the record of which variants were farmed. */
  const junkLines = $derived(Object.entries(gameState.junk)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([item, n]) => `${item} ×${n}`));

  function doSell() {
    const r = sellJunk(gameState);
    push(gameState, `Counterhand: sold ${r.pieces} junk for ${r.gold} gold`);
    gameState = { ...gameState };
  }

  function doBuy(rowId: string) {
    const r = buy(gameState, town.id, rowId);
    saveNote = r.ok ? `Bought ${r.row.item}` : `Cannot buy: ${r.why}`;
    gameState = { ...gameState };
  }

  function doClaim(i: number) {
    const t = gameState.town.tasks[i];
    if (t && claimTask(gameState, i)) push(gameState, `Task paid: ${t.count} ${t.stone} stone(s)`);
    gameState = { ...gameState };
  }

  function travelTo(id: string) {
    const s = settlementById(id);
    if (!canTravel(gameState, id)) {
      saveNote = `${s?.name} is not reachable by checkpoint yet — walk the Road to open it`;
      return;
    }
    if (!gameState.town.visited.includes(id)) gameState.town.visited.push(id);
    // a manual jump is the new floor: a later Push in Forward Mode falls back to the zone just left
    gameState.forwardSafe = gameState.zone;
    gameState.zone = s.zone;
    gameState.group = [];
    gameState.town.waypoint = id;
    push(gameState, `Warped to ${s.name}`);
    saveNote = `Warped to ${s.name}`;
    gameState = { ...gameState };
  }

  let bench = $state<{ where: Where; index: number } | null>(null);
  let benchNote = $state('');
  const benchItem = $derived(bench ? (bench.where === 'gear' ? gameState.gear[bench.index] : gameState.bag[bench.index]) : null);

  function runCraft(op: CraftOp, lineIndex: number) {
    if (!bench) return;
    const rng = mulberry32(gameState.rngState);
    gameState.rngState += 1;
    const r = doCraft(gameState, bench.where, bench.index, op, lineIndex, rng);
    benchNote = r.ok ? `${op}: ${r.note}` : `${op} refused — ${r.why}`;
    if (r.ok) push(gameState, `Bench ${op} · ${r.note}`);
    gameState = { ...gameState };
  }

  /** The published success curve for the step the bench is about to attempt. */
  function upgradeChance(): string {
    if (!benchItem) return '—';
    return String(Math.round(craft.successPct((benchItem.upgrade_lv || 0) + 1)));
  }

  let skillNote = $state('');
  let farmNote = $state('');
  const fl = $derived(farmLevel(gameState));
  const plots = $derived(plotCount(gameState));

  function doPlant(i: number, tier: string) {
    const r = plant(gameState, i, tier);
    farmNote = r.ok ? `Plot ${i + 1}: ${tier} herb in the ground, ready in ${farm.F.growth_hours} h` : `Plot ${i + 1}: ${r.why}`;
    gameState = { ...gameState };
  }

  function doHarvest(i: number) {
    const r = harvest(gameState, i);
    farmNote = r.ok ? `Plot ${i + 1}: +${r.herbs} herbs · +${r.xp} Farm XP` : `Plot ${i + 1}: ${r.why}`;
    gameState = { ...gameState };
  }

  function doBrew(name: string) {
    const r = craftPotion(gameState, name);
    farmNote = r.ok ? `Brewed ${name}` : `${name}: ${r.why}`;
    gameState = { ...gameState };
  }

  function doCondense(name: string) {
    const r = condense(gameState, name);
    farmNote = r.ok ? `Condensed ${name} · ${farm.P.condensed.effect_mult}× in one bottle` : `${name}: ${r.why}`;
    gameState = { ...gameState };
  }

  let townNote = $state('');
  const tabs = $derived(stashTabCount(gameState));

  function doDeposit(i: number, tab: number) {
    const r = deposit(gameState, i, tab);
    townNote = r.ok ? 'Deposited into the stash' : `Deposit refused: ${r.why}`;
    gameState = { ...gameState };
  }

  function doWithdraw(tab: number, i: number) {
    const r = withdraw(gameState, tab, i);
    townNote = r.ok ? 'Withdrawn into the bag' : `Withdrawal refused: ${r.why}`;
    gameState = { ...gameState };
  }

  function doDepositAll(tab: number) {
    const n = depositMany(gameState, gameState.bag.map((_, i) => i), tab);
    townNote = n ? `Deposited ${n} piece${n === 1 ? '' : 's'} into tab ${tab + 1}` : 'Nothing to deposit — every piece is locked or the bag is empty';
    gameState = { ...gameState };
  }

  function doWithdrawAll(tab: number) {
    const n = withdrawMany(gameState, tab, (gameState.stash[tab] || []).map((_, i) => i));
    townNote = n ? `Withdrew ${n} piece${n === 1 ? '' : 's'} from tab ${tab + 1}` : 'Nothing to withdraw — every piece is locked';
    gameState = { ...gameState };
  }

  /** A locked piece is skipped by bulk deposit/withdraw, the bag swap and auto-dissolve. */
  function toggleLock(item: Item) {
    item.locked = !item.locked;
    gameState = { ...gameState };
  }

  /** The Circuit editor's working list, validated against the Road rules before it can start. */
  let circuitDraft = $state<number[]>([]);
  const draftCheck = $derived(circuitValid(gameState, circuitDraft));
  function toggleCircuitLink(i: number) {
    circuitDraft = circuitDraft.includes(i) ? circuitDraft.filter((x) => x !== i) : [...circuitDraft, i];
  }
  function doStartCircuit() {
    const r = startCircuit(gameState, circuitDraft);
    townNote = r.ok ? 'Circuit set — the Road will loop it until stopped' : `Circuit refused: ${r.why}`;
    if (r.ok) circuitDraft = [];
    gameState = { ...gameState };
  }
  function doStopCircuit() {
    const r = stopCircuit(gameState);
    townNote = r.ok ? 'Circuit cleared' : `Cannot stop: ${r.why}`;
    gameState = { ...gameState };
  }

  function doTrip(i: number) {
    const r = startTrip(gameState, i);
    const blocks = road.blocksFor(i);
    townNote = r.ok
      ? `Walking ${linkLabel(i)} · ${blocks} blocks of ${road.blockSec}s, ${road.encountersFor(i)} encounters`
      : `Cannot start: ${r.why}`;
    gameState = { ...gameState };
  }

  function doSwitchPreset(i: number) {
    switchPreset(gameState, i);
    skillNote = `Loaded ${gameState.presets[i].name}`;
    gameState = { ...gameState };
  }

  function doStorePreset() {
    storePreset(gameState);
    skillNote = `Saved ${gameState.presets[gameState.activePreset].name}`;
    gameState = { ...gameState };
  }

  function doBind(i: number) {
    bindZone(gameState, i, gameState.zone);
    skillNote = `${gameState.presets[i].name} now ${gameState.presets[i].zones.includes(gameState.zone) ? 'binds' : 'unbinds'} ${eng.zoneById(gameState.zone).name}`;
    gameState = { ...gameState };
  }

  const colSet = $derived(col.setAt(town?.id));
  function doTurnIn() {
    const r = turnIn(gameState, town.id);
    townNote = r.ok ? `Turned in the ${colSet.name} set · reward: ${r.reward}` : `Turn-in refused: ${r.why}`;
    gameState = { ...gameState };
  }

  const bar = (value: number, max: number) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;

  // Display cap only: `final_pct` is stored at full precision and the engine reads it for cast
  // damage, so the panel shows at most 2 decimals without forcing trailing zeros.
  const pct2 = (x: number) => Math.round(x * 100) / 100;

  const ownedActives = $derived(sm.all().filter((k: any) => ['attack', 'curse', 'heal'].includes(k.type) && gameState.skills.owned[k.id] != null));
  const ownedBuffs = $derived(sm.of('buff').filter((k: any) => gameState.skills.owned[k.id] != null));
  const ownedAuras = $derived(sm.of('aura').filter((k: any) => gameState.skills.owned[k.id] != null));
  const reserved = $derived(reservedPct(gameState.skills));

  function setSlot(i: number, id: string) {
    const at = gameState.skills.list.indexOf(id);
    if (at >= 0) gameState.skills.list[at] = null;
    gameState.skills.list[i] = id || null;
    gameState = { ...gameState };
  }

  /** §14: the per-slot switch, and the one shared condition list every `conditional` slot reads. */
  function setMode(id: string, mode: string) {
    gameState.skills.mode[id] = mode as any;
    gameState = { ...gameState };
  }

  function setConditions(patch: { boss?: boolean; hpBelowPct?: number; statusMissing?: string[] }) {
    gameState.skills.conditions = { ...gameState.skills.conditions, ...patch };
    gameState = { ...gameState };
  }

  /** §14c: a magic weapon has no swing, it flicks a bolt worth the attack ladder's floor. */
  const basicAttack = $derived(eng.basicAttackOf(BASES, c.weaponName));
  const boltPct = $derived(sm.ladderFloorPct());
  // a plain concatenation, not a template literal: Svelte's markup parser ends the expression at
  // the first brace it meets inside one
  const basicAttackLine = $derived(basicAttack === 'bolt'
    ? " · a press on the attack clock, no mana, worth " + boltPct.toFixed(0) + "% of your spell hit (the attack ladder's floor)"
    : " · the weapon's own swing");

  /** What is on the player right now, in words — a stopped attack needs an explanation on screen. */
  const activeStatusWords = $derived(
    Object.entries(statuses)
      .filter(([, st]: any) => st && (st.secLeft || 0) > 0)
      .map(([name, st]: any) => `${name}${st.stacks > 1 ? ` ×${st.stacks}` : ''} ${Math.ceil(st.secLeft)}s`)
      .join(' · '),
  );

  /** One flag per Element status a row can apply (the five `elements.status_of` names)⬦ */
  const statusFlags = $derived(Object.values((E.elements as any).status_of || {}) as string[]);
  /** …and one per curse row, keyed by the row's own id — the two kinds share the one list (§14). */
  const curseFlags = $derived(sm.of('curse') as any[]);
  function toggleStatusMissing(name: string) {
    const now = gameState.skills.conditions.statusMissing || [];
    setConditions({ statusMissing: now.includes(name) ? now.filter((n) => n !== name) : [...now, name] });
  }

  /** What a curse has written on one mob, in words and with the seconds left on each line. */
  function curseWords(id: string): string {
    const lines = gameState.curses[id];
    if (!lines) return '';
    return Object.values(lines)
      .map((l) => `${EFFECT_LABEL[l.stat] || l.stat} ${l.value > 0 ? '+' : ''}${l.value}%` +
        `${l.condition ? ` while ${l.condition}` : ''} · ${l.secLeft}s left`)
      .join(' · ');
  }

  /** The purse in words, using the names the bench itself charges by. */
  function stonesLine(): string {
    const held = Object.entries(gameState.counters.stones).filter(([, n]) => (n as number) > 0);
    if (!held.length) return 'no stones yet';
    return held.map(([k, n]) => `${stoneName(k)} ${n}`).join(' · ');
  }

  function setTravel(mode: 'stay' | 'forward') {
    gameState.travel = mode;
    gameState = { ...gameState };
    push(gameState, mode === 'forward'
      ? 'Climbing: the walk moves on through settlements already opened, and falls back to the last zone held when a Push lands'
      : 'Staying: you farm this zone until you travel yourself');
    gameState = { ...gameState };
  }

  /** What the character has put on one mob: the DoT and debuff lines, with stacks and seconds. */
  function statusWords(id: string): string {
    const m = gameState.mobStatus[id];
    if (!m) return '';
    return Object.entries(m.statuses)
      .filter(([, l]) => l.stacks > 0 || l.secLeft > 0)
      .map(([name, l]) => statusLabel(name)
        + (l.stacks > 1 ? ' ×' + l.stacks : '')
        + (l.secLeft > 0 && l.secLeft < 90 ? ' ' + l.secLeft + 's' : ''))
      .join(' · ');
  }

  function toggle(id: string) {
    // the reservation rule and the buff switch both live in sim/skills.ts, so no sum is repeated here
    const r = toggleTrack(gameState.skills, id);
    saveNote = r.ok ? '' : r.why || 'cannot';
    gameState = { ...gameState };
  }
</script>

<header class="topbar">
  <div class="brand" aria-label="ModWorld">
    <span class="brand-mark" aria-hidden="true"></span>
    <b>ModWorld</b>
  </div>
  <nav class="tabs" aria-label="Game screens">
    {#each TABS as t}
      <button class="tab" class:active={tab === t} aria-current={tab === t ? 'page' : undefined} onclick={() => (tab = t)}>{TAB_LABEL[t]}</button>
    {/each}
  </nav>
  <div class="status">
    <!-- Pause lives here rather than on the Fight panel so it stays reachable from every screen. -->
    <button class="chip run" class:paused={!running} onclick={() => (running = !running)} title={running ? 'Pause the game' : 'Resume the game'}>
      <span class="dot" aria-hidden="true"></span>{running ? 'running' : 'paused'}
    </button>
    <span class="chip">{zone.name}</span>
    <span class="chip">L{gameState.player.level}</span>
    <span class="chip num">{fmtNum(gameState.counters.kills)} kills</span>
    <span class="chip num gold">{fmtNum(gameState.counters.gold)} gold</span>
  </div>
</header>

<main class="screen" class:main-screen={tab === 'main'} class:map-screen={tab === 'map'}>
{#if tab === 'main'}
  <div class="main">
    <section class="panel region scene">
      <h2>Combat · {zone.name}</h2>
      {#if awayReport}
        <div style="display:flex;gap:.5rem;align-items:baseline;flex-wrap:wrap;border:1px solid #8a7048;border-radius:6px;padding:.4rem .6rem;margin:.3rem 0;font-size:.85rem">
          <button onclick={() => (awayReport = null)} aria-label="Dismiss" style="background:none;border:none;cursor:pointer;color:inherit">✕S"</button>
          <strong>Welcome back</strong>
          <span>away {awayReport.mins}m {awayReport.secs}s{awayReport.capped ? ' · capped' : ''}</span>
          <span>+{fmtNum(awayReport.kills)} kills · {fmtNum(awayReport.drops)} drops · {fmtNum(awayReport.stones)} stones · {fmtNum(awayReport.gold)} gold{awayReport.levels ? ` · +${awayReport.levels} levels` : ''}{awayReport.laps ? ` · ${awayReport.laps} laps` : ''}</span>
        </div>
      {/if}
    <div class="bars">
      <!-- character-sheet.md: Energy Shield sits above HP while it is present -->
      {#if c.es > 0}
        <label>Energy Shield <progress class="es" max={c.es} value={gameState.player.es}></progress> {Math.round(gameState.player.es)} / {Math.round(c.es)}</label>
      {/if}
      <label>HP <progress class="hp" max={c.maxHp} value={gameState.player.hp}></progress> {fmtNum(gameState.player.hp)} / {fmtNum(c.maxHp)} (+{c.hpRegen.toFixed(0)}/sec)</label>
      <label>Mana <progress class="mana" max={c.maxMana} value={gameState.player.mana}></progress> {fmtNum(gameState.player.mana)} / {fmtNum(c.maxMana)}</label>
      {#if activeStatusWords}
        <p class="statuses"><small>On you: {activeStatusWords}</small></p>
      {/if}
      <label>XP <progress class="xp" max={eng.xpToNext(gameState.player.level)} value={gameState.player.xp}></progress> {fmtNum(gameState.player.xp)} / {fmtNum(eng.xpToNext(gameState.player.level))}</label>
      <!-- character-sheet.md's main panel: HP, Mana and Attack speed are the three always shown; Weight lives on the character bag panel -->
      <span>Attack speed {c.hitsPerSec.toFixed(2)} hits/sec <small>(Cap {E.caps.aspd})</small></span>
    </div>
    <!-- the skill bar, read-only on the fight panel: arranging the order stays on the Skills tab -->
    <div class="skill-strip" role="list" aria-label="Skill bar">
      {#each gameState.skills.list as id, i}
        {@const k = id ? sm.byId[id] : null}
        <span class="skill-slot" class:empty={!id || !k} role="listitem" title={`Slot ${i + 1}${id && k ? ': ' + k.name : ': empty'}`}>
          {#if id && k}
            <span class="skill-label">{@html skillIcon(k.id, k.type, k.element)}{k.name}</span>
            <small class:ready={(gameState.skills.cd[id] || 0) <= 0}>{(gameState.skills.cd[id] || 0) <= 0 ? 'ready' : `${(gameState.skills.cd[id] || 0).toFixed(1)}s`}</small>
          {/if}
        </span>
      {/each}
    </div>
    <p class="state">
      <label class="travel">Hunt zone
        <button class={gameState.travel === 'stay' ? 'active' : ''} onclick={() => setTravel('stay')}>stay here</button>
        <button class={gameState.travel === 'forward' ? 'active' : ''} onclick={() => setTravel('forward')}>forward</button>
        <small>{gameState.travel === 'forward' ? `Advance past level ${zone.levels[1]}; Push falls back one zone.` : 'Stay until you choose another zone.'}</small>
      </label>
    </p>
    <p class="state">
      <label class="travel">Hunt order
        <button class={gameState.huntOrder?.[gameState.zone] === undefined ? 'active' : ''} onclick={() => setHuntOrder('none')}>by variant</button>
        <button class={gameState.huntOrder?.[gameState.zone] === 'gear' ? 'active' : ''} onclick={() => setHuntOrder('gear')}>gear</button>
        <button class={gameState.huntOrder?.[gameState.zone] === 'herb' ? 'active' : ''} onclick={() => setHuntOrder('herb')}>herbs</button>
        <button class={gameState.huntOrder?.[gameState.zone] === 'junk' ? 'active' : ''} onclick={() => setHuntOrder('junk')}>junk</button>
        <small>By variant uses each mob's default bias. Overrides change the loot mix, not total drops.</small>
      </label>
      <label class="travel">Hunting ground
        <select onchange={(e) => setZoneFocus((e.target as HTMLSelectElement).value)}>
          <option value="" selected={!gameState.zoneFocus?.[gameState.zone]}>the whole cast</option>
          {#each (eng.zoneById(gameState.zone).subzones || []) as sub}
            <option value={sub.name} selected={gameState.zoneFocus?.[gameState.zone] === sub.name}>{sub.name} · {sub.element} · {sub.races.join(' + ')}</option>
          {/each}
        </select>
        <small>Spawns use the selected cast. Elite and Boss remain zone-wide.</small>
      </label>
    </p>
    <p class="state">
      {#if gameState.phase === 'camp'}Pushed · camp {gameState.campSec}s{:else}Fighting · {c.weaponName} · {c.hitsPerSec.toFixed(2)} hits/s · {c.weaponElement || 'no Element'}{/if}
    </p>
    <table>
      <thead><tr><th>Target</th><th>Body</th><th>HP</th><th>PS</th><th>Hit vs</th><th>Dodge</th><th>Innate</th><th>Under a curse</th></tr></thead>
      <tbody>
        {#each gameState.group as m}
          <tr>
            <td>
              <span class="mob-name" class:elite={m.kind === 'Elite'} class:boss={m.kind.startsWith('Boss')}><img src={mobIcon(m.species)} alt="" aria-hidden="true" />{fieldLabel(m)}{#if m.kind.startsWith('Boss')}<img class="tier-mark" src={bossMark} alt="" aria-hidden="true" />{/if}</span>
            </td>
            <td>{m.kind}</td>
            <td><span class="mobbar" style={'width:' + bar(m.hp, m.hpMax)}></span> {Math.max(0, Math.round(m.hp))} / {Math.round(m.hpMax)}</td>
            <td>{(m.ps * psMult(modsOn(gameState.curses, m.id))).toFixed(1)}</td>
            <td>{(eng.hitChance(c.accuracy, m.evasion) * 100).toFixed(1)}%</td>
            <td>{eng.dodgeChance(m.dodgeRate, c.accuracy).toFixed(1)}%</td>
            <td>
              <span class="element-list">
                {#each m.innate as element}
                  <span class="element-label"><img src={elementIcon(element)} alt="" aria-hidden="true" />{element}</span>
                {/each}
              </span>
            </td>
            <td>{[curseWords(m.id), statusWords(m.id)].filter(Boolean).join(' | ') || '—'}</td>
          </tr>
        {:else}
          <tr><td colspan="8">No mob on screen — the next group walks in.</td></tr>
        {/each}
      </tbody>
    </table>
    <div class="log">
      {#each gameState.log.slice(0, 12) as line}
        <div><span class="t">{line.sec}s</span> {line.text}</div>
      {:else}
        <div class="empty">No events yet — the log fills as the hunt runs.</div>
      {/each}
    </div>
    <div class="controls">
      <button onclick={step}>One tick</button>
      <button onclick={() => { if (confirm('Start a new character?')) reset(); }}>New character</button>
    </div>
    </section>

    <section class="panel region sheet">
      <div class="sheet-head">
        <h2>Character sheet · level {gameState.player.level}</h2>
        <div class="seg" role="tablist" aria-label="Character sheet view">
          <button role="tab" aria-selected={sheetView === 'stats'} class:active={sheetView === 'stats'} onclick={() => (sheetView = 'stats')}>Stats</button>
          <button role="tab" aria-selected={sheetView === 'worn'} class:active={sheetView === 'worn'} onclick={() => (sheetView = 'worn')}>Worn · {gameState.gear.filter(Boolean).length} / {E.stat.item_slots}</button>
        </div>
      </div>

      {#if sheetView === 'worn'}
        <SlotGrid entries={wornEntries} capacity={E.stat.item_slots} wornOf={wornOf} fixed layout="doll" />
        <p class="gate"><small>Weight <b>{c.weightUsed.toFixed(0)}</b> / {Math.round(c.weightCap)}{c.encumbrance > 0 ? ` · aspd ${(c.encumbrance * -100).toFixed(0)}%` : ' · no tax'}</small></p>
      {:else}
      <p><small>Unspent <b>{gameState.player.statPoints}</b> · tree <b>{gameState.player.treePoints}</b> · <label><input type="checkbox" checked={gameState.player.autoSpend} onchange={() => { gameState.player.autoSpend = !gameState.player.autoSpend; gameState = { ...gameState }; }} /> auto-allocate</label></small></p>
      <table class="stats">
        <tbody>
          {#each STATS as k}
            <tr>
              <td>{k.toUpperCase()}</td>
              <td>{c.core[k].toFixed(1)}</td>
              <td>
                <button onclick={() => allocate(k, -1)} disabled={gameState.player.autoSpend || !gameState.player.points[k]}>−</button>
                <button onclick={() => allocate(k, 1)} disabled={gameState.player.autoSpend || gameState.player.statPoints <= 0}>+</button>
                <button onclick={() => allocate(k, gameState.player.statPoints)} disabled={gameState.player.autoSpend || gameState.player.statPoints <= 0}>Max</button>
                <small> {gameState.player.points[k]} pts</small>
              </td>
            </tr>
          {/each}
          <tr><td>Weapon</td><td>{c.weaponName} · {masteryLabel(c.weaponMastery)} · drop bonus {dropBonusPct(gameState)}%</td></tr>
          <tr><td>Attack speed</td><td>{c.aspd.toFixed(1)} aspd · {c.hitsPerSec.toFixed(2)} hits/sec (Cap {E.caps.aspd})</td></tr>
          <tr><td>Physical power</td><td>{Math.round(c.phys)}</td></tr>
          <tr><td>Magic power</td><td>{Math.round(c.magic)}</td></tr>
          <tr><td>Accuracy</td><td>{Math.round(c.accuracy)}</td></tr>
          <tr><td>Evasion</td><td>{Math.round(c.evasion)} rating · {c.evasionChance.toFixed(1)}% → Cap {E.caps.evasion}%</td></tr>
          <tr><td>Armour</td><td>{Math.round(c.armour)}</td></tr>
          <tr><td>Perfect dodge</td><td>{c.perfectDodge.toFixed(1)}% → Cap {E.caps.perfect_dodge}%</td></tr>
          <tr><td>Crit</td><td>{c.critChance.toFixed(1)}% chance · {c.critDmg.toFixed(0)}% damage</td></tr>
          <tr><td>Resistance</td><td>{c.resistance.toFixed(1)}% (Cap {E.caps.elem_res})</td></tr>
          <tr><td>Basic attack</td><td>{basicAttack}{basicAttackLine}</td></tr>
          <tr><td>Stun Recovery</td><td>{c.stunRecovery.toFixed(1)}% · stop {(E.status.shock.stop_sec * (1 - c.stunRecovery / 100)).toFixed(2)}s</td></tr>
          <tr><td>Alignment</td><td>{c.alignment.toFixed(1)}%{E.caps.alignment == null ? ' · uncapped' : ` / ${E.caps.alignment}%`}</td></tr>
          <tr><td>Cooldown reduction</td><td>{c.cdr.toFixed(1)}% (Cap {E.caps.cdr})</td></tr>
          <tr><td>Energy Shield</td><td>{Math.round(c.es)} · regens {c.esRegen.toFixed(1)}/sec after {E.energy_shield.delay_sec} sec ({E.energy_shield.regen_pct}% of the pool, amplified by an es_regen line)</td></tr>
          <tr><td>Weight</td><td>{c.weightUsed.toFixed(0)} used / {Math.round(c.weightCap)} capacity{c.encumbrance > 0 ? ` · aspd ${(c.encumbrance * -100).toFixed(0)}%` : ' · no tax'}</td></tr>
        </tbody>
      </table>

      <h3>The gate</h3>
      <p class="gate">{describeGoal()}</p>
      <p><small>
        {#if gameState.goal.done}
          Complete · L{gameState.goal.done.level} · {gameState.goal.attempts} spawns
        {:else}
          {gameState.goal.attempts === 0 ? 'Awaiting first boss spawn' : `${gameState.goal.attempts} attempts · Push resets the attempt`}
        {/if}
      </small></p>
      {/if}
    </section>

    <section class="panel region temp">
      <h2>Temp inventory · adventure bag ({gameState.bag.length} / {E.inventory.adventure_slots})</h2>
      {#if gameState.bag.length >= E.inventory.adventure_slots}
        <p class="warn"><b>Bag full · pickups stopped.</b> Return to {settlementById(gameState.town.waypoint)?.name || 'a settlement'} and deposit. {fmtNum(gameState.counters.overflow || 0)} drops were missed.</p>
      {:else}
        <p><small>Equip kept drops manually.</small></p>
      {/if}
      <SlotGrid
        entries={tempEntries}
        capacity={E.inventory.adventure_slots}
        mode={tempMode}
        onmode={(m) => (tempMode = m)}
        sort={tempSort}
        onsort={(k) => (tempSort = k)}
        wornOf={wornOf}
        onequip={equip}
        empty="Nothing yet — kills still drop, and the bag filter is the zone upgrade rate."
      />

      <details class="filter">
        <summary>Filter rules</summary>
        <p><small>Off keeps all drops. Enabled failures dissolve into Reroll value; stones stay.</small></p>
        <table>
          <thead><tr><th>Slot</th><th>Filter</th><th>Keep when it beats the worn piece by</th><th>Rarity floor</th><th>Also keep an Element you cannot resist</th><th>The rule in words</th></tr></thead>
          <tbody>
            {#each FILTER_SLOTS as slot}
              {@const r = ruleFor(gameState.filter, slot)}
              <tr>
                <td>{slot}</td>
                <td><input type="checkbox" checked={r.enabled} onchange={(e) => editRule(slot, { enabled: (e.target as HTMLInputElement).checked })} /></td>
                <td><input type="number" min="0" step="1" value={r.margin_pct} disabled={!r.enabled} onchange={(e) => editRule(slot, { margin_pct: Number((e.target as HTMLInputElement).value) })} /> %</td>
                <td>
                  <select disabled={!r.enabled} onchange={(e) => editRule(slot, { min_rarity: (e.target as HTMLSelectElement).value })}>
                    {#each RARITY_CHOICES as k}<option value={k} selected={r.min_rarity === k}>{k === 'any' ? 'any Rarity' : k}</option>{/each}
                  </select>
                </td>
                <td><input type="checkbox" checked={r.keep_missing_element} disabled={!r.enabled} onchange={(e) => editRule(slot, { keep_missing_element: (e.target as HTMLInputElement).checked })} /></td>
                <td>{describeRule(r)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p><small>Missing res: <b>{gameState.filter.missing.elements.join(', ') || 'none'}</b> · empty slots: <b>{gameState.filter.missing.slots.join(', ') || 'none'}</b></small></p>
      </details>
    </section>

    <section class="panel region inv">
      <h2>Inventory · character bag ({slotsUsed(gameState)} / {slotsAvailable(gameState)} slots)</h2>
      <p class="weight">Weight <b>{c.weightUsed.toFixed(0)}</b> / {Math.round(c.weightCap)} <small>{c.encumbrance > 0 ? `· aspd ${(c.encumbrance * -100).toFixed(0)}%` : '· no tax'}</small></p>
      <SlotGrid
        entries={invEntries}
        capacity={slotsAvailable(gameState)}
        mode={invMode}
        onmode={(m) => (invMode = m)}
        sort={invSort}
        onsort={(k) => (invSort = k)}
        wornOf={wornOf}
        empty="Nothing carried yet — stones, herbs, draughts and junk all land in these slots."
      />
      <p><small>Stacks: stones/junk {E.inventory.stack_size.stone} · herbs/potions {E.inventory.stack_size.herb} · gold uses no slot · stopped grants {gameState.counters.stopped || 0}.</small></p>
    </section>
  </div>
{/if}

{#if tab === 'skills'}
  <section class="panel">
    <h2>Skill bar · {ACTIVE_SLOTS} slots, cast top-down</h2>
    <div class="presets">
      {#each gameState.presets as p, i}
        <button class:active={i === gameState.activePreset} onclick={() => doSwitchPreset(i)}>
          {p.name}{p.zones.length ? ` · ${p.zones.length} zone${p.zones.length > 1 ? 's' : ''}` : ''}
        </button>
      {/each}
      <button onclick={doStorePreset}>save current</button>
      <button onclick={() => doBind(gameState.activePreset)}>
        {gameState.presets[gameState.activePreset].zones.includes(gameState.zone) ? 'unbind this zone' : 'bind this zone'}
      </button>
    </div>
    <p><small>{skillNote || `First ready skill with enough mana casts. Push restores Main; cooldowns continue.`}</small></p>
    <p><small>Usable mana {Math.round(c.maxMana * (1 - reserved / 100))} · reserved {reserved}% · slots fire top-down. Set each to Always, Conditional or Never.</small></p>
    <p class="conditions"><small>Conditions</small>
      <label><input type="checkbox" checked={gameState.skills.conditions.boss} onchange={(e) => setConditions({ boss: (e.target as HTMLInputElement).checked })} /> against a boss</label> ·
      <label><input type="checkbox" checked={gameState.skills.conditions.hpBelowPct > 0} onchange={(e) => setConditions({ hpBelowPct: (e.target as HTMLInputElement).checked ? 50 : 0 })} /> while HP is under</label>
      <input type="number" min="0" max="100" value={gameState.skills.conditions.hpBelowPct} onchange={(e) => setConditions({ hpBelowPct: Number((e.target as HTMLInputElement).value) })} />% of the pool ·
      {#each statusFlags as st}<label><input type="checkbox" checked={(gameState.skills.conditions.statusMissing || []).includes(st)} onchange={() => toggleStatusMissing(st)} /> while the target has no {st}</label>{' '}{/each}
      {#each curseFlags as cf}<label><input type="checkbox" checked={(gameState.skills.conditions.statusMissing || []).includes(cf.id)} onchange={() => toggleStatusMissing(cf.id)} /> while {cf.name} is not on it</label>{/each}</p>
    <table>
      <thead><tr><th>#</th><th>Skill</th><th>Worth</th><th>Level</th><th>cd → eff</th><th>Mana</th><th>Next in</th><th>When</th><th>Place</th></tr></thead>
      <tbody>
        {#each gameState.skills.list as id, i}
          {@const k = id ? sm.byId[id] : null}
          <tr>
            <td>{i + 1}</td>
            <td>
              {#if k}<span class="skill-label">{@html skillIcon(k.id, k.type, k.element)}{k.name}</span>{:else}—{/if}
            </td>
            <td>{k && id ? (k.final_pct ? `${Math.round(k.final_pct)}% of your ${k.basis === 'magic' ? 'spell hit' : 'weapon hit'}` : k.type) : ''}</td>
            <td>{id ? `${skillLevel(gameState.skills, id)} / ${E.skill_xp.level_cap}` : ''}</td>
            <td>{k && id ? `${k.cd}s → ${skillCd(gameState.skills, id, c.cdr).toFixed(2)}s` : ''}</td>
            <td>{k && id ? manaNow(c, gameState.skills, id) : ''}</td>
            <td>{id ? `${(gameState.skills.cd[id] || 0).toFixed(1)}s${(gameState.skills.buffUp[id] || 0) > 0 ? ` · window ${gameState.skills.buffUp[id]}s` : ''}` : ''}</td>
            <td>
              {#if id}
                <select value={modeOf(gameState.skills, id)} onchange={(e) => setMode(id, (e.target as HTMLSelectElement).value)}>
                  <option value="always">always</option>
                  <option value="conditional">conditional</option>
                  <option value="never">never</option>
                </select>
              {:else}—{/if}
            </td>
            <td>
              <select value={id || ''} onchange={(e) => setSlot(i, (e.target as HTMLSelectElement).value)}>
                <option value="">empty</option>
                {#each ownedActives as k2}<option value={k2.id} selected={id === k2.id}>{k2.name}</option>{/each}
              </select>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <h3>Skill levels</h3>
    <table>
      <thead><tr><th>Skill</th><th>Type</th><th>Dupes</th><th>Ladder</th><th>Effect</th></tr></thead>
      <tbody>
        {#each Object.keys(gameState.skills.owned) as id}
          {@const k = sm.byId[id]}
          <tr>
            <td><span class="skill-label">{@html skillIcon(k.id, k.type, k.element)}{k.name}</span></td><td>{k.type}</td><td>{gameState.skills.owned[id]}</td>
            <td>{ladderOf(gameState.skills, id)}% cd</td>
            <td>{k.effect || (k.final_pct != null ? `${pct2(k.final_pct)}% of its ${k.basis} hit` : k.reserve) || ''}</td>
          </tr>
        {:else}
          <tr><td colspan="5">No skills yet · first drop comes from a Boss.</td></tr>
        {/each}
      </tbody>
    </table>
    <h3>Buffs · automatic · no slot</h3>
    {#each ownedBuffs as k}
      <label><input type="checkbox" checked={gameState.skills.buffs[k.id]} onchange={() => toggle(k.id)} /> <span class="skill-label">{@html skillIcon(k.id, k.type, k.element)}{k.name}</span> · {k.duration} on / {k.cd}s cd · {manaNow(c, gameState.skills, k.id)} · {effectLine(k) || k.effect}</label><br />
    {:else}
      <p><small>None owned.</small></p>
    {/each}
    <p><small>Reserved {reservedPct(gameState.skills)}% / {sm.RESERVATION_LIMIT}% · active: {describeFold(effectsActive(gameState.skills)) || 'none'}.</small></p>
    <h3>Auras · reserve Max Mana</h3>
    {#each ownedAuras as k}
      <label><input type="checkbox" checked={gameState.skills.auras[k.id]} onchange={() => toggle(k.id)} /> <span class="skill-label">{@html skillIcon(k.id, k.type, k.element)}{k.name}</span> · {k.reserve} ({sm.reservePct(k.reserve)}%) · {effectLine(k) || k.effect}</label><br />
    {:else}
      <p><small>None owned.</small></p>
    {/each}

    <h3>Weapon Mastery</h3>
    <p><small>XP goes to the held weapon; account bonus uses each weapon's best level.</small></p>
    <table>
      <thead><tr><th>Weapon</th><th>Mastery</th><th>Drop bonus</th></tr></thead>
      <tbody>
        {#each WEAPONS as w}
          {@const lv = masteryLevel(gameState, w.name)}
          <tr>
            <td>{w.name}</td>
            <td>{masteryLabel(lv)}</td>
            <td>{lv >= 5 ? `+${((lv - 4) * 0.5).toFixed(1)}%` : '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Curable curses</h3>
    <ul>
      {#each curableRows() as k}
        <li>{k.name} · {effectLine(k) || k.effect}</li>
      {:else}
        <li><small>None.</small></li>
      {/each}
    </ul>

    <h2>Passive tree · {treePointsFree(gameState)} banked · {treePointsSpent(gameState)} spent</h2>
    <p><small>Spend banked points along each branch. Respec at the selected settlement.</small></p>
    <div class="tree-branches">
      {#each tree.branches as branch}
        <div class="tree-branch">
          <h3>{branch}</h3>
          {#each tree.nodes.filter((n: any) => n.branch === branch) as node}
            <div class="tree-node">
              <span class="tree-name">{node.id} · {node.line}</span>
              <span class="tree-pips">
                {#each [1, 2, 3] as r}
                  <span class="pip" class:on={(gameState.player.treeRanks?.[node.id] || 0) >= r}>{node.values[r - 1]}</span>
                {/each}
              </span>
              <button
                title={canSpendTree(gameState, node.id).why || `buy rank ${(gameState.player.treeRanks?.[node.id] || 0) + 1}`}
                disabled={!canSpendTree(gameState, node.id).ok}
                onclick={() => doSpendTree(node.id)}>+</button>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </section>
{/if}

{#if tab === 'map'}
  <section class="map-screen">
    <div
      class="map-viewport"
      class:dragging
      bind:this={viewportEl}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onwheel={onWheel}
      onclick={pickOnMap}
      role="presentation"
    >
      <div class="map-stage" bind:this={stageEl} style={`width:${mapW}px; height:${mapH}px; transform: translate(${panX}px, ${panY}px) scale(${zoom})`}>
        <div class="map-frame">
          {@html mapTerrain}
          {@html mapMarkup}
        </div>
      </div>
    </div>

    <div class="map-zoom">
      <button title="Zoom in" aria-label="Zoom in" onclick={() => zoomBy(1.25)}>+</button>
      <button title="Zoom out" aria-label="Zoom out" onclick={() => zoomBy(0.8)}>−</button>
      <button title="Fit the whole map" aria-label="Fit the whole map" onclick={fitMap}>⤢</button>
    </div>

    <div class="map-hud">
      <span>At <span class="at">{town.name}</span> · zone {selectedZone.id} · levels {selectedZone.levels.join('-')}</span>
      {#if gameState.road}
        <span>· {linkLabel(gameState.road.linkIndex)} · block {gameState.road.blockIndex + 1}/{gameState.road.blocks} · {gameState.road.secLeft}s · {gameState.road.encountersLeft} encounters{gameState.road.kind ? ` · ${gameState.road.kind}` : ''}</span>
      {/if}
      <button onclick={() => openServices('town')} disabled={!!gameState.road}>Town services</button>
    </div>

    {#if saveNote}<p class="map-note">{saveNote}</p>{/if}

    {#if overlayOpen}
      <aside class="map-drawer" aria-label={`${town.name} services`}>
        <div class="map-drawer-head">
          <div>
            <h2 class="hub-mark">{@html hubArt()}{town.name} · {town.band} band{town.capital ? ` · ${town.capital} capital` : ''}</h2>
            <p><small>Zone {selectedZone.id} · levels {selectedZone.levels.join('-')} · {town.innate.join(' / ')} · {town.npcs.map((n: string) => npcOf(n).name).join(' · ')}</small></p>
          </div>
          <button onclick={() => (overlayOpen = false)} aria-label="Close">✕</button>
        </div>
        <div class="map-detail-tabs" role="tablist" aria-label="Place details">
          <button role="tab" aria-selected={mapDetailMode === 'town'} class:active={mapDetailMode === 'town'} onclick={() => (mapDetailMode = 'town')}>Town</button>
          <button role="tab" aria-selected={mapDetailMode === 'zone'} class:active={mapDetailMode === 'zone'} onclick={() => (mapDetailMode = 'zone')}>Zone · {selectedZone.id}</button>
        </div>
        <div class="map-drawer-body">
    {#if mapDetailMode === 'town'}
    <fieldset class="town-actions" aria-label={`Town services in ${town.name}`}>

    <h3>Counterhand · the gold mint</h3>
    <p>Gold {gameState.counters.gold.toFixed(1)} · junk unsold {junkTotal} ({junkLines.join(' · ') || 'none'}) · stones {stonesLine()}</p>
    <button onclick={doSell} disabled={junkTotal === 0}>Sell all junk here</button>
    <p><small>Sell junk for gold · dissolve rejected gear for Reroll value.</small></p>

    <h3>Respec · free</h3>
    <p><small>Refund Core stat and tree points here.</small></p>
    <button onclick={respec} disabled={!STATS.some((k) => gameState.player.points[k])}>Respec — refund all stat points</button>
    <button onclick={doRespecTree} disabled={!treePointsSpent(gameState)}>Respec the tree — refund {treePointsSpent(gameState)} point{treePointsSpent(gameState) === 1 ? '' : 's'}</button>

    <h3>Standing</h3>
    <p>Tier {standingTier(gameState, town.id)} / {TOWN.standing.tiers.length} · {(standingShare(gameState, town.id) * 100).toFixed(1)}% · {eng.SETTLEMENT_BUDGET_KILLS[town.zone].toLocaleString('en-US')} kill budget</p>

    <h3>Stall stock</h3>
    <table>
      <thead><tr><th>Line</th><th>NPC</th><th>Kind</th><th>Kills of income</th><th>Gold</th><th></th></tr></thead>
      <tbody>
        {#each townStock as row}
          {@const check = canBuy(gameState, town.id, row.id)}
          <tr>
            <td><span class="stock-mark">{@html stockArt(row.id, row.npc)}{row.item}</span></td>
            <td><span class="npc-mark">{@html npcArt(row.npc)}{npcOf(row.npc).name}</span></td>
            <td>{row.kind}</td>
            <td>{priceKills(row, town.id, gameState)} k{row.charge_band ? ` @ ${row.charge_band}` : ''}</td>
            <td>{priceGold(row, town.id, gameState)}</td>
            <td><button onclick={() => doBuy(row.id)} disabled={!check.ok}>{check.ok ? 'buy' : check.why}</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p><small>Curio pedlar — today's rolled prices {gameState.pedlar.kills.join(' / ')} kills, {gameState.pedlar.bought} of {gameState.pedlar.kills.length} bought; restocks at the next game day.</small></p>

    <h3>Guild board · {gameState.town.tasks.length} slots</h3>
    <table>
      <thead><tr><th>#</th><th>Task</th><th>Zone</th><th>Progress</th><th>Reward</th><th></th></tr></thead>
      <tbody>
        {#each gameState.town.tasks as t, i}
          <tr>
            <td>{i + 1}</td>
            <td>{t ? `${t.kind} ×${t.n}` : 'refills in ' + Math.max(0, gameState.town.refillAt[i] - gameState.clockSec) + 's'}</td>
            <td>{t ? eng.zoneById(t.zone).name : ''}</td>
            <td>{t ? `${t.progress} / ${t.n}` : ''}</td>
            <td>{t ? `${t.count} ${t.stone} stone` : ''}</td>
            <td>{#if t}<button disabled={t.progress < t.n} onclick={() => doClaim(i)}>claim</button>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p><small>Task rewards: stones.</small></p>

    <h3>Road · {gameState.town.linksBought} of {ROAD_LINKS} links bought</h3>
    <table>
      <thead><tr><th>Settlement</th><th>Band</th><th>Zone</th><th>Reachable</th><th></th></tr></thead>
      <tbody>
        {#each TOWN.settlements as s}
          <tr>
            <td>{s.name}</td><td>{s.band}</td><td>{s.zone}</td>
            <td>{canTravel(gameState, s.id) ? 'yes' : 'needs a Road link'}</td>
            <td><button onclick={() => s.id === townId ? openServices() : canTravel(gameState, s.id) ? travelTo(s.id) : walkTo(s.id)} disabled={!!gameState.road || s.id === townId}>{s.id === townId ? 'here' : canTravel(gameState, s.id) ? 'warp' : 'walk'}</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <h3>Stash · {tabs} / 6 tabs</h3>
    <p><small>Stash tabs organize items. Deposit and craft at a settlement.</small></p>
    {#if tabs === 0}
      <p><small>No tab yet — the first one is the teaching purchase above.</small></p>
    {:else}
      {#each Array(tabs) as _, t}
        <div class="tab">
          <b>Tab {t + 1}</b>
          <button onclick={() => doWithdrawAll(t)}>Withdraw all unlocked</button>
          {#each gameState.stash[t] || [] as item, i}
            <button class={item.locked ? 'active' : ''} onclick={() => toggleLock(item)} title="Lock / unlock this piece">{item.locked ? 'unlock' : 'lock'}</button>
            <button onclick={() => doWithdraw(t, i)}>{item.base} ({item.quality} {item.tier})</button>
          {:else}
            <span class="dim"> empty</span>
          {/each}
        </div>
      {/each}
    {/if}
    {#if gameState.bag.length}
      <p><small>Deposit from the bag: {gameState.bag.length} / {E.inventory.adventure_slots} carried. A locked piece stays.</small></p>
      <button onclick={() => doDepositAll(0)}>Deposit all unlocked → tab 1</button>
      {#each gameState.bag as item, i}
        <button class={item.locked ? 'active' : ''} onclick={() => toggleLock(item)} title="Lock / unlock this piece">{item.locked ? 'unlock' : 'lock'}</button>
        <button onclick={() => doDeposit(i, 0)}>{item.base} → tab 1</button>
      {/each}
    {/if}

    <h3>Road · {E.road.links.length} links · walked in {road.blockSec}s blocks · a checkpoint warp is the only skip</h3>
    {#if gameState.road}
      <p>On the Road: {linkLabel(gameState.road.linkIndex)} · block {gameState.road.blockIndex + 1} of {gameState.road.blocks} · {gameState.road.secLeft}s left on it · {gameState.road.encountersLeft} encounters to go{gameState.road.kind ? ` · ${gameState.road.kind} in progress` : ''}</p>
    {/if}
    <table>
      <thead><tr><th>Link</th><th>Blocks</th><th>Reachable</th><th>Purse today</th><th></th></tr></thead>
      <tbody>
        {#each road.links as l}
          <tr>
            <td>{l.text}</td>
            <td>{l.blocks} × {road.blockSec}s</td>
            <td>{linkReachable(gameState, l.index) ? 'walkable from here' : 'neither end known'}</td>
            <td>{purseReady(gameState, l.index) ? `${E.road.purse_gold} gold` : 'taken'}</td>
            <td><button onclick={() => doTrip(l.index)} disabled={!linkReachable(gameState, l.index) || !!gameState.road}>walk</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p><small>Online only · {road.blockSec}s/block · {E.road.encounters_per_min} encounter/min · purse cap {road.purseCapPerDay} gold/day · no stones or offline travel.</small></p>
    <p>{townNote}</p>

    {#if colSet}
      <h3>Collector · {colSet.name} ({colSet.school} school)</h3>
      <p><small>{gameState.collector.done[colSet.id]
        ? 'Turned in · the pieces are gone and the reward is yours.'
        : setUnlocked(gameState, colSet)
          ? 'Tier II standing here has opened the set slots.'
          : `Tier II standing in ${colSet.settlement} opens the set slots — ${TOWN.standing.tiers[1].share * 100}% of this zone's kill budget.`}</small></p>
      <table>
        <thead><tr><th>Piece</th><th>Slot</th><th>Held</th><th>Quality asked</th></tr></thead>
        <tbody>
          {#each colSet.parsed as p}
            <tr>
              <td>{p.name}</td><td>{p.slot}</td>
              <td>{heldCount(gameState, colSet.id, p.name)} / 1</td>
              <td>{colSet.quality}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if !gameState.collector.done[colSet.id]}
        <p><small>Missing: {colSet.parsed.filter((p: any) => heldCount(gameState, colSet.id, p.name) === 0).map((p: any) => p.name).join(' · ') || 'ready to turn in'} · {colSet.quality} · {colSet.school}.</small></p>
      {/if}
      <button onclick={doTurnIn} disabled={!setUnlocked(gameState, colSet) || gameState.collector.done[colSet.id]}>turn in the set</button>
      <p><small>Reward: {colSet.reward} · {colSet.rule} · the Collector pays no gold and no Mod anywhere (T14).</small></p>
    {/if}

    {#if gameState.grants.filter_presets || gameState.grants.titles.length || gameState.grants.banners.length}
      <h3>Collector grants</h3>
      <p><small>{gameState.grants.filter_presets} extra filter preset{gameState.grants.filter_presets === 1 ? '' : 's'} · {stashTabCount(gameState)} stash tabs{gameState.grants.titles.length ? ` · titles: ${gameState.grants.titles.join(', ')}` : ''}{gameState.grants.banners.length ? ` · banners: ${gameState.grants.banners.join(', ')}` : ''}.</small></p>
    {/if}

    <h3>Crafting bench · paid in stones, never gold</h3>
    <p><small>Reroll · Refine · Ascend · Upgrade · Repair · Corrupt. Stone costs appear on each action.</small></p>
    <label>Piece
      <select onchange={(e) => { const v = (e.target as HTMLSelectElement).value; const [w, i] = v.split(':'); bench = v ? { where: w as Where, index: Number(i) } : null; }}>
        <option value="">choose a piece</option>
        {#each gameState.gear as g, i}
          {#if g}<option value={'gear:' + i}>worn · {g.slot} · {g.base} ({g.quality} {g.tier})</option>{/if}
        {/each}
        {#each gameState.bag as g, i}
          <option value={'bag:' + i}>bag · {g.slot} · {g.base} ({g.quality} {g.tier})</option>
        {/each}
      </select>
    </label>
    {#if benchItem}
      <table>
        <thead><tr><th>Slot</th><th>Mod line</th><th>Value</th><th>Tier</th><th>Reroll ({stoneNames('reroll').reroll_value} value)</th><th>Refine ({stoneNames('refine').tier} tier)</th><th>Randomize ({stoneNames('randomize').tier} tier)</th></tr></thead>
        <tbody>
          {#each benchItem.lines as line, li}
            <tr>
              <td>{li < craft.LEGACY_SLOTS ? `Legacy ${li + 1}` : li + 1}</td>
              <td>{lineName(line.id)}</td>
              <td>{line.value}</td>
              <td>{lineTier(line)}</td>
              <td><button onclick={() => runCraft('reroll', li)}>reroll</button></td>
              <td><button onclick={() => runCraft('refine', li)}>refine</button></td>
              <td><button onclick={() => runCraft('randomize', li)}>roll</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
      <button onclick={() => runCraft('ascend', 0)}>Ascend piece · {stoneNames('ascend').add} Add + {stoneNames('ascend').tier} tier stones</button>
      <button onclick={() => runCraft('add', 0)}>Add a Mod · {stoneNames('add', benchItem).add} Add stone ({benchItem.mods_added || 0}/{E.rarity.mods_added_cap} used)</button>
      <button onclick={() => runCraft('remove', 0)}>Remove a non-legacy mod · {stoneNames('remove').remove} Remove stone</button>
      <button onclick={() => runCraft('upgrade', 0)}>
        Upgrade to +{Math.min((benchItem.upgrade_lv || 0) + 1, craft.C.upgrade_cap)} · {stoneNames('upgrade', benchItem).quality} Quality Stone · {upgradeChance()}% chance
      </button>
      <button onclick={() => runCraft('repair', 0)}>Repair · {stoneNames('repair').repair} Repair stone (refills protection to {craft.C.protection_start})</button>
      <button onclick={() => runCraft('corrupt', 0)}>Corrupt · 1 Corrupt stone · one gamble per piece, then no stone ever touches it again</button>
      <p><small>This piece: +{benchItem.upgrade_lv || 0} of {craft.C.upgrade_cap} · protection {benchItem.protection_left == null ? craft.C.protection_start : benchItem.protection_left} of {craft.C.protection_start}{benchItem.broken ? ' · BROKEN (contributes nothing until repaired)' : ''}{benchItem.corrupted ? ' · corrupted' : ''}</small></p>
      {@const gm = gearModOf(benchItem)}
      <p><small>Each +1 adds {craft.C.gear_mod_per_level} to this piece's Gear Mod —{' '}
        {gm.stat ? `${lineName(gm.stat)}, now +${gm.value}` : 'this Base carries none'}</small></p>
      <p><small>Stones held: {stonesLine()}</small></p>
      <p>{benchNote}</p>
    {:else}
      <p><small>No piece on the bench yet — pick one from what you wear or what is in the bag.</small></p>
    {/if}
    </fieldset>
    {:else}
      <section class="zone-details">
        <h3>{selectedZone.name} · zone {selectedZone.id}</h3>
        <dl class="zone-facts">
          <div><dt>Levels</dt><dd>{selectedZone.levels.join('-')}</dd></div>
          <div><dt>mob_HP range</dt><dd>{selectedZone.hp[0].toLocaleString('en-US')} → {selectedZone.hp[1].toLocaleString('en-US')}</dd></div>
          <div><dt>Quality</dt><dd>{selectedZone.quality}</dd></div>
          <div><dt>Elements</dt><dd>{selectedZone.elements.join(' · ')}</dd></div>
          <div><dt>Group</dt><dd>{selectedZone.group}</dd></div>
        </dl>
        <h3>Hunting grounds</h3>
        <p><small>Pick the ground a spawn rolls inside. Elite and Boss stay zone-wide.</small></p>
        <div class="zone-picker">
          <button class:active={!gameState.zoneFocus?.[gameState.zone]} onclick={() => setZoneFocus('')}>
            the whole cast<small>every race in the zone</small>
          </button>
          {#each selectedZone.subzones || [] as sub}
            <button class:active={gameState.zoneFocus?.[gameState.zone] === sub.name} onclick={() => setZoneFocus(sub.name)}>
              {sub.name}<small>{sub.element} · {sub.races.join(' + ')}</small>
            </button>
          {/each}
        </div>
        <h3>All zones</h3>
        <p><small>A zone is always reached on foot — tap its hex, or a name here, to walk the Road there with its encounters.</small></p>
        <div class="zone-picker">
          {#each E.mob.zones as z}
            {@const place = settlementOfZone(z.id)}
            <button class:active={z.id === selectedZone.id} onclick={() => visitZone(z.id)}>
              {z.name}<small>{z.levels.join('-')} · {gameState.town.visited.includes(place.id) ? 'opened' : 'walk to open'}</small>
            </button>
          {/each}
        </div>
      </section>
    {/if}
        <p>{townNote}</p>
        </div>
      </aside>
    {/if}
  </section>
{/if}

{#if tab === 'farm'}
  <section class="panel">
    <h2>Farming · level {fl} / {farm.F.level_cap}</h2>
    <p><small>{gameState.farm.xp} Farm XP · {farm.F.growth_hours}h growth · {plots}/{farm.plotsMax} plots · herbs brew potions.</small></p>

    <h3>Plots</h3>
    <table>
      <thead><tr><th>Plot</th><th>Grow</th><th>Ready</th><th></th></tr></thead>
      <tbody>
        {#each Array(plots) as _, i}
          {@const p = gameState.farm.plots[i]}
          <tr>
            <td>{i + 1}</td>
            <td>
              <select value={p?.tier || 'low'} onchange={(e) => doPlant(i, (e.target as HTMLSelectElement).value)}>
                {#each farm.TIERS as tier}
                  <option value={tier} selected={p?.tier === tier}>{tier}{!farm.canGrow(fl, tier) ? ` (needs level ${farm.F.tier_unlock_level[tier]})` : ''}</option>
                {/each}
              </select>
            </td>
            <td>{p?.tier ? (gameState.clockSec >= p.readyAt ? 'ready' : Math.ceil((p.readyAt - gameState.clockSec) / 360) / 10 + ' h') : 'empty'}</td>
            <td><button onclick={() => doHarvest(i)} disabled={!p?.tier || gameState.clockSec < p.readyAt}>harvest</button></td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Herb store · bundles drop on their own roll</h3>
    <p>{farm.TIERS.map((t: string) => `${t} ${gameState.farm.herbs[t] || 0}`).join(' · ')} ({(farm.H.mid_chance * 100).toFixed(0)}% per kill in mid zones · {(farm.H.high_chance * 100).toFixed(0)}% in high, {farm.H.bundle_min}-{farm.H.bundle_max} at a time)</p>

    <h3>Alchemy</h3>
    <table>
      <thead><tr><th>Draught</th><th>Effect</th><th>Cost</th><th>Held</th><th></th></tr></thead>
      <tbody>
        {#each farm.P.list as p}
          {@const cost = farm.craftCost(p.tier)}
          <tr>
            <td>{p.name}</td>
            <td>Instant {farm.potionEffect(p)}% Max {p.pool === 'hp' ? 'HP' : 'Mana'}</td>
            <td>{cost.herbs} {p.tier} herbs + {cost.reroll_value_stones} Reroll value stone(s)</td>
            <td>{gameState.farm.potions[p.name] || 0}{gameState.farm.condensed[p.name] ? ` (+${gameState.farm.condensed[p.name]} condensed)` : ''}</td>
            <td>
              <button onclick={() => doBrew(p.name)}>brew</button>
              <button onclick={() => doCondense(p.name)} disabled={(gameState.farm.potions[p.name] || 0) < farm.P.condensed.cost_bottles}>condense</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Auto-use</h3>
    <label><input type="checkbox" checked={gameState.farm.autoUse.hp} onchange={() => { gameState.farm.autoUse.hp = !gameState.farm.autoUse.hp; gameState = { ...gameState }; }} /> HP line below
      <input type="number" value={gameState.farm.threshold.hp} min="1" max="99" onchange={(e) => { gameState.farm.threshold.hp = Number((e.target as HTMLInputElement).value); gameState = { ...gameState }; }} />%
    </label>
    <label><input type="checkbox" checked={gameState.farm.autoUse.mana} onchange={() => { gameState.farm.autoUse.mana = !gameState.farm.autoUse.mana; gameState = { ...gameState }; }} /> Mana line below
      <input type="number" value={gameState.farm.threshold.mana} min="1" max="99" onchange={(e) => { gameState.farm.threshold.mana = Number((e.target as HTMLInputElement).value); gameState = { ...gameState }; }} />%
    </label>
    <h3>Auto-farm</h3>
    <label><input type="checkbox" checked={gameState.farm.autoFarm.harvest} onchange={() => { gameState.farm.autoFarm.harvest = !gameState.farm.autoFarm.harvest; gameState = { ...gameState }; }} /> Auto-harvest ready plots</label>
    <label><input type="checkbox" checked={gameState.farm.autoFarm.plant} onchange={() => { gameState.farm.autoFarm.plant = !gameState.farm.autoFarm.plant; gameState = { ...gameState }; }} /> Auto-plant empty plots (uses one herb as the seed)</label>
    <label><input type="checkbox" checked={gameState.farm.autoFarm.brew} onchange={() => { gameState.farm.autoFarm.brew = !gameState.farm.autoFarm.brew; gameState = { ...gameState }; }} /> Auto-brew affordable draughts</label>
    <p><small>Cooldown {farm.P.shared_cooldown_sec}s · {farm.P.max_uses_per_fight} uses/fight · {farm.P.boss_suppressed ? 'Bosses: disabled' : 'Bosses: enabled'} · condensed {farm.P.condensed.effect_mult}×.</small></p>
    <p>{farmNote}</p>
  </section>
{/if}



{#if tab === 'qol'}
  <section class="panel hub">
    <h2>QOL hub</h2>
    <p class="lead">Every convenience setting in one place. A control that belongs to its own screen keeps its home there — the cards below show where things stand and take you to it.</p>

    <div class="hub-grid">
      <section class="card">
        <h3>Client</h3>
        <label class="field">Number format
          <select value={settings.numberFormat} onchange={(e) => setSetting('numberFormat', (e.target as HTMLSelectElement).value as 'plain' | 'short')}>
            <option value="plain">plain — 12,345</option>
            <option value="short">short — 12.3k</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" checked={settings.offlineReport} onchange={(e) => setSetting('offlineReport', (e.target as HTMLInputElement).checked)} /> Welcome-back report after an away period</label>
      </section>

      <section class="card">
        <h3>Loot</h3>
        <label class="field">Auto-dissolve at or below
          <select value={gameState.autoDissolveRarity ?? 'off'} onchange={(e) => { gameState.autoDissolveRarity = (e.target as HTMLSelectElement).value as 'off' | 'Common' | 'Rare'; gameState = { ...gameState }; }}>
            <option value="off">off — keep every drop</option>
            <option value="Common">Common</option>
            <option value="Rare">Common and Rare</option>
          </select>
        </label>
        <p class="hint">Pays Reroll value. Locked and Collector-held pieces are spared.</p>
      </section>

      <section class="card">
        <h3>Character</h3>
        <dl class="read">
          <dt>Unspent stat points</dt><dd class="num">{gameState.player.statPoints}</dd>
          <dt>Banked tree points</dt><dd class="num">{gameState.player.treePoints}</dd>
          <dt>Auto-allocate</dt><dd>{gameState.player.autoSpend ? 'on' : 'off'}</dd>
        </dl>
        <button onclick={() => (tab = 'main')}>Open the character sheet</button>
      </section>

      <section class="card">
        <h3>Hunting</h3>
        <dl class="read">
          <dt>Zone</dt><dd>{zone.name} · {zone.levels.join('-')}</dd>
          <dt>Hunt order</dt><dd>{gameState.huntOrder?.[gameState.zone] ?? 'by variant'}</dd>
          <dt>Hunting ground</dt><dd>{gameState.zoneFocus?.[gameState.zone] || 'the whole cast'}</dd>
          <dt>Travel</dt><dd>{gameState.travel === 'forward' ? 'forward past the cap' : 'stay here'}</dd>
        </dl>
        <button onclick={() => (tab = 'main')}>Fight screen</button>
      </section>

      <section class="card">
        <h3>Skills</h3>
        <dl class="read">
          <dt>Slots filled</dt><dd class="num">{gameState.skills.list.filter(Boolean).length} / {ACTIVE_SLOTS}</dd>
          <dt>Folded effect</dt><dd>{describeFold(effectsActive(gameState.skills)) || 'none'}</dd>
          <dt>Mana reserved</dt><dd class="num">{reserved}% / {sm.RESERVATION_LIMIT}%</dd>
        </dl>
        <button onclick={() => (tab = 'skills')}>Skills screen</button>
      </section>

      <section class="card">
        <h3>Farming</h3>
        <dl class="read">
          <dt>Farm level</dt><dd class="num">{fl} / {farm.F.level_cap}</dd>
          <dt>Plots</dt><dd class="num">{plots} / {farm.plotsMax}</dd>
          <dt>Draughts held</dt><dd class="num">{Object.values(gameState.farm.potions).reduce((a: number, b: number) => a + b, 0)}</dd>
        </dl>
        <button onclick={() => (tab = 'farm')}>Farm screen</button>
      </section>

      <section class="card">
        <h3>World and town</h3>
        <dl class="read">
          <dt>At</dt><dd>{town.name}</dd>
          <dt>Gold</dt><dd class="num">{fmtNum(gameState.counters.gold)}</dd>
          <dt>Stash tabs</dt><dd class="num">{tabs} / 6</dd>
        </dl>
        <button onclick={() => (tab = 'map')}>World screen</button>
      </section>

      <section class="card">
        <h3>Controls</h3>
        <dl class="read">
          <dt>1 – 6</dt><dd>switch screen</dd>
          <dt>Space</dt><dd>pause or resume</dd>
          <dt>Esc</dt><dd>close the town drawer</dd>
        </dl>
        <p class="hint">A key is ignored while you are typing in a box.</p>
      </section>

      <section class="card">
        <h3>Saves</h3>
        <p class="hint">Three slots, JSON export and import, and {SAVE_CFG.snapshot_slots} walking backups.</p>
        <button onclick={() => (tab = 'save')}>Save screen</button>
      </section>
    </div>
  </section>
{/if}

{#if tab === 'save'}
  <section class="panel">
    <h2>Save · local only</h2>
    <p>Three slots in IndexedDB, localStorage if IndexedDB is unavailable. Offline time catches up to {E.inventory.offline_cap_hr} hours.</p>
    {#each saveSlots as slot}
      <button onclick={() => doSave(slot)}>Save {slot}</button>
      <button onclick={() => doLoad(slot)}>Load {slot}</button>
    {/each}
    <button onclick={download}>Export JSON</button>
    <label>Import <input type="file" accept="application/json" onchange={upload} /></label>
    <p>{saveNote}</p>
    <h2>Backups · {SAVE_CFG.snapshot_slots} walking snapshots</h2>
    <p><small>Snapshots: level-up, successful craft, or every {SAVE_CFG.snapshot_interval_min} minutes. Restore replaces the whole character state.</small></p>
    <label>Which slot <select bind:value={snapSlot} onchange={loadSnaps}>{#each saveSlots as s}<option value={s}>{s}</option>{/each}</select></label>
    <button onclick={loadSnaps}>Show backups</button>
    <table>
      <thead><tr><th>#</th><th>Taken because</th><th>Then</th><th></th></tr></thead>
      <tbody>
        {#each snaps as shot, i}
          <tr>
            <td>{i + 1}</td>
            <td>{shot.reason}</td>
            <td>{Math.round(shot.clockSec / 60)} min of play · level {shot.state.player.level}</td>
            <td><button onclick={() => restore(i)}>Rewind to this</button></td>
          </tr>
        {:else}
          <tr><td colspan="4">Nothing stored yet.</td></tr>
        {/each}
      </tbody>
    </table>
    <p>{snapNote}</p>
  </section>
{/if}
 </main>

<style>
  /* ---- the top bar ---- */
  .topbar { display: flex; align-items: center; gap: .9rem; min-width: 0; padding: .45rem .75rem; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,.028), rgba(255,255,255,0) 70%), var(--bg-2); }
  .brand { display: flex; align-items: center; gap: .5rem; flex: 0 0 auto; }
  .brand b { font-size: .95rem; letter-spacing: .02em; }
  .brand-mark { width: 1.05rem; height: 1.05rem; border-radius: 5px; background: linear-gradient(135deg, var(--accent), var(--good)); box-shadow: 0 0 0 1px rgba(255,255,255,.12), 0 0 14px -2px rgba(79,195,247,.65); }
  .tabs { display: flex; gap: .15rem; flex: 0 1 auto; min-width: 0; padding: .15rem; background: var(--bg); border: 1px solid var(--line); border-radius: var(--r); overflow-x: auto; scrollbar-width: none; }
  .tabs::-webkit-scrollbar { display: none; }
  .tabs .tab { background: transparent; border: 1px solid transparent; border-radius: var(--r-sm); padding: .28rem .75rem; color: var(--dim); white-space: nowrap; font-size: .82rem; }
  .tabs .tab:hover { color: var(--text); background: rgba(255,255,255,.045); }
  .tabs .tab.active { color: var(--accent-2); background: rgba(79,195,247,.12); border-color: rgba(79,195,247,.35); }
  .status { display: flex; align-items: center; gap: .35rem; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; margin-left: auto; }
  .chip { display: inline-flex; align-items: center; gap: .35rem; padding: .22rem .55rem; border: 1px solid var(--line); border-radius: 99px; background: var(--panel); color: var(--dim); font-size: .76rem; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .chip.gold { color: var(--xp); border-color: rgba(241,196,15,.28); }
  .chip.run { color: var(--good); border-color: rgba(46,204,113,.35); background: rgba(46,204,113,.08); }
  .chip.run.paused { color: var(--warn); border-color: rgba(224,163,74,.4); background: rgba(224,163,74,.08); }
  .chip .dot { width: .45rem; height: .45rem; border-radius: 99px; background: currentColor; box-shadow: 0 0 8px currentColor; }

  /* ---- the shell ---- */
  .screen { min-height: 0; min-width: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
  .screen > .panel { height: 100%; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
  .panel { min-width: 0; padding: .7rem; }
  .panel p { margin: .35rem 0; }
  .panel h3 { margin: .55rem 0 .25rem; }
  .panel > h3:first-of-type { margin-top: .4rem; }
  .lead { color: var(--dim); max-width: 62rem; }

  /* ---- the QOL hub ---- */
  .hub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr)); gap: .6rem; align-items: start; margin-top: .6rem; }
  .card { display: flex; flex-direction: column; align-items: flex-start; gap: .45rem; padding: .7rem .75rem; background: linear-gradient(180deg, rgba(255,255,255,.02), transparent 55%), var(--bg-2); border: 1px solid var(--line); border-radius: var(--r); box-shadow: var(--shadow-1); }
  .card h3 { margin: 0; font-size: .84rem; color: var(--accent-2); }
  .card .field { display: flex; flex-direction: column; gap: .25rem; width: 100%; color: var(--dim); font-size: .78rem; }
  .card .field select { width: 100%; }
  .card .check { display: flex; align-items: flex-start; gap: .4rem; font-size: .8rem; }
  .hint { margin: 0; color: var(--dim-2); font-size: .76rem; }
  .read { display: grid; grid-template-columns: auto 1fr; gap: .18rem .7rem; margin: 0; width: 100%; font-size: .8rem; }
  .read dt { color: var(--dim); white-space: nowrap; }
  .read dd { margin: 0; text-align: right; overflow-wrap: anywhere; }

  /* ---- the fight screen: the dashboard, three columns wide ---- */
  .main {
    display: grid; height: 100%; min-height: 0; gap: .5rem; padding: .5rem; align-items: stretch; overflow: hidden;
    grid-template-columns: minmax(0, 1.55fr) minmax(0, 1.05fr) minmax(0, 1.05fr);
    grid-template-rows: minmax(0, 1.15fr) minmax(0, .85fr);
    grid-template-areas: "scene scene sheet" "temp inv sheet";
  }
  .region { min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; background: linear-gradient(180deg, rgba(255,255,255,.02), transparent 45%), var(--panel); border: 1px solid var(--line); border-radius: var(--r); box-shadow: var(--shadow-1); }
  .scene { grid-area: scene; display: flex; flex-direction: column; }
  .sheet { grid-area: sheet; }
  .temp { grid-area: temp; }
  .inv { grid-area: inv; }

  .bars { display: grid; gap: .3rem; margin-bottom: .5rem; }
  .bars label, .bars span { display: flex; align-items: center; gap: .55rem; font-size: .8rem; }
  .bars label { color: var(--dim); }
  .skill-strip { display: flex; flex-wrap: wrap; gap: .3rem .45rem; margin-bottom: .6rem; }
  .skill-slot { display: inline-flex; align-items: center; gap: .35rem; padding: .18rem .45rem; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); font-size: .72rem; }
  .skill-slot.empty { min-width: 2.8rem; min-height: 1.6rem; border-style: dashed; opacity: .45; }
  .skill-slot small { color: var(--dim); }
  .skill-slot small.ready { color: var(--accent); }
  .state { display: flex; flex-wrap: wrap; gap: .4rem .9rem; align-items: center; margin: .35rem 0; color: var(--dim); }
  .travel { display: inline-flex; align-items: center; gap: .35rem; flex-wrap: wrap; }
  .travel small { flex-basis: 100%; color: var(--dim-2); }
  .log { flex: 1 1 auto; min-height: 4rem; margin: .5rem 0; overflow: auto; font-family: var(--mono); font-size: 12px; color: var(--dim); display: flex; flex-direction: column; }
  .log > div { padding: .05rem 0; }
  .log .empty { margin: auto; color: var(--dim-2); font-family: var(--sans); font-size: .78rem; }
  .log .t { color: var(--mob); margin-right: .4rem; }
  .controls { display: flex; gap: .4rem; flex-wrap: wrap; margin-top: auto; }

  .mobbar { display: inline-block; height: 8px; background: var(--hp); margin-right: .4rem; vertical-align: middle; border-radius: 99px; }
  .mob-name, .element-label, .skill-label { display: inline-flex; align-items: center; gap: .35rem; }
  .mob-name img { width: 1.25rem; height: 1.25rem; object-fit: contain; }
  .mob-name.elite { color: #b98cff; }
  .mob-name.boss { color: #ff6b6b; }
  .mob-name .tier-mark { width: 1rem; height: 1rem; margin-left: .15rem; }
  .element-list { display: flex; flex-wrap: wrap; gap: .25rem .5rem; }
  .element-label { font-size: .72rem; }
  .element-label img, .skill-label img { width: 1.1rem; height: 1.1rem; object-fit: contain; flex: none; }

  /* the character sheet: a segmented head over two views, so neither half has to scroll */
  .sheet-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; flex-wrap: wrap; margin-bottom: .5rem; }
  .sheet-head h2 { margin: 0; }
  .seg { display: flex; gap: .15rem; padding: .15rem; background: var(--bg); border: 1px solid var(--line); border-radius: var(--r); }
  .seg button { background: transparent; border: 1px solid transparent; border-radius: var(--r-sm); padding: .22rem .6rem; font-size: .76rem; color: var(--dim); white-space: nowrap; }
  .seg button:hover { color: var(--text); background: rgba(255,255,255,.045); }
  .seg button.active { color: var(--accent-2); background: rgba(79,195,247,.12); border-color: rgba(79,195,247,.35); }
  .stats td { font-size: .76rem; padding: .06rem .32rem; }
  .stats td:first-child { color: var(--dim); width: 45%; }
  .stats td:nth-child(3) { white-space: nowrap; }
  .stats button { padding: .02rem .3rem; font-size: .72rem; line-height: 1.3; border-radius: var(--r-xs); }
  .gate { font-size: .82rem; }
  .filter { margin-top: .55rem; }
  .filter summary { cursor: pointer; color: var(--dim); font-size: .8rem; }
  .filter table { margin-top: .4rem; }
  .weight { margin: 0 0 .5rem; }
  .weight small { color: var(--dim); }
  .warn { color: var(--hp); }

  /* the skills screen: conditions read as chips, not as a wrapped sentence */
  .conditions { display: flex; flex-wrap: wrap; gap: .3rem .5rem; align-items: center; }
  .conditions label { display: inline-flex; align-items: center; gap: .3rem; padding: .12rem .45rem; border: 1px solid var(--line-soft); border-radius: 99px; background: var(--bg-2); font-size: .74rem; }

  .map-drawer .tab { display: flex; flex-wrap: wrap; gap: .3rem; align-items: center; padding: .35rem 0; border-bottom: 1px solid var(--line-soft); }

  progress { flex: 1 1 auto; width: 220px; height: 10px; border: 0; border-radius: 99px; overflow: hidden; background: var(--line); }
  progress::-webkit-progress-bar { background: var(--line); }
  progress::-webkit-progress-value { border-radius: 99px; }
  progress::-moz-progress-bar { border-radius: 99px; }
  progress.hp::-webkit-progress-value { background: var(--hp); }
  progress.hp::-moz-progress-bar { background: var(--hp); }
  progress.mana::-webkit-progress-value { background: var(--mana); }
  progress.mana::-moz-progress-bar { background: var(--mana); }
  progress.es::-webkit-progress-value { background: var(--es); }
  progress.es::-moz-progress-bar { background: var(--es); }
  progress.xp::-webkit-progress-value { background: var(--xp); }
  progress.xp::-moz-progress-bar { background: var(--xp); }

  /* The map: a full-bleed viewport the player zooms and pans, the overlay inlined via {@html}
     (its own styling lives in app.css). A town's services open as a drawer over the sheet.
     The sheet fills the grid row: every child below is absolutely positioned, so without an
     explicit height this section (and the viewport inside it) collapses to 0 and reads blank. */
  .map-screen { position: relative; overflow: hidden; padding: 0; height: 100%; }
  .map-viewport { position: absolute; inset: 0; overflow: hidden; touch-action: none; cursor: grab; background: #0b0d11; }
  .map-viewport.dragging { cursor: grabbing; }
  /* No will-change here: it promotes the sheet to its own composited layer, which the browser
     rasterises once and then scales as a bitmap — the exact artefact we are avoiding. Letting the
     transform stay on the main layer means the inline SVG is re-rendered vector-sharp at every zoom.
     Width and height come from the overlay's own canvas plus the bleed margin, set inline (M7). */
  .map-stage { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
  .map-frame { position: absolute; inset: 0; user-select: none; }
  .map-zoom { position: absolute; right: .6rem; bottom: .6rem; display: flex; flex-direction: column; gap: .3rem; z-index: 2; }
  .map-zoom button { width: 2.2rem; height: 2.2rem; padding: 0; font-size: 1.05rem; line-height: 1; background: rgba(23,27,34,.92); }
  .map-hud { position: absolute; left: .6rem; top: .6rem; z-index: 2; display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; max-width: calc(100% - 6rem); background: rgba(14,16,20,.86); border: 1px solid var(--line); border-radius: var(--r); padding: .35rem .55rem; font-size: .8rem; }
  .map-hud .at { color: var(--good); font-weight: 600; }
  .map-note { position: absolute; left: .6rem; bottom: .6rem; z-index: 2; max-width: calc(100% - 6rem); margin: 0; background: rgba(14,16,20,.86); border: 1px solid var(--line); border-radius: var(--r); padding: .3rem .55rem; font-size: .8rem; }
  .map-drawer { position: absolute; top: 0; right: 0; bottom: 0; width: min(32rem, 96%); background: var(--panel); border-left: 1px solid var(--line); overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; box-shadow: var(--shadow-2); z-index: 3; }
  .map-drawer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: .6rem; position: sticky; top: 0; z-index: 2; background: var(--panel); padding: .6rem .7rem .45rem; border-bottom: 1px solid var(--line); }
  .map-drawer-head h2 { margin-bottom: .25rem; }
  .map-drawer-head p { margin-top: 0; }
  .map-drawer-body { padding: .2rem .7rem .8rem; }
  .map-detail-tabs { display: flex; gap: .35rem; position: sticky; top: 0; z-index: 2; background: var(--panel); padding: .45rem .7rem; border-bottom: 1px solid var(--line); }
  .town-actions { min-width: 0; margin: 0; padding: 0; border: 0; }
  .zone-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .4rem .8rem; margin: .4rem 0 .8rem; }
  .zone-facts > div { min-width: 0; }
  .zone-facts dt { color: var(--dim); font-size: .74rem; }
  .zone-facts dd { margin: .1rem 0 0; overflow-wrap: anywhere; }
  .zone-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: .35rem; }
  .zone-picker button { display: flex; flex-direction: column; align-items: flex-start; text-align: left; min-width: 0; }
  .zone-picker small { color: var(--dim); }

  /* ---- responsive: the dashboard sheds columns before anything clips ---- */
  @media (max-width: 1720px), (max-height: 949px) {
    .main {
      grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas: "scene sheet" "temp sheet" "inv sheet";
    }
  }
  @media (max-width: 1180px) {
    .topbar { flex-wrap: wrap; }
    .tabs { order: 3; flex-basis: 100%; }
    .status { order: 2; margin-left: auto; }
  }
  /* Not enough room for the dashboard: one clean scroll beats four clipped panels. */
  @media (max-width: 1000px), (max-height: 949px) {
    .main { display: flex; flex-direction: column; height: auto; overflow: visible; }
    .region { min-height: 16rem; overflow: visible; }
  }</style>
