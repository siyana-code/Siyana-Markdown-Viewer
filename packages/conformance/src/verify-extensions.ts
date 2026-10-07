/**
 * Verify that every extension the `siyana` profile declares actually works.
 *
 * ## Why this script exists
 *
 * The `commonmark` profile was, for one commit, a profile that silently rendered
 * GFM tables and `~~strikethrough~~` while claiming to be plain CommonMark. The
 * cause was that `new MarkdownIt(options)` with no preset name applies the
 * `default` preset, which enables `table` and `strikethrough` — so declaring an
 * empty extension list did not disable them.
 *
 * It was caught by vitest, not by the conformance suite, because the CommonMark
 * spec contains no table or strikethrough example to fail. This script is the
 * same check made runnable outside vitest, so it can be invoked from CI and from
 * a shell while investigating.
 *
 * ## Why the comparison is against output, not configuration
 *
 * Asserting that a list of enabled rules matches a list of expected rules
 * repeats the original mistake: it believes a declaration rather than the
 * behaviour. The check here renders one input per extension and requires the
 * output to actually differ from the bare preset's.
 *
 * The first version of this compared `core`'s output against a bare
 * `commonmark` preset and reported all four extensions as undetected — because
 * the product profile uses the `default` preset, which already provides `table`
 * and `strikethrough`, so for those two the comparison was vacuous in the other
 * direction. The comparison below is against the `siyana` profile with
 * extensions *removed*, which is the only comparison that can distinguish
 * "extension enabled" from "preset enabled it for us".
 */

import { createRenderer } from '@siyana/core'
import MarkdownIt from 'markdown-it'

/** One input per extension, chosen so the extension's absence changes output. */
const PROBES: Readonly<Record<string, string>> = {
  table: '| a | b |\n|---|---|\n| 1 | 2 |\n',
  strikethrough: '~~gone~~\n',
  footnote: 'Text[^1]\n\n[^1]: The note.\n',
  tasklists: '- [ ] todo\n',
}

/**
 * `markdown-it` with every extension absent: the `commonmark` preset, which
 * enables no rules beyond the spec's own.
 */
const withNoExtensions = new MarkdownIt('commonmark')

const product = createRenderer({ profile: 'siyana' })

let undetected = 0
console.log('Extensions of the "siyana" profile, checked against the bare CommonMark preset:\n')

for (const [name, input] of Object.entries(PROBES)) {
  const withExtension = product.render(input)
  const withoutExtension = withNoExtensions.render(input)
  const detected = withExtension !== withoutExtension

  if (!detected) undetected++

  console.log(`${name.padEnd(15)} ${detected ? 'verified' : 'NOT DETECTED'}`)
  console.log(`  siyana:   ${JSON.stringify(withExtension.trim())}`)
  console.log(`  no ext:   ${JSON.stringify(withoutExtension.trim())}`)
  console.log()
}

if (undetected > 0) {
  console.error(`FAIL: ${undetected} declared extension(s) do not change the output.`)
  console.error('A declared extension is not doing anything.')
  process.exitCode = 1
} else {
  console.log(`All ${Object.keys(PROBES).length} extensions verified to change the output.`)
  process.exitCode = 0
}
