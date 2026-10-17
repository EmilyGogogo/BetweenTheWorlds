import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../vendor/three.module.js';
import { sunProximity, sunSettings } from '../../src/worlds/earth-sun.js';
import { createEarth } from '../helpers/earth-fixture.mjs';

const running = {
  dt: 0.05,
  canInteract: true,
  canSimulate: true,
  reducedMotion: false,
};
function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
}
function atDistance(world, distance) {
  world.position.copy(world.sunBody.position);
  world.position.z += distance;
}
function tick(world, seconds, context = running) {
  for (let remaining = seconds; remaining > 1e-9; remaining -= context.dt) {
    world.update({ ...context, dt: Math.min(remaining, context.dt) });
  }
}
function start(world, context = running) {
  atDistance(world, 80);
  assert.equal(
    world.earthActions.sun.onPrimaryAction(context),
    '光沿着你的边缘，慢慢展开。',
  );
}
function visualSnapshot(world) {
  return {
    intensity: world.sun.intensity,
    position: world.sun.position.toArray(),
    target: world.sun.target.position.toArray(),
    color: world.atmosphere.material.uniforms.color.value.toArray(),
    scale: world.sunHalo.scale.toArray(),
    state: { ...world.earthState.sun },
  };
}

test('Sun geometry is reachable in the real movement disk and clears Earth/Moon', () => {
  const world = createEarth();
  assert.deepEqual(world.sunBody.position.toArray(), [-110, 65, -100]);
  assert.equal(world.sunBody.children.length, 2);
  assert.equal(world.sunBody.children[0].geometry.parameters.radius, 18);
  assert.equal(world.sunBody.children[0].material.isMeshBasicMaterial, true);
  assert.equal(world.sunHalo.geometry.parameters.radius, 24);
  world.position.set(-110, 0, -100);
  assert.ok(Math.hypot(world.position.x, world.position.z) < 200);
  close(world.position.distanceTo(world.sunBody.position), 65);
  assert.ok(world.earthActions.sun.getPrimaryAction(running));
  assert.equal(sunProximity(65), 1);
  assert.ok(65 > 24.1 + 18);
  assert.ok(60 > 9 + 18);
  assert.ok(65 > 24.1 + 24 * 1.08);
  assert.ok(60 > 9 + 24 * 1.08);
  const lights = [];
  world.scene.traverse((object) => {
    if (object.isLight) lights.push(object);
  });
  assert.equal(lights.filter((light) => light.isDirectionalLight).length, 1);
  assert.equal(lights.find((light) => light.isAmbientLight).intensity, 1.1);
});

test('proximity is finite, bounded, monotone and uses both smoothstep boundaries', () => {
  assert.equal(sunProximity(79.999), 1);
  assert.equal(sunProximity(80), 1);
  assert.ok(sunProximity(80.001) < 1);
  close(sunProximity(115), 0.5);
  assert.ok(sunProximity(149.999) > 0);
  assert.equal(sunProximity(150), 0);
  assert.equal(sunProximity(150.001), 0);
  let previous = 1;
  for (let distance = 0; distance < 300; distance += 0.25) {
    const strength = sunProximity(distance);
    assert.ok(strength >= 0 && strength <= 1 && strength <= previous);
    previous = strength;
  }
  for (const invalid of [NaN, Infinity, -Infinity, -1])
    assert.equal(sunProximity(invalid), 0);
});

test('action uses inclusive 3D range, not X/Z, and rechecks live state after a prompt', () => {
  const world = createEarth();
  const sun = world.earthActions.sun;
  for (const [distance, allowed] of [
    [99.999, true],
    [100, true],
    [100.001, false],
  ]) {
    atDistance(world, distance);
    assert.equal(Boolean(sun.getPrimaryAction(running)), allowed);
  }
  world.position.copy(world.sunBody.position);
  world.position.y -= 100.001;
  assert.equal(sun.getPrimaryAction(running), null);
  atDistance(world, 99.999);
  const before = visualSnapshot(world);
  assert.ok(sun.getPrimaryAction(running));
  assert.ok(sun.getPrimaryAction(running));
  assert.deepEqual(visualSnapshot(world), before);
  atDistance(world, 101);
  assert.equal(sun.onPrimaryAction(running), null);
  assert.equal(world.earthState.sun.status, 'ready');
  atDistance(world, 80);
  assert.equal(sun.onPrimaryAction({ ...running, canInteract: false }), null);
  assert.equal(world.earthState.moon.status, 'available');
  assert.ok(sun.onPrimaryAction(running));
});

