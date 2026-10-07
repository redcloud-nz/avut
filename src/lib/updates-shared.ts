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
import * as z from "zod";

/** A release version as written in `package.json` → `nz.avut.version`: `0.11`, `0.11.1`. */
export const UpdateVersion = z.string().regex(/^\d+\.\d+(\.\d+)?$/);

/** One release's "What's new" entry as sent to the client (and rendered on `/docs/updates`). */
export interface UpdateEntryData {
    /** The entry's filename without extension (`v0.11`); its `#anchor` on `/docs/updates`. */
    slug: string;
    /** The release the entry describes, without the `v` (`0.11`). Also the seen-cursor value. */
    version: string;
    /** The entry's heading; defaults to "Version <version>". */
    title: string;
    description: string | undefined;
    /** Compiled MDX body, for `<MDXContent code={mdx} />`. */
    mdx: string;
}

/**
 * Compare two release versions segment by segment (`0.9` < `0.10` < `0.10.1`), treating a missing
 * segment as 0. Negative when `a` is older, positive when newer, 0 when equal.
 */
export function compareVersions(a: string, b: string): number {
    const as = a.split(".").map(Number);
    const bs = b.split(".").map(Number);
    for (let i = 0; i < Math.max(as.length, bs.length); i++) {
        const diff = (as[i] ?? 0) - (bs[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * Href for the updates page, or one entry on it. Entry slugs are data-driven,
 * so typed routes can't check the anchor — hence the cast, as in `docsHref`.
 */
export function updatesHref(slug?: string): Route {
    return (slug ? `/docs/updates#${slug}` : "/docs/updates") as Route;
}
