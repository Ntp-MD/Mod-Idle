import { describe, it, expect } from 'vitest';
import { E, eng, loot, sm } from '../src/engine/client';
import { newGame, tick } from '../src/sim/game';
import { equipFromBag } from '../src/sim/gear';
import { linkReachable, startTrip, road } from '../src/sim/road';
import { settlementById } from '../src/sim/town';
import { ACTIVE_SLOTS } from '../src/sim/skills';
import type { StatKey } from '../src/engine/client';
import type { GameState, Item } from '../src/sim/types';

/**
 * B1 · the measurement the fold was taken from, and the reason it came out as none (D-103 · checks.md D4/D17).
 *
 * `mob_HP(L) = typical_gear_DPS(L) × (1 + skill_per_level × L)` says how much of a level-L mob's HP
 * is paid for by the skill list rather than by the gear. `skillShare.test.ts` measures the list on a
 * gearless character and shows the gap is on the gear side, which is not a reading a fold may be
 * taken from — raising or lowering `mob_HP` there pays for a shortfall that has nothing to do with
 * skills.
 *
 * So this run leaves the gear to the game: nothing is typed into the sheet. The character hunts with
 * `travel` forward, so its gear is exactly what the drop → filter → wear → craft path produced at the
 * moment it crossed each checkpoint, and only then is the bar emptied and refilled on two clones of
 * that same instant. The three numbers B1 needs are the gear-only rate against the curve's read-back,
 * the share the list adds at that gear, and how often the fight went to camp.
 *
 * The second test reuses the same geared instant for `concept.md` P0-2 (B3): two builds dressed from
 * the same bag and measured over the same window, one buying hit count and the statuses those hits
 * leave behind, one buying the single big hit.
 */
const CHECKPOINTS = [30, 60, 90];
const WINDOW_SEC = 600;
const HOUR = 3600;
const RUN_CAP_HR = 48;

const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
const barRows = (s: GameState) => s.skills.list.filter(Boolean).length
  + Object.values(s.skills.buffs).filter(Boolean).length
  + Object.values(s.skills.auras).filter(Boolean).length;
const xpCap = E.skill_xp.level_cap * E.skill_xp.xp_per_step;

interface Theme {
  label: string;
  /** the rows that define the build, slotted in order and levelled to Cap for the reading */
  bar: string[];
  /** the Mod lines this build dresses for (`mods.json` ids, never a typed value) */
  prefer: string[];
  /** what a Stat Mod line is told to feed on this build */
  stat: StatKey;
}

const FAST: Theme = {
  label: 'fast hit — Agi · aspd · the statuses a hit leaves behind',
  bar: ['attack.riposte', 'attack.flame_lash', 'attack.frost_nova', 'attack.chain_spark',
    'attack.puncture', 'attack.elemental_break', 'attack.whirlwind'],
  prefer: ['attack_speed', 'accuracy', 'elemental_power_flat', 'elemental_power', 'elemental_alignment',
    'dodge_flat', 'cooldown_reduction'],
  stat: 'agi',
};

const HEAVY: Theme = {
  label: 'big hit — Str · one heavy press',
  bar: ['attack.cleave', 'attack.headshot', 'attack.piercing_shot', 'attack.execute', 'attack.retribution'],
  prefer: ['physical_power', 'physical_power_flat', 'critical_chance', 'critical_damage', 'accuracy'],
  stat: 'str',
};

/** Sustained damage over the window, so camp and Push downtime is inside the number. */
function measure(s: GameState, sec: number) {
  const dmg = s.counters.damage || 0;
  const by = { ...(s.counters.damageBy || { swing: 0, cast: 0, dot: 0 }) };
  const kills = s.counters.kills;
  const pushes = s.counters.pushes;
  for (let i = 0; i < sec; i++) tick(s, {}, { online: true });
  const now = s.counters.damageBy || { swing: 0, cast: 0, dot: 0 };
  return {
    dps: ((s.counters.damage || 0) - dmg) / sec,
    swing: now.swing - by.swing,
    cast: now.cast - by.cast,
    dot: now.dot - by.dot,
    kills: s.counters.kills - kills,
    pushes: s.counters.pushes - pushes,
  };
}

function emptyBar(s: GameState) {
  s.skills.list = s.skills.list.map(() => null);
  for (const id of Object.keys(s.skills.buffs)) s.skills.buffs[id] = false;
  for (const id of Object.keys(s.skills.auras)) s.skills.auras[id] = false;
  s.skills.cd = {};
  s.skills.buffUp = {};
}

function atCap(s: GameState) {
  for (const id of Object.keys(s.skills.owned)) s.skills.xp[id] = xpCap;
}

/**
 * The decision an idle run never makes: wear the best piece the bag holds in each slot, and leave a
 * slot alone when the candidate is weaker than what it already wears. It goes through the same verb
 * the Equip button calls, so the sheet is built by the game's own rules rather than a test typing
 * numbers into it (`harness/decisions.md` D-089 keeps this off the AFK path). With a theme, a piece
 * that carries one of its lines wins the slot first, and the piece's Stat Mod is told that stat —
 * which is the player's own choice, made through the same field the panel writes.
 */
