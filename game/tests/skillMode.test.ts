import { describe, it, expect } from 'vitest';
import { E, sm } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { castOnce, newSkillState, condOf, NO_COND } from '../src/sim/skills';
import { newMobStatusStore, setStacks } from '../src/sim/mobStatus';
import { newCurses, applyCurse } from '../src/sim/curse';
import type { Mob } from '../src/sim/types';

/**
 * The per-slot switch and each row's own condition list.
 *
 * A slotted skill fires when its cooldown is ready and its mana fits — that is `always`, and it stays
 * the default so nothing a player already owns changes behaviour. `never` silences a row, and
 * `conditional` gates it on the list that row carries: `boss`, `hpBelowPct`, `statusMissing`,
 * `minTargets` and `manaFloorPct`. The list is per row, so one rotation can hold a burst row for a boss
 * and a finisher for low pool at the same time; the legs are the five named ones, never free text.
 */

const mob = (kind = 'Medium', id = 'm1'): Mob => ({
  id, species: 'Rat', zone: 1, level: 90, kind, hp: 1e9, hpMax: 1e9,
  ps: 600, acc: 900, armour: 0, res: 0, evasion: 0, dodgeRate: 0, innate: ['fire'],
  damage: 'mixed', hitsPerSec: 1, atkTimer: 0,
} as Mob);

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
) {
  // this file gates the MODE, not the cooldown: every call starts ready, or a successful cast in an
  // earlier leg would silence the next one and the assertion would pass for the wrong reason
  s.cd = {};
  const group = Array.from({ length: groupSize }, (_, i) => mob(kind, `m${i + 1}`));
  const cast = castOnce(s, c, c.maxMana, group, {}, mulberry32(7), env);
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
});
