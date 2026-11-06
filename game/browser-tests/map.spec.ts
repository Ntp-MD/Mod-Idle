import { test, expect } from '@playwright/test';

/**
 * P0/P7 real map interaction. Replaces the old placeholder: the page must load, the map must index
 * real SVG cells, selection/keyboard/pan/zoom/orbit must change observable state and a resource
 * destination must expose its primary action without console errors.
 */
const SHOWCASE = 'http://localhost:5173/__showcase?sample=read-only#showcase-field';

test('map: selection, camera, keyboard and resource destinations are real', async ({ page }) => {
  test.setTimeout(150_000);
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  await page.goto(SHOWCASE, { waitUntil: 'domcontentloaded' });
  // The rail can start collapsed; its documented keyboard action opens the map without it.
  await page.keyboard.press('1');

  const map = page.getByTestId('world-map');
  await expect(map).toBeVisible({ timeout: 20_000 });
  const cells = map.locator('polygon.cell[data-ax]');
  await expect.poll(async () => cells.count()).toBeGreaterThan(50);
  expect(await cells.count()).toBeGreaterThan(50);

  // Select the first authored Zone 1 side: the selection owner must announce it.
  const side = map.locator('polygon.cell[data-zone="1"][data-sub="0"]').first();
  // The first ground click sharpens the sheet; the next one picks the cell.
  await side.dispatchEvent('click');
  await page.waitForTimeout(140);
  await side.dispatchEvent('click');
  const aloud = map.locator('.aloud');
  await expect(aloud).toContainText('Selected block');
  const firstSelection = (await aloud.textContent())?.trim() ?? '';
  expect(firstSelection).toContain('Selected block');

  // Journey opens for the same selection and reads a real level line.
  const destination = page.locator('section.dest');
  await expect(destination).toBeVisible();
  await expect(destination).toContainText(/Lv \d+/);

  // Arrow keys move selection to a real neighbor; Enter is one activation, not a stream.
  await map.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await aloud.textContent())?.trim() ?? '').not.toBe(firstSelection);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);

  // Pan changes the sheet transform; zoom changes it again.
  const sheet = map.locator('.map-sheet');
  const beforePan = await sheet.getAttribute('style');
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => sheet.getAttribute('style')).not.toBe(beforePan);

  const beforeZoom = await sheet.getAttribute('style');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => sheet.getAttribute('style')).not.toBe(beforeZoom);

  // Ctrl-drag orbits the fixed perspective; the rotation readout is the observable owner.
  const rotation = page.locator('input[aria-label="Map rotation angle"]');
  const beforeOrbit = await rotation.inputValue();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Control');
  await expect.poll(async () => rotation.inputValue()).not.toBe(beforeOrbit);

  // A resource site keeps its authored action in the destination card.
  const mine = map.locator('polygon.cell[data-site="mine"]').first();
  await mine.dispatchEvent('click');
  await expect(destination).toBeVisible();
  const primary = destination.locator('.dest-actions button').first();
  await expect(primary).toBeVisible();
  expect(((await primary.getAttribute('aria-label')) ?? '').length).toBeGreaterThan(0);

  // Keyboard selection must not be lost over the map surface.
  await expect(map).toHaveAttribute('role', 'application');

  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
});

test('map renderer: one index, one flush per frame, camera-only work', async ({ page }) => {
  await page.goto(SHOWCASE, { waitUntil: 'domcontentloaded' });
  const counts = await page.evaluate(async () => {
    const { createMapRenderer } = await import('/src/ui/map/map.ts');
    const { buildMapPaintModel } = await import('/src/ui/map/map-view-model.ts');
    const { newGame } = await import('/src/sim/core/game.ts');
    const source = document.querySelector('[data-testid="world-map"] svg');
    if (!source) throw new Error('no source svg');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-4000px;top:0;width:1400px;height:900px';
    const svg = source.cloneNode(true) as SVGSVGElement;
    host.append(svg);
    document.body.append(host);
    const work: string[] = [];
    const renderer = createMapRenderer(host, (event) => work.push(event));
    const state = newGame(7);
    const options = { view: 'terrain' as const, gateLevel: 1, showIds: false, showWalk: false, townId: state.town.waypoint, showNames: true, cleanMap: false, showHexCalibration: false };
    const model = () => buildMapPaintModel({ state, cells: renderer.cells, selected: null, options });
    const camera = { panX: 0, panY: 0, zoom: 2.4, bearing: 0 };
    renderer.updateModel(model());
    renderer.updateCamera(camera);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const afterFirst = { index: work.filter((e) => e === 'index').length, flush: work.filter((e) => e === 'flush').length, sorted: work.filter((e) => e === 'depth-sort').length };
    const queued = work.length;
    renderer.updateModel(model());
    renderer.updateModel(model());
    renderer.updateModel(model());
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const batch = work.slice(queued);
    const before = work.length;
    renderer.updateCamera({ ...camera, panX: 80 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const panOnly = work.slice(before);
    const beforeZoom = work.length;
    renderer.updateCamera({ ...camera, panX: 80, zoom: 2.6 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const zoomOnly = work.slice(beforeZoom);
    const beforeBearing = work.length;
    renderer.updateCamera({ ...camera, panX: 80, zoom: 2.6, bearing: 90 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const orbit = work.slice(beforeBearing);
    renderer.setVisible(false);
    const hiddenBefore = work.length;
    renderer.updateCamera({ ...camera, bearing: 45 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const hiddenWork = work.slice(hiddenBefore);
    const showBefore = work.length;
    renderer.setVisible(true);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const showWork = work.slice(showBefore);
    renderer.destroy();
    renderer.destroy();
    renderer.updateCamera(camera);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    host.remove();
    return { afterFirst, batch, panOnly, zoomOnly, orbit, hiddenWork, showWork };
  });
  expect(counts.afterFirst.index).toBe(1);
  expect(counts.afterFirst.flush).toBeGreaterThan(0);
  expect(counts.panOnly).not.toContain('index');
  expect(counts.panOnly).not.toContain('depth-sort');
  expect(counts.zoomOnly).not.toContain('index');
  expect(counts.orbit).toContain('depth-sort');
  expect(counts.hiddenWork).toHaveLength(0);
  expect(counts.batch.filter((event) => event === 'flush')).toHaveLength(1);
  expect(counts.showWork.filter((event) => event === 'flush')).toHaveLength(1);
});
