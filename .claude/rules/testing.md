---
paths:
  - "**/*.{test,spec}.{ts,tsx}"
  - "src/test/**"
---

# Testing

Vitest with jsdom environment. Tests live alongside source files; the include glob is `**/*.{test,spec}.{ts,tsx}`.

### In-memory Prisma

Tests use `prisma-mock` (not `prismock` — that library is unmaintained and incompatible with Prisma 7). A thin wrapper in `src/test/create-prisma-mock.ts` hides the messy Prisma 7 API:

```ts
import { createMockPrisma } from "@/test/create-prisma-mock";

const db = createMockPrisma(); // fresh in-memory PrismaClient
```

`prisma-mock` requires schema metadata at runtime. A generator in `prisma/schema.prisma` outputs `src/generated/dmmf.ts` — never edit it manually; regenerate with `npx prisma generate` after schema changes.

### tRPC router tests

Use `router.createCaller(ctx)` to call procedures directly. Build the context with `createAuthenticatedMockContext` from `src/test/trpc-helpers.ts`:

```ts
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { myRouter } from "./my-router";

const ctx = createAuthenticatedMockContext({
  user: { id: nanoId16() }, // required
  permissions: { thing: ["create"] }, // defaults to {}
  prisma: db, // required — inject the mock db
});
const caller = myRouter.createCaller(ctx);
```

**Fixture IDs**: use the `.create()` factory on branded ID types instead of casting — `PersonId.create()`, `TeamId.create()`, `SkillId.create()`, etc. Use plain `nanoId16()` only for unbranded string IDs.

**Dataset structure**: seed a single shared dataset in `beforeAll` scoped inside the outer `describe`, then write each test as an assertion about the correct slice of that data. Only use `beforeEach` seeding when tests genuinely need isolated state.

```ts
describe("myRouter.someQuery", () => {
    const T = { org: OrganizationId.create(), person1: PersonId.create(), ... };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({ data: { id: T.org, ... } });
        // seed all fixtures once
    });

    function makeCaller() {
        return myRouter.createCaller(createAuthenticatedMockContext({ ..., prisma: db }));
    }

    it("returns ...", async () => { ... });
});
```

**`server-only` constraint**: `@/server/auth`, `@/server/prisma`, and anything that imports them will throw in the jsdom test environment. Never import them in test files or router files. `@/trpc/init.ts` is safe because it uses `import type` for server-only deps.
