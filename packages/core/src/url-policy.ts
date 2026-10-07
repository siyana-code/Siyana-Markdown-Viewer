/**
 * URL policy, applied **during parsing**.
 *
 * This is ADR-0005 Layer 1's third bullet: "`javascript:` and `data:` URLs are
 * rejected during parsing, so they never reach the sanitizer as live URLs." The
 * sanitizer (Layer 2) re-checks the same rules, because a parser bug would
 * otherwise be the only thing standing between a document and execution. Two
 * independent implementations of one policy is the point, not duplication.
 *
 * ## The order of operations matters
 *
 * A scheme check on the raw string is trivially bypassed. `javascript&#58;alert(1)`
 * and `java\tscript:alert(1)` and `JaVaScRiPt:alert(1)` all reach a browser as
 * `javascript:alert(1)`. So, in order:
 *
 * 1. Trim ASCII whitespace and remove ASCII control characters, which browsers
 *    ignore inside a URL but which defeat a naive `startsWith`.
 * 2. Resolve HTML entities (`&#58;` -> `:`), which is what `markdown-it` has
 *    already done to `href` by the time we see it, but which a raw-string
 *    comparison would still miss.
 * 3. Decode percent-escapes in the scheme position, because `%6a%61...:` is
 *    not a scheme and browsers do not treat it as one — rejecting it is
 *    conservative and costs nothing.
 * 4. Case-fold and compare against the allowlist.
 *
 * Anything whose scheme cannot be positively identified as allowed is rejected.
 * The default-deny direction is the whole security property; an allowlist that
 * falls through to "unknown is probably fine" does not have one.
 */

/** Schemes allowed in `href` on links and images. */
export const LINK_SCHEMES = Object.freeze(['http:', 'https:', 'mailto:', 'tel:'])

/**
 * Image-only schemes, additionally permitted. `data:` is here because inline
 * images are a real requirement for a local-first Markdown viewer, and it is
 * gated twice: only for `<img src>`, and only for the MIME list below.
 */
export const IMAGE_ONLY_SCHEMES = Object.freeze(['data:'])

/**
 * `data:` MIME types allowed for images.
 *
 * `image/svg+xml` is deliberately absent. An SVG is a script container: it can
 * carry `<script>`, `onload`, and external references, and a browser renders it
 * as an active document when referenced from `<img>` in some engines and as an
 * inline document in others. The correct way to ship an SVG in a document is as
 * a file the shell resolves through the scoped native path layer.
 */
export const SAFE_DATA_IMAGE_MIME = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/x-icon',
])

/** Bytes. Above this a `data:` image is refused rather than decoded. */
export const MAX_DATA_IMAGE_BYTES = 1024 * 1024

export type UrlContext = 'link' | 'image'

export type UrlVerdict =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: UrlRejectionReason }

export type UrlRejectionReason =
  // There is deliberately no `'empty'` member. An empty URL is a reference to
  // the current document and cannot execute, so rejecting it was a bug. See
  // `checkUrl`.
  | 'scheme-not-allowed'
  | 'data-image-not-allowed'
  | 'data-image-mime-not-allowed'
  | 'data-image-too-large'

/**
 * ASCII whitespace and control characters, which browsers strip from a URL.
 *
 * Tab (0x09), LF (0x0a) and CR (0x0d) are the ones that matter: WHATWG URL
 * parsing removes all tab-and-newline sequences from a URL, which is precisely
 * what makes `java&#9;script:` work as a bypass in naive filters.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the control characters are the point
const URL_IGNORABLE = /[\u0000-\u0020\u007F-\u00A0\u2000-\u200D\u2028-\u202F\u205F-\u2060\uFEFF]/g

/** Strip what a browser would ignore before deciding a URL's scheme. */
export function normaliseUrlForSchemeCheck(url: string): string {
  return url.replace(URL_IGNORABLE, '')
}

/**
 * Decode HTML entities in the scheme position only.
 *
 * `markdown-it` entity-decodes attribute values before `validateLink` runs, so
 * in the normal path this is a no-op. It is not a no-op when this function is
 * called from the sanitizer layer or from a test with a hand-written string, and
 * a security function that is only correct on the happy path is not a security
 * function.
 */
function decodeEntitiesForSchemeCheck(url: string): string {
  return url.replace(/&#(x[0-9a-f]+|[0-9]+);?/gi, (match, body: string) => {
    const codePoint =
      body.startsWith('x') || body.startsWith('X')
        ? Number.parseInt(body.slice(1), 16)
        : Number.parseInt(body, 10)
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match
    try {
      return String.fromCodePoint(codePoint)
    } catch {
      return match
    }
  })
}

