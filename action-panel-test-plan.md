# Action Panel 回测用例

## 📋 概述

本文档定义了拆分 `action-panel.tsx` 后的完整回测用例，确保重构前后功能完全一致。

---

## 🎯 测试策略

### 测试层级

1. **单元测试**: 测试单个函数和 Hook
2. **组件测试**: 测试单个 UI 组件
3. **集成测试**: 测试完整的 ActionPanel 组件
4. **E2E 测试**: 复用现有的 E2E 测试套件

### 测试原则

- 保持现有测试全部通过
- 新增测试覆盖新的拆分结构
- 使用相同的测试数据 Fixture
- 验证 UI 行为完全一致

---

## 📝 单元测试用例

### 1. useActionPanelState.test.ts - 状态 Hook 测试

```typescript
describe('useActionPanelState', () => {
  describe('初始状态', () => {
    it('应该初始化所有表单字段为空字符串', () => {
      // 验证所有 useState 初始值都是 ''
    });

    it('应该初始化 confirmAction 为 null', () => {
      // 验证 confirmAction 初始值
    });

    it('应该初始化 pending 为 false', () => {
      // 验证 pending 初始值
    });

    it('应该初始化 error 为 null', () => {
      // 验证 error 初始值
    });
  });

  describe('状态更新', () => {
    it('应该正确更新 stageRationale', () => {
      // 调用 setStageRationale，验证值更新
    });

    it('应该正确更新 hypothesisRationale', () => {
      // 调用 setHypothesisRationale，验证值更新
    });

    // ... 测试其他状态 setter
  });

  describe('resetAllForms', () => {
    it('应该重置所有表单字段为空字符串', () => {
      // 设置一些值，调用 resetAllForms，验证都重置为 ''
    });

    it('不应该重置 confirmAction、pending、error', () => {
      // 设置这些状态，调用 resetAllForms，验证它们不变
    });
  });
});
```

---

### 2. useActionHandlers.test.ts - 操作处理 Hook 测试

```typescript
describe('useActionHandlers', () => {
  describe('executeAction', () => {
    it('应该调用 invokeTool 并重置表单', async () => {
      // Mock invokeTool
      // 调用 executeAction
      // 验证 invokeTool 被正确调用
      // 验证 action.reset 被调用
      // 验证 onMutationComplete 被调用
    });

    it('应该在成功时清除 confirmAction', async () => {
      // 设置 confirmAction
      // 调用 executeAction
      // 验证 confirmAction 被设置为 null
    });

    it('应该在错误时设置 error 状态', async () => {
      // Mock invokeTool 抛出错误
      // 调用 executeAction
      // 验证 error 被设置
    });

    it('应该正确设置 pending 状态', async () => {
      // 验证 pending 在开始时为 true，结束时为 false
    });

    it('应该在有 confirmToken 时传递给 invokeTool', async () => {
      // 调用 executeAction 并传入 confirmToken
      // 验证 invokeTool 接收到 confirmToken
    });
  });

  describe('submitConfirmedAction', () => {
    it('在没有 confirmAction 时应该什么都不做', async () => {
      // confirmAction 为 null
      // 调用 submitConfirmedAction
      // 验证没有任何调用
    });

    it('应该调用 requestConfirmIntent 和 executeAction', async () => {
      // Mock requestConfirmIntent
      // 设置 confirmAction
      // 调用 submitConfirmedAction
      // 验证 requestConfirmIntent 被正确调用
      // 验证 executeAction 被正确调用
    });

    it('应该在错误时设置 error 状态', async () => {
      // Mock requestConfirmIntent 抛出错误
      // 调用 submitConfirmedAction
      // 验证 error 被设置
    });
  });

  describe('executeCloseCaseFlow', () => {
    it('在 caseStage 不是 repair_validation 时应该什么都不做', async () => {
      // caseStage 为其他值
      // 调用 executeCloseCaseFlow
      // 验证没有任何调用
    });

    it('在 closureDecisionRationale 为空时应该什么都不做', async () => {
      // caseStage 为 repair_validation
      // closureDecisionRationale 为空
      // 调用 executeCloseCaseFlow
      // 验证没有任何调用
    });

    it('应该执行完整的结案流程', async () => {
      // 设置正确的条件
      // Mock requestConfirmIntent 和 invokeTool
      // 调用 executeCloseCaseFlow
      // 验证两次 requestConfirmIntent 调用
      // 验证两次 invokeTool 调用
      // 验证 closureDecisionRationale 被重置
      // 验证 onMutationComplete 被调用
    });
  });

  describe('queueOrExecute', () => {
    it('在 requiresConfirm 为 true 时应该设置 confirmAction', () => {
      // 创建 requiresConfirm: true 的 action
      // 调用 queueOrExecute
      // 验证 setConfirmAction 被调用
    });

    it('在 requiresConfirm 为 false 时应该直接调用 executeAction', () => {
      // 创建 requiresConfirm: false 的 action
      // 调用 queueOrExecute
      // 验证 executeAction 被调用
    });
  });

  describe('ActionConfig 构建函数', () => {
    describe('buildStageAction', () => {
      it('应该构建正确的 stageAction', () => {
        // 验证构建的 action 包含正确的字段
      });

      it('reset 函数应该重置 stageRationale', () => {
        // 调用 reset，验证 stageRationale 被重置
      });
    });

    describe('buildHypothesisConfirmAction', () => {
      it('在 selectedNode 是 hypothesis 时应该返回 action', () => {
        // selectedNode.kind = 'hypothesis'
        // 验证返回正确的 action
      });

      it('在 selectedNode 不是 hypothesis 时应该返回 null', () => {
        // selectedNode.kind = 其他值
        // 验证返回 null
      });
    });

    // ... 测试其他 ActionConfig 构建函数
  });
});
```

