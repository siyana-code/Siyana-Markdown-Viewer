# Biome configuration

`biome.json` is the linter and formatter for every TypeScript file in this
repository. This file explains what is in it and, where a setting looks
arbitrary, why it is that way.

**Comments cannot go in `biome.json`.** Biome's config parser rejects `//` and
`/* */` — verified, not assumed: a config with a single leading `// comment`
fails with `Expected a property but instead found '// leading comment'`. So the
rationale lives here rather than inline, and the JSON carries only values.

## `vcs.useIgnoreFile: true`

Biome reads `.gitignore` and skips what it lists. This is why `node_modules`,
`dist`, and `target` need no mention: `.gitignore` already has them.

## `files.includes`

```json
["**", "!**/node_modules", "!**/dist", "!**/target", "!**/fixtures", "!**/*.min.js"]
```

The negations exist only for paths `.gitignore` does **not** carry:

- **`!**/fixtures`** — `packages/conformance/fixtures/spec-0.31.2.json` is
  140 KB of committed, vendored upstream data whose bytes are pinned by SHA-256.
  The conformance runner asserts that digest before comparing anything, so
  reformatting the file's trailing newline would break the pin and make the
  reported conformance number unverifiable. Biome wanted to add exactly one byte.
  An earlier version of this config excluded `!**/spec.json` by filename, which
  stopped matching once the fixture was renamed to `spec-0.31.2.json` — the
  pattern that actually works is on the directory.

**No trailing `/**`** on the folder patterns. Biome 2.2 changed this, and
`useBiomeIgnoreFolder` warns about `!**/dist/**` by default. Turning that
warning off would be the wrong trade: the warning is correct.

## `formatter`

Standard settings. Two are worth naming.

- `lineWidth: 100` rather than Biome's default 80, matching `tsconfig.base.json`'s
  habits and the width the research corpus's code blocks assume.
- `lineEnding: "lf"` — matches `.gitattributes` and the spec fixture. A CRLF
  formatter on Windows would rewrite the fixture and break the same SHA-256 pin.

## `javascript.formatter`

Single quotes, no semicolons, trailing commas. A house style, not a requirement.
`arrowParentheses: "always"` is explicit because Biome's default is `asNeeded`,
and the distinction is visible enough in the diffs to be worth pinning.

## Two configs, two tools

`biome.json` and `.markdownlint-cli2.jsonc` both describe this repository and
both are excluded from each other. That is not redundancy, it is two tools with
disjoint jobs — Biome formats TypeScript, markdownlint-cli2 formats Markdown —
and the boundary is enforced from both sides so neither tool rewrites the
other's files.

## Linter

`recommended: true` plus four explicit rules. Each overrides a recommended
default in the direction we want:

| Rule | Why it is pinned to `error` |
|---|---|
| `noUnusedImports` | Recommended, but a leftover import of a `markdown-it` type after a refactor is exactly the kind of thing that indicates a half-finished change. |
| `noUnusedVariables` | Same. |
| `noExplicitAny` | ADR-0002 requires that package boundaries be visible in the types. `any` erases the boundary. Overridden off for tests and for the conformance package, which pattern-matches spec JSON of unknown shape. |
| `noNonNullAssertion` | `!` is a promise the compiler cannot check. In `packages/core` the checked alternative is usually to narrow properly. |
| `noDangerouslySetInnerHtml` | ADR-0005 Layer 3 bans `innerHTML` for document content. This makes it a build failure rather than a review comment. |

`complexity.useLiteralKeys` is **off**, and that is a consequence of
`tsconfig.base.json` rather than a style preference: `noPropertyAccessFromIndexSignature`
is on, and `markdown-it`'s `renderer.rules` is a `Record<string, RendererRule>`.
The two rules disagree on `rules.image` versus `rules['image']`, and the
TypeScript setting is the one that carries meaning here.

## `overrides`

```json
{ "includes": ["**/*.test.ts", "**/conformance/**"], ... }
```

`noExplicitAny` and `noNonNullAssertion` are off there. Tests and the
conformance harness deal in data of unknown shape — spec fixtures, JSON that
arrives from the network — where an explicit `any` documents "this is
untrusted, see the runtime check" and a `!` is narrower than the guard that
preceded it.

`noDangerouslySetInnerHtml` stays **on** everywhere. There is no test that needs
it, and the one rule that encodes ADR-0005 Layer 3 should not have an exception
list.
