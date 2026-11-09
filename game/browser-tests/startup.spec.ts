import { test, expect } from '@playwright/test';

/**
 * Startup baseline (production build). Boot must not show a Save chooser
 * while slot saves are disabled (TEMP_DISABLE_SLOT_SAVES = true).
 * Wire: playwright production project serves vite preview on 4173.
 */
test('startup: production boot skips Save chooser, slot saves stay off', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  // Shell: the field fallback button is part of the hub rail.
  await expect(page.getByTitle('Back to the field · Esc')).toBeVisible({ timeout: 30_000 });
  // No slot Save chooser at boot while TEMP_DISABLE_SLOT_SAVES = true.
  await expect(page.getByText('Load a character, or start a new one.')).toHaveCount(0);
  // Save panel explains the temporary decision and keeps slot actions disabled.
  // Keyboard 's' is arena-context here, so open via the rail: More, then Save.
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'save', exact: true }).click();
  await expect(page.getByText('Slot saves are off until the game is finished.')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Save slot/ }).first()).toBeDisabled();
  expect(consoleErrors).toEqual([]);
});
