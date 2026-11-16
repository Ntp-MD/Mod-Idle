/** CPU ports of Binbun's CC0 BattleFX, HitFX and MagicProjectiles masks.
 * Polar/strip UVs replace 3D meshes; deterministic noise replaces noise_texture.
 * Godot emission is tone-mapped, and depth fade/3D normal displacement are omitted.
 * Arrow Shower and Double Strafe are ONE payload: the engine owns burst emission.
 */
import { clamp, smooth, fract, hash, fbm, over, renderPixels, TAU, DURATION_SEC } from './shader-math.mjs';

const BATTLE = 'archive/art-reference/VFX-Godot/BattleFXFree/assets/BinbunVFX_Vol2/BattleFX/shader/';
const HIT = 'archive/art-reference/VFX-Godot/HitFXFree/assets/BinbunVFX_Vol2/StylizedHitFX/shader/';
const PROJECTILE = 'archive/art-reference/VFX-Godot/MagicProjectilesVFX/assets/BinbunVFX/shared/shader/';
export const licenseFiles = [
  'archive/art-reference/VFX-Godot/BattleFXFree/assets/BinbunVFX_Vol2/BattleFX/license.txt',
  'archive/art-reference/VFX-Godot/HitFXFree/assets/BinbunVFX_Vol2/StylizedHitFX/license.txt',
];
const steel = [.7, .87, 1], white = [1, .98, .88], gold = [1, .64, .2], blood = [.98, .2, .18];
const overlay = (a, b) => a < .5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
const rotated = (x, y, a) => [x * Math.cos(a) + y * Math.sin(a), y * Math.cos(a) - x * Math.sin(a)];
const life = t => (.38 + .62 * smooth(0, .14, t)) * (1 - smooth(.59, 1, t));
const band = (v, center, width) => 1 - smooth(width * .45, width, Math.abs(v - center));

// slash.fragment: circular sixth-power leading edge plus moving radial wave.
function slashValue(x, y, time, decay) {
  const r = Math.hypot(x, y), u = (x + 1) * .5, v = (y + 1) * .5;
  if (r > 1 || u <= 0 || u >= 1) return 0;
  let slash = smooth(0, .6, clamp(u ** 6 - (1 - r) * .5));
  slash += Math.abs(Math.sin(r * TAU + time * TAU) * Math.max(u * 2 - 1.2, 0));
  const noiseMask = Math.max((1 - Math.abs(v * 2 - 1) ** 4) * u, 0) ** .6;
  const n = fbm(u * 5 + time, v * 3);
  const value = Math.max(clamp(n - (1 - noiseMask) + slash) - decay - .09, 0);
  return clamp(value / .22) * (1 - smooth(.96, 1, r));
}

// swing.fragment: overlay of noisy polar band, intersected moving half-planes.
function swingValue(x, y, time, factor, center = .86) {
  const r = Math.hypot(x, y), a = Math.atan2(x, y), f = factor * TAU - Math.PI;
  if (r >= 1) return 0;
  const moving = Math.max(Math.sin(a + f), 0), base = Math.max(Math.sin(a), 0);
  let shape = clamp((r - .2) / (.8 - (1 - center))) - clamp((r - center) / (1 - center));
  shape = Math.max(shape - (Math.sin((r * TAU - time) * 6) * .5 + .5) * .1, 0) ** 3;
  const n = fbm(a / TAU * 13 + time * .5, r * 4);
  const value = clamp((overlay(shape, n) - (1 - moving) * .5) * moving * base - .05);
  return clamp(value / .2);
}

// claw.sample_mask: the original negative sine times triangular claw_factor gate.
function clawValue(u, v, factor, width) {
  if (u < 0 || u > 1) return 0;
  let gate = 1 - Math.max((u - .5) / .5 + (factor * 2 - 1), 0);
  gate = 1 - Math.abs(gate * 2 - 1);
  const mask = clamp(-Math.sin(u * TAU) * gate);
  const curved = v - Math.sin(u * Math.PI) * .055;
  return smooth(.01, .08, mask) * (1 - smooth(width * .45 * mask, width * Math.max(mask, .03), Math.abs(curved)));
}

