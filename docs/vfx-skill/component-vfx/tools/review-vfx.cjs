const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.resolve(__dirname,'../../../../game/node_modules/@playwright/test'));
const root=path.resolve(__dirname,'../../../..');
const data=JSON.parse(fs.readFileSync(path.join(root,'tools/data/vfx-components.json'),'utf8'));
const palettes=Object.keys(data.palettes),shapes={...data.families,...data.variants};
const old=JSON.parse(fs.readFileSync(path.join(__dirname,'../evidence/manifests/vfx-recipes.json'),'utf8'));
const extra=JSON.parse(fs.readFileSync(path.join(__dirname,'../evidence/manifests/vfx-extra-recipes.json'),'utf8'));
const recipes=[...Object.entries(old).map(([skill,[base,version,parts]])=>({skill,version,parts})),
 ...Object.entries(extra).map(([skill,r])=>({skill,version:r.version,parts:r.shapes}))];
const roster=JSON.parse(fs.readFileSync(path.join(root,'tools/data/skills.json'),'utf8')).skills;
const added=['cone-stream','wall-segment','tether-strand','shockwave-ring','crescent-wave','shield-dome','bind-strand'].map(shape=>({...shapes[shape].master,parts:[shape]}));
const verifiedTimes=new Map((fs.existsSync(path.join(__dirname,'../evidence/manifests/vfx-matrix-evidence.json'))?JSON.parse(fs.readFileSync(path.join(__dirname,'../evidence/manifests/vfx-matrix-evidence.json'),'utf8')):[]).map(r=>[r.skill+'/'+r.version,r.time]));
const nextFrame=page=>page.evaluate(()=>new Promise(requestAnimationFrame));
const selector=(skill,version)=>`[data-vfx-version="pool"] [data-skill-art="${skill}"]`;

async function setup(browser,item,elevation=33,paletteFixture=false){
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 if(elevation!==33)await page.route('**/src/presentation/arena-camera.ts*',async route=>{
  const response=await route.fetch();const original=await response.text();
  const body=original.replace(/(ARENA_CAMERA_ELEVATION_DEG\s*=\s*)33\b/,'$1'+elevation);
  assert.notEqual(body,original,'Camera fixture must replace the actual elevation constant');
  await route.fulfill({response,body});
 });
 if(paletteFixture)await page.route('**/src/ui/fx/catalog.ts*',async route=>{
  const response=await route.fetch();const hook=`\nglobalThis.__vfxReviewPalette = (palette) => {const v=SKILL_VFX_POOL[${JSON.stringify(item.skill)}].find(v=>v.id===${JSON.stringify('pool')});v.palette=palette;for(const l of v.layers)l.palette=palette;};\n`;
  await route.fulfill({response,body:await response.text()+hook});
 });
 await page.goto(`http://localhost:5173/__showcase?sample=combat-field&skill=${item.skill}#showcase-field`,{waitUntil:'domcontentloaded',timeout:30000});
 await prepare(page,item);
 return{page,errors,itemKey:item.skill+'/'+item.version};
}

async function prepare(page,item){
 const skill=page.getByLabel('Skill cast in the arena');
 if(await skill.inputValue()!==item.skill){await skill.selectOption(item.skill);await nextFrame(page)}
 await page.getByLabel('Preview VFX art in the arena').selectOption('version:pool');
 await page.getByRole('button',{name:'Replay encounter',exact:true}).click();
 const step=page.getByRole('button',{name:'Advance simulation 1s',exact:true});
 await step.click();
 if(item.skill==='attack.void_ray'){
  await page.getByRole('button',{name:'Cast at focus',exact:true}).focus();
  await page.keyboard.down('Space');
 }
 for(let i=0;i<3;i++)await step.click();
 if(item.skill==='attack.void_ray')await page.keyboard.up('Space');
 await page.getByLabel('World scale in the arena').evaluate(input=>{input.value='1';input.dispatchEvent(new Event('input',{bubbles:true}))});
 await nextFrame(page);
}

async function seek(page,time){
 await page.getByLabel('Arena animation time').evaluate((input,time)=>{input.value=String(time);input.dispatchEvent(new Event('input',{bubbles:true}))},time);
 await nextFrame(page);
}

