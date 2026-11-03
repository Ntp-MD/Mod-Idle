/** The authored Mod windows checked by MP1, shared with its regression tests. */
export function modRangeProblems(data: {
  mods: { id: string; min: number; max: number; bands: number[][][] }[];
}): string[] {
  const problems: string[] = [];
  for (const m of data.mods) {
    const flat = m.bands.flat();
    if (!flat.length) { problems.push(`${m.id} has no slices`); continue; }
    if (flat[0][0] !== m.min) problems.push(`${m.id} starts at ${flat[0][0]}, Total says ${m.min}`);
    if (flat[flat.length - 1][1] !== m.max) problems.push(`${m.id} ends at ${flat[flat.length - 1][1]}, Total says ${m.max}`);
    const tierCounts = new Set(m.bands.map((band) => band.length));
    if (tierCounts.size !== 1) problems.push(`${m.id} has ${[...tierCounts].join('/')} Tiers across its quality bands`);

    for (let q = 0; q < m.bands.length; q++) {
      const band = m.bands[q];
      if (!band.length) { problems.push(`${m.id} band ${q} has no slices`); continue; }
      for (let i = 0; i < band.length; i++) {
        const [a, z] = band[i];
        if (a < m.min || a > m.max || z < m.min || z > m.max) {
          problems.push(`${m.id} slice ${a}-${z} is outside declared ${m.min}-${m.max}`);
        }
        if (a > z) problems.push(`${m.id} slice ${a}-${z} is inverted`);
        if (i === 0) continue;
        const previousEnd = band[i - 1][1];
        if (a <= previousEnd) problems.push(`${m.id} band ${q} slice ${i} (${a}) overlaps slice ${i - 1} (ends ${previousEnd})`);
        else if (a !== previousEnd + 1) problems.push(`${m.id} band ${q} slice ${i} starts ${a}, a gap after ${previousEnd}`);
      }

      const previous = m.bands[q - 1];
      if (!previous?.length) continue;
      const lo = band[0][0];
      const hi = band[band.length - 1][1];
      const previousLo = previous[0][0];
      const previousHi = previous[previous.length - 1][1];
      if (lo < previousLo) problems.push(`${m.id} band ${q} floor ${lo} decreases from ${previousLo}`);
      // Ordinary seams overlap strictly. A singleton previous band may share its sole value,
      // while the next band's effective T1 floor must still rise above the previous ceiling.
      const overlap = previousHi - lo;
      if (overlap < 1 && !(overlap === 0 && previousLo === previousHi)) {
        problems.push(`${m.id} seam ${q} has no god-roll overlap`);
      }
      const size = Math.ceil((hi - lo + 1) / 3);
      if (hi - size + 1 <= previousHi) problems.push(`${m.id} seam ${q} T1 no longer wins outright`);
    }
  }
  return problems;
}
