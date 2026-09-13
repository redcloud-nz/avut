/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { signInUrl } from "@/lib/auth-redirect";
import { CURRENT_PATH_HEADER } from "@/lib/constants";

import { auth, AuthSession } from "./auth";

/**
 * Resolve the current session.
 *
 * Wrapped in React `cache` so the whole render tree — the authenticated layout, the
 * organization layout, a module layout and the page itself — costs a single lookup.
 */
export const getSession = cache(async (): Promise<AuthSession | null> => {
    return await auth.api.getSession({ headers: await nextHeaders() });
});

/**
 * Require an authenticated session, redirecting to sign-in when there isn't one.
 *
 * The return path comes from the header the proxy injects on every request, so callers
 * don't have to thread it through. `redirect()` throws, so the return type narrows for
 * everything downstream.
 */
export async function requireSession(): Promise<AuthSession> {
    const session = await getSession();

    if (!session) {
        const headers = await nextHeaders();
        redirect(signInUrl(headers.get(CURRENT_PATH_HEADER)));
    }

    return session;
}

/**
 * Whether there's a currently active, DB-validated session — deliberately not the cheap
 * `getSessionCookie()` presence check, so a stale or revoked cookie doesn't read as active.
 * Shares `getSession()`'s `cache()` wrapper, so calling this alongside another session lookup
 * on the same request doesn't cost an extra DB round trip.
 */
export async function hasActiveSession(): Promise<boolean> {
    return (await getSession()) != null;
}
