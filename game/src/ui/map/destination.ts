import { fieldActionProblem } from '@sim/world/fieldwork';
import type { FieldSite, GameState } from '@sim/core/types';
import { currentCell } from '@sim/world/road';
import { trailSiteAt } from '@sim/world/map-exploration';
import { cooldownLeft } from '@sim/world/dungeon';

export interface MapDestination {
  key: string;
  kind: 'town' | 'sub' | 'bare';
  label: string;
  node: string | null;
  sub: number | null;
  site: FieldSite | null;
  self: boolean;
  walking: boolean;
  here: boolean;
  blocks: number;
  sec: number;
}

export interface DestinationAction {
  kind: 'walk' | 'town' | 'hunt' | 'dungeon' | 'retreat' | 'mine' | 'grove' | 'fish' | 'stop-gather' | 'investigate';
  label: string;
  disabled: boolean;
  reason: string;
  /** What an enabled action will pause while it runs; the card states it before the press. */
  warn?: string;
}

export const destinationSite = (dest: MapDestination) => dest.site ?? (dest.kind === 'town' ? null : 'hunt');

/** The visible primary button and map Enter always use this same action. Warp stays explicit. */
export function destinationPrimary(state: GameState, dest: MapDestination, writable = true): DestinationAction {
  const action = (kind: DestinationAction['kind'], label: string, reason = ''): DestinationAction => {
    const unavailable = reason || (!writable && kind !== 'town' ? 'Read-only: another tab controls progress.' : '');
    return { kind, label, disabled: !!unavailable, reason: unavailable };
  };
  if (!dest.self) return action('walk', dest.walking ? 'Walking…' : 'Walk here',
    state.walk ? 'Finish the current walk first.' : state.phase === 'camp' ? 'Recover at Camp before traveling.' : '');
  if (dest.kind === 'town') return action('town', 'Open town');
  const trail = trailSiteAt(state, currentCell(state));
  if (trail && !state.mapJournal?.claimedSites.includes(trail.id)) {
    const paused = [state.hunting ? 'hunting' : '',
      state.fieldwork.action ? 'gathering' : ''].filter(Boolean);
    return {
      ...action('investigate', 'Investigate site',
        state.dungeon ? 'Leave the dungeon first.' : state.phase === 'camp' ? 'Recover at Camp first.'
          : state.group.length ? 'Finish the fight first.' : ''),
      warn: paused.length ? `Claiming this site pauses ${paused.join(' and ')}.` : '',
    };
  }
  const site = destinationSite(dest);
  if (site === 'dungeon') {
    if (state.dungeon) return action('retreat', 'Retreat');
    const cooldown = Math.ceil(cooldownLeft(state));
    return action('dungeon', 'Enter dungeon', cooldown > 0 ? `Cooldown · ${cooldown}s remaining.`
      : state.phase === 'camp' ? 'Recover at Camp first.' : state.group.length ? 'Finish the fight first.' : '');
  }
  if (site === 'mine' || site === 'grove' || site === 'fishing') {
    const kind = site === 'fishing' ? 'fish' : site;
    if (state.fieldwork.action?.kind === kind) return action('stop-gather', 'Stop gathering');
    return action(kind, site === 'mine' ? 'Start mining' : site === 'grove' ? 'Start woodcutting' : 'Start fishing',
      fieldActionProblem(state, kind) || '');
  }
  return action('hunt', state.hunting ? 'Hunting…' : 'Hunt here',
    state.phase === 'camp' ? 'Recover at Camp first.' : state.hunting ? 'Already hunting this area.' : '');
}
