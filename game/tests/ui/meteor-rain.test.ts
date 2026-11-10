import { describe, expect, it } from 'vitest';
import { skillRainDrops } from '../../src/ui/combat/meteor-rain';
import type { SkillGeometry } from '../../src/ui/combat/skill-geometry';
import type { VfxAtlas } from '../../src/ui/fx/catalog';
import { sm } from '../../src/engine/client';
import { createCombatArena, captureCombatArena } from '@sim/combat/combat-arena';
import { newGame } from '@sim/core/game';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { fieldPointM } from '../../src/presentation/view-transform';
import { skillActionGeometry } from '../../src/ui/combat/skill-geometry';

const atlas = { count: 16, rainDurationSec: 4 } as VfxAtlas;
const blizzardAtlas: VfxAtlas = { ...atlas, rainPhase: 'Field', rainIntervalSec: .09,
  rainSizeScale: .5, rainRadiusRatio: .98 };
const blizzardDuration = sm.skillDurationSec(sm.byId['attack.blizzard'].duration);
const BODY_M = { width: 60 / 140, height: 132 / 140 };
const frame = createFieldViewFrame({
  sceneKey: 'test', atUs: 0,
  viewportCss: { width: 1920, height: 1080 },
  focusM: fieldPointM(4, 3), worldScale: 1,
});
const mark = { key: 'action-7', phase: 'Impact', phaseElapsedSec: 0,
  bodyM: { ...BODY_M }, area: { center: { x: 4, y: 3 }, radiusM: 3 } } as SkillGeometry;

