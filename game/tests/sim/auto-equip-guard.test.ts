import { describe, expect, it } from 'vitest';
import { BASES, loot } from '../../src/engine/client';
import { newGame } from '@sim/core/game';
import { autoEquip, rotationFit, wouldBreakRotation } from '@sim/gear/gear';
import type { Item } from '@sim/core/types';

const weapon = (base: string): Item => ({ slot: 'main hand', base, lines: [] } as unknown as Item);
const scoredWeapon = (base: string, value: number): Item =>
  ({ slot: 'main hand', base, ilvl: 20, quality: 'mid', tier: 'T1', q: 1, lines: [{ id: 'all_stat_flat', value, slice: 1 }] } as Item);

describe('P5 auto-equip — never silently disarm the rotation', () => {
  it('refuses a main-hand swap that leaves no slotted skill usable', () => {
    const s = newGame(11);
    const mainHand = loot.SLOTS.indexOf('main hand');
    expect(mainHand).toBeGreaterThanOrEqual(0);
    s.gear[mainHand] = weapon('bow');
    s.skills.list.fill(null);
    s.skills.list[0] = 'attack.piercing_shot';

    expect(wouldBreakRotation(s, weapon('bow'))).toBe(false);
    expect(wouldBreakRotation(s, weapon('one-handed sword'))).toBe(true);
    expect(BASES.weapon_frames['one-handed sword']).toBeDefined();
  });

  it('does nothing when nothing is slotted or the slot is not the main hand', () => {
    const s = newGame(11);
    s.skills.list.fill(null);
    s.gear[loot.SLOTS.indexOf('main hand')] = weapon('bow');
    expect(wouldBreakRotation(s, weapon('one-handed sword'))).toBe(false);
    expect(wouldBreakRotation(s, { ...weapon('one-handed sword'), slot: 'head' } as Item)).toBe(false);
  });

  it('names which rotation rows a candidate keeps and which it would silence', () => {
    const s = newGame(11);
    s.gear[loot.SLOTS.indexOf('main hand')] = weapon('bow');
    s.skills.list.fill(null);
    s.skills.list[0] = 'attack.piercing_shot';

    expect(rotationFit(s, weapon('bow'))).toEqual({ kept: ['attack.piercing_shot'], dropped: [] });
    expect(rotationFit(s, weapon('one-handed sword'))).toEqual({ kept: [], dropped: ['attack.piercing_shot'] });
  });

  it('reports the held-back upgrade and the silenced rows instead of claiming nothing beats worn', () => {
    const s = newGame(11);
    const mainHand = loot.SLOTS.indexOf('main hand');
    s.gear[mainHand] = scoredWeapon('bow', 1);
    s.skills.list.fill(null);
    s.skills.list[0] = 'attack.piercing_shot';
    s.bag = [scoredWeapon('one-handed sword', 999)];

    const r = autoEquip(s, 0);
    expect(r.swaps).toHaveLength(0);
    expect(r.rotationHeld?.skills).toEqual(['attack.piercing_shot']);
    expect(r.rotationHeld?.base).toContain('sword');
    expect(s.gear[mainHand]?.base).toBe('bow');
  });

  it('breaks an empty-cell Infinity tie on strength, not bag order', () => {
    const ring = (v: number): Item =>
      ({ slot: 'ring', base: 'Band', ilvl: 20, quality: 'mid', tier: 'T1', q: 1, lines: [{ id: 'all_stat_flat', value: v, slice: 1 }] } as Item);
    const s = newGame(11);
    s.gear[6] = null;
    s.gear[7] = null;
    s.bag = [ring(1), ring(99)];
    const r = autoEquip(s, 0);
    expect(r.swaps.length).toBeGreaterThan(0);
    expect(s.gear[6]!.lines[0].value).toBe(99);
  });
});
