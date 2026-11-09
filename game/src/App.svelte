<script lang="ts">
  import QuestBonusPicker from './ui/town/QuestBonusPicker.svelte';
  import { skillMechanicPreview } from './ui/dev/skill-mechanic-preview';
  import type { TaskSlot } from '@sim/core/types';
  import { taskBonuses, resolveQuestBonus } from '@sim/town/quest-rewards';
  import { questBonusText } from './ui/town/quest-rewards';
  import { onDestroy, onMount, setContext, untrack } from 'svelte';
  import { linear } from 'svelte/easing';
  import { prefersReducedMotion, Tween } from 'svelte/motion';
  import { eng, E, sm, TOWN, tree, loot, fieldwork, trade, BASES } from './engine/client';
  import { MOB_DRAFT_VARIANT_QA_PASS_METADATA_PATHS } from './ui/dev/arena-art/arena-art-mob-drafts-qa-pass';
  import mobSpritePool from './ui/combat/arena/mob-pool.generated.json';
  import { combatPreviewEvents, combatPreviewGroup, previewArea, previewFire, previewHeal, previewLightning,
    type CombatFxBeat, type CombatFxPreview } from './ui/dev/combat-fx-preview';
  import { bundleOf } from '@engine/keystones.ts';
import { fieldSite, campHere as atFieldCamp, establishCamp, startFieldAction, stopFieldAction, cookMeal, eatMeal } from '@sim/world/fieldwork';
import { cancelCampEncounter, chooseCampEncounter, setCampEncounterPolicy, type CampEncounterAction, type CampEncounterPolicy } from '@sim/world/camp-encounters';
  import { sellGoods, processMaterials, tradeBucket } from '@sim/town/trade';
import { offerDelivery, deliver, trackDelivery, acknowledgeDelivery, announceDelivery, tickDeliveries, contractById, deliveryTimeLeft, deliveryPauseReason, acceptCourier, declineCourier } from '@sim/town/delivery';
import { buyBlackMarket } from '@sim/town/black-market';
  import DeliveryNotice from './ui/town/DeliveryNotice.svelte';
  import { previewScrapAlchemy, transmuteScrap, alchemyTierProgress } from '@sim/gear/alchemy';
  import { newGame, setLevel, tick, push, fx, hitColour, COMBAT_STEP_US, schedulerSteps, characterSheet, huntZone, huntHere, salvageAtSmith, retreatDungeon, runFilterNow, isBossKind, spawnMob } from '@sim/core/game';
  import { restorePendingWork } from '@sim/core/pending-work';
  import { fieldAreaKey, fieldInFight, restoreFieldPositions } from '@sim/world/field-area';
  import type { ManualControl } from '@sim/combat/combat-actions';
  import { mobSkillById } from '@sim/combat/mobSkills';
  import { rollDrop } from '@sim/gear/drop';
  import { itemName } from '@sim/gear/item-name';
  import { reservedPct, setAuraPool, hpReserved, usableHp, usableMana, skillCd, toggleTrack, ACTIVE_SLOTS, modeOf, condOf, appliedStatusOf, appliedCurseOf, moveSlot, defaultManualSkill } from '@sim/combat/skills';
  import { describeSkill } from '@sim/combat/skill-copy';
  import { slotsUsed, slotsAvailable, slotsFree, bagStacks } from '@sim/gear/slots';
  import SlotGrid from './ui/inventory/SlotGrid.svelte';
  import StatAllocator from './ui/character/StatAllocator.svelte';
  import Panel from './ui/hud/Panel.svelte';
  import { PANEL_SESSION, type PanelSession } from './ui/hud/panel-session';
  import CombatPanel from './ui/panels/combat-panel.svelte';
  import BagPanel from './ui/panels/bag-panel.svelte';
  import type { EnemySnapshot } from '@sim/combat/combat-history';
  import { refreshSelectionAfterRepair, resolveItemSelection, type ItemSelection } from './ui/inventory/item-selection';
  import { captureCharacterUiSnapshot, emptyCharacterUiSnapshot, restoreCharacterUiSnapshot, type CharacterUiSnapshot } from './ui/character/character-ui-session';
  import CountBadge from './ui/shared/CountBadge.svelte';
  import Quickbar from './ui/hud/Quickbar.svelte';
  import ActiveBuffs from './ui/hud/ActiveBuffs.svelte';
  import PlayerStatusRow from './ui/combat/PlayerStatusRow.svelte';
  import HudLayoutEditor from './ui/hud/HudLayoutEditor.svelte';
  import { copyHudLayout, DEFAULT_MODAL_AREA, gridAreaCss, hudGridTemplate, HUD_LAYOUT_STORAGE_KEY, HUD_LAYOUT_PREVIOUS_STORAGE_KEYS, HUD_LAYOUT_VERSION, migrateHudLayout, regionStyleCss, salvageHudLayout, validGridArea, validateHudLayout, type GridArea, type HudLayout, type HudRegionId } from './ui/hud/hud-layout';
  import TravelCard from './ui/map/TravelCard.svelte';
  import MapJourney from './ui/map/MapJourney.svelte';
  import { activeVfxVersionId, setActiveVfxVersion, vfxVersionsFor } from './ui/fx/catalog';
  import { destinationIntel } from './ui/map/map-intel';
  import { investigateTrailSite, recordMapDiscovery } from '@sim/world/map-exploration';
  import { destinationPrimary, destinationWarp } from './ui/map/destination';
  import TownPanel from './ui/panels/town-panel.svelte';
  import MarketPanel from './ui/panels/market-panel.svelte';
  import CraftPanel from './ui/panels/craft-panel.svelte';
  import { newCraftWorkbenchView } from './ui/inventory/craft-workbench';
  import GearCare from './ui/inventory/GearCare.svelte';
  import ProgressRecap from './ui/hud/ProgressRecap.svelte';
  import JourneyNotices from './ui/hud/JourneyNotices.svelte';
  import SkillDiscovery from './ui/character/SkillDiscovery.svelte';
  import SkillsPanel from './ui/panels/skills-panel.svelte';
  import { newSkillsWorkbenchView } from './ui/character/SkillsWorkbench.svelte';
  import { skillEligibilityInState } from '@sim/combat/skills';
  import { importantCombatEvent } from './ui/combat/combat-presentation';
  import type { ArenaTargetRead } from './ui/combat/combat-arena-view';
  import { moveAimPoint } from './ui/combat/arena-picking';
  import { ARENA_DEFAULT_WORLD_SCALE, ARENA_VIEW, ARENA_ZOOM_MIN, ARENA_ZOOM_MAX, ARENA_ZOOM_STEP, arenaWorldDirection } from './presentation/arena-camera';
  import { createFieldViewFrame, type FieldViewFrame } from './presentation/arena-view-frame';
  import { fieldPointM } from './presentation/view-transform';
  import { newPassiveTreeSession } from './ui/passive-tree/passive-tree-view';
  import ForgePanel from './ui/panels/forge-panel.svelte';
  import CampPanel from './ui/panels/camp-panel.svelte';
  import FarmPanel from './ui/panels/farm-panel.svelte';
  import DeskPanel from './ui/panels/desk-panel.svelte';
  import TreePanel from './ui/panels/tree-panel.svelte';
  import StashBoard from './ui/inventory/StashBoard.svelte';
  import CollapseToggle from './ui/shared/CollapseToggle.svelte';
  import Tabs from './ui/shared/Tabs.svelte';
  import { SHORTCUT_TOKENS, actionFor, tokenOf, isModifierKey, isTypingTarget, formatKey, wasdVector } from './ui/hud/shortcuts';
  import { gearEntry, stackEntry, sortEntries, type SlotEntry, type SortKey } from './ui/inventory/bag';
  import type { MenuItem } from './ui/shared/menu';
  import { ramp } from './ui/map/map-view-model';
  import type { Picked } from './ui/map/map-types';
  import WorldMap from './ui/map/WorldMap.svelte';
  import type { MapIntent } from './ui/map/WorldMap.svelte';
  import type { MapViewOptions, MapStaticCell } from './ui/map/map-types';
  import { DEFAULT_MAP_CAMERA, MAP_BASE_ZOOM, type MapCameraState } from './ui/map/map-camera';
  import { mapTravelPhase } from './ui/map/map-travel';
  import { adventureView, uniqueTraceSpecies, type AdventureCell } from './ui/map/map-adventure';
  import { setCastDrag, readCastDrag } from './ui/shared/drag';
  import { fieldLabel } from './ui/hud/hud';
  import { snapCounters, buildAwayReport, type AwayReport } from './app/progress-report';
  import { bar } from './ui/shared/field';
  import { fxOut } from './ui/shared/motion';
  import FieldPlates from './ui/combat/FieldPlates.svelte';
  import CombatArenaScene from './ui/combat/CombatArenaScene.svelte';
  import { arenaGroundMaterials } from './ui/combat/arena/arena-ground-materials';
  import { createCombatArena, syncCombatArena, arenaSkillTargets, type CombatArena } from '@sim/combat/combat-arena';
  import { snapshotEnemy } from '@sim/combat/combat-history';
  import LogBox from './ui/hud/LogBox.svelte';
  import ObjectiveFeed from './ui/hud/ObjectiveFeed.svelte';
  import { feedEventsAfter } from './ui/hud/logbox';
  import {
    settlementById, settlementOfZone, stockOf, priceGold, priceMinutes, canBuy, buy, sellJunk,
    canTravel, claimTask, npcOf, repairGear, skipTask, skipVerdict, smithService,
    quoteTownPurchase, firstBroken,
  } from '@sim/town/town';
  import { doCraft, stoneName, atSettlement, replaceChoices, type CraftOp, type Where } from '@sim/gear/craft';
  import { forgeGear } from '@sim/gear/forge';
  import type { ForgeKind } from '@engine/forge.ts';
import { farm, farmLevel, farmMasteryLevel, plotCount, plant, harvest, craftPotion, condense, drink, cycleQuickbar } from '@sim/world/farm';
  import { stashTabCount, STASH_TAB_CAP, deposit, withdraw, depositMany, withdrawMany } from '@sim/town/town';
