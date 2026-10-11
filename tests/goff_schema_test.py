"""Schema fixtures only: these values are never published as NISAR observations."""
import importlib.util, json, pathlib, sys, tempfile, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend/.python'))
sys.path.insert(0,str(ROOT/'backend/geo'))
spec=importlib.util.spec_from_file_location('goff',ROOT/'backend/geo/goff.py');goff=importlib.util.module_from_spec(spec);spec.loader.exec_module(goff)
import h5py
import numpy as np
import rasterio
from pyproj import Transformer

class SchemaTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name);self.source=self.root/'schema-fixture.h5'
        x,y=Transformer.from_crs(4326,32632,always_xy=True).transform(8.068,46.448)
        with h5py.File(self.source,'w') as h:
            identification=h.create_group('/science/LSAR/identification')
            for name,value in {'productType':'GOFF','missionId':'NISAR','referenceZeroDopplerStartTime':'2026-09-23T04:27:22Z','secondaryZeroDopplerStartTime':'2026-10-05T04:27:22Z'}.items():identification.create_dataset(name,data=np.bytes_(value))
            offsets=h.create_group('/science/LSAR/GOFF/grids/frequencyA/pixelOffsets');offsets.create_dataset('mask',data=np.full((4,4),11,dtype=np.uint32));pol=offsets.create_group('HH');pol.create_dataset('validDataMask',data=np.full((4,4),3,dtype=np.uint8));layer=pol.create_group('layer1')
            layer.create_dataset('xCoordinates',data=x+np.arange(4)*80);layer.create_dataset('yCoordinates',data=y-np.arange(4)*80);layer.create_dataset('projection',data=32632)
            for name,value,units in [('alongTrackOffset',12,'meters'),('slantRangeOffset',24,'meters'),('alongTrackOffsetVariance',144,'meters^2'),('slantRangeOffsetVariance',576,'meters^2'),('correlationSurfacePeak',0.8,'1')]:
                d=layer.create_dataset(name,data=np.full((4,4),value,dtype=np.float32));d.attrs['units']=np.bytes_(units)
    def tearDown(self):self.temp.cleanup()
    def layer(self,h):return h['/science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer1']
    def test_rates_uncertainty_mask_projection_and_provenance(self):
        with h5py.File(self.source,'r+') as h:
            group=self.layer(h);offsets=h['/science/LSAR/GOFF/grids/frequencyA/pixelOffsets']
            offsets['mask'][0,0]=0;offsets['mask'][0,1]=111;offsets['mask'][0,2]=11|(1<<8);offsets['HH/validDataMask'][0,3]=255
            group['correlationSurfacePeak'][1,0]=0.1;group['alongTrackOffsetVariance'][1,1]=-1;group['alongTrackOffset'][1,2]=np.nan
        output=self.root/'output';metadata=goff.process(self.source,output,'aletsch')
        self.assertEqual(metadata['pairDays'],12);self.assertEqual(metadata['acceptedSamples'],9);self.assertFalse(metadata['horizontalVelocity']);self.assertEqual(len(metadata['sha256']),64)
        with rasterio.open(output/'radar-components.tif') as raster:
            self.assertEqual(raster.crs.to_epsg(),32632);self.assertEqual(raster.count,5);self.assertEqual(raster.read(1)[2,2],1);self.assertEqual(raster.read(2)[2,2],2);self.assertEqual(raster.read(3)[2,2],1);self.assertTrue(np.isnan(raster.read(1)[0,0]))
        samples=json.loads((output/'samples.geojson').read_text());self.assertEqual(len(samples['features']),9);self.assertAlmostEqual(samples['features'][0]['properties']['slantRangeSigma'],2)
        with rasterio.open(output/'radar-preview.tif') as preview:
            self.assertEqual(preview.dtypes[0],'int16');self.assertEqual(preview.nodata,-32768)
            decoded=preview.read(1).astype(float)*preview.scales[0]+preview.offsets[0]
            self.assertEqual(decoded[2,2],1);self.assertEqual(preview.read(1)[0,0],-32768)
        self.assertTrue(metadata['displayPreview']['originalPreserved'])
        # A 4×4 fixture inside the Aletsch outline has no stable ground, so no estimate is offered.
        motion=json.loads((output/'motion-preview.json').read_text())
        self.assertEqual(motion['status'],'unavailable');self.assertEqual(metadata['motionPreview']['status'],'unavailable');self.assertFalse(metadata['motionPreview']['validated'])
    def test_rejects_unknown_units_and_reversed_pair(self):
        with h5py.File(self.source,'r+') as h:self.layer(h)['alongTrackOffset'].attrs['units']='pixels'
        with self.assertRaisesRegex(ValueError,'units'):goff.process(self.source,self.root/'bad','aletsch')
        with h5py.File(self.source,'r+') as h:
            self.layer(h)['alongTrackOffset'].attrs['units']='meters';h['/science/LSAR/identification/secondaryZeroDopplerStartTime'][()]=np.bytes_('2026-09-22T04:27:22Z')
        with self.assertRaisesRegex(ValueError,'positive duration'):goff.process(self.source,self.root/'bad','aletsch')
    def test_rejects_nonintersecting_granule_and_empty_quality_mask(self):
        with self.assertRaisesRegex(ValueError,'does not intersect'):goff.process(self.source,self.root/'bad','columbia')
        with h5py.File(self.source,'r+') as h:h['/science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/validDataMask'][...]=0
        with self.assertRaisesRegex(ValueError,'No samples'):goff.process(self.source,self.root/'bad','aletsch')
    def test_specification_150_combined_mask_without_valid_data_mask(self):
        with h5py.File(self.source,'r+') as h:
            identification=h['/science/LSAR/identification']
            identification.create_dataset('productSpecificationVersion',data=np.bytes_('1.5.0'))
            identification.create_dataset('granuleId',data=np.bytes_('schema-fixture-only'))
            offsets=h['/science/LSAR/GOFF/grids/frequencyA/pixelOffsets']
            del offsets['HH/validDataMask']
            offsets['mask'][0,0]=0
            offsets['mask'][0,1]=111
            offsets['mask'][0,2]=11|(1<<16)
        metadata=goff.process(self.source,self.root/'real-layout','aletsch')
        self.assertEqual(metadata['acceptedSamples'],13)
        self.assertEqual(metadata['sourceGranuleId'],'schema-fixture-only')
        self.assertEqual(metadata['productSpecificationVersion'],'1.5.0')
        self.assertEqual(len(metadata['qualityMaskDatasets']),1)
        self.assertNotIn('validDataMask bits',metadata['qualityMask'])
        self.assertFalse(metadata['qualitySummary']['glacierOutlineApplied'])
        with rasterio.open(self.root/'real-layout/radar-components.tif') as raster:
            self.assertTrue(np.isnan(raster.read(1)[0,:3]).all())
            self.assertEqual(raster.read(1)[1,1],1)
    def test_missing_masks_and_unknown_specification_are_rejected(self):
        with h5py.File(self.source,'r+') as h:
            del h['/science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/validDataMask']
        with self.assertRaisesRegex(ValueError,'unsupported GOFF specification'):
            goff.process(self.source,self.root/'unknown-layout','aletsch')
        with h5py.File(self.source,'r+') as h:
            del h['/science/LSAR/GOFF/grids/frequencyA/pixelOffsets/mask']
        with self.assertRaisesRegex(ValueError,'required GOFF source mask'):
            goff.process(self.source,self.root/'missing-mask','aletsch')
    def test_preview_bounds_rounding_error_and_preserves_invalid_cells(self):
        from preview import write_preview
        from rasterio.transform import from_origin
        values=np.linspace(-7.3,9.1,600*4,dtype=np.float32).reshape(600,4)
        values[:4,:]=np.nan
        metadata=write_preview(self.root/'preview.tif',[values],32632,from_origin(0,600,1,1),['rate'],maximum=512)
        self.assertEqual(metadata['aggregationFactor'],2)
        self.assertLessEqual(max(metadata['shape']),512)
        band=metadata['bands'][0]
        self.assertLessEqual(band['maximumQuantizationError'],band['roundingErrorBound']+1e-10)
        with rasterio.open(self.root/'preview.tif') as raster:
            self.assertTrue(np.all(raster.read(1)[:2]==-32768))
            self.assertEqual(raster.transform.a,2)

if __name__=='__main__':unittest.main()
