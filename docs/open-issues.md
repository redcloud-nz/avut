# Open Issues

Known code-level follow-ups not yet filed as GitHub issues — the holding pen for
recognised debt that's too small or too internal for a real issue. Delete an
entry in the PR that resolves it. For anything user-facing or cross-cutting,
file a GitHub issue (`redcloud-nz/avut`) or an entry under `docs/ideas/` instead.

## Teams

- [ ] The team actions menu (`src/components/admin/teams/team-menu.tsx`) only
      has **Delete** and the D4H group — it should also offer **Edit** and
      **Archive** actions.

## Skill Track

- [ ] Skill package **unsubscribe** should be treated as a destructive action —
      appropriately styled/placed button, ideally a confirm dialog. It will later
      delete package customisation, which is unrecoverable.
- [ ] The skill package catalogue page shows `Skills` in the breadcrumbs; it
      should be `Skill Track` (the module label).

## Personnel / people

- [ ] Person↔user linking should be reachable from **both** the person detail
      page and the user detail page (currently only one direction).
- [ ] The person picker in "link person" (`src/components/admin/users/link-person.tsx`)
      appears not to work — investigate.
- [ ] Allow adding a person to a team directly from the personnel page.
- [ ] Person archive and restore should go through confirm dialogs rather than
      firing direct mutations.
- [ ] Person **delete** should be available for an already-archived person.

## System admin

- [ ] Add hotkey support to the system-admin users and organisations pages
      (extends the personnel keyboard-shortcuts pilot).
- [ ] System-admin role assignment doesn't support assigning multiple roles.
