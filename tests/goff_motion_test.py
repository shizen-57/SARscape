"""Synthetic fields only: these values test the motion-preview logic and are never published."""
import json, pathlib, sys, tempfile, unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend/.python'))
sys.path.insert(0, str(ROOT / 'backend/geo'))
import numpy as np
from pyproj import Transformer
import goff_motion as gm

# Real Aletsch track-072 geometry at 2500 m (radarGrid cubes): heading ~340°, LOS towards ~72°.
AT_X, AT_Y, LOS_X, LOS_Y = -0.3352, 0.9422, 0.5663, 0.1818


class FilterTests(unittest.TestCase):
    def test_median_test_rejects_isolated_spike_and_unsupported_cells(self):
        values = np.full((7, 7), 0.3); values[3, 3] = 1.4; valid = np.ones_like(values, bool)
        keep = gm.median_test(values, valid)
        self.assertFalse(keep[3, 3]); self.assertTrue(keep[2, 2])
        lonely = np.zeros_like(valid); lonely[3, 3] = lonely[3, 4] = True
        self.assertFalse(gm.median_test(values, lonely).any())

    def test_stable_offset_finds_common_offset_despite_false_peaks(self):
        rng = np.random.default_rng(1)
        along = np.concatenate([rng.normal(-12.8, .3, 400), rng.uniform(-23, 23, 600)])
        slant = np.concatenate([rng.normal(2.1, .15, 400), rng.uniform(-15, 15, 600)])
        offset = gm.stable_offset(along, slant)
        self.assertAlmostEqual(offset['alongTrack'], -12.8, delta=.1); self.assertAlmostEqual(offset['slantRange'], 2.1, delta=.05)
        self.assertIsNone(gm.stable_offset(along[:20], slant[:20]))

    def test_horizontal_flow_inverts_the_forward_model(self):
        east, north = .12, -.45  # southward, slightly east
        along = AT_X * east + AT_Y * north; slant = -(LOS_X * east + LOS_Y * north)
        e, n = gm.horizontal_flow(along, slant, AT_X, AT_Y, LOS_X, LOS_Y)
        self.assertAlmostEqual(e, east, places=9); self.assertAlmostEqual(n, north, places=9)
        # Pure down-track motion reads as negative along-track and almost no range change.
        self.assertLess(AT_X * 0 + AT_Y * -.5, 0)

    def test_geometry_sampling_requires_matching_projection_and_cubes(self):
        cube = lambda v: np.full((3, 4, 4), v, np.float32)
        grid = {'xCoordinates': np.arange(4) * 500.0, 'yCoordinates': 2000 - np.arange(4) * 500.0, 'heightAboveEllipsoid': np.array([1500., 2500., 3500.]), 'projection': np.array(32632),
                'alongTrackUnitVectorX': cube(AT_X), 'alongTrackUnitVectorY': cube(AT_Y), 'losUnitVectorX': cube(LOS_X), 'losUnitVectorY': cube(LOS_Y), 'incidenceAngle': cube(36.5)}
        sampled = gm.sample_geometry(grid, np.array([100., 900.]), np.array([1900., 1100.]), 32632)
        self.assertEqual(sampled['losUnitVectorX'].shape, (2, 2)); self.assertEqual(sampled['height'], 2500.)
        self.assertIsNone(gm.sample_geometry(grid, np.array([100.]), np.array([1900.]), 32633))
        self.assertIsNone(gm.sample_geometry({k: v for k, v in grid.items() if k != 'losUnitVectorY'}, np.array([100.]), np.array([1900.]), 32632))
        self.assertIsNone(gm.sample_geometry(None, np.array([100.]), np.array([1900.]), 32632))


