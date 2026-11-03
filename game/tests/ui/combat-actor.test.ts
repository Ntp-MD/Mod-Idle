import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { E, sm } from '../../src/engine/client';
import { actorAction, actorArt, actorBeats, actorPrepareMs, actorProfile, actorReaction } from '../../src/ui/combat/combat-actor';
import type { FxEvent } from '@sim/core/types';
import { mobFixture } from '../fixtures/mobFixture';
import { liveId } from '../fixtures/liveSkill';
import { liveMobSkill, liveSpecies } from '../fixtures/liveMob';
const PREPARED = liveMobSkill(row => row.mode === 'strike' && row.cast?.delivery === 'melee' && !row.phase && row.status == null && row.cast.windup_sec > 0.5, 'mob preparation');

const fx = (over: Partial<FxEvent>): FxEvent => ({ id: 1, sec: 10, kind: 'hit', side: 'field', text: '10', colour: '#fff', ...over });

describe('combat actor events', () => {
  it('keeps outgoing and incoming motion independent in the same exchange', () => {
    const hit = fx({ id: 3, mobId: 'm1', via: 'swing' });
    const taken = fx({ id: 2, side: 'self', kind: 'taken', byId: 'm1' });
    expect(actorBeats([hit, taken])).toEqual({ action: hit, reaction: taken });
    expect(actorBeats([hit, taken], mobFixture())).toEqual({ action: taken, reaction: hit });
  });

  it('a missed or blocked swing still moves the body that made it', () => {
    const miss = fx({ kind: 'block', mobId: 'm1', text: 'miss' });
    expect(actorBeats([miss]).action).toBe(miss);
    expect(actorBeats([miss], mobFixture()).reaction).toBe(miss);
    expect(actorReaction(miss)).toBe('dodge');
    const block = fx({ kind: 'block', side: 'self', byId: 'm1', text: 'block' });
    expect(actorBeats([block], mobFixture()).action).toBe(block);
    expect(actorReaction(block)).toBe('block');
  });

  it('ignores damage over time rather than inventing a swing or flinch', () => {
    expect(actorBeats([fx({ via: 'dot', mobId: 'm1' }), fx({ kind: 'taken', side: 'self', via: 'dot' })]))
      .toEqual({ action: null, reaction: null });
    expect(actorBeats([fx({ via: 'dot', mobId: 'm1' })], mobFixture()))
      .toEqual({ action: null, reaction: null });
  });

  it('repeats the same skill by event ID and isolates one mob from its neighbours', () => {
    const previous = fx({ id: 7, kind: 'cast', side: 'self', skillId: 'attack.fireball' });
    const next = fx({ ...previous, id: 8 });
    expect(actorBeats([next, previous]).action?.id).toBe(8);
    expect(actorBeats([fx({ kind: 'taken', side: 'self', byId: 'other' })], mobFixture()).action).toBeNull();
  });

  it('prepares only a canonical cast marker and yields to the later resolved attack', () => {
    const mob = mobFixture({ kind: 'Boss · Test' });
    const cast = fx({ kind: 'cast', mobId: mob.id, skillId: PREPARED.id, id: 20 });
    expect(actorBeats([cast], mob).action).toBe(cast);
    expect(actorAction(cast, { weaponName: 'bare hand' }, mob)).toBe('prepare');
    expect(actorPrepareMs(cast)).toBe(PREPARED.cast_sec! * 1000);
    const landed = fx({ kind: 'taken', side: 'self', byId: mob.id, id: 21 });
    expect(actorBeats([landed, cast], mob).action).toBe(landed);
    expect(actorPrepareMs(landed)).toBe(0);
    expect(actorPrepareMs(fx({ kind: 'cast' }))).toBe(0);
  });

  it('support motion follows successful named buffs and heals, with direct hits as reactions', () => {
    const heal = fx({ kind: 'heal', side: 'self', skillId: 'heal.test' });
    expect(actorBeats([heal]).action).toBe(heal);
    expect(actorAction(heal, { weaponName: 'bare hand' })).toBe('support');
    expect(actorBeats([fx({ kind: 'heal', side: 'self' })]).action).toBeNull();
  });

  it('uses each skill group instead of borrowing the equipped weapon motion', () => {
    const character = { weaponName: 'bare hand' };
    const byGroup = (group: string) => liveId((s: any) => s.type === 'attack' && s.group === group, `${group} attack`);
    expect(actorAction(fx({ skillId: byGroup('magic'), via: 'cast' }), character)).toBe('magic');
    expect(actorAction(fx({ skillId: byGroup('ranged'), via: 'cast' }), character)).toBe('ranged');
    expect(actorAction(fx({ skillId: byGroup('melee'), via: 'cast' }), character)).toBe('melee');
  });

  it('keeps the newest successful healing cast in a support pose', () => {
    const anyHeal = liveId((s: any) => s.type === 'heal', 'heal');
    const anyBuff = liveId((s: any) => s.type === 'buff', 'buff');
    const healed = fx({ id: 20, kind: 'heal', side: 'self', skillId: anyHeal });
    const cast = fx({ id: 21, kind: 'cast', side: 'self', skillId: anyHeal });
    expect(actorBeats([cast, healed]).action).toBe(cast);
    expect(actorAction(cast, { weaponName: 'bare hand' })).toBe('support');
    expect(actorAction(fx({ kind: 'cast', side: 'self', skillId: anyBuff }), { weaponName: 'bare hand' })).toBe('support');
  });
});

