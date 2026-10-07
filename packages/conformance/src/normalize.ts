/**
 * A faithful TypeScript port of the CommonMark spec's `normalize.py`.
 *
 * ## Why port it rather than call it
 *
 * The spec's own normaliser is the arbiter of what "conforming" means. Common
 * reference implementations that report a *higher* number than the spec's runner
 * are, almost by definition, measuring something else. Porting it means the
 * conformance job here produces the same number `spec_tests.py` would, on any
 * platform, with no Python in the toolchain.
 *
 * The port is a port and not a rewrite. The parser state machine below keeps the
 * original's `last` / `last_tag` / `in_pre` triple and its block-tag list
 * verbatim, including the original's quirks:
 *
 *  - `<br>` is in neither the block list nor the pre list, so a `<br>` in the
 *    output is not rstripped and its following text has leading newlines
 *    stripped by a separate rule.
 *  - `script` and `style` *are* in the block list but `in_pre` is never set for
 *    them, so their text content is whitespace-collapsed.
 *  - `handle_startendtag` emits `<br>` and records `last = "endtag"`, so
 *    `<br />` becomes `<br>` with no closing tag. That is the documented
 *    self-closing normalisation.
 *  - Entity handling sets `last = "ref"`, which is neither `starttag` nor
 *    `endtag`, so text is neither lstripped nor stripped after an entity.
 *
 * Those are not bugs to fix. Changing any of them changes the score, and the
 * whole value of this file is that it does not.
 *
 * Reference: <https://github.com/commonmark/commonmark-spec/blob/0.31.2/test/normalize.py>
 */

/** The spec's block-level tag list, verbatim from `is_block_tag`. */
const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'article',
  'header',
  'aside',
  'hgroup',
  'blockquote',
  'hr',
  'iframe',
  'body',
  'li',
  'map',
  'button',
  'object',
  'canvas',
  'ol',
  'caption',
  'output',
  'col',
  'p',
  'colgroup',
  'pre',
  'dd',
  'progress',
  'div',
  'section',
  'dl',
  'table',
  'td',
  'dt',
  'tbody',
  'embed',
  'textarea',
  'fieldset',
  'tfoot',
  'figcaption',
  'th',
  'figure',
  'thead',
  'footer',
  'tr',
  'form',
  'ul',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'video',
  'script',
  'style',
])

/**
 * Python's `HTMLParser` in non-`convert_charrefs` mode, reduced to what
 * `normalize.py` uses: start tags, end tags, start-end tags, comments,
 * declarations, processing instructions, data, and character/entity references.
 */
type Last = 'starttag' | 'endtag' | 'data' | 'comment' | 'decl' | 'pi' | 'ref'

/**
 * HTML5 named character references.
 *
 * Python's `html.entities.name2codepoint` covers only the Latin-1 range
 * (`HTML 2.0` plus a handful of extras), whereas the spec's HTML output uses
 * HTML5 names such as `nbsp`, `copy`, and `hellip`. Since Python raises
 * `KeyError` on an unknown name and then falls back to emitting the reference
 * unchanged, an unknown name is not a crash here either — it is passed through.
 * The subset below is what the spec's own expected output actually contains, and
 * anything else falls through verbatim, matching the original's behaviour on a
 * name it did not know.
 */
const NAMED_REFERENCES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  iexcl: '\u00a1',
  cent: '\u00a2',
  pound: '\u00a3',
  curren: '\u00a4',
  yen: '\u00a5',
  brvbar: '\u00a6',
  sect: '\u00a7',
  uml: '\u00a8',
  copy: '\u00a9',
  ordf: '\u00aa',
  laquo: '\u00ab',
  not: '\u00ac',
  shy: '\u00ad',
  reg: '\u00ae',
  macr: '\u00af',
  deg: '\u00b0',
  plusmn: '\u00b1',
  sup2: '\u00b2',
  sup3: '\u00b3',
  acute: '\u00b4',
  micro: '\u00b5',
  para: '\u00b6',
  middot: '\u00b7',
  cedil: '\u00b8',
  sup1: '\u00b9',
  ordm: '\u00ba',
  raquo: '\u00bb',
  frac14: '\u00bc',
  frac12: '\u00bd',
  frac34: '\u00be',
  iquest: '\u00bf',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  laquo2: '\u00ab',
  times: '\u00d7',
  divide: '\u00f7',
  forall: '\u2200',
  euro: '\u20ac',
}

/**
 * `urllib.parse.quote` with `safe='/'`.
 *
 * The spec's normaliser percent-encodes `href` and `src` values after decoding
 * them, so `href="a b"` and `href="a%20b"` normalise to the same string. JS's
 * `encodeURIComponent` is close but not equivalent: it does not escape
 * `!'()*`, and it leaves `-_.~` alone. The character set below is Python's
 * `_ALWAYS_SAFE` set plus `/`.
 */
