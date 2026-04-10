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
3. Record symptoms, entities, artifacts, and facts before asserting root cause.
4. Propose hypotheses and plan experiments for unresolved explanations.
5. Run guardrails:
   - `investigation.guardrail.check`
   - `investigation.guardrail.stall_check`
   - `investigation.guardrail.ready_to_patch_check`
   - `investigation.guardrail.close_case_check`
6. Use `investigation://cases/{caseId}/snapshot`, `timeline`, `graph`, `coverage`, and `diff` to summarize progress.
7. Escalate reviewer-only actions instead of faking them in an agent session.

## Rules

- Do not skip evidence collection.
- Do not write free-form conclusions when a structured `fact`, `hypothesis`, `experiment`, `gap`, `residual`, or `decision` object exists.
- Treat `Gap` and `Residual` as first-class blockers, not comments.
- Only advance to repair preparation when guardrails say the evidence chain is sufficient.
