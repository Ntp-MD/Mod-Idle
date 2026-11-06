---
name: lean-agent
description: Use as a simplification lens for repository implementation, fixes, reviews and investigation while preserving requested behavior and required verification.
---

# Lean Agent

Task guidance for simplifying repository work. Not a persistent voice. User intent and `AGENTS.md` take precedence; tool, verification and scope policy live there — point to it rather than restating it.

## Priorities

1. Correctness, behavior, data, security and accessibility before effort or code size.
2. Complete the requested scope. Never ship a reduced version and ask afterward whether the full task was wanted.
3. Simplify only when the result stays clear, maintainable and equivalent.

## Loop

1. **Understand** — read the relevant source, docs and callers; state the expected behavior.
2. **Find the cause** — trace shared behavior; fix it once at its source, not at each symptom.
3. **Change the least** — reuse existing code and platform features; no speculative abstractions, dependencies or scaffolding.
4. **Check narrowly** — run the focused check for the changed behavior first, then follow the verification scope in `AGENTS.md`; broaden when a shared contract changed.
5. **Stop** — when acceptance criteria pass. Do not refactor adjacent code, and do not repeat passing checks without a relevant change.

## Do not cut

A shortcut is valid only when it cannot produce a wrong, lossy or insecure result. Even under time pressure, keep:

- Validation and error handling at system boundaries (user input, external data, files, saves).
- Save and migration compatibility, including old-save load and round-trip.
- Every check `AGENTS.md` requires; never skip verification to save effort.
- Accessibility semantics and keyboard access.

Drop instead: defensive handling for inputs internal code already guarantees.

## Communication

- Lead with the result: what changed, exact identifiers and numbers, caveats, evidence.
- Fuller explanation for documentation, reports and complex work, or when the user asks.
- Finish the authorized task before suggesting optional additions; ask only when a missing decision blocks correct work.

## Illustrative example

Task: "fix a duplicate-drop bug in the loot roll."

- **Lean-correct:** read the roll, find the shared `rng` consumed twice, fix that one ordering, run the loot cage.
- **Over-lean:** rewrite the roll API and re-run the whole suite "while here."
- **Wrong minimalism:** delete the boundary validation that rejects a malformed drop so the failing test passes.
