import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../vendor/three.module.js';
import {
  createRingedPlanet,
  ringedPlanetSettings,
} from '../../src/worlds/earth-ringed-planet.js';
import { movingEarth } from '../helpers/earth-movement.mjs';
import { performPrimaryAction } from '../../src/core/world-actions.js';
import { sunProximity } from '../../src/worlds/earth-sun.js';
import { installEarthActions } from '../../src/worlds/earth-actions.js';

const close = (a, b, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
function eligible() {
  const f = movingEarth();
  f.world.position.set(60, 0, -140);
  return f;
}
const prompt = (f) => f.ring.getPrimaryAction(f.context);
function runPull(f, dt = 0.05) {
  assert.equal(f.action(), '星环亮起，与你回应。');
  let steps = 0;
  while (f.state.status === 'pulling') {
    assert.ok(++steps < 250);
    f.tick(dt);
  }
}
function resources(world) {
  const objects = new Set(),
    geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  world.scene.traverse((object) => {
    objects.add(object);
    if (object.geometry) geometries.add(object.geometry);
    for (const material of object.material ? [object.material].flat() : []) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value?.isTexture) textures.add(value);
    }
  });
  return { objects, geometries, materials, textures };
}

test('real scene independently reaches ringed action without Moon or Sun, with a full safe 36-unit path', () => {
  const f = eligible(),
    w = f.world;
  const body = w.ringedPlanet;
  const radial = Math.hypot(body.position.x, body.position.z);
  close(radial, 262.48809496813374);
  close(
    Math.hypot(radial - f.context.movementLimit, body.position.y),
    74.1940834,
    1e-5,
  );
  assert.ok(w.position.length() < 200);
  assert.ok(w.position.distanceTo(body.position) <= 180);
  assert.ok(w.position.distanceTo(w.sunBody.position) > 100);
  assert.ok(w.position.distanceTo(w.moon.position) > 75);
  assert.equal(w.getPrimaryAction(f.context).label, '感受引力');
  assert.equal(w.earthState.moon.status, 'available');
  assert.equal(w.earthState.sun.status, 'ready');
  const start = w.position.clone();
  runPull(f);
  close(w.position.distanceTo(start), 36);
  close(f.state.spent, 36);
  close(w.position.x, 91.6042, 1e-4);
  close(w.position.z, -157.2387, 1e-4);
  assert.ok(w.position.length() < 200);
  assert.equal(f.state.status, 'cooldown');
  close(f.state.remaining, 6);
  assert.equal(w.earthState.moon.status, 'available');
  assert.equal(w.earthState.sun.status, 'ready');
});

test('visual eligibility uses inclusive 3D proximity; invalid movement geometry only disables traction', () => {
  const f = eligible(),
    body = f.world.ringedPlanet;
  // Move only test fixtures into a safe origin layout; production uses original layout.
  for (const distance of [179.999, 180, 180.001]) {
    body.position.set(Math.sqrt(distance * distance - 40 * 40), 40, 0);
    f.world.position.set(0, 0, 0);
    assert.equal(Boolean(prompt(f)), distance <= 180);
  }
  body.position.set(160, 160, 0);
  assert.equal(prompt(f), null); // Horizontal range alone would pass.
  body.position.set(0, 40, 0);
  assert.ok(prompt(f)); // Zero horizontal bearing still permits the visual.
  body.position.set(100, 40, 0);
  for (const limit of [undefined, 0, -1, NaN, Infinity]) {
    const g = eligible();
    g.context.movementLimit = limit;
    assert.ok(prompt(g));
    assert.ok(g.ring.onPrimaryAction(g.context));
    assert.equal(g.ring.getMovementInfluence(g.context, {}), null);
    g.context.stepId++;
    g.ring.update(g.context);
    assert.equal(g.state.spent, 0);
    assert.ok(g.world.ringedPlanetRing.material.emissive.b > 0);
  }
  f.context.movementLimit = 200;
  f.context.dt = 0;
  assert.ok(prompt(f));
  assert.ok(f.ring.onPrimaryAction(f.context));
});

