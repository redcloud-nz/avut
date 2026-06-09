---
name: style-reset
description: Apply the Lexington → Std + Saratoga style reset to a page route.
---

# Style Reset Migration

Apply the Lexington → Std + Saratoga style reset to a page route.

## Usage

```
/style-reset [path/to/page.tsx]
```

If no path is given, use the file currently open in the IDE. The argument should point to the `page.tsx` server component — the skill will also update the co-located client component(s) as needed.

> **If `page.tsx` is already `"use client"`**: apply both the `Std` shell changes (section 1) and the `Saratoga` content changes (section 2 or 3) to the same file. No separate server/client split is needed.

## What to do

Read the target `page.tsx` and its primary client component(s), then apply all of the following changes.

### 1. Page shell (`page.tsx`)

Replace the `Lexington` shell with `Std`:

```tsx
// BEFORE
import { Lexington } from "@/components/blocks/lexington";

<Lexington.Root>
    <Lexington.Header breadcrumbs={[...]} />
    <Lexington.Page>
        <Lexington.Column width="...">
            <ClientComponent />
        </Lexington.Column>
    </Lexington.Page>
</Lexington.Root>

// AFTER
import { Std } from "@/components/blocks/std";

<Std.SidebarInset>
    <Std.Navbar breadcrumbs={[...]} />
    <Std.ScrollContainer>
        <ClientComponent />
    </Std.ScrollContainer>
</Std.SidebarInset>
```

- Drop `Lexington.Root`, `Lexington.Page`, and `Lexington.Column` entirely.
- `Lexington.Header` → `Std.Navbar` (same `breadcrumbs` prop shape).
- Remove the `Lexington` import; add `Std` import.

### 2. List page client component

Wrap content in `Saratoga.Root`. Move the page title and actions into `Saratoga.Header`:

```tsx
import { Saratoga } from "@/components/blocks/saratoga";

<Saratoga.Root>
  <Saratoga.Header>
    <Saratoga.Title>Page Title</Saratoga.Title>
    <Saratoga.Actions>{/* action buttons, e.g. New Item */}</Saratoga.Actions>
  </Saratoga.Header>

  <div>
    <Kaga.TableToolbar table={table} />
    <Kaga.Table table={table} />
    <Kaga.TablePagination table={table} />
  </div>
</Saratoga.Root>;
```

- If the component was previously using `Hermes.Header` / `Hermes.Title` for the title area, replace with `Saratoga.Header` / `Saratoga.Title` / `Saratoga.Actions`.
- If the component was using `Akagi` for tables, replace with `Kaga` — see section 4 below for column definition changes.
- If `Hermes.Header` appears elsewhere (e.g. as a flex container for loading skeletons inside a card), replace it with `<div className="flex items-center gap-2">` — it's just a styled `div`.
- Remove any `Lexington`, `Hermes`, or `Akagi` imports that are no longer used.

### 3. Detail page client component

Use `Saratoga.Columns` for the 2/3 + 1/3 responsive grid:

```tsx
import { Saratoga } from "@/components/blocks/saratoga";

<Saratoga.Root>
  <Saratoga.Header>
    <Saratoga.Title>{item.name}</Saratoga.Title>
    <Saratoga.Actions>{/* action buttons / menus */}</Saratoga.Actions>
  </Saratoga.Header>

  <Saratoga.Columns>
    <Saratoga.Column slot="main">{/* primary cards */}</Saratoga.Column>
    <Saratoga.Column slot="secondary">
      {/* metadata / timestamps / related items */}
    </Saratoga.Column>
  </Saratoga.Columns>
</Saratoga.Root>;
```

- The `slot` prop on `Saratoga.Column` must be either `"main"` or `"secondary"`.
- Remove any `Lexington`, `Hermes`, or `Akagi` imports that are no longer used.

### 4. `Kaga.defineColumns` — column definition changes

`Kaga` columns are simpler than `Akagi`: no wrapper components inside `header` or `cell`.

