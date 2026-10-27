import { E, eng } from '../../engine/client';
import type { AutoReturnState, Cell, GameState, PatrolState, PatrolStop } from '../core/types';
import { fieldInFight } from './field-area';
import { slotsAvailable, slotsUsed } from '../gear/slots';
import { currentCell, ownerOf, rankOf, road, startWalk, zoneOf } from './road';

const CFG = E.road.patrol;

export const newPatrolState = (): PatrolState => ({
  stops: [], active: false, repeat: CFG.repeat_default, index: 0, groupsCleared: 0,
});

export const newAutoReturnState = (): AutoReturnState => ({
  enabled: CFG.auto_return_default, phase: 'idle', resumeCell: null,
});

export function movePatrolStop(state: GameState, index: number, direction: -1 | 1): boolean {
  const next = index + direction;
  if (state.patrol.active || state.walk || index < 0 || index >= state.patrol.stops.length || next < 0 || next >= state.patrol.stops.length) return false;
  [state.patrol.stops[index], state.patrol.stops[next]] = [state.patrol.stops[next], state.patrol.stops[index]];
  state.patrol.index = 0;
  state.patrol.groupsCleared = 0;
  return true;
}

const at = (a: { q: number; r: number } | null | undefined, b: { q: number; r: number } | null | undefined) =>
  !!a && !!b && a.q === b.q && a.r === b.r;

function validStop(state: GameState, stop: PatrolStop): string | null {
  const zone = eng.zoneById(stop.zone);
  if (!zone || !zone.subzones?.[stop.subzone]) return 'Choose a named subzone';
  if (stop.cell.sub !== stop.subzone || stop.cell.wild != null || rankOf(stop.cell) === 0) return 'Patrol stops must be named subzones';
  const owner = ownerOf(stop.cell);
  if (zoneOf(stop.cell) !== stop.zone) return 'That subzone belongs to another zone';
  if (!state.town.visited.includes(owner.id)) return 'Walk to this settlement once before adding a patrol stop';
  return null;
}

export function normalizeExplorationState(state: GameState): void {
  const rawPatrol = (state as any).patrol || {};
  const stops: PatrolStop[] = [];
  for (const row of Array.isArray(rawPatrol.stops) ? rawPatrol.stops : []) {
    const q = Number(row?.cell?.q), r = Number(row?.cell?.r);
    const zone = Math.floor(Number(row?.zone)), subzone = Math.floor(Number(row?.subzone));
    if (!Number.isFinite(q) || !Number.isFinite(r) || !Number.isInteger(q) || !Number.isInteger(r)) continue;
    const stop: PatrolStop = { zone, subzone, cell: { q, r, sub: subzone, wild: null } };
    if (validStop(state, stop) || stops.some((other) => at(other.cell, stop.cell))) continue;
    if (stops.length && stops[0].zone !== stop.zone) continue;
    if (stops.length < CFG.max_stops) stops.push(stop);
  }
  const groupsPerStop = Math.max(1, CFG.groups_per_stop);
  const index = Math.min(Math.max(0, Math.floor(Number(rawPatrol.index) || 0)), Math.max(0, stops.length - 1));
  const groupsCleared = Math.min(groupsPerStop - 1, Math.max(0, Math.floor(Number(rawPatrol.groupsCleared) || 0)));
  state.patrol = {
    stops,
    active: Boolean(rawPatrol.active) && stops.length >= CFG.min_stops,
    repeat: rawPatrol.repeat == null ? CFG.repeat_default : Boolean(rawPatrol.repeat),
    index,
    groupsCleared,
  };

  const rawAuto = (state as any).autoReturn || {};
  const phases: AutoReturnState['phase'][] = ['idle', 'waiting', 'to-town', 'to-stop'];
  const phase = phases.includes(rawAuto.phase) ? rawAuto.phase as AutoReturnState['phase'] : 'idle';
  const rq = Number(rawAuto.resumeCell?.q), rr = Number(rawAuto.resumeCell?.r), rs = Number(rawAuto.resumeCell?.sub);
  const resumeCell = Number.isInteger(rq) && Number.isInteger(rr) && Number.isInteger(rs)
    ? { q: rq, r: rr, sub: rs, wild: null } : null;
  const validResume = !!resumeCell && stops.some((stop) => stop.subzone === resumeCell.sub && at(stop.cell, resumeCell));
  const finishingStoppedTrip = !state.patrol.active && rawAuto.resumeCell == null && phase !== 'idle';
  state.autoReturn = {
    enabled: rawAuto.enabled == null ? CFG.auto_return_default : Boolean(rawAuto.enabled),
    phase: phase !== 'idle' && !finishingStoppedTrip && (!validResume || stops.length < CFG.min_stops) ? 'idle' : phase,
    resumeCell: validResume && phase !== 'idle' ? resumeCell : null,
  };
}