---

## 🧪 组件测试用例

### 3. ConfirmDialog.test.tsx - 确认对话框测试

```typescript
describe('ConfirmDialog', () => {
  it('在 confirmAction 为 null 时不应该渲染', () => {
    // confirmAction = null
    // 验证不渲染对话框
  });

  it('应该显示正确的标题和理由', () => {
    // 传入 confirmAction
    // 验证标题显示
    // 验证理由显示
  });

  it('点击取消按钮应该调用 onCancel', () => {
    // 点击取消按钮
    // 验证 onCancel 被调用
  });

  it('点击确认按钮应该调用 onConfirm', () => {
    // 点击确认按钮
    // 验证 onConfirm 被调用
  });

  it('在 pending 时应该显示提交中文本', () => {
    // pending = true
    // 验证按钮文本正确
  });

  it('在 not pending 时应该显示确认文本', () => {
    // pending = false
    // 验证按钮文本正确
  });
});
```

---

### 4. StageControls.test.tsx - 阶段控制测试

```typescript
describe('StageControls', () => {
  describe('阶段推进', () => {
    it('应该显示阶段理由输入框', () => {
      // 验证 textarea 存在
    });

    it('应该正确更新阶段理由', () => {
      // 输入文本
      // 验证 onStageRationaleChange 被调用
    });

    it('在 historical 时应该禁用输入框', () => {
      // historical = true
      // 验证 textarea 被禁用
    });

    it('在 pending 时应该禁用输入框', () => {
      // pending = true
      // 验证 textarea 被禁用
    });

    it('应该显示推进按钮', () => {
      // 验证按钮存在
    });

    it('按钮文本应该根据 nextStage 变化', () => {
      // nextStage = 'repair_validation'
      // 验证按钮文本
      // nextStage = 'closed'
      // 验证按钮文本
      // nextStage = 'repair_preparation'
      // 验证按钮文本
    });

    it('在理由为空时应该禁用按钮', () => {
      // stageRationale = ''
      // 验证按钮被禁用
    });

    it('在 historical 时应该禁用按钮', () => {
      // historical = true
      // 验证按钮被禁用
    });

    it('在 pending 时应该禁用按钮', () => {
      // pending = true
      // 验证按钮被禁用
    });

    it('点击按钮应该调用 onAdvanceStage', () => {
      // nextStage 不是 'closed'
      // 点击按钮
      // 验证 onAdvanceStage 被调用
    });

    it('在 nextStage 是 closed 时点击按钮应该调用 onCloseCase', () => {
      // nextStage = 'closed'
      // 点击按钮
      // 验证 onCloseCase 被调用
    });
  });

  describe('结案控制', () => {
    it('在 nextStage 不是 closed 时不应该显示结案理由输入框', () => {
      // nextStage = 其他值
      // 验证不显示
    });

    it('在 nextStage 是 closed 时应该显示结案理由输入框', () => {
      // nextStage = 'closed'
      // 验证显示
    });

    it('应该正确更新结案理由', () => {
      // 输入文本
      // 验证 onClosureDecisionRationaleChange 被调用
    });

    it('在结案时，理由为空或 closeCasePass 为 false 应该禁用按钮', () => {
      // nextStage = 'closed'
      // closureDecisionRationale = '' 或 closeCasePass = false
      // 验证按钮被禁用
    });
  });
});
```

