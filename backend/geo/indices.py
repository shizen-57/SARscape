"""Cached NDWI/NDVI from real, radiometrically harmonized Sentinel-2 L2A bands."""
import argparse, datetime as dt, hashlib, io, json, math, os, pathlib, sys
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import Affine, from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds as window_from_bounds
from pyproj import Transformer
from PIL import Image
from process_lifecycle import watch_parent
watch_parent()

ROOT=pathlib.Path(__file__).resolve().parents[2]
MANIFEST=json.loads((ROOT/'database/imagery/additional-sentinel2.json').read_text())
SCENARIOS={s['id']:s for s in json.loads((ROOT/'database/scenarios.json').read_text())['scenarios']}
CACHE=ROOT/'database/processed/environment-v1'
os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN','EMPTY_DIR')
os.environ.setdefault('GDAL_HTTP_TIMEOUT','60')
os.environ.setdefault('GDAL_HTTP_MAX_RETRY','0')
os.environ.setdefault('GDAL_HTTP_MULTIRANGE','YES')
os.environ.setdefault('CPL_VSIL_CURL_ALLOWED_EXTENSIONS','.tif')

def normalized_index(first,second,valid):
    total=first+second
    good=valid&np.isfinite(first)&np.isfinite(second)&(first>=0)&(second>=0)&(total>1e-6)
    output=np.full(first.shape,np.nan,dtype=np.float32)
    np.divide(first-second,total,out=output,where=good)
    return output

def fingerprint(scenario,frame):
    return hashlib.sha256(json.dumps({'version':1,'extent':SCENARIOS[scenario]['extent'],'frame':frame['id'],'radiometry':frame['assetMetadata'],'mask':[4,5,6]},sort_keys=True).encode()).hexdigest()

def palette(values,kind,difference=False):
    # Finite measured cells only; gaps stay transparent.
    stops=np.array([-1,0,1] if difference else [-1,0,0.5,1])
    colors=np.array([[226,98,123],[238,240,222],[72,182,205]] if difference else
                    [[123,88,60],[207,194,133],[74,153,191],[23,78,145]] if kind=='wetland' else
                    [[88,113,160],[183,147,93],[128,170,89],[22,103,58]])
    rgba=np.zeros((*values.shape,4),dtype=np.uint8);finite=np.isfinite(values)
    for channel in range(3): rgba[...,channel]=np.interp(np.nan_to_num(values),stops,colors[:,channel]).astype(np.uint8)
    rgba[...,3]=finite.astype(np.uint8)*220
    return rgba

