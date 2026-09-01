/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "./auth";

/**
 * Assert that the current user is a site-wide administrator (Better Auth `admin`
 * plugin — `session.user.role === "admin"`). This is distinct from the org-scoped
 * permission system in `organization-access.ts`.
 *
 * Redirects to `/` when there is no session or the user is not a global admin.
 *
 * No standalone unit test: `@/server/auth` imports `server-only` and cannot be
 * loaded in the jsdom test env, and there is no existing `src/server/*-access.test.ts`
 * mocking pattern to mirror. Coverage comes from the `system-admin/layout.tsx`
 * integration and from the `systemAdminProcedure` tests, which exercise the same
 * `role === "admin"` gate.
 */
export async function requireGlobalAdmin() {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session || session.user.role !== "admin") redirect("/");
    return { user: session.user };
}
