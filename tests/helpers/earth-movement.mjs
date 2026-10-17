import { createEarth } from './earth-fixture.mjs';
import {
  createMovementInput,
  createMovementStepper,
} from '../../src/core/world-movement.js';
import { descriptions } from '../../src/content/worlds.js';

export function movingEarth() {
  const world = createEarth();
  const input = createMovementInput();
  const step = createMovementStepper();
  const context = {
    dt: 0.05,
    canSimulate: true,
    canInteract: true,
    reducedMotion: false,
    stepId: 0,
  };
  const refresh = () => input.refresh(context, descriptions[3].limit);
  refresh();
  return {
    world,
    input,
    context,
    ring: world.earthActions.ringedPlanet,
    state: world.earthState.ringedPlanet,
    action() {
      refresh();
      return world.onPrimaryAction(context);
    },
    tick(dt = 0.05) {
      context.dt = dt;
      context.stepId++;
      refresh();
      const result = step(world, descriptions[3], 0.22, input.keys, context);
      world.update(context);
      input.finishStep();
      return result;
    },
  };
}
