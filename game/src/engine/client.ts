// The single place the client touches the numeric sources.
// engine.json / mods.json are the same files tools/*.js read, and createEngine is the same
// module the cages call — the client and reports share one source of calculations.
import engineJson from '../../../tools/data/engine.json' with { type: 'json' };
import modsJson from '../../../tools/data/mods.json' with { type: 'json' };
import skillsJson from '../../../tools/data/skills.json' with { type: 'json' };
import mobSkillsJson from '../../../tools/data/mob-skills.json' with { type: 'json' };
import townJson from '../../../tools/data/town.json' with { type: 'json' };
import basesJson from '../../../tools/data/bases.json' with { type: 'json' };
import treeJson from '../../../tools/data/tree.json' with { type: 'json' };
import spawnsJson from '../../../tools/data/spawns.json' with { type: 'json' };
import { createCatalog } from '../../../engine/catalog.ts';
import { createCollector } from '../../../engine/collector.ts';
import { createEngine } from '../../../engine/index.ts';
import { createDungeon } from '../../../engine/dungeon.ts';
import { createLoot } from '../../../engine/loot.ts';
import { createRoad } from '../../../engine/road.ts';
import { createFarm } from '../../../engine/farm.ts';
import { createFieldwork } from '../../../engine/fieldwork.ts';
import { createLifeSkills } from '../../../engine/life-skills.ts';
import { createBlackMarket, type BlackMarketCfg } from '../../../engine/black-market.ts';
import { createTrade, type TradeCfg } from '../../../engine/trade.ts';
import { createDelivery, type DeliveryCfg } from '../../../engine/delivery.ts';
import { createSkillModel } from '../../../engine/skills.ts';
import { createSpawns } from '../../../engine/spawns.ts';
import { createTree } from '../../../engine/tree.ts';
import { keystoneBuildContext } from '../sim/core/keystone-runtime.ts';
import { validateEngineData } from '../../../engine/validate.ts';
import type { EngineData, ModsData, SkillsData, MobSkillsData } from '../../../engine/types.ts';
// Each export keeps the type TypeScript infers from its own JSON file. A hand-written interface would be
// a second copy of the data's shape — the same defect as a second copy of a number, and it drifts the
// same way. `as any` was the other failure mode: it hid every mis-typed field the HUD prints.
export const E = engineJson;
export const MODS = modsJson;
export const SKILLS = skillsJson;
export const MOB_SKILLS = mobSkillsJson;
export const TOWN = townJson;
export const BASES = basesJson;
export const TREE_SPEC = treeJson;
export const SPAWNS = spawnsJson;

/** The shared math, instantiated once. Every formula in the game comes out of this object.
 *
 *  The `*_DATA` bindings are the JSON→engine seam: each constructor takes the engine's own declared
 *  view of its file, and a JSON import cannot state a fixed-length pair where `MobZone` declares
 *  `[number, number]`, so the arity is written once here rather than dropped from the declaration.
 *  `E`/`MODS`/`SKILLS`/`TOWN`/`BASES` above stay the files' inferred shape — that is what types every
 *  number the HUD prints, and it is what caught `MobZone` declaring no `quality` the data carries.
 *
 *  The engine's own view is checked, not asserted: `validateEngineData` refuses a file that lost a
 *  constant or a section the factories read, naming the path, and its `K` parameter fails the build
 *  when the file lost a constant the engine still declares. */
const ENGINE_DATA: EngineData = validateEngineData(engineJson);
const MODS_DATA: ModsData = modsJson;
// JSON widens area.origin to string; the roster gate validates its authored origin and radius.
const SKILLS_DATA: SkillsData = skillsJson as SkillsData;
// A JSON import cannot infer the `mode` union; the library is authored to the declared shape and X55
// validates every row, so this seam narrows once rather than re-typing the data in the sim.
const MOB_SKILLS_DATA: MobSkillsData = mobSkillsJson as unknown as MobSkillsData;
// a JSON import cannot infer a union such as `TreeGrant.stat`; the engine validates every grant it
// reads, so the seam narrows to its own declared shape here rather than re-typing the data
const TREE_DATA = treeJson as unknown as Parameters<typeof createTree>[0];
/** The typed views the sim modules pass into the shared factories, where the raw JSON's inferred
 *  shape (a `levels: number[]` where the engine declares a pair) would not satisfy the seam. */
export const ED = ENGINE_DATA;
export const MS = MOB_SKILLS_DATA;
export const TD: Parameters<typeof createCollector>[0] = townJson;
export const BD: Parameters<typeof createCollector>[1] = basesJson;

/** One read-only index over the item, mob, skill and town pools. */
export const catalog = createCatalog({
  engine: ENGINE_DATA,
  mods: MODS_DATA,
  skills: SKILLS_DATA,
  town: townJson,
  bases: basesJson,
});

export const eng = createEngine(ENGINE_DATA);
export const dungeon = createDungeon(ENGINE_DATA);
export const loot = createLoot(ENGINE_DATA, MODS_DATA);
export const sm = createSkillModel(SKILLS_DATA, ENGINE_DATA);
/** Field spawn points and RO engagement ranges, validated against the arena and canonical zone roster. */
export const spawns = createSpawns(spawnsJson, {
  arena: engineJson.combat_arena,
  playerStart: engineJson.combat_arena.player_start,
  zones: engineJson.mob.zones,
});
/** The passive tree, derived once from its spec — the same object the tree cage gates. The canonical
 *  Elements and the real keystone handler table ride in as the caller's context: a v3 keystone is
 *  purchasable only when the runtime table can actually run its bundle. */
const ELEMENTS = Object.keys(E.elements.status_of);
export const tree = createTree(TREE_DATA, MODS_DATA, ELEMENTS, keystoneBuildContext(ELEMENTS));
/** The walk and the farm, instantiated once here: the sim, the map views and the player wiki all read
 *  the same two objects, so a block count or a growth time cannot differ between the game and a page.
 *  `any` because the factory's return is a bag of reads the engine's data interface deliberately does
 *  not enumerate — the same reason the sim modules held its instance at `any`. */
export const road: any = createRoad(ENGINE_DATA);
export const farm: any = createFarm(ENGINE_DATA);
export const fieldwork: any = createFieldwork(ENGINE_DATA.fieldwork);
export const lifeSkills = createLifeSkills(ENGINE_DATA.fieldwork);
export const trade = createTrade(ENGINE_DATA, TOWN.trade as TradeCfg);
export const delivery = createDelivery(ENGINE_DATA, TOWN.delivery as DeliveryCfg, trade, eng);
export const blackMarket = createBlackMarket(ENGINE_DATA as any, (TOWN as any).black_market as BlackMarketCfg, trade, sm);

/** The Core keys live in the engine (`core-attributes.ts`), so a grant, a save and a stat line are
 *  checked against one list — re-exported here in the published order, unchanged. */
export { STAT_KEYS } from '../../../engine/core-attributes.ts';
export type { StatKey } from '../../../engine/core-attributes.ts';

// Name → row indexes, built once. `sumLines`, `weaponByName` and `spawnMob` otherwise linear-scan
// these on every tick (and every tick again through the offline catch-up), so the Maps keep those
// lookups O(1) instead of O(gear × bases).
export const BASE_BY_NAME = catalog.items.bases.byName;
export const WEAPON_BY_NAME = catalog.items.weapons.byName;
