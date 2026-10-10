"""Render genuine Sentinel-2 COGs into cached map tiles; no synthetic pixels."""
import io, json, math, os, pathlib, threading, sys, time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1] / '.python'))
import numpy as np
import rasterio
from rasterio.vrt import WarpedVRT
from rasterio.transform import from_bounds
from rasterio.enums import Resampling
from rasterio.windows import Window, from_bounds as window_from_bounds
from rasterio.warp import transform_bounds
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
MANIFEST = json.loads((ROOT / 'database/imagery/sentinel2.json').read_text())
MANIFEST['scenarios'].update(json.loads((ROOT / 'database/imagery/additional-sentinel2.json').read_text())['scenarios'])
CACHE = ROOT / 'database/processed/imagery-tiles-v9'
SCENARIOS = {s['id']:s for s in json.loads((ROOT / 'database/scenarios.json').read_text())['scenarios']}
SLOTS = threading.BoundedSemaphore(4)
DETAIL_SLOTS = threading.BoundedSemaphore(2)
PREPARE_SLOTS = threading.BoundedSemaphore(1)
FRAME_LOCKS = {}
LOCK_GUARD = threading.Lock()
PREPARED = ROOT / 'database/processed/optical-studies-v3'
NATIVE = ROOT / 'database/processed/optical-studies-native-v2'
os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR')
os.environ.setdefault('GDAL_HTTP_TIMEOUT', '60')
os.environ.setdefault('GDAL_HTTP_MAX_RETRY', '0')
os.environ.setdefault('GDAL_HTTP_MULTIRANGE', 'YES')
os.environ.setdefault('GDAL_HTTP_MAX_TOTAL_CONNECTIONS', '6')
os.environ.setdefault('CPL_VSIL_CURL_ALLOWED_EXTENSIONS', '.tif')

def prepare(frame, scenario, factor=1):
    """Read the small study window once; tile requests never repeatedly fetch the full scene."""
    cache_id = frame.get('sourceSceneId',frame['id'])
    full = NATIVE / scenario / f"{cache_id}.tif"
    if factor==1 and full.exists(): return full
    target = full if factor==1 else PREPARED / scenario / f"{cache_id}-lod{factor}.tif"
    with LOCK_GUARD:
        lock = FRAME_LOCKS.setdefault((scenario,cache_id,factor), threading.Lock())
    with lock:
        if target.exists(): return target
        with PREPARE_SLOTS:
            source = f"http://127.0.0.1:8787/api/imagery/cog/{scenario}/{frame['id']}/TCI.tif"
            last_error = None
            for attempt in range(2):
                try:
                    with rasterio.Env(GDAL_CACHEMAX=64_000_000):
                        with rasterio.open(source+f'?attempt={attempt}') as src:
                            extent=SCENARIOS[scenario]['extent'] if factor==1 else SCENARIOS[scenario].get('imageryExtent',SCENARIOS[scenario]['extent'])
                            bounds = transform_bounds('EPSG:4326',src.crs,*extent,densify_pts=21)
                            window = window_from_bounds(*bounds,src.transform).round_offsets().round_lengths()
                            window = window.intersection(Window(0,0,src.width,src.height))
                            if window.width < 1 or window.height < 1: raise ValueError('Observation does not cover the glacier study area')
                            height=max(1,math.ceil(window.height/factor));width=max(1,math.ceil(window.width/factor))
                            rgb = src.read((1,2,3),window=window,out_shape=(3,height,width),resampling=Resampling.bilinear)
                            profile=src.profile.copy()
                            transform=src.window_transform(window)*rasterio.Affine.scale(window.width/width,window.height/height)
                            profile.update(driver='GTiff',height=rgb.shape[1],width=rgb.shape[2],count=3,transform=transform,tiled=True,blockxsize=256,blockysize=256,compress='deflate',nodata=0)
                    target.parent.mkdir(parents=True,exist_ok=True)
                    temporary=target.with_suffix('.preparing.tif')
                    with rasterio.open(temporary,'w',**profile) as dst:
                        dst.write(rgb)
                        factors=[f for f in [2,4,8,16] if min(rgb.shape[1:])//f>=1]
                        if factors: dst.build_overviews(factors,Resampling.average)
                    os.replace(temporary,target)
                    print(f"Prepared real optical study: {scenario}/{frame['id']} (source overview {factor}x)",flush=True)
                    return target
                except Exception as error:
                    last_error=error
                    # Each attempt uses a new GDAL URL so failed block reads cannot poison a retry.
            raise last_error

def context_path(frame, scenario, factor):
    """A cached overview is enough for context; never download a new one on navigation."""
    cache_id = frame.get('sourceSceneId', frame['id'])
    for candidate in dict.fromkeys([factor, 2, 4, 8, 16]):
        path = PREPARED / scenario / f'{cache_id}-lod{candidate}.tif'
        if path.exists(): return path
    return prepare(frame, scenario, factor)

def render(frame, z, x, y, scenario):
    span = 40075016.68557849 / (2 ** z)
    west = -20037508.342789244 + x * span
    north = 20037508.342789244 - y * span
    transform = from_bounds(west, north-span, west+span, north, 256, 256)
    with rasterio.Env(GDAL_CACHEMAX=64_000_000):
        def pixels(path):
            with rasterio.open(path) as src:
                with WarpedVRT(src,crs='EPSG:3857',transform=transform,width=256,height=256,
                               resampling=Resampling.bilinear,nodata=0) as vrt:
                    return vrt.read((1,2,3)).transpose(1,2,0).astype(np.uint8)
        native_path = NATIVE / scenario / f"{frame.get('sourceSceneId', frame['id'])}.tif"
        if z>=13 or native_path.exists():
            # Keep real 10 m study pixels at every zoom, over local overview context.
            # Missing finer landscape overviews must not stall glacier playback.
            native=pixels(native_path if native_path.exists() else prepare(frame,scenario,1))
            valid=np.any(native!=0,axis=2)
            if np.all(valid):
                # A central glacier tile needs no download of the distant landscape.
                rgb=native
            else:
                rgb=pixels(context_path(frame,scenario,2 if z>=12 else min(16,2**max(0,13-z))))
                rgb[valid]=native[valid]
        else:
            rgb=pixels(context_path(frame,scenario,2 if z>=12 else min(16,2**max(0,13-z))))
    alpha = np.where(np.any(rgb != 0, axis=2), 255, 0).astype(np.uint8)
    w,s,e,n=transform_bounds('EPSG:4326','EPSG:3857',*SCENARIOS[scenario].get('imageryExtent',SCENARIOS[scenario]['extent']))
    columns=west+(np.arange(256)+0.5)*span/256
    rows=north-(np.arange(256)+0.5)*span/256
    alpha[(rows[:,None]<s)|(rows[:,None]>n)|(columns[None,:]<w)|(columns[None,:]>e)]=0
    image = Image.fromarray(np.dstack((rgb, alpha)))
    output = io.BytesIO()
    image.save(output, format='PNG')
    return output.getvalue()

