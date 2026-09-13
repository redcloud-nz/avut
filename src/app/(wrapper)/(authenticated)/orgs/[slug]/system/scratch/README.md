# Scratchpad

Throwaway route for visually testing something (component layout, a CSS interaction,
anything easier to see rendered than reasoned about) via a real browser against a real
signed-in session — full `useOrganization()`/trpc context, same as any other
`orgs/[slug]/...` page.

## Convention

- One subdirectory per task: `system/scratch/<task-name>/page.tsx`.
- Keep it a normal `"use client"` page — no need for `generateMetadata`, prefetching,
  or any of the patterns in `docs/patterns/`; it's not a real page.
- Delete the subdirectory when done. Everything under `system/scratch/` except this
  README is gitignored, so nothing needs to be staged or reverted — just `rm -rf` it.
- Visit at `/orgs/<any-slug-you-have-access-to>/system/scratch/<task-name>`.

## Why this location

- Under `orgs/[slug]/`, so it inherits the real authenticated + org-scoped layout tree
  (`OrganizationProvider`, sidebar, everything) rather than being a bare unauthenticated
  page.
- `system/` groups it with other non-module, infrastructure-ish routes rather than
  sitting alongside real feature modules.
