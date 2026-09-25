/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { env as appEnv } from "@/lib/env";

const PRODUCTION_FALLBACK_URL = "https://www.avut.nz";

type Env = Readonly<Record<string, string | undefined>>;

/** The stable production domain — `VERCEL_PROJECT_PRODUCTION_URL`, or the hardcoded fallback. */
function productionUrl(env: Env): string {
    return env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
        : PRODUCTION_FALLBACK_URL;
}

/**
 * Where a link inside an email should point: the environment that sent it, as the recipient can
 * actually reach it.
 *
 * - **Production** links to the production domain. `VERCEL_URL` there is still the unique
 *   per-deployment host (`<deployment>.vercel.app`), which Vercel Deployment Protection puts
 *   behind a Vercel login — an invitee who isn't a member of the Vercel team never reaches AVUT.
 * - **Preview** deployments link to their own `VERCEL_URL`, so a link lands back on the
 *   environment that sent it.
 * - **Local** (`next dev`, or `vercel dev`, which reports `VERCEL_ENV=development` and may also
 *   export a `VERCEL_URL`) links to the dev server.
 *
 * Reads `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` and `PORT` from `env`.
 */
export function resolveBaseUrl(env: Env): string {
    if (env.VERCEL_ENV === "production") return productionUrl(env);

    if (!env.VERCEL_ENV || env.VERCEL_ENV === "development" || !env.VERCEL_URL) {
        return `http://localhost:${env.PORT ?? 3000}`;
    }

    return `https://${env.VERCEL_URL}`;
}

/**
 * Base URL for static assets referenced in an email (the AVUT logo). Unlike action links,
 * these must resolve for the recipient regardless of which deployment sent the email — a
 * per-deployment `VERCEL_URL` host is often unreachable from outside Vercel (protected or
 * simply not the assigned domain), which is why the logo failed to load in delivered emails.
 * Always point these at the stable production domain.
 */
export function resolveAssetBaseUrl(env: Env): string {
    return productionUrl(env);
}

/**
 * The four fields these functions actually read, picked out of the full `env` singleton rather
 * than passed wholesale — `env` has grown fields (the artificial-latency settings, the `is*()`
 * helpers) that aren't `string | undefined`, so passing it directly no longer satisfies `Env`.
 * Narrowing here keeps `Env` itself loose and test-friendly (see `base-url.test.ts`, which
 * passes plain partial objects) instead of chasing every future addition to `env`.
 */
const relevantEnv: Env = {
    VERCEL_ENV: appEnv.VERCEL_ENV,
    VERCEL_URL: appEnv.VERCEL_URL,
    VERCEL_PROJECT_PRODUCTION_URL: appEnv.VERCEL_PROJECT_PRODUCTION_URL,
    PORT: appEnv.PORT,
};

/**
 * Base URL for the link in the invitation email, which the invitee has to be able to open.
 * See `resolveBaseUrl` for how it depends on the environment.
 */
export const baseUrl = resolveBaseUrl(relevantEnv);

/** Base URL for static assets in an email. See `resolveAssetBaseUrl`. */
export const assetBaseUrl = resolveAssetBaseUrl(relevantEnv);
