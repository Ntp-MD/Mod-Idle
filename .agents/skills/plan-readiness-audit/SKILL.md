---
name: plan-readiness-audit
description: "Plan readiness gate: decide whether an implementation plan is safe to delegate to a coding agent (READY / NEEDS CLARIFICATION / HUMAN-OWNED / BLOCKED), with findings and execution packets. Audit only; never implements the plan."
---

# Plan Readiness Audit — Agent Delegation Gate

> Purpose: Determine whether an implementation plan is safe to delegate to a coding agent (e.g., Beam 1.0). This is a **plan audit**, not permission to implement. Optimize for successful completion, minimal rework, and bounded agent execution—not maximum document length.

## Role and non-negotiable rules

Act as a skeptical reviewer. Challenge assumptions, verify claims against the repository, and distinguish **confirmed facts**, **inferences**, and **unknowns**. Do not rubber-stamp the plan. Do not implement code, silently resolve product decisions, or expand scope. Existing uncommitted work belongs to its owner: never reset, overwrite, clean, or commit it during this audit.

Do not mark a task READY merely because every section exists. Readiness requires evidence that the plan is executable and independently verifiable. Prefer the smallest sufficient execution packet; do not require exhaustive file-by-file instructions when safe repository discovery is possible.

## Inputs

- Implementation plan or task description
- Repository and relevant instructions (`AGENTS.md`, project conventions, architecture and data contracts)
- Existing tests, scripts, migrations, and known decisions
- Current local workspace files (read-only inspection under `AGENTS.md`)

If an input is missing, state its impact. Audit what is available; do not invent repository facts.

## Audit procedure

### 1. Establish the contract

Extract the objective, user-visible behavior, non-goals, affected systems, acceptance criteria, and explicit owner decisions. Separate requirements from suggested implementation approaches. Identify contradictions with existing decisions.

### 2. Verify repository reality

Use targeted searches before reading files. Confirm relevant entry points, data ownership, API/type contracts, call sites, tests, persistence formats, and scripts. Cite **file paths and symbols/line ranges** for material findings. Mark any uninspected claim **UNVERIFIED**; never present a proposed path as confirmed.

### 3. Challenge the plan

Check for:

- Ambiguous behavior, unstated defaults, and unresolved owner/product decisions
- Incorrect assumptions, missing dependencies, and cross-feature effects
- Data/schema changes, backward compatibility, migrations, and rollback risks
- Edge cases: empty, invalid, boundary, duplicate, interrupted, and repeated operations
- Security, authorization, performance, concurrency, and accessibility where relevant
- Conflicting changes, in-flight work, and tasks too broad for one bounded execution
- Hidden sources of truth, duplicated logic, or changes that would violate project contracts

Raise only material issues; explain their consequence and the evidence needed to resolve them.

### 4. Test the acceptance criteria

Every critical requirement must map to an observable outcome and a concrete verification method. Identify existing tests to reuse, focused tests to add, and broader checks required by shared contracts. For high-risk invariants, consider a mutation/negative test that fails when the invariant is broken. A green suite alone does not prove uncovered behavior.

### 5. Define execution boundaries

For each independently delegable task specify:

- **In scope / out of scope**
- **Verified context** and files/symbols to inspect first
- **Constraints and invariants** that must remain true
- **Implementation sequence**, with dependencies and checkpoints
- **Acceptance criteria** paired with verification commands or manual checks
- **Stop conditions:** missing critical facts, conflicting contracts, unexpected file changes, failing baseline, unsafe migration, or unresolved design decisions
- **Escalation:** what to report, and which decision must be made by the owner or planning model

Do not prescribe speculative edits. If an agent discovers a new critical dependency, it must stop and request replanning instead of improvising.

## Readiness gates

Evaluate each as **PASS**, **FAIL**, or **UNKNOWN**, with concise evidence:

| Gate | Required evidence |
| --- | --- |
| G1 — Objective and scope | Clear behavior, non-goals, bounded deliverable |
| G2 — Repository grounding | Critical assumptions and ownership verified against code |
| G3 — Decisions resolved | No unresolved product/architecture choice delegated implicitly |
| G4 — Contracts and dependencies | Interfaces, data flow, invariants, and dependencies identified |
| G5 — Edge cases and safety | Material failure modes, compatibility, and worktree risks covered |
| G6 — Testability | Critical criteria have observable pass/fail verification |
| G7 — Execution and stopping | Ordered steps, completion condition, stop/escalation rules |
| G8 — Change isolation | Task small enough to review, test, and revert independently |

**Decision rules:**

- **READY:** All critical gates PASS; remaining uncertainty is non-critical and explicitly bounded.
- **NEEDS CLARIFICATION:** One or more critical gates FAIL/UNKNOWN but can be resolved by repository inspection, a test, or a specific answer.
- **HUMAN-OWNED:** An unresolved product, balance, UX, or architecture trade-off requires an owner decision. Do not decide by guesswork.
- **BLOCKED:** Required evidence or access is unavailable, baseline is unsafe, or conflicting in-flight changes prevent safe execution.

Do not convert these statuses to a numerical score or claim a guaranteed success probability. Split mixed plans into separate tasks; some may be READY while others are not.

## Required audit output

### A. Verdict

- **Overall:** READY / NEEDS CLARIFICATION / HUMAN-OWNED / BLOCKED / MIXED
- **What was inspected:** files, scripts, tests, and limits of inspection
- **Top risks:** highest-impact issues, with evidence and consequences

### B. Findings

| ID | Severity (Blocker/High/Medium/Low) | Claim or gap | Evidence | Consequence | Required action / owner |
| --- | --- | --- | --- | --- | --- |

Use `UNVERIFIED` for claims without repository evidence. Do not fabricate paths, test results, or citations.

### C. Readiness matrix

| Task | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Give a short reason for every FAIL/UNKNOWN, without repeating the full findings.

### D. Questions that actually block execution

Ask only questions that cannot be settled safely by inspecting the repository. Provide options and consequences when a decision is needed.

### E. Execution packets — READY tasks only

For each READY task, output:

```md
## Task: <bounded name>
Status: READY
Objective:
Verified context: <paths/symbols and evidence>
Scope / non-goals:
Dependencies:
Contracts / invariants:
Steps:
1. ...
Acceptance criteria and proof:
- <criterion> -> <test/command/observable evidence>
Stop and escalate if:
Expected handoff: <changed files, test results, deviations, unresolved issues>
```

Do not generate implementation packets for non-READY tasks. Instead specify the minimum action needed to make each ready.

### F. Final handoff rule

The implementing agent must inspect relevant local files, preserve unrelated changes, make scoped modifications, run focused verification and report exact commands/results. It must not claim success without evidence or continue through a stop condition. The reviewer must independently inspect edited files and evidence for high-risk changes within the active sandbox.

## Efficiency constraints

- Search narrowly, batch independent lookups, and avoid rereading unchanged files.
- Reuse established project decisions and tests; avoid duplicating documentation.
- Prefer a small number of coherent tasks over microtasks or a giant all-in-one job.
- Delegate only when authorized and independent parallel work clearly reduces elapsed time.
- Distinguish **audit complete** from **implementation complete**.
- Never treat a passing typecheck/test suite as proof of unspecified behavior.
