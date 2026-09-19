/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

const PRODUCTION_FALLBACK_URL = "https://www.avut.nz";

/**
 * Where a link inside an email should point: the environment that sent it, as the recipient can
 * actually reach it.
 *
 * - **Production** links to the production domain. `VERCEL_URL` there is still the unique
 *   per-deployment host (`<deployment>.vercel.app`), which Vercel Deployment Protection puts
 *   behind a Vercel login — an invitee who isn't a member of the Vercel team never reaches AVUT.
 * - **Preview** deployments link to their own `VERCEL_URL`, so a link lands back on the
 *   environment that sent it.
 * - **Local** falls back to the dev server.
 *
 * Reads `VERCEL_ENV`, `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` from `env`.
 */
export function resolveBaseUrl(env: Readonly<Record<string, string | undefined>>): string {
    if (env.VERCEL_ENV === "production") {
        return env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
            : PRODUCTION_FALLBACK_URL;
    }

    return env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:3000";
}

/**
 * Base URL for links inside an email (accept-invitation, reset-password, …) that the recipient
 * has to be able to open. See `resolveBaseUrl` for how it depends on the environment.
 */
export const baseUrl = resolveBaseUrl(process.env);

/**
 * Base URL for static assets referenced in an email (the AVUT logo). Unlike action links,
 * these must resolve for the recipient regardless of which deployment sent the email — a
 * per-deployment `VERCEL_URL` host is often unreachable from outside Vercel (protected or
 * simply not the assigned domain), which is why the logo failed to load in delivered emails.
 * Always point these at the stable production domain.
 */
export const assetBaseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : PRODUCTION_FALLBACK_URL;
