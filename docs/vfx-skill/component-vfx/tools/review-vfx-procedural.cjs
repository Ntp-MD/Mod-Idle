// One native field tab at 1920x1080; freeze the observed frame before recording it.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../..');
const { chromium } = require(path.join(root, 'game/node_modules/@playwright/test'));
const output = path.join(root, 'docs/vfx-skill/component-vfx/outputs/animated');
const captures = path.join(root, '.cache/vfx-3d');

(async () => {
  fs.mkdirSync(captures, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  const results = [];
  try {
    for (const component of ['charge-gather', 'motion-trail', 'contact-flash', 'shield-ripple', 'body-coating']) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('response', response => {
        if (response.url().includes(`/animated/${component}/`)) requests.push({ status: response.status(), src: response.url().split('/outputs/animated/')[1] });
      });
      try {
        await page.goto(`http://127.0.0.1:5173/__showcase?sample=vfx-${component}#showcase-field`, { timeout: 60000 });
        const selected = page.getByLabel('Preview VFX art in the arena');
        await selected.waitFor({ timeout: 45000 });
        assert.equal(await selected.inputValue(), `version:review-${component}`);
        await page.waitForFunction(id => {
          const frame = [...document.querySelectorAll(`[data-vfx-layer="${id}"] [data-atlas-frame]`)]
            .find(node => Number(node.getAttribute('data-atlas-frame')) >= 4 && Number(node.getAttribute('data-atlas-frame')) <= 18);
          const timeline = document.querySelector('input[aria-label="Arena animation time"]');
          if (!frame || !timeline) return false;
          timeline.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }, component, { timeout: 30000 });
        await page.evaluate(() => new Promise(requestAnimationFrame));
        const actual = await page.locator(`[data-vfx-layer="${component}"]`).evaluateAll(rows => rows.flatMap(row => {
          const art = row.querySelector('[data-skill-art]'), atlas = art?.querySelector('[data-atlas-frame]');
          if (!art || !atlas) return [];
          const bounds = art.getBoundingClientRect();
          return [{ src: row.getAttribute('data-skill-art-source').split('/outputs/animated/')[1],
            phase: art.getAttribute('data-skill-art-phase'), frame: Number(atlas.getAttribute('data-atlas-frame')),
            transform: art.getAttribute('transform'), width: bounds.width, height: bounds.height }];
        }));
        assert.ok(actual.some(row => row.frame >= 4 && row.frame <= 18 && row.width > 1 && row.height > 1), `${component}: no frozen active atlas`);
        const snapshot = await selected.ariaSnapshot();
        assert.ok(snapshot.includes(`3D review: ${component}`));
        await page.screenshot({ path: path.join(captures, `native-${component}.png`) });
        let reducedMotionPoster = null;
        if (component === 'charge-gather') {
          await page.getByLabel('Arena motion preview', { exact: true }).selectOption('reduced');
          reducedMotionPoster = await page.locator(`[data-vfx-layer="${component}"] [data-atlas-frame]`).first().getAttribute('data-atlas-frame');
          assert.equal(reducedMotionPoster, '9');
        }
        assert.ok(requests.length > 0);
        assert.equal(requests.filter(request => request.status >= 400).length, 0);
        assert.deepEqual(errors, []);
        const report = { component, viewport: [1920, 1080], renderer: 'CombatArenaScene',
          actual, atlasRequestCount: requests.length, failedRequests: [], errors, reducedMotionPoster,
          sourceSha256: JSON.parse(fs.readFileSync(path.join(output, component, 'meta.json'))).sourceSha256,
          attachmentAcceptance: ['motion-trail', 'body-coating'].includes(component) ? 'pending' : 'not-required', humanApproval: 'pending' };
        results.push(report);
        fs.writeFileSync(path.join(output, 'native-review.json'), JSON.stringify(results, null, 2) + '\n');
        console.log(`PASS NATIVE ${component}: frozen active frame, camera atlas, 1920x1080, zero errors`);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
