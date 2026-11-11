"""Blender self-check: saved editable source, fixed roots and camera-only re-render."""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import sys
from array import array

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

TOPIC=Path(__file__).resolve().parents[1]
ROOT=TOPIC.parents[2]


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def pixels_sha(path):
    image=bpy.data.images.load(str(path),check_existing=False)
    value=hashlib.sha256(array('f',image.pixels[:]).tobytes()).hexdigest()
    bpy.data.images.remove(image)
    return value


def geometry_digest(root):
    geometry=[]
    for obj in sorted(root.children,key=lambda obj:obj.name):
        if obj.type!='MESH':continue
        geometry.append([obj.name,[tuple(vertex.co) for vertex in obj.data.vertices],
                         [tuple(face.vertices) for face in obj.data.polygons],
                         [[key.name,[tuple(vertex.co) for vertex in key.data]] for key in obj.data.shape_keys.key_blocks]
                         if obj.data.shape_keys else []])
    return hashlib.sha256(json.dumps(geometry).encode()).hexdigest()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--component',required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    source=TOPIC/'sources'/f'{args.component}.blend';before=sha(source)
    bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
    root=bpy.data.objects['effect-root'];assert len(root.children)>=6
    assert root['component']==args.component and root['units']=='metres'
    assert tuple(root.location)==(0,0,0)
    assert scene.frame_end==24 and scene.render.film_transparent
    assert all(obj.animation_data for obj in root.children)
    assert any(material.use_nodes for material in bpy.data.materials)
    original=geometry_digest(root)
    spec=importlib.util.spec_from_file_location('vfx_builder',Path(__file__).with_name('build-vfx-scenes.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    destination=ROOT/'.cache/vfx-3d/audit'/args.component;destination.mkdir(parents=True,exist_ok=True)
    anchors=[];hashes=[]
    for preset in module.CAMERAS['presets']:
        scene.camera=module.camera_for(preset)
        root.rotation_euler.z=0;scene.frame_set(10);bpy.context.view_layer.update()
        anchor=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
        east=world_to_camera_view(scene,scene.camera,Vector((1,0,0)))
        north=world_to_camera_view(scene,scene.camera,Vector((0,1,0)))
        assert east.x>anchor.x and north.y>anchor.y, 'North/east export axes are reflected'
        for direction in module.CAMERAS['directions']:
            root.rotation_euler.z=-math.radians(direction['angleDeg']);bpy.context.view_layer.update()
            point=world_to_camera_view(scene,scene.camera,root.matrix_world.translation)
            assert abs(point.x-anchor.x)<1e-8 and abs(point.y-anchor.y)<1e-8, 'Directional root drift'
        root.rotation_euler.z=0
        rendered=[]
        for repeat in range(2 if preset['id']=='arena' else 1):
            path=destination/f'{preset["id"]}-{repeat}.png'
            scene.render.filepath=str(path);bpy.ops.render.render(write_still=True);rendered.append(pixels_sha(path))
        if len(rendered)==2:assert rendered[0]==rendered[1], 'Same-source re-render is not deterministic'
        hashes.append(rendered[0]);anchors.append(dict(camera=preset['id'],anchor=[round(anchor.x,8),round(1-anchor.y,8)]))
        assert geometry_digest(root)==original, 'Camera switch mutated effect geometry'
    assert hashes[0]!=hashes[1], 'Alternative camera produced identical output'
    assert sha(source)==before, 'Camera-only re-render modified the source asset'
    report=dict(component=args.component,sourceSha256=before,geometrySha256=original,sourceUnchanged=True,
                cameraChangeWithoutRebuild=True,deterministicRerender=True,northUpEastRight=True,
                fixedRootAcrossEightHeadings=True,anchors=anchors,humanApproval='pending')
    path=TOPIC/'outputs/animated'/args.component/'source-qa.json'
    path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(f'PASS SOURCE {args.component}: saved geometry unchanged at 33/45 degrees; eight fixed roots; repeated render identical',flush=True)


if __name__=='__main__':main()
