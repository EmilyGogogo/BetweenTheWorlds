import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../vendor/three.module.js';
import { descriptions } from '../../src/content/worlds.js';
import {
  createMovementInput,
  createMovementStepper,
  simulationDelta,
} from '../../src/core/world-movement.js';
import { ringedMovementLimits } from '../../src/worlds/earth-ringed-planet.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function fixture(settings = descriptions[3]) {
  const world = {
    position: new THREE.Vector3(),
    movementInfluenceLimits: ringedMovementLimits,
  };
  const context = { dt: 0.05, canSimulate: true, stepId: 0 };
  const input = createMovementInput();
  const step = createMovementStepper();
  const run = () => {
    context.stepId++;
    input.refresh(context, settings.limit);
    const result = step(world, settings, 0, input.keys, context);
    input.finishStep();
    return result;
  };
  return { world, context, input, step, run, settings };
}

test('production normal movement preserves four speeds, headings, key aliases, diagonals and release', () => {
  for (const settings of descriptions) {
    for (const yaw of [0, 0.22, -1.3, Math.PI]) {
      for (const codes of [
        ['KeyW'],
        ['ArrowUp'],
        ['KeyW', 'KeyD'],
        ['ArrowUp', 'ArrowRight'],
      ]) {
        const f = fixture(settings);
        codes.forEach((code) => f.input.keydown(code));
        for (let i = 0; i < 20; i++) {
          f.context.stepId++;
          f.input.refresh(f.context, settings.limit);
          f.step(f.world, settings, yaw, f.input.keys, f.context);
          f.input.finishStep();
        }
        close(f.world.position.length(), settings.speed);
        const diagonal = codes.length === 2;
        const dx = diagonal ? 1 / Math.SQRT2 : 0,
          dz = diagonal ? -1 / Math.SQRT2 : -1;
        close(
          f.world.position.x,
          (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * settings.speed,
        );
        close(
          f.world.position.z,
          (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * settings.speed,
        );
        codes.forEach((code) => f.input.keyup(code));
        const before = f.world.position.clone();
        f.run();
        assert.deepEqual(f.world.position, before);
        assert.equal(f.world.moving, 0);
      }
    }
    const f = fixture(settings);
    f.world.position.set(settings.limit - 0.001, 7, 0);
    f.input.keydown('KeyD');
    f.run();
    close(f.world.position.x, settings.limit);
    close(f.world.position.y, 7);
  }
});

test('V2 movement equivalence across arbitrary in-disk starts and multiple yaw values', () => {
  for (const settings of descriptions)
    for (let i = 0; i < 80; i++) {
      const f = fixture(settings),
        yaw = i * 0.317;
      f.world.position.set(
        Math.sin(i) * settings.limit * 0.9,
        0,
        Math.cos(i) * settings.limit * 0.9,
      );
      const old = f.world.position.clone();
      f.input.keydown('KeyW');
      f.input.keydown('KeyD');
      const x = (Math.cos(yaw) - Math.sin(yaw)) / Math.SQRT2;
      const z = (-Math.sin(yaw) - Math.cos(yaw)) / Math.SQRT2;
      old.x += x * settings.speed * f.context.dt;
      old.z += z * settings.speed * f.context.dt;
      const distance = Math.hypot(old.x, old.z);
      if (distance > settings.limit)
        old.multiplyScalar(settings.limit / distance);
      f.context.stepId++;
      f.input.refresh(f.context, settings.limit);
      f.step(f.world, settings, yaw, f.input.keys, f.context);
      close(f.world.position.distanceTo(old), 0);
    }
});

test('pure influence is clamped on all axes/quadrants and reports only actual influence displacement', () => {
  for (let i = 0; i < 24; i++) {
    const f = fixture(),
      angle = (i * Math.PI) / 12;
    const ux = Math.cos(angle),
      uz = Math.sin(angle);
    f.world.position.set(ux * 199.9, 3, uz * 199.9);
    f.world.getMovementInfluence = (_c, out) =>
      Object.assign(out, { x: ux * 0.3, y: 0, z: uz * 0.3, duration: 0.05 });
    const result = f.run();
    close(Math.hypot(f.world.position.x, f.world.position.z), 200);
    close(result.distance, 0.1);
    close(result.x, ux * 0.1);
    close(result.z, uz * 0.1);
    assert.equal(result.clamped, true);
    close(f.world.position.y, 3);
    f.run();
    assert.equal(result.blocked, true);
  }
  const f = fixture();
  f.world.position.set(199.99, 0, 0);
  f.input.keydown('KeyD');
  // Player-only clamping is excluded from the influence feedback.
  f.world.getMovementInfluence = () => null;
  const result = f.run();
  close(f.world.position.x, 200);
  close(result.distance, 0);
  assert.equal(result.accepted, false);
});

test('movement rejects malformed duration, vectors and limits with explicit reasons', () => {
  for (const [patch, reason] of [
    [{ x: NaN }, 'non-finite'],
    [{ z: Infinity }, 'non-finite'],
    [{ y: 1 }, 'non-horizontal'],
    [{ duration: 0 }, 'invalid-duration'],
    [{ duration: -1 }, 'invalid-duration'],
    [{ duration: NaN }, 'non-finite'],
    [{ duration: 0.051 }, 'invalid-duration'],
    [{ x: 0.901 }, 'exceeds-limits'],
    [{ x: 13 }, 'exceeds-limits'],
  ]) {
    const f = fixture();
    f.world.getMovementInfluence = (_c, out) =>
      Object.assign(out, { x: 0.3, y: 0, z: 0, duration: 0.05 }, patch);
    assert.equal(f.run().reason, reason);
    assert.deepEqual(f.world.position.toArray(), [0, 0, 0]);
  }
  for (const limits of [
    undefined,
    { speed: 0, maxDistance: 12 },
    { speed: 6, maxDistance: Infinity },
  ]) {
    const f = fixture();
    f.world.movementInfluenceLimits = limits;
    f.world.getMovementInfluence = (_c, out) =>
      Object.assign(out, { x: 0.3, y: 0, z: 0, duration: 0.05 });
    assert.equal(f.run().reason, 'invalid-limits');
  }
  const f = fixture();
  f.world.movementInfluenceLimits = { speed: 1000, maxDistance: 12 };
  f.world.getMovementInfluence = (_c, out) =>
    Object.assign(out, { x: 13, y: 0, z: 0, duration: 0.05 });
  assert.equal(f.run().reason, 'exceeds-limits');
});

test('opposing keys remain input intent and short taps/blur latch through keyup until consumption', () => {
  for (const codes of [
    ['KeyW', 'KeyS'],
    ['KeyA', 'KeyD'],
  ]) {
    const f = fixture();
    codes.forEach((code) => f.input.keydown(code));
    f.input.refresh(f.context, 200);
    assert.equal(f.context.hasMovementInput, true);
    f.run();
    close(f.world.position.length(), 0);
  }
  for (const code of [
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
  ]) {
    const f = fixture();
    f.input.keydown(code);
    f.input.keyup(code);
    f.input.refresh(f.context, 200);
    assert.equal(f.context.hasMovementInput, false);
    assert.equal(f.context.movementInterrupted, true);
    f.run();
    f.input.refresh(f.context, 200);
    assert.equal(f.context.movementInterrupted, false);
    f.input.keydown(code);
    f.input.blur();
    f.input.refresh(f.context, 200);
    assert.equal(f.context.hasMovementInput, false);
    assert.equal(f.context.movementInterrupted, true);
  }
});

test('step feedback is reset, duplicate steps never move twice, pause and invalid dt never query', () => {
  const f = fixture();
  let calls = 0;
  f.world.getMovementInfluence = (_c, out) => {
    calls++;
    return Object.assign(out, { x: 0.3, y: 0, z: 0, duration: 0.05 });
  };
  const result = f.run();
  close(f.world.position.x, 0.3);
  assert.equal(f.step(f.world, f.settings, 0, f.input.keys, f.context), result);
  close(f.world.position.x, 0.3);
  assert.equal(calls, 1);
  for (const dt of [0, -1, NaN, Infinity]) {
    f.context.dt = dt;
    f.run();
    assert.equal(calls, 1);
    close(result.distance, 0);
    close(f.world.position.x, 0.3);
  }
  f.context.dt = 0.05;
  f.context.canSimulate = false;
  f.run();
  assert.equal(calls, 1);
  f.context.canSimulate = true;
  f.world.getMovementInfluence = () => null;
  assert.equal(f.run().reason, 'no-request');
  close(result.distance, 0);
  close(simulationDelta(30), 0.05);
});

test('input latches belong to the event world across switches and are consumed only by that world', () => {
  const input = createMovementInput(),
    earth = {},
    grass = {},
    context = {};
  input.blur(earth);
  input.refresh(context, 48, grass);
  assert.equal(context.movementInterrupted, false);
  input.finishStep(grass);
  input.refresh(context, 200, earth);
  assert.equal(context.movementInterrupted, true);
  input.finishStep(earth);
  input.keydown('KeyW', grass);
  input.keyup('KeyW');
  input.refresh(context, 200, earth);
  assert.equal(context.movementInterrupted, false);
  input.refresh(context, 48, grass);
  assert.equal(context.movementInterrupted, true);
});

test('influence queries see the clamped player base, and rejection preserves lawful player displacement', () => {
  const f = fixture();
  f.world.position.set(199.99, 0, 0);
  f.input.keydown('KeyD');
  let observedBase;
  f.world.getMovementInfluence = (_ctx, out) => {
    observedBase = f.world.position.clone();
    return Object.assign(out, { x: Infinity, y: 0, z: 0, duration: 0.05 });
  };
  const result = f.run();
  close(observedBase.x, 200);
  close(f.world.position.x, 200);
  close(result.distance, 0);
  assert.equal(result.reason, 'non-finite');
});
