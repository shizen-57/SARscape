"""Prepare small real NISAR datasets and register them for the existing map."""
import argparse
import datetime as dt
import getpass
import hashlib
import json
import os
import pathlib
import sqlite3
import sys
import uuid
from contextlib import nullcontext

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/.python'))
import h5py
import numpy as np
from pyproj import CRS, Transformer
from goff import process as process_goff, text
from nisar_range import RangeReader

SCENARIO = 'aletsch'
BBOX = next(s['extent'] for s in json.loads((ROOT / 'database/scenarios.json').read_text())['scenarios'] if s['id'] == SCENARIO)
CATALOG = ROOT / 'data/aletsch-download-catalog.json'
DATES = ('2026-09-11', '2026-09-23', '2026-10-05')


def now(): return dt.datetime.now(dt.timezone.utc).isoformat()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, allow_nan=False), encoding='utf-8')
    temporary.replace(path)


def database():
    connection = sqlite3.connect(ROOT / 'database/sarscape.sqlite', timeout=60)
    connection.execute('PRAGMA foreign_keys=ON')
    connection.execute('PRAGMA journal_mode=WAL')
    connection.executescript((ROOT / 'database/migrations/002_nisar.sql').read_text())
    return connection


def source_record(item):
    p = item['feature']['properties']
    url = p['url']
    filename = url.rsplit('/', 1)[-1]
    size = p.get('bytes')
    if isinstance(size, dict): size = size.get(filename, {}).get('bytes')
    return {'id': filename.removesuffix('.h5'), 'filename': filename, 'url': url,
            'size': int(size or 0), 'product': item.get('kind') or p.get('processingLevel'),
            'start': p.get('startTime'), 'stop': p.get('stopTime'), 'metadata': p}


def discover_sources(start, end):
    import asf_search as asf
    w, s, e, n = BBOX
    polygon = f'POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))'
    features = {}
    # The official client follows CMR-Search-After; no result cap or date partitioning.
    for page in asf.search_generator(platform=asf.PLATFORM.NISAR, intersectsWith=polygon, start=start, end=end):
        for product in page:
            if str(product.properties.get('fileID', '')).startswith('NISAR_'):
                features[product.properties['fileID']] = product.geojson()
        print(f'Catalogued {len(features)} NISAR source records…', flush=True)
    return list(features.values())


def catalogue(connection, refresh=False):
    if refresh or not CATALOG.exists():
        features = discover_sources(dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc), dt.datetime.now(dt.timezone.utc))
        compact = []
        keys = ('fileID', 'processingLevel', 'url', 'startTime', 'stopTime', 'sceneName', 'flightDirection',
                'pathNumber', 'frameNumber', 'productionConfiguration', 'dataMaturity', 'mainBandPolarization',
                'sideBandPolarization', 'productVersion', 'crid', 'collectionName', 'fileName')
        for feature in features:
            properties = feature['properties']
            record = source_record({'feature': feature})
            compact.append({'kind': record['product'], 'feature': {'type': 'Feature',
                           'properties': {**{key: properties[key] for key in keys if key in properties}, 'bytes': record['size']}}})
        write_json(CATALOG, {'source': 'ASF NISAR Search API', 'retrievedAt': now(), 'bbox': BBOX, 'products': compact})
    records = [source_record(item) for item in json.loads(CATALOG.read_text())['products']]
    for record in records:
        connection.execute('INSERT INTO nisar_sources VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(scenario,granule_id) DO UPDATE SET product=excluded.product,start_date=excluded.start_date,stop_date=excluded.stop_date,source_url=excluded.source_url,source_bytes=excluded.source_bytes,metadata_json=excluded.metadata_json,discovered_at=excluded.discovered_at',
                           (SCENARIO, record['id'], record['product'], record['start'], record['stop'], record['url'], record['size'], json.dumps(record['metadata']), now()))
    connection.commit()
    return records


