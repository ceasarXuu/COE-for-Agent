# COE Investigation

Use this skill when a task should be handled as an evidence-driven investigation instead of an immediate fix.

## Goals

- Turn a vague issue into a tracked investigation case.
- Record evidence before proposing or applying repairs.
- Use guardrails to decide whether the case is ready for patching or closure.
- Produce reviewer handoffs that preserve the evidence chain.

## Workflow

1. Read `investigation://profile` to confirm the surface and capabilities.
2. Open a case with `investigation.case.open`.
3. Keep the canonical root problem current with `investigation.problem.update`, `investigation.problem.set_status`, and reference material when needed.
4. Capture reusable evidence with `investigation.evidence.capture` or `investigation.evidence.capture_and_attach`, then attach or revise evidence references through `investigation.evidence.attach_existing` and `investigation.evidence_ref.update`.
5. Create hypotheses for unresolved explanations, open blockers when evidence or access is missing, and only create repair attempts after a hypothesis is confirmed.
6. Run guardrails:
   - `investigation.guardrail.check`
   - `investigation.guardrail.stall_check`
   - `investigation.guardrail.ready_to_patch_check`
   - `investigation.guardrail.close_case_check`
7. Use `investigation://cases/{caseId}/snapshot`, `investigation://cases/{caseId}/timeline`, `investigation://cases/{caseId}/graph`, `investigation://cases/{caseId}/evidence-pool`, and `investigation://cases/{caseId}/diff` to summarize progress.
8. Escalate reviewer-only actions instead of faking them in an agent session.

## Rules

- Do not skip evidence collection.
- Do not write free-form conclusions when a structured `problem`, `hypothesis`, `blocker`, `repair_attempt`, `evidence`, or `evidence_ref` object exists.
- Treat missing evidence, blocked access, and unresolved contradictions as structured blockers, not comments.
- Only advance to repair preparation when guardrails say the evidence chain is sufficient.
