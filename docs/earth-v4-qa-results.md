# Earth V4：实施与 QA 记录

日期：2026-10-20。分支 `feat/earth-scene`；本地基线 `4dc374a`，不合并缓存远端 `4edaa2e`。关联 DESIGN-01 / A11Y-02 / QA-01。用户本轮明确授权接续已有 Sun 草稿并实施修订 V4；未提交或推送。

## 步骤 0：正式基线 — Pass

- 使用 Node **22.20.0**（官方 darwin-arm64 分发，本地工具目录 `.local/earth-v4`），不修改系统 Node、package.json、lockfile 或项目依赖。下载包 SHA256 `cc04a76a09f79290194c0646f48fec40354d88969bec467789a5d55dd097f949`，与官方 SHASUMS256.txt 比对一致。
- 执行前保存 status 和已有 diff 到 `.local/earth-v4/preexisting-status.txt` / `preexisting.patch`。保留已有 `.gitignore`、视觉提案修改及 README/高层段落；Sun 草稿仅先做格式修复，随后保留其变体逻辑并补测试/接线。
- 首次 `npm run check`：**失败**，format 发现 `src/worlds/earth-sun.js`；后续 lint/test/build 未在该次执行。见[完整首次输出](qa/earth-v4/baseline-first.txt)。没有静默带过失败。
- 只格式化该草稿后重跑：format、lint、**85 tests / 85 pass / 0 fail / 0 skip**、build 全部通过。见[完整基线重跑](qa/earth-v4/baseline-pass.txt)。旧 Node 23 扫描不替代这次正式基线。
- 实际工厂：四主要天体、三 talker；prepareEntities 后四实体（原 Earth、Sun、环星球、Moon），九纹理。Moon emissive 初值黑色、intensity=1；Earth 原 Group 在 globe.parent，R 可重定向 position/avatar。相遇概率配置未接入，不伪造接口。

命令中把已验证本地 Node 目录放到 PATH 首位，再运行 `npm run check`；以下 Node 命令均用同一 Node 22 环境。

## 步骤 1–3：契约、关系与接线 — Pass（非浏览器）

| 步骤   | 实际实现及 QA                                                                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Sun  | 接续原 draft 的 selector/responseId/variant/lastEnd/view；新增默认四参数构造、null selector 回落、查询纯度、锁定/重选、复用视图、3+5 边界、唯一结束记录和暂停失效测试                           |
| 2 关系 | 新增 earth-relationships；捕获原 Earth/scene/Moon/material，按真实关系选择 duet；线性有效 emissive 合成、准确恢复、失效后同 id 不重入、自然完成去重、会话内记忆；实际 R/换材质/隐藏/detach 测试 |
| 3 接线 | 原 options 新增 relationship；ringed→moon→sun→relationship→visualUpdate；成功 Sun 动作后 dt=0 同步，不多扣时；无 relationship 的旧 stub 无需 view；entities/talkers 与原状态容器保留            |

专项命令：`node --test tests/unit/earth-sun.test.mjs tests/unit/earth-relationships.test.mjs tests/unit/earth-actions.test.mjs tests/unit/earth-ringed-planet.test.mjs`，**53 pass / 0 fail / 0 skip**。见[完整逻辑输出](qa/earth-v4/logic.txt)。首次关系专项 14/14 通过；追加去重/距离独立与 Sun API 用例后专项达到上述 53。

## 步骤 4：最终回归 — Pass（非浏览器）

