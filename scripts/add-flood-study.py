"""Register the curated Manchar flood captures from an Earth Search STAC response.

Run after saving /v1/search metadata to data/flood-search.json. No full scenes download.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
items = json.loads((ROOT / 'data/flood-search.json').read_text(encoding='utf-8-sig'))['features']
captures = [
    ('S2B_42RUQ_20220627_0_L2A', 'Before flooding'),
    ('S2A_42RUQ_20220831_0_L2A', 'Flood expansion'),
    ('S2A_42RUQ_20220910_0_L2A', 'Widespread inundation'),
    ('S2B_42RUQ_20221114_0_L2A', 'Later observation'),
]
frames = []
for scene_id, label in captures:
    item = next(i for i in items if i['id'] == scene_id)
    frames.append(dict(id=scene_id, date=item['properties']['datetime'],
        label=label, cloudCover=item['properties']['eo:cloud_cover'],
        url=item['assets']['visual']['href'],
        metadataUrl=f'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/{scene_id}',
        collection='sentinel-2-l2a', platform=item['properties']['platform'],
        resolutionMeters=10, bbox=item['bbox']))

path = ROOT / 'database/imagery/sentinel2.json'
manifest = json.loads(path.read_text(encoding='utf-8-sig'))
manifest['scenarios']['manchar'] = frames
manifest.setdefault('studyMetadata', {})['manchar'] = dict(
    source='Copernicus Sentinel-2 L2A / Element 84 Earth Search',
    retrievedAt='2026-10-10',
    selection='Four dated natural-colour captures of the 2022 Manchar Lake flood. Scene cloud cover is not a local cloud mask. Playback steps between observations; no daily flood simulation or water-depth measurement.',
    eventUrl='https://science.nasa.gov/earth/earth-observatory/lake-manchar-is-overflowing-150306/')
path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
path = ROOT / 'database/scenarios.json'
config = json.loads(path.read_text(encoding='utf-8-sig'))
scenario = dict(id='manchar', name='Manchar Lake Flood', country='Sindh, Pakistan',
    center=[67.69, 26.49], zoom=10.8, bearing=0, pitch=35, kind='flood',
    title='Watch the floodplain change', subtitle='Real satellite captures of the 2022 flood.',
    unit='', metric='Observed surface appearance', product='Sentinel-2 L2A',
    explanation='Natural-colour satellite observations reveal water spreading across the floodplain. These images do not measure water depth. Historical 2022 imagery is Sentinel-2, not NISAR.',
    extent=[67.48, 26.29, 67.90, 26.73], imageryExtent=[67.48, 26.29, 67.90, 26.73], path=[])
config['scenarios'] = [s for s in config['scenarios'] if s['id'] != 'manchar'] + [scenario]
path.write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
print('Registered Manchar flood study with four dated Sentinel-2 captures.')
