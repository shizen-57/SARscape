"""Convert a compact NISAR GCOV subset into measured backscatter and map context."""
import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import sys
from urllib.parse import urlsplit, urlunsplit

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / '.python'))
import h5py
import numpy as np
import rasterio
from PIL import Image
from pyproj import CRS, Transformer
from rasterio.enums import Resampling
from rasterio.transform import array_bounds, from_origin
from rasterio.warp import calculate_default_transform, reproject

ROOT = pathlib.Path(__file__).resolve().parents[2]


def text(value):
    if isinstance(value, bytes):
        return value.decode('utf-8')
    return str(value)


def _values(dataset, window):
    values = dataset[window].astype(np.float32)
    for name in ('_FillValue', 'missing_value'):
        if name in dataset.attrs:
            for fill in np.atleast_1d(dataset.attrs[name]):
                values[values == fill] = np.nan
    return values


def process(source, output, scenario_id='aletsch'):
    source = pathlib.Path(source)
    output = pathlib.Path(output)
    scenarios = json.loads((ROOT / 'database/scenarios.json').read_text(encoding='utf-8'))
    scenario = next((s for s in scenarios['scenarios'] if s['id'] == scenario_id), None)
    if scenario is None:
        raise ValueError('Unknown study area')

    with h5py.File(source, 'r') as handle:
        identification = handle['/science/LSAR/identification']
        if text(identification['missionId'][()]) != 'NISAR' or text(identification['productType'][()]) != 'GCOV':
            raise ValueError('A NISAR GCOV subset is required')
        if 'productSpecificationVersion' not in identification or text(identification['productSpecificationVersion'][()]) != '1.5.0':
            raise ValueError('Only the reviewed GCOV product specification 1.5.0 is supported')
        group = handle['/science/LSAR/GCOV/grids/frequencyA']
        x, y = group['xCoordinates'][:], group['yCoordinates'][:]
        if len(x) < 2 or len(y) < 2:
            raise ValueError('Invalid GCOV coordinate grid')
        dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
        if dx <= 0 or dy >= 0 or not np.allclose(np.diff(x), dx) or not np.allclose(np.diff(y), dy):
            raise ValueError('Unsupported or irregular GCOV coordinate orientation')
        crs = CRS.from_epsg(int(group['projection'][()]))
        if not crs.is_projected or crs.axis_info[0].unit_name != 'metre':
            raise ValueError('A projected metre GCOV grid is required')
        west, south, east, north = Transformer.from_crs(4326, crs, always_xy=True).transform_bounds(*scenario['extent'], densify_pts=21)
        columns = np.flatnonzero((x + dx / 2 >= west) & (x - dx / 2 <= east))
        rows = np.flatnonzero((y + abs(dy) / 2 >= south) & (y - abs(dy) / 2 <= north))
        if not len(columns) or not len(rows):
            raise ValueError('The GCOV subset does not intersect the selected study area')
        window = np.s_[rows[0]:rows[-1] + 1, columns[0]:columns[-1] + 1]
        shape = (len(y), len(x))
        for name in ('HHHH', 'HVHV', 'mask'):
            if group[name].shape != shape:
                raise ValueError(f'Mismatched GCOV grid: {name}')
        receive_only_declarations = {}
        for name in ('HHHH', 'HVHV'):
            dataset = group[name]
            if text(dataset.attrs.get('units', '')) != '1':
                raise ValueError(f'GCOV {name} must contain unitless linear gamma0 power')
            for attribute in ('isReceiveOnlyChannel1', 'isReceiveOnlyChannel2'):
                if attribute not in dataset.attrs:
                    receive_only_declarations[f'{name}.{attribute}'] = 'not_declared'
                    continue
                value = text(dataset.attrs[attribute]).strip().lower()
                receive_only_declarations[f'{name}.{attribute}'] = value
                if value not in ('false', '0'):
                    raise ValueError(f'GCOV {name} {attribute} is receive-only or unrecognized; it cannot be interpreted as surface backscatter')
        hh, hv = _values(group['HHHH'], window), _values(group['HVHV'], window)
        mask_dataset = group['mask']
        if mask_dataset.dtype.kind != 'u' or mask_dataset.dtype.itemsize != 1:
            raise ValueError('The GCOV coverage mask must be uint8')
        mask = _values(mask_dataset, window)
        accepted = np.isfinite(hh) & np.isfinite(hv) & (hh > 0) & (hv > 0)
        accepted &= np.isfinite(mask) & (mask > 0) & (mask < 255)
        rejected_exceptions = 0
        optional_checks = []
        for name in ('numberOfLooks', 'inputDataExceptionMask'):
            if name not in group:
                continue
            if group[name].shape != shape:
                raise ValueError(f'Mismatched GCOV quality grid: {name}')
            if name == 'inputDataExceptionMask' and (group[name].dtype.kind != 'u' or group[name].dtype.itemsize != 1):
                raise ValueError('The GCOV inputDataExceptionMask must be uint8')
            values = _values(group[name], window)
            if name == 'numberOfLooks':
                accepted &= np.isfinite(values) & (values > 0)
                optional_checks.append('Finite positive numberOfLooks')
            else:
                # No exception bit is silently reinterpreted as scientifically usable.
                valid_exception = np.isfinite(values) & (values == 0)
                rejected_exceptions = int((accepted & ~valid_exception).sum())
                accepted &= valid_exception
                optional_checks.append('inputDataExceptionMask must be zero; all nonzero or fill values rejected without interpreting bits')
        if not np.any(accepted):
            raise ValueError('No cells passed the declared GCOV coverage and finite-power filters')
        with np.errstate(divide='ignore', invalid='ignore'):
            hh_db, hv_db = 10 * np.log10(hh), 10 * np.log10(hv)
        bands = [np.where(accepted, values, np.nan).astype(np.float32) for values in (hh_db, hv_db, hv_db - hh_db)]
        accepted &= np.logical_and.reduce([np.isfinite(values) for values in bands])
        bands = [np.where(accepted, values, np.nan).astype(np.float32) for values in bands]
        transform = from_origin(float(x[columns[0]] - dx / 2), float(y[rows[0]] + abs(dy) / 2), dx, abs(dy))
        metadata = {}
        for name in ('granuleId', 'productVersion', 'productSpecificationVersion', 'compositeReleaseId', 'zeroDopplerStartTime', 'zeroDopplerEndTime', 'trackNumber', 'frameNumber', 'orbitPassDirection'):
            if name in identification:
                metadata[name] = text(identification[name][()])

    output.mkdir(parents=True, exist_ok=True)
    tif = output / 'gcov-backscatter.tif'
    temporary = output / 'gcov-backscatter.preparing.tif'
    with rasterio.open(temporary, 'w', driver='COG', height=len(rows), width=len(columns), count=3,
                       dtype='float32', crs=crs, transform=transform, nodata=np.nan,
                       compress='DEFLATE', blocksize=256, overview_resampling='NEAREST') as destination:
        for index, (name, values) in enumerate(zip(('hh_gamma0_db', 'hv_gamma0_db', 'hv_to_hh_ratio_db'), bands), 1):
            destination.write(values, index)
            destination.set_band_description(index, name)
            destination.update_tags(index, units='dB')
        destination.update_tags(measurement='Terrain-corrected gamma0 radar backscatter',
                                ratio='HV/HH power ratio expressed as HV_dB minus HH_dB; not temporal change')
    os.replace(temporary, tif)

    bounds = array_bounds(len(rows), len(columns), transform)
    png_transform, width, height = calculate_default_transform(crs, 'EPSG:4326', len(columns), len(rows), *bounds)
    scale = max(1, width / 2048, height / 2048)
    if scale > 1:
        out_width, out_height = max(1, int(np.ceil(width / scale))), max(1, int(np.ceil(height / scale)))
        png_transform *= rasterio.Affine.scale(width / out_width, height / out_height)
        width, height = out_width, out_height
    display = np.full((height, width), np.nan, dtype=np.float32)
    reproject(bands[0], display, src_transform=transform, src_crs=crs, src_nodata=np.nan,
              dst_transform=png_transform, dst_crs='EPSG:4326', dst_nodata=np.nan, resampling=Resampling.nearest)
    valid = np.isfinite(display)
    # A fixed physical display range is shared across acquisition dates.
    gray = np.rint(np.clip((np.nan_to_num(display, nan=-25.0) + 25) / 25, 0, 1) * 255).astype(np.uint8)
    rgba = np.dstack((gray, gray, gray, np.where(valid, 255, 0).astype(np.uint8)))
    png = output / 'gcov-context.png'
    png_temporary = output / 'gcov-context.preparing.png'
    Image.fromarray(rgba).save(png_temporary, format='PNG')
    os.replace(png_temporary, png)
    w, s, e, n = array_bounds(height, width, png_transform)

    digest = hashlib.sha256()
    with source.open('rb') as raw:
        while chunk := raw.read(8 * 1024 * 1024):
            digest.update(chunk)
    remote = {}
    sidecar = source.with_suffix('.source.json')
    if sidecar.exists():
        supplied = json.loads(sidecar.read_text(encoding='utf-8'))
        for name in ('sourceGranuleId', 'sourceBytes', 'boundingBoxWGS84', 'transferredBytes', 'rangeRequests', 'sourceETag', 'sourceAccess', 'subsetSha256', 'subsetBytes', 'createdAt', 'epsg', 'shape', 'postingMetres'):
            if name in supplied:
                remote[name] = supplied[name]
        for name in ('sourceUrl',):
            if isinstance(supplied.get(name), str):
                parts = urlsplit(supplied[name])
                remote['sourceUrl'] = urlunsplit((parts.scheme, parts.hostname or '', parts.path, '', ''))
                break
    provenance = {
        'scenario': scenario_id, 'mission': 'NISAR', 'product': 'GCOV', 'frequency': 'A',
        'sourceFilename': source.name, 'subsetSha256': digest.hexdigest(), 'subsetBytes': source.stat().st_size,
        'sourceIdentity': remote, 'identification': metadata,
        'acquisitionDate': metadata.get('zeroDopplerStartTime'), 'epsg': crs.to_epsg(),
        'postingMetres': [dx, abs(dy)], 'studyAreaExtent': scenario['extent'],
        'acceptedSamples': int(accepted.sum()), 'totalSamples': int(accepted.size),
        'qualityMask': 'Finite positive HHHH and HVHV powers; uint8 coverage mask above 0 and below 255; declared fill values rejected',
        'optionalQualityChecks': optional_checks, 'exceptionSamplesRejected': rejected_exceptions,
        'receiveOnlyDeclarations': receive_only_declarations,
        'receiveOnlyStatusVerified': all(value in ('false', '0') for value in receive_only_declarations.values()),
        'metadataLimitations': 'Receive-only channel attributes are absent in some official 1.5.0 writer outputs; absent values are recorded, not inferred false.',
        'glacierOutlineApplied': False, 'layoverShadowMaskApplied': False,
        'units': 'dB', 'bands': ['hh_gamma0_db', 'hv_gamma0_db', 'hv_to_hh_ratio_db'],
        'calculation': 'HH and HV: 10*log10(linear gamma0 power); ratio: HV_dB-HH_dB',
        'interpretation': 'Radar backscatter context; changes can reflect snow, moisture, geometry, or other surface conditions. This product does not measure displacement, melt, thickness, or volume.',
        'schemaSource': 'https://github.com/isce-framework/isce3/blob/fbc49b0cba725766b02c8cf499dd017925e7da44/python/packages/nisar/products/XML/L2/nisar_L2_GCOV.xml',
        'displayPreview': {'file': png.name, 'measurement': 'HH gamma0 backscatter', 'rangeDb': [-25, 0],
                           'crs': 'EPSG:4326', 'shape': [height, width], 'resampling': 'nearest',
                           'coordinates': [[w, n], [e, n], [e, s], [w, s]],
                           'invalidCells': 'transparent', 'displayIsMeasurement': False},
        'createdAt': dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    temporary_provenance = output / 'gcov-provenance.preparing.json'
    temporary_provenance.write_text(json.dumps(provenance, indent=2, allow_nan=False), encoding='utf-8')
    os.replace(temporary_provenance, output / 'gcov-provenance.json')
    return provenance


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--scenario', default='aletsch')
    arguments = parser.parse_args()
    try:
        print(json.dumps(process(arguments.input, arguments.output, arguments.scenario)), flush=True)
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
