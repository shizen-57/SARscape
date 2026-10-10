import io, json, pathlib, sys, tempfile, unittest
from unittest.mock import patch
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'backend/geo'))
import optical_tiles as tiles
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import transform_bounds
from PIL import Image

class CachedOpticalTiles(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.directory.name)
        self.native, self.prepared = self.root/'native', self.root/'overview'
        self.frame = {'id':'fixture'}
        self.saved = tiles.NATIVE, tiles.PREPARED, tiles.SCENARIOS
        tiles.NATIVE, tiles.PREPARED = self.native, self.prepared
        (self.native/'fixture').mkdir(parents=True)
        (self.prepared/'fixture').mkdir(parents=True)

    def tearDown(self):
        tiles.NATIVE, tiles.PREPARED, tiles.SCENARIOS = self.saved
        self.directory.cleanup()

    def write(self, path, bounds, color):
        with rasterio.open(path, 'w', driver='GTiff', width=8, height=8, count=3,
                           dtype='uint8', crs='EPSG:3857', transform=from_bounds(*bounds,8,8), nodata=0) as raster:
            raster.write(np.broadcast_to(np.array(color,dtype='uint8')[:,None,None],(3,8,8)))

    def fixture(self, z, full=False):
        span = 40075016.68557849/2**z
        bounds = (0,-span,span,0)
        tiles.SCENARIOS = {'fixture':{'extent':transform_bounds('EPSG:3857','EPSG:4326',*bounds)}}
        self.write(self.native/'fixture/fixture.tif', bounds if full else (span*.25,-span*.75,span*.75,-span*.25), (220,30,50))
        if not full: self.write(self.prepared/'fixture/fixture-lod8.tif',bounds,(20,120,190))
        return 2**(z-1)

    def test_cached_context_and_native_detail_render_without_upstream_downloads(self):
        for z in [12,14]:
            coordinate = self.fixture(z)
            with patch.object(tiles,'prepare',side_effect=AssertionError('No network work while local crops exist')):
                image = np.asarray(Image.open(io.BytesIO(tiles.render(self.frame,z,coordinate,coordinate,'fixture'))))
            self.assertEqual(image.shape,(256,256,4))
            np.testing.assert_array_equal(image[128,128],(220,30,50,255))
            np.testing.assert_array_equal(image[16,16],(20,120,190,255))
            self.assertFalse((self.prepared/'fixture/fixture-lod2.tif').exists())

    def test_full_native_tile_needs_no_landscape_overview(self):
        coordinate = self.fixture(14,full=True)
        with patch.object(tiles,'prepare',side_effect=AssertionError('No network work for a complete native tile')):
            image = np.asarray(Image.open(io.BytesIO(tiles.render(self.frame,14,coordinate,coordinate,'fixture'))))
        np.testing.assert_array_equal(image[128,128],(220,30,50,255))

unittest.main()
