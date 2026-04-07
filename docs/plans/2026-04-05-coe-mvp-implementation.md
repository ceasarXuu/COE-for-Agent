# COE for Agent MVP Implementation Plan

> **Status:** This is the final maintained implementation plan in `docs/plans`. It absorbs and replaces the earlier 2026-04-04 draft.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在主技术方案约束下完成 COE for Agent MVP，交付 MCP-native Investigation Server、Investigation Console、事件流与历史回放、Case List collection resource、角色门禁、confirmToken、高风险审计链路、最小 Profile/Events/Conformance 规范和端到端验证能力。

**Architecture:** 采用 TypeScript monorepo。Server 是唯一业务读写入口，负责 MCP tools/resources、事件流、历史回放、投影、guardrail、权限与导出；Console 通过 BFF 连接 MCP，消费 collection resource 和 revision-aware resources，并负责受控的人类审计与干预。持久化统一使用 PostgreSQL，内部事件存储采用 canonical event row，CloudEvents 只用于 export/outbox envelope；Artifact 使用本地文件系统或对象存储。

**Tech Stack:** Node.js 22, TypeScript 5.x, pnpm workspaces, Fastify, MCP TypeScript SDK, PostgreSQL 16, Kysely, Ajv, React 19, Vite, TanStack Router, TanStack Query, Zustand, Cytoscape.js, Vitest, Playwright, Docker Compose, OpenTelemetry.

**Design Closure:** 执行本计划时，以 [docs/DEV/technical-design.md](/Volumes/XU-1TB-NPM/projects/COE-for-Agent/docs/DEV/technical-design.md) 为最终设计依据；若计划内容与主技术方案冲突，以主技术方案为准。

---

### Task 1: 初始化 Monorepo 与本地开发环境

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.npmrc`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Modify: `README.md`

**Step 1: 创建根工作区配置**

写入 `package.json`、`pnpm-workspace.yaml`、`turbo.json`，定义以下 workspace：

- `apps/investigation-server`
- `apps/investigation-console`
- `packages/domain`
- `packages/persistence`
- `packages/mcp-contracts`
- `packages/schemas`
- `packages/telemetry`
- `packages/shared-utils`

根脚本至少包括：

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:e2e": "pnpm --filter @coe/investigation-console test:e2e"
  }
}
```

**Step 2: 添加仓库规范文件**

创建 `tsconfig.base.json`、`.editorconfig`、`.gitignore`、`.npmrc`，统一：

- `strict: true`
- ESM
- NodeNext module resolution
- 忽略 `dist/`, `.turbo/`, `.env*`, `coverage/`

**Step 3: 配置本地依赖服务**

创建 `docker-compose.yml`，至少包含：

- `postgres`
- `otel-collector`

先不接入 MinIO，MVP 使用本地 artifact 目录。

**Step 4: 更新 README 启动说明**

补充以下最小流程：

- 安装 Node.js 22 与 pnpm
- `pnpm install`
- `docker compose up -d`
- `pnpm dev`

**Step 5: 验证工作区可用**

Run:

```bash
pnpm install
docker compose config
pnpm typecheck
```

Expected:

- `pnpm install` 成功
- `docker compose config` 正常输出配置
- `pnpm typecheck` 在空实现阶段可通过或只暴露缺失包脚本

**Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore .editorconfig .npmrc .env.example docker-compose.yml README.md
git commit -m "chore: bootstrap monorepo workspace"
```

### Task 2: 冻结 Profile、Versioning、Events、Schemas 与 Conformance

**Files:**
- Create: `spec/profile.md`
- Create: `spec/conformance.md`
- Create: `spec/events.md`
- Create: `spec/versioning.md`
- Create: `schemas/common/base-node.schema.json`
- Create: `schemas/common/actor-ref.schema.json`
- Create: `schemas/common/command-result.schema.json`
- Create: `schemas/domain/v1/case.schema.json`
- Create: `schemas/domain/v1/inquiry.schema.json`
- Create: `schemas/domain/v1/entity.schema.json`
- Create: `schemas/domain/v1/symptom.schema.json`
- Create: `schemas/domain/v1/artifact.schema.json`
- Create: `schemas/domain/v1/fact.schema.json`
- Create: `schemas/domain/v1/hypothesis.schema.json`
- Create: `schemas/domain/v1/experiment.schema.json`
- Create: `schemas/domain/v1/gap.schema.json`
- Create: `schemas/domain/v1/residual.schema.json`
- Create: `schemas/domain/v1/decision.schema.json`
- Create: `schemas/commands/v1/case.open.request.schema.json`
- Create: `schemas/commands/v1/case.advance_stage.request.schema.json`
- Create: `schemas/commands/v1/inquiry.open.request.schema.json`
- Create: `schemas/commands/v1/inquiry.close.request.schema.json`
- Create: `schemas/commands/v1/entity.register.request.schema.json`
- Create: `schemas/commands/v1/symptom.report.request.schema.json`
- Create: `schemas/commands/v1/artifact.attach.request.schema.json`
- Create: `schemas/commands/v1/fact.assert.request.schema.json`
- Create: `schemas/commands/v1/hypothesis.propose.request.schema.json`
- Create: `schemas/commands/v1/hypothesis.update_status.request.schema.json`
- Create: `schemas/commands/v1/experiment.plan.request.schema.json`
- Create: `schemas/commands/v1/experiment.record_result.request.schema.json`
- Create: `schemas/commands/v1/gap.open.request.schema.json`
- Create: `schemas/commands/v1/gap.resolve.request.schema.json`
- Create: `schemas/commands/v1/residual.open.request.schema.json`
- Create: `schemas/commands/v1/residual.update.request.schema.json`
- Create: `schemas/commands/v1/decision.record.request.schema.json`
- Create: `schemas/events/v1/case.opened.data.schema.json`
- Create: `schemas/events/v1/symptom.reported.data.schema.json`
- Create: `schemas/events/v1/artifact.attached.data.schema.json`
- Create: `schemas/events/v1/fact.asserted.data.schema.json`
- Create: `schemas/events/v1/hypothesis.proposed.data.schema.json`
- Create: `schemas/events/v1/hypothesis.status_updated.data.schema.json`
- Create: `schemas/events/v1/experiment.planned.data.schema.json`
- Create: `schemas/events/v1/experiment.result_recorded.data.schema.json`
- Create: `schemas/events/v1/gap.opened.data.schema.json`
- Create: `schemas/events/v1/gap.resolved.data.schema.json`
- Create: `schemas/events/v1/residual.opened.data.schema.json`
- Create: `schemas/events/v1/residual.updated.data.schema.json`
- Create: `schemas/events/v1/decision.recorded.data.schema.json`
- Create: `schemas/events/v1/inquiry.closed.data.schema.json`
- Create: `schemas/events/v1/case.stage_advanced.data.schema.json`
- Create: `schemas/resources/v1/cases.collection.schema.json`
- Create: `schemas/resources/v1/case.snapshot.schema.json`
- Create: `schemas/resources/v1/case.timeline.schema.json`
- Create: `schemas/resources/v1/case.graph.schema.json`
- Create: `schemas/resources/v1/case.coverage.schema.json`
- Create: `schemas/resources/v1/case.diff.schema.json`
- Create: `schemas/resources/v1/hypothesis.panel.schema.json`
- Create: `schemas/resources/v1/inquiry.panel.schema.json`
- Create: `tests/conformance/minimal-case.json`
- Create: `tests/conformance/history-replay.json`
- Create: `tests/conformance/ready-to-patch-blocked.json`
- Create: `tests/conformance/close-case-gated.json`
- Create: `packages/schemas/package.json`
- Create: `packages/schemas/tsconfig.json`
- Create: `packages/schemas/scripts/generate-artifacts.ts`
- Create: `packages/schemas/src/index.ts`
- Create: `packages/schemas/src/load-schema.ts`
- Create: `packages/schemas/src/generated/index.ts`
- Create: `packages/schemas/src/generated/types.ts`
- Create: `packages/schemas/src/generated/validators.ts`
- Create: `packages/schemas/test/schema-registry.test.ts`
- Create: `packages/mcp-contracts/package.json`
- Create: `packages/mcp-contracts/src/tool-names.ts`
- Create: `packages/mcp-contracts/src/resource-uris.ts`
- Create: `packages/mcp-contracts/src/error-codes.ts`

**Step 1: 先写失败测试与 conformance fixture**

覆盖：

- `Fact` 缺少 `sourceArtifactIds` 被拒绝
- negative `Fact` 缺少 `observationScope` 被拒绝
- `Hypothesis` 缺少 `falsificationCriteria` 被拒绝
- `Decision` 缺少 supporting facts/experiments 被拒绝
- `cases.collection`、`case.diff`、history replay fixture 能被 registry 识别

**Step 2: 落地 spec 文档**

补齐 `spec/profile.md`、`spec/conformance.md`、`spec/events.md`、`spec/versioning.md`，冻结：

- `profileVersion = 1.0.0`
- `mcpSurfaceVersion = 1.0.0`
- event schema version 通过 `dataschema` 承载
- CloudEvents 只用于 export/outbox envelope，不作为数据库主存储 schema
- MVP conformance fixture 列表

**Step 3: 完整拆分 schema 目录**

从 [docs/PRD/coe-for-agent-prd.md](/Volumes/XU-1TB-NPM/projects/COE-for-Agent/docs/PRD/coe-for-agent-prd.md) 与 [docs/DEV/technical-design.md](/Volumes/XU-1TB-NPM/projects/COE-for-Agent/docs/DEV/technical-design.md) 拆出 domain、commands、events、resources 四层 schema。

**Step 4: 固化 MCP contracts**

在 `packages/mcp-contracts` 中定义：

- 17 个变更型 tool name
- 4 个 guardrail tool name
- 9 个 resource family URI 模板
- `CASE_REVISION_CONFLICT`、`REVIEWER_CONFIRMATION_REQUIRED` 等错误码

**Step 5: 实现 schema 生成、loader 与 registry**

生成 TypeScript types 与编译后的 Ajv validators，加载所有 schema，注册 `$id`，供 Ajv、server、`packages/domain` 和 `packages/mcp-contracts` 直接复用。

**Step 6: 运行 schema 与 conformance 测试**

Run:

```bash
pnpm --filter @coe/schemas test
```

Expected:

- registry 能加载全部 schema
- conformance fixture 通过基础验证
- 关键反例被拒绝

**Step 7: Commit**

```bash
git add spec schemas tests/conformance packages/schemas packages/mcp-contracts
git commit -m "feat: freeze profile events schemas and conformance fixtures"
```

### Task 3: 构建领域层、状态机与 revision-aware 契约类型

**Files:**
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/index.ts`
- Create: `packages/domain/src/ids.ts`
- Create: `packages/domain/src/actor-context.ts`
- Create: `packages/domain/src/revision.ts`
- Create: `packages/domain/src/resource-envelope.ts`
- Create: `packages/domain/src/state-machines/case.ts`
- Create: `packages/domain/src/state-machines/inquiry.ts`
- Create: `packages/domain/src/state-machines/hypothesis.ts`
- Create: `packages/domain/src/state-machines/experiment.ts`
- Create: `packages/domain/src/state-machines/gap.ts`
- Create: `packages/domain/src/state-machines/residual.ts`
- Create: `packages/domain/src/commands/command-result.ts`
- Create: `packages/domain/test/ids.test.ts`
- Create: `packages/domain/test/state-machines.test.ts`
- Create: `packages/domain/test/revision-envelope.test.ts`

