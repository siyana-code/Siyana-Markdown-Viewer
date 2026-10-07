/**
 * Rendering profiles.
 *
 * ## Why a profile exists
 *
 * CommonMark conformance and a usable viewer want different parser settings, and
 * the difference is not cosmetic:
 *
 * - `commonmark` has **no** extension plugins and `html: false`. It is the
 *   profile the conformance suite runs against, so a change in the parser shows
 *   up as a change in a conformance number rather than a change nobody noticed.
 * - `siyana` adds the GFM-family extensions the product needs. Every one of them
 *   *reduces* strict CommonMark conformance, which was measured, not assumed
 *   (see `packages/conformance/README.md`).
 * - `html: false` costs roughly 57 CommonMark examples, because most of them
 *   assert on raw HTML blocks and inline HTML. That is the price of ADR-0005
 *   Layer 1 and it is paid on purpose.
 *
 * Keeping the two apart means the conformance number is a stable regression
 * signal instead of a number that moves whenever a product feature lands.
 */

export const PROFILES = ['commonmark', 'siyana'] as const

export type Profile = (typeof PROFILES)[number]

export function isProfile(value: unknown): value is Profile {
  return typeof value === 'string' && (PROFILES as readonly string[]).includes(value)
}

/**
 * The `markdown-it` preset each profile is built on.
 *
 * ## Why this is not optional
 *
 * `markdown-it`'s `default` preset enables **`table` and `strikethrough`** in
 * addition to CommonMark. Constructing `new MarkdownIt(options)` with no preset
 * name silently applies `default`.
 *
 * So the first draft of this file, which enabled extensions by name and declared
 * the `commonmark` profile as "no extensions", produced a `commonmark` profile
 * that still rendered GFM tables and `~~strikethrough~~`. It looked correct in a
 * spot check and was not: the conformance suite could not tell the difference,
 * because the spec has no table or strikethrough examples to fail.
 *
 * The failure was caught by testing that the two profiles *diverge*, which is
 * now a permanent test in `profiles.test.ts`. Declaring a set of extensions is
 * not the same as enabling exactly those extensions.
 */
export const PROFILE_PRESET = Object.freeze({
  commonmark: 'commonmark',
  siyana: 'default',
}) satisfies Record<Profile, 'commonmark' | 'default'>

/**
 * Extensions enabled per profile, on top of its preset.
 *
 * These are the only four in v1. Footnotes and task lists are NOT CommonMark and
 * not GFM proper — they are common dialect extensions, and that fact is recorded
 * here rather than left implicit.
 *
 * `table` and `strikethrough` are listed under `siyana` even though its preset
 * already enables them, because the list is read as "what this profile supports"
 * and leaving them out would misdescribe it. `PROFILE_EXTENSIONS` is therefore
 * documentation *and* an assertion surface: `profiles.test.ts` checks that every
 * name listed here actually changes output under its profile, which is the check
 * that would have caught the original bug in the other direction.
 */
export const PROFILE_EXTENSIONS = Object.freeze({
  /**
   * Typed as `readonly []` rather than `readonly string[]`. The difference is
   * what makes the `default` branch of the `switch` in `createRenderer`
   * exhaustive: with `string[]` the loop variable widens to `string` and the
   * `const exhaustive: never` check stops compiling, which would force the
   * unknown-extension guard to be removed rather than fixed.
   */
  commonmark: Object.freeze([] as readonly []),
  siyana: Object.freeze(['table', 'strikethrough', 'footnote', 'tasklists'] as const),
}) satisfies Record<Profile, readonly string[]>

/**
 * `linkify` per profile.
 *
 * Off for both in v1. It auto-links bare `http://…` text, which is not
 * CommonMark and surprises anyone who writes a URL inside a code span in prose.
 * It is a per-document opt-in for the renderer, not a parser default — see
 * `ParserOptions.linkify`.
 */
export const PROFILE_LINKIFY = Object.freeze({
  commonmark: false,
  siyana: false,
}) satisfies Record<Profile, boolean>
