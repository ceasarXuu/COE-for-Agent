# Action Panel 组件拆分计划

## 📋 概述

目标：将 734 行的 `action-panel.tsx` 拆分为多个职责单一的小组件，提高可维护性。

## 🏗️ 新目录结构

```
apps/investigation-console/src/components/
└── action-panel/
    ├── index.ts                          # 导出文件
    ├── ActionPanel.tsx                   # 主容器组件
    ├── ConfirmDialog.tsx                 # 确认对话框
    ├── useActionPanelState.ts            # 状态管理 Hook
    ├── useActionHandlers.ts              # 操作处理 Hook
    ├── types.ts                          # 类型定义
    ├── StageControls.tsx                 # 阶段控制
    ├── CloseCaseControls.tsx             # 结案控制
    ├── HypothesisControls.tsx            # 假设控制
    ├── SymptomControls.tsx               # 症状控制
    ├── ExperimentControls.tsx            # 实验控制
    ├── GapControls.tsx                   # 空白控制
    ├── InquiryControls.tsx               # 调查控制
    ├── ResidualControls.tsx              # 残余控制
    └── __tests__/
        ├── ActionPanel.test.tsx          # 集成测试
        ├── ConfirmDialog.test.tsx        # 确认对话框测试
        ├── useActionPanelState.test.ts   # 状态 Hook 测试
        ├── useActionHandlers.test.ts     # 处理 Hook 测试
        ├── StageControls.test.tsx        # 阶段控制测试
        ├── HypothesisControls.test.tsx   # 假设控制测试
        └── ...                            # 其他子组件测试
```

---

## 📝 文件拆分详情

### 1. types.ts - 类型定义

**职责**: 集中管理所有类型定义

**包含内容**:
- `ActionConfig` 接口
- `ActionPanelProps` 类型
- 导出从外部引入的类型

---

### 2. useActionPanelState.ts - 状态管理 Hook

**职责**: 管理所有 UI 状态

**包含状态**:
```typescript
// 表单输入状态
const [stageRationale, setStageRationale] = useState('');
const [hypothesisRationale, setHypothesisRationale] = useState('');
const [newHypothesisStatement, setNewHypothesisStatement] = useState('');
const [newHypothesisFalsification, setNewHypothesisFalsification] = useState('');
const [experimentObjective, setExperimentObjective] = useState('');
const [experimentExpectedOutcome, setExperimentExpectedOutcome] = useState('');
const [experimentResultSummary, setExperimentResultSummary] = useState('');
const [gapQuestion, setGapQuestion] = useState('');
const [gapResolution, setGapResolution] = useState('');
const [inquiryResolutionReason, setInquiryResolutionReason] = useState('');
const [residualStatement, setResidualStatement] = useState('');
const [residualRationale, setResidualRationale] = useState('');
const [decisionRationale, setDecisionRationale] = useState('');
const [closureDecisionRationale, setClosureDecisionRationale] = useState('');

// UI 状态
const [confirmAction, setConfirmAction] = useState<ActionConfig | null>(null);
const [pending, setPending] = useState(false);
const [error, setError] = useState<string | null>(null);

// 重置所有表单的函数
const resetAllForms: () => void;
```

---

### 3. useActionHandlers.ts - 操作处理 Hook

**职责**: 管理所有操作逻辑

**包含内容**:
- `executeAction(action: ActionConfig, confirmToken?: string)`
- `submitConfirmedAction()`
- `executeCloseCaseFlow()`
- `queueOrExecute(action: ActionConfig)`
- 所有 `ActionConfig` 构建函数

**依赖**:
- `caseId`
- `currentRevision`
- `defaultInquiryId`
- `guardrails`
- `onMutationComplete`
- 状态 setter 函数

---

### 4. ConfirmDialog.tsx - 确认对话框

**职责**: 显示确认对话框

**Props**:
```typescript
interface ConfirmDialogProps {
  confirmAction: ActionConfig | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  t: (key: string) => string;
}
```

---

### 5. StageControls.tsx - 阶段控制

**职责**: 处理案件阶段推进的 UI

