import { describe, it, expect } from 'vitest';
import { E, sm } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { castOnce, newSkillState, condOf, NO_COND, appliedStatusOf } from '../src/sim/skills';
import { newMobStatusStore, setStacks, placeStatus, stepMob } from '../src/sim/mobStatus';
import { newCurses, applyCurse } from '../src/sim/curse';
import type { Mob } from '../src/sim/types';
import { mobFixture } from './mobFixture';

/**
 * The per-slot switch and each row's own condition list.
 *
 * A slotted skill fires when its cooldown is ready and its mana fits — that is `always`, and it stays
 * the default so nothing a player already owns changes behaviour. `never` silences a row, and
 * `conditional` gates it on the list that row carries: `boss`, `hpBelowPct`, `statusMissing`,
 * `minTargets`, `manaFloorPct`, `statusPresent`, `statusStacksAtLeast` and `selfDebuffed`. The list is
 * per row, so one rotation can hold a burst row for a boss and a finisher for low pool at the same time;
 * the legs are the named ones, never free text.
 */

  const mob = (kind = 'Medium', id = 'm1'): Mob => mobFixture({ id, kind, level: 90, ps: 600, acc: 900 });

/** A slotted attack row whose press always lands (the target has no evasion and no dodge). */
const ATTACK = 'attack.cleave';

/** One row's list, with every leg the caller did not name left off. */
const cond = (patch: Partial<ReturnType<typeof condOf>> = {}) => ({ ...NO_COND, ...patch });

function armed(mode: 'always' | 'conditional' | 'never', patch = {}) {
  const s = newSkillState();
  s.list[0] = ATTACK; s.owned[ATTACK] ??= 0;
  s.xp[ATTACK] = 8000;
  s.mode[ATTACK] = mode;
  s.conditions[ATTACK] = { ...NO_COND, ...patch };
  return s;
}

function casts(
  s: ReturnType<typeof newSkillState>,
  c: ReturnType<typeof buildCharacter>,
  kind = 'Medium',
  env: any = {},
  groupSize = 1,
  statuses: any = {},
) {
  // this file gates the MODE, not the cooldown: every call starts ready, or a successful cast in an
  // earlier leg would silence the next one and the assertion would pass for the wrong reason
  s.cd = {};
  const group = Array.from({ length: groupSize }, (_, i) => mob(kind, `m${i + 1}`));
  const cast = castOnce(s, c, c.maxMana, group, statuses, mulberry32(7), env);
  return cast ? cast.id : null;
}

