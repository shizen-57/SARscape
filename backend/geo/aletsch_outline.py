"""Extract the Great Aletsch outline from the official SGI2016 shapefile archive (CC BY 4.0)."""
import argparse, hashlib, io, json, pathlib, struct, sys, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/.python'))
import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import LinearRing, MultiPolygon, Polygon, mapping

SOURCE = 'https://doi.glamos.ch/data/inventory/inventory_sgi2016_r2020.zip'
SGI_ID = 'B36-26'


def dbf_records(data):
    count, header, length = struct.unpack('<IHH', data[4:12])
    fields, offset = [], 32
    while data[offset] != 0x0D:
        fields.append((data[offset:offset+11].split(b'\0')[0].decode(), data[offset+16]))
        offset += 32
    for index in range(count):
        row, position, values = data[header+index*length:header+(index+1)*length], 1, {}
        for name, size in fields:
            values[name] = row[position:position+size].decode('utf-8', 'replace').strip(); position += size
        yield values


def shp_polygons(data):
    # Shapefile type 5 only: outer rings are clockwise, holes counter-clockwise.
    if struct.unpack('<i', data[32:36])[0] != 5: raise ValueError('SGI outlines must be a polygon shapefile')
    offset = 100
    while offset < len(data):
        length = struct.unpack('>i', data[offset+4:offset+8])[0] * 2
        record = data[offset+8:offset+8+length]; offset += 8 + length
        parts, points = struct.unpack('<ii', record[36:44])
        starts = list(struct.unpack(f'<{parts}i', record[44:44+4*parts])) + [points]
        xy = struct.unpack(f'<{2*points}d', record[44+4*parts:44+4*parts+16*points])
        rings = [[(xy[2*i], xy[2*i+1]) for i in range(a, b)] for a, b in zip(starts, starts[1:])]
        outers = [Polygon(r) for r in rings if not LinearRing(r).is_ccw]
        holes = [r for r in rings if LinearRing(r).is_ccw]
        polygons = [Polygon(o.exterior, [h for h in holes if o.contains(Polygon(h).representative_point())]) for o in outers]
        yield polygons[0] if len(polygons) == 1 else MultiPolygon(polygons)


def extract(archive, output):
    raw = pathlib.Path(archive).read_bytes()
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        records = list(dbf_records(z.read('SGI_2016_glaciers.dbf')))
        shapes = list(shp_polygons(z.read('SGI_2016_glaciers.shp')))
    if len(records) != len(shapes): raise ValueError('SGI shapefile and attribute table differ in length')
    index = next(i for i, r in enumerate(records) if r['sgi-id'] == SGI_ID)
    attributes, shape = records[index], shapes[index]
    if attributes['name'] != 'Grosser Aletschgletscher': raise ValueError('Unexpected SGI record for B36-26')
    # 5 m simplification in LV95 metres keeps the browser payload small; recorded in properties.
    simplified = shape.simplify(5, preserve_topology=True)
    to_wgs84 = Transformer.from_crs(2056, 4326, always_xy=True).transform
    geometry = shapely.transform(simplified, lambda c: np.round(np.column_stack(to_wgs84(c[:, 0], c[:, 1])), 6))
    feature = {'type': 'Feature', 'geometry': mapping(geometry), 'properties': {
        'name': attributes['name'], 'sgiId': SGI_ID, 'outlineYear': int(attributes['year_acq']),
        'areaKm2': float(attributes['area_km2']), 'simplificationMetres': 5,
        'source': 'Swiss Glacier Inventory 2016 (GLAMOS), SGI_2016_glaciers.shp', 'sourceUrl': SOURCE,
        'sourceSha256': hashlib.sha256(raw).hexdigest(), 'license': 'CC BY 4.0',
        'citation': 'Linsbauer, A., Huss, M., Hodel, E., Bauder, A., Fischer, M., Weidmann, Y., Bärtschi, H. & Schmassmann, E. (2021). The new Swiss Glacier Inventory SGI2016: From a topographical to a glaciological dataset. Frontiers in Earth Science, 9, 704189. doi:10.3389/feart.2021.704189',
        'limitation': 'Outline from 2017 aerial imagery; the 2026 ice margin and terminus have retreated and thinned since then.'}}
    pathlib.Path(output).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(output).write_text(json.dumps({'type': 'FeatureCollection', 'features': [feature]}), encoding='utf-8')
    return feature['properties']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', default=str(ROOT / 'data/sgi2016/inventory_sgi2016_r2020.zip'))
    parser.add_argument('--output', default=str(ROOT / 'database/outlines/aletsch-sgi2016.geojson'))
    args = parser.parse_args()
    print(json.dumps(extract(args.archive, args.output)))