test('distance lighting has dt-independent easing, bounded intensity and no cumulative boost', () => {
  const values = [];
  for (const dt of [0.01, 0.025, 0.05]) {
    const world = createEarth();
    atDistance(world, 80);
    tick(world, 2, { ...running, dt });
    values.push(world.sun.intensity);
    close(world.sun.intensity, 4.75 - 0.95 * Math.exp(-8));
  }
  close(values[0], values[1]);
  close(values[1], values[2]);
  const world = createEarth();
  atDistance(world, 80);
  for (let i = 0; i < 5000; i++) {
    world.update(running);
    assert.ok(world.sun.intensity >= 3.8 && world.sun.intensity <= 4.75);
  }
  close(world.sun.intensity, 4.75);
  atDistance(world, 151);
  tick(world, 10);
  close(world.sun.intensity, 3.8);
  assert.notDeepEqual(world.sun.position.toArray(), [-200, 100, 160]);
  assert.equal(world.sun.target.parent, world.scene);
});

test('light matrices use current Sun and player centers before the avatar/camera sync', () => {
  const world = createEarth();
  const light = world.sun;
  const target = light.target;
  assert.equal(target.parent, world.scene);
  assert.deepEqual(
    new THREE.Vector3().setFromMatrixPosition(light.matrixWorld).toArray(),
    sunSettings.position,
  );
  for (const position of [
    [-110, 0, -100],
    [-40, 0, -50],
    [120, 0, 160],
  ]) {
    world.position.set(...position);
    world.update(running);
    // Read cached matrices directly: getWorldPosition would itself update them
    // and could hide a missing target.updateWorldMatrix in the implementation.
    const targetWorld = new THREE.Vector3().setFromMatrixPosition(
      target.matrixWorld,
    );
    const lightWorld = new THREE.Vector3().setFromMatrixPosition(
      light.matrixWorld,
    );
    assert.deepEqual(targetWorld.toArray(), position);
    assert.deepEqual(lightWorld.toArray(), sunSettings.position);
    close(
      lightWorld
        .clone()
        .sub(targetWorld)
        .normalize()
        .dot(world.sunBody.position.clone().sub(world.position).normalize()),
      1,
    );
    assert.deepEqual(world.avatar.position.toArray(), [0, 0, 0]);
    assert.equal(world.sun, light);
    assert.equal(world.sun.target, target);
  }
});

test('one response and feedback, then exactly three seconds plus five seconds cooldown', () => {
  const world = createEarth();
  const sun = world.earthActions.sun;
  start(world);
  const state = world.earthState.sun;
  for (let i = 0; i < 20; i++) assert.equal(sun.onPrimaryAction(running), null);
  assert.equal(state.remaining, 3);
  tick(world, 2.95);
  assert.equal(state.status, 'responding');
  close(state.remaining, 0.05);
  world.update(running);
  assert.equal(state.status, 'cooldown');
  close(state.remaining, 5);
  assert.equal(sun.getPrimaryAction(running), null);
  tick(world, 4.95);
  assert.equal(state.status, 'cooldown');
  world.update(running);
  assert.equal(state.status, 'ready');
  assert.equal(state.remaining, 0);
  assert.ok(sun.onPrimaryAction(running));
});

test('timer transitions retain leftover dt and cap excessive dt without catch-up', () => {
  const world = createEarth();
  start(world);
  tick(world, 2.98);
  world.update(running);
  assert.equal(world.earthState.sun.status, 'cooldown');
  close(world.earthState.sun.remaining, 4.97);
  tick(world, 4.95);
  world.update(running);
  assert.equal(world.earthState.sun.status, 'ready');
  world.earthActions.sun.onPrimaryAction(running);
  world.update({ ...running, dt: 100 });
  assert.equal(world.earthState.sun.status, 'responding');
  close(world.earthState.sun.remaining, 2.95);
});

