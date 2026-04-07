# Investigation Conformance 1.0

## Required Surface

实现至少必须支持：

- Profile resource
- Case List collection resource
- Snapshot / Timeline / Graph / Coverage / Diff resources
- Guardrail checks for `guardrail.check`、`stall_check`、`ready_to_patch_check`、`close_case_check`

## Required Fixtures

- `tests/conformance/minimal-case.json`
- `tests/conformance/history-replay.json`
- `tests/conformance/ready-to-patch-blocked.json`
- `tests/conformance/close-case-gated.json`

## Validation Gates

- 所有 schema 必须能被 registry 加载
- 关键反例必须被 schema 校验拒绝
- resource schemas 必须包含 revision-aware envelope 字段
