---
description: Prepare a reviewer handoff for a COE investigation case
argument-hint: [caseId]
---

Use the connected `coe-investigation` MCP server to prepare a reviewer handoff for case `$ARGUMENTS`.

Read `investigation://cases/$ARGUMENTS/snapshot`, `investigation://cases/$ARGUMENTS/timeline`, `investigation://cases/$ARGUMENTS/graph`, `investigation://cases/$ARGUMENTS/evidence-pool`, and `investigation://cases/$ARGUMENTS/diff`. Include: root problem status, active hypotheses, open blockers, repair-attempt status, attached evidence references, evidence-pool highlights, guardrail outcomes, and any reviewer-only actions that still require explicit confirmation.
