import { describe, expect, it } from 'vitest';
import { combatCastCues, combatDamagePops, combatEffectLevel, combatMotionWeight, combatTempo, sceneCombatEvents } from '../src/ui/combat/combat-presentation';
import { actorImpactMs } from '../src/ui/combat/combat-actor';
import type { FxEvent } from '../src/sim/types';

const hit = (id: number, over: Partial<FxEvent> = {}): FxEvent => ({
  id, sec: 12, kind: 'hit', side: 'field', via: 'swing', mobId: 'a', value: 10,
  text: '10', colour: '#fff', ...over,
});

describe('combat effect preference', () => {
  const casts = [
    hit(5, { kind: 'cast', skillId: 'fire' }), hit(4, { kind: 'cast', skillId: 'fire' }),
    hit(3, { kind: 'cast', skillId: 'heal' }),
  ];

  it('keeps Automatic speed adaptation and resolves explicit choices independently', () => {
    expect(combatEffectLevel()).toBe('full');
    expect(combatEffectLevel('auto', 4)).toBe('reduced');
    for (const speed of [1, 2, 4]) {
      expect(combatEffectLevel('full', speed)).toBe('full');
      expect(combatEffectLevel('reduced', speed)).toBe('reduced');
      expect(combatEffectLevel('minimal', speed)).toBe('minimal');
    }
    expect(sceneCombatEvents([hit(3), hit(2, { mobId: 'b' }), hit(1, { mobId: 'c' })], 2)).toHaveLength(2);
    expect(sceneCombatEvents([hit(3), hit(2, { mobId: 'b' }), hit(1, { mobId: 'c' })], 4)).toHaveLength(1);
  });

  it('restores separate hits, cast cues and full motion at fast playback when Full is selected', () => {
    const ring = [hit(3), hit(2), hit(1)];
    expect(sceneCombatEvents(ring, 4, 'full')).toEqual(ring);
    expect(combatDamagePops(ring, 4, 4, 'full').map((event) => [event.value, event.count])).toEqual([[10, 1], [10, 1], [10, 1]]);
    expect(combatCastCues(casts, 4, 'full').map((event) => event.count)).toEqual([1, 1, 1]);
    expect(combatMotionWeight(ring[0], 4, 'full')).toBe(1);
    expect(combatTempo(4)).toBe(2);
  });

  it('reduces density at normal playback without removing critical, skill or defensive feedback', () => {
    const important = [
      hit(3, { crit: true }), hit(2, { skillId: 'attack.fireball', via: 'cast' }),
      hit(1, { side: 'self', kind: 'block', value: undefined, text: 'Blocked' }),
    ];
    const ring = [hit(9), hit(8), hit(7, { mobId: 'b' }), ...important];
    const visible = sceneCombatEvents(ring, 1, 'reduced');
    expect(visible).toEqual(sceneCombatEvents(ring, 4, 'reduced'));
    expect(important.every((event) => visible.includes(event))).toBe(true);
    expect(visible.filter((event) => !important.includes(event))).toHaveLength(1);
    expect(combatDamagePops(ring, 1, 4, 'reduced').find((event) => event.id === 9)).toMatchObject({ value: 20, count: 2 });
    expect(combatCastCues(casts, 1, 'reduced').map((event) => [event.skillId, event.count])).toEqual([['fire', 2], ['heal', 1]]);
    expect(combatMotionWeight(important[2], 1, 'reduced')).toBeLessThan(1);
  });

  it('keeps factual damage totals and named casts in Minimal while suppressing decorative scene and body motion', () => {
    const ring = [hit(3), hit(2), hit(1, { crit: true })];
    const before = structuredClone(ring);
    expect(sceneCombatEvents(ring, 1, 'minimal')).toEqual([]);
    expect(combatDamagePops(ring, 1, 4, 'minimal').map((event) => [event.value, event.count])).toEqual([[20, 2], [10, 1]]);
    expect(combatCastCues(casts, 1, 'minimal').map((event) => [event.skillId, event.count])).toEqual([['fire', 2], ['heal', 1]]);
    for (const event of [...ring, hit(0, { kind: 'block', text: 'Blocked' })]) {
      expect(combatMotionWeight(event, 1, 'minimal')).toBe(0);
    }
    expect(ring).toEqual(before);
  });
});