test('queries are pure and stale range, blocked interaction and repeats cannot authorize a response', () => {
  for (const mutate of [
    (f) => f.world.position.set(0, 0, 0),
    (f) => {
      f.context.canInteract = false;
    },
    (f) => {
      f.world.ringedPlanet.visible = false;
    },
    (f) => f.world.ringedPlanet.removeFromParent(),
    (f) => {
      f.world.ringedPlanet = new THREE.Group();
    },
    (f) => {
      f.world.ringedPlanetGas = null;
    },
    (f) => {
      f.world.ringedPlanetRing = null;
    },
  ]) {
    const f = eligible(),
      before = structuredClone(f.state);
    for (let i = 0; i < 20; i++) assert.ok(prompt(f));
    assert.deepEqual(f.state, before);
    mutate(f);
    assert.equal(f.ring.onPrimaryAction(f.context), null);
    assert.deepEqual(f.state, before);
  }
  const f = eligible();
  const args = {
    active: 3,
    world: f.world,
    context: f.context,
    repeat: true,
    recruit: () => assert.fail('grass called'),
  };
  assert.equal(performPrimaryAction(args), null);
  assert.ok(performPrimaryAction({ ...args, repeat: false }));
  const before = structuredClone(f.state);
  for (let i = 0; i < 20; i++) assert.equal(f.action(), null);
  assert.deepEqual(f.state, before);
});

test('multiple dt schedules conserve elapsed, actual budget and cooldown including final partial frames', () => {
  for (const schedule of [
    [0.01],
    [0.025],
    [0.05],
    [0.013, 0.031, 0.007, 0.05],
  ]) {
    const f = eligible(),
      start = f.world.position.clone();
    f.action();
    let total = 0,
      i = 0;
    while (f.state.status === 'pulling') {
      const dt = schedule[i++ % schedule.length];
      total += dt;
      f.tick(dt);
      assert.ok(f.state.spent <= 36 + 1e-6);
      assert.ok(i < 400);
    }
    close(f.state.elapsed, 2);
    close(f.state.spent, 36);
    close(f.world.position.distanceTo(start), 36);
    close(f.state.remaining, 6 - (total - 2));
    for (let n = 0; n < 200 && f.state.status !== 'ready'; n++) f.tick();
    assert.equal(f.state.status, 'ready');
    assert.ok(prompt(f));
  }
  const f = eligible();
  f.action();
  for (let i = 0; i < 39; i++) f.tick();
  f.tick(0.037);
  f.tick();
  close(f.state.elapsed, 2);
  close(f.state.remaining, 5.963);
});

test('invalid delta never advances pull/cooldown, large delta is capped and outer range is inclusive', () => {
  const f = eligible();
  f.action();
  f.tick();
  for (const dt of [0, -1, NaN, Infinity]) {
    const before = structuredClone(f.state),
      position = f.world.position.clone();
    f.tick(dt);
    assert.deepEqual(f.state, before);
    assert.deepEqual(f.world.position, position);
  }
  f.tick(100);
  close(f.state.elapsed, 0.1);
  close(f.state.spent, 1.8);
  for (const distance of [219.999, 220, 220.001]) {
    const g = eligible();
    g.action();
    g.world.ringedPlanet.position
      .copy(g.world.position)
      .add(new THREE.Vector3(distance, 0, 0));
    g.tick();
    assert.equal(g.state.status, distance <= 220 ? 'pulling' : 'cooldown');
    if (distance > 220) {
      close(g.state.remaining, 6);
      close(g.state.spent, 0);
    }
  }
  f.input.blur();
  f.tick();
  for (const dt of [0, -1, NaN, Infinity]) {
    const before = structuredClone(f.state);
    f.tick(dt);
    assert.deepEqual(f.state, before);
  }
  f.world.position.set(0, 0, 0);
  f.tick();
  close(f.state.remaining, 5.95);
});

test('actual feedback alone consumes budget, is idempotent, and old or missing feedback is not invented', () => {
  const f = eligible();
  f.action();
  const before = structuredClone(f.state),
    position = f.world.position.clone();
  const out = {};
  for (let i = 0; i < 20; i++)
    assert.equal(f.ring.getMovementInfluence(f.context, out), out);
  assert.deepEqual(f.state, before);
  assert.deepEqual(f.world.position, position);
  f.tick();
  const after = structuredClone(f.state);
  for (let i = 0; i < 20; i++) f.world.update(f.context);
  assert.deepEqual(f.state, after);
  const g = eligible();
  g.context.movementResult = {
    stepId: 0,
    accepted: true,
    distance: 100,
    duration: 100,
  };
  g.action();
  g.ring.update(g.context);
  close(g.state.spent, 0);
  g.context.stepId++;
  g.ring.update(g.context);
  assert.equal(g.state.stopReason, 'missing-movement-result');
  close(g.state.spent, 0);
  close(g.state.remaining, 6);
  const h = eligible();
  h.action();
  delete h.context.stepId;
  h.ring.update(h.context);
  assert.equal(h.state.stopReason, 'missing-movement-result');
});

