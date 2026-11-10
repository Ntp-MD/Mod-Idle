import { test, expect, type Page } from '@playwright/test';

/**
 * R5/V2: the live arena DOM must paint line/cone atlases at the authored world
 * metres, independent of the actor body and of the viewport zoom. The old
 * renderer clamped these layers to body multiples, which the model size cannot
 * reproduce: a 6 m Fissure line is far wider than any 7x body bound.
 */

const CONTENT = {
  // public/fx/skill-pool meta `content` ratios (trimmed texture -> painted box).
  'attack.fissure': { lengthM: 6, widthM: 1.2, widthRatio: 0.6536458333333334, heightRatio: 0.3203125 },
  'attack.cleave': { lengthM: 3.637306695894642, widthM: 2.1, widthRatio: 0.6900452488687783, heightRatio: 0.44170403587443946 },
} as const;

async function setWorldScale(page: Page, value: number) {
  const slider = page.getByRole('slider', { name: 'World scale in the arena' });
  await slider.evaluate((element, next) => {
    const input = element as HTMLInputElement;
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function castAndPaint(page: Page, skill: string) {
  await page.goto(`http://localhost:5173/__showcase?sample=combat-field&aoe-preview=1&skill=${skill}#showcase-field`);
  await expect(page.locator('[data-combat-arena]')).toBeVisible();
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Resume game', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  const playhead = page.getByRole('slider', { name: 'Arena animation time' });
  const art = page.locator(`[data-skill-art="${skill}"] .atlas-frame`).first();
  // The cast owns a short action window; sweep the review playhead until its art paints.
  for (const atUs of [600_000, 900_000, 1_200_000, 1_500_000]) {
    await playhead.evaluate((element, value) => {
      const input = element as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, atUs);
    if (await art.count()) break;
    await page.waitForTimeout(100);
  }
  await expect(art).toHaveCount(1);
  return art;
}

for (const skill of Object.keys(CONTENT) as Array<keyof typeof CONTENT>) {
  test(`${skill}: atlas paints the authored metres at every zoom`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const art = await castAndPaint(page, skill);
    const { lengthM, widthM, widthRatio, heightRatio } = CONTENT[skill];

    const worldAt = async () => art.evaluate((node) => ({
      width: Number(node.getAttribute('width')),
      height: Number(node.getAttribute('height')),
      screenWidth: node.getBoundingClientRect().width,
      screenHeight: node.getBoundingClientRect().height,
    }));
    const expectAuthored = (size: { width: number; height: number }) => {
      // The painted box includes the atlas transparent padding; its content span is the authored area.
      expect(size.width * widthRatio).toBeCloseTo(lengthM, 3);
      expect(size.height * heightRatio).toBeCloseTo(widthM, 3);
    };

    await setWorldScale(page, 0.5);
    const half = await worldAt();
    expectAuthored(half);
    await setWorldScale(page, 1);
    const full = await worldAt();
    expectAuthored(full);
    // Model metres are zoom-independent; only the shared frame changes screen size.
    expect(full.width).toBeCloseTo(half.width, 6);
    expect(full.height).toBeCloseTo(half.height, 6);
    expect(full.screenWidth / half.screenWidth).toBeCloseTo(2, 2);
    expect(full.screenHeight / half.screenHeight).toBeCloseTo(2, 2);
    expect(errors).toEqual([]);
  });
}

test('ground impact rings follow the camera ellipse and scale with the actual field', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://localhost:5173/__showcase?sample=rimworld-field&skill=attack.meteor#showcase-field');
  const ring = page.locator('[data-skill-art="attack.meteor"][data-skill-rain] [data-rain-drop] > :is(circle, ellipse)').first();
  await expect(ring).toBeAttached({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  const footprint = page.locator('.skill-geometry[data-skill-id="attack.meteor"][data-skill-phase="field"] .skill-footprint').first();
  await expect(footprint).toBeAttached();
  const groundRatio = await page.evaluate(async () => {
    const { ARENA_CAMERA } = await import('/src/presentation/arena-camera.ts');
    return ARENA_CAMERA.projection.d / ARENA_CAMERA.projection.a;
  });

  const measure = (locator: typeof ring) => locator.evaluate(element => {
    const shape = element as SVGGraphicsElement, box = shape.getBBox(), matrix = shape.getScreenCTM()!;
    return { width: box.width * Math.hypot(matrix.a, matrix.b),
      height: box.height * Math.hypot(matrix.c, matrix.d) };
  });
  const colours = await ring.evaluate(element => ({ stroke: getComputedStyle(element).stroke,
    skill: getComputedStyle(element.closest('[data-skill-rain]')!).color }));
  expect(colours.stroke).toBe(colours.skill);
  expect(colours.stroke).not.toBe('rgb(201, 247, 255)');
  const spriteAxes = await page.locator('[data-skill-art="attack.meteor"][data-skill-rain] svg.atlas-frame').first().evaluate(element => {
    const matrix = (element.parentElement as unknown as SVGGraphicsElement).getScreenCTM()!;
    return { x: Math.hypot(matrix.a, matrix.b), y: Math.hypot(matrix.c, matrix.d) };
  });
  expect(spriteAxes.y / spriteAxes.x).toBeCloseTo(1, 6);

  let base: { ring: number; footprint: number } | undefined;
  for (const scale of [.5, .75, 1, 1.5, 2]) {
    await setWorldScale(page, scale);
    if (base) await expect.poll(async () => (await measure(ring)).width / base!.ring)
      .toBeCloseTo(scale / .5, 2);
    const small = await measure(ring), area = await measure(footprint);
    expect(small.height / small.width).toBeCloseTo(groundRatio, 3);
    expect(area.height / area.width).toBeCloseTo(groundRatio, 3);
    base ??= { ring: small.width, footprint: area.width };
    expect(area.width / base.footprint).toBeCloseTo(scale / .5, 2);
  }

  await page.goto('http://localhost:5173/__showcase?sample=combat-field&skill=attack.thunder_strike&vfx=base#showcase-field');
  const flash = page.locator('.skill-geometry[data-skill-id="attack.thunder_strike"] .vfx-column-flash').first();
  await expect(flash).toBeAttached({ timeout: 30_000 });
  const lightning = await measure(flash);
  expect(lightning.height / lightning.width).toBeCloseTo(groundRatio, 3);
  expect(errors).toEqual([]);
});

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
