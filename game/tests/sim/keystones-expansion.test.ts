import { describe, expect, it } from 'vitest';
import engineJson from '../../../tools/data/engine.json' with { type: 'json' };
import { KEYSTONE_HANDLERS, registerStaticKeystoneHandlers } from '@sim/core/keystone-runtime';
registerStaticKeystoneHandlers(KEYSTONE_HANDLERS, Object.keys((engineJson as any).elements.status_of));
import { tree } from '../../src/engine/client';
import { buildCharacter, emptyGear, type Character } from '@sim/core/player';
import { mobSwing, playerSwing } from '@sim/combat/combat';
import { applyWeaponRiders, keystoneTargetMods, newMobStatusStore, placeStatus } from '@sim/combat/mobStatus';
import { huntZone, newGame, setLevel, tick } from '@sim/core/game';
import type { KeystoneBundle } from '@engine/keystones.ts';
import type { Mob } from '@sim/core/types';

/** Packet M's trade-offs: each condition and its price are measured against the same fixture
 *  without the bundle, so a key that is registered but not wired cannot pass. */

const bundle = (key: string): KeystoneBundle => {
  const found = tree.keystoneBundles({ [`keystone.${key}`]: 1 })[0];
  if (!found) throw new Error(`keystone.${key} carries no bundle`);
  return found;
};
const sheet = (bundles: KeystoneBundle[] = []) =>
  buildCharacter(1, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, undefined, {}, bundles);
const never = () => 0.99;
const always = () => 0;

function mob(over: Partial<Mob> = {}): Mob {
  return {
    id: 'm1', species: 'Dummy', kind: 'normal', zone: 1, level: 1, hp: 1e9, hpMax: 1e9,
    ps: 100, acc: 0, evasion: 0, dodgeRate: 0, armour: 0, res: 0, damage: 'physical',
    innate: [], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0, ...over,
  } as Mob;
}

const physOnly = (bundles: KeystoneBundle[] = [], critChance = 0): Character =>
  ({ ...sheet(bundles), phys: 100, magic: 0, elem: 0, elemByElement: {}, critChance, critDmg: 200, accuracy: 1e9 });

describe('Packet M sheet trade-offs', () => {
  it('pays each two-sided stat line on the finished sheet', () => {
    const bare = sheet();
    const titan = sheet([bundle('titan-frame')]);
    expect(titan.maxHp).toBeCloseTo(bare.maxHp * 1.25, 6);
    expect(titan.aspd).toBeCloseTo(bare.aspd * 0.85, 6);
    const gale = sheet([bundle('gale-form')]);
    expect(gale.aspd).toBeCloseTo(bare.aspd * 1.20, 6);
    expect(gale.maxHp).toBeCloseTo(bare.maxHp * 0.85, 6);
    const bulwark = sheet([bundle('bulwark')]);
    expect(bulwark.armour).toBeCloseTo(bare.armour * 1.40, 6);
    expect(bulwark.evasion).toBeCloseTo(bare.evasion * 0.80, 6);
    const phantom = sheet([bundle('phantom-step')]);
    expect(phantom.evasion).toBeCloseTo(bare.evasion * 1.40, 6);
    expect(phantom.armour).toBeCloseTo(bare.armour * 0.80, 6);
    const deepwell = sheet([bundle('deepwell')]);
    expect(deepwell.maxMana).toBeCloseTo(bare.maxMana * 1.40, 6);
    expect(deepwell.maxHp).toBeCloseTo(bare.maxHp * 0.80, 6);
    const hollow = sheet([bundle('hollow-body')]);
    expect(hollow.es).toBeCloseTo(bare.es * 1.50, 6);
    expect(hollow.maxHp).toBeCloseTo(bare.maxHp * 0.75, 6);
    const engine = sheet([bundle('blood-engine')]);
    expect(engine.maxHp).toBeCloseTo(bare.maxHp * 1.25, 6);
    expect(engine.maxMana).toBeCloseTo(bare.maxMana * 0.75, 6);
  });

  it('moves crit and the physical/magic split while keeping the other side whole', () => {
    const bare = sheet();
    const keen = sheet([bundle('keen-edge')]);
    expect(keen.critChance).toBeCloseTo(bare.critChance + 25, 6);
    expect(keen.critDmg).toBeCloseTo(Math.max(100, bare.critDmg - 20), 6);
    const brutal = sheet([bundle('brutal-force')]);
    expect(brutal.critChance).toBeCloseTo(Math.max(0, bare.critChance - 10), 6);
    expect(brutal.critDmg).toBeCloseTo(bare.critDmg + 30, 6);
    const focus = sheet([bundle('spellfocus')]);
    expect(focus.phys).toBeCloseTo(bare.phys * 0.80, 6);
    expect(focus.magic).toBeCloseTo(bare.magic * 1.30, 6);
  });
});

