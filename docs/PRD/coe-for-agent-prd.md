# COE for Agent PRD

> 本文由原始 part1.md、part2.md、part3.md、part4.md 无损串联合并而成。
> 处理原则：不改动原始内容语义，只补统一标题、章节衔接和格式化分隔。
> 本文现在是 `docs/PRD` 下唯一维护的主 PRD 文档。
> 本文已按 [docs/DEV/technical-design.md](/Volumes/XU-1TB-NPM/projects/COE-for-Agent/docs/DEV/technical-design.md) 与 [docs/plans/2026-04-05-coe-mvp-implementation.md](/Volumes/XU-1TB-NPM/projects/COE-for-Agent/docs/plans/2026-04-05-coe-mvp-implementation.md) 的最终收口口径清洗冲突段落。

## Part 1：办案图与调查模型

好，接下来就把注意力收缩到**“办案图”的数据模型和操作集**。

我先给一个总判断：

## 这个系统不要设计成“通用图编辑器”，而要设计成“受约束的案件状态机”

也就是说：

* **底层可以是图**
* **对 agent 暴露的接口不能是任意 `create_node / create_edge`**
* 必须是**领域命令式操作**
* 每次操作都要经过**结构校验、证据校验、阶段校验**

否则它就退化成另一份自由文本 scratchpad，约束力会很弱。

---

# 一、设计总原则

我建议这套模型遵守 6 条原则。

## 1. 案件中心，而不是代码中心

代码关系图只是上下文。
**办案图的主语是这一次 investigation**。

所以根对象一定是 `Case`，不是 repo、module、service。

---

## 2. 原始证据与推断必须分层

必须严格区分：

* 原始材料：日志、trace、代码片段、配置快照、测试输出、diff
* 原子事实：从材料中抽出的可引用陈述
* 推断：假设、结论、决策

这三类不能混。

---

## 3. 因果关系优先用“假设节点”表达，不直接写死为边

这条非常关键。

不要让 agent 直接写：

* `CacheInvalidation -> causes -> StaleRead`

因为这在调查过程中并不是事实，而是**竞争解释之一**。

更稳妥的做法是：

* 建一个 `Hypothesis` 节点：
  “缓存失效漏触发导致读取旧状态”
* 再让它去 `explains -> Symptom`

这样图里始终保留**认识论层级**：
什么是证据，什么是解释，什么只是当前猜测。

---

## 4. 图只是投影，真正的真相源是事件日志

建议底层采用：

* **append-only investigation event log**
* 外加一个**materialized case graph**

也就是：

* agent 调用命令
* 系统记录事件
* 再由事件投影出当前办案图

这样你能得到：

* 可审计
* 可回放
* 可多 session 持续
* 可冲突恢复
* 可做 stall detection

这比直接改图稳得多。

---

## 5. 操作必须是命令式，不是 CRUD 式

不要暴露：

* `create_node`
* `update_node`
* `delete_edge`

要暴露：

* `report_symptom`
* `attach_artifact`
* `assert_fact`
* `propose_hypothesis`
* `plan_experiment`
* `record_experiment_result`
* `update_hypothesis_status`
* `open_gap`
* `open_residual`
* `record_decision`

这样工具本身才有“约束”能力。

---

## 6. 所有“未解释部分”都必须成为一等对象

复杂案件最容易丢的是：

* 未解释残差
* 关键缺口
* 被阻塞问题

所以 `Gap` 和 `Residual` 必须是一等节点，不是备注。

---

# 二、推荐的模型：四层办案图

我建议把数据模型拆成四层。

## A. 案件控制层

管理案件生命周期和分支。

* `Case`
* `Inquiry`
* `Decision`

## B. 证据层

管理原始材料和原子事实。

* `Artifact`
* `Fact`

## C. 推理层

管理竞争解释和验证动作。

* `Hypothesis`
* `Experiment`

## D. 约束层

管理未知、残差、阻塞项。

* `Gap`
* `Residual`

另外还有一类上下文节点：

* `Entity`

`Entity` 不是办案主体，但很有必要。它用于挂接：

* service
* module
* file
* function
* api
* db/table
* queue/topic
* cache
* config key
* tenant
* workflow
* external dependency

---

# 三、核心节点类型

下面给一版适合 v1 的对象模型。

---

## 1. Case

代表一次独立案件。

### 作用

* 定义问题边界
* 记录当前阶段
* 汇总所有分支、症状、假设、实验、残差

### 推荐字段

```json
{
  "id": "C-20260403-001",
  "type": "case",
  "title": "订单状态偶发回退",
  "status": "active",
  "stage": "investigating",
  "severity": "high",
  "objective": "定位导致订单详情页显示旧状态的根因",
  "created_at": "2026-04-03T10:00:00+09:00",
  "created_by": {
    "actor_type": "agent",
    "actor_id": "claude-code",
    "session_id": "sess-001"
  },
  "environment": ["prod"],
  "labels": ["order", "stale-read", "intermittent"]
}
```

### 状态建议

* `active`
* `blocked`
* `ready_to_patch`
* `validating`
* `closed`

### 阶段建议

* `intake`
* `scoping`
* `evidence_collection`
* `hypothesis_competition`
* `discriminative_testing`
* `repair_preparation`
* `repair_validation`
* `closed`

---

## 2. Inquiry

这是办案分支，或者说**侦查线**。

没有这个对象，复杂图很快会失控。
因为一个案件往往同时存在多条线：

* 缓存线
* 队列线
* 配置线
* 发布线

### 推荐字段

```json
{
  "id": "IQ-01",
  "type": "inquiry",
  "case_id": "C-20260403-001",
  "title": "队列重复消费线",
  "question": "是否存在重复消费导致状态回滚？",
  "status": "open",
  "priority": "high",
  "parent_inquiry_id": null,
  "scope_entity_ids": ["ENT-worker", "ENT-queue", "ENT-order-db"]
}
```

### 状态建议

* `open`
* `paused`
* `closed`
* `merged`

---

## 3. Entity

表示系统中的“对象位点”。

### 推荐字段

```json
{
  "id": "ENT-cache-order-status",
  "type": "entity",
  "entity_kind": "cache",
  "name": "order-status-cache",
  "locator": {
    "service": "order-read-api",
    "key_pattern": "order_status:{orderId}"
  },
  "tags": ["read-path", "cache"]
}
```

### `entity_kind` 建议枚举

* `service`
* `module`
* `file`
* `function`
* `class`
* `api`
* `db`
* `table`
* `queue`
* `topic`
* `cache`
* `config`
* `tenant`
* `workflow`
* `external_api`

---

## 4. Symptom

表示现象，而不是解释。

### 推荐字段

```json
{
  "id": "S-01",
  "type": "symptom",
  "case_id": "C-20260403-001",
  "title": "订单详情页显示旧状态",
  "statement": "部分订单在支付成功后 1~3 分钟内，详情页仍显示 pending",
  "status": "reported",
  "severity": "critical",
  "reproducibility": "intermittent",
  "critical": true,
  "environment": ["prod"],
  "affected_entity_ids": ["ENT-order-read-api", "ENT-order-status-cache"],
  "time_window": {
    "start": "2026-04-03T08:00:00+09:00"
  }
}
```

### 状态建议

* `reported`
* `bounded`
* `reproduced`
* `explained`
* `resolved`

---

## 5. Artifact

这是**原始材料**。它不等于事实。

### 典型类型

* log excerpt
* trace span
* metric snapshot
* code snippet
* config snapshot
* test output
* reproduction script
* code diff
* screenshot
* user report

### 推荐字段

```json
{
  "id": "A-013",
  "type": "artifact",
  "case_id": "C-20260403-001",
  "artifact_kind": "log",
  "title": "worker 重复消费日志",
  "source": {
    "uri": "log://worker/prod/2026-04-03T08:12:14+09:00",
    "external_ref": "trace-abc-span-7"
  },
  "content_ref": "blob://sha256/....",
  "excerpt": "worker received duplicate message orderId=123 eventVersion=42",
  "captured_at": "2026-04-03T08:12:14+09:00",
  "about_entity_ids": ["ENT-worker", "ENT-queue"],
  "immutable": true,
  "metadata": {
    "env": "prod",
    "trace_id": "abc"
  }
}
```

### 关键约束

* append-only
* 不可原地改写
* 允许 redaction，但 redaction 也要记为事件
* 可去重，依据 digest/hash

---

## 6. Fact

这是从材料中抽出的**可引用原子陈述**。

我建议事实不要求“绝对客观”，但必须满足：

* 有来源
* 可定位
* 可复核
* 不带大段推断

### 推荐字段

```json
{
  "id": "F-021",
  "type": "fact",
  "case_id": "C-20260403-001",
  "statement": "worker 在同一 orderId 上处理了重复消息",
  "fact_kind": "direct_observation",
  "polarity": "positive",
  "status": "active",
  "source_artifact_ids": ["A-013"],
  "about_entity_ids": ["ENT-worker", "ENT-queue"],
  "time_window": {
    "start": "2026-04-03T08:12:14+09:00",
    "end": "2026-04-03T08:12:14+09:00"
  },
  "confidence": "high"
}
```

### `fact_kind` 建议

* `direct_observation`
* `aggregate_observation`
* `test_result`
* `absence_observation`
* `manual_report`

### 一个很重要的规则

如果 `polarity = negative`，也就是“没观察到某东西”，必须强制要求：

* 查询范围
* 时间窗口
* 搜索条件

否则 agent 会滥用“没看到日志”这种伪证据。

例如：

```json
{
  "statement": "在 trace=abc 的时间窗口内未观察到 cache invalidation 调用",
  "fact_kind": "absence_observation",
  "polarity": "negative",
  "observation_scope": {
    "query": "trace_id=abc AND service=order-write-api AND event=cache_invalidate",
    "window": "2026-04-03T08:12:00+09:00 ~ 2026-04-03T08:13:00+09:00"
  }
}
```

---

## 7. Hypothesis

这是竞争解释的核心。

### 推荐字段

```json
{
  "id": "H-03",
  "type": "hypothesis",
  "case_id": "C-20260403-001",
  "inquiry_id": "IQ-01",
  "title": "重复消费导致状态回滚",
  "statement": "worker 重复消费旧版本消息，导致 DB 状态被较旧事件覆盖，随后读路径缓存旧值",
  "level": "mechanism",
  "status": "active",
  "confidence": "medium",
  "explains_symptom_ids": ["S-01"],
  "about_entity_ids": ["ENT-worker", "ENT-queue", "ENT-order-db", "ENT-order-status-cache"],
  "falsification_criteria": [
    "若禁用队列重放后仍复现，则该假设显著削弱",
    "若 DB 中最终写入版本单调递增且无回退，则该假设不成立"
  ],
  "depends_on_hypothesis_ids": [],
  "depends_on_fact_ids": ["F-021"]
}
```

### `level` 建议

* `phenomenon`
* `mechanism`
* `trigger`
* `root_cause`

### `status` 建议

* `proposed`
* `active`
* `favored`
* `weakened`
* `rejected`
* `confirmed`

### 一个关键建议

v1 的 `confidence` 用枚举，不要用浮点数。

建议：

* `low`
* `medium`
* `high`

因为 v1 的数值置信度很容易形成伪精确感。

---

## 8. Experiment

这是“办案循环”的推进器。

### 它不是随手动作记录，而是**有区分力的验证计划**

### 推荐字段

```json
{
  "id": "E-07",
  "type": "experiment",
  "case_id": "C-20260403-001",
  "inquiry_id": "IQ-01",
  "title": "绕过队列重放验证状态回退机制",
  "objective": "区分重复消费解释与缓存失效解释",
  "method": "reproduction",
  "status": "planned",
  "tests_hypothesis_ids": ["H-03", "H-04"],
  "about_entity_ids": ["ENT-worker", "ENT-queue", "ENT-order-status-cache"],
  "expected_outcomes": [
    {
      "if": "H-03 true",
      "expect": "绕过队列后旧状态不再出现"
    },
    {
      "if": "H-04 true",
      "expect": "绕过队列后旧状态仍出现"
    }
  ],
  "cost": "medium",
  "risk": "low",
  "change_intent": "probe"
}
```

### `method` 建议

* `search`
* `instrumentation`
* `reproduction`
* `compare_versions`
* `fault_injection`
* `binary_search`
* `test_run`
* `patch_probe`

### 关于“打日志复现”

我建议明确把它纳入 `Experiment`，而不是临时动作。

尤其建议区分 `change_intent`：

* `none`
* `instrumentation`
* `probe`

不要把最终修复也混进 experiment。

---

## 9. Gap

表示关键未知点。

### 推荐字段

```json
{
  "id": "G-02",
  "type": "gap",
  "case_id": "C-20260403-001",
  "title": "为什么只影响部分订单？",
  "question": "为何问题只在高并发订单中出现，低流量时基本不可复现？",
  "status": "open",
  "priority": "high",
  "blocked_node_ids": ["H-03", "H-04"],
  "about_entity_ids": ["ENT-queue", "ENT-worker"]
}
```

### 状态建议

* `open`
* `in_progress`
* `blocked`
* `resolved`
* `waived`

---

## 10. Residual

表示**仍解释不了的部分**。

### 推荐字段

```json
{
  "id": "R-01",
  "type": "residual",
  "case_id": "C-20260403-001",
  "title": "tenant 特异性未解释",
  "statement": "当前假设不能解释为何 tenant A 复现概率显著高于其他 tenant",
  "status": "open",
  "severity": "medium",
  "related_symptom_ids": ["S-01"],
  "about_entity_ids": ["ENT-tenant-A"]
}
```

### 状态建议

* `open`
* `reduced`
* `resolved`
* `accepted`

`accepted` 表示“已知有残差，但不阻塞当前修复判断”，必须附理由。

---

## 11. Decision

Decision 不是随便记个 note。
它是正式的**裁决节点**。

### 典型类型

* 关闭某条侦查线
* 提升某个假设优先级
* 进入补证据阶段
* 准备打 patch
* 宣告根因成立
* 接受某个 residual
* 关闭案件

### 推荐字段

```json
{
  "id": "D-05",
  "type": "decision",
  "case_id": "C-20260403-001",
  "title": "进入修复准备",
  "decision_kind": "ready_to_patch",
  "statement": "重复消费导致状态回退的机制已获得足够支持，可进入修复与验证阶段",
  "status": "active",
  "supporting_fact_ids": ["F-021", "F-034"],
  "supporting_experiment_ids": ["E-07"],
  "affected_node_ids": ["H-03"],
  "residual_handling": {
    "open_residual_ids": ["R-01"],
    "accepted": false
  }
}
```

---

# 四、边类型设计

我建议 v1 只保留少数高价值边，避免图过度复杂。

| 边类型             | 源                          | 目标                             | 含义         |
| --------------- | -------------------------- | ------------------------------ | ---------- |
| `contains`      | Case/Inquiry               | 节点                             | 归属关系       |
| `about`         | 任意节点                       | Entity                         | 关联到系统位点    |
| `evidences`     | Artifact                   | Fact                           | 原始材料支持该事实  |
| `supports`      | Fact                       | Hypothesis                     | 事实支持假设     |
| `contradicts`   | Fact                       | Hypothesis                     | 事实削弱假设     |
| `explains`      | Hypothesis                 | Symptom                        | 该假设解释该现象   |
| `depends_on`    | Hypothesis                 | Hypothesis/Fact                | 该假设依赖另一前提  |
| `tests`         | Experiment                 | Hypothesis                     | 实验用于验证假设   |
| `produces`      | Experiment                 | Artifact/Fact                  | 实验生成了材料/事实 |
| `blocks`        | Gap                        | Hypothesis/Decision/Experiment | 该缺口阻塞判断    |
| `addresses`     | Experiment/Fact/Hypothesis | Gap/Residual                   | 该动作在处理该问题  |
| `unresolved_by` | Residual                   | Hypothesis                     | 该假设仍不能解释残差 |
| `supersedes`    | Hypothesis/Decision/Fact   | 同类节点                           | 新版本替代旧版本   |

---

# 五、非常关键的一点：不要暴露通用图写操作

这个是产品成败点之一。

## 不要有

* `create_node`
* `create_edge`
* `update_edge`
* `delete_node`

## 应该只有领域命令

因为只有这样，系统才能在写入前做规则检查。

---

# 六、推荐的操作集

我把它分成 3 类：

* 写命令
* 读命令
* 守卫命令

---

## A. 写命令

---

### 1. `case.open`

创建案件。

#### 输入最小字段

* `title`
* `objective`
* `severity`

#### 作用

* 建立 `Case`
* 自动创建默认 `Inquiry`

---

### 2. `inquiry.open`

创建一条侦查线。

#### 输入

* `case_id`
* `title`
* `question`
* `scope_entity_ids`

#### 约束

* 必须围绕一个明确问题
* 不允许“万能 inquiry”

---

### 3. `entity.register`

登记系统上下文位点。

#### 输入

* `entity_kind`
* `name`
* `locator`

#### 作用

* 给症状、证据、假设挂接上下文

---

### 4. `symptom.report`

登记现象。

#### 输入

* `statement`
* `severity`
* `critical`
* `reproducibility`
* `environment`
* `affected_entity_ids`

#### 约束

* 不能带根因判断
* 不能写“因为 xxx 导致”

---

### 5. `artifact.attach`

附加原始材料。

#### 输入

* `artifact_kind`
* `source`
* `content_ref` 或 `excerpt`
* `about_entity_ids`

#### 约束

* append-only
* 不可直接修改内容
* 允许 redaction 但需生成新事件

---

### 6. `fact.assert`

登记原子事实。

#### 输入

* `statement`
* `fact_kind`
* `source_artifact_ids`
* `about_entity_ids`
* `polarity`

#### 强校验

* 至少有一个来源
* `negative` 事实必须提供 `observation_scope`
* 不能直接引用假设作为来源

---

### 7. `hypothesis.propose`

提出假设。

#### 输入

* `statement`
* `level`
* `explains_symptom_ids`
* `about_entity_ids`
* `falsification_criteria`

#### 强校验

* 至少解释一个 `Symptom`
* 至少有一个证伪条件
* 不能用“已确认根因”这类措辞作为初始状态

---

### 8. `hypothesis.update_status`

更新假设状态。

#### 输入

* `hypothesis_id`
* `new_status`
* `reason_fact_ids`
* `reason_experiment_ids`

#### 强校验

* `confirmed` 必须有支持事实或实验
* `rejected` 必须有反证
* 不能无依据改变状态

---

### 9. `experiment.plan`

规划验证动作。

#### 输入

* `objective`
* `method`
* `tests_hypothesis_ids`
* `expected_outcomes`
* `cost`
* `risk`

#### 强校验

* 必须至少关联一个假设
* 必须写清预期差异
* 不能只是“再看看日志”

---

### 10. `experiment.record_result`

记录实验结果。

#### 输入

* `experiment_id`
* `status`
* `produced_artifact_ids`
* `produced_fact_ids`
* `summary`

#### 强校验

* `completed` 不能没有结果材料，除非显式标记 `inconclusive`
* 结果不能自动改写假设状态，需单独调用 `hypothesis.update_status`

这条分离很重要。
它能防止“实验完成 = 结论成立”的短路。

---

### 11. `gap.open`

登记关键未知。

#### 输入

* `question`
* `blocked_node_ids`
* `priority`

---

### 12. `gap.resolve`

关闭缺口。

#### 输入

* `gap_id`
* `resolution_fact_ids` 或 `resolution_experiment_ids`
* `status=resolved|waived`

#### 强校验

* `waived` 必须有理由

---

### 13. `residual.open`

登记残差。

#### 输入

* `statement`
* `related_symptom_ids`
* `severity`

---

### 14. `residual.update`

更新残差状态。

#### 输入

* `residual_id`
* `new_status`
* `reason_fact_ids` / `reason_hypothesis_ids`

#### 强校验

* `accepted` 必须附接受理由
* `resolved` 必须说明被什么解释掉了

---

### 15. `decision.record`

记录裁决。

#### 输入

* `decision_kind`
* `statement`
* `supporting_fact_ids`
* `supporting_experiment_ids`
* `affected_node_ids`

#### 强校验

* 所有 decision 都必须有 citation
* 不允许“空心决策”

---

### 16. `inquiry.close`

关闭侦查线。

#### 输入

* `inquiry_id`
* `reason`
* `resolution_kind`

#### `resolution_kind`

* `rejected`
* `merged`
* `deprioritized`
* `resolved`

---

### 17. `case.advance_stage`

推进案件阶段。

#### 强校验

例如：

* 没有 symptom 不能进入 hypothesis 阶段
* 没有 active hypothesis 不能进入 discriminative testing
* 没有足够支持不能进入 repair_preparation

---

## B. 读命令

这些命令给 agent 提供当前局面，不替它做判断。

---

### 1. `case.snapshot`

返回案件驾驶舱。

建议包含：

* 当前 stage
* critical symptoms
* active inquiries
* active hypotheses
* open gaps
* open residuals
* 最近实验
* 最近 decision
* guardrail warnings

---

### 2. `case.graph_slice`

按范围读取图的一部分。

#### 支持维度

* 按 inquiry
* 按 entity
* 按 symptom
* 按 hypothesis
* 按 time range

---

### 3. `case.timeline`

读取事件时间线。

适合 agent 回顾过去做过什么，防止重试同一路子。

---

### 4. `hypothesis.panel`

返回某个假设的完整面板：

* 支持事实
* 反驳事实
* 关联实验
* 证伪条件
* 未解释残差
* 当前状态

---

### 5. `coverage.report`

返回证据覆盖情况。

例如：

* 哪些 entity 有直接 evidence
* 哪些只有间接推断
* 哪些完全空白

这很适合 anti-loop。

---

## C. 守卫命令

这是你产品真正体现“约束力”的地方。

---

### 1. `guardrail.check`

返回结构性违规和流程性风险。

#### 检查项建议

* 有没有无来源 fact
* 有没有无证伪条件 hypothesis
* 有没有无 citation decision
* 有没有 open critical residual
* 有没有被阻塞但长期未处理的 gap
* 有没有 inquiry 活跃假设过多

---

### 2. `stall.check`

检测空转。

#### 规则建议

* 连续 N 步没有新 fact
* 连续 N 步没有关闭分支
* 连续 N 步 hypothesis 状态无变化
* 连续 N 步都围绕同一 entity/同一 inquiry 打转
* 连续 N 次实验都不区分任何假设

返回结果类似：

```json
{
  "stall_risk": "high",
  "signals": [
    "same_inquiry_revisited_4_times",
    "no_new_fact_in_last_5_events",
    "active_hypothesis_count=5"
  ]
}
```

---

### 3. `ready_to_patch.check`

这是非常重要的门禁。

#### 返回 pass/fail，不替 agent 决策

### 建议通过条件

* 至少一个 `Hypothesis` 为 `favored` 或 `confirmed`
* 所有 critical symptom 都被覆盖
* 没有 open critical gap 阻塞该假设
* 没有 open critical residual 未处理
* 至少一个关键 experiment 已完成
* 拟修复目标 entity 已明确

返回示例：

```json
{
  "pass": false,
  "reasons": [
    "critical residual R-01 still open",
    "no discriminative experiment completed for H-03"
  ]
}
```

---

### 4. `case.close.check`

检查是否满足结案条件。

建议条件：

* 修复验证事实已存在
* critical symptom 已 resolved
* open inquiry 已关闭或归并
* residual 已 resolved 或 accepted
* case stage 在 validating/repair_validation

---

# 七、建议的强校验规则

这是系统真正能“约束 agent”的部分。

---

## 1. Fact 必须有来源

没有 `source_artifact_ids` 的事实直接拒绝写入。

---

## 2. Negative fact 必须有观测范围

例如“没看到异常日志”，必须附：

* 搜索条件
* 时间窗口
* 观察范围

---

## 3. Hypothesis 必须可证伪

没有 `falsification_criteria` 的假设直接拒绝。

---

## 4. Experiment 必须有区分力

没有 `expected_outcomes` 的实验计划直接拒绝。

---

## 5. Decision 必须有 citation

没有 supporting facts/experiments 的 decision 直接拒绝。

---

## 6. 不能直接写“因果边”

所有因果故事都必须先进入 `Hypothesis`。

---

## 7. Artifact append-only

不允许原地改写 evidence。

---

## 8. 关闭 residual / gap 必须说明原因

`resolved` 或 `accepted/waived` 都必须有支撑。

---

## 9. 不能无限堆 active hypothesis

建议每条 inquiry 默认警告阈值：

* active hypothesis > 3 发警告
* > 5 直接高风险

---

## 10. 状态变更必须有因

特别是：

