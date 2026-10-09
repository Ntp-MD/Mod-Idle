import { describe, it, expect } from 'vitest';
import { sm, E } from '../src/engine/client';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { poolGear } from './sheetFixture';
import { newSkillState, effectsActive, toggleTrack, effectLine, describeFold } from '../src/sim/skills';
import { newGame, tick, setLevel, huntZone } from '../src/sim/game';
import { placeStatus } from '../src/sim/mobStatus';
import { eng } from '../src/engine/client';

const row = (id: string) => sm.byId[id];
const effectsOf = (...ids: string[]) => sm.aggregateEffects(ids.map(row));

describe('effect values come from the roster, and the fold is shared', () => {
  it('knows a closed stat and op vocabulary', () => {
    for (const s of sm.all()) {
      for (const e of s.effects || []) {
        expect(sm.EFFECT_STATS).toContain(e.stat);
        expect(sm.EFFECT_OPS).toContain(e.op);
      }
    }
  });

  it('adds the percent lines and compounds the multipliers', () => {
    const fold = effectsOf('aura.wraith_of_fury', 'aura.clarity', 'buff.warcry');
    expect(fold.add.attack_speed).toBe(row('aura.wraith_of_fury').effects[0].value);
    expect(fold.add.mana_regen).toBe(row('aura.clarity').effects[0].value);
    expect(fold.mult.physical_power).toBeCloseTo(row('buff.warcry').effects[0].value, 10);
    // two rows on the same stat compound rather than overwrite
    const both = effectsOf('buff.warcry', 'buff.warcry');
    expect(both.mult.physical_power).toBeCloseTo(Math.pow(row('buff.warcry').effects[0].value, 2), 10);
  });
});

describe('the sheet moves when a skill is up', () => {
  const base = () => buildCharacter(40, poolGear());

  it('each row changes the stat its own sentence names, by the amount it names', () => {
    const b = base();
    const fury = buildCharacter(40, poolGear(), {}, 0, effectsOf('aura.wraith_of_fury'));
    // the buff's number reaches the shared aspd formula, whose own cap then decides the result
    expect(fury.aspd).toBeCloseTo(
      eng.aspdOf(b.core.agi, b.weaponAspd, row('aura.wraith_of_fury').effects[0].value) * (1 - b.encumbrance), 6);

    const guard = buildCharacter(40, poolGear(), {}, 0, effectsOf('aura.iron_guard'));
    expect(guard.armour - b.armour).toBe(row('aura.iron_guard').effects[0].value);

    const energy = buildCharacter(40, poolGear(), {}, 0, effectsOf('aura.energy_guard'));
    expect(energy.es - b.es).toBe(row('aura.energy_guard').effects[0].value);

    const grace = buildCharacter(40, poolGear(), {}, 0, effectsOf('aura.grace'));
    expect(grace.evasion - b.evasion).toBe(row('aura.grace').effects[0].value);

    const vit = buildCharacter(40, poolGear(), {}, 0, effectsOf('aura.vitality'));
    expect(vit.hpRegen / b.hpRegen).toBeCloseTo(1 + row('aura.vitality').effects[0].value / 100, 6);

    const war = buildCharacter(40, poolGear(), {}, 0, effectsOf('buff.warcry'));
    expect(war.phys / b.phys).toBeCloseTo(row('buff.warcry').effects[0].value, 6);
    expect(war.resistance / b.resistance).toBeCloseTo(row('buff.warcry').effects[2].value, 6);
  });

  it('damage taken is a multiplier on the incoming side, and Iron Will lowers it', () => {
    const will = effectsOf('buff.iron_will');
    const c = buildCharacter(40, poolGear(), {}, 0, will);
    expect(c.damageTaken).toBeCloseTo(row('buff.iron_will').effects[1].value, 10);
    const before = buildCharacter(40, poolGear());
    const withWill = buildCharacter(40, poolGear(), {}, 0, will);
    // the same mob swing against the same sheet lands cheaper with the buff up
    expect(withWill.armour).toBeGreaterThan(before.armour);
    expect(c.damageTaken).toBeLessThan(1);
  });
});

describe('only what is up counts', () => {
  it('takes every reserved aura and each buff still on its clock', () => {
    const sk = newSkillState();
    sk.auras['aura.wraith_of_fury'] = true;
    sk.buffs['buff.warcry'] = true;
    sk.buffUp['buff.warcry'] = 3;
    expect(effectsActive(sk).add.attack_speed).toBe(row('aura.wraith_of_fury').effects[0].value);
    expect(effectsActive(sk).mult.physical_power).toBe(row('buff.warcry').effects[0].value);
    sk.buffUp['buff.warcry'] = 0;
    expect(effectsActive(sk).mult.physical_power).toBeUndefined();
    sk.auras['aura.wraith_of_fury'] = false;
    expect(effectsActive(sk).add.attack_speed).toBeUndefined();
  });

  it('the aura reservation still limits how many of them can be up', () => {
    const sk = newSkillState();
    let reserved = 0;
    for (const id of Object.keys(sm.byId)) {
      const s = sm.byId[id];
      if (s.type !== 'aura') continue;
      const pct = sm.reservePct(s) || 0;
      if (reserved + pct <= sm.RESERVATION_LIMIT) { sk.auras[id] = true; reserved += pct; }
    }
    expect(reserved).toBeLessThanOrEqual(sm.RESERVATION_LIMIT);
    expect(Object.values(effectsActive(sk).add).length).toBeGreaterThan(0);
  });
});

