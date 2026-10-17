import assert from 'node:assert/strict';
import test from 'node:test';
import { species } from '../../src/content/fauna.js';
import { rng } from '../../src/core/random.js';
import {
  alertRadius,
  createAnimal,
  respond,
  startle,
  stepAnimal,
  stepWildlife,
} from '../../src/core/wildlife.js';

const observer = (overrides = {}) => ({
  x: 0,
  z: 0,
  moving: true,
  presence: 1,
  wind: null,
  lure: false,
  ...overrides,
});
const spawn = (kind, x, z, random = rng(7)) =>
  createAnimal(0, kind, x, z, { x, z }, random);
const temperament = (kind) => species[kind].temperament;
const distance = (a, o) => Math.hypot(a.x - o.x, a.z - o.z);
function run(a, o, seconds, random = rng(3)) {
  for (let t = 0; t < seconds; t += 0.05)
    stepAnimal(a, temperament(a.species), o, 0.05, random);
}

test('a hare bolts from a walking person and ends up farther away', () => {
  const o = observer(),
    hare = spawn('hare', 0, 6);
  run(hare, o, 0.1);
  assert.equal(hare.state, 'flee');
  run(hare, o, 3);
  assert.ok(distance(hare, o) > 12, `hare only reached ${distance(hare, o)}`);
});

test('moving quietly lets a person stand closer before the hare reacts', () => {
  const loud = observer({ presence: 1.35 }),
    quiet = observer({ presence: 0.5, moving: false });
  const hareA = spawn('hare', 0, 6),
    hareB = spawn('hare', 0, 6);
  run(hareA, loud, 0.1);
  run(hareB, quiet, 0.1);
  assert.equal(hareA.state, 'flee');
  assert.notEqual(hareB.state, 'flee');
});

test('a tortoise withdraws in place and only re-emerges after the person leaves', () => {
  const tortoise = spawn('tortoise', 0, 1.5),
    near = observer(),
    start = { x: tortoise.x, z: tortoise.z };
  run(tortoise, near, 2);
  assert.equal(tortoise.state, 'withdrawn');
  assert.deepEqual({ x: tortoise.x, z: tortoise.z }, start);
  const far = observer({ z: 30 });
  run(tortoise, far, temperament('tortoise').calmAfter - 1);
  assert.equal(tortoise.state, 'withdrawn');
  run(tortoise, far, 2);
  assert.notEqual(tortoise.state, 'withdrawn');
});

test('a curled hedgehog relaxes when the person keeps still at a distance', () => {
  const hedgehog = spawn('hedgehog', 0, 2.5);
  run(hedgehog, observer(), 0.2);
  assert.equal(hedgehog.state, 'curled');
  run(hedgehog, observer({ moving: false }), 7);
  assert.notEqual(hedgehog.state, 'curled');
});

test('one alarmed meerkat sends the whole group into the burrow', () => {
  const random = rng(11),
    home = { x: 0, z: 0 };
  const group = [0, 1, 2].map((i) =>
    createAnimal(i, 'meerkat', i * 0.8, 1, home, random),
  );
  // 只有第一只在人的警戒范围内。
  const o = observer({ x: 0, z: -4 });
  group[1].x = 6;
  group[2].x = -6;
  group[1].z = group[2].z = 5;
  stepWildlife(group, species, o, 0.05, random, 200);
  assert.ok(group.every((m) => m.state === 'flee'));
  for (let t = 0; t < 4; t += 0.05)
    stepWildlife(group, species, o, 0.05, random, 200);
  assert.ok(group.every((m) => m.hidden));
});

test('scent carries downwind: animals notice a person upwind from farther away', () => {
  const hare = spawn('hare', 0, 10),
    t = temperament('hare');
  const upwind = alertRadius(t, observer({ wind: { x: 0, z: 1 } }), hare);
  const downwind = alertRadius(t, observer({ wind: { x: 0, z: -1 } }), hare);
  assert.ok(upwind > downwind * 1.5);
  // 鸟类不靠嗅觉，风向不影响。
  const fowl = spawn('guineafowl', 0, 10),
    g = temperament('guineafowl');
  assert.equal(
    alertRadius(g, observer({ wind: { x: 0, z: 1 } }), fowl),
    alertRadius(g, observer({ wind: { x: 0, z: -1 } }), fowl),
  );
});

test('herb scent draws grazers closer but they stop short of their alert distance', () => {
  const o = observer({ moving: false, lure: true }),
    hare = spawn('hare', 0, 15);
  run(hare, o, 30);
  const d = distance(hare, o);
  assert.ok(d < 6, `hare stayed at ${d}`);
  assert.ok(d > alertRadius(temperament('hare'), o, hare));
  assert.notEqual(hare.state, 'flee');
});

test('a sudden noise startles each species in its own way', () => {
  const random = rng(5);
  const hare = spawn('hare', 2, 2),
    tortoise = spawn('tortoise', 2, 0),
    beetle = spawn('beetle', 1, 0);
  assert.ok(startle(hare, temperament('hare'), 0, 0, 12, random));
  assert.equal(hare.state, 'flee');
  assert.ok(startle(tortoise, temperament('tortoise'), 0, 0, 12, random));
  assert.equal(tortoise.state, 'withdrawn');
  assert.equal(startle(beetle, temperament('beetle'), 0, 0, 12, random), false);
  const far = spawn('hare', 40, 0);
  assert.equal(startle(far, temperament('hare'), 0, 0, 12, random), false);
});

