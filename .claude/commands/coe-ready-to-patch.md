---
description: Evaluate whether a COE case is ready to enter repair preparation
argument-hint: [caseId]
---

Use the connected `coe-investigation` MCP server to inspect case `$ARGUMENTS`.

Summarize snapshot, timeline, graph, and coverage state, then run `investigation.guardrail.ready_to_patch_check`. Explain what is still blocking if the guardrail fails.
