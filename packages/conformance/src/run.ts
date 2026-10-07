/**
 * The conformance runner.
 *
 * Reads the vendored `spec.json`, renders every example through `@siyana/core`,
 * and checks three things:
 *
 * 1. the fixture's SHA-256, before anything else
 * 2. the recorded baseline, byte-for-byte
 * 3. that **every** failure is attributable to a named, deliberate decision
 *
 * Point 3 is what makes this a tripwire rather than a report. A baseline that
 * only asserts "573 or more" will happily sit at 573 while the failures change
 * from 72 security trade-offs to 71 security trade-offs and one unexplained bug.
 * The attribution check is what catches that.
 *
 * Exit codes: `0` when every check passes, `1` otherwise. Never `0` on failure.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkUrl, createRenderer, extractScheme, type Profile } from '@siyana/core'
import MarkdownIt from 'markdown-it'
import {
  EXPECTED_ATTRIBUTION,
  EXPECTED_TOTAL_FAILURES,
  FIDELITY_CEILING_NORMALISED,
  FIDELITY_CEILING_STRICT,
  MINIMUM_STRICT_PASSES,
  SHIPPED_NORMALISED,
  SHIPPED_STRICT,
  TOTAL_EXAMPLES,
} from './baseline.ts'
import { normalizeHtml } from './normalize.ts'

/** SHA-256 of the vendored spec, asserted in-process before comparing anything. */
const EXPECTED_SPEC_SHA256 = 'd431b29d97b6f73e69d547109cf5081578fac931e72afe95639ebe766c1b2a20'

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'spec-0.31.2.json')

interface SpecExample {
  readonly markdown: string
  readonly html: string
  readonly example: number
  readonly section: string
}

export type Cause = keyof typeof EXPECTED_ATTRIBUTION

interface Failure {
  readonly example: number
  readonly section: string
  readonly cause: Cause | 'unattributed'
  readonly expected: string
  readonly actual: string
  readonly markdown: string
  readonly detail: string
}

function loadExamples(): readonly SpecExample[] {
  const parsed: unknown = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected an array in ${FIXTURE}, got ${typeof parsed}`)
  }
  return parsed.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Example ${index} is not an object`)
    }
    const record = entry as Record<string, unknown>
    for (const key of ['markdown', 'html', 'example', 'section'] as const) {
      if (record[key] === undefined) throw new Error(`Example ${index} is missing "${key}"`)
    }
    return record as unknown as SpecExample
  })
}

/**
 * Attribute a failure by *subtracting* configurations.
 *
 * Each candidate cause is proved by rendering the example with exactly that one
 * decision relaxed and checking the example then passes. Nothing is inferred from
 * the shape of the expected HTML.
 *
 * The first version of this inferred causes by pattern-matching the expected
 * output and consequently filed 14 relative URLs under "scheme not allowed" —
 * where the allowlist had in fact permitted every one. A defect report that
 * guesses is worse than no defect report, so guessing is not an option here.
 */
function attribute(
  spec: SpecExample,
  actual: string,
): { cause: Cause | 'unattributed'; detail: string } {
  if (normalizeHtml(actual) === normalizeHtml(spec.html)) {
    return { cause: 'serialisationOnly', detail: 'passes normalised' }
  }

  // The URL allowlist: relax only the scheme policy, keep `html: false`.
  const urlRelaxed = new MarkdownIt('commonmark')
  urlRelaxed.set({ html: false, xhtmlOut: true })
  urlRelaxed.validateLink = () => true
  if (normalizeHtml(urlRelaxed.render(spec.markdown)) === normalizeHtml(spec.html)) {
    const urls = [...spec.html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1] as string)
    return {
      cause: 'schemeNotAllowed',
      detail: urls
        .map(
          (u) =>
            `${u} (scheme ${extractScheme(u) ?? 'none'}; policy ${JSON.stringify(checkUrl(u, 'link'))})`,
        )
        .join('; '),
    }
  }

  // The `html: false` decision. The ceiling preset differs from the shipped
  // configuration in raw-HTML permission only.
  const ceiling = new MarkdownIt('commonmark')
  if (normalizeHtml(ceiling.render(spec.markdown)) === normalizeHtml(spec.html)) {
    return { cause: 'rawHtmlEscaped', detail: 'passes with html: true' }
  }

  return { cause: 'unattributed', detail: 'passes under no relaxed configuration' }
}

interface RunResult {
  strictPasses: number
  normalisedPasses: number
  failures: Failure[]
  total: () => number
}

function run(profile: Profile, examples: readonly SpecExample[]): RunResult {
  const renderer = createRenderer({ profile })
  const failures: Failure[] = []
  let normalisedPasses = 0

  for (const spec of examples) {
    const actual = renderer.render(spec.markdown)

    if (normalizeHtml(actual) === normalizeHtml(spec.html)) normalisedPasses++

    if (actual !== spec.html) {
      const { cause, detail } = attribute(spec, actual)
      failures.push({
        example: spec.example,
        section: spec.section,
        cause,
        detail,
        expected: spec.html,
        actual,
        markdown: spec.markdown,
      })
    }
  }

  return {
    strictPasses: examples.length - failures.length,
    normalisedPasses,
    failures,
    total: () => examples.length,
  }
}