const PYTHON_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-~/'

function pyQuote(value: string): string {
  let out = ''
  for (const char of value) {
    if (PYTHON_SAFE.includes(char)) {
      out += char
      continue
    }
    // Python's `quote` encodes UTF-8 bytes, and a surrogate pair is two code
    // units that must become four bytes.
    for (const byte of new TextEncoder().encode(char)) {
      out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
    }
  }
  return out
}

/** `urllib.parse.unquote`, which is lenient about invalid escapes. */
function pyUnquote(value: string): string {
  const bytes = new TextEncoder().encode(value)
  const out: number[] = []
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] as number
    if (byte === 0x25 && i + 2 < bytes.length) {
      const hex = value.slice(i + 1, i + 3)
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        out.push(Number.parseInt(hex, 16))
        i += 2
        continue
      }
    }
    out.push(byte)
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(out))
}

/** Python's `html.escape(v, quote=True)`: `&`, `<`, `>`, and `"`. */
function pyHtmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Python's `re.sub('\s+', ' ', …)` for text nodes.
 *
 * `\s` in Python's `str` mode matches `[ \t\n\r\f\v]` plus the Unicode
 * whitespace characters. A JS `\s` also matches U+FEFF, which Python's does
 * not, so U+FEFF is excluded here to keep the two equivalent.
 */
