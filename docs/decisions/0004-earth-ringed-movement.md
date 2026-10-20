# 0004：Earth 有环星球的有限牵引与受控移动反馈

- 日期：2026-10-17
- 状态：接受为本轮本地实现契约；依据用户明确授权执行修订V3全部步骤，不表示其他维护者已审阅/合并
- 关联：[V3实施与QA](../earth-v3-implementation-plan.md)、[V3设计](../earth-v3-plan.md)、[前序组合](0003-earth-sun-composition.md)

## 问题与范围

V2直接在main处理正常移动与夹取，随后Moon→Sun更新；在普通update直接写牵引会绕过边界或使Moon/Sun使用旧中心。V3只需要一个有界的主动额外位移，不需要物理引擎或修改其他世界参数。

## 契约与调用方

`src/core/world-movement.js`导出createMovementInput/createMovementStepper/simulationDelta/clampMovement/isMovementKey。main创建输入与移动辅助各一次，提取原有归一化/视角旋转/位移/夹取算法，原角色转向和动画保留在main。world.position.y始终不受水平移动影响（四层运行时position.y本来为0）。

```text
实时输入/dt/stepId/参数表limit
  → 正常移动/夹取 → 保存玩家移动结果P
  → world.getMovementInfluence(context, reusableOut) 或null
  → 校验 → 唯一应用 → 最终夹取
  → movementResult = 最终位置 - P
  → ringed.update → moon.update → sun.update
  → 原动画/镜头/提示/相遇/render
```

context新增hasMovementInput（任一方向键含抵消）、movementInterrupted、movementLimit、stepId、movementResult；保留V1/V2updateActionContext签名。提示/E刷新dt=0仍能通过资格；只有运动/计时要求有限正dt，最多0.05。

输入helper使用同一held-key Set，按事件所属world保存中止锁存；方向keydown和blur置位，keyup不清除，完成该world运动/update才清除。帮助/切换只清held keys，不虚构中止。弱引用的输入锁存避免Outgoing Earth的blur被下一层RAF误消费，也避免其他层移动误取消被冻结的pull。沿用原事件监听，无新增监听。

请求`{x,y:0,z,duration}`只写调用方复用缓冲，不改位置/状态。world.movementInfluenceLimits使用Earth模块的冻结`{speed:6,maxDistance:12}`；共享层实际读取、拒绝非法向量/duration/超限。实际反馈复用`{stepId,accepted,x,z,distance,duration,clamped,blocked,reason}`，附正常移动moving/directionX/directionZ供原转向使用。重复同step不重复施加；无请求反馈归零。主控制器frame是单调stepId，一帧只处理一个活动世界。

Earth组合器追加ringed候选（Moon→Sun→Ringed），getMovementInfluence委托ringed；更新Ringed→Moon→Sun各一次。space保存原p/gas/ring/talker，新增局部处理器但不增加主要天体、材质或灯光。Moon/Sun业务文件、共享world-actions、其余builder/参数/镜头/音频/E2E/CI不改。

## 状态与中止

ready→pulling→cooldown→ready；范围130/外范围160，启动1单位probe不需夹取，speed6、duration2、实际累计budget12、cooldown6。每step只消费一次匹配反馈且不得认领启动前结果；缺失/拒绝反馈安全停止，stopReason保留诊断。首次夹取/blocked消费实际部分后即停，不沿边滑行。正常结束消费余dt，方向/blur/边界/失效取消帧从完整6秒开始。

方向意图先取消影响再正常移动；E先方向后允许一次已有toast但无牵引，方向先E拒绝。帮助/转场/非活动冻结，无追赶计时；对象失效及输入中止维护可在暂停执行。禁用精准移除原talker、恢复原星环，pulling进完整冷却，禁用期间冻结；enable复用原引用并保留冷却。误移除不会被自动重新添加。

ring仅从基线0.8派生单次sin包络（最大0.95），减弱动态0.88稳定反馈，结束恢复；不改变Sun灯光/大气，不调用say/lastTalk，不增加联动条件。

## 验证与边界

原38项前序测试保留；新增测试使用生产移动helper和真实Three.js场景（仅程序纹理绘制stub），验证位移/预算/矩阵/对象身份，不证明WebGL画质。非浏览器结果见[V3 QA记录](../earth-v3-qa-results.md)；T1–T7待用户。可选heap诊断与普通配置性能必须分会话，无可靠强制GC常见且记未验证；本轮不执行浏览器自动化。

无新增GPU/音频资源、网络请求、RAF、时钟、依赖、发布流程或存档；资源仍随原缓存scene存活。用户已授权在 `feat/earth-scene` 本地提交；不推送/合并/部署。
