/**
 * The security-invariant tests.
 *
 * ## Why these tests and not just comments
 *
 * ADR-0005 Layer 1 is a claim about the parser's configuration. A claim in an
 * ADR decays the first time someone adds `html: true` for a legitimate-looking
 * reason and no test objects. These tests are the objection.
 *
 * Each one asserts a property that must hold *regardless of why anyone is
 * editing the parser*. A future change that breaks one of these should have to
 * edit the test, and editing a test named "raw HTML is never emitted" requires
 * writing down why.
 */

import { describe, expect, it } from 'vitest'
import { renderDocument } from './index.js'
import { createRenderer, PARSER_OPTIONS } from './parser.js'

const siyana = createRenderer({ profile: 'siyana' })
const commonmark = createRenderer({ profile: 'commonmark' })

/**
 * Every tag the parser is allowed to emit, in any document, under the `siyana`
 * profile.
 *
 * Derived from what `markdown-it` produces for Markdown syntax, not from a
 * security document. `html: false` means no tag from the source can ever appear,
 * so this list is a closed set determined by the parser's own output vocabulary.
 *
 * Deliberately absent: every raw-HTML element (`script`, `style`, `iframe`,
 * `object`, `embed`, `svg`, `math`, `form`), every `on*` handler, and `<a>`'s
 * exotic attributes. If a future plugin adds a tag, that is a change to ADR-0005
 * and this list has to change with it — which is the point.
 */
const ALLOWED_OUTPUT_TAGS: readonly string[] = [
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'em',
  'strong',
  's',
  'del',
  'sub',
  'sup',
  'mark',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'section',
  'span',
  'div',
  'input',
]

describe('Layer 1: the parser emits no raw HTML from the source', () => {
  it('escapes a raw HTML block rather than emitting it', () => {
    const html = siyana.render('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes inline raw HTML', () => {
    const html = siyana.render('Text with <b onmouseover="alert(1)">bold</b> inline.')
    expect(html).not.toMatch(/<b\b/i)
    expect(html).toContain('&lt;b')
  })

  it('escapes an HTML comment', () => {
    const html = siyana.render('before <!-- secret --> after')
    expect(html).not.toContain('<!--')
  })

  it.each([
    '<img src=x onerror=alert(1)>',
    '<svg/onload=alert(1)>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>',
    '<form action="javascript:alert(1)"><button>x</button></form>',
    '<object data="javascript:alert(1)"></object>',
    '<a href="javascript:alert(1)">click</a>',
    '<style>body{background:url("javascript:alert(1)")}</style>',
  ])('neutralises the classic bypass payload %s', (payload) => {
    // The assertion is *allowlist*, not blocklist.
    //
    // The first draft checked for the absence of specific dangerous patterns —
    // no `<script`, no `on\w+=`, no `javascript:`. That is a blocklist, and it
    // failed on `<img src=x onerror=alert(1)>`: the output was
    // `&lt;img src=x onerror=alert(1)&gt;`, which is entirely inert escaped text,
    // yet it contains the substring ` onerror=` and so "failed".
    //
    // A blocklist that fires on escaped text trains a reader to ignore it. This
    // instead extracts every tag the parser actually emitted and asserts that
    // each one is one markdown-it emits by design. Anything else — a script
    // vector, a typo, a parser regression — fails, whether or not it was on the
    // list somebody remembered to write down.
    const tags = [...siyana.render(payload).matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)/g)].map((match) =>
      (match[1] as string).toLowerCase(),
    )
    for (const tag of tags) {
      expect(ALLOWED_OUTPUT_TAGS, `payload emitted <${tag}>`).toContain(tag)
    }
  })

  it('emits no live event-handler attribute anywhere', () => {
    // Kept as a separate assertion because it is the property that actually
    // matters, and the allowlist above would not catch an `onerror` smuggled
    // onto an allowed tag.
    const payloads = [
      '<img src=x onerror=alert(1)>',
      '<a href="#" onclick="alert(1)">x</a>',
      '<p onmouseover=alert(1)>text</p>',
      '<div onfocus=alert(1) tabindex=1>x</div>',
    ]
    for (const payload of payloads) {
      const html = siyana.render(payload)
      // Only count `on*=` occurrences that are *inside a real tag*, not inside
      // escaped text. `&lt;img src=x onerror=…&gt;` contains no live tag at all.
      for (const tag of html.matchAll(/<[^>]*>/g)) {
        expect(tag[0], payload).not.toMatch(/\son\w+\s*=/i)
      }
    }
  })
})

