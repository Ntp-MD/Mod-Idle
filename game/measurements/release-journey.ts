/**
 * Deterministic reference-player journey for the release-readiness gate.
 *
 * This module owns policy, resumable cursor, checkpoint comparison and the outcome vocabulary.
 * The Node runner owns process/file I/O and prints the gate table; it never re-implements a rule
 * here. No browser storage, wall-clock catch-up or forced rewards are used.
 */
import { E, eng, road } from '../src/engine/client';
import { createCombatArena, syncCombatArena } from '../src/sim/combat/combat-arena';
import { createGameLoop, type LoopContext } from '../src/app/loop';
import { DEFAULT_SETTINGS, exportJson, importJson } from '../src/state/save';
import { autoEquip } from '../src/sim/gear/gear';
import { atSettlement } from '../src/sim/gear/craft';
import { slotsAvailable, slotsFree, slotsUsed } from '../src/sim/gear/slots';
import { COMBAT_STEP_US, characterSheet, huntHere, newGame, runFilterNow } from '../src/sim/core/game';
import { allocateTreePath } from '../src/sim/core/tree';
import { recommendTreeNodes, type TreeGoalId } from '../src/sim/core/tree-guide';
import { claimTask, depositMany, sellJunk, stashTabCount } from '../src/sim/town/town';
import { cycleQuickbar, ownedPotions, QUICKBAR_SLOTS } from '../src/sim/world/farm';
import { currentCell, rankOf, settlementCell, startWalk, ownerOf, zoneOf } from '../src/sim/world/road';
import type { GameState, Item } from '../src/sim/core/types';

export const JOURNEY_SEED = 20261103;
export const JOURNEY_FORMAT_VERSION = 1;
export const JOURNEY_RESOURCE_MS = 30 * 60 * 1000;

export type JourneyStatus = 'PASS' | 'FAIL' | 'INCOMPLETE';

export interface JourneyRefusal {
  atSec: number;
  action: string;
  why: string;
}

/** The small, serialisable cursor. Results stay in the runner, never in the checkpoint. */
export interface JourneyMemory {
  targetZone: number;
  previousZone: number | null;
  retryZone: number | null;
  retryLevel: number;
  retrySwaps: number;
  gearSwaps: number;
  lastPush: number;
  goldEarned: number;
  goldSpent: number;
  lastGold: number;
  enteredZones: number[];
  treeSpent: number;
  quickbarFilled: number;
  refusals: JourneyRefusal[];
  inventoryBlocked: boolean;
}

export function newJourneyMemory(state: GameState): JourneyMemory {
  return {
    targetZone: state.zone,
    previousZone: null,
    retryZone: null,
    retryLevel: 0,
    retrySwaps: 0,
    gearSwaps: 0,
    lastPush: state.counters.pushes,
    goldEarned: 0,
    goldSpent: 0,
    lastGold: state.counters.gold,
    enteredZones: [state.zone],
    treeSpent: 0,
    quickbarFilled: 0,
    refusals: [],
    inventoryBlocked: false,
  };
}

export function createReferenceGame(): GameState {
  return newGame(JOURNEY_SEED);
}

export interface JourneyRuntime {
  state: GameState;
  memory: JourneyMemory;
  step: () => void;
  /** Advance exactly one world second with the same public step the live loop uses. */
  advanceSecond: () => void;
  refusals: JourneyRefusal[];
}

function unitsPerSecond(): number {
  const mechanics = (eng as any).mechanics;
  return Number(mechanics?.combat_time_units_per_sec) || 1;
}

export function createJourneyRuntime(
  state: GameState = createReferenceGame(),
  memory: JourneyMemory = newJourneyMemory(state),
): JourneyRuntime {
  const units = unitsPerSecond();
  let arena = createCombatArena();
  syncCombatArena(arena, state, state.clockSec * units, units, characterSheet(state).maxHp);
  const ctx: LoopContext = {
    get gameState() { return state; },
    get settings() { return DEFAULT_SETTINGS; },
    get transactionWriter() { return true; },
    get arenaMode() { return true; },
    get combatArena() { return arena; },
    set combatArena(value) { arena = value; },
    get arenaManual() { return {}; },
    get running() { return true; },
    get paused() { return false; },
    get speed() { return 1; },
    get canWriteAccount() { return true; },
    set cooldownSimRemainder(_value: number) { /* no UI readout in measurement */ },
    set cooldownSchedulerAt(_value: number) { /* no UI readout in measurement */ },
    syncArenaFocus() { /* no UI focus in measurement */ },
    equipCarriedBest() {
      const result = autoEquip(state, 0);
      memory.gearSwaps += result.swaps.length;
    },
  };
  const loop = createGameLoop(ctx, () => 0);
  const step = () => loop.step();
  const stepsPerSecond = Math.max(1, Math.round(1_000_000 / COMBAT_STEP_US()));
  const advanceSecond = () => {
    // `clockSec` opens on the first substep, so equality would stop after one 50 ms sample. Run the
    // authored number of combat steps, then evaluate the policy once at the world-second boundary.
    for (let index = 0; index < stepsPerSecond; index++) step();
    applyJourneyPolicy(state, memory);
  };
  return { state, memory, step, advanceSecond, refusals: memory.refusals };
}

