# Investigation Versioning 1.0

## Frozen Versions

- `profileVersion = 1.0.0`
- `mcpSurfaceVersion = 1.0.0`

## Rules

- 领域 schema 文件独立使用 semver
- 事件 schema 版本通过 `dataschema` 暴露
- 新增可选字段属于 minor
- 删除字段、修改必填、修改枚举属于 major
