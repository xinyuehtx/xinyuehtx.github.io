---
title: "dsh-plugin-hooks-ordering"
description: "为 deepseek harness 的 waterfall 和 serial 进行确定性 hooks 监听排序"
hidden: true
recommend: false
editLink: false
lastUpdated: false
---
<div class="project-page-header">
  <p class="project-meta"><span class="proj-lang"><i class="proj-dot" style="--dot:#3178c6"></i>TypeScript</span> · <span>⭐ 2</span> · <span>🕒 更新于 2026-08-17</span></p>
  <p class="project-actions"><a class="proj-btn proj-btn-primary" href="https://github.com/xinyuehtx/dsh-plugin-hooks-ordering" target="_blank" rel="noreferrer">GitHub 仓库</a> <a class="proj-btn" href="https://xinyuehtx.github.io/dsh-plugin-hooks-ordering/" target="_blank" rel="noreferrer">在线 Demo ↗</a></p>
</div>

[English](https://github.com/xinyuehtx/dsh-plugin-hooks-ordering/blob/main/README.md) | **简体中文**

为 [Cordis](https://github.com/cordiverse/cordis) 钩子提供确定性的 `before`/`after` 排序——即使参与者来自彼此独立、互不感知的插件。同时支持 `waterfall` 与 `serial` 两种派发模式，并附带一个可选的 [DeepSeek-Harness](https://github.com/deepseek-ai/deepseek-harness) 层，开箱即用地控制真实的 dsh 钩子。

- **在线演练场：** https://xinyuehtx.github.io/dsh-plugin-hooks-ordering/ —— 可交互，且在**你的浏览器中运行真实的 Cordis 上下文**（真实派发、真实服务），而非模拟。
- **可运行的示例：** `pnpm run demo`（通用 Cordis）与 `pnpm run demo:dsh`（在真实 dsh 钩子名上真实派发，并把 DAG 日志写入文件）。

---

## 问题

Cordis 按**注册顺序**派发 waterfall 监听器——也就是它们在内部监听器数组中的位置，唯一的调节手段是 `prepend`。而注册顺序又由 `inject` 依赖的激活时机决定，这在**互不相关的插件之间是非确定性的**。

由此带来的后果是：一个插件**无法可靠地声明相对顺序**，比如「让我在那个插件之后运行」。具体来说：

- `ctx.on` 上没有 `before`/`after`/`stage` 声明——只有一个布尔值 `prepend`，而且 `prepend` 是「后 prepend 者胜」，所以它也不是稳定的「永远第一」。
- Cordis 提供的唯一稳健的排序原语是 `inject`：如果插件 B 注入了插件 A 提供的服务，B 就会在 A 之后激活。但这会**全局且单向地**固定顺序，并强制 B 依赖 A——对于必须互不依赖的不同厂商而言这是不可能的。
- 两个插件可能需要在**不同的**钩子上要求**相反的**相对顺序。单一的激活顺序无法表达这一点。

于是那些真正重要的顺序——鉴权先于日志、清洗先于序列化、指标采集最后——都悄悄依赖于无人掌控的加载顺序。改动一个不相干的 `inject`，顺序就翻转了。

```
原生 ctx.on，加载顺序 [auth, logging, metrics]  ->  auth, logging, metrics
原生 ctx.on，加载顺序 [metrics, logging, auth]  ->  metrics, logging, auth   ← 相同插件，顺序翻转
```

这并非假想。在 `deepseek-harness` 中，waterfall 钩子 `agent/pre-step` 被十余个独立包订阅，`tools/post-execute` 被六个、`llm/stream` 被五个订阅——而且多处明确记载：相对顺序是关键载荷，却仅由 `prepend` 和注册时机决定（见下文[现有 dsh 排序手段及其局限](#现有-dsh-排序手段及其局限)）。

## 解决方案

你**无需**修改或 fork Cordis。本包是一个普通的 Cordis 插件，它为选定的钩子加上**括号（bracket）**并自行决定参与者顺序，与插件加载时机无关。

**Waterfall**（`HookOrdering`）用一个 `prepend` 的监听器括起钩子，并利用洋葱模型：

- 监听器 `next()` **之前**的代码会在整条原生链之前运行——即 **`front`** 阶段。
- `next()` **之后**的代码会在所有内容（包括钩子内置的默认行为）之后运行——即 **`back`** 阶段。

**Serial**（`SerialHookOrdering`）没有可包裹的 `next()`，因此用两个协调器括起钩子：一个 `prepend` 的 **front** 协调器，跑在原生链之前（在此处 bail 会短路整条派发）；以及一个 append 的 **back** 协调器，尽力排在最后。

两者中，参与者都向协调器（而非原生钩子）注册，并带上 `before`/`after` 名称，由一个**稳定的拓扑排序**决定它们的顺序。

```
HookOrdering，加载顺序 [auth, logging, metrics]  ->  auth, logging, <host default>, metrics
HookOrdering，加载顺序 [metrics, logging, auth]  ->  auth, logging, <host default>, metrics   ← 稳定
```

### 为什么这该是插件，而不是 Cordis 本身

Cordis 刻意保持极简：它提供排序的*原语*（数组位置、`prepend`、`next()` 链）。而排序的*策略*——数值序、`before`/`after`、拓扑排序——因钩子而异，不是内核该关心的事。把它做成插件意味着零框架改动，也无需维护 fork。

## 分层

本包做了分层设计，你可以在所需的高度上使用它：

| 层 | 入口 | 提供什么 |
| --- | --- | --- |
| 1. 算法 | `@tengxiaohtx/dsh-plugin-hooks-ordering/topo-sort`、`/dag` | 纯的稳定拓扑排序，以及约束图（JSON）渲染器。零依赖、不依赖 Cordis。 |
| 2. Cordis 服务 | `@tengxiaohtx/dsh-plugin-hooks-ordering`（根）、`/waterfall`、`/serial` | `HookOrdering` 与 `SerialHookOrdering`——在任何 Cordis 应用中控制任意钩子。 |
| 3. DeepSeek-Harness | `@tengxiaohtx/dsh-plugin-hooks-ordering/dsh` | 一个 dsh 插件 + `cordis.patch.yml`，替你控制真实的 dsh 钩子。 |

## 安装

```sh
pnpm add @tengxiaohtx/dsh-plugin-hooks-ordering
# 对等依赖：
pnpm add @deepseek-ai/cordis
```

## 用法

### Waterfall 钩子

```ts
import HookOrdering from '@tengxiaohtx/dsh-plugin-hooks-ordering'

ctx.plugin(HookOrdering)

// 钩子的拥有者（或应用编排层）只接管一次。这会安装那个唯一的
// bracket 监听器；重复接管会抛错，因此 prepend 竞态不会卷土重来。
ctx.hooksOrdering.control('request/assemble')

// 厂商 A —— 只声明自己的约束，不从厂商 B 导入任何东西。
ctx.hooksOrdering.register('request/assemble', 'front', {
  name: 'auth',
  before: ['logging'],
  run: (req) => authenticate(req),
})

// 厂商 B —— 另一个包，对 A 一无所知。
ctx.hooksOrdering.register('request/assemble', 'front', {
  name: 'logging',
  run: (req) => log(req),
})

// 厂商 C —— 必须在所有东西之后运行，连 host 默认行为也在其前。
ctx.hooksOrdering.register('request/assemble', 'back', {
  name: 'metrics',
  run: (req) => emitMetrics(req),
})
```

无论这三个插件以何种顺序加载或注册，`auth` 总是先于 `logging` 运行，而 `metrics` 总是最后运行。

### 输出约束 DAG

传入一个 `log` 文件，即可在**每次注册变更时**把约束图（JSON）写入该文件，使其始终反映当前状态——在排查异常顺序或环时非常有用：

```ts
ctx.plugin(HookOrdering, { log: './hooks-ordering-dag.json' })
```

```jsonc
{
  "sections": [
    {
      "hook": "request/assemble",
      "phase": "front",
      "nodes": ["auth", "logging"],
      "edges": [{ "from": "auth", "to": "logging" }]   // auth 先于 logging 运行
    },
    {
      "hook": "request/assemble",
      "phase": "back",
      "nodes": ["metrics"],
      "edges": []
    }
  ]
}
```

该图渲染时**不做**拓扑排序，因此出现环也会如实呈现，而不是抛错。你也可以随时通过 `ctx.hooksOrdering.dumpDag()` 以编程方式读取（返回 JSON 字符串）。写入失败会经 `console.warn` 报告，绝不抛回 fiber。

### Serial 钩子

```ts
import { SerialHookOrdering } from '@tengxiaohtx/dsh-plugin-hooks-ordering'

ctx.plugin(SerialHookOrdering)
ctx.serialHooksOrdering.control('turn/stopping')

// front：跑在原生链之前。返回一个 bail 值（除 null/false/undefined 外的任何值）
// 会短路整条 serial 派发。
ctx.serialHooksOrdering.register('turn/stopping', 'front', {
  name: 'guard',
  run: (turn) => (isAllowed(turn) ? undefined : 'DENIED'),
})

// back：尽力排在最后（见「语义与限制」）。
ctx.serialHooksOrdering.register('turn/stopping', 'back', {
  name: 'audit',
  run: (turn) => recordAudit(turn),
})
```

### 在 DeepSeek-Harness 中

`/dsh` 入口是一个 dsh 插件，它会挂载上述两个服务，并接管那些被多个包贡献的 dsh 钩子（`agent/pre-step`、`tools/pre-execute`、`tools/post-execute`、`system-prompt/assemble`、`llm/stream`……以及 serial 的 `agent/turn-stopping`）。只需在 profile 补丁中加一行：

```yaml
- insert:
    - id: hooks-ordering
      name: '@tengxiaohtx/dsh-plugin-hooks-ordering/dsh'
      config:
        # hooks: ['agent/pre-step', 'tools/post-execute']   # 默认：全部已知 dsh waterfall 钩子
        # serialHooks: ['agent/turn-stopping']              # 默认：[agent/turn-stopping]
        # log: './hooks-ordering-dag.json'                  # 可选的 DAG 日志
```

控制一个没有任何参与者的钩子是透明的直通，因此这一行在某插件用 `before`/`after` 注册之前不会改变任何行为。包根目录附带了一份 `cordis.patch.yml`（通过 `dsh.bundle.patch` 清单字段声明），内容同样是这一行。

## 推荐装配顺序

顺序由协调器强制，而非由加载位置决定——但协调器的 bracket 必须**在原生监听器注册之后才被 prepend**，因此本插件要**最后**挂载：

- 本插件用一个 **prepend** 的监听器括起每个受控钩子；`prepend` 会把它放到*截至目前*所有已注册监听器之前。最后挂载时，它的 `next()` 包住整条原生链——`front` 跑在所有原生监听器之前，`back` 跑在它们全部之后（也在 host 默认行为之后）。
- 若更早挂载，之后某个用 `{ prepend: true }` 注册的原生插件会落到 bracket *之前*而逃脱排序——相当于「覆盖」了协调器的放置。

贡献者不受加载顺序影响：它们用 `before`/`after` 名称向协调器 `register()`，而非在 `ctx.on` 上竞态，因此从不争夺 prepend 位置。

在 dsh profile 中，这意味着把 `hooks-ordering` 行放进**用户的 `cordis.patch.yml`**——它在所有 bundle 层之后应用，因此本插件天然最后加载。完整 profile 见 [`examples/dsh-profile`](https://github.com/xinyuehtx/dsh-plugin-hooks-ordering/blob/main/examples/dsh-profile)。

## 现有 dsh 排序手段（及其局限）

以下是 `deepseek-harness` 中影响钩子顺序的现有手段——也就是本插件要取代的「bypass」。它们都真实存在，但都不足以表达声明式的相对顺序：

1. **`ctx.on(...)` 上的 `{ prepend: true }`** —— 引擎唯一的放置手段（`unshift` 对 `push`，`vendor/cordis/src/events.ts:143`）。它是二值的，且「后 prepend 者胜」：两个都 prepend 的插件会相互竞态，谁也无法声明「front 中的第一个」。例如 `packages/spill/spill-policy/src/index.ts:209` 与 `packages/llm/llm/src/invariant.ts:88` 在用。
2. **注册 / `ctx.plugin(...)` 调用顺序** —— 默认 append 使调用顺序成为执行顺序。只有当单一编排点掌控所有调用时才有效；一旦由互不隶属的厂商以无人掌控的顺序加载，就会失效。`packages/skill/tool-skill/src/index.ts:164` 与 `packages/examples/agent-spine-demo/src/index.ts:257` 刻意（且脆弱地）依赖它。
3. **`inject` 依赖** —— 把插件的*激活*门控在服务可用性上（如 `packages/core/agent-loop/src/index.ts:297` 的 `static inject = [...]`）。它排序的是插件相对*服务*的位置，**全局且单向**，并强制引入依赖边。它无法表达同一钩子上两个监听器之间的相对顺序，也无法表达不同钩子上的相反顺序。
4. **顺序不变式断言** —— 事后检测错误顺序（`packages/context/time-context/src/invariant.ts:66`），但不强制顺序。
5. **profile `cordis.patch.yml` 行序** —— 明确*不带*加载语义（「激活由服务可用性驱动」，`packages/bundle/base/cordis.patch.yml:13`），因此根本无法为监听器排序。

`HookOrdering`/`SerialHookOrdering` 用单一的声明式原语取代了以上五种：声明你的 `before`/`after`，向协调器注册，顺序便与加载时机无关地稳定——而且当顺序出错时，约束图还能以 JSON DAG 的形式供你查看。

## API

### `ctx.hooksOrdering` —— `HookOrdering` 服务（waterfall）

| 方法 | 说明 |
| --- | --- |
| `control(hook)` | 在 waterfall 钩子 `hook` 上安装 bracket。每个钩子只调用一次。返回一个 disposer。若已被接管则抛出 `HookControlError`。 |
| `register(hook, phase, entry)` | 向 `'front'` 或 `'back'` 添加一个参与者。返回一个 disposer。若该钩子未被接管则抛出 `HookControlError`。 |
| `plan(hook, phase)` | 返回参与者将要运行的顺序（名称列表）——用于测试和诊断。 |
| `dumpDag()` | 以 JSON 字符串返回所有受控钩子的约束 DAG。 |

配置：`ctx.plugin(HookOrdering, { log?: string })`。

### `ctx.serialHooksOrdering` —— `SerialHookOrdering` 服务（serial）

与 `HookOrdering` 接口相同（`control` / `register` / `plan` / `dumpDag`，配置相同）。其条目的 `run` 可以**返回**一个值：bail 值（除 `null`/`false`/`undefined` 外的任何值）会短路 serial 派发并成为其结果。

### `HookEntry` / `SerialHookEntry`

| 字段 | 含义 |
| --- | --- |
| `name` | 在同一个 `(hook, phase)` 内唯一。被其他条目的 `before`/`after` 引用。 |
| `before?` | 本条目必须排在这些名称之前。 |
| `after?` | 本条目必须排在这些名称之后。 |
| `run(...payload)` | 以钩子的 payload 调用（waterfall：派发的参数，去掉 Cordis 末尾的 `next`）。会被 await。serial 的 `run` 可返回 bail 值。 |

### `topoSort(entries)`（`.../topo-sort`）与 `buildDag(sections)`（`.../dag`）

零依赖的稳定拓扑排序，独立导出。并列项保持输入顺序；未知的 `before`/`after` 目标是空操作；出现环则抛出 `OrderingCycleError`。`buildDag` 把约束图渲染为一个普通对象（`{ sections: [{ hook, phase, nodes, edges }] }`）供 `JSON.stringify` 使用——它从不排序，也从不因环抛错。

## 语义与限制

- **仅限 waterfall 与 serial。** waterfall 的 bracket 需要 `next()`；serial 用两个带 bail 语义的协调器。`emit`/`parallel`/`bail` 钩子没有可协调的有序链。
- **每个钩子一个协调器。** 第二个 `prepend` 会重新引入竞态，因此 `control` 会拒绝重复接管。
- **它只排序自己拥有的部分。** 协调器控制它的 `front`/`back` 注册表及其内部顺序，并把它们相对原生链放置。它不会重排外部监听器*彼此之间*的顺序。
- **waterfall 的 `back` 是精确的；serial 的 `back` 是尽力的。** waterfall 的 `back` 通过 `next()` 跑在整条原生链之后。serial 没有 `next()`，因此它的 back 协调器在 `control()` 时被 append，跑在那一刻已存在的监听器之后——在 `control()` *之后*添加的原生监听器会排在它后面，而且任何 bail（原生或 front）都会整体跳过它。
- **未知引用 = 空操作。** 跨厂商的 `after: ['maybe-absent']` 在该 peer 未加载时不施加任何约束——跨厂商插件不能假设彼此存在。
- **出现环在派发时明确报错。** 相互冲突的约束会抛出 `OrderingCycleError`，指出被阻塞的条目（而 `dumpDag()` 仍会渲染出这个环供检查）。

## 开发

```sh
pnpm install
pnpm test            # vitest，单元测试 + 真实 cordis 集成测试
pnpm test:coverage   # 100% 单文件覆盖率门槛
pnpm typecheck
pnpm lint
pnpm build           # tsdown -> lib/（ESM + d.ts）
pnpm demo            # 问题与修复，waterfall + serial，并排对比
pnpm demo:dsh        # 在真实 dsh 钩子名上真实派发 + DAG 日志文件
pnpm playground:build   # -> playground/dist（部署到 GitHub Pages）
```

CI 使用 pnpm 并面向公共 npm 源安装（见 `.npmrc`）。

## 许可证

[MIT](https://github.com/xinyuehtx/dsh-plugin-hooks-ordering/blob/main/LICENSE)