export function togglePatrolStop(state: GameState, stop: PatrolStop): { ok: boolean; why?: string; added?: boolean } {
  if (state.patrol.active || state.autoReturn.phase !== 'idle') return { ok: false, why: 'Stop the current Patrol first' };
  const invalid = validStop(state, stop);
  if (invalid) return { ok: false, why: invalid };
  const existing = state.patrol.stops.findIndex((row) => at(row.cell, stop.cell));
  if (existing >= 0) {
    state.patrol.stops.splice(existing, 1);
    state.patrol.index = 0;
    state.patrol.groupsCleared = 0;
    return { ok: true, added: false };
  }
  if (state.patrol.stops.length >= CFG.max_stops) return { ok: false, why: `Patrols hold up to ${CFG.max_stops} stops` };
  if (state.patrol.stops.length && state.patrol.stops[0].zone !== stop.zone) return { ok: false, why: 'Keep a Patrol inside one zone; use Forward or walk to travel farther' };
  state.patrol.stops.push(structuredClone(stop));
  state.patrol.index = 0;
  state.patrol.groupsCleared = 0;
  return { ok: true, added: true };
}

export function clearPatrolStops(state: GameState): boolean {
  if (state.patrol.active || state.autoReturn.phase !== 'idle') return false;
  state.patrol.stops = [];
  state.patrol.index = 0;
  state.patrol.groupsCleared = 0;
  return true;
}

export function startPatrol(state: GameState): { ok: boolean; why?: string } {
  if (state.patrol.active) return { ok: false, why: 'Patrol is already running' };
  if (state.walk || state.dungeon || state.phase === 'camp') return { ok: false, why: 'Finish the walk, dungeon or Camp recovery before starting Patrol' };
  if (state.patrol.stops.length < CFG.min_stops) return { ok: false, why: `Add at least ${CFG.min_stops} subzones to the route` };
  const invalid = state.patrol.stops.map((stop) => validStop(state, stop)).find(Boolean);
  if (invalid) return { ok: false, why: invalid };
  if (state.patrol.stops.some((stop) => stop.zone !== state.patrol.stops[0].zone)) return { ok: false, why: 'Keep a Patrol inside one zone' };
  state.patrol.active = true;
  state.patrol.index = 0;
  state.patrol.groupsCleared = 0;
  state.hunting = true;
  drivePatrol(state, true);
  return { ok: true };
}

export function stopPatrol(state: GameState): void {
  state.patrol.active = false;
  state.patrol.groupsCleared = 0;
  // Finish a return trip safely, then wait in town instead of rejoining the route.
  if (state.autoReturn.phase !== 'idle') state.autoReturn.resumeCell = null;
}

function stopCell(stop: PatrolStop): Cell {
  return { ...stop.cell, sub: stop.subzone, wild: null };
}

