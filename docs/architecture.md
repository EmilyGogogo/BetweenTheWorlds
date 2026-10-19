# 架构与协作边界

## 运行方式

浏览器直接加载静态 HTML、CSS 和 ES Modules，不需要应用框架、后端或打包器。Three.js r170 从原始 HTML 的内嵌模块按字节提取到 `vendor/`，本次未升级引擎；同版本的 glTF 加载器原件放在 `vendor/examples/jsm/`，它的 `three` 裸导入由 `index.html` 中的 import map 解析到同一个引擎文件。Node.js 仅用于本地服务、检查、测试和静态发布目录生成。

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
src/core/world-movement.js 输入中止锁存、正常位移、影响校验/夹取及实际反馈
src/core/world-actions.js  主动作分派、共享允许条件与提示 DOM 适配
src/core/embodiment.js     实体登记、魂穿、候选选择与受控身体引用
src/core/wildlife.js       动物行为状态机（纯逻辑，不依赖 Three.js）
src/core/observation.js    观察规则：察觉、笔记选择与观察距离
src/core/residents.js      其他人的日程与反应状态机（纯逻辑，不依赖 Three.js）
src/worlds/index.js        场景工厂装配
src/worlds/shared.js       地形、植被、光照、天空与共用渲染工具
src/worlds/micro.js        草层：场景组装、天气对光照/天空/湿土/雨的影响
src/worlds/human.js        人层：稀树草原、线索与动物布置、人物模型装配
src/worlds/people.js       人物全身模型与第一人称手部/道具
src/worlds/animals.js      动物低多边形模型与按状态摆姿
src/worlds/residents.js    其他人的体态、衣物、随身物件与按状态摆姿
src/content/grass-feelings.js  草的感受、天气转变时的句子与可邀请的草种
src/core/grass-environment.js  草层天气、温度、土壤湿度、光合作用与生长（纯逻辑）
src/core/feelings.js       按当前感知挑选感受句子（纯逻辑）
src/worlds/micro-flora.js  草层植物、土壤、露珠与摆动/透光着色器
src/worlds/micro-fauna.js  草层的蚂蚁群落、瓢虫、步甲、毛毛虫、蚱蜢、蝴蝶、蜜蜂、食蚜蝇、蜻蜓、蜗牛、蚯蚓与蛛网
src/worlds/micro-trees.js  草层边缘的巨树（橡树、白桦、松树）、草甸里的树苗与灌木、落果
src/worlds/island.js       岛屿层
src/worlds/space.js        星球层
src/worlds/earth-moon.js   现有月亮的邀请、两态和局部轨道
src/worlds/earth-sun.js    太阳距离光照、回应/冷却、启停恢复
src/worlds/earth-ringed-planet.js 原有环星球的有限牵引、冷却与星环反馈
src/worlds/earth-actions.js Earth 局部主动作选择与一次更新组合
assets/                    运行时加载的媒体资源及其来源登记
vendor/                    保持原件的引擎与第三方许可
prototypes/                原始附件及 SHA-256 清单
scripts/                   受限静态服务与发布复制脚本
tests/                     单元、仓库完整性与浏览器冒烟
docs/                      方向、任务、验证、维护与决策
.github/                   Issue/PR 模板、CI 与依赖更新配置
```

## 场景契约

`createWorldFactory(renderer)` 为本次会话创建共享工具与四个 builder；每个 builder 返回自己的场景状态。层顺序固定为草、人、岛屿、星球，与 `descriptions`、按钮索引和快捷键一致。改动顺序需要同步这些调用方与测试。

场景状态包含 `scene`、`position`、`avatar`、`talkers`、`followers`、`recruitables`。人层默认人物的 `avatar` 是一个空组，模型在会话开始时预加载并挂到 `avatar.userData.body` 上；其余四位人物保留各自的程序模型，第一人称手部和观察能力仍按人物切换。`avatarState` 取 `loading`、`ready` 或 `failed`，主控制器据此提示加载失败并把状态写到画布的 `data-avatar`。对白实体包含 `object`、`range`、`name`、`lines`，每条 `lines` 记录正文与来源说明。层特有数据由所属模块创建，主循环只更新实际需要的部分。场景状态可以提供可选的 `update(dt, time, reduced)`，主循环只对当前层调用；草层用它推进天气、昆虫和生长，离开草层时这些状态暂停。草层另有 `environment`（见 `grass-environment.js`）与 `weatherEvent`（天气刚变化时的阶段名，由主控制器读取后清空），可邀请的草带有 `species`。

人层额外提供 `cast`（每位人物的全身模型与手部）、`animals`（行为状态 `sim` 与外观 `view`）、`residents`（`def`、`sim`、`view`）、`residentViews`、`clues`、`fauna`、`pondLevel`、`animate(time)`、`setTrailGlow(amount)` 与 `sunOffset`。这些只由 `src/fieldwork.js` 与 `main.js` 的人层分支读取。

其他人与动物共用同一个观察者对象。`fieldwork` 每帧先推进动物、再推进其他人；奔跑的孩子会借 `startle()` 惊动附近的动物。栖息地的 `follow` 指向一位居民或另一处栖息地的 `id`，被跟随者的 `sim` 写入动物的 `leader`，动物便以它当前的位置为家（羊群跟着牧人，小象跟着母象）。`scale` 是个体大小。

`people.js` 的 `person(look)` 把上身与头放进以髋部、颈部为轴的关节组，`userData` 提供 `limbs`、`torso`、`head`、`hands`；玩家形象仍只摆动 `limbs`。`createPeople()` 另外导出 `binoculars`，供巡护员复用。

`main.js` 通过 `createFieldwork()` 返回的接口接入人层：`setVisible`、`isBlocking`、`closePanel`、`handleKey`、`update`、`placeCamera`、`speedScale`、`lookVertical`。`placeCamera` 返回 `true` 时由它负责第一人称或形象预览镜头，否则沿用环绕镜头。人物面板打开时阻止移动、切层与 R 魂穿。人物切换同步更新原身体实体、avatar 与 position 的引用；人层魂穿成树或岩石时暂停人物面板、能力与第一人称手部，居民和动物仍继续更新，返回原身体后恢复所选人物。

动物、其他人的行为与观察规则放在 `src/core/`，只操作平面坐标与状态，可以直接用单元测试验证；渲染层根据 `state` 和 `speed` 摆姿。人物、动物、居民和线索的文字与数值集中在 `src/content/`，新增内容时同步运行 `tests/unit/observation.test.mjs` 与 `tests/unit/residents.test.mjs` 中的完整性检查。

共享工具作为参数注入四层，避免场景直接依赖主控制器。地面高度函数同时用于地形、角色和镜头，修改时三者需要一起验证。

## Earth V1 的可选动作与更新契约

`main.js` 为唯一控制器，复用一个 context 对象：`dt` 是已限制到最多 0.05 秒的本帧游戏时间，`canInteract` / `canSimulate` 都要求已进入游戏、帮助关闭、未转场；`reducedMotion` 是启动时的系统偏好。只对活动世界调用可选 `update(context)`，顺序为移动及边界夹取 → 世界更新 → 现有动画与镜头 → 提示及原相遇检测 → 渲染。非活动世界不更新；没有回调的世界保持原行为。

可选 `getPrimaryAction(context)` 返回只读 `{label}` 或 null，无副作用；可选 `onPrimaryAction(context)` 重新检查当前资格，成功返回反馈文本，否则 null。E 过滤重复按键，草仍走 recruit；其他世界动作被拒绝时不回退到草。提示每帧查询、仅变化时写 DOM，帮助和切换时立即隐藏；不再由低频 encounter 更新覆盖。

Earth 保存 `moon`（原 Mesh 引用）、`earthState.moon = {status, phase, invitable}`。`invitable` 是局部动作资格标志，不是概率配置。Moon 不存在、被移出 scene 或不可邀请时不显示/执行邀请，不生成替代天体。状态 available → orbiting，不可解散；距离按中心三维 `<=75`，不要求随机对白先发生。

入轨复用原 Moon，零水平朝向显式选 +X；水平半径 48、高度 5、角速度 0.18rad/游戏秒，中心取最新 `w.position`。帮助/转场/非活动冻结相位；减弱动态时固定相对偏移随行；刷新新建世界重置关系。Moon 保持 scene 子节点，避免继承 globe 自转。月亮与有环星球继续使用原 talkers 与共享 19 秒冷却。

V1 新增代码不创建 GPU/音频资源、监听、RAF 或网络请求；继续沿用场景缓存寿命。新增 Node 测试覆盖逻辑、真实 Three.js 对象装配及动作/提示接口；测试里的纹理绘制 stub 不代表画面验收。实际键鼠、构图与声音由用户按检查单验证。本轮明确跳过浏览器自动化，现有 E2E 与 CI 保留。

## Earth V2 的局部组合与光照

V1 的用户手验已获确认；V2 S1–S7 新体验也已由用户确认通过。`createMoonCompanion` 与 `createSunResponse` 返回局部处理器，不抢占共享回调；兼容 `attachMoonCompanion` 保留。`installEarthActions` 一次安装世界回调，Moon优先、Sun其次，每次 E 重新检查并只执行一个对象；每帧按 Moon→Sun 各更新一次。V2未改main、core/world-actions、移动参数和其他世界；V3只扩展main的移动接线，见下节。

世界新增 `atmosphere`（原壳引用）、`sunBody`（球体+halo的Group）、`sunHalo` 和内部 `earthActions.{moon,sun}`；`earthState.sun={status,remaining,enabled}` 与原 Moon 状态共存。Sun 主动范围100、talker范围120，三维距离；只追加一条原创 talker，仍走共享对白。

Sun 位于(-110,65,-100)，球半径18、halo半径24；复用原 DirectionalLight，position 来自 Sun、原target移入scene并跟随最新玩家中心，显式更新矩阵。80–150范围内 smoothstep 增强主光3.8–4.75；正常 `1-exp(-4dt)` 插值，减弱动态直接目标。响应3秒后冷却5秒，dt合法正数且最多0.05，余时间跨状态消费。d>150取消回应并从完整5秒冷却开始。

响应仅从保存的原大气色/halo尺度派生一次 sin 包络，暖色#efc58b、最大尺度1.08；减弱动态暖色权重0.35、不缩放。帮助/转场/非活动冻结。Sun内部setEnabled(false)恢复V1原灯光/target父关系/原色/原尺度，移除精确Sun talker；显式enable复用所有资源。意外移除/隐藏/引用失配在下次活动update清理，即使暂停也维护，但不推进动画。正常远离仅恢复距离基线，光仍来自Sun，与禁用恢复旧方向不同。

资源仍随缓存场景保存，无新RAF/监听/网络/音频/卸载协议；新增普通球体与halo仅建一次。Node检查对象/矩阵/引用，GPU/heap/实际帧率未测。可选heap诊断与普通配置性能测量分会话，无强制GC视为常见未验证情况；不影响日常代码工作。

## Earth V3 的受控运动阶段

V3沿用四天体/三talkers库存，保存原ringedPlanet/gas/ring引用与原对白。`earthState.ringedPlanet={status,elapsed,spent,remaining,enabled,stopReason}`与Moon/Sun共存；不新增GPU资源、RAF、定时器、监听或音频。状态ready→pulling→cooldown→ready，原ring透明度0.8上派生单次最大0.95包络，减弱动态稳定0.88。

`main`在唯一循环中刷新实时输入/stepId/limit，调用`createMovementStepper`；顺序：正常输入与原夹取→纯可选`getMovementInfluence(context,out)`→校验/应用/最终夹取→带stepId的实际movementResult→Ringed→Moon→Sun→原动画、镜头、提示、相遇、渲染。没有影响回调的其他层保持原速度和移动规则。移动函数的第六个可选参数 `speedScale` 默认 `1`；主控制器仅在控制人类身体时传入 `fieldwork.speedScale(sneaking())`，保留人物、放轻脚步和能力倍率，不修改实体的基础速度。现有纯逻辑测试与 Earth 调用方省略该参数。共享动作与模拟允许条件同时检查帮助和人物面板。转向保留在main。浮点容差仅处理数值边界，不放宽产品距离。

请求缓冲复用`{x,y:0,z,duration}`；Earth提供冻结limits（6单位/秒、单次12）。共享层拒绝非有限数、非水平、非法duration/超速/超预算；反馈`{stepId,accepted,x,z,distance,duration,clamped,blocked,reason}`从正常输入已夹取的基点计算。Ring只消费新且匹配的实际反馈，重复update不扣两次，无匹配结果安全停止并保留stopReason。最多2游戏秒、12实际单位；正常完成消费本帧余dt至冷却，取消或首次夹取从完整6秒开始，绝不沿边滑行。基础速度仍为38，limit仍为200。

`createMovementInput`复用held-key集合，并按事件所属世界锁存方向keydown/blur，直到该世界movement/update阶段处理后清除。短按down/up不漏取消；其他层移动不取消冻结的Earth牵引；Earth失焦后立刻切层也不会丢失待取消标记。W+S仍是输入意图；E先到后W允许已有toast，但首个运动阶段无额外位移；W先到E被拒绝。blur即使帮助中也取消；帮助/转场/非活动冻结计时，不补算离开时间。

动作资格依赖canInteract而不依赖正dt（提示/E的dt本来为0），要求距离<=130、无移动意图、方向有效及沿方向1单位probe仍在参数表边界内。pulling超过160终止。按Moon→Sun→Ringed现场选择，不缓存授权，不要求完成任何前序互动。已验证独立地点(-60,0,-170)可通过共享E直接体验。

内部setEnabled(false)停止牵引、恢复原ring并移除准确原talker；禁用期间冻结，enable复用原引用且不重置剩余冷却。意外detach/hidden/引用替换在下次活动update维护，暂停也清理，不偷偷重新挂回。完整契约见[ADR 0004](decisions/0004-earth-ringed-movement.md)，验证见[V3 QA](earth-v3-qa-results.md)，用户执行[T1–T7](earth-v3-manual-qa.md)。

## 当前限制

场景首次使用时创建并缓存，离开不会释放 GPU 资源；刷新才完全重置。人层的五套人物模型、手部、九位居民和全部动物随场景一起创建并常驻，切换人物只替换场景中的全身模型并切换手部可见性，不重复创建资源。动物模拟与田野笔记只在人层激活时更新，笔记仅保留在本次会话。草层在创建时用一次 CubeCamera 拍摄 256 像素的立方体快照供露珠折射，随场景缓存，不随天气更新。草层植物按 16～64 单位的地块分组实例化：每块单独视锥剔除（含阴影），并按类型设定可见距离，离玩家更远时隐藏；昆虫在 34 单位外隐藏并停止更新。草与花使用 Lambert 材质，因为该层主要受填充率限制。主控制器仍包含输入、音频和对白，后续按真实任务逐步拆分。场景工厂嵌套函数沿用 Demo 结构，避免一次重写引入行为偏差。

共享随机源为固定种子，但各层首次进入的顺序会影响随机消耗，因此不同访问顺序的场景细节可能不同。当前尚未承诺跨会话完全一致的世界。随机散布的石头和金合欢若落进水塘、牧人小屋等空地，会在建场景时移除（见 `human.js` 的 `CLEARINGS`）。

人层动物与居民都由独立网格拼成，没有合批：在 1280 × 760 的软件 WebGL 下，从出生点、水塘、牧人小屋看去的单帧绘制调用约为 620、300、760（`renderer.info.render.calls`，即一次 `render()` 的总数）。这只是开发时的观察值，不是性能验收；正式预算见 PERF-01。

## 分工建议

每个尺度的视觉与实体改动优先限定在对应文件。改动 `main.js`、`shared.js`、层索引、工具参数、根规范或 CI 时，在关联任务中先说明影响。对白暂在各场景内，独立内容结构与音频模块是后续任务，不能假定已经存在。

新增事件监听必须有明确生命周期；新增 GPU/音频资源说明复用与释放策略。性能测量记录设备、浏览器、操作路径与测量方法，不用主观“流畅”代替证据。

## Earth视觉资源与更新

视觉初始化位于space，程序纹理集中于earth-materials，背景/32个世界坐标InstancedMesh岩体位于earth-background。Earth原Mesh/大气、Moon、Sun Group的两子节点、原gas/ring均保留角色与动作引用；只在动作处理器捕获baseline之前设置最终材质。背景sky复用现有camera平移入口，4200星点替代两套旧Points，方向不随相机旋转。装饰不进入talkers。

installEarthActions的第五参数为可选`{visualUpdate}`；旧三/四参调用保持。唯一世界update按Ringed→Moon→Sun→visualUpdate调用；Earth原0.018自转从main迁入earth-visuals，云0.020独立自转，合法dt<=0.05、canSimulate且非reducedMotion才推进。视觉不覆盖Sun大气/halo或V3 ring opacity。9张一次性CanvasTexture约9.67MiB（RGBA8+mip估算）；数据图NoColorSpace，颜色sRGB；Earth的R高度/G粗糙度复用一张图。无GPU释放新协议，仍随缓存scene存活。

新增美术固定局部种子，移除旧背景的共享rand消耗会改变之后随机流位置；没有修改相遇算法/19秒冷却，也没有外部概率接口。开发手验采样服务仅在手动运行scripts/earth-visual-qa.mjs时，以内存响应插入同一RAF时间戳/renderer统计；不更改发布main、不模拟按键、不上传数据、不改生产白名单。契约见[ADR0005](decisions/0005-earth-visual-resources.md)。

## 魂穿契约

`src/core/embodiment.js` 在场景构建后登记默认身体、显式 entities、对白实体与可招募对象。controlled 指向当前实体，avatar 和 position 引用其物体及变换。original 保留原身体引用，返回同样要求靠近并进入视野。实体覆盖 kind、distance、height、speed、limit、scale、range 和 ground；飞行/游泳使用 mode 与空的 ground。portal 指向目标场景。followLeader 保存群体最后的同类领队，recruitables[].entity 指向对应实体。findSoulTarget 依据距离和投影选定唯一候选，main 以同一候选驱动无文字涟漪和 R；天空太阳仅在视线对准时作为跨尺度入口。场景可通过 update(dt, time, reduced) 更新环境。调用方包括 main 与四个场景，见 [魂穿决策](decisions/0002-embodiment.md) 和 [共同语言](../GLOSSARY.md)。
