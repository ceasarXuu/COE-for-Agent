---
description: Evaluate whether a COE case is ready to enter repair preparation
argument-hint: [caseId]
---

Use the connected `coe-investigation` MCP server to inspect case `$ARGUMENTS`.

Read `investigation://cases/$ARGUMENTS/snapshot`, `investigation://cases/$ARGUMENTS/timeline`, `investigation://cases/$ARGUMENTS/graph`, `investigation://cases/$ARGUMENTS/evidence-pool`, and `investigation://cases/$ARGUMENTS/diff`, then run `investigation.guardrail.ready_to_patch_check`. Explain which hypotheses, blockers, repair attempts, or evidence references are still blocking if the guardrail fails.
