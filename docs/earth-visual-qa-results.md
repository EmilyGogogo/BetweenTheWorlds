# Earth视觉：实施与QA结果

日期2026-10-17。基线c97b8bb / 分支feat/earth-scene。用户授权本轮完成全部实现，现已明确授权在`feat/earth-scene`本地提交；不推送。**代码就绪，完整check已通过（74通过/0失败/0跳过/0取消）；用户V0–V8待验，S0/画质/性能均未标Pass。**

## 审阅反馈的落实

1. 0-B历史check退出1/两个诊断JSON格式问题、未进入lint/test/build的事实保持；修复存在的JSON空白后，完整[新基线日志](evidence/earth-visual-step0/baseline-recheck-20261017T095406Z.txt)为62/62、0失败/跳过/取消，format/lint/build均通过。浏览器E2E NOT_RUN，不填0失败暗示运行。未改ignore、断言或CI。
2. 0-C三轮60秒真实采样仍未采、环境仍缺；[S0证据表](earth-visual-step0-evidence.md)全部保持未采，不造数字。旧版worktree和手动导出工具已准备，待用户提供原始JSON；中位/P95增幅不可计算。
3. 0-A明确外部相遇概率/频率接口尚未接入、待对接；Moon存在且初始可邀请，invitable不是概率配置。本轮没有新增假接口。

执行顺序依据用户本轮完整实施授权调整：保留可运行的旧版供后续同条件采样，代码项独立完成，最终人工验收保持开放；不称S0已Accepted、不称每个画面步骤已通过。

## S1–S6实际交付

- 一套camera平移sky替代原两套Points：球内1024×512银河/暗尘、4200星点的星等/颜色/圆核、屏幕尺寸与DPR。固定世界方向，无背景旋转/闪烁。
- Earth颜色/共享R高度G粗糙度、独立23.35云壳、保留大气uniform与0.65基线，边缘衰减更克制。0.018地表/0.020云自转都在唯一视觉回调，可暂停/减弱动态冻结。
- 原Moon使用半径9平滑球、同源坑纹色/高度、粗糙非金属；原Sun BasicMaterial加颗粒与原halo柔化；原gas加纬向扰动条带、ring径向UV和颜色alpha细环。
- P1同图一个淡星系/星云、一个InstancedMesh共32岩体，世界坐标分两簇，不参加对白、动作或碰撞。
- 仅Earth CSS覆盖近黑蓝与可读暗底；全局曝光/DPR/镜头/移动不动。

## 分步非浏览器QA

| 步骤 | 实际测试/证据                                                                               | 状态与限制                                       |
| ---- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| S0-A | 原源码与状态机核对，Moon默认available/invitable；原encounter距离/19秒冷却                   | 代码状态确认；外部接口待对接                     |
| S0-B | 完整基线重跑62/62；历史失败留档                                                             | Pass；E2E NOT_RUN                                |
| S0-C | 原版worktree、环境/3轮表、开发手验采样服务                                                  | 待用户，不Accepted                               |
| S1   | earth-visuals：球面字段连续、单sky/单Points4200、尺寸/颜色分层、DPR、深度/色彩chunk         | Node通过；Shader GPU编译/画面待V1                |
| S2   | earth-visuals：9图库存/同源数据/共享槽、23<23.35<24.1、初始轴倾角、唯一视觉spin/暂停/非法dt | Node通过；材料/暗侧/云穿插待V2                   |
| S3   | 真实工厂Sphere9、Moon材质/原talker；原Moon全套测试继续                                      | Node通过；坑缘/反光待V3                          |
| S4   | 原Sun状态机全部保留，100回应/结束/启停后新材质/halo/uniform引用及基线稳定                   | Node通过；颗粒/光晕/曝光待V4                     |
| S5   | 真实ring径向UV、无旧vertexColor、DoubleSide/depthTest/depthWrite；原V3全测试保持            | Node通过；环前后遮挡/透明排序待V5                |
| S6   | 32实例/单批，全实例半径清理玩家+Moon与固定两体；P1关闭仍完整P0背景                          | Node通过；视差/层级/遮挡待V6                     |
| S7   | 完整check/生产build与HTTP、精确资源、原件/链接、手验采样统计/API检查                        | 非浏览器通过；实际控制/窗口/声音V7、性能V8待用户 |

测试文件：[视觉](../tests/unit/earth-visuals.test.mjs)、[手验统计/服务](../tests/unit/earth-visual-qa.test.mjs)，保留原62项有效测试。Canvas stub提供createImageData真实像素数组，putImageData/drawImage仅stub，不硬编码生成成功，Node不渲染WebGL。像素数学直接验证确定性/范围、经线/极点、海陆/云覆盖与坑高差，不能证明画面美术达标。

### 失败台账

