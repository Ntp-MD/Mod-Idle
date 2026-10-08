/**
 * The visual harness — a real browser, the client's own keyboard, and one PNG per screen.
 *
 *   node game/tests/visual/shots.mjs            shots against http://localhost:5173
 *   node game/tests/visual/shots.mjs 5199       another port, same run
 *
 * It reaches every screen by its key press rather than by clicking, so one run proves the binding table
 * dispatches as well as that the screen renders. Console errors and page errors fail the run: a screen
 * that paints while throwing is worse than one that does not paint.
 *
 * The dev server is the owner's, so this attaches to it and never starts or stops one.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.argv[2] || '5173';
const URL = `http://localhost:${PORT}/`;
const OUT = path.resolve('game/tests/visual/shots');
fs.mkdirSync(OUT, { recursive: true });

/** every screen, reached by the key the client says opens it */
const SCREENS = [
  ['field', null],
  ['map', '1'],
  ['bags', '2'],
  ['town', '3'],
  ['market', '4'],
  ['forge', '5'],
  ['craft', '6'],
  ['skills', '7'],
  ['tree', '8'],
  ['desk', 'd'],
  ['farm', 'f'],
  ['save', 's'],
  ['keys', 'k'],
  ['stash', 'b'],
];

const problems = [];
const sizes = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'wide-1920', width: 1920, height: 1080 },
  { name: 'small-1024', width: 1024, height: 700 },
];