```tsx
// BEFORE (Akagi)
Akagi.defineColumns<RowData>((columnHelper) => [
    columnHelper.accessor("name", {
        header: (ctx) => (
            <Akagi.TableHeadCell header={ctx.header}>Name</Akagi.TableHeadCell>
        ),
        cell: (ctx) => (
            <Akagi.TableCell cell={ctx.cell}>
                <Link href={...}>{ctx.getValue()}</Link>
            </Akagi.TableCell>
        ),
        enableSorting: true,
        enableGlobalFilter: true,
    }),
    columnHelper.accessor("status", {
        header: (ctx) => (
            <Akagi.TableHeadCell header={ctx.header} filterOptions={["Active", "Archived"]}>
                Status
            </Akagi.TableHeadCell>
        ),
        cell: (ctx) => (
            <Akagi.TableCell cell={ctx.cell}>{ctx.getValue()}</Akagi.TableCell>
        ),
        enableColumnFilter: true,
        enableSorting: false,
        enableGlobalFilter: false,
        filterFn: "arrIncludesSome",
    }),
])

// AFTER (Kaga)
Kaga.defineColumns<RowData>((columnHelper) => [
    columnHelper.accessor("name", {
        header: "Name",
        cell: (ctx) => <Link href={...}>{ctx.getValue()}</Link>,
        enableSorting: true,
        enableGlobalFilter: true,
        enableColumnFilter: false,
    }),
    columnHelper.accessor("status", {
        header: "Status",
        cell: (ctx) => ctx.getValue(),
        enableColumnFilter: true,
        enableSorting: false,
        enableGlobalFilter: false,
        filterFn: Kaga.filterFns.oneOf,
        meta: {
            columnOptions: [
                { label: "Active", value: "Active" },
                { label: "Archived", value: "Archived" },
            ],
        },
    }),
])
```

Key changes:

- `header`: render function with `<Akagi.TableHeadCell>` → plain string
- `cell`: remove the `<Akagi.TableCell>` wrapper, return content directly
- `filterOptions` prop on `Akagi.TableHeadCell` → `meta.columnOptions` array on the column def
- `filterFn: "arrIncludesSome"` → `filterFn: Kaga.filterFns.oneOf`
- `Akagi.DEFAULT_PAGE_SIZE` → `Kaga.DEFAULT_PAGE_SIZE`

### 5. Detail cards: `DL` instead of `FieldGroup`/`Field`

Display-only fields inside cards use `DL`/`DLTerm`/`DLDetails` instead of `FieldGroup`/`Field`/`FieldLabel`/`FieldValue`. Note: `Field`/`FieldGroup` are still correct for _form_ inputs — only replace them where they are showing read-only data.

```tsx
// BEFORE
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

<CardContent>
  <FieldGroup>
    <Field orientation="responsive">
      <FieldLabel>Name</FieldLabel>
      <FieldValue value={item.name} />
    </Field>
    <Field orientation="responsive">
      <FieldLabel>Status</FieldLabel>
      <FieldValue value={item.status} />
    </Field>
  </FieldGroup>
</CardContent>;

// AFTER
import { DL, DLTerm, DLDetails } from "@/components/ui/description-list";

<CardContent>
  <DL>
    <DLTerm>Name</DLTerm>
    <DLDetails>{item.name}</DLDetails>
    <DLTerm>Status</DLTerm>
    <DLDetails>{item.status}</DLDetails>
  </DL>
</CardContent>;
```

**`FieldSeparator` / `FieldLegend`**: drop both entirely. `DL` rows flow naturally without separators. If a `FieldLegend` was labelling a sub-section (e.g. "D4H Integration"), the `DLTerm` labels themselves provide enough context — no heading equivalent is needed.

**`FieldValue format="id"`**: render the value directly in `DLDetails` — there's no format prop on `DL` components.

### 6. Created/Updated dates — separate secondary card

Move `createdAt` and `updatedAt` out of the main details card and into their own card in the `secondary` column. Use `formatDateTime` and `formatRelativeDateTime` for display (not `FieldValue format="dateWithDistance"`).

```tsx
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";

// In Saratoga.Column slot="secondary":
<Card>
  <CardContent>
    <DL>
      <DLTerm>Created</DLTerm>
      <DLDetails>
        <div>{formatDateTime(item.createdAt)}</div>
        <div className="text-muted-foreground">{formatRelativeDateTime(item.createdAt)}</div>
      </DLDetails>
      <DLTerm>Updated</DLTerm>
      <DLDetails>
        <div>{formatDateTime(item.updatedAt)}</div>
        <div className="text-muted-foreground">{formatRelativeDateTime(item.updatedAt)}</div>
      </DLDetails>
    </DL>
  </CardContent>
</Card>;
```

- This card has no `CardHeader` — just `CardContent`.
- If the record only has `createdAt` (no `updatedAt`), include only the `Created` term.

## Reference: updated imports

| Remove                                                                                | Add                                                                        |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `import { Lexington } from "@/components/blocks/lexington"`                           | `import { Std } from "@/components/blocks/std"`                            |
| `import { Hermes } from "@/components/blocks/hermes"`                                 | `import { Saratoga } from "@/components/blocks/saratoga"`                  |
| `import { Akagi } from "@/components/blocks/akagi"`                                   | `import { Kaga } from "@/components/blocks/kaga"`                          |
| `import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"` (display use) | `import { DL, DLTerm, DLDetails } from "@/components/ui/description-list"` |
| `import { FieldValue } from "@/components/ui/field-value"`                            | `import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime"`  |

Only add imports that are actually used. Don't remove an import if part of it is still in use.

## After editing

Do not start the dev server or run any verification automatically. Report which files were changed and what was updated in each.
