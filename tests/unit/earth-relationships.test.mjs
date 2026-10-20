import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../vendor/three.module.js';
import { createEarth, withCanvas } from '../helpers/earth-fixture.mjs';
import { movingEarth } from '../helpers/earth-movement.mjs';
import { createWorldTools } from '../../src/worlds/shared.js';
import { makeSpace } from '../../src/worlds/space.js';
import { createMoonSunRelationship } from '../../src/worlds/earth-relationships.js';
import { installEarthActions } from '../../src/worlds/earth-actions.js';
import { prepareEntities, inhabit } from '../../src/core/embodiment.js';
import { performPrimaryAction } from '../../src/core/world-actions.js';

const solo = '光沿着你的边缘，慢慢展开。';
const duet = '这一次，光也照见了你的同行者。';
const running = {
  dt: 0.05,
  canInteract: true,
  canSimulate: true,
  reducedMotion: false,
};
const paused = { ...running, canInteract: false, canSimulate: false };
const reduced = { ...running, reducedMotion: true };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const relationshipState = (w) => w.earthState.relationships.moonSun;
const sun = (w) => w.earthActions.sun;
function tick(w, seconds, context = running) {
  for (let remaining = seconds; remaining > 1e-9; remaining -= context.dt)
    w.update({ ...context, dt: Math.min(remaining, context.dt) });
}
function invite(w) {
  w.position.copy(w.moon.position);
  assert.equal(
    w.earthActions.moon.onPrimaryAction(running),
    '月亮，与你同行。',
  );
}
function approach(w) {
  w.position.copy(w.sunBody.position);
  w.position.y -= 65;
}
function startDuet(w, context = running) {
  invite(w);
  approach(w);
  assert.equal(w.getPrimaryAction(context).label, '与月亮回应光芒');
  assert.equal(w.onPrimaryAction(context), duet);
}
function colorSnapshot(material) {
  return [material.emissive.toArray(), material.emissiveIntensity];
}
function resources(w) {
  const result = {
    objects: new Set(),
    geometry: new Set(),
    materials: new Set(),
    textures: new Set(),
  };
  w.scene.traverse((o) => {
    result.objects.add(o);
    if (o.geometry) result.geometry.add(o.geometry);
    for (const m of o.material ? [o.material].flat() : []) {
      result.materials.add(m);
      for (const v of Object.values(m))
        if (v?.isTexture) result.textures.add(v);
      for (const u of Object.values(m.uniforms ?? {}))
        if (u.value?.isTexture) result.textures.add(u.value);
    }
  });
  return result;
}

test('V4-L1/L2 real invitation selects duet, invitable does not disable it and queries are pure', () => {
  const w = createEarth();
  // Put the uninvited Moon near Earth and Sun to exercise genuine overlap.
  approach(w);
  w.moon.position.copy(w.position);
  assert.equal(sun(w).getPrimaryAction(running).label, '回应光芒');
  const before = structuredClone(w.earthState);
  const material = colorSnapshot(w.moon.material);
  for (let i = 0; i < 20; i++) sun(w).getPrimaryAction(running);
  assert.deepEqual(w.earthState, before);
  assert.deepEqual(colorSnapshot(w.moon.material), material);
  assert.equal(w.onPrimaryAction(running), '月亮，与你同行。');
  w.earthState.moon.invitable = false;
  const after = structuredClone(w.earthState);
  for (let i = 0; i < 20; i++)
    assert.equal(w.getPrimaryAction(running).label, '与月亮回应光芒');
  assert.deepEqual(w.earthState, after);
  assert.equal(w.onPrimaryAction(running), duet);
  assert.equal(w.earthState.sun.responseId, 1);
  for (let i = 0; i < 20; i++)
    assert.equal(sun(w).onPrimaryAction(running), null);
  assert.equal(w.earthState.sun.responseId, 1);
  assert.equal(
    performPrimaryAction({
      active: 3,
      world: w,
      context: running,
      repeat: true,
    }),
    null,
  );
  assert.equal(relationshipState(w).hasCompleted, false);
});

