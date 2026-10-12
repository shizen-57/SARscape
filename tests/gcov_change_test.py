"""Synthetic fields only: checks the storm logic, the confidence checks and the radar-to-colour prediction."""
import pathlib, sys, unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend/.python'))
sys.path.insert(0, str(ROOT / 'backend/geo'))
import numpy as np
import gcov_change as gc
import gcov_shaded as gs


def daily(precipitation, snowfall=None, start='2026-08-10'):
    days = [str(np.datetime64(start) + i) for i in range(len(precipitation))]
    snowfall = snowfall or [0] * len(precipitation)
    return {'konkordia': {'time': days, 'precipitation_sum': precipitation, 'snowfall_sum': snowfall, 'temperature_2m_mean': [3.0] * len(days)}}


def track(key, rows):
    return {'id': key, 'dates': [{'date': d, 'anomalyDb': a} for d, a in rows]}


def step(key, to, fraction, bands=(-0.5, -1.0, -0.4)):
    return {'track': key, 'to': to, 'darkerFraction': fraction, 'bands': list(bands), 'file': f'diff-{key}-{to}.png'}


STORM = {'from': '2026-08-21', 'to': '2026-08-21', 'precipitationMm': 22.0, 'snowfallCm': 3.6}


class WeatherTests(unittest.TestCase):
    def test_storm_days_are_grouped_and_dry_days_are_ignored(self):
        events = gc.storms(daily([0, 3, 20, 25, 0, 0, 16, 0, 0, 3]))
        self.assertEqual([(e['from'], e['to']) for e in events], [('2026-08-12', '2026-08-13'), ('2026-08-16', '2026-08-16')])
        self.assertEqual(events[0]['precipitationMm'], 45.0)
        self.assertEqual(gc.storms(daily([0, 5, 9, 0])), [])
        self.assertEqual(len(gc.storms(daily([1, 1, 1], snowfall=[0, 3, 0]))), 1)   # snow alone is a storm

    def test_recent_weather_uses_only_days_up_to_the_image(self):
        w = daily([0, 0, 0, 10, 10, 10, 50], start='2026-08-10')
        self.assertEqual(gc.recent(w, '2026-08-15')['precipitation3dMm'], 30.0)
        self.assertEqual(gc.recent(w, '2026-08-12')['precipitation3dMm'], 0.0)   # the 16th's rain is not yet known


class AssessTests(unittest.TestCase):
    def tracks(self, anomalies):
        # before the storm, first image after it, next image
        rows = lambda a: [('2026-08-18', 0.1), ('2026-08-25', a), ('2026-09-05', a + 0.9)]
        return [track(k, rows(a)) for k, a in zip(('72A', '144A', '37D'), anomalies)]

    def steps(self, fraction=0.7):
        return [step(k, '2026-08-25', fraction) for k in ('72A', '144A', '37D')]

    def test_a_consistent_storm_response_is_graded_high_with_all_checks(self):
        f = gc.assess([STORM], self.tracks([-1.0, -0.8, -0.9]), self.steps(), 0.7, [2400, 2600, 2800])[0]
        self.assertEqual(f['confidence'], 'High'); self.assertTrue(all(c['pass'] for c in f['checks'].values()))
        self.assertAlmostEqual(f['magnitudeDb'], -0.9); self.assertEqual(f['strongestBand'], [2600, 2800])
        self.assertIn('3 of 3 tracks', f['statement']); self.assertEqual(len(f['steps']), 3)

    def test_disagreeing_tracks_and_small_changes_are_not_high_confidence(self):
        f = gc.assess([STORM], self.tracks([0.2, -0.1, 0.1]), self.steps(0.5), 0.7, [2400, 2600, 2800])[0]
        self.assertEqual(f['confidence'], 'Low')
        self.assertFalse(f['checks']['tracksAgree']['pass']); self.assertFalse(f['checks']['beatsNoise']['pass'])
        self.assertFalse(f['checks']['spatiallyCoherent']['pass'])

    def test_a_storm_with_no_clean_before_and_after_image_gives_no_finding(self):
        late = {**STORM, 'from': '2026-09-20', 'to': '2026-09-20'}            # no image within 10 days afterwards
        self.assertEqual(gc.assess([late], self.tracks([-1, -1, -1]), self.steps(), 0.7, [2400, 2600, 2800]), [])
        early = {**STORM, 'from': '2026-08-17', 'to': '2026-08-17'}           # the first image is already after it: nothing to compare with
        self.assertEqual(gc.assess([early], self.tracks([-1, -1, -1]), self.steps(), 0.7, [2400, 2600, 2800]), [])

    def test_a_second_storm_before_the_images_is_disclosed(self):
        second = {**STORM, 'from': '2026-08-24', 'to': '2026-08-24'}
        f = gc.assess([STORM, second], self.tracks([-1.0, -0.8, -0.9]), self.steps(), 0.7, [2400, 2600, 2800])
        first = next(x for x in f if x['id'] == 'storm-2026-08-21')
        self.assertIn('2026-08-24', first['checks']['fitsWeather']['detail'])

    def test_rank_correlation_is_signed_and_needs_three_dates(self):
        self.assertEqual(gc.rank_correlation([1, 2, 3, 4], [4, 3, 2, 1]), -1.0)
        self.assertIsNone(gc.rank_correlation([1, 2], [2, 1]))


