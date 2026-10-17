# 万物之间 · BetweenTheWorlds

成为一株草、一个人、一座岛、一颗星球。在不同的尺度里，重新寻找自己的位置。

这是一个探索中的浏览器 3D 体验。当前仓库将第一版 Demo 整理为可运行、可审阅的协作基线；产品方向仍然开放，欢迎策划、开发、视觉、声音和试玩反馈一起参与。

## 先试玩

两种方式都需要支持 WebGL 2 的桌面浏览器。

### 直接打开离线 Demo（无需安装工具）

先下载整个仓库并解压，再打开其中的 [离线 Demo](prototypes/offline-demo.html)：

- **Windows**：在资源管理器中进入 `prototypes` 文件夹，右键 `offline-demo.html`，选择「打开方式」，使用浏览器打开。
- **Linux 桌面**：在文件管理器中进入 `prototypes` 文件夹，右键 `offline-demo.html`，选择用浏览器打开。

这个文件是完整保留的历史参考，后续开发以根目录的 `index.html` 和 `src/` 为准。要体验当前开发版，请按下面的方式启动本地服务。

### Windows 打开当前开发版

1. 安装 Node.js 22（至少 22.13，低于 23，包含 npm），安装后重新打开 PowerShell。
2. 下载并解压仓库，或使用 Git 克隆仓库。进入包含 `package.json` 的项目根目录，执行以下命令；示例路径请替换成实际路径：

```powershell
cd "D:\GitHub\BetweenTheWorlds"
npm.cmd ci
npm.cmd run dev
```

这里使用 `npm.cmd`，可避免 PowerShell 的脚本执行策略阻止 `npm.ps1`。

3. 保持 PowerShell 窗口开启，在浏览器地址栏输入 `http://127.0.0.1:5173`，点击「进入万物之间」。

### Linux 打开当前开发版

1. 安装 Node.js 22（至少 22.13，低于 23）和 npm，确认终端中的 `node --version` 与 `npm --version` 可用且版本符合要求。
2. 下载并解压仓库，或使用 Git 克隆仓库。打开终端，进入包含 `package.json` 的项目根目录，执行以下命令；示例路径请替换成实际路径：

```sh
cd ~/BetweenTheWorlds
npm ci
npm run dev
```

3. 保持终端开启，在桌面浏览器地址栏输入 `http://127.0.0.1:5173`，点击「进入万物之间」。

### 启动与退出说明

- 当前开发版需要通过本地服务访问，直接双击根目录的 `index.html` 无法正常加载模块。
- 首次安装工具和执行 `npm ci` 需要网络；安装完成后，游戏运行时无需登录、后端或网络资源。
- 下次打开时，进入同一项目目录，只需执行 `npm.cmd run dev`（Windows）或 `npm run dev`（Linux）；依赖变化后再执行 `npm ci`。
- 结束试玩后，在运行服务的终端按 `Ctrl+C` 停止服务。
- 如果提示端口被占用（`EADDRINUSE`），可改用 `npm.cmd run dev -- --port=5174`（Windows）或 `npm run dev -- --port=5174`（Linux），再访问 `http://127.0.0.1:5174`。

W/A/S/D 移动，鼠标左键拖动观察，滚轮缩放；1—4 或底部按钮切换尺度；草层靠近同类按 E 邀请同行，最多 12 株。星球层靠近月亮，按 E 邀请它绕行并与你同行；关系在本页切换后保留，刷新重置。靠近太阳时光照增强，按 E 可回应光芒；回应后短暂冷却，再次出现提示时可重试。右上角控制声音与查看帮助。

Earth/星球层使用更快的固定移动速度（38 场景单位/游戏秒），松键即停；其他三层速度保持原样。

## 当前有什么

| 已有基线                                           | 尚未实现或需要讨论                   |
| -------------------------------------------------- | ------------------------------------ |
| 四种尺度的 3D 场景、移动与镜头                     | 昆虫层、任意实体转换、真实物理       |
| 场景切换、草群同行、月亮结伴、太阳光响应、实体对白 | 移动端手势、存档、资源释放与画质分级 |
| 程序合成环境声、会话内状态保留                     | 美术目标与参考图、性能预算、正式发布 |

刷新会重置状态；当前画面是程序生成的原型。对白为原创或注明思想启发的改写，不是哲学家原话。目前没有本次整理所确认的公网试玩地址。

## 一起做什么

先读 [项目方向](docs/vision.md) 和 [任务清单](docs/roadmap.md)，再按 [贡献指南](CONTRIBUTING.md) 提交想法、领取任务或发起 PR。每个任务写清负责人、修改范围、依赖和验收标准；跨模块方案先形成决策记录，方便大家一起讨论。

| 入口                                                           | 用途                                     |
| -------------------------------------------------------------- | ---------------------------------------- |
| [贡献指南](CONTRIBUTING.md)                                    | Issue → 分支 → PR → 审阅 → 合并          |
| [AI 工作规范](AGENTS.md)                                       | AI 必须遵守的边界、验证与交付要求        |
| [架构与目录](docs/architecture.md)                             | 代码入口、模块契约、协作冲突边界         |
| [产品需求与 Earth 开发交接](docs/prd-earth-handoff.md)         | 游戏现状、控制参数、Earth 范围与接入约定 |
| [Earth 高层计划](docs/earth-high-level-plan.md)                | 玩法方向、分阶段路线与职责边界           |
| [Earth V1 实施计划](docs/earth-v1-plan.md)                     | 月亮结伴的依赖、行为、实现步骤与验收     |
| [Earth V2 实施计划](docs/earth-v2-plan.md)                     | 太阳、接近光照、主动响应与 V1 组合接入   |
| [Earth V2 实施分步与 QA](docs/earth-v2-implementation-plan.md) | V1 接入兼容、分步代码 QA 与交付门槛      |
| [Earth V2 用户检查单](docs/earth-v2-manual-qa.md)              | 用户执行的太阳画面、控制与 V1 回归检查   |
| [验证指南](docs/testing.md)                                    | 自动检查、浏览器冒烟、人工试玩清单       |
| [讨论决策](docs/decisions/0001-static-modules.md)              | 已做出的技术选择及其原因                 |

## 常用命令

```sh
npm run check          # 格式、lint、单元与仓库检查、静态打包
npx playwright install chromium
npm run test:e2e       # 实际浏览器验证游戏主流程
npm run build         # 输出到 dist/，可交给任意静态托管服务
npm run preview       # 本地预览 dist/
```

CI 会在 Linux 执行完整检查与浏览器冒烟，并在 Windows 验证脚本兼容性。CI 配置随仓库提供；是否要求检查通过后才能合并，取决于 GitHub 服务端实际启用的保护设置。

项目自身的开源许可证尚待所有者决定，`package.json` 暂标记为 `UNLICENSED`，仓库公开不表示已经授权再分发。Three.js r170 使用其独立的 MIT 许可，详见 [第三方说明](THIRD_PARTY_NOTICES.md)。
