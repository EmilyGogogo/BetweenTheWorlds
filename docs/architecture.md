# 架构与协作边界

## 运行方式

浏览器直接加载静态 HTML、CSS 和 ES Modules，不需要应用框架、后端或打包器。Three.js r170 从原始 HTML 的内嵌模块按字节提取到 `vendor/`，本次未升级引擎。Node.js 仅用于本地服务、检查、测试和静态发布目录生成。

```text
index.html                 语义结构、入口与操作提示
src/main.js                会话状态、输入、切换、镜头、对白触发、音频与动画循环
src/styles.css             现有界面样式与响应式布局
src/content/worlds.js      四层名称、尺度、镜头与移动参数
src/core/random.js         可复现的随机数生成器
src/worlds/index.js        场景工厂装配
src/worlds/shared.js       地形、植被、光照、天空与共用渲染工具
src/worlds/micro.js        草层
src/worlds/human.js        人层
src/worlds/island.js       岛屿层
src/worlds/space.js        星球层
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

## 当前限制

场景首次使用时创建并缓存，离开不会释放 GPU 资源；刷新才完全重置。主控制器仍包含输入、音频和对白，后续按真实任务逐步拆分。场景工厂嵌套函数沿用 Demo 结构，避免一次重写引入行为偏差。

共享随机源为固定种子，但各层首次进入的顺序会影响随机消耗，因此不同访问顺序的场景细节可能不同。当前尚未承诺跨会话完全一致的世界。

## 分工建议

每个尺度的视觉与实体改动优先限定在对应文件。改动 `main.js`、`shared.js`、层索引、工具参数、根规范或 CI 时，在关联任务中先说明影响。对白暂在各场景内，独立内容结构与音频模块是后续任务，不能假定已经存在。

新增事件监听必须有明确生命周期；新增 GPU/音频资源说明复用与释放策略。性能测量记录设备、浏览器、操作路径与测量方法，不用主观“流畅”代替证据。
