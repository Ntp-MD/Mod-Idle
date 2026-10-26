import { describe, it, expect } from 'vitest';
import { newGame } from '../src/sim/core/game';
import { buildCharacter } from '../src/sim/core/player';
import { drink, cycleQuickbar, ownedPotions, maybeDrink } from '../src/sim/world/farm';
import { migrate } from '../src/state/save';
import { farm } from '../src/engine/client';

describe('potions', () => {
  it('still auto-uses carried mana when HP is low but no HP bottle is available', () => {
    const s = newGame(), c = buildCharacter(s.player.level, s.gear, {}, 0);
    s.player.hp = s.player.mana = 1;
    s.farm.potions['Red Draught'] = 0;
    expect(maybeDrink(s, c, false)?.name).toBe('Sky Draught');
    expect(s.player.mana).toBeGreaterThan(1);
    expect(s.farm.potions['Sky Draught']).toBe(0);
    expect(s.farm.usesThisFight).toBe(1);
  });

  it('does not fall back to mana when mana auto-use is disabled', () => {
    const s = newGame(), c = buildCharacter(s.player.level, s.gear, {}, 0);
    s.player.hp = s.player.mana = 1;
    s.farm.potions['Red Draught'] = 0; s.farm.autoUse.mana = false;
    const before = structuredClone(s);
    expect(maybeDrink(s, c, false)).toBeNull();
    expect(s).toEqual(before);
  });
  it('opens with no worn gear and one HP + one mana draught', () => {
    const s = newGame();
    expect(s.gear.every((g) => g === null)).toBe(true);
    expect(s.farm.potions['Red Draught']).toBe(1);
    expect(s.farm.potions['Sky Draught']).toBe(1);
  });

  it('drinking a draught fills its pool and spends the bottle', () => {
    const s = newGame();
    const c = buildCharacter(s.player.level, s.gear, {}, 0);
    s.player.hp = 1;
    const r = drink(s, c, 'Red Draught', false);
    expect(r.ok).toBe(true);
    expect(s.player.hp).toBeGreaterThan(1);
    expect(s.farm.potions['Red Draught']).toBe(0);
    expect(s.farm.usesThisFight).toBe(1);
  });

  it('shares one cooldown: a second sip lands only after it clears', () => {
    const s = newGame();
    const c = buildCharacter(s.player.level, s.gear, {}, 0);
    s.player.hp = 1;
    s.player.mana = 1;
    expect(drink(s, c, 'Red Draught', false).ok).toBe(true);
    expect(drink(s, c, 'Sky Draught', false).ok).toBe(false);
    s.clockSec += farm.P.shared_cooldown_sec;
    expect(drink(s, c, 'Sky Draught', false).ok).toBe(true);
  });

  it('the White Potion fills both pools at once', () => {
    const s = newGame();
    const c = buildCharacter(s.player.level, s.gear, {}, 0);
    s.player.hp = 1;
    s.player.mana = 1;
    s.farm.potions['White Potion'] = 1;
    expect(drink(s, c, 'White Potion', false).ok).toBe(true);
    expect(s.player.hp).toBeGreaterThan(1);
    expect(s.player.mana).toBeGreaterThan(1);
  });

  it('boss fights suppress drinking', () => {
    const s = newGame();
    const c = buildCharacter(s.player.level, s.gear, {}, 0);
    s.player.hp = 1;
    expect(drink(s, c, 'Red Draught', true).ok).toBe(false);
    expect(s.farm.potions['Red Draught']).toBe(1);
  });

  it('the quickbar opens as seven empty squares and cycles to carried draughts', () => {
    const s = newGame();
    expect(s.quickbar).toEqual(new Array(7).fill(null));
    expect(cycleQuickbar(s, 0)).toBe('Red Draught');
    expect(cycleQuickbar(s, 0)).toBe('Sky Draught');
    expect(cycleQuickbar(s, 0)).toBe(null);
    expect(ownedPotions(s)).toEqual(['Red Draught', 'Sky Draught']);
  });

  it('an old save without a quickbar gains seven empty squares on migrate', () => {
    const s = newGame();
    delete (s as any).quickbar;
    const m = migrate(s, 17);
    expect(m.quickbar).toEqual(new Array(7).fill(null));
  });
});
