<script lang="ts">
  import { onMount } from 'svelte';
  import { cubicOut, linear } from 'svelte/easing';
  import { prefersReducedMotion, Tween } from 'svelte/motion';
  import { eng, E, sm, TOWN, tree, loot, fieldwork, trade } from './engine/client';
  import { buildCharacter } from './sim/player';
import { withMeal, withHunger, fieldSite, campHere as atFieldCamp, establishCamp, leaveCamp, returnToCamp, startFieldAction, stopFieldAction, cookMeal, eatMeal, lifeSkillBonuses } from './sim/fieldwork';
  import { sellGoods, processMaterials, tradeBucket } from './sim/trade';
import { offerDelivery, deliver, trackDelivery, acknowledgeDelivery, announceDelivery, tickDeliveries, contractById, deliveryTimeLeft, deliveryPauseReason } from './sim/delivery';
import { buyBlackMarket } from './sim/black-market';
  import DeliveryNotice from './ui/DeliveryNotice.svelte';
  import { previewScrapAlchemy, transmuteScrap, alchemyTierProgress } from './sim/alchemy';
  import { newGame, tick, push, fx, hitColour, catchUpAsync, schedulerBatch, WAKE_SEC, carried, heldWeaponName, huntZone, huntHere, salvageBag, retreatDungeon, runFilterNow, isBossKind } from './sim/game';
  import { rollDrop } from './sim/drop';
  import { reservedPct, usableMana, skillCd, skillLevel, ladderOf, effectsActive, toggleTrack, effectLine, describeFold, EFFECT_LABEL, ACTIVE_SLOTS, costNow, modeOf, condOf, appliedStatusOf, appliedCurseOf, moveSlot } from './sim/skills';
  import { modsOn, psMult, curableRows } from './sim/curse';
  import { statusLabel } from './sim/mobStatus';
  import { slotsUsed, slotsAvailable, slotsFree, pouchSlots, bagStacks } from './sim/slots';
  import SlotGrid from './ui/SlotGrid.svelte';
  import StatAllocator from './ui/StatAllocator.svelte';
  import Panel from './ui/Panel.svelte';
  import Quickbar from './ui/Quickbar.svelte';
  import HudLayoutEditor from './ui/HudLayoutEditor.svelte';
  import { copyHudLayout, DEFAULT_MODAL_AREA, gridAreaCss, hudGridTemplate, HUD_LAYOUT_STORAGE_KEY, HUD_LAYOUT_PREVIOUS_STORAGE_KEYS, HUD_LAYOUT_VERSION, migrateHudLayout, regionStyleCss, salvageHudLayout, validGridArea, validateHudLayout, type GridArea, type HudLayout, type HudRegionId } from './ui/hud-layout';
  import TravelCard from './ui/TravelCard.svelte';
  import { destinationPrimary } from './ui/destination';
  import TownHub from './ui/TownHub.svelte';
  import Market from './ui/Market.svelte';
  import CraftWorkshop from './ui/CraftWorkshop.svelte';
  import FieldworkBoard from './ui/FieldworkBoard.svelte';
  import PassiveTreeBoard from './ui/PassiveTreeBoard.svelte';
  import StashBoard from './ui/StashBoard.svelte';
  import KeybindTable from './ui/KeybindTable.svelte';
  import Minimap from './ui/Minimap.svelte';
  import CollapseToggle from './ui/CollapseToggle.svelte';
  import { KEYBINDS, bindTable, actionFor, tokenOf, isModifierKey, isTypingTarget, formatKey } from './ui/keybinds';
  import { gearEntry, stackEntry, sortEntries, type SlotEntry, type SortKey } from './ui/bag';
  import type { MenuItem } from './ui/menu';
  import { ramp, cellLabel, paintSheet, type Picked } from './ui/map';
  import { setCastDrag, readCastDrag } from './ui/drag';
  import { snapCounters, buildAwayReport, fieldLabel, describeSnap } from './ui/hud';
  import { bar } from './ui/field';
  import { fxOut } from './ui/motion';
  import FieldPlates from './ui/FieldPlates.svelte';
  import LogBox from './ui/LogBox.svelte';
  import ObjectiveFeed from './ui/ObjectiveFeed.svelte';
  import { feedEventsAfter } from './ui/logbox';
  import {
    settlementById, settlementOfZone, stockOf, priceGold, priceMinutes, canBuy, buy, sellJunk,
    standingShare, standingTier, canTravel, claimTask, npcOf,
  } from './sim/town';
  import { doCraft, stoneName, atSettlement, replaceChoices, type CraftOp, type Where } from './sim/craft';
import { farm, farmLevel, farmMasteryLevel, plotCount, plant, harvest, craftPotion, condense, drink, cycleQuickbar } from './sim/farm';
  import { stashTabCount, STASH_TAB_CAP, deposit, withdraw, depositMany, withdrawMany } from './sim/town';