* `Hypothesis.confirmed`
* `Case.ready_to_patch`
* `Case.closed`

这三个必须非常严格。

---

# 八、我建议的最小状态机

---

## Case

`active -> ready_to_patch -> validating -> closed`

允许：

* `active -> blocked`
* `blocked -> active`

---

## Inquiry

`open -> paused -> open`
`open -> closed`
`open -> merged`

---

## Hypothesis

`proposed -> active -> favored`
`active -> weakened`
`active/favored -> rejected`
`favored -> confirmed`

---

## Experiment

`planned -> running -> completed`
`planned/running -> inconclusive`
`planned/running -> canceled`

---

## Gap

`open -> in_progress -> resolved`
`open/in_progress -> blocked`
`open/in_progress -> waived`

---

## Residual

`open -> reduced -> resolved`
`open/reduced -> accepted`

---

# 九、一个我很推荐的底层实现：事件流 + 投影图

虽然你现在重点是模型和操作集，但这个决定会影响建模质量。

## 推荐底层有两层

### 1. 事件表 `investigation_events`

每次命令写入一条事件：

* `symptom_reported`
* `artifact_attached`
* `fact_asserted`
* `hypothesis_proposed`
* `experiment_planned`
* `experiment_result_recorded`
* `decision_recorded`

### 2. 当前态投影

按事件流生成：

* 节点表
* 边表
* dashboard view
* guardrail view

这样做的原因不是为了炫技，而是因为：

* 办案过程天然需要时间线
* 你要检测 stall 和重复论证
* 你要回溯“这个状态怎么来的”
* 多 session / 多 agent 也更稳

---

# 十、建议的 MCP 工具设计风格

如果最终你给 agent 暴露的是 MCP 工具，我建议每个命令都返回统一结果。

```json
{
  "ok": true,
  "event_id": "EV-104",
  "created_ids": ["F-021"],
  "updated_ids": [],
  "warnings": [],
  "violations": [],
  "snapshot_delta": {
    "active_hypotheses": 2,
    "open_gaps": 1,
    "open_residuals": 1
  }
}
```

如果失败：

```json
{
  "ok": false,
  "error_code": "HYPOTHESIS_MISSING_FALSIFIER",
  "message": "Hypothesis must provide at least one falsification criterion",
  "violations": [
    {
      "rule": "hypothesis_falsifiable_required",
      "severity": "error"
    }
  ]
}
```

这样 agent 能明确感受到约束，而不是把工具当记事本。

---

# 十一、一个最小但够用的 v1 操作集

为与主技术方案保持一致，MVP 在命令面、资源面和守卫面冻结为以下最小可用清单。

## 写命令

1. `investigation.case.open`
2. `investigation.case.advance_stage`
3. `investigation.inquiry.open`
4. `investigation.inquiry.close`
5. `investigation.entity.register`
6. `investigation.symptom.report`
7. `investigation.artifact.attach`
8. `investigation.fact.assert`
9. `investigation.hypothesis.propose`
10. `investigation.hypothesis.update_status`
11. `investigation.experiment.plan`
12. `investigation.experiment.record_result`
13. `investigation.gap.open`
14. `investigation.gap.resolve`
15. `investigation.residual.open`
16. `investigation.residual.update`
17. `investigation.decision.record`

MVP 不新增独立的 `investigation.case.close` tool。结案流程固定为：

1. `investigation.guardrail.close_case_check`
2. `investigation.decision.record(decisionKind=close_case)`
3. `investigation.case.advance_stage(stage=closed)`

## 读资源

1. `investigation://profile`
2. `investigation://cases`
3. `investigation://cases/{caseId}/snapshot`
4. `investigation://cases/{caseId}/timeline`
5. `investigation://cases/{caseId}/graph`
6. `investigation://cases/{caseId}/coverage`
7. `investigation://cases/{caseId}/hypotheses/{hypothesisId}`
8. `investigation://cases/{caseId}/inquiries/{inquiryId}`
9. `investigation://cases/{caseId}/diff`

## 守卫命令

1. `investigation.guardrail.check`
2. `investigation.guardrail.stall_check`
3. `investigation.guardrail.ready_to_patch_check`
4. `investigation.guardrail.close_case_check`
4. `case.close.check`

这已经足够形成闭环。

---

# 十二、一个非常重要的设计选择：先不要做“自动生成边”

除了少数确定性边，尽量不要让系统自动脑补关系。

## 可以自动生成的

* `Artifact -> evidences -> Fact`
* `Experiment -> produces -> Artifact/Fact`
* `Case/Inquiry -> contains -> Node`
* `Node -> about -> Entity`

## 不要自动生成的

* `Hypothesis A competes_with Hypothesis B`
* `Fact A supports Hypothesis B`（除非显式写入）
* `Entity X causes Symptom Y`

因为你这个产品的价值在于**约束 agent 显式表达推理**，不是替它补全图。

---

# 十三、一个小示例：完整操作流

下面这个例子能体现模型是否顺手。

---

## Step 1：报告现象

`symptom.report`

* “支付成功后详情页偶发仍显示 pending”

---

## Step 2：挂原始材料

`artifact.attach`

* worker 日志
* trace span
* 某次复现的 HTTP 响应
* 配置快照

---

## Step 3：抽事实

`fact.assert`

* “同一 orderId 上出现重复消息消费”
* “cache invalidation 未在 trace=abc 中出现”
* “只在高并发订单中观察到此现象”

---

## Step 4：提出两个竞争假设

`hypothesis.propose`

* H1：重复消费导致状态回退
* H2：缓存失效漏触发导致旧读

---

## Step 5：登记 gap

`gap.open`

* “为什么只在高并发订单触发？”

---

## Step 6：规划实验

`experiment.plan`

* 绕过队列验证是否仍出现旧状态
* 补 instrumentation 记录 invalidation 调用

---

## Step 7：记录结果

`experiment.record_result`

* 生成新的 artifact/fact

---

## Step 8：更新假设状态

`hypothesis.update_status`

* H1 favored
* H2 weakened

---

## Step 9：记录残差

`residual.open`

* “tenant A 特异性尚未解释”

---

## Step 10：修复门禁

`ready_to_patch.check`

* 若仍有 critical residual/gap，则不放行

---

# 十四、我对 v1 的最终建议

如果目标是“约束 agent 像破案一样工作”，那 v1 最应该抓住的是这 5 件事：

## 1. 用 `Artifact -> Fact -> Hypothesis -> Experiment -> Decision` 作为主链

这是核心骨架。

## 2. 把 `Gap` 和 `Residual` 做成一等对象

这是防止“自我说服”的关键。

## 3. 加入 `Inquiry`

这是防止大图失控的关键。

## 4. 底层用事件流，而不是直接改图

这是防止状态漂移和方便审计的关键。

## 5. 只暴露领域命令，不暴露通用图编辑

这是让工具真正有约束力的关键。

---

下一步最合适的是：我直接把这套模型整理成一版 **MCP tool schema + JSON Schema**，包括每个命令的请求/响应结构与校验规则。


---

## Part 2：MCP-native Investigation Server 与标准栈

可以，按“agent 行业通用标准”推进，我建议把这个产品定义为：

# **MCP-native Investigation Server**

内部以**事件流**为真相源，以**办案图投影**为工作视图；对外首先作为 **MCP Server** 提供工具、资源和可选 prompts；需要跨 agent 远程协作时，再加一层 **A2A façade**。这套拆法最贴合当前开源标准的职责边界：MCP 负责 agent 与工具/上下文的标准接入，A2A 负责独立 agent 系统之间的互操作，OpenTelemetry 负责观测，W3C PROV 负责 provenance/溯源表达。([模型上下文协议][1])

## 1. 标准栈怎么选

我建议你不要追求“一个标准包打天下”，而是采用组合式标准栈：

### 接入层：**MCP**

MCP 现在最适合作为你这个产品的**主入口标准**。它使用 JSON-RPC 2.0，要求初始化时做 capability negotiation，标准传输包括 **stdio** 和 **Streamable HTTP**；Server 侧的核心原语就是 **tools / resources / prompts**，另外还有 progress、cancellation、error reporting、logging 这些实用能力。对你的产品而言，这意味着：

* **写操作**放在 tools
* **读状态**放在 resources
* **流程脚手架**可选放在 prompts
* 长实验、补采样、复现这类动作可以直接复用 progress/cancel/logging 能力。([模型上下文协议][1])

### 跨 agent 互操作层：**A2A（可选，不是 v1 核心）**

A2A 的定位是“**独立 agent 系统之间**的互操作”，规范里强调 capability discovery 和 agent card；官方示例里 agent card 暴露在 `/.well-known/agent-card.json`。这很适合你的系统在第二阶段作为一个“案件管理 agent”被别的 orchestrator 或远程 agent 发现、委托和调用，但它不应取代 MCP 作为 v1 的工具接入面。你的核心需求是“给单个 coding agent 一个强约束办案工具”，本质上更像 **agent-to-tool**，不是 **agent-to-agent**。([A2A Protocol][2])

### 观测层：**OpenTelemetry**

OpenTelemetry 定义了 traces、metrics、logs 等统一采集/导出体系，Collector 是 vendor-agnostic 的 receive/process/export 组件；同时，semantic conventions 提供跨 traces、metrics、logs、profiles、resources 的统一命名约定。你的系统非常适合把每次工具调用、状态迁移、门禁检查、卡死检测都打成标准化 OTel span/log/metric。([OpenTelemetry][3])

### 溯源/证据交换层：**W3C PROV-DM / PROV-O**

PROV-DM 的核心是 **Entity / Activity / Agent**，并且有 **Bundle** 来承载 provenance of provenance；PROV-O 则提供可交换的 ontology 表达。你的“办案图”天然可以映射到这套语义上：证据、假设、结论是实体；实验、状态变更、事实断言是活动；agent / 用户 / 工具执行体是 agent。这样做的好处不是为了 RDF，而是为了**导出、审计、互操作**时不用发明一套孤立语言。([W3C][4])

### 事件封装层：**CloudEvents**

CloudEvents 的定位就是“以统一方式描述事件数据”，并且有多语言 SDK。这很适合做你的**事件日志封装**：每次 `fact.asserted`、`hypothesis.proposed`、`experiment.completed` 都可以先写成 CloudEvent，再投影为当前办案图。([CloudEvents][5])

### Schema / 控制面：**JSON Schema 2020-12 + OpenAPI**

JSON Schema 当前版本是 2020-12；OpenAPI 官方已经发布 3.2 的 schema。我的建议是：

* **MCP 工具入参/出参**：JSON Schema 2020-12
* **非 MCP 的 HTTP 控制面 / 管理面 / 导出 API**：OpenAPI 3.2
  这样 schema、校验、代码生成、文档都能落到现成生态上。([JSON Schema][6])

---

## 2. 产品形态，按标准落地后应该长什么样

我建议产品化形态固定成四层：

### 第一层：**本地/远程 MCP Server**

这是主产品面。
它向 agent 暴露：

* **Tools**：命令式写操作
* **Resources**：只读状态视图
* **Prompts**：可选的办案工作流模板

MCP 资源本身就是 URI 标识的；因此你完全可以定义自有资源 URI，比如：

* `investigation://cases/{caseId}`
* `investigation://cases/{caseId}/snapshot`
* `investigation://cases/{caseId}/graph`
* `investigation://cases/{caseId}/timeline` ([模型上下文协议][7])

### 第二层：**事件流内核**

所有变更先写事件，不直接改图。
建议事件总线里的 envelope 统一用 CloudEvents，业务 payload 用 JSON Schema。这样你同时拿到：

* append-only 审计
* 可回放
* 可重建图
* 可算 stall / deadloop / branch coverage

### 第三层：**办案图投影**

这是 agent 读到的工作状态，不是事实源。
它是从事件流投影出来的“当前案件视图”。

### 第四层：**可选 A2A façade**

只有当你要把这个系统包装成“独立案件处理 agent”，供别的 agent 发现和委托时，再暴露 A2A Agent Card 与 A2A endpoint。这个层是 phase 2，不是 MVP 必需。([A2A Protocol][2])

---

## 3. 按标准重写你的对象模型

我建议内部仍然保留你自己的领域模型，但给它一个**标准映射层**。

### 领域对象

你的领域对象保持这 10 类即可：

* `Case`
* `Inquiry`
* `Entity`
* `Symptom`
* `Artifact`
* `Fact`
* `Hypothesis`
* `Experiment`
* `Gap`
* `Residual`
* `Decision`

### 对 PROV 的映射

推荐这样映射：

* `Artifact` → `prov:Entity`
* `Fact` → `inv:Fact`，语义上视作 `prov:Entity`
* `Hypothesis` → `inv:Hypothesis`，语义上视作 `prov:Entity`
* `Residual` / `Gap` / `Decision` → 自定义类，语义上视作 `prov:Entity`
* `Experiment` → `prov:Activity`
* `fact.assert` / `hypothesis.update_status` / `decision.record` → `prov:Activity`
* `agent` / `user` / `adapter` / `tool-runner` → `prov:Agent`
* `Case` 导出时可以作为一个 `prov:Bundle` 或 `Bundle-like export unit`

这个做法的关键点是：**内部对象名按你的产品语义定义，外部交换时投影到 PROV**。这样不会被 PROV 绑死，但能拿到互操作性。PROV-DM/PROV-O 本身就鼓励 domain-specific specialization。([W3C][4])

### 统一对象包头

所有领域对象都用同一个最小公共头：

```json
{
  "$schema": "https://example.com/schemas/investigation/fact/1-0-0.schema.json",
  "schemaVersion": "1.0.0",
  "kind": "investigation.fact",
  "id": "F-021",
  "caseId": "C-20260404-001",
  "createdAt": "2026-04-04T10:00:00+09:00",
  "createdBy": {
    "actorType": "agent",
    "actorId": "claude-code",
    "sessionId": "sess-001"
  }
}
```

这里的 schema 用 JSON Schema 2020-12；`kind` 作为稳定类型判别；`schemaVersion` 用 semver。([JSON Schema][6])

---

## 4. MCP 面怎么设计

这里最重要的结论是：

# **对 agent 暴露命令，不暴露通用图 CRUD**

这点不只是产品偏好，而是为了保持“工具约束力”。
因此 MCP 面应拆成三类：

### A. Tools：只暴露命令式写操作

建议命名空间用点号分层，符合 MCP 工具名约束。MCP 对工具名给出了格式建议：名称应唯一，长度和字符集有限制，点号/下划线/连字符都在常见兼容范围内。([模型上下文协议][8])

建议的核心 tool 集：

```text
investigation.case.open
investigation.case.advance_stage

investigation.inquiry.open
investigation.inquiry.close

investigation.entity.register
investigation.symptom.report
investigation.artifact.attach
investigation.fact.assert

investigation.hypothesis.propose
investigation.hypothesis.update_status

investigation.experiment.plan
investigation.experiment.record_result

investigation.gap.open
investigation.gap.resolve
investigation.residual.open
investigation.residual.update

investigation.decision.record

investigation.guardrail.check
investigation.guardrail.stall_check
investigation.guardrail.ready_to_patch_check
investigation.guardrail.close_case_check
```

### B. Resources：只暴露只读状态

资源天然适合做快照、图切片、时间线、覆盖率报告。MCP 资源本来就是“给 AI 模型使用的上下文数据”，并支持列表、读取、资源模板，以及可选订阅/变更通知。([模型上下文协议][7])

建议资源 URI：

```text
investigation://cases/{caseId}/snapshot
investigation://cases/{caseId}/timeline
investigation://cases/{caseId}/graph
investigation://cases/{caseId}/coverage
investigation://cases/{caseId}/hypotheses/{hypothesisId}
investigation://cases/{caseId}/inquiries/{inquiryId}
```

### C. Prompts：只做脚手架，不做推理替代

Prompts 在 MCP 里是“templated messages and workflows”。对你来说，它们只能是流程脚手架，例如：

* `investigation/start`
* `investigation/next_step`
* `investigation/close_branch`

但 Prompts 不是核心。核心仍然是工具与资源。([模型上下文协议][1])

---

## 5. 事件标准怎么定义

建议把所有写操作落成 CloudEvents。
典型事件类型：

```text
io.yourorg.investigation.case.opened
io.yourorg.investigation.symptom.reported
io.yourorg.investigation.artifact.attached
io.yourorg.investigation.fact.asserted
io.yourorg.investigation.hypothesis.proposed
io.yourorg.investigation.hypothesis.status_updated
io.yourorg.investigation.experiment.planned
io.yourorg.investigation.experiment.result_recorded
io.yourorg.investigation.gap.opened
io.yourorg.investigation.residual.opened
io.yourorg.investigation.decision.recorded
```

建议 envelope：

```json
{
  "specversion": "1.0",
  "id": "evt_01JQ...",
  "type": "io.yourorg.investigation.fact.asserted",
  "source": "mcp://investigation-server",
  "subject": "cases/C-20260404-001/facts/F-021",
  "time": "2026-04-04T10:00:00+09:00",
  "dataschema": "https://example.com/schemas/events/fact.asserted/1-0-0.schema.json",
  "data": {
    "caseId": "C-20260404-001",
    "factId": "F-021"
  }
}
```

CloudEvents 只负责通用 envelope；业务语义仍由你的 schema 决定。([CloudEvents][5])

---

## 6. 把“约束”写成标准化门禁，而不是靠 prompt 自觉

你的核心卖点不是“能看图”，而是“**能约束 agent 办案纪律**”。
所以应该把这些做成**一等 Tool**，而不是建议文本：

### 必须具备的门禁

* `investigation.guardrail.check`
* `investigation.guardrail.stall_check`
* `investigation.guardrail.ready_to_patch_check`
* `investigation.guardrail.close_case_check`

### 必须固化的规则

这些规则建议写进 schema 校验 + 运行时 guardrail：

1. `Fact` **必须**引用至少一个 `Artifact`
2. `negative Fact` **必须**带 observation scope
3. `Hypothesis` **必须**给出 falsification criteria
4. `Experiment` **必须**声明区分性预期结果
5. `Decision` **必须**引用 supporting facts / experiments
6. `critical residual` 未处理时，`ready_to_patch_check` **不得通过**
7. 不提供 `create_node` / `create_edge` 之类通用图编辑接口

这些不是现成互联网标准条文，而是基于 MCP/PROV 之上的**领域规范**。我的建议是把它们写成你自己的 `Investigation Conformance Profile 1.0`。这种做法和 MCP 自身的 capability / schema / lifecycle 设计风格是一致的。([模型上下文协议][9])

---

## 7. 安全和权限按 MCP 规范处理

这里不用自创。

### 本地模式

如果你走 **stdio transport**，MCP 官方建议本地 server 直接从环境或嵌入式库拿凭据，而不是强行套 HTTP 授权流程。([模型上下文协议][10])

### 远程模式

如果你走 **Streamable HTTP**，就按 MCP 的 authorization 文档接 **OAuth 2.1 / OIDC discovery**。MCP 明确把这类授权能力放在 transport level，并且在处理用户数据、审计、企业控制时强烈建议启用授权。([模型上下文协议][11])

### 安全原则

MCP 规范本身也明确强调：

* 用户同意与控制
* 数据隐私
* 工具安全
* human-in-the-loop

你的产品里所有**变更型工具**都应该默认可审计，且允许 host 做确认拦截。([模型上下文协议][1])

---

## 8. 观测标准要从第一天就上 OTel

建议所有 MCP tool call、resource read、guardrail decision 都生成 OTel span/log。
最小字段建议：

* `investigation.case_id`
* `investigation.inquiry_id`
* `investigation.node_kind`
* `investigation.command`
* `investigation.outcome`
* `investigation.guardrail_pass`
* `investigation.blocking_reason_count`

这些字段本身属于你的自定义语义，但命名方式应遵循 OTel semantic conventions 的思路：**统一、可跨信号复用**。实际采集/转发走 OTel Collector。([OpenTelemetry][3])

---

## 9. 我建议的“标准化产品边界”

把这件事压缩成一句话：

# **v1：MCP-first，CloudEvents-inside，OTel-by-default，PROV-exportable，A2A-optional**

更展开一点：

* **对 coding agents**：你是一个 MCP server
* **对企业平台**：你有 OpenAPI 管理面
* **对审计与交换**：你能导出 PROV-compatible case package
* **对 observability**：你输出 OTel telemetry
* **对远程多 agent**：你可选暴露 A2A 身份

这套边界最稳，因为它把“行业通用标准”按职责做了正交分层，没有把一个协议滥用成万能框架。([模型上下文协议][1])

---

## 10. 直接给你的落地结论

我会这样定版：

### 必选

* MCP
* JSON Schema 2020-12
* CloudEvents
* OpenTelemetry
* PROV-DM / PROV-O（至少导出层支持）

### 应选

* OpenAPI 3.2（管理面 / 导出面）

### 延后

* A2A façade
* 图数据库特化存储
* 富 UI 图谱工作770523


---

## Part 3：规范、Schema 与协议面


# 1. 规范包目录

我建议 repo 直接长这样：

```text
/spec
  profile.md
  conformance.md
  lifecycle.md
  domain-model.md
  mcp-surface.md
  events.md
  telemetry.md
  prov-export.md
  security.md
  versioning.md
  a2a-facade.md            # optional, phase 2

/schemas
  /common
    defs.schema.json
    base-node.schema.json
    base-command.schema.json
    command-result.schema.json
    actor-ref.schema.json
    observation-scope.schema.json
    citation.schema.json
    time-window.schema.json

  /domain/v1
    case.schema.json
    inquiry.schema.json
    entity.schema.json
    symptom.schema.json
    artifact.schema.json
    fact.schema.json
    hypothesis.schema.json
    experiment.schema.json
    gap.schema.json
    residual.schema.json
    decision.schema.json

  /commands/v1
    case.open.request.schema.json
    case.advance_stage.request.schema.json
    inquiry.open.request.schema.json
    inquiry.close.request.schema.json
    entity.register.request.schema.json
    symptom.report.request.schema.json
    artifact.attach.request.schema.json
    fact.assert.request.schema.json
    hypothesis.propose.request.schema.json
    hypothesis.update_status.request.schema.json
    experiment.plan.request.schema.json
    experiment.record_result.request.schema.json
    gap.open.request.schema.json
    gap.resolve.request.schema.json
    residual.open.request.schema.json
    residual.update.request.schema.json
    decision.record.request.schema.json

  /events/v1
    case.opened.data.schema.json
    symptom.reported.data.schema.json
    artifact.attached.data.schema.json
    fact.asserted.data.schema.json
    hypothesis.proposed.data.schema.json
    hypothesis.status_updated.data.schema.json
    experiment.planned.data.schema.json
    experiment.result_recorded.data.schema.json
    gap.opened.data.schema.json
    gap.resolved.data.schema.json
    residual.opened.data.schema.json
    residual.updated.data.schema.json
    decision.recorded.data.schema.json
    inquiry.closed.data.schema.json
    case.stage_advanced.data.schema.json

  /resources/v1
    profile.schema.json
    case-list.schema.json
    case.snapshot.schema.json
    case.timeline.schema.json
    case.graph.schema.json
    coverage.report.schema.json
    inquiry.slice.schema.json
    hypothesis.panel.schema.json
    case.diff.schema.json

/openapi
  control-plane.v1.yaml

/examples
  minimal-case/
  stale-read-case/
  queue-dup-case/

/tests
  /conformance
  /fixtures
```

这个目录的核心思想很简单：

* `spec/` 写**规范文字**
* `schemas/` 写**机器可校验的契约**
* `openapi/` 只负责**管理面**
* `examples/` 用来训练 agent 如何正确使用
* `tests/conformance/` 用来验证 host / server / adapter 没跑偏

---

# 2. 先定义一个“Profile”，不要只定义一堆 schema

建议你把产品规范名定成：

## **Investigation Profile 1.0**

它不是新协议，而是：

* 运行在 **MCP** 上
* 使用 **JSON Schema 2020-12**
* 内部事件建议用 **CloudEvents**
* 导出时支持 **PROV**
* 观测默认打 **OTel**

也就是说，这是一份**领域约束 profile**，不是另起炉灶造协议。

---

# 3. 领域模型：先定 11 个一等对象

## 必备对象

| 对象         | 角色       | 是否一等对象 |
| ---------- | -------- | ------ |
| Case       | 案件根对象    | 是      |
| Inquiry    | 侦查线 / 分支 | 是      |
| Entity     | 系统中的位点   | 是      |
| Symptom    | 现象       | 是      |
| Artifact   | 原始材料     | 是      |
| Fact       | 原子事实     | 是      |
| Hypothesis | 竞争解释     | 是      |
| Experiment | 区分性验证动作  | 是      |
| Gap        | 关键未知     | 是      |
| Residual   | 未解释残差    | 是      |
| Decision   | 裁决       | 是      |

