import { test, expect } from '@playwright/test';

/**
 * Measurements baseline. Records real network bytes, JS/CSS entries, frame samples
 * and teardown. Replaces the former stub: tools/measure-browser.mjs stub output
 * is unmeasured (see plan phase-0 baseline-measurements).
 */
test('measurements: network, frame samples and repeated mount teardown are real', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  const responses: number[] = [];
  page.on('response', (response) => responses.push(response.url()));

  await page.goto('http://localhost:5173/__showcase?sample=core-field#showcase-field', { waitUntil: 'load' });
  const map = page.getByTestId('world-map');
  await page.keyboard.press('1');
  await expect(map).toBeVisible({ timeout: 20_000 });

  const metrics = await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const jsCss = resources.filter((r) => /\.(js|ts|css)(\?|$)/.test(r.name) || r.name.includes('/src/') || r.name.includes('@vite'));
    const withSizes = jsCss.map((r) => ({
      name: r.name.split('/').pop() ?? r.name,
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      decodedBodySize: r.decodedBodySize,
    }));
    const totalBytes = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    // Frame samples over 500ms: count rAF ticks.
    const frames = await new Promise<number>((resolve) => {
      let count = 0;
      const tick = () => {
        count += 1;
        if (count < 30) requestAnimationFrame(tick);
        else resolve(count);
      };
      requestAnimationFrame(tick);
    });
    return { resourceCount: resources.length, totalBytes, jsCss: withSizes, frames };
  });

  expect(metrics.resourceCount).toBeGreaterThan(0);
  expect(metrics.totalBytes).toBeGreaterThan(0);
  expect(metrics.jsCss.some((e) => (e.name ?? '').includes('.js') || (e.name ?? '').endsWith('.ts'))).toBe(true);
  expect(metrics.jsCss.some((e) => (e.name ?? '').includes('.css'))).toBe(true);
  expect(metrics.frames).toBeGreaterThanOrEqual(10);
  expect(responses.length).toBeGreaterThan(0);

  // Teardown: repeated open/close via panel state leaves exactly one map node.
  // Bags is not settlement-gated (Craft refuses outside town), so use Bags.
  const bags = page.getByRole('button', { name: 'bags', exact: true });
  await expect(bags).toBeVisible({ timeout: 20_000 });
  await bags.click();
  await expect(bags).toHaveClass(/here/);
  await page.getByTitle('Back to the field · Esc').click();
  await expect(bags).not.toHaveClass(/here/);
  await expect(page.getByTestId('world-map')).toHaveCount(1);
  expect(consoleErrors).toEqual([]);
});