function noteRefusal(memory: JourneyMemory, state: GameState, action: string, why: string): void {
  memory.refusals.push({ atSec: state.clockSec, action, why });
  if (memory.refusals.length > 20) memory.refusals.shift();
}

function zoneOrder(): number[] {
  return [...(E.mob.zones as any[])].map((zone) => Number(zone.id)).sort((a, b) => a - b);
}

function zoneMinLevel(zone: number): number {
  const row = (E.mob.zones as any[]).find((entry) => Number(entry.id) === zone);
  return Number(row?.levels?.[0]) || 1;
}

function finalZone(): number {
  return zoneOrder()[zoneOrder().length - 1];
}

export function chooseTaskChoice(state: GameState, index: number): string | undefined {
  const task = state.town.tasks[index];
  if (!task || task.progress < task.n || task.claimed) return undefined;
  const options = [task.stone, task.alt?.stone]
    .flatMap((value) => value ? [String(value)] : []);
  return [...new Set(options)].sort()[0];
}

function claimReadyTasks(state: GameState, memory: JourneyMemory): number {
  if (!atSettlement(state)) return 0;
  let claimed = 0;
  for (let index = 0; index < state.town.tasks.length; index++) {
    const choice = chooseTaskChoice(state, index);
    if (choice && claimTask(state, index, choice)) claimed++;
  }
  return claimed;
}

function spendTree(state: GameState, memory: JourneyMemory): number {
  let spent = 0;
  const order: TreeGoalId[] = ['survival', 'mana', 'weapon', 'skills'];
  for (let guard = 0; guard < 2000; guard++) {
    let bought = false;
    for (const goal of order) {
      const pick = recommendTreeNodes(state, goal).find((row) => row.affordable);
      if (!pick) continue;
      const verdict = allocateTreePath(state, pick.node.id);
      if (verdict.ok) {
        spent++;
        bought = true;
        break;
      }
    }
    if (!bought) break;
  }
  memory.treeSpent += spent;
  return spent;
}

function fillQuickbar(state: GameState, memory: JourneyMemory): number {
  const carried = ownedPotions(state);
  const onBar = new Set(state.quickbar.filter((name): name is string => !!name));
  const want = carried.filter((name) => !onBar.has(name));
  if (!want.length) return 0;
  let filled = 0;
  for (let slot = 0; slot < Math.min(QUICKBAR_SLOTS, state.quickbar.length) && want.length; slot++) {
    if (state.quickbar[slot]) continue;
    const target = want[0];
    for (let guard = 0; guard < carried.length + 2; guard++) {
      if (state.quickbar[slot] === target) break;
      cycleQuickbar(state, slot);
    }
    if (state.quickbar[slot] === target) {
      want.shift();
      filled++;
    }
  }
  memory.quickbarFilled += filled;
  return filled;
}

function organizeAtSettlement(state: GameState, memory: JourneyMemory): boolean {
  const equip = autoEquip(state, 0);
  memory.gearSwaps += equip.swaps.length;
  claimReadyTasks(state, memory);
  sellJunk(state);
  if (slotsFree(state) > 0) {
    runFilterNow(state);
    return true;
  }
  const movable = state.bag
    .map((item, index) => ({ item, index }))
    .filter((row): row is { item: Item; index: number } => !!row.item && !row.item.locked && !row.item.heldFor)
    .map((row) => row.index);
  if (movable.length && stashTabCount(state) > 0) depositMany(state, movable, 0);
  runFilterNow(state);
  return slotsFree(state) > 0;
}

function walkToCell(state: GameState, dest: { q: number; r: number }, memory: JourneyMemory): boolean {
  if (state.walk) return true;
  const result = startWalk(state, { q: dest.q, r: dest.r, sub: null, site: null } as never);
  if (!result.ok) {
    noteRefusal(memory, state, 'walk', result.why || 'walk refused');
    return false;
  }
  return true;
}