## 强约束原则

这 6 条必须进 `conformance.md`：

1. `Artifact` 和 `Fact` 分层，不能混写
2. `Fact` 必须引用至少一个 `Artifact`
3. `Hypothesis` 必须有 `falsificationCriteria`
4. `Experiment` 必须至少测试一个 `Hypothesis`，并声明区分性预期结果
5. `Decision` 必须引用 supporting facts / experiments
6. `Gap`、`Residual` 是一等对象，不能退化成 note

---

# 4. 公共基类 schema

建议所有对象共用一个最小公共头。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/common/base-node.schema.json",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "kind",
    "id",
    "schemaVersion",
    "caseId",
    "revision",
    "createdAt",
    "createdBy"
  ],
  "properties": {
    "kind": {
      "type": "string",
      "pattern": "^investigation\\.[a-z_]+$"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "schemaVersion": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "revision": {
      "type": "integer",
      "minimum": 1
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "createdBy": {
      "$ref": "./actor-ref.schema.json"
    },
    "labels": {
      "type": "array",
      "items": { "type": "string" },
      "uniqueItems": true
    },
    "extensions": {
      "type": "object",
      "additionalProperties": true
    }
  }
}
```

### 为什么这样定

* `kind` 做类型判别
* `schemaVersion` 独立于 profile 版本
* `revision` 给 materialized view 用
* `id` 建议用 **ULID 风格**，天然按时间排序，便于事件流与对象表对齐
* `extensions` 预留 adapter-specific 字段，但不能污染主 schema

---

# 5. 关键对象 schema：只先把 4 个做硬

v1 不需要一次把 11 个对象都写满；最重要的是先把这 4 个做硬。

## 5.1 `artifact.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/artifact.schema.json",
  "allOf": [
    { "$ref": "../../common/base-node.schema.json" },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "artifactKind",
        "title",
        "source",
        "immutable"
      ],
      "properties": {
        "kind": { "const": "investigation.artifact" },
        "artifactKind": {
          "type": "string",
          "enum": [
            "log",
            "trace",
            "metric",
            "code_snippet",
            "config_snapshot",
            "test_output",
            "repro_script",
            "code_diff",
            "screenshot",
            "user_report"
          ]
        },
        "title": { "type": "string", "minLength": 1 },
        "source": {
          "type": "object",
          "additionalProperties": false,
          "required": ["uri"],
          "properties": {
            "uri": { "type": "string", "format": "uri" },
            "externalRef": { "type": "string" }
          }
        },
        "contentRef": { "type": "string" },
        "excerpt": { "type": "string" },
        "capturedAt": { "type": "string", "format": "date-time" },
        "aboutRefs": {
          "type": "array",
          "items": { "type": "string" },
          "uniqueItems": true
        },
        "immutable": { "const": true }
      },
      "oneOf": [
        { "required": ["contentRef"] },
        { "required": ["excerpt"] }
      ]
    }
  ]
}
```

## 5.2 `fact.schema.json`

这里要把“negative fact 必须带观测范围”写进 schema。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/fact.schema.json",
  "allOf": [
    { "$ref": "../../common/base-node.schema.json" },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "statement",
        "factKind",
        "polarity",
        "sourceArtifactIds"
      ],
      "properties": {
        "kind": { "const": "investigation.fact" },
        "statement": { "type": "string", "minLength": 1 },
        "factKind": {
          "type": "string",
          "enum": [
            "direct_observation",
            "aggregate_observation",
            "test_result",
            "absence_observation",
            "manual_report"
          ]
        },
        "polarity": {
          "type": "string",
          "enum": ["positive", "negative"]
        },
        "sourceArtifactIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^artifact_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "observationScope": {
          "$ref": "../../common/observation-scope.schema.json"
        },
        "aboutRefs": {
          "type": "array",
          "items": { "type": "string" },
          "uniqueItems": true
        }
      },
      "allOf": [
        {
          "if": {
            "properties": { "polarity": { "const": "negative" } },
            "required": ["polarity"]
          },
          "then": {
            "required": ["observationScope"]
          }
        }
      ]
    }
  ]
}
```

## 5.3 `hypothesis.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/hypothesis.schema.json",
  "allOf": [
    { "$ref": "../../common/base-node.schema.json" },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "title",
        "statement",
        "level",
        "status",
        "explainsSymptomIds",
        "falsificationCriteria"
      ],
      "properties": {
        "kind": { "const": "investigation.hypothesis" },
        "title": { "type": "string", "minLength": 1 },
        "statement": { "type": "string", "minLength": 1 },
        "level": {
          "type": "string",
          "enum": ["phenomenon", "mechanism", "trigger", "root_cause"]
        },
        "status": {
          "type": "string",
          "enum": [
            "proposed",
            "active",
            "favored",
            "weakened",
            "rejected",
            "confirmed"
          ]
        },
        "confidence": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "explainsSymptomIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^symptom_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "falsificationCriteria": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "minItems": 1
        },
        "dependsOnFactIds": {
          "type": "array",
          "items": { "type": "string" },
          "uniqueItems": true
        },
        "dependsOnHypothesisIds": {
          "type": "array",
          "items": { "type": "string" },
          "uniqueItems": true
        },
        "aboutRefs": {
          "type": "array",
          "items": { "type": "string" },
          "uniqueItems": true
        }
      }
    }
  ]
}
```

## 5.4 `experiment.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/experiment.schema.json",
  "allOf": [
    { "$ref": "../../common/base-node.schema.json" },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "kind",
        "title",
        "objective",
        "method",
        "status",
        "testsHypothesisIds",
        "expectedOutcomes"
      ],
      "properties": {
        "kind": { "const": "investigation.experiment" },
        "title": { "type": "string", "minLength": 1 },
        "objective": { "type": "string", "minLength": 1 },
        "method": {
          "type": "string",
          "enum": [
            "search",
            "instrumentation",
            "reproduction",
            "compare_versions",
            "fault_injection",
            "binary_search",
            "test_run",
            "patch_probe"
          ]
        },
        "status": {
          "type": "string",
          "enum": [
            "planned",
            "running",
            "completed",
            "inconclusive",
            "canceled"
          ]
        },
        "testsHypothesisIds": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1,
          "uniqueItems": true
        },
        "expectedOutcomes": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["if", "expect"],
            "properties": {
              "if": { "type": "string", "minLength": 1 },
              "expect": { "type": "string", "minLength": 1 }
            }
          },
          "minItems": 1
        },
        "changeIntent": {
          "type": "string",
          "enum": ["none", "instrumentation", "probe"]
        },
        "cost": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "risk": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        }
      }
    }
  ]
}
```

---

# 6. 其余 7 个对象先简化，不要过度工程化

v1 里其余对象只需要最小硬字段：

## `case`

* `title`
* `objective`
* `severity`
* `status`
* `stage`

## `inquiry`

* `title`
* `question`
* `status`
* `priority`
* `scopeRefs`

## `entity`

* `entityKind`
* `name`
* `locator`

## `symptom`

* `statement`
* `severity`
* `reproducibility`
* `affectedRefs`

## `gap`

* `question`
* `status`
* `priority`
* `blockedRefs`

## `residual`

* `statement`
* `status`
* `severity`
* `relatedSymptomIds`

## `decision`

* `decisionKind`
* `statement`
* `supportingFactIds`
* `supportingExperimentIds`

---

# 7. MCP 面：只暴露领域命令，不暴露图 CRUD

MCP 的当前官方模型明确把 `tools` 作为函数调用面，`resources` 作为上下文/数据读取面，`prompts` 作为模板化工作流；工具定义带 `inputSchema`，可选 `outputSchema`，如果提供了 `outputSchema`，服务端必须返回符合 schema 的结构化结果，客户端应做校验。工具名应唯一，建议只用字母、数字、下划线、连字符和点号，并避免空格等特殊字符；工具调用错误要区分 **JSON-RPC 协议错误** 和 `isError: true` 的**工具执行错误**。([模型上下文协议][1])

## 工具命名约定

全部用点号前缀：

```text
investigation.case.open
investigation.case.advance_stage

investigation.inquiry.open
investigation.inquiry.close

investigation.entity.register
investigation.symptom.report
investigation.artifact.attach
investigation.fact.assert

investigation.hypothesis.propose
investigation.hypothesis.update_status

investigation.experiment.plan
investigation.experiment.record_result

investigation.gap.open
investigation.gap.resolve
investigation.residual.open
investigation.residual.update

investigation.decision.record

investigation.guardrail.check
investigation.guardrail.stall_check
investigation.guardrail.ready_to_patch_check
investigation.guardrail.close_case_check
```

## 统一工具返回结构

建议所有写工具都返回同一结构，放在 `structuredContent` 里：

```json
{
  "ok": true,
  "eventId": "evt_01JQ...",
  "createdIds": ["fact_01JQ..."],
  "updatedIds": ["hypothesis_01JQ..."],
  "headRevisionBefore": 41,
  "headRevisionAfter": 42,
  "projectionScheduled": true,
  "warnings": [],
  "violations": [],
  "snapshotDelta": {
    "activeHypotheses": 2,
    "openGaps": 1,
    "openResiduals": 1
  }
}
```

错误时：

```json
{
  "ok": false,
  "errorCode": "HYPOTHESIS_MISSING_FALSIFIER",
  "message": "Hypothesis must provide at least one falsification criterion",
  "violations": [
    {
      "rule": "hypothesis_falsifiable_required",
      "severity": "error"
    }
  ]
}
```

### 设计要点

* **协议层错误**：只有参数结构不合法、工具名不存在、服务端异常时才返回 JSON-RPC error
* **业务层错误**：全部用 `isError: true` + 结构化可恢复信息
* 每个写命令都带 `idempotencyKey`
* 每个结果都带 `eventId`，便于和事件流、OTel span 对齐
* 对现有 case 的写命令必须带 `ifCaseRevision`，冲突时返回 `CASE_REVISION_CONFLICT` 与 `headRevision`

---

# 8. MCP Resources：读状态走资源，不走工具

MCP 资源支持 `resources/list`、`resources/read`、参数化 `resources/templates/list`，还可选支持 `subscribe` 与 `listChanged`。所以你的办案状态应该主要做成资源，而不是读工具。([模型上下文协议][2])

## 建议资源 URI

```text
investigation://profile
investigation://cases
investigation://cases/{caseId}/snapshot
investigation://cases/{caseId}/timeline
investigation://cases/{caseId}/graph
investigation://cases/{caseId}/coverage
investigation://cases/{caseId}/inquiries/{inquiryId}
investigation://cases/{caseId}/hypotheses/{hypothesisId}
investigation://cases/{caseId}/diff
```

其中 `investigation://cases` 是唯一合法的 Case List collection resource；MVP 不再单独暴露 `residuals` 或 `gaps` 资源 family，这些信息通过 snapshot、coverage、inspector 与 graph slice 暴露。

## 哪些资源支持订阅

建议只让下面 3 个支持 `subscribe`：

* `.../snapshot`
* `.../timeline`
* `.../graph`

因为它们最适合在长会话里增量刷新。

---

# 9. Prompts：有，但不是核心

Prompts 可以有，但只做**流程脚手架**：

```text
investigation.start_case
investigation.next_best_step
investigation.close_branch
investigation.prepare_patch
```

它们只负责生成“办案工作流提示”，**不承担状态写入**。
状态变更一律走 tool。

---

# 10. 事件层：CloudEvents 做 envelope，业务 schema 自己定

CloudEvents 的价值就在于它只统一事件 envelope，不强迫你把领域语义塞进某个现成模型里，非常适合做 append-only investigation log。([CloudEvents][3])

## 事件命名

```text
io.yourorg.investigation.case.opened
io.yourorg.investigation.symptom.reported
io.yourorg.investigation.artifact.attached
io.yourorg.investigation.fact.asserted
io.yourorg.investigation.hypothesis.proposed
io.yourorg.investigation.hypothesis.status_updated
io.yourorg.investigation.experiment.planned
io.yourorg.investigation.experiment.result_recorded
io.yourorg.investigation.gap.opened
io.yourorg.investigation.gap.resolved
io.yourorg.investigation.residual.opened
io.yourorg.investigation.residual.updated
io.yourorg.investigation.decision.recorded
io.yourorg.investigation.inquiry.closed
io.yourorg.investigation.case.stage_advanced
```

## 事件 envelope 示例

```json
{
  "specversion": "1.0",
  "id": "evt_01JQ9Y6M9F6P8J8B0YQ3F4A1M2",
  "type": "io.yourorg.investigation.fact.asserted",
  "source": "mcp://investigation-server",
  "subject": "cases/case_01JQ.../facts/fact_01JQ...",
  "time": "2026-04-04T10:42:31+09:00",
  "dataschema": "https://schemas.yourorg.ai/investigation/events/v1/fact.asserted.data.schema.json",
  "data": {
    "caseId": "case_01JQ...",
    "factId": "fact_01JQ...",
    "commandId": "cmd_01JQ...",
    "actor": {
      "actorType": "agent",
      "actorId": "claude-code",
      "sessionId": "sess_001"
    }
  }
}
```

## 事件流的硬规则

* append-only
* 不做 in-place update
* materialized view 可重建
* 所有写工具必须产生一个事件
* 读操作不产生事件，但要打 OTel

---

# 11. PROV 导出映射

W3C PROV-DM 本来就把 provenance 拆成 `Entity / Activity / Agent`，并且支持 `Bundle` 来表达 provenance of provenance；它是 domain-agnostic，并鼓励做 domain specialization。这个语义和你的产品天然契合。([W3C][4])

## 建议映射

| 领域对象                                                     | PROV 映射         |
| -------------------------------------------------------- | --------------- |
| Case                                                     | `prov:Bundle`   |
| Artifact                                                 | `prov:Entity`   |
| Fact                                                     | `prov:Entity`   |
| Hypothesis                                               | `prov:Entity`   |
| Gap / Residual / Decision                                | `prov:Entity`   |
| Experiment                                               | `prov:Activity` |
| fact.assert / hypothesis.update_status / decision.record | `prov:Activity` |
| user / agent / adapter / tool-runner                     | `prov:Agent`    |

## 推荐关系

* `Artifact -> Fact`：`prov:wasDerivedFrom`
* `Experiment -> Artifact/Fact`：`prov:generated`
* `Experiment -> Hypothesis`：`prov:used`
* `Decision -> supporting evidence`：`prov:used`
* `Agent -> command activity`：`prov:wasAssociatedWith`

### 重点

内部模型不要直接做 RDF-first。
**内部还是你的领域 JSON；导出时再投影到 PROV。**

---

# 12. OTel：从第一天就把“办案过程”打成观测数据

OpenTelemetry 官方定义了 semantic conventions，并提供了 Collector 作为 vendor-agnostic 的接收、处理、导出组件；Collector 本身就是为了统一 traces / metrics / logs 的入口。([OpenTelemetry][5])

## 我建议的最小 span/attr 约定

### Span 名称

```text
investigation.tool.call
investigation.resource.read
investigation.guardrail.evaluate
investigation.projection.rebuild
```

### Attributes

```text
investigation.case_id
investigation.inquiry_id
investigation.command
investigation.node_kind
investigation.node_id
investigation.outcome
investigation.guardrail_pass
investigation.violation_count
investigation.stall_risk
investigation.open_gap_count
investigation.open_residual_count
```

### Metrics

```text
investigation_commands_total
investigation_guardrail_failures_total
investigation_stall_checks_total
investigation_open_cases
investigation_active_hypotheses
investigation_open_gaps
investigation_open_residuals
```

---

# 13. OpenAPI 管理面：只放非 MCP 功能

OpenAPI 3.2.0 适合描述你的 HTTP 管理面，但不要和 MCP 工具面混在一起。([OpenAPI Initiative Publications][6])

## 管理面只做这些

* `GET /healthz`
* `GET /readyz`
* `GET /version`
* `GET /cases/{caseId}/export/prov`
* `GET /cases/{caseId}/export/events`
* `POST /admin/rebuild-projection`
* `POST /admin/reindex`
* `GET /metrics`

### 不要放进去的

* `fact.assert`
* `hypothesis.propose`
* `experiment.plan`

这些都应只通过 MCP tool 调用。

---

# 14. A2A façade：二期才做

A2A 的强项是 agent 发现、能力协商、任务协作和跨系统互操作；官方也明确把它和 MCP 定位为互补而不是替代。([A2A Protocol][7])

所以二期如果要做：

## 你暴露一个 A2A agent

* public agent card：`/.well-known/agent-card.json`
* skills：

  * `open_case`
  * `record_evidence`
  * `evaluate_readiness`
  * `export_case`

但注意：

* A2A 外层只做**委托和发现**
* 真正状态写入仍落到内部 MCP/事件流内核

---

# 15. 版本策略

我建议分 4 层版本，不要混成一个号：

## 1) Profile version

`Investigation Profile 1.0`

## 2) Domain schema version

每个 schema 单独 semver
例如：

* `fact.schema.json` = `1.0.0`
* `experiment.schema.json` = `1.1.0`

## 3) MCP surface version

通过 server capability / profile resource 暴露
例如：

```json
{
  "profile": "investigation-profile",
  "profileVersion": "1.0.0",
  "mcpSurfaceVersion": "1.0.0"
}
```

## 4) Event schema version

放在 `dataschema` URL，不放进 CloudEvent `type`

---

# 16. 建议的 Conformance Levels

这个很适合产品化，也方便后面做多家 adapter。

## Level 0 — Core Commands

* 所有写命令可用
* 基础 schema 校验
* 事件流可落盘

## Level 1 — Full MCP

* resources 可读
* guardrails 可用
* snapshot/graph/timeline 可用

## Level 2 — Audit & Export

* PROV 导出
* event export
* OTel 默认接入

## Level 3 — Interop

* A2A façade
* signed agent card
* remote deployment profile

---

# 17. v1 截止线

如果你要尽快做出第一版，我建议**只做这些**：

## 必做

* 11 个领域对象 schema
* 17 个变更型 MCP tools
* 4 个 guardrail / evaluation tools
* 9 个 resource family
* 15 类事件 schema / CloudEvents data payload
* 1 个 PROV export
* 1 套 OTel attrs

## 暂缓

* 富图形 UI
* 图数据库专用查询语言
* A2A façade
* 自动建议下一步实验
* 自动从日志抽事实

这能最大限度保持你的产品定位：**约束 agent 办案，而不是替 agent 办案**。

---

# Schema
下面直接给第一批 5 个文件的首版草案。
目标是：**先把“证据—假设—验证”这条主链钉死**，保证 MCP 工具面和领域对象面从一开始就是一致的。


## 1) `spec/profile.md`

```md
# Investigation Profile 1.0 (Draft)

## 1. 摘要

Investigation Profile 是一份运行在 MCP 之上的领域约束规范，用于约束 agent 以“办案”方式处理复杂问题。

本 Profile 的目标不是替 agent 自动完成侦破，而是提供：

- 案件状态持久化
- 证据与推断分层
- 办案流程约束
- 反死循环门禁
- 可审计、可回放、可导出的调查过程

## 2. 设计目标

本 Profile 必须支持以下能力：

1. 让 agent 显式记录：
   - 现象（Symptom）
   - 原始材料（Artifact）
   - 原子事实（Fact）
   - 假设（Hypothesis）
   - 验证动作（Experiment）
   - 关键未知（Gap）
   - 未解释残差（Residual）
   - 裁决（Decision）

2. 让每个高价值结论都能回指到证据。

3. 让 agent 的每一步动作都服务于：
   - 获取新证据
   - 区分竞争假设
   - 缩小调查范围
   - 关闭分支
   - 减少残差

4. 防止：
   - 将猜测写成事实
   - 重复验证同一路径
   - 未证伪的自我说服
   - 跳过门禁直接打 patch

## 3. 非目标

本 Profile 不负责：

- 自动从日志中抽取事实
- 自动生成假设
- 自动判断根因
- 自动修改代码
- 自动补全办案图中的推理关系

任何自动分析能力都应视为 Profile 之上的可选扩展，而不是核心能力。

## 4. 规范关键词

本文件中的以下词语具有规范性含义：

- **MUST**：必须
- **MUST NOT**：禁止
- **SHOULD**：应当
- **SHOULD NOT**：不应当
- **MAY**：可以

## 5. 运行时模型

### 5.1 总体架构

实现本 Profile 的系统应采用以下逻辑分层：

1. **MCP Surface**
   - Tools：命令式写操作
   - Resources：只读状态视图
   - Prompts：可选流程脚手架

2. **Event Log**
   - 所有写操作先写入 append-only 事件流
   - 事件流是真相源（source of truth）

3. **Materialized Projections**
   - 办案图
   - 案件快照
   - 时间线
   - 覆盖率报告
   - guardrail 视图

### 5.2 真相源

系统 **MUST** 以事件日志为真相源。  
系统 **MUST NOT** 直接把“当前图状态”作为唯一权威数据源。

### 5.3 读写分离

- 写：通过 MCP Tools
- 读：通过 MCP Resources
- Prompts：只能作为工作流模板，**MUST NOT** 改变状态

## 6. 核心领域对象

本 Profile 定义以下一等对象：

- `Case`
- `Inquiry`
- `Entity`
- `Symptom`
- `Artifact`
- `Fact`
- `Hypothesis`
- `Experiment`
- `Gap`
- `Residual`
- `Decision`

### 6.1 Case

Case 是根对象。  
所有节点都 **MUST** 归属于一个 Case。

### 6.2 Inquiry

Inquiry 表示一条侦查线。  
复杂案件中的假设、实验、缺口 **SHOULD** 尽量归属于具体 Inquiry，以避免单一大图失控。

### 6.3 Entity

Entity 表示系统中的位点，例如：

- service
- module
- file
- function
- db
- queue
- cache
- config
- tenant
- external dependency

Entity 是上下文对象，不是办案主语。

## 7. 强制约束

### 7.1 Artifact / Fact 分层

- `Artifact` 表示原始材料
- `Fact` 表示基于原始材料形成的可引用原子陈述

系统 **MUST NOT** 将原始材料和原子事实混为同一对象。

### 7.2 Fact 来源要求

`Fact` **MUST** 引用至少一个 `Artifact` 作为来源。  
没有来源的 `Fact` 必须被拒绝写入。

### 7.3 Negative Fact 要求

当 `Fact.polarity = negative` 时，系统 **MUST** 要求提供 `observationScope`。  
“没观察到某现象”只有在明确了观察范围后才是有效事实。

### 7.4 Hypothesis 可证伪要求

每个 `Hypothesis` **MUST** 至少提供一个 `falsificationCriteria`。  
不可证伪的假设不允许进入办案图。

### 7.5 Experiment 区分力要求

每个 `Experiment` **MUST** 至少测试一个 `Hypothesis`，并且 **MUST** 描述区分性预期结果。  
“再看看日志”“再跑一次”这类没有区分力的动作，不应视为合格 Experiment。

### 7.6 Decision 引用要求

每个 `Decision` **MUST** 至少引用一条 supporting `Fact` 或 supporting `Experiment`。  
没有证据支撑的 Decision 必须被拒绝写入。

### 7.7 Gap / Residual 一等对象要求

`Gap` 与 `Residual` **MUST** 是一等对象。  
实现 **MUST NOT** 仅以自由文本 note 的形式承载关键未知或未解释残差。

### 7.8 Artifact 不可变

`Artifact` **MUST** 被视为不可变对象。  
任何 redaction、替换、补充都 **MUST** 产生新事件，并应生成新对象或新 revision，而不是原地修改。

### 7.9 不暴露通用图 CRUD

实现本 Profile 的 MCP Surface **MUST NOT** 暴露通用图编辑接口，例如：

- `create_node`
- `update_node`
- `create_edge`
- `delete_edge`

实现 **MUST** 暴露领域命令式操作，例如：

- `investigation.fact.assert`
- `investigation.hypothesis.propose`
- `investigation.experiment.plan`

## 8. MCP Surface 约束

### 8.1 Tool 命名

Tool 名称 **SHOULD** 使用点号命名空间，例如：

- `investigation.case.open`
- `investigation.fact.assert`
- `investigation.guardrail.ready_to_patch_check`

### 8.2 Create 类命令

Create 类命令：

- **MUST NOT** 接受对象 ID 作为客户端输入
- **MUST** 由服务端生成对象 ID
- **SHOULD** 接受 `idempotencyKey`
- **SHOULD** 返回 `eventId`

### 8.3 业务错误与协议错误

- 参数结构错误、协议错误：走 MCP / JSON-RPC 错误
- 业务规则违规：应返回结构化业务错误

### 8.4 Resources

Resources 是只读视图。  
典型资源包括：

- `investigation://cases/{caseId}/snapshot`
- `investigation://cases/{caseId}/timeline`
- `investigation://cases/{caseId}/graph`
- `investigation://cases/{caseId}/coverage`