- `npm run check`：format、lint、**103 tests / 103 pass / 0 fail / 0 skip**、build 全部通过；相对 85 项基线新增关系 16 项和 Sun API 2 项。见[完整最终输出](qa/earth-v4/final-check.txt)。没有测试失败被跳过、断言被降低或 CI 被修改。
- `git diff --check` 通过；新增源码与文档也经 Prettier/ESLint、格式/文档链接检查覆盖。
- 独立 Node HTTP/发布检查：全部 **26 个 src 运行时 JS 模块**逐一与 dist 比对字节/哈希，HTTP 200、JavaScript MIME 正确，各静态 import 可访问。见[逐文件哈希与结果](qa/earth-v4/runtime.txt)。工具脚本保存于 `.local/earth-v4/verify-runtime.mjs`，不进入生产代码。没有使用浏览器或 WebGL。
- 一次基线格式失败已在上节保留；修复后基线与最终回归均通过，逻辑专项无失败。正式基线及所有最终证据使用同一 Node 22.20.0。

下列 V4-L1–L11 全部 **Pass（非浏览器）**，与用户 M1–M7 分开：

| 编号   | 具体证据（tests/unit/earth-relationships.test.mjs，除另注）                                          |
| ------ | ---------------------------------------------------------------------------------------------------- |
| V4-L1  | 未邀 solo、真实邀请 duet、invitable 独立、Moon 不需再进 Sun 范围；真实 R 身份而非 planet kind        |
| V4-L2  | 纯查询快照、旧提示 detach 后 solo、repeat/重复 E 不增 id；Sun 选择器 API 测试                        |
| V4-L3  | solo 中途邀请不升级；Moon 五类失效、R 三身体恢复后同 id 不重入                                       |
| V4-L4  | 0.01/0.025/0.05 调度、唯一 weight、3+5 秒与余 dt；动作当帧 dt=0 且 context 不被改                    |
| V4-L5  | complete/out-of-range/disabled；按结束 id 一次写入；新回应带旧 lastEnd 不重复；历史完成保留          |
| V4-L6  | 非黑色、2.4 intensity 原值；100 次完成后两字段与 Color 引用准确恢复，资源/实体/talker 集合不变       |
| V4-L7  | Moon detach/隐藏/scene隐藏/引用/材质替换，Sun detach/隐藏/引用失效，暂停维护；旧材质恢复、新材质不变 |
| V4-L8  | pause/无活动更新/无效 dt、新工厂独立、状态合并；真实 prepareEntities/inhabit；E 后首个模拟帧前 R     |
| V4-L9  | 稳定 0.35 包络、当帧暖色、实际移动时相位固定且相对偏移保持、结束恢复                                 |
| V4-L10 | 原库存/9 纹理、100 次稳定引用、原 handler 与 visual 顺序；无 relationship 旧调用兼容                 |
| V4-L11 | 明确调整测试布局，用真实 movement step/反馈跨越 Sun 150 外界，取消不计完成，牵引继续至 12 单位       |

只更新三处已有组合体验预期：actions 的 “actual double eligibility…”（提示和反馈）、“reduced-motion Sun response…”（反馈），ringed 的 “real final center feeds…”（反馈）。原状态/计时/轨道/光照/资源与顺序断言保留；其他 solo 文案不改。未修改 main、Moon、牵引、视觉、共享 core、HTML/CSS、其他世界、依赖、CI 或 E2E。

## 步骤 5：交接 — 文档已备，手验待用户

已保存 [ADR 0006](decisions/0006-earth-moon-sun-duet.md)、[手动检查 M1–M7](earth-v4-manual-qa.md)，同步 V4 计划和 README/高层入口。代码/非浏览器通过不能把手验自动改 Pass。

- **M1–M7：Pending**，等待用户观察 solo/duet 差异、材质恢复、R/帮助/切层、减弱动态与前序控制。
- `npm run test:e2e` 按用户明确 QA 分工未执行；无浏览器控制、下载或 CI 降级。
- Canvas 画法 stub 不验证 GPU Shader/画质；资源引用稳定不证明没有 heap/GPU 泄漏。可辨认度与性能/内存实测未验证，GC 与日常性能会话分开。
- 原 Moon 跟随当前身体中心与 R 接管 Moon 的旧位置所有权风险仍存在，按计划不扩大修复范围。V3/视觉旧手验继续待验，不因本轮记录关闭。
