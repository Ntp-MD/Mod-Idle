import { describe, expect, it } from 'vitest';
import { skillHandoffById, skillHandoffFor } from '../src/ui/combat/arena-vfx-space';

/**
 * E3 handoff fixtures: the normalized spatial contract every live attack resolves to.
 * Shape/origin/delivery come from the canonical row, lifecycle from the executed kind,
 * follow from the committed instance — never from a skill name.
 */
const ATTACKS: [string, string, string, string, string, string][] = [
  ['attack.fireball', 'single', 'target', 'projectile', 'impact', 'fixed'],
  ['attack.firestorm', 'circle', 'target', 'ground', 'impact', 'fixed'],
  ['attack.meteor', 'circle', 'target', 'ground', 'impact', 'fixed'],
  ['attack.ice_lance', 'single', 'target', 'projectile', 'burst', 'fixed'],
  ['attack.blizzard', 'circle', 'target', 'ground', 'field', 'fixed'],
  ['attack.frostbite', 'single', 'target', 'instant', 'impact', 'fixed'],
  ['attack.chain_lightning', 'circle', 'target', 'instant', 'chain', 'fixed'],
  ['attack.spark', 'single', 'target', 'projectile', 'impact', 'fixed'],
  ['attack.thunder_strike', 'single', 'target', 'ground', 'impact', 'fixed'],
  ['attack.poison_bolt', 'single', 'target', 'projectile', 'impact', 'fixed'],
  ['attack.venom_spray', 'cone', 'caster', 'melee', 'impact', 'fixed'],
  ['attack.acid_arrow', 'single', 'target', 'projectile', 'impact', 'fixed'],
  ['attack.chaos_bolt', 'single', 'target', 'projectile', 'impact', 'fixed'],
  ['attack.void_blast', 'circle', 'target', 'ground', 'impact', 'fixed'],
  ['attack.sand_storm', 'circle', 'target', 'ground', 'field', 'fixed'],
  ['attack.earth_splitter', 'single', 'target', 'ground', 'impact', 'fixed'],
  ['attack.backstab', 'single', 'target', 'melee', 'impact', 'fixed'],
  ['attack.sidestep', 'single', 'target', 'melee', 'impact', 'fixed'],
  ['attack.impale', 'line', 'caster', 'melee', 'impact', 'fixed'],
  ['attack.skull_crack', 'single', 'target', 'melee', 'impact', 'fixed'],
  ['attack.ground_slam', 'circle', 'caster', 'melee', 'impact', 'fixed'],
  ['attack.bone_breaker', 'single', 'target', 'melee', 'impact', 'fixed'],
  ['attack.carnage', 'single', 'target', 'melee', 'impact', 'fixed'],
  ['attack.cleave_down', 'single', 'target', 'melee', 'impact', 'fixed'],
  ['attack.cleave', 'cone', 'caster', 'melee', 'impact', 'fixed'],
  ['attack.elemental_break', 'single', 'target', 'melee', 'impact', 'fixed'],
  ['attack.whirlwind', 'circle', 'caster', 'melee', 'channel', 'caster-feet'],
  ['attack.shield_bash', 'single', 'target', 'melee', 'impact', 'fixed'],
  ['attack.puncture', 'single', 'target', 'melee', 'impact', 'fixed'],
  ['attack.reap', 'single', 'target', 'melee', 'impact', 'fixed'],
  ['attack.piercing_shot', 'line', 'caster', 'projectile', 'impact', 'fixed'],
  ['attack.arrow_shower', 'single', 'target', 'projectile', 'burst', 'fixed'],
  ['attack.headshot', 'single', 'target', 'projectile', 'impact', 'fixed'],
  ['attack.pierce_the_veil', 'single', 'target', 'projectile', 'impact', 'fixed'],
  ['attack.earth_shock', 'circle', 'target', 'ground', 'impact', 'fixed'],
  ['attack.detonate', 'single', 'target', 'ground', 'impact', 'fixed'],
  ['attack.shatter', 'circle', 'target', 'ground', 'impact', 'fixed'],
  ['attack.overload', 'circle', 'target', 'ground', 'burst', 'fixed'],
  ['attack.catalyst', 'single', 'target', 'instant', 'impact', 'fixed'],
  ['attack.ruin', 'single', 'target', 'instant', 'impact', 'fixed'],
  ['attack.aftershock', 'circle', 'caster', 'ground', 'impact', 'fixed'],
];

describe('skill spatial handoff', () => {
  it('resolves every live attack to the normalized contract', () => {
    const resolved = Object.fromEntries(ATTACKS.map(([id]) => [id, skillHandoffById(id)]));
    const expected = Object.fromEntries(ATTACKS.map(([id, shape, origin, delivery, lifecycle, follow]) => [id, {
      id, shape, origin, delivery, lifecycle,
      selfArea: shape === 'circle' && origin === 'caster',
      groundArea: follow === 'fixed',
      follow,
    }]));
    expect(resolved).toEqual(expected);
  });
  it('keeps support rows on state/recipient lifecycles without hit geometry', () => {
    expect(skillHandoffById('buff.warcry')).toEqual({ id: 'buff.warcry', shape: 'single', origin: 'target',
      delivery: 'instant', lifecycle: 'state', selfArea: false, groundArea: true, follow: 'fixed' });
    expect(skillHandoffById('heal.heal')).toEqual({ id: 'heal.heal', shape: 'single', origin: 'target',
      delivery: 'instant', lifecycle: 'state', selfArea: false, groundArea: true, follow: 'fixed' });
    expect(skillHandoffById('curse.weaken')).toEqual({ id: 'curse.weaken', shape: 'single', origin: 'target',
      delivery: 'instant', lifecycle: 'impact', selfArea: false, groundArea: true, follow: 'fixed' });
    expect(skillHandoffById('aura.wraith_of_fury')).toEqual({ id: 'aura.wraith_of_fury', shape: 'single',
      origin: 'target', delivery: 'instant', lifecycle: 'state', selfArea: false, groundArea: true, follow: 'fixed' });
  });
  it('returns undefined for unknown ids and normalizes legacy rows without an area', () => {
    expect(skillHandoffById('attack.nope')).toBeUndefined();
    expect(skillHandoffFor({ id: 'legacy' })).toEqual({ id: 'legacy', shape: 'single', origin: 'target',
      delivery: 'instant', lifecycle: 'impact', selfArea: false, groundArea: true, follow: 'fixed' });
  });
  it('lets committed instance facts confirm the anchor without widening it', () => {
    expect(skillHandoffById('attack.whirlwind', { channel: true })?.follow).toBe('caster-feet');
    expect(skillHandoffById('attack.whirlwind', { follow: true })?.follow).toBe('caster-feet');
    expect(skillHandoffById('attack.whirlwind', { channel: false })?.follow).toBe('fixed');
    expect(skillHandoffById('attack.ice_lance', { follow: true })?.follow).toBe('fixed');
    expect(skillHandoffById('attack.ground_slam', { channel: true, follow: true })?.follow).toBe('fixed');
  });
});
