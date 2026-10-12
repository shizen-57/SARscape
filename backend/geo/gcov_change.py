"""NISAR GCOV change on a glacier: how the glacier's radar brightness responds to weather.

Measured: terrain-corrected HH/HV gamma0 (GCOV) on each real acquisition date.
Derived here: 50 m medians; the glacier relative to high bare rock (valley meadows and forest also react
to rain, rock above 2,400 m much less); each date's anomaly against its own track's season; storms from
ERA5 weather; and the glacier's response on the first images after each storm. Tracks are never mixed in
one difference because their viewing geometry differs.
"""
import json, math, pathlib, sys, warnings, zipfile
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / '.python'))
import numpy as np
import rasterio
import shapely
from PIL import Image
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.transform import from_origin
from rasterio.warp import reproject

ROOT = pathlib.Path(__file__).resolve().parents[2]
GCOV = ROOT / 'database/processed/gcov'
OUT = GCOV / 'change'
CELL = 50.0                      # analysis cell (m): 5×5 GCOV pixels, speckle averaged in linear power
WORLD = 20037508.342789244
BANDS = list(range(1600, 4000, 200))
ROCK_MIN = 2400                  # m: high bare rock is the reference surface
EVENT_MM, EVENT_SNOW = 15.0, 2.0 # a day with this much precipitation (mm) or snow (cm) at Konkordia is a storm
RESPONSE_DAYS = 10               # the first image within this many days after a storm is its response
LIMITS = ['Radar brightness change is not a measurement of melt, mass loss or thinning.',
          'Tracks view the glacier from different directions, so each track is compared only with itself.',
          'Weather is ERA5 reanalysis (about 25 km cells) adjusted to two glacier elevations, not station data.',
          'Eight dates per track over one summer: a pattern, not a long-term trend.',
          'The glacier outline is from 2017; the 2026 margins and terminus have retreated.']
RULES = {'tracksAgree': 'At least two tracks show the glacier darker than usual on their first image after the storm.',
         'beatsNoise': 'The median darkening is at least twice the typical anomaly on dry dates (under 10 mm of rain in 3 days, no snow in 7), and at least 0.3 dB.',
         'fitsWeather': 'The glacier is darker after a wet storm, as expected for wet fresh snow, and brighter again on the next image of most tracks.',
         'spatiallyCoherent': 'At least 60% of glacier cells darkened between the last image before and the first image after the storm.'}
# Darker (often wetter) is blue, brighter is orange; a fixed ±4 dB range for every map.
DIFF_STOPS = [(-4, (33, 102, 172)), (-1.5, (103, 169, 207)), (0, (247, 247, 247)), (1.5, (244, 165, 130)), (4, (178, 24, 43))]


def stamp(o):
    i = o.get('identification', {})
    return f"{i.get('trackNumber', '?')}{(i.get('orbitPassDirection') or '?')[0]}"