def login(credentials_stdin=False):
    import earthaccess
    previous = {key: os.environ.get(key) for key in ('EARTHDATA_USERNAME', 'EARTHDATA_PASSWORD')}
    if credentials_stdin:
        credentials = json.loads(sys.stdin.readline())
        os.environ['EARTHDATA_USERNAME'] = credentials['username']
        os.environ['EARTHDATA_PASSWORD'] = credentials['password']
        del credentials
    elif not all(previous.values()):
        os.environ['EARTHDATA_USERNAME'] = input('Earthdata username: ')
        os.environ['EARTHDATA_PASSWORD'] = getpass.getpass('Earthdata password (not saved): ')
    try:
        auth = earthaccess.login(strategy='environment', persist=False)
        if not auth.authenticated: raise ValueError('Earthdata authentication failed')
        return earthaccess.get_requests_https_session()
    finally:
        for key, value in previous.items():
            if value is None: os.environ.pop(key, None)
            else: os.environ[key] = value


def copy_dataset(source, target, name, selection=None):
    dataset = source[name]
    values = dataset[()] if selection is None else dataset[selection]
    options = {'compression': 'gzip', 'shuffle': True} if np.ndim(values) == 2 else {}
    copied = target.create_dataset(name, data=values, **options)
    for key, value in dataset.attrs.items():
        if key not in ('DIMENSION_LIST', 'REFERENCE_LIST', 'min_value', 'max_value', 'mean_value', 'sample_stddev'):
            copied.attrs[key] = value


def crop(source, destination, record):
    with h5py.File(source, 'r') as original, h5py.File(destination, 'w') as subset:
        identity = original['science/LSAR/identification']
        product = text(identity['productType'][()])
        if text(identity['missionId'][()]) != 'NISAR' or product != record['product']:
            raise ValueError('The source identity does not match the selected product')
        if 'granuleId' in identity and text(identity['granuleId'][()]).removesuffix('.h5') != record['id']:
            raise ValueError('The source granule does not match the catalogue')
        identification = subset.create_group('science/LSAR/identification')
        for name, dataset in identity.items():
            if isinstance(dataset, h5py.Dataset) and dataset.size * dataset.dtype.itemsize <= 1024**2:
                copy_dataset(identity, identification, name)
        grid_path = 'science/LSAR/' + product + '/grids/frequencyA'
        if product == 'GOFF': grid_path += '/pixelOffsets/HH/layer1'
        grid = original[grid_path]
        x, y = grid['xCoordinates'][:], grid['yCoordinates'][:]
        if len(x) < 2 or len(y) < 2: raise ValueError('The product coordinate grid is empty')
        dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
        crs = CRS.from_epsg(int(grid['projection'][()]))
        if not crs.is_projected or dx <= 0 or dy >= 0 or not np.allclose(np.diff(x), dx) or not np.allclose(np.diff(y), dy):
            raise ValueError('Unsupported science grid')
        west, south, east, north = Transformer.from_crs(4326, crs, always_xy=True).transform_bounds(*BBOX, densify_pts=21)
        columns = np.flatnonzero((x + dx/2 >= west) & (x - dx/2 <= east))
        rows = np.flatnonzero((y + abs(dy)/2 >= south) & (y - abs(dy)/2 <= north))
        if len(columns) < 2 or len(rows) < 2: raise ValueError('The science product does not cover Aletsch')
        window = np.s_[rows[0]:rows[-1]+1, columns[0]:columns[-1]+1]
        output_grid = subset.require_group(grid_path)
        copy_dataset(grid, output_grid, 'xCoordinates', np.s_[columns[0]:columns[-1]+1])
        copy_dataset(grid, output_grid, 'yCoordinates', np.s_[rows[0]:rows[-1]+1])
        copy_dataset(grid, output_grid, 'projection')
        if product == 'GOFF':
            names = ['alongTrackOffset', 'slantRangeOffset', 'alongTrackOffsetVariance', 'slantRangeOffsetVariance', 'correlationSurfacePeak']
            parent_path = 'science/LSAR/GOFF/grids/frequencyA/pixelOffsets'
            extras = [(parent_path, 'mask'), (parent_path + '/HH', 'validDataMask')]
        else:
            names = ['HHHH', 'HVHV', 'mask']
            names += [name for name in ('numberOfLooks', 'inputDataExceptionMask') if name in grid]
            extras = []
        for name in names:
            if grid[name].shape != (len(y), len(x)): raise ValueError('Mismatched science array')
            copy_dataset(grid, output_grid, name, window)
        for group_path, name in extras:
            group = original[group_path]
            if name not in group:
                if name == 'mask': raise ValueError('Required source mask is missing')
                continue
            if group[name].shape != (len(y), len(x)): raise ValueError('Mismatched science mask')
            copy_dataset(group, subset.require_group(group_path), name, window)
        subset.attrs['regionalSubset'] = True
        subset.attrs['sourceGranuleId'] = record['id']
        subset.attrs['boundingBoxWGS84'] = BBOX
        return {'epsg': crs.to_epsg(), 'shape': [len(rows), len(columns)], 'postingMetres': [dx, abs(dy)]}