describe('Layer 1: the URL policy rejects script schemes at parse time', () => {
  it('does not emit a javascript: href', () => {
    const html = siyana.render('[click](javascript:alert(1))')
    expect(html).not.toMatch(/href\s*=\s*"\s*javascript:/i)
  })

  it.each([
    '[x](javascript:alert(1))',
    '[x](JAVASCRIPT:alert(1))',
    '[x](java\tscript:alert(1))',
    '[x](java\nscript:alert(1))',
    '[x](javascript&#58;alert(1))',
    '[x](vbscript:msgbox(1))',
  ])('rejects %s', (markdown) => {
    const html = siyana.render(markdown)
    expect(html).not.toMatch(/href\s*=\s*"\s*(javascript|vbscript|data):/i)
  })

  it('keeps a legitimate https link', () => {
    expect(siyana.render('[x](https://example.com)')).toContain('href="https://example.com"')
  })

  it('blocks a javascript: image src and records it for diagnosis', () => {
    const html = siyana.render('![alt](javascript:alert(1))')
    expect(html).not.toMatch(/src\s*=\s*"\s*javascript:/i)
  })

  // This was a real bug. `validateLink` is context-free in markdown-it, so a
  // link-only predicate discarded `data:` image tokens during inline parsing and
  // the opt-in rendered nothing at all. The test now pins both halves: the
  // opt-in works, and it does not weaken the link policy.
  it('blocks a data: image unless the document opted in', () => {
    const blocked = siyana.render('![alt](data:image/png;base64,AAAA)')
    expect(blocked).not.toMatch(/src\s*=\s*"data:/)

    const opted = createRenderer({ profile: 'siyana', allowDataImageUrls: true })
    expect(opted.render('![alt](data:image/png;base64,AAAA)')).toMatch(/src\s*=\s*"data:image\/png/)
  })

  it('still rejects a data: href after the image opt-in', () => {
    // The opt-in widens `validateLink` so image tokens survive parsing. It must
    // not make a data: URL clickable.
    const opted = createRenderer({ profile: 'siyana', allowDataImageUrls: true })
    const html = opted.render('[click](data:image/png;base64,AAAA)')
    // Match the attribute, not a bare `href="data:` — the diagnostic attribute
    // is named `data-blocked-href`, so a loose substring match fires on its own
    // name and "fails" a correctly-blocked link.
    expect(html).not.toMatch(/\shref="data:/)
    expect(html).toMatch(/\shref=""/)
    expect(html).toContain('data-blocked-href="data:image/png;base64,AAAA"')
  })

  it('still rejects an svg data: image after the opt-in', () => {
    const opted = createRenderer({ profile: 'siyana', allowDataImageUrls: true })
    const html = opted.render('![alt](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)')
    expect(html).not.toMatch(/src\s*=\s*"data:/)
  })
})

describe('Layer 1: no configuration path enables raw HTML', () => {
  it('the exported option table has html and typographer off', () => {
    expect(PARSER_OPTIONS.html).toBe(false)
    expect(PARSER_OPTIONS.typographer).toBe(false)
  })

  it('neither profile emits raw HTML', () => {
    for (const renderer of [siyana, commonmark]) {
      expect(renderer.render('<script>x</script>'), renderer.profile).not.toContain('<script')
    }
  })

  it('ParserOptions has no field that could turn html on', () => {
    // A compile-time check is stronger than a runtime one, but the runtime
    // check still catches a caller passing an unknown key through a spread.
    const hostile = { profile: 'siyana', html: true } as unknown as Record<string, unknown>
    expect(createRenderer(hostile as never).render('<script>x</script>')).not.toContain('<script')
  })
})

describe('Layer 1: typographer stays off', () => {
  // ADR-0004 requirement 1. Two reasons in one test: the CVE-2026-48988
  // smartquotes rule, and silent rewriting of document text.
  it('does not convert straight quotes to curly ones', () => {
    const html = siyana.render('She said "hello" to me.')
    // markdown-it escapes `"` to `&quot;` inside text, so the assertion is about
    // the *absence of typographic substitution*, not about the literal character.
    // The first draft asserted `toContain('"hello"')` and failed for that reason,
    // which says nothing about the typographer.
    expect(html).toContain('&quot;hello&quot;')
    expect(html).not.toContain('\u201c')
    expect(html).not.toContain('\u201d')
  })

  it('does not convert -- to an em-dash', () => {
    const html = siyana.render('a -- b')
    expect(html).toContain('--')
    expect(html).not.toContain('\u2014')
  })

  it('does not convert ... to an ellipsis', () => {
    const html = siyana.render('wait...')
    expect(html).toContain('...')
    expect(html).not.toContain('\u2026')
  })
})

describe('the result is marked unsafe until a sanitizer has run', () => {
  it('renderDocument never claims its output is safe', () => {
    const result = renderDocument('# Hello')
    expect(result.ok).toBe(true)
    if (result.ok) {
      // This is the marker that keeps Layer 2 from being optional: there is no
      // path in this package that flips it to true.
      expect(result.safe).toBe(false)
    }
  })

  it('keeps the raw source on a limit failure so raw mode needs no re-read', () => {
    const result = renderDocument('hello', { limits: { inputBytes: 2 } })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.kind).toBe('raw-fallback')
      expect(result.raw).toBe('hello')
      expect(result.error.kind).toBe('limit-exceeded')
    }
  })
})
