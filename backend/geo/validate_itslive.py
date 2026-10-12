"""Compare a NISAR GOFF motion preview with independent NASA ITS_LIVE glacier speeds.

ITS_LIVE (optical/radar feature tracking, NASA MEaSUREs) is a separate measurement, so agreement is evidence and
disagreement is a finding. Only the glacier window of one granule is read (bounded range reads); the result is written
into the preview's `validation` block, never into the measured NISAR products.
"""
import argparse, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / '.python'))
import h5py
import numpy as np
import requests
from pyproj import Geod, Transformer
from public_range import PublicRangeReader

STAC = 'https://stac.itslive.cloud/search'
MAX_INTERVAL_DAYS = 48
MIN_VALID_PERCENT = 20
CANDIDATES = 40          # granules tried, best first, until one has enough resolvable cells
MIN_FOOTPRINT = 0.6      # share of the glacier's moving area a granule's own footprint must cover


def search(session, bbox, start, end, pages=8):
    """All granules for the window; the catalogue returns at most 200 per page, so follow its `next` links."""
    body = {'collections': ['itslive-granules'], 'bbox': bbox, 'datetime': f'{start}/{end}', 'limit': 200}
    features, request = [], {'method': 'POST', 'href': STAC, 'body': body}
    for _ in range(pages):
        response = session.post(request['href'], json=request.get('body'), timeout=60) if request['method'] == 'POST' else session.get(request['href'], timeout=60)
        response.raise_for_status()
        data = response.json()
        features += data.get('features', [])
        nxt = next((l for l in data.get('links', []) if l.get('rel') == 'next'), None)
        if not nxt or not data.get('features'): break
        request = {'method': nxt.get('method', 'GET').upper(), 'href': nxt['href'], 'body': {**body, **nxt['body']} if nxt.get('body') else None}
    return features


def overlap_days(a0, a1, b0, b1):
    day = lambda s: np.datetime64(s[:10])
    return max(0, int((min(day(a1), day(b1)) - max(day(a0), day(b0))).astype(int)))


def footprint_share(item, box):
    """Share of the moving-glacier box (west, south, east, north) inside the item's own lon/lat footprint."""
    w, s_, e, n = item['bbox'][:4] if len(item.get('bbox', [])) >= 4 else (0, 0, 0, 0)
    ix = max(0.0, min(e, box[2]) - max(w, box[0])); iy = max(0.0, min(n, box[3]) - max(s_, box[1]))
    return ix * iy / max((box[2] - box[0]) * (box[3] - box[1]), 1e-12)


def moving_box(preview):
    """Lon/lat box of the cells that carry a flow estimate."""
    (a, b, c), (d, e, f) = preview['grid']['lonLatAffine']
    cells = [dict(zip(preview['cellFields'], x)) for x in preview['cells']]
    cells = [x for x in cells if x['east'] is not None]
    col, row = np.array([x['col'] + .5 for x in cells]), np.array([x['row'] + .5 for x in cells])
    lon, lat = a + b * col + c * row, d + e * col + f * row
    return float(lon.min()), float(lat.min()), float(lon.max()), float(lat.max())


def candidates(features, start, end, box=None):
    """Short-interval granules covering the moving glacier, best temporal overlap first; ties go to more valid pixels."""
    good = [f for f in features if f['properties'].get('date_dt', 999) <= MAX_INTERVAL_DAYS and (f['properties'].get('percent_valid_pixels') or 0) >= MIN_VALID_PERCENT
            and f['assets'].get('data', {}).get('href', '').startswith('https://its-live-data.s3.amazonaws.com/')]
    good = [f for f in good if overlap_days(f['properties']['start_datetime'], f['properties']['end_datetime'], start, end) > 0 and (box is None or footprint_share(f, box) >= MIN_FOOTPRINT)]
    return sorted(good, key=lambda f: (-overlap_days(f['properties']['start_datetime'], f['properties']['end_datetime'], start, end), -(f['properties'].get('percent_valid_pixels') or 0)))[:CANDIDATES]


def decode(dataset, rows, cols):
    values = np.asarray(dataset[0, rows, cols] if dataset.ndim == 3 and dataset.shape[0] == 1 else dataset[rows, cols], dtype=float)
    values[values == dataset.attrs.get('_FillValue', -32767)] = np.nan
    return values * float(dataset.attrs.get('scale_factor', 1)) + float(dataset.attrs.get('add_offset', 0))