**Props**:
```typescript
interface StageControlsProps {
  caseStage: string | null | undefined;
  currentRevision: number;
  historical: boolean;
  pending: boolean;
  closeCasePass: boolean;
  stageRationale: string;
  closureDecisionRationale: string;
  nextStage: string;
  stageActionTitle: string;
  onStageRationaleChange: (value: string) => void;
  onClosureDecisionRationaleChange: (value: string) => void;
  onAdvanceStage: () => void;
  onCloseCase: () => void;
  t: (key: string) => string;
}
```

---

### 6. CloseCaseControls.tsx - 结案控制

**职责**: 结案流程的专用 UI（可以整合到 StageControls）

---

### 7. HypothesisControls.tsx - 假设控制

**职责**: 处理假设相关操作的 UI

**Props**:
```typescript
interface HypothesisControlsProps {
  hypothesis: Pick<GraphNodeRecord, 'id' | 'kind' | 'label' | 'status'>;
  historical: boolean;
  pending: boolean;
  readyToPatchPass: boolean;
  defaultInquiryId: string | null | undefined;
  hypothesisRationale: string;
  gapQuestion: string;
  decisionRationale: string;
  experimentObjective: string;
  experimentExpectedOutcome: string;
  onHypothesisRationaleChange: (value: string) => void;
  onGapQuestionChange: (value: string) => void;
  onDecisionRationaleChange: (value: string) => void;
  onExperimentObjectiveChange: (value: string) => void;
  onExperimentExpectedOutcomeChange: (value: string) => void;
  onConfirmHypothesis: () => void;
  onOpenGap: () => void;
  onRecordDecision: () => void;
  onPlanExperiment: () => void;
  t: (key: string) => string;
}
```

---

### 8. SymptomControls.tsx - 症状控制

**职责**: 处理症状相关操作的 UI

---

### 9. ExperimentControls.tsx - 实验控制

**职责**: 处理实验相关操作的 UI

---

### 10. GapControls.tsx - 空白控制

**职责**: 处理空白相关操作的 UI

---

### 11. InquiryControls.tsx - 调查控制

**职责**: 处理调查相关操作的 UI

---

### 12. ResidualControls.tsx - 残余控制

**职责**: 处理残余相关操作的 UI

---

### 13. ActionPanel.tsx - 主容器

**职责**: 协调所有子组件

**内容**:
- 使用 `useActionPanelState` 和 `useActionHandlers`
- 条件渲染各子组件
- 传递 props 给子组件

---

### 14. index.ts - 导出文件

**内容**:
```typescript
export { ActionPanel } from './ActionPanel.js';
export type { ActionPanelProps } from './types.js';
```

---

## 🎯 实施步骤

### 阶段 1: 准备工作
1. 创建新目录结构
2. 创建类型定义文件 `types.ts`
3. 创建状态 Hook `useActionPanelState.ts`
4. 创建处理 Hook `useActionHandlers.ts`

### 阶段 2: 提取简单组件
5. 创建 `ConfirmDialog.tsx`
6. 创建 `StageControls.tsx`

### 阶段 3: 提取复杂组件
7. 创建 `HypothesisControls.tsx`
8. 创建 `SymptomControls.tsx`
9. 创建其他控制组件

### 阶段 4: 集成与测试
10. 创建主容器 `ActionPanel.tsx`
11. 创建 `index.ts` 导出文件
12. 更新所有引用
13. 运行测试

### 阶段 5: 清理
14. 删除旧文件 `action-panel.tsx`
15. 更新导入路径

---

## ✅ 验收标准

1. ✅ 所有现有测试通过
2. ✅ TypeScript 类型检查通过
3. ✅ ESLint 检查通过
4. ✅ 功能行为与原组件完全一致
5. ✅ 没有新增任何功能，也没有删除任何功能
6. ✅ 代码可维护性提升

---

## 🔄 回滚计划

如果拆分出现问题，可以通过以下方式回滚：

```bash
# 恢复旧文件
git checkout HEAD -- apps/investigation-console/src/components/action-panel.tsx

# 删除新文件
rm -rf apps/investigation-console/src/components/action-panel/
```
