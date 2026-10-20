# Earth V4：实施分步与 QA 门槛

2026-10-20 后续用户反馈明确授权：环星球远离 Sun、增强 V3/V4 可辨认度。本轮另修改环星球初始布局与 ring.scale/emissive，并为 Moon 增加临时 color；下文原“不修改牵引模块”是 V4 初版范围，本次局部反馈修订按 [修订 QA](earth-feedback-revision-qa.md) 扩展，不改原移动/时钟/中止规则。103 项记录保留为初版，修订后结果另列。

日期：2026-10-20。范围：Moon + Sun 关系合奏。状态：**用户已授权实施；步骤 0–5 的代码、非浏览器 QA 与交接文档已完成，103 项测试及完整检查通过，手动 M1–M7 待用户；不授权提交或推送。**

实际执行及原始输出见 [V4 QA 记录](earth-v4-qa-results.md)。下列扫描事实为实施前审阅快照，正式 Node 22 基线见 QA 记录。

## 0. 文档关系、基线与范围

### 0.1 当前事实与证据边界

- 设计来源：[V4 设计](earth-v4-plan.md)。沿用非浏览器验收 `V4-L1`–`V4-L11` 和用户验收 `V4-M1`–`V4-M7`。本文细化接口、实施与 QA；本次同步修订设计中的过时事实和冲突条款。
- 本地分支 `feat/earth-scene`，HEAD `4dc374a`，已包含视觉 `12e10e7`、V1–V3 及 R 魂穿集成。不是单独以视觉提交为当前 HEAD。
- 本地已缓存的 `origin/feat/earth-scene` 为 `4edaa2e`，另有 main 冲突解决及人层集成。对比该引用：Earth 四个局部模块及 `embodiment.js` 未变；`main.js`、共享移动、人层与测试已有变化。**该引用不是本次联网查询的最新远端状态，不据此宣称 PR 已合并。** 本次不 fetch/merge 或切换分支；实际开工先确定实施所基于的提交，再重跑基线。
- 工作区已有 `earth-sun.js` 未提交变体草稿，以及 README、高层计划、视觉提案和 `.gitignore` 修改。草稿不是本次产出，不覆盖或擅自格式化；实施时先检查最新 diff，并在保留已有工作的前提下补齐。
- 本次只读扫描：默认 Node **23.7.0** 下 `npm test` **85 通过、0 失败、0 跳过**。这不是项目要求的 Node 22 基线，也不是 V4 验收。此前“74 项/格式失败”为旧扫描，不能作为当前结果；本次未运行完整 `npm run check` 或 E2E。
- V1/V2 用户手验已报告通过。V3 T1–T7、视觉/性能未见后续明确通过记录，继续保留待验；提交、推送或创建 PR 不等于验收通过。
- 相遇概率配置尚未接入 Earth；现有 Moon 可邀请，Sun 按实际对象/启用状态工作。V4 不伪造概率接口，也不保证随机遇见或完成组合。

### 0.2 文件范围

| 状态   | 文件                                                                                                            | 说明                                        |
| ------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 修改   | `src/worlds/earth-sun.js`                                                                                       | 审阅并补齐已有变体草稿，保留默认 solo 路径  |
| 修改   | `src/worlds/earth-actions.js`、`src/worlds/space.js`                                                            | 局部接线与成功动作后的同步关系更新          |
| 新增   | `src/worlds/earth-relationships.js`                                                                             | 伙伴/原 Earth 身份、Moon 附加视觉与完成标记 |
| 新增   | `tests/unit/earth-relationships.test.mjs`                                                                       | V4 行为测试                                 |
| 修改   | `tests/unit/earth-sun.test.mjs`、`tests/unit/earth-actions.test.mjs`、`tests/unit/earth-ringed-planet.test.mjs` | 新契约及必要的 solo→duet 预期更新           |
| 复用   | `tests/helpers/earth-fixture.mjs`、`tests/helpers/earth-movement.mjs`、`src/core/embodiment.js`                 | 真实工厂、运动与换身 API；不默认修改        |
| 新增   | `docs/decisions/0006-earth-moon-sun-duet.md`、`docs/earth-v4-manual-qa.md`、`docs/earth-v4-qa-results.md`       | 实施时记录实际契约及证据                    |
| 修改   | V4 两份计划、`README.md`、`docs/earth-high-level-plan.md`                                                       | 状态与链接；保留其他未提交段落              |
| 不修改 | `main.js`、HTML/CSS、Moon/牵引/视觉模块、共享 core、其他世界、引擎、依赖、CI                                    | 如确需越界，先说明具体原因并修订范围        |