class BuildTests(unittest.TestCase):
    """A 60×60 grid at 80 m: a square 'glacier' in the middle, stable rock around it."""
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); root = pathlib.Path(self.temp.name)
        x0, y0 = Transformer.from_crs(4326, 32632, always_xy=True).transform(8.05, 46.45)
        self.x = x0 + np.arange(60) * 80.0; self.y = y0 - np.arange(60) * 80.0
        corners = [(self.x[15], self.y[15]), (self.x[45], self.y[15]), (self.x[45], self.y[45]), (self.x[15], self.y[45]), (self.x[15], self.y[15])]
        lonlat = Transformer.from_crs(32632, 4326, always_xy=True)
        self.outline = root / 'outline.geojson'
        self.outline.write_text(json.dumps({'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'name': 'Synthetic', 'license': 'test'}, 'geometry': {'type': 'Polygon', 'coordinates': [[list(lonlat.transform(*c)) for c in corners]]}}]}))
        rows, cols = np.mgrid[0:60, 0:60]
        # Cell centres at least half a cell inside the outline (edges through centres 15 and 45).
        self.ice = (rows >= 16) & (rows <= 44) & (cols >= 16) & (cols <= 44)
        self.geometry = {'alongTrackUnitVectorX': np.full((60, 60), AT_X), 'alongTrackUnitVectorY': np.full((60, 60), AT_Y), 'losUnitVectorX': np.full((60, 60), LOS_X), 'losUnitVectorY': np.full((60, 60), LOS_Y), 'incidenceAngle': np.full((60, 60), 36.5), 'height': 2500., 'heightSensitivity': .001}

    def tearDown(self): self.temp.cleanup()

    def field(self, east, north, noise, seed=2):
        rng = np.random.default_rng(seed)
        e = np.where(self.ice, east, 0.); n = np.where(self.ice, north, 0.)
        along = AT_X * e + AT_Y * n - 12.8 + rng.normal(0, noise, e.shape)  # common Sep 23-style offset
        slant = -(LOS_X * e + LOS_Y * n) + 2.1 + rng.normal(0, noise / 2, e.shape)
        along[::7, ::5] = rng.uniform(-23, 23, along[::7, ::5].shape)  # false correlation peaks
        return along, slant, np.full(e.shape, .55)

    def build(self, along, slant, correlation, geometry=None):
        return gm.build(along, slant, correlation, self.x, self.y, 32632, 'synthetic', .3, 12., geometry, self.outline)

    def test_coherent_flow_above_the_noise_floor_is_resolved_as_flow(self):
        result = self.build(*self.field(.1, -.5, .03), self.geometry)
        self.assertEqual(result['status'], 'flow'); self.assertTrue(result['quality']['flowDirectionResolved'])
        self.assertAlmostEqual(result['stableGround']['alongTrack'], -12.8, delta=.05)
        cells = [dict(zip(result['cellFields'], c)) for c in result['cells']]
        bearing = np.degrees(np.arctan2(np.median([c['east'] for c in cells]), np.median([c['north'] for c in cells]))) % 360
        self.assertAlmostEqual(bearing, np.degrees(np.arctan2(.1, -.5)) % 360, delta=3)
        # Only glacier cells are shown; the outline mask and rejected spikes are reported.
        self.assertTrue(all(self.ice[c['row'], c['col']] for c in cells))
        counts = {f['id']: f['cells'] for f in result['filters']}
        self.assertLess(counts['plausible'], counts['source']); self.assertFalse(result['validated'])

    def test_noise_at_the_stable_ground_level_is_not_presented_as_flow(self):
        result = self.build(*self.field(0., 0., .35), self.geometry)
        self.assertEqual(result['status'], 'components'); self.assertEqual(result['quality']['grade'], 'low')
        self.assertFalse(result['quality']['flowDirectionResolved']); self.assertIn('not resolved', result['reason'])

    def test_without_viewing_geometry_only_components_are_offered(self):
        result = self.build(*self.field(.1, -.5, .03))
        self.assertEqual(result['status'], 'components'); self.assertFalse(result['geometry']['available'])
        self.assertTrue(all(c[result['cellFields'].index('east')] is None for c in result['cells']))

    def test_missing_outline_or_stable_ground_makes_the_preview_unavailable(self):
        along, slant, correlation = self.field(.1, -.5, .03)
        self.assertEqual(gm.build(along, slant, correlation, self.x, self.y, 32632, 'synthetic', .3, 12., None, self.outline.with_name('none.geojson'))['status'], 'unavailable')
        hidden = np.where(self.ice, along, np.nan)
        self.assertIn('stable-ground', self.build(hidden, slant, correlation)['reason'])


if __name__ == '__main__': unittest.main()
