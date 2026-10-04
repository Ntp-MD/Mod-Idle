/**
 * The Collector and the pedlar — the two sinks that pay in items, never gold.
 *
 * A set names three pieces by Base, school and sometimes quality. The sink runs *before* the bag
 * filter dissolves a rejected drop (`town.json` collector_sets.rule), so a drop that matches a set
 * the player has not finished is held rather than dissolved. Turn-in consumes the pieces, pays the
 * item itself, and happens once per character.
 */

export function createCollector(TOWN, BASES) {
  const SETS = TOWN.collector_sets;
  const HINT_PRICE_M = (TOWN.repeatable.find((r) => r.id === 'collector_hint') || { m: 15 }).m;
  const PEDLAR = TOWN.repeatable.find((r) => r.id === 'pedlar_rotation');

  /** "coif (helmet)" → { name, slot }. */
  function parsePiece(text) {
    const m = String(text).match(/^(.*)\((.*)\)$/);
    if (!m) return { name: String(text).trim(), slot: null };
    return { name: m[1].trim(), slot: m[2].trim() };
  }

  const sets = SETS.map((s) => ({
    ...s,
    parsed: s.pieces.map(parsePiece),
    schools: s.pieces.map((p) => {
      const frame = BASES.bases.find((b) => b.name === parsePiece(p).name);
      return frame ? frame.school : null;
    }),
  }));

  const setAt = (settlementId) => sets.find((s) => s.settlement === settlementId) || null;

  /** Does this drop belong to that set? Base, slot and the quality requirement all have to agree. */
  function matches(set, item) {
    if (!set || !item) return false;
    const wanted = set.parsed.find((p) => p.name === item.base);
    if (!wanted) return false;
    if (wanted.slot && item.slot !== wanted.slot) return false;
    if (set.quality !== 'any' && item.quality !== set.quality) return false;
    return true;
  }

  /** The first unfinished set that wants this drop. */
  function wanter(item, doneSets) {
    return sets.find((s) => !doneSets[s.id] && matches(s, item)) || null;
  }

  /** Turn-in: consume one held piece per line, and pay the set's item once. */
  function turnIn(set, held) {
    const need = set.parsed.map((p) => p.name);
    const used = [];
    const left = [...held];
    for (const name of need) {
      const i = left.findIndex((it) => it.base === name);
      if (i < 0) return { ok: false, why: `missing ${name}` };
      used.push(left.splice(i, 1)[0]);
    }
    return { ok: true, consumed: used, left, reward: set.reward, paysGold: set.pays_gold };
  }

  /** The pedlar restocks three slots a real day, priced inside its published minutes band. */
  function pedlarPrice(rngValue) {
    const span = PEDLAR.m_max - PEDLAR.m_min;
    return Math.round(PEDLAR.m_min + span * (rngValue == null ? 0.5 : rngValue));
  }

  return { sets, setAt, matches, wanter, turnIn, pedlarPrice, PEDLAR, HINT_PRICE_M };
}
