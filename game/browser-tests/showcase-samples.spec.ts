import { expect, test } from '@playwright/test';
import { SHOWCASE_SAMPLES } from '../src/app/showcase/samples';

const BASE = 'http://localhost:5173/__showcase';

test.use({ viewport: { width: 1920, height: 1080 } });

for (const sample of SHOWCASE_SAMPLES) {
  test(`sample ${sample} boots with the banner and no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`${BASE}?sample=${sample}#showcase-field`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Gameplay sample')).toHaveValue(sample);
    await expect(page.locator('#showcase-field')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to the game' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
