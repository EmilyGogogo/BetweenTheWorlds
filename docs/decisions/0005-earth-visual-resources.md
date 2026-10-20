# 0005：Earth局部程序美术与唯一视觉更新

- 日期：2026-10-17
- 状态：本轮用户明确授权完成视觉实施；不代表人工画面、S0或性能已验收
- 关联：DESIGN-01 / PERF-01 / A11Y-02；[实施计划](../earth-visual-implementation-plan.md)、[QA](../earth-visual-qa-results.md)

## 决定

使用离线CanvasTexture与局部Shader：earth-materials处理3D方向空间连续噪声、同源海陆/高度/粗糙度、云、陨石坑、Sun颗粒、气体带与细环；earth-background返回sky并提供一个32实例岩体批。不是把概念图当整张运行时背景。所有新几何/纹理/材质首次建世界时生成，保留原天体角色/动作/talkers。

9张纹理分辨率比规划上限低：sky/Earth颜色1024×512，其余数据/云/Moon/Sun/gas 512×256，ring 1024×64；约9.67MiB为RGBA8+mip估算，非实测VRAM。Earth数据R高度/G粗糙度共享，sRGB仅用于颜色。4,200星点具有独立屏幕尺寸/颜色，DPR在onBeforeRender读取；sky跟相机平移，不跟旋转。球内面背景先画、不写深度；星点保留depthTest，不能穿主体。自定义fragment显式使用r170色彩/tonemapping chunks。

Sun和原ring基础材质先于动作工厂捕获baseline。保留大气color uniform引用与opacity0.65，改变边缘衰减；不覆盖V2每帧变色/halo缩放，不覆盖V3 ring opacity 0.8/0.95/0.88。Sun/gas原两子节点结构、所有天体位置/半径/倾角不因装饰变化。岩体全半径在玩家/已邀Moon活动包络外，避开固定天体，无新互动。

earth-actions第五参数可选`{visualUpdate}`，旧调用有效；唯一update为Ringed→Moon→Sun→visual。Earth原自转从main迁入视觉处理器，云壳23.35挂avatar独立转0.020；地表0.018。canSimulate、合法正dt<=0.05、非减弱动态才转，无新增RAF/时钟/监听。CSS只在body[data-world='3']生效，不更改全局曝光/DPR/FOV。

移除旧背景对共享随机源的消耗，新美术固定局部种子；后续场景/对白随机序列可能变化，不承诺原序列逐项一致。相遇算法/冷却/外部概率接入状态不变。

## 证据与执行顺序

S0旧check的格式失败保留，修复当时存在的工具JSON后保存62/62完整基线重跑。c97b8bb独立worktree保存原视觉，用户本轮授权独立代码项先完成；不因此标S0 Accepted。三轮真实性能及六组基线图仍待用户。

开发专用scripts/earth-visual-qa.mjs通过内存中的源码响应接入现有RAF，在原render之后读取真实renderer.info；同工具服务旧/新版，按HEAD和运行时SHA256绑定。生产main/静态服务/构建规则不增加诊断入口或网络依赖。只有用户主动运行QA服务才有面板，采样不模拟输入，下载数据不上传；统计函数有Node测试，不把工具存在当样本已采。完整人工步骤与未测范围见QA记录。

本轮不改Moon/Sun/V3状态机、其他世界、依赖、vendor、原型、CI或E2E。资源仍由缓存场景保留，非GPU泄漏证明。用户已授权在feat/earth-scene本地提交；不推送。
