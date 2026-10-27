import type { GameState, Mob } from '../types';
import type { Character } from '../player';
import type { CombatArena } from '../../combat/combat-arena';
import type { CombatClock } from '../../combat/combat-clock';
import type { SkillAreaSnapshot, SkillCastTiming } from '../../../../../engine/types.ts';
import { E, eng, sm } from '../../../engine/client';
import type { CastReport, PreparedSkillCast, TriggerAura } from '../../combat/skills';
import type { StatusName } from '../../combat/combat';
import { bundleOf, capacitiveEs, manaDebtFloor } from '../../../../../engine/keystones.ts';
import { reservedMana, usableMana, castOnce, spendableMana, prepareFirstSkillCast, resolvePreparedCast } from '../../combat/skills';
import { applyCurse, lineValue } from '../../combat/curse';
import { holdPoison } from '../../combat/mobStatus';
import { arenaAction, updateArenaAction } from '../../combat/combat-arena';
import { targetsInSkillArea } from '../../../../../engine/skill-actions.ts';
import { skillCastTiming } from '../../../../../engine/skill-actions.ts';
import { fieldAreaKey } from '../../world/field-area';
import type { CombatFlight } from '../../combat/combat-actions';
import { isBossKind } from '../kinds';
import { fx, hitColour, credit } from '../feedback';
import { push } from '../log';

type CastOutcomeOptions = {
  pay?: boolean;
  emitCast?: boolean;
  castCounter?: boolean;
  mirror?: boolean;
  actionId?: number;
  castTiming?: SkillCastTiming;
};

/**
 * Cast and trigger resolution: the price a press pays, its FX line, the outcome it applies, and the
 * aura triggers that can fire from it. Bodies arrive verbatim from the tick.
 */
