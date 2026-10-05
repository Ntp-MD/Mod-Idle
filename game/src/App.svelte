<script lang="ts">
  import { onMount } from 'svelte';
  import { eng, E, sm, TOWN } from './engine/client';
  import { buildCharacter } from './sim/player';
  import { newGame, tick, push, catchUpAsync, carried, heldWeaponName } from './sim/game';
  import { reservedPct, skillCd, skillLevel, ladderOf, effectsActive, toggleTrack, effectLine, describeFold, EFFECT_LABEL, ACTIVE_SLOTS, manaNow } from './sim/skills';
  import { modsOn, psMult, curableRows } from './sim/curse';
  import { statusLabel } from './sim/mobStatus';
  import { slotsUsed, slotsAvailable, pouchSlots, bagStacks } from './sim/slots';
  import SlotGrid from './ui/SlotGrid.svelte';
  import { gearEntry, stackEntry, sortEntries, type SlotEntry, type SortKey } from './ui/bag';
  import {
    settlementById, settlementOfZone, stockOf, priceGold, priceMinutes, canBuy, buy, sellJunk,
    standingShare, standingTier, canTravel, claimTask, npcOf, ROAD_LINKS,
  } from './sim/town';
  import { craft, doCraft, stoneNames, stoneName, lineName, lineTier, type CraftOp, type Where } from './sim/craft';
  import { farm, farmLevel, plotCount, plant, harvest, craftPotion, condense } from './sim/farm';
  import { stashTabCount, deposit, withdraw, depositMany, withdrawMany } from './sim/town';
  import { road, startTrip, linkReachable, purseReady, linkLabel, startCircuit, stopCircuit, circuitValid } from './sim/road';
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
  // the settlement map: hand-drawn terrain under the generated overlay (both presentation-only)
  import mapTerrain from '../../art/svg/map/map-terrain.svg?url';
  import mapOverlay from '../../art/svg/map/map-overlay.svg?url';
  import type { GameState, Item } from './sim/types';
  import type { StatKey } from './engine/client';
  import type { Statuses } from './sim/combat';

  const STATS: StatKey[] = ['str', 'int', 'vit', 'agi', 'dex', 'wis', 'lck'];
  const TABS = ['main', 'skills', 'town', 'map', 'farm', 'zones', 'save'] as const;
  // `gameState`, not `state`: a top-level `state` binding makes svelte2tsx read `$state` as a store
  // subscription and type the whole panel `any` (sveltejs/svelte#13715).
  let gameState = $state<GameState>(newGame());
  let statuses: Statuses = {};
  let running = $state(true);
  let tab: 'main' | 'skills' | 'town' | 'farm' | 'zones' | 'save' = $state('main');
  let saveNote = $state('');

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
  let minutes = $derived(Math.floor(gameState.counters.playSec / 60));
  let kph = $derived(gameState.counters.playSec > 0 ? (gameState.counters.kills / gameState.counters.playSec) * 3600 : 0);

  // The four regions of the main screen, in the shape the slot grid draws. Order and mode are the
  // player's choice; every value inside a slot is read from the engine, never recomputed here.
  let invMode = $state<'grid' | 'list'>('grid');
  let tempMode = $state<'grid' | 'list'>('grid');
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

  /** The current zone's Hunt Order; 'none' removes the lean. Shifts between streams, never the total. */
  function setHuntOrder(v: 'gear' | 'herb' | 'junk' | 'none') {
    if (!gameState.huntOrder) gameState.huntOrder = {};
    if (v === 'none') delete gameState.huntOrder[gameState.zone];
    else gameState.huntOrder[gameState.zone] = v;
    gameState = { ...gameState };
  }

  /** Spend or refund stat points. Takes effect on the next tick, so the sheet works mid-combat (D-141). */
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
  /** Free Respec — town only (the button is on the town panel). Hands every allocated point back. */
  function respec() {
    const p = gameState.player;
    let total = 0;
    for (const k of STATS) { total += p.points[k]; p.points[k] = 0; }
    p.statPoints += total;
    gameState = { ...gameState };
  }

  /** §11 field label: species lowercase + tier suffix; a named boss reads its own name; no body class. */
  function fieldLabel(m: { species: string; kind: string }): string {
    if (m.kind.startsWith('Boss')) return `${m.kind.replace(/^Boss · /, '')}(Boss)`;
    if (m.kind === 'Elite') return `${m.species.toLowerCase()}(Elite)`;
    return m.species.toLowerCase();
  }

  function step() {
    // `tick` mutates the state in place. `gameState` is a deep `$state` proxy, so its fine-grained
    // signals fire on their own — no need to clone the whole root and reassign, which used to
    // invalidate every `$derived` (bag sorts, character rebuild) once a second on an idle tick.
    tick(gameState, statuses);
  }

  onMount(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
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
      loadSnaps();
      // the clock is armed only after the catch-up, so a slice boundary cannot add an extra tick
      if (!disposed) timer = setInterval(() => { if (running) step(); }, 1000);
    })();
    return () => { disposed = true; if (timer) clearInterval(timer); };
  });

  function equip(index: number) {
    // the rule lives in `sim/gear.ts`, where the tests can reach it too; this copy only makes the
    // panel re-read the gameState the verb mutated in place
    equipFromBag(gameState, index);
    gameState = { ...gameState };
  }

  function goToZone(id: number) {
    const s = settlementOfZone(id);
    if (!s || !gameState.town.visited.includes(s.id)) {
      saveNote = `${eng.zoneById(id).name} is not opened yet — walk the Road from the town panel`;
      tab = 'town';
      return;
    }
    gameState.zone = id;
    gameState.group = [];
    gameState.player.atkTimer = 0;
    push(gameState, `Walking to ${eng.zoneById(id).name} (levels ${eng.zoneById(id).levels.join('-')})`);
    gameState = { ...gameState };
  }

  async function doSave(slot: SlotName) {
    gameState.lastSavedAt = Date.now();
    await writeSave(slot, gameState); // one write may also take a snapshot and arm the next timer
    gameState = { ...gameState };
    saveNote = `Saved to ${slot}`;
    if (slot === snapSlot) await loadSnaps();
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
    gameState = s;
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
    gameState = { ...s };
    const away = (Date.now() - (s.lastSavedAt || Date.now())) / 1000;
    const before = snapCounters(gameState);
    const r = await catchUpAsync(gameState, statuses, away);
    awayReport = settings.offlineReport ? buildAwayReport(before, Math.round(away / 60), r.simulated, r.capped) : null;
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
  }

  // the panel follows the zone the character is actually hunting, so an auto-travel step cannot
  // leave it showing the town the character walked away from
  const townId = $derived(settlementOfZone(gameState.zone)?.id || 'eastgate');
  const town = $derived(settlementById(townId));
  const townStock = $derived(stockOf(town?.id));
  const junkTotal = $derived(Object.values(gameState.junkByRarity).reduce((a: number, b: number) => a + b, 0));

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
    if (!canTravel(gameState, id)) { saveNote = 'No road link to that settlement yet'; return; }
    if (!gameState.town.visited.includes(id)) gameState.town.visited.push(id);
    gameState.zone = s.zone;
    gameState.group = [];
    gameState.town.waypoint = id;
    push(gameState, `Travelling in ${s.name}`);
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
    townNote = r.ok ? `Walking ${linkLabel(i)} · ${road.R.trip_min} min, ${road.encountersPerTrip} encounters` : `Cannot start: ${r.why}`;
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
      ? 'Hunting will move on by itself through settlements already opened'
      : 'Hunting stays in this zone until you travel');
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

