import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../vendor/three.module.js';
import { attachMoonCompanion } from '../../src/worlds/earth-moon.js';
import { createWorldFactory } from '../../src/worlds/index.js';
import { withCanvas } from '../helpers/earth-fixture.mjs';
import {
  updateActionContext,
  performPrimaryAction,
} from '../../src/core/world-actions.js';

const running = {
  canInteract: true,
  canSimulate: true,
  reducedMotion: false,
  dt: 0.05,
};
const epsilon = 1e-6;

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
}

function fixture() {
  const world = { scene: new THREE.Scene(), position: new THREE.Vector3() };
  const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 0));
  world.scene.add(moon);
  moon.position.set(40, 5, -30);
  attachMoonCompanion(world, moon);
  return world;
}

function offset(world) {
  return world.moon.position.clone().sub(world.position);
}

test('available Moon stays independent and prompt queries have no side effects', () => {
  const world = fixture();
  const original = world.moon.position.clone();
  const action = world.getPrimaryAction(running);
  for (let i = 0; i < 20; i++) {
    world.update(running);
    assert.equal(world.getPrimaryAction(running), action);
  }
  assert.equal(world.earthState.moon.status, 'available');
  assert.equal(world.earthState.moon.phase, 0);
  assert.deepEqual(world.moon.position, original);
});

test('invitation uses the inclusive 3D distance boundary, not just X/Z', () => {
  for (const [distance, allowed] of [
    [74.999, true],
    [75, true],
    [75.001, false],
  ]) {
    for (const vector of [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
    ]) {
      const world = fixture();
      world.moon.position.copy(vector.multiplyScalar(distance));
      assert.equal(Boolean(world.getPrimaryAction(running)), allowed);
      assert.equal(Boolean(world.onPrimaryAction(running)), allowed);
    }
  }
  const world = fixture();
  world.moon.position.set(60, 46, 0);
  assert.equal(world.getPrimaryAction(running), null);
});

test('a displayed action does not authorize stale, blocked, or disabled input', () => {
  const world = fixture();
  const original = world.moon.position.clone();
  assert.ok(world.getPrimaryAction(running));
  world.position.x = -200;
  assert.equal(world.onPrimaryAction(running), null);
  world.position.x = 0;
  assert.equal(world.onPrimaryAction({ ...running, canInteract: false }), null);
  world.earthState.moon.invitable = false;
  assert.equal(world.getPrimaryAction(running), null);
  assert.equal(world.onPrimaryAction(running), null);
  assert.equal(world.earthState.moon.status, 'available');
  assert.deepEqual(world.moon.position, original);
});

test('absent, removed, or replaced Moon produces no action and no new objects', () => {
  for (const mutation of [
    (w) => {
      w.moon = null;
    },
    (w) => {
      w.scene.remove(w.moon);
    },
    (w) => {
      w.moon = new THREE.Object3D();
    },
  ]) {
    const world = fixture();
    mutation(world);
    const children = [...world.scene.children];
    assert.equal(world.getPrimaryAction(running), null);
    assert.equal(world.onPrimaryAction(running), null);
    world.update(running);
    assert.deepEqual(world.scene.children, children);
  }
  const world = { scene: new THREE.Scene(), position: new THREE.Vector3() };
  attachMoonCompanion(world, null);
  assert.equal(world.onPrimaryAction(running), null);
  world.update(running);
  assert.equal(world.scene.children.length, 0);
});

test('invite once: keeps the original mesh, clears action and never resets phase', () => {
  const world = fixture();
  const moon = world.moon;
  assert.equal(world.onPrimaryAction(running), '月亮，与你同行。');
  assert.equal(world.earthState.moon.status, 'orbiting');
  assert.equal(world.getPrimaryAction(running), null);
  world.update(running);
  const phase = world.earthState.moon.phase;
  for (let i = 0; i < 20; i++) {
    assert.equal(world.onPrimaryAction(running), null);
    assert.equal(world.earthState.moon.phase, phase);
  }
  assert.equal(world.moon, moon);
  assert.equal(moon.parent, world.scene);
  assert.equal(world.scene.children.length, 1);
});

