export type MapEncounterSite = { key: string; q: number; r: number; species: string };

/** Visual presence follows the player's hex, independently of the map selection. */
export function nearbyMapEncounters(sites: MapEncounterSite[], feet: { q: number; r: number }, activeSpecies = '') {
  return sites.filter(site => {
    const dq = site.q - feet.q, dr = site.r - feet.r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 <= 1;
  }).map(site => ({ ...site,
    species: activeSpecies && site.q === feet.q && site.r === feet.r ? activeSpecies : site.species,
  }));
}
