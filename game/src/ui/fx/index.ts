/**
 * One home for skill-effect selection.
 *
 * Renderers ask `fieldShape` / `arenaSkillShape` / `arenaMobShape`; they never decide a shape from
 * an Element or skill group themselves. Defaults come from group and Element, and only a genuinely
 * bespoke skill earns a row in `overrides.ts`. Shape markup stays in the scene components until a
 * shared renderer is worth extracting. Raster atlas effects live under `game/public/fx/<skill>/<version>/`
 * and are registered in `catalog.ts`; the Skill Lab and the arena read that same pool.
 */
export * from './types';
export * from './overrides';
export * from './resolve';
