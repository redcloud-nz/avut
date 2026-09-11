# Change Diff Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `src/lib/diff.ts` so every change it produces is a printable scalar leaf, no input value is ever silently dropped, and the `changes` payload has a zod schema.

**Architecture:** Replace the current recursion-with-branches differ (where the bugs live) with flatten-then-diff. A single flatten pass reduces each side to `[path, scalar-or-scalar-array]` leaves and is the only place type policy lives; the diff then compares two flat lists by path. Two change types (`obj_mask`, `arr_ord`) are hand-constructed by callers rather than produced by `diffObject`.

**Tech Stack:** TypeScript, zod 4, remeda, Vitest (jsdom), Prisma 7, tRPC 11.

**Spec:** [docs/superpowers/specs/2026-09-09-change-diff-rework-design.md](../specs/2026-09-09-change-diff-rework-design.md)

## Global Constraints

- Zod 4 syntax throughout (`z.object`, `z.discriminatedUnion`, `.parse`, `.safeParse`).
- Source files carry the existing copyright header — copy it verbatim from the file being modified.
- Formatting is handled by the husky + lint-staged pre-commit hook running `prettier --write`. Do not hand-format for style.
- Never edit `src/generated/` by hand.
- Tests live alongside source; run a single file with `npm run test:run -- <path>`.
- Type check with `npx tsc --noEmit`. If it fails inside `.next/types` with route errors unrelated to the change, run `npx next typegen` first.
- The production database is empty. No backfill, no data migration, no defensive handling of pre-existing rows.
- Per project convention, **stage changes and show the proposed commit message, then wait for a yes/no before running `git commit`.**

---

## Stage 1 — The library

### Task 1: Rewrite `src/lib/diff.ts`

**Files:**

- Modify: `src/lib/diff.ts` (full rewrite)
- Test: `src/lib/diff.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `type DiffValue = string | number | boolean | null`
  - `type DiffValues = DiffValue | DiffValue[]`
  - `type DiffInput = Record<string, unknown>`
  - `const DiffChange` with `DiffChange.schema` (a `z.discriminatedUnion` on `type`)
  - `type DiffChange` (inferred from the schema)
  - `class DiffValueError extends Error` with a `path: string[]` property
  - `function diffObject(a: DiffInput, b: DiffInput): DiffChange[]`

**Context:** `diffObject` has about thirty call sites across seven routers plus `src/server/organization-settings-store.ts`. The signature stays two-argument, and the input type _widens_ from `DiffableObject` to `Record<string, unknown>` — values are validated at runtime and throw, rather than being constrained by the type. That is deliberate: it is what lets a caller pass a raw Prisma record and get a correct entry (dates convert) instead of a compile error.

- [ ] **Step 1: Write the failing tests for the new behaviour**

Open `src/lib/diff.test.ts`. Keep every existing test **except** `"should handle null and undefined values"`, which pins behaviour being removed. Replace that one test with the version below, and append the rest.

Replace this existing test:

```ts
it("should handle null and undefined values", () => {
  const a = { value: null, missing: undefined };
  const b = { value: "hello", extra: null };

  const result = diffObject(a, b);
  expect(result).toHaveLength(3);
  // ...asserts obj_del with prev: undefined
});
```

with:

```ts
it("treats undefined as absent, not as a value", () => {
  const a = { value: null, missing: undefined };
  const b = { value: "hello", extra: null };

  const result = diffObject(a, b);
  expect(result).toHaveLength(2);
  expect(result).toContainEqual({
    path: ["value"],
    type: "obj_mod",
    prev: null,
    curr: "hello",
  });
  expect(result).toContainEqual({
    path: ["extra"],
    type: "obj_add",
    curr: null,
  });
});
```

Then append these tests inside the same `describe("diff", ...)` block:

```ts
it("converts Date values to ISO strings", () => {
  const a = { at: new Date("2020-01-01T00:00:00.000Z") };
  const b = { at: new Date("2021-01-01T00:00:00.000Z") };

  expect(diffObject(a, b)).toEqual([
    {
      path: ["at"],
      type: "obj_mod",
      prev: "2020-01-01T00:00:00.000Z",
      curr: "2021-01-01T00:00:00.000Z",
    },
  ]);
});

it("expands an added nested object into leaves", () => {
  const a = {};
  const b = { d4h: { categoryId: 12, kindTitle: "Helmet", requireSN: true } };

  const result = diffObject(a, b);
  expect(result).toHaveLength(3);
  expect(result).toContainEqual({
    path: ["d4h", "categoryId"],
    type: "obj_add",
    curr: 12,
  });
  expect(result).toContainEqual({
    path: ["d4h", "kindTitle"],
    type: "obj_add",
    curr: "Helmet",
  });
  expect(result).toContainEqual({
    path: ["d4h", "requireSN"],
    type: "obj_add",
    curr: true,
  });
});

