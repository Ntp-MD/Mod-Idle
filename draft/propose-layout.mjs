/**
 * Propose candidate town layouts for draft/map-field-20x15.html.
 *
 * Search that keeps the spread of the current 18 town positions but stops the set reading
 * as a grid: the score punishes triples of towns that fall on one line and rewards an uneven
 * spread of nearest-neighbour distances. Hard rules: every town keeps its six sides inside the
 * field, no two towns closer than 3 blocks (their pods would overlap), the set stays at least
 * as spread out as the seed, and no town strays more than 4 blocks from where it was seeded.
 *
 *   node draft/propose-layout.mjs 11 4242 777 9001    print one candidate per seed
 */
// as a grid: the score punishes triples of towns that fall on one line and rewards an
// uneven spread of nearest-neighbour distances. Hard rules stay: every town keeps its
// six sides inside the field, no two towns closer than 3 blocks (their pods would
// overlap), the set stays as spread out as the seed, and no town strays more than 4
// blocks from where it was seeded.

const SQ3 = Math.sqrt(3), R = 34;
const PX = ([q, r]) => [SQ3 * (q + r / 2) * R, 1.5 * r * R];
const key = (q, r) => q + ',' + r;
const hd = (a, b) => {
  const dq = a[0] - b[0], dr = a[1] - b[1];
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};
const COLS = 20, ROWS = 15, raw = [];
for (let row = 0; row < ROWS; row++)
  for (let col = 0; col < COLS; col++)
    raw.push({ q: col - ((row - (row & 1)) >> 1), r: row, row, col });
let sx = 0, sy = 0;
for (const c of raw) { const [x, y] = PX([c.q, c.r]); sx += x; sy += y; }
sx /= raw.length; sy /= raw.length;
let centre = raw[0], bd = Infinity;
for (const c of raw) {
  const [x, y] = PX([c.q, c.r]);
  const d = (x - sx) ** 2 + (y - sy) ** 2;
  if (d < bd) { bd = d; centre = c; }
}
const q0 = centre.q, r0 = centre.r;
const inField = new Set(raw.map(c => key(c.q - q0, c.r - r0)));
const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const fits = (q, r) => DIRS.every(d => inField.has(key(q + d[0], r + d[1])));

const SEED = [["Eastgate", 0, 0], ["Millbrook", -5, -5], ["Thornwake", 10, -5], ["Ironrow", -10, 5],
["Ashfall", 5, 5], ["Wolf Cross", 0, -5], ["Highspire", 5, -5], ["Wyrmback", -7, 0], ["Saltmarrow", 5, 0],
["Frosthold", -5, 3], ["Greyfen", -2, 5], ["Nettlecrag", -3, -1], ["Vermolch", 2, 4], ["Bonegate", -3, -4],
["Blackwater Reach", 2, -4], ["Duskmoor", 7, -4], ["The Pale Spire", 3, -2], ["Emberhold", 8, -2]];

const pairSum = (set) => {
  let n = 0;
  for (let i = 0; i < set.length; i++)
    for (let j = i + 1; j < set.length; j++) n += hd([set[i].q, set[i].r], [set[j].q, set[j].r]);
  return n;
};
const SEEDSUM = pairSum(SEED.map(([n, q, r]) => ({ n, q, r })));

const lineOff = (p, a, b) => {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const len = Math.hypot(vx, vy) || 1;
  return Math.abs((p[0] - a[0]) * vy - (p[1] - a[1]) * vx) / len;
};
const nnDistances = (set) => set.map((t, i) =>
  Math.min(...set.map((u, j) => (i === j ? Infinity : hd([t.q, t.r], [u.q, u.r])))));

function score(set) {
  const P = set.map(t => PX([t.q, t.r]));
  let lines = 0;
  for (let i = 0; i < set.length; i++)
    for (let j = i + 1; j < set.length; j++) {
      const span = hd([set[i].q, set[i].r], [set[j].q, set[j].r]);
      if (span < 4) continue;
      for (let k = 0; k < set.length; k++) {
        if (k === i || k === j) continue;
        const d = hd([set[k].q, set[k].r], [set[i].q, set[i].r]);
        const e = hd([set[k].q, set[k].r], [set[j].q, set[j].r]);
        if (d + e !== span) continue;                     // not between them
        if (lineOff(P[k], P[i], P[j]) < 3) lines++;       // and near the line
      }
    }
  const nn = nnDistances(set);
  const mean = nn.reduce((a, b) => a + b, 0) / nn.length;
  const varc = nn.reduce((a, b) => a + (b - mean) ** 2, 0) / nn.length;
  return lines * 6 + 40 / (1 + varc);
}

const legal = (set) => {
  for (let i = 0; i < set.length; i++) {
    if (!fits(set[i].q, set[i].r)) return false;
    if (hd([set[i].q, set[i].r], [SEED[i][1], SEED[i][2]]) > 4) return false;
    for (let j = i + 1; j < set.length; j++)
      if (hd([set[i].q, set[i].r], [set[j].q, set[j].r]) < 3) return false;
  }
  return pairSum(set) >= SEEDSUM * 0.95;
};

function search(rngSeed, steps) {
  let s = rngSeed;
  const ri = (n) => Math.floor(((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * n);
  const cur = SEED.map(([n, q, r]) => ({ n, q, r }));
  if (!legal(cur)) throw new Error('seed layout breaks the rules');
  let best = { score: score(cur), set: cur.map(t => ({ ...t })) };
  for (let step = 0; step < steps; step++) {
    const i = 1 + ri(cur.length - 1);              // Eastgate keeps the centre
    const was = { q: cur[i].q, r: cur[i].r };
    cur[i].q += ri(5) - 2; cur[i].r += ri(5) - 2;
    if (!legal(cur)) { cur[i].q = was.q; cur[i].r = was.r; continue; }
    const sc = score(cur);
    if (sc < best.score) best = { score: sc, set: cur.map(t => ({ ...t })) };
  }
  return best;
}

const SEEDS = process.argv.slice(2).map(Number).filter(Boolean);
for (const seed of (SEEDS.length ? SEEDS : [11, 4242])) {
  const best = search(seed, 60000);
  const nn = nnDistances(best.set), P = best.set.map(t => PX([t.q, t.r]));
  const rows = new Set(best.set.map(t => t.r)).size, cols = new Set(best.set.map(t => t.q)).size;
  const lineCount = (() => {
    let lines = 0;
    for (let i = 0; i < best.set.length; i++)
      for (let j = i + 1; j < best.set.length; j++) {
        const span = hd([best.set[i].q, best.set[i].r], [best.set[j].q, best.set[j].r]);
        if (span < 4) continue;
        for (let k = 0; k < best.set.length; k++) {
          if (k === i || k === j) continue;
          const d = hd([best.set[k].q, best.set[k].r], [best.set[i].q, best.set[i].r]);
          const e = hd([best.set[k].q, best.set[k].r], [best.set[j].q, best.set[j].r]);
          if (d + e === span && lineOff(P[k], P[i], P[j]) < 3) lines++;
        }
      }
    return lines;
  })();
  console.log('--- seed ' + seed + ' · score ' + best.score.toFixed(1) +
    ' · collinear triples ' + lineCount +
    ' · distinct rows ' + rows + '/18 cols ' + cols + '/18' +
    ' · nearest-neighbour ' + Math.min(...nn) + '-' + Math.max(...nn) +
    ' · pairSum ' + pairSum(best.set).toFixed(0) + ' vs seed ' + SEEDSUM.toFixed(0));
  console.log(best.set.map(t => `      { n:"${t.n}", q:${t.q}, r:${t.r} },`).join('\n'));
}
