# Action Panel 重构实施清单

## 📋 概述

这是重构 [action-panel.tsx](file:///Volumes/XU-1TB-NPM/projects/COE-for-Agent/apps/investigation-console/src/components/action-panel.tsx) 的详细实施清单。

---

## 📚 相关文档

- [重构计划](./action-panel-refactoring-plan.md)
- [测试计划](./action-panel-test-plan.md)

---

## ✅ 前置检查清单

在开始重构前，请确认：

- [ ] 所有现有测试通过：`pnpm test`
- [ ] 所有类型检查通过：`pnpm typecheck`
- [ ] 所有 lint 检查通过：`pnpm lint`
- [ ] 创建新分支：`git checkout -b refactor/action-panel-split`
- [ ] 当前工作区干净，无未提交的更改

---

## 🚀 阶段 1: 准备工作

### 1.1 创建目录结构

```bash
mkdir -p apps/investigation-console/src/components/action-panel/__tests__
```

- [ ] 创建目录 `apps/investigation-console/src/components/action-panel/`
- [ ] 创建目录 `apps/investigation-console/src/components/action-panel/__tests__/`

### 1.2 创建类型定义文件

**文件**: `apps/investigation-console/src/components/action-panel/types.ts`

内容：
- 从原文件提取 `ActionConfig` 接口
- 从原文件提取 `ActionPanelProps` 类型
- 导出所有外部依赖的类型

- [ ] 创建 `types.ts`
- [ ] 验证 TypeScript 编译通过

---

## 🚀 阶段 2: 创建状态和处理 Hook

### 2.1 创建状态管理 Hook

**文件**: `apps/investigation-console/src/components/action-panel/useActionPanelState.ts`

内容：
- 提取所有 useState 调用
- 创建 `resetAllForms` 函数
- 返回所有状态和 setter

- [ ] 创建 `useActionPanelState.ts`
- [ ] 创建 `__tests__/useActionPanelState.test.ts`
- [ ] 运行测试：`pnpm --filter @coe/investigation-console test -- useActionPanelState`
- [ ] 验证测试通过

### 2.2 创建操作处理 Hook

**文件**: `apps/investigation-console/src/components/action-panel/useActionHandlers.ts`

内容：
- 提取 `executeAction` 函数
- 提取 `submitConfirmedAction` 函数
- 提取 `executeCloseCaseFlow` 函数
- 提取 `queueOrExecute` 函数
- 提取所有 `ActionConfig` 构建函数

- [ ] 创建 `useActionHandlers.ts`
- [ ] 创建 `__tests__/useActionHandlers.test.ts`
- [ ] 运行测试：`pnpm --filter @coe/investigation-console test -- useActionHandlers`
- [ ] 验证测试通过

---

## 🚀 阶段 3: 提取简单组件

### 3.1 创建确认对话框

**文件**: `apps/investigation-console/src/components/action-panel/ConfirmDialog.tsx`

内容：
- 提取确认对话框的 JSX
- 定义 `ConfirmDialogProps` 接口

- [ ] 创建 `ConfirmDialog.tsx`
- [ ] 创建 `__tests__/ConfirmDialog.test.tsx`
- [ ] 运行测试：`pnpm --filter @coe/investigation-console test -- ConfirmDialog`
- [ ] 验证测试通过

### 3.2 创建阶段控制

**文件**: `apps/investigation-console/src/components/action-panel/StageControls.tsx`

内容：
- 提取阶段推进相关的 JSX
- 定义 `StageControlsProps` 接口
- 包含结案控制（可以整合在一起）

- [ ] 创建 `StageControls.tsx`
- [ ] 创建 `__tests__/StageControls.test.tsx`
- [ ] 运行测试：`pnpm --filter @coe/investigation-console test -- StageControls`
- [ ] 验证测试通过

---

## 🚀 阶段 4: 提取复杂组件

### 4.1 创建假设控制

**文件**: `apps/investigation-console/src/components/action-panel/HypothesisControls.tsx`

内容：
- 提取假设相关的 JSX
- 定义 `HypothesisControlsProps` 接口

- [ ] 创建 `HypothesisControls.tsx`
- [ ] 创建 `__tests__/HypothesisControls.test.tsx`
- [ ] 运行测试：`pnpm --filter @coe/investigation-console test -- HypothesisControls`
- [ ] 验证测试通过

### 4.2 创建症状控制

**文件**: `apps/investigation-console/src/components/action-panel/SymptomControls.tsx`

- [ ] 创建 `SymptomControls.tsx`
- [ ] 创建 `__tests__/SymptomControls.test.tsx`
- [ ] 运行测试：`pnpm --filter @coe/investigation-console test -- SymptomControls`
- [ ] 验证测试通过

### 4.3 创建实验控制

**文件**: `apps/investigation-console/src/components/action-panel/ExperimentControls.tsx`

- [ ] 创建 `ExperimentControls.tsx`
- [ ] 创建 `__tests__/ExperimentControls.test.tsx`
- [ ] 运行测试：`pnpm --filter @coe/investigation-console test -- ExperimentControls`
- [ ] 验证测试通过

### 4.4 创建空白控制

**文件**: `apps/investigation-console/src/components/action-panel/GapControls.tsx`

- [ ] 创建 `GapControls.tsx`
- [ ] 创建 `__tests__/GapControls.test.tsx`
- [ ] 运行测试：`pnpm --filter @coe/investigation-console test -- GapControls`
- [ ] 验证测试通过

### 4.5 创建调查控制

**文件**: `apps/investigation-console/src/components/action-panel/InquiryControls.tsx`

- [ ] 创建 `InquiryControls.tsx`
- [ ] 创建 `__tests__/InquiryControls.test.tsx`
- [ ] 运行测试：`pnpm --filter @coe/investigation-console test -- InquiryControls`
- [ ] 验证测试通过

### 4.6 创建残余控制

**文件**: `apps/investigation-console/src/components/action-panel/ResidualControls.tsx`

- [ ] 创建 `ResidualControls.tsx`
- [ ] 创建 `__tests__/ResidualControls.test.tsx`
- [ ] 运行测试：`pnpm --filter @coe/investigation-console test -- ResidualControls`
- [ ] 验证测试通过

---

## 🚀 阶段 5: 创建主容器

### 5.1 创建主组件

**文件**: `apps/investigation-console/src/components/action-panel/ActionPanel.tsx`

内容：
- 使用 `useActionPanelState` Hook
- 使用 `useActionHandlers` Hook
- 条件渲染各子组件
- 传递 props 给子组件

- [ ] 创建 `ActionPanel.tsx`
- [ ] 创建 `__tests__/ActionPanel.test.tsx`（集成测试）
- [ ] 运行测试：`pnpm --filter @coe/investigation-console test -- ActionPanel`
- [ ] 验证测试通过

### 5.2 创建导出文件

**文件**: `apps/investigation-console/src/components/action-panel/index.ts`

内容：
```typescript
export { ActionPanel } from './ActionPanel.js';
export type { ActionPanelProps } from './types.js';
```

- [ ] 创建 `index.ts`

---

## 🚀 阶段 6: 更新引用

### 6.1 更新所有导入

搜索并更新所有引用：

```bash
# 查找所有引用
grep -r "from.*action-panel" apps/investigation-console/src/
```

- [ ] 更新 `apps/investigation-console/src/routes/cases.$caseId.tsx` 中的导入
- [ ] 更新其他文件中的导入
- [ ] 验证所有导入都指向新的路径

---

## 🚀 阶段 7: 验证与测试

### 7.1 运行所有测试

```bash
pnpm test
```

- [ ] 所有单元测试通过
- [ ] 所有组件测试通过
- [ ] 所有集成测试通过

### 7.2 运行 E2E 测试

```bash
pnpm test:e2e
```

- [ ] 所有 E2E 测试通过

### 7.3 运行类型和 lint 检查

```bash
pnpm typecheck
pnpm lint
```

- [ ] 类型检查通过
- [ ] Lint 检查通过

### 7.4 手动验证

启动开发服务器：

```bash
pnpm dev
```

手动验证：
- [ ] Case List 正常显示
- [ ] 可以打开案件
- [ ] Action Panel 正常显示
- [ ] 历史模式正常工作
- [ ] 所有按钮正常工作
- [ ] 确认流程正常工作
- [ ] 结案流程正常工作

---

## 🚀 阶段 8: 清理

### 8.1 删除旧文件

```bash
git rm apps/investigation-console/src/components/action-panel.tsx
```

- [ ] 删除旧文件 `action-panel.tsx`

### 8.2 提交更改

```bash
git add .
git commit -m "refactor: split action-panel.tsx into smaller components

- Create action-panel directory structure
- Extract useActionPanelState and useActionHandlers hooks
- Extract ConfirmDialog, StageControls, HypothesisControls, etc.
- Create ActionPanel main container
- Update all imports
- Add comprehensive test coverage"
```

- [ ] 提交所有更改

---

## 🔄 回滚计划

如果遇到问题，可以回滚：

```bash
# 恢复到重构前的状态
git reset --hard HEAD

# 或者，如果已经提交了
git revert <commit-hash>
```

---

## ✅ 最终验收清单

- [ ] 所有测试通过
- [ ] 类型检查通过
- [ ] Lint 检查通过
- [ ] E2E 测试通过
- [ ] 手动验证通过
- [ ] 旧文件已删除
- [ ] 更改已提交
- [ ] 代码可维护性显著提升

---

## 📊 完成后统计

重构完成后应该：

- **原文件**: 734 行 → 删除
- **新文件**: 13+ 个文件，每个 < 300 行
- **测试覆盖率**: 目标 90%+
- **功能**: 100% 保持一致
