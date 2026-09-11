# Change Diff Rework

**Status:** Design approved, not yet implemented
**Related:** [2026-09-08-unified-audit-log-design.md](./2026-09-08-unified-audit-log-design.md)

## Context

`src/lib/diff.ts` produces the `DiffChange[]` payload stored in the audit log's
`changes` column. Every state-changing organization mutation calls it — about
thirty sites across seven routers plus `organization-settings-store.ts`.

Nothing has ever read it back. There is no audit log UI, no tRPC query, and no
renderer, so the format has never been exercised by a consumer and its defects
have never surfaced as visible bugs.

The unified audit log design defers three items to this rework: the encoding of
the password-change marker, the fix for `reorderGroups`/`reorderGroupSkills`
emitting N entries for one logical operation, and a centralised redaction
policy.

### What is actually broken

Established by reading every call site, not by inference:

- **Change values may be arbitrarily nested.** `DiffChange.curr` is typed
  `Diffable`, which permits objects and arrays. This is live: `diffObject({}, create)`
  on an `I3Template` emits one `obj_add` at path `["d4h"]` whose `curr` is the
  entire `{categoryId, categoryTitle, kindId, kindTitle, outputRefFormat,
requireSN}` object. Any renderer prints `[object Object]`.
- **`Date` values vanish silently.** `isObjectType(new Date())` is `true`, so a
  Date takes the recursive-object branch, and `for…in` over a Date yields no
  keys. `diffObject({d: new Date("2020-01-01")}, {d: new Date("2021-01-01")})`
  returns `[]`.
- **`undefined` produces a value-less change.** `{missing: undefined}` yields
  `{path: ["missing"], type: "obj_del", prev: undefined}`, which serializes to a
  deletion carrying no `prev` at all.
- **Duplicate array entries are invisible.** Array diffing uses `Array.includes`,
  so `["a", "a"]` → `["a"]` reports no change.
- **Array reordering is inexpressible.** `["a", "b"]` → `["b", "a"]` returns `[]`.
- **The type and the column are bridged by a cast.** `changes as object[]` at
  `src/trpc/init.ts:171`. There is no schema, so nothing validates what goes in
  and nothing can validate what comes out.
- **The column default is the wrong shape.** `prisma/schema.prisma:252` is
  `changes Json @default("{}")` on a column that has only ever held an array.

### What is not broken

Two defects recorded in the audit log spec turn out to be latent rather than live,
which lowers their weight in this design:

- **No call site currently loses a Date.** Every one either passes values through
  a zod schema first (`fromRecord` converts dates to ISO strings) or constructs
  literals from already-serialized values — `teams-router.ts:594` does
  `new Date().toISOString()`, and `i3-router.ts:134` passes `fromRecord` output.
  The Date defect is a trap for the next caller, not a current bug.
- **No call site diffs an array of objects.** The only array diffed anywhere is
  `tags`, a `string[]`.

## Goals

1. A change value that a renderer can always print.
2. No input value is ever silently dropped from the output.
3. A vocabulary that can express the three things the audit log spec needs:
   a field change, a withheld field change, and a reordering.
4. A zod schema, so `changes` can be parsed rather than trusted.

## Non-goals

- **The renderer.** There is no audit log page to put it on, and building one
  would get ahead of the unified audit log implementation. The render mapping is
  recorded below as the acceptance criterion so the format is designed against a
  real consumer, but no component is built here.
- **A schema-aware differ.** Considered and rejected — see Alternatives.
- **Centralised redaction.** `obj_mask` gives redaction an encoding; the policy
  for deciding what to redact stays with the audit log work.

## The rendering target

The audit log is viewed per entity, as an ordered list of changes with the actor
for each. Each `DiffChange` becomes one line. Field names are printed as-is —
the log is allowed to be slightly technical, so there is no label registry and no
schema metadata. The renderer joins `path` with `.`:

```
Created   name = "a", description = "1"
Updated   name: "a" → "b"
Updated   tags: +blue
Updated   properties.height added = 196
Updated   properties.height: 196 → 120
Updated   password changed (value hidden)
Updated   groups reordered
```

This target is what makes the value model below necessary: every line has to
print a value, so no value may be a nested structure.

