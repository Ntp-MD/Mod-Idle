import { test, expect } from '@playwright/test';

test('one world scale resizes actors, range rings and VFX without changing their proportions or time', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://localhost:5173/__showcase?sample=combat-field&aoe-preview=1#showcase-field');
  const worldScale = page.getByRole('slider', { name: 'World scale in the arena' });
  await expect(worldScale).toHaveValue('0.5');
  const playhead = page.getByRole('slider', { name: 'Arena animation time' });
  await expect.poll(() => playhead.getAttribute('max').then(value => Number(value))).toBeGreaterThanOrEqual(1_000_000);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await playhead.evaluate(element => {
    const input = element as HTMLInputElement;
    input.value = '500000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const renderer = page.getByLabel('Mob rendering mode in the arena');
  const vfx = page.getByLabel('Preview VFX version in the arena');
  const camera = await page.evaluate(async () => {
    const { ARENA_CAMERA, ARENA_VIEW } = await import('/src/presentation/arena-camera.ts');
    return { pixelsPerMeter: ARENA_CAMERA.projection.a, referenceWidth: ARENA_VIEW.width,
      groundRatio: ARENA_CAMERA.projection.d / ARENA_CAMERA.projection.a };
  });
  const skinVersion = await vfx.inputValue();
  for (const mode of ['fallback', 'sprite']) {
    await renderer.selectOption(mode);
    const source = () => page.locator('.arena-actor.hero').getAttribute('data-animation-source');
    if (mode === 'fallback') await expect.poll(source).toBe('icon');
    else await expect.poll(source).not.toBe('icon');
    for (const vfxMode of [skinVersion, 'base']) {
      await vfx.selectOption(vfxMode);
      let reference: { actor: number; ring: number; nativeWidth: number; nativeHeight: number } | undefined;
      for (const factor of [.5, .75, 1, 1.5, 2]) {
        await worldScale.evaluate((element, value) => {
          const input = element as HTMLInputElement;
          input.value = String(value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, factor);
        await expect.poll(async () => {
          const width = (await page.locator('[data-combat-arena]').boundingBox())!.width;
          const pixelsPerMeter = Number(await page.locator('[data-world-ground]').getAttribute('data-ground-ppm'));
          return pixelsPerMeter / (factor * width / camera.referenceWidth);
        }).toBeCloseTo(camera.pixelsPerMeter, 3);
        const effect = vfxMode === 'base'
          ? page.locator('.skill-geometry[data-skill-id="attack.fireball"] .skill-vfx-stage').first()
          : page.locator('[data-skill-art="attack.fireball"]').first();
        await expect(effect).toBeVisible();
        if (vfxMode !== 'base') {
          const axes = await effect.locator('svg.atlas-frame').first().evaluate(element => {
            const m = (element.parentElement as unknown as SVGGraphicsElement).getScreenCTM()!;
            return { x: Math.hypot(m.a, m.b), y: Math.hypot(m.c, m.d), dot: m.a * m.c + m.b * m.d };
          });
          expect(axes.y / axes.x).toBeCloseTo(1, 6);
          expect(axes.dot).toBeCloseTo(0, 6);
        }
        const actor = await page.locator('.arena-actor.hero .arena-body').boundingBox();
        const ring = await page.locator('[data-aoe-radius="3"]').evaluate(element => {
          const path = element as SVGGraphicsElement;
          const box = path.getBBox(), matrix = path.getScreenCTM()!;
          return { width: box.width * Math.hypot(matrix.a, matrix.b), height: box.height * Math.hypot(matrix.c, matrix.d) };
        });
        const native = await effect.evaluate(element => {
          const box = (element as SVGGraphicsElement).getBBox();
          return { width: box.width, height: box.height };
        });
        expect(ring.height / ring.width).toBeCloseTo(camera.groundRatio, 3);
        if (!reference) reference = { actor: actor!.width, ring: ring.width, nativeWidth: native.width, nativeHeight: native.height };
        expect(actor!.width / reference.actor).toBeCloseTo(factor / .5, 2);
        expect(ring.width / reference.ring).toBeCloseTo(factor / .5, 2);
        expect(native.width).toBeCloseTo(reference.nativeWidth, 2);
        expect(native.height).toBeCloseTo(reference.nativeHeight, 2);
        expect(await playhead.inputValue()).toBe('500000');
        // A3: the followed player stays on the frame anchor at every scale.
        const hero = await page.locator('.arena-actor.hero').evaluate(element => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y };
        });
        const stageBox = (await page.locator('[data-combat-arena]').boundingBox())!;
        expect(Math.abs(hero.x - (stageBox.x + stageBox.width / 2))).toBeLessThanOrEqual(3);
        expect(Math.abs(hero.y - (stageBox.y + stageBox.height / 2))).toBeLessThanOrEqual(3);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('pointer and keyboard aim resolve through the painted frame, including container offset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://localhost:5173/__showcase?sample=combat-field&aoe-preview=1&skill=attack.firestorm#showcase-field');
  const arena = page.locator('[data-combat-arena]');
  await expect(arena).toBeVisible();
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();

  const skillId = 'attack.firestorm';

  const box = (await arena.boundingBox())!;

  const pointerProbe = async () => {
    // Re-read the painted frame at hover time: the deep-link hash scroll can settle late.
    const current = (await arena.boundingBox())!;
    const spots = [
      { x: current.x + current.width * 0.38, y: current.y + current.height * 0.62 },
      { x: current.x + current.width * 0.62, y: current.y + current.height * 0.38 },
      { x: current.x + current.width * 0.5, y: current.y + current.height * 0.24 },
    ];
    const mobSpots = await page.locator('.arena-actor .arena-inspect').evaluateAll(nodes =>
      nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }));
    return spots.find(spot => mobSpots.every(mob => Math.hypot(mob.x - spot.x, mob.y - spot.y) > 140)) ?? spots[0];
  };

  // Keyboard path: `r` arms the manual skill, arrows step the 0.5 m reticle, Enter commits.
  await page.keyboard.press('r');
  const aim = page.locator('.skill-geometry[data-skill-phase="aim"]');
  await expect(aim).toHaveCount(1);
  const aimCenter = () => aim.locator('[data-skill-aoe-center]').boundingBox()
    .then(rect => ({ x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 }));
  const keyboardBefore = await aimCenter();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const keyboardAfter = await aimCenter();
  const stepPx = 0.5 * 140 * 0.5 * (box.width / 1920);
  expect(keyboardAfter.x - keyboardBefore.x).toBeCloseTo(2 * stepPx, 0);
  expect(Math.abs(keyboardAfter.y - keyboardBefore.y)).toBeLessThanOrEqual(2);
  await page.keyboard.press('Enter');
  await expect(aim).toHaveCount(0);

  // Pointer path: hover tracks the cursor through the container offset, click commits the point.
  await page.getByRole('button', { name: /^Aim / }).click();
  await expect(aim).toHaveCount(1);
  const probe = await pointerProbe();
  await page.mouse.move(probe.x, probe.y);
  const hovered = await aimCenter();
  expect(Math.abs(hovered.x - probe.x)).toBeLessThanOrEqual(2.5);
  expect(Math.abs(hovered.y - probe.y)).toBeLessThanOrEqual(2.5);
  // The probe must be a committable point: in range, on walkable ground.
  await expect(aim).not.toHaveClass(/invalid/);
  const committed = `.skill-geometry[data-skill-id="${skillId}"]:not([data-skill-phase="aim"])`;
  const baseline = await page.locator(committed).count();
  await page.mouse.click(probe.x, probe.y);
  await expect(aim).toHaveCount(0);
  // The paused sim holds the cast; resume and the committed footprint lands where clicked.
  await page.getByRole('button', { name: 'Resume game', exact: true }).click();
  await expect.poll(async () => {
    const centers = await page.locator(`${committed} [data-skill-aoe-center]`).evaluateAll(nodes =>
      nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }));
    return centers.some(center => Math.hypot(center.x - probe.x, center.y - probe.y) < 30);
  }, { timeout: 20000 }).toBe(true);
  expect(await page.locator(committed).count()).toBeGreaterThan(baseline);
  expect(errors).toEqual([]);
});


