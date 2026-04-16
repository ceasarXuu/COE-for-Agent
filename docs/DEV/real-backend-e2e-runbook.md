# Real Backend E2E Runbook

## 背景

`apps/investigation-console/server/e2e-real.ts` 会通过真实后端命令流创建一条完整案件，用于 `apps/investigation-console/e2e/real-backend.spec.ts` 的端到端验证。

如果这条脚本直接复用仓库默认的 `COE_DATA_DIR=./.var/data`，测试种子案件会落进日常本地数据，随后在 `/cases` 列表里表现成一张普通案件卡片，例如：

- 标题：`Real backend case <timestamp>`
- Objective：`Validate real backend console flow <timestamp>`
- Stage：`discriminative_testing`

## 当前约束

- real-backend E2E 默认使用隔离运行目录：`./.tmp/investigation-console-real-e2e-*`
- 该目录下单独创建：
  - `data/`
  - `artifacts/`
- 运行结束后，若未显式指定 `REAL_E2E_RUNTIME_ROOT`，脚本会自动清理该隔离目录

## 排查方式

如果案件列表里再次出现类似 `Validate real backend console flow 1776282676320` 的卡片，优先检查两点：

1. 是否运行过旧版本的 `server/e2e-real.ts`，当时把种子写进了默认 `.var/data`
2. 启动日志中是否出现以下结构化事件：

```text
[investigation-console] real-backend-e2e-runtime
[investigation-console] real-backend-e2e-seeded
```

其中 `real_backend_e2e.runtime_prepared` 会打印实际使用的 `runtimeRoot`、`dataDir`、`artifactRoot`；`real_backend_e2e.case_seeded` 会打印 `caseId` 与 `searchTerm`，可直接用于反查污染来源。

## 清理原则

- 不要直接在默认 `.var/data` 上做不可恢复删除
- 如果历史上已经把 E2E 种子写入默认数据目录，先备份再清理
- 优先修复测试隔离，再处理存量脏数据，避免删完后再次被旧脚本写回
