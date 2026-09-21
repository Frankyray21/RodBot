#!/usr/bin/env python3
"""Reproducible photo corrections. Reuse V6 compressed geometry without recompression.

The .gltf reads the immutable V6 GLB as its external binary buffer. Buffer views
include that file's header offset. Only corrected animation samples are embedded.
Run from anywhere: python scripts/refine-photo-model.py
"""
import base64
import json
import math
import pathlib
import struct

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / '3d/assets'
SOURCE = ASSETS / 'rodbot-v6-c9499d45.glb'
TARGET = ASSETS / 'rodbot-v7-photo.gltf'
raw = SOURCE.read_bytes()
json_size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + json_size])
binary_start = 28 + json_size
assert struct.unpack_from('<I', raw, 24 + json_size)[0] == 0x004E4942
for view in doc['bufferViews']:
    view['byteOffset'] = view.get('byteOffset', 0) + binary_start
doc['buffers'] = [{'uri': SOURCE.name, 'byteLength': len(raw)}]
nodes = {n['name']: n for n in doc['nodes']}
extra = bytearray()

def multiply(a, b):
    x, y, z, w = a
    X, Y, Z, W = b
    return [w*X+x*W+y*Z-z*Y, w*Y-x*Z+y*W+z*X,
            w*Z+x*Y-y*X+z*W, w*W-x*X-y*Y-z*Z]

def rotate(q, v):
    return multiply(multiply(q, [*v, 0]), [-q[0], -q[1], -q[2], q[3]])[:3]

def norm(v):
    return math.sqrt(sum(x*x for x in v))

def between(a, b):
    a = [v/norm(a) for v in a]
    b = [v/norm(b) for v in b]
    q = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0],
         1+sum(x*y for x,y in zip(a,b))]
    return [v/norm(q) for v in q]

def read_accessor(index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    width = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    assert a['componentType'] == 5126 and not view.get('byteStride')
    values = struct.unpack_from('<'+'f'*(a['count']*width), raw,
                                view['byteOffset']+a.get('byteOffset', 0))
    return [list(values[i:i+width]) for i in range(0, len(values), width)]

def append_samples(index, values):
    a = doc['accessors'][index]
    payload = struct.pack('<'+'f'*sum(map(len, values)), *(v for row in values for v in row))
    a.pop('byteOffset', None)
    a['bufferView'] = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 1, 'byteOffset': len(extra), 'byteLength': len(payload)})
    extra.extend(payload)
    if 'min' in a:
        a['min'] = list(map(min, zip(*values)))
        a['max'] = list(map(max, zip(*values)))

# Photo 2026-09-21: the boom rises toward the basket, the gripper hangs down.
# The small yaw places the gripper toward the visible cabinet side, as in
# the photo. Both angles are visual estimates, not measured mechanical settings.
angle = math.radians(6)
heading = math.radians(-12)
turn = [0, math.sin(heading/2), 0, math.cos(heading/2)]
tilt = [0, 0, math.sin(angle/2), math.cos(angle/2)]
untilt = [0, 0, -tilt[2], tilt[3]]
shoulder = nodes['CTRL_SHOULDER_Y']
turret = nodes['CTRL_TURRET_Z']
wrist = nodes['CTRL_WRIST_Y']
base = nodes['HYD_LIFT_BASE']
rod = nodes['HYD_LIFT_ROD']
tip = nodes['HYD_LIFT_TIP']['translation']
barrel_length = rod['translation'][1]
rod_mesh = doc['meshes'][nodes['MESH_LIFT_ROD_130']['mesh']]
rod_accessor = doc['accessors'][rod_mesh['primitives'][0]['attributes']['POSITION']]
rod_length = rod_accessor['max'][1] - rod_accessor['min'][1]

def hydraulic(shoulder_rotation, old_base_rotation):
    end = [a+b for a,b in zip(shoulder['translation'], rotate(shoulder_rotation, tip))]
    direction = [a-b for a,b in zip(end, base['translation'])]
    q = multiply(between(rotate(old_base_rotation, [0,1,0]), direction), old_base_rotation)
    return q, [1, (norm(direction)-barrel_length)/rod_length, 1]

