# ADR-0006: `packages/core` module boundaries and the deferred transform stage

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** project maintainers
- **Supersedes:** nothing
- **Amends:**
  - [ADR-0002](0002-monorepo-with-workspaces.md) — scope of the core boundary
  - [`docs/architecture/monorepo-structure.md`](../architecture/monorepo-structure.md)
    — the `packages/core` module table, which this ADR updates

## Context

[`docs/architecture/monorepo-structure.md`](../architecture/monorepo-structure.md)
specifies six modules inside `packages/core`: `decode`, `parse`, `transform`,
`serialize`, `limits`, and `profile`. It also specifies a public surface with a
`rawHtml: 'escape' | 'allow-if-sanitized'` option.

Phase 1 built `packages/core` against ADR-0004 (parser choice) and ADR-0005
(security baseline). Three things did not survive contact with the measurements:

1. **We do not own a `parse` or `serialize` stage.** ADR-0004 chose
   `markdown-it`, which is a parser *and* a renderer. Writing our own AST walk to
   satisfy the module table would be a second implementation of work already done
   and tested against the CommonMark spec.
2. **The `rawHtml` option contradicts ADR-0005.** ADR-0005 Layer 1 requires raw
   HTML to be *disabled at the parser*. An option that permits it, even
   conditionally, is the mechanism by which Layer 1 gets switched off in a
   release nobody reviewed.
3. **The module table assumed `transform` was free.** It is not: anchors, slugs,
   duplicate-heading disambiguation, and outline extraction all need somewhere to
   live, and `markdown-it` provides none of them.

Separately, the URL policy needed its own module. It is security-critical, it is
not part of parsing, and burying it in `parser.ts` would make it hard to review
and harder to reuse from the sanitizer layer.

## Decision

### 1. `parse` and `serialize` are `markdown-it`, and the module table is updated

`packages/core` exposes `parser.ts`, which wraps a configured `markdown-it`
instance and returns HTML. The module table in the architecture document now
marks `parse` and `serialize` as *provided by the dependency* rather than as
modules we write.

This is not a retreat from the table's intent. The intent was that the boundaries
be explicit and that the tag vocabulary be fixed; both still hold. The boundary
is `parser.ts`'s exported `Renderer` interface, and the vocabulary is fixed by
`html: false` plus the allowlist asserted in `security.test.ts`.

### 2. No `rawHtml` option, at all

There is no way to enable raw HTML. Not a default, not a per-document flag, not
a profile. The option was in the architecture document before there was code, and
it was written on the assumption that a sanitized escape hatch is a feature.

Measured: `html: true` is worth **72 CommonMark examples** (see
[`packages/conformance/README.md`](../../packages/conformance/README.md)). Those
72 examples are the price of not being a script-execution vector, and offering
the option means the price is only paid by whoever remembered to refuse it.

The correct place for a raw-HTML escape hatch, if one is ever needed, is a
separate product feature with its own threat model — a "trusted documents" mode,
off by default, that says plainly what it gives up. Not a rendering option.

### 3. `transform` is deferred, and the outline lives in `index.ts` for now

`renderDocument` returns `outline` and `references` alongside `html`, computed
from the token stream. That is the whole of `transform` for v1.

What is deferred: anchor `id` attributes on headings, syntax highlighting,
math, diagrams, footnote id collection. Each is a renderer rule that `markdown-it`
supports as a plugin, and each should arrive with the UI work that needs it rather
than speculatively.

**Known inconsistency, recorded deliberately.** The outline's slugs are computed
by `slugify` in `index.ts`, and the renderer does *not* currently emit matching
`id` attributes — anchor generation is deferred. So an `OutlineEntry.id` does not
yet resolve to an element in the document. The function is a faithful
implementation of the rule the anchor renderer will use, and
`packages/core/src/slug.test.ts` will pin it, but until the anchor rule lands the
outline is not navigable. This is called out here rather than left for someone to
discover.

### 4. `url-policy.ts` is its own module

Exports `checkUrl(url, context)`, `extractScheme`, and the boolean predicates.
It is the only place a URL is judged safe or unsafe, so that the parser and the
sanitizer layer can share one implementation rather than two that drift.

### 5. `profiles.ts` names a preset, not just a set of extensions

`PROFILE_PRESET` maps each profile to a `markdown-it` preset. This exists because
of a defect, not a preference: `new MarkdownIt(options)` with no preset name
applies the `default` preset, which enables `table` and `strikethrough`. The
`commonmark` profile was therefore rendering GFM tables while claiming to be plain
CommonMark.

A profile that declares "no extensions" is not the same as a profile that has no
extensions, and only the second one is a CommonMark parser.

## Consequences

### Good

- No code path can emit raw HTML, so ADR-0005 Layer 1 cannot be bypassed by
  configuration.
- The URL policy has one address and one test suite.
- Conformance is a checked, measured number: **573/652 shipped, 649/652 ceiling**,
  with every failure attributed to a named decision.
- The `commonmark` profile is now provably a CommonMark parser, asserted by
  behavioural tests rather than by inspecting a configuration list.

### Bad / accepted costs

- 72 CommonMark examples fail. Deliberate, quantified, and reported on every CI run
  so it cannot drift unnoticed.
- `packages/core` has no AST of its own. Any consumer wanting a tree must use
  `Renderer.parse`, which returns `markdown-it`'s token stream, so the token shape
  is the dependency's to change. This is the price of not reimplementing a
  spec-conformant parser, and it is bounded by pinning `markdown-it` exactly.
- Outline slugs and heading anchors are currently inconsistent (see §3).
- Four CommonMark autolink examples fail on the scheme allowlist. Also deliberate;
  an allowlist is correct by construction where a blocklist is not.

### Follow-up work

1. Anchor generation, which closes the outline inconsistency.
2. `decode` — encoding detection and BOM handling — before any file I/O exists.
3. A GFM conformance suite, using the same attribution discipline. GFM has 672
   examples and `spec.txt` rather than `spec.json`, so it needs its own parser.

## Validation

- `pnpm verify` — format, lint, typecheck, build, 99 unit tests, conformance,
  extension verification. All green.
- `pnpm test:conformance` — 573/652 strict, 576/652 normalised, 79 failures all
  attributed, 0 unattributed.
- `pnpm conformance:extensions` — all four extensions verified to change output.
