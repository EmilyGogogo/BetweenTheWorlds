import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from '../../vendor/three.module.js';
import { createEarth } from '../helpers/earth-fixture.mjs';
import { createEarthVisualUpdate } from '../../src/worlds/earth-visuals.js';
import { installEarthActions } from '../../src/worlds/earth-actions.js';
import {
  sphereDirection,
  earthSurface,
  moonSurface,
  cloudDensity,
} from '../../src/worlds/earth-materials.js';
import {
  galaxyDensity,
  createEarthBackground,
} from '../../src/worlds/earth-background.js';
import { withCanvas } from '../helpers/earth-fixture.mjs';

const running = {
  dt: 0.05,
  canInteract: true,
  canSimulate: true,
  reducedMotion: false,
};
const close = (a, b, epsilon = 1e-6) =>
  assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
function collect(world) {
  const objects = new Set(),
    geometry = new Set(),
    materials = new Set(),
    textures = new Set();
  world.scene.traverse((object) => {
    objects.add(object);
    if (object.geometry) geometry.add(object.geometry);
    for (const material of object.material ? [object.material].flat() : []) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value?.isTexture) textures.add(value);
      for (const uniform of Object.values(material.uniforms ?? {}))
        if (uniform.value?.isTexture) textures.add(uniform.value);
    }
  });
  return { objects, geometry, materials, textures };
}

test('spherical procedural fields are deterministic, bounded and continuous across seam and poles', () => {
  let land = 0,
    sea = 0,
    cloud = 0,
    clear = 0;
  let moonMin = 1,
    moonMax = 0;
  for (let row = 0; row <= 36; row++)
    for (let column = 0; column <= 72; column++) {
      const p = sphereDirection(column / 72, row / 36, {}),
        earth = earthSurface(p.x, p.y, p.z, {}),
        moon = moonSurface(p.x, p.y, p.z, {});
      assert.deepEqual(earthSurface(p.x, p.y, p.z, {}), earth);
      for (const value of Object.values(earth))
        assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
      for (const value of Object.values(moon))
        assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
      const density = cloudDensity(p.x, p.y, p.z);
      assert.ok(density >= 0 && density <= 0.78);
      if (Math.abs(p.y) < 0.85) {
        if (earth.land > 0.9) land++;
        if (earth.land < 0.1) sea++;
        if (density > 0.2) cloud++;
        if (density < 0.01) clear++;
      }
      moonMin = Math.min(moonMin, moon.height);
      moonMax = Math.max(moonMax, moon.height);
      const a = sphereDirection(0, row / 36, {}),
        b = sphereDirection(1, row / 36, {});
      for (const sample of [earthSurface, moonSurface]) {
        const sa = sample(a.x, a.y, a.z, {}),
          sb = sample(b.x, b.y, b.z, {});
        for (const field of Object.keys(sa)) close(sa[field], sb[field], 1e-9);
      }
      close(galaxyDensity(a.x, a.y, a.z), galaxyDensity(b.x, b.y, b.z), 1e-9);
    }
  assert.ok(
    land > 100 && sea > 100,
    'continents and oceans must both have substantial area',
  );
  assert.ok(cloud > 40 && clear > 100, 'clouds must leave surface readable');
  assert.ok(moonMax - moonMin > 0.3, 'craters require varying relief');
  for (const v of [0, 1]) {
    const a = sphereDirection(0.1, v, {}),
      b = sphereDirection(0.8, v, {});
    close(galaxyDensity(a.x, a.y, a.z), galaxyDensity(b.x, b.y, b.z));
  }
});

test('one scene owns exactly the declared nine maps with correct color spaces and packed data sharing', () => {
  const w = createEarth(),
    r = collect(w),
    maps = [...r.textures];
  assert.equal(maps.length, 9);
  assert.deepEqual(
    maps.map((t) => t.name).sort(),
    [
      'space-density',
      'earth-albedo',
      'earth-height-roughness',
      'earth-clouds',
      'moon-albedo',
      'moon-height',
      'sun-granules',
      'gas-bands',
      'ring-bands',
    ].sort(),
  );
  let estimate = 0;
  for (const texture of maps) {
    assert.ok(texture.image.width <= 2048 && texture.image.height <= 1024);
    assert.equal(
      texture.colorSpace,
      ['earth-height-roughness', 'moon-height'].includes(texture.name)
        ? THREE.NoColorSpace
        : THREE.SRGBColorSpace,
    );
    estimate += (texture.image.width * texture.image.height * 4 * 4) / 3;
    assert.equal(texture.generateMipmaps, true);
  }
  close(estimate / 1024 / 1024, 9 + 2 / 3);
  assert.equal(w.globe.material.bumpMap, w.globe.material.roughnessMap);
  assert.notEqual(w.clouds.material.map, w.globe.material.map);
  assert.equal(w.clouds.parent, w.avatar);
  assert.equal(w.globe.parent, w.avatar);
  close(w.globe.geometry.parameters.radius, 23);
  close(w.clouds.geometry.parameters.radius, 23.35);
  close(w.atmosphere.geometry.parameters.radius, 24.1);
  close(w.clouds.rotation.z, w.globe.rotation.z);
  assert.equal(w.clouds.material.depthWrite, false);
  assert.equal(w.moon.geometry.type, 'SphereGeometry');
  close(w.moon.geometry.parameters.radius, 9);
  assert.equal(w.moon.material.metalness, 0);
  assert.equal(w.moon.material.roughness, 1);
  assert.deepEqual(w.moon.material.emissive.toArray(), [0, 0, 0]);
  assert.ok(Number.isFinite(w.earthVisuals.generationMs));
});