test('V4-L2 stale duet prompt falls back to solo and cannot mutate or invent Moon', () => {
  const w = createEarth();
  invite(w);
  approach(w);
  assert.equal(w.getPrimaryAction(running).label, '与月亮回应光芒');
  const moon = w.moon;
  moon.removeFromParent();
  const refs = resources(w);
  assert.equal(w.onPrimaryAction(running), solo);
  assert.equal(w.earthState.sun.variant, 'solo');
  assert.equal(moon.parent, null);
  assert.deepEqual(resources(w), refs);
  tick(w, 3);
  assert.equal(relationshipState(w).hasCompleted, false);
});

test('V4-L3 inviting Moon during solo never upgrades the locked response', () => {
  const w = createEarth();
  approach(w);
  assert.equal(w.onPrimaryAction(running), solo);
  tick(w, 0.5);
  // Test-only layout brings the original Moon within invitation range.
  w.moon.position.copy(w.position);
  assert.equal(w.onPrimaryAction(running), '月亮，与你同行。');
  const base = colorSnapshot(w.moon.material);
  tick(w, 2.5);
  assert.equal(w.earthState.sun.variant, 'solo');
  assert.deepEqual(colorSnapshot(w.moon.material), base);
  assert.equal(relationshipState(w).hasCompleted, false);
  tick(w, 5);
  assert.equal(w.onPrimaryAction(running), duet);
  tick(w, 3);
  assert.equal(relationshipState(w).hasCompleted, true);
});

test('V4-L4/L5 one Sun envelope drives Moon and only natural completion sets memory', () => {
  for (const dt of [0.01, 0.025, 0.05]) {
    const w = createEarth();
    const base = colorSnapshot(w.moon.material);
    startDuet(w);
    const warm = new THREE.Color('#efc58b');
    tick(w, 1.5, { ...running, dt });
    const view = sun(w).getResponseView(false);
    close(view.weight, 1);
    for (const channel of ['r', 'g', 'b'])
      close(w.moon.material.emissive[channel], warm[channel] * 1.2);
    close(w.sunHalo.scale.x, 1.08);
    assert.equal(relationshipState(w).hasCompleted, false);
    tick(w, 1.48, { ...running, dt });
    w.update(running);
    assert.equal(w.earthState.sun.status, 'cooldown');
    close(w.earthState.sun.remaining, 4.97);
    assert.equal(relationshipState(w).hasCompleted, true);
    const end = w.earthState.sun.lastEnd;
    assert.deepEqual(end, { id: 1, variant: 'moon-duet', reason: 'complete' });
    assert.deepEqual(colorSnapshot(w.moon.material), base);
    tick(w, 4.97);
    assert.equal(w.earthState.sun.status, 'ready');
    assert.equal(w.earthState.sun.lastEnd, end);
    assert.equal(relationshipState(w).hasCompleted, true);
  }
});

test('V4-L5 outer cancellation and explicit disable never count as completion; history survives', () => {
  for (const priorCompletion of [false, true]) {
    for (const reason of ['out-of-range', 'disabled']) {
      const w = createEarth();
      startDuet(w);
      if (priorCompletion) {
        tick(w, 8);
        assert.equal(w.onPrimaryAction(running), duet);
      }
      tick(w, 1);
      if (reason === 'out-of-range') {
        w.position.copy(w.sunBody.position);
        w.position.z += 150.001;
        w.update(running);
        assert.equal(w.earthState.sun.remaining, 5);
      } else {
        sun(w).setEnabled(false);
        // Sun's internal API has no callback into the independent partner.
        assert.ok(w.moon.material.emissive.r > 0);
        w.update(paused);
      }
      assert.equal(w.earthState.sun.lastEnd.reason, reason);
      assert.equal(relationshipState(w).hasCompleted, priorCompletion);
      assert.deepEqual(colorSnapshot(w.moon.material), [[0, 0, 0], 1]);
    }
  }
});