def analysis_grid(tif):
    w, s, e, n = tif.bounds
    width, height = int((e - w) // CELL), int((n - s) // CELL)
    return from_origin(w, n, CELL, CELL), (height, width)


def coarse_db(tif, band, transform, shape_):
    """Average linear power into CELL blocks, then convert to dB."""
    out = np.full(shape_, np.nan, np.float32)
    linear = 10 ** (tif.read(band).astype(np.float32) / 10)
    reproject(linear, out, src_transform=tif.transform, src_crs=tif.crs, src_nodata=np.nan, dst_transform=transform,
              dst_crs=tif.crs, dst_nodata=np.nan, resampling=Resampling.average)
    with np.errstate(divide='ignore', invalid='ignore'):
        return 10 * np.log10(out)


def dem(transform, shape_, crs, cache=ROOT / 'data/terrain/mapterhorn-z12'):
    """Mapterhorn Terrarium tiles (the same terrain the 3D map draws), resampled to any grid."""
    to_ll = Transformer.from_crs(crs, 4326, always_xy=True)
    h, w = shape_
    corners = [transform * (c, r) for c, r in ((0, 0), (w, 0), (0, h), (w, h))]
    lon, lat = to_ll.transform([c[0] for c in corners], [c[1] for c in corners])
    z, n = 12, 2 ** 12
    tx = lambda v: int((v + 180) / 360 * n)
    ty = lambda v: int((1 - math.asinh(math.tan(math.radians(v))) / math.pi) / 2 * n)
    x0, x1, y0, y1 = tx(min(lon)), tx(max(lon)), ty(max(lat)), ty(min(lat))
    cache.mkdir(parents=True, exist_ok=True)

    def tile(xy):
        path = cache / f'{xy[0]}_{xy[1]}.webp'
        if not path.exists():
            with urlopen(Request(f'https://tiles.mapterhorn.com/{z}/{xy[0]}/{xy[1]}.webp', headers={'User-Agent': 'SARscape'}), timeout=30) as r:
                path.write_bytes(r.read())
        rgb = np.asarray(Image.open(path).convert('RGB'), np.float64)
        return xy, rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768

    mosaic = np.zeros(((y1 - y0 + 1) * 512, (x1 - x0 + 1) * 512), np.float32)
    with ThreadPoolExecutor(6) as pool:
        for (x, y), e in pool.map(tile, [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]):
            mosaic[(y - y0) * 512:(y - y0 + 1) * 512, (x - x0) * 512:(x - x0 + 1) * 512] = e
    size = 2 * WORLD / n
    out = np.full(shape_, np.nan, np.float32)
    reproject(mosaic, out, src_transform=from_origin(-WORLD + x0 * size, WORLD - y0 * size, size / 512, size / 512), src_crs='EPSG:3857',
              dst_transform=transform, dst_crs=crs, resampling=Resampling.bilinear)
    return out


def glacier_masks(transform, shape_, crs, archive=ROOT / 'data/sgi2016/inventory_sgi2016_r2020.zip'):
    """Great Aletsch (SGI B36-26), and terrain more than 100 m from any SGI2016 glacier."""
    from aletsch_outline import dbf_records, shp_polygons
    with zipfile.ZipFile(archive) as z:
        records = list(dbf_records(z.read('SGI_2016_glaciers.dbf')))
        polygons = list(shp_polygons(z.read('SGI_2016_glaciers.shp')))
    to_grid = Transformer.from_crs(2056, crs, always_xy=True)
    move = lambda g: shapely.transform(g, lambda c: np.column_stack(to_grid.transform(c[:, 0], c[:, 1])))
    aletsch = [move(g) for r, g in zip(records, polygons) if r['sgi-id'] == 'B36-26']
    other = [move(g) for r, g in zip(records, polygons) if r['sgi-id'] != 'B36-26']
    burn = lambda geoms, buffer: rasterize([(g.buffer(buffer), 1) for g in geoms], out_shape=shape_, transform=transform, fill=0).astype(bool)
    return burn(aletsch, -CELL / 2), ~burn(aletsch + other, 2 * CELL)


def weather(start, end, points=(('tongue', 46.43, 8.04, 2100), ('konkordia', 46.50, 8.05, 2750))):
    """Daily ERA5 reanalysis via Open-Meteo, downscaled to each point's elevation."""
    out = {}
    for name, lat, lon, elevation in points:
        url = (f'https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&elevation={elevation}'
               f'&start_date={start}&end_date={end}&daily=temperature_2m_mean,temperature_2m_max,snowfall_sum,precipitation_sum&timezone=UTC')
        with urlopen(Request(url, headers={'User-Agent': 'SARscape'}), timeout=60) as r:
            data = json.loads(r.read())
        out[name] = {'elevationMetres': elevation, 'latitude': lat, 'longitude': lon, **data['daily']}
    return out


def median_db(values, mask):
    v = values[mask & np.isfinite(values)]
    return float(10 * np.log10(np.median(10 ** (v / 10)))) if v.size else None


def diff_image(delta, glacier):
    values = np.clip(np.nan_to_num(delta), DIFF_STOPS[0][0], DIFF_STOPS[-1][0])
    xs = [s[0] for s in DIFF_STOPS]
    rgb = np.stack([np.interp(values, xs, [s[1][k] for s in DIFF_STOPS]) for k in range(3)], -1).astype(np.uint8)
    alpha = np.where(glacier & np.isfinite(delta), 235, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, alpha]))


def track_label(key):
    return f"Track {key[:-1]} {'ascending' if key.endswith('A') else 'descending'}"


def days_between(a, b):
    return int((np.datetime64(b) - np.datetime64(a)).astype(int))


