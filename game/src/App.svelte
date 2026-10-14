<script lang="ts">
  import { onMount } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion, Tween } from 'svelte/motion';
  import { eng, E, sm, TOWN, tree, loot, fieldwork } from './engine/client';
  import { buildCharacter } from './sim/player';
  import { withMeal, withHunger, fieldSite, campHere as atFieldCamp, establishCamp, leaveCamp, returnToCamp, startFieldAction, stopFieldAction, cookMeal, eatMeal } from './sim/fieldwork';
  import { newGame, tick, push, fx, hitColour, catchUpAsync, schedulerBatch, WAKE_SEC, carried, heldWeaponName, huntZone, huntHere, salvageBag } from './sim/game';
  import { reservedPct, usableMana, skillCd, skillLevel, ladderOf, effectsActive, toggleTrack, effectLine, describeFold, EFFECT_LABEL, ACTIVE_SLOTS, costNow, modeOf, condOf, appliedStatusOf, appliedCurseOf, moveSlot } from './sim/skills';
  import { modsOn, psMult, curableRows } from './sim/curse';
  import { statusLabel } from './sim/mobStatus';
  import { slotsUsed, slotsAvailable, pouchSlots, bagStacks } from './sim/slots';
  import SlotGrid from './ui/SlotGrid.svelte';
  import Panel from './ui/Panel.svelte';
  import HudLayoutEditor from './ui/HudLayoutEditor.svelte';
  import { copyHudLayout, DEFAULT_HUD_LAYOUT, DEFAULT_MODAL_AREA, gridAreaCss, hudGridTemplate, HUD_LAYOUT_STORAGE_KEY, validGridArea, validateHudLayout, type GridArea, type HudLayout } from './ui/hud-layout';
  import TravelCard from './ui/TravelCard.svelte';
  import TownHub from './ui/TownHub.svelte';
  import Market from './ui/Market.svelte';
  import CraftWorkshop from './ui/CraftWorkshop.svelte';
  import FieldworkBoard from './ui/FieldworkBoard.svelte';
  import PassiveTreeBoard from './ui/PassiveTreeBoard.svelte';
  import StashBoard from './ui/StashBoard.svelte';
  import KeybindTable from './ui/KeybindTable.svelte';
  import Minimap from './ui/Minimap.svelte';
  import { KEYBINDS, bindTable, actionFor, tokenOf, isModifierKey, isTypingTarget, formatKey } from './ui/keybinds';
  import { gearEntry, stackEntry, sortEntries, type SlotEntry, type SortKey } from './ui/bag';
  import type { MenuItem } from './ui/menu';
  import { ramp, cellLabel, paintSheet, type Picked } from './ui/map';
  import { fxByMob as bucketFx, plateBeat, plateStrike, plateGesture } from './ui/plate';
  import { setCastDrag, readCastDrag } from './ui/drag';
  import { snapCounters, buildAwayReport, fieldLabel, describeSnap } from './ui/hud';
  import { bar, curseWords, statusWords } from './ui/field';
  import { fxOut } from './ui/motion';
  import FieldPlates from './ui/FieldPlates.svelte';
  import ExpBar from './ui/ExpBar.svelte';
  import LogBox from './ui/LogBox.svelte';
  import {
    settlementById, settlementOfZone, stockOf, priceGold, priceMinutes, canBuy, buy, sellJunk,
    standingShare, standingTier, canTravel, claimTask, npcOf,
  } from './sim/town';
  import { doCraft, stoneName, atSettlement, type CraftOp, type Where } from './sim/craft';
  import { farm, farmLevel, plotCount, plant, harvest, craftPotion, condense } from './sim/farm';
  import { stashTabCount, deposit, withdraw, depositMany, withdrawMany } from './sim/town';
