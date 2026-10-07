/**
 * Type declarations for the two extension plugins we depend on.
 *
 * Neither ships types. Rather than pull in a `@types/*` package from
 * DefinitelyTyped — an unpinned third-party dependency whose only job is to
 * describe an API we call once — the surface we use is declared here. Two
 * functions, both taking a `markdown-it` instance, is the entire contract, and
 * declaring it here means a breaking change in the plugin surfaces as a
 * typecheck error at this repository's boundary rather than as a runtime
 * failure.
 *
 * ## Why this file has no top-level `import`
 *
 * A `.d.ts` file containing a top-level `import` is a *module*, and a
 * `declare module '…'` inside a module is a module augmentation rather than an
 * ambient declaration. Augmenting a module that has no types is an error, which
 * is why the import type is written inline below instead. This is the kind of
 * detail that costs twenty minutes once.
 */

declare module 'markdown-it-footnote' {
  /** The footnote extension. Common dialect — not CommonMark, not GFM proper. */
  const plugin: (md: import('markdown-it').MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-task-lists' {
  /**
   * The task-list extension. Common dialect.
   *
   * Options are accepted and ignored by us: the plugin's defaults are used so
   * that task lists render identically wherever they appear in the application.
   * If a future feature needs `label: true` or `labelAfter`, that is a
   * deliberate change with a conformance number attached.
   */
  const plugin: (md: import('markdown-it').MarkdownIt) => void
  export default plugin
}
