/**
 * The house icon set, imported from `art/svg/` where it lives.
 *
 * Two things make this file different from an `?url` import map:
 *
 * 1. Every house icon is `stroke="currentColor"` on a 32×32 viewBox, so it carries no colour of its
 *    own. An `<img src>` of one renders the stroke as `canvastext` — black — which is invisible on a
 *    dark panel. So they are imported `?raw` and inlined, and the surrounding CSS supplies `color`.
 *    (Verified by rendering both forms side by side before this file was written.)
 * 2. The icons carry `role="img"` + `aria-labelledby` + a `<title>` whose id is baked per file. Inlined
 *    many times on one page that duplicates DOM ids, and the icon is always decorative — the label
 *    beside it is the accessible name. So the accessibility block is stripped on import and the
 *    caller marks the `<span>` with whatever it needs.
 *
 * Resolution order for a skill (first match wins):
 *   1. the exact `art/svg/skill/<type>/<type>-<name>.svg`
 *   2. `SKILL_ALIASES`, for the six attack rows whose art still carries a retired name
 *   3. the row's own `element` mark, so a whole elemental family reads as one school
 *   4. `NEAR_MISS`, the handful of rows with no art of their own — flagged in `ICON_GAPS`
 *   5. a per-type default, so a new skill row never renders blank
 */

/* --- skills: attack ---------------------------------------------------------------------- */

import arcaneBolt from '../../../art/svg/skill/attack/attack-arcane-bolt.svg?raw';
import arrowShower from '../../../art/svg/skill/attack/attack-arrow-shower.svg?raw';
import chainSpark from '../../../art/svg/skill/attack/attack-chain-spark.svg?raw';
import cleave from '../../../art/svg/skill/attack/attack-cleave.svg?raw';
import elementalBreak from '../../../art/svg/skill/attack/attack-elemental-break.svg?raw';
import executeArt from '../../../art/svg/skill/attack/attack-execute.svg?raw';
import flameLash from '../../../art/svg/skill/attack/attack-flame-lash.svg?raw';
import frostNova from '../../../art/svg/skill/attack/attack-frost-nova.svg?raw';
import headshot from '../../../art/svg/skill/attack/attack-headshot.svg?raw';
import piercingShot from '../../../art/svg/skill/attack/attack-piercing-shot.svg?raw';
import puncture from '../../../art/svg/skill/attack/attack-puncture.svg?raw';
import retribution from '../../../art/svg/skill/attack/attack-retribution.svg?raw';
import riposte from '../../../art/svg/skill/attack/attack-riposte.svg?raw';
import shieldBash from '../../../art/svg/skill/attack/attack-shield-bash.svg?raw';
import toxicSpray from '../../../art/svg/skill/attack/attack-toxic-spray.svg?raw';
import voidLance from '../../../art/svg/skill/attack/attack-void-lance.svg?raw';
import whirlwind from '../../../art/svg/skill/attack/attack-whirlwind.svg?raw';

/* --- skills: buff ------------------------------------------------------------------------ */

import berserker from '../../../art/svg/skill/buff/buff-berserker.svg?raw';
import ghostDance from '../../../art/svg/skill/buff/buff-ghost-dance.svg?raw';
import holyVeil from '../../../art/svg/skill/buff/buff-holy-veil.svg?raw';
import ironWill from '../../../art/svg/skill/buff/buff-iron-will.svg?raw';
import magiaDrive from '../../../art/svg/skill/buff/buff-magia-drive.svg?raw';
import warcry from '../../../art/svg/skill/buff/buff-warcry.svg?raw';

/* --- skills: curse ----------------------------------------------------------------------- */

import blindingMark from '../../../art/svg/skill/curse/curse-blinding-mark.svg?raw';
import cripple from '../../../art/svg/skill/curse/curse-cripple.svg?raw';
import expose from '../../../art/svg/skill/curse/curse-expose.svg?raw';
import jinx from '../../../art/svg/skill/curse/curse-jinx.svg?raw';
import lacerate from '../../../art/svg/skill/curse/curse-lacerate.svg?raw';
import executioner from '../../../art/svg/skill/curse/curse-mark-of-the-executioner.svg?raw';
import pandemonium from '../../../art/svg/skill/curse/curse-pandemonium.svg?raw';
import shatter from '../../../art/svg/skill/curse/curse-shatter.svg?raw';
import sunder from '../../../art/svg/skill/curse/curse-sunder.svg?raw';
import venomBind from '../../../art/svg/skill/curse/curse-venom-bind.svg?raw';
import weaken from '../../../art/svg/skill/curse/curse-weaken.svg?raw';