// impact_core.fragment: growing irregular seven-lobed ring; used once per hit.
function hitCore(x, y, t, lobes = 7, scale = .73) {
  const r = Math.hypot(x, y) / scale, a = Math.atan2(x, y), factor = (.3 + t * .63) * 4 - 1;
  const offset = Math.abs(Math.sin(a * lobes * .5 + t)) * r + Math.sin(a * 10) * r * .1;
  const radius = r + offset * .5;
  const value = (1 - Math.abs(radius * 2 - factor)) * Math.max(1 - radius, 0) ** .1;
  return smooth(.23, .52, value);
}

// four_point_star.fragment, with COLOR.a expressed as explicit decay.
function star(x, y, shape = .55) {
  return 1 - smooth(.83, .98, Math.abs(x) ** shape + Math.abs(y) ** shape);
}

function sparks(out, x, y, t, color, count = 9, span = TAU, offset = 0) {
  for (let i = 0; i < count; i++) {
    const a = offset + (i + .2) / count * span, rr = .12 + .61 * smooth(.08, .7, t);
    const dx = x - Math.cos(a) * rr, dy = y - Math.sin(a) * rr;
    const [u, v] = rotated(dx, dy, a);
    const width = .013 + hash(i, 8) * .011;
    // attack_particles: subtract radius and particle decay from scrolling noise.
    const radius = Math.hypot(u / (width * 3.1), v / width);
    const value = Math.max(.94 - radius - smooth(.32, 1, t) * .8, 0);
    over(out, color, clamp(value / .22) * (1 - smooth(.66, 1, t)));
  }
}

function renderCut(size, time, style) {
  const t = clamp(time / DURATION_SEC), fade = life(t);
  return renderPixels(size, (x, y, out) => {
    if (Math.hypot(x, y) > .94) return;
    if (style === 'backstab' || style === 'sidestep' || style === 'puncture') {
      const a = style === 'backstab' ? -.72 : style === 'sidestep' ? .42 : -1.2;
      const [sx, sy] = rotated(x, y, a);
      const u = (sx / .8 + 1) * .5;
      const cut = clawValue(u, sy, .12 + smooth(0, .65, t) * .43, style === 'puncture' ? .075 : .13);
      over(out, style === 'puncture' ? blood : steel, cut * fade);
      over(out, white, clawValue(u, sy, .16 + t * .25, .028) * fade);
      const r = Math.hypot(x + .1, y);
      over(out, style === 'puncture' ? blood : gold, star((x + .1) / .34, y / .32) * (1 - smooth(.15, .5, t)));
      if (style === 'sidestep') {
        const ghost = slashValue((sx + .15) / .68, (sy + .19) / .7, time, .2 + t * .3);
        over(out, [.28, .52, .8], ghost * fade * .32);
      }
      if (style === 'puncture') over(out, blood, (1 - smooth(.02, .1, Math.abs(x + .15 + Math.sin(y * 10) * .02))) * smooth(.08, .25, y) * (1 - smooth(.3, .7, y)) * fade * .6);
      return;
    }
    if (style === 'cleave-down') {
      const [sx, sy] = rotated(x, y, Math.PI * .5);
      over(out, gold, slashValue(sx / .8, sy / .52, time, t * .52) * fade);
      over(out, white, star(x / .3, (y - .28) / .33) * (1 - smooth(.2, .6, t)));
      sparks(out, x, y - .21, t, gold, 6, Math.PI, 0);
      return;
    }
    if (style === 'carnage') {
      for (let i = -1; i <= 1; i++) {
        const [sx, sy] = rotated(x, y, -.65);
        over(out, i ? blood : white, clawValue((sx / .84 + 1) * .5, sy - i * .17, .15 + t * .3, i ? .082 : .045) * fade);
      }
      sparks(out, x, y, t, blood, 7);
      return;
    }
    if (style === 'double-strike') {
      // The canonical hit event already represents the pair; one crossed-cut glyph.
      for (const a of [-.7, .7]) {
        const [sx, sy] = rotated(x, y, a);
        over(out, steel, clawValue((sx / .78 + 1) * .5, sy, .19 + t * .25, .085) * fade);
        over(out, white, clawValue((sx / .78 + 1) * .5, sy, .19 + t * .25, .025) * fade);
      }
      return;
    }
    const angle = style === 'reap' ? -.4 : -.8;
    const [sx, sy] = rotated(x, y, angle);
    const blade = slashValue(sx / .83, sy / .83, time * .7, t * .55);
    over(out, style === 'reap' ? blood : steel, blade * fade);
    over(out, white, band(Math.hypot(sx, sy), .79, .018) * smooth(-.1, .5, sx) * fade * .78);
    if (style === 'reap') {
      const a = Math.atan2(y, x), r = Math.hypot(x, y);
      const ribbon = band(r, .35 + .08 * Math.sin(a * 2 + t * 4), .045) * smooth(-.8, .9, Math.sin(a - t * 4));
      over(out, [.55, .09, .14], ribbon * fade * .65);
    } else {
      // Elemental Break is physical contact breaking a segmented elemental shell.
      const a = Math.atan2(y, x), r = Math.hypot(x, y), seg = Math.floor((a / TAU + .5) * 6);
      const colors = [[.38,.75,1],[1,.5,.12],[.55,1,.6]];
      const segment = band(r, .42 + t * .2, .027) * smooth(.16, .32, fract((a / TAU + .5) * 6));
      over(out, colors[((seg % 3) + 3) % 3], segment * fade);
    }
  });
}

