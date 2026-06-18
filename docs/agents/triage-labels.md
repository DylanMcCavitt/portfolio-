# Triage Labels

| Role | Label |
| --- | --- |
| Needs maintainer evaluation | `needs-triage` |
| Waiting on reporter/user | `needs-info` |
| Ready for agent implementation | `ready-for-agent` |
| Ready for human implementation | `ready-for-human` |
| Will not be actioned | `wontfix` |


## Owner routing

- UI implementation issues: `ready-for-human` unless explicitly assigned to a Claude worktree.
- Non-UI implementation issues: `ready-for-agent` for Codex agents/subagents.
- All agent-first redesign issues target preview branch `preview/agent-first-redesign`, not `main`.

## Continuity rules

Triage changes must preserve Source PRD, Parent issue, dependencies, Deferred scope custody, Explicitly deferred items, Open questions, Do not preclude constraints, Future issue candidates, and scope ledger links.

- `ready-for-agent` means the issue still carries enough context for one issue / one worktree / one PR implementation.
- `needs-info` questions must keep already-established scope and non-decisions intact.
- `wontfix` must not erase deferred capabilities; link where that context is retained.