/* --- skills: heal ------------------------------------------------------------------------ */

import cleanse from '../../../art/svg/skill/heal/heal-cleanse.svg?raw';
import greaterHeal from '../../../art/svg/skill/heal/heal-greater-heal.svg?raw';
import heal from '../../../art/svg/skill/heal/heal-heal.svg?raw';

/* --- skills: aura ------------------------------------------------------------------------ */

import clarity from '../../../art/svg/skill/aura/aura-clarity.svg?raw';
import elementalFury from '../../../art/svg/skill/aura/aura-elemental-fury.svg?raw';
import energyGuard from '../../../art/svg/skill/aura/aura-energy-guard.svg?raw';
import grace from '../../../art/svg/skill/aura/aura-grace.svg?raw';
import haste from '../../../art/svg/skill/aura/aura-haste.svg?raw';
import heraldOfAsh from '../../../art/svg/skill/aura/aura-herald-of-ash.svg?raw';
import heraldOfFrost from '../../../art/svg/skill/aura/aura-herald-of-frost.svg?raw';
import heraldOfLightning from '../../../art/svg/skill/aura/aura-herald-of-lightning.svg?raw';
import ironGuard from '../../../art/svg/skill/aura/aura-iron-guard.svg?raw';
import rimboForm from '../../../art/svg/skill/aura/aura-rimbo-form.svg?raw';
import trinityForm from '../../../art/svg/skill/aura/aura-trinity-form.svg?raw';
import vitality from '../../../art/svg/skill/aura/aura-vitality.svg?raw';
import wraithOfFury from '../../../art/svg/skill/aura/aura-wraith-of-fury.svg?raw';

/* --- element marks ----------------------------------------------------------------------- */

import chaosMark from '../../../art/svg/skill/chaos.svg?raw';
import coldMark from '../../../art/svg/skill/cold.svg?raw';
import fireMark from '../../../art/svg/skill/fire.svg?raw';
import lightningMark from '../../../art/svg/skill/lightning.svg?raw';
import poisonMark from '../../../art/svg/skill/poison.svg?raw';

/* --- hub: town + settlement -------------------------------------------------------------- */

import goldCoin from '../../../art/svg/currency/gold-coin.svg?raw';
import house from '../../../art/svg/building/house.svg?raw';
import plotDeed from '../../../art/svg/building/plot-deed.svg?raw';
import repairService from '../../../art/svg/building/repair-service.svg?raw';
import roadLink from '../../../art/svg/building/road-link.svg?raw';
import bagSlot from '../../../art/svg/interface/bag-category-slot.svg?raw';
import banner from '../../../art/svg/interface/banner.svg?raw';
import baseTint from '../../../art/svg/interface/base-tint.svg?raw';
import herbPouch from '../../../art/svg/interface/herb-pouch.svg?raw';
import stashTab from '../../../art/svg/interface/stash-tab.svg?raw';
import title from '../../../art/svg/interface/title.svg?raw';
import taskSkipToken from '../../../art/svg/misc/task-skip-token.svg?raw';

/**
 * Drop the baked accessibility block. The icons are decorative everywhere they are used — a label
 * sits next to each one — and inlining the same file several times on a page would repeat its
 * `aria-labelledby` id.
 */
function markup(raw: string): string {
  return raw
    .replace(/\s+role="img"/g, '')
    .replace(/\s+aria-labelledby="[^"]*"/g, '')
    .replace(/\s*<title[^>]*>[\s\S]*?<\/title>/g, '')
    .trim();
}

