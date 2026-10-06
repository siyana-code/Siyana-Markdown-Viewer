# Testing strategy

## What we are actually defending against

Tests exist to catch four things, in rough priority order:

1. **Security defects.** A construct that escapes sanitization. A path that
   escapes the workspace root.
2. **Correctness regressions in rendering.** A legitimate document that renders
   differently than it did last release.
3. **Data loss.** A save that corrupts a file, an edit that drops content.
4. **Everything else.** Ordinary bugs.

Test effort follows that order, not the order that is easiest to write.

## Layers

```
                    ┌─────────────────────────────┐
 1  E2E / manual    │ Open a file, read it.      │  Few, slow, human-checked
                    └──────────────┬──────────────┘
                                   │
 2  Integration    ┌───────────────▼──────────────┐
                   │ core + sanitize + ui        │  Renders real fixtures
                   └──────────────┬──────────────┘
                                  │
 3  Conformance    ┌──────────────▼──────────────┐
                   │ CommonMark spec suite       │  600+ spec examples
                   │ GFM spec suite               │
                   │ Siyana Markdown Profile      │
                   └──────────────┬──────────────┘
                                  │
 4  Property       ┌──────────────▼──────────────┐
                   │ parser invariants            │  Generated input
                   │ sanitizer invariants         │  Fuzzing
                   │ round-trip preservation       │
                   └──────────────┬──────────────┘
                                  │
 5  Unit           ┌──────────────▼──────────────┐
                   │ decode, slug, TOC, search,  │  Fast, plentiful
                   │ limits, path resolution      │
                   └─────────────────────────────┘
```

## 1. Unit tests

For pure functions with interesting logic: encoding detection, line-ending
normalisation, slug generation with dedupe, TOC construction, URL scheme
allowlisting, path normalisation and containment, and each limit's boundary.

The boundary cases matter most. Test `depth = 100` and `depth = 101`, not just
that "deep input is rejected".

## 2. Conformance suites

The highest-value automated tests we have, because they come from an external
authority rather than our own assumptions.

| Suite | Source | Cases | Runs on |
|---|---|---|---|
| CommonMark | `spec.json` from `commonmark/commonmark-spec`, version pinned | ~650 | Every PR |
| GFM | GFM spec, sections we declare support for | ~600 | Every PR |
| Profile | Our declared extensions | growing | Every PR |

```ts
import { spec } from '@siyana/test-fixtures/commonmark'

describe('CommonMark conformance', () => {
  it('passes every example in the pinned spec version', async () => {
    const results = await runConformance(render, spec)
    // Baseline is recorded in conformance-baseline.json. A drop is a failure,
    // even if the absolute rate is above target.
    expect(results.passed).toBeGreaterThanOrEqual(baseline.commonmark.passed)
    expect(results.failed).toEqual(baseline.commonmark.failedIds)
  })
})
```

The key design decision: **a regression fails the build even if we are already
above our target pass rate.** If we are at 99.4% and someone drops two examples,
that is a regression and CI goes red. Fixing it or documenting it is a separate,
deliberate act.

**Vendoring.** The suites are vendored into
`packages/test-fixtures/specs/commonmark/<version>/` with the version in the
path. Upgrading is a deliberate PR that shows the diff in pass rate.

**Own regression fixtures** live in
`packages/test-fixtures/regression/<issue-number>/` with the issue in the path,
so a reviewer can read the bug report next to the test.

## 3. Integration tests

Render real documents through the real pipeline — core, sanitizer, and the DOM
in a test environment — and assert on the resulting DOM.

```ts
it('preserves heading semantics for screen readers', () => {
  const { container } = renderInJsdom('# One\n## Two\n### Three')
  expect(container.querySelectorAll('h1')).toHaveLength(1)
  expect(container.querySelectorAll('h2')).toHaveLength(1)
  expect(container.querySelectorAll('h3')).toHaveLength(1)
})

it('never emits an executable construct from a hostile document', () => {
  const container = renderInJsdom(HOSTILE_PAYLOAD)
  expect(container.querySelector('script')).toBeNull()
  expect(container.querySelector('[onerror]')).toBeNull()
  // ... and no element resolves to a javascript: URL
})
```

The second test shape is the security-critical one, and it is table-driven over
a payload catalogue.

## 4. Property-based and fuzz tests

Unit tests check what we thought of. Property tests check what we did not.

