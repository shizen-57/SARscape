"""Extract the Columbia Glacier outline (and the neighbouring ice that must not count as stable ground) from RGI 6.0.

Source: Randolph Glacier Inventory 6.0, region 01 Alaska, served by the GLIMS WFS (layer GLIMS:RGI_Alaska).
Fetch the raw response with the command printed by --help, then run this script on it.
"""
import argparse, hashlib, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / '.python'))
from shapely.geometry import mapping, shape

ROOT = pathlib.Path(__file__).resolve().parents[2]
TARGET = 'RGI60-01.10689'
QUERY = ('curl -G "https://www.glims.org/geoserver/GLIMS/ows" --data-urlencode service=WFS --data-urlencode version=1.0.0 --data-urlencode request=GetFeature '
         '--data-urlencode typeName=GLIMS:RGI_Alaska --data-urlencode outputFormat=application/json --data-urlencode srsName=EPSG:4326 '
         '--data-urlencode "CQL_FILTER=AREA > 20 AND CENLON BETWEEN -147.4 AND -146.6 AND CENLAT BETWEEN 60.9 AND 61.35" -o rgi_alaska_columbia.json')
SOURCE = 'https://www.glims.org/geoserver/GLIMS/ows?typeName=GLIMS:RGI_Alaska'
CITATION = ('RGI Consortium (2017). Randolph Glacier Inventory – A Dataset of Global Glacier Outlines: Version 6.0. Global Land Ice Measurements from Space, Colorado, USA. '
            'Digital Media. doi:10.7265/N5-RGI-60')
LIMITATION = ('The Columbia Glacier outline is from 6 September 2009. The terminus has retreated by kilometres since then, so the 2026 ice front lies up-glacier of this outline '
              'and cells near the old terminus may now be open water.')


def extract(raw, output, simplify=0.0001):
    data = json.loads(pathlib.Path(raw).read_text(encoding='utf-8'))
    digest = hashlib.sha256(pathlib.Path(raw).read_bytes()).hexdigest()
    features = {f['properties']['RGIID']: f for f in data['features']}
    if TARGET not in features: raise SystemExit(f'{TARGET} not found in the response')
    ordered = [features[TARGET]] + [f for k, f in features.items() if k != TARGET]
    out = []
    for f in ordered:
        p = f['properties']
        geometry = shape(f['geometry']).simplify(simplify, preserve_topology=True)   # about 11 m
        out.append({'type': 'Feature', 'geometry': mapping(geometry), 'properties': {
            'role': 'target' if p['RGIID'] == TARGET else 'other-ice', 'name': p['NAME'], 'rgiId': p['RGIID'], 'outlineDate': str(p['BGNDATE']), 'areaKm2': p['AREA'],
            'terminusType': 'marine-terminating' if p.get('TERMTYPE') == 1 else p.get('TERMTYPE'), 'simplificationDegrees': simplify,
            'source': 'Randolph Glacier Inventory 6.0 (GLIMS WFS, GLIMS:RGI_Alaska)', 'sourceUrl': SOURCE, 'sourceResponseSha256': digest,
            'license': 'Free to use with citation (RGI Consortium 2017); check the NSIDC and GLIMS terms before redistributing the raw inventory',
            'citation': CITATION, 'limitation': LIMITATION}})
    pathlib.Path(output).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(output).write_text(json.dumps({'type': 'FeatureCollection', 'features': out}), encoding='utf-8')
    return [(f['properties']['name'], f['properties']['role'], f['properties']['areaKm2']) for f in out]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__ + '\nFetch with:\n' + QUERY, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--raw', required=True, help='GeoJSON response from the GLIMS WFS (see above)')
    parser.add_argument('--output', default=str(ROOT / 'database/outlines/columbia-rgi6.geojson'))
    args = parser.parse_args()
    print(json.dumps(extract(args.raw, args.output)))
