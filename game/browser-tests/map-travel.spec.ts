import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * HX4 map travel agreement. Uses the writable `core-field` sample: the feet stand on bare ground
 * outside the home settlement, so the Waypoint back home and the primary action are both reachable.
 */
const FIELD = 'http://localhost:5173/__showcase?sample=core-field#showcase-field';

async function openMap(page: Page) {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  await page.goto(FIELD, { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('1');
  const map = page.getByTestId('world-map');
  await expect(map).toBeVisible({ timeout: 20_000 });
  const cells = map.locator('polygon.cell[data-ax]');
  await expect.poll(async () => cells.count()).toBeGreaterThan(50);
  return { map, consoleErrors };
}

/** The first ground click sharpens the sheet; the second picks the cell (map.spec.ts pattern). */
async function pick(page: Page, map: Locator, selector: string) {
  const cell = map.locator(selector).first();
  await cell.dispatchEvent('click');
  await page.waitForTimeout(140);
  await cell.dispatchEvent('click');
  const destination = page.locator('section.dest');
  await expect(destination).toBeVisible();
  return destination;
}

test('map travel: Enter performs the same primary action the button shows', async ({ page }) => {
  const { map } = await openMap(page);
  const destination = await pick(page, map, 'polygon.cell[data-zone="1"][data-sub="0"]');
  const aloud = map.locator('.aloud');
  await expect(aloud).toContainText('Selected block');
  const primary = destination.locator('.dest-actions button[aria-keyshortcuts="Enter"]');
  await expect(primary).toBeVisible();
  const label = ((await primary.getAttribute('aria-label')) ?? '').trim();
  expect(label).toContain('Walk here');
  await map.focus();
  await page.keyboard.press('Enter');
  // doWalk clears the pick, so the card falls back to the feet: the button's action ran.
  await expect(destination).toContainText('You are here');
});

test('map travel: Waypoint home stays visible from bare ground outside town (F3)', async ({ page }) => {
  const { map } = await openMap(page);
  const homeAx = await page.evaluate(async () => {
    const { newGame } = await import('/src/sim/core/game.ts');
    const { settlementCell } = await import('/src/sim/world/road.ts');
    const { warpCost } = await import('/src/sim/world/road.ts');
    const state = newGame();
    const cell = settlementCell(state.town.waypoint)!;
    return { ax: `${cell.q},${cell.r}`, id: state.town.waypoint, fare: warpCost(state, state.town.waypoint) };
  });
  const destination = await pick(page, map, `polygon.cell[data-ax="${homeAx.ax}"]`);
  const warp = destination.getByRole('button', { name: /Waypoint/ });
  await expect(warp).toBeVisible();
  // The showcase character opens with 0 gold, so the shared readiness disables with the quoted fare.
  await expect(warp).toBeDisabled();
  await expect(destination).toContainText(/needs [\d.]+ gold/);
  await expect(destination).not.toContainText('This is your current Waypoint');
});

test('map travel: a mine hex keeps its mining action', async ({ page }) => {
  const { map } = await openMap(page);
  // Nearest mine to the opening sheet; its details are scouted from the starting area.
  const mineAx = await page.evaluate(async () => {
    const { road } = await import('/src/engine/client.ts');
    const mines = road.land
      .filter((cell: { q: number; r: number }) => (road.locationAt(cell) as { site?: string } | null)?.site === 'mine')
      .map((cell: { q: number; r: number }) => ({ cell, blocks: road.blocksLand({ q: 0, r: 0 }, cell) ?? 1e9 }))
      .sort((a: { blocks: number }, b: { blocks: number }) => a.blocks - b.blocks);
    if (!mines.length) throw new Error('no mine found');
    return `${mines[0].cell.q},${mines[0].cell.r}`;
  });
  const destination = await pick(page, map, `polygon.cell[data-ax="${mineAx}"]`);
  // A distant mine is a Walk target; the card still names it a mine, never bare ground.
  await expect(destination.getByRole('button', { name: /Walk here/ })).toBeVisible();
  await expect(destination).toContainText(/Mine/);
  const primary = destination.locator('.dest-actions button').first();
  await expect(primary).toBeVisible();
  expect(((await primary.getAttribute('aria-label')) ?? '').toLowerCase()).toContain('walk');
});

test('map travel: a cross-zone destination shows its own zone', async ({ page }) => {
  const { map } = await openMap(page);
  // A Zone 2 settlement (always scouted) shows its own zone in the card.
  const zone2Ax = await page.evaluate(async () => {
    const { TOWN } = await import('/src/engine/client.ts');
    const { settlementCell } = await import('/src/sim/world/road.ts');
    const target = (TOWN.settlements as Array<{ id: string; zone: number }>).find((s) => s.zone === 2)!;
    const cell = settlementCell(target.id)!;
    return `${cell.q},${cell.r}`;
  });
  const destination = await pick(page, map, `polygon.cell[data-ax="${zone2Ax}"]`);
  await expect(destination).toContainText(/Zone 2/);
  await expect(destination).toContainText(/Lv \d+/);
});