it("handles null becoming an object", () => {
  const a = { d4h: null };
  const b = { d4h: { categoryId: 12 } };

  const result = diffObject(a, b);
  expect(result).toHaveLength(2);
  expect(result).toContainEqual({ path: ["d4h"], type: "obj_del", prev: null });
  expect(result).toContainEqual({
    path: ["d4h", "categoryId"],
    type: "obj_add",
    curr: 12,
  });
});

it("handles an object becoming null", () => {
  const a = { d4h: { categoryId: 12 } };
  const b = { d4h: null };

  const result = diffObject(a, b);
  expect(result).toHaveLength(2);
  expect(result).toContainEqual({
    path: ["d4h", "categoryId"],
    type: "obj_del",
    prev: 12,
  });
  expect(result).toContainEqual({ path: ["d4h"], type: "obj_add", curr: null });
});

it("distinguishes an added array field from an added element", () => {
  expect(diffObject({}, { tags: ["red", "blue"] })).toEqual([
    { path: ["tags"], type: "obj_add", curr: ["red", "blue"] },
  ]);

  expect(diffObject({ tags: ["red"] }, { tags: ["red", "blue"] })).toEqual([
    { path: ["tags"], type: "arr_add", value: "blue" },
  ]);
});

it("keeps path segments separate when a key contains a dot", () => {
  const a = { properties: { "a.b": 1 } };
  const b = { properties: { "a.b": 2 } };

  expect(diffObject(a, b)).toEqual([
    { path: ["properties", "a.b"], type: "obj_mod", prev: 1, curr: 2 },
  ]);
});

it("produces no change for an object with no leaves", () => {
  expect(diffObject({}, { d4h: {} })).toEqual([]);
});

it.each([
  ["a Map", { x: new Map() }],
  ["a Set", { x: new Set() }],
  ["a function", { x: () => undefined }],
  ["a bigint", { x: 1n }],
  ["a class instance", { x: new (class Thing {})() }],
  ["an array of objects", { x: [{ a: 1 }] }],
  ["a nested array", { x: [[1]] }],
  ["NaN", { x: NaN }],
])("throws on %s", (_label, input) => {
  expect(() => diffObject({}, input as Record<string, unknown>)).toThrow(DiffValueError);
});