test('V4-L6 nondefault emissive restores exactly through 100 responses with stable resource and entity references', () => {
  const w = withCanvas(() => {
    const tools = createWorldTools({
      capabilities: { getMaxAnisotropy: () => 8 },
    });
    return makeSpace({
      ...tools,
      mat: (color, options) =>
        tools.mat(color, {
          ...options,
          emissive: '#123456',
          emissiveIntensity: 2.4,
        }),
    });
  });
  prepareEntities(w, null);
  const material = w.moon.material;
  const emissive = material.emissive;
  const tint = material.color;
  const baseTint = tint.clone();
  const base = colorSnapshot(material);
  const container = w.earthState;
  const states = { ...container };
  const entities = [...w.entities];
  const talkers = [...w.talkers];
  const refs = resources(w);
  assert.equal(entities.length, 4);
  assert.equal(talkers.length, 3);
  assert.equal(refs.textures.size, 9);
  invite(w);
  approach(w);
  for (let cycle = 0; cycle < 100; cycle++) {
    assert.equal(w.onPrimaryAction(reduced), duet);
    for (const [index, channel] of ['r', 'g', 'b'].entries())
      close(
        emissive[channel],
        base[0][index] * base[1] +
          new THREE.Color('#efc58b')[channel] * 1.2 * 0.35,
      );
    assert.deepEqual(
      tint,
      baseTint.clone().lerp(new THREE.Color('#efc58b'), 0.55 * 0.35),
    );
    tick(w, 8, reduced);
    assert.deepEqual(tint, baseTint);
    assert.equal(material.color, tint);
    assert.equal(w.earthState.sun.status, 'ready');
    assert.deepEqual(colorSnapshot(material), base);
    assert.equal(material.emissive, emissive);
    assert.deepEqual(resources(w), refs);
    assert.deepEqual(w.entities, entities);
    assert.deepEqual(w.talkers, talkers);
  }
  assert.equal(w.earthState, container);
  for (const name of Object.keys(states))
    assert.equal(w.earthState[name], states[name]);
  assert.equal(relationshipState(w).hasCompleted, true);
});

test('V4-L7 paused faults restore the captured material and never rejoin the same response', () => {
  const faults = {
    detach: (w) => {
      const moon = w.moon;
      moon.removeFromParent();
      return () => w.scene.add(moon);
    },
    hidden: (w) => {
      w.moon.visible = false;
      return () => {
        w.moon.visible = true;
      };
    },
    sceneHidden: (w) => {
      w.scene.visible = false;
      return () => {
        w.scene.visible = true;
      };
    },
    reference: (w) => {
      const moon = w.moon;
      w.moon = new THREE.Object3D();
      return () => {
        w.moon = moon;
      };
    },
    material: (w) => {
      const old = w.moon.material;
      const replacement = new THREE.MeshStandardMaterial({
        emissive: '#ff0022',
        emissiveIntensity: 0.7,
      });
      w.moon.material = replacement;
      const snap = colorSnapshot(replacement);
      return () => {
        assert.deepEqual(colorSnapshot(replacement), snap);
        assert.equal(w.moon.material, replacement);
        w.moon.material = old;
      };
    },
  };
  for (const fault of Object.values(faults)) {
    const w = createEarth();
    const material = w.moon.material;
    const base = colorSnapshot(material);
    const tint = material.color.clone();
    startDuet(w);
    tick(w, 0.5);
    assert.notDeepEqual(colorSnapshot(material), base);
    const undo = fault(w);
    const remaining = w.earthState.sun.remaining;
    w.update(paused);
    assert.deepEqual(colorSnapshot(material), base);
    assert.deepEqual(material.color, tint);
    assert.equal(w.earthState.sun.remaining, remaining);
    undo();
    w.update(paused);
    tick(w, 2.5);
    assert.deepEqual(colorSnapshot(material), base);
    assert.equal(relationshipState(w).hasCompleted, false);
    tick(w, 5);
    assert.equal(w.onPrimaryAction(running), duet);
    tick(w, 3);
    assert.equal(relationshipState(w).hasCompleted, true);
  }
});

