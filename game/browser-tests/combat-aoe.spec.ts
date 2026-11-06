import { test, expect } from '@playwright/test';

for (const [phase, atUs] of [['windup', 500_000], ['field', 1_500_000]] as const) {
  test(`aiming Meteor retains its committed ${phase} footprint`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Mount the actual layer alone so unrelated App/map lifecycle work cannot mask this regression.
    await page.route('**/__combat-aoe-check', route => route.fulfill({
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
        const areaAt = point => intentTargets(arena, [], { skillId: skill.id, targetId: '',
          targetPoint: point, phase: 'approach', manual: true, aimPoint: true }).area;
        const area = areaAt({ x: 4, y: 6 });
        arenaAction(arena, 'player', 'cast', 0, 'target', skill.id, area, {
          delivery: 'ground', startedAtUs: 0, releaseAtUs: 1000000,
          impactAtUs: 1200000, recoveryUntilUs: 2000000
        });
        mount(Layer, { target: document.querySelector('#layer'), props: {
          arena, frame: { atUs: ${atUs}, player: arena.player, mobs: {}, bodies: [] },
          atUs: ${atUs}, reducedMotion: true,
          aim: { skillId: skill.id, source: arena.player, rangeM: arenaSkillRange(skill.id), valid: true,
            area: areaAt({ x: 2, y: 6 }) }
        }});
      </script></body></html>`,
    }));
    await page.goto('http://localhost:5173/__combat-aoe-check');
    const committed = page.locator(`.skill-geometry[data-skill-id="attack.meteor"][data-skill-phase="${phase}"]`);
    const aim = page.locator('.skill-geometry[data-skill-id="attack.meteor"][data-skill-phase="aim"]');
    await expect(committed).toHaveCount(1);
    await expect(aim).toHaveCount(1);
    expect(await committed.locator('[data-skill-aoe-center]').getAttribute('transform'))
      .not.toBe(await aim.locator('[data-skill-aoe-center]').getAttribute('transform'));
    expect(errors).toEqual([]);
  });
}
