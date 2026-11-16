"""Focused tests for installing pawn-study atlases into the runtime pool."""

import importlib.util
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from PIL import Image, ImageDraw


SCRIPT = Path(__file__).resolve().parents[1] / 'docs/character/pawn-study/build-study.py'
SPEC = importlib.util.spec_from_file_location('pawn_study', SCRIPT)
assert SPEC and SPEC.loader
study = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(study)


class PawnStudyIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='pawn-study-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.out = self.root / 'docs/character/pawn-study'
        self.out.mkdir(parents=True)
        self.public = self.root / 'game/public'
        player = self.public / 'combat/arpg/player/pawn/default'
        player.mkdir(parents=True)
        (player / 'version.json').write_text('{"version":"v2"}', encoding='utf-8')
        self.directions = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
        layout = {'columns': 4, 'rows': 2, 'frameCount': 8, 'directions': self.directions}
        self.atlas = self.out / 'atlases/sample.png'
        self.atlas.parent.mkdir()
        self.write_atlas((200, 80, 30, 255))
        base = {'name': 'Sample', 'race': 'beast', 'atlas': 'atlases/sample.png',
                'layout': layout, 'productionApproved': True, 'sourceSha256': 'sample'}
        species = [{'id': f'species-{i:02}', 'race': 'beast'} for i in range(36)]
        species[0].update(base)
        variant = {**base, 'id': 'species-00--sample', 'kind': 'variant', 'variantOf': 'species-00'}
        self.manifest = {
            'speciesCount': 36, 'variantCount': 1, 'entries': [{'id': 'player'}, *species],
            'variants': [variant], 'directions': self.directions, 'anchor': [128, 224],
            'motionPolicy': 'static', 'atlasLayout': '4x2',
        }
        self.write_manifest()

    def write_atlas(self, color):
        image = Image.new('RGBA', (1024, 512))
        draw = ImageDraw.Draw(image)
        for index in range(8):
            x, y = index % 4 * 256, index // 4 * 256
            draw.rectangle((x + 64, y + 64, x + 160, y + 200), fill=color)
        image.save(self.atlas)

    def write_manifest(self):
        (self.out / 'manifest.json').write_text(json.dumps(self.manifest), encoding='utf-8')

    def integrate(self, *ids):
        with patch.object(study, 'ROOT', self.root), patch.object(study, 'OUT', self.out), redirect_stdout(StringIO()):
            study.integrate(ids)

    def test_species_master_is_updated_in_place_and_player_pointer_survives(self):
        self.integrate('species-00')
        folder = self.public / 'combat/mob-pool/beast/species-00'
        master = folder / 'master-version'
        self.assertEqual((master / 'atlas.png').read_bytes(), self.atlas.read_bytes())
        self.write_atlas((30, 80, 200, 255))
        self.integrate('species-00')
        self.assertEqual((master / 'atlas.png').read_bytes(), self.atlas.read_bytes())
        self.assertEqual([p.name for p in folder.iterdir()], ['master-version'])
        self.assertEqual(json.loads((self.public / 'combat/arpg/player/pawn/default/version.json').read_text())['version'], 'v2')

    def test_variant_uses_its_own_master(self):
        self.integrate('species-00--sample')
        master = self.public / 'combat/mob-pool/beast/species-00/variants/sample/master-version'
        meta = json.loads((master / 'meta.json').read_text(encoding='utf-8'))
        self.assertEqual((meta['speciesId'], meta['variantId']), ('species-00', 'sample'))
        self.assertEqual((master / 'atlas.png').read_bytes(), self.atlas.read_bytes())

    def test_unreviewed_or_unrelated_master_is_never_overwritten(self):
        self.manifest['entries'][1]['productionApproved'] = False
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, 'requires pose'):
            self.integrate('species-00')
        self.manifest['entries'][1]['productionApproved'] = True
        self.write_manifest()
        self.integrate('species-00')
        master = self.public / 'combat/mob-pool/beast/species-00/master-version'
        before = (master / 'atlas.png').read_bytes()
        meta = json.loads((master / 'meta.json').read_text(encoding='utf-8'))
        meta['artSet'] = 'other'
        (master / 'meta.json').write_text(json.dumps(meta), encoding='utf-8')
        self.write_atlas((30, 80, 200, 255))
        with self.assertRaisesRegex(FileExistsError, 'Unexpected master'):
            self.integrate('species-00')
        self.assertEqual((master / 'atlas.png').read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