test('all eight movement keys, opposing keys, short taps and blur cancel before influence while player motion survives', () => {
  for (const codes of [
    ['KeyW'],
    ['KeyA'],
    ['KeyS'],
    ['KeyD'],
    ['ArrowUp'],
    ['ArrowDown'],
    ['ArrowLeft'],
    ['ArrowRight'],
    ['KeyW', 'KeyS'],
  ]) {
    const f = eligible();
    f.action();
    const before = f.world.position.clone();
    codes.forEach((code) => f.input.keydown(code));
    const result = f.tick();
    assert.equal(f.state.status, 'cooldown');
    close(f.state.remaining, 6);
    close(f.state.spent, 0);
    assert.equal(result.accepted, false);
    close(
      f.world.position.distanceTo(before),
      codes.length === 1 ? 38 * 0.05 : 0,
    );
    assert.ok(f.world.ringedPlanetRing.material.emissive.b > 0);
    const state = structuredClone(f.state);
    f.world.update(f.context);
    assert.deepEqual(f.state, state);
  }
  for (const interrupt of [
    (f) => {
      f.input.keydown('KeyW');
      f.input.keyup('KeyW');
    },
    (f) => f.input.blur(),
  ]) {
    const f = eligible();
    f.action();
    const before = f.world.position.clone();
    interrupt(f);
    f.tick();
    assert.deepEqual(f.world.position, before);
    close(f.state.remaining, 6);
    for (let i = 0; i < 10; i++) f.tick();
    assert.equal(f.state.status, 'cooldown');
    close(f.state.spent, 0);
  }
  const f = eligible();
  f.input.keydown('KeyW');
  assert.equal(f.action(), '星环亮起，与你回应。');
  f.tick();
  assert.equal(f.state.status, 'cooldown');
  assert.equal(f.state.spent, 0);
  assert.ok(f.world.ringedPlanetRing.material.emissive.b > 0);
});

test('boundary proximity still offers E; first clamp stops only traction without sliding', () => {
  const f = eligible(),
    body = f.world.ringedPlanet;
  // Axis-aligned fault layout keeps the exact no-drift assertion independent
  // of rounding from normalization of the new production bearing.
  body.position.set(0, 40, -260);
  const direction = new THREE.Vector3(
    body.position.x,
    0,
    body.position.z,
  ).normalize();
  f.world.position.copy(direction).multiplyScalar(199.1);
  assert.ok(prompt(f));
  f.world.position.copy(direction).multiplyScalar(198.83);
  assert.ok(prompt(f));
  // Isolate the radial boundary mechanics; normal E routing is tested above.
  const before = f.world.position.clone();
  assert.ok(f.ring.onPrimaryAction(f.context));
  for (let i = 0; i < 10 && f.state.status === 'pulling'; i++) f.tick();
  assert.equal(f.state.status, 'cooldown');
  close(f.state.remaining, 6);
  close(f.world.position.length(), 200);
  close(f.state.spent, 1.17);
  close(f.state.spent, f.world.position.distanceTo(before));
  const end = f.world.position.clone();
  f.tick();
  assert.deepEqual(f.world.position, end);
  assert.ok(
    ['boundary-clamped', 'boundary-blocked'].includes(f.state.stopReason),
  );
  f.input.keydown('KeyS');
  f.tick();
  assert.ok(f.world.position.length() < 200);
  const g = eligible();
  g.world.ringedPlanet.position.copy(body.position);
  g.world.position.copy(direction).multiplyScalar(198.83);
  assert.ok(g.ring.onPrimaryAction(g.context));
  g.world.position.copy(direction).multiplyScalar(200);
  const result = g.tick();
  assert.equal(result.blocked, true);
  close(g.state.spent, 0);
  assert.equal(g.state.stopReason, 'boundary-blocked');
  close(g.state.remaining, 6);
});

