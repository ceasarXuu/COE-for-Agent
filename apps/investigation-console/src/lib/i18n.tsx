import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';

export type Locale = 'en' | 'zh-CN';
export const LOCALE_STORAGE_KEY = 'investigation-console.locale';

type MessageParams = Record<string, number | string>;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: MessageParams) => string;
  formatDateTime: (value: Date | number | string) => string;
  formatEnumLabel: (value: null | string | undefined) => string;
  formatEventType: (value: null | string | undefined) => string;
  compareText: (left: string, right: string) => number;
}

const MESSAGES: Record<Locale, Record<string, string>> = {
  en: {
    'root.kicker': 'COE / Investigation Console',
    'root.title': 'Investigation Console',
    'root.githubLinkLabel': 'Open the project homepage on GitHub',
    'root.languageSwitcher': 'Language',
    'root.switchToEnglish': 'Switch language to English',
    'root.switchToChinese': 'Switch language to Chinese',
    'root.cases': 'Cases',
    'cases.search': 'Search transcript',
    'cases.searchPlaceholder': 'issue, objective, title…',
    'cases.sort': 'Sort',
    'cases.sortRecent': 'Recently updated',
    'cases.sortPriority': 'Highest severity',
    'cases.sortTitle': 'Title A-Z',
    'cases.loaded': '{count} loaded',
    'cases.refreshing': 'refreshing…',
    'cases.stableProjection': 'stable projection',
    'cases.emptyKicker': 'No cases',
    'cases.emptyTitle': 'Nothing matches this query yet.',
    'cases.emptyCopy': 'Try a broader issue or objective phrase.',
    'errors.loadCases': 'Failed to load cases',
    'errors.createCase': 'Failed to create case',
    'errors.createCaseMissingId': 'Case was created without a case identifier.',
    'errors.loadWorkspace': 'Failed to load workspace',
    'errors.loadInspector': 'Failed to load inspector context.',
    'errors.mutationFailed': 'Mutation failed',
    'caseList.updated': 'Updated {dateTime}',
    'caseList.noTimestamp': 'No activity timestamp available.',
    'caseList.untitled': 'Untitled case',
    'caseList.defaultSummary': 'Manual intake is ready to capture the next investigation branch.',
    'caseList.status': 'Status',
    'caseList.stage': 'Stage',
    'caseList.revision': 'Revision',
    'caseCreate.title': 'Create a new case',
    'caseCreate.close': 'Close',
    'caseCreate.submit': 'Create case',
    'caseCreate.submitting': 'Creating…',
    'caseCreate.cancel': 'Cancel',
    'caseCreate.galleryTitle': 'New case',
    'caseCreate.galleryCopy': 'Reserve the first slot for fast case creation from the homepage gallery.',
    'caseCreate.fields.title': 'Case title',
    'caseCreate.fields.objective': 'Investigation objective',
    'caseCreate.fields.severity': 'Severity',
    'caseCreate.fields.projectDirectory': 'Project directory',
    'caseCreate.fields.labels': 'Labels',
    'caseCreate.placeholders.title': 'Queue saturation in worker fanout',
    'caseCreate.placeholders.objective': 'Summarize what needs to be understood, validated, or isolated first.',
    'caseCreate.placeholders.projectDirectory': '/workspace/customer-a',
    'caseCreate.placeholders.labels': 'manual, regression, customer-impact',
    'caseCreate.hints.projectDirectory': 'Enter the project root directory for this investigation.',
    'caseCreate.hints.labels': 'Use labels for intake source, severity theme, or owning area.',
    'caseCreate.preview.labels': 'Labels preview',
    'caseCreate.severity.critical': 'Critical',
    'caseCreate.severity.high': 'High',
    'caseCreate.severity.medium': 'Medium',
    'caseCreate.severity.low': 'Low',
    'snapshot.kicker': 'Snapshot',
    'snapshot.defaultObjective': 'Case objective becomes the branch question here.',
    'snapshot.historical': 'Historical mode is active. Writes are frozen until you return to head revision.',
    'snapshot.inquiries': 'Inquiries {count}',
    'snapshot.symptoms': 'Symptoms {count}',
    'snapshot.artifacts': 'Artifacts {count}',
    'snapshot.facts': 'Facts {count}',
    'guardrails.kicker': 'Guardrails',
    'guardrails.counts': '{warnings} warnings / {violations} violations',
    'guardrails.stall': 'Stall check',
    'guardrails.ready': 'Ready to patch',
    'guardrails.close': 'Close case',
    'revision.sync': 'Revision sync',
    'timeline.kicker': 'Timeline',
    'timeline.rev': 'rev {revision}',
    'inspector.kicker': 'Inspector',
    'inspector.loading': 'Loading branch detail…',
    'inspector.empty': 'Select a graph node to inspect its current branch context.',
    'inspector.panelKind': 'Inspector / {kind}',
    'inspector.primaryEvidence': 'Primary evidence',
    'inspector.adjacentWork': 'Adjacent work',
    'inspector.competingHypotheses': 'Competing hypotheses',
    'inspector.openExperiments': 'Open experiments',
    'inspector.noPrimaryEvidence': 'No primary evidence linked yet.',
    'inspector.noAdjacentNodes': 'No adjacent nodes in this slice.',
    'inspector.observedAbout': 'Observed about',
    'inspector.followOn': 'Follow-on implications',
    'inspector.fact.primaryEmpty': 'This fact is not linked to any explicit subject yet.',
    'inspector.fact.secondaryEmpty': 'No downstream implication has been recorded.',
    'inspector.experiment.primary': 'Linked hypotheses',
    'inspector.experiment.secondary': 'Expected outcomes',
    'inspector.experiment.primaryEmpty': 'No linked hypotheses in this slice.',
    'inspector.experiment.secondaryEmpty': 'No expected outcomes captured yet.',
    'inspector.decision.primary': 'Supporting evidence',
    'inspector.decision.secondary': 'Affected branch',
    'inspector.decision.primaryEmpty': 'No supporting evidence citation recorded.',
    'inspector.decision.secondaryEmpty': 'No downstream branch effect recorded.',
    'inspector.gap.primary': 'Blocked branch',
    'inspector.gap.secondary': 'Resolution path',
    'inspector.gap.primaryEmpty': 'No blocked branch is linked yet.',
    'inspector.gap.secondaryEmpty': 'No resolution path proposed yet.',
    'inspector.residual.primary': 'Related symptoms',
    'inspector.residual.secondary': 'Risk treatment',
    'inspector.residual.primaryEmpty': 'No related symptom is attached yet.',
    'inspector.residual.secondaryEmpty': 'No treatment posture has been recorded.',
    'workspace.back': 'Back to cases',
    'workspace.headMode': 'Head mode',
    'workspace.historicalMode': 'Historical mode / rev {revision}',
    'workspace.replaying': 'Loading workspace…',
    'workspace.diff': 'Diff Summary',
    'workspace.changedNodes': '{count} changed nodes',
    'workspace.noDiff': 'No diff',
    'workspace.compareHint': 'Move the revision slider to compare adjacent states.',
    'workspace.hypothesisFallback': 'No hypothesis statement recorded.',
    'workspace.inquiryFallback': 'No inquiry question recorded.',
    'workspace.outsideSlice': 'Selected node is outside the current graph slice.',
    'workspace.factSummary': 'Recorded fact available in the current branch slice.',
    'workspace.experimentSummary': 'Experiment state for the selected branch.',
    'workspace.experimentOutcome': 'Replay outcome captured for reviewer comparison.',
    'workspace.decisionSummary': 'Decision node recorded on the active investigation branch.',
    'workspace.gapSummary': 'Open gap that still blocks branch completion.',
    'workspace.residualSummary': 'Residual risk that still needs an explicit treatment decision.',
    'workspace.closureClear': 'Closure path is clear.',
    'workspace.closureBlocked': 'Close-case guardrail still has open blockers.',
    'workspace.selectedFromSlice': '{kind} selected from the current graph slice.',
    'action.kicker': 'Next Actions',
    'action.description': 'Promote the case into repair preparation only after the evidence branch is stable enough to justify a patch path.',
    'action.confirmRationale': 'Confirmation rationale',
    'action.confirmPlaceholder': 'State why the patch path is safe enough to escalate.',
    'action.historicalFrozen': 'Historical mode freezes mutations.',
    'action.advance': 'Advance to repair preparation',
    'action.advanceValidation': 'Advance to repair validation',
    'action.closeCase': 'Close case',
    'action.hypothesisRationale': 'Hypothesis confirmation rationale',
    'action.hypothesisPlaceholder': 'Explain why this branch is now confirmed.',
    'action.confirmHypothesis': 'Confirm hypothesis',
    'action.openGap': 'Open gap',
    'action.recordDecision': 'Record decision',
    'action.gapQuestion': 'Gap question',
    'action.gapQuestionPlaceholder': 'What still blocks {label}?',
    'action.decisionRationale': 'Decision rationale',
    'action.decisionPlaceholder': 'Capture the branch decision in reviewer language.',
    'action.gapResolution': 'Gap resolution',
    'action.gapResolutionPlaceholder': 'Describe how the blocked branch was resolved.',
    'action.resolveGap': 'Resolve gap',
    'action.residualRationale': 'Residual treatment rationale',
    'action.residualPlaceholder': 'Explain why this residual can be accepted.',
    'action.acceptResidual': 'Accept residual',
    'action.proposeHypothesis': 'Propose hypothesis',
    'action.newHypothesis': 'New hypothesis',
    'action.newHypothesisPlaceholder': 'State how {label} could be explained.',
    'action.falsificationCriteria': 'Falsification criteria',
    'action.falsificationPlaceholder': 'Describe what would disprove this hypothesis.',
    'action.planExperiment': 'Plan experiment',
    'action.experimentObjective': 'Experiment objective',
    'action.experimentObjectivePlaceholder': 'Describe the discriminative test to run next.',
    'action.expectedOutcome': 'Expected outcome',
    'action.expectedOutcomePlaceholder': 'Describe the expected signal if the hypothesis is correct.',
    'action.experimentWhen': 'If the hypothesis is correct',
    'action.recordExperimentResult': 'Record experiment result',
    'action.experimentResult': 'Experiment result',
    'action.experimentResultPlaceholder': 'Summarize the observed outcome.',
    'action.closeInquiry': 'Close inquiry',
    'action.inquiryResolution': 'Inquiry resolution',
    'action.inquiryResolutionPlaceholder': 'Explain why this inquiry can now be closed.',
    'action.openResidual': 'Open residual risk',
    'action.residualStatement': 'Residual risk statement',
    'action.residualStatementPlaceholder': 'Describe the remaining risk around {label}.',
    'action.confirmSheet': 'High-risk confirmation',
    'action.cancel': 'Cancel',
    'action.submitting': 'Submitting…',
    'action.issueConfirmation': 'Issue reviewer confirmation',
    'action.openInvestigationGap': 'Open investigation gap',
    'action.recordReadiness': 'Record readiness decision',
    'action.readinessReady': 'Patch path is ready',
    'action.readinessBranch': 'Branch triage decision',
    'action.closureRationale': 'Closure rationale',
    'action.closurePlaceholder': 'Explain why the case can now be closed safely.',
    'action.recordClosureDecision': 'Record closure decision',
    'action.closeReady': 'Case is ready to close',
    'action.acceptResidualRisk': 'Accept residual risk',
    'action.generatedHypothesisTitle': '{label} hypothesis',
    'action.generatedExperimentTitle': '{label} experiment',
    'action.generatedGapTitle': '{label} blocking issue',
    'action.generatedResidualTitle': '{label} residual risk',
    'graph.slice': 'Graph slice',
    'graph.empty': 'No nodes are available in this graph slice yet.',
    'graph.caseGraph': 'Case graph',
    'graph.focus': 'focus {id}',
    'graph.nodes': '{count} nodes',
    'graph.links': '{count} links',
    'graph.live': 'live slice',
    'graph.historical': 'historical slice',
    'graph.legend': 'Graph legend',
    'graph.controls': 'Graph controls',
    'graph.zoom': 'Zoom',
    'graph.reset': 'Reset view',
    'graph.fullscreen': 'Fullscreen',
    'graph.exitFullscreen': 'Exit fullscreen',
    'graph.zoomIn': 'Zoom in',
    'graph.zoomOut': 'Zoom out',
    'graph.zoomPercent': 'Zoom {percent}%',
    'graph.otherLane': 'Other nodes',
    'graph.revision': 'rev {revision}',
    'graph.edge.supports': 'supports',
    'graph.edge.explains': 'explains',
    'graph.edge.tests': 'tests',
    'timeline.event.case.opened': 'Case opened',
    'timeline.event.case.stage_advanced': 'Case stage advanced',
    'timeline.event.decision.recorded': 'Decision recorded',
    'timeline.event.experiment.completed': 'Experiment completed',
    'timeline.event.fact.asserted': 'Fact asserted',
    'timeline.event.gap.opened': 'Gap opened',
    'timeline.event.gap.resolved': 'Gap resolved',
    'timeline.event.hypothesis.proposed': 'Hypothesis proposed',
    'timeline.event.hypothesis.status_updated': 'Hypothesis status updated',
    'timeline.event.residual.updated': 'Residual updated',
    'timeline.event.symptom.reported': 'Symptom reported'
  },
  'zh-CN': {
    'root.kicker': 'COE / 调查控制台',
    'root.title': '调查控制台',
    'root.githubLinkLabel': '在 GitHub 中打开项目主页',
    'root.languageSwitcher': '语言',
    'root.switchToEnglish': '切换到英文',
    'root.switchToChinese': '切换到中文',
    'root.cases': '案件',
    'cases.search': '检索记录',
    'cases.searchPlaceholder': '事项、目标、标题…',
    'cases.sort': '排序',
    'cases.sortRecent': '最近更新',
    'cases.sortPriority': '严重级别优先',
    'cases.sortTitle': '标题 A-Z',
    'cases.loaded': '已加载 {count} 条',
    'cases.refreshing': '刷新中…',
    'cases.stableProjection': '投影稳定',
    'cases.emptyKicker': '暂无案件',
    'cases.emptyTitle': '当前查询还没有匹配结果。',
    'cases.emptyCopy': '试试更宽泛的事项或目标关键词。',
    'errors.loadCases': '加载案件失败',
    'errors.createCase': '创建案件失败',
    'errors.createCaseMissingId': '案件已创建，但没有返回案件标识。',
    'errors.loadWorkspace': '加载工作台失败',
    'errors.loadInspector': '加载检查器上下文失败。',
    'errors.mutationFailed': '变更执行失败',
    'caseList.updated': '更新于 {dateTime}',
    'caseList.noTimestamp': '暂无活动时间戳。',
    'caseList.untitled': '未命名案件',
    'caseList.defaultSummary': '手动受理入口已准备好，可随时记录新的调查分支。',
    'caseList.status': '状态',
    'caseList.stage': '阶段',
    'caseList.revision': '修订',
    'caseCreate.title': '新建案件',
    'caseCreate.close': '关闭',
    'caseCreate.submit': '创建案件',
    'caseCreate.submitting': '创建中…',
    'caseCreate.cancel': '取消',
    'caseCreate.galleryTitle': '新建 case',
    'caseCreate.galleryCopy': '首页画廊的第一张卡片固定用于快速创建案件。',
    'caseCreate.fields.title': '案件标题',
    'caseCreate.fields.objective': '调查目标',
    'caseCreate.fields.severity': '严重级别',
    'caseCreate.fields.projectDirectory': '项目目录',
    'caseCreate.fields.labels': '标签',
    'caseCreate.placeholders.title': 'worker fanout 队列饱和',
    'caseCreate.placeholders.objective': '概述当前要先理解、验证或隔离的核心问题。',
    'caseCreate.placeholders.projectDirectory': '/workspace/customer-a',
    'caseCreate.placeholders.labels': 'manual, regression, customer-impact',
    'caseCreate.hints.projectDirectory': '填写本次调查对应的项目根目录。',
    'caseCreate.hints.labels': '可用于标记来源、问题主题或责任域。',
    'caseCreate.preview.labels': '标签预览',
    'caseCreate.severity.critical': '严重',
    'caseCreate.severity.high': '高',
    'caseCreate.severity.medium': '中',
    'caseCreate.severity.low': '低',
    'snapshot.kicker': '快照',
    'snapshot.defaultObjective': '案件目标会在这里收敛成当前分支问题。',
    'snapshot.historical': '当前处于历史模式。返回最新修订前，所有写操作都会被冻结。',
    'snapshot.inquiries': '问题 {count}',
    'snapshot.symptoms': '症状 {count}',
    'snapshot.artifacts': '证据 {count}',
    'snapshot.facts': '事实 {count}',
    'guardrails.kicker': '护栏',
    'guardrails.counts': '{warnings} 条警告 / {violations} 条违规',
    'guardrails.stall': '停滞检查',
    'guardrails.ready': '可进入修复',
    'guardrails.close': '可关闭案件',
    'revision.sync': '修订同步',
    'timeline.kicker': '时间线',
    'timeline.rev': '修订 {revision}',
    'inspector.kicker': '检查器',
    'inspector.loading': '正在加载分支细节…',
    'inspector.empty': '选择一个图节点后，可在这里查看它在当前分支中的上下文。',
    'inspector.panelKind': '检查器 / {kind}',
    'inspector.primaryEvidence': '核心证据',
    'inspector.adjacentWork': '相邻工作',
    'inspector.competingHypotheses': '竞争假设',
    'inspector.openExperiments': '未完成实验',
    'inspector.noPrimaryEvidence': '还没有关联到核心证据。',
    'inspector.noAdjacentNodes': '当前切片中没有相邻节点。',
    'inspector.observedAbout': '观察对象',
    'inspector.followOn': '后续影响',
    'inspector.fact.primaryEmpty': '这条事实还没有明确关联到观察对象。',
    'inspector.fact.secondaryEmpty': '还没有记录下游影响。',
    'inspector.experiment.primary': '关联假设',
    'inspector.experiment.secondary': '预期结果',
    'inspector.experiment.primaryEmpty': '当前切片中没有关联假设。',
    'inspector.experiment.secondaryEmpty': '还没有记录预期结果。',
    'inspector.decision.primary': '支撑证据',
    'inspector.decision.secondary': '受影响分支',
    'inspector.decision.primaryEmpty': '还没有记录支撑证据引用。',
    'inspector.decision.secondaryEmpty': '还没有记录下游分支影响。',
    'inspector.gap.primary': '受阻分支',
    'inspector.gap.secondary': '解决路径',
    'inspector.gap.primaryEmpty': '还没有关联受阻分支。',
    'inspector.gap.secondaryEmpty': '还没有提出解决路径。',
    'inspector.residual.primary': '关联症状',
    'inspector.residual.secondary': '风险处置',
    'inspector.residual.primaryEmpty': '还没有挂接关联症状。',
    'inspector.residual.secondaryEmpty': '还没有记录风险处置方式。',
    'workspace.back': '返回案件列表',
    'workspace.headMode': '最新模式',
    'workspace.historicalMode': '历史模式 / 修订 {revision}',
    'workspace.replaying': '正在回放工作台…',
    'workspace.diff': '差异概览',
    'workspace.changedNodes': '{count} 个变更节点',
    'workspace.noDiff': '无差异',
    'workspace.compareHint': '拖动修订滑块即可比较相邻状态。',
    'workspace.hypothesisFallback': '还没有记录假设陈述。',
    'workspace.inquiryFallback': '还没有记录问题描述。',
    'workspace.outsideSlice': '选中的节点不在当前图切片中。',
    'workspace.factSummary': '这条事实已记录在当前分支切片中。',
    'workspace.experimentSummary': '这是当前分支上的实验状态。',
    'workspace.experimentOutcome': '回放结果已记录，可供审阅对比。',
    'workspace.decisionSummary': '这是一条记录在当前调查分支上的决策节点。',
    'workspace.gapSummary': '这是一个仍在阻塞分支收敛的缺口。',
    'workspace.residualSummary': '这是一个仍需明确处置决定的残余风险。',
    'workspace.closureClear': '关闭路径已清晰。',
    'workspace.closureBlocked': '关闭案件护栏仍存在未解除阻塞。',
    'workspace.selectedFromSlice': '当前图切片中选中了 {kind} 节点。',
    'action.kicker': '下一步操作',
    'action.description': '只有当证据分支已经稳定到足以支撑修复路径时，才应把案件推进到修复准备阶段。',
    'action.confirmRationale': '确认理由',
    'action.confirmPlaceholder': '说明为什么这条修复路径已经足够安全，可以升级处理。',
    'action.historicalFrozen': '历史模式下所有变更都会被冻结。',
    'action.advance': '推进到修复准备',
    'action.advanceValidation': '推进到修复验证',
    'action.closeCase': '关闭案件',
    'action.hypothesisRationale': '假设确认理由',
    'action.hypothesisPlaceholder': '说明为什么这个分支现在可以被确认。',
    'action.confirmHypothesis': '确认假设',
    'action.openGap': '创建缺口',
    'action.recordDecision': '记录决策',
    'action.gapQuestion': '缺口问题',
    'action.gapQuestionPlaceholder': '还有什么在阻塞 {label}？',
    'action.decisionRationale': '决策理由',
    'action.decisionPlaceholder': '用审阅者语言记录这次分支决策。',
    'action.gapResolution': '缺口解决方案',
    'action.gapResolutionPlaceholder': '说明这个受阻分支是如何被解除阻塞的。',
    'action.resolveGap': '解决缺口',
    'action.residualRationale': '残余风险处置理由',
    'action.residualPlaceholder': '说明为什么这个残余风险可以被接受。',
    'action.acceptResidual': '接受残余风险',
    'action.proposeHypothesis': '提出假设',
    'action.newHypothesis': '新假设',
    'action.newHypothesisPlaceholder': '说明 {label} 可能由什么机制导致。',
    'action.falsificationCriteria': '证伪条件',
    'action.falsificationPlaceholder': '描述什么证据会推翻这个假设。',
    'action.planExperiment': '规划实验',
    'action.experimentObjective': '实验目标',
    'action.experimentObjectivePlaceholder': '描述下一步要执行的判别性实验。',
    'action.expectedOutcome': '预期结果',
    'action.expectedOutcomePlaceholder': '描述假设成立时应看到的信号。',
    'action.experimentWhen': '如果该假设成立',
    'action.recordExperimentResult': '记录实验结果',
    'action.experimentResult': '实验结果',
    'action.experimentResultPlaceholder': '总结本次实验观察到的结果。',
    'action.closeInquiry': '关闭问题',
    'action.inquiryResolution': '问题结论',
    'action.inquiryResolutionPlaceholder': '说明为什么这个问题现在可以关闭。',
    'action.openResidual': '创建残余风险',
    'action.residualStatement': '残余风险描述',
    'action.residualStatementPlaceholder': '描述围绕 {label} 仍然存在的风险。',
    'action.confirmSheet': '高风险确认',
    'action.cancel': '取消',
    'action.submitting': '提交中…',
    'action.issueConfirmation': '发起审阅确认',
    'action.openInvestigationGap': '创建调查缺口',
    'action.recordReadiness': '记录就绪决策',
    'action.readinessReady': '修复路径已就绪',
    'action.readinessBranch': '分支分诊决策',
    'action.closureRationale': '结案理由',
    'action.closurePlaceholder': '说明为什么现在可以安全结案。',
    'action.recordClosureDecision': '记录结案决策',
    'action.closeReady': '案件可以关闭',
    'action.acceptResidualRisk': '接受残余风险',
    'action.generatedHypothesisTitle': '{label} 假设',
    'action.generatedExperimentTitle': '{label} 实验',
    'action.generatedGapTitle': '{label} 阻塞项',
    'action.generatedResidualTitle': '{label} 残留项',
    'graph.slice': '图切片',
    'graph.empty': '当前图切片里还没有可展示的节点。',
    'graph.caseGraph': '案件图',
    'graph.focus': '焦点 {id}',
    'graph.nodes': '{count} 个节点',
    'graph.links': '{count} 条连线',
    'graph.live': '实时切片',
    'graph.historical': '历史切片',
    'graph.legend': '案件图图例',
    'graph.controls': '案件图控制',
    'graph.zoom': '缩放',
    'graph.reset': '重置视图',
    'graph.fullscreen': '全屏查看',
    'graph.exitFullscreen': '退出全屏',
    'graph.zoomIn': '放大',
    'graph.zoomOut': '缩小',
    'graph.zoomPercent': '缩放 {percent}%',
    'graph.otherLane': '其他节点',
    'graph.revision': '修订 {revision}',
    'graph.edge.supports': '支撑',
    'graph.edge.explains': '解释',
    'graph.edge.tests': '验证',
    'timeline.event.case.opened': '案件已创建',
    'timeline.event.case.stage_advanced': '案件阶段已推进',
    'timeline.event.decision.recorded': '决策已记录',
    'timeline.event.experiment.completed': '实验已完成',
    'timeline.event.fact.asserted': '事实已记录',
    'timeline.event.gap.opened': '缺口已创建',
    'timeline.event.gap.resolved': '缺口已解决',
    'timeline.event.hypothesis.proposed': '假设已提出',
    'timeline.event.hypothesis.status_updated': '假设状态已更新',
    'timeline.event.residual.updated': '残余风险已更新',
    'timeline.event.symptom.reported': '症状已记录'
  }
};

