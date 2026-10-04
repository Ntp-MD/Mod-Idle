/**
 * The Road — the second gold mint and the only travel-time system (`engine.json` `road`).
 *
 * A trip is opt-in, online only, and costs real minutes: 5 minutes, 5 encounters. It pays a bounded
 * purse (once per link per day, so 8 links cap the mint at 24 gold a day) and Standing in
 * kill-equivalents far below the kills the trip itself forfeits. It never pays stones, and the
 * offline catch-up never runs it.
 */

export function createRoad(E) {
  const R = E.road;

  /** "Eastgate ↔ Millbrook" → { a, b, index }, ordered by the chain from Eastgate to Vermolch. */
  const links = R.links.map((text, i) => {
    const [a, b] = text.split('↔').map((s) => s.trim());
    return { index: i, text, a, b, lower: i, higher: i + 1 };
  });

  const linkByName = (settlementId) => links.filter((l) => l.a === settlementId || l.b === settlementId);
  const linkBetween = (a, b) => links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a)) || null;

  const tripSec = R.trip_min * 60;
  const encountersPerTrip = R.trip_min * R.encounters_per_min;
  const encounterGapSec = 60 / R.encounters_per_min;

  const KINDS = Object.entries(R.encounters).map(([id, e]) => ({
    id,
    weight: e.weight,
    mobs: e.mobs,
    resolve: e.resolve,
    win: e.win,
    loss: e.loss,
    hasMobs: e.mobs !== 'none',
  }));
  const totalWeight = KINDS.reduce((t, k) => t + k.weight, 0);

  function rollEncounter(rng) {
    let r = rng() * totalWeight;
    for (const k of KINDS) { r -= k.weight; if (r <= 0) return k; }
    return KINDS[KINDS.length - 1];
  }

  /** The purse is once per link per day, which is what bounds the mint. */
  const purseCapPerDay = links.length * R.purse_gold;

  return {
    R, links, linkByName, linkBetween, tripSec, encountersPerTrip, encounterGapSec,
    KINDS, totalWeight, rollEncounter, purseGold: R.purse_gold, purseCapPerDay,
    standingPerTripKills: R.standing_per_trip_kills, forfeitKills: R.forfeit_kills,
  };
}
