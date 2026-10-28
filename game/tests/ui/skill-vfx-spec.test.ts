import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { skillFxFor } from '../../src/ui/combat/arena-skill-effects';
import { activeVfxMechanics } from '../../src/ui/combat/arena-active-vfx';
import { authoredVfxFor, authoredVfxFrame } from '../../src/ui/combat/arena-authored-vfx';
import { groundShapePath, projectVfxFootprint, skillHandoffFor } from '../../src/ui/combat/arena-vfx-space';

/**
 * Presentation must read the same per-skill facts the engine executes with: movement from
 * `cast.delivery`, direction from `area.shape`, the anchor side from `area.origin` and the
 * repeat count from the structured `hits` effect. Nothing here may be inferred from a name.
 */
/** Retired rows keep their data but never render, so the gate reads the same live set the roster does. */
const live = sm.all().filter(skill => !skill.retired);

/**
 * Line rows whose authored atlas is frontal art — a thrust from the caster and a shot that flies
 * downrange — so the committed line reaches the ground layer as a footprint rather than through
 * the spatial matrix. A ground-plane strip would let the matrix own their length too.
 */
const FRONTAL_ONLY = ['attack.impale', 'attack.piercing_shot'];

describe('skill VFX canonical spec', () => {
  it('moves an effect only when the row delivers a projectile', () => {
    // Art may show travel the engine resolves at once (a chain jumping, a bolt falling from the
    // sky), but a row that really launches a projectile may never be drawn as a static hit.
    const artOnlyTravel = ['attack.chain_lightning', 'attack.thunder_strike', 'attack.overload'];
    for (const skill of live) {
      const flies = skill.cast?.delivery === 'projectile';
      const flagged = !!skillFxFor(skill.id)?.projectile;
      if (flies) expect(flagged, skill.id).toBe(true);
      else if (flagged) expect(artOnlyTravel, skill.id).toContain(skill.id);
    }
  });

  it('repeats the strike beat as often as the row counts hits', () => {
    for (const skill of live) {
      const hits = skill.effects?.find(effect => effect.stat === 'hits')?.value ?? 1;
      expect(activeVfxMechanics(skill).hits, skill.id).toBe(hits);
    }
  });

  it('keeps directional footprints on the spatial renderer that honors their geometry', () => {
    const directional = live.filter(skill => ['line', 'cone'].includes(skill.area?.shape ?? ''));
    expect(directional.map(skill => skill.id).sort()).toEqual([
      'attack.cleave', 'attack.fissure', 'attack.impale', 'attack.piercing_shot', 'attack.venom_spray',
    ]);
    for (const skill of directional) {
      const spatial = authoredVfxFor(skill.id)?.spatial;
      if (!FRONTAL_ONLY.includes(skill.id)) {
        expect(spatial?.composition, skill.id).toBeTruthy();
        continue;
      }
      // Frontal art keeps its own strike, so the committed footprint must still reach the ground
      // layer with the row's real length and width instead of being dropped.
      expect(spatial, skill.id).toBeUndefined();
      const area = skill.area!;
      const snapshot = {
        center: { x: 4, y: 6 }, radiusM: area.radius_m ?? 0, shape: area.shape,
        lengthM: area.length_m, widthM: area.width_m, angleDeg: area.angle_deg, directionRad: 0,
      } as Parameters<typeof projectVfxFootprint>[0];
      const footprint = projectVfxFootprint(snapshot)!;
      expect(footprint.shape, skill.id).toBe(area.shape);
      expect(footprint.lengthM, skill.id).toBe(area.length_m);
      expect(footprint.widthM, skill.id).toBe(area.width_m);
      const corners = groundShapePath(snapshot).trim().split(/\s+/);
      expect(corners[0][0], skill.id).toBe('M');
      expect(corners.at(-1), skill.id).toBe('Z');
      expect(corners.length, skill.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('anchors a caster-origin area on the caster ground layer', () => {
    const casterArea = live.filter(skill => {
      const handoff = skillHandoffFor(skill);
      return handoff.origin === 'caster' && (handoff.shape !== 'single' || skill.area?.shape === 'line');
    });
    expect(casterArea.map(skill => skill.id).sort()).toEqual([
      'attack.aftershock', 'attack.chaos_wave', 'attack.cinder_nova', 'attack.cleave', 'attack.fissure',
      'attack.frost_nova', 'attack.ground_slam', 'attack.impale', 'attack.piercing_shot',
      'attack.thunder_storm', 'attack.venom_spray', 'attack.whirlwind',
    ]);
    for (const skill of casterArea) {
      if ([...FRONTAL_ONLY, 'attack.whirlwind'].includes(skill.id)) continue;
      expect(authoredVfxFor(skill.id)?.spatial?.layer, skill.id).toBe('ground');
    }
  });

  it('gives every live skill its authored atlas', () => {
    expect(live).toHaveLength(92);
    for (const skill of live) {
      expect(authoredVfxFor(skill.id)?.src, skill.id).toMatch(/^\/fx\/skill-pool\//);
    }
  });

  it('flies, strikes or lands the way the row delivers', () => {
    const mismatched = live
      .map(skill => [skill.id, authoredVfxFor(skill.id), skillHandoffFor(skill).delivery] as const)
      .filter(([, preset, canonical]) => preset && !preset.spatial && !!preset.delivery && preset.delivery !== canonical)
      .map(([id, preset, canonical]) => `${id}: ${preset?.delivery} != ${canonical}`);
    expect(mismatched).toEqual([]);
  });

  it('beats once per committed hit without strobing a sustained field', () => {
    const rows = live.filter(skill => (skill.effects ?? []).some(effect => effect.stat === 'hits' && effect.value > 1));
    expect(rows.map(skill => skill.id).sort()).toEqual([
      'attack.arrow_shower', 'attack.blizzard', 'attack.double_strike', 'attack.ice_lance',
      'attack.overload', 'attack.water_ball', 'attack.whirlwind',
    ]);
    for (const skill of rows) {
      const preset = authoredVfxFor(skill.id)!;
      const hits = skill.effects!.find(effect => effect.stat === 'hits')!.value;
      const age = .34, duration = .8;
      const single = authoredVfxFrame(preset, age, duration, false, 1);
      const multi = authoredVfxFrame(preset, age, duration, false, hits);
      const sustainedField = !!preset.spatial && preset.spatial.composition !== 'projectile-component';
      if (sustainedField || skill.id === 'attack.whirlwind') {
        // A deployed field keeps its own loop cadence; its ticks are not animation beats.
        expect(multi, skill.id).toBe(single);
      } else {
        expect(multi, skill.id).not.toBe(single);
      }
    }
  });

  it('anchors the authored art on the side the row commits', () => {
    const mismatched = live.flatMap(skill => {
      const preset = authoredVfxFor(skill.id);
      if (!preset?.origin) return [];
      // A flying effect declares where its impact lands: the recipient, even when the row
      // commits its line or circle from the caster.
      if (preset.delivery === 'projectile')
        return preset.origin === 'target' ? [] : [`${skill.id}: impact ${preset.origin} != target`];
      if (skill.area)
        return preset.origin === skill.area.origin ? [] : [`${skill.id}: ${preset.origin} != ${skill.area.origin}`];
      // Support rows commit no area; they are cast on the user, so their art anchors on the caster.
      return preset.origin === 'caster' ? [] : [`${skill.id}: ${preset.origin} != caster`];
    });
    expect(mismatched).toEqual([]);
  });
});
