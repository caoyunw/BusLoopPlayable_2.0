# BusLoop 机制实验台：新对话交接文档

> 更新日期：2026-07-12
> 当前阶段：机制实验台底座、插件架构与星星乘客反馈优化均已完成；下一优先级是按既有顺序推进 `question-passenger`。
> 用途：让新的 Codex 对话或协作者快速恢复上下文并继续机制 Demo 开发。

## 0. 路径标注规则

- All paths are repository-relative unless marked as a URL.
- `[Pxx]`：已经存在的仓库文件或目录，可在“具体路径索引”中打开。
- `[Txx]`：新增机制时使用的路径模板，其中包含变量，不对应单个现有文件。
- GitHub、localhost 和查询参数属于网络地址，不属于本地文件路径，单独标注为 URL。

### 具体路径索引

| 编号 | 用途 | 仓库相对路径 |
| --- | --- | --- |
| P00 | 仓库根目录 | [仓库根目录](..) |
| P02 | 本交接文档 | [mechanic-lab-handoff.md](mechanic-lab-handoff.md) |
| P03 | 工程 README | [README](../README.md) |
| P04 | 多人机制协作规范 | [机制协作规范](mechanic-collaboration.md) |
| P05 | 机制实验台设计规格 | [2026-07-09-busloop-mechanic-lab-design.md](superpowers/specs/2026-07-09-busloop-mechanic-lab-design.md) |
| P06 | 机制插件化实施计划 | [2026-07-10-mechanic-pluginization.md](superpowers/plans/2026-07-10-mechanic-pluginization.md) |
| P07 | 星星乘客反馈优化设计规格 | [2026-07-10-star-passenger-feedback-design.md](superpowers/specs/2026-07-10-star-passenger-feedback-design.md) |
| P08 | 星星乘客反馈优化实施计划 | [2026-07-10-star-passenger-feedback.md](superpowers/plans/2026-07-10-star-passenger-feedback.md) |
| P09 | 核心代码导航 | [代码导航](project/code-navigation.md) |
| P10 | 历史广告平台文档目录 | [docs/platforms](platforms) |
| P11 | 历史试玩广告文档目录 | [docs/playable](playable) |
| P12 | 机制模块根目录 | [src/mechanics](../src/mechanics) |
| P13 | 机制模块聚合器 | [src/mechanics/index.js](../src/mechanics/index.js) |
| P14 | 机制注册表公共接口 | [src/mechanic-registry.js](../src/mechanic-registry.js) |
| P15 | 机制 UI controller 聚合器 | [src/mechanics/ui.js](../src/mechanics/ui.js) |
| P16 | 基础玩法状态机 | [src/game-model.js](../src/game-model.js) |
| P17 | 实验台浏览器入口 | [src/main.js](../src/main.js) |
| P18 | Three.js 场景表现 | [src/scene-view.js](../src/scene-view.js) |
| P19 | 全局实验台样式 | [src/styles.css](../src/styles.css) |
| P20 | 实验台 HTML 壳层 | [index.html](../index.html) |
| P21 | 星星乘客机制目录 | [星星乘客目录](../src/mechanics/star-passenger) |
| P22 | 星星乘客定义与 runtime 导出 | [src/mechanics/star-passenger/index.js](../src/mechanics/star-passenger/index.js) |
| P23 | 星星乘客规则模型 | [src/mechanics/star-passenger/model.js](../src/mechanics/star-passenger/model.js) |
| P24 | 星星乘客 HUD controller | [src/mechanics/star-passenger/view.js](../src/mechanics/star-passenger/view.js) |
| P25 | 星星乘客专属样式 | [src/mechanics/star-passenger/styles.css](../src/mechanics/star-passenger/styles.css) |
| P26 | 星星乘客测试 | [星星乘客测试](../test/star-passenger-mechanic.test.js) |
| P27 | 机制架构测试 | [test/mechanic-architecture.test.js](../test/mechanic-architecture.test.js) |
| P28 | 机制注册表测试 | [test/mechanic-registry.test.js](../test/mechanic-registry.test.js) |
| P29 | 基础玩法综合测试 | [test/game-model.test.js](../test/game-model.test.js) |
| P30 | 中性运行资源目录 | [public/assets/runtime](../public/assets/runtime) |
| P31 | Unity 原始资源目录 | [public/assets/unity](../public/assets/unity) |
| P32 | 关卡与资源 URL 配置 | [src/level-data.js](../src/level-data.js) |
| P33 | 场景 authored tuning | [src/scene-tuning.js](../src/scene-tuning.js) |
| P34 | 场景调参编辑器 | [src/scene-editor.js](../src/scene-editor.js) |
| P35 | 车辆路径与碰撞运动 | [src/vehicle-motion.js](../src/vehicle-motion.js) |
| P36 | 音频控制器 | [src/audio-controller.js](../src/audio-controller.js) |
| P37 | npm 脚本与依赖 | [package.json](../package.json) |
| P38 | 导出的场景调参文件 | [artifacts/scene-tuning.json](../artifacts/scene-tuning.json) |

