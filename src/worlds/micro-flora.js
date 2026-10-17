import * as THREE from '../../vendor/three.module.js';

const TAU = Math.PI * 2;

// Wind maths shared by every swaying plant and by the dew riding on blades, so
// drops stay attached while their blade moves. Heights are in local units.
const SWAY_GLSL = /* glsl */ `
uniform float uTime;
uniform float uWind;
vec2 grassSway(vec2 anchor, float height) {
  float bend = pow(clamp(height / GRASS_BEND_HEIGHT, 0.0, 1.0), 1.5) * GRASS_BEND_HEIGHT;
  float phase = anchor.x * 0.7 + anchor.y * 0.3;
  float gust = 0.5 + 0.5 * sin(uTime * 0.55 - anchor.x * 0.12 - anchor.y * 0.05);
  float lean = (0.05 + uWind * 0.12) * (sin(uTime * 1.7 + phase) + 0.45 * sin(uTime * 3.7 + phase * 1.9)) + uWind * gust * 0.22;
  float flutter = cos(uTime * 1.15 + anchor.y * 0.5) * (0.025 + uWind * 0.04);
  return vec2(flutter, lean) * bend;
}`;

const SWAY_VERTEX = /* glsl */ `#include <begin_vertex>
#ifdef USE_INSTANCING
vec2 grassAnchor = (modelMatrix * instanceMatrix[3]).xz;
#else
vec2 grassAnchor = modelMatrix[3].xz;
#endif
vec2 grassOffset = grassSway(grassAnchor, position.y);
transformed.x += grassOffset.x;
transformed.z += grassOffset.y;`;

