import { describe, it, expect } from 'vitest';
import { sm, E } from '../../src/engine/client';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { poolGear } from '../fixtures/sheetFixture';
import { newSkillState, effectsActive, toggleTrack, effectLine, describeFold } from '@sim/combat/skills';
import { newGame, tick, setLevel, huntZone } from '@sim/core/game';
import { placeStatus } from '@sim/combat/mobStatus';
import { eng } from '../../src/engine/client';
import { liveId, hasStat } from '../fixtures/liveSkill';

const MELEE = liveId(row => row.type === 'attack' && row.basis === 'phys' && row.area?.shape === 'cone' && !row.action, 'melee');
const CHAIN = liveId(row => row.action?.kind === 'chain-strike', 'chain');
const MANA_AURA = liveId(row => row.type === 'aura' && hasStat(row, 'mana_regen'), 'mana aura');
const SPEED_AURA = liveId(row => row.type === 'aura' && hasStat(row, 'attack_speed'), 'speed aura');
const ARMOUR_AURA = liveId(row => row.type === 'aura' && (row.effects ?? []).some((effect: any) => effect.stat === 'armour' && effect.op === 'add_flat'), 'armour aura');
const SHIELD_AURA = liveId(row => row.type === 'aura' && hasStat(row, 'energy_shield'), 'shield aura');
const EVASION_AURA = liveId(row => row.type === 'aura' && hasStat(row, 'evasion'), 'evasion aura');
const REGEN_AURA = liveId(row => row.type === 'aura' && hasStat(row, 'hp_regen'), 'regen aura');
const POWER_BUFF = liveId(row => row.type === 'buff' && hasStat(row, 'physical_power') && hasStat(row, 'elemental_alignment') && hasStat(row, 'elemental_resistance'), 'power buff');
const DEFENCE_BUFF = liveId(row => row.type === 'buff' && hasStat(row, 'damage_taken') && hasStat(row, 'armour'), 'defence buff');
const INSTANT_HEAL = liveId(row => row.type === 'heal' && hasStat(row, 'heal_instant'), 'instant heal');
const HEAL_OVER_TIME = liveId(row => row.type === 'heal' && hasStat(row, 'heal_per_sec'), 'heal over time');

const valueOf = (id: string, stat: string): number => sm.byId[id].effects!.find(effect => effect.stat === stat)!.value;
const row = (id: string) => sm.byId[id]!;
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
    const fold = effectsOf(SPEED_AURA, MANA_AURA, POWER_BUFF);
    expect(fold.add.attack_speed).toBe(valueOf(SPEED_AURA, 'attack_speed'));
    expect(fold.add.mana_regen).toBe(valueOf(MANA_AURA, 'mana_regen'));
    expect(fold.mult.physical_power).toBeCloseTo(valueOf(POWER_BUFF, 'physical_power'), 10);
    // two rows on the same stat compound rather than overwrite
    const both = effectsOf(POWER_BUFF, POWER_BUFF);
    expect(both.mult.physical_power).toBeCloseTo(Math.pow(valueOf(POWER_BUFF, 'physical_power'), 2), 10);
  });
});

