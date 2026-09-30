# Implementation plan: Notes module (org + personal) on a master-detail layout

**Date:** 2026-09-30
**Branch:** `feat/notes` (worktree `.claude/worktrees/notes`, dev server port in `.dev-port`)
**DB:** adds a migration: drop `notes`, create `organization_notes` + `user_notes`. Run `npm run db:branch notes` (→ `avut_notes`) **before Task 1**. It needs every connection to `avut` closed, including the user's dev server and Prisma Studio. The orchestrating session runs `db:branch` and gets the user's permission for `migrate dev` against `avut_notes` before it hands Task 1 to the implementer. Run `npm run db:unbranch` once the branch merges.
**Written against:** integration @ 5d0069ec
**Source:** [#345](https://github.com/redcloud-nz/avut/issues/345), which combines the brainstorms #279 (notes module) and #281 (master-detail layout). Related: #224 (view transitions).
**Overlaps with:** `plan/modules-folder` (unbuilt), which moves module UI into `src/modules/<id>/`. This plan follows today's layout (`src/components/<domain>/`). Whichever lands second moves the notes UI.

The `notes` module already exists in the registry, with a placeholder page, and so does the `Note` model, but nothing reads or writes it. This plan replaces that model with two scope-specific ones and adds a user-scoped notes module. Both scopes render on a new reusable list/detail block, `Hermes`.

---

## Decisions

| Question                         | Decision (2026-09-30)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Models                           | As in #345: `OrganizationNote` (`organization_notes`) and `UserNote` (`user_notes`). Fields: `id`, scope FK, `title`, `content` (markdown, default `""`), `createdAt`, `updatedAt`. No `tags`/`properties`. No `RecordStatus`.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `OrganizationNote.author`        | `authorId String?`, `onDelete: SetNull`. Org notes belong to the org, so purging an account mustn't delete them. The account purge (`user-accounts.ts`) nulls `authorId` explicitly, as it does for `formInstance.userId`. Only holders of `organizationNote: ["update"]`/`["delete"]` can edit or delete an authorless note. The list shows "Unknown author" for it.                                                                                                                                                                                                                                                                                                  |
| `UserNote.user`                  | `userId String`, `onDelete: Cascade`. The purge deletes them explicitly, matching its "clear dependents on purpose" comment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Title                            | Required, 1–200 chars, trimmed. `content` gets only a sanity `max(100_000)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Delete                           | Hard delete. Notes aren't in the Rubbish bin (`src/lib/trash-registry.ts`). They're scratch space, and the bin can come later.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Permission                       | New statement `organizationNote: ["view", "create", "update", "delete"]`. **Every** role in `Roles` gets `view` + `create`, because a member may hold only a module role like `i3-editor`. `owner` and `admin` also get `update` + `delete`, which mean "any note". An author editing or deleting their own note needs only `create`. The router checks `authorId === ctx.userId`, and otherwise `ctx.hasPermission(ctx.organizationId, { organizationNote: ["update" \| "delete"] })`. `roleCovers` results don't change, because it's an equal grant on both sides of every pair.                                                                                    |
| Feature flag                     | Personal notes sit behind the **same** `notes-module` Vercel flag (`notesModuleFlag`) as org notes, so neither ships to production until the flag is turned on. Add `resolveUserModuleFlags(): Promise<Record<UserModuleId, boolean>>` to `src/server/module-flags.ts` (`user-notes` → `notesModuleFlag`, everything else `true`). `user/notes/layout.tsx` calls `notFound()` when it's off. The authenticated layout passes the result to `ScopeSidebar_Modules`, which hides flagged-off user modules. Because both scopes share the flag, the personal-notes help can live in `content/docs/notes/`, which `src/server/docs.ts` already hides when the flag is off. |
| Module gating on the API         | Not added. No module router checks `isModuleEnabled` or flags server-side today. The pages gate, as their siblings do.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D4H                              | Notes have no D4H dependency.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| User module                      | New registry entry `user-notes`. The id `notes` is taken, and the registry is keyed by id. Settings: `scope: "user"`, `segment: "notes"`, `alwaysOn: true`, `href: () => "/user/notes"`, label "Notes", icon `NotebookPenIcon`, placed after `user-dashboard`. Being `alwaysOn`, it needs no `UserSettings.modules` entry, since that's an explicit `z.object` and `configurableUserModuleIds` filters out `alwaysOn`. It's registered in the same task that adds `/user/notes/page.tsx` (Task 9), so no cast or dead link appears.                                                                                                                                    |
| Services                         | `src/server/services/organization-notes.ts` takes `OrgServiceContext`. `src/server/services/user-notes.ts` takes a new `UserServiceContext` (`{ prisma, userId, logEvent }`) in `service-context.ts`, and `OrgServiceContext` becomes `UserServiceContext & { organizationId }`. The `authenticatedProcedure` ctx already satisfies it exactly. The doc comment notes that an org ctx also satisfies it structurally, which would log a user note to the org log. Only the `userNotes` router calls the service.                                                                                                                                                       |
| Routers                          | `organizationNotes` (`organizationProcedure`) and `userNotes` (`authenticatedProcedure`), each with `createNote`, `deleteNote`, `getNote`, `listNotes`, `updateNote` (alphabetical). `listNotes` returns `id, title, createdAt, updatedAt`, plus the author's `{ id, name }` \| `null` for org notes. It doesn't return `content`. `getNote` returns the full row. User-note queries always filter on `userId: ctx.userId`, so another user's note is `NOT_FOUND`, not `FORBIDDEN`.                                                                                                                                                                                    |
| Audit logging                    | New `LogObjectType`s `OrganizationNote` (module `notes`) and `UserNote` (module `user-notes`, mapped to `null` until Task 9 registers the module). Each write is paired with `ctx.logEvent` in `$transaction([...])` (`docs/patterns/transactional-writes.md`). An update logs `diffObject({ title }, { title })`, plus a bare `{ type: "obj_mask", path: ["content"] }` when the content changed, as `d4h-access-tokens-router.ts` does for `token`. The body is never copied into the log. A delete's `description` carries the title.                                                                                                                               |
| Create flow                      | A **New note** button calls `createNote({ title: "Untitled note" })` directly, with no dialog. It then `router.push`es to the new note with `?edit=true`. That avoids the `?action=` dialog, which `<ViewTransition>` doesn't fire through (#224), and a scratch pad shouldn't make you name a note before writing it.                                                                                                                                                                                                                                                                                                                                                 |
| Edit                             | An inline toggle on the detail pane, driven by a nuqs `edit` boolean (`parseAsBoolean`), so a new note opens in edit mode and a refresh keeps it. View mode shows `RenderMarkdown`. Edit mode shows a title `Input` and `MarkdownEditor`, with Save and Cancel. Saving is explicit; there's no autosave.                                                                                                                                                                                                                                                                                                                                                               |
| Gating Edit/Delete on the client | "Author **or** permission" can't be expressed with `<Protect>`, so this is a justified inline check (`docs/patterns/protect-permission-gating.md`). `useHasPermission` combined with the session user id must mirror the server rule. Edit shows for the author, or for a holder of `organizationNote: ["update"]`. Delete shows for the author, or for a holder of `["delete"]`. The owner can always edit and delete a user note.                                                                                                                                                                                                                                    |
| Delete UI                        | A confirm dialog on the detail pane, following `docs/patterns/mutation-dialog.md` (`?action=delete`). On success it `router.replace`s to the list route. It's fine that the view transition doesn't fire through the dialog here.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Cache effects                    | `src/client/organization-notes-effects.ts` and `src/client/user-notes-effects.ts`, built with `createEffects<"organizationNotes" \| "userNotes">()` (`src/trpc/mutation-effector.tsx`, conventions checklist). Update writes `getNote` and invalidates `listNotes`. Create and delete set `meta.navigates`, which marks queries stale without refetching. Create `write`s the returned row into `getNote`, so the new note opens without a fetch. Delete doesn't refetch the deleted note's still-mounted `getNote`, which would come back `NOT_FOUND` through `useSuspenseQuery`.                                                                                     |
| Sorting                          | A sort `Select` in the list header: **Last updated** (the default, desc), **Created** (desc), **Title** (A→Z). The choice is held in `useState` in the list component, which lives in the layout and stays mounted, so it survives record navigation. The list is sorted on the client.                                                                                                                                                                                                                                                                                                                                                                                |
| Layout component                 | A named block, **`Hermes`** (`src/components/blocks/hermes.tsx`), in the carrier-name family: `Hermes.Root`, `Hermes.List`, `Hermes.Detail`, `Hermes.Placeholder`. `Root` is a client component. It decides which pane is active from `useSelectedLayoutSegment()`: `null` on the index route, and the `[note_id]` value on a record, when it's rendered from the notes `layout.tsx`. At `md` and up there are two columns, a fixed-width list and the detail, each `overflow-y-auto` inside a `min-h-0 flex-1` row. Below `md`, CSS hides the inactive pane. It has no notes-specific knowledge.                                                                      |
| Suspense                         | `Hermes.List` and `Hermes.Detail` replace `Std.ScrollContainer`, and with it the `Suspense` it supplied. The detail pane gets one from the route's `loading.tsx`, which wraps the layout's `children`, so it renders inside `Hermes.Detail`; make it a pane-sized fallback. `Hermes.List` wraps its own children in `Suspense` with a pane-sized fallback. Without one, a suspending list would fall back to `orgs/[slug]/loading.tsx` and blank the whole page.                                                                                                                                                                                                       |
| Shell / navbar                   | The route's `layout.tsx` renders `Std.Navbar` (full width, keeping `actions={<HelpButton slug="notes" />}`) above `Hermes.Root`. The breadcrumbs come from a small client component. It reads the selected id from `useSelectedLayoutSegment()` and the title from the list query, which is already loaded. With nothing selected it shows `["Notes"]`; with a note selected, `[{ label: "Notes", href }, title]`. On mobile, the breadcrumb dropdown then gives a way back to the list.                                                                                                                                                                               |
| Data fetching                    | The org `layout.tsx` (a server component) resolves the org with `getOrganizationBySlug(slug)` from `@/server/cache/organization`, as `orgs/[slug]/layout.tsx` does. It `prefetch`es `listNotes` and wraps the block in `HydrateClient`. `[note_id]/page.tsx` runs `generateMetadata` via `fetchQuery(getNote)`, renders the body via `prefetch(getNote)` + `HydrateClient`, and the detail uses `useSuspenseQuery` (`docs/patterns/detail-page-data-fetching.md`). List rows are `<Link prefetch={true}>`. Without that, Partial Prefetching skips the URL-specific data and `loading.tsx` interposes, so no transition fires (the #224 experiment, 2092cf8b).         |
| The existing org `layout.tsx`    | Today it's a `"use client"` module gate. Split it: the gate becomes the client component `Notes_ModuleGate` (`src/components/notes/`), and `layout.tsx` becomes a server component that renders `<Notes_ModuleGate><HydrateClient>…</HydrateClient></Notes_ModuleGate>`.                                                                                                                                                                                                                                                                                                                                                                                               |
| View transition                  | Wrap the detail content in `<ViewTransition key={noteId}>`, the keyed-content pattern in `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`, so switching records crossfades. There's no named shared-element morph in this pass. Adding one later needs `default="none"` plus an explicit `share` (#224).                                                                                                                                                                                                                                                                                                                                             |
| Shared UI                        | The presentational parts (`NotesList`, `NoteDetail`, `NoteEditor`) live in `src/components/notes/`, and they take data and callbacks. The scope-specific wrappers (`OrgNotes_*`, `UserNotes_*`) own the queries, mutations and permission checks. The org UI is built first, and the user UI reuses it.                                                                                                                                                                                                                                                                                                                                                                |
| Markdown safety                  | `RenderMarkdown` gains `rehype-sanitize` after `rehype-raw`, using `defaultSchema` with `u` added to `tagNames` (#345). `rehype-raw` stays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Editor fixes                     | Gaps in `MarkdownEditor` that show up in a full-height pane (height, toolbar position, focus) get fixed in `src/components/markdown/`, as their own commit within the task that finds them, not worked around in notes (#345).                                                                                                                                                                                                                                                                                                                                                                                                                                         |

---

## Tasks

### - [x] 1. Replace `Note` with `OrganizationNote` and `UserNote`

`feat(notes): replace Note with OrganizationNote and UserNote`, `fix(notes): index OrganizationNote.authorId and share note input schemas`

**Files:**

- `prisma/schema.prisma`, and a new `prisma/migrations/<timestamp>_scoped_notes/migration.sql`
- new `src/lib/schemas/organization-note.ts` and `src/lib/schemas/user-note.ts`
- `src/lib/schemas/log-entry.ts`
- `src/server/services/user-accounts.ts` (+ `user-accounts.test.ts` if it covers the purge)
- `src/trpc/routers/organizations-router.ts` and `organizations-router.test.ts`

**Precondition:** `.env.local` points at `avut_notes` (`grep POSTGRES_PRISMA_URL .env.local`). If it still points at `avut`, **stop and report**. Never run `migrate dev` against the shared database.

**Do:**

- **Schema:** remove `model Note` and its back-relations (`User.authoredNotes`, `Organization.notes`). Add:
  - `OrganizationNote`:
    - `id String @id`
    - `organizationId String` → `Organization` (`onDelete: Cascade`)
    - `authorId String?` → `User` (`onDelete: SetNull`)
    - `title String`, `content String @default("")`
    - `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
    - `@@index([organizationId])`, `@@map("organization_notes")`
  - `UserNote`:
    - `id String @id`
    - `userId String` → `User` (`onDelete: Cascade`)
    - `title String`, `content String @default("")`
    - timestamps
    - `@@index([userId])`, `@@map("user_notes")`
  - Name the relations and back-relations as the neighbouring models do.
- **Migration:** run `npm run prisma migrate dev -- --name scoped_notes`. The permission is for `avut_notes` only (see Precondition). Then `npx prisma generate`.
- **Zod schemas,** following `src/lib/schemas/team.ts`:
  - the branded Id (`OrganizationNoteId`/`UserNoteId`: `schema` + `create()`)
  - a record schema
  - input schemas: `create` (`title`, optional `content`) and `update` (`title?`, `content?`, at least one present)
  - the title rule from Decisions
- **Log object type:** add `OrganizationNote` → `"notes"`. (`UserNote` comes in Task 4.)
- **Account purge** (`user-accounts.ts`, the `$transaction` around line 231): replace `note.deleteMany({ where: { authorId } })` with two steps:
  - `organizationNote.updateMany({ where: { authorId: userId }, data: { authorId: null } })`
  - `userNote.deleteMany({ where: { userId } })`

  Don't delete org notes.

- **Record counts** (`organizations-router.ts` around lines 295/338): keep the response key `notes`, now read from `_count` of the new org back-relation. Update `organizations-router.test.ts` (lines 771–797), which seeds `db.note.create`, to seed `organizationNote`.

**Done when:**

- The migration applies cleanly to `avut_notes`, and `npx prisma migrate status` is clean.
- `grep -rn "prisma.note\b\|\.note\.\|db.note\b" src` finds nothing.
- A test asserts that the purge nulls `authorId` on org notes and deletes the user's notes (in `user-accounts.test.ts` if it has a purge test; add one if not).
- `npm run check` passes.

### - [x] 2. `organizationNote` permission

`feat(notes): add organizationNote permission`

**Files:** `src/lib/permissions.ts`, `src/lib/permissions.test.ts`.

**Do:**

- Add `organizationNote: ["view", "create", "update", "delete"]` to `statement`.
- Grant `view` + `create` to **every** entry in `Roles`. `owner` and `admin` also get `update` + `delete`.
- Comment on the statement: `update`/`delete` mean "any note", and an author edits or deletes their own note with `create` alone.

**Done when:**

- A test loops over `roles`, the exported list, not a hand-picked set, and asserts that each authorizes `organizationNote: ["view", "create"]`.
- Only `owner` and `admin` authorize `["update"]` and `["delete"]`.
- The existing `roleCovers` tests still pass.
- `npm run check` passes.

### - [x] 3. Organization notes service and router

`feat(notes): add organization notes service and router`, `fix(notes): share the note list-item schema and skip the second read on write`

**Files:** new `src/server/services/organization-notes.ts` (+ `.test.ts`), new `src/trpc/routers/organization-notes-router.ts` (+ `.test.ts`), `src/trpc/routers/_app.ts`.

**Do:**

- **Service** (`src/server/services/CLAUDE.md`: namespace import, `OrgServiceContext`, domain errors):
  - `list(ctx)` returns the fields listed under Decisions → Routers, ordered by `updatedAt desc`.
  - `requireById(ctx, id)` is scoped to `ctx.organizationId`.
  - `create(ctx, input)` sets `authorId: ctx.userId`.
  - Also `update(ctx, id, input)` and `remove(ctx, id)`.
  - Each write is `$transaction([write, ctx.logEvent(...)])`, logged per Decisions → Audit logging.
- **Router** `organizationNotes`:
  - `listNotes` and `getNote` need `{ organizationNote: ["view"] }`.
  - `createNote` needs `["create"]`.
  - `updateNote` and `deleteNote` need `["create"]`. Each then loads the note and, unless `note.authorId === ctx.userId`, runs `await ctx.hasPermission(ctx.organizationId, { organizationNote: ["update"] })` (or `["delete"]`). This check stays in the router, because `hasPermission` isn't on `OrgServiceContext`.
  - Register the router in `_app.ts`.
  - **Update input:** build it as `NoteUpdateInput.refine(NoteUpdateInput.schema.extend({ noteId: … }))` (`src/lib/schemas/note-fields.ts`). The "at least one field" refine goes on last, because Zod 4 throws when you extend a refined object.

**Done when:** tests (`.claude/rules/testing.md`) cover the cases below. `createAuthenticatedMockContext`'s `hasPermission` checks statements literally, so a member fixture passes `permissions: { organization: ["view"], organizationNote: ["view", "create"] }`, and an admin fixture adds `update`/`delete`.

- create logs a `Create` entry with `authorId` set
- update logs the title diff and the content `obj_mask`, and never the content value
- a note from another org is `NOT_FOUND`
- a non-author member's update or delete is `FORBIDDEN`
- an admin's update or delete of someone else's note succeeds
- a note with `authorId: null` is editable by an admin and `FORBIDDEN` to a member

`npm run check` passes.

### - [ ] 4. User notes service and router

**Files:** `src/server/services/service-context.ts`, new `src/server/services/user-notes.ts` (+ `.test.ts`), new `src/trpc/routers/user-notes-router.ts` (+ `.test.ts`), `src/trpc/routers/_app.ts`, `src/lib/schemas/log-entry.ts`.

**Do:**

- Add `UserServiceContext` and redefine `OrgServiceContext` on top of it (Decisions → Services), with the doc comment.
- Add `LogObjectType` `UserNote` → `null`, with `// → "user-notes" once the module is registered (Task 9)`.
- The service mirrors Task 3's shape as built: `update`/`remove` take the already-loaded note rather than an id, and the list-item schema lives in the schema file (`UserNoteData.listItemSchema`). It's scoped by `userId: ctx.userId` on every query and write.
- The router `userNotes` uses `authenticatedProcedure`, with the same five procedures. Its `ctx.logEvent` writes `scope: "user"` entries. There's no permission check beyond ownership.

- **Update input:** build it as `NoteUpdateInput.refine(NoteUpdateInput.schema.extend({ noteId: … }))` (`src/lib/schemas/note-fields.ts`). The "at least one field" refine goes on last, because Zod 4 throws when you extend a refined object.

**Done when:** tests go through `userNotesRouter.createCaller(createAuthenticatedMockContext(...))`, whose middleware builds the user `logEvent`. There's no user-scoped mock-context helper. They cover:

- another user's note is `NOT_FOUND` for get, update and delete
- writes log `UserNote` entries
- the update diff masks content

`npm run check` passes.

### - [ ] 5. Sanitize rendered markdown

**Files:** `src/components/markdown/render.tsx`, new `src/components/markdown/render.test.tsx`.

**Do:** add `rehype-sanitize` after `rehype-raw` in `RenderMarkdown`, with `defaultSchema` plus `u` in `tagNames`. Add a short comment saying why `rehype-raw` stays: the underline button saves `<u>`.

**Done when:** `render.test.tsx` shows that:

- `<u>x</u>` renders a `<u>`
- `<script>` and an `onerror` attribute are stripped
- a GFM table and a link still render

`npm run check` passes.

### - [ ] 6. `Hermes` master-detail block

**Files:** new `src/components/blocks/hermes.tsx`, `AGENTS.md` (the UI Block Components table).

**Do:** build the block described in Decisions → Layout component and Suspense.

- **`Hermes.Root`** (`"use client"`): a flex row that fills what's left of `Std.SidebarInset` under the navbar (`min-h-0 flex-1`). It reads `useSelectedLayoutSegment()` and sets `data-selected`, so that below `md` the panes hide themselves: `List` when something is selected, `Detail` when nothing is.
- **`Hermes.List`:** `md:w-80 md:shrink-0 md:border-r`. It has its own `overflow-y-auto`, the scrollbar classes copied from `Std.ScrollContainer`, and `Suspense` around its children.
- **`Hermes.Detail`:** `flex-1 min-w-0 overflow-y-auto p-4`.
- **`Hermes.Placeholder`:** centred muted text. It's only visible at `md` and up.
- Add a file header comment in the style of `std.tsx`, and a row in the AGENTS.md table.

**Done when:** `npm run check` passes. The block is checked visually in Task 7, since it has no consumer yet.

### - [ ] 7. Organization notes: shell and list `visual`

**Files:**

- Under `src/app/(wrapper)/(authenticated)/orgs/[slug]/notes/`: `layout.tsx` and `page.tsx` (both rewritten), and `loading.tsx` (reworked).
- New `src/client/organization-notes-effects.ts`.
- New in `src/components/notes/`: `notes-module-gate.tsx`, `notes-list.tsx`, `notes-breadcrumbs.tsx`, `org-notes-list.tsx`.

**Do:**

- Build the shell and list pane to Decisions → Shell, Data fetching, The existing org `layout.tsx`, Suspense, Sorting and Cache effects. Read `docs/patterns/detail-page-data-fetching.md` first.
- **List rows:**
  - the title
  - "updated <relative time>" (`usePreferences().formatRelativeDateTime`)
  - the author's name as plain text, or "Unknown author". Not an entity link: `UserLink` targets admin pages that a member may not reach.
  - the selected row is highlighted
- **New note** button in the list header: Decisions → Create flow. The detail route arrives in Task 8, so until then the push lands on a 404. That's acceptable mid-branch.
- **Index `page.tsx`:** the desktop placeholder "Select a note, or create a new one."
- **`loading.tsx`:** a pane-sized fallback.

**Done when:**

- `npm run check` passes.
- In a browser (`avut-test-in-browser`) on this worktree's port, with the notes flag and the org's notes module on:
  - the list renders beside the placeholder on desktop, with only the list at phone width
  - sorting works
  - panes scroll independently
  - no console errors

### - [ ] 8. Organization notes: detail, edit, delete `visual`

**Files:**

- New `src/app/(wrapper)/(authenticated)/orgs/[slug]/notes/[note_id]/page.tsx`.
- New in `src/components/notes/`: `note-detail.tsx`, `note-editor.tsx`, `org-note-content.tsx`, `delete-org-note-dialog.tsx`.
- Possibly `src/components/markdown/*`, as a separate commit.

**Do:**

- Build the detail pane to Decisions → Data fetching, Edit, Gating Edit/Delete on the client, Delete UI, View transition and Editor fixes. Read `docs/patterns/mutation-dialog.md` for the delete dialog.
- Run `npx next typegen` after adding the page.

**Done when:**

- `npm run check` passes.
- In a browser:
  - create lands in edit mode; save shows rendered markdown
  - switching notes keeps the list's scroll position and sort, and crossfades the detail
  - delete returns to the list
  - at phone width, the detail is its own screen with a working way back
  - a member who isn't the author sees no Edit or Delete
  - no console errors

### - [ ] 9. Personal notes: module, flag and UI `visual`

**Files:**

- `src/lib/modules.ts`, `src/lib/schemas/log-entry.ts`, `src/server/module-flags.ts`.
- `src/app/(wrapper)/(authenticated)/layout.tsx`, `src/components/nav/scope-sidebar-modules.tsx`.
- New under `src/app/(wrapper)/(authenticated)/user/notes/`: `layout.tsx`, `page.tsx`, `loading.tsx`, `[note_id]/page.tsx`.
- New `src/client/user-notes-effects.ts`.
- New in `src/components/notes/`: `user-notes-list.tsx`, `user-note-content.tsx`, `delete-user-note-dialog.tsx`.

**Do:**

- Register `user-notes` (Decisions → User module), and switch `UserNote`'s log mapping to `"user-notes"`.
- Add `resolveUserModuleFlags` and wire it to the layout and the sidebar (Decisions → Feature flag).
- The layout calls `notFound()` when the flag is off.
- Build the same shape as Tasks 7–8 on `userNotes`, reusing the presentational components. If they need a prop to cover both scopes (the author line, for one), add it; don't fork them.
- Run `npx next typegen`.

**Done when:**

- `npm run check` passes.
- The Tasks 7–8 browser checks pass on `/user/notes`, apart from the permission check.
- Notes appears in the user-scope sidebar when the flag is on.

### - [ ] 10. Help docs

**Files:** `content/docs/notes/index.mdx`.

**Do:** correct the page and extend it, keeping its voice.

- Editing uses an Edit button and Save; it doesn't save as you type.
- Anyone in the organisation can read and add notes. Authors, or admins, edit and delete them.
- Add a "Personal notes" section: they're under your account, visible only to you, and not tied to an organisation.

The page is in the flag-gated `notes` section, which is right, because personal notes share the flag.

**Done when:** `npm run check` passes and `/docs/notes` renders with the flag on.

---

## Out of scope

- The Rubbish bin for notes (hard delete for now).
- Tags, search, and pinning or favouriting.
- Linking a personal note to an org.
- Autosave and collaborative editing.
- Server-side module or flag checks on the API. None of the module routers have them.
- Parallel routes (`@list`/`@detail`). Revisit when `Hermes` backs a heavier list.
- Moving personnel or skill packages onto `Hermes`.
- A named shared-element morph (list row → detail title).
- Object-history panels (#341) for notes.
- A separate flag for personal notes.