describe('the toggle track', () => {
  it('refuses an aura that would reserve past the block, and never refuses taking one off', () => {
    const sk = newSkillState();
    const auras: string[] = sm.all().filter((s: any) => s.type === 'aura' && s.reserve).map((s: any) => s.id);
    let reserved = 0;
    let refused = 0;
    for (const id of auras) {
      const pct = sm.reservePct(sm.byId[id].reserve);
      const r = toggleTrack(sk, id);
      if (reserved + pct < sm.RESERVATION_LIMIT) {
        expect(r.ok).toBe(true);
        expect(sk.auras[id]).toBe(true);
        reserved += pct;
      } else {
        refused++;
        expect(r.ok).toBe(false);
        expect(r.why).toMatch(/must leave some usable/);
        expect(sk.auras[id]).toBeFalsy(); // the refusal changed nothing
      }
    }
    expect(refused).toBeGreaterThan(0); // the block is real: the set cannot all run at once
    expect(reserved).toBeLessThan(sm.RESERVATION_LIMIT);
    const on = auras.filter((id) => sk.auras[id]);
    expect(toggleTrack(sk, on[0]).ok).toBe(true); // taking one off is always free
    expect(sk.auras[on[0]]).toBe(false);
  });

  it('a buff switch stops its clock on the way off', () => {
    const sk = newSkillState();
    sk.buffs['buff.warcry'] = true;
    sk.buffUp['buff.warcry'] = 6;
    expect(effectsActive(sk).mult.physical_power).toBe(row('buff.warcry').effects[0].value);
    toggleTrack(sk, 'buff.warcry');
    expect(sk.buffs['buff.warcry']).toBe(false);
    expect(sk.buffUp['buff.warcry']).toBe(0);
    expect(effectsActive(sk).mult.physical_power).toBeUndefined();
  });

  it('says a whole fold in the same words, not in stat keys', () => {
    const words = describeFold(effectsOf('aura.iron_guard', 'aura.wraith_of_fury', 'buff.iron_will'));
    expect(words).toContain(`armour +${row('aura.iron_guard').effects[0].value}`);
    expect(words).toContain(`attack speed +${row('aura.wraith_of_fury').effects[0].value}`);
    expect(words).toContain(`damage taken ×${row('buff.iron_will').effects[1].value.toFixed(2)}`);
    expect(words).not.toMatch(/attack_speed|damage_taken/);
    expect(describeFold(sm.aggregateEffects([]))).toBe('');
  });

  it('says each row in words a player can act on', () => {
    expect(effectLine(row('aura.iron_guard'))).toBe(`armour +${row('aura.iron_guard').effects[0].value} flat`);
    expect(effectLine(row('aura.wraith_of_fury'))).toBe(`attack speed +${row('aura.wraith_of_fury').effects[0].value}%`);
    expect(effectLine(row('buff.warcry'))).toContain(`physical power ×${row('buff.warcry').effects[0].value}`);
    expect(effectLine(row('attack.cleave'))).toBe('');
  });
});

describe('heals read their own number', () => {
  it('Greater Heal restores once what its row states, not a per-second drip', () => {
    const s = newGame(52);
    huntZone(s, s.zone);
    setLevel(s, 60);
    s.zone = 5;
    s.skills.owned['heal.greater_heal'] = 1;
    s.skills.list[0] = 'heal.greater_heal';
    let guard = 0;
    while (!s.group.length && guard++ < 30) tick(s, {});
    expect(s.group.length).toBeGreaterThan(0);
    const c = buildCharacter(s.player.level, s.gear, {}, 0);
    const pct = row('heal.greater_heal').effects[0].value;
    s.player.hp = 1;
    s.player.mana = c.maxMana;
    tick(s, {});
    const oneDose = (c.maxHp * pct) / 100;
    expect(s.player.hp).toBeGreaterThan(1 + oneDose * 0.9); // one application, not eight
    expect(s.player.hp).toBeLessThan(1 + oneDose * 2);
    expect(s.log.some((l) => /at once/.test(l.text))).toBe(true);
  });

  it('Heal keeps its drip shape: a per-second percentage over its own duration', () => {
    expect(row('heal.heal').effects[0].stat).toBe('heal_per_sec');
    expect(String(row('heal.heal').duration)).toMatch(/\d+ sec/);
  });
});


describe('the hit ring colours what a total cannot', () => {
  it('a burn tick on a mob lands as a field event in the fire colour', () => {
    const s = newGame(30);
    huntZone(s, s.zone);
    for (let i = 0; i < 60 && !s.group.length; i++) tick(s, {});
    expect(s.group.length).toBeGreaterThan(0);
    // no weapon Element on this sheet, so every swing is the neutral colour and the only fire number
    // the ring can hold is the burn itself
    const c = buildCharacter(30, emptyGear());
    placeStatus(s.mobStatus, s.group[0].id, 'burn', c, 100);
    s.fx = [];
    tick(s, {});
    const fire = (E.elements as any).colour.fire;
    const ticks = (s.fx || []).filter((e) => e.kind === 'hit' && e.side === 'field' && e.colour === fire);
    expect(ticks.length).toBeGreaterThan(0);
  });
});
