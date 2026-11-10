import { describe, expect, it } from 'vitest';
import { readShowcaseBoot } from '../../src/app/showcase/boot';

describe('showcase boot parser', () => {
  it('returns null outside DEV and the showcase path', () => {
    expect(readShowcaseBoot('/__showcase', '', false)).toBeNull();
    expect(readShowcaseBoot('/', '?sample=combat-field', true)).toBeNull();
  });

  it('keeps the current defaults', () => {
    expect(readShowcaseBoot('/__showcase/', '', true)).toMatchObject({
      sample: 'combat-field', spritePreview: true, aoePreview: false, vfx: null, effects: null,
      skill: null, mechanic: null, playerWeapon: null, playerOffhand: null,
    });
  });

  it('reads every supported query parameter', () => {
    const boot = readShowcaseBoot('/__showcase', '?sample=story-read-only&skill=attack.meteor&sprite-species=wolf&sprite-variant=wolf%2Fmoonfang-wolf&sprite-preview=fallback&mechanic=fire&player-weapon=sword&player-offhand=shield&aoe-preview=1&vfx=base&effects=reduced', true);
    expect(boot).toEqual({
      sample: 'story-read-only',
      skill: 'attack.meteor',
      spriteSpecies: 'wolf',
      spriteVariant: 'wolf/moonfang-wolf',
      spritePreview: false,
      mechanic: 'fire',
      playerWeapon: 'sword',
      playerOffhand: 'shield',
      aoePreview: true,
      vfx: 'base',
      effects: 'reduced',
    });
  });

  it('falls back on an unknown sample and ignores unknown effects/vfx values', () => {
    const boot = readShowcaseBoot('/__showcase', '?sample=nope&effects=ultra&vfx=weird', true);
    expect(boot).toMatchObject({ sample: 'combat-field', effects: null, vfx: 'auto' });
  });
});