def read_window(session, item, west, south, east, north):
    reader = PublicRangeReader(session, item['assets']['data']['href'])
    epsg = int(item['properties']['proj:code'].split(':')[-1])
    to_xy = Transformer.from_crs(4326, epsg, always_xy=True).transform
    (a, b), (c, d) = to_xy(west, south), to_xy(east, north)
    with h5py.File(reader, 'r') as h:
        x, y = np.asarray(h['x']), np.asarray(h['y'])
        cols, rows = np.flatnonzero((x >= min(a, c) - 240) & (x <= max(a, c) + 240)), np.flatnonzero((y >= min(b, d) - 240) & (y <= max(b, d) + 240))
        if len(cols) < 2 or len(rows) < 2: raise ValueError('The ITS_LIVE granule does not cover the study area')
        window = (slice(rows.min(), rows.max() + 1), slice(cols.min(), cols.max() + 1))
        data = {k: decode(h[k], *window) for k in ('v', 'vx', 'vy')}
    return {'x': x[window[1]], 'y': y[window[0]], 'epsg': epsg, **data, 'transferredMiB': round(reader.transferred / 1024**2, 2)}


def compare(preview, granule):
    """NISAR flow cells against ITS_LIVE at the same ground positions (nearest 120 m cell)."""
    cells = [dict(zip(preview['cellFields'], c)) for c in preview['cells']]
    cells = [c for c in cells if c['east'] is not None and c['north'] is not None]
    (a, b, c_), (d, e, f) = preview['grid']['lonLatAffine']
    col, row = np.array([c['col'] + .5 for c in cells]), np.array([c['row'] + .5 for c in cells])
    lon, lat = a + b * col + c_ * row, d + e * col + f * row
    X, Y = Transformer.from_crs(4326, granule['epsg'], always_xy=True).transform(lon, lat)
    x, y = granule['x'], granule['y']
    dx, dy = x[1] - x[0], y[1] - y[0]
    j, i = np.rint((X - x[0]) / dx).astype(int), np.rint((Y - y[0]) / dy).astype(int)
    inside = (i >= 0) & (i < len(y)) & (j >= 0) & (j < len(x))
    i, j = np.clip(i, 0, len(y) - 1), np.clip(j, 0, len(x) - 1)
    its_v, its_x, its_y = (granule[k][i, j] / 365.25 for k in ('v', 'vx', 'vy'))   # m/yr to m/day, along the granule's own grid axes
    # Polar-stereographic grids (EPSG:3413) are rotated against east/north, so convert each vector to a true bearing.
    back = Transformer.from_crs(granule['epsg'], 4326, always_xy=True).transform
    length = np.maximum(np.hypot(its_x, its_y), 1e-9)
    lon2, lat2 = back(X + 100 * its_x / length, Y + 100 * its_y / length)
    azimuth = np.radians(Geod(ellps='WGS84').inv(lon, lat, lon2, lat2)[0])
    its_east, its_north = its_v * np.sin(azimuth), its_v * np.cos(azimuth)
    east, north = np.array([c['east'] for c in cells]), np.array([c['north'] for c in cells])
    ok = inside & np.isfinite(its_v) & np.isfinite(its_x) & np.isfinite(its_y) & np.isfinite(azimuth)
    nisar = np.hypot(east, north)
    if ok.sum() < 30: return {'cells': int(ok.sum()), 'verdict': 'Too few common cells to compare.'}
    rank = lambda v: np.argsort(np.argsort(v))
    angle = np.degrees(np.arccos(np.clip((east * its_east + north * its_north) / (nisar * its_v + 1e-12), -1, 1)))
    # NISAR cannot measure ice slower than about twice its own stable-rock noise floor, so the headline comparison
    # uses only cells where ITS_LIVE shows faster ice; the slow ice is reported separately, not hidden.
    threshold = max(0.5, 2 * float((preview.get('stableGround') or {}).get('noiseFloor', {}).get('speed') or 0))
    fast, slow = ok & (its_v >= threshold), ok & (its_v < threshold)
    moving = fast & (nisar > 0.1)
    edges, labels = [0, .5, 1, 3, 1e9], ['under 0.5', '0.5 to 1', '1 to 3', 'over 3']
    classes = []
    for lo, hi, label in zip(edges, edges[1:], labels):
        m = ok & (its_v >= lo) & (its_v < hi)
        if m.sum() >= 20: classes.append({'itsLiveMetresPerDay': label, 'cells': int(m.sum()), 'medianNisar': round(float(np.median(nisar[m])), 2), 'medianItsLive': round(float(np.median(its_v[m])), 2),
                                          'medianRatio': round(float(np.median(nisar[m] / its_v[m])), 2)})
    out = {'cells': int(ok.sum()), 'thresholdMetresPerDay': round(threshold, 2), 'resolvableCells': int(fast.sum()), 'bySpeed': classes,
           'slowIce': {'cells': int(slow.sum()), 'medianNisar': round(float(np.median(nisar[slow])), 2) if slow.any() else None, 'medianItsLive': round(float(np.median(its_v[slow])), 2) if slow.any() else None}}
    if fast.sum() >= 30:
        out.update(spearman=round(float(np.corrcoef(rank(nisar[fast]), rank(its_v[fast]))[0, 1]), 2), medianRatio=round(float(np.median(nisar[fast] / its_v[fast])), 2),
                   medianNisar=round(float(np.median(nisar[fast])), 2), medianItsLive=round(float(np.median(its_v[fast])), 2), medianAbsDifference=round(float(np.median(np.abs(nisar[fast] - its_v[fast]))), 2),
                   directionCells=int(moving.sum()), medianAngleDeg=round(float(np.median(angle[moving])), 1) if moving.any() else None,
                   within45Deg=round(float(np.mean(angle[moving] <= 45)), 3) if moving.any() else None)
    return out


