# Earth V3：实施与 QA 记录

日期：2026-10-17。基线：V2 `fef2dcb`，V1/V2用户浏览器验收均由用户明确确认通过。V3由用户授权实施，现已明确授权在 `feat/earth-scene` 本地提交；不推送。

**当前：V3代码就绪，全部62项测试、格式/lint/链接/原件/服务/构建通过；用户T1–T7待验。** 不控制浏览器、不运行/新增E2E、不下载浏览器。用户旧版本通过事实不代替本次共享输入改动的回归。

## 修订与环境

按本轮反馈修订实施计划步骤0与性能说明：GC/heap诊断与代表性性能分会话。前者可能需特殊启动标志/CDP/DevTools；普通页面没有可靠GC是预期，记未验证；后者用与基线一致的普通配置，不混入诊断帧率。本轮两项均未做且非日常门槛。

Node v22.13.0（通过本机已有安装的bin前缀选择），macOS。系统默认node是23，本轮检查明确使用仓库要求的22。基线`npm run check`全通过：38测试、格式、lint、链接/原件/服务及build。

## 实际代码契约

- `createMovementInput`：keydown/keyup/blur/refresh/finishStep；方向/blur按事件world锁存到该world的update结束，短按不丢，跨世界不误消费。
- `createMovementStepper()`：返回step(world, settings, yaw, keys, context)，复用请求/结果；正常移动→原夹取→查询/校验→实际影响/最终夹取→反馈。frame为单调stepId。
- Earth冻结limits `{speed:6,maxDistance:12}`被共享辅助真实消费。请求`{x,y:0,z,duration}`，反馈`{stepId,accepted,x,z,distance,duration,clamped,blocked,reason}`，附正常输入的moving/方向供原转向使用。
- `createRingedPlanet(world,body,gas,ring,talker)`：返回局部动作/影响查询/update/setEnabled；不写玩家位置，不新增资源，elapsed/spent只认有效反馈。状态ready→pulling→cooldown→ready；诊断stopReason可区分完成、取消、边界、失效和拒绝原因。
- `installEarthActions(world,moon,sun,ringedPlanet=null)`：保留旧调用，Moon→Sun→Ringed现场选一个动作，更新Ringed→Moon→Sun。世界只安装一次；主循环仅一次调用运动及update。

## 测试证据索引

新增测试文件：[运动](../tests/unit/world-movement.test.mjs)、[行星与真实场景](../tests/unit/earth-ringed-planet.test.mjs)。测试中的可控位置/布局是Node夹具，不是生产传送接口；生产模块在同一夹具里执行。仅canvas绘制stub，不使用WebGL。

| 索引 | 实际测试（标题前缀）                                                        | 证明范围                                                                                                          |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| W1   | production normal movement… / V2 movement equivalence…                      | 四层速度、yaw、WASD/箭头、对角、松键、y及边界；320个任意起点与V2公式对照                                          |
| W2   | pure influence is clamped… / influence queries see the clamped player base… | 24方向的最终边界、实际影响归属、正常输入边界基点，拒绝不抹掉正常移动                                              |
| W3   | movement rejects malformed… / step feedback is reset…                       | 非有限/非水平/duration/速度/单次预算拒绝、暂停/非法dt、同step幂等、无请求归零                                     |
| W4   | opposing keys remain input intent… / input latches belong…                  | 抵消键仍有意图、8方向短按/blur锁存、按world消费，不误取消非活动Earth                                              |
| R1   | real scene independently reaches… / 3D eligibility… / queries are pure…     | 实际工厂独立路线、范围129.999/130/130.001/高度、零水平方向、无效limit、dt0启动、查询纯、旧提示/重复拒绝           |
| R2   | multiple dt schedules… / invalid delta… / budget-limited last request…      | 0.01/0.025/0.05/混合dt，2秒/12单位/6秒、最后部分帧、余dt、非法dt/大dt上限、159.999/160/160.001                    |
| R3   | actual feedback alone consumes budget… / cooldown boundary…                 | 请求不扣预算，反馈重复不扣两次，旧/缺失反馈不伪造移动、冷却0.05/0.001边界、零方向停止                             |
| R4   | all eight movement keys… / boundary probe denies… / help/transition pauses… | 8方向与抵消、W→E拒绝/E→W取消、短按/blur、玩家当帧38速度、边界probe/实际1.17部分位移/blocked、暂停/返回重查        |
| R5   | disable and accidental detach…                                              | ready/pulling/cooldown下显式禁用/误移除/hidden/引用替换/子对象缺失；暂停维护、精准talker、原对象恢复/冷却保留     |
| R6   | real final center feeds… / three-action priority…                           | 真实共享移动→Ring/Moon/Sun各一次，最终中心/相位/灯光矩阵/强度、容器身份、库存与动作优先级                         |
| R7   | reduced motion keeps deliberate traction… / ring envelope peaks once…       | 实际牵引与稳态ring、固定Moon偏移/相位、Sun原规则；0.8→0.95→0.8包络、100全周期/10启停引用稳定、内容与材质基线/刷新 |