- 历史S0格式失败：旧check退出1，两个工具JSON；新重跑62/62关闭当前失败，原失败日志不回填。
- 本轮初次原玩法回归：41测试中40通过/1失败（`response envelope resets original color/scale and restores the current distance target`），大气opacity被改为0.48，旧断言要求0.65。恢复0.65，保留原断言；改以edgePower调整边缘。最后check作为重跑证据，不把第一次写成通过。
- 本轮完整check首次收尾：format通过，lint在collector首行的navigator重复global声明失败（1 error/0 warning），Node/build未执行；移除重复声明，不改lint规则。保留[失败完整日志](evidence/earth-visual-final/check-20261017T101604Z.txt)，随后重跑另存。
- E2E、Shader GPU、真实性能均未执行，不作为已知“0失败”记录。

## 实际资源清单

| 名称                   | 尺寸     | 色彩/共享                            | RGBA8+mip估算MiB |
| ---------------------- | -------- | ------------------------------------ | ---------------: |
| space-density          | 1024×512 | sRGB；背景/地标同图                  |            2.667 |
| earth-albedo           | 1024×512 | sRGB；不包含云                       |            2.667 |
| earth-height-roughness | 512×256  | NoColorSpace；R bump/G roughness共用 |            0.667 |
| earth-clouds           | 512×256  | sRGB+alpha                           |            0.667 |
| moon-albedo            | 512×256  | sRGB                                 |            0.667 |
| moon-height            | 512×256  | NoColorSpace                         |            0.667 |
| sun-granules           | 512×256  | sRGB，原BasicMaterial                |            0.667 |
| gas-bands              | 512×256  | sRGB                                 |            0.667 |
| ring-bands             | 1024×64  | sRGB+alpha；opacity仍归V3            |            0.333 |
| 合计9图                | —        | 无旧Earth图叠加；数据不重复计费      |            9.667 |

资源每个缓存世界只建一次，100动作周期与重复update引用稳定；不代表实际VRAM为此数、GPU无泄漏或新增draw calls已测。生成时间是Node工厂用时，不代替浏览器首次进入卡顿或真实帧时间。未接入外部素材、未使用文档概念图作运行时资源。

## 控制器与资源审查

main只移除一处无条件Earth自转；原输入/运动/夹取/镜头、world-actions与Moon/Sun/V3状态机、其他world/速度表、vendor/原型、依赖/CI/E2E无改动。earth-actions只新增可选五参数visualUpdate，按Ringed→Moon→Sun→visual各一次。所有基础材质在动作工厂捕获前完成，视觉不写动作拥有的opacity、halo scale、大气color或位置。

旧背景共享rand消耗被移除；新美术局部种子固定，后续共享随机序列可能变化，不能承诺其他场景/对白抽样逐项一致；算法与冷却没有改变。

开发采样服务只在手动启动时，以内存响应插入同一RAF时间戳并读取renderer.info，不改生产main、没有新RAF/自动按键/网络上传。真实样本需要用户手动操作；统计/API的合成Node测试数据不是性能数据。

## 最终实际命令与附件

- [完整最终check输出](evidence/earth-visual-final/check-20261017T102358Z.txt)：Node v22.13.0/npm 10.9.2，`npm run check`退出0；Prettier/ESLint通过、**74通过/0失败/0跳过/0取消**、build通过。原62项+新增视觉8项/手验工具4项，旧有效断言未改。
- [较早完整重跑](evidence/earth-visual-final/check-20261017T101855Z.txt)同为74/74；后补Earth小字/品牌暗底对比度及比较CLI非零失败码后，以上最新日志再次验证。
- [发布与HTTP脚本原始结果](evidence/earth-visual-final/runtime-validation.json)：7个变更运行时文件与dist逐字节一致，19模块递归导入全部HTTP200、JS MIME与正文一致；旧版手验服务的main内存接线也通过。生产服务没有手验采样端点，概念图不进入发布目录。
- [资源与源码指纹原始清单](evidence/earth-visual-final/resource-inventory.json)：20个scene节点、11 geometry、11 material、9纹理；颜色/尺寸/mip/共享及RGBA估算逐项列出。Node stub环境一次生成约308ms，仅作CPU实现信息，非浏览器首次进入或性能门槛证据。
- `git diff --check`通过；当前仍在`feat/earth-scene`，用户已授权本地提交；不推送。V4计划与其他未提交内容保留。

当前运行时SHA256由上述两个JSON一致记录，旧版指纹来自保存的c97b8bb worktree；新代码未提交时也能区分同HEAD的两版。不借源文件指纹宣称实际Shader已编译。

## 用户剩余QA

执行[手动检查单V0–V8](earth-visual-manual-qa.md)。先日常眼检V1–V7，再旧版/新版六组截图和三轮60秒采样V0/V8。未知设备/硬件加速/浏览器完整版本不可被推断为已确认；记录条件不符或原值不足，比较工具拒绝Pass。样本齐后分别复算中位与P95增幅<=10%。没有真实数据前，S0与量化性能保持未验收。
