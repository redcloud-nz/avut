# Generic file upload / intake mechanism

**Project:** avut
**Date:** 2026-09-10 16:20
**Source:** brainstorm session

## Idea

AVUT has no file-upload mechanism today. Rather than build one monolith, split the
need in two and ship staged:

- **Stage 1 — transient intake (unblocks #115).** A small `ui/` primitive that reads
  a picked file's contents in the browser, validates against a shared Zod schema for
  instant inline errors, and sends the **parsed object** as an ordinary tRPC mutation
  input (the same schema re-validates server-side for free). No multipart, no route
  handler, no Blob. The "file" is just a nicer text input.
- **Stage 2 — persistent storage (deferred, but specced now).** A scoped `File`
  Prisma model backed by Vercel Blob client-upload, for durable binary/large files
  (avatars, org logos, notes attachments, i3 equipment photos).

## Context / motivation

Issue #115 (skill-package export/import) needs to move a `.json` envelope between
AVUT instances, and its idea file lists "real in-app file upload" as deferred future
work. Several other features would want durable file storage eventually. But #115's
envelopes are tiny JSON — treating that as an "upload" problem over-solves it. The
two needs share only the browser-side "pick a file" step and diverge completely after
that, so they should not be one abstraction.

## Options considered

- **Scope: transient only / persistent only / both unified / both staged** — chose
  **both, staged**. Design the whole picture, ship transient first.
- **Storage backend: Vercel Blob / Postgres bytea / undecided** — chose **Vercel
  Blob**, native to the deployment, supports private + public, client-upload tokens
  keep bytes out of the function. Only relevant to stage 2.
- **Stage 1 mechanism: client-side read primitive / real Blob upload from the start /
  read now + spec Blob alongside** — chose **client-side read primitive**, with the
  stage-2 Blob API specced in this same doc so it isn't a future unknown. Rationale:
  #115 files are <1 MB JSON; `FileReader` + `JSON.parse` + Zod client-side, then a
  normal mutation, composes with the existing mutation-dialog pattern and needs zero
  new dependencies.
- **Stage 1 as a `blocks/` ship-name** — no. Blocks are high-level layout systems; a
  file picker is a `ui/` primitive (`<FileInput>` + `useFileContents` hook).
- **Stage 2 attach model: scoped `File` model / polymorphic `Attachment` join /
  per-feature no shared model / defer entirely** — chose **scoped `File` model** with
  a scope trichotomy (`organizationId` / `ownerId` / `scope: "system"`) mirroring
  `ctx.logEvent`. Per-feature FKs point at it. Polymorphic attachments rejected for
  weaker FK integrity.

## Open questions

- **Stage 2 lifecycle**: orphan cleanup (uploaded but never attached) — cron sweep?
  Parent-delete cascade must delete the blob too, but blob deletion can't join a
  `$transaction`, so it needs a post-commit sweep or a queue.
- **Preview vs prod Blob stores**: one store or per-environment? Signed-URL TTL.
- **Private-file serving**: perms-checked route that redirects to a short-lived
  signed URL vs. proxying bytes through the function.
- **Content safety for field-sourced photos** (i3): EXIF/GPS stripping, size caps,
  optional virus/content scanning.
- **CSV intake** (future D4H importer): pulls in `papaparse` when it lands; not now.
- **Per-kind size/type policy**: where is it declared and enforced (client cap +
  server re-check).

## Notes

**Stage 1 concrete shape:**

- `src/components/ui/file-input.tsx` — styled file picker primitive.
- `useFileContents` hook — returns text/ArrayBuffer, enforces a client-side size cap
  (reject e.g. >1 MB before `JSON.parse`), surfaces read errors.
- Convention: client read → `EnvelopeSchema.safeParse` for inline dialog errors →
  submit `parsed.data` as the mutation input. Server mutation input **is** the same
  `src/lib/schemas/` envelope schema, so it re-validates; client validation is UX
  only and never trusted.
- The **`Eagle` block** (JSON diff/parse comparison, already used in dev/import
  tooling) is the natural way to render an import **dry-run preview** — what will be
  created / upserted / archived — before the user commits.
- Fits the mutation-dialog pattern (`?action=import` via nuqs). For #115, the import
  mutation is a `systemAdminProcedure` using the `organizationId` `ctx.logEvent` arm,
  one package-shaped log entry per import.

**Stage 2 `File` model sketch:**

```
File {
  id            String   @id           // nanoId16()
  organizationId String? // exactly one of these three, mirroring ctx.logEvent
  ownerId        String?
  systemScope    Boolean  @default(false)
  pathname      String                  // Blob pathname
  blobUrl       String
  contentType   String
  size          Int
  uploadedById  String
  createdAt     DateTime @default(now())
  deletedAt     DateTime?               // soft-delete
  // + optional `kind`/`purpose` enum, checksum
}
```

- Vercel Blob **client-upload**: browser → Blob directly via a token-issuing route
  handler (`handleUpload`); bytes never transit the function.
- Private by default. `File` create/delete pair with `ctx.logEvent` (scope from the
  file's own scope).
- The upload _action_ is gated by the owning feature's permission
  (`person: ["update"]` for an avatar), **not** a new `file:*` permission vocabulary.
- Needs a Blob store provisioned on the Vercel project + env wiring (not present
  yet).

**Codebase entry points:**

- `src/lib/schemas/` — envelope schema (shared client/server).
- `docs/patterns/mutation-dialog.md` — dialog pattern the import UI follows.
- `src/components/blocks/` — `Eagle` for dry-run preview.
- `src/trpc/init.ts:175` — `systemAdminProcedure`.
- Related idea: `docs/ideas/2026-09-10-skill-package-export-import.md` (issue #115).
