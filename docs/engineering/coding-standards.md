# Coding standards

Written for consistency, not for authority. Where this document and good
judgement disagree, judgement wins — but it should have to be argued.

## General principles

1. **Comments explain why.** The code already says what it does. A comment that
   restates the code is deleted in review.
2. **Make the invalid thing unrepresentable.** Prefer types and lint rules over
   discipline. A branded `SanitizedHtml` type beats a comment saying "remember to
   sanitize this".
3. **Explicit over clever.** Readability is a feature other people depend on.
4. **Fail loudly in development, gracefully in production.** Assert in debug
   builds; degrade with a clear message in release.
5. **Bound everything.** Untrusted input crosses every boundary. Depth, size,
   count, and time are all bounded, and breaching a bound is a handled state,
   not an exception.

## Branch scopes

Used in commit messages and PR titles.

| Scope | Area |
|---|---|
| `core` | `packages/core` shared logic |
| `parser` | Markdown parsing and the parser integration |
| `render` | AST to HTML and the content stylesheet |
| `sanitize` | Sanitization policy. Security-critical |
| `editor` | Editing models |
| `search` | Outline, TOC, search, indexing |
| `shell` | Window, IPC, capabilities, packaging |
| `fs` | Filesystem adapters and path resolution |
| `theme` | Themes and design tokens |
| `a11y` | Accessibility |
| `perf` | Performance work |
| `build` | Build configuration |
| `ci` | CI and automation |
| `docs` | Documentation |
| `research` | Research corpus |
| `deps` | Dependency changes |

## TypeScript and JavaScript

- `strict: true`. Also `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- **`any` requires a comment** explaining what it actually is. `unknown` first;
  narrow rather than cast.
- Prefer `unknown` + type guards over casts. Prefer discriminated unions over
  optional fields for state that cannot co-occur.
- `type` over `interface` unless declaration merging is needed.
- `satisfies` over `as` for object literals.
- No enums. Use `as const` objects or union types; enums have surprising runtime
  semantics.
- Functions are `function` declarations unless hoisting matters; arrow
  functions for callbacks and short expressions.
- Imports are explicit. No default exports from shared packages.
- Relative imports within a package; package-name imports across packages.
  Deep imports into another package (`@siyana/core/parse/internal`) are a lint
  error.
- Async/await throughout. No promise chains beyond two links.
- No `async` functions without `await`. If it is genuinely synchronous, do not
  mark it async.

### Naming

| Thing | Convention | Example |
|---|---|---|
| File | kebab-case | `render-pipeline.ts` |
| Component | PascalCase | `TableOfContents` |
| Function, variable | camelCase | `renderDocument` |
| Type, interface | PascalCase | `RenderResult` |
| Constant | SCREAMING_SNAKE | `DEFAULT_LIMITS` |
| Private class field | no prefix; `#` for true private | `#cache` |
| Environment variable | SCREAMING_SNAKE | `SIYANA_NO_TELEMETRY` |
| Custom element | `siyana-` prefix | `<siyana-viewer>` |

### Imports ordering

Groups, separated by a blank line: node builtins, external, workspace, relative.
Alphabetical within a group. One import per line for workspace packages.

### Error handling

```ts
// Typed, narrowable errors — not strings.
type RenderError =
  | { kind: 'limit-exceeded'; limit: LimitName; observed: number; allowed: number }
  | { kind: 'decode-failure'; detail: string }
  | { kind: 'parse-failure'; detail: string }

function describeError(error: RenderError): string {
  switch (error.kind) {
    case 'limit-exceeded':
      return `Nesting exceeded the ${error.limit} limit (${error.observed} > ${error.allowed}).`
    // Exhaustive by construction: adding a variant breaks the build here.
    case 'decode-failure':
    case 'parse-failure':
      return error.detail
  }
}
```text

Rules:

- Never swallow an error. If it is genuinely ignorable, log it with context.
- Never `catch (e) {}`. An empty catch block is a bug or a lie.
- Errors crossing a package boundary are typed unions or `Error` subclasses,
  never bare objects.
- User-facing messages are plain language with the path and what failed. No
  stack traces, no internal identifiers.
