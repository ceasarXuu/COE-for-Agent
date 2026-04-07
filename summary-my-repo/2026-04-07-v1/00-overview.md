# COE for Agent 仓库概览

## 这是什么仓库

COE for Agent 是一个面向复杂问题调查的 MCP-native 基础设施仓库。它把 agent 的问题处理过程收敛为一套受约束的调查工作流：开案、记录症状与证据、提出假设、规划实验、形成决策、执行 guardrail 检查，并允许人类在 Console 中回看、审计和受控接管。

从当前代码证据看，这个仓库已经不再是“只有方案文档”的阶段，而是一个已经打通主链路的 MVP 集成实现。

## 当前成熟度

### 已实现

- Monorepo 骨架、workspace 脚本、turbo 任务编排、本地开发环境配置。
- 规范层：spec、schemas、conformance fixtures、MCP contracts、domain 类型与状态机。
- 持久化层：PostgreSQL schema、事件流、当前态表、去重表、case list projection、checkpoint、outbox。
- Investigation Server：MCP tools/resources、命令处理器、guardrails、历史回放、事件导出、PROV 导出、auth/confirm 流。
- Investigation Console：Fastify BFF、React 工作台、revision-aware 资源读取、SSE 刷新、历史模式禁写、Reviewer confirm 流。
- 测试层：Vitest 覆盖 domain、schemas、persistence、server、console；Playwright 覆盖关键 UI 与 confirm 场景。

### 已验证

2026-04-07 在当前工作区上已通过：

- pnpm typecheck
- pnpm test
- pnpm test:e2e

这说明主代码路径、关键契约和 Console 端到端交互在当前实现上是闭环可运行的。

### 推断

- 当前仓库状态更接近“可演示、可验证的 MVP 原型”，而不是早期设计稿。
- 设计文档仍然重要，但代码已经成为判断实际系统边界的第一依据。

### 仍属计划或未见充分证据的部分

- 未看到显式 CI 配置目录，说明自动化校验很可能仍依赖本地执行流程。
- docs/plans 中还保留了完整实施计划，适合作为 roadmap，但不应再被当成当前实现状态的唯一来源。
- 根级 lint 脚本存在，但本轮未验证 lint 全链路，且未从包级脚本中看到统一 lint 任务的直接证据。

## 为什么架构是现在这个形状

这个仓库用“事件流 + 投影 + 历史回放”的结构，而不是直接把图或快照当真相源，核心目的有三点：

- 审计优先：任何结论都应能回到事件层解释。
- 协作优先：agent 和人类读取的是同一套资源，只是交互面不同。
- 治理优先：所有写入都必须走 MCP 领域命令，才能统一执行 schema 校验、revision 校验、授权和 confirm。

## 顶层架构快照

### 运行面

- Investigation Server：唯一业务写入入口，同时提供资源读取、历史回放、guardrail 和导出。
- Investigation Console：BFF + React 前端，负责让 Reviewer 浏览案件、观察变化、执行受控操作。

### 共享能力面

- packages/domain：ID、生命周期状态机、revision envelope、统一 command result。
- packages/mcp-contracts：tool 名称、resource URI、错误码。
- packages/persistence：数据库 schema、repository、migration、checkpoint/outbox/dedup。
- packages/schemas：schema loader、validator 生成、registry 相关测试。

### 规范面

- schemas：领域对象、命令、事件、资源的 JSON Schema 真相源。
- spec：版本、profile、事件与 conformance 的文字约束。
- tests/conformance：最小 fixture 契约样例。

## 主流程

### 1. 写入流程

Console 或 agent 发起领域命令后：

1. MCP Server 根据 tool 名称选中 schema validator 与 handler。
2. 对 mutation 命令执行 actorContext、role、confirmToken、ifCaseRevision 等校验。
3. 命令处理器在同一数据库事务内执行 idempotency claim。
4. 成功后写 investigation_events，并更新当前态与 case list projection。
5. 返回统一 CommandResult；若是重复命令，则直接返回已存储结果。

### 2. 历史读取流程

1. 资源读取入口解析 atRevision。
2. 若读取 head，则直接从当前态表构造资源。
3. 若读取历史 revision，则从最近 checkpoint 恢复，再回放剩余事件。
4. 生成历史 envelope，并把回放结果保存回 checkpoint。

### 3. Console 审核流程

1. BFF 负责把本地 session token 转成 actorContext。
2. 前端读取 snapshot、timeline、graph、coverage、guardrails。
3. 用户切换 revision 时，所有视图同步回到历史状态。
4. 高风险动作先向 BFF 申请 confirm intent，再携带 confirmToken 调 mutation tool。

## 当前关键不变量

- 写入只能通过 MCP tools，不能绕过到数据库或任意图更新。
- 事件流是系统真相源，graph、snapshot、coverage、diff 都是投影。
- 历史资源必须 obey revision-aware envelope，负 revision 需要规范化。
- 命令幂等不是 metadata 装饰，而是主写路径的一部分。
- 导出的 profile 和 CloudEvents 必须严格匹配发布 schema，而不是宽松返回“额外字段”。
- Console 在历史模式下必须禁写。

## 当前风险和容易误判的地方

- README 里仍有“刚从设计转向实现”的表述，但代码已经明显更成熟，文档存在滞后风险。
- 没有看到显式 CI 目录，团队协作时容易把“本地通过”误当成“仓库自动守护已经存在”。
- 本地集成测试依赖宿主 PostgreSQL，可移植性和新环境 onboarding 成本仍然偏高。
- turbo 的 test 任务存在 outputs 警告，说明缓存/产物声明还可以继续收口。

## 建议阅读顺序

1. README
2. docs/DEV/technical-design.md
3. docs/plans/2026-04-05-coe-mvp-implementation.md
4. apps/investigation-server/src/mcp/server.ts
5. apps/investigation-server/src/modules/commands/shared.ts
6. packages/persistence/src/repositories/event-store.ts
7. apps/investigation-server/src/modules/projections/replay.ts
8. apps/investigation-console/server/index.ts
9. apps/investigation-console/src/routes/cases.$caseId.tsx