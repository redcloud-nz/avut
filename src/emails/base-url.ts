/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Base URL for links inside an email (accept-invitation, reset-password, …) that must land
 * back on the environment that sent the email. `VERCEL_URL` is the unique per-deployment host,
 * which is correct for that purpose.
 */
export const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

/**
 * Base URL for static assets referenced in an email (the AVUT logo). Unlike action links,
 * these must resolve for the recipient regardless of which deployment sent the email — a
 * per-deployment `VERCEL_URL` host is often unreachable from outside Vercel (protected or
 * simply not the assigned domain), which is why the logo failed to load in delivered emails.
 * Always point these at the stable production domain.
 */
export const assetBaseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://www.avut.nz";