test('single sky replaces both old backgrounds, has controlled screen-space stars and pipeline-compatible shaders', () => {
  const w = createEarth();
  const points = [];
  w.scene.traverse((o) => {
    if (o.isPoints) points.push(o);
  });
  assert.equal(points.length, 1);
  const stars = points[0];
  assert.equal(stars.parent, w.sky);
  assert.equal(w.sky.parent, w.scene);
  assert.equal(w.sky.children.length, 2);
  assert.equal(stars.geometry.attributes.position.count, 4200);
  const sizes = [...stars.geometry.attributes.size.array];
  assert.ok(sizes.filter((s) => s < 1.3).length > 3300);
  assert.ok(sizes.filter((s) => s >= 2.4).length > 20);
  const positions = stars.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++)
    close(
      Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i)),
      1600,
      0.001,
    );
  const dome = w.sky.children.find((o) => o.name === 'galactic-dome');
  assert.equal(dome.geometry.parameters.radius, 2000);
  assert.equal(dome.material.side, THREE.BackSide);
  assert.equal(dome.material.depthWrite, false);
  assert.equal(stars.material.depthWrite, false);
  assert.equal(stars.material.depthTest, true);
  assert.ok(dome.renderOrder < stars.renderOrder);
  stars.onBeforeRender({ getPixelRatio: () => 1.6 });
  close(stars.material.uniforms.pixelRatio.value, 1.6);
  assert.match(stars.material.fragmentShader, /gl_PointCoord/);
  for (const material of [
    stars.material,
    w.atmosphere.material,
    w.sunHalo.material,
  ]) {
    assert.match(material.fragmentShader, /#include <tonemapping_fragment>/);
    assert.match(material.fragmentShader, /#include <colorspace_fragment>/);
  }
  assert.ok(
    galaxyDensity(-0.2, -0.13, -0.97) > 0.05,
    'default viewing direction must meet the band',
  );
  // Explicit P1-off construction still yields a complete P0 sky.
  const p0 = withCanvas(() => createEarthBackground({ decorations: false }));
  assert.equal(p0.children.length, 2);
  assert.equal(p0.children[1].geometry.attributes.position.count, 4200);
});

test('P1 rocks use a single batch and clear the player/Moon envelope and both fixed bodies by full radius', () => {
  const w = createEarth(),
    rocks = w.spaceRocks,
    matrix = new THREE.Matrix4(),
    position = new THREE.Vector3(),
    rotation = new THREE.Quaternion(),
    scale = new THREE.Vector3();
  assert.equal(rocks.isInstancedMesh, true);
  assert.equal(rocks.count, 32);
  assert.equal(rocks.parent, w.scene);
  assert.notEqual(rocks.parent, w.sky);
  assert.equal(w.talkers.length, 3);
  assert.equal(w.recruitables.length, 0);
  const pRadius = 103;
  for (let i = 0; i < rocks.count; i++) {
    rocks.getMatrixAt(i, matrix);
    matrix.decompose(position, rotation, scale);
    const radius = Math.max(scale.x, scale.y, scale.z);
    assert.ok(Math.hypot(position.x, position.z) - radius > 320);
    assert.ok(Math.hypot(position.x, position.z) + radius < 650);
    assert.ok(Math.hypot(position.x, position.z) - radius > 200 + 48 + 9);
    assert.ok(position.distanceTo(w.sunBody.position) > radius + 24 * 1.08);
    assert.ok(position.distanceTo(w.ringedPlanet.position) > radius + pRadius);
  }
});

