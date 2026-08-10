# Research: `better-auth-ui` security settings components

Investigation of how `better-auth-ui` (https://better-auth-ui.com) implements its `ChangePassword`, `LinkedAccounts`, and `ActiveSessions` security-settings components, to inform hand-rolling equivalents in avut without taking the dependency.

**Method**: created a throwaway git worktree + branch (`research/better-auth-ui`, deleted after this report was written), ran `npx shadcn@latest add @better-auth-ui/all` to pull the real component source (not just compiled JS) into `src/components/auth/settings/security/`, and read it alongside `node_modules/@better-auth-ui/react/src` for the underlying data hooks. No `better-auth-ui` dependency was ever installed into `avut`'s own `package.json`.

**Source layout found**:

```
src/components/auth/settings/security/
  security-settings.tsx    # composes the three cards below
  change-password.tsx      # ChangePassword / SetPassword / ChangePasswordForm
  linked-accounts.tsx      # LinkedAccounts (card) + AccountRowSkeleton
  linked-account.tsx       # LinkedAccount (single row: link/unlink)
  active-sessions.tsx      # ActiveSessions (card) + SessionRowSkeleton
  active-session.tsx       # ActiveSession (single row: revoke/sign out)
```

All three "card" components are thin: they hold no bespoke API-calling logic of their own. All real work is delegated to hooks from `@better-auth-ui/react`, which in turn are TanStack Query `useMutation`/`useQuery` wrappers around plain `better-auth` client methods (`authClient.changePassword`, `.listAccounts`, `.linkSocial`, `.unlinkAccount`, `.listSessions`, `.revokeSession`). There is no custom transport or protocol — it's the same `better-auth` client surface avut already uses.

---

## 1. ChangePassword

**File**: `change-password.tsx`

**better-auth APIs used**: `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions })`, plus `authClient.listAccounts()` (to detect whether the user has a `credential` account) and `authClient.requestPasswordReset()` for the "set password" fallback.

**Structure**:

- `ChangePassword` is a router component: it calls `useListAccounts` to check `accounts.some(a => a.providerId === "credential")`. If the user has _no_ credential account (social-only signup), it renders `SetPassword` instead of a change-password form.
- `SetPassword` shows a card explaining the user needs to set a password, with a button that calls `useRequestPasswordReset` (i.e. sends a password-reset email) rather than accepting a typed password directly — this sidesteps ever needing a "current password" for someone who's never had one.
- `ChangePasswordForm` is the actual form: three fields (current, new, confirm — confirm only rendered if `emailAndPassword.confirmPassword` is enabled in config), each wrapped in an `InputGroup` with a show/hide-password icon toggle button and per-field client-side error state (`fieldErrors`) populated from the native `onInvalid` HTML5 validation event rather than a schema validator.
- On submit: mismatched confirm-password shows a toast (no schema lib — plain string comparison) and clears all three fields; otherwise calls `useChangePassword` (wraps `authClient.changePassword`) with **`revokeOtherSessions: true` hardcoded** — every password change kills all other sessions, unconditionally, no checkbox.
- All three fields are cleared on both success and error.

**Notable pattern**: no react-hook-form/zod — validation is native HTML5 (`required`, `minLength`/`maxLength` from `emailAndPassword.minPasswordLength`/`maxPasswordLength` config) plus a manual mismatch check. Session-list and password-form loading states are both gated on `session` being loaded (fields render as `<Skeleton>` until then).

**Comparison to avut**: `src/components/user-settings/user-security-settings.tsx` already has a materially equivalent `ChangePassword_Card` — react-hook-form + zod (stricter/more idiomatic for this codebase than better-auth-ui's native-validation approach), `authClient.changePassword`, and a `revokeOtherSessions` **checkbox** (avut makes it opt-in via UI rather than hardcoding `true`). avut's `SetPassword_Card` exists but is a dead-end (just a warning, no reset-request action) — the one meaningful gap is wiring it to `authClient.requestPasswordReset(...)` the way better-auth-ui's `SetPassword` does, so social-only users have a path to gaining a password rather than a "you can't do anything" dead-end.

**Recommendation**: keep avut's existing form (react-hook-form/zod fits repo conventions better and the `revokeOtherSessions` checkbox is arguably better UX than hardcoding it). Only borrow one behavior: give `SetPassword_Card` a working "Send password-reset email" button calling `authClient.requestPasswordReset({ email, redirectTo })`.

---

## 2. LinkedAccounts

**Files**: `linked-accounts.tsx` (card/list) + `linked-account.tsx` (row)

**better-auth APIs used**: `authClient.listAccounts()`, `authClient.linkSocial({ provider, callbackURL })`, `authClient.unlinkAccount({ providerId })`, and a non-standard extra — `useAccountInfo` calls a `getAccountInfo`/`accountInfo` endpoint (`{ query: { accountId } }`) to fetch the _provider's_ profile info (login/username/email) for display, which is not part of avut's current usage.

**Structure**:

- `LinkedAccounts` fetches `accounts` via `useListAccounts`, filters out the `credential` provider (that's the password account, not a social link), and builds a **merged row list**: already-linked accounts first, then any configured `socialProviders` not yet linked (so unlinked providers still show up as a "Link" row, not just linked ones). If `multipleAccountsPerProvider === false` (the default), already-linked provider ids are excluded from the "available to link" set.
- Rows render inside an `ItemGroup`/`Item` list (shadcn `Item` primitives), not a table — icon, provider display name, and a link/unlink button per row, with `ItemSeparator` between rows.
- `LinkedAccount` (row): resolves the provider's icon from a `providerIcons` map, computes a `displayName` preferring the provider-fetched `login`/`username`/`email`/`name` over the raw account id, and renders either an "Unlink" button (`useUnlinkAccount`) or a "Link" button (`useLinkSocial`, passing `callbackURL: baseURL + window.location.pathname` so the user round-trips back to the same settings page after the OAuth flow).
- Toast on successful unlink only (`localization.settings.accountUnlinked`); link has no success toast since it navigates away for the OAuth redirect.

**Comparison to avut**: avut's `LinkedAccounts_Card` in `user-security-settings.tsx` is **commented out and inert** — hardcodes `github`/`google` (not `apple`, despite importing its icon) with `isLinked` passed in as a prop but the Link/Unlink buttons have **no `onClick` handlers at all**. There's also a separate, unrelated `UserLinkedAccounts_Card` in `src/components/cards/user-linked-accounts.tsx` — a read-only server-component table (`auth.api.listUserAccounts`) with no link/unlink actions, unclear if it's mounted anywhere; it's redundant with the settings-page work and should probably be deleted once the settings-page version is wired up.

**Recommendation**: revive `LinkedAccounts_Card`, keep its existing `Item`-based layout (avut already uses the same shadcn `Item` primitives), but:

1. Wire real handlers: `authClient.linkSocial({ provider, callbackURL: window.location.href })` and `authClient.unlinkAccount({ providerId })` via `useMutation`, invalidating the `["user", "linkedAccounts"]` query key on success (matches the existing `accountsQuery` key in the same file).
2. Derive the provider list from avut's actual configured `socialProviders` (github, google per `src/server/auth.ts`) instead of hardcoding three including an unconfigured `apple`.
3. Skip better-auth-ui's `useAccountInfo`/provider-profile-fetch step unless there's a real need to show the linked GitHub/Google username — it's an extra network call for a display-only nicety; showing "Linked" (as avut's current stub already does) is simpler and sufficient.
4. Delete `src/components/cards/user-linked-accounts.tsx` once the settings-page card is live, to avoid two divergent implementations.

---

## 3. ActiveSessions

**Files**: `active-sessions.tsx` (card/list) + `active-session.tsx` (row)

**better-auth APIs used**: `authClient.listSessions()`, `authClient.revokeSession({ token })` (the row passes the whole `activeSession` object, which includes `token`), and `authClient.session`/current-session comparison via `useSession`. No `multiSession` plugin is required for this — `listSessions`/`revokeSession` are core better-auth session APIs, available regardless of whether multi-session (multiple _concurrently active_ logged-in accounts) is enabled. This lines up with avut's config: `multiSession` isn't enabled, but that's irrelevant here — this is single-account, multi-_device_ session listing, which works out of the box.

**Structure**:

- `ActiveSessions` fetches `sessions` via `useListSessions`, sorts so the session matching the current `session.session.id` sorts first, and renders each in an `Item` row list (same `ItemGroup`/`Item` pattern as LinkedAccounts).
- `ActiveSession` (row) parses `activeSession.userAgent` with the `bowser` library to get browser name + OS, picks a `Monitor`/`Smartphone` icon based on `ua.platform.type`, and shows either a "Current session" badge (if `activeSession.token === session.session.token`) or a relative "time ago" string (hand-rolled via `Intl.RelativeTimeFormat`, no date library) for `createdAt`.
- The action button is dual-purpose: on the **current** session it signs the user out (`navigate` to the sign-out view) instead of revoking; on **other** sessions it calls `useRevokeSession` to kill just that one. This prevents a confusing self-revoke-while-still-mid-request situation and reuses the button for "log out" semantics on your own row.
- No confirmation dialog before revoke — a single click on "Revoke" fires the mutation.

**Comparison to avut**: this is entirely new territory — no `listSessions`/`revokeSession` usage exists anywhere in avut yet.

**Recommendation**: build a new `ActiveSessions_Card` in `user-security-settings.tsx` (or a new file if the settings file gets too large) following the same shape:

- `useQuery` on `authClient.listSessions()`, keyed e.g. `["user", "sessions"]`.
- Reuse avut's existing `Item`/`ItemMedia`/`ItemActions` primitives (already used by the linked-accounts stub) rather than a table, for visual consistency with LinkedAccounts.
- For device/browser parsing, `bowser` isn't currently a dependency — either add it (it's small, MIT-licensed, actively used by better-auth-ui itself) or write a much simpler regex-based UA sniff if only browser vs. OS is needed; not worth over-engineering.
- Mirror the current-session vs. other-session button distinction (sign-out vs. revoke) — it's a real UX consideration, not incidental complexity.
- Unlike better-auth-ui, consider a confirmation step (e.g. avut's existing `AlertDialog` primitive) before revoking a session, since it's a destructive, irreversible-without-re-login action and avut's other destructive actions in the codebase generally confirm first.
