import { fieldwork } from '../engine/client';
import { cooldownLeft } from '../sim/dungeon';
import { fieldActionProblem } from '../sim/fieldwork';
import type { GameState } from '../sim/types';

export interface MapDestination {
  key: string;
  kind: 'town' | 'sub' | 'wild' | 'bare';
  label: string;
  node: string | null;
  sub: number | null;
  wild: number | null;
  self: boolean;
  walking: boolean;
  here: boolean;
  blocks: number;
  sec: number;
}

export interface DestinationAction {
  kind: 'walk' | 'town' | 'hunt' | 'dungeon' | 'retreat' | 'mine' | 'grove' | 'stop-gather';
  label: string;
  disabled: boolean;
  reason: string;
}

export const destinationSite = (dest: MapDestination) => dest.kind === 'wild'
  ? fieldwork.siteAt(dest.wild) : dest.kind === 'town' ? null : 'hunt';

/** The visible primary button and map Enter always use this same action. Warp stays explicit. */
export function destinationPrimary(state: GameState, dest: MapDestination, writable = true): DestinationAction {
  const action = (kind: DestinationAction['kind'], label: string, reason = ''): DestinationAction => {
    const unavailable = reason || (!writable && kind !== 'town' ? 'Read-only: another tab controls progress.' : '');
    return { kind, label, disabled: !!unavailable, reason: unavailable };
  };
  if (!dest.self) return action('walk', dest.walking ? 'Walking…' : 'Walk here',
    state.walk ? 'Finish the current walk first.' : state.phase === 'camp' ? 'Recover at Camp before traveling.' : '');
  if (dest.kind === 'town') return action('town', 'Open town');
  const site = destinationSite(dest);
  if (site === 'dungeon') {
    if (state.dungeon) return action('retreat', 'Retreat');
    const cooldown = Math.ceil(cooldownLeft(state));
    return action('dungeon', 'Enter dungeon', cooldown > 0 ? `Cooldown · ${cooldown}s remaining.`
      : state.phase === 'camp' ? 'Recover at Camp first.' : state.group.length ? 'Finish the fight first.' : '');
  }
  if (site === 'mine' || site === 'grove') {
    if (state.fieldwork.action?.kind === site) return action('stop-gather', 'Stop gathering');
    return action(site, site === 'mine' ? 'Start mining' : 'Start woodcutting', fieldActionProblem(state, site) || '');
  }
  return action('hunt', state.hunting ? 'Hunting…' : 'Hunt here',
    state.phase === 'camp' ? 'Recover at Camp first.' : state.hunting ? 'Already hunting this area.' : '');
}