describe('Packet M outgoing trade-offs', () => {
  const hit = (bundles: KeystoneBundle[], target: Mob, rng = never, critChance = 0) =>
    playerSwing(rng, physOnly(bundles, critChance), target, null, undefined, 0).damage;

  it('pays the Life-share, full-Life and Body-class conditions as one multiplier', () => {
    const low = mob({ hp: 100, hpMax: 1000 });
    expect(hit([bundle('executioner')], low)).toBeCloseTo(hit([], mob({ hp: 100, hpMax: 1000 })) * 1.5, 6);
    expect(hit([bundle('executioner')], mob())).toBeCloseTo(hit([], mob()) * 0.85, 6);
    expect(hit([bundle('opener')], mob())).toBeCloseTo(hit([], mob()) * 1.4, 6);
    expect(hit([bundle('opener')], low)).toBeCloseTo(hit([], mob({ hp: 100, hpMax: 1000 })) * 0.9, 6);
    expect(hit([bundle('giant-slayer')], mob({ kind: 'Boss' }))).toBeCloseTo(hit([], mob({ kind: 'Boss' })) * 1.35, 6);
    expect(hit([bundle('giant-slayer')], mob())).toBeCloseTo(hit([], mob()) * 0.9, 6);
    expect(hit([bundle('swarm-bane')], mob())).toBeCloseTo(hit([], mob()) * 1.3, 6);
    expect(hit([bundle('swarm-bane')], mob({ kind: 'Boss' }))).toBeCloseTo(hit([], mob({ kind: 'Boss' })) * 0.9, 6);
    expect(hit([bundle('overkill')], mob({ hp: 900, hpMax: 1000 }))).toBeCloseTo(hit([], mob({ hp: 900, hpMax: 1000 })) * 1.4, 6);
    expect(hit([bundle('overkill')], low)).toBeCloseTo(hit([], mob({ hp: 100, hpMax: 1000 })) * 0.85, 6);
  });

  it('pays the crit and damage-type conditions without touching the other half', () => {
    const plainCrit = hit([], mob(), always, 100);
    const sniperCrit = hit([bundle('sniper')], mob(), always, 100);
    expect(sniperCrit).toBeCloseTo(plainCrit * 1.25, 6);
    expect(hit([bundle('sniper')], mob(), never, 0)).toBeCloseTo(hit([], mob(), never, 0) * 0.9, 6);
    expect(hit([bundle('elementalist')], mob())).toBeCloseTo(hit([], mob()) * 0.8, 6);
    expect(hit([bundle('brute')], mob())).toBeCloseTo(hit([], mob()) * 1.25, 6);
  });

  it('trades Puncturing damage for an extra Armour cut the mitigation actually spends', () => {
    const armoured = mob({ armour: 1000 });
    const control = hit([], armoured);
    const punctured = hit([bundle('puncturing')], mob({ armour: 1000 }));
    expect(punctured).toBeGreaterThan(control * 0.85);
    expect(punctured).toBeLessThan(control * 1.5);
  });
});

describe('Packet M incoming trade-offs', () => {
  const taken = (bundles: KeystoneBundle[], target: Mob, currentHp?: number) =>
    mobSwing(never, { ...sheet(bundles), maxHp: 1000, hp: currentHp ?? 1000 } as Character,
      target, {}, undefined, 0, 0, false, currentHp).toHp;
  const fire = mob({ damage: 'magic', innate: ['fire'] });
  const cold = mob({ damage: 'magic', innate: ['cold'] });

  it('cuts its own Element and amplifies every other Element', () => {
    expect(taken([bundle('firewalker')], fire)).toBeCloseTo(taken([], fire) * 0.5, 6);
    expect(taken([bundle('frostwalker')], fire)).toBeCloseTo(taken([], fire) * 1.2, 6);
    expect(taken([bundle('frostwalker')], cold)).toBeCloseTo(taken([], cold) * 0.5, 6);
    const lightning = mob({ damage: 'magic', innate: ['lightning'] });
    expect(taken([bundle('stormwalker')], lightning)).toBeCloseTo(taken([], lightning) * 0.5, 6);
    const earth = mob({ damage: 'magic', innate: ['earth'] });
    expect(taken([bundle('earthward')], earth)).toBeCloseTo(taken([], earth) * 0.5, 6);
    expect(taken([bundle('plagueward')], mob({ damage: 'magic', innate: ['chaos'] })))
      .toBeCloseTo(taken([], mob({ damage: 'magic', innate: ['chaos'] })) * 0.5, 6);
  });

  it('reads the live Life share for Last Stand and Brawler', () => {
    expect(taken([bundle('last-stand')], mob(), 100)).toBeCloseTo(taken([], mob(), 100) * 0.75, 6);
    expect(taken([bundle('last-stand')], mob(), 900)).toBeCloseTo(taken([], mob(), 900) * 1.1, 6);
    expect(taken([bundle('brawler')], mob(), 900)).toBeCloseTo(taken([], mob(), 900) * 0.85, 6);
    expect(taken([bundle('brawler')], mob(), 100)).toBeCloseTo(taken([], mob(), 100) * 1.15, 6);
  });
});

