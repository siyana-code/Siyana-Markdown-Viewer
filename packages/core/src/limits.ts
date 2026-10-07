/**
 * Parser limits, and the typed errors raised when one is breached.
 *
 * ## Why these exist
 *
 * This application renders files it did not author. Every bound here converts an
 * unbounded input into a handled state: a typed error the caller turns into the
 * raw-text fallback, never a hang and never a crash.
 *
 * ## Why these values
 *
 * These are engineering choices, not spec requirements. CommonMark dictates
 * exactly one of them: §6.3 requires "at least three levels" of parentheses in a
 * link destination, and we allow 32.
 *
 * The rest come from measurement. `research/02-syntax/04-edge-cases-and-traps.md`
 * §11 binary-searched the depth at which each candidate parser fails on Node
 * 24.14.1:
 *
 *   - markdown-it is iterative for block structure (Appendix A walks the
 *     open-block tree) and uses a linked list for inline delimiters, so it
 *     survives 40 000-deep block quotes and never recurses.
 *   - marked, built on recursive descent, throws `RangeError: Maximum call stack
 *     size exceeded` at 2 500 nested block quotes and goes out of memory at
 *     5 000 nested list levels.
 *
 * So a 500 container bound is generous for the architecture we chose and still
 * well under the failure point of a recursive one. `DELIMITER_STACK` is the
 * limit that matters most: it directly bounds `lookForLinkOrImage`'s backward
 * walk, which `openers_bottom` does *not* cover, and which is why
 * `commonmark.js` needs 51 s on 100 KB of `"[a](b"` repeated.
 *
 * Cross-reference: `research/04-parsing-internals/05-performance-and-limits.md`,
 * and `docs/architecture/rendering-pipeline.md` stage 2.
 */

/** A bound on untrusted input, with the reason it exists. */
export interface Limit {
  /** Stable identifier, used in error messages and telemetry-free diagnostics. */
  readonly name: LimitName
  /** The value, in whatever unit the limit is expressed in. */
  readonly value: number
  /** What happens when the bound is exceeded. */
  readonly onBreach: BreachBehaviour
  /** Why the value is what it is. */
  readonly rationale: string
}

export type LimitName =
  | 'containerDepth'
  | 'listDepth'
  | 'inlineDepth'
  | 'linkLabelLength'
  | 'linkLabelNesting'
  | 'delimiterStack'
  | 'fenceLength'
  | 'tableColumns'
  | 'tableRows'
  | 'referenceDefinitions'
  | 'referenceExpansionBytes'
  | 'rawHtmlBlockBytes'
  | 'inputBytes'

export type BreachBehaviour = 'error' | 'truncate'

/**
 * The defaults. Frozen: callers pass an override object, never mutate these.
 *
 * `referenceExpansionBytes` is a security control rather than a tuning knob.
 * Reference definitions expand: a document of N short definitions can produce
 * N·M bytes of output from an M-byte input. `cmark` caps this in
 * `finalize_document()` at `max(100 KB, document size)` for exactly this
 * reason, and `cmark-gfm` has shipped a DoS advisory for each GFM extension
 * individually.
 */
export const DEFAULT_LIMITS = Object.freeze({
  /** 32 MB. Above this we refuse and offer raw-text mode rather than truncate. */
  inputBytes: 32 * 1024 * 1024,

  /** Measured: markdown-it handles 40 000 deep without recursion. */
  containerDepth: 500,

  /** Lower than containerDepth: a 500-deep list is already pathological. */
  listDepth: 100,

  inlineDepth: 50,

  /** CommonMark §6.3 says "at most 999 characters". See the note below. */
  linkLabelLength: 999,

  /** CommonMark §6.3 requires "at least three"; we allow 32. */
  linkLabelNesting: 32,

  /**
   * The load-bearing one. Bounds the `lookForLinkOrImage` backward walk, which
   * `openers_bottom` does not cover. Measured: `commonmark.js` takes 51 s on
   * 100 KB of `"[a](b"` repeated; at 10 000 entries this becomes a bound we
   * enforce rather than a cost we hope to avoid.
   */
  delimiterStack: 10_000,

  /**
   * Deliberately divergent from `cmark`, which clamps at 255 because its length
   * is a `uint8_t`. A 255-backtick fence in a document is not an attack, so the
   * artefact is not inherited.
   */
  fenceLength: 3_000,

  tableColumns: 1_000,
  tableRows: 100_000,
  referenceDefinitions: 100_000,

  /** `max(100 KB, document size)`, matching `cmark`. */
  referenceExpansionBytes: 100 * 1024,

  rawHtmlBlockBytes: 1024 * 1024,
} satisfies Record<LimitName, number>)

/** Callers may raise or lower any bound, but must supply all of them. */
export type LimitOverrides = Partial<Record<LimitName, number>>

/** The effective limits after overrides are applied. */
export type ResolvedLimits = { readonly [K in LimitName]: number }

/**
 * Merge overrides into the defaults.
 *
 * A non-positive or non-finite override is rejected rather than clamped: a
 * caller that passes `NaN` has a bug, and silently substituting a default would
 * hide it until a document happened to hit the limit.
 */
export function resolveLimits(overrides?: LimitOverrides): ResolvedLimits {
  if (!overrides) return DEFAULT_LIMITS

  const resolved = { ...DEFAULT_LIMITS } as Record<LimitName, number>

  for (const [name, value] of Object.entries(overrides) as [LimitName, number][]) {
    if (value === undefined) continue
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(
        `Invalid limit override for "${name}": expected a positive finite number, got ${String(value)}`,
      )
    }
    resolved[name] = Math.floor(value)
  }

  return resolved as ResolvedLimits
}

