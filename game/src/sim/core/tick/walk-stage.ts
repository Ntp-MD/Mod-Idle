import type { GameState } from '../types';
import { road } from '../../../engine/client';
import { abandonRun } from '../../world/dungeon';
import { autoSelect } from '../presets';
import { arrive, currentCell as currentCellForJournal } from '../../world/road';
import { commitStep } from '../../world/travel';
import { recordMapDiscovery } from '../../world/map-exploration';
import { resolveTravelEvent } from '../../world/fieldwork';
import { push } from '../log';
import { fx, hitColour } from '../feedback';

/**
 * The walk step: one block per `block_sec`, online only. No ambient zone group appears while walking —
 * a walk is its own activity, and it is offline-exempt so an away period never crosses a block and
 * never opens a Waypoint it did not earn online.
 *
 * Each crossed block commits its cell first: discovery and the road event resolve against the
 * entered cell (never the origin), once per leg via the journey receipt. Passing a town opens
 * nothing and fields nothing; only the final stop unlocks and arrives.
 *
 * Leaving the run's zone ends the run: a dungeon is entered ground, not a destination.
 */
export function advanceWalkStage(s: GameState, online: boolean, rng: () => number): void {
  if (online && s.walk) {
    const walk = s.walk;
    walk.secLeft--;
    if (walk.secLeft <= 0 && !s.group.length) {
      const step = commitStep(s);
      // The block is crossed — but only a fresh commit discovers and rolls an event, so a
      // replayed receipt never rewards twice.
      if (!step.duplicate && step.entered && !step.stopped) {
        // `lastEventStep` is the receipt: this leg processes discovery/event once.
        if (walk.lastEventStep < walk.stepIndex) {
          recordMapDiscovery(s);
          let roadReceipt: { resourceDeltas: { bucket: 'food' | 'material'; id: string; count: number }[]; hungerDelta: number } | undefined;
          const trailEvent = resolveTravelEvent(s, rng, (entry) => { roadReceipt = entry; });
          walk.lastEventStep = walk.stepIndex;
          if (trailEvent) {
            const feet = currentCellForJournal(s);
            s.mapJournal!.lastEvent = { ...feet, text: trailEvent, atSec: s.clockSec, source: 'road', ...roadReceipt };
            push(s, `Trail event · ${trailEvent}`);
          }
        }
      }
      const live = s.walk;
      if (live && live.stepIndex >= live.legs.length) {
        const arrived = arrive(s, live);
        if (arrived) {
          if (s.lastAutoZone !== s.zone) {
            s.lastAutoZone = s.zone;
            autoSelect(s, s.zone);
          }
          push(s, arrived.first
            ? `Arrived on foot at ${arrived.name} — its Waypoint is open`
            : `Arrived at ${arrived.name}`);
          fx(s, { kind: 'travel', side: 'self', text: `arrived · ${arrived.name}`, colour: hitColour(null) });
        }
      }
    }
  }

  // leaving the run's zone ends the run: a dungeon is entered ground, not a destination
  if (s.dungeon && s.dungeon.zone !== s.zone) push(s, abandonRun(s, 'Pulled out'));
}
