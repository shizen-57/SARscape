import test from 'node:test'
import assert from 'node:assert/strict'
import {createPayloadCache} from '../backend/src/payload-cache.mjs'

test('payload cache evicts least recently used entries within its byte budget',()=>{
 const cache=createPayloadCache({maxBytes:10,maxEntries:4,now:()=>0})
 cache.set('a','first',100,4);cache.set('b','second',100,4)
 assert.equal(cache.get('a'),'first')
 cache.set('c','third',100,4)
 assert.equal(cache.get('b'),null)
 assert.equal(cache.get('a'),'first');assert.equal(cache.get('c'),'third')
 cache.set('c','replacement',100,6)
 assert.equal(cache.get('a'),'first')
 cache.set('oversized','large',100,11)
 assert.equal(cache.get('oversized'),null);assert.equal(cache.get('c'),'replacement')
 cache.clear();assert.equal(cache.get('a'),null)
})

test('payload cache removes expired entries before evicting live entries and bounds entry count',()=>{
 let time=0
 const cache=createPayloadCache({maxBytes:100,maxEntries:2,now:()=>time})
 cache.set('live','data',100,1);cache.set('expired','old',1,1)
 time=2;cache.set('new','new',100,1)
 assert.equal(cache.get('live'),'data');assert.equal(cache.get('expired'),null)
 cache.set('third','third',100,1)
 assert.equal(cache.get('new'),null)
 time=100;assert.equal(cache.get('live'),null);assert.equal(cache.get('third'),null)
})
