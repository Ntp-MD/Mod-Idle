import { newGame, setLevel, tick, spawnMob, characterSheet, hitColour } from '@sim/core/game';
import { rollDrop } from '@sim/gear/drop';
import { respecStats, allocateStats } from '@sim/core/respec';
import { toggleTrack, condOf } from '@sim/combat/skills';
import { storePreset } from '@sim/core/presets';
import { offerDelivery, deliver, tickDeliveries } from '@sim/town/delivery';
import { tradeBucket } from '@sim/town/trade';
import { replaceChoices } from '@sim/gear/craft';
import { currentCell, road } from '@sim/world/road';
import { fieldwork, eng, sm, TOWN, trade, BASES, loot, E } from '../../engine/client';
import { mulberry32 } from '../../engine/client-helpers';
import { slotsUsed, slotsAvailable } from '@sim/gear/slots';
import { ACTIVE_SLOTS } from '@sim/combat/skills';
import { showcaseFieldSkill } from './samples';
import type { GameState, Item, Mob, FxEvent } from '@sim/core/types';
import type { FxEvent as FxEventType } from '@sim/core/types';

export interface ArenaVariantLike { speciesId: string }
export interface ShowcaseGameOpts {
  activeArenaVariant: ArenaVariantLike | null;
  ArenaPreviewSpawn: Record<string, string>;
  arenaSpecies: string;
  spritePreviewMode: boolean;
  arenaSkillId: string;
  showcasePlayerWeapon: string | null;
  showcasePlayerOffhand: string | null;
  fieldLabel(m: { species: string; speciesId?: string; kind: string; variant?: string; formName?: string }): string;
  previewFire: { id: string; name?: string; element?: string } | undefined;
  previewHeal: { id: string; name?: string; element?: string } | undefined;
  previewLightning: { id: string; name?: string; element?: string } | undefined;
}

