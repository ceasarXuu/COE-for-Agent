# start.sh Runbook

## 当前行为

`./start.sh` 只负责：

- 检查依赖命令
- 在没有健康 dev 栈的情况下后台启动 `pnpm dev:console`
- 等待 Console web 就绪
- 自动打开浏览器

它会优先复用已经健康运行、且能实际响应 `COE_WEB_URL` 的开发栈。

## 关键细节

如果 `.run/dev.pid` 指向的进程仍然存活，并且 `COE_WEB_URL` 可以成功响应，`start.sh` 会直接复用该进程：

- 不会重新拉起 Vite
- 不会重新拉起 Console BFF
- 不会清理旧的本地数据目录

如果 `.run/dev.pid` 指向的进程仍然活着，但目标 URL 不通，`start.sh` 会把它判成 stale stack，停止该 PID 树并重新启动。

所以当你修改了代码但页面仍像旧版时，先确认是不是还在复用旧进程，而不是默认把问题归到缓存或浏览器。

## 这次踩坑的结论

这次页面打不开的根因不是浏览器缓存，而是：

1. `.run/dev.pid` 指向的旧 `pnpm dev` 进程仍然活着
2. 但它内部已经发生端口冲突，4173 不再对外提供服务
3. 旧逻辑只按 PID 存活判断，导致 `start.sh` 继续复用一套坏掉的 dev 栈

现在 `start.sh` 已经补成“PID + URL 健康”双重判断，并且默认只启动 `pnpm dev:console`。后续如果再出现“改完代码但页面不对”或“4173 拒绝连接”，先做这两个检查：

1. 看 `./start.sh` 输出是否提示 `Development stack already running`
2. 看它是否提示 `Tracked dev PID ... is alive but ... is not responding; restarting stack...`

## 建议排查顺序

1. 确认 `start.sh` 是否复用了已有 PID
2. 确认该 PID 对应的 `COE_WEB_URL` 是否真的可访问
3. 再检查是否存在真实代码回归或数据残留
