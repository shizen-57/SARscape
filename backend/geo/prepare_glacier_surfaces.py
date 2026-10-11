"""Prepare small, georeferenced Aletsch speed surfaces and published historical outlines.

Source observations stay separate: no invented daily velocities, glacier shrinkage, or DEM epochs.
NASA image-pair speeds are interval means, not instantaneous measurements. Spatial interpolation
is used only by the map's texture renderer; no missing scientific cells are filled.
"""
import argparse, datetime as dt, hashlib, io, json, math, pathlib, sys, zipfile, sqlite3
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/.python'))
import h5py
import numpy as np
import requests
import rasterio
import shapely
from PIL import Image
from pyproj import Transformer
from rasterio.features import rasterize
from rasterio.transform import from_bounds, from_origin
from rasterio.warp import reproject, Resampling
from shapely.geometry import mapping, shape, box
from aletsch_outline import dbf_records, shp_polygons
from public_range import PublicRangeReader

OUT = ROOT / 'database/processed/surfaces/aletsch'
BBOX = [7.92, 46.37, 8.14, 46.58]
TO_M = Transformer.from_crs(4326, 3857, always_xy=True)
TO_LL = Transformer.from_crs(3857, 4326, always_xy=True)
W, S = TO_M.transform(BBOX[0], BBOX[1]); E, N = TO_M.transform(BBOX[2], BBOX[3])
COLS, ROWS = math.ceil((E-W)/170), math.ceil((N-S)/170)  # ~117 m on the ground at Aletsch
GRID = from_bounds(W, S, E, N, COLS, ROWS)
STOPS = [(0, [20, 12, 72]), (.15, [74, 35, 171]), (.35, [155, 49, 218]), (.6, [236, 57, 115]), (.8, [250, 139, 48]), (1, [255, 226, 90])]


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, allow_nan=False, separators=(',', ':')), encoding='utf8')


def persist(manifest, outlines):
    with sqlite3.connect(ROOT/'database/sarscape.sqlite',timeout=60) as db:
        db.executescript((ROOT/'database/migrations/003_glacier_surfaces.sql').read_text())
        now=dt.datetime.now(dt.timezone.utc).isoformat()
        for frame in manifest['frames']:
            db.execute('INSERT OR REPLACE INTO glacier_surface_frames VALUES(?,?,?,?,?,?,?,?)',('aletsch',frame['id'],frame['kind'],frame['start'],frame['end'],frame['source'],json.dumps(frame),now))
        for outline in outlines['features']:
            p=outline['properties'];db.execute('INSERT OR REPLACE INTO glacier_outline_epochs VALUES(?,?,?,?)',('aletsch',p['year'],p['source'],json.dumps(outline)))


def download_small(session, url, path, limit=25*1024**2):
    if path.exists(): return path.read_bytes()
    with session.get(url, stream=True, timeout=60) as r:
        r.raise_for_status(); raw = bytearray()
        if int(r.headers.get('Content-Length', 0)) > limit: raise ValueError('Inventory exceeds bounded download limit')
        for chunk in r.iter_content(65536):
            raw.extend(chunk)
            if len(raw) > limit: raise ValueError('Inventory exceeds bounded download limit')
    path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(raw); return bytes(raw)


def outlines(session):
    result = []
    for year, release, epsg in [(1973, 'r1976', 21781), (2010, 'r2010', 21781)]:
        url = f'https://doi.glamos.ch/data/inventory/inventory_sgi{year}_{release}.zip'
        raw = download_small(session, url, ROOT / f'data/surfaces/sgi{year}.zip')
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            shp = next(n for n in z.namelist() if n.lower().endswith('.shp') and '__MACOSX' not in n)
            records, polygons = list(dbf_records(z.read(shp[:-4]+'.dbf'))), list(shp_polygons(z.read(shp)))
            # Printed once for transparent inspection if archive attributes change.
            matches = [(r, p) for r, p in zip(records, polygons) if r.get('SGI',r.get('sgi-id','')).replace(' ', '') == 'B36-26']
            if not matches: raise ValueError(f'No B36-26 in {year}: fields {records[0]}')
            record = matches[0][0]
            polygon = shapely.union_all([p for r,p in matches])
            prj = z.read(shp[:-4]+'.prj').decode()
            to_ll = Transformer.from_crs(prj, 4326, always_xy=True)
            geometry = shapely.transform(polygon.simplify(5, preserve_topology=True), lambda c: np.column_stack(to_ll.transform(c[:,0], c[:,1])))
            feature = {'type':'Feature','geometry':mapping(geometry),'properties':{'year':year,'name':'Grosser Aletschgletscher','sgiId':'B36-26','source':f'GLAMOS SGI{year}','sourceUrl':url,'license':'CC BY 4.0','areaKm2':polygon.area/1e6,'sourceSha256':hashlib.sha256(raw).hexdigest(),'acquisitionLabel':str(year),'datePrecision':'inventory year'}}
            if year == 2010:
                feature['properties']['limitation'] = 'Inventory based on 2008–2011 aerial imagery; exact local acquisition date is not supplied.'
        result.append(feature)
        print(json.dumps({'outline':year,'areaKm2':feature['properties']['areaKm2'],'attributes':record}), flush=True)
    current = json.loads((ROOT/'database/outlines/aletsch-sgi2016.geojson').read_text())['features'][0]
    current['properties'].update(year=current['properties']['outlineYear'], acquisitionLabel=str(current['properties']['outlineYear']), datePrecision='acquisition year')
    result.append(current)
    return {'type':'FeatureCollection','features':result}