**Step 1: 先写领域测试**

覆盖：

- ID 前缀与类型守卫正确
- 非法状态迁移被拒绝
- `inquiry.close` 与 `case.advance_stage(closed)` 迁移合法性正确
- 资源 envelope 强制包含 `headRevision`、`projectionRevision`、`requestedRevision`、`stale`、`historical`

**Step 2: 实现 ID、actorContext 与 revision 类型**

提供：

- `createCaseId()`
- `createFactId()`
- `isCaseId()`
- `ActorContext`
- `RevisionConflict`
- `ResourceEnvelope<T>`

**Step 3: 实现状态机**

固化 Case、Inquiry、Hypothesis、Experiment、Gap、Residual 的迁移函数。

**Step 4: 定义统一 command result**

统一结果中加入：

- `headRevisionBefore`
- `headRevisionAfter`
- `projectionScheduled`

**Step 5: 运行领域层测试**

Run:

```bash
pnpm --filter @coe/domain test
pnpm --filter @coe/domain typecheck
```

Expected:

- 领域包能被 Server 与 Console 共用
- revision-aware 类型与状态机测试通过

**Step 6: Commit**

```bash
git add packages/domain
git commit -m "feat: add domain revision and lifecycle contracts"
```

### Task 4: 实现存储层、case list 投影与历史回放基础设施

**Files:**
- Create: `apps/investigation-server/package.json`
- Create: `apps/investigation-server/tsconfig.json`
- Create: `packages/persistence/package.json`
- Create: `packages/persistence/tsconfig.json`
- Create: `packages/persistence/src/index.ts`
- Create: `packages/persistence/src/client.ts`
- Create: `packages/persistence/src/schema.ts`
- Create: `packages/persistence/src/migrate.ts`
- Create: `packages/persistence/src/repositories/event-store.ts`
- Create: `packages/persistence/src/repositories/dedup.ts`
- Create: `packages/persistence/src/repositories/current-state.ts`
- Create: `packages/persistence/src/repositories/case-list-projection.ts`
- Create: `packages/persistence/src/repositories/checkpoints.ts`
- Create: `packages/persistence/src/repositories/outbox.ts`
- Create: `packages/persistence/migrations/0001_init.sql`
- Create: `packages/persistence/test/event-store.test.ts`
- Create: `packages/persistence/test/dedup.test.ts`
- Create: `packages/persistence/test/revision-conflict.test.ts`
- Create: `packages/persistence/test/checkpoint-replay.test.ts`
- Create: `packages/persistence/test/outbox.test.ts`

