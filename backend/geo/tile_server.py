"""Render genuine Sentinel-2 COGs into cached map tiles; no synthetic pixels."""
import io, json, math, os, pathlib, threading, sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1] / '.python'))
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
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
CACHE = ROOT / 'database/processed/imagery-tiles-v6'
SCENARIOS = {s['id']:s for s in json.loads((ROOT / 'database/scenarios.json').read_text())['scenarios']}
SLOTS = threading.BoundedSemaphore(4)
DETAIL_SLOTS = threading.BoundedSemaphore(2)
PREPARE_SLOTS = threading.BoundedSemaphore(1)
FRAME_LOCKS = {}
LOCK_GUARD = threading.Lock()
PREPARED = ROOT / 'database/processed/optical-studies-v2'
NATIVE = ROOT / 'database/processed/optical-studies-v1'
os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR')
os.environ.setdefault('GDAL_HTTP_TIMEOUT', '60')
os.environ.setdefault('GDAL_HTTP_MAX_RETRY', '0')
os.environ.setdefault('GDAL_HTTP_MULTIRANGE', 'NO')
os.environ.setdefault('CPL_VSIL_CURL_ALLOWED_EXTENSIONS', '.tif')

def prepare(frame, scenario, factor=1):
    """Read the small study window once; tile requests never repeatedly fetch the full scene."""
    full = NATIVE / scenario / f"{frame['id']}.tif"
    if factor==1 and full.exists(): return full
    target = full if factor==1 else PREPARED / scenario / f"{frame['id']}-lod{factor}.tif"
    with LOCK_GUARD:
        lock = FRAME_LOCKS.setdefault((scenario,frame['id'],factor), threading.Lock())
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

def render(frame, z, x, y, scenario):
    span = 40075016.68557849 / (2 ** z)
    west = -20037508.342789244 + x * span
    north = 20037508.342789244 - y * span
    transform = from_bounds(west, north-span, west+span, north, 256, 256)
    with rasterio.Env(GDAL_CACHEMAX=64_000_000):
        source=prepare(frame,scenario,2 if z>=12 else min(16,2**max(0,13-z)))
        def pixels(path):
            with rasterio.open(path) as src:
                with WarpedVRT(src,crs='EPSG:3857',transform=transform,width=256,height=256,
                               resampling=Resampling.bilinear,nodata=0) as vrt:
                    return vrt.read((1,2,3)).transpose(1,2,0).astype(np.uint8)
        rgb=pixels(source)
        if z>=13:
            # Load the glacier crop once on demand, then keep all map-tile reads local.
            # Surrounding landscape retains the same capture's small overview.
            native=pixels(prepare(frame,scenario,1))
            valid=np.any(native!=0,axis=2)
            rgb[valid]=native[valid]
    alpha = np.where(np.any(rgb != 0, axis=2), 255, 0).astype(np.uint8)
    w,s,e,n=transform_bounds('EPSG:4326','EPSG:3857',*SCENARIOS[scenario].get('imageryExtent',SCENARIOS[scenario]['extent']))
    columns=west+(np.arange(256)+0.5)*span/256
    rows=north-(np.arange(256)+0.5)*span/256
    alpha[(rows[:,None]<s)|(rows[:,None]>n)|(columns[None,:]<w)|(columns[None,:]>e)]=0
    image = Image.fromarray(np.dstack((rgb, alpha)))
    output = io.BytesIO()
    image.save(output, format='PNG')
    return output.getvalue()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200); self.end_headers(); self.wfile.write(b'OK'); return
        parts = self.path.split('/')
        try:
            if len(parts) != 7 or parts[1] != 'tile': raise ValueError('Invalid tile')
            _,_,scenario,frame_id,z,x,y = parts
            z,x,y = int(z),int(x),int(y.removesuffix('.png'))
            if not 0 <= z <= 17 or not 0 <= x < 2**z or not 0 <= y < 2**z: raise ValueError('Invalid tile bounds')
            frame = next((f for f in MANIFEST['scenarios'].get(scenario,[]) if f['id'] == frame_id), None)
            if not frame: raise ValueError('Unknown frame')
            target = CACHE / scenario / frame_id / str(z) / str(x) / f'{y}.png'
            if target.exists(): data = target.read_bytes()
            else:
                prepare(frame,scenario,1 if z>=13 else min(16,2**max(0,13-z)))
                with (DETAIL_SLOTS if z>=13 else SLOTS):
                    data = render(frame,z,x,y,scenario)
                    target.parent.mkdir(parents=True,exist_ok=True)
                    temporary = target.with_suffix(f'.{threading.get_ident()}.tmp')
                    temporary.write_bytes(data); os.replace(temporary,target)
            self.send_response(200)
            self.send_header('Content-Type','image/png')
            self.send_header('Content-Length',str(len(data)))
            self.send_header('Cache-Control','public,max-age=31536000,immutable')
            self.end_headers(); self.wfile.write(data)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass
        except ValueError as error:
            self.send_error(404,str(error))
        except Exception as error:
            print(f'Raster processing failed: {type(error).__name__}: {error}',flush=True)
            try: self.send_error(502,'Could not render observation tile')
            except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError): pass
    def log_message(self,*args): pass

print('Geospatial tile processor ready on 127.0.0.1:8788',flush=True)
ThreadingHTTPServer(('127.0.0.1',8788),Handler).serve_forever()
