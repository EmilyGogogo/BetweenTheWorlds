import assert from 'node:assert/strict';
import test from 'node:test';
import { characters } from '../../src/content/characters.js';
import { clues } from '../../src/content/clues.js';
import { habitats, species } from '../../src/content/fauna.js';
import {
  isSpecialty,
  noteFor,
  observeRange,
  perceives,
} from '../../src/core/observation.js';

const FOCI = ['insect', 'bird', 'weather', 'track', 'plant'];
const REACTIONS = [
  'flee',
  'withdraw',
  'curl',
  'burrow',
  'freeze',
  'flutter',
  'fly',
  'warn',
  'tame',
  'ignore',
];
const byId = Object.fromEntries(characters.map((c) => [c.id, c]));

test('every character is complete enough to bind interaction logic', () => {
  assert.equal(new Set(characters.map((c) => c.id)).size, characters.length);
  for (const c of characters) {
    for (const field of [
      'name',
      'background',
      'personality',
      'habit',
      'preference',
      'flaw',
    ])
      assert.ok(c[field], `${c.id}.${field}`);
    assert.ok(c.ability.key && c.ability.name && c.ability.description, c.id);
    assert.ok(c.focus.length && c.focus.every((f) => FOCI.includes(f)), c.id);
    for (const trait of [
      'speed',
      'presence',
      'sneak',
      'farSight',
      'focusRange',
    ])
      assert.equal(typeof c.traits[trait], 'number', `${c.id}.${trait}`);
  }
  // 每个视角都有人负责，能力互不重复。
  assert.deepEqual(
    [...new Set(characters.flatMap((c) => c.focus))].sort(),
    [...FOCI].sort(),
  );
  assert.equal(
    new Set(characters.map((c) => c.ability.key)).size,
    characters.length,
  );
});

test('animal data is wired to known behaviours and habitats', () => {
  for (const [key, s] of Object.entries(species)) {
    assert.ok(REACTIONS.includes(s.temperament.reaction), key);
    assert.ok(s.notes.common, key);
    assert.ok(
      s.affinity.every((f) => FOCI.includes(f)),
      key,
    );
  }
  for (const h of habitats) assert.ok(species[h.species], h.species);
});

test('each character reads something different about the same animal', () => {
  for (const [key, s] of Object.entries(species)) {
    const texts = characters.map((c) => noteFor(s, c).text);
    assert.equal(new Set(texts).size, characters.length, key);
  }
});

test('clues are noticed only from matching perspectives', () => {
  for (const [key, clue] of Object.entries(clues)) {
    assert.ok(
      Object.keys(clue.notes).every((f) => FOCI.includes(f)),
      key,
    );
    assert.ok(
      characters.some((c) => perceives(clue, c)),
      `${key} unseen`,
    );
  }
  for (const c of characters) {
    const seen = Object.values(clues).filter((clue) => perceives(clue, c));
    assert.ok(seen.length >= 3, `${c.id} only notices ${seen.length}`);
  }
  // 同一棵老树，昆虫与鸟类视角看到的东西不同；足迹视角看不到天上的云。
  assert.notEqual(
    noteFor(clues.oldTree, byId.he).text,
    noteFor(clues.oldTree, byId.que).text,
  );
  assert.equal(perceives(clues.cloudTower, byId.man), false);
  assert.equal(perceives(clues.cloudTower, byId.lan), true);
});

test('behaviour state adds what the person sees right now', () => {
  const plain = noteFor(species.hedgehog, byId.he).text;
  const curled = noteFor(species.hedgehog, byId.he, 'curled').text;
  assert.ok(curled.startsWith(plain) && curled.length > plain.length);
  assert.equal(noteFor(species.hedgehog, byId.he, 'wander').text, plain);
});

test('specialty, eyesight and binoculars change how far a person can observe', () => {
  const fowl = species.guineafowl;
  assert.ok(isSpecialty(fowl, byId.que) && !isSpecialty(fowl, byId.he));
  assert.ok(observeRange(fowl, byId.que) > observeRange(fowl, byId.mu));
  // 阿禾近视：远距离的观察范围被压缩。
  assert.ok(
    observeRange(species.meerkat, byId.he) <
      observeRange(species.meerkat, byId.mu),
  );
  assert.ok(
    observeRange(fowl, byId.que, { binoculars: true }) >
      observeRange(fowl, byId.que) * 4,
  );
  assert.ok(
    observeRange(clues.raptor, byId.que) > observeRange(clues.raptor, byId.lan),
  );
});