## The value model

Change values are **scalars, or arrays of scalars**:

```ts
type DiffValue = string | number | boolean | null;
type DiffValues = DiffValue | DiffValue[];
```

Everything else resolves before it becomes a change. The flatten policy is the
single place type handling lives:

| Input                                    | Treatment                        |
| ---------------------------------------- | -------------------------------- |
| plain object                             | recurse into its keys            |
| `string` / `number` / `boolean` / `null` | leaf                             |
| array of scalars                         | leaf (the whole array)           |
| `Date`                                   | leaf, converted to an ISO string |
| `NaN` / `Infinity` / `-Infinity`         | **throw**                        |
| `undefined`                              | treated as absent                |
| anything else                            | **throw**                        |

"Anything else" is arrays of non-scalars, nested arrays, `Map`, `Set`, functions,
symbols, bigints, and class instances — nothing JSON can carry faithfully, so
nothing that can be honestly logged. Non-finite numbers throw for the same
reason: `number` is a leaf type, but `NaN`/`Infinity`/`-Infinity` serialize to
`null` through `JSON.stringify`, which would silently misrepresent the value
rather than honestly logging it.

Three of these deserve their reasoning stated:

- **`Date` converts rather than throws.** Every caller already writes
  `.toISOString()` by hand, so conversion changes nothing for existing code. The
  failure mode actually worth guarding against is someone passing a raw Prisma
  record, and converting turns that into a _correct_ audit entry rather than an
  exception.
- **`undefined` is absent, not a value.** This matches `JSON.stringify` and
  removes the value-less `obj_del` described above.
- **Everything else throws.** For an audit log, a loud failure at the call site is
  better than an entry that quietly omits what changed. This is only tolerable
  because of the schema tightening below — without it, client-supplied
  `properties` could hard-fail a mutation.

The invariant, and the property the current implementation lacks:

> **No input value is ever silently dropped from the output.**

### Empty objects

An object with no leaves contributes no changes, so `{}` → `{d4h: {}}` produces
nothing. No current schema can express this — `I3Template.d4h` is nullable but its
fields are all required — so it is an accepted and documented edge rather than a
special case in the code.

## The algorithm

Replace recursion-with-branches (where the current bugs live) with **flatten,
then diff**:

1. **Flatten** each side to a list of `[path: string[], value: DiffValues]` leaves,
   applying the policy above.
2. **Diff the two flat lists by path:**
   - present only in `a` → `obj_del`
   - present only in `b` → `obj_add`
   - present in both, both arrays → set difference (`arr_add` / `arr_del`)
   - present in both, unequal → `obj_mod`

Several bugs become non-issues rather than needing individual fixes. `undefined`
never reaches the diff. Nesting is handled once instead of at every branch. And
`d4h: null → {…}` falls out correctly on its own: `null` is a leaf on one side,
`d4h.categoryId` and friends are leaves on the other, giving a removal plus the
additions.

**Paths stay `string[]`, never dotted strings.** `properties` keys are arbitrary,
so a key containing a `.` would be ambiguous. The renderer joins; the data does
not.

### Field-added versus element-added

The two array cases differ, correctly:

- `{}` → `{tags: ["red", "blue"]}` — one leaf, present only on the right →
  `obj_add` with `curr: ["red", "blue"]`. Renders `tags added = red, blue`.
- `{tags: ["red"]}` → `{tags: ["red", "blue"]}` — leaf on both sides, both
  arrays → `arr_add`. Renders `tags: +blue`.

The field did not exist, versus the field was empty.

## The vocabulary

```ts
interface DiffChangeBase { path: string[] }

{ type: "obj_add",  path, curr: DiffValues }
{ type: "obj_del",  path, prev: DiffValues }
{ type: "obj_mod",  path, prev: DiffValues, curr: DiffValues }
{ type: "obj_mask", path }
{ type: "arr_add",  path, value: DiffValue }
{ type: "arr_del",  path, value: DiffValue }
{ type: "arr_ord",  path, prev: DiffValue[], curr: DiffValue[] }
```

The `obj_`/`arr_` prefix still earns its keep after flattening: it does not name
the container type, it names the two different render shapes. `obj_mod` at
`["tags"]` would be `tags: a → b`; `arr_add` at `["tags"]` is `tags: +blue`.