test('V4-L7 all Sun availability faults clean Moon while paused and preserve completion semantics', () => {
  for (const fault of [
    (w) => w.sunBody.removeFromParent(),
    (w) => {
      w.sunBody.visible = false;
    },
    (w) => {
      w.sunBody = new THREE.Group();
    },
  ]) {
    const w = createEarth();
    startDuet(w);
    tick(w, 0.5);
    fault(w);
    w.update(paused);
    assert.equal(w.earthState.sun.lastEnd.reason, 'disabled');
    assert.deepEqual(colorSnapshot(w.moon.material), [[0, 0, 0], 1]);
    assert.equal(relationshipState(w).hasCompleted, false);
  }
});

test('V4-L8 pause, omitted inactive frames and invalid dt never advance, fresh worlds are independent', () => {
  const w = createEarth();
  startDuet(w);
  tick(w, 0.7);
  const state = structuredClone(w.earthState);
  const color = colorSnapshot(w.moon.material);
  for (let i = 0; i < 100; i++) w.update(paused);
  for (const dt of [0, -1, NaN, Infinity]) w.update({ ...running, dt });
  assert.deepEqual(w.earthState, state);
  assert.deepEqual(colorSnapshot(w.moon.material), color);
  // Inactive worlds receive no updates; resumption only consumes supplied dt.
  const fresh = createEarth();
  assert.notEqual(fresh.earthState.relationships, w.earthState.relationships);
  assert.equal(relationshipState(fresh).hasCompleted, false);
  assert.equal(fresh.earthState.moon.status, 'available');
  assert.equal(fresh.earthState.sun.responseId, 0);
  w.update(running);
  close(w.earthState.sun.remaining, state.sun.remaining - 0.05);
  tick(w, 2.25);
  assert.equal(relationshipState(w).hasCompleted, true);
});

test('V4-L9 reduced motion paints immediately, remains steady while following actual movement, then restores', () => {
  const w = createEarth();
  startDuet(w, reduced);
  const phase = w.earthState.moon.phase;
  // The Moon orbit first recenters on the Sun-side player position on update.
  w.update({ ...reduced, dt: 0 });
  const offset = w.moon.position.clone().sub(w.position);
  const color = colorSnapshot(w.moon.material);
  assert.ok(color[0][0] > 0);
  assert.equal(w.earthState.sun.remaining, 3);
  for (const position of [
    [-100, 0, -100],
    [-90, 0, -90],
    [-80, 0, -110],
  ]) {
    w.position.set(...position);
    w.update(reduced);
    assert.equal(w.earthState.moon.phase, phase);
    assert.deepEqual(w.moon.position.clone().sub(w.position), offset);
    assert.deepEqual(colorSnapshot(w.moon.material), color);
    assert.deepEqual(w.sunHalo.scale.toArray(), [1, 1, 1]);
  }
  tick(w, 2.85, reduced);
  assert.equal(relationshipState(w).hasCompleted, true);
  assert.deepEqual(colorSnapshot(w.moon.material), [[0, 0, 0], 1]);
});