**Step 1: 先写数据库集成测试**

覆盖：

- append event 成功写入并返回 `case_revision + 1`
- 相同 `idempotencyKey` 命中去重记录
- `ifCaseRevision` 不匹配时返回冲突
- checkpoint 可被加载并重放到目标 revision
- outbox 任务可被幂等领取并在重试后恢复

**Step 2: 设计首版数据库表**

在 `0001_init.sql` 中创建：

- `investigation_events`
- `command_dedup`
- `cases`
- `inquiries`
- `entities`
- `symptoms`
- `artifacts`
- `facts`
- `hypotheses`
- `experiments`
- `gaps`
- `residuals`
- `decisions`
- `case_edges`
- `case_snapshot_cache`
- `coverage_cache`
- `guardrail_cache`
- `case_list_projection`
- `case_projection_checkpoints`
- `projection_outbox`

**Step 3: 使用 Kysely 实现 event store 与 current-state repository**

保证：

- append-only
- 事务包裹 revision bump
- 事件 payload 使用 JSONB
- 数据库中的事件记录保持 canonical row，而不是直接存 CloudEvents 文档

**Step 4: 实现幂等、列表投影、checkpoint 与 outbox repository**

`command_dedup` 使用 `(case_id, tool_name, idempotency_key)` 唯一键；`case_list_projection` 提供 Case List 查询；`case_projection_checkpoints` 支撑历史回放；`projection_outbox` 为 graph、coverage、diff 和通知链路提供 durable backlog，`LISTEN/NOTIFY` 只做唤醒。

**Step 5: 运行数据库测试**

Run:

```bash
docker compose up -d postgres
pnpm --filter @coe/persistence test -- event-store
pnpm --filter @coe/persistence test -- revision-conflict
pnpm --filter @coe/persistence test -- checkpoint-replay
pnpm --filter @coe/persistence test -- outbox
```

Expected:

- 事件流、并发冲突、checkpoint 回放、outbox 恢复行为正确

**Step 6: Commit**

```bash
git add packages/persistence apps/investigation-server
git commit -m "feat: add persistence package case list projection and replay foundation"
```

### Task 5: 搭起 MCP Server 骨架、collection resource 与历史资源 surface

**Files:**
- Create: `apps/investigation-server/src/index.ts`
- Create: `apps/investigation-server/src/app.ts`
- Create: `apps/investigation-server/src/config.ts`
- Create: `apps/investigation-server/src/mcp/server.ts`
- Create: `apps/investigation-server/src/mcp/register-tools.ts`
- Create: `apps/investigation-server/src/mcp/register-resources.ts`
- Create: `apps/investigation-server/src/http/control-plane.ts`
- Create: `apps/investigation-server/test/mcp/profile.resource.test.ts`
- Create: `apps/investigation-server/test/mcp/cases.resource.test.ts`
- Create: `apps/investigation-server/test/mcp/history-stub.resource.test.ts`
- Create: `apps/investigation-server/test/http/healthz.test.ts`

**Step 1: 先写握手与资源 surface 测试**

覆盖：

- MCP server 初始化成功
- `investigation://profile` 可读取
- `investigation://cases` 可读取
- `snapshot?atRevision=`、`graph?atRevision=`、`diff?fromRevision=` surface 可注册
- `/healthz`、`/readyz` 返回 200

**Step 2: 实现 app 入口和配置加载**

读取：

- `DATABASE_URL`
- `ARTIFACT_ROOT`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `MCP_TRANSPORT`
- `LOCAL_ISSUER_SECRET`

**Step 3: 注册固定资源与空工具实现**

先注册：

- `investigation://profile`
- `investigation://cases`
- `investigation://cases/{caseId}/snapshot`
- `investigation://cases/{caseId}/timeline`
- `investigation://cases/{caseId}/graph`
- `investigation://cases/{caseId}/diff`

工具先注册名称和 inputSchema，不实现业务。

**Step 4: 添加 control plane**

实现：

- `GET /healthz`
- `GET /readyz`
- `GET /version`

**Step 5: 运行 MCP 与 HTTP 验证**

Run:

```bash
pnpm --filter @coe/investigation-server test
pnpm --filter @coe/investigation-server dev
```

Expected:

- MCP 初始化无报错
- profile、cases collection、history resource stub 可读
- healthz/readyz 可访问

**Step 6: Commit**

```bash
git add apps/investigation-server
git commit -m "feat: scaffold mcp server collection resources and history surface"
```

### Task 6: 实现 evidence write path、同步审计资源与 lifecycle 起点

