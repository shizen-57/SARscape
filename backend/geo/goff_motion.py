"""Approximate glacier-motion preview from screened GOFF radar components.

GOFF measures along-track and slant-range pixel offsets between two acquisitions. Everything here is
an estimate layered on top: a stable-ground offset is removed, implausible and spatially inconsistent
cells are rejected, the field is smoothed for display, and a horizontal flow vector is derived only
when the product's own radarGrid geometry exists and the glacier clearly exceeds the stable-ground
noise floor. The original components stay untouched in radar-components.tif and samples.geojson.
"""
import json, pathlib, warnings
import numpy as np
import shapely
from pyproj import Transformer
from rasterio.features import rasterize
from rasterio.transform import from_origin
from shapely.geometry import box, mapping, shape

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTLINES = {'aletsch': ROOT / 'database/outlines/aletsch-sgi2016.geojson', 'columbia': ROOT / 'database/outlines/columbia-rgi6.geojson'}
# Published Great Aletsch surface speeds peak near 200 m/a (~0.55 m/day); 1.5 m/day is a generous
# plausibility bound for 12-day offsets, not a validated cutoff. Larger values fill the ±64-pixel
# search window and behave like false correlation peaks.
PLAUSIBLE_RATE = 1.5
# Fast tidewater ice needs a wider bound. Columbia Glacier flows at metres per day, and the layer3 search window
# (±64 radar pixels, about ±16 m/day over 12 days) is still the hard ceiling for what GOFF can track.
PLAUSIBLE_BY_SCENARIO = {'columbia': 12.0}
WINDOW = 5                  # 5×5 cells = 400 m at 80 m posting
MEDIAN_TEST, MEDIAN_EPSILON, MIN_NEIGHBOURS = 2.0, 0.1, 4
MIN_SUPPORT = 6             # supporting cells needed for a displayed (smoothed) value
STABLE_MIN = 50             # stable-ground cells needed to estimate the common offset
SIGNAL_RATIO, MIN_COVERAGE = 2.0, 0.2
# A glacier with a fast trunk and a slow basin should still count as flowing, so the decision does not use the median of all glacier
# cells. It uses the *excess* share: the fraction of glacier cells moving faster than SIGNAL_RATIO × the stable-rock noise floor, minus the
# same fraction measured on stable rock (the empirical false-positive rate). The excess must be a practical effect (MIN_EXCESS) and a
# one-sided two-proportion test over independent 5×5-cell blocks must reject chance (MIN_Z). Both limits are choices, stated in the output.
MIN_EXCESS, MIN_Z = 0.10, 5.0
STRONG_CORRELATION = 0.6
REFERENCE_HEIGHT = 2500.0   # metres; unit vectors change <0.002 between 1500 and 3500 m here
GEOMETRY = ('alongTrackUnitVectorX', 'alongTrackUnitVectorY', 'losUnitVectorX', 'losUnitVectorY', 'incidenceAngle')
CELL_FIELDS = ['row', 'col', 'alongTrack', 'slantRange', 'east', 'north', 'confidence', 'support', 'correlation', 'measured', 'rawAlongTrack', 'rawSlantRange', 'rawCorrelation']


