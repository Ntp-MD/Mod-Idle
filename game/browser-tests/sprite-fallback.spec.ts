import { test, expect } from '@playwright/test';

test('showcase field switches between sprite animations and fallback icons', async ({ page }) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto('http://localhost:5173/__showcase?sample=combat-field&sprite-preview=fallback#showcase-field');

  const mode = page.getByLabel('Mob rendering mode in the arena');
  const actors = page.locator('.arena-actor');
  await expect(mode).toBeVisible();
  await expect(mode).toHaveValue('fallback');
  await page.getByRole('button', { name: 'Pause game' }).click();
  // The skin toggle itself must not move anyone: freeze the painted viewport while
  // sprite review adds its showcase-only controls row, so the actor set cannot flap
  // on the cull boundary for layout reasons (same pattern as the failure-injection test).
  await page.locator('[data-combat-arena]').evaluate(element => {
    (element as HTMLElement).style.height = `${element.getBoundingClientRect().height}px`;
  });
  const playhead = page.getByRole('slider', { name: 'Arena animation time' });
  const timeBefore = await playhead.inputValue();
  const actorIds = await actors.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-arena-actor')));
  const fallbackCount = await page.locator('.arena-actor[data-animation-source="icon"]').count();
  expect(fallbackCount).toBeGreaterThan(0);
  await expect(page.locator('.arena-actor image[href*="/combat/arpg/"], .arena-actor image[href*="/combat/mob-pool/"]')).toHaveCount(0);

  await mode.selectOption('sprite');
  await expect.poll(() => actors.evaluateAll(nodes => nodes.filter(node => node.getAttribute('data-animation-source') !== 'icon').length))
    .toBeGreaterThan(0);
  // Sprite review adds controls and resizes the viewport; existing actors must stay.
  expect(await actors.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-arena-actor')))).toEqual(expect.arrayContaining(actorIds));
  expect(await playhead.inputValue()).toBe(timeBefore);
  expect(new URL(page.url()).searchParams.get('sprite-preview')).toBe('pawn');

  await mode.selectOption('fallback');
  await expect.poll(() => page.locator('.arena-actor[data-animation-source="icon"]').count()).toBe(fallbackCount);
  expect(await actors.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-arena-actor')))).toEqual(actorIds);
  expect(await playhead.inputValue()).toBe(timeBefore);
  expect(new URL(page.url()).searchParams.get('sprite-preview')).toBe('fallback');
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('live game and default showcase select the registered sprites', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://localhost:5173/');
  await expect(page.locator('.arena-actor.hero')).not.toHaveAttribute('data-animation-source', 'icon');
  await expect(page.locator('.arena-actor.hero .arena-sprite image[href*="/combat/arpg/"]').first()).toBeAttached();
  await expect(page.locator('[data-world-ground] image')).toHaveAttribute('href', /^\/map\/ground\/.+-floor\.webp$/);
  await page.goto('http://localhost:5173/__showcase?sample=combat-field#showcase-field');
  await expect(page.getByLabel('Mob rendering mode in the arena')).toHaveValue('sprite');
  await expect(page.locator('.arena-actor.hero')).not.toHaveAttribute('data-animation-source', 'icon');
  await expect(page.locator('.arena-actor.hero .arena-sprite image[href*="/combat/arpg/"]').first()).toBeAttached();
  expect(errors).toEqual([]);
});

test('live game keeps the player fallback when sprite files fail', async ({ page }) => {
  let failedRequests = 0;
  await page.route(/\/combat\/(?:arpg|mob-pool)\//, route => {
    failedRequests++;
    return route.fulfill({ status: 404, body: 'missing sprite' });
  });
  await page.goto('http://localhost:5173/');
  const hero = page.locator('.arena-actor.hero');
  await expect(hero).toBeAttached();
  await expect.poll(() => failedRequests).toBeGreaterThan(0);
  await expect(hero).toHaveAttribute('data-animation-source', 'icon');
  await expect(hero.locator('.arena-sprite image[href*="/combat/arpg/"]')).toHaveCount(0);
});

test('sprite loading failure retains the same actors with fallback icons', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/combat\/(?:arpg|mob-pool)\//, route => route.fulfill({ status: 404, body: 'missing sprite' }));
  await page.goto('http://localhost:5173/__showcase?sample=combat-field&sprite-preview=fallback#showcase-field');
  const mode = page.getByLabel('Mob rendering mode in the arena');
  await expect(mode).toHaveValue('fallback');
  // Keep the field viewport fixed while sprite review adds another row of controls.
  await page.locator('[data-combat-arena]').evaluate(element => {
    (element as HTMLElement).style.height = `${element.getBoundingClientRect().height}px`;
  });
  await page.getByRole('button', { name: 'Pause game' }).click();
  const playhead = page.getByRole('slider', { name: 'Arena animation time' });
  await playhead.evaluate(element => {
    const input = element as HTMLInputElement;
    input.value = input.max;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const timeBefore = await playhead.inputValue();
  const groundBefore = await page.locator('[data-world-ground]').getAttribute('viewBox');
  const actors = page.locator('.arena-actor');
  const ids = await actors.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-arena-actor')));
  expect(ids.length).toBeGreaterThan(0);
  await mode.selectOption('sprite');
  await expect.poll(() => actors.evaluateAll(nodes => nodes.filter(node => node.getAttribute('data-animation-source') !== 'icon').length)).toBe(0);
  const afterIds = await actors.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-arena-actor')));
  expect(afterIds).toEqual(expect.arrayContaining(ids));
  expect(await playhead.inputValue()).toBe(timeBefore);
  await expect(page.locator('[data-world-ground]')).toHaveAttribute('viewBox', groundBefore!);
  await expect(page.locator('.arena-actor .arena-sprite image')).toHaveCount(afterIds.length);
  expect(errors).toEqual([]);
});