async function scan(page,item,layer){
 if(item.skill.startsWith('buff.')){
  await page.getByRole('button',{name:'Replay encounter',exact:true}).click();
  const live=page.locator(selector(item.skill,item.version)).first();
  await live.waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(selector=>{const n=document.querySelector(selector);if(!n)return false;let alpha=1;for(let p=n;p;p=p.parentElement)alpha*=Number(getComputedStyle(p).opacity);return alpha>.2},selector(item.skill,item.version),{timeout:10000});
  const time=await page.getByLabel('Arena animation time').evaluate(input=>{
   const time=Number(input.value);input.dispatchEvent(new Event('input',{bubbles:true}));return time;
  });
  await nextFrame(page);
  const layers=await page.locator(`[data-vfx-version="pool"][data-vfx-layer]`).evaluateAll(nodes=>nodes.filter(n=>n.querySelector('[data-skill-art]')).map(n=>n.getAttribute('data-vfx-layer')));
  return{time,layers,seen:layers};
 }
 const playhead=page.getByLabel('Arena animation time');
 let best=null;const seen=new Set();
 for(let pass=0;pass<5;pass++){
  const min=Number(await playhead.getAttribute('min')),max=Number(await playhead.getAttribute('max'));
  const regular=[];for(let time=min;time<=max;time+=50000)regular.push(time);
  const text=await page.getByLabel('Arena effect timing').textContent();
  const row=roster.find(r=>r.id===item.skill),numbers=(text||'').match(/\d+\.\d+/g);
  const hints=text?.startsWith(row?.name+':')&&numbers?.length===3?(()=>{const [start,release,impact]=numbers.map(Number);return [release+.05,(release+impact)/2,impact+.05,impact+.35].map(t=>Math.round(t*1000000)).filter(t=>t>=min&&t<=max)})():[];
  const known=verifiedTimes.get(item.skill+'/'+item.version);
  const previous=known==null?[]:[known,known-150000,known+150000,known-350000,known+350000,known-600000].filter(t=>t>=min&&t<=max);
  for(const time of [...previous,...hints,...regular]){
   await seek(page,time);
   const layers=await page.locator(`[data-vfx-version="pool"][data-vfx-layer]`).evaluateAll((nodes,{skill,layer})=>nodes.flatMap(n=>{
    const art=n.querySelector(`[data-skill-art="${skill}"]`);if(!art)return[];
    const b=art.getBoundingClientRect();let opacity=1;for(let node=art;node;node=node.parentElement)opacity*=Number(getComputedStyle(node).opacity);return opacity>.15&&b.width>0&&b.height>0&&(!layer||n.getAttribute('data-vfx-layer')===layer)?[n.getAttribute('data-vfx-layer')]:[];
   }),{skill:item.skill,layer});
   for(const id of layers)seen.add(id);
   if(layers.length&&(!best||layers.length>best.layers.length))best={time,layers};
   if(best&&(!item.parts||item.parts.every(part=>seen.has(part))))return{...best,seen:[...seen]};
  }
  if(best)return{...best,seen:[...seen]};
  await page.getByRole('button',{name:'Advance simulation 1s',exact:true}).click();
 }
 return null;
}

async function align(page){
 await page.locator('[data-combat-arena]').evaluate(el=>el.scrollIntoView({block:'start'}));
 await page.mouse.move(5,5);await nextFrame(page);
}