function renderImpact(size, time, style) {
  const t = clamp(time / DURATION_SEC), fade = life(t);
  return renderPixels(size, (x, y, out) => {
    if (Math.hypot(x, y) > .94) return;
    if (style === 'shield-bash') {
      // shield_shell: 1-dot(VIEW,NORMAL) for an analytic front-facing shield dome.
      const sx = x / .48, sy = (y + .07) / .65, r = Math.hypot(sx, sy);
      const fresnel = 1 - Math.sqrt(Math.max(0, 1 - r * r));
      const shell = smooth(0, 1, fresnel) * (1 - smooth(.96, 1, r));
      over(out, [.28,.61,.95], shell * fade * .83);
      over(out, steel, band(r, .91, .04) * fade);
      over(out, white, (band(x, 0, .028) * (1 - smooth(.42,.49,Math.abs(y + .07))) + band(y,-.07,.028)*(1-smooth(.28,.34,Math.abs(x)))) * fade);
      over(out, gold, hitCore(x, y, t, 6, .82) * (1-smooth(.27,.85,t)));
      sparks(out,x,y,t,steel,8);
      return;
    }
    const heavy = style === 'bone-breaker';
    const [sx,sy] = rotated(x,y,heavy ? -.52 : .2);
    over(out, heavy ? blood : gold, hitCore(sx,sy,t,heavy ? 5 : 9,.79) * fade);
    const core = star(sx / (heavy ? .55 : .4),sy / (heavy ? .45 : .58),heavy ? .4 : .55);
    over(out,white,core * (1-smooth(.24,.6,t)));
    // shards.vertex sine displacement becomes separated pointed debris silhouettes.
    for(let i=0;i<(heavy?7:5);i++) {
      const a = i*2.39996323+.2,rr=.14+.55*smooth(.03,.65,t);
      const [u,v] = rotated(x-Math.cos(a)*rr,y-Math.sin(a)*rr,a);
      const shard = 1-smooth(.6,1,Math.abs(u/.07)+Math.abs(v/.028));
      over(out,heavy?[.56,.43,.35]:steel,shard*fade);
    }
  });
}

