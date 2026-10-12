// The single place the client touches the numeric sources.
// engine.json / mods.json are the same files tools/*.js read, and createEngine is the same
// module the cages call — so a number the client shows is the number the cage gates (DECISIONS.md §Stack).
import engineJson from '../../../tools/data/engine.json' with { type: 'json' };
import modsJson from '../../../tools/data/mods.json' with { type: 'json' };
import skillsJson from '../../../tools/data/skills.json' with { type: 'json' };
import townJson from '../../../tools/data/town.json' with { type: 'json' };
import basesJson from '../../../tools/data/bases.json' with { type: 'json' };
import treeJson from '../../../tools/data/tree.json' with { type: 'json' };
import { createCollector } from '../../../engine/collector.ts';
import { createEngine } from '../../../engine/index.ts';
import { createDungeon } from '../../../engine/dungeon.ts';
import { createLoot } from '../../../engine/loot.ts';
import { createRoad } from '../../../engine/road.ts';
import { createFarm } from '../../../engine/farm.ts';
import { createSkillModel } from '../../../engine/skills.ts';
import { createTree } from '../../../engine/tree.ts';
import type { EngineData, ModsData, SkillsData } from '../../../engine/types.ts';
// Each export keeps the type TypeScript infers from its own JSON file. A hand-written interface would be
// a second copy of the data's shape — the same defect as a second copy of a number, and it drifts the
// same way. `as any` was the other failure mode: it hid every mis-typed field the HUD prints.
export const E = engineJson;
export const MODS = modsJson;
export const SKILLS = skillsJson;
export const TOWN = townJson;
export const BASES = basesJson;
export const TREE_SPEC = treeJson;

/** The shared math, instantiated once. Every formula in the game comes out of this object.
 *
 *  The four `*_DATA` bindings are the JSON→engine seam: each constructor takes the engine's own declared
 *  view of its file, and a JSON import cannot state a fixed-length pair where `MobZone` declares
 *  `[number, number]`, so the arity is written once here rather than dropped from the declaration.
 *  `E`/`MODS`/`SKILLS`/`TOWN`/`BASES` above stay the files' inferred shape — that is what types every
 *  number the HUD prints, and it is what caught `MobZone` declaring no `quality` the data carries. */
const ENGINE_DATA = engineJson as unknown as EngineData;
const MODS_DATA = modsJson as unknown as ModsData;
const SKILLS_DATA = skillsJson as unknown as SkillsData;
const TREE_DATA = treeJson as unknown as Parameters<typeof createTree>[0];
/** The typed views the sim modules pass into the shared factories, where the raw JSON's inferred
 *  shape (a `levels: number[]` where the engine declares a pair) would not satisfy the seam. */
export const ED = ENGINE_DATA;
export const TD = townJson as unknown as Parameters<typeof createCollector>[0];
export const BD = basesJson as unknown as Parameters<typeof createCollector>[1];

export const eng = createEngine(ENGINE_DATA);
export const dungeon = createDungeon(ENGINE_DATA);
export const loot = createLoot(ENGINE_DATA, MODS_DATA);
export const sm = createSkillModel(SKILLS_DATA, ENGINE_DATA);
/** The passive tree, derived once from its spec — the same object the tree cage gates. */
export const tree = createTree(TREE_DATA, MODS_DATA);
/** The walk and the farm, instantiated once here: the sim, the map views and the player wiki all read
 *  the same two objects, so a block count or a growth time cannot differ between the game and a page.
 *  `any` because the factory's return is a bag of reads the engine's data interface deliberately does
 *  not enumerate — the same reason the sim modules held its instance at `any`. */
export const road: any = createRoad(ENGINE_DATA);
export const farm: any = createFarm(ENGINE_DATA);

export const STAT_KEYS = ['str', 'int', 'vit', 'agi', 'dex', 'wis', 'lck'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

// Name → row indexes, built once. `sumLines`, `weaponByName` and `spawnMob` otherwise linear-scan
// these on every tick (and every tick again through the offline catch-up), so the Maps keep those
// lookups O(1) instead of O(gear × bases).
export const BASE_BY_NAME: Map<string, any> = new Map((basesJson as any).bases.map((b: any) => [b.name, b]));
export const WEAPON_BY_NAME: Map<string, any> = new Map((basesJson as any).weapons.map((w: any) => [w.name, w]));