/** The scheme, lower-cased and with its trailing colon, or null if relative. */
export function extractScheme(url: string): string | null {
  const normalised = decodeEntitiesForSchemeCheck(normaliseUrlForSchemeCheck(url))
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(normalised)
  return match?.[1] === undefined ? null : `${match[1].toLowerCase()}:`
}

/**
 * Parse the header of a `data:` URL: its MIME type and its decoded byte count.
 *
 * Returns null when the URL is not a `data:` URL or its header is unparseable,
 * which the caller treats as a rejection.
 */
function parseDataUrl(url: string): { mime: string; bytes: number } | null {
  const normalised = decodeEntitiesForSchemeCheck(normaliseUrlForSchemeCheck(url))
  if (!normalised.toLowerCase().startsWith('data:')) return null

  const comma = normalised.indexOf(',')
  if (comma === -1) return null

  const header = normalised.slice(5, comma)
  const parameters = header.split(';')
  const mime = (parameters[0] ?? '').trim().toLowerCase()
  const base64 = parameters.slice(1).some((p) => p.trim().toLowerCase() === 'base64')

  const payload = normalised.slice(comma + 1)
  // Base64's decoded size is derivable without decoding, which matters: a
  // caller that decoded first would have to allocate the oversized value it is
  // trying to reject.
  const bytes = base64
    ? Math.floor((payload.replace(/[\s]/g, '').length * 3) / 4)
    : new TextEncoder().encode(decodeURIComponentSafe(payload)).length

  return { mime, bytes }
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Decide whether a URL may appear, in the given context.
 *
 * Relative URLs, in-document fragments, and query-only URLs have no scheme and
 * are always allowed: they cannot execute. A scheme-looking prefix that fails
 * to parse as a scheme is also allowed, because the browser will treat it as
 * relative too, and rejecting it would break legitimate documents for no gain.
 */
export function checkUrl(url: string, context: UrlContext): UrlVerdict {
  const scheme = extractScheme(url)

  if (scheme === null) {
    // An empty URL is allowed, and this was a bug caught by the conformance
    // suite rather than by reading. CommonMark examples 200 and 486 use
    // `[foo]: <>` and `[link](<>)`, both of which are a link to the empty
    // string — a reference to the current document. markdown-it normalises
    // `<>` to `''` before `validateLink` sees it, so an empty-string rejection
    // silently discarded the reference *definition* as well as the link,
    // turning `href=""` into literal text. An empty `href` resolves to the
    // current document and cannot execute.
    return { allowed: true }
  }

  if (LINK_SCHEMES.includes(scheme)) return { allowed: true }

  if (scheme === 'data:') {
    if (context !== 'image') return { allowed: false, reason: 'scheme-not-allowed' }

    const parsed = parseDataUrl(url)
    if (parsed === null) return { allowed: false, reason: 'data-image-not-allowed' }
    if (!SAFE_DATA_IMAGE_MIME.includes(parsed.mime)) {
      return { allowed: false, reason: 'data-image-mime-not-allowed' }
    }
    if (parsed.bytes > MAX_DATA_IMAGE_BYTES) {
      return { allowed: false, reason: 'data-image-too-large' }
    }
    return { allowed: true }
  }

  return { allowed: false, reason: 'scheme-not-allowed' }
}

/** Boolean form of {@link checkUrl}, for use as `markdown-it`'s `validateLink`. */
export function isUrlAllowed(url: string): boolean {
  return checkUrl(url, 'link').allowed
}

/**
 * The `validateLink` predicate when a document has opted in to `data:` images.
 *
 * `markdown-it` calls `validateLink` with **no context** — the same function sees
 * a link's `href` and an image's `src`, and a token whose URL fails the check is
 * discarded during inline parsing, never reaching any render rule.
 *
 * So a strict link-only predicate here silently disables the `data:` image
 * feature entirely: the token is gone before `applyImageSourcePolicy` could
 * re-admit it. That is not hypothetical, it is what the first draft did, and the
 * symptom was that `allowDataImageUrls: true` rendered no images at all.
 *
 * This predicate therefore admits anything either context would accept, and the
 * context-specific rejection moves to the render rules, where the token type is
 * known. `javascript:`, `vbscript:`, and `data:` in a *link* are all still
 * rejected — just at the point where the context is known, rather than at a point
 * where it is not.
 */
export function isUrlOrDataImageAllowed(url: string): boolean {
  return checkUrl(url, 'link').allowed || checkUrl(url, 'image').allowed
}

/** Boolean form of {@link checkUrl} for image sources, which admit `data:`. */
export function isImageUrlAllowed(url: string): boolean {
  return checkUrl(url, 'image').allowed
}
