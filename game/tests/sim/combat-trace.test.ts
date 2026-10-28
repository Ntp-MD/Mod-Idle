import { describe, expect, it } from 'vitest';
import { encounterSignature, seededEncounter } from '../fixtures/encounter';

describe('P0 trace — action timing', () => {
  it('records a manual cast from command to impact', () => {
    const encounter = seededEncounter({ seed: 21, bodies: 4, skills: ['attack.fireball'] });
    encounter.run(1);
    const target = Object.values(encounter.arena.mobs).find((mob) => mob.hp > 0 && !mob.returning);
    if (target) Object.assign(encounter.arena.player, { x: target.x + 1, y: target.y });
    encounter.run(1, { tick: 0, manual: { cast: { skillId: 'attack.fireball' } } });
    encounter.run(6);

    const casts = encounter.trace.flatMap((entry) => entry.actions)
      .filter((action) => action.skillId === 'attack.fireball');
    expect(casts.length).toBeGreaterThan(0);
    const landed = casts.find((action) => action.impactCount > 0);
    expect(landed).toBeDefined();
    expect(landed!.timingReleaseAtUs).not.toBeNull();
    expect(landed!.timingReleaseAtUs!).toBeGreaterThanOrEqual(landed!.atUs);
    expect(landed!.impactAtUs!).toBeGreaterThanOrEqual(landed!.timingReleaseAtUs!);
  });

  it('records a released action and its impact beat in an automatic fight', () => {
    const encounter = seededEncounter({ seed: 21, bodies: 4 });
    encounter.run(4);

    const actions = encounter.trace.flatMap((entry) => entry.actions)
      .filter((action) => action.releasedAtUs != null);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some((action) => action.impactCount > 0)).toBe(true);
  });

  it('moves the player only after the manual ground command', () => {
    const encounter = seededEncounter({ seed: 22, bodies: 4 });
    encounter.run(1);
    const before = encounter.trace[encounter.trace.length - 1].player;
    encounter.run(2, { tick: 0, manual: { moveTo: { x: before.x, y: before.y + 3 } } });
    const after = encounter.trace[encounter.trace.length - 1].player;
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(0.5);
  });
});

describe('P0 baseline — crowded field', () => {
  it('runs deterministically at the authored population and reports cold and warm sim cost', () => {
    // zone 7 is the smallest zone at the 48-body cap
    const first = seededEncounter({ seed: 7, bodies: 48, zone: 7 });
    // respawn is ~33 s, so let the authored slots fill before measuring
    for (let i = 0; i < 60; i++) first.run(1);
    const settled = first.state.group.length;

    const coldStart = performance.now();
    first.run(10);
    const cold = performance.now() - coldStart;
    first.run(20);
    const warmStart = performance.now();
    first.run(10);
    const warm = performance.now() - warmStart;
    console.log(
      `[P0 baseline] zone=${first.state.zone} bodies=${settled} ` +
      `cold=${(cold / 10).toFixed(2)} ms/tick warm=${(warm / 10).toFixed(2)} ms/tick actions=${first.arena.actions.length}`,
    );

    const second = seededEncounter({ seed: 7, bodies: 48, zone: 7 });
    for (let i = 0; i <= first.trace.length - 1; i++) second.run(1);
    expect(encounterSignature(first)).toBe(encounterSignature(second));
    expect(settled).toBeGreaterThan(0);
  });
});