describe('Packet I — crit and direct physical', () => {
  it('Hemorrhage cuts the scaled direct Hit it also reports', () => {
    const scaled = (bundles: KeystoneBundle[]) => ({ ...physOnly(bundles), attackDamage: 100 });
    const plain = playerSwing(never, scaled([]), mob(), null, undefined, 0).damage;
    const hemorrhage = playerSwing(never, scaled([bundle('hemorrhage')]), mob(), null, undefined, 0).damage;
    expect(hemorrhage).toBeCloseTo(plain * 0.75, 6);
  });

  it('Inevitable Judgement skips each Element’s own resistance on a crit', () => {
    const char = (bundles: KeystoneBundle[]) => ({
      ...physOnly(bundles), alignment: 100, phys: 100, magic: 0, elem: 0,
      elemByElement: { fire: 100, cold: 100 },
    });
    const crit = (bundles: KeystoneBundle[], target: Mob) =>
      playerSwing(never, char(bundles), target, null, undefined, 0, 1, 0, true).damage;
    const plain = () => mob({ innate: ['fire'], resByElement: { fire: 0, cold: 0 } });
    const resisted = () => mob({ innate: ['fire'], resByElement: { fire: 20, cold: 0 } });
    // fire's own line answers the bare crit; the keystone must remove that line and nothing else
    expect(crit([], resisted())).toBeLessThan(crit([], plain()));
    expect(crit([bundle('inevitable-judgement')], resisted()))
      .toBeCloseTo(crit([bundle('inevitable-judgement')], plain()), 6);
  });
});

describe('Packet N — the 15-per-wing expansion', () => {
  const level60 = (bundles: KeystoneBundle[] = []) =>
    buildCharacter(60, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, undefined, {}, bundles);

  it('folds the sheet-side removals and additions', () => {
    const bare = level60();
    const gamblers = level60([bundle('gamblers-step')]);
    expect(gamblers.evasion).toBe(0);
    expect(gamblers.perfectDodge).toBeCloseTo(bare.perfectDodge * 2, 6);
    const anvil = level60([bundle('anvil')]);
    expect(anvil.evasion).toBe(0);
    expect(anvil.perfectDodge).toBe(0);
    expect(level60([bundle('blur')]).block).toBe(0);
    expect(level60([bundle('concussive-blows')]).critChance).toBe(0);
    expect(level60([bundle('mirror-strike')]).critChance).toBe(0);
    const purist = level60([bundle('purist')]);
    expect(purist.es).toBe(0);
    expect(purist.esRegen).toBe(0);
    const blood = level60([bundle('bloodthirst')]);
    expect(blood.hpRegen).toBe(0);
    expect(blood.leechPct).toBeCloseTo(bare.leechPct + 3, 6);
    expect(level60([bundle('empty-vessel')]).maxMana).toBeCloseTo(bare.maxMana * 1.2, 6);
    expect(level60([bundle('sanctuary')]).esRegen).toBeCloseTo(bare.esRegen * 0.5, 6);
  });

  it('pays Single Combat, Hemorrhage and Fortuna on the swing', () => {
    const hit = (bundles: KeystoneBundle[], rng = never, critChance = 0) =>
      playerSwing(rng, physOnly(bundles, critChance), mob(), null, undefined, 0).damage;
    expect(hit([bundle('single-combat')])).toBeCloseTo(hit([]) * 1.8, 6);
    expect(hit([bundle('hemorrhage')])).toBeCloseTo(hit([]) * 0.75, 6);
    expect(hit([bundle('fortuna')], always, 100)).toBeCloseTo(hit([], always, 100) * 2, 6);
    expect(hit([bundle('fortuna')], never, 0)).toBeCloseTo(hit([], never, 0) * 0.9, 6);
  });

  it('reads Unbreakable, Grit and Sanctuary on the incoming Hit', () => {
    const base = { ...level60(), maxHp: 1000, hp: 1000, es: 100 } as Character;
    const taken = (key: string | null, target: Mob, liveEs = 0) => {
      const r = mobSwing(never, key ? { ...base, keystones: [bundle(key)] } : base,
        target, {}, undefined, liveEs, 0, false, 1000);
      return r.toHp + r.toEs;
    };
    const small = mob({ ps: 30 });
    expect(taken('unbreakable', small)).toBe(0);
    expect(taken('unbreakable', mob({ ps: 200 })))
      .toBeCloseTo(taken(null, mob({ ps: 200 })) * 1.15, 6);
    expect(taken('grit', mob({ ps: 1000 }))).toBeCloseTo(250, 6);
    expect(taken('sanctuary', mob({ ps: 1000 }), 100))
      .toBeCloseTo(taken(null, mob({ ps: 1000 }), 100) * 0.8, 6);
  });

  it('blocks the statuses its rule forbids and reads the target bonuses', () => {
    const store = newMobStatusStore();
    const winters = level60([bundle('winters-grip')]);
    expect(placeStatus(store, 'm1', 'burn', winters, 100)).toBeNull();
    expect(placeStatus(store, 'm1', 'shock', winters, 100)).toBeNull();
    expect(placeStatus(store, 'm1', 'chill', winters, 100)).toBe('chill');
    expect(keystoneTargetMods(store, 'm1', winters).damageTaken).toBe(25);
    const crippling = level60([bundle('crippling-strikes')]);
    applyWeaponRiders(always, { ...crippling, alignment: 100 }, store, 'm2', false, 0, 0, [], {});
    expect(store.m2.statuses.crippled?.stacks).toBe(1);
    expect(store.m2.statuses.shock).toBeUndefined();
    const conductive = level60([bundle('conductive')]);
    placeStatus(store, 'm3', 'shock', conductive, 100);
    expect(store.m3.stoppedUntil).toBeUndefined();
    expect(keystoneTargetMods(store, 'm3', conductive).damageTaken).toBe(10);
  });

  it('writes Hemorrhage bleed as a permanent, doubled line', () => {
    const hemorrhage = level60([bundle('hemorrhage')]);
    const store = newMobStatusStore();
    applyWeaponRiders(always, { ...hemorrhage, phys: 100, bleedChance: 100, alignment: 100 }, store, 'm', false, 0, 0, [], {});
    expect(store.m.statuses.bleed?.permanent).toBe(true);
    expect(store.m.statuses.bleed?.perSec ?? 0).toBeGreaterThan(0);
  });
});