const ENUM_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    accepted: 'Accepted',
    active: 'Active',
    artifact: 'Artifact',
    blocked: 'Blocked',
    case: 'Case',
    clear: 'Clear',
    closed: 'Closed',
    completed: 'Completed',
    confirmed: 'Confirmed',
    critical: 'Critical',
    decision: 'Decision',
    discriminative_testing: 'Discriminative Testing',
    direct: 'Direct',
    entity: 'Entity',
    evidence_collection: 'Evidence Collection',
    experiment: 'Experiment',
    fact: 'Fact',
    favored: 'Favored',
    gap: 'Gap',
    high: 'High',
    hypothesis: 'Hypothesis',
    issue: 'Issue',
    blocking_issue: 'Blocking issue',
    hypothesis_competition: 'Hypothesis Competition',
    indirect: 'Indirect',
    inquiry: 'Inquiry',
    intake: 'Intake',
    low: 'Low',
    medium: 'Medium',
    merged: 'Merged',
    none: 'Uncovered',
    open: 'Open',
    paused: 'Paused',
    pass: 'Pass',
    proposed: 'Proposed',
    question: 'Question',
    ready_to_patch: 'Ready to patch',
    recorded: 'Recorded',
    repair_preparation: 'Repair Preparation',
    repair_validation: 'Repair Validation',
    residual_risk: 'Residual risk',
    residual: 'Residual risk',
    resolved: 'Resolved',
    scoping: 'Scoping',
    stalled: 'Stalled',
    stateless: 'Stateless',
    symptom: 'Symptom',
    tests: 'tests',
    explains: 'explains',
    supports: 'supports',
    validating: 'Validating',
    unknown: 'Unknown'
  },
  'zh-CN': {
    accepted: '已接受',
    active: '进行中',
    artifact: '证据',
    blocked: '阻塞',
    case: '案件',
    clear: '正常',
    closed: '已关闭',
    completed: '已完成',
    confirmed: '已确认',
    critical: '严重',
    decision: '决策',
    discriminative_testing: '判别验证',
    direct: '直接',
    entity: '实体',
    evidence_collection: '证据收集',
    experiment: '实验',
    fact: '事实',
    favored: '倾向成立',
    gap: '缺口',
    high: '高',
    hypothesis: '假设',
    issue: '事项',
    blocking_issue: '阻塞项',
    hypothesis_competition: '假设竞争',
    indirect: '间接',
    inquiry: '问题',
    intake: '受理',
    low: '低',
    medium: '中',
    merged: '已合并',
    none: '未覆盖',
    open: '未解决',
    paused: '已暂停',
    pass: '通过',
    proposed: '已提出',
    question: '问题',
    ready_to_patch: '可进入修复',
    recorded: '已记录',
    repair_preparation: '修复准备',
    repair_validation: '修复验证',
    residual_risk: '残留项',
    residual: '残余风险',
    resolved: '已解决',
    scoping: '范围界定',
    stalled: '停滞',
    stateless: '无状态',
    symptom: '症状',
    tests: '验证',
    explains: '解释',
    supports: '支撑',
    validating: '验证中',
    unknown: '未知'
  }
};