**Files:**
- Create: `apps/investigation-server/src/modules/commands/case-open.ts`
- Create: `apps/investigation-server/src/modules/commands/inquiry-open.ts`
- Create: `apps/investigation-server/src/modules/commands/inquiry-close.ts`
- Create: `apps/investigation-server/src/modules/commands/entity-register.ts`
- Create: `apps/investigation-server/src/modules/commands/symptom-report.ts`
- Create: `apps/investigation-server/src/modules/commands/artifact-attach.ts`
- Create: `apps/investigation-server/src/modules/commands/fact-assert.ts`
- Create: `apps/investigation-server/src/modules/resources/cases.ts`
- Create: `apps/investigation-server/src/modules/resources/snapshot.ts`
- Create: `apps/investigation-server/src/modules/resources/timeline.ts`
- Create: `apps/investigation-server/src/modules/resources/inquiry-panel.ts`
- Create: `apps/investigation-server/test/commands/fact-assert.test.ts`
- Create: `apps/investigation-server/test/commands/inquiry-close.test.ts`
- Create: `apps/investigation-server/test/resources/cases.test.ts`
- Create: `apps/investigation-server/test/resources/snapshot.test.ts`

**Step 1: 先写失败测试**

覆盖：

- `fact.assert` 缺少 `sourceArtifactIds` 被拒绝
- negative `fact.assert` 缺少 `observationScope` 被拒绝
- 现有 case 命令缺少 `ifCaseRevision` 被拒绝
- `case.open` 自动生成默认 inquiry
- `inquiry.close` 更新生命周期并写入事件
- `cases` collection 返回排序与筛选结果

**Step 2: 实现前置命令处理器**

统一流程：

- schema 校验
- `ifCaseRevision` 校验
- event append
- 当前态 upsert
- case list projection 更新

**Step 3: 实现 artifact 存储索引**

`artifact.attach` 只处理 metadata 和 `content_ref`；真实大内容先写入本地 artifact root。

**Step 4: 实现同步审计资源**

优先实现：

- `investigation://cases`
- `snapshot`
- `timeline`
- `inquiries/{id}`

这些资源必须是同步可用，不依赖异步重投影。

**Step 5: 运行 evidence 与列表资源测试**

Run:

```bash
pnpm --filter @coe/investigation-server test -- fact-assert
pnpm --filter @coe/investigation-server test -- inquiry-close
pnpm --filter @coe/investigation-server test -- cases
pnpm --filter @coe/investigation-server test -- snapshot
```

Expected:

- evidence 链路打通
- collection resource、snapshot、timeline、inquiry panel 可用

**Step 6: Commit**

```bash
git add apps/investigation-server
git commit -m "feat: implement evidence commands collection resource and inquiry lifecycle"
```

### Task 7: 实现推理链、Decision、完整 Guardrails 与 close-case 生命周期

**Files:**
- Create: `apps/investigation-server/src/modules/commands/hypothesis-propose.ts`
- Create: `apps/investigation-server/src/modules/commands/hypothesis-update-status.ts`
- Create: `apps/investigation-server/src/modules/commands/experiment-plan.ts`
- Create: `apps/investigation-server/src/modules/commands/experiment-record-result.ts`
- Create: `apps/investigation-server/src/modules/commands/gap-open.ts`
- Create: `apps/investigation-server/src/modules/commands/gap-resolve.ts`
- Create: `apps/investigation-server/src/modules/commands/residual-open.ts`
- Create: `apps/investigation-server/src/modules/commands/residual-update.ts`
- Create: `apps/investigation-server/src/modules/commands/decision-record.ts`
- Create: `apps/investigation-server/src/modules/commands/case-advance-stage.ts`
- Create: `apps/investigation-server/src/modules/guardrails/check.ts`
- Create: `apps/investigation-server/src/modules/guardrails/stall-check.ts`
- Create: `apps/investigation-server/src/modules/guardrails/ready-to-patch.ts`
- Create: `apps/investigation-server/src/modules/guardrails/close-case.ts`
- Create: `apps/investigation-server/src/modules/resources/hypothesis-panel.ts`
- Create: `apps/investigation-server/test/commands/hypothesis-propose.test.ts`
- Create: `apps/investigation-server/test/commands/decision-record.test.ts`
- Create: `apps/investigation-server/test/guardrails/ready-to-patch.test.ts`
- Create: `apps/investigation-server/test/guardrails/close-case.test.ts`
- Create: `apps/investigation-server/test/guardrails/stall-check.test.ts`

**Step 1: 先写失败测试**

覆盖：

- `Hypothesis` 缺少 `falsificationCriteria` 被拒绝
- `Experiment` 缺少 `expectedOutcomes` 被拒绝
- `Decision` 缺少 citation 被拒绝
- open critical residual 时 `ready-to-patch` 失败
- 未满足条件时 `close_case_check` 失败

