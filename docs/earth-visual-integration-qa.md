# Earth视觉：推送前同步远端验证

用户要求推送feat/earth-scene时，远端已到1cacad1，包含15个本地尚无的提交；本地视觉提交为12e10e7。普通推送需要保留两边历史，因此合并远端到当前feature分支，不force push、不更新main。

## 冲突与兼容

- docs/architecture、docs/testing保留视觉与远端魂穿/海湾两组说明。
- main保留远端输入、草/岛屿环境、R控制、飞行/游泳与世界更新分派；删除多余Earth自转，继续由唯一视觉回调拥有。
- space保留新背景/材质、云和岩体，以及远端primary/显式Sun entity和Moon/行星embodiment metadata；不复制Sun或其他天体。
- 新天空是Group，没有shader的sunDir；R太阳入口现在仅在实际存在sunDir时使用方向入口，其余按真实天体选择。新增真实工厂回归验证四个实体身份、R换入Sun/返回Earth，以及Group sky/原Shader sky兼容。
- 原唯一世界update测试适配远端已有的Earth专用context/其他world dt分派，断言仍要求Earth恰好更新一次。

## 验证范围

共享工作区同时出现其他任务的未提交V4 Sun改动。一次共享目录check因该Sun文件格式失败，仅确认格式阶段未过；没有格式化或纳入该工作。后续从暂存合并树创建独立detached快照，运行完整非浏览器check，验证的只有本次推送树，不声称未提交V4已测。

[完整隔离检查输出](evidence/earth-visual-integration/check-isolated.txt)：Node22.13.0，npm run check退出0；85通过/0失败/0跳过/0取消，格式/lint/build通过。测试基于记录中的暂存合并树，不含工作区V4。新增兼容回归与远端已有测试均保留。

[发布HTTP记录](evidence/earth-visual-integration/runtime-validation.txt)：26模块/导入全部200、JS MIME与源码字节一致；原GLB模型资源200、正确MIME、字节一致；生产QA端点404。

[共享工作区格式失败记录](evidence/earth-visual-integration/worktree-check-v4-format-failure.txt)单独保留，不误报为隔离推送树失败或V4通过。浏览器自动化仍按用户要求未运行，画面/控制/性能待用户。

## 性能基线与未提交工作

原c97b8bb基线/74项日志保留为历史；当前代码已含草/岛/R与GLB加载，后续不能用旧版完整四层预热采样宣称仅视觉增幅。新匹配基线为1cacad1，手验脚本默认读取`.local/earth-visual-baseline-1cacad1`，两边使用同一采样器，重新取得三轮前后三轮数据。此前没有真实样本，不改写不存在的数据。

未提交V4源码和规划、README等本地规划引用均不纳入本次推送。主分支不改，保留旧视觉验收待用户状态。