test('a butterfly only visits a quiet, still hand', () => {
  const t = temperament('butterfly');
  const restless = spawn('butterfly', 1, 1);
  assert.equal(
    respond(restless, t, observer({ moving: true }), { canHost: true }),
    null,
  );
  const shy = spawn('butterfly', 1, 1);
  assert.equal(
    respond(shy, t, observer({ moving: false }), { canHost: false }),
    null,
  );
  const calm = spawn('butterfly', 1, 1);
  assert.equal(
    respond(calm, t, observer({ moving: false }), { canHost: true }),
    'visit',
  );
  // 人一走动，蝴蝶就离开。
  stepAnimal(calm, t, observer({ moving: true }), 0.05, rng(1));
  assert.notEqual(calm.state, 'visit');
});

test('animals never wander beyond the world limit while fleeing', () => {
  const hare = spawn('hare', 0, 95);
  for (let t = 0; t < 10; t += 0.05)
    stepAnimal(
      hare,
      temperament('hare'),
      observer({ z: 90 }),
      0.05,
      rng(9),
      100,
    );
  assert.ok(Math.hypot(hare.x, hare.z) <= 100.001);
});

test('a zebra herd stares at you first, then the whole herd bolts', () => {
  const random = rng(4),
    herd = [0, 1, 2].map((i) =>
      createAnimal(i, 'zebra', i * 2, 20, { x: 2, z: 20 }, random),
    );
  // 远处站着不动：只是被盯着看，没有跑。
  const far = observer({ z: 20 - 12, moving: false });
  stepWildlife(herd, species, far, 0.05, random, 200);
  assert.ok(herd.every((z) => z.state === 'alert'));
  // 大步走近，其中一匹先跑，全群跟着跑。
  const near = observer({ x: 0, z: 20 - 9 });
  stepWildlife(herd, species, near, 0.05, random, 200);
  assert.ok(herd.every((z) => z.state === 'flee'));
});

test('an elephant warns before leading her calf away, and never comes at you', () => {
  const random = rng(6),
    mother = createAnimal(0, 'elephant', 0, 14, { x: 0, z: 14 }, random),
    calf = createAnimal(1, 'elephant', 1, 15, { x: 1, z: 15 }, random);
  calf.leader = mother;
  const herd = [mother, calf],
    o = observer({ z: 2 });
  stepWildlife(herd, species, o, 0.05, random, 200);
  assert.equal(mother.state, 'warn');
  const warned = distance(mother, o);
  // 你继续往前走：她转身走开，小象跟着她。
  o.z = 8;
  let closest = Infinity;
  for (let t = 0; t < 8; t += 0.05) {
    stepWildlife(herd, species, o, 0.05, random, 200);
    closest = Math.min(closest, distance(mother, o));
  }
  assert.ok(closest > 4, `she came within ${closest} m`);
  assert.ok(distance(mother, o) > warned - 6);
  assert.ok(distance(mother, calf) < 4, 'the calf stayed with her');
  // 突如其来的声响也只会让她张耳警告，而不是冲过来。
  const calm = spawn('elephant', 0, 10);
  assert.equal(startle(calm, temperament('elephant'), 0, 0, 40, random), true);
  assert.equal(calm.state, 'warn');
});

test('goats keep up with their herder and come to sniff a still hand', () => {
  const random = rng(2),
    herder = { x: 0, z: 0 },
    goat = createAnimal(0, 'goat', 0, 0, { x: 0, z: 0 }, random);
  goat.leader = herder;
  for (let t = 0; t < 40; t += 0.05) {
    herder.x += 0.7 * 0.05;
    stepWildlife([goat], species, observer({ x: 500 }), 0.05, random, 200);
  }
  assert.ok(
    distance(goat, herder) < 6,
    `goat ${distance(goat, herder)} m back`,
  );
  // 安静地站在羊旁边：它不会逃，过一会儿凑过来闻你。
  const still = observer({ x: goat.x + 3, z: goat.z, moving: false });
  let curious = false;
  for (let t = 0; t < 30 && !curious; t += 0.05) {
    stepWildlife([goat], species, still, 0.05, random, 200);
    assert.notEqual(goat.state, 'flee');
    curious = goat.state === 'curious';
  }
  assert.ok(curious);
  assert.equal(
    startle(goat, temperament('goat'), still.x, still.z, 12, random),
    false,
  );
});

test('startled weavers fly up and settle back near their tree', () => {
  const random = rng(3),
    home = { x: 0, z: 10 },
    flock = [0, 1, 2, 3].map((i) =>
      createAnimal(i, 'weaver', i * 0.5, 10, home, random),
    );
  const o = observer({ z: 10 - 2.5 });
  stepWildlife(flock, species, o, 0.05, random, 200);
  assert.ok(flock.every((b) => b.state === 'flee'));
  for (let t = 0; t < 3; t += 0.05)
    stepWildlife(flock, species, observer({ x: 300 }), 0.05, random, 200);
  for (const bird of flock)
    assert.ok(distance(bird, home) <= temperament('weaver').homeRadius + 0.01);
});

test('a chameleon stays on its bush however close you come', () => {
  const random = rng(1),
    chameleon = spawn('chameleon', 0, 0, random);
  for (let t = 0; t < 20; t += 0.05)
    stepAnimal(
      chameleon,
      temperament('chameleon'),
      observer({ x: 0.5 }),
      0.05,
      random,
    );
  assert.ok(Math.hypot(chameleon.x, chameleon.z) <= 0.25);
  assert.equal(
    respond(
      spawn('chameleon', 0, 0),
      temperament('chameleon'),
      observer({ x: 5 }),
    ),
    'display',
  );
});
