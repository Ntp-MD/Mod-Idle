import { test, expect } from '@playwright/test';

const sample = 'http://localhost:5173/__showcase?sample=magic-aoe&sprite-preview=pawn#showcase-field';

test('Meteor showcase uses the live combat arena and its scale', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(sample, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-combat-arena]')).toHaveCount(1);
  await expect(page.getByLabel('Skill cast in the arena')).toHaveValue('attack.meteor');
  const player = page.locator('[data-arena-actor="player"] .arena-body');
  await expect(player).toBeVisible();
  await page.getByRole('button', { name: 'Cast at focus' }).click();
  await expect(page.locator('.skill-geometry[data-skill-id="attack.meteor"]:not([data-skill-phase="aim"])').first()).toBeAttached();
  const scale = page.getByLabel('World scale in the arena');
  const setScale = async (value: number) => scale.evaluate((input, factor) => {
    (input as HTMLInputElement).value = String(factor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await setScale(.5);
  const small = (await player.boundingBox())!.width;
  await setScale(1);
  await expect.poll(async () => (await player.boundingBox())!.width / small).toBeCloseTo(2, 1);
  await expect(page.locator('[data-arena-actor="player"]')).not.toHaveAttribute('data-animation-source', 'icon');
  expect(errors).toEqual([]);
});

test('the Meteor preset and the normal field use the same player art and body size', async ({ page }) => {
  const measure = async (url: string) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const player = page.locator('[data-arena-actor="player"]');
    await expect(player).not.toHaveAttribute('data-animation-source', 'icon');
    const body = player.locator('.arena-body');
    const image = player.locator('.arena-sprite:not(.arena-sprite-pending) image').first();
    await expect(image).toBeAttached();
    return { width: (await body.boundingBox())!.width, href: await image.getAttribute('href') };
  };
  const normal = await measure('http://localhost:5173/__showcase?sample=combat-field&skill=attack.meteor&sprite-preview=pawn#showcase-field');
  const meteor = await measure(sample);
  expect(meteor.width).toBeCloseTo(normal.width, 1);
  expect(meteor.href).toBe(normal.href);
});
