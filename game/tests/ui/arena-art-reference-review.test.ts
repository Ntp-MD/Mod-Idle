import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ArenaPack } from '../../src/ui/dev/arena-art/arena-art-pack-review';
import type { ArenaCharacterArt } from '../../src/ui/combat/arena/arena-art';
import { arenaSpriteFrame } from '../../src/ui/combat/combat-arena-view';

// The reference packs live in the gitignored local archive; without it the suite
// skips explicitly instead of failing to load on a fresh clone.
const archivePresent = existsSync(fileURLToPath(new URL('../../../archive/art-reference', import.meta.url)));

const load = (path: string) => import(/* @vite-ignore */ new URL(path, import.meta.url).href);

const sheets: { name: string; manifest: ArenaPack; art: ArenaCharacterArt }[] = [];
if (archivePresent) {
  const [golemManifest, spearManifest, demonManifest, skeletonManifest, skeletonBoneManifest,
    wraithManifest, wolfManifest, wispManifest, spiderManifest] = await Promise.all([
      load('../../../archive/art-reference/monsters/elemental/golem/stone-golem/clips-meta.json'),
      load('../../../archive/art-reference/monsters/humanoid/goblin/spear-goblin/meta.json'),
      load('../../../archive/art-reference/monsters/demon/imp/little-demon/meta.json'),
      load('../../../archive/art-reference/monsters/undead/skeleton/sword-shield/meta.json'),
      load('../../../archive/art-reference/monsters/undead/skeleton/original-bone/meta.json'),
      load('../../../archive/art-reference/monsters/undead/wraith/crypt-wraith/meta.json'),
      load('../../../archive/art-reference/monsters/beast/wolf/shadow-wolf/clips-meta.json'),
      load('../../../archive/art-reference/monsters/elemental/wisp/eclipse-wisp/meta.json'),
      load('../../../archive/art-reference/monsters/insect/spider/pixiblop-spider/meta.json'),
    ]);
  const [golemReviewArt, spearGoblinReviewArt, impReviewArt, skeletonSwordReviewArt, skeletonBoneReviewArt,
    cryptWraithReviewArt, shadowWolfReviewArt, eclipseWispReviewArt, pixiblopSpiderReviewArt] = await Promise.all([
      load('../../src/ui/dev/arena-art/arena-art-golem-review.ts').then(m => m.golemReviewArt),
      load('../../src/ui/dev/arena-art/arena-art-spear-goblin-review.ts').then(m => m.spearGoblinReviewArt),
      load('../../src/ui/dev/arena-art/arena-art-imp-review.ts').then(m => m.impReviewArt),
      load('../../src/ui/dev/arena-art/arena-art-skeleton-sword-review.ts').then(m => m.skeletonSwordReviewArt),
      load('../../src/ui/dev/arena-art/arena-art-skeleton-bone-review.ts').then(m => m.skeletonBoneReviewArt),
      load('../../src/ui/dev/arena-art/arena-art-crypt-wraith-review.ts').then(m => m.cryptWraithReviewArt),
      load('../../src/ui/dev/arena-art/arena-art-shadow-wolf-review.ts').then(m => m.shadowWolfReviewArt),
      load('../../src/ui/dev/arena-art/arena-art-eclipse-wisp-review.ts').then(m => m.eclipseWispReviewArt),
      load('../../src/ui/dev/arena-art/arena-art-pixiblop-spider-review.ts').then(m => m.pixiblopSpiderReviewArt),
    ]);
  sheets.push(
    { name: 'stone golem', manifest: golemManifest, art: golemReviewArt },
    { name: 'spear goblin', manifest: spearManifest, art: spearGoblinReviewArt },
    { name: 'little demon', manifest: demonManifest, art: impReviewArt },
    { name: 'skeleton sword and shield', manifest: skeletonManifest, art: skeletonSwordReviewArt },
    { name: 'skeleton original bone', manifest: skeletonBoneManifest, art: skeletonBoneReviewArt },
    { name: 'crypt wraith', manifest: wraithManifest, art: cryptWraithReviewArt },
    { name: 'shadow wolf', manifest: wolfManifest, art: shadowWolfReviewArt },
    { name: 'eclipse wisp', manifest: wispManifest, art: eclipseWispReviewArt },
    { name: 'pixiblop spider', manifest: spiderManifest, art: pixiblopSpiderReviewArt },
  );
} else {
  describe.skip('reference review art — requires the gitignored local archive/art-reference', () => {
    it('skipped: archive absent on this machine', () => {});
  });
}

/** The pack names its recoil clip "hurt"; the arena contract calls it "hit". */
const CLIPS = [['idle', 'idle'], ['walk', 'walk'], ['attack', 'attack'], ['hit', 'hurt'], ['death', 'death']] as const;

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