test('help/transition pauses freeze state and visuals, resume uses only supplied time, blur still cancels paused pull', () => {
  const f = eligible();
  f.action();
  for (let i = 0; i < 10; i++) f.tick();
  const before = structuredClone(f.state),
    position = f.world.position.clone(),
    opacity = f.world.ringedPlanetRing.material.opacity;
  f.context.canSimulate = false;
  f.context.canInteract = false;
  for (let i = 0; i < 200; i++) f.tick();
  assert.deepEqual(f.state, before);
  assert.deepEqual(f.world.position, position);
  close(f.world.ringedPlanetRing.material.opacity, opacity);
  f.context.canSimulate = true;
  f.context.canInteract = true;
  f.tick();
  close(f.state.elapsed, 0.55);
  f.context.canSimulate = false;
  f.input.blur();
  f.tick();
  assert.equal(f.state.status, 'cooldown');
  close(f.state.remaining, 6);
  f.tick();
  close(f.state.remaining, 6);
  // Non-active worlds are not called: resumption rechecks current geometry.
  const g = eligible();
  g.action();
  g.tick();
  const elapsed = g.state.elapsed;
  g.world.ringedPlanet.position.set(1000, 0, 1000);
  g.tick();
  assert.equal(g.state.status, 'cooldown');
  close(g.state.elapsed, elapsed);
  close(g.state.remaining, 6);
});

test('disable and accidental detach/hidden/reference replacement clean exact talker even while paused', () => {
  for (const stage of ['ready', 'pulling', 'cooldown'])
    for (const invalidate of [
      (f) => f.ring.setEnabled(false),
      (f) => f.world.ringedPlanet.removeFromParent(),
      (f) => {
        f.world.ringedPlanet.visible = false;
      },
      (f) => {
        f.world.ringedPlanet = new THREE.Group();
      },
      (f) => {
        f.world.ringedPlanetRing = null;
      },
      (f) => f.world.ringedPlanetGas.removeFromParent(),
    ]) {
      const f = eligible(),
        w = f.world,
        body = w.ringedPlanet,
        ring = w.ringedPlanetRing;
      const talker = w.talkers.find((t) => t.object === body),
        others = w.talkers.filter((t) => t !== talker);
      const moon = w.earthState.moon,
        sun = w.earthState.sun;
      if (stage !== 'ready') {
        f.action();
        f.tick();
      }
      if (stage === 'cooldown') {
        f.input.blur();
        f.tick();
        f.tick();
      }
      const expected = stage === 'cooldown' ? f.state.remaining : 6;
      f.context.canSimulate = false;
      invalidate(f);
      assert.equal(prompt(f), null);
      f.tick();
      assert.equal(f.state.enabled, false);
      assert.deepEqual(w.talkers, others);
      close(ring.material.opacity, 0.8);
      if (stage !== 'ready') {
        assert.equal(f.state.status, 'cooldown');
        close(f.state.remaining, expected);
      }
      f.tick();
      for (let i = 0; i < 10; i++) f.ring.setEnabled(true);
      assert.equal(w.ringedPlanet, body);
      assert.equal(body.parent, w.scene);
      assert.equal(w.talkers.filter((t) => t === talker).length, 1);
      assert.equal(w.earthState.moon, moon);
      assert.equal(w.earthState.sun, sun);
      if (stage !== 'ready') {
        close(f.state.remaining, expected);
        assert.equal(prompt(f), null);
      }
    }
});

test('real final center feeds ring once, Moon once and Sun once, with all original state and scene identity', () => {
  const f = eligible(),
    w = f.world,
    container = w.earthState;
  const moonState = container.moon,
    sunState = container.sun,
    refs = resources(w);
  assert.equal(w.talkers.length, 3);
  assert.deepEqual(
    w.talkers.map((t) => [t.name, t.range]),
    [
      ['有环的星球', 290],
      ['月亮', 75],
      ['太阳', 120],
    ],
  );
  assert.equal(w.ringedPlanetGas.geometry.parameters.radius, 49);
  assert.equal(w.ringedPlanetRing.geometry.parameters.innerRadius, 66);
  assert.ok(Object.isFrozen(w.movementInfluenceLimits));
  w.position.copy(w.moon.position);
  assert.equal(f.action(), '月亮，与你同行。');
  w.position.set(-110, 0, -100);
  w.update({ ...f.context, dt: 0 });
  assert.equal(f.action(), '这一次，光也照见了你的同行者。');
  // Test-only overlap exercises all handlers together; production now separates Sun.
  w.ringedPlanet.position.set(-150, 40, -230);
  w.position.set(-60, 0, -170);
  assert.equal(f.action(), '星环亮起，与你回应。');
  const phase = moonState.phase,
    sunRemaining = sunState.remaining;
  const order = [];
  for (const name of ['ringedPlanet', 'moon', 'sun']) {
    const handler = w.earthActions[name],
      original = handler.update;
    handler.update = (ctx) => {
      order.push(name);
      original(ctx);
    };
  }
  const old = w.avatar.position.clone(),
    beforeIntensity = w.sun.intensity;
  f.tick();
  assert.deepEqual(order, ['ringedPlanet', 'moon', 'sun']);
  close(moonState.phase, phase + 0.009);
  close(sunState.remaining, sunRemaining - 0.05);
  const offset = w.moon.position.clone().sub(w.position);
  close(Math.hypot(offset.x, offset.z), 48);
  close(offset.y, 5);
  assert.deepEqual(w.sun.target.position, w.position);
  close(w.sun.target.matrixWorld.elements[12], w.position.x);
  close(w.sun.target.matrixWorld.elements[14], w.position.z);
  const expected =
    3.8 * (1 + 0.25 * sunProximity(w.position.distanceTo(w.sunBody.position)));
  close(
    w.sun.intensity,
    beforeIntensity + (expected - beforeIntensity) * (1 - Math.exp(-4 * 0.05)),
  );
  assert.deepEqual(w.avatar.position, old); // Avatar/camera synchronization happens later in main.
  assert.equal(w.earthState, container);
  assert.equal(container.moon, moonState);
  assert.equal(container.sun, sunState);
  assert.deepEqual(resources(w), refs);
});

