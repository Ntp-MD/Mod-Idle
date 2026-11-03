import { pilotArt, type SpriteAtlasMetadata } from '../../combat/arena/arena-art-pixel-v2';
import { arenaArtForSpecies, type ArenaCharacterArt } from '../../combat/arena/arena-art';
import { MOB_DRAFT_VARIANT_QA_PASS_METADATA_PATHS } from './arena-art-mob-drafts-qa-pass';

type MobDraftMetadata = SpriteAtlasMetadata & {
  speciesId: string;
  variantId: string;
  name: string;
};

const metadataModules = import.meta.glob<MobDraftMetadata>(
  '../../../../../art-reference/monsters/*/*/variants/*/meta.json',
  { import: 'default' },
);
const atlasModules = import.meta.glob<string>(
  '../../../../../art-reference/monsters/*/*/variants/*/atlas/animation-draft.png',
  { query: '?url', import: 'default' },
);
const qaPassedMetadataPaths = new Set<string>(MOB_DRAFT_VARIANT_QA_PASS_METADATA_PATHS);

/** Load one named gameplay variant atlas for the development showcase only. */
export async function loadMobDraftReviewArt(speciesId: string, variantId: string): Promise<ArenaCharacterArt | null> {
  const metadataSuffix = `${speciesId}/variants/${variantId}/meta.json`;
  if (![...qaPassedMetadataPaths].some((path) => path.endsWith(metadataSuffix))) return null;

  const atlasSuffix = `${speciesId}/variants/${variantId}/atlas/animation-draft.png`;
  const metadataKey = Object.keys(metadataModules).find((key) => key.endsWith(metadataSuffix));
  const atlasKey = Object.keys(atlasModules).find((key) => key.endsWith(atlasSuffix));
  const loadMetadata = metadataKey ? metadataModules[metadataKey] : undefined;
  const loadAtlas = atlasKey ? atlasModules[atlasKey] : undefined;
  if (!loadMetadata || !loadAtlas) return null;

  const [metadata, href] = await Promise.all([loadMetadata(), loadAtlas()]);
  if (metadata.speciesId !== speciesId || metadata.variantId !== variantId
    || metadata.frameCanvas.width !== 384 || metadata.frameCanvas.height !== 384
    || metadata.sourceFrames?.length !== 40) return null;

  if (speciesId === 'beetle') return arenaArtForSpecies(speciesId, metadata.name);

  return pilotArt(href, metadata, 224);
}
