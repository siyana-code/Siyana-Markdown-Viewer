import { describe, expect, it } from 'vitest'
import {
  checkUrl,
  extractScheme,
  isImageUrlAllowed,
  isUrlAllowed,
  MAX_DATA_IMAGE_BYTES,
} from './url-policy.js'

describe('extractScheme', () => {
  it('finds a scheme and lower-cases it', () => {
    expect(extractScheme('HTTPS://example.com')).toBe('https:')
    expect(extractScheme('MailTo:a@b.c')).toBe('mailto:')
  })

  it('returns null for a relative URL', () => {
    expect(extractScheme('./notes.md')).toBeNull()
    expect(extractScheme('#heading')).toBeNull()
    expect(extractScheme('/absolute/path')).toBeNull()
    expect(extractScheme('?query=1')).toBeNull()
  })

  // A scheme check on the raw string is trivially bypassed by these. They are
  // the reason normaliseUrlForSchemeCheck exists.
  it('sees through tab and newline injection inside the scheme', () => {
    expect(extractScheme('java\tscript:alert(1)')).toBe('javascript:')
    expect(extractScheme('java\nscript:alert(1)')).toBe('javascript:')
    expect(extractScheme('java\rscript:alert(1)')).toBe('javascript:')
    expect(extractScheme('  javascript:alert(1)')).toBe('javascript:')
  })

  it('sees through HTML-entity-encoded colons', () => {
    expect(extractScheme('javascript&#58;alert(1)')).toBe('javascript:')
    expect(extractScheme('javascript&#x3a;alert(1)')).toBe('javascript:')
  })

  it('sees through a null byte in the middle of the scheme', () => {
    expect(extractScheme('java\u0000script:alert(1)')).toBe('javascript:')
  })
})

describe('checkUrl for links', () => {
  it.each(['http://example.com', 'https://example.com', 'mailto:a@b.c', 'tel:+15551234'])(
    'allows %s',
    (url) => {
      expect(checkUrl(url, 'link').allowed).toBe(true)
    },
  )

  it.each(['./relative.md', '../up.md', '#anchor', '/rooted.md', '?q=1', 'notes\\file.md'])(
    'allows the relative or schemeless URL %s',
    (url) => {
      expect(checkUrl(url, 'link').allowed).toBe(true)
    },
  )

  // A single letter followed by a colon is syntactically a scheme, and `c:` is a
  // real one. So `C:/notes/file.md` — which every Windows user writes — is
  // *rejected*, and that is deliberate rather than an oversight.
  //
  // It cannot execute: there is no `c:` protocol handler in any browser, and
  // treating it as relative would mean resolving it against the document's own
  // origin, which is not what the author meant either. The shell's native path
  // layer (ADR-0005 Layer 4) is what resolves absolute filesystem paths, and it
  // validates them itself.
  //
  // Recorded here because "Windows paths are broken" is a plausible bug report
  // and this is the answer to it.
  it('rejects a bare drive letter, deferring to the native path layer', () => {
    expect(checkUrl('C:/notes/file.md', 'link').allowed).toBe(false)
    expect(checkUrl('c:\\notes\\file.md', 'link').allowed).toBe(false)
  })

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'javascript&#58;alert(1)',
    'vbscript:msgbox(1)',
    'file:///C:/Windows/System32',
  ])('rejects %s', (url) => {
    const verdict = checkUrl(url, 'link')
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toBe('scheme-not-allowed')
  })

  // Caught by the conformance suite, not by reading: rejecting the empty string
  // made markdown-it discard the whole reference *definition*, so `[foo]: <>`
  // stopped being a link. An empty href is a reference to the current document.
  it('allows an empty URL, which references the current document', () => {
    expect(checkUrl('', 'link').allowed).toBe(true)
    expect(checkUrl('   ', 'link').allowed).toBe(true)
  })

  it('rejects data: for links, even a safe image payload', () => {
    expect(checkUrl('data:image/png;base64,AAAA', 'link').allowed).toBe(false)
  })
})

describe('checkUrl for images', () => {
  it('allows a small base64 PNG', () => {
    // 4 base64 chars decode to 3 bytes.
    const png = `data:image/png;base64,${'A'.repeat(4)}`
    expect(checkUrl(png, 'image').allowed).toBe(true)
  })

  it('allows SVG only as a file reference, never as a data: payload', () => {
    const verdict = checkUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'image')
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toBe('data-image-mime-not-allowed')
  })

  it('rejects a data: URL whose MIME is outside the allowlist', () => {
    const verdict = checkUrl('data:text/html;base64,PHNjcmlwdD4=', 'image')
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toBe('data-image-mime-not-allowed')
  })

  it('rejects a data: image over the size cap, without decoding it', () => {
    // Well over 1 MiB once decoded, but the check is arithmetic on the length.
    const huge = `data:image/png;base64,${'A'.repeat(MAX_DATA_IMAGE_BYTES * 2)}`
    const verdict = checkUrl(huge, 'image')
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toBe('data-image-too-large')
  })

  it('rejects a malformed data: URL rather than treating it as an image', () => {
    // No comma, so there is no payload at all. `parseDataUrl` returns null and
    // the rejection is `data-image-not-allowed` — a distinct reason from a
    // well-formed URL carrying a disallowed MIME type, which matters because
    // the two mean different things when triaging a blocked document.
    const verdict = checkUrl('data:image/png;base64', 'image')
    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) expect(verdict.reason).toBe('data-image-not-allowed')
  })

  it('still rejects javascript: for images', () => {
    expect(checkUrl('javascript:alert(1)', 'image').allowed).toBe(false)
  })
})

describe('the boolean helpers markdown-it uses', () => {
  it('isUrlAllowed is the link policy', () => {
    expect(isUrlAllowed('https://example.com')).toBe(true)
    expect(isUrlAllowed('javascript:alert(1)')).toBe(false)
  })

  it('isImageUrlAllowed is the looser image policy', () => {
    expect(isImageUrlAllowed('data:image/png;base64,AAAA')).toBe(true)
    expect(isImageUrlAllowed('javascript:alert(1)')).toBe(false)
  })
})
