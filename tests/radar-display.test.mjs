import test from 'node:test'
import assert from 'node:assert/strict'
import {completedRadarJobs,radarDateMilliseconds,radarDisplaySummary,radarDisplayValue} from '../frontend/src/data/radar-display.mjs'

test('pair view reconstructs signed metre offsets using the exact duration, while rate view retains m/day',()=>{
 assert.equal(radarDisplayValue(-18.887,'pair',12),-18.887*12)
 assert.equal(radarDisplayValue(5.725,'rate',12),5.725)
 assert.equal(radarDisplayValue(2,'pair',11.9997),23.9994)
})

test('missing numbers and invalid pair durations never become visible displacements',()=>{
 for(const rate of [null,undefined,'5',NaN,Infinity])assert.equal(radarDisplayValue(rate,'pair',12),null)
 for(const days of [0,-12,NaN,Infinity])assert.equal(radarDisplayValue(5,'pair',days),null)
})

test('display scale resists outliers without changing measurements or discarding their signs',()=>{
 const features=Array.from({length:100},(_,i)=>({properties:{alongTrack:i===99?-10000:i-49,correlation:0.39}}))
 const before=JSON.stringify(features),daily=radarDisplaySummary(features,'alongTrack','rate',12),pair=radarDisplaySummary(features,'alongTrack','pair',12)
 assert.equal(daily.count,100)
 assert.ok(daily.scale<100)
 assert.equal(pair.scale,daily.scale*12)
 assert.equal(JSON.stringify(features),before)
 assert.equal(features.at(-1).properties.alongTrack,-10000)
})

test('empty or zero-valued components produce safe display ranges',()=>{
 assert.deepEqual(radarDisplaySummary([{properties:{alongTrack:null}}],'alongTrack','pair',12),{scale:null,count:0})
 assert.deepEqual(radarDisplaySummary([{properties:{alongTrack:0}}],'alongTrack','pair',12),{scale:0.001,count:1})
})

test('NISAR nanosecond timestamps without an offset are treated as UTC',()=>{
 assert.equal(radarDateMilliseconds('2026-09-23T04:27:22.000000000'),Date.UTC(2026,8,23,4,27,22))
 assert.equal(radarDateMilliseconds('2026-10-05T00:00:00.123456789Z'),Date.UTC(2026,9,5,0,0,0,123))
})

test('timeline exposes only completed dated pairs, including a pair that crosses years',()=>{
 const pair=(id,referenceDate,secondaryDate,status='complete')=>({id,status,provenance:{referenceDate,secondaryDate,pairDays:12}})
 const jobs=[pair('real','2026-09-23T04:27:22.000000000','2026-10-05T04:27:22.000000000'),pair('pending','2027-01-01','2027-01-13','queued'),pair('invalid','unknown','unknown'),pair('reversed','2026-10-05T00:00:00','2026-09-23T00:00:00'),pair('cross-year','2026-12-25T00:00:00Z','2027-01-06T00:00:00Z')]
 assert.deepEqual(completedRadarJobs(jobs).map(j=>j.id),['cross-year','real'])
 assert.equal(jobs.length,5)
})