function describe(failure: Failure): string {
  const show = (value: string): string =>
    value.length > 140
      ? `${JSON.stringify(value.slice(0, 140))}… (${value.length} B)`
      : JSON.stringify(value)
  return [
    `  example ${failure.example}  [${failure.section}]  cause=${failure.cause}`,
    `    ${failure.detail}`,
    `    markdown: ${JSON.stringify(failure.markdown.slice(0, 70))}`,
    `    expected: ${show(failure.expected)}`,
    `    actual:   ${show(failure.actual)}`,
  ].join('\n')
}

const PROFILES: readonly Profile[] = ['commonmark', 'siyana']

function main(): number {
  const problems: string[] = []

  const raw = readFileSync(FIXTURE, 'utf8')
  const digest = createHash('sha256').update(raw, 'utf8').digest('hex')
  if (digest !== EXPECTED_SPEC_SHA256) {
    console.error(
      `FATAL: vendored spec hash mismatch.\n  expected ${EXPECTED_SPEC_SHA256}\n  actual   ${digest}`,
    )
    return 1
  }

  const examples = loadExamples()
  console.log(`CommonMark spec 0.31.2 — ${examples.length} examples`)
  console.log(`  sha256 ${digest} (verified)`)
  if (examples.length !== TOTAL_EXAMPLES) {
    console.error(`FATAL: expected ${TOTAL_EXAMPLES} examples, found ${examples.length}`)
    return 1
  }
  console.log('')

  console.log('Fidelity ceiling (html: true — reported, never asserted):')
  console.log(
    `  ${FIDELITY_CEILING_STRICT} / ${TOTAL_EXAMPLES} strict, ${FIDELITY_CEILING_NORMALISED} / ${TOTAL_EXAMPLES} normalised`,
  )
  console.log('  These are markdown-it preset "commonmark" with raw HTML permitted.')
  console.log(
    '  ADR-0005 Layer 1 forbids that configuration, so this is a reference point, not a target.',
  )
  console.log('')

  console.log('Shipped configuration:')
  for (const profile of PROFILES) {
    const result = run(profile, examples)

    const strictPct = ((result.strictPasses / result.total()) * 100).toFixed(2)
    const normPct = ((result.normalisedPasses / examples.length) * 100).toFixed(2)

    console.log(`  profile "${profile}"`)
    console.log(`    strict      ${result.strictPasses} / ${TOTAL_EXAMPLES} = ${strictPct} %`)
    console.log(`    normalised  ${result.normalisedPasses} / ${TOTAL_EXAMPLES} = ${normPct} %`)

    if (result.strictPasses !== SHIPPED_STRICT) {
      problems.push(
        `profile "${profile}": strict ${result.strictPasses}, baseline expects ${SHIPPED_STRICT}`,
      )
    }
    if (result.normalisedPasses !== SHIPPED_NORMALISED) {
      problems.push(
        `profile "${profile}": normalised ${result.normalisedPasses}, baseline expects ${SHIPPED_NORMALISED}`,
      )
    }
    if (result.strictPasses < MINIMUM_STRICT_PASSES) {
      problems.push(
        `profile "${profile}": ${result.strictPasses} is below the floor of ${MINIMUM_STRICT_PASSES}`,
      )
    }

    // The attribution check.
    const counts = new Map<Cause | 'unattributed', number>()
    for (const failure of result.failures) {
      counts.set(failure.cause, (counts.get(failure.cause) ?? 0) + 1)
    }

    const unattributed = counts.get('unattributed') ?? 0
    console.log(`    failures    ${result.failures.length}, attributed:`)
    for (const [cause, count] of [...counts].sort((a, b) => b[1] - a[1])) {
      const expected = cause === 'unattributed' ? 0 : EXPECTED_ATTRIBUTION[cause]
      const flag = count === expected ? '' : `  MISMATCH, expected ${expected}`
      console.log(`      ${String(count).padStart(3)}  ${cause}${flag}`)
      if (cause === 'unattributed' && count > 0) {
        for (const failure of result.failures.filter((f) => f.cause === 'unattributed')) {
          console.error(describe(failure))
        }
      }
      if (cause !== 'unattributed' && count !== expected) {
        problems.push(
          `profile "${profile}": ${cause} count ${count}, baseline expects ${expected}. ` +
            `If the parser changed, re-derive the attribution with \`pnpm --filter @siyana/conformance measure\` before updating the baseline.`,
        )
      }
    }

    if (result.failures.length !== EXPECTED_TOTAL_FAILURES) {
      problems.push(
        `profile "${profile}": ${result.failures.length} failures, expected ${EXPECTED_TOTAL_FAILURES}`,
      )
    }

    if (unattributed > 0) {
      problems.push(
        `profile "${profile}": ${unattributed} failure(s) could not be attributed to a deliberate decision. ` +
          `These are bugs, not known deviations.`,
      )
    }
  }

  console.log('')
  if (problems.length === 0) {
    console.log('CONFORMANCE: success')
    return 0
  }

  console.error('CONFORMANCE: failed')
  for (const problem of problems) console.error(`  - ${problem}`)
  return 1
}

process.exitCode = main()
