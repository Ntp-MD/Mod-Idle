// The single place the client touches the numeric sources.
// engine.json / mods.json are the same files tools/*.js read, and createEngine is the same
// module the cages call — so a number the client shows is the number the cage gates (Techstack.md).
import engineJson from '../../../tools/data/engine.json';
import modsJson from '../../../tools/data/mods.json';
import skillsJson from '../../../tools/data/skills.json';
import townJson from '../../../tools/data/town.json';
import basesJson from '../../../tools/data/bases.json';
import { createEngine } from '../../../engine/index.ts';
import { createLoot } from '../../../engine/loot.ts';
import { createSkillModel } from '../../../engine/skills.ts';

export const E = engineJson as any;
export const MODS = modsJson as any;
export const SKILLS = skillsJson as any;
export const TOWN = townJson as any;
export const BASES = basesJson as any;

/** The shared math, instantiated once. Every formula in the game comes out of this object. */
export const eng: any = createEngine(E);
export const loot: any = createLoot(E, MODS);
export const sm: any = createSkillModel(SKILLS, E);

export const STAT_KEYS = ['str', 'int', 'vit', 'agi', 'dex', 'wis', 'lck'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

// Name → row indexes, built once. `sumLines`, `weaponByName` and `spawnMob` otherwise linear-scan
// these on every tick (and every tick again through the offline catch-up), so the Maps keep those
// lookups O(1) instead of O(gear × bases).
export const BASE_BY_NAME: Map<string, any> = new Map((basesJson as any).bases.map((b: any) => [b.name, b]));
export const WEAPON_BY_NAME: Map<string, any> = new Map((basesJson as any).weapons.map((w: any) => [w.name, w]));