import { canSpendTree, respecTree, spendTreePoint, treePointsFree, treePointsSpent } from './sim/tree';
  import { road, startWalk, walkNote, walkBlocks, warpTo, warpCost, warpRow, cellBlocks, cellSec, currentCell, settlementCell, ownerOf } from './sim/road';
  import { enterDungeon, cooldownLeft } from './sim/dungeon';
  import { masteryLabel, masteryLevel, weaponSkillBonusPct, WEAPONS } from './sim/mastery';
  import { storePreset, switchPreset, bindZone } from './sim/presets';
  import { col, setUnlocked, heldCount, turnIn } from './sim/collector';
  import { mulberry32 } from './engine/client-helpers';
  import { writeSave, writeSaveSync, readSave, exportJson, importJson, saveSlots, listSnapshots, restoreSnapshot, readSettings, writeSettings, DEFAULT_SETTINGS, type SlotName, type Snapshot, type ClientSettings } from './state/save';
  import { FILTER_SLOTS, ruleFor, setRule, describeRule } from './sim/filter';
  import { equipFromBag, autoEquip, unequip } from './sim/gear';
  import { SAVE_CFG } from './sim/snapshot';
  import { describe as describeGoal } from './sim/goal';
  import { mobIcon, skillIcon } from './icon';
  import { bossMark } from './icon';
  // The HUD's own marks, from the same icon shelf the slots draw from — no second asset set.
  import sheetMark from './icon/equipment/black-knight-helm.svg?url';
  import bagMark from './icon/interface/adventurer-pack.svg?url';
  import fieldMark from './icon/weapon/crossed-swords-1.svg?url';
  import skillMark from './icon/equipment/spell-book.svg?url';
  import treeMark from './icon/skill/tree.svg?url';
  import mapMark from './icon/map/map.svg?url';
  import mapToolsMark from './icon/map/compass-star.svg?url';
  import stashMark from './icon/misc/treasure-chest.svg?url';
  // Town and service marks use the thing the player visits or works with: house, journal, anvil, and stone.
  import townMark from './icon/building/house.svg?url';
  import deskMark from './icon/misc/quest-journal.svg?url';
  import forgeMark from './icon/building/anvil-1.svg?url';
  import craftMark from './icon/misc/stones/stone-add-mod.svg?url';
  import farmMark from './icon/character/farmer.svg?url';
  import campMark from './icon/building/camping-tent.svg?url';
  import saveMark from './icon/misc/save-crystal.svg?url';
  import coinMark from './icon/currency/coin-purse.svg?url';
  import keysMark from './icon/interface/key.svg?url';
  import waypointMark from './icon/map/waypoint-pillar.svg?url';
  import moreMark from './icon/interface/more-options.svg?url';
  import stayMark from './icon/building/rest-campfire.svg?url';
  import climbMark from './icon/interface/ladder-stack.svg?url';
  import autoEquipMark from './icon/equipment/battle-gear.svg?url';
  import skillSettingsMark from './icon/interface/skill-settings.svg?url';
  import newCharacterMark from './icon/interface/perspective-dice-six-faces-random.svg?url';
  // the field sheet, generated by tools/map.ts and inlined so the travel pin, the plotted route and
  // the picked cell are all toggled by id — the client reads no coordinate, only settlement ids and
  // cell keys it already holds (X33 · M7 · M10)
  import mapOverlayRaw from './icon/map/map-overlay.svg?raw';
  import fogCloudUrl from './assets/fog-cloud.png?url';
  import type { GameState, Item, Cell, Mob, FxEvent } from './sim/types';
  import type { StatKey } from './engine/client';
  import type { Statuses } from './sim/combat';
  import type { SkillConditions } from './sim/skills';

  const STATS: StatKey[] = ['str', 'int', 'vit', 'agi', 'dex', 'wis', 'lck'];
  /**
   * The play screen is the field itself, laid out the way a phone game laid out on a monitor does: the
   * fight fills the frame and every read sits in a corner, so nothing the player has to watch can be
   * scrolled off. The map is the ground the field stands on, so it is worked where it is seen: the MAP
   * tab brings the backdrop into focus — sharp, full colour, its views and its key floating below the
   * menu rail — and a cell is picked, plotted and walked from there. Nothing about travelling a place ever
   * needed a modal. The desk is the one screen a settlement owns: the stall, the board, the counter and
   * the two tables, opened from the rail or from a place's card.
   */
  const PANELS = ['bag', 'skills', 'tree', 'map', 'desk', 'stash', 'farm', 'camp', 'save', 'town', 'market', 'forge', 'craft', 'keys'] as const;
  type PanelId = (typeof PANELS)[number];
  /** All direct screen destinations, ordered for the More menu and shortcut legend. Camp is surfaced by the field controls. */
  const RAIL: PanelId[] = ['map', 'town', 'market', 'craft', 'bag', 'skills', 'tree', 'desk', 'farm', 'camp', 'save', 'keys'];
  /** The frequent play and build destinations stay visible beside Field and Sheet. */
  const MAIN_RAIL: PanelId[] = ['map', 'bag', 'skills', 'craft'];
  const MORE_RAIL = RAIL.filter((p) => !MAIN_RAIL.includes(p) && p !== 'camp');
  /** Viewport grid references: rows A–O top-to-bottom, columns 1–15 left-to-right. */
  const HUD_GRID_LABELS = Array.from({ length: 225 }, (_, i) => `${String.fromCharCode(65 + Math.floor(i / 15))}${(i % 15) + 1}`);
  /** screens a settlement owns, refused in their own words when the character stands in the field */
  const TOWN_PANELS: PanelId[] = ['town', 'market', 'forge', 'craft', 'stash', 'desk'];
  /** what each rail tab is drawn with, and the word under it */
  const RAIL_ICON: Record<PanelId, string> = {
    bag: bagMark, skills: skillMark, tree: treeMark, map: mapMark, desk: deskMark,
    stash: stashMark, farm: farmMark, camp: campMark, save: saveMark, town: townMark,
    market: coinMark, forge: forgeMark, craft: craftMark, keys: keysMark,
  };
  const RAIL_LABEL: Record<PanelId, string> = {
    bag: 'bags', skills: 'skills', tree: 'tree', map: 'map', desk: 'desk',
    stash: 'stash', farm: 'farm', save: 'save', town: 'town',
    market: 'market', forge: 'forge', craft: 'craft', keys: 'keys', camp: 'camp',
  };
  /** the action each rail tab answers to, so a tab's key is the binding a player can rebind */
  const SCREEN_ACTION: Record<PanelId, string> = {
    bag: 'screen.bag', skills: 'screen.skills', tree: 'screen.tree', map: 'screen.map',
    desk: 'screen.desk', stash: 'screen.stash', farm: 'screen.farm', camp: 'screen.camp', save: 'screen.save',
    town: 'screen.town', market: 'screen.market', forge: 'screen.forge', craft: 'screen.craft',
    keys: 'screen.keys',
  };
  // `gameState`, not `state`: a top-level `state` binding makes svelte2tsx read `$state` as a store
  // subscription and type the whole panel `any` (sveltejs/svelte#13715).
  let gameState = $state<GameState>(newGame());
  let statuses = $state<Statuses>({});
  let running = $state(true);
  /** Held while a load or a snapshot rewind swaps the character: a live tick landing on the new state
   *  mid-catch-up would sim the away window twice. The interval drains its accumulator and stands down. */
  let paused = $state(false);
  let cooldownStepMs = $state(0);
  /** The clock's own pace: how many sim seconds a real second spends. ×1 is the designed beat. */
  let speed = $state(1);
  const vitalTweenOptions = {
    get duration() { return prefersReducedMotion.current ? 0 : 650; },
    easing: cubicOut,
  };
  const hpVisual = Tween.of(() => gameState.player.hp, vitalTweenOptions);
  const esVisual = Tween.of(() => gameState.player.es, vitalTweenOptions);
  const manaVisual = Tween.of(() => gameState.player.mana, vitalTweenOptions);
  const shownHp = $derived(hpVisual.current);
  const shownEs = $derived(esVisual.current);
  const shownMana = $derived(manaVisual.current);
  // the game opens on the ground, not on the fight: the first read is where the character stands and
  // where the walk goes, and FIELD (or Escape) folds the map down to the combat frame
  let panel = $state<PanelId | null>('map');
  /** the More box: the whole menu in one grid under the bar, opened by its own tab */
  let more = $state(false);
  let hudGridVisible = $state(false);
  let layoutEditorOpen = $state(false);
  let hudLayout = $state(copyHudLayout());
  let modalLayout = $state<GridArea>({ ...DEFAULT_MODAL_AREA });
  const hudLayoutAreas = $derived(hudGridTemplate(hudLayout));
  const modalGridArea = $derived(gridAreaCss(modalLayout));
  function applyHudLayout(nextHud: HudLayout, nextModal: GridArea) {
    if (validateHudLayout(nextHud) || !validGridArea(nextModal)) return;
    hudLayout = copyHudLayout(nextHud);
    modalLayout = { ...nextModal };
    localStorage.setItem(HUD_LAYOUT_STORAGE_KEY, JSON.stringify({ version: 1, hud: hudLayout, modal: modalLayout }));
    layoutEditorOpen = false;
  }
  const openLayoutEditor = () => { layoutEditorOpen = true; more = false; };
  /** the point-allocation overlay, opened from the level read in the bottom experience strip */
  let alloc = $state(false);
  let selectedTreeNodeId = $state('impact.1');
  const selectedTreeVerdict = $derived(canSpendTree(gameState, selectedTreeNodeId));
  /** the character sheet opens in the same full-screen panel layer as the other menu screens */
  let sheetOpen = $state(false);
  let saveNote = $state('');

  let settings = $state<ClientSettings>({ ...DEFAULT_SETTINGS });
  function setSetting<K extends keyof ClientSettings>(k: K, v: ClientSettings[K]) {
    settings[k] = v;
    void writeSettings(settings);
  }
  /** The clock's pace is a client setting like the rest: it survives a reload. */
  /** the clock's pace rungs, in the order the bar shows them */
  const SPEEDS: (1 | 2 | 4)[] = [1, 2, 4];
  function setSpeed(m: 1 | 2 | 4) {
    speed = m;
    setSetting('speed', m);
    saveNote = running ? `the clock runs ×${m}` : saveNote;
  }

  /** Escape uncovers the field: map focus drops, the two dock overlays go with it, and a pick that was
      never travelled to is dropped rather than left ringing under the HUD. A desk screen closes itself. */
  function onfieldKey(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      if (isTypingTarget(ev.target)) return;
      // one Escape owner: an open sub-screen closes itself and keeps the field's own read untouched
      if (document.querySelector('[role="dialog"]')) return;
      alloc = false;
      sheetOpen = false;
      more = false;
      if (panel === 'map') { panel = null; return; }
      picked = null;
      pickedCell = null;
      return;
    }
    // a field owns its own characters, the browser keeps its chords, and a bare modifier is a hand
    // reaching for a combination rather than a key with a job of its own
    if (isTypingTarget(ev.target) || isModifierKey(ev) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const action = actionFor(binds, tokenOf(ev));
    if (!action) return;
    ev.preventDefault();
    runAction(action);
  }

  /** the keyboard map the player is using: the stored sparse override over the shipped defaults */
  const binds = $derived(bindTable(settings.keybinds || {}));
  const keyFor = (action: string) => formatKey(binds[action] || '');
  function setBind(id: string, token: string) {
    setSetting('keybinds', { ...(settings.keybinds || {}), [id]: token });
  }
  function clearBind(id: string) {
    const over = { ...(settings.keybinds || {}) };
    delete over[id];
    setSetting('keybinds', over);
  }
  const resetBinds = () => setSetting('keybinds', {});

  /** the tab the warehouse board is open on, and which tab of the inventory the player is working in */
  let stashTab = $state(0);
  let pileSort = $state<SortKey>('level');
  type InvTab = 'inv' | 'stash';
  let invTab = $state<InvTab>('inv');

  const VIEW_ORDER: ('terrain' | 'band' | 'gate')[] = ['terrain', 'band', 'gate'];

  /**
   * The one keyboard path through the client, and the one way any screen opens. It answers in the same
   * order the rail is read: a screen first, then the field's own switches, then the sheet's — because the
   * map's keys only mean something while the sheet is the thing in focus.
   */
  function runAction(action: string) {
    if (action === 'screen.field') { panel = null; sheetOpen = false; alloc = false; picked = null; pickedCell = null; return; }
    if (action === 'sheet.open') { sheetOpen = !sheetOpen; return; }
    if (action === 'game.pause') { running = !running; saveNote = running ? 'the clock is running again' : 'paused — the field holds still'; return; }
    if (action.startsWith('screen.')) { openPanel(action.slice(7) as PanelId); return; }
    if (action === 'equip.best') { doBestEquip(); return; }
    if (action.startsWith('stash.tab')) {
      if (!tabs) return;
      const d = action.endsWith('next') ? 1 : -1;
      stashTab = (stashTab + d + tabs) % tabs;
      return;
    }
    if (action === 'warehouse.stash.all') { if (canStash) doDepositAll(stashTab); return; }
    if (action === 'warehouse.take.all') { if (canStash) doWithdrawAll(stashTab); return; }
    // the sheet's own keys answer only in map focus: on the field they would move a view nobody is reading
    if (panel !== 'map') return;
    switch (action) {
      case 'map.zoom.in': mapZoomBy(1.25); break;
      case 'map.zoom.out': mapZoomBy(1 / 1.25); break;
      case 'map.zoom.reset': mapReset(); break;
      case 'map.centre': mapCentre(); break;
      case 'map.view.next': view = VIEW_ORDER[(VIEW_ORDER.indexOf(view) + 1) % VIEW_ORDER.length]; break;
      case 'map.walk': showWalk = !showWalk; break;
      case 'map.ids': showIds = !showIds; break;
    }
  }

  /** The header buttons toggle, so the open panel closes under its own button. */
  function togglePanel(p: PanelId) {
    openPanel(p);
  }
  /**
   * A settlement screen opens where the character stands. Refusing out loud is the whole point: the rail
   * and the digits work from anywhere, so the one thing a player cannot tell from a dimmed button is why.
   *
   * The bag and warehouse share one inventory modal. Opening Bags always starts at the inventory;
   * the warehouse remains an explicit tab and can only be opened in a settlement.
   */
  function openPanel(p: PanelId) {
    sheetOpen = false;
    if (TOWN_PANELS.includes(p) && !atSettlement(gameState)) {
      saveNote = `${RAIL_LABEL[p]} is a settlement service — walk or warp into one first`;
      return;
    }
    if (p === 'stash') { invTab = 'stash'; panel = panel === 'bag' ? null : 'bag'; return; }
    if (p === 'bag') invTab = 'inv';
    if (p === 'forge') p = 'craft';
    panel = panel === p ? null : p;
  }
  const closePanel = () => (panel = null);
  /** the board is live only where the warehouse is: a tab cannot be filled from a field. */
  const canStash = $derived(atSettlement(gameState) && stashTabCount(gameState) > 0);
  /** whether the character stands in a settlement right now — every service below answers to this */
  const townLive = $derived(atSettlement(gameState));

  /** How long a plate's own comings and goings run, in ms. A JS transition is painted by the Web Animations
   *  API, which the stylesheet's reduced-motion zeroing cannot reach, so the reader's switch is read here
   *  and the gesture is shortened to nothing rather than left to CSS. */
  const PLATE_MOTION_MS = 260;
  let plateMotion = $state(PLATE_MOTION_MS);
  $effect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => (plateMotion = q.matches ? 0 : PLATE_MOTION_MS);
    read();
    q.addEventListener('change', read);
    return () => q.removeEventListener('change', read);
  });
  /** How long a number's own leave runs, in ms. The reader's reduced-motion switch zeroes it. */
  const FX_OUT_MS = 520;
  const fxOutMs = $derived(plateMotion === 0 ? 0 : FX_OUT_MS);

  /**
   * The hit ring, split by the half of the frame it belongs on: what the character deals lands over
   * the mob field, what it takes — and what it casts, sells, warps or crafts — lands on its own plate.
   * The events come from the sim, so an animation is a fact about the world rather than a CSS timer.
   * A blow names the mob it landed on, so it parks over that plate and not in the shared column; the column
   * keeps what has no body to stand on — a kill and a drop, which name their body only so that card can
   * remember the blow that ended it.
   */
  const ring = $derived(gameState.fx || []);
  const fieldFx = $derived(ring.filter((e) => e.side === 'field' && !(e.kind === 'hit' && e.mobId) && !(e.kind === 'block' && e.mobId)).slice(0, 9));
  // the character's own answers live on its own corner now (taken blows pop like damage, block
  // words and status procs beside them), so the shared column keeps only what names no body
  const selfFx = $derived(ring.filter((e) => e.side === 'self' && !(e.kind === 'travel' && e.text?.startsWith('arrived ·')) && e.kind !== 'level' && e.kind !== 'block' && e.kind !== 'proc' && e.kind !== 'taken').slice(0, 5));
  /** every blow the ring still holds, in its own mob's bucket, newest first as the ring already is */
  const fxByMob = $derived(bucketFx(ring));
  /** the newest hit that took something off the character, for the frame's own edge flash */
  const latestTaken = $derived(ring.find((e) => e.side === 'self' && e.kind === 'taken') || null);
  /** the newest blow the character landed — a swing or a press going out is what makes its own card lean */
  const latestLand = $derived(ring.find((e) => e.side === 'field' && e.kind === 'hit' && (e.via === 'swing' || e.via === 'cast')) || null);
  /** which way the character's card moves this beat, and the event that says so */
  const selfArt = $derived(plateGesture(latestTaken, latestLand));
  /** The field plates: the living group the sim owns, nothing else. */
  const plates = $derived([...gameState.group]);
  /** the row that last fired — a press or a buff coming up are both the order being worked — so the bar
   *  lights the slot that actually pressed instead of the one the eye expects */
  const latestFire = $derived((gameState.fx || []).find((e) => !!e.skillId && (e.kind === 'cast' || e.kind === 'buff')) || null);
  /** a level is the frame's own beat, not a chip in a column, so it leaves the column and takes the title */
  const latestLevel = $derived((gameState.fx || []).find((e) => e.kind === 'level') || null);

  /** the bottom strip's one read: how far into the level the character stands, in the unit the bar prints */
  const xpPct = $derived(Math.max(0, Math.min(100, (gameState.player.xp / eng.xpToNext(gameState.player.level)) * 100)));

  /** the field's own log, the chat box's shape: what the world just did, said once and left to scroll away */
  type FeedLine = { id: number; text: string; tone: string; chan: 'combat' | 'loot' | 'system' };
  type ChatTab = 'all' | 'combat' | 'loot' | 'system';
  let feed = $state<FeedLine[]>([]);
  let feedSeen = 0;
  const CHAT_TABS: [ChatTab, string][] = [['all', 'all'], ['combat', 'combat'], ['loot', 'loot'], ['system', 'system']];
  /** which channel of the chronicle is showing: one stream, read one way at a time, the way a chat box
      splits what a kill said from what the world said */
  let chatTab = $state<ChatTab>('all');
  const chatShown = $derived((chatTab === 'all' ? feed : feed.filter((l) => l.chan === chatTab)).slice(-8));
  $effect(() => {
    const fresh = ring.filter((e) =>
      (e.kind === 'kill' || e.kind === 'level' || e.kind === 'travel' || e.kind === 'buff' || e.kind === 'drop') && e.text);
    if (!fresh.length) return;
    const top = Math.max(...fresh.map((e) => e.id));
    if (feedSeen === 0) { feedSeen = top; return; }
    const add = fresh.filter((e) => e.id > feedSeen).slice(0, 6);
    feedSeen = top;
    if (!add.length) return;
    feed = [...feed, ...add.map((e) => ({
      id: e.id,
      text: e.kind === 'kill'
        ? `Slain · ${e.text} · +${fmtNum(e.value || 0)} EXP`
        : e.kind === 'buff' ? `${e.text} up` : e.text,
      tone: e.kind === 'level' ? 'gold' : e.kind === 'drop' ? 'gold' : e.kind === 'travel' ? 'good' : 'dim',
      chan: (e.kind === 'kill' ? 'combat' : e.kind === 'drop' ? 'loot' : 'system') as FeedLine['chan'],
    }))].slice(-60);
  });

  /** The away-window report (parking: "Offline report on return"), filled on mount catch-up + Load. */
  let awayReport = $state<{ mins: number; secs: number; capped: boolean; kills: number; drops: number; junk: number; gold: number; stones: number; levels: number; quality: string } | null>(null);

  // the away report's own reads live in `ui/hud.ts`, where a test can reach them

  let c = $derived(withHunger(withMeal(buildCharacter(gameState.player.level, gameState.gear, carried(gameState), masteryLevel(gameState, heldWeaponName(gameState) || ''), effectsActive(gameState.skills), gameState.player.points, gameState.player.treeRanks), gameState), gameState));
  const hpFill = $derived(c.maxHp > 0 ? Math.max(0, Math.min(1, shownHp / c.maxHp)) : 0);
  const esFill = $derived(c.es > 0 ? Math.max(0, Math.min(1, shownEs / c.es)) : 0);
  const manaFill = $derived(c.maxMana > 0 ? Math.max(0, Math.min(1, shownMana / c.maxMana)) : 0);
  let zone = $derived(eng.zoneById(gameState.zone));
  const fieldworkSite = $derived(fieldSite(gameState.cell));
  const fieldCampHere = $derived(atFieldCamp(gameState));
  const fieldworkBusy = $derived(!!gameState.walk || gameState.phase === 'camp' || !!gameState.dungeon);
  const hungerFill = $derived(Math.max(0, Math.min(1, gameState.fieldwork.hunger / fieldwork.F.hunger.max)));

  // The two bags the slot grid draws, each in the shape the player chose. Order and mode are theirs;
  // every value inside a slot is read from the engine, never recomputed here.
  let invMode = $state<'grid' | 'list'>('grid');
  let tempMode = $state<'grid' | 'list'>('grid');
  let invSort = $state<SortKey>('slot');
  let tempSort = $state<SortKey>('level');

  /** The piece a candidate is read against: where the body carries a pair, the weaker of the two —
   *  the same piece the bag filter compares and Auto Equip replaces, so every "better than worn"
   *  badge, item card and craft read answers to the one number the drop decision uses. */
  const wornOf = (slot: string) => {
    const worn = gameState.gear.filter((g): g is Item => Boolean(g) && g!.slot === slot);
    if (worn.length < 2) return worn[0] || null;
    const score = (g: Item) => loot.score({ ...g, q: g.q ?? 0 });
    return worn.reduce((a, b) => (score(a) <= score(b) ? a : b));
  };
  /** the pile the hunt dropped — the adventure slots, one piece each, waiting for a decision */
  const tempEntries = $derived(sortEntries(gameState.bag.map((item, i) => gearEntry(item, i)), tempSort));

  // the pile's own view: which kind is shown, what the search matches, and the quality cut. These narrow
  // what the grid draws — they never touch what the bag holds, so the order Equip addresses is the bag's.
  let bagCat = $state('all');
  let bagQuery = $state('');
  let bagTier = $state('all');
  const BAG_CATS: [string, string][] = [['all', 'All'], ['weapon', 'Weapons'], ['armour', 'Armour'], ['stones', 'Stones'], ['herbs', 'Herbs'], ['draughts', 'Draughts'], ['materials', 'Materials'], ['food', 'Food'], ['junk', 'Junk']];
  const bagKindOf = (e: { kind: string; slot: string; stack?: { group?: string } }) => e.kind === 'stack'
    ? (e.stack?.group ?? 'junk')
    : (e.slot === 'main hand' || e.slot === 'off hand') ? 'weapon' : 'armour';
  const pileGroups = $derived(BAG_CATS
    .map(([id, label]) => ({ id, label, n: id === 'all' ? tempEntries.length : tempEntries.filter((e) => bagKindOf(e) === id).length }))
    .filter((g) => g.id === 'all' || g.n > 0));
  const bagShown = $derived(tempEntries.filter((e) => {
    if (bagCat !== 'all' && bagKindOf(e) !== bagCat) return false;
    if (bagTier !== 'all' && e.kind === 'gear' && String(e.item?.quality ?? '') !== bagTier) return false;
    const q = bagQuery.trim().toLowerCase();
    return !q || `${e.title} ${e.sub}`.toLowerCase().includes(q);
  }));
  /** what the character carries — stones, herbs, draughts and junk, one slot per stack */
  const invEntries = $derived(sortEntries(bagStacks(gameState).map((s, i) => stackEntry(s, i)), invSort));
  /** the twelve worn slots keep their positions, the way an equipment panel does */
  const wornEntries = $derived(
    gameState.gear
      .map((g, i) => (g ? ({ ...gearEntry(g, i), kind: 'worn' } as SlotEntry) : null))
      .filter(Boolean) as SlotEntry[],
  );

  /** Number display respects the Settings choice; `short` uses compact notation (12.3k). The two
   *  formatters are built once and reused: this runs in the field log and the purses on every tick, and an
   *  `Intl.NumberFormat` is expensive to construct and cheap to call. */
  const NF_SHORT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  const NF_PLAIN = new Intl.NumberFormat('en-US');
  function fmtNum(n: number): string {
    return settings.numberFormat === 'short' ? NF_SHORT.format(n) : NF_PLAIN.format(Math.round(n));
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
  /** The tree respec is free too, and it lives with the stat respec in the map panel's settlement block. */
  function doRespecTree() {
    respecTree(gameState);
    gameState = { ...gameState };
  }
  /** Free Respec — settlement only (the button is in the map panel's settlement block). Hands every allocated point back. */
  function respec() {
    const p = gameState.player;
    let total = 0;
    for (const k of STATS) { total += p.points[k]; p.points[k] = 0; }
    p.statPoints += total;
    gameState = { ...gameState };
  }

  function step() {
    // `tick` mutates the state in place. `gameState` is a deep `$state` proxy, so its fine-grained
    // signals fire on their own — no need to clone the whole root and reassign, which used to
    // invalidate every `$derived` (bag sorts, character rebuild) once a second on an idle tick.
    const dropsBefore = gameState.counters.drops;
    const wasDungeon = !!gameState.dungeon;
    tick(gameState, statuses, { autoSkills: settings.autoSkills !== false });
    // Dungeon gear waits in escrow until payout; otherwise equip after each new gear roll.
    if (settings.autoEquip !== false && !gameState.dungeon && (gameState.counters.drops > dropsBefore || wasDungeon)) {
      equipCarriedBest();
    }
  }

  /** How often the game writes itself back to the last-used slot while it is running. */
  const AUTOSAVE_SEC = 30;

  onMount(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let autosaveTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    try {
      const savedLayout = localStorage.getItem(HUD_LAYOUT_STORAGE_KEY);
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout) as { hud?: HudLayout; modal?: GridArea };
        if (parsed.hud && parsed.modal && validGridArea(parsed.modal)) {
          const savedHud = copyHudLayout(parsed.hud);
          if (!validateHudLayout(savedHud)) hudLayout = savedHud;
          modalLayout = { ...parsed.modal };
        }
      }
    } catch {
      localStorage.removeItem(HUD_LAYOUT_STORAGE_KEY);
    }
    // The unload flush must be synchronous: IndexedDB commits asynchronously and the page can be gone
    // first, so `writeSaveSync` writes the mirror in one turn. It refreshes the away stamp too, so a
    // reload right after cannot count the same absence twice.
    const flushSync = () => {
      if (!lastSlot) return;
      gameState.lastSavedAt = Date.now();
      writeSaveSync(lastSlot, gameState);
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flushSync(); };
    (async () => {
      settings = await readSettings();
      speed = settings.speed || 1;
      // monotonic clock: catch up on the time between sessions, capped by the save rule. The catch-up
      // yields between slices so a long absence cannot block first paint.
      const away = (Date.now() - (gameState.lastSavedAt || Date.now())) / 1000;
      // no upper bound: the window itself is capped by the save rule (`offline_cap_hr`), so an old
      // file still catches up on the capped window instead of being skipped for being too old
      if (away > 5) {
        const before = snapCounters(gameState);
        const r = await catchUpAsync(gameState, statuses, away, { autoSkills: settings.autoSkills !== false });
        awayReport = settings.offlineReport ? buildAwayReport(before, Math.round(away / 60), r.simulated, r.capped, gameState) : null;
        push(gameState, `Away ${Math.round(away / 60)} min — ${r.simulated} sec simulated${r.capped ? ' (capped at the offline limit)' : ''}`);
        gameState = { ...gameState };
      }
      if (settings.autoEquip !== false) equipCarriedBest();
      // the away window is spent: stamp the clock now, so the next save (timer or manual) does not
      // credit the same absence a second time
      gameState.lastSavedAt = Date.now();
      loadSnaps();
      // the clock is armed only after the catch-up, so a slice boundary cannot add an extra tick.
      // The wake carries the REAL time since the last one, and `schedulerBatch` turns that into sim
      // seconds at the chosen speed: a throttled tab (a hidden one fires at most once a second) banks the
      // second it actually missed instead of a fixed quarter, so nothing is silently lost. The batch
      // still caps at `MAX_BATCH` and drops what it cannot fit, so a stalled wake cannot stutter the draw
      // with a queued burst.
      if (!disposed) {
        let acc = 0;
        let last = performance.now();
        timer = setInterval(() => {
          const now = performance.now();
          // a wake that ran late is measured, never assumed; the tab's own throttling is the only clock
          const elapsed = Math.max(0, (now - last) / 1000);
          last = now;
          if (paused || !running) { acc = 0; cooldownStepMs = 0; return; }
          const batch = schedulerBatch(acc, speed, elapsed);
          acc = batch.acc;
          if (batch.ticks > 0) cooldownStepMs = (batch.ticks / speed) * 1000;
          for (let i = 0; i < batch.ticks; i++) step();
        }, WAKE_SEC * 1000);
        autosaveTimer = setInterval(() => { if (lastSlot) void doSave(lastSlot, true); }, AUTOSAVE_SEC * 1000);
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('beforeunload', flushSync);
      }
    })();
    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      if (autosaveTimer) clearInterval(autosaveTimer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', flushSync);
    };
  });

  function equip(index: number) {
    // the rule lives in `sim/gear.ts`, where the tests can reach it too; this copy only makes the
    // panel re-read the gameState the verb mutated in place
    const r = equipFromBag(gameState, index);
    if (!r.ok) equipNote = `Cannot put it on: ${r.why}`;
    gameState = { ...gameState };
  }

  /** Dissolve one piece the player picked, by hand — the same stone a rejected drop pays, never gold. */
  function doSalvage(index: number) {
    const r = salvageBag(gameState, index);
    equipNote = r.ok ? 'That piece dissolved — 1 Value stone into the pile' : `Cannot salvage: ${r.why}`;
    gameState = { ...gameState };
  }

  /** Take one body cell off, back into the hunt pile. */
  function doUnequip(cell: number) {
    const r = unequip(gameState, cell);
    equipNote = r.ok ? 'That piece came off into the hunt pile' : `Cannot take it off: ${r.why}`;
    gameState = { ...gameState };
  }

  /**
   * What a right-click offers, per grid. The pile's verbs are the moves a piece can actually make from
   * there — onto the body, into the warehouse (only where a settlement has made that legal), or into a
   * stone. The worn grid's one verb is the way back off the body. Both lists read the same sim calls the
   * panel's buttons already make; nothing here is a second rule.
   */
  function pileActions(entry: SlotEntry): MenuItem[] {
    if (entry.kind !== 'gear' || !entry.item) return [];
    const it = entry.item;
    const out: MenuItem[] = [
      { label: 'Put it on', hint: it.slot, disabled: Boolean(it.broken), onpick: () => equip(entry.index) },
      {
        label: it.locked ? 'Unlock' : 'Lock',
        hint: it.locked ? 'the bulk verbs will move it again' : 'the bulk verbs will leave it',
        onpick: () => toggleLock(it),
      },
    ];
    if (townLive && tabs) out.push({ label: `Stash it → Tab ${stashTab + 1}`, onpick: () => doDeposit(entry.index, stashTab) });
    out.push({
      label: 'Dissolve',
      hint: '1 Value stone',
      danger: true,
      disabled: Boolean(it.locked || it.heldFor),
      onpick: () => doSalvage(entry.index),
    });
    return out;
  }

  function wornActions(entry: SlotEntry): MenuItem[] {
    if (entry.kind !== 'worn') return [];
    return [{ label: 'Take it off', hint: 'back to the hunt pile', onpick: () => doUnequip(entry.index) }];
  }

  /** the answer the last best-gear press gave, read where the press was made */
  let equipNote = $state('');
  /**
   * One press, the whole body dressed from what the character carries. The choice itself — what counts as
   * best, and what must never be moved — is `sim/gear.ts`'s, and the tests reach it there; this only says
   * what came of it, in the numbers the player acts on.
   */
  function doBestEquip() {
    const r = autoEquip(gameState, settings.equipMargin || 0);
    gameState = { ...gameState };
    // the press just moved pieces out of the pile, so the pile is what the player needs to see now
    // (the tab alone — the press never drags the player onto another screen)
    if (r.swaps.length) invTab = 'inv';
    const parts: string[] = [];
    parts.push(r.swaps.length
      ? `${r.swaps.length} piece${r.swaps.length === 1 ? '' : 's'} went up (${r.swaps.map((w) => `${w.slot}${w.instead ? '' : ' from a free cell'}`).join(', ')})`
      : 'nothing you carry beats what you wear');
    const held = r.spared.locked + r.spared.set + r.spared.broken;
    if (held) parts.push(`${held} left alone — locked, promised to a set, or Broken`);
    if (r.inStash) parts.push(`${r.inStash} in the stash would beat something worn · take it out to wear it`);
    equipNote = parts.join(' · ');
  }

  function equipCarriedBest() {
    const r = autoEquip(gameState, settings.equipMargin || 0);
    if (r.swaps.length) gameState = { ...gameState };
    return r;
  }

  function toggleAutoEquip() {
    const enabled = settings.autoEquip === false;
    setSetting('autoEquip', enabled);
    if (enabled) doBestEquip();
  }

  function goToZone(id: number) {
    const r = huntZone(gameState, id);
    if (!r.ok) {
      const s = settlementOfZone(id);
      saveNote = `${eng.zoneById(id).name} is not opened yet — the map panel shows the walk to ${s?.name ?? 'its settlement'}`;
      picked = s?.id ?? null;
      pickedCell = null;
      panel = 'map';
      return;
    }
    push(gameState, `Heading out to hunt in ${eng.zoneById(id).name} (levels ${eng.zoneById(id).levels.join('-')})`);
    gameState = { ...gameState };
  }

  /**
   * Hunt from the cell the feet are on: a sub-zone side sends out that side's cast, and ground with no
   * side named rolls the zone whole (`road.standing_rule`). This is the verb a click on the ground buys.
   */
  function doHuntHere() {
    const r = huntHere(gameState);
    if (!r.ok) { saveNote = `Cannot hunt here: ${r.why}`; gameState = { ...gameState }; return; }
    const z = eng.zoneById(gameState.zone);
    push(gameState, `Hunting ${pickedCell?.kind === 'sub' ? `${pickedCell.label} in ${z.name}` : z.name} (levels ${z.levels.join('-')}) from ${pickedCell?.key}`);
    gameState = { ...gameState };
  }

  function doEstablishCamp() {
    const r = establishCamp(gameState);
    saveNote = r.ok ? (r.moved ? `Camp moved · ${fieldCellName}` : `Camp established · ${fieldCellName}`) : `Cannot set Camp: ${r.why}`;
    if (r.ok) push(gameState, r.moved ? `Camp moved to ${fieldCellName}` : `Field Camp established at ${fieldCellName}`);
    gameState = { ...gameState };
  }

  function doLeaveCamp() {
    const r = leaveCamp(gameState);
    saveNote = r.ok ? 'Leaving Camp · hunting resumed' : `Cannot leave Camp: ${r.why}`;
    if (r.ok) push(gameState, `Hunting resumed in ${zone.name}`);
    gameState = { ...gameState };
  }

  function doReturnCamp() {
    const r = returnToCamp(gameState);
    saveNote = r.ok ? 'Back at Camp · combat paused' : `Cannot return to Camp: ${r.why}`;
    if (r.ok) push(gameState, `Returned to Camp in ${zone.name}`);
    gameState = { ...gameState };
  }

  function doStartFieldAction(kind: 'mine' | 'grove') {
    const r = startFieldAction(gameState, kind);
    saveNote = r.ok ? (kind === 'mine' ? 'Mining started' : 'Woodcutting started') : `Cannot gather: ${r.why}`;
    gameState = { ...gameState };
  }

  function doStopFieldAction() {
    stopFieldAction(gameState);
    saveNote = 'Gathering stopped';
    gameState = { ...gameState };
  }

  function doCookMeal(id: string) {
    const recipe = fieldwork.recipeById[id];
    const r = cookMeal(gameState, id);
    saveNote = r.ok ? `${recipe?.name || id} cooked` : `Cannot cook: ${r.why}`;
    if (r.ok) push(gameState, `Camp kitchen · ${recipe?.name || id} cooked`);
    gameState = { ...gameState };
  }

  function doEatMeal(id: string) {
    const food = fieldwork.foodById[id];
    const recipe = fieldwork.recipeById[id];
    const r = eatMeal(gameState, id);
    saveNote = r.ok ? `${food?.name || id} eaten · Hunger ${Math.floor(gameState.fieldwork.hunger)}%` : `Cannot eat: ${r.why}`;
    if (r.ok) push(gameState, recipe
      ? `${recipe.name} eaten · +${food.hunger_restore} Hunger · +${recipe.damage_pct}% damage for ${Math.round(recipe.duration_sec / 60)} min`
      : `${food?.name || id} eaten · +${food?.hunger_restore || 0} Hunger`);
    gameState = { ...gameState };
  }

  function updateAutoEat(patch: Partial<typeof gameState.fieldwork.autoEat>) {
    gameState.fieldwork.autoEat = { ...gameState.fieldwork.autoEat, ...patch };
    gameState = { ...gameState };
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
  let saveTab = $state<'slots' | 'backups' | 'settings'>('slots');

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


  function editRule(slot: string, patch: Record<string, unknown>) {
    setRule(gameState.filter, slot, patch as any);
    gameState = { ...gameState };
  }

  async function doLoad(slot: SlotName) {
    paused = true;
    try {
      const s = await readSave(slot);
      if (!s) { saveNote = `${slot} is empty`; return; }
      statuses = {};
      gameState = { ...s };
      const away = (Date.now() - (s.lastSavedAt || Date.now())) / 1000;
      const before = snapCounters(gameState);
      const r = await catchUpAsync(gameState, statuses, away, { autoSkills: settings.autoSkills !== false });
      if (settings.autoEquip !== false) equipCarriedBest();
      awayReport = settings.offlineReport ? buildAwayReport(before, Math.round(away / 60), r.simulated, r.capped, gameState) : null;
      // this slot becomes the autosave home, and the away window is spent (a reload must not recount it)
      lastSlot = slot;
      gameState.lastSavedAt = Date.now();
      saveNote = `Loaded ${slot} — ${r.simulated} sec caught up`;
      gameState = { ...gameState };
    } finally {
      paused = false;
    }
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
  /** The settlement picked on the sheet, and the exact cell under the click — any cell is pickable. */
  let picked = $state<string | null>(null);
  let pickedCell = $state<Picked | null>(null);
  let deskTab = $state<'services' | 'stall' | 'guild' | 'hunt' | 'walk'>('services');
  /** The sheet's three views, the level the gate view measures against, and the two overlays. */
  let view = $state<'terrain' | 'band' | 'gate'>('terrain');
  let gateLevel = $state(1);
  let showWalk = $state(false);
  let showIds = $state(false);
  let mapHelpOpen = $state(false);
  /** the one copy of the generated sheet: the ground the field is drawn on, and the surface a place is
      pointed at. Map focus sharpens it; nothing else paints a second map */
  let sheet = $state<HTMLElement | null>(null);
  const fieldCellKey = (cell: Cell | null) => {
    if (!cell) return 'field';
    const key = sheet?.querySelector(`polygon.cell[data-ax="${cell.q},${cell.r}"]`)?.getAttribute('data-cell');
    return key || `${cell.q},${cell.r}`;
  };
  const fieldCellName = $derived(gameState.cell ? `${fieldCellKey(gameState.cell)} · ${zone.name}` : `${zone.name} · field`);
  const fieldCampName = $derived(gameState.fieldwork.camp
    ? `${eng.zoneById(gameState.fieldwork.camp.zone).name} · ${fieldCellKey(gameState.fieldwork.camp.cell)}`
    : 'not set');
  /* The sheet is a surface you travel on, so it is panned and zoomed where it lies: `pan` slides it,
     `zoom` scales it about the frame's own origin. Pan and zoom answer only in map focus — the resting
     sheet is a blurred ghost, and dragging a ghost would move the ground under a HUD nobody is aiming
     at. Reset reframes it, Centre puts the settlement you stand in back under the middle. */
  // the floor is where the sheet stops costing frames: below it the endless ground puts enough hexes on
  // screen that panning lags (owner ruling)
  const MAP_BASE_ZOOM = 1.24, MAP_MIN_ZOOM = 0.5, MAP_MAX_ZOOM = 3;
  let zoom = $state(MAP_BASE_ZOOM);
  let panX = $state(0);
  let panY = $state(0);
  let dragging = $state(false);
  // The map overlay with the travel pin toggled by id: the pin sits on the settlement you stand in,
  // the destination is marked while a walk runs, and the mark you have clicked is ringed. No
  // coordinate is read here — only settlement ids and cell keys the client already holds (X33 · M7).
  const mapMarkup = $derived.by(() => {
    let s = mapOverlayRaw.replace(/^<\?xml[^>]*\?>\s*/, '');
    // the pin marks the settlement the feet are in; once a walk runs the character is on the road and
    // only the hex mark tells the truth, so the pin does not stay planted behind it
    if (!gameState.walk) s = s.replace(`<g class="pin" data-node="${townId}"`, `<g class="pin here" data-node="${townId}"`);
    const walk = gameState.walk;
    if (walk && walk.kind === 'town' && walk.node !== townId) s = s.replace(`<g class="pin" data-node="${walk.node}"`, `<g class="pin target" data-node="${walk.node}"`);
    if (picked) s = s.replace(/<g class="node( capital)?" data-node="([a-z_]+)"/g, (m, cap, id) => (id === picked ? `<g class="node${cap || ''} picked" data-node="${id}"` : m));
    return s;
  });
  const mapWithMist = $derived.by(() => {
    const paper = mapMarkup.match(/<rect class="paper" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/);
    const viewBox = mapMarkup.match(/<svg\b[^>]*\bviewBox="([^"]+)"/);
    if (!paper || !viewBox) return mapMarkup;
    const paperX = Number(paper[1]), paperY = Number(paper[2]);
    const paperW = Number(paper[3]), paperH = Number(paper[4]);
    const [viewX, viewY, viewW, viewH] = viewBox[1].trim().split(/\s+/).map(Number);
    if (![paperX, paperY, paperW, paperH, viewX, viewY, viewW, viewH].every(Number.isFinite)) return mapMarkup;
    const tileW = paperW / 7, tileH = paperH / 6;
    const patternImage = (x: number, y: number, w: number, h: number, alpha: number) =>
      `<image href="${fogCloudUrl}" x="${(tileW * x).toFixed(1)}" y="${(tileH * y).toFixed(1)}" width="${(tileW * w).toFixed(1)}" height="${(tileH * h).toFixed(1)}" opacity="${alpha.toFixed(2)}" preserveAspectRatio="none"/>`;
    const pattern = `<pattern id="map-mist-static" patternUnits="userSpaceOnUse" x="${paperX}" y="${paperY}" width="${tileW.toFixed(1)}" height="${tileH.toFixed(1)}">${patternImage(.04, .06, .56, .5, .55)}${patternImage(.44, .26, .5, .46, .42)}${patternImage(.16, .6, .48, .36, .36)}</pattern>`;
    const driftingCloud = (x: number, y: number, w: number, h: number, motion: string, alpha: number) =>
      `<image class="${motion}" href="${fogCloudUrl}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" opacity="${alpha.toFixed(2)}" preserveAspectRatio="none"/>`;
    const movingClouds = `<g class="map-mist-drift" aria-hidden="true" pointer-events="none">${driftingCloud(viewX + viewW * .04, viewY + viewH * .12, viewW * .42, viewH * .34, 'mist-drift-a', .15)}${driftingCloud(viewX + viewW * .54, viewY + viewH * .06, viewW * .4, viewH * .34, 'mist-drift-b', .12)}${driftingCloud(viewX + viewW * .32, viewY + viewH * .58, viewW * .44, viewH * .34, 'mist-drift-c', .13)}</g>`;
    const withPattern = mapMarkup.replace('</defs>', `${pattern}</defs>`);
    const mist = `<g class="map-mist-world" aria-hidden="true" pointer-events="none"><rect x="${paperX}" y="${paperY}" width="${paperW}" height="${paperH}" fill="url(#map-mist-static)" opacity=".16"/></g>${movingClouds}`;
    return withPattern.replace('</svg>', `${mist}</svg>`);
  });
  /** The same ramp, laid end to end, so the legend bar is the sheet's own colours rather than a second palette. */
  const rampCss = $derived(E.mob.zones.map((_: any, i: number) => ramp(i)).join(','));
  /**
   * The sheet is repainted after every `{@html}` rebuild — the fills, the walk graph, the cell ids, the
   * plotted route and the character's own hex. The paint itself lives in `ui/map.ts` (the map cluster's
   * reader); this effect only holds the reactive reads and hands them over, so a `gameState` change and a
   * markup rebuild both drive one repaint.
   */
  $effect(() => {
    void mapWithMist;
    const root = sheet;
    if (!root) return;
    paintSheet(root, { view, gateLevel, showIds, showWalk, pickedCell, gameState });
  });
  /**
   * The clicked cell, read off the sheet's own marks. Every cell of the field is a place to stand
   * (`road.standing_rule`), so a settlement, one of its sub-zones, one of its wild sides and bare
   * ground all pick — the difference is only what standing there is good for. A settlement's mark is
   * clicked as often as its cell — the name and the icon sit in a `g[data-node]` above the polygon —
   * so it resolves to the cell it stands on.
   */
  function onMapClick(ev: MouseEvent) {
    // a click on the ground — never on a mob plate, which keeps its own pointer — is the field's own way
    // into map focus: the fight folds down onto the log and the map takes the frame. That first click
    // only sharpens the sheet (owner ruling): a hex is picked by the second click, on the map it can read.
    if (panel === null && !sheetOpen && !alloc) { panel = 'map'; return; }
    const hit = ev.target as Element | null;
    const mark = hit?.closest?.('g[data-node]')?.getAttribute('data-node');
    const cell = hit?.closest?.('polygon.cell')
      || (mark ? sheet?.querySelector(`polygon.cell.town[data-node="${mark}"]`) : null);
    const ax = cell?.getAttribute('data-ax');
    if (!cell || !ax || (ax === `${pickedCell?.q},${pickedCell?.r}`)) {
      picked = null; pickedCell = null; return;
    }
    pickedCell = cellLabel(cell);
    picked = pickedCell.kind === 'bare' ? null : cell.getAttribute('data-node') || null;
  }
  /** Selecting a settlement from a table or the keyboard lands on its own cell. */
  function select(id: string) {
    const cell = settlementCell(id);
    if (picked === id && pickedCell?.kind === 'town') { picked = null; pickedCell = null; return; }
    picked = id;
    pickedCell = cell ? { key: sheet?.querySelector(`polygon.cell.town[data-node="${id}"]`)?.getAttribute('data-cell') || '', q: cell.q, r: cell.r, kind: 'town', label: settlementById(id)!.name, sub: null, wild: null } : null;
  }
  /**
   * The keyboard path over the same field: the arrows move the selection through the settlement order
   * the list beside it prints, and Enter takes the walk — or the warp, once the Waypoint is open. So
   * the click is a shortcut, never the only way to reach a place.
   */
  function onMapKey(ev: KeyboardEvent) {
    const ids = TOWN.settlements.map((s: any) => s.id) as string[];
    const back = ev.key === 'ArrowLeft' || ev.key === 'ArrowUp';
    if (back || ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      select(ids[(ids.indexOf(picked || '') + (back ? -1 : 1) + ids.length) % ids.length]);
      return;
    }
    if (ev.key === 'Enter' && pickedCell) {
      ev.preventDefault();
      if (pickedCell.kind === 'town' && picked && canTravel(gameState, picked)) travelTo(picked);
      else doWalk(pickedCell);
    }
  }
  /** Where the sheet scales from, in viewport coordinates: the same 50% / 46% the stylesheet pins. */
  function mapOrigin() {
    const r = sheet?.getBoundingClientRect();
    return r ? { x: r.left + r.width * .5, y: r.top + r.height * .46 } : null;
  }
  /** Zoom about a screen point: the ground under the pointer, or the frame's own origin for the buttons. */
  /**
   * The pan the ground allows. The ground is drawn on far past the field, so panning runs on well
   * beyond the field and reads as endless — but it is only pretending: past the ground's own edge
   * there is nothing, so the pan is held there. The edge the pan stops at is the sheet's own `paper`
   * rectangle, read off the element rather than typed here, so the ground can grow in the generator
   * and the limit grows with it. The frame itself never moves.
   */
  function mapClampPan(z: number) {
    const r = sheet?.getBoundingClientRect();
    const svg = sheet?.querySelector('svg') as SVGSVGElement | null;
    const paper = svg?.querySelector('rect.paper') as SVGRectElement | null;
    if (!r || !svg || !paper) return;
    const vb = svg.viewBox.baseVal;
    const s = Math.min(r.width / vb.width, r.height / vb.height);
    const left = (r.width - vb.width * s) / 2 + (Number(paper.getAttribute('x')) - vb.x) * s;
    const top = (r.height - vb.height * s) / 2 + (Number(paper.getAttribute('y')) - vb.y) * s;
    const right = left + Number(paper.getAttribute('width')) * s;
    const bottom = top + Number(paper.getAttribute('height')) * s;
    const ox = r.width / 2, oy = r.height * .46;
    // the stop is kept half a frame further out than the edge itself, so the edge is never on screen
    const mx = r.width / 2, my = r.height / 2;
    panX = Math.min(z * (ox - left) - ox - mx, Math.max(r.width + mx - ox - z * (right - ox), panX));
    panY = Math.min(z * (oy - top) - oy - my, Math.max(r.height + my - oy - z * (bottom - oy), panY));
  }
  function mapZoomAt(cx: number, cy: number, k: number) {
    const o = mapOrigin();
    if (!o) return;
    const z = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, zoom * k));
    const f = z / zoom;
    panX = (cx - o.x) * (1 - f) + panX * f;
    panY = (cy - o.y) * (1 - f) + panY * f;
    zoom = z;
    mapClampPan(z);
  }
  function mapZoomBy(k: number) {
    const o = mapOrigin();
    if (o) mapZoomAt(o.x, o.y, k);
  }
  function mapReset() {
    zoom = MAP_BASE_ZOOM; panX = 0; panY = 0;
  }
  /**
   * Centre on the settlement you stand in. The cell is measured in the sheet's own units and put
   * through the fit the frame gives the generated viewBox, so the pan is right whatever the zoom or
   * the transition is doing — and it is read from the same origin the pan limits are.
   */
  function mapCentre() {
    const r = sheet?.getBoundingClientRect();
    const svg = sheet?.querySelector('svg') as SVGSVGElement | null;
    const cell = sheet?.querySelector(`polygon.cell.town[data-node="${townId}"]`) as SVGGraphicsElement | null;
    if (!r || !svg || !cell) return;
    const vb = svg.viewBox.baseVal, b = cell.getBBox();
    const s = Math.min(r.width / vb.width, r.height / vb.height);
    const cx = (r.width - vb.width * s) / 2 + (b.x + b.width / 2 - vb.x) * s - r.width / 2;
    const cy = (r.height - vb.height * s) / 2 + (b.y + b.height / 2 - vb.y) * s - r.height * .46;
    panX = -zoom * cx;
    panY = -zoom * cy;
    mapClampPan(zoom);
  }
  /**
   * The handlers and the sheet reference are bound by an action rather than a directive: the field
   * arrives as inlined `{@html}` the compiler never sees, so there is no element for a binding to sit on.
   * A drag pans the sheet and a wheel zooms it under the pointer, both only in map focus; a drag that
   * passed the threshold is swallowed so it never lands as a cell pick.
   */
  function mapField(node: HTMLElement) {
    sheet = node;
    let down: { x: number; y: number; px: number; py: number } | null = null;
    let moved = false;
    const click = (ev: Event) => { if (moved) { moved = false; return; } onMapClick(ev as MouseEvent); };
    const key = (ev: Event) => onMapKey(ev as KeyboardEvent);
    const focus = () => panel === 'map';
    const onDown = (ev: PointerEvent) => {
      if (!focus() || ev.button !== 0) return;
      down = { x: ev.clientX, y: ev.clientY, px: panX, py: panY };
      moved = false;
    };
    const onMove = (ev: PointerEvent) => {
      if (!down) return;
      const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      // the sheet claims the pointer only once the drag is real: capturing on the press retargets the
      // click to the sheet itself, and then no cell under the pointer is ever picked
      if (!moved) node.setPointerCapture(ev.pointerId);
      moved = true; dragging = true;
      panX = down.px + dx; panY = down.py + dy;
      mapClampPan(zoom);
    };
    const onUp = (ev: PointerEvent) => {
      if (!down) return;
      down = null; dragging = false;
      if (node.hasPointerCapture(ev.pointerId)) node.releasePointerCapture(ev.pointerId);
    };
    const onWheel = (ev: WheelEvent) => {
      if (!focus()) return;
      ev.preventDefault();
      mapZoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    node.addEventListener('click', click);
    node.addEventListener('keydown', key);
    node.addEventListener('pointerdown', onDown);
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onUp);
    node.addEventListener('wheel', onWheel, { passive: false });
    return { destroy() {
      if (sheet === node) sheet = null;
      node.removeEventListener('click', click);
      node.removeEventListener('keydown', key);
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
      node.removeEventListener('wheel', onWheel);
    } };
  }
  /** The settlement that owns the picked cell — the cell's own town, or its nearest one. */
  const pickedSettlement = $derived(pickedCell ? settlementById(ownerOf({ q: pickedCell.q, r: pickedCell.r }).id) : null);
  /**
   * The card's whole subject: the picked cell, what stands on it, what it costs to reach from where the
   * feet are, and whether the feet are already there.
   */
  const pickedDest = $derived.by(() => {
    if (!pickedCell) return null;
    const node = ownerOf({ q: pickedCell.q, r: pickedCell.r });
    const self = pickedCell.q === currentCell(gameState).q && pickedCell.r === currentCell(gameState).r && !gameState.walk;
    return {
      key: pickedCell.key,
      kind: pickedCell.kind,
      label: pickedCell.label,
      node: node.id,
      sub: pickedCell.sub,
      wild: pickedCell.wild,
      self,
      walking: !!gameState.walk && gameState.walk.to.q === pickedCell.q && gameState.walk.to.r === pickedCell.r,
      here: gameState.town.visited.includes(node.id),
      blocks: self ? 0 : cellBlocks(gameState, { q: pickedCell.q, r: pickedCell.r }),
      sec: self ? 0 : cellSec(gameState, { q: pickedCell.q, r: pickedCell.r }),
    };
  });
  /**
   * The destination card's place on screen: the end of its anchor that has the room (DECISIONS.md §Interface) — above
   * the picked cell's own mark, or below it when the sheet's top edge is nearer — clamped inside the map.
   * The card is placed by the box it measures, so the measure runs again whenever the sheet moves the
   * cell (a pan or a zoom) or the pick moves to another cell.
   */
  let cardAt = $state<{ x: number; y: number } | null>(null);
  let mapcardEl = $state<HTMLDivElement | null>(null);
  $effect(() => {
    if (!pickedCell || panel !== 'map' || !sheet) { cardAt = null; return; }
    // zoom, pan and the mounted card are read for the tracking alone: the rects below already carry
    // them physically, and the reads are what make the measure rerun when they move
    void zoom; void panX; void panY; void mapcardEl;
    const poly = sheet.querySelector(`polygon.cell[data-ax="${pickedCell.q},${pickedCell.r}"]`) as SVGGraphicsElement | null;
    if (!poly) { cardAt = null; return; }
    const b = poly.getBoundingClientRect();
    const area = sheet.getBoundingClientRect();
    const cw = mapcardEl?.offsetWidth ?? 0;
    const ch = mapcardEl?.offsetHeight ?? 0;
    const m = 12;
    const minY = area.top + m;
    const maxY = Math.max(minY, area.bottom - ch - m);
    const aboveY = b.top - ch - m;
    const belowY = b.bottom + m;
    const aboveFits = aboveY >= minY;
    const belowFits = belowY <= maxY;
    const y = aboveFits ? aboveY : belowFits ? belowY
      : b.top - area.top >= area.bottom - b.bottom ? minY : maxY;
    let x = b.left + b.width / 2;
    if (cw) x = Math.min(area.right - cw / 2 - m, Math.max(area.left + cw / 2 + m, x));
    cardAt = { x, y };
  });
  /**
   * The settlement the panel speaks for: the one under the pick, or the one you stand in when nothing
   * is picked. Its counter, board, desk and set are read anywhere on the field, but worked only where
   * the character is — so `viewHere` gates every verb, and the map never sells a far purchase.
   */
  const viewTown = $derived(pickedSettlement ?? town);
  const viewHere = $derived(!!viewTown && viewTown.id === townId);
  const viewStock = $derived(stockOf(viewTown?.id ?? ''));
  const viewColSet = $derived(col.setAt(viewTown?.id));
  /**
   * The sheet's own key, read off the tones it carries: one entry per terrain, in the order the field
   * prints them. A cell with no zone is the nearest settlement's terrain faded by distance, so its
   * swatch is the most common of those faded tones rather than one corner cell's own (X33 · M7).
   */
  const legend = $derived.by(() => {
    const order: string[] = [];
    const tone = new Map<string, string>();
    const faded = new Map<string, number>();
    for (const m of mapMarkup.matchAll(/data-terrain="([a-z_]+)"[^>]*?data-tone="(#[0-9a-f]{6})"/g)) {
      const name = m[1], c = m[2];
      if (name === 'bare') faded.set(c, (faded.get(c) ?? 0) + 1);
      if (!tone.has(name)) { tone.set(name, c); order.push(name); }
    }
    const modal = [...faded].sort((a, b) => b[1] - a[1])[0];
    if (modal) tone.set('bare', modal[0]);
    return order.map((name) => ({ name, tone: tone.get(name) ?? '',
      label: name === 'bare' ? "no zone · nearest settlement's terrain"
        : name === 'town' ? 'settlement' : name === 'wild' ? 'wild side' : name }));
  });
  /** The walking read: one trail of boot prints, a left foot then a right, laid along the walk and lit from
   *  where the walk has reached. `x` is a print's place along the stride, so the lit fraction is the walk's
   *  own progress — the sim's tick drives it, and nothing here is a looping animation. */
  const travelTrail = Array.from({ length: 7 }, (_, i) => ({ right: i % 2 === 1, x: i / 6 }));
  /** Blocks behind plus the part of the block under foot — the same clock the tracker's note counts on,
      so the trail fills on the sim's tick and stops by itself when the clock is paused. */
  const walkPct = $derived.by(() => {
    const w = gameState.walk;
    if (!w) return 0;
    const part = w.blocksLeft ? 1 - w.secLeft / road.blockSec : 1;
    return Math.min(1, Math.max(0, (w.blocksTotal - w.blocksLeft + part) / w.blocksTotal));
  });
  const firstBand = $derived(E.mob.zones[0].levels);
  const lastBand = $derived(E.mob.zones[E.mob.zones.length - 1].levels);
  const liveBands = $derived(E.mob.zones.filter((z: any) => z.levels[0] <= gateLevel).length);
  const townStock = $derived(stockOf(town?.id ?? ''));
  const junkTotal = $derived(Object.values(gameState.junk).reduce((a: number, b: number) => a + b, 0));
  /** Unsold junk as "item ×count", biggest stack first — the record of which variants were farmed. */
  const junkLines = $derived(Object.entries(gameState.junk)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([item, n]) => `${item} ×${n}`));
  /** The purse, the stone pile and the hunt bag, read as the corner pills — the same counters the
      panels print, summed once here so the field never has to open a panel to be read. */
  const bagFull = $derived(gameState.bag.length >= E.inventory.adventure_slots);
  // Built outside the markup: the parser ends an attribute expression at the first brace inside a
  // nested template literal, so a subtitle that needs two counts is assembled here.
  const bagSub = $derived(
    `hunt pile ${gameState.bag.length} / ${E.inventory.adventure_slots} · carried ${slotsUsed(gameState)} / ${slotsAvailable(gameState)} slots`,
  );

  function doSell() {
    const r = sellJunk(gameState);
    push(gameState, `Counterhand: sold ${r.pieces} junk for ${r.gold} gold`);
    if (r.pieces > 0) fx(gameState, { kind: 'sell', side: 'self', text: `+${fmtNum(r.gold)} gold`, colour: E.elements.crit_colour || 'var(--gold)' });
    gameState = { ...gameState };
  }

  function doBuy(rowId: string) {
    const r = buy(gameState, town!.id, rowId);
    saveNote = r.ok ? `Bought ${r.row.item}` : `Cannot buy: ${r.why}`;
    gameState = { ...gameState };
  }

  function doClaim(i: number, choice?: string) {
    const t = gameState.town.tasks[i];
    if (t && claimTask(gameState, i, choice)) {
      const paid = t.alt && choice === t.alt.stone ? t.alt : { stone: t.stone, count: t.count };
      push(gameState, `Task paid: ${paid.count} ${paid.stone} stone(s)`);
    }
    gameState = { ...gameState };
  }

  /** A Waypoint warp: instant, to a settlement already walked to, and it pays gold for the walk's time. */
  function travelTo(id: string) {
    const s = settlementById(id)!;
    const saved = walkBlocks(gameState.town.waypoint, id);
    const r = warpTo(gameState, id);
    if (!r.ok) { saveNote = `Cannot warp: ${r.why}`; gameState = { ...gameState }; return; }
    // a manual jump is the new floor: a later Push in Forward Mode falls back to the zone just left
    gameState.forwardSafe = gameState.zone;
    if (r.forfeit) push(gameState, r.forfeit);
    push(gameState, `Waypoint to ${s.name} — ${r.gold} gold for the ${saved} blocks it saves`);
    fx(gameState, { kind: 'warp', side: 'self', text: `warp · ${s.name}`, colour: hitColour(null) });
    gameState = { ...gameState };
  }

  /** What a warp to a settlement would cost, read off the same row the warp pays. */
  const warpPrice = (id: string) => warpCost(gameState, id);
  /** the Waypoint's own price line, so the prose quotes the data's number instead of retyping it */
  const warpFee = $derived(warpRow()?.m_per_block ?? 0);

  /** Start a walk on foot to any cell of the field — this is how a Waypoint unlocks and a hunt is reached. */
  function doWalk(dest: Picked | Cell & { key?: string }) {
    const r = startWalk(gameState, dest);
    if (!r.ok) { saveNote = `Cannot walk: ${r.why}`; gameState = { ...gameState }; return; }
    // the walk takes the frame: the map closes and the field carries the walking read, because a sharp
    // map and the HUD cannot share a square (DECISIONS.md §Interface three-state rule). The pick is spent with it —
    // in field view the card has no box left to measure, and a card parked there sits on the self-plate.
    panel = null;
    picked = null;
    pickedCell = null;
    if (r.forfeit) push(gameState, r.forfeit);
    saveNote = '';
    gameState = { ...gameState };
  }

  /** The run the card speaks for: inside with a count, or outside with the cooldown left. */
  const dungeonView = $derived.by(() => {
    const run = gameState.dungeon;
    if (run) return { active: true, left: run.left, total: run.total, cooldown: 0 };
    return { active: false, left: 0, total: 0, cooldown: Math.ceil(cooldownLeft(gameState)) };
  });

  /** Step into the settlement's dungeon: one run, escrowed loot, forfeited on a Push. */
  function doDungeon() {
    const r = enterDungeon(gameState);
    if (!r.ok) { saveNote = `Cannot enter: ${r.why}`; gameState = { ...gameState }; return; }
    push(gameState, `Entered the dungeon — ${gameState.dungeon!.total} mobs, loot held in escrow until the last one falls`);
    gameState = { ...gameState };
  }

  let bench = $state<{ where: Where; index: number } | null>(null);
  let benchNote = $state('');
  const benchItem = $derived(bench ? (bench.where === 'gear' ? gameState.gear[bench.index] : gameState.bag[bench.index]) : null);

  function runCraft(op: CraftOp, lineIndex: number, pick?: string) {
    if (!bench) return;
    const rng = mulberry32(gameState.rngState);
    gameState.rngState += 1;
    const r = doCraft(gameState, bench.where, bench.index, op, lineIndex, rng, pick);
    benchNote = r.ok ? `${op}: ${r.note}` : `${op} refused — ${r.why}`;
    if (r.ok) {
      push(gameState, `Bench ${op} · ${r.note}`);
      // a stone landing is a beat on the bench: the same gold the crit wears, because a craft that
      // worked is the field's other kind of hit
      fx(gameState, { kind: 'craft', side: 'self', text: `${op} · ${r.note}`, colour: E.elements.crit_colour || 'var(--gold)' });
    }
    gameState = { ...gameState };
  }

  let skillNote = $state('');
  let skillTab = $state<'loadout' | 'owned' | 'effects' | 'mastery'>('loadout');
  let farmNote = $state('');
  let farmTab = $state<'plots' | 'alchemy' | 'automation'>('plots');
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
  /** the inventory reads its tab: the hunt pile names its two bags, the warehouse names itself */
  const invSub = $derived(
    invTab === 'stash' ? `warehouse · ${tabs} tab${tabs === 1 ? '' : 's'} · one record, every settlement`
      : bagSub,
  );
  const farmSub = $derived('level ' + fl + ' / ' + farm.F.level_cap + ' · settlement herb plots and potion supplies');
  const deskSub = $derived(gameState.walk
    ? 'walking to ' + walkNote(gameState)
    : gameState.dungeon
      ? `dungeon — ${gameState.dungeon.total - gameState.dungeon.left}/${gameState.dungeon.total} mobs down, loot in escrow`
      : !gameState.hunting
        ? `${town?.name ?? 'the field'} · safe in town — hunt to head out`
        : pickedCell ? `${pickedCell.key} · ${pickedCell.label}` : `${town?.name ?? 'the field'} · trade, board, hunt, walk`);

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

  function doTurnIn() {
    const r = turnIn(gameState, town!.id);
    townNote = r.ok ? `Turned in the ${viewColSet.name} set · reward: ${r.reward}` : `Turn-in refused: ${r.why}`;
    gameState = { ...gameState };
  }

  /** Where the feet are, in the name the player acts on: a settlement's own for its ground, the zone's
   *  for everything else. The rest read and the empty field both answer to it, so neither can name the
   *  wrong place for the same ground. */
  const hereName = $derived(townLive ? (town?.name ?? 'the field') : zone.name);
  const placeRead = $derived.by(() => {
    if (gameState.walk) return `On the road to ${walkNote(gameState)}`;
    if (gameState.cell?.sub != null) return zone.subzones?.[gameState.cell.sub]?.name ?? 'Sub-zone';
    if (gameState.cell?.wild != null) return gameState.cell.wild === 0 ? 'Dungeon side' : `Wild side ${gameState.cell.wild + 1}`;
    if (townLive) return town?.name ?? 'Settlement';
    const nearest = settlementById(ownerOf(currentCell(gameState)).id);
    return nearest ? `Open ground · ${nearest.name}` : 'Open field';
  });
  const showPlaceRead = $derived(placeRead.trim().toLocaleLowerCase() !== zone.name.trim().toLocaleLowerCase());

  /** What the field is doing, said as it is. The client never prints a fight that is not running: an empty
   *  field names the clock that will fill it, and ground that fields nothing names the action that would. */
  const phaseRead = $derived.by(() => {
    if (gameState.phase === 'camp') {
      return `Pushed — recovering at camp for ${gameState.campSec} sec. No death, no loss: time is the only cost.`;
    }
    const swing = `${c.hitsPerSec.toFixed(2)} hits/sec with ${c.weaponName}${c.weaponElement ? `, carrying ${c.weaponElement}` : ', carrying no Element'}`;
    if (gameState.walk) {
      return `Walking — block ${gameState.walk.blocksTotal - gameState.walk.blocksLeft + 1} of ${gameState.walk.blocksTotal} · ${swing}`;
    }
    if (!gameState.hunting) {
      return `At rest in ${hereName} — nothing is being attacked. Pick a cell on the map and hunt it.`;
    }
    if (!gameState.group.length) {
      return `Hunting ${hereName} — next group in ${Math.max(0, gameState.spawnIn)} sec · ${swing}`;
    }
    return `Fighting — ${swing}`;
  });

  // A press reads as its own flat damage plus its effectiveness on the caster's power line — the
  // engine's own shape (`engine/skills.ts` perPress), so the panel never restates a formula.
  const pressText = (k: any) => (k.base_flat == null ? '' : `${Math.round(k.base_flat)} + ${k.eff}% of your ${k.basis === 'magic' ? 'magic' : 'physical'} power${k.max_hp_pct ? ` + ${k.max_hp_pct}% of your Max HP` : ''}`);

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

  /** §14: the per-slot switch — the one thing that decides whether a row's list is read at all. */
  function setMode(id: string, mode: string) {
    gameState.skills.mode[id] = mode as any;
    gameState = { ...gameState };
  }

  /** One leg of one row's own list. Two rows can wait on different facts because neither reads the other.
      The status leg is trimmed to what the row can actually carry, so no screen can show a wait that the
      rotation would never answer. */
  function setCond(id: string, patch: Partial<SkillConditions>) {
    const next = { ...condOf(gameState.skills, id), ...patch };
    const flag = rowFlag(id);
    next.statusMissing = flag && next.statusMissing.includes(flag.key) ? [flag.key] : [];
    gameState.skills.conditions[id] = next;
    gameState = { ...gameState };
  }

  function finalResistance(el: string): number {
    return Math.min(c.resCap, c.resistance + (c.resByElement?.[el] || 0));
  }

  /** A cast-order row dragged onto another place in the bar: the same list the Skills screen edits. */
  function doMoveSlot(from: number, to: number) {
    moveSlot(gameState.skills, from, to);
    gameState = { ...gameState };
  }

  /** The three numbers a leg opens at, read from the roster — a screen types no default of its own. */
  const COND_DEFAULTS = sm.SKILLS.meta.cast_conditions;
  const HP_BELOW_DEFAULT = COND_DEFAULTS.hp_below_pct_default;
  const MANA_FLOOR_DEFAULT = COND_DEFAULTS.mana_floor_pct_default;
  const MIN_TARGETS_DEFAULT = COND_DEFAULTS.min_targets_default;
  /** …and the one flag a row can meaningfully wait on: the status its own Element applies, or the curse
      it writes. A row that carries neither is offered no such leg — the old list of every flag in the
      game asked the player to tick lines that could never fire for the row in front of them. */
  function rowFlag(id: string | null): { key: string; label: string } | null {
    const skill = id ? sm.byId[id] : null;
    const status = appliedStatusOf(skill);
    if (status) return { key: status, label: status };
    return appliedCurseOf(skill) ? { key: skill!.id, label: skill!.name ?? '' } : null;
  }
  function toggleStatusMissing(id: string, name: string) {
    const now = condOf(gameState.skills, id).statusMissing;
    setCond(id, { statusMissing: now.includes(name) ? now.filter((n) => n !== name) : [...now, name] });
  }

  /** Which row's list the screen is showing at the moment — one at a time, so the table stays a table. */
  let gateOpen = $state<string | null>(null);

  /** A row's own list in one line, so the table cell and the field bar both say the same thing the
      rotation reads. An empty list is said plainly: no leg holds, so the row never fires. */
  function gateNote(id: string): string {
    const cond = condOf(gameState.skills, id);
    const legs: string[] = [];
    if (cond.boss) legs.push('a boss');
    if (cond.hpBelowPct > 0) legs.push(`our HP under ${cond.hpBelowPct}%`);
    if (cond.minTargets > 0) legs.push(`${cond.minTargets}+ targets`);
    if (cond.manaFloorPct > 0) legs.push(`keep ${cond.manaFloorPct}% of the pool`);
    const flag = rowFlag(id);
    if (flag && cond.statusMissing.includes(flag.key)) legs.push(`no ${flag.label}`);
    return legs.join(' · ');
  }

  /** Copy one row's list onto every conditional row — the bulk case, without a second source of truth. */
  function copyGate(id: string) {
    const from = { ...condOf(gameState.skills, id) };
    for (const slot of gameState.skills.list) if (slot && modeOf(gameState.skills, slot) === 'conditional') setCond(slot, from);
    gameState = { ...gameState };
  }

  /** A row with no cooldown of its own is the FILLER: the rotation gives it the press only after every
      timed slot has had its chance, so its place in the order is not what decides when it fires. */
  const slotFiller = (id: string | null): boolean => Boolean(id) && (sm.byId[id!] as any)?.cd === 0;
  /** What a slot is actually waiting on, in the bar's own words. A bar that rings every cooled-down row
      as ready would hide the two modes the player set and the one reorder the sim obeys. */
  function slotWaiting(id: string | null): string {
    if (!id) return '';
    const mode = modeOf(gameState.skills, id);
    if (mode === 'never') return 'silenced';
    if (mode === 'conditional') {
      const note = gateNote(id);
      return note ? `waiting on ${note}` : 'held — no condition set yet';
    }
    return slotFiller(id) ? 'filler — after every timed slot' : 'ready when its cooldown is up';
  }

  /** The stones in words, using the names the bench itself charges by. */
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

  function toggle(id: string) {
    // the reservation rule and the buff switch both live in sim/skills.ts, so no sum is repeated here
    const r = toggleTrack(gameState.skills, id);
    saveNote = r.ok ? '' : r.why || 'cannot';
    gameState = { ...gameState };
  }
