# Earth V4：提交与远端整合验证

日期：2026-10-20。用户明确要求 commit and push，目标仍为 `feat/earth-scene`；该授权覆盖 V4、布局/反馈增强、简化 E 和实际牵引增强。不创建 PR、不合并或推送 main。

## 提交范围与整合

- 本地功能提交 `d1c0867`：V4 Moon–Sun duet、金色 Moon、分离环星球布局、两秒蓝环、移动/边界可 E、18 单位/秒与 36 单位上限、测试/计划/手验说明及历史证据。
- 提交前原本地基线为 `4dc374a`。fetch 确认远端 `origin/feat/earth-scene` 为 `4edaa2e`，有 8 个本地尚无的提交，包含人层田野观察、居民/动物与加载状态整合。正常合并这些提交，保留全部远端历史，不 force push。
- README 与 world-movement 测试自动合并；保留人层操作与速度缩放测试，同时保留 Earth 新操作和每帧超限 0.901 的拒绝断言。没有冲突文件，Earth 运行时模块不被远端覆盖。
- `.gitignore` 的既有 `.gstack/` 本地修改不包含在本次提交。视觉提案的 V4 文档链接随当前 V4 文档纳入，以保持链接有效。
- 四份历史失败输出仅去除行尾空格以通过 staged diff 空白检查，错误名称、数值和内容保留；原始字节另存 `.local/earth-push/`，不把历史失败改为通过。

## 验证

- 合并树上 Node **22.20.0** 执行 `npm run check`：格式、lint、**142 测试 / 142 通过 / 0 失败 / 0 跳过**、build 全部通过。见 [完整输出](qa/earth-v4-push/check.txt)。相对本地 112 项，远端新增 30 项测试均纳入，没有跳过失败。
- 全部 **37 个 src 运行时模块**与 dist 逐字节一致；HTTP 200、JS MIME 正确，静态 import 可访问。见 [运行时哈希与 HTTP](qa/earth-v4-push/runtime.txt)。没有使用浏览器或 WebGL。
- pre-push 正确性/测试与维护性/性能两项只读检查没有发现新代码缺陷；原 R/Moon 位置所有权风险及用户手验保留，不冒充已修复或通过。
- staged diff 空白、Markdown 格式与本地文档链接检查在提交前复核。已有 E2E/CI 保留，按用户分工未本地运行浏览器自动化。

## 未验证项

V3/V4 的最新可见程度、控制、实际 Shader 与性能仍待用户；当前 commit/push 指令不等于手验通过。普通性能与可选 GC 诊断继续分会话。历史的 103/108/111/112 项结果与此次 142 项整合结果分开保存，不回填旧记录。

相关：[V4 QA](earth-v4-qa-results.md)、[反馈与牵引修订](earth-feedback-revision-qa.md)、[V3 手验](earth-v3-manual-qa.md)、[V4 手验](earth-v4-manual-qa.md)。