export function drivePatrol(state: GameState, online: boolean): string | null {
  if (!online || !state.patrol.active || state.walk || fieldInFight(state) || state.dungeon || state.phase === 'camp'
    || state.autoReturn.phase !== 'idle') return null;
  if (state.patrol.groupsCleared >= CFG.groups_per_stop) {
    const completed = advancePatrol(state);
    if (!state.patrol.active) return completed;
  }
  const stop = state.patrol.stops[state.patrol.index];
  if (!stop) { state.patrol.active = false; return 'Patrol stopped · no valid stops'; }
  const target = stopCell(stop);
  if (state.zone === stop.zone && state.cell?.sub === stop.subzone && at(currentCell(state), target)) {
    state.hunting = true;
    return null;
  }
  const result = startWalk(state, target);
  if (!result.ok) {
    state.patrol.active = false;
    return `Patrol stopped · ${result.why || 'could not reach the next stop'}`;
  }
  return `Patrol walking to ${eng.zoneById(stop.zone).subzones?.[stop.subzone]?.name || `sub-zone ${stop.subzone + 1}`}`;
}

function advancePatrol(state: GameState): string {
  const stop = state.patrol.stops[state.patrol.index];
  state.patrol.groupsCleared = 0;
  if (!stop) { state.patrol.active = false; return 'Patrol stopped · no valid stops'; }
  if (state.patrol.index + 1 < state.patrol.stops.length) {
    state.patrol.index++;
  } else if (state.patrol.repeat) {
    state.patrol.index = 0;
  } else {
    state.patrol.active = false;
    return `Patrol complete · ${eng.zoneById(stop.zone).subzones?.[stop.subzone]?.name || `sub-zone ${stop.subzone + 1}`}`;
  }
  const next = state.patrol.stops[state.patrol.index];
  if (!next) { state.patrol.active = false; return 'Patrol stopped · no next stop'; }
  return `Patrol moving to ${eng.zoneById(next.zone).subzones?.[next.subzone]?.name || `sub-zone ${next.subzone + 1}`}`;
}

export function recordPatrolGroupClear(state: GameState, online: boolean): string | null {
  if (!state.patrol.active || state.walk || state.dungeon || state.phase === 'camp') return null;
  const stop = state.patrol.stops[state.patrol.index];
  if (!stop || state.zone !== stop.zone || state.cell?.sub !== stop.subzone || !at(currentCell(state), stopCell(stop))) return null;
  if (state.patrol.groupsCleared >= CFG.groups_per_stop) return null;
  state.patrol.groupsCleared++;
  if (state.patrol.groupsCleared < CFG.groups_per_stop) {
    return `${eng.zoneById(stop.zone).subzones?.[stop.subzone]?.name || `sub-zone ${stop.subzone + 1}`} · ${state.patrol.groupsCleared}/${CFG.groups_per_stop} groups cleared`;
  }
  return online ? advancePatrol(state) : null;
}

/** The bag's own size sets the trip's watermark: `pct` of every slot the character carries. */
export const autoReturnThreshold = (state: GameState) =>
  Math.ceil(slotsAvailable(state) * CFG.auto_return_threshold_pct / 100);

/** Readiness shared by the live trip and its preview; enabling the setting does not bypass a blocker. */
export function autoReturnBlocker(state: GameState, wasPatrolling = state.patrol.active): string | null {
  if (state.autoReturn.phase !== 'idle') return `Already returning (${state.autoReturn.phase})`;
  if (!wasPatrolling) return 'Needs an active Patrol';
  if (slotsUsed(state) < autoReturnThreshold(state)) return `Waits until ${autoReturnThreshold(state)} of ${slotsAvailable(state)} slots are used`;
  if (state.walk) return 'Waiting for the walk to finish';
  if (fieldInFight(state)) return 'Waiting for the fight to finish';
  if (state.dungeon) return 'Waiting for the dungeon to finish';
  if (state.phase === 'camp') return 'Waiting for Camp recovery';
  return null;
}