const A = {
  arcaneBolt: markup(arcaneBolt),
  arrowShower: markup(arrowShower),
  chainSpark: markup(chainSpark),
  cleave: markup(cleave),
  elementalBreak: markup(elementalBreak),
  execute: markup(executeArt),
  flameLash: markup(flameLash),
  frostNova: markup(frostNova),
  headshot: markup(headshot),
  piercingShot: markup(piercingShot),
  puncture: markup(puncture),
  retribution: markup(retribution),
  riposte: markup(riposte),
  shieldBash: markup(shieldBash),
  toxicSpray: markup(toxicSpray),
  voidLance: markup(voidLance),
  whirlwind: markup(whirlwind),

  berserker: markup(berserker),
  ghostDance: markup(ghostDance),
  holyVeil: markup(holyVeil),
  ironWill: markup(ironWill),
  magiaDrive: markup(magiaDrive),
  warcry: markup(warcry),

  blindingMark: markup(blindingMark),
  cripple: markup(cripple),
  expose: markup(expose),
  jinx: markup(jinx),
  lacerate: markup(lacerate),
  executioner: markup(executioner),
  pandemonium: markup(pandemonium),
  shatter: markup(shatter),
  sunder: markup(sunder),
  venomBind: markup(venomBind),
  weaken: markup(weaken),

  cleanse: markup(cleanse),
  greaterHeal: markup(greaterHeal),
  heal: markup(heal),

  clarity: markup(clarity),
  elementalFury: markup(elementalFury),
  energyGuard: markup(energyGuard),
  grace: markup(grace),
  haste: markup(haste),
  heraldOfAsh: markup(heraldOfAsh),
  heraldOfFrost: markup(heraldOfFrost),
  heraldOfLightning: markup(heraldOfLightning),
  ironGuard: markup(ironGuard),
  rimboForm: markup(rimboForm),
  trinityForm: markup(trinityForm),
  vitality: markup(vitality),
  wraithOfFury: markup(wraithOfFury),

  chaos: markup(chaosMark),
  cold: markup(coldMark),
  fire: markup(fireMark),
  lightning: markup(lightningMark),
  poison: markup(poisonMark),

  goldCoin: markup(goldCoin),
  house: markup(house),
  plotDeed: markup(plotDeed),
  repairService: markup(repairService),
  roadLink: markup(roadLink),
  bagSlot: markup(bagSlot),
  banner: markup(banner),
  baseTint: markup(baseTint),
  herbPouch: markup(herbPouch),
  stashTab: markup(stashTab),
  title: markup(title),
  taskSkipToken: markup(taskSkipToken),
};

/** Skill id → art, for every row whose file name is exactly `<type>-<name>`. */
const BY_ID: Record<string, string> = {
  'attack.cleave': A.cleave,
  'attack.elemental_break': A.elementalBreak,
  'attack.whirlwind': A.whirlwind,
  'attack.shield_bash': A.shieldBash,
  'attack.puncture': A.puncture,
  'attack.piercing_shot': A.piercingShot,
  'attack.arrow_shower': A.arrowShower,
  'attack.headshot': A.headshot,

  'buff.warcry': A.warcry,
  'buff.berserker': A.berserker,
  'buff.iron_will': A.ironWill,
  'buff.holy_veil': A.holyVeil,
  'buff.ghost_dance': A.ghostDance,
  'buff.magia_drive': A.magiaDrive,

  'curse.weaken': A.weaken,
  'curse.blinding_mark': A.blindingMark,
  'curse.sunder': A.sunder,
  'curse.expose': A.expose,
  'curse.cripple': A.cripple,
  'curse.jinx': A.jinx,
  'curse.mark_of_the_executioner': A.executioner,
  'curse.venom_bind': A.venomBind,
  'curse.shatter': A.shatter,
  'curse.pandemonium': A.pandemonium,
  'curse.lacerate': A.lacerate,

  'heal.heal': A.heal,
  'heal.greater_heal': A.greaterHeal,
  'heal.cleanse': A.cleanse,

  'aura.wraith_of_fury': A.wraithOfFury,
  'aura.clarity': A.clarity,
  'aura.haste': A.haste,
  'aura.vitality': A.vitality,
  'aura.herald_of_ash': A.heraldOfAsh,
  'aura.herald_of_frost': A.heraldOfFrost,
  'aura.herald_of_lightning': A.heraldOfLightning,
  'aura.rimbo_form': A.rimboForm,
  'aura.elemental_fury': A.elementalFury,
  'aura.trinity_form': A.trinityForm,
  'aura.grace': A.grace,
  'aura.iron_guard': A.ironGuard,
  'aura.energy_guard': A.energyGuard,
};

/**
 * The elemental roster was cut into 28 rows but only six attack icons were drawn, and they still
 * carry the pre-redesign names. Each one is claimed here by the row that reads as its successor, so a
 * family's flagship carries its own art and the rest of the family falls through to the element mark.
 */
