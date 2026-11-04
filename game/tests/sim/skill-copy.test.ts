import { describe, it, expect } from 'vitest';
import { sm } from '../../src/engine/client';
import { describeMobSkill, describeSkill, skillWindowEntries } from '@sim/combat/skill-copy';

const row = (id: string) => sm.byId[id]!;

describe('the player skill window derives its fields from the row', () => {
  it('reads Firestorm as a target-centred ground circle', () => {
    const window = describeSkill(row('attack.firestorm'));
    expect(window).toMatchObject({
      type: 'Offensive',
      target: 'Enemies in Area',
      range: '5',
      area: '6x6',
      element: 'Fire',
      sp: '21',
      delay: '13 sec',
      compact: 'Area · 6x6 · 5 · 13 sec',
    });
  });

  it('reads Cleave as a caster-centred melee circle', () => {
    const window = describeSkill(row('attack.cleave'));
    expect(window).toMatchObject({
      target: 'All Enemies Around Me',
      range: 'Melee',
      area: '4x4',
      compact: 'Around me · 4x4 · Melee · 6 sec',
    });
  });

  it('keeps a single-target skill compact without an Area row', () => {
    const window = describeSkill(row('attack.fireball'));
    expect(window.area).toBeUndefined();
    expect(window.compact).toBe('Single · 5 · 6 sec');
  });

  it('rounds radii to cells and omits the Area row at radius zero', () => {
    const cleave = row('attack.cleave');
    expect(describeSkill({ ...cleave, area: { origin: 'caster', radius_m: 2.5 } }).area).toBe('5x5');
    expect(describeSkill({ ...cleave, area: { origin: 'caster', radius_m: 0 } }).area).toBeUndefined();
  });

  it('prints an aura as reserved, with its tier percentage and no SP row', () => {
    const aura = row('aura.wraith_of_fury');
    const window = describeSkill(aura);
    expect(window.target).toBe('Self (Reserved)');
    expect(window.range).toBe('—');
    expect(window.sp).toBeUndefined();
    expect(window.delay).toBeUndefined();
    expect(window.reservation).toBe(`${sm.reservePct(aura.reserve!)}% Mana`);
    expect(window.compact).toBe('Reserved');
    expect(describeSkill(aura, { reservePct: 20 }).reservation).toBe('20% Mana');
  });

  it('marks a zero-cooldown row as a filler and names the bow family', () => {
    expect(describeSkill({ ...row('attack.fireball'), cd: 0 }).delay).toBe('None (Filler)');
    expect(describeSkill(row('attack.piercing_shot')).weapon).toBe('Bow or Crossbow');
  });

  it('returns the fixed field order and omits rows that do not apply', () => {
    expect(skillWindowEntries(describeSkill(row('attack.firestorm'))).map((entry) => entry.label))
      .toEqual(['Type', 'Target', 'Range', 'Area', 'Element', 'SP Cost', 'Delay']);
    expect(skillWindowEntries(describeSkill(row('aura.wraith_of_fury'))).map((entry) => entry.label))
      .toEqual(['Type', 'Target', 'Range', 'Element', 'Reservation']);
  });

  it('derives the Hits line from effects, never from prose', () => {
    expect(describeSkill(row('attack.ice_lance')).hits).toBe('2 hits at 55% each');
    expect(describeSkill(row('attack.whirlwind')).hits).toBe('6 hits at 17% each');
    expect(describeSkill(row('attack.sand_storm')).hits).toBe('20 Earth damage a second for 10 sec');
    // a row with no `hits` line has no repeat, even when it carries a crit rider
    expect(describeSkill(row('attack.backstab')).hits).toBeUndefined();
    expect(describeSkill(row('attack.fireball')).hits).toBeUndefined();
  });

  it('shows a channel sustain rate beside the start price, never inside it', () => {
    const prior = sm.byId['attack.whirlwind'];
    sm.byId['attack.whirlwind'] = { ...prior, channel: { mana_per_sec: 10 } };
    try {
      const row = sm.byId['attack.whirlwind'];
      expect(describeSkill(row).sustain).toBe('10 Mana/s');
      expect(describeSkill(row).sp).toBe('22');
      expect(describeSkill(row, { level: 10 }).sustain).toBe(
        `${Math.round(10 * (1 + 9 * sm.COST_LEVEL_STEP / 100))} Mana/s`);
      expect(skillWindowEntries(describeSkill(row)).map((entry) => entry.label))
        .toContain('Sustain');
      expect(describeSkill({ ...row, channel: undefined } as any).sustain).toBeUndefined();
    } finally {
      sm.byId['attack.whirlwind'] = prior;
    }
  });

  it('renders a DOT storm window with Duration and Hits (blizzard shape)', () => {
    const storm = {
      ...row('attack.blizzard'),
      duration: '8 sec',
      effects: [
        { stat: 'dot_dps', op: 'add_flat', value: 20, subject: 'target' },
        { stat: 'dot_sec', op: 'add_flat', value: 8, subject: 'target' },
      ],
    };
    const window = describeSkill(storm);
    expect(window.duration).toBe('8 sec');
    expect(window.hits).toBe('20 Cold damage a second for 8 sec');
    expect(window.compact).toBe('Area · 6x6 · 5 · 13 sec · 8 sec · 20 Cold damage a second for 8 sec');
    expect(skillWindowEntries(window).map((entry) => entry.label)).toEqual(
      ['Type', 'Target', 'Range', 'Area', 'Element', 'SP Cost', 'Delay', 'Duration', 'Hits']);
  });
});

