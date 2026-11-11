import { test, expect } from '@playwright/test';

// A7: sprite readiness separates metadata from bytes. While bytes/decode are
// pending the icon fallback stays; failures keep the fallback; a version
// switch never moves actors or the playhead.
test('slow sprites keep fallback icons until bytes decode, without moving time', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/combat\/(?:arpg|mob-pool)\//, route => setTimeout(() => route.continue(), 2500));
  await page.goto('http://localhost:5173/__showcase?sample=combat-field&sprite-preview=fallback#showcase-field');

  const mode = page.getByLabel('Mob rendering mode in the arena');
  await expect(mode).toHaveValue('fallback');
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.locator('[data-combat-arena]').evaluate(element => {
    (element as HTMLElement).style.height = `${element.getBoundingClientRect().height}px`;
  });
  const playhead = page.getByRole('slider', { name: 'Arena animation time' });
  const timeBefore = await playhead.inputValue();
  const actors = page.locator('.arena-actor');
  const total = await actors.count();
  expect(total).toBeGreaterThan(0);

  await mode.selectOption('sprite');
  // Pending: sheets are chosen but no bytes decoded yet, so every actor reads icon.
  await expect.poll(async () => actors.evaluateAll(nodes =>
    nodes.filter(node => node.getAttribute('data-animation-source') === 'icon').length)).toBe(total);
  // Loaded: sprites replace the fallback without touching identity or time.
  await expect.poll(async () => actors.evaluateAll(nodes =>
    nodes.filter(node => node.getAttribute('data-animation-source') !== 'icon').length)).toBeGreaterThan(0);
  expect(await playhead.inputValue()).toBe(timeBefore);
  expect(errors).toEqual([]);
});

test('corrupt sprite bytes keep fallback icons with the same actors and time', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/combat\/(?:arpg|mob-pool)\//,
    route => route.fulfill({ status: 200, contentType: 'image/png', body: 'not a png at all' }));
  await page.goto('http://localhost:5173/__showcase?sample=combat-field&sprite-preview=fallback#showcase-field');

  const mode = page.getByLabel('Mob rendering mode in the arena');
  await expect(mode).toHaveValue('fallback');
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.locator('[data-combat-arena]').evaluate(element => {
    (element as HTMLElement).style.height = `${element.getBoundingClientRect().height}px`;
  });
  const playhead = page.getByRole('slider', { name: 'Arena animation time' });
  const timeBefore = await playhead.inputValue();
  const actors = page.locator('.arena-actor');
  const ids = await actors.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-arena-actor')));
  expect(ids.length).toBeGreaterThan(0);

  await mode.selectOption('sprite');
  await expect.poll(async () => actors.evaluateAll(nodes =>
    nodes.filter(node => node.getAttribute('data-animation-source') !== 'icon').length)).toBe(0);
  expect(await actors.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-arena-actor'))))
    .toEqual(expect.arrayContaining(ids));
  expect(await playhead.inputValue()).toBe(timeBefore);
  expect(errors).toEqual([]);
});

test('vfx version switch keeps actor sources and time', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5173/__showcase?sample=combat-field&sprite-preview=fallback#showcase-field');

  const mode = page.getByLabel('Mob rendering mode in the arena');
  const vfx = page.getByLabel('Preview VFX art in the arena');
  await page.getByRole('button', { name: 'Pause game' }).click();
  const playhead = page.getByRole('slider', { name: 'Arena animation time' });
  await mode.selectOption('sprite');
  await expect.poll(async () => page.locator('.arena-actor')
    .evaluateAll(nodes => nodes.filter(node => node.getAttribute('data-animation-source') !== 'icon').length))
    .toBeGreaterThan(0);
  const timeBefore = await playhead.inputValue();
  const sources = await page.locator('.arena-actor').evaluateAll(
    nodes => nodes.map(node => node.getAttribute('data-animation-source')));

  const skinVersion = await vfx.inputValue();
  await vfx.selectOption('base');
  await expect.poll(() => vfx.inputValue()).toBe('base');
  expect(await page.locator('.arena-actor').evaluateAll(
    nodes => nodes.map(node => node.getAttribute('data-animation-source')))).toEqual(sources);
  expect(await playhead.inputValue()).toBe(timeBefore);
  await vfx.selectOption(skinVersion);
  await expect.poll(() => vfx.inputValue()).toBe(skinVersion);
  expect(await playhead.inputValue()).toBe(timeBefore);
  expect(errors).toEqual([]);
});