/** The authored hunt cell: walkable, rank > 0, no gathering location, then route/q/r. */
export function chooseHuntCell(state: GameState, zone: number): { q: number; r: number } | null {
  const from = currentCell(state);
  const cells = ((road as any).land as { q: number; r: number }[])
    .filter((cell) => zoneOf(cell) === zone && rankOf(cell) > 0 && !(road as any).locationAt(cell))
    .map((cell) => ({ ...cell, blocks: (road as any).blocksBetweenHex(from, cell) }))
    .sort((a, b) => a.blocks - b.blocks || a.q - b.q || a.r - b.r);
  return cells[0] ? { q: cells[0].q, r: cells[0].r } : null;
}

function walkToZone(state: GameState, zone: number, memory: JourneyMemory): boolean {
  if (state.walk) return true;
  const hunt = chooseHuntCell(state, zone);
  if (!hunt) {
    noteRefusal(memory, state, 'zone', `no hunt cell in zone ${zone}`);
    return false;
  }
  return walkToCell(state, hunt, memory);
}

function walkToSettlement(state: GameState, memory: JourneyMemory): boolean {
  if (state.walk) return true;
  const owner = ownerOf(currentCell(state));
  const cell = settlementCell(owner.id);
  if (!cell) {
    noteRefusal(memory, state, 'settlement', `no settlement cell for ${owner.id}`);
    return false;
  }
  return walkToCell(state, cell, memory);
}

/** One policy evaluation at a world-second boundary. Public actions only; no forced rewards. */
export function applyJourneyPolicy(state: GameState, memory: JourneyMemory): void {
  try {
    applyJourneyPolicyInner(state, memory);
  } finally {
    const gold = state.counters.gold;
    if (gold > memory.lastGold) memory.goldEarned += gold - memory.lastGold;
    else if (gold < memory.lastGold) memory.goldSpent += memory.lastGold - gold;
    memory.lastGold = gold;
  }
}

function applyJourneyPolicyInner(state: GameState, memory: JourneyMemory): void {
  if (state.goal.done) return;
  claimReadyTasks(state, memory);
  if ((state.player.treePoints || 0) > 0 || (state.player.attainmentPoints || 0) > 0) spendTree(state, memory);
  if (state.quickbar.some((slot) => !slot)) fillQuickbar(state, memory);

  // A Push sends the reference player back to the prior zone until a level or a real gear swap.
  if (state.counters.pushes > memory.lastPush) {
    memory.lastPush = state.counters.pushes;
    if (memory.targetZone > 1) {
      memory.retryZone = memory.previousZone ?? memory.targetZone - 1;
      memory.retryLevel = state.player.level;
      memory.retrySwaps = memory.gearSwaps;
      memory.targetZone = memory.retryZone;
    }
  }

  if (slotsFree(state) <= 0) {
    if (!atSettlement(state)) {
      walkToSettlement(state, memory);
      return;
    }
    if (!organizeAtSettlement(state, memory)) {
      memory.inventoryBlocked = true;
      noteRefusal(memory, state, 'inventory', 'inventory-policy-blocked');
      return;
    }
    memory.inventoryBlocked = false;
  }

  const order = zoneOrder();
  const final = finalZone();
  const current = state.zone;
  const currentIndex = order.indexOf(current);

  if (memory.retryZone != null) {
    if (current === memory.retryZone) {
      if (state.player.level > memory.retryLevel || memory.gearSwaps > memory.retrySwaps) {
        memory.previousZone = memory.retryZone;
        memory.targetZone = Math.min(final, memory.retryZone + 1);
        memory.retryZone = null;
        memory.retryLevel = 0;
        memory.retrySwaps = 0;
      } else {
        if (!state.walk && !state.hunting) huntHere(state);
        return;
      }
    } else {
      walkToZone(state, memory.retryZone, memory);
      return;
    }
  }

  const next = order[Math.min(order.length - 1, Math.max(0, currentIndex) + 1)] ?? final;
  if (memory.targetZone < final && current >= memory.targetZone
    && state.player.level >= zoneMinLevel(next) && next > memory.targetZone) {
    memory.previousZone = memory.targetZone;
    memory.targetZone = next;
  }
  if (memory.targetZone < current) memory.targetZone = current;
  if (memory.targetZone === final && current === final) {
    if (!state.walk && !state.hunting) huntHere(state);
    return;
  }
  if (current !== memory.targetZone) {
    walkToZone(state, memory.targetZone, memory);
    return;
  }
  if (!state.walk && !state.hunting) {
    const atSettlementCell = atSettlement(state);
    if (atSettlementCell) walkToZone(state, memory.targetZone, memory);
    else huntHere(state);
  }
}