describe('the live roster copy leaves derived facts to the fields', () => {
  const banned = ['single target', 'aoe', 'in range', 'all hit', 'while up'];
  const leadingStat = /^(aspd|hp regen|mana regen|fire damage flat)\b/i;

  it('does not restate targeting, duration or raw stat identifiers', () => {
    for (const row of sm.all()) {
      const effect = row.effect || '';
      for (const token of banned) expect(effect.toLowerCase()).not.toContain(token);
      expect(effect).not.toMatch(leadingStat);
    }
  });

  it('keeps the offline_targets column a single queue count', () => {
    for (const row of sm.all()) if (row.offline_targets) expect(row.offline_targets).toMatch(/^\d+$/);
  });

  it('describes a ray channel as discrete ticks with a hold, an end and trigger exclusion', () => {
    const rays = sm.all().filter((row) => row.action?.kind === 'ray-channel');
    expect(rays.length).toBeGreaterThan(0);
    for (const row of rays) {
      const window = describeSkill(row);
      const copy = `${row.effect || ''} ${window.sustain || ''} ${window.duration || ''}`;
      expect(copy, `${row.id} names its tick cadence`).toMatch(/tick/i);
      expect(copy, `${row.id} names the manual hold`).toMatch(/hold/i);
      expect(copy, `${row.id} names how the channel ends`).toMatch(/release|finish|complete|run dry/i);
      expect(copy, `${row.id} names trigger exclusion`).toMatch(/trigger/i);
      expect(window.sustain, `${row.id} prints its sustain price`).toBeTruthy();
    }
  });

  it('keeps a no-action area press one impact in copy, never a sequential sweep', () => {
    const swept = sm.all().filter((row) => row.type === 'attack' && !row.action
      && !(row.effects || []).some((effect) => effect.stat === 'hits' || effect.stat === 'dot_dps')
      && (row.area?.radius_m ?? 0) > 0);
    expect(swept.length).toBeGreaterThan(0);
    for (const row of swept) {
      expect(describeSkill(row).hits, `${row.id} has no mechanical Hits row`).toBeUndefined();
      expect(row.effect || '', `${row.id} does not promise per-frame damage/control`)
        .not.toMatch(/\b(one by one|in sequence|sequentially|each (?:spark|frame|tick)[^.]*(?:damage|shock|stun))\b/i);
    }
  });

  it('defines a live membership count on every circle, cone and line footprint', () => {
    for (const row of sm.all()) {
      if (row.type !== 'attack' && row.type !== 'curse') continue;
      const area = row.area as any;
      if (!area) continue;
      const multi = area.shape === 'line' || area.shape === 'cone'
        || (!area.shape && area.radius_m > 0) || (area.shape === 'circle' && area.radius_m > 0);
      if (!multi) continue;
      const reach = area.shape === 'line' ? area.length_m : area.radius_m;
      expect(area.max_targets, `${row.id} authors max_targets`).toBe(Math.max(1, Math.floor(reach)));
    }
  });

  it('keeps every storm and duration shape explicit', () => {
    for (const row of sm.all()) {
      const eff = row.effects || [];
      if (eff.some((e) => e.stat === 'dot_dps'))
        expect(eff.some((e) => e.stat === 'dot_sec'),
          `${row.id} names its own dot_sec`).toBe(true);
      if (row.offline_targets === '3') {
        const area = row.area;
        const liveArea = !!area && (area.radius_m > 0
          || (area.shape === 'line' && (area.length_m ?? 0) > 0 && (area.width_m ?? 0) > 0));
        expect(liveArea, `${row.id} pairs its queue count with a live area`).toBe(true);
      }
      if (row.type === 'attack' && row.duration) {
        const opensWindow = (row.rules || []).includes('self_window');
        const writesTarget = eff.some((e) => e.subject === 'target');
        // a storm hold: a ground circle whose guaranteed cold/earth/lightning control status
        // outlives the press holds it for the duration (no DOT involved)
        const stormHold = (row.area?.radius_m ?? 0) > 0 && row.cast?.delivery === 'ground'
          && ['cold', 'earth', 'lightning'].includes(row.element || '')
          && (row.rules || []).includes('guaranteed_status');
        // a channel spends its duration as its own active window; a burst volley
        // spends it as its emission window
        const channelActive = (row.action as any)?.kind === 'whirlwind-channel';
        const volleyWindow = (row.action as any)?.kind === 'projectile-burst'
          && eff.some((e) => e.stat === 'hits' && Number(e.value) > 1);
        expect(opensWindow || writesTarget || stormHold || channelActive || volleyWindow,
          `${row.id} spends its duration on a self window, a target debuff, a storm hold, its channel window or its volley window`).toBe(true);
      }
    }
  });

  it('prints every numeric effect in the player window', () => {
    for (const row of sm.all()) {
      const window = describeSkill(row);
      const text = `${row.effect || ''} ${window.duration || ''} ${window.hits || ''}`.replace(/−/g, '-');
      for (const e of row.effects || [])
        expect(text.includes(String(e.value)),
          `${row.id}:${e.stat}=${e.value}`).toBe(true);
    }
  });
});

describe('the mob skill window reads the mob shape', () => {
  it('does not require area or cast fields', () => {
    const basicStrike = { id: 'test.basic-strike', name: 'Fixture strike', mode: 'strike', element: null, cd: 7 } as const;
    expect('area' in basicStrike).toBe(false);
    expect(describeMobSkill(basicStrike)).toMatchObject({
      type: 'Monster (strike)',
      target: 'Player',
      element: 'Physical',
      delay: '7 sec',
      description: 'Replaces a basic swing.',
    });
  });

  it('marks a stand-off strike and its forced status', () => {
    const rangedStrike = { id: 'test.ranged-control', name: 'Fixture control', mode: 'strike', element: 'cold',
      status: 'chill', cast: { delivery: 'projectile', range: { basis: 'center', meters: 5 },
        windup_sec: 0.2, recovery_sec: 0.1 } } as const;
    expect(describeMobSkill(rangedStrike)).toMatchObject({
      target: 'Player (kept at range)',
      element: 'Cold',
      status: 'Inflicts Chill',
    });
  });
});