def validate(output_dir):
    path = pathlib.Path(output_dir) / 'motion-preview.json'
    preview = json.loads(path.read_text(encoding='utf-8'))
    if preview.get('status') != 'flow': raise SystemExit('Only previews with a resolved flow direction are compared')
    start, end = preview['referenceDate'][:10], preview['secondaryDate'][:10]
    corners = np.array(preview['grid']['corners'])
    west, south, east, north = corners[:, 0].min(), corners[:, 1].min(), corners[:, 0].max(), corners[:, 1].max()
    session = requests.Session(); session.headers['User-Agent'] = 'SARscape'
    window = (str(np.datetime64(start) - np.timedelta64(40, 'D')) + 'T00:00:00Z', str(np.datetime64(end) + np.timedelta64(40, 'D')) + 'T23:59:59Z')
    best = None
    for item in candidates(search(session, [west, south, east, north], *window), start, end, moving_box(preview)):
        for attempt in range(3):                      # S3 occasionally drops a connection; retry before giving up on a granule
            try:
                granule = read_window(session, item, west, south, east, north)
                outcome = compare(preview, granule)
                break
            except (ValueError, KeyError, OSError, requests.RequestException) as error:
                print(f"Skipped {item['id'][:40]} (attempt {attempt + 1}): {type(error).__name__}", file=sys.stderr)
        else:
            continue
        if outcome.get('resolvableCells', 0) >= 2000: best = (item, granule, outcome); break   # candidates are ordered by overlap
    if best is None: raise SystemExit('No ITS_LIVE granule with enough valid, resolvable cells over this glacier near these dates')
    item, granule, outcome = best
    p = item['properties']
    result = {'source': 'NASA MEaSUREs ITS_LIVE (feature tracking), read through the public STAC catalogue', 'granule': item['id'], 'platform': p.get('platform'),
              'start': p['start_datetime'][:10], 'end': p['end_datetime'][:10], 'intervalDays': p['date_dt'], 'overlapDays': overlap_days(p['start_datetime'], p['end_datetime'], start, end),
              'nisarInterval': [start, end], 'transferredMiB': granule['transferredMiB'], **outcome,
              'caveat': 'The two products average different periods and use different methods; seasonal speed changes alone can explain a ratio different from 1. This is a consistency check, not a calibration.'}
    preview['validation'] = result
    path.write_text(json.dumps(preview, allow_nan=False), encoding='utf-8')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True, help='Processed GOFF directory containing motion-preview.json')
    print(json.dumps(validate(parser.parse_args().output_dir), indent=1))