### 路径模板索引

| 编号 | 模板 | 用途 |
| --- | --- | --- |
| T01 | `src/mechanics/<mechanic-id>/` | 每个机制的独立所有权目录。 |
| T02 | `test/<mechanic-id>.test.js` | 每个机制的规则与接线测试。 |
| T03 | `feature/mechanic-<mechanic-id>` | 每个机制的 Git 功能分支命名。 |

## 1. 新对话建议首条消息

```text
请在仓库根目录 [P00] 中先阅读 [P02]、[P03]、[P04]、[P07] 和 [P08]，再继续 BusLoop 机制实验台开发。

先执行 git status 和 git log -6 --oneline。不要重做试玩广告剥离、机制实验台壳层、机制插件化和星星乘客初版。

星星乘客反馈优化已经实现并验证：星星显示 3/2/1 剩余出口次数、每次经过出口弹出 -1、金币按循环 0/20 充能，并在 20/20 时播放约 1 秒的庆祝；第 3 次经过出口仍未上车时仅星星奖励过期，乘客保留。[P07] 和 [P08] 保留为已完成的设计与实施参考。下一步按既有机制顺序推进 `question-passenger`。
```

## 2. 项目背景与目标

原工程是 BusLoop 可试玩广告。当前已改造成面向策划和研发的机制实验台，用于：

- 浏览、筛选并说明机制。
- 在统一 BusLoop 基础玩法上单独加载和体验一个机制。
- 保留 Three.js 场景、基础关卡、声音、胜负流程、重置和场景调参能力。
- 让多人按机制分支开发，降低公共文件冲突。

当前工程不再以投放广告为目标，不包含商店跳转、安装引导、MRAID 或广告平台打包流程。历史广告文档只保留在 [P10] 和 [P11] 供追溯。

## 3. 仓库与协作基线

