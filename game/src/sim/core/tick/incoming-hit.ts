import type { GameState, Mob } from '../types';
import type { Character } from '../player';
import type { CombatArena } from '../../combat/combat-arena';
import type { CombatClock } from '../../combat/combat-clock';
import type { MobSkillRow } from '../../../../../engine/types.ts';
import type { StatusName, Statuses } from '../../combat/combat';
import type { KeystoneBundle } from '../../../../../engine/keystones.ts';
import type { TriggerAura } from '../../combat/skills';
import { eng, sm } from '../../../engine/client';
import { bundleOf, worthyFoe, painforgedBank, borrowedRecoup, ghostDanceRecovery, shieldGateHolds, mindOverMatter, staggeringSplit, thornboundRetaliation, autoCleanseReady } from '../../../../../engine/keystones.ts';
import { mobSwing, applyStatus, rollStatus } from '../../combat/combat';
import { buffRuleUp, reservedMana } from '../../combat/skills';
import { fx, credit, hitColour, statusColour } from '../feedback';
import { push } from '../log';

/**
 * One incoming direct hit: defence, statuses and keystone reactions, read against live state.
 *
 * The factory closes over the tick's arena, clock, sheet and latches; the body is the tick's own.
 */
export function createIncomingHit(opts: {
  arena: CombatArena | undefined;
  clock: CombatClock;
  rng: () => number;
  s: GameState;
  c: Character;
  units: number;
  online: boolean;
  rkH: GameState['keystoneRuntime'];
  statuses: Statuses;
  statusesAppliedThisTick: Set<StatusName>;
  trig: { crit: TriggerAura | null; taken: TriggerAura | null };
  immune: boolean;
  absorbPct: number;
  berserk: KeystoneBundle | undefined;
  berserkDealt: number;
  mobMods: (mobId: string) => any;
  queueTrigger: (aura: TriggerAura | null, targetId: string) => void;
  cancelIntent: (reason: string) => void;
  cancelPlayerBasic: (reason: string) => void;
  onKill: (s: GameState, rng: () => number, mob: Mob, c: Character, statuses?: Statuses, bloomChain?: boolean) => void;
}) {
  const {
    arena, clock, rng, s, c, units, online, rkH, statuses, statusesAppliedThisTick,
    trig, immune, absorbPct, berserk, berserkDealt, mobMods, queueTrigger, cancelIntent,
    cancelPlayerBasic, onKill,
  } = opts;

  function resolveIncomingHit(mob: Mob, plannedSkill: MobSkillRow | undefined, rng: () => number, live: Mob = mob,
    atUs: number = clock.nowUs) {
      const tm = mobMods(mob.id);
      let hurt = false;
      // Blur: every third direct Hit is a Perfect Dodge. It is its own rule, not a roll.
      const blur = bundleOf(c.keystones, 'blur');
      if (blur) {
        rkH.counters.blurHits = (rkH.counters.blurHits || 0) + 1;
        if (rkH.counters.blurHits >= Number(blur.params.hitsPerDodge)) {
          rkH.counters.blurHits = 0;
          fx(s, { kind: 'proc', side: 'self', byId: mob.id, skillId: plannedSkill?.id, text: 'perfect dodge', colour: hitColour(null) });
          return;
        }
      }
      // a Ghost Dance charge deletes the hit outright and is not opposed: it goes before the
      // rolls, which is the whole difference between it and Dodge
      if ((s.player.charges || 0) > 0) {
        s.player.charges!--;
        return;
      }
      // 03's always-on take-more line and 12's duel defence are per incoming Hit and per target
      const worthyT = bundleOf(c.keystones, 'worthy-foe');
      const duel = worthyT ? worthyFoe(rkH.counters[mob.id] || 0, worthyT.params as Record<string, number>) : { dealtMult: 1, takenMult: 1 };
      const takenChar = {
        ...c,
        damageTaken: (c.damageTaken ?? 1)
          * (berserk ? Number(berserk.params.takenMult) : 1) * duel.takenMult,
      };
      const mobSkill = plannedSkill;
      const r = mobSwing(rng, takenChar, mob, statuses, tm, s.player.es, absorbPct, (s.player.blockCharges || 0) > 0, s.player.hp);
      // Mirror Strike: the Evasion success banks the next player Hit's crit.
      const mirror = bundleOf(c.keystones, 'mirror-strike');
      if (mirror && r.blocked === 'evasion') {
        rkH.flags.mirrorCrit = true;
        rkH.icdsUs.mirrorUntil = clock.nowUs + Number(mirror.params.windowSec) * units;
        push(s, 'Mirror Strike banks a guaranteed crit');
      }
      if (mobSkill && online) push(s, `${mob.species} uses ${mobSkill.name}`);
      // an Earth Wall charge answered the swing: it is spent whether the shield rolled or not
      if (r.blockChargeSpent) s.player.blockCharges!--;
      // `10` Painforged: what a Block actually took off this Hit is banked, up to its share of Max HP,
      // and the next swing spends the whole of it as flat Physical. Turtle Doctrine's expected cut is
      // not a Block event, so it feeds the bank nothing (§7.3.3).
      const forgedIn = bundleOf(c.keystones, 'painforged');
      if (forgedIn && r.blockCut) {
        rkH.stacks.painforged = painforgedBank(rkH.stacks.painforged || 0, r.blockCut, c.maxHp,
          forgedIn.params as Record<string, number>);
      }
      // Riposte: a real Block sends its prevented damage back, on its own ICD.
      const riposte = bundleOf(c.keystones, 'riposte');
      const blockedCut = r.blockCut ?? 0;
      if (riposte && blockedCut > 0 && clock.nowUs >= (rkH.icdsUs.riposte ?? 0)) {
        const promised = blockedCut * Number(riposte.params.reflectMult);
        const dealt = eng.mitigateMobHit(live, promised, 0);
        if (dealt > 0) {
          live.hp -= dealt;
          rkH.icdsUs.riposte = clock.nowUs + Number(riposte.params.icdSec) * units;
          credit(s, 'swing', dealt);
          fx(s, { kind: 'hit', side: 'field', mobId: mob.id, via: 'swing', text: eng.fmt(dealt), value: dealt, colour: hitColour(null) });
          push(s, `Riposte answers ${mob.species} for ${eng.fmt(dealt)}`);
          if (live.hp <= 0 && s.group.includes(live)) {
            s.group.splice(s.group.indexOf(live), 1);
            onKill(s, rng, live, c, statuses);
          }
        }
      }
      if (r.leech && r.leech > 0) live.hp = Math.min(live.hpMax, live.hp + r.leech);
      // 11 Fortify cuts every later Hit by its stacks; 16 Bark spends one charge on a Hit that lands
      const fortNow = bundleOf(c.keystones, 'fortress-under-siege');
      const barkNow = bundleOf(c.keystones, 'barkskin');
      let toEs = r.toEs;
      let toHp = r.toHp;
      if (fortNow) {
        const reduction = Math.max(0, 1 - Math.min(Number(fortNow.params.maxStacks), rkH.stacks.fortress || 0)
          * Number(fortNow.params.reductionPctPerStack) / 100);
        toEs *= reduction;
        toHp *= reduction;
      }
      if (barkNow && toEs + toHp > 0 && (rkH.stacks.bark || 0) > 0) {
        const taken = Number(barkNow.params.hitTakenMult);
        toEs *= taken;
        toHp *= taken;
        rkH.stacks.bark!--;
      }
      // a defence is an event too: the screen has to say *which* answer stopped the hit, because
      // Block, Evasion and a perfect dodge animate differently and the player reads them apart. Either way
      // the striker is named, so the body that swung can lean into its own blow.
      if (r.blocked) fx(s, { kind: 'block', side: 'self', byId: mob.id, skillId: plannedSkill?.id, text: r.blocked, colour: hitColour(null) });
      // 23 Ghost Dance: an Evasion success (not Perfect Dodge) recovers ES on its own ICD
      const ghost = bundleOf(c.keystones, 'ghost-dance');
      if (ghost && r.blocked === 'evasion' && clock.nowUs >= (rkH.icdsUs.ghostDance ?? 0)) {
        const gained = ghostDanceRecovery(c.evasion, c.es, ghost.params as Record<string, number>);
        s.player.es = Math.min(c.es, s.player.es + gained);
        rkH.icdsUs.ghostDance = clock.nowUs + Number(ghost.params.icdSec) * units;
      }
      // `cast_on_damage_taken` listens for any hit that actually took off the player (HP or shield)
      if (toHp > 0 || toEs > 0) {
        hurt = true;
        // the incoming number wears the attacker's own Element, the same line the resistance roll
        // answered — a chaos hit reads purple whether or not the shield ate it. The receipt
        // carries the crossing beat for a swept projectile, the tick clock otherwise (F20).
        fx(s, {
          kind: 'taken', side: 'self', byId: mob.id, skillId: plannedSkill?.id,
          text: eng.fmt(toHp + toEs), value: toHp + toEs,
          hpDamage: toHp, esDamage: toEs,
          colour: hitColour(mob.innate?.[0] || null),
          atUs,
        });
      }
      if (r.absorbed > 0) s.player.es = Math.min(c.es, s.player.es + r.absorbed);
      const gate = bundleOf(c.keystones, 'shield-gate');
      const esBefore = s.player.es;
      if (toEs > 0) { s.player.es -= toEs; if (!buffRuleUp(s.skills, 'es_recharge_immediate')) s.player.esIdleSec = 0; }
      if (gate && shieldGateHolds(esBefore, s.player.es, rkH.flags.shieldGateArmed ?? true)) {
        // the overflow of the Hit that broke the shield does not reach HP; the gate disarms
        toHp = 0;
        rkH.flags.shieldGateArmed = false;
        rkH.icdsUs.shieldGateArmAt = clock.nowUs + Number(gate.params.rearmCdSec) * units;
      }
      if (toHp > 0) {
        // 33 Mind over Matter pays its share from positive unreserved Mana, 1:1 — after ES (§7.3.8)
        let hpLoss = toHp;
        const mom = bundleOf(c.keystones, 'mind-over-matter');
        if (mom) {
          const pay = mindOverMatter(hpLoss, Math.max(0, s.player.mana - reservedMana(c, s.skills)), mom.params as Record<string, number>);
          s.player.mana -= pay.mana;
          hpLoss = pay.hp;
        }
        // 56 Staggering Resolve splits the HP-bound share after 33/51; debt is committed loss
        const stagger = bundleOf(c.keystones, 'staggering-resolve');
        if (stagger) {
          const split = staggeringSplit(hpLoss, stagger.params as Record<string, number>);
          hpLoss = split.immediate;
          for (let i = 1; i <= Number(stagger.params.durationSec); i++)
            s.keystoneRuntime.queues.hpDebt.push({ dueAtUs: clock.nowUs + i * units, amount: split.perDebt, sourceId: mob.id, targetId: 'player' });
        }
        s.player.hp -= hpLoss;
        if (s.player.hp <= 0 && hpLoss > 0) {
          s.lastFatalHit = {
            mobId: mob.id, species: mob.species, value: hpLoss, atSec: clock.nowUs / units,
            ...(mobSkill ? { skillId: mobSkill.id } : {}),
          };
        }
        // 40 Borrowed Time recoups 40% of the HP actually paid, over six seconds
        const recoup = bundleOf(c.keystones, 'borrowed-time');
        if (recoup && hpLoss > 0) {
          const r40 = borrowedRecoup(hpLoss, recoup.params as Record<string, number>);
          for (let i = 1; i <= Number(recoup.params.durationSec); i++)
            s.keystoneRuntime.queues.recoup.push({ dueAtUs: clock.nowUs + i * units, amount: r40.perPay, sourceId: mob.id, targetId: 'player' });
        }
        if (!buffRuleUp(s.skills, 'es_recharge_immediate')) s.player.esIdleSec = 0;
      }
      // real loss feeds 11, 16 and 40's clocks; a fully absorbed or cut Hit feeds nothing
      if (toHp + toEs > 0) {
        rkH.lastLossAtUs = clock.nowUs;
        if (fortNow) rkH.stacks.fortress = Math.min(Number(fortNow.params.maxStacks), (rkH.stacks.fortress || 0) + 1);
        if (barkNow) rkH.icdsUs.bark = clock.nowUs + Number(barkNow.params.regenEverySec) * units;
        // `53` Thornbound: the body that took something off us is answered by a share of our Armour,
        // once on its own clock. It is secondary damage — no crit, no status, no leech, no hit counter,
        // and it never answers a different body because this one died first (§7.2).
        const thornH = bundleOf(c.keystones, 'thornbound');
        if (thornH && clock.nowUs >= (rkH.icdsUs.thornbound ?? 0)) {
          const promised = thornboundRetaliation(c.armour, thornH.params as Record<string, number>) * berserkDealt;
          const dealt = eng.mitigateMobHit(live, promised, 0);
          if (dealt > 0) {
            live.hp -= dealt;
            rkH.icdsUs.thornbound = clock.nowUs + Number(thornH.params.icdSec) * units;
            credit(s, 'swing', dealt);
            fx(s, { kind: 'hit', side: 'field', mobId: mob.id, via: 'swing', text: eng.fmt(dealt), value: dealt, colour: hitColour(null) });
            push(s, `Thornbound answers ${mob.species} for ${eng.fmt(dealt)}`);
            if (live.hp <= 0 && s.group.includes(live)) {
              s.group.splice(s.group.indexOf(live), 1);
              onKill(s, rng, live, c, statuses);
            }
          }
        }
      }
      // A shield block deflects the status, including an Earth Wall charge. Evasion and perfect dodge
      // return raw=0; a hit absorbed by ES still landed and can apply its status.
      if (r.raw > 0 && r.blocked !== 'block' && r.blocked !== 'block charge') {
        // the mirror of `applyWeaponRiders`: the mob's aligned Elemental DPS — its full per-second
        // Element output under its own Alignment multiplier — is both the per-second DoT basis and
        // the budget's basis, exactly what our statuses on a mob are priced from
        const alignedElemDps = mob.ps * eng.damageSplit(mob.damage)[1] * (((mob as any).align ?? 100) / 100);
        // A forced mob status still passes `statusResist`: the gear answer cuts the application,
        // while `statusImmunity` blocks it outright. The roll is drawn here so `applyStatus`
        // keeps its single writer role and the tick draw order stays frozen otherwise.
        const resistCut = Math.max(0, Math.min(100, c.statusResist || 0)) / 100;
        const resisted = resistCut > 0 && rng() < resistCut;
        const forced = mobSkill?.status && !immune && !resisted ? applyStatus(statuses, mobSkill.status, alignedElemDps) : null;
        let st = forced ?? (immune ? null : rollStatus(rng, mob, alignedElemDps, statuses, c.statusResist, c.stunRecovery, alignedElemDps));
        // Purist: damaging statuses are refused after the writer names them, before the tick
        // can pay them; control statuses and Mark still land.
        if (st && bundleOf(c.keystones, 'purist') && ['burn', 'poison', 'bleed'].includes(st)) {
          delete statuses[st];
          st = null;
        }
        if (st) {
          statusesAppliedThisTick.add(st);
          push(s, `${mob.species} inflicts ${st}`);
          // 59 Auto Cleanse: a family that actually landed is removed at once, on its 6s ICD
          const cleanse = bundleOf(c.keystones, 'auto-cleanse');
          if (cleanse && autoCleanseReady(clock.nowUs, rkH.icdsUs.autoCleanse ?? 0)) {
            delete statuses[st];
            rkH.icdsUs.autoCleanse = clock.nowUs + Number(cleanse.params.icdSec) * units;
            push(s, 'Auto Cleanse removes it');
          }
          // A hard stop cancels the unpaid windup at the control timestamp, not at the next
          // movement sample; the queued release then finds no intent and pays nothing.
          if (st === 'shock' && (statuses.shock?.secLeft ?? 0) > 0) {
            cancelPlayerBasic('shock');
            if (arena?.intent?.phase === 'windup') cancelIntent('shock');
            else if (arena?.intent?.phase === 'recovery' && arena.intent.mobile) {
              // Completed channel pulses stay spent; unresolved future pulses are dropped.
              const channelAction = arena.intent.actionId;
              for (const flight of [...arena.flights]) {
                if (flight.actionId !== channelAction || flight.timing.impactAtUs <= clock.nowUs) continue;
                const at = arena.flights.indexOf(flight);
                if (at >= 0) arena.flights.splice(at, 1);
              }
              cancelIntent('shock');
            } else if (arena?.intent?.phase === 'recovery' && arena.intent.actionId != null
              && sm.byId[arena.intent.skillId]?.action?.kind === 'projectile-burst') {
              // A committed burst drops only the shots that have not left the bow yet.
              for (const flight of [...arena.flights]) {
                if (flight.actionId !== arena.intent.actionId || flight.timing.releaseAtUs <= clock.nowUs) continue;
                const at = arena.flights.indexOf(flight);
                if (at >= 0) arena.flights.splice(at, 1);
              }
            }
          }
        }
        if (st) fx(s, { kind: 'proc', side: 'self', byId: mob.id, skillId: plannedSkill?.id, text: st, colour: statusColour(st) });
      }
      // the damage-taken trigger fires at the hit that raised it, in the secondary queue
      if (hurt && s.player.hp > 0) queueTrigger(trig.taken, mob.id);
    }

  return { resolveIncomingHit };
}
