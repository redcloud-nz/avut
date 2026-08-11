# Calling tRPC from Server Components — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let server components prefetch tRPC queries into a request-scoped React Query cache, delete the parallel server fetch modules, and render permission failures consistently from both the server and the client.

**Architecture:** A new `src/trpc/server.tsx` exposes a server-side tRPC proxy that calls the router in-process (no HTTP, so cookies are inherited), a request-scoped query client via React `cache`, a fire-and-forget `prefetch`, and a `HydrateClient` boundary. Pages become thin server shells that resolve params, gate access, prefetch, and hydrate; their bodies move to sibling client `content.tsx` files. Permission failures use Next's `forbidden()` interrupt on the server and a shared `describeError` mapper on the client, both rendering the same panel.

**Tech Stack:** Next.js 16.2.1 (App Router, `cacheComponents`, typed routes), React 19, tRPC 11, TanStack React Query 5, Better Auth, Prisma 7, Vitest + jsdom, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-12-trpc-from-server-components-design.md`

## Global Constraints

- Package manager is **npm**. Never run `yarn` or `pnpm`.
- Typecheck with `npx tsc --noEmit`. Tests with `npm run test:run` (single run — `npm run test` is watch mode).
- **Do not hand-format.** A husky + lint-staged pre-commit hook runs `prettier --write`. Write code in roughly the house style and let the hook settle it.
- Every new source file starts with the project copyright header:
  ```
  /*
   *  Copyright (c) 2026 A.V.U.T. Project.
   *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
   */
  ```
  Page and layout files add a ` * Path: /orgs/[slug]/…` line, matching the existing files being edited.
- Procedures within a tRPC router must stay in **alphabetical order**.
- New record IDs use `nanoId16()` from `@/lib/id`. Test fixture IDs use the branded `.create()` factories (`TeamId.create()`, `PersonId.create()`, …).
- `@/server/auth`, `@/server/prisma` and anything importing them throw under jsdom. Test files that transitively reach them must `vi.mock("server-only", () => ({}))` first — see `src/trpc/routers/users-router.test.ts` for the established pattern.
- Dynamic route strings use `route()` from `@/lib/routes`; static ones are plain strings.
- Commit after each task. Commit directly to `master` — this repo uses no feature branches.

## Task Order and Dependencies

```
1 (context)  →  5 (server.tsx)  →  6 (session hoist)  →  8, 9, 10 (pilots)
2 (formatter) ─┐
3 (describeError) → 4 (forbidden interrupt)
7 (getTeam procedure) → 8 (teams pilot)
```

Tasks 1, 2, 3 and 7 are independent of each other and may be done in any order.

---

### Task 1: Extract the tRPC context

Lifts `createTrpcContext` out of the route handler so server components can share it. Pure move — no behaviour change.

**Files:**

- Create: `src/server/trpc-context.ts`
- Modify: `src/app/trpc/[trpc]/route.ts`

**Interfaces:**

- Consumes: `createInnerTrpcContext` and `assertHasPermissionResult` (already exist).
- Produces: `createTrpcContext: () => Promise<Context>` — a React-`cache`d async factory. Task 5 passes it to `createTRPCOptionsProxy` as `ctx`.

- [ ] **Step 1: Create the context module**

`src/server/trpc-context.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { headers as nextHeaders } from "next/headers";
import { cache } from "react";

import { TRPCError } from "@trpc/server";

import { auth } from "@/server/auth";
import { createInnerTrpcContext } from "@/trpc/init";
import { assertHasPermissionResult } from "@/trpc/permissions";

/**
 * Build the tRPC context for the current request.
 *
 * React `cache` holds it to a single session lookup per request, whether the caller is the
 * HTTP handler or a server component prefetching through `@/trpc/server`.
 */
export const createTrpcContext = cache(async () => {
  const headers = await nextHeaders();

  const authSession = await auth.api.getSession({ headers });

  return createInnerTrpcContext({
    auth: authSession,
    hasPermission: async (organizationId, requiredPermissions) => {
      let result;
      try {
        result = await auth.api.hasPermission({
          headers,
          body: { organizationId, permissions: requiredPermissions },
        });
      } catch (error) {
        // Better Auth throws UNAUTHORIZED when the user is not a member of the
        // organization at all.
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization.",
          cause: error,
        });
      }

      // ...and returns `{ success: false }` when they are a member but lack the
      // permission. Both have to be checked.
      assertHasPermissionResult(result, requiredPermissions);
    },
    headers,
  });
});
```

- [ ] **Step 2: Reduce the route handler to the handler**

Replace the whole of `src/app/trpc/[trpc]/route.ts` with:

```ts
/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createTrpcContext } from "@/server/trpc-context";
import { appRouter } from "@/trpc/routers/_app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/trpc",
    req,
    router: appRouter,
    createContext: createTrpcContext,
    onError({ error, type, path }) {
      console.error(`tRPC error on ${type} procedure at ${path}:`, error);
    },
  });
export { handler as GET, handler as POST };
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 4: Run the test suite**

Run: `npm run test:run`
Expected: all tests pass. Nothing here is covered by tests; this confirms nothing broke.

- [ ] **Step 5: Commit**

```bash
git add src/server/trpc-context.ts src/app/trpc/\[trpc\]/route.ts
git commit -m "Extract the tRPC context so server components can share it"
```

---

### Task 2: Make the tRPC error formatter testable and fix `data`

The current formatter spreads the whole error _shape_ into `data`, which replaces the string error code with tRPC's numeric one and buries `data.code` at `data.data.code`. Task 3's client mapper depends on `data.code` being the string.

**Files:**

- Create: `src/trpc/error-formatter.ts`
- Create: `src/trpc/error-formatter.test.ts`
- Modify: `src/trpc/init.ts:48-63`

**Interfaces:**

- Consumes: `FieldConflictError` from `src/trpc/errors.ts` — constructor is `(fieldName: string, message?: string)`, with a readonly `fieldName` field.
- Produces: `formatTrpcError({ shape, error })`, returning `{ ...shape, cause, data: { ...shape.data, conflict } }`. Task 3 relies on the resulting `data.code` being the string tRPC code (`"FORBIDDEN"`, `"NOT_FOUND"`, `"UNAUTHORIZED"`, …).