def mask_for(feature):
    geometry = shapely.transform(shape(feature['geometry']), lambda c: np.column_stack(TO_M.transform(c[:,0], c[:,1])))
    return rasterize([(geometry,1)],out_shape=(ROWS,COLS),transform=GRID,fill=0).astype(bool)


def decode(dataset, r, c):
    # Current ITS_LIVE files can contain a singleton image-pair/time dimension.
    values = np.asarray(dataset[0,r,c] if dataset.ndim == 3 and dataset.shape[0] == 1 else dataset[r,c], dtype=float)
    fill = dataset.attrs.get('_FillValue', -32767)
    values[values == fill] = np.nan
    return values * float(dataset.attrs.get('scale_factor', 1)) + float(dataset.attrs.get('add_offset', 0))


def warp(values, transform, epsg):
    dst = np.full((ROWS,COLS),np.nan,np.float32)
    reproject(values.astype(np.float32),dst,src_transform=transform,src_crs=epsg,dst_transform=GRID,dst_crs=3857,src_nodata=np.nan,dst_nodata=np.nan,resampling=Resampling.nearest)
    return dst


def preview(values, mask, path, scale=300):
    at = np.clip(values / scale, 0, 1)
    image = np.zeros((ROWS,COLS,4),np.uint8)
    for k in range(3): image[:,:,k] = np.nan_to_num(np.interp(at,[s[0] for s in STOPS],[s[1][k] for s in STOPS]))
    image[:,:,3] = np.where(mask & np.isfinite(values), 220, 0)
    Image.fromarray(image).save(path)