const scoreOf = (item: Item) => loot.score({ ...item, q: item.q ?? 0 });
const themeHit = (item: Item, t?: Theme) => Boolean(t) && item.lines.some((l) => t!.prefer.includes(l.id));

/**
 * `dressUp` with no theme wears the strongest thing the bag holds. With a theme it is a rebuild: each
 * slot takes the best piece it can that carries one of the build's own lines, even when that piece is
 * a little weaker — which is what a player swapping build actually does, and what makes the two
 * readings the same bag spent two ways rather than one bag judged twice.
 */
function dressUp(s: GameState, t?: Theme) {
  let worn = 0;
  if (t) {
    for (const slot of [...new Set(s.bag.filter(Boolean).map((item) => item.slot))]) {
      let pick = -1;
      let pickScore = -Infinity;
      s.bag.forEach((item, i) => {
        if (!item || item.heldFor || item.slot !== slot || !themeHit(item, t)) return;
        if (scoreOf(item) > pickScore) { pickScore = scoreOf(item); pick = i; }
      });
      if (pick < 0) continue;
      for (const l of s.bag[pick].lines) {
        if (l.id === 'stat_mod_flat' || l.id === 'stat_mod') (s.bag[pick] as any).chosenStat = t.stat;
      }
      if (equipFromBag(s, pick).ok) worn++;
    }
    return worn;
  }
  for (let pass = 0; pass <= s.gear.length; pass++) {
    let pick = -1;
    let pickKey: [number, number] = [0, -Infinity];
    s.bag.forEach((item, i) => {
      if (!item || item.heldFor) return; // a Collector piece is spoken for
      const score = scoreOf(item);
      const wornScore = Math.max(-1, ...s.gear.filter((g) => g && g.slot === item.slot).map(scoreOf));
      if (wornScore >= 0 && score <= wornScore) return; // this one would be a downgrade
      const key: [number, number] = [themeHit(item, t) ? 1 : 0, score];
      if (key[0] > pickKey[0] || (key[0] === pickKey[0] && key[1] > pickKey[1])) { pickKey = key; pick = i; }
    });
    if (pick < 0) break;
    if (!equipFromBag(s, pick).ok) break;
    worn++;
  }
  return worn;
}

/**
 * A player who has outgrown the zone walks to the next one, because the Road is the only thing that
 * opens a settlement (`world.md` reach queue · D-089). `travel: 'forward'` alone cannot do it: it
 * walks between settlements already opened, and the next one is by definition not open yet.
 */
function walkOnward(s: GameState): boolean {
  const here = eng.zoneById(s.zone);
  if (s.player.level <= here.levels[here.levels.length - 1] || s.road || s.phase === 'camp') return false;
  for (let i = 0; i < road.links.length; i++) {
    if (!linkReachable(s, i)) continue;
    if (!startTrip(s, i).ok) continue;
    const dest = settlementById(s.road!.settlementTo);
    if (dest && dest.zone > s.zone) return true;
    s.road = null; // that link runs back down the map; try the next one
  }
  return false;
}

/** One hunt, from the opening minute to the first checkpoint reached — the gear is whatever fell. */
function huntTo(level: number, seed = 20261004): { s: GameState; hours: number } {
  const s = newGame(seed);
  s.travel = 'forward';
  let sec = 0;
  for (; sec < RUN_CAP_HR * HOUR && s.player.level < level; sec++) {
    walkOnward(s);
    if (sec % HOUR === 0) dressUp(s);
    tick(s, {}, { online: true });
  }
  return { s, hours: sec / HOUR };
}

function withBar(s: GameState, t: Theme) {
  for (const id of t.bar) {
    if (!(id in sm.byId)) throw new Error(`the roster no longer has ${id}`);
    s.skills.owned[id] = s.skills.owned[id] ?? 0;
    s.skills.xp[id] = xpCap;
  }
  s.skills.list = new Array(ACTIVE_SLOTS).fill(null);
  t.bar.slice(0, ACTIVE_SLOTS).forEach((id, i) => { s.skills.list[i] = id; });
  return s;
}