describe('combat presentation at faster speeds', () => {
  it('keeps single-speed damage as separate events and never changes the simulation ring', () => {
    const ring = [hit(3), hit(2), hit(1)];
    const before = structuredClone(ring);
    expect(combatDamagePops(ring).map((event) => event.value)).toEqual([10, 10, 10]);
    expect(combatDamagePops(ring, 4).map((event) => [event.value, event.count])).toEqual([[30, 3]]);
    expect(ring).toEqual(before);
  });

  it('groups only the same actor, sim second, damage lane and colour; crits and skill hits stay separate', () => {
    const ring = [
      hit(9), hit(8), hit(7, { mobId: 'b' }), hit(6, { sec: 11 }),
      hit(5, { via: 'dot' }), hit(4, { colour: '#f00' }),
      hit(3, { crit: true }), hit(2, { via: 'cast', skillId: 'attack.fireball' }),
    ];
    const pops = combatDamagePops(ring, 4, 20);
    expect(pops.map((event) => [event.id, event.value, event.count])).toEqual([
      [9, 20, 2], [7, 10, 1], [6, 10, 1], [5, 10, 1], [4, 10, 1], [3, 10, 1], [2, 10, 1],
    ]);
    const capped = combatDamagePops(ring, 4, 3);
    expect(capped.map((event) => event.id)).toEqual([9, 3, 2]);
  });

  it('prioritizes skill, critical and defensive effects over a flood of ordinary contacts', () => {
    const critical = hit(2, { crit: true });
    const skill = hit(1, { skillId: 'attack.fireball', via: 'cast' });
    const block = hit(0, { kind: 'block', side: 'self', mobId: undefined, byId: 'b', value: undefined });
    const ring = [...Array.from({ length: 20 }, (_, index) => hit(40 - index, { mobId: `mob-${index}` })), critical, skill, block];
    const visible = sceneCombatEvents(ring, 4);
    expect(visible).toContain(critical);
    expect(visible).toContain(skill);
    expect(visible).toContain(block);
    expect(visible.filter((event) => !event.crit && !event.skillId && event.kind === 'hit')).toHaveLength(1);
    expect(visible.length).toBeLessThanOrEqual(12);
    expect(sceneCombatEvents([hit(1, { via: 'dot' })], 4)).toEqual([]);
  });

  it('counts repeated uses of one skill in one sim second without conflating different skills or seconds', () => {
    const casts = [
      hit(5, { kind: 'cast', skillId: 'fire' }), hit(4, { kind: 'cast', skillId: 'fire' }),
      hit(3, { kind: 'cast', skillId: 'heal' }), hit(2, { kind: 'cast', skillId: 'fire', sec: 11 }),
    ];
    expect(combatCastCues(casts, 4).map((event) => [event.id, event.count])).toEqual([[5, 2], [3, 1], [2, 1]]);
    expect(combatCastCues(casts).map((event) => event.count)).toEqual([1, 1, 1]);
  });

  it('softens ordinary motion while keeping important reactions and contact timing aligned', () => {
    expect(combatMotionWeight(hit(1), 1)).toBe(1);
    expect(combatMotionWeight(hit(1), 2)).toBeLessThan(1);
    expect(combatMotionWeight(hit(1), 4)).toBeLessThan(combatMotionWeight(hit(1), 2));
    expect(combatMotionWeight(hit(1, { crit: true }), 4)).toBe(1);
    expect(combatMotionWeight(hit(1, { kind: 'block' }), 4)).toBe(1);
    const character = { weaponName: 'bare hand' };
    expect(actorImpactMs(hit(1), character, undefined, 4)).toBe(actorImpactMs(hit(1), character) / 2);
    expect(actorImpactMs(hit(1, { via: 'dot' }), character, undefined, 4)).toBe(0);
  });
});
