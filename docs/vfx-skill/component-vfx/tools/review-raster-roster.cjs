// Source-shelf review only; uses one headless 1920x1080 tab and closes it.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../..');
const {chromium}=require(path.join(root,'game/node_modules/@playwright/test'));
const shelf=path.join(root,'docs/vfx-skill/component-vfx/outputs');

(async()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(shelf,'generation-prompts.json')));
  const additions=manifest.masters.filter(row=>row.authoringKind==='raster-still');
  assert.ok(additions.length,'No raster additions to review');
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  try{
    await page.goto('http://127.0.0.1:5173/@fs/'+path.join(shelf,'index.html').replaceAll('\\','/'));
    assert.equal(await page.locator('article[data-shape]').count(),manifest.masters.length);
    await page.locator('#filter').fill('contact-flash');
    assert.equal(await page.locator('article:not([hidden])').count(),1);
    assert.equal(await page.locator('article:not([hidden]) h3').textContent(),'contact-flash');
    await page.locator('#filter').fill('raster addition');
    assert.equal(await page.locator('article:not([hidden])').count(),additions.length);
    await page.locator('article:not([hidden]) img').evaluateAll(images=>images.forEach(image=>image.loading='eager'));
    await page.waitForFunction(()=>[...document.querySelectorAll('article:not([hidden]) img')].every(image=>image.complete&&image.naturalWidth>0),null,{timeout:45000});
    const snapshot=await page.getByRole('heading',{level:1}).ariaSnapshot();
    const captures=path.join(root,'.cache/vfx-captures');fs.mkdirSync(captures,{recursive:true});
    await page.screenshot({path:path.join(captures,'raster-roster.png')});
    assert.deepEqual(errors,[]);
    const report={scope:'2d-raster-source-gallery',viewport:[1920,1080],shapeCount:manifest.masters.length,
      additions:additions.map(row=>row.shape),loadedNewImages:additions.length*2,filterVerified:true,
      errors,humanApproval:'pending',runtimeAdoption:'not-performed',snapshot};
    fs.writeFileSync(path.join(shelf,'qa/raster-roster-review.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report));
  }finally{await page.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
