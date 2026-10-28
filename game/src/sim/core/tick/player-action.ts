import type { GameState, Mob } from '../types';
import type { Character } from '../player';
import type { CombatArena } from '../../combat/combat-arena';
import type { CombatClock } from '../../combat/combat-clock';
import type { CastReport } from '../../combat/skills';
import type { Statuses, StatusName } from '../../combat/combat';
import { sm } from '../../../engine/client';
import { EVENT_PRIORITY } from '../../combat/combat-clock';
import {
  buffCastOutcome, buffNeedsRecast, buffRecastCost, castOnce, skillCd, spendableMana,
  tickSkillBuffs, tickSkills,
} from '../../combat/skills';
import { isBossKind } from '../kinds';
import { fieldInFight } from '../../world/field-area';
import { fx, hitColour } from '../feedback';
import { push } from '../log';

/**
 * The rotation's presses at t0 (§7.1 priority 30): buff recasts, the automatic cast, or the arena
 * intent. Scheduled as one beat so the cooldown tick and the presses share a timestamp.
 */
export function schedulePlayerAction(opts: {
  arena: CombatArena | undefined;
  clock: CombatClock;
  rng: () => number;
  s: GameState;
  c: Character;
  attackCharacter: Character;
  autoSkills: boolean;
  playerActiveFraction: number;
  online: boolean;
  tickStartUs: number;
  frontId: string;
  statuses: Statuses;
  cooldown: { atUs: number };
  ensureIntent: (atUs: number) => void;
  cancelIntent: (reason: string) => void;
  resolveTargetsForSkill: ((id: string, group: Mob[]) => { targets: Mob[]; area?: any }) | undefined;
  tranceFree: () => boolean;
  mirrorReady: () => boolean;
  luckyBonus: () => number;
  applyCast: (cast: CastReport | null) => void;
}): void {
  const {
    arena, clock, rng, s, c, attackCharacter, autoSkills, playerActiveFraction, online, tickStartUs,
    frontId, statuses, cooldown, ensureIntent, cancelIntent, resolveTargetsForSkill,
    tranceFree, mirrorReady, luckyBonus, applyCast,
  } = opts;

  // The rotation presses at t0 (§7.1 priority 30), before the window's own swing events.
  clock.schedule(tickStartUs, EVENT_PRIORITY.playerAction, 'player', frontId, () => {
    // the rotation casts the first ready, affordable slot top-down — no manual presses.
    // Haste is a post-cap multiplier on this clock; Chill slows the same clock.
    if (!arena) tickSkills(s.skills, c.globalSpeed * playerActiveFraction);
    else tickSkillBuffs(s.skills, c.globalSpeed * playerActiveFraction);
    // Cooldowns still count down while Auto Skills is off; only automatic casts stop. A shocked clock
    // (playerActiveFraction 0) stops the presses the same way it stops the rotation: nothing re-presses
    // while the character cannot act, and regen is stopped beside it.
    if (!arena && !online && !fieldInFight(s)) return;
    if (autoSkills && playerActiveFraction > 0) {
      for (const id of Object.keys(s.skills.buffs)) {
        if (!buffNeedsRecast(s.skills, id)) continue;
        const skill = sm.byId[id];
        const cost = buffRecastCost(s.skills, c, id);
        if (cost.resource === 'mana') {
          if (cost.amount > spendableMana(c, s.skills, s.player.mana)) continue;
          s.player.mana -= cost.amount;
        } else {
          if (cost.amount >= s.player.hp) continue;
          s.player.hp = Math.max(1, s.player.hp - cost.amount);
        }
        s.skills.cd[id] = skillCd(s.skills, id, c.cdr);
        // the toggle recast pays the same outcome the rotation's press would: charges, blocks and a
        // cleanse are part of what the buff grants, not a one-off on its first cast
        const outcome = buffCastOutcome(s.skills, id);
        s.skills.buffUp[id] = outcome?.durationSec ?? 10;
        if (outcome?.charges != null) {
          s.player.charges = outcome.charges;
          push(s, `${skill.name || id} grants ${outcome.charges} perfect-dodge charges`);
        }
        if (outcome?.blockCharges != null) {
          s.player.blockCharges = outcome.blockCharges;
          push(s, `${skill.name || id} grants ${outcome.blockCharges} blocks`);
        }
        if (outcome?.cleansesSelf) {
          const cleared = Object.keys(statuses).length;
          for (const k of Object.keys(statuses) as StatusName[]) delete statuses[k];
          if (cleared) push(s, `${skill.name || id} clears ${cleared} status${cleared > 1 ? '' : 'es'} off you`);
        }
        // a buff coming up is a gain the character receives, so it is raised where the character is read, in
        // the colour of the Element the row carries — the same pair of rules a press already follows
        fx(s, {
          kind: 'buff', side: 'self', skillId: id, text: String(skill.name || id),
          colour: hitColour((skill as any).element || null),
        });
      }
      if (arena) {
        cooldown.atUs = tickStartUs;
        ensureIntent(tickStartUs);
      } else {
        const cast = castOnce(s.skills, attackCharacter, spendableMana(attackCharacter, s.skills, s.player.mana), s.group, statuses, rng, {
          resolveTargetsForSkill,
          mobStatus: s.mobStatus, curses: s.curses,
          currentHp: s.player.hp,
          missingHpPct: c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0,
          isBoss: s.group.some((mob) => isBossKind(String(mob.kind))),
          timeUs: tickStartUs,
          freeCast: tranceFree(),
          forceCrit: mirrorReady(),
          critDamageBonusPct: luckyBonus(),
        });
        applyCast(cast);
      }
    } else if (arena) cancelIntent('auto-off');
  });
}
