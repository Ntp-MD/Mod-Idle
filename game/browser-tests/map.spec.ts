import { test, expect } from '@playwright/test';

/**
 * P0/P7 real map interaction. Replaces the old placeholder: the page must load, the map must index
 * real SVG cells, selection/keyboard/pan/zoom must change observable state and a resource
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

  // Ctrl-drag pans too; the world always keeps north up.
  const board = map.locator('#projected-board');
  const beforeOrbit = await board.getAttribute('transform');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Control');
  await expect(board).toHaveAttribute('transform', beforeOrbit!);
  await expect(page.getByRole('slider', { name: 'Map rotation angle', exact: true })).toHaveCount(0);

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

test('map: in-hex content replaces floating labels and terrain stays on all six corners', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(String(error)));
  await page.goto(SHOWCASE, { waitUntil: 'domcontentloaded' });
  const map = page.getByTestId('world-map');
  await expect.poll(() => map.locator('.map-scene-cell').count()).toBeGreaterThan(50);
  await page.getByRole('button', { name: 'Map', exact: true }).first().click();
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  const standing = map.locator('polygon.cell.standing');
  const key = await standing.getAttribute('data-ax');
  await standing.dispatchEvent('pointermove', { pointerType: 'mouse' });
  const standingContent = map.locator(`[data-actor-ax="${key}"] .map-hex-content`);
  await expect(standingContent.locator('.hex-level')).toContainText(/Lv \d+/);
  await expect(standingContent.locator('[data-icon-role="town"]')).toHaveCount(1);
  await map.focus();
  await page.keyboard.press('ArrowRight');
  const selected = map.locator('polygon.cell.picked');
  const selectedKey = await selected.getAttribute('data-ax');
  await expect(map.locator(`[data-actor-ax="${selectedKey}"] .hex-level`)).toContainText(/Lv \d+/);
  await expect(map.locator('#map-names, .map-name, .map-name-stem, .map-marker-leader')).toHaveCount(0);
  await expect(map.locator('.map-scenery')).toHaveCount(0);
  await expect(map.locator('.map-marker, g.you, .actor-signals')).toHaveCount(0);
  await expect(map.locator('.diorama-art').first()).toBeHidden();
  await expect(map.locator('[data-icon-role="player"]')).toHaveCount(1);
  await expect(map.locator('polygon.cell[aria-current="location"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await expect(map.locator('#projected-board')).toHaveAttribute('transform', 'matrix(1 0 0 1 0 0)');
  for (const zoom of [null, 'Zoom in', 'Zoom out'] as const) {
    if (zoom) await page.getByRole('group', { name: 'Map zoom', exact: true }).getByRole('button', { name: zoom, exact: true }).click();
    await expect.poll(async () => {
      const result = await map.evaluate(async root => {
        const { layoutHexContent } = await import('/src/ui/map/map-content-layout.ts');
        const svg = root.querySelector('svg')!;
        let checked = 0, worst = 0;
        for (const figure of svg.querySelectorAll<SVGGElement>('.diorama-figure')) {
          const boundary = figure.querySelector<SVGPolygonElement>('.terrain-ground > polygon');
          if (!boundary || figure.closest('[display="none"]')) continue;
          const ax = figure.getAttribute('data-figure-ax');
          const ground = svg.querySelector<SVGPolygonElement>(`polygon.cell[data-ax="${ax}"]`)!;
          const artMatrix = boundary.getScreenCTM()!, groundMatrix = ground.getScreenCTM()!;
          for (let i = 0; i < 6; i++) {
            const a = boundary.points[i], b = ground.points[i];
            const artPoint = new DOMPoint(a.x, a.y).matrixTransform(artMatrix);
            const groundPoint = new DOMPoint(b.x, b.y).matrixTransform(groundMatrix);
            worst = Math.max(worst, Math.hypot(artPoint.x - groundPoint.x, artPoint.y - groundPoint.y));
          }
          checked++;
        }
        let contentChecked = 0, contentOutside = 0, iconSizeError = 0, rowOverlap = 0;
        for (const content of svg.querySelectorAll<SVGGElement>('.map-hex-content')) {
          if (content.closest('[display="none"]')) continue;
          const actor = content.closest('[data-actor-ax]')!;
          const polygon = svg.querySelector<SVGPolygonElement>(`polygon.cell[data-ax="${actor.getAttribute('data-actor-ax')}"]`)!;
          const matrix = polygon.getScreenCTM()!;
          const boundary = [...polygon.points].map(point => new DOMPoint(point.x, point.y).matrixTransform(matrix));
          const standard = layoutHexContent(polygon.getBBox().height / 2, 1);
          const rows = new Map<string, { top: number; bottom: number }>();
          for (const child of content.querySelectorAll<SVGGraphicsElement>('image, text')) {
            if (getComputedStyle(child).display === 'none') continue;
            const box = child.getBBox(), transform = child.getScreenCTM()!;
            const pad = child.tagName === 'text' ? parseFloat(getComputedStyle(child).strokeWidth) / 2 : 0;
            const role = child.tagName === 'image' ? 'icons' : child.classList.contains('hex-name') ? 'name'
              : child.classList.contains('hex-level') ? 'level' : 'overflow';
            const row = rows.get(role) ?? { top: Infinity, bottom: -Infinity };
            for (const [x, y] of [[box.x - pad, box.y - pad], [box.x + box.width + pad, box.y - pad],
              [box.x - pad, box.y + box.height + pad], [box.x + box.width + pad, box.y + box.height + pad]]) {
              const point = new DOMPoint(x, y).matrixTransform(transform);
              row.top = Math.min(row.top, point.y);
              row.bottom = Math.max(row.bottom, point.y);
              boundary.forEach((a, i) => {
                const b = boundary[(i + 1) % boundary.length];
                const distance = ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
                contentOutside = Math.max(contentOutside, -distance);
              });
            }
            rows.set(role, row);
            if (child.tagName === 'image') iconSizeError = Math.max(iconSizeError,
              Math.abs(box.width * Math.hypot(transform.a, transform.b) / Math.hypot(matrix.a, matrix.b) - standard.icons[0].size),
              Math.abs(box.height * Math.hypot(transform.c, transform.d) / Math.hypot(matrix.c, matrix.d) - standard.icons[0].size));
            contentChecked++;
          }
          const ordered = ['name', 'level', 'icons', 'overflow'].flatMap(role => rows.has(role) ? [rows.get(role)!] : []);
          for (let i = 1; i < ordered.length; i++) rowOverlap = Math.max(rowOverlap, ordered[i - 1].bottom - ordered[i].top);
        }
        return { checked, worst, contentChecked, contentOutside, iconSizeError, rowOverlap };
      });
      expect(result.checked).toBeGreaterThan(50);
      expect(result.contentChecked).toBeGreaterThan(50);
      expect(result.iconSizeError).toBeLessThan(.001);
      expect(result.contentOutside).toBeLessThanOrEqual(1);
      expect(result.rowOverlap).toBeLessThan(.01);
      return result.worst;
    }, { message: 'All six flat terrain corners must match the ground at every zoom' }).toBeLessThan(.01);
  }
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
    const options = { view: 'terrain' as const, gateLevel: 1, showIds: false, showWalk: false, townId: state.town.waypoint, showNames: true, cleanMap: false, showHexCalibration: false, relief: false };
    const model = () => buildMapPaintModel({ state, cells: renderer.cells, selected: null, options });
    const camera = { panX: 0, panY: 0, zoom: 2.4 };
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
    options.cleanMap = true;
    renderer.updateModel(model());
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const cleanContents = svg.querySelectorAll('.map-hex-content').length;
    options.cleanMap = false;
    renderer.updateModel(model());
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const restoredContents = svg.querySelectorAll('.map-hex-content').length;
    renderer.setVisible(false);
    const hiddenBefore = work.length;
    renderer.updateCamera({ ...camera, panX: 160 });
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
    return { afterFirst, batch, panOnly, zoomOnly, hiddenWork, showWork, cleanContents, restoredContents };
  });
  expect(counts.afterFirst.index).toBe(1);
  expect(counts.afterFirst.flush).toBeGreaterThan(0);
  expect(counts.afterFirst.sorted).toBe(1);
  expect(counts.panOnly).not.toContain('index');
  expect(counts.panOnly).not.toContain('depth-sort');
  expect(counts.zoomOnly).not.toContain('index');
  expect(counts.zoomOnly).not.toContain('depth-sort');
  expect(counts.hiddenWork).toHaveLength(0);
  expect(counts.batch.filter((event) => event === 'flush')).toHaveLength(1);
  expect(counts.showWork.filter((event) => event === 'flush')).toHaveLength(1);
  expect(counts.showWork).not.toContain('depth-sort');
  expect(counts.cleanContents).toBe(0);
  expect(counts.restoredContents).toBeGreaterThan(50);
});
