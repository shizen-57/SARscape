"""Bounded display rasters with explicit quantization error; never replace science values."""
import math
import numpy as np
import rasterio
from rasterio.enums import Resampling

def write_preview(path, bands, crs, transform, names, maximum=512):
    height,width=bands[0].shape
    factor=max(1,math.ceil(max(height,width)/maximum))
    out_h=math.ceil(height/factor);out_w=math.ceil(width/factor)
    reduced=[]
    for band in bands:
        # Invalid measurements do not contribute to the block mean.
        pad=np.full((out_h*factor,out_w*factor),np.nan,dtype=np.float32)
        pad[:height,:width]=band
        blocks=pad.reshape(out_h,factor,out_w,factor)
        counts=np.isfinite(blocks).sum(axis=(1,3))
        total=np.nansum(blocks,axis=(1,3))
        reduced.append(np.divide(total,counts,out=np.full(total.shape,np.nan),where=counts>0))
    scales=[];offsets=[];metadata=[];codes=[]
    for name,values in zip(names,reduced):
        valid=np.isfinite(values)
        lo=float(values[valid].min());hi=float(values[valid].max())
        scale=(hi-lo)/65534 if hi>lo else 1.0
        offset=(hi+lo)/2
        encoded=np.full(values.shape,-32768,dtype=np.int16)
        encoded[valid]=np.clip(np.rint((values[valid]-offset)/scale),-32767,32767).astype(np.int16)
        decoded=encoded[valid].astype(np.float64)*scale+offset
        error=float(np.max(np.abs(decoded-values[valid])))
        scales.append(scale);offsets.append(offset);codes.append(encoded)
        metadata.append({'name':name,'scale':scale,'offset':offset,'maximumQuantizationError':error,'roundingErrorBound':scale/2 if hi>lo else 0.0})
    with rasterio.open(path,'w',driver='GTiff',height=out_h,width=out_w,count=len(bands),dtype='int16',crs=crs,
                       transform=transform*rasterio.Affine.scale(factor,factor),nodata=-32768,tiled=True,compress='deflate') as dst:
        dst.scales=tuple(scales);dst.offsets=tuple(offsets)
        for i,(name,data) in enumerate(zip(names,codes),1):
            dst.write(data,i);dst.set_band_description(i,name)
        dst.update_tags(purpose='Display preview only; aggregated cells are not individual science measurements',aggregation='Mean of accepted finite samples',originalProduct='radar-components.tif')
        factors=[f for f in [2,4,8] if min(out_h,out_w)//f>=1]
        if factors:dst.build_overviews(factors,Resampling.nearest)
    return {'file':'radar-preview.tif','dtype':'int16','nodata':-32768,'maximumDimension':maximum,'shape':[out_h,out_w],
            'aggregationFactor':factor,'aggregation':'Mean of accepted finite samples; uncertainty bands are mean formal sigmas, not uncertainty of the mean',
            'decode':'physical_value = stored_code * band_scale + band_offset','bands':metadata,'originalPreserved':True}