test('V4-L3/L8 R body identities reject duet, drop an active partner and never rejoin that id', () => {
  for (const kind of ['sun', 'moon', 'planet']) {
    const w = createEarth();
    prepareEntities(w, null);
    startDuet(w, reduced);
    const original = w.original;
    const other = w.entities.find((e) => e !== original && e.kind === kind);
    assert.ok(other);
    const remaining = w.earthState.sun.remaining;
    assert.equal(inhabit(w, other), true);
    // R immediately after E, before the first simulation frame.
    w.update(paused);
    assert.equal(w.earthState.sun.remaining, remaining);
    assert.deepEqual(colorSnapshot(w.moon.material), [[0, 0, 0], 1]);
    // Use live proximity for a ready Sun after this response; identity, not
    // distance or kind, prevents a planet body being mistaken for original Earth.
    assert.equal(inhabit(w, original), true);
    w.update(paused);
    tick(w, 3, reduced);
    assert.equal(relationshipState(w).hasCompleted, false);
    tick(w, 5, reduced);
    assert.equal(w.getPrimaryAction(reduced).label, '与月亮回应光芒');
    assert.equal(inhabit(w, other), true);
    approach(w);
    assert.equal(sun(w).getPrimaryAction(reduced).label, '回应光芒');
    assert.equal(sun(w).onPrimaryAction(reduced), solo);
    assert.equal(w.earthState.sun.variant, 'solo');
  }
});

test('V4-L8 relationship initialization merges existing state and captures original Earth before R', () => {
  const w = createEarth();
  const state = w.earthState;
  const originalRelationship = relationshipState(w);
  const otherRelationship = { retained: true };
  w.earthState.relationships.other = otherRelationship;
  const refs = resources(w);
  const rel = createMoonSunRelationship(w, w.moon);
  assert.equal(w.earthState, state);
  assert.equal(relationshipState(w), originalRelationship);
  assert.equal(w.earthState.relationships.other, otherRelationship);
  assert.deepEqual(resources(w), refs);
  assert.equal(rel.selectVariant(running), null);
  invite(w);
  assert.equal(rel.selectVariant(paused), null);
  assert.equal(rel.selectVariant(running).id, 'moon-duet');
  prepareEntities(w, null);
  assert.equal(rel.selectVariant(running).id, 'moon-duet');
  const ring = w.entities.find((e) => e !== w.original && e.kind === 'planet');
  inhabit(w, ring);
  assert.equal(rel.selectVariant(running), null);
});

test('V4-L10 update order, dt=0 action sync and optional relationship retain old callers', () => {
  const calls = [];
  const context = { ...running, dt: 0.04 };
  const view = { responding: true };
  const handler = (name) => ({
    getPrimaryAction: () => (name === 'sun' ? { label: name } : null),
    onPrimaryAction: () => name,
    update: (ctx) => calls.push([name, ctx.dt]),
  });
  const moon = handler('moon'),
    solar = handler('sun'),
    ring = handler('ring');
  solar.getResponseView = (reducedMotion) => {
    assert.equal(reducedMotion, false);
    return view;
  };
  const rel = {
    update: (ctx, actual) => {
      assert.equal(actual, view);
      calls.push(['relationship', ctx.dt]);
    },
  };
  const world = {};
  installEarthActions(world, moon, solar, ring, {
    relationship: rel,
    visualUpdate: (ctx) => calls.push(['visual', ctx.dt]),
  });
  assert.equal(world.onPrimaryAction(context), 'sun');
  assert.deepEqual(calls, [['relationship', 0]]);
  assert.equal(context.dt, 0.04);
  calls.length = 0;
  world.update(context);
  assert.deepEqual(calls, [
    ['ring', 0.04],
    ['moon', 0.04],
    ['sun', 0.04],
    ['relationship', 0.04],
    ['visual', 0.04],
  ]);
  // Legacy stubs have no view method and must not need one without a partner.
  delete solar.getResponseView;
  installEarthActions(world, moon, solar);
  calls.length = 0;
  assert.equal(world.onPrimaryAction(context), 'sun');
  world.update(context);
  assert.deepEqual(calls, [
    ['moon', 0.04],
    ['sun', 0.04],
  ]);
});