shoulder['rotation'] = multiply(tilt, shoulder['rotation'])
turret['rotation'] = multiply(turn, turret.get('rotation', [0,0,0,1]))
wrist['rotation'] = multiply(untilt, wrist['rotation'])
base['rotation'], rod['scale'] = hydraulic(shoulder['rotation'], base['rotation'])
for animation in doc['animations']:
    if animation['name'] == 'Elevation_bras':
        samples = {}
        for channel in animation['channels']:
            name = doc['nodes'][channel['target']['node']]['name']
            output = animation['samplers'][channel['sampler']]['output']
            samples[name] = (output, read_accessor(output))
        rotations = [multiply(tilt, q) for q in samples['CTRL_SHOULDER_Y'][1]]
        cylinders = [hydraulic(q, old) for q,old in zip(rotations, samples['HYD_LIFT_BASE'][1])]
        append_samples(samples['CTRL_SHOULDER_Y'][0], rotations)
        append_samples(samples['HYD_LIFT_BASE'][0], [v[0] for v in cylinders])
        append_samples(samples['HYD_LIFT_ROD'][0], [v[1] for v in cylinders])
    elif animation['name'] in ['Inclinaison_pince', 'Rotation_tourelle']:
        output = animation['samplers'][0]['output']
        correction = untilt if animation['name'] == 'Inclinaison_pince' else turn
        append_samples(output, [multiply(correction, q) for q in read_accessor(output)])

# Rod dimensions are supported by the operator manual p.8. Maintain contact
# between layers when reducing the barrel diameter from 140 to 127 mm.
rod_measurements = []
for number in range(1, 8):
    n = nodes[f'PROP_ROD_{number:02}']
    bounds = []
    for child in n['children']:
        for p in doc['meshes'][doc['nodes'][child]['mesh']]['primitives']:
            bounds.append(doc['accessors'][p['attributes']['POSITION']])
    lo = min(a['min'][0] for a in bounds)
    hi = max(a['max'][0] for a in bounds)
    n['scale'] = [1.8288/(hi-lo), 127/140, 127/140]
    n['translation'][0] = .55 - (hi+lo)*n['scale'][0]/2
    n['translation'][1] = 1.1545 if number <= 5 else 1.2795
    n.setdefault('extras', {})['photo_revision'] = '6 ft assembly; 5 in barrel, manual p.8'
    rod_measurements.append({'name':n['name'], 'length_m':1.8288, 'barrel_diameter_m':.127})

# Use the existing surface maps, with less blackened rod steel and a cooler,
# slightly darker painted cabinet matching the supplied workshop photograph.
for material in doc['materials']:
    pbr = material.get('pbrMetallicRoughness', {})
    if material['name'] == 'WEB_AO | Armoires | gris chaud':
        pbr['baseColorFactor'] = [.72, .77, .73, 1]
    elif material['name'] == 'WEB_AO | Tiges | acier foncé':
        # Remove the baked dark albedo only; retain normal and roughness maps.
        pbr.pop('baseColorTexture', None)
        pbr['baseColorFactor'] = [.24, .28, .31, 1]
        pbr['metallicFactor'] = .92
        pbr['roughnessFactor'] = .58

doc['buffers'].append({'uri': 'data:application/octet-stream;base64,'+base64.b64encode(extra).decode(),
                       'byteLength': len(extra)})
doc['asset']['generator'] = 'RodBot photo refinement 2026-09-21 (V6 geometry retained)'
doc.setdefault('extras', {})['photo_revision'] = {
    'reference': 'User workshop photograph, 2026-09-21',
    'boom_elevation_offset_deg': 6, 'turret_heading_offset_deg': -12, 'angle_is_estimated': True,
    'alignment': 'Toward visible cabinet side of basket; gripper counter-rotated to remain downward',
    'rods': rod_measurements,
    'limits': 'Hidden geometry and operating travel remain unvalidated.'
}
TARGET.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':'))+'\n')
print(f'{TARGET.name}: {TARGET.stat().st_size} bytes; {len(doc["animations"])} animations preserved')