/** A full-state comparison used by zone checkpoints; `lastSavedAt` is wall-clock metadata. */
export function journeyStateKey(state: GameState): string {
  return exportJson({ ...state, lastSavedAt: 0 } as GameState);
}

export function checkpointMatches(before: GameState, after: GameState): boolean {
  return journeyStateKey(before) === journeyStateKey(after);
}

export interface JourneyCheckpoint {
  formatVersion: number;
  fingerprint: string;
  seed: number;
  save: unknown;
  cursor: JourneyMemory;
}

export function makeCheckpoint(fingerprint: string, state: GameState, memory: JourneyMemory): JourneyCheckpoint {
  return {
    formatVersion: JOURNEY_FORMAT_VERSION,
    fingerprint,
    seed: JOURNEY_SEED,
    save: JSON.parse(exportJson(state)),
    cursor: memory,
  };
}

export function restoreCheckpoint(checkpoint: JourneyCheckpoint): { state: GameState; memory: JourneyMemory } {
  if (checkpoint.formatVersion !== JOURNEY_FORMAT_VERSION) throw new Error('unsupported journey checkpoint format');
  if (checkpoint.seed !== JOURNEY_SEED) throw new Error('journey checkpoint seed mismatch');
  const state = importJson(JSON.stringify(checkpoint.save));
  return { state, memory: checkpoint.cursor };
}

export interface JourneyOutcome {
  status: JourneyStatus;
  reason: string;
  simulatedSec: number;
  wallMs: number;
}

export interface JourneyRun {
  outcome: JourneyOutcome;
  state: GameState;
  memory: JourneyMemory;
  firstWin: GameState['goal']['done'];
}

/** Run until win, an inventory block, or the wall guard; the caller owns checkpoint I/O. */
export function runJourney(
  runtime: JourneyRuntime,
  options: { maxWallMs?: number; now?: () => number; onSecond?: (state: GameState, memory: JourneyMemory) => void } = {},
): JourneyRun {
  const now = options.now ?? (() => performance.now());
  const maxWallMs = options.maxWallMs ?? JOURNEY_RESOURCE_MS;
  const startWall = now();
  const startClock = runtime.state.clockSec;
  let firstWin = runtime.state.goal.done;
  const stepSec = 0.05;
  while (true) {
    if (runtime.state.goal.done) {
      if (!firstWin) firstWin = runtime.state.goal.done;
      // The run must still tick after the win record; one world second proves the loop remains live.
      let guard = 0;
      while (runtime.state.clockSec - runtime.state.goal.done!.clockSec < 1 && guard++ < 200) runtime.step();
      return {
        outcome: { status: 'PASS', reason: 'goal.done reached and post-win second advanced',
          simulatedSec: runtime.state.clockSec - startClock, wallMs: now() - startWall },
        state: runtime.state, memory: runtime.memory, firstWin,
      };
    }
    if (now() - startWall >= maxWallMs) {
      return {
        outcome: { status: 'INCOMPLETE', reason: 'resource guard reached; checkpoint is resumable',
          simulatedSec: runtime.state.clockSec - startClock, wallMs: now() - startWall },
        state: runtime.state, memory: runtime.memory, firstWin,
      };
    }
    if (runtime.memory.inventoryBlocked) {
      return {
        outcome: { status: 'INCOMPLETE', reason: 'inventory-policy-blocked',
          simulatedSec: runtime.state.clockSec - startClock, wallMs: now() - startWall },
        state: runtime.state, memory: runtime.memory, firstWin,
      };
    }
    const before = runtime.state.clockSec;
    runtime.advanceSecond();
    if (runtime.state.clockSec <= before) {
      // A refused hunt or an empty field must not spin without a trace.
      runtime.step();
    }
    options.onSecond?.(runtime.state, runtime.memory);
  }
}

export function journeyTableRow(label: string, state: GameState, wallMs: number): Record<string, unknown> {
  return {
    milestone: label,
    onlineSec: state.counters.playSec,
    awaySec: 0,
    wallMs: Math.round(wallMs),
    level: state.player.level,
    zone: state.zone,
    kills: state.counters.kills,
    pushes: state.counters.pushes,
    drops: state.counters.drops,
    goldEarned: state.counters.gold,
    goldSpent: 0,
    bag: `${slotsUsed(state)}/${slotsAvailable(state)}`,
    stash: state.stash.reduce((sum, tab) => sum + tab.length, 0),
    gearSwaps: 0,
    treePoints: state.player.treePoints,
    skills: Object.keys(state.skills.owned).sort(),
    refusals: 0,
    firstWin: state.goal.done,
  };
}
