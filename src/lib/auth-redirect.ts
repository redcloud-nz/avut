/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Route } from "next";

export const SIGN_IN_PATH = "/auth/sign-in";
export const SIGN_UP_PATH = "/auth/sign-up";
export const POST_SIGN_IN_PATH = "/auth/post-sign-in";
export const SIGN_OUT_PATH = "/auth/sign-out";

/** The base `safeRedirectPath` resolves against; `.invalid` can never be a real host. */
const PLACEHOLDER_ORIGIN = "https://avut.invalid";

/**
 * Validate a redirect target that came from user-controllable input (a query param).
 *
 * Only same-origin relative paths are accepted. Anything else — an absolute URL, a
 * protocol-relative `//host`, a backslash variant, or a non-path value — is rejected,
 * which is what stops `?redirectTo=https://evil.example` being an open redirect.
 */
export function safeRedirectPath(value?: string | null): string | null {
    if (!value) return null;
    if (!value.startsWith("/")) return null;
    // `//host` and `/\host` are both treated as protocol-relative by browsers.
    if (value.startsWith("//") || value.startsWith("/\\")) return null;
    // URL parsing strips tab/CR/LF and reads `\` as `/`, so `/<tab>/evil.example` would pass
    // the prefix checks above and still land on `//evil.example`. Reject those characters
    // outright, then resolve against a placeholder origin as a backstop: anything that leaves
    // it isn't a same-origin path, whatever the prefix said.
    if (/[\t\n\r\\]/.test(value)) return null;
    let url: URL;
    try {
        url = new URL(value, PLACEHOLDER_ORIGIN);
    } catch {
        return null;
    }
    if (url.origin !== PLACEHOLDER_ORIGIN) return null;
    // Return the input, not `url.pathname`: parsing collapses `.`/`..` segments, which turns
    // a harmless `/.//evil.example` into a protocol-relative `//evil.example`.
    return value;
}

/**
 * Build a sign-in URL, preserving a validated return path as `?redirectTo=`.
 *
 * Cast to `Route` because typed routes cannot express a query string; the path portion is
 * a literal, so only the query is unchecked.
 */
export function signInUrl(returnTo?: string | null): Route {
    const path = safeRedirectPath(returnTo);
    if (!path) return SIGN_IN_PATH as Route;
    return `${SIGN_IN_PATH}?redirectTo=${encodeURIComponent(path)}` as Route;
}

/**
 * Build the sign-out URL, preserving a validated return path as `?redirectTo=`. Every sign-out
 * goes through that page (see `src/components/auth/sign-out.tsx`); without a return path it
 * lands on sign-in.
 */
export function signOutUrl(returnTo?: string | null): Route {
    const path = safeRedirectPath(returnTo);
    if (!path) return SIGN_OUT_PATH as Route;
    return `${SIGN_OUT_PATH}?redirectTo=${encodeURIComponent(path)}` as Route;
}

/** Build the post-sign-in URL, preserving a validated return path as `?redirectTo=`. */
export function postSignInUrl(returnTo?: string | null): Route {
    const path = safeRedirectPath(returnTo);
    if (!path) return POST_SIGN_IN_PATH as Route;
    return `${POST_SIGN_IN_PATH}?redirectTo=${encodeURIComponent(path)}` as Route;
}

/**
 * Build a URL to one of the `/auth/*` pages, with optional prefill values and a validated return
 * path preserved as `?redirectTo=`.
 *
 * Cast to `Route` for the same reason as `signInUrl`: typed routes cannot express a query string.
 */
export function authUrl(
    path: Route,
    options: { email?: string | null; name?: string | null; returnTo?: string | null } = {},
): Route {
    const query = new URLSearchParams();
    if (options.email) query.set("email", options.email);
    if (options.name) query.set("name", options.name);

    const returnPath = safeRedirectPath(options.returnTo);
    if (returnPath) query.set("redirectTo", returnPath);

    const queryString = query.toString();
    return (queryString ? `${path}?${queryString}` : path) as Route;
}
