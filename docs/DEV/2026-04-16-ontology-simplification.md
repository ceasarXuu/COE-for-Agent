# Ontology Simplification

Date: 2026-04-16

## Decision

The console graph now uses a simplified presentation model:

- `inquiry`, `symptom`, `gap`, and `residual` are grouped into a single graph family: `issue`
- `entity` is no longer rendered as a first-class graph node in the main case graph
- `artifact`, `fact`, `hypothesis`, `experiment`, `decision`, and `case` remain first-class graph nodes

This is a presentation-layer consolidation, not a storage migration. Existing commands, event types, tables, and replay semantics remain compatible in phase 1.

## Why

The previous graph exposed too many concepts with weak visual separation:

- `inquiry` and `symptom` often looked like duplicate text nodes
- `gap` and `residual` both represented unresolved work with subtle semantic differences
- `entity` was useful as context, but noisy as a peer node in the primary reasoning chain

For human operators and agents, the main graph should emphasize the reasoning path:

`issue -> artifact -> fact -> hypothesis -> experiment -> decision`

## Mapping

| Legacy concept | Graph display kind | Subtype |
| --- | --- | --- |
| `inquiry` | `issue` | `question` |
| `symptom` | `issue` | `symptom` |
| `gap` | `issue` | `blocking_issue` |
| `residual` | `issue` | `residual_risk` |
| `entity` | hidden from main graph | context only |

## Phase 1 implementation rules

- Keep legacy commands and event names unchanged
- Add `displayKind` and `issueKind` metadata to graph nodes
- Filter `entity` nodes from the graph resource
- Use `issue` as the lane and color family in the console graph
- Preserve legacy `kind` so existing panels, actions, exports, and tests can keep working

## Follow-up work

- Introduce a canonical `issue` write model and MCP aliases
- Unify issue-centric inspector and action flows
- Revisit guardrails so they reason over normalized issue types instead of legacy symptom/gap/residual categories
- Decide whether persistence should remain legacy-compatible or migrate to a physical `issues` table