describe('Packet M kill trade-offs', () => {
  it('registers the four kill formulas and reads Boss/Unique and Bleed honestly', () => {
    const kill = (key: string, ...args: unknown[]) => (KEYSTONE_HANDLERS[key].kill as any)(...args);
    expect(kill('reaper', 1000)).toBeCloseTo(20, 6);
    expect(kill('soul-harvest', 500)).toBeCloseTo(15, 6);
    expect(kill('trophy-hunter', 1000, 500, true)).toEqual({ hp: 150, mana: 75 });
    expect(kill('trophy-hunter', 1000, 500, false)).toEqual({ hp: 10, mana: 5 });
    expect(kill('bloodfeast', 1000, true)).toBeCloseTo(50, 6);
    expect(kill('bloodfeast', 1000, false)).toBeCloseTo(10, 6);
  });

  it('pays Reaper and Soul Harvest through the live kill path, capped by usable pools', () => {
    const gains = (keys: string[]) => {
      const s = newGame(7);
      setLevel(s, 60);
      expect(huntZone(s, s.zone).ok).toBe(true);
      for (const key of keys) s.player.treeRanks![`keystone.${key}`] = 1;
      let guard = 0;
      while (!s.group.length && guard++ < 2000) tick(s, { autoSkills: false });
      expect(s.group.length).toBeGreaterThan(0);
      for (const target of s.group) { target.ps = 0; target.hp = 1; }
      s.player.hp = 100;
      s.player.mana = 0;
      const hp = s.player.hp;
      const mana = s.player.mana;
      guard = 0;
      while (s.group.length && guard++ < 80) tick(s, { autoSkills: false });
      return { hp: s.player.hp - hp, mana: s.player.mana - mana, sheet: buildCharacter(s.player.level, s.gear, {}, 0, { add: {}, mult: {} }, s.player.points, s.player.treeRanks) };
    };
    const base = gains([]);
    const reaper = gains(['reaper']);
    const harvest = gains(['soul-harvest']);
    expect(reaper.hp - base.hp).toBeCloseTo(reaper.sheet.maxHp * 0.02, 6);
    expect(harvest.mana - base.mana).toBeCloseTo(harvest.sheet.maxMana * 0.03, 6);
  });
});
