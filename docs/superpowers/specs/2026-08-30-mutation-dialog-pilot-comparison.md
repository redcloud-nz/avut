# Mutation dialog: route-group vs nuqs `?dialog=` — pilot comparison

**Date:** 2026-08-30
**Branch:** `pilot/nuqs-mutation-dialogs` (commit `4bc6d59`)
**Outcome:** nuqs `?dialog=` chosen. The pattern doc and migration spec are updated to match; `admin/teams` will be converted back off route groups. This document is kept as the rationale record.

Two implementations of the same five goals, both now in the tree:

- **Route-group** — `admin/teams`, shipped in PR #58. `(list)` / `(detail)` route
  groups, `layout.tsx` renders content + `{children}`, bare `page.tsx` → `null`,
  `--create` / `--update` / `--delete` folders with thin client pages, dialog
  components fully separated from their triggers.
- **nuqs `?dialog=`** — `admin/personnel`, this pilot. A `dialog` search param
  (`parseAsStringLiteral`) drives `open`; triggers stay co-located in the dialog
  component (create button, update pencil) or in the menu (delete). `history:
"push"` on open, `"replace"` on close. No route files, no groups, no layout
  changes.

## Browser click-through results (nuqs pilot, `christchurch-cdem`)

| Scenario                                    | Result                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| Open create via button (soft nav)           | ✅ URL → `?dialog=create`, list stays mounted + visible behind the dialog |
| Direct load / refresh of `?dialog=create`   | ✅ dialog opens on load                                                   |
| Cancel create                               | ✅ param cleared, **focus restored to the "New Person" button**           |
| Submit create                               | ✅ toast, navigates to the new person's detail page, no leftover param    |
| Open update via pencil                      | ✅ URL → `?dialog=update`, form prefilled                                 |
| Close update                                | ✅ param cleared, **focus restored to the pencil button**                 |
| Open delete via menu item                   | ✅ URL → `?dialog=delete`, `AlertDialog` over the detail page             |
| Direct load / refresh of `?dialog=delete`   | ✅ dialog opens on load                                                   |
| Confirm delete                              | ✅ record deleted, toast, navigates to the list — **after the fix below** |
| Sibling subpage (`/personnel/[id]/history`) | ✅ unaffected                                                             |

### Bug found and fixed during the pilot

`delete-person.tsx`'s `onSuccess` called `props.onOpenChange?.(false)` **and**
`router.push(list)`. With nuqs, `onOpenChange(false)` is a URL write (`setDialog(null)`)
that **raced** the `router.push` — the delete persisted server-side but the page
stayed on the now-stale detail route until a manual reload (which then 404'd).
Removing the `onOpenChange(false)` + `mutation.reset()` from `onSuccess` (which
`mutation-dialog.md` already prescribes) fixed it: delete now lands on the list.

This is a **general lesson for either approach** — never pair a closing
`onOpenChange`/param-write with a `router.push` in the same `onSuccess`; let the
navigation unmount the dialog.

## Head-to-head

| Dimension                                                | Route-group (`teams`)                                                                                                                       | nuqs `?dialog=` (`personnel`)                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Own URL, survives refresh**                            | ✅ real route                                                                                                                               | ✅ search param, can't 404                                                                                              |
| **Underlying page stays mounted**                        | ✅ (shared layout ancestor)                                                                                                                 | ✅ (page never re-renders; `shallow` History update)                                                                    |
| **Server round-trip on open/close**                      | Yes — `(detail)/layout.tsx` `generateMetadata` re-runs `requireOrganization` + `fetchQuery` on each soft-nav open/close                     | **None** — pure client History update                                                                                   |
| **Focus restoration on close**                           | ✗ trigger `<Link>` unmounts → focus drops to `<body>` (needs a shared `onCloseAutoFocus` fix)                                               | ✅ trigger button stays mounted → Radix restores focus automatically, verified for create + update                      |
| **Back button after open→close**                         | ghost entry: `push` on close leaves a re-openable dialog URL behind                                                                         | clean: `push` on open + `replace` on close, Back lands on the pre-dialog page                                           |
| **Close destination**                                    | hard-coded parent path; a list-triggered delete routes _through_ the full detail-page render, then dumps you on the detail page             | trigger and dialog share a page, so close returns exactly where you were                                                |
| **New files**                                            | ~4 scaffolding (`(list)/layout`, `(list)/page`→null, `(detail)/layout`, `(detail)/page`→null) + 1 thin client page per dialog ≈ 7 for teams | **0**                                                                                                                   |
| **Diff size (this area)**                                | teams PR #58: 5 files changed, ~325 insertions / ~170 deletions                                                                             | personnel pilot: 5 source files, **+82 / −22**, plus `nuqs` dep + 3-line `NuqsAdapter` wiring                           |
| **`npx next typegen` needed**                            | yes, per route added                                                                                                                        | no                                                                                                                      |
| **Filesystem discoverability**                           | ✅ walk `src/app/` to see every dialog                                                                                                      | ✗ dialogs enumerated in component code, not the route tree                                                              |
| **Typed-route ergonomics for the dialog URL**            | ✅ `route("/…/--create", …)`                                                                                                                | ✗ `?dialog=create` is a bare string (could add a typed helper)                                                          |
| **Dynamic `<title>` reflecting dialog state**            | possible (metadata on the `--*` page)                                                                                                       | not possible (search param, no metadata hook) — irrelevant for authed pages                                             |
| **Client detail-page areas (i3 templates, users)**       | need the page body extracted into a `-content` component + a server layout before the pattern fits                                          | no extraction — the param hook drops into the existing client page as-is                                                |
| **Per-row / list-item dialogs** (delete from a list row) | natural — `[id]/--delete` route                                                                                                             | needs `?dialog=delete&personId=…` and the host resolves the row from cache                                              |
| **New dependency**                                       | none                                                                                                                                        | `nuqs` (~6 kB, actively maintained, official Next App Router adapter)                                                   |
| **Concurrent-dialog namespacing**                        | routes are inherently distinct                                                                                                              | one `dialog` param; each component parses its own literal set — fine, but two dialogs can't be open-addressable at once |

## Assessment

The nuqs approach hit **every goal** in the browser and beat the route-group
version on the three things the second-opinion agent flagged as route-group
weaknesses — **focus restoration, back-button behaviour, and server round-trips
on open** — while touching far less of the tree (no route files, no layout
surgery, no `typegen`, no client-page extraction for the `i3`/`users` cases). The
diff for personnel is roughly a quarter the size of the teams PR.

What route-group keeps as genuine advantages: **filesystem discoverability** of
every dialog, **typed-route** strings for dialog URLs, and a cleaner story for
**per-row list-item** dialogs (personnel deletes from the detail page, so the
pilot didn't exercise that — `i3` variants and team members will).

The one real cost of switching is **re-doing `teams`** and rewriting the pattern
doc + spec around nuqs.

## Options

1. **Adopt nuqs, redo `teams`, rewrite the spec.** Best technical outcome per the
   pilot; costs one extra small conversion (teams back off route groups) and a
   doc rewrite.
2. **Keep route-group, apply the pilot's lessons.** Add the shared
   `onCloseAutoFocus` fix, the `back()`-vs-`push` close logic, and the
   `onSuccess` race fix to `mutation-dialog.md`, then proceed with the spec as
   written.
3. **Hybrid.** nuqs for list/detail-page CUD (the bulk); route-group only where a
   dialog genuinely benefits from its own addressable route (rare). More
   nuance to document.
