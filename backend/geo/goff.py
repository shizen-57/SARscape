"""Crop official NISAR GOFF grids and derive radar-coordinate rates, never horizontal speed."""
import argparse, datetime as dt, hashlib, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / '.python'))
import h5py
import numpy as np
import rasterio
from rasterio.transform import from_origin
from pyproj import CRS, Transformer
from preview import write_preview

ROOT = pathlib.Path(__file__).resolve().parents[2]
def text(value):
    if isinstance(value, bytes): return value.decode('utf-8')
    return str(value)

def process(source, output, scenario_id, frequency='A', polarization='HH', layer='layer1', correlation=0.3):
    config=json.loads((ROOT/'database/scenarios.json').read_text())
    scenario=next(s for s in config['scenarios'] if s['id']==scenario_id)
    output=pathlib.Path(output); output.mkdir(parents=True, exist_ok=True)
    with h5py.File(source,'r') as h:
        identification=h['/science/LSAR/identification']
        if text(identification['productType'][()])!='GOFF': raise ValueError('Only NISAR L2 GOFF products are supported')
        if text(identification['missionId'][()])!='NISAR': raise ValueError('Input mission must be NISAR')
        reference=text(identification['referenceZeroDopplerStartTime'][()])
        secondary=text(identification['secondaryZeroDopplerStartTime'][()])
        parse=lambda v:dt.datetime.fromisoformat(v.replace('Z','+00:00'))
        days=(parse(secondary)-parse(reference)).total_seconds()/86400
        if not np.isfinite(days) or days<=0: raise ValueError('Acquisition pair must be ordered with a positive duration')
        path=f'/science/LSAR/GOFF/grids/frequency{frequency}/pixelOffsets'
        group=h[f'{path}/{polarization}/{layer}']
        x=group['xCoordinates'][:]; y=group['yCoordinates'][:]
        if len(x)<2 or len(y)<2: raise ValueError('Invalid coordinate grid')
        dx=float(x[1]-x[0]); dy=float(y[1]-y[0]); epsg=int(group['projection'][()])
        crs=CRS.from_epsg(epsg)
        if not crs.is_projected or crs.axis_info[0].unit_name!='metre': raise ValueError('A projected metre grid is required')
        if dx<=0 or dy>=0 or not np.allclose(np.diff(x),dx) or not np.allclose(np.diff(y),dy): raise ValueError('Unsupported or irregular GOFF coordinate orientation')
        west,south,east,north=Transformer.from_crs(4326,crs,always_xy=True).transform_bounds(*scenario['extent'],densify_pts=21)
        columns=np.flatnonzero((x+dx/2>=west)&(x-dx/2<=east)); rows=np.flatnonzero((y+abs(dy)/2>=south)&(y-abs(dy)/2<=north))
        if not len(columns) or not len(rows): raise ValueError('The science file does not intersect the selected glacier')
        window=np.s_[rows[0]:rows[-1]+1,columns[0]:columns[-1]+1]
        shape=(len(y),len(x))
        names=['alongTrackOffset','slantRangeOffset','alongTrackOffsetVariance','slantRangeOffsetVariance','correlationSurfacePeak']
        arrays=[]
        for name in names:
            dataset=group[name]
            if dataset.shape!=shape: raise ValueError(f'Mismatched grid: {name}')
            units=text(dataset.attrs.get('units',''))
            expected=['meters','metres','m'] if name.endswith('Offset') else ['meters^2','metres^2','m^2'] if name.endswith('Variance') else ['1']
            if units not in expected: raise ValueError(f'Unsupported units for {name}: {units}')
            values=dataset[window].astype(np.float32)
            for attr in ['_FillValue','missing_value']:
                if attr in dataset.attrs: values[values==dataset.attrs[attr]]=np.nan
            arrays.append(values)
        along,slant,av,sv,peak=arrays
        specification=text(identification['productSpecificationVersion'][()]) if 'productSpecificationVersion' in identification else None
        mask=h.get(f'{path}/mask')
        if mask is None: raise ValueError('The required GOFF source mask is missing')
        if mask.shape!=shape: raise ValueError('Mismatched quality mask')
        flags=mask[window].astype(np.uint32)
        code=flags&255
        accepted=((code%100)//10>0)&(code%10>0)&(code<100)&(((flags>>8)&65535)==0)
        quality_datasets=[f'{path}/mask']
        quality_description='Non-water valid reference/secondary subswaths, zero known anomaly flags'
        valid_mask=h.get(f'{path}/{polarization}/validDataMask')
        if valid_mask is not None:
            if valid_mask.shape!=shape: raise ValueError('Mismatched quality mask')
            accepted &= valid_mask[window]==3
            quality_datasets.append(f'{path}/{polarization}/validDataMask')
            quality_description='Both validDataMask bits, '+quality_description.lower()
        elif specification!='1.5.0':
            raise ValueError(f'Missing validDataMask for unsupported GOFF specification: {specification or "unspecified"}')
        # The real P05023/specification 1.5.0 product has the combined source mask
        # and NaN-valued invalid offsets, with no polarization validDataMask.
        source_mask_samples=int(accepted.sum())
        finite_samples=int((accepted & np.isfinite(along)&np.isfinite(slant)&np.isfinite(av)&np.isfinite(sv)&np.isfinite(peak)&(av>=0)&(sv>=0)&(peak>=0)&(peak<=1)).sum())
        accepted &= np.isfinite(along)&np.isfinite(slant)&np.isfinite(av)&np.isfinite(sv)&np.isfinite(peak)&(av>=0)&(sv>=0)&(peak>=correlation)&(peak<=1)
        if not np.any(accepted): raise ValueError('No samples passed the declared quality mask in this glacier extent')
        # Offsets already have metre units. Rates and 1-sigma uncertainty divide by pair duration.
        bands=[along/days,slant/days,np.sqrt(np.maximum(av,0))/days,np.sqrt(np.maximum(sv,0))/days,peak]
        bands=[np.where(accepted,values,np.nan).astype(np.float32) for values in bands]
        transform=from_origin(float(x[columns[0]]-dx/2),float(y[rows[0]]+abs(dy)/2),dx,abs(dy))
        names=['along_track_m_day','slant_range_m_day','along_track_sigma_m_day','slant_range_sigma_m_day','correlation']
        preview=write_preview(output/'radar-preview.tif',bands,crs,transform,names)
        tif=output/'radar-components.tif'
        with rasterio.open(tif,'w',driver='GTiff',height=len(rows),width=len(columns),count=5,dtype='float32',crs=crs,transform=transform,nodata=np.nan,tiled=True,compress='deflate') as dst:
            for index,(name,values) in enumerate(zip(['along_track_m_day','slant_range_m_day','along_track_sigma_m_day','slant_range_sigma_m_day','correlation'],bands),1):
                dst.write(values,index); dst.set_band_description(index,name)
            factors=[f for f in [2,4,8,16] if min(len(rows),len(columns))//f>=1]
            if factors: dst.build_overviews(factors,rasterio.enums.Resampling.average)
        # Sparse queryable points retain measurements and uncertainty, with a bounded browser payload.
        yy,xx=np.where(accepted); stride=max(1,int(np.ceil(len(xx)/5000))); yy,xx=yy[::stride],xx[::stride]
        lon,lat=Transformer.from_crs(crs,4326,always_xy=True).transform(x[columns[0]+xx],y[rows[0]+yy])
        features=[{'type':'Feature','geometry':{'type':'Point','coordinates':[float(lon[i]),float(lat[i])]},'properties':{name:float(values[yy[i],xx[i]]) for name,values in zip(['alongTrack','slantRange','alongTrackSigma','slantRangeSigma','correlation'],bands)}} for i in range(len(xx))]
        (output/'samples.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},allow_nan=False))
        digest=hashlib.sha256()
        with open(source,'rb') as raw:
            while chunk:=raw.read(8*1024*1024): digest.update(chunk)
        metadata={'scenario':scenario_id,'sourceFilename':pathlib.Path(source).name,'sha256':digest.hexdigest(),'mission':'NISAR','product':'GOFF','frequency':frequency,'polarization':polarization,'layer':layer,'referenceDate':reference,'secondaryDate':secondary,'pairDays':days,'epsg':epsg,'postingMetres':[dx,abs(dy)],'units':'m/day','acceptedSamples':int(accepted.sum()),'totalSamples':int(accepted.size),'returnedSamples':len(features),'correlationThreshold':correlation,'createdAt':dt.datetime.now(dt.timezone.utc).isoformat(),'horizontalVelocity':False,'validation':'Derived radar-coordinate components; no independent glacier validation or stable-ground bias correction applied.','qualityMask':quality_description+', finite offsets/nonnegative variances, declared correlation threshold.','schemaSource':'https://github.com/isce-framework/isce3/blob/develop/python/packages/nisar/products/insar/GOFF_writer.py'}
        metadata['productSpecificationVersion']=specification
        for key,target in [('granuleId','sourceGranuleId'),('productVersion','productVersion'),('compositeReleaseId','compositeReleaseId')]:
            if key in identification: metadata[target]=text(identification[key][()])
        metadata['qualityMaskDatasets']=quality_datasets
        metadata['qualitySummary']={'studyAreaExtent':scenario['extent'],'sourceMaskAccepted':source_mask_samples,'finiteDataAccepted':finite_samples,'acceptedFraction':float(accepted.sum()/accepted.size),'glacierOutlineApplied':False}
        metadata['displayPreview']=preview
        (output/'provenance.json').write_text(json.dumps(metadata,indent=2,allow_nan=False))
        return metadata

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',required=True);parser.add_argument('--output',required=True);parser.add_argument('--scenario',required=True);parser.add_argument('--frequency',choices=['A','B'],default='A');parser.add_argument('--polarization',choices=['HH','HV','VV','VH'],default='HH');parser.add_argument('--layer',choices=['layer1','layer2','layer3'],default='layer1');parser.add_argument('--correlation',type=float,default=0.3)
    args=parser.parse_args()
    if not 0<=args.correlation<=1: parser.error('Correlation threshold must be between 0 and 1')
    try: print(json.dumps(process(args.input,args.output,args.scenario,args.frequency,args.polarization,args.layer,args.correlation)),flush=True)
    except Exception as error: print(str(error),file=sys.stderr);sys.exit(1)
