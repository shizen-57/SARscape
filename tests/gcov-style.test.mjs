import test from 'node:test'
import assert from 'node:assert/strict'
import {gcovImage,gcovStyleOf,trackKey,trackLabel} from '../frontend/src/data/gcov-style.ts'

const full={colorPreview:{terrain:{},shaded:{}}},noTerrain={colorPreview:{shaded:{}}},basic={colorPreview:{}},none={}

test('each radar style maps to its image and falls back to the next radar-driven one',()=>{
 assert.equal(gcovImage('terrain',full),'terrain.webp')
 assert.equal(gcovImage('terrain',noTerrain),'natural.png')
 assert.equal(gcovImage('shaded',basic),'natural.png')
 assert.equal(gcovImage('false',full),'color.png')
 assert.equal(gcovImage('natural',full),'natural.png')
 for(const style of ['terrain','shaded','natural','false','grey'])assert.equal(gcovImage(style,none),'backscatter.png')
 assert.equal(gcovImage('grey',full),'backscatter.png')
})

test('the displayed style reports what is actually shown',()=>{
 assert.equal(gcovStyleOf('terrain',full),'terrain');assert.equal(gcovStyleOf('terrain',noTerrain),'natural')
 assert.equal(gcovStyleOf('shaded',full),'shaded');assert.equal(gcovStyleOf('terrain',none),'grey')
})

test('tracks are keyed and labelled so playback never mixes viewing directions',()=>{
 const a={identification:{trackNumber:'72',orbitPassDirection:'Ascending'}},d={identification:{trackNumber:'37',orbitPassDirection:'Descending'}}
 assert.equal(trackKey(a),'72A');assert.equal(trackKey(d),'37D');assert.notEqual(trackKey(a),trackKey(d))
 assert.equal(trackLabel('72A'),'Track 72 ascending');assert.equal(trackLabel('37D'),'Track 37 descending')
 assert.equal(trackKey({}),'?')
})