test('V4-L11 actual traction displacement crosses Sun outer range without changing budgets or priority', () => {
  const f = movingEarth();
  const w = f.world;
  invite(w);
  // Explicit test layout: a safe +X pull crosses 150 from the relocated Sun.
  // This is a trigger fixture, not a claim about the default route.
  w.position.set(0, 0, 0);
  w.sunBody.position.set(-149.8, 0, 0);
  // Begin inside the action range, then move to just inside the cancel edge.
  w.position.set(-60, 0, 0);
  assert.equal(f.action(), duet);
  w.position.set(0, 0, 0);
  w.ringedPlanet.position.set(100, 40, 0);
  assert.equal(f.action(), '星环亮起，与你回应。');
  const result = f.tick();
  assert.equal(result.accepted, true);
  close(w.position.x, 0.9);
  close(f.state.spent, 0.9);
  close(f.state.elapsed, 0.05);
  assert.equal(f.state.status, 'pulling');
  assert.equal(w.earthState.sun.status, 'cooldown');
  assert.equal(w.earthState.sun.lastEnd.reason, 'out-of-range');
  assert.equal(w.earthState.sun.remaining, 5);
  assert.equal(relationshipState(w).hasCompleted, false);
  assert.deepEqual(colorSnapshot(w.moon.material), [[0, 0, 0], 1]);
  while (f.state.status === 'pulling') f.tick();
  close(f.state.spent, 36);
  assert.equal(f.state.stopReason, 'complete');
});

test('V4-L5 ending records are consumed once, including old completion retained during the next response', () => {
  const w = createEarth();
  const state = relationshipState(w);
  let completed = false,
    writes = 0;
  Object.defineProperty(state, 'hasCompleted', {
    configurable: true,
    enumerable: true,
    get: () => completed,
    set: (value) => {
      completed = value;
      writes++;
    },
  });
  startDuet(w);
  tick(w, 3);
  assert.equal(writes, 1);
  for (let i = 0; i < 20; i++) w.update({ ...paused, dt: 0 });
  assert.equal(writes, 1);
  tick(w, 5);
  assert.equal(w.onPrimaryAction(running), duet);
  w.update(running);
  assert.equal(writes, 1);
  sun(w).setEnabled(false);
  w.update(paused);
  assert.equal(writes, 1);
  assert.equal(completed, true);
});

test('V4-L1 partner eligibility uses relation identity rather than distance to Sun', () => {
  const w = createEarth();
  invite(w);
  approach(w);
  // Eligibility is a relationship, not a second Sun proximity check on Moon.
  w.moon.position.set(1000, 5, 1000);
  assert.ok(w.moon.position.distanceTo(w.sunBody.position) > 100);
  assert.equal(w.onPrimaryAction(running), duet);
  const before = w.position.clone();
  w.update(running);
  assert.deepEqual(w.position, before);
  assert.equal(w.earthState.sun.variant, 'moon-duet');
});

test('duet now uses a clear golden tint and eightfold emissive peak while preserving textures, pause and restoration', () => {
  for (const reducedMotion of [false, true]) {
    const w = createEarth(),
      context = { ...running, reducedMotion };
    const material = w.moon.material;
    const tint = material.color,
      baseTint = tint.clone();
    const map = material.map,
      bump = material.bumpMap;
    startDuet(w, context);
    tick(w, 1.5, context);
    const weight = reducedMotion ? 0.35 : 1;
    const warm = new THREE.Color('#efc58b');
    for (const channel of ['r', 'g', 'b'])
      close(material.emissive[channel], warm[channel] * 1.2 * weight);
    const expected = baseTint.clone().lerp(warm, 0.55 * weight);
    for (const channel of ['r', 'g', 'b'])
      close(tint[channel], expected[channel]);
    assert.ok(tint.b < baseTint.b);
    const before = tint.clone(),
      light = material.emissive.clone();
    w.update({ ...context, canSimulate: false });
    assert.deepEqual(tint, before);
    assert.deepEqual(material.emissive, light);
    sun(w).setEnabled(false);
    w.update(paused);
    assert.deepEqual(tint, baseTint);
    assert.deepEqual(material.emissive.toArray(), [0, 0, 0]);
    assert.equal(material.emissiveIntensity, 1);
    assert.equal(material.color, tint);
    assert.equal(material.map, map);
    assert.equal(material.bumpMap, bump);
  }
});