describe('the sheet moves when a skill is up', () => {
  const base = () => buildCharacter(40, poolGear());

  it('each row changes the stat its own sentence names, by the amount it names', () => {
    const b = base();
    const fury = buildCharacter(40, poolGear(), {}, 0, effectsOf(SPEED_AURA));
    // the buff's number reaches the shared aspd formula, whose own cap then decides the result
    expect(fury.aspd).toBeCloseTo(
      eng.aspdOf(b.core.agi, b.weaponAspd, valueOf(SPEED_AURA, 'attack_speed')) * (1 - b.encumbrance), 6);

    const guard = buildCharacter(40, poolGear(), {}, 0, effectsOf(ARMOUR_AURA));
    expect(guard.armour - b.armour).toBe(valueOf(ARMOUR_AURA, 'armour'));

    const energy = buildCharacter(40, poolGear(), {}, 0, effectsOf(SHIELD_AURA));
    expect(energy.es - b.es).toBe(valueOf(SHIELD_AURA, 'energy_shield'));

    const grace = buildCharacter(40, poolGear(), {}, 0, effectsOf(EVASION_AURA));
    expect(grace.evasion - b.evasion).toBe(valueOf(EVASION_AURA, 'evasion'));

    const vit = buildCharacter(40, poolGear(), {}, 0, effectsOf(REGEN_AURA));
    expect(vit.hpRegen / b.hpRegen).toBeCloseTo(1 + valueOf(REGEN_AURA, 'hp_regen') / 100, 6);

    const war = buildCharacter(40, poolGear(), {}, 0, effectsOf(POWER_BUFF));
    expect(war.phys / b.phys).toBeCloseTo(valueOf(POWER_BUFF, 'physical_power'), 6);
    expect(war.resistance / b.resistance).toBeCloseTo(valueOf(POWER_BUFF, 'elemental_resistance'), 6);
  });

  it('damage taken is a multiplier on the incoming side, and Iron Will lowers it', () => {
    const will = effectsOf(DEFENCE_BUFF);
    const c = buildCharacter(40, poolGear(), {}, 0, will);
    expect(c.damageTaken).toBeCloseTo(valueOf(DEFENCE_BUFF, 'damage_taken'), 10);
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
    sk.owned[SPEED_AURA] = 0;
    sk.owned[POWER_BUFF] = 0;
    sk.auras[SPEED_AURA] = true;
    sk.buffs[POWER_BUFF] = true;
    sk.buffUp[POWER_BUFF] = 3;
    expect(effectsActive(sk).add.attack_speed).toBe(valueOf(SPEED_AURA, 'attack_speed'));
    expect(effectsActive(sk).mult.physical_power).toBe(valueOf(POWER_BUFF, 'physical_power'));
    sk.buffUp[POWER_BUFF] = 0;
    expect(effectsActive(sk).mult.physical_power).toBeUndefined();
    sk.auras[SPEED_AURA] = false;
    expect(effectsActive(sk).add.attack_speed).toBeUndefined();
  });

  it('the aura reservation still limits how many of them can be up', () => {
    const sk = newSkillState();
    let reserved = 0;
    for (const id of Object.keys(sm.byId)) {
      const s = sm.byId[id];
      if (s.type !== 'aura') continue;
      sk.owned[id] = 0;
      const pct = sm.reservePct(s.reserve ?? '') || 0;
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
    for (const id of auras) sk.owned[id] = 0;
    let reserved = 0;
    let refused = 0;
    for (const id of auras) {
      const pct = sm.reservePct(sm.byId[id].reserve ?? '');
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
    sk.owned[POWER_BUFF] = 0;
    sk.buffs[POWER_BUFF] = true;
    sk.buffUp[POWER_BUFF] = 6;
    expect(effectsActive(sk).mult.physical_power).toBe(valueOf(POWER_BUFF, 'physical_power'));
    toggleTrack(sk, POWER_BUFF);
    expect(sk.buffs[POWER_BUFF]).toBe(false);
    expect(sk.buffUp[POWER_BUFF]).toBe(0);
    expect(effectsActive(sk).mult.physical_power).toBeUndefined();
  });

  it('says a whole fold in the same words, not in stat keys', () => {
    const words = describeFold(effectsOf(ARMOUR_AURA, SPEED_AURA, DEFENCE_BUFF));
    expect(words).toContain(`armour +${valueOf(ARMOUR_AURA, 'armour')}`);
    expect(words).toContain(`attack speed +${valueOf(SPEED_AURA, 'attack_speed')}`);
    expect(words).toContain(`damage taken ×${valueOf(DEFENCE_BUFF, 'damage_taken').toFixed(2)}`);
    expect(words).not.toMatch(/attack_speed|damage_taken/);
    expect(describeFold(sm.aggregateEffects([]))).toBe('');
  });

  it('says each row in words a player can act on', () => {
    expect(effectLine(row(ARMOUR_AURA))).toContain(`armour +${valueOf(ARMOUR_AURA, 'armour')} flat`);
    expect(effectLine(row(SPEED_AURA))).toContain(`attack speed +${valueOf(SPEED_AURA, 'attack_speed')}%`);
    expect(effectLine(row(POWER_BUFF))).toContain(`physical power ×${valueOf(POWER_BUFF, 'physical_power')}`);
    expect(effectLine(row(MELEE))).toBe('');
  });
});

describe('heals read their own number', () => {
  it('Greater Heal restores once what its row states, not a per-second drip', () => {
    const s = newGame(52);
    huntZone(s, s.zone);
    setLevel(s, 60);
    s.zone = 5;
    s.skills.owned[INSTANT_HEAL] = 1;
    s.skills.list[0] = INSTANT_HEAL; s.skills.owned[INSTANT_HEAL] ??= 0;
    let guard = 0;
    while (!s.group.length && guard++ < 30) tick(s, {});
    expect(s.group.length).toBeGreaterThan(0);
    const c = buildCharacter(s.player.level, s.gear, {}, 0);
    const pct = valueOf(INSTANT_HEAL, 'heal_instant');
    s.player.hp = 1;
    s.player.mana = c.maxMana;
    const oneDose = (c.maxHp * pct) / 100;
    // A press costs its typed units, so a full bar always affords it — but the mob lands its own blow
    // first and a Push costs time, not the row. So the proof is the number the heal writes, read on the
    // tick it actually pays (the bound is a hang guard, never a time premise), not the bar it lands on.
    const seen = s.log.length;
    let doses: string[] = [];
    for (let i = 0; i < 200 && !doses.length; i++) {
      tick(s, {});
      doses = s.log.slice(seen).filter((l) => /at once/.test(l.text)).map((l) => l.text);
    }
    expect(doses.length).toBe(1); // one application, not eight
    const healed = Number(doses[0]!.match(/restores ([\d,.]+) HP/)![1].replace(/,/g, ''));
    expect(healed).toBeGreaterThan(oneDose * 0.9);
    expect(healed).toBeLessThan(oneDose * 2);
  });

  it('Heal keeps its drip shape: a per-second percentage over its own duration', () => {
    expect(row(HEAL_OVER_TIME).effects![0]!.stat).toBe('heal_per_sec');
    expect(String(row(HEAL_OVER_TIME).duration)).toMatch(/\d+ sec/);
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
    const burned = s.group[0].id;
    // a pool deep enough that the swing cannot end the body before the DoT step ticks the burn
    for (const m of s.group) m.hp = m.hpMax * 50;
    placeStatus(s.mobStatus, burned, 'burn', c, 100);
    s.fx = [];
    tick(s, {});
    const fire = (E.elements as any).colour.fire;
    const ticks = (s.fx || []).filter((e) => e.kind === 'hit' && e.side === 'field' && e.colour === fire);
    expect(ticks.length).toBeGreaterThan(0);
    // and every one of them names the body it was done to, so the screen can raise it over that plate
    expect(ticks.every((e) => e.mobId === burned)).toBe(true);
    // what has no plate of its own stays in the shared column: a kill names its body only so that card can
    // remember the blow that ended it, and the word itself is still read as a body leaves the field
    expect((s.fx || []).filter((e) => e.kind === 'kill').every((e) => !s.group.some((m) => m.id === e.mobId))).toBe(true);
    // and a status clock drew no weapon: the screen only swings when something swung
    expect(ticks.every((e) => e.via === 'dot')).toBe(true);
  });
});


describe('the ring carries the beats an animation is made of', () => {
  /** a field with a group on it, nothing else raised: the caller clears the ring before it watches */
  function hunting(seed = 30) {
    const s = newGame(seed);
    huntZone(s, s.zone);
    for (let i = 0; i < 60 && !s.group.length; i++) tick(s, {});
    expect(s.group.length).toBeGreaterThan(0);
    return s;
  }

  it('a swing names what carried the hit, so a blade is drawn for a blade', () => {
    const s = hunting();
    s.fx = [];
    for (let i = 0; i < 40 && !(s.fx || []).some((e) => e.kind === 'hit' && e.via === 'swing'); i++) tick(s, {});
    const swung = (s.fx || []).filter((e) => e.kind === 'hit' && e.via === 'swing');
    expect(swung.length).toBeGreaterThan(0);
    // a swing is aimed at one body, so it always names that body
    expect(swung.every((e) => !!e.mobId)).toBe(true);
  });

  it('a press says which row fired, so the cast order can light it', () => {
    const s = hunting();
    s.skills.list[0] = CHAIN; s.skills.owned[CHAIN] ??= 0;
    s.player.mana = 1e6;
    s.fx = [];
    // A cast may miss; wait for an actual hit before checking its source metadata.
    for (let i = 0; i < 40 && !(s.fx || []).some((e) => e.kind === 'hit' && e.via === 'cast'); i++) tick(s, {});
    const cast = (s.fx || []).find((e) => e.kind === 'cast');
    expect(cast).toBeTruthy();
    expect(s.skills.list).toContain(cast!.skillId);
    expect(cast!.side).toBe('self');
    const hits = (s.fx || []).filter((e) => e.kind === 'hit' && e.via === 'cast');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.skillId === cast!.skillId)).toBe(true);
  });

  it('a buff coming up is raised on the character half, with its own row', () => {
    const s = hunting();
    s.skills.owned[POWER_BUFF] = 0;
    s.skills.buffs[POWER_BUFF] = true;
    s.player.mana = 1e6;
    s.fx = [];
    tick(s, {});
    const up = (s.fx || []).find((e) => e.kind === 'buff');
    expect(up).toBeTruthy();
    expect(up!.skillId).toBe(POWER_BUFF);
    expect(up!.text).toBe(String((sm.byId[POWER_BUFF] as any).name));
    expect(s.skills.buffUp[POWER_BUFF]).toBeGreaterThan(0);
    // the clock it grants is the same fact, so the screen never has to guess a duration
    expect(up!.colour).toBe(((E.elements as any).colour as any)[(sm.byId[POWER_BUFF] as any).element] || (E.elements as any).physical_colour);
  });

  it('a heal says what the pool actually took back', () => {
    const s = hunting();
    s.hunting = false;
    s.group = [];
    s.player.hp = 1;
    s.healUp = { pctPerSec: 0.05, secLeft: 3 };
    s.fx = [];
    tick(s, {});
    const healed = (s.fx || []).filter((e) => e.kind === 'heal' && e.side === 'self');
    expect(healed.length).toBeGreaterThan(0);
    // the number is the movement, not the price: it reads as a gain and carries no minus
    expect(healed[0].text.startsWith('+')).toBe(true);
    expect(Number(healed[0].text.slice(1).replace(/,/g, ''))).toBeGreaterThan(0);
  });

  it('a level is raised on the character half, where its own plate is read', () => {
    const s = hunting();
    // one kill's XP is all that is missing, so the very next death takes the level
    s.player.xp = eng.xpToNext(s.player.level);
    const before = s.player.level;
    s.group[0].hp = 0;
    s.fx = [];
    tick(s, {});
    const level = (s.fx || []).find((e) => e.kind === 'level');
    expect(s.player.level).toBeGreaterThan(before);
    expect(level).toBeTruthy();
    expect(level!.side).toBe('self');
    expect(level!.text).toContain(String(s.player.level));
  });
});