describe('Meteor atlas rain', () => {
  it('retains the cast through live Meteor rain even after its combat action finishes', () => {
    const arena = createCombatArena();
    arena.actions.push({ id: 1, kind: 'cast', actorId: 'player', skillId: 'attack.meteor',
      x: 0, y: 0, atUs: 0, endsAtUs: 800_000,
      timing: { delivery: 'ground', startedAtUs: 0, releaseAtUs: 500_000,
        impactAtUs: 500_000, recoveryUntilUs: 800_000 } });
    const atUs = (0.5 + atlas.rainDurationSec! - .01) * arena.unitsPerSec;
    captureCombatArena(arena, newGame(17), atUs);
    expect(arena.actions).toHaveLength(1);
    const geometry = skillActionGeometry(arena.actions[0], arena, atUs, arena.unitsPerSec,
      undefined, undefined, atlas.rainDurationSec)!;
    expect(geometry).toBeDefined();
    expect(skillRainDrops(geometry, frame, atlas).length).toBeGreaterThan(0);
  });
  it('keeps Meteor rain populated and spread out from first impact through its last moment', () => {
    const meteorAtlas = { ...atlas, src: '/meteor.png', rainRadiusRatio: .98 };
    const counts: number[] = [];
    for (const time of [0, .05, .5, 1.5, 2.5, 3.5, 3.99]) {
      const sample = { ...mark, skillId: 'attack.meteor', phaseElapsedSec: time };
      const drops = skillRainDrops(sample, frame, meteorAtlas);
      const radii = drops.map(drop => Math.hypot(drop.ground.x - 4, drop.ground.y - 3) / (3 * .98));
      expect(Math.min(...radii)).toBeLessThan(.6);
      expect(Math.max(...radii)).toBeGreaterThan(.8);
      expect(new Set(drops.map(drop => `${drop.ground.x >= 4}:${drop.ground.y >= 3}`)).size).toBe(4);
      counts.push(drops.filter(drop => drop.opacity > .1).length);
    }
    expect(Math.min(...counts)).toBeGreaterThan(0);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
    expect(skillRainDrops({ ...mark, skillId: 'attack.meteor', phaseElapsedSec: 4 }, frame, meteorAtlas)).toEqual([]);
  });
  it('keeps Meteor impact rain in its authored diagonal instead of tilting it vertical', () => {
    const meteorAtlas = { ...atlas, src: '/meteor.png', rainPhase: 'Impact' as const };
    const field = { ...mark, skillId: 'attack.meteor', phase: 'Field' as const, phaseElapsedSec: .15 };
    const drop = skillRainDrops(field, frame, meteorAtlas)[0];
    expect(drop).toBeDefined();
    expect(drop.rotationDeg).toBe(0);
  });

  it('strikes Thunder Storm bolts as rooted flashes instead of falling rain', () => {
    const stormAtlas = { ...atlas, count: 1, src: '/forked-bolt.png', rainPhase: 'Impact' as const,
      rainIntervalSec: .25, rainSizeScale: .4, rainRadiusRatio: .9 };
    const field = { ...mark, skillId: 'attack.thunder_storm', phase: 'Field' as const, phaseElapsedSec: .15 };
    const drop = skillRainDrops(field, frame, stormAtlas)[0];
    expect(drop).toBeDefined();
    expect(drop.rotationDeg).toBe(0);
    expect(drop.x).toBe(drop.ground.x);
    expect(drop.y).toBe(drop.ground.y);
    const landing = skillRainDrops({ ...field, phaseElapsedSec: .6 }, frame, stormAtlas).find(candidate => candidate.id === 0)!;
    expect(landing.fragments).toEqual([]);
    expect(landing.opacity).toBeLessThan(drop.opacity);
    expect(skillRainDrops({ ...field, phase: 'Windup' }, frame, stormAtlas)).toEqual([]);
    expect(skillRainDrops({ ...field, phaseElapsedSec: 4 }, frame, stormAtlas)).toEqual([]);
  });

  it('staggers drops inside the committed circle throughout four seconds with bounded overlap', () => {
    const seen = new Map<number, number>();
    for (let time = 0; time < 4; time += .025) {
      const drops = skillRainDrops({ ...mark, phaseElapsedSec: time }, frame, atlas);
      expect(drops.length).toBeLessThanOrEqual(8);
      for (const drop of drops) {
        seen.set(drop.id, drop.start);
        expect(Math.hypot(drop.ground.x - 4, drop.ground.y - 3)).toBeLessThanOrEqual(3);
        expect(drop.index).toBeGreaterThanOrEqual(0);
        expect(drop.index).toBeLessThan(16);
      }
    }
    expect(seen.size).toBeGreaterThan(20);
    expect(new Set(seen.values()).size).toBe(seen.size);
    expect(skillRainDrops({ ...mark, phaseElapsedSec: 3.9 }, frame, atlas).length).toBeGreaterThan(0);
    expect(skillRainDrops({ ...mark, phaseElapsedSec: 4 }, frame, atlas)).toEqual([]);
  });

  it('replays deterministically, hides before impact, and supports reduced motion', () => {
    const sample = { ...mark, phaseElapsedSec: 1.5 };
    const drops = skillRainDrops(sample, frame, atlas);
    expect(drops).toEqual(skillRainDrops(sample, frame, atlas));
    // Body-relative size in world metres: 132 ref px at 140 px/m, scaled by the rain factor.
    expect(new Set(drops.map(drop => drop.size))).toEqual(new Set([132 / 140 * 7.5]));
    expect(skillRainDrops({ ...sample, phase: 'Windup' }, frame, atlas)).toEqual([]);
    expect(skillRainDrops(sample, frame, { ...atlas, rainDurationSec: undefined })).toEqual([]);
    expect(skillRainDrops(sample, frame, atlas, true).every(drop => drop.index === 8)).toBe(true);
  });

  it('uses the Blizzard field duration and keeps equal sized ice cells on the field', () => {
    const field: SkillGeometry = { ...mark, skillId: 'attack.blizzard', phase: 'Field', phaseElapsedSec: blizzardDuration - .5 };
    const drops = skillRainDrops(field, frame, blizzardAtlas);
    expect(drops.length).toBeGreaterThan(0);
    expect(new Set(drops.map(drop => drop.size))).toEqual(new Set([132 / 140 * 7.5 * .5]));
    expect(skillRainDrops({ ...field, phaseElapsedSec: blizzardDuration }, frame, blizzardAtlas)).toEqual([]);
    expect(skillRainDrops({ ...field, phase: 'Impact' }, frame, blizzardAtlas)).toEqual([]);
  });

  it('covers centre and edge at the beginning, middle and end without thinning out', () => {
    const counts: number[] = [];
    for (const time of [0, .15, .75, blizzardDuration / 2, blizzardDuration - .15, blizzardDuration - .01]) {
      const drops = skillRainDrops({ ...mark, skillId: 'attack.blizzard', phase: 'Field', phaseElapsedSec: time }, frame, blizzardAtlas);
      const radii = drops.map(drop => Math.hypot(drop.ground.x - 4, drop.ground.y - 3) / (3 * .98));
      counts.push(drops.filter(drop => drop.opacity > .1).length);
      expect(Math.min(...radii)).toBeLessThan(.55);
      expect(Math.max(...radii)).toBeGreaterThan(.85);
      expect(new Set(drops.map(drop => `${drop.ground.x >= 4}:${drop.ground.y >= 3}`)).size).toBe(4);
    }
    expect(Math.min(...counts)).toBeGreaterThan(0);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
    expect(skillRainDrops({ ...mark, skillId: 'attack.blizzard', phase: 'Field', phaseElapsedSec: blizzardDuration }, frame, blizzardAtlas)).toEqual([]);
  });

  it('decorrelates layers while keeping each drop fixed and replay deterministic', () => {
    const field = { ...mark, skillId: 'attack.blizzard', phase: 'Field' as const, phaseElapsedSec: 3 };
    const first = skillRainDrops(field, frame, { ...blizzardAtlas, src: '/ice-a.png' });
    const second = skillRainDrops(field, frame, { ...blizzardAtlas, src: '/ice-b.png' });
    expect(first.map(drop => drop.ground)).not.toEqual(second.map(drop => drop.ground));
    const later = skillRainDrops({ ...field, phaseElapsedSec: 3.1 }, frame, { ...blizzardAtlas, src: '/ice-a.png' });
    for (const drop of first) {
      const persisted = later.find(candidate => candidate.id === drop.id);
      if (persisted) expect(persisted.ground).toEqual(drop.ground);
    }
    expect(first).toEqual(skillRainDrops(field, frame, { ...blizzardAtlas, src: '/ice-a.png' }));
  });

  it('drops Blizzard pieces vertically into their separate ground positions', () => {
    const field: SkillGeometry = { ...mark, skillId: 'attack.blizzard', phase: 'Field', phaseElapsedSec: .15 };
    const early = skillRainDrops(field, frame, blizzardAtlas).find(drop => drop.id === 0)!;
    const late = skillRainDrops({ ...field, phaseElapsedSec: .75 }, frame, blizzardAtlas).find(drop => drop.id === 0)!;
    expect(early).toBeDefined();
    expect(late).toBeDefined();
    expect(early.x).toBe(late.x);
    expect(late.y).toBeGreaterThan(early.y);
  });

  it('keeps the falling angle and breaks into equal shards at landing', () => {
    const field: SkillGeometry = { ...mark, skillId: 'attack.blizzard', phase: 'Field', phaseElapsedSec: .55 };
    const landing = skillRainDrops(field, frame, blizzardAtlas).find(drop => drop.id === 0)!;
    const settled = skillRainDrops({ ...field, phaseElapsedSec: .68 }, frame, blizzardAtlas).find(drop => drop.id === 0)!;
    expect(landing.impactProgress).toBeGreaterThan(0);
    expect(landing.rotationDeg).toBe(45);
    expect(settled.rotationDeg).toBe(45);
    expect(settled.impactProgress).toBeGreaterThan(landing.impactProgress!);
    expect(settled.fragments).toHaveLength(6);
    expect(new Set(settled.fragments.map(shard => shard.size)).size).toBe(1);
  });
});
