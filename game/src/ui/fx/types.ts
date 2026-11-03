/** Effect shapes shared by the FieldPlates SVG layer and the ARPG scene. */
export const EFFECT_SHAPES = [
  'slash', 'bolt', 'arrow', 'block', 'dodge', 'heal', 'ward',
  'fire', 'cold', 'lightning', 'earth', 'poison', 'chaos', 'burst',
] as const;

export type EffectShape = (typeof EFFECT_SHAPES)[number];
/** The arena keeps a raw physical element for its own fallback rendering. */
export type ArenaShape = EffectShape | 'physical';

export type SkillLike = { id?: string; group?: string | null; element?: string | null; type?: string | null };
export type MobLike = { damage?: string | null; innate?: readonly (string | null)[] | null };
export type MobSkillLike = {
  element?: string | null;
  mode?: string | null;
  cast?: { delivery?: string | null } | null;
};
export type FieldEventLike = { kind: string; text?: string };

export const isEffectShape = (value: string): value is EffectShape =>
  (EFFECT_SHAPES as readonly string[]).includes(value);