```ts
import { fc } from 'fast-check'

// Property: no input produces an executable construct after sanitization.
it('never emits script or event handlers for arbitrary input', () => {
  fc.assert(
    fc.property(arbitraryMarkdown(), (markdown) => {
      const { container } = renderInJsdom(markdown)
      expect(container.querySelector('script')).toBeNull()
      for (const el of container.querySelectorAll('*')) {
        for (const attr of el.attributes) {
          expect(attr.name.startsWith('on')).toBe(false)
          if (attr.name === 'href' || attr.name === 'src') {
            expect(isSafeUrl(attr.value, ALLOWED_SCHEMES)).toBe(true)
          }
        }
      }
    }),
    { numRuns: 2000 }
  )
})

// Property: escaping is stable under mutation.
it('treats escaped text as text', () => {
  fc.assert(
    fc.property(fc.string(), (text) => {
      const { container } = renderInJsdom(`# ${text}`)
      expect(container.textContent).toContain(text)
    })
  )
})
```

**Fuzzing** is the same idea at higher volume with structured mutation: take a
corpus of valid documents, apply byte mutations, insertions of adversarial
constructs, and truncation, then assert the pipeline invariant. Run on a
schedule (nightly) with more iterations than CI can afford in a PR.

Corpus sources: the CommonMark and GFM suites, our fixtures, a set of
deliberately hostile documents, and any file that has ever caused a crash
report.

## 5. End-to-end and manual testing

A short list, mostly manual, because automating a webview-rendered desktop app
is expensive and brittle.

| Check | How |
|---|---|
| Open a file on Windows and Linux | E2E with a driver, or manual |
| Clean-install smoke test | Manual, on a clean VM, before each release |
| Linux distribution matrix | Manual, on Ubuntu LTS, current Fedora, Arch or openSUSE |
| Screen reader | Manual, NVDA on Windows and Orca on Linux |
| Keyboard-only operation | Manual, with a checklist |
| Print and PDF output | Manual, compared against expected pagination |
| External edit conflict flow | Manual, with a real sync folder |
| Fuzzing campaign | Automated, nightly, before `1.0` |

**Accessibility is tested manually on every release.** Automating a WCAG
conformance claim is not something current tooling does well, and a badge from an
automated checker is not evidence.

## Cross-platform testing

The matrix runs in CI, but two things cannot be automated:

1. **Linux distribution coverage.** CI runs one Ubuntu version. Distro-specific
   breakage (WebKitGTK versions, desktop-entry handling, Wayland) only appears on
   real distributions. Minimum: Ubuntu LTS, a current Fedora, and a third
   non-Debian family.
2. **Accessibility.** Requires a real screen reader and a human.

## Performance testing

Performance regressions are caught by a benchmark harness in CI, run against a
fixed corpus with recorded baselines. Not a substitute for profiling, but it
catches the large regressions.

| Benchmark | Budget | Fails on |
|---|---|---|
| Cold start to first render | 700 ms | > 20% regression |
| Open a 5 MB document | 2 s | > 20% regression |
| Parse throughput | baseline | > 15% regression |
| Sanitize throughput | baseline | > 20% regression |
| Peak memory, 5 MB document | 4× source | > 25% regression |
| Scroll frame rate | 60 fps | < 55 fps |

Fixed corpus: this repository's own `research/` directory is a decent real-world
Markdown corpus, plus a synthetic 5 MB file, plus a pathological file.

## Test data

Never use real user documents in the repository. Test fixtures are either
synthetic, from a public spec, from a deliberately hostile corpus, or from a bug
report with the reporter's consent and with identifying content removed.

## Coverage

Coverage is a **signal**, not a target. A 100% covered file that has no hostile
input cases is less valuable than an 80% covered file where every trust-boundary
function is tested with adversarial input.

We do set a floor: **every function that crosses a trust boundary must have
tests covering hostile input.** That is a review requirement, not a number.

## Definition of done

A change is done when:

- [ ] Tests exist for new behaviour, and they would fail without the change
- [ ] Every bug fix has a regression test referencing its issue
- [ ] Parser changes do not reduce conformance
- [ ] Security-boundary changes include a hostile-input test
- [ ] New limits are tested at the boundary value and one past it
- [ ] `pnpm lint typecheck test test:conformance` is green
- [ ] Performance-relevant changes include a before/after measurement

## Commands

```bash
pnpm test                     # everything
pnpm test -- core             # one package
pnpm test:conformance         # CommonMark + GFM + profile
pnpm test:conformance -- --update-baseline   # deliberate, reviewed in the PR diff
pnpm test:fuzz                # quick fuzz, CI budget
pnpm test:fuzz -- --iterations 1000000        # deep, nightly
pnpm bench                    # performance baselines
pnpm bench -- --compare       # regression report
```

## Related

- [Coding standards](coding-standards.md)
- [Release process](release-process.md)
- [`research/03-specifications/04-conformance-testing.md`](../../research/03-specifications/04-conformance-testing.md)
- [`research/11-security/`](../../research/11-security/README.md)