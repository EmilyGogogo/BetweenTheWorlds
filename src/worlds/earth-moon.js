export const moonOrbit = Object.freeze({
  inviteDistance: 75,
  radius: 48,
  height: 5,
  angularSpeed: 0.18,
});

const inviteAction = Object.freeze({ label: '邀请月亮同行' });

// Owns no GPU/audio resources or listeners. The existing scene cache owns both
// the Moon mesh and this two-state relationship for the lifetime of the page.
export function attachMoonCompanion(world, moon) {
  world.moon = moon;
  const state = { status: 'available', phase: 0, invitable: true };
  world.earthState = { moon: state };

  function hasMoon() {
    return Boolean(moon && world.moon === moon && moon.parent === world.scene);
  }

  function canInvite(context) {
    if (
      !context.canInteract ||
      !hasMoon() ||
      !state.invitable ||
      state.status !== 'available'
    )
      return false;
    return moon.position.distanceTo(world.position) <= moonOrbit.inviteDistance;
  }

  function placeMoon() {
    moon.position.set(
      world.position.x + moonOrbit.radius * Math.cos(state.phase),
      world.position.y + moonOrbit.height,
      world.position.z + moonOrbit.radius * Math.sin(state.phase),
    );
  }

  world.getPrimaryAction = (context) =>
    canInvite(context) ? inviteAction : null;

  world.onPrimaryAction = (context) => {
    // Re-read live position/eligibility; the last displayed prompt is no proof.
    if (!canInvite(context)) return null;
    const dx = moon.position.x - world.position.x;
    const dz = moon.position.z - world.position.z;
    // Deliberately choose +X when there is no horizontal bearing, including -0.
    state.phase = dx === 0 && dz === 0 ? 0 : Math.atan2(dz, dx);
    state.status = 'orbiting';
    placeMoon();
    return '月亮，与你同行。';
  };

  world.update = (context) => {
    if (!context.canSimulate || !hasMoon() || state.status !== 'orbiting')
      return;
    if (
      !context.reducedMotion &&
      Number.isFinite(context.dt) &&
      context.dt > 0
    ) {
      state.phase =
        (state.phase + moonOrbit.angularSpeed * context.dt) % (2 * Math.PI);
    }
    // Even with reduced motion, the fixed offset follows the latest position.
    placeMoon();
  };
}
