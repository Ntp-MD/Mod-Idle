import { describe, expect, it } from 'vitest';
import { E, sm } from '../../src/engine/client';
import { skillAreaSnapshot } from '@engine/skill-area';
import { createCombatArena, type CombatArenaAction } from '@sim/combat/combat-arena';
import { skillActionGeometry, skillAimGeometry } from '../../src/ui/combat/skill-geometry';
import { liveId } from '../fixtures/liveSkill';

function fixture(skillId: string) {
  const arena = createCombatArena();
  Object.assign(arena.player, { x: 1, y: 2 });
  const skill = sm.byId[skillId];
  const action: CombatArenaAction = {
    id: 1, kind: 'cast', actorId: 'player', skillId, targetId: 'target', x: 1, y: 2,
    targetX: 4, targetY: 2, atUs: 0, endsAtUs: 10_000_000,
    area: skillAreaSnapshot(skill.area ?? { origin: 'target', radius_m: 0 }, arena.player, { x: 4, y: 2 }, 'target'),
    timing: { delivery: 'projectile', startedAtUs: 0, releaseAtUs: 1_000_000,
      impactAtUs: 2_000_000, recoveryUntilUs: 2_500_000 },
  };
  return { arena, action };
}

const groundCircleId = () => liveId((s) => s.type === 'attack' && s.cast?.delivery === 'ground' && (s.area?.radius_m ?? 0) > 0, 'ground circle');
const dotGroundId = () => liveId((s) => s.type === 'attack' && s.cast?.delivery === 'ground' && (s.area?.radius_m ?? 0) > 0 && (s.effects ?? []).some((e: any) => e.stat === 'dot_sec' && e.value === 8), 'dot-8 ground circle');
const chainId = () => liveId((s) => (s.action as any)?.kind === 'chain-strike', 'chain-strike');
const lineId = () => liveId((s) => s.area?.shape === 'line', 'line');
const healId = () => liveId((s) => s.type === 'heal', 'heal');
const channelId = () => liveId((s) => (s.action as any)?.kind === 'whirlwind-channel', 'mobile channel');
const fieldId = () => liveId((s) => (s.action as any)?.kind === 'blizzard-field', 'deployed field');
const burstId = () => liveId((s) => (s.action as any)?.kind === 'targeted-burst', 'payload burst');
const singleProjectileId = () => liveId((s) => s.type === 'attack' && s.cast?.delivery === 'projectile' && (s.area?.radius_m ?? 0) === 0, 'single projectile');

