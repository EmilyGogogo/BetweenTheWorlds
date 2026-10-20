# 0006：原 Moon 与 Sun 的关系合奏

- 日期：2026-10-20
- 状态：用户明确授权按修订 V4 计划实施的本地契约；未提交、未推送，画面/控制待用户
- 关联：DESIGN-01 / A11Y-02 / QA-01；[实施计划](../earth-v4-implementation-plan.md)、[QA](../earth-v4-qa-results.md)

## 问题与决定

Moon 结伴需能改变后续 Sun 回应，但不能复制太阳时钟、生成新天体或改变共享输入。接续已有 Sun 变体草稿，`createSunResponse` 第五参数可选 `{selectVariant}`，缺省或选择 null 时保留原 solo 提示和反馈。查询无副作用，执行重新选择，接受 E 才递增 responseId 并锁定 variant。

Sun 提供借用只读的复用视图 `getResponseView(reducedMotion)`：`{id, variant, responding, weight, lastEnd}`。调用方不修改、不把它保留为历史快照；结束记录独立冻结，形状 `{id, variant, reason}`，原因仅 complete/out-of-range/disabled。响应结束写一次；冷却回 ready 不改写结束原因。关系模块只读 weight，不增加时钟、进度或通知总线。

`createMoonSunRelationship` 在工厂中捕获 `world.globe.parent` 为原 Earth、原 scene、Moon 和材质。运行时 controlled.object 必须是原 Earth；尚未 prepareEntities 的独立工厂使用 avatar 身份。有效 Moon 要求 orbiting、原引用与 parent、Moon/scene 可见及原材质；invitable 控制邀请，不是存在性开关。不增加 Moon→Sun 距离要求。

R 换身使本次合奏参与失效，标记 droppedId，恢复 Moon 附加视觉；即使返回也不重入同一个 id。Sun 保持原时钟/独自部分。自然完整结束、观察期间未失效且结束时仍有效才置 `earthState.relationships.moonSun.hasCompleted`；按结束 id 去重，取消不记完成，既有完成不清空，刷新重置。

## 字段所有权与生命周期

Sun 继续独占大气颜色、halo 尺度和响应/冷却；视觉模块独占地表/云层旋转。关系仅写原 Moon 材质 color、emissive 与 emissiveIntensity，保存原表面色、线性发光颜色及强度，表面色按 0.55 × weight 混合暖色，发光合成为 `原色 × 原强度 + 暖色 × 1.2 × Sun.weight`，响应时强度设 1。复用原 Color，无新 GPU 资源。

结束/失效恢复原表面色、emissive 和 intensity 及 Color 身份。即使材质替换或 Moon detach，也恢复自己写过的旧材质，不碰新材质、不赋回旧材质、不重挂旧对象。所有维护在暂停时仍执行；Sun 显式 disable 自身立即清理，Moon 在下一次关系维护调用清理，没有隐含同步通知。

`installEarthActions` 保留第五参数的 visualUpdate，新增可选 relationship。更新顺序 ringed → moon → sun → relationship → visualUpdate；共享最终移动在此前完成。Sun E 成功后同步一次 dt=0 的关系视图，不再调用 Sun.update、不修改调用方 context，因此减弱动态当帧有暖色且不重复扣时。无 relationship 时无需 getResponseView，旧处理器与测试 stub 仍兼容。Moon 和牵引 E 成功不产生假 Sun 事件。

## 范围、代价与证据

没有修改 main、Moon、牵引、视觉、共享 core、速度、镜头、CSS、其他世界、依赖或 CI。没有新 RAF、计时器、监听、音频或网络请求。缓存场景持有原对象及少量 Color/记录；引用稳定不证明 GPU/heap 无泄漏。

保留旧 solo 与业务断言，仅更新三处真实邀请后组合路径的提示/反馈。测试走真实工厂、Sun 状态机、运动和 prepareEntities/inhabit；canvas 绘制 stub 不验证 Shader 或画质。

既有 Moon 更新仍围绕当前受控身体；魂穿 orbiting Moon 时可能覆盖其控制位移。V4 按计划只隔离新增合奏，不声称修复该问题。V3/视觉旧手验保持待验；V4 的手动检查与可辨认度仍待用户，见 QA 记录。
