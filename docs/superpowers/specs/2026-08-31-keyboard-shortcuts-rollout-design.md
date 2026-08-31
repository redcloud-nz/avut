# Keyboard shortcuts rollout — design

## Context

A pilot (commit `d2acf1d`) added keyboard shortcuts to the admin personnel area
using `@tanstack/react-hotkeys`:

- Personnel list: `Alt+N` (new person), `/` (focus search)
- Person detail: `E` (edit), `Delete`, `A` (archive), `R` (restore)
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

One canonical key per action verb, app-wide, defined once:

| Verb        | Key      |
| ----------- | -------- |
| `create`    | `Alt+N`  |
| `update`    | `E`      |
| `delete`    | `Delete` |
| `archive`   | `A`      |
| `restore`   | `R`      |
| `publish`   | `P`      |
| `unpublish` | `U`      |
| `move`      | `M`      |
| search      | `/`      |
| help        | `?`      |

`Alt+N` rather than `Mod+N` — Cmd/Ctrl+N is reserved by the browser/OS and can't
be reliably `preventDefault`-ed. Hotkey strings passed to the library must use
uppercase keys (`"E"`, `"Alt+N"`); matching is case-insensitive.

## Approach

Co-locate each shortcut with the component that already owns its action; only the
key assignments are centralised.

- **Menu items** already render `<Protect render={allowed => <DropdownMenuItem
onClick={() => setAction(verb, { history: "push" })} disabled={!allowed}>`. A
  new `<MenuAction>` component collapses that to one line and adds the hotkey +
  shortcut badge.
- **Create dialogs** already own `?action=create` and render their own
  `<DialogTrigger>`. They gain one `useActionHotkeys` call for `Alt+N`.
- **`/`** is owned by the Kaga table toolbar — every Kaga table gets it with no
  per-page wiring.
- **`?`** opens a help overlay mounted once app-wide.

### 1. `src/lib/hotkeys.ts` — registry

```ts
export const ActionHotkey = {
  create: "Alt+N",
  update: "E",
  delete: "Delete",
  archive: "A",
  restore: "R",
  publish: "P",
  unpublish: "U",
  move: "M",
} as const satisfies Record<string, string>;

export type ActionVerb = keyof typeof ActionHotkey;

export const SEARCH_HOTKEY = "/";
export const HELP_HOTKEY = "?";

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

### 3. `<MenuAction>` — `src/components/ui/menu-action-item.tsx`

```tsx
interface MenuActionProps {
  verb: ActionVerb;
  permissions: Permissions;
  category: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
}