## 9. 事件模型

### 9.1 事件优先

所有写操作 **MUST** 先落事件。  
对象表和图视图应视为投影结果。

### 9.2 事件最小要求

每个写事件至少应包含：

- `eventId`
- `eventType`
- `caseId`
- `commandName`
- `actor`
- `occurredAt`
- `objectIds`

### 9.3 回放能力

实现 **SHOULD** 支持从事件流重建办案图和快照。

## 10. Guardrails

实现本 Profile 的系统至少 **SHOULD** 提供以下 guardrail：

- `guardrail.check`
- `guardrail.stall_check`
- `guardrail.ready_to_patch_check`
- `guardrail.close_case_check`

### 10.1 stall_check

`stall_check` 应至少检查：

- 最近 N 次写入是否没有新增 Fact
- 最近 N 次动作是否没有关闭任何分支
- 是否长期围绕同一 Inquiry 或同一 Entity 打转
- 活跃假设数是否过多
- 残差与缺口是否长期无变化

### 10.2 ready_to_patch_check

系统在允许进入 patch 准备阶段前，应至少检查：

- 是否存在 favored / confirmed 假设
- critical symptoms 是否被覆盖
- critical gaps 是否已处理
- critical residuals 是否已处理或被显式接受
- 至少一个关键实验是否已完成

## 11. 对象 ID 与版本

### 11.1 ID

对象 ID **SHOULD** 使用时间有序的唯一标识，例如 ULID 风格。

推荐前缀：

- `case_`
- `inquiry_`
- `entity_`
- `symptom_`
- `artifact_`
- `fact_`
- `hypothesis_`
- `experiment_`
- `gap_`
- `residual_`
- `decision_`

### 11.2 schemaVersion

每类对象 **MUST** 带 `schemaVersion`。

### 11.3 revision

持久化对象 **SHOULD** 带 `revision`。  
对于 append-only + projection 实现，`revision` 主要用于物化视图与审计对齐。

## 12. 一致性策略

### 12.1 乐观并发

除 `investigation.case.open` 外，所有作用于现有 case 的变更命令 **MUST** 支持 `ifCaseRevision`，用于阻止 agent 在过期快照上继续推进调查。

### 12.2 幂等

对于 Create 类命令，在相同：

- tool name
- case id
- actor
- idempotency key

组合下，服务端 **SHOULD** 保证幂等。

## 13. 导出

实现 **SHOULD** 支持：

- 事件导出
- 当前案件快照导出
- PROV-compatible 导出

## 14. 一致性级别

### Level 0 — Core
- 核心 Tools
- 核心对象 schema
- append-only 事件流

### Level 1 — Structured Investigation
- Resources
- Guardrails
- Snapshot / Timeline / Graph

### Level 2 — Audit
- 事件回放
- 导出
- OTel telemetry

