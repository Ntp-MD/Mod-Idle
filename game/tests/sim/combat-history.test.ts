import { describe, expect, it } from 'vitest';
import { fx, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { mulberry32 } from '../../src/engine/client-helpers';
import { normalizeCombatHistory, snapshotEnemy, summarizeCombat, type CombatHistoryEntry } from '@sim/combat/combat-history';

describe('recorded combat history', () => {
  it('summarizes the retained window from actual records', () => {
    const entries: CombatHistoryEntry[] = [
      { id: 4, sec: 14, kind: 'kill', text: 'Enemy defeated', away: false },
      { id: 3, sec: 12, kind: 'hit', side: 'field', via: 'cast', value: 100, skillId: 'attack.fireball', skillName: 'Fireball', crit: true, text: '100', away: false },
      { id: 2, sec: 10, kind: 'hit', side: 'field', via: 'swing', value: 40, text: '40', away: false },
      { id: 1, sec: 8, kind: 'taken', side: 'self', value: 30, hpDamage: 20, esDamage: 10, text: '30', away: false },
    ];
    expect(summarizeCombat(entries)).toMatchObject({
      fromSec: 8, toSec: 14, windowSec: 6, outgoing: 140, incoming: 30, kills: 1, crits: 1,
      skills: [{ id: 'attack.fireball', name: 'Fireball', damage: 100 }],
    });
    expect(summarizeCombat([])).toMatchObject({ windowSec: 0, outgoing: 0, incoming: 0, skills: [] });
  });

  it('retains an incoming source and resolved skill after the enemy leaves the field', () => {
    const state = newGame(17);
    const enemy = spawnMob(mulberry32(11), 1, 'boss');
    state.group = [enemy];
    fx(state, { kind: 'taken', side: 'self', byId: enemy.id, skillId: enemy.skillIds![0], value: 14, text: '14', colour: '#fff' });
    enemy.species = 'changed';
    enemy.skillIds!.length = 0;
    state.group = [];
    expect(state.combatHistory?.[0]).toMatchObject({ kind: 'taken', value: 14, enemy: { id: enemy.id } });
    expect(state.combatHistory?.[0].enemy?.species).not.toBe('changed');
    expect(state.combatHistory?.[0].enemy?.skillIds.length).toBeGreaterThan(0);
    expect(state.combatHistory?.[0].skillName).toBeTruthy();
  });

  it('keeps a bounded combat record without adding noncombat loot notifications', () => {
    const state = newGame(17);
    for (let i = 0; i < 130; i++) fx(state, { kind: 'taken', side: 'self', value: i, text: String(i), colour: '#fff' });
    fx(state, { kind: 'drop', text: 'Loot', colour: '#fff' });
    expect(state.combatHistory).toHaveLength(120);
    expect(state.combatHistory?.[0].value).toBe(129);
    expect(state.combatHistory?.every((entry) => ['taken'].includes(entry.kind))).toBe(true);
  });

  it('records Push before its pack and statuses are cleared', () => {
    const state = newGame(17);
    const enemy = spawnMob(mulberry32(11), 1, 'boss');
    Object.assign(enemy, { hp: 1e12, hpMax: 1e12, ps: 1e12, acc: 1e12, hitsPerSec: 2, atkTimer: 1 });
    state.group = [enemy];
    state.hunting = true;
    state.player.hp = 1;
    tick(state, { autoSkills: false });
    expect(state.counters.pushes).toBe(1);
    expect(state.group).toEqual([]);
    expect(state.combatHistory?.[0].kind).toBe('push');
    expect(state.combatHistory?.some((entry) => entry.kind === 'taken' && entry.enemy?.id === enemy.id)).toBe(true);
    const incoming = state.combatHistory!.find(entry => entry.kind === 'taken')!;
    expect(incoming.hpDamage! + incoming.esDamage!).toBe(incoming.value);
    expect(incoming.skillName).toBeTruthy();
  });

  it('retains defensive and status source facts while leaving unattributed DoT unattributed', () => {
    const state = newGame(17);
    const enemy = spawnMob(mulberry32(11), 1, 'boss');
    state.group = [enemy];
    state.online = false;
    fx(state, { kind: 'block', side: 'self', byId: enemy.id, text: 'block', colour: '#fff' });
    fx(state, { kind: 'proc', side: 'self', byId: enemy.id, text: 'chill', colour: '#fff' });
    fx(state, { kind: 'taken', side: 'self', via: 'dot', text: '4', value: 4, hpDamage: 3, esDamage: 1, colour: '#fff' });
    expect(state.combatHistory?.map(entry => entry.kind)).toEqual(['taken', 'proc', 'block']);
    expect(state.combatHistory?.[0]).toMatchObject({ away: true, hpDamage: 3, esDamage: 1 });
    expect(state.combatHistory?.[0].enemy).toBeUndefined();
    expect(state.combatHistory?.[1].enemy?.id).toBe(enemy.id);
    expect(state.combatHistory?.[2].enemy).toBe(state.combatHistory?.[1].enemy);
  });

  it('preserves a killed enemy whose lethal event removed it before the kill FX', () => {
    const state = newGame(17);
    const enemy = spawnMob(mulberry32(11), 1, 'boss');
    fx(state, { kind: 'kill', side: 'field', mobId: enemy.id, text: enemy.species, colour: '#fff' }, enemy);
    expect(state.group).toEqual([]);
    expect(state.combatHistory?.[0].enemy?.id).toBe(enemy.id);
    expect(Object.isFrozen(snapshotEnemy(enemy).skillIds)).toBe(true);
  });

  it('records a live forced status with its actual enemy and skill', () => {
    const state = newGame(17);
    setLevel(state, 50);
    const enemy = spawnMob(mulberry32(11), 1, 'boss');
    Object.assign(enemy, { hp: 1e12, hpMax: 1e12, ps: 10, acc: 1e12, hitsPerSec: 2, atkTimer: 1,
      damage: 'magic', innate: ['cold'], skillIds: ['mob.cold.frost-bite'] });
    state.group = [enemy];
    state.hunting = true;
    tick(state, { autoSkills: false });
    expect(state.combatHistory?.find(entry => entry.kind === 'proc' && entry.text === 'chill')).toMatchObject({
      skillId: 'mob.cold.frost-bite', skillName: 'Frost Bite', enemy: { id: enemy.id },
    });
  });

  it('round-trips optional saved history, rejects malformed entries and drops unknown properties', () => {
    const state = newGame(17);
    const enemy = spawnMob(mulberry32(11), 1, 'boss');
    state.group = [enemy];
    fx(state, { kind: 'cast', side: 'field', mobId: enemy.id, skillId: enemy.skillIds![0], text: 'Cast', colour: '#fff' });
    const encoded = JSON.parse(JSON.stringify(state.combatHistory));
    encoded[0].injected = 'discard';
    const normalized = normalizeCombatHistory([...encoded, encoded[0], { id: -1 }, { id: 20, sec: 1, kind: 'drop', text: 'Loot' }]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({ id: state.fxSeq, kind: 'cast', enemy: { id: enemy.id } });
    expect(normalized[0]).not.toHaveProperty('injected');
    expect(normalizeCombatHistory(undefined)).toEqual([]);
    expect(normalizeCombatHistory({ events: encoded })).toEqual([]);
    expect(normalizeCombatHistory(Array.from({ length: 200 }, (_, index) => ({ id: index + 1, sec: 1, kind: 'push', text: 'Push' })))).toHaveLength(120);
  });
});
