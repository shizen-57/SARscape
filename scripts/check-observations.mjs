import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {performance} from 'node:perf_hooks'
const directory='.impeccable/review'
await mkdir(directory,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'})
const page=await context.newPage(),responses=[],errors=[]
page.on('pageerror',error=>errors.push(error.message))
page.on('console',message=>{if(message.type()==='error')console.log('Browser error:',message.text().slice(0,300))})
page.on('response',response=>{if(response.url().includes('/api/imagery/tiles/'))responses.push({url:new URL(response.url()).pathname,status:response.status()})})
const settled=async label=>{
 const start=performance.now()
 await page.waitForFunction(()=>document.querySelector('.map-error')||(!document.querySelector('.map-loading')&&!document.querySelector('.layer-request-status:not(.error)')),{},{timeout:210000})
 const failure=await page.locator('.layer-request-status.error,.map-error').allTextContents()
 console.log(JSON.stringify({label,milliseconds:Math.round(performance.now()-start),failure,tiles:responses.length,failedTiles:responses.filter(r=>r.status!==200),errors}))
 return failure.length===0
}
try{
 await page.goto('http://127.0.0.1:5173/#explore',{waitUntil:'domcontentloaded'})
 await page.getByRole('button',{name:/Select capture 2018/}).first().click()
 const initial=await settled('initial 2018 capture')
 await page.screenshot({path:`${directory}/desktop.png`,fullPage:true})
 if(!initial){await writeFile(`${directory}/observation-report.json`,JSON.stringify({responses,errors},null,2));process.exitCode=1}
 else{
  await page.getByRole('button',{name:'Select capture 2025-08-08',exact:true}).click()
  if(!await settled('2025 capture'))process.exitCode=1
  await page.getByRole('button',{name:'Compare captures',exact:true}).click()
  if(!await settled('2018 / 2025 comparison'))process.exitCode=1
  await page.screenshot({path:`${directory}/comparison.png`,fullPage:true})
  await page.getByRole('button',{name:'Exit comparison',exact:true}).click()
  await settled('exit comparison')
  await page.setViewportSize({width:1507,height:884});await page.screenshot({path:`${directory}/user-1507.png`,fullPage:true})
  await page.setViewportSize({width:390,height:844});await settled('mobile capture');await page.screenshot({path:`${directory}/mobile.png`,fullPage:true})
  await page.getByRole('button',{name:'Data & sources',exact:true}).click();await page.getByRole('heading',{name:'Process a radar observation'}).waitFor();await page.screenshot({path:`${directory}/mobile-data.png`,fullPage:true})
  await writeFile(`${directory}/observation-report.json`,JSON.stringify({responses,errors},null,2))
  if(errors.length||responses.some(r=>r.status!==200))process.exitCode=1
 }
}finally{await browser.close()}