def subset_file(record, key, session, budget):
    destination = ROOT / 'data/subsets' / (key + '.h5')
    sidecar = destination.with_suffix('.source.json')
    if destination.exists() and sidecar.exists():
        meta = json.loads(sidecar.read_text())
        digest = hashlib.sha256(destination.read_bytes()).hexdigest()
        if meta.get('sourceGranuleId') == record['id'] and meta.get('boundingBoxWGS84') == BBOX and digest == meta.get('subsetSha256'):
            return destination, meta, 0
        raise ValueError('Cached subset failed its identity or checksum check')
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix('.part')
    local = ROOT / 'data' / record['filename']
    reader = None if local.exists() and local.stat().st_size == record['size'] else RangeReader(session, record['url'], record['size'], budget)
    try:
        with (nullcontext(local) if reader is None else reader) as source:
            grid = crop(source, temporary, record)
            transferred = reader.transferred if reader else 0
            meta = {'sourceGranuleId': record['id'], 'sourceUrl': record['url'], 'sourceBytes': record['size'],
                    'product': record['product'], 'boundingBoxWGS84': BBOX, 'transferredBytes': transferred,
                    'rangeRequests': reader.requests if reader else 0, 'sourceETag': reader.etag if reader else None,
                    'sourceAccess': 'existing-local-file' if reader is None else 'authenticated-https-ranges',
                    'subsetSha256': hashlib.sha256(temporary.read_bytes()).hexdigest(),
                    'subsetBytes': temporary.stat().st_size, 'createdAt': now(), **grid}
        temporary.replace(destination)
        write_json(sidecar, meta)
        return destination, meta, transferred
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def cached_product(connection, record, key):
    row = connection.execute('SELECT status,provenance_json,output_path,subset_path,subset_sha256 FROM nisar_subsets WHERE id=?', (key,)).fetchone()
    if not row or row[0] != 'complete': return None
    source, output = ROOT / row[3], ROOT / row[2]
    filenames = ('samples.geojson', 'provenance.json', 'radar-components.tif', 'radar-preview.tif') if record['product'] == 'GOFF' else ('gcov-context.png', 'gcov-backscatter.tif', 'gcov-provenance.json')
    if not source.exists() or not all((output / name).is_file() and (output / name).stat().st_size > 0 for name in filenames): return None
    if hashlib.sha256(source.read_bytes()).hexdigest() != row[4]: raise ValueError('Cached subset checksum failed')
    return json.loads(row[1])


