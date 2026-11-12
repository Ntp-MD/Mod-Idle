import { test, expect } from '@playwright/test';

// VFX fallback: Base visible without skin; version switch does not replay (data marks present).
test('skill vfx fallback mounts Base and skin renderer marks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/__skill-vfx-fallback-check', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body><main id="layer"></main><script type="module">
        import { mount } from '/@id/svelte';
        import Layer from '/src/ui/combat/SkillGeometryLayer.svelte';
        import { createCombatArena, arenaAction, arenaSkillRange } from '/src/sim/combat/combat-arena.ts';
        import { intentTargets } from '/src/sim/combat/combat-actions.ts';
        import { sm } from '/src/engine/client.ts';
        const arena = createCombatArena();
        Object.assign(arena.player, { x: 1, y: 6 });
        const skill = sm.byId['attack.meteor'];
        const area = intentTargets(arena, [], { skillId: skill.id, targetId: '', targetPoint: { x: 4, y: 6 }, phase: 'approach', manual: true, aimPoint: true }).area;
        arenaAction(arena, 'player', 'cast', 0, 'target', skill.id, area, { delivery: 'ground', startedAtUs: 0, releaseAtUs: 1000000, impactAtUs: 1200000, recoveryUntilUs: 2000000 });
        mount(Layer, { target: document.querySelector('#layer'), props: {
          arena, frame: { atUs: 1500000, player: arena.player, mobs: {}, bodies: [] }, atUs: 1500000, reducedMotion: true, vfxMode: 'base',
        }});
      </script></body></html>`,
    })
  );
  await page.goto('http://localhost:5173/__skill-vfx-fallback-check');
  const mark = page.locator('.skill-geometry[data-skill-id="attack.meteor"]');
  await expect(mark).toHaveCount(1);
  // Base mode: no skin image, Base stage present
  await expect(page.locator('[data-vfx-renderer="skin"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Real showcase: Base option is present in the VFX selector.
test('showcase exposes Base VFX option without a skin', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://localhost:5173/__showcase?sample=combat-field&skill=attack.meteor&vfx=base#showcase-field');
  await page.waitForTimeout(1500);
  const selector = page.getByLabel('Preview VFX art in the arena');
  await expect(selector).toBeVisible();
  await expect(selector.getByRole('option', { name: 'Base VFX (no skin)' })).toHaveCount(1);
  // Base mode renders no skin art group
  await expect(page.locator('[data-vfx-renderer="skin"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('phase-specific layers replace Base only when the current phase has art', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__external-vfx-check?*', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html><body><main id="layer"></main><script type="module">
      import { mount } from '/@id/svelte';
      import Layer from '/src/ui/combat/SkillGeometryLayer.svelte';
      import { createCombatArena, arenaAction } from '/src/sim/combat/combat-arena.ts';
      import { intentTargets } from '/src/sim/combat/combat-actions.ts';
      import { SKILL_VFX_POOL } from '/src/ui/fx/catalog.ts';
      const arena = createCombatArena();
      Object.assign(arena.player, { x: 1, y: 6 });
      const skillId = 'attack.fireball';
      const params = new URLSearchParams(location.search);
      if (params.get('art') === 'impact-only') {
        SKILL_VFX_POOL[skillId] = SKILL_VFX_POOL[skillId].map(version => ({ ...version,
          layers: version.layers.filter(layer => !layer.phases?.includes('Travel')) }));
      }
      const area = intentTargets(arena, [], { skillId, targetId: '', targetPoint: { x: 4, y: 6 }, phase: 'approach', manual: true, aimPoint: true }).area;
      arenaAction(arena, 'player', 'cast', 0, 'target', skillId, area, { delivery: 'projectile', startedAtUs: 0, releaseAtUs: 1000000, impactAtUs: 2000000, recoveryUntilUs: 3000000 });
      const atUs = new URLSearchParams(location.search).get('phase') === 'travel' ? 1500000 : 2100000;
      mount(Layer, { target: document.querySelector('#layer'), props: {
        arena, frame: { atUs, player: arena.player, mobs: {}, bodies: [] }, atUs, reducedMotion: true, vfxMode: 'auto',
      }});
    </script></body></html>`
  }));
  for (const art of ['impact-only', 'full']) for (const phase of ['travel', 'impact']) {
    await page.goto(`http://localhost:5173/__external-vfx-check?phase=${phase}&art=${art}`);
    const mark = page.locator('.skill-geometry[data-skill-id="attack.fireball"]');
    await expect(mark).toHaveAttribute('data-vfx-renderer', 'skin');
    await expect(mark).toHaveAttribute('data-skill-phase', phase);
    const baseTravel = phase === 'travel' && art === 'impact-only';
    await expect(mark.locator('.skill-vfx-stage')).toHaveCount(baseTravel ? 1 : 0);
    await expect(page.locator('[data-skill-art="attack.fireball"]')).toHaveCount(baseTravel ? 0 : 1);
  }
  expect(errors).toEqual([]);
});
