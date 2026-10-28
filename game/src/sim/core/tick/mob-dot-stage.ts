import type { GameState, Mob } from '../types';
import type { Character } from '../player';
import type { CombatClock } from '../../combat/combat-clock';
import type { Statuses } from '../../combat/combat';
import { eng } from '../../../engine/client';
import { EVENT_PRIORITY } from '../../combat/combat-clock';
import { bundleOf, parasiticLeech } from '../../../../../engine/keystones.ts';
import { stepMobParts } from '../../combat/mobStatus';
import { credit, dotLead, fx, statusColour } from '../feedback';

export function scheduleMobDot(opts: {
  clock: CombatClock;
  tickStartUs: number;
  s: GameState;
  c: Character;
  rng: () => number;
  statuses: Statuses;
  mobMods: (mobId: string) => { leechPct: number };
  recoverLeech: (amount: number, atUs: number) => void;
  revertEquilibrium: (mob: Mob, nowSec: number) => void;
  onKill: (s: GameState, rng: () => number, mob: Mob, c: Character, statuses?: Statuses, bloomChain?: boolean) => void;
}): void {
  const { clock, tickStartUs, s, c, rng, statuses, mobMods, recoverLeech, revertEquilibrium, onKill } = opts;
  // statuses age once a second, and the DoT they deal lands before the window's actions (§7.1 priority 10)
  clock.schedule(tickStartUs, EVENT_PRIORITY.pendingDamage, 'player', 'group', () => {
    const parasite = bundleOf(c.keystones, 'parasitic-affliction');
    for (const mob of s.group) {
      // `30` Elemental Equilibrium is the target's own seconds: the shift lapses on this beat, before
      // the body's next status tick, so a resistance line never stays bent past its duration
      revertEquilibrium(mob, s.clockSec);
      const leechPct = parasite ? c.leechPct + mobMods(mob.id).leechPct : 0;
      const dot = stepMobParts(s.mobStatus, mob.id);
      if (dot.total > 0) {
        const actual = Math.min(Math.max(0, mob.hp), dot.total);
        mob.hp -= dot.total;
        if (parasite) recoverLeech(parasiticLeech(actual, parasite.params as Record<string, number>, leechPct), clock.nowUs);
        // one number per mob per second, wearing the colour of the status carrying it: burn is the fire
        // it came from, poison the poison, and bleed the physical neutral it has always been
        fx(s, { kind: 'hit', side: 'field', mobId: mob.id, via: 'dot', text: eng.fmt(dot.total), value: dot.total, colour: statusColour(dotLead(dot)) });
      }
      credit(s, 'dot', dot.total);
    }
    while (s.group.some((m) => m.hp <= 0)) {
      const dead = s.group.splice(s.group.findIndex((m) => m.hp <= 0), 1)[0];
      onKill(s, rng, dead, c, statuses);
    }
  });
}