test('initial orbit preserves horizontal bearing in every quadrant', () => {
  for (const [x, z] of [
    [20, 20],
    [-20, 20],
    [-20, -20],
    [20, -20],
  ]) {
    const world = fixture();
    world.moon.position.set(x, 5, z);
    world.onPrimaryAction(running);
    const delta = offset(world);
    close(delta.x / delta.z, x / z);
    assert.equal(Math.sign(delta.x), Math.sign(x));
    assert.equal(Math.sign(delta.z), Math.sign(z));
  }
});

test('zero horizontal bearing explicitly chooses +X, including signed zeros', () => {
  // Verifies the application's chosen direction branch, not atan2's JS spec.
  for (const x of [0, -0])
    for (const z of [0, -0])
      for (const y of [0, 5]) {
        const world = fixture();
        world.moon.position.set(x, y, z);
        world.onPrimaryAction(running);
        assert.equal(world.earthState.moon.phase, 0);
        assert.deepEqual(offset(world).toArray(), [48, 5, 0]);
      }
});

test('one hour of orbit stays finite and clear of atmosphere, with dt accumulation', () => {
  const world = fixture();
  world.onPrimaryAction(running);
  const initial = world.earthState.moon.phase;
  for (let i = 0; i < 72_000; i++) {
    world.update(running);
    const delta = offset(world);
    close(Math.hypot(delta.x, delta.z), 48);
    close(delta.y, 5);
    // Full 3D center distance includes the 5-unit height, not just radius 48.
    close(delta.length(), Math.hypot(48, 5));
    assert.ok(delta.length() - (24.1 + 9) > 15);
  }
  const expected = initial + 0.18 * 3600;
  close(Math.sin(world.earthState.moon.phase), Math.sin(expected));
  close(Math.cos(world.earthState.moon.phase), Math.cos(expected));
});

test('orbit follows latest player center even while avatar is stale or at boundary', () => {
  const world = fixture();
  world.avatar = new THREE.Object3D();
  world.onPrimaryAction(running);
  for (const position of [
    [38, 0, 0],
    [38, 0, -38],
    [120, 0, 160],
    [200, 0, 0],
  ]) {
    world.position.set(...position);
    world.update(running);
    close(offset(world).length(), Math.hypot(48, 5));
    close(offset(world).y, 5);
    assert.deepEqual(world.avatar.position.toArray(), [0, 0, 0]);
  }
});

test('pause freezes state/position and resume advances only supplied active dt', () => {
  const world = fixture();
  world.onPrimaryAction(running);
  const phase = world.earthState.moon.phase;
  const position = world.moon.position.clone();
  for (let i = 0; i < 200; i++) {
    world.update({ ...running, canSimulate: false });
  }
  assert.equal(world.earthState.moon.phase, phase);
  assert.deepEqual(world.moon.position, position);
  world.update(running);
  close(world.earthState.moon.phase, phase + 0.009);
  const current = world.earthState.moon.phase;
  for (const dt of [0, -1, NaN, Infinity]) world.update({ ...running, dt });
  assert.equal(world.earthState.moon.phase, current);
});

test('reduced motion composes with actual repositioning on both axes and diagonally', () => {
  const world = fixture();
  world.onPrimaryAction(running);
  const phase = world.earthState.moon.phase;
  const initialOffset = offset(world);
  const before = world.moon.position.clone();
  const reduced = { ...running, reducedMotion: true };
  for (const position of [
    [38, 0, 0],
    [38, 0, -38],
    [-20, 0, -50],
  ]) {
    world.position.set(...position);
    world.update(reduced);
    assert.notDeepEqual(world.position.toArray(), [0, 0, 0]);
    assert.equal(world.earthState.moon.phase, phase);
    const delta = offset(world);
    for (const axis of ['x', 'y', 'z']) close(delta[axis], initialOffset[axis]);
    assert.notDeepEqual(world.moon.position, before);
  }
  for (let i = 0; i < 200; i++) world.update(reduced);
  assert.equal(world.earthState.moon.phase, phase);
});