function renderImpale(size,time) {
  const t=clamp(time/DURATION_SEC),fade=life(t),tip=-.5+1.27*smooth(0,.44,t);
  return renderPixels(size,(x,y,out)=>{
    const width=.022+.075*smooth(-.65,.5,x),n=fbm(x*8-time*2,y*24);
    const axial=smooth(-.88,-.7,x)*(1-smooth(tip-.08,tip,x));
    const shaft=(1-smooth(width*.4,width,Math.abs(y)))*axial;
    over(out,steel,shaft*fade*(.65+n*.35));
    over(out,white,(1-smooth(.009,.023,Math.abs(y)))*axial*fade);
    const head=star((x-tip+.09)/.2,y/.16,.75);
    over(out,gold,head*fade);
    for(const k of [-1,1]) over(out,steel,band(y,k*(.12+.05*Math.sin(x*5-t*4)),.014)*axial*fade*.45);
  });
}

function renderCleave(size,time) {
  const t=clamp(time/DURATION_SEC),fade=life(t);
  return renderPixels(size,(x,y,out)=>{
    // Upright sector opens -Y; caster anchor is near the bottom of the cell.
    const dx=x/.91,dy=(y-.62)/1.45,r=Math.hypot(dx,dy),a=Math.atan2(dx,-dy);
    if(Math.abs(a)>Math.PI/3||r>1)return;
    const [sx,sy]=rotated(dx,dy,-Math.PI/2);
    const mask=swingValue(sx,sy,time,.37+smooth(0,.6,t)*.19,.83);
    over(out,gold,mask*fade);
    over(out,white,band(r,.83,.024)*(1-smooth(.92,1,Math.abs(a)/(Math.PI/3)))*fade);
    over(out,[.6,.36,.12],band(r,.66,.07)*fade*.5);
  });
}

function renderGround(size,time,style) {
  const t=clamp(time/DURATION_SEC),fade=style==='whirlwind'?smooth(0,.17,t)*(1-smooth(.76,1,t)):life(t);
  return renderPixels(size,(x,y,out)=>{
    const r=Math.hypot(x,y),a=Math.atan2(y,x);
    if(r>.805)return;
    if(style==='whirlwind') {
      // Two offset swing meshes keep the channel continuous through its loop.
      for(let i=0;i<3;i++) {
        const [sx,sy]=rotated(x/.8,y/.8,time*3.7+i*TAU/3);
        const blade=swingValue(sx,sy,time,.42,.86);
        over(out,i===0?white:steel,blade*fade*(i===0?.95:.68));
      }
      const n=fbm(x*12+time,y*12-time),inner=band(r,.34,.11)*(n*.65+.15);
      over(out,[.42,.5,.55],inner*fade*.5);
      for(let i=0;i<12;i++) {
        const theta=i*TAU/12+time*3.7,rr=.56+hash(i,4)*.19;
        const [sx,sy]=rotated(x-Math.cos(theta)*rr,y-Math.sin(theta)*rr,theta+Math.PI/2);
        over(out,white,(1-smooth(.5,1,Math.hypot(sx/.06,sy/.012)))*fade*.7);
      }
      return;
    }
    const radius=.12+.66*smooth(0,.55,t),n=fbm(a*3+r*5,t);
    over(out,[.64,.42,.2],band(r,radius,.06+n*.025)*fade*.85);
    over(out,gold,hitCore(x,y,t,11,.8)*fade*.85);
    // Fractures remain a plan-view ground footprint, with radial angular branches.
    const ray=Math.sin(a*9+Math.sin(r*26)*.36);
    const crack=(1-smooth(.025,.085,Math.abs(ray)))*smooth(.08,.23,r)*(1-smooth(radius-.08,radius,r));
    over(out,[.28,.17,.09],crack*fade*.9);
    over(out,[1,.8,.41],crack*(1-smooth(.08,.43,t))*.7);
    for(let i=0;i<10;i++) {
      const theta=i*2.39996323,rr=radius*(.54+hash(i,8)*.4),d=Math.hypot(x-Math.cos(theta)*rr,y-Math.sin(theta)*rr);
      const puff=(1-smooth(.02,.075, d))*fade*(.3+n*.25);
      over(out,[.5,.4,.28],puff);
    }
  });
}

