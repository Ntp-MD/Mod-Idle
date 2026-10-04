'use strict';

/**
 * Anchor cage — one home per published number.
 *
 *   node tools/anchors.js --checks    gate every derived anchor against the prose
 *   node tools/anchors.js --report    list where each anchor is still restated
 *
 * An anchor here is a number the engine derives (a stat ceiling, a timeline hour, a
 * band kill rate) but which many docs quote in prose. Those quotes are copies: they
 * cannot be wrong on their own, only stale. This cage reads the live value from the
 * engine and compares every hand-typed occurrence against it.
 *
 * A1  no doc prints a *stale* copy of a derived anchor outside a generated marker
 * A2  duplication only shrinks — per-anchor occurrence counts are capped at today's
 *     measured numbers, so a new copy is a FAIL and removing one is allowed
 * A3  the roster count is quoted from skills.json, never typed (this is the seam that
 *     let "roster of 43" survive next to 44 skills in the data)
 *
 * The caps in A2 are the point: without them a green run only proves the copies
 * agree today. With them, the ceiling is the previous session's count and the next
 * copy fails the cage. Lower a cap when you delete a quote.
 */

const fs = require('fs');
const path = require('path');
const eng = require('./lib/engine');
const G = require('./lib/generated');
const R = require('./lib/roster');

const ROOT = eng.ROOT;

// ---------------------------------------------------------------- the anchors

// max is the number of hand-typed occurrences allowed outside generated markers,
// measured 2026-10-04 (after the closed-text cleanup). Lower it as quotes are deleted.
const ANCHORS = [
  {
    id: 'A-ceiling', label: 'single-stat ceiling', value: () => eng.CEIL, max: 42,
    note: 'formula.md §1 derives it; every K value is set on this number (H5)',
  },
  {
    id: 'A-skill100', label: 'skill multiplier at level 100', value: () => eng.skillF(100), max: 7,
    note: 'the other half of mob_HP (checks.md D17)',
  },
  {
    id: 'A-hr100', label: 'timeline at level 100', value: () => eng.L.timeline_checkpoints_hr.level_100, max: 6,
    note: 'the whole design is paced against this hour (E5)',
  },
  {
    id: 'A-hr90', label: 'timeline at level 90', value: () => eng.L.timeline_checkpoints_hr.level_90, max: 3,
    note: 'zone 9 clear hour (E4)',
  },
  {
    id: 'A-killsHigh', label: 'kills/hr high band', value: () => eng.BAND.high.kills_per_hr, max: 7,
    note: 'F1 — every income and stone rate divides by it',
  },
  {
    id: 'A-killsMid', label: 'kills/hr mid band', value: () => eng.BAND.mid.kills_per_hr, max: 0,
    note: 'F1',
  },
  {
    id: 'A-killsLow', label: 'kills/hr low band', value: () => eng.BAND.low.kills_per_hr, max: 0,
    note: 'F1',
  },
  {
    id: 'A-refine', label: 'Refine full-set hours', value: () => eng.STONE.refine_hours_full_set, max: 4,
    note: 'Tier belongs to the piece, so a cast moves a whole item (D-033 · E6)',
  },
  {
    id: 'A-roster', label: 'skill roster size', value: () => R.total(), max: 1,
    // The roster count shares its token with three unrelated figures this repo prints: the zone-6
    // level range (`51-60`), an Energy Shield regen rate (`51/sec`) and a CDR item count (`51.8`).
    // Those are not copies of the roster, so this anchor reads only lines that also name skills —
    // which is exactly what the gate claims to guard, and what lets its cap sit at the one
    // historical quote that is legitimately about the roster.
    context: /\b(skills?|roster)\b/i,
    note: 'skills.json is the source (L5 guards the headings; this guards the prose)',
  },
];

// ---------------------------------------------------------------- doc scan

// every doc in the repo, not just the root — a copy of an anchor parked under `harness/`
// would otherwise slip past the count entirely. The decision log is excluded by suffix, not by
// path, so moving it inside `harness/` cannot quietly turn it back into counted prose.
const LOG_DOC = /(^|\/)decisions\.md$/;
// Owner-note docs are never system truth: the decision log records terms as
// they were at decision time, and the draft patch is note-only until the owner
// asks for the write (D-043).
const NOTE_DOC = /(^|\/)draft-patch\.md$/;
const DOCS = require('./lib/generated').listDocs().filter((f) => !LOG_DOC.test(f) && !NOTE_DOC.test(f));