async function recipeCheck(browser,item,elevation=33,matrix=false,shared){
 const context=shared||await setup(browser,item,elevation);
 const {page,errors}=context;
 if(context.itemKey!==item.skill+'/'+item.version){await prepare(page,item);context.itemKey=item.skill+'/'+item.version}
 try{
  const found=await scan(page,item);assert.ok(found,`No rendered recipe ${item.skill}/${item.version}`);
  assert.ok(item.parts.every(part=>found.seen.includes(part)),`${item.skill} missing layers: ${item.parts.filter(part=>!found.seen.includes(part))}`);
  await seek(page,found.time);
  const row=roster.find(r=>r.id===item.skill);
  const group=row.type==='attack'?'attack-'+(row.element==='physical'?'phy':row.element):row.type;
  const meta=JSON.parse(fs.readFileSync(path.join(root,'game/public/fx/skill-pool',group,item.skill.replaceAll('.','-').replaceAll('_','-'),item.version,'meta.json'),'utf8'));
  const contents=Object.fromEntries([meta,...(meta.additionalLayers||[])].map(l=>[l.layerId||'base',{x:l.contentWidthRatio||1,y:l.contentHeightRatio||1}]));
  const factors=matrix?[.5,1,2]:[1];
  for(const factor of factors){
   await page.getByLabel('World scale in the arena').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}))},factor);await nextFrame(page);
   const metrics=await page.locator(selector(item.skill,item.version)).evaluateAll((nodes,contents)=>nodes.map(n=>{
    const m=n.getScreenCTM(),ground=n.hasAttribute('data-skill-ground-shader'),tether=n.hasAttribute('data-skill-tether');
    let coverage=null;
    if(ground){
     const svg=n.querySelector('svg.atlas-frame'),w=Number(svg.getAttribute('width')),h=Number(svg.getAttribute('height'));
     const ratio=contents[n.closest('[data-vfx-layer]').getAttribute('data-vfx-layer')];
     const corners=[[w*(1-ratio.x)/2,h*(1-ratio.y)/2],[w*(1+ratio.x)/2,h*(1-ratio.y)/2],[w*(1+ratio.x)/2,h*(1+ratio.y)/2],[w*(1-ratio.x)/2,h*(1+ratio.y)/2]].map(([x,y])=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f}));
     const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
     const clip=n.parentElement.querySelector('clipPath path'),box=clip.getBBox(),basis=clip.ownerSVGElement.getScreenCTM();
     const center={x:basis.a*(box.x+box.width/2)+basis.c*(box.y+box.height/2)+basis.e,y:basis.b*(box.x+box.width/2)+basis.d*(box.y+box.height/2)+basis.f};
     const scale=Number(n.getAttribute('data-vfx-scale')||1),cw=box.width*basis.a*scale,ch=box.height*basis.d*scale;
     coverage={paint:[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)],clip:[center.x-cw/2,center.y-ch/2,cw,ch]};
    }
    return{ground,tether,x:Math.hypot(m.a,m.b),y:Math.hypot(m.c,m.d),phase:n.getAttribute('data-skill-art-phase'),coverage};
   }),contents);
   assert.ok(metrics.length,`Missing art at zoom ${factor}`);
   for(const m of metrics){
    assert.ok(m.x>0&&m.y>0);
    if(!m.ground&&!m.tether)assert.ok(Math.abs(m.x-m.y)<1e-5,'Billboard must keep uniform scale');
    if(m.ground){
     if(row.area?.shape==='cone'){
      const p=m.coverage.paint,c=m.coverage.clip;
      assert.ok(p[0]<=c[0]+1&&p[1]<=c[1]+1&&p[0]+p[2]>=c[0]+c[2]-1&&p[1]+p[3]>=c[1]+c[3]-1,'Cone material must cover the committed clip');
     }else for(let i=0;i<4;i++)assert.ok(Math.abs(m.coverage.paint[i]-m.coverage.clip[i])<1,'Registered ground content must match the committed clip bounds');
    }
   }
   const order=await page.evaluate(()=>{
    const scene=document.querySelector('[data-combat-arena]'),g=scene.querySelector('.skill-ground-layer'),a=scene.querySelector('.arena-actor');
    let shared=g.parentElement;while(!shared.contains(a))shared=shared.parentElement;
    const rootChild=node=>{while(node.parentElement!==shared)node=node.parentElement;return node};
    const groundHost=rootChild(g),actorHost=rootChild(a),groundStyle=getComputedStyle(groundHost),actorStyle=getComputedStyle(actorHost);
    return{before:!!(g.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING),
     ground:groundStyle.zIndex==='auto'?0:Number(groundStyle.zIndex),actor:actorStyle.zIndex==='auto'?0:Number(actorStyle.zIndex),
     groundStacked:groundStyle.transform!=='none'||groundStyle.zIndex!=='auto'};
   });
   assert.ok(order.before&&order.groundStacked&&order.ground<order.actor,'Ground must paint below actors in the same stacking context');
  }
  assert.deepEqual(errors,[],`${item.skill} console`);
  const directory=path.join(root,'.cache','vfx-captures','recipes');fs.mkdirSync(directory,{recursive:true});
  if(!matrix||elevation===33){await align(page);await page.screenshot({path:path.join(directory,item.skill.replace('.','-')+'-'+item.version+'.png')})}
  verifiedTimes.set(item.skill+'/'+item.version,found.time);
  console.log('PASS recipe',item.skill,item.version,'camera',elevation,'layers',found.seen.join(','));
  return{...item,elevation,...found};
 }finally{if(!shared)await page.close()}
}

