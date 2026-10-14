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

/** every colour a damage number is allowed to wear, read from the data that paints it — never typed here */
const ENGINE = JSON.parse(fs.readFileSync(path.resolve('tools/data/engine.json'), 'utf8'));
const COLOURS = new Set([ENGINE.elements.physical_colour, ENGINE.elements.crit_colour,
  ...Object.values(ENGINE.elements.colour)].map((c) => String(c).toLowerCase()));
/** what one block of road costs in seconds, so the leg waits on the walk the data priced rather than on a guess */
const BLOCK_SEC = ENGINE.road.block_sec;
/** The widest group the design ever sends at the character, read off the zones' own `group` ranges. The field
 *  leg measures a live fight, and the starting zone fields a broad race pool, so a wrapped second row is a
 *  claim about the worst case and has to be settled by arithmetic rather than left to luck. */
const MAX_GROUP = ENGINE.mob.zones.reduce((n, z) => Math.max(n, Number(String(z.group ?? '').split('-').pop()) || 0), 0);
/** every beat the field can play, each mounted by a fact from the sim rather than by a stylesheet's clock.
 *  A mob's beats are read off `.mob` and the character's off `.self-plate`, never mixed: the harness counts
 *  mob plates elsewhere, and the two cards wear the same furniture on purpose. */
const BEATS = {
  arc: '.mob .arc', burst: '.mob .burst', flare: '.cast .flare',
  buff: '.fx-buff', heal: '.fx-heal', level: '.levelup',
  park: '.mob .plate-fx .pop', selfPark: '.self-plate .plate-fx .pop',
  knock: '.art.knock', lunge: '.charge.lunge', rim: '.mob .flash', selfRim: '.self-plate .flash',
};
const BEAT_ORDER = Object.keys(BEATS);
/** every `--fx` ink the field wore while it watched, and the peak count of each beat. An animation that never
 *  painted is a missing sim event, not a missing rule, so the caller names which beats it requires. */