it("reports the path of an unrepresentable value", () => {
  expect(() => diffObject({}, { a: { b: new Map() } })).toThrow(/a\.b/);
});
```

Then add this as a **new top-level `describe`**, after the closing `});` of the existing `describe("diff", ...)` block:

```ts
describe("DiffChange.schema", () => {
  const changes: DiffChange[] = [
    { type: "obj_add", path: ["name"], curr: "a" },
    { type: "obj_del", path: ["name"], prev: "a" },
    { type: "obj_mod", path: ["name"], prev: "a", curr: "b" },
    { type: "obj_mask", path: ["password"] },
    { type: "arr_add", path: ["tags"], value: "blue" },
    { type: "arr_del", path: ["tags"], value: "red" },
    { type: "arr_ord", path: ["groups"], prev: ["a", "b"], curr: ["b", "a"] },
  ];

  it("round-trips every change type through JSON", () => {
    const roundTripped = JSON.parse(JSON.stringify(changes));
    expect(z.array(DiffChange.schema).parse(roundTripped)).toEqual(changes);
  });

  it("rejects a change carrying a nested object as a value", () => {
    const result = DiffChange.schema.safeParse({
      type: "obj_add",
      path: ["d4h"],
      curr: { categoryId: 12 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown change type", () => {
    expect(DiffChange.schema.safeParse({ type: "obj_wat", path: ["x"] }).success).toBe(false);
  });
});
```

Update the import at the top of the test file:

```ts
import { describe, it, expect } from "vitest";
import * as z from "zod";
import { diffObject, DiffChange, DiffValueError } from "./diff";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/lib/diff.test.ts`

Expected: FAIL. `DiffValueError` and `DiffChange` are not exported as values, so the import fails and the whole file errors before any test runs.

- [ ] **Step 3: Rewrite `src/lib/diff.ts`**

Replace the entire file contents (keep the copyright header exactly as it is) with:

```ts
import { isPlainObject } from "remeda";
import * as z from "zod";

/** A scalar a change can carry. */
export type DiffValue = string | number | boolean | null;

/** A scalar, or a list of scalars, a change can carry. */
export type DiffValues = DiffValue | DiffValue[];

/**
 * Either side of a diff.
 *
 * Deliberately permissive: values are checked at runtime by `flatten` and throw if they cannot be
 * faithfully represented, rather than being constrained by the type. This is what lets a caller
 * pass a raw Prisma record and get a correct entry (dates convert) instead of a compile error.
 */
export type DiffInput = Record<string, unknown>;

const diffValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const diffValuesSchema = z.union([diffValueSchema, z.array(diffValueSchema)]);

const pathSchema = z.array(z.string());

export const DiffChange = {
  schema: z.discriminatedUnion("type", [
    /** An object key was added. */
    z.object({ type: z.literal("obj_add"), path: pathSchema, curr: diffValuesSchema }),
    /** An object key was removed. */
    z.object({ type: z.literal("obj_del"), path: pathSchema, prev: diffValuesSchema }),
    /** An object key changed value. */
    z.object({
      type: z.literal("obj_mod"),
      path: pathSchema,
      prev: diffValuesSchema,
      curr: diffValuesSchema,
    }),
    /** An object key changed, but its values are withheld (e.g. a password). */
    z.object({ type: z.literal("obj_mask"), path: pathSchema }),
    /** A value was added to an array. */
    z.object({ type: z.literal("arr_add"), path: pathSchema, value: diffValueSchema }),
    /** A value was removed from an array. */
    z.object({ type: z.literal("arr_del"), path: pathSchema, value: diffValueSchema }),
    /** An array was reordered. */
    z.object({
      type: z.literal("arr_ord"),
      path: pathSchema,
      prev: z.array(diffValueSchema),
      curr: z.array(diffValueSchema),
    }),
  ]),
} as const;

export type DiffChange = z.infer<typeof DiffChange.schema>;

/** Thrown when a value cannot be faithfully represented in a change. */
export class DiffValueError extends Error {
  constructor(
    readonly path: string[],
    readonly value: unknown,
  ) {
    super(`Cannot diff value at "${path.join(".")}": not representable`);
    this.name = "DiffValueError";
  }
}

function isDiffValue(value: unknown): value is DiffValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  return typeof value === "number" && Number.isFinite(value);
}

interface Leaf {
  path: string[];
  value: DiffValues;
}

/**
 * Reduce an object to a list of scalar leaves.
 *
 * This is the only place value-type policy lives:
 * - plain object -> recurse
 * - scalar -> leaf
 * - array of scalars -> leaf (the whole array)
 * - Date -> leaf, as an ISO string
 * - undefined -> absent
 * - anything else -> throw
 */
function flatten(input: DiffInput): Leaf[] {
  const leaves: Leaf[] = [];

  function recurse(value: unknown, path: string[]): void {
    if (value === undefined) return;

    if (isDiffValue(value)) {
      leaves.push({ path, value });
    } else if (value instanceof Date) {
      leaves.push({ path, value: value.toISOString() });
    } else if (Array.isArray(value)) {
      if (!value.every(isDiffValue)) throw new DiffValueError(path, value);
      leaves.push({ path, value: value as DiffValue[] });
    } else if (isPlainObject(value)) {
      for (const key of Object.keys(value)) {
        recurse((value as DiffInput)[key], [...path, key]);
      }
    } else {
      throw new DiffValueError(path, value);
    }
  }

  for (const key of Object.keys(input)) recurse(input[key], [key]);

  return leaves;
}

/**
 * Calculate the difference between two objects.
 *
 * Both sides are flattened to scalar leaves, then compared by path. Arrays of scalars are compared
 * as sets — `tags` is a set, so `+blue` is the right reading. Reordering is not inferred; a caller
 * that reorders something constructs an `arr_ord` change directly.
 *
 * @param a Initial object.
 * @param b Changed object.
 * @returns Array of changes.
 * @throws DiffValueError if either side holds a value that cannot be represented.
 */
export function diffObject(a: DiffInput, b: DiffInput): DiffChange[] {
  const changes: DiffChange[] = [];

  const keyOf = (path: string[]) => JSON.stringify(path);

  const leavesA = flatten(a);
  const leavesB = flatten(b);

  const byPathB = new Map(leavesB.map((leaf) => [keyOf(leaf.path), leaf]));
  const seen = new Set<string>();

  for (const { path, value: prev } of leavesA) {
    const key = keyOf(path);
    seen.add(key);

    const match = byPathB.get(key);
    if (!match) {
      changes.push({ type: "obj_del", path, prev });
      continue;
    }

    const curr = match.value;

    if (Array.isArray(prev) && Array.isArray(curr)) {
      for (const value of prev) {
        if (!curr.includes(value)) changes.push({ type: "arr_del", path, value });
      }
      for (const value of curr) {
        if (!prev.includes(value)) changes.push({ type: "arr_add", path, value });
      }
    } else if (Array.isArray(prev) || Array.isArray(curr) || prev !== curr) {
      changes.push({ type: "obj_mod", path, prev, curr });
    }
  }

  for (const { path, value: curr } of leavesB) {
    if (!seen.has(keyOf(path))) changes.push({ type: "obj_add", path, curr });
  }

  return changes;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/lib/diff.test.ts`

Expected: PASS, all tests.

- [ ] **Step 5: Type check the whole repo**

Run: `npx tsc --noEmit`

Expected: PASS. `DiffInput` is wider than the old `DiffableObject`, so no existing call site should break. If anything fails inside `.next/types` with route errors, run `npx next typegen` and re-run.

- [ ] **Step 6: Commit**

Stage the changes and show the proposed message, then wait for a yes/no:

```bash
git add src/lib/diff.ts src/lib/diff.test.ts
```

```
refactor(diff): flatten-then-diff with a scalar leaf value model

Replaces recursion-with-branches, where the defects lived. A single
flatten pass applies all value-type policy: objects expand to leaves,
Date converts to ISO, undefined is absent, everything else throws.

Adds a zod schema for DiffChange, plus obj_mask and arr_ord for changes
that are hand-constructed rather than inferred.
```

---

### Task 2: Tighten `propertiesSchema` and `tagsSchema`

**Files:**

- Modify: `src/lib/validation.ts:41,45`
- Modify: `src/trpc/routers/teams-router.ts:523` (and any other site `tsc` flags)

**Interfaces:**

- Consumes: nothing from Task 1 at the type level; this task is justified by Task 1's throw-on-unrepresentable policy.
- Produces: `scalarSchema` exported from `src/lib/validation.ts`; `propertiesSchema` narrowed to `Record<string, string | number | boolean | null>`; `tagsSchema` rejecting duplicates.

**Context:** `properties` is `z.record(z.string(), z.any())` today, but excluding generated code and test fixtures every real write is `{}` or a flat scalar record from the D4H paths. Narrowing it is what keeps Task 1's throw policy safe — without it, a client posting `properties: {foo: [{a: 1}]}` would hard-fail a mutation. `tags` has no uniqueness constraint, which is why `["a","a"] -> ["a"]` reports no change; making it a set means `diffObject`'s set semantics is correct by construction rather than an approximation.

These are **read** schemas as well as write schemas (`fromRecord` parses records through them). Production is empty and every dev row is `{}` or a flat D4H record, so no data migration is needed.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/validation.test.ts`:

```ts
/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, it, expect } from "vitest";

import { propertiesSchema, tagsSchema } from "./validation";

describe("propertiesSchema", () => {
  it("accepts a flat record of scalars", () => {
    const value = { d4hTeamId: 12, d4hLastSync: "2026-01-01T00:00:00.000Z", ok: true, none: null };
    expect(propertiesSchema.parse(value)).toEqual(value);
  });

  it("accepts an empty record", () => {
    expect(propertiesSchema.parse({})).toEqual({});
  });

  it("rejects a nested object", () => {
    expect(propertiesSchema.safeParse({ nested: { a: 1 } }).success).toBe(false);
  });

  it("rejects an array value", () => {
    expect(propertiesSchema.safeParse({ list: ["a"] }).success).toBe(false);
  });
});

describe("tagsSchema", () => {
  it("accepts unique non-empty tags", () => {
    expect(tagsSchema.parse(["red", "blue"])).toEqual(["red", "blue"]);
  });

  it("accepts an empty list", () => {
    expect(tagsSchema.parse([])).toEqual([]);
  });

  it("rejects duplicates", () => {
    expect(tagsSchema.safeParse(["red", "red"]).success).toBe(false);
  });

  it("rejects an empty tag", () => {
    expect(tagsSchema.safeParse([""]).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/lib/validation.test.ts`

Expected: FAIL on "rejects a nested object", "rejects an array value", and "rejects duplicates". The other tests pass already.

- [ ] **Step 3: Tighten the schemas**

In `src/lib/validation.ts`, replace line 41:

```ts
export const propertiesSchema = z.record(z.string(), z.any());
```

with:

```ts
/** A single JSON scalar. */
export const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/**
 * A record's free-form properties bag.
 *
 * Deliberately flat and scalar-only: every real write is `{}` or a flat record from the D4H
 * paths, and keeping it scalar is what lets `diffObject` throw on unrepresentable values without
 * client input being able to hard-fail a mutation.
 */
export const propertiesSchema = z.record(z.string(), scalarSchema);
```

and replace line 45:

```ts
export const tagsSchema = z.array(z.string().nonempty());
```

with:

```ts
/** A record's tags. A set, not a bag — `diffObject` compares tag lists as sets. */
export const tagsSchema = z
  .array(z.string().nonempty())
  .refine((tags) => new Set(tags).size === tags.length, "Tags must be unique");
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/lib/validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Fix the read sites the narrowing breaks**

Run: `npx tsc --noEmit`

Expected: FAIL at `src/trpc/routers/teams-router.ts:523` — `team.properties.d4hTeamId` is now `string | number | boolean | null` and is passed to `getD4HTeam(accessToken: D4HAccessToken_ServerOnly, d4hTeamId: number)`. It compiled before only because `z.any()` made it `any`.

Fix it by parsing rather than casting, so a malformed row fails loudly:

```ts
const d4hTeam = await getD4HTeam(accessToken, z.number().parse(team.properties.d4hTeamId));
```

`z` is already imported in that file.

Re-run `npx tsc --noEmit` and fix any further sites the same way — parse with the zod schema for the type the value is being used as, never a cast. The comparisons at `teams-router.ts:528` and `:549` (`m.id === member.properties.d4hMemberId`) may compile unchanged, since `number` overlaps the union.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test:run`

Expected: PASS. Router test fixtures all use `properties: {}` and simple tag lists, so none should need updating. If a fixture does fail, fix the fixture — do not loosen the schema.

- [ ] **Step 7: Commit**

Stage the changes and show the proposed message, then wait for a yes/no:

```bash
git add src/lib/validation.ts src/lib/validation.test.ts src/trpc/routers/teams-router.ts
```

```
refactor(schemas): make properties a flat scalar record and tags a set

properties was z.record(z.string(), z.any()), but every real write is {}
or a flat D4H record. Narrowing it keeps diffObject's throw-on-
unrepresentable policy safe from client input.

tags had no uniqueness constraint, which is why ["a","a"] -> ["a"]
reported no change. As a set, diffObject's set semantics is correct by
construction.

Read sites lose their implicit any and now parse instead.
```

---

## Stage 2 — The log

### Task 3: Correct the `changes` column default

**Files:**

- Modify: `prisma/schema.prisma:252`
- Create: a migration under `prisma/migrations/`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing consumed by later tasks.

**Context:** `changes Json @default("{}")` is an object default on a column that has only ever held an array. Production is empty, so this is free now and awkward later.

- [ ] **Step 1: Change the default**

In `prisma/schema.prisma`, on the `OrganizationLogEntry` model, change:

```prisma
  changes        Json         @default("{}")
```

to:

```prisma
  changes        Json         @default("[]")
```

- [ ] **Step 2: Create the migration**

Run: `npm run prisma migrate dev`

When prompted for a name, use `change_diff_default`.

Expected: a new migration directory containing an `ALTER TABLE ... ALTER COLUMN "changes" SET DEFAULT '[]'` statement.

- [ ] **Step 3: Verify the generated SQL**

Read the generated migration file and confirm it only alters the default — no data migration, no column drop.

- [ ] **Step 4: Run the test suite**

Run: `npm run test:run`

Expected: PASS. `prisma-mock` reads schema metadata from `src/generated/dmmf.ts`, which `prisma migrate dev` regenerates.

- [ ] **Step 5: Commit**

Stage the changes and show the proposed message, then wait for a yes/no:

```bash
git add prisma/schema.prisma prisma/migrations src/generated/dmmf.ts
```

```
fix(db): default OrganizationLogEntry.changes to an array

The column has only ever held a DiffChange[]; the default was "{}".
```

---

### Task 4: Validate `changes` in `ctx.logEvent`

**Files:**

- Modify: `src/trpc/init.ts:12,171`

**Interfaces:**

- Consumes: `DiffChange` (value and type) from Task 1.
- Produces: no signature change — `LogEventOptions.changes` stays `DiffChange[]`.

**Context:** `changes: changes as object[]` is currently the only thing bridging the type and the Json column. Parsing through the schema catches malformed hand-constructed changes (`obj_mask`, `arr_ord`) at the write, in the same fail-closed spirit as the differ's throw.

Note: the cast itself does **not** disappear — Prisma's Json input types require one regardless. The spec's wording was optimistic on that point. The schema's real payoff is the read path, once an audit log UI exists.

- [ ] **Step 1: Add the validation**

In `src/trpc/init.ts`, the import on line 12 already reads:

```ts
import { DiffChange } from "@/lib/diff";
```

`DiffChange` is now a value as well as a type, so no import change is needed. In `logEvent`, change:

```ts
                        changes: changes as object[],
```

to:

```ts
                        changes: z.array(DiffChange.schema).parse(changes) as object[],
```

`z` is already imported at the top of the file.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test:run`

Expected: PASS. Every existing router test that asserts on log entries passes changes produced by `diffObject`, which are valid by construction.

- [ ] **Step 4: Commit**

Stage the changes and show the proposed message, then wait for a yes/no:

```bash
git add src/trpc/init.ts
```

```
feat(log): validate changes against DiffChange.schema on write

Catches malformed hand-constructed changes at the call site rather than
storing them.
```

---

### Task 5: Reorder procedures emit one `arr_ord` entry

**Files:**

- Modify: `src/trpc/routers/skill-package-builder-router.ts:626-680` (`reorderGroups`)
- Modify: `src/trpc/routers/skill-package-builder-router.ts:688-748` (`reorderGroupSkills`)

**Interfaces:**

- Consumes: the `arr_ord` change type from Task 1.
- Produces: nothing consumed by later tasks.

**Context:** Both procedures currently emit one `Update` entry **per moved row**, each saying `sequence: 3 -> 5`. Reordering is one logical operation whose N-row update is an implementation detail, so it should be one entry against the parent. Both procedures already hold both orderings: `newOrder` from input, and the current sequences from the record they already fetch.

Note the honest limitation: if `newOrder` omits some children, `prev` and `curr` will differ in length. That is a faithful record of what the caller asked for, and no UI sends a partial order.

- [ ] **Step 1: Rewrite `reorderGroups`'s write block**

Replace the `toUpdate` declaration, the `forEach`, and the `if (toUpdate.length > 0)` block with:

```ts
const toUpdate: { id: SkillGroupId; sequence: number }[] = [];

newOrder.forEach((groupId, index) => {
  const group = skillPackage.groups.find((g) => g.id === groupId);

  if (group && group.sequence != index + 1) {
    toUpdate.push({ id: groupId, sequence: index + 1 });
  }
});

if (toUpdate.length > 0) {
  const prevOrder = [...skillPackage.groups]
    .sort((a, b) => a.sequence - b.sequence)
    .map((g) => g.id);

  await ctx.prisma.$transaction([
    ...toUpdate.map(({ id, sequence }) =>
      ctx.prisma.skillGroup.update({
        where: { id },
        data: { sequence },
      }),
    ),
    ctx.logEvent({
      action: "Update",
      objectType: "SkillPackage",
      objectId: skillPackageId,
      changes: [
        {
          type: "arr_ord",
          path: ["groups"],
          prev: prevOrder,
          curr: [...newOrder],
        },
      ],
      description: "Reordered skill groups.",
    }),
  ]);
}
```

- [ ] **Step 2: Rewrite `reorderGroupSkills`'s write block**

Replace the equivalent block with:

```ts
const toUpdate: { id: SkillId; sequence: number }[] = [];

newOrder.forEach((skillId, index) => {
  const skill = group.skills.find((s) => s.id === skillId);

  if (skill && skill.sequence != index + 1) {
    toUpdate.push({ id: skillId, sequence: index + 1 });
  }
});

if (toUpdate.length > 0) {
  const prevOrder = [...group.skills].sort((a, b) => a.sequence - b.sequence).map((s) => s.id);

  await ctx.prisma.$transaction([
    ...toUpdate.map(({ id, sequence }) =>
      ctx.prisma.skill.update({
        where: { id },
        data: { sequence },
      }),
    ),
    ctx.logEvent({
      action: "Update",
      objectType: "SkillGroup",
      objectId: skillGroupId,
      changes: [
        {
          type: "arr_ord",
          path: ["skills"],
          prev: prevOrder,
          curr: [...newOrder],
        },
      ],
      description: "Reordered skills within the group.",
    }),
  ]);
}
```

- [ ] **Step 3: Write a test for each procedure**

`skill-package-builder-router.test.ts` gives each `describe` its own fixtures rather than sharing one
dataset. Follow that: append two new top-level `describe` blocks, each with its own `T`, `db`,
`beforeAll` and `makeCaller`. Note the permission — these procedures need
`skillPackageBuilder: ["update"]`, not `["view"]`.

```ts
describe("skillPackageBuilderRouter.reorderGroups", () => {
  const T = {
    org: OrganizationId.create(),
    user: nanoId16(),
    pkg: SkillPackageId.create(),
    groupA: SkillGroupId.create(),
    groupB: SkillGroupId.create(),
  };

  const db = createMockPrisma();

  beforeAll(async () => {
    await db.organization.create({
      data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
    });
    await db.skillPackage.create({
      data: {
        id: T.pkg,
        organizationId: T.org,
        name: "Rescue Skills",
        description: "",
        properties: {},
        tags: [],
      },
    });
    for (const [id, sequence] of [
      [T.groupA, 1],
      [T.groupB, 2],
    ] as const) {
      await db.skillGroup.create({
        data: {
          id,
          skillPackageId: T.pkg,
          name: `Group ${sequence}`,
          description: "",
          properties: {},
          tags: [],
          sequence,
        },
      });
    }
  });

  function makeCaller() {
    return skillPackageBuilderRouter.createCaller(
      createAuthenticatedMockContext({
        user: { id: T.user },
        permissions: { skillPackageBuilder: ["update"], organization: ["view"] },
        prisma: db,
      }),
    );
  }

  it("writes nothing when the order is unchanged", async () => {
    const before = await db.organizationLogEntry.count();

    await makeCaller().reorderGroups({
      organizationId: T.org,
      skillPackageId: T.pkg,
      newOrder: [T.groupA, T.groupB],
    });

    expect(await db.organizationLogEntry.count()).toBe(before);
  });

  it("writes one entry against the package, not one per group", async () => {
    await makeCaller().reorderGroups({
      organizationId: T.org,
      skillPackageId: T.pkg,
      newOrder: [T.groupB, T.groupA],
    });

    const entries = await db.organizationLogEntry.findMany({
      where: { organizationId: T.org },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].objectType).toBe("SkillPackage");
    expect(entries[0].objectId).toBe(T.pkg);
    expect(entries[0].changes).toEqual([
      {
        type: "arr_ord",
        path: ["groups"],
        prev: [T.groupA, T.groupB],
        curr: [T.groupB, T.groupA],
      },
    ]);
  });
});

describe("skillPackageBuilderRouter.reorderGroupSkills", () => {
  const T = {
    org: OrganizationId.create(),
    user: nanoId16(),
    pkg: SkillPackageId.create(),
    group: SkillGroupId.create(),
    skillA: SkillId.create(),
    skillB: SkillId.create(),
  };

  const db = createMockPrisma();

  beforeAll(async () => {
    await db.organization.create({
      data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
    });
    await db.skillPackage.create({
      data: {
        id: T.pkg,
        organizationId: T.org,
        name: "Rescue Skills",
        description: "",
        properties: {},
        tags: [],
      },
    });
    await db.skillGroup.create({
      data: {
        id: T.group,
        skillPackageId: T.pkg,
        name: "Rope Access",
        description: "",
        properties: {},
        tags: [],
        sequence: 1,
      },
    });
    for (const [id, sequence] of [
      [T.skillA, 1],
      [T.skillB, 2],
    ] as const) {
      await db.skill.create({
        data: {
          id,
          skillPackageId: T.pkg,
          skillGroupId: T.group,
          name: `Skill ${sequence}`,
          description: "",
          properties: {},
          tags: [],
          sequence,
        },
      });
    }
  });

  function makeCaller() {
    return skillPackageBuilderRouter.createCaller(
      createAuthenticatedMockContext({
        user: { id: T.user },
        permissions: { skillPackageBuilder: ["update"], organization: ["view"] },
        prisma: db,
      }),
    );
  }

  it("writes nothing when the order is unchanged", async () => {
    const before = await db.organizationLogEntry.count();

    await makeCaller().reorderGroupSkills({
      organizationId: T.org,
      skillGroupId: T.group,
      newOrder: [T.skillA, T.skillB],
    });

    expect(await db.organizationLogEntry.count()).toBe(before);
  });

  it("writes one entry against the group, not one per skill", async () => {
    await makeCaller().reorderGroupSkills({
      organizationId: T.org,
      skillGroupId: T.group,
      newOrder: [T.skillB, T.skillA],
    });

    const entries = await db.organizationLogEntry.findMany({
      where: { organizationId: T.org },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].objectType).toBe("SkillGroup");
    expect(entries[0].objectId).toBe(T.group);
    expect(entries[0].changes).toEqual([
      {
        type: "arr_ord",
        path: ["skills"],
        prev: [T.skillA, T.skillB],
        curr: [T.skillB, T.skillA],
      },
    ]);
  });
});
```

The "unchanged" test runs first in each block deliberately: it asserts the log is untouched, and the
reorder test that follows then asserts exactly one entry exists.

- [ ] **Step 4: Run the tests**

Run: `npm run test:run -- src/trpc/routers/skill-package-builder-router.test.ts`

Expected: PASS.

- [ ] **Step 5: Type check and run the full suite**

Run: `npx tsc --noEmit && npm run test:run`

Expected: PASS.

- [ ] **Step 6: Commit**

Stage the changes and show the proposed message, then wait for a yes/no:

```bash
git add src/trpc/routers/skill-package-builder-router.ts src/trpc/routers/skill-package-builder-router.test.ts
```

```
fix(log): record a reorder as one entry, not one per moved row

Reordering is a single operation; the N-row sequence update is an
implementation detail. Both procedures already hold the old and new
orderings, so arr_ord is constructed directly rather than inferred.
```

---

### Task 6: Settings store stops pre-flattening

**Files:**

- Modify: `src/server/organization-settings-store.ts:87`

**Interfaces:**

- Consumes: `diffObject` from Task 1.
- Produces: nothing consumed by later tasks.

**Context:** The store calls `OrganizationSettings.flatten()` and diffs the dotted-key result — a bespoke shape assumption the differ now makes redundant. The `flatten()` call itself stays, because the `organizationConfig` upserts key on dotted strings; only the diff input changes. The recorded paths go from `["modules.i3.enabled"]` to `["modules", "i3", "enabled"]`, which a renderer joins to the same string.

- [ ] **Step 1: Write the failing test**

There is no test file for this module yet. Create `src/server/organization-settings-store.test.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import type { DiffChange } from "@/lib/diff";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { createMockPrisma } from "@/test/create-prisma-mock";

import { writeOrganizationSettings } from "./organization-settings-store";

describe("writeOrganizationSettings", () => {
  it("records settings changes with segmented paths", async () => {
    const db = createMockPrisma();
    const orgId = OrganizationId.create();

    await db.organization.create({
      data: { id: orgId, name: "Acme", slug: "acme", createdAt: new Date() },
    });

    const defaults = OrganizationSettings.default();
    const next: OrganizationSettings = {
      ...defaults,
      modules: {
        ...defaults.modules,
        i3: { ...defaults.modules.i3, enabled: true },
      },
    };

    let recorded: DiffChange[] = [];

    await writeOrganizationSettings(db, orgId, next, (changes) => {
      recorded = changes;
      return db.organizationConfig.findMany({ where: { organizationId: orgId } });
    });

    expect(recorded).toEqual([
      {
        type: "obj_mod",
        path: ["modules", "i3", "enabled"],
        prev: false,
        curr: true,
      },
    ]);
  });
});
```

`modules.i3.enabled` defaults to `false`, so flipping it to `true` is a single-leaf change. The
`logEntry` callback must return a `PrismaPromise` because the store passes it into
`$transaction([...])`; the `findMany` above is a harmless one.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/server/organization-settings-store.test.ts`

Expected: FAIL — the recorded path is `["modules.i3.enabled"]`, one dotted segment.

- [ ] **Step 3: Diff the unflattened settings**

In `src/server/organization-settings-store.ts`, change:

```ts
const changes = diffObject(flattenedExisting, flattenedNext);
```

to:

```ts
const changes = diffObject(existing, parsed);
```

Leave `flattenedExisting` and `flattenedNext` in place — the `upserts` above still need them.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/server/organization-settings-store.test.ts`

Expected: PASS.

- [ ] **Step 5: Type check and run the full suite**

Run: `npx tsc --noEmit && npm run test:run`

Expected: PASS.

- [ ] **Step 6: Commit**

Stage the changes and show the proposed message, then wait for a yes/no:

```bash
git add src/server/organization-settings-store.ts src/server/organization-settings-store.test.ts
```

```
refactor(settings): diff settings unflattened

diffObject flattens internally now, so the store's dotted-key
pre-flattening is redundant for the diff. Paths become segmented, which
renders identically.
```

---

## Not in this plan

- **The audit log renderer.** There is no page to put it on, and building one gets ahead of the unified audit log implementation. The render mapping in the spec is the acceptance criterion for the format.
- **The `obj_mask` writer.** The better-auth password hook belongs to the unified audit log work; this plan only defines the encoding it was waiting on.
- **Widening `propertiesSchema` to admit `string[]`.** One union member and zero diff-layer work when something wants it.