def windows(values, size=WINDOW):
    padded = np.pad(np.asarray(values, float), size // 2, constant_values=np.nan)
    return np.lib.stride_tricks.sliding_window_view(padded, (size, size)).reshape(*np.shape(values), size * size)


def _nanmedian(values):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', RuntimeWarning)
        return np.nanmedian(values, axis=-1)


def median_test(values, valid, threshold=MEDIAN_TEST, epsilon=MEDIAN_EPSILON, minimum=MIN_NEIGHBOURS):
    """Normalized median test (Westerweel & Scarano 2005) over the 5×5 neighbourhood, centre excluded."""
    neighbours = windows(np.where(valid, values, np.nan))
    neighbours = np.delete(neighbours, neighbours.shape[-1] // 2, axis=-1)
    median = _nanmedian(neighbours)
    residual = _nanmedian(np.abs(neighbours - median[..., None]))
    with np.errstate(invalid='ignore'):
        score = np.abs(values - median) / (residual + epsilon)
    return valid & (np.isfinite(neighbours).sum(-1) >= minimum) & (score <= threshold)


def smooth(values, valid):
    """5×5 median of valid cells, including the centre, and the number of supporting cells."""
    neighbourhood = windows(np.where(valid, values, np.nan))
    return _nanmedian(neighbourhood), np.isfinite(neighbourhood).sum(-1)


def stable_offset(along, slant, width=1.0):
    """Common (along, slant) offset of stable ground: 2-D histogram peak refined by iterative medians."""
    along, slant = np.asarray(along, float), np.asarray(slant, float)
    if along.size < STABLE_MIN: return None
    edges = [np.arange(np.floor(v.min()), np.ceil(v.max()) + 0.5, 0.5) for v in (along, slant)]
    if any(len(e) < 2 for e in edges): edges = [np.array([v.min() - .25, v.max() + .25]) for v in (along, slant)]
    counts, xe, ye = np.histogram2d(along, slant, bins=edges)
    i, j = np.unravel_index(counts.argmax(), counts.shape)
    a, s = (xe[i] + xe[i + 1]) / 2, (ye[j] + ye[j + 1]) / 2
    for _ in range(20):
        near = (np.abs(along - a) < width) & (np.abs(slant - s) < width)
        if near.sum() < STABLE_MIN: return None
        a, s = float(np.median(along[near])), float(np.median(slant[near]))
    near = (np.abs(along - a) < width) & (np.abs(slant - s) < width)
    spread = [float(1.4826 * np.median(np.abs(v[near] - c))) for v, c in ((along, a), (slant, s))]
    return {'alongTrack': a, 'slantRange': s, 'support': int(near.sum()), 'candidates': int(along.size), 'spread': spread}


def horizontal_flow(along, slant, at_x, at_y, los_x, los_y):
    """Solve for horizontal (east, north) motion from the two radar components.

    Assumed conventions (not stated explicitly in JPL D-105010): positive along-track = motion in the
    flight direction; positive slant-range = range increase, i.e. away from the sensor. losUnitVector
    points from target to sensor, so slant = -(los_x*east + los_y*north) when vertical motion is zero.
    """
    det = at_y * los_x - at_x * los_y
    with np.errstate(divide='ignore', invalid='ignore'):
        east = (-los_y * along - at_y * slant) / det
        north = (los_x * along + at_x * slant) / det
    return east, north


def sample_geometry(radar_grid, x, y, epsg):
    """Nearest radarGrid cube values at the reference height for cell centres x (columns) and y (rows)."""
    if radar_grid is None or any(name not in radar_grid for name in GEOMETRY + ('xCoordinates', 'yCoordinates', 'heightAboveEllipsoid', 'projection')): return None
    if int(np.asarray(radar_grid['projection'][()])) != epsg: return None
    gx, gy, heights = (np.asarray(radar_grid[n][:], float) for n in ('xCoordinates', 'yCoordinates', 'heightAboveEllipsoid'))
    cols = np.clip(np.rint((x - gx[0]) / (gx[1] - gx[0])).astype(int), 0, len(gx) - 1)
    rows = np.clip(np.rint((y - gy[0]) / (gy[1] - gy[0])).astype(int), 0, len(gy) - 1)
    r, c = slice(rows.min(), rows.max() + 1), slice(cols.min(), cols.max() + 1)
    level = int(np.argmin(np.abs(heights - REFERENCE_HEIGHT)))
    pick = np.ix_(rows - rows.min(), cols - cols.min())
    values = {n: np.asarray(radar_grid[n][level, r, c], float)[pick] for n in GEOMETRY}
    low, high = (int(np.argmin(np.abs(heights - h))) for h in (1500.0, 3500.0))
    sensitivity = max(float(np.nanmax(np.abs(np.asarray(radar_grid[n][high, r, c], float) - np.asarray(radar_grid[n][low, r, c], float)))) for n in GEOMETRY[:4])
    if not all(np.isfinite(v).all() for v in values.values()): return None
    values.update(height=float(heights[level]), heightSensitivity=sensitivity)
    return values


def _median_vector(vx, vy):
    vx, vy = float(np.median(vx)), float(np.median(vy)); norm = np.hypot(vx, vy)
    return [vx / norm, vy / norm]


def build(along, slant, correlation, x, y, epsg, scenario, threshold, pair_days, geometry=None, outline_path=None):
    """Return the motion-preview document. Inputs are accepted component rates (NaN elsewhere) on the GOFF grid."""
    along, slant, correlation = (np.asarray(v, float) for v in (along, slant, correlation))
    outline_path = outline_path or OUTLINES.get(scenario)
    base = {'version': 1, 'units': 'm/day', 'pairDays': pair_days, 'measured': 'GOFF along-track and slant-range offsets divided by the pair duration',
            'estimated': 'Stable-ground-referenced, filtered, 400 m-smoothed components; horizontal flow only when resolved', 'validated': False, 'cellFields': CELL_FIELDS, 'cells': []}
    if not outline_path or not pathlib.Path(outline_path).exists():
        return {**base, 'status': 'unavailable', 'reason': 'No published glacier outline is configured for this study area.'}
    dx, dy = float(x[1] - x[0]), float(y[0] - y[1])
    transform = from_origin(float(x[0] - dx / 2), float(y[0] + dy / 2), dx, dy)
    features = json.loads(pathlib.Path(outline_path).read_text(encoding='utf-8'))['features']
    feature = features[0]   # the target glacier; any further features are other ice that also moves
    to_grid = Transformer.from_crs(4326, epsg, always_xy=True)
    to_metres = lambda f: shapely.transform(shape(f['geometry']), lambda c: np.column_stack(to_grid.transform(c[:, 0], c[:, 1])))
    outline = to_metres(feature)
    other_ice = [to_metres(f) for f in features[1:]]
    shape_ = along.shape
    # Cell centres inside the outline shrunk by half a cell: no mixed rock/ice margin cells.
    inside = rasterize([(outline.buffer(-dx / 2), 1)], out_shape=shape_, transform=transform, fill=0).astype(bool)
    # Stable ground is more than two cells from the target and from every other glacier in the file.
    stable = ~rasterize([(g.buffer(2 * dx), 1) for g in [outline, *other_ice]], out_shape=shape_, transform=transform, fill=0).astype(bool)
    accepted = np.isfinite(along) & np.isfinite(slant) & np.isfinite(correlation)
    offset = stable_offset(along[accepted & stable], slant[accepted & stable])
    to_lonlat = Transformer.from_crs(epsg, 4326, always_xy=True)
    extent = box(float(x[0] - dx / 2), float(y[-1] - dy / 2), float(x[-1] + dx / 2), float(y[0] + dy / 2))
    clipped = outline.intersection(extent)
    corners = [list(map(float, to_lonlat.transform(px, py))) for px, py in ((extent.bounds[0], extent.bounds[3]), (extent.bounds[2], extent.bounds[3]), (extent.bounds[2], extent.bounds[1]), (extent.bounds[0], extent.bounds[1]))]
    cols, rows = np.meshgrid(np.arange(shape_[1]), np.arange(shape_[0]))
    lon, lat = to_lonlat.transform(x[cols], y[rows])
    design = np.column_stack([np.ones(cols.size), cols.ravel() + .5, rows.ravel() + .5])
    affine = [np.linalg.lstsq(design, v.ravel(), rcond=None)[0].tolist() for v in (lon, lat)]
    to_pixels = lambda c: np.column_stack([(c[:, 0] - extent.bounds[0]) / dx, (extent.bounds[3] - c[:, 1]) / dy])
    properties = feature['properties']
    base.update(grid={'epsg': epsg, 'shape': list(shape_), 'postingMetres': [dx, dy], 'corners': corners, 'lonLatAffine': affine,
                      'outlinePixels': mapping(shapely.transform(clipped, to_pixels))['coordinates'] if not clipped.is_empty else []},
                outline={'geometry': mapping(shapely.transform(clipped, lambda c: np.column_stack(to_lonlat.transform(c[:, 0], c[:, 1])))),
                         **{k: properties[k] for k in ('name', 'sgiId', 'rgiId', 'outlineYear', 'outlineDate', 'source', 'sourceUrl', 'license', 'citation', 'limitation') if k in properties},
                         'mask': 'Cell centres inside the outline shrunk by half a cell; stable ground is more than two cells outside it.'})
    if offset is None:
        return {**base, 'status': 'unavailable', 'reason': f'Fewer than {STABLE_MIN} consistent stable-ground cells; the common radar offset cannot be removed.'}
    rel_along, rel_slant = along - offset['alongTrack'], slant - offset['slantRange']
    limit = PLAUSIBLE_BY_SCENARIO.get(scenario, PLAUSIBLE_RATE)
    plausible = accepted & (np.abs(rel_along) <= limit) & (np.abs(rel_slant) <= limit)
    consistent = median_test(rel_along, plausible) & median_test(rel_slant, plausible)
    smooth_along, support = smooth(rel_along, consistent)
    smooth_slant, _ = smooth(rel_slant, consistent)
    smooth_corr, _ = smooth(correlation, consistent)
    supported = support >= MIN_SUPPORT
    shown, stable_shown = inside & supported, stable & supported
    flow = None
    if geometry is not None:
        flow = horizontal_flow(smooth_along, smooth_slant, geometry['alongTrackUnitVectorX'], geometry['alongTrackUnitVectorY'], geometry['losUnitVectorX'], geometry['losUnitVectorY'])
    # Noise floor: the same filters and smoothing applied to stable ground, which should not move.
    floors = {'alongTrack': float(np.median(np.abs(smooth_along[stable_shown]))) if stable_shown.sum() >= 25 else None,
              'slantRange': float(np.median(np.abs(smooth_slant[stable_shown]))) if stable_shown.sum() >= 25 else None,
              'speed': float(np.median(np.hypot(*flow)[stable_shown])) if flow is not None and stable_shown.sum() >= 25 else None}
    glacier = {'alongTrack': float(np.median(np.abs(smooth_along[shown]))) if shown.any() else None,
               'slantRange': float(np.median(np.abs(smooth_slant[shown]))) if shown.any() else None,
               'speed': float(np.median(np.hypot(*flow)[shown])) if flow is not None and shown.any() else None}
    ratios = {k: glacier[k] / floors[k] if glacier[k] is not None and floors[k] else None for k in floors}
    coverage = float(shown.sum() / max(1, inside.sum()))
    median_corr = float(np.median(correlation[consistent & inside])) if (consistent & inside).any() else None
    speed_all = np.hypot(*flow) if flow is not None else None
    cutoff = SIGNAL_RATIO * floors['speed'] if floors['speed'] else None
    flow_share = float(np.mean(speed_all[shown] >= cutoff)) if cutoff and shown.any() else 0.0
    stable_share = float(np.mean(speed_all[stable_shown] >= cutoff)) if cutoff and stable_shown.sum() >= 25 else None
    n_glacier, n_stable = shown.sum() / WINDOW**2, stable_shown.sum() / WINDOW**2        # independent blocks, not cells
    excess = flow_share - (stable_share or 0.0)
    se = float(np.sqrt(max(flow_share, .005) * (1 - flow_share) / max(n_glacier, 1) + max(stable_share or 0, .005) * (1 - (stable_share or 0)) / max(n_stable, 1))) if cutoff else None
    flow_z = float(excess / se) if se else 0.0
    flow_supported = flow is not None and cutoff is not None and excess >= MIN_EXCESS and flow_z >= MIN_Z and coverage >= MIN_COVERAGE
    signal = max([r for r in ratios.values() if r is not None], default=0)
    grade = 'good' if flow_supported and excess >= .4 and coverage >= .5 and (median_corr or 0) >= STRONG_CORRELATION else 'moderate' if flow_supported else 'low'
    reasons = []
    if (median_corr or 0) < STRONG_CORRELATION: reasons.append(f'Weak correlation: median {median_corr:.2f} for glacier cells that passed every filter.' if median_corr is not None else 'No glacier cell passed every filter.')
    if coverage < .5: reasons.append(f"Only {'under 1%' if 0 < coverage < .01 else f'{coverage:.0%}'} of the glacier outline has a displayed estimate.")
    if cutoff is None: reasons.append('No viewing geometry or too little stable ground, so a horizontal speed cannot be compared with the noise floor.')
    elif flow_supported: reasons.append(f'{flow_share:.0%} of displayed glacier cells move faster than {cutoff:.2f} m/day (twice the stable-rock noise floor); stable rock reaches that in {stable_share:.0%} of its cells, an excess of {excess:.0%} (z = {flow_z:.0f}).')
    else: reasons.append(f'{flow_share:.0%} of displayed glacier cells move faster than {cutoff:.2f} m/day (twice the stable-rock noise floor), against {(stable_share or 0):.0%} on stable rock: an excess of {excess:.0%} (z = {flow_z:.1f}); at least {MIN_EXCESS:.0%} and z = {MIN_Z:g} are required.')
    reasons.append(f"A common offset of {offset['alongTrack']:.2f} m/day along-track and {offset['slantRange']:.2f} m/day slant-range was removed using stable ground.")
    confidence = (support / WINDOW**2) * np.clip((smooth_corr - threshold) / (STRONG_CORRELATION - threshold), 0, 1)
    if flow_supported: confidence = confidence * np.clip(speed_all / cutoff, 0, 1)    # cells at the noise level fade out
    rr, cc = np.nonzero(shown)
    pick = lambda a, digits=4: [None if not np.isfinite(v) else round(float(v), digits) for v in a[rr, cc]]
    columns = [rr.tolist(), cc.tolist(), pick(smooth_along), pick(smooth_slant), pick(flow[0]) if flow is not None else [None] * len(rr), pick(flow[1]) if flow is not None else [None] * len(rr),
               pick(confidence, 3), support[rr, cc].tolist(), pick(smooth_corr, 3), consistent[rr, cc].tolist(), pick(along), pick(slant), pick(correlation, 3)]
    counts = [('glacier', 'Cells inside the glacier outline', inside), ('source', f'Source quality mask and correlation ≥ {threshold:g}', accepted & inside),
              ('plausible', f'Within ±{limit:g} m/day after the stable-ground offset', plausible & inside), ('consistent', 'Normalized median test (5×5, threshold 2)', consistent & inside),
              ('shown', f'Displayed after 400 m median smoothing (≥{MIN_SUPPORT} supporting cells)', shown)]
    geometry_doc = {'available': geometry is not None}
    if geometry is not None:
        along_axis = _median_vector(geometry['alongTrackUnitVectorX'][shown | stable_shown], geometry['alongTrackUnitVectorY'][shown | stable_shown]) if (shown | stable_shown).any() else _median_vector(geometry['alongTrackUnitVectorX'], geometry['alongTrackUnitVectorY'])
        range_axis = _median_vector(-geometry['losUnitVectorX'], -geometry['losUnitVectorY'])
        geometry_doc.update(alongTrackAxis=along_axis, groundRangeAxis=range_axis,
                            headingDeg=float(np.degrees(np.arctan2(*along_axis)) % 360), rangeIncreaseAzimuthDeg=float(np.degrees(np.arctan2(*range_axis)) % 360),
                            incidenceDeg=float(np.median(geometry['incidenceAngle'])), referenceHeightMetres=geometry['height'], unitVectorChange1500To3500m=geometry['heightSensitivity'],
                            source='/science/LSAR/GOFF/metadata/radarGrid (alongTrackUnitVectorX/Y, losUnitVectorX/Y, incidenceAngle)',
                            assumptions=['Horizontal flow: vertical motion is ignored, so steep or thinning ice biases the estimate.',
                                         'Positive along-track = motion in the flight direction; positive slant-range = moving away from the radar (ISCE3 secondary-minus-reference convention; not stated explicitly in the GOFF specification).',
                                         f'Geometry cubes are sampled at the nearest 500 m node and the {geometry["height"]:.0f} m height layer; UTM grid convergence (<1°) is ignored.'])
    else:
        geometry_doc['reason'] = 'This file has no radarGrid geometry cubes, so components cannot be converted to ground directions.'
    return {**base, 'status': 'flow' if flow_supported else 'components' if shown.any() else 'unavailable',
            'reason': 'Estimated horizontal surface flow: a clear excess of glacier cells moves faster than the stable-ground noise floor.' if flow_supported else
                      'Flow direction is not resolved: showing measured radar components relative to stable ground, not glacier-flow direction.' if geometry is not None else
                      'No viewing geometry in this file: showing measured radar components relative to stable ground.',
            'geometry': geometry_doc, 'stableGround': {**offset, 'noiseFloor': floors},
            'quality': {'grade': grade, 'reasons': reasons, 'coverage': coverage, 'medianCorrelation': median_corr, 'glacierMedian': glacier, 'signalToNoise': ratios, 'flowDirectionResolved': bool(flow_supported), 'fastShare': round(flow_share, 3), 'stableShare': None if stable_share is None else round(stable_share, 3), 'excessShare': round(excess, 3), 'flowZ': round(flow_z, 1), 'noiseCutoffMetresPerDay': None if cutoff is None else round(cutoff, 3)},
            'filters': [{'id': key, 'label': label, 'cells': int(mask.sum())} for key, label, mask in counts],
            'method': {'plausibleRateMetresPerDay': limit, 'window': WINDOW, 'medianTest': {'threshold': MEDIAN_TEST, 'epsilon': MEDIAN_EPSILON, 'minimumNeighbours': MIN_NEIGHBOURS, 'reference': 'Westerweel & Scarano (2005), Experiments in Fluids 39, 1096–1100'},
                       'minimumSupport': MIN_SUPPORT, 'signalRatio': SIGNAL_RATIO, 'minimumCoverage': MIN_COVERAGE, 'minimumExcessShare': MIN_EXCESS, 'minimumZ': MIN_Z,
                       'confidence': f'Share of the 5×5 neighbourhood that passed every filter × correlation score, scaled from {threshold:g} (0) to {STRONG_CORRELATION:g} (1)'},
            'cells': [list(row) for row in zip(*columns)]}
