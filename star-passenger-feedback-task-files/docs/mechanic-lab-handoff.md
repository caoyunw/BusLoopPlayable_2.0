# BusLoop 机制实验台：新对话交接文档

> 更新日期：2026-07-10  
> 当前阶段：机制实验台底座与插件架构已完成；星星乘客反馈优化已完成设计和实施计划，尚未开始编码。  
> 用途：让新的 Codex 对话或协作者快速恢复上下文并继续机制 Demo 开发。

## 0. 路径标注规则

- `[Pxx]`：已经存在的具体本地文件或目录，可在“具体路径索引”中打开。
- `[Txx]`：新增机制时使用的路径模板，其中包含变量，不对应单个现有文件。
- 本文正文不单独散落未编号的本地路径；遇到路径先查本节索引。
- GitHub、localhost 和查询参数属于网络地址，不属于本地文件路径，单独标注为 URL。

### 具体路径索引

| 编号 | 用途 | 绝对路径 |
| --- | --- | --- |
| P00 | 当前机制实验台工作树 | [mechanic-lab](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab) |
| P01 | 主工作树 | [BusLoopPlayable_2.0](</D:/claudework/项目相关/WorkProject/BusLoop/【BusLoop】关卡机制发散/BusLoopPlayable_2.0/BusLoopPlayable_2.0>) |
| P02 | 本交接文档 | [mechanic-lab-handoff.md](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/docs/mechanic-lab-handoff.md) |
| P03 | 工程 README | [README.md](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/README.md) |
| P04 | 多人机制协作规范 | [mechanic-collaboration.md](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/docs/mechanic-collaboration.md) |
| P05 | 机制实验台设计规格 | [2026-07-09-busloop-mechanic-lab-design.md](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/docs/superpowers/specs/2026-07-09-busloop-mechanic-lab-design.md) |
| P06 | 机制插件化实施计划 | [2026-07-10-mechanic-pluginization.md](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/docs/superpowers/plans/2026-07-10-mechanic-pluginization.md) |
| P07 | 星星乘客反馈优化设计规格 | [2026-07-10-star-passenger-feedback-design.md](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/docs/superpowers/specs/2026-07-10-star-passenger-feedback-design.md) |
| P08 | 星星乘客反馈优化实施计划 | [2026-07-10-star-passenger-feedback.md](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/docs/superpowers/plans/2026-07-10-star-passenger-feedback.md) |
| P09 | 核心代码导航 | [code-navigation.md](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/docs/project/code-navigation.md) |
| P10 | 历史广告平台文档目录 | [docs/platforms](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/docs/platforms) |
| P11 | 历史试玩广告文档目录 | [docs/playable](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/docs/playable) |
| P12 | 机制模块根目录 | [src/mechanics](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/mechanics) |
| P13 | 机制模块聚合器 | [src/mechanics/index.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/mechanics/index.js) |
| P14 | 机制注册表公共接口 | [src/mechanic-registry.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/mechanic-registry.js) |
| P15 | 机制 UI controller 聚合器 | [src/mechanics/ui.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/mechanics/ui.js) |
| P16 | 基础玩法状态机 | [src/game-model.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/game-model.js) |
| P17 | 实验台浏览器入口 | [src/main.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/main.js) |
| P18 | Three.js 场景表现 | [src/scene-view.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/scene-view.js) |
| P19 | 全局实验台样式 | [src/styles.css](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/styles.css) |
| P20 | 实验台 HTML 壳层 | [index.html](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/index.html) |
| P21 | 星星乘客机制目录 | [src/mechanics/star-passenger](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/mechanics/star-passenger) |
| P22 | 星星乘客定义与 runtime 导出 | [src/mechanics/star-passenger/index.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/mechanics/star-passenger/index.js) |
| P23 | 星星乘客规则模型 | [src/mechanics/star-passenger/model.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/mechanics/star-passenger/model.js) |
| P24 | 星星乘客 HUD controller | [src/mechanics/star-passenger/view.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/mechanics/star-passenger/view.js) |
| P25 | 星星乘客专属样式 | [src/mechanics/star-passenger/styles.css](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/mechanics/star-passenger/styles.css) |
| P26 | 星星乘客测试 | [test/star-passenger-mechanic.test.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/test/star-passenger-mechanic.test.js) |
| P27 | 机制架构测试 | [test/mechanic-architecture.test.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/test/mechanic-architecture.test.js) |
| P28 | 机制注册表测试 | [test/mechanic-registry.test.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/test/mechanic-registry.test.js) |
| P29 | 基础玩法综合测试 | [test/game-model.test.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/test/game-model.test.js) |
| P30 | 中性运行资源目录 | [public/assets/runtime](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/public/assets/runtime) |
| P31 | Unity 原始资源目录 | [public/assets/unity](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/public/assets/unity) |
| P32 | 关卡与资源 URL 配置 | [src/level-data.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/level-data.js) |
| P33 | 场景 authored tuning | [src/scene-tuning.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/scene-tuning.js) |
| P34 | 场景调参编辑器 | [src/scene-editor.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/scene-editor.js) |
| P35 | 车辆路径与碰撞运动 | [src/vehicle-motion.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/vehicle-motion.js) |
| P36 | 音频控制器 | [src/audio-controller.js](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/src/audio-controller.js) |
| P37 | npm 脚本与依赖 | [package.json](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/package.json) |
| P38 | 导出的场景调参文件 | [artifacts/scene-tuning.json](/C:/Users/1/.config/superpowers/worktrees/BusLoopPlayable_2.0/mechanic-lab/artifacts/scene-tuning.json) |

