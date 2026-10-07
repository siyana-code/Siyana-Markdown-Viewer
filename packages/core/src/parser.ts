/**
 * The parser factory: one place where ADR-0004's choice and ADR-0005 Layer 1
 * become actual configuration.
 *
 * Read this file as the executable form of those two ADRs. Every option here is
 * load-bearing, and the comment says which decision it implements.
 */

/**
 * `markdown-it` 15 ships its own type declarations, so `@types/markdown-it` is
 * deliberately absent: installing both produces a duplicate-identifier class of
 * error and a `Renderer` type that resolves to the older, wrong signature.
 */
import MarkdownIt, {
  type MarkdownIt as MarkdownItInstance,
  type MarkdownItOptions,
  type Renderer as MarkdownItRenderer,
  type RendererRule,
  type Token,
} from 'markdown-it'
import footnotePlugin from 'markdown-it-footnote'
import tasklistsPlugin from 'markdown-it-task-lists'
import { type LimitOverrides, type ResolvedLimits, raiseLimit, resolveLimits } from './limits.js'
import { PROFILE_EXTENSIONS, PROFILE_LINKIFY, PROFILE_PRESET, type Profile } from './profiles.js'
import { isImageUrlAllowed, isUrlAllowed, isUrlOrDataImageAllowed } from './url-policy.js'

/**
 * A configured, immutable markdown-it instance.
 *
 * Exposed as a distinct type so a caller cannot reach into `md.renderer.rules`
 * and swap a rule at runtime — that is how "we sanitize afterwards" quietly
 * becomes "we sanitize something other than what we thought".
 */
export interface Renderer {
  /** Render Markdown to an HTML string. */
  render(source: string): string
  /** Render to a token stream, for the outline and for search indexing. */
  parse(source: string): readonly Token[]
  /** The profile this renderer was built with. */
  readonly profile: Profile
  /** The limits in force for this renderer. */
  readonly limits: ResolvedLimits
}

export interface ParserOptions {
  /**
   * Which dialect to parse. `commonmark` is spec-only and exists for the
   * conformance suite; `siyana` is the product default.
   */
  readonly profile?: Profile
  /**
   * Auto-link bare URLs. Off by default in both profiles — see `profiles.ts`.
   * Per-document, because a document that wants it can ask and a global default
   * would rewrite text in every document that mentions a URL in prose.
   */
  readonly linkify?: boolean
  /**
   * Treat a single newline as a `<br>`. Off: it is not CommonMark, and it
   * breaks every document written to the CommonMark convention.
   */
  readonly breaks?: boolean
  /**
   * Allow `data:` image URLs. Off by default: inline images are a real feature
   * but they are also an unbounded decode, so they are per-document opt-in.
   * See `url-policy.ts`.
   */
  readonly allowDataImageUrls?: boolean
  /**
   * Parser limits. Merged over `DEFAULT_LIMITS` by `resolveLimits`, which
   * rejects a non-positive or non-finite value rather than clamping it.
   */
  readonly limits?: LimitOverrides
}

interface ResolvedParserSettings {
  readonly profile: Profile
  readonly linkify: boolean
  readonly breaks: boolean
}

/**
 * Every markdown-it option this application sets.
 *
 * Exported so the security baseline can assert on it: a test enumerates these
 * keys and asserts that none of them can enable raw HTML. That test is what
 * keeps ADR-0005 Layer 1 from being an aspiration.
 */
export const PARSER_OPTIONS: Readonly<Record<string, boolean | string>> = Object.freeze({
  html: false,
  typographer: false,
  breaks: false,
  xhtmlOut: true,
})