### Level 3 — Interop
- PROV export
- A2A façade
- 远程部署 profile
```

---

## 2) `schemas/common/base-node.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/common/base-node.schema.json",
  "title": "Investigation Base Node",
  "description": "Base fields shared by persisted investigation domain objects.",
  "type": "object",
  "$defs": {
    "ulid26": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "nodeId": {
      "type": "string",
      "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "inquiryId": {
      "type": "string",
      "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "symptomId": {
      "type": "string",
      "pattern": "^symptom_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "artifactId": {
      "type": "string",
      "pattern": "^artifact_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "factId": {
      "type": "string",
      "pattern": "^fact_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "hypothesisId": {
      "type": "string",
      "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "experimentId": {
      "type": "string",
      "pattern": "^experiment_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "actorRef": {
      "type": "object",
      "additionalProperties": false,
      "required": ["actorType", "actorId"],
      "properties": {
        "actorType": {
          "type": "string",
          "enum": ["agent", "user", "system", "adapter", "tool_runner"]
        },
        "actorId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 256
        },
        "sessionId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 256
        },
        "runId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 256
        }
      }
    },
    "timeWindow": {
      "type": "object",
      "additionalProperties": false,
      "required": ["start", "end"],
      "properties": {
        "start": {
          "type": "string",
          "format": "date-time"
        },
        "end": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "refList": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/nodeId"
      },
      "uniqueItems": true
    }
  },
  "required": [
    "kind",
    "id",
    "schemaVersion",
    "caseId",
    "revision",
    "createdAt",
    "createdBy"
  ],
  "properties": {
    "kind": {
      "type": "string",
      "pattern": "^investigation\\.[a-z_]+$"
    },
    "id": {
      "$ref": "#/$defs/nodeId"
    },
    "schemaVersion": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "caseId": {
      "$ref": "#/$defs/caseId"
    },
    "revision": {
      "type": "integer",
      "minimum": 1
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "createdBy": {
      "$ref": "#/$defs/actorRef"
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "extensions": {
      "type": "object",
      "additionalProperties": true
    }
  },
  "examples": [
    {
      "kind": "investigation.fact",
      "id": "fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "revision": 1,
      "createdAt": "2026-04-04T10:00:00+09:00",
      "createdBy": {
        "actorType": "agent",
        "actorId": "claude-code",
        "sessionId": "sess_001"
      },
      "labels": ["prod", "stale-read"]
    }
  ]
}
```

---

## 3) `schemas/domain/v1/fact.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/fact.schema.json",
  "title": "Investigation Fact",
  "description": "Atomic, citable statement derived from one or more artifacts.",
  "allOf": [
    {
      "$ref": "../../common/base-node.schema.json"
    },
    {
      "type": "object",
      "required": [
        "kind",
        "statement",
        "factKind",
        "polarity",
        "sourceArtifactIds"
      ],
      "properties": {
        "kind": {
          "const": "investigation.fact"
        },
        "inquiryId": {
          "$ref": "../../common/base-node.schema.json#/$defs/inquiryId"
        },
        "statement": {
          "type": "string",
          "minLength": 1,
          "maxLength": 2000
        },
        "factKind": {
          "type": "string",
          "enum": [
            "direct_observation",
            "aggregate_observation",
            "test_result",
            "absence_observation",
            "manual_report"
          ]
        },
        "polarity": {
          "type": "string",
          "enum": ["positive", "negative"]
        },
        "status": {
          "type": "string",
          "enum": ["active", "superseded", "retracted"],
          "default": "active"
        },
        "sourceArtifactIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/artifactId"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "aboutRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        },
        "timeWindow": {
          "$ref": "../../common/base-node.schema.json#/$defs/timeWindow"
        },
        "confidence": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "observationScope": {
          "type": "object",
          "additionalProperties": false,
          "required": ["scopeType", "query"],
          "properties": {
            "scopeType": {
              "type": "string",
              "enum": [
                "log_search",
                "trace_search",
                "metric_query",
                "code_search",
                "test_execution",
                "manual_observation"
              ]
            },
            "query": {
              "type": "string",
              "minLength": 1,
              "maxLength": 4000
            },
            "window": {
              "$ref": "../../common/base-node.schema.json#/$defs/timeWindow"
            },
            "location": {
              "type": "string",
              "maxLength": 1000
            },
            "notes": {
              "type": "string",
              "maxLength": 2000
            }
          },
          "oneOf": [
            { "required": ["window"] },
            { "required": ["location"] }
          ]
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "polarity": { "const": "negative" }
            },
            "required": ["polarity"]
          },
          "then": {
            "required": ["observationScope"]
          }
        }
      ]
    }
  ],
  "unevaluatedProperties": false,
  "examples": [
    {
      "kind": "investigation.fact",
      "id": "fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
      "revision": 1,
      "createdAt": "2026-04-04T10:12:31+09:00",
      "createdBy": {
        "actorType": "agent",
        "actorId": "claude-code",
        "sessionId": "sess_001"
      },
      "statement": "在同一 orderId 上观察到重复消息消费",
      "factKind": "direct_observation",
      "polarity": "positive",
      "status": "active",
      "sourceArtifactIds": [
        "artifact_01JQ9Y5H2K4M6N8P0Q2R4S6T8U"
      ],
      "aboutRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N",
        "entity_01JQ9Y4X7Y8Z9A0B1C2D3E4F5G"
      ],
      "confidence": "high",
      "labels": ["queue", "worker"]
    },
    {
      "kind": "investigation.fact",
      "id": "fact_01JQ9Y7P2Q4R6S8T0U2V4W6X8Y",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "revision": 1,
      "createdAt": "2026-04-04T10:15:00+09:00",
      "createdBy": {
        "actorType": "agent",
        "actorId": "codex",
        "sessionId": "sess_019"
      },
      "statement": "在指定 trace 窗口内未观察到 cache invalidation 调用",
      "factKind": "absence_observation",
      "polarity": "negative",
      "sourceArtifactIds": [
        "artifact_01JQ9Y5H2K4M6N8P0Q2R4S6T8U"
      ],
      "observationScope": {
        "scopeType": "trace_search",
        "query": "trace_id=abc AND service=order-write-api AND event=cache_invalidate",
        "window": {
          "start": "2026-04-04T10:00:00+09:00",
          "end": "2026-04-04T10:01:00+09:00"
        },
        "notes": "仅覆盖单次支付成功链路"
      },
      "confidence": "medium"
    }
  ]
}
```

---

## 4) `schemas/domain/v1/hypothesis.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/hypothesis.schema.json",
  "title": "Investigation Hypothesis",
  "description": "Competing explanation that accounts for one or more symptoms and must remain falsifiable.",
  "allOf": [
    {
      "$ref": "../../common/base-node.schema.json"
    },
    {
      "type": "object",
      "required": [
        "kind",
        "inquiryId",
        "title",
        "statement",
        "level",
        "status",
        "explainsSymptomIds",
        "falsificationCriteria"
      ],
      "properties": {
        "kind": {
          "const": "investigation.hypothesis"
        },
        "inquiryId": {
          "$ref": "../../common/base-node.schema.json#/$defs/inquiryId"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240
        },
        "statement": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "level": {
          "type": "string",
          "enum": ["phenomenon", "mechanism", "trigger", "root_cause"]
        },
        "status": {
          "type": "string",
          "enum": [
            "proposed",
            "active",
            "favored",
            "weakened",
            "rejected",
            "confirmed"
          ]
        },
        "confidence": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "explainsSymptomIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/symptomId"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "dependsOnFactIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/factId"
          },
          "uniqueItems": true
        },
        "dependsOnHypothesisIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/hypothesisId"
          },
          "uniqueItems": true
        },
        "falsificationCriteria": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "aboutRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        },
        "residualRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        }
      }
    }
  ],
  "unevaluatedProperties": false,
  "examples": [
    {
      "kind": "investigation.hypothesis",
      "id": "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
      "revision": 1,
      "createdAt": "2026-04-04T10:20:00+09:00",
      "createdBy": {
        "actorType": "agent",
        "actorId": "claude-code",
        "sessionId": "sess_001"
      },
      "title": "重复消费导致状态回退",
      "statement": "worker 重复消费旧版本消息，导致 DB 中订单状态被较旧事件覆盖，读路径随后缓存旧值。",
      "level": "mechanism",
      "status": "active",
      "confidence": "medium",
      "explainsSymptomIds": [
        "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y"
      ],
      "dependsOnFactIds": [
        "fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2"
      ],
      "falsificationCriteria": [
        "若禁用队列重放后仍可稳定复现，则该假设显著削弱。",
        "若数据库写入版本严格单调且无回退，则该假设不成立。"
      ],
      "aboutRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N",
        "entity_01JQ9Y4X7Y8Z9A0B1C2D3E4F5G"
      ],
      "labels": ["queue", "worker", "db"]
    }
  ]
}
```

---

## 5) `schemas/commands/v1/fact.assert.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/fact.assert.request.schema.json",
  "title": "Command Request - investigation.fact.assert",
  "description": "Request schema for asserting a new Fact via MCP tool investigation.fact.assert.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "statement",
    "factKind",
    "polarity",
    "sourceArtifactIds"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128,
      "description": "Client-generated key for idempotent retries."
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1,
      "description": "Optional optimistic concurrency guard."
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "inquiryId": {
      "type": "string",
      "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "statement": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "factKind": {
      "type": "string",
      "enum": [
        "direct_observation",
        "aggregate_observation",
        "test_result",
        "absence_observation",
        "manual_report"
      ]
    },
    "polarity": {
      "type": "string",
      "enum": ["positive", "negative"]
    },
    "sourceArtifactIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^artifact_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "aboutRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "confidence": {
      "type": "string",
      "enum": ["low", "medium", "high"]
    },
    "timeWindow": {
      "type": "object",
      "additionalProperties": false,
      "required": ["start", "end"],
      "properties": {
        "start": {
          "type": "string",
          "format": "date-time"
        },
        "end": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "observationScope": {
      "type": "object",
      "additionalProperties": false,
      "required": ["scopeType", "query"],
      "properties": {
        "scopeType": {
          "type": "string",
          "enum": [
            "log_search",
            "trace_search",
            "metric_query",
            "code_search",
            "test_execution",
            "manual_observation"
          ]
        },
        "query": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "window": {
          "type": "object",
          "additionalProperties": false,
          "required": ["start", "end"],
          "properties": {
            "start": {
              "type": "string",
              "format": "date-time"
            },
            "end": {
              "type": "string",
              "format": "date-time"
            }
          }
        },
        "location": {
          "type": "string",
          "maxLength": 1000
        },
        "notes": {
          "type": "string",
          "maxLength": 2000
        }
      },
      "oneOf": [
        { "required": ["window"] },
        { "required": ["location"] }
      ]
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": false,
      "description": "If true, server may include case snapshot delta in the result."
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "polarity": { "const": "negative" }
        },
        "required": ["polarity"]
      },
      "then": {
        "required": ["observationScope"]
      }
    }
  ],
  "examples": [
    {
      "idempotencyKey": "fact-assert-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
      "statement": "在同一 orderId 上观察到重复消息消费",
      "factKind": "direct_observation",
      "polarity": "positive",
      "sourceArtifactIds": [
        "artifact_01JQ9Y5H2K4M6N8P0Q2R4S6T8U"
      ],
      "aboutRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N",
        "entity_01JQ9Y4X7Y8Z9A0B1C2D3E4F5G"
      ],
      "confidence": "high",
      "labels": ["queue", "worker"],
      "returnSnapshot": true
    },
    {
      "idempotencyKey": "fact-assert-20260404-002",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "statement": "在指定 trace 窗口内未观察到 cache invalidation 调用",
      "factKind": "absence_observation",
      "polarity": "negative",
      "sourceArtifactIds": [
        "artifact_01JQ9Y5H2K4M6N8P0Q2R4S6T8U"
      ],
      "observationScope": {
        "scopeType": "trace_search",
        "query": "trace_id=abc AND service=order-write-api AND event=cache_invalidate",
        "window": {
          "start": "2026-04-04T10:00:00+09:00",
          "end": "2026-04-04T10:01:00+09:00"
        },
        "notes": "仅覆盖单次支付成功链路"
      }
    }
  ]
}
```

---

# 这一批文件落下去以后，已经得到的约束力

这 5 个文件已经把最关键的几条硬约束固定住了：

## 已固定

* 持久化对象统一公共头
* `Fact` 必须有 `Artifact` 来源
* 9 个 resource family
* 15 类事件 schema / CloudEvents data payload
* create 命令不允许客户端自己传对象 ID
* 命令层和领域对象层已经开始分离

## 还没有固定

* `Experiment` 的区分性结构
* `Decision` 的 citation 约束
* `Case / Inquiry / Symptom / Gap / Residual` 的完整 schema
* MCP tool 返回 schema
* guardrail 的结果 schema

---


下面按上一批文件直接续写第二批 6 个文件。
我顺手把几个关键约束也嵌进去了：

* `Experiment` 不只是“动作记录”，而是带**预期分歧**的验证对象
* `Decision` 必须引用 `Fact` 或 `Experiment`
* `Case Snapshot` 作为 **resource payload**，不和 domain node 混用
* `hypothesis.propose` 和 `experiment.plan` 两个命令输入与 domain schema 保持同构
* `Case` 对象的 `caseId == id` 这个约束建议由 **server 运行时强制**，不靠 JSON Schema 表达

---

# 1) `schemas/domain/v1/experiment.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/experiment.schema.json",
  "title": "Investigation Experiment",
  "description": "A discriminative validation action planned or executed during investigation.",
  "allOf": [
    {
      "$ref": "../../common/base-node.schema.json"
    },
    {
      "type": "object",
      "required": [
        "kind",
        "inquiryId",
        "title",
        "objective",
        "method",
        "status",
        "testsHypothesisIds",
        "expectedOutcomes"
      ],
      "properties": {
        "kind": {
          "const": "investigation.experiment"
        },
        "inquiryId": {
          "$ref": "../../common/base-node.schema.json#/$defs/inquiryId"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240
        },
        "objective": {
          "type": "string",
          "minLength": 1,
          "maxLength": 2000
        },
        "method": {
          "type": "string",
          "enum": [
            "search",
            "instrumentation",
            "reproduction",
            "compare_versions",
            "fault_injection",
            "binary_search",
            "test_run",
            "patch_probe"
          ]
        },
        "status": {
          "type": "string",
          "enum": [
            "planned",
            "running",
            "completed",
            "inconclusive",
            "canceled"
          ]
        },
        "testsHypothesisIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/hypothesisId"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "expectedOutcomes": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["when", "expect"],
            "properties": {
              "when": {
                "type": "string",
                "minLength": 1,
                "maxLength": 1000
              },
              "expect": {
                "type": "string",
                "minLength": 1,
                "maxLength": 1000
              },
              "implicationKind": {
                "type": "string",
                "enum": [
                  "supports",
                  "contradicts",
                  "narrows_scope",
                  "inconclusive"
                ]
              },
              "targetHypothesisIds": {
                "type": "array",
                "items": {
                  "$ref": "../../common/base-node.schema.json#/$defs/hypothesisId"
                },
                "uniqueItems": true
              }
            }
          }
        },
        "preconditions": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000
          },
          "uniqueItems": true
        },
        "changeIntent": {
          "type": "string",
          "enum": ["none", "instrumentation", "probe"]
        },
        "cost": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "risk": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "aboutRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        },
        "startedAt": {
          "type": "string",
          "format": "date-time"
        },
        "completedAt": {
          "type": "string",
          "format": "date-time"
        },
        "resultSummary": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "producedArtifactIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/artifactId"
          },
          "uniqueItems": true
        },
        "producedFactIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/factId"
          },
          "uniqueItems": true
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "status": {
                "enum": ["completed", "inconclusive"]
              }
            },
            "required": ["status"]
          },
          "then": {
            "required": ["resultSummary"]
          }
        },
        {
          "if": {
            "properties": {
              "status": {
                "const": "completed"
              }
            },
            "required": ["status"]
          },
          "then": {
            "required": ["completedAt"]
          }
        }
      ]
    }
  ],
  "unevaluatedProperties": false,
  "examples": [
    {
      "kind": "investigation.experiment",
      "id": "experiment_01JQA0AJ2B3C4D5E6F7G8H9JKL",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
      "revision": 1,
      "createdAt": "2026-04-04T10:30:00+09:00",
      "createdBy": {
        "actorType": "agent",
        "actorId": "claude-code",
        "sessionId": "sess_001"
      },
      "title": "绕过队列验证状态回退机制",
      "objective": "区分重复消费解释与缓存失效解释",
      "method": "reproduction",
      "status": "planned",
      "testsHypothesisIds": [
        "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
        "hypothesis_01JQA01MN23PQ45RS67TU89VW0"
      ],
      "expectedOutcomes": [
        {
          "when": "若重复消费机制成立",
          "expect": "绕过队列后旧状态不再出现",
          "implicationKind": "supports",
          "targetHypothesisIds": [
            "hypothesis_01JQ9Z12AB34CD56EF78GH90JK"
          ]
        },
        {
          "when": "若缓存失效机制成立",
          "expect": "绕过队列后旧状态仍出现",
          "implicationKind": "supports",
          "targetHypothesisIds": [
            "hypothesis_01JQA01MN23PQ45RS67TU89VW0"
          ]
        }
      ],
      "changeIntent": "probe",
      "cost": "medium",
      "risk": "low",
      "aboutRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N",
        "entity_01JQ9Y4X7Y8Z9A0B1C2D3E4F5G"
      ],
      "labels": ["queue", "cache", "reproduction"]
    }
  ]
}
```

---

# 2) `schemas/domain/v1/decision.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/decision.schema.json",
  "title": "Investigation Decision",
  "description": "A formal adjudication in the investigation process. Decisions must cite supporting facts or experiments.",
  "allOf": [
    {
      "$ref": "../../common/base-node.schema.json"
    },
    {
      "type": "object",
      "required": [
        "kind",
        "title",
        "decisionKind",
        "statement"
      ],
      "properties": {
        "kind": {
          "const": "investigation.decision"
        },
        "inquiryId": {
          "$ref": "../../common/base-node.schema.json#/$defs/inquiryId"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240
        },
        "decisionKind": {
          "type": "string",
          "enum": [
            "close_inquiry",
            "reject_hypothesis",
            "favor_hypothesis",
            "ready_to_patch",
            "accept_residual",
            "declare_root_cause",
            "deprioritize_branch",
            "escalate_sampling",
            "close_case"
          ]
        },
        "statement": {
          "type": "string",
          "minLength": 1,
          "maxLength": 4000
        },
        "status": {
          "type": "string",
          "enum": ["active", "superseded", "retracted"],
          "default": "active"
        },
        "supportingFactIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/factId"
          },
          "uniqueItems": true
        },
        "supportingExperimentIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/experimentId"
          },
          "uniqueItems": true
        },
        "supportingHypothesisIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/hypothesisId"
          },
          "uniqueItems": true
        },
        "affectedRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        },
        "acceptedResidualRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        },
        "blockedByGapRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        },
        "rationale": {
          "type": "string",
          "maxLength": 4000
        }
      },
      "oneOf": [
        {
          "required": ["supportingFactIds"]
        },
        {
          "required": ["supportingExperimentIds"]
        }
      ]
    }
  ],
  "unevaluatedProperties": false,
  "examples": [
    {
      "kind": "investigation.decision",
      "id": "decision_01JQA0QW2E3R4T5Y6U7I8O9P0A",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
      "revision": 1,
      "createdAt": "2026-04-04T10:45:00+09:00",
      "createdBy": {
        "actorType": "agent",
        "actorId": "claude-code",
        "sessionId": "sess_001"
      },
      "title": "进入修复准备",
      "decisionKind": "ready_to_patch",
      "statement": "重复消费导致状态回退的机制已获得足够支持，可进入修复与验证阶段。",
      "status": "active",
      "supportingFactIds": [
        "fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2"
      ],
      "supportingExperimentIds": [
        "experiment_01JQA0AJ2B3C4D5E6F7G8H9JKL"
      ],
      "supportingHypothesisIds": [
        "hypothesis_01JQ9Z12AB34CD56EF78GH90JK"
      ],
      "affectedRefs": [
        "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N"
      ],
      "rationale": "关键现象已被覆盖，区分性实验已完成，剩余残差不阻塞修复。"
    }
  ]
}
```

---

# 3) `schemas/domain/v1/case.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/case.schema.json",
  "title": "Investigation Case",
  "description": "Root object of an investigation. Runtime invariant: for kind=investigation.case, caseId MUST equal id.",
  "allOf": [
    {
      "$ref": "../../common/base-node.schema.json"
    },
    {
      "type": "object",
      "required": [
        "kind",
        "title",
        "objective",
        "severity",
        "status",
        "stage"
      ],
      "properties": {
        "kind": {
          "const": "investigation.case"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240
        },
        "objective": {
          "type": "string",
          "minLength": 1,
          "maxLength": 2000
        },
        "severity": {
          "type": "string",
          "enum": ["low", "medium", "high", "critical"]
        },
        "status": {
          "type": "string",
          "enum": [
            "active",
            "blocked",
            "ready_to_patch",
            "validating",
            "closed"
          ]
        },
        "stage": {
          "type": "string",
          "enum": [
            "intake",
            "scoping",
            "evidence_collection",
            "hypothesis_competition",
            "discriminative_testing",
            "repair_preparation",
            "repair_validation",
            "closed"
          ]
        },
        "environment": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64
          },
          "uniqueItems": true
        },
        "summary": {
          "type": "string",
          "maxLength": 4000
        },
        "owner": {
          "type": "object",
          "additionalProperties": false,
          "required": ["actorType", "actorId"],
          "properties": {
            "actorType": {
              "type": "string",
              "enum": ["agent", "user", "system"]
            },
            "actorId": {
              "type": "string",
              "minLength": 1,
              "maxLength": 256
            }
          }
        },
        "closedAt": {
          "type": "string",
          "format": "date-time"
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "status": {
                "const": "closed"
              }
            },
            "required": ["status"]
          },
          "then": {
            "required": ["closedAt"]
          }
        }
      ]
    }
  ],
  "unevaluatedProperties": false,
  "examples": [
    {
      "kind": "investigation.case",
      "id": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "schemaVersion": "1.0.0",
      "revision": 1,
      "createdAt": "2026-04-04T10:00:00+09:00",
      "createdBy": {
        "actorType": "agent",
        "actorId": "claude-code",
        "sessionId": "sess_001"
      },
      "title": "订单状态偶发回退",
      "objective": "定位导致订单详情页显示旧状态的根因",
      "severity": "high",
      "status": "active",
      "stage": "evidence_collection",
      "environment": ["prod"],
      "summary": "支付成功后 1-3 分钟内，部分订单详情页仍显示 pending。",
      "labels": ["order", "stale-read", "prod"]
    }
  ]
}
```

---

# 4) `schemas/resources/v1/case.snapshot.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/resources/v1/case.snapshot.schema.json",
  "title": "Resource - Case Snapshot",
  "description": "Read-only materialized view for a case dashboard.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "kind",
    "schemaVersion",
    "caseId",
    "generatedAt",
    "caseRevision",
    "case",
    "counts",
    "criticalSymptoms",
    "activeInquiries",
    "activeHypotheses",
    "openGaps",
    "openResiduals",
    "guardrail"
  ],
  "properties": {
    "kind": {
      "const": "investigation.resource.case_snapshot"
    },
    "schemaVersion": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "caseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "case": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "title",
        "objective",
        "severity",
        "status",
        "stage"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
        },
        "title": {
          "type": "string"
        },
        "objective": {
          "type": "string"
        },
        "severity": {
          "type": "string",
          "enum": ["low", "medium", "high", "critical"]
        },
        "status": {
          "type": "string",
          "enum": [
            "active",
            "blocked",
            "ready_to_patch",
            "validating",
            "closed"
          ]
        },
        "stage": {
          "type": "string",
          "enum": [
            "intake",
            "scoping",
            "evidence_collection",
            "hypothesis_competition",
            "discriminative_testing",
            "repair_preparation",
            "repair_validation",
            "closed"
          ]
        },
        "labels": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        }
      }
    },
    "counts": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "symptoms",
        "artifacts",
        "facts",
        "inquiries",
        "activeHypotheses",
        "openGaps",
        "openResiduals",
        "experiments",
        "decisions"
      ],
      "properties": {
        "symptoms": { "type": "integer", "minimum": 0 },
        "artifacts": { "type": "integer", "minimum": 0 },
        "facts": { "type": "integer", "minimum": 0 },
        "inquiries": { "type": "integer", "minimum": 0 },
        "activeHypotheses": { "type": "integer", "minimum": 0 },
        "openGaps": { "type": "integer", "minimum": 0 },
        "openResiduals": { "type": "integer", "minimum": 0 },
        "experiments": { "type": "integer", "minimum": 0 },
        "decisions": { "type": "integer", "minimum": 0 }
      }
    },
    "criticalSymptoms": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "statement", "severity", "reproducibility"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^symptom_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "statement": { "type": "string" },
          "severity": {
            "type": "string",
            "enum": ["low", "medium", "high", "critical"]
          },
          "reproducibility": {
            "type": "string",
            "enum": ["always", "often", "intermittent", "rare", "unknown"]
          }
        }
      }
    },
    "activeInquiries": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "title", "question", "priority", "status"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "title": { "type": "string" },
          "question": { "type": "string" },
          "priority": {
            "type": "string",
            "enum": ["low", "medium", "high"]
          },
          "status": {
            "type": "string",
            "enum": ["open", "paused", "closed", "merged"]
          }
        }
      }
    },
    "activeHypotheses": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "inquiryId",
          "title",
          "level",
          "status",
          "confidence",
          "explainsSymptomIds"
        ],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "inquiryId": {
            "type": "string",
            "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "title": { "type": "string" },
          "level": {
            "type": "string",
            "enum": ["phenomenon", "mechanism", "trigger", "root_cause"]
          },
          "status": {
            "type": "string",
            "enum": [
              "proposed",
              "active",
              "favored",
              "weakened",
              "rejected",
              "confirmed"
            ]
          },
          "confidence": {
            "type": "string",
            "enum": ["low", "medium", "high"]
          },
          "explainsSymptomIds": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^symptom_[0-9A-HJKMNP-TV-Z]{26}$"
            },
            "uniqueItems": true
          }
        }
      }
    },
    "openGaps": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "question", "priority", "status"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^gap_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "question": { "type": "string" },
          "priority": {
            "type": "string",
            "enum": ["low", "medium", "high"]
          },
          "status": {
            "type": "string",
            "enum": ["open", "in_progress", "blocked", "resolved", "waived"]
          },
          "blockedRefs": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
            },
            "uniqueItems": true
          }
        }
      }
    },
    "openResiduals": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "statement", "severity", "status"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^residual_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "statement": { "type": "string" },
          "severity": {
            "type": "string",
            "enum": ["low", "medium", "high", "critical"]
          },
          "status": {
            "type": "string",
            "enum": ["open", "reduced", "resolved", "accepted"]
          },
          "relatedSymptomIds": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^symptom_[0-9A-HJKMNP-TV-Z]{26}$"
            },
            "uniqueItems": true
          }
        }
      }
    },
    "recentExperiments": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "title", "status", "method"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^experiment_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "title": { "type": "string" },
          "status": {
            "type": "string",
            "enum": [
              "planned",
              "running",
              "completed",
              "inconclusive",
              "canceled"
            ]
          },
          "method": {
            "type": "string",
            "enum": [
              "search",
              "instrumentation",
              "reproduction",
              "compare_versions",
              "fault_injection",
              "binary_search",
              "test_run",
              "patch_probe"
            ]
          },
          "testsHypothesisIds": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
            },
            "uniqueItems": true
          }
        }
      }
    },
    "recentDecisions": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "title", "decisionKind", "createdAt"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^decision_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "title": { "type": "string" },
          "decisionKind": {
            "type": "string",
            "enum": [
              "close_inquiry",
              "reject_hypothesis",
              "favor_hypothesis",
              "ready_to_patch",
              "accept_residual",
              "declare_root_cause",
              "deprioritize_branch",
              "escalate_sampling",
              "close_case"
            ]
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      }
    },
    "guardrail": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "overallStatus",
        "stallRisk",
        "warningCount",
        "violationCount"
      ],
      "properties": {
        "overallStatus": {
          "type": "string",
          "enum": ["ok", "warning", "violation"]
        },
        "stallRisk": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "warningCount": {
          "type": "integer",
          "minimum": 0
        },
        "violationCount": {
          "type": "integer",
          "minimum": 0
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["code", "message"],
            "properties": {
              "code": { "type": "string" },
              "message": { "type": "string" }
            }
          }
        },
        "violations": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["code", "message"],
            "properties": {
              "code": { "type": "string" },
              "message": { "type": "string" }
            }
          }
        },
        "readyToPatch": {
          "type": "object",
          "additionalProperties": false,
          "required": ["pass"],
          "properties": {
            "pass": { "type": "boolean" },
            "reasons": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        }
      }
    }
  },
  "examples": [
    {
      "kind": "investigation.resource.case_snapshot",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "generatedAt": "2026-04-04T11:00:00+09:00",
      "caseRevision": 18,
      "case": {
        "id": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
        "title": "订单状态偶发回退",
        "objective": "定位导致订单详情页显示旧状态的根因",
        "severity": "high",
        "status": "active",
        "stage": "discriminative_testing",
        "labels": ["order", "stale-read", "prod"]
      },
      "counts": {
        "symptoms": 2,
        "artifacts": 6,
        "facts": 5,
        "inquiries": 2,
        "activeHypotheses": 2,
        "openGaps": 1,
        "openResiduals": 1,
        "experiments": 3,
        "decisions": 1
      },
      "criticalSymptoms": [
        {
          "id": "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y",
          "statement": "支付成功后详情页仍显示 pending",
          "severity": "high",
          "reproducibility": "intermittent"
        }
      ],
      "activeInquiries": [
        {
          "id": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
          "title": "队列重复消费线",
          "question": "是否存在重复消费导致状态回退？",
          "priority": "high",
          "status": "open"
        }
      ],
      "activeHypotheses": [
        {
          "id": "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
          "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
          "title": "重复消费导致状态回退",
          "level": "mechanism",
          "status": "favored",
          "confidence": "high",
          "explainsSymptomIds": [
            "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y"
          ]
        }
      ],
      "openGaps": [
        {
          "id": "gap_01JQA14B2C3D4E5F6G7H8J9KLM",
          "question": "为什么只在高并发订单中出现？",
          "priority": "high",
          "status": "open",
          "blockedRefs": [
            "hypothesis_01JQ9Z12AB34CD56EF78GH90JK"
          ]
        }
      ],
      "openResiduals": [
        {
          "id": "residual_01JQA15N2P3Q4R5S6T7U8V9WXY",
          "statement": "tenant A 特异性尚未解释",
          "severity": "medium",
          "status": "open",
          "relatedSymptomIds": [
            "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y"
          ]
        }
      ],
      "recentExperiments": [
        {
          "id": "experiment_01JQA0AJ2B3C4D5E6F7G8H9JKL",
          "title": "绕过队列验证状态回退机制",
          "status": "completed",
          "method": "reproduction",
          "testsHypothesisIds": [
            "hypothesis_01JQ9Z12AB34CD56EF78GH90JK"
          ]
        }
      ],
      "recentDecisions": [
        {
          "id": "decision_01JQA0QW2E3R4T5Y6U7I8O9P0A",
          "title": "进入修复准备",
          "decisionKind": "ready_to_patch",
          "createdAt": "2026-04-04T10:45:00+09:00"
        }
      ],
      "guardrail": {
        "overallStatus": "warning",
        "stallRisk": "low",
        "warningCount": 1,
        "violationCount": 0,
        "warnings": [
          {
            "code": "OPEN_RESIDUAL_PRESENT",
            "message": "仍存在一个 open residual。"
          }
        ],
        "violations": [],
        "readyToPatch": {
          "pass": false,
          "reasons": [
            "critical residuals 已清空，但仍存在中等级 residual 未显式接受。"
          ]
        }
      }
    }
  ]
}
```

---

# 5) `schemas/commands/v1/hypothesis.propose.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/hypothesis.propose.request.schema.json",
  "title": "Command Request - investigation.hypothesis.propose",
  "description": "Request schema for proposing a new hypothesis via MCP tool investigation.hypothesis.propose.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "inquiryId",
    "title",
    "statement",
    "level",
    "explainsSymptomIds",
    "falsificationCriteria"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "inquiryId": {
      "type": "string",
      "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "statement": {
      "type": "string",
      "minLength": 1,
      "maxLength": 4000
    },
    "level": {
      "type": "string",
      "enum": ["phenomenon", "mechanism", "trigger", "root_cause"]
    },
    "explainsSymptomIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^symptom_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "dependsOnFactIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^fact_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "dependsOnHypothesisIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "falsificationCriteria": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "confidence": {
      "type": "string",
      "enum": ["low", "medium", "high"]
    },
    "aboutRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": false
    }
  },
  "examples": [
    {
      "idempotencyKey": "hypothesis-propose-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
      "title": "重复消费导致状态回退",
      "statement": "worker 重复消费旧版本消息，导致 DB 中订单状态被较旧事件覆盖，读路径随后缓存旧值。",
      "level": "mechanism",
      "explainsSymptomIds": [
        "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y"
      ],
      "dependsOnFactIds": [
        "fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2"
      ],
      "falsificationCriteria": [
        "若禁用队列重放后仍可稳定复现，则该假设显著削弱。",
        "若数据库写入版本严格单调且无回退，则该假设不成立。"
      ],
      "confidence": "medium",
      "aboutRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N",
        "entity_01JQ9Y4X7Y8Z9A0B1C2D3E4F5G"
      ],
      "labels": ["queue", "worker", "db"],
      "returnSnapshot": true
    }
  ]
}
```

---

# 6) `schemas/commands/v1/experiment.plan.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/experiment.plan.request.schema.json",
  "title": "Command Request - investigation.experiment.plan",
  "description": "Request schema for planning a new experiment via MCP tool investigation.experiment.plan.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "inquiryId",
    "title",
    "objective",
    "method",
    "testsHypothesisIds",
    "expectedOutcomes"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "inquiryId": {
      "type": "string",
      "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "objective": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "method": {
      "type": "string",
      "enum": [
        "search",
        "instrumentation",
        "reproduction",
        "compare_versions",
        "fault_injection",
        "binary_search",
        "test_run",
        "patch_probe"
      ]
    },
    "testsHypothesisIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "expectedOutcomes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["when", "expect"],
        "properties": {
          "when": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000
          },
          "expect": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000
          },
          "implicationKind": {
            "type": "string",
            "enum": [
              "supports",
              "contradicts",
              "narrows_scope",
              "inconclusive"
            ]
          },
          "targetHypothesisIds": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
            },
            "uniqueItems": true
          }
        }
      }
    },
    "preconditions": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "uniqueItems": true
    },
    "changeIntent": {
      "type": "string",
      "enum": ["none", "instrumentation", "probe"]
    },
    "cost": {
      "type": "string",
      "enum": ["low", "medium", "high"]
    },
    "risk": {
      "type": "string",
      "enum": ["low", "medium", "high"]
    },
    "aboutRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": false
    }
  },
  "examples": [
    {
      "idempotencyKey": "experiment-plan-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
      "title": "绕过队列验证状态回退机制",
      "objective": "区分重复消费解释与缓存失效解释",
      "method": "reproduction",
      "testsHypothesisIds": [
        "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
        "hypothesis_01JQA01MN23PQ45RS67TU89VW0"
      ],
      "expectedOutcomes": [
        {
          "when": "若重复消费机制成立",
          "expect": "绕过队列后旧状态不再出现",
          "implicationKind": "supports",
          "targetHypothesisIds": [
            "hypothesis_01JQ9Z12AB34CD56EF78GH90JK"
          ]
        },
        {
          "when": "若缓存失效机制成立",
          "expect": "绕过队列后旧状态仍出现",
          "implicationKind": "supports",
          "targetHypothesisIds": [
            "hypothesis_01JQA01MN23PQ45RS67TU89VW0"
          ]
        }
      ],
      "preconditions": [
        "准备一组可稳定复现的订单样本",
        "具备绕过队列直接写入测试环境的能力"
      ],
      "changeIntent": "probe",
      "cost": "medium",
      "risk": "low",
      "aboutRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N",
        "entity_01JQ9Y4X7Y8Z9A0B1C2D3E4F5G"
      ],
      "labels": ["queue", "cache", "reproduction"],
      "returnSnapshot": true
    }
  ]
}
```

---

先修正上一批一个小问题，再给这批 8 个文件。

## 先修正上一批一个约束错误

上一批 `decision.schema.json` 里这段：

```json
"oneOf": [
  { "required": ["supportingFactIds"] },
  { "required": ["supportingExperimentIds"] }
]
```

这里应改成 `anyOf`，因为一个 `Decision` **可以同时引用 facts 和 experiments**；用 `oneOf` 会把“两个都提供”的合法情况误判为不合法。

建议直接替换为：

```json
"anyOf": [
  { "required": ["supportingFactIds"] },
  { "required": ["supportingExperimentIds"] }
]
```

同理，下面这批里的 `decision.record.request` 我也会直接用 `anyOf`。

---

# 1) `schemas/domain/v1/symptom.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/symptom.schema.json",
  "title": "Investigation Symptom",
  "description": "Observed phenomenon reported in a case. A symptom describes what is happening, not why.",
  "allOf": [
    {
      "$ref": "../../common/base-node.schema.json"
    },
    {
      "type": "object",
      "required": [
        "kind",
        "statement",
        "severity",
        "reproducibility",
        "status"
      ],
      "properties": {
        "kind": {
          "const": "investigation.symptom"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240
        },
        "statement": {
          "type": "string",
          "minLength": 1,
          "maxLength": 2000
        },
        "severity": {
          "type": "string",
          "enum": ["low", "medium", "high", "critical"]
        },
        "reproducibility": {
          "type": "string",
          "enum": ["always", "often", "intermittent", "rare", "unknown"]
        },
        "critical": {
          "type": "boolean",
          "default": false
        },
        "status": {
          "type": "string",
          "enum": ["reported", "bounded", "reproduced", "explained", "resolved"]
        },
        "timeWindow": {
          "$ref": "../../common/base-node.schema.json#/$defs/timeWindow"
        },
        "environment": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64
          },
          "uniqueItems": true
        },
        "affectedRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        },
        "resolutionSummary": {
          "type": "string",
          "maxLength": 4000
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "status": { "const": "resolved" }
            },
            "required": ["status"]
          },
          "then": {
            "required": ["resolutionSummary"]
          }
        }
      ]
    }
  ],
  "unevaluatedProperties": false,
  "examples": [
    {
      "kind": "investigation.symptom",
      "id": "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "revision": 1,
      "createdAt": "2026-04-04T10:05:00+09:00",
      "createdBy": {
        "actorType": "agent",
        "actorId": "claude-code",
        "sessionId": "sess_001"
      },
      "title": "订单详情页显示旧状态",
      "statement": "部分订单在支付成功后 1-3 分钟内，详情页仍显示 pending。",
      "severity": "high",
      "reproducibility": "intermittent",
      "critical": true,
      "status": "reported",
      "environment": ["prod"],
      "affectedRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N",
        "entity_01JQ9Y4X7Y8Z9A0B1C2D3E4F5G"
      ],
      "labels": ["order", "stale-read", "prod"]
    }
  ]
}
```

---

# 2) `schemas/domain/v1/gap.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/gap.schema.json",
  "title": "Investigation Gap",
  "description": "A key unknown that blocks progress or prevents discrimination among hypotheses.",
  "allOf": [
    {
      "$ref": "../../common/base-node.schema.json"
    },
    {
      "type": "object",
      "required": [
        "kind",
        "question",
        "status",
        "priority"
      ],
      "properties": {
        "kind": {
          "const": "investigation.gap"
        },
        "inquiryId": {
          "$ref": "../../common/base-node.schema.json#/$defs/inquiryId"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240
        },
        "question": {
          "type": "string",
          "minLength": 1,
          "maxLength": 2000
        },
        "status": {
          "type": "string",
          "enum": ["open", "in_progress", "blocked", "resolved", "waived"]
        },
        "priority": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "blockedRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        },
        "aboutRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        },
        "resolutionSummary": {
          "type": "string",
          "maxLength": 4000
        },
        "resolutionFactIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/factId"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "resolutionExperimentIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/experimentId"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "waivedReason": {
          "type": "string",
          "maxLength": 2000
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "status": { "const": "resolved" }
            },
            "required": ["status"]
          },
          "then": {
            "required": ["resolutionSummary"],
            "anyOf": [
              { "required": ["resolutionFactIds"] },
              { "required": ["resolutionExperimentIds"] }
            ]
          }
        },
        {
          "if": {
            "properties": {
              "status": { "const": "waived" }
            },
            "required": ["status"]
          },
          "then": {
            "required": ["resolutionSummary", "waivedReason"]
          }
        }
      ]
    }
  ],
  "unevaluatedProperties": false,
  "examples": [
    {
      "kind": "investigation.gap",
      "id": "gap_01JQA14B2C3D4E5F6G7H8J9KLM",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
      "revision": 1,
      "createdAt": "2026-04-04T10:25:00+09:00",
      "createdBy": {
        "actorType": "agent",
        "actorId": "claude-code",
        "sessionId": "sess_001"
      },
      "title": "高并发触发条件未解释",
      "question": "为什么问题主要出现在高并发订单，而低流量时基本不出现？",
      "status": "open",
      "priority": "high",
      "blockedRefs": [
        "hypothesis_01JQ9Z12AB34CD56EF78GH90JK"
      ],
      "aboutRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N"
      ],
      "labels": ["trigger", "concurrency"]
    }
  ]
}
```

---

# 3) `schemas/domain/v1/residual.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/residual.schema.json",
  "title": "Investigation Residual",
  "description": "Unexplained remainder that is not yet accounted for by current hypotheses or decisions.",
  "allOf": [
    {
      "$ref": "../../common/base-node.schema.json"
    },
    {
      "type": "object",
      "required": [
        "kind",
        "statement",
        "severity",
        "status",
        "relatedSymptomIds"
      ],
      "properties": {
        "kind": {
          "const": "investigation.residual"
        },
        "inquiryId": {
          "$ref": "../../common/base-node.schema.json#/$defs/inquiryId"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240
        },
        "statement": {
          "type": "string",
          "minLength": 1,
          "maxLength": 2000
        },
        "severity": {
          "type": "string",
          "enum": ["low", "medium", "high", "critical"]
        },
        "status": {
          "type": "string",
          "enum": ["open", "reduced", "resolved", "accepted"]
        },
        "relatedSymptomIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/symptomId"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "aboutRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        },
        "explainedByHypothesisIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/hypothesisId"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "resolutionFactIds": {
          "type": "array",
          "items": {
            "$ref": "../../common/base-node.schema.json#/$defs/factId"
          },
          "minItems": 1,
          "uniqueItems": true
        },
        "resolutionSummary": {
          "type": "string",
          "maxLength": 4000
        },
        "acceptedReason": {
          "type": "string",
          "maxLength": 2000
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "status": { "const": "resolved" }
            },
            "required": ["status"]
          },
          "then": {
            "required": ["resolutionSummary"],
            "anyOf": [
              { "required": ["explainedByHypothesisIds"] },
              { "required": ["resolutionFactIds"] }
            ]
          }
        },
        {
          "if": {
            "properties": {
              "status": { "const": "accepted" }
            },
            "required": ["status"]
          },
          "then": {
            "required": ["acceptedReason"]
          }
        }
      ]
    }
  ],
  "unevaluatedProperties": false,
  "examples": [
    {
      "kind": "investigation.residual",
      "id": "residual_01JQA15N2P3Q4R5S6T7U8V9WXY",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "revision": 1,
      "createdAt": "2026-04-04T10:40:00+09:00",
      "createdBy": {
        "actorType": "agent",
        "actorId": "claude-code",
        "sessionId": "sess_001"
      },
      "title": "tenant 特异性未解释",
      "statement": "当前假设尚不能解释为何 tenant A 的复现概率显著高于其他 tenant。",
      "severity": "medium",
      "status": "open",
      "relatedSymptomIds": [
        "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y"
      ],
      "aboutRefs": [
        "entity_01JQA18A2B3C4D5E6F7G8H9JKL"
      ],
      "labels": ["tenant", "residual"]
    }
  ]
}
```

---

# 4) `schemas/domain/v1/inquiry.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/domain/v1/inquiry.schema.json",
  "title": "Investigation Inquiry",
  "description": "An investigation branch or line of inquiry scoped to a question and a subset of entities.",
  "allOf": [
    {
      "$ref": "../../common/base-node.schema.json"
    },
    {
      "type": "object",
      "required": [
        "kind",
        "title",
        "question",
        "status",
        "priority",
        "scopeRefs"
      ],
      "properties": {
        "kind": {
          "const": "investigation.inquiry"
        },
        "parentInquiryId": {
          "$ref": "../../common/base-node.schema.json#/$defs/inquiryId"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240
        },
        "question": {
          "type": "string",
          "minLength": 1,
          "maxLength": 2000
        },
        "status": {
          "type": "string",
          "enum": ["open", "paused", "closed", "merged"]
        },
        "priority": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "scopeRefs": {
          "$ref": "../../common/base-node.schema.json#/$defs/refList"
        },
        "summary": {
          "type": "string",
          "maxLength": 4000
        },
        "resolutionKind": {
          "type": "string",
          "enum": ["rejected", "merged", "deprioritized", "resolved"]
        },
        "closedAt": {
          "type": "string",
          "format": "date-time"
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "status": {
                "enum": ["closed", "merged"]
              }
            },
            "required": ["status"]
          },
          "then": {
            "required": ["closedAt", "resolutionKind"]
          }
        }
      ]
    }
  ],
  "unevaluatedProperties": false,
  "examples": [
    {
      "kind": "investigation.inquiry",
      "id": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "revision": 1,
      "createdAt": "2026-04-04T10:03:00+09:00",
      "createdBy": {
        "actorType": "agent",
        "actorId": "claude-code",
        "sessionId": "sess_001"
      },
      "title": "队列重复消费线",
      "question": "是否存在重复消费导致状态回退？",
      "status": "open",
      "priority": "high",
      "scopeRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N",
        "entity_01JQ9Y4X7Y8Z9A0B1C2D3E4F5G"
      ],
      "labels": ["queue", "worker", "branch"]
    }
  ]
}
```

---

# 5) `schemas/commands/v1/decision.record.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/decision.record.request.schema.json",
  "title": "Command Request - investigation.decision.record",
  "description": "Request schema for recording a formal decision via MCP tool investigation.decision.record.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "title",
    "decisionKind",
    "statement"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "inquiryId": {
      "type": "string",
      "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "decisionKind": {
      "type": "string",
      "enum": [
        "close_inquiry",
        "reject_hypothesis",
        "favor_hypothesis",
        "ready_to_patch",
        "accept_residual",
        "declare_root_cause",
        "deprioritize_branch",
        "escalate_sampling",
        "close_case"
      ]
    },
    "statement": {
      "type": "string",
      "minLength": 1,
      "maxLength": 4000
    },
    "supportingFactIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^fact_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "supportingExperimentIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^experiment_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "supportingHypothesisIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "affectedRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "acceptedResidualRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^residual_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "blockedByGapRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^gap_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "rationale": {
      "type": "string",
      "maxLength": 4000
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": false
    }
  },
  "anyOf": [
    {
      "required": ["supportingFactIds"]
    },
    {
      "required": ["supportingExperimentIds"]
    }
  ],
  "allOf": [
    {
      "if": {
        "properties": {
          "decisionKind": { "const": "accept_residual" }
        },
        "required": ["decisionKind"]
      },
      "then": {
        "required": ["acceptedResidualRefs"]
      }
    },
    {
      "if": {
        "properties": {
          "decisionKind": {
            "enum": ["favor_hypothesis", "declare_root_cause", "ready_to_patch"]
          }
        },
        "required": ["decisionKind"]
      },
      "then": {
        "required": ["supportingHypothesisIds"]
      }
    }
  ],
  "examples": [
    {
      "idempotencyKey": "decision-record-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
      "title": "进入修复准备",
      "decisionKind": "ready_to_patch",
      "statement": "重复消费导致状态回退的机制已获得足够支持，可进入修复与验证阶段。",
      "supportingFactIds": [
        "fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2"
      ],
      "supportingExperimentIds": [
        "experiment_01JQA0AJ2B3C4D5E6F7G8H9JKL"
      ],
      "supportingHypothesisIds": [
        "hypothesis_01JQ9Z12AB34CD56EF78GH90JK"
      ],
      "affectedRefs": [
        "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N"
      ],
      "rationale": "关键现象已被覆盖，区分性实验已完成，剩余残差不阻塞修复。",
      "returnSnapshot": true
    }
  ]
}
```

---

# 6) `schemas/commands/v1/experiment.record_result.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/experiment.record_result.request.schema.json",
  "title": "Command Request - investigation.experiment.record_result",
  "description": "Request schema for recording the outcome of an experiment via MCP tool investigation.experiment.record_result.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "experimentId",
    "status",
    "resultSummary"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "experimentId": {
      "type": "string",
      "pattern": "^experiment_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "status": {
      "type": "string",
      "enum": ["completed", "inconclusive", "canceled"]
    },
    "startedAt": {
      "type": "string",
      "format": "date-time"
    },
    "completedAt": {
      "type": "string",
      "format": "date-time"
    },
    "resultSummary": {
      "type": "string",
      "minLength": 1,
      "maxLength": 4000
    },
    "producedArtifactIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^artifact_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "producedFactIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^fact_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "observedOutcomes": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "uniqueItems": true
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": false
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "status": {
            "enum": ["completed", "inconclusive"]
          }
        },
        "required": ["status"]
      },
      "then": {
        "required": ["completedAt"]
      }
    }
  ],
  "examples": [
    {
      "idempotencyKey": "experiment-result-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "experimentId": "experiment_01JQA0AJ2B3C4D5E6F7G8H9JKL",
      "status": "completed",
      "startedAt": "2026-04-04T10:30:00+09:00",
      "completedAt": "2026-04-04T10:42:00+09:00",
      "resultSummary": "绕过队列后旧状态未再出现，结果更支持重复消费解释而非缓存失效解释。",
      "producedArtifactIds": [
        "artifact_01JQA1D32E4R5T6Y7U8I9O0P1A"
      ],
      "producedFactIds": [
        "fact_01JQA1F54G6H7J8K9L0M1N2P3Q"
      ],
      "observedOutcomes": [
        "绕过队列后连续 10 次重放均未出现旧状态",
        "缓存读取路径未出现额外异常"
      ],
      "returnSnapshot": true
    }
  ]
}
```

---

# 7) `schemas/resources/v1/hypothesis.panel.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/resources/v1/hypothesis.panel.schema.json",
  "title": "Resource - Hypothesis Panel",
  "description": "Read-only materialized view for a single hypothesis, including evidence, conflicts, experiments, gaps, residuals, and decisions.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "kind",
    "schemaVersion",
    "caseId",
    "generatedAt",
    "caseRevision",
    "hypothesis",
    "supportingFacts",
    "contradictingFacts",
    "linkedExperiments",
    "openResiduals",
    "blockingGaps",
    "recentDecisions"
  ],
  "properties": {
    "kind": {
      "const": "investigation.resource.hypothesis_panel"
    },
    "schemaVersion": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "caseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "hypothesis": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "inquiryId",
        "title",
        "statement",
        "level",
        "status",
        "falsificationCriteria",
        "explainsSymptomIds"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
        },
        "inquiryId": {
          "type": "string",
          "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
        },
        "title": { "type": "string" },
        "statement": { "type": "string" },
        "level": {
          "type": "string",
          "enum": ["phenomenon", "mechanism", "trigger", "root_cause"]
        },
        "status": {
          "type": "string",
          "enum": [
            "proposed",
            "active",
            "favored",
            "weakened",
            "rejected",
            "confirmed"
          ]
        },
        "confidence": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "explainsSymptomIds": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^symptom_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "uniqueItems": true
        },
        "falsificationCriteria": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1
        },
        "aboutRefs": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "uniqueItems": true
        }
      }
    },
    "supportingFacts": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "statement", "factKind", "polarity", "sourceArtifactIds"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^fact_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "statement": { "type": "string" },
          "factKind": {
            "type": "string",
            "enum": [
              "direct_observation",
              "aggregate_observation",
              "test_result",
              "absence_observation",
              "manual_report"
            ]
          },
          "polarity": {
            "type": "string",
            "enum": ["positive", "negative"]
          },
          "confidence": {
            "type": "string",
            "enum": ["low", "medium", "high"]
          },
          "sourceArtifactIds": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^artifact_[0-9A-HJKMNP-TV-Z]{26}$"
            },
            "minItems": 1,
            "uniqueItems": true
          }
        }
      }
    },
    "contradictingFacts": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "statement", "factKind", "polarity", "sourceArtifactIds"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^fact_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "statement": { "type": "string" },
          "factKind": {
            "type": "string",
            "enum": [
              "direct_observation",
              "aggregate_observation",
              "test_result",
              "absence_observation",
              "manual_report"
            ]
          },
          "polarity": {
            "type": "string",
            "enum": ["positive", "negative"]
          },
          "confidence": {
            "type": "string",
            "enum": ["low", "medium", "high"]
          },
          "sourceArtifactIds": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^artifact_[0-9A-HJKMNP-TV-Z]{26}$"
            },
            "minItems": 1,
            "uniqueItems": true
          }
        }
      }
    },
    "linkedExperiments": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "title", "status", "method"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^experiment_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "title": { "type": "string" },
          "status": {
            "type": "string",
            "enum": [
              "planned",
              "running",
              "completed",
              "inconclusive",
              "canceled"
            ]
          },
          "method": {
            "type": "string",
            "enum": [
              "search",
              "instrumentation",
              "reproduction",
              "compare_versions",
              "fault_injection",
              "binary_search",
              "test_run",
              "patch_probe"
            ]
          },
          "resultSummary": {
            "type": "string"
          }
        }
      }
    },
    "openResiduals": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "statement", "severity", "status"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^residual_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "statement": { "type": "string" },
          "severity": {
            "type": "string",
            "enum": ["low", "medium", "high", "critical"]
          },
          "status": {
            "type": "string",
            "enum": ["open", "reduced", "resolved", "accepted"]
          }
        }
      }
    },
    "blockingGaps": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "question", "priority", "status"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^gap_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "question": { "type": "string" },
          "priority": {
            "type": "string",
            "enum": ["low", "medium", "high"]
          },
          "status": {
            "type": "string",
            "enum": ["open", "in_progress", "blocked", "resolved", "waived"]
          }
        }
      }
    },
    "recentDecisions": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "title", "decisionKind", "createdAt"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^decision_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "title": { "type": "string" },
          "decisionKind": {
            "type": "string",
            "enum": [
              "close_inquiry",
              "reject_hypothesis",
              "favor_hypothesis",
              "ready_to_patch",
              "accept_residual",
              "declare_root_cause",
              "deprioritize_branch",
              "escalate_sampling",
              "close_case"
            ]
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      }
    }
  },
  "examples": [
    {
      "kind": "investigation.resource.hypothesis_panel",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "generatedAt": "2026-04-04T11:05:00+09:00",
      "caseRevision": 22,
      "hypothesis": {
        "id": "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
        "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
        "title": "重复消费导致状态回退",
        "statement": "worker 重复消费旧版本消息，导致 DB 中订单状态被较旧事件覆盖，读路径随后缓存旧值。",
        "level": "mechanism",
        "status": "favored",
        "confidence": "high",
        "explainsSymptomIds": [
          "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y"
        ],
        "falsificationCriteria": [
          "若禁用队列重放后仍可稳定复现，则该假设显著削弱。",
          "若数据库写入版本严格单调且无回退，则该假设不成立。"
        ],
        "aboutRefs": [
          "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N",
          "entity_01JQ9Y4X7Y8Z9A0B1C2D3E4F5G"
        ]
      },
      "supportingFacts": [
        {
          "id": "fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2",
          "statement": "在同一 orderId 上观察到重复消息消费",
          "factKind": "direct_observation",
          "polarity": "positive",
          "confidence": "high",
          "sourceArtifactIds": [
            "artifact_01JQ9Y5H2K4M6N8P0Q2R4S6T8U"
          ]
        }
      ],
      "contradictingFacts": [],
      "linkedExperiments": [
        {
          "id": "experiment_01JQA0AJ2B3C4D5E6F7G8H9JKL",
          "title": "绕过队列验证状态回退机制",
          "status": "completed",
          "method": "reproduction",
          "resultSummary": "绕过队列后旧状态未再出现。"
        }
      ],
      "openResiduals": [
        {
          "id": "residual_01JQA15N2P3Q4R5S6T7U8V9WXY",
          "statement": "tenant A 特异性尚未解释",
          "severity": "medium",
          "status": "open"
        }
      ],
      "blockingGaps": [
        {
          "id": "gap_01JQA14B2C3D4E5F6G7H8J9KLM",
          "question": "为什么问题主要出现在高并发订单，而低流量时基本不出现？",
          "priority": "high",
          "status": "open"
        }
      ],
      "recentDecisions": [
        {
          "id": "decision_01JQA0QW2E3R4T5Y6U7I8O9P0A",
          "title": "进入修复准备",
          "decisionKind": "ready_to_patch",
          "createdAt": "2026-04-04T10:45:00+09:00"
        }
      ]
    }
  ]
}
```

---

# 8) `schemas/common/command-result.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/common/command-result.schema.json",
  "title": "Investigation Command Result",
  "description": "Structured result payload for MCP write commands. Intended for structuredContent.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "kind",
    "schemaVersion",
    "commandName",
    "caseId",
    "ok",
    "generatedAt"
  ],
  "properties": {
    "kind": {
      "const": "investigation.command_result"
    },
    "schemaVersion": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "commandName": {
      "type": "string",
      "pattern": "^investigation\\.[a-z_]+\\.[a-z_]+$"
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "ok": {
      "type": "boolean"
    },
    "commandId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128
    },
    "eventId": {
      "type": "string",
      "pattern": "^evt_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "createdIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "updatedIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "warnings": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["code", "message"],
        "properties": {
          "code": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "message": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "field": {
            "type": "string",
            "maxLength": 256
          }
        }
      }
    },
    "snapshotDelta": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "caseRevision": {
          "type": "integer",
          "minimum": 1
        },
        "status": {
          "type": "string",
          "enum": ["active", "blocked", "ready_to_patch", "validating", "closed"]
        },
        "stage": {
          "type": "string",
          "enum": [
            "intake",
            "scoping",
            "evidence_collection",
            "hypothesis_competition",
            "discriminative_testing",
            "repair_preparation",
            "repair_validation",
            "closed"
          ]
        },
        "counts": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "activeHypotheses": {
              "type": "integer",
              "minimum": 0
            },
            "openGaps": {
              "type": "integer",
              "minimum": 0
            },
            "openResiduals": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      }
    },
    "resourceHints": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "uri"
      },
      "uniqueItems": true
    },
    "errorCode": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128
    },
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 4000
    },
    "retryable": {
      "type": "boolean"
    },
    "violations": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["rule", "severity", "message"],
        "properties": {
          "rule": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128
          },
          "severity": {
            "type": "string",
            "enum": ["error", "warning"]
          },
          "message": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "field": {
            "type": "string",
            "maxLength": 256
          }
        }
      }
    }
  },
  "allOf": [
    {
      "if": {
        "properties": { "ok": { "const": true } },
        "required": ["ok"]
      },
      "then": {
        "required": ["eventId"],
        "not": {
          "anyOf": [
            { "required": ["errorCode"] },
            { "required": ["violations"] }
          ]
        }
      }
    },
    {
      "if": {
        "properties": { "ok": { "const": false } },
        "required": ["ok"]
      },
      "then": {
        "required": ["errorCode", "message", "violations"]
      }
    }
  ],
  "examples": [
    {
      "kind": "investigation.command_result",
      "schemaVersion": "1.0.0",
      "commandName": "investigation.fact.assert",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "generatedAt": "2026-04-04T10:12:31+09:00",
      "ok": true,
      "commandId": "cmd_01JQA1T12B3C4D5E6F7G8H9JKL",
      "eventId": "evt_01JQA1V34M5N6P7Q8R9S0T1UVW",
      "createdIds": [
        "fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2"
      ],
      "updatedIds": [],
      "warnings": [],
      "snapshotDelta": {
        "caseRevision": 7,
        "status": "active",
        "stage": "evidence_collection",
        "counts": {
          "activeHypotheses": 2,
          "openGaps": 1,
          "openResiduals": 0
        }
      },
      "resourceHints": [
        "investigation://cases/case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S/snapshot"
      ]
    },
    {
      "kind": "investigation.command_result",
      "schemaVersion": "1.0.0",
      "commandName": "investigation.hypothesis.propose",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "generatedAt": "2026-04-04T10:22:00+09:00",
      "ok": false,
      "commandId": "cmd_01JQA1Y56Z7A8B9C0D1E2F3G4H",
      "errorCode": "HYPOTHESIS_MISSING_FALSIFIER",
      "message": "Hypothesis must provide at least one falsification criterion.",
      "retryable": true,
      "violations": [
        {
          "rule": "hypothesis_falsifiable_required",
          "severity": "error",
          "message": "falsificationCriteria is required.",
          "field": "falsificationCriteria"
        }
      ]
    }
  ]
}
```

---

继续。下面是这一批 7 个文件的首版草案。

这一批的目标很明确：

* 把**案件入口**补齐：`case.open`
* 把**现象/缺口/残差写入**补齐：`symptom.report`、`gap.open`、`residual.open`
* 把**时间线 / 覆盖率**两个关键资源补齐
* 把**修复门禁**做成独立、可机器判定的结构化结果

我先给两个实现约定，避免后面 schema 被误用：

## 两个实现约定

### 约定 1

`investigation.guardrail.ready_to_patch_check` 的结果**不走**通用 `command-result.schema.json`。
它更像一个**结构化判定结果**，因此单独用 `ready-to-patch.result.schema.json` 更合适。

### 约定 2

下面几个语义规则不适合仅靠 JSON Schema 表达，建议作为**运行时语义校验**：

* `symptom.report` 不应把因果解释写进 symptom 文本
* `gap.open` 不应写成泛泛的“需要更多信息”
* `residual.open` 应是“当前解释不了的剩余现象”，而不是新 symptom 的替代品

---

# 1) `schemas/commands/v1/case.open.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/case.open.request.schema.json",
  "title": "Command Request - investigation.case.open",
  "description": "Request schema for opening a new case via MCP tool investigation.case.open. Server assigns caseId and initializes status/stage.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "title",
    "objective",
    "severity"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "objective": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "severity": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"]
    },
    "environment": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "initialSummary": {
      "type": "string",
      "maxLength": 4000
    },
    "owner": {
      "type": "object",
      "additionalProperties": false,
      "required": ["actorType", "actorId"],
      "properties": {
        "actorType": {
          "type": "string",
          "enum": ["agent", "user", "system"]
        },
        "actorId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 256
        }
      }
    },
    "bootstrapInquiry": {
      "type": "object",
      "additionalProperties": false,
      "required": ["title", "question", "priority", "scopeRefs"],
      "properties": {
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 240
        },
        "question": {
          "type": "string",
          "minLength": 1,
          "maxLength": 2000
        },
        "priority": {
          "type": "string",
          "enum": ["low", "medium", "high"]
        },
        "scopeRefs": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "minItems": 1,
          "uniqueItems": true
        }
      }
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": true
    }
  },
  "examples": [
    {
      "idempotencyKey": "case-open-20260404-001",
      "title": "订单状态偶发回退",
      "objective": "定位导致订单详情页显示旧状态的根因",
      "severity": "high",
      "environment": ["prod"],
      "initialSummary": "支付成功后 1-3 分钟内，部分订单详情页仍显示 pending。",
      "owner": {
        "actorType": "agent",
        "actorId": "claude-code"
      },
      "bootstrapInquiry": {
        "title": "首条侦查线",
        "question": "现象最可能首先发生在哪条链路？",
        "priority": "high",
        "scopeRefs": [
          "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N"
        ]
      },
      "labels": ["order", "stale-read", "prod"],
      "returnSnapshot": true
    }
  ]
}
```

---

# 2) `schemas/commands/v1/symptom.report.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/symptom.report.request.schema.json",
  "title": "Command Request - investigation.symptom.report",
  "description": "Request schema for reporting a symptom via MCP tool investigation.symptom.report. Symptom text should describe the phenomenon, not the cause.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "statement",
    "severity",
    "reproducibility"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "statement": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "severity": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"]
    },
    "reproducibility": {
      "type": "string",
      "enum": ["always", "often", "intermittent", "rare", "unknown"]
    },
    "critical": {
      "type": "boolean",
      "default": false
    },
    "timeWindow": {
      "type": "object",
      "additionalProperties": false,
      "required": ["start", "end"],
      "properties": {
        "start": {
          "type": "string",
          "format": "date-time"
        },
        "end": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "environment": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "affectedRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": false
    }
  },
  "examples": [
    {
      "idempotencyKey": "symptom-report-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "title": "订单详情页显示旧状态",
      "statement": "部分订单在支付成功后 1-3 分钟内，详情页仍显示 pending。",
      "severity": "high",
      "reproducibility": "intermittent",
      "critical": true,
      "environment": ["prod"],
      "affectedRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N",
        "entity_01JQ9Y4X7Y8Z9A0B1C2D3E4F5G"
      ],
      "labels": ["order", "stale-read"],
      "returnSnapshot": true
    }
  ]
}
```

---

# 3) `schemas/commands/v1/gap.open.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/gap.open.request.schema.json",
  "title": "Command Request - investigation.gap.open",
  "description": "Request schema for opening a key unknown via MCP tool investigation.gap.open.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "question",
    "priority"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "inquiryId": {
      "type": "string",
      "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "question": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "priority": {
      "type": "string",
      "enum": ["low", "medium", "high"]
    },
    "blockedRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "aboutRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": false
    }
  },
  "examples": [
    {
      "idempotencyKey": "gap-open-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
      "title": "高并发触发条件未解释",
      "question": "为什么问题主要出现在高并发订单，而低流量时基本不出现？",
      "priority": "high",
      "blockedRefs": [
        "hypothesis_01JQ9Z12AB34CD56EF78GH90JK"
      ],
      "aboutRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N"
      ],
      "labels": ["trigger", "concurrency"],
      "returnSnapshot": true
    }
  ]
}
```

---

# 4) `schemas/commands/v1/residual.open.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/residual.open.request.schema.json",
  "title": "Command Request - investigation.residual.open",
  "description": "Request schema for opening an unexplained residual via MCP tool investigation.residual.open.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "statement",
    "severity",
    "relatedSymptomIds"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "inquiryId": {
      "type": "string",
      "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "statement": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "severity": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"]
    },
    "relatedSymptomIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^symptom_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "aboutRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": false
    }
  },
  "examples": [
    {
      "idempotencyKey": "residual-open-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "title": "tenant 特异性未解释",
      "statement": "当前假设尚不能解释为何 tenant A 的复现概率显著高于其他 tenant。",
      "severity": "medium",
      "relatedSymptomIds": [
        "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y"
      ],
      "aboutRefs": [
        "entity_01JQA18A2B3C4D5E6F7G8H9JKL"
      ],
      "labels": ["tenant", "residual"],
      "returnSnapshot": true
    }
  ]
}
```

---

# 5) `schemas/resources/v1/case.timeline.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/resources/v1/case.timeline.schema.json",
  "title": "Resource - Case Timeline",
  "description": "Read-only chronological event view for a case.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "kind",
    "schemaVersion",
    "caseId",
    "generatedAt",
    "caseRevision",
    "entries"
  ],
  "properties": {
    "kind": {
      "const": "investigation.resource.case_timeline"
    },
    "schemaVersion": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "caseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "window": {
      "type": "object",
      "additionalProperties": false,
      "required": ["start", "end"],
      "properties": {
        "start": {
          "type": "string",
          "format": "date-time"
        },
        "end": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "hasMore": {
      "type": "boolean",
      "default": false
    },
    "nextCursor": {
      "type": "string",
      "maxLength": 256
    },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "eventId",
          "eventType",
          "occurredAt",
          "category",
          "summary",
          "actor",
          "objectIds"
        ],
        "properties": {
          "eventId": {
            "type": "string",
            "pattern": "^evt_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "eventType": {
            "type": "string",
            "minLength": 1,
            "maxLength": 256
          },
          "commandName": {
            "type": "string",
            "pattern": "^investigation\\.[a-z_]+\\.[a-z_]+$"
          },
          "occurredAt": {
            "type": "string",
            "format": "date-time"
          },
          "category": {
            "type": "string",
            "enum": [
              "case",
              "symptom",
              "artifact",
              "fact",
              "hypothesis",
              "experiment",
              "gap",
              "residual",
              "decision",
              "guardrail"
            ]
          },
          "summary": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "actor": {
            "type": "object",
            "additionalProperties": false,
            "required": ["actorType", "actorId"],
            "properties": {
              "actorType": {
                "type": "string",
                "enum": ["agent", "user", "system", "adapter", "tool_runner"]
              },
              "actorId": {
                "type": "string",
                "minLength": 1,
                "maxLength": 256
              },
              "sessionId": {
                "type": "string",
                "maxLength": 256
              }
            }
          },
          "inquiryId": {
            "type": "string",
            "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "objectIds": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
            },
            "minItems": 1,
            "uniqueItems": true
          },
          "resourceHints": {
            "type": "array",
            "items": {
              "type": "string",
              "format": "uri"
            },
            "uniqueItems": true
          }
        }
      }
    }
  },
  "examples": [
    {
      "kind": "investigation.resource.case_timeline",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "generatedAt": "2026-04-04T11:10:00+09:00",
      "caseRevision": 24,
      "window": {
        "start": "2026-04-04T10:00:00+09:00",
        "end": "2026-04-04T11:10:00+09:00"
      },
      "hasMore": false,
      "entries": [
        {
          "eventId": "evt_01JQA1V34M5N6P7Q8R9S0T1UVW",
          "eventType": "io.yourorg.investigation.case.opened",
          "commandName": "investigation.case.open",
          "occurredAt": "2026-04-04T10:00:00+09:00",
          "category": "case",
          "summary": "新案件已创建。",
          "actor": {
            "actorType": "agent",
            "actorId": "claude-code",
            "sessionId": "sess_001"
          },
          "objectIds": [
            "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S"
          ],
          "resourceHints": [
            "investigation://cases/case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S/snapshot"
          ]
        },
        {
          "eventId": "evt_01JQA1X56Y7Z8A9B0C1D2E3F4G",
          "eventType": "io.yourorg.investigation.fact.asserted",
          "commandName": "investigation.fact.assert",
          "occurredAt": "2026-04-04T10:12:31+09:00",
          "category": "fact",
          "summary": "记录事实：在同一 orderId 上观察到重复消息消费。",
          "actor": {
            "actorType": "agent",
            "actorId": "claude-code",
            "sessionId": "sess_001"
          },
          "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
          "objectIds": [
            "fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2"
          ]
        }
      ]
    }
  ]
}
```

---

# 6) `schemas/resources/v1/coverage.report.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/resources/v1/coverage.report.schema.json",
  "title": "Resource - Coverage Report",
  "description": "Read-only coverage view showing which entities and symptoms have direct evidence, indirect inference, or no coverage.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "kind",
    "schemaVersion",
    "caseId",
    "generatedAt",
    "caseRevision",
    "summary",
    "entityCoverage",
    "symptomCoverage"
  ],
  "properties": {
    "kind": {
      "const": "investigation.resource.coverage_report"
    },
    "schemaVersion": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "caseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "summary": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "totalEntities",
        "directEvidenceEntities",
        "indirectOnlyEntities",
        "uncoveredEntities",
        "criticalSymptomsCovered",
        "criticalSymptomsUncovered"
      ],
      "properties": {
        "totalEntities": {
          "type": "integer",
          "minimum": 0
        },
        "directEvidenceEntities": {
          "type": "integer",
          "minimum": 0
        },
        "indirectOnlyEntities": {
          "type": "integer",
          "minimum": 0
        },
        "uncoveredEntities": {
          "type": "integer",
          "minimum": 0
        },
        "criticalSymptomsCovered": {
          "type": "integer",
          "minimum": 0
        },
        "criticalSymptomsUncovered": {
          "type": "integer",
          "minimum": 0
        }
      }
    },
    "entityCoverage": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref",
          "coverageLevel",
          "directArtifactCount",
          "directFactCount",
          "indirectHypothesisCount",
          "openGapCount"
        ],
        "properties": {
          "ref": {
            "type": "string",
            "pattern": "^entity_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "entityKind": {
            "type": "string",
            "enum": [
              "service",
              "module",
              "file",
              "function",
              "class",
              "api",
              "db",
              "table",
              "queue",
              "topic",
              "cache",
              "config",
              "tenant",
              "workflow",
              "external_api"
            ]
          },
          "name": {
            "type": "string",
            "maxLength": 240
          },
          "coverageLevel": {
            "type": "string",
            "enum": ["direct_evidence", "indirect_inference", "none"]
          },
          "directArtifactCount": {
            "type": "integer",
            "minimum": 0
          },
          "directFactCount": {
            "type": "integer",
            "minimum": 0
          },
          "indirectHypothesisCount": {
            "type": "integer",
            "minimum": 0
          },
          "openGapCount": {
            "type": "integer",
            "minimum": 0
          },
          "openResidualCount": {
            "type": "integer",
            "minimum": 0
          },
          "notes": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 500
            },
            "uniqueItems": true
          }
        }
      }
    },
    "symptomCoverage": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "symptomId",
          "statement",
          "severity",
          "coverageStatus"
        ],
        "properties": {
          "symptomId": {
            "type": "string",
            "pattern": "^symptom_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "statement": {
            "type": "string",
            "maxLength": 2000
          },
          "severity": {
            "type": "string",
            "enum": ["low", "medium", "high", "critical"]
          },
          "coverageStatus": {
            "type": "string",
            "enum": ["covered", "partially_covered", "uncovered"]
          },
          "supportingFactCount": {
            "type": "integer",
            "minimum": 0
          },
          "activeHypothesisCount": {
            "type": "integer",
            "minimum": 0
          },
          "openResidualCount": {
            "type": "integer",
            "minimum": 0
          }
        }
      }
    },
    "blindSpots": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["kind", "ref", "message"],
        "properties": {
          "kind": {
            "type": "string",
            "enum": ["entity", "symptom", "inquiry"]
          },
          "ref": {
            "type": "string",
            "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "message": {
            "type": "string",
            "maxLength": 1000
          }
        }
      }
    }
  },
  "examples": [
    {
      "kind": "investigation.resource.coverage_report",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "generatedAt": "2026-04-04T11:15:00+09:00",
      "caseRevision": 24,
      "summary": {
        "totalEntities": 6,
        "directEvidenceEntities": 3,
        "indirectOnlyEntities": 2,
        "uncoveredEntities": 1,
        "criticalSymptomsCovered": 1,
        "criticalSymptomsUncovered": 0
      },
      "entityCoverage": [
        {
          "ref": "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N",
          "entityKind": "queue",
          "name": "order-event-queue",
          "coverageLevel": "direct_evidence",
          "directArtifactCount": 2,
          "directFactCount": 2,
          "indirectHypothesisCount": 1,
          "openGapCount": 1,
          "openResidualCount": 0,
          "notes": [
            "已具备直接日志与事实支撑。"
          ]
        },
        {
          "ref": "entity_01JQA18A2B3C4D5E6F7G8H9JKL",
          "entityKind": "tenant",
          "name": "tenant A",
          "coverageLevel": "none",
          "directArtifactCount": 0,
          "directFactCount": 0,
          "indirectHypothesisCount": 0,
          "openGapCount": 0,
          "openResidualCount": 1,
          "notes": [
            "仍无直接证据覆盖。"
          ]
        }
      ],
      "symptomCoverage": [
        {
          "symptomId": "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y",
          "statement": "部分订单在支付成功后 1-3 分钟内，详情页仍显示 pending。",
          "severity": "high",
          "coverageStatus": "covered",
          "supportingFactCount": 2,
          "activeHypothesisCount": 2,
          "openResidualCount": 1
        }
      ],
      "blindSpots": [
        {
          "kind": "entity",
          "ref": "entity_01JQA18A2B3C4D5E6F7G8H9JKL",
          "message": "tenant 维度尚无直接 artifact 或 fact。"
        }
      ]
    }
  ]
}
```

---

# 7) `schemas/guardrails/v1/ready-to-patch.result.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/guardrails/v1/ready-to-patch.result.schema.json",
  "title": "Guardrail Result - Ready To Patch",
  "description": "Structured result payload for investigation.guardrail.ready_to_patch_check.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "kind",
    "schemaVersion",
    "caseId",
    "generatedAt",
    "caseRevision",
    "pass",
    "overallStatus",
    "checks"
  ],
  "properties": {
    "kind": {
      "const": "investigation.guardrail.ready_to_patch_result"
    },
    "schemaVersion": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "caseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "pass": {
      "type": "boolean"
    },
    "overallStatus": {
      "type": "string",
      "enum": ["pass", "warning", "block"]
    },
    "candidateHypothesisIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "candidatePatchRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "blockingGapIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^gap_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "blockingResidualIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^residual_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "uncoveredCriticalSymptomIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^symptom_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "incompleteExperimentIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^experiment_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "checks": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["rule", "status", "message"],
        "properties": {
          "rule": {
            "type": "string",
            "enum": [
              "favored_or_confirmed_hypothesis_present",
              "critical_symptoms_covered",
              "critical_gaps_cleared",
              "critical_residuals_cleared_or_accepted",
              "discriminative_experiment_completed",
              "candidate_patch_scope_defined"
            ]
          },
          "status": {
            "type": "string",
            "enum": ["pass", "warning", "block"]
          },
          "message": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "refs": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
            },
            "uniqueItems": true
          }
        }
      }
    },
    "reasons": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 1000
      },
      "uniqueItems": true
    },
    "recommendedNextActions": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 1000
      },
      "uniqueItems": true
    },
    "resourceHints": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "uri"
      },
      "uniqueItems": true
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "pass": { "const": true }
        },
        "required": ["pass"]
      },
      "then": {
        "properties": {
          "overallStatus": {
            "enum": ["pass", "warning"]
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "pass": { "const": false }
        },
        "required": ["pass"]
      },
      "then": {
        "properties": {
          "overallStatus": {
            "const": "block"
          }
        }
      }
    }
  ],
  "examples": [
    {
      "kind": "investigation.guardrail.ready_to_patch_result",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "generatedAt": "2026-04-04T11:20:00+09:00",
      "caseRevision": 26,
      "pass": false,
      "overallStatus": "block",
      "candidateHypothesisIds": [
        "hypothesis_01JQ9Z12AB34CD56EF78GH90JK"
      ],
      "candidatePatchRefs": [
        "entity_01JQ9Y4C5D6F7G8H9J0K1L2M3N"
      ],
      "blockingGapIds": [
        "gap_01JQA14B2C3D4E5F6G7H8J9KLM"
      ],
      "blockingResidualIds": [],
      "uncoveredCriticalSymptomIds": [],
      "incompleteExperimentIds": [],
      "checks": [
        {
          "rule": "favored_or_confirmed_hypothesis_present",
          "status": "pass",
          "message": "已存在 favored hypothesis。",
          "refs": [
            "hypothesis_01JQ9Z12AB34CD56EF78GH90JK"
          ]
        },
        {
          "rule": "critical_symptoms_covered",
          "status": "pass",
          "message": "所有 critical symptoms 已被覆盖。"
        },
        {
          "rule": "critical_gaps_cleared",
          "status": "block",
          "message": "仍存在阻塞关键判断的 open high-priority gap。",
          "refs": [
            "gap_01JQA14B2C3D4E5F6G7H8J9KLM"
          ]
        },
        {
          "rule": "critical_residuals_cleared_or_accepted",
          "status": "pass",
          "message": "不存在未处理的 critical residual。"
        },
        {
          "rule": "discriminative_experiment_completed",
          "status": "pass",
          "message": "至少一个关键区分性实验已完成。",
          "refs": [
            "experiment_01JQA0AJ2B3C4D5E6F7G8H9JKL"
          ]
        },
        {
          "rule": "candidate_patch_scope_defined",
          "status": "pass",
          "message": "候选修复范围已明确。"
        }
      ],
      "reasons": [
        "高优先级 gap 仍未关闭。"
      ],
      "recommendedNextActions": [
        "优先补充与高并发触发条件相关的直接证据。",
        "若决定接受该 gap，需先记录正式 decision。"
      ],
      "resourceHints": [
        "investigation://cases/case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S/snapshot",
        "investigation://cases/case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S/coverage"
      ]
    }
  ]
}
```

---

## 到这里，MCP 的“最小可运行面”已经接近封板

现在你已经有了：

### 写入面

* `case.open`
* `symptom.report`
* `fact.assert`
* `hypothesis.propose`
* `experiment.plan`
* `experiment.record_result`
* `gap.open`
* `residual.open`
* `decision.record`

### 读取面

* `case.snapshot`
* `case.timeline`
* `coverage.report`
* `hypothesis.panel`

### 约束面

* `command-result`
* `ready-to-patch.result`

这已经足够做一个真正能约束 agent 的 MCP server，而不是记事本。

---

收到，这一轮只做**收口**。
下面直接给最后这 6 个文件，补完后这套规范就可以先**冻结为 v0.1**，后面再切话题。

---

# 1) `schemas/commands/v1/hypothesis.update_status.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/hypothesis.update_status.request.schema.json",
  "title": "Command Request - investigation.hypothesis.update_status",
  "description": "Request schema for updating hypothesis status via MCP tool investigation.hypothesis.update_status.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "hypothesisId",
    "newStatus"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "hypothesisId": {
      "type": "string",
      "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "newStatus": {
      "type": "string",
      "enum": [
        "active",
        "favored",
        "weakened",
        "rejected",
        "confirmed"
      ]
    },
    "confidence": {
      "type": "string",
      "enum": ["low", "medium", "high"]
    },
    "reasonSummary": {
      "type": "string",
      "maxLength": 4000
    },
    "reasonFactIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^fact_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "reasonExperimentIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^experiment_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "supersedesHypothesisIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": false
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "newStatus": {
            "enum": ["favored", "weakened", "rejected", "confirmed"]
          }
        },
        "required": ["newStatus"]
      },
      "then": {
        "required": ["reasonSummary"],
        "anyOf": [
          { "required": ["reasonFactIds"] },
          { "required": ["reasonExperimentIds"] }
        ]
      }
    }
  ],
  "examples": [
    {
      "idempotencyKey": "hypothesis-update-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "hypothesisId": "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
      "newStatus": "favored",
      "confidence": "high",
      "reasonSummary": "区分性实验完成后，结果更支持重复消费解释。",
      "reasonFactIds": [
        "fact_01JQA1F54G6H7J8K9L0M1N2P3Q"
      ],
      "reasonExperimentIds": [
        "experiment_01JQA0AJ2B3C4D5E6F7G8H9JKL"
      ],
      "returnSnapshot": true
    }
  ]
}
```

---

# 2) `schemas/commands/v1/gap.resolve.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/gap.resolve.request.schema.json",
  "title": "Command Request - investigation.gap.resolve",
  "description": "Request schema for resolving or waiving a gap via MCP tool investigation.gap.resolve.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "gapId",
    "status",
    "resolutionSummary"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "gapId": {
      "type": "string",
      "pattern": "^gap_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "status": {
      "type": "string",
      "enum": ["resolved", "waived"]
    },
    "resolutionSummary": {
      "type": "string",
      "minLength": 1,
      "maxLength": 4000
    },
    "resolutionFactIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^fact_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "resolutionExperimentIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^experiment_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "waivedReason": {
      "type": "string",
      "maxLength": 2000
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": false
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "status": { "const": "resolved" }
        },
        "required": ["status"]
      },
      "then": {
        "anyOf": [
          { "required": ["resolutionFactIds"] },
          { "required": ["resolutionExperimentIds"] }
        ]
      }
    },
    {
      "if": {
        "properties": {
          "status": { "const": "waived" }
        },
        "required": ["status"]
      },
      "then": {
        "required": ["waivedReason"]
      }
    }
  ],
  "examples": [
    {
      "idempotencyKey": "gap-resolve-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "gapId": "gap_01JQA14B2C3D4E5F6G7H8J9KLM",
      "status": "resolved",
      "resolutionSummary": "通过新增并发压测与日志采样，已确认高并发触发与重复消费窗口扩大有关。",
      "resolutionFactIds": [
        "fact_01JQB1A23B4C5D6E7F8G9H0JKL"
      ],
      "resolutionExperimentIds": [
        "experiment_01JQB19MN2P3Q4R5S6T7U8V9WX"
      ],
      "returnSnapshot": true
    }
  ]
}
```

---

# 3) `schemas/commands/v1/residual.update.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/residual.update.request.schema.json",
  "title": "Command Request - investigation.residual.update",
  "description": "Request schema for updating residual status via MCP tool investigation.residual.update.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "residualId",
    "newStatus"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "residualId": {
      "type": "string",
      "pattern": "^residual_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "newStatus": {
      "type": "string",
      "enum": ["reduced", "resolved", "accepted"]
    },
    "updateSummary": {
      "type": "string",
      "maxLength": 4000
    },
    "reasonFactIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^fact_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "reasonHypothesisIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^hypothesis_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "acceptedReason": {
      "type": "string",
      "maxLength": 2000
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": false
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "newStatus": {
            "enum": ["reduced", "resolved"]
          }
        },
        "required": ["newStatus"]
      },
      "then": {
        "required": ["updateSummary"],
        "anyOf": [
          { "required": ["reasonFactIds"] },
          { "required": ["reasonHypothesisIds"] }
        ]
      }
    },
    {
      "if": {
        "properties": {
          "newStatus": { "const": "accepted" }
        },
        "required": ["newStatus"]
      },
      "then": {
        "required": ["acceptedReason"]
      }
    }
  ],
  "examples": [
    {
      "idempotencyKey": "residual-update-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "residualId": "residual_01JQA15N2P3Q4R5S6T7U8V9WXY",
      "newStatus": "resolved",
      "updateSummary": "tenant A 特异性可由其特殊流量峰值分布解释。",
      "reasonFactIds": [
        "fact_01JQB1D45E6F7G8H9J0K1L2M3N"
      ],
      "reasonHypothesisIds": [
        "hypothesis_01JQB1H78J9K0L1M2N3P4Q5RST"
      ],
      "returnSnapshot": true
    }
  ]
}
```

---

# 4) `schemas/commands/v1/case.advance_stage.request.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/commands/v1/case.advance_stage.request.schema.json",
  "title": "Command Request - investigation.case.advance_stage",
  "description": "Request schema for advancing case stage via MCP tool investigation.case.advance_stage. Semantic validation of allowed transitions must be enforced at runtime.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "idempotencyKey",
    "caseId",
    "targetStage",
    "rationale"
  ],
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 8,
      "maxLength": 128
    },
    "ifCaseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "targetStage": {
      "type": "string",
      "enum": [
        "intake",
        "scoping",
        "evidence_collection",
        "hypothesis_competition",
        "discriminative_testing",
        "repair_preparation",
        "repair_validation",
        "closed"
      ]
    },
    "rationale": {
      "type": "string",
      "minLength": 1,
      "maxLength": 4000
    },
    "supportingDecisionIds": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^decision_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "supportingRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
      },
      "uniqueItems": true
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "uniqueItems": true
    },
    "returnSnapshot": {
      "type": "boolean",
      "default": true
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "targetStage": {
            "enum": ["repair_preparation", "repair_validation", "closed"]
          }
        },
        "required": ["targetStage"]
      },
      "then": {
        "anyOf": [
          { "required": ["supportingDecisionIds"] },
          { "required": ["supportingRefs"] }
        ]
      }
    }
  ],
  "examples": [
    {
      "idempotencyKey": "case-advance-20260404-001",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "targetStage": "repair_preparation",
      "rationale": "关键现象已被覆盖，区分性实验已完成，候选修复范围明确。",
      "supportingDecisionIds": [
        "decision_01JQA0QW2E3R4T5Y6U7I8O9P0A"
      ],
      "returnSnapshot": true
    }
  ]
}
```

---

# 5) `schemas/guardrails/v1/stall-check.result.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/guardrails/v1/stall-check.result.schema.json",
  "title": "Guardrail Result - Stall Check",
  "description": "Structured result payload for investigation.guardrail.stall_check.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "kind",
    "schemaVersion",
    "caseId",
    "generatedAt",
    "caseRevision",
    "stalled",
    "stallRisk",
    "overallStatus",
    "signals"
  ],
  "properties": {
    "kind": {
      "const": "investigation.guardrail.stall_check_result"
    },
    "schemaVersion": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "caseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "stalled": {
      "type": "boolean"
    },
    "stallRisk": {
      "type": "string",
      "enum": ["low", "medium", "high"]
    },
    "overallStatus": {
      "type": "string",
      "enum": ["ok", "warning", "stalled"]
    },
    "window": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "recentEventCount": {
          "type": "integer",
          "minimum": 1
        },
        "since": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "signals": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["code", "severity", "message"],
        "properties": {
          "code": {
            "type": "string",
            "enum": [
              "NO_NEW_FACT_RECENTLY",
              "NO_BRANCH_CLOSURE_RECENTLY",
              "SAME_INQUIRY_REVISITED",
              "SAME_ENTITY_LOOP",
              "TOO_MANY_ACTIVE_HYPOTHESES",
              "EXPERIMENTS_NOT_DISCRIMINATIVE",
              "OPEN_GAPS_STAGNANT",
              "OPEN_RESIDUALS_STAGNANT"
            ]
          },
          "severity": {
            "type": "string",
            "enum": ["info", "warning", "block"]
          },
          "message": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "refs": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
            },
            "uniqueItems": true
          },
          "metric": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {
                "type": "string",
                "maxLength": 128
              },
              "value": {
                "type": "number"
              },
              "threshold": {
                "type": "number"
              }
            }
          }
        }
      }
    },
    "recommendedActions": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 1000
      },
      "uniqueItems": true
    },
    "resourceHints": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "uri"
      },
      "uniqueItems": true
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "stalled": { "const": true }
        },
        "required": ["stalled"]
      },
      "then": {
        "properties": {
          "overallStatus": { "const": "stalled" },
          "stallRisk": { "const": "high" }
        }
      }
    },
    {
      "if": {
        "properties": {
          "stalled": { "const": false }
        },
        "required": ["stalled"]
      },
      "then": {
        "properties": {
          "overallStatus": {
            "enum": ["ok", "warning"]
          }
        }
      }
    }
  ],
  "examples": [
    {
      "kind": "investigation.guardrail.stall_check_result",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "generatedAt": "2026-04-04T11:25:00+09:00",
      "caseRevision": 28,
      "stalled": true,
      "stallRisk": "high",
      "overallStatus": "stalled",
      "window": {
        "recentEventCount": 8,
        "since": "2026-04-04T10:55:00+09:00"
      },
      "signals": [
        {
          "code": "NO_NEW_FACT_RECENTLY",
          "severity": "block",
          "message": "最近 8 次写入中没有新增 fact。",
          "metric": {
            "name": "recent_new_fact_count",
            "value": 0,
            "threshold": 1
          }
        },
        {
          "code": "SAME_INQUIRY_REVISITED",
          "severity": "warning",
          "message": "连续多轮围绕同一 inquiry 空转。",
          "refs": [
            "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q"
          ]
        },
        {
          "code": "EXPERIMENTS_NOT_DISCRIMINATIVE",
          "severity": "block",
          "message": "最近实验未能显著区分竞争假设。"
        }
      ],
      "recommendedActions": [
        "优先补充尚无直接证据覆盖的 blind spot。",
        "关闭低价值假设分支，重新收缩活跃假设数。",
        "设计一项明确区分 H1 与 H2 的新实验。"
      ],
      "resourceHints": [
        "investigation://cases/case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S/coverage",
        "investigation://cases/case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S/timeline"
      ]
    }
  ]
}
```

---

# 6) `schemas/resources/v1/case.graph.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.yourorg.ai/investigation/resources/v1/case.graph.schema.json",
  "title": "Resource - Case Graph",
  "description": "Read-only graph projection for a case.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "kind",
    "schemaVersion",
    "caseId",
    "generatedAt",
    "caseRevision",
    "nodes",
    "edges"
  ],
  "properties": {
    "kind": {
      "const": "investigation.resource.case_graph"
    },
    "schemaVersion": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$"
    },
    "caseId": {
      "type": "string",
      "pattern": "^case_[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "caseRevision": {
      "type": "integer",
      "minimum": 1
    },
    "view": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "inquiryId": {
          "type": "string",
          "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
        },
        "centerRef": {
          "type": "string",
          "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
        },
        "depth": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5
        }
      }
    },
    "stats": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "nodeCount": {
          "type": "integer",
          "minimum": 0
        },
        "edgeCount": {
          "type": "integer",
          "minimum": 0
        }
      }
    },
    "nodes": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "kind", "label"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "kind": {
            "type": "string",
            "enum": [
              "case",
              "inquiry",
              "entity",
              "symptom",
              "artifact",
              "fact",
              "hypothesis",
              "experiment",
              "gap",
              "residual",
              "decision"
            ]
          },
          "label": {
            "type": "string",
            "minLength": 1,
            "maxLength": 240
          },
          "status": {
            "type": "string",
            "maxLength": 64
          },
          "severity": {
            "type": "string",
            "enum": ["low", "medium", "high", "critical"]
          },
          "inquiryId": {
            "type": "string",
            "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 64
            },
            "uniqueItems": true
          }
        }
      }
    },
    "edges": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["from", "to", "rel"],
        "properties": {
          "from": {
            "type": "string",
            "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "to": {
            "type": "string",
            "pattern": "^[a-z]+_[0-9A-HJKMNP-TV-Z]{26}$"
          },
          "rel": {
            "type": "string",
            "enum": [
              "contains",
              "about",
              "evidences",
              "supports",
              "contradicts",
              "explains",
              "depends_on",
              "tests",
              "produces",
              "blocks",
              "addresses",
              "unresolved_by",
              "supersedes"
            ]
          },
          "weight": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "inquiryId": {
            "type": "string",
            "pattern": "^inquiry_[0-9A-HJKMNP-TV-Z]{26}$"
          }
        }
      }
    }
  },
  "examples": [
    {
      "kind": "investigation.resource.case_graph",
      "schemaVersion": "1.0.0",
      "caseId": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
      "generatedAt": "2026-04-04T11:30:00+09:00",
      "caseRevision": 30,
      "view": {
        "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
        "depth": 2
      },
      "stats": {
        "nodeCount": 8,
        "edgeCount": 10
      },
      "nodes": [
        {
          "id": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
          "kind": "case",
          "label": "订单状态偶发回退",
          "status": "active"
        },
        {
          "id": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
          "kind": "inquiry",
          "label": "队列重复消费线",
          "status": "open"
        },
        {
          "id": "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y",
          "kind": "symptom",
          "label": "支付成功后详情页仍显示 pending",
          "severity": "high"
        },
        {
          "id": "fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2",
          "kind": "fact",
          "label": "观察到重复消息消费"
        },
        {
          "id": "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
          "kind": "hypothesis",
          "label": "重复消费导致状态回退",
          "status": "favored",
          "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q"
        },
        {
          "id": "experiment_01JQA0AJ2B3C4D5E6F7G8H9JKL",
          "kind": "experiment",
          "label": "绕过队列验证状态回退机制",
          "status": "completed",
          "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q"
        },
        {
          "id": "gap_01JQA14B2C3D4E5F6G7H8J9KLM",
          "kind": "gap",
          "label": "高并发触发条件未解释",
          "status": "open",
          "inquiryId": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q"
        },
        {
          "id": "residual_01JQA15N2P3Q4R5S6T7U8V9WXY",
          "kind": "residual",
          "label": "tenant 特异性未解释",
          "status": "open"
        }
      ],
      "edges": [
        {
          "from": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
          "to": "inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q",
          "rel": "contains"
        },
        {
          "from": "case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S",
          "to": "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y",
          "rel": "contains"
        },
        {
          "from": "fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2",
          "to": "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
          "rel": "supports"
        },
        {
          "from": "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
          "to": "symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y",
          "rel": "explains"
        },
        {
          "from": "experiment_01JQA0AJ2B3C4D5E6F7G8H9JKL",
          "to": "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
          "rel": "tests"
        },
        {
          "from": "gap_01JQA14B2C3D4E5F6G7H8J9KLM",
          "to": "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
          "rel": "blocks"
        },
        {
          "from": "residual_01JQA15N2P3Q4R5S6T7U8V9WXY",
          "to": "hypothesis_01JQ9Z12AB34CD56EF78GH90JK",
          "rel": "unresolved_by"
        }
      ]
    }
  ]
}
```

---


---

## Part 4：办案监管台 PRD

下面是收口后的 **《办案监管台 PRD v0.1》**。
我按“可立项、可设计、可开发、可验收”四个标准写，默认它是你前面那套 **Investigation Profile / MCP-native Investigation Server** 之上的**人类监管与分析界面**。

---

# 办案监管台 PRD v0.1

## 1. 文档信息

**产品名称**
办案监管台（Investigation Console）

**版本**
PRD v0.1

**产品定位**
为复杂长链路问题中的 agent 办案过程提供**可视化监管、审计、回放和人工介入**能力，避免调查过程成为不可监察的黑盒。

**依赖前提**
底层已存在：

* Investigation Server
* 统一案件对象模型
* MCP tools / resources
* 事件流与 revision 机制
* guardrail 结果输出

---

## 2. 背景与问题

### 2.1 背景

当前 coding agent 在复杂问题上常见的问题不是“不会找证据”，而是：

* 把猜测写成事实
* 局部循环论证
* 丢失前面调查结论
* 过早收敛到单一叙事
* patch 前缺少门禁
* 最终结论无法被人类快速审计

你前面设计的“办案图”已经解决了**结构化状态持久化**的问题，但如果没有面向人的监管界面，它仍然会退化成：

* 只有 agent 看得懂的内部状态
* 只有服务端日志能追的黑盒
* 人类只能看最终结论，看不到中间推理纪律

### 2.2 核心问题

本产品要解决的不是“替 agent 做分析”，而是：

1. **让用户看见 agent 正在查什么**
2. **让用户追溯 agent 为什么得出这个结论**
3. **让用户识别盲区、循环和空心结论**
4. **让用户在关键时刻介入并约束 agent**

---

## 3. 产品目标

### 3.1 目标

办案监管台需要达成 5 个目标：

1. **透明化**
   把 agent 的案件状态、假设竞争、证据路径、实验进展、门禁状态可视化。

2. **可审计**
   任意结论都能一键回溯到 supporting facts / experiments / artifacts。

3. **可干预**
   用户可以通过界面驱动底层 MCP 命令，对案件进行显式约束，而不是只能旁观。

4. **可回放**
   支持 revision/time-based 回放，定位“从哪里开始进入错误叙事或死循环”。

5. **可落地**
   首版产品必须在不依赖重型图数据库 UI 的前提下完成。

### 3.2 非目标

本产品首版**不负责**：

* 自动生成证据链
* 自动判断根因
* 自动推荐 patch
* 自动做日志解析或事实抽取
* 成为全功能 observability 平台
* 成为通用知识图谱工作台

---

## 4. 用户与角色

### 4.1 目标用户

#### A. 一线开发者

使用 Claude Code / Codex / OpenCode / OpenClaw 等 agent 处理问题，需要实时看 agent 是否在乱查、漏查、空转。

#### B. 技术负责人 / Reviewer

在 patch 前审计 agent 结论，判断是否允许继续修改代码。

#### C. 平台/工具开发者

验证 Investigation Server 是否正确工作，检查 schema、resource、guardrail 是否正常。

### 4.2 角色权限

#### Viewer

* 只读查看案件
* 查看 graph / timeline / coverage / hypothesis panel
* 导出截图/链接

#### Operator

* 具备 Viewer 权限
* 可通过 UI 触发已有 MCP 命令：

  * symptom.report
  * gap.open / resolve
  * residual.open / update
  * hypothesis.update_status
  * decision.record
  * case.advance_stage

#### Reviewer

* 具备 Operator 权限
* 可执行高风险裁决：

  * ready_to_patch 相关 decision
  * residual accepted
  * gap waived
  * close_case / stage advancement to repair_validation / closed

#### Admin

* 配置 server endpoint、认证、项目级默认视图、审计导出

---

## 5. 用户场景

### 场景 1：实时监督

用户让 agent 排查复杂问题，打开监管台，快速判断：

* 现在卡在哪个 inquiry
* 有没有 active hypothesis
* 有没有 open gap / residual
* 有没有 stall risk

### 场景 2：审计结论

agent 说“已经定位根因”。用户打开 hypothesis panel，检查：

* supporting facts 是否真实存在
* 是否有反证未处理
* residual 是否仍然 open
* ready_to_patch 是否被 block

### 场景 3：识别死循环

用户发现最近 10 分钟 agent 一直在同一个模块绕。通过 stall view 查看：

* 最近是否没有新增 fact
* 是否反复进入同一 inquiry
* 最近实验是否没有区分力

### 场景 4：人工补约束

用户不接受当前叙事，通过 UI：

* 新开 gap
* 标记某 residual 不能接受
* 降级某 hypothesis
* 要求先补某 blind spot

### 场景 5：事后复盘

问题处理结束后，通过 timeline + revision diff 回放整个调查过程，用于：

* 复盘 agent 的问题
* 优化 workflow
* 输出 postmortem

---

## 6. 产品方案概述

## 6.1 产品形态

采用双形态：

### 形态 A：独立 Web Console

默认形态，适用于所有 MCP host，不依赖宿主实现特定 UI 扩展。

### 形态 B：嵌入式 MCP App

增强形态。对于支持 MCP Apps 的宿主，可由工具声明 `ui://` 资源，宿主拉取 UI 资源并在会话内以沙箱 iframe 形式渲染，从而实现“在 agent 对话内直接打开监管台”的体验。MCP Apps 的官方设计就是让工具描述关联交互式 UI 资源，并由宿主安全渲染；其运行环境是受宿主控制的 sandboxed iframe，并通过受控消息通道与宿主通信。([模型上下文协议][1])