async function colorCheck(browser,shape,definition){
 const item=definition.master,{page,errors}=await setup(browser,item,33,true);
 try{
  const found=await scan(page,item,item.layerId);assert.ok(found,`No rendered shape ${shape}`);
  const peak=found.time+(item.skill.startsWith('buff.')?0:150000);
  if(peak>Number(await page.getByLabel('Arena animation time').getAttribute('max')))await page.getByRole('button',{name:'Advance simulation 1s',exact:true}).click();
  found.time=peak;
  await page.addStyleTag({content:`[data-vfx-layer]:not([data-vfx-layer="${item.layerId}"]){display:none!important}`});
  const directory=path.join(root,'.cache','vfx-captures','palettes',shape);fs.mkdirSync(directory,{recursive:true});
  const records=[];let reference;
  for(const palette of palettes){
   await page.getByLabel('Preview VFX art in the arena').selectOption('base');
   await page.locator(`[data-vfx-version="pool"] [data-skill-art="${item.skill}"]`).first().waitFor({state:'hidden'});
   await nextFrame(page);
   await page.evaluate(p=>globalThis.__vfxReviewPalette(p),palette);
   await page.getByLabel('Preview VFX art in the arena').selectOption('version:pool');
   await seek(page,found.time);await align(page);
   const metrics=await page.locator(`[data-vfx-version="pool"][data-vfx-layer="${item.layerId}"]`).evaluateAll(nodes=>{
    const node=nodes.find(n=>n.querySelector('[data-skill-art]'));if(!node)return null;
    const frame=node.querySelector('svg.atlas-frame'),box=frame.getBoundingClientRect();
    return{tables:['R','G','B'].map(c=>node.querySelector('feFunc'+c)?.getAttribute('tableValues')),alphaFunctions:node.querySelectorAll('feFuncA').length,
     box:{width:box.width,height:box.height},source:node.querySelector('image')?.getAttribute('href')};
   });
   assert.ok(metrics,`No palette frame ${shape}/${palette}`);
   const expected=[1,3,5].map(offset=>data.palettes[palette].map(hex=>(parseInt(hex.slice(offset,offset+2),16)/255).toFixed(6)).join(' '));
   assert.deepEqual(metrics.tables,expected,`${shape}/${palette} tables`);assert.equal(metrics.alphaFunctions,0);
   assert.ok(metrics.source.endsWith('/'+item.file));assert.ok(metrics.box.width>0&&metrics.box.height>0);
   if(reference){assert.ok(Math.abs(reference.width-metrics.box.width)<.01);assert.ok(Math.abs(reference.height-metrics.box.height)<.01)}else reference=metrics.box;
   await page.screenshot({path:path.join(directory,palette+'.png')});records.push({shape,palette,...metrics,time:found.time});
  }
  assert.deepEqual(errors,[],`${shape} console`);console.log('PASS color',shape,'7 palettes, unchanged geometry and alpha');return records;
 }finally{await page.close()}
}

(async()=>{
 const browser=await chromium.launch({headless:true});const mode=process.argv[2]||'recipes';
 const evidence=path.join(__dirname,'../evidence/manifests','vfx-'+mode+'-evidence.json');
 const records=['colors','matrix'].includes(mode)&&fs.existsSync(evidence)?JSON.parse(fs.readFileSync(evidence,'utf8')):[];
 try{
  if(mode==='colors')for(const [shape,definition]of Object.entries(shapes)){
   if(process.argv[3]&&shape!==process.argv[3])continue;
   if(records.filter(r=>r.shape===shape).length===7)continue;
   records.push(...await colorCheck(browser,shape,definition));fs.writeFileSync(evidence,JSON.stringify(records,null,2));
  }
  else{
   let items=mode==='recipes'?recipes.filter(r=>extra[r.skill]?.version===r.version):mode==='masters'?added:[...recipes,...added];
   if(process.argv[3])items=items.filter(r=>r.skill===process.argv[3]);
   for(const elevation of(mode==='matrix'?[30,33,45,60,90]:[33])){
    const pending=items.filter(item=>!records.some(r=>r.skill===item.skill&&r.version===item.version&&r.elevation===elevation));
    if(!pending.length)continue;
    const context=await setup(browser,pending[0],elevation);
    try{for(const item of pending){records.push(await recipeCheck(browser,item,elevation,mode==='matrix',context));fs.writeFileSync(evidence,JSON.stringify(records,null,2))}}
    finally{await context.page.close()}
   }
  }
  fs.writeFileSync(evidence,JSON.stringify(records,null,2));
  console.log('PASS',mode,records.length,'records');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
