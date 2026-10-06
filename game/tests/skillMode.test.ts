import { describe, it, expect } from 'vitest';
import { E, sm } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '../src/sim/player';
import { castOnce, newSkillState } from '../src/sim/skills';
import { newMobStatusStore, setStacks } from '../src/sim/mobStatus';
import { newCurses, applyCurse } from '../src/sim/curse';
import type { Mob } from '../src/sim/types';

/**
 * §14 · the per-slot switch and the one shared condition list.
 *
 * A slotted skill fires when its cooldown is ready and its mana fits — that is `always`, and it stays
 * the default so nothing a player already owns changes behaviour. `never` silences a row, and
 * `conditional` gates it on the shared list: `boss` and `hpBelowPct`. The list is shared by every
 * conditional slot, so a new condition is one entry, never free text per skill.
 */

const mob = (kind = 'Medium'): Mob => ({
  id: 'm1', species: 'Rat', zone: 1, level: 90, kind, hp: 1e9, hpMax: 1e9,
  ps: 600, acc: 900, armour: 0, res: 0, evasion: 0, dodgeRate: 0, innate: ['fire'],
  damage: 'mixed', hitsPerSec: 1, atkTimer: 0,
} as Mob);

/** A slotted attack row whose press always lands (the target has no evasion and no dodge). */
const ATTACK = 'attack.cleave';

function armed(mode: 'always' | 'conditional' | 'never', conditions: { boss: boolean; hpBelowPct: number; statusMissing?: string[] }) {
  const s = newSkillState();
  s.list[0] = ATTACK;
  s.xp[ATTACK] = 8000;
  s.mode[ATTACK] = mode;
  s.conditions = { statusMissing: [], ...conditions };
  return s;
}

function casts(s: ReturnType<typeof newSkillState>, c: ReturnType<typeof buildCharacter>, kind = 'Medium', env: any = {}) {
  // this file gates the MODE, not the cooldown: every call starts ready, or a successful cast in an
  // earlier leg would silence the next one and the assertion would pass for the wrong reason
  s.cd = {};
  const target = mob(kind);
  const cast = castOnce(s, c, c.maxMana, [target], {}, mulberry32(7), env);
  return cast ? cast.id : null;
}

describe('§14 · a slot picks when it may fire', () => {
  const c = buildCharacter(90, emptyGear());

  it('casts when the mode is always, which is the default', () => {
    const s = armed('always', { boss: false, hpBelowPct: 0 });
    expect(casts(s, c)).toBe(ATTACK);
    // the field itself is optional: a state that never set a mode behaves as `always`
    const fresh = newSkillState();
    fresh.list[0] = ATTACK;
    fresh.xp[ATTACK] = 8000;
    expect(casts(fresh, c)).toBe(ATTACK);
  });

  it('never silences the row, and the next ready slot takes the tick instead', () => {
    const s = armed('never', { boss: false, hpBelowPct: 0 });
    expect(casts(s, c)).toBeNull();
    // a second slot set back to `always` still fires — `never` is per skill, not a bar-wide switch
    const other = sm.of('attack').find((k: any) => k.id !== ATTACK) as any;
    s.list[1] = other.id;
    s.xp[other.id] = 8000;
    expect(casts(s, c)).toBe(other.id);
  });

  it('conditional holds the row until one shared condition passes', () => {
    const s = armed('conditional', { boss: false, hpBelowPct: 0 });
    // nothing enabled and nothing true: held
    expect(casts(s, c)).toBeNull();
    // the shared `boss` leg, against a boss target
    s.conditions = { boss: true, hpBelowPct: 0, statusMissing: [] };
    expect(casts(s, c, 'Medium')).toBeNull();
    expect(casts(s, c, 'Boss · Shepherd')).toBe(ATTACK);
    // the shared `hpBelowPct` leg, read off the pool the env reports
    s.conditions = { boss: false, hpBelowPct: 50, statusMissing: [] };
    expect(casts(s, c, 'Medium', { missingHpPct: 20 })).toBeNull();
    expect(casts(s, c, 'Medium', { missingHpPct: 60 })).toBe(ATTACK);
  });

  it('the condition list is data, not per-skill prose', () => {
    // whatever a save carries is what the loop reads; a save from before §14 gets the defaults the
    // loader writes (boss off, threshold 0), which is the old behaviour
    expect(E.skill_xp.level_cap).toBeGreaterThan(1);
    const s = armed('conditional', { boss: false, hpBelowPct: 0 });
    expect(casts(s, c, 'Boss · Shepherd', { missingHpPct: 99 })).toBeNull();
  });

  it('a conditional Element row fires only while the target is missing its own element status', () => {
    const statusStore = newMobStatusStore();
    const FLAME = 'attack.fireball';                          // element `fire` → applies `burn`
    const s = newSkillState();
    s.list[0] = FLAME;
    s.xp[FLAME] = 8000;
    s.mode[FLAME] = 'conditional';
    // the flag is off, so nothing in the list holds
    s.conditions = { boss: false, hpBelowPct: 0, statusMissing: [] };
    expect(casts(s, c, 'Medium', { mobStatus: statusStore })).toBeNull();
    // flag on and the target is clear of burn: it fires. Which status a row carries is read off the
    // roster (`elements.status_of` + the row's own `element`), never typed per skill.
    s.conditions = { boss: false, hpBelowPct: 0, statusMissing: ['burn'] };
    expect(casts(s, c, 'Medium', { mobStatus: statusStore })).toBe(FLAME);
    // the target is already burning: held again — this is what stops a rotation re-pressing a DoT
    setStacks(statusStore, 'm1', 'burn', 3, 10);
    expect(casts(s, c, 'Medium', { mobStatus: statusStore })).toBeNull();
  });

  it('a conditional curse row fires only while that curse is not already on the target', () => {
    const curses = newCurses();
    const WEAKEN = 'curse.weaken';                            // a curse row keys the flag by its own id
    const s = newSkillState();
    s.list[0] = WEAKEN;
    s.xp[WEAKEN] = 8000;
    s.mode[WEAKEN] = 'conditional';
    s.conditions = { boss: false, hpBelowPct: 0, statusMissing: [WEAKEN] };
    expect(casts(s, c, 'Medium', { curses })).toBe(WEAKEN);
    // the curse is up now: the row holds instead of re-pressing the same line every cooldown
    applyCurse(curses, 'm1', sm.byId[WEAKEN]);
    expect(casts(s, c, 'Medium', { curses })).toBeNull();
  });
});