- [ ] **Step 1: Write the failing test**

`src/trpc/error-formatter.test.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { formatTrpcError } from "./error-formatter";
import { FieldConflictError } from "./errors";

const forbiddenShape = {
  message: 'Insufficient permissions. Action requires: {"person":["view"]}',
  code: -32603,
  data: { code: "FORBIDDEN", httpStatus: 403, path: "personnel.getPerson" },
};

describe("formatTrpcError", () => {
  // The client error mapper keys off `data.code`. Spreading the whole shape into `data`
  // — as the original formatter did — replaces the string code with tRPC's numeric one
  // and pushes the string down to `data.data.code`, where nothing looks for it.
  it("preserves the string error code at data.code", () => {
    const result = formatTrpcError({ shape: forbiddenShape, error: { code: "FORBIDDEN" } });

    expect(result.data.code).toBe("FORBIDDEN");
    expect(result.data.httpStatus).toBe(403);
  });

  it("attaches conflict details for a CONFLICT caused by a FieldConflictError", () => {
    const cause = new FieldConflictError("email", "That email is already in use.");

    const result = formatTrpcError({
      shape: { message: "conflict", code: -32603, data: { code: "CONFLICT" } },
      error: { code: "CONFLICT", cause },
    });

    expect(result.data.conflict).toEqual({
      fieldName: "email",
      message: "That email is already in use.",
    });
  });

  it("leaves conflict undefined when the error is not a field conflict", () => {
    const result = formatTrpcError({ shape: forbiddenShape, error: { code: "FORBIDDEN" } });

    expect(result.data.conflict).toBeUndefined();
  });

  // A CONFLICT raised without a FieldConflictError cause has no field to report.
  it("leaves conflict undefined for a CONFLICT with an unrelated cause", () => {
    const result = formatTrpcError({
      shape: { message: "conflict", code: -32603, data: { code: "CONFLICT" } },
      error: { code: "CONFLICT", cause: new Error("something else") },
    });

    expect(result.data.conflict).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/trpc/error-formatter.test.ts`
Expected: FAIL — cannot resolve `./error-formatter`.

- [ ] **Step 3: Write the formatter**

`src/trpc/error-formatter.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { FieldConflictError } from "./errors";

/** The parts of tRPC's default error shape this formatter reads. */
export interface TrpcErrorShape {
  message: string;
  code: number;
  data: Record<string, unknown>;
}

/**
 * Extend tRPC's default error shape with structured field-conflict details.
 *
 * Lives outside `init.ts` so it can be tested without standing up a router.
 *
 * Note the `data` spread: it merges into `shape.data`, *not* `shape`. Spreading the whole
 * shape would overwrite `data.code` — the string tRPC code the client error mapper reads —
 * with the numeric JSON-RPC code.
 */
export function formatTrpcError<TShape extends TrpcErrorShape>({
  shape,
  error,
}: {
  shape: TShape;
  error: { code?: string; cause?: unknown };
}) {
  const conflict =
    error.code == "CONFLICT" && error.cause instanceof FieldConflictError
      ? { fieldName: error.cause.fieldName, message: error.cause.message }
      : undefined;

  return {
    ...shape,
    cause: error.cause,
    data: {
      ...shape.data,
      conflict,
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/trpc/error-formatter.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Wire it into `init.ts`**

In `src/trpc/init.ts`, add the import alongside the existing `FieldConflictError` import:

```ts
import { formatTrpcError } from "./error-formatter";
```

Replace the `errorFormatter` block (currently lines 48–63) so `create` reads:

```ts
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => formatTrpcError({ shape, error }),
});
```

`FieldConflictError` is no longer referenced in `init.ts` — remove its import (line 18) if nothing else in the file uses it. Check with `grep -n "FieldConflictError" src/trpc/init.ts` before removing.

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: exit 0; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/trpc/error-formatter.ts src/trpc/error-formatter.test.ts src/trpc/init.ts
git commit -m "Stop the tRPC error formatter clobbering data.code"
```

---

### Task 3: Shared error descriptions and client mapper

One place holds the wording for permission, not-found and signed-out failures, so the server `forbidden()` boundary (Task 4) and the client error boundary render the same thing.

`describeError` lives in its own module with no React imports, so tests don't drag in `next/image` via the Artie component.

**Files:**

- Create: `src/components/errors/describe-error.ts`
- Create: `src/components/errors/describe-error.test.ts`
- Create: `src/components/errors/app-error.tsx`
- Modify: `src/components/art/artie.tsx:9` (export the `ArtiePose` type)

**Interfaces:**

- Consumes: `ArtiePose` from `@/components/art/artie` (needs exporting); `Empty`, `EmptyContent`, `EmptyDescription`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle` from `@/components/ui/empty`; `Button` from `@/components/ui/button`.
- Produces:
  - `interface ErrorDescription { title: string; description: string; pose: ArtiePose }`
  - `ErrorDescriptions` — `{ Forbidden, NotFound, Unauthorized }`, each an `ErrorDescription`. Task 4 renders `ErrorDescriptions.Forbidden`.
  - `describeError(error: unknown): ErrorDescription`
  - `<AppErrorPanel {...ErrorDescription} />` — presentational, used by Task 4's `forbidden.tsx`.
  - `<AppError error={Error} />` — logs then renders `AppErrorPanel` from `describeError`. Used by Task 4's error boundaries.

- [ ] **Step 1: Export the `ArtiePose` type**

In `src/components/art/artie.tsx` line 9, change `type ArtiePose =` to `export type ArtiePose =`.

- [ ] **Step 2: Write the failing test**

`src/components/errors/describe-error.test.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { TRPCClientError } from "@trpc/client";

import { describeError, ErrorDescriptions } from "./describe-error";

/**
 * Build a TRPCClientError the way the httpBatchLink does — from a JSON-RPC error response.
 * `data.code` is the string code, which is what `describeError` keys off.
 */
function trpcError(code: string, message = "boom") {
  return TRPCClientError.from({
    error: { message, code: -32603, data: { code, httpStatus: 403 } },
  });
}