test('three-action priority is deterministic and live, without resetting active Sun or ringed states', () => {
  const f = eligible(),
    w = f.world;
  w.moon.position.copy(w.position);
  w.sunBody.position.copy(w.position);
  assert.equal(w.getPrimaryAction(f.context).label, '邀请月亮同行');
  // A stale Moon label is reselected at E, never treated as authorization.
  w.moon.position.set(1000, 0, 1000);
  assert.equal(f.action(), '光沿着你的边缘，慢慢展开。');
  assert.equal(w.getPrimaryAction(f.context).label, '感受引力');
  const remaining = w.earthState.sun.remaining;
  assert.equal(f.action(), '星环亮起，与你回应。');
  close(w.earthState.sun.remaining, remaining);
  w.moon.position.copy(w.position);
  assert.equal(f.action(), '月亮，与你同行。');
  assert.equal(f.state.status, 'pulling');
  assert.equal(w.earthState.sun.status, 'responding');
});

test('reduced motion keeps deliberate traction, steady ring, fixed Moon phase and live final-center lighting', () => {
  const f = eligible(),
    w = f.world;
  f.context.reducedMotion = true;
  w.position.copy(w.moon.position);
  assert.equal(f.action(), '月亮，与你同行。');
  const phase = w.earthState.moon.phase,
    offset = w.moon.position.clone().sub(w.position);
  w.position.set(-110, 0, -100);
  f.action();
  // Test-only overlap exercises all handlers together; production now separates Sun.
  w.ringedPlanet.position.set(-150, 40, -230);
  w.position.set(-60, 0, -170);
  assert.equal(f.action(), '星环亮起，与你回应。');
  const start = w.position.clone(),
    rotation = w.ringedPlanetRing.rotation.toArray();
  for (let i = 0; i < 10; i++) {
    f.tick();
    close(w.ringedPlanetRing.material.opacity, 0.88);
    close(w.earthState.moon.phase, phase);
    close(w.moon.position.clone().sub(w.position).distanceTo(offset), 0);
    assert.deepEqual(w.sunHalo.scale.toArray(), [1, 1, 1]);
    assert.deepEqual(w.ringedPlanetRing.rotation.toArray(), rotation);
    close(
      w.sun.intensity,
      3.8 *
        (1 + 0.25 * sunProximity(w.position.distanceTo(w.sunBody.position))),
    );
  }
  close(w.position.distanceTo(start), 9);
  f.input.keydown('KeyD');
  f.tick();
  assert.ok(w.ringedPlanetRing.material.emissive.b > 0);
});