### 路径模板索引

| 编号 | 模板 | 用途 |
| --- | --- | --- |
| T01 | `工作树\src\mechanics\<mechanic-id>\` | 每个机制的独立所有权目录。 |
| T02 | `工作树\test\<mechanic-id>.test.js` | 每个机制的规则与接线测试。 |
| T03 | `feature/mechanic-<mechanic-id>` | 每个机制的 Git 功能分支命名。 |

## 1. 新对话建议首条消息

```text
请进入路径 [P00]，先阅读 [P02]、[P03]、[P04]、[P07] 和 [P08]，再继续 BusLoop 机制实验台开发。

当前分支：feature/mechanic-lab
当前 HEAD：e2cebf0 docs: design star passenger feedback

先执行 git status 和 git log -6 --oneline。保留现有未提交文件，不要重做试玩广告剥离、机制实验台壳层、机制插件化和星星乘客初版。

当前最近任务是实现星星乘客反馈优化：[P07] 为已确认设计，[P08] 为待执行计划。目标是星星显示 3/2/1 剩余出口次数、经过出口弹出 -1、金币充能改为循环 0/20，并在 20/20 时播放约 1 秒的华丽庆祝。该优化尚未编码，请按 [P08] 使用 TDD 开始执行。
```

## 2. 项目背景与目标

原工程是 BusLoop 可试玩广告。当前已改造成面向策划和研发的机制实验台，用于：

- 浏览、筛选并说明机制。
- 在统一 BusLoop 基础玩法上单独加载和体验一个机制。
- 保留 Three.js 场景、基础关卡、声音、胜负流程、重置和场景调参能力。
- 让多人按机制分支开发，降低公共文件冲突。

当前工程不再以投放广告为目标，不包含商店跳转、安装引导、MRAID 或广告平台打包流程。历史广告文档只保留在 [P10] 和 [P11] 供追溯。

## 3. 当前工作区与 Git 状态

- 当前开发工作树：[P00]。
- 主工作树：[P01]。
- GitHub：[caoyunw/BusLoopPlayable_2.0](https://github.com/caoyunw/BusLoopPlayable_2.0.git)。
- 当前分支：`feature/mechanic-lab`。
- 当前 HEAD：`e2cebf0 docs: design star passenger feedback`。
- 当前未提交文件：[P02] 和 [P08]。
- `feature/mechanic-lab` 尚未设置远端上游。
- 本地主分支 `main` 相对 `origin/main` 仍为 `ahead 3`。

多人分工前，应先发布机制实验台共同基线：

```bash
git push -u origin feature/mechanic-lab
```

其他协作者必须从包含插件架构的最新共同分支创建机制分支，不要直接从旧的 `origin/main` 开始。

## 4. 已完成工作

### 4.1 试玩广告剥离

- 已删除广告 CTA、商店跳转、安装门槛和投放运行逻辑。
- 已删除 AppLovin 打包与检查命令。
- 有价值的资源已迁移到 [P30]；Unity 原始资源保留在 [P31]。
- 关卡和资源 URL 主要由 [P32] 管理。

### 4.2 机制实验台界面

- 左侧为机制库；中间为游戏舞台；右侧为默认折叠的场景编辑器。
- 移动端使用机制库和场景编辑器抽屉。
- URL 支持 `?mechanic=<id>`；未知 ID 回退 `base`。
- 本地预览 URL：<http://127.0.0.1:4173/>。
- 星星乘客预览 URL：<http://127.0.0.1:4173/?mechanic=star-passenger>。

### 4.3 机制插件化

- 机制根目录为 [P12]；新增机制遵循 [T01]。
- 模块聚合、注册表和 UI 聚合分别由 [P13]、[P14]、[P15] 负责。
- 基础玩法状态机位于 [P16]；入口装配位于 [P17]；场景表现位于 [P18]。
- 全局壳层和全局样式分别是 [P20] 与 [P19]。
- 每个机制测试遵循 [T02]。

机制目录标准职责：

| 文件名 | 责任 |
| --- | --- |
| `index.js` | 机制定义，以及可选的 `createRuntime` 导出。 |
| `model.js` | 机制规则、状态、事件和快照数据。 |
| `view.js` | 机制专属 HUD 或 DOM controller。 |
| `styles.css` | 机制专属样式和动效。 |

### 4.4 星星乘客初版已可试玩

当前代码位于 [P21]，入口、规则、HUD 和样式分别是 [P22]、[P23]、[P24]、[P25]，测试是 [P26]。

当前已经实现的行为：

- 乘客按 18% 默认概率随机获得星星。
- 有效星星乘客成功上车时，金币计数增加 1。
- 有星星飞向进度栏的收集表现。
- 每次经过出口计数一次；第 3 次仍未上车时奖励消失，乘客保留。
- 当前代码中的默认充能目标仍是 3。

## 5. 星星乘客反馈优化：已确认但尚未实现

设计规格已经提交，见 [P07]；实施计划已经写好但尚未提交，见 [P08]。

### 已确认设计

- 采用 A 方案：星星右上角显示数字徽章 `3`、`2`、`1`。
- 每次乘客经过出口时，旁边只弹出一次 `-1`，并同步更新数字。
- 归零时星星和徽章消失，乘客继续移动。
- 金币充能改为循环 `0/20`。
- 第 20 枚金币先显示 `20/20`，触发约 1 秒的进度条扫光、金币喷发、星芒与光圈反馈。
- 动效结束后显示 `0/20`，第 21 枚金币显示新一轮 `1/20`。
- 充满不暂停操作、不弹窗，也不发放额外道具。
- 需要支持 `prefers-reduced-motion`。

### 计划修改范围

| 路径编号 | 修改内容 |
| --- | --- |
| P23 | 增加 `remainingPasses`、`decrementVersion`、`charge` 和 `completedCharges`。 |
| P18 | 渲染世界空间的数字徽章和一次性 `-1`。 |
| P24 | 管理 `0/20` HUD、`20/20` 暂存和庆祝生命周期。 |
| P25 | 增加扫光、粒子、光圈、缩放和 reduced-motion 样式。 |
| P26 | 用 TDD 覆盖 3→2→1→0、19/20/21 金币和 UI 接线。 |
| P03 | 更新用户可见机制说明。 |
| P02 | 实现完成后更新交接状态与验证结果。 |

### 当前执行状态

1. 设计讨论：已完成。
2. 视觉方案选择：已完成，选择数字徽章 A。
3. 设计规格：[P07] 已提交，提交为 `e2cebf0`。
4. 实施计划：[P08] 已完成并自审。
5. 规则、场景和 HUD 编码：未开始。
6. 自动化测试、构建与浏览器验收：未开始。

## 6. 当前机制清单

| ID | 名称 | 状态 | 核心规则 |
| --- | --- | --- | --- |
| `base` | 基础规则 | 可试玩 | 车辆调度、颜色匹配、乘客上车和停车位周转。 |
| `star-passenger` | 星星乘客 | 可试玩，反馈优化待实现 | 星星乘客上车获得金币，转三圈未上车则奖励消失。 |
| `question-passenger` | 问号乘客 | 待实现 | 左右队列隐藏颜色，进入传送带后揭示。 |
| `question-vehicle` | 问号车 | 待实现 | 车辆颜色不可见，前方无阻挡时揭示。 |
| `elevator-bay` | 升降舱 | 待实现 | 舱门前车辆移开后传出下一组车辆。 |
| `garage` | 车库 | 待实现 | 车库口车辆开走后，下一辆车才出现。 |
| `linked-passengers` | 连体乘客 | 待实现 | 前后排绑定，必须同时上一辆车。 |
| `linked-vehicles` | 连体车 | 待实现 | 两辆车同时进入并分别占据一个停车位。 |
| `special-gate` | 特殊门 | 待实现 | 车辆经过左右特殊门时触发对应效果。 |
| `order-passenger` | 订单乘客 | 待实现 | 解救南瓜车、接走对应乘客后给予奖励。 |
| `valve` | 阀门 | 待实现 | 玩家控制左侧或右侧乘客进入传送带。 |
| `train` | 火车 | 待实现 | 集齐 4 节车厢且全部载满后整列开走。 |
| `locked-garage` | 上锁车库 | 待实现 | 带钥匙车辆开走后解锁独立停车场。 |
| `count-garage` | 次数车库 | 待实现 | 开走指定数量车辆后解锁车库。 |
| `rotating-spots` | 旋转车位 | 待实现 | 每点击一次车辆，旋转区顺时针旋转 90 度。 |
| `double-gate` | 翻倍闸门 | 待实现 | 乘客经过闸门时数量翻倍。 |
| `maglev-spot` | 磁悬浮车位 | 待实现 | 升起时不阻挡地面车辆。 |

## 7. 已确认技术决策

1. 使用“机制注册表 + 单一实验台运行时”。
2. 每个机制拥有独立目录 [T01]，具体规则不回填到 [P17]。
3. 真实可玩和视觉验收完成前保持 `planned`。
4. 选择 `planned` 机制时冻结基础盘面并暂停输入。
5. 第一阶段一次只运行一个机制，暂不实现多机制组合。
6. 公共 hook 修改应先单独合入，再让其他机制分支同步。
7. 星星乘客以 [P23] 持有规则真值，[P18] 只负责世界空间表现，[P24] 只负责 HUD 生命周期。

关键提交：

| 提交 | 内容 |
| --- | --- |
| `e2cebf0` | 固化星星乘客数字倒计时与循环 0/20 设计。 |
| `50db3bc` | 将机制定义、runtime 和 UI 改造成插件式架构。 |
| `797f3dd` | 实现星星乘客初版规则、进度栏和收集表现。 |
| `b729ad9` | 加入火车、车库、旋转车位等后续机制。 |
| `9b2fff7` | 更新机制实验台验证状态。 |
| `8f78492` | 移除试玩广告交付逻辑。 |

## 8. 接下来如何展开

### 8.1 当前第一优先级

按 [P08] 执行星星乘客反馈优化，不要先切换到其他机制。计划分为：

1. 用 [P26] 先写失败测试，再修改 [P23]。
2. 用失败接线测试驱动 [P18] 的数字徽章和 `-1`。
3. 用失败 UI 断言驱动 [P24] 与 [P25] 的 `0/20` 和庆祝动效。
4. 更新 [P03] 和 [P02]，完成聚焦测试、构建和视觉验收。

### 8.2 星星乘客完成后的机制顺序

| 阶段 | 机制 | 原因 |
| --- | --- | --- |
| A | 问号乘客、问号车、次数车库 | 状态变化简单，适合继续验证 runtime hook。 |
| B | 车库、上锁车库、升降舱 | 可先建立通用生成与解锁事件。 |
| C | 阀门、特殊门、翻倍闸门 | 可共用路径节点和经过事件。 |
| D | 连体乘客、连体车 | 需要原子操作、容量校验和失败回滚。 |
| E | 磁悬浮车位、旋转车位 | 会改变阻挡判定和空间状态。 |
| F | 火车、订单乘客 | 需要专属场景对象、多阶段目标和完整演出。 |

## 9. 多人协作规则

- 分支使用 [T03]，不要多人共用一个机制分支。
- 机制代码优先只修改 [T01] 和 [T02]。
- 容易冲突的公共文件是 [P13]、[P15]、[P16]、[P18]、[P17]、[P19] 和 [P20]。
- 同步公共基线时使用：

```bash
git fetch origin
git rebase origin/main
```

如果团队使用其他集成分支，将 `origin/main` 替换为实际共同基线。完整协作规范见 [P04]。

## 10. Runtime Hook 参考

[P16] 当前调用以下机制 hook：

| Hook | 调用时机 |
| --- | --- |
| `createState` | reset 时初始化机制状态。 |
| `createQueueItemData` | 创建等待队列乘客时附加数据。 |
| `createSlotData` | 创建传送带 slot 时附加数据。 |
| `cloneQueueItemSnapshot` | 输出队列快照时复制机制数据。 |
| `cloneSlotSnapshot` | 输出传送带快照时复制机制数据。 |
| `decorateSnapshot` | 给整体 snapshot 增加机制字段。 |
| `onPassengerEnteredBelt` | 乘客进入传送带时。 |
| `onPassengerExitPassed` | 乘客经过出口计数点时。 |
| `onPassengerBoarded` | 乘客成功上车前。 |
| `clearSlotData` | slot 清空时清理机制数据。 |

新增公共 hook 时必须表达通用游戏事件；具体机制规则仍保留在 [T01]。

## 11. 启动与验证

在 [P00] 中运行：

```bash
npm install
npm run dev -- --port 4173
```

星星乘客反馈优化的最低验证：

```bash
node --test test/star-passenger-mechanic.test.js     # [P26]
node --test test/mechanic-architecture.test.js       # [P27]
node --test test/mechanic-registry.test.js           # [P28]
npm run build                                        # 脚本定义见 [P37]
```

涉及基础规则、阻挡、停车位或路径时额外运行：

```bash
node --test test/game-model.test.js                   # [P29]
```

实现完成后必须检查：

- `3/2/1` 在队列和传送带上都清晰可见。
- 每次经过出口只出现一个 `-1`。
- 最终星星消失但乘客保留。
- HUD 从 `0/20` 开始，第 20 枚显示 `20/20` 庆祝，约 1 秒后回到 `0/20`。
- 第 21 枚显示 `1/20`，不错误重复上一轮庆祝。
- reset 和机制切换后没有 HUD、粒子、定时器和 Three.js 对象残留。
- 桌面、约 390×844 手机视口及 reduced-motion 模式均通过。

## 12. 当前验证基线

实现基线提交为 `50db3bc`，其后只新增设计文档提交 `e2cebf0`，运行代码尚未变化：

- [P27]：3/3 通过。
- [P26]：5/5 通过。
- [P28]：23/23 通过。
- `npm run build`：通过，有 chunk 大于 500 kB 的非阻塞警告。
- [P29]：24 项通过、7 项历史失败。

历史失败名称：

1. Unity visual assets and tunable camera configuration are complete
2. editor sizing, source background ratio, and passenger shadow anchor stay wired
3. dispatch reserves the first spot and unlocks cars behind it
4. blocked click uses Unity collision advance, contact hit, and return phases
5. station approach follows the Unity parking-area rectangle before entering the spot
6. vehicle path preview and shape controls are wired to scene tuning
7. level12 initial movable cars reserve the first parking spots

如果数量、名称或断言改变，应先调查，不要把新失败归入历史债务。

## 13. 注意事项与风险

1. 不要恢复试玩广告逻辑、MRAID、商店链接或广告平台资源路径。
2. 不要把具体机制规则堆入 [P17]、[P16] 或大型条件分支。
3. 星星乘客优化尚未实现；不要把 [P07] 中的设计描述误认为当前代码行为。
4. 修改 [P18] 时要保持场景表现通用，充能规则只能存在于 [P23]。
5. [P24] 的定时器、粒子和 class 必须在 reset、hide 和机制切换时清理。
6. 修改阻挡、停车位或车辆路径时，运行 [P29] 并对比历史 7 项失败。
7. 场景调参源文件和导出文件分别为 [P33] 与 [P38]；机制状态不能污染调参存储。
8. [P09] 的机制数量描述可能仍停留在插件化前，应以 [P13] 和本交接文档为准。
9. 当前协作底座尚未推送为远端上游。
10. [P02] 和 [P08] 当前是未提交文件；新对话不得删除或覆盖。

## 14. 相关文档阅读顺序

1. [P02]：当前状态、下一步和风险。
2. [P07]：星星乘客已确认设计。
3. [P08]：星星乘客 TDD 实施步骤。
4. [P04]：多人协作与 PR 规则。
5. [P03]：工程启动和机制清单。
6. [P09]：修改其他模块时的代码导航。
7. [P05]：实验台原始设计决策。
8. [P06]：插件化架构实施历史。

