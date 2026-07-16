# 机制 Demo 协作规范

这份规范用于多人并行实现 BusLoop 机制 Demo。目标是让每个人主要修改自己的机制目录，减少 `game-model.js`、`scene-view.js`、`main.js` 这类核心文件冲突。

## 分支方式

每个机制单独开分支：

```bash
git checkout main
git pull --rebase origin main
git checkout -b feature/mechanic-train
```

分支命名建议：

```text
feature/mechanic-train
feature/mechanic-locked-garage
feature/mechanic-rotating-spots
```

不要多人共用同一个机制分支。每天开始前先同步主分支：

```bash
git pull --rebase origin main
```

## 文件归属

每个机制放在独立目录：

```text
src/mechanics/<mechanic-id>/
  index.js
  model.js
  view.js
  styles.css
```

字段职责：

| 文件 | 责任 |
| --- | --- |
| `index.js` | 导出机制 `definition`，以及可玩机制的 `createRuntime` |
| `model.js` | 机制规则、状态、事件、快照字段 |
| `view.js` | 机制专属 HUD、DOM、视觉同步 |
| `styles.css` | 机制专属 UI 样式 |

没有可玩实现的机制可以只有 `index.js`。已有的 `star-passenger` 是参考模板。

## Runtime Hook

可玩机制通过 runtime hook 接入 `BusLoopGame`：

```js
export function createRuntime(context) {
  return {
    id: 'example-mechanic',
    createState,
    createQueueItemData,
    createSlotData,
    cloneQueueItemSnapshot,
    cloneSlotSnapshot,
    decorateSnapshot,
    onPassengerEnteredBelt,
    onPassengerExitPassed,
    onPassengerBoarded,
    clearSlotData
  };
}
```

常用 hook：

| Hook | 何时调用 |
| --- | --- |
| `createState` | 关卡 reset 时初始化机制状态 |
| `createQueueItemData` | 创建队列乘客时附加机制数据 |
| `createSlotData` | 创建传送带 slot 时附加机制数据 |
| `cloneQueueItemSnapshot` | 输出队列快照时深拷贝机制数据 |
| `cloneSlotSnapshot` | 输出传送带快照时深拷贝机制数据 |
| `decorateSnapshot` | 给整体 snapshot 增加机制字段 |
| `onPassengerEnteredBelt` | 乘客从队列进入传送带时 |
| `onPassengerExitPassed` | 乘客经过出口计数点时 |
| `onPassengerBoarded` | 乘客成功上车前 |
| `clearSlotData` | slot 被清空时清理机制数据 |

如果某个 hook 不需要，直接不导出对应函数即可。

## UI Controller

机制专属 UI 通过 `src/mechanics/ui.js` 聚合。每个 UI controller 使用统一接口：

```js
export function createExampleHud({ stage }) {
  return {
    reset() {},
    sync({ state, mechanic }) {}
  };
}
```

`sync` 内部必须先判断当前机制：

```js
if (mechanic?.id !== 'example-mechanic') {
  hide();
  return;
}
```

## 尽量少改的公共文件

优先避免频繁改这些文件：

```text
src/game-model.js
src/scene-view.js
src/main.js
src/styles.css
index.html
```

如果确实需要新增通用 hook 或通用表现能力，先单独做一个小 PR，让其他机制分支 rebase 后再继续。

## 新机制接入清单

1. 在 `src/mechanics/<mechanic-id>/index.js` 中补 `definition`。
2. 在 `src/mechanics/index.js` 中引入机制模块，并放到 `modules` 数组里。
3. 如果机制可玩，补 `model.js` 并从 `index.js` 导出 `createRuntime`。
4. 如果机制有专属 HUD，补 `view.js` / `styles.css`，并在 `src/mechanics/ui.js` 中加入 controller。
5. 补测试，至少覆盖机制注册和核心规则。
6. 跑验证命令。

## PR 前验证

最少运行：

```bash
node --test test/mechanic-registry.test.js
node --test test/mechanic-architecture.test.js
npm run build
```

如果实现了具体机制规则，还要增加并运行对应机制测试：

```bash
node --test test/<mechanic-id>.test.js
```

当前 `test/game-model.test.js` 仍有历史失败项，不能作为本次机制 PR 的全量通过标准；PR 描述里要说明是否触碰了这些历史失败相关区域。

## PR 描述模板

```markdown
## 改动
- 实现 `<mechanic-id>` 机制 Demo
- 新增/调整机制 UI
- 新增对应测试

## 验证
- `node --test test/mechanic-registry.test.js`
- `node --test test/mechanic-architecture.test.js`
- `node --test test/<mechanic-id>.test.js`
- `npm run build`

## 风险
- 是否改动公共 hook
- 是否影响 base / star-passenger
- 是否需要其他机制分支 rebase
```
