# start.sh Runbook

## 当前行为

`./start.sh` 只负责：

- 检查依赖命令
- 在没有存活 PID 的情况下后台启动 `pnpm dev`
- 等待 Console web 就绪
- 自动打开浏览器

它**不会强制重启**已经在运行的开发栈。

## 关键细节

如果 `.run/dev.pid` 指向的进程仍然存活，`start.sh` 会直接复用该进程：

- 不会重新拉起 Vite
- 不会重新拉起 Console BFF
- 不会清理旧的本地数据目录

所以当你修改了代码但页面仍像旧版时，先确认是不是还在复用旧进程，而不是默认把问题归到缓存或浏览器。

## 这次踩坑的结论

这次 workspace 左侧 `SnapshotView` 模块的出现，不是 `start.sh` 额外“生成”了它，而是：

1. 运行中的 dev 进程继续提供旧/当前代码
2. `cases.$caseId.tsx` 之前固定挂载了 `SnapshotView`

现在这块挂载已经移除。后续如果再出现“改完代码但页面不对”的情况，先做这两个检查：

1. 看 `./start.sh` 输出是否提示 `Development stack already running`
2. 必要时先停掉旧进程，再重新执行 `./start.sh`

## 建议排查顺序

1. 确认 `start.sh` 是否复用了已有 PID
2. 确认浏览器访问的是期望端口
3. 再检查是否存在真实代码回归或数据残留
