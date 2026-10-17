import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {
  prepareEntities,
  inhabit,
  nearbyEntities,
  findSoulTarget,
} from '../../src/core/embodiment.js';

test('inhabiting preserves bodies, profile, return route and follower ownership', () => {
  const grass = new THREE.Group(),
    stone = new THREE.Group(),
    other = new THREE.Group();
  stone.position.set(4, 0, -5);
  other.position.set(2, 0, 0);
  const world = {
    index: 0,
    avatar: grass,
    talkers: [
      {
        object: stone,
        name: '石头',
        embodiment: { kind: 'rock', distance: 8 },
      },
    ],
    recruitables: [{ object: other, joined: true }],
    followers: [],
  };
  prepareEntities(world, () => 0);
  const original = world.original;
  const rock = world.entities.find((entry) => entry.kind === 'rock');
  assert.equal(rock.name, '石头');
  assert.equal(rock.distance, 8);
  assert.equal(inhabit(world, rock), true);
  world.position.x += 30;
  assert.equal(stone.position.x, 34);
  assert.equal(grass.position.x, 0);
  // A remembered original body cannot be entered remotely. Walk back to it.
  assert(!nearbyEntities(world).includes(original));
  world.position.x = 4;
  assert(nearbyEntities(world).includes(original));
  const recruit = world.recruitables[0];
  world.followers.push(recruit);
  inhabit(world, recruit.entity);
  assert.equal(recruit.joined, false);
  assert.equal(world.followers.length, 0);
  assert.equal(world.followLeader, recruit.entity);
  assert.equal(inhabit(world, {}), false);
  assert.equal(world.avatar, other);
});

test('R only chooses a nearby visible body and keeps its ripple stable', () => {
  const body = new THREE.Group();
  const makeEntity = (x, range, screen) => {
    const object = new THREE.Group();
    object.position.x = x;
    return { object, range, screen };
  };
  const behind = makeEntity(1, 10, { x: 0, y: 0, z: 2 });
  const offscreen = makeEntity(2, 10, { x: 1.2, y: 0, z: 0.5 });
  const distant = makeEntity(50, 10, { x: 0, y: 0, z: 0.5 });
  const near = makeEntity(4, 10, { x: 0.1, y: 0, z: 0.5 });
  const alternative = makeEntity(4.1, 10, { x: 0.05, y: 0, z: 0.5 });
  const controlled = { object: body, distance: 5, range: 10 };
  const world = {
    controlled,
    position: body.position,
    entities: [controlled, behind, offscreen, distant, near, alternative],
  };
  const project = (entity) => entity.screen;
  assert.equal(findSoulTarget(world, project), alternative);
  assert.equal(findSoulTarget(world, project, near), near);
  near.object.position.x = 100;
  assert.equal(findSoulTarget(world, project, near), alternative);
  alternative.object.position.x = 100;
  assert.equal(findSoulTarget(world, project), null);
});

test('pre-registered wildlife keeps its identity when player control is prepared', () => {
  const bird = { object: new THREE.Group(), name: '海鸥', mode: 'fly' };
  const world = {
    index: 2,
    avatar: new THREE.Group(),
    entities: [bird],
    talkers: [],
    recruitables: [],
    followers: [],
  };
  prepareEntities(world, null);
  assert(world.entities.includes(bird));
  inhabit(world, bird);
  assert.equal(world.controlled, bird);
  world.position.x += 10;
  assert.equal(bird.object.position.x, 10);
});
