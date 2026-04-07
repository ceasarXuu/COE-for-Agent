# COE for Agent 核心逻辑说明

## 核心文件表

| 文件 | 角色 | 主要输入 | 主要输出 | 改错会影响什么 |
| --- | --- | --- | --- | --- |
| apps/investigation-server/src/mcp/server.ts | MCP 运行时总入口 | tool 名称、resource URI、schema 校验结果、services | 命令执行结果、资源读取结果、telemetry 事件 | 整个 server surface、授权链路、tool/resource 映射都会失真 |
| apps/investigation-server/src/modules/commands/shared.ts | mutation 共享写入规则 | actorContext、idempotencyKey、caseId、事务执行器 | 去重后的 CommandResult、case list projection 同步 | 幂等、事务一致性、列表统计都会漂移 |
| packages/persistence/src/repositories/event-store.ts | 事件流真相源写入层 | caseId、expectedRevision、event payload、metadata | eventId、next caseRevision | revision 冲突、历史回放、timeline 和导出全都会出错 |
| packages/persistence/src/repositories/dedup.ts | 命令幂等落盘层 | caseId、toolName、idempotencyKey、commandResult | claim/complete 结果 | duplicate 写入、重试恢复和重复命令返回值会失真 |
| apps/investigation-server/src/modules/projections/replay.ts | 历史读取与 checkpoint 回放 | caseId、requestedRevision、checkpoint、events | 某一 revision 的投影态 | snapshot/graph/panel/diff 的历史视图都会不可信 |
| apps/investigation-server/src/mcp/register-resources.ts | 资源 surface 注册表 | config、services、URI 模板 | profile、cases、snapshot、timeline、graph、coverage、panel、diff 的 reader | 协议 surface 漂移，前后端契约会断裂 |
| apps/investigation-console/server/routes/tools.ts | Console 写入口 | 浏览器请求、session token、confirm intent | 携带 actorContext 的 MCP tool 调用 | Console 的受控写操作、Reviewer 确认流程会被绕开 |
| apps/investigation-console/src/routes/cases.$caseId.tsx | 单案件工作台主控页面 | revision、selected node、多个 API 响应、SSE 事件 | snapshot/timeline/graph/coverage/guardrail/inspector 联动界面 | UI 无法保持同 revision 同步，历史禁写容易失效 |

## 端到端流程一：领域写入如何落盘

### 入口

- MCP host 或 Console BFF 调用某个 mutation tool。
- apps/investigation-server/src/mcp/server.ts 负责：
  - 找到 input schema validator
  - 校验 payload
  - 对 mutation 执行 authorizeMutationCommand
  - 把调用转发到具体 handler

### 命令执行

- 各命令 handler 在数据库事务里调用 executeIdempotentMutation。
- executeIdempotentMutation 的流程是：
  1. 用 CommandDedupRepository.claim 占位。
  2. 如果发现 duplicate，直接返回已存储 commandResult。
  3. 如果首次执行，继续调用真正的 operation。
  4. operation 成功后，用 complete 回填 eventId 与完整 commandResult。

### 落盘

- EventStoreRepository.appendEventInExecutor 会：
  - 锁当前 case revision
  - 校验 expectedRevision
  - 追加 investigation_events 行
  - 推进 cases.revision

### 同步投影

- 命令 handler 通常还会同步：
  - current state 节点表
  - case_list_projection

### 结果

- 返回统一 CommandResult。
- 如果是 mutation 且含 eventId/headRevisionAfter，server.ts 还会发出 telemetry 和 head revision changed 事件。

## 端到端流程二：历史资源如何回放

### 入口

- 资源 URI 进入 register-resources.ts 注册的 reader。
- atRevision 先被规范化，负数会被 clamp 到 0。

### head 读取

- 如果 requestedRevision 为空或不小于 headRevision，直接从当前态表构造资源。

### 历史读取

- loadProjectedCaseState 会：
  1. 计算 targetRevision。
  2. 从 case_projection_checkpoints 加载最近 checkpoint。
  3. 从该 checkpoint 的 projectionRevision 开始读取剩余事件。
  4. 逐条 applyStoredEvent 重建节点、case state 和状态转移。
  5. 把重建结果重新保存为 checkpoint。

### 结果

- snapshot、graph、timeline、panel、coverage、diff 都能在统一 revision envelope 下返回历史状态。

## 端到端流程三：Console 中的人类审核和受控写入

### BFF 层

- apps/investigation-console/server/index.ts 启动 Fastify BFF。
- routes/tools.ts 提供：
  - /api/session
  - /api/confirm-intent
  - /api/tools/:toolName

### 会话与确认

- BFF 默认创建本地 Reviewer session。
- 高风险动作先走 confirm intent，再把 confirmToken 放回实际命令 payload。

### 前端工作台

- cases.$caseId.tsx 是工作台编排中心：
  - 并行加载 snapshot、timeline、graph、coverage、guardrails
  - 通过 selected node 加载 hypothesis/inquiry inspector
  - 监听 SSE，在 head mode 下自动刷新
  - 切换 revision 时让所有视图同步切换
  - 历史模式下禁用写操作

## 关键不变量和耦合点

### 不变量

- tool 名称必须和 packages/mcp-contracts 完全一致。
- resource 返回 shape 必须和 schemas/resources 对齐，不能偷偷加字段。
- event export 必须用 .data.schema.json，且 data 是扁平事件数据。
- duplicate mutation 必须返回首次执行的完整 commandResult，而不是重新计算一个近似值。
- 历史资源必须尊重 requestedRevision、projectionRevision、headRevision 三者关系。

### 耦合点

- schemas 与 server handlers：schema 变更后，如果 tool/resource 实现不跟着改，会出现契约漂移。
- domain 状态机与命令处理器：状态迁移一旦分叉，guardrail 和 UI 就会看到不一致状态。
- persistence repository 与 replay：事件 payload 形状一旦随意变化，历史回放最先坏掉。
- console BFF 与 server auth：session/confirm 格式一旦漂移，Reviewer 写操作会直接失败。

## 当前已知尖锐边缘

- 文档成熟度描述落后于代码，容易让新协作者低估已实现范围。
- CI 不可见，意味着“全绿”目前主要依赖人工运行根脚本确认。
- 本地 PostgreSQL 是事实前提，不具备数据库时很多 server/persistence 测试无法成立。
- turbo 对 test 任务的 outputs 声明仍有警告，缓存和产物模型还可继续整理。

## 新协作者最应该先看懂的控制流

1. tool 调用如何在 server.ts 被校验并路由。
2. executeIdempotentMutation 如何把重复命令收口到事务内。
3. EventStoreRepository 如何推进 revision 并保持事件流为真相源。
4. replay.ts 如何从 checkpoint 重建历史投影。
5. Console 工作台如何让 snapshot、graph、timeline、inspector 共享同一个 revision。