describe('the ring carries the amount and the striker, not only the words', () => {
  /** a field with a group on it, nothing else raised: the caller clears the ring before it watches */
  function hunting(seed = 30) {
    const s = newGame(seed);
    huntZone(s, s.zone);
    for (let i = 0; i < 60 && !s.group.length; i++) tick(s, {});
    expect(s.group.length).toBeGreaterThan(0);
    return s;
  }

  it('carries the amount behind a figure, so a sum is never a parse of the printed text', () => {
    const s = hunting();
    // a pool deep enough that no blow ends a body: then a hit can be read against the HP it actually took off
    for (const m of s.group) m.hp = m.hpMax * 50;
    let one: { value: number; lost: number; text: string } | null = null;
    for (let i = 0; i < 200 && !one; i++) {
      s.fx = [];
      const was = new Map(s.group.map((m) => [m.id, m.hp]));
      tick(s, {});
      const hits = (s.fx || []).filter((e) => e.kind === 'hit' && e.mobId);
      if (hits.length !== 1) continue;
      const body = s.group.find((m) => m.id === hits[0].mobId);
      const before = was.get(hits[0].mobId!);
      if (!body || before === undefined) continue;
      one = { value: hits[0].value || 0, lost: before - body.hp, text: hits[0].text };
    }
    expect(one).toBeTruthy();
    expect(one!.value).toBeGreaterThan(0);
    expect(one!.value).toBeCloseTo(one!.lost, 6);
    // the figure the plate parks and the figure it prints are the same number, once
    expect(one!.text).toBe(eng.fmt(one!.value));
  });

  it('names the body that carried a blow onto the character, so the striker can lean', () => {
    const s = hunting();
    const fielded = new Set(s.group.map((m) => m.id));
    s.fx = [];
    // Two blows are not strikers: a status clock ticking on the character names no body, because no body
    // is swinging, and a field-side `block` is the mob answering *our* swing — it names the body that
    // answered (`mobId`), not a body that attacked. The invariant is on what came off a body onto us.
    const swung = (e: { kind: string; side?: string; via?: string }) =>
      (e.kind === 'taken' || e.kind === 'block') && e.side === 'self' && e.via !== 'dot';
    for (let i = 0; i < 200 && !(s.fx || []).some(swung); i++) {
      const onField = s.group.map((m) => m.id);
      tick(s, {});
      for (const id of onField) fielded.add(id);
      for (const m of s.group) fielded.add(m.id);
    }
    const landed = (s.fx || []).filter(swung);
    expect(landed.length).toBeGreaterThan(0);
    // a striker that fell in the same second it swung is still a body that was on the field
    const offField = landed.filter((e) => !e.byId || !fielded.has(e.byId!)).map((e) => `${e.kind}@${e.sec} by ${e.byId ?? 'nobody'}`);
    expect(offField).toEqual([]);
    // and what did land has an amount of its own, so the character's card parks a number and not a word
    expect((s.fx || []).filter((e) => e.kind === 'taken').every((e) => (e.value || 0) > 0)).toBe(true);
  });

  it('binds a death to the body that died — and the group still loses it that same tick', () => {
    const s = hunting();
    for (let i = 0; i < 4000 && !(s.fx || []).some((e) => e.kind === 'kill'); i++) tick(s, {});
    const kill = (s.fx || []).find((e) => e.kind === 'kill');
    expect(kill).toBeTruthy();
    expect(kill!.mobId).toBeTruthy();
    // presentation keeps the card; the sim keeps the truth. A remembered body never stays in the group, and
    // nothing with its HP spent is left standing on the field
    expect(s.group.some((m) => m.id === kill!.mobId)).toBe(false);
    expect(s.group.every((m) => m.hp > 0)).toBe(true);
  });
});