</script>

<svelte:window onkeydown={onfieldKey} />

<!-- the client is a desktop surface: below the floor the corner reads stop being placeable, so it says so
     instead of laying out a phone screen nobody asked for -->
<div class="small-screen" role="alert">
  <h2>Mod-Idle is played on a desktop</h2>
  <p>This screen is built for a window 1024 wide or more — the field reads its numbers in the corners, and
    they need the room. Widen the window, or set the browser zoom out.</p>
</div>

<div class="stage" style={`grid-template-areas:${hudLayoutAreas};`} class:mapmode={panel === 'map'} class:veiled={(panel !== null && panel !== 'map') || sheetOpen} class:townmode={townLive && panel !== 'map'}>
  <!-- The field lies on the map: one generated sheet, laid flat behind the HUD, dimmed and out of focus
       until the pointer reaches for it or the MAP tab brings it into focus. It is the only copy and the
       surface a place is picked, plotted and walked on — no modal sits between the player and a cell. -->
  <div
    class="map-back sheet"
    class:dragging
    role="toolbar"
    aria-label="Field map — click a cell to pick a place, arrows and Enter work the same list"
    tabindex="0"
    use:mapField
  >
    <div class="map-sheet" style:transform={`translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px) scale(${zoom.toFixed(4)})`}>
      {@html mapWithMist}
    </div>
  </div>
  <!-- the zone's own name lives once, on the read column's tag — no second copy of it behind the HUD -->

  <!-- top-centre: the hunt's headline — what you are fighting, the way a hub screen
       names its target: the front body's name over one wide red bar that carries its health -->
  {#if plates.length}
    {@const front = plates[0]}
    <div class="targetbar" style:justify-self={hudLayout.target.justify} style:align-self={hudLayout.target.align}
         style:width={hudLayout.target.justify === 'stretch' ? '100%' : null}>
      <p class="target-name">{fieldLabel(front)} <span>{front.kind}</span></p>
      <div class="target-hp">
        <i style={bar(front.hp, front.hpMax)}></i>
        <b>{Math.max(0, Math.round(front.hp))} / {Math.round(front.hpMax)}</b>
      </div>
    </div>
  {/if}

  <!-- top-left hub column: map, exact location, fight return and objectives share one width and edge -->
  <div class="topright" style:justify-self={hudLayout.objectives.justify} style:align-self={hudLayout.objectives.align}
       style:width={hudLayout.objectives.justify === 'stretch' ? '100%' : null}>
    <div class="map-reference">
      <Minimap markup={mapMarkup} cell={gameState.cell} onopen={() => togglePanel('map')} />
    </div>
    <div class="zone-tag">
      <img class="zone-emblem" src={waypointMark} alt="" aria-hidden="true" />
      <div class="zone-copy">
        <strong>{zone.name}</strong>
        {#if showPlaceRead}<span>{placeRead}</span>{/if}
      </div>
      <b class="zone-level">Lv {zone.levels[0]}–{zone.levels[1]}</b>
    </div>
    <div class="tracker">
      <p class="phase">{phaseRead}</p>
      <div class="hunger-read" class:empty={gameState.fieldwork.hunger <= 0} title={gameState.fieldwork.hunger <= 0 ? `Hunger empty · HP regeneration reduced by ${fieldwork.F.hunger.empty_hp_regen_cut_pct}% · ES recharge unchanged` : 'Hunger · travel and field activity consume supplies'}>
        <span>Hunger</span><b>{Math.floor(gameState.fieldwork.hunger)}%</b>
        <i><em style:width={`${hungerFill * 100}%`}></em></i>
      </div>
      {#if bagFull}
        <p class="alarm-line">Bag full — the zone has stopped paying. Walk to a settlement and deposit.</p>
      {/if}
      <p class="objective">{describeGoal()}</p>
    </div>
  </div>
  <div class="field-travel-actions" aria-label="Travel and map controls"
       style:justify-self={hudLayout.travel.justify} style:align-self={hudLayout.travel.align}
       style:width={hudLayout.travel.justify === 'stretch' ? '100%' : null}>
    <div class="travel-actions" role="group" aria-label="Travel mode">
      <button class="travel-action" class:here={gameState.travel === 'stay'} type="button"
              aria-pressed={gameState.travel === 'stay'} title="Stay here" onclick={() => setTravel('stay')}>
        <span class="toggle-ring" class:here={gameState.travel === 'stay'}><img src={stayMark} alt="" aria-hidden="true" /></span><span>Stay Here</span>
      </button>
      <button class="travel-action" class:here={gameState.travel === 'forward'} type="button"
              aria-pressed={gameState.travel === 'forward'} title="Climb forward automatically" onclick={() => setTravel('forward')}>
        <span class="toggle-ring" class:here={gameState.travel === 'forward'}><img src={climbMark} alt="" aria-hidden="true" /></span><span>Forward</span>
      </button>
    </div>
    {#if panel === 'map'}
      <div class="map-guide" class:open={mapHelpOpen}>
        <button class="map-help-toggle" aria-expanded={mapHelpOpen} aria-label={mapHelpOpen ? 'Hide map tools and guide' : 'Show map tools and guide'}
                title={mapHelpOpen ? 'Hide map tools and guide' : 'Show map tools and guide'} onclick={() => (mapHelpOpen = !mapHelpOpen)}>
          <span class="toggle-ring" class:here={mapHelpOpen}><img src={mapToolsMark} alt="" aria-hidden="true" /></span>
          <span>Tools</span>
        </button>
        {#if mapHelpOpen}
          <div class="map-tools">
            <span role="group" aria-label="Sheet view" class="map-views">
              {#each [['terrain', 'terrain'], ['band', 'level band'], ['gate', 'level gate']] as [v, label] (v)}
                <label><input type="radio" name="mapview" bind:group={view} value={v} />{label}</label>
              {/each}
            </span>
            {#if view === 'gate'}
              <label class="map-level">level <input type="range" min="1" max={lastBand[1]} bind:value={gateLevel} /> <b>{gateLevel}</b></label>
            {/if}
            <label><input type="checkbox" bind:checked={showWalk} /> walk graph</label>
            <label><input type="checkbox" bind:checked={showIds} /> cell ids</label>
            <span role="group" aria-label="Map view" class="map-zoom">
              <button onclick={() => mapZoomBy(1 / 1.25)} aria-label="Zoom out" title="Zoom out">−</button>
              <b>{Math.round(zoom * 100)}%</b>
              <button onclick={() => mapZoomBy(1.25)} aria-label="Zoom in" title="Zoom in">+</button>
              <button onclick={mapCentre} title="Centre on the settlement you stand in">centre</button>
              <button onclick={mapReset} title="Reset the map view">reset</button>
            </span>
          </div>
          <div class="map-legend">
            {#each legend as l (l.name)}<span class="swatch"><i style:background={l.tone}></i>{l.label}</span>{/each}
            <span class="swatch ramp"><i style:background={`linear-gradient(90deg,${rampCss})`}></i>{firstBand[0]} … {lastBand[1]}</span>
          </div>
          {#if gameState.walk}
            <p class="map-hint"><small>Walking to <b>{walkNote(gameState)}</b> · block {gameState.walk.blocksTotal - gameState.walk.blocksLeft + 1}/{gameState.walk.blocksTotal} · ambush chance {E.road.encounter_chance_pct}% per block.</small></p>
          {:else}
            <p class="map-hint"><small>Click a cell to travel · drag to pan · scroll to zoom. <b>Centre</b> returns to your position.</small></p>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
  {#if latestLevel}
    <!-- the one beat the whole frame takes for itself: a level is why the character is here, so it borrows
         the title's line for one rise and hands it back. The accent is the HUD's own, read out of the data,
         and the digits are set in `--num` like every other number the client prints. This is
         decoration to a reader and nothing to a keyboard -->
    {#key latestLevel.id}
      <p class="levelup" style={`--fx:${latestLevel.colour}`} aria-hidden="true">{latestLevel.text}</p>
    {/key}
  {/if}

  {#if awayReport}
    <div class="toast">
      <button class="quit" onclick={() => (awayReport = null)} aria-label="Dismiss">✕</button>
      <strong>Welcome back</strong>
      <span>away {awayReport.mins} min · {awayReport.secs} sec simulated{awayReport.capped ? ' (capped at the offline limit)' : ''}</span>
      <span>+{fmtNum(awayReport.kills)} kills · {fmtNum(awayReport.drops)} items · {fmtNum(awayReport.stones)} stones · {fmtNum(awayReport.junk)} junk · {fmtNum(awayReport.gold)} gold{awayReport.levels ? ` · +${awayReport.levels} level${awayReport.levels > 1 ? 's' : ''}` : ''} · quality floor {awayReport.quality}</span>
    </div>
  {/if}

  <!-- contextual overlays stay on the right edge and appear only while open. -->
  <div class="dock" style:justify-self={hudLayout.panels.justify} style:align-self={hudLayout.panels.align}
       style:width={hudLayout.panels.justify === 'stretch' ? '100%' : 'auto'}>
    {#if alloc}
      <!-- the level's points, spent where the level is read: this overlay is the only place a point is
           added, and Respec stays a settlement service so a field refund cannot serve a build switch
           mid-fight -->
      <section class="pop" aria-label="Allocate points">
        <header><h3>Allocate · level {gameState.player.level}</h3>
          <button class="quit" onclick={() => (alloc = false)} aria-label="Close allocate" title="Close (Esc)">✕</button>
        </header>
        <div class="pop-body">
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
            </tbody>
          </table>
        </div>
      </section>
    {/if}

  </div>

  {#if !alloc && !more}
    <div class="field-auto-actions" role="group" aria-label="Field automation">
      <button class="tab field-auto-tab" class:here={panel === 'skills'} type="button"
              aria-label="Skill settings" aria-expanded={panel === 'skills'}
              title={`Skill settings — cast order and modes · ${keyFor('screen.skills')}`}
              aria-keyshortcuts={keyFor('screen.skills')} onclick={() => togglePanel('skills')}>
        <span class="toggle-ring" class:here={panel === 'skills'}><img src={skillSettingsMark} alt="" aria-hidden="true" /></span><span class="cap">Skill Settings</span>
      </button>
      <button class="tab field-auto-tab" class:here={settings.autoSkills !== false} type="button"
              aria-label={`Auto skills ${settings.autoSkills === false ? 'off' : 'on'}`}
              aria-pressed={settings.autoSkills !== false}
              title={`Auto skills · ${settings.autoSkills === false ? 'off' : 'on'}`}
              onclick={() => setSetting('autoSkills', settings.autoSkills === false)}>
        <span class="field-auto-icon toggle-ring" class:here={settings.autoSkills !== false}>
          <img src={skillMark} alt="" aria-hidden="true" />
        </span>
        <span class="cap">Auto Skills</span>
      </button>
      <button class="tab field-auto-tab" class:here={settings.autoEquip !== false} type="button"
              aria-label={`Auto equip ${settings.autoEquip === false ? 'off' : 'on'}`}
              aria-pressed={settings.autoEquip !== false}
              title={`Auto equip · ${settings.autoEquip === false ? 'off' : 'on'} · better drops are equipped automatically`}
              onclick={toggleAutoEquip}>
        <span class="field-auto-icon toggle-ring" class:here={settings.autoEquip !== false}>
          <img src={autoEquipMark} alt="" aria-hidden="true" />
        </span>
        <span class="cap">Auto Equip</span>
      </button>
      <button class="tab field-auto-tab" class:here={panel === 'camp'} type="button"
              aria-label="Field Camp" aria-pressed={panel === 'camp'} title="Field Camp" onclick={() => togglePanel('camp')}>
        <span class="toggle-ring" class:here={panel === 'camp'}><img src={campMark} alt="" aria-hidden="true" /></span><span class="cap">Camp</span>
      </button>
    </div>
  {/if}

  <!-- top-right, under the minimap: what the hunt is worth right now, so a decision never needs a panel opened -->
  {#if saveNote}
    <!-- the save note reads at the top where the eye already checks announcements, not in the purses -->
    <span class="pill note save-note">{saveNote}</span>
  {/if}

  <!-- bottom-centre: the cast order as a row of equal orbs, one per slot, each carrying its own number.
       Read-only on the field — arranging it is the Skills sub-screen's job, so the row ends with the
       press that opens it; the game presses the first slot whose cooldown is ready and whose mana fits,
       and a filler row waits behind every timed one, so this row is what happens next. -->
  <div class="actionbar" style:justify-self={hudLayout.actionbar.justify} style:align-self={hudLayout.actionbar.align}
       style:width={hudLayout.actionbar.justify === 'stretch' ? '100%' : 'auto'}>
    <div class="action-cluster">
      <div class="vital-stack">
        <span class="orb-readout"><span><strong>{fmtNum(shownHp)}</strong>/{fmtNum(c.maxHp)} HP</span>
          {#if c.es > 0}<span class="orb-shield"><strong>{fmtNum(shownEs)}</strong>/{fmtNum(c.es)} ES</span>{/if}
        </span>
        <div class="vital-orb life-orb" style={`--shield-strength:${esFill.toFixed(3)}`}
             role="img" aria-label={`HP ${fmtNum(gameState.player.hp)} of ${fmtNum(c.maxHp)}${c.es > 0 ? `, ES ${fmtNum(gameState.player.es)} of ${fmtNum(c.es)}` : ''}`}>
          <div class="orb-well">
            <i class="orb-fill" style={`--fill:${hpFill.toFixed(3)}`} aria-hidden="true"></i>
            <span class="orb-gloss" aria-hidden="true"></span>
          </div>
        </div>
      </div>
      <div class="casts" role="list" aria-label="Skill bar">
      {#each gameState.skills.list as id, i}
        {@const k = id ? sm.byId[id] : null}
        {@const cd = id ? (gameState.skills.cd[id] || 0) : 0}
        {@const eff = id ? skillCd(gameState.skills, id, c.cdr) : 0}
        <!-- how far the cooling dial has swept: the wedge still dark is the cooldown that is left -->
        {@const frac = cd > 0 && eff > 0 ? Math.max(0, Math.min(1, 1 - cd / eff)) : 1}
        {@const when = id ? modeOf(gameState.skills, id) : 'always'}
        {@const filler = slotFiller(id)}
        <span class="cast" class:empty={!id || !k} class:ready={!!k && cd <= 0 && when === 'always' && !filler}
              class:paused={!running || paused}
              class:silent={when === 'never'} class:gated={when === 'conditional'} class:filler={filler}
              role="listitem"
              draggable={Boolean(id)}
              ondragstart={(e) => setCastDrag(e, { index: i })}
              ondragover={(e) => { if (id) e.preventDefault(); }}
              ondrop={(e) => { const f = readCastDrag(e); if (f && f.index !== i) doMoveSlot(f.index, i); }}
              title={`Slot ${i + 1}${id && k ? `: ${k.name} · ${slotWaiting(id)}` : ': empty'}`}>
          {#if id && k}
            <img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" />
            {#if cd > 0}
              <span class="sweep" style={`--skill-cooldown-progress:${(frac * 100).toFixed(2)}%; --cooldown-step:${cooldownStepMs}ms`} aria-hidden="true"></span>
              <small>{cd.toFixed(1)}</small>
            {/if}
            {#if latestFire?.skillId === id}
              <!-- the order is the one place that can say which row fired without a second number: a ring of
                   the press's own Element, remounted once per event by the key -->
              {#key latestFire.id}
                <span class="flare" style={`--fx:${latestFire.colour}`} aria-hidden="true"></span>
              {/key}
            {/if}
          {/if}
          <b>{i + 1}</b>
        </span>
      {/each}
      </div>
      <div class="vital-stack">
        <span class="orb-readout"><span><strong>{fmtNum(shownMana)}</strong>/{fmtNum(c.maxMana)} Mana</span>
          {#if reserved > 0}<span class="orb-reserved">RES {reserved}%</span>{/if}
        </span>
        <div class="vital-orb mana-orb" class:reserved={reserved > 0} style={`--reserved:${reserved}%`}
             role="img" aria-label={`Mana ${fmtNum(gameState.player.mana)} of ${fmtNum(c.maxMana)}${reserved > 0 ? `, ${reserved}% reserved by auras` : ''}`}>
          <div class="orb-well">
            <i class="orb-fill" style={`--fill:${manaFill.toFixed(3)}`} aria-hidden="true"></i>
            <span class="orb-gloss" aria-hidden="true"></span>
          </div>
        </div>
      </div>
    </div>
    <ExpBar level={gameState.player.level} pct={xpPct}
            allocOpen={alloc} onAllocate={() => { alloc = !alloc; }} />
  </div>

  <!-- bottom-right controls use the same circular menu language as the rest of the HUD. -->
  <div class="controls-dock" role="group" aria-label="Game controls" style:justify-self={hudLayout.controls.justify} style:align-self={hudLayout.controls.align}
       style:width={hudLayout.controls.justify === 'stretch' ? '100%' : null}>
    <div class="speed-menu" role="group" aria-label="Game speed">
      <div class="speed-options">
        {#each SPEEDS as m}
          <button class="speed-orb toggle-ring" class:here={speed === m} aria-pressed={speed === m} type="button"
                  onclick={() => setSpeed(m)} title={`Clock speed ×${m}`}>×{m}</button>
        {/each}
      </div>
      <span class="cap">Speed</span>
    </div>
    <button class="tab control-tab" class:here={!running} type="button" onclick={() => (running = !running)}
            title={`${running ? 'Pause' : 'Resume'} · ${keyFor('game.pause')}`}
            aria-label={running ? 'Pause game' : 'Resume game'} aria-pressed={!running}
            aria-keyshortcuts={keyFor('game.pause')}>
      <span class="control-icon toggle-ring" class:here={!running}>
        <svg viewBox="0 0 32 32" aria-hidden="true">
          {#if running}<path d="M11 9v14M21 9v14" />{:else}<path d="m12 9 12 7-12 7z" />{/if}
        </svg>
      </span>
      <span class="cap">{running ? 'Pause' : 'Resume'}</span>
    </button>
  </div>

  <!-- the middle of the frame is the group itself: one plate per mob, HP as the loudest thing on it, and
       every landed blow popping its own figure off the plate it hit -->
  <div class="field" style:justify-self={hudLayout.field.justify} style:align-self={hudLayout.field.align}>
            <FieldPlates s={gameState} c={c} ring={ring} plates={plates} statuses={statuses} zone={zone} town={town} townLive={townLive}
                         vitals={{ hp: shownHp, es: shownEs, mana: shownMana }}
                 plateMotion={plateMotion} fxOutMs={fxOutMs} />
  </div>

  <!-- The hit ring: what the sim just did that has no body to stand on, drawn as an event rather than read
       back out of a total. A hit names its mob and rises over that plate; this column keeps a kill — whose
       mob leaves the field the same tick — and a drop, which is loot on the character. `counters.damageBy`
       says how much a build dealt; this says when, in what colour, and with what landing — the number wears
       the Element that carried the hit, a crit wears the game's one accent, and a status proc wears the colour
       of the Element that inflicted it (a cold proc is the same ice as a cold hit). Colours come out of
       `engine.json` `elements`, never typed here. -->
  <div class="floaters" aria-hidden="true">
    <div class="float-side field-side">
      {#each fieldFx as e (e.id)}
        <span class="fx fx-{e.kind}" class:crit={e.crit} out:fxOut={{ ms: fxOutMs }} style="--fx:{e.colour}; --lane:{e.id % 7}">{e.text}</span>
      {/each}
    </div>
    {#if latestTaken}
      <!-- the character's own answer to being hit: the frame's edge takes the colour of what landed,
           so a chaos hit and a physical one are felt differently before the number is even read -->
      {#key latestTaken.id}
        <span class="veil" style="--fx:{latestTaken.colour}"></span>
      {/key}
    {/if}
  </div>

  <!-- the pick made on the map the field stands on: the card that plots the walk and offers the trip,
       anchored to the cell it speaks for in map focus — the desk it opens is the only screen a place owns -->
  {#if pickedSettlement && pickedDest && panel === 'map'}
    <div class="mapcard" bind:this={mapcardEl}
         style:left={cardAt ? `${cardAt.x.toFixed(1)}px` : null}
         style:top={cardAt ? `${cardAt.y.toFixed(1)}px` : null}
         style:bottom={cardAt ? 'auto' : null}
         style:transform={cardAt ? 'translateX(-50%)' : null}>
      <TravelCard
        settlement={pickedSettlement}
        dest={pickedDest}
        busy={!!gameState.walk}
        fare={warpPrice(pickedSettlement.id)}
        afford={gameState.counters.gold >= warpPrice(pickedSettlement.id)}
        dungeon={dungeonView}
        onwalk={() => pickedCell && doWalk(pickedCell)}
        onwarp={travelTo}
        onhunt={doHuntHere}
        ondungeon={doDungeon}
        ondesk={() => (panel = 'desk')}
        onclear={() => { picked = null; pickedCell = null; }}
        oncamp={doEstablishCamp}
        oncampui={() => (panel = 'camp')}
      />
    </div>
  {/if}

  <!-- the chronicle stays in the bottom-left corner -->
  <div class="field-feed" style:justify-self={hudLayout.feed.justify} style:align-self={hudLayout.feed.align}
       style:width={hudLayout.feed.justify === 'stretch' ? '100%' : 'auto'}>
    <LogBox lines={chatShown} tabs={CHAT_TABS} active={chatTab} onTab={(tab) => (chatTab = tab)} />
  </div>

  <!-- every note the client gives by press — a refusal, a forge outcome, a deposit — is said out loud as
       well as printed, because four different pills in four different corners are not one announcement -->
  <p class="aloud" role="status" aria-live="polite">{saveNote || equipNote || benchNote || townNote || farmNote}</p>

  <!-- The rail occupies its named cells in the shared hub grid. -->
  <nav class="rail" aria-label="Menu" style:justify-self={hudLayout.menu.justify} style:align-self={hudLayout.menu.align}>
    <button class="tab" class:here={panel === null} onclick={closePanel}
            title="Back to the field · Esc" aria-keyshortcuts="Esc" aria-label="Back to the field">
      <span class="toggle-ring" class:here={panel === null}><img src={fieldMark} alt="" aria-hidden="true" /></span>
      <span class="cap">Field</span>
    </button>
    {#each MAIN_RAIL as p}
      {@const label = RAIL_LABEL[p]}
      {@const key = keyFor(SCREEN_ACTION[p])}
      {@const far = TOWN_PANELS.includes(p) && !townLive}
      {@const badge = p === 'tree' ? gameState.player.statPoints : 0}
      <button class="tab" class:here={panel === p} class:far={far}
              onclick={() => togglePanel(p)}
              title={`${label}${far ? ' — a settlement service, walk or warp into one first' : ''} · ${key}`}
              aria-keyshortcuts={key} aria-label={label}>
        <span class="toggle-ring" class:here={panel === p}><img src={RAIL_ICON[p]} alt="" aria-hidden="true" /></span>
        <span class="cap">{label}</span>
        {#if badge > 0}<span class="count">{badge}</span>{/if}
      </button>
      {#if p === 'skills'}
        <button class="tab" class:here={sheetOpen} aria-expanded={sheetOpen}
                onclick={() => (sheetOpen = !sheetOpen)} title="Character sheet" aria-label="Character sheet">
          <span class="toggle-ring" class:here={sheetOpen}><img src={sheetMark} alt="" aria-hidden="true" /></span>
          <span class="cap">Sheet</span>
        </button>
      {/if}
    {/each}
    <button class="tab" class:here={more} onclick={() => (more = !more)}
            aria-expanded={more} aria-haspopup="true" title="More screens and HUD tools · Esc closes" aria-label="More">
      <span class="toggle-ring" class:here={more}><img src={moreMark} alt="" aria-hidden="true" /></span>
      <span class="cap">More</span>
    </button>
    {#if more}
      <div class="morebox" role="menu" aria-label="More screens and HUD tools">
        {#each MORE_RAIL as p}
          {@const label = RAIL_LABEL[p]}
          {@const far = TOWN_PANELS.includes(p) && !townLive}
          <button class="moreitem" role="menuitem" class:here={panel === p} class:far={far}
                  onclick={() => { togglePanel(p); more = false; }}
                  title={`${label} · ${keyFor(SCREEN_ACTION[p])}`}>
            <span class="toggle-ring" class:here={panel === p}><img src={RAIL_ICON[p]} alt="" aria-hidden="true" /></span>
            <span>{label}</span>
          </button>
        {/each}
        <button class="moreitem" role="menuitemcheckbox" aria-checked={hudGridVisible}
                onclick={() => (hudGridVisible = !hudGridVisible)} title="Toggle the viewport grid">
          <span class="toggle-ring" class:here={hudGridVisible}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v18M16 3v18M3 8h18M3 16h18" /></svg>
          </span>
          <span>Grid</span>
        </button>
        <button class="moreitem" role="menuitem" onclick={openLayoutEditor} title="Arrange HUD regions on the grid">
          <span class="toggle-ring"><img src={keysMark} alt="" aria-hidden="true" /></span>
          <span>Layout</span>
        </button>
      </div>
    {/if}
  </nav>
</div>

{#if hudGridVisible}
  <div class="hud-grid-debug" aria-hidden="true">
    {#each HUD_GRID_LABELS as cell (cell)}<span>{cell}</span>{/each}
  </div>
{/if}

{#if layoutEditorOpen}
  <Panel title="HUD Layout Studio" subtitle="Drag regions, set cell bounds, then apply" width="wide" gridArea="2 / 3 / 15 / 14" onclose={() => (layoutEditorOpen = false)}>
    <HudLayoutEditor hud={hudLayout} modal={modalLayout} onapply={applyHudLayout} />
  </Panel>
{/if}

{#if sheetOpen}
  <Panel
    title="Character sheet"
    subtitle={`Level ${gameState.player.level} · final values include gear, tree, and active effects · ${gameState.player.statPoints} stat points unspent · ${gameState.player.treePoints} tree points banked`}
    width="wide"
    gridArea={modalGridArea}
    onclose={() => (sheetOpen = false)}
  >
    <div class="sheet-tools">
      <button class="sheet-new-character" type="button" title="Start a new character"
              aria-label="New character" onclick={() => { if (confirm('Start a new character?')) reset(); }}>
        <img src={newCharacterMark} alt="" aria-hidden="true" />
        <span>New character</span>
      </button>
    </div>
    <div class="sheet-layout">
      <section class="sheet-doll" aria-label="Worn equipment">
        <h3>Worn gear <span>{gameState.gear.filter(Boolean).length} / {E.stat.item_slots}</span></h3>
        <SlotGrid entries={wornEntries} capacity={E.stat.item_slots} wornOf={wornOf} fixed layout="doll"
                  actions={wornActions} />
      </section>
      <div class="sheet-values" aria-label="Final character values">
        <div class="sheet-value-column">
          <section class="sheet-stat-group">
            <h3>Core attributes</h3>
            <table class="stats"><tbody>
              {#each STATS as k}
                <tr><td>{k.toUpperCase()}</td><td>{c.core[k].toFixed(1)} <small>· {gameState.player.points[k]} spent</small></td></tr>
              {/each}
            </tbody></table>
          </section>
          <section class="sheet-stat-group">
            <h3>Attack and power</h3>
            <table class="stats"><tbody>
              <tr><td>Attack speed</td><td>{c.aspd.toFixed(1)} aspd · {c.hitsPerSec.toFixed(2)} hits/sec · weapon {c.weaponAspd.toFixed(2)} sec</td></tr>
              <tr><td>Accuracy</td><td>{Math.round(c.accuracy)} rating</td></tr>
              <tr><td>Cooldown reduction</td><td>{c.cdr.toFixed(1)}% · Cap {E.caps.cdr}</td></tr>
              <tr><td>Weight</td><td>{c.weightUsed.toFixed(0)} / {Math.round(c.weightCap)}{c.encumbrance > 0 ? ` · aspd ${(c.encumbrance * -100).toFixed(0)}%` : ' · no tax'}</td></tr>
              <tr><td>Global speed</td><td>×{c.globalSpeed.toFixed(2)} cooldown</td></tr>
              <tr><td>Physical power</td><td>{Math.round(c.phys)}</td></tr>
              <tr><td>Magic power</td><td>{Math.round(c.magic)}</td></tr>
              <tr><td>Elemental power</td><td>{Math.round(c.elem)}</td></tr>
              {#each loot.ELEMENTS as el (el)}
                <tr><td>{el} power</td><td>{Math.round(c.elemByElement?.[el] || 0)}{c.conversion?.[el] ? ` · ${c.conversion[el]}% converted` : ''}</td></tr>
              {/each}
              <tr><td>Attack damage</td><td>{c.attackDamage.toFixed(1)}%</td></tr>
              <tr><td>Spell damage</td><td>{c.spellDamage.toFixed(1)}%</td></tr>
              <tr><td>Global damage</td><td>×{E.global.damage_mult.toFixed(2)}</td></tr>
            </tbody></table>
          </section>
        </div>
        <div class="sheet-value-column">
          <section class="sheet-stat-group">
            <h3>Combat effects</h3>
            <table class="stats"><tbody>
              <tr><td>Crit</td><td>{c.critPool.toFixed(1)} pool · {c.critChance.toFixed(1)}% chance · {c.critDmg.toFixed(0)}% damage</td></tr>
              <tr><td>Armour penetration</td><td>{c.armourPen.toFixed(1)}%</td></tr>
              <tr><td>Chance to bleed</td><td>{c.bleedChance.toFixed(1)}%</td></tr>
              <tr><td>Chance to stun</td><td>{c.stunChance.toFixed(1)}%</td></tr>
              <tr><td>Element alignment</td><td>{c.alignment.toFixed(1)}%</td></tr>
              <tr><td>Leech</td><td>{c.leechPct.toFixed(1)}%</td></tr>
            </tbody></table>
          </section>
          <section class="sheet-stat-group">
            <h3>Defence</h3>
            <table class="stats"><tbody>
              <tr><td>Health</td><td>{fmtNum(shownHp)} / {fmtNum(c.maxHp)} · +{c.hpRegen.toFixed(1)}/sec</td></tr>
              <tr><td>Energy Shield</td><td>{fmtNum(shownEs)} / {fmtNum(c.es)} · +{c.esRegen.toFixed(1)}/sec · {E.energy_shield.delay_sec}s delay</td></tr>
              <tr><td>Mana</td><td>{fmtNum(shownMana)} / {fmtNum(c.maxMana)} · +{c.manaRegen.toFixed(1)}/sec · {reservedPct(gameState.skills)}% reserved</td></tr>
              <tr><td>Armour</td><td>{Math.round(c.armour)}</td></tr>
              <tr><td>Evasion</td><td>{Math.round(c.evasion)} rating · {c.evasionChance.toFixed(1)}% chance · Cap {E.caps.evasion}%</td></tr>
              <tr><td>Perfect dodge</td><td>{c.perfectDodge.toFixed(1)}%</td></tr>
              <tr><td>Block</td><td>{c.block.toFixed(1)}%</td></tr>
              <tr><td>Damage taken</td><td>×{(E.global.defend_mult * c.damageTaken).toFixed(2)}</td></tr>
              <tr><td>Stun recovery</td><td>{c.stunRecovery.toFixed(1)}% · stop {eng.stunStopSec(c.core.vit, E.status.shock.stop_sec).toFixed(2)}s</td></tr>
              <tr><td>Status resistance</td><td>{c.statusResist.toFixed(1)}%</td></tr>
            </tbody></table>
          </section>
          <section class="sheet-stat-group">
            <h3>Elemental resistance · Cap {c.resCap}{c.resCap > E.caps.elem_res ? ' · unlocked' : ''}</h3>
            <table class="stats"><tbody>
              {#each loot.ELEMENTS as el (el)}
                <tr><td>{el}</td><td>{finalResistance(el).toFixed(1)}%{c.resByElement?.[el] ? ` · +${c.resByElement[el].toFixed(1)}% typed` : ''}</td></tr>
              {/each}
              <tr><td>All-Element</td><td>{c.resistance.toFixed(1)}% before typed bonuses</td></tr>
            </tbody></table>
          </section>
          <section class="sheet-stat-group">
            <h3>The gate</h3>
            <p class="sheet-gate">
              {#if gameState.goal.done}
                Met at {Math.round(gameState.goal.done.clockSec / 60)} min · level {gameState.goal.done.level} · {gameState.goal.attempts} spawns. The run keeps going for better item quality; there is no prestige.
              {:else}
                Not met yet · {gameState.goal.attempts === 0 ? 'no spawn of this boss yet' : `${gameState.goal.attempts} spawn${gameState.goal.attempts === 1 ? '' : 's'}`} · a Push resets the count.
              {/if}
            </p>
          </section>
        </div>
      </div>
    </div>
  </Panel>
{/if}

{#if panel === 'bag'}
  <Panel title="Inventory" subtitle={invSub} width="wide" gridArea={modalGridArea} onclose={closePanel}>
    <!-- Inventory and warehouse share this window; Forge and Craft open from their own More menu entries. -->
    <div class="sides" role="tablist" aria-label="Inventory">
      <button role="tab" class:active={invTab === 'inv'} aria-selected={invTab === 'inv'} onclick={() => (invTab = 'inv')}>
        Inventory · pile {gameState.bag.length} / {E.inventory.adventure_slots} · bag {slotsUsed(gameState)} / {slotsAvailable(gameState)}
      </button>
      <button role="tab" class:active={invTab === 'stash'} aria-selected={invTab === 'stash'} disabled={!townLive}
              onclick={() => (invTab = 'stash')}
              title={townLive ? `The warehouse the same record opens in every settlement · ${keyFor('screen.stash')}` : 'A settlement service — walk or warp into one first'}>
        Stash · {tabs} tab{tabs === 1 ? '' : 's'}{townLive ? '' : ' · not here'}
      </button>
    </div>
    <!-- Both grids render all slots; the panel body scrolls when the full inventory is taller than the viewport. -->
    <div class="invbody">
    {#if invTab === 'inv'}
    <section class="bagblock">
      {#if gameState.bag.length >= E.inventory.adventure_slots}
        <p class="warn"><b>Bag full — the zone has stopped paying.</b> {gameState.counters.overflow || 0} pieces have been left on the ground. Walk back to {settlementById(gameState.town.waypoint)?.name || 'a settlement'} and deposit.</p>
      {/if}
      {#if equipNote}<p class="equipnote">{equipNote}</p>{/if}
      <div class="bagtools">
        <!-- the margin is the difference between a press that dresses you and one that churns: a piece has
             to be this much ahead before it goes on, in the same percent the bag filter's margin is set in -->
        <label class="margin">only if better by
          <input type="number" min="0" step="1" value={settings.equipMargin || 0}
                 onchange={(e) => setSetting('equipMargin', Math.max(0, Number((e.target as HTMLInputElement).value) || 0))} />
          %
        </label>
        <button class="best" onclick={doBestEquip}
                title={'Wears whatever is strongest in the pile, piece by piece · ' + keyFor('equip.best')}
                aria-keyshortcuts={keyFor('equip.best')}>
          Put on the best I carry
        </button>
        <span class="grow"></span>
        <span class="purse inventory-gold" title="Gold in the purse">
          <img src={coinMark} alt="" aria-hidden="true" />
          <b>{fmtNum(gameState.counters.gold)}</b><i>gold</i>
        </span>
        {#if townLive && tabs}
          <!-- the way out of a pile is one press here, because this is the screen a full pile lands on -->
          <button class="mini" disabled={!gameState.bag.length} onclick={() => doDepositAll(stashTab)}>
            Stash every unlocked piece → Tab {stashTab + 1}
          </button>
        {/if}
      </div>
      <!-- the PoE face: two grids, one window — the trip's pile on the left, the character bag on the right -->
      <div class="poewin">
        <div class="bagshell poecol">
          <h3>Hunt pile · what this trip kept</h3>
          <nav class="bagcats" aria-label="Narrow the pile by kind">
            {#each pileGroups as g (g.id)}
              <button class:on={bagCat === g.id} onclick={() => (bagCat = g.id)}>
                <span>{g.label}</span><b>{g.n}</b>
              </button>
            {/each}
          </nav>
          <div class="bagmain">
            <div class="bagtools">
              <input class="bagsearch" type="search" placeholder="Search this pile…"
                     bind:value={bagQuery} aria-label="Search the pile" />
              <label class="bagtier">quality
                <select bind:value={bagTier} aria-label="Quality">
                  <option value="all">All</option>
                  <option value="low">low</option>
                  <option value="mid">mid</option>
                  <option value="high">high</option>
                </select>
              </label>
              <span class="grow"></span>
              <small class="dim">{bagShown.length} / {tempEntries.length}</small>
            </div>
            <SlotGrid
              entries={bagShown}
              capacity={E.inventory.adventure_slots}
              mode={tempMode}
              onmode={(m) => (tempMode = m)}
              sort={tempSort}
              onsort={(k) => (tempSort = k)}
              wornOf={wornOf}
              onequip={equip}
              actions={pileActions}
              empty="Nothing here yet — kills still drop, and the bag filter is the zone upgrade rate."
            />
          </div>
        </div>
        <div class="poecol poecarried">
          <h3>Carried · the character bag</h3>
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
        </div>
      </div>
      <details class="filter">
        <summary>Bag filter — what this run keeps</summary>
        <p><small>The filter is <b>off by default</b> — an off slot keeps every drop and dissolves nothing. Turn a slot on and a piece that fails its rule turns into 1 Value stone on the spot (stones are always kept, never discarded) — nothing is deleted.</small></p>
        <table>
          <thead><tr><th>Slot</th><th>Filter</th><th>Keep when it beats the worn piece by</th><th>Also keep an Element you cannot resist</th><th>The rule in words</th></tr></thead>
          <tbody>
            {#each FILTER_SLOTS as slot}
              {@const r = ruleFor(gameState.filter, slot)}
              <tr>
                <td>{slot}</td>
                <td><input type="checkbox" checked={r.enabled} onchange={(e) => editRule(slot, { enabled: (e.target as HTMLInputElement).checked })} /></td>
                <td><input type="number" min="0" step="1" value={r.margin_pct} disabled={!r.enabled} onchange={(e) => editRule(slot, { margin_pct: Number((e.target as HTMLInputElement).value) })} /> %</td>
                <td><input type="checkbox" checked={r.keep_missing_element} disabled={!r.enabled} onchange={(e) => editRule(slot, { keep_missing_element: (e.target as HTMLInputElement).checked })} /></td>
                <td>{describeRule(r)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p><small>Still not found — Elements you have no resistance for: <b>{gameState.filter.missing.elements.length ? gameState.filter.missing.elements.join(', ') : 'none'}</b> · empty slots: <b>{gameState.filter.missing.slots.length ? gameState.filter.missing.slots.join(', ') : 'none'}</b></small></p>
      </details>
    </section>
    {:else}
    <section class="bagblock">
      <h3>Stash · one warehouse, every settlement</h3>
      <StashBoard game={gameState} {tabs} tab={stashTab} pileSort={pileSort}
                  ontab={(t) => (stashTab = t)}
                  onpilesort={(k) => (pileSort = k)}
                  ondeposit={(i) => doDeposit(i, stashTab)}
                  onwithdraw={(i) => doWithdraw(stashTab, i)}
                  ondepositAll={() => doDepositAll(stashTab)}
                  onwithdrawAll={() => doWithdrawAll(stashTab)}
                  onlock={toggleLock} onequip={equip} {wornOf} />
      {#if townNote}<p class="townnote">{townNote}</p>{/if}
    </section>
    {/if}
    </div>
  </Panel>
{/if}

{#if panel === 'craft'}
  <Panel title="Craft" subtitle="Stones, bench, and equipment" width="wide" fixed topmost gridArea={modalGridArea} onclose={closePanel}>
    <CraftWorkshop game={gameState} item={benchItem} where={bench?.where ?? null} index={bench?.index ?? -1}
                   onpick={(where, index) => { bench = { where, index }; benchNote = ''; }}
                   onclear={() => { bench = null; benchNote = ''; }}
                   onrun={(op, line, pick) => runCraft(op, line ?? 0, pick)} {wornOf} note={benchNote} />
  </Panel>
{/if}

{#if panel === 'skills'}
  <Panel title="Skills" subtitle={`${ACTIVE_SLOTS} slots, cast top-down`} width="wide" gridArea={modalGridArea} onclose={closePanel}>
    <div class="skills-panel">
    <div class="skill-tabs" role="tablist" aria-label="Skill sections">
      <button role="tab" class:active={skillTab === 'loadout'} aria-selected={skillTab === 'loadout'} onclick={() => (skillTab = 'loadout')}>Loadout</button>
      <button role="tab" class:active={skillTab === 'owned'} aria-selected={skillTab === 'owned'} onclick={() => (skillTab = 'owned')}>Owned skills</button>
      <button role="tab" class:active={skillTab === 'effects'} aria-selected={skillTab === 'effects'} onclick={() => (skillTab = 'effects')}>Buffs & auras</button>
      <button role="tab" class:active={skillTab === 'mastery'} aria-selected={skillTab === 'mastery'} onclick={() => (skillTab = 'mastery')}>Mastery & curses</button>
    </div>
    {#if skillNote}<p class="skill-note" role="status">{skillNote}</p>{/if}
    {#if skillTab === 'loadout'}
    <div class="skill-view">
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
    <details class="prose">
      <summary>How the cast order works</summary>
      <p><small>The first ready slot with enough usable Mana fires; a no-cooldown slot fills last. Conditional rows check their own gates. Reserved Mana is not spendable.</small></p>
    </details>
    <table>
      <thead><tr><th>#</th><th>Skill</th><th>Worth</th><th>Level</th><th>cd → eff</th><th>Cost</th><th>Next in</th><th>When</th><th>Gate</th><th>Place</th></tr></thead>
      <tbody>
        {#each gameState.skills.list as id, i}
          {@const k = id ? sm.byId[id] : null}
          <tr>
            <td>{i + 1}</td>
            <td>
              {#if k}<span class="skill-label"><img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" />{k.name}{#if !sm.weaponFits(k, heldWeaponName(gameState) || '')}<span class="chip locked" title={`${k.name} fires only while a ${k.weapon} is held — you hold ${heldWeaponName(gameState) || 'nothing'}`}>needs {k.weapon}</span>{/if}</span>{:else}—{/if}
            </td>
            <td>{k && id ? (k.base_flat != null ? pressText(k) : k.type) : ''}</td>
            <td>{id ? `${skillLevel(gameState.skills, id)} / ${E.skill_xp.level_cap}` : ''}</td>
            <td>{k && id ? `${k.cd}s → ${skillCd(gameState.skills, id, c.cdr).toFixed(2)}s` : ''}</td>
            <td>{k && id ? costNow(gameState.skills, id) : ''}</td>
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
              {#if id && modeOf(gameState.skills, id) === 'conditional'}
                <button class="gate" onclick={() => (gateOpen = gateOpen === id ? null : id)}
                        title={gateOpen === id ? 'close this row\'s conditions' : 'edit this row\'s conditions'}>
                  {gateNote(id) || 'nothing yet — this row never fires'}
                </button>
              {:else}—{/if}
            </td>
            <td>
              <select value={id || ''} onchange={(e) => setSlot(i, (e.target as HTMLSelectElement).value)}>
                <option value="">empty</option>
                {#each ownedActives as k2}<option value={k2.id} selected={id === k2.id}>{k2.name}</option>{/each}
              </select>
            </td>
          </tr>
          {#if id && gateOpen === id && modeOf(gameState.skills, id) === 'conditional'}
            <!-- One row's own list, opened under the row it belongs to. The legs are the fixed five the
                 sim reads; a number a leg needs opens at its data default and the player edits it here. -->
            {@const cond = condOf(gameState.skills, id)}
            {@const flag = rowFlag(id)}
            <tr class="gate-editor">
              <td></td>
              <td colspan="9">
                <label><input type="checkbox" checked={cond.boss} onchange={(e) => setCond(id, { boss: (e.target as HTMLInputElement).checked })} /> against a boss</label> ·
                <label><input type="checkbox" checked={cond.hpBelowPct > 0} onchange={(e) => setCond(id, { hpBelowPct: (e.target as HTMLInputElement).checked ? HP_BELOW_DEFAULT : 0 })} /> while HP is under</label>
                <input type="number" min="0" max="100" value={cond.hpBelowPct} onchange={(e) => setCond(id, { hpBelowPct: Number((e.target as HTMLInputElement).value) })} />% of the pool ·
                <label><input type="checkbox" checked={cond.minTargets > 0} onchange={(e) => setCond(id, { minTargets: (e.target as HTMLInputElement).checked ? MIN_TARGETS_DEFAULT : 0 })} /> only against</label>
                <input type="number" min="1" value={cond.minTargets} onchange={(e) => setCond(id, { minTargets: Number((e.target as HTMLInputElement).value) })} /> in the group ·
                <label><input type="checkbox" checked={cond.manaFloorPct > 0} onchange={(e) => setCond(id, { manaFloorPct: (e.target as HTMLInputElement).checked ? MANA_FLOOR_DEFAULT : 0 })} /> never spend below</label>
                <input type="number" min="0" max="100" value={cond.manaFloorPct} onchange={(e) => setCond(id, { manaFloorPct: Number((e.target as HTMLInputElement).value) })} />% of the usable pool ·
                {#if flag}<label><input type="checkbox" checked={cond.statusMissing.includes(flag.key)} onchange={() => toggleStatusMissing(id, flag.key)} /> while {flag.label} is not on it</label>{/if}
                <button onclick={() => copyGate(id)}>copy to every conditional row</button>
                <button onclick={() => setCond(id, { boss: false, hpBelowPct: 0, statusMissing: [], minTargets: 0, manaFloorPct: 0 })}>clear</button>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
    </div>
    {:else if skillTab === 'owned'}
    <div class="skill-view">
    <h3>Owned skills · duplicates feed each skill's own ladder</h3>
    <div class="skill-owned-grid">
      {#each Object.keys(gameState.skills.owned) as id}
        {@const k = sm.byId[id]}
        <div class="skill-owned" title={`${k.name} · ${k.type} · ${k.effect || (k.base_flat != null ? `${Math.round(k.base_flat)} + ${k.eff}% of its ${k.basis} power` : k.reserve) || ''}`}>
          <span class="skill-label"><img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" /><b>{k.name}</b></span>
          <small>{gameState.skills.owned[id] + 1} owned · {gameState.skills.owned[id]} duplicates · {ladderOf(gameState.skills, id)}% cd</small>
        </div>
      {:else}
        <p class="empty-owned">No skill yet — the first one is a boss drop ({(E.skill_drop.boss * 100).toFixed(0)}% per boss kill).</p>
      {/each}
    </div>
    </div>
    {:else if skillTab === 'effects'}
    <div class="skill-view effects-view">
      <p class="reserve-note"><small>New buff and aura drops start off. Uncheck one here to remove it; buffs repeat while checked, and auras stay on until unchecked.</small></p>
      <section>
        <h3>Buff track · re-presses itself and takes no slot</h3>
        <div class="skill-effect-grid">
          {#each ownedBuffs as k}
            <label title={`${k.duration}s on · ${k.cd}s cooldown · ${costNow(gameState.skills, k.id)} · ${effectLine(k) || k.effect}`}><input type="checkbox" checked={gameState.skills.buffs[k.id]} onchange={() => toggle(k.id)} /><span class="skill-label"><img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" />{k.name}</span></label>
          {:else}<small>None owned.</small>{/each}
        </div>
      </section>
      <p class="reserve-note"><small>Reserved {reservedPct(gameState.skills)}% of Max Mana · cap {sm.RESERVATION_LIMIT}%. Active: {describeFold(effectsActive(gameState.skills)) || 'none'}.</small></p>
      <section>
        <h3>Auras · reserve Max Mana</h3>
        <div class="skill-effect-grid">
          {#each ownedAuras as k}
            <label title={`${k.reserve} · ${sm.reservePct(k.reserve ?? '')}% · ${effectLine(k) || k.effect}`}><input type="checkbox" checked={gameState.skills.auras[k.id]} onchange={() => toggle(k.id)} /><span class="skill-label"><img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" />{k.name}</span></label>
          {:else}<small>None owned.</small>{/each}
        </div>
      </section>
    </div>
    {:else}
    <div class="skill-view">
    <h3>Mastery ladder · the whole roster</h3>
    <p><small>Only the held weapon earns XP (4 a kill) — the account keeps the best value any slot reached.</small></p>
    <table>
      <thead><tr><th>Weapon</th><th>Mastery</th><th>Drop bonus</th></tr></thead>
      <tbody>
        {#each WEAPONS as w}
          {@const lv = masteryLevel(gameState, w.name)}
          <tr>
            <td>{w.name}</td>
            <td>{masteryLabel(lv)}</td>
            <td>{weaponSkillBonusPct(lv) > 0 ? `+${weaponSkillBonusPct(lv).toFixed(1)}%` : '—'}</td>
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
    </div>
    {/if}
    </div>
  </Panel>
{/if}

{#if panel === 'tree'}
  <Panel title="Passive tree" subtitle={`${treePointsFree(gameState)} banked · ${treePointsSpent(gameState)} spent`} width="wide" gridArea={modalGridArea} onclose={closePanel}>
    <PassiveTreeBoard
      nodes={tree.nodes}
      graph={tree.graph}
      state={gameState}
      selectedId={selectedTreeNodeId}
      verdict={selectedTreeVerdict}
      onselect={(id) => (selectedTreeNodeId = id)}
      onbuy={() => doSpendTree(selectedTreeNodeId)}
    />
  </Panel>
{/if}

{#if panel === 'town'}
  <Panel title="Town" subtitle={`${town?.name ?? 'the field'} · ${townLive ? 'standing here' : 'not standing here'}`} width="wide" gridArea={modalGridArea} onclose={closePanel}>
    <TownHub state={gameState} town={town} here={townLive} {tabs}
             onopen={(id) => openPanel(id as PanelId)} onwarp={travelTo} onsellall={doSell}
             onbest={doBestEquip}
             onstashall={() => doDepositAll(stashTab)} />
  </Panel>
{/if}

{#if panel === 'market'}
  <Panel title="Market" subtitle={`${town?.name ?? ''} · the stall, the Counterhand and the purse`} width="wide" gridArea={modalGridArea} onclose={closePanel}>
    <Market state={gameState} town={town} here={townLive} onbuy={doBuy} onsell={doSell} />
  </Panel>
{/if}

{#if panel === 'keys'}
  <Panel title="Keyboard" subtitle={`${KEYBINDS.length} actions, all rebound here`} width="wide" gridArea={modalGridArea} onclose={closePanel}>
    <KeybindTable binds={binds} onset={setBind} onreset={resetBinds} onclear={clearBind} />
  </Panel>
{/if}

{#if panel === 'camp'}
  <Panel title="Field Camp" subtitle={`${fieldworkSite ? fieldworkSite.replace(/^./, (letter) => letter.toUpperCase()) : 'Field'} · ${fieldCampHere ? 'safe at Camp' : 'set up away from town'}`} width="wide" gridArea={modalGridArea} onclose={closePanel}>
    <FieldworkBoard
      state={gameState}
      site={fieldworkSite}
      cellName={fieldCellName}
      campName={fieldCampName}
      campHere={fieldCampHere}
      busy={fieldworkBusy}
      inTown={townLive}
      oncamp={doEstablishCamp}
      onstart={doStartFieldAction}
      onstop={doStopFieldAction}
      onhunt={doLeaveCamp}
      onrest={doReturnCamp}
      oncook={doCookMeal}
      oneat={doEatMeal}
      onauto={(patch) => updateAutoEat(patch)}
    />
  </Panel>
{/if}

{#if panel === 'farm'}
  <Panel title="Farm" subtitle={farmSub} width="wide" gridArea={modalGridArea} onclose={closePanel}>
    <div class="farm-panel">
    <p><small>{gameState.farm.xp} Farm XP · {farm.xpPerHarvest} per harvest · {farm.F.growth_hours} h a cycle · {farm.plotsMax} plots at most ({plots} yours).</small></p>
    <div class="farm-tabs" role="tablist" aria-label="Farm sections">
      <button role="tab" class:active={farmTab === 'plots'} aria-selected={farmTab === 'plots'} onclick={() => (farmTab = 'plots')}>Plots & herbs</button>
      <button role="tab" class:active={farmTab === 'alchemy'} aria-selected={farmTab === 'alchemy'} onclick={() => (farmTab = 'alchemy')}>Alchemy</button>
      <button role="tab" class:active={farmTab === 'automation'} aria-selected={farmTab === 'automation'} onclick={() => (farmTab = 'automation')}>Auto use</button>
    </div>

    {#if farmTab === 'plots'}
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
    {/if}

    {#if farmTab === 'alchemy'}
    <h3>Alchemy</h3>
    <table>
      <thead><tr><th>Draught</th><th>Effect</th><th>Cost</th><th>Held</th><th></th></tr></thead>
      <tbody>
        {#each farm.P.list as p}
          {@const cost = farm.craftCost(p.tier)}
          <tr>
            <td>{p.name}</td>
            <td>Instant {farm.potionEffect(p)}% Max {p.pool === 'hp' ? 'HP' : 'Mana'}</td>
            <td>{cost.herbs} {p.tier} herbs + {cost.reroll_value_stones} Value stone(s)</td>
            <td>{gameState.farm.potions[p.name] || 0}{gameState.farm.condensed[p.name] ? ` (+${gameState.farm.condensed[p.name]} condensed)` : ''}</td>
            <td>
              <button onclick={() => doBrew(p.name)}>brew</button>
              <button onclick={() => doCondense(p.name)} disabled={(gameState.farm.potions[p.name] || 0) < farm.P.condensed.cost_bottles}>condense</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {/if}

    {#if farmTab === 'automation'}
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
    {/if}
    {#if farmNote}<p class="farm-note" role="status">{farmNote}</p>{/if}
    </div>
  </Panel>
{/if}

{#if panel === 'desk'}
  <Panel title="Settlement" subtitle={deskSub} width="wide" gridArea={modalGridArea} onclose={closePanel}>
    <div class="desk-panel">
    <div class="desk-tabs" role="tablist" aria-label="Settlement sections">
      <button role="tab" class:active={deskTab === 'services'} aria-selected={deskTab === 'services'} onclick={() => (deskTab = 'services')}>Services</button>
      <button role="tab" class:active={deskTab === 'stall'} aria-selected={deskTab === 'stall'} onclick={() => (deskTab = 'stall')}>Stall</button>
      <button role="tab" class:active={deskTab === 'guild'} aria-selected={deskTab === 'guild'} onclick={() => (deskTab = 'guild')}>Guild & Collector</button>
      <button role="tab" class:active={deskTab === 'hunt'} aria-selected={deskTab === 'hunt'} onclick={() => (deskTab = 'hunt')}>Hunt</button>
      <button role="tab" class:active={deskTab === 'walk'} aria-selected={deskTab === 'walk'} onclick={() => (deskTab = 'walk')}>Walk</button>
    </div>
    <div class="desk-content">

    {#if viewTown}
      <h3>{viewTown.name} · settlement{viewHere ? '' : ' — read only, you are standing in ' + (town ? town.name : 'the field')}</h3>
      <p><small>Innate Element {viewTown.innate.join(' / ')} · Base bias flavour {viewTown.base_bias_flavor} · NPCs here: {viewTown.npcs.map((n: string) => npcOf(n)?.name ?? n).join(' · ')}</small></p>
      {#if !viewHere}
        <p><small>Walk or warp to {viewTown.name} — this section is live only where the character stands.</small></p>
      {/if}

      <div class="fold">
      {#if deskTab === 'services'}
      <h4>Counterhand · the gold mint</h4>
      <p>Gold {gameState.counters.gold.toFixed(1)} · junk unsold {junkTotal} ({junkLines.join(' · ') || 'none'}) · stones {stonesLine()}</p>
      <button onclick={doSell} disabled={!viewHere || junkTotal === 0}>Sell all junk here</button>
      <p><small>Junk sells for the gold its own rung prices, and selling it is the only thing that mints gold — walking pays a drop roll and nothing else. Rejected gear dissolved for Value stones instead — the two media never mix.</small></p>

      <h4>Respec · free</h4>
      <p><small>Hand every allocated stat point back and re-spend them — free, and only in a settlement.</small></p>
      <button onclick={respec} disabled={!viewHere || !STATS.some((k) => gameState.player.points[k])}>Respec — refund all stat points</button>
      <button onclick={doRespecTree} disabled={!viewHere || !treePointsSpent(gameState)}>Respec the tree — refund {treePointsSpent(gameState)} point{treePointsSpent(gameState) === 1 ? '' : 's'}</button>

      <h4>Standing</h4>
      <p>Tier {standingTier(gameState, viewTown.id)} / {TOWN.standing.tiers.length} · {(standingShare(gameState, viewTown.id) * 100).toFixed(1)}% of the {eng.SETTLEMENT_BUDGET_KILLS[viewTown.zone].toLocaleString('en-US')} kills in zone {viewTown.zone} that Tier I asks for. Standing buys stock lines, set slots and cosmetics — never a stat, a Mod, a stone or anything mob_HP reads.</p>
      {/if}

      {#if deskTab === 'stall'}
      <h4>Stall stock</h4>
      <table>
        <thead><tr><th>Line</th><th>NPC</th><th>Kind</th><th>Minutes of income</th><th>Gold</th><th></th></tr></thead>
        <tbody>
          {#each viewStock as row}
            {@const check = canBuy(gameState, viewTown.id, row.id)}
            <tr>
              <td>{row.item}</td>
              <td>{npcOf(row.npc)?.name ?? row.npc}</td>
              <td>{row.kind}</td>
              <td>{priceMinutes(row, viewTown.id, gameState)} m{row.charge_band ? ` @ ${row.charge_band}` : ''}</td>
              <td>{priceGold(row, viewTown.id, gameState)}</td>
              <td>{#if viewHere}<button onclick={() => doBuy(row.id)} disabled={!check.ok}>{check.ok ? 'buy' : check.why}</button>{:else}<span class="dim">elsewhere</span>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if viewHere}
        <p><small>Curio pedlar — today's rolled prices {gameState.pedlar.minutes.join(' / ')} minutes, {gameState.pedlar.bought} of {gameState.pedlar.minutes.length} bought; restocks at the next game day.</small></p>
      {/if}
      {/if}

      {#if deskTab === 'guild'}
      {#if viewHere}
        <h4>Guild board · {gameState.town.tasks.length} slots</h4>
        <table>
          <thead><tr><th>#</th><th>Task</th><th>Zone</th><th>Progress</th><th>Reward</th><th></th></tr></thead>
          <tbody>
            {#each gameState.town.tasks as t, i}
              <tr>
                <td>{i + 1}</td>
                <td>{t ? `${t.kind} ×${t.n}` : 'refills in ' + (() => { const s = Math.max(0, gameState.town.refillAt[i] - gameState.clockSec); return s >= 3600 ? (s / 3600).toFixed(1) + 'h' : s >= 60 ? Math.round(s / 60) + 'm' : Math.round(s) + 's'; })()}</td>
                <td>{t ? eng.zoneById(t.zone).name : ''}</td>
                <td>{t ? `${t.progress} / ${t.n}` : ''}</td>
                <td>{t ? (t.alt ? `${t.count} ${t.stone} or ${t.alt.count} ${t.alt.stone}` : `${t.count} ${t.stone} stone`) : ''}</td>
                <td>{#if t}
                  {#if t.alt}
                    <button disabled={t.progress < t.n} onclick={() => doClaim(i, t.stone)}>{t.stone}</button>
                    <button disabled={t.progress < t.n} onclick={() => doClaim(i, t.alt!.stone)}>{t.alt.stone}</button>
                  {:else}
                    <button disabled={t.progress < t.n} onclick={() => doClaim(i)}>claim</button>
                  {/if}
                {/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p><small>Payouts are stones only, sized at {TOWN.task_sizing.reward_minutes_of_band_income} minutes of that band's own stone income.</small></p>
      {/if}

      {#if viewColSet}
        <h4>Collector · {viewColSet.name} ({viewColSet.school} school)</h4>
        <p><small>{gameState.collector.done[viewColSet.id]
          ? 'Turned in · the pieces are gone and the reward is yours.'
          : setUnlocked(gameState, viewColSet)
            ? 'Tier II standing here has opened the set slots.'
            : `Tier II standing in ${viewColSet.settlement} opens the set slots — ${TOWN.standing.tiers[1].share * 100}% of this zone's kill budget.`}</small></p>
        <table>
          <thead><tr><th>Piece</th><th>Slot</th><th>Held</th><th>Quality asked</th></tr></thead>
          <tbody>
            {#each viewColSet.parsed as p}
              <tr>
                <td>{p.name}</td><td>{p.slot}</td>
                <td>{heldCount(gameState, viewColSet.id, p.name)} / 1</td>
                <td>{viewColSet.quality}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if !gameState.collector.done[viewColSet.id]}
          <p><small>Still hunting: {viewColSet.parsed.filter((p: any) => heldCount(gameState, viewColSet.id, p.name) === 0).map((p: any) => `${p.name} (${p.slot})`).join(' · ') || 'every piece is in hand — turn it in.'} Frames roll even-weighted across the whole world, so the target is the {viewColSet.quality} quality and the {viewColSet.school} school, not one zone.</small></p>
        {/if}
        {#if viewHere}
          <button onclick={doTurnIn} disabled={!setUnlocked(gameState, viewColSet) || gameState.collector.done[viewColSet.id]}>turn in the set</button>
        {/if}
        <p><small>Reward: {viewColSet.reward} · {viewColSet.rule} · the Collector pays no gold and no Mod anywhere (T14).</small></p>
      {/if}

      {#if viewHere && (gameState.grants.filter_presets || gameState.grants.titles.length || gameState.grants.banners.length)}
        <h4>Collector grants</h4>
        <p><small>{gameState.grants.filter_presets} extra filter preset{gameState.grants.filter_presets === 1 ? '' : 's'} · {stashTabCount(gameState)} stash tabs{gameState.grants.titles.length ? ` · titles: ${gameState.grants.titles.join(', ')}` : ''}{gameState.grants.banners.length ? ` · banners: ${gameState.grants.banners.join(', ')}` : ''}.</small></p>
      {/if}
      {/if}
      </div>
    {/if}

    {#if deskTab === 'hunt'}
    <h3>Hunt · {E.mob.zones.length} zones, one per settlement</h3>
    <p><small>Zones open when you reach their settlement; mobs scale to your level within the listed band.</small></p>
    <table class="picklist">
      <thead><tr><th>Zone</th><th>Levels</th><th>mob_HP</th><th>Quality</th><th>Elements</th><th>Group</th><th>Sub-zones</th><th></th></tr></thead>
      <tbody>
        {#each E.mob.zones as z}
          {@const home = settlementOfZone(z.id)?.id}
          {@const opened = !!home && gameState.town.visited.includes(home)}
          <tr class:picked={!!home && picked === home} onclick={() => home && select(home)}>
            <td>{z.id} · {z.name}</td>
            <td>{z.levels.join('-')}</td>
            <td>{z.hp.join(' → ')}</td>
            <td>{z.quality}</td>
            <td>{z.elements.join(', ')}</td>
            <td>{z.group}</td>
            <td>{(z.subzones || []).map((s: any) => s.name).join(' · ')}</td>
            <td><button onclick={(e) => { e.stopPropagation(); goToZone(z.id); }} disabled={z.id === gameState.zone || !opened}>
              {z.id === gameState.zone ? 'here' : opened ? 'hunt' : 'walk first'}
            </button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    {/if}

    {#if deskTab === 'walk'}
    <h3>Walk · {E.road.block_sec}s a block · {gameState.town.visited.length} of {TOWN.settlements.length} Waypoints opened</h3>
    <p><small>Walk between settlements to open their Waypoints once; later warps are instant and priced by the destination's band.</small></p>

    <table class="picklist">
      <thead><tr><th>Settlement</th><th>Zone</th><th>Blocks</th><th>Time</th><th>Warp</th><th></th></tr></thead>
      <tbody>
        {#each TOWN.settlements.filter((x: any) => x.id !== townId) as s}
          {@const dest = settlementCell(s.id)}
          {@const blocks = dest ? cellBlocks(gameState, dest) : walkBlocks(townId, s.id)}
          {@const fare = warpPrice(s.id)}
          <tr class:picked={picked === s.id} onclick={() => select(s.id)}>
            <td>{s.name}</td><td>{s.zone}</td>
            <td>{blocks}</td>
            <td>{dest ? cellSec(gameState, dest) : road.secBetween(townId, s.id)}s</td>
            <td>{canTravel(gameState, s.id) ? `${fare} gold` : '—'}</td>
            <td>
              <button onclick={(e) => { e.stopPropagation(); dest && doWalk(dest); }} disabled={!!gameState.walk}>{gameState.walk?.node === s.id ? 'walking' : 'walk'}</button>
              {#if canTravel(gameState, s.id)}<button onclick={(e) => { e.stopPropagation(); travelTo(s.id); }} disabled={gameState.counters.gold < fare} title={gameState.counters.gold < fare ? `needs ${fare} gold` : `warp for ${fare} gold`}>waypoint</button>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {/if}
    </div>
    </div>
  </Panel>
{/if}

{#if panel === 'save'}
  <Panel title="Save" subtitle="local only" width="wide" gridArea={modalGridArea} onclose={closePanel}>
    <div class="save-panel">
    <div class="save-tabs" role="tablist" aria-label="Save sections">
      <button role="tab" class:active={saveTab === 'slots'} aria-selected={saveTab === 'slots'} onclick={() => (saveTab = 'slots')}>Slots</button>
      <button role="tab" class:active={saveTab === 'backups'} aria-selected={saveTab === 'backups'} onclick={() => { saveTab = 'backups'; loadSnaps(); }}>Backups</button>
      <button role="tab" class:active={saveTab === 'settings'} aria-selected={saveTab === 'settings'} onclick={() => (saveTab = 'settings')}>Settings</button>
    </div>
    {#if saveTab === 'slots'}
    <p>Three local character slots · away time catches up to {E.inventory.offline_cap_hr} hours.</p>
    <div class="save-actions">
    {#each saveSlots as slot}
      <button onclick={() => doSave(slot)}>Save {slot}</button>
      <button onclick={() => doLoad(slot)}>Load {slot}</button>
    {/each}
    <button onclick={download}>Export JSON</button>
    <label>Import <input type="file" accept="application/json" onchange={upload} /></label>
    </div>
    {#if saveNote}<p class="save-note-inline" role="status">{saveNote}</p>{/if}
    {:else if saveTab === 'backups'}
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
    {:else}
    <h2>Settings</h2>
    <p><small>Shared by all three slots. The field controls auto skills and best-gear equip; potions and auto-farm are on Farm, filters on Bags, and presets on Skills.</small></p>
    <label>Number format
      <select value={settings.numberFormat} onchange={(e) => setSetting('numberFormat', (e.target as HTMLSelectElement).value as 'plain' | 'short')}>
        <option value="plain">plain — 12,345</option>
        <option value="short">short — 12.3k</option>
      </select>
    </label>
    <label><input type="checkbox" checked={settings.offlineReport} onchange={(e) => setSetting('offlineReport', (e.target as HTMLInputElement).checked)} /> Show the welcome-back report after an away period</label>
    <label>Auto-dissolve drops below item level
      <input type="number" min="0" step="1" value={gameState.autoDissolveLevel ?? 0}
        onchange={(e) => { gameState.autoDissolveLevel = Math.max(0, Number((e.target as HTMLInputElement).value) || 0); gameState = { ...gameState }; }} />
      <small>{' '}— a piece under the floor turns into Reroll stones instead; zero keeps every drop for a decision</small>
    </label>
    <p><small>Auto-dissolve turns a piece into Reroll stones, never gold — the Counterhand is still the only place junk becomes gold. A locked or Collector-held piece is spared.</small></p>
    {/if}
    </div>
  </Panel>
{/if}

<style>
  button.active { border-color: var(--gold); color: var(--gold); }
  /* the map: layout only — the field is inlined via {@html}, so its own styling lives in styles/map.css */
  /* the field's background is the map itself, and it is a surface you travel on: scaled past its own
     frame so no band of empty gradient shows at an edge, and kept out of focus until the pointer
     reaches for it or the MAP tab brings it into focus. */
  .map-back {
    position: absolute; inset: 0; overflow: hidden; cursor: crosshair;
    /* the depth-of-field ladder, read off the one `--dof` the client owns: this surface is soft at rest
       and sharpens as attention reaches it, rather than each state inventing its own filter */
    --dof: var(--dof-rest);
    /* the two tints the rest state carries, as dials rather than a written-out filter: the filter itself is
       declared once, on the node that actually moves, and a state only changes the dials it inherits */
    --map-lift: .92;
    --map-sat: .85;
    /* the dim is the recede, so it follows the ladder's step rather than the pixel count: a lighter blur
       keeps the ground legible and keeps the sheet sitting behind the plates the way it did before */
    opacity: calc(1 - var(--dof) / 12);
    /* the map frame still fades only at the bottom for HUD legibility; the terrain seam is feathered
       on the finite cell layer itself so the endless ground remains full-strength at viewport edges */
    mask-image: linear-gradient(180deg, #000 0 62%, rgba(0, 0, 0, .5));
    -webkit-mask-image: linear-gradient(180deg, #000 0 62%, rgba(0, 0, 0, .5));
    /* the frame never moves: the pan and the zoom are written onto the ground inside it, so the edges,
       the mask and the letterbox stay where the player last saw them */
    transition: opacity .22s ease;
    touch-action: none;
    /* a drag pans this surface, so it must never start a text selection instead — the sheet's own labels
       are already inert, but the rectangle they sit in was not */
    user-select: none; -webkit-user-select: none;
  }
  /* the map stays clear around the player's attention and falls into the scene's own ground at the
     four screen corners; the frame is fixed while the sheet pans beneath it, like a viewing lens */
  .map-back::after {
    content: '';
    position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background: radial-gradient(ellipse 76% 68% at 50% 48%, transparent 67%,
      color-mix(in srgb, var(--ground) 30%, transparent) 78%,
      color-mix(in srgb, var(--ground) 84%, transparent) 100%);
  }
  /* the ground itself, moved and scaled inside the frame — it scales from the same point the frame
     reads as its middle, so a cell under a click never moves when the view is reframed */
  .map-sheet {
    position: absolute; inset: 0;
    transform-origin: 50% 46%;
    transition: transform .18s ease;
    /* The soft focus rides the node that is actually moved. Declared on the frame instead, every pan frame
       re-blurred the whole sheet through the frame's mask — measured at 30ms a frame against 8ms at rest,
       which is a stuttering map. On its own layer the blur is painted once and the pan is a transform. */
    filter: blur(var(--dof)) brightness(var(--map-lift)) saturate(var(--map-sat));
    /* the sheet is the one surface in the client that is moved under the hand, so it keeps its own layer
       rather than paying for a fresh raster the moment the pan crosses it */
    will-change: transform;
  }
  /* while the hand is on the sheet the pan follows it instead of easing after it */
  .map-back.dragging .map-sheet { transition: none; }
  /* Mouse movement leaves the resting blur in place; keyboard focus can still sharpen the sheet. */
  .map-back:focus-visible { --dof: 1.5px; --map-lift: 1; --map-sat: .95; opacity: .92; }
  /* the ring a focused surface wears is drawn on the frame, not on the ground inside it — the ground is
     scaled and can leave the frame, and a ring that drifted off the map would read as a different state.
     The frame fills the stage, so the ring is pulled inward: the global rule reads `--ring-offset`. */
  .map-back:focus-visible { --ring-offset: -2px; }
  /* map focus: the ground the field stands on is brought out from under the HUD — same scale, so the
     cell under a click never moves — and the mob field is taken off the screen rather than left as a
     faint ghost over the map. The fight runs on behind it; only the reading changes. A drag pans the
     sheet here, so the hand is open until it closes on the ground. */
  .stage.mapmode .map-back { --dof: 0px; --map-lift: 1; --map-sat: 1; opacity: 1; cursor: grab; }
  /* while the hand is on the sheet the pan follows it instead of easing after it */
  .map-back.dragging { cursor: grabbing; transition: opacity .22s ease, filter .22s ease; }
  .stage.mapmode .field { display: none; }
  /* Keep the minimap visible as a persistent location reference, including while the full map is open. */
  /* the sheet is the subject in map focus, so the field's own reads leave the frame rather than sitting
     on top of a sharp map: a zone label and a travel switch cannot share the same square, and the map is
     the one thing the player is looking at. The purse stays — it costs nothing to read and a walk needs it. */
  .stage.mapmode .tracker { display: none; }
  .stage.mapmode .targetbar { display: none; }
  /* a working screen is the subject, so the field behind it recedes the way the ground recedes from the
     map: one ladder, one direction — the veil does the dimming and the field does the blurring */
  .stage.veiled { --dof: var(--dof-far); }
  .stage.veiled .field, .stage.veiled .tracker, .stage.veiled .actionbar, .stage.veiled .targetbar {
    filter: blur(2.5px); opacity: .5; transition: filter .18s ease, opacity .18s ease;
  }
  .stage.veiled .map-back { --dof: var(--dof-rest); }
  /* the sheet's own controls: the three views, the gate level, the two overlays — and the key under it */
  .map-tools { display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-xs); width: 100%; padding-bottom: var(--spacing-xs); border-bottom: 1px solid var(--edge); font-size: var(--font-xs); }
  .map-reference { position: relative; display: flex; justify-content: flex-start; width: 100%; }
  .map-reference :global(.mini-map) { flex: none; }
  .map-guide { position: relative; z-index: 2; display: grid; justify-items: start; gap: var(--spacing-xs); width: fit-content; padding: var(--spacing-xs); color: var(--text); background: var(--hud-face); border: 1px solid var(--hud-edge); border-radius: var(--spacing-sm); box-shadow: 0 6px 18px rgba(0, 0, 0, .55); backdrop-filter: blur(8px); }
  .map-guide:not(.open) { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-3xs); padding: 0; background: none; border: 0; border-radius: 0; box-shadow: none; backdrop-filter: none; }
  .map-guide.open { width: clamp(188px, 14.52vw, 405px); }
  .map-hint { margin: 0; max-width: 100%; line-height: 1.3; }
  .map-help-toggle { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-3xs); padding: 0; color: var(--dim); background: none; border: 0; border-radius: 0; font-size: var(--font-xs); }
  .map-help-toggle:hover { color: var(--text); }
  .map-views { display: flex; flex-wrap: wrap; gap: var(--spacing-xs) var(--spacing-sm); width: 100%; }
  .map-views label, .map-tools label { display: inline-flex; align-items: center; gap: var(--spacing-2xs); white-space: nowrap; }
  .map-level input[type=range] { width: var(--box-160); }
  /* the sheet's hand: zoom the frame scales about, and the two ways back to the ground you stand on */
  .map-zoom { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-2xs); width: 100%; }
  .map-zoom button { padding: var(--spacing-2xs) var(--spacing-xs); font-size: var(--font-xs); min-width: var(--icon-lg); line-height: 1.2; }
  .map-zoom b { font-family: var(--num); font-size: var(--font-xs); font-weight: 500; color: var(--dim); min-width: var(--icon-lg); text-align: center; }
  .map-legend { display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-2xs); font-size: var(--font-xs); color: var(--dim); }
  .map-legend .swatch { display: inline-flex; align-items: center; gap: var(--spacing-2xs); }
  .map-legend .swatch i { width: var(--icon-xs); height: var(--icon-xs); border: 1px solid var(--line); border-radius: 2px; }
  .map-legend .ramp i { width: var(--box-100); }
  /* where the field's own destination card sits: anchored to the cell it speaks for, placed by the
     effect that measures the pick (DECISIONS.md §Interface — a floating card is placed by the box it measures, never
     by the box it expects). The bottom-centre rule below is only the first frame's fallback, before
     that measure lands. The card itself is ui/TravelCard.svelte, shared with the MAP sub-screen */
  .mapcard {
    position: fixed; left: 50%; bottom: clamp(58px, 4.45vw, 124px); transform: translateX(-50%);
    width: min(var(--box-560), 52%); z-index: 4;
  }
  .picklist tr { cursor: pointer; }
  .picklist tr.picked { background: var(--panel); }

  /* ── the frame ───────────────────────────────────────────────────────────────────────────────
     The map remains full-bleed behind the HUD. The 15 × 15 named grid gives stable regions to the
     field, menu, target, objectives, automation controls, action row, game controls and chronicle. */
  .stage {
    position: fixed;
    inset: 0;
    overflow: hidden;
    /* the menu bar's own height band: every top-centre read hangs below it */
    --rail-h: clamp(52px, 3.29vw, 66px);
    /* the control dock's floor band: pickups clear its buttons */
    --controls-h: calc(var(--rail) + var(--spacing-sm));
    /* Row one belongs to the target. A notice takes row two, and the field yields a row while it is up. */
    --band-toast: clamp(32px, 4.14vw, 132px);
    --band-note: clamp(64px, 7.89vw, 264px);
    background:
      radial-gradient(120% 85% at 50% 115%, color-mix(in srgb, var(--glow-moss) 30%, transparent), transparent 62%),
      radial-gradient(95% 70% at 50% -12%, color-mix(in srgb, var(--glow-dusk) 32%, transparent), transparent 64%),
      linear-gradient(180deg, var(--ground) 0%, var(--ground-2) 45%, var(--ground-3) 100%);
  }
  /* the frame darkens toward its own edges, so the reads sit on a lit middle the way they do on a
     phone screen — the vignette is under every cluster and takes no clicks */
  .stage::after {
    content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background: radial-gradient(115% 95% at 50% 48%, transparent 52%, rgba(0, 0, 0, .55));
  }
  .tracker, .field { z-index: 2; }
  /* A report occupies row two; with its paired save note in row three, the field yields both rows. */
  .stage:has(.toast) .field { grid-row-start: 5; }
  .stage:not(:has(.toast)) .save-note { top: var(--band-toast); }
  /* the away report owns the band's second row, under the fight's own headline */
  .toast {
    position: absolute; top: var(--band-toast); left: 50%; transform: translateX(-50%); z-index: 6;
    display: flex; flex-wrap: wrap; gap: var(--spacing-2xs) var(--spacing-sm); align-items: baseline; max-width: min(var(--box-920), 62%);
    border: 1px solid color-mix(in srgb, var(--gold) 38%, transparent); border-radius: 10px; padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-xs);
    background: var(--glass); box-shadow: 0 10px 30px rgba(0, 0, 0, .5);
  }
  .toast .quit { background: none; border: none; padding: 0; color: var(--dim); }

  /* right-edge overlays: contextual reads appear here only while their screen is open. */
  .dock {
    z-index: 3;
    display: flex; flex-direction: column; align-items: flex-end; gap: var(--spacing-xs);
    pointer-events: none;
  }
  .pop::before, .pop::after {
    content: ''; position: absolute; width: clamp(8px, 0.63vw, 16px); height: clamp(8px, 0.63vw, 16px); pointer-events: none;
    border: 2px solid color-mix(in srgb, var(--gold) 62%, transparent);
  }
  .pop::before { top: -2px; left: -2px; border-right: 0; border-bottom: 0; }
  .pop::after { bottom: -2px; right: -2px; border-left: 0; border-top: 0; }

  /* contextual overlays sit over the field — a veil is for a screen you work in, and these are reads
     you take mid-fight */
  .pop {
    pointer-events: auto; flex: 0 1 auto; align-self: stretch; min-height: 0; max-height: clamp(320px, 42vw, 900px);
    position: relative;
    display: flex; flex-direction: column;
    border: 1px solid var(--hud-edge); border-radius: clamp(8px, 0.58vw, 14px);
    background: var(--hud-face);
    box-shadow: 0 14px 40px rgba(0, 0, 0, .6); backdrop-filter: blur(8px);
    animation: pop .14s ease-out;
  }
  .pop > header {
    display: flex; align-items: baseline; gap: var(--spacing-sm); padding: var(--spacing-xs) var(--spacing-sm) var(--spacing-xs);
    border-bottom: 1px solid color-mix(in srgb, var(--gold) 26%, var(--edge)); border-radius: clamp(8px, 0.58vw, 14px) clamp(8px, 0.58vw, 14px) 0 0;
    background: linear-gradient(180deg, color-mix(in srgb, var(--gold) 14%, transparent), transparent);
  }
  .pop > header h3 { margin: 0; flex: none; color: var(--gold); font-size: var(--font-xs); letter-spacing: clamp(2px, 0.10vw, 3px); text-transform: uppercase; }
  .pop .quit {
    margin-left: auto; width: var(--icon-md); height: var(--icon-md); padding: 0; line-height: 1;
    background: none; border: 1px solid var(--edge); color: var(--dim);
  }
  .pop .quit:hover { color: var(--text); border-color: var(--gold); }
  .pop-body { padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm); overflow: hidden; min-height: 0; }
  .pop-body p { margin: var(--spacing-2xs) 0; font-size: var(--font-xs); }
  @keyframes pop { from { transform: translateY(var(--x-pull-note)); opacity: .3; } to { transform: none; opacity: 1; } }

  /* the save note reads at the top where the eye already checks announcements */
  .pill {
    display: inline-flex; align-items: center; gap: var(--spacing-2xs); padding: var(--spacing-2xs) var(--spacing-sm); border-radius: 999px;
    background: var(--glass); border: 1px solid var(--edge); font-size: var(--font-xs);
    font-variant-numeric: tabular-nums; backdrop-filter: blur(6px);
  }
  .pill.note { color: var(--good); }
  /* the save note reads at the top where the eye already checks announcements, never in the purses.
     It owns the band's third and last row; the width cap keeps a long `why` on the note's own line
     rather than folding it down into the plates' ceiling */
  .save-note {
    position: absolute; top: var(--band-note); left: 50%; transform: translateX(-50%); z-index: 7;
    max-width: min(var(--box-680), 86%);
  }

  /* left edge under the portrait: where the character stands, whether it moves on, what it aims at —
     slim masked lines for legibility over the field, never a glass card; long lines clamp to two */
  .tracker {
    /* the quest stack under the minimap, in the top-right column: one width, right-aligned with the
       map it serves, its own rows opting back into pointer events the inert column holds off */
    width: var(--objectives-w); pointer-events: auto; z-index: 2;
    display: grid; gap: var(--spacing-2xs); align-content: start; justify-items: stretch;
  }
  .tracker > * {
    margin: 0; padding: var(--spacing-2xs) var(--spacing-xs); border-radius: clamp(5px, 0.39vw, 11px); font-size: var(--font-xs);
    background: linear-gradient(90deg, rgba(0, 0, 0, .66), rgba(0, 0, 0, .38) 78%, transparent);
  }
  .tracker .phase {
    color: var(--gold-lit); text-transform: uppercase;
    letter-spacing: clamp(1px, 0.05vw, 2px);
    box-shadow: inset 2px 0 0 var(--gold);
  }
  .hunger-read { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--spacing-3xs) var(--spacing-xs); color: var(--dim); }
  .hunger-read b { color: var(--gold-lit); font-family: var(--num); font-weight: 600; }
  .hunger-read i { grid-column: 1 / -1; display: block; height: 3px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--text) 16%, transparent); }
  .hunger-read i em { display: block; height: 100%; background: var(--gold); transition: width .25s ease; }
  .hunger-read.empty b { color: var(--alarm); }
  .hunger-read.empty i em { background: var(--alarm); }
  .tracker .phase, .tracker .objective, .tracker .alarm-line {
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical;
  }
  .alarm-line { color: var(--alarm); }
  .objective { color: var(--gold); }

  /* the middle of the frame is the group: one plate per mob, its HP the loudest thing on it.
     The box hugs the frame's true middle: a slim left band for the objectives, a right gutter the
     orb arc owns, a top edge under the portrait, and a floor the self-plate's band sits on — the
     HUD floats over the field, so the field gives ground to it, not the other way round. */
  .field {
    min-width: 0; min-height: 0;
    display: flex; flex-wrap: wrap; align-content: flex-start; justify-content: center; gap: var(--spacing-md);
    overflow: visible;
    /* one knob for every card on the field: mob plates and the player's own share it, so the two
       are always the same size at every window. The near band follows it — a 5:7 playing-card face plus a breath. */
    --card-w: var(--field-card-size);
    --plate-h: calc(var(--card-w) * 7 / 5);
    /* the near band the character's own card stands in, reserved as layout rather than guessed: flex lines
       centre inside the content box, so this takes the band out of the group's room at every size, and an
       absolutely positioned child resolves against the padding box, so the card lands inside it */
    padding-bottom: calc(var(--plate-h) + var(--spacing-xl));
    /* the mob field is a layout box, not a surface: it spans the middle of the map, so the ground
       between two plates has to pass its click down to the cell underneath. The plates stay live */
    pointer-events: none;
    /* the field recedes on the one ladder as well: sharp at rest, pulled back when a settlement owns
       the screen — `--dof` is the only dial, the same one the ground reads */
    --dof: 0px;
    filter: blur(var(--dof));
    opacity: calc(1 - var(--dof) / 10);
  }
  /* the empty field is a read, not a target: it states why nothing stands here and what would change it,
     and it never takes a click meant for the ground underneath */
  .clear-field {
    display: grid; gap: var(--spacing-3xs); justify-items: center; text-align: center; pointer-events: none;
    color: var(--dim); font-size: var(--font-xs);
  }
  /* The ramp is stretched over the whole track instead of squeezed into the fill: `--w` is the fraction the
     bar reached, so a body's last health shows the hot end of its own colour. The slide is the sim's own
     step carried between the two seconds it lands in. */
  .target-hp i {
    background-size: calc(100% / max(var(--w, 1), .001)) 100%;
  }

  /* bottom-centre: the cast order as a row of equal orbs, one per slot, and the press that opens the
     Skills screen trailing the row. Read-only on the field. */
  .actionbar {
    /* full width with the row centred in it: anchoring at left:50% would cap the row's available width
       at half the viewport, wrapping a full bar of orbs onto a second line */
    z-index: 4;
    display: flex; justify-content: center;
    /* one size for every slot, the same for the settings press that ends the row, so the row reads as
       one rank rather than a descending scale */
    /* the slots sit over the map now, which is dark ground in the game's own colours — so their rim is
       read off this one pair rather than the faint plate edge the other reads use */
    --slot-face: rgba(12, 16, 22, .82);
    --slot-edge: rgba(255, 255, 255, .5);
  }
  .action-cluster { display: flex; align-items: flex-end; gap: var(--spacing-md); }
  .vital-stack { display: flex; flex: none; flex-direction: column; align-items: center; gap: var(--spacing-xs); width: var(--box-160); container-type: inline-size; }
  .orb-readout { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-3xs); width: 100%; color: var(--text); font-family: var(--ui); font-size: clamp(var(--font-xs), 8cqw, var(--font-sm)); font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; text-shadow: 0 1px 3px rgba(0, 0, 0, .95); white-space: nowrap; }
  .orb-readout > span { max-width: 100%; overflow: hidden; }
  .orb-readout strong { font-weight: inherit; }
  .orb-shield { color: var(--es); }
  .orb-reserved { color: var(--dim); }
  /* A worn stone-and-iron shell sits over both liquid pools. Energy Shield veils the Life glass while
     it holds, thinning with the current pool instead of painting a separate ring. */
  .vital-orb {
    position: relative; flex: none; width: var(--box-160); height: var(--box-160); padding: var(--spacing-xs);
    isolation: isolate; border-radius: 50%; background: var(--face-floor); container-type: inline-size;
    box-shadow: 0 4px 14px rgba(0, 0, 0, .7), inset 0 1px 0 rgba(255, 255, 255, .12);
  }
  .vital-orb::after {
    content: ''; position: absolute; inset: 0; z-index: 6; pointer-events: none;
    background: url('./assets/orb-skin.png') center / contain no-repeat;
    -webkit-mask: radial-gradient(circle, transparent 0 58%, var(--text) 70%);
            mask: radial-gradient(circle, transparent 0 58%, var(--text) 70%);
    filter: brightness(1.2) contrast(1.1);
  }
  .orb-well {
    position: absolute; inset: var(--spacing-xs); overflow: hidden; border-radius: 50%;
    background: radial-gradient(circle at 35% 25%, rgba(255, 255, 255, .09), transparent 34%), var(--face-floor);
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, .8);
  }
  .orb-well::before {
    content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none;
    background: url('./assets/orb-skin.png') center / cover no-repeat;
    mix-blend-mode: soft-light; opacity: .8;
  }
  .life-orb .orb-well::after {
    content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none;
    background: linear-gradient(180deg, color-mix(in srgb, var(--es-lit) 78%, transparent), transparent 5%),
                radial-gradient(circle at 35% 20%, color-mix(in srgb, var(--es-lit) 75%, transparent), transparent 66%),
                linear-gradient(145deg, color-mix(in srgb, var(--es) 65%, var(--mana)),
                                          color-mix(in srgb, var(--mana) 70%, var(--face-floor)));
    border-top: 1px solid color-mix(in srgb, var(--es-lit) 78%, transparent);
    opacity: .42; transform: scaleY(var(--shield-strength)); transform-origin: bottom;
  }
  .mana-orb.reserved .orb-well::after {
    content: ''; position: absolute; top: 0; left: 0; right: 0; z-index: 3; pointer-events: none;
    height: var(--reserved); border-bottom: 1px solid color-mix(in srgb, var(--mana-lit) 35%, var(--edge));
    background: linear-gradient(180deg, color-mix(in srgb, var(--face-floor) 92%, var(--dim)),
                                          color-mix(in srgb, var(--face-floor) 70%, var(--mana)));
    opacity: .94;
  }
  .orb-fill {
    position: absolute; inset: 0; z-index: 1; overflow: hidden;
    transform: translateY(calc((1 - var(--fill)) * 100%));
    transition: transform .25s ease-out;
    --liquid-light: var(--hp-lit);
    background: radial-gradient(ellipse at 35% 15%, color-mix(in srgb, var(--hp-lit) 25%, var(--hp)), transparent 64%),
                linear-gradient(180deg, color-mix(in srgb, var(--hp) 70%, var(--bg)), color-mix(in srgb, var(--hp) 35%, var(--bg)));
  }
  .mana-orb .orb-fill {
    --liquid-light: var(--mana-lit);
    background: radial-gradient(ellipse at 35% 15%, color-mix(in srgb, var(--mana-lit) 22%, var(--mana)), transparent 64%),
                linear-gradient(180deg, color-mix(in srgb, var(--mana) 65%, var(--bg)), color-mix(in srgb, var(--mana) 35%, var(--bg)));
  }
  .orb-fill::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 72% 10% at 18% 0%, color-mix(in srgb, var(--liquid-light) 80%, transparent), transparent 85%),
      radial-gradient(ellipse 65% 11% at 80% 2%, color-mix(in srgb, var(--liquid-light) 55%, transparent), transparent 88%),
      linear-gradient(180deg, color-mix(in srgb, var(--liquid-light) 24%, transparent), transparent 13%);
    animation: orb-surface 4.8s ease-in-out infinite alternate;
  }
  .orb-fill::after {
    content: ''; position: absolute; inset: -18% -36%; pointer-events: none;
    background:
      radial-gradient(ellipse 18% 42% at 20% 34%, color-mix(in srgb, var(--liquid-light) 24%, transparent), transparent 95%),
      radial-gradient(ellipse 14% 38% at 68% 70%, color-mix(in srgb, var(--liquid-light) 30%, transparent), transparent 95%),
      radial-gradient(ellipse 30% 13% at 56% 48%, color-mix(in srgb, var(--liquid-light) 17%, transparent), transparent 95%);
    mix-blend-mode: screen;
    animation: orb-current 9s ease-in-out infinite alternate;
  }
  @keyframes orb-surface {
    from { transform: translateX(-8%) scaleY(.85); }
    to { transform: translateX(8%) scaleY(1.15); }
  }
  @keyframes orb-current {
    from { transform: translate(-8%, 5%) rotate(-8deg); }
    to { transform: translate(8%, -5%) rotate(8deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .orb-fill { transition: none; }
    .orb-fill::before, .orb-fill::after { animation: none; }
  }
  .orb-gloss {
    position: absolute; inset: 0; z-index: 4; pointer-events: none;
    background: radial-gradient(ellipse at 36% 18%, rgba(255, 255, 255, .18), transparent 32%),
                linear-gradient(145deg, rgba(255, 255, 255, .06), transparent 45% 65%, rgba(0, 0, 0, .36));
  }
  /* the row runs left to right in slot order: slot 1 leads at the left, the settings press trails. */
  /* Fourteen slots sit in two balanced ranks of seven, with the cap keeping the second rank aligned. */
  .casts {
    display: flex; flex-flow: row wrap; justify-content: center;
    align-items: flex-end; align-content: flex-end; gap: var(--spacing-2xs); max-width: calc(var(--slot-skill-size) * 7 + var(--spacing-2xs) * 6);
  }
  .cast {
    position: relative; width: var(--slot-skill-size); height: var(--slot-skill-size);
    border-radius: 50%; display: grid; place-items: center;
    background:
      radial-gradient(circle at 50% 28%, rgba(255, 255, 255, .1), transparent 56%),
      linear-gradient(180deg, var(--orb-top), var(--orb-floor));
    border: 1px solid rgba(255, 255, 255, .2); backdrop-filter: blur(6px);
    /* a dark separation ring under the lit rim keeps the edge crisp against the pale map behind it */
    box-shadow: 0 0 0 1px rgba(0, 0, 0, .65), 0 3px 10px rgba(0, 0, 0, .5), inset 0 2px 4px rgba(255, 255, 255, .07), inset 0 -6px 12px rgba(0, 0, 0, .5);
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  .cast img { width: var(--icon-lg); height: var(--icon-lg); object-fit: contain; }
  /* an empty slot keeps its size: the arc is the cast order, and it must not jump as skills arrive */
  .cast.empty { opacity: .55; background: none; border-color: rgba(255, 255, 255, .3); box-shadow: none; }
  .cast.ready { border-color: color-mix(in srgb, var(--gold) 68%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--gold) 55%, transparent), 0 0 16px color-mix(in srgb, var(--gold) 34%, transparent), inset 0 2px 4px rgba(255, 255, 255, .08); }
  /* three rows on this bar are not "pressable now", and the gold ring is the client's one word for that,
     so each of them recedes to its own treatment rather than borrowing it: a silenced row keeps no glow
     at all, a conditional row wears the dashed rim that says "waiting on something", and a filler row
     drops to the plate's own faint edge because its place in the order is not what gates it. */
  .cast.silent { opacity: .4; }
  .cast.gated { border-style: dashed; border-color: rgba(255, 255, 255, .45); }
  .cast.filler { border-color: rgba(255, 255, 255, .18); }
  .cast small {
    position: absolute; inset: 0; display: grid; place-items: center; border-radius: 50%;
    background: none; font-size: max(var(--font-xs), calc(var(--slot-skill-size) * .3)); color: var(--gold-lit);
    font-variant-numeric: tabular-nums; text-shadow: 0 1px 3px rgba(0, 0, 0, .95);
  }
  /* the cooling dial: the dark wedge is what is left of the cooldown, sweeping off clockwise from the top */
  .cast .sweep {
    position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
    background: conic-gradient(from -90deg, transparent 0 var(--skill-cooldown-progress), rgba(6, 8, 11, .66) var(--skill-cooldown-progress) 100%);
    transition: --skill-cooldown-progress var(--cooldown-step, 0ms) linear;
  }
  .cast.paused .sweep { transition: none; }
  @media (prefers-reduced-motion: reduce) { .cast .sweep { transition: none; } }
  .cast b { position: absolute; top: clamp(-8px, -0.29vw, -4px); left: clamp(-3px, -0.10vw, -1px); font-size: var(--font-xs); color: var(--dim); }

  /* bottom-right controls are a small row of the same circular menu buttons used across the HUD. */
  .controls-dock {
    z-index: 5;
    display: flex; flex-direction: row; align-items: flex-end; justify-content: flex-end;
    gap: var(--spacing-xs); padding: var(--spacing-2xs);
    background: none; border: 0; border-radius: 0; box-shadow: none;
  }
  .control-tab { min-width: var(--icon-lg); }
  .toggle-ring {
    position: relative; isolation: isolate; flex: none; display: grid; place-items: center;
    width: var(--icon-hub); height: var(--icon-hub); padding: var(--spacing-3xs);
    border: 1px solid var(--hud-edge); border-radius: 50%; background: var(--hud-face); box-sizing: border-box;
  }
  .toggle-ring > img, .toggle-ring > svg {
    position: relative; z-index: 1;
    width: var(--icon-hub-img); height: var(--icon-hub-img); aspect-ratio: 1 / 1;
    padding: 0; border: 0; border-radius: 0; background: none; box-sizing: border-box;
    object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .9));
  }
  .toggle-ring > svg { fill: none; stroke: currentColor; stroke-width: 1.5; }
  .toggle-ring.here { border-color: color-mix(in srgb, var(--gold) 65%, var(--hud-edge)); background: color-mix(in srgb, var(--gold) 12%, var(--hud-face)); }
  .toggle-ring.here::before, .toggle-ring.here::after {
    content: ''; position: absolute; inset: 0; border-radius: inherit;
    pointer-events: none; animation: auto-border-light 1.3s linear infinite;
  }
  .toggle-ring.here::before {
    inset: calc(var(--spacing-xs) * -1); z-index: 2;
    background: conic-gradient(transparent 0deg 240deg, color-mix(in srgb, var(--gold) 26%, transparent) 262deg, color-mix(in srgb, var(--gold-lit) 58%, transparent) 295deg, transparent 332deg);
    mask: radial-gradient(circle closest-side, transparent 70%, #000 80%, transparent 90%);
    filter: drop-shadow(0 0 var(--spacing-sm) color-mix(in srgb, var(--gold) 72%, transparent));
  }
  .toggle-ring.here::after {
    inset: calc(var(--spacing-3xs) * -1); z-index: 3;
    background: conic-gradient(transparent 0deg 270deg, color-mix(in srgb, var(--gold-lit) 55%, transparent) 292deg, #fff 309deg, var(--gold-lit) 318deg, transparent 337deg);
    mask: radial-gradient(circle closest-side, transparent 82%, #000 90%, transparent 100%);
    filter: drop-shadow(0 0 var(--spacing-xs) var(--gold-lit));
  }
  .control-icon { transition: transform .15s ease; }
  .control-icon > svg { stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .control-tab:hover .control-icon { transform: translateY(-1px); }
  .speed-menu { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--spacing-3xs); color: var(--dim); }
  .speed-menu .cap { font-size: var(--font-xs); line-height: 1; text-transform: capitalize; text-shadow: 0 1px 3px rgba(0, 0, 0, .95); }
  .speed-options { display: flex; align-items: center; gap: var(--spacing-3xs); }
  .speed-orb { color: var(--dim); font-size: var(--font-xs); font-variant-numeric: tabular-nums; transition: color .15s ease; }
  .speed-orb:hover { color: var(--text); }
  .speed-orb.here { color: var(--gold-lit); }
  .speed-orb:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  @keyframes auto-border-light { to { transform: rotate(1turn); } }
  @media (prefers-reduced-motion: reduce) {
    .toggle-ring.here::before, .toggle-ring.here::after { animation: none; }
  }
  .field-feed {
    z-index: 5;
    display: flex; align-items: flex-end; gap: var(--spacing-xs);
    pointer-events: none;
  }
  /* top-left hub column: map, location and objective text share the same left reading edge. */
  .topright {
    z-index: 40;
    display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-xs);
    pointer-events: none;
  }
  .topright > * { pointer-events: auto; }
  .toprow { display: flex; gap: var(--spacing-xs); align-items: center; }
  .field-auto-actions {
    position: absolute; top: 50%; right: var(--screen-pad); z-index: 35;
    display: flex; flex-direction: column; align-items: center; gap: var(--spacing-xs);
    transform: translateY(-50%);
  }
  .field-travel-actions {
    grid-area: travel; z-index: 35; width: fit-content; min-width: 0;
    display: flex; flex-direction: column; align-items: center; gap: var(--spacing-xs);
    pointer-events: none;
  }
  .field-travel-actions > * { pointer-events: auto; }
  .field-auto-tab { flex: none; }
  /* the zone plaque names the band first, then the immediate ground and its level range */
  .zone-tag {
    margin: 0; align-self: stretch; display: flex; align-items: center; gap: var(--spacing-2xs); min-width: 0;
    padding: var(--spacing-2xs) var(--spacing-xs); border-radius: var(--spacing-sm);
    background: var(--hud-face);
    border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--edge));
    box-shadow: 0 4px 14px rgba(0, 0, 0, .45), inset 0 1px 0 rgba(255, 255, 255, .06);
    color: var(--text);
  }
  .zone-emblem { flex: none; width: var(--icon-sm); height: var(--icon-sm); object-fit: contain; opacity: .9; }
  .zone-copy { display: grid; gap: var(--spacing-3xs); min-width: 0; flex: 1; }
  .zone-copy strong, .zone-copy span { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .zone-copy strong { color: var(--text); font-size: var(--font-xs); font-weight: 650; }
  .zone-copy span { color: var(--dim); font-size: var(--font-xs); }
  .zone-level { flex: none; padding-left: var(--spacing-2xs); border-left: 1px solid var(--edge); color: var(--gold-lit); font-size: var(--font-xs); font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .travel-actions { display: grid; grid-template-columns: minmax(0, 1fr); justify-items: center; gap: var(--spacing-2xs); }
  .travel-action {
    display: flex; flex-direction: column; align-items: center; justify-content: center; width: fit-content; gap: var(--spacing-3xs); min-width: 0;
    padding: var(--spacing-3xs) var(--spacing-xs); border: 0; border-radius: 0;
    background: none; color: var(--dim); font-size: var(--font-xs); white-space: nowrap;
    transition: color .15s ease;
  }
  .travel-action:hover { color: var(--text); }
  .travel-action.here { color: var(--gold-lit); }
  .zone-emblem { padding: var(--spacing-3xs); border: 1px solid var(--hud-edge); border-radius: 50%; background: var(--hud-face); box-sizing: border-box; }
  .tab:hover .toggle-ring, .moreitem:hover .toggle-ring, .travel-action:hover .toggle-ring, .map-help-toggle:hover .toggle-ring { border-color: var(--gold); }
  .tab:focus-visible, .moreitem:focus-visible, .travel-action:focus-visible, .map-help-toggle:focus-visible { outline: none; }
  .tab:focus-visible .toggle-ring, .moreitem:focus-visible .toggle-ring, .travel-action:focus-visible .toggle-ring, .map-help-toggle:focus-visible .toggle-ring {
    outline: 2px solid var(--focus); outline-offset: 2px;
  }

  /* the top-centre target bar: the front body's name over one wide red bar — the hub's own read of
     what the rotation is pressing, loud from across the room the way a boss bar is */
  .targetbar {
    z-index: 2;
    display: grid; justify-items: center; gap: var(--spacing-2xs);
    pointer-events: none; text-align: center;
  }
  .target-name { margin: 0; font-size: var(--font-xs); color: var(--text); white-space: nowrap; text-shadow: 0 1px 2px rgba(0, 0, 0, .95); }
  .target-name {
    display: inline-flex; align-items: center; gap: var(--spacing-xs);
    text-transform: uppercase; letter-spacing: clamp(1px, 0.05vw, 2px);
    padding: var(--spacing-3xs) var(--spacing-sm); border-radius: clamp(6px, 0.48vw, 12px);
    background: var(--hud-face);
    border: 1px solid color-mix(in srgb, var(--gold) 42%, var(--edge));
    box-shadow: 0 2px 10px rgba(0, 0, 0, .5);
  }
  .target-name::before, .target-name::after { content: '◆'; font-size: var(--font-xs); color: var(--gold); }
  .target-name span { color: var(--dim); }
  .target-hp {
    position: relative; width: 100%; height: calc(var(--bar-h) + var(--spacing-sm));
    overflow: hidden; background: rgba(4, 6, 9, .78);
    border: 1px solid color-mix(in srgb, var(--gold) 30%, var(--edge));
    clip-path: polygon(clamp(6px, 0.58vw, 14px) 0, calc(100% - clamp(6px, 0.58vw, 14px)) 0, 100% 50%, calc(100% - clamp(6px, 0.58vw, 14px)) 100%, clamp(6px, 0.58vw, 14px) 100%, 0 50%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
  }
  .target-hp i {
    display: block; height: 100%;
    background-image: linear-gradient(90deg, var(--hp), var(--hp-lit) 55%, var(--hot));
    box-shadow: 0 0 12px color-mix(in srgb, var(--hot) 55%, transparent);
    transform: scaleX(var(--fill)); transform-origin: left center;
    transition: transform .65s cubic-bezier(.2, .8, .2, 1);
  }
  /* the boss bar's top sheen: one lit line along the fill, the way a metal gauge reads */
  .target-hp::after {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 45%; pointer-events: none;
    background: linear-gradient(180deg, rgba(255, 255, 255, .16), transparent);
  }
  .target-hp b {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: var(--font-xs); font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .95); pointer-events: none;
  }

  /* the screen rail stays in one row inside the grid's menu region. */
  .rail {
    z-index: 70;
    display: flex; flex-direction: row; flex-wrap: nowrap; align-items: stretch; justify-content: flex-end; gap: var(--spacing-sm);
    padding: var(--spacing-xs);
  }
  .purse { display: inline-flex; align-items: center; gap: var(--spacing-2xs); flex: none; font-variant-numeric: tabular-nums; }
  .purse img { width: var(--icon-sm); height: var(--icon-sm); padding: var(--spacing-3xs); border: 1px solid var(--hud-edge); border-radius: 50%; background: var(--hud-face); box-sizing: border-box; object-fit: contain; }
  .purse b { font-size: var(--font-sm); font-weight: 700; color: var(--gold-lit); line-height: 1; }
  .purse i { font-size: var(--font-xs); font-style: normal; color: var(--dim); line-height: 1; text-transform: uppercase; letter-spacing: 1px; }
  .tab {
    position: relative; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--spacing-3xs);
    min-width: var(--icon-lg); padding: var(--spacing-3xs) var(--spacing-xs);
    border: 0; border-radius: 0; background: none; color: var(--dim);
    transition: color .15s ease;
  }
  .tab img { object-fit: contain; opacity: .82; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .9)); transition: transform .15s ease; }
  .tab:hover img { transform: translateY(-1px); opacity: 1; }
  .tab .cap { font-size: var(--font-xs); line-height: 1; text-transform: capitalize; text-shadow: 0 1px 3px rgba(0, 0, 0, .95); }
  .tab .count {
    position: absolute; top: 0; right: 0; min-width: var(--icon-xs); padding: 0 var(--spacing-2xs);
    border-radius: 999px; background: linear-gradient(180deg, var(--hot), var(--hot-deep)); border: 1px solid rgba(0, 0, 0, .45);
    color: #fff; font-size: var(--font-xs); font-variant-numeric: tabular-nums; text-align: center;
  }
  .tab:hover { color: var(--text); }
  .tab.here { color: var(--gold-lit); }
  /* a settlement screen from the field is reachable but not live, so it is marked rather than dead — the
     refusal and its reason come out of the button's own title */
  .tab.far { opacity: .5; }
  .tab.far img { filter: grayscale(.6); }
  /* More keeps the less frequent screens, field actions and HUD tools in one menu under the rail. */
  .morebox {
    position: absolute; top: calc(100% + var(--spacing-xs)); right: 0;
    display: grid; grid-template-columns: repeat(3, minmax(var(--icon-lg), 1fr)); gap: var(--spacing-sm);
    padding: var(--spacing-xs);
    background: var(--glass); backdrop-filter: blur(6px);
    border: 1px solid var(--edge); border-radius: var(--spacing-sm);
    box-shadow: 0 4px 14px rgba(0, 0, 0, .45);
  }
  .moreitem {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--spacing-3xs);
    min-width: var(--icon-lg); padding: var(--spacing-3xs) var(--spacing-xs); border: 0; border-radius: 0;
    background: none; color: var(--dim);
    font-size: var(--font-xs); line-height: 1; text-transform: capitalize; text-shadow: 0 1px 3px rgba(0, 0, 0, .95);
    transition: color .15s ease;
  }
  .moreitem img, .moreitem svg { object-fit: contain; opacity: .82; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .9)); transition: transform .15s ease, opacity .15s ease; }
  .moreitem:hover img, .moreitem:hover svg { transform: translateY(-1px); opacity: 1; }
  .moreitem svg { fill: none; stroke: currentColor; stroke-width: 1.5; }
  .moreitem:hover { color: var(--text); }
  .moreitem.here { color: var(--gold-lit); }
  .moreitem.far { opacity: .5; }
  .moreitem.far img { filter: grayscale(.6); }

  /* The outer panel owns scrolling so every inventory slot stays in one continuous view. */
  .invbody { min-height: 0; overflow: visible; }
  .invbody > section { min-height: 0; overflow: visible; }
  /* the sub-screens that came off the old three-column page */
  /* the inventory's tabs: one modal, two verbs, and the count each tab is holding printed on it */
  .sides { display: flex; gap: var(--spacing-2xs); margin-bottom: var(--spacing-sm); border-bottom: 1px solid var(--line); padding-bottom: var(--spacing-sm); }
  .sides button { border-radius: 999px; font-size: var(--font-xs); padding: var(--spacing-2xs) var(--spacing-sm); }
  .sides button.active { border-color: var(--gold); color: var(--gold); background: color-mix(in srgb, var(--gold) 12%, transparent); }
  .sides button:disabled:hover { border-color: var(--line); color: var(--text); }
  /* the inventory's face: the trip's pile and carried bag side by side */
  .poewin { display: grid; grid-template-columns: 1.25fr 1fr; gap: var(--spacing-sm); align-items: start; min-height: 0; }
  .poecol { display: flex; flex-direction: column; gap: var(--spacing-xs); min-width: 0; }
  .poecol h3 { margin: 0; font-size: var(--font-xs); color: var(--dim); letter-spacing: clamp(1px, 0.05vw, 2px); text-transform: uppercase; }
  .bagshell.poecol { grid-template-columns: 1fr; }
  .poecol .bagcats { flex-direction: row; flex-wrap: wrap; }
  .sheet-tools { display: flex; justify-content: flex-end; margin-bottom: var(--spacing-sm); }
  .sheet-layout {
    flex: 1; min-height: 0; display: grid;
    grid-template-columns: minmax(var(--box-300), .72fr) minmax(0, 1.8fr);
    gap: var(--spacing-md); overflow: hidden;
  }
  .sheet-doll { min-width: 0; border-right: 1px solid var(--line); padding-right: var(--spacing-md); }
  .sheet-doll h3 { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-xs); margin: 0 0 var(--spacing-sm); font-size: var(--font-sm); }
  .sheet-doll h3 span { color: var(--dim); font-size: var(--font-xs); font-variant-numeric: tabular-nums; }
  .sheet-values { --sheet-font-size: clamp(10px, 0.72vw, 20px); display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--box-320)), 1fr)); gap: var(--spacing-md); align-content: start; min-height: 0; height: 100%; overflow: auto; }
  .sheet-value-column { display: flex; flex-direction: column; gap: var(--spacing-md); min-width: 0; }
  .sheet-stat-group { min-width: 0; }
  .sheet-stat-group h3 { margin: 0 0 var(--spacing-2xs); color: var(--gold-lit); font-size: var(--font-sm); }
  .sheet-values .stats { width: 100%; border-collapse: collapse; }
  .sheet-values .stats td { padding: var(--seam) var(--spacing-2xs); font-size: var(--sheet-font-size); line-height: 1.15; vertical-align: top; }
  .sheet-values .stats td:first-child { width: 40%; }
  .sheet-values .stats small { color: var(--dim); font-size: var(--sheet-font-size); }
  .sheet-gate { margin: 0; color: var(--dim); font-size: var(--sheet-font-size); }
  .sheet-new-character { display: inline-flex; align-items: center; gap: var(--spacing-2xs); margin-left: auto; padding: var(--spacing-2xs) var(--spacing-xs); border: 1px solid var(--line); border-radius: var(--spacing-2xs); background: color-mix(in srgb, var(--hot) 6%, var(--panel)); color: var(--dim); font-size: var(--font-xs); white-space: nowrap; transition: border-color .15s ease, color .15s ease, background .15s ease; }
  .sheet-new-character img { width: var(--icon-xs); height: var(--icon-xs); padding: 0; border: 0; border-radius: 0; background: none; object-fit: contain; }
  .sheet-new-character:hover { border-color: color-mix(in srgb, var(--hot) 58%, var(--edge)); background: color-mix(in srgb, var(--hot) 12%, var(--panel)); color: var(--alarm); }
  /* the equip margin reads in the pile's own tool row now that the tabs own the rail */
  .bagtools .margin { display: inline-flex; align-items: center; gap: var(--spacing-2xs); font-size: var(--font-xs); color: var(--dim); }
  .bagtools .margin input { width: var(--icon-xl); }
  /* the one press in this client that changes the whole body, so it is the one control the accent is spent
     on — and it is a verb, not a state, so it never takes the gold of "you are here" */
  .bagtools .best { border-color: color-mix(in srgb, var(--good) 55%, transparent); color: var(--good-lit); background: color-mix(in srgb, var(--good) 10%, transparent); }
  /* the pile's shell: a kind rail down the left, a search and a quality cut across the top, the grid
     under them. It narrows what is drawn and never reorders the bag, so Equip still addresses the drop. */
  .bagshell { display: grid; grid-template-columns: minmax(var(--box-110), auto) 1fr; gap: var(--spacing-sm); align-items: start; }
  .bagcats { display: flex; flex-direction: column; gap: var(--spacing-3xs); }
  .bagcats button {
    display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-xs);
    text-align: left; border-radius: 8px; border: 1px solid transparent; background: none;
    color: var(--dim); font-size: var(--font-xs); padding: var(--spacing-2xs) var(--spacing-sm);
  }
  .bagcats button b { color: var(--text); font-variant-numeric: tabular-nums; }
  .bagcats button.on { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 34%, transparent); background: color-mix(in srgb, var(--gold) 10%, transparent); }
  .bagmain { display: flex; flex-direction: column; gap: var(--spacing-xs); min-width: 0; }
  .bagtools { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; }
  .bagtools .grow { flex: 1; }
  .bagsearch { min-width: var(--box-110); }
  .bagtier { display: inline-flex; align-items: center; gap: var(--spacing-2xs); font-size: var(--font-xs); color: var(--dim); }
  .bagtools .best:hover { border-color: var(--good); }
  .equipnote { margin: var(--x-pull-note) 0 var(--spacing-sm); font-size: var(--font-xs); color: var(--good); }
  .bagblock { border: 0; }
  .skill-label { display: inline-flex; align-items: center; gap: var(--spacing-2xs); }
  .skill-label img { width: var(--icon-sm); height: var(--icon-sm); object-fit: contain; flex: none; }
  /* the gate cell is one row's own condition list in a single line, and it is also the button that opens
     that row's editor — summary and control are the same object, so a row that is waiting on nothing
     says so in its own cell instead of failing silently somewhere in the rotation */
  .gate {
    padding: var(--seam) var(--spacing-xs); font-size: var(--font-xs); color: var(--gold); cursor: pointer;
    background: none; border: 1px dashed color-mix(in srgb, var(--gold) 50%, transparent); border-radius: 4px;
  }
  .gate:hover { border-style: solid; }
  /* the editor sits under the row it edits and claims no column of its own */
  .gate-editor td { background: color-mix(in srgb, var(--gold) 5%, transparent); font-size: var(--font-xs); }
  .gate-editor label { white-space: nowrap; }
  .gate-editor input[type='number'] { width: var(--icon-xl); }
  .bagblock + .bagblock { border-top: 1px solid var(--line); margin-top: var(--spacing-sm); padding-top: var(--spacing-sm); }
  .stats td { font-size: var(--font-xs); padding: var(--seam) var(--spacing-2xs); }
  .stats td:first-child { color: var(--dim); width: 45%; }
  .save-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; align-content: start; gap: var(--spacing-sm); }
  .save-tabs, .farm-tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-2xs); flex: none; }
  .save-tabs button { padding: var(--spacing-3xs) var(--spacing-sm); font-size: var(--font-xs); }
  .save-tabs button.active { border-color: var(--gold); color: var(--gold); }
  .save-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); align-items: center; }
  .save-panel h2 { margin: 0; font-size: var(--font-md); }
  .save-panel p { margin: 0; }
  .save-panel table { font-size: var(--font-xs); }
  .save-note-inline { color: var(--good); font-size: var(--font-xs); }
  .desk-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .desk-tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-2xs); flex: none; }
  .desk-tabs button { padding: var(--spacing-3xs) var(--spacing-sm); font-size: var(--font-xs); }
  .desk-tabs button.active { border-color: var(--gold); color: var(--gold); }
  .desk-content { flex: 1; min-height: 0; overflow: hidden; }
  .desk-content > h3 { margin: var(--spacing-2xs) 0; font-size: var(--font-sm); }
  .desk-content > p { margin: var(--spacing-2xs) 0; font-size: var(--font-xs); }
  .desk-content .picklist th, .desk-content .picklist td { padding: var(--seam) var(--spacing-3xs); line-height: 1.1; font-size: var(--font-xs); }
  .desk-content .picklist button { padding: var(--spacing-3xs) var(--spacing-2xs); font-size: var(--font-xs); }
  .skills-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .skill-tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-2xs); flex: none; }
  .skill-tabs button { padding: var(--spacing-3xs) var(--spacing-sm); font-size: var(--font-xs); }
  .skill-tabs button.active { border-color: var(--gold); color: var(--gold); }
  .skill-note { margin: 0; color: var(--good); font-size: var(--font-xs); }
  .skill-view { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .skill-view h3 { margin: var(--spacing-2xs) 0 0; }
  .skill-view table { width: 100%; }
  .skill-view th, .skill-view td { padding: var(--seam) var(--spacing-3xs); line-height: 1.15; font-size: var(--font-xs); }
  .skill-view select { max-width: 100%; padding: var(--seam) var(--spacing-2xs); font-size: var(--font-xs); }
  .skill-view .skill-label { gap: var(--spacing-3xs); }
  .skill-view .skill-label img { width: var(--icon-xs); height: var(--icon-xs); }
  .skill-view label { font-size: var(--font-xs); }
  .skill-view .prose { margin: 0; }
  .skill-owned-grid, .skill-effect-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--box-180), 1fr)); gap: var(--spacing-2xs); align-content: start; }
  .skill-owned-grid { flex: 1; min-height: 0; overflow: hidden; }
  .skill-owned { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-2xs); padding: var(--spacing-3xs) var(--spacing-xs); border: 1px solid var(--line); background: var(--inset); }
  .skill-owned .skill-label { min-width: 0; }
  .skill-owned .skill-label b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-xs); font-weight: 500; }
  .skill-owned small { flex: none; color: var(--dim); font-size: var(--font-xs); }
  .empty-owned { grid-column: 1 / -1; margin: var(--spacing-xs) 0; color: var(--dim); font-size: var(--font-xs); }
  .effects-view { gap: var(--spacing-xs); }
  .effects-view section { min-width: 0; }
  .effects-view h3 { margin: var(--spacing-2xs) 0; }
  .skill-effect-grid label { display: flex; align-items: center; gap: var(--spacing-2xs); min-width: 0; margin: 0; padding: var(--spacing-3xs) var(--spacing-xs); border-bottom: 1px solid var(--line); }
  .skill-effect-grid .skill-label { min-width: 0; overflow: hidden; }
  .skill-effect-grid .skill-label img { flex: none; }
  .skill-effect-grid .skill-label { white-space: nowrap; text-overflow: ellipsis; }
  .skill-effect-grid > small { grid-column: 1 / -1; color: var(--dim); }
  .reserve-note { margin: 0; color: var(--dim); font-size: var(--font-xs); }
  .farm-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .farm-panel > p { margin: 0; font-size: var(--font-xs); }
  .farm-tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-2xs); flex: none; }
  .farm-tabs button { padding: var(--spacing-3xs) var(--spacing-sm); font-size: var(--font-xs); }
  .farm-tabs button.active { border-color: var(--gold); color: var(--gold); }
  .farm-note { color: var(--good); }
  .filter { margin-top: var(--spacing-xs); }
  .filter summary { cursor: pointer; color: var(--dim); font-size: var(--font-xs); }
  .filter table { margin-top: var(--spacing-xs); }
  /* the explanation a player reads once: folded, so the screen's own controls lead and the panel's
     working part stays on the first screen rather than below a wall of prose */
  .prose { margin: var(--spacing-xs) 0; }
  .prose summary { cursor: pointer; color: var(--dim); font-size: var(--font-xs); }
  .prose summary:hover { color: var(--text); }
  .prose p:first-of-type { margin-top: var(--spacing-xs); }
  .weight { margin: 0 0 var(--spacing-xs); }
  .weight small { color: var(--dim); }
  .warn { color: var(--alarm); }
  /* a monitor is not a phone: the client is written for a desktop window and scales with the root size set
     in styles/variables.css, so these steps only move what physically cannot fit — the reads give ground in
     the middle, they are never taken off the screen. */
  .townnote { margin: var(--spacing-xs) 0 0; font-size: var(--font-xs); color: var(--good); }
  .mini { padding: var(--seam) var(--spacing-xs); font-size: var(--font-xs); }
  /* the announcement is for the screen reader, not the eye: the same words are already on a pill */
  .aloud {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
    clip-path: inset(50%); white-space: nowrap; border: 0;
  }
  /* the field's own switches and the cast order answer a press, so they wear the ring a plate cannot */
  .knob:focus-visible, .cast:focus-visible, .face:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .controls-dock button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  /* a plate is read, not worked: it takes no ring, but its controls do */
  .pop :is(button, select, input, summary):focus-visible { outline-offset: 1px; }

  /* ── the hit ring ─────────────────────────────────────────────────────────────────────────────
     Every event the sim raised, drawn once and then gone. The colour is the data's (`--fx` is set
     from `elements.colour` at the call site), so a new Element needs a data row and not a CSS edit.
     The ring is decoration: it never takes a pointer and never holds layout. */
  .floaters { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
  .float-side { position: absolute; display: flex; flex-direction: column-reverse; gap: var(--spacing-3xs); }
  /* the pickups' own column, the right edge above the control dock, where the latest loot stays readable
     while the fight continues */
  .field-side { right: var(--screen-pad); bottom: calc(var(--controls-h) + var(--screen-pad) * 2); left: auto; transform: none; align-items: flex-end; }
  /* the character's own column is anchored to the card it belongs to: it rises from just above the
     self-plate's top edge, so its place follows the plate wherever the frame puts it */
  .self-side { left: 50%; bottom: calc(100% + clamp(5px, 0.39vw, 11px)); transform: translateX(-50%); align-items: center; }
  .fx {
    --lane: 0;
    font-family: var(--num);
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--fx, var(--text));
    text-shadow: 0 1px 0 rgba(0, 0, 0, .85), 0 clamp(1px, 0.10vw, 3px) clamp(4px, 0.34vw, 9px) rgba(0, 0, 0, .7);
    animation: fx-rise 1.5s cubic-bezier(.2, .6, .3, 1) forwards;
    white-space: nowrap;
  }
  .fx-hit { font-size: var(--font-md); -webkit-text-stroke: .45px currentColor; }
  .fx-hit.crit { font-size: var(--font-lg); letter-spacing: clamp(0px, 0.00vw, 1px); -webkit-text-stroke-width: .8px; animation: fx-crit 1.9s cubic-bezier(.15, .8, .3, 1) forwards; }
  .fx-proc, .fx-block, .fx-kill, .fx-cast, .fx-travel, .fx-warp, .fx-sell, .fx-drop, .fx-craft, .fx-taken, .fx-buff {
    font-family: var(--ui);
    font-size: var(--font-xs);
    text-transform: uppercase;
    letter-spacing: clamp(1px, 0.05vw, 2px);
    padding: var(--seam) var(--spacing-2xs);
    border: 1px solid color-mix(in srgb, var(--fx, var(--line)) 55%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--fx, var(--panel)) 14%, transparent);
  }
  .fx-proc { animation: fx-proc 1.25s ease-out forwards; }
  .fx-cast { animation: fx-cast 1.1s ease-out forwards; }
  .fx-travel, .fx-warp { animation: fx-drift 1.6s linear forwards; }
  .fx-kill { animation: fx-strike .7s ease-out forwards; }
  .fx-sell, .fx-craft { animation: fx-rise 1.5s ease-out forwards; }
  /* the row that fired, on the bar that lists the order — the one place that can name the press without
     printing it twice. `ready`'s gold ring means pressable now; this ring is the Element that went out. */
  .cast .flare {
    position: absolute; inset: -2px; z-index: 2; pointer-events: none;
    border: 1px solid var(--fx, var(--text)); border-radius: inherit;
    animation: fx-flare .5s ease-out forwards;
  }
  /* a buff coming up is prose, so it wears the chip face like the other words on the field */
  .fx-buff {
    animation: fx-buff 1.15s ease-out forwards;
  }
  /* a heal is a number, so it keeps `--num` and never the chip's uppercase face; the heart is the shelf's
     own, masked, so the glyph is decoration and the digits stay the read */
  .fx-heal {
    font-size: var(--font-sm);
    animation: fx-heal 1.1s ease-out forwards;
  }
  .fx-buff::before, .fx-heal::before {
    content: '';
    display: inline-block; width: var(--icon-xs); height: var(--icon-xs); margin-right: var(--spacing-2xs); vertical-align: clamp(-2px, -0.05vw, -1px);
    background: var(--fx, var(--text));
    -webkit-mask-size: contain; mask-size: contain;
    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
    -webkit-mask-position: center; mask-position: center;
  }
  .fx-heal::before {
    -webkit-mask-image: url('./icon/interface/heart-beats.svg');
            mask-image: url('./icon/interface/heart-beats.svg');
  }
  .fx-buff::before {
    -webkit-mask-image: url('./icon/skill/aura/expanded-rays.svg');
            mask-image: url('./icon/skill/aura/expanded-rays.svg');
  }
  /* the frame's own beat: a level borrows the title's line for one rise and hands it back */
  .levelup {
    position: absolute; top: calc(var(--screen-pad) + var(--rail-h) + var(--spacing-xs)); left: 50%; z-index: 8; pointer-events: none;
    margin: 0; white-space: nowrap; font-family: var(--num); font-size: var(--font-md); letter-spacing: clamp(2px, 0.10vw, 3px);
    color: var(--fx, var(--gold)); text-shadow: 0 2px 12px rgba(0, 0, 0, .6);
    animation: fx-level 1.5s cubic-bezier(.2, .7, .3, 1) forwards;
  }
  @keyframes fx-flare {
    0% { opacity: 0; transform: scale(.85); }
    25% { opacity: 1; transform: scale(1.14); }
    100% { opacity: 0; transform: scale(1); }
  }
  @keyframes fx-buff {
    0% { opacity: 0; transform: scale(.6) translateY(clamp(5px, 0.39vw, 11px)); }
    25% { opacity: 1; transform: scale(1.08); }
    100% { opacity: 0; transform: translateY(clamp(-49px, -1.74vw, -22px)) scale(1); }
  }
  @keyframes fx-heal {
    0% { opacity: 0; transform: translateY(clamp(6px, 0.48vw, 14px)) scale(.9); }
    20% { opacity: 1; }
    100% { opacity: 0; transform: translateY(var(--x-pull-arc)) scale(1); }
  }
  @keyframes fx-level {
    0% { opacity: 0; transform: translateX(-50%) translateY(clamp(9px, 0.68vw, 19px)) scale(.7); }
    18% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.18); }
    70% { opacity: 1; transform: translateX(-50%) translateY(clamp(-7px, -0.24vw, -3px)) scale(1); }
    100% { opacity: 0; transform: translateX(-50%) translateY(clamp(-35px, -1.26vw, -16px)) scale(1); }
  }
  /* the column figure's arc, staged the MapleStory way (owner ruling): a quick rise, a hold long enough
     to read, then the fade — so the number owns its own life on screen and is never cut short while the
     ring still has room for it */
  @keyframes fx-rise {
    0% { opacity: 0; transform: translate(calc(var(--lane) * clamp(14px, 1.06vw, 30px) - clamp(41px, 3.19vw, 89px)), clamp(4px, 0.29vw, 8px)) scale(.55); }
    14% { opacity: 1; }
    32% { transform: translate(calc(var(--lane) * clamp(14px, 1.06vw, 30px) - clamp(41px, 3.19vw, 89px)), clamp(-43px, -1.55vw, -20px)) scale(1.08); }
    60% { opacity: 1; transform: translate(calc(var(--lane) * clamp(14px, 1.06vw, 30px) - clamp(41px, 3.19vw, 89px)), clamp(-51px, -1.84vw, -24px)) scale(1); }
    100% { opacity: 0; transform: translate(calc(var(--lane) * clamp(14px, 1.06vw, 30px) - clamp(41px, 3.19vw, 89px)), clamp(-70px, -2.52vw, -32px)) scale(.96); }
  }
  /* the crit's own stage: a harder slam, a longer hold, a slower let-go */
  @keyframes fx-crit {
    0% { opacity: 0; transform: translate(calc(var(--lane) * clamp(14px, 1.06vw, 30px) - clamp(41px, 3.19vw, 89px)), clamp(8px, 0.58vw, 16px)) scale(.5); }
    18% { opacity: 1; transform: translate(calc(var(--lane) * clamp(14px, 1.06vw, 30px) - clamp(41px, 3.19vw, 89px)), var(--x-pull-note)) scale(1.42); }
    34% { transform: translate(calc(var(--lane) * clamp(14px, 1.06vw, 30px) - clamp(41px, 3.19vw, 89px)), clamp(-19px, -0.68vw, -9px)) scale(1); }
    64% { opacity: 1; transform: translate(calc(var(--lane) * clamp(14px, 1.06vw, 30px) - clamp(41px, 3.19vw, 89px)), clamp(-22px, -0.77vw, -10px)) scale(1); }
    100% { opacity: 0; transform: translate(calc(var(--lane) * clamp(14px, 1.06vw, 30px) - clamp(41px, 3.19vw, 89px)), var(--x-pull-arc)) scale(.96); }
  }
  @keyframes fx-proc {
    0% { opacity: 0; transform: scale(.7); }
    30% { opacity: 1; transform: scale(1.1); }
    100% { opacity: 0; transform: translateY(clamp(-38px, -1.36vw, -18px)); }
  }
  @keyframes fx-cast {
    0% { opacity: 0; transform: translateY(clamp(5px, 0.39vw, 11px)) skewX(-8deg); }
    25% { opacity: 1; }
    100% { opacity: 0; transform: translateY(clamp(-43px, -1.55vw, -20px)); }
  }
  @keyframes fx-drift {
    0% { opacity: 0; transform: translateX(var(--x-pull-burst)); }
    20% { opacity: 1; }
    100% { opacity: 0; transform: translateX(clamp(18px, 1.36vw, 38px)); }
  }
  @keyframes fx-strike {
    0% { opacity: 1; transform: scale(1.25); }
    100% { opacity: 0; transform: scale(.9); }
  }
  /* the frame's edge on a hit taken: the same colour rule as the number, one beat wider */
  .veil {
    position: absolute; inset: 0; pointer-events: none;
    box-shadow: inset 0 0 var(--box-100) color-mix(in srgb, var(--fx, var(--hp)) 50%, transparent);
    animation: fx-veil .4s ease-out forwards;
  }
  @keyframes fx-veil {
    0% { opacity: .9; }
    100% { opacity: 0; }
  }

  /* ── the town's own face ──────────────────────────────────────────────────────────────────────
     Standing in a settlement is not a second screen: the character still hunts the zone the town owns.
     What changes is what the screen puts first — the field recedes, the sheet loses its depth-of-field
     pull, and the settlement's name sits over the zone's. The work a town is for (the warehouse, the
     counter, the bench, the desk) is already one rail press away; this only stops the fight from
     shouting over it. A walk in progress stays readable, because it is the one thing town cannot hide. */
  /* the fight stays sharp in a settlement (owner ruling): only the ground recedes, so the field is
     dimmed and desaturated by hand here and never pulled through the blur half of the ladder */
  .townmode .field { opacity: .78; filter: saturate(.85); }
  .townmode .map-back { --dof: var(--dof-far); }


  /* The parent owns the edge gutters. Its inner 15 × 15 tracks place every named HUD region, so
     children never need viewport-based margins to clear the screen edge. */
  .stage {
    display: grid;
    grid-template-columns: var(--screen-pad) repeat(15, minmax(0, 1fr)) var(--screen-pad);
    grid-template-rows: var(--screen-pad) repeat(15, minmax(0, 1fr)) var(--screen-pad);
    /* Region tracks come from the one saved grid layout on the stage element. */
  }
  .topright {
    grid-area: objectives;
    width: min(var(--objectives-w), 100%);
    min-width: 0;
    min-height: 0;
    align-self: start;
  }
  .targetbar {
    grid-area: target;
    width: min(var(--box-560), 100%);
    min-width: 0;
    justify-self: stretch;
    align-items: center;
    justify-content: center;
  }
  .rail {
    grid-area: menu;
    position: relative;
    width: fit-content;
    max-width: 100%;
    min-width: 0;
    justify-self: end;
    align-self: start;
  }
  .field {
    grid-area: field;
    position: relative;
    min-width: 0;
    min-height: 0;
  }
  .dock {
    grid-area: panels;
    width: 100%;
    min-width: 0;
    min-height: 0;
    align-items: stretch;
    justify-self: stretch;
    align-self: stretch;
  }
  .dock .pop { width: 100%; max-width: 100%; max-height: 100%; flex: 1 1 auto; }
  .actionbar {
    grid-area: actionbar;
    min-width: 0;
    min-height: 0;
    align-self: stretch;
    align-items: center;
    flex-direction: column;
    justify-content: flex-end;
    gap: var(--spacing-2xs);
  }
  .action-cluster { max-width: 100%; gap: var(--spacing-xs); }
  .controls-dock {
    grid-area: controls;
    min-width: 0;
    min-height: 0;
    align-self: stretch;
    justify-self: end;
    width: fit-content;
    max-width: 100%;
    gap: var(--spacing-xs);
    padding: var(--spacing-2xs);
  }
  .field-feed {
    grid-area: feed;
    width: 100%;
    min-width: 0;
    min-height: 0;
    align-self: stretch;
  }
  .field-feed :global(.combatlog) { width: 100%; min-height: 0; }
  .tracker { width: 100%; }
  .hud-grid-debug {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: grid;
    grid-template-columns: repeat(15, minmax(0, 1fr));
    grid-template-rows: repeat(15, minmax(0, 1fr));
    border-top: 1px solid color-mix(in srgb, var(--focus) 55%, transparent);
    border-left: 1px solid color-mix(in srgb, var(--focus) 55%, transparent);
    pointer-events: none;
  }
  .hud-grid-debug > span {
    min-width: 0;
    min-height: 0;
    padding: var(--spacing-3xs);
    border-right: 1px solid color-mix(in srgb, var(--focus) 55%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--focus) 55%, transparent);
    color: color-mix(in srgb, var(--focus) 78%, var(--text));
    font: var(--font-xs) / 1 var(--num);
    text-shadow: 0 1px 2px var(--bg);
  }
</style>
