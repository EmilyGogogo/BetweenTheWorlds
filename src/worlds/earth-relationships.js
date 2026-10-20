import * as THREE from '../../vendor/three.module.js';

const duet = Object.freeze({
  id: 'moon-duet',
  action: Object.freeze({ label: '与月亮回应光芒' }),
  feedback: '这一次，光也照见了你的同行者。',
});

// Borrows Sun's envelope; owns only the original Moon material's emissive
// and surface tint fields. All objects survive with the cached world,
// with no new GPU resources.
export function createMoonSunRelationship(world, moon) {
  const scene = world.scene;
  const originalEarth = world.globe.parent;
  const material = moon.material;
  const baseline = material.emissive.clone();
  const baselineColor = material.color.clone();
  const baselineIntensity = material.emissiveIntensity;
  const contribution = baseline.clone().multiplyScalar(baselineIntensity);
  const warm = new THREE.Color('#efc58b');
  world.earthState ??= {};
  world.earthState.relationships ??= {};
  const state = (world.earthState.relationships.moonSun ??= {
    hasCompleted: false,
  });
  let activeId = 0;
  let droppedId = 0;
  let handledEndId = 0;
  let painted = false;

  function validPartner() {
    const controlled = world.controlled
      ? world.controlled.object
      : world.avatar;
    return (
      controlled === originalEarth &&
      world.earthState.moon?.status === 'orbiting' &&
      world.moon === moon &&
      world.scene === scene &&
      moon.parent === scene &&
      scene.visible &&
      moon.visible &&
      moon.material === material
    );
  }

  function restore() {
    if (!painted) return;
    // Restore our old material even after replacement, without assigning it
    // back to the Mesh or touching the replacement material.
    material.emissive.copy(baseline);
    material.emissiveIntensity = baselineIntensity;
    material.color.copy(baselineColor);
    painted = false;
  }

  return {
    selectVariant(context) {
      return context.canInteract && validPartner() ? duet : null;
    },
    update(_context, view) {
      // Maintenance also runs while paused. Progress belongs exclusively to
      // Sun; reading this view never consumes dt, even on the action's frame.
      const valid = validPartner();
      if (view.responding && view.variant === duet.id) {
        activeId = view.id;
        if (!valid) droppedId = view.id;
      }
      if (activeId === view.id && !valid) droppedId = view.id;

      const end = view.lastEnd;
      if (end && end.id > handledEndId) {
        handledEndId = end.id;
        if (
          end.id === activeId &&
          end.variant === duet.id &&
          end.reason === 'complete' &&
          end.id !== droppedId &&
          valid
        )
          state.hasCompleted = true;
      }

      if (
        !view.responding ||
        view.variant !== duet.id ||
        !valid ||
        view.id === droppedId
      ) {
        restore();
        return;
      }
      material.emissive
        .copy(warm)
        .multiplyScalar(1.2 * view.weight)
        .add(contribution);
      material.emissiveIntensity = 1;
      material.color.copy(baselineColor).lerp(warm, 0.55 * view.weight);
      painted = true;
    },
  };
}