## 6.2 集成方式

办案监管台底层遵循 MCP-first 架构。MCP 当前采用 JSON-RPC 数据层，核心原语包括 tools、resources、prompts 和通知；本地通常通过 stdio 接入，远程通常通过 Streamable HTTP 接入。MCP 生命周期包含初始化、能力协商、正常运行和优雅关闭。([模型上下文协议][2])

本产品中：

* **写操作**：走 MCP tools
* **读状态**：走 MCP resources
* **内嵌 UI**：可选走 MCP Apps
* **实时更新**：优先使用 resources subscribe / listChanged
* **调试验证**：开发阶段用 MCP Inspector 验证 tools/resources/notifications 行为。([模型上下文协议][3])

---

## 7. 产品原则

### 7.1 审计优先

任何图形化展示都必须服务于可审计，而不是装饰性可视化。

### 7.2 Slice-first

默认展示局部子图，不展示全局大图。

### 7.3 Evidence-first

所有结论必须优先暴露 supporting / contradicting evidence，而不是只显示一个“最终判断”。

### 7.4 Human-in-the-loop

工具调用与高风险状态变更必须有明确可见的人工控制。MCP 官方 tools 规范明确建议宿主提供清晰的工具暴露说明、工具调用可视指示和确认机制，以保证 human in the loop。([模型上下文协议][4])