**Step 2: 实现推理链命令处理器**

重点保证：

- 状态迁移合法
- 引用存在
- `ifCaseRevision` 必填并生效

**Step 3: 实现完整 guardrail 输出**

输出：

- `warnings`
- `violations`
- `stallRisk`
- `readyToPatch.pass`
- `closeCase.pass`

**Step 4: 实现 hypothesis panel**

返回：

- supporting facts
- contradicting facts
- linked experiments
- open gaps
- open residuals

**Step 5: 运行推理链与生命周期测试**

Run:

```bash
pnpm --filter @coe/investigation-server test -- hypothesis-propose
pnpm --filter @coe/investigation-server test -- decision-record
pnpm --filter @coe/investigation-server test -- ready-to-patch
pnpm --filter @coe/investigation-server test -- close-case
```

Expected:

- 推理链、生命周期与 guardrail 闭环可用

**Step 6: Commit**

```bash
git add apps/investigation-server
git commit -m "feat: implement reasoning commands and full lifecycle guardrails"
```

### Task 8: 实现 actorContext、角色授权与 confirmToken 链路

**Files:**
- Create: `apps/investigation-server/src/auth/policy.ts`
- Create: `apps/investigation-server/src/auth/session-token.ts`
- Create: `apps/investigation-server/src/auth/confirm-token.ts`
- Create: `apps/investigation-server/src/auth/authorize-command.ts`
- Create: `apps/investigation-server/test/auth/policy.test.ts`
- Create: `apps/investigation-server/test/auth/confirm-token.test.ts`
- Create: `apps/investigation-console/server/auth/session.ts`
- Create: `apps/investigation-console/server/auth/confirm.ts`
- Create: `apps/investigation-console/test/server/confirm-route.test.ts`

**Step 1: 先写权限与确认测试**

覆盖：

- Viewer 不能执行任何变更型 tool
- Operator 不能执行 Reviewer-only 操作
- 纯 agent actor 不能执行 Reviewer-only 操作
- 高风险操作缺少 `confirmToken` 被拒绝
- `confirmToken` 过期后失效

**Step 2: 实现 session token 与 actorContext 贯通**

Server 统一解析 session token，补齐：

- `actorType`
- `actorId`
- `sessionId`
- `role`
- `issuer`
- `authMode`

**Step 3: 实现 confirmToken 签发与校验**

confirm token 绑定：

- `commandName`
- `caseId`
- `targetIds`
- `sessionId`
- `role`
- `reasonHash`
- `expiresAt`

**Step 4: 将授权链路接入命令执行入口**

在 tool handler 入口统一执行：

- 角色校验
- agent vs human 会话限制
- confirmToken 校验

**Step 5: 运行权限测试**

Run:

```bash
pnpm --filter @coe/investigation-server test -- auth
pnpm --filter @coe/investigation-console test -- confirm-route
```

Expected:

- 角色矩阵与确认票据行为符合收口文档

**Step 6: Commit**

```bash
git add apps/investigation-server apps/investigation-console
git commit -m "feat: add actor context auth policy and confirm token flow"
```

### Task 9: 实现 graph、coverage、diff、历史回放与导出观测

**Files:**
- Create: `apps/investigation-server/src/modules/projections/edges.ts`
- Create: `apps/investigation-server/src/modules/projections/graph-slice.ts`
- Create: `apps/investigation-server/src/modules/projections/coverage.ts`
- Create: `apps/investigation-server/src/modules/projections/diff.ts`
- Create: `apps/investigation-server/src/modules/projections/replay.ts`
- Create: `apps/investigation-server/src/modules/resources/graph.ts`
- Create: `apps/investigation-server/src/modules/resources/coverage.ts`
- Create: `apps/investigation-server/src/modules/resources/diff.ts`
- Create: `apps/investigation-server/src/modules/export/prov.ts`
- Create: `apps/investigation-server/src/modules/export/events.ts`
- Create: `apps/investigation-server/src/telemetry.ts`
- Create: `apps/investigation-server/test/resources/graph.test.ts`
- Create: `apps/investigation-server/test/resources/coverage.test.ts`
- Create: `apps/investigation-server/test/resources/diff.test.ts`
- Create: `apps/investigation-server/test/resources/history-replay.test.ts`
- Create: `apps/investigation-server/test/export/prov.test.ts`

**Step 1: 先写 projection 与历史回放测试**

覆盖：

- graph slice 只返回局部节点和边
- coverage 正确区分 `direct`, `indirect`, `none`
- `diff` 返回 `changedNodeIds` 与 `stateTransitions`
- `snapshot?atRevision=`、`graph?atRevision=` 能正确回放

