"""Regional Hugonnet elevation-change rates. This is not a dated DEM sequence."""
import csv, io, json, pathlib
from prepare_glacier_surfaces import ROOT,OUT,ROWS,COLS,GRID,BBOX,W,S,E,N,download_small,write_json,mask_for,warp,persist
import requests, numpy as np, rasterio
from PIL import Image

BASE='https://cluster.klima.uni-bremen.de/~oggm/geodetic_ref_mb_maps/'
def main():
    session=requests.Session()
    lookup=download_small(session,BASE+'hugonnet_dhdt_lookup_csv_20230129.csv',ROOT/'data/surfaces/hugonnet-lookup.csv',2*1024**2)
    records=list(csv.DictReader(io.StringIO(lookup.decode())))
    ids=['N46E007','N46E008'];values=np.full((ROWS,COLS),np.nan,np.float32);sources=[]
    for tile in ids:
        record=next(r for r in records if r['file_id']==tile)
        url=BASE+record['dhdt'];path=ROOT/f'data/surfaces/{tile}-dhdt.tif'
        download_small(session,url,path,20*1024**2)
        with rasterio.open(path) as src:
            source=src.read(1,masked=True).astype(float).filled(np.nan)
            field=warp(source,src.transform,src.crs)
            ok=np.isfinite(field);values[ok]=field[ok]
        sources.append(url)
        print(json.dumps({'tile':tile,'url':url,'bytes':path.stat().st_size}),flush=True)
    outlines=json.loads((OUT/'outlines.geojson').read_text());mask=mask_for(outlines['features'][0])
    valid=mask & np.isfinite(values) & (np.abs(values)<=20)
    # Fixed diverging scale: negative (surface lowering) red, positive (surface gain) blue.
    image=np.zeros((ROWS,COLS,4),np.uint8);t=np.clip((values+5)/10,0,1)
    for channel,stops in enumerate([[213,240,36],[61,243,124],[58,245,180]]):image[:,:,channel]=np.nan_to_num(np.interp(t,[0,.5,1],stops))
    image[:,:,3]=np.where(valid,225,0);Image.fromarray(image).save(OUT/'elevation-hugonnet.png')
    with rasterio.open(OUT/'elevation-hugonnet.tif','w',driver='GTiff',height=ROWS,width=COLS,count=1,dtype='float32',crs=3857,transform=GRID,nodata=np.nan,compress='deflate') as f:f.write(np.where(valid,values,np.nan).astype(np.float32),1);f.set_band_description(1,'Elevation change rate (m/year), 2000-01-01 to 2020-01-01')
    write_json(OUT/'elevation-hugonnet.json',{'shape':[ROWS,COLS],'bounds3857':[W,S,E,N],'elevationChange':[round(float(v),3) if ok else None for v,ok in zip(values.ravel(),valid.ravel())],'speed':[None]*(ROWS*COLS),'vx':[None]*(ROWS*COLS),'vy':[None]*(ROWS*COLS),'error':[None]*(ROWS*COLS),'vectorCrs':'EPSG:3857'})
    manifest=json.loads((OUT/'manifest.json').read_text())
    manifest['frames']=[f for f in manifest['frames'] if f['kind']!='elevation']+[{'id':'elevation-hugonnet','kind':'elevation','date':'2020-01-01','start':'2000-01-01','end':'2020-01-01','label':'2000 → 2020 elevation-change rate','source':'Hugonnet et al. (2021), OGGM distribution','sourceUrl':'https://doi.org/10.1038/s41586-021-03436-z','rasterSources':sources,'sensor':'ASTER DEM time series','units':'m/year','coverage':float(valid.sum()/mask.sum()),'maskYear':1973,'image':'elevation-hugonnet.png','grid':'elevation-hugonnet.json','raster':'elevation-hugonnet.tif','intervalDays':7305,'interpretation':'Measured multi-DEM elevation-change rate over the full 2000–2020 interval (inclusive calendar years 2000–2019). It cannot establish the height at individual intermediate dates. Masked to the 1973 inventory to include formerly glaciated terrain. Missing cells are transparent; uncertainty raster is not connected.'}]
    manifest['elevation']={'available':True,'geometryAvailable':False,'reason':'A measured 2000–2020 elevation-change rate is available. Absolute dated DEM surfaces are not connected, so terrain geometry stays fixed and no intermediate elevation epochs are invented.'}
    manifest['elevationScale']=[-5,5]
    write_json(OUT/'manifest.json',manifest)
    persist(manifest,outlines)
    print(json.dumps({'coverage':float(valid.sum()/mask.sum()),'range':[float(np.nanmin(values[valid])),float(np.nanmax(values[valid]))]}),flush=True)

if __name__=='__main__':main()
