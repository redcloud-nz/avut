# Keyboard shortcuts rollout — design

## Context

A pilot (commit `d2acf1d`) added keyboard shortcuts to the admin personnel area
using `@tanstack/react-hotkeys`:

- Personnel list: `Alt+N` (new person), `/` (focus search)
- Person detail: `E` (edit), `Delete`, `A` (archive), `R` (restore) — this
  rollout re-keys these to the `Alt+<key>` scheme below (`Alt+E`,
  `Alt+Backspace`, `Alt+A`, `Alt+R`)
- Person menu: an "Edit" item, plus `<DropdownMenuShortcut>` badges via
  `formatForDisplay`
- `useHasPermission` was extracted from `<Protect>` so the permission boolean can
  gate a hotkey's `enabled`

This design extends that support to the other top-level entity pages and
replaces the pilot's copy-paste wiring with a small shared abstraction.

## Scope

**In:** the top-level list + detail/menu pages for: teams, invitations, users,
packages, groups, skills, sessions (personnel is already done and gets
retrofitted onto the new abstraction).

**Out (later pass):** nested sub-resource pages — team members, session
personnel/skills, package contents. Their add/remove dialogs have more varied
shapes.

## Key model

One canonical key per action verb, app-wide, defined once. Every dialog trigger
is `Alt+<key>`; only the two non-destructive, universally-conventional web
shortcuts (`/`, `?`) are bare keys.

| Verb        | Key             |
| ----------- | --------------- |
| `create`    | `Alt+N`         |
| `update`    | `Alt+E`         |
| `delete`    | `Alt+Backspace` |
| `archive`   | `Alt+A`         |
| `restore`   | `Alt+R`         |
| `publish`   | `Alt+P`         |
| `unpublish` | `Alt+U`         |
| `move`      | `Alt+M`         |
| search      | `/`             |
| help        | `?`             |

- `Alt+N` rather than `Mod+N` — Cmd/Ctrl+N is reserved by the browser/OS and
  can't be reliably `preventDefault`-ed.
- Everything is `Alt`-prefixed rather than a bare letter: `ignoreInputs` already
  stops a bare `E` firing inside a text field, but it would still fire when focus
  is on a button, link, table row, or the page body — one stray keystroke while
  tabbing a detail page opens a mutation dialog. `Alt+<key>` requires intent.
  Alt combos already default to `ignoreInputs: true`, so no loss there.
- Hotkey strings passed to the library must use uppercase keys (`"Alt+E"`,
  `"Alt+Backspace"`); matching is case-insensitive.
- On a US Mac layout Option+E/U/N are dead keys for accents — only relevant
  inside text inputs (which are ignored), and `preventDefault` covers the rest.

## Approach

Co-locate each shortcut with the component that already owns its action; only the
key assignments are centralised.

- **Menu items** already render `<Protect render={allowed => <DropdownMenuItem
onClick={() => setAction(verb, { history: "push" })} disabled={!allowed}>`. A
  new `<MenuAction>` component renders the item + a shortcut badge; the menu
  registers the hotkeys from one shared config array.
- **Create dialogs** already own `?action=create` and render their own
  `<DialogTrigger>`. They gain one `useActionHotkeys` call for `Alt+N`.
- **`/`** is owned by the Kaga table toolbar — every Kaga table gets it with no
  per-page wiring.
- **`?`** opens a help overlay mounted once app-wide.

### 1. `src/lib/hotkeys.ts` — registry

```ts
export const ActionHotkey = {
  create: "Alt+N",
  update: "Alt+E",
  delete: "Alt+Backspace",
  archive: "Alt+A",
  restore: "Alt+R",
  publish: "Alt+P",
  unpublish: "Alt+U",
  move: "Alt+M",
} as const satisfies Record<string, string>;

export type ActionVerb = keyof typeof ActionHotkey;

export const SEARCH_HOTKEY = "/";
export const HELP_HOTKEY: RawHotkey = { key: "?", shift: true };

// Group shortcuts in the help overlay by entity.
declare module "@tanstack/hotkeys" {
  interface HotkeyMeta {
    category?: string;
  }
}
```

### 2. `src/hooks/use-action-hotkeys.ts`

```ts
export interface ActionHotkeyEntry {
  verb: ActionVerb;
  run: () => void;
  enabled?: boolean; // default true
  name: string; // help-overlay row label, e.g. "Edit"
  category?: string; // help-overlay group, e.g. "Person"
}

export function useActionHotkeys(entries: ActionHotkeyEntry[]): void {
  useHotkeys(
    entries.map(({ verb, run, enabled = true, name, category }) => ({
      hotkey: ActionHotkey[verb],
      callback: () => run(),
      options: { enabled, preventDefault: true, meta: { name, category } },
    })),
  );
}
```

`useHotkeys` (array form) is a single hook call, safe with a variable-length
list. Callbacks are synced every render, so closures stay fresh.

### 3. `<MenuAction>` — `src/components/ui/menu-action.tsx`

`<MenuAction>` is **pure** — it renders the item + a `<DropdownMenuShortcut>`
badge from the registry and nothing else:

