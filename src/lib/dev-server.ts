/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Several local dev servers run side by side: 3000 is the user's own, 3100 is an agent's in the
 * main checkout, and every worktree has a fixed port above that (`.dev-port`, see AGENTS.md →
 * Dev servers). `BETTER_AUTH_URL` is copied into every checkout as `http://localhost:3000`, so
 * without `withDevServerPort` a server on another port would send OAuth callbacks to the user's.
 *
 * Session cookies are deliberately shared: browsers don't separate cookies by port, so signing in
 * once on 3000 signs you in on every server on the same database. The flip side is that signing
 * in as someone else on any of them replaces that session everywhere.
 *
 * `next dev` sets `PORT` to the port it bound, so this reads the real port at request time.
 * Outside development it changes nothing.
 */
import { env } from "@/lib/env";

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