- 仓库根目录：[P00]。
- GitHub：[caoyunw/BusLoopPlayable_2.0](https://github.com/caoyunw/BusLoopPlayable_2.0.git)。
- 开始前运行 `git status` 和 `git log -6 --oneline`，以当前仓库状态为准。
- 多人分工时，从团队当前共享基线创建机制分支；不要从过时基线开始。

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

### 4.4 星星乘客反馈优化已可试玩

当前代码位于 [P21]，入口、规则、HUD 和样式分别是 [P22]、[P23]、[P24]、[P25]，测试是 [P26]。

当前已经实现的行为：

- 乘客按 18% 默认概率随机获得星星。
- 星星右上角显示剩余出口次数 `3/2/1`，每次经过出口弹出 `-1`。
- 星星乘客成功上车时，当前金币充能增加 1。
- 有星星飞向进度栏的收集表现。
- 默认充能目标为 20；达到 `20/20` 时播放庆祝，随后从 `0/20` 开始下一轮。
- 第 3 次经过出口仍未上车时，星星奖励消失，但乘客保留。

## 5. 星星乘客反馈优化：已完成

设计规格见 [P07]；实施计划见 [P08]。两份文档均作为已完成工作的参考保留。

### 已实现行为

- 已采用 A 方案：星星右上角显示数字徽章 `3`、`2`、`1`。
- 每次乘客经过出口时，旁边只弹出一次 `-1`，并同步更新数字。
- 归零时星星和徽章消失，乘客继续移动。
- 金币充能改为循环 `0/20`。
- 第 20 枚金币先显示 `20/20`，触发约 1 秒的进度条扫光、金币喷发、星芒与光圈反馈。
- 动效结束后显示 `0/20`，第 21 枚金币显示新一轮 `1/20`。
- 充满不暂停操作、不弹窗，也不发放额外道具。
- 已支持 `prefers-reduced-motion`。

### 已完成的实施范围

| 路径编号 | 修改内容 |
| --- | --- |
| P23 | 已增加 `remainingPasses`、`decrementVersion`、`charge` 和 `completedCharges`。 |
| P18 | 已渲染世界空间的数字徽章和一次性 `-1`。 |
| P24 | 已管理 `0/20` HUD、`20/20` 暂存和庆祝生命周期。 |
| P25 | 已增加扫光、粒子、光圈、缩放和 reduced-motion 样式。 |
| P26 | 已用 TDD 覆盖 3→2→1→0、19/20/21 金币和 UI 接线。 |
| P03 | 已更新用户可见机制说明。 |
| P02 | 已更新交接状态与验证结果。 |

### 当前执行状态

1. 设计讨论：已完成。
2. 视觉方案选择：已完成，选择数字徽章 A。
3. 设计规格：[P07] 已完成。
4. 实施计划：[P08] 已完成并保留为参考。
5. 规则、场景和 HUD 编码：已完成。
6. 自动化测试与构建：已完成；浏览器验收结果见第 12 节。

## 6. 当前机制清单

| ID | 名称 | 状态 | 核心规则 |
| --- | --- | --- | --- |
| `base` | 基础规则 | 可试玩 | 车辆调度、颜色匹配、乘客上车和停车位周转。 |
| `star-passenger` | 星星乘客 | 可试玩，反馈优化已完成 | 星星显示 `3/2/1`，每次经过出口显示 `-1`；上车推进循环 `0/20` 充能，第 3 次仍未上车则奖励过期。 |
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
| `fe47753` | 让星星徽章与 `-1` 反馈遵循 reduced-motion，并补充测试。 |
| `5ce51da` | 清理星星奖励反馈的边界行为与残留状态。 |
| `2219daf` | 实现循环 `0/20` 充能与 `20/20` 庆祝。 |
| `b8c913e` | 实现星星乘客 `3/2/1` 数字倒计时与每次 `-1` 反馈。 |
| `6daf9c1` | 增加星星寿命和可重复充能状态。 |
| `e2cebf0` | 固化星星乘客数字倒计时与循环 0/20 设计。 |
| `50db3bc` | 将机制定义、runtime 和 UI 改造成插件式架构。 |
| `797f3dd` | 实现星星乘客初版规则、进度栏和收集表现。 |
| `b729ad9` | 加入火车、车库、旋转车位等后续机制。 |
| `9b2fff7` | 更新机制实验台验证状态。 |
| `8f78492` | 移除试玩广告交付逻辑。 |

## 8. 接下来如何展开

### 8.1 当前第一优先级

按既有机制顺序推进 `question-passenger`，完成后继续 `question-vehicle`、`count-garage`。星星乘客的 [P07] 设计规格与 [P08] 实施计划已经执行完毕，仅作为后续机制设计和 TDD 接入的完成参考。

### 8.2 后续机制顺序

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
pnpm install
pnpm run dev -- --port 4173
```

星星乘客反馈优化的最低验证：

```bash
node --test test/star-passenger-mechanic.test.js     # [P26]
node --test test/mechanic-architecture.test.js       # [P27]
node --test test/mechanic-registry.test.js           # [P28]
pnpm run build                                       # 脚本定义见 [P37]
```

涉及基础规则、阻挡、停车位或路径时额外运行：

```bash
node --test test/game-model.test.js                   # [P29]
```

该机制的浏览器验收清单：

- `3/2/1` 在队列和传送带上都清晰可见。
- 每次经过出口只出现一个 `-1`。
- 最终星星消失但乘客保留。
- HUD 从 `0/20` 开始，第 20 枚显示 `20/20` 庆祝，约 1 秒后回到 `0/20`。
- 第 21 枚显示 `1/20`，不错误重复上一轮庆祝。
- reset 和机制切换后没有 HUD、粒子、定时器和 Three.js 对象残留。
- 桌面、约 390×844 手机视口及 reduced-motion 模式均通过。

## 12. 当前验证基线

- 注册表共有 17 个机制定义：2 个可试玩（`base`、`star-passenger`），15 个为 `planned`。
- `pnpm test`：88/88 通过。
- `pnpm run build`：通过，有既有的非阻塞 chunk-size 警告。
- Edge 浏览器 QA：桌面、390×844 与 reduced-motion 均通过；已验证 `20/20 → 0/20 → 1/20`、车辆 pointer 命中、布局稳定，且无 console、page 或 network 错误。
- 依赖缓存、意外系统文件和临时日志不是项目源文件，已被忽略。
- [P33] 是 authored runtime 真值；[P38] 是其精确导出副本。
- 运行资源保留在 [P30]；Unity 来源资源保留在 [P31]。

## 13. 注意事项与风险

1. 不要恢复试玩广告逻辑、MRAID、商店链接或广告平台资源路径。
2. 不要把具体机制规则堆入 [P17]、[P16] 或大型条件分支。
3. 星星乘客优化已经实现；[P07] 与 [P08] 是已完成参考，当前行为以 [P23]、[P18]、[P24]、[P25] 和配套测试为准。
4. 修改 [P18] 时要保持场景表现通用，充能规则只能存在于 [P23]。
5. [P24] 的定时器、粒子和 class 必须在 reset、hide 和机制切换时清理。
6. 修改阻挡、停车位或车辆路径时，运行 [P29] 和全量测试。
7. 场景调参源文件和导出文件分别为 [P33] 与 [P38]；机制状态不能污染调参存储。

## 14. 相关文档阅读顺序

1. [P02]：当前状态、下一步和风险。
2. [P07]：星星乘客已完成的设计参考。
3. [P08]：星星乘客已完成的 TDD 实施参考。
4. [P04]：多人协作与 PR 规则。
5. [P03]：工程启动和机制清单。
6. [P09]：修改其他模块时的代码导航。
7. [P05]：实验台原始设计决策。
8. [P06]：插件化架构实施历史。

