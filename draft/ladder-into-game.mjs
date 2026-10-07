/**
 * Move the field's new ladder into the game data (draft map work → `tools/data/`).
 *
 * The ladder follows the layout the owner picked: each town's band is its distance rank from the
 * starting town (ties broken by name), so zone id i holds band (i-1)*10+1 … i*10 exactly as
 * `engine/index.ts` already computes it from the id. What moves between zones is CONTENT — name,
 * region, elements, subzones and the named boss. What stays in place is the BAND PROFILE — levels,
 * hp, quality, group — so the mob_HP curve, the loot windows and every derived budget are untouched.
 *
 *   node draft/ladder-into-game.mjs            print what would change
 *   node draft/ladder-into-game.mjs --write    rewrite tools/data/{engine,town,map}.json
 */

import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const read = async (p) => JSON.parse(await readFile(root + p, 'utf8'));
const ENGINE = await read('tools/data/engine.json');
const TOWN = await read('tools/data/town.json');
const MAP = await read('tools/data/map.json');
const PAGE = await readFile(root + 'draft/map-field-20x15.html', 'utf8');
const WRITE = process.argv.includes('--write');

// ---- 1 · the ladder: rank every town by distance from the start, ties by name
const hd = (a, b) => {
  const dq = a[0] - b[0], dr = a[1] - b[1];
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};
const block = PAGE.slice(PAGE.indexOf('const LAYOUTS'), PAGE.indexOf('const wanted'));
const LAYOUT = process.argv.find((a) => /^organic-[a-d]$/.test(a)) || 'organic-d';
const towns = (block.match(new RegExp('"' + LAYOUT + '": \\{ towns:\\[([\\s\\S]*?)\\]\\s*\\}')) || [])[1];
if (!towns) throw new Error('layout ' + LAYOUT + ' not found in the page');
const coords = [...towns.matchAll(/n:"([^"]+)", q:(-?\d+), r:(-?\d+)/g)].map((m) => ({ n: m[1], q: +m[2], r: +m[3] }));
if (coords.length !== 18) throw new Error('layout ' + LAYOUT + ' carries ' + coords.length + ' towns');
const ladder = [...coords].sort((a, b) => hd([a.q, a.r], [0, 0]) - hd([b.q, b.r], [0, 0]) || a.n.localeCompare(b.n));
const bandBase = (q) => String(q || '').replace(/\s*\(floor = .*/, '').trim();

// ---- 2 · the permutation: old zone id -> new zone id, keyed by the town that holds it
const zoneByName = new Map(ENGINE.mob.zones.map((z) => [z.name, z]));
const settleByName = new Map(TOWN.settlements.map((s) => [s.name, s]));
const oldToNew = new Map();
ladder.forEach((t, i) => {
  const z = zoneByName.get(t.n);
  if (!z) throw new Error('no zone named ' + t.n);
  oldToNew.set(z.id, i + 1);
});
const newToOld = new Map([...oldToNew].map(([o, n]) => [n, o]));

// ---- 3 · zones: profile by slot, content by the town that now owns the slot
const oldZones = new Map(ENGINE.mob.zones.map((z) => [z.id, z]));
ENGINE.mob.zones = [...oldToNew]
  .map(([oldId, newId]) => ({ oldId, newId }))
  .sort((a, b) => a.newId - b.newId)
  .map(({ oldId, newId }) => {
    const profile = oldZones.get(newId);         // levels, hp, quality, group stay per slot
    const content = oldZones.get(oldId);         // name, region, elements, subzones travel
    return {
      id: newId,
      name: content.name,
      region: content.region,
      levels: profile.levels,
      hp: profile.hp,
      quality: profile.quality,
      elements: content.elements,
      group: profile.group,
      subzones: content.subzones,
    };
  });

// ---- 4 · everything else that carries a zone id follows the same permutation
for (const b of ENGINE.mob.bosses) b.zone = oldToNew.get(b.zone);
for (const sp of ENGINE.mob.species) if (Array.isArray(sp.zones)) sp.zones = sp.zones.map((z) => oldToNew.get(z)).sort((a, b) => a - b);
for (const s of TOWN.settlements) {
  s.zone = oldToNew.get(s.zone);
  const band = bandBase(ENGINE.mob.zones.find((z) => z.id === s.zone).quality);
  s.band = band;
  if (s.capital) s.capital = band;               // a capital stays with its town; its label follows the band
}
for (const t of MAP.tones) t.zone = oldToNew.get(t.zone);
for (const r of MAP.regions) r.zones = r.zones.map((z) => oldToNew.get(z)).sort((a, b) => a - b);

// ---- 5 · report or write
const rows = ENGINE.mob.zones.map((z) => ({
  id: z.id, name: z.name, levels: z.levels.join('-'), quality: z.quality,
  band: TOWN.settlements.find((s) => s.zone === z.id).band,
  capital: TOWN.settlements.find((s) => s.zone === z.id).capital || '-',
}));
for (const r of rows) console.log(String(r.id).padStart(2), r.name.padEnd(17), r.levels.padEnd(8), r.quality.padEnd(19), r.band.padEnd(5), r.capital);
console.log('\nlayout', LAYOUT, '· zones', ENGINE.mob.zones.length, '· bosses remapped', ENGINE.mob.bosses.length,
  '· species with zones', ENGINE.mob.species.filter((s) => s.zones).length);
const moved = [...oldToNew].filter(([o, n]) => o !== n).length;
console.log('zones that changed town:', moved, 'of 18');

if (WRITE) {
  for (const [file, data] of [['tools/data/engine.json', ENGINE], ['tools/data/town.json', TOWN], ['tools/data/map.json', MAP]])
    await writeFile(root + file, JSON.stringify(data, null, 2) + '\n');
  console.log('\nwritten.');
} else {
  console.log('\n(dry run — pass --write to apply)');
}
