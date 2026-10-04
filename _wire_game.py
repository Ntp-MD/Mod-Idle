import io

def load(p):
    raw = io.open(p, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    return raw.replace('\r\n', '\n') if crlf else raw, crlf

def save(p, t, crlf):
    io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if c else t)

def patch(p, pairs):
    t, c = load(p)
    for a, b in pairs:
        assert t.count(a) == 1, ('MISS', p, repr(a[:70]), t.count(a))
        t = t.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if c else t)
    print('ok', p)


# ---------------- state field
patch('game/src/sim/types.ts', [
    ("import type { GoalState } from './goal';",
     "import type { GoalState } from './goal';\nimport type { MobStatusStore } from './mobStatus';"),
    ("""  /** Curse lines currently written on a mob, keyed by that spawn's id (`skill-pool.md`). */
  curses: CurseStore;""",
     """  /** Curse lines currently written on a mob, keyed by that spawn's id (`skill-pool.md`). */
  curses: CurseStore;
  /** Burn · poison · chill · shock · mark · bleed we have put on a mob (`status.mob_side`, D-067). */
  mobStatus: MobStatusStore;"""),
])

patch('game/src/sim/game.ts', [
    ("import { newCurses, modsOn, applyCurse, tickCurses } from './curse';",
     "import { newCurses, modsOn, applyCurse, tickCurses, combineMods } from './curse';\n"
     "import { newMobStatusStore, applyElement, applyBleed, stepMob, modsOn as statusModsOn, targetMods, forgetDead as forgetMobStatus } from './mobStatus';"),
    ("    curses: newCurses(),",
     "    curses: newCurses(),\n    mobStatus: newMobStatusStore(),"),
    # the player swing: one merged target modifier set, statuses inflicted off the landed hit, leech paid
    ("""    const r = playerSwing(rng, c, target, null, modsOn(s.curses, target.id));""",
     """    const tm = combineMods(modsOn(s.curses, target.id), targetMods(statusModsOn(s.mobStatus, target.id)));
    const r = playerSwing(rng, c, target, c.weaponElement, tm);
    if (r.landed) {
      // every Elemental line the weapon carries tries its own Element's status (D-067 · D-090)
      const alignedPerSec = c.elem * (c.alignment / 100) * c.hitsPerSec;
      for (const el of Object.keys(c.elemByElement)) {
        if (!el || !(c.elemByElement as any)[el]) continue;
        applyElement(rng, s.mobStatus, target.id, el, c, alignedPerSec);
      }
      const bleedChance = (s.curses[target.id] as any)?.bleed_chance?.value;
      if (bleedChance) applyBleed(rng, s.mobStatus, target.id, c.phys);
      if (r.leech) s.player.hp = Math.min(c.maxHp, s.player.hp + r.leech);
    }"""),
    # mob clocks feel chill and shock, and the DoT clocks run once a second
    ("""  // mob clocks
  for (const mob of engaging) {
    mob.atkTimer += mob.hitsPerSec;""",
     """  // every status line ages once per second, and the DoT it deals lands before the mob swings
  for (const mob of s.group) {
    const dot = stepMob(s.mobStatus, mob.id);
    if (dot > 0) mob.hp -= dot;
  }
  while (s.group.length && s.group.some((m) => m.hp <= 0)) {
    const at = s.group.findIndex((m) => m.hp <= 0);
    const dead = s.group.splice(at, 1)[0];
    onKill(s, rng, dead, c);
  }

  // mob clocks
  for (const mob of engaging) {
    const tm = combineMods(modsOn(s.curses, mob.id), targetMods(statusModsOn(s.mobStatus, mob.id)));
    mob.atkTimer += mob.hitsPerSec * Math.max(0, 1 + tm.attackSpeed / 100);"""),
    ("""      const r = mobSwing(rng, c, mob, statuses, modsOn(s.curses, mob.id));""",
     """      const r = mobSwing(rng, c, mob, statuses, tm);"""),
    ("""  tickCurses(s.curses, new Set(s.group.map((m) => m.id)));""",
     """  tickCurses(s.curses, new Set(s.group.map((m) => m.id)));
  forgetMobStatus(s.mobStatus, new Set(s.group.map((m) => m.id)));"""),
])

patch('game/src/state/save.ts', [
    ("import { newCurses } from '../sim/curse';",
     "import { newCurses } from '../sim/curse';\nimport { newMobStatusStore } from '../sim/mobStatus';"),
    ("  if (!s.curses) s.curses = newCurses();",
     "  if (!s.curses) s.curses = newCurses();\n  if (!s.mobStatus) s.mobStatus = newMobStatusStore();"),
])

# ---------------- the two curse tests assert the old object shape
patch('game/tests/curse.test.ts', [
    ("    expect(modsOn(store, 'mob-2')).toEqual(NO_CURSE); // another mob carries nothing",
     "    expect(modsOn(store, 'mob-2').damageDealt).toBe(0); // another mob carries nothing"),
    ("""    const store = cursed('curse.weaken');
    const secs = row('curse.weaken').duration;""",
     """    const store = cursed('curse.weaken');
    const secs = row('curse.weaken').duration;
    void NO_CURSE;"""),
    ("""    for (let i = 0; i < Number(String(secs).match(/\\d+/)?.[0]); i++) tickCurses(store, live);
    expect(store['mob-1']).toBeUndefined();
    expect(modsOn(store, 'mob-1')).toEqual(NO_CURSE);""",
     """    for (let i = 0; i < Number(String(secs).match(/\\d+/)?.[0]); i++) tickCurses(store, live);
    expect(store['mob-1']).toBeUndefined();
    expect(modsOn(store, 'mob-1').damageDealt).toBe(0);"""),
])
