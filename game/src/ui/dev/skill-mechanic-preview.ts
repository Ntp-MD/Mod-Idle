import type { SkillRow } from '@engine/types.ts';

/** Showcase-only capabilities, outside the live catalogue and every acquisition pool. */
export function skillMechanicPreview(kind: string | null): SkillRow | undefined {
  if (kind !== 'ray' && kind !== 'field' && kind !== 'orbs') return undefined;
  const base: SkillRow = {
    id: `test.preview-${kind}`, name: `Mechanic preview: ${kind}`, type: 'attack', hit_class: 'spell',
    group: 'magic', basis: 'magic', element: 'chaos', mana: '10 flat', cd: 5,
    base_flat: 10, eff: 0, offline_targets: '8', effect: 'Synthetic mechanic preview.',
    cast: { delivery: 'projectile', range_m: 6, windup_sec: .3, recovery_sec: .2 },
    area: { origin: 'target', radius_m: 0 },
  };
  if (kind === 'ray') return { ...base, channel: { mana_per_sec: 10 }, duration: '3 sec',
    area: { origin: 'caster', radius_m: 0, shape: 'line', length_m: 6, width_m: 1 },
    action: { kind: 'ray-channel', active_sec: 3, interval_sec: .5, effect_policy: 'refresh-status' },
    effects: [{ stat: 'hits', op: 'add_flat', value: 6, subject: 'self' }],
  };
  if (kind === 'field') return { ...base, element: 'fire', duration: '4 sec',
    cast: { ...base.cast!, delivery: 'ground' }, area: { origin: 'target', radius_m: 3 },
    action: { kind: 'meteor-field', interval_sec: .25, effect_policy: 'refresh-status' },
    effects: [{ stat: 'hits', op: 'add_flat', value: 16, subject: 'self' },
      { stat: 'hit_pct', op: 'add_pct', value: 25, subject: 'self' }],
  };
  return { ...base, action: { kind: 'targeted-burst', distinct_targets: true, interval_sec: .2,
    tracking: 'homing', pursuit_range_m: 8, pursuit_sec: 2 },
    effects: [{ stat: 'hits', op: 'add_flat', value: 6, subject: 'self' }],
  };
}