**Step 2: 实现 case_edges 与 replay builder**

最小支持边：

- `evidences`
- `supports`
- `contradicts`
- `explains`
- `tests`
- `blocks`
- `unresolved_by`

**Step 3: 实现 coverage、diff 与历史 replay**

head 视图读当前态；历史视图从最近 checkpoint 重放到目标 revision。

**Step 4: 接入 OTel 与 SSE 事件类型**

埋点：

- tool call
- resource read
- guardrail evaluate
- projection rebuild

并输出两类前端流事件：

- `case.head_revision.changed`
- `case.projection.updated`

**Step 5: 运行资源与导出测试**

Run:

```bash
pnpm --filter @coe/investigation-server test -- graph
pnpm --filter @coe/investigation-server test -- coverage
pnpm --filter @coe/investigation-server test -- diff
pnpm --filter @coe/investigation-server test -- history-replay
pnpm --filter @coe/investigation-server test -- prov
```

Expected:

- graph、coverage、diff、history replay、export 全部可用

**Step 6: Commit**

```bash
git add apps/investigation-server packages/telemetry
git commit -m "feat: add replay diff graph coverage export and telemetry"
```

### Task 10: 搭建 Console BFF 与 revision-aware 前端壳层

**Files:**
- Create: `apps/investigation-console/package.json`
- Create: `apps/investigation-console/tsconfig.json`
- Create: `apps/investigation-console/vite.config.ts`
- Create: `apps/investigation-console/server/index.ts`
- Create: `apps/investigation-console/server/mcp-client.ts`
- Create: `apps/investigation-console/server/routes/cases.ts`
- Create: `apps/investigation-console/server/routes/resources.ts`
- Create: `apps/investigation-console/server/routes/tools.ts`
- Create: `apps/investigation-console/server/routes/stream.ts`
- Create: `apps/investigation-console/src/main.tsx`
- Create: `apps/investigation-console/src/app.tsx`
- Create: `apps/investigation-console/src/routes/__root.tsx`
- Create: `apps/investigation-console/src/routes/cases.index.tsx`
- Create: `apps/investigation-console/src/routes/cases.$caseId.tsx`
- Create: `apps/investigation-console/src/lib/api.ts`
- Create: `apps/investigation-console/src/lib/sse.ts`
- Create: `apps/investigation-console/src/store/ui-store.ts`
- Create: `apps/investigation-console/test/server/cases-route.test.ts`
- Create: `apps/investigation-console/test/server/history-route.test.ts`

**Step 1: 先写 BFF 路由测试**

覆盖：

- `GET /api/cases` 透传 `investigation://cases`
- `GET /api/cases/:caseId/snapshot?revision=` 透传历史读
- `GET /api/cases/:caseId/diff?from=&to=` 可用
- `POST /api/tools/...` 会携带 session/confirm 信息

**Step 2: 实现 BFF 的 MCP adapter**

封装：

- collection resource
- revision-aware resource query
- tool call with actorContext

**Step 3: 搭建 React 应用壳层**

完成：

- Vite 开发与构建配置
- Router
- QueryClient
- 全局 layout
- 左中右工作台占位布局
- revision URL 状态

**Step 4: 实现基础页面加载**

`/cases` 页面读 collection resource；`/cases/:caseId` 页面读 snapshot head；切换 revision 时统一刷新。

**Step 5: 运行 BFF 与基础页面测试**

Run:

```bash
pnpm --filter @coe/investigation-console test
pnpm --filter @coe/investigation-console dev
```

Expected:

- BFF 能连到本地 Investigation Server
- collection resource 与历史资源加载正常

**Step 6: Commit**

```bash
git add apps/investigation-console
git commit -m "feat: scaffold revision-aware console bff and app shell"
```

### Task 11: 完成 Console 核心页面、历史模式与受控写操作

**Files:**
- Create: `apps/investigation-console/src/components/case-list.tsx`
- Create: `apps/investigation-console/src/components/snapshot-view.tsx`
- Create: `apps/investigation-console/src/components/timeline-view.tsx`
- Create: `apps/investigation-console/src/components/graph-scene.tsx`
- Create: `apps/investigation-console/src/components/coverage-view.tsx`
- Create: `apps/investigation-console/src/components/guardrail-view.tsx`
- Create: `apps/investigation-console/src/components/revision-slider.tsx`
- Create: `apps/investigation-console/src/components/action-panel.tsx`
- Create: `apps/investigation-console/src/components/inspector/fact-inspector.tsx`
- Create: `apps/investigation-console/src/components/inspector/hypothesis-inspector.tsx`
- Create: `apps/investigation-console/src/components/inspector/experiment-inspector.tsx`
- Create: `apps/investigation-console/src/components/inspector/decision-inspector.tsx`
- Create: `apps/investigation-console/src/components/inspector/gap-inspector.tsx`
- Create: `apps/investigation-console/src/components/inspector/residual-inspector.tsx`
- Create: `apps/investigation-console/e2e/case-workspace.spec.ts`
- Create: `apps/investigation-console/e2e/history-mode.spec.ts`

