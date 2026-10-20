import * as THREE from '../../vendor/three.module.js';
import { simulationDelta } from '../core/world-movement.js';

export const ringedPlanetSettings = Object.freeze({
  position: Object.freeze([170, 40, -200]),
  actionRange: 180,
  outerRange: 220,
  speed: 18,
  duration: 2,
  maxDistance: 36,
  cooldown: 6,
});
export const ringedMovementLimits = Object.freeze({
  speed: ringedPlanetSettings.speed,
  maxDistance: ringedPlanetSettings.maxDistance,
});
const action = Object.freeze({ label: '感受引力' });
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
    responseRemaining: 0,
  });
  const material = ring.material;
  const baseOpacity = material.opacity;
  const baseScale = ring.scale.clone();
  const baseEmissive = material.emissive.clone();
  const baseIntensity = material.emissiveIntensity;
  const baseContribution = baseEmissive.clone().multiplyScalar(baseIntensity);
  const responseColor = new THREE.Color('#9fdfff');
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
  function canStart(context) {
    return (
      context.canInteract &&
      state.status === 'ready' &&
      available() &&
      body.position.distanceTo(world.position) <=
        ringedPlanetSettings.actionRange
    );
  }
  function restoreRing() {
    material.opacity = baseOpacity;
    material.emissive.copy(baseEmissive);
    material.emissiveIntensity = baseIntensity;
    ring.scale.copy(baseScale);
  }
  function stop(reason) {
    state.status = 'cooldown';
    state.remaining = ringedPlanetSettings.cooldown;
    state.stopReason = reason;
    // Stopping motion must not swallow the response the player just requested.
    if (state.responseRemaining <= epsilon) restoreRing();
  }
  function cool(dt) {
    state.remaining = Math.max(0, state.remaining - dt);
    if (state.remaining <= epsilon) {
      state.status = 'ready';
      state.remaining = 0;
    }
  }
  function showResponse(reducedMotion) {
    if (state.responseRemaining <= epsilon) {
      restoreRing();
      return;
    }
    const envelope = Math.sin(
      Math.PI * (1 - state.responseRemaining / ringedPlanetSettings.duration),
    );
    // The visible response always lasts two active seconds after E, even if
    // input or the boundary stops the optional physical pull.
    // Reduced motion keeps deliberate traction but uses steady blue light.
    const strength = reducedMotion ? 0.7 : 0.3 + 0.7 * envelope;
    material.opacity = baseOpacity + (reducedMotion ? 0.08 : 0.15 * envelope);
    material.emissive
      .copy(responseColor)
      .multiplyScalar(1.2 * strength)
      .add(baseContribution);
    material.emissiveIntensity = 1;
    ring.scale.copy(baseScale);
    if (!reducedMotion) ring.scale.multiplyScalar(1 + 0.14 * strength);
  }
  function setEnabled(enabled) {
    if (!enabled) {
      state.responseRemaining = 0;
      if (state.status === 'pulling') stop('disabled-or-invalid-object');
      state.enabled = false;
      body.visible = false;
      restoreRing();
      for (let i = world.talkers.length - 1; i >= 0; i--)
        if (world.talkers[i] === talker) world.talkers.splice(i, 1);
      return;
    }
    if (available()) return;
    state.responseRemaining = 0;
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
      state.responseRemaining = ringedPlanetSettings.duration;
      startStep = Number.isSafeInteger(context.stepId)
        ? context.stepId
        : consumedStep;
      showResponse(context.reducedMotion);
      return '星环亮起，与你回应。';
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
      const interrupted =
        state.status === 'pulling' &&
        (context.hasMovementInput || context.movementInterrupted);
      if (interrupted) stop('input-interrupted');
      const dt = simulationDelta(context.dt);
      if (!context.canSimulate || !dt) return;
      const step = context.stepId;
      if (!Number.isSafeInteger(step)) {
        if (state.status === 'pulling') stop('missing-movement-result');
        return;
      }
      if (step <= consumedStep || step <= startStep) return;
      consumedStep = step;
      state.responseRemaining = Math.max(0, state.responseRemaining - dt);
      if (state.responseRemaining <= epsilon) state.responseRemaining = 0;
      showResponse(context.reducedMotion);
      if (interrupted) return; // This cancellation starts the full cooldown.
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
    },
    setEnabled,
  };
}
