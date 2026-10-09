import {chromium,expect} from '@playwright/test'
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'})
const errors=[],failed=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('response',r=>{if(r.url().includes('/api/imagery/aerial/')&&r.status()!==200)failed.push({url:r.url(),status:r.status()})})
const settle=async()=>{await page.waitForFunction(()=>document.querySelector('.map-error,.layer-request-status.error')||(!document.querySelector('.map-loading,.layer-request-status')&&document.querySelector('.date-display strong')?.textContent!=='—'),{},{timeout:120000});await expect(page.locator('.map-error,.layer-request-status.error')).toHaveCount(0);await page.waitForTimeout(600)}
try{
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded',timeout:60000});await settle()
 await expect(page.getByLabel('Image source')).toHaveValue('swissimage')
 await expect(page.getByRole('button',{name:'Inspect detail',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'Look closer',exact:true}).click();await settle()
 await page.locator('.image-adjustments summary').click()
 await page.getByLabel('Highlights',{exact:true}).fill('0.78')
 await page.getByLabel('Contrast',{exact:true}).fill('0.08')
 await page.screenshot({path:'.impeccable/review/aerial-detail-desktop.png',fullPage:true})
 await page.getByRole('button',{name:'Reset image',exact:true}).click();await expect(page.getByLabel('Highlights',{exact:true})).toHaveValue('1')
 await page.getByRole('button',{name:'Compare captures',exact:true}).click();await settle()
 await expect(page.locator('.compare-dates')).toContainText('2018');await expect(page.locator('.compare-dates')).toContainText('2025')
 await page.getByRole('button',{name:'Exit comparison',exact:true}).click();await settle()
 await page.getByRole('button',{name:'Explore the globe',exact:true}).click();await page.waitForTimeout(2300)
 await expect(page.getByRole('button',{name:'Return to Aletsch Glacier',exact:true})).toBeVisible()
 await page.screenshot({path:'.impeccable/review/globe-desktop.png',fullPage:true})
 await page.getByRole('button',{name:'Return to Aletsch Glacier',exact:true}).click();await settle()
 for(const name of ['Langtang Glacier','Columbia Glacier']){
  await page.getByRole('button',{name:new RegExp(name)}).first().click();await settle()
  await expect(page.getByRole('button',{name:'Play timeline',exact:true})).toBeDisabled()
  await expect(page.locator('.map-top-actions')).toContainText('Reference · undated')
  await page.getByRole('button',{name:'Look closer',exact:true}).click();await settle()
 }
 await page.getByRole('button',{name:/Aletsch Glacier/}).first().click();await settle()
 await page.setViewportSize({width:390,height:844});await settle()
 await page.screenshot({path:'.impeccable/review/aerial-mobile.png',fullPage:true})
 if(errors.length||failed.length)throw new Error(JSON.stringify({errors,failed}))
 console.log('Verified real aerial tiles, detail, image adjustment/reset, year-labelled comparison, globe and return, and mobile; no page or tile errors.')
}finally{await browser.close()}
