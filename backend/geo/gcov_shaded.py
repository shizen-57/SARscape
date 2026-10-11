"""Aerial photo shaded by NISAR GCOV change: SWISSIMAGE colours, brightness from each date's HH versus the all-date mean.

The colours come from one aerial mosaic year, not from the radar date. Only brightness changes with NISAR.
Run after the GCOV dates are prepared: python backend/geo/gcov_shaded.py
"""
import json, math, os, pathlib, sys
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / '.python'))
import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import from_bounds, from_origin
from rasterio.warp import reproject

ROOT = pathlib.Path(__file__).resolve().parents[2]
GCOV = ROOT / 'database/processed/gcov'
YEAR, ZOOM, SIZE = 2025, 14, 7   # z14 = 6.6 m/px at Aletsch, close to GCOV's 8-11 m grid; 7×7 box = 70 m
GAIN, CLIP_DB = 0.5, 6.0         # factor = 10^(GAIN·Δ/10); a ±6 dB change is capped at ×0.5…×2
WORLD = 20037508.342789244
NOTE = (f'SWISSIMAGE {YEAR} aerial colours, shaded by each NISAR date\'s HH backscatter relative to the mean of the prepared dates on the same track '
        f'({SIZE}×{SIZE} box mean, {GAIN} × dB change, capped at ±{CLIP_DB:g} dB). Colours come from a different date than the radar; only brightness is radar.')


def tile_range(west, south, east, north, zoom=ZOOM):
    n = 2 ** zoom
    x = lambda lon: int((lon + 180) / 360 * n)
    y = lambda lat: int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x(west), x(east), y(north), y(south)


def fetch_mosaic(bounds, cache=ROOT / f'data/aerial/swissimage-{YEAR}-z{ZOOM}'):
    x0, x1, y0, y1 = tile_range(*bounds)
    cache.mkdir(parents=True, exist_ok=True)

    def tile(xy):
        path = cache / f'{xy[0]}_{xy[1]}.jpg'
        if not path.exists():
            url = f'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default/{YEAR}/3857/{ZOOM}/{xy[0]}/{xy[1]}.jpeg'
            with urlopen(Request(url, headers={'User-Agent': 'SARscape'}), timeout=30) as response:
                data = response.read()
            if data[:2] != b'\xff\xd8': raise ValueError('swisstopo did not return a JPEG')
            path.write_bytes(data)
        return xy, Image.open(path).convert('RGB')

    mosaic = Image.new('RGB', ((x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256))
    with ThreadPoolExecutor(6) as pool:
        for (x, y), image in pool.map(tile, [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]):
            mosaic.paste(image, ((x - x0) * 256, (y - y0) * 256))
    size = 2 * WORLD / 2 ** ZOOM
    return np.asarray(mosaic), from_origin(-WORLD + x0 * size, WORLD - y0 * size, size / 256, size / 256), (x1 - x0 + 1) * (y1 - y0 + 1)


def box_mean(values, size=SIZE):
    """NaN-aware box mean via an integral image (a nanmean over sliding windows would need gigabytes)."""
    pad = size // 2
    ok = np.pad(np.isfinite(values), pad).astype(np.float64)
    total = np.pad(np.nan_to_num(values), pad)
    integral = lambda a: np.pad(a.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    window = lambda i, h, w: i[size:size + h, size:size + w] - i[:h, size:size + w] - i[size:size + h, :w] + i[:h, :w]
    h, w = values.shape
    count = window(integral(ok), h, w)
    with np.errstate(invalid='ignore', divide='ignore'):
        return np.where(count > 0, window(integral(total), h, w) / count, np.nan)


def shade(aerial, hh_stack):
    """aerial: H×W×3 uint8; hh_stack: dates×H×W dB. Returns one H×W×4 uint8 image per date."""
    smooth = np.stack([box_mean(v) for v in hh_stack])
    reference = np.nanmean(smooth, axis=0)
    images = []
    for hh, raw in zip(smooth, hh_stack):
        delta = np.clip(np.nan_to_num(hh - reference), -CLIP_DB, CLIP_DB)
        factor = 10 ** (GAIN * delta / 10)[..., None]
        rgb = np.clip(aerial * factor, 0, 255).astype(np.uint8)
        images.append(np.dstack([rgb, np.where(np.isfinite(raw), 255, 0).astype(np.uint8)]))
    return images


def main():
    manifest = json.loads((GCOV / 'manifest.json').read_text())
    observations = [o for o in manifest['observations'] if o.get('colorPreview')]
    if not observations: raise SystemExit('No GCOV dates with colour previews; run npm run data:aletsch first')
    # Tracks look at the glacier from different directions, so each track is shaded against its own mean.
    groups = {}
    for o in observations:
        identity = o.get('identification', {})
        groups.setdefault((identity.get('trackNumber'), identity.get('orbitPassDirection')), []).append(o)
    cache, tiles = {}, 0
    for group in groups.values():
        display = group[0]['displayPreview']
        height, width = display['shape']
        (w, n), _, (e, s), _ = display['coordinates']
        if any(o['displayPreview']['coordinates'] != display['coordinates'] or o['displayPreview']['shape'] != display['shape'] for o in group): raise SystemExit('GCOV dates of one track do not share a display grid')
        target = from_bounds(w, s, e, n, width, height)
        photo, transform, tiles = fetch_mosaic((w, s, e, n))
        aerial = np.zeros((height, width, 3), np.float32)
        for band in range(3):
            reproject(photo[..., band].astype(np.float32), aerial[..., band], src_transform=transform, src_crs='EPSG:3857', dst_transform=target, dst_crs='EPSG:4326', resampling=Resampling.bilinear)
        stack = []
        for o in group:
            hh = np.full((height, width), np.nan, np.float32)
            with rasterio.open(GCOV / o['id'] / 'gcov-backscatter.tif') as tif:
                reproject(tif.read(1), hh, src_transform=tif.transform, src_crs=tif.crs, src_nodata=np.nan, dst_transform=target, dst_crs='EPSG:4326', dst_nodata=np.nan, resampling=Resampling.nearest)
            stack.append(hh)
        for o, image in zip(group, shade(aerial, np.stack(stack))):
            directory = GCOV / o['id']
            Image.fromarray(image).save(directory / 'gcov-shaded.preparing.png')
            os.replace(directory / 'gcov-shaded.preparing.png', directory / 'gcov-shaded.png')
            o['colorPreview']['shaded'] = {'file': 'gcov-shaded.png', 'note': NOTE, 'imagery': f'SWISSIMAGE {YEAR} mosaic, zoom {ZOOM}', 'imageryUrl': 'https://www.swisstopo.admin.ch/en/orthoimage-swissimage-10', 'dates': len(group), 'displayIsMeasurement': False}
            provenance = json.loads((directory / 'gcov-provenance.json').read_text())
            provenance['colorPreview'] = o['colorPreview']
            (directory / 'gcov-provenance.json').write_text(json.dumps(provenance, indent=2))
    (GCOV / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f'Shaded {len(observations)} GCOV dates on {len(groups)} track(s) from {tiles} aerial tiles', flush=True)


if __name__ == '__main__':
    main()
