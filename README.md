# BusLoop 机制实验台

BusLoop 机制实验台用于设计、接入和直接体验 BusLoop 玩法机制。它保留基础关卡、Three.js 场景、声音、胜负流程、重置与场景调参能力，但不是试玩广告工程，也不包含广告平台适配、安装引导或商店跳转。

## 启动与验证

```bash
npm install
npm run dev
npm test
npm run build
```

- `npm run dev`：启动 Vite 本地开发服务器。
- `npm test`：运行 Node 测试。当前已知基线是 73 项中 66 项通过、7 项历史测试债务失败，详情见 `task_plan.md`。
- `npm run build`：生成生产构建到 `dist/`。
- `npm run apply:tuning`：将 `artifacts/scene-tuning.json` 合并到 authored scene tuning；仅在确认要固化调参时使用。

## 界面

桌面端为三栏工具布局：

1. 左侧机制库：搜索、分类、状态和机制说明。
2. 中间机制舞台：运行基础玩法，或冻结展示待实现机制说明。
3. 右侧场景编辑器：调整镜头、场景、车辆、乘客和特效参数，默认折叠。

手机宽度下，机制库变为左侧抽屉，场景编辑器变为独立工具抽屉，画布保持主要可视区域。

## 当前机制

`base` 基础规则已经可试玩：点击无阻挡车辆进入停车位，同色乘客依次上车，满载车辆离场并释放停车位。

以下 10 个机制已登记为 `planned`，目前只提供说明入口，不会接收游戏输入：

| ID | 名称 |
| --- | --- |
| `question-passenger` | 问号乘客 |
| `question-vehicle` | 问号车 |
| `elevator-bay` | 升降舱 |
| `garage` | 车库 |
| `linked-passengers` | 连体乘客 |
| `linked-vehicles` | 连体车 |
| `special-gate` | 特殊门 |
| `star-passenger` | 星星乘客 |
| `order-passenger` | 订单乘客 |
| `valve` | 阀门 |

可用 URL 直接选择机制：

```text
/?mechanic=base
/?mechanic=question-vehicle
```

未知或缺失的 `mechanic` 值会回退到 `base`；选择机制时会保留 URL 中的其他参数和 hash。

## 新增或实现机制

机制定义位于 `src/mechanic-registry.js`，字段如下：

- `id`：稳定、唯一、适合 URL 的标识。
- `name`：机制显示名称。
- `categories`：用于搜索与分组的分类数组。
- `status`：`playable` 或 `planned`。
- `summary`：列表与覆盖层使用的简述。
- `effect`：规则具体改变了什么。
- `experience`：对玩家决策与体验的影响。
- `difficulty`：理解难度。

接入步骤：

1. 先在注册表补全机制定义，并保持 `status: 'planned'`。
2. 在独立模块中实现机制数据和规则；复用 `game-model`、`level-data`、`scene-view` 的现有边界，不把机制规则堆回 `main.js`。
3. 通过 `src/mechanic-lab.js` / `src/main.js` 的选择流程接入运行、暂停、重置和 URL 同步。
4. 为注册表、查询参数、输入隔离和具体玩法增加配套测试。
5. 完成真实可玩流程与浏览器视觉 QA 后，再把状态改为 `playable`。

机制库 UI 会自动读取注册表；通常不需要在 `index.html` 中手写新条目。

## 场景调参与存储

场景编辑器常驻实验台运行时并默认折叠。调参覆盖保存在浏览器 `localStorage` 的 `bus-loop-scene-tuning-v3`；旧的 `v2` 数据会安全迁移。存储读取、写入和清除失败只会记录警告，不应阻止基础玩法启动。

`src/main.js` 会在读取本地覆盖前克隆 `src/scene-tuning.js` 的 authored defaults，因此“恢复默认”始终回到源码配置，而不是当前会话已变更的对象。需要固化一组调参时，先导出到 `artifacts/scene-tuning.json`，再运行 `npm run apply:tuning` 并检查 diff。

## 范围说明

本工程不包含广告平台打包脚本、MRAID/CTA、安装门槛、应用商店 URL 或商店跳转。`docs/platforms/` 和旧 playable 文档仅保留历史背景，不是当前开发流程。