test('ring envelope peaks once and 100 full cycles / 10 enable cycles retain resources, content and baselines', () => {
  const f = eligible(),
    w = f.world,
    refs = resources(w),
    talkers = [...w.talkers];
  const lines = structuredClone(talkers.map((t) => t.lines));
  const atmosphere = w.atmosphere.material.uniforms.color.value.clone(),
    ring = w.ringedPlanetRing;
  const gas = w.ringedPlanetGas,
    material = ring.material;
  const baseLight = material.emissive.clone(),
    baseScale = ring.scale.clone();
  for (let cycle = 0; cycle < 100; cycle++) {
    w.position.set(60, 0, -140);
    f.action();
    close(material.opacity, 0.8);
    for (let i = 0; i < 20; i++) f.tick();
    close(material.opacity, 0.95);
    for (let i = 0; i < 20; i++) f.tick();
    close(material.opacity, 0.8);
    assert.deepEqual(material.emissive, baseLight);
    assert.deepEqual(ring.scale, baseScale);
    for (let i = 0; i < 120; i++) f.tick();
    assert.equal(f.state.status, 'ready');
    close(f.state.elapsed, ringedPlanetSettings.duration);
    close(f.state.spent, 36);
  }
  for (let i = 0; i < 10; i++) {
    f.ring.setEnabled(false);
    f.ring.setEnabled(true);
  }
  assert.deepEqual(resources(w), refs);
  assert.deepEqual(new Set(w.talkers), new Set(talkers));
  assert.deepEqual(
    talkers.map((t) => t.lines),
    lines,
  );
  assert.equal(w.ringedPlanetRing, ring);
  assert.equal(ring.material, material);
  assert.equal(w.ringedPlanetGas, gas);
  assert.deepEqual(w.atmosphere.material.uniforms.color.value, atmosphere);
  assert.equal(movingEarth().state.status, 'ready');
});

test('budget-limited last request uses only remaining path and rejected shared requests stop safely', () => {
  const f = eligible();
  f.action();
  f.state.spent = 35.95;
  f.state.elapsed = 0.4;
  const before = f.world.position.clone();
  f.tick();
  close(f.world.position.distanceTo(before), 0.05);
  close(f.state.spent, 36);
  close(f.state.remaining, 6 - (0.05 - 0.05 / 18));
  assert.equal(f.state.stopReason, 'complete');
  const g = eligible();
  g.action();
  // A faulty producer must be rejected by the actual production movement stage.
  g.world.getMovementInfluence = (_ctx, out) =>
    Object.assign(out, { x: 20, y: 0, z: 0, duration: 0.05 });
  const position = g.world.position.clone();
  g.tick();
  assert.deepEqual(g.world.position, position);
  close(g.state.spent, 0);
  assert.equal(g.state.stopReason, 'exceeds-limits');
  close(g.state.remaining, 6);
});

test('cooldown boundary, zero direction on resume, and repeated enable while pulling preserve contracts', () => {
  const f = eligible();
  f.action();
  for (let i = 0; i < 10; i++) f.tick();
  const before = structuredClone(f.state),
    opacity = f.world.ringedPlanetRing.material.opacity;
  f.ring.setEnabled(true);
  assert.deepEqual(f.state, before);
  close(f.world.ringedPlanetRing.material.opacity, opacity);
  f.input.blur();
  f.tick();
  for (let i = 0; i < 119; i++) f.tick();
  assert.equal(f.state.status, 'cooldown');
  close(f.state.remaining, 0.05);
  f.tick(0.049);
  assert.equal(f.state.status, 'cooldown');
  close(f.state.remaining, 0.001);
  f.tick(0.001);
  assert.equal(f.state.status, 'ready');
  assert.ok(prompt(f));
  const g = eligible();
  g.action();
  g.world.ringedPlanet.position.copy(g.world.position);
  const position = g.world.position.clone();
  g.tick();
  assert.deepEqual(g.world.position, position);
  assert.equal(g.state.stopReason, 'invalid-direction-or-range');
  close(g.state.remaining, 6);
  close(g.state.spent, 0);
});

test('separated default ringed planet leaves a real gap from Sun and still permits an independent safe pull', () => {
  const f = eligible(),
    w = f.world;
  assert.deepEqual(w.ringedPlanet.position.toArray(), [170, 40, -200]);
  const separation = w.ringedPlanet.position.distanceTo(w.sunBody.position);
  assert.ok(separation > 298 && separation < 299);
  // Full expanded ring sphere plus maximum Sun halo still have >150 units gap.
  assert.ok(separation - 103 * 1.14 - 24 * 1.08 > 150);
  assert.equal(w.getPrimaryAction(f.context).label, '感受引力');
  assert.equal(w.earthActions.sun.getPrimaryAction(f.context), null);
  assert.equal(w.earthActions.moon.getPrimaryAction(f.context), null);
  runPull(f);
  assert.ok(w.position.length() < 200);
  assert.ok(w.position.distanceTo(w.ringedPlanet.position) > 49 + 24.1);
});

