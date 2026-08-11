/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Route } from "next";

export const SIGN_IN_PATH = "/auth/sign-in";
export const POST_SIGN_IN_PATH = "/auth/post-sign-in";

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

/** Build the post-sign-in URL, preserving a validated return path as `?redirectTo=`. */
export function postSignInUrl(returnTo?: string | null): Route {
    const path = safeRedirectPath(returnTo);
    if (!path) return POST_SIGN_IN_PATH as Route;
    return `${POST_SIGN_IN_PATH}?redirectTo=${encodeURIComponent(path)}` as Route;
}