- Expected failures (limits, parse errors) are return values, not thrown
  exceptions. Throwing is for programming errors.

### Comments

```ts
// Good: explains a decision and its consequence.
const MAX_DEPTH = 100 // Beyond ~100, recursive rendering blows the webview's
                       // own stack before our limit fires. Kept well under.

// Bad: restates the code.
const MAX_DEPTH = 100 // the maximum depth

// Good: explains why the obvious approach is wrong here.
// A scroll listener that reads getBoundingClientRect() on every event forces
// synchronous layout each frame. IntersectionObserver is async and free.
const observer = new IntersectionObserver(handleHeading, { rootMargin: '0px 0px -70% 0px' })
```text

## CSS

- Custom properties for anything themeable. No hard-coded colours or sizes in
  component rules.
- `color-scheme: light dark` on the root, so form controls and scrollbars match.
- Logical properties (`margin-inline`, `padding-block`, `inset`) instead of
  physical ones, so RTL works.
- `rem` for type and spacing. `px` only for hairlines.
- Layer order declared explicitly with `@layer`: reset, tokens, base, document,
  components, utilities.
- No `!important` except in the reset.
- No ID selectors in stylesheets.
- Selectors stay shallow — no more than three levels.
- The content stylesheet targets elements the renderer emits, so it is written
  by element, not by utility class.
- `content-visibility: auto` with `contain-intrinsic-size` for anything below
  the fold in a long document.

## Rust

- `cargo clippy -- -D warnings` clean. `#![deny(unsafe_code)]` at the crate
  root; each `unsafe` block needs a `// SAFETY:` comment.
- `rustfmt` defaults.
- Errors via `thiserror`, never `unwrap()` in library code. `expect` only in
  tests and in `main` after all fallible work has completed.
- `#![forbid(unsafe_code)]` in `packages/core`-equivalent crates.
- Public items documented with `///` that explains why, not what.
- No panics on untrusted input. Every fallible operation returns `Result`.

## Testing

- Tests beside the code: `parse.test.ts`, not `__tests__/parse.ts`.
- The test name states the behaviour, not the function:
  `it('escapes raw HTML instead of emitting it')`, not `it('works')`.
- One behaviour per test. A test asserting five things fails with an unhelpful
  message.
- No snapshot tests for anything a human should read. Snapshots are for
  rendered HTML, where a diff is genuinely useful.
- Every bug fix gets a regression test that fails before the fix.
- Table-driven tests for the syntax cases; they read as a spec.
- Property-based testing for the parser and sanitizer. Property: no input
  produces an unescaped executable construct.
- Deterministic tests. No network, no real clock, no `Math.random()` without a
  seeded PRNG.

## Comments on architecture

- `packages/core` must not import platform code. Enforced by lint.
- `innerHTML` is allowed in exactly one function in the codebase. Lint-enforced.
- Adapters are the only place that knows a platform exists.
- Every IPC handler validates its inputs at the boundary. Validation inside the
  core is not a substitute; a core that receives a validated value from a
  misconfigured caller must still be safe, and the boundary is where the
  guarantee belongs.

## Naming a security-sensitive function

Functions that cross a trust boundary have the risk in their name or their doc
comment. `sanitize`, `resolveWithinRoot`, `isSafeUrl`, `escapeAttribute`. A
reviewer should be able to grep the boundary crossings.

## Documentation

- Markdown files follow `markdownlint-cli2`. Fenced code blocks with a language.
- Relative links must resolve. CI checks this.
- Every ADR follows the template in [`docs/adr/README.md`](../adr/README.md).
- Research documents cite sources. Inference is labelled as inference.

## Review checklist

- [ ] No `any` without a justification comment
- [ ] New trust-boundary code has tests, including a hostile-input case
- [ ] `innerHTML` only in the sanctioned insertion function
- [ ] Errors are typed, handled, and not swallowed
- [ ] Comments explain why
- [ ] Public API documented
- [ ] Performance-relevant paths measured, not assumed
- [ ] Keyboard path works for any new interaction
- [ ] CI green, including conformance

## Related

- [Testing strategy](testing-strategy.md)
- [Release process](release-process.md)
- [ADR index](../adr/README.md)
