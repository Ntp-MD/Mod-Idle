import { describe, it, expect } from 'vitest';
import { E, sm } from '../src/engine/client';
import { newPresets, storePreset, switchPreset, bindZone, autoSelect } from '../src/sim/presets';
import { newGame, tick, setLevel } from '../src/sim/game';

describe('six sets, one of them main', () => {
  it('comes straight from engine.json', () => {
    expect(E.presets.sets).toBe(6);
    expect(sm.presetCount).toBe(6);
    expect(sm.mainPreset).toBe(0);
    const s = newGame(3);
    expect(s.presets.length).toBe(6);
    expect(s.presets[0].name).toBe('Main');
    expect(s.activePreset).toBe(0);
  });

  it('stores and reloads a loadout without touching account-wide progress', () => {
    const s = newGame(4);
    s.skills.owned['attack.cleave'] = 2;
    s.skills.xp['attack.cleave'] = 500;
    s.skills.list[0] = 'attack.cleave';
    storePreset(s);
    s.presets[1].list = [...s.skills.list];
    s.skills.list[0] = null;
    const before = { ...s.skills.cd };
    switchPreset(s, 1);
    expect(s.activePreset).toBe(1);
    expect(s.skills.list[0]).toBe('attack.cleave');
    expect(s.skills.owned['attack.cleave']).toBe(2);
    expect(s.skills.xp['attack.cleave']).toBe(500);
    expect(s.skills.cd).toEqual(before);
  });

  it('a Push brings the Main set back and keeps running cooldowns', () => {
    const s = newGame(5);
    setLevel(s, 60);
    s.skills.list[0] = 'attack.cleave';
    s.skills.owned['attack.cleave'] = 0;
    storePreset(s);
    switchPreset(s, 2);
    s.skills.cd['attack.cleave'] = 7.5;
    s.player.hp = -100000;
    tick(s, {});
    expect(s.activePreset).toBe(0);
    expect(s.skills.cd['attack.cleave']).toBeGreaterThan(6);
    expect(s.log.some((l) => /Main preset/.test(l.text))).toBe(true);
  });

  it('the game picks the set bound to the zone on its own', () => {
    const s = newGame(6);
    s.presets[2].list[0] = 'attack.cleave';
    bindZone(s, 2, 3);
    expect(s.presets[2].zones).toContain(3);
    s.zone = 3;
    tick(s, {});
    expect(s.activePreset).toBe(2);
    expect(s.skills.list[0]).toBe('attack.cleave');
    // with no binding for a zone the current set simply stays (checked directly, no combat)
    bindZone(s, 2, 3);
    expect(autoSelect(s, 4)).toBe(null);
    expect(s.activePreset).toBe(2);
  });

  it('a fresh preset list is empty slots, not undefined', () => {
    const p = newPresets();
    expect(p.length).toBe(6);
    expect(p[0].list.every((x: string | null) => x === null)).toBe(true);
    expect(p[0].zones).toEqual([]);
  });
});
