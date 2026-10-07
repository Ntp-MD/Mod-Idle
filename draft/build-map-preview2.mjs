/**
 * Copy the map the game draws right now into one standalone page (`draft/map-preview2.html`).
 *
 * Nothing is re-derived here: the two SVG layers the client shows are inlined byte for byte
 * (`art/svg/map/map-terrain.svg` under `art/svg/map/map-overlay.svg`), and the map styling is
 * sliced out of `game/src/app.css`, so the copy cannot drift from the game by hand-editing.
 * The overlay's own generator is `tools/map.ts --write` — run that first when the map data moves.
 *
 *   node draft/build-map-preview2.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const draftDir = dirname(fileURLToPath(import.meta.url));
const root = join(draftDir, '..');
const OUT = join(draftDir, 'map-preview2.html');

const TERRAIN = join(root, 'art/svg/map/map-terrain.svg');
const OVERLAY = join(root, 'art/svg/map/map-overlay.svg');
const APP_CSS = join(root, 'game/src/app.css');

/** The XML declaration is illegal inside a page body, so it is dropped; comments stay. */
const inlineSvg = (svg) => svg.replace(/^<\?xml[^>]*\?>\s*/, '').trim();

/** The map's own rules live in the global stylesheet; the copy takes exactly that slice. */
function mapCss(css) {
  const lines = css.split('\n');
  const from = lines.findIndex((l) => l.includes('/* The settlement map.'));
  const to = lines.findIndex((l) => l.startsWith('@keyframes mapdash'));
  if (from < 0 || to < from) throw new Error('the map block moved in game/src/app.css — update this slicer');
  return lines.slice(from, to + 1).join('\n').trim();
}

function counts(svg) {
  const n = (re) => (svg.match(re) || []).length;
  return {
    pod: n(/class="hex pod"/g),
    field: n(/class="hex"(?! pod)/g),
    subzone: n(/class="subzone"/g),
    place: n(/class="place"/g),
    capital: n(/class="node capital"/g),
    pins: n(/class="pin"/g),
    dashes: n(/class="dash"/g),
    regions: n(/class="region"/g),
    washes: n(/class="terrain terrain-/g),
    watermarks: n(/class="watermark watermark-/g),
  };
}

const terrainSvg = inlineSvg(await readFile(TERRAIN, 'utf8'));
const overlaySvg = inlineSvg(await readFile(OVERLAY, 'utf8'));
const css = mapCss(await readFile(APP_CSS, 'utf8'));
const c = counts(overlaySvg);

// the game's map screen always shows one pin: the settlement the character stands in, Eastgate at a new game
const overlayShown = overlaySvg.replace('<g class="pin" data-node="eastgate"', '<g class="pin here" data-node="eastgate"');

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} kB`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Map Preview 2 · the game's map, copied</title>
<style>
  :root { --bg:#14161a; --panel:#1c2027; --line:#2c3340; --text:#d8dee9; --dim:#8b96a8; }
  * { box-sizing:border-box }
  body { margin:0; background:var(--bg); color:var(--text);
         font:14px/1.45 ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace; }
  .wrap { max-width:1180px; margin:0 auto; padding:26px 20px 60px; }
  header { border-bottom:1px solid var(--line); padding-bottom:14px; margin-bottom:20px; }
  h1 { font-size:1.15rem; margin:0 0 6px; letter-spacing:.02em; }
  .sub { color:var(--dim); font-size:12.5px; }
  h2 { font-size:.95rem; color:var(--dim); text-transform:uppercase; margin:26px 0 8px; }
  table { border-collapse:collapse; width:100%; }
  th, td { text-align:left; padding:.2rem .4rem; border-bottom:1px solid var(--line);
           font-variant-numeric:tabular-nums; }
  th { color:var(--dim); font-weight:500; }
  code { background:#232833; padding:1px 5px; border-radius:2px; }
  .note { color:var(--dim); font-size:12.5px; }
  /* the copy's own framing: the backdrop is the flow element, the overlay sits on top of it */
  .map-frame { position:relative; max-width:1180px; margin:0 auto; }
  .map-frame .backdrop { position:relative; display:block; width:100%; height:auto; }
  .map-frame .overlay { position:absolute; inset:0; width:100%; height:100%; }
${css.split('\n').map((l) => (l.trim() ? '  ' + l : l)).join('\n')}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>Map Preview 2 · the game's map, copied</h1>
  <div class="sub">A static copy of the map the client shows: <code>art/svg/map/map-terrain.svg</code> (${kb(terrainSvg)})
  with <code>art/svg/map/map-overlay.svg</code> (${kb(overlaySvg)}) on top, styled by the map block of <code>game/src/app.css</code>.
  Rebuild with <code>node draft/build-map-preview2.mjs</code>.</div>
</header>

<div class="map-frame">
${terrainSvg.split('\n').map((l) => '  ' + l).join('\n')}
${overlayShown.split('\n').map((l) => '  ' + l).join('\n')}
</div>

<p class="note">The green pin is the settlement a new game stands in (Eastgate) — the one pin the map screen always shows.
Writing this file reads the overlay as-is: no coordinate is parsed, no layer is redrawn.</p>

<h2>What the copy carries</h2>
<table>
  <tr><th>layer</th><th>count</th><th>where it comes from</th></tr>
  <tr><td>settlement hexes (<code>hex pod</code>)</td><td>${c.pod}</td><td>1 own hex + 1 per sub-zone, per node</td></tr>
  <tr><td>field hexes (<code>hex</code>)</td><td>${c.field}</td><td>the lattice outside the pods, tone-blended</td></tr>
  <tr><td>place labels</td><td>${c.place}</td><td>one per node, pushed off the cluster</td></tr>
  <tr><td>capital place labels</td><td>${c.capital}</td><td>settlements with <code>band === 'high'</code></td></tr>
  <tr><td>sub-zone labels</td><td>${c.subzone}</td><td>one per sub-zone hex, wrapped in the hex</td></tr>
  <tr><td>drawn stretches (<code>dash</code>)</td><td>${c.dashes}</td><td>map.json links — presentation only</td></tr>
  <tr><td>travel pins (<code>pin</code>)</td><td>${c.pins}</td><td>client toggles by node id</td></tr>
  <tr><td>terrain washes</td><td>${c.washes}</td><td>map.json terrain, anchored to a node or link</td></tr>
  <tr><td>watermarks</td><td>${c.watermarks}</td><td>map.json watermarks</td></tr>
  <tr><td>region names</td><td>${c.regions}</td><td>map.json regions</td></tr>
</table>

<p class="note">Also present: the river band, the 5x5 framing grid and the heat-shimmer dash animation
(<code>.dash.traveling</code>), which only runs while a walk is drawn. No JavaScript runs on this page.</p>

</div>
</body>
</html>
`;

await writeFile(OUT, html);
console.log(`wrote draft/map-preview2.html · ${kb(html)} · ${c.pod} pod hexes · ${c.field} field hexes · ${c.subzone} sub-zone labels · ${c.dashes} dashes · ${c.washes} washes · ${c.regions} regions`);
