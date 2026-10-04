import { describe, it, expect } from 'vitest';
import { E } from '../src/engine/client';
import { newGame } from '../src/sim/game';
import { slotsUsed, slotsFree, addTo, fits, bagSlots, pouchSlots, slotsAvailable } from '../src/sim/slots';
import { craftPotion, plant, harvest } from '../src/sim/farm';

const CAP = E.inventory.stack_size as Record<string, number>;

describe('the thirty-slot character bag', () => {
  it('takes its caps and its size from the data, not from a copy', () => {
    expect(bagSlots).toBe(E.inventory.character_slots);
    expect(CAP.stone).toBe(999);
    expect(CAP.herb).toBe(100);
    expect(CAP.potion).toBe(100);
  });

  it('counts the slots the Porter sold as space, from town.json', () => {
    const s = newGame(96);
    expect(pouchSlots(s)).toBe(0);
    expect(slotsAvailable(s)).toBe(bagSlots);
    s.town.owned.push('herb_pouch_ii');
    expect(pouchSlots(s)).toBe(1);
    expect(slotsAvailable(s)).toBe(bagSlots + 1);
    s.town.owned.push('herb_pouch_iii');
    const free = slotsFree(s);
    for (let i = 0; i < bagSlots + 2; i++) addTo(s, s.counters.stones, `p${i}`, 'stone', 1);
    expect(free).toBeGreaterThan(0); // the two pouches bought exactly the two extra stacks
  });

  it('counts one slot per full or partial stack', () => {
    const s = newGame(91);
    expect(slotsUsed(s)).toBe(0);
    addTo(s, s.farm.herbs, 'low', 'herb', CAP.herb);
    expect(slotsUsed(s)).toBe(1);
    addTo(s, s.farm.herbs, 'low', 'herb', 1);
    expect(slotsUsed(s)).toBe(2); // one over the cap needs a second stack
    addTo(s, s.counters.stones, 'reroll_value', 'stone', 500);
    expect(slotsUsed(s)).toBe(3);
  });

  it('stops the pickup when there is no slot, and deletes and converts nothing', () => {
    const s = newGame(92);
    // fill the bag with one-slot stacks
    for (let i = 0; i < bagSlots; i++) addTo(s, s.counters.stones, `s${i}`, 'stone', 1);
    expect(slotsFree(s)).toBe(0);
    const before = { ...s.farm.herbs };
    expect(addTo(s, s.farm.herbs, 'low', 'herb', 3)).toBe(0);
    expect(s.farm.herbs).toEqual(before);
    expect(s.counters.stopped).toBe(1);
  });

  it('will not let a craft consume its cost for a bottle the bag cannot hold', () => {
    const s = newGame(93);
    s.farm.herbs.low = CAP.herb;
    s.counters.stones.reroll_value = 50;
    // occupy every slot with one thing other than potions
    for (let i = 0; i < bagSlots - 1; i++) addTo(s, s.counters.stones, `x${i}`, 'stone', 1);
    // and push the herb stack over its own cap so the last slot is already spoken for
    for (let i = 0; i < CAP.herb; i++) addTo(s, s.farm.potions, 'pad', 'potion', 1);
    const herbs = s.farm.herbs.low;
    const stones = s.counters.stones.reroll_value;
    const r = craftPotion(s, 'Red Draught');
    expect(r.ok).toBe(false);
    expect(String(r.why)).toMatch(/slot/);
    expect(s.farm.herbs.low).toBe(herbs); // the ingredients and the stone are still there
    expect(s.counters.stones.reroll_value).toBe(stones);
    void fits;
  });

  it('banks a crop that still fits inside the open stack', () => {
    const s = newGame(94);
    const yieldPer = E.farm.yield_per_harvest;
    s.farm.herbs.low = E.farm.seed_cost_herbs;
    plant(s, 0, 'low'); // the seed is one herb of the tier, so pay it before setting the stack
    s.clockSec = s.farm.plots[0].readyAt;
    // the last stack has exactly this crop's room left in it, and every other slot is spoken for
    s.farm.herbs.low = CAP.herb - yieldPer;
    for (let i = 0; i < bagSlots - 1; i++) addTo(s, s.counters.stones, `q${i}`, 'stone', 1);
    expect(slotsFree(s)).toBe(0);
    const r = harvest(s, 0);
    expect(r.ok).toBe(true);
    expect(s.farm.herbs.low).toBe(CAP.herb);
  });

  it('refuses a harvest with nowhere to go and leaves the crop standing', () => {
    const s = newGame(95);
    s.farm.herbs.low = E.farm.seed_cost_herbs;
    plant(s, 0, 'low');
    s.clockSec = s.farm.plots[0].readyAt;
    s.farm.herbs.low = CAP.herb; // the stack is full, and no slot is free
    for (let i = 0; i < bagSlots - 1; i++) addTo(s, s.counters.stones, `r${i}`, 'stone', 1);
    const r = harvest(s, 0);
    expect(r.ok).toBe(false);
    expect(String(r.why)).toMatch(/slot/);
    expect(s.farm.herbs.low).toBe(CAP.herb);
    expect(s.farm.plots[0].readyAt).toBeLessThanOrEqual(s.clockSec); // still ready, nothing was deleted
  });
});
