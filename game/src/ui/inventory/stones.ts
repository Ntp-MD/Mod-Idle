import { icon } from '../../icon';
import { stoneName } from '@sim/gear/craft';
import { loot } from '../../engine/client';

/**
 * The stone shelf the crafting window reads: the bench keeps it as a currency doll, one list so no two
 * surfaces ever price a different set. Each stone wears the press it buys — one mark per kind, named
 * once in the engine's `STONE_NAME`.
 */

/** the drag payload a stone square sets and the bench's piece slot answers */
export const STONE_MIME = 'application/x-modworld-stone';

const stoneRerollValue = icon('swirl-ring');
const stoneRerollTier = icon('ladder-stack');
const stoneAdd = icon('add-plus');
const stoneRemove = icon('remove-minus');
const stoneRepair = icon('anvil-impact');
const stoneCorrupt = icon('cursed-star');
const crystalOne = icon('crystal-cluster-1');
const crystalGrowth = icon('crystal-growth');

/** the quality mark is also a press's face on the bench, so it is named apart from the shelf */
export const stoneQuality = icon('level-up');
/** the rune is the replacement stone and every Imprint stone — the family's mark */
export const runeStone = icon('keystone-node');

/** The kinds a purse keeps a place for, in the order every screen reads them. */
const STONES = [
  { key: 'reroll_value', icon: stoneRerollValue, detail: 'Reroll a Mod value inside its Tier' },
  { key: 'tier', icon: stoneRerollTier, detail: 'Change a Mod Tier' },
  { key: 'add', icon: stoneAdd, detail: 'Add an Unbound Mod' },
  { key: 'remove', icon: stoneRemove, detail: 'Remove an Unbound Mod' },
  { key: 'replace', icon: runeStone, detail: 'Change a Mod identity' },
  { key: 'quality', icon: stoneQuality, detail: 'Enhance a gear piece one step' },
  { key: 'polish', icon: crystalOne, detail: 'Reroll every Mod value' },
  { key: 'reforge', icon: crystalOne, detail: 'Redraw the piece Tier' },
  { key: 'rebirth', icon: crystalGrowth, detail: 'Redraw Unbound Mods' },
  { key: 'corrupt', icon: stoneCorrupt, detail: 'One permanent gamble' },
  { key: 'repair', icon: stoneRepair, detail: 'Repair a Broken piece' },
];

const STONE_ICON: Record<string, string> = {
  reroll_value: stoneRerollValue, tier: stoneRerollTier, add: stoneAdd, remove: stoneRemove,
  replace: runeStone, quality: stoneQuality, polish: crystalOne, reforge: crystalOne,
  rebirth: crystalGrowth, corrupt: stoneCorrupt, repair: stoneRepair, imprint: runeStone,
};

/** one purse key's mark; an unknown (or Imprint) key wears the rune */
export const stoneIcon = (key: string) => (key.startsWith('imprint_') ? runeStone : STONE_ICON[key] || runeStone);

export type ShelfStone = { key: string; icon: string; detail: string; name: string; count: number };

/** The canonical shelf with its counts — zero included, because a doll keeps a square for every kind. */
export const regularStones = (held: Record<string, number>): ShelfStone[] =>
  STONES.map((stone) => ({ ...stone, name: stoneName(stone.key), count: Number(held[stone.key] || 0) }));

/**
 * Imprint stones are one per Mod, so they are never reserved: a purse draws only the ones it holds,
 * appended under the shelf and ordered by name.
 */
export const imprintStones = (held: Record<string, number>): ShelfStone[] => Object.entries(held)
  .filter(([key, count]) => key.startsWith('imprint_') && Number(count) > 0)
  .map(([key, count]) => ({ key, icon: runeStone,
    detail: loot.IMPRINT_IDS.includes(key.slice('imprint_'.length))
      ? 'Write this named Mod onto a line' : 'This Mod cannot be Imprinted onto gear',
    name: stoneName(key), count: Number(count) }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** The whole shelf a surface asks for: every kind, or only the kinds the purse holds. */
export const shelfStones = (held: Record<string, number>, all: boolean): ShelfStone[] =>
  [...(all ? regularStones(held) : regularStones(held).filter((stone) => stone.count > 0)), ...imprintStones(held)];
