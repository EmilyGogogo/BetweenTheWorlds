const directionKeys = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export const isMovementKey = (code) => directionKeys.has(code);
export const simulationDelta = (dt) =>
  Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0;

// The latch survives keyup, including a complete tap between two RAF callbacks.
// Help/world switching clear held keys without manufacturing an interruption.
export function createMovementInput() {
  const keys = new Set();
  const defaultOwner = {};
  const interrupted = new WeakSet();
  return {
    keys,
    keydown(code, owner = defaultOwner) {
      keys.add(code);
      if (isMovementKey(code)) interrupted.add(owner);
    },
    keyup(code) {
      keys.delete(code);
    },
    blur(owner = defaultOwner) {
      keys.clear();
      interrupted.add(owner);
    },
    finishStep(owner = defaultOwner) {
      interrupted.delete(owner);
    },
    refresh(context, limit, owner = defaultOwner) {
      context.hasMovementInput = false;
      for (const code of directionKeys)
        if (keys.has(code)) {
          context.hasMovementInput = true;
          break;
        }
      // An outgoing world's blur must survive a switch before the next RAF;
      // input in another world must not cancel a deliberately paused pull.
      context.movementInterrupted = interrupted.has(owner);
      context.movementLimit = limit;
    },
  };
}

export function clampMovement(position, limit) {
  const distance = Math.hypot(position.x, position.z);
  if (distance <= limit) return false;
  position.x *= limit / distance;
  position.z *= limit / distance;
  return true;
}

// One reusable stepper per controller. All world-local callbacks receive the
// same final position and feedback, never the pre-clamp request as a result.
export function createMovementStepper() {
  const request = { x: 0, y: 0, z: 0, duration: 0 };
  const result = {};
  let lastStep = -1;
  let lastWorld = null;
  return function step(world, settings, yaw, keys, context) {
    if (lastWorld === world && lastStep === context.stepId) return result;
    lastWorld = world;
    lastStep = context.stepId;
    Object.assign(result, {
      stepId: context.stepId,
      accepted: false,
      x: 0,
      z: 0,
      distance: 0,
      duration: 0,
      clamped: false,
      blocked: false,
      reason: 'no-request',
      moving: false,
      directionX: 0,
      directionZ: 0,
    });
    context.movementResult = result;
    const dt = simulationDelta(context.dt);
    if (!context.canSimulate || !dt) {
      world.moving = 0;
      result.reason = 'paused-or-invalid-dt';
      return result;
    }
    let dx = 0,
      dz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dz--;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dz++;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx--;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx++;
    const length = Math.hypot(dx, dz);
    world.moving = length ? 1 : 0;
    if (length) {
      result.moving = true;
      result.directionX = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / length;
      result.directionZ = (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) / length;
      world.position.x += result.directionX * settings.speed * dt;
      world.position.z += result.directionZ * settings.speed * dt;
      clampMovement(world.position, settings.limit);
    }
    const baseX = world.position.x,
      baseZ = world.position.z;
    // Reset the buffer so a callback cannot accidentally reuse stale components.
    Object.assign(request, { x: 0, y: 0, z: 0, duration: 0 });
    const influence = world.getMovementInfluence?.(context, request);
    if (influence) {
      const limits = world.movementInfluenceLimits;
      const size = Math.hypot(influence.x, influence.z);
      if (
        ![influence.x, influence.y, influence.z, influence.duration].every(
          Number.isFinite,
        )
      )
        result.reason = 'non-finite';
      else if (influence.y !== 0) result.reason = 'non-horizontal';
      else if (influence.duration <= 0 || influence.duration > dt + 1e-9)
        result.reason = 'invalid-duration';
      else if (
        !limits ||
        !Number.isFinite(limits.speed) ||
        limits.speed <= 0 ||
        !Number.isFinite(limits.maxDistance) ||
        limits.maxDistance <= 0
      )
        result.reason = 'invalid-limits';
      else if (
        size > limits.speed * influence.duration + 1e-9 ||
        size > limits.maxDistance + 1e-9
      )
        result.reason = 'exceeds-limits';
      else if (context.hasMovementInput || context.movementInterrupted)
        result.reason = 'interrupted';
      else {
        world.position.x += influence.x;
        world.position.z += influence.z;
        result.accepted = true;
        result.duration = influence.duration;
        result.reason = 'applied';
      }
    }
    const clamped = clampMovement(world.position, settings.limit);
    if (result.accepted) {
      result.x = world.position.x - baseX;
      result.z = world.position.z - baseZ;
      result.distance = Math.hypot(result.x, result.z);
      result.clamped = clamped;
      result.blocked = result.distance <= 1e-9;
    }
    return result;
  };
}
