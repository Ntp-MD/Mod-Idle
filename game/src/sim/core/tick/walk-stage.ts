import type { GameState } from '../types';
import { road } from '../../../engine/client';
import { abandonRun } from '../../world/dungeon';
import { autoSelect } from '../presets';
import { arrive, currentCell as currentCellForJournal } from '../../world/road';
import { recordMapDiscovery } from '../../world/map-exploration';
import { resolveTravelEvent } from '../../world/fieldwork';
import { runExplorationAutomation } from './automation';
import { push } from '../log';
import { fx, hitColour } from '../feedback';

/**
 * The walk step: one block per `block_sec`, online only. No ambient zone group appears while walking —
 * a walk is its own activity, and it is offline-exempt so an away period never crosses a block and
 * never opens a Waypoint it did not earn online.
 *
 * Leaving the run's zone ends the run: a dungeon is entered ground, not a destination.
 */
export function advanceWalkStage(s: GameState, online: boolean, rng: () => number): void {
  if (online && s.walk) {
    const walk = s.walk;
    walk.secLeft--;
    if (walk.secLeft <= 0 && !s.group.length) {
      // the block is crossed: one encounter chance, then the next block starts
      walk.blocksLeft--;
      walk.blocksWalked++;
      walk.secLeft = road.blockSec;
      recordMapDiscovery(s);
      // A crossed block says nothing: no number floats off the character and no line is logged for it —
      // the walk reads as the one word on the field plus the route lighting itself off `blocksWalked`,
      // one cell per block (`walkedCells`). Only arriving and a trail event are walk events.
      const trailEvent = resolveTravelEvent(s, rng);
      if (trailEvent) {
        const feet = currentCellForJournal(s);
        s.mapJournal!.lastEvent = { ...feet, text: trailEvent, atSec: s.clockSec };
        push(s, `Trail event · ${trailEvent}`);
      }
      if (walk.blocksLeft <= 0) {
        const arrived = arrive(s, walk);
        if (arrived) {
          if (s.lastAutoZone !== s.zone) {
            s.lastAutoZone = s.zone;
            autoSelect(s, s.zone);
          }
          push(s, arrived.first
            ? `Arrived on foot at ${arrived.name} — its Waypoint is open`
            : `Arrived at ${arrived.name}`);
          fx(s, { kind: 'travel', side: 'self', text: `arrived · ${arrived.name}`, colour: hitColour(null) });
          runExplorationAutomation(s, online);
        }
      }
    }
  }

  // leaving the run's zone ends the run: a dungeon is entered ground, not a destination
  if (s.dungeon && s.dungeon.zone !== s.zone) push(s, abandonRun(s, 'Pulled out'));
}
