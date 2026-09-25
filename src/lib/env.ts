/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Environment variables that are safe in any bundle: build and platform facts (Vercel, GitHub
 * Actions) and `NEXT_PUBLIC_` configuration. Secrets and server-only settings live in
 * `@/server/env`, which the build refuses to bundle into the browser.
 *
 * This is the only place under `src/` that reads `process.env` for these — everything else
 * imports `env` — so the set of variables the app depends on is this file, not a grep.
 *
 * Two things shape how it is written:
 *
 * - Every read is a getter, not a constant. Values are looked up on access, so tests can set
 *   `process.env` per case, and nothing throws at import time when a build runs without them.
 * - Every `process.env.NEXT_PUBLIC_*` is spelled out literally. Next only inlines those into the
 *   browser bundle where it can see the exact member access, so they can't be read by name.
 *
 * The non-`NEXT_PUBLIC_` variables here are simply `undefined` in the browser.
 *
 * An empty string counts as unset, so `FOO=` in a `.env` file behaves like no `FOO` at all.
 */

function text(value: string | undefined): string | undefined {
    return value === "" ? undefined : value;
}

export const env = {
    get NODE_ENV() {
        return process.env.NODE_ENV;
    },
    /** The dev server's port. */
    get PORT() {
        return text(process.env.PORT);
    },

    /** Host of this deployment, without a scheme. Set by Vercel. */
    get VERCEL_URL() {
        return text(process.env.VERCEL_URL);
    },
    /** Host of the branch's stable preview URL, without a scheme. Set by Vercel. */
    get VERCEL_BRANCH_URL() {
        return text(process.env.VERCEL_BRANCH_URL);
    },
    /** The production domain, without a scheme. Set by Vercel. */
    get VERCEL_PROJECT_PRODUCTION_URL() {
        return text(process.env.VERCEL_PROJECT_PRODUCTION_URL);
    },
    /** `production`, `preview` or `development`. Set by Vercel; unset locally. */
    get VERCEL_ENV() {
        return text(process.env.VERCEL_ENV);
    },
    get VERCEL_GIT_COMMIT_REF() {
        return text(process.env.VERCEL_GIT_COMMIT_REF);
    },
    get VERCEL_GIT_COMMIT_SHA() {
        return text(process.env.VERCEL_GIT_COMMIT_SHA);
    },
    get GITHUB_REF_NAME() {
        return text(process.env.GITHUB_REF_NAME);
    },
    get GITHUB_SHA() {
        return text(process.env.GITHUB_SHA);
    },

    get NEXT_PUBLIC_APP_DISPLAY_NAME() {
        return text(process.env.NEXT_PUBLIC_APP_DISPLAY_NAME);
    },
    get NEXT_PUBLIC_APP_REPOSITORY_URL() {
        return text(process.env.NEXT_PUBLIC_APP_REPOSITORY_URL);
    },
    get NEXT_PUBLIC_APP_VERSION() {
        return text(process.env.NEXT_PUBLIC_APP_VERSION);
    },
    get NEXT_PUBLIC_APP_VERSION_NAME() {
        return text(process.env.NEXT_PUBLIC_APP_VERSION_NAME);
    },
    get NEXT_PUBLIC_APP_BRANCH() {
        return text(process.env.NEXT_PUBLIC_APP_BRANCH);
    },
    get NEXT_PUBLIC_APP_COMMIT() {
        return text(process.env.NEXT_PUBLIC_APP_COMMIT);
    },

    /**
     * Kept as `string | undefined`, like every other field here, rather than coerced to
     * `boolean` — `base-url.ts` passes the whole `env` object into a helper typed
     * `Record<string, string | undefined>`, so a `boolean` field would break that call.
     * Callers just check it for truthiness (`if (env.AVUT_DEBUG_DB_QUERIES)`), which works
     * the same either way.
     */
    get AVUT_DEBUG_DB_QUERIES() {
        return text(process.env.AVUT_DEBUG_DB_QUERIES);
    },

    /** See `withArtificialLatency` — a single `ms` value, or a `"min:max"` range. */
    get AVUT_TRPC_ARTIFICIAL_LATENCY() {
        return parseNumberOrRange(text(process.env.AVUT_TRPC_ARTIFICIAL_LATENCY));
    },

    /** See `withArtificialLatency` — a single `ms` value, or a `"min:max"` range. */
    get AVUT_DB_ARTIFICIAL_LATENCY() {
        return parseNumberOrRange(text(process.env.AVUT_DB_ARTIFICIAL_LATENCY));
    },

    isDevelopment() {
        return this.NODE_ENV === "development";
    },
    isProduction() {
        return this.NODE_ENV === "production";
    },
    isPreview() {
        return this.VERCEL_ENV === "preview";
    },
} as const;

function parseNumberOrRange(value: string | undefined): number | [number, number] | undefined {
    if (value === undefined) return undefined;
    const rangeMatch = value.match(/^(\d+):(\d+)$/);
    if (rangeMatch) {
        const [, start, end] = rangeMatch;
        return [Number(start), Number(end)];
    }
    const num = Number(value);
    return isNaN(num) ? undefined : num;
}