class MapTests(unittest.TestCase):
    def test_difference_image_is_transparent_outside_the_glacier_and_clips_extremes(self):
        delta = np.array([[-10.0, 0.0], [10.0, np.nan]]); glacier = np.array([[True, True], [True, True]])
        img = np.asarray(gc.diff_image(delta, glacier))
        self.assertTrue(img[0, 0, 2] > img[0, 0, 0] and img[1, 0, 0] > img[1, 0, 2])   # darker is blue, brighter is orange/red
        self.assertEqual(tuple(img[0, 1, :3]), (247, 247, 247)); self.assertEqual(img[1, 1, 3], 0)
        self.assertEqual(np.asarray(gc.diff_image(delta, ~glacier))[..., 3].max(), 0)


class TerrainColourTests(unittest.TestCase):
    def fixture(self):
        rng = np.random.default_rng(3)
        hh = [np.full((60, 60), -8.0, np.float32) for _ in range(2)]
        hv = [np.full((60, 60), -16.0, np.float32) for _ in range(2)]
        hh[0][:, :30] = 0.0; hh[1][:, :30] = 0.0                     # left half: strong radar return, bright (icy) in the photo
        hh[1][:12, :12] = -8.0                                       # on date 1 a patch of that ice turns radar-dark
        photo = np.zeros((60, 60, 3), np.float32); photo[:, :30] = (230, 235, 240); photo[:, 30:] = (70, 100, 60)
        hh = [h + rng.normal(0, .05, h.shape).astype(np.float32) for h in hh]
        return photo, hh, hv, np.full((60, 60), 2000.0, np.float32)

    def test_each_date_is_coloured_by_its_own_radar_not_by_the_training_photo(self):
        photo, hh, hv, elevation = self.fixture()
        images, skills = gs.terrain_colour(photo, hh, hv, elevation, stride=1)
        patch0, patch1 = images[0][4:8, 4:8, 0].astype(int).mean(), images[1][4:8, 4:8, 0].astype(int).mean()
        self.assertGreater(patch0, 200)                              # date 0: same radar as the rest of the ice, painted ice-white
        self.assertLess(patch1, patch0 - 100)                        # date 1: its own radar is dark, so the colour follows it
        self.assertGreater(images[0][30, 5, 0], images[0][30, 55, 0] + 100)
        self.assertGreater(skills[0]['radarAndElevation'], skills[0]['elevationOnly'] + 0.3)   # radar adds skill beyond elevation
        self.assertTrue((images[0][..., 3] == 255).all())

    def test_large_radar_gaps_stay_transparent(self):
        photo, hh, hv, elevation = self.fixture()
        hh[0][10:24, 10:24] = np.nan                                 # wider than the 5-pixel box, so its centre has no radar at all
        images, _ = gs.terrain_colour(photo, hh, hv, elevation, stride=1)
        self.assertTrue((images[0][15:19, 15:19, 3] == 0).all()); self.assertEqual(images[1][15, 15, 3], 255)


if __name__ == '__main__':
    unittest.main()
