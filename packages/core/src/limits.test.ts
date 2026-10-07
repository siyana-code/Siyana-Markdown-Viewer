import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIMITS,
  LIMIT_TABLE,
  LimitExceededError,
  type LimitName,
  raiseLimit,
  resolveLimits,
} from './limits.js'

describe('resolveLimits', () => {
  it('returns the frozen defaults when given nothing', () => {
    expect(resolveLimits()).toBe(DEFAULT_LIMITS)
  })

  it('returns a copy, so a caller cannot mutate the defaults', () => {
    const resolved = resolveLimits({})
    expect(resolved).not.toBe(DEFAULT_LIMITS)
    expect(resolved.containerDepth).toBe(DEFAULT_LIMITS.containerDepth)
  })

  it('merges a partial override over the defaults', () => {
    const resolved = resolveLimits({ containerDepth: 10 })
    expect(resolved.containerDepth).toBe(10)
    expect(resolved.listDepth).toBe(DEFAULT_LIMITS.listDepth)
  })

  it('floors a fractional value, because depth is an integer count', () => {
    expect(resolveLimits({ containerDepth: 10.9 }).containerDepth).toBe(10)
  })

  // These are the cases where a clamp would hide a bug until some document
  // happened to hit the limit.
  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['zero', 0],
    ['negative', -1],
  ])('rejects %s rather than substituting a default', (_label, value) => {
    expect(() => resolveLimits({ containerDepth: value })).toThrow(RangeError)
  })

  it('names the offending limit in the message', () => {
    expect(() => resolveLimits({ listDepth: -3 })).toThrow(/listDepth/)
  })

  it('ignores an explicit undefined, which a spread of optionals produces', () => {
    const optional: { containerDepth?: number } = { containerDepth: undefined }
    expect(resolveLimits(optional).containerDepth).toBe(DEFAULT_LIMITS.containerDepth)
  })
})

describe('raiseLimit', () => {
  it('throws a typed error carrying the observation and the allowance', () => {
    expect(() => raiseLimit('delimiterStack', 50_000, DEFAULT_LIMITS)).toThrow(LimitExceededError)

    try {
      raiseLimit('delimiterStack', 50_000, DEFAULT_LIMITS)
    } catch (error) {
      const typed = error as LimitExceededError
      expect(typed.limit).toBe('delimiterStack')
      expect(typed.observed).toBe(50_000)
      expect(typed.allowed).toBe(DEFAULT_LIMITS.delimiterStack)
    }
  })

  it('converts to a discriminated RenderError a caller can switch on', () => {
    expect(new LimitExceededError('inputBytes', 10, 5).toRenderError()).toEqual({
      kind: 'limit-exceeded',
      limit: 'inputBytes',
      observed: 10,
      allowed: 5,
    })
  })
})

describe('the documented limit table', () => {
  // The table exists so the docs cannot drift from the code. If it were written
  // by hand instead of derived, this is the only thing that catches the drift.
  it('has a row for every limit', () => {
    const names = Object.keys(DEFAULT_LIMITS) as LimitName[]
    for (const name of names) {
      expect(
        LIMIT_TABLE.find((row) => row.name === name),
        `no table row for ${name}`,
      ).toBeDefined()
    }
  })

  it('reports the value the parser actually uses', () => {
    const names = Object.keys(DEFAULT_LIMITS) as LimitName[]
    for (const name of names) {
      const row = LIMIT_TABLE.find((entry) => entry.name === name)
      expect(row?.value, `table value for ${name}`).toBe(DEFAULT_LIMITS[name])
    }
  })

  it('carries a rationale for every row, since that is the point of the table', () => {
    for (const row of LIMIT_TABLE) {
      expect(row.rationale.length, `rationale for ${row.name}`).toBeGreaterThan(20)
    }
  })
})
