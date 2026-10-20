import * as THREE from '../../vendor/three.module.js';
import { rng } from '../core/random.js';
import { paintTexture, spaceNoise } from './earth-materials.js';

const normal = new THREE.Vector3(0.34, 0.9, -0.24).normalize();
const axis = new THREE.Vector3()
  .crossVectors(normal, new THREE.Vector3(0, 1, 0))
  .normalize();
const along = new THREE.Vector3().crossVectors(normal, axis).normalize();
export const backgroundSettings = Object.freeze({
  stars: 4200,
  skyRadius: 2000,
  starRadius: 1600,
  rockCount: 32,
});
export function galaxyDensity(x, y, z) {
  const latitude = x * normal.x + y * normal.y + z * normal.z;
  const clouds = spaceNoise(x * 7 + 8, y * 7, z * 7, 801);
  const wide = Math.exp(-((latitude / 0.21) ** 2));
  const narrow = Math.exp(-((latitude / 0.07) ** 2));
  const lane =
    1 - 0.76 * Math.exp(-(((latitude + (clouds - 0.5) * 0.055) / 0.025) ** 2));
  return Math.max(
    0,
    Math.min(1, (wide * 0.52 + narrow * 0.48) * (0.38 + clouds * 0.62) * lane),
  );
}
function landmark(p, center, width, galaxy) {
  const dot = p.x * center.x + p.y * center.y + p.z * center.z;
  if (dot < Math.cos(width * 4)) return 0;
  const dx = p.x - center.x,
    dy = p.y - center.y,
    dz = p.z - center.z;
  const radius = Math.hypot(dx, dy * 2.2, dz) / width;
  const angle = Math.atan2(dy, dz);
  const arms = galaxy
    ? 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(angle * 2 - radius * 11))
    : 0.4 + spaceNoise(p.x * 19, p.y * 19, p.z * 19, 71) * 0.6;
  return Math.exp(-radius * radius * 1.4) * arms;
}
export function createEarthBackground({ decorations = true } = {}) {
  const sky = new THREE.Group();
  sky.name = 'earth-sky';
  sky.userData.decorative = true;
  const galaxyCenter = new THREE.Vector3(0.7, 0.3, -0.64).normalize();
  const nebulaCenter = new THREE.Vector3(-0.72, -0.3, 0.63).normalize();
  const map = paintTexture('space-density', 1024, 512, (p, _u, _v, out) => {
    const density = galaxyDensity(p.x, p.y, p.z);
    const dust = spaceNoise(p.x * 18, p.y * 18, p.z * 18, 913);
    const faint = decorations ? landmark(p, galaxyCenter, 0.065, true) : 0;
    const nebula = decorations ? landmark(p, nebulaCenter, 0.2, false) : 0;
    out[0] = 5 + density * (40 + dust * 20) + faint * 48 + nebula * 12;
    out[1] = 9 + density * (39 + dust * 19) + faint * 48 + nebula * 7;
    out[2] = 20 + density * (55 + dust * 23) + faint * 54 + nebula * 22;
    out[3] = 255;
  });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(backgroundSettings.skyRadius, 48, 32),
    new THREE.MeshBasicMaterial({
      map,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  dome.name = 'galactic-dome';
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  sky.add(dome);
  const random = rng(84417),
    positions = [],
    colors = [],
    sizes = [];
  const direction = new THREE.Vector3(),
    color = new THREE.Color();
  for (let i = 0; i < backgroundSettings.stars; i++) {
    if (random() < 0.44) {
      const angle = random() * Math.PI * 2,
        latitude = (random() - 0.5) * 0.28;
      direction
        .copy(axis)
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(along, Math.sin(angle))
        .addScaledVector(normal, latitude)
        .normalize();
    } else {
      const y = random() * 2 - 1,
        angle = random() * Math.PI * 2,
        r = Math.sqrt(1 - y * y);
      direction.set(r * Math.cos(angle), y, r * Math.sin(angle));
    }
    positions.push(direction.x * 1600, direction.y * 1600, direction.z * 1600);
    const tier = random(),
      size =
        tier < 0.85
          ? 0.75 + random() * 0.45
          : tier < 0.99
            ? 1.3 + random() * 0.8
            : 2.4 + random() * 0.9;
    const strength =
      tier < 0.85
        ? 0.27 + random() * 0.29
        : tier < 0.99
          ? 0.57 + random() * 0.28
          : 1;
    const tint = random();
    color
      .set(tint < 0.1 ? '#c9ddff' : tint > 0.9 ? '#ffe4bf' : '#eff2f4')
      .multiplyScalar(strength);
    colors.push(color.r, color.g, color.b);
    sizes.push(size);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 } },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexShader:
      'attribute float size; varying vec3 starColor; uniform float pixelRatio; void main(){starColor=color; gl_PointSize=size*pixelRatio; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      'varying vec3 starColor; void main(){float r=length(gl_PointCoord-0.5);float a=1.-smoothstep(0.12,0.5,r);if(a<0.01)discard;gl_FragColor=vec4(starColor,a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    vertexColors: true,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = 'graded-stars';
  stars.renderOrder = 1;
  stars.frustumCulled = false;
  stars.onBeforeRender = (renderer) => {
    material.uniforms.pixelRatio.value = renderer.getPixelRatio();
  };
  sky.add(stars);
  return sky;
}

// World-space reference, outside the full player+Moon envelope. One draw batch;
// not a talker, action, collision object or a second celestial companion.
export function createSpaceRocks() {
  const random = rng(9021),
    geometry = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshStandardMaterial({
    color: '#6f665d',
    roughness: 1,
    metalness: 0,
  });
  const rocks = new THREE.InstancedMesh(
    geometry,
    material,
    backgroundSettings.rockCount,
  );
  rocks.name = 'distant-rocks';
  rocks.userData.decorative = true;
  const transform = new THREE.Object3D();
  for (let i = 0; i < backgroundSettings.rockCount; i++) {
    const cluster = i < 16 ? 1 : -1;
    transform.position.set(
      cluster * (360 + random() * 120),
      -55 + random() * 70,
      70 + random() * 130,
    );
    transform.rotation.set(
      random() * Math.PI,
      random() * Math.PI,
      random() * Math.PI,
    );
    const size = 1.5 + random() * 3.5;
    transform.scale.set(
      size,
      size * (0.65 + random() * 0.5),
      size * (0.7 + random() * 0.5),
    );
    transform.updateMatrix();
    rocks.setMatrixAt(i, transform.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.computeBoundingSphere();
  return rocks;
}
