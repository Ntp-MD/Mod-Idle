import { pilotArt, type SpriteAtlasMetadata } from '../../combat/arena/arena-art-pixel-v2';
import { arenaArtForSpecies, type ArenaCharacterArt } from '../../combat/arena/arena-art';
import { MOB_DRAFT_VARIANT_QA_PASS_METADATA_PATHS } from './arena-art-mob-drafts-qa-pass';

type MobDraftMetadata = SpriteAtlasMetadata & {
  speciesId: string;
  variantId: string;
  name: string;
};

const metadataModules = import.meta.glob<MobDraftMetadata>(
  '../../../../../art-reference/monsters/*/variants/*/meta.json',
  { import: 'default' },
);
const atlasModules = import.meta.glob<string>(
  '../../../../../art-reference/monsters/*/variants/*/atlas/animation-draft.png',
  { query: '?url', import: 'default' },
);
const qaPassedMetadataPaths = new Set<string>(MOB_DRAFT_VARIANT_QA_PASS_METADATA_PATHS);

/** Load one named gameplay variant atlas for the development showcase only. */
export async function loadMobDraftReviewArt(speciesId: string, variantId: string): Promise<ArenaCharacterArt | null> {
  const repositoryMetadataPath = `art-reference/monsters/${speciesId}/variants/${variantId}/meta.json`;
  if (!qaPassedMetadataPaths.has(repositoryMetadataPath)) return null;

  const basePath = `../../../../../art-reference/monsters/${speciesId}/variants/${variantId}`;
  const metadataPath = `${basePath}/meta.json`;
  const atlasPath = `${basePath}/atlas/animation-draft.png`;
  const loadMetadata = metadataModules[metadataPath];
  const loadAtlas = atlasModules[atlasPath];
  if (!loadMetadata || !loadAtlas) return null;

  const [metadata, href] = await Promise.all([loadMetadata(), loadAtlas()]);
  if (metadata.speciesId !== speciesId || metadata.variantId !== variantId
    || metadata.frameCanvas.width !== 384 || metadata.frameCanvas.height !== 384
    || metadata.sourceFrames?.length !== 40) return null;

  if (speciesId === 'beetle') return arenaArtForSpecies(speciesId, metadata.name);

  return pilotArt(href, metadata, 224);
}
