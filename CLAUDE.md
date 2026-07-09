# CLAUDE.md

# BusLoop 机制实验台工作规则

当前工程用于设计、实现和浏览器内体验 BusLoop 机制，不是广告交付工程。默认任务是维护机制实验台、基础运行时、场景和编辑器；历史广告平台文档仅供追溯，不是当前 SOP。

## 默认阅读顺序

每轮先读：

1. `docs/project/playable-project-progress.md`
2. `docs/project/code-navigation.md`
3. 导航表映射到的源码与配套测试

涉及当前优先级或交接时，再读 `task_plan.md`、`progress.md`。涉及玩法事实、资源、调参、存储或模块边界时，读 `findings.md`。

`docs/platforms/`、`docs/playable/` 和旧归档可以保留，但除非用户明确要求研究历史，不要把平台打包、商店跳转或广告流程重新纳入任务。

## 机制优先

1. 先写清机制规则、玩家决策变化和验收条件。
2. 在 `src/mechanic-registry.js` 补全定义；没有真实可玩实现时保持 `planned`。
3. 机制数据和规则放在独立模块，复用基础运行时边界，不把大量机制分支塞进 `src/main.js`。
4. 通过实验台层接入选择、URL、暂停、重置和错误恢复。
5. 增加注册表测试与对应玩法测试。
6. 完成桌面和手机浏览器视觉 QA 后，才可标记为 `playable`。

## 代码边界

- `src/main.js`：实验台装配、基础运行时、调参存储、动画循环与 QA API。
- `src/mechanic-registry.js`：机制 ID、元数据、状态和查询。
- `src/mechanic-lab.js`：`?mechanic=` 解析/同步及安全存储清理。
- `src/mechanic-library.js`：机制库搜索、分组、详情与手机抽屉交互。
- `src/game-model.js`、`src/level-data.js`、`src/scene-view.js`：基础玩法、关卡数据和 Three.js 场景。
- `src/scene-editor.js`、`src/scene-tuning.js`：常驻场景编辑器和 authored defaults。

Web 运行优化资源放在 `public/assets/runtime/`；Unity 原始导出放在 `public/assets/unity/`。不要静默编造 Unity 资源或 authored 数值。

## 调参与存储

- 场景编辑器是实验台常驻能力，默认折叠。
- 应先克隆 authored defaults，再合并浏览器本地覆盖，保证“恢复默认”可靠。
- `localStorage` 是可选增强；读取、迁移、写入、清除失败不能阻塞启动。
- 需要把调参固化到源码时，先检查导出 JSON，再使用 `npm run apply:tuning` 并审阅 diff。

## 测试基线

2026-07-09 已确认：

- 机制定向测试：22/22 通过。
- 全量测试：73 项中 66 项通过，7 项既有失败记录在 `task_plan.md`。
- 构建：通过，但有既有的大 chunk 警告。

不得把全量测试描述为全部通过。修改机制时先跑最窄相关测试；涉及共享运行时、布局、配置或交付状态时，再跑全量测试和构建。

## 浏览器视觉 QA

UI、交互或渲染改动必须检查：

- 桌面三栏与手机抽屉。
- 画布非空、车辆可操作、控制区不遮挡主要盘面。
- 机制搜索、空结果、选择、URL 刷新保持。
- 待实现机制冻结输入与说明覆盖层。
- 场景编辑器、重置、胜负面板和控制台错误。

记录实际 viewport、验证对象与未完成项；不要用静态测试代替视觉结论。

## 文档维护

- 里程碑与验证状态：`docs/project/playable-project-progress.md`
- 代码职责：`docs/project/code-navigation.md`
- 持久结论：`findings.md`
- 当前目标与优先级：`task_plan.md`
- 会话交接：`progress.md`

保留有价值历史，但用“历史/归档”明确隔开。不要写内部绝对路径、秘密或未验证结论。