export function MenuAction({
  verb,
  permissions,
  category,
  label,
  icon,
  onSelect,
  destructive,
}: MenuActionProps) {
  const allowed = useHasPermission(permissions);

  useHotkey(ActionHotkey[verb], () => onSelect(), {
    enabled: allowed,
    preventDefault: true,
    meta: { name: label, category },
  });

  return (
    <DropdownMenuItem
      onClick={onSelect}
      disabled={!allowed}
      className={destructive ? "text-destructive focus:text-destructive" : undefined}
    >
      {icon}
      {label}
      <DropdownMenuShortcut>{formatForDisplay(ActionHotkey[verb])}</DropdownMenuShortcut>
    </DropdownMenuItem>
  );
}
```

- Self-registers its hotkey. Menus render `<MenuAction>` conditionally on record
  status (`{status === "Active" && <MenuAction verb="archive" … />}`); the
  mount/unmount naturally enables/disables the hotkey. This keeps the archive and
  restore hotkeys from both being live at once.
- `onSelect` is any callback: `() => setAction("archive", { history: "push" })`
  for param-driven dialogs, or a direct handler (personnel archive/restore call
  a mutation directly).
- Each `<MenuAction>` is a stable, non-`.map`-ed JSX child in every menu, so the
  `useHotkey` call order is stable.

### 4. Kaga owns `/`

In `KagaTableToolbar`: a `ref` on the search `InputGroupInput` (ref passes
through `InputGroupInput` → `Input` → `<input>` in React 19; fall back to a
wrapper-`div` `querySelector('input')` if the ref chain doesn't hold), and

```tsx
useHotkey(SEARCH_HOTKEY, () => inputRef.current?.focus(), {
  preventDefault: true,
  meta: { name: "Focus search", category: "Table" },
});
```

Single key → the library's `ignoreInputs` default keeps it from firing while
another field is focused; `preventDefault` stops the `/` landing in the input on
focus.

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

```tsx
export function HotkeyHelp() {
  const [open, setOpen] = useState(false);
  useHotkey(HELP_HOTKEY, () => setOpen((v) => !v), { preventDefault: true });

  const { hotkeys } = useHotkeyRegistrations();
  const active = hotkeys.filter((h) => h.options.enabled !== false);
  // group by h.options.meta?.category ?? "General", row = formatForDisplay(h.hotkey) + meta.name

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      …
    </Dialog>
  );
}
```

Mounted once in `providers.tsx`, inside a new `HotkeysProvider` that supplies
default options (and enables TanStack Hotkeys devtools in dev). `HotkeysProvider`
goes inside `NuqsAdapter` (shortcuts call `setAction`) and `QueryClientProvider`.

## Rollout

| File                                                                                                                                                | Change                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/hotkeys.ts`                                                                                                                                | new — registry + `HotkeyMeta` augmentation                                                                                                       |
| `src/hooks/use-action-hotkeys.ts`                                                                                                                   | new — `useActionHotkeys`                                                                                                                         |
| `src/components/ui/menu-action-item.tsx`                                                                                                            | new — `<MenuAction>`                                                                                                                             |
| `src/components/hotkey-help.tsx`                                                                                                                    | new — `?` overlay                                                                                                                                |
| `src/components/providers.tsx`                                                                                                                      | `HotkeysProvider` + `<HotkeyHelp>`                                                                                                               |
| `src/components/blocks/kaga.tsx`                                                                                                                    | `/` → focus search in `KagaTableToolbar`                                                                                                         |
| `create-person.tsx`, `create-team.tsx`, `create-invitation.tsx`, `create-package.tsx`, `create-group.tsx`, `create-skill.tsx`, `create-session.tsx` | `Alt+N` via `useActionHotkeys`                                                                                                                   |
| `person-menu.tsx`, `team-menu.tsx`, `session-menu.tsx`, `group-menu.tsx`, `package-menu.tsx`, `skill-menu.tsx`                                      | items → `<MenuAction>`                                                                                                                           |
| `personnel-list.tsx`                                                                                                                                | revert pilot hotkeys (`Alt+N` → create-person, `/` → Kaga); drop `tableRef`, `useRef`, the `useHasPermission`/`useQueryState` added in the pilot |

## Constraints / notes

- `skill-menu` has no edit dialog → no `E` there.
- `group`/`package`/`skill` menus parse entity-agnostic verbs
  (`archive`/`restore`/`publish`/`unpublish`) — safe because only one such menu
  renders per page (per `docs/patterns/mutation-dialog.md`).
- `users-list` has no create dialog → no `Alt+N`.
- `<MenuAction>` must stay a direct conditional child in each menu, never inside
  a `.map`, to keep `useHotkey` order stable.
- Personnel archive/restore are direct mutations, not param dialogs —
  `<MenuAction onSelect={handleArchive}>` handles that with no special-casing.

## Testing

Manual, against the running dev server (`test-in-browser`):

- Each list page: `Alt+N` opens the create dialog, `/` focuses search, neither
  fires while typing in a field, `Alt+N` absent without create permission.
- Each detail page: `E`/`Delete`/`A`/`R`/`P`/`U`/`M` as applicable open the right
  dialog; disabled/absent without permission or when the record status doesn't
  allow it; menu badges show the right combo.
- `?` opens the overlay and lists only currently-active shortcuts, grouped.

No unit tests — UI-only wiring. Run `npx tsc --noEmit`, `npm run lint`,
`npm run test:run` for the `<Protect>`/`useHasPermission` refactor.
