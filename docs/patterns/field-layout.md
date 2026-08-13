# Pattern: `Field` layout (`src/components/ui/field.tsx`)

`Field`'s layout is driven by Tailwind `has-[]`/`*:` selectors and a **container query**
scoped to the nearest `FieldGroup` — not the viewport. The behavior below was verified
visually (a scratch page rendering every combination), not just read off the classes,
because two of these are easy to get wrong from the source alone.

## `orientation`

- **`vertical`** (default): label above a full-width control. Always safe.
- **`horizontal`**: label and control side by side. The label gets `flex-auto` (grow
  _and_ shrink) with no `shrink-0`/min-width, so once the row runs out of room the
  label text wraps — a 7-character label like "Team ID" wraps onto two lines well
  before the control itself is squeezed. **Only use `horizontal` when the row's width
  is guaranteed**, which in practice means the radio/checkbox composition below, not a
  freestanding labeled input.
- **`responsive`**: vertical until the _ancestor `FieldGroup`_ crosses Tailwind's `@md`
  container breakpoint (`28rem` / `448px`), then behaves like `horizontal`. The query
  is on `FieldGroup`'s own box (`@container/field-group`), so it responds to how wide
  the form itself is laid out, not the browser window.

## Gotcha: `responsive` never goes horizontal inside this app's dialogs — omit it there

`DialogContent` caps at `sm:max-w-sm` (`24rem` / `384px`) minus its `p-4` padding —
about `352px` of content width, measured directly off the compiled CSS. That's under
the `448px` `@md` breakpoint, so **every `Field orientation="responsive"` inside a
`Dialog` renders vertically, always** — it's functionally identical to `vertical`
there. `responsive` only does anything on a wider container, e.g. a field laid out
directly in a `Saratoga.Column` or a page-embedded `Card` (see `user-profile-card.tsx`,
`admin/organization/settings/page.tsx`).

Since it's a no-op in every dialog, **omit `orientation` entirely on `Field`s inside a
`Dialog`** rather than writing `orientation="responsive"` — one less prop, same
render, and it sidesteps the `FieldError` gotcha below (which only bites in horizontal
mode). This has been applied across every dialog in the codebase; don't reintroduce it
in a new one. Fields laid out directly on a page (not in a `Dialog`) are a different
story — there the container can plausibly cross `448px`, so `responsive` still does
real work and should stay.

## Gotcha: a conditionally-rendered `FieldError` changes the column count in horizontal layout

Once a `Field` is actually in horizontal mode (`orientation="horizontal"`, or
`responsive` past the breakpoint — so this doesn't apply inside dialogs per above, but
does for page-embedded fields), it lays out as a flex **row of its direct children**.
`FieldError` is normally a direct child alongside `FieldLabel` and the control, so
toggling a validation error on and off doesn't make it wrap under the input — it adds
or removes a whole flex item, and the row visibly jumps between 2 and 3 columns
(`Label | Input` ↔ `Label | Input | Error`).

**Fix**: wrap the control and `FieldError` together in `FieldContent`, so they become
a single flex item. `FieldContent` is itself `flex flex-col`, so the error stacks
under the control inside that one column — the row stays 2 columns whether or not the
error is showing:

```tsx
<Field orientation="responsive" data-invalid={fieldState.invalid}>
  <FieldLabel htmlFor="name">Name</FieldLabel>
  <FieldContent>
    <Input id="name" aria-invalid={fieldState.invalid} {...field} />
    {fieldState.error && <FieldError errors={[fieldState.error]} />}
  </FieldContent>
</Field>
```

This is easy to miss because it's invisible in a dialog (see above) and invisible
whenever the error happens to already be showing at mount — it only appears mid-session,
when a field transitions from valid to invalid or back, in a container wide enough to
be horizontal.

## Composition: labeled input

```tsx
<Field data-invalid={fieldState.invalid}>
  <FieldLabel htmlFor="x">Name</FieldLabel>
  <Input id="x" aria-invalid={fieldState.invalid} {...field} />
  {fieldState.error && <FieldError errors={[fieldState.error]} />}
</Field>
```

`data-invalid` on `Field` cascades `text-destructive` to the label and error text via
CSS color inheritance — no need to color the label manually. `FieldError` takes an
`errors` array and de-dupes by message; pass `[fieldState.error]` even for one error.

## Composition: radio/checkbox option

The one deliberate use of plain `orientation="horizontal"`, because the thing to the
left is a fixed-size control, not a label competing for space:

```tsx
<Field orientation="horizontal">
  <RadioGroupItem value="owner" id="role-owner" />
  <FieldContent>
    <FieldLabel htmlFor="role-owner">Owner</FieldLabel>
    <FieldDescription>Full access to the organization.</FieldDescription>
  </FieldContent>
</Field>
```

See `AdminModule_CreateInvitation_Dialog`'s role picker for the real example.

## Composition: grouped fields

`FieldSet` + `FieldLegend` wraps a `FieldGroup` of related fields; `FieldSeparator`
(with optional children, e.g. `or`) draws a labeled divider between them. Straightforward,
no gotchas found.
