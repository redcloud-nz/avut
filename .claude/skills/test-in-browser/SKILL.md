---
name: test-in-browser
description: Use when verifying any change against the running local dev server in a real browser — nearly every page in AVUT sits behind auth, so this covers getting signed in first, plus switching accounts or impersonating a user to check role-/permission-gated behavior
---

# Test in Browser

## Overview

Almost every route in AVUT lives under `(authenticated)` and requires a session — there is no anonymous path into the app worth testing except the sign-in page itself and the public `(public)/policies` pages. So "open the app and look at it" always starts with getting authenticated, via `window.avut` rather than clicking through the sign-in form by hand.

`window.avut` (bound by `installDevTools()` in `src/client/dev-tools.ts`, wired up in `src/components/providers.tsx`) is a dev-only console API, reachable from a browser tool (e.g. `chrome-devtools-mcp`'s `evaluate_script`). It's only bound outside production (`NODE_ENV !== "production"`).

```ts
interface AvutDevTools {
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  impersonateUser: (params: { userId: string }) => Promise<void>;
  stopImpersonating: () => Promise<void>;
  getSession: () => Promise<AuthClientSession | null>;
}
```

Each function does a full navigation afterward (`signIn`/`signOut` follow the same `/auth/post-sign-in` / `/auth/sign-in` paths the real forms use; `impersonateUser`/`stopImpersonating` reload in place) — there's no in-tree way to reach React Query's cache or Next's RSC router cache from a plain console call, so a real page load is what guarantees nothing from the old identity lingers. Don't call these expecting an SPA-style transition; wait for the navigation before asserting on the resulting page.

## Prerequisites

1. **A running local dev server** — check with the user before starting one yourself; they usually already have one up (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` to check).
2. **A test account to sign in as**, and its password. For most testing any existing account works. Only impersonation additionally needs a global admin account (`User.role = "admin"`) — there should already be one at `delivered+admin-test@resend.dev`, confirmable with:
   ```
   psql "$POSTGRES_URL_NON_POOLING" -c "SELECT id, email, role FROM users WHERE role = 'admin';"
   ```
   (source `.env.local` first to get `POSTGRES_URL_NON_POOLING`). If none exists, ask the user rather than promoting an account yourself.
3. **The account's password**, stored at `DEV_ADMIN_TEST_PASSWORD` in `.env.local` for the admin test account (gitignored, local-only — this is deliberately not something to save into Claude's own memory).

## Usage

Plain sign-in, for testing anything that just needs _a_ logged-in session:

```js
await window.avut.signIn({ email: "...", password: "..." });
```

Switching identity to check role-/permission-gated UI, without needing separate credentials per role — sign in as the admin test account, then impersonate the target user:

```js
await window.avut.signIn({ email: "delivered+admin-test@resend.dev", password: "..." });

// Look up a target user id (psql, or Prisma Studio), then impersonate them
await window.avut.impersonateUser({ userId: "..." });

// Verify the session actually switched
const { user, session } = await window.avut.getSession();
// session.impersonatedBy is set while impersonating

// Drop back to the admin account
await window.avut.stopImpersonating();
```

To test a specific org role (`owner`, `member`, `i3-editor`, `skills-assessor`, `skill-package-author`, …), impersonate a user who holds that role via their `OrganizationUser.role` in the target org — `window.avut` only switches _who_ you are, not what role they hold in a given org.

## Common mistakes

- Trying to load an authenticated page before signing in — it will redirect to `/auth/sign-in`, which can look like the navigation "failed" when it actually just needs a `window.avut.signIn(...)` first.
- Calling `impersonateUser` from an account that isn't flagged `role: "admin"` — it will fail authorization.
- Assuming the promise resolving means the page is ready — the resulting navigation happens after, so snapshot/query the page only once it's landed.
- Reaching for this in production or against a non-local environment — `window.avut` won't exist there by design.