function startReturnWalk(state: GameState): string | null {
  const feet = currentCell(state);
  const home = road.nodeById(ownerOf(feet).id);
  if (!home) {
    state.autoReturn.phase = 'idle';
    state.autoReturn.resumeCell = null;
    state.patrol.active = false;
    return 'Auto-Return stopped · no settlement is reachable';
  }
  if (rankOf(feet) === 0) return null;
  const result = startWalk(state, { q: home.q, r: home.r, sub: null, wild: null });
  if (!result.ok) {
    state.autoReturn.phase = 'idle';
    state.autoReturn.resumeCell = null;
    state.patrol.active = false;
    return `Auto-Return stopped · ${result.why || 'could not reach settlement'}`;
  }
  state.hunting = false;
  return `Auto-Return · walking to ${home.id}`;
}

export function maybeStartAutoReturn(state: GameState, online: boolean, wasPatrolling = state.patrol.active): string | null {
  if (!state.autoReturn.enabled || autoReturnBlocker(state, wasPatrolling)) return null;
  state.autoReturn.resumeCell = state.patrol.active && state.cell ? structuredClone(state.cell) : null;
  state.autoReturn.phase = online ? 'to-town' : 'waiting';
  state.hunting = false;
  if (!online) return null;
  return startReturnWalk(state);
}

export function driveAutoReturn(state: GameState, online: boolean): { message: string | null; deposit: boolean } {
  if (!online || state.autoReturn.phase === 'idle' || state.walk || fieldInFight(state) || state.dungeon || state.phase === 'camp') {
    return { message: null, deposit: false };
  }
  if (state.autoReturn.phase === 'waiting') state.autoReturn.phase = 'to-town';
  if (state.autoReturn.phase === 'to-town') {
    if (rankOf(currentCell(state)) === 0) return { message: null, deposit: true };
    return { message: startReturnWalk(state), deposit: false };
  }
  const resume = state.autoReturn.resumeCell;
  if (!resume) {
    if (rankOf(currentCell(state)) > 0) {
      state.autoReturn.phase = 'to-town';
      return { message: startReturnWalk(state), deposit: false };
    }
    state.autoReturn.phase = 'idle';
    state.hunting = false;
    return { message: 'Auto-Return complete · Patrol is stopped at the settlement', deposit: false };
  }
  if (at(currentCell(state), resume)) {
    state.autoReturn.phase = 'idle';
    state.autoReturn.resumeCell = null;
    state.hunting = true;
      return { message: 'Patrol resumed', deposit: false };
  }
  const result = startWalk(state, resume);
  if (!result.ok) {
    state.autoReturn.phase = 'idle';
    state.autoReturn.resumeCell = null;
    state.patrol.active = false;
    return { message: `Auto-Return complete · Patrol paused (${result.why || 'stop unreachable'})`, deposit: false };
  }
  state.autoReturn.phase = 'to-stop';
  return { message: 'Auto-Return · heading back to Patrol', deposit: false };
}

export function finishAutoReturnDeposit(state: GameState, moved: number): string {
  const resume = state.autoReturn.resumeCell;
  if (moved <= 0 || slotsUsed(state) >= autoReturnThreshold(state)) {
    state.autoReturn.phase = 'idle';
    state.autoReturn.resumeCell = null;
    state.patrol.active = false;
    state.hunting = false;
    return moved <= 0
      ? 'Auto-Return paused · no unlocked gear could be stashed; unlock a stash tab or free bag slots'
      : 'Auto-Return paused · bag is still near full; free slots before restarting Patrol';
  }
  if (!resume || !state.patrol.active) {
    state.autoReturn.phase = 'idle';
    state.autoReturn.resumeCell = null;
    state.hunting = false;
    return `Auto-Return · stashed ${moved} pieces; waiting at the settlement`;
  }
  state.autoReturn.phase = 'to-stop';
  return `Auto-Return · stashed ${moved} pieces; returning to Patrol`;
}
