/**
 * Measure every configuration, attribute every failure.
 *
 * Run: `node --experimental-strip-types src/measure.ts`
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRenderer } from '@siyana/core'
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

type Config = { name: string; make: () => (s: string) => string }

const configs: Config[] = [
  {
    name: 'markdown-it preset "commonmark" (html:true, xhtmlOut:true)',
    make: () => {
      const md = new MarkdownIt('commonmark')
      return (s) => md.render(s)
    },
  },
  {
    name: 'markdown-it preset "commonmark" + html:false',
    make: () => {
      const md = new MarkdownIt('commonmark')
      md.set({ html: false })
      return (s) => md.render(s)
    },
  },
  {
    name: 'markdown-it preset "commonmark" + xhtmlOut:false',
    make: () => {
      const md = new MarkdownIt('commonmark')
      md.set({ xhtmlOut: false })
      return (s) => md.render(s)
    },
  },
  {
    name: 'markdown-it preset "commonmark" + html:false + xhtmlOut:false',
    make: () => {
      const md = new MarkdownIt('commonmark')
      md.set({ html: false, xhtmlOut: false })
      return (s) => md.render(s)
    },
  },
  {
    name: '@siyana/core profile "commonmark"  (SHIPPED)',
    make: () => {
      const r = createRenderer({ profile: 'commonmark' })
      return (s) => r.render(s)
    },
  },
  {
    name: '@siyana/core profile "siyana"      (SHIPPED)',
    make: () => {
      const r = createRenderer({ profile: 'siyana' })
      return (s) => r.render(s)
    },
  },
]

for (const config of configs) {
  const render = config.make()
  let strict = 0
  let norm = 0
  const strictFails: Spec[] = []
  const normFails: Spec[] = []

  for (const spec of examples) {
    let actual = ''
    try {
      actual = render(spec.markdown)
    } catch (error) {
      actual = `THREW: ${String(error)}`
    }
    if (actual === spec.html) strict++
    else strictFails.push(spec)
    if (normalizeHtml(actual) === normalizeHtml(spec.html)) norm++
    else normFails.push(spec)
  }

  console.log(`\n=== ${config.name}`)
  console.log(`  strict     ${strict} / ${examples.length}`)
  console.log(`  normalised ${norm} / ${examples.length}`)

  const bySection = new Map<string, number>()
  for (const f of strictFails) bySection.set(f.section, (bySection.get(f.section) ?? 0) + 1)
  if (bySection.size > 0) {
    console.log(`  strict failures by section:`)
    for (const [section, count] of [...bySection].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(count).padStart(3)}  ${section}`)
    }
  }
}