test('traction gives immediate blue light and one 14 percent ring swell, then restores all fields', () => {
  const f = eligible(),
    ring = f.world.ringedPlanetRing,
    material = ring.material;
  const emissive = material.emissive;
  const base = {
    color: emissive.clone(),
    intensity: material.emissiveIntensity,
    scale: ring.scale.clone(),
    opacity: material.opacity,
  };
  assert.ok(f.action());
  assert.ok(emissive.b >= 0.35);
  close(ring.scale.x, 1.042);
  for (let i = 0; i < 20; i++) f.tick();
  close(ring.scale.x, 1.14);
  close(emissive.b, 1.2);
  close(material.opacity, 0.95);
  const peak = ring.scale.clone();
  for (let i = 0; i < 10; i++) f.tick();
  assert.ok(ring.scale.x < peak.x);
  const pausedScale = ring.scale.clone(),
    pausedColor = emissive.clone();
  f.context.canSimulate = false;
  f.tick();
  assert.deepEqual(ring.scale, pausedScale);
  assert.deepEqual(emissive, pausedColor);
  f.context.canSimulate = true;
  for (let i = 0; i < 10; i++) f.tick();
  assert.equal(f.state.status, 'cooldown');
  assert.equal(material.emissive, emissive);
  assert.deepEqual(emissive, base.color);
  assert.equal(material.emissiveIntensity, base.intensity);
  assert.deepEqual(ring.scale, base.scale);
  assert.equal(material.opacity, base.opacity);
});

test('reduced-motion response stays steady through a paused movement cancellation; disable still restores', () => {
  for (const disable of [false, true]) {
    const f = eligible(),
      ring = f.world.ringedPlanetRing,
      material = ring.material;
    f.context.reducedMotion = true;
    assert.ok(f.action());
    const color = material.emissive.clone(),
      scale = ring.scale.clone();
    close(color.b, 0.84);
    assert.deepEqual(scale.toArray(), [1, 1, 1]);
    for (let i = 0; i < 10; i++) {
      f.tick();
      assert.deepEqual(material.emissive, color);
      assert.deepEqual(ring.scale, scale);
    }
    f.context.canSimulate = false;
    if (disable) f.ring.setEnabled(false);
    else f.input.blur();
    f.tick();
    if (!disable) {
      assert.deepEqual(material.emissive, color);
      f.context.canSimulate = true;
      for (let i = 0; i < 30; i++) f.tick();
    }
    assert.deepEqual(material.emissive.toArray(), [0, 0, 0]);
    assert.equal(material.emissiveIntensity, 1);
    assert.deepEqual(ring.scale.toArray(), [1, 1, 1]);
    assert.equal(material.opacity, 0.8);
  }
});

test('ring response restores a nondefault scale and emissive baseline even after material replacement', () => {
  const f = eligible(),
    w = f.world,
    ring = w.ringedPlanetRing,
    material = ring.material;
  material.emissive.set('#123456');
  material.emissiveIntensity = 2.4;
  ring.scale.set(1.03, 0.97, 1.01);
  const baseLight = material.emissive.clone(),
    baseScale = ring.scale.clone();
  const handler = createRingedPlanet(
    w,
    w.ringedPlanet,
    w.ringedPlanetGas,
    ring,
    w.talkers[0],
  );
  installEarthActions(w, w.earthActions.moon, w.earthActions.sun, handler);
  assert.ok(f.action());
  assert.notDeepEqual(ring.scale, baseScale);
  for (let i = 0; i < 10; i++) f.tick();
  const replacement = new THREE.MeshStandardMaterial({
    emissive: '#ff00ff',
    emissiveIntensity: 0.5,
  });
  const replacementLight = replacement.emissive.clone();
  ring.material = replacement;
  f.context.canSimulate = false;
  f.tick();
  assert.equal(f.state.enabled, false);
  assert.deepEqual(material.emissive, baseLight);
  assert.equal(material.emissiveIntensity, 2.4);
  assert.deepEqual(ring.scale, baseScale);
  assert.equal(ring.material, replacement);
  assert.deepEqual(replacement.emissive, replacementLight);
  assert.equal(replacement.emissiveIntensity, 0.5);
});

