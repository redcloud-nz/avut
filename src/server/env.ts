/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

/**
 * Secrets and server-only settings. The counterpart of `@/lib/env`, and the only other place
 * under `src/` that reads `process.env` — see there for why every read is a getter, and why an
 * empty string counts as unset.
 *
 * Variables the code can't run without use `required()`: reading one that isn't set throws an
 * error that names it. Variables with a sensible fallback, or that only matter on some paths
 * (OAuth providers, the delivery override), return `undefined` and leave the decision to the
 * caller.
 */

function text(value: string | undefined): string | undefined {
    return value === "" ? undefined : value;
}

function required(name: string, value: string | undefined): string {
    const present = text(value);
    if (present === undefined) throw new Error(`The ${name} environment variable is not set.`);
    return present;
}

export const serverEnv = {
    /** Public origin of the app, for better-auth. Falls back to localhost in the caller. */
    get BETTER_AUTH_URL() {
        return text(process.env.BETTER_AUTH_URL);
    },
    get GITHUB_OAUTH_CLIENT_ID() {
        return text(process.env.GITHUB_OAUTH_CLIENT_ID);
    },
    get GITHUB_OAUTH_CLIENT_SECRET() {
        return text(process.env.GITHUB_OAUTH_CLIENT_SECRET);
    },
    get GOOGLE_OAUTH_CLIENT_ID() {
        return text(process.env.GOOGLE_OAUTH_CLIENT_ID);
    },
    get GOOGLE_OAUTH_CLIENT_SECRET() {
        return text(process.env.GOOGLE_OAUTH_CLIENT_SECRET);
    },

    get RESEND_API_KEY() {
        return required("RESEND_API_KEY", process.env.RESEND_API_KEY);
    },
    /** From-address for system mail. Falls back to the default in `email.ts`. */
    get NOREPLY_EMAIL() {
        return text(process.env.NOREPLY_EMAIL);
    },
    /** `live` or `redirect` forces the outbound-email mode; anything else defers to `VERCEL_ENV`. */
    get EMAIL_DELIVERY() {
        return text(process.env.EMAIL_DELIVERY);
    },

    /** Key material for `encryptDBValue` / `decryptDBValue`. Validated by `encrypt.ts`. */
    get DB_ENCRYPTION_SECRET() {
        return text(process.env.DB_ENCRYPTION_SECRET);
    },
} as const;
