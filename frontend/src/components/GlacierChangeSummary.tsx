import {useMemo} from 'react'
import {summarizeMappedArea,summarizeSpeedChange,summarizeSurface,type MeasurementStats} from '../data/glacier-change.mjs'
import type {SurfaceFrame,SurfaceGrid,SurfaceMode,GlacierOutline} from '../data/glacier-surfaces.mjs'

const number = (value:number, digits=1) => value.toLocaleString('en-GB',{minimumFractionDigits:digits,maximumFractionDigits:digits})
const signed = (value:number, digits=1) => `${value>0?'+':''}${number(value,digits)}`
const median = (stats:MeasurementStats|null) => stats ? `${number(stats.median)} m/year` : 'Unavailable'
const count = (value:number) => number(value,0)

export default function GlacierChangeSummary({mode,frame,baseline,grid,baselineGrid,outline,firstOutline}:{
  mode:SurfaceMode;frame?:SurfaceFrame;baseline?:SurfaceFrame;grid?:SurfaceGrid;baselineGrid?:SurfaceGrid;
  outline?:GlacierOutline;firstOutline?:GlacierOutline
}) {
  const change=useMemo(()=>mode==='change'?summarizeSpeedChange(grid,baselineGrid):null,[mode,grid,baselineGrid])
  const surface=useMemo(()=>mode==='velocity'||mode==='elevation'?summarizeSurface(grid,mode):null,[mode,grid])
  const area=useMemo(()=>mode==='extent'?summarizeMappedArea(outline?.properties,firstOutline?.properties):null,[mode,outline,firstOutline])
  const compatibleFrames=frame?.kind==='velocity'&&baseline?.kind==='velocity'&&frame.units==='m/year'&&baseline.units==='m/year'&&frame.source===baseline.source&&frame.maskYear===baseline.maskYear
  const sameInterval=!!frame&&frame.start===baseline?.start&&frame.end===baseline.end
  return <section className="glacier-change-summary" aria-label="Glacier measurement explanation">
    <h4>{mode==='change'?'What changed?':mode==='extent'?'Mapped area change':mode==='elevation'?'Surface height evidence':'Measured movement'}</h4>
    {mode==='change'?<>
      <dl className="change-periods"><div><dt>A · baseline</dt><dd>{baseline?.label??'Unavailable'}</dd></div><div><dt>B · selected</dt><dd>{frame?.label??'Unavailable'}</dd></div></dl>
      {!compatibleFrames?<p>The sources, masks or units differ. No numerical comparison is shown.</p>:change?.status==='ready'&&change.difference?<>
        <div className="change-headline"><strong>{signed(change.difference.median)} <small>m/year</small></strong><span>Median speed difference · B − A</span></div>
        <p>{sameInterval?'The same interval is selected twice; this self-comparison does not measure change across time.':'A positive value means faster on the shared measured cells; a negative value means slower.'}</p>
        <dl className="change-metrics">
          <div><dt>Median speed A</dt><dd>{median(change.baseline)}</dd></div>
          <div><dt>Median speed B</dt><dd>{median(change.current)}</dd></div>
          <div><dt>Middle half of differences</dt><dd>{signed(change.difference.q25)} to {signed(change.difference.q75)} m/year</dd></div>
          <div><dt>Matched measured cells</dt><dd>{count(change.matchedCells)}</dd></div>
          <div><dt>Retained measurements</dt><dd>{number(change.matchedCells/change.baselineCells*100)}% of A · {number(change.matchedCells/change.currentCells*100)}% of B</dd></div>
        </dl>
        <details className="change-evidence"><summary>How reliable is this comparison?</summary>
          <p>Only locations measured in both intervals are compared. Each cell has equal weight; this is not a whole-glacier or area-weighted estimate. The median difference is calculated cell by cell, not by subtracting the two medians.</p>
          <p>Median reported speed error on matched cells: A {median(change.baselineError)} ({count(change.baselineError?.count??0)}/{count(change.matchedCells)} cells); B {median(change.currentError)} ({count(change.currentError?.count??0)}/{count(change.matchedCells)} cells).</p>
          <p>These errors are not confidence bounds for the median difference. Error dependence and systematic effects are not resolved, so statistical significance is not assessed. Seasonal differences and unequal measurement intervals also affect interpretation.</p>
        </details>
      </>:<p>{change?.reason??'No comparable measurements are available.'}</p>}
      <p className="change-limit">This is a descriptive comparison; statistical significance is not assessed. Speed change does not measure ice loss, melting or landslide probability.</p>
    </>:mode==='extent'?<>
      <dl className="change-periods"><div><dt>A · baseline inventory</dt><dd>{firstOutline?.properties.acquisitionLabel??firstOutline?.properties.year??'Unavailable'}</dd></div><div><dt>B · selected inventory</dt><dd>{outline?.properties.acquisitionLabel??outline?.properties.year??'Unavailable'}</dd></div></dl>
      {area?<><div className="change-headline"><strong>{signed(area.differenceKm2,2)} <small>km²</small></strong><span>Published mapped area · B − A</span></div><dl className="change-metrics"><div><dt>Mapped area A → B</dt><dd>{number(area.baselineKm2,2)} → {number(area.currentKm2,2)} km²</dd></div><div><dt>Relative to A</dt><dd>{signed(area.percent)}%</dd></div></dl>{area.sameInventory&&<p>The same inventory is selected; this is a self-comparison.</p>}</>:<p>Mapped areas are unavailable; no area difference is estimated.</p>}
      <p className="change-limit">Mapping dates and methods differ. This is a mapped-area difference, not ice volume lost or a precise annual retreat rate. The 3D terrain and background imagery stay fixed.</p>
    </>:<>
      <p className="change-period-label">{frame?.label??'No measured interval'}</p>
      {surface?.measurements?<><div className="change-headline"><strong>{mode==='elevation'?signed(surface.measurements.median,2):number(surface.measurements.median)} <small>m/year</small></strong><span>{mode==='elevation'?'Median measured height-change rate':'Median measured surface speed'}</span></div><dl className="change-metrics"><div><dt>Accepted measured cells</dt><dd>{count(surface.measurements.count)}</dd></div><div><dt>Middle half of measurements</dt><dd>{number(surface.measurements.q25,mode==='elevation'?2:1)} to {number(surface.measurements.q75,mode==='elevation'?2:1)} m/year</dd></div>{mode==='velocity'&&<div><dt>Median reported speed error</dt><dd>{median(surface.error)} · {count(surface.error?.count??0)} cells</dd></div>}</dl></>:<p>No accepted measurements are available. Missing locations are not filled.</p>}
      <p className="change-limit">{mode==='elevation'?'Negative values indicate mean surface lowering over the supplied period. Uncertainty is unavailable here. This rate cannot reconstruct absolute heights or intermediate glacier shapes.':'Interval-mean speed is not daily movement or melting. Reported errors omit some systematic effects; independent validation remains necessary.'} Summaries give each accepted cell equal weight, not area weight.</p>
    </>}
  </section>
}
