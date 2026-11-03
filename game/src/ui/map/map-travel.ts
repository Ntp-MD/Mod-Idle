/** Presentation only: the road simulator still owns travel time and encounters. */
export function mapTravelPhase(active: boolean, walking: boolean, fighting: boolean) {
  return !active ? 'idle' : fighting ? 'combat' : walking ? 'travel' : 'arrived';
}