test('walking keeps the camera on the interpolated player instead of snapping each tick', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://localhost:5173/__showcase?sample=combat-field#showcase-field');
  await expect(page.locator('.arena-actor.hero .arena-body')).toBeVisible();
  await page.keyboard.down('d');
  let samples: { moving: boolean; dx: number; dy: number; camera: string }[];
  try {
    samples = await page.evaluate(() => new Promise(resolve => {
      const rows: { moving: boolean; dx: number; dy: number; camera: string }[] = [];
      const start = performance.now();
      const sample = () => {
        const host = document.querySelector('[data-combat-arena]')!;
        const hero = host.querySelector('.arena-actor.hero')!;
        const box = host.getBoundingClientRect(), feet = hero.getBoundingClientRect();
        rows.push({ moving: hero.getAttribute('data-moving') === 'true',
          dx: feet.x - box.x - box.width / 2, dy: feet.y - box.y - box.height / 2,
          camera: (host.querySelector('.arena-camera') as HTMLElement).style.transform });
        if (performance.now() - start < 1800) requestAnimationFrame(sample);
        else resolve(rows);
      };
      requestAnimationFrame(sample);
    }));
  } finally { await page.keyboard.up('d'); }
  expect(samples.filter(sample => sample.moving).length).toBeGreaterThan(2);
  expect(new Set(samples.map(sample => sample.camera)).size).toBeGreaterThan(2);
  expect(Math.max(...samples.map(sample => Math.abs(sample.dx)))).toBeLessThan(2);
  expect(Math.max(...samples.map(sample => Math.abs(sample.dy)))).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test('terrain, selected body and its ground ring share the painted frame at every scale', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://localhost:5173/__showcase?sample=combat-field#showcase-field');
  const marker = page.locator('[data-target-ground]');
  await expect(marker).toBeAttached();
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  const scale = page.getByLabel('World scale in the arena');
  const groundRatio = await page.evaluate(async () => {
    const { ARENA_CAMERA } = await import('/src/presentation/arena-camera.ts');
    return ARENA_CAMERA.projection.d / ARENA_CAMERA.projection.a;
  });
  let baseWidth = 0;
  for (const factor of [.5, .75, 1, 1.5, 2]) {
    await scale.evaluate((element, value) => {
      const input = element as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, factor);
    if (baseWidth) await expect.poll(async () => marker.evaluate((element, expected) => {
      const shape = element as SVGGraphicsElement, box = shape.getBBox(), matrix = shape.getScreenCTM()!;
      return box.width * Math.hypot(matrix.a, matrix.b) / expected;
    }, baseWidth)).toBeCloseTo(factor / .5, 2);
    const result = await marker.evaluate(element => {
      const circle = element as SVGCircleElement, matrix = circle.getScreenCTM()!, box = circle.getBBox();
      const world = new DOMPoint(circle.cx.baseVal.value, circle.cy.baseVal.value);
      const center = world.matrixTransform(matrix);
      const id = circle.getAttribute('data-ground-actor')!;
      const actor = document.querySelector(`[data-arena-actor="${CSS.escape(id)}"]`)!.getBoundingClientRect();
      const ground = document.querySelector('[data-world-ground]') as SVGSVGElement;
      const pattern = ground.querySelector('pattern')!.getAttribute('patternTransform')!;
      const [a, b, c, d, e, f] = pattern.slice(pattern.indexOf('(') + 1, pattern.lastIndexOf(')')).trim().split(/\s+/).map(Number);
      const groundPoint = new DOMPoint(a * world.x + c * world.y + e, b * world.x + d * world.y + f)
        .matrixTransform(ground.getScreenCTM()!);
      return { width: box.width * Math.hypot(matrix.a, matrix.b), height: box.height * Math.hypot(matrix.c, matrix.d),
        actorDistance: Math.hypot(center.x - actor.x, center.y - actor.y),
        groundDistance: Math.hypot(center.x - groundPoint.x, center.y - groundPoint.y) };
    });
    expect(result.height / result.width).toBeCloseTo(groundRatio, 3);
    expect(result.actorDistance).toBeLessThan(1);
    expect(result.groundDistance).toBeLessThan(.01);
    baseWidth ||= result.width;
  }
  expect(errors).toEqual([]);
});
