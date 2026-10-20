import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../vendor/three.module.js';
import { installEarthActions } from '../../src/worlds/earth-actions.js';
import { createMoonCompanion } from '../../src/worlds/earth-moon.js';
import { sunProximity } from '../../src/worlds/earth-sun.js';
import {
  performPrimaryAction,
  updateActionContext,
} from '../../src/core/world-actions.js';
import { createEarth } from '../helpers/earth-fixture.mjs';

const running = {
  dt: 0.05,
  canInteract: true,
  canSimulate: true,
  reducedMotion: false,
};
function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
}

test('Moon handler extraction preserves preexisting container, Moon state and compatibility fields', () => {
  const state = { status: 'orbiting', phase: 0.8, invitable: true };
  const container = { moon: state, sun: { status: 'ready' } };
  const world = {
    scene: new THREE.Scene(),
    position: new THREE.Vector3(),
    earthState: container,
  };
  const moon = new THREE.Object3D();
  world.scene.add(moon);
  const controls = createMoonCompanion(world, moon);
  assert.equal(world.earthState, container);
  assert.equal(world.earthState.moon, state);
  assert.equal(world.earthState.sun, container.sun);
  assert.equal(world.getPrimaryAction, undefined);
  controls.update(running);
  close(state.phase, 0.809);
  assert.equal(world.moon, moon);
});

test('Earth arbitration is deterministic, reselects live eligibility, and updates each handler once', () => {
  const world = { earthState: {} };
  const container = world.earthState;
  let moonEligible = true;
  let sunEligible = true;
  const calls = [];
  const moon = {
    getPrimaryAction: () => (moonEligible ? { label: 'moon' } : null),
    onPrimaryAction: () => {
      calls.push('moon-action');
      moonEligible = false;
      return 'moon-joined';
    },
    update: (context) => calls.push(['moon-update', context]),
  };
  const sun = {
    getPrimaryAction: () => (sunEligible ? { label: 'sun' } : null),
    onPrimaryAction: () => {
      calls.push('sun-action');
      sunEligible = false;
      return 'sun-response';
    },
    update: (context) => calls.push(['sun-update', context]),
  };
  installEarthActions(world, moon, sun);
  assert.equal(world.earthState, container);
  for (let i = 0; i < 20; i++)
    assert.equal(world.getPrimaryAction(running).label, 'moon');
  assert.deepEqual(calls, []);
  // The displayed Moon prompt becomes stale: E must choose currently eligible Sun.
  moonEligible = false;
  assert.equal(world.onPrimaryAction(running), 'sun-response');
  moonEligible = true;
  assert.equal(world.onPrimaryAction(running), 'moon-joined');
  for (let i = 0; i < 20; i++)
    assert.equal(world.onPrimaryAction(running), null);
  assert.deepEqual(calls, ['sun-action', 'moon-action']);
  calls.length = 0;
  world.update(running);
  assert.deepEqual(calls, [
    ['moon-update', running],
    ['sun-update', running],
  ]);
  calls.length = 0;
  const paused = { ...running, canInteract: false, canSimulate: false };
  world.update(paused);
  assert.deepEqual(calls, [
    ['moon-update', paused],
    ['sun-update', paused],
  ]);
  assert.equal(world.getPrimaryAction(paused), null);
  assert.equal(world.onPrimaryAction(paused), null);
});

test('real shared route blocks welcome/help/transitions/repeats with Sun in range', () => {
  const world = createEarth();
  world.position.set(-110, 0, -100);
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
    assert.equal(world.getPrimaryAction(context), null);
    assert.equal(performPrimaryAction(input), null);
    assert.equal(world.earthState.sun.status, 'ready');
  }
  updateActionContext(context, true, false, false, 0.05);
  assert.equal(performPrimaryAction({ ...input, repeat: true }), null);
  assert.equal(performPrimaryAction(input), '光沿着你的边缘，慢慢展开。');
  assert.equal(performPrimaryAction(input), null);
  assert.equal(world.earthState.moon.status, 'available');
  assert.equal(grassCalls, 0);
});

