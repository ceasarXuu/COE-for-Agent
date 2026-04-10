# COE for Agent

让 AI 助手处理复杂问题时，不再只产出一个结论，而是留下完整、可追踪、可审计、可回放的证据链。

> COE 是 Chain of Evidence 的缩写。
>
> 当前状态：截至 2026-04-09，仓库的目标是本地可运行、可演示、可验证的 MVP 主链路；它是面向单机开发与实验验证的产品，不以企业化或生产化收口为当前目标。

## 它是什么

COE for Agent 是一套面向 AI 产品团队的调查基础设施。

它把复杂问题处理过程，从一次性的黑盒推理，变成一条结构化调查流程：

- 开案并定义目标
- 记录症状、实体、证据和事实
- 提出假设并规划验证实验
- 在进入修复或结案前执行守卫检查
- 让人类在监管台中回看、审查、接管和确认高风险动作

如果你在做 coding agent、support agent、故障分析 agent、运维调查 agent，或者任何需要“先搞清楚问题，再安全行动”的系统，这个项目就是为这类场景设计的。

## 为什么需要它

很多 agent 系统在处理复杂问题时都有同一类短板：

- 能给出答案，但很难解释答案是怎么形成的
- 会消耗大量上下文，但缺少稳定的调查状态
- 可以连续行动，但不容易被人类中途接管
- 最后只剩一个结果，很难回放中间过程
- 容易在证据不足时直接进入改代码、改配置或下结论

COE for Agent 的目标不是让 agent 更会“猜”，而是让 agent 更会“办案”。

## 适合谁

- 在做 AI 编程、故障排查、支持自动化、运维调查产品的团队
- 需要把 agent 输出从“结果导向”升级为“过程可审计”的平台团队
- 需要人机协同调查，而不是纯自动化黑盒执行的组织
- 希望用 MCP 标准面暴露调查能力的开发团队

## 它提供什么

### 面向 agent 的 Investigation Server

这是系统的核心后端。对 agent 来说，它是一套 MCP-first 的调查能力面，而不是一堆零散脚本。

它已经实现的关键能力包括：

- 领域命令式写入：开案、推进阶段、记录症状、附加证据、断言事实、提出假设、规划实验、记录决策
- 只读资源读取：案件列表、快照、时间线、图切片、证据覆盖、历史 diff、假设面板、inquiry 面板
- 事件流真相源：所有核心写入都会留下 append-only 事件
- 历史回放：支持基于 revision 的历史读取、checkpoint 和 replay
- 守卫规则：支持 stall、ready-to-patch、close-case 等关键检查
- 导出能力：支持事件导出和 PROV-compatible 导出

### 面向人类的 Investigation Console

这是系统的监管台。它不是为了替代 agent，而是为了让人类真正看得见、接得住、管得住。

当前已经具备：

- Case List：查看案件列表和基本状态
- Snapshot：查看当前案件概览、关键计数和风险提示
- Timeline：按事件回看调查过程
- Graph：查看调查对象之间的局部关系切片
- Coverage：查看证据覆盖是否充分
- Inspector：查看 hypothesis、fact、experiment、decision、gap、residual 等对象详情
- Action Panel：由 Reviewer 执行受控写操作
- 历史模式禁写：在回看旧 revision 时自动冻结高风险动作
- 高风险确认流：通过 confirmToken 强制要求 Reviewer 确认关键操作

## 一个典型使用流程

1. Agent 创建一个 Case，明确调查目标。
2. Agent 持续记录症状、实体、Artifact 和 Fact，而不是把所有推理都写在自由文本里。
3. Agent 提出一个或多个 Hypothesis，并为它们安排 Experiment。
4. 系统用 Guardrail 检查当前证据是否足以进入修复或结案阶段。
5. 人类 Reviewer 在 Console 中查看 Snapshot、Timeline、Graph 和 Inspector。
6. 如果需要进入高风险动作，人类显式确认，系统保留可追踪的审计链。

## 它和常见 agent 工具有什么区别

| 维度 | 常见 agent 工具 | COE for Agent |
| --- | --- | --- |
| 核心输出 | 一次性回答或一次性行动 | 一条持续累积的调查链路 |
| 过程记录 | 主要依赖对话上下文 | 结构化对象 + append-only 事件流 |
| 人类接管 | 多为事后介入 | 从设计上支持审查、确认和禁写 |
| 历史回看 | 很难还原 | 可按 revision 回放和对比 |
| 写入方式 | 可能是任意接口或脚本 | 固定为 MCP 领域命令 |
| 风险治理 | 依赖调用方自觉 | 内置 guardrail、role 和 confirmToken |

