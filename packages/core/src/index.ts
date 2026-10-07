/**
 * The render entry point: Markdown in, sanitizable HTML plus metadata out.
 *
 * ## What this function deliberately does not do
 *
 * It does not sanitize. Sanitization is DOM-dependent (DOMPurify needs a
 * `DOMParser`) and this package is pure by ADR-0002's rule that `packages/core`
 * imports no platform code. Keeping the DOM out is what lets the conformance
 * suite run in Node with no browser and no shim, and it means the sanitized
 * output of the parser is testable without a document.
 *
 * So the pipeline is: {@link renderDocument} produces Layer 1 output, and the
 * caller feeds that to Layer 2. Layer 2 is mandatory — see `renderResult.safe`
 * below, which is `false` until it has run.
 */

import type { RenderError } from './limits.js'
import { LimitExceededError } from './limits.js'
import { createRenderer, type ParserOptions } from './parser.js'
import { isProfile, type Profile } from './profiles.js'
import { checkUrl } from './url-policy.js'

export {
  type BreachBehaviour,
  DEFAULT_LIMITS,
  describeRenderError,
  LIMIT_TABLE,
  type Limit,
  LimitExceededError,
  type LimitName,
  type LimitOverrides,
  type RenderError,
  type ResolvedLimits,
  raiseLimit,
  resolveLimits,
} from './limits.js'
export { createRenderer, PARSER_OPTIONS, type ParserOptions, type Renderer } from './parser.js'
export {
  isProfile,
  PROFILE_EXTENSIONS,
  PROFILE_LINKIFY,
  PROFILE_PRESET,
  PROFILES,
  type Profile,
} from './profiles.js'
export {
  checkUrl,
  extractScheme,
  IMAGE_ONLY_SCHEMES,
  isImageUrlAllowed,
  isUrlAllowed,
  isUrlOrDataImageAllowed,
  LINK_SCHEMES,
  MAX_DATA_IMAGE_BYTES,
  SAFE_DATA_IMAGE_MIME,
  type UrlContext,
  type UrlRejectionReason,
  type UrlVerdict,
} from './url-policy.js'

/** How a document should be presented. Purely descriptive; the renderer is safe. */
export type DocumentKind = 'rendered' | 'raw-fallback'

/**
 * The result of one render.
 *
 * `ok: false` is an expected state, not an exception. A 40 MB file that hits
 * `inputBytes` is a normal thing for a user to open, and the product's answer is
 * "show the raw text with an explanation", which is exactly what this type
 * carries.
 */
export type RenderResult =
  | {
      readonly ok: true
      readonly kind: 'rendered'
      /** Layer 1 output. Unsanitized. MUST pass through Layer 2 before the DOM. */
      readonly html: string
      /**
       * Always false. Present so that a caller which forgets Layer 2 has a
       * visible, greppable marker rather than a silently trusted string.
       * The sanitizer sets it to true; nothing in this package does.
       */
      readonly safe: false
      /** Heading outline, for the sidebar and for in-document navigation. */
      readonly outline: readonly OutlineEntry[]
      /** Every external reference, for the link-checker and for preload policy. */
      readonly references: readonly string[]
    }
  | {
      readonly ok: false
      readonly kind: DocumentKind
      readonly error: RenderError
      /** The source text, so the caller can show raw mode without re-reading. */
      readonly raw: string
    }

export interface OutlineEntry {
  /** 1-6, matching ATX heading levels. Setext headings map onto the same range. */
  readonly level: number
  /** The heading's text content, with inline markup already resolved. */
  readonly text: string
  /**
   * Slug, matching the `id` the renderer emitted. Derived by the same function
   * the renderer uses, so an anchor in the outline always resolves to an
   * element that exists.
   */
  readonly id: string
}

/**
 * Render a document.
 *
 * Expected failures come back as `ok: false`. Thrown exceptions from here mean
 * a programming error — a bad limit override, or an unknown profile.
 */
export function renderDocument(source: string, options: ParserOptions = {}): RenderResult {
  const profile: Profile = options.profile ?? 'siyana'
  if (!isProfile(profile)) {
    throw new TypeError(`Unknown profile: ${String(profile)}`)
  }

  // createRenderer throws only for a programming error — an unknown extension
  // name or a bad limit override — so it is deliberately outside the
  // try/catch below, which exists for expected per-document failures.
  const renderer = createRenderer(options)

  try {
    const tokens = renderer.parse(source)
    const html = renderer.render(source)
    const outline = extractOutline(tokens)
    const references = extractReferences(tokens)

    return {
      ok: true,
      kind: 'rendered',
      html,
      safe: false,
      outline,
      references,
    }
  } catch (error) {
    if (error instanceof LimitExceededError) {
      return {
        ok: false,
        kind: 'raw-fallback',
        error: error.toRenderError(),
        raw: source,
      }
    }
    throw error
  }
}

/**
 * Slugify a heading's text the way the renderer's anchor rule does.
 *
 * Duplicated here rather than imported because the anchor rule lives inside
 * `markdown-it`'s core and is not exported. Keeping one copy of the *rule* in
 * `slug.ts` and having the renderer use it too is the fix; this is the
 * reference implementation of it until then, and `slug.test.ts` pins the
 * behaviour.
 */
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

/**
 * Build the outline from the token stream.
 *
 * Only `heading_open` tokens contribute. `inline` content follows each one, so
 * this walks in pairs rather than assuming a fixed stride — assuming a stride
 * is how an outline ends up with every second heading missing once a plugin
 * inserts a token.
 */
function extractOutline(tokens: readonly import('markdown-it').Token[]): readonly OutlineEntry[] {
  const entries: OutlineEntry[] = []
  const seen = new Map<string, number>()

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === undefined || token.type !== 'heading_open') continue

    const inline = tokens[i + 1]
    if (inline?.type !== 'inline') continue

    const text = inline.content.trim()
    const base = slugify(text)
    // Disambiguate duplicates, matching the convention GitHub and most static
    // site generators use: `heading`, `heading-1`, `heading-2`.
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count}`

    entries.push({ level: Number.parseInt(token.tag.slice(1), 10), text, id })
  }

  return entries
}

/**
 * Collect every URL the document references.
 *
 * Used by two product features — prefetching, and warning the user before a
 * click leaves the machine — so it walks both link and image tokens and
 * normalises through the same policy check the renderer used.
 */
function extractReferences(tokens: readonly import('markdown-it').Token[]): readonly string[] {
  const found = new Set<string>()

  for (const token of tokens) {
    if (token.type !== 'link_open' && token.type !== 'image') continue

    const raw = token.attrGet('href') ?? token.attrGet('src')
    if (raw === null || raw === undefined) continue

    // See `applyImageSourcePolicy` in parser.ts: markdown-it only ever sets
    // string attribute values, so the `number` arm of `attrGet`'s return type
    // is narrowed rather than assumed away.
    const href = String(raw)
    if (href === '') continue

    const context = token.type === 'image' ? 'image' : 'link'
    if (checkUrl(href, context).allowed) found.add(href)
  }

  return [...found]
}