describe("describeError", () => {
  it("maps FORBIDDEN to the permission description", () => {
    expect(describeError(trpcError("FORBIDDEN"))).toEqual(ErrorDescriptions.Forbidden);
  });

  it("maps NOT_FOUND to the not-found description", () => {
    expect(describeError(trpcError("NOT_FOUND"))).toEqual(ErrorDescriptions.NotFound);
  });

  it("maps UNAUTHORIZED to the signed-out description", () => {
    expect(describeError(trpcError("UNAUTHORIZED"))).toEqual(ErrorDescriptions.Unauthorized);
  });

  it("falls back to the error's own name and message", () => {
    const result = describeError(new TypeError("x is not a function"));

    expect(result).toEqual({
      title: "TypeError",
      description: "x is not a function",
      pose: "Error",
    });
  });

  // Next strips server-component error messages in production, leaving an empty string.
  it("supplies generic copy when the message is empty", () => {
    const result = describeError(new Error(""));

    expect(result.title).toBe("Error");
    expect(result.description).toBe("An unexpected error occurred.");
    expect(result.pose).toBe("Error");
  });

  it("handles a thrown non-Error", () => {
    const result = describeError("just a string");

    expect(result).toEqual({
      title: "Error",
      description: "An unexpected error occurred.",
      pose: "Error",
    });
  });

  // An unrecognised tRPC code is not special — it gets the generic treatment.
  it("falls back for an unmapped tRPC code", () => {
    expect(describeError(trpcError("INTERNAL_SERVER_ERROR", "db down")).description).toBe(
      "db down",
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/errors/describe-error.test.ts`
Expected: FAIL — cannot resolve `./describe-error`.

- [ ] **Step 4: Write the mapper**

`src/components/errors/describe-error.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { TRPCClientError } from "@trpc/client";

import type { ArtiePose } from "@/components/art/artie";

export interface ErrorDescription {
  title: string;
  description: string;
  pose: ArtiePose;
}

/**
 * The fixed descriptions, shared by the client mapper below and the server-side
 * `forbidden()` boundary, so both paths read identically to the user.
 */
export const ErrorDescriptions = {
  Forbidden: {
    title: "Not permitted",
    description:
      "You do not have permission to view this. Ask an organization administrator if you think that's wrong.",
    pose: "NotAllowed",
  },
  NotFound: {
    title: "Not found",
    description:
      "The resource you requested was not found. Have you tried looking under the couch?",
    pose: "NotFound",
  },
  Unauthorized: {
    title: "Signed out",
    description: "Your session has expired. Sign in again to continue.",
    pose: "Login",
  },
} as const satisfies Record<string, ErrorDescription>;

/** Read tRPC's string error code off a client error, if this is one. */
function trpcErrorCode(error: unknown): string | undefined {
  if (!(error instanceof TRPCClientError)) return undefined;

  const data: unknown = error.data;
  if (typeof data !== "object" || data === null) return undefined;

  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Describe a *client-side* error for display.
 *
 * Deliberately does not test for server error classes: Next serialises errors thrown in
 * server components across the RSC boundary with the class dropped and, in production, the
 * message replaced. Server-side permission failures use `forbidden()` instead, which
 * reaches its own boundary with the description intact.
 */
export function describeError(error: unknown): ErrorDescription {
  switch (trpcErrorCode(error)) {
    case "FORBIDDEN":
      return ErrorDescriptions.Forbidden;
    case "NOT_FOUND":
      return ErrorDescriptions.NotFound;
    case "UNAUTHORIZED":
      return ErrorDescriptions.Unauthorized;
  }

  return {
    title: error instanceof Error ? error.name : "Error",
    description: (error instanceof Error ? error.message : "") || "An unexpected error occurred.",
    pose: "Error",
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/errors/describe-error.test.ts`
Expected: 7 passed.

- [ ] **Step 6: Write the panel component**

`src/components/errors/app-error.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useEffect } from "react";

import Artie from "@/components/art/artie";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { describeError, type ErrorDescription } from "./describe-error";

/** The full-height error panel. Rendered directly by the server-side `forbidden` boundary. */
export function AppErrorPanel({ title, description, pose }: ErrorDescription) {
  return (
    <div className="w-full h-screen flex flex-col justify-center md:items-center gap-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <Artie pose={pose} />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link href="/">Home Page</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

/** The panel driven by a caught error. Used by every `error.tsx` boundary. */
export function AppError({ error }: { error: Error }) {
  useEffect(() => {
    console.error("Error occurred:", error);
  }, [error]);

  return <AppErrorPanel {...describeError(error)} />;
}
```

- [ ] **Step 7: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: exit 0; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/errors src/components/art/artie.tsx
git commit -m "Add a shared error description mapper and panel"
```

---

### Task 4: Route server permission failures through `forbidden()`

`assertPermission` currently throws `ForbiddenError`. Because Next strips the class and (in production) the message when serialising a server-component error, that message never reaches the user. Next's `forbidden()` interrupt reaches a real boundary instead.

**Files:**

- Modify: `next.config.ts`
- Modify: `src/server/organization-access.ts:34-55`
- Modify: `src/lib/errors.ts` (delete `ForbiddenError`)
- Create: `src/app/forbidden.tsx`
- Modify: `src/app/error.tsx`
- Create: `src/app/(authenticated)/orgs/[slug]/error.tsx`

**Interfaces:**

- Consumes: `AppError`, `AppErrorPanel`, `ErrorDescriptions` from Task 3.
- Produces: no new exports. `assertPermission` keeps its signature `(organizationId, permissions) => Promise<void>` but now never returns on denial.

- [ ] **Step 1: Enable the experimental flag**

In `next.config.ts`, add `experimental` to the `nextConfig` object, keeping the existing keys:

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: appMetadata?.version,
    NEXT_PUBLIC_APP_VERSION_NAME: appMetadata?.versionName,
    NEXT_PUBLIC_APP_DISPLAY_NAME: appMetadata?.displayName,
    NEXT_PUBLIC_APP_REPOSITORY_URL: appMetadata?.repositoryUrl,
  },
  experimental: {
    // Enables `forbidden()` / `forbidden.tsx`. Server-thrown errors lose their class
    // and message across the RSC boundary, so an interrupt is the only way a
    // permission failure can carry its own copy into production.
    authInterrupts: true,
  },
  typedRoutes: true,
};
```

- [ ] **Step 2: Switch `assertPermission` to the interrupt**

In `src/server/organization-access.ts`:

Add `forbidden` to the imports from `next/navigation` (the file does not currently import from it, so add a new import line):

```ts
import { forbidden } from "next/navigation";
```

Remove the now-unused `ForbiddenError` import (`import { ForbiddenError } from "@/lib/errors";`).

Replace the body of `assertPermission` — keeping the surrounding doc comment, but updating its last paragraph — so it reads:

```ts
/**
 * Assert that the current user holds `permissions` within `organizationId`.
 *
 * Better Auth signals denial two different ways, and both have to be handled: it *throws*
 * UNAUTHORIZED when the user is not a member of the organization at all, and it *returns*
 * `{ success: false }` when they are a member but lack the permission. Checking only the
 * throw silently grants every permission to every member.
 *
 * Denial raises Next's `forbidden()` interrupt rather than throwing. A thrown error would
 * reach the client error boundary with its class dropped and, in production, its message
 * replaced — so the reason would never be shown.
 */
export async function assertPermission(
  organizationId: OrganizationId,
  permissions: Permissions,
): Promise<void> {
  let granted: boolean;

  try {
    const result = await auth.api.hasPermission({
      headers: await nextHeaders(),
      body: { organizationId, permissions },
    });
    granted = result.success;
  } catch {
    // Not a member of the organization at all.
    forbidden();
  }

  if (!granted) forbidden();
}
```

- [ ] **Step 3: Delete the now-unused error class**

Confirm nothing else references it:

Run: `grep -rn "ForbiddenError" src/`
Expected: only `src/lib/errors.ts`.

Then delete the `ForbiddenError` class and its doc comment from `src/lib/errors.ts`, leaving `NotConfiguredError` and `InvalidD4HAccessTokenError` in place.

- [ ] **Step 4: Add the forbidden boundary**

`src/app/forbidden.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import { AppErrorPanel } from "@/components/errors/app-error";
import { ErrorDescriptions } from "@/components/errors/describe-error";

export default function Root_Forbidden() {
  return <AppErrorPanel {...ErrorDescriptions.Forbidden} />;
}
```

- [ ] **Step 5: Point the error boundaries at the shared panel**

Replace the whole of `src/app/error.tsx` with:

```tsx
/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */
"use client";

import { AppError } from "@/components/errors/app-error";

export default function Root_Error({ error }: { error: Error } & { digest?: string }) {
  return <AppError error={error} />;
}
```

Create `src/app/(authenticated)/orgs/[slug]/error.tsx` so a module-level failure does not replace the whole shell:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */
"use client";

import { AppError } from "@/components/errors/app-error";

export default function Organization_Error({ error }: { error: Error } & { digest?: string }) {
  return <AppError error={error} />;
}
```

- [ ] **Step 6: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: exit 0; all tests pass.

- [ ] **Step 7: Verify the interrupt renders**

Run: `npm run dev`

Sign in and open an org page you have access to — it must render normally, proving `authInterrupts` did not break the happy path. Then confirm the flag is active by checking the dev server started without an "Unrecognized key" warning for `experimental.authInterrupts`.

Stop the dev server when done.

- [ ] **Step 8: Commit**

```bash
git add next.config.ts src/server/organization-access.ts src/lib/errors.ts src/app/forbidden.tsx src/app/error.tsx "src/app/(authenticated)/orgs/[slug]/error.tsx"
git commit -m "Render server permission failures through Next's forbidden interrupt"
```

---

### Task 5: The server-side tRPC entry point

The core of the change: a proxy that calls the router in-process, a request-scoped query client, `prefetch` and `HydrateClient`.

**Files:**

- Create: `src/trpc/server.tsx`

**Interfaces:**

- Consumes: `createTrpcContext` (Task 1); `makeQueryClient` from `./query-client`; `appRouter` from `./routers/_app`.
- Produces:
  - `getServerQueryClient(): QueryClient` — request-scoped.
  - `trpc` — server tRPC options proxy. `trpc.<router>.<procedure>.queryOptions(input)` produces the same query keys as the client proxy in `@/trpc/client`.
  - `prefetch(queryOptions)` — fire-and-forget, never throws.
  - `<HydrateClient>{children}</HydrateClient>`.

  Tasks 6, 8, 9 and 10 all import from here. The exact generic signature below is verified to typecheck against `trpc.personnel.getPerson.queryOptions(...)`.

- [ ] **Step 1: Create the module**

`src/trpc/server.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cache, type ReactNode } from "react";

import {
  dehydrate,
  HydrationBoundary,
  type FetchQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { createTrpcContext } from "@/server/trpc-context";

import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

/**
 * The request-scoped query client for server components.
 *
 * React `cache` is the whole trick: a page's `prefetch` and the `HydrateClient` that
 * dehydrates it have to be handed the same instance, or the payload ships empty.
 *
 * Distinct from `getQueryClient` in `@/trpc/client`, which is the browser singleton (and a
 * fresh instance per SSR render). Do not swap one for the other.
 */
export const getServerQueryClient = cache(makeQueryClient);

/**
 * Server-side tRPC proxy.
 *
 * Calls the router in-process rather than over HTTP, so the request's cookies come from
 * `next/headers` instead of being dropped by a loopback fetch. Query keys match those the
 * client proxy produces, which is what lets a prefetch here satisfy a `useSuspenseQuery`
 * there.
 *
 * Never use the `trpc` export from `@/trpc/client` in a server component — its `queryFn`
 * goes back over HTTP unauthenticated.
 */
export const trpc = createTRPCOptionsProxy({
  ctx: createTrpcContext,
  router: appRouter,
  queryClient: getServerQueryClient,
});

/**
 * Warm the request-scoped cache.
 *
 * Deliberately not awaited, and never throws: server render does not block on it, and a
 * failure surfaces on the client where `describeError` renders it. When a server component
 * actually needs the value — a page title, a breadcrumb — call
 * `getServerQueryClient().fetchQuery(...)` instead, which awaits and throws.
 */
export function prefetch<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  queryOptions: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
) {
  void getServerQueryClient().prefetchQuery(queryOptions);
}

/**
 * Dehydrate whatever the request-scoped client holds into a boundary the client picks up.
 *
 * Nesting is additive and safe. Note that in RSC a layout's body runs before its page's
 * body, so a `HydrateClient` in a layout captures only what that layout prefetched — a page
 * that prefetches needs its own.
 */
export function HydrateClient({ children }: { children: ReactNode }) {
  return (
    <HydrationBoundary state={dehydrate(getServerQueryClient())}>{children}</HydrationBoundary>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

There is no unit test for this module: it imports `server-only`, and React `cache` has no meaningful behaviour outside a request scope. Tasks 8–10 are its verification.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/server.tsx
git commit -m "Add the server-side tRPC proxy, prefetch and HydrateClient"
```

---

### Task 6: Hoist session hydration to the authenticated layout

Seeds the session once for every authenticated route instead of eight times across module layouts.

**Files:**

- Modify: `src/app/(authenticated)/layout.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/admin/layout.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/layout.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/i3/layout.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/notes/layout.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-package-builder/layout.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/d4h-views/layout.tsx`
- Modify: `src/app/(authenticated)/user-settings/page.tsx`
- Modify: `src/app/(authenticated)/@modal/(.)user-settings/page.tsx`
- Delete: `src/components/auth/session-hydration.tsx`

**Interfaces:**

- Consumes: `getServerQueryClient`, `HydrateClient` (Task 5); `ensureSession` from `@/server/auth-queries`; `requireSession` from `@/server/session`.
- Produces: nothing new. `SessionHydration` ceases to exist.

- [ ] **Step 1: Seed the session at the authenticated layout**

Replace the whole of `src/app/(authenticated)/layout.tsx` with:

```tsx
/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import { ReactNode } from "react";

import { ensureSession } from "@/server/auth-queries";
import { requireSession } from "@/server/session";
import { getServerQueryClient, HydrateClient } from "@/trpc/server";

export default async function AuthenticatedLayout(props: {
  modal: ReactNode;
  children: ReactNode;
}) {
  // Baseline guard for every authenticated route. The proxy only checks that a session
  // cookie is *present*; this is the check that actually validates it.
  await requireSession();

  // Seed the session into the request-scoped cache once, here, so every client
  // `useSession()` below renders it on first paint with no fetch on mount.
  await ensureSession(getServerQueryClient());

  return (
    <HydrateClient>
      {props.modal}
      {props.children}
    </HydrateClient>
  );
}
```

- [ ] **Step 2: Remove the per-module wrappers**

In each of these six module layouts, delete the `SessionHydration` import and unwrap its children, leaving the rest of the JSX intact:

- `src/app/(authenticated)/orgs/[slug]/admin/layout.tsx`
- `src/app/(authenticated)/orgs/[slug]/skill-track/layout.tsx`
- `src/app/(authenticated)/orgs/[slug]/i3/layout.tsx`
- `src/app/(authenticated)/orgs/[slug]/notes/layout.tsx`
- `src/app/(authenticated)/orgs/[slug]/skill-package-builder/layout.tsx`
- `src/app/(authenticated)/orgs/[slug]/d4h-views/layout.tsx`

For example, `admin/layout.tsx` becomes:

```tsx
export default async function Admin_Layout(props: LayoutProps<"/orgs/[slug]/admin">) {
  const { slug } = await props.params;
  await requireOrganization(slug);

  return (
    <>
      <ModuleSidebar scope="organization">
        <Admin_Sidebar_Menu />
      </ModuleSidebar>
      {props.children}
    </>
  );
}
```

Do the same in `src/app/(authenticated)/user-settings/page.tsx` and
`src/app/(authenticated)/@modal/(.)user-settings/page.tsx` — remove the import and unwrap,
using a `<>…</>` fragment where the wrapper was the only root element.

- [ ] **Step 3: Delete the component and confirm no references remain**

```bash
rm src/components/auth/session-hydration.tsx
grep -rn "SessionHydration" src/
```

Expected: no output from `grep`.

- [ ] **Step 4: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: exit 0; all tests pass.

- [ ] **Step 5: Verify hydration still works in the browser**

Run: `npm run dev`

Open an org page, e.g. `/orgs/<your-slug>/admin`. In DevTools → Network, filter to `trpc`.

Expected: the user menu shows the signed-in user's name **on first paint** — no spinner, no name appearing a beat later — and there is no session request on load. That is the whole point of the hoist; if the name flashes in, the boundary is in the wrong place.

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add -A src/app src/components/auth
git commit -m "Seed the session once at the authenticated layout"
```

---

### Task 7: Add a `teams.getTeam` procedure

`teams-router.ts` has a private `getTeam` helper but no public query. The teams pilot needs one.

**Files:**

- Modify: `src/trpc/routers/teams-router.ts`
- Create: `src/trpc/routers/teams-router.test.ts`

**Interfaces:**

- Consumes: the module-private `getTeam(ctx, teamId): Promise<TeamData | null>` helper at `teams-router.ts:763`; `Messages.teamNotFound(teamId)`.
- Produces: `teams.getTeam({ organizationId, teamId }) => TeamData`, permission `{ team: ["view"] }`, throwing `TRPCError(NOT_FOUND)` when absent. Task 8 prefetches it.

- [ ] **Step 1: Write the failing test**

`src/trpc/routers/teams-router.test.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

// teams-router reaches @/server/auth and @/server/team at import time. The procedures
// under test only touch ctx.prisma (the injected mock), so stubbing is enough to let the
// module load under jsdom.
vi.mock("server-only", () => ({}));
vi.mock("@/server/team", () => ({ revalidateTeam: () => {} }));

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { TeamId } from "@/lib/schemas/team";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { teamsRouter } from "./teams-router";

describe("teamsRouter.getTeam", () => {
  const T = {
    org: OrganizationId.create(),
    otherOrg: OrganizationId.create(),
    team: TeamId.create(),
    otherOrgTeam: TeamId.create(),
    user: nanoId16(),
  };

  const db = createMockPrisma();

  beforeAll(async () => {
    // `Organization.createdAt` has no schema default — prisma-mock requires it.
    await db.organization.create({
      data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
    });
    await db.organization.create({
      data: { id: T.otherOrg, name: "Other", slug: "other", createdAt: new Date() },
    });
    await db.team.create({
      data: { id: T.team, organizationId: T.org, name: "Alpha", description: "First team" },
    });
    await db.team.create({
      data: { id: T.otherOrgTeam, organizationId: T.otherOrg, name: "Bravo" },
    });
  });

  function makeCaller() {
    return teamsRouter.createCaller(
      createAuthenticatedMockContext({
        user: { id: T.user },
        permissions: { team: ["view"] },
        prisma: db,
      }),
    );
  }

  it("returns the team", async () => {
    const team = await makeCaller().getTeam({ organizationId: T.org, teamId: T.team });

    expect(team.id).toBe(T.team);
    expect(team.name).toBe("Alpha");
    expect(team.d4h).toBeNull();
  });

  it("throws NOT_FOUND for an unknown team", async () => {
    await expect(
      makeCaller().getTeam({ organizationId: T.org, teamId: TeamId.create() }),
    ).rejects.toThrow(/not found/i);
  });

  // Organization scoping is the security boundary — a valid team id from another org
  // must not resolve.
  it("throws NOT_FOUND for a team in another organization", async () => {
    await expect(
      makeCaller().getTeam({ organizationId: T.org, teamId: T.otherOrgTeam }),
    ).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/trpc/routers/teams-router.test.ts`
Expected: FAIL — `getTeam` is not a function on the caller.

- [ ] **Step 3: Add the procedure**

In `src/trpc/routers/teams-router.ts`, insert this into the `createTrpcRouter({...})` object in **alphabetical position** among the procedure keys (run `grep -n "^    [a-zA-Z]*:" src/trpc/routers/teams-router.ts` to see the current ordering and place it correctly):

```ts
    /**
     * Get a team by ID.
     * @param teamId The ID of the team to retrieve.
     * @returns The team.
     * @throws TRPCError(NOT_FOUND) if the team does not exist within the organization.
     */
    getTeam: organizationProcedure({ team: ["view"] })
        .input(z.object({ teamId: TeamId.schema }))
        .output(TeamData.schema)
        .query(async ({ ctx, input: { teamId } }) => {
            // `getTeam` here is the module-scoped helper below, not this procedure —
            // object keys are not in lexical scope.
            const team = await getTeam(ctx, teamId);

            if (!team) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamNotFound(teamId),
                });
            }

            return team;
        }),
```

`TeamId`, `TeamData`, `TRPCError` and `Messages` are already imported in this file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/trpc/routers/teams-router.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: exit 0; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/trpc/routers/teams-router.ts src/trpc/routers/teams-router.test.ts
git commit -m "Add a teams.getTeam procedure"
```

---

### Task 8: Pilot — `admin/teams/[team_id]`

Converts the first page to the prefetch pattern and removes `server/team.ts`.

**Files:**

- Modify: `src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/page.tsx`
- Create: `src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/layout.tsx`
- Modify: `src/trpc/routers/teams-router.ts` (drop `revalidateTeam`)
- Modify: `src/trpc/routers/teams-router.test.ts` (drop the now-dead mock)
- Delete: `src/server/team.ts`

**Interfaces:**

- Consumes: `teams.getTeam` (Task 7); `prefetch`, `HydrateClient`, `getServerQueryClient`, `trpc` (Task 5).
- Produces: `AdminModule_Team_Content({ slug, teamId }: { slug: string; teamId: TeamId })` — a client component. `slug` is needed for the breadcrumb `route()` calls; `teamId` for the query.

- [ ] **Step 1: Move the page body into a client component**

Create `content.tsx` in the same directory. Copy the `return (…);` block from `page.tsx` — lines 32–135, the whole `Std.SidebarInset` tree — and paste it as the new component's return, with these changes:

- Add `"use client";` after the copyright header.
- The component takes `{ slug, teamId }` as props rather than awaiting `props.params`.
- Replace the `await getTeamById(...)` call with a suspense query.
- Replace `const { organization } = await requireOrganization(slug)` with `const organization = useOrganization()` from `@/hooks/use-organization` — the `Protect` calls need `organization.id`.
- Keep every import the original body used (`Saratoga`, `Std`, `Protect`, `Card*`, `DL*`, `getD4HServer`, `route`, the three `@/components/admin/teams/*` components, `Button`, `ObjectIcons`).

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useOrganization } from "@/hooks/use-organization";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

// …plus every import the original page body used

export function AdminModule_Team_Content({ slug, teamId }: { slug: string; teamId: TeamId }) {
    const organization = useOrganization();

    const { data: team } = useSuspenseQuery(
        trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
    );

    return (
        // …the original JSX, unchanged
    );
}
```

Note this imports `trpc` from `@/trpc/client` — the client proxy — because this is a client component. Only `page.tsx` uses `@/trpc/server`.

- [ ] **Step 2: Reduce the page to a prefetching shell**

Replace the whole of `page.tsx` with:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]
 */

import { TeamId } from "@/lib/schemas/team";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { AdminModule_Team_Content } from "./content";

export default async function AdminModule_Team_Page(
  props: PageProps<`/orgs/[slug]/admin/teams/[team_id]`>,
) {
  const { slug, team_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const teamId = TeamId.schema.parse(team_id);

  prefetch(trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }));

  return (
    <HydrateClient>
      <AdminModule_Team_Content slug={slug} teamId={teamId} />
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Point the layout's metadata at the procedure**

In `layout.tsx`, replace the `generateMetadata` body so it reads through the same query options the page prefetches. Remove the `getOrganizationBySlug` and `getTeamById` imports.

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { TeamId } from "@/lib/schemas/team";
import { requireOrganization } from "@/server/organization-access";
import { getServerQueryClient, trpc } from "@/trpc/server";

// Reads through the same query options the page prefetches, so metadata and the page cost
// one database round trip between them. Unlike the previous unchecked lookup this runs the
// procedure's permission check and can therefore raise `forbidden()` — which is correct,
// and renders the same panel the layout's own guard would.
export async function generateMetadata(
  props: LayoutProps<`/orgs/[slug]/admin/teams/[team_id]`>,
): Promise<Metadata> {
  const { slug, team_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const team = await getServerQueryClient().fetchQuery(
    trpc.teams.getTeam.queryOptions({
      organizationId: organization.id,
      teamId: TeamId.schema.parse(team_id),
    }),
  );

  return {
    title: `${team.name} ${TITLE_SEPARATOR} Teams`,
  };
}

export default async function AdminModule_Team_Layout(
  props: LayoutProps<`/orgs/[slug]/admin/teams/[team_id]`>,
) {
  const { slug } = await props.params;
  await requireOrganization(slug);

  return <>{props.children}</>;
}
```

- [ ] **Step 4: Delete `server/team.ts` and its caller**

In `src/trpc/routers/teams-router.ts`, remove the `import { revalidateTeam } from "@/server/team";` line and the `await revalidateTeam(teamId);` call (around line 633).

In `src/trpc/routers/teams-router.test.ts`, remove the now-dead `vi.mock("@/server/team", …)` line. Keep `vi.mock("server-only", () => ({}))`.

Then:

```bash
rm src/server/team.ts
grep -rn "@/server/team" src/
```

Expected: no output from `grep`.

- [ ] **Step 5: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: exit 0; all tests pass, including `teams-router.test.ts`.

- [ ] **Step 6: Verify the prefetch actually lands**

Run: `npm run dev`

Open `/orgs/<slug>/admin/teams/<a real team id>`. In DevTools → Network, filter to `trpc`.

Expected:

- The team name and details are present in the **initial HTML** (check View Source, or disable JavaScript and reload) — not filled in after a fetch.
- **No** `teams.getTeam` request on load. If one appears, the prefetch and the hydration boundary are not sharing a query client.
- The browser tab title shows the team name.

Then check the permission path: sign in as a user without `team: ["view"]` (or temporarily change the procedure's permission to something the user lacks, e.g. `{ team: ["delete"] }`, reload, then change it back). Expected: the "Not permitted" panel, not a raw error message.

Stop the dev server when done.

- [ ] **Step 7: Commit**

```bash
git add -A "src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]" src/trpc/routers/teams-router.ts src/trpc/routers/teams-router.test.ts src/server/team.ts
git commit -m "Prefetch the team detail page and drop server/team"
```

---

### Task 9: Pilot — `admin/personnel/[person_id]`

This page is already a client component, so the work is adding the server shell around it.

**Files:**

- Create: `src/app/(authenticated)/orgs/[slug]/admin/personnel/[person_id]/content.tsx` (from the current `page.tsx`)
- Modify: `src/app/(authenticated)/orgs/[slug]/admin/personnel/[person_id]/page.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/admin/personnel/[person_id]/layout.tsx`
- Modify: `src/trpc/routers/personnel-router.ts` (drop `revalidatePerson`)
- Modify: `src/trpc/routers/users-router.test.ts` (drop the now-dead mock)
- Delete: `src/server/person.ts`

**Interfaces:**

- Consumes: `personnel.getPerson` and `personnel.getLinkedUser` (both exist); `prefetch`, `HydrateClient`, `getServerQueryClient`, `trpc` (Task 5).
- Produces: `AdminModule_Person_Content({ slug, personId })`.

- [ ] **Step 1: Move the existing client page to `content.tsx`**

```bash
git mv "src/app/(authenticated)/orgs/[slug]/admin/personnel/[person_id]/page.tsx" "src/app/(authenticated)/orgs/[slug]/admin/personnel/[person_id]/content.tsx"
```

Then edit `content.tsx`:

- Rename the component from `AdminModule_Person_Page` to `AdminModule_Person_Content` and change `export default function` to `export function`.
- Replace the props with `{ slug, personId }: { slug: string; personId: PersonId }`.
- Delete `const { slug, person_id } = use(props.params);` and the `use` import.
- In the `useSuspenseQueries` call, replace `personId: person_id` with `personId` in both query option objects.
- Add `import { PersonId } from "@/lib/schemas/person";`.

Everything else — the `Std`/`Saratoga` tree, the dialogs, the `Protect` blocks — is unchanged.

- [ ] **Step 2: Add the prefetching shell**

Create a new `page.tsx` in the same directory:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/personnel/[person_id]
 */

import { PersonId } from "@/lib/schemas/person";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { AdminModule_Person_Content } from "./content";

export default async function AdminModule_Person_Page(
  props: PageProps<`/orgs/[slug]/admin/personnel/[person_id]`>,
) {
  const { slug, person_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const personId = PersonId.schema.parse(person_id);
  const input = { organizationId: organization.id, personId };

  prefetch(trpc.personnel.getPerson.queryOptions(input));
  prefetch(trpc.personnel.getLinkedUser.queryOptions(input));

  return (
    <HydrateClient>
      <AdminModule_Person_Content slug={slug} personId={personId} />
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Point the layout's metadata at the procedure**

Replace `generateMetadata` in `layout.tsx`, dropping the `getOrganizationBySlug` and `getPersonById` imports:

```tsx
import { PersonId } from "@/lib/schemas/person";
import { requireOrganization } from "@/server/organization-access";
import { getServerQueryClient, trpc } from "@/trpc/server";

// Reads through the same query options the page prefetches, so metadata and the page cost
// one database round trip between them.
export async function generateMetadata(
  props: LayoutProps<`/orgs/[slug]/admin/personnel/[person_id]`>,
): Promise<Metadata> {
  const { slug, person_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const person = await getServerQueryClient().fetchQuery(
    trpc.personnel.getPerson.queryOptions({
      organizationId: organization.id,
      personId: PersonId.schema.parse(person_id),
    }),
  );

  return {
    title: `${person.name} ${TITLE_SEPARATOR} Personnel`,
  };
}
```

The default-exported `AdminModule_Person_Layout` is unchanged.

- [ ] **Step 4: Delete `server/person.ts` and its callers**

In `src/trpc/routers/personnel-router.ts`, remove the `import { revalidatePerson } from "@/server/person";` line (line 15) and all three `revalidatePerson(personId);` calls (around lines 66, 349 and 413).

In `src/trpc/routers/users-router.test.ts`, remove the `vi.mock("@/server/person", …)` line and the three-line comment above it explaining the stub. Keep `vi.mock("server-only", () => ({}))`.

Then:

```bash
rm src/server/person.ts
grep -rn "@/server/person" src/
```

Expected: no output from `grep`.

- [ ] **Step 5: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: exit 0; all tests pass, including `users-router.test.ts`.

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`

Open `/orgs/<slug>/admin/personnel/<a real person id>`. In DevTools → Network, filter to `trpc`.

Expected: the person's name and details are in the initial HTML; **no** `getPerson` or `getLinkedUser` request on load; the tab title shows the person's name. Confirm the team-memberships card in the secondary column still loads (it is a separate `Suspense` boundary and is _expected_ to fetch on the client — it is not prefetched).

Stop the dev server when done.

- [ ] **Step 7: Commit**

```bash
git add -A "src/app/(authenticated)/orgs/[slug]/admin/personnel/[person_id]" src/trpc/routers/personnel-router.ts src/trpc/routers/users-router.test.ts src/server/person.ts
git commit -m "Prefetch the person detail page and drop server/person"
```

---

### Task 10: Pilot — `skill-track/sessions/[session_id]`

The last conversion, and the last server module deletion.

**Files:**

- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/page.tsx`
- Create: `src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/layout.tsx`
- Modify: `src/trpc/routers/skills-router.ts` (drop `revalidateSkillCheckSession`)
- Delete: `src/server/skill-check-session.ts`

**Interfaces:**

- Consumes: `skills.getSession({ organizationId, skillCheckSessionId }) => SkillCheckSession`, permission `{ skillCheckSession: ["view"] }` — exists at `skills-router.ts:91`.
- Produces: `SkillTrack_Session_Content({ slug, skillCheckSessionId })`.

- [ ] **Step 1: Move the page body into a client component**

Create `content.tsx` in the same directory. Copy the `return (…);` block from `page.tsx` — lines 51–161, the whole `Std.SidebarInset` tree — and paste it as the new component's return, with these changes:

- `"use client";` after the copyright header.
- Props `{ slug, skillCheckSessionId }: { slug: string; skillCheckSessionId: SkillCheckSessionId }`.
- The `await getSkillCheckSessionById(...) ?? notFound()` replaced by a suspense query — the procedure already throws `NOT_FOUND`, so the `notFound()` fallback and the `next/navigation` import both go.
- `useOrganization()` in place of `requireOrganization` — `organization.id` is needed for the query input.
- **The body's `route()` calls pass `{ slug, session_id }`** (lines 81, 91, 104 and any others). There is no longer a `session_id` binding, so each becomes `{ slug, session_id: skillCheckSessionId }`. The branded id is a string, so it satisfies the route param type. Grep the pasted body for `session_id` and fix every occurrence — a missed one is a compile error, not a silent bug.
- Every other import the original body used, carried over unchanged.

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useOrganization } from "@/hooks/use-organization";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

// …plus every import the original page body used

export function SkillTrack_Session_Content({
    slug,
    skillCheckSessionId,
}: {
    slug: string;
    skillCheckSessionId: SkillCheckSessionId;
}) {
    const organization = useOrganization();

    const { data: session } = useSuspenseQuery(
        trpc.skills.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId,
        }),
    );

    return (
        // …the original JSX, unchanged
    );
}
```

`SkillCheckSessionId` comes from `@/lib/schemas/skill-check-session` — the same import `skills-router.ts:13` uses.

- [ ] **Step 2: Reduce the page to a prefetching shell**

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]
 */

import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { SkillTrack_Session_Content } from "./content";

export default async function SkillTrack_Session_Page(
  props: PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]">,
) {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

  prefetch(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );

  return (
    <HydrateClient>
      <SkillTrack_Session_Content slug={slug} skillCheckSessionId={skillCheckSessionId} />
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Point the layout's metadata at the procedure**

Replace `generateMetadata` in `layout.tsx`, dropping the `getOrganizationBySlug`, `getSkillCheckSessionById` and `notFound` imports:

```tsx
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { getServerQueryClient, trpc } from "@/trpc/server";

// Reads through the same query options the page prefetches, so metadata and the page cost
// one database round trip between them. The procedure throws NOT_FOUND itself, so the
// explicit notFound() fallback is gone.
export async function generateMetadata(
  props: LayoutProps<"/orgs/[slug]/skill-track/sessions/[session_id]">,
): Promise<Metadata> {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const session = await getServerQueryClient().fetchQuery(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId: SkillCheckSessionId.schema.parse(session_id),
    }),
  );

  return {
    title: `${session.name || `Session ${session.id}`} ${TITLE_SEPARATOR} Skills Module`,
  };
}
```

- [ ] **Step 4: Delete `server/skill-check-session.ts` and its caller**

In `src/trpc/routers/skills-router.ts`, remove the `import { revalidateSkillCheckSession } from "@/server/skill-check-session";` line (line 21) and the `await revalidateSkillCheckSession(skillCheckSessionId);` call (around line 665).

```bash
rm src/server/skill-check-session.ts
grep -rn "@/server/skill-check-session" src/
```

Expected: no output from `grep`.

- [ ] **Step 5: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: exit 0; all tests pass, including `skill-checks-router.test.ts`.

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`

Open `/orgs/<slug>/skill-track/sessions/<a real session id>`.

Expected: session name and details in the initial HTML; no `skills.getSession` request on load; tab title shows the session name.

Then visit the same URL with a made-up session id. Expected: the "Not found" panel from `ErrorDescriptions.NotFound` — confirming the procedure's `NOT_FOUND` reaches `describeError` through the client boundary.

Stop the dev server when done.

- [ ] **Step 7: Full verification and commit**

```bash
npm run lint
npx tsc --noEmit
npm run test:run
```

Expected: all three clean.

```bash
git add -A "src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]" src/trpc/routers/skills-router.ts src/server/skill-check-session.ts
git commit -m "Prefetch the session detail page and drop server/skill-check-session"
```

---

## Done When

- `src/server/person.ts`, `src/server/team.ts` and `src/server/skill-check-session.ts` no longer exist, and `grep -rn "@/server/\(person\|team\|skill-check-session\)" src/` returns nothing.
- `grep -rn "SessionHydration" src/` returns nothing.
- The three pilot routes render their primary data in the initial HTML with no tRPC request on load.
- A permission failure renders the "Not permitted" panel from both the server (`forbidden()`) and the client (`TRPCClientError`).
- `npm run lint`, `npx tsc --noEmit` and `npm run test:run` are all clean.
