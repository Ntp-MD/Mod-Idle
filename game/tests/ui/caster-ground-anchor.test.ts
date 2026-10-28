import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ArenaSkillVfxBody from '../../src/ui/combat/ArenaSkillVfxBody.svelte';

/**
 * A ground-layer effect cast by a body must sit on that body's own feet. The scene resolves them
 * from the drawn sprite (`bodyLift`) and passes them down as `casterGround`; the fixed offset is a
 * preview fallback only, so a large chibi body may never drag its ground art 58 pixels off its
 * ground line. Asserted at component level because a server-rendered scene mounts no actors, so
 * `bodyLift` can only return the fallback there and cannot distinguish the two anchors.
 */
const source = { x: 300, y: 200 };
const casterFeet = { x: 300, y: 270 };
const targetFeet = { x: 520, y: 400 };

function groundLayer(age = .1) {
  return render(ArenaSkillVfxBody, {
    props: {
      id: 'mob.physical.trample', shape: 'groundSlam', age, source, point: targetFeet,
      ground: targetFeet, casterGround: casterFeet, cast: true, layer: 'ground' as const,
    },
  }).body;
}

describe('caster ground anchor', () => {
  it('puts a self-classified ground effect on the caster feet it was given', () => {
    const body = groundLayer();
    expect(body).toContain('data-active-skill-vfx="mob.physical.trample"');
    expect(body).toContain('cx="300" cy="270"');
    expect(body).toContain('transform="translate(300 270)');
    expect(body).not.toContain('cy="258"');
    expect(body).not.toContain('translate(300 258)');
    expect(body).not.toContain('translate(300 400)');
  });

  it('falls back to the fixed offset only when no caster feet were resolved', () => {
    const body = render(ArenaSkillVfxBody, {
      props: {
        id: 'mob.physical.trample', shape: 'groundSlam', age: .1, source, point: targetFeet,
        ground: targetFeet, cast: true, layer: 'ground' as const,
      },
    }).body;
    expect(body).toContain('cx="300" cy="258"');
  });
});
