import type { GameState } from '../types';
import { eng, road } from '../../../engine/client';
import { settlementOfZone } from '../../town/pricing';
import { startWalk } from '../../world/road';
import { autoSelect } from '../presets';
import { push } from '../log';

/**
 * Forward Mode: follow the opened chapter ladder on foot. A newly discovered settlement still needs
 * the player's first walk; known chapters become an online walk when the current band is behind.
 * A Push returns to the last zone held and blocks re-entry until a level is gained against it.
 */
export function advanceForward(s: GameState, online: boolean): void {
  if (online && s.travel === 'forward' && !s.dungeon && !s.walk && !s.patrol.active && s.autoReturn.phase === 'idle') {
    const here = eng.zoneById(s.zone);
    if (s.player.level > here.levels[1]) {
      const next = eng.ZONES.find((z: any) => z.id > here.id
        && s.town.visited.includes(settlementOfZone(z.id)?.id || ''));
      const blocked = next && next.id === s.forwardBlockedZone
        && s.player.level <= (s.forwardBlockedLevel ?? 0);
      if (next && !blocked) {
        const there = road.nodeById(settlementOfZone(next.id)?.id || '');
        if (there) {
          const walk = startWalk(s, { q: there.q, r: there.r, sub: null, wild: null });
          if (walk.ok) {
            s.forwardSafe = here.id; // the zone just left is the floor a Push falls back to
            push(s, `Walking to ${next.name} (levels ${next.levels.join('-')})`);
          }
        }
      }
    }
  }
  if (s.lastAutoZone !== s.zone) {
    // the game picks the set bound to the zone on its own (`skill-pool.md` Preset)
    s.lastAutoZone = s.zone;
    autoSelect(s, s.zone);
  }
}