export function createFlora({
  rand,
  mat,
  renderer,
  windUniform,
  microHeight,
  dummy,
}) {
  const swayUniforms = {
    uTime: windUniform,
    uWind: { value: 0.25 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color('#ffd58c') },
    uBacklight: { value: 1 },
  };

  function injectPlantShader(shader) {
    Object.assign(shader.uniforms, swayUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
${SWAY_GLSL}
varying vec3 vGrassWorld;
varying float vGrassHeight;`,
      )
      .replace(
        '#include <begin_vertex>',
        `${SWAY_VERTEX}
vGrassHeight = clamp(position.y / GRASS_BEND_HEIGHT, 0.0, 1.0);`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vec4 grassWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
grassWorld = instanceMatrix * grassWorld;
#endif
vGrassWorld = (modelMatrix * grassWorld).xyz;`,
      );
    // Light passing through a thin leaf: strongest when looking toward the sun.
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uBacklight;
varying vec3 vGrassWorld;
varying float vGrassHeight;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `float grassBack = pow(max(dot(normalize(vGrassWorld - cameraPosition), uSunDir), 0.0), 3.0);
outgoingLight += diffuseColor.rgb * uSunColor * (grassBack * 1.5 + 0.1) * uBacklight * GRASS_TRANSLUCENCY * (0.3 + 0.7 * vGrassHeight);
#include <opaque_fragment>`,
      );
  }
  function injectDepthShader(shader) {
    Object.assign(shader.uniforms, swayUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SWAY_GLSL}`)
      .replace('#include <begin_vertex>', SWAY_VERTEX);
  }

  // Programs are cached by shader source plus defines, so every variation is
  // expressed through defines rather than different injected text.
  function plantMaterial({
    bendHeight = 1,
    translucency = 1,
    map = null,
    roughness = 0.62,
  } = {}) {
    const material = mat('#ffffff', {
      side: THREE.DoubleSide,
      roughness,
      vertexColors: true,
      map,
    });
    material.defines = {
      GRASS_BEND_HEIGHT: bendHeight.toFixed(2),
      GRASS_TRANSLUCENCY: translucency.toFixed(2),
    };
    material.onBeforeCompile = injectPlantShader;
    return material;
  }
  function plantDepthMaterial(bendHeight = 1) {
    const material = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      side: THREE.DoubleSide,
    });
    material.defines = { GRASS_BEND_HEIGHT: bendHeight.toFixed(2) };
    material.onBeforeCompile = injectDepthShader;
    return material;
  }
  function castSwayingShadow(object, bendHeight) {
    object.castShadow = true;
    object.customDepthMaterial = plantDepthMaterial(bendHeight);
  }

  function canvasTexture(width, height, paint, repeat = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (repeat !== 1) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat, repeat);
    }
    return texture;
  }
  // Parallel veins and a pale midrib along the blade's length (v axis).
  const veinTexture = canvasTexture(64, 256, (ctx) => {
    ctx.fillStyle = '#f4f4ec';
    ctx.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = 'rgba(70,92,38,.07)';
      ctx.fillRect(rand(0, 64), rand(0, 256), rand(1, 3), rand(2, 9));
    }
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = 'rgba(64,88,34,.2)';
      ctx.fillRect(4 + i * 6.6 + rand(-0.6, 0.6), 0, 1.1, 256);
    }
    const midrib = ctx.createLinearGradient(25, 0, 39, 0);
    midrib.addColorStop(0, 'rgba(255,255,226,0)');
    midrib.addColorStop(0.5, 'rgba(255,255,226,.55)');
    midrib.addColorStop(1, 'rgba(255,255,226,0)');
    ctx.fillStyle = midrib;
    ctx.fillRect(25, 0, 14, 256);
  });

  // A folded blade: left edge, raised midrib, right edge per row; widest just
  // above the base, tapering to a point and curving forward (+z).
  function bladeGeometry({
    rows = 7,
    width = 0.06,
    curve = 0.3,
    fold = 0.35,
  } = {}) {
    const positions = [],
      colors = [],
      uvs = [],
      index = [];
    const base = new THREE.Color('#2c4a17'),
      middle = new THREE.Color('#5b8a2a'),
      tip = new THREE.Color('#a9c755'),
      color = new THREE.Color();
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const half =
        width * Math.pow(1 - t, 0.75) * (0.7 + 0.3 * Math.min(1, t * 4));
      const forward = t * t * curve;
      if (t < 0.5) color.copy(base).lerp(middle, t * 2);
      else color.copy(middle).lerp(tip, (t - 0.5) * 2);
      for (const side of [-1, 0, 1]) {
        positions.push(
          side * half,
          t,
          forward + (side === 0 ? half * fold : 0),
        );
        const shade = side === 0 ? 1.12 : 0.9;
        colors.push(color.r * shade, color.g * shade, color.b * shade);
        uvs.push((side + 1) / 2, t);
      }
      if (row < rows) {
        const k = row * 3;
        index.push(k, k + 1, k + 3, k + 1, k + 4, k + 3);
        index.push(k + 1, k + 2, k + 4, k + 2, k + 5, k + 4);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    geometry.userData.curve = curve;
    return geometry;
  }
  const broadBlade = bladeGeometry({ width: 0.07, curve: 0.34 });
  const fineBlade = bladeGeometry({
    rows: 5,
    width: 0.028,
    curve: 0.22,
    fold: 0.2,
  });
  const leafBlade = bladeGeometry({
    rows: 6,
    width: 0.16,
    curve: 0.5,
    fold: 0.25,
  });

  const white = new THREE.Color('#ffffff');
  const sampleColor = new THREE.Color();
  // Bakes several transformed pieces into one geometry so a whole plant is a
  // single draw call. Pieces without vertex colours take `color`.
  function mergeParts(parts) {
    const positions = [],
      normals = [],
      colors = [],
      uvs = [],
      index = [];
    let offset = 0;
    for (const part of parts) {
      const geometry = part.geometry.clone();
      if (part.matrix) geometry.applyMatrix4(part.matrix);
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      const { position, normal, color, uv } = geometry.attributes;
      for (let i = 0; i < position.count; i++) {
        positions.push(position.getX(i), position.getY(i), position.getZ(i));
        normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
        if (color) {
          sampleColor.setRGB(color.getX(i), color.getY(i), color.getZ(i));
          if (part.color) sampleColor.multiply(part.color);
        } else sampleColor.copy(part.color ?? white);
        colors.push(sampleColor.r, sampleColor.g, sampleColor.b);
        uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      }
      if (geometry.index)
        for (let i = 0; i < geometry.index.count; i++)
          index.push(geometry.index.getX(i) + offset);
      else for (let i = 0; i < position.count; i++) index.push(i + offset);
      offset += position.count;
      geometry.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    merged.setIndex(index);
    merged.computeBoundingSphere();
    return merged;
  }
  function place(
    x,
    y,
    z,
    rx = 0,
    ry = 0,
    rz = 0,
    sx = 1,
    sy = sx,
    sz = sx,
    order = 'XYZ',
  ) {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, order)),
      new THREE.Vector3(sx, sy, sz),
    );
  }
  const color = (hex) => new THREE.Color(hex);

  function stemPart(points, radius, hex, segments = 8) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    return {
      part: {
        geometry: new THREE.TubeGeometry(curve, segments, radius, 4),
        color: color(hex),
      },
      curve,
    };
  }
  // Matrix that puts a +y-pointing piece at the end of a curve, along its tangent.
  function atCurveEnd(curve, along = 0) {
    const end = curve.getPoint(1),
      tangent = curve.getTangent(1);
    end.addScaledVector(tangent, along);
    return new THREE.Matrix4().compose(
      end,
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        tangent,
      ),
      new THREE.Vector3(1, 1, 1),
    );
  }

  const petalGeometries = new Map();
  function petalGeometry(length, width) {
    const key = `${length}:${width}`;
    if (!petalGeometries.has(key)) {
      const shape = new THREE.Shape();
      shape.absellipse(length / 2, 0, length / 2, width / 2, 0, TAU);
      const geometry = new THREE.ShapeGeometry(shape, 5);
      geometry.rotateX(-Math.PI / 2);
      petalGeometries.set(key, geometry);
    }
    return petalGeometries.get(key);
  }
  // Petals radiating from the head origin, facing +y; `cup` lifts the tips.
  function flowerHeadParts({
    petals,
    length,
    width,
    petalHex,
    centerHex,
    centerRadius,
    cup = 0.2,
    rings = 1,
  }) {
    const parts = [];
    const petal = petalGeometry(length, width);
    for (let ring = 0; ring < rings; ring++)
      for (let i = 0; i < petals; i++) {
        const angle = (i / petals) * TAU + ring * (Math.PI / petals);
        parts.push({
          geometry: petal,
          matrix: place(
            0,
            ring * 0.004,
            0,
            0,
            angle,
            cup + ring * 0.25,
            1 - ring * 0.18,
            1,
            1,
            'YZX',
          ),
          color: color(petalHex).multiplyScalar(1 - ring * 0.08),
        });
      }
    parts.push({
      geometry: new THREE.SphereGeometry(centerRadius, 10, 6),
      matrix: place(0, centerRadius * 0.2, 0, 0, 0, 0, 1, 0.55, 1),
      color: color(centerHex),
    });
    return parts;
  }
  function withMatrix(parts, matrix) {
    return parts.map((part) => ({
      ...part,
      matrix: part.matrix ? matrix.clone().multiply(part.matrix) : matrix,
    }));
  }
  function basalLeaves(count, scale, hex, spread = 0.5) {
    const parts = [];
    for (let i = 0; i < count; i++)
      parts.push({
        geometry: leafBlade,
        matrix: place(
          0,
          0,
          0,
          spread + rand(0, 0.3),
          (i / count) * TAU + rand(-0.3, 0.3),
          0,
          scale,
          scale * rand(0.8, 1.2),
          scale,
          'YXZ',
        ),
        color: color(hex),
      });
    return parts;
  }

  function flowerGeometry({
    height,
    lean,
    head,
    leaves = 2,
    stemHex = '#557a2c',
  }) {
    const { part, curve } = stemPart(
      [
        [0, 0, 0],
        [lean * 0.3, height * 0.5, lean * 0.2],
        [lean, height, lean * 0.6],
      ],
      0.011,
      stemHex,
    );
    return mergeParts([
      part,
      ...withMatrix(
        head,
        atCurveEnd(curve).multiply(place(0, 0, 0, 0.35, 0, 0)),
      ),
      ...basalLeaves(leaves, 0.32, '#c8d8a0', 1.0),
    ]);
  }
  const daisyHead = flowerHeadParts({
    petals: 18,
    length: 0.13,
    width: 0.03,
    petalHex: '#f3efe2',
    centerHex: '#e0a92a',
    centerRadius: 0.042,
    cup: 0.12,
  });
  const yellowHead = flowerHeadParts({
    petals: 16,
    length: 0.085,
    width: 0.022,
    petalHex: '#f6c52c',
    centerHex: '#d99418',
    centerRadius: 0.034,
    cup: 0.28,
    rings: 2,
  });
  function puffHead() {
    const parts = [
      {
        geometry: new THREE.IcosahedronGeometry(0.075, 2),
        color: color('#e9e6da'),
      },
    ];
    const seed = new THREE.IcosahedronGeometry(0.014, 0);
    for (let i = 0; i < 42; i++) {
      const y = 1 - (i + 0.5) / 21,
        radius = Math.sqrt(Math.max(0, 1 - y * y)),
        angle = i * 2.399963;
      parts.push({
        geometry: seed,
        matrix: place(
          Math.cos(angle) * radius * 0.12,
          y * 0.12,
          Math.sin(angle) * radius * 0.12,
        ),
        color: color('#fbfaf3'),
      });
    }
    return parts;
  }
  const daisyGeometry = flowerGeometry({
    height: 1.35,
    lean: 0.08,
    head: daisyHead,
  });
  const yellowGeometry = flowerGeometry({
    height: 1.05,
    lean: 0.12,
    head: yellowHead,
  });
  const puffGeometry = flowerGeometry({
    height: 1.3,
    lean: 0.05,
    head: puffHead(),
    leaves: 3,
  });

  // Seed heads catch the low sun the way the reference's backlit stalks do.
  function foxtailParts(height = 1.3, droop = 0.32) {
    const { part, curve } = stemPart(
      [
        [0, 0, 0],
        [0.02, height * 0.5, 0.04],
        [0.05, height * 0.88, droop * 0.6],
        [0.06, height, droop],
      ],
      0.008,
      '#6f8f37',
      10,
    );
    const head = atCurveEnd(curve, 0.1);
    const parts = [
      part,
      {
        geometry: new THREE.CylinderGeometry(0.02, 0.011, 0.22, 7, 3),
        matrix: head,
        color: color('#a9ab55'),
      },
    ];
    const bristle = new THREE.PlaneGeometry(0.004, 0.05);
    bristle.translate(0, 0.025, 0);
    for (let i = 0; i < 34; i++) {
      const angle = i * 2.399963,
        along = (i / 34 - 0.5) * 0.2;
      parts.push({
        geometry: bristle,
        matrix: head
          .clone()
          .multiply(
            place(
              Math.cos(angle) * 0.016,
              along,
              Math.sin(angle) * 0.016,
              0,
              -angle,
              -1.05,
              1,
              1,
              1,
              'YZX',
            ),
          ),
        color: color('#e4d68c'),
      });
    }
    return parts;
  }
  function spikeParts(height = 1.45) {
    const { part } = stemPart(
      [
        [0, 0, 0],
        [0.03, height * 0.6, 0.02],
        [0.05, height, 0.06],
      ],
      0.007,
      '#7a9a44',
    );
    const parts = [part];
    const bead = new THREE.SphereGeometry(0.016, 6, 4);
    for (let i = 0; i < 14; i++) {
      const y = height - 0.02 - i * 0.022,
        side = i % 2 ? 1 : -1;
      parts.push({
        geometry: bead,
        matrix: place(
          0.05 + side * 0.012,
          y,
          0.06,
          0,
          0,
          side * 0.5,
          1,
          1.9,
          1,
        ),
        color: color(i < 4 ? '#e2d9a0' : '#c3c084'),
      });
    }
    return parts;
  }
  function panicleParts(height = 1.6) {
    const { part } = stemPart(
      [
        [0, 0, 0],
        [0.02, height * 0.6, 0.03],
        [0.04, height, 0.05],
      ],
      0.007,
      '#7d9346',
    );
    const parts = [part];
    const bead = new THREE.SphereGeometry(0.014, 5, 4);
    for (let i = 0; i < 6; i++) {
      const angle = i * 2.2,
        y = height - 0.06 - i * 0.06,
        reach = 0.09 + i * 0.015;
      const { part: branch, curve } = stemPart(
        [
          [0.04, y, 0.05],
          [
            0.04 + Math.cos(angle) * reach * 0.5,
            y + 0.05,
            0.05 + Math.sin(angle) * reach * 0.5,
          ],
          [
            0.04 + Math.cos(angle) * reach,
            y + 0.04,
            0.05 + Math.sin(angle) * reach,
          ],
        ],
        0.003,
        '#9aa45a',
        4,
      );
      parts.push(branch);
      for (let k = 0; k < 3; k++) {
        const point = curve.getPoint(0.45 + k * 0.27);
        parts.push({
          geometry: bead,
          matrix: place(point.x, point.y + 0.01, point.z, 0, 0, 0, 1, 1.6, 1),
          color: color('#d9cd9a'),
        });
      }
    }
    return parts;
  }
  const foxtailGeometry = mergeParts(foxtailParts());
  const spikeGeometry = mergeParts(spikeParts());
  const panicleGeometry = mergeParts(panicleParts());

  const heart = new THREE.Shape();
  heart.moveTo(0, 0);
  heart.bezierCurveTo(0.02, 0.01, 0.05, 0.03, 0.05, 0.055);
  heart.bezierCurveTo(0.05, 0.078, 0.028, 0.084, 0, 0.066);
  heart.bezierCurveTo(-0.028, 0.084, -0.05, 0.078, -0.05, 0.055);
  heart.bezierCurveTo(-0.05, 0.03, -0.02, 0.01, 0, 0);
  const leaflet = new THREE.ShapeGeometry(heart, 6);
  leaflet.rotateX(-Math.PI / 2);
  function cloverSprigParts(x, z, height) {
    const { part } = stemPart(
      [
        [x, 0, z],
        [x + 0.01, height * 0.6, z],
        [x, height, z + 0.01],
      ],
      0.004,
      '#5f8a35',
      4,
    );
    const parts = [part];
    for (let i = 0; i < 3; i++)
      parts.push({
        geometry: leaflet,
        matrix: place(
          x,
          height,
          z,
          0.25,
          (i / 3) * TAU + rand(-0.2, 0.2),
          0,
          1.6,
          1,
          1.6,
          'YXZ',
        ),
        color: color(i === 0 ? '#4b7a2a' : '#557f2f'),
      });
    return parts;
  }
  function cloverPatchGeometry(flowers) {
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const angle = rand(0, TAU),
        distance = rand(0, 0.22);
      parts.push(
        ...cloverSprigParts(
          Math.cos(angle) * distance,
          Math.sin(angle) * distance,
          rand(0.12, 0.24),
        ),
      );
    }
    for (let i = 0; i < flowers; i++) {
      const x = rand(-0.12, 0.12),
        z = rand(-0.12, 0.12);
      const { part } = stemPart(
        [
          [x, 0, z],
          [x, 0.2, z + 0.01],
          [x + 0.01, 0.34, z],
        ],
        0.004,
        '#6a8d3c',
        4,
      );
      parts.push(part, {
        geometry: new THREE.IcosahedronGeometry(0.038, 1),
        matrix: place(x + 0.01, 0.37, z, 0, 0, 0, 1, 0.85, 1),
        color: color('#f1ebdc'),
      });
    }
    return mergeParts(parts);
  }
  const cloverGeometry = cloverPatchGeometry(0);
  const cloverFlowerGeometry = cloverPatchGeometry(2);

  function plantainParts(spikes = 2) {
    const parts = [];
    const leafShape = new THREE.Shape();
    leafShape.absellipse(0.17, 0, 0.17, 0.065, 0, TAU);
    const leaf = new THREE.ShapeGeometry(leafShape, 6);
    leaf.rotateX(-Math.PI / 2);
    for (let i = 0; i < 7; i++)
      parts.push({
        geometry: leaf,
        matrix: place(
          0,
          0.01,
          0,
          0,
          (i / 7) * TAU + rand(-0.2, 0.2),
          rand(0.25, 0.5),
          rand(0.9, 1.2),
          1,
          1,
          'YZX',
        ),
        color: color(i % 2 ? '#4b7234' : '#58803b'),
      });
    for (let i = 0; i < spikes; i++) {
      const lean = rand(-0.06, 0.06);
      const { part, curve } = stemPart(
        [
          [0, 0, 0],
          [lean, 0.3, 0],
          [lean * 2, 0.58, 0.02],
        ],
        0.006,
        '#6d8540',
        6,
      );
      parts.push(part, {
        geometry: new THREE.CylinderGeometry(0.014, 0.01, 0.18, 6),
        matrix: atCurveEnd(curve, 0.09),
        color: color('#8f8550'),
      });
    }
    return parts;
  }

  function headOnStem(points, stemHex, head, headScale, along = 0) {
    const { part, curve } = stemPart(points, 0.011, stemHex);
    return [
      part,
      ...withMatrix(
        head,
        atCurveEnd(curve, along).multiply(place(0, 0, 0, 0, 0, 0, headScale)),
      ),
    ];
  }

  // Tufts the player is and can meet. One merged mesh each so a dozen
  // followers stay cheap; `tint` lets species read differently at a glance.
  function tuftParts(count, tint, height = 1) {
    const parts = [];
    for (let i = 0; i < count; i++)
      parts.push({
        geometry: broadBlade,
        matrix: place(
          rand(-0.03, 0.03),
          0,
          rand(-0.03, 0.03),
          (i % 3) * 0.08 - 0.08 + rand(-0.12, 0.12),
          i * 2.399963,
          0,
          2.2,
          height * rand(0.65, 1.15),
          2.2,
          'YXZ',
        ),
        color: color(tint).lerp(white, rand(0, 0.15)),
      });
    return parts;
  }
  const tuftTints = {
    poa: '#d6ecb0',
    bermuda: '#b8d6b2',
    crabgrass: '#e4f0b4',
    goosegrass: '#a9c69a',
    self: '#e8f6c0',
  };
  function tuftGeometry(form, speciesId) {
    if (form === 'foxtail')
      return mergeParts([
        ...tuftParts(7, '#d2e4a4', 0.9),
        ...withMatrix(
          foxtailParts(1.25, 0.3),
          place(0.02, 0, 0, 0, 0.4, 0, 0.9),
        ),
        ...withMatrix(
          foxtailParts(1.1, 0.26),
          place(-0.03, 0, 0.02, 0, 2.6, 0, 0.85),
        ),
      ]);
    if (form === 'clover')
      return mergeParts(
        withMatrix(
          [
            ...cloverSprigParts(0, 0, 0.2),
            ...cloverSprigParts(0.08, 0.05, 0.16),
            ...cloverSprigParts(-0.07, 0.06, 0.22),
            ...cloverSprigParts(0.02, -0.08, 0.18),
          ],
          place(0, 0, 0, 0, 0, 0, 3.4),
        ),
      );
    if (form === 'dandelion')
      return mergeParts([
        ...basalLeaves(8, 0.75, '#bcd18e', 1.15),
        ...headOnStem(
          [
            [0, 0, 0],
            [0.03, 0.45, 0],
            [0.06, 0.9, 0.04],
          ],
          '#7d9a46',
          yellowHead,
          1.6,
        ),
        ...headOnStem(
          [
            [0, 0, 0],
            [-0.04, 0.55, 0.02],
            [-0.06, 1.1, 0],
          ],
          '#8aa152',
          puffHead(),
          1.5,
          0.05,
        ),
      ]);
    if (form === 'plantain')
      return mergeParts(
        withMatrix(plantainParts(2), place(0, 0, 0, 0, 0, 0, 2.6)),
      );
    const parts = tuftParts(
      speciesId === 'self' ? 12 : 10,
      tuftTints[speciesId] ?? tuftTints.poa,
      speciesId === 'self' ? 1.05 : 1,
    );
    if (speciesId === 'self')
      // A new, still-curled shoot in the middle: the part of you that is growing.
      parts.push({
        geometry: broadBlade,
        matrix: place(0, 0, 0, -0.05, 0.6, 0, 1.2, 0.55, 3.4),
        color: color('#f2ffcc'),
      });
    return mergeParts(parts);
  }

  const materials = {
    blade: plantMaterial({ map: veinTexture }),
    plant: plantMaterial({ bendHeight: 1.6, translucency: 0.7 }),
    tuft: plantMaterial({ bendHeight: 1.3 }),
  };

  function instanceField(geometry, material, count, arrange) {
    const field = new THREE.InstancedMesh(geometry, material, count);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i++) {
      arrange(i, tint);
      dummy.updateMatrix();
      field.setMatrixAt(i, dummy.matrix);
      field.setColorAt(i, tint);
    }
    field.receiveShadow = true;
    return field;
  }
  function annulus(inner, outer) {
    const angle = rand(0, TAU),
      radius = Math.sqrt(rand((inner * inner) / (outer * outer), 1)) * outer;
    return [Math.sin(angle) * radius, Math.cos(angle) * radius];
  }

  // Blades are recorded when `records` is given so dew can be hung on them.
  function bladeField(
    scene,
    {
      geometry,
      count,
      inner = 0,
      outer,
      height: [low, high],
      records,
      dry = 0.05,
      shadow = false,
    },
  ) {
    const field = instanceField(geometry, materials.blade, count, (i, tint) => {
      const [ringX, z] = annulus(inner, outer);
      // Keep a little space around the player's starting spot.
      const x =
        Math.hypot(ringX, z) < 0.75
          ? ringX + (ringX < 0 ? -0.75 : 0.75)
          : ringX;
      const rotation = rand(0, TAU),
        height = rand(low, high),
        scaleX = height * rand(0.8, 1.5),
        scaleZ = height * rand(0.8, 1.2);
      dummy.position.set(x, microHeight(x, z) - 0.02, z);
      dummy.rotation.set(rand(-0.12, 0.12), rotation, rand(-0.12, 0.12));
      dummy.scale.set(scaleX, height, scaleZ);
      if (rand(0, 1) < dry) tint.set('#e3cf92');
      else tint.setHSL(rand(0.18, 0.3), rand(0.2, 0.45), rand(0.72, 0.9));
      if (records) {
        dummy.updateMatrix();
        records.push({
          x,
          z,
          rotation,
          scaleX,
          scaleZ,
          matrix: dummy.matrix.clone(),
          curve: geometry.userData.curve,
        });
      }
    });
    if (shadow) castSwayingShadow(field, 1);
    scene.add(field);
    return field;
  }

  function scatter(
    scene,
    geometry,
    material,
    count,
    { inner = 0, outer, scale: [low, high], tint, shadow = true },
  ) {
    const field = instanceField(geometry, material, count, (i, color) => {
      const [x, z] = annulus(inner, outer);
      const size = rand(low, high);
      dummy.position.set(x, microHeight(x, z) - 0.01, z);
      dummy.rotation.set(rand(-0.08, 0.08), rand(0, TAU), rand(-0.08, 0.08));
      dummy.scale.setScalar(size);
      if (tint) tint(color);
      else color.set('#ffffff');
    });
    if (shadow)
      castSwayingShadow(field, Number(material.defines.GRASS_BEND_HEIGHT));
    scene.add(field);
    return field;
  }

  function buildMeadow(scene) {
    const blades = [];
    bladeField(scene, {
      geometry: broadBlade,
      count: 2600,
      outer: 22,
      height: [0.55, 1.9],
      records: blades,
      shadow: true,
    });
    bladeField(scene, {
      geometry: broadBlade,
      count: 1500,
      inner: 9,
      outer: 46,
      height: [1.8, 3.6],
      dry: 0.08,
    });
    bladeField(scene, {
      geometry: fineBlade,
      count: 15000,
      outer: 55,
      height: [0.35, 1.3],
      dry: 0.07,
    });
    const plant = materials.plant;
    const ripe = (tint) =>
      tint.setHSL(rand(0.1, 0.16), rand(0.1, 0.3), rand(0.82, 1));
    scatter(scene, foxtailGeometry, plant, 170, {
      inner: 3,
      outer: 34,
      scale: [0.8, 1.5],
      tint: ripe,
    });
    scatter(scene, spikeGeometry, plant, 150, {
      inner: 4,
      outer: 38,
      scale: [0.8, 1.6],
    });
    scatter(scene, panicleGeometry, plant, 130, {
      inner: 5,
      outer: 42,
      scale: [0.9, 1.7],
    });
    scatter(scene, daisyGeometry, plant, 75, {
      inner: 3,
      outer: 30,
      scale: [0.9, 1.7],
    });
    scatter(scene, yellowGeometry, plant, 95, {
      inner: 3,
      outer: 32,
      scale: [0.85, 1.5],
    });
    scatter(scene, puffGeometry, plant, 20, {
      inner: 4,
      outer: 26,
      scale: [0.9, 1.4],
    });
    scatter(scene, cloverGeometry, materials.tuft, 150, {
      inner: 1.5,
      outer: 24,
      scale: [1.5, 2.3],
    });
    scatter(scene, cloverFlowerGeometry, materials.tuft, 45, {
      inner: 2,
      outer: 24,
      scale: [1.5, 2.2],
    });
    scatter(scene, mergeParts(plantainParts(1)), materials.tuft, 40, {
      inner: 3,
      outer: 28,
      scale: [2, 3],
    });
    return blades;
  }

  function hero(scene, geometry, material, x, z, scale, rotation = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, microHeight(x, z), z);
    object.rotation.y = rotation;
    object.scale.setScalar(scale);
    castSwayingShadow(object, Number(material.defines.GRASS_BEND_HEIGHT));
    object.receiveShadow = true;
    scene.add(object);
    return object;
  }
  function tuft(scene, form, speciesId, x, z, size) {
    const object = new THREE.Mesh(
      tuftGeometry(form, speciesId),
      materials.tuft,
    );
    object.position.set(x, microHeight(x, z), z);
    object.scale.setScalar(size);
    castSwayingShadow(object, 1.3);
    object.receiveShadow = true;
    scene.add(object);
    return object;
  }

  // ---- Soil -----------------------------------------------------------------
  const soilTexture = canvasTexture(
    512,
    512,
    (ctx) => {
      ctx.fillStyle = '#4b3524';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 240; i++) {
        const x = rand(0, 512),
          y = rand(0, 512),
          radius = rand(10, 46);
        const blot = ctx.createRadialGradient(x, y, 0, x, y, radius);
        blot.addColorStop(
          0,
          rand(0, 1) < 0.5 ? 'rgba(28,18,10,.38)' : 'rgba(118,86,56,.26)',
        );
        blot.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = blot;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      const crumbs = [
        'rgba(26,17,10,.6)',
        'rgba(94,68,44,.55)',
        'rgba(134,103,72,.45)',
        'rgba(58,42,28,.65)',
      ];
      for (let i = 0; i < 28000; i++) {
        ctx.fillStyle = crumbs[Math.floor(rand(0, crumbs.length))];
        ctx.fillRect(
          rand(0, 512),
          rand(0, 512),
          rand(0.6, 2.6),
          rand(0.6, 2.2),
        );
      }
      for (let i = 0; i < 900; i++) {
        const x = rand(0, 512),
          y = rand(0, 512),
          radius = rand(0.8, 2.2);
        ctx.fillStyle = 'rgba(20,13,8,.5)';
        ctx.beginPath();
        ctx.arc(x + 0.6, y + 0.8, radius, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(170,152,128,.6)';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = 'rgba(78,92,38,.35)';
        ctx.fillRect(rand(0, 512), rand(0, 512), rand(1, 3), rand(1, 3));
      }
    },
    26,
  );
  function dressSoil(ground) {
    Object.assign(ground.material, {
      map: soilTexture,
      bumpMap: soilTexture,
      bumpScale: 0.14,
    });
    ground.material.needsUpdate = true;
    return ground.material;
  }

  // Lumpy clods with a few moss cushions, denser near where the player starts.
  function buildClods(scene) {
    const clod = new THREE.IcosahedronGeometry(1, 2);
    const position = clod.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        y = position.getY(i),
        z = position.getZ(i);
      const bump =
        1 +
        Math.sin(x * 3.1 + y * 1.7) * 0.12 +
        Math.sin(y * 4.3 + z * 2.9) * 0.1 +
        Math.cos(z * 5.7 + x * 2.3) * 0.07;
      position.setXYZ(i, x * bump, y * bump, z * bump);
    }
    clod.computeVertexNormals();
    const clodMaterial = mat('#ffffff', {
      map: soilTexture,
      bumpMap: soilTexture,
      bumpScale: 0.3,
      roughness: 1,
    });
    const count = 1500,
      clods = new THREE.InstancedMesh(clod, clodMaterial, count),
      tops = [];
    const tint = new THREE.Color();
    let made = 0;
    while (made < count) {
      const [cx, cz] = rand(0, 1) < 0.35 ? annulus(0.9, 7) : annulus(1, 28);
      const cluster = Math.floor(rand(5, 16));
      for (let k = 0; k < cluster && made < count; k++, made++) {
        const x = cx + rand(-0.55, 0.55),
          z = cz + rand(-0.55, 0.55),
          size = rand(0.04, 0.28) * (rand(0, 1) < 0.08 ? 1.6 : 1);
        dummy.position.set(x, microHeight(x, z) - size * 0.35, z);
        dummy.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
        dummy.scale.set(
          size * rand(0.8, 1.3),
          size * rand(0.55, 0.85),
          size * rand(0.8, 1.3),
        );
        dummy.updateMatrix();
        clods.setMatrixAt(made, dummy.matrix);
        clods.setColorAt(
          made,
          tint.setHSL(rand(0.06, 0.09), rand(0.25, 0.4), rand(0.42, 0.62)),
        );
        if (rand(0, 1) < 0.35)
          tops.push([x, dummy.position.y + size * 0.55, z, size]);
      }
    }
    clods.castShadow = clods.receiveShadow = true;
    scene.add(clods);

    const moss = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      mat('#ffffff', { roughness: 1 }),
      1300,
    );
    for (let i = 0; i < 1300; i++) {
      let x, y, z, size;
      if (i < tops.length * 2 && tops.length) {
        const [tx, ty, tz, clodSize] = tops[i % tops.length];
        x = tx + rand(-0.4, 0.4) * clodSize;
        z = tz + rand(-0.4, 0.4) * clodSize;
        y = ty;
        size = clodSize * rand(0.15, 0.35);
      } else {
        [x, z] = annulus(0.8, 20);
        y = microHeight(x, z);
        size = rand(0.02, 0.06);
      }
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rand(0, TAU), 0);
      dummy.scale.set(size * rand(1, 1.6), size * 0.55, size * rand(1, 1.6));
      dummy.updateMatrix();
      moss.setMatrixAt(i, dummy.matrix);
      moss.setColorAt(
        i,
        tint.setHSL(rand(0.19, 0.25), rand(0.45, 0.65), rand(0.22, 0.36)),
      );
    }
    moss.receiveShadow = true;
    scene.add(moss);

    const pebbles = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      mat('#ffffff', { roughness: 0.8 }),
      2200,
    );
    for (let i = 0; i < 2200; i++) {
      const [x, z] = annulus(0, 40);
      dummy.position.set(x, microHeight(x, z), z);
      dummy.scale.set(rand(0.025, 0.1), rand(0.015, 0.06), rand(0.025, 0.1));
      dummy.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      dummy.updateMatrix();
      pebbles.setMatrixAt(i, dummy.matrix);
      pebbles.setColorAt(
        i,
        tint.setHSL(rand(0.07, 0.12), rand(0.05, 0.18), rand(0.32, 0.62)),
      );
    }
    pebbles.receiveShadow = true;
    scene.add(pebbles);
  }

  // Fallen leaves, twigs and a few mushrooms: litter at grass height.
  function buildLitter(scene) {
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.09, 0.12, 0, 0.32);
    leafShape.quadraticCurveTo(-0.09, 0.12, 0, 0);
    const fallen = new THREE.ShapeGeometry(leafShape, 6);
    fallen.rotateX(-Math.PI / 2);
    const leafPosition = fallen.attributes.position;
    for (let i = 0; i < leafPosition.count; i++) {
      const x = leafPosition.getX(i);
      leafPosition.setY(i, x * x * 3 + 0.004);
    }
    fallen.computeVertexNormals();
    const leaves = new THREE.InstancedMesh(
      fallen,
      mat('#ffffff', { side: THREE.DoubleSide, roughness: 0.9 }),
      80,
    );
    const autumn = ['#8a5a2b', '#a8742f', '#6b4a2a', '#b99a4a', '#7d6a3a'];
    const tint = new THREE.Color();
    for (let i = 0; i < 80; i++) {
      const [x, z] = annulus(0.8, 24);
      dummy.position.set(x, microHeight(x, z) + 0.005, z);
      dummy.rotation.set(rand(-0.1, 0.1), rand(0, TAU), rand(-0.1, 0.1));
      dummy.scale.setScalar(rand(0.7, 1.5));
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
      leaves.setColorAt(i, tint.set(autumn[i % autumn.length]));
    }
    leaves.receiveShadow = true;
    scene.add(leaves);

    const twig = new THREE.CylinderGeometry(0.01, 0.014, 1, 5);
    twig.rotateZ(Math.PI / 2);
    const twigs = new THREE.InstancedMesh(twig, mat('#6a5238'), 45);
    for (let i = 0; i < 45; i++) {
      const [x, z] = annulus(1, 26);
      dummy.position.set(x, microHeight(x, z) + 0.01, z);
      dummy.rotation.set(0, rand(0, TAU), rand(-0.05, 0.05));
      dummy.scale.set(rand(0.3, 1.1), rand(0.8, 1.6), rand(0.8, 1.6));
      dummy.updateMatrix();
      twigs.setMatrixAt(i, dummy.matrix);
    }
    twigs.castShadow = twigs.receiveShadow = true;
    scene.add(twigs);

    const stem = new THREE.CylinderGeometry(0.018, 0.026, 0.13, 8);
    stem.translate(0, 0.065, 0);
    const cap = new THREE.SphereGeometry(0.07, 14, 7, 0, TAU, 0, Math.PI / 2);
    cap.scale(1, 0.62, 1);
    cap.translate(0, 0.122, 0);
    const stems = new THREE.InstancedMesh(
        stem,
        mat('#ece2cc', { roughness: 0.7 }),
        16,
      ),
      caps = new THREE.InstancedMesh(
        cap,
        mat('#ffffff', { roughness: 0.55 }),
        16,
      );
    const capColors = ['#b8743a', '#d6bf98', '#8c5a35'];
    for (let i = 0, cluster = 0; i < 16; cluster++) {
      const [cx, cz] = annulus(2.5, 14);
      for (let k = 0; k < 5 && i < 16; k++, i++) {
        const x = cx + rand(-0.25, 0.25),
          z = cz + rand(-0.25, 0.25);
        dummy.position.set(x, microHeight(x, z) - 0.01, z);
        dummy.rotation.set(rand(-0.15, 0.15), rand(0, TAU), rand(-0.15, 0.15));
        dummy.scale.setScalar(rand(0.6, 1.7));
        dummy.updateMatrix();
        stems.setMatrixAt(i, dummy.matrix);
        caps.setMatrixAt(i, dummy.matrix);
        caps.setColorAt(i, tint.set(capColors[cluster % capColors.length]));
      }
    }
    stems.castShadow = caps.castShadow = true;
    scene.add(stems, caps);
  }

  // ---- Dew ------------------------------------------------------------------
  // Dew refracts a cube snapshot of the meadow taken once when the scene is
  // built; the snapshot lives as long as the cached scene.
  function teardropGeometry() {
    const profile = [];
    for (let i = 0; i <= 12; i++) {
      const angle = -Math.PI / 2 + (i / 12) * Math.PI * 0.72;
      profile.push(new THREE.Vector2(Math.cos(angle), Math.sin(angle)));
    }
    profile.push(new THREE.Vector2(0.0001, 1.45));
    return new THREE.LatheGeometry(profile, 16);
  }
  function injectDewShader(shader) {
    Object.assign(shader.uniforms, swayUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
${SWAY_GLSL}
attribute vec4 aBlade;
attribute vec2 aBladeScale;
varying float vDewRim;`,
      )
      .replace(
        '#include <envmap_vertex>',
        `#include <envmap_vertex>
#ifdef USE_ENVMAP
// A drop is a tiny lens: mirror the refracted ray around the view axis so the
// world behind appears upside down, sky below and meadow above.
vReflect = 2.0 * dot(vReflect, cameraToVertex) * cameraToVertex - vReflect;
vDewRim = pow(1.0 - abs(dot(cameraToVertex, worldNormal)), 3.0);
#else
vDewRim = 0.0;
#endif`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
vec2 dewSway = grassSway(aBlade.xy, aBlade.w);
vec2 dewLocal = dewSway * aBladeScale;
float dewCos = cos(aBlade.z), dewSin = sin(aBlade.z);
mvPosition.x += dewLocal.x * dewCos + dewLocal.y * dewSin;
mvPosition.z += -dewLocal.x * dewSin + dewLocal.y * dewCos;
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vDewRim;')
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight = outgoingLight * 1.15 + vec3(1.0, 0.97, 0.9) * vDewRim * 0.8;
#include <opaque_fragment>`,
      );
  }
  function dewMaterial(params) {
    const material = new THREE.MeshBasicMaterial(params);
    material.defines = { GRASS_BEND_HEIGHT: '1.00' };
    material.onBeforeCompile = injectDewShader;
    return material;
  }

  // Each drop rides a recorded blade: beads sit on the face, others hang from
  // the tip. `extra` adds hand-placed drops such as the large one near start.
  function buildDew(scene, blades, refraction, extra = []) {
    const drops = [];
    const point = new THREE.Vector3();
    for (const blade of blades) {
      if (Math.hypot(blade.x, blade.z) > 14 || rand(0, 1) > 0.11) continue;
      const hanging = rand(0, 1) < 0.3,
        along = hanging ? 0.985 : rand(0.3, 0.75);
      point
        .set(0, along, along * along * blade.curve + 0.012)
        .applyMatrix4(blade.matrix);
      const radius = hanging ? rand(0.045, 0.085) : rand(0.022, 0.055);
      if (hanging) point.y -= radius * 1.1;
      drops.push({ blade, along, radius, hanging, position: point.clone() });
    }
    drops.push(...extra);
    const geometry = teardropGeometry();
    const bladeData = new Float32Array(drops.length * 4),
      scaleData = new Float32Array(drops.length * 2);
    drops.forEach((drop, i) => {
      bladeData.set(
        [drop.blade.x, drop.blade.z, drop.blade.rotation, drop.along],
        i * 4,
      );
      scaleData.set([drop.blade.scaleX, drop.blade.scaleZ], i * 2);
    });
    const dew = new THREE.InstancedMesh(
      geometry,
      dewMaterial({
        color: '#ffffff',
        envMap: refraction,
        refractionRatio: 0.8,
      }),
      drops.length,
    );
    const glints = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 6, 4),
      dewMaterial({ color: '#fffbea' }),
      drops.length,
    );
    const bladeAttribute = new THREE.InstancedBufferAttribute(bladeData, 4),
      scaleAttribute = new THREE.InstancedBufferAttribute(scaleData, 2);
    for (const mesh of [dew, glints]) {
      mesh.geometry.setAttribute('aBlade', bladeAttribute);
      mesh.geometry.setAttribute('aBladeScale', scaleAttribute);
    }
    drops.forEach((drop, i) => {
      const r = drop.radius;
      dummy.position.copy(drop.position);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(r, drop.hanging ? r : r * 0.75, r);
      dummy.updateMatrix();
      dew.setMatrixAt(i, dummy.matrix);
      dummy.position.y += r * 0.45;
      dummy.position.x += r * 0.3;
      dummy.scale.setScalar(r * 0.16);
      dummy.updateMatrix();
      glints.setMatrixAt(i, dummy.matrix);
    });
    dew.frustumCulled = glints.frustumCulled = false;
    scene.add(dew, glints);
    return { dew, glints, drops };
  }
  function captureRefraction(scene, position) {
    const target = new THREE.WebGLCubeRenderTarget(256, {
      type: THREE.HalfFloatType,
    });
    target.texture.mapping = THREE.CubeRefractionMapping;
    const camera = new THREE.CubeCamera(0.05, 1800, target);
    camera.position.copy(position);
    camera.update(renderer, scene);
    return target.texture;
  }

  // Twinkling points: the thousands of drops too small to model.
  function sparkleField(count, radius) {
    const positions = [],
      phases = [];
    for (let i = 0; i < count; i++) {
      const [x, z] = annulus(0.5, radius);
      positions.push(x, microHeight(x, z) + rand(0.05, 1.3), z);
      phases.push(rand(0, 1));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      'aPhase',
      new THREE.Float32BufferAttribute(phases, 1),
    );
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: windUniform, uStrength: { value: 0.6 } },
      vertexShader: /* glsl */ `
attribute float aPhase;
uniform float uTime;
varying float vTwinkle;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vTwinkle = pow(0.5 + 0.5 * sin(uTime * (1.2 + aPhase * 0.6) + aPhase * 6.2831), 6.0);
  gl_PointSize = min(22.0, (2.0 + vTwinkle * 5.0) * 6.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */ `
uniform float uStrength;
varying float vTwinkle;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float glow = smoothstep(0.5, 0.0, length(d));
  float star = max(smoothstep(0.07, 0.0, abs(d.x)) * smoothstep(0.5, 0.0, abs(d.y)), smoothstep(0.07, 0.0, abs(d.y)) * smoothstep(0.5, 0.0, abs(d.x)));
  gl_FragColor = vec4(1.0, 0.97, 0.86, (glow * 0.6 + star * 0.8) * vTwinkle * uStrength);
}`,
    });
    return new THREE.Points(geometry, material);
  }

  return {
    swayUniforms,
    materials,
    broadBlade,
    daisyGeometry,
    buildMeadow,
    buildClods,
    buildLitter,
    buildDew,
    captureRefraction,
    sparkleField,
    dressSoil,
    hero,
    tuft,
    mergeParts,
    place,
    stemPart,
    annulus,
  };
}
