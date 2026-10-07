/**
 * The conformance baseline.
 *
 * ## Read this before changing a number here
 *
 * A baseline is not a goal. It is a tripwire. Its job is to fail when the parser's
 * behaviour changes, so that the change is a decision rather than an accident.
 * Raising a number because the new number is higher is exactly the wrong
 * instinct: it means the change went unnoticed the first time.
 *
 * So every number below is accompanied by an **attribution**, and the attribution
 * is machine-checked rather than trusted. `classify.ts` proves the cause of each
 * failure by rendering the example with exactly one decision relaxed and asserting
 * the example then passes. A failure that cannot be attributed is a bug, not a
 * known deviation, and the runner fails if there is even one.
 *
 * ## The measured result
 *
 * Measured 2026-10-06, Node 24.14.1, `markdown-it` 15.0.2, against the vendored
 * `spec-0.31.2.json`
 * (SHA-256 `d431b29d97b6f73e69d547109cf5081578fac931e72afe95639ebe766c1b2a20`),
 * with the spec's `normalize.py` ported to `normalize.ts`.
 *
 *   shipped, profile `commonmark`   573 / 652 strict = 87.88 %
 *                                      576 / 652 normalised = 88.34 %
 *   shipped, profile `siyana`       identical to the above — see the note on
 *                                     SHIPPED_STRICT for why that is expected
 *
 * And the attribution of all 79 failures:
 *
 *   72  `html: false` — ADR-0005 Layer 1. Deliberate. See below.
 *    4  URL scheme allowlist — ADR-0005 Layer 1. Deliberate.
 *    3  serialisation only — passes normalised, fails byte comparison.
 *
 * ### The gap to 649, and where the research figure went
 *
 * The research corpus recorded **649 / 652** for `markdown-it@15.0.2` preset
 * `commonmark`. That figure is real, and this suite reproduces it exactly:
 *
 *   `measure.ts`, row 1 — preset `commonmark`, `html: true`, `xhtmlOut: true`
 *   → 649 / 652 strict, 652 / 652 normalised
 *
 * The difference between 649 and 573 is therefore entirely our two deliberate
 * choices, and `measure.ts` decomposes it exactly:
 *
 *   | configuration                          | strict | normalised |
 *   |----------------------------------------|-------:|-----------:|
 *   | preset `commonmark` (the research figure)|    649 |        652 |
 *   | + `html: false`                        |    577 |        580 |
 *   | + `xhtmlOut: false`                    |    591 |        652 |
 *   | + both                                 |    519 |        580 |
 *   | + our URL allowlist = **shipped**       |  **573** |    **574** |
 *
 * Two things in that table are worth stating plainly rather than burying:
 *
 * 1. **`xhtmlOut: false` cost 58 examples and bought nothing.** The first draft of
 *    the parser set it on the reasoning that HTML5 does not want a self-closing
 *    slash on a void element. The normalised column is *identical* either way,
 *    which proves the difference is pure serialisation. It has been changed to
 *    `true`.
 * 2. **The shipped score is lower than `html: false` alone would give** — 573
 *    against 577 — but *higher* than the naive sum would suggest, because
 *    `xhtmlOut: true` recovers 58. The earlier draft scored 513; correcting
 *    `xhtmlOut` and the empty-URL bug recovered 60 examples.
 *
 * ### Why 72 failures for `html: false` is the right trade
 *
 * Those 72 examples assert on raw HTML blocks and inline HTML. With `html: false`
 * the parser escapes the markup and emits text, so the expected DOM never
 * appears. This is ADR-0005 Layer 1: raw HTML is disabled at the parser, not
 * sanitized later, because "a filter applied to output" is harder to prove
 * correct than "the output was never produced".
 *
 * For an application that renders files it did not author — which is the entire
 * product — 72 spec examples are a fair price for not being a script-execution
 * vector. The alternative is documented and rejected in ADR-0005 §Alternatives.
 *
 * ### The four scheme failures
 *
 * CommonMark permits an absolute URI in an autolink with *any* scheme. We permit
 * `http`, `https`, `mailto`, `tel`, and relative URLs, so four autolink examples
 * fail: `irc:`, `a+b+c:`, `made-up-scheme:`, and `localhost:5001`.
 *
 * All four are inert, and that is the point — they are inert because they are
 * *not on the list*, not because they were individually audited. A blocklist would
 * pass all 652 and fail against the next scheme an attacker invents. An allowlist
 * passes 648 and is correct by construction.
 */

/** The number of examples in the vendored CommonMark 0.31.2 spec. */
export const TOTAL_EXAMPLES = 652

/** The parser's fidelity ceiling, with `html: true`. Reported, never asserted. */
export const FIDELITY_CEILING_STRICT = 649

/** The ceiling after normalisation. Reported, never asserted. */
export const FIDELITY_CEILING_NORMALISED = 652

/**
 * What the shipped configuration scores.
 *
 * Both profiles score identically, and that is expected: the CommonMark spec
 * contains no table, strikethrough, footnote, or task-list example, so enabling
 * those extensions cannot change the result. The profiles *are* genuinely
 * different — `profiles.test.ts` asserts they diverge on extension probes — but
 * the spec cannot see the difference. That is a limitation of the suite, recorded
 * so nobody later reads "identical scores" as "the profiles are the same".
 */
export const SHIPPED_STRICT = 573

/**
 * Normalised is *higher* than strict by exactly the three serialisation misses.
 *
 * The earlier draft of this file recorded 574 here, copied from a
 * `classify.ts` run whose `normalised` column counted only the examples that also
 * failed strictly — a number that was never going to be right, because
 * normalisation exists precisely to let serialisation differences pass. The
 * runner measures it independently: 652 − 76 = 576.
 *
 *   72  `html: false`      — the DOM differs, so normalisation cannot help
 *    4  scheme allowlist   — the anchor is absent, so normalisation cannot help
 *    3  serialisation only — normalisation is what rescues these
 */
export const SHIPPED_NORMALISED = 576

/**
 * The floor CI enforces.
 *
 * Deliberately below the measured value. This is the "the parser is still a
 * CommonMark parser" line, not a "nothing moved at all" line. A single unexpected
 * regression fails the job; accepting one is a change to `SHIPPED_STRICT` in a
 * pull request that states the new attribution.
 */
export const MINIMUM_STRICT_PASSES = 565

/** How the 79 known failures break down. Checked by `classify.ts` at runtime. */
export const EXPECTED_ATTRIBUTION = Object.freeze({
  /** Caused by `html: false` — ADR-0005 Layer 1. */
  rawHtmlEscaped: 72,
  /** Caused by the URL scheme allowlist — ADR-0005 Layer 1. */
  schemeNotAllowed: 4,
  /** Passes normalised; fails only the byte comparison. */
  serialisationOnly: 3,
})

export const EXPECTED_TOTAL_FAILURES =
  EXPECTED_ATTRIBUTION.rawHtmlEscaped +
  EXPECTED_ATTRIBUTION.schemeNotAllowed +
  EXPECTED_ATTRIBUTION.serialisationOnly
