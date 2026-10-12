"""Synthetic arrays only: checks the shading maths and the NaN-aware box filter."""
import pathlib, sys, unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend/.python'))
sys.path.insert(0, str(ROOT / 'backend/geo'))
import numpy as np
import gcov_shaded as gs


class ShadeTests(unittest.TestCase):
    def test_box_mean_ignores_nan_and_matches_a_plain_mean(self):
        a = np.arange(49, dtype=float).reshape(7, 7); a[3, 3] = np.nan
        out = gs.box_mean(a, 3)
        self.assertAlmostEqual(out[3, 3], np.nanmean(a[2:5, 2:5])); self.assertAlmostEqual(out[0, 0], a[:2, :2].mean())
        self.assertTrue(np.isnan(gs.box_mean(np.full((5, 5), np.nan), 3)).all())

    def test_only_the_change_from_the_mean_shades_the_photo(self):
        aerial = np.full((30, 30, 3), 100., np.float32)
        base = np.full((30, 30), -8., np.float32)
        wet = base - 6; wet[0, 0] = np.nan
        images = gs.shade(aerial, np.stack([base, wet, base + 6, base]))
        # The four-date mean is -8 dB. Unchanged dates keep the photo, -6 dB halves it, +6 dB doubles it (the cap).
        centre = [int(i[15, 15, 0]) for i in images]
        for got, want in zip(centre, [100, 50, 200, 100]): self.assertAlmostEqual(got, want, delta=1)
        self.assertEqual(images[1][0, 0, 3], 0); self.assertEqual(images[0][0, 0, 3], 255)

    def test_tile_range_covers_aletsch(self):
        x0, x1, y0, y1 = gs.tile_range(7.915, 46.385, 8.11, 46.575)
        self.assertLess(x0, x1); self.assertLess(y0, y1); self.assertLess((x1 - x0 + 1) * (y1 - y0 + 1), 400)


if __name__ == '__main__': unittest.main()