def recent(daily, date):
    """Konkordia weather leading up to an image: mean temperature and precipitation over 3 days, snow over 7."""
    k = daily['konkordia']
    idx = [i for i, t in enumerate(k['time']) if t <= date]
    pick = lambda key, n: [k[key][i] or 0 for i in idx[-n:]]
    return {'temperature3dC': round(float(np.mean(pick('temperature_2m_mean', 3))), 1), 'precipitation3dMm': round(sum(pick('precipitation_sum', 3)), 1),
            'snowfall7dCm': round(sum(pick('snowfall_sum', 7)), 1)}


def storms(daily):
    """Runs of consecutive storm days at Konkordia, with their totals."""
    k = daily['konkordia']
    stormy = [i for i, _ in enumerate(k['time']) if (k['precipitation_sum'][i] or 0) >= EVENT_MM or (k['snowfall_sum'][i] or 0) >= EVENT_SNOW]
    runs = []
    for i in stormy:
        if runs and i - runs[-1][1] <= 1: runs[-1][1] = i
        else: runs.append([i, i])
    total = lambda key, a, b: round(sum(k[key][j] or 0 for j in range(a, b + 1)), 1)
    return [{'from': k['time'][a], 'to': k['time'][b], 'precipitationMm': total('precipitation_sum', a, b), 'snowfallCm': total('snowfall_sum', a, b)} for a, b in runs]


def rank_correlation(x, y):
    rank = lambda v: np.argsort(np.argsort(v))
    return round(float(np.corrcoef(rank(np.asarray(x)), rank(np.asarray(y)))[0, 1]), 2) if len(x) > 2 else None


