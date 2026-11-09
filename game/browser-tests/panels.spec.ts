import { test, expect } from '@playwright/test';

/**
 * Panels baseline. Uses showcase samples (isolated storage, existing samples only).
 * WorldMap is always mounted (App WorldMap visible=true) and in showcaseMode
 * every Panel is mounted (App: `{#if panel==='x' || showcaseMode}`), so open/close
 * is asserted on panel state (.here on the rail control), not on mount count.
 * Map keyboard/focus is asserted via the announcement node.
 * Showcase mode bypasses the global Escape owner, so close uses the rail fallback.
 */
const CORE = 'http://localhost:5173/__showcase?sample=core-field#showcase-field';
const READONLY = 'http://localhost:5173/__showcase?sample=read-only#showcase-field';

test('panels: keyboard selection announces; Bags opens and Field closes', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  await page.goto(CORE, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('1');
  const map = page.getByTestId('world-map');
  await expect(map).toBeVisible({ timeout: 20_000 });
  const cells = map.locator('polygon.cell[data-ax]');
  await expect.poll(async () => cells.count()).toBeGreaterThan(50);

  const aloud = map.locator('.aloud');
  const side = map.locator('polygon.cell[data-zone="1"][data-sub="0"]').first();
  await side.dispatchEvent('click');
  await page.waitForTimeout(140);
  await side.dispatchEvent('click');
  await expect(aloud).toContainText('Selected block');
  const firstSelection = (await aloud.textContent())?.trim() ?? '';
  expect(firstSelection).toContain('Selected block');

  await map.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await aloud.textContent())?.trim() ?? '').not.toBe(firstSelection);

  // Panel open/close via panel state: the Bags rail control carries .here while open.
  // Craft is settlement-gated and refuses outside town, so use Bags instead.
  // Global screen shortcuts are ignored in showcaseMode (App onfieldKey), so click the rail.
  const bags = page.getByRole('button', { name: 'bags', exact: true });
  await expect(bags).toBeVisible({ timeout: 20_000 });
  await bags.click();
  await expect(bags).toHaveClass(/here/);
  await page.getByTitle('Back to the field · Esc').click();
  await expect(bags).not.toHaveClass(/here/);
  expect(consoleErrors).toEqual([]);
});

test('panels: rail button opens map mode and Save stays disabled in showcase', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(CORE, { waitUntil: 'domcontentloaded' });
  const openMap = page.getByTestId('open-world-map');
  await expect(openMap).toBeVisible({ timeout: 20_000 });
  await openMap.click();
  const mapBtn = page.getByRole('button', { name: 'map', exact: true });
  await expect(mapBtn).toHaveClass(/here/);
  const map = page.getByTestId('world-map');
  await expect(map).toBeVisible({ timeout: 20_000 });
  const cells = map.locator('polygon.cell[data-ax]');
  await expect.poll(async () => cells.count()).toBeGreaterThan(50);

  // Settlement-gated commands refuse outside town (core-field stands on bare ground).
  await page.getByRole('button', { name: 'craft', exact: true }).click();
  await expect(page.getByText(/settlement service/).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Save, load, backup, import, and export are disabled here.')).toBeVisible({ timeout: 10_000 });
});

test('panels: read-only sample refuses writes (New character disabled)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(READONLY, { waitUntil: 'domcontentloaded' });
  const fresh = page.getByRole('button', { name: 'New character', exact: true });
  await expect(fresh).toBeVisible({ timeout: 20_000 });
  await expect(fresh).toBeDisabled();
});
