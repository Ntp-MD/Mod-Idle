import { test, expect } from '@playwright/test';

test('Whirlwind blades follow a circular path on the ground plane', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://localhost:5173/__showcase?sample=combat-field&skill=attack.whirlwind&vfx=base#showcase-field');
  const blade = page.locator('.skill-geometry[data-skill-id="attack.whirlwind"] .vfx-blade').first();
  await expect(blade).toBeAttached({ timeout: 30_000 });
  const radii = await blade.evaluate(element => {
    const path = element as SVGPathElement, length = path.getTotalLength();
    return Array.from({ length: 13 }, (_, i) => {
      const point = path.getPointAtLength(length * i / 12);
      return Math.hypot(point.x, point.y);
    });
  });
  expect(Math.max(...radii)).toBeGreaterThan(0);
  expect((Math.max(...radii) - Math.min(...radii)) / Math.max(...radii)).toBeLessThan(.002);
  expect(errors).toEqual([]);
});
