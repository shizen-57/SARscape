"""Render cached optical context for the supplied radar story; no synthetic motion."""
import hashlib
import json
import pathlib
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject, transform_bounds
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'database/processed/supplied-nisar'


def prepare():
    summary = json.loads((OUTPUT / 'summary.json').read_text())
    frames = json.loads((ROOT / 'database/imagery/sentinel2.json').read_text())['scenarios']['aletsch']
    frame = max(frames, key=lambda item: item['date'])
    scene = frame.get('sourceSceneId', frame['id'])
    native = ROOT / 'database/processed/optical-studies-native-v2/aletsch' / f'{scene}.tif'
    overview = ROOT / 'database/processed/optical-studies-v3/aletsch' / f'{scene}-lod8.tif'
    if not native.exists():
        raise ValueError('Cache Aletsch imagery first: npm run imagery:cache -- --location=aletsch')
    paths = [overview, native] if overview.exists() else [native]
    with rasterio.open(paths[0]) as source:
        bounds = transform_bounds(source.crs, 'EPSG:3857', *source.bounds, densify_pts=21)
    height = 1400
    width = max(1, round(height * (bounds[2] - bounds[0]) / (bounds[3] - bounds[1])))
    transform = from_bounds(*bounds, width, height)
    rgb = np.zeros((3, height, width), dtype=np.uint8)
    for path in paths:
        layer = np.zeros_like(rgb)
        with rasterio.open(path) as source:
            for band in range(3):
                reproject(rasterio.band(source, band + 1), layer[band], src_transform=source.transform,
                          src_crs=source.crs, dst_transform=transform, dst_crs='EPSG:3857',
                          src_nodata=0, dst_nodata=0, resampling=Resampling.bilinear)
        valid = np.any(layer != 0, axis=0)
        rgb[:, valid] = layer[:, valid]
    alpha = np.where(np.any(rgb != 0, axis=0), 255, 0).astype(np.uint8)
    image_path = OUTPUT / 'presentation-context.png'
    Image.fromarray(np.dstack((rgb.transpose(1, 2, 0), alpha))).save(image_path)
    context = {
        'version': 1, 'sourceSha256': summary['sourceSha256'], 'radarReferenceDate': summary['referenceDate'],
        'radarSecondaryDate': summary['secondaryDate'], 'image': 'presentation-context.png',
        'imageSha256': hashlib.sha256(image_path.read_bytes()).hexdigest(),
        'crs': 'EPSG:3857', 'bounds': list(bounds), 'width': width, 'height': height,
        'frameId': frame['id'], 'date': frame['date'], 'metadataUrl': frame['metadataUrl'],
        'attribution': 'Contains modified Copernicus Sentinel data, 2026; Microsoft Planetary Computer.',
        'method': 'Bilinear reprojection of cached Sentinel-2 RGB: native 10 m study crop over an 80 m context overview where available. Fixed optical context; never animated as a radar acquisition.',
        'cachedInputs': [str(path.relative_to(ROOT)).replace('\\', '/') for path in paths],
    }
    (OUTPUT / 'presentation.json').write_text(json.dumps(context, indent=2))
    print(f'Presentation context ready: {width} x {height}, {image_path.stat().st_size:,} bytes', flush=True)
    prepare_annual(frames)


def prepare_annual(frames):
    """One common grid from real native crops, without fabricated intermediate scenes."""
    frames = sorted(frames, key=lambda item: item['date'])
    native_root = ROOT / 'database/processed/optical-studies-native-v2/aletsch'
    def path_for(frame):
        return native_root / f"{frame.get('sourceSceneId', frame['id'])}.tif"
    with rasterio.open(path_for(frames[0])) as source:
        bounds = transform_bounds(source.crs, 'EPSG:3857', *source.bounds, densify_pts=21)
    height = 1400
    width = round(height * (bounds[2] - bounds[0]) / (bounds[3] - bounds[1]))
    transform = from_bounds(*bounds, width, height)
    prepared = []
    for frame in frames:
        path = path_for(frame)
        rgb = np.zeros((3, height, width), dtype=np.uint8)
        with rasterio.open(path) as source:
            for band in range(3):
                reproject(rasterio.band(source, band + 1), rgb[band], src_transform=source.transform,
                          src_crs=source.crs, dst_transform=transform, dst_crs='EPSG:3857',
                          src_nodata=0, dst_nodata=0, resampling=Resampling.bilinear)
        year = frame['date'][:4]
        output = OUTPUT / f'annual-{year}.png'
        alpha = np.where(np.any(rgb != 0, axis=0), 255, 0).astype(np.uint8)
        Image.fromarray(np.dstack((rgb.transpose(1, 2, 0), alpha))).save(output)
        prepared.append({
            'id': frame['id'], 'date': frame['date'], 'image': output.name,
            'imageSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'inputSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'cachedInput': str(path.relative_to(ROOT)).replace('\\', '/'),
            'metadataUrl': frame['metadataUrl'], 'cloudCover': frame.get('cloudCover'),
            'platform': frame['platform'], 'sourceResolutionMeters': 10,
        })
    manifest = {
        'version': 1, 'scenario': 'aletsch', 'crs': 'EPSG:3857', 'bounds': list(bounds),
        'width': width, 'height': height, 'frames': prepared,
        'method': 'Real dated Sentinel-2 L2A RGB crops at 10 m source resolution, bilinearly reprojected onto one fixed grid. Transitions blend adjacent observed images; they are not new acquisitions or a glacier forecast.',
        'attribution': 'Contains modified Copernicus Sentinel data, 2018-2026; Microsoft Planetary Computer.',
    }
    (OUTPUT / 'annual.json').write_text(json.dumps(manifest, indent=2))
    print(f'Annual glacier sequence ready: {len(prepared)} real captures on one {width} x {height} grid', flush=True)


if __name__ == '__main__':
    prepare()