test('response envelope resets original color/scale and restores the current distance target', () => {
  const world = createEarth();
  const color = world.atmosphere.material.uniforms.color.value;
  const baseColor = color.clone();
  const haloScale = world.sunHalo.scale;
  start(world);
  assert.deepEqual(color, baseColor);
  assert.deepEqual(haloScale.toArray(), [1, 1, 1]);
  tick(world, 1.5);
  for (const component of ['r', 'g', 'b'])
    close(color[component], new THREE.Color('#efc58b')[component]);
  close(haloScale.x, 1.08);
  atDistance(world, 115);
  tick(world, 1.5);
  assert.equal(world.earthState.sun.status, 'cooldown');
  assert.deepEqual(color, baseColor);
  assert.deepEqual(haloScale.toArray(), [1, 1, 1]);
  tick(world, 10);
  close(world.sun.intensity, 3.8 * 1.125);
  assert.equal(world.atmosphere.material.uniforms.color.value, color);
  assert.equal(world.sunHalo.scale, haloScale);
  assert.equal(world.atmosphere.material.uniforms.opacity.value, 0.65);
});

test('crossing only action range completes, crossing outer range cancels with a full cooldown', () => {
  for (const distance of [100.001, 150, 150.001]) {
    const world = createEarth();
    const baseColor = world.atmosphere.material.uniforms.color.value.clone();
    start(world);
    tick(world, 1);
    atDistance(world, distance);
    world.update(running);
    if (distance <= 150) {
      assert.equal(world.earthState.sun.status, 'responding');
      tick(world, 1.95);
    } else {
      assert.equal(world.earthState.sun.status, 'cooldown');
      assert.equal(world.earthState.sun.remaining, 5);
    }
    assert.equal(world.earthState.sun.status, 'cooldown');
    assert.deepEqual(world.atmosphere.material.uniforms.color.value, baseColor);
    atDistance(world, 80);
    assert.equal(world.earthActions.sun.onPrimaryAction(running), null);
    tick(world, 5);
    assert.ok(world.earthActions.sun.getPrimaryAction(running));
  }
});

test('invalid dt and pause freeze response/cooldown, light interpolation and envelope', () => {
  const world = createEarth();
  start(world);
  tick(world, 0.5);
  for (const stage of ['responding', 'cooldown']) {
    assert.equal(world.earthState.sun.status, stage);
    const snapshot = visualSnapshot(world);
    for (const dt of [0, -1, NaN, Infinity, -Infinity]) {
      world.update({ ...running, dt });
      assert.deepEqual(visualSnapshot(world), snapshot);
    }
    for (let i = 0; i < 200; i++)
      world.update({ ...running, canSimulate: false });
    assert.deepEqual(visualSnapshot(world), snapshot);
    world.update(running);
    close(world.earthState.sun.remaining, snapshot.state.remaining - 0.05);
    if (stage === 'responding') tick(world, world.earthState.sun.remaining);
  }
});