## 当前已经实现的内容

下表描述的是当前仓库已经有代码和验证支撑的能力，而不是计划中的能力。

| 能力 | 当前状态 |
| --- | --- |
| MCP Investigation Server | 已实现 |
| Investigation Console | 已实现 |
| 事件流与当前态投影 | 已实现 |
| Case List collection resource | 已实现 |
| 历史 replay、checkpoint、diff | 已实现 |
| Guardrails | 已实现 |
| Reviewer confirm 流 | 已实现 |
| OpenAPI control plane | 已实现 |
| PROV-compatible 导出 | 已实现 |
| 根级 lint、typecheck、test、test:e2e 回归 | 已通过 |

## 当前明确不做的事情

这个仓库当前服务于本地实验、产品验证和功能迭代，不以企业和生产级目标为验收标准。

当前明确不做的部分包括：

- 企业级认证与身份治理
- 多租户与组织级隔离
- 完整生产部署与运维体系
- 复杂 CI/CD、发布编排与平台化治理
- 大规模容量、性能、弹性和成本治理
- 超出本地 MVP 范围的跨 agent 协议层扩展，例如 A2A facade

## 快速上手

### 环境要求

- Node.js 22+
- pnpm

### 本地启动

```bash
pnpm install
pnpm dev
```

启动后：

- monorepo 开发脚本会启动 Server 和 Console 相关开发进程
- 按终端输出中的地址打开 Console

如果你希望用根目录脚本完成初始化和启动：

```bash
./install.sh
./start.sh
```

其中：

- `install.sh` 会安装依赖、补 `.env`、扫描本机已安装的 Codex / Claude Code / OpenCode，并只对检测到的宿主注入 MCP 配置
- `start.sh` 会后台启动本地开发服务，等待 Console 就绪，并自动打开浏览器

### Agent Host 初始化

如果你希望把本项目作为本机的 MCP server 接到 Codex、Claude Code、OpenCode，可以在依赖安装完成后执行：

```bash
pnpm setup:agents:plan
pnpm setup:agents
```

这套初始化流程会做几件事：

- 为 Codex 注册 `coe-investigation` MCP server，并把仓库内的 COE skill 链接到 `~/.codex/skills`
- 为 Claude Code 写入项目级 MCP 注册
- 为 OpenCode 生成项目级 `opencode.json`
- 复用仓库内的 `.claude/commands`、`.opencode/commands`、`.agents/skills`

如果你只想单独启动 MCP stdio 入口做调试，可以执行：

```bash
pnpm mcp:stdio
```

注意：

- agent host 使用 stdio MCP 时，不需要先手动启动 `pnpm dev`
- 数据默认保存在本地目录 `./.var/data`
- 如果你还要使用 Console 监管台，再单独执行 `pnpm dev`

### 本地验证

如果你想确认当前仓库主链路可运行，可以执行：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

本地 MVP 的完成标准是：

- 一台新机器按上述步骤能把依赖、数据库和控制台跑起来
- Console 可以通过真实或 fixture 调查数据完成主链路演示
- Reviewer 的核心动作在本地能被验证
- `lint`、`typecheck`、`test`、`test:e2e` 至少能在本地开发环境中给出稳定、可操作的结果

## 仓库结构

```text
apps/
  investigation-server/   MCP Investigation Server
  investigation-console/  Console Web + BFF

packages/
  domain/                 领域类型、状态机、revision envelope
  persistence/            PostgreSQL schema、repositories、migrations
  schemas/                JSON Schema、validator、fixture registry
  mcp-contracts/          tool names、resource URIs、error codes
  telemetry/              共享 telemetry 抽象
  shared-utils/           共享轻量工具函数

docs/
  DEV/                    技术设计与实现说明
  PRD/                    产品需求文档
  plans/                  MVP 实施计划
```

## 文档入口

如果你想继续深入，可以按下面顺序阅读：

1. [docs/DEV/technical-design.md](docs/DEV/technical-design.md)
2. [docs/plans/2026-04-05-coe-mvp-implementation.md](docs/plans/2026-04-05-coe-mvp-implementation.md)
3. [docs/PRD/coe-for-agent-prd.md](docs/PRD/coe-for-agent-prd.md)

如果你想快速理解当前代码结构，可以看：

- [apps/investigation-server](apps/investigation-server)
- [apps/investigation-console](apps/investigation-console)
- [packages](packages)

## 一句话总结

COE for Agent 要解决的，不是“让 agent 再多做一点事”，而是“让 agent 在处理复杂问题时，留下人类可以理解、审查和接管的证据链”。