---

### 5. HypothesisControls.test.tsx - 假设控制测试

```typescript
describe('HypothesisControls', () => {
  it('应该显示假设理由输入框', () => {
    // 验证 textarea 存在
  });

  it('应该显示确认假设按钮', () => {
    // 验证按钮存在
  });

  it('应该显示打开空白按钮', () => {
    // 验证按钮存在
  });

  it('应该显示记录决策按钮', () => {
    // 验证按钮存在
  });

  it('应该显示计划实验按钮', () => {
    // 验证按钮存在
  });

  it('应该显示空白问题输入框', () => {
    // 验证 textarea 存在
  });

  it('应该显示决策理由输入框', () => {
    // 验证 textarea 存在
  });

  it('应该显示实验目标输入框', () => {
    // 验证 textarea 存在
  });

  it('应该显示预期结果输入框', () => {
    // 验证 textarea 存在
  });

  it('在 historical 时应该禁用所有输入框和按钮', () => {
    // historical = true
    // 验证所有控件都被禁用
  });

  it('在 pending 时应该禁用所有输入框和按钮', () => {
    // pending = true
    // 验证所有控件都被禁用
  });

  it('点击确认假设按钮应该调用 onConfirmHypothesis', () => {
    // 点击按钮
    // 验证回调被调用
  });

  it('点击打开空白按钮应该调用 onOpenGap', () => {
    // 点击按钮
    // 验证回调被调用
  });

  it('点击记录决策按钮应该调用 onRecordDecision', () => {
    // 点击按钮
    // 验证回调被调用
  });

  it('点击计划实验按钮应该调用 onPlanExperiment', () => {
    // 点击按钮
    // 验证回调被调用
  });

  it('在 defaultInquiryId 不存在时应该禁用实验相关控件', () => {
    // defaultInquiryId = null
    // 验证实验目标、预期结果输入框和计划实验按钮被禁用
  });

  it('在理由为空时应该禁用对应的按钮', () => {
    // hypothesisRationale = ''
    // 验证确认假设按钮被禁用
    // gapQuestion = ''
    // 验证打开空白按钮被禁用
    // ... 其他类似验证
  });
});
```

---

### 6. 其他控制组件测试

参考上述模式，为以下组件创建类似的测试：
- `SymptomControls.test.tsx`
- `ExperimentControls.test.tsx`
- `GapControls.test.tsx`
- `InquiryControls.test.tsx`
- `ResidualControls.test.tsx`

---

## 🔗 集成测试用例

### 7. ActionPanel.test.tsx - 完整集成测试

