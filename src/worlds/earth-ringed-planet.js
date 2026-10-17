import { simulationDelta } from '../core/world-movement.js';

export const ringedPlanetSettings = Object.freeze({
  actionRange: 130,
  outerRange: 160,
  speed: 6,
  duration: 2,
  maxDistance: 12,
  cooldown: 6,
  probeDistance: 1,
});
export const ringedMovementLimits = Object.freeze({
  speed: ringedPlanetSettings.speed,
  maxDistance: ringedPlanetSettings.maxDistance,
});
const action = Object.freeze({ label: '感受引力 · 移动即可中止' });
const epsilon = 1e-9;

// Reuses the existing body/ring/talker. This module requests movement; only the
// controller's movement stage writes the player position and reports its result.
export function createRingedPlanet(world, body, gas, ring, talker) {
  world.ringedPlanet = body;
  world.ringedPlanetGas = gas;
  world.ringedPlanetRing = ring;
  world.earthState ??= {};
  const state = (world.earthState.ringedPlanet ??= {
    status: 'ready',
    elapsed: 0,
    spent: 0,
    remaining: 0,
    enabled: true,
    stopReason: null,
  });
  const material = ring.material;
  const baseOpacity = material.opacity;
  let startStep = -1;
  let consumedStep = -1;

  function available() {
    return (
      state.enabled &&
      body &&
      gas &&
      ring &&
      world.ringedPlanet === body &&
      world.ringedPlanetGas === gas &&
      world.ringedPlanetRing === ring &&
      body.parent === world.scene &&
      gas.parent === body &&
      ring.parent === body &&
      ring.material === material &&
      body.visible &&
      gas.visible &&
      ring.visible
    );
  }
  function horizontalDistance() {
    return Math.hypot(
      body.position.x - world.position.x,
      body.position.z - world.position.z,
    );
  }
  function validGeometry(context, range) {
    return (
      available() &&
      Number.isFinite(context.movementLimit) &&
      context.movementLimit > 0 &&
      Number.isFinite(horizontalDistance()) &&
      horizontalDistance() > epsilon &&
      body.position.distanceTo(world.position) <= range
    );
  }
  function hasSpace(context) {
    const length = horizontalDistance();
    const x =
      world.position.x +
      ((body.position.x - world.position.x) / length) *
        ringedPlanetSettings.probeDistance;
    const z =
      world.position.z +
      ((body.position.z - world.position.z) / length) *
        ringedPlanetSettings.probeDistance;
    return (
      Math.hypot(x, z) <= context.movementLimit &&
      Math.hypot(x - world.position.x, z - world.position.z) > 0.05
    );
  }
  function canStart(context) {
    return (
      context.canInteract &&
      state.status === 'ready' &&
      !context.hasMovementInput &&
      !context.movementInterrupted &&
      validGeometry(context, ringedPlanetSettings.actionRange) &&
      hasSpace(context)
    );
  }
  function restoreRing() {
    material.opacity = baseOpacity;
  }
  function stop(reason) {
    state.status = 'cooldown';
    state.remaining = ringedPlanetSettings.cooldown;
    state.stopReason = reason;
    restoreRing();
  }
  function cool(dt) {
    state.remaining = Math.max(0, state.remaining - dt);
    if (state.remaining <= epsilon) {
      state.status = 'ready';
      state.remaining = 0;
    }
  }
  function showResponse(reducedMotion) {
    material.opacity =
      state.status === 'pulling'
        ? reducedMotion
          ? baseOpacity + 0.08
          : baseOpacity +
            0.15 *
              Math.sin(
                (Math.PI * state.elapsed) / ringedPlanetSettings.duration,
              )
        : baseOpacity;
  }
  function setEnabled(enabled) {
    if (!enabled) {
      if (state.status === 'pulling') stop('disabled-or-invalid-object');
      state.enabled = false;
      body.visible = false;
      restoreRing();
      for (let i = world.talkers.length - 1; i >= 0; i--)
        if (world.talkers[i] === talker) world.talkers.splice(i, 1);
      return;
    }
    if (available()) return;
    if (state.status === 'pulling') stop('disabled-or-invalid-object');
    state.enabled = true;
    world.ringedPlanet = body;
    world.ringedPlanetGas = gas;
    world.ringedPlanetRing = ring;
    body.visible = gas.visible = ring.visible = true;
    ring.material = material;
    if (body.parent !== world.scene) world.scene.add(body);
    if (gas.parent !== body) body.add(gas);
    if (ring.parent !== body) body.add(ring);
    if (!world.talkers.includes(talker)) world.talkers.push(talker);
    restoreRing();
  }

  return {
    getPrimaryAction: (context) => (canStart(context) ? action : null),
    onPrimaryAction(context) {
      if (!canStart(context)) return null;
      state.status = 'pulling';
      state.elapsed = state.spent = state.remaining = 0;
      state.stopReason = null;
      startStep = Number.isSafeInteger(context.stepId)
        ? context.stepId
        : consumedStep;
      showResponse(context.reducedMotion);
      return '引力，轻轻改变了你的方向。';
    },
    getMovementInfluence(context, out) {
      const dt = simulationDelta(context.dt);
      if (
        !context.canSimulate ||
        !dt ||
        state.status !== 'pulling' ||
        context.hasMovementInput ||
        context.movementInterrupted ||
        !validGeometry(context, ringedPlanetSettings.outerRange)
      )
        return null;
      const distance = Math.min(
        ringedPlanetSettings.speed * dt,
        Math.max(0, ringedPlanetSettings.duration - state.elapsed) *
          ringedPlanetSettings.speed,
        Math.max(0, ringedPlanetSettings.maxDistance - state.spent),
      );
      if (distance <= epsilon) return null;
      const length = horizontalDistance();
      out.x = ((body.position.x - world.position.x) / length) * distance;
      out.y = 0;
      out.z = ((body.position.z - world.position.z) / length) * distance;
      out.duration = distance / ringedPlanetSettings.speed;
      return out;
    },
    update(context) {
      // Invalidation and explicit interruption are maintenance, even in help.
      if (!available()) {
        if (state.enabled) setEnabled(false);
        return;
      }
      if (
        state.status === 'pulling' &&
        (context.hasMovementInput || context.movementInterrupted)
      ) {
        if (Number.isSafeInteger(context.stepId))
          consumedStep = Math.max(consumedStep, context.stepId);
        stop('input-interrupted');
        return;
      }
      const dt = simulationDelta(context.dt);
      if (!context.canSimulate || !dt) return;
      const step = context.stepId;
      if (!Number.isSafeInteger(step)) {
        if (state.status === 'pulling') stop('missing-movement-result');
        return;
      }
      if (step <= consumedStep || step <= startStep) return;
      consumedStep = step;
      if (state.status === 'cooldown') {
        cool(dt);
        return;
      }
      if (state.status !== 'pulling') return;
      if (!validGeometry(context, ringedPlanetSettings.outerRange)) {
        stop('invalid-direction-or-range');
        return;
      }
      const result = context.movementResult;
      if (!result || result.stepId !== step || !result.accepted) {
        stop(
          result?.stepId === step ? result.reason : 'missing-movement-result',
        );
        return;
      }
      state.spent += result.distance;
      state.elapsed += result.duration;
      if (result.clamped || result.blocked) {
        stop(result.blocked ? 'boundary-blocked' : 'boundary-clamped');
        return;
      }
      if (
        state.elapsed + epsilon >= ringedPlanetSettings.duration ||
        state.spent + 1e-6 >= ringedPlanetSettings.maxDistance
      ) {
        stop('complete');
        cool(Math.max(0, dt - result.duration));
      }
      showResponse(context.reducedMotion);
    },
    setEnabled,
  };
}