describe('the fold measured on gear the loop actually produced', () => {
  it('levels to every checkpoint with its own drops, then prints gear-only dps and the list share', () => {
    const s = newGame(20261004);
    s.travel = 'forward';
    const rows: string[] = [];
    const seen: number[] = [];
    const shares: number[] = [];
    let walks = 0;
    let dressed = 0;

    for (let sec = 0; sec < RUN_CAP_HR * HOUR && seen.length < CHECKPOINTS.length; sec++) {
      if (walkOnward(s)) walks++;
      // a player who checks the bag dresses every hour; the AFK run that never clicks is the one
      // `pacing.test.ts` measures, and it is not the character the curve prices
      if (sec % HOUR === 0) dressed += dressUp(s);
      tick(s, {}, { online: true });
      const hit = CHECKPOINTS.find((lv) => s.player.level >= lv && !seen.includes(lv));
      if (hit === undefined) continue;
      seen.push(hit);
      // three clones of one instant: the run's own bar, the same rows at Cap, and nothing at all
      const natural = measure(clone(s), WINDOW_SEC);
      const maxed = clone(s);
      atCap(maxed);
      const capped = measure(maxed, WINDOW_SEC);
      const bare = clone(s);
      emptyBar(bare);
      const gearOnly = measure(bare, WINDOW_SEC);
      const curve = eng.typicalDpsAt(hit);
      const share = gearOnly.dps > 0 ? capped.dps / gearOnly.dps : NaN;
      shares.push(share);
      rows.push(
        `L${hit} after ${(sec / HOUR).toFixed(1)} hr · zone ${s.zone} after ${walks} walk(s) · `
        + `${s.gear.filter(Boolean).length}/${s.gear.length} slots worn over ${dressed} decision(s), `
        + `${s.bag.length} pieces left in the bag · bar held ${barRows(s)} rows\n`
        + `    gear-only ${gearOnly.dps.toFixed(0)} dps vs the curve's read-back ${curve.toFixed(0)} = `
        + `×${(gearOnly.dps / curve).toFixed(2)} of typical gear\n`
        + `    the list adds ×${(natural.dps / gearOnly.dps).toFixed(2)} as run · `
        + `×${share.toFixed(2)} at Cap (the curve spends ×${eng.skillF(hit).toFixed(2)})\n`
        + `    window kills ${gearOnly.kills}/${natural.kills}/${capped.kills} · `
        + `Pushed ${gearOnly.pushes}/${natural.pushes}/${capped.pushes} (bare/list/Cap)`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(`\nB1 · gear from the loop's own drops, damage measured over ${WINDOW_SEC} sec per run\n`
      + rows.map((r) => '  ' + r.replace(/\n/g, '\n  ')).join('\n'));

    expect(seen).toEqual(CHECKPOINTS); // the run must reach them, or the reading is not the design's
    expect(shares.every((x) => x > 1)).toBe(true); // the list is never dead weight at real gear
  }, 300000);

  it('leaves the fast-hit build its own value: the damage comes from hits, not from one big press', () => {
    const { s, hours } = huntTo(90);
    expect(s.player.level).toBeGreaterThanOrEqual(90);

    const readings = [FAST, HEAVY].map((t) => {
      const themed = withBar(clone(s), t);
      const decisions = dressUp(themed, t);
      const m = measure(themed, WINDOW_SEC);
      const total = m.swing + m.cast + m.dot;
      const themePieces = themed.gear.filter((g) => g && themeHit(g, t)).length;
      return {
        t, decisions, themePieces, slots: themed.gear.filter(Boolean).length, m,
        swingPct: (m.swing / total) * 100,
        dotPct: (m.dot / total) * 100,
        castPct: (m.cast / total) * 100,
        // what a hit-count build is actually made of: the swings and the statuses they leave behind
        hitBornePct: ((m.swing + m.dot) / total) * 100,
      };
    });

    const [fast, heavy] = readings;
    const ratio = heavy.m.dps > 0 ? fast.m.dps / heavy.m.dps : NaN;
    const line = (r: typeof fast) =>
      `${r.t.label}\n    ${r.slots} slots worn after ${r.decisions} rebuild decision(s), `
      + `${r.themePieces} of them carrying this build's own lines\n`
      + `    ${r.m.dps.toFixed(0)} dps · ${r.m.kills} kills · Pushed ${r.m.pushes} in ${WINDOW_SEC} sec\n`
      + `    damage by source: swings ${r.swingPct.toFixed(0)}% · the statuses those swings leave `
      + `${r.dotPct.toFixed(0)}% · presses ${r.castPct.toFixed(0)}%`;

    // eslint-disable-next-line no-console
    console.log(`\nB3 · the same geared instant (L${s.player.level} in zone ${s.zone} after `
      + `${hours.toFixed(1)} hr of the loop's own drops), two ways\n  ${line(fast)}\n  ${line(heavy)}\n`
      + `  the fast-hit build reaches ×${ratio.toFixed(2)} of the big-hit build's damage, and `
      + `${fast.hitBornePct.toFixed(0)}% of it arrives through a hit or something a hit left behind, `
      + `against ${heavy.hitBornePct.toFixed(0)}% on the big-hit build`);

    // P0-2's promise is that the hit-count build stays a hit-count build rather than a cheaper route
    // to the same number: the swings and their statuses must carry a larger share of its damage.
    expect(fast.hitBornePct).toBeGreaterThan(heavy.hitBornePct);
    expect(fast.m.dps).toBeGreaterThan(0);
    expect(heavy.m.dps).toBeGreaterThan(0);
  }, 300000);
});
