// Headless native-scene review, one 1920 x 1080 tab at a time.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../..');
const { chromium } = require(path.join(root, 'game/node_modules/@playwright/test'));
const source = path.join(root, 'docs/vfx-skill/component-vfx/outputs/library-v4');
const recipes = JSON.parse(fs.readFileSync(path.join(source, 'recipes.json')));
const capture = path.join(root, 'docs/vfx-skill/component-vfx/evidence/captures/materials');
const nextFrame = page => page.evaluate(() => new Promise(requestAnimationFrame));

(async () => {
  fs.mkdirSync(capture, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const recordPath = path.join(source, 'native-review.json');
  const results = process.argv.includes('--resume') && fs.existsSync(recordPath)
    ? JSON.parse(fs.readFileSync(recordPath)).filter(r => r.errors.length === 0 && r.expected.every(shape => r.seen.includes(shape))) : [];
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await page.goto('http://localhost:5173/__showcase?sample=combat-field#showcase-field', { waitUntil: 'domcontentloaded' });
    for (const [skill, recipe] of Object.entries(recipes)) {
      if (results.some(r => r.skill === skill)) continue;
      errors = [];
      await page.getByLabel('Skill cast in the arena').selectOption(skill);
      await page.getByLabel('Preview VFX version in the arena').selectOption('version:pool-' + recipe.version);
      await page.getByLabel('World scale in the arena').evaluate(input => { input.value = '1'; input.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.getByRole('button', { name: 'Replay encounter', exact: true }).click();
      if (skill.startsWith('buff.')) {
        const selector = `[data-vfx-version="pool-${recipe.version}"][data-skill-art="${skill}"], [data-vfx-version="pool-${recipe.version}"] [data-skill-art="${skill}"]`;
        await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10000 });
        await page.waitForFunction(({version, count}) => [...document.querySelectorAll(`[data-vfx-version="pool-${version}"][data-vfx-layer]`)].filter(n => n.querySelector('[data-skill-art]')).length >= count,
          { version: recipe.version, count: recipe.shapes.length }, { timeout: 10000 });
        const time = await page.getByLabel('Arena animation time').evaluate(input => { const t = Number(input.value); input.dispatchEvent(new Event('input', { bubbles: true })); return t; });
        await nextFrame(page);
        const seen = await page.locator(`[data-vfx-version="pool-${recipe.version}"][data-vfx-layer]`).evaluateAll(nodes => nodes.filter(n => n.querySelector('[data-skill-art]')).map(n => n.getAttribute('data-vfx-layer')));
        await page.screenshot({ path: path.join(capture, skill + '.png') });
        const record = { skill, version: recipe.version, seen, expected: recipe.shapes, time, errors };
        results.push(record);
        fs.writeFileSync(recordPath, JSON.stringify(results, null, 2) + '\n');
        console.log(JSON.stringify(record));
        assert.equal(errors.length, 0, `${skill}: browser errors`);
        continue;
      }
      const step = page.getByRole('button', { name: 'Advance simulation 1s', exact: true });
      await step.click();
      if (skill === 'attack.void_ray') {
        await page.getByRole('button', { name: 'Cast at focus', exact: true }).focus();
        await page.keyboard.down('Space');
      }
      for (let i = 0; i < 4; i++) await step.click();
      if (skill === 'attack.void_ray') await page.keyboard.up('Space');
      const timeline = page.getByLabel('Arena animation time');
      const min = Number(await timeline.getAttribute('min'));
      const max = Number(await timeline.getAttribute('max'));
      const seen = new Set();
      let best = { layers: [], time: min };
      const selector = `[data-vfx-version="pool-${recipe.version}"][data-vfx-layer]`;
      const timing = (await page.getByLabel('Arena effect timing').textContent()).match(/\d+\.\d+/g);
      const times = [];
      if (timing?.length === 3) {
        const [start, release, impact] = timing.map(Number);
        times.push((release+impact)*500000, (impact+.1)*1000000);
      }
      for (let time = min; time <= max; time += 80000) times.push(time);
      for (const time of times.filter(t => t >= min && t <= max)) {
        await timeline.evaluate((input, t) => { input.value = String(t); input.dispatchEvent(new Event('input', { bubbles: true })); }, time);
        await nextFrame(page);
        const layers = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => {
          const art = n.querySelector('[data-skill-art]');
          if (!art) return false;
          const box = art.getBoundingClientRect();
          let opacity = 1;
          for (let p = art; p; p = p.parentElement) opacity *= Number(getComputedStyle(p).opacity);
          return box.width > 1 && box.height > 1 && opacity > .01;
        }).map(n => n.getAttribute('data-vfx-layer')));
        layers.forEach(l => seen.add(l));
        if (layers.length > best.layers.length) best = { layers, time };
        if (recipe.shapes.every(shape => seen.has(shape))) break;
      }
      await timeline.evaluate((input, t) => { input.value = String(t); input.dispatchEvent(new Event('input', { bubbles: true })); }, best.time);
      await nextFrame(page);
      await page.screenshot({ path: path.join(capture, skill + '.png') });
      const record = { skill, version: recipe.version, seen: [...seen], expected: recipe.shapes, time: best.time, errors };
      results.push(record);
      fs.writeFileSync(path.join(source, 'native-review.json'), JSON.stringify(results, null, 2) + '\n');
      console.log(JSON.stringify(record));
      assert.equal(errors.length, 0, `${skill}: browser errors`);
      assert.ok(seen.size, `${skill}: no visible native art`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
