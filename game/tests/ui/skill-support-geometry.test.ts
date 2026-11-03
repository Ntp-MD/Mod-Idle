import { describe, expect, it } from 'vitest';
import { createCombatArena } from '@sim/combat/combat-arena';
import type { FxEvent } from '@sim/core/types';
import { supportEventGeometry } from '../../src/ui/combat/skill-support-geometry';
import { atlasImpactDuration, skillArtFor } from '../../src/ui/combat/arena-skill-art';
import { newGame, characterSheet } from '@sim/core/game';
import { advanceRecovery } from '@sim/core/tick/recovery-stage';

describe('support skill receipts', () => {
  const event: FxEvent = { id: 5, sec: 0, atUs: 500_000, kind: 'buff',
    side: 'self', skillId: 'buff.warcry', text: 'Warcry', colour: '#fff' };

  it('plays an upkeep activation once on its precise clock and ends with the atlas', () => {
    const arena = createCombatArena();
    const lifetime = atlasImpactDuration(skillArtFor(event.skillId!)!.atlas!);
    expect(supportEventGeometry([event], arena, arena, 499_999)).toEqual([]);
    const mark = supportEventGeometry([event], arena, arena, 750_000)[0];
    expect(mark.key).toBe('support-5');
    expect(mark.phase).toBe('Impact');
    expect(mark.phaseElapsedSec).toBe(.25);
    expect(supportEventGeometry([event], arena, arena, 500_000 + lifetime * arena.unitsPerSec)).toEqual([]);
  });

  it('does not duplicate a linked heal action or invent an identity for plain recovery', () => {
    const arena = createCombatArena();
    const heal: FxEvent = { ...event, kind: 'heal', skillId: 'heal.heal', actionId: 3 };
    arena.actions.push({ id: 3, actorId: 'player', kind: 'cast', skillId: heal.skillId,
      atUs: 0, endsAtUs: 1_000_000, x: 0, y: 0 });
    expect(supportEventGeometry([heal], arena, arena, 750_000)).toEqual([]);
    expect(supportEventGeometry([{ ...heal, skillId: undefined }], arena, arena, 750_000)).toEqual([]);
    expect(supportEventGeometry([{ ...heal, actionId: undefined, atUs: 1_000_000 }],
      arena, arena, 1_250_000)).toHaveLength(1);
  });

  it('retains the skill identity on real ongoing recovery receipts', () => {
    const s = newGame(910);
    const c = characterSheet(s);
    s.player.hp = 1;
    s.healUp = { secLeft: 3, pctPerSec: .01, skillId: 'heal.heal' };
    advanceRecovery({ s, c, statuses: {}, debt52: undefined, units: 1_000_000,
      tickStartUs: 0, tickEndUs: 1_000_000, playerActiveFraction: 1 });
    expect(s.fx.find(row => row.kind === 'heal')?.skillId).toBe('heal.heal');
    expect(s.healUp?.secLeft).toBe(2);
  });
});
