import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ArenaAuthoredSkillVfx from '../src/ui/combat/ArenaAuthoredSkillVfx.svelte';
import ArenaSkillVfx from '../src/ui/combat/ArenaSkillVfx.svelte';
import { skillFxFor } from '../src/ui/combat/arena-skill-effects';

const point = { x: 100, y: 100 };

describe('authored VFX rendering', () => {
  it('replaces legacy supplemental art as well as the main effect', () => {
    for (const id of ['attack.aftershock', 'attack.arrow_shower', 'attack.catalyst', 'attack.detonate', 'buff.earth_wall', 'buff.ghost_dance', 'heal.cleanse']) {
      const props = {
        id, shape: skillFxFor(id)!.shape, age: .2, source: point, point, ground: point,
        cast: true, charges: 3, cleansed: 2, consumed: 3, spreadTargets: [point],
      };
      const body = render(ArenaSkillVfx, {props}).body + render(ArenaSkillVfx, {props:{...props,layer:'ground'}}).body;
      expect(body, id).toContain('data-authored-vfx');
      expect(body, id).not.toContain('/fx/library/');
      expect(body, id).not.toContain('class="arrow-flight"');
    }
  });

  it('draws one spatial field across the action footprint, including reduced motion', () => {
    for (const id of ['attack.meteor','attack.blizzard','attack.ground_slam']) {
      for (const reducedMotion of [false,true]) {
        const props = {id,shape:skillFxFor(id)!.shape,age:.3,source:point,point,ground:point,cast:true,reducedMotion,
          area:{center:point,basisX:{x:180,y:30},basisY:{x:45,y:110},diameter:370}};
        const body=render(ArenaSkillVfx,{props}).body+render(ArenaSkillVfx,{props:{...props,layer:'ground'}}).body;
        expect(body.match(/data-vfx-version="spatial-v2"/g),id).toHaveLength(1);
        expect(body,id).toContain('matrix(');
        expect(body,id).toContain('/spatial-v2/atlas.png');
      }
    }
  });

  for (const reducedMotion of [false, true]) {
    it(`keeps aura art visible beyond one cycle (reduced motion: ${reducedMotion})`, () => {
      const { body } = render(ArenaAuthoredSkillVfx, { props: {
        id: 'aura.trinity_form', age: 12, duration: 1, ground: point, source: point,
        baseSize: 65, looping: true, reducedMotion,
      } });
      expect(body).toContain('data-authored-vfx="aura.trinity_form"');
      expect(body).toContain('<image');
    });
  }
});
