/**
 * Classify the remaining CommonMark failures by *cause*, not by section.
 *
 * Run: `node --experimental-strip-types src/classify.ts`
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkUrl, createRenderer, extractScheme } from '@siyana/core'
import MarkdownIt from 'markdown-it'
import { normalizeHtml } from './normalize.ts'

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'spec-0.31.2.json')
interface Spec {
  markdown: string
  html: string
  example: number
  section: string
}
const examples: Spec[] = JSON.parse(readFileSync(FIXTURE, 'utf8'))

const shipped = createRenderer({ profile: 'commonmark' })
const ceiling = new MarkdownIt('commonmark')

type Cause =
  | 'raw-html-escaped' // attributable to `html: false`
  | 'scheme-not-allowed' // attributable to the URL allowlist
  | 'serialisation-only' // passes normalised, fails strict
  | 'other' // unattributed — must be empty

/**
 * Attribute a failure by *subtracting* configurations, not by pattern-matching
 * the expected HTML.
 *
 * The first draft of this file guessed from the shape of the expected output and
 * put 14 relative URLs into the `scheme-not-allowed` bucket, where the URL policy
 * had in fact allowed every one of them. Guessing is how a defect report becomes
 * a wrong defect report. Instead each candidate cause is proved by rendering the
 * example with exactly that one decision relaxed, and the cause is only claimed
 * if relaxing it makes the example pass.
 */
function classify(spec: Spec): { cause: Cause; detail: string } {
  const actual = shipped.render(spec.markdown)

  if (normalizeHtml(actual) === normalizeHtml(spec.html)) {
    return { cause: 'serialisation-only', detail: 'passes normalised' }
  }

  // Cause A: the URL allowlist. Relax only the allowlist, keep html:false.
  const urlRelaxed = new MarkdownIt('commonmark')
  urlRelaxed.set({ html: false, xhtmlOut: true })
  urlRelaxed.validateLink = () => true
  if (normalizeHtml(urlRelaxed.render(spec.markdown)) === normalizeHtml(spec.html)) {
    const urls = [...spec.html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1] as string)
    return {
      cause: 'scheme-not-allowed',
      detail: urls
        .map(
          (u) =>
            `${u} (scheme ${extractScheme(u) ?? 'none'}, policy ${JSON.stringify(checkUrl(u, 'link'))})`,
        )
        .join('; '),
    }
  }

  // Cause B: `html: false`. The ceiling preset has html:true and the same
  // xhtmlOut:true, so the only remaining difference is raw-HTML permission.
  if (normalizeHtml(ceiling.render(spec.markdown)) === normalizeHtml(spec.html)) {
    return { cause: 'raw-html-escaped', detail: 'passes with html: true' }
  }

  return { cause: 'other', detail: '' }
}

const buckets = new Map<Cause, Spec[]>()
for (const spec of examples) {
  if (shipped.render(spec.markdown) === spec.html) continue
  const { cause } = classify(spec)
  const list = buckets.get(cause) ?? []
  list.push(spec)
  buckets.set(cause, list)
}

console.log(
  `shipped: ${examples.length - [...buckets.values()].reduce((n, l) => n + l.length, 0)} / ${examples.length}\n`,
)

for (const [cause, list] of [...buckets].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${cause}: ${list.length}`)
  if (cause === 'scheme-not-allowed') {
    for (const s of list) {
      const { detail } = classify(s)
      console.log(`   ${s.example} [${s.section}] ${detail}`)
      console.log(
        `      verdict: ${JSON.stringify(checkUrl(detail.split(' -> ')[0] ?? '', 'link'))}`,
      )
    }
  } else if (cause === 'other') {
    for (const s of list.slice(0, 10)) {
      console.log(`   ${s.example} [${s.section}]`)
      console.log(`      md  ${JSON.stringify(s.markdown)}`)
      console.log(`      exp ${JSON.stringify(s.html)}`)
      console.log(`      got ${JSON.stringify(shipped.render(s.markdown))}`)
    }
  } else {
    const bySection = new Map<string, number>()
    for (const s of list) bySection.set(s.section, (bySection.get(s.section) ?? 0) + 1)
    for (const [sec, n] of [...bySection].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${String(n).padStart(3)}  ${sec}`)
    }
  }
  console.log()
}
