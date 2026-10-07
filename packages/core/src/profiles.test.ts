/**
 * Profile tests.
 *
 * ## The test that matters most
 *
 * `it('renders a GFM table in the siyana profile but not in commonmark')` exists
 * because of a real defect. The `commonmark` profile was originally built by
 * passing no preset name to `new MarkdownIt()`, which applies `default` — and
 * `default` enables `table` and `strikethrough`. The profile rendered GFM tables
 * while claiming to be a plain CommonMark parser.
 *
 * The conformance suite could not catch it, because the CommonMark spec contains
 * no table or strikethrough example to fail. A suite only detects deviation in
 * what it tests, so the test for "this profile has no extensions" has to be
 * written as a positive assertion about output, not as an inspection of a
 * configuration list. Asserting on the config would have repeated the original
 * mistake — believing the declaration rather than the behaviour.
 */

import { describe, expect, it } from 'vitest'
import { createRenderer } from './parser.js'
import { isProfile, PROFILE_EXTENSIONS, PROFILE_PRESET, type Profile } from './profiles.js'

const siyana = createRenderer({ profile: 'siyana' })
const commonmark = createRenderer({ profile: 'commonmark' })

/** One input per extension, chosen to fail if that extension is absent. */
const EXTENSION_PROBES: Readonly<Record<string, { input: string; mustContain: string }>> = {
  table: {
    input: '| a | b |\n|---|---|\n| 1 | 2 |\n',
    mustContain: '<table>',
  },
  strikethrough: {
    input: '~~gone~~\n',
    mustContain: '<s>gone</s>',
  },
  footnote: {
    input: 'Text[^1]\n\n[^1]: The note.\n',
    mustContain: 'footnote-ref',
  },
  tasklists: {
    input: '- [ ] todo\n',
    mustContain: 'task-list-item-checkbox',
  },
}

describe('profile presets', () => {
  it('gives the commonmark profile the commonmark preset, not the default one', () => {
    // If this ever reads 'default', the profile silently gains GFM tables.
    expect(PROFILE_PRESET.commonmark).toBe('commonmark')
    expect(PROFILE_PRESET.siyana).toBe('default')
  })

  it.each(['table', 'strikethrough'] as const)(
    'renders no %s markup under the commonmark profile',
    (extension) => {
      const probe = EXTENSION_PROBES[extension]
      if (probe === undefined) throw new Error(`no probe for ${extension}`)
      expect(commonmark.render(probe.input), extension).not.toContain(probe.mustContain)
    },
  )
})

describe('the two profiles diverge', () => {
  it.each(Object.entries(EXTENSION_PROBES))(
    'siyana supports %s and commonmark does not',
    (extension, probe) => {
      expect(siyana.render(probe.input), extension).toContain(probe.mustContain)
      expect(commonmark.render(probe.input), extension).not.toContain(probe.mustContain)
    },
  )

  // The aggregate assertion, which is what would have caught the original bug
  // without needing to know which extension slipped through.
  it('differs on at least one extension probe', () => {
    const differing = Object.entries(EXTENSION_PROBES).filter(
      ([, probe]) => siyana.render(probe.input) !== commonmark.render(probe.input),
    )
    expect(differing.length).toBeGreaterThan(0)
  })
})

describe('every declared extension is real', () => {
  // PROFILE_EXTENSIONS is documentation as well as configuration, so a name in
  // it that changes nothing output is a documentation error at minimum.
  it.each(PROFILE_EXTENSIONS.siyana)('%s has a probe that detects it', (extension) => {
    const probe = EXTENSION_PROBES[extension]
    expect(probe, `no probe declared for extension "${extension}"`).toBeDefined()

    const baseline = commonmark.render(probe.input)
    expect(siyana.render(probe.input), extension).not.toBe(baseline)
  })

  it('the commonmark profile declares no extensions', () => {
    expect(PROFILE_EXTENSIONS.commonmark).toHaveLength(0)
  })
})

describe('profile identity', () => {
  it('reports its own profile', () => {
    expect(siyana.profile).toBe('siyana')
    expect(commonmark.profile).toBe('commonmark')
  })

  it('defaults to siyana, the product profile', () => {
    expect(createRenderer().profile).toBe('siyana')
  })

  it('isProfile accepts exactly the declared names', () => {
    for (const name of ['commonmark', 'siyana']) {
      expect(isProfile(name), name).toBe(true)
    }
    for (const name of ['default', 'gfm', '', 'COMMONMARK']) {
      expect(isProfile(name), name).toBe(false)
    }
  })
})

describe('profile and preset stay in step', () => {
  it.each(['commonmark', 'siyana'] as Profile[])('%s has a preset entry', (profile) => {
    expect(['commonmark', 'default']).toContain(PROFILE_PRESET[profile])
  })
})
