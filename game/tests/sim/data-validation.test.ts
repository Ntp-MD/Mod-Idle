import { describe, it, expect } from 'vitest';
import { validateEngineData } from '@engine/validate.ts';
import { K_KEYS } from '@engine/types.ts';
import { E, sm } from '../../src/engine/client';

/**
 * The canonical data is checked before anything reads it. Every case runs on a copy, so a bad
 * input is proved without the real file ever changing.
 */

/** A copy of the canonical data — the negative cases work on this, never on the file. */
const copy = (): any => structuredClone(E as any);

describe('the canonical data is checked before anything reads it', () => {
  it('loads the real file', () => {
    expect(() => validateEngineData(copy())).not.toThrow();
  });

  it('refuses an ordinary-attack profile with no usable shot', () => {
    const slow = copy();
    slow.combat_arena.normal_attack.profiles.ranged.projectile_speed_mps = 0;
    expect(() => validateEngineData(slow)).toThrow(/normal_attack\.profiles\.ranged\.projectile_speed_mps/);

    const missing = copy();
    delete missing.combat_arena.normal_attack.profiles.ranged;
    expect(() => validateEngineData(missing)).toThrow(/normal_attack\.profiles\.?ranged|legacy\.stand-off/);
  });

  it('refuses an ordinary-attack profile that cannot state or hold its reach', () => {
    const noBasis = copy();
    delete noBasis.combat_arena.normal_attack.profiles.melee.range.basis;
    expect(() => validateEngineData(noBasis)).toThrow(/normal_attack\.profiles\.melee\.range\.basis/);

    const overlap = copy();
    overlap.combat_arena.normal_attack.profiles.melee.range.meters = 0.01;
    expect(() => validateEngineData(overlap)).toThrow(/normal_attack\.profiles\.melee\.range\.meters/);

    const stopInside = copy();
    stopInside.combat_arena.normal_attack.profiles.ranged.range.meters = 0.5;
    expect(() => validateEngineData(stopInside))
      .toThrow(/normal_attack\.profiles\.ranged\.(stop_at_range_pct|range\.meters)/);

    const noPlayerMap = copy();
    delete noPlayerMap.combat_arena.normal_attack.player.magic;
    expect(() => validateEngineData(noPlayerMap)).toThrow(/normal_attack\.player\.magic/);
  });

  it('keeps every multi-impact action row executable', () => {
    const kinds = new Set(['projectile-burst', 'ground-pulse-burst', 'whirlwind-channel', 'blizzard-field', 'sand-field', 'chain-strike']);
    for (const row of Object.values(sm.byId)) {
      const action = (row as any).action;
      if (!action) continue;
      expect(kinds.has(action.kind), row.id).toBe(true);
      const hits = (row.effects || []).find((effect: any) => effect.stat === 'hits')?.value ?? 1;
      if (action.kind !== 'sand-field' && action.kind !== 'chain-strike') expect(hits, row.id).toBeGreaterThan(1);
      if (action.kind === 'chain-strike') {
        const count = Number(String((row as any).targets ?? '1').split('/')[0]) || 1;
        expect(count, row.id).toBeGreaterThan(1);
        expect((row as any).area?.radius_m, row.id).toBeGreaterThan(0);
      }
      if (action.kind === 'projectile-burst' || action.kind === 'blizzard-field') {
        expect((row.effects || []).find((effect: any) => effect.stat === 'hit_pct')?.value, row.id)
          .toBeGreaterThan(0);
      }
      if (action.kind === 'projectile-burst') expect(action.interval_sec, row.id).toBeGreaterThan(0);
      if (action.kind === 'ground-pulse-burst') expect(action.interval_sec, row.id).toBeGreaterThan(0);
      if (action.kind === 'blizzard-field') {
        expect(Number.parseFloat(String((row as any).duration ?? '')), row.id).toBeGreaterThan(0);
      }
      if (action.kind === 'sand-field') {
        expect((row.effects || []).find((effect: any) => effect.stat === 'dot_sec')?.value, row.id)
          .toBeGreaterThan(0);
        expect((row.effects || []).find((effect: any) => effect.stat === 'dot_dps')?.value, row.id)
          .toBeGreaterThan(0);
      }
      if (action.kind === 'whirlwind-channel') {
        expect(action.active_sec, row.id).toBeGreaterThan(0);
        expect(action.movement_speed_mult, row.id).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every authored footprint executable', () => {
    for (const row of Object.values(sm.byId)) {
      const area = (row as any).area;
      if (!area?.shape) continue;
      if (area.shape === 'line') {
        expect(area.origin, row.id).toBe('caster');
        expect(area.length_m, row.id).toBeGreaterThan(0);
        expect(area.width_m, row.id).toBeGreaterThan(0);
      }
      if (area.shape === 'cone') {
        expect(area.origin, row.id).toBe('caster');
        expect(area.radius_m, row.id).toBeGreaterThan(0);
        expect(area.angle_deg, row.id).toBeGreaterThan(0);
        expect(area.angle_deg, row.id).toBeLessThanOrEqual(180);
      }
    }
  });

  it('carries exactly the constants the engine declares', () => {
    expect(Object.keys(E.K).sort()).toEqual([...K_KEYS].sort());
  });

  it('names the constant the file lost', () => {
    const data = copy();
    delete data.K.K_VIT_HP;
    expect(() => validateEngineData(data)).toThrow(/K\.K_VIT_HP must be a finite number/);
  });

  it('names a constant that is not a number', () => {
    const data = copy();
    data.K.K_STR = 'twelve';
    expect(() => validateEngineData(data)).toThrow(/K\.K_STR must be a finite number/);
  });

  it('names the section the file lost', () => {
    const data = copy();
    delete data.max_hp_press;
    expect(() => validateEngineData(data)).toThrow(/max_hp_press is missing/);
  });

  it('names the value that is not a number', () => {
    const data = copy();
    data.stat.level_cap = '190';
    expect(() => validateEngineData(data)).toThrow(/stat\.level_cap must be a finite number/);
  });

  it('names a Cap that is neither a number nor an explicit null', () => {
    const data = copy();
    data.caps.evasion = 'eighty';
    expect(() => validateEngineData(data)).toThrow(/caps\.evasion must be a finite number or null/);
  });

  it('names the pair that is not a pair', () => {
    const data = copy();
    data.mob.zones[0].levels = [1];
    expect(() => validateEngineData(data)).toThrow(/mob\.zones\[0\]\.levels must be a pair of numbers/);
  });

  it('names the identity that is duplicated', () => {
    const data = copy();
    data.mob.species[1].id = data.mob.species[0].id;
    expect(() => validateEngineData(data)).toThrow(/mob\.species\[1\]\.id duplicates species id/);
  });

  it('names a Core block that lost an attribute', () => {
    const data = copy();
    data.mob.species[0].core.lck = undefined;
    expect(() => validateEngineData(data)).toThrow(/mob\.species\[0\]\.core\.lck must be a finite number/);
  });

  it('names a forge grade outside the three published bands', () => {
    const data = copy();
    data.forge.materials['iron-ore'].grade = 4;
    expect(() => validateEngineData(data)).toThrow(/forge\.materials\.iron-ore\.grade must be a whole number from 1 to 3/);
  });

  it('names a forge pattern without a positive material count', () => {
    const data = copy();
    data.forge.armour.chest.count = 0;
    expect(() => validateEngineData(data)).toThrow(/forge\.armour\.chest\.count must be a positive whole number/);
  });

  it('leaves the file it was given untouched', () => {
    const data = copy();
    const before = JSON.stringify(data);
    expect(() => validateEngineData(data)).not.toThrow();
    expect(JSON.stringify(data)).toBe(before);
  });
});