### 7.5 Read-first, Write-controlled

UI 首先是监管台，其次才是操作台。
写操作不允许直接编辑图；必须走同一套 MCP command pipeline。

---

## 8. 价值主张

### 对用户

* 不再盲信 agent
* 可以快速判断 agent 是否在正确调查
* patch 前有明确门禁
* 复杂问题可以被真正复盘

### 对 agent 平台

* 推理过程从黑盒变成可审计对象
* 可以量化 stall、coverage、ready_to_patch
* 支持更严格的人机协作闭环

### 对团队

* 复杂案件可共享
* 复盘可沉淀
* 便于治理复杂问题中的 agent 质量

---

## 9. MVP 范围

首版监管台范围与主技术方案保持一致，至少覆盖以下 8 个核心界面能力：

1. Case List
2. Snapshot
3. Graph Scene
4. Inspector
5. Timeline / Revision
6. Coverage
7. Guardrails
8. 人工介入面板

### 首版允许的写操作

* hypothesis.update_status
* gap.open / resolve
* residual.open / update
* decision.record
* case.advance_stage

### 首版不做

* 自由图编辑
* 通用评论系统
* 多用户协同光标
* 图上拖拽排布持久化
* 自动生成 next best step
* 多 case 联邦总图

---

## 10. 信息架构

