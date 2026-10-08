// Generates the synthetic 3D fixtures used by e2e/tools/3d-viewer.spec.ts:
//   e2e/fixtures/cube.stl — ASCII STL unit cube (12 triangles)
//   e2e/fixtures/cube.glb — glTF 2.0 binary unit cube (24 verts / 12 triangles)
//                           with one node "Cube" and one animation "Spin".
// Pure Node, no dependencies. Run: node scripts/make-3d-fixtures.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'e2e/fixtures';
mkdirSync(OUT, { recursive: true });

// Each face: outward normal + 4 corners (counter-clockwise seen from outside).
const FACES = [
  [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
  [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
  [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
  [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
].map(([n, corners]) => [n, corners.map(c => c.map(v => v * 0.5))]);

// --- STL ---------------------------------------------------------------
let stl = 'solid cube\n';
for (const [n, [a, b, c, d]] of FACES) {
  for (const tri of [[a, b, c], [a, c, d]]) {
    stl += ` facet normal ${n.join(' ')}\n  outer loop\n`;
    for (const v of tri) stl += `   vertex ${v.join(' ')}\n`;
    stl += '  endloop\n endfacet\n';
  }
}
stl += 'endsolid cube\n';
writeFileSync(`${OUT}/cube.stl`, stl);

// --- GLB ---------------------------------------------------------------
const positions = [];
const normals = [];
const indices = [];
FACES.forEach(([n, corners], f) => {
  for (const c of corners) {
    positions.push(...c);
    normals.push(...n);
  }
  const o = f * 4;
  indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
});
const times = [0, 1];
const half = Math.SQRT1_2;
const rotations = [0, 0, 0, 1, 0, half, 0, half]; // 0° → 90° about Y

const chunks = [
  new Float32Array(positions),
  new Float32Array(normals),
  new Uint16Array(indices),
  new Float32Array(times),
  new Float32Array(rotations),
];
const views = [];
let offset = 0;
for (const arr of chunks) {
  views.push({ buffer: 0, byteOffset: offset, byteLength: arr.byteLength });
  offset += Math.ceil(arr.byteLength / 4) * 4;
}
const bin = Buffer.alloc(offset);
chunks.forEach((arr, i) => Buffer.from(arr.buffer).copy(bin, views[i].byteOffset));

const gltf = {
  asset: { version: '2.0', generator: 'goodwebtools make-3d-fixtures' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'Cube', mesh: 0 }],
  meshes: [{ name: 'Cube', primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: views,
  accessors: [
    { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' },
    { bufferView: 3, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
    { bufferView: 4, componentType: 5126, count: 2, type: 'VEC4' },
  ],
  animations: [{
    name: 'Spin',
    samplers: [{ input: 3, output: 4, interpolation: 'LINEAR' }],
    channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }],
  }],
};

let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const total = 12 + 8 + json.length + 8 + bin.length;
const header = Buffer.alloc(12);
header.write('glTF', 0, 'ascii');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(total, 8);
const chunkHeader = (len, type) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(len, 0);
  b.write(type, 4, 'ascii');
  return b;
};
writeFileSync(
  `${OUT}/cube.glb`,
  Buffer.concat([header, chunkHeader(json.length, 'JSON'), json, chunkHeader(bin.length, 'BIN\0'), bin]),
);

console.log(`Wrote ${OUT}/cube.stl and ${OUT}/cube.glb`);
