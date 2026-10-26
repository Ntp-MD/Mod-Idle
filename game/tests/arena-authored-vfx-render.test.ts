import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ArenaAuthoredSkillVfx from '../src/ui/combat/ArenaAuthoredSkillVfx.svelte';
import ArenaSkillVfx from '../src/ui/combat/ArenaSkillVfx.svelte';
import CombatArenaScene from '../src/ui/combat/CombatArenaScene.svelte';
import { newGame, characterSheet } from '../src/sim/core/game';
import { createCombatArena, syncCombatArena, arenaAction, captureCombatArena } from '../src/sim/combat/combat-arena';
import { mobFixture } from './mobFixture';
import { projectArenaPoint, arenaCameraOffset } from '../src/ui/combat/combat-arena-view';
import { arenaComponentDepth } from '../src/ui/combat/arena-authored-vfx';
import { AUTHORED_VFX } from '../src/ui/combat/arena-authored-vfx';
import { skillFxFor } from '../src/ui/combat/arena-skill-effects';

const point = { x: 100, y: 100 };

describe('authored VFX rendering', () => {
  it('keeps Whirlwind source art compact while splitting its committed footprint into far and near arcs', () => {
    const props = { id: 'attack.whirlwind', shape: skillFxFor('attack.whirlwind')!.shape, age: -1.3,
      source: point, point, ground: point, cast: true,
      timing: { startedAtSec: 0, releasedAtSec: .2, impactAtSec: 1.5, nowSec: .5 },
      area: { center: point, basisX: { x: 150, y: 30 }, basisY: { x: 45, y: 100 }, diameter: 320 } };
    const body = render(ArenaSkillVfx, { props }).body
      + render(ArenaSkillVfx, { props: { ...props, layer: 'ground' } }).body;
    expect(body).toContain('data-authored-vfx="attack.whirlwind"');
    expect(body).toContain('data-whirlwind-ground');
    expect(body).toContain('data-whirlwind-near-arc');
    expect(body).not.toContain('data-vfx-version="spatial-v2"');
  });

  it('interleaves Meteor landing depths with actors and keeps its footprint on the ground layer', () => {
    const state = newGame(41), arena = createCombatArena();
    state.group = [mobFixture({ id: 'target', hp: 100, hpMax: 100 })];
    const c = characterSheet(state);
    syncCombatArena(arena, state, 0, 1_000_000, c.maxHp);
    const area = { origin: 'target' as const, radiusM: 3, center: { x: arena.player.x, y: arena.player.y }, targetId: 'target' };
    const timing = { delivery: 'ground' as const, startedAtUs: 0, releaseAtUs: 0,
      impactAtUs: 200_000, recoveryUntilUs: 0 };
    const action = arenaAction(arena, 'player', 'cast', 0, 'target', 'attack.meteor', area, timing)!;
    const body = render(CombatArenaScene, { props: { arena, s: state, c, ring: [{ id: 1, sec: 0,
      kind: 'cast', text: 'Meteor', colour: '#f90', skillId: 'attack.meteor', actionId: action.id,
      atUs: 0, castTiming: timing, skillOutcome: { targets: [], area } }] } }).body;
    const depths = [...body.matchAll(/data-component-depth="(\d+)"/g)].map(match => Number(match[1]));
    expect(depths.length).toBeGreaterThan(1);
    const playerDepth = arenaComponentDepth(projectArenaPoint(arena.player).y,
      arenaCameraOffset(arena.player, arena.mobs.target).y);
    expect(Math.min(...depths)).toBeLessThan(playerDepth);
    expect(Math.max(...depths)).toBeGreaterThan(playerDepth);
    expect(body.match(/data-component-footprint=/g)).toHaveLength(1);
    expect(body.match(/data-vfx-component="meteor-fall"/g)).toHaveLength(depths.length);
    const front = body.slice(body.indexOf('class="arena-effects'));
    expect(front).not.toContain('data-vfx-component="meteor-fall"');
  });

  it('renders Whirlwind on the sampled caster with split ground arcs in the arena scene', () => {
    const state = newGame(42), arena = createCombatArena();
    state.group = [mobFixture({ id: 'target', hp: 100, hpMax: 100 })];
    const c = characterSheet(state);
    syncCombatArena(arena, state, 0, 1_500_000, c.maxHp);
    const area = { origin: 'caster' as const, radiusM: 3,
      center: { x: arena.player.x, y: arena.player.y }, shape: 'circle' as const };
    const timing = { delivery: 'melee' as const, startedAtUs: 0, releaseAtUs: 200_000,
      impactAtUs: 1_500_000, recoveryUntilUs: 0 };
    const action = arenaAction(arena, 'player', 'cast', 0, undefined, 'attack.whirlwind', area, timing)!;
    const body = render(CombatArenaScene, { props: { arena, s: state, c, ring: [{ id: 1, sec: 0,
      kind: 'cast', text: 'Whirlwind', colour: '#fd3', skillId: 'attack.whirlwind', actionId: action.id,
      atUs: 0, castTiming: timing, skillOutcome: { targets: [], area } }] } }).body;
    expect(body).toContain('data-authored-vfx="attack.whirlwind"');
    expect(body).toContain('data-whirlwind-ground');
    expect(body).toContain('data-whirlwind-near-arc');
    expect(body).not.toContain('data-vfx-version="spatial-v2"');
  });

  it('can select the retained atlas when a depth component image fails', () => {
    const body = render(ArenaSkillVfx, { props: { id: 'attack.meteor', shape: skillFxFor('attack.meteor')!.shape,
      age: .1, source: point, point, ground: point, cast: true, allowComponents: false,
      area: { center: point, basisX: { x: 180, y: 30 }, basisY: { x: 45, y: 110 }, diameter: 370 } } }).body;
    expect(body).toContain('data-vfx-version="spatial-v2"');
    expect(body).not.toContain('data-vfx-component=');
  });
  it('keeps a committed empty-ground area visible without inventing a hit', () => {
    const props = { id: 'attack.meteor', shape: skillFxFor('attack.meteor')!.shape, age: .3,
      source: point, point, ground: point, cast: true, targets: [],
      area: { center: point, basisX: { x: 180, y: 30 }, basisY: { x: 45, y: 110 }, diameter: 370 } };
    const body = render(ArenaSkillVfx, { props }).body;
    expect(body).toContain('data-authored-vfx');
    expect(body).not.toContain('damage-number');
  });

  it('renders one Ice Lance flight per supplied launch, not per authored hit count', () => {
    const body = render(ArenaAuthoredSkillVfx, { props: { id: 'attack.ice_lance', age: -.1,
      duration: .6, ground: point, source: { x: 0, y: 100 }, point, flightProgress: .5,
      strikeCount: 2, baseSize: 100 } }).body;
    expect(body.match(/data-authored-vfx="attack.ice_lance"/g)).toHaveLength(1);
  });

  it('does not claim a Reap leech transaction from its cosmetic cast alone', () => {
    const body = render(ArenaAuthoredSkillVfx, { props: { id: 'attack.reap', age: .8,
      duration: 1, ground: point, source: { x: 0, y: 100 }, point, baseSize: 100 } }).body;
    expect(body).not.toContain('data-authored-return');
  });
  it('replaces legacy supplemental art as well as the main effect', () => {
    for (const id of ['attack.aftershock', 'attack.arrow_shower', 'attack.catalyst', 'attack.detonate', 'buff.earth_wall', 'buff.ghost_dance', 'heal.cleanse']) {
      const props = {
        id, shape: skillFxFor(id)!.shape, age: .2, source: point, point, ground: point,
        cast: true, charges: 3, cleansed: 2, consumed: 3, spreadTargets: [point],
      };
      const body = render(ArenaSkillVfx, {props}).body + render(ArenaSkillVfx, {props:{...props,layer:'ground'}}).body;
      expect(body, id).toContain('data-authored-vfx');
      expect(body, id).not.toContain('/fx/library/');
      expect(body, id).not.toContain('class="arrow-flight"');
    }
  });

  it('renders every selected authored atlas through the shared component', () => {
    const area = { center: point, basisX: { x: 100, y: 0 }, basisY: { x: 0, y: 50 }, diameter: 200 };
    for (const id of Object.keys(AUTHORED_VFX)) {
      const body = render(ArenaAuthoredSkillVfx, { props: { id, age: .1, duration: 1, ground: point,
        source: point, point, baseSize: 100, allowComponents: false, looping: id.startsWith('aura.'), area } }).body;
      expect(body, id).toContain(`data-authored-vfx="${id}"`);
      expect(body, id).toContain('<image');
    }
  });

  it('draws the committed line corridor for authored line attacks', () => {
    const area = { center: point, basisX: { x: 100, y: 0 }, basisY: { x: 0, y: 50 }, diameter: 200,
      shape: 'line' as const, worldCenter: { x: 0, y: 0 }, lengthM: 5.2, widthM: .75, directionRad: 0 };
    for (const id of ['attack.piercing_shot', 'attack.impale']) {
      const body = render(ArenaSkillVfx, { props: { id, shape: skillFxFor(id)!.shape, age: .1,
        source: point, point, ground: point, cast: true, layer: 'ground', area } }).body;
      expect(body, id).toContain('data-vfx-shape="line"');
    }
  });

  it('links each Chain Lightning contact from the previous body, not a shared circle', () => {
    const state = newGame(43), arena = createCombatArena();
    const first = mobFixture({ id: 'chain-a', hp: 100, hpMax: 100 });
    const second = mobFixture({ id: 'chain-b', hp: 100, hpMax: 100 });
    state.group = [first, second];
    const c = characterSheet(state);
    syncCombatArena(arena, state, 0, 1_000_000, c.maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign(arena.mobs[first.id], { x: 2, y: 6 });
    Object.assign(arena.mobs[second.id], { x: 3, y: 6 });
    captureCombatArena(arena, state, 0);
    const area = { origin: 'target' as const, radiusM: 3, center: { x: 2, y: 6 }, targetId: first.id };
    const timing = { delivery: 'instant' as const, startedAtUs: 0, releaseAtUs: 0, impactAtUs: 0, recoveryUntilUs: 0 };
    const action = arenaAction(arena, 'player', 'cast', 0, first.id, 'attack.chain_lightning', area, timing)!;
    const hit = (id: number, mobId: string) => ({ id, sec: 0, kind: 'hit' as const, text: '', colour: '#fff',
      skillId: 'attack.chain_lightning', actionId: action.id, atUs: 0, mobId, via: 'cast' as const });
    const body = render(CombatArenaScene, { props: { arena, s: state, c, ring: [hit(1, first.id), hit(2, second.id)] } }).body;
    expect(body.match(/data-chain-from="chain-a"/g)).toHaveLength(2);
    expect(body).not.toContain('data-chain-from="chain-b"');
  });

  it('renders one Arrow Shower component per real launch payload', () => {
    const state = newGame(44), arena = createCombatArena();
    const target = mobFixture({ id: 'arrow-target', hp: 100, hpMax: 100 });
    state.group = [target];
    const c = characterSheet(state);
    syncCombatArena(arena, state, 0, 1_000_000, c.maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign(arena.mobs[target.id], { x: 2, y: 6 });
    captureCombatArena(arena, state, 0);
    const area = { origin: 'target' as const, radiusM: 0, center: { x: 2, y: 6 }, targetId: target.id };
    const timing = { delivery: 'projectile' as const, startedAtUs: -200_000, releaseAtUs: -100_000,
      impactAtUs: 200_000, recoveryUntilUs: 0 };
    const action = arenaAction(arena, 'player', 'cast', -200_000, target.id, 'attack.arrow_shower', area, timing)!;
    action.payloads = [0, 1, 2].map(index => ({ index, source: { x: 1, y: 6 }, destination: { x: 2, y: 6 },
      releaseAtUs: -100_000, plannedImpactAtUs: 200_000, targetId: target.id }));
    const body = render(CombatArenaScene, { props: { arena, s: state, c, ring: [{ id: 1, sec: 0,
      kind: 'cast', text: 'Arrow Shower', colour: '#fff', skillId: 'attack.arrow_shower',
      actionId: action.id, atUs: -200_000, castTiming: timing, skillOutcome: { targets: [target.id], area } }] } }).body;
    expect(body.match(/data-authored-vfx="attack.arrow_shower"/g)).toHaveLength(3);
  });

  it('draws one spatial field across the action footprint, including reduced motion', () => {
    for (const id of ['attack.blizzard','attack.ground_slam']) {
      for (const reducedMotion of [false,true]) {
        const props = {id,shape:skillFxFor(id)!.shape,age:.3,source:point,point,ground:point,cast:true,reducedMotion,
          area:{center:point,basisX:{x:180,y:30},basisY:{x:45,y:110},diameter:370}};
        const body=render(ArenaSkillVfx,{props}).body+render(ArenaSkillVfx,{props:{...props,layer:'ground'}}).body;
        expect(body.match(/data-vfx-version="spatial-v2"/g),id).toHaveLength(1);
        expect(body,id).toContain('matrix(');
        expect(body,id).toContain('/spatial-v2/atlas.png');
      }
    }
  });

  it('assembles local Meteor components over empty ground with one shared impact beat', () => {
    const props = { id: 'attack.meteor', shape: skillFxFor('attack.meteor')!.shape, age: -.2,
      source: point, point, ground: point, cast: true, targets: [],
      timing: { startedAtSec: -1, releasedAtSec: -.7, impactAtSec: 0, nowSec: -.2 },
      area: { center: point, basisX: { x: 180, y: 30 }, basisY: { x: 45, y: 110 }, diameter: 370 } };
    const flight = render(ArenaSkillVfx, { props }).body;
    expect(flight.match(/data-vfx-component="meteor-fall"/g)).toHaveLength(13);
    expect(flight).not.toContain('data-vfx-component="meteor-impact"');
    const contact = render(ArenaSkillVfx, { props: { ...props, age: 0,
      timing: { ...props.timing, nowSec: 0 } } }).body;
    expect(contact.match(/data-vfx-component="meteor-impact"[^>]+data-authored-frame="4"/g)).toHaveLength(13);
    const impact = render(ArenaSkillVfx, { props: { ...props, age: .2,
      timing: { ...props.timing, nowSec: .2 } } }).body;
    expect(impact.match(/data-vfx-component="meteor-impact"/g)).toHaveLength(13);
    expect(impact).not.toContain('data-vfx-component="meteor-fall"');
    const quiet = render(ArenaSkillVfx, { props: { ...props, reducedMotion: true } }).body;
    expect(quiet).toContain('vector-effect="non-scaling-stroke"');
    expect(quiet).not.toContain('data-vfx-component="meteor-fall"');
  });

  for (const reducedMotion of [false, true]) {
    it(`keeps aura art visible beyond one cycle (reduced motion: ${reducedMotion})`, () => {
      const { body } = render(ArenaAuthoredSkillVfx, { props: {
        id: 'aura.trinity_form', age: 12, duration: 1, ground: point, source: point,
        baseSize: 65, looping: true, reducedMotion,
      } });
      expect(body).toContain('data-authored-vfx="aura.trinity_form"');
      expect(body).toContain('<image');
    });
  }
});
