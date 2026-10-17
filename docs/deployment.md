# 发布到 GitHub Pages

对应 `RELEASE-01` 的静态部署配置。游戏只有前端，线上只需托管 `npm run build` 生成的 `dist/`，访问者不需要安装 Node.js。此文档和工作流不代表已经启用公网网站，也不代表首次发布的人工回归和许可确认已经完成。

## 首次开启

1. 将 `.github/workflows/pages.yml` 和相关改动经审阅合并到 `main`。
2. 打开仓库的 [Settings → Pages](https://github.com/EmilyGogogo/BetweenTheWorlds/settings/pages)，在 **Build and deployment → Source** 选择 **GitHub Actions**。仓库管理员或维护者可配置；GitHub Free 需要公开仓库，私有仓库需使用支持 Pages 的付费方案。
3. 在 [Actions](https://github.com/EmilyGogogo/BetweenTheWorlds/actions) 中打开 **Deploy GitHub Pages**。如果首次运行发生在开启 Pages 之前并失败，开启后选择 **Run workflow**，分支选 `main`，重新运行。
4. 构建和部署通过后，以 Pages 设置页或部署任务显示的地址为准。使用当前仓库名和默认域名时，预期地址为 `https://emilygogogo.github.io/BetweenTheWorlds/`。
5. 在真实桌面浏览器打开该地址，按 [验证清单](testing.md) 完成人工回归，特别检查进入、四层切换、移动、帮助、声音与刷新。桌面浏览器仍需支持 WebGL 2；发布不会自动补齐移动端操作。

GitHub 的 [发布来源设置说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) 和 [自定义部署工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) 提供了对应界面与权限要求。工作流使用 GitHub 提供的临时令牌，无需另建部署密钥或个人访问令牌。

## 自动更新与检查

每次推送或合并到 `main`，**Deploy GitHub Pages** 都会依次执行：

1. 用 `.nvmrc` 指定的 Node.js 版本执行 `npm ci`。
2. 执行 `npm run check`，包含格式、lint、单元与仓库检查，以及 `dist/` 构建。
3. 安装 Chromium 并执行 `npm run test:e2e`，验证实际发布文件，包括 `/BetweenTheWorlds/` 子路径下的资源加载。
4. 仅上传 `dist/`，然后部署到 `github-pages` 环境。

前面的步骤失败就不会进入部署，已发布的网站继续保留上一版。功能分支和 PR 不会触发此发布工作流；在 Actions 手动执行时也仅允许 `main`。原有 `CI` 工作流继续独立运行，本地检查不能代替远端执行结果。

入口、样式和模块使用相对路径，不需要为 GitHub Pages 修改域名或增加后端。发布脚本只复制运行文件及第三方许可，仓库文档、原始 Demo、测试和设计图册不会发布到网站。

`.design/` 是本地设计资料，已在仓库 `.gitignore` 与格式检查忽略规则中排除，不应提交到 GitHub，也不会进入 `dist/`。不要把它与可审阅的 `design/` 原型图册混淆；两者均不在网站发布范围内。

## 检查发布和回退

发布后确认 Actions 中的提交版本与预期一致；在浏览器开发者工具的 Network 中检查 `src/` 和 `vendor/` 的请求都位于 `/BetweenTheWorlds/` 下且没有 404。若首页仍是旧版，先检查工作流是否结束、Pages 显示的部署版本是否正确，再尝试强制刷新。

需要回退时，通过新的 PR 撤销引入问题的代码改动，审阅后合并到 `main`；同一工作流会验证并重新发布回退后的版本。不要强推或重写 `main` 历史。若问题本身导致测试或构建失败，先修复该失败，回退部署才能继续。
