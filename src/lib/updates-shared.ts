/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Client-safe pieces of the "what's new" read model. Kept apart from
 * `@/lib/updates` so client components can use them without pulling the
 * compiled `content-collections` corpus into the browser bundle (the same
 * split as `docs-sections.ts` / `docs.ts`).
 */

import type { Route } from "next";

/** One product-update entry as sent to the client (and rendered on `/docs/updates`). */
export interface UpdateEntryData {
    /** The entry's filename without extension; its `#anchor` on `/docs/updates`. */
    slug: string;
    title: string;
    /** ISO date (`YYYY-MM-DD`), read as 00:00 UTC. */
    publishedAt: string;
    description: string | undefined;
    /** The release the entry shipped in — display only. */
    version: string | undefined;
    /** Compiled MDX body, for `<MDXContent code={mdx} />`. */
    mdx: string;
}

/**
 * Href for the updates page, or one entry on it. Entry slugs are data-driven,
 * so typed routes can't check the anchor — hence the cast, as in `docsHref`.
 */
export function updatesHref(slug?: string): Route {
    return (slug ? `/docs/updates#${slug}` : "/docs/updates") as Route;
}