import { allocateTreePath, canSpendTree, respecTree, spendTreePoint, treePointsFree } from '@sim/core/tree';
  import { allocateStats, respecStats } from '@sim/core/respec';
  import { CharacterSaveSession } from './state/saveSession';
  import { SHOWCASE_SAMPLE_LABELS, SHOWCASE_SAMPLES, showcaseFieldSkill } from './app/showcase-samples';
  import { createSessionActions, type AccountWriterLease } from './app/session';
  import { createGameLoop } from './app/loop';
  import { previewTick } from './app/scheduler';
  import { createGearCommands } from './app/commands/gear';
  import { createEconomyCommands } from './app/commands/economy';
  import { createFieldCommands } from './app/commands/field';
  import { buildShowcaseGame } from './app/commands/showcase-game';
  import { createTravelCommands } from './app/commands/map';
  import { road, startWalk, walkNote, walkBlocks, warpTo, warpCost, cellBlocks, cellSec, currentCell, settlementCell, ownerOf } from '@sim/world/road';
  import { enterDungeon, cooldownLeft } from '@sim/world/dungeon';
  import { mastery } from '@sim/core/mastery';
  import { storePreset, switchPreset, bindZone } from '@sim/core/presets';
  import { col, setUnlocked, heldCount, turnIn } from '@sim/town/collector';
  import { mulberry32 } from './engine/client-helpers';
  import { saveSlots, readSettings, writeSettings, DEFAULT_SETTINGS, TEMP_DISABLE_SLOT_SAVES, type SlotName, type Snapshot, type ClientSettings } from './state/save';
  import { requestAccountWriterLock, type AccountWriterLockResult } from './state/accountWriterLock';
  import { FILTER_SLOTS, ruleFor, setRule, describeRule, presetSlots, savePreset, loadPreset, clearPreset } from '@sim/gear/filter';
  import { equipFromBag, autoEquip, unequip } from '@sim/gear/gear';
  import { SAVE_CFG } from '@sim/core/snapshot';
  import { lifeSkillMilestones } from '@sim/core/goal';
  import { nextGoal, setTrackedGoal, zoneDestination, guidanceNotices, ACTIVITY_GUIDE, type GoalRef, type GoalView, type GuidanceNotice, type ShortageOrigin } from '@sim/core/guidance';
  import { characterIcon, hubIcon, icon, mobSpeciesArt, skillIcon } from './icon';
  import chevronDownGlyph from './icon/ui/chevron-down.png';
  import pauseGlyph from './icon/ui/pause.png';
  import playGlyph from './icon/ui/play.png';
  import gridGlyph from './icon/ui/grid.png';
  // The HUD's own marks, read off the same icon shelf the slots draw from by file name — no second asset set,
  // and no import to rewrite when a figure is redrawn, renamed or moved between category folders.
  const sheetMark = icon('knight-helmet');
  const bagMark = icon('adventure-bags');
  const fieldMark = icon('crossed-swords-1');
  const skillMark = icon('spell-book');
  const treeMark = icon('oak');
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
  const layoutMark = icon('skill-settings');
  const waypointMark = icon('waypoint-pillar');
  const moreMark = icon('more-options');
  const fxMark = icon('sparkles');
  const autoEquipMark = icon('heavy-helm');
  const autoAvoidMark = icon('boot-prints');
  const newCharacterMark = icon('perspective-dice-six-faces-random');
  // the field sheet, generated by tools/map.ts and inlined so the travel pin, the plotted route and
  // the picked cell are all toggled by id — the client reads no coordinate, only settlement ids and
  // cell keys it already holds (X33 · M7 · M10)
  import mapOverlayRaw from './icon/map/map-overlay.svg?raw';
  import type { GameState, Item, Cell, Mob, FxEvent } from '@sim/core/types';
  import type { StatKey } from './engine/client';
  import type { SkillConditions } from '@sim/combat/skills';

  const STATS: StatKey[] = ['str', 'int', 'vit', 'agi', 'dex', 'wis', 'lck'];
  const MAP_ICON_LEGEND = [
    { name: 'player', href: characterIcon(), label: 'Your position' },
    { name: 'mob', href: mobSpeciesArt('wolf'), label: 'Known creatures' },
    { name: 'combat', href: icon('crossed-swords-1'), label: 'Combat' },
    { name: 'camp', href: icon('rest-campfire'), label: 'Camp' },
    { name: 'resource', href: icon('pickaxe'), label: 'Resource site' },
  ] as const;
  const showcaseMode = import.meta.env.DEV && window.location.pathname.replace(/\/+$/, '') === '/__showcase';
  const showcaseQuery = new URLSearchParams(window.location.search);
  const requestedShowcaseSample = showcaseQuery.get('sample');
  const showcasePlayerWeapon = showcaseQuery.get('player-weapon');
  const showcasePlayerOffhand = showcaseQuery.get('player-offhand');
  const initialShowcaseSample = showcaseMode
    ? (requestedShowcaseSample && (SHOWCASE_SAMPLES as readonly string[]).includes(requestedShowcaseSample) ? requestedShowcaseSample : 'combat-field')
    : 'delivery';
  const ARENA_MOB_SPECIES = Object.keys(mobSpritePool.species);
  const ARENA_EXISTING_PREVIEW_SPECIES = ['spear-goblin', 'little-demon', 'skeleton-sword', 'stone-golem',
    'skeleton-bone', 'crypt-wraith', 'shadow-wolf', 'eclipse-wisp', 'pixiblop-spider'] as const;
  const ARENA_VARIANT_QA_PASS_PATHS = new Set<string>(MOB_DRAFT_VARIANT_QA_PASS_METADATA_PATHS);
  const ARENA_VARIANT_GROUPS = [...new Set((E.mob.variants as any[]).map((row) => row.species))].map((speciesId) => {
    const seen = new Set<string>();
    const variants = (E.mob.variants as any[])
      .filter((row) => row.species === speciesId)
      .map(({ name }) => ({ name, variantId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }))
      .filter(({ variantId }) => {
        if (seen.has(variantId)) return false;
        seen.add(variantId);
        return ARENA_VARIANT_QA_PASS_PATHS.has(
          `archive/art-reference/monsters/${eng.speciesById(speciesId).race}/${speciesId}/${variantId}/meta.json`,
        );
      });
    return { speciesId, speciesName: eng.speciesById(speciesId).name, variants };
  }).filter(group => group.variants.length > 0);
  const ARENA_VARIANT_SPECIES_ALREADY_LISTED = new Set<string>([...ARENA_MOB_SPECIES, ...ARENA_EXISTING_PREVIEW_SPECIES]);
  const ARENA_ADDITIONAL_VARIANT_SPECIES = ARENA_VARIANT_GROUPS
    .filter(group => !ARENA_VARIANT_SPECIES_ALREADY_LISTED.has(group.speciesId));
  const ARENA_VARIANT_PREVIEWS = ARENA_VARIANT_GROUPS.flatMap(({ speciesId, speciesName, variants }) => variants.map(variant => ({
    ...variant,
    speciesId,
    speciesName,
    key: `${speciesId}/${variant.variantId}`,
  })));
  const ARENA_VARIANT_PREVIEW_BY_KEY = new Map(ARENA_VARIANT_PREVIEWS.map(variant => [variant.key, variant]));
  const ARENA_SPRITE_SPECIES = [...ARENA_MOB_SPECIES, ...ARENA_ADDITIONAL_VARIANT_SPECIES.map(group => group.speciesId), ...ARENA_EXISTING_PREVIEW_SPECIES] as const;
  /** A reference sheet is reviewed against the canonical body it stands in for. */
  const ARENA_PREVIEW_SPAWN: Record<string, string> = {
    'spear-goblin': 'goblin', 'skeleton-sword': 'skeleton', 'skeleton-bone': 'skeleton', 'crypt-wraith': 'wraith', 'shadow-wolf': 'wolf',
    'eclipse-wisp': 'wisp', 'pixiblop-spider': 'spider', 'stone-golem': 'golem', 'little-demon': 'imp',
  };
  const requestedArenaSpecies = ARENA_SPRITE_SPECIES.find(id => id === showcaseQuery.get('sprite-species'));
  const requestedArenaVariant = ARENA_VARIANT_PREVIEWS.find(variant => variant.key === showcaseQuery.get('sprite-variant'));
  let spritePreviewMode = $state(showcaseMode && showcaseQuery.get('sprite-preview') !== 'fallback');
  let arenaSpecies = $state<string>(requestedArenaVariant?.speciesId ?? requestedArenaSpecies ?? 'skeleton');
  let arenaVariantKey = $state<string | null>(requestedArenaVariant?.key ?? null);
  const activeArenaVariant = $derived(ARENA_VARIANT_PREVIEW_BY_KEY.get(arenaVariantKey ?? '') ?? null);
  function setArenaSpriteMode(value: string) {
    spritePreviewMode = value === 'sprite';
    const url = new URL(window.location.href);
    url.searchParams.set('sprite-preview', spritePreviewMode ? 'pawn' : 'fallback');
    window.history.replaceState(null, '', url);
  }
  const requestedArenaSkill = showcaseQuery.get('skill');
  const mechanicPreview = showcaseMode ? skillMechanicPreview(showcaseQuery.get('mechanic')) : undefined;
  if (mechanicPreview) sm.byId[mechanicPreview.id] = mechanicPreview;
  onDestroy(() => { if (mechanicPreview) delete sm.byId[mechanicPreview.id]; });
  let arenaSkillId = $state(mechanicPreview?.id ?? (requestedArenaSkill && sm.byId[requestedArenaSkill] ? requestedArenaSkill : showcaseFieldSkill(initialShowcaseSample) ?? 'attack.fireball'));
  /** Deliberate local commands for the automatic farming loop. */
  let arenaManual = $state<ManualControl>({});
  /** The focused body shown by the arena and pinned by the sim. */
  let arenaFocusId = $state<string | null>(null);
  /** One uncommitted manual skill aim; a ground click confirms it. */
  let arenaAimSkill = $state<string | null>(null);
  /** The keyboard aim reticle. A pointer move writes the same point, so both paths aim once. */
  let arenaAimPoint = $state<{ x: number; y: number } | null>(null);
  function arenaLiving() { return gameState.group.filter((mob) => mob.hp > 0); }
  function focusArenaEnemy(mobId?: string) {
    if (!arenaMode || panel !== null) return;
    const living = arenaLiving();
    const next = mobId
      ? living.find((mob) => mob.id === mobId)
      : living[(living.findIndex((mob) => mob.id === arenaFocusId) + 1) % Math.max(1, living.length)];
    arenaFocusId = next?.id ?? null;
    combatArena.focusId = arenaFocusId ?? undefined;
    arenaAimSkill = null;
    arenaAimPoint = null;
    arenaManual.cast = undefined;
  }
  function clearArenaFocus() {
    arenaFocusId = null;
    combatArena.focusId = undefined;
    arenaAimSkill = null;
    arenaAimPoint = null;
    arenaManual.cast = undefined;
  }
  function toggleArenaAim() {
    if (!arenaMode || panel !== null) return;
    const skillId = activeArenaSkillId();
    arenaAimSkill = arenaAimSkill ? null : skillId ?? null;
    const focus = arenaFocusId ? combatArena.mobs[arenaFocusId] : undefined;
    arenaAimPoint = arenaAimSkill ? { x: focus?.x ?? combatArena.player.x, y: focus?.y ?? combatArena.player.y } : null;
    arenaManual.cast = undefined;
    arenaManual.moveTo = undefined;
  }
  /** Arrow keys move one aim reticle; Enter commits it. The same world point is what a click uses. */
  function stepArenaAim(direction: 'north' | 'south' | 'west' | 'east') {
    if (!arenaMode || panel !== null || !arenaAimSkill) return;
    const focus = arenaFocusId ? combatArena.mobs[arenaFocusId] : undefined;
    const base = arenaAimPoint ?? { x: focus?.x ?? combatArena.player.x, y: focus?.y ?? combatArena.player.y };
    arenaAimPoint = moveAimPoint(base, direction, 0.5, combatArena.bounds);
  }
  function confirmArenaAim(holdToken?: string) {
    if (!arenaMode || panel !== null || !arenaAimSkill || !arenaAimPoint) return;
    issueArenaGroundCommand(arenaAimPoint, holdToken);
  }
  /** The one manual cast contract (F34): an explicit pick wins; otherwise the first slotted
   *  attack/curse; the action bar, the shortcut, the aim preview and the command read this. */
  function activeArenaSkillId(): string | undefined {
    if (gameState.skills.list.includes(arenaSkillId)) return arenaSkillId;
    return defaultManualSkill(gameState.skills);
  }
  function castArenaAtFocus(holdToken?: string) {
    if (!arenaMode || panel !== null) return;
    const skillId = activeArenaSkillId();
    if (!skillId || !sm.byId[skillId]) return;
    startManualSkill(skillId, holdToken);
    arenaManual.moveTo = undefined;
    wasdWalking = false;
    arenaAimSkill = null;
    arenaAimPoint = null;
  }
  /** A digit names its bar slot, not the selected skill: the same manual cast, addressed directly.
   *  Slots the roster does not own stay silent, exactly like an empty bar plate. */
  function castArenaSlot(index: number, holdToken?: string) {
    if (!arenaMode || panel !== null || !Number.isInteger(index) || index < 0) return;
    const skillId = gameState.skills.list[index];
    if (!skillId || !sm.byId[skillId]) return;
    startManualSkill(skillId, holdToken);
    arenaManual.moveTo = undefined;
    wasdWalking = false;
    arenaAimSkill = null;
    arenaAimPoint = null;
  }
  /**
   * Held WASD streams walk orders through key repeat: each press re-aims from the live feet,
   * so the sim still owns the speed and the arrival. Releasing every held key stops a WASD walk
   * only — a click-to-move order placed afterwards is left alone by the release that ends it.
   */
  const wasdHeld = new Set<string>();
  let wasdWalking = false;
  function steerWasd() {
    if (!arenaMode || panel !== null) return;
    const screen = wasdVector(wasdHeld);
    if (!screen) return;
    const dir = arenaWorldDirection(screen);
    const step = 2.0;
    arenaManual.moveTo = { x: combatArena.player.x + dir.x * step, y: combatArena.player.y + dir.y * step };
    wasdWalking = true;
  }
  function wasdDown(action: string) {
    wasdHeld.add(action);
    steerWasd();
  }
  function wasdUp(action: string) {
    if (!wasdHeld.delete(action)) return;
    if (wasdHeld.size === 0) {
      if (wasdWalking) {
        arenaManual.moveTo = undefined;
        wasdWalking = false;
      }
      return;
    }
    steerWasd();
  }
  /** Key release ends a held walk even when the hand has moved into a field or a panel
   *  opened mid-stride: the feet stop, but a click order placed after stays owned by the click. */
  function onfieldKeyUp(ev: KeyboardEvent) {
    if (arenaManual.holdToken === `key:${ev.code}`) arenaManual.holdToken = undefined;
    if (offlineProgress !== null || isModifierKey(ev)) return;
    const token = tokenOf(ev);
    let released = false;
    for (const [id, bound] of Object.entries(SHORTCUT_TOKENS)) {
      if (id.startsWith('arena.move.') && bound === token) {
        wasdUp(id);
        released = true;
      }
    }
    if (released) ev.preventDefault();
  }
  /** Losing the window drops every held key: no stuck walk when focus returns. */
  function clearWasd() {
    arenaManual.holdToken = undefined;
    wasdHeld.clear();
    if (wasdWalking) {
      arenaManual.moveTo = undefined;
      wasdWalking = false;
    }
  }
  function startManualSkill(skillId: string, holdToken?: string, point?: { x: number; y: number }) {
    const ray = sm.byId[skillId]?.action?.kind === 'ray-channel';
    if (ray && !holdToken) return;
    arenaManual.holdToken = ray ? holdToken : undefined;
    arenaManual.cast = { skillId, point, ...(ray ? { holdToken } : {}) };
  }
  function releaseArenaPointer(event: PointerEvent) {
    if (arenaManual.holdToken === `pointer:${event.pointerId}`) arenaManual.holdToken = undefined;
  }
  $effect(() => {
    if (panel !== null || !arenaMode) arenaManual.holdToken = undefined;
  });
  function issueArenaGroundCommand(point: { x: number; y: number }, holdToken?: string) {
    if (!arenaMode || panel !== null) return;
    if (arenaAimSkill) {
      startManualSkill(arenaAimSkill, holdToken, point);
      arenaAimSkill = null;
      arenaAimPoint = null;
      arenaManual.moveTo = undefined;
      wasdWalking = false;
    } else {
      arenaManual.moveTo = point;
      // a click owns the feet from here: a later WASD release must not cancel it.
      wasdWalking = false;
    }
  }
  /** A dead focus releases the pin so sticky-nearest selection resumes. */
  function syncArenaFocus() {
    if (!arenaFocusId) return;
    if (arenaLiving().some((mob) => mob.id === arenaFocusId)) return;
    arenaFocusId = null;
    combatArena.focusId = undefined;
  }
  let showcaseSample = $state(initialShowcaseSample);
  /** One setup path for every Gameplay sample — the dropdown and deep links (?sample=) share it,
   *  so a linked sample opens in the same state as a picked one. */
  function applyShowcaseSample(value: string) {
    loadController?.abort();
    loadController = null;
    offlineProgress = null;
    clearCombatFxTimers();
    animateCombatFx = false;
    const fieldSkill = showcaseFieldSkill(value);
    if (fieldSkill) {
      arenaSkillId = fieldSkill;
      arenaWorldScale = value === 'rimworld-field' ? ARENA_ZOOM_MIN : ARENA_DEFAULT_WORLD_SCALE;
    }
    showcaseSample = value; gameState = showcaseGame(showcaseSample);
    resetArena();
    awayReport = null; skillDiscoveryId = null; skillRewardSeen = '';
    feed = []; feedSeen = 0;
    travelScene = false;
    running = false;
    if (fieldSkill) running = true;
    gameState.playerStatuses = showcaseSample === 'combat-fx' ? {
      burn: { stacks: 1, secLeft: 8, perSec: 12 },
      chill: { stacks: 1, secLeft: 10, perSec: 0 },
      bleed: { stacks: 1, secLeft: 6, perSec: 8 },
    } : {};
    resetCharacterUi(); picked = null; pickedCell = null;
    panel = showcaseSample === 'craft-stash' ? 'craft' : null;
    // Storyteller fixtures open their real hosts (plan §14.3); no new routes.
    if (showcaseSample.startsWith('story-')) {
      journeyToolsOpen = true;
      switch (showcaseSample) {
        case 'story-camp-warning': case 'story-cache-choices': case 'story-cache-working':
        case 'story-cache-bagfull': case 'story-cache-results':
        case 'story-road-result': case 'story-site-result': case 'story-dungeon-result':
        case 'story-read-only':
          panel = 'map';
          break;
        case 'story-delivery-choices': case 'story-courier-unaccepted':
          marketView = 'deliveries'; marketTownId = gameState.town.waypoint; panel = 'market';
          break;
        case 'story-courier-destination': {
          const courier = Object.values(gameState.town.contracts).flat().find((entry) => entry.kind === 'courier');
          marketView = 'deliveries'; marketTownId = courier?.destinationTown ?? gameState.town.waypoint; panel = 'market';
          break;
        }
        case 'story-market-promotion':
          marketView = 'trade'; marketTownId = gameState.town.waypoint; panel = 'market';
          break;
        case 'story-forge-ready': case 'story-forge-shortage':
          panel = 'forge';
          break;
      }
    }
    if (showcaseSample === 'offline-progress') {
      loadController = new AbortController();
      offlineProgress = { done: 43200, total: 86400 };
    }
    if (showcaseSample === 'progress-recap') {
      const before = snapCounters(gameState);
      gameState.counters.kills += 84; gameState.counters.drops += 12;
      gameState.counters.gold += 46; gameState.counters.stones.tier = (gameState.counters.stones.tier || 0) + 7;
      gameState.player.treePoints += 3;
      const learned = sm.all().find(skill => !Object.hasOwn(gameState.skills.owned, skill.id));
      if (learned) gameState.skills.owned[learned.id] = 1;
      awayReport = buildAwayReport(before, 90, 5400, false, gameState);
    }
  }
  let animateCombatFx = $state(false);
  let combatFxPreview = $state<CombatFxPreview>('fire');
  let combatFxSkillId = $state('attack.firestorm');
  const combatFxTimers = new Set<ReturnType<typeof setTimeout>>();
  const combatFxSkills = sm.all()
    .filter((skill: any) => !skill.retired)
    .sort((a: any, b: any) => (a.type || '').localeCompare(b.type || '') || a.name.localeCompare(b.name));

  function clearCombatFxTimers() {
    for (const timer of combatFxTimers) clearTimeout(timer);
    combatFxTimers.clear();
  }
  onDestroy(clearCombatFxTimers);
  $effect(() => {
    if (!showcaseMode || showcaseSample !== 'combat-fx' || !animateCombatFx) clearCombatFxTimers();
  });

  function scheduleCombatFx(action: () => void, delay: number) {
    const timer = setTimeout(() => { combatFxTimers.delete(timer); action(); }, delay);
    combatFxTimers.add(timer);
  }

  function replayCombatFx() {
    if (!showcaseMode || showcaseSample !== 'combat-fx') return;
    clearCombatFxTimers();
    panel = null;
    travelScene = false;
    animateCombatFx = true;
    const preview = combatFxPreview;
    const sample = showcaseGame('combat-fx');
    gameState.group = combatPreviewGroup(sample, preview);
    gameState.mobStatus = {};
    gameState.fx = [];
    const emit = (beat: CombatFxBeat) => {
      const mob = gameState.group[0];
      for (const event of combatPreviewEvents(beat, gameState.group, combatFxSkillId)) fx(gameState, event);
      if (mob && beat === 'lethal') {
        fx(gameState, { kind: 'kill', side: 'field', mobId: mob.id, text: `${fieldLabel(mob)} defeated`, colour: hitColour('fire') });
        gameState.group = [];
      }
    };
    const strike = (mob: Mob, delay: number) => {
      const skill = (mob.skillIds || []).map(mobSkillById).find((row) => row?.mode === 'strike');
      const castMs = Math.max(0, skill?.cast_sec || 0) * 1000;
      if (skill) scheduleCombatFx(() => {
        mob.atkTimer = .85;
        fx(gameState, { kind: 'cast', side: 'field', mobId: mob.id, skillId: skill.id, text: skill.name, colour: hitColour(skill.element) });
      }, delay);
      scheduleCombatFx(() => {
        mob.atkTimer = 0;
        fx(gameState, { kind: 'taken', side: 'self', byId: mob.id, skillId: skill?.id, text: '142', value: 142, colour: hitColour(skill?.element || mob.innate[0]) });
      }, delay + castMs);
      return delay + castMs;
    };
    // Give restored bodies one paint before effects capture their anchors, including after a kill.
    let lastBeat = 60;
    if (preview === 'boss') {
      if (gameState.group[0]) lastBeat = strike(gameState.group[0], 60);
    } else if (preview === 'sizes') {
      gameState.group.forEach((mob, index) => { lastBeat = Math.max(lastBeat, strike(mob, 60 + index * 650)); });
    } else {
      const sequence: CombatFxBeat[] = preview === 'rapid'
        ? ['swing', 'fire', 'lightning', 'critical', 'heal', 'block'] : [preview];
      sequence.forEach((beat, index) => {
        lastBeat = 60 + index * 140;
        scheduleCombatFx(() => emit(beat), lastBeat);
      });
    }
    scheduleCombatFx(() => { gameState.fx = []; }, lastBeat + 1800);
  }

  function showCombatFxLabels() {
    clearCombatFxTimers();
    panel = null;
    travelScene = false;
    animateCombatFx = false;
    const sample = showcaseGame('combat-fx');
    const originalTarget = sample.group[0]?.id;
    const group = combatPreviewGroup(sample, combatFxPreview);
    gameState.group = group;
    gameState.mobStatus = group === sample.group ? sample.mobStatus : {};
    gameState.fx = [];
    for (const { id, sec, ...event } of [...sample.fx].reverse()) fx(gameState, {
      ...event,
      mobId: event.mobId === originalTarget ? gameState.group[0]?.id : event.mobId,
      byId: event.byId === originalTarget ? gameState.group[0]?.id : event.byId,
    });
    if (combatFxPreview === 'boss' || combatFxPreview === 'sizes') {
      for (const mob of group) {
        const skill = (mob.skillIds || []).map(mobSkillById).find(row => row?.mode === 'strike');
        if (skill) fx(gameState, { kind: 'cast', side: 'field', mobId: mob.id, skillId: skill.id, text: skill.name, colour: hitColour(skill.element) });
      }
    }
    if (combatFxPreview === 'skill') {
      const skill = sm.byId[combatFxSkillId];
      const mob = group[0];
      if (skill) {
        const colour = hitColour(skill.element || null);
        if (skill.type === 'buff') fx(gameState, { kind: 'buff', side: 'self', skillId: skill.id, text: skill.name || skill.id, colour });
        else if (skill.type === 'heal') fx(gameState, { kind: 'heal', side: 'self', skillId: skill.id, text: '+86', value: 86, colour });
        else if (mob) fx(gameState, { kind: 'hit', side: 'field', mobId: mob.id, via: 'cast', skillId: skill.id, text: '468', value: 468, colour });
        fx(gameState, { kind: 'cast', side: 'self', skillId: skill.id, text: skill.name || skill.id, colour });
      }
    }
  }

  function showcaseGame(scenario: string = 'delivery'): GameState {
    return buildShowcaseGame({
      activeArenaVariant: activeArenaVariant as unknown as { speciesId: string } | null,
      ArenaPreviewSpawn: ARENA_PREVIEW_SPAWN,
      arenaSpecies,
      spritePreviewMode,
      arenaSkillId,
      showcasePlayerWeapon,
      showcasePlayerOffhand,
      fieldLabel: (m) => fieldLabel(m),
      previewFire,
      previewHeal,
      previewLightning,
    }, scenario);
  }

  const PANELS = ['bag', 'skills', 'tree', 'map', 'desk', 'stash', 'farm', 'camp', 'save', 'town', 'market', 'forge', 'craft', 'combat'] as const;
  type PanelId = (typeof PANELS)[number];
  const RAIL: PanelId[] = ['map', 'town', 'market', 'craft', 'bag', 'skills', 'tree', 'desk', 'farm', 'camp', 'combat', 'save'];
  const MAIN_RAIL: PanelId[] = ['map', 'bag', 'skills', 'craft'];
  const MORE_RAIL = RAIL.filter((p) => !MAIN_RAIL.includes(p) && p !== 'camp');
  const HUD_GRID_LABELS = Array.from({ length: 225 }, (_, i) => `${String.fromCharCode(65 + Math.floor(i / 15))}${(i % 15) + 1}`);
  const TOWN_PANELS: PanelId[] = ['town', 'market', 'forge', 'craft', 'stash', 'desk'];
  const RAIL_ICON: Record<PanelId, string> = {
    bag: hubIcon('bags', bagMark), skills: hubIcon('skill-book', skillMark),
    tree: treeMark, map: mapMark, desk: deskMark,
    stash: stashMark, farm: farmMark, camp: campMark, save: saveMark, town: townMark,
    market: coinMark, forge: forgeMark, craft: hubIcon('crafting', craftMark), combat: fieldMark,
  };
  const RAIL_LABEL: Record<PanelId, string> = {
    bag: 'bags', skills: 'skills', tree: 'tree', map: 'map', desk: 'desk',
    stash: 'stash', farm: 'farm', save: 'save', town: 'town',
    market: 'market', forge: 'forge', craft: 'craft', camp: 'camp', combat: 'combat history',
  };
  const SCREEN_ACTION: Record<PanelId, string> = {
    bag: 'screen.bag', skills: 'screen.skills', tree: 'screen.tree', map: 'screen.map',
    desk: 'screen.desk', stash: 'screen.stash', farm: 'screen.farm', camp: 'screen.camp', save: 'screen.save',
    town: 'screen.town', market: 'screen.market', forge: 'screen.forge', craft: 'screen.craft',
    combat: 'screen.combat',
  };
  // `gameState`, not `state`: a top-level `state` binding makes svelte2tsx read `$state` as a store
  // subscription and type the whole panel `any` (sveltejs/svelte#13715).
  let gameState = $state<GameState>(showcaseMode ? showcaseGame(initialShowcaseSample) : newGame(undefined, crypto.getRandomValues(new Uint32Array(1))[0]));
  let running = $state(!showcaseMode || !!showcaseFieldSkill(initialShowcaseSample));
  /** True until this boot has loaded a slot or started a new character. The loop may be asked to run,
   *  but startup owns the clock: no placeholder character may tick or autosave before the choice. */
  let startupPending = $state(!showcaseMode);
  /** Held while a load or a snapshot rewind swaps the character: a live tick landing on the new state
   *  mid-catch-up would sim the away window twice. The interval drains its accumulator and stands down. */
  let paused = $state(!showcaseMode);
  let cooldownVisualNow = $state(0);
  let cooldownSimRemainder = $state(0);
  let cooldownSchedulerAt = $state(0);
  let speed = $state(1);
  /** The one runtime scale for the field's actors, footprints, distances and effects. */
  let arenaWorldScale = $state(showcaseMode && initialShowcaseSample === 'rimworld-field' ? ARENA_ZOOM_MIN : ARENA_DEFAULT_WORLD_SCALE);
  /** Stage size echo from the arena host; the field frame maps world metres into these CSS pixels. */
  let arenaStageCss = $state({ width: ARENA_VIEW.width, height: ARENA_VIEW.height });
  const arenaPreview = $derived(showcaseMode && !!showcaseFieldSkill(showcaseSample));
  /** Selected pool version used by the live cast. */
  const arenaVersions = $derived(vfxVersionsFor(arenaSkillId).filter((version) => version.arena !== false));
  let arenaVersionId = $state('');
  let arenaVfxMode = $state<'auto' | 'base'>('auto');
  $effect(() => {
    arenaVersionId = activeVfxVersionId(arenaSkillId) ?? '';
  });
  // ?vfx=base override inside showcase only
  $effect(() => {
    if (!arenaPreview) return;
    const q = new URLSearchParams(window.location.search).get('vfx');
    if (q === 'base') arenaVfxMode = 'base';
    else if (q != null) arenaVfxMode = 'auto';
  });
  function chooseArenaVersion(value: string) {
    // Base keeps saved preferred version; version strips prefix, sets auto, no replay (VFX-4)
    if (value === 'base') {
      arenaVfxMode = 'base';
      arenaVersionId = value;
      return;
    }
    const raw = value.startsWith('version:') ? value.slice('version:'.length) : value;
    arenaVfxMode = 'auto';
    arenaVersionId = raw;
    setActiveVfxVersion(arenaSkillId, raw);
  }
  /** Showcase only: a one-second cooldown keeps the demo skill pressable while testing its cast. */
  const SHOWCASE_ARENA_CD_SEC = 1;
  $effect(() => {
    if (!arenaPreview) return;
    // The one-second clock would drain the demo pool in a few presses; keep the test skill castable.
    if (gameState.player.mana < c.maxMana) gameState.player.mana = c.maxMana;
    const cd = gameState.skills.cd;
    for (const id of gameState.skills.list) if (id && (cd[id] || 0) > SHOWCASE_ARENA_CD_SEC) cd[id] = SHOWCASE_ARENA_CD_SEC;
  });
  /** The cooldown seconds one completed simulation tick removes, before the visual interpolation. */
  const cooldownTickRate = () => {
    const shockSecLeft = Math.max(0, gameState.playerStatuses.shock?.secLeft || 0);
    const activeFraction = bundleOf(c.keystones, 'unstoppable') ? 1 : Math.max(0, 1 - Math.min(1, shockSecLeft));
    // Crippled cuts outgoing direct damage only; it never slows cooldowns. Shock's stop
    // (`shock.stop_sec`, shortened by Stun Recovery) is the one control that pauses the clock.
    return c.cooldownRate * activeFraction;
  };
  /** UI projection only: interpolate between completed simulation ticks without advancing the sim. */
  const cooldownVisualSeconds = $derived.by(() => {
    void cooldownVisualNow;
    if (!cooldownSchedulerAt || !transactionWriter || paused || !running) return 0;
    const rate = cooldownTickRate();
    if (rate <= 0) return 0;
    const unsampled = Math.max(0, (cooldownVisualNow - cooldownSchedulerAt) / 1000) * speed;
    return Math.min(rate, (cooldownSimRemainder + unsampled) * rate);
  });
  $effect(() => {
    const hasCooldown = gameState.skills.list.some(id => !!id && (gameState.skills.cd[id] || 0) > 0);
    if (!transactionWriter || paused || !running || !hasCooldown || prefersReducedMotion.current) return;
    cooldownSchedulerAt = performance.now();
    let frame = 0;
    const sample = (now: number) => {
      cooldownVisualNow = now;
      frame = window.requestAnimationFrame(sample);
    };
    frame = window.requestAnimationFrame(sample);
    return () => window.cancelAnimationFrame(frame);
  });
  let combatArena = $state.raw(createCombatArena());
  /** Bumped on every arena rebind so a new field/load/replay never reuses an effect identity. */
  let arenaEpoch = $state(0);
  /** Canonical field key + arena instance: seek/zoom/skin never reset this identity. */
  const arenaSceneKey = $derived(`${fieldAreaKey(gameState)}#arena-${arenaEpoch}`);
  /** Host view intent; CombatArenaScene follows its interpolated player at the painted playhead. */
  const arenaFieldFrame: FieldViewFrame = $derived.by(() => {
    // combatArena is $state.raw: the tick clock below re-reads its mutable snapshot each sim tick.
    void gameState.clockSec;
    return createFieldViewFrame({
      sceneKey: arenaSceneKey,
      atUs: combatArena.nowUs,
      viewportCss: arenaStageCss,
      focusM: fieldPointM(combatArena.player.x, combatArena.player.y),
      worldScale: arenaWorldScale,
    });
  });
  let arenaVitals = $state<{ hp: number; es: number; mana: number } | null>(null);
  /** F37 — the scene's persistent target read: committed strike, requested focus or next body. */
  let arenaTargetRead = $state<ArenaTargetRead | null>(null);
  function resetArena() {
    arenaManual = {};
    arenaEpoch += 1;
    arenaFocusId = null;
    arenaAimSkill = null;
    const next = createCombatArena();
    const units = tree.mechanics?.combat_time_units_per_sec ?? 1;
    syncCombatArena(next, gameState, gameState.clockSec * units, units, characterSheet(gameState).maxHp);
    restorePendingWork(next, gameState);
    restoreFieldPositions(next, gameState);
    combatArena = next;
    arenaVitals = null;
    arenaTargetRead = null;
  }
  function replayArena() {
    gameState = showcaseGame('combat-field');
    resetArena();
    feed = []; feedSeen = 0;
    panel = null; sheetOpen = false;
    running = true;
  }
  function hudSkillEligibility(id: string) {
    const targets = arenaMode
      ? arenaSkillTargets(combatArena, id, gameState.group).targets
      : gameState.group;
    const eligibility = skillEligibilityInState(gameState, c, id, settings.autoSkills !== false, targets, arenaMode);
    return arenaMode && eligibility.reason === 'no-target' && gameState.group.length
      ? { ...eligibility, label: 'Out of range', detail: 'Moving into range before using this skill.' }
      : eligibility;
  }
  /** A vital climbs over one smooth second, but a fall lands in one step so the drop reads on its tick
   *  instead of draining. Reduced-motion users get an instant update either way. */
  function vitalVisual(source: () => number) {
    const tween = new Tween(source(), { easing: linear });
    $effect(() => {
      const next = source();
      const from = untrack(() => tween.current);
      if (next === from) return;
      tween.set(next, { duration: prefersReducedMotion.current || next < from ? 0 : 1000 });
    });
    return tween;
  }
  const hpVisual = vitalVisual(() => gameState.player.hp);
  const esVisual = vitalVisual(() => gameState.player.es);
  const manaVisual = vitalVisual(() => gameState.player.mana);
  // the game opens on the ground, not on the fight: the first read is where the character stands and
  // where the walk goes, and FIELD (or Escape) folds the map down to the combat frame. A normal boot
  // opens the Save chooser instead and waits there until the player loads or starts a character.
  // TEMP: slot saves off until the game is finished, so boot opens nothing (New character starts free).
  let panel = $state<PanelId | null>(showcaseMode || TEMP_DISABLE_SLOT_SAVES ? null : 'save');
  let travelScene = $state(false);
  let more = $state(false);
  let journeyExpanded = $state(false);
  let journeyBodyEl = $state<HTMLDivElement | null>(null);
  let mapControlsOpen = $state(false);
  $effect(() => {
    journeyExpanded = panel === 'map';
    if (panel !== 'map') mapControlsOpen = false;
  });
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
  let selectedTreeNodeId = $state('normal.str.s01');
  let treeBoardSession = $state(newPassiveTreeSession());
  let treeFocusId = $state<string | null>(null);
  const selectedTreeVerdict = $derived(canSpendTree(gameState, selectedTreeNodeId));
  /** What a respec hands back, split by the wallet each rank was paid from. */
  const treeSpent = $derived(tree.pointsSpentByCurrency(gameState.player.treeRanks ?? {}));
  let sheetOpen = $state(false);
  /** the sheet's own tabs: the final values, and the life-skill reference read */
  let sheetTab = $state<'stats' | 'life'>('stats');
  const LIFE_BONUS_LABELS: Record<string, string> = {
    armour_pct: 'Armour', evasion_pct: 'Evasion rating', accuracy_pct: 'Accuracy',
    hp_regen_pct: 'HP regeneration', mana_regen_pct: 'Mana regeneration', armour_pen: 'Armour penetration',
  };
  let saveNote = $state(showcaseMode || TEMP_DISABLE_SLOT_SAVES ? '' : 'Load a character, or start a new one. Existing slots are kept.');
  type AccountWriterState = 'checking' | 'owner' | 'readonly' | 'waiting' | 'unsupported';
  let accountWriterState = $state<AccountWriterState>('checking');
  let accountWriterLease: Extract<AccountWriterLockResult, { status: 'acquired' }> | null = null;
  let takeoverController: AbortController | null = null;
  let takeoverSlot = $state<SlotName>('slot1');
  const canWriteAccount = $derived(accountWriterState === 'owner');
  const transactionWriter = $derived(showcaseMode ? showcaseSample !== 'read-only' && showcaseSample !== 'story-read-only' : canWriteAccount);
  let inspectedEnemy = $state.raw<EnemySnapshot | null>(null);
  function openCombatHistory() {
    inspectedEnemy = null;
    sheetOpen = false;
    more = false;
    panel = 'combat';
  }
  setContext<PanelSession>(PANEL_SESSION, {
    get state() { return gameState.phase === 'fighting' ? 'Combat running' : gameState.walk ? 'Travelling' : gameState.phase === 'camp' ? 'At Camp' : gameState.hunting ? 'Hunting' : 'Idle'; },
    get running() { return running; },
    get speed() { return speed; },
    get hp() { return gameState.player.hp; },
    get maxHp() { return c.maxHp; },
    get writable() { return transactionWriter; },
    get blocked() { return paused || !transactionWriter; },
    format: (value) => fmtNum(value),
    onpause: () => runAction('game.pause'),
    onhistory: openCombatHistory,
  });
  let marketView = $state<'trade' | 'workshop' | 'stall' | 'deliveries' | 'black-market'>('trade');
  let marketTownId = $state('');
  const deliveryNotice = $derived(Object.values(gameState.town.contracts).flat().find((contract) => (contract.kind ?? 'request') === 'request' && contract.status === 'open' && !contract.announced));
  const accountWriterMessage = $derived(accountWriterState === 'owner'
    ? 'This tab controls saves for the account.'
    : accountWriterState === 'readonly'
      ? 'Another tab controls this account. This run is paused; export recovery JSON here, or take over to continue.'
      : accountWriterState === 'waiting'
        ? 'Waiting for the other tab to release account control. The run stays paused until this tab can save.'
        : accountWriterState === 'unsupported'
          ? 'This browser cannot coordinate account saves. The run is paused to protect progress; export recovery JSON before closing.'
          : 'Checking account save access… the run stays paused until this tab can save.');
  function requireAccountWriter(action: string): boolean {
    if (transactionWriter) return true;
    saveNote = `${accountWriterMessage} Open Save and take over before ${action}.`;
    return false;
  }

  let settings = $state<ClientSettings>({ ...DEFAULT_SETTINGS });
  function setSetting<K extends keyof ClientSettings>(k: K, v: ClientSettings[K]) {
    if (['autoSkills', 'autoEquip', 'autoAvoid', 'holdPosition', 'targetPriority', 'equipMargin'].includes(k) && !requireAccountWriter('changing gameplay automation')) return;
    settings[k] = v;
    if (!showcaseMode) void writeSettings(settings).catch((error) => {
      persistenceError = `Settings were not saved: ${error instanceof Error ? error.message : 'browser storage failed'}`;
      saveNote = persistenceError;
    });
  }
  /** Menu-hub VFX switch: Full against Minimal, the same setting the options panel owns. */
  const fxOn = $derived((settings.combatEffects || 'auto') !== 'minimal');
  function toggleFx() { setSetting('combatEffects', fxOn ? 'minimal' : 'full'); }
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
    if (ev.key === 'Escape') arenaManual.holdToken = undefined;
    if (ev.repeat && arenaManual.holdToken === `key:${ev.code}`) return;
    if (offlineProgress !== null) return;
    if (showcaseMode) {
      // The showcase carries the same local commands so the arena can be verified in place.
      if (isTypingTarget(ev.target) || isModifierKey(ev) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const action = actionFor(tokenOf(ev), keyContext);
      if (action?.startsWith('arena.')) { ev.preventDefault(); runAction(action, `key:${ev.code}`); }
      return;
    }
    // Native control activation owns Enter/Space; folding a HUD group must not also pause the game.
    if ((ev.key === 'Enter' || ev.key === ' ') && (ev.target as HTMLElement | null)?.closest('button, summary, a[href]')) return;
    if (ev.key === 'Escape') {
      if (isTypingTarget(ev.target)) return;
      // one Escape owner: an open sub-screen closes itself and keeps the field's own read untouched
      if (document.querySelector('[role="dialog"]')) return;
      sheetOpen = false;
      more = false;
      if (panel === 'map' && pickedCell) { clearMapSelection(); return; }
      if (panel === 'map') { panel = null; return; }
      picked = null;
      pickedCell = null;
      return;
    }
    // a field owns its own characters, the browser keeps its chords, and a bare modifier is a hand
    // reaching for a combination rather than a key with a job of its own
    if (isTypingTarget(ev.target) || isModifierKey(ev) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const action = actionFor(tokenOf(ev), keyContext);
    if (!action) return;
    ev.preventDefault();
    runAction(action, `key:${ev.code}`);
  }

  const keyFor = (action: string) => formatKey(SHORTCUT_TOKENS[action] || '');

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


  const VIEW_ORDER: ('terrain' | 'band' | 'gate')[] = ['terrain', 'band', 'gate'];

  /**
   * The one keyboard path through the client, and the one way any screen opens. It answers in the same
   * order the rail is read: a screen first, then the field's own switches, then the sheet's — because the
   * map's keys only mean something while the sheet is the thing in focus.
   */
  function runAction(action: string, holdToken?: string) {
    if (action === 'arena.focus') { focusArenaEnemy(); return; }
    if (action === 'arena.focus.clear') { clearArenaFocus(); return; }
    if (action === 'arena.aim') { toggleArenaAim(); return; }
    if (action === 'arena.aim.north' || action === 'arena.aim.south'
      || action === 'arena.aim.west' || action === 'arena.aim.east') {
      stepArenaAim(action.slice('arena.aim.'.length) as 'north' | 'south' | 'west' | 'east');
      return;
    }
    if (action === 'arena.aim.confirm') { confirmArenaAim(holdToken); return; }
    if (action === 'arena.cast') { castArenaAtFocus(holdToken); return; }
    if (action.startsWith('arena.slot.')) { castArenaSlot(Number(action.slice('arena.slot.'.length)) - 1, holdToken); return; }
    if (action.startsWith('arena.move.')) { wasdDown(action); return; }
    if (action === 'screen.combat') { openCombatHistory(); return; }
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
      case 'map.zoom.in': worldMap?.zoomBy(1.25); break;
      case 'map.zoom.out': worldMap?.zoomBy(1 / 1.25); break;
      case 'map.zoom.reset': worldMap?.resetCamera(); break;
      case 'map.centre': worldMap?.centerOnPlayer(); break;
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
    inspectedEnemy = null;
    if (TOWN_PANELS.includes(p) && !atSettlement(gameState)) {
      saveNote = `${RAIL_LABEL[p]} is a settlement service — walk or warp into one first`;
      return;
    }
    if (p === 'stash') { invTab = 'stash'; panel = panel === 'bag' ? null : 'bag'; return; }
    if (p === 'bag') invTab = 'inv';
    panel = panel === p ? null : p;
  }
  const closePanel = () => (panel = null);
  function revealPanel(target: PanelId) {
    panel = target;
    if (showcaseMode) requestAnimationFrame(() => {
      const section = ({ tree: 'passive-tree', bag: 'inventory' } as Record<string, string>)[target] || target;
      document.getElementById(`panel-${section}`)?.scrollIntoView({ block: 'start' });
    });
  }
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
  const fieldFx = $derived(ring.filter((e) => e.side === 'field' && !(e.kind === 'hit' && e.mobId) && !(e.kind === 'block' && e.mobId) && !(e.kind === 'cast' && e.mobId)).slice(0, 9));
  // the character's own answers live on its own corner now (taken blows pop like damage, block
  // words and status procs beside them), so the shared column keeps only what names no body — and a
  // walk floats nothing, so the word on the field is the whole of its read
  const selfFx = $derived(ring.filter((e) => e.side === 'self' && e.kind !== 'travel' && e.kind !== 'level' && e.kind !== 'block' && e.kind !== 'proc' && e.kind !== 'taken' && e.kind !== 'cast' && e.kind !== 'buff').slice(0, 5));
  const latestTaken = $derived(ring.find((e) => e.side === 'self' && e.kind === 'taken') || null);
  const latestOrbHeal = $derived(ring.find((e) => e.side === 'self' && e.kind === 'heal') || null);
  const plates = $derived([...gameState.group]);
  /** the field is a fight, not a backdrop: cards answer to the Field tab or to a live fight only */
  const inCombat = $derived(gameState.phase === 'fighting' && fieldInFight(gameState));
  const liveArpgArena = $derived(!showcaseMode);
  const arenaMode = $derived(arenaPreview || liveArpgArena);
  /** Digits cast skill slots while the arena command bar is up; everywhere else they keep
   *  their screens. Typing targets and open panels always win over both. */
  const keyContext = $derived(arenaMode && panel === null ? 'arena' as const : 'global' as const);
  $effect(() => {
    if (liveArpgArena) untrack(() => resetArena());
  });
  const shownHp = $derived(arenaMode && arenaVitals ? arenaVitals.hp : hpVisual.current);
  const shownEs = $derived(arenaMode && arenaVitals ? arenaVitals.es : esVisual.current);
  const shownMana = $derived(arenaMode && arenaVitals ? arenaVitals.mana : manaVisual.current);
  // Arena labels follow the buffered vital read; other modes label the live pools.
  const ariaHp = $derived(arenaMode && arenaVitals ? arenaVitals.hp : gameState.player.hp);
  const ariaEs = $derived(arenaMode && arenaVitals ? arenaVitals.es : gameState.player.es);
  const ariaMana = $derived(arenaMode && arenaVitals ? arenaVitals.mana : gameState.player.mana);
  const travelPhase = $derived(mapTravelPhase(travelScene, !!gameState.walk, inCombat));
  const travelFeet = $derived.by(() => { const p = currentCell(gameState); return `${p.q},${p.r}`; });
  const showCombatCards = $derived(panel === null || inCombat);
  /** the row that last fired — a press or a buff coming up are both the order being worked — so the bar
   *  lights the slot that actually pressed instead of the one the eye expects */
  const latestFire = $derived(settings.combatEffects === 'reduced' || settings.combatEffects === 'minimal' ? null
    : (gameState.fx || []).find((e) => e.side === 'self' && !!e.skillId && (e.kind === 'cast' || e.kind === 'buff')) || null);
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
  const chatShown = $derived(chatTab === 'all' ? feed : feed.filter((l) => l.chan === chatTab));
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

  let awayReport = $state<AwayReport | null>(null);
  let skillDiscoveryId = $state<string | null>(null);
  let skillsWorkbenchView = $state(newSkillsWorkbenchView());
  function inspectSkill(id: string) {
    skillsWorkbenchView = { ...newSkillsWorkbenchView(), selectedId: id };
    revealPanel('skills');
  }
  let skillRewardSeen = '';
  function resetSkillDiscovery() {
    skillDiscoveryId = null;
    const reward = gameState.fx?.find(event => event.kind === 'drop' && event.skillId);
    skillRewardSeen = reward ? `${reward.id}:${reward.sec}:${reward.skillId}` : '';
  }
  $effect(() => {
    const reward = ring.find(event => event.kind === 'drop' && event.skillId);
    if (!reward?.skillId) return;
    const key = `${reward.id}:${reward.sec}:${reward.skillId}`;
    if (key === skillRewardSeen) return;
    skillRewardSeen = key;
    if (!offlineProgress) skillDiscoveryId = reward.skillId;
  });

  // the away report's own reads live in `ui/hud.ts`, where a test can reach them

  let c = $derived(characterSheet(gameState));
  const hpFill = $derived(c.maxHp > 0 ? Math.max(0, Math.min(1, shownHp / c.maxHp)) : 0);
  /** The HP a reservation holds back and the HP a heal may reach; Max stays the Full Max (`35`, `54`). */
  const hpBanked = $derived(hpReserved(c, gameState.skills));
  const hpUsable = $derived(usableHp(c, gameState.skills));
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
  /** One next step, read from the character's pin or the fixed suggestion order in `sim/core/guidance.ts`. */
  const journeyGoal = $derived.by(() => {
    const next = nextGoal(gameState);
    if (!next) return null;
    if (next.source === 'recommended' && settings.autoGoal === false) return null;
    return next;
  });
  let forgeFocus = $state<{ patternKind: ForgeKind; pattern: string; material: string; nonce: number } | null>(null);
  let forgeFocusNonce = 0;
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

  function allocate(k: StatKey, delta: number) { return __field.allocate(k, delta); }

  function doSpendTree(nodeId: string) { return __field.doSpendTree(nodeId); }

  function doAllocateTreePath(nodeId: string) { return __field.doAllocateTreePath(nodeId); }

  function doRespecTree() { return __field.doRespecTree(); }

  function respec() { return __field.respec(); }

  const AUTOSAVE_SEC = 30;

  $effect(() => {
    if (!arenaPreview) return;
    const state = { acc: 0, previous: performance.now() };
    const timer = setInterval(() => {
      const now = performance.now();
      const batch = previewTick(state, now, { running, paused, hidden: document.hidden, speed });
      for (let index = 0; index < batch.steps; index++) step();
    }, Math.max(16, COMBAT_STEP_US() / 1000));
    return () => clearInterval(timer);
  });

  onMount(() => {
    let stopWake: (() => void) | null = null;
    let autosaveTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    const writerController = new AbortController();
    if (showcaseMode) {
      document.body.classList.add('ui-showcase');
      // A preview link may pin one presentation tier so the quality contract can be inspected
      // without touching the player's saved settings. It never changes simulation outcomes.
      const previewEffects = showcaseQuery.get('effects');
      settings = {
        ...DEFAULT_SETTINGS,
        ...(previewEffects === 'full' || previewEffects === 'reduced' || previewEffects === 'minimal'
          ? { combatEffects: previewEffects } : {}),
      };
      speed = settings.speed || 1;
      if (arenaPreview) resetArena();
      // a deep-linked sample opens fully set up, exactly as if picked from the dropdown
      if (initialShowcaseSample !== 'combat-field') applyShowcaseSample(initialShowcaseSample);
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
    const onHide = () => { if (document.visibilityState === 'hidden') flushSync(); };
    // F33: presentation loss freezes the sim like a pause, but it is not the user's pause —
    // the boundary is persisted first so a reload cannot recount the frozen span as away
    // progress, and resume restores only the pause state the loss itself imposed.
    let renderLostPaused = false;
    const onRenderLost = () => { renderLostPaused = paused; paused = true; flushSync(); };
    const onRenderRestored = () => { if (!renderLostPaused) paused = false; };
    (async () => {
      // A replacement instance in the same document must be able to wait out the departing
      // instance's teardown flush; a genuinely occupied second tab still reads as busy.
      const writerLock = await requestAccountWriterLock({ retryMs: 2000, signal: writerController.signal });
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
      loadSnaps();
      // TEMP: slot saves off until the game is finished — boot straight into a free
      // character instead of parking on the Save chooser.
      if (TEMP_DISABLE_SLOT_SAVES && !disposed && startupPending) await startNewCharacter();
      // The startup chooser owns the run until Load succeeds or Start new character completes.
      // Away catch-up belongs to `doLoad` alone, so this boot never simulates the placeholder and
      // never writes a slot the player has not chosen.
      if (!disposed) {
        stopWake = startWakeLoop();
        restartWakeLoop = () => { stopWake?.(); loop.restart(); stopWake = startWakeLoop(); };
        autosaveTimer = setInterval(() => { if (canWriteAccount && saveSession.slot) void doSave(saveSession.slot, true); }, AUTOSAVE_SEC * 1000);
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('modworld:render-lost', onRenderLost);
        window.addEventListener('modworld:render-restored', onRenderRestored);
        window.addEventListener('beforeunload', flushSync);
      }
    })();
    return () => {
      disposed = true;
      restartWakeLoop = null;
      stopWake?.();
      if (autosaveTimer) clearInterval(autosaveTimer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('modworld:render-lost', onRenderLost);
      window.removeEventListener('modworld:render-restored', onRenderRestored);
      window.removeEventListener('beforeunload', flushSync);
      takeoverController?.abort();
      loadController?.abort();
      writerController.abort();
      const lease = accountWriterLease;
      // The departing tab releases even when its final flush fails; the failure is reported, not
      // left holding the browser-wide writer lock against the replacement instance.
      void saveSession.flush()
        .catch((error) => console.error('ModWorld: final save flush failed', error))
        .finally(() => lease?.release());
      accountWriterLease = null;
    };
  });

  let equipNote = $state('');
  const __gear = createGearCommands({
    get gameState() { return gameState; },
    set gameState(value) { gameState = value; },
    get settings() { return settings; },
    get equipNote() { return equipNote; },
    set equipNote(value) { equipNote = value; },
    get invTab() { return invTab; },
    set invTab(value) { invTab = value; },
    get townLive() { return townLive; },
    get tabs() { return tabs; },
    get stashTab() { return stashTab; },
    requireAccountWriter,
    craftThisItem: (selection) => craftThisItem(selection),
    doDeposit: (index, tab) => doDeposit(index, tab),
    toggleLock: (item) => toggleLock(item),
  });
  function equip(index: number) { return __gear.equip(index); }
  function doSalvage(index: number) { return __gear.doSalvage(index); }
  function doRunFilter() { return __gear.doRunFilter(); }
  function doSaveFilterPreset(i: number) { return __gear.doSaveFilterPreset(i); }
  function doLoadFilterPreset(i: number) { return __gear.doLoadFilterPreset(i); }
  function doClearFilterPreset(i: number) { return __gear.doClearFilterPreset(i); }
  function doUnequip(cell: number) { return __gear.doUnequip(cell); }
  function bagPieceActions(entry: SlotEntry): MenuItem[] { return __gear.bagPieceActions(entry); }
  function wornActions(entry: SlotEntry): MenuItem[] { return __gear.wornActions(entry); }
  function doBestEquip() { return __gear.doBestEquip(); }
  function equipCarriedBest() { return __gear.equipCarriedBest(); }

  function toggleAutoEquip() {
    if (!requireAccountWriter(settings.autoEquip === false ? 'enabling Auto Equip' : 'disabling Auto Equip')) return;
    const enabled = settings.autoEquip === false;
    setSetting('autoEquip', enabled);
  }

  function goToZone(id: number) { return __travel.goToZone(id); }

  function doHuntHere() { return __travel.doHuntHere(); }

  function doEstablishCamp() { return __field.doEstablishCamp(); }

  function doStartFieldAction(kind: 'mine' | 'grove' | 'fish') { return __field.doStartFieldAction(kind); }

  function doStopFieldAction() { return __field.doStopFieldAction(); }

  function doCampEncounter(id: number, action: CampEncounterAction, expected?: { beat: number; stage: import('@sim/world/fieldwork').CampEncounterStage }) { return __field.doCampEncounter(id, action, expected); }

  function doCampPolicy(policy: CampEncounterPolicy) { return __field.doCampPolicy(policy); }

  function doCookMeal(id: string, count = 1) { return __field.doCookMeal(id, count); }

  function doEatMeal(id: string) { return __field.doEatMeal(id); }

  function updateAutoEat(patch: Partial<typeof gameState.fieldwork.autoEat>) { return __field.updateAutoEat(patch); }

  function setAutoPotion(pool: 'hp' | 'mana', enabled: boolean) { return __field.setAutoPotion(pool, enabled); }

  function setPotionThreshold(pool: 'hp' | 'mana', value: number) { return __field.setPotionThreshold(pool, value); }

  function setFarmAutomation(kind: 'plant' | 'harvest' | 'brew', enabled: boolean) { return __field.setFarmAutomation(kind, enabled); }

  function cycleQuickSlot(slot: number) { return __field.cycleQuickSlot(slot); }

  function assignQuickSlot(slot: number, name: string | null) { return __field.assignQuickSlot(slot, name); }

  /** The slot the player last saved or loaded. Null until they choose, so a fresh in-memory game
   *  never silently autosaves over an existing file. */
  const saveSession = new CharacterSaveSession();
  /** Reactive mirror of `saveSession.slot`, used by the Journey's unsaved notice. */
  let attachedSlot = $state<SlotName | null>(null);
  let persistenceError = $state<string | null>(null);
  /** One ordered list for Journey: save/writer first, then blockers, decisions and tracked work. */
  const journeyNotices = $derived(guidanceNotices(gameState, {
    storageError: !!persistenceError,
    writerState: accountWriterState === 'unsupported' ? 'unavailable' : accountWriterState,
    startup: !showcaseMode && !TEMP_DISABLE_SLOT_SAVES && startupPending,
    unsaved: !showcaseMode && !TEMP_DISABLE_SLOT_SAVES && !startupPending && attachedSlot === null,
  }));
  let loadController = $state.raw<AbortController | null>(null);
  let offlineProgress = $state<{ done: number; total: number } | null>(null);
  let snaps: Snapshot[] = $state([]);
  let snapSlot = $state<SlotName>('slot1');
  let snapNote = $state('');
  let saveTab = $state<'slots' | 'backups' | 'settings'>('slots');

  const session = createSessionActions({
    showcaseMode,
    saveSession,
    get gameState() { return gameState; },
    set gameState(value: GameState) { gameState = value; },
    get canWriteAccount() { return canWriteAccount; },
    get settings() { return settings; },
    get paused() { return paused; },
    set paused(value: boolean) { paused = value; },
    get loadController() { return loadController; },
    set loadController(value: AbortController | null) { loadController = value; },
    set offlineProgress(value: { done: number; total: number } | null) { offlineProgress = value; },
    set saveNote(value: string) { saveNote = value; },
    set persistenceError(value: string | null) { persistenceError = value; },
    set awayReport(value: AwayReport | null) { awayReport = value; },
    get liveArpgArena() { return liveArpgArena; },
    get accountWriterState() { return accountWriterState; },
    set accountWriterState(value: AccountWriterState) { accountWriterState = value; },
    get accountWriterLease() { return accountWriterLease; },
    set accountWriterLease(value: AccountWriterLease | null) { accountWriterLease = value; },
    get takeoverController() { return takeoverController; },
    set takeoverController(value: AbortController | null) { takeoverController = value; },
    get takeoverSlot() { return takeoverSlot; },
    set takeoverSlot(value: SlotName) { takeoverSlot = value; },
    set attachedSlot(value: SlotName | null) { attachedSlot = value; },
    get snapSlot() { return snapSlot; },
    get snaps() { return snaps; },
    set snaps(value: Snapshot[]) { snaps = value; },
    set snapNote(value: string) { snapNote = value; },
    resetArena,
    resetSkillDiscovery,
    restartLoop: () => restartWakeLoop?.(),
    captureCharacterUi: () => captureCharacterUi(),
    restoreCharacterUi: (snapshot: CharacterUiSnapshot) => restoreCharacterUi(snapshot),
    resetCharacterUi: () => resetCharacterUi(),
    equipCarriedBest,
  });
  const {
    cancelOfflineLoad, doSave, loadSnaps, restore, doLoad, takeOverAccount, cancelTakeover,
    download, upload, reset, flushSync,
  } = session;

  /** Boot owns the clock until a load or a new character succeeds. A failed load leaves the chooser
   *  in place and the run paused; a success reveals the field and starts the normal session flow. */
  function completeStartup() {
    if (!startupPending) return;
    startupPending = false;
    paused = false;
    running = true;
  }

  async function loadFromSave(slot: SlotName) {
    const ok = await doLoad(slot);
    if (!ok) {
      if (startupPending) paused = true;
      return;
    }
    if (startupPending) {
      completeStartup();
      panel = null;
    }
  }

  /** An import or a snapshot rewind during boot is a chosen character too. */
  async function afterStartupAction(action: () => Promise<boolean>) {
    const ok = await action();
    if (ok && startupPending) {
      completeStartup();
      panel = null;
    }
  }
  async function importFromSave(ev: Event) {
    await afterStartupAction(() => upload(ev));
  }
  async function takeOverAndLoad() {
    await afterStartupAction(takeOverAccount);
  }
  async function restoreFromSave(index: number) {
    await afterStartupAction(() => restore(index));
  }

  /** The Save panel's Start button and the sheet's New character share this path. */
  async function startNewCharacter() {
    const ok = await reset();
    if (!ok) return;
    if (startupPending) {
      completeStartup();
    }
  }
  async function newCharacterFromSheet() {
    if (!confirm('Start a new character?')) return;
    await startNewCharacter();
  }

  const loop = createGameLoop({
    get gameState() { return gameState; },
    get settings() { return settings; },
    get transactionWriter() { return transactionWriter; },
    get arenaMode() { return arenaMode; },
    get combatArena() { return combatArena; },
    set combatArena(value: CombatArena) { combatArena = value; },
    get arenaManual() { return arenaManual; },
    get running() { return running && !startupPending; },
    get paused() { return paused; },
    get speed() { return speed; },
    get canWriteAccount() { return canWriteAccount; },
    set cooldownSimRemainder(value: number) { cooldownSimRemainder = value; },
    set cooldownSchedulerAt(value: number) { cooldownSchedulerAt = value; },
    syncArenaFocus,
    equipCarriedBest,
  });
  const { step, startWakeLoop } = loop;
  /** Set by onMount: reset stops the departing wake loop and starts one new loop. */
  let restartWakeLoop: (() => void) | null = null;

  function editRule(slot: string, patch: Record<string, unknown>) {
    if (!requireAccountWriter('changing the bag filter')) return;
    setRule(gameState.filter, slot, patch as any);
    gameState = { ...gameState };
  }
  function setAutoDissolve(value: number) {
    if (!requireAccountWriter('changing auto-dissolve')) return;
    gameState.autoDissolveLevel = Math.max(0, Number(value) || 0);
    gameState = { ...gameState };
  }
  function openGearCare() {
    panel = 'bag';
    invTab = 'inv';
    const gear = document.querySelector<HTMLDetailsElement>('.gear-care');
    if (gear) gear.open = true;
    requestAnimationFrame(() => gear?.scrollIntoView({ block: 'start' }));
  }

  // the panel follows the zone the character is actually hunting, so an auto-travel step cannot
  // leave it showing the town the character walked away from
  const townId = $derived(settlementOfZone(gameState.zone)?.id || 'eastgate');
  const town = $derived(settlementById(townId));
  let picked = $state<string | null>(null);
  let pickedCell = $state<Picked | null>(null);
  let deskTab = $state<'services' | 'stall' | 'guild' | 'hunt' | 'walk'>('services');
  let view = $state<'terrain' | 'band' | 'gate'>('terrain');
  const cleanMap = $derived(settings.cleanMap === true);
  let gateLevel = $state(1);
  let showWalk = $state(false);
  let showIds = $state(false);
  let showHexCalibration = $state(false);
  const MAP_NAMES_KEY = 'modworld.map-names.v1';
  let showMapNames = $state(true);
  let mapCamera = $state<MapCameraState>({ ...DEFAULT_MAP_CAMERA });
  let mapCells = $state<readonly MapStaticCell[]>([]);
  let worldMap: WorldMap | null = $state(null);
  onMount(() => {
    try { showMapNames = localStorage.getItem(MAP_NAMES_KEY) !== 'hidden'; } catch { /* UI preference can stay in memory. */ }
  });
  function setMapNames(show: boolean) {
    showMapNames = show;
    try { localStorage.setItem(MAP_NAMES_KEY, show ? 'shown' : 'hidden'); } catch { /* UI preference can stay in memory. */ }
  }
  let journeyToolsOpen = $state(false);
  let lastAutoOpenedCampEvent = '';
  $effect(() => {
    const event = gameState.fieldwork.campEncounters.active;
    if (!event) return;
    const key = `${gameState.seed}:${event.id}:${event.stage}`;
    if (key === lastAutoOpenedCampEvent) return;
    lastAutoOpenedCampEvent = key;
    panel = 'map';
    journeyToolsOpen = true;
    journeyExpanded = true;
    journeyBodyEl?.scrollTo({ top: 0 });
  });
  const cellAt = (hex: { q: number; r: number }) => mapCells.find((cell) => cell.ax === `${hex.q},${hex.r}`)?.picked ?? null;
  const journeyCell = $derived.by(() => pickedCell ?? cellAt(currentCell(gameState)));
  const fieldCellKey = (cell: Cell | null) => {
    if (!cell) return 'field';
    return mapCells.find((entry) => entry.ax === `${cell.q},${cell.r}`)?.picked.key || `${cell.q},${cell.r}`;
  };
  const fieldCellName = $derived(gameState.cell ? `${fieldCellKey(gameState.cell)} · ${zone.name}` : `${zone.name} · field`);
  const fieldCampName = $derived(gameState.fieldwork.camp
    ? `${eng.zoneById(gameState.fieldwork.camp.zone).name} · ${fieldCellKey(gameState.fieldwork.camp.cell)}`
    : 'not set');
  const mapMarkup = mapOverlayRaw.replace(/^<\?xml[^>]*\?>\s*/, '');
  const rampCss = $derived(E.mob.zones.map((_: any, i: number) => ramp(i)).join(','));
  const mapOptions = $derived<MapViewOptions>({
    view,
    gateLevel,
    showIds,
    showWalk,
    townId,
    showNames: showMapNames && !cleanMap,
    cleanMap,
    showHexCalibration,
    relief: false,
  });

  function applyPicked(next: Picked) {
    journeyExpanded = true;
    journeyToolsOpen = false;
    mapControlsOpen = false;
    journeyBodyEl?.scrollTo({ top: 0 });
    saveNote = '';
    pickedCell = next;
    picked = next.kind === 'bare' ? null : next.nodeId ?? null;
  }
  function handleMapIntent(intent: MapIntent) {
    if (intent.type === 'clear-selection') { clearMapSelection(); return; }
    // The first ground click only sharpens the sheet; a hex is picked on the map it can read.
    if (panel !== 'map') { panel = 'map'; return; }
    applyPicked(intent.cell);
    if (intent.type === 'activate') activateJourneyDestination();
  }
  function select(id: string) {
    journeyExpanded = true;
    journeyToolsOpen = false;
    mapControlsOpen = false;
    journeyBodyEl?.scrollTo({ top: 0 });
    if (picked === id && pickedCell?.kind === 'town') { picked = null; pickedCell = null; return; }
    const cell = settlementCell(id);
    const found = cell ? cellAt(cell) : null;
    picked = id;
    pickedCell = found ?? (cell ? { key: '', q: cell.q, r: cell.r, kind: 'town', label: settlementById(id)!.name, sub: null, site: null, terrain: null, nodeId: id } : null);
  }
  // Re-centre when the map opens or the feet move; App owns the camera's lifetime, WorldMap applies it.
  $effect(() => {
    void picked; void panel; void gameState.cell;
    if (panel !== 'map' || !worldMap) return;
    const frame = requestAnimationFrame(() => worldMap?.centerOnPlayer());
    return () => cancelAnimationFrame(frame);
  });
  $effect(() => {
    const phase = travelPhase;
    if (phase === 'travel') panel = 'map';
    if (phase === 'arrived') travelScene = false;
    if (phase !== 'combat') return;
    const duration = prefersReducedMotion.current ? 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-map')) || 450;
    const timer = setTimeout(() => {
      if (panel === 'map') panel = null;
      if (!gameState.walk) travelScene = false;
    }, duration);
    return () => clearTimeout(timer);
  });
  $effect(() => {
    void travelFeet;
    if ((travelPhase === 'travel' || travelPhase === 'combat') && worldMap) {
      const frame = requestAnimationFrame(() => worldMap?.centerOnPlayer());
      return () => cancelAnimationFrame(frame);
    }
  });
  const journeySettlement = $derived(journeyCell ? settlementById(ownerOf(journeyCell).id) : null);
  /**
   * The card's whole subject: the picked cell, what stands on it, what it costs to reach from where the
   * feet are, and whether the feet are already there.
   */
  const journeyDest = $derived.by(() => {
    if (!journeyCell) return null;
    const node = ownerOf({ q: journeyCell.q, r: journeyCell.r });
    const self = journeyCell.q === currentCell(gameState).q && journeyCell.r === currentCell(gameState).r && !gameState.walk;
    return {
      key: journeyCell.key,
      q: journeyCell.q,
      r: journeyCell.r,
      kind: journeyCell.kind,
      label: journeyCell.label,
      node: node.id,
      sub: journeyCell.sub,
      site: journeyCell.site,
      self,
      walking: !!gameState.walk && gameState.walk.to.q === journeyCell.q && gameState.walk.to.r === journeyCell.r,
      here: gameState.town.visited.includes(node.id),
      blocks: self ? 0 : cellBlocks(gameState, { q: journeyCell.q, r: journeyCell.r }),
      sec: self ? 0 : cellSec(gameState, { q: journeyCell.q, r: journeyCell.r }),
    };
  });
  const journeyPrimary = $derived(journeyDest ? destinationPrimary(gameState, journeyDest, transactionWriter) : null);
  /** Shared Waypoint readiness (F3): the button, fare and command all read this one result. */
  const journeyWarp = $derived(journeyDest ? destinationWarp(gameState, journeyDest, transactionWriter) : null);
  const journeyIntel = $derived(journeyCell && journeyDest?.node ? destinationIntel(gameState, journeyCell, journeyDest.node, journeyDest.blocks) : null);
  const journeySignals = $derived.by(() => {
    if (!journeyCell) return [];
    const zone = journeySettlement?.zone;
    const subzone = journeyCell.sub ?? undefined;
    const roster = zone != null && subzone != null ? eng.zoneById(zone).subzones?.[subzone]?.species || [] : [];
    const cell: AdventureCell = {
      ax: journeyCell.q + ',' + journeyCell.r, q: journeyCell.q, r: journeyCell.r,
      town: journeyCell.kind === 'town' ? journeySettlement?.id || null : null,
      sub: journeyCell.kind === 'sub', zone, subzone, site: journeyCell.site ?? undefined,
      uniqueSpecies: zone != null ? uniqueTraceSpecies(roster, zone) : undefined,
    };
    return adventureView(gameState, [cell]).placements.filter(placement => placement.ax === cell.ax);
  });

  function doInvestigateTrailSite() {
    if (!requireAccountWriter('investigating a trail site') || !journeyIntel?.site) return;
    const result = investigateTrailSite(gameState, journeyIntel.site.id);
    saveNote = result.ok ? result.message || 'Site explored' : result.why || 'Cannot investigate';
    if (result.ok) push(gameState, saveNote);
    gameState = { ...gameState };
  }
  function locateMapHex(hex: { q: number; r: number }) {
    panel = 'map';
    const found = worldMap?.pickAt(hex);
    if (found) applyPicked(found);
  }

  function clearMapSelection() {
    picked = null; pickedCell = null; saveNote = '';
    journeyBodyEl?.scrollTo({ top: 0 });
    worldMap?.focus();
  }

  function activateJourneyDestination() {
    const action = journeyPrimary;
    if (!action || action.disabled || !journeyCell) return;
    if (action.kind !== 'town' && !requireAccountWriter('using this destination')) return;
    switch (action.kind) {
      case 'walk': doWalk(journeyCell); break;
      case 'investigate': doInvestigateTrailSite(); break;
      case 'town': panel = 'desk'; break;
      case 'hunt': doHuntHere(); break;
      case 'dungeon': doDungeon(); break;
      case 'retreat': doRetreat(); break;
      case 'mine': case 'grove': case 'fish': doStartFieldAction(action.kind); break;
      case 'stop-gather': doStopFieldAction(); break;
    }
  }
  let journeyPanelEl = $state<HTMLDivElement | null>(null);
  /**
   * The settlement the panel speaks for: the one under the pick, or the one you stand in when nothing
   * is picked. Its counter, board, desk and set are read anywhere on the field, but worked only where
   * the character is — so `viewHere` gates every verb, and the map never sells a far purchase.
   */
  const viewTown = $derived(pickedCell ? journeySettlement ?? town : town);
  const viewHere = $derived(!!viewTown && viewTown.id === townId);
  const viewStock = $derived(stockOf(viewTown?.id ?? '', gameState));
  const viewColSet = $derived(col.setAt(viewTown?.id));
  const viewColHinted = $derived(!!viewColSet && !!gameState.collector.hints?.[viewColSet.id]);
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
        : name === 'town' ? 'settlement' : name }));
  });
  const firstBand = $derived(E.mob.zones[0].levels);
  const lastBand = $derived(E.mob.zones[E.mob.zones.length - 1].levels);
  const townStock = $derived(stockOf(town?.id ?? '', gameState));
  const skipTokens = $derived(gameState.town.owned.filter((id) => id === 'skip_token').length);
  const freeSkipsLeft = $derived(Math.max(0, (Number(TOWN.task_sizing.free_skip_per_day) || 0) - (gameState.town.freeSkipsToday || 0)));
  const junkTotal = $derived(Object.values(gameState.junk).reduce((a: number, b: number) => a + b, 0));
  const junkLines = $derived(Object.entries(gameState.junk)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([item, n]) => `${item} ×${n}`));
  /** The purse, the stone pile and the bag, read as the corner pills — the same counters the
      panels print, summed once here so the field never has to open a panel to be read. */
  const bagFull = $derived(slotsFree(gameState) < 1);
  function doSell() { return __economy.doSell(); }

  let marketSale = $state<{ text: string; goldText: string; townId: string; goodId: string } | null>(null);

  function doTrade(id: string, count: number, expected?: { carried: number; gold: number }) { return __economy.doTrade(id, count, expected); }

  function doProcess(id: string) { return __economy.doProcess(id); }

  function showTradeRoute(id: string) {
    panel = 'map'; picked = null; select(id);
    if (showcaseMode) document.getElementById('showcase-field')?.scrollIntoView();
  }

  function doBuy(rowId: string, settlementId = town!.id, expected?: import('@sim/town/pricing').TownPurchaseExpectation) { return __economy.doBuy(rowId, settlementId, expected); }

  function buyExpectation(settlementId: string, row: any) { return __economy.buyExpectation(settlementId, row); }

  function doSkipTask(i: number) { return __economy.doSkipTask(i); }

  function doRepairGear(where: Where, index: number, expected?: { token: string; target?: { where: Where; index: number } }) { return __economy.doRepairGear(where, index, expected); }

  function doDelivery(id: string, count: number, choice?: string, expected?: import('@sim/town/delivery').DeliveryExpected) { return __economy.doDelivery(id, count, choice, expected); }

  function doAcceptCourier(id: string) { return __economy.doAcceptCourier(id); }

  function doDeclineCourier(id: string) { return __economy.doDeclineCourier(id); }

  function doBlackMarketBuy(townId: string, offerId: string) { return __economy.doBlackMarketBuy(townId, offerId); }

  function openBlackMarket() {
    marketView = 'black-market';
    marketTownId = town?.id || '';
    panel = 'market';
  }
  function doTrackDelivery(id: string, tracked: boolean) { return __economy.doTrackDelivery(id, tracked); }
  function doAcknowledgeDelivery(id: string) { return __economy.doAcknowledgeDelivery(id); }
  function doDismissDelivery(id: string) { return __economy.doDismissDelivery(id); }

  function openDeliveryWant(id: string) {
    const contract = Object.values(gameState.town.contracts).flat().find((entry) => entry.id === id);
    if (!contract) return;
    const boardTown = contract.kind === 'courier' && contract.acceptedAtDeliverySec != null ? contract.destinationTown : contract.town;
    marketView = 'deliveries'; marketTownId = boardTown; panel = 'market';
    if (transactionWriter) doDismissDelivery(id);
    if (showcaseMode) document.getElementById('panel-market')?.scrollIntoView();
  }

  /** The player's own pin outranks suggestions; clearing it hands the card back to `recommendGoal`. */
  function doTrackGoal(ref: GoalRef | null) {
    if (!requireAccountWriter(ref ? 'pinning a goal' : 'clearing a goal')) return;
    setTrackedGoal(gameState, ref);
    gameState = { ...gameState };
    saveNote = ref ? 'Goal pinned to Journey · it stays ahead of suggestions' : 'Goal cleared · suggestions are back';
  }
  function doTrackShortage(good: string, want: number, origin: ShortageOrigin) {
    doTrackGoal({ kind: 'shortage', good, want, origin });
  }
  /** A source pin selects its settlement on the map; it never walks, buys or spends anything. */
  function pinZoneSource(zone: number) {
    const target = zoneDestination(zone);
    if (!target) {
      saveNote = `No map settlement stands in zone ${zone}`;
      return;
    }
    locateMapHex(target);
    journeyExpanded = true;
    saveNote = `Pinned ${target.label} on the map · source for the current goal`;
  }
  function openMapAtSettlement() {
    const here = ownerOf(currentCell(gameState));
    const cell = settlementCell(here.id);
    panel = 'map';
    journeyExpanded = true;
    if (cell) locateMapHex(cell);
  }
  function pinJourneyDestination() {
    if (!journeyDest) return;
    doTrackGoal({ kind: 'destination', q: journeyDest.q, r: journeyDest.r, label: journeyDest.label });
  }
  function isJourneyPinned() {
    const ref = journeyGoal?.source === 'tracked' ? journeyGoal.view.ref : null;
    return !!ref && ref.kind === 'destination' && ref.q === journeyDest?.q && ref.r === journeyDest?.r;
  }
  /** Every goal action reuses the panel or sim verb that already owns it. */
  function runGoalTarget(target: GoalRef) {
    switch (target.kind) {
      case 'delivery': openDeliveryWant(target.id); break;
      case 'workshop':
        marketView = 'workshop';
        marketTownId = ownerOf(currentCell(gameState)).id;
        panel = 'market';
        break;
      case 'forge':
        forgeFocus = { patternKind: target.patternKind, pattern: target.pattern, material: target.material, nonce: ++forgeFocusNonce };
        panel = 'forge';
        break;
      case 'destination':
        locateMapHex({ q: target.q, r: target.r });
        journeyExpanded = true;
        break;
      case 'passive':
        selectedTreeNodeId = target.id;
        treeFocusId = target.id;
        revealPanel('tree');
        break;
      case 'tree': revealPanel('tree'); break;
      case 'hunt':
        if (gameState.zone === target.zone && !!gameState.cell && road.cellRank(gameState.cell) > 0) panel = null;
        else goToZone(target.zone);
        break;
      case 'shortage': runGoalTarget(target.origin as GoalRef); break;
    }
  }
  function runGoalAction(view: GoalView) { runGoalTarget(view.target); }
  function runNoticeAction(notice: GuidanceNotice) {
    if (notice.id === 'storage-error' || notice.id === 'writer') { openPanel('save'); return; }
    // TEMP: slot saves off until the game is finished — startup/unsaved never open Save.
    if (notice.id === 'startup' || notice.id === 'unsaved') {
      if (!TEMP_DISABLE_SLOT_SAVES) openPanel('save');
      return;
    }
    if (notice.id === 'camp-encounter') {
      journeyExpanded = true;
      journeyToolsOpen = true;
      journeyBodyEl?.scrollTo({ top: 0 });
      return;
    }
    // The blocked-bag notice owns the map verb, not the recommended-goal target it carries beside it.
    if (notice.action === 'map') { openMapAtSettlement(); return; }
    if (notice.target) runGoalTarget(notice.target);
  }

  let taskChoices = $state<Record<number, { task: TaskSlot; choice: string }>>({});
  function doClaim(i: number, choice?: string) { return __economy.doClaim(i, choice); }

  function travelTo(id: string) { return __travel.travelTo(id); }

  const warpPrice = (id: string) => __travel.warpPrice(id);

  function doWalk(dest: Picked | Cell & { key?: string }) { return __travel.doWalk(dest); }

  const dungeonView = $derived.by(() => {
    const run = gameState.dungeon;
    if (run) return { active: true, left: run.left, total: run.total, cooldown: 0 };
    return { active: false, left: 0, total: 0, cooldown: Math.ceil(cooldownLeft(gameState)) };
  });

  function doDungeon() { return __travel.doDungeon(); }

  function doRetreat() { return __travel.doRetreat(); }

  function doScrapAlchemy(count = 1) {
    const result = transmuteScrap(gameState, count, { writer: transactionWriter });
    farmNote = result.ok ? `Alchemy: ${result.made} Value stones + ${result.tier} Tier stones${result.why ? ` · stopped: ${result.why}` : ''}` : `Alchemy: ${result.why}`;
    gameState = { ...gameState };
  }

  let benchSelection = $state.raw<ItemSelection | null>(null);
  const bench = $derived(resolveItemSelection(gameState, benchSelection));
  const repairQuote = $derived.by(() => {
    if (!town || !bench) return null;
    const row = townStock.find((entry) => entry.id === 'repair_ironrow' || entry.id === 'repair');
    return row ? quoteTownPurchase(gameState, town.id, row.id, { where: bench.where, index: bench.index }) : null;
  });
  const repairPrice = $derived(repairQuote?.gold ?? 0);
  let craftView = $state(newCraftWorkbenchView());
  let benchNote = $state('');
  const benchItem = $derived(bench?.item ?? null);
  const captureCharacterUi = (): CharacterUiSnapshot => captureCharacterUiSnapshot({
    benchSelection, benchNote, craftView, inspectedEnemy,
  });
  function restoreCharacterUi(snapshot: CharacterUiSnapshot) {
    const next = restoreCharacterUiSnapshot(snapshot);
    benchSelection = next.benchSelection;
    benchNote = next.benchNote;
    craftView = next.craftView;
    inspectedEnemy = next.inspectedEnemy;
  }
  function resetCharacterUi() {
    const empty = emptyCharacterUiSnapshot();
    benchSelection = empty.benchSelection;
    benchNote = empty.benchNote;
    craftView = empty.craftView;
    inspectedEnemy = empty.inspectedEnemy;
  }
  $effect(() => {
    if (benchSelection && !bench) {
      benchSelection = null;
      benchNote = 'The selected piece left this source. Choose it again before crafting.';
    }
  });

  function selectBench(where: Where, index: number) {
    const item = gameState[where][index];
    benchSelection = item ? { where, item } : null;
    benchNote = '';
  }

  function craftThisItem(selection: ItemSelection) {
    const current = resolveItemSelection(gameState, selection);
    if (!current) { equipNote = 'That piece is no longer in this source.'; return; }
    if (!atSettlement(gameState)) { saveNote = 'Craft is a settlement service — walk or warp into one first.'; return; }
    const sourceTab = current.where === 'bag' ? 'inventory' : 'equipped';
    const entry = gearEntry(current.item, current.index);
    const query = craftView.bagQuery.trim().toLowerCase();
    const visible = !query || `${entry.title} ${entry.slot} ${entry.sub}`.toLowerCase().includes(query);
    craftView = {
      ...craftView,
      sourceTab,
      bagQuery: sourceTab === 'inventory' && !visible ? '' : craftView.bagQuery,
      stashItem: sourceTab === 'inventory' ? null : craftView.stashItem,
      reveal: { where: current.where, item: current.item },
    };
    benchSelection = { where: current.where, item: current.item };
    benchNote = '';
    sheetOpen = false;
    more = false;
    panel = 'craft';
  }

  let forgeNote = $state('');
  let forgeResultItem = $state<string | null>(null);

  function runForge(kind: ForgeKind, id: string, materialId: string, expected?: { held: number; freeSlots: number }) { return __economy.runForge(kind, id, materialId, expected); }

  function runSalvage(index: number) {
    if (!transactionWriter) { forgeNote = 'This tab is read-only.'; return false; }
    const piece = gameState.bag[index];
    if (!piece) { forgeNote = 'That piece already left the bag'; return false; }
    const r = salvageAtSmith(gameState, index);
    forgeNote = r.ok ? 'That piece dissolved — Iron Ore and Scrap entered the resources' : `Cannot salvage: ${r.why}`;
    gameState = { ...gameState };
    return r.ok;
  }

  function runCraft(op: CraftOp, lineIndex: number, pick?: string) { return __economy.runCraft(op, lineIndex, pick); }

  let skillNote = $state('');
  let farmNote = $state('');
  let farmTab = $state<'plots' | 'alchemy' | 'automation'>('plots');
  const fl = $derived(farmLevel(gameState));
  const plots = $derived(plotCount(gameState));

  function doPlant(i: number, tier: string) { return __field.doPlant(i, tier); }

  function doHarvest(i: number) { return __field.doHarvest(i); }

  function doBrew(name: string) { return __field.doBrew(name); }

  function doDrink(name: string) { return __field.doDrink(name); }

  function useQuickSlot(i: number) { return __field.useQuickSlot(i); }

  function doCondense(name: string) { return __field.doCondense(name); }

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
        expected: buyExpectation(town?.id ?? '', row),
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
        ? `${town?.name ?? 'the field'} · safe in town — walk out to hunt`
        : pickedCell ? `${pickedCell.key} · ${pickedCell.label}` : `${town?.name ?? 'the field'} · trade, board, hunt, walk`);

  function doDeposit(i: number, tab: number) { return __economy.doDeposit(i, tab); }

  function doWithdraw(tab: number, i: number) { return __economy.doWithdraw(tab, i); }

  function takeStashForCraft(tab: number, index: number): boolean { return __economy.takeStashForCraft(tab, index); }

  function storeCraftPiece(index: number, tab: number): boolean { return __economy.storeCraftPiece(index, tab); }

  function doDepositAll(tab: number) { return __economy.doDepositAll(tab); }

  function doWithdrawAll(tab: number) { return __economy.doWithdrawAll(tab); }

  function toggleLock(item: Item) {
    if (!requireAccountWriter('locking or unlocking gear')) return;
    item.locked = !item.locked;
    gameState = { ...gameState };
  }



  function doSwitchPreset(i: number) { return __field.doSwitchPreset(i); }

  function doStorePreset() { return __field.doStorePreset(); }

  function doBind(i: number) { return __field.doBind(i); }

  function doTurnIn() { return __economy.doTurnIn(); }
  /** Where the feet are or are heading, in the name the player acts on: a settlement's own for its ground, the zone's
   *  for everything else. The rest read and the empty field both answer to it, so neither can name the
   *  wrong place for the same ground. */
  const placeRead = $derived.by(() => {
    if (gameState.walk) return `To ${walkNote(gameState)}`;
    if (gameState.cell?.sub != null) return zone.subzones?.[gameState.cell.sub]?.name ?? 'Sub-zone';
    if (gameState.cell?.site != null) return gameState.cell.site === 'dungeon' ? 'Wild Side · Dungeon'
      : gameState.cell.site === 'mine' ? 'Wild Side · Mine'
        : gameState.cell.site === 'grove' ? 'Wild Side · Grove' : 'Wild Side · Fishing';
    if (townLive) return town?.name ?? 'Settlement';
    const nearest = settlementById(ownerOf(currentCell(gameState)).id);
    return nearest ? `Open ground · ${nearest.name}` : 'Open field';
  });
  const showPlaceRead = $derived(placeRead.trim().toLocaleLowerCase() !== zone.name.trim().toLocaleLowerCase());

  /** What the field is doing, said as it is. The client never prints a fight that is not running: an empty
   *  field names the clock that will fill it, and ground that fields nothing names the action that would. */
  const phaseRead = $derived.by(() => {
    if (gameState.phase === 'camp') {
      return `Recovering at Camp · ${Math.max(0, Math.ceil(gameState.campSec))}s`;
    }
    if (gameState.walk) return 'Traveling…';
    if (fieldCampHere) return 'At Camp · safe ground';
    if (fieldworkSite && fieldworkSite !== 'hunt' && !gameState.dungeon) return 'Wild Side · safe ground';
    if (!gameState.hunting) return townLive ? 'At town · safe ground' : 'At rest';
    if (!fieldInFight(gameState)) return 'Hunting · waiting for a pull';
    return `Fighting · ${c.hitsPerSec.toFixed(2)} hits/s`;
  });

  const ownedAuras = $derived(sm.of('aura').filter((k: any) => gameState.skills.owned[k.id] != null));
  /** The reservation reads go through `c.keystones`: 54 moves an aura to HP and 64 discounts each one. */
  const reserved = $derived(reservedPct(gameState.skills, c.keystones));


  const __economy = createEconomyCommands({
    get gameState() { return gameState; },
    set gameState(value) { gameState = value; },
    get saveNote() { return saveNote; },
    set saveNote(value) { saveNote = value; },
    get transactionWriter() { return transactionWriter; },
    get town() { return town; },
    get marketTownId() { return marketTownId; },
    get marketSale() { return marketSale; },
    set marketSale(value) { marketSale = value; },
    requireAccountWriter,
    get bench() { return bench; },
    get benchSelection() { return benchSelection; },
    set benchSelection(value) { benchSelection = value; },
    get benchNote() { return benchNote; },
    set benchNote(value) { benchNote = value; },
    get townNote() { return townNote; },
    set townNote(value) { townNote = value; },
    get forgeNote() { return forgeNote; },
    set forgeNote(value) { forgeNote = value; },
    get forgeResultItem() { return forgeResultItem; },
    set forgeResultItem(value) { forgeResultItem = value; },
    get viewColSet() { return viewColSet; },
    fmtNum: (n) => fmtNum(n),
    questBonusText: (bonus) => questBonusText(bonus),
    resolveItemSelection: (game, selection) => resolveItemSelection(game, selection),
    refreshSelectionAfterRepair: (game, selection, target, where, index) => refreshSelectionAfterRepair(game, selection, target, where, index),
  });

  function setSlot(i: number, id: string) { return __field.setSlot(i, id); }

  function setMode(id: string, mode: string) { return __field.setMode(id, mode); }

  function setAutoMode(id: string, mode: 'auto' | 'manual' | 'both') { return __field.setAutoMode(id, mode); }

  function setCond(id: string, patch: Partial<SkillConditions>) { return __field.setCond(id, patch); }

  function finalResistance(el: string): number {
    return Math.min(c.resCap, c.resistance + (c.resByElement?.[el] || 0));
  }

  function doMoveSlot(from: number, to: number) { return __field.doMoveSlot(from, to); }

  /** …and the one flag a row can meaningfully wait on: the status its own Element applies, or the curse
      it writes. A row that carries neither is offered no such leg — the old list of every flag in the
      game asked the player to tick lines that could never fire for the row in front of them. */
  function rowFlag(id: string | null): { key: string; label: string } | null {
    const skill = id ? sm.byId[id] : null;
    const status = appliedStatusOf(skill);
    if (status) return { key: status, label: status };
    return appliedCurseOf(skill) ? { key: skill!.id, label: skill!.name ?? '' } : null;
  }
  /** The status a payoff row reads, named once on its own effect — the same source the sim reads. */
  function rowExploitFlag(id: string | null): { key: string; label: string } | null {
    const skill = id ? sm.byId[id] : null;
    const status = sm.exploitedStatusOf(skill);
    return status ? { key: status, label: status } : null;
  }
  /** A row with no cooldown of its own is the FILLER: the rotation gives it the press only after every
      timed slot has had its chance, so its place in the order is not what decides when it fires. */
  const slotFiller = (id: string | null): boolean => Boolean(id) && (sm.byId[id!] as any)?.cd === 0;
  function stonesLine(): string {
    const held = Object.entries(gameState.counters.stones).filter(([, n]) => (n as number) > 0);
    if (!held.length) return 'no stones yet';
    return held.map(([k, n]) => `${stoneName(k)} ${n}`).join(' · ');
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

  function toggle(id: string) { return __field.toggle(id); }

  function chooseAuraPool(id: string, pool: 'hp' | 'mana') { return __field.chooseAuraPool(id, pool); }

  function disableAllAuras() { return __field.disableAllAuras(); }
  const __field = createFieldCommands({
    get gameState() { return gameState; },
    set gameState(value) { gameState = value; },
    get saveNote() { return saveNote; },
    set saveNote(value) { saveNote = value; },
    get skillNote() { return skillNote; },
    set skillNote(value) { skillNote = value; },
    get farmNote() { return farmNote; },
    set farmNote(value) { farmNote = value; },
    get transactionWriter() { return transactionWriter; },
    get fieldCellName() { return fieldCellName; },
    get viewHere() { return viewHere; },
    get c() { return c; },
    get ownedAuras() { return ownedAuras; },
    get travelScene() { return travelScene; },
    set travelScene(value) { travelScene = value; },
    get running() { return running; },
    set running(value) { running = value; },
    get showcaseMode() { return showcaseMode; },
    get panel() { return panel; },
    set panel(value) { panel = value; },
    requireAccountWriter,
    rowFlag: (id) => rowFlag(id),
    rowExploitFlag: (id) => rowExploitFlag(id),
  });
  const __travel = createTravelCommands({
    get gameState() { return gameState; },
    set gameState(value) { gameState = value; },
    get saveNote() { return saveNote; },
    set saveNote(value) { saveNote = value; },
    get picked() { return picked; },
    set picked(value) { picked = value; },
    get pickedCell() { return pickedCell; },
    set pickedCell(value) { pickedCell = value; },
    get panel() { return panel; },
    set panel(value) { panel = value; },
    get travelScene() { return travelScene; },
    set travelScene(value) { travelScene = value; },
    get showcaseMode() { return showcaseMode; },
    get running() { return running; },
    set running(value) { running = value; },
    get transactionWriter() { return transactionWriter; },
    requireAccountWriter,
  });

</script>

<svelte:window onkeydown={onfieldKey} onkeyup={onfieldKeyUp} onblur={clearWasd} onpointerup={releaseArenaPointer} onpointercancel={releaseArenaPointer} />

<svelte:head><title>{showcaseMode ? 'ModWorld UI Showcase' : 'ModWorld'}</title></svelte:head>

{#if offlineProgress}
  <Panel title="Loading offline progress" subtitle="All elapsed time is credited · no offline time limit" gridArea={modalGridArea} onclose={cancelOfflineLoad}>
    <p>{offlineProgress.total ? `${offlineProgress.done.toLocaleString()} / ${offlineProgress.total.toLocaleString()} seconds simulated` : 'Reading your saved character…'}</p>
    <progress aria-label="Offline seconds simulated" value={offlineProgress.done} max={Math.max(1, offlineProgress.total)}></progress>
    <p>Long absences are processed in order. Cancelling leaves the saved slot untouched.</p>
    <button onclick={cancelOfflineLoad}>Cancel loading</button>
  </Panel>
{/if}
<div class="showcase-frame" class:active={showcaseMode} inert={offlineProgress !== null}>
{#if showcaseMode}
  <header class="showcase-banner">
    <div>
      <h1>UI Showcase</h1>
      <p>Live game components · sample state · changes to source UI appear here through Vite HMR</p>
      <label>Gameplay sample <select aria-label="Gameplay sample" value={showcaseSample} onchange={(event) => {
        applyShowcaseSample(event.currentTarget.value);
      }}>
        {#each SHOWCASE_SAMPLES as sample}
          <option value={sample}>{SHOWCASE_SAMPLE_LABELS[sample]}</option>
        {/each}
      </select></label>
    </div>
    <a href="/">Return to the game</a>
  </header>
  {#if arenaPreview}
    <div class="arena-preview-controls">
      <strong>Forest clearing</strong>
      <div class="arena-command-controls" role="group" aria-label="Local combat commands">
        <button class="btn btn-quiet" type="button" onclick={() => focusArenaEnemy()} disabled={!arenaLiving().length}>
          {arenaFocusId ? 'Next focus' : 'Focus enemy'}
        </button>
        <button class="btn btn-quiet" type="button" onclick={clearArenaFocus} disabled={!arenaFocusId}>Clear focus</button>
        <button class="btn btn-quiet" type="button" aria-pressed={!!arenaAimSkill} onclick={toggleArenaAim}>
          {arenaAimSkill ? 'Cancel aim' : `Aim ${sm.byId[activeArenaSkillId() ?? '']?.name ?? 'skill'}`}
        </button>
        <button class="btn btn-quiet" type="button"
          onpointerdown={(event) => {
            if (sm.byId[activeArenaSkillId() ?? '']?.action?.kind !== 'ray-channel') return;
            event.currentTarget.setPointerCapture(event.pointerId);
            castArenaAtFocus(`pointer:${event.pointerId}`);
          }}
          onkeydown={(event) => {
            if (sm.byId[activeArenaSkillId() ?? '']?.action?.kind !== 'ray-channel'
              || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            if (!event.repeat) castArenaAtFocus(`key:${event.code}`);
          }} onclick={() => {
            if (sm.byId[activeArenaSkillId() ?? '']?.action?.kind !== 'ray-channel') castArenaAtFocus();
          }} disabled={!arenaLiving().length}>
          Cast at focus
        </button>
      </div>
      {#if arenaPreview}
        <label>World scale <input type="range" aria-label="World scale in the arena"
          min={ARENA_ZOOM_MIN} max={ARENA_ZOOM_MAX} step={ARENA_ZOOM_STEP} bind:value={arenaWorldScale} />
          <output>{Math.round(arenaWorldScale * 100)}%</output></label>
        <label>Mob rendering <select aria-label="Mob rendering mode in the arena" value={spritePreviewMode ? 'sprite' : 'fallback'} onchange={(event) => {
          setArenaSpriteMode(event.currentTarget.value);
        }}>
          <option value="sprite">Sprite animations</option>
          <option value="fallback">Fallback icons</option>
        </select></label>
      {/if}
      {#if spritePreviewMode}
        <label>Species <select value={arenaSpecies} onchange={(event) => {
          arenaSpecies = event.currentTarget.value;
          arenaVariantKey = null;
          const url = new URL(window.location.href);
          url.searchParams.set('sprite-species', arenaSpecies);
          url.searchParams.delete('sprite-variant');
          window.history.replaceState(null, '', url);
          replayArena();
        }}>
          <optgroup label="ARPG mob animations">
            {#each ARENA_MOB_SPECIES as speciesId}
              <option value={speciesId}>{eng.speciesById(speciesId).name}</option>
            {/each}
          </optgroup>
          {#if ARENA_ADDITIONAL_VARIANT_SPECIES.length}
            <optgroup label="Other variant species">
              {#each ARENA_ADDITIONAL_VARIANT_SPECIES as species}
                <option value={species.speciesId}>{species.speciesName}</option>
              {/each}
            </optgroup>
          {/if}
          <optgroup label="Existing previews">
            <option value="spear-goblin">Spear Goblin reference</option><option value="little-demon">Little Demon reference</option>
            <option value="skeleton-sword">Skeleton (Sword &amp; Shield) reference</option><option value="skeleton-bone">Skeleton (Original Bone) reference</option><option value="crypt-wraith">Crypt Wraith reference</option>
            <option value="shadow-wolf">Shadow Wolf reference</option><option value="eclipse-wisp">Eclipse Wisp reference</option><option value="pixiblop-spider">Pixiblop Spider reference</option><option value="stone-golem">Stone Golem reference</option>
          </optgroup>
        </select></label>
        <label>Named variant <select aria-label="Named variant animation preview" value={arenaVariantKey ?? ''} onchange={(event) => {
          const selectedKey = event.currentTarget.value || null;
          arenaVariantKey = selectedKey;
          const variant = selectedKey ? ARENA_VARIANT_PREVIEW_BY_KEY.get(selectedKey) : null;
          if (variant) arenaSpecies = variant.speciesId;
          const url = new URL(window.location.href);
          if (variant) {
            url.searchParams.set('sprite-species', variant.speciesId);
            url.searchParams.set('sprite-variant', variant.key);
          } else {
            url.searchParams.set('sprite-species', arenaSpecies);
            url.searchParams.delete('sprite-variant');
          }
          window.history.replaceState(null, '', url);
          replayArena();
        }}>
          <option value="">Species animation</option>
          {#each ARENA_VARIANT_GROUPS as group}
            <optgroup label={group.speciesName}>
              {#each group.variants as variant}
                <option value={`${group.speciesId}/${variant.variantId}`}>{variant.name}</option>
              {/each}
            </optgroup>
          {/each}
        </select></label>
      {/if}
      <label>Skill <select aria-label="Skill cast in the arena" value={arenaSkillId} onchange={(event) => {
        arenaSkillId = event.currentTarget.value;
        arenaVersionId = activeVfxVersionId(arenaSkillId) ?? '';
        arenaAimSkill = null;
        arenaManual.cast = undefined;
        const url = new URL(window.location.href);
        url.searchParams.set('skill', arenaSkillId);
        window.history.replaceState(null, '', url);
        replayArena();
      }}>
        {#each ['attack', 'curse', 'heal', 'buff', 'aura'] as kind}
          <optgroup label={kind}>
            {#each combatFxSkills.filter((skill: any) => skill.type === kind) as skill}
              <option value={skill.id}>{skill.name}</option>
            {/each}
          </optgroup>
        {/each}
      </select></label>
      {#if arenaVersions.length}
        <label>VFX version <select aria-label="Preview VFX version in the arena" value={arenaVfxMode === 'base' ? 'base' : `version:${arenaVersionId}`} onchange={(event) => {
          chooseArenaVersion(event.currentTarget.value);
        }}>
          <option value="base">Base VFX (no skin)</option>
          {#each arenaVersions as version (version.id)}
            <option value={`version:${version.id}`}>{version.label}</option>
          {/each}
          {#if !arenaVersions.some((version) => version.id === arenaVersionId)}
            <option value={`version:${arenaVersionId}`}>Selected</option>
          {/if}
        </select></label>
      {/if}
      <button class="btn btn-quiet" type="button" onclick={replayArena}>Replay encounter</button>
    </div>
  {/if}
  {#if showcaseSample === 'combat-fx'}
    <div class="combat-fx-preview-controls">
      <label><input type="checkbox" checked={animateCombatFx} onchange={(event) => {
        if (event.currentTarget.checked) replayCombatFx(); else showCombatFxLabels();
      }} /> Animate combat effects</label>
      <label>Combat effect preview <select aria-label="Combat effect preview" value={combatFxPreview} onchange={(event) => {
        combatFxPreview = event.currentTarget.value as CombatFxPreview;
        if (animateCombatFx) replayCombatFx(); else showCombatFxLabels();
      }}>
        <option value="swing">Weapon swing</option>
        <option value="critical">Critical hit</option>
        <option value="fire">{previewFire?.name || 'Fire skill'}</option>
        <option value="lightning">{previewLightning?.name || 'Lightning skill'}</option>
        <option value="heal">{previewHeal?.name || 'Heal skill'}</option>
        <option value="block">Block</option>
        <option value="lethal">Killing blow</option>
        <option value="rapid">Rapid sequence</option>
        <option value="aoe">{previewArea?.name || 'Area skill'} · 3 targets</option>
        <option value="exchange">Simultaneous exchange</option>
        <option value="miss">Missed skill</option>
        <option value="sizes">Small · Large · Boss</option>
        <option value="boss">Boss skill</option>
        <option value="skill">Chosen skill · all roster</option>
      </select></label>
      <label>Skill <select aria-label="Skill effect" value={combatFxSkillId} onchange={(event) => {
        combatFxSkillId = event.currentTarget.value;
        combatFxPreview = 'skill';
        if (animateCombatFx) replayCombatFx(); else showCombatFxLabels();
      }}>
        {#each ['attack', 'curse', 'heal', 'buff', 'aura'] as kind}
          <optgroup label={kind}>
            {#each combatFxSkills.filter((skill: any) => skill.type === kind) as skill}
              <option value={skill.id}>{skill.name}</option>
            {/each}
          </optgroup>
        {/each}
      </select></label>
      <button onclick={replayCombatFx}>Replay combat effect</button>
      <span>Sample effects only · game progress stays unchanged · replay restores the encounter</span>
    </div>
  {/if}
  <nav class="showcase-index" aria-label="Showcase sections">
    <a href="#showcase-field">Field HUD</a>
    <a href="#panel-hud-layout-studio">HUD Layout</a>
    <a href="#panel-character-sheet">Sheet</a>
    <a href="#panel-inventory">Inventory</a>
    <a href="#panel-craft">Craft</a>
    <a href="#panel-skills">Skills</a>
    <a href="?sample=combat-field">Combat field</a>
    <a href="#panel-passive-tree">Tree</a>
    <a href="#panel-town">Town</a>
    <a href="#panel-market">Market</a>
    <a href="#panel-delivery-notice">Delivery notice</a>
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

<div id={showcaseMode ? 'showcase-field' : undefined} class="stage" style={`grid-template-areas:${hudLayoutAreas};`} class:showcase={showcaseMode} class:arpg-arena={arenaMode && panel !== 'map'} class:combat-field-sample={arenaPreview} class:combat-fx-sample={showcaseMode && showcaseSample === 'combat-fx'} class:combat-fx-live={showcaseMode && showcaseSample === 'combat-fx' && animateCombatFx} class:fighting={inCombat} class:mapmode={panel === 'map'} class:veiled={!showcaseMode && ((panel !== null && panel !== 'map') || sheetOpen)} class:townmode={townLive && panel !== 'map'}>
  {#if arenaMode && panel !== 'map'}
    <CombatArenaScene arena={combatArena} s={gameState} {c} {ring} {speed} paused={!running || paused}
      frame={arenaFieldFrame} onStageCss={(size) => { arenaStageCss = size; }}
      groundMaterialOverride={showcaseMode && showcaseSample === 'rimworld-field' ? arenaGroundMaterials.forest : null}
      inspect={arenaPreview} onReviewPause={() => { running = false; }}
      onReviewStep={() => {
        running = false;
        const batch = schedulerSteps(0, 1, 1, COMBAT_STEP_US() / 1_000_000);
        for (let index = 0; index < batch.steps; index++) step();
      }}
      spritePreviewSpecies={spritePreviewMode ? arenaSpecies : null}
      spritePreviewVariant={spritePreviewMode && activeArenaVariant ? { speciesId: activeArenaVariant.speciesId, variantId: activeArenaVariant.variantId } : null}
      aoePreview={showcaseMode && showcaseQuery.get('aoe-preview') === '1'}
      iconActors={showcaseMode && !spritePreviewMode}
      focusId={arenaFocusId}
      aimSkill={arenaAimSkill}
      keyboardAim={arenaAimPoint}
      effectLevel={settings.combatEffects || 'auto'}
      vfxMode={arenaVfxMode}
      onAimPoint={(point) => { arenaAimPoint = point; }}
      onVitals={(vitals) => arenaVitals = vitals} onTargetRead={(read) => arenaTargetRead = read} onInspectEnemy={(mob) => inspectedEnemy = snapshotEnemy(mob)}
      onFocusEnemy={(mob) => focusArenaEnemy(mob.id)} onGroundCommand={issueArenaGroundCommand} />
  {/if}
  <!-- one generated map sheet behind the HUD — the only copy, and the surface a place is picked on -->
  <WorldMap
    bind:this={worldMap}
    markup={mapMarkup}
    state={gameState}
    selected={pickedCell}
    bind:camera={mapCamera}
    options={mapOptions}
    interactive={panel === 'map' || (panel === null && !sheetOpen)}
    visible={true}
    announcement={pickedCell ? `Selected block ${pickedCell.key}: ${pickedCell.label}${journeySignals.length ? ' · ' + journeySignals.map(signal => signal.label).join(' · ') : ''}` : ''}
    onintent={handleMapIntent}
    oncells={(cells) => (mapCells = cells)}
  />

  {#if plates.length && !arenaMode}
    {@const front = plates[0]}
    <div class="targetbar" style={place('target')}>
      <p class="target-name">{fieldLabel(front)} <span>{front.kind}</span></p>
      <div class="target-hp">
        <i style={bar(front.hp, front.hpMax)}></i>
        <b>{Math.max(0, Math.round(front.hp))} / {Math.round(front.hpMax)}</b>
      </div>
    </div>
  {/if}
  {#if arenaMode && panel !== 'map'}
    <!-- F37 — one persistent read over a live fight: committed strike, requested focus or next
      body, never mixed with hover or the inspector's own panel. -->
    <div class="targetbar" style={place('target')} aria-label="Arena target">
      {#if arenaTargetRead}
        {@const readMob = gameState.group.find((mob) => mob.id === arenaTargetRead!.id)}
        {@const kindLabel = arenaTargetRead.kind === 'committed' ? 'Committed' : arenaTargetRead.kind === 'focus' ? 'Focus' : 'Next'}
        {#if readMob}
          <p class="target-name">{fieldLabel(readMob)} <span>{kindLabel}{readMob.kind ? ` · ${readMob.kind}` : ''}</span></p>
          <div class="target-hp">
            <i style={bar(readMob.hp, readMob.hpMax)}></i>
            <b>{Math.max(0, Math.round(readMob.hp))} / {Math.round(readMob.hpMax)}</b>
          </div>
          {#if arenaTargetRead.offscreen}
            <p class="target-range"><span class="offscreen-arrow" style={`--bearing:${arenaTargetRead.bearingDeg.toFixed(1)}deg`} aria-hidden="true">➤</span> offscreen · {arenaTargetRead.rangeM.toFixed(0)} m</p>
          {:else}
            <p class="target-range text-dim">{arenaTargetRead.rangeM.toFixed(0)} m</p>
          {/if}
        {:else}
          <p class="target-name">Scanning… <span>no live target</span></p>
        {/if}
      {:else}
        <p class="target-name">Scanning… <span>no live target</span></p>
      {/if}
    </div>
  {/if}

  {#snippet journeyTools()}
    <MapJourney state={gameState} bind:expanded={journeyToolsOpen} writable={transactionWriter} onSelect={locateMapHex}
      onEncounter={doCampEncounter} onPolicy={doCampPolicy} />
  {/snippet}

  <section class="journey-dock" data-hud-region="objectives" aria-label="Journey" style={place('objectives')}>
    <div class="journey-panel surface-hud" class:expanded={journeyExpanded} bind:this={journeyPanelEl}>
      <header class="journey-header">
        <div class="journey-title">
          <CollapseToggle label="Journey" controls="journey-body" bind:expanded={journeyExpanded} />
          {#if panel === 'map'}
            <button class="btn btn-quiet" type="button" aria-expanded={journeyExpanded && mapControlsOpen} aria-controls="journey-map-controls"
                    onclick={() => { mapControlsOpen = !journeyExpanded || !mapControlsOpen; journeyExpanded = true; journeyBodyEl?.scrollTo({ top: 0 }); }}>Controls</button>
          {:else}
            <button class="btn btn-quiet" type="button" onclick={() => togglePanel('map')}>Map</button>
          {/if}
        </div>
        <div class="journey-location">
          <img class="icon-label" src={waypointMark} alt="" aria-hidden="true" />
          <strong>{zone.name}</strong><span class="journey-level">Lv {zone.levels[0]}–{zone.levels[1]}</span>
        </div>
        {#if showPlaceRead}<p class="text-note journey-place">{placeRead}</p>{/if}
        <p class="journey-status">{phaseRead}</p>
        {#if gameState.walk}
          <p class="text-note journey-place">{gameState.walk.legs.length - gameState.walk.stepIndex} blocks left · next hex in {Math.max(0, Math.ceil(gameState.walk.secLeft))}s</p>
        {/if}
      </header>
      {#if skillDiscoveryId && !awayReport}
        <SkillDiscovery id={skillDiscoveryId} oninspect={() => inspectSkill(skillDiscoveryId!)} ondismiss={() => skillDiscoveryId = null} />
      {/if}
      <div class="journey-alerts">
        <JourneyNotices notices={journeyNotices} onaction={runNoticeAction} />
        {#if gameState.dungeon}<button class="btn btn-quiet" type="button" onclick={doRetreat} disabled={!transactionWriter}>Retreat · rescue {E.dungeon.retreat_keep_min}–{E.dungeon.retreat_keep_max} random stacks</button>{/if}
      </div>
      <div id="journey-body" class="journey-body scroll-pane" hidden={!journeyExpanded} bind:this={journeyBodyEl}>
        {#if journeySignals.length}
          <details class="journey-map-signals">
            <summary>Map signals · {journeySignals.length}</summary>
            <ul>
              {#each journeySignals as signal (signal.cls + signal.label)}
                <li><img class="icon-label" src={signal.icon.href} alt="" aria-hidden="true" /><span>{signal.label}</span></li>
              {/each}
            </ul>
          </details>
        {/if}
        {#if gameState.fieldwork.campEncounters.active}{@render journeyTools()}{/if}
        {#if panel === 'map'}
          <section id="journey-map-controls" class="journey-map-controls" aria-label="Map controls" hidden={!mapControlsOpen}>
            <div class="map-tools">
              <div class="map-display" role="group" aria-label="Map display settings">
                <button class="btn btn-quiet map-clean-toggle" type="button" aria-pressed={cleanMap}
                        onclick={() => setSetting('cleanMap', !cleanMap)} title="Show coloured hexes with terrain artwork and scenery hidden">Clean map</button>
              </div>
              <div role="group" aria-label="Map zoom" class="map-zoom">
                <button class="btn btn-quiet btn-icon" type="button" onclick={() => worldMap?.zoomBy(1 / 1.25)} aria-label="Zoom out" title="Zoom out">−</button>
                <output class="text-note" aria-label="Map zoom level" aria-live="polite">{Math.round((mapCamera.zoom / MAP_BASE_ZOOM) * 100)}%</output>
                <button class="btn btn-quiet btn-icon" type="button" onclick={() => worldMap?.zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">+</button>
                <button class="btn btn-quiet" type="button" onclick={() => worldMap?.centerOnPlayer()} title="Centre on your current settlement">Centre</button>
                <button class="btn btn-quiet" type="button" onclick={() => worldMap?.resetCamera()} title="Restore the default map position and zoom">Reset</button>
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
                <label title="Show area names; towns always, subzones only when zoomed close, sites and levels on hover/select"><input type="checkbox" checked={showMapNames} disabled={cleanMap} aria-describedby={cleanMap ? 'clean-map-names-note' : undefined} onchange={event => setMapNames(event.currentTarget.checked)} /> Area names</label>
                <label title="Show walking connections between settlements"><input type="checkbox" bind:checked={showWalk} /> Connections</label>
                <label title="Show hex cell identifiers"><input type="checkbox" bind:checked={showIds} /> Cell IDs</label>
                {#if import.meta.env.DEV}<label title="Compare artwork with the exact projected ground footprint"><input type="checkbox" bind:checked={showHexCalibration} /> Hex alignment</label>{/if}
              </div>
              {#if cleanMap}<p id="clean-map-names-note" class="map-hint text-note">Clean map shows hex colours. Select a hex for its details.</p>{/if}
              <p class="map-hint text-note">North is up · Select a hex · Drag to pan · Scroll to zoom</p>
              {#if gameState.walk}
                <p class="map-hint text-note">Traveling to <b>{walkNote(gameState)}</b>.</p>
              {/if}
            </div>
            <details class="map-tools-section" name="map-tools-sections">
              <summary><span>Map key</span><span class="icon-mask map-tools-chevron" style={`--glyph:url(${chevronDownGlyph})`} aria-hidden="true"></span></summary>
              <div class="map-legend text-note">
                {#each legend as l (l.name)}<span class="swatch"><i class="swatch-color" style:background={l.tone} aria-hidden="true"></i><span>{l.label}</span></span>{/each}
                <span class="swatch ramp"><i class="swatch-color" style:background={`linear-gradient(90deg,${rampCss})`} aria-hidden="true"></i><span>Lv {firstBand[0]}–{lastBand[1]}</span></span>
                <div class="map-icon-legend">
                  {#each MAP_ICON_LEGEND as mark (mark.name)}
                    <span><img class="icon-label" src={mark.href} alt="" aria-hidden="true" />{mark.label}</span>
                  {/each}
                </div>
                <p>Icons inside each hex show its places, known creatures and activity. Select a hex for details.</p>
              </div>
            </details>
          </section>
          {#if journeySettlement && journeyDest && journeyPrimary}
            <TravelCard selected={!!pickedCell}
              settlement={journeySettlement}
              dest={journeyDest}
              primary={journeyPrimary}
              intel={journeyIntel}
              onSetCamp={doEstablishCamp}
              notice={saveNote}
              writable={transactionWriter}
              campHere={journeyDest.self && fieldCampHere}
              busy={!!gameState.walk || gameState.phase === 'camp'}
              fightActive={inCombat}
              warpReason={journeyWarp?.reason ?? ''}
              fare={journeyWarp?.fare ?? 0}
              afford={journeyWarp?.afford ?? false}
              dungeon={dungeonView}
              lastEvent={gameState.mapJournal?.lastEvent ?? null}
              dungeonReceipt={gameState.lastDungeonReceipt ?? null}
              onprimary={activateJourneyDestination}
              onwarp={travelTo}
              onclear={clearMapSelection}
              oncampui={() => (panel = 'camp')}
              ontrack={pinJourneyDestination}
              goalPinned={isJourneyPinned()}
            />
          {/if}
        {/if}
        {#if !gameState.fieldwork.campEncounters.active}{@render journeyTools()}{/if}
      </div>
    </div>
  </section>
  {#if latestLevel}
    <!-- one-shot level rise: decoration to a reader, nothing to a keyboard -->
    {#key latestLevel.id}
      <p class="levelup" style={`--fx:${latestLevel.colour}`} aria-hidden="true">{latestLevel.text}</p>
    {/key}
  {/if}

  {#if awayReport}
    <ProgressRecap report={awayReport} treePoints={gameState.player.treePoints}
      bagUsed={slotsUsed(gameState)} bagCapacity={slotsAvailable(gameState)} {fmtNum}
      ondismiss={() => awayReport = null} ontree={() => revealPanel('tree')}
      onskills={() => revealPanel('skills')} onbag={() => { invTab = 'inv'; revealPanel('bag'); }} />
  {/if}

  <!-- contextual overlays stay on the right edge and appear only while open. -->
  <div class="commands-dock"
       style={place('commands', '100%', 'fit-content')}>
    <div class="hud-slide-handle" title={`×${speed} · Auto Skills ${settings.autoSkills !== false ? 'ON' : 'OFF'} · Auto Equip ${settings.autoEquip !== false ? 'ON' : 'OFF'} · Auto Avoid ${settings.autoAvoid !== false ? 'ON' : 'OFF'} · ${running ? 'Running' : 'Paused'}`}>
      <CollapseToggle label="Game controls" direction="right"
        controls="game-controls" bind:expanded={controlsExpanded} />
    </div>
    <div id="game-controls" class="command-row game-controls-row hud-slide-content" class:collapsed={!controlsExpanded}
         role="group" aria-label="Game controls" aria-hidden={!controlsExpanded} inert={!controlsExpanded}>
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
    <button type="button" class="hub-control" class:here={settings.autoAvoid !== false} aria-pressed={settings.autoAvoid !== false}
            title={`Auto avoid · ${settings.autoAvoid === false ? 'off — the feet hold unless you move them' : 'on — steps out of telegraphed ground'}`}
            onclick={() => setSetting('autoAvoid', settings.autoAvoid === false)}>
      <span class="toggle-ring" class:here={settings.autoAvoid !== false}>
        <img src={autoAvoidMark} alt="" aria-hidden="true" />
      </span>
      <span class="cap">Auto Avoid</span>
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
          <span class="icon-mask" style={`--glyph:url(${running ? pauseGlyph : playGlyph})`} aria-hidden="true"></span>
        </span>

      <span class="cap">{running ? 'Pause' : 'Resume'}</span>
      </button>
    </div>
  </div>

  {#if saveNote && !(panel === 'map' && journeyExpanded && journeyDest)}
    <span class="toast notice-toast text-good save-note">{saveNote}</span>
  {/if}

  <!-- cast order, one orb per slot; read-only here — arranging is the Skills sub-screen's job -->
  <div class="actionbar" use:orbMotion style={place('actionbar', '100%', 'auto')}>
    <div class="action-cluster">
      <div class="vital-stack">
        <div class="vital-orb life-orb" style={`--shield-strength:${esFill.toFixed(3)}`}
             role="img" aria-label={`HP ${fmtNum(ariaHp)} of ${fmtNum(c.maxHp)}${hpBanked > 0 ? `, ${fmtNum(hpUsable)} usable and ${fmtNum(hpBanked)} reserved` : ''}${c.es > 0 ? `, ES ${fmtNum(ariaEs)} of ${fmtNum(c.es)}` : ''}`}>
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
            {#if hpBanked > 0}<span class="orb-reserved">{fmtNum(hpUsable)} usable · {fmtNum(hpBanked)} reserved</span>{/if}
            {#if c.es > 0}<span class="orb-shield"><strong>{fmtNum(shownEs)}</strong>/{fmtNum(c.es)} ES</span>{/if}
          </span>
        </div>
      </div>
      <div class="cast-stack">
      {#if arenaMode}<PlayerStatusRow statuses={gameState.playerStatuses} />{/if}
      <ActiveBuffs skills={gameState.skills} />
      <Quickbar quickbar={gameState.quickbar} potions={gameState.farm.potions} condensed={gameState.farm.condensed} writable={transactionWriter}
                bagIcon={hubIcon('bags', bagMark)} keyFor={(n) => keyFor('item.' + n)}
                onuse={useQuickSlot}
                oncyc={cycleQuickSlot}
                onassign={assignQuickSlot} />
      <div class="casts" role="list" aria-label="Skill bar">
      {#each gameState.skills.list as id, i}
        {@const k = id ? sm.byId[id] : null}
        {@const cd = id ? (gameState.skills.cd[id] || 0) : 0}
        {@const eff = id ? skillCd(gameState.skills, id, c.cdr) : 0}
        {@const cdVisual = Math.max(0, cd - cooldownVisualSeconds)}
        {@const frac = cdVisual > 0 && eff > 0 ? Math.max(0, Math.min(1, 1 - cdVisual / eff)) : 1}
        {@const when = id ? modeOf(gameState.skills, id) : 'always'}
        {@const filler = slotFiller(id)}
        {@const eligibility = id ? hudSkillEligibility(id) : null}
        {@const compact = id && k ? describeSkill(arenaPreview ? { ...k, cd: SHOWCASE_ARENA_CD_SEC } : k).compact : ''}
        {@const canCast = arenaMode && panel === null}
        {@const queued = !!id && canCast && arenaManual.cast?.skillId === id}
        {@const slotKey = i < 8 ? keyFor(`arena.slot.${i + 1}`) : ''}
        <span class="cast hud-slot" class:empty={!id || !k} class:ready={!!eligibility?.ready && running && !paused}
              class:paused={!running || paused} class:queued={queued}
              class:silent={when === 'never'} class:gated={when === 'conditional'} class:filler={filler}
              role="listitem"
              draggable={Boolean(id)}
              ondragstart={(e) => setCastDrag(e, { index: i })}
              ondragover={(e) => { if (id) e.preventDefault(); }}
              ondrop={(e) => { const f = readCastDrag(e); if (f && f.index !== i) doMoveSlot(f.index, i); }}
              title={`Slot ${i + 1}${id && k ? `: ${k.name} · ${compact} · ${eligibility?.label}${canCast ? ' · click to cast' : ''}` : ': empty'}`}>
          {#if id && k}
            <button class="cast-open" type="button"
              aria-label={canCast ? `${k.name}: ${eligibility?.label}. Cast.` : `${k.name}: ${eligibility?.label}. Open skill setup.`}
              aria-keyshortcuts={slotKey || undefined} aria-describedby={`skill-readiness-${i}`}
              onpointerdown={(event) => {
                if (!canCast || sm.byId[id]?.action?.kind !== 'ray-channel') return;
                event.currentTarget.setPointerCapture(event.pointerId);
                castArenaSlot(i, `pointer:${event.pointerId}`);
              }}
              onkeydown={(event) => {
                if (!canCast || sm.byId[id]?.action?.kind !== 'ray-channel'
                  || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                if (!event.repeat) castArenaSlot(i, `key:${event.code}`);
              }}
              onclick={() => {
                if (!canCast) inspectSkill(id);
                else if (sm.byId[id]?.action?.kind !== 'ray-channel') castArenaSlot(i);
              }}></button>
            <span class="cast-tooltip" id={`skill-readiness-${i}`} role="tooltip"><strong>{k.name} · {eligibility?.label}</strong><span>{eligibility?.detail}</span>{#if !running || paused}<span>Game paused.</span>{/if}</span>
            <img src={skillIcon(k.id, k.type)} alt="" aria-hidden="true" />
            {#if cd > 0}
              <span class="sweep" style={`--skill-cooldown-progress:${(frac * 100).toFixed(3)}%`} aria-hidden="true"></span>
              <small>{Math.max(1, Math.ceil(cdVisual))}</small>
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
             role="img" aria-label={`Mana ${fmtNum(ariaMana)} of ${fmtNum(c.maxMana)}${reserved > 0 ? `, ${reserved.toFixed(1)}% reserved by auras` : ''}`}>
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
            {#if reserved > 0}<span class="orb-reserved">RES {reserved.toFixed(1)}%</span>{/if}
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
  {#if showCombatCards && !arenaMode}
    <div class="field" class:clear={plates.length === 0}
         style:grid-area={gridAreaCss({ ...hudLayout.field.area, columnStart: 1, columnEnd: 15 }, true)}
         style:width={`${(hudLayout.field.area.columnEnd - hudLayout.field.area.columnStart + 1) / 15 * 100}%`}>
      <FieldPlates s={gameState} ring={ring} plates={plates} zone={zone} town={town} townLive={townLive} c={c}
                 vitals={{ hp: shownHp, es: shownEs, mana: shownMana }} statuses={gameState.playerStatuses} reserved={reserved}
                 onSheet={() => { sheetTab = 'stats'; sheetOpen = true; }} fmtNum={fmtNum}
                 plateMotion={plateMotion} fxOutMs={fxOutMs} selfFx={selfFx} {speed}
                 effectLevel={settings.combatEffects || 'auto'} onInspectEnemy={(enemy) => (inspectedEnemy = enemy)} />
    </div>

    <!-- the hit ring: sim events with no body of their own — hits over their plate, kills and drops here;
         every fx colour comes out of `engine.json` `elements`, never typed here -->
    <div class="floaters" aria-hidden="true">
      <div class="float-side field-side">
        {#each fieldFx as e (e.id)}
          <span class="fx fx-{e.kind}" class:crit={e.crit} class:pop={e.kind === 'drop'} class:pop-loot={e.kind === 'drop'} out:fxOut={{ ms: fxOutMs }} style="--fx:{e.colour}; --lane:{e.id % 7}">{e.text}</span>
        {/each}
      </div>
      {#if latestTaken && (speed <= 1 || importantCombatEvent(latestTaken))}
        <!-- the veil's edge takes the colour of what landed -->
        {#key latestTaken.id}
          <span class="veil" style="--fx:{latestTaken.colour}"></span>
        {/key}
      {/if}
    </div>
  {/if}

  <div class="field-objectives" style={place('tasks')}>
    {#if journeyGoal}
      {@const goal = journeyGoal.view}
      <section class="objective-next-goal surface-hud" class:stale={goal.status !== 'active'} aria-label="Next goal">
        <div class="objective-next-goal-head">
          <span class="chip chip-tag">{goal.kindLabel}</span>
          <span class="text-note">{journeyGoal.source === 'tracked' ? 'Pinned' : 'Suggested'}</span>
        </div>
        <h3 class="objective-next-goal-title">{goal.title}</h3>
        {#if goal.progress}<p class="text-note objective-next-goal-progress">{goal.status === 'complete' ? 'Complete · ' : ''}{goal.progress}</p>{/if}
        {#if goal.status === 'stale'}<p class="text-alarm">This goal can no longer be used. Clear it to return to suggestions.</p>{/if}
        {#if goal.action && goal.status !== 'stale'}
          <div class="objective-next-goal-actions">
            <button class="btn btn-gold" type="button" onclick={() => runGoalAction(goal)}>{goal.actionLabel}</button>
          </div>
        {/if}
        <details class="objective-next-goal-details">
          <summary>{goal.sources.length ? 'Where & details' : 'Goal details'}</summary>
          <div class="objective-next-goal-details-body">
            <p class="objective-next-goal-reason">{goal.reason}</p>
            {#if goal.sources.length}
              <ul class="objective-next-goal-sources" aria-label="Where to find what the goal needs">
                {#each goal.sources.slice(0, 3) as source (source.label + source.detail)}
                  <li><b>{source.label}</b> <span>{source.detail}</span>
                    {#each source.pins as pin (pin.zone)}
                      <button class="btn btn-flat" type="button" onclick={() => pinZoneSource(pin.zone)} aria-label={`Pin ${pin.label} on the map`}>Pin {pin.label}</button>
                    {/each}
                  </li>
                {/each}
              </ul>
            {/if}
            <div class="objective-next-goal-actions">
              {#if journeyGoal.source === 'tracked'}
                <button class="btn btn-quiet" type="button" onclick={() => doTrackGoal(null)}>Clear goal</button>
              {:else}
                <button class="btn btn-quiet" type="button" onclick={() => doTrackGoal(goal.ref)}>Pin this goal</button>
                <button class="btn btn-flat" type="button" onclick={() => setSetting('autoGoal', false)}>Hide suggestion</button>
              {/if}
            </div>
          </div>
        </details>
      </section>
    {:else if settings.autoGoal === false}
      <div class="objective-next-goal suggestion-off surface-hud">
        <p class="text-note">Automatic suggestions are hidden. Pinned goals and Delivery tracking still show here.</p>
        <button class="btn btn-quiet" type="button" onclick={() => setSetting('autoGoal', true)}>Show suggested goal</button>
      </div>
    {/if}
    <div class="objective-feed-slot">
      <ObjectiveFeed
        deliveries={trackedDeliveries.map((contract) => ({
          id: contract!.id,
          title: `${settlementName(contract!.town)} · ${trade.byId[contract!.good]?.name || contract!.good}`,
          progress: `${contract!.delivered}/${contract!.target}`,
          clock: deliveryClock(deliveryTimeLeft(gameState, contract!)),
          paused: deliveryPause || null,
        }))}
        onSheet={() => { sheetTab = 'life'; sheetOpen = true; }} onDelivery={openDeliveryWant} />
    </div>
  </div>

  <div class="field-feed" style={place('feed', '100%', 'auto')}>
    <LogBox lines={chatShown} tabs={CHAT_TABS} active={chatTab} hasActivity={feed.length > 0} onTab={(tab) => (chatTab = tab)} onOpenHistory={openCombatHistory} />
  </div>

  <!-- press notes are said aloud as well as printed — four pills are not one announcement -->
  <p class="aloud" role="status" aria-live="polite">{saveNote || equipNote || benchNote || townNote || farmNote}</p>

  <nav class="rail" aria-label="Game menu" style={place('menu')}>
    <div id="hub-menu-actions" class="menu-actions hud-slide-content" class:collapsed={!menuExpanded}
         aria-hidden={!menuExpanded} inert={!menuExpanded}>

    <button type="button" class="hub-control" class:here={panel === null} onclick={closePanel}
            data-panel-fallback title="Back to the field · Esc">
      <span class="toggle-ring" class:here={panel === null}><img src={fieldMark} alt="" aria-hidden="true" /></span>
      <span class="cap">Field</span>
    </button>
    {#each MAIN_RAIL as p}
      {@const label = RAIL_LABEL[p]}
      {@const key = keyFor(SCREEN_ACTION[p])}
      {@const far = TOWN_PANELS.includes(p) && !townLive}
        <button type="button" class="hub-control" class:here={panel === p} class:far={far}
              data-testid={p === 'map' ? 'open-world-map' : undefined}
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
      <div class="morebox surface-popover">
        {#each MORE_RAIL as p}
          {@const label = RAIL_LABEL[p]}
          {@const far = TOWN_PANELS.includes(p) && !townLive}
          {@const badge = p === 'tree' ? treePointsFree(gameState) : 0}
                <button type="button" class="hub-control" class:here={panel === p} class:far={far}
                  onclick={() => { togglePanel(p); more = false; }}
                  title={`${label} · ${keyFor(SCREEN_ACTION[p])}`}>
            <span class="toggle-ring" class:here={panel === p}><img src={RAIL_ICON[p]} alt="" aria-hidden="true" /></span>
            <span class="cap">{label}</span>
            {#if badge > 0}
              <CountBadge value={badge} tone="urgent" placement="top-right" title={`${badge} tree point${badge === 1 ? '' : 's'} available`} />
            {/if}
          </button>
        {/each}
        <a class="hub-control wiki-link" href="/wiki.html" target="_blank" rel="noopener noreferrer"
           title="Open the game wiki in a new tab" aria-label="Open the game wiki in a new tab">
          <span class="toggle-ring"><img src={deskMark} alt="" aria-hidden="true" /></span>
          <span class="cap">Wiki</span>
        </a>
            <button type="button" class="hub-control"
                onclick={() => (hudGridVisible = !hudGridVisible)} title="Toggle the viewport grid">
          <span class="toggle-ring" class:here={hudGridVisible}>
            <span class="icon-mask" style={`--glyph:url(${gridGlyph})`} aria-hidden="true"></span>
          </span>
          <span class="cap">Grid</span>
        </button>
            <button type="button" class="hub-control" aria-pressed={fxOn}
                onclick={toggleFx} title={fxOn ? 'Combat effects Full — switch to Minimal' : 'Combat effects Minimal — switch to Full'}>
          <span class="toggle-ring" class:here={fxOn}>
            <span class="icon-mask" style={`--glyph:url(${fxMark})`} aria-hidden="true"></span>
          </span>
          <span class="cap">VFX</span>
        </button>
            <button type="button" class="hub-control" onclick={openLayoutEditor} title="Arrange HUD regions on the grid">
          <span class="toggle-ring"><img src={layoutMark} alt="" aria-hidden="true" /></span>
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
    <Tabs
      label="Character sheet views"
      prefix="sheet-tab"
      controls="sheet-body-life sheet-body-stats"
      class="frame sheet-sides"
      tabs={[{ id: 'stats', label: 'Stats' }, { id: 'life', label: 'Life skills' }]}
      active={sheetTab}
      onpick={(id) => (sheetTab = id as typeof sheetTab)}
    />
      <button class="sheet-new-character btn btn-ghost" type="button" disabled={showcaseMode || !canWriteAccount} title="Start a new character"
              aria-label="New character" onclick={() => void newCharacterFromSheet()}>
        <img src={newCharacterMark} alt="" aria-hidden="true" />
        <span>New character</span>
      </button>
    </div>
    {#if sheetTab === 'life'}
      <!-- reference table plus one note: fills the panel's own width -->
      <div id="sheet-body-life" class="sheet-layout sheet-life" role="tabpanel" aria-labelledby="sheet-tab-life">
        <div class="sheet-values" aria-label="Life skill milestones">
          <section class="sheet-stat-group">
            <h3 class="text-accent">Life skill rungs</h3>
            <table class="stats table-metrics">
              <thead><tr><th scope="col">Life skill</th><th scope="col">Level</th><th scope="col">Current combat benefit</th><th scope="col">Next rung</th></tr></thead>
              <tbody>
              {#each lifeSkillMilestones(gameState) as rung (rung.id)}
                <tr><td>{rung.id}</td><td>Lv {rung.level}</td><td>{LIFE_BONUS_LABELS[rung.stat]} +{rung.bonus.toFixed(2)}{rung.unit === 'percentage_points' ? ' percentage points' : '%'}</td><td>{#if rung.complete}<span class="text-good">All rungs reached</span>{:else}{rung.next}{/if}</td></tr>
              {/each}
            </tbody></table>
          </section>
          <section class="sheet-stat-group">
            <h3 class="text-accent">How a rung pays</h3>
            <p class="sheet-gate">
              Milestone bonuses apply automatically and reserve no Mana. Train at the matching field activity,
              Farm or Workshop. Combat skills and character XP progress separately.
            </p>
          </section>
        </div>
      </div>
    {:else}
    <div id="sheet-body-stats" class="sheet-layout" role="tabpanel" aria-labelledby="sheet-tab-stats">
      <div class="sheet-build">
        <section class="sheet-doll" aria-label="Worn equipment">
          <h3 class="text-accent">Worn gear <span class="text-note">{gameState.gear.filter(Boolean).length} / {E.stat.item_slots}</span></h3>
          <SlotGrid game={gameState} entries={wornEntries} capacity={E.stat.item_slots} wornOf={wornOf} fixed layout="equipment"
                    actions={wornActions} />
        </section>
        <StatAllocator stats={STATS} core={c.core} points={gameState.player.points} canRefund={townLive} writer={transactionWriter}
                       statPoints={gameState.player.statPoints} treePoints={gameState.player.treePoints}
                       autoSpend={gameState.player.autoSpend} level={gameState.player.level}
                       onallocate={allocate}
                       ontoggleauto={() => { if (!requireAccountWriter('changing Core allocation')) return; gameState.player.autoSpend = !gameState.player.autoSpend; gameState = { ...gameState }; }} />
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
              <tr><td>Haste · cast</td><td>×{c.castSpeed.toFixed(2)} windup</td></tr>
              <tr><td>Haste · recovery</td><td>×{c.recoverySpeed.toFixed(2)} tail</td></tr>
              <tr><td>Haste · cooldown</td><td>×{c.cooldownRate.toFixed(2)} clock</td></tr>
            </tbody></table>
          </section>
        </div>
        <div class="sheet-value-column">
          <section class="sheet-stat-group">
            <h3 class="text-accent">Defence</h3>
            <table class="stats table-metrics"><tbody>
              <tr><td>Health</td><td>{fmtNum(shownHp)} / {fmtNum(c.maxHp)}<small class="text-note">+{c.hpRegen.toFixed(1)}/sec{hpBanked > 0 ? ` · ${fmtNum(hpUsable)} usable · ${fmtNum(hpBanked)} reserved` : ''}</small></td></tr>
              <tr><td>Energy Shield</td><td>{fmtNum(shownEs)} / {fmtNum(c.es)}<small class="text-note">+{c.esRegen.toFixed(1)}/sec · {E.energy_shield.delay_sec}s delay</small></td></tr>
              <tr><td>Mana</td><td>{fmtNum(shownMana)} / {fmtNum(c.maxMana)}<small class="text-note">+{c.manaRegen.toFixed(1)}/sec · {reserved.toFixed(1)}% reserved · {fmtNum(usableMana(c, gameState.skills))} usable</small></td></tr>
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
  <BagPanel
    gameState={gameState}
    character={c}
    settings={settings}
    townLive={townLive}
    town={town}
    tabs={tabs}
    bind:compactInventoryTabs={compactInventoryTabs}
    bind:invTab={invTab}
    bind:bagCat={bagCat}
    bind:bagQuery={bagQuery}
    bind:bagTier={bagTier}
    bind:bagMode={bagMode}
    bind:bagSort={bagSort}
    bind:carriedSort={carriedSort}
    modalGridArea={modalGridArea}
    showcaseMode={showcaseMode}
    bagFull={bagFull}
    equipNote={equipNote}
    heldSummary={heldSummary}
    townNote={townNote}
    invTabLabelId={invTabLabelId}
    bagShown={bagShown}
    bagCount={bagCount}
    stashTab={stashTab}
    stashFolder={stashFolder}
    transactionWriter={transactionWriter}
    fmtNum={fmtNum}
    keyFor={keyFor}
    hubIcon={hubIcon}
    onPickTab={(id) => { if (id === 'stash') invTab = 'stash'; else { invTab = 'inv'; bagCat = id as typeof bagCat; } }}
    onSetSetting={setSetting}
    onBestEquip={doBestEquip}
    onRunFilter={doRunFilter}
    onDepositAll={doDepositAll}
    onEquip={equip}
    onWornOf={wornOf}
    onBagActions={bagPieceActions}
    onEditRule={editRule}
    onSavePreset={doSaveFilterPreset}
    onLoadPreset={doLoadFilterPreset}
    onClearPreset={doClearFilterPreset}
    onAutoDissolve={setAutoDissolve}
    onOpenGearCare={openGearCare}
    onStashTab={(t) => (stashTab = t)}
    onStashAddTab={(id, expected) => doBuy(id, town?.id ?? '', expected)}
    onStashCarriedSort={(k) => (carriedSort = k)}
    onDeposit={(i) => doDeposit(i, stashTab)}
    onWithdraw={(i) => doWithdraw(stashTab, i)}
    onWithdrawAll={() => doWithdrawAll(stashTab)}
    onLock={toggleLock}
    onclose={closePanel}
  />
{/if}

{#if panel === 'forge'}
  <ForgePanel
    gameState={gameState}
    transactionWriter={transactionWriter}
    forgeNote={forgeNote}
    forgeResultItem={forgeResultItem}
    forgeFocus={forgeFocus}
    modalGridArea={modalGridArea}
    onForge={runForge}
    onSalvage={runSalvage}
    onTrack={doTrackGoal}
    onShortage={doTrackShortage}
    onPinZone={pinZoneSource}
    onMap={openMapAtSettlement}
    onBag={() => openPanel('bag')}
    onclose={() => { forgeResultItem = null; closePanel(); }}
  />
{/if}

{#if panel === 'craft' || showcaseMode}
  <CraftPanel
    gameState={gameState}
    benchItem={benchItem}
    bench={bench}
    bind:craftView={craftView}
    wornOf={wornOf}
    benchNote={benchNote}
    tabs={tabs}
    stashTab={stashTab}
    transactionWriter={transactionWriter}
    repairPrice={repairPrice}
    repairQuote={repairQuote}
    modalGridArea={modalGridArea}
    showcaseMode={showcaseMode}
    onpick={selectBench}
    onclear={() => { benchSelection = null; benchNote = ''; }}
    onrun={(op, line, pick) => runCraft(op, line ?? 0, pick)}
    onStashTab={(tab) => { stashTab = tab; }}
    onTakeStash={takeStashForCraft}
    onStore={storeCraftPiece}
    onrepair={doRepairGear}
    onclose={closePanel}
  />
{/if}

{#if panel === 'skills' || showcaseMode}
  <SkillsPanel
    gameState={gameState}
    character={c}
    writable={transactionWriter}
    note={skillNote}
    autoSkills={settings.autoSkills !== false}
    bind:view={skillsWorkbenchView}
    modalGridArea={modalGridArea}
    showcaseMode={showcaseMode}
    onslot={setSlot}
    onmove={doMoveSlot}
    onmode={setMode}
    onauto={setAutoMode}
    oncondition={setCond}
    ontoggle={toggle}
    onaurapool={chooseAuraPool}
    ondisableauras={disableAllAuras}
    onswitchpreset={doSwitchPreset}
    onstorepreset={doStorePreset}
    onbindzone={doBind}
    onclose={closePanel}
  />
{/if}

{#if panel === 'tree' || showcaseMode}
  <TreePanel
    gameState={gameState}
    selectedId={selectedTreeNodeId}
    verdict={selectedTreeVerdict}
    goalId={journeyGoal?.source === 'tracked' && journeyGoal.view.ref.kind === 'passive' ? journeyGoal.view.ref.id : null}
    treeSpent={treeSpent}
    modalGridArea={modalGridArea}
    showcaseMode={showcaseMode}
    onselect={(id) => (selectedTreeNodeId = id)}
    onbuy={() => doSpendTree(selectedTreeNodeId)}
    onpath={doAllocateTreePath}
    ontrackgoal={(id) => doTrackGoal({ kind: 'passive', id })}
    bind:session={treeBoardSession}
    bind:focusId={treeFocusId}
    onclose={closePanel}
  />
{/if}

{#if panel === 'town' || showcaseMode}
  <TownPanel
    gameState={gameState}
    town={town}
    townLive={townLive}
    tabs={tabs}
    modalGridArea={modalGridArea}
    showcaseMode={showcaseMode}
    onopen={(id) => openPanel(id as PanelId)}
    onwarp={travelTo}
    onsellall={doSell}
    onblackmarket={openBlackMarket}
    onbest={doBestEquip}
    onstashall={() => doDepositAll(stashTab)}
    onclose={closePanel}
  />
{/if}

{#if panel === 'market' || showcaseMode}
  <MarketPanel
    gameState={gameState}
    town={town}
    townLive={townLive}
    transactionWriter={transactionWriter}
    marketSale={marketSale}
    modalGridArea={modalGridArea}
    showcaseMode={showcaseMode}
    onbuy={doBuy}
    onsell={doSell}
    ontrade={doTrade}
    onprocess={doProcess}
    onroute={showTradeRoute}
    ondeliver={doDelivery}
    ontrack={doTrackDelivery}
    onack={doAcknowledgeDelivery}
    onaccept={doAcceptCourier}
    ondecline={doDeclineCourier}
    onblackmarketbuy={doBlackMarketBuy}
    onpinzone={pinZoneSource}
    ontrackgoal={(id) => doTrackGoal({ kind: 'delivery', id })}
    ontrackshortage={doTrackShortage}
    goalId={journeyGoal?.source === 'tracked' && journeyGoal.view.ref.kind === 'delivery' ? journeyGoal.view.ref.id : null}
    bind:view={marketView}
    bind:marketId={marketTownId}
    onclose={() => { marketSale = null; closePanel(); }}
  />
{/if}

{#if deliveryNotice && (showcaseMode || transactionWriter && panel === null)}
  <Panel title="Delivery notice" subtitle="An optional town opportunity" width="wide" showcase={showcaseMode} gridArea={modalGridArea} onclose={() => doDismissDelivery(deliveryNotice!.id)}>
    <DeliveryNotice state={gameState} contract={deliveryNotice} writer={transactionWriter}
      ontrack={() => doTrackDelivery(deliveryNotice!.id, true)} ondetails={() => openDeliveryWant(deliveryNotice!.id)} ondismiss={() => doDismissDelivery(deliveryNotice!.id)}
      onaccept={() => doAcceptCourier(deliveryNotice!.id)} ondecline={() => doDeclineCourier(deliveryNotice!.id)} />
  </Panel>
{/if}

{#if panel === 'camp' || showcaseMode}
  <CampPanel
    gameState={gameState}
    fieldworkSite={fieldworkSite}
    fieldCellName={fieldCellName}
    fieldCampName={fieldCampName}
    fieldCampHere={fieldCampHere}
    fieldworkBusy={fieldworkBusy}
    townLive={townLive}
    modalGridArea={modalGridArea}
    showcaseMode={showcaseMode}
    oncamp={doEstablishCamp}
    onstart={doStartFieldAction}
    onstop={doStopFieldAction}
    oncook={doCookMeal}
    oneat={doEatMeal}
    onauto={(patch) => updateAutoEat(patch)}
    onclose={closePanel}
  />
{/if}

{#if panel === 'farm' || showcaseMode}
  <FarmPanel
    gameState={gameState}
    farmSub={farmSub}
    bind:farmTab={farmTab}
    transactionWriter={transactionWriter}
    farmNote={farmNote}
    plots={plots}
    fl={fl}
    modalGridArea={modalGridArea}
    showcaseMode={showcaseMode}
    onPlant={doPlant}
    onHarvest={doHarvest}
    onScrapAlchemy={doScrapAlchemy}
    onBrew={doBrew}
    onDrink={doDrink}
    onCondense={doCondense}
    onAutoPotion={setAutoPotion}
    onPotionThreshold={setPotionThreshold}
    onFarmAutomation={setFarmAutomation}
    onclose={closePanel}
  />
{/if}

{#if panel === 'desk' || showcaseMode}
  <DeskPanel
    gameState={gameState}
    town={town}
    townId={townId}
    townLive={townLive}
    viewTown={viewTown}
    viewHere={viewHere}
    viewStock={viewStock}
    viewColSet={viewColSet}
    viewColHinted={viewColHinted}
    deskSub={deskSub}
    bind:deskTab={deskTab}
    junkTotal={junkTotal}
    junkLines={junkLines}
    treeSpent={treeSpent}
    freeSkipsLeft={freeSkipsLeft}
    skipTokens={skipTokens}
    taskChoices={taskChoices}
    picked={picked}
    transactionWriter={transactionWriter}
    modalGridArea={modalGridArea}
    showcaseMode={showcaseMode}
    fmtNum={fmtNum}
    onSell={doSell}
    onRespec={respec}
    onRespecTree={doRespecTree}
    onBuy={doBuy}
    onSkipTask={doSkipTask}
    onClaim={doClaim}
    onTurnIn={doTurnIn}
    onSelect={select}
    onGoToZone={goToZone}
    onWalk={doWalk}
    onTravelTo={travelTo}
    buyExpectation={buyExpectation}
    warpPrice={warpPrice}
    stonesLine={stonesLine}
    onclose={closePanel}
  />
{/if}
{#if panel === 'save' || showcaseMode}
  <Panel title="Save"
    subtitle="Local saves, backups and shared preferences"
    width="compact" showcase={showcaseMode} gridArea={modalGridArea} onclose={closePanel}>
    <!-- The Save body owns the panel's scroll; focus makes wheel and arrow/Page keys reach it. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (the scroll region needs keyboard focus) -->
    <div class="save-panel scroll-pane" role="region" aria-label="Save content" tabindex="0">
    <Tabs label="Save sections" active={saveTab} onpick={(id) => { saveTab = id as typeof saveTab; if (id === 'backups') loadSnaps(); }}
          tabs={[{ id: 'slots', label: 'Slots' }, { id: 'backups', label: 'Backups' }, { id: 'settings', label: 'Settings' }]} />
    {#if showcaseMode}<p class="showcase-note">Save, load, backup, import, and export are disabled here. This page never reads or writes a player save.</p>{/if}
    {#if !showcaseMode && startupPending}<p class="showcase-note" role="status">Load a character, or start a new one. Existing slots are kept.</p>{/if}
    {#if !showcaseMode}
      <div class="account-writer card-tile" class:owner={accountWriterState === 'owner'} role="status" aria-live="polite">
        <p>{accountWriterMessage}</p>
        {#if accountWriterState === 'readonly'}
          <label>Reload after takeover
            <select bind:value={takeoverSlot}>{#each saveSlots as slot}<option value={slot}>{slot}</option>{/each}</select>
          </label>
          <button type="button" onclick={takeOverAndLoad}>Take over and reload</button>
        {:else if accountWriterState === 'waiting'}
          <button type="button" onclick={cancelTakeover}>Cancel wait</button>
        {/if}
        {#if accountWriterState !== 'owner'}<button type="button" onclick={download}>Export recovery JSON</button>{/if}
      </div>
    {/if}
    {#if saveTab === 'slots'}
    {#if persistenceError}<div role="alert"><p class="text-alarm">{persistenceError}</p><button onclick={download}>Export recovery JSON</button></div>{/if}
    <p>Three local character slots · offline progress has no time limit. Autosave starts after you save or load a slot; a new or imported character needs its own slot choice.</p>
    <div class="save-actions">
    <button disabled={showcaseMode || !canWriteAccount} onclick={() => void startNewCharacter()}>Start new character</button>
    {#each saveSlots as slot}
      <button disabled={showcaseMode || startupPending || !canWriteAccount || TEMP_DISABLE_SLOT_SAVES} onclick={() => doSave(slot)}>Save {slot}</button>
      <button disabled={showcaseMode || accountWriterState === 'checking' || accountWriterState === 'waiting' || accountWriterState === 'unsupported' || TEMP_DISABLE_SLOT_SAVES} onclick={() => void loadFromSave(slot)}>Load {slot}</button>
    {/each}
    <button disabled={showcaseMode} onclick={download}>Export JSON</button>
    <label>Import <input type="file" accept="application/json" disabled={showcaseMode || !canWriteAccount || TEMP_DISABLE_SLOT_SAVES} onchange={importFromSave} /></label>
    </div>
    {#if TEMP_DISABLE_SLOT_SAVES}<p class="text-note">Slot saves are off until the game is finished.</p>
    {:else if attachedSlot}<p class="text-note">Autosave is on for {attachedSlot}.</p>{:else}<p class="text-note">Not saved yet. Choose a slot to keep this character.</p>{/if}
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
            <td><button disabled={showcaseMode || !canWriteAccount} onclick={() => restoreFromSave(i)}>Rewind to this</button></td>
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
    <label>Combat effects
      <select value={settings.combatEffects || 'auto'} onchange={(e) => setSetting('combatEffects', (e.target as HTMLSelectElement).value as NonNullable<ClientSettings['combatEffects']>)}>
        <option value="auto">Automatic — adapt to playback speed</option>
        <option value="full">Full</option>
        <option value="reduced">Reduced</option>
        <option value="minimal">Minimal</option>
      </select>
    </label>
    <label><input type="checkbox" checked={settings.holdPosition === true} onchange={(e) => setSetting('holdPosition', (e.target as HTMLInputElement).checked)} /> Hold position — no automatic approach; manual moves and avoidance still run</label>
    <label>Auto target
      <select value={settings.targetPriority ?? 'nearest'} onchange={(e) => setSetting('targetPriority', (e.target as HTMLSelectElement).value as NonNullable<ClientSettings['targetPriority']>)}>
        <option value="nearest">Nearest</option>
        <option value="lowest-hp">Lowest HP</option>
        <option value="highest-hp">Highest HP</option>
      </select>
    </label>
    <p class="text-note">Explicit effect levels stay the same at every playback speed. Cast labels and status details remain available; your system's reduced-motion preference is respected.</p>
    <!-- auto-dissolve lives with the bag filter now: it is a bag rule, not a display preference -->
    {/if}
    </div>
  </Panel>
{/if}

{#if panel === 'combat' || showcaseMode}
  <CombatPanel
    gameState={gameState}
    inspectedEnemy={inspectedEnemy}
    modalGridArea={modalGridArea}
    showcaseMode={showcaseMode}
    oninspect={(enemy) => (inspectedEnemy = enemy)}
    onclose={closePanel}
    oncloseEnemy={() => (inspectedEnemy = null)}
  />
{/if}

<!-- the ink's distortion field: one static turbulence map shared by both orbs' ink layers -->
<svg class="orb-warp-defs" width="0" height="0" aria-hidden="true" focusable="false">
  <filter id="orb-warp" x="-25%" y="-25%" width="150%" height="150%">
    <feTurbulence type="fractalNoise" baseFrequency="0.016 0.024" numOctaves="2" seed="11" result="noise" />
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="30" xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>

<style>
  :global(.hex-calibration) { display: none; }
  .hex-calibrating :global(.hex-calibration) { display: inline; }
  button.picked { border-color: var(--gold); color: var(--gold); }

  :global(body.ui-showcase) { height: auto; min-height: 100%; overflow-x: hidden; overflow-y: auto; }
  .showcase-frame { display: contents; }
  .showcase-frame.active { display: grid; grid-template-rows: auto auto minmax(0, 1fr); height: 100vh; }
  .showcase-frame.active:has(.arena-preview-controls),
  .showcase-frame.active:has(.combat-fx-preview-controls) { grid-template-rows: auto auto auto minmax(0, 1fr); }
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
  .combat-fx-preview-controls { display: flex; align-items: center; flex-wrap: wrap; gap: var(--spacing-md); padding: var(--spacing-xs) var(--screen-pad); border-bottom: 1px solid var(--line); background: var(--inset); }
  .combat-fx-preview-controls label { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .combat-fx-preview-controls span { color: var(--dim); font-size: var(--font-xs); }
  .arena-preview-controls { display: flex; align-items: center; flex-wrap: wrap; gap: var(--spacing-md); padding: var(--spacing-xs) var(--screen-pad); border-bottom: 1px solid var(--line); background: var(--inset); font-size: var(--font-xs); }
  .arena-preview-controls strong { color: var(--gold-lit); }
  .arena-preview-controls label { display: inline-flex; align-items: center; gap: var(--spacing-xs); }
  .arena-command-controls { display: inline-flex; align-items: center; flex-wrap: wrap; gap: var(--spacing-xs); }
  .arena-command-controls button[aria-pressed="true"] { border-color: var(--gold-lit); color: var(--gold-lit); }
  .showcase-index { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); padding: var(--spacing-xs) var(--screen-pad); border-bottom: 1px solid var(--line); background: var(--inset); }
  .showcase-index a { padding: var(--spacing-xs) var(--spacing-xs); border: 1px solid var(--line); border-radius: var(--radius-card); color: var(--dim); font-size: var(--font-xs); text-decoration: none; white-space: nowrap; }
  .showcase-index a:hover, .showcase-index a:focus-visible { border-color: var(--gold); color: var(--gold-lit); }
  .showcase-note { padding: var(--spacing-xs) var(--spacing-sm); border: 1px solid var(--line); border-radius: var(--radius-card); color: var(--dim); background: var(--inset); font-size: var(--font-xs); }


  /* cards mount by state (`showCombatCards`); these rules only shape the fight-over-map overlap */
  .stage.mapmode .field { display: none; pointer-events: none; }
  :global(.stage.mapmode .field > :not(.combat-player-slot)) { display: none; }
  :global(.stage.mapmode .field .combat-player-slot) { pointer-events: none; }
  :global(.stage.mapmode .field .combat-player-slot button) { pointer-events: auto; }
  :global(.stage.mapmode .field .combat-player-slot .self-side) { display: none; }
  .stage.mapmode .floaters { display: none; }

  .stage.mapmode .targetbar { display: none; }

  /* The combat-field sample is the arena, not the hub: keep the fight, target bar, controls and
     vitals; hide Journey, Objectives, Chronicle and the screen rail. */
  .stage.combat-field-sample :is(.journey-dock, .field-objectives, .field-feed, .rail) { display: none; }

  .stage.veiled { --dof: var(--dof-far); }
  .stage.veiled .field, .stage.veiled .actionbar, .stage.veiled .targetbar {
    filter: blur(2.5px); opacity: .5; transition: filter var(--motion-fast) var(--ease-ui), opacity var(--motion-fast) var(--ease-ui);
  }

  .journey-dock {
    grid-area: objectives; z-index: var(--z-hud-control);
    width: 100%; height: 100%; min-width: 0; min-height: 0;
    display: flex; flex-direction: column; align-items: stretch; pointer-events: none;
  }
  .journey-panel {
    display: flex; flex-direction: column; min-width: 0; min-height: 0; max-height: 100%;
    overflow: hidden; pointer-events: auto;
  }
  .journey-panel.expanded { flex: 1; }
  .journey-header, .journey-alerts { flex: none; padding: var(--spacing-sm); }
  .journey-header { display: grid; gap: var(--spacing-xs); }
  .journey-title, .journey-location { display: flex; align-items: center; gap: var(--spacing-sm); min-width: 0; }
  .journey-title { flex-wrap: wrap; }
  .journey-title > :global(.disclosure-toggle) { flex: 1; min-width: 0; }
  .journey-title > button { flex: none; font-size: var(--font-xs); }
  .map-clean-toggle[aria-pressed="true"] { color: var(--gold-lit); border-color: var(--gold); background: var(--surface-selected); }
  .journey-location strong { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: var(--font-sm); }
  .journey-level { flex: none; color: var(--gold-lit); font-size: var(--font-xs); font-variant-numeric: tabular-nums; }
  .journey-header p { margin: 0; overflow-wrap: anywhere; font-size: var(--font-xs); line-height: 1.4; }
  .journey-status { color: var(--gold-lit); }
  .objective-next-goal { display: grid; gap: var(--spacing-xs); flex: none; min-width: 0; padding: var(--spacing-sm); }
  .objective-next-goal.stale { border-left: 2px solid var(--alarm); }
  .objective-next-goal-head, .objective-next-goal-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs) var(--spacing-sm); }
  .objective-next-goal-head { justify-content: space-between; }
  .objective-next-goal-title { margin: 0; font-size: var(--font-sm); line-height: 1.3; overflow-wrap: anywhere; }
  .objective-next-goal p { margin: 0; font-size: var(--font-xs); line-height: 1.4; overflow-wrap: anywhere; }
  .objective-next-goal-progress { font-variant-numeric: tabular-nums; }
  .objective-next-goal-sources { display: grid; gap: var(--spacing-xs); margin: 0; padding: 0; list-style: none; font-size: var(--font-xs); line-height: 1.35; }
  .objective-next-goal-sources li { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--spacing-xs); overflow-wrap: anywhere; }
  .objective-next-goal-sources button { font-size: var(--font-xs); padding: 0 var(--spacing-xs); }
  .objective-next-goal-actions button { font-size: var(--font-xs); }
  .objective-next-goal-details { border-top: 1px solid var(--edge); padding-top: var(--spacing-xs); }
  .objective-next-goal-details > summary { cursor: pointer; color: var(--dim); font-size: var(--font-xs); font-weight: 600; }
  .objective-next-goal-details-body { display: grid; gap: var(--spacing-xs); padding-top: var(--spacing-xs); }
  .journey-alerts { display: grid; gap: var(--spacing-xs); padding-top: 0; }
  .journey-alerts:empty { display: none; }
  .journey-body {
    display: grid; align-content: start; gap: var(--spacing-md);
    flex: 1;
    padding: var(--spacing-sm); border-top: 1px solid var(--edge);
  }
  .journey-body[hidden], .journey-map-controls[hidden] { display: none; }
  .journey-map-controls { display: grid; gap: var(--spacing-sm); padding-bottom: var(--spacing-sm); border-bottom: 1px solid var(--edge); }

  .map-tools { display: grid; gap: var(--spacing-sm); min-width: 0; font-size: var(--font-xs); }
  .map-display { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
  .map-display button { font-size: var(--font-xs); }
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
  .map-legend p { grid-column: 1 / -1; margin: 0; line-height: 1.4; }
  .map-legend .ramp i { flex: 1; width: auto; }

  /* the Hub Grid shell: fixed; an overgrown region scrolls inside itself (AGENTS.md §UI integration) */
  .stage {
    position: fixed;
    inset: 0;
    overflow: hidden;

    --rail-h: clamp(52px, 3.29vw, 66px);
    --z-effect: 3;
    --z-control: 5;
    --z-navigation: 70;
    --x-pull-arc: clamp(-46px, -1.65vw, -21px);
    --x-pull-burst: clamp(-32px, -1.16vw, -15px);

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

  .stage::after {
    content: ''; position: absolute; inset: 0; z-index: var(--z-underlay); pointer-events: none;
    background: radial-gradient(115% 95% at 50% 48%, transparent 52%, rgba(0, 0, 0, .55));
  }
  .field { z-index: var(--z-content); }

  .stage:has(.toast) .field { grid-row-start: 5; }
  .stage:has(:global(.progress-recap)) .field { grid-row-start: 5; }
  .stage:not(:has(.toast)) .save-note { top: var(--band-toast); }
  .stage:has(.toast) .save-note { top: calc(var(--band-toast) + var(--band-note)); }

  .toast {
    position: absolute; top: var(--band-toast); left: 50%; transform: translateX(-50%); z-index: var(--z-floater);
    display: flex; flex-wrap: wrap; gap: var(--spacing-xs) var(--spacing-sm); align-items: baseline; max-width: min(clamp(575px, 44.53vw, 1242px), 62%);
    padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-xs);
  }


  .save-note {
    position: absolute; top: var(--band-note); left: 50%; transform: translateX(-50%); z-index: var(--z-label);
    max-width: min(clamp(425px, 32.91vw, 918px), 86%);
  }





  .field {
    min-width: 0; min-height: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: var(--spacing-md);
    overflow: visible;

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


    --gate-line: rgba(255, 255, 255, .45);
    --gate-line-soft: rgba(255, 255, 255, .18);
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
  .cast-open { position: absolute; inset: 0; z-index: 3; border: 0; padding: 0; background: transparent; cursor: pointer; }
  .cast-open:hover { background: color-mix(in srgb, var(--gold) 9%, transparent); }
  .cast-open:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
  /* a manual order waiting on the sim reads as a held key, not a second cooldown sweep */
  .cast.queued { outline: 2px solid var(--gold-lit); outline-offset: 1px; }
  .cast:focus-within { outline: 2px solid var(--focus); outline-offset: 2px; }
  .cast-tooltip { display: none; position: absolute; inset-inline-start: 50%; bottom: calc(100% + 14px); transform: translateX(-50%); width: 250px; padding: 11px 13px; z-index: var(--z-floater); background: var(--inset); border: 1px solid var(--hud-edge); box-shadow: var(--shadow-soft); pointer-events: none; font-size: var(--font-2xs); line-height: 1.5; color: var(--text); gap: 5px; }
  .cast-tooltip strong, .cast-tooltip > span { display: block; }
  .cast-tooltip strong { color: var(--gold-lit); }
  .cast:hover .cast-tooltip, .cast:focus-within .cast-tooltip { display: grid; }
  .cast img { width: var(--icon-hub-img); height: var(--icon-hub-img); object-fit: contain; }

  .cast.silent { opacity: .4; }
  .cast.gated { border-style: dashed; border-color: var(--gate-line); }
  .cast.filler { border-color: var(--gate-line-soft); }
  .cast small {
    position: absolute; inset: 0; display: grid; place-items: center; border-radius: var(--radius-card);
    background: none; font-size: clamp(var(--font-xs), calc(var(--slot-skill-size) * .3), var(--font-md)); color: var(--gold-lit);
    font-variant-numeric: tabular-nums; text-shadow: 0 1px 3px rgba(0, 0, 0, .95);
  }

  .cast .sweep {
    position: absolute; inset: 0; border-radius: var(--radius-card); pointer-events: none;
    background: conic-gradient(from -90deg, transparent 0 var(--skill-cooldown-progress), rgba(6, 8, 11, .66) var(--skill-cooldown-progress) 100%);
    /* Progress is written per animation frame; CSS transitions would trail behind and restart every frame. */
    transition: none;
  }
  .cast b { position: absolute; top: clamp(-8px, -0.29vw, -4px); left: clamp(-3px, -0.10vw, -1px); font-size: var(--font-xs); color: var(--dim); }


  .toggle-ring {
    position: relative; isolation: isolate; flex: none; display: grid; place-items: center;
    width: var(--icon-hub); height: var(--icon-hub); padding: var(--spacing-xs);
    border: 1px solid var(--hud-edge); border-radius: var(--radius-round); background: var(--hud-face); box-sizing: border-box;
  }
  .toggle-ring > img, .toggle-ring > .icon-mask {
    position: relative; z-index: var(--z-underlay);
    width: var(--icon-hub-img); height: var(--icon-hub-img); aspect-ratio: 1 / 1;
    padding: 0; border: 0; border-radius: var(--radius-card); background: none; box-sizing: border-box;
    object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .9));
  }
  .toggle-ring > .icon-mask { background: currentColor; }
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

  .command-row { display: flex; justify-content: flex-end; align-items: flex-start; gap: var(--spacing-xs); min-width: 0; }
  .commands-dock { z-index: var(--z-hud-control); display: flex; flex-direction: column; justify-content: center; gap: var(--spacing-xs); min-width: 0; max-width: 100%; pointer-events: none; }
  .commands-dock > * { pointer-events: auto; }
  .speed-mark { color: var(--dim); font-size: var(--font-xs); font-variant-numeric: tabular-nums; }
  .speed-mark.here { color: var(--gold-lit); }

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
  .target-range { margin: 0; font-size: var(--font-xs); font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px rgba(0, 0, 0, .95); }
  .offscreen-arrow { display: inline-block; transform: rotate(var(--bearing, 0deg)); color: var(--gold-lit); }


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
  .field-objectives {
    grid-area: tasks; height: 100%; min-width: 0; min-height: 0;
    display: flex; flex-direction: column; gap: var(--spacing-sm);
    padding: var(--pad-area); overflow: hidden;
    pointer-events: none; z-index: var(--z-control);
  }
  .field-objectives > :global(*) { pointer-events: auto; }
  .objective-feed-slot { flex: 1 1 auto; min-height: 0; display: flex; overflow: hidden; }
  .objective-feed-slot > :global(.objective-feed) { flex: 1 1 auto; min-height: 0; height: 100%; align-content: start; }
  .hub-control {
    position: relative; flex: none; display: flex; flex-direction: column;
    align-items: center; justify-content: flex-start; gap: var(--spacing-xs);
    min-width: var(--icon-hub); padding: 0;
  }
  .wiki-link { text-decoration: none; }
  .hub-control .cap { white-space: nowrap; text-align: center; }

  .morebox {
    position: absolute; top: calc(100% + var(--spacing-xs)); right: 0;
    display: grid; grid-template-columns: repeat(8, minmax(var(--icon-card), 1fr)); gap: var(--spacing-sm);
    padding: var(--spacing-sm);
  }


  /* the tab buttons live in Tabs.svelte's scope, so their face styles reach them globally */

  @media (max-width: 1200px) {
  }
  @media (max-width: 1200px) {
  }

  .sheet-sides { flex: none; }


  .bagshell { display: grid; grid-template-columns: minmax(0, auto) minmax(320px, 1fr); gap: var(--spacing-md); align-items: start; min-width: 0; }
  .bagcare-rail { display: grid; align-content: start; gap: var(--spacing-sm); min-width: 0; max-height: 100%; overflow: auto; }
  @media (max-width: 1400px) {
    .bagshell { grid-template-columns: minmax(0, 1fr); }
  }
  .sheet-tools { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); }
  /* Equipment over Core attributes, beside the complete character values. */
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



  .stats td { font-size: var(--font-xs); padding: var(--spacing-xs) var(--spacing-xs); }
  .stats td:first-child { color: var(--dim); width: 45%; }
  .save-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; align-content: start; gap: var(--spacing-sm); }
  .account-writer { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-xs); }
  .account-writer.owner { border-color: color-mix(in srgb, var(--good) 48%, var(--line)); }
  .account-writer p { flex: 1 1 clamp(150px, 11.62vw, 324px); min-width: 0; color: var(--dim); font-size: var(--font-xs); }
  .account-writer.owner p { color: var(--good-lit); }
  .account-writer label { display: inline-flex; align-items: center; gap: var(--spacing-xs); color: var(--dim); font-size: var(--font-xs); }
  .account-writer select, .account-writer button { font-size: var(--font-xs); border-radius: var(--radius-card); }
  .save-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; }
  .save-panel h2 { margin: 0; font-size: var(--font-md); }
  .save-panel p { margin: 0; }
  .save-panel table { font-size: var(--font-xs); }
  .save-note-inline { color: var(--good); font-size: var(--font-xs); }



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

  :global(.stage.combat-fx-sample:not(.combat-fx-live) .fx) { animation: none; opacity: 1; transform: none; }
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .pop) { animation: none; opacity: 1; transform: none; }
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .mob .plate-fx .pop) {
    top: calc(58% + (var(--lane, 0) * var(--icon-card)));
  }
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .mob .plate-fx .pop-word) {
    top: calc(58% + (var(--icon-card) * 4));
  }
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .player-card.combat .pops .pop) {
    top: calc(50% + (var(--lane, 0) * var(--icon-label)));
  }
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .player-card.combat .pops .pop-word) {
    top: calc(50% - (var(--icon-card) * 2) + (var(--lane, 0) * var(--spacing-lg)));
  }
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .flash) { animation: none; opacity: .75; }
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .combat-scene-effects .impact),
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .skill-cast-cue) { animation: none; opacity: .85; transform: none; }
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .combat-scene-effects .impact-flash),
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .combat-scene-effects .flight-trail),
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .combat-scene-effects .flight-core),
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .combat-scene-effects .lightning-trail),
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .combat-scene-effects .lightning-core) { display: none; }
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .mob .art.knock),
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .mob .charge.lunge),
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .player-card.combat .cardface.knock) { animation: none; }
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .combat-actor),
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .combat-actor *) { animation: none !important; }
  :global(.stage.combat-fx-sample:not(.combat-fx-live) .field-side) {
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



  .townmode:not(.fighting) .field { opacity: .78; filter: saturate(.85); }
  .townmode .map-back { --dof: var(--dof-far); }



  .stage {
    display: grid;
    grid-template-columns: var(--screen-pad) repeat(15, minmax(0, 1fr)) var(--screen-pad);
    grid-template-rows: var(--screen-pad) repeat(15, minmax(0, 1fr)) var(--screen-pad);

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
  @media (max-width: 1500px) { .vital-stack { --orb-size: clamp(84px, 6.4vw, 96px); } }
  .field-feed {
    grid-area: feed;
    width: 100%;
    min-width: 0;
    min-height: 0;
    align-self: stretch;
  }
  .stage :is(.journey-dock, .targetbar, .field, .commands-dock, .field-feed, .actionbar) {
    padding: var(--pad-area);
  }
  .stage .rail { padding: 0 var(--spacing-xs); }
  .stage .commands-dock { padding-inline: var(--spacing-md); }

  .stage .field { padding-bottom: var(--pad-area); }
  .field-feed :global(.combatlog) { width: 100%; min-height: 0; }
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
    padding: var(--spacing-xs);
    border-right: 1px solid color-mix(in srgb, var(--focus) 55%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--focus) 55%, transparent);
    color: color-mix(in srgb, var(--focus) 78%, var(--text));
    font: var(--font-xs) / 1 var(--num);
    text-shadow: 0 1px 2px var(--bg);
  }
  .map-icon-legend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-xs) var(--spacing-sm); width: 100%; }
  .map-icon-legend > span { display: flex; align-items: center; gap: var(--spacing-xs); }
  .map-icon-legend img, .journey-map-signals img { width: var(--icon-label); height: var(--icon-label); flex: none; }
  .journey-map-signals { display: grid; gap: var(--spacing-sm); padding: var(--spacing-sm); border-top: 1px solid var(--line); }
  .journey-map-signals summary { color: var(--text); font-size: var(--font-sm); font-weight: 600; cursor: pointer; }
  .journey-map-signals ul { display: grid; gap: var(--spacing-xs); list-style: none; margin: 0; padding: 0; }
  .journey-map-signals li { display: flex; align-items: center; gap: var(--spacing-sm); min-width: 0; }
  .journey-map-signals li > span { color: var(--text); font-size: var(--font-xs); line-height: 1.4; overflow-wrap: anywhere; }
</style>
