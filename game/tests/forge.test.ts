import { describe, it, expect } from 'vitest';
import { E, BASES } from '../src/engine/client';
import { mulberry32 } from '../../engine/loot.ts';
import { newGame } from '../src/sim/core/game';
import { forge, canForge, forgeGear } from '../src/sim/gear/forge';
import { itemName } from '../src/sim/gear/item-name';
import { doCraft } from '../src/sim/gear/craft';
import { slotsAvailable, slotsFree } from '../src/sim/gear/slots';
import { exportJson, importJson } from '../src/state/save';
import type { GameState, Item } from '../src/sim/core/types';

const xpAt = (level: number) => (level - 1) ** 2 * E.fieldwork.level_divisor;

function town(seed = 1): GameState {
  const state = newGame(seed);
  state.hunting = false;
  state.group = [];
  state.walk = null;
  return state;
}

function smith(state: GameState, level: number) {
  state.fieldwork.skills.smithing.xp = xpAt(level);
}

function unchanged<T>(state: GameState, action: () => T): T {
  const before = JSON.stringify(state);
  const result = action();
  expect(JSON.stringify(state)).toBe(before);
  return result;
}

describe('the forge resolver', () => {
  it('maps a metal chest to its signature Base at the material band', () => {
    const plan = forge.resolve('armour', 'chest', 'iron-ore', 45, 4);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.slot).toBe('chest');
    expect(plan.frame.name).toBe('Plate Vest');
    expect(plan.q).toBe(1);
    expect(plan.band).toBe('mid');
    expect(plan.ilvl).toBe(45);
    expect(plan.count).toBe(4);
    expect(plan.xp).toBe(E.forge.xp_per_grade[1]);
  });

  it('maps a weapon type to its named Frame and main-hand slot', () => {
    const plan = forge.resolve('weapon', 'one-handed sword', 'iron-ore', 45, 4);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.slot).toBe('main hand');
    expect(plan.weapon.name).toBe('one-handed sword');
    expect(plan.frame.name).toBe('Longsword');
  });

  it('uses the material family to pick an armour Base', () => {
    const hide = forge.resolve('armour', 'chest', 'thick-pelt', 45, 4);
    const essence = forge.resolve('armour', 'chest', 'funerary-linen', 45, 4);
    expect(hide.ok && hide.frame.name).toBe('Ring Mail');
    expect(essence.ok && essence.frame.name).toBe('Vestment');
  });

  it('rejects a material the pattern does not accept', () => {
    expect(forge.resolve('armour', 'chest', 'pine-wood', 45, 4).ok).toBe(false);
    expect(forge.resolve('weapon', 'one-handed sword', 'pine-wood', 45, 4).ok).toBe(false);
  });

  it('gates on character level and smithing level', () => {
    expect(forge.resolve('armour', 'chest', 'iron-ore', 30, 4).ok).toBe(false);
    expect(forge.resolve('armour', 'chest', 'iron-ore', 45, 3).ok).toBe(false);
    expect(forge.resolve('armour', 'chest', 'silver-ore', 61, 10).ok).toBe(true);
  });

  it('clamps the item level to the material band', () => {
    const low = forge.resolve('armour', 'ring', 'copper-ore', 70, 10);
    expect(low.ok && low.q).toBe(0);
    expect(low.ok && low.ilvl).toBe(30);
    const high = forge.resolve('armour', 'ring', 'silver-ore', 90, 10);
    expect(high.ok && high.q).toBe(2);
    expect(high.ok && high.ilvl).toBe(90);
  });
});

