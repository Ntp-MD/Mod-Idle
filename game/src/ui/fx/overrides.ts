import type { EffectShape } from './types';

/**
 * Only bespoke arts belong here. Everything else resolves by group, element and type in
 * `resolve.ts`, so adding a skill never requires a row unless its effect is truly unique.
 */
export const SKILL_EFFECT_OVERRIDES: Record<string, EffectShape> = {};
