import { descriptions } from '../content/worlds.js';

// Entities own their transforms; changing bodies never teleports the old body.
export function prepareEntities(world, ground) {
  const defaults = descriptions[world.index];
  const make = (object, name, options = {}) => ({
    ...defaults,
    object,
    name,
    kind: 'object',
    ground,
    range: defaults.distance * 2.4,
    ...options,
  });
  world.entities ||= [];
  // World animation and input must refer to the same entity. Copying entries
  // would let an animal's autonomous update overwrite the player's movement.
  for (const entry of world.entities)
    Object.assign(entry, make(entry.object, entry.name, entry));
  world.original = make(world.avatar, defaults.name, {
    kind: ['grass', 'human', 'island', 'planet'][world.index],
    ...world.primary,
  });
  world.entities.unshift(world.original);
  for (const talker of world.talkers) {
    if (!talker.embodiment) continue;
    if (world.entities.some((entry) => entry.object === talker.object))
      continue;
    world.entities.push(make(talker.object, talker.name, talker.embodiment));
  }
  for (const recruit of world.recruitables) {
    const entity = world.entities.find((e) => e.object === recruit.object);
    recruit.entity =
      entity || make(recruit.object, '一株草', { kind: 'grass' });
    if (!entity) world.entities.push(recruit.entity);
  }
  world.followLeader = world.original;
  inhabit(world, world.original);
}

export function inhabit(world, entity) {
  if (!world.entities.includes(entity)) return false;
  const follower = world.followers.find((p) => p.object === entity.object);
  if (follower) {
    follower.joined = false;
    world.followers.splice(world.followers.indexOf(follower), 1);
  }
  world.controlled = entity;
  world.avatar = entity.object;
  world.position = entity.object.position;
  if (entity.kind === 'grass' || entity.kind === 'island')
    world.followLeader = entity;
  return true;
}

export function nearbyEntities(world) {
  return world.entities
    .filter(
      (entry) =>
        entry !== world.controlled &&
        entry.object.position.distanceTo(world.position) < entry.range,
    )
    .sort(
      (a, b) =>
        a.object.position.distanceToSquared(world.position) -
        b.object.position.distanceToSquared(world.position),
    );
}

// Selection uses the same candidate for the ripple and R. It never selects an
// offscreen body or silently falls back to a distant original body.
export function findSoulTarget(world, project, previous = null) {
  let selected = null;
  let bestScore = Infinity;
  for (const entity of world.entities) {
    if (entity === world.controlled) continue;
    const distance = entity.object.position.distanceTo(world.position);
    if (distance > entity.range) continue;
    const point = project(entity);
    if (!point || point.z < -1 || point.z > 1) continue;
    if (Math.abs(point.x) > 0.88 || Math.abs(point.y) > 0.78) continue;
    const aim = Math.hypot(point.x, point.y * 0.7);
    const score =
      distance / Math.max(1, world.controlled.distance) +
      aim * 2 -
      (entity === previous ? 0.35 : 0);
    if (score < bestScore) {
      bestScore = score;
      selected = entity;
    }
  }
  return selected;
}
