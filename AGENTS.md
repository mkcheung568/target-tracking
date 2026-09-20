<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Target Tracking AI Development Guide

## Project purpose and scope

Target Tracking is a local-first personal goal-tracking web app. Users create goals with dates and frequencies, record scheduled days as `completed`, `failed`, or `skipped`, and review progress through Dashboard, History, Analytics, and Goal Detail.

The MVP explicitly excludes a backend, database, login, cloud sync, multi-user collaboration, and true Web Push after the browser closes. Do not add these features unless the requested scope explicitly changes.

## Technology and directory responsibilities

- `app/`: Next.js App Router pages, layout, and global CSS.
- `components/workspace.tsx`: Primary client UI, page views, forms, and interaction flows.
- `lib/domain.ts`: Zod schemas, date and scheduling rules, check-in calculations, derived metrics, and demo data.
- `lib/store.ts`: Zustand state, persistence, localStorage adapter, and data actions.
- `lib/i18n.ts`: Translation keys and copy for Traditional Chinese, Simplified Chinese, and English.
- `tests/`: Domain and data-rule tests.

Use App Router and TypeScript strict mode. Add `"use client"` only to components that require browser APIs or Zustand hooks.

## Data invariants and state management

- Check-ins are the only source of truth for user actions. Do not persist derived metrics such as Net Score, Completion Rate, Streak, or Health.
- A goal can have only one check-in per date. Updating today's result must replace the existing record rather than add a duplicate.
- `No Record` means there is no check-in; it is not `failed`. Only an explicit `failed` result subtracts a point.
- `Skipped` contributes zero points and is excluded from the Completion Rate denominator.
- All created and imported data must pass the Zod schema. When a schema changes, update backup handling, store behavior, UI, and tests together.
- Components must not read or write localStorage directly. Route all persistent data through Zustand store actions.
- Any `backupSchema` version change must address old imports and backward compatibility.
- Preserve the existing confirmation flow for every delete, clear, or reset action to prevent accidental data loss.

## Coding patterns

- Prefer existing domain helpers such as `metrics`, `scheduled`, `dates`, and `scoreOf`; do not reimplement calculation rules in the UI.
- Use React Hook Form with `zodResolver`; do not bypass schemas to create unvalidated data.
- Update UI state through Zustand actions; do not create parallel copies of persistent state across components.
- Route all user-visible copy through `t(language, key)`. Add Traditional Chinese, Simplified Chinese, and English values for every new key.
- Use explicit types and failure handling for external data, file imports, and user input.
- Use semantic HTML, ARIA labels, keyboard focus, and operable buttons. Do not use inaccessible click-only `div` elements.
- Preserve editable same-day check-ins, same-day uniqueness, and the rule that No Record does not subtract points.

## UI, design patterns, and visual style

- Keep the visual style minimal, calm, and productivity-focused: light backgrounds, white cards, fine borders, low shadows, and clear spacing.
- Reuse the tokens and class patterns in `app/globals.css`; do not introduce a second color or spacing system for equivalent components.
- Indigo is the primary accent. Emerald represents positive or completed states, rose represents negative or failed states, and amber represents warnings or adjustments.
- Desktop uses a fixed sidebar, while narrow screens use mobile bottom navigation. Every page must remain usable on mobile and desktop.
- Use MUI for interactive components such as Button, Dialog, TextField, Select, Chip, Alert, and Switch. Prefer existing CSS for custom layout and appearance.
- Use Recharts for trends and statistics, and Framer Motion for necessary state transitions and liquid progress animation.
- Animation must help users understand data and must respect `prefers-reduced-motion`. Do not add continuous flashing or distracting effects.
- The positive/negative liquid score bar must retain a central zero axis, render positive scores to the right and negative scores to the left, and expose semantic meter attributes.

## Change workflow

1. Read `lib/domain.ts`, `lib/store.ts`, `lib/i18n.ts`, and the relevant page before changing behavior so the current data flow and copy are understood.
2. Decide whether the change belongs in the domain, store, i18n, UI, or CSS layer, and implement it at the correct level.
3. When adding a data field, update its Zod schema, demo data, persistence merge, backup import/export, form, and tests.
4. When adding visible copy, update all three languages and check every state, error, and empty state.
5. Preserve responsive layout, focus handling, ARIA support, and reduced-motion behavior.
6. Run `npm run lint`, `npm run type-check`, `npm run test`, and `npm run build` after changes.
7. Report the change summary, actual validation results, and remaining limitations without claiming unverified behavior.

## Do not

- Do not edit `node_modules`, `.next`, or generated caches directly.
- Do not duplicate derived metrics in localStorage.
- Do not use an English fallback to hide a missing translation key.
- Do not change port `3005`, the data version, or the existing product scope without an explicit request.
- Do not delete user data, reset localStorage, or remove existing behavior to make tests pass.

## Docker and runtime environment

- `Dockerfile` uses a multi-stage Node.js 22 Alpine build for the production image.
- The production container runs `npm run start` as a non-root user and listens on container port `3005`. Compose controls the host port through `APP_PORT`, which also defaults to `3005`.
- `docker-compose.yml` is the production configuration. Keep its command, environment variables, health check, and port documentation aligned with the Dockerfile.
- Docker only packages and starts the existing web app. Do not add a backend, database, login, cloud sync, or server-side goal storage through Docker changes.
- Goals, check-ins, language, notification settings, and UI preferences remain in browser localStorage. Do not create a Docker volume or server API that implies server-side persistence.
- `.dockerignore` must exclude `.env`, dependencies, build output, and local tool data. Never place secrets in the image or Compose file.
- After changing Docker, Compose, the Node image, startup port, or production runtime flow, run the npm checks, `docker compose config`, a production image build, and container HTTP and health checks.
