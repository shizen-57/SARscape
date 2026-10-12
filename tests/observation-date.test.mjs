import test from 'node:test'
import assert from 'node:assert/strict'
import {hasDisplayDate} from '../frontend/src/data/observation-date.mjs'

test('only acquisition timestamps and explicitly year-labelled mosaics have display dates',()=>{
 assert.equal(hasDisplayDate({date:'2026-09-23T04:27:22Z'}),true)
 assert.equal(hasDisplayDate({date:'2025',datePrecision:'mosaic-year'}),true)
 assert.equal(hasDisplayDate({date:'Undated',datePrecision:'undated'}),false)
 assert.equal(hasDisplayDate({date:'not-a-date'}),false)
 assert.equal(hasDisplayDate({}),false)
})