### 0.3 不变契约

- V1：邀请距离 `<=75`；水平半径 `48`、高度 `5`、角速度 `0.18 rad/游戏秒`；零水平偏移有显式 +X 分支。三维中心距为 `Math.hypot(48, 5) ≈ 48.2594`，不是把水平半径改为 48.26。减弱动态固定相对偏移随行。
- V2：Sun 初始位置 `(-110,65,-100)`，但 **R 接管后可被移动，不是不可移动常量**。动作 `<=100`、取消 `>150`；3 秒回应、5 秒冷却，dt 上限 `0.05`，容差 `1e-9`；减弱动态包络权重 `0.35`；暂停仍维护性清理。
- V3：动作优先级 Moon → Sun → 有环星球；最终夹取/位移反馈在局部更新之前；顺序 ringed → moon → sun → visualUpdate。V4 不改变速度、牵引预算或取消规则。
- 工厂保留四主要天体、三 talker、原有 `entities` 与各 `embodiment` 登记。不要把装饰岩体、云层算成额外主要天体，也不要以“库存不变”为由删除 R 的实体记录。

## 1. 需要明确解决的冲突

| 问题                                                       | 实施决定                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `world.position/avatar` 随 R 换身指向 Moon、Sun 或有环星球 | 合奏只在控制原 Earth 时可选择；初始化捕获 `world.globe.parent` 为原 Earth Group，不能在换身后从可变 `world.avatar` 重新捕获，也不能只看 kind（有环星球也是 planet）                                         |
| 工厂先构建 Earth，main 才调用 `prepareEntities`            | 已有 controlled 时按 `world.controlled.object === originalEarth` 校验；未登记的独立工厂按 `world.avatar === originalEarth` 校验。运行时身份不匹配不能回退为有效                                             |
| duet 中途 R 换身                                           | 视为本次 Moon 参与失效，恢复附加视觉、记录 droppedId，不计完成；Sun 沿用原时钟/solo 部分，不重置、不新增反馈。返回原 Earth 同一 id 不重入，下一次有效 E 可重新 duet                                         |
| 原 Moon/Sun 跟踪使用当前身体中心                           | 这是已存在的共享语义；V4 不顺带重写。尤其 orbiting Moon 被接管后，Moon 更新可能覆盖玩家位移，属于既有风险，不能声称 V4 修复。新增合奏不得加新位移或重挂对象；若手验要求解决该问题，另列修复范围，不掩盖失败 |
| “原断言全部不改”与新体验矛盾                               | 保留默认 solo 单测；仅实际已邀请 Moon 的组合测试可更新预期反馈/提示为 duet，并保留状态、距离、计时、资源断言。明确记录受影响测试，不删除或放宽有效断言                                                      |
| 材质替换后不恢复旧材质                                     | 关系持有并恢复自己写过的原材质，即使 Mesh 已换材质/移除；绝不写替换材质、不重新赋回旧材质。否则旧材质重新挂回时会残留发光                                                                                   |

## 2. 默认值与最小接口

| 项目           | 默认                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| variant        | `solo` / `moon-duet`，接受 E 时锁定                                            |
| duet 提示/反馈 | label `与月亮回应光芒`（共享 UI 加 E）/ `这一次，光也照见了你的同行者。`，原创 |
| Moon 视觉      | 暖色 `#efc58b`；有效附加 emissive 峰值 `1.2 × Sun weight`                      |
| 标记           | `world.earthState.relationships.moonSun.hasCompleted`，页面内布尔值            |
| 响应与冷却     | Sun 唯一的 3 秒 / 5 秒时钟，不另扣 dt                                          |

```js
createMoonSunRelationship(world, moon) → {
  selectVariant(context), // 无副作用；有效则返回复用的 duet 描述，否则 null
  update(context, sunView), // 只消费视图，维护/视觉/结束事件均须幂等
}
```

Sun 草稿已有 `selectVariant`、`responseId`、`variant`、`lastEnd`、`getResponseView(reducedMotion)`。视图形状为 `{id, variant, responding, weight, lastEnd}`，**没有独立 progress 字段**；关系直接用 weight，不复制 remaining 或计算第二个包络。视图对象复用，按调用约定只读、不可保留为历史快照；它不是被冻结的不可变对象。`lastEnd` 是独立结束记录 `{id, variant, reason}`，通过 id 去重。

