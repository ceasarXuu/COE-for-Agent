# Workspace UI Remediation Plan

Goal: restore clear hierarchy, responsive usability, and first-use guidance in the investigation console without changing its core workflows.

Scope:
- Rework workspace layout so the main graph surface stays dominant on tablets and small laptops.
- Reorder stacked mobile sections so context and actions appear before low-priority diagnostics.
- Restore graph orientation copy, cases-list guidance, and stronger panel hierarchy.

Execution order:
1. Add regression coverage for cases index guidance and responsive workspace ordering.
2. Unify workspace layout rules into one source of truth and remove dead overlap.
3. Rebuild workspace grid areas for desktop, tablet, and mobile breakpoints.
4. Add graph orientation shell, restore list entry guidance, and rebalance panel emphasis.
5. Run typecheck, unit tests, and e2e verification.