export function buildShowcaseGame(opts: ShowcaseGameOpts, scenario: string = 'delivery'): GameState {
    const sample = newGame();
    sample.fieldwork.materials['copper-ore'] = 12;
    sample.fieldwork.materials.timber = 8;
    sample.fieldwork.foods['river-fish'] = 5;
    sample.junk[(E.mob.variant_drops as Record<string, { item: string }>)[(E.mob.variants as any[]).find((row) => row.species === 'goblin').id].item] = 20;
    sample.hunting = true;
    if (showcaseFieldSkill(scenario)) {
      const speciesId = opts.activeArenaVariant?.speciesId ?? opts.ArenaPreviewSpawn[opts.arenaSpecies] ?? opts.arenaSpecies;
      const species = eng.speciesById(speciesId);
      const spawnBody = opts.spritePreviewMode && !species.sizes.includes('small') ? species.sizes[0] : 'small';
      const spawnZone = species.zones.includes(sample.zone) ? sample.zone : species.zones[0];
      const spawnSubzone = opts.spritePreviewMode
        ? eng.zoneById(spawnZone).subzones?.findIndex((sub: { species: string[] }) => sub.species.includes(speciesId))
        : undefined;
      setLevel(sample, 5);
      sample.phase = 'fighting';
      const rng = mulberry32(20261024);
      // Three copies expose the multi-Mob layout while replaying one selected species sheet.
      const encounterSize = 3;
      const mobs: Mob[] = [];
      for (let attempt = 0; attempt < 100 && mobs.length < encounterSize; attempt++) {
        const mob = spawnMob(rng, spawnZone, 'normal', spawnBody, spawnSubzone, { allowWildUnique: false });
        if (mob.speciesId === speciesId) mobs.push(mob);
      }
      if (mobs.length) sample.group = mobs;
      if (opts.spritePreviewMode && mobs.length) setLevel(sample, Math.max(5, ...mobs.map(mob => mob.level)));
      const previewSkill = sm.byId[opts.arenaSkillId] ?? sm.byId['attack.fireball'];
      sample.skills.owned[previewSkill.id] = 0;
      sample.skills.list.fill(null);
      if (previewSkill.type === 'buff') {
        sample.skills.buffs[previewSkill.id] = true;
        sample.skills.buffUp[previewSkill.id] = 0;
      } else if (previewSkill.type === 'aura') {
        sample.skills.auras[previewSkill.id] = true;
      } else {
        sample.skills.list[0] = previewSkill.id;
        sample.skills.cd[previewSkill.id] = 0;
      }
      // Hold a weapon the chosen skill can actually fire — the arena only casts a press its weapon fits,
      // so a bow row needs a bow and a spell reads best off a magic weapon.
      const fittingWeapon = (E.weapons as any[]).find((w) => sm.weaponFits(previewSkill, w.name)
        && (!previewSkill.group || previewSkill.group === 'all' || sm.weaponGroupOf(w.name) === previewSkill.group));
      const requestedFrames = opts.showcasePlayerWeapon
        ? (BASES.weapon_frames as Record<string, { name: string }[]>)[opts.showcasePlayerWeapon]
        : undefined;
      const previewWeaponBase = requestedFrames?.[0]?.name ?? fittingWeapon?.name;
      const mainHandIndex = loot.SLOTS.findIndex((slot: string) => slot === 'main hand');
      if (previewWeaponBase && mainHandIndex >= 0) {
        sample.gear[mainHandIndex] = { slot: 'main hand', base: previewWeaponBase, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] };
      }
      if (opts.showcasePlayerOffhand === 'shield') {
        const shieldBase = (BASES.bases as { name: string; slot?: string; family?: string | null }[])
          .find(item => item.slot === 'off hand' && item.family === 'Shield');
        const offhandIndex = loot.SLOTS.findIndex((slot: string) => slot === 'off hand');
        if (shieldBase && offhandIndex >= 0)
          sample.gear[offhandIndex] = { slot: 'off hand', base: shieldBase.name, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] };
      }
      const sheet = characterSheet(sample);
      sample.player.hp = previewSkill.type === 'heal' ? Math.round(sheet.maxHp * .6) : sheet.maxHp;
      sample.player.es = sheet.es;
      sample.player.mana = sheet.maxMana;
      return sample;
    }
    tick(sample, { online: false, autoSkills: false });
    if (scenario === 'offline-progress') return sample;
    if (scenario === 'core-field') {
      sample.player.autoSpend = false;
      setLevel(sample, 10);
      respecStats(sample);
      allocateStats(sample, 'str', 5);
      // A field sample must stand on bare owned ground, not on the town's dungeon cell that
      // happens to sit one hex east after the world renovation.
      const base = currentCell(sample);
      const bare = road.land
        .filter((cell: { q: number; r: number }) => !road.locationAt(cell)
          && road.owningNode(cell, [sample.town.waypoint]).id === sample.town.waypoint)
        .sort((a: { q: number; r: number }, b: { q: number; r: number }) =>
          (road.blocksLand(base, a) ?? 1e9) - (road.blocksLand(base, b) ?? 1e9))[0];
      if (bare) sample.cell = { q: bare.q, r: bare.r, sub: null, site: null };
      sample.hunting = false;
      sample.group = [];
      const sheet = characterSheet(sample);
      sample.player.hp = Math.min(sample.player.hp, sheet.maxHp);
      sample.player.mana = Math.min(sample.player.mana, sheet.maxMana);
      sample.player.es = Math.min(sample.player.es, sheet.es);
      return sample;
    }
    const starter = sample.gear.find((piece): piece is Item => piece !== null);
    if (starter) {
      const carriedSample = structuredClone(starter);
      carriedSample.locked = true;
      sample.bag.push(carriedSample);
    }
    if (scenario === 'build-workbench') {
      sample.player.autoSpend = false;
      setLevel(sample, 30);
      for (const skill of sm.all()) sample.skills.owned[skill.id] = 0;
      sample.skills.list = sm.all().filter(skill => ['attack', 'curse', 'heal'].includes(skill.type || ''))
        .slice(0, ACTIVE_SLOTS).map(skill => skill.id);
      sample.skills.mode[sample.skills.list[0]!] = 'conditional';
      sample.skills.conditions[sample.skills.list[0]!] = { ...condOf(sample.skills, sample.skills.list[0]!), boss: true, minTargets: 3, manaFloorPct: 20 };
      const aura = sm.of('aura')[0];
      if (aura) toggleTrack(sample.skills, aura.id);
      const buff = sm.of('buff')[0];
      if (buff) { sample.skills.buffs[buff.id] = true; sample.skills.buffUp[buff.id] = 20; }
      sample.player.treePoints = 40;
      sample.player.attainmentPoints = 8;
      sample.bag.push(rollDrop(mulberry32(20261024), 'mid', 42));
      sample.bag.push(rollDrop(mulberry32(20261025), 'mid', 42));
      sample.presets[0].zones = [sample.zone];
      storePreset(sample);
      return sample;
    }
    if (scenario === 'craft-stash') {
      sample.counters.stones = {
        ...sample.counters.stones,
        reroll_value: 9, tier: 9, add: 6, remove: 4, replace: 5, quality: 5,
        repair: 2, corrupt: 1, polish: 2, reforge: 2, rebirth: 2,
      };
      // a real drop, so the bench sample carries Unbound lines the line tabs can open
      sample.bag.push(rollDrop(mulberry32(20260218), 'mid', 42));
      // A compatible held Imprint exercises the same targeting flow as regular stones.
      const imprintMod = replaceChoices(sample, 'bag', sample.bag.length - 1)[0];
      if (imprintMod) sample.counters.stones[`imprint_${imprintMod}`] = 2;
      const stashIndexes = sample.gear
        .map((piece, position) => piece && position > 0 ? position : -1)
        .filter((position) => position >= 0)
        .slice(0, 2);
      if (stashIndexes.length) {
        sample.grants.stash_tabs = Math.max(1, sample.grants.stash_tabs || 0);
        sample.stash[0] ||= [];
        for (const stashIndex of stashIndexes) {
          const stashPiece = sample.gear[stashIndex];
          if (!stashPiece) continue;
          sample.gear[stashIndex] = null;
          sample.stash[0].push(structuredClone(stashPiece));
        }
      }
    }
    const activeSkill = Object.values(sm.byId).find((skill) => skill.type && ['attack', 'curse', 'heal'].includes(skill.type));
    if (activeSkill) {
      sample.skills.owned[activeSkill.id] = 0;
      sample.skills.list[0] = activeSkill.id;
    }
    if (scenario.startsWith('story-')) {
      // Storyteller fixtures (plan §14.3): seeded source helpers build the frozen
      // offers/results; the hosts render them through the shared presenters.
      sample.hunting = false;
      sample.group = [];
      const campCell = { ...currentCell(sample) } as { q: number; r: number; sub: null; site: null };
      sample.fieldwork.camp = { cell: campCell, zone: sample.zone };
      const atCamp = () => { sample.hunting = false; sample.group = []; sample.phase = 'fighting'; sample.walk = null; sample.dungeon = null; };
      const cacheOffer = () => {
        const foodId = fieldwork.F.regional_sources[String(sample.zone)]?.food || 'river-fish';
        return fieldwork.cacheOffer(sample.zone, foodId, 0.1);
      };
      const campActive = (kind: string, stage: string, sceneId: string, cache: ReturnType<typeof cacheOffer> | null = null, remainingSec = 0) => {
        const serial = ++sample.fieldwork.campEncounters.serial;
        sample.fieldwork.campEncounters.active = {
          id: serial, kind: kind as any, stage: stage as any, origin: { ...campCell },
          warningSec: 10, choiceSec: 10, payload: kind === 'supply-cache' ? { foodId: cache!.foodId } : { species: eng.speciesInZone(sample.zone)[0] ?? null },
          preparedGroup: [], participantIds: [],
          story: {
            revision: 1, eventId: `camp-${kind === 'supply-cache' ? 'supply-cache' : kind}`,
            sceneId, lineIndex: 0, beat: 0, cache, remainingSec,
          } as any,
        };
        sample.fieldwork.campEncounters.storyHistory = [{
          encounterId: serial, eventId: sample.fieldwork.campEncounters.active.story!.eventId as string,
          kind: kind as any, variantId: `${sceneId}-0`, terminalAction: null, followupUsed: false,
        }];
      };
      if (scenario === 'story-camp-warning') { atCamp(); campActive('sounds', 'warning', 'sounds-signs'); return sample; }
      if (scenario === 'story-cache-choices') { atCamp(); sample.fieldwork.foods[cacheOffer().foodId] = 5; campActive('supply-cache', 'choice', 'cache-ledge', cacheOffer()); return sample; }
      if (scenario === 'story-cache-working') { atCamp(); const offer = cacheOffer(); campActive('supply-cache', 'resolving', 'cache-ledge', offer, Math.ceil(offer.carefulSec / 2)); return sample; }
      if (scenario === 'story-cache-bagfull') { atCamp(); const offer = cacheOffer(); campActive('supply-cache', 'collect', 'cache-ledge', offer, 0); return sample; }
      if (scenario === 'story-cache-results') {
        atCamp();
        sample.fieldwork.campEncounters.serial = 1;
        sample.fieldwork.campEncounters.lastReceipt = {
          encounterId: 1, eventId: 'camp-supply-cache', kind: 'supply-cache', action: 'cache-quick',
          sceneId: 'cache-gain-result', elapsedSec: 0, paid: [],
          earned: [{ bucket: 'material', id: 'ore', count: 2 }], lost: [], info: [],
        };
        sample.fieldwork.campEncounters.recap = 'Quick cache recovery complete';
        return sample;
      }
      if (scenario === 'story-delivery-choices') {
        const draws = [0, 0.99, 0, 0, 0];
        const contract = offerDelivery(sample, sample.town.waypoint, () => draws.shift() ?? 0, { writer: true });
        if (contract) tradeBucket(sample, trade.byId[contract.good])[trade.byId[contract.good].key] = contract.target;
        return sample;
      }
      if (scenario === 'story-courier-unaccepted' || scenario === 'story-courier-destination') {
        const draws = [0, 0.99, 0, 0, 0];
        const contract = offerDelivery(sample, sample.town.waypoint, () => draws.shift() ?? 0, { writer: true });
        if (contract) {
          const other = (TOWN.settlements as any[]).find((row) => row.id !== sample.town.waypoint)!.id;
          if (!sample.town.visited.includes(other)) sample.town.visited.push(other);
          const courier = { ...contract, id: `courier:${sample.town.waypoint}:${++sample.town.courierSerial}`, serial: sample.town.courierSerial, kind: 'courier' as const, destinationTown: other, acceptedAtDeliverySec: scenario === 'story-courier-destination' ? sample.town.deliveryClockSec : null, offeredAtDeliverySec: sample.town.deliveryClockSec, endReason: null };
          sample.town.contracts[sample.town.waypoint] = [courier];
        }
        return sample;
      }
      if (scenario === 'story-market-promotion') return sample;
      if (scenario === 'story-forge-ready') { sample.fieldwork.materials['copper-ore'] = 12; return sample; }
      if (scenario === 'story-forge-shortage') { sample.fieldwork.materials['copper-ore'] = 0; sample.fieldwork.materials.timber = 0; return sample; }
      if (scenario === 'story-road-result') {
        sample.mapJournal!.lastEvent = { ...currentCell(sample), text: 'Found River Fish along the trail · River Fish ×2', atSec: sample.clockSec, source: 'road', resourceDeltas: [{ bucket: 'food', id: 'river-fish', count: 2 }], hungerDelta: 0 };
        return sample;
      }
      if (scenario === 'story-site-result') {
        sample.mapJournal!.lastEvent = { ...currentCell(sample), text: 'Shallow Cache · Hunger 88%', atSec: sample.clockSec, source: 'site', resourceDeltas: [], hungerDelta: 4 };
        return sample;
      }
      if (scenario === 'story-dungeon-result') {
        // The dungeon entrance sits one hex east of the town node; stand on it so
        // the TravelCard shows the shared result next to the entrance facts.
        const feet = currentCell(sample);
        sample.cell = { q: feet.q + 1, r: feet.r, sub: null, site: 'dungeon' };
        sample.lastDungeonReceipt = {
          key: `dungeon:${sample.zone}:${sample.clockSec}:cleared`, zone: sample.zone, atSec: sample.clockSec, reason: 'cleared',
          kept: [{ bucket: 'stone', id: 'tier', count: 2 }], forfeited: [], uncollected: [{ bucket: 'junk', id: 'junk', count: 1 }],
          gear: { processed: 1, retained: 1, salvaged: 0, rejected: 0, forfeited: 0 },
        };
        return sample;
      }
      if (scenario === 'story-read-only') { atCamp(); campActive('sounds', 'warning', 'sounds-signs'); return sample; }
      return sample;
    }
    if (scenario !== 'craft-stash') {
      const draws = [0, 0.99, 0, 0, 0];
      if (scenario === 'choice') sample.town.contractSerial = 1;
      const contract = offerDelivery(sample, sample.town.waypoint, () => draws.shift() ?? 0, { writer: true });
      if (contract) {
        const good = trade.byId[contract.good];
        tradeBucket(sample, good)[good.key] = contract.target;
        if (scenario === 'full-bag') {
          tradeBucket(sample, good)[good.key] += contract.target;
          const free = Math.max(0, slotsAvailable(sample) - slotsUsed(sample));
          sample.counters.stones.reroll_value = free * E.inventory.stack_size.stone;
        }
        if (scenario === 'fallback' && contract.reward.skill) sample.skills.owned[contract.reward.skill] = sm.LADDER_MAX_DUPLICATES;
        if (scenario === 'expired') {
          deliver(sample, contract.id, Math.max(1, Math.floor(contract.target / 2)), { writer: true });
          sample.clockSec += contract.dueAtDeliverySec - sample.town.deliveryClockSec;
          sample.town.deliveryClockSec = contract.dueAtDeliverySec;
          tickDeliveries(sample, () => 1, false, true, { writer: true });
        }
      }
    }
    if (scenario === 'combat-fx') {
      // Partial pools keep the waterline, glass and resource effects visible in the preview.
      sample.player.hp = Math.round(sample.player.hp * .65);
      sample.player.mana = Math.round(sample.player.mana * .48);
      sample.player.es = Math.round(sample.player.es * .35);
      const mob = sample.group[0];
      if (mob) {
        sample.mobStatus[mob.id] = {
          statuses: {
            burn: { stacks: 2, secLeft: 8, perSec: 24 },
            chill: { stacks: 1, secLeft: 10, perSec: 0 },
            shock: { stacks: 1, secLeft: 1, perSec: 0 },
          },
          alignedPerSec: 24, stoppedSec: 0, elapsedSec: 1,
        };
        const buff = sm.of('buff').find((skill: any) => skill.type === 'buff');
        if (buff) {
          sample.skills.owned[buff.id] ??= 0;
          sample.skills.buffs[buff.id] = true;
          sample.skills.buffUp[buff.id] = 26;
        }
        const sec = sample.clockSec;
        const events: Omit<FxEvent, 'id' | 'sec'>[] = [
          { kind: 'hit', side: 'field', mobId: mob.id, via: 'swing', text: '248', value: 248, colour: hitColour('physical') },
          { kind: 'hit', side: 'field', mobId: mob.id, via: 'cast', skillId: opts.previewFire?.id, text: '1,240!', value: 1240, crit: true, colour: hitColour(opts.previewFire?.element, true) },
          { kind: 'hit', side: 'field', mobId: mob.id, via: 'dot', text: '36', value: 36, colour: hitColour('fire') },
          { kind: 'block', side: 'field', mobId: mob.id, text: 'Dodge', colour: hitColour(null) },
          { kind: 'kill', side: 'field', mobId: mob.id, text: `${opts.fieldLabel(mob)} defeated`, colour: hitColour(null) },
          { kind: 'drop', side: 'field', text: 'Fine gear', colour: hitColour(null) },
          { kind: 'cast', side: 'self', skillId: opts.previewFire?.id, text: opts.previewFire?.name || '', colour: hitColour(opts.previewFire?.element) },
          { kind: 'buff', side: 'self', skillId: buff?.id, text: buff?.name || 'Battle Focus', colour: hitColour(buff?.element) },
          { kind: 'heal', side: 'self', skillId: opts.previewHeal?.id, text: '+86', colour: hitColour(opts.previewHeal?.element) },
          { kind: 'taken', side: 'self', byId: mob.id, text: '142', value: 142, colour: hitColour('chaos') },
          { kind: 'block', side: 'self', byId: mob.id, text: 'Block', colour: hitColour(null) },
          { kind: 'proc', side: 'self', text: 'Poison', colour: hitColour('poison') },
        ];
        sample.fx = events.map((event, index) => ({ ...event, id: index + 1, sec } as FxEvent)).reverse();
        sample.fxSeq = events.length;
      }
    }
    return sample;
  }
  /**
   * The play screen is the field itself, laid out the way a phone game laid out on a monitor does: the
   * fight fills the frame and every read sits in a corner, so nothing the player has to watch can be
   * scrolled off. The map is the ground the field stands on, so it is worked where it is seen: the MAP
   * tab brings the backdrop into focus; Journey presents the selected hex, travel tools and map controls,
   * and a cell is picked, plotted and walked from there. Nothing about travelling a place ever
   * needed a modal. The desk is the one screen a settlement owns: the stall, the board, the counter and
   * the two tables, opened from the rail or from a place's card.
   */
