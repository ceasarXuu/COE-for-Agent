# COE for Agent 目录职责图

## 顶层目录

- apps
  - 业务应用层。当前只有 Investigation Server 和 Investigation Console 两个主应用。
- packages
  - 共享基础包。放跨应用复用的领域模型、持久化、契约和 schema 支撑。
- schemas
  - 发布契约真相源。所有 domain、commands、events、resources 的 JSON Schema 都在这里定义。
- spec
  - 对外或跨实现需要稳定对齐的文字规范，如 profile、events、versioning、conformance。
- tests
  - 顶层 conformance fixtures。偏契约样例，不是主业务代码测试目录。
- docs
  - PRD、技术设计、实施计划。适合理解设计动机和边界，但实现细节应回到代码验证。
- ops
  - 本地运维辅助配置，目前可见 OTel collector 配置。
- 根级配置文件
  - package.json、turbo.json、pnpm-workspace.yaml、tsconfig.base.json、docker-compose.yml 等。

## apps 下的职责边界

### apps/investigation-server

- 系统的唯一领域写入口。
- 注册 MCP tools 和 resources。
- 承担命令执行、授权、confirm、guardrail、projection、export、历史回放。
- 如果这里的写路径被绕开，系统的 revision、审计、幂等和 schema 边界都会失真。

重要子目录：

- src/mcp
  - MCP surface 入口，负责工具和资源注册。
- src/modules/commands
  - 领域命令实现，直接决定事件流与当前态如何被写入。
- src/modules/resources
  - 资源读取层，提供 snapshot、timeline、graph、coverage、diff、panel 等只读视图。
- src/modules/projections
  - 图、coverage、diff、历史回放等投影逻辑。
- src/modules/guardrails
  - 调查治理规则，如 stall、ready_to_patch、close_case。
- src/auth
  - actorContext、role policy、confirmToken 等授权边界。
- test
  - server 级行为测试，覆盖命令、资源、guardrail、auth、export。

### apps/investigation-console

- 提供 Reviewer 工作台，不直接触数据库或 server internals。
- 通过 BFF 转发资源读取与工具调用，并补齐 session/confirm 信息。
- 前端负责 revision-aware UI、图切片、inspector、历史禁写和 confirm 交互。

重要子目录：

- server
  - Fastify BFF，负责本地 MCP client、session、confirm、路由透传。
- src/routes
  - React 路由页面，cases 列表和单案件工作台都在这里挂载。
- src/components
  - snapshot、timeline、graph、coverage、guardrail、action panel、inspector 等页面组件。
- src/lib
  - 前端 API、SSE 和数据类型桥接。
- e2e
  - Playwright 场景与 fixture-backed MCP client。
- test
  - BFF 和 fixture 契约测试。

## packages 下的职责边界

### packages/domain

- 领域级共享类型与不变量。
- 放 ID 生成、状态机、revision conflict、resource envelope、统一 CommandResult。
- 新领域对象一旦缺少这里的契约，server 与 console 的行为容易各自漂移。

### packages/mcp-contracts

- 固定 tool 名称、resource URI 模板、错误码。
- 作用是避免应用层重复硬编码协议字符串。

### packages/persistence

- 数据库 schema、migration 与 repository 真相源。
- 封装 event store、command dedup、current state、case list projection、checkpoint、outbox。
- 所有持久化边界变更都应该先从这里开始，而不是在 server 里直写 SQL。

### packages/schemas

- 加载 schemas 目录、生成 validator 相关产物、运行 schema registry 测试。
- 是 schema 文件与运行时代码之间的桥。

## 哪些目录是“真相源”，哪些是派生产物

### 真相源

- schemas
- spec
- apps/investigation-server/src
- apps/investigation-console/src
- apps/investigation-console/server
- packages/domain/src
- packages/persistence/src
- packages/persistence/migrations

### 派生产物或缓存相关

- packages/schemas/src/generated
- dist
- coverage
- .turbo
- 数据库中的 case_projection_checkpoints、projection_outbox 等运行时派生状态

## 维护时应该把新工作放在哪里

### 新增一个领域命令

优先修改：

1. schemas/commands
2. packages/mcp-contracts
3. apps/investigation-server/src/modules/commands
4. packages/persistence（如需要新表或新 repository 能力）
5. server tests
6. console action panel 或 BFF（若需要人类触发）

### 新增一个只读资源

优先修改：

1. schemas/resources
2. apps/investigation-server/src/modules/resources
3. apps/investigation-server/src/mcp/register-resources.ts
4. console BFF route 和 src/lib/api.ts
5. 前端消费组件和测试

### 新增一个领域对象

优先修改：

1. schemas/domain
2. packages/domain
3. packages/persistence/schema.ts 与 migration
4. server commands/resources/projections
5. Console 视图和 inspector

## 当前维护建议

- 先把 schemas、domain、persistence 看清，再进入 server 命令层。
- 不要把 docs 当实现真相源，尤其在 README 和实施计划与当前代码冲突时，应以代码和测试为准。
- 任何看起来像“只是前端字段调整”的改动，都要检查对应 resource schema 和 server register-resources 是否同步。