function renderArrow(size,time,frame,style) {
  const t=clamp(time/DURATION_SEC),impact=frame>=12;
  return renderPixels(size,(x,y,out)=>{
    if(Math.hypot(x,y)>.95)return;
    if(impact) {
      const age=(frame-12)/3, color=style==='veil'?[.64,.63,1]:gold;
      over(out,color,hitCore(x,y,age,style==='headshot'?4:7,.75)*(1-smooth(.4,1,age)));
      over(out,white,star(x/.34,y/.34)* (1-smooth(.1,.6,age)));
      sparks(out,x,y,age,style==='veil'?[.63,.7,1]:steel,style==='split'?10:6);
      if(style==='split') for(const a of [-.7,.7]) {
        const [sx,sy]=rotated(x,y,a),u=(sx+.1-age*.4)/.6;
        over(out,steel,(1-smooth(.01,.035,Math.abs(sy)))*smooth(0,.13,u)*(1-smooth(.7,.9,u))*(1-smooth(.5,1,age)));
      }
      return;
    }
    const opening=.45+.55*smooth(0,.2,t),pulse=.9+.1*Math.sin(time*TAU*3);
    const slender=style==='headshot',veil=style==='veil',strafe=style==='strafe';
    const color=veil?[.57,.57,1]:style==='shower'?[.89,.78,.45]:steel;
    const tip=.72,tail=slender?-.84:strafe?-.45:-.65;
    const shaft=(1-smooth(.012,slender?.021:.029,Math.abs(y)))*smooth(tail,tail+.1,x)*(1-smooth(.58,.62,x));
    over(out,color,shaft*opening);
    // transparent.mask's scrolling noise times a longitudinal gradient, cubed alpha.
    const n=fbm(x*7-time*3.4,y*29),long=smooth(-.9,-.4,x)*(1-smooth(.31,.6,x));
    const width=(slender?.035:strafe?.08:.12)*clamp((x+.92)/1.4);
    const gradient=(1-smooth(width*.1,width+.005,Math.abs(y)))*long;
    const mask=clamp(gradient*(.6+n*.4));
    over(out,veil?[.34,.3,.9]:gold,mask**3*.65*opening*pulse);
    // Tapered javelin head UVs replace the Godot mesh used by javelin_01_head.tres.
    const ux=(x-.39)/.34,headWidth=(1-ux)* (slender?.073:strafe?.12:.16);
    const head=smooth(-.02,.03,ux)*(1-smooth(.94,1,ux))*(1-smooth(headWidth*.75,headWidth+.006,Math.abs(y)));
    over(out,color,head*opening);
    over(out,white,head*(1-smooth(.003,.024,Math.abs(y)))*opening);
    for(const side of [-1,1]) {
      const featherY=side*(.035+Math.max(0,-x-.33)*.22);
      const feather=band(y,featherY,.018)*smooth(tail-.03,tail+.06,x)*(1-smooth(-.38,-.3,x));
      over(out,style==='shower'?gold:white,feather*opening*.8);
    }
    if(style==='piercing') for(const side of [-1,1]) {
      const wakeY=side*(.05+(.5-x)*.14),wake=band(y,wakeY,.013)*smooth(-.82,-.6,x)*(1-smooth(.36,.56,x));
      over(out,white,wake*opening*.66);
    }
    if(style==='veil') {
      const radius=Math.hypot((x-.29)/.2,y/.33),a=Math.atan2(y,x-.29);
      over(out,[.56,.49,.95],band(radius,.85,.07)*(Math.sin(a*3-time*4)>.1?1:0)*opening*.65);
    }
    if(style==='split') for(const side of [-1,1]) over(out,steel,band(y,side*(.11-.13*x),.014)*smooth(-.44,-.2,x)*(1-smooth(.29,.46,x))*opening*.7);
    if(style==='headshot') over(out,white,star((x-.48)/.18,y/.26,.4)*opening*.8);
    if(style==='shower') over(out,gold,band(Math.hypot((x+.05)/.3,y/.22),.8,.08)*smooth(.4,.8,x+.5)*opening*.5);
  });
}