## 逐门槛结果

“通过”是所述非浏览器证据通过；每一步用户项另列待验。未宣称没有GPU/heap泄漏或实际流畅。

| 步骤 / 门槛 | Codex结果与证据                                                                                                                                    | 用户项          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 0-A/B/C     | 通过：38项baseline；W1/R1/R6。实际位置行星水平274.5906，最短3D84.63899；(-60,0,-170)无Moon/Sun资格、可用行星；最终(-69.9846,0,-176.6564)仍在圆盘内 | T1待验          |
| 1-A         | 通过：W1，四层生产移动及320起点V2等价                                                                                                              | T7待验          |
| 1-B/C       | 通过：W2/W3，最终夹取/非法请求/幂等及玩家输入归属                                                                                                  | T4待验          |
| 1-D/E       | 通过：W3/W4/R4，按键顺序/短按/blur/暂停，无旧反馈；原world-actions测试保留                                                                         | T3/T5待验       |
| 2-A/B       | 通过：R1，dt0真实交互资格、查询纯、重新检查及20次重复                                                                                              | T1/T2待验       |
| 2-C/D       | 通过：R2/R3，时长/预算/冷却/余dt/取消完整冷却、禁用冻结/新工厂ready                                                                                | T2/T5待验       |
| 2-E         | 通过：R3/W2，实际反馈唯一归属、缺失诊断、同step不重复                                                                                              | 无需精确手量    |
| 3-A/B       | 通过：R5/R6及原V1/V2有效库存/身份断言；Moon/Sun/Ringed优先级与独立路线                                                                             | T1/T6待验       |
| 3-C/D       | 通过：R4/R6，真实共享移动/部分位移/取消/最终中心跨模块；main源码顺序审查                                                                           | T6待验          |
| 4-A/B       | 通过：R4/W4，首次夹取立即停、1.17实际预算，无滑行/后续位移，反向输入正常；8方向/blur完整冷却                                                       | T3/T4待验       |
| 4-C/D       | 通过：R4/R5，冻结/不补算/返回重查、暂停失效维护、原talker精确增删、enable不绕过冷却                                                                | T5待验          |
| 5-A/B/C     | 通过：R6/R7，原ring反馈/减弱动态/100周期恢复；源码无say/lastTalk调用，talker原文/来源/范围不变                                                     | T1/T2/T6/T7待验 |
| 6-A         | 通过：npm run check，62/62（原38+新增24）；原38项断言未改，E2E/CI保留且未运行；6资源字节一致、16模块导入/HTTP/MIME通过                             | T7待验          |
| 6-B         | 通过：R7，100全周期与10启停scene/geometry/material/texture引用集合稳定；不证明GPU/heap无泄漏                                                       | 流畅度T7待验    |
| 6-C         | 通过：main只有一个原RAF/Clock/AudioContext、一次step/update；Moon/Sun业务、其他world/参数、依赖/构建/服务/CI无diff                                 | T7待验          |
| 7-A/B       | 通过：本记录、ADR0004、架构、README、帮助与手验单已同步；链接/格式检查通过                                                                         | 无需中途操作    |
| 7-C         | 待用户T1–T7，通过前不记体验验收完成                                                                                                                | 待验            |

## 主循环接线审查

keydown先更新真实键集合与事件world锁存，再为E刷新context；keyup不清中止；blur清键并锁存。帮助/切换保留原clear held keys。每帧refresh→stepMovement→原人物转向→world.update（Ringed→Moon→Sun）→消费该world锁存→原动画→placeCamera（同步avatar）→提示/encounter→render。提示仍用dt0，轨道与光照使用w.position而不是稍后同步的avatar。

新增运行时仅world-movement与earth-ringed-planet；既有main、space、earth-actions接线，以及帮助文字。未修改Moon/Sun业务文件、world-actions、其他builder、速度表、vendor、prototypes、依赖、CI、E2E、构建/服务脚本。既有未提交V4/视觉提案与资产保留。

## 执行命令与结果

```sh
PATH=/Users/naughtyrex/.nvm/versions/node/v22.13.0/bin:$PATH npm run check
# prettier、eslint、62/62 Node测试、static build全部通过；0失败/0跳过。
git diff --check
# 通过。
```

另用一次性Node脚本直接调用createStaticServer(dist)，端口自动分配，验证6个变更运行时资产与src/index原文件逐字节一致；从main递归遍历所有16个静态模块导入，每个HTTP 200、text/javascript及正文与dist完全一致，结束即关闭server。无浏览器、无WebGL、不改服务脚本。此项输出：`PASS: 6 changed assets byte-identical; 16 runtime modules/imports served from dist with JS MIME and exact bytes.`

## 尚未验证

用户执行[T1–T7手验](earth-v3-manual-qa.md)：可发现性、实际事件/焦点、画面/星环/镜头、声音、流畅度。浏览器自动化按用户要求未运行。普通配置定量性能、诊断配置GC/heap、GPU内存均未测，不设为本轮自动化阻塞条件。用户已授权本地提交V3；未推送、未发布。