| Type       | Produced by      | Renders as                    |
| ---------- | ---------------- | ----------------------------- |
| `obj_add`  | `diffObject`     | `path added = curr`           |
| `obj_del`  | `diffObject`     | `path removed (was prev)`     |
| `obj_mod`  | `diffObject`     | `path: prev → curr`           |
| `obj_mask` | hand-constructed | `path changed (value hidden)` |
| `arr_add`  | `diffObject`     | `path: +value`                |
| `arr_del`  | `diffObject`     | `path: −value`                |
| `arr_ord`  | hand-constructed | `path reordered`              |

`obj_mask` is named for masking rather than redaction: `obj_red` reads as a colour
in a module whose own fixtures are `tags: ["red", "blue"]`.

`obj_mask` and `arr_ord` are not produced by `diffObject`. Both of their writers
already know exactly what happened and need nothing inferred — the better-auth
password hook has no before/after to compare (that is the point), and
`reorderGroups` receives the new order as input.

### On adding types with no writer

The unified audit log spec dropped three columns for having no writer, so these
two additions need an answer. A union member is inert where a column is a
migration plus a shape every reader must handle, but more concretely:

- **`obj_mask` already has a writer on this branch**: `d4hAccessTokensRouter`'s
  two token-create procedures diff the create payload with the token field
  omitted, then append a hand-constructed `obj_mask` at that field's path, so the
  raw D4H API key never reaches `organization_log_entries.changes`. The
  better-auth password hook, specified in the audit log design (which explicitly
  defers to this document for the encoding), is a second, later writer of the
  same type — not the only one.
- **`arr_ord`'s writer is the reorder fix**, which is stage 2 of this work. It
  lands with a producer.

## Schema tightening

Two input types are widened beyond what the app actually uses, and narrowing them
removes diff defects at source instead of working around them downstream.

### `properties`

`src/lib/validation.ts:41` is `z.record(z.string(), z.any())`. Excluding generated
code and test fixtures, every real write is either `{}` (every create dialog) or a
flat scalar record from the D4H paths — `{d4hTeamId}`, `{d4hMemberId}`,
`{d4hLastSync}`. There is no user-facing properties editor. Reads already assume
flat scalars: `teams-router.ts:523` passes `team.properties.d4hTeamId` into a
`number` parameter, and `teams-router.ts:528` compares `member.properties.d4hMemberId`
to a number. Both compile today only because `z.any()` makes them `any`.

```ts
export const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const propertiesSchema = z.record(z.string(), scalarSchema);
```

This is load-bearing for the flatten policy, not a tidy-up. Without it, a client
posting `properties: {foo: [{a: 1}]}` would hard-fail a mutation under
throw-on-unrepresentable, which would have forced an escape hatch (serializing
such values to JSON strings). With it, the policy stays clean.

Two consequences to note:

- **It is a read schema as well as a write schema** — `fromRecord` parses records
  through it — so a pre-existing row holding a nested value would begin failing to
  parse. Production is empty and every other row is `{}` or a flat D4H record, so
  this is safe today.
- **Read sites now need narrowing.** The roughly four sites above lose their
  implicit `any`.

Widening later to admit `string[]` is one union member and **zero work in the diff
layer**, since scalar arrays are already the change-value type for `tags`. The
compiler flags every read site that needs attention. Left out for now.

### `tags`

`src/lib/validation.ts:45` is `z.array(z.string().nonempty())` with no uniqueness
constraint, which is why `["a", "a"]` → `["a"]` reports no change.

```ts
export const tagsSchema = z
  .array(z.string().nonempty())
  .refine((tags) => new Set(tags).size === tags.length, "Tags must be unique");
```

Nothing in the app treats a tag list as a bag and no UI can produce duplicates.
With this, the differ's set semantics stops being an approximation and becomes
correct by construction, rather than the differ needing multiset counting.

