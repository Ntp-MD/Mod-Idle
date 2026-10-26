import { describe, it, expect } from 'vitest';
import { MS, sm } from '../src/engine/client';
import { describeMobSkill, describeSkill, skillWindowEntries } from '../src/sim/combat/skill-copy';

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
    expect(describeSkill(row('attack.whirlwind')).hits).toBe('3 hits');
    expect(describeSkill(row('attack.sand_storm')).hits).toBe('20 Earth damage a second for 10 sec');
    // a lone hit_pct is accuracy (sidestep), not a repeat
    expect(describeSkill(row('attack.sidestep')).hits).toBeUndefined();
    expect(describeSkill(row('attack.fireball')).hits).toBeUndefined();
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

  it('keeps the targets column a single queue count', () => {
    for (const row of sm.all()) if (row.targets) expect(row.targets).toMatch(/^\d+$/);
  });

  it('keeps every storm and duration shape explicit', () => {
    for (const row of sm.all()) {
      const eff = row.effects || [];
      if (eff.some((e) => e.stat === 'dot_dps'))
        expect(eff.some((e) => e.stat === 'dot_sec'),
          `${row.id} names its own dot_sec`).toBe(true);
      if (row.targets === '3')
        expect(row.area && row.area.radius_m > 0,
          `${row.id} pairs its queue count with a live circle`).toBe(true);
      if (row.type === 'attack' && row.duration) {
        const opensWindow = (row.rules || []).includes('self_window');
        const writesTarget = eff.some((e) => e.subject === 'target');
        // a storm hold: a ground circle whose guaranteed cold/earth control status
        // outlives the press holds it for the duration (no DOT involved)
        const stormHold = (row.area?.radius_m ?? 0) > 0 && row.cast?.delivery === 'ground'
          && ['cold', 'earth'].includes(row.element || '')
          && (row.rules || []).includes('guaranteed_status');
        expect(opensWindow || writesTarget || stormHold,
          `${row.id} spends its duration on a self window, a target debuff or a storm hold`).toBe(true);
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
    const backstab = MS.skills.find((skill) => skill.id === 'mob.physical.backstab')!;
    expect('area' in backstab).toBe(false);
    expect(describeMobSkill(backstab)).toMatchObject({
      type: 'Monster (strike)',
      target: 'Player',
      element: 'Physical',
      delay: '9 sec',
      description: 'Replaces a basic swing.',
    });
  });

  it('marks a stand-off strike and its forced status', () => {
    const rimeSnare = MS.skills.find((skill) => skill.id === 'mob.cold.rime-snare')!;
    expect(describeMobSkill(rimeSnare)).toMatchObject({
      target: 'Player (kept at range)',
      element: 'Cold',
      status: 'Inflicts Chill',
    });
  });
});