function buildOptions(settings: ResolvedParserSettings): MarkdownItOptions {
  return {
    /**
     * ADR-0005 Layer 1: raw HTML in the source is disabled at the parser. Not
     * "sanitized later" — disabled. `html: false` makes markdown-it escape the
     * markup instead of passing it through, which is what "emit escaped text
     * instead" in the ADR means.
     */
    html: false,

    /**
     * ADR-0004 hard requirement 1. `typographer: true` is the setting that
     * turns on the smartquotes rule carrying CVE-2026-48988 (quadratic O(n²)
     * DoS, fixed in 14.2.0). It also silently rewrites `--` to an em-dash and
     * `"x"` to curly quotes, which changes document text. Off, and it stays off.
     */
    typographer: false,

    /** Per-profile, and false unless the document asks. */
    linkify: settings.linkify,

    /** Not CommonMark. Off. */
    breaks: settings.breaks,

    /**
     * Emit `<br />`, not `<br>`.
     *
     * This was `false` in the first draft, on the reasoning that HTML5 does not
     * want a self-closing slash on a void element. That reasoning is about which
     * serialisation is idiomatic; it says nothing about correctness, and it cost
     * **58 of 652** CommonMark examples — the single largest conformance factor
     * in the parser after `html: false`. `<br />` is valid HTML5, unambiguously
     * parses to the same DOM as `<br>`, and matches the spec's expected output.
     *
     * Measured, 2026-10-06, 652 examples, preset `commonmark`:
     *
     *   |  xhtmlOut | strict | normalised |
     *   |-----------|-------:|-----------:|
     *   |  true     |    649 |        652 |
     *   |  false    |    591 |        652 |
     *
     * The normalised column is identical, which is the proof that this is purely
     * serialisation and carries no semantic difference.
     */
    xhtmlOut: true,

    /** Fence language class prefix. `language-ts`, not `lang-ts`. */
    langPrefix: 'language-',
  }
}

/** Build a renderer for a profile. */
export function createRenderer(options: ParserOptions = {}): Renderer {
  const profile: Profile = options.profile ?? 'siyana'
  const settings: ResolvedParserSettings = {
    profile,
    linkify: options.linkify ?? PROFILE_LINKIFY[profile],
    breaks: options.breaks ?? false,
  }
  const limits = resolveLimits(options.limits)
  const allowDataImageUrls = options.allowDataImageUrls ?? false

  /**
   * The preset is load-bearing, not a default to be omitted.
   *
   * `new MarkdownIt(options)` with no preset argument applies the `default`
   * preset, which enables `table` and `strikethrough`. The `commonmark` profile
   * must therefore name its preset explicitly or it is not a CommonMark parser.
   * See `PROFILE_PRESET` for how that mistake was made and how it was caught.
   */
  const md = new MarkdownIt(PROFILE_PRESET[profile], buildOptions(settings))

  /**
   * ADR-0005 Layer 1: reject `javascript:` and `data:` during parsing so they
   * never reach the sanitizer as live URLs.
   *
   * Assigned rather than passed to the constructor because `validateLink` is a
   * settable instance member in markdown-it 15, not a constructor option — the
   * type definitions are explicit that `MarkdownItOptions` does not carry it.
   *
   * ## Why this is not simply `isUrlAllowed`
   *
   * markdown-it calls `validateLink` with no context, for both `href` and `src`,
   * *during* inline parsing — and a token whose URL fails the check is never
   * produced at all. So `validateLink` has to permit `data:` image URLs when the
   * document opted in, or the opt-in silently does nothing. That was a real bug:
   * `allowDataImageUrls: true` produced no `<img>` element whatsoever, because
   * `validateLink` had already discarded the token before the `image` render rule
   * could re-admit it.
   *
   * Permitting `data:` here means a *link* whose href is a data URL would also
   * survive parsing, which is not acceptable. So the link side is enforced
   * separately, in {@link applyLinkHrefPolicy}, where the token type is known.
   *
   * Net effect: two independent checks per URL, one at parse time without
   * context and one at render time with it. That is defence in depth rather than
   * redundancy — neither check can be bypassed by the other's blind spot.
   */
  md.validateLink = allowDataImageUrls ? isUrlOrDataImageAllowed : isUrlAllowed

  for (const extension of PROFILE_EXTENSIONS[profile]) {
    switch (extension) {
      case 'table':
        md.enable('table')
        break
      case 'strikethrough':
        md.enable('strikethrough')
        break
      case 'footnote':
        md.use(footnotePlugin)
        break
      case 'tasklists':
        md.use(tasklistsPlugin)
        break
      default: {
        // A profile naming an extension this build does not implement is a
        // programming error, not a runtime condition, which is the intended use
        // of a thrown exception here.
        const exhaustive: never = extension
        throw new Error(`Unknown extension in profile "${profile}": ${String(exhaustive)}`)
      }
    }
  }

  applyImageSourcePolicy(md, allowDataImageUrls)
  applyLinkHrefPolicy(md)

  /**
   * The input-size gate, applied before parsing rather than inside it.
   *
   * `inputBytes` counts UTF-16 code units, because that is what
   * `String.prototype.length` reports and what every buffer size in the render
   * pipeline is denominated in. UTF-8 byte counts are documented separately in
   * `docs/architecture/rendering-pipeline.md`.
   */
  const gate = (source: string): void => {
    if (source.length > limits.inputBytes) {
      raiseLimit('inputBytes', source.length, limits)
    }
  }

  return Object.freeze({
    render: (source: string): string => {
      gate(source)
      return md.render(source)
    },
    parse: (source: string): readonly Token[] => {
      gate(source)
      return md.parse(source, {})
    },
    profile,
    limits,
  })
}