test('disabling in each state restores V1 target/lighting and preserves original talkers and state', () => {
  for (const stage of ['ready', 'responding', 'cooldown']) {
    const world = createEarth();
    const controls = world.earthActions.sun;
    const [planet, moon, talker] = world.talkers;
    const stateContainer = world.earthState;
    const moonState = world.earthState.moon;
    const body = world.sunBody;
    const target = world.sun.target;
    const color = world.atmosphere.material.uniforms.color.value;
    const baseColor = color.clone();
    if (stage !== 'ready') start(world);
    if (stage === 'responding') tick(world, 1.5);
    if (stage === 'cooldown') tick(world, 3);
    assert.equal(world.earthState.sun.status, stage);
    controls.setEnabled(false);
    assert.equal(world.sunBody, body);
    assert.equal(body.visible, false);
    assert.equal(world.earthState.sun.enabled, false);
    assert.equal(world.earthState.sun.status, 'ready');
    assert.equal(world.earthState.sun.remaining, 0);
    assert.equal(controls.getPrimaryAction(running), null);
    assert.equal(controls.onPrimaryAction(running), null);
    assert.deepEqual(world.talkers, [planet, moon]);
    assert.deepEqual(world.sun.position.toArray(), [-200, 100, 160]);
    assert.equal(world.sun.intensity, 3.8);
    assert.equal(world.sun.target, target);
    assert.equal(target.parent, null);
    assert.deepEqual(
      new THREE.Vector3().setFromMatrixPosition(target.matrixWorld).toArray(),
      [0, 0, 0],
    );
    assert.deepEqual(color, baseColor);
    assert.deepEqual(world.sunHalo.scale.toArray(), [1, 1, 1]);
    assert.equal(world.earthState, stateContainer);
    assert.equal(world.earthState.moon, moonState);
    controls.setEnabled(true);
    controls.setEnabled(true);
    assert.equal(world.sunBody, body);
    assert.equal(body.visible, true);
    assert.equal(target.parent, world.scene);
    assert.deepEqual(world.talkers, [planet, moon, talker]);
  }
});

test('unexpected Sun removal/hidden/reference mismatch cleans up even while paused, without query mutation', () => {
  for (const change of [
    (w) => w.scene.remove(w.sunBody),
    (w) => {
      w.sunBody.visible = false;
    },
    (w) => {
      w.sunBody = null;
    },
  ]) {
    const world = createEarth();
    const controls = world.earthActions.sun;
    const original = world.sunBody;
    start(world);
    tick(world, 1.5);
    change(world);
    const parentAfterChange = original.parent;
    const state = { ...world.earthState.sun };
    assert.equal(controls.getPrimaryAction(running), null);
    assert.equal(controls.onPrimaryAction(running), null);
    assert.deepEqual(world.earthState.sun, state);
    world.update({ ...running, canSimulate: false });
    assert.equal(world.earthState.sun.enabled, false);
    assert.equal(world.earthState.sun.remaining, 0);
    assert.equal(world.sun.intensity, 3.8);
    assert.equal(world.talkers.length, 2);
    assert.equal(original.parent, parentAfterChange);
    controls.setEnabled(true);
    assert.equal(world.sunBody, original);
    assert.equal(original.parent, world.scene);
    assert.equal(world.talkers.length, 3);
  }
});

test('100 response cycles and 10 enable cycles retain the exact scene/resource sets', () => {
  const world = createEarth();
  const originalTalkers = [...world.talkers];
  const resources = () => {
    const result = {
      objects: new Set(),
      geometries: new Set(),
      materials: new Set(),
      textures: new Set(),
    };
    world.scene.traverse((object) => {
      result.objects.add(object);
      if (object.geometry) result.geometries.add(object.geometry);
      if (object.material) {
        result.materials.add(object.material);
        if (object.material.map) result.textures.add(object.material.map);
      }
    });
    return result;
  };
  const initial = resources();
  const color = world.atmosphere.material.uniforms.color.value;
  const baseColor = color.clone();
  for (let cycle = 0; cycle < 100; cycle++) {
    start(world);
    tick(world, 8);
    assert.equal(world.earthState.sun.status, 'ready');
    assert.deepEqual(color, baseColor);
    assert.deepEqual(world.sunHalo.scale.toArray(), [1, 1, 1]);
    if (cycle < 10) {
      world.earthActions.sun.setEnabled(false);
      world.earthActions.sun.setEnabled(true);
    }
    assert.deepEqual(resources(), initial);
    assert.deepEqual(world.talkers, originalTalkers);
    assert.equal(world.sun.target.parent, world.scene);
  }
  world.earthActions.sun.setEnabled(false);
  assert.equal(world.sun.intensity, 3.8);
  assert.deepEqual(world.sun.position.toArray(), [-200, 100, 160]);
  const fresh = createEarth();
  assert.notEqual(fresh.sunBody, world.sunBody);
  assert.equal(fresh.earthState.sun.status, 'ready');
  assert.equal(fresh.earthState.sun.remaining, 0);
  assert.equal(fresh.earthState.moon.status, 'available');
});
