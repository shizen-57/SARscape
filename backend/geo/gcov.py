"""Crop real diagonal GCOV power; preserve masks, dB and provenance."""
import datetime as dt,hashlib,json,pathlib
import h5py
import numpy as np
import rasterio
from rasterio.transform import Affine
from pyproj import CRS,Transformer
from goff import text
from inspect_nisar import DIAGONALS,receive_only
ROOT=pathlib.Path(__file__).resolve().parents[2]

def process(source,output,scenario_id,frequency='A',polarization='HH'):
    scenario=next(s for s in json.loads((ROOT/'database/scenarios.json').read_text())['scenarios'] if s['id']==scenario_id)
    output=pathlib.Path(output);output.mkdir(parents=True,exist_ok=True)
    with h5py.File(source,'r') as h:
        identity=h['/science/LSAR/identification']
        if text(identity['productType'][()])!='GCOV' or text(identity['missionId'][()])!='NISAR':raise ValueError('A NISAR L2 GCOV file is required')
        if receive_only(h,frequency,polarization):raise ValueError('Receive-only noise/calibration channel cannot be treated as backscatter')
        path=f'/science/LSAR/GCOV/grids/frequency{frequency}';group=h[path];term=DIAGONALS[polarization]
        dataset=group[term]
        if np.issubdtype(dataset.dtype,np.complexfloating):raise ValueError('Diagonal backscatter must be real-valued power')
        if text(dataset.attrs.get('units',''))!='1':raise ValueError('GCOV power must use dimensionless units 1')
        parameters=h.get('/science/LSAR/GCOV/metadata/processingInformation/parameters')
        conventions={}
        for key in ['outputBackscatterNormalizationConvention','outputBackscatterExpressionConvention']:
            if parameters is not None and 'rtc/'+key in parameters:conventions[key]=text(parameters['rtc/'+key][()])
        expression=conventions.get('outputBackscatterExpressionConvention','linear').lower()
        if expression not in ['linear','linear power','linear_power']:raise ValueError('Only declared linear-power GCOV inputs are supported')
        x=group['xCoordinates'][:];y=group['yCoordinates'][:];dx=float(x[1]-x[0]);dy=float(y[1]-y[0]);crs=CRS.from_epsg(int(group['projection'][()]))
        if not crs.is_projected or crs.axis_info[0].unit_name!='metre' or dx<=0 or dy>=0 or not np.allclose(np.diff(x),dx) or not np.allclose(np.diff(y),dy):raise ValueError('A regular projected metre grid is required')
        bounds=Transformer.from_crs(4326,crs,always_xy=True).transform_bounds(*scenario['extent'],densify_pts=21)
        columns=np.flatnonzero((x+dx/2>=bounds[0])&(x-dx/2<=bounds[2]));rows=np.flatnonzero((y+abs(dy)/2>=bounds[1])&(y-abs(dy)/2<=bounds[3]))
        if not len(columns) or not len(rows):raise ValueError('This GCOV file does not intersect the selected study area')
        window=np.s_[rows[0]:rows[-1]+1,columns[0]:columns[-1]+1];shape=(len(y),len(x))
        if dataset.shape!=shape or group['mask'].shape!=shape:raise ValueError('Mismatched GCOV grids')
        power=dataset[window].astype(np.float32);mask=group['mask'][window]
        accepted=(mask>0)&(mask!=255)&np.isfinite(power)&(power>=0)
        for attr in ['_FillValue','missing_value']:
            if attr in dataset.attrs:accepted&=power!=dataset.attrs[attr]
        exceptions=None
        if 'inputDataExceptionMask' in group:
            if group['inputDataExceptionMask'].shape!=shape:raise ValueError('Mismatched input exception mask')
            exceptions=group['inputDataExceptionMask'][window].astype(np.uint16)
            bits={'HH':256,'HV':512,'VH':1024,'VV':2048,'RH':16384,'RV':32768}
            accepted&=(exceptions!=65535)&((exceptions&bits[polarization])!=0)&((exceptions&2)==0)
        if not accepted.any():raise ValueError('No GCOV cells passed source masks in this study area')
        power=np.where(accepted,power,np.nan);db=np.full(power.shape,np.nan,dtype=np.float32)
        np.log10(power,out=db,where=accepted&(power>0));db*=10
        transform=Affine(dx,0,float(x[columns[0]]-dx/2),0,dy,float(y[rows[0]]-dy/2))
        bands=[power,db,np.where(accepted,mask,np.nan).astype(np.float32)];names=['linear_backscatter_power','backscatter_db','valid_subswath_mask']
        if 'numberOfLooks' in group:
            if group['numberOfLooks'].shape!=shape:raise ValueError('Mismatched number of looks grid')
            looks=group['numberOfLooks'][window].astype(np.float32);looks=np.where(np.isfinite(looks)&accepted,looks,np.nan)
            bands.append(looks);names.append('number_of_looks')
        else:looks=None
        with rasterio.open(output/'radar-components.tif','w',driver='GTiff',width=len(columns),height=len(rows),count=len(bands),dtype='float32',crs=crs,transform=transform,nodata=np.nan,tiled=True,compress='deflate') as dst:
            for i,(values,name) in enumerate(zip(bands,names),1):dst.write(values,i);dst.set_band_description(i,name)
            factors=[f for f in [2,4,8,16] if min(power.shape)//f>=1]
            if factors:dst.build_overviews(factors,rasterio.enums.Resampling.average)
        yy,xx=np.where(accepted);stride=max(1,int(np.ceil(len(xx)/5000)));yy,xx=yy[::stride],xx[::stride]
        lon,lat=Transformer.from_crs(crs,4326,always_xy=True).transform(x[columns[0]+xx],y[rows[0]+yy])
        def finite(value):return float(value) if np.isfinite(value) else None
        features=[{'type':'Feature','geometry':{'type':'Point','coordinates':[float(lon[i]),float(lat[i])]},'properties':{'backscatterDb':finite(db[r,c]),'power':finite(power[r,c]),'sourceMask':int(mask[r,c]),'inputExceptionMask':int(exceptions[r,c]) if exceptions is not None else None,'looks':finite(looks[r,c]) if looks is not None else None}} for i,(r,c) in enumerate(zip(yy,xx))]
        (output/'samples.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},allow_nan=False))
        digest=hashlib.sha256()
        with open(source,'rb') as file:
            while chunk:=file.read(8*1024*1024):digest.update(chunk)
        provenance={'scenario':scenario_id,'sourceFilename':pathlib.Path(source).name,'sha256':digest.hexdigest(),'mission':'NISAR','product':'GCOV','frequency':frequency,'polarization':polarization,'term':term,'date':text(identity['zeroDopplerStartTime'][()]),'units':'dB / linear power','epsg':crs.to_epsg(),'postingMetres':[dx,abs(dy)],'acceptedSamples':int(accepted.sum()),'totalSamples':int(accepted.size),'returnedSamples':len(features),'bands':names,
          'identification':{key:text(identity[key][()]) for key in ['granuleId','productVersion','productSpecificationVersion','compositeReleaseId','trackNumber','lookDirection','orbitPassDirection'] if key in identity},'conventions':conventions,'expressionFallback':not bool(conventions.get('outputBackscatterExpressionConvention')),
          'processing':{key:text(parameters[key][()]) for key in ['noiseCorrectionApplied','radiometricTerrainCorrectionApplied','polarimetricSymmetrizationApplied','shadowMaskingApplied'] if parameters is not None and key in parameters},
          'qualityMask':'Valid positive subswath code except 255, finite nonnegative power; input valid-channel bit and no sample slip if inputDataExceptionMask exists. This is not a water or forest classification.',
          'zeroPowerSamples':int((accepted&(power==0)).sum()),'dbCalculation':'10 * log10(linear power); zero power has no finite dB value.',
          'validation':'Calibrated backscatter from a real acquisition; low-return candidates and changes require independent water/land-cover validation.', 'createdAt':dt.datetime.now(dt.timezone.utc).isoformat(),'schemaSource':'https://nisar-docs.asf.alaska.edu/gcov/'}
        (output/'provenance.json').write_text(json.dumps(provenance,indent=2,allow_nan=False));return provenance