const SKILL_ALIASES: Record<string, string> = {
  'attack.arcane_pulse': A.arcaneBolt,
  'attack.fireball': A.flameLash,
  'attack.blizzard': A.frostNova,
  'attack.chain_lightning': A.chainSpark,
  'attack.venom_spray': A.toxicSpray,
  'attack.void_blast': A.voidLance,
};

const BY_ELEMENT: Record<string, string> = {
  fire: A.fire,
  cold: A.cold,
  lightning: A.lightning,
  poison: A.poison,
  chaos: A.chaos,
};

/**
 * Rows with no art of their own. Each borrows the nearest existing icon, so two rows can share a
 * mark until the missing file is drawn. `ICON_GAPS` is the list to work through.
 */
const NEAR_MISS: Record<string, string> = {
  'attack.reap': A.execute,
  'attack.bloodletting': A.retribution,
  'attack.pierce_the_veil': A.riposte,
  'buff.energy_absorb': A.ironWill,
};

const BY_TYPE: Record<string, string> = {
  attack: A.cleave,
  buff: A.ironWill,
  curse: A.weaken,
  heal: A.heal,
  aura: A.vitality,
};

/**
 * The skill rows that render a borrowed icon, so the gap is visible rather than silent. Nothing
 * reads this yet — it is the work list for drawing the missing files in `art/svg/skill/`.
 */
export const ICON_GAPS: string[] = Object.keys(NEAR_MISS);

/** Skill row → inline `<svg>` markup. Never returns undefined, so no skill label renders bare. */
export function skillArt(id: string, type: string, element?: string): string {
  return (
    BY_ID[id] ||
    SKILL_ALIASES[id] ||
    (element ? BY_ELEMENT[element.toLowerCase()] : undefined) ||
    NEAR_MISS[id] ||
    BY_TYPE[type.toLowerCase()] ||
    A.cleave
  );
}

/** An Element mark, for innate-element labels and anything else that needs the school on its own. */
export function elementArt(element: string): string {
  return BY_ELEMENT[element.toLowerCase()] ?? A.cleave;
}

/**
 * The hub: one mark per stall NPC, keyed by `tools/data/town.json` `npcs[].id`. Each is the thing the
 * NPC actually sells or does, which is what `towns-ui.md` §3 tells a stall row to lead with.
 */
const BY_NPC: Record<string, string> = {
  counterhand: A.goldCoin,
  porter: A.stashTab,
  steward: A.house,
  guild_clerk: A.taskSkipToken,
  armourer: A.repairService,
  waypoint_keeper: A.roadLink,
  collector: A.bagSlot,
  curio_pedlar: A.title,
  herbalist: A.herbPouch,
  furrier: A.banner,
};

const HUB_DEFAULT = A.house;

/** Stall NPC id → inline `<svg>` markup. */
export function npcArt(npcId: string): string {
  return BY_NPC[npcId.toLowerCase()] ?? HUB_DEFAULT;
}

/**
 * Stock line → icon, keyed by `town.json` `one_time[].id` / `repeatable[].id`. A line with no entry
 * falls back to its NPC's mark, which is the honest default: the row is still that stall's line.
 */
const BY_STOCK: Record<string, string> = {
  road_link: A.roadLink,
  stash_tab_1: A.stashTab,
  stash_tab_2: A.stashTab,
  stash_tab_3: A.stashTab,
  stash_tab_4: A.stashTab,
  stash_tab_5: A.stashTab,
  stash_tab_6: A.stashTab,
  herb_pouch_ii: A.herbPouch,
  herb_pouch_iii: A.herbPouch,
  bag_slot: A.bagSlot,
  plot_deed_4: A.plotDeed,
  plot_deed_5: A.plotDeed,
  house_ashfall: A.house,
  house_highspire: A.house,
  house_vermolch: A.house,
  skip_token: A.taskSkipToken,
  repair: A.repairService,
  repair_ironrow: A.repairService,
  pedlar_rotation: A.title,
  prestige_title: A.title,
  waypoint_reanchor: A.roadLink,
  banner_coldres: A.banner,
  tint_heavy: A.baseTint,
  collector_hint: A.bagSlot,
};

/** Stock line → icon, falling back to the NPC that sells it. */
export function stockArt(stockId: string, npcId: string): string {
  return BY_STOCK[stockId.toLowerCase()] ?? npcArt(npcId);
}

/** The settlement mark, used on the map HUD and the drawer head. */
export function hubArt(): string {
  return A.house;
}