test('actual Earth factory preserves both talkers and resources through invite/update', () => {
  withCanvas(() => {
    const factory = createWorldFactory({
      capabilities: { getMaxAnisotropy: () => 8 },
    });
    const world = factory.builders[3]();
    assert.equal(world.earthState.moon.status, 'available');
    assert.deepEqual(world.moon.position.toArray(), [80, 5, -65]);
    assert.equal(world.talkers.length, 3);
    assert.equal(world.talkers[2].name, '太阳');
    assert.equal(world.talkers[2].object, world.sunBody);
    const [planetTalker, moonTalker] = world.talkers;
    assert.equal(planetTalker.name, '有环的星球');
    assert.equal(planetTalker.range, 290);
    assert.deepEqual(planetTalker.object.position.toArray(), [170, 40, -200]);
    assert.equal(moonTalker.name, '月亮');
    assert.equal(moonTalker.range, 75);
    assert.equal(world.globe.geometry.parameters.radius, 23);
    const objects = new Set();
    const geometries = new Set();
    const materials = new Set();
    world.scene.traverse((object) => {
      objects.add(object);
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    const originalMoon = moonTalker.object;
    assert.equal(originalMoon.geometry.parameters.radius, 9);
    const lines = world.talkers.map((talker) => talker.lines);
    assert.equal(originalMoon, world.moon);
    assert.equal(planetTalker.object.children.length, 2);
    world.position.set(50, 0, -40);
    const context = { reducedMotion: false };
    let grassCalls = 0;
    const input = {
      active: 3,
      world,
      context,
      repeat: false,
      recruit: () => grassCalls++,
    };
    for (const flags of [
      [false, false, false],
      [true, false, true],
      [true, true, false],
    ]) {
      updateActionContext(context, ...flags, 0.05);
      assert.equal(performPrimaryAction(input), null);
      assert.equal(world.earthState.moon.status, 'available');
    }
    updateActionContext(context, true, false, false, 0.05);
    assert.equal(performPrimaryAction({ ...input, repeat: true }), null);
    assert.equal(performPrimaryAction(input), '月亮，与你同行。');
    assert.equal(performPrimaryAction(input), null);
    assert.equal(grassCalls, 0);
    for (let i = 0; i < 10; i++) {
      for (let frame = 0; frame < 200; frame++) world.update(running);
      // Model inactive interval without calling the world's update, as main does.
      const saved = world.earthState.moon.phase;
      assert.equal(world.onPrimaryAction(running), null);
      assert.equal(world.earthState.moon.phase, saved);
    }
    const point = new THREE.Vector3();
    for (const [index, talker] of world.talkers.entries()) {
      assert.equal(talker.lines, lines[index]);
      talker.object.getWorldPosition(point);
      assert.ok(Number.isFinite(point.length()));
    }
    originalMoon.getWorldPosition(point);
    close(point.distanceTo(world.position), Math.hypot(48, 5));
    assert.equal(world.moon, originalMoon);
    world.scene.traverse((object) => {
      assert.ok(objects.delete(object));
      if (object.geometry) assert.ok(geometries.has(object.geometry));
      if (object.material) assert.ok(materials.has(object.material));
    });
    assert.equal(objects.size, 0);
    assert.equal(world.followers.length, 0);
    assert.equal(world.recruitables.length, 0);
    const fresh = createWorldFactory({
      capabilities: { getMaxAnisotropy: () => 8 },
    }).builders[3]();
    assert.notEqual(fresh.moon, originalMoon);
    assert.equal(fresh.earthState.moon.status, 'available');
    assert.deepEqual(fresh.moon.position.toArray(), [80, 5, -65]);
    assert.deepEqual(fresh.position.toArray(), [0, 0, 0]);
  });
});