const PY_WHITESPACE_RUN =
  /[\t\n\r\f\v \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g

function collapseWhitespace(value: string): string {
  return value.replace(PY_WHITESPACE_RUN, ' ')
}

/** `str.lstrip` / `str.rstrip` / `str.strip` for the ASCII set Python defaults to. */
function pyLstrip(value: string): string {
  return value.replace(/^[\s\u00a0]+/, '')
}
function pyRstrip(value: string): string {
  return value.replace(/[\s\u00a0]+$/, '')
}

class Normalizer {
  output = ''
  last: Last = 'starttag'
  lastTag = ''
  inPre = false

  private readonly dataAccumulator = (data: string): void => {
    const afterTag = this.last === 'endtag' || this.last === 'starttag'
    const afterBlockTag = afterTag && BLOCK_TAGS.has(this.lastTag)

    let text = data
    if (afterTag && this.lastTag === 'br') {
      text = text.replace(/^\n+/, '')
    }
    if (!this.inPre) {
      text = collapseWhitespace(text)
    }
    if (afterBlockTag && !this.inPre) {
      if (this.last === 'starttag') {
        text = pyLstrip(text)
      } else if (this.last === 'endtag') {
        text = pyRstrip(text)
      }
    }

    this.output += text
    this.last = 'data'
  }

  data = (value: string): void => this.dataAccumulator(value)

  endTag = (tag: string): void => {
    if (tag === 'pre') {
      this.inPre = false
    } else if (BLOCK_TAGS.has(tag)) {
      this.output = pyRstrip(this.output)
    }
    this.output += `</${tag}>`
    this.lastTag = tag
    this.last = 'endtag'
  }

  startTag = (tag: string, attrs: readonly Attr[]): void => {
    if (tag === 'pre') {
      this.inPre = true
    }
    if (BLOCK_TAGS.has(tag)) {
      this.output = pyRstrip(this.output)
    }

    this.output += `<${tag}`

    // The original does NOT filter to `significant_attrs` — the comment there
    // says so explicitly, because raw-HTML test cases depend on extra attributes
    // being preserved. Attributes are sorted and serialised in sorted order.
    if (attrs.length > 0) {
      const sorted = [...attrs].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      for (const attr of sorted) {
        this.output += ` ${attr.name}`
        if (attr.value === null) continue
        if (attr.name === 'href' || attr.name === 'src') {
          this.output += `="${pyQuote(pyUnquote(attr.value))}"`
        } else {
          this.output += `="${pyHtmlEscape(attr.value)}"`
        }
      }
    }

    this.output += '>'
    this.lastTag = tag
    this.last = 'starttag'
  }

  /** Self-closing tags emit the start tag and then record `endtag`. */
  startEndTag = (tag: string, attrs: readonly Attr[]): void => {
    this.startTag(tag, attrs)
    this.lastTag = tag
    this.last = 'endtag'
  }

  comment = (value: string): void => {
    this.output += `<!--${value}-->`
    this.last = 'comment'
  }

  decl = (value: string): void => {
    this.output += `<!${value}>`
    this.last = 'decl'
  }

  pi = (value: string): void => {
    this.output += `<?${value}>`
    this.last = 'pi'
  }

  private outputChar(char: string | null, fallback: string): void {
    if (char === '<') this.output += '&lt;'
    else if (char === '>') this.output += '&gt;'
    else if (char === '&') this.output += '&amp;'
    else if (char === '"') this.output += '&quot;'
    else if (char === null) this.output += fallback
    else this.output += char
  }

  entityRef = (name: string): void => {
    this.outputChar(NAMED_REFERENCES[name] ?? null, `&${name};`)
    this.last = 'ref'
  }

  charRef = (body: string): void => {
    let char: string | null = null
    try {
      const code =
        body.startsWith('x') || body.startsWith('X')
          ? Number.parseInt(body.slice(1), 16)
          : Number.parseInt(body, 10)
      char =
        Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null
    } catch {
      char = null
    }
    this.outputChar(char, `&#${body};`)
    this.last = 'ref'
  }

  /** CDATA is passed through verbatim, as in the original's chunk loop. */
  cdata = (value: string): void => {
    this.output += value
  }
}

interface Attr {
  readonly name: string
  /** null means a valueless attribute such as `disabled`. */
  readonly value: string | null
}

/**
 * Chunk the input the way the original does before feeding its parser, so that
 * CDATA survives and Python's own tag-scanning quirks are not re-implemented.
 */
const HTML_CHUNK_RE = /(<!\[CDATA\[.*?\]\]>|<[^>]*>|[^<]+)/g

const TAG_RE = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)(\/?)>$/
const ATTR_RE = /([^\s"'>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]*))?/g

function parseAttrs(source: string): Attr[] {
  const attrs: Attr[] = []
  ATTR_RE.lastIndex = 0
  for (let match = ATTR_RE.exec(source); match !== null; match = ATTR_RE.exec(source)) {
    const name = match[1]
    if (name === undefined) continue
    let raw = match[2]
    if (raw === undefined) {
      attrs.push({ name: name.toLowerCase(), value: null })
      continue
    }
    if (raw.length > 0 && (raw.startsWith('"') || raw.startsWith("'"))) {
      raw = raw.slice(1, -1)
    }
    attrs.push({ name: name.toLowerCase(), value: raw })
  }
  return attrs
}

const ENTITY_RE = /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);?/g

/** Feed text to the normaliser, splitting entities out as Python's parser does. */
function feedText(parser: Normalizer, text: string): void {
  let last = 0
  ENTITY_RE.lastIndex = 0
  for (let match = ENTITY_RE.exec(text); match !== null; match = ENTITY_RE.exec(text)) {
    if (match.index > last) {
      parser.data(text.slice(last, match.index))
    }
    const body = match[1] as string
    if (body.startsWith('#')) {
      parser.charRef(body.slice(body.startsWith('#x') || body.startsWith('#X') ? 2 : 1))
    } else {
      parser.entityRef(body)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) {
    parser.data(text.slice(last))
  }
}

/**
 * Normalise an HTML string the way the CommonMark spec's runner does.
 *
 * @param html - the HTML to normalise
 * @returns the normalised form, which two conformant outputs must share exactly
 */
export function normalizeHtml(html: string): string {
  const parser = new Normalizer()
  HTML_CHUNK_RE.lastIndex = 0

  for (let match = HTML_CHUNK_RE.exec(html); match !== null; match = HTML_CHUNK_RE.exec(html)) {
    const chunk = match[0]

    if (chunk.startsWith('<![CDATA[')) {
      parser.cdata(chunk)
      continue
    }

    if (!chunk.startsWith('<')) {
      feedText(parser, chunk)
      continue
    }

    if (chunk.startsWith('<!--')) {
      parser.comment(chunk.slice(4, chunk.endsWith('-->') ? -3 : undefined))
      continue
    }
    if (chunk.startsWith('<!') || chunk.startsWith('<?')) {
      // `<!DOCTYPE html>` → decl, `<?php … ?>` → pi. The original distinguishes
      // only by which two-character opener Python's parser saw, and both emit
      // their body wrapped in the same delimiters.
      const isDecl = chunk.startsWith('<!')
      const body = isDecl
        ? chunk.slice(2, chunk.endsWith('>') ? -1 : undefined)
        : chunk.slice(1, chunk.endsWith('>') ? -1 : undefined)
      if (isDecl) parser.decl(body)
      else parser.pi(body)
      continue
    }

    const tagMatch = TAG_RE.exec(chunk)
    if (tagMatch === null) {
      // Not a tag Python recognises: it is data.
      feedText(parser, chunk)
      continue
    }

    const closing = tagMatch[1] === '/'
    const tag = (tagMatch[2] as string).toLowerCase()
    const attrsSource = tagMatch[3] ?? ''
    const selfClosing = tagMatch[4] === '/'
    const attrs = parseAttrs(attrsSource)

    if (closing) parser.endTag(tag)
    else if (selfClosing) parser.startEndTag(tag, attrs)
    else parser.startTag(tag, attrs)
  }

  return parser.output
}
