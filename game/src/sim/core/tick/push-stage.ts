import type { GameState } from '../types';
import type { Character } from '../player';
import type { Statuses } from '../../combat/combat';
import { eng, sm } from '../../../engine/client';
import { abandonRun } from '../../world/dungeon';
import { pushToFieldCamp } from '../../world/fieldwork';
import { switchPreset } from '../presets';
import { recordCombatPush } from '../../combat/combat-history';
import { buildPushReport, pushReportLines } from '../push-report';
import { push } from '../log';

/**
 * HP reaches 0 → Push, never death (combat.md §4). The stage ends the fight's Keystone state,
 * ends a dungeon run, returns the character to camp and records the push report.
 */
export function applyPush(opts: {
  s: GameState;
  c: Character;
  statuses: Statuses;
  cancelArenaWork: (reason: string) => void;
}): void {
  const { s, c, statuses, cancelArenaWork } = opts;
  // HP reaches 0 → Push, never death (combat.md §4)
  const pushedZone = s.group[0]?.zone ?? s.zone;
  const pushReport = buildPushReport(s, c, s.group);
  s.player.hp = 0;
  cancelArenaWork('push');
  s.phase = 'camp';
  s.campSec = Math.max(1, Math.ceil(c.maxHp / (c.hpRegen * 8)));
  recordCombatPush(s, s.campSec);
  s.counters.pushes++;
  // the rest is a clean one: whatever the fight had on the character ends at the Push — the
  // statuses are the fight's, and the camp neither ticks nor banks them
  for (const key of Object.keys(statuses) as (keyof Statuses)[]) delete statuses[key];
  // The fight's own Keystone state ends with the fight: committed debt, deferred damage, a potion
  // stream, the leech bank and every per-target counter never follow the character back to camp
  // (§7.2's Death/Push cleanup, §7.3.10's "stops at a Push").
  s.keystoneRuntime.queues = { deferred: [], dot: [], hpDebt: [], recoup: [], potion: [] };
  s.keystoneRuntime.bank = [];
  s.keystoneRuntime.stacks = {};
  s.keystoneRuntime.counters = {};
  s.keystoneRuntime.targetCounters = {};
  s.keystoneRuntime.dotInstances = [];
  s.keystoneRuntime.targetRefs = {};
  // a Push in a dungeon ends the run at once and the escrow is forfeited, never paid
  if (s.dungeon) push(s, abandonRun(s, 'Pushed'));
  s.group = [];
  // A same-zone Field Camp ends an interrupted walk after preserving its block count; without one,
  // the ordinary walk resumes at the interrupted block. Forward Mode stands down during either Push.
  const walking = !!s.walk;
  // a Push returns the main preset, but cooldowns already counting keep counting (§rule 12)
  if (switchPreset(s, sm.mainPreset)) push(s, `Back on the ${s.presets[sm.mainPreset].name} preset · running cooldowns kept`);
  const returnedToFieldCamp = pushToFieldCamp(s, pushedZone);
  if (walking && returnedToFieldCamp) {
    push(s, 'The interrupted walk ends at your field Camp');
  } else if (s.walk) {
    push(s, `Pushed on the walk · the walk keeps its ${s.walk.blocksLeft} block${s.walk.blocksLeft === 1 ? '' : 's'} and resumes from this one`);
  }
  push(s, `Pushed — ${s.campSec} sec at camp (${eng.fmt(c.maxHp)} HP ÷ ${eng.fmt(c.hpRegen * 8)}/sec)`);
  for (const line of pushReportLines(pushReport)) push(s, line);
}