## 3. 实施步骤与 QA 门槛

### 步骤 0：确认实施基线

1. 读取最新 status/diff，确认已有草稿归属和接续范围；不能因未提交就丢弃。若用户已明确授权在其上实施且没有并行修改证据，不重复索要许可。
2. 确认实施采用本地 HEAD 还是同步后的分支；同步不夹带未提交工作。本轮选用本地 HEAD `4dc374a` 和已保存的工作区草稿，不执行同步。
3. 使用项目要求的 Node `>=22.13 <23` 执行 `npm run check`；保存命令、版本、完整输出路径、pass/fail/skip 数与失败名称/原因。若环境不满足则记录环境缺口，不能把 Node 23 扫描当正式通过。
4. 记录 Moon 材质基线、主要天体/talker/entities/资源引用，以及 R 可改变玩家身体与 Sun 位置的事实。

**QA：**正式基线全绿，或逐项处理并记录失败后重跑；确认未覆盖草稿。非浏览器全绿不要求等用户提前做 V4 手验。性能/heap 为条件专项，不新增强制采样阻塞；如执行，GC 诊断与普通无标志性能会话分开，保存设备/浏览器/viewport/DPR/减弱动态/路线与原始样本。未测不写达标。

### 步骤 1：补齐 Sun 变体和结束视图

- 查询和执行均调用 `variantFor(context)`，执行重查；无 selector/返回 null 时保持 V2 solo 原文与行为。
- 每次接受 E 自增 responseId，锁定 variant；查询/repeat/拒绝不能递增。`lastEnd` 每个 id 仅写一次，原因 `complete` / `out-of-range` / `disabled`。
- cooldown 自然结束调用 reset 时不再生成 disabled；显式禁用或对象失效在 responding 时生成 disabled，暂停 update 也维护清理。
- 复用同一视图；无响应 weight=0；减弱动态 responding 权重固定 0.35。结束原因在下一回应/冷却时保留并按 id 去重，不能误判历史完成。
- 可见性/引用/detach 检查沿用真实 Sun available 契约。Sun 的球体材质不是此模块修改字段，不凭空扩展为“材质替换必取消”。

**QA：**原 solo 单测通过；新增默认兼容、selector 纯查询、stale prompt、重复 E、唯一结束原因、冷却边界、余 dt、暂停禁用和复用视图测试。不得仅检查 responding→cooldown 来猜成功。

### 步骤 2：关系状态、身份与 Moon 视觉

- 使用 `??=` 合并 `earthState.relationships.moonSun`，不重建 Moon/Sun/牵引或顶层状态。
- 有效伙伴必须：控制原 Earth、moon.status=orbiting、world.moon 是捕获原 Moon、parent 是原 scene、moon/scene 可见、material 为捕获原材质。`invitable=false` 不表示已失去伙伴；不要求 Moon 也距 Sun <=100。当前没有通用对象禁用接口，不伪造该接口。
- 捕获原 color、emissive Color 数值和 intensity。表面色按 0.55 × weight 混合暖色，结束/失效精确恢复。有效 duet 时，以线性颜色空间计算 `原 emissive × 原 intensity + 暖色 × 1.2 × weight`，写入复用 Color 并将 intensity 设为 1。结束/失效时精确恢复原字段，原 Color 对象身份保持，不 clone GPU 资源。
- 捕获 Moon 身份固定，不需每帧从 world.moon 接受新参与者。id 已失效则标记 droppedId；detach/隐藏/引用或材质替换/R 换身后，同一 id 恢复也不重入。
- 按新 `lastEnd.id` 处理一次：仅 duet + complete + 本次未 dropped + 此刻伙伴有效才置 hasCompleted。新世界重置，过去完成不被之后的取消清空。
- 清理不藏在 canSimulate 分支后；暂停时允许恢复/失效检测，但不独立推进时间。检测按动作与 update 的实际观察点进行，不声称捕获未发生 update 的瞬时外部对象修改。
- 恢复直接写捕获的旧材质，即使它已不在 Mesh 上；不修改新材质，不改变位置/轨道/parent，不替 Sun 恢复大气或 halo。