async function watchBeats(page, ms, { require = [], allowed, min = 0 }) {
  return page.evaluate(async ({ sels, order, must, allowed, ms, min }) => {
    const ink = (el) => (getComputedStyle(el).getPropertyValue('--fx') || '').trim().toLowerCase();
    const count = (name) => document.querySelectorAll(sels[name]).length;
    const seen = {}, bad = [], anims = {};
    const t0 = performance.now();
    for (;;) {
      let done = true;
      for (const name of order) {
        const n = count(name);
        if (n) seen[name] = Math.max(seen[name] || 0, n);
        if (must.includes(name) && !seen[name]) done = false;
        for (const el of document.querySelectorAll(sels[name])) {
          const c = ink(el);
          if (c && !allowed.includes(c) && !bad.includes(c)) bad.push(c);
          // the node existing is the sim's fact; the animation running on it is the stylesheet's answer,
          // and a beat mounted with `animation: none` is a node the eye never saw
          const a = getComputedStyle(el).animationName;
          (anims[name] || (anims[name] = new Set())).add(a);
        }
      }
      // the watch ends the moment everything required has painted, so a passing run costs seconds not a clock,
      // but it always samples more than one frame — a colour gate that saw one instant proved little
      const spent = performance.now() - t0;
      if ((done && spent >= min) || spent >= ms) {
        const flat = {};
        for (const k of Object.keys(anims)) flat[k] = [...anims[k]];
        return { seen, bad, anims: flat, waited: Math.round(spent) };
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  }, { sels: BEATS, order: BEAT_ORDER, must: require, allowed, ms, min });
}

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
      const off = await page.evaluate((maxGroup) => {
        const stage = document.querySelector('.stage')?.getBoundingClientRect();
        const field = document.querySelector('.field');
        const box = field?.getBoundingClientRect();
        const you = document.querySelector('.self-plate')?.getBoundingClientRect();
        if (!stage || !box || !you) return null;
        const r = (el) => el.getBoundingClientRect();
        const cross = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const mobs = Array.from(document.querySelectorAll('.mob:not(.grave)'));
        const l = Math.min(box.left, ...mobs.map((m) => r(m).left));
        const rt = Math.max(box.right, ...mobs.map((m) => r(m).right));
        // centring the subject must not put it under a side read: a plate that overlaps the tracker, the
        // vitals or the chronicle is unreadable, which is the whole reason the gutters existed
        const hits = ['.tracker', '.vitals', '.chronicle', '.pockets', '.actionbar']
          .filter((sel) => Array.from(document.querySelectorAll(sel)).some((el) => {
            const a = r(el);
            return mobs.some((m) => cross(r(m), a));
          }));
        // the character's own card lives in the band the field reserves for it. Everything about it is a
        // layout claim: inside the box, off every other read, under the group rather than in it, and the
        // reserve has to be the height the card actually takes
        const cs = getComputedStyle(field);
        const reserve = parseFloat(cs.paddingBottom) || 0;
        const gutter = ['.tracker', '.vitals', '.chronicle', '.pockets', '.actionbar']
          .filter((sel) => Array.from(document.querySelectorAll(sel)).some((el) => cross(r(el), you)));
        const inside = you.left >= box.left - 1 && you.right <= box.right + 1
          && you.top >= box.top - 1 && you.bottom <= box.bottom + 1;
        const onGroup = mobs.filter((m) => cross(r(m), you)).length;
        return {
          // the box is the layout claim, so it is measured whether or not a group happens to be on screen
          delta: (box.left + box.right) / 2 - (stage.left + stage.width / 2),
          groupDelta: mobs.length ? (l + rt) / 2 - (stage.left + stage.width / 2) : null,
          width: stage.width, plates: mobs.length, hits,
          // the starting zone fields one mob, so a live overlap reading proves nothing about a full group:
          // the widest group the engine sends is measured against the room the box actually has
          room: box.width,
          need: mobs.length ? r(mobs[0]).width * 3 + (parseFloat(cs.columnGap) || 0) * 2 : 0,
          you: { inside, onGroup, gutter, height: you.height, reserve,
            roomDelta: (you.left + you.right) / 2 - (stage.left + stage.width / 2) },
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
        // the self plate: on the near edge, on the frame's own axis, and in the band the field kept for it
        const y = off.you;
        if (!y.inside) problems.push(`${size.name}: the character's plate is not inside the mob field`);
        if (y.onGroup) problems.push(`${size.name}: the character's plate overlaps ${y.onGroup} live mob plate(s) — the band it stands in is not reserved`);
        if (y.gutter.length) problems.push(`${size.name}: the character's plate overlaps ${y.gutter.join(', ')}`);
        if (Math.abs(y.roomDelta) > tol) problems.push(`${size.name}: the character's plate sits ${y.roomDelta.toFixed(0)}px off the middle of the frame`);
        if (y.height > y.reserve + 1) problems.push(`${size.name}: the character's plate is ${y.height.toFixed(0)}px tall and the field reserves ${y.reserve.toFixed(0)}px — it reaches into the group`);
        else fs.appendFileSync(path.join(OUT, `${size.name}-read.txt`),
          `self plate: ${y.height.toFixed(0)}px in a ${y.reserve.toFixed(0)}px band, on the middle of the frame and off every gutter read\n`);
      }
    }
    // the Bags screen opens on whichever side serves the ground under the character, so shoot the other
    // side too rather than trusting the default
    if (name === 'bags') {
      // the bag screen has no rail tab: its round knob on the cast order carries it, and the key press that
      // opened this screen is the proof the binding survived the tab's removal
      const rail = await page.evaluate(() => ({
        tab: Array.from(document.querySelectorAll('.rail .tab span'))
          .some((s) => (s.textContent || '').trim().toLowerCase() === 'bags'),
        lit: !!document.querySelector('[aria-label="Bags"].here'),
      }));
      if (rail.tab) problems.push(`${size.name}: the rail still carries a bags tab the bottom bar already offers`);
      if (!rail.lit) problems.push(`${size.name}: the bags screen is open and no knob on the bar answers for it`);
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
  // The walk and what it walks into: a walk closes the map and raises the field, where one trail of boot
  // prints fills from the left as the blocks are crossed, and the moment the feet reach wild ground the
  // fight starts on its own — no button pressed, because arriving on a fight is the fight. Shot on a real
  // click and a real Enter and asserted rather than eyeballed: a screen that looks right in a PNG but never
  // mounted the trail, or never swung, is the failure this catches.
  await page.keyboard.press('1');
  await page.waitForTimeout(500);
  const candidates = await page.evaluate(() => {
    // bare ground a real click can actually reach, nearest the middle of the screen first: elementFromPoint
    // answers for the destination card, the rail and any plate sitting on the map, so the pick works at
    // every shot size without a typed box. The sheet, not the minimap: the thumbnail carries its own
    // copy of every cell polygon, and its copy is the one an unscoped locator would click first.
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const picks = [];
    for (const p of document.querySelectorAll('.map-back svg polygon.cell.bare')) {
      const ax = p.getAttribute('data-ax');
      if (!ax) continue;
      const b = p.getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      if (b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight) continue;
      if (document.elementFromPoint(x, y) !== p) continue;
      picks.push({ ax, d: Math.hypot(x - cx, y - cy) });
    }
    return picks.sort((a, b) => a.d - b.d).slice(0, 4).map((p) => p.ax);
  });
  if (!candidates.length) problems.push(`${size.name}: no bare cell was clickable, so the walk could not be started`);
  else {
    // the shortest walk wins: the block count is read off the client's own destination card rather than
    // worked out here, so a far pick never makes this leg wait on a road the player would never take
    let best = null;
    for (const ax of candidates) {
      // the card the previous pick raised can come to sit over the next candidate, so reachability is
      // re-checked against the live DOM before each click and a blocked one is skipped rather than
      // retried for thirty seconds; the walk is not lost, the next candidate carries it
      const reachable = await page.evaluate((a) => {
        const p = document.querySelector(`.map-back svg polygon.cell.bare[data-ax="${a}"]`);
        if (!p) return false;
        const b = p.getBoundingClientRect();
        return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === p;
      }, ax).catch(() => false);
      if (!reachable) continue;
      try { await page.click(`.map-back svg polygon.cell.bare[data-ax="${ax}"]`, { timeout: 3000 }); }
      catch { continue; }
      await page.waitForTimeout(250);
      const card = await page.evaluate(() => {
        const t = (document.querySelector('.mapcard .dest')?.textContent || '').replace(/\s+/g, ' ');
        const m = t.match(/(\d+) blocks/);
        return m && Number(m[1]);
      });
      if (card && (!best || card < best.blocks)) best = { ax, blocks: card };
      if (best && best.blocks === 1) break;
    }
    if (!best) problems.push(`${size.name}: the destination card never priced a walk, so no trip could be started`);
    else {
      await page.click(`.map-back svg polygon.cell.bare[data-ax="${best.ax}"]`);
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(700);
      const read = () => page.evaluate(() => {
        const t = document.querySelector('.field .travel');
        const prints = Array.from(document.querySelectorAll('.field .travel .print'));
        const cs = prints.length ? getComputedStyle(prints[0]) : null;
        return {
          mapmode: document.querySelector('.stage')?.classList.contains('mapmode') ?? null,
          trail: !!t, prints: prints.length,
          p: t ? parseFloat(getComputedStyle(t).getPropertyValue('--p')) : NaN,
          mask: cs ? (cs.webkitMaskImage || cs.maskImage || '') : '',
          // the two feet are the shelf's one glyph split down the middle: the mask-position says which half
          // a print wears, so an alternating stride is measured, not assumed
          feet: new Set(prints.map((q) => getComputedStyle(q).getPropertyValue('mask-position'))).size,
          // the reads this replaced: a half-deleted figure, a sliding band or the old dot bed must fail
          old: !!document.querySelector('.traveller') || !!document.querySelector('.hexband')
            || !!document.querySelector('.field .travel .dot'),
        };
      });
      const trip = await read();
      await page.waitForTimeout(2000);
      const later = await read();
      await page.screenshot({ path: path.join(OUT, `${size.name}-travel.png`) });
      fs.appendFileSync(path.join(OUT, `${size.name}-read.txt`),
        `travel: map closed ${!trip.mapmode}, trail of ${trip.prints} prints in ${trip.feet} feet at ${trip.p}, `
        + `filled to ${later.p}, mark ${trip.mask.startsWith('url(') ? 'masked' : 'MISSING'}\n`);
      if (trip.mapmode) problems.push(`${size.name}: the walk did not raise the field — the map is still in focus`);
      if (!trip.trail || trip.prints !== 7) problems.push(`${size.name}: the walk mounted ${trip.prints} prints instead of the stride's seven`);
      if (!(trip.p >= 0 && trip.p <= 1)) problems.push(`${size.name}: the trail's progress read is not a fraction of the walk (${trip.p})`);
      if (!trip.mask.startsWith('url(')) problems.push(`${size.name}: the prints are unmasked rectangles — the shelf's boot glyph never reached them`);
      if (trip.feet < 2) problems.push(`${size.name}: every print wears the same foot, so the trail is a row of copies and not a stride`);
      if (trip.old) problems.push(`${size.name}: the old bed, the walking figure or its scrolling band is still on the field`);
      if (!later.trail) problems.push(`${size.name}: the trail vanished before the walk was due to end`);
      else if (!(later.p > trip.p)) problems.push(`${size.name}: the trail did not fill as the walk crossed its blocks (${trip.p} then ${later.p})`);
      // the arrival: the trail goes, the plate comes, and nothing was pressed in between
      const secs = best.blocks * BLOCK_SEC;
      try {
        await page.waitForSelector('.mob', { timeout: secs * 1000 + 20000 });
      } catch { /* the leg below reports what was not on screen */ }
      const fought = await page.evaluate(() => ({
        travel: !!document.querySelector('.field .travel'),
        plates: document.querySelectorAll('.mob:not(.grave)').length,
      }));
      if (fought.travel) problems.push(`${size.name}: the trail is still on the field after the walk ended`);
      if (!fought.plates) problems.push(`${size.name}: the walk ended on wild ground and no mob was fielded — the fight did not start by itself`);
      // The numbers: every blow that landed on a mob pops its own figure off that mob's plate
      // (up to four the ring still holds), and the shared column keeps only what has no body to stand
      // on — a kill and a drop. The rim is the short half (one beat per event, then gone), so the read
      // is one poll that returns the frame only when a figure and its rim are both up: sampling a moment
      // after the wait would report a hit that did happen against a plate the sim has already moved on from.
      const frame = (q) => {
        const shown = Array.from(document.querySelectorAll('.mob:not(.grave)'));
        const floats = (p) => Array.from(p.querySelectorAll('.plate-fx .pop'));
        const ink = (el) => (getComputedStyle(el).getPropertyValue('--fx') || '').trim().toLowerCase();
        const all = Array.from(document.querySelectorAll('.mob .plate-fx .pop'));
        const rimmed = shown.filter((p) => p.querySelector('.flash'));
        // the body the next swing waits on must be marked, and the figure must sit where the owner asked:
        // on the card's top-right, above its frame
        const front = shown.find((p) => p.classList.contains('front'));
        const face = front ? front.querySelector('.charge') : null;
        const mark = face ? getComputedStyle(face, '::before') : null;
        const parkedRight = all.map((f) => {
          const b = f.closest('.mob').getBoundingClientRect(), r = f.getBoundingClientRect();
          return r.top < b.top && r.right > b.left + b.width / 2;
        });
        // an object is a truthy return, so a frame with nothing on it answers null and the poll keeps watching
        if (q.mustSee && !(all.length && rimmed.length)) return null;
        return {
          plates: shown.length, onPlate: all.length,
          stacked: Math.max(0, ...shown.map((p) => floats(p).length)),
          // the plate wearing the rim is the plate the newest hit belongs to, so it must hold a number
          flashed: rimmed.length,
          flashedStruck: rimmed.filter((p) => floats(p).length).length,
          column: document.querySelectorAll('.field-side .fx-hit').length,
          bad: [...new Set(all.map(ink))].filter((c) => !q.allowed.includes(c)),
          // the character's own card: a blow that landed on it pops its figure there and the rim is
          // worn there rather than only on the mob's plate
          you: !!document.querySelector('.self-plate'),
          youRim: !!document.querySelector('.self-plate .flash'),
          youPark: document.querySelectorAll('.self-plate .plate-fx .pop').length,
          front: !!front,
          frontMark: !!(mark && parseFloat(mark.borderTopWidth) > 0 && parseFloat(mark.borderLeftWidth) > 0),
          parkedRight: parkedRight.length === 0 || parkedRight.every(Boolean),
        };
      };
      if (fought.plates) {
        let fight = null;
        try {
          const h = await page.waitForFunction(frame, { allowed: [...COLOURS], mustSee: true },
            { timeout: 30000, polling: 50 });
          fight = await h.jsonValue();
        } catch {
          fight = await page.evaluate(frame, { allowed: [...COLOURS], mustSee: false });
        }
        await page.screenshot({ path: path.join(OUT, `${size.name}-fight.png`) });
        fs.appendFileSync(path.join(OUT, `${size.name}-read.txt`),
          `fight: ${fight.plates} plates after a ${best.blocks}-block walk, ${fight.onPlate} popped figure(s) on them `
          + `(most ${fight.stacked} on one, ${fight.parkedRight ? 'each on its top-right above the frame' : 'ONE NOT ON ITS TOP-RIGHT'}), `
          + `${fight.flashed} plate rimmed, shared column holds ${fight.column} hit(s), `
          + `the front body is ${fight.front ? (fight.frontMark ? 'marked' : 'UNMARKED') : 'missing'}, `
          + `the character's card ${fight.you ? 'stands on the field' : 'is MISSING'} with ${fight.youPark} figure(s)\n`);
        if (!fight.onPlate) problems.push(`${size.name}: no damage figure parked on a plate — the hit is still going to one shared column`);
        if (!fight.parkedRight) problems.push(`${size.name}: a parked figure is not stamped on its card's top-right above the frame`);
        if (!fight.front) problems.push(`${size.name}: no plate on the field is marked as the body the next swing waits on`);
        if (fight.front && !fight.frontMark) problems.push(`${size.name}: the front plate carries no reticle — the target read is a class with no face`);
        if (fight.stacked > 4) problems.push(`${size.name}: one plate holds ${fight.stacked} figures — a struck card pops at most four, one per blow the ring still holds`);
        if (fight.column) problems.push(`${size.name}: ${fight.column} attributed hit(s) are still in the shared column`);
        if (fight.flashed < 1) problems.push(`${size.name}: no plate wore the rim of the blow`);
        else if (fight.flashed !== fight.flashedStruck) problems.push(`${size.name}: a rimmed plate holds no figure — the flash is not following the hit`);
        if (fight.bad.length) problems.push(`${size.name}: a float wears ${fight.bad.join(', ')}, which is not a colour in engine.json elements`);
        if (!fight.you) problems.push(`${size.name}: the fight has no card for the character — the blows it takes still land on a column`);
        // The motion on the fight as it stands: a build that swings must paint the cut, the struck body must
        // take the knock and the plate must wear the rim. Colour is checked for every beat that appears, so a
        // hand-typed ink anywhere on the field fails the same gate as a float. The beats that need a press,
        // a buff, a heal or a level are driven on purpose in the leg below rather than left to chance.
        const live = await watchBeats(page, 12000, { require: ['arc', 'knock', 'rim', 'park'], allowed: [...COLOURS], min: 2500 });
        fs.appendFileSync(path.join(OUT, `${size.name}-read.txt`),
          `motion: ${BEAT_ORDER.map((k) => `${k} ${live.seen[k] || 0}`).join(', ')} in ${live.waited}ms\n`);
        if (!live.seen.arc) problems.push(`${size.name}: no swing arc was mounted while the fight ran — the attack beat never painted`);
        if (!live.seen.knock) problems.push(`${size.name}: a struck mob's body never took the knock`);
        if (!live.seen.park) problems.push(`${size.name}: no figure popped on a struck plate`);
        if (!live.seen.rim) problems.push(`${size.name}: no plate wore the rim of the blow`);
        if (live.bad.length) problems.push(`${size.name}: an animation wears ${live.bad.join(', ')}, which is not a colour in engine.json elements`);
        // what the dock could never show: the character's card rims and rocks when it is the one being hit.
        // It needs a blow to land, so it is watched for rather than assumed — a fight the mob loses never
        // proves the read exists.
        const onYou = await watchBeats(page, 20000, { require: ['selfRim', 'selfPark'], allowed: [...COLOURS], min: 1200 });
        if (!onYou.seen.selfRim) problems.push(`${size.name}: the character's plate never wore the rim of a blow it took`);
        if (!onYou.seen.selfPark) problems.push(`${size.name}: no incoming figure popped on the character's plate`);
      }
      // The field leg can be run with no group on screen, and a wrapped row cannot be measured against an
      // empty box — so the height claim is made here, where a fight is certain to field plates. A group can
      // still die between the two legs, so the field is watched for a body rather than sampled once: it is
      // the arithmetic of the widest group the design sends, not the pair that happens to be standing here.
      try {
        await page.waitForFunction(() => document.querySelectorAll('.mob:not(.grave)').length > 0,
          null, { timeout: 30000 });
      } catch { /* the leg below reports an empty field rather than guessing a row */ }
      const stack = await page.evaluate((maxGroup) => {
        const field = document.querySelector('.field');
        const box = field?.getBoundingClientRect();
        const mobs = Array.from(document.querySelectorAll('.mob:not(.grave)'));
        if (!box || !mobs.length) return null;
        const cs = getComputedStyle(field);
        const card = mobs[0].getBoundingClientRect();
        const gap = parseFloat(cs.rowGap || cs.gap) || 0;
        const perRow = Math.max(1, Math.floor((box.width + gap) / (card.width + gap)));
        const rows = Math.ceil(maxGroup / perRow);
        const reserve = parseFloat(cs.paddingBottom) || 0;
        return { perRow, rows, stack: card.height * rows + gap * (rows - 1), room: box.height - reserve, reserve };
      }, MAX_GROUP);
      if (!stack) problems.push(`${size.name}: no mob plate was on the field, so the wrapped group could not be measured`);
      else if (stack.stack > stack.room) problems.push(`${size.name}: ${MAX_GROUP} mobs at ${stack.perRow} to a row need ${stack.rows} rows and ${stack.stack.toFixed(0)}px of height but the field leaves ${stack.room.toFixed(0)}px above the band the character's plate stands in`);
      else fs.appendFileSync(path.join(OUT, `${size.name}-read.txt`),
        `wrapped group: ${MAX_GROUP} mobs at ${stack.perRow} to a row is ${stack.rows} row(s) of ${stack.stack.toFixed(0)}px in the ${stack.room.toFixed(0)}px left above a ${stack.reserve.toFixed(0)}px band\n`);
      // back to the map so the ground legs below start from the same place every run
      await page.keyboard.press('1');
      await page.waitForTimeout(300);
    }
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

  // Every beat the field can play, driven rather than hoped for. The live save only ever swings, so the press,
  // the buff coming up, the HP returning and the level taken are raised by a build the leg installs through
  // the client's own Import — the same control the player has — and each one is then REQUIRED to paint. The
  // rows come from skills.json by their own `type`, the xp step from the gauge the client drew, so nothing
  // here names a skill or a number the data owns.
  const SKILLS = JSON.parse(fs.readFileSync(path.resolve('tools/data/skills.json'), 'utf8'));
  const rows = (type) => SKILLS.skills.filter((k) => k.type === type);
  const rowOf = (type) => (rows(type)[0] || {}).id;
  // the lightest press in the roster, so the burst is seen on a wound: a press that ends a mob hands the plate
  // to its outro in the same tick, and the falling body carries the blow that was already painted on it
  const woundId = (rows('attack').slice().sort((a, b) => (a.base_flat ?? Infinity) - (b.base_flat ?? Infinity))[0] || {}).id;
  const [pressId, buffId, healId] = ['attack', 'buff', 'heal'].map(rowOf);
  if (!pressId || !buffId || !healId || !woundId) problems.push(`${size.name}: skills.json offered no attack, buff or heal row to drive the beats with`);
  else {
    await page.keyboard.press('s');
    await page.waitForTimeout(300);
    const [dl2] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export JSON' }).click(),
    ]);
    const raw2 = JSON.parse(fs.readFileSync(await dl2.path(), 'utf8'));
    const st = raw2.state;
    st.skills.list[0] = pressId; st.skills.list[1] = buffId; st.skills.list[2] = healId; st.skills.list[3] = woundId;
    for (const id of [pressId, buffId, healId, woundId]) st.skills.owned[id] = 10;
    // the slot gates are the player's own switches: a `never` or an unmet `conditional` silences a row, and a
    // worn buff is the only thing that makes the recast — so the build is opened up rather than guessed at
    st.skills.mode = {}; st.skills.conditions = {}; st.skills.cd = {};
    st.skills.buffs[buffId] = true; st.skills.buffUp[buffId] = 0;
    st.player.mana = 1e9; st.player.hp = 1; st.player.xp = 0;
    // the level is left alone on purpose: accuracy rides with it, and a low one spends the fight dodging the
    // press this leg is here to see. The step is armed from the gauge instead, so any level crosses on a kill
    st.hunting = true;
    const beatsFile = path.join(OUT, `${size.name}-beats.json`);
    const save = (s) => fs.writeFileSync(beatsFile, JSON.stringify({ version: raw2.version, state: s }, null, 1));
    save(st);
    await page.setInputFiles('input[type=file]', beatsFile);
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    // one kill short of the step, read off the client's own gauge: the level band then lands inside the watch
    const need = await page.evaluate(() => Number(document.querySelector('.gauge.xp progress')?.getAttribute('max')) || 0);
    if (!need) problems.push(`${size.name}: the XP gauge never printed its step, so the level beat could not be armed`);
    else {
      st.player.xp = need - 1;
      await page.keyboard.press('s');
      await page.waitForTimeout(300);
      save(st);
      await page.setInputFiles('input[type=file]', beatsFile);
      await page.waitForTimeout(600);
      await page.keyboard.press('Escape');
    }
    // Every beat has to paint inside one watch, including the two on the character's own card.
    const all = await watchBeats(page, 45000, { require: BEAT_ORDER, allowed: [...COLOURS] });
    await page.screenshot({ path: path.join(OUT, `${size.name}-beats.png`) });
    fs.appendFileSync(path.join(OUT, `${size.name}-read.txt`),
      `beats: ${BEAT_ORDER.map((k) => `${k} ${all.seen[k] || 0}`).join(', ')} in ${all.waited}ms off ${pressId}/${buffId}/${healId}/${woundId}\n`);
    const missing = BEAT_ORDER.filter((k) => !all.seen[k]);
    if (missing.length) problems.push(`${size.name}: ${missing.join(', ')} never mounted while the build pressed, buffed, healed and levelled`);
    // a node that mounted with no animation on it is the failure this leg would otherwise miss: the fact
    // reached the screen and the gesture never did.
    const still = BEAT_ORDER.filter((k) => all.seen[k] && all.anims[k] && all.anims[k].every((a) => !a || a === 'none'));
    if (still.length) problems.push(`${size.name}: ${still.join(', ')} mounted but no animation ran on it — the node is there and the gesture is not`);
    if (all.bad.length) problems.push(`${size.name}: an animation wears ${all.bad.join(', ')}, which is not a colour in engine.json elements`);
    fs.rmSync(beatsFile, { force: true });
  }

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
