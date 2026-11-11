"""Build editable Blender VFX scenes and render camera/direction exports.

Run with Blender --background --factory-startup --python this-file -- --component ID.
Camera configuration and component targets live in ../sources/*.json.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import random
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Quaternion, Vector

TOPIC = Path(__file__).resolve().parents[1]
SOURCES = TOPIC / 'sources'
OUTPUTS = TOPIC / 'outputs' / 'animated'
TARGETS = json.loads((SOURCES / 'components.json').read_text(encoding='utf-8'))
CAMERAS = json.loads((SOURCES / 'cameras.json').read_text(encoding='utf-8'))
COUNT = TARGETS['frameCount']
TAU = math.tau


def life(t):
    return max(0.0, min(1.0, t / .13, (1 - t) / .22))


def material(name, kind='ribbon', strength=1.8):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.surface_render_method = 'DITHERED'
    nodes = mat.node_tree.nodes
    nodes.clear()
    links = mat.node_tree.links
    output = nodes.new('ShaderNodeOutputMaterial')
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Strength'].default_value = strength
    info = nodes.new('ShaderNodeObjectInfo')
    links.new(info.outputs['Color'], emission.inputs['Color'])
    mix = nodes.new('ShaderNodeMixShader')
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])
    alpha = nodes.new('ShaderNodeMath'); alpha.operation = 'MULTIPLY'
    links.new(info.outputs['Alpha'], alpha.inputs[0])
    alpha.inputs[1].default_value = 1
    if kind in ('ribbon', 'soft'):
        coords = nodes.new('ShaderNodeTexCoord')
        separate = nodes.new('ShaderNodeSeparateXYZ')
        links.new(coords.outputs['UV'], separate.inputs[0])
        subtract = nodes.new('ShaderNodeMath'); subtract.operation = 'SUBTRACT'; subtract.inputs[1].default_value = .5
        links.new(separate.outputs['Y'], subtract.inputs[0])
        absolute = nodes.new('ShaderNodeMath'); absolute.operation = 'ABSOLUTE'; links.new(subtract.outputs[0], absolute.inputs[0])
        twice = nodes.new('ShaderNodeMath'); twice.operation = 'MULTIPLY'; twice.inputs[1].default_value = 2; links.new(absolute.outputs[0], twice.inputs[0])
        edge = nodes.new('ShaderNodeMath'); edge.operation = 'SUBTRACT'; edge.inputs[0].default_value = 1; edge.use_clamp = True
        links.new(twice.outputs[0], edge.inputs[1])
        noise = nodes.new('ShaderNodeTexNoise'); noise.noise_dimensions = '4D'
        noise.inputs['Scale'].default_value = 5; noise.inputs['Detail'].default_value = 2
        links.new(coords.outputs['Generated'], noise.inputs['Vector'])
        noise.inputs['W'].default_value = 0; noise.inputs['W'].keyframe_insert('default_value', frame=1)
        noise.inputs['W'].default_value = 2; noise.inputs['W'].keyframe_insert('default_value', frame=COUNT)
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = .2; ramp.color_ramp.elements[0].color = (.12, .12, .12, 1)
        ramp.color_ramp.elements[1].position = .7; ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        links.new(noise.outputs['Fac'], ramp.inputs[0])
        texture = nodes.new('ShaderNodeMath'); texture.operation = 'MULTIPLY'
        links.new(edge.outputs[0], texture.inputs[0]); links.new(ramp.outputs[0], texture.inputs[1])
        links.new(texture.outputs[0], alpha.inputs[1])
    elif kind == 'shell':
        weight = nodes.new('ShaderNodeLayerWeight'); weight.inputs['Blend'].default_value = .35
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (.04, .04, .04, 1)
        ramp.color_ramp.elements[1].position = .85
        links.new(weight.outputs['Fresnel'], ramp.inputs[0]); links.new(ramp.outputs[0], alpha.inputs[1])
    links.new(alpha.outputs[0], mix.inputs[0])
    return mat


def mesh(name, vertices, faces, mat, root, uv=None, tone=.75):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces); data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = root
    obj.color = (tone, tone, tone, 1)
    obj.data.materials.append(mat)
    if uv:
        layer = data.uv_layers.new(name='effect-uv')
        for polygon in data.polygons:
            for index in polygon.loop_indices:
                layer.data[index].uv = uv[data.loops[index].vertex_index]
    return obj


def ribbon(name, points, width, mat, root, tone=.75, taper=True, twist=0):
    vertices, faces, uv = [], [], []
    for i, point in enumerate(points):
        u = i / (len(points) - 1)
        tangent = Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])
        tangent.normalize()
        side = tangent.cross(Vector((0, 0, 1)))
        if side.length < .01: side = tangent.cross(Vector((0, 1, 0)))
        side.normalize(); side.rotate(Quaternion(tangent, twist * u))
        half = width * (.12 + .88 * math.sin(math.pi * u)**.6 if taper else 1) / 2
        for sign, v in ((-1, 0), (1, 1)):
            vertices.append(Vector(point) + side * half * sign); uv.append((u, v))
        if i: faces.append((2*i-2, 2*i-1, 2*i+1, 2*i))
    return mesh(name, vertices, faces, mat, root, uv, tone)


def deform_ribbon(obj, points_at, width):
    """Absolute shape keys keep the travelling surface editable in the saved scene."""
    basis=obj.shape_key_add(name='Basis')
    obj.data.shape_keys.use_relative=False
    for frame in range(1,COUNT+1):
        t=(frame-1)/(COUNT-1);points=points_at(t)
        key=basis if frame==1 else obj.shape_key_add(name=f'pose-{frame:02}')
        key.interpolation='KEY_LINEAR'
        for i,point in enumerate(points):
            u=i/(len(points)-1)
            tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
            tangent.normalize();side=tangent.cross(Vector((0,0,1)))
            if side.length<.01:side=tangent.cross(Vector((0,1,0)))
            side.normalize()
            for j,sign in enumerate((-1,1)):
                key.data[2*i+j].co=Vector(point)+side*width*(.12+.88*math.sin(math.pi*u)**.6)*sign/2
        obj.data.shape_keys.eval_time=key.frame
        obj.data.shape_keys.keyframe_insert(data_path='eval_time',frame=frame)


def shard(name, mat, root, size=.07, tone=.9):
    vertices = [(0, 0, size*2), (-size, 0, 0), (0, size*.65, 0), (size, 0, 0), (0, -size*.65, 0), (0, 0, -size)]
    faces = [(0, i, 1+i%4) for i in range(1, 5)] + [(5, 1+i%4, i) for i in range(1, 5)]
    return mesh(name, vertices, faces, mat, root, tone=tone)


def animate(obj, fn, envelope=life):
    tone = tuple(obj.color[:3])
    for frame in range(1, COUNT+1):
        t = (frame-1)/(COUNT-1)
        location, rotation, scale, alpha = fn(t)
        obj.location = location; obj.rotation_euler = rotation; obj.scale = scale
        obj.color = (*tone, max(0, min(1, alpha * envelope(t))))
        for name in ('location', 'rotation_euler', 'scale', 'color'):
            obj.keyframe_insert(data_path=name, frame=frame)


def simple_motion(obj, spin=0, grow=0, pulse=0, delay=0, drift=(0,0,0), alpha=1):
    original_scale=tuple(obj.scale)
    def at(t):
        p = max(0, min(1, (t-delay)/max(.01, 1-delay)))
        scale = max(.001, 1 + grow*p + pulse*math.sin(TAU*p))
        return (tuple(v*p for v in drift), (0, 0, spin*p), tuple(scale*v for v in original_scale), alpha if t >= delay else 0)
    animate(obj, at)


def arc_points(radius, z=0, start=0, sweep=TAU, steps=48, wobble=0):
    return [((radius+wobble*math.sin(5*(start+sweep*i/steps))) * math.cos(start+sweep*i/steps),
             (radius+wobble*math.sin(5*(start+sweep*i/steps))) * math.sin(start+sweep*i/steps),
             z + wobble*.4*math.sin(3*(start+sweep*i/steps))) for i in range(steps+1)]


def sphere_patch(name, mat, root, radius=1, height=.65, rings=14, segments=48):
    vertices, faces, uv = [], [], []
    for j in range(rings+1):
        phi = .08 + j/rings*math.pi*.86
        for i in range(segments+1):
            theta = i/segments*TAU
            vertices.append((radius*math.sin(phi)*math.cos(theta), radius*math.sin(phi)*math.sin(theta), height + radius*math.cos(phi)))
            uv.append((i/segments, j/rings))
            if j and i:
                n = j*(segments+1)+i; faces.append((n-segments-2, n-segments-1, n, n-1))
    obj = mesh(name, vertices, faces, mat, root, uv, .5)
    for polygon in obj.data.polygons: polygon.use_smooth = True
    return obj


def glyph(name, mat, root, position, scale=.2):
    paths = [[(-.5,0,-.7),(.1,0,0),(-.3,0,.7)], [(.1,0,0),(.6,0,.4)], [(-.45,0,.15),(.35,0,.15)]]
    objects = []
    for i, points in enumerate(paths):
        obj = ribbon(name+f'-stroke-{i}', [tuple(position[k]+p[k]*scale for k in range(3)) for p in points], .055, mat, root, taper=False)
        objects.append(obj)
    return objects


def build_effect(definition, root, mats, rng):
    name = definition['id']
    filament, solid, shell = mats['filament'], mats['solid'], mats['shell']
    if name == 'charge-gather':
        for index in range(8):
            angle = TAU*index/8
            points = []
            for j in range(33):
                u = j/32; radius = 1.55*(1-u)+.08
                a = angle+u*2.8
                points.append((radius*math.cos(a), radius*math.sin(a), .45*math.sin(u*math.pi)))
            obj = ribbon(f'gather-filament-{index}', points, .11, filament, root, .55, twist=1.5)
            simple_motion(obj, spin=1.5, grow=-.65, delay=index*.025)
        for index in range(32):
            a = rng.uniform(0,TAU); r = rng.uniform(1,1.65); z = rng.uniform(-.25,.8)
            obj = shard(f'gather-mote-{index}', solid, root, rng.uniform(.018,.05))
            def at(t, a=a,r=r,z=z,index=index):
                p = (t+index/32)%1; distance = r*(1-p)**1.4+.025; angle=a+p*3
                return ((distance*math.cos(angle),distance*math.sin(angle),z*(1-p)),(p*3,p*2,p*5),(.6+p,)*3,math.sin(p*math.pi))
            animate(obj,at)
        for index in range(3):
            obj = ribbon(f'focus-arc-{index}', arc_points(.2+index*.08, .02, index*1.7, 4.5, wobble=.015), .035, filament, root)
            simple_motion(obj, spin=(index+1)*2, pulse=.15)
    elif name in ('motion-trail','comet-tail','helical-trail','wind-shear','absorption-stream','smoke-tendrils'):
        strands = 9 if name=='smoke-tendrils' else 6
        for index in range(strands):
            phase = index/strands*TAU
            points = []
            for j in range(49):
                u=j/48; x=(u-.5)*3.5
                if name=='helical-trail': y=.34*math.cos(u*TAU*2+phase); z=.34*math.sin(u*TAU*2+phase)
                elif name=='smoke-tendrils': x=.8*math.cos(phase)*(1-u);y=.8*math.sin(phase)+.2*math.sin(u*8+phase);z=u*1.9-.25
                else: y=.28*math.sin(u*4+phase);z=.18*math.cos(u*5+phase)
                points.append((x,y,z))
            obj=ribbon(f'{name}-ribbon-{index}',points,.18 if name in ('smoke-tendrils','wind-shear') else .08,filament,root,.35+index/strands*.6,twist=phase)
            simple_motion(obj,spin=.25*math.sin(phase),pulse=.08,delay=index*.015,drift=(.15,0,.06))
        if name in ('comet-tail','absorption-stream'):
            for index in range(28):
                p=rng.random();y=rng.uniform(-.4,.4);z=rng.uniform(-.3,.3)
                obj=shard(f'{name}-particle-{index}',solid,root,rng.uniform(.015,.045))
                animate(obj,lambda t,p=p,y=y,z=z: (((((t+p)%1)-.5)*3.4,y*(1-(t+p)%1),z),(t*3,0,t*5),(.7,)*3,math.sin(((t+p)%1)*math.pi)))
    elif name in ('contact-flash','metal-spark-fan','ricochet-fan','light-ray-fan','release-plume'):
        count = 15 if name!='light-ray-fan' else 12
        for index in range(count):
            a = rng.uniform(0,TAU) if name in ('contact-flash','light-ray-fan') else rng.uniform(-.65,.65)
            length=rng.uniform(.45,1.2)
            points=[(u*length*math.cos(a), .12*math.sin(index+u*4), u*length*math.sin(a)) for u in [j/16 for j in range(17)]]
            obj=ribbon(f'{name}-ray-{index}',points,.2 if name=='light-ray-fan' else .07,filament,root,.45+rng.random()*.5)
            simple_motion(obj,grow=.35,pulse=.12,delay=rng.uniform(0,.1))
        for index in range(20):
            a=rng.uniform(0,TAU); speed=rng.uniform(.5,1.5);depth=rng.uniform(-.5,.5)
            obj=shard(f'{name}-spark-{index}',solid,root,rng.uniform(.012,.034))
            animate(obj,lambda t,a=a,speed=speed,depth=depth: ((math.cos(a)*speed*t,depth*t,math.sin(a)*speed*t-.3*t*t),(0,a,t*5),(.8,)*3,1-t))
        obj=ribbon('contact-core',[(-.22,0,0),(0,0,.045),(.22,0,0)],.25,filament,root,1,twist=math.pi/2)
        simple_motion(obj,grow=-.6)
    elif name in ('shield-ripple','shield-crack','shield-shards','break-dissolve','fresnel-edge'):
        body=sphere_patch('curved-shell',shell,root,.9,.65)
        simple_motion(body,pulse=.025,alpha=.55)
        if name=='shield-ripple':
            for index in range(4):
                def wave(t,index=index):
                    phi=.04+max(0,min(1,(t-index*.065)/.8))*2.55
                    return [(.91*math.sin(phi)*math.cos(j/64*TAU),-.91*math.cos(phi),.65+.91*math.sin(phi)*math.sin(j/64*TAU)) for j in range(65)]
                obj=ribbon(f'travelling-surface-wave-{index}',wave(0),.05,filament,root,.65+index*.08)
                deform_ribbon(obj,wave,.05)
                simple_motion(obj,delay=index*.065,alpha=1-index*.15)
            for index in range(9):
                points=[(.905*math.sin(j/32*math.pi)*math.cos(index/9*TAU),.905*math.sin(j/32*math.pi)*math.sin(index/9*TAU),.65+.905*math.cos(j/32*math.pi)) for j in range(33)]
                obj=ribbon(f'shield-lattice-{index}',points,.012,filament,root,.28)
                simple_motion(obj,alpha=.35)
        elif name=='fresnel-edge':
            for index in range(5):
                phi=.35+index*.22; radius=.9*math.sin(phi)
                obj=ribbon(f'surface-wave-{index}',arc_points(radius,.65+.9*math.cos(phi),0,TAU),.035,filament,root,.8)
                simple_motion(obj,grow=.12,pulse=.08,delay=index*.055)
        else:
            for index in range(20):
                a=index/20*TAU; z=rng.uniform(.1,1.25)
                if name=='shield-crack':
                    obj=ribbon(f'shell-crack-{index}',[(.8*math.cos(a+j*.06),.8*math.sin(a+j*.06),z+j*.08) for j in range(5)],.025,filament,root)
                    simple_motion(obj,grow=.15,delay=index*.018)
                else:
                    obj=shard(f'shell-fragment-{index}',solid,root,rng.uniform(.06,.12),.65)
                    animate(obj,lambda t,a=a,z=z: (((.75+.6*t)*math.cos(a),(.75+.6*t)*math.sin(a),z+.5*t-.7*t*t),(t*2,a,t*3),(.8,)*3,1-t*.7))
    elif name in ('body-coating','afterimage-echo'):
        for index in range(8):
            z=index/8*1.2
            points=arc_points(.38+.1*math.sin(index),z, index*.6, TAU*.8,40,.025)
            obj=ribbon(f'coating-band-{index}',points,.12,filament,root,.4+index*.05)
            simple_motion(obj,spin=(-1 if index%2 else 1)*1.4,pulse=.035,drift=(0,0,.08))
        body=sphere_patch('coating-surface',shell,root,.48,.6)
        body.scale.z=1.45
        simple_motion(body,pulse=.02,alpha=.4)
        if name=='afterimage-echo':
            for index in range(3):
                echo=sphere_patch(f'echo-silhouette-{index}',shell,root,.45,.6)
                animate(echo,lambda t,index=index: ((-.35*(index+1)*t,0,0),(0,0,0),(1,1,1.4),.45/(index+1)))
    elif name in ('rune-cylinder','glyph-orbit','status-orbit','buff-crest','curse-glyphs'):
        for index in range(12):
            angle=index/12*TAU; radius=.85 if name!='buff-crest' else .4
            height=1.25 if name in ('status-orbit','buff-crest') else .6+.35*math.sin(angle*2)
            for obj in glyph(f'{name}-{index}',filament,root,(radius*math.cos(angle),radius*math.sin(angle),height),.25):
                simple_motion(obj,spin=1.4,pulse=.07,drift=(0,0,.1))
        for index in range(3):
            obj=ribbon(f'{name}-rail-{index}',arc_points(.88,.12+index*.58,0,TAU),.025,filament,root,.55)
            simple_motion(obj,spin=-.6)
    elif name in ('recoil-wave','ground-wake','crater-rim','radial-fracture','fluid-surface','caustic-pattern'):
        if name in ('radial-fracture','caustic-pattern'):
            for index in range(18):
                a=index/18*TAU
                points=[((.18+j*.12)*math.cos(a+.09*math.sin(j*2+index)),(.18+j*.12)*math.sin(a+.09*math.sin(j*2+index)),.01) for j in range(12)]
                obj=ribbon(f'{name}-branch-{index}',points,.035,filament,root,.5+rng.random()*.4)
                simple_motion(obj,grow=.35,delay=(index%3)*.05)
        else:
            for index in range(7):
                radius=.25+index*.18
                obj=ribbon(f'{name}-ripple-{index}',arc_points(radius,.01,index*.7,TAU*.9,48,.025),.1 if name=='fluid-surface' else .055,filament,root,.4+index*.06)
                simple_motion(obj,grow=.35,pulse=.08,delay=index*.025)
        if name=='crater-rim':
            for index in range(28):
                a=index/28*TAU;obj=shard(f'crater-stone-{index}',solid,root,rng.uniform(.06,.14),.45)
                animate(obj,lambda t,a=a: ((1.15*math.cos(a),1.15*math.sin(a),.1+.35*math.sin(t*math.pi)),(0,a,t*.4),(.9,)*3,1))
    elif name in ('energy-curtain','heat-shimmer'):
        for index in range(10):
            x=(index/9-.5)*2.8
            points=[(x+.08*math.sin(j*.7+index), .12*math.sin(j*.5+index), j/24*1.7-.2) for j in range(25)]
            obj=ribbon(f'{name}-sheet-{index}',points,.32 if name=='energy-curtain' else .18,filament,root,.35+index*.05,twist=.5)
            simple_motion(obj,spin=.06,pulse=.08,drift=(.07*math.sin(index),0,.08))
    elif name=='debris-swarm':
        for index in range(42):
            a=rng.uniform(0,TAU);radius=rng.uniform(.3,1.4);height=rng.uniform(.1,1.4)
            obj=shard(f'orbiting-debris-{index}',solid,root,rng.uniform(.03,.1),.45+rng.random()*.4)
            animate(obj,lambda t,a=a,radius=radius,height=height: ((radius*math.cos(a+t*TAU),radius*math.sin(a+t*TAU),height+.15*math.sin(t*TAU+a)),(t*3,a,t*4),(.8,)*3,1))
    else:
        raise ValueError(f'No authored effect builder for {name}')


def camera_for(preset):
    data=bpy.data.cameras.new('camera-'+preset['id']);data.type='ORTHO';data.ortho_scale=preset['orthographicSpanM']
    obj=bpy.data.objects.new(data.name,data);bpy.context.collection.objects.link(obj)
    elevation=math.radians(preset['elevationDeg']);azimuth=math.radians(preset['azimuthDeg'])
    target=Vector((0,0,preset['targetHeightM']))
    obj.location=target+Vector((8*math.cos(elevation)*math.sin(azimuth),-8*math.cos(elevation)*math.cos(azimuth),8*math.sin(elevation)))
    obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj


def main():
    args=argparse.ArgumentParser()
    args.add_argument('--component',required=True,choices=[c['id'] for c in TARGETS['components']])
    args.add_argument('--render',action='store_true')
    args.add_argument('--from-source',action='store_true',help='Render the saved scene without rebuilding or saving its geometry')
    args.add_argument('--overwrite',action='store_true',help='Replace rendered frames in place')
    args.add_argument('--preset',nargs='+')
    args.add_argument('--direction',nargs='+')
    args.add_argument('--frame',type=int,nargs='+')
    opts=args.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    definition=next(c for c in TARGETS['components'] if c['id']==opts.component)
    source=SOURCES/(definition['id']+'.blend')
    bpy.context.preferences.filepaths.save_version=0
    if opts.from_source:
        bpy.ops.wm.open_mainfile(filepath=str(source))
        root=bpy.data.objects['effect-root']
    else:
        bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
        root=bpy.data.objects.new('effect-root',None);bpy.context.collection.objects.link(root)
        root['component']=definition['id'];root['units']='metres';root['world_root']=[0.,0.,0.]
        mats={'filament':material('layered-filament','ribbon',.75),'solid':material('bright-fragments','solid',1.05),'shell':material('view-dependent-shell','shell',.65)}
        seed=TARGETS['seed']+int(hashlib.sha256(definition['id'].encode()).hexdigest()[:8],16)
        build_effect(definition,root,mats,random.Random(seed))
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.render.film_transparent=True
    scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=False
    scene.cycles.seed=TARGETS['seed'];scene.cycles.use_animated_seed=False
    scene.cycles.max_bounces=2;scene.cycles.transparent_max_bounces=16
    scene.render.resolution_x=TARGETS['frameSize'];scene.render.resolution_y=TARGETS['frameSize'];scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.render.fps=definition['fps'];scene.frame_start=1;scene.frame_end=COUNT
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    scene.world.color=(.04,.04,.04)
    scene.use_nodes=True
    nodes=scene.node_tree.nodes;nodes.clear();render=nodes.new('CompositorNodeRLayers')
    glow=nodes.new('CompositorNodeGlare');glow.glare_type='FOG_GLOW';glow.quality='HIGH';glow.threshold=1.2
    output=nodes.new('CompositorNodeComposite');scene.node_tree.links.new(render.outputs['Image'],glow.inputs['Image']);scene.node_tree.links.new(glow.outputs['Image'],output.inputs[0])
    for obj in list(bpy.data.objects):
        if obj.type=='CAMERA': bpy.data.objects.remove(obj,do_unlink=True)
    cameras={p['id']:camera_for(p) for p in CAMERAS['presets']}
    scene.camera=cameras[CAMERAS['presets'][0]['id']]
    scene.frame_set(1)
    if not opts.from_source:
        text=bpy.data.texts.new('procedural-source.py');text.write(Path(__file__).read_text(encoding='utf-8'))
        bpy.ops.wm.save_as_mainfile(filepath=str(source),check_existing=False,compress=True)
    print(f'SOURCE {definition["id"]}: {len(root.children)} editable geometry objects, {COUNT} timeline frames',flush=True)
    if not opts.render:return
    folder=OUTPUTS/definition['id'];folder.mkdir(parents=True,exist_ok=True)
    previous=json.loads((folder/'render.json').read_text(encoding='utf-8')) if (folder/'render.json').exists() else None
    metadata=dict(component=definition,frameSize=TARGETS['frameSize'],frameCount=COUNT,units='metres',source=source.relative_to(TOPIC).as_posix(),
                  sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),interrupt=TARGETS['interrupt'],cameras=[],
                  phases=dict(start=[0,3],active=[4,17],contact=[4,6] if definition['phase']=='Impact' else None,exit=[18,23]),
                  frameDurationUs=round(1000000/definition['fps']),decorativeSeed=TARGETS['seed'])
    if definition.get('requires')=='actor-silhouette':
        metadata['attachment']=dict(mask='current-actor-alpha',space='actor-body',root='feet',fit='cover',history=name if (name:=definition['id'])=='afterimage-echo' else None)
    if definition.get('requires') in ('sampled-path','committed-endpoints'):
        metadata['attachment']=dict(path='committed-flight-samples',ageSec=.24,widthM=.16)
    for preset in CAMERAS['presets']:
        if opts.preset and preset['id'] not in opts.preset:continue
        if opts.from_source and not opts.overwrite:
            prior=next((p for p in previous['cameras'] if p['id']==preset['id']),None) if previous else None
            if prior is None or previous['sourceSha256']!=metadata['sourceSha256'] or any(prior.get(k)!=v for k,v in preset.items()):
                raise ValueError(f'Stale or missing render registration for {preset["id"]}; use --overwrite')
        scene.camera=cameras[preset['id']]
        point=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
        record=dict(**preset,anchor=[round(point.x,8),round(1-point.y,8)],directions=[])
        for direction in CAMERAS['directions']:
            if opts.direction and direction['id'] not in opts.direction:continue
            root.rotation_euler.z=-math.radians(direction['angleDeg'])
            destination=folder/preset['id']/direction['id'];destination.mkdir(parents=True,exist_ok=True)
            record['directions'].append(direction)
            for frame in opts.frame or range(1,COUNT+1):
                path=destination/f'{frame:03}.png'
                if path.exists() and opts.from_source and not opts.overwrite:continue
                scene.frame_set(frame);scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
            print(f'RENDER {definition["id"]} {preset["id"]} {direction["id"]}',flush=True)
        metadata['cameras'].append(record)
    if opts.frame or opts.direction:
        print('PROBE: partial frame/direction renders do not replace complete-export metadata',flush=True)
        return
    if opts.preset and previous and previous['sourceSha256']==metadata['sourceSha256']:
        current_ids={p['id'] for p in metadata['cameras']}
        metadata['cameras'].extend(p for p in previous['cameras'] if p['id'] not in current_ids)
    (folder/'render.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    main()
