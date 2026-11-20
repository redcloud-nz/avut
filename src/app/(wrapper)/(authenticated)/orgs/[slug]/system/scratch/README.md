# Scratchpad

Throwaway route for visually testing something (component layout, a CSS interaction,
anything easier to see rendered than reasoned about) via a real browser against a real
signed-in session — full `useOrganization()`/trpc context, same as any other
`orgs/[slug]/...` page.

## Convention

- One subdirectory per task: `system/scratch/<task-name>/page.tsx`.
- Keep it a normal `"use client"` page — no need for `generateMetadata`, prefetching,
  or any of the patterns in `docs/patterns/`; it's not a real page.
- Scratch pages are ordinary tracked files, so Tailwind sees them like any other page and
  every utility class works. Do scratch work on a branch (an `explore/*` branch, or the
  feature branch it belongs to) and commit it there freely.
- Delete the subdirectory before the branch merges, unless it's meant to stay.
- Visit at `/orgs/<any-slug-you-have-access-to>/system/scratch/<task-name>`.

## Gated by the `scratch` flag

`layout.tsx` here 404s every scratch page unless the `scratch` Vercel flag (`src/lib/flags.ts`)
is on. Keep it on in development and preview, and off in production, so a scratch page that
reaches `integration` or `production` is never served there.

Locally the flag is read with the `VERCEL_OIDC_TOKEN` in `.env.local`. If that's missing or
expired, the flag falls back to off and every scratch page 404s: re-run `vercel env pull`.

## Why this location

- Under `orgs/[slug]/`, so it inherits the real authenticated + org-scoped layout tree
  (`OrganizationProvider`, sidebar, everything) rather than being a bare unauthenticated
  page.
- `system/` groups it with other non-module, infrastructure-ish routes rather than
  sitting alongside real feature modules.
