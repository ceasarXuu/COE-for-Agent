# Console Session Runbook

## 症状

在 investigation console 长时间运行后，写操作可能返回：

```json
{"statusCode":500,"error":"Internal Server Error","message":"sessionToken expired"}
```

常见入口：

- 新建案件
- 请求高风险确认 token
- 执行 mutation 工具

## 根因

这个问题有两个叠加点：

1. BFF 启动时只生成一次默认 reviewer session，`/api/session` 长时间后会把同一枚旧 token 继续返回
2. 前端曾经把 `/api/session` 的结果永久缓存，超过 TTL 后仍继续复用旧 token

## 修复原则

- `/api/session` 必须按请求动态签发新 session，不能返回启动时固化的 token
- 前端可以缓存 session，但只能缓存到 `expiresAt`
- 不能把“每次写都强制换新 session”当成修复，因为 `confirmToken` 会校验 `sessionId`

## confirm 流约束

高风险命令的 `confirmToken` 绑定以下信息：

- `commandName`
- `caseId`
- `targetIds`
- `sessionId`
- `role`
- `reasonHash`

因此前端需要做到：

- session 未过期：继续复用同一个 session
- session 即将过期或已经过期：在下一次写操作前续租

否则会把 `sessionToken expired` 变成 `confirmToken session mismatch`。

## 当前实现约束

- 服务端 `GET /api/session` 每次都会签发新的 reviewer session
- 服务端在没有显式 `x-session-token` 时，也会动态生成 fallback session
- 前端在 session 剩余有效期不足 60 秒时主动续租
- 前端刷新 session 时会输出结构化日志：
  - `[investigation-console] session-refreshed`
- 服务端签发 session 时会输出结构化日志：
  - `[investigation-console] session-issued`

## 排查建议

如果再次出现会话过期问题，按这个顺序检查：

1. 看浏览器控制台是否出现 `session-refreshed`
2. 看 BFF 日志是否出现 `session-issued`
3. 检查失败请求携带的 token 是否已经超过 `expiresAt`
4. 如果失败发生在确认流，继续检查是否因为 session 被错误轮换导致 `sessionId` 变化
