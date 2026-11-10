const path=require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(path.resolve(__dirname,'../../../../game/node_modules/@playwright/test'));
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const source='/fx/skill-pool/attack-fire/attack-fireball/v3/projectile-core.png';
  await page.route('**'+source,route=>route.fulfill({contentType:'image/png',body:Buffer.from([0,1,2,3])}));
  await page.goto('http://localhost:5173/__showcase?sample=combat-field&skill=attack.fireball#showcase-field',{waitUntil:'domcontentloaded'});
  await page.getByLabel('Preview VFX version in the arena').selectOption('version:pool-v3');
  await page.waitForFunction(async src=>(await import('/src/ui/fx/vfx-assets.svelte.ts')).getVfxAssetStatus(src)==='failed',source);
  const states=await page.evaluate(async src=>{
   const m=await import('/src/ui/fx/vfx-assets.svelte.ts');
   const before=m.getVfxAssetStatus(src);m.reportVfxAssetFailure(src);m.reportVfxAssetFailure(src);
   return [before,m.getVfxAssetStatus(src)];
  },source);
  assert.deepEqual(states,['failed','failed']);
  assert.equal(await page.locator(`[data-skill-art-source="${source}"] image`).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: corrupt master image reaches failed; duplicate reports are idempotent; no failed frame, page crash or console error.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