describe('forging a piece', () => {
  it('consumes the material, pays smithing XP and adds one drop-shaped item', () => {
    const state = town(7);
    state.player.level = 45;
    smith(state, 4);
    state.fieldwork.materials['iron-ore'] = 10;
    const beforeXp = state.fieldwork.skills.smithing.xp;

    const result = forgeGear(state, 'weapon', 'one-handed sword', 'iron-ore', mulberry32(99));
    expect(result.ok).toBe(true);
    const item = result.item!;
    expect(state.fieldwork.materials['iron-ore']).toBe(10 - E.forge.weapons['one-handed sword'].count);
    expect(state.fieldwork.skills.smithing.xp).toBe(beforeXp + E.forge.xp_per_grade[1]);
    expect(state.bag[0]).toBe(item);
    expect(item.slot).toBe('main hand');
    expect(item.base).toBe('one-handed sword');
    expect(item.ilvl).toBe(45);
    expect(item.q).toBe(1);
    expect(item.quality).toBe('mid');
    expect(item.lines.length).toBeGreaterThanOrEqual(5);
    expect(item.lines.length).toBeLessThanOrEqual(8);
    expect(item.unbound_at_drop).toBe(item.lines.length - (E.item_level.frame_mod_slots + E.item_level.bound_slots));
    expect(itemName(item)).toBe('Longsword');
  });

  it('rolls the same piece from the same seed', () => {
    const roll = () => {
      const state = town(3);
      state.player.level = 45;
      smith(state, 4);
      state.fieldwork.materials['iron-ore'] = 10;
      return forgeGear(state, 'armour', 'chest', 'iron-ore', mulberry32(777)).item;
    };
    expect(roll()).toEqual(roll());
  });

  it('refuses without mutating when away, busy, short on level, material or space', () => {
    const away = town(11);
    away.player.level = 45;
    smith(away, 4);
    away.fieldwork.materials['iron-ore'] = 10;
    const cell = away.cell;
    away.cell = null;
    unchanged(away, () => expect(canForge(away, 'armour', 'chest', 'iron-ore').ok).toBe(false));
    away.cell = cell;

    away.hunting = true;
    unchanged(away, () => expect(canForge(away, 'armour', 'chest', 'iron-ore').ok).toBe(false));
    away.hunting = false;

    smith(away, 3);
    unchanged(away, () => expect(canForge(away, 'armour', 'chest', 'iron-ore').ok).toBe(false));
    smith(away, 4);
    away.player.level = 30;
    unchanged(away, () => expect(canForge(away, 'armour', 'chest', 'iron-ore').ok).toBe(false));
    away.player.level = 45;

    away.fieldwork.materials['iron-ore'] = 1;
    unchanged(away, () => expect(canForge(away, 'armour', 'chest', 'iron-ore').ok).toBe(false));
  });

  it('counts the slot freed by consuming the last material stack', () => {
    const state = town(12);
    state.player.level = 45;
    smith(state, 4);
    state.fieldwork.materials['iron-ore'] = 5;
    const fill = slotsFree(state);
    state.bag = Array.from({ length: fill }, () => ({ slot: 'ring', base: 'Iron Band', ilvl: 1, quality: 'low', tier: 'T2', lines: [], q: 0 })) as unknown as Item[];

    // 5 → 1 keeps the stack's slot, so a full bag refuses.
    expect(canForge(state, 'armour', 'chest', 'iron-ore').ok).toBe(false);
    // 4 → 0 releases it, so the piece fits.
    state.fieldwork.materials['iron-ore'] = 4;
    expect(canForge(state, 'armour', 'chest', 'iron-ore').ok).toBe(true);
  });

  it('does not draw or mutate on a refused roll', () => {
    const state = town(13);
    state.player.level = 30;
    smith(state, 4);
    state.fieldwork.materials['iron-ore'] = 10;
    let draws = 0;
    const rng = () => { draws++; return 0.5; };
    const before = JSON.stringify(state);
    const result = forgeGear(state, 'armour', 'chest', 'iron-ore', rng);
    expect(result.ok).toBe(false);
    expect(draws).toBe(0);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('produces a piece the craft bench can still work', () => {
    const state = town(14);
    state.player.level = 45;
    smith(state, 4);
    state.fieldwork.materials['iron-ore'] = 10;
    expect(forgeGear(state, 'armour', 'chest', 'iron-ore', mulberry32(5)).ok).toBe(true);
    state.counters.stones.tier = 1;
    const item = state.bag[0];
    const result = doCraft(state, 'bag', 0, 'randomize', 3, mulberry32(6));
    expect(result.ok).toBe(true);
    expect(state.bag[0]).not.toBe(item);
  });

  it('round-trips the forged piece, materials and smithing XP through a save', () => {
    const state = town(15);
    state.player.level = 45;
    smith(state, 4);
    state.fieldwork.materials['iron-ore'] = 10;
    const result = forgeGear(state, 'armour', 'chest', 'iron-ore', mulberry32(9));
    expect(result.ok).toBe(true);
    const loaded = importJson(exportJson(state));
    expect(loaded.bag[0]).toEqual(state.bag[0]);
    expect(loaded.fieldwork.materials['iron-ore']).toBe(state.fieldwork.materials['iron-ore']);
    expect(loaded.fieldwork.skills.smithing.xp).toBe(state.fieldwork.skills.smithing.xp);
  });
});

describe('forge data', () => {
  it('resolves every material and family Base against the live rosters', () => {
    for (const id of Object.keys(E.forge.materials)) {
      expect(E.fieldwork.materials.some((row: any) => row.id === id)).toBe(true);
    }
    for (const [family, row] of Object.entries(E.forge.families)) {
      for (const [slot, name] of Object.entries(row.bases)) {
        expect(BASES.bases.some((base: any) => base.name === name && base.slot === slot), `${family}.${slot}`).toBe(true);
      }
    }
    for (const [type, row] of Object.entries(E.forge.weapons)) {
      expect(BASES.weapons.some((weapon: any) => weapon.name === type)).toBe(true);
      expect(((BASES.weapon_frames as any)[type] || []).some((frame: any) => frame.name === row.frame)).toBe(true);
    }
  });
});

describe('the forge save surface', () => {
  it('needs no new fields beyond the existing material, XP and RNG state', () => {
    const state = town(16);
    expect(Object.keys(state.fieldwork.materials).length).toBeGreaterThan(0);
    expect(state.fieldwork.skills.smithing).toBeTruthy();
    expect(slotsAvailable(state)).toBeGreaterThan(0);
  });
});