```tsx
interface MenuActionProps {
  verb: ActionVerb;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export function MenuAction({
  verb,
  label,
  icon,
  onSelect,
  disabled,
  destructive,
}: MenuActionProps) {
  return (
    <DropdownMenuItem
      onClick={onSelect}
      disabled={disabled}
      className={destructive ? "text-destructive focus:text-destructive" : undefined}
    >
      {icon}
      {label}
      <DropdownMenuShortcut>{formatForDisplay(ActionHotkey[verb])}</DropdownMenuShortcut>
    </DropdownMenuItem>
  );
}
```

**It does NOT self-register its hotkey.** A Radix `DropdownMenuContent` only
mounts its children while the menu is open, so a self-registered `useHotkey`
inside `<MenuAction>` would only work _after_ opening the menu once — useless.

Instead the hosting menu builds one `actions` config array and drives both the
hotkeys and the render from it, at its always-mounted top level:

```tsx
const canUpdate = useHasPermission({ person: ["update"] });
const canDelete = useHasPermission({ person: ["delete"] });

const actions: MenuActionConfig[] = [
  {
    verb: "update",
    label: "Edit",
    icon: <ObjectIcons.Edit />,
    run: () => setAction("update", { history: "push" }),
    disabled: !canUpdate,
  },
];
if (person.status === "Active")
  actions.push({
    verb: "archive",
    label: "Archive",
    icon: <ObjectIcons.Archive />,
    run: handleArchive,
    disabled: !canUpdate,
  });
else
  actions.push({
    verb: "restore",
    label: "Restore",
    icon: <ObjectIcons.Restore />,
    run: handleRestore,
    disabled: !canUpdate,
  });
if (person.status !== "Archived")
  actions.push({
    verb: "delete",
    label: "Delete",
    icon: <ObjectIcons.Delete />,
    run: () => setAction("delete", { history: "push" }),
    disabled: !canDelete,
    destructive: true,
  });

useActionHotkeys(
  actions.map(({ verb, label, run, disabled }) => ({
    verb,
    run,
    enabled: !disabled,
    name: label,
    category: "Personnel",
  })),
);

// render: {actions.map((a) => <MenuAction key={a.verb} {...a} onSelect={a.run} />)}
```

- The `actions` array is filtered by record status before it reaches
  `useActionHotkeys`, so archive and restore are never both live.
- `run` is any callback — `setAction(verb, …)` for param-driven dialogs, or a
  direct mutation handler (personnel archive/restore).
- `useActionHotkeys` uses the library's `useHotkeys` array form — one hook call,
  safe with a variable-length array.

### 4. Kaga owns `/`

`KagaTableToolbar` renders a `<KagaSearchHotkey />`
(`src/components/blocks/kaga-search-hotkey.tsx`, `"use client"`, returns `null`)
that registers:

```tsx
useHotkey(
  SEARCH_HOTKEY,
  () => {
    document
      .querySelector<HTMLInputElement>(
        '[data-slot="table-toolbar"] [data-slot="input-group-control"]',
      )
      ?.focus();
  },
  { preventDefault: true, meta: { name: "Focus search", category: "Table" } },
);
```

Split into its own client component so `kaga.tsx` stays hook-free / needs no
`"use client"`. A document-scoped query (one Kaga table per page) avoids
threading a ref through the shared toolbar. Single key → `ignoreInputs` default
keeps it from firing while another field is focused; `preventDefault` stops the
`/` landing in the input on focus.

### 5. Create dialogs own `Alt+N`

In each `create-*.tsx`:

```tsx
const canCreate = useHasPermission({ <entity>: ["create"] });
useActionHotkeys([
    {
        verb: "create",
        run: () => handleOpenChange(true), // existing helper; some are named handleDialogOpenChange
        enabled: canCreate,
        name: "New <entity>",
        category: "<Entity>",
    },
]);
```

The create dialog is already rendered only inside `<Protect permissions={{
<entity>: ["create"] }}>` on every list page, so `canCreate` is belt-and-braces.

### 6. `?` help overlay — `src/components/hotkey-help.tsx`

**Two components on purpose** — see the render-loop note below.

```tsx
export function HotkeyHelp() {
  const [open, setOpen] = useState(false);
  useHotkey(HELP_HOTKEY, () => setOpen((v) => !v), {
    preventDefault: true,
    meta: { name: "Show keyboard shortcuts", category: "General" },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>… {open && <HotkeyHelpList />} …</DialogContent>
    </Dialog>
  );
}

function HotkeyHelpList() {
  // ONE-TIME snapshot on mount — not useHotkeyRegistrations().
  const groups = useMemo(() => {
    for (const reg of getHotkeyManager().registrations.state.values()) {
      if (reg.options.enabled === false) continue;
      // group by reg.options.meta?.category ?? "General",
      // row = { key: formatForDisplay(reg.hotkey), name: reg.options.meta?.name ?? … }
    }
    // …
  }, []);
  // …
}
```