/**
 * Enforce the link URL policy where the token type is known.
 *
 * Required because `validateLink` is context-free: when a document opts in to
 * `data:` images, `validateLink` must admit data URLs so the image token
 * survives parsing, which means a data URL in a link's `href` survives too. This
 * rule is where that is caught.
 *
 * The same treatment as a blocked image `src`: empty the attribute and record the
 * original, so the link text stays visible and the reason is inspectable.
 */
function applyLinkHrefPolicy(md: MarkdownItInstance): void {
  const previous: RendererRule =
    md.renderer.rules['link_open'] ??
    ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts))

  md.renderer.rules['link_open'] = (tokens, idx, opts, env, self) => {
    const token = tokens[idx]
    if (token === undefined) return previous(tokens, idx, opts, env, self)

    const raw = token.attrGet('href')
    if (raw !== null && raw !== undefined) {
      const href = String(raw)
      if (!isUrlAllowed(href)) {
        token.attrSet('href', '')
        token.attrSet('data-blocked-href', href)
      }
    }

    return previous(tokens, idx, opts, env, self)
  }
}

/**
 * Enforce the image URL policy in the renderer, where the token type is known.
 *
 * A blocked `src` is replaced with an empty one and the original kept in
 * `data-blocked-src`, rather than the element being dropped: an image that
 * cannot load should still show its alt text, and deleting the node would lose
 * the author's content silently. `data-blocked-src` is inert markup — a data
 * attribute — and the sanitizer's attribute allowlist is expected to drop it;
 * keeping it here makes the loss debuggable in the DOM before that happens.
 */
function applyImageSourcePolicy(md: MarkdownItInstance, allowDataImageUrls: boolean): void {
  // `renderer.rules` is populated with a default `image` rule, so the fallback
  // is unreachable in practice. It is written out rather than left implicit so
  // that a markdown-it version which drops the default fails loudly in a test
  // rather than silently rendering unfiltered `src` values.
  const fallback: RendererRule = (tokens, idx, opts, _env, self) =>
    self.renderToken(tokens, idx, opts)

  // `renderer.rules` is a `Record<string, RendererRule>`, so the key is written
  // with bracket syntax: `noPropertyAccessFromIndexSignature` in tsconfig.base
  // rejects the dot form on an index signature.
  const previous: RendererRule = md.renderer.rules['image'] ?? fallback

  md.renderer.rules['image'] = (tokens, idx, opts, env, self: MarkdownItRenderer) => {
    const token = tokens[idx]
    // `noUncheckedIndexedAccess` makes `tokens[idx]` `Token | undefined`. An
    // out-of-range index is a markdown-it bug rather than a document
    // condition, so an absent token falls through to the previous rule
    // unchanged instead of throwing inside the renderer.
    if (token === undefined) return previous(tokens, idx, opts, env, self)

    // `attrGet` is typed `string | number | null`. The number case cannot occur
    // for `src` — markdown-it only ever sets string attribute values — so it is
    // narrowed rather than passed to a `string` parameter.
    const raw = token.attrGet('src')
    if (raw !== null && raw !== undefined) {
      const src = String(raw)
      const allowed = allowDataImageUrls ? isImageUrlAllowed(src) : isUrlAllowed(src)
      if (!allowed) {
        token.attrSet('src', '')
        token.attrSet('data-blocked-src', src)
      }
    }

    return previous(tokens, idx, opts, env, self)
  }
}
