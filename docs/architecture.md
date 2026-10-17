# 架构与协作边界

## 运行方式

浏览器直接加载静态 HTML、CSS 和 ES Modules，不需要应用框架、后端或打包器。Three.js r170 从原始 HTML 的内嵌模块按字节提取到 `vendor/`，本次未升级引擎。Node.js 仅用于本地服务、检查、测试和静态发布目录生成。

```text
index.html                 语义结构、入口与操作提示
src/main.js                会话状态、输入、切换、镜头、对白触发、音频与动画循环
src/fieldwork.js           人层田野观察：第一人称、人物切换、观察笔记、能力与动物模拟
src/styles.css             现有界面样式与响应式布局
src/content/worlds.js      四层名称、尺度、镜头与移动参数
src/content/characters.js  人层人物：背景、性格、能力、偏好、缺点与行为数值
src/content/fauna.js       动物物种：脾性、按视角区分的观察笔记、栖息地
src/content/clues.js       自然线索：哪些视角能察觉、各自读到什么
src/content/residents.js   原野上的其他人：年龄、日程、反应、按视角区分的笔记与台词
src/core/random.js         可复现的随机数生成器
src/core/wildlife.js       动物行为状态机（纯逻辑，不依赖 Three.js）
src/core/observation.js    观察规则：察觉、笔记选择与观察距离
src/core/residents.js      其他人的日程与反应状态机（纯逻辑，不依赖 Three.js）
src/worlds/index.js        场景工厂装配
src/worlds/shared.js       地形、植被、光照、天空与共用渲染工具
src/worlds/micro.js        草层
src/worlds/human.js        人层：稀树草原、线索与动物布置、人物模型装配
src/worlds/people.js       人物全身模型与第一人称手部/道具
src/worlds/animals.js      动物低多边形模型与按状态摆姿
src/worlds/residents.js    其他人的体态、衣物、随身物件与按状态摆姿
src/worlds/island.js       岛屿层
src/worlds/space.js        星球层
vendor/                    保持原件的引擎与第三方许可
prototypes/                原始附件及 SHA-256 清单
scripts/                   受限静态服务与发布复制脚本
tests/                     单元、仓库完整性与浏览器冒烟
docs/                      方向、任务、验证、维护与决策
.github/                   Issue/PR 模板、CI 与依赖更新配置
```

## 场景契约

`createWorldFactory(renderer)` 为本次会话创建共享工具与四个 builder；每个 builder 返回自己的场景状态。层顺序固定为草、人、岛屿、星球，与 `descriptions`、按钮索引和快捷键一致。改动顺序需要同步这些调用方与测试。

场景状态包含 `scene`、`position`、`avatar`、`talkers`、`followers`、`recruitables`。对白实体包含 `object`、`range`、`name`、`lines`，每条 `lines` 记录正文与来源说明。层特有数据由所属模块创建，主循环只更新实际需要的部分。

人层额外提供 `cast`（每位人物的全身模型与手部）、`animals`（行为状态 `sim` 与外观 `view`）、`residents`（`def`、`sim`、`view`）、`residentViews`、`clues`、`fauna`、`pondLevel`、`animate(time)`、`setTrailGlow(amount)` 与 `sunOffset`。这些只由 `src/fieldwork.js` 与 `main.js` 的人层分支读取。

其他人与动物共用同一个观察者对象。`fieldwork` 每帧先推进动物、再推进其他人；奔跑的孩子会借 `startle()` 惊动附近的动物。栖息地的 `follow` 指向一位居民或另一处栖息地的 `id`，被跟随者的 `sim` 写入动物的 `leader`，动物便以它当前的位置为家（羊群跟着牧人，小象跟着母象）。`scale` 是个体大小。

`people.js` 的 `person(look)` 把上身与头放进以髋部、颈部为轴的关节组，`userData` 提供 `limbs`、`torso`、`head`、`hands`；玩家形象仍只摆动 `limbs`。`createPeople()` 另外导出 `binoculars`，供巡护员复用。

`main.js` 通过 `createFieldwork()` 返回的接口接入人层：`setVisible`、`isBlocking`、`closePanel`、`handleKey`、`update`、`placeCamera`、`speedScale`、`lookVertical`。`placeCamera` 返回 `true` 时由它负责第一人称或形象预览镜头，否则沿用环绕镜头。人物面板打开时阻止移动与切层按键。

动物、其他人的行为与观察规则放在 `src/core/`，只操作平面坐标与状态，可以直接用单元测试验证；渲染层根据 `state` 和 `speed` 摆姿。人物、动物、居民和线索的文字与数值集中在 `src/content/`，新增内容时同步运行 `tests/unit/observation.test.mjs` 与 `tests/unit/residents.test.mjs` 中的完整性检查。

共享工具作为参数注入四层，避免场景直接依赖主控制器。地面高度函数同时用于地形、角色和镜头，修改时三者需要一起验证。

## 当前限制

场景首次使用时创建并缓存，离开不会释放 GPU 资源；刷新才完全重置。人层的五套人物模型、手部、九位居民和全部动物随场景一起创建并常驻，切换人物只替换场景中的全身模型并切换手部可见性，不重复创建资源。动物模拟与田野笔记只在人层激活时更新，笔记仅保留在本次会话。主控制器仍包含输入、音频和对白，后续按真实任务逐步拆分。场景工厂嵌套函数沿用 Demo 结构，避免一次重写引入行为偏差。

共享随机源为固定种子，但各层首次进入的顺序会影响随机消耗，因此不同访问顺序的场景细节可能不同。当前尚未承诺跨会话完全一致的世界。随机散布的石头和金合欢若落进水塘、牧人小屋等空地，会在建场景时移除（见 `human.js` 的 `CLEARINGS`）。

人层动物与居民都由独立网格拼成，没有合批：在 1280 × 760 的软件 WebGL 下，从出生点、水塘、牧人小屋看去的单帧绘制调用约为 620、300、760（`renderer.info.render.calls`，即一次 `render()` 的总数）。这只是开发时的观察值，不是性能验收；正式预算见 PERF-01。

## 分工建议

每个尺度的视觉与实体改动优先限定在对应文件。改动 `main.js`、`shared.js`、层索引、工具参数、根规范或 CI 时，在关联任务中先说明影响。对白暂在各场景内，独立内容结构与音频模块是后续任务，不能假定已经存在。

新增事件监听必须有明确生命周期；新增 GPU/音频资源说明复用与释放策略。性能测量记录设备、浏览器、操作路径与测量方法，不用主观“流畅”代替证据。
