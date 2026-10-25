# Pattern: route access control

Who may open a page under `(authenticated)`, and where that is enforced. Read this before writing a page, layout or `generateMetadata` that reads data, and before moving a layout's session or org read behind a `<Suspense>` boundary.

---

## The rule

**Every read is checked where it happens.** For almost all data, that's the tRPC procedure: `organizationProcedure({ ... })` names the permission, and it runs on every call, server prefetch and client fetch alike. A page doesn't repeat the check.

A page, layout or `generateMetadata` that reads data **outside tRPC** (Prisma, a `src/server` helper, a D4H client) is its own data layer. It needs its own check, right next to the read, requiring the same permission the equivalent procedure would.

Route access is otherwise coarse, on purpose. A member can load the URL of any page in their org. If they lack the permission behind its data, the page shows "Not permitted" instead of the data.

---

## Layouts aren't guards

Three layouts block with an `await`:

| Layout                       | Calls                       | Effect on a full page load                    |
| ---------------------------- | --------------------------- | --------------------------------------------- |
| `(authenticated)/layout.tsx` | `requireSession()`          | Redirects to sign-in                          |
| `orgs/[slug]/layout.tsx`     | `requireOrganization(slug)` | 404 for a non-member; loads the shell's roles |
| `system/admin/layout.tsx`    | `requireSystemAdmin()`      | Forbidden for a non-admin                     |

They give the right response on a full page load and load what the shell needs. They don't protect the pages below them, because a layout doesn't run again on client-side navigation. From Next's authentication guide (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`):

> Due to Partial Rendering, be cautious when doing checks in Layouts as these don't re-render on navigation, meaning the user session won't be checked on every route change. … you should do the checks close to your data source.

So never rely on an ancestor layout to protect a read. It follows that a layout's session or org read may move behind `<Suspense>` without opening a hole, provided every direct read still checks for itself.

---

## Pages

A typical org page gets the org from `getOrganizationBySlug(slug)` and fetches through tRPC:

```tsx
const organization = await getOrganizationBySlug(slug);
prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }));
```

`getOrganizationBySlug` checks nothing. It turns the slug into the org's id and name, which every procedure then checks against the caller. Don't add `requireOrganizationWith` to a page to get a Forbidden screen sooner; the procedure already produces one:

- **`fetchQuery`** (awaited, e.g. in `generateMetadata`) turns a procedure's FORBIDDEN or NOT_FOUND into `forbidden()` or `notFound()`. The `forbidden.tsx` and `not-found.tsx` beside each scope's `error.tsx` (`orgs/[slug]`, `system`, `user`) show the panel inside the Sidebar/NavBar.
- **`prefetch`** (fire-and-forget) rejects on the server, and React Query hands the client a redacted error. The client retries, the retry gets the real FORBIDDEN, and `error.tsx` shows the same panel through `describeError`.

The `prefetch` path costs a user without permission one extra failed request and a retry delay of about a second. In development the server also logs "A query that was dehydrated as pending ended up rejecting" once per query. That's accepted: it only happens to someone opening a page they can't use, and it keeps the procedure the one place each permission is declared.

Client Component pages (`"use client"`) can't hold a server check at all. They fetch through tRPC like everything else.

`generateMetadata` follows the same rule: `getOrganizationBySlug` plus `fetchQuery`. Avoid a `require…` call there: it can redirect, which `generateMetadata` mustn't do (see the comment in `orgs/[slug]/layout.tsx`).

---

## When a page needs its own check

When it reads data outside tRPC. Put the check next to the read, with the permission the matching procedure requires. Current cases:

- The D4H access token pages under `admin/d4h-access-tokens/[token_id]/` that call `getD4HFetchClient` (`whoami`, `organisation`, `members`, `equipment-{categories,kinds,items,locations}`) read D4H with the organization's credential: `requireOrganizationWith(slug, { organization: ["update"] })`. The token list, create, detail and history pages read through tRPC and have no check of their own.
- `d4h-today` looks up the viewer's own personal D4H token to decide what to show: `requireOrganization(slug)`. Its D4H data comes through `d4hApi.myActivitiesToday`. The D4H browser pages under `d4h/` read only through `d4hApi` and have no check of their own.

---

## Known and accepted

- **Org name by slug.** `getOrganizationBySlug` in `orgs/[slug]/layout.tsx`'s `generateMetadata` can put an org's name in the tab title for any signed-in user who knows its slug.
- **`system/admin` pages repeat `requireSystemAdmin()`** in each page and its `generateMetadata`, although they read only through `systemAdminProcedure`, and the `generateMetadata` call goes against the rule above. It's redundant under this rule, and left in place. Don't copy it into new org-scoped pages.

---

## Related

- [`protect-permission-gating.md`](protect-permission-gating.md): `<Protect>` hides controls. It's cosmetic; the procedure is still the check.
- [`detail-page-data-fetching.md`](detail-page-data-fetching.md): the `fetchQuery`-in-`generateMetadata`, `prefetch`-in-the-page shape.
