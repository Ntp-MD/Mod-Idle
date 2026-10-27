import type { GameState, Mob } from '../types';
import type { Character } from '../player';
import type { CombatArena, CombatArenaAction } from '../../combat/combat-arena';
import type { CombatClock } from '../../combat/combat-clock';
import type { SkillCastTiming } from '../../../../../engine/types.ts';
import { E, eng } from '../../../engine/client';
import { EVENT_PRIORITY, planAttacks } from '../../combat/combat-clock';
import {
  arenaAction, arenaPlayerInReach, arenaTarget, playerAttackProfile, updateArenaAction,
} from '../../combat/combat-arena';
import { basicPhaseBudget } from '../../../../../engine/attack-range.ts';
import {
  bundleOf, crushingRhythm, worthyFoe, redlineDamageMult, instrumentsMult,
  demolitionBlast, armourBreak, disruptingStop,
} from '../../../../../engine/keystones.ts';
import { fieldInFight, fieldAreaKey } from '../../world/field-area';
import { playerSwing, rollStatus, applyStatus, type Statuses } from '../../combat/combat';
import {
  applyWeaponRiders, spendControlBudget, placeKeystoneDoT, transferStatus, carriesTransferable,
} from '../../combat/mobStatus';
import { lineValue } from '../../combat/curse';
import { fx, credit, hitColour, statusColour } from '../feedback';
import { push } from '../log';
import { mobSkillById } from '../../combat/mobSkills';
import type { TriggerAura } from '../../combat/skills';

/**
 * The player's automatic basics: the accumulated-progress plan, the per-beat schedule, and the
 * contact resolution. Bodies arrive verbatim from the tick; the factory closes over the tick state
 * and the tick-owned helpers it calls.
 */
