import { describe, expect, it } from 'vitest';
import { seededEncounter } from '../fixtures/encounter';

describe('P1 commands — receipts', () => {
  it('rejects a cast for a skill that does not exist', () => {
    const encounter = seededEncounter({ seed: 51, bodies: 4 });
    encounter.run(1);
    encounter.run(1, { tick: 0, manual: { cast: { skillId: 'attack.not-a-skill' } } });

    const receipts = encounter.state.combatReceipts ?? [];
    expect(receipts.some((receipt) => receipt.command === 'cast'
      && receipt.status === 'rejected' && receipt.reason === 'unknown skill')).toBe(true);
  });

  it('queues a cast that arrives during recovery instead of dropping it', () => {
    const encounter = seededEncounter({ seed: 52, bodies: 3, skills: ['attack.fireball'] });
    encounter.run(1);
    const mob = encounter.state.group.find((body) => body.hp > 0);
    expect(mob).toBeDefined();
    const pose = encounter.arena.mobs[mob!.id];
    encounter.arena.intent = {
      skillId: 'attack.fireball',
      targetId: mob!.id,
      targetPoint: { x: pose.x, y: pose.y },
      phase: 'recovery',
      recoveryUntilUs: encounter.arena.nowUs + 600_000,
    };

    encounter.run(1, { tick: 0, manual: { cast: { skillId: 'attack.fireball' } } });

    const receipts = encounter.state.combatReceipts ?? [];
    expect(receipts.some((receipt) => receipt.command === 'cast'
      && receipt.status === 'queued' && receipt.reason === 'recovery')).toBe(true);
  });

  it('accepts a move over a pending approach', () => {
    const encounter = seededEncounter({ seed: 53, bodies: 4 });
    encounter.run(1);
    const mob = encounter.state.group.find((body) => body.hp > 0);
    const pose = encounter.arena.mobs[mob!.id];
    encounter.arena.intent = {
      skillId: 'attack.fireball',
      targetId: mob!.id,
      targetPoint: { x: pose.x, y: pose.y },
      phase: 'approach',
    };

    encounter.run(1, { tick: 0, manual: { moveTo: { x: encounter.arena.player.x + 2, y: encounter.arena.player.y } } });

    const receipts = encounter.state.combatReceipts ?? [];
    expect(receipts.some((receipt) => receipt.command === 'move' && receipt.status === 'accepted')).toBe(true);
    expect(encounter.arena.intent?.phase).not.toBe('approach');
  });
});
