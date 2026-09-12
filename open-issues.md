# Open PR tidy-up — 2026-09-13

Reviewed the six open PRs against `integration`. Obvious, low-risk fixes were made
directly on each branch and pushed; anything requiring a judgment call is noted
here instead of being silently patched.

## Fixed

- **#140** (`feat/public-header-footer`) — deduped the near-identical `hasActiveSession()`
  helper that existed in both `public-header.tsx` and the homepage into
  `src/server/session.ts`.
- **#134** (`feature/person-picker-improvements`) — dropped `PersonPicker`'s unused
  `filter` prop (speculative API surface with no caller in the diff); added the
  one-line comment review flagged explaining why `KagaSortMenuItems`/`KagaFilterMenuItems`
  call `preventDefault()` in `onSelect`.
- **#133** (`feat/skill-package-import-upload`) — `file-dropzone.tsx`: mirrored
  `aria-invalid` onto the focusable `role="button"` div (it was only reaching the
  hidden `<input>`, so a screen reader never announced the invalid state on the
  dropzone itself).
- **#132** (`worktree-docs-glossary`) — the `?help=<slug>` sheet was serving the
  full unsplit `doc.mdx`, so it never showed the new `<KeyTerms>` callout the public
  `/docs/<slug>` page renders (the route's own doc comment claimed parity that had
  quietly gone stale). Split the payload into `introCode`/`restCode`/`keyTerms` and
  updated `help-sheet.tsx` to render them the same way the public page does.
- **#141** (`feat/tools-page`) — no issues found, nothing to fix.

## Lingering issues / suggestions worth a look

These weren't touched — each needs someone with intent/context to make a call,
not a mechanical fix.

### #139 — Suspense boundary review (large, 205 files)

- **Module-disabled gate now runs page work anyway.** `d4h-views`/`i3`/`skill-package-builder`
  layouts moved their "module not enabled" check from a server-side throw (blocked
  rendering before `children`) to a client-side one (`"use client"` layout calling
  `useOrganization().isModuleEnabled()`). Because Next resolves the Server Component
  page independently of the client layout wrapping it, a disabled module's page still
  runs its prefetches/D4H calls/DB queries on every visit — only the _rendering_ is
  suppressed afterward. Not a security issue (module gating was never an authz boundary),
  but it's wasted work, and D4H-backed pages are exactly where AGENTS.md flags API-call
  minimization as a concern. Worth a conscious tradeoff call or a cheap server-side
  short-circuit ahead of each page's own fetches.
- **`notes` module was left out of the migration.** Still does a server-side
  `notesModuleFlag()` check with a plain `throw new Error(...)`, so a disabled `notes`
  module now shows a generic error-boundary message instead of the friendly "Not enabled"
  screen every other module gets. Confirm this was a deliberate scope cut.
- **`requireOrganization`'s denial path changed from 403 to 404** (`forbidden()` →
  `notFound()` via `getOrganizationUserRoles`'s missing-row check). Behaviorally
  equivalent today since every role grants `organization:view`, but it's a user-facing
  status change not called out in the PR description, and neither file has a test
  covering old or new behavior. Worth a one-line confirmation it's intentional, or a
  regression test.

### #132 — Docs glossary

- **`splitIntro`'s blank-line heuristic is fragile** against a future doc whose opening
  content is a multi-line JSX block (e.g. a callout) with internal blank lines — it would
  silently truncate `introMdx`. Not a problem for today's docs; worth a short code comment
  flagging the assumption for whoever writes the next one.
- **Glossary page ignores module flags.** Other docs sections hide themselves when a
  module is flag-disabled for a deployment (`src/server/docs.ts`'s `isVisible`); the
  flat A–Z glossary at `/docs/glossary` doesn't, so a term tagged only with a
  flag-hidden module would still show up. Minor inconsistency, not urgent.

### #133 — Skill package import upload

- `makeEnvelope()` test helper is duplicated verbatim between
  `skill-package-builder-router.test.ts` and `system-admin-router.test.ts`. Low
  priority — the two suites are already independent — but a shared test fixture
  would remove the duplication if either grows further.
