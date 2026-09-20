@AGENTS.md

# Claude Project Execution Rules

`AGENTS.md` contains the complete engineering rules for Target Tracking. Read and follow it before every change. The most important execution order for Claude coding is:

1. Identify whether the request belongs in the domain, store, i18n, component, or CSS layer before editing.
2. Read the current schemas, store actions, translation keys, and design tokens first, and reuse existing patterns.
3. Do not recalculate core metrics inside components or read and write localStorage directly.
4. Route every user-visible string through `t(language, key)` and provide Traditional Chinese, Simplified Chinese, and English values together.
5. When adding or changing a data field, update Zod validation, demo data, persistence merge, JSON backup, forms, and tests together.
6. Preserve same-day check-in uniqueness and editability, the distinction between No Record and Failed, and the rule that derived metrics are not persisted.
7. Keep the minimal, calm, productivity-focused design: indigo accents, emerald positive states, rose negative states, amber warnings, white cards, and clear spacing.
8. Preserve the desktop sidebar, mobile bottom navigation, keyboard focus, ARIA support, and reduced-motion behavior.
9. Do not add an unauthorized backend, database, login, cloud sync, or true Web Push.
10. Run lint, type-check, tests, and the production build after changes, and report actual results and limitations.