export function createCastTrigger(opts: {
  arena: CombatArena | undefined;
  clock: CombatClock;
  rng: () => number;
  s: GameState;
  c: Character;
  attackCharacter: Character;
  units: number;
  timeUs: number | null;
  statuses: GameState['playerStatuses'];
  rkH: GameState['keystoneRuntime'];
  front: Mob | undefined;
  crippledOutgoingMult: number;
  playerActiveFraction: number;
  trig: { crit: TriggerAura | null; taken: TriggerAura | null };
  queueTrigger: (aura: TriggerAura | null, targetId: string) => void;
  recoverLeech: (amount: number, atUs: number) => void;
  mirrorReady: () => boolean;
  luckyBonus: () => number;
  tranceFree: () => boolean;
  arenaActors: (group: Mob[]) => any[];
  resolveTargetsForSkill: ((id: string, group: Mob[]) => { targets: Mob[]; area?: SkillAreaSnapshot }) | undefined;
  resolveFlight: (flight: any, atUs: number, forced?: Mob[]) => void;
  scheduleFlight: (flight: any) => void;
  onKill: (s: GameState, rng: () => number, mob: Mob, c: Character, statuses?: any) => void;
}) {
  const {
    arena, clock, rng, s, c, attackCharacter, units, timeUs, statuses, rkH, front,
    crippledOutgoingMult, playerActiveFraction, trig, queueTrigger, recoverLeech,
    mirrorReady, luckyBonus, tranceFree, arenaActors, resolveTargetsForSkill,
    resolveFlight, scheduleFlight, onKill,
  } = opts;

  function payCast(cast: Pick<PreparedSkillCast, 'manaCost' | 'hpCost'>) {
      const debt = bundleOf(c.keystones, 'mana-debt');
      const capac = bundleOf(c.keystones, 'capacitive-casting');
      const manaBefore = s.player.mana;
      s.player.mana = debt ? s.player.mana - cast.manaCost : Math.max(0, s.player.mana - cast.manaCost);
      // 58 Capacitive Casting: 20% of FUNDED Mana spend returns as ES (borrowed Mana gives nothing)
      if (capac && cast.manaCost > 0) {
        s.player.es = Math.min(c.es, s.player.es + capacitiveEs(cast.manaCost,
          Math.max(0, manaBefore - reservedMana(c, s.skills)), capac.params as Record<string, number>));
      }
      if (debt) {
        // snapshot the borrow limit the moment the pool first crosses zero; a later MaxMana change
        // never moves it, and reaching zero again clears it (§7.4.10)
        if (s.player.mana < 0 && s.keystoneRuntime.manaDebtLimit === null) {
          s.keystoneRuntime.manaDebtLimit = manaDebtFloor(usableMana(c, s.skills), debt.params as Record<string, number>);
        } else if (s.player.mana >= 0) s.keystoneRuntime.manaDebtLimit = null;
      }
      if (cast.hpCost > 0) s.player.hp = Math.max(1, s.player.hp - cast.hpCost);
    }

    function castFx(id: string, area: SkillAreaSnapshot | undefined, targets: string[], actionId?: number,
      timing?: SkillCastTiming, extra: { charges?: number; cleansed?: number } = {}) {
      const skill = sm.byId[id];
      fx(s, {
        kind: 'cast', side: 'self', skillId: id, actionId, castTiming: timing,
        text: String(skill?.name || id), colour: hitColour((skill as any)?.element || null),
        skillOutcome: { targets, area, ...extra },
      });
    }

    function applyCastOutcome(cast: CastReport | null, opts: CastOutcomeOptions = {}) {
      if (!cast) return;
      if (opts.pay !== false) payCast(cast);
      if (cast.heal) s.healUp = cast.heal;
      if (cast.charges != null) {
        s.player.charges = cast.charges;
        push(s, `${cast.name} grants ${cast.charges} perfect-dodge charges`);
      }
      if (cast.blockCharges != null) {
        s.player.blockCharges = cast.blockCharges;
        push(s, `${cast.name} grants ${cast.blockCharges} blocks`);
      }
      let cleansed = 0;
      if (cast.cleansesSelf) {
        const cleared = Object.keys(statuses).length;
        cleansed = cleared;
        for (const k of Object.keys(statuses) as StatusName[]) delete statuses[k];
        if (cleared) push(s, `${cast.name} clears ${cleared} status${cleared > 1 ? '' : 'es'} off you`);
      }
      if (cast.instantHealPct) {
        const healed = (c.maxHp * cast.instantHealPct) / 100;
        const before = s.player.hp;
        s.player.hp = Math.min(c.maxHp, s.player.hp + healed);
        push(s, `${cast.name} restores ${eng.fmt(healed)} HP at once (${cast.instantHealPct}% of the pool)`);
        // the pool's own answer, in the colour of the Element the press carried — the number the heal
        // actually moved, not the number the row prices, so a top-off at full HP says what it did
        fx(s, { kind: 'heal', side: 'self', skillId: cast.id, actionId: opts.actionId, text: `+${eng.fmt(s.player.hp - before)}`, colour: hitColour((sm.byId[cast.id] as any)?.element || null) });
      }
      if (cast.damage && cast.targets) push(s, `${cast.name} hits ${cast.targets} for ${eng.fmt(cast.damage)}${cast.crit ? ' (crit)' : ''}`);
      // the press's colour comes from the row's own Element (`skills.json` `element`), the same field
      // the status rider reads — a press with no Element name is the neutral half
      const castElement = (sm.byId[cast.id] as any)?.element || null;
      // one number per mob the press actually hurt, each on its own plate: the sim already decided how the
      // share split and the mitigation landed on every target, so the screen shows that and not the total
      for (const h of cast.byMob) {
        fx(s, {
          kind: 'hit', side: 'field', mobId: h.id, crit: cast.crit, via: 'cast', skillId: cast.id, actionId: opts.actionId,
          text: eng.fmt(h.amount), value: h.amount, colour: hitColour(castElement, cast.crit),
        });
      }
      if (cast.crit && cast.byMob[0]) queueTrigger(trig.crit, cast.byMob[0].id);
      if (cast.name && opts.emitCast !== false) castFx(cast.id, cast.area,
        cast.curseTargets ?? (cast.curseOn ? [cast.curseOn] : cast.byMob.map(hit => hit.id)),
        opts.actionId, opts.castTiming, { charges: cast.charges ?? cast.blockCharges, cleansed });
      if (cast.consumed?.length) push(s, `${cast.name} consumes ${cast.consumed.map((c) => `${c.stacks} ${c.status}`).join(', ')}`);
      if (cast.spread?.length) push(s, `${cast.name} spreads ${cast.spread.map((c) => c.status).join(', ')}`);
      if (cast.damage && !cast.targets) push(s, `${cast.name} was dodged`);
      credit(s, 'cast', cast.dealt || 0);
      // Bloodthirst: the press's direct damage leeches as the swing's does. The intrinsic leech
      // line keeps its historical swing-only route; this is the bundle's own 3%.
      const bloodthirst = bundleOf(c.keystones, 'bloodthirst');
      const castDealt = cast.dealt ?? 0;
      if (bloodthirst && castDealt > 0)
        recoverLeech(castDealt * Number(bloodthirst.params.leechPct) / 100, clock.nowUs);
      for (const targetId of cast.curseTargets ?? (cast.curseOn ? [cast.curseOn] : [])) {
        const sec = applyCurse(s.curses, targetId, sm.byId[cast.id], c.keystones);
        // a curse line that names a status clock (Venom Bind) is spent on the status store, not the
        // curse store, because it changes how another line decays rather than adding a multiplier — and
        // it is read back off the line the curse actually wrote, so `28` Malediction stretches it once
        for (const e of (sm.byId[cast.id].effects || [])) {
          if (e.subject === 'target' && e.stat === 'poison_hold_sec')
            holdPoison(s.mobStatus, targetId, lineValue(s.curses, targetId, 'poison_hold_sec') || e.value);
        }
        push(s, `${cast.name} lands for ${sec} sec`);
      }
      // Trance counts every cast; Lucky Streak only moves on a damage press; Mirror Strike's
      // banked crit is spent by the first press that actually lands on a target.
      const trance = bundleOf(c.keystones, 'trance');
      if (trance && opts.castCounter !== false) rkH.counters.tranceCasts = (rkH.counters.tranceCasts || 0) + 1;
      const lucky = bundleOf(c.keystones, 'lucky-streak');
      if (lucky && cast.damage > 0) rkH.stacks.luckyStreak = cast.crit
        ? Math.min(Number(lucky.params.maxStacks), (rkH.stacks.luckyStreak || 0) + 1) : 0;
      if (opts.mirror !== false && cast.targets > 0) rkH.flags.mirrorCrit = false;
      while (s.group.some((mob) => mob.hp <= 0)) {
        const dead = s.group.splice(s.group.findIndex((mob) => mob.hp <= 0), 1)[0];
        onKill(s, rng, dead, c, statuses);
      }
    }

    function applyCast(cast: CastReport | null) {
      if (!cast) return;
      applyCastOutcome(cast);
    }

    /**
     * A trigger aura's press: the same `castOnce` the rotation uses, asking for the first ready slot in
     * the cast order, with the aura's price on it. It spends the aura's own clock (`trigger_cd_sec`),
     * never the skill's cooldown, so the trigger is an extra press rather than a re-ordered rotation.
     */
    function fireTrigger(aura: TriggerAura | null) {
      if (!aura || playerActiveFraction <= 0 || (s.skills.cd[aura.id] || 0) > 0) return;
      const free = tranceFree();
      const force = mirrorReady();
      const lucky = luckyBonus();
      const trigger = { manaMult: aura.manaMult, damageMult: aura.damageMult };
      const env = {
        resolveTargetsForSkill,
        mobStatus: s.mobStatus, curses: s.curses,
        currentHp: s.player.hp,
        missingHpPct: c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0,
        isBoss: s.group.some((mob) => isBossKind(String(mob.kind))),
        trigger,
        timeUs: arena ? clock.nowUs : timeUs,
        freeCast: free,
        forceCrit: force,
        critDamageBonusPct: lucky,
        spatialTargets: !!arena,
      };
      if (!arena) {
        const t = castOnce(s.skills, attackCharacter, spendableMana(attackCharacter, s.skills, s.player.mana), s.group, statuses, rng, env);
        if (!t) return;
        s.skills.cd[aura.id] = aura.cdSec;
        push(s, `${sm.byId[aura.id].name} triggers ${t.name}`);
        applyCast(t);
        return;
      }
      const prepared = prepareFirstSkillCast(s.skills, attackCharacter,
        spendableMana(attackCharacter, s.skills, s.player.mana), s.group, statuses, env);
      if (!prepared) return;
      s.skills.cd[aura.id] = aura.cdSec;
      push(s, `${sm.byId[aura.id].name} triggers ${sm.byId[prepared.id].name}`);
      launchTrigger(prepared, trigger, free, force, lucky, clock.nowUs);
    }

    /** Trigger auras are immediate, non-blocking casts: they own an action and flight but never the intent. */
    function launchTrigger(
      prepared: PreparedSkillCast, trigger: { manaMult: number; damageMult: number },
      free: boolean, force: boolean, lucky: number, atUs: number,
    ) {
      if (!arena) return;
      const skill = sm.byId[prepared.id];
      if (!skill) return;
      const profile = sm.castProfileOf(skill);
      const timing = skillCastTiming({ ...profile, windup_sec: 0, recovery_sec: 0 }, atUs, units,
        { x: arena.player.x, y: arena.player.y }, prepared.area?.center ?? { x: arena.player.x, y: arena.player.y },
        Math.max(1e-7, c.globalSpeed || 1));
      const targetId = prepared.targets[0]?.id ?? prepared.area?.targetId ?? arena.intent?.targetId ?? front?.id;
      const previousAction = arena.player.action;
      const wasMoving = arena.player.moving;
      const action = arenaAction(arena, 'player', 'cast', atUs, targetId, prepared.id, prepared.area, timing);
      if (previousAction) arena.player.action = previousAction;
      arena.player.moving = wasMoving;
      if (!action) return;
      // The trigger owns its effect and flight; the primary pose stays with the action underneath.
      updateArenaAction(arena, action.id, { nonblocking: true });
      payCast(prepared);
      const trance = bundleOf(c.keystones, 'trance');
      if (trance) rkH.counters.tranceCasts = (rkH.counters.tranceCasts || 0) + 1;
      if (force && skill.type === 'attack') rkH.flags.mirrorCrit = false;
      const struck = prepared.area
        ? targetsInSkillArea(prepared.area, arenaActors(s.group), profile.hit_radius_m).map((actor) => actor.mob.id)
        : skill.type === 'attack' || skill.type === 'curse' ? prepared.targets.map((mob) => mob.id) : [];
      castFx(prepared.id, prepared.area, struck, action.id, timing);
      const missingHpPct = c.maxHp > 0 ? (1 - s.player.hp / c.maxHp) * 100 : 0;
      const flight: CombatFlight = {
        actionId: action.id, cast: prepared, character: attackCharacter,
        modifiers: { trigger, forceCrit: force, critDamageBonusPct: lucky, freeCast: free, missingHpPct,
          outgoingDamageMult: crippledOutgoingMult },
        profile, timing,
        source: { x: arena.player.x, y: arena.player.y },
        destination: prepared.area?.center ?? { x: arena.player.x, y: arena.player.y },
        area: prepared.area, position: { x: arena.player.x, y: arena.player.y }, lastCheckedAtUs: atUs,
        areaKey: fieldAreaKey(s),
      };
      if (skill.type === 'heal' || skill.type === 'buff') {
        const report = resolvePreparedCast(s.skills, attackCharacter, prepared, statuses, rng, {
          mobStatus: s.mobStatus, curses: s.curses, timeUs: atUs, trigger, missingHpPct,
        });
        applyCastOutcome(report, { pay: false, emitCast: false, castCounter: false, mirror: false,
          actionId: action.id, castTiming: timing });
        return;
      }
      if (profile.delivery === 'projectile' || timing.impactAtUs > atUs) {
        arena.flights.push(flight);
        scheduleFlight(flight);
        return;
      }
      resolveFlight(flight, atUs);
    }

  return { payCast, castFx, applyCastOutcome, applyCast, fireTrigger, launchTrigger };
}