test('ring uses radial UV/color alpha without stale vertex stripes, and keeps V3 ownership', () => {
  const w = createEarth(),
    ring = w.ringedPlanetRing,
    geometry = ring.geometry;
  assert.equal(geometry.attributes.color, undefined);
  assert.equal(ring.material.vertexColors, false);
  assert.equal(ring.material.side, THREE.DoubleSide);
  assert.equal(ring.material.depthWrite, false);
  assert.equal(ring.material.depthTest, true);
  const uv = geometry.attributes.uv,
    p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    close(
      uv.getX(i),
      (Math.hypot(p.getX(i), p.getY(i)) - 66) / (103 - 66),
      1e-6,
    );
    close(uv.getY(i), 0.5);
  }
  assert.equal(w.ringedPlanet.children.length, 2);
  assert.equal(w.sunBody.children.length, 2);
  const material = ring.material,
    map = material.map;
  w.position.set(-60, 0, -170);
  const c = { ...running, stepId: 1, movementLimit: 200 };
  w.earthActions.ringedPlanet.onPrimaryAction(c);
  w.earthActions.ringedPlanet.setEnabled(false);
  close(material.opacity, 0.8);
  w.earthActions.ringedPlanet.setEnabled(true);
  assert.equal(ring.material, material);
  assert.equal(ring.material.map, map);
});

test('visual update runs once after original handlers and is frozen by pause, reduced motion and invalid delta', () => {
  const w = createEarth(),
    spin = createEarthVisualUpdate(w),
    calls = [];
  const handler = (name) => ({
    getPrimaryAction: () => null,
    onPrimaryAction: () => null,
    update: () => calls.push(name),
  });
  const local = {};
  installEarthActions(local, handler('moon'), handler('sun'), handler('ring'), {
    visualUpdate: (c) => {
      calls.push('visual');
      spin(c);
    },
  });
  local.update(running);
  assert.deepEqual(calls, ['ring', 'moon', 'sun', 'visual']);
  close(w.globe.rotation.y, 0.018 * 0.05);
  close(w.clouds.rotation.y, 0.02 * 0.05);
  for (const c of [
    { ...running, canSimulate: false },
    { ...running, reducedMotion: true },
    ...[0, -1, NaN, Infinity].map((dt) => ({ ...running, dt })),
  ]) {
    const before = [w.globe.rotation.y, w.clouds.rotation.y];
    spin(c);
    assert.deepEqual([w.globe.rotation.y, w.clouds.rotation.y], before);
  }
  spin({ ...running, dt: 999 });
  close(w.globe.rotation.y, 0.018 * 0.1);
  close(w.clouds.rotation.y, 0.02 * 0.1);
  const position = w.position.clone(),
    atmosphere = w.atmosphere.material.uniforms.color.value.clone(),
    opacity = w.ringedPlanetRing.material.opacity;
  for (let i = 0; i < 3600; i++) spin(running);
  assert.deepEqual(w.position, position);
  assert.deepEqual(w.atmosphere.material.uniforms.color.value, atmosphere);
  close(w.ringedPlanetRing.material.opacity, opacity);
});

test('new baselines and all GPU resource references survive 100 actions and repeated cached-world updates', () => {
  const w = createEarth(),
    baseline = collect(w),
    atmosphere = w.atmosphere.material.uniforms.color.value,
    halo = w.sunHalo;
  const baseColor = atmosphere.clone(),
    haloMaterial = halo.material,
    haloScale = halo.scale.clone();
  w.position.set(80, 0, -65);
  w.onPrimaryAction(running);
  const moon = w.moon,
    moonMap = moon.material.map;
  w.position.set(-110, 0, -100);
  for (let i = 0; i < 100; i++) {
    assert.ok(w.earthActions.sun.onPrimaryAction(running));
    for (let frame = 0; frame < 160; frame++) w.update(running);
    assert.deepEqual(atmosphere, baseColor);
    assert.deepEqual(halo.scale, haloScale);
  }
  w.earthActions.sun.setEnabled(false);
  w.earthActions.sun.setEnabled(true);
  assert.equal(w.atmosphere.material.uniforms.color.value, atmosphere);
  assert.equal(halo.material, haloMaterial);
  assert.equal(w.moon, moon);
  assert.equal(moon.material.map, moonMap);
  assert.equal(w.earthState.moon.status, 'orbiting');
  assert.deepEqual(collect(w), baseline);
});

test('main preserves camera renderer and movement, with exactly one world update and no duplicate Earth spin', async () => {
  const source = await readFile(
    new URL('../../src/main.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /globe\.rotation\.y\s*\+=/);
  assert.equal(
    (source.match(/w\.update\?\.\(actionContext\)/g) || []).length,
    1,
  );
  assert.equal(
    (source.match(/requestAnimationFrame\(animate\)/g) || []).length,
    1,
  );
  assert.match(source, /w\.sky\.position\.copy\(camera\.position\)/);
  assert.match(source, /renderer\.toneMappingExposure = 1\.05/);
});
