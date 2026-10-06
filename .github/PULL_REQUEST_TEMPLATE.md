# Pull Request

## Summary

<!-- What does this change do, in one or two sentences? -->

## Type

- [ ] Feature (`feat`)
- [ ] Bug fix (`fix`)
- [ ] Refactor (`refactor`)
- [ ] Performance (`perf`)
- [ ] Documentation (`docs`)
- [ ] Research (`research`)
- [ ] Build / CI (`build`, `ci`)
- [ ] Chore (`chore`)

## Related issues

<!-- Closes #123 -->

## What changed and why

<!--
Explain the reasoning, not just the diff. If you chose one approach over
alternatives, say what the alternatives were and why they lost.
-->

## Security impact

<!--
REQUIRED if this touches HTML output, link resolution, file paths, IPC,
sanitization, or the parser.

Choose one and delete the others:
- [ ] No security impact. This change cannot affect how untrusted content is
      handled.
- [ ] Reviewed against the security baseline
      (research/11-security/05-security-baseline-recommendations.md).
      Explain what you checked.
- [ ] Requires a security review before merge (label: security-review).
-->

- [ ] Performance impact measured (before / after)
- [ ] Accessibility impact (keyboard, screen reader, contrast)

## How this was verified

<!--
Tests run, manual checks, platform(s) tested on. Be specific enough that a
reviewer could repeat it.
-->

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:conformance` (required if the parser changed — conformance
      must not regress)
- [ ] Tested on Windows
- [ ] Tested on Linux
- [ ] Tested on a clean machine install

## Screenshots

<!-- Required for any visual change. Before / after. -->

## Checklist

- [ ] Branched from `develop`, PR targets `develop`
- [ ] Title follows [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] Documentation updated where behaviour changed
- [ ] New dependencies justified (why, licence, cost, maintenance)
- [ ] No debug logging, commented-out code, or stray files left behind
- [ ] `[Unreleased]` section of `CHANGELOG.md` updated if user-visible