# 架构与协作边界

## 运行方式

浏览器直接加载静态 HTML、CSS 和 ES Modules，不需要应用框架、后端或打包器。Three.js r170 从原始 HTML 的内嵌模块按字节提取到 `vendor/`，本次未升级引擎。Node.js 仅用于本地服务、检查、测试和静态发布目录生成。

```text
index.html                 语义结构、入口与操作提示
src/main.js                会话状态、输入、切换、镜头、对白触发、音频与动画循环
src/styles.css             现有界面样式与响应式布局
src/content/worlds.js      四层名称、尺度、镜头与移动参数
src/core/random.js         可复现的随机数生成器
src/core/world-actions.js  主动作分派、共享允许条件与提示 DOM 适配
src/worlds/index.js        场景工厂装配
src/worlds/shared.js       地形、植被、光照、天空与共用渲染工具
src/worlds/micro.js        草层
src/worlds/human.js        人层
src/worlds/island.js       岛屿层
src/worlds/space.js        星球层
src/worlds/earth-moon.js   现有月亮的邀请、两态和局部轨道
src/worlds/earth-sun.js    太阳距离光照、回应/冷却、启停恢复
src/worlds/earth-actions.js Earth 局部主动作选择与一次更新组合
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

共享工具作为参数注入四层，避免场景直接依赖主控制器。地面高度函数同时用于地形、角色和镜头，修改时三者需要一起验证。

## Earth V1 的可选动作与更新契约

`main.js` 为唯一控制器，复用一个 context 对象：`dt` 是已限制到最多 0.05 秒的本帧游戏时间，`canInteract` / `canSimulate` 都要求已进入游戏、帮助关闭、未转场；`reducedMotion` 是启动时的系统偏好。只对活动世界调用可选 `update(context)`，顺序为移动及边界夹取 → 世界更新 → 现有动画与镜头 → 提示及原相遇检测 → 渲染。非活动世界不更新；没有回调的世界保持原行为。

可选 `getPrimaryAction(context)` 返回只读 `{label}` 或 null，无副作用；可选 `onPrimaryAction(context)` 重新检查当前资格，成功返回反馈文本，否则 null。E 过滤重复按键，草仍走 recruit；其他世界动作被拒绝时不回退到草。提示每帧查询、仅变化时写 DOM，帮助和切换时立即隐藏；不再由低频 encounter 更新覆盖。

Earth 保存 `moon`（原 Mesh 引用）、`earthState.moon = {status, phase, invitable}`。`invitable` 是局部动作资格标志，不是概率配置。Moon 不存在、被移出 scene 或不可邀请时不显示/执行邀请，不生成替代天体。状态 available → orbiting，不可解散；距离按中心三维 `<=75`，不要求随机对白先发生。

入轨复用原 Moon，零水平朝向显式选 +X；水平半径 48、高度 5、角速度 0.18rad/游戏秒，中心取最新 `w.position`。帮助/转场/非活动冻结相位；减弱动态时固定相对偏移随行；刷新新建世界重置关系。Moon 保持 scene 子节点，避免继承 globe 自转。月亮与有环星球继续使用原 talkers 与共享 19 秒冷却。

V1 新增代码不创建 GPU/音频资源、监听、RAF 或网络请求；继续沿用场景缓存寿命。新增 Node 测试覆盖逻辑、真实 Three.js 对象装配及动作/提示接口；测试里的纹理绘制 stub 不代表画面验收。实际键鼠、构图与声音由用户按检查单验证。本轮明确跳过浏览器自动化，现有 E2E 与 CI 保留。

## Earth V2 的局部组合与光照

V1 的用户手验已获确认；V2 S1–S7 新体验也已由用户确认通过。`createMoonCompanion` 与 `createSunResponse` 返回局部处理器，不抢占共享回调；兼容 `attachMoonCompanion` 保留。`installEarthActions` 一次安装世界回调，Moon优先、Sun其次，每次 E 重新检查并只执行一个对象；每帧按 Moon→Sun 各更新一次。main、core/world-actions、移动参数和其他世界无需更改。

世界新增 `atmosphere`（原壳引用）、`sunBody`（球体+halo的Group）、`sunHalo` 和内部 `earthActions.{moon,sun}`；`earthState.sun={status,remaining,enabled}` 与原 Moon 状态共存。Sun 主动范围100、talker范围120，三维距离；只追加一条原创 talker，仍走共享对白。

Sun 位于(-110,65,-100)，球半径18、halo半径24；复用原 DirectionalLight，position 来自 Sun、原target移入scene并跟随最新玩家中心，显式更新矩阵。80–150范围内 smoothstep 增强主光3.8–4.75；正常 `1-exp(-4dt)` 插值，减弱动态直接目标。响应3秒后冷却5秒，dt合法正数且最多0.05，余时间跨状态消费。d>150取消回应并从完整5秒冷却开始。

响应仅从保存的原大气色/halo尺度派生一次 sin 包络，暖色#efc58b、最大尺度1.08；减弱动态暖色权重0.35、不缩放。帮助/转场/非活动冻结。Sun内部setEnabled(false)恢复V1原灯光/target父关系/原色/原尺度，移除精确Sun talker；显式enable复用所有资源。意外移除/隐藏/引用失配在下次活动update清理，即使暂停也维护，但不推进动画。正常远离仅恢复距离基线，光仍来自Sun，与禁用恢复旧方向不同。

资源仍随缓存场景保存，无新RAF/监听/网络/音频/卸载协议；新增普通球体与halo仅建一次。Node检查对象/矩阵/引用，GPU/heap/实际帧率未测。可选heap诊断与普通配置性能测量分会话，无强制GC视为常见未验证情况；不影响日常代码工作。

## 当前限制

场景首次使用时创建并缓存，离开不会释放 GPU 资源；刷新才完全重置。主控制器仍包含输入、音频和对白，后续按真实任务逐步拆分。场景工厂嵌套函数沿用 Demo 结构，避免一次重写引入行为偏差。

共享随机源为固定种子，但各层首次进入的顺序会影响随机消耗，因此不同访问顺序的场景细节可能不同。当前尚未承诺跨会话完全一致的世界。

## 分工建议

每个尺度的视觉与实体改动优先限定在对应文件。改动 `main.js`、`shared.js`、层索引、工具参数、根规范或 CI 时，在关联任务中先说明影响。对白暂在各场景内，独立内容结构与音频模块是后续任务，不能假定已经存在。

新增事件监听必须有明确生命周期；新增 GPU/音频资源说明复用与释放策略。性能测量记录设备、浏览器、操作路径与测量方法，不用主观“流畅”代替证据。