const browser = await chromium.launch();
for (const size of sizes) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${size.name} console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`${size.name} pageerror: ${e.message}`));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stage', { timeout: 15000 });
  // let the fight run a few seconds so the mob plates, the chronicle and the pile all have content in them
  await page.waitForTimeout(4000);
  // the read file is per run, not a log: a stale line from the last run reads like a passing check
  fs.rmSync(path.join(OUT, `${size.name}-read.txt`), { force: true });

  for (const [name, key] of SCREENS) {
    if (key) await page.keyboard.press(key);
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(key === '1' ? 900 : 450);
    const file = path.join(OUT, `${size.name}-${name}.png`);
    await page.screenshot({ path: file });
    // the fight is the subject, so it sits on the middle of the frame it plays in. Measured, not eyeballed:
    // the group's own centre against the stage's, in the width the stage actually owns
    if (name === 'field') {
      const off = await page.evaluate(() => {
        const stage = document.querySelector('.stage')?.getBoundingClientRect();
        const box = document.querySelector('.field')?.getBoundingClientRect();
        if (!stage || !box) return null;
        const r = (el) => el.getBoundingClientRect();
        const mobs = Array.from(document.querySelectorAll('.mob'));
        const l = Math.min(box.left, ...mobs.map((m) => r(m).left));
        const rt = Math.max(box.right, ...mobs.map((m) => r(m).right));
        // centring the subject must not put it under a side read: a plate that overlaps the tracker, the
        // vitals or the chronicle is unreadable, which is the whole reason the gutters existed
        const hits = ['.tracker', '.vitals', '.chronicle', '.pockets', '.actionbar']
          .filter((sel) => Array.from(document.querySelectorAll(sel)).some((el) => {
            const a = r(el);
            return mobs.some((m) => {
              const b = r(m);
              return b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top;
            });
          }));
        return {
          // the box is the layout claim, so it is measured whether or not a group happens to be on screen
          delta: (box.left + box.right) / 2 - (stage.left + stage.width / 2),
          groupDelta: mobs.length ? (l + rt) / 2 - (stage.left + stage.width / 2) : null,
          width: stage.width, plates: mobs.length, hits,
          // the starting zone fields one mob, so a live overlap reading proves nothing about a full group:
          // the widest group the engine sends is measured against the room the box actually has
          room: box.width,
          need: mobs.length ? r(mobs[0]).width * 3 + 10 * 2 : 0,
        };
      });
      if (!off) problems.push(`${size.name}: the mob field could not be measured`);
      else {
        if (off.hits.length) problems.push(`${size.name}: a mob plate overlaps ${off.hits.join(', ')}`);
        const tol = off.width * 0.02;
        if (Math.abs(off.delta) > tol) problems.push(`${size.name}: the fight sits ${off.delta.toFixed(0)}px off the middle of the frame (tolerance ${tol.toFixed(0)}px)`);
        else if (off.plates && off.need > off.room) problems.push(`${size.name}: three plates side by side need ${off.need.toFixed(0)}px but the field has ${off.room.toFixed(0)}px — a full group would wrap or crowd`);
        else fs.appendFileSync(path.join(OUT, `${size.name}-read.txt`),
          `group centred: box ${off.delta.toFixed(1)}px off middle, plates ${(off.groupDelta ?? 0).toFixed(1)}px, ${off.plates} on screen, `
          + `a 3-group needs ${off.need.toFixed(0)}px of ${off.room.toFixed(0)}px, no overlap\n`);
      }
    }
    // the Bags screen opens on whichever side serves the ground under the character, so shoot the other
    // side too rather than trusting the default
    if (name === 'bags') {
      const pile = await page.$('.sides button');
      if (pile) { await pile.click(); await page.waitForTimeout(350); }
      await page.screenshot({ path: path.join(OUT, `${size.name}-bags-pile.png`) });
    }
    // what the screen actually says, kept as text so a diff can be read without opening a PNG
    const text = await page.evaluate(() => {
      const box = document.querySelector('.veil .box') || document.querySelector('.stage');
      return box ? (box.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400) : '';
    });
    fs.appendFileSync(path.join(OUT, `${size.name}-read.txt`), `${name}: ${text}\n`);
    if (key === null) { /* the field stays open for the next press */ }
  }
  // The endless ground is only on screen when the field is small: at the lowest zoom, and in the two level
  // views where the cells outside a band carry no fill at all. That is where a palette that does not agree
  // with the map shows as a hard ring, so it is shot on purpose rather than left to the resting view.
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  for (let i = 0; i < 12; i++) { await page.keyboard.press('-'); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${size.name}-ground-out.png`) });
  await page.keyboard.press('v');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${size.name}-ground-band.png`) });
  await page.keyboard.press('0');
  await page.keyboard.press('Escape');

  // what the browser was actually told about selection, on the surfaces that must disagree. Measured with a
  // table-bearing screen open, because a probe run over a closed panel reports `missing` and looks like a
  // pass — the Keyboard screen is the one that is always reachable and always holds a table.
  await page.keyboard.press('k');
  await page.waitForTimeout(400);
  const sel = await page.evaluate(() => {
    const read = (sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).userSelect : 'MISSING';
    };
    return {
      body: read('body'),
      map: read('.map-back'),
      mapLabel: read('.sheet svg text'),
      railTab: read('.rail .tab'),
      logLine: read('.chronicle div'),
      prose: read('.kb td'),
      head: read('.kb .act'),
      keyCap: read('.cap'),
    };
  });
  fs.writeFileSync(path.join(OUT, `${size.name}-select.json`), JSON.stringify(sel, null, 1) + '\n');
  await page.keyboard.press('Escape');

  // the focus ring, proven by walking the keyboard rather than by reading the stylesheet: where the ring is
  // drawn, on what, and whether it is the cyan focus colour rather than the gold "you are here" colour
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  const ring = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return { on: el.tagName + '.' + (el.className || ''), outline: cs.outlineColor + ' ' + cs.outlineWidth + ' ' + cs.outlineStyle, offset: cs.outlineOffset };
  });
  await page.screenshot({ path: path.join(OUT, `${size.name}-focus.png`) });
  fs.appendFileSync(path.join(OUT, `${size.name}-select.json`), JSON.stringify(ring, null, 1) + '\n');
  await page.keyboard.press('Escape');

  // the best-gear press: shot, and the answer it printed is kept as text so a silent no-op cannot pass.
  // The press is taken only once the hunt has actually banked pieces — waiting on the pile rather than on
  // a clock, so the reading is made on a live bag (a time premise · AGENTS.md)
  // A real swap, on screen. The client's own Export gives a save; the same pieces with their lines made
  // stronger go back into the pile through the client's own Import; the press then has to dress the body.
  // Every step is a control the player has, so this proves the wiring and the rule together — and a note
  // that reports no swap here is a failure, not a clean run.
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.waitForTimeout(300);
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ]);
  const raw = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  const strong = raw.state.gear.filter(Boolean).slice(0, 4).map((g) => ({
    ...g, lines: (g.lines || []).map((l) => ({ ...l, value: (l.value || 1) * 6 })),
  }));
  if (!strong.length) problems.push(`${size.name}: the exported save wore no gear, so there was nothing to strengthen`);
  raw.state.bag = strong;
  const file = path.join(OUT, `${size.name}-strong.json`);
  fs.writeFileSync(file, JSON.stringify({ version: raw.version, state: raw.state }, null, 1));
  await page.setInputFiles('input[type=file]', file);
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await page.keyboard.press('2');
  await page.waitForTimeout(400);
  await page.keyboard.press('q');
  await page.waitForTimeout(400);
  const best = await page.evaluate(() => {
    const n = document.querySelector('.equipnote');
    return n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : 'NO NOTE';
  });
  await page.screenshot({ path: path.join(OUT, `${size.name}-best-equip.png`) });
  fs.appendFileSync(path.join(OUT, `${size.name}-read.txt`), `best-equip: ${best}\n`);
  if (!/\d+ piece/.test(best)) problems.push(`${size.name}: the press did not dress the body — it said "${best}"`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // a selected piece on the forge, so the ladder and its refusal copy are in the shot
  await page.keyboard.press('5');
  await page.waitForTimeout(300);
  const chips = await page.$$('.veil .chip');
  if (chips.length) { await chips[0].click(); await page.waitForTimeout(300); }
  await page.screenshot({ path: path.join(OUT, `${size.name}-forge-piece.png`) });
  await page.keyboard.press('Escape');
  await ctx.close();
}
await browser.close();

console.log(`wrote ${fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length} shots to ${OUT}`);
if (problems.length) {
  console.log(`${problems.length} browser problem(s):`);
  for (const p of [...new Set(problems)]) console.log(`  · ${p}`);
  process.exit(1);
}
console.log('no console or page errors');
