import { createWorldTools } from './shared.js';
import { makeMicro } from './micro.js';
import { makeHuman } from './human.js';
import { makeIsland } from './island.js';
import { makeSpace } from './space.js';

export function createWorldFactory(renderer) {
  const tools = createWorldTools(renderer);
  return {
    ...tools,
    builders: [
      () => makeMicro(tools),
      () => makeHuman(tools),
      () => makeIsland(tools),
      () => makeSpace(tools),
    ],
  };
}
