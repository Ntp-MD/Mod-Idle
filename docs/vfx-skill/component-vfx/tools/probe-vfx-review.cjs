const path=require('node:path');
const {chromium}=require(path.resolve(__dirname,'../../../../game/node_modules/@playwright/test'));
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const skill=process.argv[2]||'attack.fissure';
  await page.goto(`http://localhost:5173/__showcase?sample=combat-field&skill=${skill}#showcase-field`,{waitUntil:'domcontentloaded'});
  await page.getByLabel('Preview VFX art in the arena').selectOption('version:pool');
  const speed=page.getByTitle('Clock speed ×4');if(await speed.count())await speed.click();
  const playhead=page.getByLabel('Arena animation time');
  await page.waitForFunction(()=>Number(document.querySelector('[aria-label="Arena animation time"]')?.max)>=7000000,{timeout:15000});
  const pause=page.getByRole('button',{name:'Pause game',exact:true});if(await pause.count())await pause.click();
  const min=Number(await playhead.getAttribute('min')),max=Number(await playhead.getAttribute('max'));
  const found=[];
  for(let time=min;time<=max;time+=100000){
   await playhead.evaluate((input,t)=>{input.value=String(t);input.dispatchEvent(new Event('input',{bubbles:true}))},time);
   await page.evaluate(()=>new Promise(requestAnimationFrame));
   const art=await page.locator(`[data-skill-art="${skill}"]`).count();
   if(art){found.push({time,art,layers:await page.locator(`[data-skill-art-source][data-skill-action]`).evaluateAll(nodes=>nodes.filter(n=>n.querySelector('[data-skill-art]')).map(n=>n.getAttribute('data-vfx-layer')))});if(found.length>=3)break;}
  }
  console.log(JSON.stringify({skill,version,min,max,found,errors,buttons:await page.getByRole('button').allTextContents()},null,2));
  if(found.length)await page.screenshot({path:'.cache/vfx-captures/vfx-probe.png'});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