import { canSpendTree, respecTree, spendTreePoint, treePointsFree, treePointsSpent } from './sim/tree';
  import { respecStats } from './sim/respec';
  import { road, startWalk, walkNote, walkBlocks, warpTo, warpCost, warpRow, cellBlocks, cellSec, currentCell, settlementCell, ownerOf } from './sim/road';
  import { clearPatrolStops, startPatrol as startPatrolRun, stopPatrol as stopPatrolRun, togglePatrolStop } from './sim/exploration';
  import { enterDungeon, cooldownLeft } from './sim/dungeon';
  import { masteryLabel, masteryLevel, weaponSkillBonusPct, WEAPONS } from './sim/mastery';
  import { storePreset, switchPreset, bindZone } from './sim/presets';
  import { col, setUnlocked, heldCount, turnIn } from './sim/collector';
  import { mulberry32 } from './engine/client-helpers';
  import { writeSave, writeSaveSync, readSave, exportJson, importJson, saveSlots, listSnapshots, restoreSnapshot, readSettings, writeSettings, DEFAULT_SETTINGS, type SlotName, type Snapshot, type ClientSettings } from './state/save';
  import { requestAccountWriterLock, type AccountWriterLockResult } from './state/accountWriterLock';
  import { FILTER_SLOTS, ruleFor, setRule, describeRule, presetSlots, savePreset, loadPreset, clearPreset } from './sim/filter';
  import { equipFromBag, autoEquip, unequip } from './sim/gear';
  import { SAVE_CFG } from './sim/snapshot';
  import { describe as describeGoal, lifeSkillMilestones } from './sim/goal';
  import { hubIcon, icon, mobIcon, skillIcon } from './icon';
  import { bossMark } from './icon';
  // The HUD's own marks, read off the same icon shelf the slots draw from by file name — no second asset set,
  // and no import to rewrite when a figure is redrawn, renamed or moved between category folders.
  const sheetMark = icon('knight-helmet');
  const bagMark = icon('adventure-bags');
  const fieldMark = icon('crossed-swords-1');
  const skillMark = icon('spell-book');
  const treeMark = icon('tree');
  const mapMark = icon('map');
  const stashMark = icon('treasure-chest');
  // Town and service marks use the thing the player visits or works with: a gate, journal, anvil, and press.
  const townMark = icon('gate-guard');
  const deskMark = icon('quest-journal');
  const forgeMark = icon('anvil-1');
  const craftMark = icon('add-plus');
  const farmMark = icon('sprout');
  const campMark = icon('camping-tent');
  const saveMark = icon('save-crystal');
  const coinMark = icon('currency-strongbox');
  const keysMark = icon('key');
  const waypointMark = icon('waypoint-pillar');
  const moreMark = icon('more-options');
  const stayMark = icon('rest-campfire');
  const climbMark = icon('ladder-stack');
  const autoEquipMark = icon('heavy-helm');
  const newCharacterMark = icon('perspective-dice-six-faces-random');
  // the field sheet, generated by tools/map.ts and inlined so the travel pin, the plotted route and
  // the picked cell are all toggled by id — the client reads no coordinate, only settlement ids and
  // cell keys it already holds (X33 · M7 · M10)
  import mapOverlayRaw from './icon/map/map-overlay.svg?raw';
  import type { GameState, Item, Cell, Mob, FxEvent } from './sim/types';
  import type { StatKey } from './engine/client';
  import type { Statuses } from './sim/combat';
  import type { SkillConditions } from './sim/skills';

  const STATS: StatKey[] = ['str', 'int', 'vit', 'agi', 'dex', 'wis', 'lck'];
  const showcaseMode = import.meta.env.DEV && window.location.pathname.replace(/\/+$/, '') === '/__showcase';
  let showcaseSample = $state('delivery');

  function showcaseGame(scenario = 'delivery'): GameState {
    const sample = newGame();
    sample.fieldwork.materials['copper-ore'] = 12;
    sample.fieldwork.materials.timber = 8;
    sample.fieldwork.foods['river-fish'] = 5;
    sample.junk[(E.mob.variant_drops as Record<string, { item: string }>)[E.mob.variants.goblin[0].name].item] = 20;
    sample.hunting = true;
    tick(sample, {}, { online: false, autoSkills: false });
    const starter = sample.gear.find((piece): piece is Item => piece !== null);
    if (starter) {
      const carriedSample = structuredClone(starter);
      carriedSample.locked = true;
      sample.bag.push(carriedSample);
    }
    if (scenario === 'craft-stash') {
      sample.counters.stones = {
        ...sample.counters.stones,
        reroll_value: 9, tier: 9, add: 6, remove: 4, replace: 5, quality: 5,
        repair: 2, corrupt: 1, polish: 2, reforge: 2, rebirth: 2,
      };
      // a real drop, so the bench sample carries Unbound lines the line tabs can open
      sample.bag.push(rollDrop(mulberry32(20260218), 'mid', 42));
      // A compatible held Imprint exercises the same targeting flow as regular stones.
      const imprintMod = replaceChoices(sample, 'bag', sample.bag.length - 1)[0];
      if (imprintMod) sample.counters.stones[`imprint_${imprintMod}`] = 2;
      const stashIndexes = sample.gear
        .map((piece, position) => piece && position > 0 ? position : -1)
        .filter((position) => position >= 0)
        .slice(0, 2);
      if (stashIndexes.length) {
        sample.grants.stash_tabs = Math.max(1, sample.grants.stash_tabs || 0);
        sample.stash[0] ||= [];
        for (const stashIndex of stashIndexes) {
          const stashPiece = sample.gear[stashIndex];
          if (!stashPiece) continue;
          sample.gear[stashIndex] = null;
          sample.stash[0].push(structuredClone(stashPiece));
        }
      }
    }
    const activeSkill = Object.values(sm.byId).find((skill) => skill.type && ['attack', 'curse', 'heal'].includes(skill.type));
    if (activeSkill) {
      sample.skills.owned[activeSkill.id] = 0;
      sample.skills.list[0] = activeSkill.id;
    }
    if (scenario === 'expedition') {
      const seedTask = sample.town.tasks[0]!;
      sample.town.tasks[1] = {
        ...structuredClone(seedTask),
        kind: 'expedition', zone: 1,
        targetSpecies: E.mob.zones[0].subzones?.[0]?.species?.[0] || 'goblin',
        subzone: 0, progress: 1,
      };
    } else if (scenario !== 'field' && scenario !== 'craft-stash' && scenario !== 'map-mine') {
      const draws = [0, 0.99, 0, 0, 0];
      const contract = offerDelivery(sample, sample.town.waypoint, () => draws.shift() ?? 0, { writer: true });
      if (contract) {
        const good = trade.byId[contract.good];
        tradeBucket(sample, good)[good.key] = contract.target;
        if (scenario === 'full-bag') {
          tradeBucket(sample, good)[good.key] += contract.target;
          const free = Math.max(0, slotsAvailable(sample) - slotsUsed(sample));
          sample.counters.stones.reroll_value = free * E.inventory.stack_size.stone;
        }
        if (scenario === 'fallback' && contract.reward.skill) sample.skills.owned[contract.reward.skill] = sm.LADDER_MAX_DUPLICATES;
        if (scenario === 'expired') {
          deliver(sample, contract.id, Math.max(1, Math.floor(contract.target / 2)), { writer: true });
          sample.clockSec += contract.dueAtDeliverySec - sample.town.deliveryClockSec;
          sample.town.deliveryClockSec = contract.dueAtDeliverySec;
          tickDeliveries(sample, () => 1, false, true, { writer: true });
        }
      }
    }
    if (scenario === 'combat-fx') {
      // Partial pools keep the waterline, glass and resource effects visible in the preview.
      sample.player.hp = Math.round(sample.player.hp * .65);
      sample.player.mana = Math.round(sample.player.mana * .48);
      sample.player.es = Math.round(sample.player.es * .35);
      const mob = sample.group[0];
      if (mob) {
        sample.mobStatus[mob.id] = {
          statuses: {
            burn: { stacks: 2, secLeft: 8, perSec: 24 },
            chill: { stacks: 1, secLeft: 10, perSec: 0 },
            shock: { stacks: 1, secLeft: 1, perSec: 0 },
          },
          alignedPerSec: 24, stoppedSec: 0, elapsedSec: 1,
        };
        const buff = sm.of('buff').find((skill: any) => skill.type === 'buff');
        if (buff) {
          sample.skills.owned[buff.id] ??= 0;
          sample.skills.buffs[buff.id] = true;
          sample.skills.buffUp[buff.id] = 26;
        }
        const sec = sample.clockSec;
        const events: Omit<FxEvent, 'id' | 'sec'>[] = [
          { kind: 'hit', side: 'field', mobId: mob.id, via: 'swing', text: '248', value: 248, colour: hitColour('physical') },
          { kind: 'hit', side: 'field', mobId: mob.id, via: 'cast', text: '1,240!', value: 1240, crit: true, colour: hitColour('fire', true) },
          { kind: 'hit', side: 'field', mobId: mob.id, via: 'dot', text: '36', value: 36, colour: hitColour('fire') },
          { kind: 'block', side: 'field', mobId: mob.id, text: 'Dodge', colour: hitColour(null) },
          { kind: 'kill', side: 'field', mobId: mob.id, text: `${fieldLabel(mob)} defeated`, colour: hitColour(null) },
          { kind: 'drop', side: 'field', text: 'Fine gear', colour: hitColour(null) },
          { kind: 'cast', side: 'self', text: 'Fireball', colour: hitColour('fire') },
          { kind: 'buff', side: 'self', text: buff?.name || 'Battle Focus', colour: hitColour('lightning') },
          { kind: 'heal', side: 'self', text: '+86', colour: E.elements.colour.poison },
          { kind: 'taken', side: 'self', byId: mob.id, text: '142', value: 142, colour: hitColour('chaos') },
          { kind: 'block', side: 'self', byId: mob.id, text: 'Block', colour: hitColour(null) },
          { kind: 'proc', side: 'self', text: 'Poison', colour: hitColour('poison') },
        ];
        sample.fx = events.map((event, index) => ({ ...event, id: index + 1, sec } as FxEvent)).reverse();
        sample.fxSeq = events.length;
      }
    }
    if (scenario === 'map-mine') {
      const svg = new DOMParser().parseFromString(mapOverlayRaw, 'image/svg+xml');
      const mine = svg.querySelector(`polygon.cell[data-node="${sample.town.waypoint}"][data-wild="${fieldwork.F.wild_site_index.mine}"]`);
      const axes = mine?.getAttribute('data-ax')?.split(',').map(Number);
      if (axes?.length === 2) sample.cell = { q: axes[0], r: axes[1], sub: null, wild: fieldwork.F.wild_site_index.mine };
      sample.group = []; sample.hunting = false; sample.fx = [];
    }
    return sample;
  }
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
  const RAIL: PanelId[] = ['map', 'town', 'market', 'craft', 'bag', 'skills', 'tree', 'desk', 'farm', 'camp', 'save', 'keys'];
  const MAIN_RAIL: PanelId[] = ['map', 'bag', 'skills', 'craft'];
  const MORE_RAIL = RAIL.filter((p) => !MAIN_RAIL.includes(p) && p !== 'camp');
  const HUD_GRID_LABELS = Array.from({ length: 225 }, (_, i) => `${String.fromCharCode(65 + Math.floor(i / 15))}${(i % 15) + 1}`);
  const TOWN_PANELS: PanelId[] = ['town', 'market', 'forge', 'craft', 'stash', 'desk'];
  const RAIL_ICON: Record<PanelId, string> = {
    bag: hubIcon('bags', bagMark), skills: hubIcon('skill-book', skillMark),
    tree: treeMark, map: mapMark, desk: deskMark,
    stash: stashMark, farm: farmMark, camp: campMark, save: saveMark, town: townMark,
    market: coinMark, forge: forgeMark, craft: hubIcon('crafting', craftMark), keys: keysMark,
  };
  const RAIL_LABEL: Record<PanelId, string> = {
    bag: 'bags', skills: 'skills', tree: 'tree', map: 'map', desk: 'desk',
    stash: 'stash', farm: 'farm', save: 'save', town: 'town',
    market: 'market', forge: 'forge', craft: 'craft', keys: 'keys', camp: 'camp',
  };
  const SCREEN_ACTION: Record<PanelId, string> = {
    bag: 'screen.bag', skills: 'screen.skills', tree: 'screen.tree', map: 'screen.map',
    desk: 'screen.desk', stash: 'screen.stash', farm: 'screen.farm', camp: 'screen.camp', save: 'screen.save',
    town: 'screen.town', market: 'screen.market', forge: 'screen.forge', craft: 'screen.craft',
    keys: 'screen.keys',
  };
  // `gameState`, not `state`: a top-level `state` binding makes svelte2tsx read `$state` as a store
  // subscription and type the whole panel `any` (sveltejs/svelte#13715).
  let gameState = $state<GameState>(showcaseMode ? showcaseGame() : newGame());
  let statuses = $state<Statuses>({});
  let running = $state(!showcaseMode);
  /** Held while a load or a snapshot rewind swaps the character: a live tick landing on the new state
   *  mid-catch-up would sim the away window twice. The interval drains its accumulator and stands down. */
  let paused = $state(false);
  let cooldownStepMs = $state(0);
  let speed = $state(1);
  /** Smooth displayed vital changes over one fixed second; reduced-motion users get an instant update. */
  const vitalTweenOptions = {
    get duration() { return prefersReducedMotion.current ? 0 : 1000; },
    easing: linear,
  };
  const hpVisual = Tween.of(() => gameState.player.hp, vitalTweenOptions);
  const esVisual = Tween.of(() => gameState.player.es, vitalTweenOptions);
  const manaVisual = Tween.of(() => gameState.player.mana, vitalTweenOptions);
  const shownHp = $derived(hpVisual.current);
  const shownEs = $derived(esVisual.current);
  const shownMana = $derived(manaVisual.current);
  // the game opens on the ground, not on the fight: the first read is where the character stands and
  // where the walk goes, and FIELD (or Escape) folds the map down to the combat frame
  let panel = $state<PanelId | null>(showcaseMode ? null : 'map');
  let more = $state(false);
  let locationExpanded = $state(true);
  let controlsExpanded = $state(true);
  let menuExpanded = $state(true);
  $effect(() => { if (!menuExpanded) more = false; });
  let hudGridVisible = $state(false);
  let layoutEditorOpen = $state(false);
  let hudLayout = $state(copyHudLayout());
  let hudLayoutNotice = $state<string | null>(null);
  let modalLayout = $state<GridArea>({ ...DEFAULT_MODAL_AREA });
  const hudLayoutAreas = $derived(hudGridTemplate(hudLayout));
  const modalGridArea = $derived(gridAreaCss(modalLayout));
  /** one region's stage style: a free absolute box, or its grid alignment plus the width it stretches to */
  function place(id: HudRegionId, stretchWidth = '100%', otherWidth = ''): string {
    const r = hudLayout[id];
    if (r.mode === 'absolute') return regionStyleCss(r);
    return `justify-self:${r.justify};align-self:${r.align}${r.justify === 'stretch' ? `;width:${stretchWidth}` : otherWidth ? `;width:${otherWidth}` : ''}`;
  }
  function applyHudLayout(nextHud: HudLayout, nextModal: GridArea) {
    if (validateHudLayout(nextHud) || !validGridArea(nextModal)) return;
    hudLayout = copyHudLayout(nextHud);
    modalLayout = { ...nextModal };
    hudLayoutNotice = null;
    if (!showcaseMode) localStorage.setItem(HUD_LAYOUT_STORAGE_KEY, JSON.stringify({ version: HUD_LAYOUT_VERSION, hud: hudLayout, modal: modalLayout, notice: null }));
    layoutEditorOpen = false;
  }
  const openLayoutEditor = () => { layoutEditorOpen = true; more = false; };
  let selectedTreeNodeId = $state('impact.1');
  const selectedTreeVerdict = $derived(canSpendTree(gameState, selectedTreeNodeId));
  let sheetOpen = $state(false);
  /** the sheet's own tabs: the final values, and the life-skill reference read */
  let sheetTab = $state<'stats' | 'life'>('stats');
  function sheetTabKeydown(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    sheetTab = event.key === 'Home' ? 'stats' : event.key === 'End' ? 'life' : sheetTab === 'stats' ? 'life' : 'stats';
    document.getElementById(`sheet-tab-${sheetTab}`)?.focus();
  }
  let saveNote = $state('');
  type AccountWriterState = 'checking' | 'owner' | 'readonly' | 'waiting' | 'unsupported';
  let accountWriterState = $state<AccountWriterState>('checking');
  let accountWriterLease: Extract<AccountWriterLockResult, { status: 'acquired' }> | null = null;
  let takeoverController: AbortController | null = null;
  let takeoverSlot = $state<SlotName>('slot1');
  const canWriteAccount = $derived(accountWriterState === 'owner');
  const transactionWriter = $derived(showcaseMode ? showcaseSample !== 'read-only' : canWriteAccount);
  let marketView = $state<'trade' | 'workshop' | 'stall' | 'deliveries' | 'black-market'>('trade');
  let marketTownId = $state('');
  const deliveryNotice = $derived(Object.values(gameState.town.contracts).flat().find((contract) => contract.status === 'open' && !contract.announced));
  const accountWriterMessage = $derived(accountWriterState === 'owner'
    ? 'This tab controls saves for the account.'
    : accountWriterState === 'readonly'
      ? 'Another tab controls this account. You can inspect saves here; progression and transactions wait for takeover.'
      : accountWriterState === 'waiting'
        ? 'Waiting for the other tab to release account control.'
        : accountWriterState === 'unsupported'
          ? 'This browser cannot coordinate account saves. Saving is disabled to protect progress.'
          : 'Checking account save access…');
  function requireAccountWriter(action: string): boolean {
    if (showcaseMode || canWriteAccount) return true;
    saveNote = `${accountWriterMessage} Open Save and take over before ${action}.`;
    return false;
  }

  let settings = $state<ClientSettings>({ ...DEFAULT_SETTINGS });
  function setSetting<K extends keyof ClientSettings>(k: K, v: ClientSettings[K]) {
    settings[k] = v;
    if (!showcaseMode) void writeSettings(settings);
  }
  const SPEEDS: (1 | 2 | 4)[] = [1, 2, 4];
  function setSpeed(m: 1 | 2 | 4) {
    speed = m;
    setSetting('speed', m);
    saveNote = !showcaseMode && !canWriteAccount
      ? `Clock speed ×${m} will apply when this tab controls progress.`
      : running ? `the clock runs ×${m}` : saveNote;
  }

  /** Escape uncovers the field: map focus drops, the dock overlays go with it, and a pick that was
      never travelled to is dropped rather than left ringing under the HUD. A desk screen closes itself. */
  function onfieldKey(ev: KeyboardEvent) {
    if (showcaseMode) return;
    // Native control activation owns Enter/Space; folding a HUD group must not also pause the game.
    if ((ev.key === 'Enter' || ev.key === ' ') && (ev.target as HTMLElement | null)?.closest('button, summary, a[href]')) return;
    if (ev.key === 'Escape') {
      if (isTypingTarget(ev.target)) return;
      // one Escape owner: an open sub-screen closes itself and keeps the field's own read untouched
      if (document.querySelector('[role="dialog"]')) return;
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

  let stashTab = $state(0);
  let carriedSort = $state<SortKey>('level');
  type InvTab = 'inv' | 'stash';
  let invTab = $state<InvTab>('inv');
  let compactInventoryTabs = $state(false);
  $effect(() => {
    const query = window.matchMedia('(max-width: 1200px)');
    const update = () => (compactInventoryTabs = query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });

  function inventoryTabKeydown(event: KeyboardEvent) {
    const tab = (event.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]');
    const tabs = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    const index = tab ? tabs.indexOf(tab) : -1;
    if (index < 0 || !tabs.length) return;

    let next = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;

    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  }

  const VIEW_ORDER: ('terrain' | 'band' | 'gate')[] = ['terrain', 'band', 'gate'];

  /**
   * The one keyboard path through the client, and the one way any screen opens. It answers in the same
   * order the rail is read: a screen first, then the field's own switches, then the sheet's — because the
   * map's keys only mean something while the sheet is the thing in focus.
   */
  function runAction(action: string) {
    if (action === 'screen.field') { panel = null; sheetOpen = false; picked = null; pickedCell = null; return; }
    if (action === 'sheet.open') { sheetOpen = !sheetOpen; return; }
    if (action?.startsWith('item.')) { useQuickSlot(Number(action.slice(5)) - 1); return; }
    if (action === 'game.pause') {
      if (!requireAccountWriter('pausing or resuming')) return;
      running = !running;
      saveNote = running ? 'the clock is running again' : 'paused — the field holds still';
      return;
    }
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
  const canStash = $derived(atSettlement(gameState) && stashTabCount(gameState) > 0);
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
  // words and status procs beside them), so the shared column keeps only what names no body — and a
  // walk floats nothing, so the word on the field is the whole of its read
  const selfFx = $derived(ring.filter((e) => e.side === 'self' && e.kind !== 'travel' && e.kind !== 'level' && e.kind !== 'block' && e.kind !== 'proc' && e.kind !== 'taken').slice(0, 5));
  const latestTaken = $derived(ring.find((e) => e.side === 'self' && e.kind === 'taken') || null);
  const latestOrbHeal = $derived(ring.find((e) => e.side === 'self' && e.kind === 'heal') || null);
  const plates = $derived([...gameState.group]);
  /** the field is a fight, not a backdrop: cards answer to the Field tab or to a live fight only */
  const inCombat = $derived(gameState.phase === 'fighting' && gameState.group.length > 0);
  const showCombatCards = $derived(panel === null || inCombat);
  /** the row that last fired — a press or a buff coming up are both the order being worked — so the bar
   *  lights the slot that actually pressed instead of the one the eye expects */
  const latestFire = $derived((gameState.fx || []).find((e) => !!e.skillId && (e.kind === 'cast' || e.kind === 'buff')) || null);
  const latestLevel = $derived((gameState.fx || []).find((e) => e.kind === 'level') || null);

  const xpPct = $derived(Math.max(0, Math.min(100, (gameState.player.xp / eng.xpToNext(gameState.player.level)) * 100)));

  type FeedLine = { id: number; text: string; tone: string; chan: 'combat' | 'loot' | 'system' };
  type ChatTab = 'all' | 'combat' | 'loot' | 'system';
  let feed = $state<FeedLine[]>([]);
  let feedSeen = 0;
  const CHAT_TABS: [ChatTab, string][] = [['all', 'all'], ['combat', 'combat'], ['loot', 'loot'], ['system', 'system']];
  /** which channel of the chronicle is showing: one stream, read one way at a time, the way a chat box
      splits what a kill said from what the world said */
  let chatTab = $state<ChatTab>('all');
  const chatShown = $derived((chatTab === 'all' ? feed : feed.filter((l) => l.chan === chatTab)).slice(-8));
  const objectivesRead = $derived({ goal: describeGoal() });
  $effect(() => {
    const fresh = ring.filter((e) =>
      (e.kind === 'kill' || e.kind === 'level' || e.kind === 'travel' || e.kind === 'buff' || e.kind === 'drop') && e.text);
    if (!fresh.length) return;
    const top = Math.max(...fresh.map((e) => e.id));
    const add = feedEventsAfter(fresh, feedSeen);
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

  let awayReport = $state<{ mins: number; secs: number; capped: boolean; kills: number; drops: number; junk: number; gold: number; stones: number; levels: number; quality: string } | null>(null);

  // the away report's own reads live in `ui/hud.ts`, where a test can reach them

  let c = $derived(withHunger(withMeal(buildCharacter(gameState.player.level, gameState.gear, carried(gameState), masteryLevel(gameState, heldWeaponName(gameState) || ''), effectsActive(gameState.skills), gameState.player.points, gameState.player.treeRanks, lifeSkillBonuses(gameState)), gameState), gameState));
  const hpFill = $derived(c.maxHp > 0 ? Math.max(0, Math.min(1, shownHp / c.maxHp)) : 0);
  const esFill = $derived(c.es > 0 ? Math.max(0, Math.min(1, shownEs / c.es)) : 0);
  const manaFill = $derived(c.maxMana > 0 ? Math.max(0, Math.min(1, shownMana / c.maxMana)) : 0);
  /** The shield breaking. ES is a pool rather than a body, so the sim raises no event for it going down:
   *  the client watches the pool itself and mounts one shatter on the drop to nothing, which is the one
   *  moment the pool is worth a whole gesture. `shatter` counts the breaks, so a shield that comes back
   *  and falls again earns a new one. The first pass only seeds the previous value — a character that
   *  starts without a shield has not just lost one. */
  let shatter = $state(0);
  let lastEs = 0;
  let esSeeded = false;
  $effect(() => {
    const es = gameState.player.es;
    if (!esSeeded) { esSeeded = true; lastEs = es; return; }
    if (lastEs > 0 && es <= 0 && c.es > 0) shatter++;
    lastEs = es;
  });
  let zone = $derived(eng.zoneById(gameState.zone));
  const fieldworkSite = $derived(fieldSite(gameState.cell));
  const fieldCampHere = $derived(atFieldCamp(gameState));
  const fieldworkBusy = $derived(!!gameState.walk || gameState.phase === 'camp' || !!gameState.dungeon);

  /** The tracked open wants, in the objectives column: town, good, progress and the deadline clock,
   *  read from the same delivery sim the Market board reads — tracking is a reminder, never an accept. */
  const trackedDeliveries = $derived(gameState.town.trackedContractIds
    .map((id) => contractById(gameState, id))
    .filter((contract) => contract && contract.status === 'open'));
  const deliveryPause = $derived(deliveryPauseReason(gameState));
  const settlementName = (id: string) => TOWN.settlements.find((town) => town.id === id)?.name || id;
  const deliveryClock = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  // The bag the slot grid draws, in the shape the player chose. Order and mode are theirs; every value
  // inside a slot is read from the engine, never recomputed here.
  let bagMode = $state<'grid' | 'list'>('grid');
  let bagSort = $state<SortKey>('level');

  /** The piece a candidate is read against: where the body carries a pair, the weaker of the two —
   *  the same piece the bag filter compares and Auto Equip replaces, so every "better than worn"
   *  badge, item card and craft read answers to the one number the drop decision uses. */
  const wornOf = (slot: string) => {
    const worn = gameState.gear.filter((g): g is Item => Boolean(g) && g!.slot === slot);
    if (worn.length < 2) return worn[0] || null;
    const score = (g: Item) => loot.score({ ...g, q: g.q ?? 0 });
    return worn.reduce((a, b) => (score(a) <= score(b) ? a : b));
  };
  /** One bag, one grid: kept gear pieces and carried stacks sit in the same slots and share the count. */
  const bagEntries = $derived(sortEntries([
    ...gameState.bag.map((item, i) => gearEntry(item, i)),
    ...bagStacks(gameState).map((s, i) => stackEntry(s, i)),
  ], bagSort));

  // the bag's own view: which kind is shown, what the search matches, and the quality cut. These narrow
  // what the grid draws — they never touch what the bag holds, so the order Equip addresses is the bag's.
  // The kind cut is the panel's own tab rail: one tab per way a player shops the bag, and every tab reads
  // the same `bagKindOf` answer the grid filters by, so a count can never disagree with what is drawn.
  type BagCat = 'all' | 'weapon' | 'equipment' | 'consume' | 'misc';
  const BAG_TABS: { id: Exclude<BagCat, 'all'>; label: string; art: string; kinds: string[] }[] = [
    { id: 'weapon', label: 'Weapon', art: 'crossed-swords-1', kinds: ['weapon'] },
    { id: 'equipment', label: 'Equipment', art: 'plate-chestplate', kinds: ['armour'] },
    { id: 'consume', label: 'Consume', art: 'potion-bottle', kinds: ['draughts', 'food'] },
    { id: 'misc', label: 'Misc', art: 'sack', kinds: ['stones', 'herbs', 'materials', 'junk'] },
  ];
  let bagCat = $state<BagCat>('all');
  let bagQuery = $state('');
  let bagTier = $state('all');
  const bagKindOf = (e: { kind: string; slot: string; stack?: { group?: string } }) => e.kind === 'stack'
    ? (e.stack?.group === 'condensed' ? 'draughts' : (e.stack?.group ?? 'junk'))
    : (e.slot === 'main hand' || e.slot === 'off hand') ? 'weapon' : 'armour';
  /** Every kind a tab gathers. The Bag tab gathers none, which is what makes it "all of it". */
  const bagKindsOf = (id: BagCat): string[] => (id === 'all' ? [] : BAG_TABS.find((t) => t.id === id)?.kinds ?? []);
  const bagCount = (id: BagCat): number => id === 'all' ? bagEntries.length : bagEntries.filter((e) => bagKindsOf(id).includes(bagKindOf(e))).length;
  const bagShown = $derived(bagEntries.filter((e) => {
    const kinds = bagKindsOf(bagCat);
    if (kinds.length && !kinds.includes(bagKindOf(e))) return false;
    if (bagTier !== 'all' && e.kind === 'gear' && String(e.item?.quality ?? '') !== bagTier) return false;
    const q = bagQuery.trim().toLowerCase();
    return !q || `${e.title} ${e.sub}`.toLowerCase().includes(q);
  }));
  /** The tab the panel is standing on, so `aria-labelledby` names the control the player actually pressed. */
  const invTabLabelId = $derived(invTab === 'stash' ? 'inventory-tab-stash' : bagCat === 'all' ? 'inventory-tab-bag' : `inventory-tab-${bagCat}`);
  /** What the bag and the warehouse are promised to: held pieces grouped by set, named through the collection. */
  const heldSummary = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const item of [...gameState.bag, ...gameState.stash.flat()]) {
      if (item && item.heldFor) counts[item.heldFor] = (counts[item.heldFor] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([id, n]) => `${n} × ${col.sets.find((set: any) => set.id === id)?.name || id}`)
      .join(' · ');
  });
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
  function doSpendTree(nodeId: string) {
    const r = spendTreePoint(gameState, nodeId);
    if (r.ok) gameState = { ...gameState };
    return r;
  }
  function doRespecTree() {
    if (!viewHere) return;
    if (respecTree(gameState).ok) gameState = { ...gameState };
  }
  function respec() {
    if (!viewHere) return;
    if (respecStats(gameState).ok) gameState = { ...gameState };
  }

  function step() {
    if (!showcaseMode && !canWriteAccount) return;
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

  const AUTOSAVE_SEC = 30;

  onMount(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let autosaveTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    if (showcaseMode) {
      document.body.classList.add('ui-showcase');
      settings = { ...DEFAULT_SETTINGS };
      speed = settings.speed || 1;
      return () => document.body.classList.remove('ui-showcase');
    }
    try {
      // Older layouts kept vitals and Game controls in separate regions. The v6 migration keeps the
      // combat field placement, combines all eight controls at bottom-right, and moves stock panels below the wrapped rail.
      const savedLayout = localStorage.getItem(HUD_LAYOUT_STORAGE_KEY)
        || HUD_LAYOUT_PREVIOUS_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find((value) => value !== null);
      if (savedLayout) {
        let migrated;
        try { migrated = migrateHudLayout(savedLayout); } catch { migrated = salvageHudLayout(savedLayout); }
        hudLayout = migrated.hud;
        modalLayout = migrated.modal;
        hudLayoutNotice = migrated.notice;
        if (migrated.notice) saveNote = migrated.notice;
        localStorage.setItem(HUD_LAYOUT_STORAGE_KEY, JSON.stringify({ version: HUD_LAYOUT_VERSION, hud: hudLayout, modal: modalLayout, notice: hudLayoutNotice }));
        for (const key of HUD_LAYOUT_PREVIOUS_STORAGE_KEYS) localStorage.removeItem(key);
      }
    } catch {
      // storage itself is unreachable (private mode, quota): play on the defaults in memory and
      // leave whatever is on disk alone rather than destroying a layout we could not read
    }
    // The unload flush must be synchronous: IndexedDB commits asynchronously and the page can be gone
    // first, so `writeSaveSync` writes the mirror in one turn. It refreshes the away stamp too, so a
    // reload right after cannot count the same absence twice.
    const flushSync = () => {
      if (!canWriteAccount || !lastSlot) return;
      gameState.lastSavedAt = Date.now();
      writeSaveSync(lastSlot, gameState);
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flushSync(); };
    (async () => {
      const writerLock = await requestAccountWriterLock();
      if (disposed) {
        if (writerLock.status === 'acquired') writerLock.release();
        return;
      }
      if (writerLock.status === 'acquired') {
        accountWriterLease = writerLock;
        accountWriterState = 'owner';
      } else if (writerLock.status === 'busy') {
        accountWriterState = 'readonly';
      } else {
        accountWriterState = 'unsupported';
      }
      settings = await readSettings();
      speed = settings.speed || 1;
      // monotonic clock: catch up on the time between sessions, capped by the save rule. The catch-up
      // yields between slices so a long absence cannot block first paint.
      const away = (Date.now() - (gameState.lastSavedAt || Date.now())) / 1000;
      // no upper bound: the window itself is capped by the save rule (`offline_cap_hr`), so an old
      // file still catches up on the capped window instead of being skipped for being too old
      if (away > 5 && canWriteAccount) {
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
          if (!canWriteAccount || paused || !running) { acc = 0; cooldownStepMs = 0; return; }
          const batch = schedulerBatch(acc, speed, elapsed);
          acc = batch.acc;
          if (batch.ticks > 0) cooldownStepMs = (batch.ticks / speed) * 1000;
          for (let i = 0; i < batch.ticks; i++) step();
        }, WAKE_SEC * 1000);
        autosaveTimer = setInterval(() => { if (canWriteAccount && lastSlot) void doSave(lastSlot, true); }, AUTOSAVE_SEC * 1000);
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
      takeoverController?.abort();
      accountWriterLease?.release();
      accountWriterLease = null;
    };
  });

  function equip(index: number) {
    // the rule lives in `sim/gear.ts`, where the tests can reach it too; this copy only makes the
    // panel re-read the gameState the verb mutated in place
    const r = equipFromBag(gameState, index);
    if (!r.ok) equipNote = `Cannot put it on: ${r.why}`;
    gameState = { ...gameState };
  }

  function doSalvage(index: number) {
    const r = salvageBag(gameState, index);
    equipNote = r.ok ? 'That piece dissolved — Iron Ore and Scrap entered the resources' : `Cannot salvage: ${r.why}`;
    gameState = { ...gameState };
  }

  /** The one bulk press for the carried pieces: the same verdict a fresh drop gets, run over the bag. */
  function doRunFilter() {
    const r = runFilterNow(gameState);
    equipNote = r.why ? `Filter run stopped: ${r.why}` : r.dissolved
      ? `Filter melted ${r.dissolved} piece${r.dissolved === 1 ? '' : 's'}${r.spared ? ` · ${r.spared} left alone` : ''}`
      : 'Nothing carried fails the filter right now';
    gameState = { ...gameState };
  }

  function doSaveFilterPreset(i: number) {
    if (!savePreset(gameState, i)) { equipNote = `Preset ${i + 1} is not the character's to use — Collector sets pay the extra slots`; return; }
    equipNote = `Saved the bag filter to preset ${i + 1}`;
    gameState = { ...gameState };
  }

  function doLoadFilterPreset(i: number) {
    if (!loadPreset(gameState, i)) return;
    equipNote = `Loaded preset ${i + 1} — every slot's rule is the preset's now`;
    gameState = { ...gameState };
  }

  function doClearFilterPreset(i: number) {
    clearPreset(gameState, i);
    gameState = { ...gameState };
  }

  function doUnequip(cell: number) {
    const r = unequip(gameState, cell);
    equipNote = r.ok ? 'That piece came off into the bag' : `Cannot take it off: ${r.why}`;
    gameState = { ...gameState };
  }

  /**
   * What a right-click offers, per grid. The bag's verbs are the moves a piece can actually make from
   * there — onto the body, into the warehouse (only where a settlement has made that legal), or into a
   * stone. The worn grid's one verb is the way back off the body. Both lists read the same sim calls the
   * panel's buttons already make; nothing here is a second rule.
   */
  function bagPieceActions(entry: SlotEntry): MenuItem[] {
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
      hint: 'Iron Ore + Scrap',
      danger: true,
      disabled: Boolean(it.locked || it.heldFor),
      onpick: () => doSalvage(entry.index),
    });
    return out;
  }

  function wornActions(entry: SlotEntry): MenuItem[] {
    if (entry.kind !== 'worn') return [];
    return [{ label: 'Take it off', hint: 'back to the bag', onpick: () => doUnequip(entry.index) }];
  }

  let equipNote = $state('');
  /**
   * One press, the whole body dressed from what the character carries. The choice itself — what counts as
   * best, and what must never be moved — is `sim/gear.ts`'s, and the tests reach it there; this only says
   * what came of it, in the numbers the player acts on.
   */
  function doBestEquip() {
    const r = autoEquip(gameState, settings.equipMargin || 0);
    gameState = { ...gameState };
    // the press just moved pieces out of the bag, so the bag is what the player needs to see now
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
    if (!requireAccountWriter('starting a hunt')) return;
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
    if (!requireAccountWriter('hunting')) return;
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

  function doStartFieldAction(kind: 'mine' | 'grove' | 'fish') {
    const r = startFieldAction(gameState, kind);
    saveNote = r.ok ? (kind === 'mine' ? 'Mining started' : kind === 'grove' ? 'Woodcutting started' : 'Fishing started') : `Cannot gather: ${r.why}`;
    gameState = { ...gameState };
  }

  function doStopFieldAction() {
    stopFieldAction(gameState);
    saveNote = 'Gathering stopped';
    gameState = { ...gameState };
  }

  function doCookMeal(id: string, count = 1) {
    const recipe = fieldwork.recipeById[id];
    const r = cookMeal(gameState, id, count);
    const made = r.made ?? (r.ok ? 1 : 0);
    saveNote = r.ok ? `${recipe?.name || id} · ${made} cooked${r.why ? ` · stopped: ${r.why}` : ''}` : `Cannot cook: ${r.why}`;
    if (r.ok) push(gameState, `Camp kitchen · ${recipe?.name || id} ×${made}`);
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
    if (showcaseMode) return;
    if (!canWriteAccount) { saveNote = 'This tab does not control account saves.'; return; }
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
    if (showcaseMode) { snaps = []; snapNote = 'Snapshots are disabled in the Showcase.'; return; }
    snaps = await listSnapshots(snapSlot);
    snapNote = snaps.length ? '' : 'No backup yet — one is owed on the next level up, craft or timer.';
  }

  async function restore(index: number) {
    if (showcaseMode || !canWriteAccount) return;
    try {
      const s = await restoreSnapshot(snapSlot, index);
      if (!s) { snapNote = 'That backup is gone'; return; }
      statuses = {};
      gameState = s;
      const what = describeSnap(snaps[index]);
      await loadSnaps();
      snapNote = `Rewound ${snapSlot} to the backup taken ${what} — the character went back whole, stones and craft counts with it`;
    } catch (error) {
      snapNote = `Cannot rewind: ${error instanceof Error ? error.message : 'the backup failed validation'}`;
    }
  }


  function editRule(slot: string, patch: Record<string, unknown>) {
    setRule(gameState.filter, slot, patch as any);
    gameState = { ...gameState };
  }

  async function doLoad(slot: SlotName) {
    if (showcaseMode) return;
    paused = true;
    try {
      const s = await readSave(slot);
      if (!s) { saveNote = `${slot} is empty`; return false; }
      statuses = {};
      gameState = { ...s };
      const away = (Date.now() - (s.lastSavedAt || Date.now())) / 1000;
      const before = snapCounters(gameState);
      const r = canWriteAccount ? await catchUpAsync(gameState, statuses, away, { autoSkills: settings.autoSkills !== false }) : { simulated: 0, capped: false };
      if (canWriteAccount && settings.autoEquip !== false) equipCarriedBest();
      awayReport = settings.offlineReport ? buildAwayReport(before, Math.round(away / 60), r.simulated, r.capped, gameState) : null;
      // this slot becomes the autosave home, and the away window is spent (a reload must not recount it)
      lastSlot = slot;
      takeoverSlot = slot;
      if (canWriteAccount) gameState.lastSavedAt = Date.now();
      saveNote = canWriteAccount
        ? `Loaded ${slot} — ${r.simulated} sec caught up`
        : `Loaded ${slot} read-only — ${r.simulated} sec caught up`;
      gameState = { ...gameState };
      return true;
    } catch (error) {
      // a save that fails migration validation (removed content, illegal transitions) must say so —
      // an unhandled rejection leaves the player staring at the slot they just clicked
      saveNote = `Cannot load ${slot}: ${error instanceof Error ? error.message : 'the save failed validation'}`;
      return false;
    } finally {
      paused = false;
    }
  }

  async function takeOverAccount() {
    if (showcaseMode || accountWriterState !== 'readonly') return;
    const controller = new AbortController();
    takeoverController = controller;
    accountWriterState = 'waiting';
    const result = await requestAccountWriterLock({ wait: true, signal: controller.signal });
    if (takeoverController !== controller) {
      if (result.status === 'acquired') result.release();
      return;
    }
    takeoverController = null;
    if (result.status !== 'acquired') {
      accountWriterState = result.status === 'cancelled' ? 'readonly' : 'unsupported';
      return;
    }
    accountWriterLease = result;
    accountWriterState = 'owner';
    const loaded = await doLoad(takeoverSlot);
    if (!loaded) {
      accountWriterLease.release();
      accountWriterLease = null;
      accountWriterState = 'readonly';
      saveNote = `${takeoverSlot} is empty. Choose a slot with a saved character before taking over.`;
    }
  }

  function cancelTakeover() {
    takeoverController?.abort();
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
    if (showcaseMode || !canWriteAccount) return;
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
    if (!canWriteAccount) return;
    gameState = newGame();
    statuses = {};
    saveNote = '';
  }

  // the panel follows the zone the character is actually hunting, so an auto-travel step cannot
  // leave it showing the town the character walked away from
  const townId = $derived(settlementOfZone(gameState.zone)?.id || 'eastgate');
  const town = $derived(settlementById(townId));
  let picked = $state<string | null>(null);
  let pickedCell = $state<Picked | null>(null);
  let deskTab = $state<'services' | 'stall' | 'guild' | 'hunt' | 'walk'>('services');
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
  // The readout calls the drawn frame 100%: the map is drawn at double the base hex size there (owner
  // ruling), so the scale is a plain multiplier over `MAP_BASE_ZOOM`, not the readout number itself. The
  // sheet opens and resets at 75% of that frame (owner ruling) — a wider first look, over the same
  // reference the readout, the zoom buttons and the fit math all count from. The zoom range is 25%–300%
  // (owner ruling); the endless ground spans three fields past each edge, so the frame still rests on
  // drawn ground at the floor.
  const MAP_BASE_ZOOM = 2, MAP_MIN_ZOOM = 0.5, MAP_MAX_ZOOM = 6;
  /** The frame the sheet opens on and `reset` returns to: three quarters of the drawn 100% frame. */
  const MAP_OPEN_ZOOM = MAP_BASE_ZOOM * 0.75;
  const HEX_NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
  ];
  const MAP_ARROW_VECTORS = {
    ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1],
  } as const;
  let zoom = $state(MAP_OPEN_ZOOM);
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
  const rampCss = $derived(E.mob.zones.map((_: any, i: number) => ramp(i)).join(','));
  /**
   * The sheet is repainted after every `{@html}` rebuild — the fills, the walk graph, the cell ids, the
   * plotted route and the character's own hex. The paint itself lives in `ui/map.ts` (the map cluster's
   * reader); this effect only holds the reactive reads and hands them over, so a `gameState` change and a
   * markup rebuild both drive one repaint.
   */
  $effect(() => {
    void mapMarkup;
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
    if (panel === null && !sheetOpen) { panel = 'map'; return; }
    const hit = ev.target as Element | null;
    const mark = hit?.closest?.('g[data-node]')?.getAttribute('data-node');
    const cell = hit?.closest?.('polygon.cell')
      || (mark ? sheet?.querySelector(`polygon.cell.town[data-node="${mark}"]`) : null);
    const ax = cell?.getAttribute('data-ax');
    if (!cell || !ax || (ax === `${pickedCell?.q},${pickedCell?.r}`)) {
      picked = null; pickedCell = null; saveNote = ''; return;
    }
    pickMapCell(cell);
  }
  function pickMapCell(cell: Element) {
    const next = cellLabel(cell);
    saveNote = '';
    pickedCell = next;
    picked = next.kind === 'bare' ? null : cell.getAttribute('data-node') || null;
  }
  function select(id: string) {
    const cell = settlementCell(id);
    if (picked === id && pickedCell?.kind === 'town') { picked = null; pickedCell = null; return; }
    picked = id;
    pickedCell = cell ? { key: sheet?.querySelector(`polygon.cell.town[data-node="${id}"]`)?.getAttribute('data-cell') || '', q: cell.q, r: cell.r, kind: 'town', label: settlementById(id)!.name, sub: null, wild: null } : null;
  }
  function adjacentMapCell(origin: SVGPolygonElement, direction: readonly [number, number]) {
    if (!sheet) return null;
    const ax = origin.getAttribute('data-ax');
    if (!ax) return null;
    const [q, r] = ax.split(',').map(Number);
    if (!Number.isFinite(q) || !Number.isFinite(r)) return null;

    const box = origin.getBBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const [ux, uy] = direction;
    let nearest: SVGPolygonElement | null = null;
    let nearestAngle = Infinity;
    for (const [dq, dr] of HEX_NEIGHBORS) {
      const candidate = sheet.querySelector<SVGPolygonElement>(`polygon.cell[data-ax="${q + dq},${r + dr}"]`);
      if (!candidate) continue;
      const nextBox = candidate.getBBox();
      const dx = nextBox.x + nextBox.width / 2 - cx;
      const dy = nextBox.y + nextBox.height / 2 - cy;
      const forward = dx * ux + dy * uy;
      if (forward <= 0) continue;
      const lateral = Math.abs(dx * uy - dy * ux);
      const angle = lateral / forward;
      if (angle < nearestAngle) { nearest = candidate; nearestAngle = angle; }
    }
    return nearest;
  }
  /** Enter invokes the same primary action displayed on the selected destination card. */
  function onMapKey(ev: KeyboardEvent) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.key === 'Escape' && pickedCell) {
      ev.preventDefault(); ev.stopPropagation(); clearMapSelection(); return;
    }
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      ev.stopPropagation();
      const position = pickedCell || currentCell(gameState);
      const origin = sheet?.querySelector<SVGPolygonElement>(`polygon.cell[data-ax="${position.q},${position.r}"]`);
      const target = origin && adjacentMapCell(origin, MAP_ARROW_VECTORS[ev.key]);
      if (target) pickMapCell(target);
      return;
    }
    if (ev.key === 'Enter' && pickedCell) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!ev.repeat) activatePickedDestination();
    }
  }
  function mapOrigin() {
    const r = sheet?.getBoundingClientRect();
    return r ? { x: r.left + r.width * .5, y: r.top + r.height * .46 } : null;
  }
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
    zoom = MAP_OPEN_ZOOM; panX = 0; panY = 0;
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
  const pickedPrimary = $derived(pickedDest ? destinationPrimary(gameState, pickedDest, transactionWriter) : null);

  function clearMapSelection() {
    picked = null; pickedCell = null; saveNote = '';
    document.querySelector<HTMLElement>('.map-back')?.focus();
  }

  function activatePickedDestination() {
    const action = pickedPrimary;
    if (!action || action.disabled || !pickedCell) return;
    if (action.kind !== 'town' && !requireAccountWriter('using this destination')) return;
    switch (action.kind) {
      case 'walk': doWalk(pickedCell); break;
      case 'town': panel = 'desk'; break;
      case 'hunt': doHuntHere(); break;
      case 'dungeon': doDungeon(); break;
      case 'retreat': doRetreat(); break;
      case 'mine': case 'grove': doStartFieldAction(action.kind); break;
      case 'stop-gather': doStopFieldAction(); break;
    }
  }
  /**
   * The destination card's place on screen: the end of its anchor that has the room (AGENTS.md §Interface Surfaces) — above
   * the picked cell's own mark, or below it when the sheet's top edge is nearer — clear of the menu rail and inside the map.
   * The card is placed by the box it measures, so the measure runs again whenever the sheet moves the
   * cell (a pan or a zoom) or the pick moves to another cell.
   */
  let cardAt = $state<{ x: number; y: number } | null>(null);
  let mapcardEl = $state<HTMLDivElement | null>(null);
  let mapcardMeasure = $state(0);
  $effect(() => {
    const card = mapcardEl;
    if (!card) return;
    const observer = new ResizeObserver(() => mapcardMeasure++);
    observer.observe(card);
    const resize = () => mapcardMeasure++;
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  });
  $effect(() => {
    if (!pickedCell || panel !== 'map' || !sheet) { cardAt = null; return; }
    // zoom, pan and the mounted card are read for the tracking alone: the rects below already carry
    // them physically, and the reads are what make the measure rerun when they move
    void zoom; void panX; void panY; void mapcardEl; void mapcardMeasure;
    const poly = sheet.querySelector(`polygon.cell[data-ax="${pickedCell.q},${pickedCell.r}"]`) as SVGGraphicsElement | null;
    if (!poly) { cardAt = null; return; }
    const b = poly.getBoundingClientRect();
    const area = sheet.getBoundingClientRect();
    const m = Number.parseFloat(getComputedStyle(sheet).getPropertyValue('--spacing-md')) || 0;
    const railBottom = document.querySelector('.stage nav.rail')?.getBoundingClientRect().bottom ?? area.top;
    const stage = document.querySelector('.stage')?.getBoundingClientRect();
    const minY = Math.max(area.top + m, railBottom + m, (stage?.top ?? 0) + m);
    const safeBottom = Math.min(area.bottom, window.innerHeight);
    const availableHeight = Math.max(0, safeBottom - minY - m);
    if (mapcardEl && availableHeight > 0) mapcardEl.style.maxHeight = `${availableHeight}px`;
    const cw = mapcardEl?.offsetWidth ?? 0;
    const ch = mapcardEl?.offsetHeight ?? 0;
    const maxY = Math.max(minY, safeBottom - ch - m);
    const aboveY = b.top - ch - m;
    const belowY = b.bottom + m;
    const centreX = b.left + b.width / 2;
    const blockers = Array.from(document.querySelectorAll('.field-feed, .field-objectives, .topright, .field-travel-actions, .commands-dock, .targetbar, .combat-player-slot'))
      .map((el) => el.getBoundingClientRect());
    const clampX = (value: number) => cw
      ? Math.min(area.right - cw / 2 - m, Math.max(area.left + cw / 2 + m, value))
      : value;
    const xCandidates = [...new Set([centreX, ...blockers.flatMap((r) => [r.left - cw / 2 - m, r.right + cw / 2 + m])].map(clampX))];
    const yCandidates = [...new Set([aboveY, belowY, minY, maxY])].filter((y) => y >= minY && y <= maxY);
    const placements = xCandidates.flatMap((x) => yCandidates.map((y) => {
      const collisions = blockers.reduce((sum, r) => {
        const w = Math.max(0, Math.min(x + cw / 2, r.right) - Math.max(x - cw / 2, r.left));
        const h = Math.max(0, Math.min(y + ch, r.bottom) - Math.max(y, r.top));
        return sum + w * h;
      }, 0);
      const distance = Math.abs(x - centreX) + Math.abs(y - aboveY);
      return { x, y, score: collisions * 1000 + distance };
    }));
    const best = placements.sort((a, bY) => a.score - bY.score)[0];
    const x = best?.x ?? clampX(centreX);
    const y = best?.y ?? minY;
    // `.stage` owns the map transform, so its fixed descendants resolve left/top from that containing block.
    // The measurements above are viewport coordinates; convert them back before assigning inline offsets.
    cardAt = { x: x - (stage?.left ?? 0), y: y - (stage?.top ?? 0) };
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
  const firstBand = $derived(E.mob.zones[0].levels);
  const lastBand = $derived(E.mob.zones[E.mob.zones.length - 1].levels);
  const liveBands = $derived(E.mob.zones.filter((z: any) => z.levels[0] <= gateLevel).length);
  const townStock = $derived(stockOf(town?.id ?? ''));
  const junkTotal = $derived(Object.values(gameState.junk).reduce((a: number, b: number) => a + b, 0));
  const junkLines = $derived(Object.entries(gameState.junk)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([item, n]) => `${item} ×${n}`));
  /** The purse, the stone pile and the bag, read as the corner pills — the same counters the
      panels print, summed once here so the field never has to open a panel to be read. */
  const bagFull = $derived(slotsFree(gameState) < 1);
  function doSell() {
    if (!transactionWriter) { saveNote = 'This tab is read-only.'; return; }
    const r = sellJunk(gameState);
    push(gameState, `Counterhand: sold ${r.pieces} junk for ${r.gold.toFixed(TOWN.trade.currency_decimals)} gold`);
    if (r.pieces > 0) fx(gameState, { kind: 'sell', side: 'self', text: `+${fmtNum(r.gold)} gold`, colour: E.elements.crit_colour || 'var(--gold)' });
    gameState = { ...gameState };
  }

  function doTrade(id: string, count: number) {
    if (!transactionWriter) { saveNote = 'This tab is read-only.'; return; }
    const result = sellGoods(gameState, id, count);
    saveNote = result.ok ? `Sold ${count} for ${result.gold.toFixed(TOWN.trade.currency_decimals)} gold` : `Cannot sell: ${result.why}`;
    if (result.ok) push(gameState, saveNote);
    gameState = { ...gameState };
  }

  function doProcess(id: string) {
    if (!transactionWriter) { saveNote = 'This tab is read-only.'; return; }
    const result = processMaterials(gameState, id);
    saveNote = result.ok ? `Made ${fieldwork.workshopById[id].name}` : `Cannot make: ${result.why}`;
    if (result.ok) push(gameState, saveNote);
    gameState = { ...gameState };
  }

  function showTradeRoute(id: string) {
    panel = 'map'; picked = null; select(id);
    if (showcaseMode) document.getElementById('showcase-field')?.scrollIntoView();
  }

  function doBuy(rowId: string, settlementId = town!.id) {
    if (!transactionWriter) { saveNote = 'This tab is read-only.'; return; }
    const r = buy(gameState, settlementId, rowId);
    saveNote = r.ok ? `Bought ${r.row.item}` : `Cannot buy: ${r.why}`;
    gameState = { ...gameState };
  }

  function doDelivery(id: string, count: number) {
    const result = deliver(gameState, id, count, { writer: transactionWriter });
    saveNote = result.ok ? `Delivery ${result.completed ? 'completed' : 'recorded'} · ${result.gold!.toFixed(TOWN.trade.currency_decimals)} gold paid` : `Cannot deliver: ${result.why}`;
    if (result.ok) push(gameState, saveNote);
    gameState = { ...gameState };
  }

  function doBlackMarketBuy(townId: string, offerId: string) {
    const result = buyBlackMarket(gameState, townId, offerId, { writer: transactionWriter });
    saveNote = result.ok ? `Black Market purchase · ${result.offer.kind === 'skill' ? `${sm.byId[result.offer.skill!]?.name} XP Level ${result.offer.level}` : `${result.offer.count} ${result.offer.kind === 'stone' ? result.offer.stone : result.offer.good}`} for ${result.offer.price} gold` : `Cannot buy: ${result.why}`;
    if (result.ok) push(gameState, saveNote);
    gameState = { ...gameState };
  }

  function openBlackMarket() {
    marketView = 'black-market';
    marketTownId = town?.id || '';
    panel = 'market';
  }
  function doTrackDelivery(id: string, tracked: boolean) {
    trackDelivery(gameState, id, tracked, { writer: transactionWriter }); gameState = { ...gameState };
  }
  function doAcknowledgeDelivery(id: string) {
    acknowledgeDelivery(gameState, id, { writer: transactionWriter }); gameState = { ...gameState };
  }
  function doDismissDelivery(id: string) {
    announceDelivery(gameState, id, { writer: transactionWriter }); gameState = { ...gameState };
  }
  function openDeliveryWant(id: string) {
    const contract = Object.values(gameState.town.contracts).flat().find((entry) => entry.id === id);
    if (!contract) return;
    marketView = 'deliveries'; marketTownId = contract.town; panel = 'market';
    if (transactionWriter) doDismissDelivery(id);
    if (showcaseMode) document.getElementById('panel-market')?.scrollIntoView();
  }

  function doClaim(i: number, choice?: string) {
    const t = gameState.town.tasks[i];
    if (t && claimTask(gameState, i, choice)) {
      const paid = t.alt && choice === t.alt.stone ? t.alt : { stone: t.stone, count: t.count };
      push(gameState, `Task paid: ${paid.count} ${paid.stone} stone(s)`);
    } else if (t && t.progress >= t.n && !t.claimed) {
      push(gameState, atSettlement(gameState)
        ? 'Task reward is waiting — make room in the bag, then claim again'
        : 'Visit a settlement to claim the task reward');
    }
    gameState = { ...gameState };
  }

  function goToTask(task: any) {
    if (task?.kind !== 'expedition' || task.subzone == null) return;
    const settlement = TOWN.settlements.find((entry: any) => entry.zone === task.zone);
    if (!settlement || !sheet) { saveNote = 'Open the map to locate this Expedition'; return; }
    const visited = gameState.town.visited.includes(settlement.id);
    const selector = visited
      ? `polygon.cell.sub[data-node="${settlement.id}"][data-sub="${task.subzone}"]`
      : `polygon.cell.town[data-node="${settlement.id}"]`;
    const target = sheet.querySelector(selector);
    if (!target) { saveNote = 'This Expedition location is not on the current map'; return; }
    panel = 'map'; mapHelpOpen = true; pickMapCell(target);
  }

  function togglePickedPatrolStop() {
    if (!requireAccountWriter('editing Patrol route')) return;
    if (!pickedCell || !pickedSettlement || pickedCell.kind !== 'sub' || pickedCell.sub == null) return;
    const result = togglePatrolStop(gameState, {
      zone: pickedSettlement.zone,
      subzone: pickedCell.sub,
      cell: { q: pickedCell.q, r: pickedCell.r, sub: pickedCell.sub, wild: null },
    });
    if (!result.ok) saveNote = `Cannot change Patrol: ${result.why}`;
    else {
      const name = eng.zoneById(pickedSettlement.zone).subzones?.[pickedCell.sub]?.name || 'Sub-zone';
      push(gameState, result.added ? `${name} added to Patrol` : `${name} removed from Patrol`);
      saveNote = '';
    }
    gameState = { ...gameState };
  }

  function doStartPatrol() {
    if (!requireAccountWriter('starting Patrol')) return;
    const result = startPatrolRun(gameState);
    if (!result.ok) saveNote = `Cannot start Patrol: ${result.why}`;
    else { push(gameState, `Patrol started · ${gameState.patrol.stops.length} stops`); saveNote = ''; }
    gameState = { ...gameState };
  }

  function doStopPatrol() {
    if (!requireAccountWriter('stopping Patrol')) return;
    stopPatrolRun(gameState);
    push(gameState, 'Patrol stopped');
    gameState = { ...gameState };
  }

  function doClearPatrol() {
    if (!requireAccountWriter('clearing Patrol route')) return;
    if (clearPatrolStops(gameState)) push(gameState, 'Patrol route cleared');
    gameState = { ...gameState };
  }

  function setPatrolRepeat(repeat: boolean) {
    gameState.patrol.repeat = repeat;
    gameState = { ...gameState };
  }

  function setAutoReturn(enabled: boolean) {
    gameState.autoReturn.enabled = enabled;
    push(gameState, enabled ? `Auto-Return on · stash trip at ${E.road.patrol.auto_return_threshold_pct}% bag` : 'Auto-Return off');
    gameState = { ...gameState };
  }

  function travelTo(id: string) {
    if (!requireAccountWriter('warping')) return;
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

  const warpPrice = (id: string) => warpCost(gameState, id);
  const warpFee = $derived(warpRow()?.m_per_block ?? 0);

  function doWalk(dest: Picked | Cell & { key?: string }) {
    if (!requireAccountWriter('walking')) return;
    const r = startWalk(gameState, dest);
    if (!r.ok) { saveNote = `Cannot walk: ${r.why}`; gameState = { ...gameState }; return; }
    // the walk takes the frame: the map closes and the field carries the walking read, because a sharp
    // map and the HUD cannot share a square (AGENTS.md §Interface Surfaces three-state rule). The pick is spent with it —
    // in field view the card has no box left to measure, and a card parked there sits on the player's own card.
    panel = null;
    picked = null;
    pickedCell = null;
    if (r.forfeit) push(gameState, r.forfeit);
    saveNote = '';
    gameState = { ...gameState };
  }

  const dungeonView = $derived.by(() => {
    const run = gameState.dungeon;
    if (run) return { active: true, left: run.left, total: run.total, cooldown: 0 };
    return { active: false, left: 0, total: 0, cooldown: Math.ceil(cooldownLeft(gameState)) };
  });

  function doDungeon() {
    if (!transactionWriter) return;
    const r = enterDungeon(gameState);
    if (!r.ok) { saveNote = `Cannot enter: ${r.why}`; gameState = { ...gameState }; return; }
    push(gameState, `Entered the dungeon — ${gameState.dungeon!.total} mobs, loot held in escrow until the last one falls`);
    gameState = { ...gameState };
  }

  function doRetreat() {
    const result = retreatDungeon(gameState, { writer: transactionWriter });
    saveNote = result.ok ? `Retreat: selected ${result.selected}, received ${result.received}, rejected ${result.rejected}.` : `Cannot retreat: ${result.why}`;
    gameState = { ...gameState };
  }

  function doScrapAlchemy(count = 1) {
    const result = transmuteScrap(gameState, count, { writer: transactionWriter });
    farmNote = result.ok ? `Alchemy: ${result.made} Value stones + ${result.tier} Tier stones${result.why ? ` · stopped: ${result.why}` : ''}` : `Alchemy: ${result.why}`;
    gameState = { ...gameState };
  }

  let bench = $state<{ where: Where; index: number } | null>(null);
  let benchNote = $state('');
  const benchItem = $derived(bench ? (bench.where === 'gear' ? gameState.gear[bench.index] : gameState.bag[bench.index]) : null);

  function runCraft(op: CraftOp, lineIndex: number, pick?: string) {
    if (!bench) return false;
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
    return r.ok;
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

  function doDrink(name: string) {
    const r = drink(gameState, c, name, gameState.group.some((m) => isBossKind(String(m.kind))));
    farmNote = r.ok ? `Drank ${name}` : `${name}: ${r.why}`;
    gameState = { ...gameState };
  }

  /** the quickbar's own press: the square's draught, through the same fight limits as the board */
  function useQuickSlot(i: number) {
    const name = gameState.quickbar[i];
    if (!name) return;
    const r = drink(gameState, c, name, gameState.group.some((m) => isBossKind(String(m.kind))));
    push(gameState, r.ok ? `Downed the ${name}` : `${name}: ${r.why}`);
    gameState = { ...gameState };
  }

  function doCondense(name: string) {
    const r = condense(gameState, name);
    farmNote = r.ok ? `Condensed ${name} · ${farm.P.condensed.effect_mult}× in one bottle` : `${name}: ${r.why}`;
    gameState = { ...gameState };
  }

  let townNote = $state('');
  const tabs = $derived(stashTabCount(gameState));
  /** The warehouse screen can grow itself: the first unowned space line this settlement stocks that adds
      a tab — the porter's tab ladder or a steward's house — is its Add-a-tab button, at the stall's own price. */
  const stashFolder = $derived.by(() => {
    if (tabs >= STASH_TAB_CAP) return null;
    for (const row of townStock) {
      if (!/^(stash_tab_\d|house_)/.test(row.id)) continue;
      const check = canBuy(gameState, town?.id ?? '', row.id);
      if (check.why === 'sold out here') continue;
      return {
        rowId: row.id, label: String(row.item),
        price: check.gold ?? priceGold(row, town?.id ?? '', gameState),
        can: check.ok, why: check.why ?? '',
      };
    }
    return null;
  });
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

  function takeStashForCraft(tab: number, index: number): boolean {
    if (!transactionWriter) { benchNote = 'This tab is read-only.'; return false; }
    const r = withdraw(gameState, tab, index);
    if (!r.ok) {
      benchNote = `Cannot take this piece to the bench: ${r.why}`;
      gameState = { ...gameState };
      return false;
    }
    townNote = 'Taken from Stash into the bag for Crafting';
    gameState = { ...gameState };
    return true;
  }

  function storeCraftPiece(index: number, tab: number): boolean {
    if (!transactionWriter) { benchNote = 'This tab is read-only.'; return false; }
    const r = deposit(gameState, index, tab);
    if (!r.ok) {
      benchNote = `Cannot store this piece: ${r.why}`;
      gameState = { ...gameState };
      return false;
    }
    townNote = `Stored into Stash · Tab ${tab + 1}`;
    gameState = { ...gameState };
    return true;
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

  /** Where the feet are or are heading, in the name the player acts on: a settlement's own for its ground, the zone's
   *  for everything else. The rest read and the empty field both answer to it, so neither can name the
   *  wrong place for the same ground. */
  const hereName = $derived(townLive ? (town?.name ?? 'the field') : zone.name);
  const placeRead = $derived.by(() => {
    if (gameState.walk) return `To ${walkNote(gameState)}`;
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
    const patrol = gameState.patrol;
    const stop = patrol.stops[patrol.index];
    const stopName = stop ? eng.zoneById(stop.zone).subzones?.[stop.subzone]?.name || 'Subzone' : '';
    const patrolRead = stop
      ? `Patrol ${patrol.index + 1}/${patrol.stops.length} · ${stopName} · ${patrol.groupsCleared}/${E.road.patrol.groups_per_stop}`
      : `Patrol ${patrol.index + 1}/${patrol.stops.length}`;
    if (gameState.phase === 'camp') {
      return `Recovering at Camp · ${Math.max(0, Math.ceil(gameState.campSec))}s`;
    }
    if (gameState.walk) return gameState.autoReturn.phase !== 'idle'
      ? gameState.group.length ? 'Ambushed · Auto-Return paused' : gameState.autoReturn.phase === 'to-stop' ? 'Returning to Patrol…' : 'Auto-Return…'
      : gameState.patrol.active ? gameState.group.length ? `Patrol ambush · ${stopName}` : `Patrol traveling · ${stopName}`
        : gameState.group.length ? 'Ambushed on the road' : 'Traveling…';
    if (gameState.autoReturn.phase === 'waiting') return 'Patrol paused · Auto-Return waits for an online trip';
    if (gameState.autoReturn.phase === 'to-town') return 'Auto-Return · waiting for the settlement';
    if (gameState.autoReturn.phase === 'to-stop') return 'Patrol resuming';
    if (!gameState.hunting) return 'At rest';
    if (!gameState.group.length) {
      return gameState.patrol.active
        ? `${patrolRead} · next ${Math.max(0, gameState.spawnIn)}s`
        : `Hunting · next group in ${Math.max(0, gameState.spawnIn)}s`;
    }
    return `Fighting · ${c.hitsPerSec.toFixed(2)} hits/s${gameState.patrol.active ? ` · ${patrolRead}` : ''}`;
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

  function doMoveSlot(from: number, to: number) {
    moveSlot(gameState.skills, from, to);
    gameState = { ...gameState };
  }

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

  function stonesLine(): string {
    const held = Object.entries(gameState.counters.stones).filter(([, n]) => (n as number) > 0);
    if (!held.length) return 'no stones yet';
    return held.map(([k, n]) => `${stoneName(k)} ${n}`).join(' · ');
  }

  function setTravel(mode: 'stay' | 'forward') {
    if (!requireAccountWriter('changing travel mode')) return;
    gameState.travel = mode;
    gameState = { ...gameState };
    push(gameState, mode === 'forward'
      ? 'Forward: walk to the next opened settlement when its level band is behind; a Push returns to the last zone held'
      : 'Staying: you farm this zone until you travel yourself');
    gameState = { ...gameState };
  }

  function orbMotion(node: HTMLElement) {
    let inView = false;
    const sync = () => node.style.setProperty('--orb-play-state', inView && !document.hidden ? 'running' : 'paused');
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); });
    observer.observe(node);
    document.addEventListener('visibilitychange', sync);
    sync();
    return { destroy() { observer.disconnect(); document.removeEventListener('visibilitychange', sync); } };
  }

  function toggle(id: string) {
    // the reservation rule and the buff switch both live in sim/skills.ts, so no sum is repeated here
    const r = toggleTrack(gameState.skills, id);
    saveNote = r.ok ? '' : r.why || 'cannot';
    gameState = { ...gameState };
  }
</script>

<svelte:window onkeydown={onfieldKey} />

<svelte:head><title>{showcaseMode ? 'ModWorld UI Showcase' : 'ModWorld'}</title></svelte:head>

<div class="showcase-frame" class:active={showcaseMode}>
{#if showcaseMode}
  <header class="showcase-banner">
    <div>
      <h1>UI Showcase</h1>
      <p>Live game components · sample state · changes to source UI appear here through Vite HMR</p>
      <label>Gameplay sample <select aria-label="Gameplay sample" value={showcaseSample} onchange={(event) => {
        showcaseSample = event.currentTarget.value; gameState = showcaseGame(showcaseSample);
        statuses = showcaseSample === 'combat-fx' ? {
          burn: { stacks: 1, secLeft: 8, perSec: 12 },
          chill: { stacks: 1, secLeft: 10, perSec: 0 },
          bleed: { stacks: 1, secLeft: 6, perSec: 8 },
        } : {};
        bench = null; benchNote = ''; picked = null; pickedCell = null;
        panel = showcaseSample === 'expedition' ? 'desk' : showcaseSample === 'craft-stash' ? 'craft' : showcaseSample === 'map-mine' ? 'map' : null;
        if (showcaseSample === 'expedition') deskTab = 'guild'; marketView = 'deliveries'; marketTownId = '';
      }}>
        <option value="field">Field baseline</option><option value="delivery">Delivery want</option><option value="full-bag">Delivery reward bag full</option>
        <option value="fallback">Delivery skill fallback</option><option value="expired">Expired partial delivery</option><option value="read-only">Read-only transactions</option>
        <option value="expedition">Expedition task</option><option value="craft-stash">Crafting · Stash workbench</option><option value="combat-fx">Combat FX · all labels</option><option value="map-mine">Map · Mine & Camp</option>
      </select></label>
    </div>
    <a href="/">Return to the game</a>
  </header>
  <nav class="showcase-index" aria-label="Showcase sections">
    <a href="#showcase-field">Field HUD</a>
    <a href="#panel-hud-layout-studio">HUD Layout</a>
    <a href="#panel-character-sheet">Sheet</a>
    <a href="#panel-inventory">Inventory</a>
    <a href="#panel-craft">Craft</a>
    <a href="#panel-skills">Skills</a>
    <a href="#panel-passive-tree">Tree</a>
    <a href="#panel-town">Town</a>
    <a href="#panel-market">Market</a>
    <a href="#panel-delivery-notice">Delivery notice</a>
    <a href="#panel-keyboard">Keys</a>
    <a href="#panel-field-camp">Camp</a>
    <a href="#panel-farm">Farm</a>
    <a href="#panel-settlement">Desk</a>
    <a href="#panel-save">Save</a>
  </nav>
{/if}

<!-- desktop-only surface: below the floor the corner reads stop being placeable, so it says so -->
<div class="small-screen" role="alert">
  <h2>Mod-Idle is played on a desktop</h2>
  <p>This screen is built for a window 1024 wide or more — the field reads its numbers in the corners, and
    they need the room. Widen the window, or set the browser zoom out.</p>
</div>

<div id={showcaseMode ? 'showcase-field' : undefined} class="stage" style={`grid-template-areas:${hudLayoutAreas};`} class:showcase={showcaseMode} class:combat-fx-sample={showcaseMode && showcaseSample === 'combat-fx'} class:fighting={inCombat} class:mapmode={panel === 'map'} class:veiled={!showcaseMode && ((panel !== null && panel !== 'map') || sheetOpen)} class:townmode={townLive && panel !== 'map'}>
  <!-- one generated map sheet behind the HUD — the only copy, and the surface a place is picked on -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="map-back sheet"
    class:dragging
    role="application"
    aria-label="World map. Use arrow keys to select an adjacent block; Enter performs the primary action shown on the destination card."
    tabindex="0"
    use:mapField
  >
    <div class="map-sheet" style:transform={`translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px) scale(${zoom.toFixed(4)})`}>
      {@html mapMarkup}
    </div>
    <span class="aloud" aria-live="polite" aria-atomic="true">{pickedCell ? `Selected block ${pickedCell.key}: ${pickedCell.label}` : ''}</span>
  </div>

  {#if plates.length}
    {@const front = plates[0]}
    <div class="targetbar" style={place('target')}>
      <p class="target-name">{fieldLabel(front)} <span>{front.kind}</span></p>
      <div class="target-hp">
        <i style={bar(front.hp, front.hpMax)}></i>
        <b>{Math.max(0, Math.round(front.hp))} / {Math.round(front.hpMax)}</b>
      </div>
    </div>
  {/if}

  <div class="topright" style={place('objectives', '100%', '')}>
    <div id="location-map" class="map-reference hub-collapsible" hidden={!locationExpanded}>
      <Minimap markup={mapMarkup} cell={gameState.cell} onopen={() => togglePanel('map')} />
    </div>
    <div class="zone-tag" class:traveling={Boolean(gameState.walk)}>
      <img class="zone-emblem" src={waypointMark} alt="" aria-hidden="true" />
      <div class="zone-copy">
        <CollapseToggle label={zone.name} controls="location-map location-status" bind:expanded={locationExpanded} />
        {#if showPlaceRead && locationExpanded}<span>{placeRead}</span>{/if}
      </div>
      {#if locationExpanded}
        <b class="zone-level">Lv {zone.levels[0]}–{zone.levels[1]}</b>
      {:else}
        <button class="btn-quiet" type="button" aria-label="Open the map" onclick={() => togglePanel('map')}>Map</button>
      {/if}
    </div>
    {#if !showcaseMode && accountWriterState !== 'owner' && accountWriterState !== 'checking'}
      {@const accountHoldLabel = accountWriterState === 'readonly'
        ? 'Read-only · another tab controls progress'
        : accountWriterState === 'waiting'
          ? 'Waiting for account control'
          : 'Progression paused · save control unavailable'}
      <div class="account-hold" role="status" aria-live="polite">
        <span class="chip chip-tag locked">{accountHoldLabel}</span>
        <button class="btn btn-quiet" type="button" onclick={() => openPanel('save')}
                title="Open Save to take over account control">Open Save</button>
      </div>
    {/if}
    <div class="tracker">
      <p id="location-status" class="phase hub-collapsible" hidden={!locationExpanded}>{phaseRead}</p>
      {#if gameState.patrol.active}
        <button class="btn btn-quiet" type="button" onclick={doStopPatrol} disabled={!transactionWriter}>Stop Patrol</button>
      {/if}
      {#if gameState.dungeon}<button onclick={doRetreat} disabled={!transactionWriter}>Retreat · rescue {E.dungeon.retreat_keep_min}–{E.dungeon.retreat_keep_max} random stacks</button>{/if}
      {#if bagFull}
        <p class="alarm-line">Bag full — the zone has stopped paying. Walk to a settlement and deposit.</p>
      {/if}
    </div>
  </div>
  {#if panel === 'map'}
  <div class="field-travel-actions" aria-label="Map tools"
       style={place('travel', '100%', '')}>
      <div class="map-guide" class:open={mapHelpOpen} class:surface-popover={mapHelpOpen}>
        <CollapseToggle label="Map tools" controls="map-tools-content" bind:expanded={mapHelpOpen} />
        <div id="map-tools-content" class="map-tools-content hub-collapsible" hidden={!mapHelpOpen}>
          <details class="map-tools-section" name="map-tools-sections" open>
            <summary><span>Controls</span><svg class="icon-chevron map-tools-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></summary>
            <div class="map-tools">
              <div role="group" aria-label="Map zoom" class="map-zoom">
                <button class="btn btn-quiet btn-icon" type="button" onclick={() => mapZoomBy(1 / 1.25)} aria-label="Zoom out" title="Zoom out">−</button>
                <output class="text-note" aria-label="Map zoom level" aria-live="polite">{Math.round((zoom / MAP_BASE_ZOOM) * 100)}%</output>
                <button class="btn btn-quiet btn-icon" type="button" onclick={() => mapZoomBy(1.25)} aria-label="Zoom in" title="Zoom in">+</button>
                <button class="btn btn-quiet" type="button" onclick={mapCentre} title="Centre on your current settlement">Centre</button>
                <button class="btn btn-quiet" type="button" onclick={mapReset} title="Restore the default map position and zoom">Reset</button>
              </div>
              <div role="group" aria-label="Map display" class="map-views">
                {#each VIEW_ORDER as v (v)}
                  <button class="btn btn-quiet" class:picked={view === v} aria-pressed={view === v} type="button" onclick={() => (view = v)}
                          title={v === 'terrain' ? 'Colour hexes by terrain' : v === 'band' ? 'Colour zones by level band' : 'Highlight zones above the chosen level'}>
                    {v === 'terrain' ? 'Terrain' : v === 'band' ? 'Level band' : 'Level gate'}
                  </button>
                {/each}
              </div>
              {#if view === 'gate'}
                <label class="map-level text-note">Level <input aria-label="Map level gate" type="range" min={firstBand[0]} max={lastBand[1]} bind:value={gateLevel} /> <output>{gateLevel}</output></label>
              {/if}
              <div class="map-overlays" role="group" aria-label="Map overlays">
                <label title="Show walking connections between settlements"><input type="checkbox" bind:checked={showWalk} /> Connections</label>
                <label title="Show hex cell identifiers"><input type="checkbox" bind:checked={showIds} /> Cell IDs</label>
              </div>
              <p class="map-hint text-note">Select a hex · Drag to pan · Scroll to zoom</p>
              {#if gameState.walk}
                <p class="map-hint text-note">{gameState.group.length ? 'Ambushed en route to' : 'Traveling to'} <b>{walkNote(gameState)}</b>.</p>
              {/if}
            </div>
          </details>
          <details class="map-tools-section" name="map-tools-sections">
            <summary><span>Map key</span><svg class="icon-chevron map-tools-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></summary>
            <div class="map-legend text-note">
              {#each legend as l (l.name)}<span class="swatch"><i class="swatch-color" style:background={l.tone} aria-hidden="true"></i><span>{l.label}</span></span>{/each}
              <span class="swatch ramp"><i class="swatch-color" style:background={`linear-gradient(90deg,${rampCss})`} aria-hidden="true"></i><span>Lv {firstBand[0]}–{lastBand[1]}</span></span>
            </div>
          </details>
        </div>
      </div>
  </div>
  {/if}
  {#if latestLevel}
    <!-- one-shot level rise: decoration to a reader, nothing to a keyboard -->
    {#key latestLevel.id}
      <p class="levelup" style={`--fx:${latestLevel.colour}`} aria-hidden="true">{latestLevel.text}</p>
    {/key}
  {/if}

  {#if awayReport}
    <div class="toast notice-toast">
      <button class="quit btn btn-flat" onclick={() => (awayReport = null)} aria-label="Dismiss">✕</button>
      <strong>Welcome back</strong>
      <span>away {awayReport.mins} min · {awayReport.secs} sec simulated{awayReport.capped ? ' (capped at the offline limit)' : ''}</span>
      <span>+{fmtNum(awayReport.kills)} kills · {fmtNum(awayReport.drops)} items · {fmtNum(awayReport.stones)} stones · {fmtNum(awayReport.junk)} junk · {fmtNum(awayReport.gold)} gold{awayReport.levels ? ` · +${awayReport.levels} level${awayReport.levels > 1 ? 's' : ''}` : ''} · quality floor {awayReport.quality}</span>
    </div>
  {/if}

  <!-- contextual overlays stay on the right edge and appear only while open. -->
  <div class="commands-dock"
       style={place('commands', '100%', 'fit-content')}>
    <div class="hud-slide-handle" title={`${gameState.travel === 'stay' ? 'Stay Here' : 'Forward'} · ×${speed} · Auto Skills ${settings.autoSkills !== false ? 'ON' : 'OFF'} · Auto Equip ${settings.autoEquip !== false ? 'ON' : 'OFF'} · ${running ? 'Running' : 'Paused'}`}>
      <CollapseToggle label="Game controls" direction="right"
        controls="game-controls" bind:expanded={controlsExpanded} />
    </div>
    <div id="game-controls" class="command-row game-controls-row hud-slide-content" class:collapsed={!controlsExpanded}
         role="group" aria-label="Game controls" aria-hidden={!controlsExpanded} inert={!controlsExpanded}>
    <button class="hub-control here" type="button" aria-pressed={gameState.travel === 'forward'}
            aria-label={`Travel mode: ${gameState.travel === 'stay' ? 'Stay Here; switch to Forward' : 'Forward; switch to Stay Here'}`}
            title={gameState.travel === 'stay' ? 'Staying here · click to climb forward automatically' : 'Climbing forward automatically · click to stay here'}
            onclick={() => setTravel(gameState.travel === 'stay' ? 'forward' : 'stay')}>
      <span class="toggle-ring here"><img src={gameState.travel === 'stay' ? stayMark : climbMark} alt="" aria-hidden="true" /></span>
      <span class="cap" aria-live="polite">{gameState.travel === 'stay' ? 'Stay Here' : 'Forward'}</span>
    </button>
    <button type="button" class="hub-control" class:here={settings.autoSkills !== false} aria-pressed={settings.autoSkills !== false}
            title={`Auto skills · ${settings.autoSkills === false ? 'off' : 'on'}`}
            onclick={() => setSetting('autoSkills', settings.autoSkills === false)}>
      <span class="toggle-ring" class:here={settings.autoSkills !== false}>
        <img src={skillMark} alt="" aria-hidden="true" />
      </span>
      <span class="cap">Auto Skills</span>
    </button>
    <button type="button" class="hub-control" class:here={settings.autoEquip !== false} aria-pressed={settings.autoEquip !== false}
            title={`Auto equip · ${settings.autoEquip === false ? 'off' : 'on'} · better drops are equipped automatically`}
            onclick={toggleAutoEquip}>
      <span class="toggle-ring" class:here={settings.autoEquip !== false}>
        <img src={autoEquipMark} alt="" aria-hidden="true" />
      </span>
      <span class="cap">Auto Equip</span>
    </button>

      {#each SPEEDS as m (m)}
        <button class="hub-control" class:here={speed === m} type="button"
                aria-label={`Game speed ×${m}`} aria-pressed={speed === m}
                title={`Clock speed ×${m}`} onclick={() => setSpeed(m)}>
          <span class="toggle-ring speed-mark" class:here={speed === m}>×{m}</span>
          <span class="cap">Speed</span>

        </button>
      {/each}
      <button class="hub-control" class:here={!running} type="button"
              title={!showcaseMode && !canWriteAccount ? accountWriterMessage : `${running ? 'Pause' : 'Resume'} · ${keyFor('game.pause')}`}
              aria-label={running ? 'Pause game' : 'Resume game'} aria-pressed={!running}
              aria-keyshortcuts={keyFor('game.pause')} disabled={!showcaseMode && !canWriteAccount}
              onclick={() => (running = !running)}>
        <span class="toggle-ring" class:here={!running}>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            {#if running}<path d="M11 9v14M21 9v14" />{:else}<path d="m12 9 12 7-12 7z" />{/if}
          </svg>
        </span>

      <span class="cap">{running ? 'Pause' : 'Resume'}</span>
      </button>
    </div>
  </div>

  {#if saveNote && !(panel === 'map' && pickedDest)}
    <span class="pill note save-note">{saveNote}</span>
  {/if}

  <!-- cast order, one orb per slot; read-only here — arranging is the Skills sub-screen's job -->
  <div class="actionbar" use:orbMotion style={place('actionbar', '100%', 'auto')}>
    <div class="action-cluster">
      <div class="vital-stack">
        <div class="vital-orb life-orb" style={`--shield-strength:${esFill.toFixed(3)}`}
             role="img" aria-label={`HP ${fmtNum(gameState.player.hp)} of ${fmtNum(c.maxHp)}${c.es > 0 ? `, ES ${fmtNum(gameState.player.es)} of ${fmtNum(c.es)}` : ''}`}>
          <div class="orb-well">
            <i class="orb-fill" style={`--fill:${hpFill.toFixed(3)}`} aria-hidden="true"><span class="orb-ink"><i class="orb-energy"></i></span></i>
            <span class="orb-gloss" aria-hidden="true"></span>
            {#if latestTaken}
              {#key latestTaken.id}<span class="orb-ripple" aria-hidden="true"></span>{/key}
            {/if}
            {#if latestOrbHeal}
              {#key latestOrbHeal.id}<span class="orb-recharge" aria-hidden="true"></span>{/key}
            {/if}
            {#if shatter}
              <!-- the shield going down, mounted once per break from the pool-watch in the script -->
              {#key shatter}
                <span class="orb-shatter" aria-hidden="true"></span>
              {/key}
            {/if}
          </div>
          <span class="orb-readout"><span><strong>{fmtNum(shownHp)}</strong>/{fmtNum(c.maxHp)} HP</span>
            {#if c.es > 0}<span class="orb-shield"><strong>{fmtNum(shownEs)}</strong>/{fmtNum(c.es)} ES</span>{/if}
          </span>
        </div>
      </div>
      <div class="cast-stack">
      <Quickbar quickbar={gameState.quickbar} potions={gameState.farm.potions} condensed={gameState.farm.condensed}
                bagIcon={hubIcon('bags', bagMark)} keyFor={(n) => keyFor('item.' + n)}
                onuse={useQuickSlot}
                oncyc={(i) => { cycleQuickbar(gameState, i); gameState = { ...gameState }; }}
                onassign={(i, name) => { gameState.quickbar[i] = name; gameState = { ...gameState }; }} />
      <div class="casts" role="list" aria-label="Skill bar">
      {#each gameState.skills.list as id, i}
        {@const k = id ? sm.byId[id] : null}
        {@const cd = id ? (gameState.skills.cd[id] || 0) : 0}
        {@const eff = id ? skillCd(gameState.skills, id, c.cdr) : 0}
        {@const frac = cd > 0 && eff > 0 ? Math.max(0, Math.min(1, 1 - cd / eff)) : 1}
        {@const when = id ? modeOf(gameState.skills, id) : 'always'}
        {@const filler = slotFiller(id)}
        <span class="cast hud-slot" class:empty={!id || !k} class:ready={!!k && cd <= 0 && when === 'always' && !filler}
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
              <!-- a ring of the press's own Element, remounted once per event by the key -->
              {#key latestFire.id}
                <span class="flare" style={`--fx:${latestFire.colour}`} aria-hidden="true"></span>
              {/key}
            {/if}
          {/if}
          <b>{i + 1}</b>
        </span>
      {/each}
      </div>
      </div>
      <div class="vital-stack">
        <div class="vital-orb mana-orb" class:reserved={reserved > 0} style={`--reserved:${reserved}%`}
             role="img" aria-label={`Mana ${fmtNum(gameState.player.mana)} of ${fmtNum(c.maxMana)}${reserved > 0 ? `, ${reserved}% reserved by auras` : ''}`}>
          <div class="orb-well">
            <i class="orb-fill" style={`--fill:${manaFill.toFixed(3)}`} aria-hidden="true"><span class="orb-ink"><i class="orb-energy"></i></span></i>
            <span class="orb-gloss" aria-hidden="true"></span>
            {#if latestFire}
              {#key latestFire.id}
                <span class="orb-cast" aria-hidden="true" style={`--fx:${latestFire.colour}`}></span>
              {/key}
            {/if}
          </div>
          <span class="orb-readout"><span><strong>{fmtNum(shownMana)}</strong>/{fmtNum(c.maxMana)} Mana</span>
            {#if reserved > 0}<span class="orb-reserved">RES {reserved}%</span>{/if}
          </span>
        </div>
      </div>
    </div>
      <!-- the level's own read is pinned to the screen's bottom edge, out of every region's flow and taller than the hub could make it -->
      <span class="action-xp track-meter exp" role="progressbar"
            aria-label={`Experience progress at level ${c.level}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={xpPct}>
        <i style={bar(xpPct, 100)}></i><b>{xpPct.toFixed(1)}%</b>
      </span>
  </div>

  <!-- mob plates mount on the Field tab or over a live fight, and on nothing else -->
  {#if showCombatCards}
    <div class="field" class:clear={plates.length === 0}
         style:grid-area={gridAreaCss({ ...hudLayout.field.area, columnStart: 1, columnEnd: 15 }, true)}
         style:width={`${(hudLayout.field.area.columnEnd - hudLayout.field.area.columnStart + 1) / 15 * 100}%`}>
      <FieldPlates s={gameState} ring={ring} plates={plates} zone={zone} town={town} townLive={townLive} c={c}
                 vitals={{ hp: shownHp, es: shownEs, mana: shownMana }} statuses={statuses} reserved={reserved}
                 onSheet={() => { sheetTab = 'stats'; sheetOpen = true; }} fmtNum={fmtNum}
                 plateMotion={plateMotion} fxOutMs={fxOutMs} selfFx={selfFx} />
    </div>

    <!-- the hit ring: sim events with no body of their own — hits over their plate, kills and drops here;
         every fx colour comes out of `engine.json` `elements`, never typed here -->
    <div class="floaters" aria-hidden="true">
      <div class="float-side field-side">
        {#each fieldFx as e (e.id)}
          <span class="fx fx-{e.kind}" class:crit={e.crit} class:pop={e.kind === 'drop'} class:pop-loot={e.kind === 'drop'} out:fxOut={{ ms: fxOutMs }} style="--fx:{e.colour}; --lane:{e.id % 7}">{e.text}</span>
        {/each}
      </div>
      {#if latestTaken}
        <!-- the veil's edge takes the colour of what landed -->
        {#key latestTaken.id}
          <span class="veil" style="--fx:{latestTaken.colour}"></span>
        {/key}
      {/if}
    </div>
  {/if}

  <!-- the walk card, anchored to the cell it speaks for in map focus -->
  {#if pickedSettlement && pickedDest && pickedPrimary && panel === 'map'}
    <div class="mapcard" bind:this={mapcardEl}
         style:left={cardAt ? `${cardAt.x.toFixed(1)}px` : null}
         style:top={cardAt ? `${cardAt.y.toFixed(1)}px` : null}
         style:bottom={cardAt ? 'auto' : null}
         style:transform={cardAt ? 'translateX(-50%)' : null}>
      <TravelCard
        settlement={pickedSettlement}
        dest={pickedDest}
        primary={pickedPrimary}
        notice={saveNote}
        writable={transactionWriter}
        campHere={pickedDest.self && fieldCampHere}
        campHunting={pickedDest.self && fieldCampHere && gameState.hunting}
        busy={!!gameState.walk || gameState.phase === 'camp'}
        warpReason={pickedDest.node === gameState.town.waypoint ? 'This is your current Waypoint.' : ''}
        patrol={gameState.patrol}
        autoReturnEnabled={gameState.autoReturn.enabled}
        minPatrolStops={E.road.patrol.min_stops}
        maxPatrolStops={E.road.patrol.max_stops}
        groupsPerStop={E.road.patrol.groups_per_stop}
        autoReturnPct={E.road.patrol.auto_return_threshold_pct}
        fare={warpPrice(pickedSettlement.id)}
        afford={gameState.counters.gold >= warpPrice(pickedSettlement.id)}
        dungeon={dungeonView}
        onprimary={activatePickedDestination}
        onwarp={travelTo}
        onclear={clearMapSelection}
        onreturncamp={doReturnCamp}
        oncampui={() => (panel = 'camp')}
        onTogglePatrolStop={togglePickedPatrolStop}
        onStartPatrol={doStartPatrol}
        onStopPatrol={doStopPatrol}
        onClearPatrol={doClearPatrol}
        onPatrolRepeat={(repeat) => { gameState.patrol.repeat = repeat; gameState = { ...gameState }; }}
        onAutoReturn={setAutoReturn}
      />
    </div>
  {/if}

  <div class="field-objectives" style={place('tasks')}>
    <ObjectiveFeed goal={objectivesRead.goal}
      deliveries={trackedDeliveries.map((contract) => ({
        id: contract!.id,
        title: `${settlementName(contract!.town)} · ${trade.byId[contract!.good]?.name || contract!.good}`,
        progress: `${contract!.delivered}/${contract!.target}`,
        clock: deliveryClock(deliveryTimeLeft(gameState, contract!)),
        paused: deliveryPause || null,
      }))}
      onSheet={() => { sheetTab = 'life'; sheetOpen = true; }} onDelivery={openDeliveryWant} />
  </div>

  <div class="field-feed" style={place('feed', '100%', 'auto')}>
    <LogBox lines={chatShown} tabs={CHAT_TABS} active={chatTab} hasActivity={feed.length > 0} onTab={(tab) => (chatTab = tab)} />
  </div>

  <!-- press notes are said aloud as well as printed — four pills are not one announcement -->
  <p class="aloud" role="status" aria-live="polite">{saveNote || equipNote || benchNote || townNote || farmNote}</p>

  <nav class="rail" aria-label="Game menu" style={place('menu')}>
    <div id="hub-menu-actions" class="menu-actions hud-slide-content" class:collapsed={!menuExpanded}
         aria-hidden={!menuExpanded} inert={!menuExpanded}>

    <button type="button" class="hub-control" class:here={panel === null} onclick={closePanel}
            title="Back to the field · Esc">
      <span class="toggle-ring" class:here={panel === null}><img src={fieldMark} alt="" aria-hidden="true" /></span>
      <span class="cap">Field</span>
    </button>
    {#each MAIN_RAIL as p}
      {@const label = RAIL_LABEL[p]}
      {@const key = keyFor(SCREEN_ACTION[p])}
      {@const far = TOWN_PANELS.includes(p) && !townLive}
        <button type="button" class="hub-control" class:here={panel === p} class:far={far}
              onclick={() => togglePanel(p)}
              title={`${label}${far ? ' — a settlement service, walk or warp into one first' : ''} · ${key}`}>
        <span class="toggle-ring" class:here={panel === p}><img src={RAIL_ICON[p]} alt="" aria-hidden="true" /></span>
        <span class="cap">{label}</span>
      </button>
      {#if p === 'skills'}
            <button type="button" class="hub-control" class:here={sheetOpen}
                onclick={() => (sheetOpen = !sheetOpen)} title="Character sheet">
          <span class="toggle-ring" class:here={sheetOpen}><img src={hubIcon('character-sheet', sheetMark)} alt="" aria-hidden="true" /></span>
          <span class="cap">Sheet</span>
        </button>
      {/if}
    {/each}
    <button type="button" class="hub-control" class:here={panel === 'camp'} title="Field Camp" onclick={() => togglePanel('camp')}>
      <span class="toggle-ring" class:here={panel === 'camp'}><img src={campMark} alt="" aria-hidden="true" /></span><span class="cap">Camp</span>
    </button>
    <button type="button" class="hub-control" class:here={more} aria-expanded={more} onclick={() => (more = !more)} title="More screens and HUD tools · Esc closes">
      <span class="toggle-ring" class:here={more}><img src={moreMark} alt="" aria-hidden="true" /></span>
      <span class="cap">More</span>
    </button>
    {#if more}
      <div class="morebox">
        {#each MORE_RAIL as p}
          {@const label = RAIL_LABEL[p]}
          {@const far = TOWN_PANELS.includes(p) && !townLive}
          {@const badge = p === 'tree' ? treePointsFree(gameState) : 0}
                <button type="button" class="hub-control" class:here={panel === p} class:far={far}
                  onclick={() => { togglePanel(p); more = false; }}
                  title={`${label} · ${keyFor(SCREEN_ACTION[p])}`}>
            <span class="toggle-ring" class:here={panel === p}><img src={RAIL_ICON[p]} alt="" aria-hidden="true" /></span>
            <span class="cap">{label}</span>
            {#if badge > 0}<span class="badge badge-count urgent more-count">{badge}</span>{/if}
          </button>
        {/each}
            <button type="button" class="hub-control"
                onclick={() => (hudGridVisible = !hudGridVisible)} title="Toggle the viewport grid">
          <span class="toggle-ring" class:here={hudGridVisible}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v18M16 3v18M3 8h18M3 16h18" /></svg>
          </span>
          <span class="cap">Grid</span>
        </button>
            <button type="button" class="hub-control" onclick={openLayoutEditor} title="Arrange HUD regions on the grid">
          <span class="toggle-ring"><img src={keysMark} alt="" aria-hidden="true" /></span>
          <span class="cap">Layout</span>
        </button>
      </div>
    {/if}
    </div>
    <div class="hud-slide-handle">
      <CollapseToggle label={menuExpanded ? 'Menu' : `Menu · ${sheetOpen ? 'Sheet' : panel ? RAIL_LABEL[panel] : 'Field'}`}
        direction="right" controls="hub-menu-actions" bind:expanded={menuExpanded} />
    </div>
  </nav>
</div>
</div>

{#if hudGridVisible}
  <div class="hud-grid-debug" aria-hidden="true">
    {#each HUD_GRID_LABELS as cell (cell)}<span>{cell}</span>{/each}
  </div>
{/if}

{#if layoutEditorOpen || showcaseMode}
  <Panel title="HUD Layout Studio" subtitle="Arrange live HUD groups and the shared screen canvas" width="wide" showcase={showcaseMode} gridArea="2 / 3 / 15 / 14" onclose={() => (layoutEditorOpen = false)}>
    <HudLayoutEditor hud={hudLayout} modal={modalLayout} migrationNotice={hudLayoutNotice} onapply={applyHudLayout} />
  </Panel>
{/if}

{#if sheetOpen || showcaseMode}
  <Panel
    title="Character sheet"
    subtitle={`Level ${gameState.player.level} · final values include gear, tree, and active effects`}
    width="wide"
    showcase={showcaseMode}
    gridArea={modalGridArea}
    onclose={() => (sheetOpen = false)}
  >
    <div class="sheet-tools">
    <div class="sides" role="tablist" aria-label="Character sheet views" tabindex="-1" onkeydown={sheetTabKeydown}>
      <button id="sheet-tab-stats" role="tab" class="btn btn-quiet" class:picked={sheetTab === 'stats'} aria-selected={sheetTab === 'stats'} aria-controls="sheet-body" tabindex={sheetTab === 'stats' ? 0 : -1}
              onclick={() => (sheetTab = 'stats')}>Stats</button>
      <button id="sheet-tab-life" role="tab" class="btn btn-quiet" class:picked={sheetTab === 'life'} aria-selected={sheetTab === 'life'} aria-controls="sheet-body" tabindex={sheetTab === 'life' ? 0 : -1}
              onclick={() => (sheetTab = 'life')}>Life skills</button>
    </div>
      <button class="sheet-new-character btn btn-ghost" type="button" disabled={showcaseMode || !canWriteAccount} title="Start a new character"
              aria-label="New character" onclick={() => { if (confirm('Start a new character?')) reset(); }}>
        <img src={newCharacterMark} alt="" aria-hidden="true" />
        <span>New character</span>
      </button>
    </div>
    {#if sheetTab === 'life'}
      <!-- reference table plus one note: fills the panel's own width -->
      <div id="sheet-body" class="sheet-layout sheet-life" role="tabpanel" aria-labelledby="sheet-tab-life">
        <div class="sheet-values" aria-label="Life skill milestones">
          <section class="sheet-stat-group">
            <h3 class="text-accent">Life skill rungs</h3>
            <table class="stats table-metrics">
              <thead><tr><th scope="col">Life skill</th><th scope="col">Level</th><th scope="col">Next rung</th></tr></thead>
              <tbody>
              {#each lifeSkillMilestones(gameState) as rung (rung.id)}
                <tr><td>{rung.id}</td><td>Lv {rung.level}</td><td>{#if rung.complete}<span class="text-good">All rungs reached</span>{:else}{rung.next}{/if}</td></tr>
              {/each}
            </tbody></table>
          </section>
          <section class="sheet-stat-group">
            <h3 class="text-accent">How a rung pays</h3>
            <p class="sheet-gate">
              Informational only: every rung adds its fixed share to the life-skill combat budget, grants no separate
              reward and never touches the final-boss gate. Levels and training live on the Field Camp board.
            </p>
          </section>
        </div>
      </div>
    {:else}
    <div id="sheet-body" class="sheet-layout" role="tabpanel" aria-labelledby="sheet-tab-stats">
      <div class="sheet-build">
        <section class="sheet-doll" aria-label="Worn equipment">
          <h3 class="text-accent">Worn gear <span class="text-note">{gameState.gear.filter(Boolean).length} / {E.stat.item_slots}</span></h3>
          <SlotGrid entries={wornEntries} capacity={E.stat.item_slots} wornOf={wornOf} fixed layout="equipment"
                    actions={wornActions} />
        </section>
        <StatAllocator stats={STATS} core={c.core} points={gameState.player.points}
                       statPoints={gameState.player.statPoints} treePoints={gameState.player.treePoints}
                       autoSpend={gameState.player.autoSpend} level={gameState.player.level}
                       onallocate={allocate}
                       ontoggleauto={() => { gameState.player.autoSpend = !gameState.player.autoSpend; gameState = { ...gameState }; }} />
      </div>
      <div class="sheet-values" aria-label="Final character values">
        <div class="sheet-value-column">
          <section class="sheet-stat-group">
            <h3 class="text-accent">Offence power</h3>
            <table class="stats table-metrics"><tbody>
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
            <h3 class="text-accent">Combat effects</h3>
            <table class="stats table-metrics"><tbody>
              <tr><td>Crit pool</td><td>{c.critPool.toFixed(1)}</td></tr>
              <tr><td>Crit chance</td><td>{c.critChance.toFixed(1)}%</td></tr>
              <tr><td>Crit damage</td><td>{c.critDmg.toFixed(0)}%</td></tr>
              <tr><td>Armour penetration</td><td>{c.armourPen.toFixed(1)}%</td></tr>
              <tr><td>Chance to bleed</td><td>{c.bleedChance.toFixed(1)}%</td></tr>
              <tr><td>Chance to stun</td><td>{c.stunChance.toFixed(1)}%</td></tr>
              <tr><td>Element alignment</td><td>{c.alignment.toFixed(1)}%</td></tr>
              <tr><td>Leech</td><td>{c.leechPct.toFixed(1)}%</td></tr>
            </tbody></table>
          </section>
          <section class="sheet-stat-group">
            <h3 class="text-accent">Speed and utility</h3>
            <table class="stats table-metrics"><tbody>
              <tr><td>Attack speed</td><td>{c.aspd.toFixed(1)} aspd</td></tr>
              <tr><td>Attack rate</td><td>{c.hitsPerSec.toFixed(2)} hits/sec</td></tr>
              <tr><td>Weapon interval</td><td>{c.weaponAspd.toFixed(2)} sec</td></tr>
              <tr><td>Accuracy</td><td>{Math.round(c.accuracy)} rating</td></tr>
              <tr><td>Cooldown reduction</td><td>{c.cdr.toFixed(1)}%<small class="text-note">Cap {E.caps.cdr}</small></td></tr>
              <tr><td>Weight</td><td>{c.weightUsed.toFixed(0)} / {Math.round(c.weightCap)}<small class="text-note">{c.encumbrance > 0 ? `aspd ${(c.encumbrance * -100).toFixed(0)}%` : 'no tax'}</small></td></tr>
              <tr><td>Global speed</td><td>×{c.globalSpeed.toFixed(2)} cooldown</td></tr>
            </tbody></table>
          </section>
        </div>
        <div class="sheet-value-column">
          <section class="sheet-stat-group">
            <h3 class="text-accent">Defence</h3>
            <table class="stats table-metrics"><tbody>
              <tr><td>Health</td><td>{fmtNum(shownHp)} / {fmtNum(c.maxHp)}<small class="text-note">+{c.hpRegen.toFixed(1)}/sec</small></td></tr>
              <tr><td>Energy Shield</td><td>{fmtNum(shownEs)} / {fmtNum(c.es)}<small class="text-note">+{c.esRegen.toFixed(1)}/sec · {E.energy_shield.delay_sec}s delay</small></td></tr>
              <tr><td>Mana</td><td>{fmtNum(shownMana)} / {fmtNum(c.maxMana)}<small class="text-note">+{c.manaRegen.toFixed(1)}/sec · {reservedPct(gameState.skills)}% reserved</small></td></tr>
              <tr><td>Armour</td><td>{Math.round(c.armour)}</td></tr>
              <tr><td>Evasion</td><td>{c.evasionChance.toFixed(1)}%<small class="text-note">{Math.round(c.evasion)} rating · Cap {E.caps.evasion}%</small></td></tr>
              <tr><td>Perfect dodge</td><td>{c.perfectDodge.toFixed(1)}%</td></tr>
              <tr><td>Block</td><td>{c.block.toFixed(1)}%</td></tr>
              <tr><td>Damage taken</td><td>×{(E.global.defend_mult * c.damageTaken).toFixed(2)}</td></tr>
              <tr><td>Stun recovery</td><td>{c.stunRecovery.toFixed(1)}%<small class="text-note">stop {eng.stunStopSec(c.core.vit, E.status.shock.stop_sec).toFixed(2)}s</small></td></tr>
              <tr><td>Status resistance</td><td>{c.statusResist.toFixed(1)}%</td></tr>
            </tbody></table>
          </section>
          <section class="sheet-stat-group">
            <h3 class="text-accent">Elemental resistance · Cap {c.resCap}{c.resCap > E.caps.elem_res ? ' · unlocked' : ''}</h3>
            <table class="stats table-metrics"><tbody>
              {#each loot.ELEMENTS as el (el)}
                <tr><td>{el}</td><td>{finalResistance(el).toFixed(1)}%{c.resByElement?.[el] ? ` · +${c.resByElement[el].toFixed(1)}% typed` : ''}</td></tr>
              {/each}
              <tr><td>All-Element</td><td>{c.resistance.toFixed(1)}% before typed bonuses</td></tr>
            </tbody></table>
          </section>
          <section class="sheet-stat-group">
            <h3 class="text-accent">The gate</h3>
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
    {/if}
  </Panel>
{/if}

{#if panel === 'bag' || showcaseMode}
  <Panel title="Inventory" width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
    <!-- Inventory and warehouse share this window; Forge and Craft open from their own More menu entries. -->
    <div class="inventory-layout">
    <div class="inventory-tabs" role="tablist" aria-label="Inventory sections" aria-orientation={compactInventoryTabs ? 'horizontal' : 'vertical'} tabindex="-1" onkeydown={inventoryTabKeydown}>
      <button id="inventory-tab-bag" role="tab" aria-controls="inventory-content" tabindex={invTab === 'inv' && bagCat === 'all' ? 0 : -1}
              class="btn btn-quiet inventory-tab" class:picked={invTab === 'inv' && bagCat === 'all'} aria-selected={invTab === 'inv' && bagCat === 'all'}
              onclick={() => { invTab = 'inv'; bagCat = 'all'; }}>
        <span class="inventory-tab-label">
          <img class="inventory-tab-art" src={hubIcon('bags', bagMark)} alt="" aria-hidden="true" />
          Bag
        </span>
        <small class="text-note">{gameState.bag.length} piece{gameState.bag.length === 1 ? '' : 's'} · {slotsUsed(gameState)} / {slotsAvailable(gameState)} slots</small>
      </button>
      <button id="inventory-tab-stash" role="tab" aria-controls="inventory-content" tabindex={invTab === 'stash' ? 0 : -1}
              class="btn btn-quiet inventory-tab" class:picked={invTab === 'stash'} aria-selected={invTab === 'stash'} disabled={!townLive}
              onclick={() => (invTab = 'stash')}
              title={townLive ? `The warehouse the same record opens in every settlement · ${keyFor('screen.stash')}` : 'A settlement service — walk or warp into one first'}>
        <span class="inventory-tab-label">
          <img class="inventory-tab-art" src={stashMark} alt="" aria-hidden="true" />
          Stash
        </span>
        <small class="text-note">{tabs} tab{tabs === 1 ? '' : 's'}{townLive ? '' : ' · not here'}</small>
      </button>
      {#each BAG_TABS as t (t.id)}
        <button id={`inventory-tab-${t.id}`} role="tab" aria-controls="inventory-content" tabindex={invTab === 'inv' && bagCat === t.id ? 0 : -1}
                class="btn btn-quiet inventory-tab" class:picked={invTab === 'inv' && bagCat === t.id} aria-selected={invTab === 'inv' && bagCat === t.id}
                onclick={() => { invTab = 'inv'; bagCat = t.id; }}>
          <span class="inventory-tab-label">
            <img class="inventory-tab-art" src={icon(t.art)} alt="" aria-hidden="true" />
            {t.label}
          </span>
          <small class="text-note">{bagCount(t.id)}</small>
        </button>
      {/each}
    </div>
    <!-- Both grids render all slots; the panel body scrolls when the full inventory is taller than the viewport. -->
    <div class="invbody" id="inventory-content" role="tabpanel" aria-labelledby={invTabLabelId} tabindex="0">
    {#if invTab === 'inv'}
    <section class="bagblock">
      {#if bagFull}
        <p class="warn"><b>Bag full — the zone has stopped paying.</b> {gameState.counters.overflow || 0} pieces have been left on the ground. Walk back to {settlementById(gameState.town.waypoint)?.name || 'a settlement'} and stash what you do not wear.</p>
      {/if}
      {#if equipNote}<p class="equipnote">{equipNote}</p>{/if}
      <div class="bagtools">
        <!-- equip margin: a piece must be this much ahead (same percent the bag filter uses) before it goes on -->
        <label class="margin">only if better by
          <input type="number" min="0" step="1" value={settings.equipMargin || 0}
                 onchange={(e) => setSetting('equipMargin', Math.max(0, Number((e.target as HTMLInputElement).value) || 0))} />
          %
        </label>
        <button class="best" onclick={doBestEquip}
                title={'Wears whatever is strongest in the bag, piece by piece · ' + keyFor('equip.best')}
                aria-keyshortcuts={keyFor('equip.best')}>
          Put on the best I carry
        </button>
        <button onclick={doRunFilter}
                title="Runs the bag filter over what is carried: every unlocked piece that fails the rule dissolves for its salvage bundle — the same one a fresh drop gets. Locked and Collector-held pieces are spared.">
          Run the filter over the bag
        </button>
        <span class="grow"></span>
        <span class="weight" title="Everything carried weighs, worn gear and kept pieces included">Weight <b>{c.weightUsed.toFixed(0)}</b> / {Math.round(c.weightCap)} <small>{c.encumbrance > 0 ? `· aspd ${(c.encumbrance * -100).toFixed(0)}%` : '· no tax'}</small></span>
        <span class="purse inventory-gold" title="Gold in the purse">
          <img src={coinMark} alt="" aria-hidden="true" />
          <b>{fmtNum(gameState.counters.gold)}</b><i>gold</i>
        </span>
        {#if townLive && tabs}
          <!-- the way out of a full bag is one press here, because this is the screen a full bag lands on -->
          <button class="mini" disabled={!gameState.bag.length} onclick={() => doDepositAll(stashTab)}>
            Stash every unlocked piece → Tab {stashTab + 1}
          </button>
        {/if}
      </div>
      <!-- overflow left behind and held-for-others, read beside the numbers -->
      {#if (gameState.counters.overflow || 0) > 0 || (gameState.counters.stopped || 0) > 0}
        <p class="bagmeta"><small class="dim">{gameState.counters.overflow || 0} overflow · {gameState.counters.stopped || 0} refused</small></p>
      {/if}
      {#if heldSummary}
        <p class="bagmeta"><small class="dim">Held: {heldSummary}</small></p>
      {/if}
      <!-- one bag: kept pieces and carried stacks share the same slots and the same count -->
      <div class="bagshell">
        {#snippet bagFilters()}
          <div class="bagview">
            <input class="bagsearch" type="search" placeholder="Search the bag…"
                   bind:value={bagQuery} aria-label="Search the bag" />
            <label class="bagtier">quality
              <select bind:value={bagTier} aria-label="Quality">
                <option value="all">All</option>
                <option value="low">low</option>
                <option value="mid">mid</option>
                <option value="high">high</option>
              </select>
            </label>
            <span class="grow"></span>
            <small class="dim">{bagShown.length} shown</small>
          </div>
        {/snippet}
        <div class="bagmain">
          <SlotGrid
            entries={bagShown}
            capacity={slotsAvailable(gameState)}
            compactGrid
            mode={bagMode}
            onmode={(m) => (bagMode = m)}
            sort={bagSort}
            onsort={(k) => (bagSort = k)}
            lead={bagFilters}
            wornOf={wornOf}
            onequip={equip}
            actions={bagPieceActions}
            empty="Nothing carried yet — stones, herbs, draughts and junk land in these slots, and so does every piece a kill keeps."
          />
        </div>
      </div>
      <details class="filter">
        <summary>Bag filter — what this run keeps</summary>
        <p><small>The filter is <b>off by default</b> — an off slot keeps every drop and dissolves nothing. An enabled slot converts a rejected piece into the complete Iron Ore + Scrap bundle. If either output cannot fit, the piece stays unpicked.</small></p>
        <table>
          <thead><tr><th>Slot</th><th>Filter</th><th>Keep when it beats the worn piece by</th><th>Also keep an Element you cannot resist</th><th>The rule in words</th></tr></thead>
          <tbody>
            {#each FILTER_SLOTS as slot}
              {@const r = ruleFor(gameState.filter, slot)}
              <tr>
                <td>{slot}</td>
                <td><input type="checkbox" aria-label={`Enable bag filter for ${slot}`} checked={r.enabled} onchange={(e) => editRule(slot, { enabled: (e.target as HTMLInputElement).checked })} /></td>
                <td><input type="number" aria-label={`Minimum improvement over worn ${slot}, percent`} min="0" step="1" value={r.margin_pct} disabled={!r.enabled} onchange={(e) => editRule(slot, { margin_pct: Number((e.target as HTMLInputElement).value) })} /> %</td>
                <td><input type="checkbox" aria-label={`Keep ${slot} with Element resistance missing`} checked={r.keep_missing_element} disabled={!r.enabled} onchange={(e) => editRule(slot, { keep_missing_element: (e.target as HTMLInputElement).checked })} /></td>
                <td>{describeRule(r)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p><small>Still not found — Elements you have no resistance for: <b>{gameState.filter.missing.elements.length ? gameState.filter.missing.elements.join(', ') : 'none'}</b> · empty slots: <b>{gameState.filter.missing.slots.length ? gameState.filter.missing.slots.join(', ') : 'none'}</b></small></p>
        <!-- the rules a whole bag lives by are read with the table they answer to -->
        <div class="filterpresets">
          <p class="filterpresets-head"><b>Filter presets</b>
            <small class="dim">· {presetSlots(gameState)}</small></p>
          <ul class="presetrow">
            {#each { length: presetSlots(gameState) } as _, i (i)}
              <li>
                <span>Preset {i + 1}</span>
                {#if gameState.filterPresets[i]}
                  <small class="dim">stored</small>
                  <button onclick={() => doLoadFilterPreset(i)}>Load</button>
                  <button onclick={() => doClearFilterPreset(i)}>Clear</button>
                {:else}
                  <small class="dim">empty</small>
                  <button onclick={() => doSaveFilterPreset(i)}>Save</button>
                {/if}
              </li>
            {/each}
          </ul>
          <p class="autodissolve"><small>Auto-dissolve below item level
              <input type="number" min="0" step="1" value={gameState.autoDissolveLevel ?? 0}
                onchange={(e) => { gameState.autoDissolveLevel = Math.max(0, Number((e.target as HTMLInputElement).value) || 0); gameState = { ...gameState }; }} /></small></p>
        </div>
      </details>
    </section>
    {:else}
    <section class="bagblock">
      <h3>Stash · one warehouse, every settlement</h3>
      <StashBoard game={gameState} {tabs} tab={stashTab} carriedSort={carriedSort} addtab={stashFolder}
                  ontab={(t) => (stashTab = t)}
                  onaddtab={(id) => doBuy(id)}
                  oncarriedsort={(k) => (carriedSort = k)}
                  ondeposit={(i) => doDeposit(i, stashTab)}
                  onwithdraw={(i) => doWithdraw(stashTab, i)}
                  ondepositAll={() => doDepositAll(stashTab)}
                  onwithdrawAll={() => doWithdrawAll(stashTab)}
                  onlock={toggleLock} onequip={equip} {wornOf} />
      {#if townNote}<p class="townnote">{townNote}</p>{/if}
    </section>
    {/if}
    </div>
    </div>
  </Panel>
{/if}

{#if panel === 'craft' || showcaseMode}
  <Panel title="Craft" subtitle="Right-click a stone · click to apply · Shift-click to repeat" width="wide" fixed topmost showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
    <CraftWorkshop game={gameState} item={benchItem} where={bench?.where ?? null} index={bench?.index ?? -1}
                   onpick={(where, index) => { bench = { where, index }; benchNote = ''; }}
                   onclear={() => { bench = null; benchNote = ''; }}
                   onrun={(op, line, pick) => runCraft(op, line ?? 0, pick)} {wornOf} note={benchNote}
                   stashTabs={tabs} stashTab={stashTab} writer={transactionWriter}
                   onStashTab={(tab) => { stashTab = tab; }}
                   onTakeStash={takeStashForCraft} onStore={storeCraftPiece} />
  </Panel>
{/if}

{#if panel === 'skills' || showcaseMode}
  <Panel title="Skills" subtitle={`${ACTIVE_SLOTS} slots, cast top-down`} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
    <div class="skills-panel">
    <div class="skill-tabs" role="tablist" aria-label="Skill sections">
      <button role="tab" class="btn btn-quiet" class:toggled={skillTab === 'loadout'} aria-selected={skillTab === 'loadout'} onclick={() => (skillTab = 'loadout')}>Loadout</button>
      <button role="tab" class="btn btn-quiet" class:toggled={skillTab === 'owned'} aria-selected={skillTab === 'owned'} onclick={() => (skillTab = 'owned')}>Owned skills</button>
      <button role="tab" class="btn btn-quiet" class:toggled={skillTab === 'effects'} aria-selected={skillTab === 'effects'} onclick={() => (skillTab = 'effects')}>Buffs & auras</button>
      <button role="tab" class="btn btn-quiet" class:toggled={skillTab === 'mastery'} aria-selected={skillTab === 'mastery'} onclick={() => (skillTab = 'mastery')}>Mastery & curses</button>
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
              {#if k}<span class="skill-label"><img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" />{k.name}{#if !sm.weaponFits(k, heldWeaponName(gameState) || '')}<span class="chip chip-tag locked" title={`${k.name} fires only while a ${k.weapon === 'bow' ? 'bow or crossbow' : k.weapon} is held — you hold ${heldWeaponName(gameState) || 'nothing'}`}>needs {k.weapon === 'bow' ? 'bow/crossbow' : k.weapon}</span>{/if}</span>{:else}—{/if}
            </td>
            <td>{k && id ? (k.base_flat != null ? pressText(k) : k.type) : ''}</td>
            <td>{id ? `${skillLevel(gameState.skills, id)} / ${E.skill_xp.level_cap}` : ''}</td>
            <td>{k && id ? `${k.cd}s → ${skillCd(gameState.skills, id, c.cdr).toFixed(2)}s` : ''}</td>
            <td>{k && id ? costNow(gameState.skills, id) : ''}</td>
            <td>{id ? `${(gameState.skills.cd[id] || 0).toFixed(1)}s${(gameState.skills.buffUp[id] || 0) > 0 ? ` · window ${gameState.skills.buffUp[id]}s` : ''}` : ''}</td>
            <td>
              {#if id}
                <select aria-label={`Cast mode for ${sm.byId[id]?.name || id}`} value={modeOf(gameState.skills, id)} onchange={(e) => setMode(id, (e.target as HTMLSelectElement).value)}>
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
              <select aria-label={`Skill in slot ${i + 1}`} value={id || ''} onchange={(e) => setSlot(i, (e.target as HTMLSelectElement).value)}>
                <option value="">empty</option>
                {#each ownedActives as k2}<option value={k2.id} selected={id === k2.id}>{k2.name}</option>{/each}
              </select>
            </td>
          </tr>
          {#if id && gateOpen === id && modeOf(gameState.skills, id) === 'conditional'}
            <!-- the legs are the fixed five the sim reads; a needed number opens at its data default -->
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
      <p class="reserve-note"><small>New drops start off · buffs repeat · auras stay on.</small></p>
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
    <p><small>Only the held weapon earns XP · 4 a kill · best per slot kept.</small></p>
    <table>
      <thead><tr><th>Weapon</th><th>Mastery</th><th>Matching-skill bonus</th></tr></thead>
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
    <p><small>Other skills take half of the held weapon's Mastery bonus.</small></p>

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

{#if panel === 'tree' || showcaseMode}
  <Panel title="Passive tree" subtitle={`${treePointsFree(gameState)} banked · ${treePointsSpent(gameState)} spent`} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
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

{#if panel === 'town' || showcaseMode}
  <Panel title="Town" subtitle={`${town?.name ?? 'the field'} · ${townLive ? 'standing here' : 'not standing here'}`} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
    <TownHub state={gameState} town={town} here={townLive} {tabs}
             onopen={(id) => openPanel(id as PanelId)} onwarp={travelTo} onsellall={doSell}
             onblackmarket={openBlackMarket}
             onbest={doBestEquip}
             onstashall={() => doDepositAll(stashTab)} />
  </Panel>
{/if}

{#if panel === 'market' || showcaseMode}
  <Panel title="Market" subtitle={`${town?.name ?? ''} · demand, cargo and town services`} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
    <Market state={gameState} town={town} here={townLive} writer={transactionWriter} onbuy={doBuy} onsell={doSell} ontrade={doTrade} onprocess={doProcess} onroute={showTradeRoute}
            ondeliver={doDelivery} ontrack={doTrackDelivery} onack={doAcknowledgeDelivery} onblackmarketbuy={doBlackMarketBuy} bind:view={marketView} bind:marketId={marketTownId} />
  </Panel>
{/if}

{#if deliveryNotice && (showcaseMode || transactionWriter && panel === null)}
  <Panel title="Delivery notice" subtitle="An optional town opportunity" width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={() => doDismissDelivery(deliveryNotice!.id)}>
    <DeliveryNotice state={gameState} contract={deliveryNotice} writer={transactionWriter}
      ontrack={() => doTrackDelivery(deliveryNotice!.id, true)} ondetails={() => openDeliveryWant(deliveryNotice!.id)} ondismiss={() => doDismissDelivery(deliveryNotice!.id)} />
  </Panel>
{/if}

{#if panel === 'keys' || showcaseMode}
  <Panel title="Keyboard" subtitle={`${KEYBINDS.length} actions, all rebound here`} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
    <KeybindTable binds={binds} onset={setBind} onreset={resetBinds} onclear={clearBind} />
  </Panel>
{/if}

{#if panel === 'camp' || showcaseMode}
  <Panel title="Field Camp" subtitle={`${fieldworkSite ? fieldworkSite.replace(/^./, (letter) => letter.toUpperCase()) : 'Field'} · ${fieldCampHere ? 'safe at Camp' : 'set up away from town'}`} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
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

{#if panel === 'farm' || showcaseMode}
  <Panel title="Farm" subtitle={farmSub} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
    <div class="farm-panel">
    <p><small>{gameState.farm.xp} Farm XP · {farm.xpPerHarvest} per harvest · {farm.F.growth_hours} h base cycle · tier Mastery XP low {gameState.farm.mastery.low} (Lv {farmMasteryLevel(gameState, 'low')}), mid {gameState.farm.mastery.mid} (Lv {farmMasteryLevel(gameState, 'mid')}), high {gameState.farm.mastery.high} (Lv {farmMasteryLevel(gameState, 'high')}) · at most 10% future growth-time reduction; ready times already set are unchanged · {farm.plotsMax} plots at most ({plots} yours).</small></p>
    <div class="farm-tabs" role="tablist" aria-label="Farm sections">
      <button role="tab" class="btn btn-quiet" class:toggled={farmTab === 'plots'} aria-selected={farmTab === 'plots'} onclick={() => (farmTab = 'plots')}>Plots & herbs</button>
      <button role="tab" class="btn btn-quiet" class:toggled={farmTab === 'alchemy'} aria-selected={farmTab === 'alchemy'} onclick={() => (farmTab = 'alchemy')}>Alchemy</button>
      <button role="tab" class="btn btn-quiet" class:toggled={farmTab === 'automation'} aria-selected={farmTab === 'automation'} onclick={() => (farmTab = 'automation')}>Auto use</button>
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
              <select aria-label={`Grow tier for plot ${i + 1}`} value={p?.tier || 'low'} onchange={(e) => doPlant(i, (e.target as HTMLSelectElement).value)}>
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
    {@const scrapPreview = previewScrapAlchemy(gameState, { writer: transactionWriter })}
    {@const tierProgress = alchemyTierProgress(gameState.alchemy)}
    {@const scrapBatch = Math.floor((gameState.fieldwork.materials.scrap || 0) / E.salvage.alchemy.scrap_cost)}
    <p>{gameState.fieldwork.materials.scrap || 0} Scrap carried · {E.salvage.alchemy.scrap_cost} Scrap → {E.salvage.alchemy.value_yield} Value stone · {tierProgress.outputsToNext} more to the next Tier stone ({tierProgress.paid} earned).</p>
    <button disabled={!scrapPreview.ok} title={scrapPreview.ok ? 'Immediate settlement recipe' : scrapPreview.why} onclick={() => doScrapAlchemy()}>Transmute Scrap</button>
    <button disabled={!scrapPreview.ok || scrapBatch < 1} title={scrapBatch < 1 ? `Needs ${E.salvage.alchemy.scrap_cost} Scrap per transmutation` : `Batch ${scrapBatch} single transmutes, stopping at the first refusal`} onclick={() => doScrapAlchemy(scrapBatch)}>Transmute all {scrapBatch} Scrap</button>
    {#if !scrapPreview.ok}<p>{scrapPreview.why}</p>{/if}
    <table>
      <thead><tr><th>Draught</th><th>Effect</th><th>Cost</th><th>Held</th><th></th></tr></thead>
      <tbody>
        {#each farm.P.list as p}
          {@const cost = farm.craftCost(p.tier)}
          <tr>
            <td>{p.name}</td>
            <td>{p.pool === 'both' ? `Instant ${farm.potionPct(p, 'hp')}% Max HP + ${farm.potionPct(p, 'mana')}% Max Mana` : `Instant ${farm.potionEffect(p)}% Max ${p.pool === 'hp' ? 'HP' : 'Mana'}`}</td>
            <td>{cost.herbs} {p.tier} herbs + {cost.reroll_value_stones} Value stone(s)</td>
            <td>{gameState.farm.potions[p.name] || 0}{gameState.farm.condensed[p.name] ? ` (+${gameState.farm.condensed[p.name]} condensed)` : ''}</td>
            <td>
              <button onclick={() => doBrew(p.name)}>brew</button>
              <button onclick={() => doDrink(p.name)} disabled={!((gameState.farm.potions[p.name] || 0) + (gameState.farm.condensed[p.name] || 0))}>drink</button>
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

{#if panel === 'desk' || showcaseMode}
  <Panel title="Settlement" subtitle={deskSub} width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
    <div class="desk-panel">
    <div class="desk-tabs" role="tablist" aria-label="Settlement sections">
      <button role="tab" class="btn btn-quiet" class:toggled={deskTab === 'services'} aria-selected={deskTab === 'services'} onclick={() => (deskTab = 'services')}>Services</button>
      <button role="tab" class="btn btn-quiet" class:toggled={deskTab === 'stall'} aria-selected={deskTab === 'stall'} onclick={() => (deskTab = 'stall')}>Stall</button>
      <button role="tab" class="btn btn-quiet" class:toggled={deskTab === 'guild'} aria-selected={deskTab === 'guild'} onclick={() => (deskTab = 'guild')}>Guild & Collector</button>
      <button role="tab" class="btn btn-quiet" class:toggled={deskTab === 'hunt'} aria-selected={deskTab === 'hunt'} onclick={() => (deskTab = 'hunt')}>Hunt</button>
      <button role="tab" class="btn btn-quiet" class:toggled={deskTab === 'walk'} aria-selected={deskTab === 'walk'} onclick={() => (deskTab = 'walk')}>Walk</button>
    </div>
    <div class="desk-content">

    {#if viewTown}
      <h3>{viewTown.name} · settlement{viewHere ? '' : ' — read only, you are standing in ' + (town ? town.name : 'the field')}</h3>
      <p><small>Innate Element {viewTown.innate.join(' / ')} · Base bias flavour {viewTown.base_bias_flavor} · NPCs here: {viewTown.npcs.map((n: string) => npcOf(n)?.name ?? n).join(' · ')}</small></p>
      {#if !viewHere}
        <p><small>Live only where the character stands.</small></p>
      {/if}

      <div class="fold">
      {#if deskTab === 'services'}
      <h4>Counterhand · the gold mint</h4>
      <p>Gold {gameState.counters.gold.toFixed(1)} · junk unsold {junkTotal} ({junkLines.join(' · ') || 'none'}) · stones {stonesLine()}</p>
      <button onclick={doSell} disabled={!viewHere || junkTotal === 0}>Sell all junk here</button>
      <p><small>The Counterhand pays junk and gathered goods at this town's demand.</small></p>

      <h4>Respec · free</h4>
      <p><small>Free · only in a settlement.</small></p>
      <button onclick={respec} disabled={!townLive || !viewHere || !STATS.some((k) => gameState.player.points[k])}>Respec — refund all stat points</button>
      <button onclick={doRespecTree} disabled={!townLive || !viewHere || !treePointsSpent(gameState)}>Respec the tree — refund {treePointsSpent(gameState)} point{treePointsSpent(gameState) === 1 ? '' : 's'}</button>

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
                <td>{t ? t.kind === 'expedition'
                  ? `${t.n} Elite · ${E.mob.species.find((sp: any) => sp.id === t.targetSpecies)?.name || t.targetSpecies} · ${eng.zoneById(t.zone).subzones?.[t.subzone ?? 0]?.name || 'subzone'}`
                  : `${t.kind} ×${t.n}`
                  : 'refills in ' + (() => { const s = Math.max(0, gameState.town.refillAt[i] - gameState.clockSec); return s >= 3600 ? (s / 3600).toFixed(1) + 'h' : s >= 60 ? Math.round(s / 60) + 'm' : Math.round(s) + 's'; })()}</td>
                <td>{t ? eng.zoneById(t.zone).name : ''}</td>
                <td>{t ? `${t.progress} / ${t.n}` : ''}</td>
                <td>{t ? (t.alt ? `${t.count} ${t.stone} or ${t.alt.count} ${t.alt.stone}` : `${t.count} ${t.stone} stone`) : ''}</td>
                <td>{#if t}
                  {#if t.kind === 'expedition'}
                    <button class="btn btn-quiet" onclick={() => goToTask(t)}>Map target</button>
                  {/if}
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
        <p><small>Payouts: stones only · {TOWN.task_sizing.reward_minutes_of_band_income} min of band income.</small></p>
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
        <p><small>Reward: {viewColSet.reward} · {viewColSet.rule} · no gold, no Mod (T14).</small></p>
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
    <p><small>Zones open at their settlement · mobs scale to your level.</small></p>
    <table class="picklist">
      <thead><tr><th>Zone</th><th>Levels</th><th>mob_HP</th><th>Quality</th><th>Elements</th><th>Group</th><th>Sub-zones</th><th></th></tr></thead>
      <tbody>
        {#each E.mob.zones as z}
          {@const home = settlementOfZone(z.id)?.id}
          {@const opened = !!home && gameState.town.visited.includes(home)}
          <tr class:picked={!!home && picked === home} onclick={() => home && select(home)}>
            <td>{z.id} · {z.name}</td>
            <td>{z.levels.join('-')}</td>
            <td class="mob-hp">{z.hp.map((hp: number) => fmtNum(hp)).join(' → ')}</td>
            <td>{z.quality}</td>
            <td>{eng.zoneElements(z.id).join(', ')}</td>
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

{#if panel === 'save' || showcaseMode}
  <Panel title="Save" subtitle="local only" width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
    <div class="save-panel">
    <div class="save-tabs" role="tablist" aria-label="Save sections">
      <button role="tab" class="btn btn-quiet" class:toggled={saveTab === 'slots'} aria-selected={saveTab === 'slots'} onclick={() => (saveTab = 'slots')}>Slots</button>
      <button role="tab" class="btn btn-quiet" class:toggled={saveTab === 'backups'} aria-selected={saveTab === 'backups'} onclick={() => { saveTab = 'backups'; loadSnaps(); }}>Backups</button>
      <button role="tab" class="btn btn-quiet" class:toggled={saveTab === 'settings'} aria-selected={saveTab === 'settings'} onclick={() => (saveTab = 'settings')}>Settings</button>
    </div>
    {#if showcaseMode}<p class="showcase-note">Save, load, backup, import, and export are disabled here. This page never reads or writes a player save.</p>{/if}
    {#if !showcaseMode}
      <div class="account-writer" class:owner={accountWriterState === 'owner'} role="status" aria-live="polite">
        <p>{accountWriterMessage}</p>
        {#if accountWriterState === 'readonly'}
          <label>Reload after takeover
            <select bind:value={takeoverSlot}>{#each saveSlots as slot}<option value={slot}>{slot}</option>{/each}</select>
          </label>
          <button type="button" onclick={takeOverAccount}>Take over and reload</button>
        {:else if accountWriterState === 'waiting'}
          <button type="button" onclick={cancelTakeover}>Cancel wait</button>
        {/if}
      </div>
    {/if}
    {#if saveTab === 'slots'}
    <p>Three local character slots · away time catches up to {E.inventory.offline_cap_hr} hours.</p>
    <div class="save-actions">
    {#each saveSlots as slot}
      <button disabled={showcaseMode || !canWriteAccount} onclick={() => doSave(slot)}>Save {slot}</button>
      <button disabled={showcaseMode || accountWriterState === 'checking' || accountWriterState === 'waiting' || accountWriterState === 'unsupported'} onclick={() => doLoad(slot)}>Load {slot}</button>
    {/each}
    <button disabled={showcaseMode} onclick={download}>Export JSON</button>
    <label>Import <input type="file" accept="application/json" disabled={showcaseMode || !canWriteAccount} onchange={upload} /></label>
    </div>
    {#if saveNote}<p class="save-note-inline" role="status">{saveNote}</p>{/if}
    {:else if saveTab === 'backups'}
    <h2>Backups · {SAVE_CFG.snapshot_slots} walking snapshots</h2>
    <p><small>Owed on a level up, an Ascend or Refine, and every {SAVE_CFG.snapshot_interval_min} min of play. A restore takes the character back whole.</small></p>
    <label>Which slot <select bind:value={snapSlot} disabled={showcaseMode} onchange={loadSnaps}>{#each saveSlots as s}<option value={s}>{s}</option>{/each}</select></label>
    <button disabled={showcaseMode} onclick={loadSnaps}>Show backups</button>
    <table>
      <thead><tr><th>#</th><th>Taken because</th><th>Then</th><th></th></tr></thead>
      <tbody>
        {#each snaps as shot, i}
          <tr>
            <td>{i + 1}</td>
            <td>{shot.reason}</td>
            <td>{Math.round(shot.clockSec / 60)} min of play · level {shot.state.player.level}</td>
            <td><button disabled={showcaseMode || !canWriteAccount} onclick={() => restore(i)}>Rewind to this</button></td>
          </tr>
        {:else}
          <tr><td colspan="4">Nothing stored yet.</td></tr>
        {/each}
      </tbody>
    </table>
    <p>{snapNote}</p>
    {:else}
    <h2>Settings</h2>
    <p><small>Shared by all three slots · potions and auto-farm on Farm · filters on Bags · presets on Skills.</small></p>
    <label>Number format
      <select value={settings.numberFormat} onchange={(e) => setSetting('numberFormat', (e.target as HTMLSelectElement).value as 'plain' | 'short')}>
        <option value="plain">plain — 12,345</option>
        <option value="short">short — 12.3k</option>
      </select>
    </label>
    <label><input type="checkbox" checked={settings.offlineReport} onchange={(e) => setSetting('offlineReport', (e.target as HTMLInputElement).checked)} /> Show the welcome-back report after an away period</label>
    <!-- auto-dissolve lives with the bag filter now: it is a bag rule, not a display preference -->
    {/if}
    </div>
  </Panel>
{/if}

<!-- the ink's distortion field: one static turbulence map shared by both orbs' ink layers -->
<svg class="orb-warp-defs" width="0" height="0" aria-hidden="true" focusable="false">
  <filter id="orb-warp" x="-25%" y="-25%" width="150%" height="150%">
    <feTurbulence type="fractalNoise" baseFrequency="0.016 0.024" numOctaves="2" seed="11" result="noise" />
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="30" xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>

<style>
  button.active { border-color: var(--gold); color: var(--gold); }

  :global(body.ui-showcase) { height: auto; min-height: 100%; overflow-x: hidden; overflow-y: auto; }
  .showcase-frame { display: contents; }
  .showcase-frame.active { display: grid; grid-template-rows: auto auto minmax(0, 1fr); height: 100vh; }
  .showcase-banner {
    display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-md);
    padding: var(--spacing-xs) var(--screen-pad); border-bottom: 1px solid var(--line);
    background: linear-gradient(90deg, var(--panel), var(--bg));
  }
  .showcase-banner > div { display: flex; flex: 1; align-items: center; gap: var(--spacing-md); min-width: 0; }
  .showcase-banner h1 { margin: 0; color: var(--gold); font-size: var(--font-md); }
  .showcase-banner p { flex: 1; min-width: 0; margin: 0; color: var(--dim); font-size: var(--font-xs); }
  .showcase-banner label { flex: none; }
  .showcase-banner a { flex: none; padding: var(--spacing-xs) var(--spacing-sm); border: 1px solid var(--line); border-radius: var(--radius-card); text-decoration: none; }
  .showcase-index { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); padding: var(--spacing-xs) var(--screen-pad); border-bottom: 1px solid var(--line); background: var(--inset); }
  .showcase-index a { padding: var(--spacing-xs) var(--spacing-xs); border: 1px solid var(--line); border-radius: var(--radius-card); color: var(--dim); font-size: var(--font-xs); text-decoration: none; white-space: nowrap; }
  .showcase-index a:hover, .showcase-index a:focus-visible { border-color: var(--gold); color: var(--gold-lit); }
  .showcase-note { padding: var(--spacing-xs) var(--spacing-sm); border: 1px solid var(--line); border-radius: var(--radius-card); color: var(--dim); background: var(--inset); font-size: var(--font-xs); }


  .map-back {
    position: absolute; inset: 0; overflow: hidden; cursor: crosshair;

    --dof: var(--dof-rest);

    --map-lift: .92;
    --map-sat: .85;

    opacity: calc(1 - var(--dof) / 12);

    mask-image: linear-gradient(180deg, #000 0 62%, rgba(0, 0, 0, .5));
    -webkit-mask-image: linear-gradient(180deg, #000 0 62%, rgba(0, 0, 0, .5));

    transition: opacity var(--motion-ui) var(--ease-ui);
    touch-action: none;

    user-select: none; -webkit-user-select: none;
  }

  .map-back::after {
    content: '';
    position: absolute; inset: 0; z-index: var(--z-underlay); pointer-events: none;
    background: radial-gradient(ellipse 88% 80% at 50% 48%, transparent 74%,
      color-mix(in srgb, var(--ground) 58%, transparent) 88%,
      color-mix(in srgb, var(--ground) 98%, transparent) 100%);
  }

  .map-sheet {
    position: absolute; inset: 0;
    transform-origin: 50% 46%;
    transition: transform var(--motion-fast) var(--ease-ui);

    filter: blur(var(--dof)) brightness(var(--map-lift)) saturate(var(--map-sat));

    will-change: transform;
  }

  .map-back.dragging .map-sheet { transition: none; }

  .map-back:focus-visible { --dof: 1.5px; --map-lift: 1; --map-sat: .95; opacity: .92; }

  .map-back:focus-visible { --ring-offset: -2px; }

  .stage.mapmode .map-back { --dof: 0px; --map-lift: 1; --map-sat: 1; opacity: 1; cursor: grab; }
  /* in map focus the sheet's filter and layer hint come off: they force one rasterisation that the
     zoom transform then upscales, smearing the hex labels */
  .stage.mapmode .map-sheet { filter: none; will-change: auto; }

  .map-back.dragging { cursor: grabbing; transition: opacity var(--motion-ui) var(--ease-ui), filter var(--motion-ui) var(--ease-ui); }
  /* cards mount by state (`showCombatCards`); these rules only shape the fight-over-map overlap */
  .stage.mapmode .field { display: block; pointer-events: none; }
  :global(.stage.mapmode .field > :not(.combat-player-slot)) { display: none; }
  :global(.stage.mapmode .field .combat-player-slot) { pointer-events: none; }
  :global(.stage.mapmode .field .combat-player-slot button) { pointer-events: auto; }
  :global(.stage.mapmode .field .combat-player-slot .self-side) { display: none; }
  .stage.mapmode .floaters { display: none; }

  .stage.mapmode .tracker { display: none; }
  .stage.mapmode .targetbar { display: none; }

  .stage.veiled { --dof: var(--dof-far); }
  .stage.veiled .field, .stage.veiled .tracker, .stage.veiled .actionbar, .stage.veiled .targetbar {
    filter: blur(2.5px); opacity: .5; transition: filter var(--motion-fast) var(--ease-ui), opacity var(--motion-fast) var(--ease-ui);
  }
  .stage.veiled .map-back { --dof: var(--dof-rest); }

  .map-reference { position: relative; display: flex; justify-content: flex-start; width: 100%; }
  .map-reference :global(.mini-map) { flex: none; }
  .map-guide { position: relative; z-index: var(--z-content); display: grid; align-content: start; gap: var(--spacing-xs); width: fit-content; max-width: 100%; min-width: 0; }
  .map-guide.open { width: 100%; padding: var(--spacing-sm); }
  .map-tools-content, .map-tools { display: grid; gap: var(--spacing-sm); min-width: 0; font-size: var(--font-xs); }
  .map-tools-section { min-width: 0; }
  .map-tools-section summary { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); padding-block: var(--spacing-xs); cursor: pointer; }
  .map-tools-chevron { width: var(--icon-label); height: var(--icon-label); }
  .map-tools-section[open] > summary .map-tools-chevron { transform: rotate(180deg); }
  .map-hint { margin: 0; line-height: 1.35; }
  .map-views { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-xs); }
  .map-views button { min-width: 0; padding: var(--spacing-xs); white-space: nowrap; }
  .map-overlays, .map-overlays label { display: flex; align-items: center; gap: var(--spacing-xs); }
  .map-overlays { flex-wrap: wrap; gap: var(--spacing-xs) var(--spacing-md); }
  .map-level { display: flex; align-items: center; gap: var(--spacing-xs); }
  .map-level input { flex: 1; width: 100%; min-width: 0; }
  .map-level output { min-width: var(--icon-label); text-align: right; }
  .map-zoom { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto; align-items: center; gap: var(--spacing-xs); }
  .map-zoom button { min-width: var(--icon-label); padding: var(--spacing-xs); line-height: 1.2; }
  .map-zoom output { text-align: center; font-variant-numeric: tabular-nums; }
  .map-legend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-xs) var(--spacing-sm); padding-block: var(--spacing-xs); }
  .map-legend .swatch { display: flex; align-items: flex-start; gap: var(--spacing-xs); min-width: 0; line-height: 1.2; }
  .map-legend .swatch i { width: var(--icon-detail); height: var(--icon-detail); flex: none; }
  .map-legend .ramp { grid-column: 1 / -1; align-items: center; }
  .map-legend .ramp i { flex: 1; width: auto; }

  .mapcard {
    position: fixed; left: 50%; bottom: clamp(58px, 4.45vw, 124px); transform: translateX(-50%);
    width: min(clamp(350px, 27.11vw, 756px), 52%); z-index: var(--z-highlight); overflow-y: auto;
  }
  .picklist tr { cursor: pointer; }
  .picklist tr.picked { background: var(--panel); }
  .desk-content .picklist .mob-hp { white-space: nowrap; }


  /* the Hub Grid shell: fixed, never scrolls; an overgrown region scrolls inside itself (docs/skins.md) */
  .stage {
    position: fixed;
    inset: 0;
    overflow: hidden;

    --rail-h: clamp(52px, 3.29vw, 66px);

    --controls-h: calc(var(--rail) + var(--spacing-sm));

    --menu-row-h: calc(var(--icon-hub) + var(--font-xs) + var(--spacing-xs) + var(--spacing-xs) + var(--spacing-xs));
    --band-toast: calc(var(--screen-pad) + var(--menu-row-h) + var(--spacing-sm) + var(--menu-row-h) + var(--spacing-xs) + var(--spacing-xs) + var(--spacing-xs));
    --band-note: clamp(64px, 7.89vw, 264px);
    background:
      radial-gradient(120% 85% at 50% 115%, color-mix(in srgb, var(--glow-moss) 30%, transparent), transparent 62%),
      radial-gradient(95% 70% at 50% -12%, color-mix(in srgb, var(--glow-dusk) 32%, transparent), transparent 64%),
      linear-gradient(180deg, var(--ground) 0%, var(--ground-2) 45%, var(--ground-3) 100%);
  }
  .stage.showcase { position: relative; inset: auto; width: 100%; height: auto; min-height: 0; }
  .stage.showcase .mapcard { position: absolute; }

  .stage::after {
    content: ''; position: absolute; inset: 0; z-index: var(--z-underlay); pointer-events: none;
    background: radial-gradient(115% 95% at 50% 48%, transparent 52%, rgba(0, 0, 0, .55));
  }
  .tracker, .field { z-index: var(--z-content); }

  .stage:has(.toast) .field { grid-row-start: 5; }
  .stage:not(:has(.toast)) .save-note { top: var(--band-toast); }
  .stage:has(.toast) .save-note { top: calc(var(--band-toast) + var(--band-note)); }

  .toast {
    position: absolute; top: var(--band-toast); left: 50%; transform: translateX(-50%); z-index: var(--z-floater);
    display: flex; flex-wrap: wrap; gap: var(--spacing-xs) var(--spacing-sm); align-items: baseline; max-width: min(clamp(575px, 44.53vw, 1242px), 62%);
    padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-xs);
  }


  .pill {
    display: inline-flex; align-items: center; gap: var(--spacing-xs); padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-card);
    background: var(--glass); border: 1px solid var(--edge); font-size: var(--font-xs);
    font-variant-numeric: tabular-nums; backdrop-filter: blur(6px);
  }
  .pill.note { color: var(--good); }

  .save-note {
    position: absolute; top: var(--band-note); left: 50%; transform: translateX(-50%); z-index: var(--z-label);
    max-width: min(clamp(425px, 32.91vw, 918px), 86%);
  }


  .tracker {
    width: var(--objectives-w); pointer-events: auto; z-index: var(--z-content);
    display: grid; gap: var(--spacing-xs); align-content: start; justify-items: stretch;
  }
  .tracker .phase, .tracker .alarm-line {
    margin: 0; padding: var(--spacing-xs) var(--spacing-xs); border-radius: var(--radius-card); font-size: var(--font-xs);
    background: linear-gradient(90deg, rgba(0, 0, 0, .66), rgba(0, 0, 0, .38) 78%, transparent);
  }
  .account-hold { display: grid; justify-items: start; gap: var(--spacing-xs); }
  .account-hold .chip { display: flex; max-width: 100%; padding: var(--spacing-xs) var(--spacing-xs); white-space: normal; line-height: 1.2; }
  .tracker .phase {
    color: var(--gold-lit); text-transform: uppercase;
    letter-spacing: clamp(1px, 0.05vw, 2px);
    box-shadow: inset 2px 0 0 var(--gold);
    font-size: var(--font-sm); font-weight: 650; line-height: 1.25;
  }

  .tracker .phase, .tracker .alarm-line {
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical;
  }
  .alarm-line { color: var(--alarm); font-size: var(--font-sm); font-weight: 600; line-height: 1.25; }


  .field {
    min-width: 0; min-height: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: var(--spacing-md);
    overflow: visible;
    padding-bottom: calc(var(--card-w) * 1.5 + var(--pad-area));

    --card-w: var(--field-card-size);

    pointer-events: none;

    --dof: 0px;
    filter: blur(var(--dof));
    opacity: calc(1 - var(--dof) / 10);
  }

  .clear-field {
    display: grid; gap: var(--spacing-xs); justify-items: center; text-align: center; pointer-events: none;
    color: var(--dim); font-size: var(--font-xs);
  }

  .target-hp i {
    background-size: calc(100% / max(var(--w, 1), .001)) 100%;
  }


  .actionbar {

    z-index: var(--z-highlight);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--spacing-xs);


    --slot-face: rgba(12, 16, 22, .82);
    --slot-edge: rgba(255, 255, 255, .5);
  }
  .action-xp {
    position: fixed; inset-inline: 0; bottom: 0; z-index: var(--z-underlay);
    display: flex; align-items: center; justify-content: center;
    height: clamp(10px, 0.78vw, 21px);
    border: 0; border-top: 1px solid var(--edge); border-radius: var(--radius-card); overflow: hidden;
  }
  .action-xp i {
    position: absolute; inset: 0; border-radius: inherit;
    background-size: calc(100% / max(var(--w, 1), .001)) 100%;
    transform: scaleX(var(--fill)); transform-origin: left center;
  }
  .action-xp b {
    position: relative; color: var(--text);
    font-family: var(--num); font-size: var(--font-xs); line-height: 1;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .95);
  }
  .action-cluster { display: flex; align-items: flex-end; gap: var(--spacing-md); }
  .vital-stack { --orb-size: clamp(100px, 7.74vw, 216px); display: flex; flex: none; flex-direction: column; align-items: center; gap: var(--spacing-xs); width: var(--orb-size); container-type: inline-size; }
  .orb-readout {
    position: absolute; inset: 0; z-index: var(--z-label); pointer-events: none;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--spacing-xs);
    box-sizing: border-box; padding: 0 var(--spacing-sm);
    color: var(--text); font-family: var(--ui); font-size: clamp(var(--font-xs), 8cqw, var(--font-sm)); font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; text-shadow: 0 1px 3px rgba(0, 0, 0, .95); white-space: nowrap;
  }
  .orb-readout > span { max-width: 100%; overflow: hidden; }
  .orb-readout strong { font-weight: inherit; }
  .orb-shield { color: var(--es); }
  .orb-reserved { color: var(--dim); }

  .vital-orb {
    position: relative; flex: none; width: var(--orb-size); height: var(--orb-size); padding: var(--spacing-xs);
    isolation: isolate; border-radius: var(--radius-round); background: var(--face-floor); container-type: inline-size;
    box-shadow: 0 4px 14px rgba(0, 0, 0, .7), inset 0 1px 0 rgba(255, 255, 255, .18);
  }
  .vital-orb::after {
    content: ''; position: absolute; inset: 0; z-index: var(--z-floater); pointer-events: none;
    background: url('./assets/orb-skin.webp') center / contain no-repeat;
    -webkit-mask: radial-gradient(circle, transparent 0 58%, var(--text) 70%);
            mask: radial-gradient(circle, transparent 0 58%, var(--text) 70%);
    filter: brightness(1.15) contrast(1.05);
  }
  .orb-well {
    position: absolute; inset: var(--spacing-xs); overflow: hidden; border-radius: var(--radius-round);
    background: radial-gradient(circle at 35% 25%, rgba(255, 255, 255, .09), transparent 34%), var(--face-floor);
    box-shadow: 0 4px 10px rgba(0, 0, 0, .6), inset 0 0 0 1px rgba(255, 255, 255, .10),
                inset 0 2px 10px rgba(0, 0, 0, .8), inset 0 -12px 20px rgba(0, 0, 0, .45);
  }
  .orb-well::before {
    content: ''; position: absolute; inset: 0; z-index: var(--z-content); pointer-events: none;
    background: url('./assets/orb-skin.webp') center / cover no-repeat;
    mix-blend-mode: soft-light; opacity: .45;
  }
  /* the ES film scales with `--shield-strength` and stays translucent at full, so red reads through it;
     the top-edge hairline is what names the level */
  .life-orb .orb-well::after {
    content: ''; position: absolute; inset: 0; z-index: var(--z-effect); pointer-events: none;
    background: linear-gradient(180deg, color-mix(in srgb, var(--es-lit) 80%, transparent), transparent 3%),
                radial-gradient(circle at 35% 20%, color-mix(in srgb, var(--es-lit) 52%, transparent), transparent 66%),
                linear-gradient(145deg, color-mix(in srgb, var(--es) 58%, transparent),
                                          color-mix(in srgb, var(--mana) 46%, transparent));
    border-top: 1px solid color-mix(in srgb, var(--es-lit) 88%, transparent);
    opacity: calc(.16 + var(--shield-strength) * .34);
    filter: saturate(calc(.7 + var(--shield-strength) * .5)) brightness(calc(.86 + var(--shield-strength) * .3));
    transform: scaleY(var(--shield-strength)); transform-origin: bottom;
  }
  .mana-orb.reserved .orb-well::after {
    content: ''; position: absolute; top: 0; left: 0; right: 0; z-index: var(--z-effect); pointer-events: none;
    height: var(--reserved); border-bottom: 1px solid color-mix(in srgb, var(--mana-lit) 35%, var(--edge));
    background: linear-gradient(180deg, color-mix(in srgb, var(--face-floor) 92%, var(--dim)),
                                          color-mix(in srgb, var(--face-floor) 70%, var(--mana)));
    opacity: .94;
  }
  .orb-fill {
    position: absolute; inset: 0; z-index: var(--z-underlay); overflow: hidden;
    transform: translateY(calc((1 - var(--fill)) * 100%));
    transition: transform .3s ease-out;
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
  /* Two soft plumes behind the brighter circulating energy; both stay below the waterline. */
  .orb-warp-defs { position: absolute; }
  .orb-ink { position: absolute; inset: -30%; pointer-events: none; }
  .orb-ink i { position: absolute; inset: 0; }
  .orb-ink::before, .orb-ink::after, .orb-ink i::before, .orb-ink i::after { content: ''; position: absolute; }
  .orb-ink::before {
    inset: 10% 6% 16%;
    background:
      radial-gradient(ellipse 42% 55% at 32% 38%, color-mix(in srgb, var(--liquid-light) 38%, transparent), transparent 72%),
      radial-gradient(ellipse 30% 42% at 66% 58%, color-mix(in srgb, var(--liquid-light) 26%, transparent), transparent 74%);
    filter: url(#orb-warp) blur(9px);
    mix-blend-mode: screen;
    animation: ink-a 23s ease-in-out infinite alternate;
  }
  .orb-ink::after {
    inset: 16% 10% 6%;
    background:
      radial-gradient(ellipse 36% 48% at 60% 66%, rgba(0, 0, 0, .55), transparent 72%),
      radial-gradient(ellipse 24% 34% at 34% 30%, color-mix(in srgb, var(--liquid-light) 16%, transparent), transparent 70%);
    filter: url(#orb-warp) blur(12px);
    mix-blend-mode: soft-light;
    animation: ink-b 31s ease-in-out infinite alternate;
  }
  .orb-ink i::before { inset: 8% 12% 24%; }
  .orb-ink i::after { inset: 24% 16% 12%; }
  @keyframes ink-a {
    0% { transform: translate(-8%, 5%) rotate(-14deg) scale(1); }
    38% { transform: translate(6%, -7%) rotate(10deg) scale(1.14); }
    71% { transform: translate(10%, 8%) rotate(-5deg) scale(.92); }
    100% { transform: translate(-3%, -4%) rotate(15deg) scale(1.06); }
  }
  @keyframes ink-b {
    0% { transform: translate(7%, -6%) rotate(12deg) scale(1.05); }
    33% { transform: translate(-9%, 4%) rotate(-8deg) scale(.9); }
    64% { transform: translate(2%, 9%) rotate(16deg) scale(1.16); }
    100% { transform: translate(-5%, -8%) rotate(-13deg) scale(.98); }
  }
  @media (prefers-reduced-motion: reduce) {
    .orb-fill { transition: none; }
    .orb-fill::before, .orb-fill::after { animation: none; }
    .orb-ink::before, .orb-ink::after, .orb-ink i::before, .orb-ink i::after { animation: none; }
    .orb-cast, .orb-shatter { animation: none; opacity: 0; }
  }
  .orb-gloss { position: absolute; inset: 0; z-index: var(--z-highlight); pointer-events: none; }
  .orb-gloss::before {
    content: ''; position: absolute; inset: 6% 17% 53% 7%; border-radius: var(--radius-round);
    transform: rotate(-24deg); pointer-events: none;
  }
  .orb-gloss::after { content: ''; position: absolute; inset: 0; border-radius: var(--radius-round); pointer-events: none; }
  .orb-ripple { position: absolute; inset: 8%; border-radius: var(--radius-round); z-index: var(--z-effect); pointer-events: none; }
  .orb-recharge { position: absolute; inset: auto 0 0; height: 70%; z-index: var(--z-effect); pointer-events: none; transform-origin: bottom; }
  .orb-fill::before, .orb-fill::after, .orb-ink::before, .orb-ink::after { animation-play-state: var(--orb-play-state, running); }
  /* shield break: falls inward toward the body, mounted per break, never on a loop */
  .orb-shatter {
    position: absolute; inset: 0; z-index: var(--z-label); pointer-events: none; border-radius: var(--radius-round);
    background: radial-gradient(circle, rgba(255, 255, 255, .5), rgba(255, 255, 255, 0) 54%),
                radial-gradient(circle, rgba(255, 255, 255, 0) 44%,
                  color-mix(in srgb, var(--es-lit) 78%, transparent) 68%, rgba(255, 255, 255, 0) 88%);
    opacity: 0;
    animation: orb-shatter var(--motion-map) var(--ease-out) forwards;
  }
  @keyframes orb-shatter {
    from { transform: scale(1.04); opacity: .95; filter: brightness(1.7); }
    to { transform: scale(.7); opacity: 0; filter: brightness(1); }
  }
  /* cast breath: short and low — the row fires constantly, a long swell reads as its own pulse */
  .orb-cast {
    position: absolute; inset: auto 0 0; z-index: var(--z-label); pointer-events: none;
    height: 46%; transform-origin: bottom center;
    background: radial-gradient(ellipse 68% 100% at 50% 100%,
      color-mix(in srgb, var(--fx, var(--mana-lit)) 55%, transparent), rgba(255, 255, 255, 0) 72%);
    animation: orb-cast var(--motion-ui) var(--ease-out) forwards;
  }
  @keyframes orb-cast {
    from { transform: scaleY(.55); opacity: .75; }
    to { transform: scaleY(1.3); opacity: 0; }
  }


  .casts {
    display: grid; grid-template-columns: repeat(8, var(--slot-skill-size)); justify-content: center;
    align-content: flex-end; gap: var(--spacing-xs);
  }
  .cast-stack { display: flex; flex-direction: column; gap: var(--spacing-xs); min-width: 0; }
  .cast { width: var(--slot-skill-size); height: var(--slot-skill-size); }
  .cast img { width: var(--icon-hub-img); height: var(--icon-hub-img); object-fit: contain; }

  .cast.silent { opacity: .4; }
  .cast.gated { border-style: dashed; border-color: rgba(255, 255, 255, .45); }
  .cast.filler { border-color: rgba(255, 255, 255, .18); }
  .cast small {
    position: absolute; inset: 0; display: grid; place-items: center; border-radius: var(--radius-card);
    background: none; font-size: clamp(var(--font-xs), calc(var(--slot-skill-size) * .3), var(--font-md)); color: var(--gold-lit);
    font-variant-numeric: tabular-nums; text-shadow: 0 1px 3px rgba(0, 0, 0, .95);
  }

  .cast .sweep {
    position: absolute; inset: 0; border-radius: var(--radius-card); pointer-events: none;
    background: conic-gradient(from -90deg, transparent 0 var(--skill-cooldown-progress), rgba(6, 8, 11, .66) var(--skill-cooldown-progress) 100%);
    transition: --skill-cooldown-progress var(--cooldown-step, 0ms) linear;
  }
  .cast.paused .sweep { transition: none; }
  @media (prefers-reduced-motion: reduce) { .cast .sweep { transition: none; } }
  .cast b { position: absolute; top: clamp(-8px, -0.29vw, -4px); left: clamp(-3px, -0.10vw, -1px); font-size: var(--font-xs); color: var(--dim); }


  .toggle-ring {
    position: relative; isolation: isolate; flex: none; display: grid; place-items: center;
    width: var(--icon-hub); height: var(--icon-hub); padding: var(--spacing-xs);
    border: 1px solid var(--hud-edge); border-radius: var(--radius-round); background: var(--hud-face); box-sizing: border-box;
  }
  .toggle-ring > img, .toggle-ring > svg {
    position: relative; z-index: var(--z-underlay);
    width: var(--icon-hub-img); height: var(--icon-hub-img); aspect-ratio: 1 / 1;
    padding: 0; border: 0; border-radius: var(--radius-card); background: none; box-sizing: border-box;
    object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .9));
  }
  .toggle-ring > svg { fill: none; stroke: currentColor; stroke-width: 1.5; }
  .toggle-ring.here { border-color: color-mix(in srgb, var(--gold) 65%, var(--hud-edge)); background: var(--hud-face); }
  .toggle-ring.here::before, .toggle-ring.here::after {
    content: ''; position: absolute; inset: 0; border-radius: var(--radius-round);
    pointer-events: none; animation: auto-border-light 1.3s linear infinite;
  }
  .toggle-ring.here::before {
    inset: calc(var(--spacing-xs) * -1); z-index: var(--z-content);
    background: conic-gradient(transparent 0deg 240deg, color-mix(in srgb, var(--gold) 26%, transparent) 262deg, color-mix(in srgb, var(--gold-lit) 58%, transparent) 295deg, transparent 332deg);
    mask: radial-gradient(circle closest-side, transparent 70%, #000 80%, transparent 90%);
    filter: drop-shadow(0 0 var(--spacing-sm) color-mix(in srgb, var(--gold) 72%, transparent));
  }
  .toggle-ring.here::after {
    inset: calc(var(--spacing-xs) * -1); z-index: var(--z-effect);
    background: conic-gradient(transparent 0deg 270deg, color-mix(in srgb, var(--gold-lit) 55%, transparent) 292deg, #fff 309deg, var(--gold-lit) 318deg, transparent 337deg);
    mask: radial-gradient(circle closest-side, transparent 82%, #000 90%, transparent 100%);
    filter: drop-shadow(0 0 var(--spacing-xs) var(--gold-lit));
  }
  @keyframes auto-border-light { to { transform: rotate(1turn); } }
  @media (prefers-reduced-motion: reduce) {
    .toggle-ring.here::before, .toggle-ring.here::after { animation: none !important; }
  }
  .field-feed {
    z-index: var(--z-control);
    display: flex; align-items: flex-end; gap: var(--spacing-xs);
    pointer-events: none;
  }

  .topright {
    z-index: var(--z-hud-control);
    display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-xs);
    pointer-events: none;
  }
  .topright > * { pointer-events: auto; }
  .command-row { display: flex; justify-content: flex-end; align-items: flex-start; gap: var(--spacing-xs); min-width: 0; }
  .commands-dock { z-index: var(--z-hud-control); display: flex; flex-direction: column; justify-content: center; gap: var(--spacing-xs); min-width: 0; max-width: 100%; pointer-events: none; }
  .commands-dock > * { pointer-events: auto; }
  .speed-mark { color: var(--dim); font-size: var(--font-xs); font-variant-numeric: tabular-nums; }
  .speed-mark.here { color: var(--gold-lit); }
  .field-travel-actions {
    grid-area: travel; z-index: var(--z-travel); width: 100%; min-width: 0;
    display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-xs);
    pointer-events: none;
  }
  .field-travel-actions > * { pointer-events: auto; }

  .zone-tag {
    margin: 0; align-self: stretch; display: flex; align-items: center; gap: var(--spacing-xs); min-width: 0;
    padding: var(--spacing-xs) var(--spacing-xs); border-radius: var(--radius-card);
    background: var(--hud-face);
    border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--edge));
    box-shadow: var(--shadow-soft), inset 0 1px 0 rgba(255, 255, 255, .06);
    color: var(--text);
  }
  .zone-emblem { flex: none; width: var(--icon-label); height: var(--icon-label); object-fit: contain; opacity: .9; }
  .zone-copy { display: grid; gap: var(--spacing-xs); min-width: 0; flex: 1; }
  .zone-copy span { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .zone-tag.traveling { align-items: flex-start; }
  .zone-tag.traveling .zone-copy span { overflow: visible; white-space: normal; }
  .zone-copy span { color: var(--dim); font-size: var(--font-xs); }
  .zone-level { flex: none; padding-left: var(--spacing-xs); border-left: 1px solid var(--edge); color: var(--gold-lit); font-size: var(--font-xs); font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .zone-emblem { padding: var(--spacing-xs); border: 1px solid var(--hud-edge); border-radius: var(--radius-round); background: var(--hud-face); box-sizing: border-box; }
  .targetbar {
    z-index: var(--z-content);
    display: flex; flex-direction: column; align-items: center; gap: var(--spacing-xs);
    pointer-events: none; text-align: center;
  }
  .target-name { margin: 0; font-size: var(--font-xs); color: var(--text); white-space: nowrap; text-shadow: 0 1px 2px rgba(0, 0, 0, .95); }
  .target-name {
    display: inline-flex; align-items: center; gap: var(--spacing-xs);
    text-transform: uppercase; letter-spacing: clamp(1px, 0.05vw, 2px);
    padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-card);
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
    transition: transform var(--motion-travel) var(--ease-glide);
  }

  .target-hp::after {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 45%; pointer-events: none;
    background: linear-gradient(180deg, rgba(255, 255, 255, .16), transparent);
  }
  .target-hp b {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: var(--font-xs); font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .95); pointer-events: none;
  }


  .rail {
    z-index: var(--z-navigation);
    display: flex; flex-direction: column; align-items: flex-end; gap: var(--spacing-xs);
    padding: var(--spacing-xs); pointer-events: none;
  }
  .hud-slide-handle { display: flex; align-self: flex-end; min-width: 0; max-width: 100%; pointer-events: auto; }
  .menu-actions { display: flex; justify-content: flex-end; align-items: flex-start; gap: var(--spacing-sm); min-width: 0; pointer-events: auto; }
  .hud-slide-content {
    transform: translateX(0); opacity: 1; visibility: visible;
    transition: transform var(--motion-ui) var(--ease-glide), opacity var(--motion-fast) var(--ease-ui), visibility 0s;
  }
  .hud-slide-content.collapsed {
    transform: translateX(calc(100% + var(--pad-area))); opacity: 0; visibility: hidden; pointer-events: none;
    transition-delay: 0s, 0s, var(--motion-ui);
  }
  @media (prefers-reduced-motion: reduce) {
    .hud-slide-content, .hud-slide-content.collapsed { transform: none; transition: none; }
  }
  .hub-collapsible[hidden] { display: none; }
  .field-objectives { grid-area: tasks; height: 100%; min-width: 0; min-height: 0; padding: var(--pad-area); pointer-events: none; z-index: var(--z-control); }
  .field-objectives > :global(*) { pointer-events: auto; }
  .purse { display: inline-flex; align-items: center; gap: var(--spacing-xs); flex: none; font-variant-numeric: tabular-nums; }
  .purse img { width: var(--icon-label); height: var(--icon-label); padding: var(--spacing-xs); border: 1px solid var(--hud-edge); border-radius: var(--radius-round); background: var(--hud-face); box-sizing: border-box; object-fit: contain; }
  .purse b { font-size: var(--font-sm); font-weight: 700; color: var(--gold-lit); line-height: 1; }
  .purse i { font-size: var(--font-xs); font-style: normal; color: var(--dim); line-height: 1; text-transform: uppercase; letter-spacing: 1px; }
  .hub-control {
    position: relative; flex: none; display: flex; flex-direction: column;
    align-items: center; justify-content: flex-start; gap: var(--spacing-xs);
    min-width: var(--icon-hub); padding: 0;
  }
  .hub-control .cap { white-space: nowrap; text-align: center; }

  .morebox {
    position: absolute; top: calc(100% + var(--spacing-xs)); right: 0;
    display: grid; grid-template-columns: repeat(8, minmax(var(--icon-card), 1fr)); gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: var(--glass); backdrop-filter: blur(6px);
    border: 1px solid var(--edge); border-radius: var(--radius-card);
    box-shadow: var(--shadow-soft);
  }
  .more-count { position: absolute; top: 0; right: 0; }

  .invbody { display: grid; align-content: start; gap: var(--spacing-sm); min-height: 0; overflow: visible; }
  .invbody > section { min-height: 0; overflow: visible; }

  .inventory-layout { display: grid; grid-template-columns: minmax(max-content, 1fr) minmax(0, 4fr); align-items: start; gap: var(--spacing-md); min-width: 0; min-height: 0; }
  .inventory-tabs { display: grid; align-content: start; gap: var(--spacing-xs); min-width: 0; border-right: 1px solid var(--line); padding-right: var(--spacing-md); }
  .inventory-tab { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: var(--spacing-xs); width: 100%; min-width: 0; text-align: left; }
  .inventory-tab-label { display: inline-flex; align-items: center; gap: var(--spacing-xs); min-width: 0; }
  .inventory-tab-art { width: var(--icon-label); height: var(--icon-label); object-fit: contain; flex: none; }
  .inventory-tab small { text-align: right; }

  @media (max-width: 1200px) {
    .inventory-layout { grid-template-columns: minmax(0, 1fr); }
    .inventory-tabs { display: flex; flex-direction: row; flex-wrap: wrap; border-right: 0; padding-right: 0; border-bottom: 1px solid var(--line); padding-bottom: var(--spacing-sm); }
    .inventory-tab { flex: 1 1 auto; align-items: center; width: auto; text-align: center; }
  }

  .sides { display: flex; gap: var(--spacing-xs); border-bottom: 1px solid var(--line); padding-bottom: var(--spacing-sm); }

  .bagshell { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--spacing-sm); align-items: start; min-width: 0; }
  .sheet-tools { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); }
  /* Equipment over Core stats, beside the complete character values. */
  .sheet-layout {
    flex: 1; min-height: 0; display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 3fr);
    grid-template-areas: "build stats";
    gap: var(--spacing-md); overflow: hidden;
  }
  .sheet-build { grid-area: build; display: flex; flex-direction: column; align-items: stretch; gap: var(--spacing-md); min-width: 0; min-height: 0; }
  .sheet-doll { display: flex; flex: none; flex-direction: column; gap: var(--spacing-sm); min-height: 0; min-width: 0; width: 100%; }
  .sheet-doll h3 { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-xs); font-size: var(--font-sm); }
  .sheet-doll h3 span { font-variant-numeric: tabular-nums; }
  .sheet-values { grid-area: stats;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, clamp(170px, 12vw, 300px)), 1fr));
    gap: var(--spacing-md); align-content: start; min-height: 0; height: 100%; overflow: auto;
  }
  .sheet-value-column { display: flex; flex-direction: column; gap: var(--spacing-md); min-width: 0; }
  .sheet-stat-group { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .sheet-stat-group h3 { font-size: var(--font-sm); }
  .sheet-values .stats { width: 100%; border-collapse: collapse; }
  .sheet-values .stats td { padding: var(--spacing-xs); font-size: var(--font-xs); line-height: 1.25; vertical-align: top; }
  .sheet-values .stats td:first-child { width: 52%; }
  .sheet-values .stats td:last-child { text-align: right; }
  .sheet-values .stats small { display: block; }
  .sheet-life .sheet-values { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
  .sheet-layout.sheet-life { grid-template-columns: minmax(0, 1fr); grid-template-areas: "stats"; }
  .sheet-life .stats td:first-child { text-transform: capitalize; }
  @media (max-width: 1200px) {
    /* scroll ownership moves from the values column to the layout — still exactly one scroller */
    .sheet-layout { grid-template-columns: minmax(0, 1fr); grid-template-areas: "build" "stats"; overflow: auto; }
    .sheet-values { height: auto; overflow: visible; }
  }
  .sheet-gate { margin: 0; color: var(--dim); font-size: var(--font-xs); }
  .sheet-new-character { display: inline-flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-xs); white-space: nowrap; }
  .sheet-new-character img { width: var(--icon-detail); height: var(--icon-detail); object-fit: contain; }

  .bagtools .margin { display: inline-flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-xs); color: var(--dim); }
  .bagtools .margin input { width: var(--input-narrow); }

  .bagtools .best { border-color: color-mix(in srgb, var(--good) 55%, transparent); color: var(--good-lit); background: color-mix(in srgb, var(--good) 10%, transparent); }

  .bagmain { display: flex; flex-direction: column; gap: var(--spacing-xs); min-width: 0; }
  .bagtools, .bagview { display: flex; flex: 1 1 auto; align-items: center; gap: var(--spacing-xs); flex-wrap: wrap; min-width: 0; }
  .bagtools .grow, .bagview .grow { flex: 1; }
  .bagsearch { min-width: clamp(69px, 5.32vw, 149px); }
  .bagtier { display: inline-flex; align-items: center; gap: var(--spacing-xs); font-size: var(--font-xs); color: var(--dim); }
  .bagtools .best:hover { border-color: var(--good); }
  .equipnote { position: relative; top: var(--x-pull-note); font-size: var(--font-xs); color: var(--good); }
  .bagblock { display: grid; align-content: start; gap: var(--spacing-xs); border: 0; }
  .bagblock:has(.filter[open]) .bagshell { display: none; }
  .bagmeta { margin: 0; }
  .filterpresets { display: grid; gap: var(--spacing-xs); border-top: 1px solid var(--line); padding-top: var(--spacing-sm); }
  .filterpresets-head { margin: 0; display: flex; align-items: baseline; gap: var(--spacing-xs); flex-wrap: wrap; }
  .presetrow { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--spacing-xs); grid-template-columns: repeat(auto-fill, minmax(min(100%, clamp(210px, 16.22vw, 437px)), 1fr)); }
  .presetrow li { display: flex; align-items: center; gap: var(--spacing-xs); }
  .presetrow li span { min-width: 6ch; }
  .presetrow button, .presetrow small { font-size: var(--font-xs); }
  .autodissolve input { width: var(--input-narrow); }
  .skill-label { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .skill-label .chip { padding-inline: var(--spacing-xs); }
  .skill-label img { width: var(--icon-label); height: var(--icon-label); object-fit: contain; flex: none; }

  .gate {
    padding: var(--spacing-xs) var(--spacing-xs); font-size: var(--font-xs); color: var(--gold); cursor: pointer;
    background: none; border: 1px dashed color-mix(in srgb, var(--gold) 50%, transparent); border-radius: var(--radius-card);
  }
  .gate:hover { border-style: solid; }

  .gate-editor td { background: color-mix(in srgb, var(--gold) 5%, transparent); font-size: var(--font-xs); }
  .gate-editor label { white-space: nowrap; }
  .gate-editor input[type='number'] { width: var(--input-narrow); }
  .bagblock + .bagblock { border-top: 1px solid var(--line); padding-top: var(--spacing-sm); }
  .stats td { font-size: var(--font-xs); padding: var(--spacing-xs) var(--spacing-xs); }
  .stats td:first-child { color: var(--dim); width: 45%; }
  .save-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; align-content: start; gap: var(--spacing-sm); }
  .account-writer { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-xs); border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--inset); }
  .account-writer.owner { border-color: color-mix(in srgb, var(--good) 48%, var(--line)); }
  .account-writer p { flex: 1 1 clamp(150px, 11.62vw, 324px); min-width: 0; color: var(--dim); font-size: var(--font-xs); }
  .account-writer.owner p { color: var(--good-lit); }
  .account-writer label { display: inline-flex; align-items: center; gap: var(--spacing-xs); color: var(--dim); font-size: var(--font-xs); }
  .account-writer select, .account-writer button { font-size: var(--font-xs); border-radius: var(--radius-card); }
  .save-tabs, .farm-tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); flex: none; }
  .save-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; }
  .save-panel h2 { margin: 0; font-size: var(--font-md); }
  .save-panel p { margin: 0; }
  .save-panel table { font-size: var(--font-xs); }
  .save-note-inline { color: var(--good); font-size: var(--font-xs); }
  .desk-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .desk-tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); flex: none; }
  .desk-content { display: flex; flex-direction: column; gap: var(--spacing-xs); flex: 1; min-height: 0; overflow: auto; }
  .desk-content p { font-size: var(--font-xs); }
  .desk-content .picklist th, .desk-content .picklist td { padding: var(--spacing-xs) var(--spacing-xs); line-height: 1.1; font-size: var(--font-xs); }
  .desk-content .picklist button { font-size: var(--font-xs); }
  .skills-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .skill-tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); flex: none; }
  .skill-note { margin: 0; color: var(--good); font-size: var(--font-xs); }
  .skill-view { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .skill-view h3 { margin: 0; }
  .skill-view table { width: 100%; }
  .skill-view th, .skill-view td { padding: var(--spacing-xs) var(--spacing-xs); line-height: 1.15; font-size: var(--font-xs); }
  .skill-view select { max-width: 100%; padding: var(--spacing-xs) var(--spacing-xs); font-size: var(--font-xs); }
  .skill-view .skill-label { gap: var(--spacing-xs); }
  .skill-view .skill-label img { width: var(--icon-detail); height: var(--icon-detail); }
  .skill-view label { font-size: var(--font-xs); }
  .skill-view .prose { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .skill-owned-grid, .skill-effect-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(113px, 8.71vw, 243px), 1fr)); gap: var(--spacing-xs); align-content: start; }
  .skill-owned-grid { flex: 1; min-height: 0; overflow: hidden; }
  .skill-owned { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-xs); padding: var(--spacing-xs) var(--spacing-xs); border: 1px solid var(--line); background: var(--inset); }
  .skill-owned .skill-label { min-width: 0; }
  .skill-owned .skill-label b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-xs); font-weight: 500; }
  .skill-owned small { flex: none; color: var(--dim); font-size: var(--font-xs); }
  .empty-owned { grid-column: 1 / -1; color: var(--dim); font-size: var(--font-xs); }
  .effects-view { gap: var(--spacing-xs); }
  .effects-view section { display: grid; gap: var(--spacing-xs); min-width: 0; }
  .effects-view h3 { margin: 0; }
  .skill-effect-grid label { display: flex; align-items: center; gap: var(--spacing-xs); min-width: 0; margin: 0; padding: var(--spacing-xs) var(--spacing-xs); border-bottom: 1px solid var(--line); }
  .skill-effect-grid .skill-label { min-width: 0; overflow: hidden; }
  .skill-effect-grid .skill-label img { flex: none; }
  .skill-effect-grid .skill-label { white-space: nowrap; text-overflow: ellipsis; }
  .skill-effect-grid > small { grid-column: 1 / -1; color: var(--dim); }
  .reserve-note { margin: 0; color: var(--dim); font-size: var(--font-xs); }
  .farm-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .farm-panel > p { margin: 0; font-size: var(--font-xs); }
  .farm-tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); flex: none; }
  .farm-note { color: var(--good); }
  .filter { display: grid; align-content: start; gap: var(--spacing-xs); }
  .filter summary { cursor: pointer; color: var(--dim); font-size: var(--font-xs); }
  .filter table { margin: 0; }

  .prose { display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .prose summary { cursor: pointer; color: var(--dim); font-size: var(--font-xs); }
  .prose summary:hover { color: var(--text); }
  .weight { margin: 0; font-size: var(--font-xs); color: var(--dim); white-space: nowrap; }
  .weight small { color: var(--dim); }
  .warn { color: var(--alarm); }

  .townnote { font-size: var(--font-xs); color: var(--good); }

  .aloud {
    position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden;
    clip-path: inset(50%); white-space: nowrap; border: 0;
  }

  .knob:focus-visible, .cast:focus-visible, .face:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }



  .floaters { position: absolute; inset: 0; pointer-events: none; z-index: var(--z-floater); }
  .float-side { position: absolute; display: flex; flex-direction: column-reverse; gap: var(--spacing-xs); }

  .field-side { right: var(--screen-pad); bottom: calc(var(--controls-h) + var(--screen-pad) * 2); left: auto; transform: none; align-items: flex-end; }

  .fx:not(.pop-loot) {
    --lane: 0;
    font-family: var(--num);
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--fx, var(--text));
    text-shadow: 0 1px 0 rgba(0, 0, 0, .85), 0 var(--spacing-xs) clamp(4px, 0.34vw, 9px) rgba(0, 0, 0, .7);
    animation: fx-rise 1.5s cubic-bezier(.2, .6, .3, 1) forwards;
    white-space: nowrap;
  }
  .fx-hit { font-size: var(--font-md); -webkit-text-stroke: .45px currentColor; }
  .fx-hit.crit { font-size: var(--font-lg); -webkit-text-stroke-width: .8px; animation: fx-crit 1.9s cubic-bezier(.15, .8, .3, 1) forwards; }
  .fx-proc, .fx-block, .fx-kill, .fx-cast, .fx-travel, .fx-warp, .fx-sell, .fx-craft, .fx-taken, .fx-buff {
    font-family: var(--ui);
    font-size: var(--font-xs);
    text-transform: uppercase;
    letter-spacing: clamp(1px, 0.05vw, 2px);
    padding: var(--spacing-xs) var(--spacing-xs);
    border: 1px solid color-mix(in srgb, var(--fx, var(--line)) 55%, transparent);
    border-radius: var(--radius-card);
    background: color-mix(in srgb, var(--fx, var(--panel)) 14%, transparent);
  }
  .fx-drop { padding: var(--spacing-xs); }
  .fx-proc { animation: fx-proc 1.3s ease-out forwards; }
  .fx-cast { animation: fx-cast 1.1s ease-out forwards; }
  .fx-travel, .fx-warp { animation: fx-drift 1.6s linear forwards; }
  .fx-kill { animation: fx-strike .7s ease-out forwards; }
  .fx-sell, .fx-craft { animation: fx-rise 1.5s ease-out forwards; }

  .cast .flare {
    position: absolute; inset: -2px; z-index: var(--z-content); pointer-events: none;
    border: 1px solid var(--fx, var(--text)); border-radius: var(--radius-round);
    animation: fx-flare .5s ease-out forwards;
  }

  .fx-buff {
    animation: fx-buff 1.15s ease-out forwards;
  }

  .fx-heal {
    font-size: var(--font-sm);
    animation: fx-heal 1.1s ease-out forwards;
  }
  .fx-buff, .fx-heal { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .fx-buff::before, .fx-heal::before {
    content: '';
    display: inline-block; width: var(--icon-detail); height: var(--icon-detail);
    background: var(--fx, var(--text));
    -webkit-mask-size: contain; mask-size: contain;
    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
    -webkit-mask-position: center; mask-position: center;
  }
  .fx-heal::before {
    -webkit-mask-image: url('./icon/skill/heart-beats.png');
            mask-image: url('./icon/skill/heart-beats.png');
  }
  .fx-buff::before {
    -webkit-mask-image: url('./icon/skill/expanded-rays.png');
            mask-image: url('./icon/skill/expanded-rays.png');
  }

  .levelup {
    position: absolute; top: calc(var(--screen-pad) + var(--rail-h) + var(--spacing-xs)); left: 50%; z-index: var(--z-toast); pointer-events: none;
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
    0% { opacity: 0; transform: scale(.6) translateY(var(--spacing-xs)); }
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
    0% { opacity: 0; transform: translateY(var(--spacing-xs)) skewX(-8deg); }
    25% { opacity: 1; }
    100% { opacity: 0; transform: translateY(clamp(-43px, -1.55vw, -20px)); }
  }
  @keyframes fx-drift {
    0% { opacity: 0; transform: translateX(var(--x-pull-burst)); }
    20% { opacity: 1; }
    100% { opacity: 0; transform: translateX(var(--spacing-lg)); }
  }
  @keyframes fx-strike {
    0% { opacity: 1; transform: scale(1.25); }
    100% { opacity: 0; transform: scale(.9); }
  }

  :global(.stage.combat-fx-sample .fx) { animation: none; opacity: 1; transform: none; }
  :global(.stage.combat-fx-sample .pop) { animation: none; opacity: 1; transform: none; }
  :global(.stage.combat-fx-sample .mob .plate-fx .pop) {
    top: calc(58% + (var(--lane, 0) * var(--icon-card)));
  }
  :global(.stage.combat-fx-sample .mob .plate-fx .pop-word) {
    top: calc(58% + (var(--icon-card) * 4));
  }
  :global(.stage.combat-fx-sample .player-card.combat .pops .pop) {
    top: calc(50% + (var(--lane, 0) * var(--icon-label)));
  }
  :global(.stage.combat-fx-sample .player-card.combat .pops .pop-word) {
    top: calc(50% - (var(--icon-card) * 2) + (var(--lane, 0) * var(--spacing-lg)));
  }
  :global(.stage.combat-fx-sample .flash) { animation: none; opacity: .75; }
  :global(.stage.combat-fx-sample .mob .arc),
  :global(.stage.combat-fx-sample .mob .burst) { animation: none; opacity: .75; transform: none; }
  :global(.stage.combat-fx-sample .mob .art.knock),
  :global(.stage.combat-fx-sample .mob .charge.lunge),
  :global(.stage.combat-fx-sample .player-card.combat .cardface.knock) { animation: none; }
  :global(.stage.combat-fx-sample .field-side) {
    right: calc(var(--controls-h) * 2 + var(--screen-pad));
    bottom: calc(var(--controls-h) * 2 + var(--screen-pad) + (var(--icon-card) * 2));
  }

  .veil {
    position: absolute; inset: 0; pointer-events: none;
    box-shadow: inset 0 0 clamp(63px, 4.84vw, 135px) color-mix(in srgb, var(--fx, var(--hp)) 50%, transparent);
    animation: fx-veil .4s ease-out forwards;
  }
  @keyframes fx-veil {
    0% { opacity: .9; }
    100% { opacity: 0; }
  }



  .townmode .field { opacity: .78; filter: saturate(.85); }
  .townmode .map-back { --dof: var(--dof-far); }



  .stage {
    display: grid;
    grid-template-columns: var(--screen-pad) repeat(15, minmax(0, 1fr)) var(--screen-pad);
    grid-template-rows: var(--screen-pad) repeat(15, minmax(0, 1fr)) var(--screen-pad);

  }
  .topright {
    grid-area: objectives;
    width: 100%;
    min-width: 0;
    min-height: 0;
    align-self: start;
    display: grid; gap: var(--spacing-sm);
  }
  .targetbar {
    grid-area: target;
    width: min(clamp(350px, 27.11vw, 756px), 100%);
    min-width: 0;
    justify-self: stretch;
    align-items: center;
    justify-content: center;
  }
  .rail {
    grid-area: menu;
    position: relative;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    justify-self: end;
    align-self: start;
  }
  .field {
    position: absolute;
    inset-block: 0;
    left: 50%;
    transform: translateX(-50%);
    min-width: 0;
    min-height: 0;
  }
  .field.clear { justify-content: center; }
  .commands-dock {
    grid-area: commands;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 0;
    justify-self: stretch;
    align-self: stretch;
  }
  .actionbar {
    grid-area: actionbar;
    min-width: 0;
    min-height: 0;
    align-self: stretch;
    align-items: center;
    flex-direction: column;
    justify-content: flex-end;
    gap: var(--spacing-xs);
  }
  .action-cluster { max-width: 100%; gap: var(--spacing-xs); }
  .field-feed {
    grid-area: feed;
    width: 100%;
    min-width: 0;
    min-height: 0;
    align-self: stretch;
  }
  .stage :is(.topright, .targetbar, .field-travel-actions, .field, .commands-dock, .field-feed, .actionbar) {
    padding: var(--pad-area);
  }
  .stage .rail { padding: 0 var(--spacing-xs); }
  .stage .commands-dock { padding-inline: var(--spacing-md); }

  .stage .field { padding-bottom: calc(var(--card-w) * 1.5 + var(--pad-area)); }
  .field-feed :global(.combatlog) { width: 100%; min-height: 0; }
  .tracker { width: 100%; }
  .hud-grid-debug {
    position: fixed;
    inset: 0;
    z-index: var(--z-notice);
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
    padding: var(--spacing-xs);
    border-right: 1px solid color-mix(in srgb, var(--focus) 55%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--focus) 55%, transparent);
    color: color-mix(in srgb, var(--focus) 78%, var(--text));
    font: var(--font-xs) / 1 var(--num);
    text-shadow: 0 1px 2px var(--bg);
  }
</style>
