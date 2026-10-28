import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { E } from '../../src/engine/client';
import { actorAction, actorArt, actorBeats, actorPrepareMs, actorProfile, actorReaction, plateArt } from '../../src/ui/combat/combat-actor';
import type { FxEvent } from '@sim/core/types';
import { mobFixture } from '../fixtures/mobFixture';

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
    const mob = mobFixture({ kind: 'Boss · Test', speciesId: 'ogre' });
    const cast = fx({ kind: 'cast', mobId: mob.id, skillId: 'mob.physical.crushing-blow', id: 20 });
    expect(actorBeats([cast], mob).action).toBe(cast);
    expect(actorAction(cast, { weaponName: 'bare hand' }, mob)).toBe('prepare');
    expect(actorPrepareMs(cast)).toBe(800);
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
    expect(actorAction(fx({ skillId: 'attack.fireball', via: 'cast' }), character)).toBe('magic');
    expect(actorAction(fx({ skillId: 'attack.piercing_shot', via: 'cast' }), character)).toBe('ranged');
    expect(actorAction(fx({ skillId: 'attack.fan_of_knives', via: 'cast' }), character)).toBe('melee');
  });

  it('keeps the newest successful healing cast in a support pose', () => {
    const healed = fx({ id: 20, kind: 'heal', side: 'self', skillId: 'heal.heal' });
    const cast = fx({ id: 21, kind: 'cast', side: 'self', skillId: 'heal.heal' });
    expect(actorBeats([cast, healed]).action).toBe(cast);
    expect(actorAction(cast, { weaponName: 'bare hand' })).toBe('support');
    expect(actorAction(fx({ kind: 'cast', side: 'self', skillId: 'buff.warcry' }), { weaponName: 'bare hand' })).toBe('support');
  });
});

describe('combat actor artwork', () => {
  it('uses a retained map painting where one exists and the white species icon otherwise', () => {
    for (const row of E.mob.species) {
      const art = actorArt({ speciesId: row.id, species: row.name });
      expect(art, row.id).not.toBeNull();
      expect(art!.href, row.id).toMatch(/(?:\/map\/characters\/species\/[^/]+\/old-[^/]+|\/src\/icon\/mob\/icon\/[^/]+)\.png$/);
      const path = art!.href.startsWith('/map/') ? `../../public${art!.href}` : `../..${art!.href}`;
      expect(existsSync(fileURLToPath(new URL(path, import.meta.url))), art!.href).toBe(true);
      expect(art!.imageWidth).toBeGreaterThan(0);
      expect(art!.imageHeight).toBeGreaterThan(0);
    }
  });

  it('draws the canonical white mob icon in FieldPlates for every species', () => {
    for (const row of E.mob.species) {
      const art = plateArt({ speciesId: row.id, species: row.name });
      expect(art, row.id).not.toBeNull();
      expect(art!.href, row.id).toMatch(/\/src\/icon\/mob\/icon\/[^/]+\.png$/);
      expect(art!.icon, row.id).toBe(true);
      expect(existsSync(fileURLToPath(new URL(`../..${art!.href}`, import.meta.url))), art!.href).toBe(true);
    }
  });

  it('crops only transparent traveler margins using the existing painted bounds and keeps versioned species', () => {
    expect(actorArt()).toEqual({
      href: '/map/characters/player/traveler-piece.png', imageWidth: 1293, imageHeight: 1217,
      viewBox: '319 177 602 909',
    });
    expect(actorArt({ species: 'Elf' })!.href).toBe('/map/characters/species/elf/old-elf-v2.png');
  });
});

describe('combat actor body weight', () => {
  it('reads actual spawn body class and keeps small bodies quick and giants heavy', () => {
    const small = actorProfile(mobFixture({ kind: 'Small', speciesId: 'goblin' }));
    const large = actorProfile(mobFixture({ kind: 'Large', speciesId: 'ogre' }));
    expect(small.size).toBe('small');
    expect(large.size).toBe('large');
    expect(small.attackMs).toBeLessThan(large.attackMs);
    expect(small.reach).toBeGreaterThan(large.reach);
    expect(small.recoil).toBeGreaterThan(large.recoil);
    expect(actorProfile(mobFixture({ kind: 'Unique · Test', readsAs: 'large' })).size).toBe('large');
    expect(actorProfile(mobFixture({ kind: 'Boss · Test', readsAs: 'large' })).boss).toBe(true);
  });

  it('falls back to the canonical species sizes when legacy spawn has no body class', () => {
    expect(actorProfile(mobFixture({ kind: 'Normal', speciesId: 'kobold' })).size).toBe('small');
    expect(actorProfile().size).toBe('player');
  });
});
