# 0003：Earth Moon/Sun 组合与局部光响应

- 日期：2026-10-17
- 状态：接受为本轮本地实现契约；依据用户明确要求执行修订 V2 全部步骤，不表示其他贡献者已审阅或合并
- 关联：[V2 实施计划](../earth-v2-implementation-plan.md)、`DESIGN-01`、`PERF-01`、`A11Y-02`

## 问题与约束

V1 `attachMoonCompanion` 独占世界三个回调并创建 earthState；Sun 若同样安装会覆盖 Moon。共享控制器的输入/UI/dt 接口已能承载两个对象，不需要新事件框架、动作 ID 或主循环。

## 决定与理由

从 Moon 提取 `createMoonCompanion(world, moon)`，返回 getPrimaryAction/onPrimaryAction/update；原 attach 包装保留。只合并 moon 字段并保留既有状态身份。Sun 用 `createSunResponse` 返回同样处理器，加内部 setEnabled；`installEarthActions` 安装世界回调一次，查询与执行当时均按 Moon 优先、Sun 次之，每帧 Moon→Sun 各更新一次。

Sun 是一个 Group（BasicMaterial 球体 + 一层现有大气算法的 halo），独立于复用的 DirectionalLight。保存原大气引用；Sun talker 追加，不改原两条内容/范围。主光位置来自 Sun，target 来自最新 w.position，并显式同步矩阵；不读取稍后才同步的 avatar，不改变 main、共享路由、其他世界或移动参数。

持续效果由距离 smoothstep 导出强度 3.8–4.75，普通模式用 `1-exp(-4dt)` 插值，减弱动态直接用距离目标。回应只影响大气颜色和 halo 尺度：3 秒有限包络后 5 秒冷却；减弱动态为稳定暖色保持，不缩放。计时只消费有限正 dt（最多 0.05），跨状态保留剩余时间，1e-9 秒浮点边界容差。d>150 取消回应，取消帧开始完整冷却。

离开范围恢复当前距离的正常照明，仍来自 Sun。禁用/移除则恢复初始化保存的 V1 位置/强度/target 引用与父节点、原大气色和 halo 尺度，移除精确 Sun talker，不影响 Moon。内部 setEnabled(false) 立即清理；意外 detach/hidden/引用失配在下次活动 update 清理，即使暂停也执行维护，但不推进计时/插值。显式 enable 才复用原 body/talker，绝不每次互动重建资源。

## 权衡与验证

主动作冲突在 Earth 局部解决，维持 label/null 和反馈文本/null 的共享契约。局部 factory 是首次建世界时的接入，不用于切换返回时重装。新 GPU 资源仅构建一次，继续随缓存场景保存，V2 不新增 dispose 协议、网络、音频上下文或 RAF。

Node 以真实 Three.js 场景/矩阵/材质验证逻辑、组合、身份与资源引用集合；canvas 绘制 stub 不代表画质通过。V1 浏览器验收已由用户明确确认；V2 S1–S7 待用户。可选 heap 诊断与普通配置性能测量分会话，不能用强制 GC 会话帧率替代演示基线。无可靠 GC 接口时记未验证，不阻挡日常实现。

## 交付范围

只修改 Earth 局部模块、相关 Node 测试、文档，以及帮助的一句操作说明。V1 工厂测试的两 talker 库存更新为三条并明确 Sun 身份，原行为断言保留。未执行浏览器自动化、未修改 CI、未提交/推送/合并/部署。实际结果见 [V2 QA 记录](../earth-v2-qa-results.md)。