## 10.1 顶层信息架构

### `/cases`

案件列表页

### `/cases/:caseId`

案件工作台，包含标签页：

* Snapshot
* Graph
* Timeline
* Coverage
* Guardrails

### `/cases/:caseId/hypotheses/:hypothesisId`

可深链直达 hypothesis panel

### `/settings`

连接、认证、显示偏好

## 10.2 页面布局

案件工作台采用固定布局：

### 左栏：导航与过滤

* Case 基本信息
* Inquiry 列表
* Filters
* Saved Views

### 中央：主内容区

* Snapshot 卡片区 / Graph Scene / Timeline / Coverage 视图

### 右栏：Inspector

* 当前选中节点详情
* 支撑证据
* 冲突证据
* 相关实验
* 可执行操作

### 底部：时间轴/Revision 条

* revision slider
* diff quick jump
* live event stream

---

## 11. 功能需求

## 11.1 模块 A：案件列表（Case List）

### 目标

让用户快速找到值得监管的案件。

### 功能

* 列出所有 case
* 支持按状态筛选：

  * active
  * blocked
  * ready_to_patch
  * validating
  * closed
* 支持按 severity、stage、stallRisk、更新时间排序
* 支持搜索 title / label / caseId

### 展示字段

* case title
* severity
* stage
* active hypotheses count
* open gaps count
* open residuals count
* stall risk
* updated at

### 验收标准

* 用户在 10 秒内找到最近活跃高风险案件
* 过滤器变更后列表刷新 < 500ms（本地）
* 搜索支持 title / label 模糊匹配

---

## 11.2 模块 B：Snapshot

### 目标

用一个页面回答“现在这个案件处于什么状态”。

### 功能

* 展示当前 case 基础信息
* 展示 top active hypotheses
* 展示 open gaps / residuals
* 展示 recent experiments / recent decisions
* 展示 ready_to_patch 摘要
* 展示 stall risk 摘要

### 数据来源

* `case.snapshot`
* `ready-to-patch.result`
* `stall-check.result`

### 核心交互

* 点击 hypothesis 进入 hypothesis panel
* 点击 gap/residual 打开 inspector
* 点击 ready_to_patch block reason 跳转相关节点

### 验收标准

* 用户打开案件后 1 屏内看全主要风险
* 任一 block reason 最多 2 次点击可追到具体对象

---

## 11.3 模块 C：Graph Scene

### 目标

可视化当前 inquiry / hypothesis / decision 的证据关系，而不是画整案全图。

### 默认视图策略

默认不展示 full graph，只展示三种 slice：

1. **Inquiry Slice**
2. **Hypothesis Neighborhood**
3. **Decision Evidence Path**

### 节点类型

* Case
* Inquiry
* Entity
* Symptom
* Artifact
* Fact
* Hypothesis
* Experiment
* Gap
* Residual
* Decision

### 边类型（默认显示）

* supports
* contradicts
* explains
* tests
* blocks
* unresolved_by

### 核心交互

* 点击节点 -> 右侧 inspector
* 双击 hypothesis -> 高亮支持/反证路径
* 双击 decision -> 高亮完整证据链
* 过滤只看某 inquiry / 某 severity / 某 status
* 开关弱关系边（about / contains / depends_on）

### 验收标准

* 默认场景节点数控制在可读范围内
* 用户点击一个 favored hypothesis，3 秒内看见其证据路径
* 图视图中不存在必须依赖 hover 才能理解的关键信息

---

## 11.4 模块 D：Inspector

### 目标

让所有节点都能被深入审查。

### 节点详情要求

#### Fact

* statement
* factKind
* polarity
* sourceArtifactIds
* timeWindow
* confidence

#### Hypothesis

* statement
* level
* status
* confidence
* explainsSymptomIds
* falsificationCriteria
* supporting facts
* contradicting facts
* linked experiments
* open gaps / residuals

#### Experiment

* objective
* method
* testsHypothesisIds
* expectedOutcomes
* resultSummary
* produced facts / artifacts

#### Decision

* decisionKind
* statement
* supporting evidence
* affected refs
* rationale

#### Gap / Residual

* question/statement
* priority or severity
* blocked refs / related symptoms
* resolution or accepted reason

### 验收标准

* 所有节点都必须有结构化 inspector
* 不允许节点详情只显示 JSON 原文
* 任意 Decision 都能在 inspector 中看到 supporting facts/experiments

---

## 11.5 模块 E：Timeline / Revision

### 目标

让用户看见调查过程，而不是只看当前状态。

### 功能

* 时间线事件列表
* revision slider
* 按 revision 回放状态
* 比较 revision N 与 N-1 的变化
* 快速定位：

  * hypothesis 状态变化
  * decision 产生
  * gap 被 waived
  * residual 被 accepted

### 数据来源

* `case.timeline`

### 核心交互

* 点击事件 -> 高亮相关对象
* 切换 revision -> graph / snapshot 同步回放
* 过滤只看 hypothesis / experiment / guardrail 类事件

### 验收标准

* 用户可在 30 秒内回答“这条 hypothesis 为什么从 active 变 favored”
* revision 切换后，graph 和 inspector 必须同步

---

## 11.6 模块 F：Coverage

### 目标

显示调查盲区。

### 功能

* entity coverage 表
* symptom coverage 表
* blind spots 列表
* 区分：

  * direct evidence
  * indirect inference
  * none

### 数据来源

* `coverage.report`

### 核心交互

* 点击 blind spot -> 图中高亮
* 一键按 uncovered entity 过滤 graph
* 一键创建 gap（Operator 以上）

### 验收标准

* 用户可以在 15 秒内发现“哪些实体没有直接证据”
* Coverage 页面必须能明确区分“无证据”和“只有推断”

---

## 11.7 模块 G：Guardrails

### 目标

把底层门禁转化为用户可判断、可执行的监管动作。

### 需要支持的 guardrails

* `ready_to_patch_check`
* `stall_check`

### 展示内容

#### Ready to Patch

* pass / warning / block
* candidate hypotheses
* candidate patch refs
* blocking gaps
* blocking residuals
* uncovered critical symptoms
* incomplete experiments

#### Stall Check

* stalled / risk level
* 具体 signals
* recommended actions

### 核心交互

* 点击 block reason 定位对象
* 点击 recommended action 跳到对应视图
* 高风险时显示全局 warning banner

### 验收标准

* 用户可在 10 秒内判断“能不能 patch”
* stall signals 不能只是数字，必须有自然语言解释

---

## 11.8 模块 H：人工介入面板

### 目标

让用户通过 UI 调用已有 MCP tools，对案件做最小但关键的约束。

### 首版支持操作

* 更新 hypothesis 状态
* 新开 / 关闭 gap
* 新开 / 更新 residual
* 记录 decision
* 推进 case stage

### 约束

* 所有写操作走 MCP tool，不直接改数据库
* 高风险操作弹确认
* 写入后必须生成可回放事件

MCP 官方 tools 规范明确建议宿主对工具调用提供清晰指示与确认机制，因此高风险写操作必须经过显式确认。([模型上下文协议][4])

### 验收标准

* 用户从 inspector 可直接发起操作
* 所有操作成功后 timeline 中可见
* 写入失败时必须展示 violations / errorCode / message

---

## 12. 关键流程

## 12.1 监控流程

1. 用户打开 case
2. 看 Snapshot
3. 若 stall risk 高 -> 切 Guardrails
4. 若 hypothesis 可疑 -> 进 Hypothesis Panel
5. 若需要看脉络 -> 打开 Graph + Timeline

## 12.2 审计流程

1. 用户看到 ready_to_patch = block/pass
2. 点 candidate hypothesis
3. 检查 supporting / contradicting facts
4. 检查 residual / gap
5. 通过或记录新 decision

## 12.3 干预流程

1. 用户发现 blind spot
2. 在 Coverage 中点某 uncovered entity
3. 打开 inspector
4. 新开 gap 或更新 hypothesis status
5. 观察 timeline / snapshot 变化

---

## 13. 交互与体验要求

## 13.1 交互原则

* 单击：选中
* 双击：高亮证据路径
* Shift + 点击：多选比较
* 时间线切 revision：全局同步
* 图与右侧 inspector 永远联动

## 13.2 可用性要求

* 默认视图必须可直接读懂
* 不要求用户理解图论
* 不依赖拖拽编辑来完成核心任务
* 默认状态永远优先显示“风险与阻塞”

## 13.3 搜索与过滤

支持按以下维度过滤：

* inquiry
* hypothesis status
* severity
* stage
* entity
* only uncovered
* only blocking
* only favored

---

## 14. 数据与集成要求

## 14.1 读接口

主要使用 MCP resources：

* `investigation://cases/{caseId}/snapshot`
* `.../graph`
* `.../timeline`
* `.../coverage`
* `.../hypotheses/{hypothesisId}`

MCP resources 是 URI 标识的上下文对象；官方规范也明确说明 host 可以通过树、列表、搜索、过滤等界面方式暴露资源，并可选支持 subscribe 与 listChanged，用于资源变化通知。([模型上下文协议][3])

## 14.2 写接口

主要使用 MCP tools：

* `investigation.hypothesis.update_status`
* `investigation.gap.open`
* `investigation.gap.resolve`
* `investigation.residual.open`
* `investigation.residual.update`
* `investigation.decision.record`
* `investigation.case.advance_stage`

## 14.3 实时更新

优先级：

1. resources subscribe
2. listChanged + read
3. polling fallback

---

## 15. 技术与部署设计

## 15.1 部署模式

### 本地模式

* Investigation Server 通过 stdio/本地进程工作
* Console 作为本地 web app 连接本地 server
* 适合个人开发者

### 远程模式

* Investigation Server 通过 Streamable HTTP 暴露
* Console 作为远程 web app / 内网控制台
* 适合团队协作

MCP 官方当前定义的标准传输为 stdio 和 Streamable HTTP，本地和远程模式都能落在这两个标准路径上。([模型上下文协议][5])

## 15.2 宿主嵌入策略

### MVP

独立 Web Console

### 增强版

支持宿主内嵌 MCP App：

* 工具描述关联 `ui://` 资源
* 宿主预加载资源
* 宿主在沙箱 iframe 中渲染
* 应用通过受控通道请求 host 能力

这样可以在支持 MCP Apps 的宿主里获得“边聊边审”的体验。([模型上下文协议][1])

---

## 16. 非功能需求

## 16.1 性能

* 案件打开首屏 < 2 秒（本地）
* 图切片切换 < 1 秒
* revision 切换 < 1 秒
* Inspector 打开 < 300ms

## 16.2 稳定性

* 写操作失败不能破坏当前读视图
* 资源读失败时要有降级态
* timeline 不因个别事件解析失败整体崩溃

## 16.3 安全

* 默认只读
* 高风险写操作确认
* 权限分级
* 所有裁决可追责到 actor/session

## 16.4 可审计

* 所有写操作必须进入 timeline
* 所有 decision 必须能追到 supporting evidence
* revision 必须可回看

## 16.5 可观测

* 页面级埋点
* MCP 调用成功率
* guardrail 告警数量
* 页面性能监控

---

## 17. 指标设计

## 17.1 北极星指标

**复杂案件中“可审计结论占比”**

定义：

* 有 formal decision
* 且 decision 可回溯到 facts/experiments
* 且用户至少查看过一次 hypothesis panel 或 ready_to_patch guardrail

## 17.2 核心业务指标

| 指标             | 定义                              |
| -------------- | ------------------------------- |
| 审计覆盖率          | 有人工打开监管台的案件比例                   |
| 结论可追溯率         | decision 具备完整 evidence path 的比例 |
| stall 发现时长     | 从 stall 产生到用户首次看到的时间            |
| patch 前门禁通过率   | 进入修复前先跑 ready_to_patch 的比例      |
| 误修复率下降         | 引入监管台后，被回滚/否决的 patch 比例变化       |
| blind spot 关闭率 | uncovered entity 在案件生命周期中被补证的比例 |

## 17.3 体验指标

* 首次打开案件到完成审计 < 3 分钟
* 用户定位 block 原因的平均点击数 ≤ 3
* hypothesis 证据路径查看完成率

---

## 18. 版本规划

## MVP

* Case List
* Snapshot
* Graph Slice
* Inspector
* Timeline
* Coverage
* Ready to Patch / Stall
* 基础写操作面板

## V1.1

* 宿主内嵌 MCP App
* revision diff 对比增强
* 保存视图 / 深链
* 多 inquiry 并行比较

## V1.2

* 团队协作权限
* 复盘模式
* 导出审计包
* 案件模板

---

## 19. 风险与应对

## 风险 1：图太复杂，用户看不懂

**应对**：默认只展示 graph slice，不展示全图。

## 风险 2：界面成了另一个黑盒

**应对**：所有图上状态都必须能点穿到 inspector 和 timeline。

## 风险 3：用户不愿意打开独立控制台

**应对**：MVP 保持独立 Web；后续支持 MCP Apps 内嵌，以降低切换成本。([模型上下文协议][1])

## 风险 4：写操作破坏 agent 流程

**应对**：所有写入走同一 MCP command pipeline，不做 UI 直改。

## 风险 5：监管台本身性能差

**应对**：只做切片、延迟加载 inspector、timeline 分页。

---

## 20. 验收标准（上线门槛）

满足以下条件才允许进入 beta：

### 功能

* Case List、Snapshot、Graph Slice、Timeline、Coverage、Guardrails、Inspector 可用
* `guardrail.check`、`stall_check`、`ready_to_patch_check`、`close_case_check` 可用
* 5 类人工介入命令可通过 UI 成功执行
* timeline 可正确显示所有写操作事件

### 审计

* 任一 favored hypothesis 可在 3 次点击内看到 supporting evidence
* 任一 ready_to_patch block 原因可定位到具体对象
* 任一 accepted residual 可看到 accepted reason

### 性能

* 本地 2 秒内打开案件
* graph slice 切换 < 1 秒
* 右侧 inspector 打开 < 300ms

### 安全

* 高风险写操作带确认
* 只读用户不可触发写命令
* 所有写命令有 actor/session 标识

---

## 21. 最终产品定义

一句话定义：

# 办案监管台 = 面向复杂 agent 调查过程的可视化审计与干预工作台

它不是图谱浏览器，不是 observability 平台，也不是让用户手工替 agent 排查问题的 IDE。
它的职责是：

* 看见 agent 在办什么案
* 判断 agent 是否在正确办案
* 在必要时通过正式命令约束 agent
* 把整个调查过程变成可回放、可审计、可质疑的对象

---
