import { liveId } from '../fixtures/liveSkill';
import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { activeVfxArt, vfxVersionsFor } from '../../src/ui/fx/catalog';
import { createCombatArena, type CombatArenaAction } from '@sim/combat/combat-arena';
import { skillActionGeometry, skillPayloadGeometry } from '../../src/ui/combat/skill-geometry';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { fieldPointM } from '../../src/presentation/view-transform';
import { atlasImpactDuration } from '../../src/ui/combat/arena-skill-art';
import { skillRainDrops } from '../../src/ui/combat/meteor-rain';
const RAIN = liveId(row => row.action?.kind === 'projectile-burst' && row.area?.radius_m > 0
  && !!activeVfxArt(row.id)?.atlas?.rainDurationSec, 'projectile impact rain');

describe('projectile impact rain', () => {
  const version = () => vfxVersionsFor(RAIN).find(row => row.default)!;
  const readAtlas = () => activeVfxArt(RAIN)!.atlas!;

  it('keeps impact rain independent of its single-target hit area', () => {
    const row = version();
    expect(row.default).toBe(true);
    const atlas = readAtlas();
    expect(atlas.authoring?.delivery).toBe('projectile');
    expect(atlas.authoring?.radiusM).toBe(0);
    expect(atlas.rainDurationSec).toBeGreaterThan(0);
    expect(atlas.rainSpreadM).toBeGreaterThan(0);
    expect(atlas.rainPhase).toBe('Impact');
    for (const range of [atlas.frames?.loop, atlas.frames?.exit]) if (range) {
      expect(range.every(index => Number.isInteger(index) && index >= 0)).toBe(true);
      expect(range[1]).toBeGreaterThanOrEqual(range[0]);
    }
    expect(sm.byId[RAIN].area?.radius_m).toBeGreaterThan(0);
  });

  it('uses the canonical burst receipts and restarts contact independently on each arrow', () => {
    const skill = sm.byId[RAIN];
    if (skill.action?.kind !== 'projectile-burst') throw new Error('Expected a committed projectile burst');
    const hits = Number(skill.effects?.find(effect => effect.stat === 'hits')?.value);
    const interval = Number(skill.action?.interval_sec);
    const units = 1_000_000, arena = createCombatArena();
    const action: CombatArenaAction = { id: 1, kind: 'cast', actorId: 'player', skillId: skill.id,
      x: 0, y: 0, targetX: 4, targetY: 2, atUs: 0, endsAtUs: 2 * units,
      timing: { delivery: 'projectile', startedAtUs: 0, releaseAtUs: .1 * units,
        impactAtUs: units, recoveryUntilUs: 1.2 * units },
      payloads: Array.from({ length: hits }, (_, index) => ({ index,
        source: { x: 0, y: 0 }, destination: { x: 4, y: 2 },
        releaseAtUs: (.1 + index * interval) * units,
        plannedImpactAtUs: (1 + index * interval) * units })) };
    const atlas = readAtlas();
    const time = (.1 + Math.min(hits - .5, 2) * interval) * units;
    const frame = createFieldViewFrame({ sceneKey: 'test', atUs: time,
      viewportCss: { width: 1920, height: 1080 }, focusM: fieldPointM(0, 0), worldScale: 1 });
    const mark = skillActionGeometry(action, arena, time, units)!;
    const shots = skillPayloadGeometry(mark, action, time, units, atlasImpactDuration(atlas));
    expect(shots).toHaveLength(action.payloads!.filter(payload => payload.releaseAtUs <= time).length);
    expect(new Set(shots.map(shot => shot.key)).size).toBe(shots.length);
    for (const shot of shots) {
      expect(shot.phase).toBe('Travel');
      expect(skillRainDrops(shot, frame, atlas)).toEqual([]);
    }
    const contactAt = 1.01 * units;
    const contacts = skillPayloadGeometry(skillActionGeometry(action, arena, contactAt, units)!,
      action, contactAt, units, atlasImpactDuration(atlas));
    expect(contacts[0].phase).toBe('Impact');
    const before = JSON.stringify(action);
    const rain = skillRainDrops(contacts[0], frame, atlas);
    expect(rain.length).toBeGreaterThan(0);
    expect(new Set(rain.map(drop => `${drop.ground.x}:${drop.ground.y}`)).size).toBe(rain.length);
    expect(rain.some(drop => Math.hypot(drop.ground.x - 4, drop.ground.y - 2) > .1)).toBe(true);
    expect(contacts[0].area.radiusM).toBe(skill.area!.radius_m);
    expect(contacts.slice(1).every(shot => shot.phase === 'Travel')).toBe(true);
    expect(contacts.slice(1).flatMap(shot => skillRainDrops(shot, frame, atlas))).toEqual([]);
    const lateAt = (1 + (hits - 1) * interval + .1) * units;
    const late = skillPayloadGeometry(skillActionGeometry(action, arena, lateAt, units,
      undefined, undefined, atlasImpactDuration(atlas))!,
      action, lateAt, units, atlasImpactDuration(atlas));
    expect(late.length).toBeGreaterThan(0);
    expect(late.some(shot => skillRainDrops(shot, frame, atlas).length > 0)).toBe(true);
    expect(JSON.stringify(action)).toBe(before);
  });
});