**Step 1: 先写 Playwright 场景测试**

覆盖：

- 用户打开案件后能看到 Snapshot 关键风险
- 点击 hypothesis 能打开 inspector 并看见 supporting facts
- 切换 revision 后 Snapshot、Graph、Inspector 同步
- 历史模式下写操作被禁用
- Reviewer 执行高风险操作前必须确认

**Step 2: 实现 Case List、Snapshot、Timeline 与 Inspector**

优先打通审计主路径，保证：

- 3 次点击内可从 block reason 追到对象
- inspector 不显示裸 JSON

**Step 3: 实现 Graph Slice、Coverage 与 Diff 跳转**

图视图只支持：

- Inquiry Slice
- Hypothesis Neighborhood
- Decision Evidence Path

Coverage 页面显示 `direct`, `indirect`, `none`。

**Step 4: 实现 Guardrail、confirm flow 与禁写模式**

`action-panel.tsx` 支持：

- hypothesis.update_status
- gap.open / resolve
- residual.open / update
- decision.record
- case.advance_stage

规则：

- 历史模式禁写
- Reviewer 级别操作必须先换取 `confirmToken`
- 冲突返回后提示刷新到最新 revision

**Step 5: 跑端到端验证**

Run:

```bash
pnpm --filter @coe/investigation-console test:e2e
```

Expected:

- Case List、Snapshot、Timeline、Graph、Coverage、Guardrail、Inspector 全部可用
- 历史模式、confirm flow、revision conflict 都被覆盖

**Step 6: Commit**

```bash
git add apps/investigation-console
git commit -m "feat: implement console audit history and controlled actions"
```

### Task 12: 端到端集成、控制面与发布前检查

**Files:**
- Create: `apps/investigation-server/test/e2e/mcp-console-flow.test.ts`
- Create: `apps/investigation-server/test/e2e/close-case-flow.test.ts`
- Create: `apps/investigation-console/e2e/fixtures/minimal-case.json`
- Create: `apps/investigation-console/e2e/fixtures/history-replay.json`
- Create: `openapi/control-plane.v1.yaml`
- Modify: `README.md`
- Modify: `docs/DEV/technical-design.md`

**Step 1: 写全链路验收测试**

覆盖：

- Agent 通过 MCP 完成 Case -> Symptom -> Artifact -> Fact -> Hypothesis -> Experiment -> Decision
- Console 能在同一 Case 上看到 Case List、Snapshot、Timeline、Graph、Coverage、Guardrails
- `ready_to_patch_check` 和 `close_case_check` 阻塞时前端显示原因
- PROV 导出可下载

**Step 2: 补全 control plane OpenAPI**

定义：

- `GET /healthz`
- `GET /readyz`
- `GET /version`
- `GET /cases/{caseId}/export/prov`
- `GET /cases/{caseId}/export/events`
- `POST /admin/rebuild-projection`

**Step 3: 完成 README 与文档收尾**

更新：

- 本地启动命令
- 测试命令
- 目录说明
- MVP 功能边界
- authoritative plan 指向

**Step 4: 跑发布前检查**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Expected:

- 所有 workspace 通过 lint/typecheck/test
- e2e 覆盖 evidence、history、guardrail、confirm flow 与 close-case 生命周期

**Step 5: Commit**

```bash
git add .
git commit -m "feat: ship coe for agent mvp with replay and governance"
```

## 实施顺序建议

推荐严格按 1 -> 12 顺序推进，尤其不要跳过以下依赖：

- Task 2 先于任何 server handler
- Task 4 先于 history resource 与 diff resource
- Task 8 先于任何 Console 写操作
- Task 9 先于 revision-aware UI

## 验收门槛

只有以下条件都满足，才算 MVP 完成：

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` 全部通过
- Agent 能通过 MCP 完成完整 evidence -> hypothesis -> experiment -> decision 链路
- Console 能展示 Case List、Snapshot、Timeline、Graph Slice、Coverage、Guardrails、Inspector
- 历史回放支持 `atRevision` 与 `diff`
- 高风险写操作具备角色校验与 `confirmToken`
- `ready_to_patch_check` 与 `close_case_check` 全部可用
- 事件流、PROV-compatible 导出与最小 conformance fixture 可用

## 参考文档

- `docs/DEV/technical-design.md`
- `docs/PRD/coe-for-agent-prd.md`