describe('combat actor artwork', () => {
  it('draws the canonical white mob icon for every species', () => {
    for (const row of E.mob.species) {
      const art = actorArt({ speciesId: row.id, species: row.name });
      expect(art.href, row.id).toMatch(/\/src\/icon\/mob\/icon\/[^/]+\.png$/);
      expect(art.icon, row.id).toBe(true);
      expect(art.imageWidth).toBeGreaterThan(0);
      expect(art.imageHeight).toBeGreaterThan(0);
      expect(existsSync(fileURLToPath(new URL(`../..${art.href}`, import.meta.url))), art.href).toBe(true);
    }
  });

  it('draws the player character icon when no mob is staged', () => {
    expect(actorArt()).toMatchObject({
      href: expect.stringMatching(/\/src\/icon\/.*knight-helmet\.png$/),
      imageWidth: 256, imageHeight: 256, icon: true,
    });
    expect(actorArt({ species: 'Elf' }).href).toMatch(/\/src\/icon\/mob\/icon\/[^/]+\.png$/);
  });
});

describe('combat actor body weight', () => {
  it('reads actual spawn body class and keeps small bodies quick and giants heavy', () => {
    const small = actorProfile(mobFixture({ kind: 'Small' }));
    const large = actorProfile(mobFixture({ kind: 'Large' }));
    expect(small.size).toBe('small');
    expect(large.size).toBe('large');
    expect(small.attackMs).toBeLessThan(large.attackMs);
    expect(small.reach).toBeGreaterThan(large.reach);
    expect(small.recoil).toBeGreaterThan(large.recoil);
    expect(actorProfile(mobFixture({ kind: 'Unique · Test', readsAs: 'large' })).size).toBe('large');
    expect(actorProfile(mobFixture({ kind: 'Boss · Test', readsAs: 'large' })).boss).toBe(true);
  });

  it('falls back to the canonical species sizes when legacy spawn has no body class', () => {
    const species = liveSpecies(row => row.sizes.length > 0, 'legacy body fallback');
    const expected = species.sizes.includes('medium') ? 'medium' : species.sizes[0];
    expect(actorProfile(mobFixture({ kind: 'Normal', speciesId: species.id })).size).toBe(expected);
    expect(actorProfile().size).toBe('player');
  });
});