```typescript
describe('ActionPanel (集成测试)', () => {
  const defaultProps = {
    caseId: 'case_01',
    caseStage: 'evidence_collection',
    defaultInquiryId: 'inquiry_01',
    currentRevision: 42,
    historical: false,
    selectedNode: null,
    guardrails: {
      closeCase: { pass: false },
      readyToPatch: { pass: false },
      stall: { pass: false }
    },
    onMutationComplete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('历史模式', () => {
    it('在 historical 为 true 时应该显示冻结横幅', () => {
      render(<ActionPanel {...defaultProps} historical={true} />);
      expect(screen.getByText(t('action.historicalFrozen'))).toBeInTheDocument();
    });
  });

  describe('错误显示', () => {
    it('在有错误时应该显示错误信息', async () => {
      // Mock invokeTool 抛出错误
      render(<ActionPanel {...defaultProps} />);
      
      // 触发一个会出错的操作
      // 验证错误信息显示
    });
  });

  describe('阶段推进流程', () => {
    it('应该正确推进到下一阶段', async () => {
      const user = userEvent.setup();
      render(<ActionPanel {...defaultProps} />);
      
      // 输入阶段理由
      await user.type(screen.getByTestId('stage-rationale'), 'test rationale');
      
      // 点击推进按钮
      await user.click(screen.getByTestId('action-advance-stage'));
      
      // 验证 invokeTool 被调用
      // 验证 onMutationComplete 被调用
    });
  });

  describe('确认流程', () => {
    it('应该正确显示确认对话框', async () => {
      const user = userEvent.setup();
      render(
        <ActionPanel 
          {...defaultProps} 
          selectedNode={{ 
            id: 'hypothesis_01', 
            kind: 'hypothesis', 
            label: 'Test Hypothesis',
            status: 'active'
          }} 
        />
      );
      
      // 输入假设理由
      await user.type(screen.getByTestId('hypothesis-rationale'), 'test rationale');
      
      // 点击确认假设按钮
      await user.click(screen.getByTestId('action-confirm-hypothesis'));
      
      // 验证确认对话框显示
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    it('应该正确取消确认', async () => {
      const user = userEvent.setup();
      render(/* ... */);
      
      // 打开确认对话框
      // 点击取消按钮
      // 验证对话框消失
      // 验证没有调用 invokeTool
    });

    it('应该正确提交确认', async () => {
      const user = userEvent.setup();
      render(/* ... */);
      
      // 打开确认对话框
      // 点击确认提交按钮
      // 验证 requestConfirmIntent 被调用
      // 验证 invokeTool 被调用
    });
  });

  describe('选中不同节点类型', () => {
    const nodeTypes = [
      { kind: 'hypothesis', label: 'Hypothesis' },
      { kind: 'symptom', label: 'Symptom' },
      { kind: 'experiment', label: 'Experiment' },
      { kind: 'gap', label: 'Gap' },
      { kind: 'inquiry', label: 'Inquiry' },
      { kind: 'residual', label: 'Residual' }
    ];

    nodeTypes.forEach(({ kind, label }) => {
      it(`应该在选中 ${kind} 时显示正确的控件`, () => {
        render(
          <ActionPanel 
            {...defaultProps} 
            selectedNode={{ 
              id: `${kind}_01`, 
              kind, 
              label,
              status: 'active'
            }} 
          />
        );
        
        // 验证该类型特有的控件显示
      });
    });
  });

  describe('结案流程', () => {
    it('应该正确执行结案流程', async () => {
      const user = userEvent.setup();
      render(
        <ActionPanel 
          {...defaultProps} 
          caseStage="repair_validation"
          guardrails={{
            ...defaultProps.guardrails,
            closeCase: { pass: true }
          }}
        />
      );
      
      // 输入结案理由
      await user.type(screen.getByTestId('closure-decision-rationale'), 'close case rationale');
      
      // 点击结案按钮
      await user.click(screen.getByTestId('action-advance-stage'));
      
      // 验证两次 requestConfirmIntent 调用
      // 验证两次 invokeTool 调用
      // 验证 onMutationComplete 被调用
    });
  });
});
```

---

## 🎭 E2E 测试用例

### 复用现有 E2E 测试

现有的 E2E 测试应该**不需要修改**，直接运行即可验证重构正确性：

```typescript
// 现有的 E2E 测试文件
apps/investigation-console/e2e/case-workspace.spec.ts
apps/investigation-console/e2e/history-mode.spec.ts
apps/investigation-console/e2e/real-backend.spec.ts
```

这些测试会验证：
- Case List 正常工作
- 案件工作台正常工作
- 历史模式正常工作
- 所有操作按钮正常工作
- 确认流程正常工作

---

## 📊 测试覆盖率目标

| 模块 | 目标覆盖率 |
|------|-----------|
| useActionPanelState | 90%+ |
| useActionHandlers | 90%+ |
| ConfirmDialog | 95%+ |
| StageControls | 95%+ |
| HypothesisControls | 95%+ |
| 其他控制组件 | 90%+ |
| ActionPanel (集成) | 80%+ |

---

## ✅ 验收标准

### 测试验收

1. ✅ 所有现有测试通过（包括 E2E）
2. ✅ 新增单元测试通过
3. ✅ 新增组件测试通过
4. ✅ 新增集成测试通过
5. ✅ 测试覆盖率达到目标
6. ✅ TypeScript 类型检查通过
7. ✅ ESLint 检查通过

### 功能验收

1. ✅ 所有 UI 交互与重构前完全一致
2. ✅ 所有 API 调用与重构前完全一致
3. ✅ 历史模式正常工作
4. ✅ 确认流程正常工作
5. ✅ 所有节点类型的操作正常工作
6. ✅ 结案流程正常工作

---

## 🚀 测试执行命令

```bash
# 运行所有测试
pnpm test

# 只运行 ActionPanel 相关测试
pnpm --filter @coe/investigation-console test -- action-panel

# 运行 E2E 测试
pnpm test:e2e

# 生成覆盖率报告
pnpm --filter @coe/investigation-console test --coverage
```
