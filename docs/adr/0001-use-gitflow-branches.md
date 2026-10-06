# ADR-0001: Use a GitFlow-lite branching model

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Siyana Markdown Viewer maintainers
- **Consulted:** Existing `siyana-code` org practice (e.g. `Siyana-Chat`, which
  uses `main` + `develop`)

## Context

The project must ship:

1. **A production release line** on Windows and Linux that users install and
   auto-update from. It must always be releasable.
2. **An integration line** where concurrent features land without destabilising
   releases.
3. **Feature, phase, and documentation branches** cut with predictable naming, so
   a newcomer can tell what a branch is for without asking.
4. **A fast path for production fixes** that does not require cutting a release.

The org already runs `main` + `develop` on its other projects, so consistency
across the org has value of its own.

The team is small. Heavy process (mandatory changelog gatekeepers, code owners on
everything, a release manager role) costs more than it buys at this size.

## Decision

We use **GitFlow-lite**:

- `main` — production releases only. Tagged. Protected. No direct pushes.
- `develop` — default branch, always releasable, protected, PR required.

Branch prefixes, all lower-case kebab-case, optionally carrying an issue number:

| Prefix | Cut from | Merges into | Reviews |
|--------|----------|-------------|---------|
| `feature/<scope>-<desc>` | `develop` | `develop` | 1 approval |
| `phase/<n>-<name>` | `develop` | `develop` | 1 approval |
| `fix/<scope>-<desc>` | `develop` | `develop` | 1 approval |
| `refactor/<scope>-<desc>` | `develop` | `develop` | 1 approval |
| `docs/<desc>` | `develop` | `develop` | CI gate only |
| `research/<topic>` | `develop` | `develop` | CI gate only |
| `ci/<desc>` | `develop` | `develop` | 1 approval |
| `release/<semver>` | `develop` | `main` | 1 approval + full CI |
| `hotfix/<desc>` | `main` | `main` and `develop` | 1 approval |

Merge styles:

- `develop`: squash only. Linear history, one intent per line, PR title becomes
  the Conventional Commit subject.
- `main`: `--no-ff` merge from `release/*` so every release is a visible point
  in history.
- `hotfix/*` → `main`: squash. Then `main` → `develop` as a `--no-ff` merge
  within the hour.

CI enforces the policy: PRs targeting `main` must come from `release/*` or
`hotfix/*`, and every branch name must match the pattern.

## Alternatives considered

**Full GitFlow.** Rejected. It adds `develop`, `feature/*`, `release/*`,
`hotfix/*`, plus a hard rule that feature branches merge into `develop` but
sometimes into `main` — that last rule produces exactly the confusion we want to
avoid, and it becomes actively harmful when releases are frequent.

**Trunk-based development.** Rejected for now. It is lower ceremony and would
work, but it makes `main` a moving target and pushes release discipline onto
discipline rather than structure. For an app that ships signed installers to
end users, an explicit release line is worth the small overhead. We can revisit
this after `1.0` if release frequency makes `release/*` branches feel heavy.

**Polyrepo with one branch per repo.** Rejected. Cross-cutting changes
(a shared parser API change plus a UI change plus docs) would need coordinated
PRs across repositories. That is a real cost on a small team.

**GitHub Flow (branch-per-PR, merge to `main`).** Rejected. No staging line, so
every in-flight feature is a candidate for release and `main` is frequently
unstable. Not acceptable for a shipped desktop app.

## Consequences

### Good

- `main` is provably releasable at all times. If `develop` is broken we still
  have a working release.
- The target of a PR is obvious: `develop` unless it is a release or hotfix.
- Branch names encode intent, so `git branch -r` is a readable backlog.
- CI enforces the policy, so newcomers cannot accidentally push to `main`.
- Consistent with the rest of the org.

### Bad / accepted costs

- Two integration commits for every hotfix (`main` and back into `develop`).
- Merge conflicts are slightly more likely, since `develop` diverges from `main`
  between releases.
- Release branches add a step; cutting a release means merging forward.
- Squash-merging loses per-commit granularity on `develop`. We accept this
  because PR-level granularity is what reviewers actually reason about.

### Follow-up work

- Configure GitHub to default new PR titles to the PR branch name, which is
  already Conventional-Commit shaped.
- Revisit when releases become frequent enough that `release/*` is usually
  opened and closed within a day.

## Validation

We will know this model is wrong if, after `1.0`, releases are typically
cut-and-merged within a single day *and* the ceremony measurably slows us down.
Until then, the safety property is worth more than the saved keystrokes.
