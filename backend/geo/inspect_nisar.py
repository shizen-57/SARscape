"""Discover only the channels and layers actually present in a local NISAR file."""
import argparse, json, pathlib
import h5py
import numpy as np
from pyproj import CRS, Transformer
from goff import text
from process_lifecycle import watch_parent
watch_parent()
ROOT=pathlib.Path(__file__).resolve().parents[2]
DIAGONALS={'HH':'HHHH','HV':'HVHV','VH':'VHVH','VV':'VVVV','RH':'RHRH','RV':'RVRV'}

def intersects(group,extent):
    x=group['xCoordinates'][:];y=group['yCoordinates'][:]
    if len(x)<2 or len(y)<2:return False
    crs=CRS.from_epsg(int(group['projection'][()]))
    west,south,east,north=Transformer.from_crs(4326,crs,always_xy=True).transform_bounds(*extent,densify_pts=21)
    return bool(x.max()>=west and x.min()<=east and y.max()>=south and y.min()<=north)

def receive_only(h,frequency,polarization):
    dataset=h.get(f'/science/LSAR/GCOV/grids/frequency{frequency}/{DIAGONALS[polarization]}')
    if dataset is None:return False
    for key in ['isReceiveOnlyChannel1','isReceiveOnlyChannel2']:
        if text(dataset.attrs.get(key,'False')).lower() in ['true','1']:return True
    return False

def inspect(source,scenario):
    extent=next(s['extent'] for s in json.loads((ROOT/'database/scenarios.json').read_text())['scenarios'] if s['id']==scenario)
    with h5py.File(source,'r') as h:
        identity=h['/science/LSAR/identification'];product=text(identity['productType'][()])
        if text(identity['missionId'][()])!='NISAR' or product not in ['GOFF','GCOV']:raise ValueError('Import a NISAR L2 GOFF or GCOV HDF5 product')
        choices=[]
        for frequency in ['A','B']:
            path=f'/science/LSAR/{product}/grids/frequency{frequency}'
            if path not in h:continue
            if product=='GCOV':
                group=h[path]
                for polarization,term in DIAGONALS.items():
                    if term in group and not receive_only(h,frequency,polarization):choices.append({'frequency':frequency,'polarization':polarization,'term':term,'layer':None,'intersects':intersects(group,extent)})
            elif path+'/pixelOffsets' in h:
                for polarization in ['HH','HV','VH','VV']:
                    for layer in ['layer1','layer2','layer3']:
                        target=f'{path}/pixelOffsets/{polarization}/{layer}'
                        if target in h:choices.append({'frequency':frequency,'polarization':polarization,'layer':layer,'intersects':intersects(h[target],extent)})
        return {'product':product,'choices':choices,'identification':{name:text(identity[name][()]) for name in ['granuleId','productVersion','productSpecificationVersion','compositeReleaseId','zeroDopplerStartTime','referenceZeroDopplerStartTime','secondaryZeroDopplerStartTime'] if name in identity}}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',required=True);parser.add_argument('--scenario',required=True);parser.add_argument('--parent-pid');args=parser.parse_args()
    try:print(json.dumps(inspect(args.input,args.scenario)),flush=True)
    except Exception as error:parser.exit(1,str(error))
