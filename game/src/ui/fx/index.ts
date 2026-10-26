/**
 * One home for skill-effect selection.
 *
 * Renderers ask `fieldShape` / `arenaSkillShape` / `arenaMobShape`; they never decide a shape from
 * an Element or skill group themselves. Defaults come from group and Element, and only a genuinely
 * bespoke skill earns a row in `overrides.ts`. Shape markup stays in the scene components until a
 * shared renderer is worth extracting; per-skill raster effects, if they arrive, belong under
 * `game/public/fx/<preset>/` with an atlas and meta, never in the UI icon shelf.
 */
export * from './types';
export * from './overrides';
export * from './resolve';
