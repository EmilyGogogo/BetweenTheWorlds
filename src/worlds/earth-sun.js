import * as THREE from '../../vendor/three.module.js';

export const sunSettings = Object.freeze({
  position: Object.freeze([-110, 65, -100]),
  radius: 18,
  haloRadius: 24,
  innerRange: 80,
  outerRange: 150,
  actionRange: 100,
  talkRange: 120,
  responseDuration: 3,
  cooldownDuration: 5,
});

const soloVariant = Object.freeze({
  id: 'solo',
  action: Object.freeze({ label: '回应光芒' }),
  feedback: '光沿着你的边缘，慢慢展开。',
});
const timeEpsilon = 1e-9;

export function sunProximity(distance) {
  if (!Number.isFinite(distance) || distance < 0) return 0;
  const u = Math.max(
    0,
    Math.min(
      1,
      (sunSettings.outerRange - distance) /
        (sunSettings.outerRange - sunSettings.innerRange),
    ),
  );
  return u * u * (3 - 2 * u);
}

// GPU resources belong to the cached scene, not to an action. No listeners,
// clocks or per-frame Color/Vector allocations are created here.
// selectVariant (optional) returns an alternative {id, action, feedback} or
// null; it must be side-effect free because prompts query it every frame.
export function createSunResponse(
  world,
  body,
  halo,
  talker,
  { selectVariant = null } = {},
) {
  world.sunBody = body;
  world.sunHalo = halo;
  world.earthState ??= {};
  // responseId/variant identify the accepted response; lastEnd records how the
  // latest one ended so a partner can tell natural completion from cancellation.
  const state = {
    status: 'ready',
    remaining: 0,
    enabled: false,
    responseId: 0,
    variant: null,
    lastEnd: null,
  };
  world.earthState.sun = state;
  const light = world.sun;
  const target = light.target;
  const atmosphereColor = world.atmosphere.material.uniforms.color.value;
  const baseline = {
    lightPosition: light.position.clone(),
    intensity: light.intensity,
    targetPosition: target.position.clone(),
    targetParent: target.parent,
    atmosphereColor: atmosphereColor.clone(),
    haloScale: halo.scale.clone(),
  };
  const warm = new THREE.Color('#efc58b');

  function available() {
    return (
      state.enabled &&
      world.sunBody === body &&
      body.parent === world.scene &&
      body.visible
    );
  }

  function distance() {
    return body.position.distanceTo(world.position);
  }

  function syncLight() {
    light.position.copy(body.position);
    target.position.copy(world.position);
    // Main updates the avatar later; use the live player center and update the
    // matrices now so the DirectionalLight target cannot lag behind movement.
    light.updateWorldMatrix(true, false);
    target.updateWorldMatrix(true, false);
  }

  // The one response envelope; partners read it instead of keeping a clock.
  function responseWeight(reducedMotion) {
    if (state.status !== 'responding') return 0;
    return reducedMotion
      ? 0.35
      : Math.sin(
          Math.PI * (1 - state.remaining / sunSettings.responseDuration),
        );
  }

  function endResponse(reason) {
    if (state.status !== 'responding') return;
    state.lastEnd = Object.freeze({
      id: state.responseId,
      variant: state.variant,
      reason,
    });
  }

  function applyResponse(reducedMotion) {
    const weight = responseWeight(reducedMotion);
    atmosphereColor.copy(baseline.atmosphereColor).lerp(warm, weight);
    halo.scale.copy(baseline.haloScale);
    if (!reducedMotion) halo.scale.multiplyScalar(1 + 0.08 * weight);
  }

  function resetResponse() {
    endResponse('disabled');
    state.status = 'ready';
    state.remaining = 0;
  }

  function restoreBaseline() {
    light.position.copy(baseline.lightPosition);
    light.intensity = baseline.intensity;
    light.target = target;
    target.position.copy(baseline.targetPosition);
    if (target.parent !== baseline.targetParent) {
      if (baseline.targetParent) baseline.targetParent.add(target);
      else target.removeFromParent();
    }
    light.updateWorldMatrix(true, false);
    target.updateWorldMatrix(true, false);
    atmosphereColor.copy(baseline.atmosphereColor);
    halo.scale.copy(baseline.haloScale);
  }

  function setEnabled(enabled) {
    if (enabled) {
      if (available()) return;
      resetResponse();
      state.enabled = true;
      world.sunBody = body;
      body.visible = true;
      if (body.parent !== world.scene) world.scene.add(body);
      if (target.parent !== world.scene) world.scene.add(target);
      if (!world.talkers.includes(talker)) world.talkers.push(talker);
      syncLight();
      light.intensity =
        baseline.intensity * (1 + 0.25 * sunProximity(distance()));
      applyResponse(false);
    } else {
      state.enabled = false;
      resetResponse();
      body.visible = false;
      for (let i = world.talkers.length - 1; i >= 0; i--) {
        if (world.talkers[i] === talker) world.talkers.splice(i, 1);
      }
      restoreBaseline();
    }
  }

  function canRespond(context) {
    return (
      context.canInteract &&
      available() &&
      state.status === 'ready' &&
      distance() <= sunSettings.actionRange
    );
  }

  function advanceTimers(dt) {
    let budget = dt;
    while (state.status !== 'ready') {
      if (budget + timeEpsilon < state.remaining) {
        state.remaining -= budget;
        return;
      }
      budget = Math.max(0, budget - state.remaining);
      if (state.status === 'responding') {
        endResponse('complete');
        state.status = 'cooldown';
        state.remaining = sunSettings.cooldownDuration;
      } else {
        resetResponse();
        return;
      }
      if (budget <= timeEpsilon) return;
    }
  }

  const view = {
    id: 0,
    variant: null,
    responding: false,
    weight: 0,
    lastEnd: null,
  };

  function variantFor(context) {
    return selectVariant?.(context) ?? soloVariant;
  }

  const controls = {
    getPrimaryAction(context) {
      return canRespond(context) ? variantFor(context).action : null;
    },
    onPrimaryAction(context) {
      if (!canRespond(context)) return null;
      // Re-select now: a stale duet prompt must not invent a partner.
      const variant = variantFor(context);
      state.status = 'responding';
      state.remaining = sunSettings.responseDuration;
      state.responseId += 1;
      state.variant = variant.id;
      applyResponse(context.reducedMotion);
      return variant.feedback;
    },
    // Read-only view of the current response for local partners; the object is
    // reused every frame, so callers must not keep it.
    getResponseView(reducedMotion) {
      view.id = state.responseId;
      view.variant = state.variant;
      view.responding = state.status === 'responding';
      view.weight = responseWeight(reducedMotion);
      view.lastEnd = state.lastEnd;
      return view;
    },
    update(context) {
      // Maintenance is allowed even while paused, so removed bodies cannot
      // leave a ghost talker or permanent lighting/color changes behind.
      if (!available()) {
        if (state.enabled) setEnabled(false);
        return;
      }
      if (
        !context.canSimulate ||
        !Number.isFinite(context.dt) ||
        context.dt <= 0
      )
        return;
      const dt = Math.min(context.dt, 0.05);
      syncLight();
      const d = distance();
      const targetIntensity = baseline.intensity * (1 + 0.25 * sunProximity(d));
      const alpha = context.reducedMotion ? 1 : 1 - Math.exp(-4 * dt);
      light.intensity += (targetIntensity - light.intensity) * alpha;
      if (state.status === 'responding' && d > sunSettings.outerRange) {
        endResponse('out-of-range');
        state.status = 'cooldown';
        state.remaining = sunSettings.cooldownDuration;
      } else {
        advanceTimers(dt);
      }
      applyResponse(context.reducedMotion);
    },
    setEnabled,
  };
  setEnabled(true);
  return controls;
}
