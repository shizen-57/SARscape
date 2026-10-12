"""Synthetic granule only: checks sampling, true-north conversion of polar-stereographic axes, and the speed gate."""
import pathlib, sys, unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend/.python'))
sys.path.insert(0, str(ROOT / 'backend/geo'))
import numpy as np
from pyproj import Geod, Transformer
import validate_itslive as vi

LON0, LAT0, N = -146.9, 61.2, 40


def fixture(bearing_deg, nisar_speed, its_speed_m_day, nisar_bearing=None):
    """A 40×40 cell NISAR flow field and an ITS_LIVE granule in EPSG:3413, both moving along `bearing_deg` (true north = 0)."""
    geod = Geod(ellps='WGS84')
    # NISAR cells on a lon/lat affine around the origin (about 80 m cells)
    dlon, dlat = 80 / (111320 * np.cos(np.radians(LAT0))), 80 / 110574
    affine = [[LON0, dlon, 0.0], [LAT0, 0.0, -dlat]]
    nb = np.radians(bearing_deg if nisar_bearing is None else nisar_bearing)
    cells = [[r, c, 0, 0, nisar_speed * np.sin(nb), nisar_speed * np.cos(nb), .8, 25, .6, True, 0, 0, .6] for r in range(N) for c in range(N)]
    preview = {'cellFields': ['row', 'col', 'alongTrack', 'slantRange', 'east', 'north', 'confidence', 'support', 'correlation', 'measured', 'rawAlongTrack', 'rawSlantRange', 'rawCorrelation'],
               'cells': cells, 'grid': {'lonLatAffine': affine}, 'stableGround': {'noiseFloor': {'speed': 0.2}}}
    # ITS_LIVE grid: 120 m cells in EPSG:3413 covering the same ground; vx/vy are along the *grid* axes, which are rotated against east/north
    to3413 = Transformer.from_crs(4326, 3413, always_xy=True)
    x0, y0 = to3413.transform(LON0 + 20 * dlon, LAT0 - 20 * dlat)
    x = x0 + np.arange(-30, 30) * 120.0; y = y0 + np.arange(30, -30, -1) * 120.0
    X, Y = np.meshgrid(x, y)
    back = Transformer.from_crs(3413, 4326, always_xy=True)
    lon, lat = back.transform(X, Y)
    lon2, lat2, _ = geod.fwd(lon, lat, np.full_like(lon, bearing_deg), np.full_like(lon, 100.0))   # 100 m along the true bearing
    X2, Y2 = to3413.transform(lon2, lat2)
    gx, gy = (X2 - X) / 100, (Y2 - Y) / 100                                                          # unit vector in grid axes
    v = its_speed_m_day * 365.25
    return preview, {'x': x, 'y': y, 'epsg': 3413, 'v': np.full(X.shape, v), 'vx': gx * v, 'vy': gy * v, 'transferredMiB': 0}, (gx, gy)


class CompareTests(unittest.TestCase):
    def test_grid_axes_really_are_rotated_against_north(self):
        _, _, (gx, gy) = fixture(0.0, 1, 1)
        self.assertGreater(abs(np.degrees(np.arctan2(gx[0, 0], gy[0, 0]))), 60)       # the fixture would not test anything otherwise

    def test_same_motion_in_any_direction_agrees_after_true_north_conversion(self):
        for bearing in (0, 90, 215):
            preview, granule, _ = fixture(bearing, 2.0, 2.0)
            r = vi.compare(preview, granule)
            self.assertAlmostEqual(r['medianRatio'], 1.0, places=2); self.assertLess(r['medianAngleDeg'], 2.0); self.assertEqual(r['within45Deg'], 1.0)

    def test_a_direction_error_is_reported(self):
        preview, granule, _ = fixture(30, 2.0, 2.0, nisar_bearing=120)
        r = vi.compare(preview, granule)
        self.assertAlmostEqual(r['medianAngleDeg'], 90.0, delta=2.0); self.assertEqual(r['within45Deg'], 0.0)

    def test_slow_ice_is_reported_separately_and_not_counted_in_the_headline(self):
        preview, granule, _ = fixture(10, 0.45, 0.1)                                   # NISAR at noise level over ice that is nearly still
        r = vi.compare(preview, granule)
        self.assertEqual(r['resolvableCells'], 0); self.assertNotIn('spearman', r)
        self.assertGreater(r['slowIce']['cells'], 0); self.assertAlmostEqual(r['slowIce']['medianItsLive'], 0.1, places=2)

    def test_granule_choice_prefers_the_pair_overlapping_the_nisar_dates(self):
        def item(start, end, valid):
            return {'id': f'{start}', 'properties': {'date_dt': 12, 'percent_valid_pixels': valid, 'start_datetime': f'{start}T00:00:00Z', 'end_datetime': f'{end}T00:00:00Z'},
                    'assets': {'data': {'href': 'https://its-live-data.s3.amazonaws.com/x.nc'}}}
        found = vi.candidates([item('2026-07-01', '2026-07-13', 99), item('2026-07-16', '2026-07-28', 60), item('2026-07-12', '2026-07-24', 40), item('2026-09-01', '2026-09-13', 99)], '2026-07-14', '2026-07-26')
        self.assertEqual([f['id'] for f in found], ['2026-07-16', '2026-07-12'])   # more overlap first; the 1–13 July and September pairs have none
        foreign = item('2026-07-16', '2026-07-28', 90); foreign['assets']['data']['href'] = 'https://example.com/x.nc'
        self.assertEqual(vi.candidates([foreign], '2026-07-14', '2026-07-26'), [])


if __name__ == '__main__':
    unittest.main()