def prepare(connection, record, session, budget):
    key = str(uuid.uuid5(uuid.NAMESPACE_URL, record['id'] + json.dumps(BBOX) + ':A:HH:layer1:v1'))
    cached = cached_product(connection, record, key)
    if cached:
        print(f"Cached {record['product']} {record['start'][:10]}", flush=True)
        return cached, 0
    print(f"Preparing {record['product']} {record['start'][:10]} regional data…", flush=True)
    source, subset_meta, transferred = subset_file(record, key, session, budget)
    output = ROOT / 'database/processed' / record['product'].lower() / key
    if record['product'] == 'GOFF':
        provenance = process_goff(source, output, SCENARIO)
        provenance['sourceSubset'] = subset_meta
        provenance['sha256Scope'] = 'regional subset, not the original whole granule'
        write_json(output / 'provenance.json', provenance)
        write_json(ROOT / 'database/jobs' / (key + '.json'), {'id': key, 'scenario': SCENARIO, 'status': 'complete',
                   'createdAt': now(), 'updatedAt': now(), 'frequency': 'A', 'polarization': 'HH', 'layer': 'layer1',
                   'correlation': .3, 'bytes': subset_meta['subsetBytes'], 'provenance': provenance})
    else:
        from gcov import process as process_gcov
        provenance = process_gcov(source, output, SCENARIO)
    provenance['id'] = key
    connection.execute('INSERT OR REPLACE INTO nisar_subsets VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                       (key, SCENARIO, record['id'], 'complete', str(source.relative_to(ROOT)), str(output.relative_to(ROOT)),
                        subset_meta['transferredBytes'], subset_meta['subsetBytes'], subset_meta['subsetSha256'], json.dumps(provenance), now()))
    connection.commit()
    print(f"Prepared {record['product']} {record['start'][:10]}: {transferred / 1024**2:.1f} MiB transferred; {subset_meta['subsetBytes'] / 1024**2:.1f} MiB saved", flush=True)
    return provenance, transferred


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='Catalogue all Aletsch NISAR products from ASF')
    parser.add_argument('--catalog-only', action='store_true')
    parser.add_argument('--all-dates', action='store_true', help='Prepare every matching track-072 ascending GOFF/GCOV date')
    parser.add_argument('--max-mib', type=int, default=128, help='Hard science transfer limit per source')
    parser.add_argument('--credentials-stdin', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if not 1 <= args.max_mib <= 512: parser.error('max-mib must be between 1 and 512')
    with database() as connection:
        records = catalogue(connection, args.refresh)
        print(f'Catalogue saved: {len(records)} NISAR sources in database/sarscape.sqlite', flush=True)
        if args.catalog_only: return
        selected = [r for r in records if r['product'] in ('GOFF', 'GCOV') and r['id'].startswith('NISAR_L2_PR_')
                    and f"/NISAR_L2_{r['product']}_PROVISIONAL_V1/" in r['url'] and '_072_A_025_' in r['id']
                    and ('_4005_DHDH_' in r['id'] if r['product'] == 'GCOV' else '_4000_SH_' in r['id'])
                    and (args.all_dates or (r['start'] or '')[:10] in DATES[:2] or (r['product'] == 'GCOV' and (r['start'] or '')[:10] == DATES[2]))]
        if not selected: raise ValueError('No matching Aletsch GOFF/GCOV sources were found')
        selected.sort(key=lambda r: (r['product'], r['start']))
        session, transferred, observations = None, 0, []
        try:
            for record in selected:
                key = str(uuid.uuid5(uuid.NAMESPACE_URL, record['id'] + json.dumps(BBOX) + ':A:HH:layer1:v1'))
                local = ROOT / 'data' / record['filename']
                already_processed = cached_product(connection, record, key) is not None
                subset = ROOT / 'data/subsets' / (key + '.h5')
                already_cropped = subset.exists() and subset.with_suffix('.source.json').exists()
                local_complete = local.exists() and local.stat().st_size == record['size']
                if not session and not already_processed and not local_complete and not already_cropped:
                    session = login(args.credentials_stdin)
                if transferred >= 512 * 1024**2: raise ValueError('Run reached its 512 MiB science transfer limit')
                provenance, fetched = prepare(connection, record, session, min(args.max_mib * 1024**2, 512 * 1024**2 - transferred))
                transferred += fetched
                if record['product'] == 'GCOV':
                    observations.append(provenance)
                    manifest = ROOT / 'database/processed/gcov/manifest.json'
                    previous = json.loads(manifest.read_text()).get('observations', []) if manifest.exists() else []
                    merged = {item['id']: item for item in previous + observations}
                    write_json(manifest, {'observations': sorted(merged.values(), key=lambda item: item.get('acquisitionDate', ''))})
        finally:
            if session: session.close()
        print(f'Ready: {len(selected)} products; {transferred / 1024**2:.1f} MiB transferred this run. Start the project to view them.', flush=True)


if __name__ == '__main__':
    try: main()
    except Exception as error:
        # Third-party request errors can include signed URLs; do not log them.
        message = str(error) if isinstance(error, ValueError) else f'Data preparation failed ({type(error).__name__})'
        print(message, file=sys.stderr)
        sys.exit(1)