`HELP_HOTKEY = { key: "?", shift: true }` — the library does **exact** modifier
matching (`event.shiftKey !== parsed.shift → no match`), and a real `?` keydown
always carries Shift. `{ key: "?" }` alone never fires.

Mounted once in `providers.tsx`, inside a new `HotkeysProvider`. It goes inside
`NuqsAdapter` (shortcuts call `setAction`) and `QueryClientProvider`.

#### `@tanstack/hotkeys` render-loop (issue #113)

`useHotkey`/`useHotkeys` call `handle.setOptions(...)` **during render, every
render**, and `setOptions` rebuilds the registrations-store `Map`
**unconditionally** (no equality check). Consequences:

- A component that both **subscribes** (`useHotkeyRegistrations`) and
  **registers** (`useHotkey`) re-renders forever — a hard browser freeze
  (synchronous via `useSyncExternalStore`, so React's max-update-depth guard
  doesn't fire).
- Even split into a register-parent + subscribe-child, the parent rendering
  while the child is mounted throws React's "cannot update a component while
  rendering a different component".

**Resolution:** `HotkeyHelpList` never observes the store — it takes a one-time
snapshot of `getHotkeyManager().registrations.state` when it mounts (i.e. when
the overlay opens). Shortcuts don't change while you stare at the modal.
Upstream fix (`#141`, move the write to an effect) was closed unmerged.

## Rollout

**Phased.** Phase 1 = all the infrastructure + retrofit **personnel** onto it
(`hotkeys.ts`, `use-action-hotkeys.ts`, `menu-action.tsx`,
`kaga-search-hotkey.tsx`, `hotkey-help.tsx`, `providers.tsx`, `kaga.tsx`,
`create-person.tsx`, `person-menu.tsx`, `personnel-list.tsx`) — **done**,
validated in-browser 2026-09-01. Phase 2 = the remaining create dialogs and
menus below, once phase 1 is confirmed good in real use.

| File                                                                                                                                                | Change                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/hotkeys.ts`                                                                                                                                | new — registry + `HotkeyMeta` augmentation                                                                                                       |
| `src/hooks/use-action-hotkeys.ts`                                                                                                                   | new — `useActionHotkeys`                                                                                                                         |
| `src/components/ui/menu-action.tsx`                                                                                                                 | new — `<MenuAction>` (pure item + shortcut badge)                                                                                                |
| `src/components/blocks/kaga-search-hotkey.tsx`                                                                                                      | new — `/` focuses the Kaga search input                                                                                                          |
| `src/components/hotkey-help.tsx`                                                                                                                    | new — `?` overlay                                                                                                                                |
| `src/components/providers.tsx`                                                                                                                      | `HotkeysProvider` + `<HotkeyHelp>`                                                                                                               |
| `src/components/blocks/kaga.tsx`                                                                                                                    | `/` → focus search in `KagaTableToolbar`                                                                                                         |
| `create-person.tsx`, `create-team.tsx`, `create-invitation.tsx`, `create-package.tsx`, `create-group.tsx`, `create-skill.tsx`, `create-session.tsx` | `Alt+N` via `useActionHotkeys`                                                                                                                   |
| `person-menu.tsx`, `team-menu.tsx`, `session-menu.tsx`, `group-menu.tsx`, `package-menu.tsx`, `skill-menu.tsx`                                      | items → `<MenuAction>`                                                                                                                           |
| `personnel-list.tsx`                                                                                                                                | revert pilot hotkeys (`Alt+N` → create-person, `/` → Kaga); drop `tableRef`, `useRef`, the `useHasPermission`/`useQueryState` added in the pilot |

## Constraints / notes

- `skill-menu` has no edit dialog → no `Alt+E` there.
- `group`/`package`/`skill` menus parse entity-agnostic verbs
  (`archive`/`restore`/`publish`/`unpublish`) — safe because only one such menu
  renders per page (per `docs/patterns/mutation-dialog.md`).
- `users-list` has no create dialog → no `Alt+N`.
- `<MenuAction>` is pure (no hooks), so `{actions.map(...)}` in the menu body is
  fine. The **hotkey registration** goes through one `useActionHotkeys(...)` call
  at the menu's top level (`useHotkeys` array form), never inside `<MenuAction>` —
  a Radix menu only mounts its content while open.
- Personnel archive/restore are direct mutations, not param dialogs — a config
  entry with `run: handleArchive` handles that with no special-casing.

## Testing

Manual, against the running dev server (`test-in-browser`):

- Each list page: `Alt+N` opens the create dialog, `/` focuses search, neither
  fires while typing in a field, `Alt+N` absent without create permission.
- Each detail page: `Alt+E`/`Alt+Backspace`/`Alt+A`/`Alt+R`/`Alt+P`/`Alt+U`/
  `Alt+M` as applicable open the right dialog; disabled/absent without permission
  or when the record status doesn't allow it; menu badges show the right combo.
- `?` opens the overlay and lists only currently-active shortcuts, grouped.

No unit tests — UI-only wiring. Run `npx tsc --noEmit`, `npm run lint`,
`npm run test:run` for the `<Protect>`/`useHasPermission` refactor.
