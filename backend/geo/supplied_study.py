"""Prepare the user's paired GOFF/report as a reproducible, read-only study."""
import argparse, datetime as dt, hashlib, json, pathlib, re, shutil, subprocess
import h5py
import numpy as np
from pyproj import Transformer
from pypdf import PdfReader
from goff import ROOT, text, quality_mask, screen_samples, process

def digest(path):
    h=hashlib.sha256()
    with open(path,'rb') as stream:
        while chunk:=stream.read(8*1024*1024): h.update(chunk)
    return h.hexdigest()

def distribution(values):
    v=np.asarray(values);v=v[np.isfinite(v)]
    if not len(v): return None
    q=np.quantile(v,[0,.01,.05,.25,.5,.75,.95,.99,1])
    return dict(zip(['min','p01','p05','p25','median','p75','p95','p99','max'],map(float,q)))|{'mean':float(v.mean()),'count':int(len(v))}

def prepare(source,report,output):
    output.mkdir(parents=True,exist_ok=True)
    reader=PdfReader(report)
    pages=[page.extract_text() for page in reader.pages]
    summary={'id':'supplied','scenario':'aletsch','area':'Aletsch study rectangle, Swiss Alps',
             'extent':next(s['extent'] for s in json.loads((ROOT/'database/scenarios.json').read_text())['scenarios'] if s['id']=='aletsch'),
             'createdAt':dt.datetime.now(dt.timezone.utc).isoformat(),'sourceFilename':source.name,
             'sourceBytes':source.stat().st_size,'sourceSha256':digest(source),'reportFilename':report.name,
             'reportSha256':digest(report),'reportPages':len(pages),'layers':[],
             'interpretation':'A single acquisition pair. Offsets are unfiltered radar-coordinate measurements. Linear interpolation within the 12-day pair is a visualization assumption, not intermediate observations or a forecast. The crop is a study rectangle, not an ice-only outline. No stable-ground bias correction or independent validation is applied.',
             'sources':{'guide':'https://nisar-docs.asf.alaska.edu/goff/','doi':'https://doi.org/10.5067/NIL2GOFF-P1'},
             'qaSections':[
                 {'page':1,'label':'Product and acquisition metadata'},
                 {'page':2,'label':'Layer 1 signed offset maps'},
                 {'page':3,'label':'Layer 1 raw offset histograms'},
                 {'page':4,'label':'Layer 1 combined component display'},
                 {'page':5,'label':'Layer 2 signed offset maps'},
                 {'page':6,'label':'Layer 2 raw offset histograms'},
                 {'page':7,'label':'Layer 2 combined component display'},
                 {'page':8,'label':'Layer 3 signed offset maps'},
                 {'page':9,'label':'Layer 3 raw offset histograms'},
                 {'page':10,'label':'Layer 3 combined component display'},
                 {'page':11,'label':'Layer 1 formal uncertainty maps'},
                 {'page':12,'label':'Layer 1 variance histograms'},
                 {'page':13,'label':'Layer 2 formal uncertainty maps'},
                 {'page':14,'label':'Layer 2 variance histograms'},
                 {'page':15,'label':'Layer 3 formal uncertainty maps'},
                 {'page':16,'label':'Layer 3 variance histograms'},
                 {'page':17,'label':'Layer 1 covariance and correlation'},
                 {'page':18,'label':'Layer 1 covariance and correlation distributions'},
                 {'page':19,'label':'Layer 2 covariance and correlation'},
                 {'page':20,'label':'Layer 2 covariance and correlation distributions'},
                 {'page':21,'label':'Layer 3 covariance and correlation'},
                 {'page':22,'label':'Layer 3 covariance and correlation distributions'}],
             'qaNotes':['The PDF plots the full granule; the interactive study below crops the Aletsch rectangle.',
                        'The report is a diagnostic plot report; it does not supply an overall pass/fail certificate.',
                        'Some variance-histogram captions in the PDF mix standard-deviation wording with squared-metre units. This study uses HDF5 units: variance in m², sigma as its square root in m.']}
    with h5py.File(source) as h:
        identification=h['/science/LSAR/identification']
        granule=text(identification['granuleId'][()])
        if source.stem!=granule or granule not in re.sub(r'\s+','',pages[0]):
            raise ValueError('The report and HDF5 granule identifiers do not match')
        summary['identification']={name:text(identification[name][()]) for name in ['granuleId','missionId','productType','productVersion','productSpecificationVersion','trackNumber','frameNumber','lookDirection','orbitPassDirection','radarBand','processingCenter','processingDateTime','referenceAbsoluteOrbitNumber','secondaryAbsoluteOrbitNumber','referenceZeroDopplerStartTime','secondaryZeroDopplerStartTime']}
        reference=summary['identification']['referenceZeroDopplerStartTime'];secondary=summary['identification']['secondaryZeroDopplerStartTime']
        days=(dt.datetime.fromisoformat(secondary)-dt.datetime.fromisoformat(reference)).total_seconds()/86400
        summary.update(referenceDate=reference,secondaryDate=secondary,pairDays=days,frequency='A',polarization='HH')
        path='/science/LSAR/GOFF/grids/frequencyA/pixelOffsets'
        for layer in ['layer1','layer2','layer3']:
            g=h[f'{path}/HH/{layer}'];x=g['xCoordinates'][:];y=g['yCoordinates'][:];dx=float(x[1]-x[0]);dy=abs(float(y[1]-y[0]));epsg=int(g['projection'][()])
            bounds=Transformer.from_crs(4326,epsg,always_xy=True).transform_bounds(*summary['extent'],densify_pts=21)
            columns=np.flatnonzero((x+dx/2>=bounds[0])&(x-dx/2<=bounds[2]));rows=np.flatnonzero((y+dy/2>=bounds[1])&(y-dy/2<=bounds[3]))
            window=np.s_[rows[0]:rows[-1]+1,columns[0]:columns[-1]+1]
            base,schema=quality_mask(h,path,'HH',window,(len(y),len(x)))
            arrays=[]
            for name in ['alongTrackOffset','slantRangeOffset','alongTrackOffsetVariance','slantRangeOffsetVariance','correlationSurfacePeak']:
                data=g[name][window].astype(np.float32)
                for attr in ['_FillValue','missing_value']:
                    if attr in g[name].attrs:data[data==g[name].attrs[attr]]=np.nan
                arrays.append(data)
            along,slant,av,sv,peak=arrays
            finite=np.logical_and.reduce([np.isfinite(a) for a in arrays]);nonnegative=(av>=0)&(sv>=0);bounded=(peak>=0)&(peak<=1)
            eligible=screen_samples(arrays,base,0)
            yy,xx=np.where(eligible)
            lon,lat=Transformer.from_crs(epsg,4326,always_xy=True).transform(x[columns[0]+xx],y[rows[0]+yy])
            cov=g['crossOffsetVariance'][window];snr=g['snr'][window]
            cells=[];features=[]
            for index,(r,c) in enumerate(zip(yy,xx)):
                values=[int(r),int(c),float(lon[index]),float(lat[index]),float(along[r,c]),float(slant[r,c]),float(np.sqrt(av[r,c])),float(np.sqrt(sv[r,c])),float(peak[r,c]),float(cov[r,c]) if np.isfinite(cov[r,c]) else None,float(snr[r,c]) if np.isfinite(snr[r,c]) else None]
                cells.append(values)
                features.append({'type':'Feature','geometry':{'type':'Point','coordinates':values[2:4]},'properties':{'alongTrack':values[4]/days,'slantRange':values[5]/days,'alongTrackSigma':values[6]/days,'slantRangeSigma':values[7]/days,'correlation':values[8]}})
            stats=[]
            for threshold in [0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]:
                valid=screen_samples(arrays,base,threshold)
                stats.append({'threshold':threshold,'count':int(valid.sum()),'alongTrack':distribution(along[valid]),'slantRange':distribution(slant[valid]),'alongTrackSigma':distribution(np.sqrt(av[valid])),'slantRangeSigma':distribution(np.sqrt(sv[valid]))})
            parameters=h[f'/science/LSAR/GOFF/metadata/processingInformation/parameters/pixelOffsets/frequencyA/{layer}']
            meta={'id':layer,'shape':list(along.shape),'postingMetres':[dx,dy],'epsg':epsg,'maskSchema':schema,'totalSamples':int(base.size),'sourceMaskAccepted':int(base.sum()),'eligibleSamples':len(cells),
                  'rejections':{'sourceMask':int((~base).sum()),'nonfinite':int((base&~finite).sum()),'negativeVariance':int((base&finite&~nonnegative).sum()),'invalidCorrelation':int((base&finite&nonnegative&~bounded).sum())},
                  'windows':{name:int(obj[()]) for name,obj in parameters.items()},'thresholds':stats,
                  'correlation':distribution(peak[base&finite]),'rawAlongTrack':distribution(along[np.isfinite(along)]),'rawSlantRange':distribution(slant[np.isfinite(slant)]),
                  'reportPages':{'offsets':{'layer1':2,'layer2':5,'layer3':8}[layer],'correlation':{'layer1':17,'layer2':19,'layer3':21}[layer]}}
            data={'layer':layer,'shape':meta['shape'],'columns':['row','column','longitude','latitude','alongTrackOffsetM','slantRangeOffsetM','alongTrackSigmaM','slantRangeSigmaM','correlation','crossOffsetVarianceM2','snr'],'cells':cells}
            (output/f'{layer}.json').write_text(json.dumps(data,separators=(',',':'),allow_nan=False))
            (output/f'{layer}.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':'),allow_nan=False))
            product=output/layer
            provenance=process(source,product,'aletsch','A','HH',layer,.3)
            for original,target in [('radar-components.tif','components.tif'),('radar-preview.tif','preview.tif'),('provenance.json','provenance.json')]:
                shutil.copyfile(product/original,output/f'{layer}-{target}')
            meta['defaultAcceptedSamples']=provenance['acceptedSamples'];summary['layers'].append(meta)
            print(f'{layer}: {len(cells)} eligible; {provenance["acceptedSamples"]} pass correlation >= 0.3',flush=True)
    shutil.copyfile(report,output/'qa-report.pdf')
    if shutil.which('pdftoppm'):
        for section in summary['qaSections']:
            page=section['page'];subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-scale-to','1300','-png','-singlefile',str(report),str(output/f'qa-page-{page}')],check=True,creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess,'CREATE_NO_WINDOW') else 0)
    else: summary['qaImagesAvailable']=False
    (output/'summary.json').write_text(json.dumps(summary,indent=2,allow_nan=False))
    print('Prepared supplied NISAR study with matched QA report',flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=pathlib.Path,required=True);parser.add_argument('--report',type=pathlib.Path,required=True)
    args=parser.parse_args();prepare(args.input,args.report,ROOT/'database/processed/supplied-nisar')
