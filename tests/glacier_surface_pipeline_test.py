"""Offline checks of scientific decoding and bounded regional reads."""
import io, pathlib, sys, unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'backend/geo'))
from prepare_glacier_surfaces import decode, warp, GRID, ROWS, COLS
from public_range import PublicRangeReader
import numpy as np

class Dataset:
    ndim=3
    shape=(1,1,3)
    attrs={'_FillValue':-32767,'scale_factor':.5,'add_offset':2}
    def __getitem__(self,key):return np.array([[2,-32767,6]])

class Reply:
    def __init__(self,headers,status=206,data=b'abcdefgh'):
        self.headers=headers;self.status_code=status;self.raw=io.BytesIO(data)
    def raise_for_status(self):pass
    def __enter__(self):return self
    def __exit__(self,*args):pass

class Session:
    def __init__(self,status=206):self.status=status;self.calls=0
    def head(self,*args,**kw):return Reply({'Content-Length':'8'})
    def get(self,*args,**kw):
        self.calls+=1
        return Reply({'Content-Range':'bytes 0-7/8'},self.status)

class PipelineTests(unittest.TestCase):
    def test_decoding_preserves_missing_cells_and_scale(self):
        v=decode(Dataset(),slice(None),slice(None))
        self.assertEqual(v[0,0],3);self.assertTrue(np.isnan(v[0,1]));self.assertEqual(v[0,2],5)
    def test_reprojection_never_fills_missing_cells(self):
        v=np.full((ROWS,COLS),np.nan);v[3,4]=120
        out=warp(v,GRID,3857)
        self.assertEqual(out[3,4],120);self.assertEqual(np.isfinite(out).sum(),1)
    def test_read_cache_and_seek(self):
        session=Session();reader=PublicRangeReader(session,'https://its-live-data.s3.amazonaws.com/a.nc')
        self.assertEqual(reader.read(3),b'abc');reader.seek(1)
        self.assertEqual(reader.read(4),b'bcde');self.assertEqual(session.calls,1);self.assertEqual(reader.transferred,8)
    def test_full_download_and_budgets_rejected(self):
        for session,budget in [(Session(200),40),(Session(),4)]:
            reader=PublicRangeReader(session,'https://its-live-data.s3.amazonaws.com/a.nc',budget)
            with self.assertRaises(ValueError):reader.read(3)
        session=Session();session.regional_budget=7;session.regional_transferred=0
        reader=PublicRangeReader(session,'https://its-live-data.s3.amazonaws.com/a.nc')
        with self.assertRaises(ValueError):reader.read(3)
        self.assertEqual(session.calls,0)
    def test_other_hosts_are_rejected_before_network(self):
        with self.assertRaises(ValueError):PublicRangeReader(Session(),'https://example.com/a.nc')

if __name__=='__main__':unittest.main()