def process_pair(session, item, ice):
    source = item['assets']['data']['href']; props = item['properties']
    reader = PublicRangeReader(session, source)
    with h5py.File(reader,'r') as h:
        x,y = np.asarray(h['x']),np.asarray(h['y']); epsg=int(props['proj:code'].split(':')[-1])
        xy = Transformer.from_crs(4326,epsg,always_xy=True).transform
        a,b=xy(BBOX[0],BBOX[1]);c,d=xy(BBOX[2],BBOX[3])
        cc=np.flatnonzero((x>=a-240)&(x<=c+240));rr=np.flatnonzero((y>=b-240)&(y<=d+240))
        if len(cc)<2 or len(rr)<2: raise ValueError('Source does not cover study area')
        rows,cols=slice(rr.min(),rr.max()+1),slice(cc.min(),cc.max()+1)
        print(json.dumps({'shape':list(h['v'].shape),'x':[float(x[0]),float(x[-1])],'y':[float(y[0]),float(y[-1])],'row':[int(rr.min()),int(rr.max())],'col':[int(cc.min()),int(cc.max())]}),flush=True)
        transform=from_origin(float(x[cc.min()]-60),float(y[rr.min()]+60),120,120)
        v=decode(h['v'],rows,cols); vx=decode(h['vx'],rows,cols);vy=decode(h['vy'],rows,cols)
        error=decode(h['v_error'],rows,cols) if 'v_error' in h else np.full_like(v,np.nan)
        if 'interp_mask' in h:
            interpolated=decode(h['interp_mask'],rows,cols)>0
            for field in [v,vx,vy,error]: field[interpolated]=np.nan
        print(json.dumps({'source':item['id'],'variables':list(h.keys()),'v_range':[float(np.nanmin(v)),float(np.nanmax(v))],'v_error':float(np.nanmedian(error)),'transferredMiB':round(reader.transferred/1024**2,2)}),flush=True)
    values = {k:warp(a,transform,epsg) for k,a in [('speed',v),('vx',vx),('vy',vy),('error',error)]}
    # Missing cells and very uncertain/implausible speeds stay transparent. No infilling/blur.
    valid = ice & np.isfinite(values['speed']) & (values['speed'] >= 0) & (values['speed'] <= 600) & np.isfinite(values['error']) & (values['error'] <= 100)
    coverage=float(valid.sum()/max(1,ice.sum()))
    if coverage < .35: raise ValueError(f'Only {coverage:.1%} glacier coverage after screening')
    identity=hashlib.sha256(item['id'].encode()).hexdigest()[:16]
    filename=f'velocity-{identity}'
    preview(values['speed'],valid,OUT/f'{filename}.png')
    with rasterio.open(OUT/f'{filename}.tif','w',driver='GTiff',height=ROWS,width=COLS,count=4,dtype='float32',crs=3857,transform=GRID,nodata=np.nan,compress='deflate') as f:
        for i,(k,v) in enumerate(values.items(),1): f.write(np.where(valid,v,np.nan).astype(np.float32),i);f.set_band_description(i,k)
    finite=lambda a:[round(float(v),2) if ok and np.isfinite(v) else None for v,ok in zip(a.ravel(),valid.ravel())]
    grid={'shape':[ROWS,COLS],'bounds3857':[W,S,E,N],'speed':finite(values['speed']),'vx':finite(values['vx']),'vy':finite(values['vy']),'error':finite(values['error']),'vectorCrs':f'EPSG:{epsg}'}
    write_json(OUT/f'{filename}.json',grid)
    return {'id':filename,'kind':'velocity','date':props['mid_datetime'],'start':props['start_datetime'],'end':props['end_datetime'],'intervalDays':props['date_dt'],'label':f"{props['start_datetime'][:10]} → {props['end_datetime'][:10]}",'source':'NASA MEaSUREs ITS_LIVE v2','sourceUrl':source,'sensor':props['platform'],'units':'m/year','coverage':coverage,'maskYear':2017,'image':f'{filename}.png','grid':f'{filename}.json','raster':f'{filename}.tif','interpretation':'Interval-mean surface speed from image-pair feature tracking, not instantaneous or daily velocity. Error estimates do not capture every systematic error.','transferBytes':reader.transferred}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--year',default='2022');parser.add_argument('--outlines-only',action='store_true');args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    session=requests.Session()
    # Includes rejected candidates, not just the accepted scientific frames.
    session.regional_budget=64*1024**2;session.regional_transferred=0
    outline_path=OUT/'outlines.geojson'
    if not outline_path.exists(): write_json(outline_path,outlines(session))
    outline=json.loads(outline_path.read_text());ice=mask_for(outline['features'][-1])
    manifest_path=OUT/'manifest.json'
    manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'version':1,'scenario':'aletsch','coordinates':[[BBOX[0],BBOX[3]],[BBOX[2],BBOX[3]],[BBOX[2],BBOX[1]],[BBOX[0],BBOX[1]]],'bounds3857':[W,S,E,N],'shape':[ROWS,COLS],'velocityScale':[0,300],'outlines':'outlines.geojson','frames':[],'elevation':{'available':False,'reason':'No co-registered, dated surface DEMs are connected for Aletsch. Terrain remains fixed. Velocity and retreat outlines cannot establish surface height or melt.'}}
    if not args.outlines_only:
        for month in [1,4,7,10]:
            cached=[f for f in manifest['frames'] if f.get('seasonMonth')==month and f.get('year')==int(args.year)]
            if cached and all(all((OUT/f[k]).is_file() for k in ('image','grid','raster')) for f in cached): continue
            manifest['frames']=[f for f in manifest['frames'] if f not in cached]
            if session.regional_transferred >= session.regional_budget: raise ValueError('Total workflow byte budget exceeded')
            start=f'{args.year}-{month:02d}-01T00:00:00Z';end=f'{args.year}-{min(12,month+1):02d}-28T23:59:59Z'
            response=session.post('https://stac.itslive.cloud/search',json={'collections':['itslive-granules'],'bbox':BBOX,'datetime':f'{start}/{end}','limit':100,'filter-lang':'cql2-json','filter':{'op':'and','args':[{'op':'>=','args':[{'property':'date_dt'},48]},{'op':'<=','args':[{'property':'date_dt'},120]},{'op':'=','args':[{'property':'scene_1_frame'},'T32TMS']},{'op':'in','args':[{'property':'platform'},['S2A','S2B']]}]}},timeout=60)
            if not response.ok: raise ValueError(response.text[:1000])
            candidates=[f for f in response.json().get('features',[]) if 48<=f['properties']['date_dt']<=120 and f['properties']['platform'] in ('S2A','S2B')]
            candidates.sort(key=lambda f: ('T32TMS' not in f['id'], -f['properties'].get('percent_valid_pixels',0)))
            print(json.dumps({'month':month,'candidates':len(candidates)}),flush=True)
            for item in candidates[:6]:
                try:
                    frame=process_pair(session,item,ice);frame.update(seasonMonth=month,year=int(args.year));manifest['frames'].append(frame)
                    manifest['frames'].sort(key=lambda f:f['date']);write_json(manifest_path,manifest)
                    print(json.dumps({'prepared':frame['label'],'coverage':frame['coverage']}),flush=True);break
                except (ValueError,requests.RequestException,OSError) as e: print(f'Skipping: {e}',flush=True)
    write_json(manifest_path,manifest)
    persist(manifest,outline)
    print(json.dumps({'frames':len(manifest['frames']),'rangeTransferBytesThisRun':session.regional_transferred,'output':str(OUT)}),flush=True)


if __name__=='__main__': main()
