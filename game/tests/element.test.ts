import { describe, it, expect } from 'vitest';
import { E } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { playerSwing } from '../src/sim/combat';
import { mulberry32 } from '../src/engine/client-helpers';
import { newGame, tick } from '../src/sim/game';
import type { Item, Mob } from '../src/sim/types';

const mobOf = (innate: string[]): Mob => ({
  id: 'm', species: 'Slime', kind: 'Small', zone: 1, level: 20, hp: 1e9, hpMax: 1e9,
  ps: 100, acc: 100, evasion: 0, dodgeRate: 0, armour: 0, res: 0, damage: 'mixed',
  innate, xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0,
} as Mob);

/** A main hand that carries one Elemental line, so the piece has a stored Element. */
const weaponWith = (element: string | null): (Item | null)[] => {
  const gear = emptyGear();
  const at = gear.findIndex((_, i) => i === 10); // main hand index in loot.SLOTS
  gear[at] = {
    slot: 'main hand', base: 'one-handed sword', rarity: 'Common', quality: 'low', tier: 'T3',
    weaponAspd: 1.2, q: 0,
    lines: [{ id: 'elemental_power_flat', value: 40, slice: 0, element }],
  };
  return gear;
};

const SWING = () => mulberry32(3);

describe('a weapon carries the Element its own line stores', () => {
  it('reads it off the piece, not off the weapon type', () => {
    expect(buildCharacter(40, weaponWith('fire')).weaponElement).toBe('fire');
    expect(buildCharacter(40, weaponWith(null)).weaponElement).toBe(null);
    expect(buildCharacter(40, emptyGear()).weaponElement).toBe(null);
  });

  it('scales only the Elemental share, the way the counter is defined', () => {
    const c = buildCharacter(40, weaponWith('chaos'));
    const share = c.elem * (c.alignment / 100);
    expect(share).toBeGreaterThan(0);

    // chaos is 1.15 against everything including itself (elements.md)
    const chaos = playerSwing(SWING(), c, mobOf(['chaos']), c.weaponElement).damage;
    const plain = playerSwing(SWING(), buildCharacter(40, weaponWith(null)), mobOf(['chaos']), null).damage;
    expect(chaos).toBeCloseTo(plain + share * (E.elements.counter.chaos.chaos - 1), 6);

    // a same-Element hit also pays the weak line, still on the Elemental share only
    const fire = buildCharacter(40, weaponWith('fire'));
    const weakHit = playerSwing(SWING(), fire, mobOf(['fire']), fire.weaponElement).damage;
    const coldMob = playerSwing(SWING(), fire, mobOf(['cold']), fire.weaponElement).damage;
    const noElement = playerSwing(SWING(), buildCharacter(40, weaponWith(null)), mobOf(['fire']), null).damage;
    expect(weakHit).toBeCloseTo(noElement + share * (E.elements.weak_mult * E.elements.counter.fire.fire - 1), 6);
    // fire against cold is the 0.60 counter pair, so the Elemental share shrinks and physical does not
    expect(coldMob).toBeCloseTo(noElement + share * (E.elements.counter.fire.cold - 1), 6);
  });

  it('counters each Element of one weapon separately, the PoE way', () => {
    const gear = emptyGear();
    gear[10] = {
      slot: 'main hand', base: 'one-handed sword', rarity: 'Rare', quality: 'mid', tier: 'T2',
      weaponAspd: 1.2, q: 1,
      lines: [
        { id: 'elemental_power_flat', value: 60, slice: 0, element: 'fire' },
        { id: 'elemental_power_flat', value: 40, slice: 0, element: 'cold' },
      ],
    } as unknown as Item;
    const c = buildCharacter(40, gear);
    const align = c.alignment / 100;
    const fire = c.elemByElement.fire, cold = c.elemByElement.cold;
    expect(Object.keys(c.elemByElement)).toEqual(['fire', 'cold']);
    expect(fire).toBeGreaterThan(cold); // the K_ELEM base rides with the piece's own Element
    expect(fire + cold).toBeCloseTo(c.elem, 6); // and the split never invents or loses pool

    // against a fire monster: the fire part takes the weak line, the cold part the counter pair
    const vsFire = playerSwing(SWING(), c, mobOf(['fire']), 'fire').damage;
    const neutral = playerSwing(SWING(), { ...c, elemByElement: {}, elem: 0, phys: c.phys, magic: c.magic }, mobOf(['fire']), null).damage;
    const expected = neutral + (fire * align * E.elements.weak_mult * E.elements.counter.fire.fire
      + cold * align * E.elements.counter.cold.fire);
    expect(vsFire).toBeCloseTo(expected, 6);
    expect(vsFire).not.toBeCloseTo(neutral, 6);
  });

  it('leaves a build with no Elemental damage exactly as strong as before', () => {
    const c = buildCharacter(40, weaponWith('fire'));
    const withNoElement = { ...c, elem: 0, alignment: 0 };
    const a = playerSwing(SWING(), withNoElement, mobOf(['fire']), 'fire').damage;
    const b = playerSwing(SWING(), withNoElement, mobOf(['cold']), null).damage;
    expect(a).toBeCloseTo(b, 10);
  });

  it('is in play inside the sim, where a counter pair is a normal fact of the zone', () => {
    const s = newGame(71);
    s.player.level = 40;
    s.zone = 4; // a lightning zone, so a fire weapon sits in the 0.60 counter pair
    s.gear = weaponWith('fire');
    for (let i = 0; i < 600; i++) tick(s, {});
    expect(buildCharacter(s.player.level, s.gear, {}, 0).weaponElement).toBe('fire');
    expect(s.counters.kills).toBeGreaterThan(0);
  });
});
