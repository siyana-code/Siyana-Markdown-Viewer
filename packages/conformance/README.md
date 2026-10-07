# The CommonMark spec suite

Runs the **CommonMark 0.31.2** spec's own 652 examples against
`@siyana/core` and asserts a recorded baseline with a machine-checked
attribution for every failure.

## The measured result

Measured 2026-10-06, Node 24.14.1, `markdown-it` 15.0.2, against the vendored
`fixtures/spec-0.31.2.json`:

| Configuration | Strict | Normalised |
|---|---:|---:|
| Fidelity ceiling — preset `commonmark`, `html: true` | **649 / 652** | **652 / 652** |
| **Shipped** — both profiles | **573 / 652 = 87.88 %** | **576 / 652 = 88.34 %** |

For comparison, the same 652 examples against `marked` 18.1.0: **554 / 652 =
85.0 %**.

Both profiles score identically, and that is expected: the CommonMark spec
contains no table, strikethrough, footnote, or task-list example, so enabling
those extensions cannot change the result. The profiles *are* genuinely
different — `packages/core/src/profiles.test.ts` asserts they diverge — but this
suite cannot see the difference. That is a limitation of the suite, recorded here
so nobody later reads "identical scores" as "the profiles are the same".

## Where 649 − 573 goes, and why

The research corpus recorded **649 / 652** for `markdown-it@15.0.2` preset
`commonmark`. This suite reproduces that figure exactly. The gap to our shipped
score is therefore entirely attributable to two deliberate decisions, and
`pnpm --filter @siyana/conformance measure` decomposes it:

| Configuration | Strict | Normalised |
|---|---:|---:|
| preset `commonmark` — the research figure | 649 | 652 |
| + `html: false` | 577 | 580 |
| + `xhtmlOut: false` | 591 | 652 |
| + both | 519 | 580 |
| + our URL allowlist — **shipped** | **573** | **574** |

Every one of the 79 failures is attributed, mechanically:

| Cause | Count | Why it is acceptable |
|---|---:|---|
| `rawHtmlEscaped` | 72 | ADR-0005 Layer 1 |
| `schemeNotAllowed` | 4 | ADR-0005 Layer 1 |
| `serialisationOnly` | 3 | passes normalised |

### Two decisions the measurements overturned

**`xhtmlOut: false` cost 58 examples and bought nothing.** The first draft set it
on the reasoning that HTML5 does not want a self-closing slash on a void element.
The normalised column is *identical* either way, which is the proof that the
difference is pure serialisation with no semantic effect. Changed to `true`.

**Rejecting the empty URL was a bug.** The URL policy rejected `''`, which made
`markdown-it` discard the whole reference *definition*, so CommonMark examples 200
and 486 (`[foo]: <>` and `[link](<>)`) stopped being links at all and rendered as
literal text. An empty `href` is a reference to the current document and cannot
execute. Fixed, with a test named for it.

### The 72 `html: false` failures

Those examples assert on raw HTML blocks and inline HTML. With `html: false` the
parser escapes the markup and emits text, so the expected DOM never appears.
That is ADR-0005 Layer 1: raw HTML is disabled at the parser rather than sanitized
later, because a filter applied to output is harder to prove correct than output
that was never produced. For an application that renders files it did not author,
72 spec examples are a fair price for not being a script-execution vector.

### The four scheme failures

CommonMark permits an absolute URI in an autolink with *any* scheme. We permit
`http`, `https`, `mailto`, `tel`, and relative URLs, so four autolink examples
fail: `irc:`, `a+b+c:`, `made-up-scheme:`, and `localhost:5001`.

All four are inert, and that is the point — they are inert because they are *not
on the list*, not because each was individually audited. A blocklist would pass
all 652 and fail against the next scheme an attacker invents.

## Why attribution is machine-checked

A baseline asserting only "573 or more" will happily sit at 573 while the failures
change from 72 security trade-offs to 71 trade-offs and one unexplained bug.

So `run.ts` attributes every failure by **subtracting configurations**: it
re-renders each failing example with exactly one decision relaxed and claims the
cause only if the example then passes. A failure that no relaxation explains is
reported as `unattributed` and **fails the build**, because an unexplained failure
is a bug, not a known deviation.

The first version of this classifier inferred causes by pattern-matching the
expected HTML, and consequently filed 14 relative URLs under "scheme not
allowed" — where the policy had in fact permitted every one. A defect report that
guesses is worse than no defect report.

## Normalisation

`src/normalize.ts` is a faithful TypeScript port of the spec's own
`test/normalize.py`, including its quirks:

- `<br>` is in neither the block-tag list nor the `pre` list, so it is neither
  rstripped nor whitespace-preserving
- `script` and `style` *are* block tags but never set `in_pre`, so their text is
  whitespace-collapsed
- a start-end tag emits `<br>` and records `last = "endtag"`, which is how
  `<br />` becomes `<br>`
- entity references set `last = "ref"`, which is neither `starttag` nor `endtag`,
  so text after an entity is neither lstripped nor stripped

These are not bugs. Changing any of them changes the score, and the entire value
of this file is that it does not.

Porting it rather than shelling out to Python means CI produces the same number on
Windows, Linux, and macOS with no Python in the toolchain — which is also why the
CI job runs on all three operating systems. The runner is plain Node with no DOM
and no native code, so the only thing that *could* differ is text handling; a
number that is a property of the runner rather than of the parser is worth
detecting before shipping.

## Fixture integrity

`fixtures/spec-0.31.2.json` is vendored, not fetched. The runner asserts its
SHA-256 in-process before comparing anything:

```text
d431b29d97b6f73e69d547109cf5081578fac931e72afe95639ebe766c1b2a20
```

An in-process hash rather than a `sha256sum` step, because a CI step that shells
out works on Linux runners and fails on Windows ones. This repository has learned
that lesson already: every probe step in `.github/workflows/ci.yml` carries
`shell: bash` because the Windows runners default to `cmd.exe`.

The fixture is excluded from Biome's formatter for the same reason. Reformatting
a trailing newline would change the digest and make the number unverifiable.

To add a newer spec version: drop the file into `fixtures/`, then update
`EXPECTED_SPEC_SHA256` and `TOTAL_EXAMPLES` in `src/baseline.ts`. Record the new
numbers in a pull request that states whether they went up, down, or sideways —
and why.

## Running it

```bash
pnpm test:conformance                      # assert the baseline
pnpm --filter @siyana/conformance measure  # re-derive the decomposition table
pnpm --filter @siyana/conformance classify # re-derive the attribution
```

Exit code `0` on a pass, `1` on a baseline miss, an unattributed failure, a floor
breach, or a hash mismatch. It never exits `0` on a failure.

The CI job additionally greps the runner's own output for `652 examples` and
`CONFORMANCE: success`, so a suite that silently stopped comparing anything fails
rather than reporting green.
