import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'game/public/fx/skill-pool/attack-phy/attack-arrow-shower');
const version = 'v4', generator = 'tools/compose-arrow-shower.mjs';
const destination = path.join(folder, version);
if (fs.existsSync(destination)) {
  assert.equal(JSON.parse(fs.readFileSync(path.join(destination, 'meta.json'), 'utf8')).generator,
    generator, 'v4 belongs to another author');
}
const source = JSON.parse(fs.readFileSync(path.join(folder, 'v1/meta.json'), 'utf8'));
const bytes = fs.readFileSync(path.join(folder, 'v1/atlas.png'));
const meta = { ...source, generator,
  src: `/fx/skill-pool/attack-phy/attack-arrow-shower/${version}/atlas.png`,
  sourceVersions: ['v1'], sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  sourcePixelsUnmodified: true, orient: false,
  rainDurationSec: .8, rainPhase: 'Impact', rainIntervalSec: .16,
  rainSizeScale: .2, rainRadiusRatio: .98, rainSpreadM: 1.35,
  authoringGeometry: { shape: 'single', origin: 'target', radiusM: 0, delivery: 'projectile' },
  composition: 'Original v1 artwork as staggered falling-arrow rain around each committed contact; visual spread only, actual damage remains owned by burst receipts.',
};
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, 'atlas.png'), bytes);
fs.writeFileSync(path.join(destination, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
fs.mkdirSync(path.join(folder, 'default'), { recursive: true });
fs.writeFileSync(path.join(folder, 'default/version.json'), JSON.stringify({ version }, null, 2) + '\n');
console.log('Arrow Shower v4: original v1 sprites, continuous evenly distributed falling rain per committed hit.');