const I18nContext = createContext<I18nValue>(createI18nValue('en'));

export function I18nProvider(props: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => props.initialLocale ?? resolveInitialLocale({
    storedLocale: readStoredLocale(getLocaleStorage()),
    preferred: getBrowserLanguages()
  }));

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    persistLocale(nextLocale, getLocaleStorage());
  };
  const value = useMemo(() => createI18nValue(locale, setLocale), [locale]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function resolveLocale(preferred: readonly string[] | string | undefined): Locale {
  const candidates = Array.isArray(preferred)
    ? preferred
    : typeof preferred === 'string'
      ? [preferred]
      : [];

  return candidates.some((value) => value.toLowerCase().startsWith('zh')) ? 'zh-CN' : 'en';
}

export function readStoredLocale(
  storage: { getItem: (key: string) => null | string } | undefined
): Locale | undefined {
  if (!storage) {
    return undefined;
  }

  const value = storage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(value) ? value : undefined;
}

export function resolveInitialLocale(options: {
  storedLocale?: Locale | null | string | undefined;
  preferred?: readonly string[] | string | undefined;
}): Locale {
  return isLocale(options.storedLocale) ? options.storedLocale : resolveLocale(options.preferred);
}

export function formatEnumLabel(value: null | string | undefined, locale: Locale): string {
  if (!value) {
    const unknownLabel = ENUM_LABELS[locale].unknown;
    return typeof unknownLabel === 'string' ? unknownLabel : 'Unknown';
  }

  const normalized = value.toLowerCase();
  return ENUM_LABELS[locale][normalized] ?? ENUM_LABELS.en[normalized] ?? humanizeEnum(value, locale);
}

function createI18nValue(locale: Locale, setLocale: (locale: Locale) => void = () => undefined): I18nValue {
  const languageTag = locale === 'zh-CN' ? 'zh-CN' : 'en-US';
  const collator = new Intl.Collator(languageTag, {
    numeric: true,
    sensitivity: 'base'
  });

  return {
    locale,
    setLocale,
    t: (key, params) => translate(locale, key, params),
    formatDateTime: (value) => {
      const date = value instanceof Date ? value : new Date(value);
      return new Intl.DateTimeFormat(languageTag, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    },
    formatEnumLabel: (value) => formatEnumLabel(value, locale),
    formatEventType: (value) => formatEventType(value, locale),
    compareText: (left, right) => collator.compare(left, right)
  };
}

function translate(locale: Locale, key: string, params?: MessageParams): string {
  const template = MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key;
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, paramName: string) => String(params[paramName] ?? ''));
}

function humanizeEnum(value: string, locale: Locale): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim();
  if (locale === 'zh-CN') {
    return normalized;
  }

  return normalized.replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function formatEventType(value: null | string | undefined, locale: Locale): string {
  if (!value) {
    return formatEnumLabel(value, locale);
  }

  const key = `timeline.event.${value}`;
  const translated = MESSAGES[locale][key] ?? MESSAGES.en[key];
  if (translated) {
    return translated;
  }

  const normalized = value.replace(/[._-]+/g, ' ').trim();
  if (locale === 'zh-CN') {
    return normalized;
  }

  return normalized.replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function getBrowserLanguages(): string[] | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages;
  }

  return typeof navigator.language === 'string' ? [navigator.language] : undefined;
}

function getLocaleStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function isLocale(value: null | string | undefined): value is Locale {
  return value === 'en' || value === 'zh-CN';
}

function persistLocale(locale: Locale, storage: { setItem: (key: string, value: string) => void } | undefined) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    return;
  }
}
