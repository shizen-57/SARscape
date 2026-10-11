"""Network-free checks for the regional NISAR subset selection."""
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend/.python'))
sys.path.insert(0, str(ROOT / 'backend/geo'))
import h5py
import numpy as np
from pyproj import Transformer
import prepare_aletsch


class PrepareAletschTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.source = self.root / 'fixture.h5'
        self.subset = self.root / 'subset.h5'
        west, south, east, north = Transformer.from_crs(4326, 32632, always_xy=True).transform_bounds(
            *prepare_aletsch.BBOX, densify_pts=21
        )
        x = np.arange(west - 400, east + 400, 80, dtype=np.float64)
        y = np.arange(north + 400, south - 400, -80, dtype=np.float64)
        shape = (len(y), len(x))
        with h5py.File(self.source, 'w') as h:
            identity = h.create_group('science/LSAR/identification')
            for name, value in {'productType': 'GOFF', 'missionId': 'NISAR', 'granuleId': 'fixture-goff'}.items():
                identity.create_dataset(name, data=np.bytes_(value))
            offsets = h.create_group('science/LSAR/GOFF/grids/frequencyA/pixelOffsets')
            offsets.create_dataset('mask', data=np.full(shape, 11, dtype=np.uint32))
            polarization = offsets.create_group('HH')
            polarization.create_dataset('validDataMask', data=np.full(shape, 3, dtype=np.uint8))
            for index, layer_name in enumerate(('layer1', 'layer2', 'layer3'), 1):
                layer = polarization.create_group(layer_name)
                layer.create_dataset('xCoordinates', data=x)
                layer.create_dataset('yCoordinates', data=y)
                layer.create_dataset('projection', data=32632)
                for name in ('alongTrackOffset', 'slantRangeOffset', 'alongTrackOffsetVariance',
                             'slantRangeOffsetVariance', 'correlationSurfacePeak'):
                    layer.create_dataset(name, data=np.full(shape, index, dtype=np.float32))

        self.record = {
            'id': 'fixture-goff', 'filename': 'fixture.h5', 'url': 'https://nisar.asf.earthdatacloud.nasa.gov/fixture.h5',
            'size': self.source.stat().st_size, 'product': 'GOFF', 'start': '2026-09-23T04:27:22Z',
        }

    def tearDown(self):
        self.temp.cleanup()

    def test_crop_keeps_preferred_layer_and_required_masks_only(self):
        metadata = prepare_aletsch.crop(self.source, self.subset, self.record)
        with h5py.File(self.subset, 'r') as h:
            polarization = h['science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH']
            self.assertEqual(set(polarization.keys()), {'layer3', 'validDataMask'})
            self.assertIn('mask', h['science/LSAR/GOFF/grids/frequencyA/pixelOffsets'])
            selected = polarization['layer3']
            self.assertEqual(selected['alongTrackOffset'].shape, tuple(metadata['shape']))
            self.assertTrue(np.all(selected['alongTrackOffset'][:] == 3))

    def test_layer_selection_falls_back_without_copying_every_layer(self):
        self.assertEqual(prepare_aletsch.select_goff_layer({'layer1', 'layer2'}), 'layer1')
        self.assertEqual(prepare_aletsch.select_goff_layer({'layer2'}), 'layer2')
        with self.assertRaisesRegex(ValueError, 'no supported HH offset layer'):
            prepare_aletsch.select_goff_layer({'HV'})

    def test_local_granule_is_not_reprocessed_after_regional_crop(self):
        project = self.root / 'project'
        (project / 'data').mkdir(parents=True)
        (project / 'database/jobs').mkdir(parents=True)
        local_source = project / 'data' / self.record['filename']
        local_source.write_bytes(self.source.read_bytes())
        regional_subset = project / 'data/subsets/selected.h5'
        regional_subset.parent.mkdir(parents=True)
        prepare_aletsch.crop(self.source, regional_subset, self.record)
        metadata = {
            'sourceGranuleId': self.record['id'],
            'subsetBytes': regional_subset.stat().st_size,
            'transferredBytes': 0,
            'subsetSha256': 'regional-checksum',
        }

        class Connection:
            def execute(self, *args):
                return self

            def commit(self):
                pass

        with patch.object(prepare_aletsch, 'ROOT', project), \
             patch.object(prepare_aletsch, 'cached_product', return_value=None), \
             patch.object(prepare_aletsch, 'subset_file', return_value=(regional_subset, metadata, 0)), \
             patch.object(prepare_aletsch, 'process_goff', return_value={'sha256': 'regional-hash'}) as process:
            provenance, transferred = prepare_aletsch.prepare(Connection(), self.record, None, 1024, 1024 * 1024)

        self.assertEqual(process.call_args.args[0], regional_subset)
        self.assertEqual(process.call_args.kwargs['layer'], 'layer3')
        self.assertEqual(provenance['sourceFilename'], self.record['filename'])
        self.assertIn('regional subset', provenance['sha256Scope'])
        self.assertEqual(transferred, 0)


if __name__ == '__main__':
    unittest.main()