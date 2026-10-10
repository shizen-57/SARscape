"""Disposable schema fixtures only; never published as real observations."""
import json,pathlib,sys,tempfile,unittest
import h5py,numpy as np,rasterio
from pyproj import Transformer
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'backend/geo'))
import gcov,gcov_compare,inspect_nisar,indices

def fixture(path):
    x,y=Transformer.from_crs(4326,32632,always_xy=True).transform(8.068,46.448)
    with h5py.File(path,'w') as h:
        identity=h.create_group('/science/LSAR/identification')
        for name,value in {'missionId':'NISAR','productType':'GCOV','zeroDopplerStartTime':'2026-09-23T04:27:22Z','productSpecificationVersion':'1.6.0'}.items():identity.create_dataset(name,data=np.bytes_(value))
        group=h.create_group('/science/LSAR/GCOV/grids/frequencyA');group.create_dataset('xCoordinates',data=x+np.arange(4)*20);group.create_dataset('yCoordinates',data=y-np.arange(4)*20);group.create_dataset('projection',data=32632)
        data=group.create_dataset('HHHH',data=np.full((4,4),.01,dtype=np.float32));data.attrs['units']=np.bytes_('1');data.attrs['isReceiveOnlyChannel1']=np.bytes_('False')
        group.create_dataset('mask',data=np.full((4,4),1,dtype=np.uint8));group.create_dataset('inputDataExceptionMask',data=np.full((4,4),256,dtype=np.uint16));group.create_dataset('numberOfLooks',data=np.full((4,4),8,dtype=np.float32))
        rtc=h.create_group('/science/LSAR/GCOV/metadata/processingInformation/parameters/rtc');rtc.create_dataset('outputBackscatterExpressionConvention',data=np.bytes_('linear'));rtc.create_dataset('outputBackscatterNormalizationConvention',data=np.bytes_('gamma0'))