def write_raster(path,values,crs,transform,description):
    temporary=path.with_suffix('.preparing.tif')
    with rasterio.open(temporary,'w',driver='GTiff',width=values.shape[1],height=values.shape[0],count=1,dtype='float32',crs=crs,transform=transform,nodata=np.nan,tiled=True,compress='deflate') as dst:
        dst.write(values,1);dst.set_band_description(1,description)
        factors=[f for f in [2,4,8,16] if min(values.shape)//f>=1]
        if factors:dst.build_overviews(factors,Resampling.average)
    os.replace(temporary,path)

def prepare(scenario,frame):
    target=CACHE/scenario/frame['id'];target.mkdir(parents=True,exist_ok=True)
    marker=target/'summary.json';key=fingerprint(scenario,frame)
    if marker.exists():
        previous=json.loads(marker.read_text())
        if previous.get('fingerprint')==key and (target/'index.tif').exists():return previous
    config=SCENARIOS[scenario];extent=config['extent'];kind=config['kind']
    reference=MANIFEST['scenarios'][scenario][0]['assetMetadata']['nir']
    crs=rasterio.crs.CRS.from_epsg(reference['proj:epsg']);affine=Affine(*reference['proj:transform'])
    projected=transform_bounds('EPSG:4326',crs,*extent,densify_pts=21)
    window=window_from_bounds(*projected,affine)
    col,row=math.floor(window.col_off),math.floor(window.row_off)
    width=math.ceil(window.col_off+window.width)-col;height=math.ceil(window.row_off+window.height)-row
    transform=affine*Affine.translation(col,row)
    x=transform.c+(np.arange(width)+0.5)*transform.a;y=transform.f+(np.arange(height)+0.5)*transform.e
    xx,yy=np.meshgrid(x,y);lon,lat=Transformer.from_crs(crs,4326,always_xy=True).transform(xx,yy)
    inside=(lon>=extent[0])&(lon<=extent[2])&(lat>=extent[1])&(lat<=extent[3])
    bands={};raw_valid=inside.copy()
    needed=['green','nir'] if kind=='wetland' else ['red','nir']
    with rasterio.Env(GDAL_CACHEMAX=64_000_000):
        for band in [*needed,'scl']:
            error=None
            for attempt in range(3):
                try:
                    url=f"http://127.0.0.1:8787/api/imagery/cog/{scenario}/{frame['id']}/{band}.tif?attempt={attempt}"
                    with rasterio.open(url) as src:
                        with WarpedVRT(src,crs=crs,transform=transform,width=width,height=height,resampling=Resampling.nearest) as vrt:values=vrt.read(1)
                    if band=='scl':raw_valid&=np.isin(values,[4,5,6])
                    else:
                        metadata=frame['assetMetadata'][band];radiometry=metadata['raster:bands'][0]
                        raw_valid&=(values!=radiometry['nodata'])&(values!=metadata['saturated'])
                        bands[band]=values.astype(np.float32)*radiometry['scale']+radiometry['offset']
                    break
                except Exception as caught:error=caught
            else:raise error
    values=normalized_index(bands['green'],bands['nir'],raw_valid) if kind=='wetland' else normalized_index(bands['nir'],bands['red'],raw_valid)
    finite=values[np.isfinite(values)];area=abs(transform.a*transform.e)/1e6
    if not finite.size:raise ValueError('No clear valid reflectance samples in this study area')
    index='NDWI' if kind=='wetland' else 'NDVI'
    histogram,edges=np.histogram(finite,bins=100,range=(-1,1))
    summary={'scenario':scenario,'id':frame['id'],'date':frame['date'],'index':index,'formula':'(green - NIR) / (green + NIR)' if kind=='wetland' else '(NIR - red) / (NIR + red)',
      'fingerprint':key,'shape':[height,width],'epsg':crs.to_epsg(),'transform':list(transform)[:6],'extent':extent,'resolutionMeters':10,'pixelAreaKm2':area,
      'totalSamples':int(inside.sum()),'validSamples':int(finite.size),'validAreaKm2':float(finite.size*area),'coverage':float(finite.size/inside.sum()),
      'mean':float(finite.mean()),'median':float(np.median(finite)),'percentiles':np.percentile(finite,[5,25,75,95]).astype(float).tolist(),
      'histogram':{'edges':edges.astype(float).tolist(),'counts':histogram.astype(int).tolist()},
      'qualityMask':'SCL classes 4 (vegetation), 5 (bare/non-vegetated), 6 (water); excludes no-data, saturated, shadows, unclassified, clouds, cirrus and snow. SCL uses nearest-neighbour resampling from 20 m to the 10 m grid.',
      'radiometry':{band:frame['assetMetadata'][band] for band in needed},'processingBaseline':frame['processingBaseline'],
      'source':frame['metadataUrl'],'assets':{band:frame['assets'][band] for band in [*needed,'scl']},
      'interpretation':config['explanation'],'tideVerified':False,'landCoverValidated':False,
      'createdAt':dt.datetime.now(dt.timezone.utc).isoformat()}
    write_raster(target/'index.tif',values,crs,transform,index)
    image=Image.fromarray(palette(values,kind));image.thumbnail((900,900));image.save(target/'index.png')
    marker.write_text(json.dumps(summary,indent=2,allow_nan=False))
    return summary

def compare(scenario,frame,baseline):
    target=CACHE/scenario/frame['id'];marker=target/'change.json'
    with rasterio.open(CACHE/scenario/baseline['id']/'index.tif') as a,rasterio.open(target/'index.tif') as b:
        if a.shape!=b.shape or a.crs!=b.crs or a.transform!=b.transform:raise ValueError('Index grids are not aligned')
        old=a.read(1);new=b.read(1);valid=np.isfinite(old)&np.isfinite(new)
        difference=np.where(valid,new-old,np.nan).astype(np.float32);finite=difference[valid]
        area=abs(b.transform.a*b.transform.e)/1e6
        counts,edges=np.histogram(finite,bins=100,range=(-2,2))
        write_raster(target/'change.tif',difference,b.crs,b.transform,'newer minus first capture index')
        image=Image.fromarray(palette(difference,SCENARIOS[scenario]['kind'],True));image.thumbnail((900,900));image.save(target/'change.png')
        summary={'baseline':baseline['id'],'baselineDate':baseline['date'],'id':frame['id'],'date':frame['date'],'validSamples':int(valid.sum()),'pairedAreaKm2':float(valid.sum()*area),'coverage':float(valid.sum()/json.loads((target/'summary.json').read_text())['totalSamples']),
          'meanChange':float(finite.mean()) if finite.size else None,'medianChange':float(np.median(finite)) if finite.size else None,
          'histogram':{'edges':edges.astype(float).tolist(),'counts':counts.astype(int).tolist()},'interpretation':'Newer minus first annual capture on the same 10 m grid; only pixels valid in both dates. Greenness/water-signal change, not confirmed forest loss or flooding.'}
        marker.write_text(json.dumps(summary,indent=2,allow_nan=False))
        return summary

def render_tile(scenario,frame_id,z,x,y,change=False):
    span=40075016.68557849/2**z;west=-20037508.342789244+x*span;north=20037508.342789244-y*span
    transform=from_bounds(west,north-span,west+span,north,256,256)
    path=CACHE/scenario/frame_id/('change.tif' if change else 'index.tif')
    with rasterio.open(path) as src:
        with WarpedVRT(src,crs='EPSG:3857',transform=transform,width=256,height=256,resampling=Resampling.nearest,nodata=np.nan) as vrt:values=vrt.read(1)
    output=io.BytesIO();Image.fromarray(palette(values,SCENARIOS[scenario]['kind'],change)).save(output,format='PNG');return output.getvalue()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--scenario',choices=list(MANIFEST['scenarios']),required=True);parser.add_argument('--parent-pid');args=parser.parse_args()
    try:
        frames=MANIFEST['scenarios'][args.scenario]
        for i,frame in enumerate(frames):
            prepare(args.scenario,frame);compare(args.scenario,frame,frames[0])
            print(json.dumps({'completed':i+1,'total':len(frames),'id':frame['id']}),flush=True)
    except Exception as error:print(str(error),file=sys.stderr);sys.exit(1)