def build(scenario='aletsch'):
    extent = next(s['extent'] for s in json.loads((ROOT / 'database/scenarios.json').read_text())['scenarios'] if s['id'] == scenario)
    observations = sorted((o for o in json.loads((GCOV / 'manifest.json').read_text())['observations']
                           if o.get('scenario') == scenario and o.get('studyAreaExtent') == extent), key=lambda o: o['acquisitionDate'])
    if len(observations) < 2: raise SystemExit('Need at least two prepared GCOV dates')
    with rasterio.open(GCOV / observations[0]['id'] / 'gcov-backscatter.tif') as tif:
        transform, shape_ = analysis_grid(tif); crs = tif.crs
    glacier, terrain = glacier_masks(transform, shape_, crs)
    height = dem(transform, shape_, crs)
    rock = terrain & (height >= ROCK_MIN)
    bands = [(b, glacier & (height >= b) & (height < b + 200)) for b in BANDS]
    bands = [(b, m) for b, m in bands if m.sum() >= 30]
    dates = [o['acquisitionDate'][:10] for o in observations]
    daily = weather((np.datetime64(dates[0]) - np.timedelta64(14, 'D')).astype(str), dates[-1])
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('diff-*.png'): old.unlink()
    tracks = {}
    for o in observations:
        with rasterio.open(GCOV / o['id'] / 'gcov-backscatter.tif') as tif:
            tracks.setdefault(stamp(o), []).append((o, coarse_db(tif, 1, transform, shape_)))
    summary_tracks, steps = [], []
    for key, series in tracks.items():
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', RuntimeWarning)
            seasonal = 10 * np.log10(np.nanmedian(10 ** (np.stack([hh for _, hh in series]) / 10), axis=0))
        records = []
        for o, hh in series:
            relative, date = hh - seasonal, o['acquisitionDate'][:10]
            g, r = median_db(hh, glacier), median_db(hh, rock)
            records.append({'date': date, 'observationId': o['id'], 'glacierHH': round(g, 2), 'rockHH': round(r, 2), 'contrastDb': round(g - r, 2), 'recent': recent(daily, date),
                            'bands': [round(float(np.nanmedian(relative[m])), 2) if np.isfinite(relative[m]).any() else None for _, m in bands]})
        middle = float(np.median([r['contrastDb'] for r in records]))
        for r in records: r['anomalyDb'] = round(r['contrastDb'] - middle, 2)
        for (_, a), (_, b), r1, r2 in zip(series, series[1:], records, records[1:]):
            rock_change = r2['rockHH'] - r1['rockHH']
            cells = (b - a) - rock_change
            finite = glacier & np.isfinite(cells)
            file = f"diff-{key}-{r1['date']}-{r2['date']}.png"
            diff_image(cells, glacier).save(OUT / file, optimize=True)
            steps.append({'track': key, 'from': r1['date'], 'to': r2['date'], 'days': days_between(r1['date'], r2['date']),
                          'glacierChangeDb': round(r2['glacierHH'] - r1['glacierHH'], 2), 'rockChangeDb': round(rock_change, 2), 'relativeChangeDb': round(r2['contrastDb'] - r1['contrastDb'], 2),
                          'darkerFraction': round(float(np.mean(cells[finite] < 0)), 3) if finite.any() else None,
                          'bands': [round(float(np.nanmedian(cells[m])), 2) if np.isfinite(cells[m]).any() else None for _, m in bands], 'file': file})
        summary_tracks.append({'id': key, 'label': track_label(key), 'medianContrastDb': round(middle, 2), 'dates': records,
                               'precipitationCorrelation': rank_correlation([r['anomalyDb'] for r in records], [r['recent']['precipitation3dMm'] for r in records])})
    dry = [abs(r['anomalyDb']) for t in summary_tracks for r in t['dates'] if r['recent']['precipitation3dMm'] < 10 and r['recent']['snowfall7dCm'] == 0]
    noise = float(np.median(dry)) if dry else 0.3
    threshold = max(0.3, 2 * noise)
    correlations = {t['id']: t['precipitationCorrelation'] for t in summary_tracks}
    negative = sum(1 for v in correlations.values() if v is not None and v < 0)
    pattern = {'statement': f'Across all {len(dates)} dates, the glacier is radar-darker relative to high rock after wetter days on {negative} of {len(summary_tracks)} tracks.',
               'correlations': correlations,
               'meaning': ("Rank correlation between each date's anomaly and the precipitation of the 3 days before it; negative means darker after rain or snow. "
                           'Eight dates per track is too few for any single value to be significant; agreement of the signs is the evidence.')}
    events = storms(daily)
    findings = assess(events, summary_tracks, steps, threshold, [b for b, _ in bands])
    for old in OUT.glob('optical-*.webp'): old.unlink()
    from cloud_compare import attach
    attach(findings, observations, extent, OUT)
    to_ll = Transformer.from_crs(crs, 4326, always_xy=True)
    h, w = shape_
    corners = [list(to_ll.transform(*(transform * (x, y)))) for x, y in ((0, 0), (w, 0), (w, h), (0, h))]
    summary = {'version': 2, 'scenario': scenario, 'generatedAt': str(np.datetime64('now')) + 'Z', 'validated': False,
               'measured': 'NISAR GCOV terrain-corrected HH backscatter (gamma0) on each real acquisition date',
               'derived': f"{CELL:.0f} m medians; glacier relative to high rock; anomaly against each track's own season; response on the first images after each storm",
               'grid': {'epsg': crs.to_epsg(), 'cellMetres': CELL, 'shape': [h, w], 'corners': corners},
               'masks': {'glacier': 'SGI2016 Grosser Aletschgletscher (B36-26), shrunk by 25 m',
                         'rock': f'Non-glacier terrain above {ROCK_MIN:,} m and more than 100 m from any SGI2016 glacier (bare rock and scree)'},
               'elevation': {'source': 'Mapterhorn terrain tiles (zoom 12), the same terrain the 3D map draws', 'bandMetres': 200, 'bands': [b for b, _ in bands]},
               'weather': {'source': 'ERA5 reanalysis via the Open-Meteo archive API (CC BY 4.0), adjusted to point elevation', 'points': daily, 'storms': events,
                           'stormRule': f'A day with at least {EVENT_MM:g} mm of precipitation or {EVENT_SNOW:g} cm of snow at Konkordia (2,750 m).'},
               'noise': {'dryAnomalyDb': round(noise, 2), 'thresholdDb': round(threshold, 2), 'dryDates': len(dry)},
               'rules': RULES, 'pattern': pattern,
               'differenceScale': {'minDb': DIFF_STOPS[0][0], 'maxDb': DIFF_STOPS[-1][0], 'stops': [[v, list(c)] for v, c in DIFF_STOPS],
                                   'meaning': 'Change of each glacier cell between two dates of one track, minus the change of high rock. Blue = radar-darker, orange = radar-brighter.'},
               'tracks': summary_tracks, 'steps': steps, 'findings': findings, 'limits': LIMITS}
    (OUT / 'change-summary.json').write_text(json.dumps(summary, allow_nan=False), encoding='utf-8')
    print(f'Change summary: {len(observations)} dates on {len(tracks)} tracks, {len(steps)} steps, {len(findings)} storm findings; dry-date noise {noise:.2f} dB', flush=True)
    return summary