test('actual double eligibility invites original Moon first, then responds to Sun without reinstalling state', () => {
  const world = createEarth();
  const container = world.earthState;
  const moonState = container.moon;
  const sunState = container.sun;
  const moon = world.moon;
  // Deliberately adjusted test layout exercises overlapping eligibility. This is
  // not a production teleport or a replacement model.
  moon.position.copy(world.sunBody.position);
  world.position.set(-110, 0, -100);
  assert.equal(world.getPrimaryAction(running).label, '邀请月亮同行');
  assert.equal(world.onPrimaryAction(running), '月亮，与你同行。');
  assert.equal(moonState.status, 'orbiting');
  assert.equal(sunState.status, 'ready');
  assert.equal(world.getPrimaryAction(running).label, '与月亮回应光芒');
  assert.equal(
    world.onPrimaryAction(running),
    '这一次，光也照见了你的同行者。',
  );
  const phase = moonState.phase;
  const remaining = sunState.remaining;
  world.update(running);
  close(moonState.phase, phase + 0.009);
  close(sunState.remaining, remaining - 0.05);
  assert.equal(world.earthState, container);
  assert.equal(container.moon, moonState);
  assert.equal(container.sun, sunState);
  assert.equal(world.moon, moon);
});

test('Sun response and cooldown never prevent an eligible independent Moon invitation', () => {
  for (const stage of ['responding', 'cooldown']) {
    const world = createEarth();
    world.position.set(-110, 0, -100);
    assert.equal(world.onPrimaryAction(running), '光沿着你的边缘，慢慢展开。');
    if (stage === 'cooldown')
      for (let i = 0; i < 60; i++) world.update(running);
    assert.equal(world.earthState.sun.status, stage);
    world.position.set(80, 0, -65);
    assert.equal(world.getPrimaryAction(running).label, '邀请月亮同行');
    const remaining = world.earthState.sun.remaining;
    assert.equal(world.onPrimaryAction(running), '月亮，与你同行。');
    assert.equal(world.earthState.sun.remaining, remaining);
    world.update(running);
    assert.equal(world.earthState.moon.status, 'orbiting');
    assert.equal(world.earthState.sun.status, 'cooldown');
  }
});

test('reduced-motion Sun response and fixed-offset Moon follow compose in one moving scenario', () => {
  const world = createEarth();
  world.position.set(80, 0, -65);
  world.onPrimaryAction(running);
  const phase = world.earthState.moon.phase;
  const offset = world.moon.position.clone().sub(world.position);
  const reduced = { ...running, reducedMotion: true };
  const baseColor = world.atmosphere.material.uniforms.color.value.clone();
  world.position.set(-110, 0, -100);
  world.update(reduced);
  assert.equal(
    world.onPrimaryAction(reduced),
    '这一次，光也照见了你的同行者。',
  );
  const responseColor = world.atmosphere.material.uniforms.color.value.clone();
  assert.notDeepEqual(responseColor, baseColor);
  for (const position of [
    [-100, 0, -100],
    [-100, 0, -80],
    [-40, 0, -80],
  ]) {
    const before = world.position.clone();
    world.position.set(...position);
    world.update(reduced);
    assert.notDeepEqual(world.position, before);
    assert.equal(world.earthState.moon.phase, phase);
    const currentOffset = world.moon.position.clone().sub(world.position);
    for (const axis of ['x', 'y', 'z'])
      close(currentOffset[axis], offset[axis]);
    assert.deepEqual(world.sunHalo.scale.toArray(), [1, 1, 1]);
    assert.deepEqual(
      world.atmosphere.material.uniforms.color.value,
      responseColor,
    );
    close(
      world.sun.intensity,
      3.8 *
        (1 +
          0.25 *
            sunProximity(world.position.distanceTo(world.sunBody.position))),
    );
  }
  for (let i = 0; i < 57; i++) world.update(reduced);
  assert.equal(world.earthState.sun.status, 'cooldown');
  assert.deepEqual(world.atmosphere.material.uniforms.color.value, baseColor);
  assert.equal(world.earthState.moon.phase, phase);
});
