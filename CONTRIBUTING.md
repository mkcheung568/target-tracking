# Contributing to Target Tracking

Thank you for helping improve Target Tracking. The project is a local-first MVP, so changes should keep the experience focused, calm, accessible, and safe for local data.

## Before you start

```bash
npm ci
npm run dev
```

Review `AGENTS.md` and `CLAUDE.md` before changing code. Do not add backend, database, login, cloud sync, or closed-browser Web Push unless the project scope is explicitly changed first.

## Development rules

- Keep check-ins as the source of truth.
- Preserve the distinction between `completed`, `failed`, `skipped`, and `No Record`.
- Use the existing Zustand actions, Zod schemas, translation keys, and design tokens.
- Add all visible copy to Traditional Chinese, Simplified Chinese, and English.
- Keep desktop and mobile layouts usable, including keyboard focus and reduced-motion behavior.
- Never commit `.env` files, browser data, build output, or credentials.

## Validation

Run every check before opening a pull request:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

If a check cannot run, explain why in the pull request. Include screenshots for meaningful visual changes and describe the viewport used.

## Pull requests

- Use a focused branch and a clear commit message.
- Explain the user problem and the resulting behavior.
- Mention data-model, translation, responsive, or accessibility impact.
- Link the related issue when one exists.
- Keep unrelated formatting or dependency changes out of the pull request.

## Issues

Use the bug report template for reproducible problems and the feature request template for new ideas. Do not include passwords, API keys, private browser exports, or other sensitive data in an issue.