**QA：**V4-L1–L9。用真实 Moon 邀请和 Sun 响应建立事件链；外部 detach/hidden/换材质作为明确故障注入。含非黑 emissive、非 1 intensity 的基线及 100 次循环，验证表面色、emissive、intensity 和引用精确恢复；R 测试走 prepareEntities/inhabit，不只改 status。

### 步骤 3：局部接线和动作当帧同步

- `space.js`：Moon 创建后创建关系（此时捕获原 Earth Group），把 selector 作为 Sun 最后一个 options 参数注入。保留原 Sun talker、entities、embodiment 与 visualUpdate；不重装 Moon。
- `installEarthActions` 最后一个 options 扩为 `{ visualUpdate = null, relationship = null }`，保留现有参数顺序与 ringedPlanet 默认值。
- 每帧顺序：ringed → moon → sun → relationship.update(context, sun.getResponseView(context.reducedMotion)) → visualUpdate；最终移动/夹取仍在这之前。
- E 接受 Sun 动作并返回非 null 反馈后，**同一调用中**同步一次关系视图，dt=0，不调用 Sun.update/不扣时间，避免 Moon 在减弱动态下晚一帧亮起，也及时登记新 id。这不是第二个模拟更新；关系 update 必须幂等。Moon/牵引成功不产生假 Sun 开始事件。
- 没有 relationship 时完全保留原路径，不调用不存在的 getResponseView；旧 stub 处理器无需补新方法。
- Sun.setEnabled(false) 自身立即恢复原字段；Moon 附加字段在下一次关系维护调用清理（正常 world.update 含暂停）。不宣称直接调用 Sun 内部方法可同步通知独立关系模块；显式测试这一边界。

**QA：**调用顺序与次数、动作当帧 dt=0、暂停清理、无 relationship 兼容、view 缺省 stub、R 进入/返回身份测试。资源库存和原 Earth/Moon/Sun 状态身份不变。独立测试“E 后 R、首个模拟帧之前已换身”不得完成 duet。

### 步骤 4：组合回归与静态交付

- 使用真实工厂 `tests/helpers/earth-fixture.mjs`；其 canvas 绘制 stub 不能证明 Shader/画面。需要 R 时显式调用 prepareEntities，不能假定工厂自动登记 controlled。
- `earth-actions.test.mjs` 中“actual double eligibility…”与“reduced-motion Sun response…”已先邀请 Moon，实际接线后应期待 duet 文案；保留原状态、轨道、计时与光照断言。
- `earth-ringed-planet.test.mjs` 中“real final center feeds…”同样需更新已邀请后的反馈为 duet；保留原三 handler 顺序断言，并另测 relationship/visualUpdate 插入顺序。其余 solo 场景继续用原文案，不全局替换。
- V4-L11：先启动 duet，再用真实运动反馈使 Earth 越过 Sun 150 范围；可在测试中明确调整布局以触发，不能把该布置冒充默认可达路线。证明 Sun 取消、Moon 恢复、完成不置位，牵引预算仍只按实际位移。
- Node 22 下 `npm run check` + 本次变更的 `git diff --check`；保存完整输出与准确测试数，不预写最终计数。若失败先记录再修复重跑。
- 按用户既定分工，不运行浏览器自动化、不下载浏览器、不改 E2E/CI；逻辑/API/脚本由 Codex 验证，画面与控制由用户执行。

**QA：**V4-L1–L11 均有实际通过证据；旧有效业务断言保留，必要体验预期变化有逐项解释。若新集成分支增加测试，全部纳入，不沿用本次 85 项计数当结果。

### 步骤 5：ADR、用户检查与状态

- ADR 0006 记录 selector、借用只读视图、结束记录、Moon emissive 所有权、R 资格和失效清理、动作同步点。
- `earth-v4-qa-results.md` 逐步记录代码/命令/输出、实际失败与修复、原有风险、待用户项，不把未执行写 Pass。
- `earth-v4-manual-qa.md` 沿用 M1–M7，提供 solo/duet 路线和预期。因 Sun 可移动，对照测试先刷新保持初始布局；测试必须先确认控制原 Earth。M4 补 duet 中 R 换身、返回原 Earth、下一次动作，核对无合奏残留/重复完成。
- M7 覆盖 Moon/Sun/有环星球 R 入口和返回、四层/草岛招募/声音/帮助及 V3 中止；说明既有 R/Moon 跟随风险，不能把测试通过等同于该问题已修复。V3 与视觉原待验记录独立保留。
- 更新 README/高层计划对应链接和状态。停在用户手验；未获后续授权不提交、不推送。

