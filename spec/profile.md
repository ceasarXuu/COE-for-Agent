# Investigation Profile 1.0

## Summary

Investigation Profile 运行在 MCP 之上，用来约束 agent 以“调查案件”的方式处理复杂问题。

MVP 必须满足以下原则：

- 所有写操作只走 MCP tools
- 所有读状态只走 MCP resources
- 事件流是唯一真相源
- `Artifact`、`Fact`、`Hypothesis`、`Experiment`、`Decision` 必须严格分层
- `Gap` 与 `Residual` 是一等对象，不允许退化为自由文本备注

## Required Capabilities

- 17 个变更型 tools
- 4 个 guardrail tools
- 9 个 resource families
- revision-aware resource envelope
- Case List collection resource

## Required Rules

- `Fact` 必须引用至少一个 `Artifact`
- negative `Fact` 必须带 `observationScope`
- `Hypothesis` 必须带 `falsificationCriteria`
- `Experiment` 必须带 `expectedOutcomes`
- `Decision` 必须引用 supporting facts 或 experiments
- 除 `investigation.case.open` 外，所有现有 case 写命令都必须带 `ifCaseRevision`