class GCOVTests(unittest.TestCase):
    def setUp(self):self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name);self.source=self.root/'fixture.h5';fixture(self.source)
    def tearDown(self):self.temp.cleanup()
    def test_real_power_db_masks_zero_power_and_pixel_center_transform(self):
        with h5py.File(self.source,'r+') as h:
            g=h['/science/LSAR/GCOV/grids/frequencyA'];g['mask'][0,0]=0;g['mask'][0,1]=255;g['inputDataExceptionMask'][0,2]=258;g['inputDataExceptionMask'][0,3]=0;g['HHHH'][1,0]=-1;g['HHHH'][1,1]=np.nan;g['HHHH'][1,2]=0
            first=float(g['xCoordinates'][0])
        output=self.root/'output';meta=gcov.process(self.source,output,'aletsch')
        self.assertEqual(meta['acceptedSamples'],10);self.assertEqual(meta['zeroPowerSamples'],1);self.assertEqual(meta['product'],'GCOV');self.assertEqual(meta['conventions']['outputBackscatterNormalizationConvention'],'gamma0')
        with rasterio.open(output/'radar-components.tif') as raster:
            self.assertEqual(raster.count,4);self.assertAlmostEqual(raster.read(2)[2,2],-20,places=5);self.assertTrue(np.isnan(raster.read(2)[1,2]));self.assertEqual(raster.read(1)[1,2],0);self.assertAlmostEqual(raster.transform.c,first-10)
        values=json.loads((output/'samples.geojson').read_text());self.assertEqual(len(values['features']),10);self.assertTrue(any(f['properties']['power']==0 and f['properties']['backscatterDb'] is None for f in values['features']))
    def test_inventory_uses_existing_channels_and_actual_coverage(self):
        result=inspect_nisar.inspect(self.source,'aletsch');self.assertEqual(result['product'],'GCOV');self.assertEqual(len(result['choices']),1);self.assertTrue(result['choices'][0]['intersects'])
        self.assertFalse(inspect_nisar.inspect(self.source,'sundarbans')['choices'][0]['intersects'])
        with h5py.File(self.source,'r+') as h:h['/science/LSAR/GCOV/grids/frequencyA/HHHH'].attrs['isReceiveOnlyChannel1']=np.bytes_('True')
        self.assertEqual(inspect_nisar.inspect(self.source,'aletsch')['choices'],[])
        with self.assertRaisesRegex(ValueError,'Receive-only'):gcov.process(self.source,self.root/'bad','aletsch')
    def test_rejects_invalid_power_units_or_expression(self):
        with h5py.File(self.source,'r+') as h:h['/science/LSAR/GCOV/grids/frequencyA/HHHH'].attrs['units']='dB'
        with self.assertRaisesRegex(ValueError,'dimensionless'):gcov.process(self.source,self.root/'bad','aletsch')
        with h5py.File(self.source,'r+') as h:
            h['/science/LSAR/GCOV/grids/frequencyA/HHHH'].attrs['units']='1';h['/science/LSAR/GCOV/metadata/processingInformation/parameters/rtc/outputBackscatterExpressionConvention'][()]=np.bytes_('log10')
        with self.assertRaisesRegex(ValueError,'linear-power'):gcov.process(self.source,self.root/'bad','aletsch')
    def test_index_preserves_sign_and_excludes_invalid_reflectance(self):
        first=np.array([[.4,.1,0,-.1,np.nan]],dtype=np.float32);second=np.array([[.1,.4,0,.4,.1]],dtype=np.float32)
        result=indices.normalized_index(first,second,np.ones(first.shape,dtype=bool))
        self.assertAlmostEqual(float(result[0,0]),.6,places=6);self.assertAlmostEqual(float(result[0,1]),-.6,places=6);self.assertTrue(np.all(np.isnan(result[0,2:])))
    def test_paired_change_uses_aligned_cells_valid_in_both_dates(self):
        saved=indices.CACHE;indices.CACHE=self.root/'indices'
        try:
            from rasterio.transform import from_origin
            old=np.array([[.1,np.nan],[.8,.5]],dtype=np.float32);new=np.array([[.2,.4],[np.nan,.2]],dtype=np.float32);transform=from_origin(500000,5000000,10,10)
            for name,values in [('first',old),('new',new)]:
                folder=indices.CACHE/'rondonia'/name;folder.mkdir(parents=True);indices.write_raster(folder/'index.tif',values,32632,transform,'test index');(folder/'summary.json').write_text(json.dumps({'totalSamples':4}))
            result=indices.compare('rondonia',{'id':'new','date':'2026-08-01'},{'id':'first','date':'2018-08-01'})
            self.assertEqual(result['validSamples'],2);self.assertAlmostEqual(result['meanChange'],-.1,places=6)
            with rasterio.open(indices.CACHE/'rondonia/new/change.tif') as raster:self.assertTrue(np.isnan(raster.read(1)[0,1]))
        finally:indices.CACHE=saved
    def test_gcov_comparison_is_signed_db_change_and_rejects_incompatible_geometry(self):
        older=self.root/'older';newer=self.root/'newer';gcov.process(self.source,older,'aletsch')
        with h5py.File(self.source,'r+') as h:
            h['/science/LSAR/identification/zeroDopplerStartTime'][()]=np.bytes_('2026-10-05T04:27:22Z');h['/science/LSAR/GCOV/grids/frequencyA/HHHH'][...]=.02
        gcov.process(self.source,newer,'aletsch');output=self.root/'difference';result=gcov_compare.process(older,newer,output)
        self.assertEqual(result['pairDays'],12);self.assertEqual(result['acceptedSamples'],16);self.assertAlmostEqual(result['medianChangeDb'],3.0103,places=4)
        with rasterio.open(output/'radar-components.tif') as raster:self.assertAlmostEqual(float(raster.read(1)[0,0]),3.0103,places=4)
        for folder,track in [(older,'1'),(newer,'2')]:
            path=folder/'provenance.json';metadata=json.loads(path.read_text());metadata['identification']['trackNumber']=track;path.write_text(json.dumps(metadata))
        with self.assertRaisesRegex(ValueError,'geometry'):gcov_compare.process(older,newer,self.root/'bad')

if __name__=='__main__':
    if len(sys.argv)==3 and sys.argv[1]=='--fixture':fixture(sys.argv[2])
    else:unittest.main()