const base={opening:[0,3],loop:[0,11],exit:[12,15],frameMs:90,anchorX:.5,anchorY:.5,orient:false};
const ground={...base,projection:'ground',contentWidthRatio:.8,contentHeightRatio:.8,contentCenterXRatio:.5,contentCenterYRatio:.5};
const hitSources=[HIT+'impact_core.gdshader',HIT+'four_point_star.gdshader',BATTLE+'attack_particles.gdshader'];
const cut=(id,style,sources=[BATTLE+'slash.gdshader',BATTLE+'claw.gdshader',...hitSources])=>({id:'attack.'+id,kind:'strike',sources,render:(s,t)=>renderCut(s,t,style),meta:{...base,delivery:'melee',origin:'target'}});
const arrow=(id,style,origin='target')=>({id:'attack.'+id,kind:'projectile',sources:[PROJECTILE+'transparent.gdshader',...hitSources],render:(s,t,f)=>renderArrow(s,t,f,style),meta:{...base,delivery:'projectile',origin,loop:[4,11],orient:true,impactAnchorX:.5,impactAnchorY:.5}});
export const recipes=[
  cut('backstab','backstab'),cut('sidestep','sidestep'),
  {id:'attack.impale',kind:'line',sources:[BATTLE+'claw.gdshader',HIT+'four_point_star.gdshader',PROJECTILE+'transparent.gdshader'],render:renderImpale,meta:{...base,delivery:'melee',origin:'caster',orient:true}},
  ...[['skull_crack','skull-crack'],['bone_breaker','bone-breaker'],['shield_bash','shield-bash']].map(([id,style])=>({id:'attack.'+id,kind:'strike',sources:[...hitSources,BATTLE+(style==='shield-bash'?'shield_shell':'shards')+'.gdshader'],render:(s,t)=>renderImpact(s,t,style),meta:{...base,delivery:'melee',origin:'target'}})),
  {id:'attack.ground_slam',kind:'ground',sources:[...hitSources,BATTLE+'shards.gdshader'],render:(s,t)=>renderGround(s,t,'slam'),meta:{...ground,delivery:'melee',origin:'caster'}},
  cut('carnage','carnage'),cut('cleave_down','cleave-down'),
  {id:'attack.cleave',kind:'cone',sources:[BATTLE+'swing.gdshader'],render:renderCleave,meta:{...base,delivery:'melee',origin:'caster',orient:true,anchorY:.81}},
  cut('elemental_break','elemental-break'),
  {id:'attack.whirlwind',kind:'ground',sources:[BATTLE+'swing.gdshader',BATTLE+'attack_particles.gdshader'],render:(s,t)=>renderGround(s,t,'whirlwind'),meta:{...ground,delivery:'melee',origin:'caster',loop:[4,11]}},
  cut('puncture','puncture'),cut('reap','reap'),
  arrow('piercing_shot','piercing','caster'),arrow('arrow_shower','shower'),arrow('headshot','headshot'),arrow('pierce_the_veil','veil'),arrow('split_shot','split'),arrow('double_strafe','strafe'),
  cut('double_strike','double-strike'),
];
