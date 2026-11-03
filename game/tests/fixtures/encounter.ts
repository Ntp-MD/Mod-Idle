import { characterSheet, newGame, tick, setLevel, huntZone } from '@sim/core/game';
import { createCombatArena } from '@sim/combat/combat-arena';
import type { CombatArena } from '@sim/combat/combat-arena';
import type { ManualControl } from '@sim/combat/combat-actions';
import { grantNamedSkill } from '@sim/combat/skills';
import { settlementOfZone } from '@sim/town/town';
import type { GameState } from '@sim/core/types';

export interface EncounterOptions {
  seed?: number;
  /** Living bodies to wait for before the encounter is considered ready. */
  bodies?: number;
  zone?: number;
  keystones?: string[];
  /** Named skills granted to the character before the encounter starts. */
  skills?: string[];
}

export interface TraceEntry {
  tick: number;
  clock: number;
  manual: boolean;
  player: { x: number; y: number };
  focusId: string | null;
  intent: { skillId: string; targetId: string; phase: string; actionId?: number; releaseAtUs?: number } | null;
  actions: Array<{
    id: number;
    skillId: string | null;
    atUs: number;
    releasedAtUs: number | null;
    /** The cast plan's own release beat; player casts carry it even when the action field is unset. */
    timingReleaseAtUs: number | null;
    impactAtUs: number | null;
    impactCount: number;
  }>;
}

export interface Encounter {
  state: GameState;
  arena: CombatArena;
  trace: TraceEntry[];
  /** Run `ticks` world steps; `manual` is supplied on the named tick only. */
  run: (ticks: number, manualAt?: { tick: number; manual: ManualControl }, opts?: { autoSkills?: boolean }) => void;
}

/** A seeded field encounter with a live arena, so population, positions and rolls are reproducible. */
export function seededEncounter(options: EncounterOptions = {}): Encounter {
  const { seed = 20260101, bodies = 8, zone, keystones = [], skills = [] } = options;
  const state = newGame(seed);
  setLevel(state, 60);
  const targetZone = zone ?? state.zone;
  const settlement = settlementOfZone(targetZone);
  if (settlement && !state.town.visited.includes(settlement.id)) state.town.visited.push(settlement.id);
  huntZone(state, targetZone);
  state.player.hp = 1e9;
  state.player.mana = characterSheet(state).maxMana;
  for (const id of keystones) {
    state.player.treeRanks ||= {};
    state.player.treeRanks[id] = 1;
  }
  for (const id of skills) grantNamedSkill(state.skills, id);
  const arena = createCombatArena();
  let guard = 0;
  while (state.group.length < bodies && guard++ < 300) tick(state, { online: true, arena, autoSkills: false });

  const trace: TraceEntry[] = [];
  const record = (index: number, manual: boolean) => {
    trace.push({
      tick: index,
      clock: state.clockSec,
      manual,
      player: { x: arena.player.x, y: arena.player.y },
      focusId: arena.focusId ?? null,
      intent: arena.intent
        ? {
            skillId: arena.intent.skillId,
            targetId: arena.intent.targetId,
            phase: arena.intent.phase,
            actionId: arena.intent.actionId,
            releaseAtUs: arena.intent.releaseAtUs,
          }
        : null,
      actions: arena.actions
        .filter((action) => action.actorId === 'player')
        .map((action) => ({
          id: action.id,
          skillId: action.skillId ?? null,
          atUs: action.atUs,
          releasedAtUs: action.releasedAtUs ?? null,
          timingReleaseAtUs: action.timing?.releaseAtUs ?? null,
          impactAtUs: action.timing?.impactAtUs ?? null,
          impactCount: action.impactCount ?? 0,
        })),
    });
  };

  return {
    state,
    arena,
    trace,
    run(ticks: number, manualAt?: { tick: number; manual: ManualControl }, opts?: { autoSkills?: boolean }) {
      for (let i = 0; i < ticks; i++) {
        state.player.hp = 1e9;
  state.player.mana = characterSheet(state).maxMana;
        const manual = Boolean(manualAt && manualAt.tick === i);
        tick(state, { online: true, arena, ...(manual ? { manual: manualAt!.manual } : {}),
          ...(opts?.autoSkills !== undefined ? { autoSkills: opts.autoSkills } : {}) });
        record(trace.length, manual);
      }
    },
  };
}

/** A stable fingerprint of everything a replay is expected to reproduce. */
export function encounterSignature(encounter: Encounter): string {
  const { state, arena } = encounter;
  const mobs = state.group
    .filter((mob) => mob.hp > 0)
    .map((mob) => {
      const actor = arena.mobs[mob.id];
      return [mob.id, Math.round(mob.hp), actor ? `${actor.x.toFixed(3)},${actor.y.toFixed(3)}` : '-'].join(':');
    })
    .sort();
  const actions = arena.actions.map((action) =>
    [action.id, action.actorId, action.kind, action.skillId ?? '-', action.atUs, action.releasedAtUs ?? '-', action.impactCount ?? 0].join(':'),
  );
  return [
    `clock=${state.clockSec}`,
    `kills=${state.counters.kills}`,
    `hp=${Math.round(state.player.hp)}`,
    `xp=${state.player.xp}`,
    `player=${arena.player.x.toFixed(3)},${arena.player.y.toFixed(3)}`,
    `mobs=${mobs.join('|')}`,
    `actions=${actions.join('|')}`,
  ].join('\n');
}
