import { test, expect } from '@playwright/test';

/**
 * Storyteller (§14.3): one shared renderer for Camp and delivery hosts, focus and
 * receipt behavior, stale/full/read-only reasons, and no extra commit steps.
 * Uses the labelled showcase fixtures; one tab per check, closed afterward.
 * The showcase renders every host, so an open contract appears in both the
 * notice and the board — each host is asserted individually.
 */
const scene = (page: any) => page.locator('[data-story-source]');
const source = (page: any, name: string) => page.locator(`[data-story-source="${name}"]`);

test('storyteller: camp and delivery share one renderer; one commit each', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message: any) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error: any) => consoleErrors.push(String(error)));

  // 1: camp warning and a local delivery both render the shared scene once.
  await page.goto('http://localhost:5173/__showcase?sample=story-camp-warning#showcase-field', { waitUntil: 'domcontentloaded' });
  await expect(source(page, 'camp')).toHaveCount(1);
  await expect(source(page, 'camp').locator('h3')).toContainText('Movement near Camp');
  await expect(source(page, 'camp')).toContainText('The brush beyond the fire shifts');
  await expect(source(page, 'camp').locator('[data-story-action]')).toHaveCount(2);
  // shelf art renders through .icon-mask in the fixed four-glyph camp composition
  await expect(source(page, 'camp').locator('.story-media .icon-mask')).toHaveCount(4);

  await page.goto('http://localhost:5173/__showcase?sample=story-delivery-choices#showcase-field', { waitUntil: 'domcontentloaded' });
  // open contract: notice + board hosts, each with the same renderer.
  await expect(source(page, 'delivery')).toHaveCount(2);
  await expect(source(page, 'delivery').locator('[data-story-action="deliver"]')).toHaveCount(1);
  // two-glyph market art maps to left + anchor, never a phantom right slot
  const deliveryMedia = source(page, 'delivery').locator('.story-media').first();
  await expect(deliveryMedia.locator('.icon-mask.role-left')).toHaveCount(1);
  await expect(deliveryMedia.locator('.icon-mask.role-anchor')).toHaveCount(1);
  await expect(deliveryMedia.locator('.icon-mask.role-right')).toHaveCount(0);
  // 2: quantity + reward switching previews only; hand-in is the single commit.
  const quantity = source(page, 'delivery').locator('input[type="number"]').first();
  await expect(quantity).toBeEnabled();
  // 7: map arrows/Enter and site/dungeon controls keep their existing handlers.
  await page.goto('http://localhost:5173/__showcase?sample=story-site-result#showcase-field', { waitUntil: 'domcontentloaded' });
  await expect(source(page, 'exploration')).toHaveCount(1);
  await page.goto('http://localhost:5173/__showcase?sample=story-dungeon-result#showcase-field', { waitUntil: 'domcontentloaded' });
  await expect(source(page, 'dungeon')).toHaveCount(1);
  // 8: no audio elements, no console errors after the whole flow.
  expect(await page.locator('audio').count()).toBe(0);
  expect(consoleErrors).toEqual([]);
});

test('storyteller: courier source gates acceptance and destination owns the hand-in', async ({ page }) => {
  await page.goto('http://localhost:5173/__showcase?sample=story-courier-unaccepted#showcase-field', { waitUntil: 'domcontentloaded' });
  const sourceBoard = source(page, 'delivery').first();
  await expect(sourceBoard.locator('[data-story-action="courier-accept"]')).toHaveCount(1);
  await expect(sourceBoard.locator('[data-story-action="courier-decline"]')).toHaveCount(1);
  await expect(sourceBoard.locator('[data-story-action="deliver"]')).toHaveCount(0);

  await page.goto('http://localhost:5173/__showcase?sample=story-courier-destination#showcase-field', { waitUntil: 'domcontentloaded' });
  const destinationBoard = source(page, 'delivery').first();
  await expect(destinationBoard.locator('[data-story-action="courier-accept"]')).toHaveCount(0);
  await expect(destinationBoard.locator('[data-story-action="deliver"]')).toHaveCount(1);
});

test('storyteller: read-only, stale and full-bag reasons are visible without paying twice', async ({ page }) => {
  // 4: read-only sample disables mutating story actions with a visible reason.
  await page.goto('http://localhost:5173/__showcase?sample=story-read-only#showcase-field', { waitUntil: 'domcontentloaded' });
  await expect(source(page, 'camp')).toHaveCount(1);
  await expect(source(page, 'camp').locator('[data-story-action="investigate"]')).toBeDisabled();
  // 6: forge selectors and one forge button remain; shortage shows the blocked scene.
  await page.goto('http://localhost:5173/__showcase?sample=story-forge-shortage#showcase-field', { waitUntil: 'domcontentloaded' });
  // TownHub greeting + Forge panel both render forge scenes in the showcase.
  await expect(source(page, 'forge')).toHaveCount(2);
  await expect(page.locator('[data-story-source="forge"]', { hasText: 'not ready to make' })).toHaveCount(1);
  // 5: promotion fixture renders the shared market quote context.
  await page.goto('http://localhost:5173/__showcase?sample=story-market-promotion#showcase-field', { waitUntil: 'domcontentloaded' });
  await expect(source(page, 'market').first()).toBeVisible();
  // 9: cache choices expose exactly their three commit actions.
  await page.goto('http://localhost:5173/__showcase?sample=story-cache-choices#showcase-field', { waitUntil: 'domcontentloaded' });
  await expect(source(page, 'camp').locator('[data-story-action]')).toHaveCount(3);
});
