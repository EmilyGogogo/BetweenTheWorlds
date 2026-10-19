import assert from 'node:assert/strict';
import test from 'node:test';
import { characters } from '../../src/content/characters.js';
import {
  residentById,
  residents,
  stateLabels,
} from '../../src/content/residents.js';
import {
  isSpecialty,
  noteFor,
  observeRange,
} from '../../src/core/observation.js';
import { rng } from '../../src/core/random.js';
import {
  REACTION_SECONDS,
  createResident,
  respondResident,
  stepResident,
  stepResidents,
} from '../../src/core/residents.js';

const FOCI = ['insect', 'bird', 'weather', 'track', 'plant'];
const AGES = ['toddler', 'child', 'adult', 'elder'];
const FAR = { x: 500, z: 500, moving: false, presence: 1 };
const observer = (overrides = {}) => ({
  x: 0,
  z: 0,
  moving: true,
  presence: 1,
  ...overrides,
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// 跟着日程走一段时间，记录依次出现过的状态。
function live(id, seconds, o = FAR, random = rng(5)) {
  const def = residentById[id],
    r = createResident(def, random),
    seen = [r.state];
  for (let t = 0; t < seconds; t += 0.05) {
    stepResident(r, def, o, 0.05, random);
    if (seen.at(-1) !== r.state) seen.push(r.state);
  }
  return { r, def, seen };
}
// 让某人进入日程里的某个状态。
function until(id, state, random = rng(5)) {
  const def = residentById[id],
    r = createResident(def, random);
  for (let t = 0; t < 600 && r.state !== state; t += 0.05)
    stepResident(r, def, FAR, 0.05, random);
  assert.equal(r.state, state, `${id} never reached ${state}`);
  return { r, def, random };
}
const statesOf = (def) => [
  ...(def.routine ?? []).map((s) => s.as ?? s.stay ?? s.roam ?? 'walk'),
  ...Object.keys(def.reactions ?? {}),
  ...Object.values(def.reactions ?? {}),
  ...(def.follow ? ['walk', 'run', 'stand', 'squat'] : []),
];

test('every resident is wired to known ages, states, reactions and words', () => {
  assert.equal(new Set(residents.map((r) => r.id)).size, residents.length);
  for (const def of residents) {
    assert.ok(def.name && AGES.includes(def.age), def.id);
    assert.ok(def.routine || residentById[def.follow], def.id);
    assert.deepEqual(def.affinity, [], `${def.id} is nobody's specialty`);
    for (const focus of [...FOCI, 'common'])
      assert.ok(def.notes[focus], def.id);
    for (const state of new Set(statesOf(def))) {
      assert.ok(
        def.labels?.[state] ?? stateLabels[state],
        `${def.id}.${state}`,
      );
      assert.ok(def.stateNotes[state], `${def.id} has no note for ${state}`);
    }
    for (const reaction of Object.values(def.reactions)) {
      assert.ok(REACTION_SECONDS[reaction], `${def.id}: ${reaction}`);
      assert.ok(
        def.lines[reaction]?.length,
        `${def.id} says nothing on ${reaction}`,
      );
    }
  }
  // 老人、大人、孩子、幼儿都有。
  assert.deepEqual(
    [...new Set(residents.map((r) => r.age))].sort(),
    [...AGES].sort(),
  );
});

test('each character notices something different about the same person', () => {
  for (const def of residents) {
    const texts = characters.map((c) => noteFor(def, c).text);
    assert.equal(new Set(texts).size, characters.length, def.id);
    const sleeping = noteFor(def, characters[0], 'sleep');
    if (def.stateNotes.sleep)
      assert.ok(sleeping.text.endsWith(def.stateNotes.sleep));
  }
  // 人不是谁的专长：不加专长距离，只受各人的远视力影响。
  const herder = residentById.herder,
    farSighted = characters.find((c) => c.traits.farSight === 1);
  for (const c of characters) assert.equal(isSpecialty(herder, c), false);
  assert.equal(observeRange(herder, farSighted), herder.observeRange);
});

test('a herder works through the whole day and comes back to the pen', () => {
  const { r, def, seen } = live('herder', 420);
  for (const state of ['walk', 'tend', 'call', 'sit', 'doze'])
    assert.ok(seen.includes(state), `never saw ${state}: ${seen}`);
  // 坐下之后才打盹，打盹之后才起身往回走。
  assert.ok(seen.indexOf('doze') > seen.indexOf('sit'));
  // 日程会循环：回到起点附近，又开始新的一轮。
  assert.ok(seen.filter((s) => s === 'call').length >= 2, String(seen));
  assert.ok(r.step >= 0 && r.step < def.routine.length);
});

test('a walking person greets you once when you arrive, not over and over', () => {
  const { r, def, random } = until('herder', 'walk');
  const near = observer({ x: r.x + 3, z: r.z, moving: false });
  stepResident(r, def, near, 0.05, random);
  assert.equal(r.state, 'greet');
  assert.equal(r.event, 'greet');
  r.event = null;
  let greetings = 0;
  for (let t = 0; t < 60; t += 0.05) {
    near.x = r.x + 3;
    near.z = r.z;
    stepResident(r, def, near, 0.05, random);
    if (r.event) {
      greetings++;
      r.event = null;
    }
  }
  assert.equal(greetings, 0, 'kept greeting while you stood beside him');
  assert.notEqual(r.state, 'greet');
});

test('a sleeper only stirs at loud footsteps', () => {
  const { r, def, random } = until('traveler', 'sleep');
  const sneaking = observer({ x: r.x + 1.5, z: r.z, presence: 0.5 });
  for (let t = 0; t < 3; t += 0.05)
    stepResident(r, def, sneaking, 0.05, random);
  assert.equal(r.state, 'sleep');
  assert.equal(r.event, null);
  // 走远再大步回来。
  stepResident(r, def, FAR, 0.05, random);
  const loud = observer({ x: r.x + 1.5, z: r.z, presence: 1.3 });
  stepResident(r, def, loud, 0.05, random);
  assert.equal(r.state, 'stir');
  for (let t = 0; t < REACTION_SECONDS.stir + 0.2; t += 0.05)
    stepResident(r, def, FAR, 0.05, random);
  assert.equal(r.state, 'sleep', 'he went back to sleep');
  // 只是被看着，睡着的人不会醒。
  assert.equal(respondResident(r, def), null);
});

test('a painter at work ignores you but answers during a break', () => {
  const painting = until('painter', 'paint');
  assert.equal(respondResident(painting.r, painting.def), null);
  assert.equal(painting.r.state, 'paint');
  const resting = until('painter', 'stretch');
  assert.equal(respondResident(resting.r, resting.def), 'greet');
  assert.equal(resting.r.state, 'greet');
});

test('the toddler keeps up with her mother and hides behind her from strangers', () => {
  const random = rng(8),
    list = [residentById.mother, residentById.toddler].map((d) =>
      createResident(d, random),
    ),
    [mother, toddler] = list;
  let farthest = 0;
  for (let t = 0; t < 40; t += 0.05) {
    stepResidents(list, residentById, FAR, 0.05, random);
    farthest = Math.max(farthest, distance(mother, toddler));
  }
  assert.ok(farthest < 5, `toddler fell ${farthest} m behind`);
  // 你从一侧走近：她躲到妈妈的另一侧。
  const o = observer({ x: toddler.x + 3, z: toddler.z, moving: false });
  for (let t = 0; t < 3; t += 0.05) {
    o.x = mother.x + 3;
    o.z = mother.z;
    stepResidents(list, residentById, o, 0.05, random);
  }
  assert.equal(toddler.state, 'shy');
  assert.ok(toddler.x < mother.x, 'she is on the far side of her mother');
});

test('curious children come up close and then run back to play', () => {
  const { r, def, random } = until('sister', 'play');
  const o = observer({ x: r.x + 7, z: r.z, moving: false });
  stepResident(r, def, o, 0.05, random);
  assert.equal(r.state, 'curious');
  for (let t = 0; t < 4; t += 0.05) stepResident(r, def, o, 0.05, random);
  assert.ok(distance(r, o) < 2.2, `stayed ${distance(r, o)} m away`);
  for (let t = 0; t < REACTION_SECONDS.curious; t += 0.05)
    stepResident(r, def, o, 0.05, random);
  assert.notEqual(r.state, 'curious');
});
