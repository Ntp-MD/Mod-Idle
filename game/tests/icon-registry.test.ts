import { describe, expect, it } from 'vitest';
import { BASES, SKILLS, trade } from '../src/engine/client';
import { characterIcon, gearIcon, icon, skillIcon, stackIcon } from '../src/icon';
import { stackEntry } from '../src/ui/bag';

const groupFor: Record<string, string> = { material: 'materials', food: 'food', herb: 'herbs', junk: 'junk' };

describe('entity icon registry', () => {
  it('resolves every current item, gear base, weapon frame, skill, and player portrait', () => {
    for (const good of trade.goods) {
      expect(stackIcon(groupFor[good.bucket] || good.bucket, good.name, good.id), good.id).toBeTruthy();
    }
    for (const base of BASES.bases) {
      expect(gearIcon({ base: base.name, slot: base.slot } as any), base.name).toBeTruthy();
    }
    for (const frames of Object.values(BASES.weapon_frames)) for (const frame of frames) {
      expect(gearIcon({ base: frame.name, slot: 'main hand' } as any), frame.name).toBeTruthy();
    }
    for (const skill of SKILLS.skills) expect(skillIcon(skill.id, skill.type), skill.id).toBeTruthy();
    expect(characterIcon('player.default')).toBeTruthy();
  });

  it('prefers stable item registrations and uses a visible type fallback for unknown content', () => {
    expect(stackIcon('food', 'Renamed display label', 'food:hunters_roast')).toBe(icon('hunters-roast'));
    expect(stackEntry({ key: 'hunters_roast', name: "Hunter's Roast", group: 'food', capKind: 'food', count: 1, weight: 0 }, 0).icon)
      .toBe(icon('hunters-roast'));
    expect(stackIcon('materials', 'Unknown material', 'material:not-yet-authored')).toBe(icon('minerals'));
    expect(skillIcon('attack.fireball', 'attack')).toBe(icon('fireball'));
    expect(skillIcon('future.new_skill', 'attack')).toBe(icon('type-active-skill'));
    expect(characterIcon('future.character')).toBe(characterIcon('player.default'));
  });
});