/**
 * The documented limit table, for the security baseline and for docs.
 *
 * Kept next to the values so the two cannot drift: this table is generated from
 * the same source of truth the parser reads.
 */
export const LIMIT_TABLE: readonly Limit[] = Object.freeze([
  {
    name: 'inputBytes',
    value: DEFAULT_LIMITS.inputBytes,
    onBreach: 'error',
    rationale: '32 MB. Refuse with a prompt to open anyway in raw mode, never truncate silently.',
  },
  {
    name: 'containerDepth',
    value: DEFAULT_LIMITS.containerDepth,
    onBreach: 'error',
    rationale:
      'Measured: markdown-it survives 40 000 nested block quotes because the block phase is iterative. Recursive descent fails near 2 500.',
  },
  {
    name: 'listDepth',
    value: DEFAULT_LIMITS.listDepth,
    onBreach: 'error',
    rationale: 'Measured: marked goes out of memory at 5 000 nested list levels.',
  },
  {
    name: 'inlineDepth',
    value: DEFAULT_LIMITS.inlineDepth,
    onBreach: 'error',
    rationale: 'Beyond this, nesting is a mistake rather than a document.',
  },
  {
    name: 'linkLabelLength',
    value: DEFAULT_LIMITS.linkLabelLength,
    onBreach: 'truncate',
    rationale:
      'CommonMark §6.3 says "at most 999 characters". Note that cmark uses 1000 and commonmark.js rejects above 1001: all three implementations differ from the spec by one. We take the spec value.',
  },
  {
    name: 'linkLabelNesting',
    value: DEFAULT_LIMITS.linkLabelNesting,
    onBreach: 'truncate',
    rationale: 'CommonMark §6.3 requires "at least three levels" of parentheses. We allow 32.',
  },
  {
    name: 'delimiterStack',
    value: DEFAULT_LIMITS.delimiterStack,
    onBreach: 'error',
    rationale:
      'The limit that actually fixes the unclosed-links DoS. Bounds the backward walk in lookForLinkOrImage, which openers_bottom does not cover.',
  },
  {
    name: 'fenceLength',
    value: DEFAULT_LIMITS.fenceLength,
    onBreach: 'truncate',
    rationale:
      'Deliberately divergent from cmark, which clamps at 255 because its length is a uint8_t. That is an artefact, not a threat.',
  },
  {
    name: 'tableColumns',
    value: DEFAULT_LIMITS.tableColumns,
    onBreach: 'truncate',
    rationale: 'A GFM table row cannot exceed this without being a denial-of-service attempt.',
  },
  {
    name: 'tableRows',
    value: DEFAULT_LIMITS.tableRows,
    onBreach: 'truncate',
    rationale: 'Bounds rendering work for a table-heavy document.',
  },
  {
    name: 'referenceDefinitions',
    value: DEFAULT_LIMITS.referenceDefinitions,
    onBreach: 'truncate',
    rationale:
      'The definition map is the main unbounded structure in the block phase. Each definition is at least 8 bytes, so this is about 1 MiB of references.',
  },
  {
    name: 'referenceExpansionBytes',
    value: DEFAULT_LIMITS.referenceExpansionBytes,
    onBreach: 'truncate',
    rationale:
      'SECURITY CONTROL. N definitions expand to N·M bytes. cmark caps this in finalize_document(); without it a few hundred KB of definitions produces tens of MB of HTML.',
  },
  {
    name: 'rawHtmlBlockBytes',
    value: DEFAULT_LIMITS.rawHtmlBlockBytes,
    onBreach: 'truncate',
    rationale:
      'Bounds the HTML block path, which is where raw markup accumulates before sanitization.',
  },
])

/**
 * The typed error surface.
 *
 * Expected failures are return values, not thrown exceptions. Throwing is
 * reserved for programming errors. `RenderError` is discriminated so a caller
 * can `switch` on it and have the compiler require every case.
 */
export type RenderError =
  | {
      readonly kind: 'limit-exceeded'
      readonly limit: LimitName
      readonly observed: number
      readonly allowed: number
    }
  | { readonly kind: 'decode-failure'; readonly detail: string }
  | { readonly kind: 'parse-failure'; readonly detail: string }

export class LimitExceededError extends Error {
  readonly limit: LimitName
  readonly observed: number
  readonly allowed: number

  constructor(limit: LimitName, observed: number, allowed: number) {
    super(`Limit "${limit}" exceeded: observed ${observed}, allowed ${allowed}`)
    this.name = 'LimitExceededError'
    this.limit = limit
    this.observed = observed
    this.allowed = allowed
  }

  /** Convert to the discriminated union a caller switches on. */
  toRenderError(): RenderError {
    return {
      kind: 'limit-exceeded',
      limit: this.limit,
      observed: this.observed,
      allowed: this.allowed,
    }
  }
}

/** Human-readable one-liner for a render error, safe to show in the UI. */
export function describeRenderError(error: RenderError): string {
  switch (error.kind) {
    case 'limit-exceeded':
      return `This document exceeds the ${error.limit} limit (${error.observed} > ${error.allowed}). Showing the raw text instead.`
    case 'decode-failure':
      return `This file could not be decoded cleanly: ${error.detail}`
    case 'parse-failure':
      return error.detail
  }
}

/** Raise a limit breach. The single call site, so the type is enforced once. */
export function raiseLimit(limit: LimitName, observed: number, limits: ResolvedLimits): never {
  throw new LimitExceededError(limit, observed, limits[limit])
}
