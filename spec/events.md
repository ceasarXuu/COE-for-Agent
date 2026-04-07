# Investigation Events 1.0

MVP 内部事件存储使用 canonical event row；CloudEvents 只用于 export 和 outbox envelope。

## Required Event Types

- `case.opened`
- `case.stage_advanced`
- `inquiry.closed`
- `symptom.reported`
- `artifact.attached`
- `fact.asserted`
- `hypothesis.proposed`
- `hypothesis.status_updated`
- `experiment.planned`
- `experiment.result_recorded`
- `gap.opened`
- `gap.resolved`
- `residual.opened`
- `residual.updated`
- `decision.recorded`

## CloudEvents Boundary

- `specversion = 1.0`
- `dataschema` 承载事件 schema 版本
- `subject` 固定携带 case-scoped subject
