/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Flag-aware read model over the compiled `docs` collection. A docs section
 * whose id matches a module gated `off` for the current deployment environment
 * (see `src/lib/flags.ts` / `src/server/module-flags.ts`) is hidden entirely —
 * it drops out of the sidebar, 404s on direct navigation, and is excluded from
 * the search index. `getting-started` / `account` have no flag and are always
 * shown.
 */

import "server-only";

import { cache } from "react";

import { allDocs } from "content-collections";

import { getDocsNav, type Doc, type DocsNavSection } from "@/lib/docs";
import { resolveModuleFlags } from "@/server/module-flags";

/** Section ids hidden for the current deployment environment. Cached per request. */
const hiddenDocsSectionIds = cache(async (): Promise<ReadonlySet<string>> => {
    const flags = await resolveModuleFlags();
    return new Set(
        Object.entries(flags)
            .filter(([, enabled]) => enabled === false)
            .map(([id]) => id),
    );
});

/** Is this doc's section visible for the current deployment environment? */
async function isVisible(doc: Doc): Promise<boolean> {
    return !(await hiddenDocsSectionIds()).has(doc.section);
}

/** The docs sidebar tree with flag-hidden sections removed. */
export async function getVisibleDocsNav(): Promise<DocsNavSection[]> {
    const hidden = await hiddenDocsSectionIds();
    return getDocsNav().filter((section) => !hidden.has(section.id));
}

/** Look up a doc by slug, returning `undefined` if it or its section is flag-hidden. */
export async function getVisibleDocBySlug(slug: string): Promise<Doc | undefined> {
    const doc = allDocs.find((d) => d.slug === slug);
    if (!doc) return undefined;
    return (await isVisible(doc)) ? doc : undefined;
}

/** Slugs to statically generate — every doc in a visible section, including the `""` home. */
export async function getVisibleDocSlugs(): Promise<string[]> {
    const hidden = await hiddenDocsSectionIds();
    return allDocs.filter((d) => !hidden.has(d.section)).map((d) => d.slug);
}
