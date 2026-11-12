import { describe, expect, it } from 'vitest';
import { SHOWCASE_SAMPLES, SHOWCASE_SAMPLE_LABELS, showcaseFieldSkill, showcaseView } from '../../src/app/showcase/samples';

describe('showcase sample registry', () => {
  it('has one label per sample and no duplicate ids', () => {
    expect(SHOWCASE_SAMPLES).toHaveLength(29);
    expect(new Set(SHOWCASE_SAMPLES).size).toBe(29);
    for (const id of SHOWCASE_SAMPLES) expect(SHOWCASE_SAMPLE_LABELS[id]).toBeTruthy();
  });

  it('keeps the field samples on their authored skill', () => {
    expect(showcaseFieldSkill('combat-field')).toBe('attack.fireball');
    expect(showcaseFieldSkill('magic-aoe')).toBe('attack.meteor');
  });

  it('keeps the panel samples on their existing hosts', () => {
    expect(showcaseView('craft-stash')?.panel).toBe('craft');
    expect(showcaseView('combat-fx')).toMatchObject({ combatFx: true, statuses: { burn: { stacks: 1 } } });
    expect(showcaseView('offline-progress')?.offline).toEqual({ done: 43200, total: 86400 });
    expect(showcaseView('progress-recap')?.progressRecap).toBe(true);
    expect(showcaseView('read-only')?.readOnly).toBe(true);
    expect(showcaseView('story-read-only')).toMatchObject({ readOnly: true, panel: 'map', journeyTools: true });
  });

  it('maps every story sample to an existing host', () => {
    for (const id of SHOWCASE_SAMPLES.filter((sample) => sample.startsWith('story-'))) {
      const view = showcaseView(id);
      expect(view, id).toBeTruthy();
      expect(view!.journeyTools, id).toBe(true);
      expect(view!.panel, id).toBeTruthy();
    }
  });

  it('uses the trade host for market promotion and courier destination', () => {
    expect(showcaseView('story-market-promotion')?.market).toEqual({ view: 'trade', town: 'current' });
    expect(showcaseView('story-courier-destination')?.market).toEqual({ view: 'deliveries', town: 'courier-destination' });
  });
});
