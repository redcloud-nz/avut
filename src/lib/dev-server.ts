/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Several local dev servers run side by side: 3000 is the user's own, 3100 is an agent's in the
 * main checkout, and every worktree has a fixed port above that (`.dev-port`, see AGENTS.md →
 * Dev servers). They all share `localhost`, which trips up better-auth in two ways that the
 * helpers here fix:
 *
 * - `BETTER_AUTH_URL` is copied into every checkout as `http://localhost:3000`, so a server on
 *   another port would send OAuth callbacks to the user's server.
 * - Browsers don't separate cookies by port, so signing in on one server would replace the
 *   session on all the others.
 *
 * `next dev` sets `PORT` to the port it bound, so these read the real port at request time.
 * Outside development they change nothing.
 */
import { env } from "@/lib/env";

/** The user's own dev server. Everything else about auth cookies stays as it was on this port. */
export const DEFAULT_DEV_PORT = "3000";

/** The local dev server's port, or undefined outside development. */
function devServerPort(): string | undefined {
    return env.isDevelopment() ? env.PORT : undefined;
}

/**
 * `url` with its port replaced by the dev server's, when it is a `localhost` URL in development.
 * Any other URL (a real host, a preview deploy) is returned unchanged.
 */
export function withDevServerPort(url: string): string {
    const port = devServerPort();
    if (!port) return url;
    const parsed = new URL(url);
    if (parsed.hostname !== "localhost") return url;
    parsed.port = port;
    return parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname);
}

/**
 * The better-auth cookie prefix: the default on 3000 and everywhere outside development, and a
 * per-port one on any other dev server so its session can't replace the user's. `auth.ts` and
 * the `getSessionCookie` check in `proxy.ts` must both use this, or the proxy looks for the wrong
 * cookie and every page redirects to sign-in.
 */
export function authCookiePrefix(): string | undefined {
    const port = devServerPort();
    return port && port !== DEFAULT_DEV_PORT ? `better-auth-${port}` : undefined;
}
