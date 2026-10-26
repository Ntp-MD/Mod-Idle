import { describe, expect, it } from 'vitest';
import wraithManifest from '../../art-reference/monsters/wraith/crypt-wraith/meta.json';
import demonManifest from '../../art-reference/monsters/imp/little-demon/meta.json';
import golemManifest from '../../art-reference/monsters/golem/stone-golem/meta.json';
import skeletonBoneManifest from '../../art-reference/monsters/skeleton/original-bone/meta.json';
import skeletonManifest from '../../art-reference/monsters/skeleton/sword-shield/meta.json';
import spiderManifest from '../../art-reference/monsters/spider/pixiblop-spider/meta.json';
import spearManifest from '../../art-reference/monsters/goblin/spear-goblin/meta.json';
import wispManifest from '../../art-reference/monsters/wisp/eclipse-wisp/meta.json';
import wolfManifest from '../../art-reference/monsters/wolf/shadow-wolf/meta.json';
import { impReviewArt } from '../src/ui/dev/arena-art/arena-art-imp-review';
import { golemReviewArt } from '../src/ui/dev/arena-art/arena-art-golem-review';
import { skeletonBoneReviewArt } from '../src/ui/dev/arena-art/arena-art-skeleton-bone-review';
import { skeletonSwordReviewArt } from '../src/ui/dev/arena-art/arena-art-skeleton-sword-review';
import { spearGoblinReviewArt } from '../src/ui/dev/arena-art/arena-art-spear-goblin-review';
import { cryptWraithReviewArt } from '../src/ui/dev/arena-art/arena-art-crypt-wraith-review';
import { shadowWolfReviewArt } from '../src/ui/dev/arena-art/arena-art-shadow-wolf-review';
import { eclipseWispReviewArt } from '../src/ui/dev/arena-art/arena-art-eclipse-wisp-review';
import { pixiblopSpiderReviewArt } from '../src/ui/dev/arena-art/arena-art-pixiblop-spider-review';
import type { ArenaPack } from '../src/ui/dev/arena-art/arena-art-pack-review';
import type { ArenaCharacterArt } from '../src/ui/combat/arena/arena-art';
import { arenaSpriteFrame } from '../src/ui/combat/combat-arena-view';

/** The pack names its recoil clip "hurt"; the arena contract calls it "hit". */
const CLIPS = [['idle', 'idle'], ['walk', 'walk'], ['attack', 'attack'], ['hit', 'hurt'], ['death', 'death']] as const;

const sheets: { name: string; manifest: ArenaPack; art: ArenaCharacterArt }[] = [
  { name: 'stone golem', manifest: golemManifest, art: golemReviewArt },
  { name: 'spear goblin', manifest: spearManifest, art: spearGoblinReviewArt },
  { name: 'little demon', manifest: demonManifest, art: impReviewArt },
  { name: 'skeleton sword and shield', manifest: skeletonManifest, art: skeletonSwordReviewArt },
  { name: 'skeleton original bone', manifest: skeletonBoneManifest, art: skeletonBoneReviewArt },
  { name: 'crypt wraith', manifest: wraithManifest, art: cryptWraithReviewArt },
  { name: 'shadow wolf', manifest: wolfManifest, art: shadowWolfReviewArt },
  { name: 'eclipse wisp', manifest: wispManifest, art: eclipseWispReviewArt },
  { name: 'pixiblop spider', manifest: spiderManifest, art: pixiblopSpiderReviewArt },
];

describe.each(sheets)('reference review art · $name', ({ manifest, art }) => {
  const recoil = manifest.clips.hurt ? ['hit'] : [];

  it('maps every extracted clip onto both reachable directions', () => {
    expect(Object.keys(art.clips).sort()).toEqual(['attack', 'death', ...recoil, 'idle', 'walk']);
    for (const [clip, manifestKey] of CLIPS) {
      const source = manifest.clips[manifestKey];
      if (!source) continue;
      const sheet = art.clips[clip as keyof typeof art.clips];
      expect(Object.keys(sheet ?? {}).sort()).toEqual(['east', 'west']);
      expect(sheet?.east?.frames).toBe(source.frames);
      expect(sheet?.east?.frameWidth).toBe(source.cell[0]);
      expect(sheet?.east?.frameHeight).toBe(source.cell[1]);
      expect(sheet?.east?.href.endsWith(source.file)).toBe(true);
    }
  });

  it('plants every clip on the same ground line so poses do not float when they switch', () => {
    for (const sheet of Object.values(art.clips)) {
      expect(sheet.east?.anchor).toEqual({ x: .5, y: 1 });
    }
    expect(art.anchor).toEqual({ x: .5, y: 1 });
  });

  it('loops the gait clips and lands the contact beat inside its own duration', () => {
    expect(art.clips.idle.east?.loop).toBe(true);
    expect(art.clips.walk.west?.loop).toBe(true);
    const attack = art.clips.attack.east!;
    expect(attack.loop).toBe(false);
    expect(attack.impactMs).toBeGreaterThan(0);
    expect(attack.impactMs! + attack.frameMs).toBeLessThan(attack.frames * attack.frameMs);
  });

  it('reads only frames inside its own strip', () => {
    const clips = [art.clips.idle.east, art.clips.walk.east, art.clips.attack.east,
      art.clips.hit?.east, art.clips.death?.east].filter(Boolean);
    expect(clips).toHaveLength(recoil.length + 4);
    for (const sheet of clips) {
      const last = arenaSpriteFrame(sheet!, (sheet!.frames - 1) * sheet!.frameMs, false, true);
      const [x, , width] = last.split(' ').map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(sheet!.frameWidth * sheet!.columns);
    }
  });
});
