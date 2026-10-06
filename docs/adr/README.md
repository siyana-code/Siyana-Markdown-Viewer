# Architecture Decision Records

An ADR records a decision we made, the context that forced it, and what we
gave up. They are numbered, immutable once merged, and superseded rather than
edited.

## Format

```text
docs/adr/
  README.md                      # this file
  NNNN-short-kebab-title.md      # one decision per file
```

Template:

```markdown
# ADR-NNNN: <Decision in one line>

- Status: Proposed | Accepted | Superseded by ADR-XXXX | Rejected
- Date: YYYY-MM-DD
- Deciders: <names or roles>
- Consulted: <research and people>

## Context
What forces a decision. Facts, constraints, deadlines.

## Decision
What we are doing, stated in the active voice.

## Alternatives considered
Each with a real reason for rejection, not a strawman.

## Consequences
### Good
### Bad / accepted costs
### Follow-up work

## Validation
How we will know this decision was right, and when we revisit it.
```

## Rules

1. **One decision per ADR.** If it contains a comma, it is probably two.
2. **Never edit an accepted ADR.** To change a decision, write a new ADR that
   supersedes it and update the `Superseded by` line.
3. **Research before deciding.** An ADR with no link into `research/` is a
   guess. Link the specific documents that informed it.
4. **Record the costs.** A decision with no downsides listed has not been
   examined honestly.
5. **Name a revisit trigger.** "We will reconsider if X" beats "this is final".

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-use-gitflow-branches.md) | Use a GitFlow-lite branching model | Accepted | 2026-10-06 |
| [0002](0002-monorepo-with-workspaces.md) | Use a monorepo with JS and Cargo workspaces | Accepted | 2026-10-06 |
| [0003](0003-desktop-framework-tauri-vs-electron-vs-flutter.md) | Desktop framework: Tauri, Electron, or Flutter | Proposed | 2026-10-06 |
| [0004](0004-markdown-parser-strategy.md) | Markdown parser selection | Proposed | 2026-10-06 |
| [0005](0005-security-baseline-xss-sanitization.md) | Security baseline: sanitization and XSS defence | Proposed | 2026-10-06 |

## Status meanings

| Status | Meaning |
|--------|---------|
| Proposed | Written, under discussion, not yet binding |
| Accepted | Binding on all new work |
| Superseded by ADR-XXXX | Replaced; read the newer ADR instead |
| Rejected | Considered and declined; read it before re-proposing |
| Deprecated | No longer relevant, no replacement |

## Process

1. Open a PR with a new ADR in `Proposed` status, or a `research/` issue if the
   evidence is not there yet.
2. Ask in the issue/PR for comment from anyone affected. Security and shell
   decisions require a Code Owner review.
3. Resolve discussion, change status to `Accepted`, merge to `develop`.
4. Update the index table above in the same PR.
5. If the decision later changes, add a new ADR. Do not rewrite history.

## Reading order

If you are new, read these in order:

1. [0001](0001-use-gitflow-branches.md) — how code moves
2. [0002](0002-monorepo-with-workspaces.md) — how code is arranged
3. [0005](0005-security-baseline-xss-sanitization.md) — the constraint that
   limits every other decision
4. [0003](0003-desktop-framework-tauri-vs-electron-vs-flutter.md) — the shell
5. [0004](0004-markdown-parser-strategy.md) — the heart of the app
