import { createWorldTools } from './shared.js';
import { makeMicro } from './micro.js';
import { loadHumanAvatar, makeHuman } from './human.js';
import { makeIsland } from './island.js';
import { makeSpace } from './space.js';

export function createWorldFactory(renderer) {
  const tools = createWorldTools(renderer);
  // 人物模型在会话开始时就预加载；失败由人层场景记录并由主控制器提示。
  const humanAvatar = loadHumanAvatar();
  humanAvatar.catch(() => {});
  return {
    ...tools,
    builders: [
      () => makeMicro(tools),
      () => makeHuman(tools, humanAvatar),
      () => makeIsland(tools),
      () => makeSpace(tools),
    ],
  };
}