export function createPlayerBasicActions(opts: {
  arena: CombatArena | undefined;
  clock: CombatClock;
  rng: () => number;
  s: GameState;
  c: Character;
  attackCharacter: Character;
  units: number;
  tickStartUs: number;
  tickEndUs: number;
  online: boolean;
  manual: { moveTo?: { x: number; y: number } } | undefined;
  crippledOutgoingMult: number;
  unstoppablePenalty: number;
  berserkDealt: number;
  playerHitsPerSec: number;
  playerActiveFraction: number;
  statuses: Statuses;
  trig: { crit: TriggerAura | null; taken: TriggerAura | null };
  queueTrigger: (aura: TriggerAura | null, targetId: string) => void;
  recoverLeech: (amount: number, atUs: number) => void;
  mobMods: (mobId: string) => any;
  mobPlans: { mob: Mob; rate: number; actionsLeft: number }[];
  spreadShock: (target: { id: string; immune?: string[] }) => void;
  mirrorReady: () => boolean;
  luckyBonus: () => number;
  advanceArenaAt: (atUs: number) => void;
  engageTarget: (targetId?: string) => void;
  cancelIntent: (reason: string) => void;
  onKill: (s: GameState, rng: () => number, mob: Mob, c: Character, statuses?: Statuses, bloomChain?: boolean) => void;
  dominantElement: (parts: any) => string | null;
  applyEquilibrium: (mob: Mob, element: string, params: Record<string, number>, nowSec: number) => void;
  revertEquilibrium: (mob: Mob, nowSec: number) => void;
}) {
  const {
    arena, clock, rng, s, c, attackCharacter, units, tickStartUs, tickEndUs, online, manual,
    crippledOutgoingMult, unstoppablePenalty, berserkDealt, playerHitsPerSec, playerActiveFraction,
    statuses, trig, queueTrigger, recoverLeech, mobMods, mobPlans, spreadShock, mirrorReady,
    luckyBonus, advanceArenaAt, engageTarget, cancelIntent, onKill, dominantElement,
    applyEquilibrium, revertEquilibrium,
  } = opts;
  const encounterKeyOf = (state: GameState) => fieldAreaKey(state);
  const front = s.group[0];

  const playerRate = playerHitsPerSec * playerActiveFraction;
    // 42 Crushing Rhythm: the basic clock is capped and the real excess rate becomes one damage
    // multiplier on the swing (an already-slow weapon is never hurried and Slow still binds).
    const crush = bundleOf(c.keystones, 'crushing-rhythm');
    const crushNow = crush ? crushingRhythm(playerRate, crush.params as Record<string, number>) : null;
    const playerPlan = planAttacks(tickStartUs, s.player.atkTimer, crushNow ? crushNow.actualRate : playerRate, units);
    s.player.atkTimer = playerPlan.progressAtEnd;
    let swingsStopped = false;
    for (const atUs of playerPlan.times) {
      clock.schedule(atUs, EVENT_PRIORITY.playerAction, 'player', front?.id ?? '', () => {
        if (swingsStopped) return;
        if (!arena && !online && !fieldInFight(s)) return;
        // A local move order pauses new automatic primary attacks until it arrives.
        if (manual?.moveTo) return;
        if (arena?.intent && (arena.intent.phase === 'windup' || arena.intent.phase === 'recovery')) return;
        advanceArenaAt(clock.nowUs);
        const intended = arena?.intent?.targetId
          ? s.group.find((mob) => mob.id === arena.intent!.targetId && mob.hp > 0) : undefined;
        const target = arena ? intended ?? arenaTarget(arena, s.group) : s.group[0];
        if (!target) { swingsStopped = true; return; }
        if (arena && !arenaPlayerInReach(arena, c.weaponName, target.id)) return;
        engageTarget(target.id);
        if (!arena) { resolvePlayerBasic(target, clock.nowUs); return; }
        const profile = playerAttackProfile(c.weaponName);
        const intervalUs = Math.round(units / Math.max(1e-9, playerRate));
        const phase = basicPhaseBudget(profile, intervalUs);
        const releaseAtUs = clock.nowUs + phase.windupUs;
        const timing: SkillCastTiming = {
          delivery: profile.delivery, startedAtUs: clock.nowUs, releaseAtUs,
          impactAtUs: releaseAtUs, recoveryUntilUs: releaseAtUs + phase.recoveryUs,
        };
        const action = arenaAction(arena, 'player', 'swing', clock.nowUs, target.id, undefined, undefined, timing);
        if (action) {
          updateArenaAction(arena, action.id, { areaKey: encounterKeyOf(s) });
          schedulePlayerBasic(action, target);
        }
      });
    }

    /** Apply the canonical player basic at its contact beat; the caller owns validation. */
    function resolvePlayerBasic(target: Mob, atUs: number): void {
        const tm = mobMods(target.id);
        // Packet H action history: 04 Rage, 12 Worthy Foe and 32 Instruments all ride the one Hit
        // multiplier, composed here so each condition is read at the event's own time.
        const rk = s.keystoneRuntime;
        const redline = bundleOf(c.keystones, 'redline');
        const instruments = bundleOf(c.keystones, 'instruments-of-virtue');
        const worthy = bundleOf(c.keystones, 'worthy-foe');
        const worthyNow = worthy ? worthyFoe(rk.counters[target.id] || 0, worthy.params as Record<string, number>) : { dealtMult: 1, takenMult: 1 };
        const hitMult = (crushNow ? crushNow.damageMult : 1) * berserkDealt * unstoppablePenalty * crippledOutgoingMult
          * (redline ? redlineDamageMult(redline.params as Record<string, number>, rk.stacks.redline || 0) : 1)
          * worthyNow.dealtMult
          * (instruments ? instrumentsMult(rk.lastAction, 'attack', instruments.params as Record<string, number>) : 1);
        // `10` Painforged spends its bank on this Hit as flat Physical, before the crit roll (§7.2.2)
        const forged = bundleOf(c.keystones, 'painforged');
        const lucky = bundleOf(c.keystones, 'lucky-streak');
        const forceMirror = mirrorReady();
        const hpBefore = target.hp;
        const r = playerSwing(rng, attackCharacter, target, c.weaponElement, tm, atUs, hitMult,
          forged ? rk.stacks.painforged || 0 : 0, forceMirror, luckyBonus());
        if (r.landed) {
          if (forceMirror) rk.flags.mirrorCrit = false;
          if (lucky) rk.stacks.luckyStreak = r.crit
            ? Math.min(Number(lucky.params.maxStacks), (rk.stacks.luckyStreak || 0) + 1) : 0;
          if (forged) rk.stacks.painforged = 0;
          if (worthy) {
            for (const id of Object.keys(rk.counters)) if (id !== target.id) delete rk.counters[id];
            rk.counters[target.id] = (rk.counters[target.id] || 0) + 1;
          }
          if (redline) {
            rk.stacks.redline = Math.min(Number(redline.params.maxStacks), (rk.stacks.redline || 0) + Number(redline.params.hitStacks));
            rk.lastHitAtUs = atUs;
          }
          if (instruments) rk.lastAction = 'attack';
          // `66` Elemental Conduit: the as-extra lane this Hit carried gets its own separate status
          // attempt per Element — the same gate, proc and immunity every other status answer.
          const conduit = bundleOf(c.keystones, 'elemental-conduit');
          const extraLane = conduit ? r.packet?.parts.extraElement || {} : {};
          // the weapon's own riders — Element status, bleed and stun — on the swing's own hit, and on a
          // landing press too (§14), through one function so the two cannot drift
          applyWeaponRiders(rng, c, s.mobStatus, target.id, lineValue(s.curses, target.id, 'bleed_chance') > 0, 0, 0, target.immune || [], extraLane);
          spreadShock(target);
          // `09` Crimson Pact and `20` Toxic Execution: the physical this Hit withheld is not lost, it is
          // written on the target's own status clock — no Alignment gate and no proc roll, because the
          // bundle already decided the application. Immunity is the only thing that answers it.
          if (r.bleed) placeKeystoneDoT(s.mobStatus, target.id, 'bleed', r.bleed.perSec, r.bleed.sec, 0, target.immune || []);
          if (r.poison) placeKeystoneDoT(s.mobStatus, target.id, 'poison', r.poison.perSec, r.poison.sec, r.poison.budgetDps, target.immune || []);
          // `30` Elemental Equilibrium: the Element that carried this Hit decides which line the target
          // resists harder from here, and which it stops resisting (its own seconds, then it lapses).
          const eq = bundleOf(c.keystones, 'elemental-equilibrium');
          if (eq && r.packet) {
            const dominant = dominantElement(r.packet.parts);
            if (dominant) applyEquilibrium(target, dominant, eq.params as Record<string, number>, s.clockSec);
          }
          // `60` Plague Courier: a crit sends one Burn, Poison or Bleed off a neighbour and onto the body
          // the crit landed on, with the damage and the life it had left. A transfer that immunity
          // refuses costs nothing, so the ICD waits for the next crit (§7.6).
          const plague = bundleOf(c.keystones, 'plague-courier');
          if (plague && r.crit && clock.nowUs >= (rk.icdsUs.plagueCourier ?? 0)) {
            const carrier = s.group.find((m) => m !== target && carriesTransferable(s.mobStatus, m.id));
            if (carrier && transferStatus(s.mobStatus, carrier.id, target.id, target.immune || []))
              rk.icdsUs.plagueCourier = clock.nowUs + Number(plague.params.icdSec) * units;
          }
          // a swing that gives back HP is two events, not one: the blow the mob sees and the return the
          // character feels, each on its own half of the field
          recoverLeech(r.leech || 0, atUs);
          credit(s, 'swing', r.damage);
          // 21 Delayed Demolition: the deferred share is queued against this target and lost if it dies
          if (r.deferred && r.deferred > 0) {
            const dd = bundleOf(c.keystones, 'delayed-demolition')!;
            s.keystoneRuntime.queues.deferred.push({
              dueAtUs: atUs + Number(dd.params.delaySec) * units, amount: r.deferred,
              sourceId: 'player', targetId: target.id,
            });
          }
          // `22` Demolition Sequence: five landed Hits that actually took Health off this one body sum
          // their loss, and the fifth spends it — a blast worth a share of that sum on the body itself
          // and the weakest neighbour still standing. DoT, deferred damage and this blast count for
          // nothing, and changing the target before the fifth Hit clears the sum (§7.2).
          const seq = bundleOf(c.keystones, 'demolition-sequence');
          const realLoss = Math.max(0, hpBefore - target.hp);
          if (seq && realLoss > 0) {
            const hitsKey = `ds:hits:${target.id}`;
            const lossKey = `ds:loss:${target.id}`;
            const hits = (rk.counters[hitsKey] || 0) + 1;
            const summed = (rk.targetCounters[lossKey] || 0) + realLoss;
            if (hits >= Number(seq.params.hits)) {
              rk.counters[hitsKey] = 0;
              rk.targetCounters[lossKey] = 0;
              const promised = demolitionBlast(summed, seq.params as Record<string, number>);
              const element = String(seq.params.element);
              const neighbours = s.group.filter((m) => m !== target && m.hp > 0)
                .sort((a, b) => a.hp - b.hp || (a.id < b.id ? -1 : 1))
                .slice(0, Number(seq.params.extraTargets));
              for (const hit of [target, ...neighbours]) {
                const dealt = eng.mitigateMobHit(hit, 0, { [element]: promised });
                if (!(dealt > 0)) continue;
                hit.hp -= dealt;
                credit(s, 'swing', dealt);
                fx(s, { kind: 'hit', side: 'field', mobId: hit.id, via: 'swing', text: eng.fmt(dealt), value: dealt, colour: hitColour(element) });
              }
              push(s, `Demolition Sequence detonates for ${eng.fmt(promised)}`);
              while (s.group.some((m) => m.hp <= 0)) {
                const dead = s.group.splice(s.group.findIndex((m) => m.hp <= 0), 1)[0];
                delete rk.counters[`ds:hits:${dead.id}`];
                delete rk.targetCounters[`ds:loss:${dead.id}`];
                onKill(s, rng, dead, c, statuses);
              }
            } else {
              rk.counters[hitsKey] = hits;
              rk.targetCounters[lossKey] = summed;
            }
          }
          // 43 Armourbreaker: each landed Physical Hit breaks 5% of the target's initial Armour
          const breaker = bundleOf(c.keystones, 'armourbreaker');
          const physical = (r.packet?.parts.physicalCritEligible || 0) + (r.packet?.parts.physicalNonCrit || 0);
          if (breaker && physical > 0) {
            const initKey = `ab:init:${target.id}`;
            const stackKey = `ab:stacks:${target.id}`;
            if (s.keystoneRuntime.targetCounters[initKey] === undefined) s.keystoneRuntime.targetCounters[initKey] = target.armour;
            const init = s.keystoneRuntime.targetCounters[initKey];
            const broken = armourBreak(init, s.keystoneRuntime.targetCounters[stackKey] || 0, breaker.params as Record<string, number>);
            s.keystoneRuntime.targetCounters[stackKey] = broken.stacks;
            target.armour = broken.armour;
            s.keystoneRuntime.icdsUs[`ab:last:${target.id}`] = clock.nowUs;
          }
          // 46 delays the action clock, including pending telegraphs, without applying Shock's debuff.
          const disrupt = bundleOf(c.keystones, 'disrupting-blows');
          if (disrupt && disruptingStop(r.damage, target.hpMax, disrupt.params as Record<string, number>)) {
            const delaySec = Number(disrupt.params.stopSec);
            const plan = mobPlans.find((entry) => entry.mob === target);
            if (plan && spendControlBudget(s.mobStatus, target.id, delaySec)) {
              clock.delayActor(target.id, delaySec * units);
              target.atkTimer -= plan.rate * delaySec;
            }
          }
          fx(s, {
            kind: 'hit', side: 'field', mobId: target.id, crit: r.crit, via: 'swing',
            text: eng.fmt(r.damage), value: r.damage, colour: hitColour(r.element || null, r.crit),
          });
          if (r.crit) {
            push(s, `Crit for ${eng.fmt(r.damage)} (${target.species})`);
            queueTrigger(trig.crit, target.id);
          }
          if (target.hp <= 0) {
            // a Detonation above may already have taken this body off the field, and a kill credits once
            if (s.group.includes(target)) {
              s.group.splice(s.group.indexOf(target), 1);
              onKill(s, rng, target, c, statuses);
            }
            if (arena?.intent?.targetId === target.id) cancelIntent('target lost');
            s.player.atkTimer = 0;
            swingsStopped = true;
          }
        } else if (r.why) {
          // a swing the mob answered without taking pops its word on that mob's own corner, the way a
          // landed blow pops its number — a dodge reads where the dodger stands, never in a shared column.
          fx(s, { kind: 'block', side: 'field', mobId: target.id, text: r.why, colour: hitColour(null) });
        }
    }

    /** Release the player's prepared basic at its committed beat. */
    function schedulePlayerBasic(action: CombatArenaAction, target: Mob): void {
      if (!arena || !action.timing || action.releasedAtUs != null) return;
      const atUs = Math.max(tickStartUs, action.timing.releaseAtUs);
      if (atUs > tickEndUs) return;
      clock.schedule(atUs, EVENT_PRIORITY.playerAction, 'player', target.id, () => {
        const current = arena.actions.find(entry => entry.id === action.id);
        if (!current || current.cancelledAtUs != null || current.impactCount || current.releasedAtUs != null) return;
        advanceArenaAt(clock.nowUs);
        if (!arena.actions.includes(current) || current.cancelledAtUs != null) return;
        updateArenaAction(arena, current.id, {
          impactCount: 1, releasedAtUs: clock.nowUs,
          timing: { ...(current.timing as SkillCastTiming), impactAtUs: clock.nowUs },
        });
        if (target.hp <= 0 || !s.group.includes(target) || s.player.hp <= 0) return;
        if (arena.mobs[target.id]?.returning) return;
        if (!arenaPlayerInReach(arena, c.weaponName, target.id)) return;
        resolvePlayerBasic(target, clock.nowUs);
      });
    }

  return { resolvePlayerBasic, schedulePlayerBasic };
}