describe('functional skill geometry', () => {
  it('counts down the next pending landing instead of an already completed first impact', () => {
    const { arena, action } = fixture(groundCircleId());
    const mark = skillActionGeometry(action, arena, 2_500_000, 1_000_000, 3_000_000)!;
    expect(mark.phase).toBe('Travel');
    expect(mark.remainingSec).toBe(.5);
    expect(mark.progress).toBe(.75);
    expect(mark.footprint).toBeDefined();
    expect(mark.innerFootprint).not.toBe(mark.footprint);
  });
  it('reads every canonical cast without requiring an authored VFX definition', () => {
    for (const skill of sm.all()) {
      const { arena, action } = fixture(skill.id);
      const mark = skillActionGeometry(action, arena, 500_000, arena.unitsPerSec);
      expect(mark, skill.id).toBeDefined();
      expect(mark!.name, skill.id).toBe(skill.name);
      expect(mark!.phase, skill.id).toBe('Windup');
      expect(mark!.vertices.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), skill.id).toBe(true);
    }
  });

  it('carries the skill Element and its HUD colour into the footprint', () => {
    const byElement = (element: string) => {
      const row = sm.all().find((s: any) => !s.retired && s.type === 'attack' && s.element === element);
      if (!row) throw new Error(`no live ${element} attack to probe element colour`);
      return row.id;
    };
    const cases = [
      [byElement('fire'), 'fire'],
      [byElement('cold'), 'cold'],
      [byElement('lightning'), 'lightning'],
      [byElement('poison'), 'poison'],
      [byElement('chaos'), 'chaos'],
      [byElement('earth'), 'earth'],
    ] as const;
    for (const [skillId, element] of cases) {
      const { arena, action } = fixture(skillId);
      const mark = skillActionGeometry(action, arena, 500_000, arena.unitsPerSec)!;
      expect(mark.element, skillId).toBe(element);
      expect(mark.colour, skillId).toBe((E.elements.colour as Record<string, string>)[element]);
    }
    const physicalId = byElement('physical');
    const physical = fixture(physicalId);
    const mark = skillActionGeometry(physical.action, physical.arena, 500_000, physical.arena.unitsPerSec)!;
    expect(mark.element).toBe('physical');
    expect(mark.colour).toBe(E.elements.physical_colour);
    const fireId = byElement('fire');
    const aim = skillAimGeometry({ skillId: fireId, area: physical.action.area!,
      source: physical.arena.player, rangeM: 5, valid: true })!;
    expect(aim.element).toBe('fire');
    expect(aim.colour).toBe((E.elements.colour as Record<string, string>).fire);
  });

  it('keeps a release-committed circle when the target/contact moves', () => {
    const { arena, action } = fixture(groundCircleId());
    const committed = structuredClone(action.area!);
    action.targetX = 1.5;
    action.targetY = 2;
    const before = JSON.stringify(action);
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    expect(mark.area).toEqual(committed);
    expect(mark.phase).toBe('Travel');
    expect(JSON.stringify(action)).toBe(before);
  });

  it('shows chain radius as hop reach, with a single-body impact footprint', () => {
    const { arena, action } = fixture(chainId());
    const mark = skillActionGeometry(action, arena, 500_000, arena.unitsPerSec)!;
    expect(mark.area.radiusM).toBe(0);
    expect(mark.area.shape).toBe('single');
    expect(mark.dimensions).toContain('Hop');
    const aim = skillAimGeometry({ skillId: action.skillId!, area: action.area!,
      source: arena.player, rangeM: 5, valid: true })!;
    expect(aim.area.radiusM).toBe(0);
  });

  it('retains width and direction for a zero-radius line', () => {
    const { arena, action } = fixture(lineId());
    const mark = skillActionGeometry(action, arena, 500_000, arena.unitsPerSec)!;
    expect(mark.area.radiusM).toBe(0);
    expect(mark.area.shape).toBe('line');
    expect(mark.vertices).toHaveLength(4);
    expect(mark.dimensions).toContain('Line');
    expect(mark.area.widthM).toBe(sm.byId[action.skillId!].area!.width_m);
    expect(mark.direction.to.x).toBeGreaterThan(mark.direction.from.x);
  });

  it('shows heals on the player even when the cast has an incidental enemy target', () => {
    const { arena, action } = fixture(healId());
    const mark = skillActionGeometry(action, arena, 500_000, arena.unitsPerSec)!;
    expect(mark.area.center).toEqual({ x: arena.player.x, y: arena.player.y });
    expect(mark.dimensions).toContain('Self');
    expect(mark.range).toBe('');
  });

  it('follows sampled caster feet only for a mobile channel and retains deployed fields', () => {
    const moving = fixture(channelId());
    moving.action.channel = true;
    Object.assign(moving.arena.player, { x: 7, y: 8 });
    expect(skillActionGeometry(moving.action, moving.arena, 3_000_000, 1_000_000)!.area.center).toEqual({ x: 7, y: 8 });
    const field = fixture(fieldId());
    const center = { ...field.action.area!.center };
    Object.assign(field.arena.player, { x: 7, y: 8 });
    const mark = skillActionGeometry(field.action, field.arena, 4_000_000, 1_000_000)!;
    expect(mark.area.center).toEqual(center);
    expect(mark.phase).toBe('Field');
    expect(mark.phaseElapsedSec).toBe(3);
    const channel = skillActionGeometry(moving.action, moving.arena, 3_000_000, 1_000_000)!;
    expect(channel.phase).toBe('Channel');
    expect(channel.phaseElapsedSec).toBe(2);
  });

  it('keeps distinct payload paths and their terminal obstacle receipts', () => {
    const { arena, action } = fixture(burstId());
    action.payloads = [0, 1, 2].map(index => ({ index, source: { x: 1, y: 2 }, destination: { x: 4, y: 2 },
      releaseAtUs: 1_000_000 + index * 100_000, plannedImpactAtUs: 2_000_000 + index * 100_000,
      ...(index === 0 ? { impactAtUs: 1_500_000, contact: { x: 2, y: 2 }, cancelReason: 'obstacle' } : {}) }));
    const mark = skillActionGeometry(action, arena, 1_600_000, 1_000_000)!;
    expect(mark.paths.map(path => path.index)).toEqual([0, 1, 2]);
    expect(mark.paths[0].blocked).toBe(true);
    expect(mark.paths[1].blocked).toBe(false);
    expect(mark.dimensions).toContain('Hit Ø');
    action.cancelledAtUs = 1_700_000;
    expect(skillActionGeometry(action, arena, 1_800_000, 1_000_000)).toBeUndefined();
  });
});

describe('lingering footprints', () => {
  it('ends a Blizzard field from release even after later pulse receipts update its impact timing', () => {
    const { arena, action } = fixture(fieldId());
    action.primaryTiming = { ...action.timing! };
    const released = action.primaryTiming.releaseAtUs;
    action.timing = { ...action.timing!, impactAtUs: released + 4_000_000 };
    action.endsAtUs = released + 4_000_000;
    expect(skillActionGeometry(action, arena, released + 3_999_999, 1_000_000)).toBeDefined();
    expect(skillActionGeometry(action, arena, released + 4_000_000, 1_000_000)).toBeUndefined();
    expect(skillActionGeometry(action, arena, released + 5_000_000, 1_000_000)).toBeUndefined();
  });

  it('keeps a storm circle until its ground damage ends, then drops it', () => {
    const { arena, action } = fixture(dotGroundId());
    action.endsAtUs = 3_000_000;
    // Impact at 2s, dot_sec 8: the circle stays through 10s with a countdown.
    const mark = skillActionGeometry(action, arena, 5_000_000, 1_000_000)!;
    expect(mark.phase).toBe('Impact');
    expect(mark.remainingSec).toBeCloseTo(5, 9);
    expect(skillActionGeometry(action, arena, 10_000_000, 1_000_000)).toBeDefined();
    expect(skillActionGeometry(action, arena, 10_000_001, 1_000_000)).toBeUndefined();
  });

  it('keeps a debuff window circle for its authored duration', () => {
    const debuffId = liveId((s) => s.type === 'attack' && typeof s.duration === 'string' && (s.area?.radius_m ?? 0) === 0, 'single-target debuff window');
    const { arena, action } = fixture(debuffId);
    action.endsAtUs = 3_000_000;
    const mark = skillActionGeometry(action, arena, 5_000_000, 1_000_000)!;
    expect(mark.phase).toBe('Impact');
    expect(mark.remainingSec).toBeCloseTo(5, 9);
  });

  it('leaves duration-less hits on the legacy impact tail only', () => {
    const { arena, action } = fixture(singleProjectileId());
    action.endsAtUs = 3_000_000;
    expect(skillActionGeometry(action, arena, 2_500_000, 1_000_000)!.phase).toBe('Impact');
    expect(skillActionGeometry(action, arena, 3_000_001, 1_000_000)).toBeUndefined();
  });
});
