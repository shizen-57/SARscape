"""Real cloudy Sentinel-2 view of the glacier near each radar storm response, aligned to the radar image.

Measured: Sentinel-2 L2A true colour (TCI) on a real acquisition date, with the scene's own cloud-cover percentage
(ESA/Copernicus data via the public Element 84 Earth Search STAC catalogue). Only the glacier window is read from
the cloud-optimised GeoTIFF; nothing is downloaded whole.
"""
import json, pathlib, sys, urllib.request
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / '.python'))
import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import Affine, from_bounds
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import from_bounds as window_bounds

STAC = 'https://earth-search.aws.element84.com/v1/search'
MIN_CLOUD = 80.0          # percent: only scenes that really are cloudy tell the "radar sees through cloud" story
SCALE = 2                 # optical image is half the radar display size


def search(bbox, start, end):
    body = {'collections': ['sentinel-2-l2a'], 'bbox': bbox, 'datetime': f'{start}T00:00:00Z/{end}T23:59:59Z', 'limit': 100}
    request = urllib.request.Request(STAC, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'User-Agent': 'SARscape'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)['features']


def days(a, b):
    return abs(int((np.datetime64(a) - np.datetime64(b)).astype(int)))


def optical_crop(feature, display, path):
    """Read only the glacier window of the TCI image and reproject it onto the radar display grid."""
    (west, north), _, (east, south), _ = display['coordinates']
    height, width = display['shape']
    out_h, out_w = height // SCALE, width // SCALE
    target = from_bounds(west, south, east, north, out_w, out_h)
    with rasterio.open(feature['assets']['visual']['href']) as src:
        left, bottom, right, top = transform_bounds('EPSG:4326', src.crs, west, south, east, north)
        window = window_bounds(left - 300, bottom - 300, right + 300, top + 300, src.transform).round_offsets().round_lengths()
        shape = (3, max(1, int(window.height // 2)), max(1, int(window.width // 2)))
        data = src.read(window=window, out_shape=shape, resampling=Resampling.average, boundless=True, fill_value=0)
        transform = src.window_transform(window) * Affine.scale(window.width / shape[2], window.height / shape[1])
        crs = src.crs
    image = np.zeros((3, out_h, out_w), np.uint8)
    for band in range(3):
        reproject(data[band], image[band], src_transform=transform, src_crs=crs, dst_transform=target, dst_crs='EPSG:4326', resampling=Resampling.bilinear)
    Image.fromarray(np.moveaxis(image, 0, -1)).save(path, quality=82, method=4)
    return {'shape': [out_h, out_w], 'cloudFreePixelShare': round(float(((image > 0).any(0)).mean()), 3)}


def attach(findings, observations, bbox, out_dir):
    """Add a `clouds` comparison to each finding that has a very cloudy Sentinel-2 scene near its radar images."""
    by_id = {o['id']: o for o in observations}
    for finding in findings:
        responses = finding.get('responses') or []
        if not responses: continue
        first, last = finding['storm']['from'], max(r['date'] for r in responses)
        start, end = str(np.datetime64(first) - 3), str(np.datetime64(last) + 3)
        try:
            scenes = [f for f in search(bbox, start, end) if f['properties'].get('eo:cloud_cover', 0) >= MIN_CLOUD and 'visual' in f['assets']]
            if not scenes: continue
            # Prefer a cloudy scene from the storm itself (a day before to 3 days after); otherwise any cloudy scene in the window.
            during = [s for s in scenes if str(np.datetime64(first) - 1) <= s['properties']['datetime'][:10] <= str(np.datetime64(finding['storm']['to']) + 3)]
            # The pair closest in time: that optical scene and the radar image acquired nearest to it.
            scene, response = min(((s, r) for s in (during or scenes) for r in responses), key=lambda p: (days(p[0]['properties']['datetime'][:10], p[1]['date']), -p[0]['properties']['eo:cloud_cover']))
            radar = next(o for o in observations if o['acquisitionDate'][:10] == response['date'] and f"{o['identification'].get('trackNumber')}{o['identification'].get('orbitPassDirection', '?')[0]}" == response['track'])
            file = f"optical-{finding['id']}.webp"
            info = optical_crop(scene, radar['displayPreview'], out_dir / file)
            finding['clouds'] = {'optical': {'id': scene['id'], 'date': scene['properties']['datetime'][:10], 'cloudPercent': round(scene['properties']['eo:cloud_cover'], 1), 'file': file,
                                             'source': 'Sentinel-2 L2A true colour, ESA/Copernicus via Element 84 Earth Search', 'sourceUrl': next((l['href'] for l in scene['links'] if l['rel'] == 'self'), None), **info},
                                 'radar': {'track': response['track'], 'date': response['date'], 'observationId': radar['id']},
                                 'daysApart': days(scene['properties']['datetime'][:10], response['date'])}
        except Exception as error:   # network or a missing scene must not break the radar analysis
            print(f"Cloud comparison skipped for {finding['id']}: {type(error).__name__}: {error}", flush=True)
    return findings