<header>
  <h1>ModWorld</h1>
  <nav>
    {#each TABS as t}
      <button class:active={tab === t} onclick={() => (tab = t)}>{t === 'main' ? 'main screen' : t}</button>
    {/each}
  </nav>
  <div class="meta">
    {zone.name} L{gameState.player.level} · {minutes} min · kills {gameState.counters.kills} · {kph.toFixed(0)}/hr
  </div>
</header>

{#if tab === 'main'}
  <div class="main">
    <section class="panel region scene">
      <h2>Combat scene · {zone.name}</h2>
      {#if awayReport}
        <div style="display:flex;gap:.5rem;align-items:baseline;flex-wrap:wrap;border:1px solid #8a7048;border-radius:6px;padding:.4rem .6rem;margin:.3rem 0;font-size:.85rem">
          <button onclick={() => (awayReport = null)} aria-label="Dismiss" style="background:none;border:none;cursor:pointer;color:inherit">✕</button>
          <strong>Welcome back</strong>
          <span>away {awayReport.mins} min · {awayReport.secs} sec simulated{awayReport.capped ? ' (capped at the offline limit)' : ''}</span>
          <span>+{fmtNum(awayReport.kills)} kills · {fmtNum(awayReport.drops)} items · {fmtNum(awayReport.stones)} stones · {fmtNum(awayReport.junk)} junk · {fmtNum(awayReport.gold)} gold{awayReport.levels ? ` · +${awayReport.levels} level${awayReport.levels > 1 ? 's' : ''}` : ''}{awayReport.laps ? ` · ${awayReport.laps} road lap${awayReport.laps > 1 ? 's' : ''}` : ''} · quality floor {awayReport.quality}</span>
        </div>
      {/if}
    <div class="bars">
      <!-- character-sheet.md: Energy Shield sits above HP while it is present -->
      {#if c.es > 0}
        <label>Energy Shield <progress class="es" max={c.es} value={gameState.player.es}></progress> {Math.round(gameState.player.es)} / {Math.round(c.es)}</label>
      {/if}
      <label>HP <progress class="hp" max={c.maxHp} value={gameState.player.hp}></progress> {fmtNum(gameState.player.hp)} / {fmtNum(c.maxHp)} (+{c.hpRegen.toFixed(0)}/sec)</label>
      <label>Mana <progress class="mana" max={c.maxMana} value={gameState.player.mana}></progress> {fmtNum(gameState.player.mana)} / {fmtNum(c.maxMana)}</label>
      <label>XP <progress class="xp" max={eng.xpToNext(gameState.player.level)} value={gameState.player.xp}></progress> {fmtNum(gameState.player.xp)} / {fmtNum(eng.xpToNext(gameState.player.level))}</label>
      <!-- character-sheet.md's main panel: HP, Mana and Attack speed are the three always shown; Weight lives on the character bag panel (D-126) -->
      <span>Attack speed {c.hitsPerSec.toFixed(2)} hits/sec <small>(Cap {E.caps.aspd})</small></span>
    </div>
    <!-- the skill bar, read-only on the fight panel (D-130): arranging the order stays on the Skills tab -->
    <div class="skill-strip" role="list" aria-label="Skill bar">
      {#each gameState.skills.list as id, i}
        {@const k = id ? sm.byId[id] : null}
        <span class="skill-slot" class:empty={!id || !k} role="listitem" title={`Slot ${i + 1}${id && k ? ': ' + k.name : ': empty'}`}>
          {#if id && k}
            <span class="skill-label"><img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" />{k.name}</span>
            <small class:ready={(gameState.skills.cd[id] || 0) <= 0}>{(gameState.skills.cd[id] || 0) <= 0 ? 'ready' : `${(gameState.skills.cd[id] || 0).toFixed(1)}s`}</small>
          {/if}
        </span>
      {/each}
    </div>
    <p class="state">
      <label class="travel">Hunt zone
        <button class={gameState.travel === 'stay' ? 'active' : ''} onclick={() => setTravel('stay')}>stay here</button>
        <button class={gameState.travel === 'forward' ? 'active' : ''} onclick={() => setTravel('forward')}>move on when this zone is behind me</button>
        <small>{gameState.travel === 'forward'
          ? `walks on to the next settlement you have already opened, once level ${zone.levels[1] + 1} is reached`
          : 'stays in this zone however high you get — you choose when to travel'}</small>
      </label>
    </p>
    <p class="state">
      <label class="travel">Hunt order
        <button class={(gameState.huntOrder?.[gameState.zone] || 'none') === 'none' ? 'active' : ''} onclick={() => setHuntOrder('none')}>balanced</button>
        <button class={gameState.huntOrder?.[gameState.zone] === 'gear' ? 'active' : ''} onclick={() => setHuntOrder('gear')}>gear</button>
        <button class={gameState.huntOrder?.[gameState.zone] === 'herb' ? 'active' : ''} onclick={() => setHuntOrder('herb')}>herbs</button>
        <button class={gameState.huntOrder?.[gameState.zone] === 'junk' ? 'active' : ''} onclick={() => setHuntOrder('junk')}>junk</button>
        <small>Lean this zone's drops toward one stream. It moves weight between gear, herbs and junk — never the total, so nothing the timeline is priced on shifts. Stones are not a category.</small>
      </label>
    </p>
    <p class="state">
      {#if gameState.phase === 'camp'}Pushed — recovering at camp for {gameState.campSec} sec. No death, no loss: time is the only cost.{:else}Fighting · {c.hitsPerSec.toFixed(2)} hits/sec with {c.weaponName}, {c.weaponElement ? `carrying ${c.weaponElement}` : 'carrying no Element'}{/if}
    </p>
    <table>
      <thead><tr><th>Target</th><th>Body</th><th>HP</th><th>PS</th><th>Hit vs</th><th>Dodge</th><th>Innate</th><th>Under a curse</th></tr></thead>
      <tbody>
        {#each gameState.group as m}
          <tr>
            <td>
              <span class="mob-name" class:elite={m.kind === 'Elite'} class:boss={m.kind.startsWith('Boss')}><img src={mobIcon(m.species)} alt="" aria-hidden="true" />{fieldLabel(m)}</span>
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
      {/each}
    </div>
    <button onclick={() => (running = !running)}>{running ? 'Pause' : 'Resume'}</button>
    <button onclick={step}>One tick</button>
    <button onclick={() => { if (confirm('Start a new character?')) reset(); }}>New character</button>
    </section>

    <section class="panel region sheet">
      <h2>Character sheet · level {gameState.player.level}</h2>
      <h3>Worn ({gameState.gear.filter(Boolean).length} / {E.stat.item_slots}) — hover a slot on the body to read it</h3>
      <SlotGrid entries={wornEntries} capacity={E.stat.item_slots} wornOf={wornOf} fixed layout="doll" />

      <p><small>Levels grant <b>points</b>, not stats: unspent <b>{gameState.player.statPoints}</b> · tree points banked <b>{gameState.player.treePoints}</b>. <label><input type="checkbox" checked={gameState.player.autoSpend} onchange={() => { gameState.player.autoSpend = !gameState.player.autoSpend; gameState = { ...gameState }; }} /> auto-allocate evenly (idle default)</label> — turn it off to bank points and spend them by hand. Respec is free, at the town Counterhand.</small></p>
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
          <tr><td>Alignment</td><td>{c.alignment.toFixed(1)}% (Cap {E.caps.alignment})</td></tr>
          <tr><td>Cooldown reduction</td><td>{c.cdr.toFixed(1)}% (Cap {E.caps.cdr})</td></tr>
          <tr><td>Energy Shield</td><td>{Math.round(c.es)} · recharges {c.esRegen.toFixed(1)}/sec after {E.energy_shield.delay_sec} sec</td></tr>
          <tr><td>Weight</td><td>{c.weightUsed.toFixed(0)} used / {Math.round(c.weightCap)} capacity{c.encumbrance > 0 ? ` · aspd ${(c.encumbrance * -100).toFixed(0)}%` : ' · no tax'}</td></tr>
        </tbody>
      </table>

      <h3>The gate</h3>
      <p class="gate">{describeGoal()}</p>
      <p><small>
        {#if gameState.goal.done}
          Met at {Math.round(gameState.goal.done.clockSec / 60)} min of play on a level {gameState.goal.done.level} character, {gameState.goal.attempts} spawn{gameState.goal.attempts === 1 ? '' : 's'} in. The run keeps going: levels past it are the item-quality push in the same zone, and there is no prestige.
        {:else}
          Not met yet. It takes {gameState.goal.attempts === 0 ? 'no spawn of this boss yet' : `${gameState.goal.attempts} spawn${gameState.goal.attempts === 1 ? '' : 's'}`}, and every Push inside a spawn starts the count over.
        {/if}
      </small></p>
    </section>

    <section class="panel region temp">
      <h2>Temp inventory · adventure bag ({gameState.bag.length} / {E.inventory.adventure_slots})</h2>
      {#if gameState.bag.length >= E.inventory.adventure_slots}
        <p class="warn"><b>Bag full — the zone has stopped paying.</b> A full bag picks up nothing and turns nothing into a stone, so {gameState.counters.overflow || 0} pieces so far were left on the ground instead of turning into Reroll value. Walk back to {settlementById(gameState.town.waypoint)?.name || 'a settlement'} and deposit, then come out again.</p>
      {:else}
        <p><small>Kept pieces wait here until you choose. Hover a slot to read the piece and Equip it — nothing equips itself.</small></p>
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
        <summary>Bag filter — what this run keeps</summary>
        <p><small>The filter is <b>off by default</b> — an off slot keeps every drop and dissolves nothing. Turn a slot on and a piece that fails its rule turns into 1 Reroll value stone on the spot (stones are always kept, never discarded) — nothing is deleted.</small></p>
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
        <p><small>Still not found — Elements you have no resistance for: <b>{gameState.filter.missing.elements.length ? gameState.filter.missing.elements.join(', ') : 'none'}</b> · empty slots: <b>{gameState.filter.missing.slots.length ? gameState.filter.missing.slots.join(', ') : 'none'}</b></small></p>
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
      <p><small>
        Stones and junk stack {E.inventory.stack_size.stone} per slot and weigh nothing · herbs and draughts stack {E.inventory.stack_size.herb} per slot and weigh {E.inventory.unit_weight.herb} each · gold takes no slot.
        A grant with no slot left is left where it is ({gameState.counters.stopped || 0} so far) — nothing is deleted and nothing becomes a different medium.
        {pouchSlots(gameState) > 0 ? `The Porter's pouches added ${pouchSlots(gameState)} of these slots · ` : ''}Clear space by selling junk at the Counterhand, brewing herbs into draughts, or condensing ten bottles into one.
      </small></p>
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
    <p><small>{skillNote || `Six sets are stored and the game picks one by zone. A Push brings the Main set back, and a skill already counting its cooldown keeps counting.`}</small></p>
    <p><small>The game presses the first slot whose cooldown is ready and whose mana fits the usable pool. You only arrange the order. A percentage skill charges that share of the usable pool; a flat skill charges its own units, which grow with its level and with the pool. Reserved by auras: {reserved}% of the pool, so {Math.round(c.maxMana * (1 - reserved / 100))} mana stays usable.</small></p>
    <table>
      <thead><tr><th>#</th><th>Skill</th><th>Level</th><th>cd → eff</th><th>Mana</th><th>Next in</th><th>Place</th></tr></thead>
      <tbody>
        {#each gameState.skills.list as id, i}
          {@const k = id ? sm.byId[id] : null}
          <tr>
            <td>{i + 1}</td>
            <td>
              {#if k}<span class="skill-label"><img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" />{k.name}</span>{:else}—{/if}
            </td>
            <td>{id ? `${skillLevel(gameState.skills, id)} / ${E.skill_xp.level_cap}` : ''}</td>
            <td>{k && id ? `${k.cd}s → ${skillCd(gameState.skills, id, c.cdr).toFixed(2)}s` : ''}</td>
            <td>{k && id ? manaNow(c, gameState.skills, id) : ''}</td>
            <td>{id ? `${(gameState.skills.cd[id] || 0).toFixed(1)}s${(gameState.skills.buffUp[id] || 0) > 0 ? ` · window ${gameState.skills.buffUp[id]}s` : ''}` : ''}</td>
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
    <h3>Duplicates feed each skill's own ladder</h3>
    <table>
      <thead><tr><th>Skill</th><th>Type</th><th>Dupes</th><th>Ladder</th><th>Effect</th></tr></thead>
      <tbody>
        {#each Object.keys(gameState.skills.owned) as id}
          {@const k = sm.byId[id]}
          <tr>
            <td><span class="skill-label"><img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" />{k.name}</span></td><td>{k.type}</td><td>{gameState.skills.owned[id]}</td>
            <td>{ladderOf(gameState.skills, id)}% cd</td>
            <td>{k.effect || (k.final_pct != null ? `${pct2(k.final_pct)}% of its ${k.basis} hit` : k.reserve) || ''}</td>
          </tr>
        {:else}
          <tr><td colspan="5">No skill yet — the first one is a boss drop ({(E.skill_drop.boss * 100).toFixed(0)}% per boss kill).</td></tr>
        {/each}
      </tbody>
    </table>
    <h3>Buff track (re-presses itself, takes no slot)</h3>
    {#each ownedBuffs as k}
      <label><input type="checkbox" checked={gameState.skills.buffs[k.id]} onchange={() => toggle(k.id)} /> <span class="skill-label"><img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" />{k.name}</span> · {k.duration} on / {k.cd}s cd · {manaNow(c, gameState.skills, k.id)} · {effectLine(k) || k.effect}</label><br />
    {:else}
      <p><small>None owned.</small></p>
    {/each}
    <p><small>Reserved {reservedPct(gameState.skills)}% of Max Mana · the block is {sm.RESERVATION_LIMIT}%. Up right now: {describeFold(effectsActive(gameState.skills)) || 'nothing — no aura is on and no buff is counting'}.</small></p>
    <h3>Aura set (reserves Max Mana, may not reserve all of it)</h3>
    {#each ownedAuras as k}
      <label><input type="checkbox" checked={gameState.skills.auras[k.id]} onchange={() => toggle(k.id)} /> <span class="skill-label"><img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" />{k.name}</span> · {k.reserve} ({sm.reservePct(k.reserve)}%) · {effectLine(k) || k.effect}</label><br />
    {:else}
      <p><small>None owned.</small></p>
    {/each}

    <h3>Mastery ladder · the whole roster</h3>
    <p><small>Only the held weapon earns XP (4 a kill), but the account keeps the best value any slot reached. The fight panel shows just the held one; this is every weapon.</small></p>
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

    <h3>Curable curses · target-side lines a press can put on a mob</h3>
    <ul>
      {#each curableRows() as k}
        <li>{k.name} · {effectLine(k) || k.effect}</li>
      {:else}
        <li><small>None.</small></li>
      {/each}
    </ul>
  </section>
{/if}

{#if tab === 'town'}
  <section class="panel">
    <h2>{town.name} · {town.band} band{town.capital ? ` · ${town.capital} capital` : ''}</h2>
    <p><small>Innate Element {town.innate.join(' / ')} · Base bias flavour {town.base_bias_flavor} · NPCs here: {town.npcs.map((n: string) => npcOf(n).name).join(' · ')}</small></p>

    <h3>Counterhand · the gold mint</h3>
    <p>Gold {gameState.counters.gold.toFixed(1)} · junk unsold {junkTotal} ({Object.entries(gameState.junkByRarity).map(([r, n]) => `${r} ${n}`).join(' · ') || 'none'}) · stones {stonesLine()}</p>
    <button onclick={doSell} disabled={junkTotal === 0}>Sell all junk here</button>
    <p><small>Junk sells for its rarity price and nothing else mints gold except a Road event. Rejected gear dissolved for Reroll value stones instead — the two media never mix.</small></p>

    <h3>Respec · free</h3>
    <p><small>Hand every allocated stat point back and re-spend them. Free, and only here in a settlement — this game has no death, so a locked build would be a worse punishment than a lost fight.</small></p>
    <button onclick={respec} disabled={!STATS.some((k) => gameState.player.points[k])}>Respec — refund all points</button>

    <h3>Standing</h3>
    <p>Tier {standingTier(gameState, town.id)} / {TOWN.standing.tiers.length} · {(standingShare(gameState, town.id) * 100).toFixed(1)}% of the {town.budget_hr} hr of zone {town.zone} kills that Tier I asks for. Standing buys stock lines, set slots and cosmetics — never a stat, a Mod, a stone or anything mob_HP reads.</p>

    <h3>Stall stock</h3>
    <table>
      <thead><tr><th>Line</th><th>NPC</th><th>Kind</th><th>Minutes of income</th><th>Gold</th><th></th></tr></thead>
      <tbody>
        {#each townStock as row}
          {@const check = canBuy(gameState, town.id, row.id)}
          <tr>
            <td>{row.item}</td>
            <td>{npcOf(row.npc).name}</td>
            <td>{row.kind}</td>
            <td>{priceMinutes(row, town.id, gameState)} m{row.charge_band ? ` @ ${row.charge_band}` : ''}</td>
            <td>{priceGold(row, town.id, gameState)}</td>
            <td><button onclick={() => doBuy(row.id)} disabled={!check.ok}>{check.ok ? 'buy' : check.why}</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p><small>Curio pedlar — today's rolled prices {gameState.pedlar.minutes.join(' / ')} minutes, {gameState.pedlar.bought} of {gameState.pedlar.minutes.length} bought; restocks at the next game day.</small></p>

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
    <p><small>Payouts are stones only, sized at {TOWN.task_sizing.reward_minutes_of_band_income} minutes of that band's own stone income — the sizing lives in <code>town.json</code> so the rebalance pass can move it without touching code.</small></p>

    <h3>Road · {gameState.town.linksBought} of {ROAD_LINKS} links bought</h3>
    <table>
      <thead><tr><th>Settlement</th><th>Band</th><th>Zone</th><th>Reachable</th><th></th></tr></thead>
      <tbody>
        {#each TOWN.settlements as s}
          <tr>
            <td>{s.name}</td><td>{s.band}</td><td>{s.zone}</td>
            <td>{canTravel(gameState, s.id) ? 'yes' : 'needs a Road link'}</td>
            <td><button onclick={() => travelTo(s.id)} disabled={!canTravel(gameState, s.id)}>{townId === s.id ? 'here' : 'travel'}</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p>{saveNote}</p>
    <h3>Stash · {tabs} / 6 tabs</h3>
    <p><small>There is no Bag Cap, so a tab is organisation rather than space — the Porter sells them and a house grants two. Stash and bench are Settlement-only: a long run ends in a trip home.</small></p>
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

    <h3>Road · {E.road.links.length} links · {E.road.trip_min} min each</h3>
    {#if gameState.road}
      <p>On the Road: {linkLabel(gameState.road.linkIndex)} · {gameState.road.secLeft}s left · {gameState.road.encountersLeft} encounters to go{gameState.road.kind ? ` · ${gameState.road.kind} in progress` : ''}</p>
    {/if}
    <table>
      <thead><tr><th>Link</th><th>Reachable</th><th>Purse today</th><th></th></tr></thead>
      <tbody>
        {#each road.links as l}
          <tr>
            <td>{l.text}</td>
            <td>{linkReachable(gameState, l.index) ? 'walkable from here' : 'neither end known'}</td>
            <td>{purseReady(gameState, l.index) ? `${E.road.purse_gold} gold` : 'taken'}</td>
            <td><button onclick={() => doTrip(l.index)} disabled={!linkReachable(gameState, l.index) || !!gameState.road}>walk</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p><small>Opt-in and online only: {E.road.encounters_per_min} encounter a minute, the purse pays once per link per day ({road.purseCapPerDay} gold a day at most), Standing arrives as {E.road.standing_per_trip_kills} kill-equivalents, and a Push forfeits the trip. The Road pays no stones and never runs while you are away.</small></p>
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
        <p><small>Still hunting: {colSet.parsed.filter((p: any) => heldCount(gameState, colSet.id, p.name) === 0).map((p: any) => `${p.name} (${p.slot})`).join(' · ') || 'every piece is in hand — turn it in.'} Frames roll even-weighted across the whole world, so the target is the {colSet.quality} quality and the {colSet.school} school, not one zone.</small></p>
      {/if}
      <button onclick={doTurnIn} disabled={!setUnlocked(gameState, colSet) || gameState.collector.done[colSet.id]}>turn in the set</button>
      <p><small>Reward: {colSet.reward} · {colSet.rule} · the Collector pays no gold and no Mod anywhere (T14).</small></p>
    {/if}

    {#if gameState.grants.filter_presets || gameState.grants.titles.length || gameState.grants.banners.length}
      <h3>Collector grants</h3>
      <p><small>{gameState.grants.filter_presets} extra filter preset{gameState.grants.filter_presets === 1 ? '' : 's'} · {stashTabCount(gameState)} stash tabs{gameState.grants.titles.length ? ` · titles: ${gameState.grants.titles.join(', ')}` : ''}{gameState.grants.banners.length ? ` · banners: ${gameState.grants.banners.join(', ')}` : ''}.</small></p>
    {/if}

    <h3>Crafting bench · paid in stones, never gold</h3>
    <p><small>The bench is Settlement-only, so it lives here. Reroll moves a value inside its own Tier and never down, Refine pushes one slot up a Tier, Ascend raises the whole piece one Item quality step. Element and Mod identity sit outside every stone except Corrupt, which is the one gamble allowed to change an Element (`crafting.md`).</small></p>
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
  </section>
{/if}

{#if tab === 'farm'}
  <section class="panel">
    <h2>Farming · level {fl} / {farm.F.level_cap}</h2>
    <p><small>The one life skill, and it grants no power: every output is the herb a draught is brewed from. {gameState.farm.xp} Farm XP · {farm.xpPerHarvest} per harvest · {farm.F.growth_hours} h a cycle · {farm.plotsMax} plots at most ({plots} yours — the Steward sells the two deeds).</small></p>

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
    <p><small>Shared cooldown {farm.P.shared_cooldown_sec} sec · {farm.P.max_uses_per_fight} uses a fight · {farm.P.boss_suppressed ? 'suppressed entirely on bosses' : ''} · a condensed bottle is {farm.P.condensed.effect_mult}× and weighs {farm.P.condensed.weight} against {farm.P.weight} loose.</small></p>
    <p>{farmNote}</p>
  </section>
{/if}



{#if tab === 'zones'}
  <section class="panel">
    <h2>Zones</h2>
    <table>
      <thead><tr><th>Zone</th><th>Levels</th><th>mob_HP</th><th>Quality</th><th>Elements</th><th>Group</th><th></th></tr></thead>
      <tbody>
        {#each E.mob.zones as z}
          <tr>
            <td>{z.id} · {z.name}</td>
            <td>{z.levels.join('-')}</td>
            <td>{z.hp.join(' → ')}</td>
            <td>{z.quality}</td>
            <td>{z.elements.join(', ')}</td>
            <td>{z.group}</td>
            <td><button onclick={() => goToZone(z.id)} disabled={z.id === gameState.zone || !gameState.town.visited.includes(settlementOfZone(z.id)?.id)}>
              {z.id === gameState.zone ? 'here' : gameState.town.visited.includes(settlementOfZone(z.id)?.id) ? 'walk' : 'not opened'}
            </button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p><small>A mob spawns at your level clamped into its zone, so these HP figures are the two ends of a linear curve the engine interpolates between.</small></p>
  </section>
{/if}

{#if tab === 'map'}
  <section class="panel">
    <h2>Map</h2>
    <p><small>The terrain background is hand-drawn; the overlay (nodes, links, terrain glyphs) is generated by <code>node tools/map.ts --write</code> from the map data file. Coordinates are presentation only — the simulation reads ids (X33 · M7).</small></p>
    <div class="map-frame">
      <img src={mapTerrain} alt="Terrain" />
      <img src={mapOverlay} alt="Settlements, roads and terrain features" />
    </div>

    <h3>Circuit · the Road on a loop</h3>
    {#if gameState.road?.circuit.length}
      <p><small>Walking a {gameState.road.circuit.length}-link Circuit · lap {gameState.road.laps} · leg {gameState.road.legIndex + 1} of {gameState.road.circuit.length}.</small></p>
      <button onclick={doStopCircuit}>Stop the Circuit</button>
    {:else}
      <p><small>Stand in a settlement, pick links in order, and the Road will loop them — the Circuit must start where you stand and each link must meet the next. {draftCheck.ok ? 'Ready to start.' : (draftCheck.why ? draftCheck.why : 'Pick at least one link.')}</small></p>
      <div>
        {#each E.road.links as _l, i}
          <button class={circuitDraft.includes(i) ? 'active' : ''} onclick={() => toggleCircuitLink(i)}>{linkLabel(i)}</button>
        {/each}
      </div>
      <button onclick={doStartCircuit} disabled={!draftCheck.ok}>Start the Circuit ({circuitDraft.length} link{circuitDraft.length === 1 ? '' : 's'})</button>
      {#if circuitDraft.length}<button onclick={() => (circuitDraft = [])}>Clear</button>{/if}
    {/if}
    <p>{townNote}</p>
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
    <p><small>Owed on a level up, on a successful Ascend or Refine, and every {SAVE_CFG.snapshot_interval_min} minutes of play. They guard a corrupt file, never a wrong decision: a restore takes the character back whole — stones, Reroll baselines and craft counts included — and the shared account record is rebuilt from the slots that survived.</small></p>
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

    <h2>Settings</h2>
    <p><small>Client-only and shared by all three slots — these never enter a save file, and no `engine.json` constant is shadowed here. Automation lives with what it drives: potion auto-use and auto-farm on the Farm tab, the bag filter on the Main tab, presets on the Skills tab.</small></p>
    <label>Number format
      <select value={settings.numberFormat} onchange={(e) => setSetting('numberFormat', (e.target as HTMLSelectElement).value as 'plain' | 'short')}>
        <option value="plain">plain — 12,345</option>
        <option value="short">short — 12.3k</option>
      </select>
    </label>
    <label><input type="checkbox" checked={settings.offlineReport} onchange={(e) => setSetting('offlineReport', (e.target as HTMLInputElement).checked)} /> Show the welcome-back report after an away period</label>
    <label>Auto-dissolve drops at or below
      <select value={gameState.autoDissolveRarity ?? 'off'} onchange={(e) => { gameState.autoDissolveRarity = (e.target as HTMLSelectElement).value as 'off' | 'Common' | 'Rare'; gameState = { ...gameState }; }}>
        <option value="off">off — keep every drop for a decision</option>
        <option value="Common">Common — dissolve Common into Reroll stones</option>
        <option value="Rare">Rare — dissolve Common and Rare</option>
      </select>
    </label>
    <p><small>Auto-dissolve turns a piece into Reroll stones, never gold — the Counterhand is still the only place junk becomes gold. A locked or Collector-held piece is spared.</small></p>
  </section>
{/if}

<style>
  header { display: flex; gap: 1rem; align-items: center; padding: .6rem .8rem; border-bottom: 1px solid var(--line); }
  nav { display: flex; gap: .3rem; flex: 1; }
  .meta { color: var(--dim); }
  button.active { border-color: var(--good); color: var(--good); }
  .panel { padding: .8rem; }
  /* the map: the generated overlay sits exactly on top of the hand-drawn terrain */
  .map-frame { position: relative; max-width: 900px; }
  .map-frame img { width: 100%; display: block; }
  .map-frame img + img { position: absolute; inset: 0; }

  /* the main screen: the fight on top of the two bags, the sheet as a sidebar that stays put */
  .main {
    display: grid;
    gap: .6rem;
    padding: .6rem;
    align-items: start;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1.05fr) minmax(0, .95fr);
    grid-template-areas:
      "scene scene sheet"
      "temp  inv   sheet";
  }
  .region { min-width: 0; border: 1px solid var(--line); border-radius: 4px; }
  .scene { grid-area: scene; }
  .sheet { grid-area: sheet; }
  .temp { grid-area: temp; }
  .inv { grid-area: inv; }
  @media (max-width: 1100px) {
    .main { grid-template-columns: minmax(0, 1fr); grid-template-areas: "scene" "temp" "inv" "sheet"; }
  }
  .stats td { font-size: .78rem; padding: .08rem .3rem; }
  .stats td:first-child { color: var(--dim); width: 45%; }
  .gate { font-size: .82rem; }
  .filter { margin-top: .5rem; }
  .filter summary { cursor: pointer; color: var(--dim); font-size: .8rem; }
  .filter table { margin-top: .4rem; }

  .bars { display: grid; gap: .3rem; margin-bottom: .6rem; }
  .bars label, .bars span { display: flex; align-items: center; gap: .5rem; }
  /* the read-only skill bar on the fight panel (D-130) */
  .skill-strip { display: flex; flex-wrap: wrap; gap: .3rem .5rem; margin-bottom: .6rem; }
  .skill-slot { display: inline-flex; align-items: center; gap: .35rem; padding: .15rem .4rem; border: 1px solid var(--line); border-radius: 4px; font-size: .72rem; }
  .skill-slot.empty { min-width: 2.6rem; min-height: 1.5rem; border-style: dashed; opacity: .5; }
  .skill-slot small { color: var(--dim); }
  .skill-slot small.ready { color: var(--mana); }
  .weight { margin: 0 0 .5rem; }
  .weight small { color: var(--dim); }
  progress { width: 220px; height: 10px; border: 0; border-radius: 3px; overflow: hidden; }
  progress::-webkit-progress-bar { background: var(--line); border-radius: 3px; }
  progress::-webkit-progress-value { border-radius: 3px; }
  progress::-moz-progress-bar { border-radius: 3px; }
  progress.hp::-webkit-progress-value { background: var(--hp); }
  progress.hp::-moz-progress-bar { background: var(--hp); }
  progress.mana::-webkit-progress-value { background: var(--mana); }
  progress.mana::-moz-progress-bar { background: var(--mana); }
  progress.es::-webkit-progress-value { background: var(--es); }
  progress.es::-moz-progress-bar { background: var(--es); }
  progress.xp::-webkit-progress-value { background: var(--xp); }
  progress.xp::-moz-progress-bar { background: var(--xp); }
  .state { color: var(--dim); }
  .warn { color: var(--hp); }
  .log { margin: .6rem 0; max-height: 190px; overflow: auto; font-size: 12px; color: var(--dim); }
  .log .t { color: var(--mob); margin-right: .4rem; }
  .mobbar { display: inline-block; height: 8px; background: var(--hp); margin-right: .4rem; vertical-align: middle; }
  .mob-name, .element-label, .skill-label { display: inline-flex; align-items: center; gap: .35rem; }
  .mob-name img { width: 1.25rem; height: 1.25rem; object-fit: contain; }
  .mob-name.elite { color: #b98cff; }
  .mob-name.boss { color: #ff6b6b; }
  .element-list { display: flex; flex-wrap: wrap; gap: .25rem .5rem; }
  .element-label { font-size: .72rem; }
  .element-label img, .skill-label img { width: 1.1rem; height: 1.1rem; object-fit: contain; flex: none; }
</style>