test('nearby E works while moving or immediately after release, and its two-second response survives stopped traction', () => {
  for (const held of [true, false]) {
    const f = eligible(),
      ring = f.world.ringedPlanetRing;
    f.input.keydown('KeyW');
    if (!held) f.input.keyup('KeyW');
    f.input.refresh(f.context, 200);
    const before = structuredClone(f.state);
    assert.equal(f.world.getPrimaryAction(f.context).label, '感受引力');
    assert.deepEqual(f.state, before);
    assert.equal(f.action(), '星环亮起，与你回应。');
    assert.equal(f.state.responseRemaining, 2);
    f.tick();
    assert.equal(f.state.stopReason, 'input-interrupted');
    assert.equal(f.state.spent, 0);
    assert.ok(ring.material.emissive.b > 0);
    f.input.keyup('KeyW');
    for (let i = 0; i < 19; i++) f.tick();
    close(ring.scale.x, 1.14);
    close(ring.material.emissive.b, 1.2);
    assert.equal(f.state.spent, 0); // Releasing does not silently restart pull.
    for (let i = 0; i < 20; i++) f.tick();
    assert.equal(f.state.responseRemaining, 0);
    assert.deepEqual(ring.material.emissive.toArray(), [0, 0, 0]);
    assert.deepEqual(ring.scale.toArray(), [1, 1, 1]);
    assert.equal(f.action(), null); // Existing cooldown still blocks repeats.
  }
});

test('closest default boundary position now offers E and plays the full ring response without unsafe movement', () => {
  const f = eligible(),
    w = f.world,
    ring = w.ringedPlanetRing;
  const direction = w.ringedPlanet.position.clone();
  direction.y = 0;
  w.position.copy(direction.normalize()).multiplyScalar(200);
  assert.equal(w.getPrimaryAction(f.context).label, '感受引力');
  const before = w.position.clone();
  assert.equal(f.action(), '星环亮起，与你回应。');
  for (let i = 0; i < 20; i++) f.tick();
  assert.equal(f.state.stopReason, 'boundary-blocked');
  assert.ok(w.position.distanceTo(before) < 1e-8);
  assert.ok(f.state.spent < 1e-8);
  close(ring.scale.x, 1.14);
  close(ring.material.emissive.b, 1.2);
  for (let i = 0; i < 20; i++) f.tick();
  assert.equal(f.state.responseRemaining, 0);
  assert.deepEqual(ring.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(ring.material.emissive.toArray(), [0, 0, 0]);
});

test('visual-only response freezes in help, deduplicates steps and rejects invalid dt before restoring on disable', () => {
  const f = eligible(),
    ring = f.world.ringedPlanetRing;
  f.input.keydown('KeyW');
  assert.ok(f.action());
  f.tick();
  const snapshot = structuredClone(f.state),
    color = ring.material.emissive.clone(),
    scale = ring.scale.clone();
  for (let i = 0; i < 20; i++) f.world.update(f.context);
  assert.deepEqual(f.state, snapshot);
  f.context.canSimulate = false;
  for (let i = 0; i < 20; i++) f.tick();
  assert.deepEqual(f.state, snapshot);
  f.context.canSimulate = true;
  for (const dt of [0, -1, Infinity, NaN]) f.tick(dt);
  assert.deepEqual(f.state, snapshot);
  assert.deepEqual(ring.material.emissive, color);
  assert.deepEqual(ring.scale, scale);
  f.ring.setEnabled(false);
  assert.equal(f.state.responseRemaining, 0);
  assert.deepEqual(ring.material.emissive.toArray(), [0, 0, 0]);
  assert.deepEqual(ring.scale.toArray(), [1, 1, 1]);
});

test('stronger attraction is actual displacement: 18 units in one second and 36 in two, starting before the boundary', () => {
  for (const reducedMotion of [false, true]) {
    const f = eligible(),
      w = f.world;
    f.context.reducedMotion = reducedMotion;
    const start = w.position.clone(),
      distance = start.distanceTo(w.ringedPlanet.position);
    // This independent route is outside the old 130-unit trigger, now reachable
    // before Earth runs out of movement space. No Moon/Sun prerequisite.
    assert.ok(distance > 130 && distance < 180);
    assert.equal(w.getPrimaryAction(f.context).label, '感受引力');
    assert.equal(f.action(), '星环亮起，与你回应。');
    for (let i = 0; i < 20; i++) f.tick();
    close(w.position.distanceTo(start), 18);
    assert.equal(f.state.status, 'pulling');
    for (let i = 0; i < 20; i++) f.tick();
    close(w.position.distanceTo(start), 36);
    close(f.state.spent, 36);
    assert.ok(distance - w.position.distanceTo(w.ringedPlanet.position) > 30);
    assert.ok(w.position.length() < 200);
    assert.ok(w.position.distanceTo(w.ringedPlanet.position) > 49 + 24.1);
    assert.equal(f.state.stopReason, 'complete');
    const end = w.position.clone();
    f.tick();
    assert.deepEqual(w.position, end);
  }
});