**QA：**文档与实现一致，无悬空链接；L 项通过不等于 M 项通过。只有用户报告通过后才记录手验完成；性能专项未测继续写未验证。

## 4. 非浏览器验收映射

| 编号   | 必须证明的结果                                                            | 位置                          |
| ------ | ------------------------------------------------------------------------- | ----------------------------- |
| V4-L1  | 未邀请 solo，有效 orbiting duet；invitable 不混用；非原 Earth 不提供 duet | relationships                 |
| V4-L2  | 查询纯、执行重查、stale duet→solo、repeat 不产生新 id                     | relationships/sun/actions     |
| V4-L3  | solo 中邀请不升级；duet 失效或 R 换身后恢复不重入                         | relationships/真实 embodiment |
| V4-L4  | 同一 weight、3+5 秒、余 dt、边界及动作当帧同步不重复扣时                  | sun/actions                   |
| V4-L5  | 完成仅记一次；取消/禁用不记；历史完成保留                                 | relationships                 |
| V4-L6  | 非默认 emissive 基线与 100 次完整恢复；Sun 字段所有权不变                 | relationships                 |
| V4-L7  | detach/隐藏/身份失配/换材质/暂停维护；恢复旧材质不碰新材质                | relationships/sun             |
| V4-L8  | 暂停/非活动不推进；返回正确；新工厂独立；真实 R 身份隔离                  | relationships/actions         |
| V4-L9  | 减弱动态 0.35 稳定响应、Moon 固定相对偏移，移动与完成同时断言             | relationships/actions         |
| V4-L10 | 四主要天体、三 talker、entities 和资源集合不变；无 relationship 向后兼容  | actions/工厂                  |
| V4-L11 | 实际最终位移导致 Sun 越界取消；牵引预算/优先级不变                        | actions/真实运动              |

## 5. 风险与开放项

- 1.2 只为眼检初值，不能从 Node Color 断言推导可辨认度；Moon 可能被 Earth 遮挡，允许拖动观察，不拉动轨道或接管镜头。
- R 与原跟随的既有位置所有权问题保留为独立风险，V4 只隔离新增合奏语义。若决定一起修复，需先扩充 Moon/共享集成范围与 QA，本计划不隐含授权代码变更。
- 远端缓存引用与工作区都可能继续变化，实施前按实际提交重核；本次没有确认 GitHub PR 状态。
- 所有性能与资源泄漏结论须依赖对应实测；资源引用稳定不是 GPU/heap 无泄漏证据。现有 V3/视觉待验不能被 V4 文档更新自动关闭。

## 6. 本轮执行状态

步骤 0：Node 22.20.0 正式基线 85/85；首次 Sun 草稿格式失败和修复输出均已保存。步骤 1–3：契约/关系/接线专项 53/53；步骤 4：完整检查 103/103、lint/格式/build 和 26 模块 HTTP/发布核对全部通过；步骤 5：ADR、原始证据、逐项记录和用户 M1–M7 已交接。见 [V4 QA](earth-v4-qa-results.md)。

V4-M1–M7 等待用户；性能/heap、V3 与视觉旧手验继续保留待验。当前没有提交、推送或合并。

## 7. 与视觉计划的当前对齐

已复核 [视觉实施计划](earth-visual-implementation-plan.md)：当前构建同时包含该计划 S1–S6 与 V4 的 Moon 暖色响应；没有需在 V4 中重做的已承诺视觉代码项。背景/材质/云/岩体继续复用，Moon 附加色调/emissive 与基础 map/bump 分开，Sun 大气/halo、V3 ring opacity、visualUpdate 地表/云旋转各有唯一所有者。更新为 ringed→moon→sun→relationship→visualUpdate，动作同步点不重复计时。九张纹理与原对象资源库存不增加。

视觉提案中的概念图细节不因此升级为承诺：真实地理/城市夜灯、真实投射环影、体积光、密集碎石不属于本轮已实施范围；Sun 缓慢表面旋转是静态效果不足时的条件性方案，当前不启用，待眼检决定。视觉 V0–V8 与 V4 M1–M7 仍各自待用户，原性能门槛未测，不能由 103 项 Node 测试替代。