describe('a slot picks when it may fire', () => {
  const c = { ...buildCharacter(90, emptyGear()), weaponName: 'one-handed axe' };

  it('casts when the mode is always, which is the default', () => {
    const s = armed('always');
    expect(casts(s, c)).toBe(ATTACK);
    // the field itself is optional: a state that never set a mode behaves as `always`
    const fresh = newSkillState();
    fresh.list[0] = ATTACK; fresh.owned[ATTACK] ??= 0;
    fresh.xp[ATTACK] = 8000;
    expect(casts(fresh, c)).toBe(ATTACK);
  });

  it('never silences the row, and the next ready slot takes the tick instead', () => {
    const s = armed('never');
    expect(casts(s, c)).toBeNull();
    // a second slot set back to `always` still fires — `never` is per skill, not a bar-wide switch
    const other = sm.of('attack').find((k: any) => k.id !== ATTACK) as any;
    s.list[1] = other.id; s.owned[other.id] ??= 0;
    s.xp[other.id] = 8000;
    expect(casts(s, c)).toBe(other.id);
  });

  it('an always row is never read against its own list', () => {
    // the legs only answer a `conditional` row, which keeps `when` the one switch on the slot: a list
    // left behind by an earlier setting cannot hold a row the player set back to `always`
    const s = armed('always', { boss: true });
    expect(casts(s, c)).toBe(ATTACK);
  });

  it('a conditional row holds until one of its own legs passes', () => {
    const s = armed('conditional');
    // nothing enabled and nothing true: held
    expect(casts(s, c)).toBeNull();
    // the `boss` leg, against a boss target
    s.conditions[ATTACK] = cond({ boss: true });
    expect(casts(s, c, 'Medium')).toBeNull();
    expect(casts(s, c, 'Boss · Shepherd')).toBe(ATTACK);
    // the `hpBelowPct` leg, read off the pool the env reports
    s.conditions[ATTACK] = cond({ hpBelowPct: 50 });
    expect(casts(s, c, 'Medium', { missingHpPct: 20 })).toBeNull();
    expect(casts(s, c, 'Medium', { missingHpPct: 60 })).toBe(ATTACK);
  });

  it('two rows wait on two different things in the same rotation', () => {
    // the whole point of the per-row list: the burst row is for the boss and the finisher for the pool
    const other = sm.of('attack').find((k: any) => k.id !== ATTACK) as any;
    const s = newSkillState();
    s.list[0] = ATTACK; s.owned[ATTACK] ??= 0;
    s.list[1] = other.id; s.owned[other.id] ??= 0;
    s.xp[ATTACK] = 8000;
    s.xp[other.id] = 8000;
    s.mode[ATTACK] = 'conditional';
    s.mode[other.id] = 'conditional';
    s.conditions[ATTACK] = cond({ boss: true });
    s.conditions[other.id] = cond({ hpBelowPct: 50 });
    // a boss with a deep pool: only the boss row answers
    expect(casts(s, c, 'Boss · Shepherd', { missingHpPct: 10 })).toBe(ATTACK);
    // a normal mob on a thin pool: only the finisher answers
    expect(casts(s, c, 'Medium', { missingHpPct: 90 })).toBe(other.id);
    // neither fact: the tick goes to nobody
    expect(casts(s, c, 'Medium', { missingHpPct: 10 })).toBeNull();
  });

  it('the group-width leg holds an AoE row until the fight is wide enough', () => {
    const s = armed('conditional', { minTargets: 3 });
    expect(casts(s, c, 'Medium', {}, 1)).toBeNull();
    expect(casts(s, c, 'Medium', {}, 2)).toBeNull();
    expect(casts(s, c, 'Medium', {}, 3)).toBe(ATTACK);
    expect(casts(s, c, 'Medium', {}, 5)).toBe(ATTACK);
  });

  it('the mana floor makes a row stand down rather than drain the pool', () => {
    // a floor at the whole pool can never be left intact by a press that costs anything
    const s = armed('conditional', { boss: true, manaFloorPct: 100 });
    expect(casts(s, c, 'Boss · Shepherd')).toBeNull();
    // the same row with a floor the press clears fires, and the leg alone never holds it back
    s.conditions[ATTACK] = cond({ boss: true, manaFloorPct: 1 });
    expect(casts(s, c, 'Boss · Shepherd')).toBe(ATTACK);
    // and a floor is not a condition: with no other leg set, the row still waits
    s.conditions[ATTACK] = cond({ manaFloorPct: 1 });
    expect(casts(s, c, 'Boss · Shepherd')).toBeNull();
  });

  it('the condition legs are data, not per-skill prose', () => {
    // whatever a save carries is what the loop reads; a save from before the switch existed gets the
    // defaults the loader writes (no list at all, which is every leg off)
    expect(E.skill_xp.level_cap).toBeGreaterThan(1);
    const s = armed('conditional');
    expect(casts(s, c, 'Boss · Shepherd', { missingHpPct: 99 })).toBeNull();
  });

  it('a conditional Element row fires only while the target is missing its own element status', () => {
    const statusStore = newMobStatusStore();
    const FLAME = 'attack.fireball';                          // element `fire` → applies `burn`
    const s = newSkillState();
    s.list[0] = FLAME; s.owned[FLAME] ??= 0;
    s.xp[FLAME] = 8000;
    s.mode[FLAME] = 'conditional';
    // the flag is off, so nothing in the list holds
    s.conditions[FLAME] = cond();
    expect(casts(s, c, 'Medium', { mobStatus: statusStore })).toBeNull();
    // flag on and the target is clear of burn: it fires. Which status a row carries is read off the
    // roster (`elements.status_of` + the row's own `element`), never typed per skill.
    s.conditions[FLAME] = cond({ statusMissing: ['burn'] });
    expect(casts(s, c, 'Medium', { mobStatus: statusStore })).toBe(FLAME);
    // the target is already burning: held again — this is what stops a rotation re-pressing a DoT
    setStacks(statusStore, 'm1', 'burn', 3, 10);
    expect(casts(s, c, 'Medium', { mobStatus: statusStore })).toBeNull();
  });

  it('a conditional curse row fires only while that curse is not already on the target', () => {
    const curses = newCurses();
    const WEAKEN = 'curse.weaken';                            // a curse row keys the flag by its own id
    const s = newSkillState();
    s.list[0] = WEAKEN; s.owned[WEAKEN] ??= 0;
    s.xp[WEAKEN] = 8000;
    s.mode[WEAKEN] = 'conditional';
    s.conditions[WEAKEN] = cond({ statusMissing: [WEAKEN] });
    expect(casts(s, c, 'Medium', { curses })).toBe(WEAKEN);
    // the curse is up now: the row holds instead of re-pressing the same line every cooldown
    applyCurse(curses, 'm1', sm.byId[WEAKEN]);
    expect(casts(s, c, 'Medium', { curses })).toBeNull();
  });

  it('a payoff row is not offered a maintenance leg just because it carries an Element', () => {
    expect(appliedStatusOf(sm.byId['attack.detonate'])).toBeNull();
    expect(appliedStatusOf(sm.byId['attack.shatter'])).toBeNull();
    expect(appliedStatusOf(sm.byId['attack.fireball'])).toBe('burn');
  });

  it('a payoff row waits for the status it exploits, at any stack or a named floor', () => {
    const DETONATE = 'attack.detonate';
    const s = newSkillState();
    s.list[0] = DETONATE; s.owned[DETONATE] ??= 0;
    s.xp[DETONATE] = 8000;
    s.mode[DETONATE] = 'conditional';
    s.conditions[DETONATE] = cond({ statusPresent: true });
    expect(casts(s, c, 'Medium', { mobStatus: newMobStatusStore() })).toBeNull();
    const anyBurn = newMobStatusStore();
    setStacks(anyBurn, 'm1', 'burn', 1, 10);
    expect(casts(s, c, 'Medium', { mobStatus: anyBurn })).toBe(DETONATE);
    // the same leg with a number: one stack is not enough, three are
    s.conditions[DETONATE] = cond({ statusPresent: true, statusStacksAtLeast: 3 });
    expect(casts(s, c, 'Medium', { mobStatus: anyBurn })).toBeNull();
    const threeBurn = newMobStatusStore();
    setStacks(threeBurn, 'm1', 'burn', 3, 10);
    expect(casts(s, c, 'Medium', { mobStatus: threeBurn })).toBe(DETONATE);
  });

  it('a cleanse row waits until the character itself carries a status', () => {
    const s = armed('conditional', { selfDebuffed: true });
    expect(casts(s, c, 'Medium', {}, 1, {})).toBeNull();
    expect(casts(s, c, 'Medium', {}, 1, { poison: { stacks: 2, secLeft: 8, perSec: 1 } })).toBe(ATTACK);
  });

  it('a payoff press spends the stacks and a spread row copies them before spending', () => {
    const DETONATE = 'attack.detonate';
    const s = newSkillState();
    s.list[0] = DETONATE; s.owned[DETONATE] ??= 0;
    s.xp[DETONATE] = 8000;
    const store = newMobStatusStore();
    setStacks(store, 'm1', 'burn', 4, 10);
    const cast = castOnce(s, c, c.maxMana, [mob()], {}, mulberry32(7), { mobStatus: store });
    expect(cast?.consumed).toEqual([{ status: 'burn', stacks: 4 }]);
    expect(store.m1.statuses.burn).toBeUndefined();

    const CATALYST = 'attack.catalyst';
    const spreadState = newSkillState();
    spreadState.list[0] = CATALYST; spreadState.owned[CATALYST] ??= 0;
    spreadState.xp[CATALYST] = 8000;
    const spreadStore = newMobStatusStore();
    setStacks(spreadStore, 'm1', 'poison', 3, 10);
    const spread = castOnce(spreadState, c, c.maxMana, [mob('Medium', 'm1'), mob('Medium', 'm2'), mob('Medium', 'm3')], {}, mulberry32(7), { mobStatus: spreadStore });
    expect(spread?.consumed).toEqual([{ status: 'poison', stacks: 3 }]);
    expect(spreadStore.m2.statuses.poison?.stacks).toBe(3);
    expect(spreadStore.m3.statuses.poison?.stacks).toBe(3);
  });

  it('a bonus-vs-status row hits a chilled target harder than a clear one', () => {
    const SHATTER = 'attack.shatter';
    const c2 = { ...c, weaponName: 'staff' };
    const plain = newSkillState();
    plain.list[0] = SHATTER; plain.owned[SHATTER] ??= 0; plain.xp[SHATTER] = 8000;
    const plainCast = castOnce(plain, c2, c2.maxMana, [mob()], {}, mulberry32(7), { mobStatus: newMobStatusStore() });
    const chilledStore = newMobStatusStore();
    placeStatus(chilledStore, 'm1', 'chill', c2, 10);
    const chilled = newSkillState();
    chilled.list[0] = SHATTER; chilled.owned[SHATTER] ??= 0; chilled.xp[SHATTER] = 8000;
    const chilledCast = castOnce(chilled, c2, c2.maxMana, [mob()], {}, mulberry32(7), { mobStatus: chilledStore });
    expect(chilledCast!.byMob[0].amount).toBeGreaterThan(plainCast!.byMob[0].amount);
  });

  it('shock survives one world tick, so Overload can read the setup press', () => {
    const c2 = { ...c, weaponName: 'staff' };
    const store = newMobStatusStore();
    const setup = newSkillState();
    setup.list[0] = 'attack.chain_lightning'; setup.owned['attack.chain_lightning'] ??= 0; setup.xp['attack.chain_lightning'] = 8000;
    castOnce(setup, c2, c2.maxMana, [mob()], {}, mulberry32(7), { mobStatus: store });
    expect(store.m1.statuses.shock?.secLeft).toBeGreaterThan(1);
    stepMob(store, 'm1');
    const OVERLOAD = 'attack.overload';
    const payoff = newSkillState();
    payoff.list[0] = OVERLOAD; payoff.owned[OVERLOAD] ??= 0; payoff.xp[OVERLOAD] = 8000;
    payoff.mode[OVERLOAD] = 'conditional';
    payoff.conditions[OVERLOAD] = cond({ statusPresent: true });
    const cast = castOnce(payoff, c2, c2.maxMana, [mob()], {}, mulberry32(7), { mobStatus: store });
    expect(cast?.id).toBe(OVERLOAD);
  });

  it('Earth Shock writes the crippled status Aftershock reads', () => {
    const c2 = { ...c, weaponName: 'staff' };
    const store = newMobStatusStore();
    const shock = newSkillState();
    shock.list[0] = 'attack.earth_shock'; shock.owned['attack.earth_shock'] ??= 0; shock.xp['attack.earth_shock'] = 8000;
    castOnce(shock, c2, c2.maxMana, [mob()], {}, mulberry32(7), { mobStatus: store });
    expect(store.m1.statuses.crippled?.secLeft).toBeGreaterThan(0);
    const AFTERSHOCK = 'attack.aftershock';
    const plain = newSkillState();
    plain.list[0] = AFTERSHOCK; plain.owned[AFTERSHOCK] ??= 0; plain.xp[AFTERSHOCK] = 8000;
    const plainCast = castOnce(plain, c2, c2.maxMana, [mob()], {}, mulberry32(7), { mobStatus: newMobStatusStore() });
    const payoff = newSkillState();
    payoff.list[0] = AFTERSHOCK; payoff.owned[AFTERSHOCK] ??= 0; payoff.xp[AFTERSHOCK] = 8000;
    const payoffCast = castOnce(payoff, c2, c2.maxMana, [mob()], {}, mulberry32(7), { mobStatus: store });
    expect(payoffCast!.byMob[0].amount).toBeGreaterThan(plainCast!.byMob[0].amount);
  });
});
