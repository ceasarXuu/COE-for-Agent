# 代码管理

- 禁止未经允许新开分支；如有必要，先向用户申请确认。
- 最小化提交原则：每次有小主题改动就积极 commit 并 push 到远端，增强安全性，无需用户确认。
- repo 中所有改动都要提交，不要留下未提交改动。
- 禁止使用任何不可恢复的删除操作；只允许放入回收站、移入备份目录，或使用其他可恢复方式。
- 原则上任何单代码文件不得超过 500 行，除非确认确有必要并获得用户确认。

# 工作模式

- 除非有问题需要用户参与决策，否则不要无意义地中途停止。
- 长期主义、架构优先，禁止短期止血式修复方案。
- 鼓励使用 Subagents 提升效率，但禁止使用 mini 型号模型；使用前必须理清依赖关系，避免并行冲突。
- 日志驱动原则：新增功能、bug 修复之后，都要同步建设必要日志，为发现问题、预防问题做好基础设施。
- bug 修复后必须先自行检查，确认 bug 无法复现后才能认为已解决；测试用例必须达到幂等或接近幂等，保证测试效用。
- 反思内容要落地：启动、登录、环境配置、拿日志、打包、上传等琐碎但容易出问题的操作，如果产生了可复用经验，要记录到 repo 文档中，后续复用而不是每次重新摸索。

# 测试与验证

- 每次非平凡代码变更后，默认执行完整本地门禁：

  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm test:e2e
  ```

- 实现过程中可以先跑影响面对应的 targeted regression lane，但最终交付前必须回到完整本地门禁。
- 文档-only 变更至少执行 `pnpm typecheck`；如果文档改变命令、运行时行为、公共契约、测试预期或 runbook，必须执行完整本地门禁。
- bug 修复必须先复现或明确原始症状，再增加或复用回归验证；不能只凭代码推理宣布修复。
- Console UI、Graph、Timeline、Node Editor、Session、ConfirmToken、E2E 启动链路相关变更，必须覆盖 `@coe/investigation-console-v2` 的 package 测试，并在最终 gate 中跑 `pnpm test:e2e`。
- MCP tools、resources、prompts、agent docs、command files 相关变更，必须跑 `apps/investigation-server/test/mcp/agent-surface-alignment.test.ts` 或更完整的 server test lane。
- 资源 schema、generated validators、resource output 相关变更，必须同时验证 `@coe/schemas` 和 server resource tests。
- E2E 测试必须使用隔离 runtime root，禁止把测试种子写入默认 `.var/data`。
- 具体分层策略以 `docs/DEV/smoke-regression-test-strategy.md` 为准；如果实际流程变化，要同步更新该文档。

# 前端开发

- 遵循 Storybook 开发最佳工作流，管理和约束前端模块设计。