def assess(events, tracks, steps, threshold, band_starts):
    """For each storm, compare every track's first image afterwards with that track's usual glacier brightness."""
    findings = []
    for ev in events:
        responses = []
        for t in tracks:
            dates = t['dates']
            post = next((i for i, r in enumerate(dates) if ev['to'] < r['date'] and days_between(ev['to'], r['date']) <= RESPONSE_DAYS), None)
            if post is None or post == 0 or dates[post - 1]['date'] >= ev['from']: continue
            step = next(s for s in steps if s['track'] == t['id'] and s['to'] == dates[post]['date'])
            after = dates[post + 1] if post + 1 < len(dates) else None
            responses.append({'track': t['id'], 'date': dates[post]['date'], 'before': dates[post - 1]['date'], 'anomalyDb': dates[post]['anomalyDb'],
                              'recovered': None if after is None else after['anomalyDb'] > dates[post]['anomalyDb'], 'nextDate': after['date'] if after else None, 'step': step})
        if not responses: continue
        darker = [r for r in responses if r['anomalyDb'] < 0]
        median = float(np.median([r['anomalyDb'] for r in responses]))
        recovered = [r for r in responses if r['recovered']]
        fractions = [r['step']['darkerFraction'] for r in responses if r['step']['darkerFraction'] is not None]
        coverage = float(np.median(fractions)) if fractions else 0.0
        band_values = np.nanmedian(np.array([[np.nan if v is None else v for v in r['step']['bands']] for r in responses], float), axis=0)
        low = band_starts[int(np.nanargmin(band_values))]
        listing = '; '.join(f"{track_label(r['track'])} {r['anomalyDb']:+.1f} dB on {r['date']}" for r in responses)
        checks = {'tracksAgree': {'pass': len(darker) >= 2, 'detail': f'{len(darker)} of {len(responses)} tracks darker than usual: {listing}.'},
                  'beatsNoise': {'pass': median <= -threshold, 'detail': f'Median {median:+.1f} dB; dry-date threshold {threshold:.1f} dB.'},
                  'fitsWeather': {'pass': median < 0 and len(recovered) * 2 > len(responses),
                                  'detail': f"{ev['precipitationMm']:.0f} mm of precipitation and {ev['snowfallCm']:.1f} cm of snow at Konkordia; brighter again on the next image of {len(recovered)} of {len(responses)} tracks."},
                  'spatiallyCoherent': {'pass': coverage >= 0.6, 'detail': f'{coverage:.0%} of glacier cells darkened across the storm (median of tracks).'}}
        passed = sum(c['pass'] for c in checks.values())
        when = ev['from'] if ev['from'] == ev['to'] else f"{ev['from']} to {ev['to']}"
        last = max(r['date'] for r in responses)
        overlap = [e['from'] for e in events if ev['to'] < e['from'] < last]
        checks['fitsWeather']['detail'] += f" Another storm on {', '.join(overlap)} fell before some of these images, so their responses may combine both." if overlap else ''
        findings.append({'id': f"storm-{ev['from']}", 'kind': 'storm', 'storm': ev, 'tracks': [r['track'] for r in darker], 'magnitudeDb': round(median, 2), 'strongestBand': [low, low + 200],
                         'statement': (f"After the storm of {when} ({ev['precipitationMm']:.0f} mm, {ev['snowfallCm']:.1f} cm of fresh snow at Konkordia), the glacier was radar-darker than usual "
                                       f"on {len(darker)} of {len(responses)} tracks on their first images afterwards, by a median {abs(median):.1f} dB relative to high rock, most strongly between {low:,} and {low + 200:,} m."),
                         'interpretation': 'Consistent with fresh wet snow on the glacier absorbing the radar signal, then settling or refreezing.' if median < 0 else 'The glacier did not darken after this storm.',
                         'checks': checks, 'confidence': 'High' if passed == 4 else 'Moderate' if passed == 3 else 'Low',
                         'responses': [{k: r[k] for k in ('track', 'date', 'before', 'anomalyDb', 'nextDate', 'recovered')} for r in responses],
                         'steps': [{'track': r['track'], 'from': r['before'], 'to': r['date'], 'file': r['step']['file']} for r in responses]})
    order = {'High': 0, 'Moderate': 1, 'Low': 2}
    return sorted(findings, key=lambda f: (order[f['confidence']], f['magnitudeDb']))


if __name__ == '__main__':
    build()
