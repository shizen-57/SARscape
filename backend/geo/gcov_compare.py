"""Compare matching GCOV acquisitions on the newer crop's fixed grid."""
import argparse,datetime as dt,json,pathlib
import numpy as np,rasterio
from rasterio.warp import reproject
from rasterio.enums import Resampling
from pyproj import Transformer
from process_lifecycle import watch_parent
watch_parent()

def process(older,newer,output):
    older,newer,output=map(pathlib.Path,[older,newer,output]);output.mkdir(parents=True,exist_ok=True)
    a=json.loads((older/'provenance.json').read_text());b=json.loads((newer/'provenance.json').read_text())
    if any(a.get(key)!=b.get(key) for key in ['scenario','frequency','polarization']) or a['product']!='GCOV' or b['product']!='GCOV':raise ValueError('Compare the same GCOV frequency, polarization and study area')
    if a['conventions'].get('outputBackscatterNormalizationConvention')!=b['conventions'].get('outputBackscatterNormalizationConvention'):raise ValueError('Backscatter normalization conventions do not match')
    geometry=['trackNumber','lookDirection','orbitPassDirection']
    for key in geometry:
        if a['identification'].get(key) is not None and b['identification'].get(key) is not None and a['identification'][key]!=b['identification'][key]:raise ValueError('Acquisition geometry does not match: '+key)
    parse=lambda value:dt.datetime.fromisoformat(value.replace('Z','+00:00')).replace(tzinfo=dt.timezone.utc)
    days=(parse(b['date'])-parse(a['date'])).total_seconds()/86400
    if days<=0:raise ValueError('Select an older baseline and a strictly newer acquisition')
    with rasterio.open(older/'radar-components.tif') as old,rasterio.open(newer/'radar-components.tif') as new:
        before=np.full(new.shape,np.nan,dtype=np.float32)
        reproject(source=rasterio.band(old,2),destination=before,src_transform=old.transform,src_crs=old.crs,dst_transform=new.transform,dst_crs=new.crs,src_nodata=np.nan,dst_nodata=np.nan,resampling=Resampling.nearest)
        after=new.read(2);valid=np.isfinite(before)&np.isfinite(after);difference=np.where(valid,after-before,np.nan).astype(np.float32)
        if not valid.any():raise ValueError('No paired valid GCOV pixels in the study area')
        with rasterio.open(output/'radar-components.tif','w',driver='GTiff',width=new.width,height=new.height,count=3,dtype='float32',crs=new.crs,transform=new.transform,nodata=np.nan,tiled=True,compress='deflate') as dst:
            for i,(values,name) in enumerate([(difference,'newer_minus_older_db'),(np.where(valid,before,np.nan),'older_db'),(np.where(valid,after,np.nan),'newer_db')],1):dst.write(values.astype(np.float32),i);dst.set_band_description(i,name)
        yy,xx=np.where(valid);stride=max(1,int(np.ceil(len(xx)/5000)));yy,xx=yy[::stride],xx[::stride]
        x,y=rasterio.transform.xy(new.transform,yy,xx);lon,lat=Transformer.from_crs(new.crs,4326,always_xy=True).transform(x,y)
        features=[{'type':'Feature','geometry':{'type':'Point','coordinates':[float(lon[i]),float(lat[i])]},'properties':{'backscatterChange':float(difference[r,c]),'olderDb':float(before[r,c]),'newerDb':float(after[r,c])}} for i,(r,c) in enumerate(zip(yy,xx))]
        (output/'samples.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},allow_nan=False))
        warnings=[]
        if any(key not in a['identification'] or key not in b['identification'] for key in geometry):warnings.append('Acquisition geometry metadata is incomplete; identical viewing geometry is not verified.')
        if a['identification'].get('compositeReleaseId')!=b['identification'].get('compositeReleaseId'):warnings.append('Processing release identifiers differ; processing changes can affect backscatter.')
        metadata={'product':'GCOV_CHANGE','scenario':a['scenario'],'frequency':a['frequency'],'polarization':a['polarization'],'referenceDate':a['date'],'secondaryDate':b['date'],'pairDays':days,'units':'dB change','acceptedSamples':int(valid.sum()),'totalSamples':int(valid.size),'returnedSamples':len(features),'pairedAreaKm2':float(valid.sum()*abs(new.transform.a*new.transform.e)/1e6),'medianChangeDb':float(np.median(difference[valid])),'meanChangeDb':float(difference[valid].mean()),'sources':[a,b],'warnings':warnings,'resampling':'Older dB crop mapped to newer fixed grid using nearest neighbour; only finite valid cells in both acquisitions.','validation':'Backscatter change, not confirmed flooding, water depth, biomass, forest loss or displacement.','createdAt':dt.datetime.now(dt.timezone.utc).isoformat()}
        (output/'provenance.json').write_text(json.dumps(metadata,indent=2,allow_nan=False));return metadata

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--older',required=True);parser.add_argument('--newer',required=True);parser.add_argument('--output',required=True);parser.add_argument('--parent-pid');args=parser.parse_args()
    try:print(json.dumps(process(args.older,args.newer,args.output)),flush=True)
    except Exception as error:parser.exit(1,str(error))
