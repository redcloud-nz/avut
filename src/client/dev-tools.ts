/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { authClient, type AuthClientSession } from "@/client/auth-client";
import { postSignInUrl, SIGN_IN_PATH } from "@/lib/auth-redirect";

export interface AvutDevTools {
    /** Sign in by email/password, then navigate through `/auth/post-sign-in` like the real form does. */
    signIn: (params: { email: string; password: string }) => Promise<void>;
    /** Sign out, then navigate to the sign-in page. */
    signOut: () => Promise<void>;
    /** Impersonate a user by id, then reload so every RSC and query cache reflects them. */
    impersonateUser: (params: { userId: string }) => Promise<void>;
    /** Drop impersonation and reload back to the real signed-in account. */
    stopImpersonating: () => Promise<void>;
    /** Read the current session — e.g. to confirm who you're signed in as, or that `impersonatedBy` is set. */
    getSession: () => Promise<AuthClientSession | null>;
}

declare global {
    interface Window {
        avut?: AvutDevTools;
    }
}

/**
 * Binds `window.avut` for driving the app from the browser console during local testing —
 * e.g. `await avut.impersonateUser({ userId: "..." })`.
 *
 * A full navigation (rather than a client-side transition) after each call is deliberate:
 * the app caches identity-scoped data in both React Query and Next's RSC router cache, and
 * there's no in-tree way to reach either from a plain console call, so a real page load is
 * the only way to guarantee nothing from the old identity lingers.
 */
export function installDevTools() {
    if (typeof window === "undefined" || window.avut) return;

    window.avut = {
        async signIn({ email, password }) {
            await authClient.signIn.email({ email, password }, { throw: true });
            window.location.href = postSignInUrl();
        },
        async signOut() {
            await authClient.signOut();
            window.location.href = SIGN_IN_PATH;
        },
        async impersonateUser({ userId }) {
            await authClient.admin.impersonateUser({ userId }, { throw: true });
            window.location.reload();
        },
        async stopImpersonating() {
            await authClient.admin.stopImpersonating({}, { throw: true });
            window.location.reload();
        },
        async getSession() {
            const session = await authClient.getSession({ fetchOptions: { throw: true } });
            return session ?? null;
        },
    };
}
