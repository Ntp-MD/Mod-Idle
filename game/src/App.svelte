<script lang="ts">
  import { onMount } from 'svelte';
  import { eng, E, sm, TOWN } from './engine/client';
  import { buildCharacter } from './sim/player';
  import { newGame, tick, push, catchUp, carried, heldWeaponName } from './sim/game';
  import { reservedPct, skillCd, skillLevel, ladderOf, effectsActive, toggleTrack, effectLine, describeFold, EFFECT_LABEL, ACTIVE_SLOTS } from './sim/skills';
  import { modsOn, psMult } from './sim/curse';
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
  import { stashTabCount, deposit, withdraw } from './sim/town';
  import { road, startTrip, linkReachable, purseReady, linkLabel } from './sim/road';
  import { masteryLabel, dropBonusPct, masteryLevel } from './sim/mastery';
  import { storePreset, switchPreset, bindZone } from './sim/presets';
  import { col, setUnlocked, heldCount, turnIn } from './sim/collector';
  import { mulberry32 } from './engine/client-helpers';
  import { writeSave, readSave, exportJson, importJson, saveSlots, listSnapshots, restoreSnapshot, type SlotName, type Snapshot } from './state/save';
  import { FILTER_SLOTS, RARITY_CHOICES, ruleFor, setRule, describeRule } from './sim/filter';
  import { equipFromBag, gearModOf } from './sim/gear';
  import { SAVE_CFG } from './sim/snapshot';
  import { target as goalTarget, describe as describeGoal } from './sim/goal';
  import type { GameState } from './sim/types';
  import type { StatKey } from './engine/client';
  import type { Statuses } from './sim/combat';

  const STATS: StatKey[] = ['str', 'int', 'vit', 'agi', 'dex', 'wis', 'lck'];
  let state = $state<GameState>(newGame());
  let statuses: Statuses = {};
  let running = $state(true);
  let tab: 'main' | 'skills' | 'town' | 'farm' | 'zones' | 'save' = $state('main');
  let saveNote = $state('');

  let c = $derived(buildCharacter(state.player.level, state.gear, carried(state), masteryLevel(state, heldWeaponName(state) || ''), effectsActive(state.skills)));
  let zone = $derived(eng.zoneById(state.zone));
  let minutes = $derived(Math.floor(state.counters.playSec / 60));
  let kph = $derived(state.counters.playSec > 0 ? (state.counters.kills / state.counters.playSec) * 3600 : 0);

  // The four regions of the main screen, in the shape the slot grid draws. Order and mode are the
  // player's choice; every value inside a slot is read from the engine, never recomputed here.
  let invMode = $state<'grid' | 'list'>('grid');
  let tempMode = $state<'grid' | 'list'>('grid');
  let invSort = $state<SortKey>('slot');
  let tempSort = $state<SortKey>('rarity');

  const wornOf = (slot: string) => state.gear.find((g) => g && g.slot === slot) || null;
  /** the pile the hunt dropped — 50 slots, one piece each, waiting for a decision */
  const tempEntries = $derived(sortEntries(state.bag.map((item, i) => gearEntry(item, i)), tempSort));
  /** what the character carries — stones, herbs, draughts and junk, one slot per stack */
  const invEntries = $derived(sortEntries(bagStacks(state).map((s, i) => stackEntry(s, i)), invSort));
  /** the twelve worn slots keep their positions, the way an equipment panel does */
  const wornEntries = $derived(
    state.gear
      .map((g, i) => (g ? ({ ...gearEntry(g, i), kind: 'worn' } as SlotEntry) : null))
      .filter(Boolean) as SlotEntry[],
  );

  function step() {
    const next = { ...state };
    tick(next, statuses);
    state = next;
  }

  onMount(() => {
    // monotonic clock: catch up on the time between sessions, capped by the save rule
    const away = (Date.now() - (state.lastSavedAt || Date.now())) / 1000;
    if (away > 5 && away < 7 * 24 * 3600) {
      const r = catchUp(state, statuses, away);
      push(state, `Away ${Math.round(away / 60)} min — ${r.simulated} sec simulated${r.capped ? ' (capped at the offline limit)' : ''}`);
      state = { ...state };
    }
    loadSnaps();
    const timer = setInterval(() => { if (running) step(); }, 1000);
    return () => clearInterval(timer);
  });

  function equip(index: number) {
    // the rule lives in `sim/gear.ts`, where the tests can reach it too; this copy only makes the
    // panel re-read the state the verb mutated in place
    equipFromBag(state, index);
    state = { ...state };
  }

  /** The stat a piece's Stat Mod feeds — the choice a build is made of, taken from the detail card. */
  function chooseStatAt(index: number, stat: StatKey) {
    const item = state.bag[index];
    if (!item) return;
    (item as any).chosenStat = stat;
    state = { ...state };
  }

  function goToZone(id: number) {
    const s = settlementOfZone(id);
    if (!s || !state.town.visited.includes(s.id)) {
      saveNote = `${eng.zoneById(id).name} is not opened yet — walk the Road from the town panel`;
      tab = 'town';
      return;
    }
    state.zone = id;
    state.group = [];
    state.player.atkTimer = 0;
    push(state, `Walking to ${eng.zoneById(id).name} (levels ${eng.zoneById(id).levels.join('-')})`);
    state = { ...state };
  }

  async function doSave(slot: SlotName) {
    state.lastSavedAt = Date.now();
    await writeSave(slot, state); // one write may also take a snapshot and arm the next timer
    state = { ...state };
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
    state = s;
    const what = describeSnap(snaps[index]);
    await loadSnaps();
    snapNote = `Rewound ${snapSlot} to the backup taken ${what} — the character went back whole, stones and craft counts with it`;
  }

  const describeSnap = (shot?: Snapshot) => (shot ? `${shot.reason} at ${Math.round(shot.clockSec / 60)} min` : '—');

  function editRule(slot: string, patch: Record<string, unknown>) {
    setRule(state.filter, slot, patch as any);
    state = { ...state };
  }

  async function doLoad(slot: SlotName) {
    const s = await readSave(slot);
    if (!s) { saveNote = `${slot} is empty`; return; }
    statuses = {};
    state = { ...s };
    const away = (Date.now() - (s.lastSavedAt || Date.now())) / 1000;
    const r = catchUp(state, statuses, away);
    saveNote = `Loaded ${slot} — ${r.simulated} sec caught up`;
    state = { ...state };
  }

  function download() {
    const blob = new Blob([exportJson(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `modworld-${state.player.level}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function upload(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      state = importJson(await file.text());
      statuses = {};
      saveNote = 'Imported';
      state = { ...state };
    } catch (e) {
      saveNote = `Import failed: ${(e as Error).message}`;
    }
  }

  function reset() {
    state = newGame();
    statuses = {};
    saveNote = '';
  }

  // the panel follows the zone the character is actually hunting, so an auto-travel step cannot
  // leave it showing the town the character walked away from
  const townId = $derived(settlementOfZone(state.zone)?.id || 'eastgate');
  const town = $derived(settlementById(townId));
  const townStock = $derived(stockOf(town?.id));
  const junkTotal = $derived(Object.values(state.junkByRarity).reduce((a: number, b: number) => a + b, 0));

  function doSell() {
    const r = sellJunk(state);
    push(state, `Counterhand: sold ${r.pieces} junk for ${r.gold} gold`);
    state = { ...state };
  }

  function doBuy(rowId: string) {
    const r = buy(state, town.id, rowId);
    saveNote = r.ok ? `Bought ${r.row.item}` : `Cannot buy: ${r.why}`;
    state = { ...state };
  }

  function doClaim(i: number) {
    const t = state.town.tasks[i];
    if (t && claimTask(state, i)) push(state, `Task paid: ${t.count} ${t.stone} stone(s)`);
    state = { ...state };
  }

  function travelTo(id: string) {
    const s = settlementById(id);
    if (!canTravel(state, id)) { saveNote = 'No road link to that settlement yet'; return; }
    if (!state.town.visited.includes(id)) state.town.visited.push(id);
    state.zone = s.zone;
    state.group = [];
    state.town.waypoint = id;
    push(state, `Travelling in ${s.name}`);
    state = { ...state };
  }

  let bench = $state<{ where: Where; index: number } | null>(null);
  let benchNote = $state('');
  const benchItem = $derived(bench ? (bench.where === 'gear' ? state.gear[bench.index] : state.bag[bench.index]) : null);

  function runCraft(op: CraftOp, lineIndex: number) {
    if (!bench) return;
    const rng = mulberry32(state.rngState);
    state.rngState += 1;
    const r = doCraft(state, bench.where, bench.index, op, lineIndex, rng);
    benchNote = r.ok ? `${op}: ${r.note}` : `${op} refused — ${r.why}`;
    if (r.ok) push(state, `Bench ${op} · ${r.note}`);
    state = { ...state };
  }

  /** The published success curve for the step the bench is about to attempt. */
  function upgradeChance(): string {
    if (!benchItem) return '—';
    return String(Math.round(craft.successPct((benchItem.upgrade_lv || 0) + 1)));
  }

  let skillNote = $state('');
  let farmNote = $state('');
  const fl = $derived(farmLevel(state));
  const plots = $derived(plotCount(state));

  function doPlant(i: number, tier: string) {
    const r = plant(state, i, tier);
    farmNote = r.ok ? `Plot ${i + 1}: ${tier} herb in the ground, ready in ${farm.F.growth_hours} h` : `Plot ${i + 1}: ${r.why}`;
    state = { ...state };
  }

  function doHarvest(i: number) {
    const r = harvest(state, i);
    farmNote = r.ok ? `Plot ${i + 1}: +${r.herbs} herbs · +${r.xp} Farm XP` : `Plot ${i + 1}: ${r.why}`;
    state = { ...state };
  }

  function doBrew(name: string) {
    const r = craftPotion(state, name);
    farmNote = r.ok ? `Brewed ${name}` : `${name}: ${r.why}`;
    state = { ...state };
  }

  function doCondense(name: string) {
    const r = condense(state, name);
    farmNote = r.ok ? `Condensed ${name} · ${farm.P.condensed.effect_mult}× in one bottle` : `${name}: ${r.why}`;
    state = { ...state };
  }

  let townNote = $state('');
  const tabs = $derived(stashTabCount(state));

  function doDeposit(i: number, tab: number) {
    const r = deposit(state, i, tab);
    townNote = r.ok ? 'Deposited into the stash' : `Deposit refused: ${r.why}`;
    state = { ...state };
  }

  function doWithdraw(tab: number, i: number) {
    const r = withdraw(state, tab, i);
    townNote = r.ok ? 'Withdrawn into the bag' : `Withdrawal refused: ${r.why}`;
    state = { ...state };
  }

  function doTrip(i: number) {
    const r = startTrip(state, i);
    townNote = r.ok ? `Walking ${linkLabel(i)} · ${road.R.trip_min} min, ${road.encountersPerTrip} encounters` : `Cannot start: ${r.why}`;
    state = { ...state };
  }

  function doSwitchPreset(i: number) {
    switchPreset(state, i);
    skillNote = `Loaded ${state.presets[i].name}`;
    state = { ...state };
  }

  function doStorePreset() {
    storePreset(state);
    skillNote = `Saved ${state.presets[state.activePreset].name}`;
    state = { ...state };
  }

  function doBind(i: number) {
    bindZone(state, i, state.zone);
    skillNote = `${state.presets[i].name} now ${state.presets[i].zones.includes(state.zone) ? 'binds' : 'unbinds'} ${eng.zoneById(state.zone).name}`;
    state = { ...state };
  }

  const colSet = $derived(col.setAt(town?.id));
  function doTurnIn() {
    const r = turnIn(state, town.id);
    townNote = r.ok ? `Turned in the ${colSet.name} set · reward: ${r.reward}` : `Turn-in refused: ${r.why}`;
    state = { ...state };
  }

  const bar = (value: number, max: number) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;

  const ownedActives = $derived(sm.all().filter((k: any) => ['attack', 'curse', 'heal'].includes(k.type) && state.skills.owned[k.id] != null));
  const ownedBuffs = $derived(sm.of('buff').filter((k: any) => state.skills.owned[k.id] != null));
  const ownedAuras = $derived(sm.of('aura').filter((k: any) => state.skills.owned[k.id] != null));
  const reserved = $derived(reservedPct(state.skills));

  function setSlot(i: number, id: string) {
    const at = state.skills.list.indexOf(id);
    if (at >= 0) state.skills.list[at] = null;
    state.skills.list[i] = id || null;
    state = { ...state };
  }

  /** What a curse has written on one mob, in words and with the seconds left on each line. */
  function curseWords(id: string): string {
    const lines = state.curses[id];
    if (!lines) return '';
    return Object.values(lines)
      .map((l) => `${EFFECT_LABEL[l.stat] || l.stat} ${l.value > 0 ? '+' : ''}${l.value}%` +
        `${l.condition ? ` while ${l.condition}` : ''} · ${l.secLeft}s left`)
      .join(' · ');
  }

  /** The purse in words, using the names the bench itself charges by. */
  function stonesLine(): string {
    const held = Object.entries(state.counters.stones).filter(([, n]) => (n as number) > 0);
    if (!held.length) return 'no stones yet';
    return held.map(([k, n]) => `${stoneName(k)} ${n}`).join(' · ');
  }

  function setTravel(mode: 'stay' | 'forward') {
    state.travel = mode;
    state = { ...state };
    push(state, mode === 'forward'
      ? 'Hunting will move on by itself through settlements already opened'
      : 'Hunting stays in this zone until you travel');
    state = { ...state };
  }

  /** What the character has put on one mob: the DoT and debuff lines, with stacks and seconds. */
  function statusWords(id: string): string {
    const m = state.mobStatus[id];
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
    const r = toggleTrack(state.skills, id);
    saveNote = r.ok ? '' : r.why || 'cannot';
    state = { ...state };
  }
</script>

<header>
  <h1>ModWorld</h1>
  <nav>
    {#each ['main', 'skills', 'town', 'farm', 'zones', 'save'] as t}
      <button class:active={tab === t} onclick={() => (tab = t)}>{t === 'main' ? 'main screen' : t}</button>
    {/each}
  </nav>
  <div class="meta">
    {zone.name} L{state.player.level} · {minutes} min · kills {state.counters.kills} · {kph.toFixed(0)}/hr
  </div>
</header>

{#if tab === 'main'}
  <div class="main">
    <section class="panel region scene">
      <h2>Combat scene · {zone.name}</h2>
    <div class="bars">
      <!-- character-sheet.md: Energy Shield sits above HP while it is present -->
      {#if c.es > 0}
        <label>Energy Shield <progress max={c.es} value={state.player.es}></progress> {Math.round(state.player.es)} / {Math.round(c.es)}</label>
      {/if}
      <label>HP <progress max={c.maxHp} value={state.player.hp}></progress> {Math.round(state.player.hp)} / {Math.round(c.maxHp)} (+{c.hpRegen.toFixed(0)}/sec)</label>
      <label>Mana <progress max={c.maxMana} value={state.player.mana}></progress> {Math.round(state.player.mana)} / {Math.round(c.maxMana)}</label>
      <label>XP <progress max={eng.xpToNext(state.player.level)} value={state.player.xp}></progress> {state.player.xp} / {Math.round(eng.xpToNext(state.player.level))}</label>
      <!-- character-sheet.md's main panel: HP, Mana, Attack speed and Weight are the four always shown -->
      <label>Attack speed {c.hitsPerSec.toFixed(2)} hits/sec <small>(Cap {E.caps.aspd})</small></label>
      <label>Weight {c.weightUsed.toFixed(0)} / {Math.round(c.weightCap)} <small>{c.encumbrance > 0 ? `aspd ${(c.encumbrance * -100).toFixed(0)}%` : 'no tax'}</small></label>
    </div>
    <p class="state">
      <label class="travel">Hunt zone
        <button class={state.travel === 'stay' ? 'active' : ''} onclick={() => setTravel('stay')}>stay here</button>
        <button class={state.travel === 'forward' ? 'active' : ''} onclick={() => setTravel('forward')}>move on when this zone is behind me</button>
        <small>{state.travel === 'forward'
          ? `walks on to the next settlement you have already opened, once level ${zone.levels[1] + 1} is reached`
          : 'stays in this zone however high you get — you choose when to travel'}</small>
      </label>
    </p>
    <p class="state">
      {#if state.phase === 'camp'}Pushed — recovering at camp for {state.campSec} sec. No death, no loss: time is the only cost.{:else}Fighting · {c.hitsPerSec.toFixed(2)} hits/sec with {c.weaponName}, {c.weaponElement ? `carrying ${c.weaponElement}` : 'carrying no Element'}{/if}
    </p>
    <table>
      <thead><tr><th>Target</th><th>Body</th><th>HP</th><th>PS</th><th>Hit vs</th><th>Dodge</th><th>Innate</th><th>Under a curse</th></tr></thead>
      <tbody>
        {#each state.group as m}
          <tr>
            <td>{m.species}<br /><small>{m.kind}</small></td>
            <td>{m.kind}</td>
            <td><span class="mobbar" style={'width:' + bar(m.hp, m.hpMax)}></span> {Math.max(0, Math.round(m.hp))} / {Math.round(m.hpMax)}</td>
            <td>{(m.ps * psMult(modsOn(state.curses, m.id))).toFixed(1)}</td>
            <td>{(eng.hitChance(c.accuracy, m.evasion) * 100).toFixed(1)}%</td>
            <td>{eng.dodgeChance(m.dodgeRate, c.accuracy).toFixed(1)}%</td>
            <td>{m.innate.join(', ')}</td>
            <td>{[curseWords(m.id), statusWords(m.id)].filter(Boolean).join(' | ') || '—'}</td>
          </tr>
        {:else}
          <tr><td colspan="8">No mob on screen — the next group walks in.</td></tr>
        {/each}
      </tbody>
    </table>
    <div class="log">
      {#each state.log.slice(0, 12) as line}
        <div><span class="t">{line.sec}s</span> {line.text}</div>
      {/each}
    </div>
    <button onclick={() => (running = !running)}>{running ? 'Pause' : 'Resume'}</button>
    <button onclick={step}>One tick</button>
    <button onclick={() => { if (confirm('Start a new character?')) reset(); }}>New character</button>
    </section>

    <section class="panel region sheet">
      <h2>Character sheet · level {state.player.level}</h2>
      <h3>Worn ({state.gear.filter(Boolean).length} / {E.stat.item_slots}) — hover a slot to read it</h3>
      <SlotGrid entries={wornEntries} capacity={E.stat.item_slots} wornOf={wornOf} fixed />

      <table class="stats">
        <tbody>
          {#each STATS as k}
            <tr><td>{k.toUpperCase()}</td><td>{c.core[k].toFixed(1)}</td></tr>
          {/each}
          <tr><td>Weapon</td><td>{c.weaponName} · {masteryLabel(c.weaponMastery)} · drop bonus {dropBonusPct(state)}%</td></tr>
          <tr><td>Attack speed</td><td>{c.aspd.toFixed(1)} aspd · {c.hitsPerSec.toFixed(2)} hits/sec (Cap {E.caps.aspd})</td></tr>
          <tr><td>Physical power</td><td>{Math.round(c.phys)}</td></tr>
          <tr><td>Magic power</td><td>{Math.round(c.magic)}</td></tr>
          <tr><td>Accuracy</td><td>{Math.round(c.accuracy)}</td></tr>
          <tr><td>Evasion</td><td>{Math.round(c.evasion)}</td></tr>
          <tr><td>Armour</td><td>{Math.round(c.armour)}</td></tr>
          <tr><td>Dodge / perfect dodge</td><td>{c.dodgeRate.toFixed(1)} rate → Cap {E.caps.dodge_chance}% · {c.perfectDodge.toFixed(1)}%</td></tr>
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
        {#if state.goal.done}
          Met at {Math.round(state.goal.done.clockSec / 60)} min of play on a level {state.goal.done.level} character, {state.goal.attempts} spawn{state.goal.attempts === 1 ? '' : 's'} in. The run keeps going: levels past it are the item-quality push in the same zone, and there is no prestige.
        {:else}
          Not met yet. It takes {state.goal.attempts === 0 ? 'no spawn of this boss yet' : `${state.goal.attempts} spawn${state.goal.attempts === 1 ? '' : 's'}`}, and every Push inside a spawn starts the count over.
        {/if}
      </small></p>
    </section>

    <section class="panel region temp">
      <h2>Temp inventory · adventure bag ({state.bag.length} / {E.inventory.adventure_slots})</h2>
      {#if state.bag.length >= E.inventory.adventure_slots}
        <p class="warn"><b>Bag full — the zone has stopped paying.</b> A full bag picks up nothing and turns nothing into a stone, so {state.counters.overflow || 0} pieces so far were left on the ground instead of turning into Reroll value. Walk back to {settlementById(state.town.waypoint)?.name || 'a settlement'} and deposit, then come out again.</p>
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
        onstat={chooseStatAt}
        empty="Nothing yet — kills still drop, and the bag filter is the zone upgrade rate."
      />

      <details class="filter">
        <summary>Bag filter — what this run keeps</summary>
        <p><small>Every slot decides for itself. A piece that fails its slot's rule turns into 1 Reroll value stone on the spot — nothing is deleted.</small></p>
        <table>
          <thead><tr><th>Slot</th><th>Keep when it beats the worn piece by</th><th>Rarity floor</th><th>Also keep an Element you cannot resist</th><th>The rule in words</th></tr></thead>
          <tbody>
            {#each FILTER_SLOTS as slot}
              {@const r = ruleFor(state.filter, slot)}
              <tr>
                <td>{slot}</td>
                <td><input type="number" min="0" step="1" value={r.margin_pct} onchange={(e) => editRule(slot, { margin_pct: Number((e.target as HTMLInputElement).value) })} /> %</td>
                <td>
                  <select onchange={(e) => editRule(slot, { min_rarity: (e.target as HTMLSelectElement).value })}>
                    {#each RARITY_CHOICES as k}<option value={k} selected={r.min_rarity === k}>{k === 'any' ? 'any Rarity' : k}</option>{/each}
                  </select>
                </td>
                <td><input type="checkbox" checked={r.keep_missing_element} onchange={(e) => editRule(slot, { keep_missing_element: (e.target as HTMLInputElement).checked })} /></td>
                <td>{describeRule(r)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p><small>Still not found — Elements you have no resistance for: <b>{state.filter.missing.elements.length ? state.filter.missing.elements.join(', ') : 'none'}</b> · empty slots: <b>{state.filter.missing.slots.length ? state.filter.missing.slots.join(', ') : 'none'}</b></small></p>
      </details>
    </section>

    <section class="panel region inv">
      <h2>Inventory · character bag ({slotsUsed(state)} / {slotsAvailable(state)} slots)</h2>
      <SlotGrid
        entries={invEntries}
        capacity={slotsAvailable(state)}
        mode={invMode}
        onmode={(m) => (invMode = m)}
        sort={invSort}
        onsort={(k) => (invSort = k)}
        wornOf={wornOf}
        empty="Nothing carried yet — stones, herbs, draughts and junk all land in these slots."
      />
      <p><small>
        Stones and junk stack {E.inventory.stack_size.stone} per slot and weigh nothing · herbs and draughts stack {E.inventory.stack_size.herb} per slot and weigh {E.inventory.unit_weight.herb} each · gold takes no slot.
        A grant with no slot left is left where it is ({state.counters.stopped || 0} so far) — nothing is deleted and nothing becomes a different medium.
        {pouchSlots(state) > 0 ? `The Porter's pouches added ${pouchSlots(state)} of these slots · ` : ''}Clear space by selling junk at the Counterhand, brewing herbs into draughts, or condensing ten bottles into one.
      </small></p>
    </section>
  </div>
{/if}

{#if tab === 'skills'}
  <section class="panel">
    <h2>Skill bar · {ACTIVE_SLOTS} slots, cast top-down</h2>
    <div class="presets">
      {#each state.presets as p, i}
        <button class:active={i === state.activePreset} onclick={() => doSwitchPreset(i)}>
          {p.name}{p.zones.length ? ` · ${p.zones.length} zone${p.zones.length > 1 ? 's' : ''}` : ''}
        </button>
      {/each}
      <button onclick={doStorePreset}>save current</button>
      <button onclick={() => doBind(state.activePreset)}>
        {state.presets[state.activePreset].zones.includes(state.zone) ? 'unbind this zone' : 'bind this zone'}
      </button>
    </div>
    <p><small>{skillNote || `Six sets are stored and the game picks one by zone. A Push brings the Main set back, and a skill already counting its cooldown keeps counting.`}</small></p>
    <p><small>The game presses the first slot whose cooldown is ready and whose mana fits the usable pool. You only arrange the order. Reserved by auras: {reserved}% of the pool, so {Math.round(c.maxMana * (1 - reserved / 100))} mana stays usable.</small></p>
    <table>
      <thead><tr><th>#</th><th>Skill</th><th>Level</th><th>cd → eff</th><th>Mana</th><th>Next in</th><th>Place</th></tr></thead>
      <tbody>
        {#each state.skills.list as id, i}
          {@const k = id ? sm.byId[id] : null}
          <tr>
            <td>{i + 1}</td>
            <td>{k ? k.name : '—'}</td>
            <td>{id ? `${skillLevel(state.skills, id)} / ${E.skill_xp.level_cap}` : ''}</td>
            <td>{k ? `${k.cd}s → ${skillCd(state.skills, id, c.cdr).toFixed(2)}s` : ''}</td>
            <td>{k ? k.mana : ''}</td>
            <td>{id ? `${(state.skills.cd[id] || 0).toFixed(1)}s` : ''}</td>
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
        {#each Object.keys(state.skills.owned) as id}
          {@const k = sm.byId[id]}
          <tr>
            <td>{k.name}</td><td>{k.type}</td><td>{state.skills.owned[id]}</td>
            <td>{ladderOf(state.skills, id)}% cd</td>
            <td>{k.effect || (k.final_pct != null ? `${k.final_pct}% of its ${k.basis} hit` : k.reserve) || ''}</td>
          </tr>
        {:else}
          <tr><td colspan="5">No skill yet — the first one is a boss drop ({(E.skill_drop.boss * 100).toFixed(0)}% per boss kill).</td></tr>
        {/each}
      </tbody>
    </table>
    <h3>Buff track (re-presses itself, takes no slot)</h3>
    {#each ownedBuffs as k}
      <label><input type="checkbox" checked={state.skills.buffs[k.id]} onchange={() => toggle(k.id)} /> {k.name} · {k.duration} on / {k.cd}s cd · {k.mana} · {effectLine(k) || k.effect}</label><br />
    {:else}
      <p><small>None owned.</small></p>
    {/each}
    <p><small>Reserved {reservedPct(state.skills)}% of Max Mana · the block is {sm.RESERVATION_LIMIT}%. Up right now: {describeFold(effectsActive(state.skills)) || 'nothing — no aura is on and no buff is counting'}.</small></p>
    <h3>Aura set (reserves Max Mana, may not reserve all of it)</h3>
    {#each ownedAuras as k}
      <label><input type="checkbox" checked={state.skills.auras[k.id]} onchange={() => toggle(k.id)} /> {k.name} · {k.reserve} ({sm.reservePct(k.reserve)}%) · {effectLine(k) || k.effect}</label><br />
    {:else}
      <p><small>None owned.</small></p>
    {/each}
  </section>
{/if}

{#if tab === 'town'}
  <section class="panel">
    <h2>{town.name} · {town.band} band{town.capital ? ` · ${town.capital} capital` : ''}</h2>
    <p><small>Innate Element {town.innate.join(' / ')} · Base bias flavour {town.base_bias_flavor} · NPCs here: {town.npcs.map((n: string) => npcOf(n).name).join(' · ')}</small></p>

    <h3>Counterhand · the gold mint</h3>
    <p>Gold {state.counters.gold.toFixed(1)} · junk unsold {junkTotal} ({Object.entries(state.junkByRarity).map(([r, n]) => `${r} ${n}`).join(' · ') || 'none'}) · stones {stonesLine()}</p>
    <button onclick={doSell} disabled={junkTotal === 0}>Sell all junk here</button>
    <p><small>Junk sells for its rarity price and nothing else mints gold except a Road event. Rejected gear dissolved for Reroll value stones instead — the two media never mix.</small></p>

    <h3>Standing</h3>
    <p>Tier {standingTier(state, town.id)} / {TOWN.standing.tiers.length} · {(standingShare(state, town.id) * 100).toFixed(1)}% of the {town.budget_hr} hr of zone {town.zone} kills that Tier I asks for. Standing buys stock lines, set slots and cosmetics — never a stat, a Mod, a stone or anything mob_HP reads.</p>

    <h3>Stall stock</h3>
    <table>
      <thead><tr><th>Line</th><th>NPC</th><th>Kind</th><th>Minutes of income</th><th>Gold</th><th></th></tr></thead>
      <tbody>
        {#each townStock as row}
          {@const check = canBuy(state, town.id, row.id)}
          <tr>
            <td>{row.item}</td>
            <td>{npcOf(row.npc).name}</td>
            <td>{row.kind}</td>
            <td>{priceMinutes(row, town.id, state)} m{row.charge_band ? ` @ ${row.charge_band}` : ''}</td>
            <td>{priceGold(row, town.id, state)}</td>
            <td><button onclick={() => doBuy(row.id)} disabled={!check.ok}>{check.ok ? 'buy' : check.why}</button></td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Guild board · {state.town.tasks.length} slots</h3>
    <table>
      <thead><tr><th>#</th><th>Task</th><th>Zone</th><th>Progress</th><th>Reward</th><th></th></tr></thead>
      <tbody>
        {#each state.town.tasks as t, i}
          <tr>
            <td>{i + 1}</td>
            <td>{t ? `${t.kind} ×${t.n}` : 'refills in ' + Math.max(0, state.town.refillAt[i] - state.clockSec) + 's'}</td>
            <td>{t ? eng.zoneById(t.zone).name : ''}</td>
            <td>{t ? `${t.progress} / ${t.n}` : ''}</td>
            <td>{t ? `${t.count} ${t.stone} stone` : ''}</td>
            <td>{#if t}<button disabled={t.progress < t.n} onclick={() => doClaim(i)}>claim</button>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p><small>Payouts are stones only, sized at {TOWN.task_sizing.reward_minutes_of_band_income} minutes of that band's own stone income — the sizing lives in <code>town.json</code> so the rebalance pass can move it without touching code.</small></p>

    <h3>Road · {state.town.linksBought} of {ROAD_LINKS} links bought</h3>
    <table>
      <thead><tr><th>Settlement</th><th>Band</th><th>Zone</th><th>Reachable</th><th></th></tr></thead>
      <tbody>
        {#each TOWN.settlements as s}
          <tr>
            <td>{s.name}</td><td>{s.band}</td><td>{s.zone}</td>
            <td>{canTravel(state, s.id) ? 'yes' : 'needs a Road link'}</td>
            <td><button onclick={() => travelTo(s.id)} disabled={!canTravel(state, s.id)}>{townId === s.id ? 'here' : 'travel'}</button></td>
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
          {#each state.stash[t] || [] as item, i}
            <button onclick={() => doWithdraw(t, i)}>{item.base} ({item.quality} {item.tier})</button>
          {:else}
            <span class="dim"> empty</span>
          {/each}
        </div>
      {/each}
    {/if}
    {#if state.bag.length}
      <p><small>Deposit from the bag: {state.bag.length} / {E.inventory.adventure_slots} carried.</small></p>
      {#each state.bag.slice(0, 6) as item, i}
        <button onclick={() => doDeposit(i, 0)}>{item.base} → tab 1</button>
      {/each}
    {/if}

    <h3>Road · {E.road.links.length} links · {E.road.trip_min} min each</h3>
    {#if state.road}
      <p>On the Road: {linkLabel(state.road.linkIndex)} · {state.road.secLeft}s left · {state.road.encountersLeft} encounters to go{state.road.kind ? ` · ${state.road.kind} in progress` : ''}</p>
    {/if}
    <table>
      <thead><tr><th>Link</th><th>Reachable</th><th>Purse today</th><th></th></tr></thead>
      <tbody>
        {#each road.links as l}
          <tr>
            <td>{l.text}</td>
            <td>{linkReachable(state, l.index) ? 'walkable from here' : 'neither end known'}</td>
            <td>{purseReady(state, l.index) ? `${E.road.purse_gold} gold` : 'taken'}</td>
            <td><button onclick={() => doTrip(l.index)} disabled={!linkReachable(state, l.index) || !!state.road}>walk</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p><small>Opt-in and online only: {E.road.encounters_per_min} encounter a minute, the purse pays once per link per day ({road.purseCapPerDay} gold a day at most), Standing arrives as {E.road.standing_per_trip_kills} kill-equivalents, and a Push forfeits the trip. The Road pays no stones and never runs while you are away.</small></p>
    <p>{townNote}</p>

    {#if colSet}
      <h3>Collector · {colSet.name} ({colSet.school} school)</h3>
      <p><small>{state.collector.done[colSet.id]
        ? 'Turned in · the pieces are gone and the reward is yours.'
        : setUnlocked(state, colSet)
          ? 'Tier II standing here has opened the set slots.'
          : `Tier II standing in ${colSet.settlement} opens the set slots — ${TOWN.standing.tiers[1].share * 100}% of this zone's kill budget.`}</small></p>
      <table>
        <thead><tr><th>Piece</th><th>Slot</th><th>Held</th><th>Quality asked</th></tr></thead>
        <tbody>
          {#each colSet.parsed as p}
            <tr>
              <td>{p.name}</td><td>{p.slot}</td>
              <td>{heldCount(state, colSet.id, p.name)} / 1</td>
              <td>{colSet.quality}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <button onclick={doTurnIn} disabled={!setUnlocked(state, colSet) || state.collector.done[colSet.id]}>turn in the set</button>
      <p><small>Reward: {colSet.reward} · {colSet.rule} · the Collector pays no gold and no Mod anywhere (T14).</small></p>
    {/if}

    <h3>Crafting bench · paid in stones, never gold</h3>
    <p><small>The bench is Settlement-only, so it lives here. Reroll moves a value inside its own Tier and never down, Refine pushes one slot up a Tier, Ascend raises the whole piece one Item quality step. Element and Mod identity sit outside every stone except Corrupt, which is the one gamble allowed to change an Element (`crafting.md`).</small></p>
    <label>Piece
      <select onchange={(e) => { const v = (e.target as HTMLSelectElement).value; const [w, i] = v.split(':'); bench = v ? { where: w as Where, index: Number(i) } : null; }}>
        <option value="">choose a piece</option>
        {#each state.gear as g, i}
          {#if g}<option value={'gear:' + i}>worn · {g.slot} · {g.base} ({g.quality} {g.tier})</option>{/if}
        {/each}
        {#each state.bag as g, i}
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
      <button onclick={() => runCraft('add', 0)}>Add a Mod · {stoneNames('add', benchItem).add} Add stone ({benchItem.mods_added || 0}/2 used)</button>
      <button onclick={() => runCraft('remove', 0)}>Remove a non-legacy mod · {stoneNames('remove').remove} Remove stone</button>
      <button onclick={() => runCraft('upgrade', 0)}>
        Upgrade to +{Math.min((benchItem.upgrade_lv || 0) + 1, craft.C.upgrade_cap)} · {stoneNames('upgrade', benchItem).quality} Quality Stone · {upgradeChance()}% chance
      </button>
      <button onclick={() => runCraft('repair', 0)}>Repair · {stoneNames('repair').repair} Repair stone (refills protection to {craft.C.protection_start})</button>
      <button onclick={() => runCraft('corrupt', 0)}>Corrupt · 1 Corrupt stone · one gamble per piece, then no stone ever touches it again</button>
      <p><small>This piece: +{benchItem.upgrade_lv || 0} of {craft.C.upgrade_cap} · protection {benchItem.protection_left == null ? craft.C.protection_start : benchItem.protection_left} of {craft.C.protection_start}{benchItem.broken ? ' · BROKEN (contributes nothing until repaired)' : ''}{benchItem.corrupted ? ' · corrupted' : ''}</small></p>
      <p><small>Each +1 adds {craft.C.gear_mod_per_level} to this piece's Gear Mod —{' '}
        {gearModOf(benchItem).stat ? `${lineName(gearModOf(benchItem).stat)}, now +${gearModOf(benchItem).value}` : 'this Base carries none'}</small></p>
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
    <p><small>The one life skill, and it grants no power: every output is the herb a draught is brewed from. {state.farm.xp} Farm XP · {farm.xpPerHarvest} per harvest · {farm.F.growth_hours} h a cycle · {farm.plotsMax} plots at most ({plots} yours — the Steward sells the two deeds).</small></p>

    <h3>Plots</h3>
    <table>
      <thead><tr><th>Plot</th><th>Grow</th><th>Ready</th><th></th></tr></thead>
      <tbody>
        {#each Array(plots) as _, i}
          {@const p = state.farm.plots[i]}
          <tr>
            <td>{i + 1}</td>
            <td>
              <select value={p?.tier || 'low'} onchange={(e) => doPlant(i, (e.target as HTMLSelectElement).value)}>
                {#each farm.TIERS as tier}
                  <option value={tier} selected={p?.tier === tier}>{tier}{!farm.canGrow(fl, tier) ? ` (needs level ${farm.F.tier_unlock_level[tier]})` : ''}</option>
                {/each}
              </select>
            </td>
            <td>{p?.tier ? (state.clockSec >= p.readyAt ? 'ready' : Math.ceil((p.readyAt - state.clockSec) / 360) / 10 + ' h') : 'empty'}</td>
            <td><button onclick={() => doHarvest(i)} disabled={!p?.tier || state.clockSec < p.readyAt}>harvest</button></td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Herb store · bundles drop on their own roll</h3>
    <p>{farm.TIERS.map((t: string) => `${t} ${state.farm.herbs[t] || 0}`).join(' · ')} ({(farm.H.mid_chance * 100).toFixed(0)}% per kill in mid zones · {(farm.H.high_chance * 100).toFixed(0)}% in high, {farm.H.bundle_min}-{farm.H.bundle_max} at a time)</p>

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
            <td>{state.farm.potions[p.name] || 0}{state.farm.condensed[p.name] ? ` (+${state.farm.condensed[p.name]} condensed)` : ''}</td>
            <td>
              <button onclick={() => doBrew(p.name)}>brew</button>
              <button onclick={() => doCondense(p.name)} disabled={(state.farm.potions[p.name] || 0) < farm.P.condensed.cost_bottles}>condense</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Auto-use</h3>
    <label><input type="checkbox" checked={state.farm.autoUse.hp} onchange={() => { state.farm.autoUse.hp = !state.farm.autoUse.hp; state = { ...state }; }} /> HP line below
      <input type="number" value={state.farm.threshold.hp} min="1" max="99" onchange={(e) => { state.farm.threshold.hp = Number((e.target as HTMLInputElement).value); state = { ...state }; }} />%
    </label>
    <label><input type="checkbox" checked={state.farm.autoUse.mana} onchange={() => { state.farm.autoUse.mana = !state.farm.autoUse.mana; state = { ...state }; }} /> Mana line below
      <input type="number" value={state.farm.threshold.mana} min="1" max="99" onchange={(e) => { state.farm.threshold.mana = Number((e.target as HTMLInputElement).value); state = { ...state }; }} />%
    </label>
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
            <td><button onclick={() => goToZone(z.id)} disabled={z.id === state.zone || !state.town.visited.includes(settlementOfZone(z.id)?.id)}>
              {z.id === state.zone ? 'here' : state.town.visited.includes(settlementOfZone(z.id)?.id) ? 'walk' : 'not opened'}
            </button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p><small>A mob spawns at your level clamped into its zone, so these HP figures are the two ends of a linear curve the engine interpolates between.</small></p>
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
  </section>
{/if}

<style>
  header { display: flex; gap: 1rem; align-items: center; padding: .6rem .8rem; border-bottom: 1px solid var(--line); }
  nav { display: flex; gap: .3rem; flex: 1; }
  .meta { color: var(--dim); }
  button.active { border-color: var(--good); color: var(--good); }
  .panel { padding: .8rem; }

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
  .bars label { display: flex; align-items: center; gap: .5rem; }
  progress { width: 220px; height: 10px; }
  progress::-webkit-progress-bar { background: var(--line); }
  .state { color: var(--dim); }
  .warn { color: var(--hp); }
  .log { margin: .6rem 0; max-height: 190px; overflow: auto; font-size: 12px; color: var(--dim); }
  .log .t { color: var(--mob); margin-right: .4rem; }
  .mobbar { display: inline-block; height: 8px; background: var(--hp); margin-right: .4rem; vertical-align: middle; }
</style>
