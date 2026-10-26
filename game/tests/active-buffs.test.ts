import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ActiveBuffs from '../src/ui/hud/ActiveBuffs.svelte';
import { newSkillState } from '../src/sim/skills';

describe('active buff indicators', () => {
  it('shows remaining time for a live buff and the enabled aura', () => {
    const skills = newSkillState();
    skills.buffUp['buff.berserker'] = 2.2;
    skills.auras['aura.trinity_form'] = true;
    const { body } = render(ActiveBuffs, { props: { skills } });
    expect(body).toContain('Berserker: 3s remaining');
    expect(body).toContain('Trinity Form: Aura active');
  });

  it('removes expired buffs and disabled auras without reserving an empty row', () => {
    const skills = newSkillState();
    skills.buffUp['buff.berserker'] = 0;
    skills.auras['aura.trinity_form'] = false;
    const { body } = render(ActiveBuffs, { props: { skills } });
    expect(body).not.toContain('Active buffs');
    expect(body).not.toContain('buff-icon');
  });
});
