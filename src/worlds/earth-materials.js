import * as THREE from '../../vendor/three.module.js';

const clamp = (n) => Math.max(0, Math.min(1, n));
export function smoothRange(a, b, value) {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function hash(x, y, z, seed) {
  let n =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(z, 2147483647) ^
    seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
// Sample in 3D direction space: longitude seams and pole singularities do not
// enter the noise domain. Colour and material data consume the same features.
export function spaceNoise(x, y, z, seed = 218) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const sx = smoothRange(0, 1, x - ix),
    sy = smoothRange(0, 1, y - iy),
    sz = smoothRange(0, 1, z - iz);
  const mix = (a, b, t) => a + (b - a) * t;
  return mix(
    mix(
      mix(hash(ix, iy, iz, seed), hash(ix + 1, iy, iz, seed), sx),
      mix(hash(ix, iy + 1, iz, seed), hash(ix + 1, iy + 1, iz, seed), sx),
      sy,
    ),
    mix(
      mix(hash(ix, iy, iz + 1, seed), hash(ix + 1, iy, iz + 1, seed), sx),
      mix(
        hash(ix, iy + 1, iz + 1, seed),
        hash(ix + 1, iy + 1, iz + 1, seed),
        sx,
      ),
      sy,
    ),
    sz,
  );
}
export function sphereDirection(u, v, out) {
  const latitude = Math.PI * v,
    longitude = Math.PI * 2 * u;
  const r = Math.sin(latitude);
  out.x = -Math.cos(longitude) * r;
  out.y = Math.cos(latitude);
  out.z = Math.sin(longitude) * r;
  return out;
}
export function earthSurface(x, y, z, out) {
  const broad = spaceNoise(x * 2.3 + 3, y * 2.3, z * 2.3, 218);
  const detail = spaceNoise(x * 8, y * 8, z * 8, 817);
  const coast = broad * 0.84 + detail * 0.16;
  out.land = smoothRange(0.49, 0.53, coast);
  out.height = 0.2 + out.land * (0.2 + 0.35 * detail);
  out.roughness = 0.24 + out.land * 0.71;
  out.dry = smoothRange(0.36, 0.7, detail + 0.12 * Math.abs(y));
  out.ice = smoothRange(0.86, 0.98, Math.abs(y) + 0.025 * detail);
  return out;
}
function craterCatalog() {
  const craters = [];
  for (let i = 0; i < 72; i++) {
    const point = sphereDirection(
      hash(i, 0, 0, 61),
      Math.acos(2 * hash(i, 1, 0, 61) - 1) / Math.PI,
      {},
    );
    craters.push({
      ...point,
      radius:
        i < 8
          ? 0.1 + hash(i, 2, 0, 61) * 0.12
          : 0.018 + hash(i, 2, 0, 61) * 0.075,
    });
  }
  return craters;
}
const craters = craterCatalog();
export function moonSurface(x, y, z, out) {
  let height = 0.48,
    shade = 0;
  for (const crater of craters) {
    const cosine = x * crater.x + y * crater.y + z * crater.z;
    if (cosine < 1 - crater.radius * crater.radius * 0.95) continue;
    const r = Math.sqrt(Math.max(0, 2 * (1 - cosine))) / crater.radius;
    const bowl = Math.max(0, 1 - r * r);
    const rim = Math.exp(-(((r - 1) / 0.15) ** 2));
    height += 0.19 * rim - 0.24 * bowl;
    shade += 0.09 * rim - 0.075 * bowl;
  }
  const mare = smoothRange(0.42, 0.7, spaceNoise(x * 2 + 7, y * 2, z * 2, 83));
  out.height = clamp(height);
  out.albedo = clamp(
    0.57 -
      mare * 0.24 +
      shade +
      (spaceNoise(x * 25, y * 25, z * 25, 71) - 0.5) * 0.055,
  );
  return out;
}
export function cloudDensity(x, y, z) {
  const warp = spaceNoise(x * 4 + 10, y * 4, z * 4, 371);
  const band = spaceNoise(x * 10 + warp, y * 5 + warp, z * 10, 491);
  return (
    smoothRange(0.57, 0.76, band) *
    (1 - smoothRange(0.91, 1, Math.abs(y))) *
    0.78
  );
}

// A colour and a packed height/roughness map can share a feature sampler.
// Each texture is constructed once per cached world, never by an action/update.
export function paintTexture(
  name,
  width,
  height,
  sample,
  { data = false, sourceWidth = width, sourceHeight = height } = {},
) {
  const source = document.createElement('canvas');
  source.width = sourceWidth;
  source.height = sourceHeight;
  const context = source.getContext('2d');
  if (!context) throw new Error(`Cannot paint ${name}`);
  const pixels = context.createImageData(sourceWidth, sourceHeight);
  const point = {},
    rgba = [0, 0, 0, 255];
  for (let row = 0; row < sourceHeight; row++)
    for (let column = 0; column < sourceWidth; column++) {
      // Duplicate seam endpoints deliberately; periodic wrap and clamp poles.
      const u = column / (sourceWidth - 1),
        v = row / (sourceHeight - 1);
      sphereDirection(u, v, point);
      sample(point, u, v, rgba);
      const offset = (row * sourceWidth + column) * 4;
      for (let c = 0; c < 4; c++)
        pixels.data[offset + c] = Math.round(
          Math.max(0, Math.min(255, rgba[c])),
        );
    }
  context.putImageData(pixels, 0, 0);
  let canvas = source;
  if (sourceWidth !== width || sourceHeight !== height) {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const upscale = canvas.getContext('2d');
    if (!upscale) throw new Error(`Cannot resize ${name}`);
    upscale.drawImage(source, 0, 0, width, height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
export function createEarthTextures() {
  const feature = {};
  const color = paintTexture(
    'earth-albedo',
    1024,
    512,
    (p, _u, _v, out) => {
      earthSurface(p.x, p.y, p.z, feature);
      const land = feature.land,
        dry = feature.dry,
        ice = feature.ice;
      const ground = [49 + dry * 65, 78 + dry * 23, 49 + dry * 14];
      const ocean = [10, 37 + feature.height * 25, 66 + feature.height * 60];
      for (let c = 0; c < 3; c++)
        out[c] =
          (ocean[c] * (1 - land) + ground[c] * land) * (1 - ice) +
          [221, 228, 223][c] * ice;
      out[3] = 255;
    },
    { sourceWidth: 512, sourceHeight: 256 },
  );
  const data = paintTexture(
    'earth-height-roughness',
    512,
    256,
    (p, _u, _v, out) => {
      earthSurface(p.x, p.y, p.z, feature);
      out[0] = feature.height * 255;
      out[1] = feature.roughness * 255;
      out[2] = 0;
      out[3] = 255;
    },
    { data: true },
  );
  const clouds = paintTexture('earth-clouds', 512, 256, (p, _u, _v, out) => {
    out[0] = out[1] = out[2] = 244;
    out[3] = 255 * cloudDensity(p.x, p.y, p.z);
  });
  return { color, data, clouds };
}
export function createMoonTextures() {
  const feature = {};
  const color = paintTexture('moon-albedo', 512, 256, (p, _u, _v, out) => {
    moonSurface(p.x, p.y, p.z, feature);
    out[0] = feature.albedo * 249;
    out[1] = feature.albedo * 247;
    out[2] = feature.albedo * 240;
    out[3] = 255;
  });
  const height = paintTexture(
    'moon-height',
    512,
    256,
    (p, _u, _v, out) => {
      moonSurface(p.x, p.y, p.z, feature);
      out[0] = out[1] = out[2] = feature.height * 255;
      out[3] = 255;
    },
    { data: true },
  );
  return { color, height };
}
export function createSunTexture() {
  return paintTexture('sun-granules', 512, 256, (p, _u, _v, out) => {
    const cells = spaceNoise(p.x * 65, p.y * 65, p.z * 65, 19);
    const broad = spaceNoise(p.x * 10, p.y * 10, p.z * 10, 91);
    const brightness = 0.76 + cells * 0.2 + broad * 0.04;
    out[0] = 255 * brightness;
    out[1] = (190 + cells * 52) * brightness;
    out[2] = (93 + broad * 84) * brightness;
    out[3] = 255;
  });
}
export function createGasTexture() {
  return paintTexture('gas-bands', 512, 256, (p, _u, v, out) => {
    const warp = (spaceNoise(p.x * 9, p.y * 3, p.z * 9, 51) - 0.5) * 0.025;
    const band = 0.5 + 0.5 * Math.sin((v + warp) * Math.PI * 29);
    const fine = spaceNoise(p.x * 24, p.y * 10, p.z * 24, 71);
    out[0] = 151 + band * 61 + fine * 12;
    out[1] = 125 + band * 51 + fine * 10;
    out[2] = 98 + band * 38 + fine * 8;
    out[3] = 255;
  });
}
export function createRingTexture() {
  return paintTexture('ring-bands', 1024, 64, (_p, u, _v, out) => {
    const fine = 0.5 + 0.5 * Math.sin(u * 870 + Math.sin(u * 127) * 2);
    const broad = 0.6 + 0.4 * Math.sin(u * 53);
    const gap = 1 - 0.94 * Math.exp(-(((u - 0.62) / 0.014) ** 2));
    const edge = smoothRange(0, 0.025, u) * (1 - smoothRange(0.965, 1, u));
    out[0] = 157 + fine * 53;
    out[1] = 145 + fine * 49;
    out[2] = 124 + fine * 45;
    out[3] = 255 * (0.38 + fine * 0.34 + broad * 0.28) * gap * edge;
  });
}
export function setRingUV(geometry) {
  const position = geometry.attributes.position,
    uv = geometry.attributes.uv;
  const { innerRadius, outerRadius } = geometry.parameters;
  for (let i = 0; i < position.count; i++)
    uv.setXY(
      i,
      (Math.hypot(position.getX(i), position.getY(i)) - innerRadius) /
        (outerRadius - innerRadius),
      0.5,
    );
  uv.needsUpdate = true;
}