// A number matches if the doc prints it as a standalone token, with or without
// thousands separators and trailing ".0".
function forms(v) {
  const out = new Set();
  const n = Number(v);
  if (!Number.isFinite(n)) return [];
  const r = Math.round(n * 100) / 100;
  const variants = Number.isInteger(r) ? [String(r)] : [String(r), r.toFixed(1), r.toFixed(2)];
  for (const s of new Set(variants)) {
    out.add(s);
    out.add(s.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  }
  return [...out].map((s) => new RegExp('(?<![\\d.,])' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\d])'));
}

// Which *other* values share a token with this anchor, so a stale copy can be told
// apart from a legitimate different number. e.g. 816 the ceiling vs 816 anywhere else.
function scan(re, context) {
  const hits = [];
  for (const file of DOCS) {
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);
    let inBlock = false;
    lines.forEach((line, i) => {
      if (/^\s*<!-- BEGIN GENERATED:/.test(line)) { inBlock = true; return; }
      if (/^\s*<!-- END GENERATED:/.test(line)) { inBlock = false; return; }
      if (inBlock) return;
      if (context && !context.test(line)) return;
      if (re.test(line)) hits.push({ file, line: i + 1, text: line.trim() });
    });
  }
  return hits;
}

// ---------------------------------------------------------------- gates

function runChecks() {
  const out = [];
  const add = (id, ok, detail) => out.push({ id, ok, detail });

  const staleHits = [];
  const over = [];
  const rows = [];

  for (const a of ANCHORS) {
    const v = a.value();
    const hits = scan(new RegExp(forms(v).map((r) => r.source).join('|')), a.context);
    rows.push({ a, v, hits });
    if (hits.length > a.max) over.push(`${a.id} ${a.label}: ${hits.length} copies > cap ${a.max}`);
  }

  // A1 — the known-stale phrasings, which is what drift actually looks like in this
  // repo: a figure typed by hand next to the data that supersedes it.
  const STALE_PROBES = [
    ['roster of 43', 'skill-pool-system.md quotes a 43-skill roster', 'skills.json has ' + R.total()],
    ['roster is now 43', 'skill-pool-system.md quotes a 43-skill roster', 'skills.json has ' + R.total()],
    ['ladder.js` does not exist', 'skill-pool-system.md says the ladder tool is missing', 'tools/ladder.js exists and verify runs it'],
    // skill-pool.md used to print the split on its own, without K_SKILL or the level
    // multiplier, so the same press had two different values depending on the file read
    ['skill_damage = stat', 'skill-pool.md publishes a second skill_damage without K_SKILL', 'skill-pool-system.md owns the full form'],
  ];
  for (const f of DOCS) {
    const txt = fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/);
    txt.forEach((line, i) => {
      for (const [probe, why, truth] of STALE_PROBES) {
        if (line.includes(probe)) staleHits.push(`${f}:${i + 1} ${why} — ${truth}`);
      }
    });
  }
  add('A1', staleHits.length === 0,
    `no doc quotes a known-stale copy of a derived anchor${staleHits.length ? ' · ' + staleHits.join(' · ') : ''}`);

  add('A2', over.length === 0,
    `each derived anchor is quoted at most its measured cap outside generated markers${over.length ? ' · OVER CAP: ' + over.join(' · ') : ''}`);

  // A3 — the roster count is the seam that already bit once.
  const rosterHits = rows.find((r) => r.a.id === 'A-roster');
  add('A3', rosterHits.hits.length <= rosterHits.a.max,
    `roster size ${rosterHits.v} quoted in ${rosterHits.hits.length} place(s), cap ${rosterHits.a.max} — ${[...new Set(rosterHits.hits.map((h) => h.file))].join(', ') || 'nowhere'}`);

  return { out, rows };
}

// ---------------------------------------------------------------- cli

const arg = process.argv[2];
const { out, rows } = runChecks();

if (arg === '--report') {
  console.log('derived anchors — hand-typed copies outside generated markers\n');
  for (const r of rows) {
    console.log(`${String(r.hits.length).padStart(3)}/${String(r.a.max).padEnd(3)} ${r.a.label} = ${Math.round(r.v * 100) / 100}  (${r.a.note})`);
    const byFile = {};
    for (const h of r.hits) (byFile[h.file] = byFile[h.file] || []).push(h.line);
    for (const [f, ls] of Object.entries(byFile)) console.log(`      ${f} → lines ${ls.join(', ')}`);
    console.log('');
  }
} else {
  for (const r of out) console.log(`${r.id.padEnd(3)}  ${r.ok ? 'PASS ' : 'FAIL '}  ${r.detail}`);
  const fails = out.filter((r) => !r.ok).length;
  const total = rows.reduce((n, r) => n + r.hits.length, 0);
  console.log(`\n${out.length - fails}/${out.length} gate PASS · ${fails} FAIL · ${total} hand-typed copies of ${rows.length} derived anchors`);
  if (fails) process.exitCode = 1;
}
