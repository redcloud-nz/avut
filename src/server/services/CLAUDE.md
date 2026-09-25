# Domain services

Loaded when working under `src/server/services/`. The repo-wide rules (always call
`ctx.logEvent`, use `$transaction`, never write `logEntry.create` by hand) stay in the root
`AGENTS.md`; the audit-logging guide (which `logEvent` a router hands you, `LogBatch`, the
`Operations` registry) is in [`src/trpc/CLAUDE.md`](../../trpc/CLAUDE.md).

Logic reused across procedures, or across routers, belongs in a domain service under
`src/server/services/<domain>.ts` (issue #248) rather than as a router-file helper — a router
importing another router's helper is the symptom that led here. Piloted on
`src/server/services/personnel.ts`.

- One module per domain, imported as a namespace and called `Namespace.verb(ctx, …)` — e.g.
  `import * as Personnel from "@/server/services/personnel"`, `Personnel.create(ctx, …)`. No
  classes, no `services/index.ts` barrel (a barrel loads every service to import one, and breaks
  per-service `vi.mock`).
- A lookup-by-id getter always ends in `ById` — `requireById`/`getById` when the module has one
  entity (`Personnel.requireById`, `Teams.getById`, the namespace alone disambiguates), or
  `require<Entity>ById`/`get<Entity>ById` when it has several (`SkillPackages.requireSkillById` /
  `.requireGroupById` / `.requirePackageById`). Never drop the suffix just because the entity name
  in the function already implies "by id". `get*` returns `T | null`; `require*` throws
  `NotFoundError` and returns `T`. Add whichever a caller needs — a module isn't required to expose
  both. `find*` is reserved for a different shape entirely: a filtered candidate search (e.g.
  `Personnel.findLinkablePerson`), not a lookup by a specific key.
- A service takes `OrgServiceContext` (`src/server/services/service-context.ts`) — `{ prisma,
organizationId, userId, logEvent }` — not `AuthenticatedOrganizationContext`. The tRPC type
  structurally satisfies it, so no adapter is needed at call sites; the point is that a service
  stays callable from a Server Component or a test with no tRPC context to build.
- A multi-entry operation binds its `LogBatch` once with `withBatch(ctx, batchId)`
  (`service-context.ts`) rather than threading a `batchId` parameter through every helper it
  calls — every `ctx.logEvent` made through the returned context joins that batch automatically.
- Services throw plain `Error` subclasses (`NotFoundError`, `ConflictError` in `src/lib/errors.ts`)
  instead of `TRPCError`, so they carry no tRPC dependency. A `publicProcedure` middleware in
  `src/trpc/init.ts` catches these and rethrows the matching `TRPCError`, preserving the domain
  error as `cause` — the same shape `formatTrpcError` already reads for `FieldConflictError`. A
  conflict the client needs to attribute to one input field still throws `FieldConflictError`
  (`src/trpc/errors.ts`) directly from the router, since only that one carries `fieldName` through
  to the client; `ConflictError` is for a conflict with no single field to blame.
- Services import each other by specific module path, never through a barrel.
