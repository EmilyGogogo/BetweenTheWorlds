import { simulationDelta } from '../core/world-movement.js';

// The sole owner of surface/cloud spin. No action baseline, light, orbit,
// camera or player-position field is written here.
export function createEarthVisualUpdate(world) {
  return (context) => {
    const dt = simulationDelta(context.dt);
    if (!context.canSimulate || context.reducedMotion || !dt) return;
    world.globe.rotation.y =
      (world.globe.rotation.y + dt * 0.018) % (2 * Math.PI);
    world.clouds.rotation.y =
      (world.clouds.rotation.y + dt * 0.02) % (2 * Math.PI);
  };
}
