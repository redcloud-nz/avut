/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { forbidden } from "next/navigation";

import { requireSession } from "./session";

/**
 * Assert that the current user is a site-wide administrator (Better Auth `admin`
 * plugin — `session.user.role === "admin"`). This is distinct from the org-scoped
 * permission system in `organization-access.ts`.
 *
 * Uses the request-cached `requireSession()` so nested layouts + the page share a
 * single session lookup; `requireSession()` also handles the signed-out → sign-in
 * redirect. A non-admin raises Next's `forbidden()` interrupt (this repo enables
 * `experimental.authInterrupts` and ships `src/app/forbidden.tsx`), mirroring
 * `assertPermission` in `organization-access.ts` rather than a bare redirect.
 *
 * No standalone unit test: `@/server/auth` (transitively pulled in via
 * `./session`) imports `server-only` and cannot be loaded in the jsdom test env,
 * and there is no existing `src/server/*-access.test.ts` mocking pattern to
 * mirror. Coverage comes from the `system-admin/layout.tsx` integration and the
 * `systemAdminProcedure` tests, which exercise the same `role === "admin"` gate.
 */
export async function requireGlobalAdmin() {
    const session = await requireSession();
    if (session.user.role !== "admin") forbidden();
    return { user: session.user };
}