Like `properties`, this is a read schema as well as a write schema: `Person`,
`Team`, `TeamMembership`, `SkillPackage`, `SkillGroup`, and `Skill` all parse
their DB record's `tags` column through `tagsSchema` via `fromRecord`. A
pre-existing row holding a duplicate-bearing `tags` array would begin failing to
parse. The same safety argument as `properties` applies — production is empty
and no UI can produce duplicates today — so this is safe. The blast radius is
larger than a single record, though: `fromRecord` also runs over list-query
results (e.g. the personnel and skill-package list pages), so one bad row fails
the entire list, not just that row's own detail page.

## Validation and storage

`DiffChange` gains a zod schema — a discriminated union on `type` — exported
alongside the type. This is what lets `changes` be parsed on the way _out_ of the
Json column instead of trusted, and it removes the `changes as object[]` cast at
`src/trpc/init.ts:171`, currently the only thing bridging the type and the column.

`prisma/schema.prisma:252` changes from `@default("{}")` to `@default("[]")`.
Production is empty, so this is free now and awkward later.

## Staging

**Stage 1 — the library.** Self-contained; no change to what the log stores beyond
the diff output itself.

- Rewrite `src/lib/diff.ts`: flatten-then-diff, the value model, the seven-type
  vocabulary, and the zod schema.
- `src/lib/validation.ts`: add `scalarSchema`, tighten `propertiesSchema` and
  `tagsSchema`.
- Narrow the `properties` read sites the tightening breaks (`teams-router.ts`).
- Rewrite `src/lib/diff.test.ts`.

**Stage 2 — the log.** Wires the new vocabulary into the audit log.

- `prisma/schema.prisma`: `changes Json @default("[]")` plus migration.
- `src/trpc/init.ts`: drop the `changes as object[]` cast; validate via the schema.
- `reorderGroups` and `reorderGroupSkills`: one entry with `arr_ord` instead of N
  entries of `sequence: 3 → 5`. `reorderGroups` logs against the package
  (`objectType: "SkillPackage"`, `objectId: skillPackageId`, `path: ["groups"]`);
  `reorderGroupSkills` against the group (`objectType: "SkillGroup"`,
  `objectId: skillGroupId`, `path: ["skills"]`). Both procedures already have both
  orderings in hand — `newOrder` from input, and the current sequences from the
  record they already fetch.
- `src/server/organization-settings-store.ts`: stop pre-flattening. It currently
  calls `OrganizationSettings.flatten()` and diffs the result, which is a bespoke
  shape assumption the differ now makes redundant. It keeps working untouched in
  the meantime, since a flat object flattens to itself.

## Testing

Most of `src/lib/diff.test.ts` survives — the nesting, array, boolean, empty-object
and mixed-change cases all still hold.

One existing test is rewritten rather than preserved: the `null`/`undefined` case
pins `{missing: undefined}` → `obj_del` with `prev: undefined`, which is exactly
the value-less output being removed. Under the new model it produces no change.

Added:

- `Date` converts to an ISO string.
- A nested object add expands to leaves (`d4h` → `d4h.categoryId`, …).
- `null` ↔ object in both directions.
- Throws on `Map`, `Set`, function, bigint, class instance, and array-of-objects.
- A JSON round-trip through the zod schema — surviving serialization is the job.
- `obj_mask` and `arr_ord` parse and round-trip.

## Alternatives considered

**A schema-aware differ** — `diffObject(schema, a, b)`, reading zod metadata for
types, array semantics, and sensitivity. It would fix Dates by construction and
make redaction declarative. Rejected: seven call sites diff ad-hoc literal
objects with no schema at all (`{d4hLastSync}`, `{skillGroupId, skillPackageId}`,
`{status}`, the flattened settings object), so it needs a schema-less fallback
regardless — two code paths forever, bought for declarative redaction on exactly
one field and correct Dates at zero current sites.

**Label machinery** — a per-`objectType` label registry, or labels attached to zod
fields via `.meta()`. Rejected: the log is allowed to be technical, so real field
names are the target. A registry is a second place to update whenever a field is
added, and it degrades silently when someone forgets.

**Order-aware array diffing in general** — rejected. `tags` is a set, and `+blue`
is the right rendering for it. Order matters only where a caller says it does,
which is what `arr_ord` is for.

## Open questions

- **The throw's error type.** A plain `Error` naming the path is probably enough,
  but it surfaces as a 500 from a mutation. Worth deciding whether the audit layer
  should catch it.
